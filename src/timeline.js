// Single source of truth for picture and sound.
// 90 BPM at 30 fps => 1 beat = 20 frames, 1 bar = 80 frames.

export const W = 1920, H = 1080;
export const FPS = 30;
export const BPM = 90;
export const BEAT = FPS * 60 / BPM;   // 20 frames
export const BAR = BEAT * 4;          // 80 frames
export const SEC_PER_BEAT = 60 / BPM;

export const ACTS = [
  { id: 'hook',   label: 'HOOK',        part: 0, eyebrow: '' },
  { id: 'stakes', label: 'STAKES',      part: 1, eyebrow: 'PART 1 · WHAT IS ACTUALLY HAPPENING' },
  { id: 'shift',  label: 'SHIFT',       part: 2, eyebrow: 'PART 2 · WHAT HAS CHANGED' },
  { id: 'crisis', label: 'CRISIS',      part: 3, eyebrow: 'PART 3 · WHAT WENT WRONG' },
  { id: 'turn',   label: 'TURN',        part: 0, eyebrow: 'WHERE WE ARE' },
  { id: 'answer', label: 'ANSWER',      part: 4, eyebrow: 'PART 4 · WHAT TO DO ABOUT IT' },
  { id: 'call',   label: 'CALL TO ACT', part: 0, eyebrow: 'WHAT YOU LEAVE WITH' },
];

// exit: transition out of this scene. 'T1' path travel, 'T2' beat cut, 'T3' morph, 'T4' glitch, 'T5' blackout
export const SCENES = [
  { id: 'S01', title: 'Cold open',              act: 'hook',   bars: 5, exit: 'T3', tension: 0.10 },
  { id: 'S02', title: 'Title',                  act: 'hook',   bars: 4, exit: 'T3' },
  { id: 'S03', title: 'The map',                act: 'hook',   bars: 5, exit: 'T1' },
  { id: 'S04', title: 'Two conversations',      act: 'stakes', bars: 5, exit: 'T2', tension: 0.25 },
  { id: 'S05', title: 'From suggesting to acting', act: 'stakes', bars: 6, exit: 'T2' },
  { id: 'S06', title: 'Three doors',            act: 'stakes', bars: 5, exit: 'T2' },
  { id: 'S07', title: 'It is everywhere',       act: 'stakes', bars: 5, exit: 'T1' },
  { id: 'S08', title: 'Same question, same answer?', act: 'shift', bars: 6, exit: 'T2', tension: 0.45 },
  { id: 'S09', title: 'The watching goes',      act: 'shift',  bars: 5, exit: 'T2' },
  { id: 'S10', title: 'The silent failure',     act: 'shift',  bars: 6, exit: 'T1' },
  { id: 'S11', title: 'Four ways it breaks',    act: 'crisis', bars: 4, exit: 'T4', tension: 0.65 },
  { id: 'S12', title: 'July 2026',              act: 'crisis', bars: 8, exit: 'T4', tension: 0.80 },
  { id: 'S13', title: 'Four things it proved',  act: 'crisis', bars: 4, exit: 'T4' },
  { id: 'S14', title: 'Australia',              act: 'crisis', bars: 5, exit: 'T4' },
  { id: 'S15', title: 'The gap',                act: 'crisis', bars: 6, exit: 'T5', tension: 1.0 },
  { id: 'S16', title: 'Three answered, one open', act: 'turn', bars: 4, exit: 'T1', tension: 0.15 },
  { id: 'S17', title: 'Could you stop it?',     act: 'answer', bars: 4, exit: 'T2', tension: 0.30 },
  { id: 'S18', title: 'What, not how',          act: 'answer', bars: 5, exit: 'T2' },
  { id: 'S19', title: 'Human in the loop',      act: 'answer', bars: 5, exit: 'T2' },
  { id: 'S20', title: 'Eight concepts',         act: 'answer', bars: 4, exit: 'T2' },
  { id: 'S21', title: 'The path mends',         act: 'answer', bars: 6, exit: 'T1', tension: 0.40 },
  { id: 'S22', title: 'Five board questions',   act: 'call',   bars: 7, exit: 'T2', tension: 0.25 },
  { id: 'S23', title: 'Three places to start',  act: 'call',   bars: 5, exit: 'T2' },
  { id: 'S24', title: 'The question',           act: 'call',   bars: 5, exit: 'T2' },
  { id: 'S25', title: 'End card',               act: 'call',   bars: 4, exit: null, tension: 0.05 },
];

let acc = 0;
for (const s of SCENES) {
  s.start = acc;
  s.frames = s.bars * BAR;
  s.end = acc + s.frames;
  s.startBar = acc / BAR;
  s.actIndex = ACTS.findIndex(a => a.id === s.act);
  acc = s.end;
}
export const TOTAL_FRAMES = acc;
export const TOTAL_BARS = acc / BAR;

export function sceneAt(frame) {
  for (const s of SCENES) if (frame < s.end) return s;
  return SCENES[SCENES.length - 1];
}

// Tension keyframes (scene-start anchored). Rises ease across the whole span;
// drops hold until the scene boundary, then fall fast (1 beat for the Turn, 1 bar otherwise).
const TK = [];
{
  const raw = SCENES.filter(s => s.tension != null).map(s => [s.start, s.tension]);
  raw.push([TOTAL_FRAMES, 0.05]);
  for (let i = 0; i < raw.length; i++) {
    const [f, v] = raw[i], prev = TK[TK.length - 1];
    if (prev && v < prev[1] && i < raw.length - 1) {
      TK.push([f, prev[1]]);
      TK.push([f + (prev[1] - v > 0.5 ? BEAT : BAR), v]);
    } else TK.push([f, v]);
  }
}
export function tensionAt(frame) {
  if (frame <= TK[0][0]) return TK[0][1];
  for (let i = 0; i < TK.length - 1; i++) {
    const [f0, v0] = TK[i], [f1, v1] = TK[i + 1];
    if (frame < f1) {
      const k = (frame - f0) / Math.max(1, f1 - f0);
      return v0 + (v1 - v0) * k * k * (3 - 2 * k);
    }
  }
  return TK[TK.length - 1][1];
}

export const fmtTime = f => {
  const s = f / FPS, m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};
