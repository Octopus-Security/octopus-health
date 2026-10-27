'use strict';

/**
 * Stick-figure animations: the rigid-skeleton engine, every pose file, and the
 * exercise → pose rules. Pure; needs nothing installed.
 *
 * The rule this exists to enforce: every body part stays connected and every
 * bone keeps its length, at the keyframes AND in between them. v1 broke it
 * (independent x/y per joint) and Cat-Cow drew its arms off the body.
 *
 * Run: node --test test/stick-figure.test.js
 * Preview: node scripts/poses.mjs --sheet /tmp/sheet.html
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SF = require('../public/stick-figure.js');
const PM = require('../public/pose-map.js');

const POSES = path.join(__dirname, '..', 'public', 'poses');
const files = fs.readdirSync(POSES).filter((f) => f.endsWith('.json'));
const load = (k) => JSON.parse(fs.readFileSync(path.join(POSES, k + '.json'), 'utf8'));

const BONES = [
  ['hip', 'neck', 'torso', 'torso'], ['neck', 'head', 'head', null],
  ['shoulderL', 'elbowL', 'upperArm', 'upperArmL'], ['elbowL', 'handL', 'forearm', 'forearmL'],
  ['shoulderR', 'elbowR', 'upperArm', 'upperArmR'], ['elbowR', 'handR', 'forearm', 'forearmR'],
  ['hipL', 'kneeL', 'thigh', 'thighL'], ['kneeL', 'ankleL', 'shin', 'shinL'], ['ankleL', 'toeL', 'foot', 'footL'],
  ['hipR', 'kneeR', 'thigh', 'thighR'], ['kneeR', 'ankleR', 'shin', 'shinR'], ['ankleR', 'toeR', 'foot', 'footR'],
];
// A bone is exactly its length, times its "depth" (foreshortening) when the pose sets one.
function assertConnected(jt, where, pose) {
  for (const [a, b, len, seg] of BONES) {
    const d = Math.hypot(jt[a].x - jt[b].x, jt[a].y - jt[b].y);
    const k = pose && pose.depth && seg && typeof pose.depth[seg] === 'number' ? pose.depth[seg] : 1;
    const want = SF.LEN[len] * k;
    assert.ok(Math.abs(d - want) < 1e-6, `${where}: ${a}→${b} is ${d.toFixed(3)}, should be ${want}`);
  }
}

test('every pose file is valid by the rule book', () => {
  assert.ok(files.length > 0);
  const bad = [];
  for (const f of files) {
    const errs = SF.validate(JSON.parse(fs.readFileSync(path.join(POSES, f), 'utf8')));
    if (errs.length) bad.push(`${f}:\n    ${errs.join('\n    ')}`);
  }
  assert.deepStrictEqual(bad, [], bad.join('\n'));
});

test('every bone keeps its length throughout every animation, pins and anchors included', () => {
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(POSES, f), 'utf8'));
    const frames = SF.resolveFrames(data);
    frames.forEach((fr, i) => {
      for (let s = 0; s <= 10; s++) {
        const pose = SF.between(fr, SF.nextOf(frames, i), s / 10, data.view || 'side');
        assertConnected(SF.solve(pose, data.view || 'side'), `${f} frame ${i} t=${s / 10}`, pose);
      }
    });
  }
});

test('an anchored joint stays planted between keyframes', () => {
  const data = load('squat');
  const frames = SF.resolveFrames(data);
  for (let s = 0; s <= 10; s++) {
    const jt = SF.solve(SF.between(frames[0], frames[1], s / 10, 'side'), 'side');
    assert.ok(Math.hypot(jt.ankleL.x - 50, jt.ankleL.y - 90) < 1e-6, `ankle drifted at t=${s / 10}`);
  }
});

test('a pinned hand stays planted while the elbow bends (push-up)', () => {
  const data = load('push-up');
  const frames = SF.resolveFrames(data);
  const start = SF.solve(frames[0].pose, 'side').handL;
  const end = SF.solve(frames[1].pose, 'side').handL;
  assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 0.6, 'keyframes put the hand in the same place');
  for (let s = 1; s < 10; s++) {
    const jt = SF.solve(SF.between(frames[0], frames[1], s / 10, 'side'), 'side');
    assert.ok(Math.hypot(jt.handL.x - start.x, jt.handL.y - start.y) < 0.6, `hand slid at t=${s / 10}`);
  }
});

// Negative controls: the rules must reject the defects they are there for, or
// a green run says nothing.
const STAND = { torso: 180, head: 180, upperArmL: 0, forearmL: 0, upperArmR: 0, forearmR: 0,
  thighL: 0, shinL: 0, footL: 90, thighR: 0, shinR: 0, footR: 90 };
const anim = (a, b, extra) => ({ version: 2, title: 't', anchor: { joint: 'ankleL', x: 50, y: 90 },
  frames: [{ duration: 500, pose: { ...STAND, ...a } }, { duration: 500, pose: b }], ...extra });

test('validator rejects a knee bent backwards', () => {
  assert.ok(SF.validate(anim({}, { thighL: -20, shinL: 30 })).some((e) => /knee.*backwards/.test(e)));
});
test('validator rejects an elbow bent backwards', () => {
  assert.ok(SF.validate(anim({}, { upperArmL: 0, forearmL: -60 })).some((e) => /elbow.*backwards/.test(e)));
});
test('a knee may hyperextend by at most ~5 degrees, an elbow likewise', () => {
  assert.deepStrictEqual(SF.validate(anim({}, { thighL: -3, shinL: 0, upperArmL: 90, forearmL: 87 })), []);
  assert.ok(SF.validate(anim({}, { thighL: -8, shinL: 0 })).some((e) => /knee.*backwards/.test(e)));
  assert.ok(SF.validate(anim({}, { upperArmL: 90, forearmL: 82 })).some((e) => /elbow.*backwards/.test(e)));
});
test('the far (R) limbs obey the hinge rule too', () => {
  assert.ok(SF.validate(anim({}, { thighR: -20, shinR: 30 })).some((e) => /kneeR.*backwards/.test(e)));
  assert.ok(SF.validate(anim({}, { forearmR: -60 })).some((e) => /elbowR.*backwards/.test(e)));
});
test('pinned limbs are solved with the anatomical bend, even when the first keyframe is straight', () => {
  // A straight pinned leg that then folds: the IK used to copy the sign of (shin - thigh) from the first key, and
  // 0 read as the ARM sign, so the knee was solved inside out. Same for an elbow starting straight.
  const a = { duration: 500, pins: ['ankleR', 'handR'], anchor: { joint: 'ankleL', x: 50, y: 90 }, pose: { ...STAND } };
  const b = { duration: 500, pins: ['ankleR', 'handR'], anchor: { joint: 'ankleL', x: 50, y: 90 },
    pose: { ...STAND, torso: 140, head: 150, thighL: 85, shinL: -30, thighR: 85, shinR: -30, upperArmR: 40, forearmR: 100 } };
  const frames = SF.resolveFrames({ version: 2, title: 't', frames: [a, b] });
  for (let s = 1; s < 10; s++) {
    const q = SF.between(frames[0], frames[1], s / 10, 'side');
    const knee = ((q.thighR - q.shinR + 540) % 360) - 180, elbow = ((q.forearmR - q.upperArmR + 540) % 360) - 180;
    assert.ok(knee > -5, `kneeR bent backwards (${knee.toFixed(0)}°) at t=${s / 10}`);
    assert.ok(elbow > -5, `elbowR bent backwards (${elbow.toFixed(0)}°) at t=${s / 10}`);
  }
});
test('validator rejects a figure that does not move', () => {
  assert.ok(SF.validate(anim({}, { forearmL: 3 })).some((e) => /does not move/.test(e)));
});
test('validator rejects a limb through the floor, including mid-move', () => {
  const sink = { version: 2, title: 't', frames: [
    { duration: 500, pose: { ...STAND, root: { x: 50, y: 50 } } },
    { duration: 500, pose: { root: { x: 50, y: 50 }, upperArmL: 30, forearmL: 30 } }] };
  assert.deepStrictEqual(SF.validate(sink), []);                       // positive control
  // a linear root move with bending knees used to push the feet through the floor
  const naive = { version: 2, title: 't', frames: [
    { duration: 500, pose: { ...STAND, root: { x: 50, y: 50 } } },
    { duration: 500, pose: { root: { x: 40.1, y: 71 }, thighL: 85, shinL: -30, thighR: 85, shinR: -30, torso: 140 } }] };
  assert.ok(SF.validate(naive).some((e) => /through the floor/.test(e)));
});
test('validator rejects a floating figure unless told it is airborne', () => {
  const up = (air) => ({ version: 2, title: 't', frames: [
    { duration: 500, pose: { ...STAND, root: { x: 50, y: 50 } } },
    { duration: 500, air, pose: { root: { x: 50, y: 40 } } }] });
  assert.ok(SF.validate(up(false)).some((e) => /floating/.test(e)));
  assert.deepStrictEqual(SF.validate(up(true)), []);
});
test('validator rejects an angle written discontinuously (a spin)', () => {
  assert.ok(SF.validate(anim({ upperArmL: 170, forearmL: 170 }, { upperArmL: -170, forearmL: -170 })).some((e) => /swings/.test(e)));
});

// ── tweening, holds and static poses ────────────────────────────────────────
test('moves take the shortest way round and never unwind a full turn', () => {
  const d = anim({ upperArmL: 170, forearmL: 175 }, { upperArmL: 190, forearmL: 200 });
  const fr = SF.resolveFrames(d);
  const q = SF.between(fr[0], fr[1], 0.5, 'side');
  assert.strictEqual(q.upperArmL, 180);
  // last frame back to the first: 350 → 10 goes through 360, not back through 180
  const loop = SF.resolveFrames(anim({ upperArmL: 350 }, { upperArmL: 355 }));
  loop[1].pose.upperArmL = 355; loop[0].pose.upperArmL = 10;
  const w = SF.between(loop[1], SF.nextOf(loop, 1), 0.5, 'side');
  assert.ok(Math.abs(w.upperArmL - 362.5) < 1e-9, 'wrap should be 355 -> 370, got ' + w.upperArmL);
});

test('playback is time-based: a key pose is held, then eased, and the loop closes smoothly', () => {
  const d = anim({}, { upperArmL: 90, forearmL: 90 });
  d.frames[0].hold = 200; d.frames[1].hold = 200;
  const fr = SF.resolveFrames(d), tl = SF.timeline(fr, true);
  assert.strictEqual(tl.total, 200 + 500 + 200 + 500);
  const at = (ms) => SF.sampleAt(fr, tl, ms, 'side', true).pose.upperArmL;
  assert.strictEqual(at(0), 0);
  assert.strictEqual(at(199), 0);                         // held
  assert.ok(Math.abs(at(200 + 250) - 45) < 1e-9);         // ease-in-out: half way at half time
  assert.ok(at(200 + 50) < 90 * 0.1 / 1, 'eases in (slow start)');
  assert.ok(Math.abs(at(200 + 500 + 100) - 90) < 1e-9);   // held at the far key
  assert.ok(Math.abs(at(1400 - 1) - 0) < 0.01);            // arrives back at frame 0...
  assert.strictEqual(at(1400), at(0));                     // ...and the cycle wraps exactly
  // velocity is zero at the seam: both sides of the wrap are inside holds
  assert.strictEqual(at(1400 + 100), 0);
  // monotone through the move, no stepping: 100 samples, no jump above 3° (a stepped 4-frame tween would jump 22°)
  let prev = at(200);
  for (let ms = 205; ms <= 700; ms += 5) { const v = at(ms); assert.ok(v >= prev && v - prev < 3, `jump at ${ms}`); prev = v; }
});

test('a hold:0 key is a pass-through: the neighbouring moves do not stop there', () => {
  const d = anim({}, { upperArmL: 90 });
  d.frames[1].hold = 0; d.frames[0].hold = 0;
  d.frames.push({ duration: 500, hold: 0, pose: { upperArmL: 180 } });
  const fr = SF.resolveFrames(d), tl = SF.timeline(fr, true);
  assert.strictEqual(tl.segs[0].ease, 'linear');
  const s1 = SF.sampleAt(fr, tl, 499, 'side', true).pose.upperArmL, s2 = SF.sampleAt(fr, tl, 501, 'side', true).pose.upperArmL;
  assert.ok(s2 - s1 > 0.1, 'still moving through the key');
});

const staticKeys = files.filter((f) => load(f.slice(0, -5)).static === true).map((f) => f.slice(0, -5));
test('static poses: one frame, exempt from must-move, rendered without distortion', () => {
  assert.ok(staticKeys.length >= 20, 'holds are marked static');
  const one = (extra) => ({ version: 2, title: 't', static: true, anchor: { joint: 'ankleL', x: 50, y: 90 }, frames: [{ pose: { ...STAND, ...extra } }] });
  assert.deepStrictEqual(SF.validate(one({})), []);                                             // positive control: no motion needed
  assert.ok(SF.validate({ ...one({}), static: false }).length > 0);                           // the same file without the flag fails
  assert.ok(SF.validate({ ...one({}), frames: [...one({}).frames, ...one({}).frames] }).some((e) => /exactly one frame/.test(e)));
  for (const k of staticKeys) {
    const d = load(k);
    assert.deepStrictEqual(SF.validate(d), [], k);
    assert.strictEqual(d.frames.length, 1, k + ' has more than one frame');
    const fr = SF.resolveFrames(d), tl = SF.timeline(fr, true);
    const first = SF.sampleAt(fr, tl, 0, d.view || 'side', true).pose;
    for (const ms of [137, 900, 2500]) assert.deepStrictEqual(SF.sampleAt(fr, tl, ms, d.view || 'side', true).pose, first, k + ' limbs must not move');
  }
});

test('genuine holds are static and genuine movers are not', () => {
  for (const k of ['plank', 'side-plank', 'dead-hang', 'hollow-body', 'deep-squat-hold', 'couch-stretch', 'quad-stretch', 'pigeon', 'childs-pose', 'neck-isometric']) assert.ok(staticKeys.includes(k), k + ' is a hold');
  for (const k of ['squat', 'lunge', 'push-up', 'roundhouse', 'jab-cross', 'burpee', 'pull-up', 'cat-cow']) assert.ok(!staticKeys.includes(k), k + ' moves');
});

test('every non-static pose genuinely moves (no pose is "static" by accident)', () => {
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(POSES, f), 'utf8'));
    if (d.static) continue;
    assert.ok(d.frames.length >= 2, f);
  }
});

// ── exercise → pose ──────────────────────────────────────────────────────────
function seededExercises() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  const re = /\{ name: '((?:[^'\\]|\\.)+)',\s*category: '([a-z_]+)'/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ name: m[1].replace(/\\'/g, "'"), category: m[2] });
  return out;
}

test('every pose the rules can choose exists', () => {
  const missing = PM.keys().filter((k) => !fs.existsSync(path.join(POSES, k + '.json')));
  assert.deepStrictEqual(missing, []);
});

test('every pose file is used by some rule', () => {
  const used = new Set(PM.keys());
  assert.deepStrictEqual(files.map((f) => f.slice(0, -5)).filter((k) => !used.has(k)), []);
});

test('every seeded exercise is matched by a name rule, not the category fallback', () => {
  const ex = seededExercises();
  assert.ok(ex.length > 250, `found ${ex.length} seeded exercises — the parser is broken`);
  assert.deepStrictEqual(ex.filter((e) => !PM.match(e.name)).map((e) => e.name), []);
});

test('rules route the names that used to collide', () => {
  const cases = {
    'Mountain Climber': 'mountain-climber',  // "mount" is BJJ
    'Cable Crunch': 'cable-crunch',          // contains "run"; kneeling, not the floor crunch
    'Leg Curl': 'leg-curl',                  // contains "curl"
    'Romanian Deadlift (RDL)': 'rdl',
    'Barbell Deadlift': 'deadlift',
    'Muay Thai Footwork — Triangle': 'fight-stance',
    'Triangle Choke Setup': 'guard',
    'Jump Squat': 'jump-squat',
    'Goblet Squat': 'squat',
    'Pike Push-up': 'pike-push-up',
    'Side Plank': 'side-plank',
    'Hanging Leg Raise': 'hanging-leg-raise',
    'Jefferson Curl': 'forward-fold',
    'Couch Stretch': 'couch-stretch',            // not the generic hip-flexor figure
    'Lizard Stretch': 'lizard',
    "World's Greatest Stretch": 'worlds-greatest',
    'Scorpion Stretch': 'scorpion',              // "Scorpion" used to fall to Cobra
    'Frog Stretch': 'frog',
    'Standing Figure-4 Stretch': 'figure-four',
    'Calf Foam Roll': 'foam-roll-calf',
    'Foam Roll Lats': 'foam-roll-lats',
    'Thoracic Extension over Roller': 'thoracic-extension',
    'Levator Scapulae Stretch': 'neck-side-stretch',
    'Chin Tuck': 'chin-tuck',
    'Neck Isometric Holds': 'neck-isometric',
    'Neck Circles': 'neck-circle',
    'Wrist Flexor Stretch': 'wrist-flexor-stretch',
    'Overhead Banded Shoulder Stretch': 'overhead-shoulder-stretch',
    'Dumbbell Bulgarian Split Squat': 'bulgarian-split-squat',
    'Dumbbell Lunge': 'lunge',
  };
  for (const [n, k] of Object.entries(cases)) assert.strictEqual(PM.keyFor(n), k, n);
  assert.strictEqual(PM.keyFor('Something New', 'muay_thai'), 'fight-stance');
  assert.strictEqual(PM.keyFor('Something New'), 'stand-breathe');
});

// The 2026-10-26 audit: these each borrowed a neighbour's figure. Back Roll, Front Roll and
// Granby Roll all played the same forward roll; Neck Bridge played Neck Circles.
test('movements that are different are not drawn with the same figure', () => {
  const groups = [
    ['Front Roll', 'Back Roll', 'Granby Roll', 'Inversion Drill'],
    ['Neck Bridge', 'Neck Circles'],
    ['Dumbbell Shrug', 'Shoulder CARS'],
    ['Thoracic Open Book', 'Thread the Needle'],
    ['Box Jump', 'Jump Squat'],
    ['Turkish Get-Up', 'Technical Stand-up'],
    ['Spinning Back Kick', 'Teep (Front Push Kick)'],
    ['Cable Crunch', 'Crunch'],
    ['Dumbbell Tricep Kickback', 'Cable Tricep Pushdown'],
    ['Dumbbell Pullovers', 'Barbell Bench Press', 'Incline Dumbbell Press', 'Chest Press Machine'],
    ['Elbow Flexion/Extension', 'Wrist CARS'],
    ['Terminal Knee Extension (TKE)', 'Knee CARS'],
    ['Sleeper Stretch', 'Prone Shoulder ER Stretch', 'Cross-Body Shoulder Stretch'],
    ['Hamstring Floss', 'Seated Spine Rotation', 'Seated Forward Fold'],
    ['Wall Walks', 'Pike Push-up'],
    ['Speed Bag', 'Jab Drill'],
    ['Upward Elbow (Sok Ngad)', 'Horizontal Elbow (Sok Tad)'],
    ['Quadruped Hip CARs', 'Bird Dog'],
    ['Takedown Drilling', 'Turtle Position Defense', 'BJJ Drilling'],
    ['Foam Roll Thoracic Spine', 'Foam Roll Hip Flexors', 'ITB Foam Roll', 'Foam Roll Lats'],
    ['Hip Bump Sweep', 'Bridge and Roll'],
    ['Dumbbell Row', 'Dumbbell Single-Arm Row', 'Barbell Bent-Over Row'],
  ];
  for (const g of groups) {
    const keys = g.map((n) => PM.keyFor(n));
    assert.strictEqual(new Set(keys).size, g.length, `${g.join(' / ')} → ${keys.join(' / ')}`);
  }
  assert.strictEqual(PM.keyFor("Wrestler's Bridge"), 'neck-bridge');
  assert.strictEqual(PM.keyFor('Combination: 1-2-Low Kick'), 'muay-thai-combo');
  assert.strictEqual(PM.keyFor('Shadow Boxing'), 'shadow-boxing');
});

// Rolls and circles are one continuous movement. Every key used to carry the default
// hold and an ease to a full stop, so a 9-key roll halted nine times per rep and read
// as slow and jerky next to a punch. The middle keys must be pass-through (hold 0).
test('continuous movements do not stop at every key', () => {
  const continuous = ['forward-roll', 'back-roll', 'granby-roll', 'inversion', 'arm-circle', 'ankle-circle',
    'neck-circle', 'wrist-circle', 'knee-cars', 'hip-circle', 'run', 'walk', 'bike', 'battle-ropes', 'speed-bag',
    'quadruped-hip-cars'];
  for (const k of continuous) {
    const stops = SF.resolveFrames(load(k)).filter((f) => f.hold > 0).length;
    assert.ok(stops <= 3, `${k} comes to a stop at ${stops} keys`);
  }
});

test('depth foreshortens only the drawn segment and is validated', () => {
  const base = load('open-book');
  const f = SF.resolveFrames(base)[0];
  const full = SF.solve({ ...f.pose, depth: undefined }, 'side'), short = SF.solve(f.pose, 'side');
  const arm = (j) => Math.hypot(j.elbowL.x - j.shoulderL.x, j.elbowL.y - j.shoulderL.y);
  assert.ok(Math.abs(arm(full) - SF.LEN.upperArm) < 1e-9);
  assert.ok(Math.abs(arm(short) - SF.LEN.upperArm * 0.3) < 1e-9);
  const bad = JSON.parse(JSON.stringify(base)); bad.frames[0].pose.depth = { upperArmL: 0 };
  assert.ok(SF.validate(bad).some((e) => /depth upperArmL must be/.test(e)));
  bad.frames[0].pose.depth = { elbow: 0.5 };
  assert.ok(SF.validate(bad).some((e) => /not a segment/.test(e)));
});

test('shrug lifts the shoulders and nothing else, and counts as movement', () => {
  const d = load('shrug');
  const [a, b] = SF.resolveFrames(d);
  const ja = SF.solve(a.pose, 'front'), jb = SF.solve(b.pose, 'front');
  assert.ok(ja.shoulderL.y - jb.shoulderL.y > 4, 'shoulders rise');
  for (const j of ['neck', 'head', 'hip', 'kneeL', 'ankleL']) assert.deepStrictEqual(ja[j], jb[j], j + ' moved');
  assert.deepStrictEqual(SF.validate(d), []);
  const still = JSON.parse(JSON.stringify(d)); still.frames[1].shrug = 0; still.frames[1].pose.shrug = 0;
  assert.ok(SF.validate(still).some((e) => /does not move/.test(e)));
});

test('one-handed equipment is drawn at the near hand only', () => {
  const d = load('bench-row');
  const svg = SF.svgFor(d, 0);
  assert.strictEqual((svg.match(/r="3.4"/g) || []).length, 1, 'one dumbbell');
  const two = SF.svgFor({ ...d, hold: 'dumbbell' }, 0);
  assert.strictEqual((two.match(/r="3.4"/g) || []).length, 2);
});

test('Body Map is a top-level nav tab and lights up on /body', () => {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'nav.ejs'), 'utf8');
  assert.match(nav, /\['body', '\/body', 'Body Map'\]/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(idx, /return 'body'/);
});
