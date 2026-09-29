// S01 · Cold open — "It decided on its own. You still answer for it."
import { C, rgba, mix } from '../lib/theme.js';
import { clamp, lerp, deck, inOut, prog, smooth, pop, outQuart } from '../lib/ease.js';
import { text, rich, typed, measure, glyph, avatar, pathLen } from '../lib/draw.js';
import { rand } from '../lib/rng.js';
import { SEC_PER_BEAT } from '../timeline.js';

export const PATH_Y = 936, PATH_X0 = 144, PATH_X1 = 1776;
const CX = 960, CY = 520;           // agent start
const AX = 560, AY = 640;           // agent after the freeze
const YX = 1360, YY = 640;          // "You"
const TASK = 'task: close the fraud queue';

export const cues = [
  { b: 1, sfx: 'blip' },
  { b: 3, sfx: 'draw', dur: 1.8 },
  ...TASK.split(' ').map((w, i) => ({ b: 6 + i * .42, sfx: 'tick' })),
  { b: 8, sfx: 'count', dur: 4, accel: true },
  { b: 12, sfx: 'pop', soft: true },
  { b: 15, sfx: 'draw', dur: 1.5 },
  { b: 17, sfx: 'tick' },
  { b: 18, sfx: 'whoosh', dur: 2, soft: true },
];

export function env(S) {
  S.env.bgAlpha = smooth(prog(S.b, 4.5, 4));
}

const N_CHIPS = 180;
const chipBeat = i => 8 + Math.sqrt(i / 11.25);

