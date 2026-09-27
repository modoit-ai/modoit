# 프롬프트 활용법 영상 — 작업 현황

`modooit-promo-video` 스킬(modoit-ai/modooit-skills) 기준으로 제작했습니다.

## 완성본

| 버전 | 내용 | 길이 |
|---|---|---|
| v2 (현재) | 스킬 방식으로 다시 편집: 어두운 배경(#1b1426)·라임 강조 모션그래픽, 실제 쉼 위치 기준 한 줄 자막, 내레이션 압축·-10 LUFS 정규화, 강사 가슴 위 확대 + 라임 테두리, 끝인사 "미래 교육은 모두잇과 함께 해주세요." 추가 | 9분 47초 |
| v1 | 밝은 배경 슬라이드 + 강사 화면 오른쪽 배치 (스킬 적용 전) | 10분 3초 |

- 자막: `프롬프트활용법_자막_v2.srt`
- 대본: `prompt-guide-script.md`

## 제작 소스

- `production/segments.py` — 장면 50개(내레이션·화면 구성)
- `production/v2/yt.html`, `render_frames.js` — HTML 모션그래픽 → 30fps 프레임 → 무음 화면
- `production/v2/yt_audio.py` — 내레이션 정리(clean)·타이밍·한 줄 자막·믹스·강사 립싱크 합성
- `production/v2/timing.js`, `segments.js` — 이번 렌더에 쓴 타이밍·장면 데이터

## 사용한 것

- 목소리: Higgsfield「보스 목소리 (박옥경)」 seed_audio (speech_rate 4, loudness 3)
- 강사 영상: 교실 배경 사진 + Wan 2.7 1080p 립싱크 9개 (각 구간 내레이션과 싱크 확인)
- 크레딧: 약 250 사용 (립싱크 영상이 대부분), v2 재편집은 끝인사 내레이션 1개만 추가 생성
- 완성본 v2: https://d2ol7oe51mr4n9.cloudfront.net/user_2vaNPiaZNQkNSSDKQlPKZICOTLh/173653da-4e3d-4ae1-8885-79ccd2b68f76.mp4 (약 -11 LUFS, 트루 피크 -1.8 dBFS)

## 남은 일 / 확인 필요

- **배경음악 없음**: 스킬은 ChatCut 음악(또는 `홍보영상/배경음악/워크숍홍보_BGM_원본_166초.mp3`)을 쓰지만, 클라우드 작업 환경에서는 ChatCut 앱과 보스 컴퓨터 파일에 접근할 수 없음. 컴퓨터의 Claude Code에서 BGM만 얹거나, 파일을 올려 주시면 합성 가능.
- 강사 얼굴·입 모양, "AI·챗·에이전트" 발음은 보스 청취 확인 필요.
- 인사말은 보스 지시대로 "모두잇 박옥경 수정쌤입니다" 사용 (스킬 기본값 "모두잇 대표 강사 박옥경입니다"와 다름).
- 업로드·게시는 하지 않음.
