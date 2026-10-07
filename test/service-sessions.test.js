'use strict';

/**
 * POST /api/service/sessions — one session per day/type, and titles from a
 * known list.
 *
 * ── Grouping (task: "exercises should be grouped by day") ────────────────────
 * Before this, every log_workout call did WorkoutSession.create, so a workout
 * reported across three messages made three sessions — the Logs page then
 * showed three "1 exercise · 1 set" cards for one day's training. Now a
 * session is found by date + type and APPENDED to; a new one is created only
 * when none exists for that day. Verified here two ways: a session count
 * check (the thing that regresses if the merge branch is ever removed — the
 * positive control for this half), and a direct read of WorkoutSets grouped
 * by exerciseOrder, which is exactly how octopus-health/index.js's /logs
 * route groups sets into exercise cards (~line 1111). Grouping by exerciseName
 * alone — which is how this file's own GET /sessions groups rows — would not
 * catch a restarted exerciseOrder, so the direct read is the real test.
 *
 * ── Titles (task: "it should use known titles, if one isn't known it should
 * ask to add them") ───────────────────────────────────────────────────────
 * A title is checked against SessionTitle the same way an exercise name is
 * checked against the account's own history (api/exercise-names.js) — except
 * every unrecognised title is a question, candidates or not, because the
 * title list is meant to stay short and curated. See api/session-titles.js.
 *
 * Uses the real database.js against throwaway accounts
 * (data/zz_svc_<pid>_*_health.sqlite, removed afterwards), like the other
 * DB-backed tests in this estate. Skips when express/sequelize/sqlite3 are
 * not installed.
 *
 * Run: node --test test/service-sessions.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

const stamp = `zz_svc_${process.pid}`;
const used = new Set();
function userFor(tag) {
  const name = `${stamp}_${tag}`;
  used.add(name);
  return name;
}

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
  for (const n of used) { try { fs.unlinkSync(path.join(__dirname, '..', 'data', `${n}_health.sqlite`)); } catch { /* not created */ } }
});

const svc = (user, method, p, body) => fetch(base + '/api/service' + p, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const post = (user, body) => svc(user, 'POST', '/sessions', body);

test('a workout reported across two messages is ONE session, not two', { skip }, async () => {
  const user = userFor('merge_a');

  const r1 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Bicep Curl', sets: [{ reps: 10, weight: 30 }] }],
  });
  assert.strictEqual(r1.status, 200);
  assert.ok(r1.body.sessionId, 'first message creates the session');

  const r2 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Squat', sets: [{ reps: 5, weight: 135 }] }],
  });
  assert.strictEqual(r2.status, 200);

  // The positive control for the whole merge: under the old behaviour (a
  // fresh WorkoutSession.create on every call) this would be a different id
  // and a second row in WorkoutSessions. If the merge branch is ever removed,
  // THIS assertion is what catches it.
  assert.strictEqual(r2.body.sessionId, r1.body.sessionId, 'second message appended to the first session');

  const db = getDatabase(user);
  await db.sequelize.sync();
  assert.strictEqual(await db.WorkoutSession.count({ where: { date: r1.body.date, type: 'strength' } }), 1);
});

