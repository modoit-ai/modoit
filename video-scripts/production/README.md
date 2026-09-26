# 프롬프트 활용법 영상 제작 파일

`../prompt-guide-script.md` 대본을 실제 영상(약 10분, 1920×1080)으로 만들 때 쓴 파일이에요.

1. `segments.py` → 장면 50개(내레이션 + 화면 구성)를 `segments.json`으로 저장
2. Higgsfield `seed_audio` + "보스 목소리 (박옥경)"으로 장면별 내레이션 생성 (speech_rate 4, loudness 3, expression 5)
3. 강사 컷 9개(`kind: talk`)는 교실 배경 강사 이미지 + 내레이션으로 `wan2_7` 립싱크 영상 생성 (1:1, 1080p)
4. `render.js` → 슬라이드·자막 PNG 렌더링 (Pretendard 글꼴 필요, Playwright)
5. `build.py` → 슬라이드 + 자막 + 내레이션 + 강사 영상을 ffmpeg로 합쳐 최종 mp4 생성

문구를 바꾸려면 `segments.py`만 고친 뒤 바뀐 장면의 내레이션만 다시 만들고 2~5단계를 반복하면 돼요.
