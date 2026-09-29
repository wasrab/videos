# AI in the Critical Path — video

A ~5:40 explainer film built from the *AI in the Critical Path* deck. Picture and sound are both generated from code:

- **Picture:** Canvas 2D scenes composited through a WebGL 2 post pass (bloom, tension grade, chromatic aberration, glitch, vignette, grain), rendered deterministically frame by frame.
- **Sound:** a generative score and SFX palette synthesized with Web Audio `OfflineAudioContext`. It is driven by the same timeline as the picture, so the two stay in sync.

**Start with [`storyboard/STORYBOARD.md`](storyboard/STORYBOARD.md).** It holds every design decision, scene, transition and sound cue.

## Status
| | |
|---|---|
| Storyboard | v0.1, for review |
| Engine (timeline, post, audio, exporter) | working |
| Scenes built | S01 Cold open · S02 Title · S03 The map |
| Scenes pending | S04–S25 (placeholder cards in preview) |

## Layout
```
src/
  timeline.js      single source of truth: fps, BPM, scenes in bars, acts, tension curve
  engine.js        background, transitions (T1–T5), HUD, scene dispatch
  post.js          WebGL 2 post-processing
  scenes/          one module per scene: draw(ctx, S) + cues[] (sound events)
  audio/           synth primitives, SFX palette, generative music, offline mixdown
  lib/             easing, seeded RNG, theme tokens, drawing primitives
  index.html       preview player (scrubber, scene list, synced audio)
tools/
  render.mjs       Playwright + headless Chromium → PNG frames → ffmpeg (x264) + WAV → AAC mux
  build_review_page.py   storyboard review page (storyboard/review/)
assets/fonts/      Bricolage Grotesque, Geist, Geist Mono (SIL OFL), vendored for offline renders
```

## Run
```bash
# interactive preview
npx http-server -c-1 -p 8080 .    # open http://localhost:8080/src/index.html

# stills
node tools/render.mjs --stills 0,340,560 --dir out/stills

# a range, with audio
node tools/render.mjs --from 0 --to 1180 --out out/preview-opening.mp4

# the whole film (4 parallel chunk renders, then audio + mux)
node tools/render.mjs --jobs 4 --out out/ai-in-the-critical-path.mp4
```
The exporter uses `ffmpeg` from `$FFMPEG`, falling back to `imageio-ffmpeg` (`pip install imageio-ffmpeg`), then to `ffmpeg` on `PATH`.

## Determinism
Every frame and every note is a pure function of the frame number. Randomness comes from a seeded PRNG keyed by name, and there are no wall-clock reads in the render path. Re-rendering any frame range reproduces it exactly, so the film can be rendered in parallel chunks and concatenated.
