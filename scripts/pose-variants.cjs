// Poses that are the SAME movement as another pose but hold a different implement (or none).
//   node scripts/pose-variants.cjs          write/refresh every variant file
//   node scripts/pose-variants.cjs --check  exit 1 if a file differs from what this table produces
//
// Why this exists: a figure carries its implement in the file (`"hold"`), and an exercise's implement is
// in its equipment. A barbell bench press and a dumbbell bench press are one movement but two figures
// (test/exercise-guards.test.js checks the match). Keeping them as generated copies of one base means the
// movement cannot drift between them: edit the BASE pose, run this, commit both.
//
//   VARIANTS  [key, base, hold|null, title, patch?]  a new file: base's frames with hold replaced (null = holds nothing)
//   IN_PLACE  key -> {hold, title?}                 the base is only ever used with this implement, so edit the file itself
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'poses');

const VARIANTS = [
  ['bench-press-db', 'bench-press', 'dumbbell', 'Dumbbell Bench Press'],
  ['overhead-press-db', 'overhead-press', 'dumbbell', 'Dumbbell Overhead Press'],
  ['rdl-barbell', 'rdl', 'barbell', 'Barbell Romanian Deadlift'],
  ['forward-lunge-db', 'forward-lunge', 'dumbbell', 'Dumbbell Forward Lunge'],
  ['walking-lunge-db', 'walking-lunge', 'dumbbell', 'Dumbbell Walking Lunge'],
  ['goblet-squat-plate', 'goblet-squat', null, 'Plate Goblet Squat'],
  ['upright-row-barbell', 'upright-row', 'barbell', 'Barbell Upright Row'],
  ['incline-press-barbell', 'incline-press', 'barbell', 'Barbell Incline Bench Press', { labels: ['Bar at the upper chest, full stretch', 'Press up to lockout'] }],
  ['incline-press-smith', 'incline-press', null, 'Smith Machine Incline Press', { labels: ['Bar at the upper chest, full stretch', 'Press up to lockout'] }],
  ['step-up-db', 'step-up', 'dumbbell', 'Dumbbell Step-up', { arms: 'down' }],
  ['step-up-barbell', 'step-up', 'barbell', 'Barbell Step-up', { arms: 'back' }],   // bar on the upper back: elbows down and behind
  ['bulgarian-split-squat-bare', 'bulgarian-split-squat', null, 'Bulgarian Split Squat'],
  ['curl-bare', 'curl', null, 'Curl (cable or band)'],
  ['curl-barbell', 'curl', 'barbell', 'Bar Curl'],
  // resistance-band versions: the same movement with a band prop (stick-figure.js `band`), anchored where the band is
  // actually fixed. A `from` that is a joint name means the band is stood on / looped round that joint, not tied to a wall.
  ['seated-row-band', 'seated-row', null, 'Resistance Band Row', { band: { from: { x: 97, y: 62 }, to: 'handL', rest: 22 } }],
  ['face-pull-band', 'face-pull', null, 'Resistance Band Face Pull', { band: { from: { x: 97, y: 11 }, to: 'handL', rest: 22 } }],
  ['pushdown-band', 'pushdown', null, 'Resistance Band Triceps Pushdown', { band: { from: { x: 70, y: -14 }, to: 'handL', rest: 30 } }],
  ['lat-pulldown-band', 'lat-pulldown', null, 'Resistance Band Lat Pulldown', { band: { from: { x: 44, y: -14 }, to: 'handL', rest: 26 } }],
  ['curl-band', 'curl-bare', null, 'Resistance Band Curl (stand on the band)', { band: { from: 'ankleL', to: 'handL', rest: 38 } }],
  ['lateral-raise-band', 'lateral-raise-bare', null, 'Resistance Band Lateral Raise (stand on the band)', { band: { from: 'ankleL', to: 'handL', rest: 36 } }],
  ['leg-curl-band', 'leg-curl', null, 'Resistance Band Leg Curl', { band: { from: { x: 3, y: 90 }, to: 'ankleL', rest: 18 } }],
  ['clamshell-band', 'clamshell', null, 'Banded Clamshell (band round the knees)', { band: { from: 'kneeR', to: 'kneeL', rest: 8 } }],
  ['pull-up-band', 'pull-up', null, 'Band-Assisted Pull-up', { band: { from: { x: 50, y: -3 }, to: 'ankleL', rest: 34 } }],
  ['lateral-raise-bare', 'lateral-raise', null, 'Lateral Raise (cable or band)'],
  ['tricep-overhead-bare', 'tricep-overhead', null, 'Overhead Triceps Extension (cable)'],
  ['shrug-bare', 'shrug', null, 'Shrug Roll'],
  ['wood-chop-cable', 'wood-chop', null, 'Cable Wood Chop'],
  // carries: the walk's legs, but the arms hang still under the load instead of swinging
  ['farmers-carry', 'walk', 'dumbbell', "Farmer's Carry", { arms: 'down' }],
  ['suitcase-carry', 'walk', 'dumbbellL', 'Suitcase Carry (one side)', { arms: 'down' }],
  ['plate-pinch-carry', 'walk', 'plate', 'Plate Pinch Carry', { arms: 'down' }],
  ['sandbag-carry', 'walk', 'ball', 'Sandbag Carry (bear hug)', { arms: 'hug' }],
  // the same figures with a lacrosse ball instead of a foam roller
  ['ball-roll-calf', 'foam-roll-calf', null, 'Calf Ball Roll', { ball: true }],
  ['ball-roll-quad', 'foam-roll-prone', null, 'Quad Ball Roll (face down)', { ball: true }],
];
const IN_PLACE = {
  'bent-row': { hold: 'barbell', title: 'Barbell Bent-Over Row' },
  pullover: { hold: 'dumbbell', title: 'Dumbbell Pullover' },
  'lat-pulldown': { hold: null },
  'chest-fly': { hold: null, title: 'Chest Fly (cable or machine)' },
};

