export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };

// CSS cubic-bezier solver (x -> y), used for the deck's signature ease.
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    x = clamp(x);
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x, d = dx(t);
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(clamp(t));
  };
}

export const deck = bezier(.16, .84, .24, 1);        // --ease in the source deck
export const inOut = bezier(.65, 0, .35, 1);
export const outQuart = t => 1 - Math.pow(1 - clamp(t), 4);
export const inQuad = t => clamp(t) ** 2;
export const outBack = t => { t = clamp(t); const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
// deck "pop": .55 -> 1.08 at 65% -> 1
export const pop = t => {
  t = clamp(t);
  if (t < .65) return lerp(.55, 1.08, deck(t / .65));
  return lerp(1.08, 1, inOut((t - .65) / .35));
};

// progress of an animation that starts at beat `start` and lasts `dur` beats
export const prog = (b, start, dur = 1.2) => clamp((b - start) / dur);
