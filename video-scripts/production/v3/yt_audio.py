#!/usr/bin/env python3
"""모두잇 홍보영상 스킬(youtube_build.py) 방식의 타이밍·자막·믹스.

python3 yt_audio.py timing MANIFEST_URL            -> timing JSON 을 stdout 으로
python3 yt_audio.py final  MANIFEST_URL SILENT_URL OUT.mp4 OUT.srt
manifest: {"segments":[{"id","kind","text","audio","video"?}]}
"""
import json, os, re, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

W = os.path.expanduser('~/yt'); os.makedirs(W, exist_ok=True); os.chdir(W)
LEAD, TAIL, LAST_HOLD = 0.5, 0.9, 3.0
CHAPTER_LEAD = 2.2   # 단락(챕터)이 바뀌면 화면 먼저, 약 2초 뒤 내레이션
HOLD = {'prompt': 4.0, 'job': 4.5, 'split': 2.5, 'table': 3.0, 'chat': 1.5}  # 프롬프트·비교 화면은 말이 끝난 뒤 읽을 시간


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


def clean(src, dst, keep_pauses):
    """문장 중간 0.5초 넘는 쉼은 0.38초로(립싱크 구간은 유지), 앞뒤 무음 정리. 앞에서 잘라낸 길이를 돌려준다."""
    D = dur(src); sil = silences(src, d=0.25)
    keep = []; cur = 0.0; lead_cut = 0.0
    for a, b in sil:
        b = D if b is None else b
        if a < 0.05:
            cur = max(0.0, b - 0.08); lead_cut = cur; continue
        if b >= D - 0.05:
            keep.append((cur, a + 0.1)); cur = None; break
        if b - a > 0.5 and not keep_pauses:
            keep.append((cur, a + 0.19)); cur = b - 0.19
    if cur is not None:
        keep.append((cur, D))
    fc = ''.join(f'[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS[p{i}];' for i, (x, y) in enumerate(keep))
    fc += ''.join(f'[p{i}]' for i in range(len(keep))) + f'concat=n={len(keep)}:v=0:a=1[o]'
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', fc, '-map', '[o]', '-ar', '48000', '-ac', '1', dst])
    return lead_cut


def captions(txt, sil, s0, s1, vstart, caps):
    chunks = []; cur = s0
    for x, y in sil:
        if y is None or x <= s0 + 0.1 or y >= s1 - 0.05: continue
        if y - x >= 0.3: chunks.append([cur, x]); cur = y
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


def timing(segs):
    def prep(s):
        get(s['audio'], f"n_{s['id']}.wav")
        lc = clean(f"n_{s['id']}.wav", f"c_{s['id']}.wav", s['kind'] == 'talk')
        return s['id'], lc
    with ThreadPoolExecutor(8) as ex:
        leadcut = dict(ex.map(prep, segs))
    scenes, caps, pres, mix = [], [], [], []
    t = 0.0
    for i, s in enumerate(segs):
        f = f"c_{s['id']}.wav"; D = dur(f); sil = silences(f)
        s0 = sil[0][1] if sil and sil[0][0] < 0.05 and sil[0][1] else 0.0
        s1 = D
        for a, b in reversed(sil):
            be = D if b is None else b
            if a > s0 and D - be < 0.8 and (be - a) > 0.2: s1 = a; break
        lead = 0.35 if i == 0 else (CHAPTER_LEAD if s['id'][:2] != segs[i - 1]['id'][:2] else LEAD)
        hold = HOLD.get(s.get('vt'), 0.0)
        sd = lead + (s1 - s0) + TAIL + hold + (LAST_HOLD if i == len(segs) - 1 else 0)
        vstart = t + lead
        scenes.append({'id': s['id'], 'start': round(t, 3), 'dur': round(sd, 3), 'lead': round(lead, 3), 'speech': round(s1 - s0, 3)})
        mix.append([f, round(s0, 3), round(s1, 3), round(vstart, 3)])
        captions(s['text'], sil, s0, s1, vstart, caps)
        if s['kind'] == 'talk':
            # 립싱크 클립은 원본 내레이션 기준 → 원본에서 잘린 앞부분 + s0 만큼 건너뛴 지점부터 재생
            pre = min(0.3, leadcut[s['id']] + s0)  # 말 시작 직전 0.3초부터 보여주되, 클립 안에서 같은 만큼만 앞당겨 입모양 싱크 유지
            pres.append({'id': s['id'], 'si': i, 'px': s.get('px', 300), 'start': round(vstart - pre, 3), 'dur': round(s1 - s0 + pre + TAIL * 0.6, 3), 'off': round(leadcut[s['id']] + s0 - pre, 3)})
        t += sd
    return {'scenes': scenes, 'caps': caps, 'pres': pres, 'mix': mix, 'total': round(t, 3)}


