// Canvas 2D drawing primitives shared by every scene.
import { C, F, rgba, mix } from './theme.js';
import { clamp } from './ease.js';

// ---------- text ----------
export function font(o = {}) {
  const fam = F[o.font || 'sans'];
  return `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size || 25}px ${fam}`;
}
function applyText(ctx, o) {
  ctx.font = font(o);
  ctx.letterSpacing = o.tracking ? `${o.tracking * (o.size || 25)}px` : '0px';
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  ctx.fillStyle = o.color || C.tx;
}
export function text(ctx, str, x, y, o = {}) {
  if (o.alpha === 0) return;
  ctx.save();
  applyText(ctx, o);
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  if (o.upper) str = str.toUpperCase();
  ctx.fillText(str, x, y);
  ctx.restore();
}
export function measure(ctx, str, o = {}) {
  ctx.save(); applyText(ctx, o);
  const w = ctx.measureText(o.upper ? str.toUpperCase() : str).width;
  ctx.restore();
  return w;
}
// parts: [{t, color?, weight?, font?}] drawn inline, sharing base options
export function rich(ctx, parts, x, y, o = {}) {
  const ws = parts.map(p => measure(ctx, p.t, { ...o, ...p }));
  const total = ws.reduce((a, b) => a + b, 0);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  parts.forEach((p, i) => { text(ctx, p.t, cx, y, { ...o, ...p, align: 'left' }); cx += ws[i]; });
  return total;
}
export function wrap(ctx, str, maxW, o = {}) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(ctx, t, o) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// wrapped paragraph; returns height used
export function para(ctx, str, x, y, maxW, o = {}) {
  const lh = (o.lh || 1.4) * (o.size || 25);
  const lines = wrap(ctx, str, maxW, o);
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, o));
  return lines.length * lh;
}
// typed mono text with caret; p = 0..1 of characters revealed
export function typed(ctx, str, x, y, p, o = {}, frame = 0) {
  const n = Math.floor(str.length * clamp(p));
  const s = str.slice(0, n);
  text(ctx, s, x, y, o);
  const blink = p >= 1 ? (Math.floor(frame / 15) % 2 === 0) : true;
  if (blink && (o.caret ?? true)) {
    const w = measure(ctx, s, o);
    ctx.save();
    ctx.globalAlpha *= (o.alpha ?? 1);
    ctx.fillStyle = o.color || C.acc2;
    const sz = o.size || 25;
    ctx.fillRect(x + w + 4, y - sz * .8, sz * .5, sz * .95);
    ctx.restore();
  }
}

