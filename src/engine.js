// Frame compositor: background → scene (with transition wrappers) → HUD → WebGL post.
// Everything is a pure function of the frame number.
import { W, H, BEAT, BAR, FPS, SCENES, ACTS, sceneAt, tensionAt } from './timeline.js';
import { C, rgba } from './lib/theme.js';
import { clamp, lerp, deck, inOut, prog, smooth } from './lib/ease.js';
import { text, label } from './lib/draw.js';
import { SCENE_MODULES } from './scenes/index.js';

let dotPattern = null;
function dots(ctx) {
  if (dotPattern) return dotPattern;
  const c = new OffscreenCanvas(42, 42), g = c.getContext('2d');
  g.fillStyle = 'rgba(143,185,255,0.075)';
  g.beginPath(); g.arc(1.5, 1.5, 1.5, 0, Math.PI * 2); g.fill();
  return (dotPattern = ctx.createPattern(c, 'repeat'));
}

export function background(ctx, frame, env, tension) {
  ctx.fillStyle = C.stage; ctx.fillRect(0, 0, W, H);
  if (env.bgAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = env.bgAlpha;
  ctx.fillStyle = env.dark ? C.bgDark : C.bg; ctx.fillRect(0, 0, W, H);
  // drifting dot grid (6 px/s)
  const off = (frame / FPS) * 6;
  ctx.save();
  ctx.globalAlpha = env.bgAlpha * (env.gridAlpha ?? 1);
  ctx.translate(-(off % 42), -((off * .5) % 42));
  ctx.fillStyle = dots(ctx); ctx.fillRect(0, 0, W + 84, H + 84);
  ctx.restore();
  // glows follow tension
  let g = ctx.createRadialGradient(W * .88, 0, 0, W * .88, 0, 1350);
  g.addColorStop(0, rgba(C.acc, (env.dark ? .20 : .13) * (1 - .45 * tension)));
  g.addColorStop(1, rgba(C.acc, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(0, H, 0, 0, H, 1100);
  g.addColorStop(0, rgba(C.al, .05 + .20 * tension));
  g.addColorStop(1, rgba(C.al, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------- the big critical path used by T1 travel ----------
const NODE_GAP = 760;
export function bigPath(ctx, camX, alpha, activeAct, opts = {}) {
  if (alpha <= 0) return;
  const y = H / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  const sx = i => W / 2 + (i * NODE_GAP - camX);
  // gradient stroke like the storyline arc
  const g = ctx.createLinearGradient(sx(0), 0, sx(6), 0);
  g.addColorStop(0, C.acc); g.addColorStop(.40, C.acc); g.addColorStop(.5, C.al); g.addColorStop(.63, C.gold); g.addColorStop(.74, C.acc); g.addColorStop(1, C.acc);
  ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx(0) - 400, y); ctx.lineTo(sx(6) + 400, y); ctx.stroke();
  ACTS.forEach((a, i) => {
    const x = sx(i); if (x < -200 || x > W + 200) return;
    const hot = a.id === 'crisis', turn = a.id === 'turn', on = i === activeAct;
    const col = hot ? C.al : turn ? C.gold : C.acc;
    ctx.beginPath(); ctx.arc(x, y, on ? 14 : 9, 0, Math.PI * 2);
    ctx.fillStyle = on ? col : C.bg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
    if (on) { ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.strokeStyle = rgba(col, .35); ctx.lineWidth = 2; ctx.stroke(); }
    text(ctx, a.label, x, y + 70, { font: 'mono', weight: 500, size: 20, tracking: .16, color: on ? col : C.mut, align: 'center' });
    text(ctx, String(i + 1).padStart(2, '0'), x, y - 50, { font: 'mono', weight: 500, size: 17, tracking: .1, color: C.dim, align: 'center' });
  });
  ctx.restore();
}

// ---------- HUD ----------
function hud(ctx, frame, scene, alpha) {
  if (alpha <= 0) return;
  const act = ACTS[scene.actIndex];
  ctx.save(); ctx.globalAlpha = alpha;
  label(ctx, act.eyebrow, 96, 84, { size: 18, tracking: .18 });
  // part pills
  for (let i = 0; i < 4; i++) {
    const x = W - 96 - (4 - i) * 34 + 7, y = 70, on = act.part === i + 1;
    ctx.beginPath(); ctx.roundRect(x, y, 27, 12, 6);
    ctx.lineWidth = 1.8; ctx.strokeStyle = on ? C.acc : C.ln2; ctx.stroke();
    if (on) { ctx.fillStyle = C.acc; ctx.fill(); }
  }
  // mini critical path along the bottom
  const y = H - 46, x0 = 96, x1 = W - 96, n = 7;
  const broken = env_broken(frame);
  const mid = x0 + (x1 - x0) * 3 / 6;
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.ln2, 1);
  if (broken > 0) {
    const gap = 26 * broken;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(mid - gap, y); ctx.moveTo(mid + gap, y); ctx.lineTo(x1, y); ctx.stroke();
  } else { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
  // progress fill up to playhead
  const TOTAL = SCENES[SCENES.length - 1].end;
  const px = x0 + (x1 - x0) * (frame / TOTAL);
  ctx.strokeStyle = rgba(C.acc, .55);
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(broken > 0 ? Math.min(px, mid - 26 * broken) : px, y); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * i / 6, on = i === scene.actIndex, past = i < scene.actIndex;
    const col = i === 3 ? C.al : i === 4 ? C.gold : C.acc;
    ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = on || past ? col : C.node; ctx.fill();
    if (on) { ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.strokeStyle = rgba(col, .4); ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  ctx.beginPath(); ctx.arc(px, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = C.tx; ctx.fill();
  ctx.restore();
}
// 0..1 how broken the path is (breaks in S15, mended in S21)
function env_broken(frame) {
  const s15 = SCENES.find(s => s.id === 'S15'), s21 = SCENES.find(s => s.id === 'S21');
  const br = s15.start + 12 * BEAT, mend = s21.start + 12 * BEAT;
  if (frame < br) return 0;
  if (frame < mend) return smooth((frame - br) / BEAT);
  return 1 - smooth((frame - mend) / (2 * BEAT));
}

function hudAlpha(frame, scene) {
  const hookEnd = SCENES.find(s => s.id === 'S03').end;
  const s24 = SCENES.find(s => s.id === 'S24').start;
  if (frame < hookEnd) return 0;
  if (frame < hookEnd + BEAT * 2) return smooth((frame - hookEnd) / (BEAT * 2));
  if (frame >= s24) return 1 - smooth((frame - s24) / BEAT);
  return 1;
}

// ---------- main ----------
export function renderScene(ctx, frame) {
  const scene = sceneAt(frame);
  const idx = SCENES.indexOf(scene);
  const prev = SCENES[idx - 1];
  const f = frame - scene.start, b = f / BEAT, beats = scene.frames / BEAT;
  const tension = tensionAt(frame);
  const env = { bgAlpha: 1, dark: false, glitch: 0, gold: 0, fade: 1, gridAlpha: 1 };
  const S = { frame, f, b, beats, scene, env, tension, W, H };
  const mod = SCENE_MODULES[scene.id];
  mod.env && mod.env(S);

  background(ctx, frame, env, tension);

  // --- transition wrappers ---
  let k = 1, scale = 1, dy = 0, pathA = 0, camX = null;
  // T1 path travel: 2 beats out, 2 beats in
  if (scene.exit === 'T1' && b > beats - 2) {
    const e = inOut(prog(b, beats - 2, 2));
    k = 1 - smooth(e * 1.6); scale = lerp(1, .3, e);
    pathA = smooth(e * 1.4);
    camX = lerp(scene.actIndex * NODE_GAP, (scene.actIndex + .5) * NODE_GAP, e);
  }
  if (prev && prev.exit === 'T1' && b < 2) {
    const e = inOut(prog(b, 0, 2));
    k = smooth((e - .35) / .65); scale = lerp(.3, 1, e);
    pathA = 1 - smooth(e * 1.4);
    camX = lerp((scene.actIndex - .5) * NODE_GAP, scene.actIndex * NODE_GAP, e);
  }
  if (scene.exit === 'T2' && b > beats - .5) {
    const e = prog(b, beats - .5, .5); k = 1 - e; dy = 12 * e;
  }
  if (scene.exit === 'T4' && f >= scene.frames - 4) env.glitch = Math.max(env.glitch, .9);
  if (prev && prev.exit === 'T4' && f < 3) env.glitch = Math.max(env.glitch, .7);

  if (pathA > 0) bigPath(ctx, camX, pathA, pathA > 0 && b < 2 ? scene.actIndex : scene.actIndex + (b > beats - 1 ? 1 : 0));

  if (k > 0) {
    ctx.save();
    ctx.globalAlpha = k;
    // slow push-in (1.5% over the scene), plus transition scale
    const noPush = scene.exit === 'T3' || (prev && prev.exit === 'T3');
    const push = noPush ? 1 : 1 + .015 * (f / scene.frames);
    ctx.translate(W / 2, H / 2 + dy); ctx.scale(scale * push, scale * push); ctx.translate(-W / 2, -H / 2);
    mod.draw(ctx, S);
    ctx.restore();
  }
  hud(ctx, frame, scene, hudAlpha(frame, scene) * (pathA > 0 ? 1 - pathA : 1));
  return {
    frame, tension, glitch: env.glitch, gold: env.gold, fade: env.fade,
    bloom: .22 + .30 * tension, ca: 1.5 * Math.max(0, tension - .5) * 2,
  };
}
