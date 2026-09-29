// Stand-in for scenes not yet built: keeps the full timeline playable in preview.
import { C } from '../lib/theme.js';
import { text, card } from '../lib/draw.js';
import { deck, prog } from '../lib/ease.js';

export function placeholder(scene) {
  return {
    cues: [],
    draw(ctx, S) {
      const p = deck(prog(S.b, 0, 1.2));
      card(ctx, 360, 380, 1200, 320, { style: 'ghost', dashed: true, alpha: p });
      text(ctx, scene.id, 960, 480, { font: 'mono', weight: 500, size: 22, tracking: .2, color: C.acc2, align: 'center', alpha: p });
      text(ctx, scene.title, 960, 560, { font: 'disp', weight: 600, size: 56, tracking: -.02, color: C.tx, align: 'center', alpha: p });
      text(ctx, `${scene.bars} bars · not built yet (see storyboard §3)`, 960, 624, { font: 'mono', weight: 400, size: 20, color: C.mut, align: 'center', alpha: p });
    },
  };
}
