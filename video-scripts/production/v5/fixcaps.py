"""자막 한 줄 안에 문장 끝(. ? !)이 끼어 있으면 문장 단위로 나눈다(시간은 글자 수 비율)."""
import json, re, sys
T = json.load(open(sys.argv[1])); out = []
for a, b, x in T['caps']:
    parts = [p for p in re.split(r'(?<=[.?!])\s+', x) if p]
    if len(parts) > 1 and all(len(p) >= 5 for p in parts):
        tl = sum(len(p) for p in parts); t = a
        for k, p in enumerate(parts):
            t1 = b if k == len(parts) - 1 else round(t + (b - a) * len(p) / tl, 3)
            out.append([round(t, 3), t1, p]); t = t1
    else:
        out.append([a, b, x])
T['caps'] = out
open(sys.argv[2], 'w').write('window.TL_DATA=' + json.dumps(T, ensure_ascii=False) + ';')
def ts(v):
    h = int(v // 3600); m = int(v % 3600 // 60); s = v % 60
    return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
with open(sys.argv[3], 'w') as f:
    for i, (a, b, x) in enumerate(out, 1): f.write(f'{i}\n{ts(a)} --> {ts(b)}\n{x}\n\n')
print(len(out), 'caps, max len', max(len(c[2]) for c in out))
