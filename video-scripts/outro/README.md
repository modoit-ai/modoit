# 모두잇 공통 아웃트로 (모든 영상 끝에 사용)

약 20초짜리 모션그래픽 마무리 장면이에요. 영상 주제와 상관없이 그대로 붙여 쓰도록 만들었어요.

- **완성본 v7 (2026-09-30, 20.5초, 1920×1080, 보스 기존 목소리 + 워크숍 곡 1.3배, -11 LUFS)**: https://d2ol7oe51mr4n9.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/5e533492-152b-41ec-a477-e185c8938d2a.mp4
  - 로컬 저장 예: `curl -L -o ~/Movies/유튜브/공통소재/모두잇_공통엔딩_v7.mp4 'https://d2ol7oe51mr4n9.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/5e533492-152b-41ec-a477-e185c8938d2a.mp4'` (보스 맥의 유튜브 폴더 경로에 맞게)
  - 이전 버전(합성 배경음악): https://d2ol7oe51mr4n9.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/f89afb1c-0be7-4831-8128-35df0b972daf.mp4
- 편집 프로그램에서는 이 mp4를 영상 맨 뒤에 그대로 이어 붙이면 돼요.

## 구성

| 구간 | 화면 | 내레이션 (「보스 목소리 (박옥경)」, seed_audio speech 4 · loudness 3) |
|---|---|---|
| ① 약 0~7초 | "직접 써 보고 싶다면?" + 🔗 영상 설명란 링크 카드, ▼ 화살표가 설명란 쪽으로 튐 | 직접 사용해 보고 싶으시다면 영상 설명란의 링크를 확인해 주세요. |
| ② 약 7~13초 | [구독] → 손가락이 눌러 ✓구독중 → 👍좋아요 켜짐 → 🔔알림 설정 종 흔들림 ('구독·좋아요·알림' 단어가 들리는 순간에 맞춤) | 이번 영상도 도움이 되셨다면 구독과 좋아요 그리고 알림 설정 부탁드립니다. |
| ③ 약 13초~끝 | "미래 교육은 모두잇 수정쌤과 함께 해주세요" + 감사합니다 · 모두잇 AI 교실 | 미래 교육은 모두잇 수정쌤과 함께 해 주세요. 감사합니다. |

- 화면: 스킬 디자인 토큰 (배경 #1b1426, 라임 #b7f75b, Pretendard)
- 내레이션 음성 파일: https://d8j0ntlcm91z4.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/hf_20260927_032339_10a55134-b1bc-4b98-a928-be86d622d49e.wav

## 새 영상에 코드로 붙일 때

`../production/v4/` 방식으로 만들 경우, `segments.py` 마지막 장면에 아래를 넣으면 같은 아웃트로가 렌더돼요 (장면 종류 `outro`, `yt.html`에 구현).

```python
dict(id="10a", kind="gfx",
     text="직접 사용해 보고 싶으시다면 영상 설명란의 링크를 확인해 주세요. 이번 영상도 도움이 되셨다면 구독과 좋아요 그리고 알림 설정 부탁드립니다. 미래 교육은 모두잇 수정쌤과 함께 해 주세요. 감사합니다.",
     vis={"t": "outro"})
```