def srt(caps, path):
    def ts(x):
        h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
        return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    with open(path, 'w') as fh:
        for i, (a, b, x) in enumerate(caps, 1):
            fh.write(f'{i}\n{ts(a)} --> {ts(b)}\n{x}\n\n')


def final(segs, silent_url, out, srt_path, bgm=None):
    T = timing(segs)
    total = T['total']
    get(silent_url, 'silent.mp4')
    # 1) 내레이션 믹스: 압축 → loudnorm -10 LUFS → limiter(level=disabled)  (배경음악 없음)
    ins, fc, mixin = [], '', ''
    for i, (f, a, b, d) in enumerate(T['mix']):
        ins += ['-i', f]; ms = int(d * 1000)
        fc += f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={round(b - a - 0.04, 3)}:d=0.04,adelay={ms}|{ms}[v{i}];'
        mixin += f'[v{i}]'
    n = len(T['mix'])
    fc += f'{mixin}amix=inputs={n}:normalize=0,acompressor=threshold=-22dB:ratio=4:attack=4:release=90:makeup=2,loudnorm=I=-10:TP=-1.5:LRA=6,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur={total},atrim=0:{total},alimiter=limit=0.7:attack=2:release=60:level=disabled[out]'
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + ins + ['-filter_complex', fc, '-map', '[out]', '-ar', '48000', '-ac', '2', 'voice.wav'])
    if bgm:
        # 스킬 확정 레벨: 목소리 아래 0.09, 인트로(첫 말 전)·마무리(말 끝난 뒤) 0.20~0.22, 단락 전환 쉼에서는 0.15로 살짝 올림
        first_v = T['mix'][0][3]; last_end = T['mix'][-1][3] + T['mix'][-1][2] - T['mix'][-1][1]
        gaps = [(sc['start'], sc['start'] + sc['lead'] - 0.2) for sc in T['scenes'][1:] if sc['lead'] >= CHAPTER_LEAD - 0.01]
        g = '+'.join(f'between(t,{a:.2f},{b:.2f})' for a, b in gaps) or '0'
        vol = f"if(lt(t,{first_v:.2f}),0.20,if(gt(t,{last_end + 0.3:.2f}),0.22,if({g},0.15,0.09)))"
        sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', 'voice.wav', '-i', bgm, '-filter_complex',
            f"[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=0:{total},asetpts=PTS-STARTPTS,volume='{vol}':eval=frame,afade=t=in:d=0.8,afade=t=out:st={total - 2.5:.2f}:d=2.5[m];"
            f"[0:a][m]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.7:attack=2:release=60:level=disabled[o]", '-map', '[o]', '-ar', '48000', 'mix.wav'])
        os.replace('mix.wav', 'voice.wav')
    # 2) 강사 립싱크 클립 오버레이 (가슴 위까지 확대 · 둥근 모서리 · 라임 테두리)
    for p in T['pres']:
        s = next(x for x in segs if x['id'] == p['id']); get(s['video'], f"v_{p['id']}.mp4")
    Y, S, R, B = 285, 440, 30, 6  # 강사 440px, 글자와 한 묶음으로 가운데 (X 는 장면별 px)
    inner = S - 2 * B
    sh(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=white:s={inner}x{inner}', '-frames:v', '1',
        '-vf', f"format=gray,geq=lum='if(gt(abs(X-{inner}/2)\\,{inner}/2-{R})*gt(abs(Y-{inner}/2)\\,{inner}/2-{R})*gt(hypot(abs(X-{inner}/2)-({inner}/2-{R})\\,abs(Y-{inner}/2)-({inner}/2-{R}))\\,{R})\\,0\\,255)'", 'mask.png'])
    sh(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=0xb7f75b:s={S}x{S}', '-frames:v', '1',
        '-vf', f"format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(abs(X-{S}/2)\\,{S}/2-{R+B})*gt(abs(Y-{S}/2)\\,{S}/2-{R+B})*gt(hypot(abs(X-{S}/2)-({S}/2-{R+B})\\,abs(Y-{S}/2)-({S}/2-{R+B}))\\,{R+B})\\,0\\,255)'", 'frame.png'])
    vin = ['-i', 'silent.mp4', '-loop', '1', '-i', 'mask.png', '-loop', '1', '-i', 'frame.png']
    for p in T['pres']:
        vin += ['-ss', str(p['off']), '-i', f"v_{p['id']}.mp4"]
    # 146% 확대(left -23%, top -11%) → 가슴 위까지, 둥근 모서리 마스크 + 라임 테두리, 해당 구간에만 overlay
    fcv = '[1:v]format=gray,split=' + str(len(T['pres'])) + ''.join(f'[m{i}]' for i in range(len(T['pres']))) + ';'
    fcv += '[2:v]format=rgba,split=' + str(len(T['pres'])) + ''.join(f'[fr{i}]' for i in range(len(T['pres']))) + ';'
    last = '0:v'
    for i, p in enumerate(T['pres']):
        k = 3 + i; st, du = p['start'], p['dur']
        fcv += (f"[{k}:v]fps=30,crop=iw/1.46:ih/1.46:iw*0.23/1.46:ih*0.11/1.46,scale={inner}:{inner},setpts=PTS-STARTPTS,"
                f"tpad=stop_mode=clone:stop_duration=3,trim=0:{du},format=rgba[c{i}];"
                f"[m{i}]trim=0:{du},setpts=PTS-STARTPTS[mt{i}];[c{i}][mt{i}]alphamerge[cm{i}];"
                f"[fr{i}]trim=0:{du},setpts=PTS-STARTPTS[fl{i}];"
                f"[fl{i}][cm{i}]overlay={B}:{B}:format=auto,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st={max(0, du - 0.3):.3f}:d=0.3:alpha=1,setpts=PTS+{st}/TB[p{i}];"
                f"[{last}][p{i}]overlay={p['px']}:{Y}:eof_action=pass:enable='between(t,{st},{st + du})'[o{i}];")
        last = f'o{i}'
    fcv = fcv.rstrip(';')
    sh(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + vin + ['-i', 'voice.wav', '-filter_complex', fcv,
        '-map', f'[{last}]', '-map', f'{3 + len(T["pres"])}:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k', '-t', str(total), '-movflags', '+faststart', out])
    srt(T['caps'], srt_path)
    print('OK', round(dur(out), 2), 'caps', len(T['caps']))


if __name__ == '__main__':
    mode, man = sys.argv[1], json.load(open(get(sys.argv[2], 'manifest.json')))
    segs = man['segments']
    if mode == 'timing':
        T = timing(segs); T.pop('mix')
        print('TIMING_JSON=' + json.dumps(T, ensure_ascii=False))
    else:
        final(segs, sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6] if len(sys.argv) > 6 else None)
