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
  ['hip', 'neck', 'torso'], ['neck', 'head', 'head'],
  ['shoulderL', 'elbowL', 'upperArm'], ['elbowL', 'handL', 'forearm'],
  ['shoulderR', 'elbowR', 'upperArm'], ['elbowR', 'handR', 'forearm'],
  ['hipL', 'kneeL', 'thigh'], ['kneeL', 'ankleL', 'shin'], ['ankleL', 'toeL', 'foot'],
  ['hipR', 'kneeR', 'thigh'], ['kneeR', 'ankleR', 'shin'], ['ankleR', 'toeR', 'foot'],
];
function assertConnected(jt, where) {
  for (const [a, b, len] of BONES) {
    const d = Math.hypot(jt[a].x - jt[b].x, jt[a].y - jt[b].y);
    assert.ok(Math.abs(d - SF.LEN[len]) < 1e-6, `${where}: ${a}→${b} is ${d.toFixed(3)}, should be ${SF.LEN[len]}`);
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
        assertConnected(SF.solve(pose, data.view || 'side'), `${f} frame ${i} t=${s / 10}`);
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
    'Cable Crunch': 'crunch',                // contains "run"
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
  };
  for (const [n, k] of Object.entries(cases)) assert.strictEqual(PM.keyFor(n), k, n);
  assert.strictEqual(PM.keyFor('Something New', 'muay_thai'), 'fight-stance');
  assert.strictEqual(PM.keyFor('Something New'), 'stand-breathe');
});

test('Body Map is a top-level nav tab and lights up on /body', () => {
  const nav = fs.readFileSync(path.join(__dirname, '..', 'views', 'partials', 'nav.ejs'), 'utf8');
  assert.match(nav, /href="\/body"[^>]*activeTab === 'body'/);
  const idx = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.match(idx, /return 'body'/);
});
