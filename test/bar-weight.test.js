'use strict';

/**
 * "bar" as a load, through the real log route (POST /api/service/sessions/from-text).
 *
 * 2026-11-11 the owner logged
 *     Incline chest press 45lb bar:
 *     5 x bar
 *     10 x bar + 50
 *     5 x bar + 100
 * and it was stored as bodyweight / 50 / 100 instead of 45 / 95 / 145: "bar + N" (bar
 * FIRST) was not read as bar plus plates, and a bare "bar" load was dropped. Only
 * "N + bar" worked. Each test asserts the ROW, not the response.
 *
 * Run: node --test test/bar-weight.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseWorkout } = require('../api/workout-parse');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

const stamp = `zz_bar_${process.pid}`;
const used = new Set();
const userFor = tag => { const n = `${stamp}_${tag}`; used.add(n); return n; };
let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of used) { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ } }
});
const fromText = (user, text, extra = {}) => fetch(base + '/api/service/sessions/from-text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: JSON.stringify({ text, date: '2026-11-11', ...extra }),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
async function rows(user) {
  const db = getDatabase(user); await db.sequelize.sync();
  return (await db.WorkoutSet.findAll({ order: [['exerciseOrder', 'ASC'], ['setNumber', 'ASC']] }))
    .map(s => [s.exerciseName, s.reps, s.weight, s.weightUnit, s.notes]);
}

const TODAY = 'Incline chest press 45lb bar:\n5 x bar\n10 x bar + 50\n5 x bar + 100';

test('the owner\'s exact text is stored as 45 / 95 / 145', { skip }, async () => {
  const user = userFor('exact');
  const r = await fromText(user, TODAY);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.sessionId, JSON.stringify(r.body));
  const got = await rows(user);
  assert.deepStrictEqual(got.map(g => [g[1], g[2], g[3]]), [[5, 45, 'lbs'], [10, 95, 'lbs'], [5, 145, 'lbs']]);
  assert.match(got[1][4], /50 \+ 45lb bar/, 'the note keeps how the total was read');
});

test('a bar declared in the header (any unit) is the bar', { skip }, async () => {
  const user = userFor('kg');
  await fromText(user, 'Overhead press bar 20kg:\n5 x bar\n8 x bar + 10');
  assert.deepStrictEqual((await rows(user)).map(g => [g[1], g[2], g[3]]), [[5, 20, 'kg'], [8, 30, 'kg']]);
});

test('"EZ bar 25" declares a 25 lb bar; bar-first and plates-first read the same', { skip }, async () => {
  const user = userFor('ez');
  await fromText(user, 'Curl EZ bar 25:\n10 x bar + 15\n10 x 15 + bar\nbar x 12');
  assert.deepStrictEqual((await rows(user)).map(g => [g[1], g[2]]), [[10, 40], [10, 40], [12, 25]]);
});

test('no bar declared: bar is the standard 45 lb bar, said in the note, NEVER bodyweight', { skip }, async () => {
  const user = userFor('undeclared');
  await fromText(user, 'Bench press:\n5 x bar\n10 x bar + 20');
  const got = await rows(user);
  assert.deepStrictEqual(got.map(g => [g[1], g[2]]), [[5, 45], [10, 65]]);
  assert.ok(got.every(g => g[2] != null && g[2] > 0), 'no bodyweight (null) set');
  assert.match(got[0][4], /45lb bar/);
});

test('"90lb each side x 10" keeps its load and its each-side note', { skip }, async () => {
  const user = userFor('side');
  await fromText(user, 'Incline press:\n90lb each side x 10\n10 x bar + 50');
  const got = await rows(user);
  assert.deepStrictEqual([got[0][1], got[0][2], got[0][4]], [10, 90, 'each side']);
  assert.strictEqual(got[1][2], 95);
});

test('things that are not a bar load are untouched', { skip: false }, () => {
  const w = t => parseWorkout(t).exercises.map(e => e.sets.map(s => s.weight));
  assert.deepStrictEqual(w('curls:\n10 x 25lb ez bar'), [[25]]);
  assert.deepStrictEqual(w('Pull up bar 3 sets:\n10 x 5').length, 1);
  assert.deepStrictEqual(w('Bar = 35 lbs\nsquat:\nbar x 5\nbar+10 x 5'), [[35, 45]]);
  assert.deepStrictEqual(parseWorkout(TODAY).unparsed, []);
});
