// Host page: loads fonts, owns the 2D + WebGL canvases, exposes renderFrame() for the exporter,
// and runs an interactive preview (scrubber, scene list, synced audio) when opened in a browser.
import { W, H, FPS, SCENES, TOTAL_FRAMES, sceneAt, fmtTime } from './timeline.js';
import { FONT_FILES } from './lib/theme.js';
import { renderScene } from './engine.js';
import { Post } from './post.js';
import { isBuilt } from './scenes/index.js';
import { renderAudio, encodeWav } from './audio/render.js';

const out = document.getElementById('out');
out.width = W; out.height = H;
const src = new OffscreenCanvas(W, H);
const ctx = src.getContext('2d', { alpha: false });
const post = new Post(out, W, H);

async function loadFonts() {
  await Promise.all(FONT_FILES.map(async ([fam, file, weight]) => {
    const ff = new FontFace(fam, `url(../assets/fonts/${file})`, { weight });
    await ff.load(); document.fonts.add(ff);
  }));
  // warm up every face/weight used so the first frame is never a fallback
  for (const f of ['400 20px "Geist"', '600 20px "Geist"', '500 20px "Geist Mono"', '600 20px "Bricolage Grotesque"', '700 20px "Bricolage Grotesque"']) await document.fonts.load(f);
}

export function renderFrame(frame) {
  const p = renderScene(ctx, frame);
  post.render(src, p);
  return p;
}

window.renderFrame = renderFrame;
window.grab = (type = 'image/png', q) => out.toDataURL(type, q);
window.TIMELINE = { FPS, W, H, TOTAL_FRAMES, SCENES: SCENES.map(s => ({ id: s.id, title: s.title, start: s.start, end: s.end, built: isBuilt(s.id) })) };
// audio export: returns WAV as base64 chunks
window.renderAudioWav = async (f0 = 0, f1 = TOTAL_FRAMES) => {
  const buf = await renderAudio(f0, f1);
  const wav = new Uint8Array(encodeWav(buf));
  const chunks = [], CH = 1 << 20;
  for (let i = 0; i < wav.length; i += CH) {
    let s = ''; const sub = wav.subarray(i, i + CH);
    for (let j = 0; j < sub.length; j += 8192) s += String.fromCharCode.apply(null, sub.subarray(j, j + 8192));
    chunks.push(btoa(s));
  }
  return chunks;
};
window.ready = loadFonts().then(() => { renderFrame(0); return true; });

// ---------------- interactive preview ----------------
if (!new URLSearchParams(location.search).has('headless')) {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const scrub = document.getElementById('scrub'), tc = document.getElementById('tc'), list = document.getElementById('scenes');
  const playBtn = document.getElementById('play'), audBtn = document.getElementById('aud');
  scrub.max = TOTAL_FRAMES - 1;
  let frame = 0, playing = false, t0 = 0, f0 = 0, actx = null, abuf = null, anode = null;
  SCENES.forEach(s => {
    const b = document.createElement('button');
    b.textContent = `${s.id} ${s.title}`; b.className = isBuilt(s.id) ? 'built' : '';
    b.onclick = () => seek(s.start);
    list.appendChild(b);
  });
  const show = () => {
    renderFrame(frame);
    scrub.value = frame;
    const s = sceneAt(frame);
    tc.textContent = `${fmtTime(frame)} / ${fmtTime(TOTAL_FRAMES)} · f${frame} · ${s.id} ${s.title}`;
    [...list.children].forEach((b, i) => b.classList.toggle('cur', SCENES[i] === s));
  };
  const stopAudio = () => { if (anode) { anode.stop(); anode = null; } };
  const startAudio = () => {
    if (!abuf) return;
    stopAudio();
    anode = actx.createBufferSource(); anode.buffer = abuf; anode.connect(actx.destination);
    anode.start(0, frame / FPS);
  };
  const seek = f => { frame = Math.max(0, Math.min(TOTAL_FRAMES - 1, f | 0)); f0 = frame; t0 = performance.now(); if (playing) startAudio(); show(); };
  const tick = () => {
    if (!playing) return;
    const f = f0 + Math.floor((performance.now() - t0) / 1000 * FPS);
    if (f !== frame) { frame = Math.min(f, TOTAL_FRAMES - 1); show(); }
    if (frame >= TOTAL_FRAMES - 1) { playing = false; stopAudio(); playBtn.textContent = 'Play'; return; }
    requestAnimationFrame(tick);
  };
  playBtn.onclick = () => {
    playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
    if (playing) { f0 = frame; t0 = performance.now(); startAudio(); tick(); } else stopAudio();
  };
  audBtn.onclick = async () => {
    audBtn.disabled = true; audBtn.textContent = 'Rendering audio…';
    actx = actx || new AudioContext({ sampleRate: 48000 });
    abuf = await renderAudio(0, TOTAL_FRAMES);
    audBtn.textContent = 'Audio ready';
  };
  scrub.oninput = () => seek(+scrub.value);
  addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
    if (e.key === 'ArrowRight') seek(frame + (e.shiftKey ? FPS : 1));
    if (e.key === 'ArrowLeft') seek(frame - (e.shiftKey ? FPS : 1));
  });
  window.ready.then(show);
}
