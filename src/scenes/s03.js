// S03 · The map — the path becomes the storyline, then the four questions.
import { C, rgba, mix } from '../lib/theme.js';
import { clamp, lerp, deck, inOut, prog, pop, smooth } from '../lib/ease.js';
import { text, card, disc, label } from '../lib/draw.js';
import { ACTS, SCENES, tensionAt } from '../timeline.js';
import { PATH_Y, PATH_X0, PATH_X1 } from './s01.js';
import { NODE_X } from './s02.js';

const BASE = 700;

export const cues = [
  ...ACTS.map((a, i) => ({ b: 1 + i / 3, sfx: 'tick' })),
  { b: 3, sfx: 'draw', dur: 2.1 },
  { b: 5, sfx: 'pulse' },
  { b: 7, sfx: 'whoosh', dur: 1.2, soft: true },
  ...[0, 1, 2, 3].map(i => ({ b: 8 + i * 2, sfx: 'pop' })),
  { b: 15, sfx: 'bell', note: 'A5', vel: .6 },
];

export const MAP = [
  ['What is actually happening', 'AI is already inside your critical applications, and it has moved from suggesting to acting.'],
  ['What has changed', 'Critical work now depends on AI that does not give the same answer twice.'],
  ['What went wrong', 'Guardrails lower the odds without removing them. Two real cases.'],
  ['What to do about it', 'What you owe once it has acted, and how you get it back.'],
];
export const MAP_Y = i => 262 + i * 168;

// Draw one map bar. o: {x offset, alpha, state: 'normal'|'dim'|'gold', sub override}
export function mapBar(ctx, i, o = {}) {
  const x = 96 + (o.dx || 0), y = MAP_Y(i), w = 1728, h = 148;
  const st = o.state || 'normal';
  ctx.save();
  ctx.globalAlpha *= clamp(o.alpha ?? 1);
  card(ctx, x, y, w, h, { style: st === 'gold' ? 'gold' : 'plain' });
  const dim = st === 'dim';
  disc(ctx, i + 1, x + 58, y + h / 2, 63, { fill: st === 'gold' ? C.gold : dim ? '#34425C' : C.acc, color: dim ? C.tx2 : C.accd });
  text(ctx, MAP[i][0], x + 122, y + 64, { font: 'disp', weight: 600, size: 32, tracking: -.015, color: dim ? C.mut : st === 'gold' ? '#F4E3BC' : '#FFFFFF' });
  text(ctx, o.sub || MAP[i][1], x + 122, y + 106, { font: 'sans', weight: 400, size: 25, color: dim ? C.dim : C.tx2 });
  if (o.tag) {
    const tw = 230, tx = x + w - 36 - tw, ty = y + h / 2 - 22;
    ctx.save(); ctx.globalAlpha *= o.tag;
    ctx.beginPath(); ctx.roundRect(tx, ty, tw, 44, 22);
    ctx.fillStyle = rgba(C.gold, .12); ctx.fill(); ctx.strokeStyle = rgba(C.gold, .7); ctx.lineWidth = 1.5; ctx.stroke();
    text(ctx, 'NO ANSWER YET', tx + tw / 2, ty + 28, { font: 'mono', weight: 500, size: 17, tracking: .16, color: C.gold, align: 'center' });
    ctx.restore();
  }
  ctx.restore();
}

// x position → frame, piecewise per act so the peak sits over the Crisis node
function frameAtX(x) {
  for (let i = 0; i < 7; i++) {
    const xs = Math.max(PATH_X0, NODE_X(i) - 136), xe = Math.min(PATH_X1, NODE_X(i) + 136);
    if (x <= xe || i === 6) {
      const sc = SCENES.filter(s => s.act === ACTS[i].id);
      const f0 = sc[0].start, f1 = sc[sc.length - 1].end;
      return lerp(f0, f1, clamp((x - xs) / (xe - xs)));
    }
  }
}
const ARC = [];
for (let k = 0; k <= 240; k++) {
  const x = lerp(PATH_X0, PATH_X1, k / 240);
  ARC.push([x, BASE - 36 - tensionAt(frameAtX(x)) * 290]);
}
// soften the curve (gaussian, ~60 px) so fast drops read as a turn, not a cliff
{
  const ys = ARC.map(p => p[1]), R = 9;
  for (let k = 0; k < ARC.length; k++) {
    let s = 0, w = 0;
    for (let j = -R; j <= R; j++) {
      const q = Math.min(ARC.length - 1, Math.max(0, k + j)), g = Math.exp(-(j * j) / (2 * (R / 2) ** 2));
      s += ys[q] * g; w += g;
    }
    ARC[k][1] = s / w;
  }
}
const PEAK = ARC.reduce((m, p) => (p[1] < m[1] ? p : m), ARC[0]);

