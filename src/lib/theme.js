// Palette and type, carried over from the source deck (see storyboard §1.2–1.3).
export const C = {
  stage: '#05080E', bg: '#101729', bgDark: '#090D17',
  s1: '#161F33', s2: '#1B2742', ln: 'rgba(165,185,220,0.10)', ln2: '#34425C',
  tx: '#EDF1F7', tx2: '#B2BCCB', mut: '#7D8AA0', dim: '#56637A',
  acc: '#6FA6FF', acc2: '#8FB9FF', accd: '#0A0F1A',
  hi: '#1E3055', hiTx: '#F2F6FC', hiAcc: '#A9CBFF', hiMut: '#A9B8CF',
  al: '#FF7F79', al2: '#2F1B26', alTx: '#FFC4C0',
  lav: '#B79CFF', gold: '#D0AE62', person: '#DCE4EF', supplier: '#9DAAC0',
  node: '#3E4B63', path: '#33405A',
};

export const F = {
  disp: '"Bricolage Grotesque"',
  sans: '"Geist"',
  mono: '"Geist Mono"',
};

// Type scale at 1080p (deck 720p × 1.5)
export const T = {
  hero: 156, title: 63, stmt: 34, body: 25, small: 22, label: 17,
};

export const FONT_FILES = [
  ['Bricolage Grotesque', 'bricolage-latin.woff2', '400 800'],
  ['Bricolage Grotesque', 'bricolage-latinext.woff2', '400 800'],
  ['Geist', 'geist-latin.woff2', '300 700'],
  ['Geist', 'geist-latinext.woff2', '300 700'],
  ['Geist Mono', 'geistmono-latin.woff2', '400 600'],
  ['Geist Mono', 'geistmono-latinext.woff2', '400 600'],
];

// hex -> rgba string
export function rgba(hex, a = 1) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(hexA, hexB, t) {
  const pa = parseInt(hexA.slice(1), 16), pb = parseInt(hexB.slice(1), 16);
  const ch = (p, s) => (p >> s) & 255;
  const m = s => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}
