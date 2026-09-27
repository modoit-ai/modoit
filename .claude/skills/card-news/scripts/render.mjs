#!/usr/bin/env node
// 카드뉴스 렌더러 — 크림 페이퍼 + 테라코타 스타일
// JSON 원고 → index.html(미리보기) + 01.png, 02.png … (1080x1350, 인스타그램 4:5)
// 사용법: node render.mjs <spec.json> [출력폴더]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.resolve(HERE, '../assets/fonts');

const specPath = process.argv[2];
if (!specPath) {
  console.error('사용법: node render.mjs <spec.json> [출력폴더]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const outDir = path.resolve(process.argv[3] || path.join(path.dirname(specPath), spec.slug || 'card-news'));
fs.mkdirSync(outDir, { recursive: true });

// ── 색상 (colors로 부분 덮어쓰기 가능) ─────────────────
const t = {
  bg: '#F3EEE6', paper: '#FBF8F2', card: '#FFFDF9', line: '#E3DCD1',
  ink: '#26201B', sub: '#6A625A', mute: '#9A928A',
  accent: '#C96F4A', accentSoft: '#F4DDD1', accentInk: '#A4502F',
  mascot: '#D97757', tape: 'rgba(232,186,166,.5)',
  ...(spec.colors || {}),
};
const brand = { handle: '@modoit', name: '모두잇미래교육진흥협회', ...(spec.brand || {}) };

// ── 테마: 기본(paper, 테라코타) 색을 통째로 바꿔 끼우는 교체표 ──
const THEMES = {
  paper: { mascot: 'claude', swap: {} },
  // 코덱스 테마: 흰 배경 + 청보라
  codex: {
    mascot: 'codex',
    swap: {
      '#F3EEE6': '#FFFFFF', '#FAF7F2': '#FFFFFF', '#EDE6DB': '#FFFFFF', '#FBF8F2': '#F7F8FD', '#FFFDF9': '#FFFFFF',
      '#FFFDF8': '#FFFFFF', '#FFFBF7': '#F9F9FF', '#E3DCD1': '#DCE0EE', '#26201B': '#1B1D33', '#6A625A': '#5A5F7A',
      '#9A928A': '#8E93AB', '#8C857D': '#858AA3', '#C96F4A': '#5B5BEF', '#F4DDD1': '#E2E3FD', '#A4502F': '#3F3FC9',
      '#D97757': '#6366F1', '#EFE8DE': '#E9EBF5', '#EEE7DC': '#E8EAF4', '#EDE6DA': '#E6E9F4', '#D8CFC2': '#C9CEE3',
      '#5E574F': '#555A74', '#4E4740': '#464B66', '#F8E7DE': '#E9EAFE', '#F6F1E9': '#F2F3FA', '#F3D3C2': '#D9DBFC',
      '#F1EBE2': '#ECEEF7', '#F1E7DC': '#E6E8F7', '#ECE5DA': '#E6E9F4', '#E9E3DA': '#E3E6F2', '#E7B49C': '#AEB0F7',
      '#CFC7BC': '#C5CADF', '#C9C1B6': '#BEC3D8', '#B9B0A4': '#AEB3CC', '#8A4A30': '#34349E', '#6D655D': '#5D627C',
      '#6A5043': '#3F4466', '#3E3731': '#33374F', '#8a857e': '#7f8499',
      'rgba(232,186,166,.5)': 'rgba(170,176,245,.45)', 'rgba(201,111,74,': 'rgba(91,91,239,', 'rgba(120,90,60,': 'rgba(60,70,130,',
      '0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .45 0 0 0 .18 0': '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0', // 흰 배경: 종이 질감 없음
    },
  },
};
const theme = THEMES[spec.theme || 'paper'] || (() => { throw new Error(`알 수 없는 theme: ${spec.theme} (가능: ${Object.keys(THEMES).join(', ')})`); })();
const mascotName = spec.mascot || theme.mascot;
const applyTheme = (str) => Object.entries(theme.swap).reduce((acc, [a, b]) => acc.split(a).join(b), str);
const total = spec.slides.length;

// ── 유틸 ─────────────────────────────────────────────
const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// ==강조== → 테라코타, **굵게** → 진하게, \n → 줄바꿈
const rich = (s = '') => esc(s)
  .replace(/==(.+?)==/g, '<em>$1</em>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n/g, '<br>');
const imgSrc = (p) => {
  if (!p) return '';
  if (/^(https?:|data:)/.test(p)) return p;
  const abs = path.resolve(path.dirname(specPath), p);
  const ext = path.extname(abs).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(abs).toString('base64')}`;
};
// 슬라이드마다 다르지만 매번 같은 위치에 나오도록 하는 난수
const rng = (seed) => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

// ── 아이콘 (선 아이콘, 24x24) ─────────────────────────
const ICON = {
  touch: '<path d="M9 11V5a2 2 0 0 1 4 0v6m0-2a2 2 0 0 1 4 0v4a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.8 1.8 0 0 1 2.8-2.2L9 14"/>',
  bag: '<path d="M4 7h16l-1.5 12a2 2 0 0 1-2 1.8h-9a2 2 0 0 1-2-1.8zM9 7V5a3 3 0 0 1 6 0v2"/>',
  cart: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 20V9h8v11M3 9h18"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  code: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 10l-2 2 2 2M15 10l2 2-2 2"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  users: '<circle cx="9" cy="9" r="3"/><path d="M3 19a6 6 0 0 1 12 0M16 6a3 3 0 0 1 0 6M18 19a6 6 0 0 0-3-5"/>',
  star: '<path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  thread: '<text x="12" y="18.5" text-anchor="middle" font-size="21" font-weight="800" font-family="Nunito" fill="currentColor" stroke="none">@</text>',
  insta: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r=".8" fill="currentColor"/>',
  blog: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
};
const icon = (name, size = 26) => ICON[name]
  ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`
  : (name ? `<span style="font-size:${size}px;line-height:1">${esc(name)}</span>` : '');

// ── 마스코트: Claude Code 픽셀 캐릭터 ─────────────────
// 터미널 시작 화면의 블록 문자 그림을 18x6 픽셀(세로 2배)로 변환
const ART = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  '];
const QUAD = { ' ': [0, 0, 0, 0], '█': [1, 1, 1, 1], '▐': [0, 1, 0, 1], '▌': [1, 0, 1, 0], '▛': [1, 1, 1, 0], '▜': [1, 1, 0, 1], '▝': [0, 1, 0, 0], '▘': [1, 0, 0, 0] };
// 코덱스 픽셀 캐릭터: 청보라 구름 + 흰색 >_ 프롬프트 (16x12)
const CODEX = [
  '.....LLLLL......', '...LLLMMMMLL....', '..LLMMMMMMMMM...', '.LMMMMMMMMMMMM..',
  'LMMWWMMMMMMMMMD.', 'LMMMWWMMMMMMMMMD', 'LMMMMWWMMMMMMMMD', 'LMMMWWMMMMMMMMMD',
  'LMMWWMMMWWWWWMMD', '.MMMMMMMMMMMMMD.', '..DMMMMMMMMMDD..', '...DDDDDDDDDD...'];
const CODEX_C = { L: '#8B8DF9', M: '#6366F1', D: '#4B45D6', W: '#FFFFFF' };
function mascot(w) {
  if (mascotName === 'none') return '';
  if (mascotName === 'codex') {
    const u = w / 16;
    let r = '';
    CODEX.forEach((row, y) => [...row].forEach((c, x) => {
      if (CODEX_C[c]) r += `<rect x="${x * u}" y="${y * u}" width="${u + 0.3}" height="${u + 0.3}" fill="${CODEX_C[c]}"/>`;
    }));
    return `<svg class="mascot" width="${w}" height="${u * 12}" shape-rendering="crispEdges">${r}</svg>`;
  }
  if (mascotName !== 'claude') return `<img src="${imgSrc(mascotName)}" style="width:${w}px;height:auto">`;
  const u = w / 18;
  let r = '';
  ART.forEach((line, row) => [...line].forEach((ch, col) => QUAD[ch].forEach((on, k) => {
    const x = col * 2 + (k % 2), y = row * 2 + (k > 1 ? 1 : 0);
    const eye = !on && row === 0 && (ch === '▛' || ch === '▜');
    if (on || eye) r += `<rect x="${x * u}" y="${y * u * 2}" width="${u + 0.3}" height="${u * 2 + 0.3}" fill="${eye ? '#1F1A17' : t.mascot}"/>`;
  })));
  return `<svg class="mascot" width="${w}" height="${u * 12}" shape-rendering="crispEdges">${r}</svg>`;
}

// ── 손글씨 화살표 ─────────────────────────────────────
const squiggle = (w = 70) => `<svg width="${w}" height="24" viewBox="0 0 70 24"><path d="M2 14 C 20 2, 36 24, 62 10" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M52 4 L64 10 L54 18" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>`;
const skel = (n = 4, hot = [0]) => Array.from({ length: n }, (_, i) =>
  `<i class="sk ${hot.includes(i) ? 'hot' : ''}" style="width:${[92, 70, 84, 58, 76][i % 5]}%"></i>`).join('');

// ── 비주얼(가운데 큰 판) 종류 ─────────────────────────
const V = {
  // 번호 카드 보드 (표지·요약에 적합)
  board: (v) => `
    <div class="board">
      <div class="bh"><span class="pill"><i class="dot"></i>${esc(v.label || '')}</span>
        <div class="meta">${v.metaPill ? `<span class="pill sm">${esc(v.metaPill)}</span>` : ''}<span>${esc(v.meta || '')}</span></div></div>
      <div class="bbody">
        <div class="grid">${(v.items || []).map((it, n) => `
          <div class="it"><div class="ic">${icon(it.icon || 'check', 24)}</div>
            ${it.badge ? `<span class="badge">${esc(it.badge)}</span>` : ''}<span class="no">${it.no ?? n + 1}</span>
            <b>${rich(it.title)}</b>${it.hand ? `<span class="hand">${esc(it.hand)}</span>` : ''}</div>`).join('')}
          ${v.note ? `<div class="empty"><div class="tape" style="left:40px;top:-14px;width:90px;height:28px;transform:rotate(3deg)"></div><div class="note">${esc(v.note)}</div></div>` : ''}
        </div>
        ${v.count ? `<div class="prog"><div class="t">${esc(v.count.label || '')}</div><div class="n">${esc(v.count.value)}<small>${esc(v.count.unit || '')}</small></div>
          <div class="rail"></div>${(v.count.marks || Array.from({ length: Math.min(+v.count.value || 5, 6) }, (_, i) => i + 1)).map((m) => `<div class="tick">${esc(m)}</div>`).join('')}</div>` : ''}
      </div>
      ${v.path ? `<div class="brow">${mascot(84)}<span class="arrow">${squiggle()}${esc(v.path.start || '')}</span>
        <span class="arrow">${squiggle()}</span>${v.path.stamp ? `<span class="stamp">${esc(v.path.stamp).replace(' ', '<br>')}</span>` : ''}
        ${v.path.end ? `<span class="done">${esc(v.path.end)}</span>` : ''}</div>` : ''}
    </div>`,

  // 글쓰기 창 목업 (+ 스티커 메모, 고친 문장, 오른쪽 채팅 말풍선)
  window: (v) => `
    <div class="winwrap ${v.bubbles ? 'split' : ''}">
      ${v.tag ? `<span class="chip">${esc(v.tag)}</span>` : ''}
      <div class="win"><div class="wbar"><i></i><i></i><i></i><span>${esc(v.title || '블로그 · 글쓰기')}</span></div>
        <div class="wbody">
          ${v.heading !== undefined ? `<div class="wh">${esc(v.heading || '제목')}</div>` : ''}
          ${(v.lines || []).map((l) => typeof l === 'string'
            ? `<p class="wl">${rich(l)}</p>`
            : `<p class="wl ${l.strike ? 'strike' : ''}">${rich(l.text)}</p>${l.fix ? `<p class="fix">→ ${esc(l.fix)}</p>` : ''}`).join('')}
          ${v.typing ? `<p class="wl">${esc(v.typing)}<span class="caret"></span></p>` : ''}
        </div>
        ${v.sticky ? `<div class="sticky">${esc(v.sticky)}</div>` : ''}
      </div>
      ${v.bubbles ? `<div class="bubbles">${v.bubbles.map((b, i) => `<div class="cb" style="margin-left:${i % 2 ? 0 : 40}px">${esc(b)}</div>`).join('')}
        ${v.bubbleNote ? `<div class="hand big">${esc(v.bubbleNote)}</div>` : ''}</div>` : ''}
    </div>`,

  // 문서 → (AI) → 문서
  flow: (v) => {
    const doc = (d, hot) => `<div class="doc"><div class="dh"><b>${esc(d.label)}</b>${d.tag ? `<span class="pill sm">${esc(d.tag)}</span>` : ''}</div>${d.empty ? skel(1, [0]) : skel(5, hot)}</div>`;
    return `
    <div class="flow">
      <div class="frow">${doc(v.from, [0, 2, 4])}<div class="via">${esc(v.via || 'AI')}</div>${doc(v.to, [0])}</div>
      ${v.caption ? `<div class="fcap">${rich(v.caption)}</div>` : ''}
      ${v.steps ? `<div class="fsteps">${v.steps.map((s, i) => `<div><span class="sbadge">STEP ${i + 1}</span>${rich(s)}</div>`).join('')}</div>` : ''}
    </div>`;
  },

  // 하나 → 허브 → 여러 채널
  tree: (v) => {
    const n = v.leaves.length;
    const xs = v.leaves.map((_, i) => (n === 1 ? 50 : 12 + (76 * i) / (n - 1)));
    return `
    <div class="tree">
      <svg class="twires" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50 25 V 44" /> ${xs.map((x) => `<path d="M50 56 C 50 70, ${x} 64, ${x} 76" />`).join('')}
      </svg>
      <div class="troot">${v.root.brand ? `<small>${esc(v.root.brand)}</small>` : ''}<b>${esc(v.root.label)}</b></div>
      <div class="thub">${esc(v.hub)}</div>
      ${v.leaves.map((l, i) => `<div class="tleaf" style="left:${xs[i]}%">${icon(l.icon, 54)}<b>${esc(l.label)}</b></div>`).join('')}
      ${v.note ? `<div class="hand tnote">${esc(v.note)}</div>` : ''}
    </div>`;
  },

  // 일정·커리큘럼
  schedule: (v) => `
    <div class="sched">
      ${v.label ? `<div class="slabel">${rich(v.label)}</div>` : ''}
      ${v.rows.map((r, i) => `<div class="srow"><div class="sno"><small>${esc(r.unit || '회차')}</small>${esc(r.no ?? i + 1)}</div>
        <div><div class="sdate">${esc(r.date || '')}</div><div class="stitle">${rich(r.title)}</div></div>
        ${r.hand ? `<span class="hand sh">${esc(r.hand)}</span>` : ''}</div>`).join('')}
      ${v.chips ? `<div class="chips">${v.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
    </div>`,

  // 강사·인물 소개
  profile: (v) => `
    <div class="prof">
      <div class="ptop">
        <div class="photo">${v.photo ? `<img src="${imgSrc(v.photo)}">` : ''}</div>
        <div><div class="prole">${esc(v.role || '')}</div><div class="pname">${esc(v.name)}</div>
          <div class="ptags">${(v.tags || []).map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>
      </div>
      ${v.stat ? `<div class="pstat"><b>${esc(v.stat.value)}</b><span>${esc(v.stat.label)}</span></div>` : ''}
      ${v.logos ? `<div class="plogos">${v.logos.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      ${v.note ? `<div class="hand pnote">${esc(v.note)}</div>` : ''}
    </div>`,

  // 모집·신청 안내
  offer: (v) => `
    <div class="offer">
      ${v.badge ? `<span class="pill">${esc(v.badge)}</span>` : ''}
      <div class="obig">${rich(v.title)}</div>
      ${v.dates ? `<div class="odates">${v.dates.map((d) => `<div><small>${esc(d.label)}</small>${esc(d.value)}</div>`).join('')}</div>` : ''}
      ${v.info ? `<div class="oinfo">${esc(v.info)}</div>` : ''}
      ${v.price ? `<div class="oprice"><small>${esc(v.price.label || '')}</small>${esc(v.price.value)}</div>` : ''}
      ${v.button ? `<div class="obtn">${esc(v.button)} →</div>` : ''}
      ${v.note ? `<div class="onote">${esc(v.note)}</div>` : ''}
      <span class="stamp ostamp">${esc(v.stamp || '신청 OK').replace(' ', '<br>')}</span>
    </div>`,

  // 이미지 한 장 (스크린샷 등)
  image: (v) => `<div class="imgbox"><img src="${imgSrc(v.src)}">${v.caption ? `<div class="hand icap">${esc(v.caption)}</div>` : ''}</div>`,
};

// ── 슬라이드 ─────────────────────────────────────────
function slide(s, i) {
  const r = rng(i * 97 + 13);
  const dots = Array.from({ length: 4 }, () =>
    `<i class="deco" style="left:${Math.round(r() * 1040)}px;top:${Math.round(200 + r() * 900)}px;width:${8 + Math.round(r() * 4)}px;height:${8 + Math.round(r() * 4)}px"></i>`).join('');
  const tapes = [
    `<i class="tape" style="left:${300 + Math.round(r() * 300)}px;top:-16px;transform:rotate(${(r() * 8 - 4).toFixed(1)}deg)"></i>`,
    `<i class="tape" style="right:-40px;top:${120 + Math.round(r() * 260)}px;transform:rotate(${(8 + r() * 10).toFixed(1)}deg);width:120px"></i>`,
  ].join('');
  const last = i === total - 1;
  const trackDots = Array.from({ length: total }, (_, k) => `<span style="left:${(k / Math.max(total - 1, 1)) * 94}%"></span>`).join('');
  const meX = (i / Math.max(total - 1, 1)) * 94;
  const center = s.align === 'center';
  const vis = s.visual ? (V[s.visual.type] || (() => { throw new Error(`알 수 없는 visual.type: ${s.visual.type} (가능: ${Object.keys(V).join(', ')})`); }))(s.visual) : '';

  return `
  <section class="card ${center ? 'center' : ''}">
    ${dots}
    <div class="handle">${esc(brand.handle)}</div>
    <header>
      ${s.tags ? `<div class="tags">${s.tags.map((x, k) => `<span class="${k ? 'gray' : ''}">${esc(x)}</span>`).join('')}</div>` : ''}
      ${s.kicker ? `<div class="kicker">${rich(s.kicker)}</div>` : ''}
      <h1 class="${i === 0 ? 'cover' : ''}">${rich(s.title)}${s.underline ?? i === 0 ? '<svg class="brush" viewBox="0 0 720 30" preserveAspectRatio="none"><path d="M6 20 C 180 8, 420 6, 712 14" stroke-width="7" opacity=".85"/><path d="M40 25 C 250 16, 470 15, 690 20" stroke-width="3" opacity=".4"/></svg>' : ''}</h1>
      ${s.subtitle ? `<p class="subtitle">${rich(s.subtitle)}</p>` : ''}
    </header>
    <div class="visual">${tapes}<div class="vin">${vis}</div></div>
    <footer>
      ${mascot(118)}
      ${s.bubble ? `<div class="bubble">${esc(s.bubble)}</div>` : ''}
      ${(last ? s.cta : (s.cta ?? spec.swipe ?? '밀어서 보기')) ? `<div class="cta">${esc(last ? s.cta : (s.cta ?? spec.swipe ?? '밀어서 보기'))} →</div>` : ''}
    </footer>
    <div class="track">${trackDots}<div class="me" style="left:calc(${meX}% - 22px)">${mascot(44)}</div>
      <svg class="flag" width="22" height="38"><path d="M3 2v36" stroke="#6A625A" stroke-width="3"/><path d="M4 3h16l-4 6 4 6H4z" fill="${t.accent}"/></svg></div>
  </section>`;
}

// ── CSS ──────────────────────────────────────────────
const fontFace = [
  ['Noto Sans KR', 400, 'NotoSansKR-400'], ['Noto Sans KR', 500, 'NotoSansKR-500'], ['Noto Sans KR', 700, 'NotoSansKR-700'], ['Noto Sans KR', 900, 'NotoSansKR-900'],
  ['Nanum Pen Script', 400, 'NanumPenScript-400'], ['Nunito', 700, 'Nunito-700'], ['Nunito', 800, 'Nunito-800'],
].map(([f, w, file]) => `@font-face{font-family:'${f}';font-weight:${w};src:url('file://${FONT_DIR}/${file}.woff2') format('woff2')}`).join('\n');

const css = `${fontFace}
:root{--bg:${t.bg};--paper:${t.paper};--card:${t.card};--line:${t.line};--ink:${t.ink};--sub:${t.sub};--mute:${t.mute};--ac:${t.accent};--acs:${t.accentSoft};--aci:${t.accentInk};--tape:${t.tape}}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#8a857e;font-family:'Noto Sans KR',sans-serif;word-break:keep-all;display:flex;flex-direction:column;align-items:center;gap:40px;padding:40px 0}
.card{width:1080px;height:1350px;position:relative;overflow:hidden;color:var(--ink);display:flex;flex-direction:column;padding:150px 76px 0;
 background:radial-gradient(ellipse at 50% 30%,#FAF7F2 0%,var(--bg) 60%,#EDE6DB 100%)}
.card::before{content:'';position:absolute;inset:0;opacity:.35;mix-blend-mode:multiply;pointer-events:none;
 background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/><feColorMatrix values='0 0 0 0 .55 0 0 0 0 .5 0 0 0 0 .45 0 0 0 .18 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")}
.deco{position:absolute;border-radius:3px;background:var(--ac);opacity:.3}
.tape{position:absolute;display:block;background:var(--tape);width:110px;height:34px;border-radius:2px;z-index:3}
.handle{position:absolute;top:84px;left:0;right:0;text-align:center;font-family:Nunito;font-weight:700;font-size:38px;letter-spacing:2px;color:#8C857D}
em{font-style:normal;color:var(--ac)}
strong{font-weight:900;color:var(--ink)}
header{position:relative;z-index:2}
.center header{text-align:center}
.tags{display:flex;gap:14px;margin-bottom:18px}.center .tags{justify-content:center}
.tags span{background:var(--acs);color:var(--aci);font-weight:700;font-size:30px;padding:10px 26px;border-radius:999px}
.tags span.gray{background:#E9E3DA;color:#5E574F}
.kicker{font-size:40px;font-weight:900;color:var(--ac);letter-spacing:-1px;margin-bottom:4px}
h1{position:relative;display:inline-block;font-size:80px;font-weight:900;line-height:1.2;letter-spacing:-4px}
h1.cover{font-size:84px}
.brush{position:absolute;left:-10px;right:-10px;bottom:-14px;width:calc(100% + 20px);height:30px;fill:none;stroke:var(--ac);stroke-linecap:round}
.subtitle{font-size:40px;font-weight:500;color:var(--sub);letter-spacing:-1px;line-height:1.45;margin-top:26px}
.visual{position:relative;flex:1;margin:40px 0 28px;min-height:0}
.vin{height:100%;display:flex;align-items:center;justify-content:center}
.vin>*{width:100%}
footer{position:relative;height:120px;display:flex;align-items:center;gap:26px;flex:none;z-index:2}
.bubble{position:relative;background:var(--card);border-radius:22px;padding:16px 28px;font-size:32px;font-weight:700;box-shadow:0 6px 16px rgba(120,90,60,.12)}
.bubble::before{content:'';position:absolute;left:-12px;top:50%;margin-top:-10px;border:10px solid transparent;border-right:12px solid var(--card);border-left:0}
.cta{margin-left:auto;background:var(--ac);color:#fff;font-weight:700;font-size:32px;padding:20px 38px;border-radius:999px;box-shadow:0 10px 20px rgba(201,111,74,.35);white-space:nowrap}
.track{position:relative;height:2px;background:#CFC7BC;margin:34px -10px 56px;flex:none}
.track span{position:absolute;top:-5px;width:12px;height:12px;border-radius:50%;background:#B9B0A4}
.track .me{position:absolute;top:-34px}
.track .flag{position:absolute;right:-6px;top:-34px}
.pill{display:inline-flex;align-items:center;gap:8px;background:var(--acs);color:var(--aci);font-weight:700;font-size:25px;padding:8px 18px;border-radius:10px}
.pill.sm{font-size:20px;padding:4px 12px;border-radius:8px}
.pill .dot{width:12px;height:12px;border-radius:50%;background:var(--ac);display:inline-block}
.chip{display:inline-block;background:#EFE8DE;color:#4E4740;font-weight:700;font-size:24px;padding:8px 18px;border-radius:10px}
.hand{font-family:'Nanum Pen Script';color:var(--ac);font-size:40px;line-height:1.1}
.stamp{display:inline-flex;width:116px;height:96px;border:3px solid var(--ac);border-radius:16px;transform:rotate(-8deg);align-items:center;justify-content:center;font-family:'Nanum Pen Script';font-size:44px;color:var(--ac);background:#FFFBF7;line-height:.95;text-align:center;box-shadow:0 4px 8px rgba(0,0,0,.06);flex:none}
/* board */
.board{position:relative;background:var(--paper);border:2px solid var(--line);border-radius:30px;box-shadow:0 18px 40px rgba(120,90,60,.10);padding:22px 26px 14px}
.bh{display:flex;align-items:center;gap:14px;margin-bottom:18px}
.meta{margin-left:auto;display:flex;align-items:center;gap:14px;font-size:22px;color:var(--mute)}
.bbody{display:flex;gap:18px}
.grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.it{position:relative;min-height:150px;background:var(--card);border:1.5px solid #EDE6DA;border-radius:16px;padding:18px 20px;box-shadow:0 6px 14px rgba(120,90,60,.07)}
.ic{width:42px;height:42px;border-radius:10px;background:var(--acs);color:var(--aci);display:flex;align-items:center;justify-content:center}
.badge{position:absolute;top:18px;right:60px;background:var(--acs);border-radius:999px;font-size:22px;font-weight:700;color:#8A4A30;padding:4px 16px}
.no{position:absolute;top:18px;right:18px;width:32px;height:32px;border-radius:50%;background:#F1EBE2;font-size:19px;font-weight:700;color:#6D655D;display:flex;align-items:center;justify-content:center}
.it b{display:block;font-size:30px;font-weight:900;letter-spacing:-1px;margin-top:6px;line-height:1.3}
.it .hand{display:inline-block;background:#F8E7DE;padding:0 10px;border-radius:4px;border-bottom:2px solid var(--ac);margin-top:4px}
.empty{min-height:150px;border:2px dashed #D8CFC2;border-radius:16px;position:relative;display:flex;align-items:center;justify-content:center}
.note{width:86%;padding:18px 10px;background:#FFFDF8;transform:rotate(-3deg);box-shadow:0 6px 12px rgba(0,0,0,.08);text-align:center;font-family:'Nanum Pen Script';font-size:50px;color:var(--ac)}
.prog{position:relative;width:150px;flex:none}
.prog .t{font-size:24px;font-weight:700;color:var(--sub)}
.prog .n{font-size:84px;font-weight:900;color:var(--ac);line-height:1;letter-spacing:-3px}
.prog .n small{font-size:34px}
.rail{position:absolute;left:14px;top:150px;bottom:14px;width:16px;border-radius:10px;background:var(--ac)}
.rail::after{content:'';position:absolute;left:-6px;bottom:-12px;width:28px;height:28px;border-radius:50%;background:var(--card);border:3px solid var(--ac)}
.prog{display:flex;flex-direction:column}
.prog .tick{position:relative;margin-left:58px;font-size:26px;color:var(--mute);font-weight:500;flex:1;display:flex;align-items:flex-end;max-height:72px}
.prog .t+.n+.rail+.tick{margin-top:40px}
.brow{display:flex;align-items:center;gap:26px;margin-top:10px;height:100px}
.arrow{font-family:'Nanum Pen Script';font-size:46px;color:#6A5043;display:flex;align-items:center;gap:10px}
.done{white-space:nowrap;margin-left:auto;background:#F1E7DC;font-size:25px;font-weight:700;padding:10px 18px;border-radius:8px}
/* window */
.winwrap{position:relative;display:flex;flex-direction:column;align-items:center}
.winwrap.split{display:grid;grid-template-columns:1.35fr 1fr;gap:30px;align-items:center}
.winwrap>.chip{position:absolute;top:-58px;left:0}
.win{position:relative;width:100%;background:var(--card);border:2px solid var(--line);border-radius:22px;box-shadow:0 18px 40px rgba(120,90,60,.12);overflow:visible}
.wbar{display:flex;align-items:center;gap:10px;padding:18px 22px;border-bottom:1.5px solid #EEE7DC;background:#F6F1E9;border-radius:22px 22px 0 0}
.wbar i{width:16px;height:16px;border-radius:50%;background:#E4A08A}.wbar i:nth-child(2){background:#E9C98E}.wbar i:nth-child(3){background:#A9C99A}
.wbar span{margin-left:14px;font-size:22px;color:var(--mute);font-weight:500}
.wbody{padding:34px 40px 50px;min-height:330px}
.winwrap:not(.split) .wbody{min-height:520px}
.winwrap:not(.split) .wl{font-size:38px}
.wh{font-size:46px;font-weight:700;color:#C9C1B6;border-bottom:1.5px solid #EEE7DC;padding-bottom:22px;margin-bottom:26px}
.wl{font-size:32px;line-height:1.55;color:#3E3731;font-weight:500;margin-bottom:10px}
.wl.strike{text-decoration:line-through;text-decoration-color:#D9534F;text-decoration-thickness:3px}
.fix{font-family:'Nanum Pen Script';font-size:40px;color:#D9534F;margin:-4px 0 14px}
.caret{display:inline-block;width:3px;height:36px;background:var(--ink);vertical-align:-6px;margin-left:4px}
.sticky{position:absolute;right:-18px;top:-30px;background:#F3D3C2;color:var(--aci);font-family:'Nanum Pen Script';font-size:44px;padding:8px 26px;transform:rotate(6deg);box-shadow:0 6px 12px rgba(0,0,0,.1)}
.bubbles{display:flex;flex-direction:column;gap:22px;align-items:flex-end}
.cb{background:var(--ac);color:#fff;font-size:30px;font-weight:700;padding:18px 28px;border-radius:24px 24px 6px 24px;box-shadow:0 8px 18px rgba(201,111,74,.3)}
.cb:nth-child(2){opacity:.85}.cb:nth-child(3){opacity:.7}
.bubbles .hand.big{font-size:52px;margin-top:10px;transform:rotate(-4deg)}
/* flow */
.flow{display:flex;flex-direction:column;align-items:center;gap:34px}
.frow{display:flex;align-items:center;gap:0;width:100%;justify-content:center}
.doc{width:340px;min-height:420px;background:var(--card);border:2px solid var(--line);border-radius:22px;padding:28px;box-shadow:0 14px 30px rgba(120,90,60,.1)}
.dh{display:flex;align-items:center;gap:10px;margin-bottom:26px}.dh b{font-size:30px;font-weight:900}
.sk{display:block;height:18px;border-radius:9px;background:#ECE5DA;margin-bottom:34px}.sk.hot{background:#E7B49C}
.via{width:130px;height:130px;margin:0 -8px;z-index:2;border-radius:50%;background:var(--paper);border:5px solid var(--ac);display:flex;align-items:center;justify-content:center;font-family:Nunito;font-weight:800;font-size:44px;color:var(--ac);box-shadow:0 0 0 14px rgba(201,111,74,.1)}
.fcap{font-size:62px;font-weight:900;letter-spacing:-2px}
.fsteps{display:flex;flex-direction:column;gap:16px;align-self:stretch;padding:0 40px}
.fsteps div{font-size:32px;font-weight:700;display:flex;align-items:center;gap:16px}
.sbadge{background:var(--ac);color:#fff;font-family:Nunito;font-weight:800;font-size:22px;padding:6px 14px;border-radius:8px;letter-spacing:1px}
/* tree */
.tree{position:relative;height:640px}
.twires{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--ac);stroke-width:.6;vector-effect:non-scaling-stroke}
.twires path{stroke-width:5px;vector-effect:non-scaling-stroke}
.troot{position:absolute;left:50%;top:0;transform:translateX(-50%);width:230px;height:170px;background:var(--card);border:2px solid var(--line);border-radius:22px;box-shadow:0 14px 30px rgba(120,90,60,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
.troot small{font-family:Nunito;font-weight:800;color:#2DB400;font-size:24px;letter-spacing:1px}.troot b{font-size:34px;font-weight:900}
.thub{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);background:var(--paper);border:3px solid var(--ac);border-radius:16px;padding:14px 28px;font-family:Nunito,'Noto Sans KR';font-weight:800;font-size:30px;color:var(--aci);white-space:nowrap}
.tleaf{position:absolute;top:76%;transform:translateX(-50%);width:220px;height:170px;background:var(--card);border:2px solid var(--line);border-radius:22px;box-shadow:0 14px 30px rgba(120,90,60,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--ink)}
.tleaf b{font-size:30px;font-weight:900}
.tnote{position:absolute;right:0;top:20%;transform:rotate(-6deg)}
/* schedule */
.sched{display:flex;flex-direction:column;gap:18px}
.slabel{font-size:34px;font-weight:900;color:var(--ac);margin-bottom:4px}
.srow{position:relative;display:flex;align-items:center;gap:26px;background:var(--card);border:2px solid var(--line);border-radius:22px;padding:24px 28px;box-shadow:0 10px 24px rgba(120,90,60,.08)}
.sno{flex:none;width:84px;height:84px;border-radius:16px;background:var(--ac);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Nunito;font-weight:800;font-size:40px;line-height:1}
.sno small{font-family:'Noto Sans KR';font-size:16px;font-weight:700;opacity:.85;margin-bottom:4px}
.sdate{font-size:26px;font-weight:700;color:var(--ac)}
.stitle{font-size:36px;font-weight:900;letter-spacing:-1px;margin-top:2px}
.sh{position:absolute;right:26px;top:50%;transform:translateY(-50%) rotate(-4deg)}
.chips{display:flex;gap:12px;margin-top:6px}
/* profile */
.prof{background:var(--paper);border:2px solid var(--line);border-radius:30px;box-shadow:0 18px 40px rgba(120,90,60,.10);padding:44px 44px 36px;position:relative}
.ptop{display:flex;align-items:center;gap:40px}
.photo{width:250px;height:250px;border-radius:50%;overflow:hidden;border:8px solid var(--ac);background:var(--acs);flex:none;box-shadow:0 0 0 10px rgba(201,111,74,.12)}
.photo img{width:100%;height:100%;object-fit:cover}
.prole{font-size:28px;color:var(--mute);font-weight:500}
.pname{font-size:74px;font-weight:900;letter-spacing:-3px;line-height:1.1;margin-bottom:16px}
.ptags{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.ptags span{background:#EFE8DE;font-size:26px;font-weight:700;padding:6px 16px;border-radius:8px;color:#4E4740}
.pstat{display:flex;align-items:baseline;gap:18px;margin-top:40px}
.pstat b{font-family:Nunito;font-weight:800;font-size:110px;color:var(--ac);line-height:1;letter-spacing:-2px}
.pstat span{font-size:36px;font-weight:700}
.plogos{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;border-top:1.5px dashed #D8CFC2;padding-top:24px}
.plogos span{font-size:24px;font-weight:700;color:#5E574F;background:var(--card);border:1.5px solid #EDE6DA;padding:8px 16px;border-radius:10px}
.pnote{position:absolute;right:40px;top:40px;transform:rotate(-5deg)}
/* offer */
.offer{position:relative;background:var(--paper);border:2px solid var(--line);border-radius:30px;box-shadow:0 18px 40px rgba(120,90,60,.10);padding:44px 40px 36px;display:flex;flex-direction:column;align-items:center;text-align:center}
.obig{font-size:112px;font-weight:900;letter-spacing:-5px;line-height:1.1;margin:16px 0 26px}
.odates{display:flex;gap:16px}
.odates div{background:var(--card);border:2px solid var(--line);border-radius:14px;padding:10px 24px;font-size:34px;font-weight:900;display:flex;flex-direction:column;line-height:1.2}
.odates small{font-size:18px;color:var(--ac);font-weight:700}
.oinfo{font-size:28px;color:var(--sub);margin-top:22px;font-weight:500}
.oprice{font-size:72px;font-weight:900;letter-spacing:-2px;margin-top:10px;display:flex;align-items:baseline;gap:14px}
.oprice small{font-size:28px;color:var(--sub);font-weight:700;letter-spacing:0}
.obtn{margin-top:22px;width:80%;background:var(--ac);color:#fff;font-size:40px;font-weight:900;padding:26px 0;border-radius:999px;box-shadow:0 12px 24px rgba(201,111,74,.35)}
.onote{font-size:22px;color:var(--mute);margin-top:16px}
.ostamp{position:absolute;right:34px;top:40px}
/* image */
.imgbox{position:relative;text-align:center}
.imgbox img{max-width:100%;max-height:640px;border-radius:22px;border:2px solid var(--line);box-shadow:0 18px 40px rgba(120,90,60,.12)}
.icap{position:absolute;right:10px;bottom:-20px;transform:rotate(-4deg)}
`;

const html = applyTheme(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(spec.title || '카드뉴스')}</title><style>${css}</style></head><body>${spec.slides.map(slide).join('\n')}</body></html>`);
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
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
await page.goto('file://' + htmlPath, { waitUntil: 'load' });

const report = await page.evaluate(async () => {
  const text = document.body.innerText;
  const faces = ['400 30px "Noto Sans KR"', '500 30px "Noto Sans KR"', '700 30px "Noto Sans KR"', '900 30px "Noto Sans KR"', '30px "Nanum Pen Script"', '700 30px Nunito', '800 30px Nunito'];
  const missing = [];
  for (const f of faces) if (!(await document.fonts.load(f, text)).length) missing.push(f);
  await document.fonts.ready;
  // 비주얼이 넘치면 자동 축소
  const fit = [];
  document.querySelectorAll('section.card').forEach((card, i) => {
    const box = card.querySelector('.visual'), inner = card.querySelector('.vin > *');
    if (!inner) return;
    let z = 1;
    while (inner.scrollHeight * z > box.clientHeight && z > 0.55) { z -= 0.02; inner.style.zoom = z; }
    if (z < 1) fit.push([i + 1, Math.round(z * 100)]);
  });
  return { missing, fit };
});
if (report.missing.length) console.warn('⚠ 폰트를 불러오지 못했습니다:', report.missing.join(', '));
report.fit.forEach(([n, z]) => console.log(`ⓘ ${n}번 슬라이드 비주얼을 ${z}%로 축소${z < 80 ? ' — 내용을 줄이거나 슬라이드를 나누세요' : ''}`));

const cards = await page.$$('section.card');
for (let i = 0; i < cards.length; i++) {
  const f = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
  await cards[i].screenshot({ path: f });
  console.log('✔', f);
}
await browser.close();
console.log(`\n완료: ${cards.length}장 → ${outDir}`);
