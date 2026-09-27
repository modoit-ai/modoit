#!/usr/bin/env python3
"""모두잇 홍보영상 스킬(youtube_build.py) 방식의 타이밍·자막·믹스 (v5: 아나운서톤 새 목소리).

python3 yt_audio.py timing MANIFEST_URL            -> timing JSON 을 stdout 으로
python3 yt_audio.py final  MANIFEST_URL SILENT_URL OUT.mp4 OUT.srt [BGM] [PRES_IMG]
manifest: {"segments":[{"id","kind","text","audio","video"?}]}

v5 내레이션 다듬기 (문장마다):
 1) 음색 보정(밝고 또렷하게) — 보스가 고른 6번
 2) 쉼 정리 — whisper 단어 위치로 쉼이 대본의 어디에 있는지 찾아서
    문장 끝 0.42초 · 쉼표 0.28초 · 띄어쓰기 0.12초까지만, 단어와 조사 사이(띄어쓰기 없는 곳)의 쉼은 삭제
    자르는 지점은 항상 무음 한가운데라 말끝이 잘리지 않음(끊김 방지)
 3) 말 빠르기 균형 — 구절마다 초당 음절 수를 재서 전체 중앙값 쪽으로 부분 보정(음높이 유지, ±10% 이내)
 4) 문장마다 음량을 맞춘 뒤 믹스
"""
import difflib, json, os, re, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

W = os.path.expanduser('~/yt'); os.makedirs(W, exist_ok=True); os.chdir(W)
LEAD, TAIL, LAST_HOLD = 0.8, 1.2, 3.0   # 장면 전환 공백 = TAIL + 다음 LEAD = 2.0초 (모든 장면 동일)
FIRST_LEAD = 0.35
EQ = 'highpass=f=90,equalizer=f=3200:t=o:w=1.2:g=3.5,treble=g=2.5:f=8000'
PAUSE = {'sent': 0.42, 'comma': 0.28, 'space': 0.12, 'inword': 0.06}
MIN_PAUSE = 0.13   # 이보다 짧은 무음은 ㄱ·ㄷ·ㅂ 같은 받침·파열음의 자연스러운 멈춤이라 건드리지 않음
MARKS = {'03a': ['역할', '상황', '요청', '형식'], '09a': ['첫째', '둘째', '셋째', '넷째'],
         '10a': ['이번', '구독', '좋아요', '알림', '미래']}   # 말하는 순서대로
_model = None


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr[-1500:])
    return r


def get(url, path):
    if not os.path.exists(path):
        urllib.request.urlretrieve(url, path)
    return path


def dur(p):
    return float(sh(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).stdout)


def silences(p, noise='-40dB', d=0.22):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r)]
    e = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r)]
    return list(zip(s, e + [None] * (len(s) - len(e))))


def words_of(path):
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('small', device='cpu', compute_type='int8')
    segs, _ = _model.transcribe(path, language='ko', word_timestamps=True, beam_size=5)
    return [(w.start, w.end, w.word.strip()) for s in segs for w in s.words]


norm = lambda s: re.sub(r'[^0-9A-Za-z가-힣]', '', s)


def syllables(t):
    t = norm(t)
    return len(re.findall(r'[가-힣]', t)) + 1.5 * len(re.findall(r'[0-9]', t)) + 0.8 * len(re.findall(r'[A-Za-z]', t))