const read = (k) => JSON.parse(fs.readFileSync(path.join(DIR, k + '.json'), 'utf8'));
const out = {};

for (const [key, base, hold, title, patch] of VARIANTS) {
  const d = read(base);
  const o = {};
  for (const [k, v] of Object.entries(d)) {
    if (k === 'hold') continue;
    o[k] = k === 'title' ? title : v;
    if (k === 'view' && hold) o.hold = hold;
  }
  if (patch && patch.arms) {
    const A = patch.arms === 'hug' ? { upperArmL: 35, forearmL: 115, upperArmR: 35, forearmR: 115 }
      : patch.arms === 'back' ? { upperArmL: -75, forearmL: 88, upperArmR: -75, forearmR: 88 }
      : { upperArmL: 0, forearmL: 0, upperArmR: 0, forearmR: 0 };
    o.frames = o.frames.map((f) => ({ ...f, pose: { ...f.pose, ...A } }));
  }
  if (patch && patch.band) o.props = [...(o.props || []), { type: 'band', ...patch.band }];
  if (patch && patch.labels) o.frames = o.frames.map((f, i) => (patch.labels[i] ? { ...f, label: patch.labels[i] } : f));
  if (patch && patch.ball) {
    if (o.props) o.props = o.props.map((p) => (p.type === 'roller' ? { ...p, type: 'ball' } : p));
    if (o.frames) o.frames = o.frames.map((f) => (f.label ? { ...f, label: f.label.replace(/Roller/g, 'Ball').replace(/roller/g, 'ball') } : f));
  }
  out[key] = JSON.stringify(o, null, 1) + '\n';
}

// In place: a textual edit so the diff is only the hold line (and title), not a reformat of the file.
for (const [key, spec] of Object.entries(IN_PLACE)) {
  const file = path.join(DIR, key + '.json');
  let t = fs.readFileSync(file, 'utf8');
  if (spec.hold) t = t.replace(/"hold": "[a-zA-Z]+"/, `"hold": "${spec.hold}"`);
  else t = t.replace(/\n\s*"hold": "[a-zA-Z]+",?/, '');
  if (spec.title) t = t.replace(/"title": "[^"]*"/, `"title": "${spec.title}"`);
  out[key] = t;
}

let bad = 0;
for (const [key, text] of Object.entries(out)) {
  const file = path.join(DIR, key + '.json');
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) { console.error('stale: ' + key); bad++; }
  } else { fs.writeFileSync(file, text); }
}
if (process.argv.includes('--check')) { if (bad) process.exit(1); console.log('pose variants are current'); } else console.log('wrote', Object.keys(out).length, 'variant files');
