// S02 · Title — the agent–You line has become the critical path.
import { C, rgba } from '../lib/theme.js';
import { clamp, lerp, deck, prog, pop, smooth } from '../lib/ease.js';
import { text, mono } from '../lib/draw.js';
import { PATH_Y, PATH_X0, PATH_X1 } from './s01.js';

export const NODE_X = i => PATH_X0 + (PATH_X1 - PATH_X0) * i / 6;
const MOTIF = ['D5', 'F5', null, 'A5', 'G5'];

export const cues = [
  ...[1, 2, 3, 4, 5].map((n, i) => (n === 3
    ? { b: i / 3, sfx: 'pulse' }
    : { b: i / 3, sfx: 'bell', note: MOTIF[i], vel: .55 })),
  { b: 3, sfx: 'whoosh', dur: 1.5, soft: true },
  { b: 6, sfx: 'tick' },
  { b: 9, sfx: 'tick' },
];

// The cover path, shared with S03 (y can move, alpha for labels etc.)
export function coverPath(ctx, b, y, o = {}) {
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.strokeStyle = C.path; ctx.lineWidth = 2.25;
  ctx.beginPath(); ctx.moveTo(PATH_X0, y); ctx.lineTo(PATH_X1, y); ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const x = NODE_X(i);
    const np = (i === 0 || i === 6) ? 1 : prog(b, (i - 1) / 3, .7);
    if (np <= 0) continue;
    const s = pop(np);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (i === 3) {
      ctx.fillStyle = C.al; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.al; ctx.lineWidth = 2.25; ctx.beginPath(); ctx.arc(0, 0, 13.5, 0, Math.PI * 2); ctx.stroke();
      // peak ring (deck: 2.4 s, scale 1 → 3.2)
      const q = (((o.ringB ?? b) * .6667) / 2.4) % 1;
      ctx.globalAlpha *= .8 * (1 - q);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13.5 * (1 + 2.2 * q), 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = C.node; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function draw(ctx, S) {
  const { b } = S;
  coverPath(ctx, b, PATH_Y);
  const out = 1 - smooth(prog(b, 14.8, 1.2));
  const t1 = deck(prog(b, 3, 2.1));
  const o = { font: 'disp', weight: 680, size: 156, tracking: -.035, color: '#FFFFFF' };
  text(ctx, 'AI in the', 144, 400 + 30 * (1 - t1), { ...o, alpha: t1 * out });
  text(ctx, 'Critical Path', 144, 553 + 30 * (1 - t1), { ...o, alpha: t1 * out });
  const t2 = deck(prog(b, 6, 1.8));
  text(ctx, 'It decided on its own. You still answer for it.', 144, 660, { font: 'sans', weight: 400, size: 44, tracking: -.01, color: C.tx2, alpha: t2 * out });
  const t3 = deck(prog(b, 9, 1.6));
  ctx.save(); ctx.globalAlpha = t3 * out;
  mono(ctx, 'SV', 171, 772, 54, C.acc2);
  text(ctx, 'Saúl Varela', 214, 779, { font: 'mono', weight: 500, size: 21, tracking: .06, color: C.mut });
  mono(ctx, 'WM', 440, 772, 54, C.gold);
  text(ctx, 'Facilitated by Wasim Malik, Risk Professionals', 483, 779, { font: 'mono', weight: 500, size: 21, tracking: .06, color: C.mut });
  ctx.restore();
}
