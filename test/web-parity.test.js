'use strict';

/**
 * Web parity (HANDOFF item 90): ET dates, template names, the Week page, and workout
 * constraints owned by health (page + service API, one database per user).
 *
 * Instant under test: 2026-11-03 02:30 UTC is 2026-11-02 21:30 EST, so the ET date is
 * Monday the 2nd while the UTC date (what toISOString() gives) is already the 3rd.
 *
 * Run: node --test test/web-parity.test.js
 */

require('./helpers/data-dir');
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const ET = require('../lib/et');
const { displayName, prettySlug } = require('../api/template-names');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

const LATE = new Date('2026-11-03T02:30:00Z');   // 9:30pm Monday ET, already Tuesday in UTC

// ── the ET clock ─────────────────────────────────────────────────────────────
test('after 8pm ET the calendar date is still today, though UTC says tomorrow', () => {
  assert.strictEqual(LATE.toISOString().slice(0, 10), '2026-11-03', 'precondition: UTC is the next day');
  assert.strictEqual(ET.todayET(LATE), '2026-11-02');
  assert.strictEqual(ET.weekdayET(LATE), 1, 'Monday');
  assert.strictEqual(ET.timeET(LATE), '21:30:00');
  assert.strictEqual(ET.etDateOffset(-7, LATE), '2026-10-26');
  assert.strictEqual(ET.etDateOffset(14, LATE), '2026-11-16');
});

test('the default date follows the faked clock (Date is mocked, not just a helper argument)', () => {
  mock.timers.enable({ apis: ['Date'], now: LATE });
  try {
    assert.strictEqual(ET.todayET(), '2026-11-02');
    assert.strictEqual(ET.weekdayET(), 1);
  } finally { mock.timers.reset(); }
});

test('date arithmetic is pure calendar maths, and week counting is by ET date', () => {
  assert.strictEqual(ET.addDays('2026-11-01', 1), '2026-11-02');      // across the DST change
  assert.strictEqual(ET.addDays('2026-03-01', -1), '2026-02-28');
  assert.strictEqual(ET.daysBetween('2026-11-02', '2026-11-09'), 7);
  assert.strictEqual(ET.daysBetween('2026-11-02', '2026-11-02T00:00:00.000Z'), 0);
  assert.strictEqual(ET.weekdayOf('2026-11-08'), 0);
});

test('meal-prep dates a meal in ET when no date is given', () => {
  const { mealFor } = require('../api/meal-prep');
  const m = mealFor({ mealType: 'dinner' }, {});
  const real = new Date();
  assert.strictEqual(m.date, ET.todayET(real) === m.date ? m.date : ET.todayET(), 'sanity');
  mock.timers.enable({ apis: ['Date'], now: LATE });
  try {
    const late = mealFor({ mealType: 'dinner' }, {});
    assert.strictEqual(late.date, '2026-11-02');
    assert.strictEqual(late.time, '21:30:00');
  } finally { mock.timers.reset(); }
});

test('no calendar date in health is taken from toISOString() any more', () => {
  const root = path.join(__dirname, '..');
  const files = ['index.js', ...fs.readdirSync(path.join(root, 'views')).map(f => 'views/' + f).filter(f => f.endsWith('.ejs')),
    ...['api/routes/workout.js', 'api/routes/service.js', 'api/meal-prep.js'] ];
  for (const f of files) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    const hits = src.split('\n').filter(l => /new Date\(\)\.toISOString\(\)\.(split|slice)|now\.toISOString\(\)\.(split|slice)|today\.toISOString\(\)/.test(l) && !/^\s*\/\//.test(l));
    assert.deepStrictEqual(hits, [], `${f} derives a date from UTC`);
  }
});

// ── template names ───────────────────────────────────────────────────────────
test('a template with no real label is shown as its day and place, never the raw slug', () => {
  assert.strictEqual(prettySlug('fri:gym'), 'Friday (Gym)');
  assert.strictEqual(prettySlug('mon:work-gym'), 'Monday (Work gym)');
  assert.strictEqual(displayName('fri:gym', null), 'Friday (Gym)');
  assert.strictEqual(displayName('fri:gym', { label: 'fri:gym' }), 'Friday (Gym)', 'a label that IS the slug is not a label');
  assert.strictEqual(displayName('fri:gym', { label: 'Pull Day' }), 'Pull Day');
  assert.strictEqual(displayName('kit:starter', { label: 'Starter kit' }), 'Starter kit');
  assert.strictEqual(displayName('my own thing', null), 'my own thing');
});

