#!/usr/bin/env node
// Check and preview the stick-figure animations in public/poses.
//
//   node scripts/poses.mjs                     validate every pose (exit 1 on any problem)
//   node scripts/poses.mjs squat lunge         validate just these
//   node scripts/poses.mjs --sheet out.html [keys…]
//       a contact sheet: every keyframe of every pose plus the midpoint between
//       keyframes, as static SVG. Look at it — the validator proves the figure is
//       connected and inside its joint limits, not that it looks like the exercise.
//       firefox --headless --window-size 1600,4000 --screenshot out.png file://$PWD/out.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const SF = require('../public/stick-figure.js');
const dir = join(here, '..', 'public', 'poses');

const args = process.argv.slice(2);
const sheetAt = args.indexOf('--sheet');
const sheet = sheetAt >= 0 ? args.splice(sheetAt, 2)[1] : null;
const keys = args.length ? args : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();

let bad = 0;
const cells = [];
for (const key of keys) {
  let data;
  try { data = JSON.parse(readFileSync(join(dir, key + '.json'), 'utf8')); } catch (e) { console.log(`✗ ${key}: ${e.message}`); bad++; continue; }
  const errs = SF.validate(data);
  if (errs.length) { bad++; console.log(`✗ ${key}\n    ${errs.join('\n    ')}`); } else if (!sheet) console.log(`✓ ${key}`);
  if (sheet && data.version === 2 && data.frames?.length) {
    const frames = SF.resolveFrames(data);
    const imgs = [];
    frames.forEach((fr, i) => {
      imgs.push(`<figure>${SF.svgFor(data, i)}<figcaption>${i}${fr.label ? ' ' + fr.label : ''}</figcaption></figure>`);
      imgs.push(`<figure class="mid">${SF.svgFor(data, i, 0.5)}<figcaption>${i}½</figcaption></figure>`);
    });
    cells.push(`<section${errs.length ? ' class="bad"' : ''}><h2>${key} — ${data.title || ''} <small>${data.view || 'side'}${errs.length ? ' · ' + errs.length + ' problem(s)' : ''}</small></h2><div>${imgs.join('')}</div></section>`);
  }
}

if (sheet) {
  writeFileSync(sheet, `<!doctype html><meta charset="utf-8"><style>
body{background:#16161e;color:#ccc;font:13px system-ui;margin:12px}
section{display:inline-block;vertical-align:top;margin:0 14px 14px 0;padding:6px;border:1px solid #333;border-radius:6px}
section.bad{border-color:#e74c3c}
h2{font-size:13px;margin:0 0 4px}small{color:#888}
figure{display:inline-block;margin:0 2px;text-align:center}figure.mid{opacity:.55}
svg{width:92px;height:107px;background:#1e1e28;border-radius:4px}figcaption{font-size:10px;color:#888}
</style>${cells.join('\n')}`);
  console.log(`wrote ${sheet} (${cells.length} poses)`);
}
if (bad) { console.log(`\n${bad} pose(s) with problems`); process.exit(1); }
if (!sheet) console.log(`\nall ${keys.length} valid`);
