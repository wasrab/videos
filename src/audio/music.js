// Generative score (storyboard §2.1–2.2). Reads the same timeline as the picture.
import { BAR, BEAT, FPS, SCENES, TOTAL_FRAMES, sceneAt, tensionAt } from '../timeline.js';
import { hz, semis, fm, gainNode } from './synth.js';
import { mulberry32, hash } from '../lib/rng.js';

const ch = (r, v) => ({ r, v });
const Dm = ch('D2', ['A3', 'D4', 'F4']), Bb = ch('Bb1', ['Bb3', 'D4', 'F4']), F = ch('F2', ['A3', 'C4', 'F4']);
const Cc = ch('C2', ['G3', 'C4', 'E4']), Gm = ch('G1', ['Bb3', 'D4', 'G4']), A = ch('A1', ['A3', 'C#4', 'E4']);
const Eb = ch('Eb2', ['Bb3', 'Eb4', 'G4']), Csd = ch('C#2', ['G3', 'C#4', 'E4']);
const Dm9 = ch('D2', ['A3', 'E4', 'F4']), Bbm7 = ch('Bb1', ['A3', 'D4', 'F4']);
const Fm79 = ch('F2', ['A3', 'E4', 'G4']), DM = ch('D2', ['A3', 'D4', 'F#4']);

// deterministic: the arp pattern repeats identically every bar (Acts 0–I, IV–V).
// Acts II–III re-seed every bar: same chord, never the same melody twice.
export const ACT_MUSIC = {
  hook:   { prog: [Dm9, Bbm7], det: true },
  stakes: { prog: [Dm, Bb, F, Cc], det: true },
  shift:  { prog: [Dm, Bb, Gm, A], det: false },
  crisis: { prog: [Dm, Eb, Dm, Csd], det: false },
  turn:   { prog: [null, Fm79, Fm79, Fm79], det: true },
  answer: { prog: [Bb, F, Cc, Dm], det: true },
  call:   { prog: [Bb, Cc, Dm, Dm], det: true },
};

const byId = id => SCENES.find(s => s.id === id);
function chordAt(bar) {
  const f = bar * BAR, sc = sceneAt(f), am = ACT_MUSIC[sc.act];
  const actStart = SCENES.find(s => s.act === sc.act).startBar;
  if (bar >= TOTAL_FRAMES / BAR - 2) return DM;                // Picardy ending
  return am.prog[(bar - actStart) % am.prog.length];
}

// Euclidean rhythm E(k, n)
function euclid(k, n, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(((i + rot) * k) % n < k ? 1 : 0);
  return out;
}

export function scheduleMusic(ctx, bus, f0, f1) {
  const toT = f => (f - f0) / FPS;
  const barSec = BAR / FPS;
  const b0 = Math.max(0, Math.floor(f0 / BAR) - 1), b1 = Math.ceil(f1 / BAR);
  const s03 = byId('S03'), s15 = byId('S15'), s14 = byId('S14'), s10 = byId('S10');
  const heartOff = s15.start + 12 * BEAT;

  for (let bar = b0; bar < b1; bar++) {
    const fb = bar * BAR, t = toT(fb), sc = sceneAt(fb), am = ACT_MUSIC[sc.act];
    const tension = tensionAt(fb + BAR / 2);
    const chord = chordAt(bar);
    if (!chord) continue;                                         // the Turn's silent bar
    // S01 fades the pad in over its first bars
    const intro = bar < 4 ? [.25, .5, .75, .95][bar] : 1;
    const end = t + barSec;

    // ---- pad: 2 detuned saws per voice → low-pass following tension ----
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .6;
    lp.frequency.setValueAtTime(500 + 2600 * Math.pow(tension, 1.2), t);
    const pg = gainNode(ctx, 0);
    pg.gain.setValueAtTime(0, t);
    pg.gain.linearRampToValueAtTime(.042 * intro, t + .9);
    pg.gain.setValueAtTime(.042 * intro, end);
    pg.gain.linearRampToValueAtTime(0, end + 1.6);
    lp.connect(pg); pg.connect(bus.pad);
    for (const n of chord.v) for (const det of [-7, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = hz(n); o.detune.value = det + (hash(bar, n, det) % 5) - 2;
      o.connect(lp); o.start(t); o.stop(end + 1.7);
    }
    // ---- sub ----
    const so = ctx.createOscillator(), sg = gainNode(ctx, 0);
    so.frequency.value = hz(chord.r) * 2;
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(.045 * intro, t + .6);
    sg.gain.setValueAtTime(.045 * intro, end); sg.gain.linearRampToValueAtTime(0, end + .8);
    so.connect(sg); sg.connect(bus.pad); so.start(t); so.stop(end + .9);

    // ---- pulse arp (from S03; muted in the Turn and during S10's silent bar) ----
    const muteArp = fb < s03.start || sc.act === 'turn' || (fb >= s10.start + 8 * BEAT && fb < s10.start + 12 * BEAT);
    if (!muteArp) {
      const steps = tension > .6 ? 16 : 8;
      const k = steps === 8 ? 3 + Math.round(tension * 4) : 7 + Math.round((tension - .6) * 10);
      const mask = euclid(k, steps, 1);
      const r = mulberry32(am.det ? hash('arp', sc.act) : hash('arp', sc.act, bar));
      const pool = [...chord.v.map(hz), ...chord.v.map(n => hz(n) * 2)].sort((a, b) => a - b);
      const vel = (sc.act === 'call' ? .05 : .075) * (fb < s03.start + BAR ? .5 : 1);
      for (let i = 0; i < steps; i++) {
        const note = pool[Math.floor(r() * pool.length)], acc = r();
        if (!mask[i]) continue;
        const tt = t + barSec * i / steps;
        fm(ctx, bus.arp, tt, note, { ratio: 2, index: 1.4 + tension, dur: .5, vel: vel * (i === 0 ? 1.25 : .8 + .3 * acc), pan: i % 2 ? .3 : -.3 });
      }
    }
    // ---- heartbeat (Crisis) ----
    if (sc.act === 'crisis' && fb < heartOff) {
      for (const [bt, v] of [[0, 1], [1.5, .6]]) {
        const tt = t + bt * BEAT / FPS;
        const o = ctx.createOscillator(), g = gainNode(ctx, 0);
        o.frequency.setValueAtTime(110, tt); o.frequency.exponentialRampToValueAtTime(42, tt + .12);
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.5 * v, tt + .004); g.gain.exponentialRampToValueAtTime(.001, tt + .38);
        o.connect(g); g.connect(bus.drums); o.start(tt); o.stop(tt + .4);
      }
    }
    // ---- clock ticks (S14, "84 days") ----
    if (fb >= s14.start && fb < s14.end) {
      for (let i = 0; i < 16; i++) {
        const tt = t + barSec * i / 16;
        const o = ctx.createOscillator(), g = gainNode(ctx, 0);
        o.type = 'square'; o.frequency.value = i % 4 === 0 ? 3200 : 2400;
        g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(i % 4 === 0 ? .02 : .01, tt + .001); g.gain.exponentialRampToValueAtTime(.0005, tt + .02);
        o.connect(g); g.connect(bus.drums); o.start(tt); o.stop(tt + .03);
      }
    }
  }
}