// ── the week row (pure) ──────────────────────────────────────────────────────
test('a week row says where the day happens and what moved', () => {
  const { dayRow } = require('../api/web-week');
  const plan = { requested: 'park', location: 'home', substituted: true, pausedNote: 'Park is paused.', gym: { name: 'Home' },
    template: { slug: 'tue:home', label: 'Pull Day', type: 'strength', exercises: [{ exerciseName: 'Pull-up', sets: 4, repMode: 'max' }] }, fit: { notes: ['Pull-up needs a bar'] } };
  const r = dayRow('tue', plan, 'tue');
  assert.strictEqual(r.status, 'plan'); assert.strictEqual(r.isToday, true); assert.strictEqual(r.moved, true);
  assert.deepStrictEqual(r.exercises, [{ name: 'Pull-up', prescription: '4 × max' }]);
  assert.strictEqual(dayRow('wed', { allPaused: true, requested: 'gym', pausedNote: 'all paused' }, 'tue').status, 'paused');
  assert.strictEqual(dayRow('thu', { location: 'home', template: null }, 'tue').status, 'none');
});

// ── routes, over a real express and real per-user databases ──────────────────
const stamp = `zz_par_${process.pid}`;
const A = `${stamp}_a`, B = `${stamp}_b`;
let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = require('../build').asset;
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  const requireLogin = (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; next();
  };
  require('../api/web-week')(app, { requireLogin, getDatabase });
  require('../api/web-constraints')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  for (const u of [A, B]) { const db = getDatabase(u); await db.sequelize.sync(); await db.migrate(); await db.seedData(); }
});
after(() => {
  if (server) server.close();
  for (const n of [A, B]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});

const web = (u, method, p, body) => fetch(base + p, {
  method, headers: { 'x-test-user': u, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
}).then(async r => { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* html */ } return { status: r.status, text: t, body: j }; });
const svc = (u, method, p, body) => fetch(`${base}/api/service${p}`, {
  method, headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': u }, body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const inDays = n => ET.etDateOffset(n);

test('the Week page lists all seven days with the real plan, and a paused location moves its days', { skip }, async () => {
  let r = await web(A, 'GET', '/week');
  assert.strictEqual(r.status, 200);
  for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) assert.match(r.text, new RegExp(`<h2>${d}`));
  assert.match(r.text, /viewport-fit=cover/);
  assert.match(r.text, /Push Day/);   // the seeded Monday plan
  await svc(A, 'POST', '/gyms/park/pause', {});
  await svc(A, 'POST', '/gyms/gym/pause', { until: inDays(30) });
  r = await web(A, 'GET', '/week');
  assert.match(r.text, /Paused:<\/strong>[^<]*Park \(until resumed\)/);
  assert.match(r.text, /Work gym \(resumes /);
  assert.match(r.text, /moved from (park|gym)/);
  // the other account is untouched
  const other = await web(B, 'GET', '/week');
  assert.ok(!/Paused:/.test(other.text));
});

test('constraints: add, edit, clear on the web; validation refuses nonsense', { skip }, async () => {
  assert.strictEqual((await web(A, 'POST', '/constraints/api', {})).status, 400);
  assert.strictEqual((await web(A, 'POST', '/constraints/api', { text: 'x', until: 'tomorrow' })).status, 400);
  assert.strictEqual((await web(A, 'POST', '/constraints/api', { text: 'x', until: inDays(-1) })).status, 400);
  assert.strictEqual((await web(A, 'POST', '/constraints/api', { text: 'y'.repeat(501) })).status, 400);
  const add = await web(A, 'POST', '/constraints/api', { text: 'left shoulder strain, no overhead pressing', equipment: 'dumbbells', until: inDays(10) });
  assert.strictEqual(add.status, 200, add.text);
  const id = add.body.constraint.id;
  assert.strictEqual(add.body.constraint.source, 'web');
  let page = await web(A, 'GET', '/constraints');
  assert.match(page.text, /left shoulder strain/);
  assert.match(page.text, /viewport-fit=cover/);
  // the edit form posts the three fields; a blank "until" means none
  const ed = await web(A, 'PUT', `/constraints/api/${id}`, { text: 'left shoulder, no overhead', equipment: '' });
  assert.strictEqual(ed.status, 200);
  assert.strictEqual(ed.body.constraint.until, null);
  assert.strictEqual(ed.body.constraint.equipment, null);
  // cross-origin and non-JSON writes are refused
  const x = await fetch(base + '/constraints/api', { method: 'POST', headers: { 'x-test-user': A, origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{"text":"z"}' });
  assert.strictEqual(x.status, 403);
  const t = await fetch(base + '/constraints/api', { method: 'POST', headers: { 'x-test-user': A, 'Content-Type': 'text/plain' }, body: '{"text":"z"}' });
  assert.strictEqual(t.status, 415);
  assert.strictEqual((await web(A, 'DELETE', `/constraints/api/${id}`)).status, 200);
  page = await web(A, 'GET', '/constraints');
  assert.match(page.text, /None\. Workouts are unchanged/);
  assert.match(page.text, /cleared/, 'history kept');
  assert.strictEqual((await web(A, 'DELETE', '/constraints/api/99999')).status, 404);
});

test('constraints service API: two accounts never see each other, and the import is idempotent', { skip }, async () => {
  const mine = await svc(A, 'POST', '/constraints', { text: 'A: tweaked back, avoid loaded spine' });
  assert.strictEqual(mine.status, 200);
  assert.strictEqual(mine.body.constraint.source, 'cortex');
  await svc(B, 'POST', '/constraints', { text: 'B: hotel gym only', equipment: 'dumbbells' });
  const la = (await svc(A, 'GET', '/constraints')).body.constraints.map(c => c.text);
  const lb = (await svc(B, 'GET', '/constraints')).body.constraints.map(c => c.text);
  assert.deepStrictEqual(la, ['A: tweaked back, avoid loaded spine']);
  assert.deepStrictEqual(lb, ['B: hotel gym only']);
  // B cannot reach A's row by id: ids are per database, and a missing one is a 404
  const stray = await svc(B, 'PATCH', `/constraints/${mine.body.constraint.id + 100}`, { text: 'hijack' });
  assert.strictEqual(stray.status, 404);
  // import: first time writes, second time and a re-run change nothing
  const body = { text: 'vacation, hotel gym', equipment: 'dumbbells + treadmill', until: inDays(5) };
  const one = await svc(A, 'POST', '/constraints/import', body);
  const two = await svc(A, 'POST', '/constraints/import', body);
  assert.strictEqual(one.body.imported, true);
  assert.strictEqual(two.body.imported, false);
  assert.strictEqual(one.body.constraint.source, 'cortex-import');
  assert.strictEqual((await svc(A, 'GET', '/constraints?all=1')).body.constraints.filter(c => c.text === 'vacation, hotel gym').length, 1);
  // an import whose date has passed is kept (nothing cortex held is lost) but is not active
  const old = await svc(A, 'POST', '/constraints/import', { text: 'old trip', until: inDays(-3) });
  assert.strictEqual(old.body.imported, true);
  assert.strictEqual(old.body.constraint.active, false);
  assert.strictEqual(old.body.constraint.expired, true);
  assert.ok(!(await svc(A, 'GET', '/constraints')).body.constraints.some(c => c.text === 'old trip'));
  assert.ok((await svc(A, 'GET', '/constraints?all=1')).body.constraints.some(c => c.text === 'old trip'));
  // partial update leaves the other fields; clear-all clears this account only
  const patched = await svc(A, 'PATCH', `/constraints/${mine.body.constraint.id}`, { until: inDays(3) });
  assert.strictEqual(patched.body.constraint.text, 'A: tweaked back, avoid loaded spine');
  assert.strictEqual(patched.body.constraint.until, inDays(3));
  const cleared = await svc(A, 'POST', '/constraints/clear');
  assert.ok(cleared.body.cleared >= 2);
  assert.deepStrictEqual((await svc(A, 'GET', '/constraints')).body.constraints, []);
  assert.strictEqual((await svc(B, 'GET', '/constraints')).body.constraints.length, 1);
  // the token is still required
  const noTok = await fetch(`${base}/api/service/constraints`, { headers: { 'X-Service-User': A } });
  assert.strictEqual(noTok.status, 401);
});

// ── goal progress ────────────────────────────────────────────────────────────
test('goal progress validates server-side: a number or blank is accepted, anything else is refused', () => {
  const goalsApi = require('../api/goals');
  assert.strictEqual(goalsApi.fromBody({ currentValue: '42.5' }).currentValue, 42.5);
  assert.strictEqual(goalsApi.fromBody({ currentValue: '' }).currentValue, null);
  assert.throws(() => goalsApi.fromBody({ currentValue: 'lots' }), e => e.status === 400);
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  const route = src.slice(src.indexOf("app.post('/goals/progress/:id'"), src.indexOf("app.post('/goals/toggle/:id'"));
  assert.match(route, /Number\.isFinite\(Number\(raw\)\)/);
  assert.ok(!/inBrief|nudge/.test(route), 'a progress update touches nothing but currentValue');
});
