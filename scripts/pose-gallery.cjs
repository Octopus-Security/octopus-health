// Builds a contact sheet: every pose, every key frame plus the midpoint to the next, with the exercises that use it.
//   node scripts/pose-gallery.cjs [poseKeyRegex] [cellPx=150] [out.html]
// Read-only: loads the engine, the pose files and the exercise inventory; writes only the output file
// (default ./pose-contact-sheet.html, not committed). Screenshot it with scripts/pose-shot.cjs.
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '..');
const SF = require(H + '/public/stick-figure.js');
const INV = require('./exercise-inventory.cjs');
const use = {};
for (const r of INV.inventory()) if (r.pose) (use[r.pose] = use[r.pose] || []).push((r.source === 'mobility' ? 'mob: ' : '') + r.name);
const flags = {};
const POSES = H + '/public/poses';
const keys = [...fs.readdirSync(POSES).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort(),
  ...fs.readdirSync(POSES + '/mma').filter(f => f.endsWith('.json')).map(f => 'mma/' + f.slice(0, -5)).sort()];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
const size = +(process.argv[3] || 150);
const out = process.argv[4] || 'pose-contact-sheet.html';
const cards = [];
let n = 0;
for (const k of keys) {
  if (only && !only.test(k)) continue;
  const data = JSON.parse(fs.readFileSync(POSES + '/' + k + '.json', 'utf8'));
  const frames = SF.resolveFrames(data);
  const cells = [];
  frames.forEach((fr, i) => {
    cells.push(`<figure><div class="svg">${SF.svgFor(data, i)}</div><figcaption>${i} ${esc(fr.label || '')}</figcaption></figure>`);
    if (!data.static && frames.length > 1) cells.push(`<figure class="mid"><div class="svg">${SF.svgFor(data, i, 0.5)}</div><figcaption>${i}.5</figcaption></figure>`);
  });
  const users = (use[k] || []).map(esc).join('; ') || '<em>no exercise uses this</em>';
  const fl = (flags[k] || []).map(f => `<li>${esc(f)}</li>`).join('');
  cards.push(`<section id="${esc(k)}" class="${flags[k] ? 'flag' : ''}"><h2>${esc(k)} <small>${esc(data.title || '')}${data.static ? ' (static hold)' : ''}${data.hold ? ' &middot; holds ' + esc(data.hold) : ''}</small></h2><div class="users">${users}</div>${fl ? '<ul class="fl">' + fl + '</ul>' : ''}<div class="row">${cells.join('')}</div></section>`);
  n++;
}
fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Pose contact sheet</title><style>
body{background:#16161e;color:#ccc;font:13px system-ui;margin:12px}
h1{font-size:16px}
section{display:block;margin:0 0 10px;padding:6px;border:1px solid #333;border-radius:6px;break-inside:avoid}
section.flag{border-color:#e7a23c}
h2{font-size:13px;margin:0 0 2px;color:#eee}small{color:#888;font-weight:normal}
.users{font-size:11px;color:#8fb;margin-bottom:3px}
.fl{margin:2px 0 4px;padding-left:18px;color:#f4b860;font-size:11px}
.row{display:flex;flex-wrap:wrap;gap:2px}
figure{margin:0;text-align:center}figure.mid{opacity:.55}
.svg svg{width:${size}px;height:${Math.round(size * 1.163)}px;background:#1e1e28;border-radius:4px;display:block}
figcaption{font-size:10px;color:#888;max-width:${size}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style><h1>Pose contact sheet: ${n} poses. Each cell is a key frame; the dimmed cell after it is the midpoint to the next key. </h1>${cards.join('\n')}`);
console.log('wrote', out, n);
