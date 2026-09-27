"""각 내레이션의 문장 중간 쉼(0.35초 이상)과 whisper 전사를 뽑아, 대본과 다르게 읽힌(더듬은) 곳을 찾는다."""
import json, re, subprocess, sys, urllib.request, os, difflib
from faster_whisper import WhisperModel
os.makedirs('an', exist_ok=True); os.chdir('an')
man = json.load(urllib.request.urlopen(sys.argv[1]))
m = WhisperModel('small', device='cpu', compute_type='int8')
norm = lambda s: re.sub(r'[^0-9A-Za-z가-힣]', '', s)
for s in man['segments']:
    f = f"{s['id']}.wav"
    if not os.path.exists(f): urllib.request.urlretrieve(s['audio'], f)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'silencedetect=noise=-40dB:d=0.35', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r)]; en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r)]
    D = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))
    segs, _ = m.transcribe(f, language='ko', word_timestamps=True, beam_size=5)
    words = [w for sg in segs for w in sg.words]
    txt = ''.join(w.word for w in words).strip()
    pauses = []
    for a, b in zip(st, en):
        if a < 0.1 or b > D - 0.1: continue
        prev = ''.join(w.word for w in words if w.end <= a + 0.05)[-8:]
        pauses.append(f'{b - a:.2f}s@"{prev.strip()}"')
    ratio = difflib.SequenceMatcher(None, norm(s['text']), norm(txt)).ratio()
    print(f"{s['id']} {s['kind']} dur={D:.1f} match={ratio:.2f} pauses={len(pauses)} {' '.join(pauses)}")
    if ratio < 0.93: print('   ASR:', txt)
