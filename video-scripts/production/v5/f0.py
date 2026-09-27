"""녹음을 문장(0.45초 이상 쉼) 단위로 나눠 음높이(F0) 통계: 문장 내 변동폭, 끝 억양(마지막 0.4초 vs 문장 중앙값)."""
import sys, numpy as np, parselmouth
def analyze(path, floor=75, ceil=500, gap=0.45, label=None):
    snd = parselmouth.Sound(path).convert_to_mono()
    it = snd.to_intensity(time_step=0.01); I = it.values[0]; tI = it.xs()
    thr = np.percentile(I, 95) - 25
    on = I > thr; segs = []; s = None; last = None
    for t, v in zip(tI, on):
        if v:
            if s is None: s = t
            last = t
        elif s is not None and t - last > gap:
            if last - s > 0.8: segs.append((s, last))
            s = None
    if s is not None and last - s > 0.8: segs.append((s, last))
    p = snd.to_pitch_ac(time_step=0.01, pitch_floor=floor, pitch_ceiling=ceil)
    f = p.selected_array['frequency']; tp = p.xs()
    rows = []
    for a, b in segs:
        m = (tp >= a) & (tp <= b) & (f > 0)
        if m.sum() < 20: continue
        st = 12 * np.log2(f[m] / np.median(f[m])); tt = tp[m]
        rng = np.percentile(st, 95) - np.percentile(st, 5)
        endm = tt >= tt[-1] - 0.4
        end = np.median(st[endm]) if endm.sum() > 3 else np.nan
        rows.append((a, b, np.median(f[m]), rng, st.std(), end))
    return rows
if __name__ == '__main__':
    for path in sys.argv[1:]:
        r = analyze(path)
        print(f'== {path}')
        for a, b, med, rng, sd, end in r:
            print(f'  {a:6.1f}-{b:6.1f}s  중앙 {med:5.0f}Hz  폭 {rng:4.1f}st  sd {sd:3.1f}  끝 {end:+5.1f}st')
        R = np.array([x[3:] for x in r])
        print(f'  [요약] 문장 {len(r)}  평균폭 {np.nanmean(R[:,0]):.1f}st  평균sd {np.nanmean(R[:,1]):.2f}  끝올라감(>+1st) {int((R[:,2]>1).sum())}개  끝평균 {np.nanmean(R[:,2]):+.1f}st  중앙 {np.median([x[2] for x in r]):.0f}Hz')
