#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('사용법: node scripts/render.mjs <spec.json> <출력폴더>');
  process.exit(1);
}
const inputPath = path.resolve(input);
const spec = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const out = path.resolve(output || path.join(path.dirname(inputPath), 'rendered'));
const themes = {
  modooit: { bg: '#251044', ink: '#FFFFFF', muted: '#DDD2EB', accent: '#B9F47A' },
  wine: { bg: '#3A1428', ink: '#FFFFFF', muted: '#F4EEF1', accent: '#FF4D9D' },
  paper: { bg: '#F3EEE6', ink: '#382A24', muted: '#6D5B52', accent: '#C96F4A' }
};
const style = spec.style || 'modooit';
if (!themes[style]) throw new Error('style은 modooit, wine, paper 중 하나여야 합니다.');
if (!Array.isArray(spec.slides) || !spec.slides.length) throw new Error('slides가 비어 있습니다.');
for (const [i, slide] of spec.slides.entries()) {
  if (typeof slide.title !== 'string' || !slide.title.trim()) throw new Error(`${i + 1}장 title이 없습니다.`);
}
const colors = themes[style];
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = s => esc(s).replace(/==([^=]+)==/g, '<em>$1</em>').replace(/\n/g, '<br>');
function imageURL(file) {
  const absolute = path.resolve(path.dirname(inputPath), file);
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(absolute).toLowerCase()];
  if (!mime) throw new Error(`지원하지 않는 이미지: ${file}`);
  return `data:${mime};base64,${fs.readFileSync(absolute).toString('base64')}`;
}
const font = spec.font || 'Noto Sans KR';
const cards = spec.slides.map((s, i) => `<section class="card ${s.qr ? 'has-qr' : ''}">
  ${s.image ? `<img class="visual" src="${imageURL(s.image)}" alt="" style="object-position:${esc(s.imagePosition || 'center top')}">` : '<div class="graphic"><span>한 장에<br>하나의 메시지</span></div>'}
  <div class="shade"></div>
  <header>${esc(spec.brand || '')}</header>
  <div class="text"><div class="tag">${esc(s.tag || '')}</div><h1>${rich(s.title)}</h1>${s.body ? `<p>${rich(s.body)}</p>` : ''}<div class="label">${esc(s.label || '')}</div></div>
  ${s.qr ? `<aside><img src="${imageURL(s.qr.image)}" alt="QR"><span>${esc(s.qr.caption || '')}</span></aside>` : ''}
  <footer><span>${esc(spec.footer || '')}</span><b>${String(i + 1).padStart(2, '0')} / ${String(spec.slides.length).padStart(2, '0')}</b></footer>
</section>`).join('\n');
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><title>${esc(spec.title || '카드뉴스')}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{background:#ddd;display:grid;gap:32px;justify-content:center;padding:32px;font-family:"${esc(font)}","Malgun Gothic","Apple SD Gothic Neo",sans-serif;word-break:keep-all}
.card{position:relative;width:1080px;height:1350px;overflow:hidden;background:${colors.bg};color:${colors.ink}}
.visual,.graphic{position:absolute;left:56px;top:112px;width:968px;height:530px;object-fit:cover;border-radius:28px}
.graphic{background:linear-gradient(135deg,${colors.accent}33,transparent);border:2px solid ${colors.accent}66;display:grid;place-items:center}
.graphic span{font-size:76px;font-weight:900;line-height:1.3;color:${colors.accent};transform:rotate(-5deg)}
.shade{position:absolute;inset:0;pointer-events:none}header{position:absolute;top:40px;left:64px;right:64px;font-size:28px;font-weight:700;letter-spacing:1px}
.text{position:absolute;left:64px;right:64px;bottom:142px;display:grid;gap:24px}.tag{font-size:28px;color:${colors.accent};font-weight:700;min-height:34px}
h1{font-size:86px;line-height:1.22;font-weight:900;letter-spacing:-2.5px;overflow-wrap:anywhere}em{font-style:normal;color:${colors.accent}}
p{font-size:38px;line-height:1.55;color:${colors.muted};overflow-wrap:anywhere}.label{font-size:26px;color:${colors.muted};margin-top:8px}
footer{position:absolute;left:64px;right:64px;bottom:48px;display:flex;justify-content:space-between;gap:32px;border-top:1px solid ${colors.accent}66;padding-top:20px;font-size:23px;color:${colors.muted}}footer b{flex-shrink:0}
aside{position:absolute;right:64px;bottom:142px;width:220px;display:grid;gap:10px;text-align:center}aside img{width:220px;height:220px;object-fit:contain;background:white;padding:10px;border-radius:16px}aside span{font-size:24px}.has-qr .text{right:320px}
${style === 'wine' ? '.visual{inset:0;width:1080px;height:1350px;border-radius:0}.shade{background:linear-gradient(180deg,transparent 35%,#3A1428BB 56%,#3A1428FA 78%)}' : ''}
</style><body>${cards}</body></html>`;
fs.mkdirSync(out, { recursive: true });
const htmlPath = path.join(out, 'index.html');
fs.writeFileSync(htmlPath, html);
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require(process.env.SOCIAL_PLAYWRIGHT_MODULE || 'playwright'); }
catch { throw new Error('이 스킬 폴더에서 npm install을 실행하거나 SOCIAL_PLAYWRIGHT_MODULE에 기존 Playwright 모듈 경로를 지정하세요.'); }
const browser = await playwright.chromium.launch(process.env.SOCIAL_CHROME ? { executablePath: process.env.SOCIAL_CHROME } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1450 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  });
  const checks = await page.evaluate(() => [...document.querySelectorAll('.card')].map((card, i) => {
    const r = card.getBoundingClientRect();
    const issues = [];
    const text = card.querySelector('.text').getBoundingClientRect();
    const footer = card.querySelector('footer').getBoundingClientRect();
    const header = card.querySelector('header').getBoundingClientRect();
    if (text.top < header.bottom + 20) issues.push('본문이 상단 브랜드 영역과 겹칩니다.');
    if (text.bottom + 16 > footer.top) issues.push('본문이 하단 표기와 겹칩니다.');
    const visual = card.querySelector('.visual,.graphic').getBoundingClientRect();
    const photoFull = visual.height === 1350;
    if (!photoFull && text.top < visual.bottom + 20) issues.push('본문이 이미지 영역과 겹칩니다. 문장을 줄이세요.');
    for (const el of card.querySelectorAll('header,.tag,h1,p,.label,footer,aside')) {
      const b = el.getBoundingClientRect();
      if (b.left < r.left || b.right > r.right || b.top < r.top || b.bottom > r.bottom || el.scrollWidth > el.clientWidth + 1) issues.push(`${el.tagName} 영역이 넘칩니다.`);
    }
    for (const img of card.querySelectorAll('img')) if (!img.complete || !img.naturalWidth) issues.push('이미지 로딩 실패');
    return { slide: i + 1, width: r.width, height: r.height, issues };
  }));
  const elements = await page.$$('.card');
  for (let i = 0; i < elements.length; i++) await elements[i].screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}.png`) });
  const qa = { dimensions: '1080x1350', slides: checks, passed: checks.every(c => !c.issues.length), note: '자동 레이아웃 검사입니다. 모든 이미지의 한글·내용·모바일 가독성·QR은 직접 확인하세요.' };
  fs.writeFileSync(path.join(out, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
  console.log(JSON.stringify({ output: out, count: checks.length, passed: qa.passed, issues: checks.filter(c => c.issues.length) }, null, 2));
  if (!qa.passed) process.exitCode = 2;
} finally { await browser.close(); }
