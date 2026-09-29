#!/usr/bin/env python3
"""Build the storyboard review page (storyboard/review/index.html) from STORYBOARD.md,
the timeline, and rendered keyframes. Frames/video are referenced as sibling files."""
import json, re, subprocess, sys, html
from pathlib import Path
import markdown

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'storyboard' / 'review'
md_src = (ROOT / 'storyboard' / 'STORYBOARD.md').read_text()

tl = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {SCENES,ACTS,TOTAL_FRAMES,FPS,tensionAt} from './src/timeline.js';
const built = ['S01','S02','S03'];
const curve = []; for (let i=0;i<=320;i++) curve.push(+tensionAt(TOTAL_FRAMES*i/320).toFixed(3));
console.log(JSON.stringify({fps:FPS,total:TOTAL_FRAMES,acts:ACTS.map(a=>({id:a.id,label:a.label})),
 scenes:SCENES.map(s=>({id:s.id,title:s.title,act:s.act,bars:s.bars,start:s.start,end:s.end,built:built.includes(s.id)})),curve}));
'''], cwd=ROOT))

# ---- markdown → html, split into sections by "## " ----
body = md_src.split('\n---\n', 1)[1]          # drop the title block; the hero replaces it
conv = markdown.Markdown(extensions=['tables', 'fenced_code', 'sane_lists'])
def md(s):
    # python-markdown needs a blank line before a list that follows a paragraph line
    s = re.sub(r'(?m)^(?!\s*[-*] |\s*\d+\. |\s*$|\|)(.+)\n(?=\s*(?:[-*]|\d+\.) )', r'\1\n\n', s)
    conv.reset(); return conv.convert(s)

sections = re.split(r'\n(?=## )', body.strip())
out_sections = []
for sec in sections:
    m = re.match(r'## (.+)\n', sec)
    if not m: continue
    title = m.group(1).strip()
    num = re.match(r'(\d+)\.\s*(.*)', title)
    sid = 's' + (num.group(1) if num else re.sub(r'\W+', '-', title.lower()))
    content = sec[m.end():]
    h = md(content)
    # colour chips next to hex codes
    h = re.sub(r'<code>(#[0-9A-Fa-f]{6})</code>', r'<code class="hex"><i style="background:\1"></i>\1</code>', h)
    # scene headings: "#### S01 · Cold open · 5 bars (0:00.0 – 0:13.3) · deck slides 1, cast"
    def scene_h(mm):
        parts = [p.strip() for p in mm.group(1).split('·')]
        sid_, name = parts[0], parts[1]
        meta = ' · '.join(parts[2:])
        pri = '<span class="pri">priority</span>' if '[PRIORITY]' in meta else ''
        meta = meta.replace('<strong>[PRIORITY]</strong>', '').replace('[PRIORITY]', '').strip(' ·')
        return (f'</div><div class="scene" id="{sid_.lower()}"><div class="sh"><span class="sid">{sid_}</span>'
                f'<h4>{name}</h4>{pri}</div><div class="smeta">{meta}</div>')
    h = re.sub(r'<h4>(S\d\d .+?)</h4>', scene_h, h)
    # act headings
    h = re.sub(r'<h3>(.+?)</h3>', lambda mm: f'</div><h3 class="act">{mm.group(1)}</h3><div>', h)
    h = h.replace('<table>', '<div class="tablewrap"><table>').replace('</table>', '</table></div>')
    h = f'<div>{h}</div>'
    h = h.replace('<div></div>', '')
    out_sections.append((sid, num.group(2) if num else title, h))

# Section 0 "The idea" is used as the lede
lede = out_sections[0][2]
rest = out_sections[1:]

nav = ''.join(f'<a href="#{sid}">{html.escape(t)}</a>' for sid, t, _ in rest)
secs = ''.join(f'<section id="{sid}" class="doc {"scenes" if "Scene" in t else ""}"><h2>{html.escape(t)}</h2>{h}</section>' for sid, t, h in rest)

FRAMES = [
    (60, 'S01 @3', 'Black. A single point breathes.'),
    (150, 'S01 @7.5', 'The point draws itself into the agent and receives a task.'),
    (235, 'S01 @11.7', 'It acts: decisions stream out, the counter climbs to 3,907.'),
    (340, 'S01 @17', 'Freeze. "It decided on its own." Acts in your name.'),
    (395, 'S01 @19.7', 'Morph: the line becomes the critical path.'),
    (560, 'S02 @8', 'Title. The coral Crisis node pulses.'),
    (860, 'S03 @7', 'The storyline: the film\'s real tension curve.'),
    (1060, 'S03 @17', 'Four questions. The fourth has no answer yet.'),
    (1110, 'S03 → S04', 'T1 path travel to the Stakes node.'),
]
frames_html = ''.join(
    f'<figure><img src="frames/f{f:05d}.jpg" alt="{html.escape(c)}" loading="lazy" width="1280" height="720">'
    f'<figcaption><b>{t}</b> {html.escape(c)}</figcaption></figure>' for f, t, c in FRAMES)

page = (ROOT / 'tools' / 'review_template.html').read_text()
page = (page.replace('{{LEDE}}', lede).replace('{{NAV}}', nav).replace('{{SECTIONS}}', secs)
            .replace('{{FRAMES}}', frames_html).replace('{{TIMELINE}}', json.dumps(tl)))
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'index.html').write_text(page)
print('wrote', OUT / 'index.html', len(page), 'bytes;', 'frames:', ','.join(str(f) for f, _, _ in FRAMES))
