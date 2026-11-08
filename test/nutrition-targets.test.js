'use strict';

/**
 * Nutrition targets: validation, the estimate floor, unlogged vs zero days, per-account
 * isolation, migration idempotence, and the pages/service route over a real express.
 * DB parts skip without express/ejs/sequelize/sqlite3.
 *
 * Run: node --test test/nutrition-targets.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const N = require('../api/nutrition-targets');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

// ── pure rules ───────────────────────────────────────────────────────────────
test('validate: accepts calories + protein, rounds, carbs/fat optional and null when absent', () => {
  const v = N.validateTargets({ calories: '2200.4', protein: 150 });
  assert.deepStrictEqual(v, { calories: 2200, protein: 150, carbs: null, fats: null, source: 'manual' });
  assert.strictEqual(N.validateTargets({ protein: 120 }).calories, null);
});
test('validate: refuses empty, non-numeric, out-of-range and bad source', () => {
  for (const bad of [{}, { carbs: 200 }, { calories: 'lots' }, { calories: 799 }, { calories: 6001 }, { protein: 5 }, { protein: 401 }, { calories: 2000, carbs: -1 }, { calories: 2000, fats: 501 }, { calories: 2000, source: 'llm' }]) {
    assert.throws(() => N.validateTargets(bad), e => e.status === 400, JSON.stringify(bad));
  }
});
test('estimate: transparent formula, protein 1.6 g/kg, marked as an estimate with the note', () => {
  const e = N.estimate({ weight: 80, unit: 'kg', goal: 'maintain', activity: 'moderate' });
  assert.strictEqual(e.maintenance, 80 * 34);
  assert.strictEqual(e.calories, 2720);
  assert.strictEqual(e.protein, 128);
  assert.strictEqual(e.estimate, true);
  assert.match(e.note, /not medical advice/);
  assert.match(e.working, /80 kg x 34/);
});
test('estimate: never below the floor, even for a small person losing weight', () => {
  const e = N.estimate({ weight: 45, unit: 'kg', goal: 'lose', activity: 'low' });
  assert.strictEqual(e.raisedToFloor, true);
  assert.strictEqual(e.calories, N.ESTIMATE_FLOOR_KCAL);
  assert.match(e.working, /minimum/);
});
test('estimate: the deficit is a fixed gentle step, whatever the body size', () => {
  for (const kg of [50, 70, 90, 140, 250]) {
    for (const act of Object.keys(N.ACTIVITY)) {
      const m = N.estimate({ weight: kg, unit: 'kg', goal: 'maintain', activity: act });
      const l = N.estimate({ weight: kg, unit: 'kg', goal: 'lose', activity: act });
      assert.ok(l.calories >= N.ESTIMATE_FLOOR_KCAL);
      assert.ok(m.maintenance - l.calories <= 250 || l.calories === N.ESTIMATE_FLOOR_KCAL || m.calories - l.calories <= 255);
    }
  }
  assert.ok(!('aggressive' in N.GOALS));
});
test('estimate: converts lbs and refuses nonsense input', () => {
  assert.strictEqual(N.estimate({ weight: 176, unit: 'lbs', activity: 'light' }).kg, 79.8);
  for (const bad of [{}, { weight: 'x', unit: 'kg' }, { weight: 10, unit: 'kg' }, { weight: 400, unit: 'kg' }, { weight: 80, unit: 'stone' }, { weight: 80, unit: 'kg', goal: 'shred' }, { weight: 80, unit: 'kg', activity: 'extreme' }]) {
    assert.throws(() => N.estimate(bad), e => e.status === 400, JSON.stringify(bad));
  }
});
test('summariseDay: no meals is not_logged with null totals, never zero', () => {
  const d = N.summariseDay('2026-11-01', []);
  assert.strictEqual(d.status, 'not_logged');
  for (const k of ['calories', 'protein', 'carbs', 'fats']) assert.strictEqual(d[k], null);
});
test('summariseDay: a meal without calories makes the day partial, and a logged 0 stays 0', () => {
  assert.strictEqual(N.summariseDay('d', [{ calories: 500, protein: 30 }, { calories: null, protein: null }]).status, 'partial');
  const only = N.summariseDay('d', [{ description: 'x', calories: null, protein: null, carbs: null, fats: null }]);
  assert.strictEqual(only.status, 'partial'); assert.strictEqual(only.calories, null);
  assert.strictEqual(N.summariseDay('d', [{ calories: 0 }]).calories, 0);
  assert.strictEqual(N.summariseDay('d', [{ calories: 300, protein: 20 }, { calories: 400, protein: 25 }]).status, 'logged');
});
test('addDays crosses month and year ends by calendar', () => {
  assert.strictEqual(N.addDays('2026-01-02', -6), '2025-12-27');
  assert.strictEqual(N.addDays('2026-03-01', -1), '2026-02-28');
});

// ── the database and routes ──────────────────────────────────────────────────
const stamp = `zz_nt_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`, MIG = `${stamp}_m`;
let server, base;

before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'nutrition';
    next();
  };
  require('../api/web-nutrition')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [A, B, MIG]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});

const web = (user, method, p, body, headers = {}) => fetch(base + p, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Test-User': user, ...headers }, body: body ? JSON.stringify(body) : undefined });
const svc = (user, p) => fetch(base + '/api/service' + p, { headers: { 'X-Service-Token': 'test-token', 'X-Service-User': user } }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const meal = (db, o) => db.Meal.create({ time: '12:00', mealType: 'lunch', description: 'x', ...o });

test('migration is idempotent: sync + migrate twice, the target row survives', { skip }, async () => {
  const db = getDatabase(MIG);
  await db.sequelize.sync(); await db.migrate();
  await N.setTargets(db, { calories: 2100, protein: 140 });
  await db.sequelize.sync(); await db.migrate(); await db.sequelize.sync(); await db.migrate();
  assert.strictEqual((await N.getTargets(db)).calories, 2100);
  const [cols] = await db.sequelize.query('PRAGMA table_info("NutritionTargets")');
  assert.deepStrictEqual(cols.map(c => c.name).sort(), ['calories', 'carbs', 'fats', 'id', 'protein', 'source', 'updatedOn']);
});

test('set/get/clear round trip; a second set replaces, not duplicates', { skip }, async () => {
  const db = getDatabase(A); await db.sequelize.sync();
  assert.strictEqual(await N.getTargets(db), null);
  await N.setTargets(db, { calories: 2000, protein: 120, carbs: 200 });
  await N.setTargets(db, { calories: 2300, protein: 150 });
  const t = await N.getTargets(db);
  assert.strictEqual(t.calories, 2300); assert.strictEqual(t.carbs, null);
  assert.strictEqual(await db.NutritionTarget.count(), 1);
  await N.clearTargets(db);
  assert.strictEqual(await N.getTargets(db), null);
});

test('week: unlogged days are not_logged/null and excluded from averages; ET dates', { skip }, async () => {
  const db = getDatabase(A); await db.sequelize.sync(); await db.Meal.destroy({ where: {} });
  const now = new Date('2026-11-04T15:00:00Z'); // 10:00 ET
  await meal(db, { date: '2026-11-04', calories: 600, protein: 40 });
  await meal(db, { date: '2026-11-04', calories: 400, protein: 20 });
  await meal(db, { date: '2026-11-02', calories: 1000, protein: 60 });
  await meal(db, { date: '2026-10-20', calories: 9999 }); // outside the window
  const w = await N.weekProgress(db, now);
  assert.strictEqual(w.today, '2026-11-04');
  assert.deepStrictEqual(w.days.map(d => d.date), ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.strictEqual(w.days[5].status, 'not_logged'); assert.strictEqual(w.days[5].calories, null);
  assert.strictEqual(w.todaySummary.calories, 1000);
  assert.strictEqual(w.loggedDays, 2);
  assert.deepStrictEqual(w.average.calories, { value: 1000, days: 2 });
});
test('week: the ET day boundary, 02:00 UTC is still yesterday in New York', { skip }, async () => {
  const db = getDatabase(A); await db.sequelize.sync();
  const w = await N.weekProgress(db, new Date('2026-11-05T02:00:00Z'));
  assert.strictEqual(w.today, '2026-11-04');
});

test('isolation: two accounts see only their own targets and meals, web and service', { skip }, async () => {
  const a = getDatabase(A), b = getDatabase(B);
  await a.sequelize.sync(); await b.sequelize.sync(); await a.Meal.destroy({ where: {} }); await b.Meal.destroy({ where: {} });
  const today = N.todayET();
  await meal(a, { date: today, calories: 1111, protein: 11 });
  await meal(b, { date: today, calories: 2222, protein: 22 });
  assert.strictEqual((await web(A, 'PUT', '/nutrition/targets/api', { calories: 1800, protein: 100 })).status, 200);
  assert.strictEqual((await web(B, 'PUT', '/nutrition/targets/api', { calories: 2600, protein: 160 })).status, 200);
  const ja = await (await web(A, 'GET', '/nutrition/targets/api')).json();
  const jb = await (await web(B, 'GET', '/nutrition/targets/api')).json();
  assert.strictEqual(ja.targets.calories, 1800); assert.strictEqual(ja.week.todaySummary.calories, 1111);
  assert.strictEqual(jb.targets.calories, 2600); assert.strictEqual(jb.week.todaySummary.calories, 2222);
  const sa = await svc(A, '/nutrition-targets'), sb = await svc(B, '/nutrition-targets');
  assert.strictEqual(sa.body.targets.calories, 1800); assert.strictEqual(sb.body.targets.calories, 2600);
  assert.strictEqual(sb.body.week.todaySummary.calories, 2222);
  // the web layer takes the account from the session, never from the request
  const spoof = await (await web(A, 'GET', `/nutrition/targets/api?username=${B}`)).json();
  assert.strictEqual(spoof.targets.calories, 1800);
});

test('service: needs the token, refuses a path-like username', { skip }, async () => {
  assert.strictEqual((await fetch(base + '/api/service/nutrition-targets')).status, 401);
  assert.strictEqual((await svc('../evil', '/nutrition-targets')).status, 400);
});

test('web: PUT refuses bad values, cross-origin and non-JSON; needs a login', { skip }, async () => {
  assert.strictEqual((await web(A, 'PUT', '/nutrition/targets/api', { calories: 100, protein: 100 })).status, 400);
  assert.strictEqual((await web(A, 'PUT', '/nutrition/targets/api', { calories: 2000 }, { Origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await web(A, 'PUT', '/nutrition/targets/api', { calories: 2000 }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.strictEqual((await fetch(base + '/nutrition/targets', { redirect: 'manual' })).status, 302);
});

test('page: renders, says nothing-logged rather than zero, shows the estimate with the note and floor', { skip }, async () => {
  const db = getDatabase(B); await db.sequelize.sync(); await db.Meal.destroy({ where: {} });
  let html = await (await web(B, 'GET', '/nutrition/targets')).text();
  assert.match(html, /Nothing logged today yet/);
  assert.doesNotMatch(html, /0 kcal logged/);
  assert.match(html, /viewport-fit=cover/);
  html = await (await web(B, 'GET', '/nutrition/targets?weight=45&unit=kg&goal=lose&activity=low')).text();
  assert.match(html, /about 1,500 kcal/);
  assert.match(html, /not medical advice/);
  assert.match(html, /This is an estimate/);
  html = await (await web(B, 'GET', '/nutrition/targets?weight=abc&unit=kg')).text();
  assert.match(html, /weight as a number/);
});

test('copy: no shaming or nudging words on the page', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'views', 'nutrition-targets.ejs'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'api', 'nutrition-targets.js'), 'utf8');
  assert.doesNotMatch(src, /\b(over budget|cheat|bad day|failed|too much|exceeded|warning)\b/i);
  assert.doesNotMatch(src, /—/);
});