def boundary_kind(text, words, t):
    """오디오 시각 t(쉼 한가운데)가 대본의 어느 경계에 있는지: sent / comma / space / inword"""
    wn = ''; pos = None
    for a, b, w in words:
        nw = norm(w)
        if pos is None:
            if t <= a: pos = len(wn)
            elif t < b: pos = len(wn) + round(len(nw) * (t - a) / max(0.05, b - a))
        wn += nw
    if pos is None: pos = len(wn)
    sn_idx = [i for i, c in enumerate(text) if norm(c)]          # 대본의 정규화 글자 → 원문 위치
    sn = ''.join(text[i] for i in sn_idx)
    sm = difflib.SequenceMatcher(None, wn, sn, autojunk=False)
    j = None
    for a, b, n in sm.get_matching_blocks():
        if a <= pos <= a + n: j = b + (pos - a); break
    if j is None:
        blocks = [(a, b, n) for a, b, n in sm.get_matching_blocks() if n]
        if not blocks: return 'space'
        a, b, n = min(blocks, key=lambda x: min(abs(pos - x[0]), abs(pos - x[0] - x[2])))
        j = b + (0 if pos < a else n)

    def gap(k):  # 정규화 글자 k-1 과 k 사이의 원문 문자열
        if k <= 0 or k >= len(sn_idx): return '.'
        return text[sn_idx[k - 1] + 1: sn_idx[k]]
    near = [gap(k) for k in range(j - 2, j + 3)]
    if any(re.search(r'[.?!]', g) for g in near): return 'sent'
    if any(',' in g for g in near[1:4]): return 'comma'
    return 'space' if ' ' in gap(j) else 'inword'


def cut(src, dst, keep):
    """keep=[(start,end,tempo)] 구간을 이어 붙인다. 자르는 지점은 모두 무음 안이라 짧은 페이드만."""
    fc = ''
    for i, (x, y, f) in enumerate(keep):
        tempo = f',atempo={f:.4f}' if abs(f - 1) > 0.004 else ''
        fc += f'[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS{tempo},afade=t=in:d=0.015,areverse,afade=t=in:d=0.015,areverse[p{i}];'
    fc += ''.join(f'[p{i}]' for i in range(len(keep))) + f'concat=n={len(keep)}:v=0:a=1[o]'
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', fc, '-map', '[o]', '-ar', '48000', '-ac', '1', dst])


def edit_pauses(s):
    """1) 음색 보정 → 2) 쉼 정리. 결과 p_ID.wav 와 쉼 종류 목록."""
    i = s['id']; get(s['audio'], f'n_{i}.wav')
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f'n_{i}.wav', '-af', EQ, '-ar', '48000', '-ac', '1', f'e_{i}.wav'])
    D = dur(f'e_{i}.wav'); words = words_of(f'e_{i}.wav')
    sil = [(a, D if b is None else b) for a, b in silences(f'e_{i}.wav', '-42dB', MIN_PAUSE)]
    keep, cur, kinds = [], 0.0, []
    for a, b in sil:
        if a < 0.05: cur = max(0.0, b - 0.06); continue          # 앞 무음
        if b >= D - 0.05: keep.append((cur, min(D, a + 0.12), 1.0)); cur = None; break   # 끝 무음
        k = boundary_kind(s['text'], words, (a + b) / 2); T = PAUSE[k]; kinds.append((k, round(b - a, 2)))
        if b - a > T + 0.02:
            keep.append((cur, a + T / 2, 1.0)); cur = b - T / 2
    if cur is not None: keep.append((cur, D, 1.0))
    cut(f'e_{i}.wav', f'p_{i}.wav', keep)
    raw = round(difflib.SequenceMatcher(None, norm(s['text']), norm(''.join(w for _, _, w in words))).ratio(), 3)
    return kinds, raw


def phrases(i):
    """정리된 파일에서 구절(0.2초 이상 쉼으로 나뉜 말 덩어리)과 음절 수."""
    f = f'p_{i}.wav'; D = dur(f); words = words_of(f)
    sil = [(a, D if b is None else b) for a, b in silences(f, '-42dB', 0.2)]
    edges = [0.0] + [(a + b) / 2 for a, b in sil if a > 0.05 and b < D - 0.05] + [D]
    sp = [(a, D if b is None else b) for a, b in sil]
    out = []
    for x, y in zip(edges, edges[1:]):
        talk = (y - x) - sum(max(0, min(y, b) - max(x, a)) for a, b in sp)   # 쉼을 뺀 말 시간
        syl = sum(syllables(w) for a, b, w in words if x <= (a + b) / 2 < y)
        out.append([x, y, talk, syl])
    return out, words


