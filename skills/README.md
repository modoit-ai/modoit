# 비비 SNS 글·카드뉴스 스킬

블로그·기사·강의 자료를 인스타그램과 스레드용 문안 및 1080×1350 카드뉴스 PNG로 만드는 Codex 스킬입니다.

## 설치

Codex에 다음과 같이 요청하세요.

```text
$skill-installer를 사용해서 https://github.com/modoit-ai/modoit/tree/main/skills/modooit-social-cardnews 의 스킬을 설치해줘.
```

설치 후 스킬이 보이지 않으면 새 대화에서 확인하세요. 수동 설치는 `modooit-social-cardnews` 폴더를 macOS/Linux의 `~/.codex/skills/`, Windows의 `%USERPROFILE%\.codex\skills\`에 복사합니다.

## 사용 예

```text
$modooit-social-cardnews를 사용해 이 블로그를 인스타그램·스레드용 글과 카드뉴스 PNG로 만들어줘. 우선 제작까지만 해줘.
[블로그 URL]
```

```text
이 블로그 글을 스레드용으로 바꿔줘. 본인 명의로 담백한 존댓말을 사용하고, 과장은 빼줘.
[블로그 URL]
```

```text
이 기사로 와인 스타일 카드뉴스 5장을 만들어서 지정한 인스타그램과 스레드 계정에 올려줘.
[기사 URL과 계정]
```

## 포함 내용

- 비비의 정확한 첫 인사, 본문·원문·문의·커뮤니티·마무리 형식
- 개인·타 브랜드에 적용할 수 있는 프로필 설정
- Instagram·Threads별 분량·링크 안내·문체와 최신 작성창 제한 검증
- 모두잇 보라 / 기사 와인 / 크림 종이 카드뉴스 기준
- 실제 PNG 렌더러, 예제 원고, 글자 겹침·영역 초과 자동 검사
- 지정 채널 게시·예약·공개 URL 확인 및 중복 방지

[스킬 본문](modooit-social-cardnews/SKILL.md) · [문안 예시](modooit-social-cardnews/references/captions.md) · [프로필 설정](modooit-social-cardnews/references/profile.md) · [제작·실행 안내](modooit-social-cardnews/references/cardnews.md)

## 렌더러 실행

스킬 폴더에서 Node.js 20 이상을 사용합니다.

```sh
npm install
npx playwright install chromium
node scripts/render.mjs examples/spec.json ./rendered
```

글꼴과 이미지 생성·브라우저 제어 기능은 사용 환경에 따라 다릅니다. 다른 스킬의 설치나 제작자의 로컬 경로는 필요하지 않습니다. 카드 배경 이미지는 직접 제공하거나 사용 가능한 이미지 도구로 별도 제작합니다. 계정 연결과 로그인은 별도로 필요하며, 제작 요청만으로 공개 게시하지 않습니다.

## 검증

v1.0.0: 세 디자인의 샘플 9장(각 1080×1350), 사진 첨부 출력, 긴 제목의 영역 초과 감지를 로컬에서 확인했습니다. 모든 샘플을 축소 미리보기로 확인했습니다. 실제 SNS 게시 시험은 포함하지 않았습니다. YAML은 Ruby 파서로 검증했으며 기본 Python 검증기는 PyYAML 미설치로 실행되지 않았습니다.
