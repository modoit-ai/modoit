#!/usr/bin/env python3
"""저작권 걱정 없는 배경음악을 직접 합성한다 (numpy만 사용).
따뜻한 패드 + 일렉피아노 아르페지오 + 베이스 + 가벼운 퍼커션, 90BPM, C-Am-F-G 진행.
python3 bgm.py SECONDS out.wav
"""
import sys, wave
import numpy as np

SR = 44100
BPM = 90
BEAT = 60 / BPM
BAR = BEAT * 4
dur = float(sys.argv[1]); out = sys.argv[2]
N = int((dur + 4) * SR)
L = np.zeros(N, np.float32); R = np.zeros(N, np.float32)
rng = np.random.default_rng(7)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

# 코드 진행 (MIDI). 8마디 단위로 두 가지 진행을 번갈아
PROG = [
    [(48, [60, 64, 67, 71]), (45, [57, 60, 64, 67]), (41, [57, 60, 65, 69]), (43, [55, 59, 62, 67])],   # Cmaj7 Am7 Fmaj7 G
    [(41, [57, 60, 64, 65]), (43, [55, 59, 62, 65]), (40, [55, 59, 64, 67]), (45, [57, 60, 64, 67])],   # F G Em Am
]


def env(n, a, r, sus=1.0):
    e = np.ones(n, np.float32) * sus
    na, nr = int(a * SR), int(r * SR)
    if na: e[:na] = np.linspace(0, sus, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def add(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def pad(notes, length):
    n = int(length * SR); t = np.arange(n) / SR; s = np.zeros(n, np.float32)
    for m in notes:
        f = hz(m)
        for det in (-0.12, 0.0, 0.12):  # 살짝 어긋난 사인파 3개로 코러스 느낌
            ff = f * 2 ** (det / 12)
            s += (np.sin(2 * np.pi * ff * t) + 0.18 * np.sin(4 * np.pi * ff * t)).astype(np.float32)
    return s / (len(notes) * 3) * env(n, 1.2, 1.4)


def epiano(m, length=1.6):
    n = int(length * SR); t = np.arange(n) / SR; f = hz(m)
    idx = 1.8 * np.exp(-t * 6)  # FM 로즈 느낌: 치는 순간만 밝게
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    s += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)
    return (s * np.exp(-t * 2.2) * env(n, 0.004, 0.2)).astype(np.float32)


def bass(m, length):
    n = int(length * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.tanh(1.6 * (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)))
    return (s * env(n, 0.02, 0.25, 0.9) * np.exp(-t * 0.35)).astype(np.float32)


def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 50 + 70 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)).astype(np.float32)


def shaker():
    n = int(0.09 * SR); w = rng.standard_normal(n).astype(np.float32)
    w = w - np.convolve(w, np.ones(6) / 6, 'same')  # 고역만 남김
    return w * np.exp(-np.arange(n) / SR * 45)


bars = int(dur / BAR) + 2
ARP = [0, 2, 1, 3, 2, 1, 3, 2]
for b in range(bars):
    t0 = b * BAR
    root, chord = PROG[(b // 8) % 2][b % 4]
    sec = (b // 16) % 3  # 16마디마다 편곡 밀도 변화: 0 가벼움, 1 보통, 2 풍성
    p = pad(chord, BAR + 1.4)
    add(L, t0, p, 0.30); add(R, t0 + 0.012, p, 0.30)
    add(L, t0, bass(root, BEAT * 2 + 0.25), 0.18); add(R, t0, bass(root, BEAT * 2 + 0.25), 0.18)
    add(L, t0 + BEAT * 2, bass(root + (7 if b % 2 else 0), BEAT * 2 + 0.25), 0.15); add(R, t0 + BEAT * 2, bass(root + (7 if b % 2 else 0), BEAT * 2 + 0.25), 0.15)
    if b >= 2:  # 처음 두 마디는 패드만
        for k in range(8):
            if sec == 0 and k % 2: continue
            m = chord[ARP[k]] + 12
            s = epiano(m); pan = 0.35 if k % 2 else -0.35; g = 0.16 * (0.85 + 0.15 * rng.random())
            add(L, t0 + k * BEAT / 2, s, g * (1 - pan)); add(R, t0 + k * BEAT / 2, s, g * (1 + pan))
    if b >= 4 and sec > 0:
        for k in (0, 2):
            add(L, t0 + k * BEAT, kick(), 0.30); add(R, t0 + k * BEAT, kick(), 0.30)
        for k in range(8):
            if k % 2 or sec == 2:
                sh = shaker(); gg = 0.05 if k % 2 else 0.03
                add(L, t0 + k * BEAT / 2, sh, gg * 0.8); add(R, t0 + k * BEAT / 2, sh, gg * 1.2)

# 리버브: 감쇠 노이즈 임펄스 응답을 FFT로 컨볼루션
ir_n = int(1.8 * SR)
ir = (rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2)).astype(np.float32); ir[0] = 0
ir /= np.sqrt((ir ** 2).sum()) * 6


def reverb(x):
    n = len(x) + ir_n; nf = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[: len(x)]
    return x + y.astype(np.float32)


L, R = reverb(L), reverb(R)
st = np.stack([L, R], 1)[: int(dur * SR)]
st /= np.abs(st).max() / 0.8
fade = int(3 * SR); st[-fade:] *= np.linspace(1, 0, fade)[:, None]; st[: int(0.5 * SR)] *= np.linspace(0, 1, int(0.5 * SR))[:, None]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
print('bgm', out, round(dur, 1))
