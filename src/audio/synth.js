// Synth primitives for OfflineAudioContext. No samples: everything is oscillators, seeded noise and filters.
import { mulberry32, hash } from '../lib/rng.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function hz(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  let s = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (+m[3] + 1) * 12 + s;
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export const semis = (f, s) => f * Math.pow(2, s / 12);

const noiseCache = new WeakMap();
export function noiseBuffer(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0), r = mulberry32(hash('noise'));
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}
export function noise(ctx, t, dur, offset = 0) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx); s.loop = true;
  s.start(t, offset % 2.5); s.stop(t + dur + .05);
  return s;
}
// algorithmic reverb impulse (stereo decaying noise, darker tail)
export function reverbIR(ctx, secs = 3.2, decay = 2.6) {
  const len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch), r = mulberry32(hash('ir', ch));
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = .25 + .7 * t;               // tail gets darker
      lp += (r() * 2 - 1 - lp) * (1 - k);
      d[i] = lp * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}
export function gainNode(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
// ADSR-ish envelope on a GainParam
export function env(param, t, { a = .005, peak = 1, d = .2, s = 0, r = .1, hold = 0 }) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  if (s > 0) {
    param.setTargetAtTime(peak * s, t + a, d / 3);
    param.setValueAtTime(peak * s, t + a + hold);
    param.setTargetAtTime(0, t + a + hold, r / 4);
  } else {
    param.setTargetAtTime(0, t + a, d / 4);
  }
}

// FM voice: carrier + modulator with decaying index. Used for plucks and bells.
export function fm(ctx, dest, t, f, o = {}) {
  const ratio = o.ratio ?? 2, idx = o.index ?? 3, dur = o.dur ?? .6, vel = o.vel ?? .2;
  const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), amp = ctx.createGain();
  car.frequency.value = f; mod.frequency.value = f * ratio;
  if (o.detune) { car.detune.value = o.detune; }
  mg.gain.setValueAtTime(f * idx, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(1, f * idx * .02), t + dur * (o.brightDecay ?? .6));
  mod.connect(mg); mg.connect(car.frequency);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel, t + (o.attack ?? .004));
  amp.gain.setTargetAtTime(0, t + (o.attack ?? .004), dur / 4);
  car.connect(amp);
  let out = amp;
  if (o.pan != null) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; amp.connect(p); out = p; }
  out.connect(dest);
  car.start(t); mod.start(t); car.stop(t + dur * 1.6 + .1); mod.stop(t + dur * 1.6 + .1);
}
