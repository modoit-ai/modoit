#!/usr/bin/env node
// 카드뉴스 렌더러: JSON 원고 → HTML(미리보기) + 슬라이드별 PNG(1080x1350)
// 사용법: node render.mjs <spec.json> [출력폴더]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const specPath = process.argv[2];
if (!specPath) {
  console.error('사용법: node render.mjs <spec.json> [출력폴더]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.resolve(process.argv[3] || path.join(path.dirname(specPath), spec.slug || 'card-news'));
fs.mkdirSync(outDir, { recursive: true });

// ── 테마 ─────────────────────────────────────────────
const THEMES = {
  // 모두잇 브랜드 (홈페이지 style.css 색상)
  modoit: { bg: '#FFFFFF', soft: '#EDE9FE', ink: '#1E1A3A', sub: '#5B5775', accent: '#7C3AED', accent2: '#D946EF', coverBg: 'linear-gradient(160deg,#5B21B6 0%,#7C3AED 55%,#D946EF 100%)', coverInk: '#FFFFFF', hl: '#FDE68A' },
  warm:   { bg: '#FFF9F0', soft: '#FFEBD2', ink: '#2B1D10', sub: '#7A6450', accent: '#F97316', accent2: '#EF4444', coverBg: 'linear-gradient(160deg,#F97316 0%,#FB923C 60%,#FDBA74 100%)', coverInk: '#FFFFFF', hl: '#FEF08A' },
  mint:   { bg: '#F4FBF8', soft: '#D5F2E6', ink: '#0F2A22', sub: '#4E6B62', accent: '#059669', accent2: '#0EA5E9', coverBg: 'linear-gradient(160deg,#047857 0%,#10B981 60%,#6EE7B7 100%)', coverInk: '#FFFFFF', hl: '#FEF08A' },
  navy:   { bg: '#F5F7FB', soft: '#DDE5F5', ink: '#0F1B33', sub: '#55617A', accent: '#1D4ED8', accent2: '#0EA5E9', coverBg: 'linear-gradient(160deg,#0F1B33 0%,#1E3A8A 60%,#2563EB 100%)', coverInk: '#FFFFFF', hl: '#FDE047' },
  dark:   { bg: '#0C0A1D', soft: '#1E1A3A', ink: '#F5F3FF', sub: '#B4ADD6', accent: '#A78BFA', accent2: '#F0ABFC', coverBg: 'radial-gradient(circle at 80% 10%,#6D28D9 0%,#0C0A1D 60%)', coverInk: '#FFFFFF', hl: '#A78BFA' },
};
const t = { ...THEMES[spec.theme || 'modoit'], ...(spec.colors || {}) };
const brand = { name: '모두잇미래교육진흥협회', handle: '@modoit', ...(spec.brand || {}) };

// ── 유틸 ─────────────────────────────────────────────
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **강조** → 형광펜, ==색강조== → 포인트 색, 줄바꿈(\n) → <br>
const rich = (s = '') => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>')
  .replace(/==(.+?)==/g, '<em>$1</em>')
  .replace(/\n/g, '<br>');
const imgSrc = (p) => {
  if (!p) return '';
  if (/^(https?:|data:)/.test(p)) return p;
  const abs = path.resolve(path.dirname(specPath), p);
  const ext = path.extname(abs).slice(1).replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(abs).toString('base64')}`;
};
const logo = brand.logo ? `<img class="logo" src="${imgSrc(brand.logo)}">` : '';
const total = spec.slides.length;

const chrome = (i, s) => `
  <div class="top">${s.tag ? `<span class="tag">${esc(s.tag)}</span>` : `<span class="tag ghost">${esc(spec.series || brand.name)}</span>`}
    <span class="page">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></div>
  <div class="foot">${logo}<span>${esc(brand.handle)}</span>${i < total - 1 ? '<span class="swipe">넘겨보기 →</span>' : ''}</div>`;

// ── 레이아웃 ──────────────────────────────────────────
const L = {
  cover: (s) => `
    <section class="card cover" ${s.image ? `style="--img:url('${imgSrc(s.image)}')"` : ''}>
      ${s.image ? '<div class="cover-img"></div>' : '<div class="blob b1"></div><div class="blob b2"></div>'}
      <div class="cover-body">
        ${s.kicker ? `<div class="kicker">${rich(s.kicker)}</div>` : ''}
        <h1>${rich(s.title)}</h1>
        ${s.subtitle ? `<p class="subtitle">${rich(s.subtitle)}</p>` : ''}
      </div>
      <div class="cover-foot">${logo}<span>${esc(brand.name)}</span><span class="swipe">넘겨보기 →</span></div>
    </section>`,

  point: (s, i) => `
    <section class="card point">${chrome(i, s)}<div class="content">
      ${s.emoji ? `<div class="emoji">${s.emoji}</div>` : ''}
      <h2>${rich(s.title)}</h2>
      ${s.body ? `<p class="body">${rich(s.body)}</p>` : ''}
      ${s.image ? `<img class="inline-img" src="${imgSrc(s.image)}">` : ''}
    </div></section>`,

  list: (s, i) => `
    <section class="card list">${chrome(i, s)}<div class="content">
      <h2>${rich(s.title)}</h2>
      <ol>${s.items.map((it, n) => {
        const o = typeof it === 'string' ? { title: it } : it;
        return `<li><b class="num">${n + 1}</b><div><strong>${rich(o.title)}</strong>${o.desc ? `<p>${rich(o.desc)}</p>` : ''}</div></li>`;
      }).join('')}</ol>
    </div></section>`,

  steps: (s, i) => `
    <section class="card steps">${chrome(i, s)}<div class="content">
      <h2>${rich(s.title)}</h2>
      <div class="flow">${s.items.map((it, n) => {
        const o = typeof it === 'string' ? { title: it } : it;
        return `<div class="step"><span class="badge">STEP ${n + 1}</span><div><strong>${rich(o.title)}</strong>${o.desc ? `<p>${rich(o.desc)}</p>` : ''}</div></div>`;
      }).join('<div class="arrow">▼</div>')}</div>
    </div></section>`,

  compare: (s, i) => `
    <section class="card compare">${chrome(i, s)}<div class="content">
      <h2>${rich(s.title)}</h2>
      <div class="cols">${[s.left, s.right].map((c, k) => `
        <div class="col ${k ? 'good' : 'bad'}"><div class="col-h">${esc(c.label)}</div>
          <ul>${c.items.map((x) => `<li>${rich(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      ${s.body ? `<p class="body center">${rich(s.body)}</p>` : ''}
    </div></section>`,

  quote: (s, i) => `
    <section class="card quote">${chrome(i, s)}<div class="content">
      <div class="qmark">“</div>
      <blockquote>${rich(s.quote)}</blockquote>
      ${s.by ? `<cite>— ${esc(s.by)}</cite>` : ''}
    </div></section>`,

  stat: (s, i) => `
    <section class="card stat">${chrome(i, s)}<div class="content">
      ${s.title ? `<h2 class="small">${rich(s.title)}</h2>` : ''}
      <div class="big" style="font-size:${Math.min(240, Math.floor(1500 / Math.max(1, [...String(s.value) + (s.unit || '')].length)))}px">${esc(s.value)}<small>${esc(s.unit || '')}</small></div>
      ${s.body ? `<p class="body center">${rich(s.body)}</p>` : ''}
    </div>
      ${s.source ? `<p class="source">출처: ${esc(s.source)}</p>` : ''}
    </section>`,

  closing: (s, i) => `
    <section class="card closing">
      <div class="blob b1"></div><div class="blob b2"></div>
      <div class="cover-body center">
        ${logo ? `<img class="logo big" src="${imgSrc(brand.logo)}">` : ''}
        <h2>${rich(s.title)}</h2>
        ${s.body ? `<p class="subtitle">${rich(s.body)}</p>` : ''}
        ${s.cta ? `<div class="cta">${esc(s.cta)}</div>` : ''}
        <div class="actions"><span>♡ 좋아요</span><span>🔖 저장</span><span>↗ 공유</span></div>
      </div>
      <div class="cover-foot center"><span>${esc(brand.name)} · ${esc(brand.handle)}</span></div>
    </section>`,
};

// ── CSS ──────────────────────────────────────────────
const css = `
:root{--bg:${t.bg};--soft:${t.soft};--ink:${t.ink};--sub:${t.sub};--ac:${t.accent};--ac2:${t.accent2};--hl:${t.hl}}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#d9d6e3;font-family:'Noto Sans KR','Pretendard',sans-serif;display:flex;flex-direction:column;align-items:center;gap:40px;padding:40px 0;word-break:keep-all}
.card{width:1080px;height:1350px;background:var(--bg);color:var(--ink);position:relative;overflow:hidden;padding:150px 96px 150px;display:flex;flex-direction:column;justify-content:center}
.top{position:absolute;top:64px;left:96px;right:96px;display:flex;justify-content:space-between;align-items:center}
.tag{background:var(--ac);color:#fff;font-weight:700;font-size:28px;padding:10px 26px;border-radius:999px}
.tag.ghost{background:var(--soft);color:var(--ac)}
.page{font-size:26px;font-weight:700;color:var(--sub);letter-spacing:2px}
.foot{position:absolute;bottom:60px;left:96px;right:96px;display:flex;align-items:center;gap:14px;font-size:26px;color:var(--sub);font-weight:500}
.swipe{margin-left:auto;color:var(--ac);font-weight:700}
.logo{width:48px;height:48px;border-radius:12px;object-fit:contain}
.logo.big{width:120px;height:120px;border-radius:28px;margin-bottom:40px;background:#fff;padding:10px}
h1{font-size:96px;font-weight:900;line-height:1.22;letter-spacing:-3px}
h2{font-size:68px;font-weight:900;line-height:1.3;letter-spacing:-2px;margin-bottom:48px}
h2.small{font-size:48px;text-align:center}
mark{background:linear-gradient(transparent 58%,var(--hl) 58%);color:inherit;padding:0 4px}
em{font-style:normal;color:var(--ac)}
.body{font-size:40px;line-height:1.65;color:var(--sub);font-weight:500}
.center{text-align:center}
/* cover / closing */
.cover,.closing{background:${t.coverBg};color:${t.coverInk};justify-content:flex-end;padding-bottom:220px}
.cover em,.closing em{color:var(--hl)}
.cover mark,.closing mark{background:linear-gradient(transparent 58%,rgba(255,255,255,.35) 58%)}
.cover-img{position:absolute;inset:0;background:var(--img) center/cover}
.cover-img::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 20%,rgba(0,0,0,.78) 100%)}
.cover-body{position:relative;z-index:1}
.kicker{display:inline-block;font-size:34px;font-weight:700;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.5);padding:12px 30px;border-radius:999px;margin-bottom:40px}
.subtitle{font-size:40px;line-height:1.55;margin-top:40px;opacity:.92;font-weight:500}
.cover-foot{position:absolute;bottom:72px;left:96px;right:96px;display:flex;align-items:center;gap:16px;font-size:30px;font-weight:700;z-index:1}
.cover-foot.center{justify-content:center}
.cover-foot .swipe{color:inherit;opacity:.85}
.blob{position:absolute;border-radius:50%;filter:blur(10px);opacity:.35;background:#fff}
.b1{width:520px;height:520px;top:-140px;right:-160px;opacity:.18}
.b2{width:300px;height:300px;top:300px;left:-120px;opacity:.12}
.closing{justify-content:center;text-align:center;padding-bottom:150px}
.closing h2{font-size:72px}
.cta{display:inline-block;margin-top:56px;background:#fff;color:var(--ac);font-size:40px;font-weight:900;padding:28px 60px;border-radius:999px;box-shadow:0 12px 30px rgba(0,0,0,.18)}
.actions{display:flex;justify-content:center;gap:48px;margin-top:64px;font-size:32px;font-weight:700;opacity:.9}
/* point */
.emoji{font-size:140px;margin-bottom:40px}
.inline-img{margin-top:48px;width:100%;max-height:520px;object-fit:cover;border-radius:32px}
/* list */
.list ol{list-style:none;display:flex;flex-direction:column;gap:30px}
.list li{display:flex;gap:32px;align-items:flex-start;background:var(--soft);border-radius:32px;padding:34px 40px}
.num{flex:none;width:72px;height:72px;border-radius:50%;background:var(--ac);color:#fff;font-size:38px;display:flex;align-items:center;justify-content:center}
.list strong,.steps strong{font-size:42px;font-weight:900;line-height:1.35;display:block}
.list p,.steps p{font-size:32px;line-height:1.5;color:var(--sub);margin-top:8px;font-weight:500}
/* steps */
.flow{display:flex;flex-direction:column;gap:14px}
.step{display:flex;gap:28px;align-items:center;border:4px solid var(--soft);border-radius:32px;padding:30px 36px;background:var(--bg)}
.badge{flex:none;background:var(--ac);color:#fff;font-weight:900;font-size:26px;padding:12px 20px;border-radius:16px;letter-spacing:1px}
.arrow{text-align:center;color:var(--ac);font-size:30px;line-height:1}
/* compare */
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.col{border-radius:32px;padding:40px 36px;background:var(--soft)}
.col.good{background:var(--ac);color:#fff}
.col-h{font-size:40px;font-weight:900;margin-bottom:28px}
.col li{padding-left:1.1em;text-indent:-1.1em}
.col ul{list-style:none;display:flex;flex-direction:column;gap:22px;font-size:34px;line-height:1.45;font-weight:500}
.col.bad li::before{content:'✕ ';color:var(--sub);font-weight:900}
.col.good li::before{content:'✓ ';font-weight:900}
.compare .body{margin-top:48px}
/* quote */
.quote{background:var(--soft)}
.qmark{font-size:260px;line-height:.6;color:var(--ac);font-weight:900;font-family:Georgia,serif}
blockquote{font-size:62px;font-weight:900;line-height:1.45;letter-spacing:-1.5px;margin-top:30px}
cite{display:block;margin-top:56px;font-size:36px;color:var(--sub);font-style:normal;font-weight:700}
/* stat */
.content{width:100%}
.stat{align-items:center;text-align:center}
.big{white-space:nowrap;font-weight:900;color:var(--ac);letter-spacing:-8px;line-height:1.1}
.big small{font-size:.4em;letter-spacing:-2px;margin-left:8px}
.stat .body{margin-top:40px}
.source{position:absolute;bottom:130px;font-size:24px;color:var(--sub)}
`;

const slidesHtml = spec.slides.map((s, i) => {
  const fn = L[s.layout];
  if (!fn) throw new Error(`알 수 없는 layout: ${s.layout} (가능: ${Object.keys(L).join(', ')})`);
  return fn(s, i);
}).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(spec.title || '카드뉴스')}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap"><style>${css}</style></head><body>${slidesHtml}</body></html>`;
const htmlPath = path.join(outDir, 'index.html');
fs.writeFileSync(htmlPath, html);

// ── PNG 캡처 ─────────────────────────────────────────
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }

const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
let browser;
try { browser = await playwright.chromium.launch(exe ? { executablePath: exe } : {}); }
catch { browser = await playwright.chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 }, deviceScaleFactor: 1 });
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// 넘치는 슬라이드는 글자 크기를 자동으로 줄여 헤더·푸터와 겹치지 않게 함
const fitted = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('section.card').forEach((card, i) => {
    const c = card.querySelector('.content');
    if (!c) return;
    const avail = card.clientHeight - 300; // 위아래 150px 여백
    let z = 1;
    while (c.scrollHeight * z > avail && z > 0.6) { z -= 0.02; c.style.zoom = z; }
    if (z < 1) out.push(`${i + 1}번 슬라이드 ${Math.round(z * 100)}%로 축소`);
  });
  return { out, font: document.fonts.check('900 40px "Noto Sans KR"') };
});
fitted.out.forEach((m) => console.log('ⓘ', m));
if (!fitted.font) console.warn('⚠ Noto Sans KR 웹폰트를 불러오지 못해 시스템 폰트로 렌더링했습니다.');
if (fitted.out.some((m) => m.includes('60%'))) console.warn('⚠ 내용이 너무 많은 슬라이드가 있습니다. 두 장으로 나누세요.');
const cards = await page.$$('section.card');
for (let i = 0; i < cards.length; i++) {
  const f = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
  await cards[i].screenshot({ path: f });
  console.log('✔', f);
}
await browser.close();
console.log(`\n완료: ${cards.length}장 → ${outDir}`);
