---
name: card-news
description: 인스타그램용 카드뉴스(캐러셀, 1080x1350 4:5)를 크림 페이퍼 + 테라코타 스타일로 기획·작성하고 PNG 이미지로 만들어 주는 스킬. 사용자가 "카드뉴스 만들어줘", "인스타 캐러셀", "홍보 카드뉴스", "강의·워크숍 홍보 이미지", "SNS 게시물 이미지"를 요청하거나, 영상·유튜브·강의 자료·기사·공지를 카드뉴스로 바꿔 달라고 할 때 사용한다. 모두잇미래교육진흥협회(@modoit) 기본값.
---

# 카드뉴스 만들기

주제나 원문을 받아 **① 원문 파악 → ② 기획 → ③ 원고(JSON) → ④ 렌더링 → ⑤ 검수 → ⑥ 전달** 순서로 만든다.

## 디자인 스타일 (확정)

- 크림 종이 배경(#F3EEE6, 종이 질감) + 테라코타 포인트(#C96F4A) + 진한 갈색 글자
- 위: `@계정` → 태그 알약 → 아주 굵은 제목(`==강조==`는 테라코타, 표지는 붓 밑줄) → 회색 부제
- 가운데: 큰 목업 판(visual) + 마스킹테이프·흩어진 점
- 아래: Claude 픽셀 캐릭터 + 말풍선 + "밀어서 보기 →" 버튼, 맨 아래 진행 표시줄(캐릭터가 현재 장 위치로 이동, 끝에 깃발)
- 손글씨(Nanum Pen Script)로 메모·도장·화살표를 넣어 사람 손맛을 낸다
- 테마 2종: `paper`(기본, 크림 + 테라코타 + Claude 캐릭터) · `codex`(흰 배경 + 청보라 + 코덱스 구름 캐릭터 `assets/mascots/codex.png`). Claude 활용 콘텐츠는 `paper`, 코덱스·ChatGPT 활용 콘텐츠는 `codex`를 쓴다. 같은 원고에 `"theme"`만 바꾸면 한 벌 더 나온다.
- 폰트는 `assets/fonts`에 내장(Noto Sans KR·Nanum Pen Script·Nunito). 인터넷 없이도 같은 결과가 나온다.

## 1. 원문 파악

- **영상(mp4)**: `pip install imageio-ffmpeg`로 ffmpeg를 받아 1초 간격 프레임을 타일로 뽑아 Read로 본다.
  `ffmpeg -i in.mp4 -vf "fps=1,scale=360:640,tile=5x2" -frames:v 3 sheet%d.png`
  세부 문구(가격·날짜·이름)는 해당 시점을 원본 해상도로 다시 캡처해 정확히 옮긴다. 인물 사진이 필요하면 프레임에서 잘라 쓴다.
- **링크(인스타·유튜브)**: 이 환경에서 막혀 있을 수 있다. 막히면 캡처·영상 파일·스크립트를 요청한다. **본 적 없는 내용을 지어내지 않는다.**
- 날짜·가격·인원·기관명 같은 사실은 원문 그대로 쓴다.

## 2. 기획

기본 6~8장. 흐름은 **훅 → 공감(문제) → 해결 → 확장 → 근거(강사·후기) → 행동(신청)**.

| 순서 | 추천 visual | 예 |
|---|---|---|
| 표지 | `board` | 핵심 3~5개를 카드로 한눈에 |
| 공감 | `window` | "오늘도 처음부터 쓰고 계신가요?" |
| 해결 | `flow` | 나의 글 → AI → 다음 글 |
| 확장 | `tree` | 블로그 → 스레드·인스타 |
| 커리큘럼·순서 | `schedule` | 1·2·3회차, 1·2·3단계 |
| 신뢰 | `profile` | 강사 사진·이력·출강 기관 |
| 마무리 | `offer` | 인원·일정·가격·신청 버튼 |

## 3. 원고 작성 규칙

- **한 장에 메시지 하나.** 제목은 2줄, 한 줄 14자 안팎. 줄바꿈은 `\n`으로 직접 지정.
- 말투는 다정한 존댓말. 어려운 말은 쉽게.
- 말풍선(`bubble`)은 10자 안팎의 짧은 한마디.
- 손글씨 메모(`hand`, `note`, `sticky`)는 8자 안팎.
- 강조 `==…==`는 제목에 한 곳만.

## 4. 원고 JSON

`examples/kiosk-tips.json`을 참고한다. 작업 폴더(스크래치패드 등)에 `spec.json`으로 저장하고, 사진 경로는 spec.json 기준 상대경로로 적는다.

```json
{
  "title": "게시물 제목",
  "brand": { "handle": "@modoit" },
  "theme": "paper",
  "mascot": "claude",
  "swipe": "밀어서 보기",
  "colors": { "accent": "#C96F4A" },
  "slides": [
    {
      "tags": ["태그1", "태그2"],
      "kicker": "첫 번째",
      "align": "center",
      "title": "제목\n==강조==",
      "subtitle": "부제",
      "visual": { "type": "board", ... },
      "bubble": "말풍선",
      "cta": "버튼 문구(마지막 장은 이 값이 있을 때만 버튼 표시)"
    }
  ]
}
```

- `theme`: `"paper"`(기본) · `"codex"`
- `mascot`: 테마 기본값을 따른다(paper → `"claude"`, codex → `"codex"`). `"none"`, `assets/mascots/` 안의 파일 이름(확장자 없이), 또는 이미지 경로로 바꿀 수 있다.
- `colors`: `bg, paper, card, line, ink, sub, mute, accent, accentSoft, accentInk, mascot, tape`
- 표지(1번 장)는 제목에 붓 밑줄이 자동으로 들어간다(`underline: false`로 끔).

### visual 종류

| type | 필드 |
|---|---|
| `board` | `label`, `metaPill`, `meta`, `items[{icon, badge, no, title, hand}]`(최대 5), `note`, `count{label, value, unit, marks[]}`, `path{start, stamp, end}` |
| `window` | `title`, `heading`, `lines[문자열 또는 {text, strike, fix}]`, `typing`, `sticky`, `bubbles[]`, `bubbleNote`, `tag` |
| `flow` | `from{label, tag}`, `via`, `to{label, tag}`, `caption`, `steps[]` |
| `tree` | `root{brand, label}`, `hub`, `leaves[{icon, label}]`(2~3개), `note` |
| `schedule` | `label`, `rows[{no, unit, date, title, hand}]`(최대 4), `chips[]` |
| `profile` | `photo`, `role`, `name`, `tags[]`, `stat{value, label}`, `logos[]` |
| `offer` | `badge`, `title`, `dates[{label, value}]`, `info`, `price{label, value}`, `button`, `note`, `stamp` |
| `image` | `src`, `caption` |

아이콘 이름: `touch bag cart card search pen chat doc code image check clock calendar video users star bulb phone thread insta blog`. 목록에 없는 값은 글자·이모지로 그대로 표시된다.

## 5. 렌더링

```bash
node .claude/skills/card-news/scripts/render.mjs <spec.json> [출력폴더]
```

- 결과: `index.html`(전체 미리보기) + `01.png`, `02.png` …
- Playwright(전역)와 `/opt/pw-browsers/chromium`을 자동으로 찾는다. 로컬 PC는 `npm i -g playwright && npx playwright install chromium`.
- 목업이 넘치면 자동 축소하고 `ⓘ n번 슬라이드 비주얼을 84%로 축소`처럼 알린다. **80% 미만이면 경고가 뜨니** 태그·부제를 빼거나 항목을 줄여 다시 렌더링한다. (board에 카드 6칸을 채우면 표지에 태그를 넣지 않는다.)
- `⚠ 폰트를 불러오지 못했습니다`가 뜨면 `assets/fonts` 경로를 확인한다.

## 6. 검수 (반드시)

PNG를 Read로 직접 열어 본다. 여러 장은 ffmpeg `tile`로 한 장에 모아 한 번에 확인하면 빠르다.
- 글자 겹침·잘림, 어색한 줄바꿈, 같은 문구 중복
- 날짜·가격·이름·기관명이 원문과 같은가
- 강조가 한 장에 한 곳인가
- 폰트는 한글 상용 2,350자만 들어 있다. 드문 글자(예: 똠, 쌰)는 다른 글꼴로 보일 수 있으니 확인한다.

## 7. 전달

- PNG를 사용자에게 보낸다(SendUserFile). 인스타그램에는 01부터 순서대로 올린다.
- **게시물 캡션**도 함께 준다: 첫 줄 훅 → 핵심 3줄 → 일정·신청 안내 → 해시태그 10~15개.
- Claude·코덱스 캐릭터는 각 회사(Anthropic, OpenAI)를 떠올리게 하는 캐릭터다. AI 활용 교육 콘텐츠에는 자연스럽지만, 협회 대표 캐릭터처럼 쓰지 않도록 필요하면 `mascot`을 바꾼다.