export function draw(ctx, S) {
  const { b } = S;
  const rise = inOut(prog(b, 0, 1.5));
  const y = lerp(PATH_Y, BASE, rise);
  const leave = inOut(prog(b, 7, 1.3));      // storyline exits upward
  const upA = 1 - leave;

  if (upA > 0) {
    ctx.save();
    ctx.globalAlpha *= upA;
    ctx.translate(0, -70 * leave);
    // stage labels
    ACTS.forEach((a, i) => {
      const p = deck(prog(b, 1 + i / 3, .9));
      const col = a.id === 'crisis' ? C.al : a.id === 'turn' ? C.gold : C.mut;
      text(ctx, a.label, NODE_X(i), 318 + 14 * (1 - p), { font: 'mono', weight: 500, size: 17, tracking: .16, color: col, align: 'center', alpha: p });
      if (i > 0) {
        ctx.save(); ctx.globalAlpha *= p * .8;
        ctx.strokeStyle = C.ln2; ctx.setLineDash([4, 8]); ctx.lineWidth = 1.2;
        const sx = (NODE_X(i) + NODE_X(i - 1)) / 2;
        ctx.beginPath(); ctx.moveTo(sx, 342); ctx.lineTo(sx, y); ctx.stroke(); ctx.restore();
      }
    });
    // arc (tension curve) drawing left → right
    const ap = inOut(prog(b, 3, 2.1));
    if (ap > 0) {
      const xm = lerp(PATH_X0, PATH_X1, ap);
      const pts = ARC.filter(p => p[0] <= xm);
      const g = ctx.createLinearGradient(PATH_X0, 0, PATH_X1, 0);
      g.addColorStop(0, C.acc); g.addColorStop(.40, C.acc); g.addColorStop(.55, C.al); g.addColorStop(.63, C.gold); g.addColorStop(.74, C.acc); g.addColorStop(1, C.acc);
      // fill
      ctx.save();
      const fg = ctx.createLinearGradient(0, 360, 0, y);
      fg.addColorStop(0, rgba(C.acc, .20)); fg.addColorStop(1, rgba(C.acc, 0));
      ctx.beginPath(); ctx.moveTo(pts[0][0], y);
      pts.forEach(p => ctx.lineTo(p[0], p[1] + (y - BASE)));
      ctx.lineTo(pts[pts.length - 1][0], y); ctx.closePath();
      ctx.fillStyle = fg; ctx.fill();
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + (y - BASE)) : ctx.moveTo(p[0], p[1] + (y - BASE))));
      ctx.strokeStyle = g; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
      // peak marker
      const pk = prog(b, 5, .8);
      if (xm >= PEAK[0] && pk > 0) {
        const py = PEAK[1] + (y - BASE);
        ctx.save();
        ctx.fillStyle = C.al; ctx.beginPath(); ctx.arc(PEAK[0], py, 8 * pop(pk), 0, Math.PI * 2); ctx.fill();
        const q = ((b - 5) * .6667 / 2.4) % 1;
        ctx.globalAlpha *= .8 * (1 - q); ctx.strokeStyle = C.al; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(PEAK[0], py, 8 + 22 * q, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        text(ctx, 'The gap', PEAK[0] + 24, py - 16, { font: 'disp', weight: 600, size: 24, color: C.al, alpha: pk });
      }
    }
    // path + coloured nodes
    ctx.strokeStyle = C.path; ctx.lineWidth = 2.25;
    ctx.beginPath(); ctx.moveTo(PATH_X0, y); ctx.lineTo(PATH_X1, y); ctx.stroke();
    ACTS.forEach((a, i) => {
      const cp = smooth(prog(b, 1 + i / 3, .9));
      const col = a.id === 'crisis' ? C.al : a.id === 'turn' ? C.gold : C.acc;
      ctx.fillStyle = i === 3 ? C.al : mix(C.node, col, cp);
      ctx.beginPath(); ctx.arc(NODE_X(i), y, 6, 0, Math.PI * 2); ctx.fill();
      if (i === 3) {
        ctx.strokeStyle = C.al; ctx.lineWidth = 2.25; ctx.beginPath(); ctx.arc(NODE_X(i), y, 13.5, 0, Math.PI * 2); ctx.stroke();
        const q = (((b + 16) * .6667) / 2.4) % 1;
        ctx.save(); ctx.globalAlpha *= .8 * (1 - q); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(NODE_X(i), y, 13.5 * (1 + 2.2 * q), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    });
    label(ctx, 'THE STORYLINE', 96, 84, { size: 18, tracking: .18, alpha: prog(b, .5, 1) });
    ctx.restore();
  }

  // ---- the four questions ----
  const hp = deck(prog(b, 7.4, 1.4));
  text(ctx, 'Four questions. Only three have answers today.', 96, 190 + 20 * (1 - hp), { font: 'disp', weight: 560, size: 63, tracking: -.022, color: C.tx, alpha: hp });
  for (let i = 0; i < 4; i++) {
    const p = prog(b, 8 + i * 2, 1.3);
    if (p <= 0) continue;
    const gold = i === 3 ? smooth(prog(b, 15, .9)) : 0;
    const dx = 110 * (1 - deck(p)), a = smooth(p * 1.6);
    mapBar(ctx, i, { dx, alpha: a * (1 - gold) });
    if (gold > 0) mapBar(ctx, i, { dx, alpha: a * gold, state: 'gold', tag: gold });
  }
}