// ---------- shapes ----------
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
// Cards in the deck's "soft layer" styles.
export function card(ctx, x, y, w, h, o = {}) {
  const r = o.r ?? 27, style = o.style || 'plain';
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  // soft drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22;
  let fill = C.s1, stroke = C.ln;
  if (style === 'tint') { fill = C.s2; stroke = null; }
  if (style === 'ink') { fill = C.hi; stroke = 'rgba(143,185,255,0.26)'; ctx.shadowColor = 'rgba(111,166,255,0.45)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 30; }
  if (style === 'warm') { fill = C.al2; stroke = 'rgba(255,127,121,0.30)'; ctx.shadowColor = 'rgba(255,127,121,0.35)'; }
  if (style === 'ghost') { fill = 'rgba(0,0,0,0)'; stroke = '#4A5874'; ctx.shadowColor = 'transparent'; }
  if (style === 'gold') { fill = '#2A2416'; stroke = 'rgba(208,174,98,0.45)'; ctx.shadowColor = 'rgba(208,174,98,0.35)'; ctx.shadowBlur = 60; }
  if (o.fill) fill = o.fill;
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  ctx.shadowColor = 'transparent';
  // surface sheen
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (style === 'ink') { g.addColorStop(0, 'rgba(125,176,255,0.22)'); g.addColorStop(.65, 'rgba(111,166,255,0.06)'); g.addColorStop(1, 'rgba(111,166,255,0.03)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,0.035)'); g.addColorStop(1, 'rgba(255,255,255,0.008)'); }
  ctx.fillStyle = g; ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.5; ctx.strokeStyle = stroke;
    if (o.dashed) ctx.setLineDash([9, 7]);
    ctx.stroke();
  }
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, o = {}) {
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.strokeStyle = o.color || C.tx2; ctx.lineWidth = o.width || 3; ctx.lineCap = o.cap || 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  const p = o.p ?? 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p); ctx.stroke();
  ctx.restore();
}
// arrow drawn to progress p
export function arrow(ctx, x1, y1, x2, y2, o = {}) {
  const p = clamp(o.p ?? 1);
  if (p <= 0) return;
  const ex = x1 + (x2 - x1) * p, ey = y1 + (y2 - y1) * p;
  line(ctx, x1, y1, ex, ey, { ...o, p: 1, cap: 'butt' });
  const a = Math.atan2(y2 - y1, x2 - x1), hs = o.head || 16;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.fillStyle = o.color || C.tx2;
  ctx.translate(ex, ey); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-hs, -hs * .55); ctx.lineTo(-hs, hs * .55); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------- glyphs (the deck's actor symbols, 48×48 viewBox) ----------
const G = {
  agentHex: 'M24 10.5 35.7 17.25v13.5L24 37.5 12.3 30.75v-13.5z',
  agentSpokes: 'M24 10.5v5.5M35.7 30.75l-4.7-2.7M12.3 30.75l4.7-2.7',
  person: 'M30.6 18a6.6 6.6 0 1 1-13.2 0a6.6 6.6 0 1 1 13.2 0M11.5 37.5c0-7.1 5.5-11.6 12.5-11.6s12.5 4.5 12.5 11.6',
  youHead: 'M26.8 17.5a6.3 6.3 0 1 1-12.6 0a6.3 6.3 0 1 1 12.6 0M8.5 37c0-6.9 5.3-11.3 12-11.3 2.3 0 4.4.5 6.2 1.5',
  youShield: 'M34 26.2l6.2 2.3v4.8c0 3.7-2.7 6.1-6.2 7.3-3.5-1.2-6.2-3.6-6.2-7.3v-4.8z',
  board: 'M9.5 18.5 24 10.5l14.5 8zM14.5 22v10M21 22v10M27 22v10M33.5 22v10M9.5 36.5h29',
  supplier: 'M24 10.5 36 17v14l-12 6.5L12 31V17zM12 17l12 6.5L36 17M24 23.5v14',
  check: 'M15 24.5l6 6 12-13',
};
const P = {};
for (const k in G) P[k] = new Path2D(G[k]);

// path length via SVG DOM (browser only)
const lenCache = {};
export function pathLen(d) {
  if (lenCache[d]) return lenCache[d];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.setAttribute('d', d);
  return (lenCache[d] = svg.getTotalLength());
}

// draw a glyph centred at x,y with box size s (px). o.p = draw progress for strokes.
export function glyph(ctx, name, x, y, s, o = {}) {
  const k = s / 48, col = o.color || C.acc, p = o.p ?? 1;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.translate(x - s / 2, y - s / 2); ctx.scale(k, k);
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = o.lw || 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (key) => {
    if (p < 1) { const L = pathLen(G[key]); ctx.setLineDash([L * p, L + 1]); } else ctx.setLineDash([]);
    ctx.stroke(P[key]);
  };
  if (name === 'agent') {
    stroke('agentHex');
    const q = clamp((p - .55) / .45);
    if (q > 0) {
      ctx.save(); ctx.globalAlpha *= q; ctx.setLineDash([]);
      ctx.stroke(P.agentSpokes);
      ctx.beginPath(); ctx.arc(24, 24, 4.4 * (o.nucleus ?? 1), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } else if (name === 'you') {
    stroke('youHead');
    ctx.save(); ctx.globalAlpha *= .28 * p; ctx.fill(P.youShield); ctx.restore();
    stroke('youShield');
  } else stroke(name);
  ctx.restore();
}

// Round avatar badge (deck .av): tinted disc, coloured ring, glyph at 62%.
export const AV = {
  agent: C.acc, rogue: C.al, person: C.person, you: C.lav, board: C.gold, supplier: C.supplier, seat: '#7D8AA0',
};
export function avatar(ctx, kind, x, y, d, o = {}) {
  const col = o.color || AV[kind] || C.acc;
  const bgc = o.bg || C.bg;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  if (o.scale != null) { ctx.translate(x, y); ctx.scale(o.scale, o.scale); ctx.translate(-x, -y); }
  const bw = Math.max(1.5, d * 0.034);
  if (o.pulse != null && o.pulse > 0) { // expanding ring
    const q = o.pulse % 1;
    ctx.beginPath(); ctx.arc(x, y, d / 2 * (1 + .65 * q), 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, .75 * (1 - q)); ctx.lineWidth = bw; ctx.stroke();
  }
  if (o.glow) { ctx.shadowColor = rgba(col, .6 * o.glow); ctx.shadowBlur = d * .6; }
  ctx.beginPath(); ctx.arc(x, y, d / 2 - bw / 2, 0, Math.PI * 2);
  if (!o.dashed) { ctx.fillStyle = mix(bgc, col, .14); ctx.fill(); }
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(col, .75); ctx.lineWidth = bw;
  if (o.dashed) ctx.setLineDash([d * .09, d * .07]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (kind !== 'seat') glyph(ctx, kind === 'rogue' ? 'agent' : kind, x, y, d * .62, { color: col, p: o.p });
  ctx.restore();
}

// Monogram badge (cover credits)
export function mono(ctx, letters, x, y, d, col) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = rgba(col, .10); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, letters, x, y + 1, { font: 'mono', weight: 600, size: d * .33, color: col, align: 'center', baseline: 'middle', tracking: .04 });
  ctx.restore();
}

// Numbered disc (deck .mnum)
export function disc(ctx, n, x, y, d, o = {}) {
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= clamp(o.alpha);
  ctx.beginPath(); ctx.arc(x, y, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = o.fill || C.acc; ctx.fill();
  text(ctx, String(n), x, y + 1, { font: 'mono', weight: 600, size: d * .38, color: o.color || C.accd, align: 'center', baseline: 'middle' });
  ctx.restore();
}

// Mono eyebrow/label
export function label(ctx, str, x, y, o = {}) {
  text(ctx, str, x, y, { font: 'mono', weight: 500, size: T_LABEL, tracking: .16, color: C.acc2, upper: true, ...o });
}
const T_LABEL = 17;