def timing(segs):
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda s: get(s['audio'], f"n_{s['id']}.wav"), segs))
    qc = {}
    for s in segs:                                   # whisper 모델이 스레드 안전하지 않아 순서대로
        k, raw = edit_pauses(s); qc[s['id']] = {'pauses': k, 'match_raw': raw}
    PH = {}
    for s in segs:
        PH[s['id']] = phrases(s['id'])
    rates = sorted(p[3] / p[2] for ph, _ in PH.values() for p in ph if p[2] > 0.7 and p[3] >= 4)
    target = float(os.environ.get('TARGET_RATE') or rates[len(rates) // 2])   # 일부 장면만 만들 때는 전체 기준값(5.64)을 넘겨 같은 빠르기로
    for s in segs:
        i = s['id']; ph, words = PH[i]; keep = []; tm = []   # tm: (원래 시작, 새 시작, 배율) — 표시 시각 변환용
        t_new = 0.0
        for x, y, talk, syl in ph:
            f = 1.0
            if talk > 0.7 and syl >= 4:
                f = min(1.10, max(0.90, (target / (syl / talk)) ** 0.7))   # 느린 구절은 조금 빠르게, 빠른 구절은 조금 느리게
            keep.append((x, y, f)); tm.append((x, t_new, f)); t_new += (y - x) / f
        cut(f'p_{i}.wav', f'c_{i}.wav', keep)
        m = {}
        if i in MARKS:
            def conv(t):
                for x, n, f in reversed(tm):
                    if t >= x: return n + (t - x) / f
                return t
            k0 = 0
            for kw in MARKS[i]:
                hit = next((k for k in range(k0, len(words)) if norm(kw) in norm(words[k][2])), None)
                if hit is None:   # 단어가 둘로 쪼개져 인식된 경우
                    hit = next((k for k in range(k0, len(words) - 1) if norm(kw) in norm(words[k][2] + words[k + 1][2])), None)
                if hit is not None:
                    m[kw] = round(conv(words[hit][0]), 3); k0 = hit + 1
        qc[i].update(rates=[round(p[3] / p[2], 1) for p in ph if p[2] > 0.7 and p[3] >= 4], tempo=[round(k[2], 3) for k in keep], marks=m)
    # 문장별 음량 측정 → 믹스 때 같은 크기로
    def loud(s):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f"c_{s['id']}.wav", '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
        return s['id'], float(re.findall(r'I:\s+(-?[0-9.]+) LUFS', r)[-1])
    with ThreadPoolExecutor(8) as ex:
        L = dict(ex.map(loud, segs))
    # 최종 문장 전사 검사
    for s in segs:
        txt = ''.join(w for _, _, w in words_of(f"c_{s['id']}.wav"))
        qc[s['id']]['match'] = round(difflib.SequenceMatcher(None, norm(s['text']), norm(txt)).ratio(), 3)
        qc[s['id']]['asr'] = txt
    scenes, caps, pres, mix = [], [], [], []
    t = 0.0
    for n, s in enumerate(segs):
        f = f"c_{s['id']}.wav"; D = dur(f); sil = silences(f, '-42dB', 0.2)
        s0 = sil[0][1] if sil and sil[0][0] < 0.05 and sil[0][1] else 0.0
        s1 = D
        for a, b in reversed(sil):
            be = D if b is None else b
            if a > s0 and D - be < 0.8 and (be - a) > 0.15: s1 = a; break
        lead = FIRST_LEAD if n == 0 else LEAD
        sd = lead + (s1 - s0) + TAIL + (LAST_HOLD if n == len(segs) - 1 else 0)
        vstart = t + lead
        sc = {'id': s['id'], 'start': round(t, 3), 'dur': round(sd, 3), 'lead': round(lead, 3), 'speech': round(s1 - s0, 3)}
        m = qc[s['id']].get('marks')
        if m: sc['marks'] = {k: round(lead + v - s0, 3) for k, v in m.items()}   # 장면 기준 시각
        scenes.append(sc)
        mix.append([f, round(s0, 3), round(s1, 3), round(vstart, 3), round(-18 - L[s['id']], 2)])
        captions(s['text'], sil, s0, s1, vstart, caps)
        if s['kind'] == 'talk':
            pre = min(0.3, s0)
            pres.append({'id': s['id'], 'si': n, 'px': s.get('px', 300), 'start': round(vstart - pre, 3), 'dur': round(s1 - s0 + pre + TAIL * 0.6, 3), 'off': round(s0 - pre, 3)})
        t += sd
    return {'scenes': scenes, 'caps': caps, 'pres': pres, 'mix': mix, 'total': round(t, 3), 'qc': qc, 'target_rate': round(target, 2)}


def captions(txt, sil, s0, s1, vstart, caps):
    chunks = []; cur = s0
    for x, y in sil:
        if y is None or x <= s0 + 0.1 or y >= s1 - 0.05: continue
        if y - x >= 0.25: chunks.append([cur, x]); cur = y
    chunks.append([cur, s1])
    merged = []
    for c in chunks:
        if merged and (c[1] - c[0] < 1.1 or merged[-1][1] - merged[-1][0] < 1.1): merged[-1][1] = c[1]
        else: merged.append(c)
    chunks = merged
    words = txt.split(' ')
    tot_t = sum(c[1] - c[0] for c in chunks); tot_c = len(txt)
    acc_t = 0; wi = 0
    for ci, c in enumerate(chunks):
        acc_t += c[1] - c[0]
        if ci == len(chunks) - 1:
            seg = ' '.join(words[wi:])
        else:
            target = tot_c * acc_t / tot_t; best = None
            for j in range(wi + 1, len(words)):
                L = sum(len(w) + 1 for w in words[:j])
                pen = abs(L - target) - (6 if re.search(r'[.?!,]$', words[j - 1]) else 0)
                if best is None or pen < best[0]: best = (pen, j)
            j = best[1] if best else len(words)
            seg = ' '.join(words[wi:j]); wi = j
        if not seg: continue
        parts = [seg]
        while max(len(x) for x in parts) > 32:
            k = max(range(len(parts)), key=lambda q: len(parts[q])); w = parts[k].split(' ')
            mid = len(parts[k]) / 2; best = None
            for j in range(1, len(w)):
                L = len(' '.join(w[:j])); pen = abs(L - mid) - (8 if re.search(r'[.?!,]$', w[j - 1]) else 0)
                if best is None or pen < best[0]: best = (pen, j)
            parts[k:k + 1] = [' '.join(w[:best[1]]), ' '.join(w[best[1]:])]
        T = c[1] - c[0]; tl = sum(len(x) for x in parts); t0 = c[0]
        for x in parts:
            t1 = t0 + T * len(x) / tl
            caps.append([round(vstart + t0 - s0, 3), round(vstart + t1 - s0 + (0.25 if x is parts[-1] else 0), 3), x]); t0 = t1


def srt(caps, path):
    def ts(x):
        h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
        return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    with open(path, 'w') as fh:
        for i, (a, b, x) in enumerate(caps, 1):
            fh.write(f'{i}\n{ts(a)} --> {ts(b)}\n{x}\n\n')


def final(segs, silent_url, out, srt_path, bgm=None, pres_img=None, T=None):
    T = T or timing(segs)
    total = T['total']
    get(silent_url, 'silent.mp4')
    # 1) 내레이션 믹스: 문장별 음량 맞춤 → 압축 → loudnorm -10 LUFS → limiter(level=disabled)
    ins, fc, mixin = [], '', ''
    for i, (f, a, b, d, g) in enumerate(T['mix']):
        ins += ['-i', f]; ms = int(d * 1000)
        fc += f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim={a}:{b},asetpts=PTS-STARTPTS,volume={g}dB,afade=t=in:d=0.02,afade=t=out:st={round(b - a - 0.04, 3)}:d=0.04,adelay={ms}|{ms}[v{i}];'
        mixin += f'[v{i}]'
    n = len(T['mix'])
    fc += f'{mixin}amix=inputs={n}:normalize=0,acompressor=threshold=-22dB:ratio=4:attack=4:release=90:makeup=2,loudnorm=I=-10:TP=-1.5:LRA=6,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur={total},atrim=0:{total},alimiter=limit=0.6:attack=2:release=60:level=disabled[out]'
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', '[out]', '-ar', '48000', '-ac', '2', 'voice.wav'])
    if bgm:
        # 스킬 확정 레벨: 목소리 아래 0.09, 인트로(첫 말 전)·마무리(말 끝난 뒤) 0.20~0.22, 단락이 바뀌는 2초 공백에서는 0.15로 살짝 올림
        first_v = T['mix'][0][3]; last_end = T['mix'][-1][3] + T['mix'][-1][2] - T['mix'][-1][1]
        sc = T['scenes']; gaps = []
        for k in range(1, len(sc)):
            if sc[k]['id'][:2] != sc[k - 1]['id'][:2]:
                gaps.append((sc[k - 1]['start'] + sc[k - 1]['lead'] + sc[k - 1]['speech'] + 0.25, sc[k]['start'] + sc[k]['lead'] - 0.25))
        g = '+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in gaps) or '0'
        vol = f"if(lt(t,{first_v:.2f}),0.20,if(gt(t,{last_end + 0.3:.2f}),0.22,if({g},0.15,0.09)))"
        sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'voice.wav', '-i', bgm, '-filter_complex',
            f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:{total},asetpts=PTS-STARTPTS,volume='{vol}':eval=frame,afade=t=in:d=0.8,afade=t=out:st={total - 2.5:.2f}:d=2.5[m];"
            f"[0:a][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.6:attack=2:release=60:level=disabled[o]", '-map', '[o]', '-ar', '48000', 'mix.wav'])
        os.replace('mix.wav', 'voice.wav')
    # 2) 강사 오버레이 (가슴 위까지 확대 · 둥근 모서리 · 라임 테두리)
    #    립싱크 영상이 있으면 그 영상, 없으면 강사 사진에 아주 느린 줌(말하는 동안 살짝 다가가는 움직임)
    for p in T['pres']:
        s = next(x for x in segs if x['id'] == p['id'])
        if s.get('video'): get(s['video'], f"v_{p['id']}.mp4")
    if pres_img: get(pres_img, 'pres.png')
    Y, S, R, B = 285, 440, 30, 6
    inner = S - 2 * B
    sh(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=white:s={inner}x{inner}', '-frames:v', '1',
        '-vf', f"format=gray,geq=lum='if(gt(abs(X-{inner}/2)\\,{inner}/2-{R})*gt(abs(Y-{inner}/2)\\,{inner}/2-{R})*gt(hypot(abs(X-{inner}/2)-({inner}/2-{R})\\,abs(Y-{inner}/2)-({inner}/2-{R}))\\,{R})\\,0\\,255)'", 'mask.png'])
    sh(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0xb7f75b:s={S}x{S}', '-frames:v', '1',
        '-vf', f"format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(abs(X-{S}/2)\\,{S}/2-{R+B})*gt(abs(Y-{S}/2)\\,{S}/2-{R+B})*gt(hypot(abs(X-{S}/2)-({S}/2-{R+B})\\,abs(Y-{S}/2)-({S}/2-{R+B}))\\,{R+B})\\,0\\,255)'", 'frame.png'])
    vin = ['-i', 'silent.mp4', '-loop', '1', '-i', 'mask.png', '-loop', '1', '-i', 'frame.png']
    for p in T['pres']:
        s = next(x for x in segs if x['id'] == p['id'])
        if s.get('video'): vin += ['-ss', str(p['off']), '-i', f"v_{p['id']}.mp4"]
        else: vin += ['-loop', '1', '-framerate', '30', '-t', str(p['dur'] + 1), '-i', 'pres.png']
    npres = len(T['pres'])
    fcv = '[1:v]format=gray,split=' + str(npres) + ''.join(f'[m{i}]' for i in range(npres)) + ';'
    fcv += '[2:v]format=rgba,split=' + str(npres) + ''.join(f'[fr{i}]' for i in range(npres)) + ';'
    last = '0:v'
    for i, p in enumerate(T['pres']):
        k = 3 + i; st, du = p['start'], p['dur']
        s = next(x for x in segs if x['id'] == p['id'])
        crop = 'crop=iw/1.46:ih/1.46:iw*0.23/1.46:ih*0.11/1.46'
        if s.get('video'):
            src = f"[{k}:v]fps=30,{crop},scale={inner}:{inner},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=3,trim=0:{du},format=rgba[c{i}];"
        else:
            src = (f"[{k}:v]{crop},scale={inner * 2}:{inner * 2},zoompan=z='1+0.05*on/{max(1, int(du * 30))}':x='iw/2-iw/zoom/2':y='ih*0.42-ih/zoom*0.42':d=1:s={inner}x{inner}:fps=30,"
                   f"setpts=PTS-STARTPTS,trim=0:{du},format=rgba[c{i}];")
        fcv += (src +
                f"[m{i}]trim=0:{du},setpts=PTS-STARTPTS[mt{i}];[c{i}][mt{i}]alphamerge[cm{i}];"
                f"[fr{i}]trim=0:{du},setpts=PTS-STARTPTS[fl{i}];"
                f"[fl{i}][cm{i}]overlay={B}:{B}:format=auto,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st={max(0, du - 0.3):.3f}:d=0.3:alpha=1,setpts=PTS+{st}/TB[p{i}];"
                f"[{last}][p{i}]overlay={p['px']}:{Y}:eof_action=pass:enable='between(t,{st},{st + du})'[o{i}];")
        last = f'o{i}'
    fcv = fcv.rstrip(';')
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + vin + ['-i', 'voice.wav', '-filter_complex', fcv,
        '-map', f'[{last}]', '-map', f'{3 + npres}:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '256k', '-t', str(total), '-movflags', '+faststart', out])
    srt(T['caps'], srt_path)
    print('OK', round(dur(out), 2), 'caps', len(T['caps']))


if __name__ == '__main__':
    mode, man = sys.argv[1], json.load(open(get(sys.argv[2], 'manifest.json')))
    segs = man['segments']
    if mode == 'timing':
        T = timing(segs); json.dump(T, open('timing_full.json', 'w'), ensure_ascii=False)
        if len(sys.argv) > 3:   # 정리된 내레이션 + 타이밍을 묶어 업로드 (final 에서 그대로 재사용)
            sh(['bash', '-c', 'tar czf prep.tgz timing_full.json c_*.wav'])
            sh(['curl', '-sf', '-X', 'PUT', '-H', 'Content-Type: application/octet-stream', '--data-binary', '@prep.tgz', sys.argv[3]])
            print('PREP_UPLOADED')
        T.pop('mix')
        print('TIMING_JSON=' + json.dumps(T, ensure_ascii=False))
    else:
        args = sys.argv[3:]; T = None
        if '--reuse' in args:
            k = args.index('--reuse'); get(args[k + 1], 'prep.tgz'); args = args[:k] + args[k + 2:]
            sh(['tar', 'xzf', 'prep.tgz']); T = json.load(open('timing_full.json'))
        final(segs, args[0], args[1], args[2], args[3] if len(args) > 3 else None, args[4] if len(args) > 4 else None, T)
