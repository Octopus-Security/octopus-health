'use strict';

/**
 * Two-figure poses (ported from octopus-mma), and the rule that a diagram box is never left blank.
 *
 * The first test is the safety net for the port: every single-figure pose must draw EXACTLY what it
 * drew before the partner code existed. test/fixtures/stick-figure-golden.json holds a hash of the
 * output (every frame as a still, half-way stills, and 25 moments of real playback) for every pose
 * without a partner, taken from the engine as it was before the port. If a deliberate change to how
 * single figures look is ever made, regenerate it with `node test/fixtures/make-golden.js` and say so.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const SF = require('../public/stick-figure.js');
const PM = require('../public/pose-map.js');
const { stillsFor } = require('../lib/session-stills');
const POSES = path.join(root, 'public', 'poses');

function allPoses() {
  const out = {};
  (function walk(d, pre) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name), pre + f.name + '/');
      else if (f.name.endsWith('.json')) out[pre + f.name.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(d, f.name), 'utf8'));
    }
  })(POSES, '');
  return out;
}
const poses = allPoses();
const partnerKeys = Object.keys(poses).filter((k) => SF.hasPartner(poses[k]));

function fingerprint(data) {
  const h = crypto.createHash('sha256');
  SF.resolveFrames(data).forEach((_, i) => { h.update(SF.svgFor(data, i, 0)); h.update(SF.svgFor(data, i, 0.5)); });
  const dur = SF.duration(data);
  for (let k = 0; k <= 24; k++) h.update(SF.svgAt(data, dur * k / 24));
  return h.digest('hex').slice(0, 16);
}

test('single-figure output is byte-for-byte what it was before the partner port', () => {
  const golden = require('./fixtures/stick-figure-golden.json');
  const now = {};
  for (const k of Object.keys(poses)) if (!SF.hasPartner(poses[k])) now[k] = fingerprint(poses[k]);
  assert.deepStrictEqual(Object.keys(now).sort(), Object.keys(golden).sort(), 'the set of single-figure poses changed: regenerate the golden file if that is intended');
  const changed = Object.keys(golden).filter((k) => now[k] !== golden[k]);
  assert.deepStrictEqual(changed, []);
});

test('a single figure still uses the standard viewBox and one floor line', () => {
  const d = poses['push-up'];
  assert.strictEqual(SF.viewBoxFor(d), SF.VIEWBOX);
  assert.match(SF.svgFor(d, 0), /viewBox="0 -20 100 116"/);
  assert.strictEqual((SF.svgFor(d, 0).match(/x2="100"/g) || []).length, 1);
});

test('the nine snapshotted partner moves are found, valid, and draw two figures in a wider box', () => {
  assert.strictEqual(partnerKeys.length, 9, partnerKeys.join(','));
  for (const k of partnerKeys) {
    const d = poses[k];
    assert.deepStrictEqual(SF.validate(d), [], k);
    const vb = SF.viewBoxFor(d).split(' ').map(Number);
    assert.ok(vb[2] > 100 || vb[2] / vb[3] >= 1.24, `${k}: box ${vb.join(' ')} is not the two-figure box`);
    for (let i = 0; i < SF.resolveFrames(d).length; i++) {
      const svg = SF.svgFor(d, i, 0);
      // the partner is drawn in the blue palette, mirrored, and the floor runs past both bodies
      assert.match(svg, /translate\(100 0\) scale\(-1 1\)/, k);
      assert.match(svg, /#5090c8|#2c6098|#1f4672/, k);
      assert.match(svg, /x1="-300"/, k);
      assert.strictEqual((svg.match(/class="sf-bob"/g) || []).length >= 2, true, k);
    }
  }
});

test('the viewBox holds both bodies at every moment of every partner move', () => {
  for (const k of partnerKeys) {
    const d = poses[k], view = d.view || 'side', frames = SF.resolveFrames(d);
    const [x, y, w, h] = SF.viewBoxFor(d).split(' ').map(Number);
    frames.forEach((fr, i) => {
      for (let s = 0; s <= 6; s++) {
        const st = SF.blend(fr, SF.nextOf(frames, i), s / 6, view);
        const mine = SF.solve(st.pose, view), theirs = SF.solve(st.partner, view);
        for (const n of SF.JOINTS) {
          for (const px of [mine[n].x, 100 - theirs[n].x]) assert.ok(px >= x && px <= x + w, `${k} f${i} ${n}: x ${px.toFixed(1)} outside ${x}..${x + w}`);
          for (const py of [mine[n].y, theirs[n].y]) assert.ok(py >= y && py <= y + h, `${k} f${i} ${n}: y ${py.toFixed(1)} outside ${y}..${y + h}`);
        }
      }
    });
  }
});

test('partner moves animate: the picture changes over time, and the partner moves too', () => {
  for (const k of partnerKeys.filter((x) => poses[x].static !== true)) {   // a static pose idles (bob) instead
    const d = poses[k], dur = SF.duration(d);
    const seen = new Set();
    for (let t = 0; t < 8; t++) seen.add(SF.svgAt(d, dur * t / 8));
    assert.ok(seen.size > 2, k + ' does not animate');
  }
  // the partner itself changes (not just the attacker) in the armbar and the double leg
  for (const k of ['mma/bjj-armbar', 'mma/wrestling-double-leg-takedown']) {
    const d = poses[k], fr = SF.resolveFrames(d);
    const a = JSON.stringify(fr[0].partner.pose.root) + JSON.stringify(fr[fr.length - 1].partner.pose.root);
    const moved = fr.some((f) => JSON.stringify(f.partner.pose) !== JSON.stringify(fr[0].partner.pose));
    assert.ok(moved, k + ' ' + a);
  }
});

test('the server-drawn stills on /s pages and in print show both figures', () => {
  for (const k of partnerKeys) {
    const stills = stillsFor(k);
    assert.ok(stills.length >= 1, k + ' has no stills');
    for (const st of stills) {
      assert.match(st.svg, /translate\(100 0\) scale\(-1 1\)/, k);
      assert.match(st.svg, /viewBox="-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+"/);
      assert.doesNotMatch(st.svg, /viewBox="0 -20 100 116"/, k);
    }
  }
});

// ── the validator, for two figures ──────────────────────────────────────────
const stand = { torso: 180, head: 180, upperArmL: 0, forearmL: 0, upperArmR: 0, forearmR: 0, thighL: 0, shinL: 0, footL: 90, thighR: 0, shinR: 0, footR: 90 };
const clone = (o) => JSON.parse(JSON.stringify(o));
function pair(overrides) {
  const base = {
    version: 2, title: 'Test pair', view: 'side',
    frames: [
      { duration: 600, pose: { ...stand, root: { x: 40, y: 50 } }, partner: { pose: { ...stand, root: { x: 40, y: 50 } } } },
      { duration: 600, pose: { ...stand, upperArmL: 90, forearmL: 90, root: { x: 40, y: 50 } } },
    ],
  };
  return Object.assign(base, overrides || {});
}

test('validator: a well-formed pair passes; the partner need not move; the x limits are lifted for two bodies', () => {
  // standing at x=20 and x=80 mirrors to 20; give them room, and put the attacker far to the left
  const d = pair();
  d.frames[0].pose.root.x = 10; d.frames[1].pose.root.x = 10;
  d.frames[0].partner.pose.root.x = 5;   // mirrors to x=95
  assert.deepStrictEqual(SF.validate(d), []);
  // the same attacker alone would be flagged for leaving the frame sideways when pushed past it
  const solo = clone(d); delete solo.frames[0].partner; solo.frames[0].pose.root.x = -20; solo.frames[1].pose.root.x = -20;
  assert.ok(SF.validate(solo).some((e) => /leaves the frame sideways/.test(e)));
  const two = clone(d); two.frames[0].pose.root.x = -20; two.frames[1].pose.root.x = -20;
  assert.ok(!SF.validate(two).some((e) => /leaves the frame sideways/.test(e)), 'x limit should be lifted with a partner');
});

test('validator: the partner is checked by the same rules (hinge, floor), with its errors labelled', () => {
  const d = pair();
  d.frames[0].partner.pose.shinL = 40;   // thigh 0, shin 40: the knee folds the wrong way
  const errs = SF.validate(d);
  assert.ok(errs.some((e) => /^partner: .*knee/.test(e)), errs.join('\n'));
  const noP0 = pair(); noP0.frames[0] = { duration: 600, pose: noP0.frames[0].pose }; noP0.frames[1].partner = { pose: { ...stand, root: { x: 40, y: 50 } } };
  assert.ok(SF.validate(noP0).some((e) => /partner must be given in frame 0/.test(e)));
  const missing = pair(); delete missing.frames[0].partner.pose.torso;
  assert.ok(SF.validate(missing).some((e) => /partner: frame 0: torso missing/.test(e)));
});

test('validator: two torsos may not overlap, and a declared contact must touch', () => {
  const d = pair();
  d.frames[0].pose.root.x = 50; d.frames[1].pose.root.x = 50;
  d.frames[0].partner.pose.root.x = 50; // mirrors to 50: the same place
  assert.ok(SF.validate(d).some((e) => /torsos overlap/.test(e)));
  const apart = pair();
  apart.frames[0].pose.root.x = 20; apart.frames[1].pose.root.x = 20;
  apart.frames[0].partner.pose.root.x = 20;   // mirrors to 80
  assert.deepStrictEqual(SF.validate(apart), []);
  apart.frames[0].contacts = [{ a: 'handL', b: 'neck' }];
  assert.ok(SF.validate(apart).some((e) => /contact handL .* should touch neck/.test(e)));
  apart.frames[0].contacts = [{ a: 'nonsense', b: 'neck' }];
  assert.ok(SF.validate(apart).some((e) => /unknown joint or bone/.test(e)));
});

// ── never an empty box ──────────────────────────────────────────────────────
function fakeContainer() {
  const kids = [];
  const doc = { createElement: () => ({ style: {}, className: '', textContent: '' }) };
  return { ownerDocument: doc, children: kids, appendChild: (e) => kids.push(e), set innerHTML(v) { kids.length = 0; }, get innerHTML() { return ''; } };
}

test('Player.mount with no pose key shows the small "No diagram yet" state, not a blank box', () => {
  const c = fakeContainer();
  let err = null;
  SF.Player.mount(c, null, {}, (e) => { err = e; });
  assert.ok(err instanceof Error);
  assert.strictEqual(c.children.length, 1);
  assert.strictEqual(c.children[0].textContent, 'No diagram yet');
  assert.strictEqual(c.children[0].className, 'sf-empty');
});

test('Player.load for a pose that cannot be fetched shows it too, and a bad pose does not touch another card', async () => {
  global.fetch = async (url) => (/missing/.test(url) ? { ok: false, status: 404 } : { ok: true, json: async () => { throw new Error('bad json'); } });
  const a = fakeContainer(), b = fakeContainer(); const errs = [];
  await new Promise((res) => { let n = 0; const done = (e) => { errs.push(e); if (++n === 2) res(); };
    SF.Player.load(a, 'missing', {}, done); SF.Player.load(b, 'broken', {}, done); });
  assert.strictEqual(a.children[0].textContent, 'No diagram yet');
  assert.strictEqual(b.children[0].textContent, 'No diagram yet');
  assert.strictEqual(errs.length, 2);
  delete global.fetch;
});

// ── the exercise library ────────────────────────────────────────────────────
function seeded() {
  const src = fs.readFileSync(path.join(root, 'database.js'), 'utf8');
  const re = /\{ name: '((?:[^'\\]|\\.)+)',\s*category: '([a-z_]+)'/g, out = []; let m;
  while ((m = re.exec(src))) out.push({ name: m[1].replace(/\\'/g, "'"), category: m[2] });
  return out;
}

test('every martial-arts exercise has a named pose that exists, except the ones deliberately without', () => {
  const NONE = ['Inside Clinch Sweep (Dteh Chiang)'];   // a sweep; no pose shows it, so the card says "No diagram yet"
  const martial = seeded().filter((e) => ['mma', 'bjj', 'muay_thai'].includes(e.category));
  assert.ok(martial.length > 80, 'found ' + martial.length);
  const none = martial.filter((e) => !PM.match(e.name)).map((e) => e.name).sort();
  assert.deepStrictEqual(none, NONE);
  for (const e of martial) {
    const k = PM.match(e.name);
    if (k) assert.ok(poses[k], `${e.name} -> ${k} has no pose file`);
  }
});

test('the BJJ and clinch exercises that used to show a one-figure stand-in now show the two-figure move', () => {
  const want = {
    'Armbar from Guard': 'mma/bjj-armbar', 'Triangle Choke Setup': 'mma/bjj-triangle-choke',
    'Americana from Mount': 'mma/bjj-mount', 'Cross Collar Choke from Mount': 'mma/bjj-mount',
    'Parry and Counter Drill': 'mma/muay-thai-parry', 'Clinch Work': 'mma/muay-thai-clinch-knee',
    'Double Collar Tie (Plum)': 'mma/muay-thai-clinch-knee', 'Mount Escape — Elbow-Knee': 'shrimp',
    'Mountain Climber': 'mountain-climber',
  };
  for (const [n, k] of Object.entries(want)) assert.strictEqual(PM.match(n), k, n);
  for (const k of Object.values(want)) if (k.startsWith('mma/')) assert.ok(poses[k], k);
});

test('library.ejs: figures are rebuilt on every render, caught per card, and never left blank', () => {
  const src = fs.readFileSync(path.join(root, 'views', 'library.ejs'), 'utf8');
  // the regression: a flag that survived the re-render kept every card from being redrawn
  assert.doesNotMatch(src, /_sfPlayers\[exId\]\s*\)\s*return/);
  assert.match(src, /destroyFigures\(\);\s*\n\s*grid\.innerHTML/);
  assert.match(src, /StickFigurePlayer\.mount\(/);
  assert.match(src, /No diagram yet/);
  assert.match(src, /try \{[\s\S]*StickFigurePlayer\.mount[\s\S]*\} catch/);
});

test('the public session page shows a note, not an empty figure box, when no still could be drawn', () => {
  const src = fs.readFileSync(path.join(root, 'views', 'partials', 'sp-items.ejs'), 'utf8'); // the item markup is shared by session and plan pages
  assert.match(src, /No diagram yet/);
  assert.strictEqual(stillsFor('nope/nope').length, 0);
});
