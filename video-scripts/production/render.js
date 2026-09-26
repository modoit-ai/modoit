// Renders slide PNGs + subtitle overlay PNGs for every segment.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, 'slides');
fs.mkdirSync(OUT, { recursive: true });
const S = JSON.parse(fs.readFileSync(path.join(DIR, 'segments.json'), 'utf8'));
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, '../../images/logo.png')).toString('base64');
const COLORS = ['#7C3AED', '#2563EB', '#DB2777', '#059669'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1920px;height:1080px;font-family:Pretendard,'Noto Color Emoji',sans-serif;color:#1F1638;
 background:radial-gradient(circle at 85% 10%,#EDE9FE 0,transparent 45%),radial-gradient(circle at 10% 95%,#FCE7F3 0,transparent 40%),#FBFAFF;overflow:hidden;position:relative}
.top{position:absolute;top:44px;left:64px;display:flex;align-items:center;gap:18px;font-size:30px;font-weight:700;color:#6D28D9}
.top img{width:60px;height:60px;border-radius:14px}
.chap{background:#EDE9FE;border-radius:999px;padding:8px 26px;font-size:28px;color:#5B21B6}
.stage{position:absolute;left:0;right:0;top:130px;bottom:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 120px;text-align:center}
h1{font-size:92px;font-weight:800;line-height:1.25;letter-spacing:-2px}
h1 .g,.g{background:linear-gradient(135deg,#7C3AED,#D946EF);-webkit-background-clip:text;color:transparent}
h2{font-size:60px;font-weight:800;margin-bottom:44px;letter-spacing:-1px}
.sub{font-size:48px;font-weight:600;color:#6B5B95;margin-top:36px}
.split{display:flex;gap:56px;width:100%}
.box{flex:1;border-radius:36px;padding:44px 48px;text-align:left;background:#fff;box-shadow:0 12px 40px rgba(76,29,149,.12)}
.box .tag{font-size:40px;font-weight:800;margin-bottom:22px}
.box .q{font-size:40px;font-weight:700;line-height:1.45;background:#F4F1FF;border-radius:22px;padding:24px 30px}
.box .a{font-size:36px;line-height:1.5;margin-top:26px;color:#4B3F6B}
.bad{border:6px solid #F87171}.bad .tag{color:#DC2626}
.good{border:6px solid #34D399}.good .tag{color:#059669}
.list{display:flex;flex-direction:column;gap:30px;align-items:stretch;width:1250px}
.li{background:#fff;border-radius:30px;padding:32px 50px;font-size:54px;font-weight:700;text-align:left;box-shadow:0 10px 32px rgba(76,29,149,.1);border-left:14px solid #7C3AED}
.four{display:flex;gap:40px}
.ing{width:330px;height:330px;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 14px 40px rgba(0,0,0,.15)}
.ing b{font-size:58px}.ing span{font-size:88px;font-weight:800;margin-top:10px}
.card{display:flex;flex-direction:column;align-items:center}
.num{width:150px;height:150px;border-radius:50%;color:#fff;font-size:84px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-bottom:30px}
.card h1{font-size:110px}
.ex{margin-top:44px;font-size:56px;font-weight:700;line-height:1.45;background:#fff;border-radius:34px;padding:36px 64px;box-shadow:0 12px 40px rgba(76,29,149,.12)}
.chat{display:flex;flex-direction:column;gap:30px;width:1300px}
.b{max-width:1000px;font-size:50px;font-weight:700;line-height:1.4;padding:30px 44px;border-radius:40px;text-align:left}
.bu{align-self:flex-end;background:#7C3AED;color:#fff;border-bottom-right-radius:10px}
.ba{align-self:flex-start;background:#fff;box-shadow:0 10px 30px rgba(76,29,149,.12);border-bottom-left-radius:10px}
.prompt{width:1480px;background:#fff;border-radius:36px;padding:48px 60px;text-align:left;font-size:48px;font-weight:600;line-height:1.6;box-shadow:0 14px 44px rgba(76,29,149,.14);border-top:16px solid #7C3AED}
.steps{display:flex;align-items:center;gap:30px}
.st{background:#fff;border-radius:36px;padding:44px 50px;font-size:64px;font-weight:800;box-shadow:0 12px 36px rgba(76,29,149,.12)}
.arr{font-size:70px;color:#A78BFA;font-weight:800}
table{border-collapse:separate;border-spacing:0;width:1600px;font-size:38px;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 12px 40px rgba(76,29,149,.12)}
td,th{padding:20px 30px;text-align:left;border-bottom:2px solid #EDE9FE;line-height:1.35}
th{font-size:46px;background:#7C3AED;color:#fff}
td:first-child{font-weight:800;color:#6D28D9;width:300px;background:#FAF8FF}
.job{font-size:56px;font-weight:800;margin-bottom:34px;background:#fff;border-radius:999px;padding:14px 50px;box-shadow:0 8px 24px rgba(76,29,149,.12);color:#5B21B6}
.jobsplit .box.bad{flex:0 0 520px}.jobsplit .q{font-size:40px}
.jobsplit .good .q{font-size:35px;line-height:1.55;background:#ECFDF5}
.check{display:flex;align-items:center;gap:50px;text-align:left}
.ck{font-size:160px}
.check h1{font-size:96px}.check .sub{margin-top:24px}
.talkL{position:absolute;left:0;top:0;width:840px;height:1080px;background:linear-gradient(160deg,#6D28D9,#7C3AED 45%,#C026D3);color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 70px}
.talkL img{width:92px;height:92px;border-radius:20px;margin-bottom:40px;background:#fff}
.talkL .cap{font-size:70px;font-weight:800;line-height:1.3;letter-spacing:-1px}
.talkL .name{font-size:34px;font-weight:600;opacity:.85;margin-top:36px}
.end{background:linear-gradient(160deg,#4C1D95,#7C3AED 50%,#C026D3)!important;color:#fff}
.end .sub{color:#EDE9FE}
`;

function body(s) {
  const v = s.vis;
  const top = (v.chapter || s.kind === 'gfx') && v.t !== 'end'
    ? `<div class="top"><img src="${LOGO}">모두잇 AI 교실${v.chapter ? `<span class="chap">${esc(v.chapter)}</span>` : ''}</div>` : '';
  let st = '';
  switch (v.t) {
    case 'title':
      st = `<h1>${esc(v.title)}</h1>${v.sub ? `<div class="sub">${esc(v.sub)}</div>` : ''}`; break;
    case 'split':
    case 'vs':
      if (v.t === 'split') st = `<h2>${esc(v.title)}</h2><div class="split">
        <div class="box bad"><div class="tag">❌ 이렇게 부탁하면</div><div class="q">${esc(v.L[0])}</div><div class="a">${esc(v.L[1])}</div></div>
        <div class="box good"><div class="tag">⭕ 한 문장 더하면</div><div class="q">${esc(v.R[0])}</div><div class="a">${esc(v.R[1])}</div></div></div>`;
      else st = `<h2>${esc(v.title)}</h2><div class="split">
        <div class="box" style="text-align:center;border:6px solid #A78BFA"><div style="font-size:96px;font-weight:800">${esc(v.L[0])}</div><div class="sub">${esc(v.L[1])}</div></div>
        <div class="box" style="text-align:center;border:6px solid #D946EF"><div style="font-size:96px;font-weight:800">${esc(v.R[0])}</div><div class="sub">${esc(v.R[1])}</div></div></div>`;
      break;
    case 'list':
      st = `<h2>${esc(v.title)}</h2><div class="list">${v.items.map((x) => `<div class="li">${esc(x)}</div>`).join('')}</div>`; break;
    case 'four':
      st = `<h2>${esc(v.title)}</h2><div class="four">${['역할', '상황', '요청', '형식'].map((x, i) => `<div class="ing" style="background:${COLORS[i]}"><b>${'①②③④'[i]}</b><span>${x}</span></div>`).join('')}</div>`; break;
    case 'card':
      st = `<div class="card"><div class="num" style="background:${COLORS[v.c]}">${v.n}</div><h1>${esc(v.title)}</h1><div class="ex">${esc(v.ex)}</div></div>`; break;
    case 'chat':
      st = `<h2>${esc(v.title)}</h2><div class="chat"><div class="b bu">${esc(v.user)}</div><div class="b ba">${esc(v.ai)}</div>${v.user2 ? `<div class="b bu">${esc(v.user2)}</div>` : ''}</div>`; break;
    case 'prompt':
      st = `<h2>✍️ ${esc(v.title)}</h2><div class="prompt">${esc(v.body)}</div>`; break;
    case 'steps':
      st = `<h2>${esc(v.title)}</h2><div class="steps">${v.items.map((x) => `<div class="st">${esc(x)}</div>`).join('<div class="arr">→</div>')}</div>`; break;
    case 'table':
      st = `<h2>부탁하는 방법이 달라요</h2><table><tr><th></th><th>💬 챗</th><th>🤖 에이전트</th></tr>
        <tr><td>한마디로</td><td>물어보면 알려주는 상담 선생님</td><td>일을 맡기면 해내는 비서</td></tr>
        <tr><td>결과</td><td>답변(글)</td><td>파일 · 표 · 검색 정리 · 예약</td></tr>
        <tr><td>부탁 핵심</td><td>구체적인 질문 + 원하는 형식</td><td>목표 + 완성 모습 + 범위 + 확인 시점</td></tr>
        <tr><td>잘 쓰는 법</td><td>주고받으며 다듬기</td><td>처음에 꼼꼼하게 지시하기</td></tr>
        <tr><td>조심할 점</td><td>답이 틀릴 수 있으니 확인</td><td>결제·전송·삭제 전 "먼저 물어봐"</td></tr></table>`; break;
    case 'job':
      st = `<div class="job">${esc(v.job)}</div><div class="split jobsplit">
        <div class="box bad"><div class="tag">❌ 잘못된 예시</div><div class="q">${esc(v.bad)}</div></div>
        <div class="box good"><div class="tag">⭕ 잘된 예시</div><div class="q">${esc(v.good)}</div></div></div>`; break;
    case 'check': {
      const C = [['한 번에 완벽할 필요 없어요', '대화로 다듬으면 돼요'], ['AI도 틀릴 수 있어요', '병원 · 돈 · 법은 꼭 한 번 더 확인'], ['개인정보는 넣지 마세요', '주민번호 · 통장 비밀번호 · 가족 연락처 🔒']][v.k];
      st = `<h2 style="color:#6D28D9">꼭 기억할 3가지 · ${v.k + 1}</h2><div class="check"><div class="ck">✅</div><div><h1>${C[0]}</h1><div class="sub">${C[1]}</div></div></div>`; break;
    }
    case 'end':
      st = `<img src="${LOGO}" style="width:170px;height:170px;border-radius:36px;margin-bottom:40px;background:#fff"><h1>모두잇 클래스 → 프롬프트 모음</h1><div class="sub">오늘 예시, 바로 복사해서 써 보세요 · 감사합니다</div>`; break;
    case 'talk':
      return `<div class="talkL"><img src="${LOGO}"><div class="cap">${esc(v.cap)}</div>${v.cap.includes('수정쌤')?'':'<div class="name">모두잇 박옥경 수정쌤</div>'}</div>`;
  }
  return `${top}<div class="stage">${st}</div>`;
}

// split narration into subtitle chunks (<= ~34 chars, broken at punctuation)
function chunks(text) {
  const parts = text.match(/[^.?!,]+[.?!,]*\s*/g).map((x) => x.trim()).filter(Boolean);
  const out = []; let cur = '';
  for (const p of parts) {
    if (cur && (cur + ' ' + p).length > 34) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p;
  }
  if (cur) out.push(cur);
  // hard-wrap very long chunks
  return out.flatMap((c) => { if (c.length <= 42) return [c]; const w = c.split(' '); const a = []; let t = ''; for (const x of w) { if (t && (t + ' ' + x).length > 34) { a.push(t); t = x; } else t = t ? t + ' ' + x : x; } if (t) a.push(t); return a; });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const subs = {};
  const only = process.argv[2];
  for (const s of S) {
    if (only && !only.split(',').includes(s.id)) continue;
    const cls = s.vis.t === 'end' ? ' class="end"' : '';
    await pg.setContent(`<html><head><style>${CSS}</style></head><body${cls}>${body(s)}</body></html>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(OUT, `slide_${s.id}.png`) });
    const cs = chunks(s.text); subs[s.id] = cs;
    for (let k = 0; k < cs.length; k++) {
      await pg.setContent(`<html><head><style>*{margin:0}body{width:1920px;height:1080px;background:transparent;font-family:Pretendard,'Noto Color Emoji';display:flex;align-items:flex-end;justify-content:center}
        div{margin-bottom:48px;max-width:1700px;background:rgba(20,12,40,.82);color:#fff;font-size:54px;font-weight:700;line-height:1.35;padding:18px 44px;border-radius:22px;text-align:center}</style></head>
        <body><div>${esc(cs[k])}</div></body></html>`);
      await pg.evaluate(() => document.fonts.ready);
      await pg.screenshot({ path: path.join(OUT, `sub_${s.id}_${k}.png`), omitBackground: true });
    }
  }
  if (!only) fs.writeFileSync(path.join(OUT, 'subs.json'), JSON.stringify(subs, null, 1));
  await b.close();
})();
