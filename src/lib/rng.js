// Deterministic PRNG (mulberry32) + string hashing, so every frame and every note is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(...parts) {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const rng = (...parts) => mulberry32(hash(...parts));
// stateless: a value in [0,1) for a key
export const rand = (...parts) => mulberry32(hash(...parts))();
