"""urls_v5.txt(장면id → 새 목소리 wav) + segments_v3.json → manifest_v5.json"""
import json, sys
B = "https://d8j0ntlcm91z4.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/"
S = json.load(open('segments_v3.json'))
U = dict(l.split() for l in open('urls_v5.txt') if l.strip())
PX = {'01d': 385, '04a': 455, '04g': 376, '06a': 385, '07e': 489, '07f': 334, '09c': 437, '09d': 385, '09b': 420}  # measure.js 결과(강사+글자 묶음 가운데)
segs = []
for s in S:
    if s['id'] not in U: continue
    d = {"id": s["id"], "kind": s["kind"], "vt": s["vt"], "text": s["text"], "audio": B + U[s['id']]}
    if s['kind'] == 'talk': d['px'] = PX[s['id']]
    segs.append(d)
out = sys.argv[1] if len(sys.argv) > 1 else 'manifest_v5.json'
json.dump({"segments": segs}, open(out, 'w'), ensure_ascii=False)
print(out, len(segs))
