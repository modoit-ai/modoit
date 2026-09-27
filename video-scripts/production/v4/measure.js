const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto('file://' + path.join(__dirname, 'yt.html')); await pg.evaluate(() => document.fonts.ready);
  const r = await pg.evaluate(() => window.SEGMENTS.map((s, i) => { if (s.kind !== 'talk') return null; const e = document.getElementById('s' + i + '_t'); const sc = document.getElementById('c' + i); sc.style.display = 'block'; const w = e.getBoundingClientRect().width; sc.style.display = 'none'; return [s.id, Math.round(w)]; }).filter(Boolean));
  console.log(JSON.stringify(r)); await b.close();
})();
