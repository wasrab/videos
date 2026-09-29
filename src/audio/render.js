// Offline mixdown: music + every scene cue, in sync with the picture, rendered to an AudioBuffer.
import { FPS, BEAT, SCENES, TOTAL_FRAMES } from '../timeline.js';
import { SCENE_MODULES } from '../scenes/index.js';
import { SFX } from './sfx.js';
import { scheduleMusic } from './music.js';
import { reverbIR, gainNode } from './synth.js';

export const SR = 48000;

// All sound cues as absolute frames (scene cues + automatic transition sounds)
export function allCues() {
  const out = [];
  SCENES.forEach((s, i) => {
    for (const c of SCENE_MODULES[s.id].cues || []) out.push({ ...c, frame: s.start + c.b * BEAT, scene: s.id });
    if (s.exit === 'T1') out.push({ sfx: 'whoosh', dur: 4, frame: s.end - 2 * BEAT, scene: s.id });
    if (s.exit === 'T4') out.push({ sfx: 'glitch', frame: s.end - 4, scene: s.id });
  });
  return out.sort((a, b) => a.frame - b.frame);
}

export async function renderAudio(f0 = 0, f1 = TOTAL_FRAMES) {
  const dur = (f1 - f0) / FPS;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * SR), SR);

  // master chain: glue compressor → limiter
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.ratio.value = 2.5; glue.attack.value = .02; glue.release.value = .3; glue.knee.value = 8;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08; lim.knee.value = 0;
  const MASTER = .9;                                       // ≈ -16 LUFS integrated
  const master = gainNode(ctx, MASTER);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = .7;
  hp.connect(glue); glue.connect(lim); lim.connect(master); master.connect(ctx.destination);

  const verb = ctx.createConvolver(); verb.buffer = reverbIR(ctx); verb.normalize = true;
  const verbRet = gainNode(ctx, .55); verb.connect(verbRet); verbRet.connect(hp);

  const duck = gainNode(ctx, 1); duck.connect(hp);
  const mk = (dest, v, send) => { const g = gainNode(ctx, v); g.connect(dest); if (send) { const s = gainNode(ctx, send); g.connect(s); s.connect(verb); } return g; };
  const bus = {
    pad: mk(duck, 1, .45),
    arp: mk(duck, .9, .35),
    drums: mk(duck, 1, .08),
  };
  const sfxBus = mk(hp, 1, .22);

  scheduleMusic(ctx, bus, f0, f1);

  for (const c of allCues()) {
    if (c.frame < f0 || c.frame >= f1) continue;
    const t = (c.frame - f0) / FPS;
    const fn = SFX[c.sfx];
    if (!fn) { console.warn('unknown sfx', c.sfx); continue; }
    fn(ctx, sfxBus, t, c);
    if (c.sfx !== 'tick' && c.sfx !== 'count') {           // side-chain duck the music under SFX
      duck.gain.setTargetAtTime(.72, t, .01);
      duck.gain.setTargetAtTime(1, t + .15, .18);
    }
  }
  // fades at the edges of a partial render
  master.gain.setValueAtTime(0, 0);
  master.gain.linearRampToValueAtTime(MASTER, .02);
  master.gain.setValueAtTime(MASTER, Math.max(.03, dur - .6));
  master.gain.linearRampToValueAtTime(0, dur);

  return ctx.startRendering();
}

export function encodeWav(buf) {
  const n = buf.length, chs = buf.numberOfChannels, out = new ArrayBuffer(44 + n * chs * 2), v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * chs * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chs, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * chs * 2, true);
  v.setUint16(32, chs * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * chs * 2, true);
  const data = [...Array(chs)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < chs; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
  }
  return out;
}
