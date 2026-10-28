'use strict';

/**
 * Coaching (phase 3): pattern matching, PR-per-exposure, the 4-exposure plateau,
 * weak point from failed-set taps, the recommendation, then the real database
 * and routes. DB parts skip without express/ejs/sequelize/sqlite3.
 *
 * Run: node --test test/coaching.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../api/coaching');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

let nextId = 1;
const set = (sessionId, date, exerciseName, reps, extra = {}) => ({ id: nextId++, sessionId, date, exerciseName, reps, weight: null, duration: null, failed: false, failPoint: null, ...extra });
const pat = (r, id) => r.patterns.find(p => p.id === id);

test('content: variation ids unique, every requirement is a real equipment id, every bias is known', () => {
  const E = require('../api/equipment');
  const ids = new Set(), known = new Set(['bottom', 'middle', 'top', 'grip', 'stability', 'skill', 'power']);
  for (const p of C.PATTERNS) for (const v of p.variations) {
    assert.ok(!ids.has(v.id), v.id); ids.add(v.id);
    for (const b of v.bias) assert.ok(known.has(b), `${v.id}: ${b}`);
    for (const rq of v.requires) for (const a of rq.split('|')) assert.ok(E.IDS.includes(a), `${v.id} needs unknown ${a}`);
  }
  assert.strictEqual(C.PATTERNS.length, 6);
});

test('match: names resolve across plurals and case, unknown names do not', () => {
  assert.strictEqual(C.match('pull ups').variation.id, 'pull-up');
  assert.strictEqual(C.match('Chin-Up').variation.id, 'chin-up');
  assert.strictEqual(C.match('Basket Weaving'), null);
});

test('a set scores weight first, then reps; unweighted on reps; timed on seconds', () => {
  assert.deepStrictEqual(C.setScore({ weight: 45, reps: 8 }), [45, 8]);
  assert.deepStrictEqual(C.setScore({ reps: 12 }), [0, 12]);
  assert.deepStrictEqual(C.setScore({ duration: 30 }), [0, 30]);
});

test('PR is relative to the variation\'s own history; the first exposure is a PR', () => {
  const byVar = C.exposuresOf([set(1, '2026-10-01', 'Pull-up', 8), set(2, '2026-10-03', 'Pull-up', 8), set(3, '2026-10-05', 'Pull-up', 9), set(3, '2026-10-05', 'Chin-up', 3)]);
  assert.deepStrictEqual(byVar.get('pull-up').map(e => e.pr), [true, false, true]);
  assert.deepStrictEqual(byVar.get('chin-up').map(e => e.pr), [true], 'another variation has its own bar');
});

test('weight beats reps: more weight at fewer reps is a PR; same weight needs more reps', () => {
  const byVar = C.exposuresOf([set(1, '2026-10-01', 'Push-up', 20, { weight: 0 }), set(2, '2026-10-02', 'Bench Press', 8, { weight: 100 }), set(3, '2026-10-03', 'Bench Press', 5, { weight: 120 }), set(4, '2026-10-04', 'Bench Press', 6, { weight: 120 })]);
  assert.deepStrictEqual(byVar.get('bench-press').map(e => e.pr), [true, true, true]);
  const bv = C.exposuresOf([set(1, '2026-10-01', 'Bench Press', 8, { weight: 100 }), set(2, '2026-10-02', 'Bench Press', 7, { weight: 100 })]);
  assert.deepStrictEqual(bv.get('bench-press').map(e => e.pr), [true, false]);
});

function session(n, date, reps, name = 'Pull-up', extra = {}) { return set(n, date, name, reps, extra); }
const days = n => Array.from({ length: n }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

test('plateau: exactly 4 exposures after the last PR; 3 is not enough', () => {
  const d = days(6);
  const three = [session(1, d[0], 8), session(2, d[1], 8), session(3, d[2], 8), session(4, d[3], 7)];
  let p = pat(C.analyse(three), 'vertical-pull');
  assert.strictEqual(p.plateau, false);
  assert.strictEqual(p.current.sinceLastPr, 3);
  assert.strictEqual(p.current.exposuresToPlateau, 1);
  const four = [...three, session(5, d[4], 8)];
  p = pat(C.analyse(four), 'vertical-pull');
  assert.strictEqual(p.plateau, true);
  assert.strictEqual(p.current.sinceLastPr, 4);
  assert.ok(p.recommendation && p.recommendation.rule);
});

test('a PR resets the count', () => {
  const d = days(7);
  const rows = [session(1, d[0], 8), session(2, d[1], 8), session(3, d[2], 8), session(4, d[3], 8), session(5, d[4], 9), session(6, d[5], 8)];
  const p = pat(C.analyse(rows), 'vertical-pull');
  assert.strictEqual(p.current.sinceLastPr, 1);
  assert.strictEqual(p.plateau, false);
});

test('weak point comes only from failed-set taps; an untapped failed set or an unfailed one adds nothing', () => {
  const d = days(6);
  const rows = [
    session(1, d[0], 8), session(2, d[1], 8, 'Pull-up', { failed: true, failPoint: 'top' }), session(3, d[2], 8, 'Pull-up', { failed: true, failPoint: 'top' }),
    session(4, d[3], 8, 'Pull-up', { failed: true, failPoint: 'grip' }), session(5, d[4], 8, 'Pull-up', { failed: true }),
    session(6, d[5], 8, 'Pull-up', { failed: false, failPoint: 'bottom' }),
  ];
  const p = pat(C.analyse(rows), 'vertical-pull');
  assert.strictEqual(p.weakPoint.point, 'top');
  assert.deepStrictEqual(p.weakPoint.counts, { bottom: 0, middle: 0, top: 2, grip: 1 });
});

test('a tie goes to the most recent tap', () => {
  const d = days(3);
  const p = pat(C.analyse([session(1, d[0], 8, 'Pull-up', { failed: true, failPoint: 'top' }), session(2, d[1], 8, 'Pull-up', { failed: true, failPoint: 'grip' })]), 'vertical-pull');
  assert.strictEqual(p.weakPoint.point, 'grip');
});

test('recommendation: rotates to a variation biasing the weak point, never the current one', () => {
  const d = days(6);
  const rows = [session(1, d[0], 8), session(2, d[1], 8), session(3, d[2], 8, 'Pull-up', { failed: true, failPoint: 'grip' }), session(4, d[3], 8), session(5, d[4], 8)];
  const p = pat(C.analyse(rows), 'vertical-pull');
  assert.strictEqual(p.plateau, true);
  assert.strictEqual(p.recommendation.variation, 'towel-pull-up');
  assert.match(p.recommendation.why, /grip/);
  const bottom = rows.map(r => ({ ...r, failPoint: r.failed ? 'bottom' : null }));
  assert.strictEqual(pat(C.analyse(bottom), 'vertical-pull').recommendation.variation, 'chin-up');
});

test('recommendation: no taps says so and still avoids the current variation', () => {
  const d = days(6);
  const p = pat(C.analyse(d.slice(0, 5).map((x, i) => session(i + 1, x, 8))), 'vertical-pull');
  assert.strictEqual(p.weakPoint, null);
  assert.notStrictEqual(p.recommendation.variation, 'pull-up');
  assert.match(p.recommendation.why, /Tap where/);
});

test('recommendation respects equipment; a weak point nothing available biases falls back and says so', () => {
  const d = days(6);
  const rows = d.slice(0, 5).map((x, i) => session(i + 1, x, 8, 'Push-up', i === 0 ? { failed: true, failPoint: 'bottom' } : {}));
  // only floor + wall + chair: no handles/parallettes, so the deficit push-up (bottom) is out.
  const p = pat(C.analyse(rows, new Set(['wall', 'chair'])), 'horizontal-push');
  assert.strictEqual(p.plateau, true);
  assert.notStrictEqual(p.recommendation.variation, 'deficit-push-up');
  assert.notStrictEqual(p.recommendation.variation, 'bench-press');
  assert.match(p.recommendation.why, /No available variation biases the bottom/);
  const withHandles = pat(C.analyse(rows, new Set(['wall', 'chair', 'handles'])), 'horizontal-push');
  assert.strictEqual(withHandles.recommendation.variation, 'deficit-push-up');
});

test('patterns with no history report no current variation and no recommendation', () => {
  const p = pat(C.analyse([]), 'squat');
  assert.strictEqual(p.current, null);
  assert.strictEqual(p.recommendation, null);
  assert.ok(p.variations.length >= 5);
});

test('the current variation is the most recently done, so rotating moves the count to the new one', () => {
  const d = days(8);
  const rows = [session(1, d[0], 8), session(2, d[1], 8), session(3, d[2], 8), session(4, d[3], 8), session(5, d[4], 8), session(6, d[5], 4, 'Towel Pull-up')];
  const p = pat(C.analyse(rows), 'vertical-pull');
  assert.strictEqual(p.current.id, 'towel-pull-up');
  assert.strictEqual(p.plateau, false);
});

// ── the database and routes ──────────────────────────────────────────────────
const stamp = `zz_coach_${process.pid}`;
const U = `${stamp}_a`, V = `${stamp}_b`;
let server, base;

before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  const requireLogin = (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'coaching';
    next();
  };
  require('../api/web-coaching')(app, { requireLogin, getDatabase });
  require('../api/web-log-edit')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [U, V]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});
const web = (user, method, p, body) => fetch(base + p, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Test-User': user }, body: body ? JSON.stringify(body) : undefined });

async function seed(user, n, name = 'Pull-up') {
  const db = getDatabase(user);
  await db.sequelize.sync(); await db.migrate(); await db.seedData();
  const ids = [];
  for (let i = 0; i < n; i++) {
    const s = await db.WorkoutSession.create({ date: days(n)[i], type: 'strength', status: 'finished' });
    const st = await db.WorkoutSet.create({ sessionId: s.id, exerciseName: name, exerciseOrder: 0, setNumber: 1, reps: 8 });
    ids.push(st.id);
  }
  return { db, ids };
}

test('migration is additive and rerunnable; the columns exist and default to not failed', { skip }, async () => {
  const { db } = await seed(U, 1);
  await db.migrate(); await db.migrate();
  const [rows] = await db.sequelize.query(`PRAGMA table_info("WorkoutSets")`);
  assert.ok(rows.some(r => r.name === 'failed') && rows.some(r => r.name === 'failPoint'));
  const st = await db.WorkoutSet.findOne();
  assert.strictEqual(!!st.failed, false);
});

test('tapping a failed set through the set editor feeds the weak point, and validates the point', { skip }, async () => {
  const { ids } = await seed(U, 5);
  let r = await web(U, 'PATCH', `/logs/api/set/${ids[0]}`, { failed: true, failPoint: 'sideways' });
  assert.strictEqual(r.status, 400);
  r = await web(U, 'PATCH', `/logs/api/set/${ids[0]}`, { failed: true, failPoint: 'grip' });
  assert.strictEqual(r.status, 200);
  const j = await r.json();
  assert.strictEqual(j.set.failed, true); assert.strictEqual(j.set.failPoint, 'grip');

  const s = await (await web(U, 'GET', '/coaching/api/status')).json();
  const p = s.patterns.find(x => x.id === 'vertical-pull');
  assert.strictEqual(p.plateau, true);
  assert.strictEqual(p.weakPoint.point, 'grip');
  assert.strictEqual(p.recommendation.variation, 'towel-pull-up');

  r = await web(U, 'PATCH', `/logs/api/set/${ids[0]}`, { failed: false });
  assert.strictEqual((await r.json()).set.failPoint, null, 'un-failing clears the point');
});

test('the page renders, and a login is required', { skip }, async () => {
  assert.strictEqual((await web(U, 'GET', '/coaching')).status, 200);
  const html = await (await web(U, 'GET', '/coaching')).text();
  assert.match(html, /Vertical pull/); assert.match(html, /Plateau/);
  assert.strictEqual((await fetch(base + '/coaching', { redirect: 'manual' })).status, 302);
  assert.strictEqual((await fetch(base + '/coaching/api/status', { redirect: 'manual' })).status, 302);
});

test('accounts are separate files: one account\'s sets never show in another\'s coaching', { skip }, async () => {
  await seed(V, 0);
  const s = await (await web(V, 'GET', '/coaching/api/status')).json();
  assert.ok(s.patterns.every(p => p.current === null));
});

test('active (unfinished) sessions do not count as exposures', { skip }, async () => {
  const db = getDatabase(V);
  const s = await db.WorkoutSession.create({ date: '2026-10-01', type: 'strength', status: 'active' });
  await db.WorkoutSet.create({ sessionId: s.id, exerciseName: 'Pull-up', exerciseOrder: 0, setNumber: 1, reps: 5 });
  const st = await (await web(V, 'GET', '/coaching/api/status')).json();
  assert.strictEqual(st.patterns.find(x => x.id === 'vertical-pull').current, null);
});