export function draw(ctx, S) {
  const { b, frame } = S;
  const freeze = prog(b, 12, 1.5);             // 0 → 1 as the stream freezes and dims
  const move = inOut(prog(b, 12, 1.6));        // agent slides to its "acts in your name" spot
  const morph = inOut(prog(b, 18, 2));         // S01 → S02 path morph

  // agent position & size
  let ax = lerp(CX, AX, move), ay = lerp(CY, AY, move), as = lerp(220, 150, move);
  ax = lerp(ax, PATH_X0, morph); ay = lerp(ay, PATH_Y, morph); as = lerp(as, 12, morph);
  let yx = lerp(YX, PATH_X1, morph), yy = lerp(YY, PATH_Y, morph);

  // ---- decision stream ----
  if (b >= 8 && b < 20) {
    const tb = Math.min(b, 12);
    const dimK = lerp(1, .09, freeze) * (1 - prog(b, 17.5, 1.5));
    for (let i = 0; i < N_CHIPS; i++) {
      const t0 = chipBeat(i); if (t0 > tb) break;
      const ang = (rand('chip', i) - .5) * 1.25 + (rand('chipb', i) - .5) * .3;
      const v = 420 + 520 * rand('chipv', i);
      const dist = 90 + v * (tb - t0) * SEC_PER_BEAT;
      const x = CX + Math.cos(ang) * dist, y = CY + Math.sin(ang) * dist * .8;
      if (x > 1990) continue;
      const a = clamp((tb - t0) * 4) * clamp(1 - (dist - 500) / 700) * dimK;
      if (a <= 0.01) continue;
      const sc = .7 + .5 * rand('chips', i);
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.roundRect(-18, -13, 36, 26, 7);
      ctx.fillStyle = rgba(C.acc, .16); ctx.fill();
      ctx.strokeStyle = rgba(C.acc, .7); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-2, 5); ctx.lineTo(8, -5);
      ctx.strokeStyle = C.acc2; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
    // counter
    const n = Math.round(3907 * Math.pow(clamp((tb - 8) / 4), 2.2));
    const ca = prog(b, 8, .5) * lerp(1, .35, freeze) * (1 - prog(b, 17.5, 1));
    text(ctx, 'DECISIONS', 1824, 112, { font: 'mono', weight: 500, size: 17, tracking: .16, color: C.acc2, align: 'right', alpha: ca });
    text(ctx, n.toLocaleString('en-US'), 1824, 170, { font: 'mono', weight: 500, size: 48, color: C.tx, align: 'right', alpha: ca });
  }

  // ---- the line between agent and You ----
  const lineP = deck(prog(b, 15, 1.5));
  if (lineP > 0) {
    const x0 = ax + as * .32, x1 = yx - lerp(60, 0, morph);
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, mix(C.acc, C.path, morph)); g.addColorStop(1, mix(C.lav, C.path, morph));
    ctx.save();
    ctx.strokeStyle = g; ctx.lineWidth = lerp(2.5, 2.25, morph); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(lerp(x0, PATH_X0, morph), lerp(ay, PATH_Y, morph));
    const ex = lerp(x0, x1, lineP);
    ctx.lineTo(lerp(ex, PATH_X1, morph), yy); ctx.stroke();
    ctx.restore();
    text(ctx, 'ACTS IN YOUR NAME', (x0 + x1) / 2, ay - 22, { font: 'mono', weight: 500, size: 17, tracking: .16, color: C.mut, align: 'center', alpha: prog(b, 15.8, 1) * (1 - prog(b, 18, .8)) });
  }

  // ---- agent: breathing dot → hexagon ----
  const drawP = inOut(prog(b, 3, 1.8));
  const dotA = prog(b, 1, .6);
  const nodeK = smooth(prog(b, 19.2, .8));    // crossfade into a path node
  if (dotA > 0) {
    const breathe = b < 3 ? 1 + .3 * Math.sin((b - 1) * Math.PI * .9) : 1;
    const nr = lerp(9 * breathe, as * 4.4 / 48, smooth(drawP));
    const glowA = .8 * (1 - morph);
    ctx.save();
    ctx.globalAlpha = dotA * (1 - nodeK);
    ctx.shadowColor = rgba(C.acc, glowA); ctx.shadowBlur = 40;
    ctx.fillStyle = C.acc;
    ctx.beginPath(); ctx.arc(ax, ay, Math.max(1, nr), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (drawP > 0) {
      // hex outline and spokes, drawn stroke by stroke (nucleus is the dot above)
      const k = as / 48;
      ctx.save(); ctx.globalAlpha = 1 - nodeK;
      ctx.translate(ax - as / 2, ay - as / 2); ctx.scale(k, k);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = rgba(C.acc, .6 * (1 - morph)); ctx.shadowBlur = 18 / k;
      const hex = 'M24 10.5 35.7 17.25v13.5L24 37.5 12.3 30.75v-13.5z', sp = 'M24 10.5v5.5M35.7 30.75l-4.7-2.7M12.3 30.75l4.7-2.7';
      const L = pathLen(hex);
      ctx.setLineDash([L * drawP, L + 1]); ctx.stroke(new Path2D(hex));
      ctx.setLineDash([]); ctx.globalAlpha *= prog(b, 4.2, .8); ctx.stroke(new Path2D(sp));
      ctx.restore();
    }
    // pulse ring when it starts acting
    if (b > 5 && b < 12.5) {
      const q = ((b - 5) / 3) % 1;
      ctx.save(); ctx.globalAlpha = (1 - q) * .5 * (1 - freeze);
      ctx.strokeStyle = C.acc; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ax, ay, as * .3 * (1 + 1.6 * q), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- typed task ----
  const tp = prog(b, 6, TASK.length / 28 / .6667 / 1.2);
  if (b >= 6) {
    const o = { font: 'mono', weight: 500, size: 28, color: C.acc2, alpha: 1 - prog(b, 12, 1) };
    const w = measure(ctx, TASK, o);
    text(ctx, '›', CX - w / 2 - 34, CY + 190, { ...o, color: C.mut });
    typed(ctx, TASK, CX - w / 2, CY + 190, tp, o, frame);
  }

  // ---- You ----
  const ya = prog(b, 14.6, .9);
  if (ya > 0) {
    const d = lerp(120, 10, morph);
    avatar(ctx, 'you', yx, yy, d, { alpha: ya * (1 - nodeK), scale: pop(prog(b, 14.6, .9)), glow: .5 * (1 - morph), pulse: b > 16 && b < 18 ? (b - 16) / 1.6 : 0 });
  }
  // path nodes at the ends (hand-off to S02)
  if (nodeK > 0) {
    for (const x of [PATH_X0, PATH_X1]) {
      ctx.save(); ctx.globalAlpha = nodeK; ctx.fillStyle = C.node;
      ctx.beginPath(); ctx.arc(x, PATH_Y, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  // ---- headline ----
  const out = 1 - prog(b, 18, 1);
  const h1 = deck(prog(b, 12.2, 1.4));
  text(ctx, 'It decided on its own.', CX, 330 + 24 * (1 - h1), { font: 'disp', weight: 620, size: 96, tracking: -.018, color: C.tx, align: 'center', alpha: h1 * out });
  const h2 = deck(prog(b, 17, 1.2));
  rich(ctx, [{ t: 'You', color: C.lav, weight: 500 }, { t: ' still answer for it.' }], CX, 430 + 20 * (1 - h2), { font: 'sans', weight: 400, size: 54, color: C.tx2, align: 'center', alpha: h2 * out, tracking: -.01 });
}