test('exerciseOrder continues from the session\'s max, and a repeated exercise joins its group', { skip }, async () => {
  const user = userFor('order_a');

  const r1 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Bicep Curl', sets: [{ reps: 10, weight: 30 }] }],
  });
  await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Squat', sets: [{ reps: 5, weight: 135 }] }],
  });
  // Bicep Curl again, different weight so dedupe does not hold it — a second
  // real set of the same exercise, not a repeat of the first.
  await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Bicep Curl', sets: [{ reps: 8, weight: 35 }] }],
  });

  const db = getDatabase(user);
  await db.sequelize.sync();
  const sets = await db.WorkoutSet.findAll({
    where: { sessionId: r1.body.sessionId },
    order: [['exerciseOrder', 'ASC'], ['setNumber', 'ASC']],
  });

  // Grouped exactly the way octopus-health/index.js's /logs route groups them
  // — by exerciseOrder, not by name — so a restarted order would show up here
  // as a SECOND "Bicep Curl" group rather than one with two sets.
  const byOrder = new Map();
  for (const s of sets) {
    if (!byOrder.has(s.exerciseOrder)) byOrder.set(s.exerciseOrder, []);
    byOrder.get(s.exerciseOrder).push(s.toJSON());
  }
  const groups = [...byOrder.entries()].sort((a, b) => a[0] - b[0]);

  assert.strictEqual(groups.length, 2, 'two exercise groups: Bicep Curl and Squat, not three');
  const [curlOrder, curlSets] = groups[0];
  assert.strictEqual(curlSets[0].exerciseName, 'Bicep Curl');
  assert.deepStrictEqual(curlSets.map(s => s.setNumber), [1, 2], 'the third call continued setNumber, not restarted it');
  assert.deepStrictEqual(curlSets.map(s => s.weight), [30, 35]);

  const [squatOrder, squatSets] = groups[1];
  assert.strictEqual(squatSets[0].exerciseName, 'Squat');
  assert.notStrictEqual(squatOrder, curlOrder, 'different exercises never share an exerciseOrder');
  assert.strictEqual(squatOrder, curlOrder + 1, 'new exercise continues from the max, not from 0');
});

test('a different type on the same day creates a SEPARATE session', { skip }, async () => {
  const user = userFor('type_a');

  const strength = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 185 }] }],
  });
  const conditioning = await post(user, {
    type: 'conditioning',
    date: strength.body.date,
    sets: [{ exerciseName: 'Rowing Machine — Intervals', sets: [{ duration: 30 }] }],
  });

  assert.notStrictEqual(conditioning.body.sessionId, strength.body.sessionId,
    'Strength and Conditioning never merge, even on the same date');

  const db = getDatabase(user);
  await db.sequelize.sync();
  assert.strictEqual(await db.WorkoutSession.count({ where: { date: strength.body.date } }), 2,
    'one session per type, both present');
});

test('the dashboard Exercise row is one per day, not one per call', { skip }, async () => {
  const user = userFor('exrow_a');

  const r1 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Deadlift', sets: [{ reps: 5, weight: 225 }] }],
  });
  await post(user, {
    type: 'conditioning',
    date: r1.body.date,
    sets: [{ exerciseName: 'Burpee', sets: [{ reps: 15 }] }],
  });

  const db = getDatabase(user);
  await db.sequelize.sync();
  // One row for the day across BOTH calls — the old code called
  // Exercise.create on every POST, which would leave two rows here.
  assert.strictEqual(await db.Exercise.count({ where: { date: r1.body.date } }), 1);
});

test('needsTitle: an unknown title with a close match returns candidates and writes nothing', { skip }, async () => {
  const user = userFor('title_a');

  const r = await post(user, {
    type: 'strength', title: 'Legz',
    sets: [{ exerciseName: 'Leg Press', sets: [{ reps: 10, weight: 200 }] }],
  });

  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.sessionId, null, 'NOTHING was saved');
  assert.ok(r.body.needsTitle, 'asked about the title');
  assert.strictEqual(r.body.needsTitle.title, 'Legz');
  assert.ok(r.body.needsTitle.candidates.includes('Legs'), 'the close seeded default is offered');
  assert.match(r.body.message, /NOTHING WAS SAVED/);

  // The positive control for this half: under the old behaviour, a title was
  // whatever got passed, with no check at all — this would have written a
  // session titled "Legz" directly. If the needsTitle branch is ever removed,
  // THIS assertion is what catches it.
  const db = getDatabase(user);
  await db.sequelize.sync();
  assert.strictEqual(await db.WorkoutSession.count(), 0, 'no session exists yet');
  assert.ok(!(await db.SessionTitle.findOne({ where: { name: 'Legz' } })), 'the unconfirmed title was never added');
});

test('needsTitle: an unknown title with NO close match still asks, not silently logs', { skip }, async () => {
  const user = userFor('title_b');

  const r = await post(user, {
    type: 'strength', title: 'Zyzzyx Day',
    sets: [{ exerciseName: 'Leg Press', sets: [{ reps: 10, weight: 200 }] }],
  });

  assert.strictEqual(r.body.sessionId, null);
  assert.ok(r.body.needsTitle);
  assert.deepStrictEqual(r.body.needsTitle.candidates, [], 'nothing resembles it, and it is still asked about');
});

