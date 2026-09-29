// SFX palette (storyboard §2.3). Each fn(ctx, dest, t, cue) schedules one sound at time t (seconds).
import { hz, semis, noise, fm, gainNode } from './synth.js';
import { rand } from '../lib/rng.js';
import { SEC_PER_BEAT } from '../timeline.js';

function bp(ctx, f, q) { const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q; return b; }

export const SFX = {
  tick(ctx, dest, t, c) {
    const n = noise(ctx, t, .02, rand('tick', t) * 2), f = bp(ctx, 4200 + 800 * rand('tk', t), 2.2), g = gainNode(ctx, 0);
    g.gain.setValueAtTime(.0, t); g.gain.linearRampToValueAtTime(.32 * (c.vel ?? 1), t + .001); g.gain.exponentialRampToValueAtTime(.001, t + .018);
    n.connect(f); f.connect(g); g.connect(dest);
  },
  blip(ctx, dest, t, c) {
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(880, t + .06);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.12, t + .003); g.gain.exponentialRampToValueAtTime(.001, t + .25);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .3);
  },
  pop(ctx, dest, t, c) {
    const v = c.soft ? .12 : .22;
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    const f0 = c.note ? hz(c.note) : 880;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 / 2, t + .09);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .002); g.gain.exponentialRampToValueAtTime(.001, t + .16);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + .2);
    SFX.tick(ctx, dest, t, { vel: .5 });
  },
  draw(ctx, dest, t, c) {
    const dur = (c.dur ?? 1) * SEC_PER_BEAT;
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + dur * .3); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
    const n = noise(ctx, t, dur, rand('dr', t) * 2), f = bp(ctx, 800, 3), ng = gainNode(ctx, 0);
    f.frequency.setValueAtTime(800, t); f.frequency.exponentialRampToValueAtTime(2600, t + dur);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(.05, t + dur * .5); ng.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f); f.connect(ng); ng.connect(dest);
  },
  whoosh(ctx, dest, t, c) {
    const dur = (c.dur ?? 2) * SEC_PER_BEAT, v = c.soft ? .16 : .32;
    const n = noise(ctx, t, dur, rand('wh', t) * 2), f = bp(ctx, 300, 1.3), g = gainNode(ctx, 0), p = ctx.createStereoPanner();
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur * .55); f.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
    p.pan.setValueAtTime(-.7, t); p.pan.linearRampToValueAtTime(.7, t + dur);
    n.connect(f); f.connect(g); g.connect(p); p.connect(dest);
  },
  count(ctx, dest, t, c) {
    const dur = (c.dur ?? 2) * SEC_PER_BEAT, n = c.n ?? 34;
    for (let i = 0; i < n; i++) {
      const u = i / n, tt = t + dur * (c.accel ? Math.sqrt(u) : u);
      const o = ctx.createOscillator(), g = gainNode(ctx, 0);
      o.frequency.value = semis(1046.5, Math.floor(i / 4));
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.045, tt + .002); g.gain.exponentialRampToValueAtTime(.001, tt + .035);
      o.connect(g); g.connect(dest); o.start(tt); o.stop(tt + .05);
    }
  },
  pulse(ctx, dest, t) { // the coral node: a low, warm thump with a slow bloom
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    o.frequency.setValueAtTime(hz('D3'), t); o.frequency.exponentialRampToValueAtTime(hz('D2'), t + .5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.28, t + .01); g.gain.setTargetAtTime(0, t + .01, .25);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 1.5);
    fm(ctx, dest, t, hz('Eb5'), { ratio: 1.41, index: 1.2, dur: 2.2, vel: .045 });
  },
  bell(ctx, dest, t, c) {
    const f = hz(c.note || 'D5'), v = (c.vel ?? .7) * .16;
    fm(ctx, dest, t, f, { ratio: 3.5, index: 2.2, dur: 3.2, vel: v, brightDecay: .5, pan: c.pan ?? (rand('bp', t) - .5) * .5 });
    fm(ctx, dest, t, f * 2, { ratio: 1.0, index: .4, dur: 1.4, vel: v * .25 });
  },
  same(ctx, dest, t) { fm(ctx, dest, t, hz('A5'), { ratio: 4, index: .8, dur: .7, vel: .16 }); },
  differ(ctx, dest, t, c) {
    const f = hz(['A5', 'C#6', 'F5'][c.i ?? 0]);
    fm(ctx, dest, t, f, { ratio: 4, index: .8, dur: .7, vel: .16, detune: (rand('df', c.i) - .5) * 60 });
    SFX.glitch(ctx, dest, t + .03, { short: true });
  },
  glitch(ctx, dest, t, c) {
    const dur = c.short ? .06 : .12;
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    o.type = 'square';
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(200 + 1800 * rand('gl', t, i), t + dur * i / 6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .003); g.gain.setValueAtTime(.06, t + dur - .01); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .02);
  },
  dissolve(ctx, dest, t, c) {
    const dur = (c.dur ?? 2) * SEC_PER_BEAT;
    for (let i = 0; i < 5; i++) fm(ctx, dest, t + i * .06, semis(hz('A5'), [0, 3, 7, 10, 14][i]), { ratio: 2, index: .3, dur: dur, vel: .025, attack: dur * .6 });
    const n = noise(ctx, t, dur), f = bp(ctx, 6000, 1), g = gainNode(ctx, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f); f.connect(g); g.connect(dest);
  },
  alarm(ctx, dest, t) {
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator(), g = gainNode(ctx, 0), tt = t + i * .22;
      o.type = 'triangle'; o.frequency.value = hz(i % 2 ? 'F5' : 'A5');
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.07, tt + .01); g.gain.setValueAtTime(.07, tt + .18); g.gain.linearRampToValueAtTime(0, tt + .2);
      o.connect(g); g.connect(dest); o.start(tt); o.stop(tt + .22);
    }
  },
  impact(ctx, dest, t, c) {
    const v = c.soft ? .5 : 1;
    const o = ctx.createOscillator(), g = gainNode(ctx, 0);
    o.frequency.setValueAtTime(62, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.55 * v, t + .008); g.gain.setTargetAtTime(0, t + .01, .45);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 2.5);
    const n = noise(ctx, t, .4), lp = ctx.createBiquadFilter(), ng = gainNode(ctx, 0);
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    ng.gain.setValueAtTime(.25 * v, t); ng.gain.exponentialRampToValueAtTime(.001, t + .35);
    n.connect(lp); lp.connect(ng); ng.connect(dest);
  },
  riser(ctx, dest, t, c) {
    const dur = (c.dur ?? 4) * SEC_PER_BEAT;
    const n = noise(ctx, t, dur), f = bp(ctx, 400, 1.5), g = gainNode(ctx, 0);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.14, t + dur * .95); g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(f); f.connect(g); g.connect(dest);
    const o = ctx.createOscillator(), og = gainNode(ctx, 0);
    o.frequency.setValueAtTime(hz('D3'), t); o.frequency.exponentialRampToValueAtTime(hz('D5'), t + dur);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(.04, t + dur * .95); og.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(og); og.connect(dest); o.start(t); o.stop(t + dur + .05);
  },
};
