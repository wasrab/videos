#!/usr/bin/env node
// Frame-by-frame exporter.
//   node tools/render.mjs --from 0 --to 3000 --out out/preview.mp4        video (+ audio)
//   node tools/render.mjs --stills 120,480,900 --dir storyboard/frames     PNG stills
//   node tools/render.mjs --audio-only --out out/score.wav
// Each frame is rendered by the page (Canvas 2D → WebGL 2 post), grabbed as PNG, and piped to ffmpeg.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn, execSync } from 'node:child_process';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execSync('python3 -c "import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())"').toString().trim(); } catch { return 'ffmpeg'; }
}
const FF = ffmpegPath();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(res => {
    const srv = createServer(async (req, rsp) => {
      try {
        const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        const body = await readFile(p);
        rsp.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); rsp.end(body);
      } catch { rsp.writeHead(404); rsp.end(); }
    }).listen(0, () => res(srv));
  });
}

const run = (cmd, a) => new Promise((ok, bad) => {
  const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', c => (c === 0 ? ok() : bad(new Error(`${cmd} exited ${c}`))));
});

const srv = await serve();
const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/src/index.html?headless`);
await page.waitForFunction(() => window.ready).then(() => page.evaluate(() => window.ready));
const TL = await page.evaluate(() => window.TIMELINE);
const f0 = +(args.from ?? 0), f1 = +(args.to ?? TL.TOTAL_FRAMES);

async function grab(f, type = 'image/png', q) {
  const url = await page.evaluate(([f, type, q]) => { window.renderFrame(f); return window.grab(type, q); }, [f, type, q]);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}
async function audio(path) {
  const chunks = await page.evaluate(([a, b]) => window.renderAudioWav(a, b), [f0, f1]);
  await writeFile(path, Buffer.concat(chunks.map(c => Buffer.from(c, 'base64'))));
}

try {
  if (args.stills) {
    const dir = args.dir || 'out/stills';
    await mkdir(dir, { recursive: true });
    for (const s of String(args.stills).split(',')) {
      const f = +s;
      const png = await grab(f);
      const name = join(dir, `f${String(f).padStart(5, '0')}.png`);
      await writeFile(name, png);
      console.log('still', name);
    }
  } else if (args['audio-only']) {
    const out = args.out || 'out/score.wav';
    await mkdir(dirname(out), { recursive: true });
    await audio(out);
    console.log('audio', out);
  } else {
    const out = args.out || 'out/video.mp4';
    await mkdir(dirname(out), { recursive: true });
    const silent = out.replace(/\.mp4$/, '.silent.mp4');
    const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(TL.FPS), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 16), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((ok, bad) => ff.on('exit', c => (c === 0 ? ok() : bad(new Error('ffmpeg ' + c)))));
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const png = await grab(f);
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 60 === 0) {
        const el = (Date.now() - t0) / 1000, rate = (f - f0 + 1) / el;
        console.log(`frame ${f}/${f1}  ${rate.toFixed(1)} fps  eta ${((f1 - f) / rate).toFixed(0)}s`);
      }
    }
    ff.stdin.end(); await done;
    if (args['no-audio']) { await run('mv', [silent, out]); }
    else {
      const wav = out.replace(/\.mp4$/, '.wav');
      await audio(wav);
      await run(FF, ['-y', '-loglevel', 'error', '-i', silent, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out]);
      await run('rm', [silent]);
    }
    console.log('wrote', out);
  }
} finally {
  await browser.close(); srv.close();
}
