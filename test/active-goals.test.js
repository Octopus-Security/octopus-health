'use strict';

/**
 * Active goals: status / priority / kind / inBrief / nudge, and ONE definition of "active".
 *
 * Covers the migration (additive, rerun-safe, backfills completed -> done), the helper in
 * api/goals.js (ET deadline, paused excluded, ordering), the service routes (GET filters,
 * PATCH, reorder), per-user isolation, and the /goals page rendering.
 *
 * Run: node --test test/active-goals.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, getDatabase, Sequelize, ejs;
try { express = require('express'); ({ Sequelize } = require('sequelize')); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
try { ejs = require('ejs'); } catch { /* the render test skips */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';
const goalsApi = require('../api/goals');

const pid = process.pid;
const userA = `zz_ag_a_${pid}`;
const userB = `zz_ag_b_${pid}`;
const userOld = `zz_ag_old_${pid}`;
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
  for (const u of [userA, userB, userOld]) {
    try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${u}_health.sqlite`)); } catch { /* not created */ }
  }
});

const svc = (user, method, p, body) => fetch(base + '/api/service' + p, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const titles = r => r.body.goals.map(g => g.title);

// ── Migration ────────────────────────────────────────────────────────────────

test('migration adds the columns, backfills completed -> done, and is rerun-safe', { skip }, async () => {
  // A database as it was BEFORE this change: a Goals table without the new columns.
  const file = path.join(process.env.DATA_DIR, `${userOld}_health.sqlite`);
  const legacy = new Sequelize({ dialect: 'sqlite', storage: file, logging: false });
  await legacy.query(`CREATE TABLE "Goals" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "type" TEXT NOT NULL, "targetValue" FLOAT NOT NULL,
    "currentValue" FLOAT, "deadline" DATE, "description" TEXT, "completed" TINYINT(1) DEFAULT 0, "title" VARCHAR(255),
    "exerciseName" VARCHAR(255), "unit" VARCHAR(32), "progression" TEXT, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`);
  const now = new Date().toISOString();
  await legacy.query(`INSERT INTO "Goals" (type,targetValue,completed,title,createdAt,updatedAt) VALUES ('exercise',1,1,'Old finished',?,?),('exercise',1,0,'Old open',?,?)`,
    { replacements: [now, now, now, now] });
  await legacy.close();

  const db = getDatabase(userOld);
  await db.sequelize.sync();
  await db.migrate();
  await db.migrate();   // a second run must change nothing and throw nothing
  let rows = await db.Goal.findAll({ order: [['id', 'ASC']] });
  assert.deepStrictEqual(rows.map(r => [r.title, r.status, r.completed, r.inBrief, r.nudge, r.priority, r.kind]),
    [['Old finished', 'done', true, true, false, null, null], ['Old open', 'active', false, true, false, null, null]]);

  // After the migration a goal is paused, then migrate runs again (a restart): still paused.
  await rows[1].update({ status: 'paused' });
  await db.migrate();
  rows = await db.Goal.findAll({ order: [['id', 'ASC']] });
  assert.strictEqual(rows[1].status, 'paused');
  // A reopened goal (done -> active, completed false) is not dragged back to done.
  await rows[0].update({ status: 'active', completed: false });
  await db.migrate();
  assert.strictEqual((await db.Goal.findByPk(rows[0].id)).status, 'active');
});

// ── The helper ───────────────────────────────────────────────────────────────

test('etDay is the ET date, not UTC', () => {
  // 2026-10-27 02:30 UTC is still 10-26 in New York
  assert.strictEqual(goalsApi.etDay(0, new Date('2026-10-27T02:30:00Z')), '2026-10-26');
  assert.strictEqual(goalsApi.etDay(1, new Date('2026-10-27T02:30:00Z')), '2026-10-27');
});

test('byPriority: lower first, null last, then oldest, then id', () => {
  const g = (id, priority, createdAt) => ({ id, priority, createdAt });
  const sorted = [g(1, null, '2026-01-01'), g(2, 2, '2026-03-01'), g(3, 1, '2026-04-01'), g(4, 2, '2026-02-01'), g(5, null, '2026-01-01')].sort(goalsApi.byPriority);
  assert.deepStrictEqual(sorted.map(x => x.id), [3, 4, 2, 1, 5]);
});

test('listActive: paused and done excluded, deadline judged on the ET date, brief needs inBrief', { skip }, async () => {
  const { Goal, sequelize } = getDatabase(userA);
  await sequelize.sync(); await getDatabase(userA).migrate();
  const today = goalsApi.etDay(0);
  const mk = (title, extra = {}) => Goal.create({ type: 'exercise', targetValue: 1, title, ...extra });
  await mk('late', { priority: null });
  await mk('first', { priority: 1 });
  await mk('second', { priority: 2 });
  await mk('paused', { status: 'paused', priority: 1 });
  await mk('done', { status: 'done', completed: true });
  await mk('expired', { deadline: goalsApi.etDay(-1) });
  await mk('due today', { deadline: today, priority: 3 });
  await mk('not in brief', { inBrief: false, priority: 4 });

  assert.deepStrictEqual((await goalsApi.listActive(Goal)).map(g => g.title),
    ['first', 'second', 'due today', 'not in brief', 'late']);
  assert.deepStrictEqual((await goalsApi.listActive(Goal, { brief: true })).map(g => g.title),
    ['first', 'second', 'due today', 'late']);
  // Tomorrow's brief is judged against tomorrow's date: the goal due today has gone by then.
  assert.deepStrictEqual((await goalsApi.listActive(Goal, { brief: true, day: goalsApi.etDay(1) })).map(g => g.title),
    ['first', 'second', 'late']);
  // positive control: nothing is deleted
  assert.strictEqual((await goalsApi.listAll(Goal)).length, 8);
});

test('fromBody keeps completed and status in step, and rejects bad enums', () => {
  assert.deepStrictEqual(goalsApi.fromBody({ completed: true }, { status: 'active' }).status, 'done');
  const reopened = goalsApi.fromBody({ completed: false }, { status: 'done' });
  assert.strictEqual(reopened.status, 'active'); assert.strictEqual(reopened.completed, false);
  const paused = goalsApi.fromBody({ completed: false }, { status: 'paused' });
  assert.strictEqual(paused.status, 'paused');   // un-completing does not un-pause
  assert.strictEqual(goalsApi.fromBody({ status: 'done' }, { status: 'active' }).completed, true);
  assert.deepStrictEqual(goalsApi.fromBody({ title: 'x' }, { status: 'paused' }), { title: 'x' });   // a PATCH changes only what it names
  assert.throws(() => goalsApi.fromBody({ status: 'bogus' }), /status must be/);
  assert.throws(() => goalsApi.fromBody({ kind: 'bogus' }), /kind must be/);
  assert.throws(() => goalsApi.fromBody({ priority: 1.5 }), /whole number/);
  // an HTML form omits unticked checkboxes
  const f = goalsApi.fromBody({ title: 't', inBrief: '1' }, null, { form: true });
  assert.strictEqual(f.inBrief, true); assert.strictEqual(f.nudge, false);
  assert.strictEqual(goalsApi.fromBody({}, null, { form: true }).inBrief, false);
});

// ── Service routes ───────────────────────────────────────────────────────────

test('service GET ?active=1 and ?brief=1, in order; no ?active returns everything', { skip }, async () => {
  const all = await svc(userA, 'GET', '/goals');
  assert.strictEqual(all.body.goals.length, 8);
  const active = await svc(userA, 'GET', '/goals?active=1');
  assert.deepStrictEqual(titles(active), ['first', 'second', 'due today', 'not in brief', 'late']);
  const brief = await svc(userA, 'GET', '/goals?active=1&brief=1');
  assert.deepStrictEqual(titles(brief), ['first', 'second', 'due today', 'late']);
});

test('service POST takes the new fields; PATCH changes only what it names', { skip }, async () => {
  const c = await svc(userB, 'POST', '/goals', { title: 'Handstand', kind: 'skill', priority: 2, inBrief: false, nudge: true });
  assert.strictEqual(c.status, 200, JSON.stringify(c.body));
  const g = c.body.goal;
  assert.deepStrictEqual([g.status, g.kind, g.priority, g.inBrief, g.nudge, g.completed], ['active', 'skill', 2, false, true, false]);

  const p = await svc(userB, 'PATCH', `/goals/${g.id}`, { currentValue: 5, progression: 'wall holds' });
  assert.deepStrictEqual([p.body.goal.title, p.body.goal.kind, p.body.goal.inBrief, p.body.goal.currentValue], ['Handstand', 'skill', false, 5]);

  const paused = await svc(userB, 'PATCH', `/goals/${g.id}`, { status: 'paused' });
  assert.strictEqual(paused.body.goal.completed, false);
  assert.deepStrictEqual(titles(await svc(userB, 'GET', '/goals?active=1')), []);

  const done = await svc(userB, 'PATCH', `/goals/${g.id}`, { completed: true });
  assert.deepStrictEqual([done.body.goal.status, done.body.goal.completed], ['done', true]);
  const reopened = await svc(userB, 'PATCH', `/goals/${g.id}`, { status: 'active' });
  assert.deepStrictEqual([reopened.body.goal.status, reopened.body.goal.completed], ['active', false]);

  const bad = await svc(userB, 'PATCH', `/goals/${g.id}`, { status: 'bogus' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual((await svc(userB, 'GET', '/goals')).body.goals[0].status, 'active');   // the rejected write changed nothing
  assert.strictEqual((await svc(userB, 'POST', '/goals', { title: 'x', kind: 'bogus' })).status, 400);
});

test('service POST restating an open goal updates it and does not un-pause it', { skip }, async () => {
  const a = await svc(userB, 'POST', '/goals', { title: 'Visible Abs', progression: 'v1' });
  await svc(userB, 'PATCH', `/goals/${a.body.goal.id}`, { status: 'paused' });
  const b = await svc(userB, 'POST', '/goals', { title: 'visible abs -> 1', progression: 'v2' });
  assert.strictEqual(b.body.updatedExisting, true);
  assert.deepStrictEqual([b.body.goal.id, b.body.goal.progression, b.body.goal.status], [a.body.goal.id, 'v2', 'paused']);
});

test('service reorder sets priorities 1..n in the order given', { skip }, async () => {
  const mk = async t => (await svc(userB, 'POST', '/goals', { title: t })).body.goal.id;
  const [x, y, z] = [await mk('rx'), await mk('ry'), await mk('rz')];
  const r = await svc(userB, 'POST', '/goals/reorder', { ids: [z, x, y] });
  assert.deepStrictEqual(r.body.ids, [z, x, y]);
  const active = await svc(userB, 'GET', '/goals?active=1');
  assert.deepStrictEqual(active.body.goals.filter(g => ['rx', 'ry', 'rz'].includes(g.title)).map(g => [g.title, g.priority]),
    [['rz', 1], ['rx', 2], ['ry', 3]]);
  assert.strictEqual((await svc(userB, 'POST', '/goals/reorder', { ids: 'nope' })).status, 400);
  assert.strictEqual((await svc(userB, 'POST', '/goals/reorder', { ids: ['1; DROP'] })).status, 400);
});

test('goals are per user: another account cannot see, patch or reorder them', { skip }, async () => {
  const mine = (await svc(userB, 'GET', '/goals')).body.goals;
  assert.ok(mine.length > 0);
  const aTitles = titles(await svc(userA, 'GET', '/goals'));
  assert.ok(!aTitles.includes('rx') && !aTitles.includes('Handstand'));
  // A's database has its own id space; use a B-only title to prove a cross-account write does nothing.
  const bRow = mine.find(g => g.title === 'rx');
  const before = (await svc(userB, 'GET', '/goals')).body.goals.find(g => g.id === bRow.id);
  const aGoal = (await svc(userA, 'GET', '/goals')).body.goals.find(g => g.id === bRow.id);
  await svc(userA, 'PATCH', `/goals/${bRow.id}`, { title: 'hijacked' });
  await svc(userA, 'POST', '/goals/reorder', { ids: [bRow.id] });
  const after = (await svc(userB, 'GET', '/goals')).body.goals.find(g => g.id === bRow.id);
  assert.deepStrictEqual([after.title, after.priority], [before.title, before.priority]);
  if (aGoal) assert.notStrictEqual(aGoal.title, 'rx');
});

// ── The page ─────────────────────────────────────────────────────────────────

test('goals.ejs renders every field, the status pill and the brief preview', { skip: skip || (!ejs && 'ejs not installed') }, async () => {
  const { Goal } = getDatabase(userA);
  const goals = await goalsApi.listAll(Goal);
  const briefGoals = await goalsApi.listActive(Goal, { brief: true, day: goalsApi.etDay(1) });
  const order = goals.map(g => g.id);
  const swaps = Object.fromEntries(goals.map(g => [g.id, { up: null, down: order.join(',') }]));
  const editId = goals[0].id;
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'goals.ejs'), {
    title: 'Goals', user: { username: userA, role: 'user' }, goals, briefGoals, swaps, editId, todayET: goalsApi.etDay(),
    STATUSES: goalsApi.STATUSES, KINDS: goalsApi.KINDS, asset: p => p, activeTab: 'goals',
  });
  assert.match(html, /Tomorrow's Discord brief will include/);
  assert.match(html, /status-pill paused/);
  assert.match(html, /name="priority"/);
  assert.match(html, /name="inBrief"/);
  assert.match(html, /name="nudge"/);
  assert.match(html, /action="\/goals\/edit\/\d+"/);
  assert.match(html, /name="currentValue"/);
  assert.match(html, /name="progression"/);
  const previewBlock = html.split('Tomorrow\'s Discord brief will include')[1].split('Your Goals')[0];
  for (const g of briefGoals) assert.ok(previewBlock.includes(g.title), g.title);
  assert.ok(!previewBlock.includes('not in brief') || previewBlock.includes('Active goals that are not'), 'preview is only the brief set');
  assert.ok(!/<li[^>]*>\s*paused\b/.test(previewBlock));
});