test('newTitle: true adds the title once and proceeds with the write', { skip }, async () => {
  const user = userFor('title_c');

  const asked = await post(user, {
    type: 'strength', title: 'Legz',
    sets: [{ exerciseName: 'Leg Press', sets: [{ reps: 10, weight: 200 }] }],
  });
  assert.ok(asked.body.needsTitle, 'sanity: this title is unknown before confirming');

  const r = await post(user, {
    type: 'strength', title: 'Legz', newTitle: true,
    sets: [{ exerciseName: 'Leg Press', sets: [{ reps: 10, weight: 200 }] }],
  });

  assert.strictEqual(r.status, 200);
  assert.ok(r.body.sessionId, 'written this time');
  assert.strictEqual(r.body.logged[0].exerciseName, 'Leg Press');

  const db = getDatabase(user);
  await db.sequelize.sync();
  const session = await db.WorkoutSession.findByPk(r.body.sessionId);
  assert.strictEqual(session.title, 'Legz');
  assert.ok(await db.SessionTitle.findOne({ where: { name: 'Legz' } }), 'the new title was added to the known list');
});

test('a known title (seeded default) resolves silently, no question asked', { skip }, async () => {
  const user = userFor('title_d');

  const r = await post(user, {
    type: 'strength', title: 'pull',   // case-insensitive match against the seeded "Pull"
    sets: [{ exerciseName: 'Pull-up', sets: [{ reps: 8 }] }],
  });

  assert.strictEqual(r.status, 200);
  assert.ok(!r.body.needsTitle, 'a known title (case aside) is never questioned');
  assert.ok(r.body.sessionId);

  const db = getDatabase(user);
  await db.sequelize.sync();
  const session = await db.WorkoutSession.findByPk(r.body.sessionId);
  assert.strictEqual(session.title, 'Pull', 'stored under the account\'s own seeded spelling, not the raw "pull"');
});

test('no title at all still works — falls back to type, exactly as before', { skip }, async () => {
  const user = userFor('title_e');

  const r = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Overhead Press', sets: [{ reps: 5, weight: 95 }] }],
  });

  assert.strictEqual(r.status, 200);
  assert.ok(!r.body.needsTitle, 'no title supplied is not an error');
  assert.ok(r.body.sessionId);

  const db = getDatabase(user);
  await db.sequelize.sync();
  const session = await db.WorkoutSession.findByPk(r.body.sessionId);
  assert.strictEqual(session.title, null, 'unchanged: the Logs page falls back to type on a null title');
});

test('dedupe and force still work exactly as before, now against the merged session', { skip }, async () => {
  const user = userFor('dedupe_a');

  const r1 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Plank', sets: [{ duration: 60 }] }],
  });
  assert.ok(r1.body.sessionId);

  // Identical set, same day — held, nothing written, nothing new appended.
  const r2 = await post(user, {
    type: 'strength',
    sets: [{ exerciseName: 'Plank', sets: [{ duration: 60 }] }],
  });
  assert.strictEqual(r2.body.sessionId, null);
  assert.ok(r2.body.needsConfirm.length, 'held as a duplicate, exactly as before');

  // force: true writes it — into the SAME session, as a second set of Plank,
  // continuing setNumber rather than starting a new group.
  const r3 = await post(user, {
    type: 'strength', force: true,
    sets: [{ exerciseName: 'Plank', sets: [{ duration: 60 }] }],
  });
  assert.strictEqual(r3.body.sessionId, r1.body.sessionId, 'forced write joined the existing session');

  const db = getDatabase(user);
  await db.sequelize.sync();
  const sets = await db.WorkoutSet.findAll({ where: { sessionId: r1.body.sessionId }, order: [['setNumber', 'ASC']] });
  assert.strictEqual(sets.length, 2);
  assert.deepStrictEqual(sets.map(s => s.setNumber), [1, 2]);
  assert.strictEqual(sets[0].exerciseOrder, sets[1].exerciseOrder, 'joined the same exercise group');
});
