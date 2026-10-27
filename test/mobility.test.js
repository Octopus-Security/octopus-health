'use strict';

/**
 * Mobility routines: every item maps to a known joint and muscle, the note ships,
 * and the done log is per user and per ET date.
 * Run: node --test test/mobility.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../lib/muscles');
const mob = require('../api/mobility');

let express, getDatabase;
try { express = require('express'); require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

test('five routines, with the required ids and the global note', () => {
  const ids = mob.ROUTINES.map(r => r.id);
  for (const id of ['daily-10', 'pre-training', 'injury-prevention', 'sunday-flow', 'run-pre', 'run-post']) assert.ok(ids.includes(id), id);
  assert.match(mob.NOTE, /Stretch to tension, not pain/);
  assert.match(mob.NOTE, /Achilles, knee or groin/);
});

test('every item maps to known joints and muscles, and ids are unique', () => {
  const seen = new Set();
  for (const r of mob.ROUTINES) {
    assert.ok(r.items.length > 0, r.id);
    for (const it of r.items) {
      assert.ok(!seen.has(it.id), `duplicate item id ${it.id}`); seen.add(it.id);
      assert.ok(it.rx && it.cue && it.name, `${it.id} is missing text`);
      assert.ok(it.joints.length > 0, `${it.id} has no joint`);
      for (const j of it.joints) assert.ok(M.isJoint(j), `${it.id}: unknown joint ${j}`);
      for (const m of it.muscles) assert.ok(M.isMuscle(m), `${it.id}: unknown muscle ${m}`);
    }
  }
});

test('the daily routine has the seven asked-for items', () => {
  assert.strictEqual(mob.ROUTINES.find(r => r.id === 'daily-10').items.length, 7);
});

test('every joint on the Body Map either has drills or is a deliberate gap', () => {
  const covered = Object.keys(M.JOINTS).filter(j => mob.itemsFor('joint', j).length);
  for (const j of ['neck', 'shoulder', 'wrist', 'thoracic_spine', 'lumbar_spine', 'hip', 'knee', 'ankle']) assert.ok(covered.includes(j), j);
});

test('the injury-prevention routine is attached to week-plan training days A and C only', () => {
  const W = require('../api/week-plan'), B = require('../api/benchmarks');
  const plan = W.buildPlan({
    tree: { skills: [], byId: new Map() }, st: new Map(), have: new Set(), focus: 'balanced',
    benchmarks: [], lastByItem: {}, date: '2026-10-28', benchmarkDay: B.DEFAULT_BENCHMARK_DAY,
  });
  const train = plan.days.filter(d => d.kind === 'train');
  assert.strictEqual(train.length, 3);
  assert.deepStrictEqual(train.map(d => !!d.routines), [true, false, true]);
  assert.deepStrictEqual(train[0].routines, ['injury-prevention']);
});

const stamp = `zz_mob_${process.pid}`;
const used = new Set();
let server, base;
before(async () => {
  if (skip) return;
  const app = express();
  app.use(express.json());
  const requireLogin = (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(401).end();
    used.add(u); req.user = { username: u }; next();
  };
  mob(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of used) { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* not created */ } }
});
const call = (user, method, p, body) => fetch(base + p, {
  method, headers: { 'x-test-user': user, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, j: await r.json().catch(() => null) }));

test('done logging: persists for today (ET), is idempotent, undoes, and is per user', { skip }, async () => {
  const a = `${stamp}_a`, b = `${stamp}_b`;
  let r = await call(a, 'GET', '/mobility/api/routines');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.j.done['daily-10'], false);
  assert.strictEqual(r.j.date, mob.etDate());
  r = await call(a, 'POST', '/mobility/api/done', { routine: 'daily-10' });
  assert.deepStrictEqual([r.status, r.j.done, r.j.date], [200, true, mob.etDate()]);
  await call(a, 'POST', '/mobility/api/done', { routine: 'daily-10' }); // twice: still one row
  r = await call(a, 'GET', '/mobility/api/routines');
  assert.strictEqual(r.j.done['daily-10'], true);
  assert.strictEqual(r.j.done['sunday-flow'], false);
  r = await call(b, 'GET', '/mobility/api/routines');
  assert.strictEqual(r.j.done['daily-10'], false, 'another account is unaffected');
  r = await call(a, 'POST', '/mobility/api/done', { routine: 'daily-10', done: false });
  assert.strictEqual(r.j.done, false);
  r = await call(a, 'GET', '/mobility/api/routines');
  assert.strictEqual(r.j.done['daily-10'], false);
});

test('done is keyed by ET date, not by a stale flag', { skip }, async () => {
  const u = `${stamp}_c`; used.add(u);
  const db = getDatabase(u); await db.sequelize.sync();
  await mob.setDone(db, 'daily-10', true, '2026-01-01');
  assert.strictEqual(await mob.isDone(db, 'daily-10', '2026-01-01'), true);
  assert.strictEqual((await mob.doneToday(db))['daily-10'], false);
});

test('unknown routine, joint and muscle are 404; a bad session is refused', { skip }, async () => {
  const u = `${stamp}_d`;
  assert.strictEqual((await call(u, 'POST', '/mobility/api/done', { routine: 'nope' })).status, 404);
  assert.strictEqual((await call(u, 'GET', '/mobility/api/joint/elbowx')).status, 404);
  assert.strictEqual((await call(u, 'GET', '/mobility/api/muscle/zzz')).status, 404);
  assert.strictEqual((await fetch(base + '/mobility/api/routines')).status, 401);
});

test('GET joint lists the drills for it', { skip }, async () => {
  const r = await call(`${stamp}_e`, 'GET', '/mobility/api/joint/ankle');
  assert.strictEqual(r.status, 200);
  assert.ok(r.j.items.some(i => i.id === 'heel-drop'));
  assert.ok(r.j.note);
});
