// 모두잇 홍보영상 스킬 render_frames.mjs 방식: render(t) → 30fps 캡처. 프레임은 디스크에 쌓지 않고 ffmpeg 로 바로 인코딩.
// node render_frames.js preview 12.0,45.3     -> preview/t12.0.jpg ...
// node render_frames.js full <startFrame> <endFrame> <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const path = require('path');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const dir = __dirname; const FPS = 30;
(async () => {
  const mode = process.argv[2] || 'preview';
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto('file://' + path.join(dir, 'yt.html'));
  await pg.evaluate(() => document.fonts.ready);
  const total = await pg.evaluate(() => window.TL_DATA.total);
  if (mode !== 'full') {
    fs.mkdirSync(path.join(dir, 'preview'), { recursive: true });
    for (const t of process.argv[3].split(',').map(Number)) {
      await pg.evaluate((t) => window.render(t), t);
      await pg.screenshot({ path: path.join(dir, 'preview', `t${t.toFixed(1)}.jpg`), type: 'jpeg', quality: 90 });
    }
  } else {
    const n = Math.ceil(total * FPS); const a = +process.argv[3], e = Math.min(+process.argv[4], n);
    const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', process.argv[5]], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let i = a; i < e; i++) {
      await pg.evaluate((t) => window.render(t), i / FPS);
      const buf = await pg.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((i - a) % 900 === 0) console.log(process.argv[5], i - a, '/', e - a);
    }
    ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  }
  await b.close(); console.log('done', mode, total);
})();
