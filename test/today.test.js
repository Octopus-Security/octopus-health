'use strict';

/**
 * /today — the morning brief's workout on the web (api/today.js, views/today.ejs).
 *
 * The brief links here with the template slug it used ("mon:gym"), so the page must
 * show THAT plan, fall back sensibly when the slug is missing or bogus, match each
 * exercise to the library (which is what makes its demo animation open), and render
 * on a phone with no chat app involved. Tested at the route with the real database
 * on a throwaway account, plus the pure helpers.
 *
 * Run: node --test test/today.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const T = require('../api/today');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); require('ejs'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3/ejs not installed on this machine';

// ── pure helpers ─────────────────────────────────────────────────────────────
test('the day is ET: 11pm ET Sunday is Sunday, though UTC is already Monday', () => {
  assert.strictEqual(T.dayKeyET(new Date('2026-10-26T03:00:00Z')), 'sun');
  assert.strictEqual(T.todayET(new Date('2026-10-26T03:00:00Z')), '2026-10-25');
  assert.strictEqual(T.dayKeyET(new Date('2026-10-26T14:00:00Z')), 'mon');
});

test('slug: the requested plan if it exists, else today\'s home plan, else any plan for today', () => {
  const names = ['mon:gym', 'mon:home', 'tue:park', 'custom thing'];
  assert.strictEqual(T.resolveSlug(names, 'mon:gym', 'mon'), 'mon:gym');
  assert.strictEqual(T.resolveSlug(names, 'wed:gym', 'mon'), 'mon:home');          // asked for a plan that does not exist
  assert.strictEqual(T.resolveSlug(names, '../../etc', 'mon'), 'mon:home');        // not a slug at all
  assert.strictEqual(T.resolveSlug(names, '', 'tue'), 'tue:park');
  assert.strictEqual(T.resolveSlug(names, '', 'thu'), null);
});

test('prescription reads like the brief: sets × reps, max, timed', () => {
  assert.strictEqual(T.prescription({ sets: 3, reps: 12 }), '3 × 12');
  assert.strictEqual(T.prescription({ sets: 4, repMode: 'max' }), '4 × max');
  assert.strictEqual(T.prescription({ sets: 3, repMode: 'timed', duration: 45 }), '3 × 45 s');
  assert.strictEqual(T.prescription({ sets: 2 }), '2 sets');
  assert.strictEqual(T.prescription({}), '');
});

// ── the route ────────────────────────────────────────────────────────────────
const user = `zz_today_${process.pid}`;
let server, base;
before(async () => {
  if (skip) return;
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = require('../build').asset;
  const requireLogin = (req, res, next) => { req.user = { username: user }; next(); };
  T(app, { requireLogin, getDatabase });
  const db = getDatabase(user);
  await db.sequelize.sync();
  await db.seedData();   // the app does this at login: the exercise library, and seed templates
  await db.WorkoutTemplate.destroy({ where: { name: 'mon:gym' } });
  await db.WorkoutTemplate.create({
    name: 'mon:gym', type: 'strength',
    description: JSON.stringify({ label: 'Push Day — Mon (Gym)', location: 'gym', warmup: 'Treadmill 5 min easy', cooldown: ['Chest doorway stretch 60s'] }),
    exercises: JSON.stringify([
      { exerciseName: 'Barbell Bench Press', sets: 4, repMode: 'max', notes: 'Work up to a heavy top set' },
      { exerciseName: 'Incline Dumbbell Press', sets: 3, reps: 12 },
      { exerciseName: 'Made-up </script><b>Thing', sets: 2, reps: 5 },
    ]),
  });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${user}_health.sqlite`)); } catch { /* not created */ }
});

const get = (p) => fetch(base + p).then(async r => ({ status: r.status, html: await r.text() }));

test('the brief\'s link shows that exact plan, with targets and a start button', { skip }, async () => {
  const r = await get('/today?slug=mon:gym');
  assert.strictEqual(r.status, 200);
  assert.match(r.html, /Push Day — Mon \(Gym\)/);
  assert.match(r.html, /Barbell Bench Press<\/button>/);
  assert.match(r.html, /4 × max/);
  assert.match(r.html, /3 × 12/);
  assert.match(r.html, /Work up to a heavy top set/);
  assert.match(r.html, /Treadmill 5 min easy/);
  assert.match(r.html, /Chest doorway stretch 60s/);
  assert.match(r.html, /Start logging this workout/);
  assert.match(r.html, /viewport-fit=cover/);
});

test('library exercises carry their id (the demo needs it); unknown ones still render', { skip }, async () => {
  const r = await get('/today?slug=mon:gym');
  const plan = JSON.parse(r.html.match(/const PLAN = (.*);\n/)[1]);
  const bench = plan.exercises.find(e => e.name === 'Barbell Bench Press');
  assert.ok(Number.isInteger(bench.id), 'seeded library exercise matched');
  assert.strictEqual(plan.exercises[2].id, null);
  // a name cannot close the script block or inject markup
  assert.ok(!/<\/script><b>Thing/.test(r.html), 'escaped');
});

test('no plan for the day: says so and still offers the logger', { skip }, async () => {
  const r = await get('/today?slug=zzz');
  assert.strictEqual(r.status, 200);
  // today may or may not be Monday; either the gym plan is not today's or it is shown
  if (/No workout planned for today/.test(r.html)) assert.match(r.html, /href="\/workout"/);
  else assert.strictEqual(T.dayKeyET(), 'mon');
});

// The demo sheet (public/js/stretch-demo.js) finds its parts by id. The workout logger
// already had an #sd-title of its own (the session-detail modal), so adding demos there
// made the sheet write its title into the wrong dialog. Caught in a browser run.
test('no page that loads the demo sheet reuses its element ids', () => {
  const views = path.join(__dirname, '..', 'views');
  const ids = ['sd-title', 'sd-media', 'sd-how', 'sd-full'];
  for (const f of fs.readdirSync(views).filter(f => f.endsWith('.ejs'))) {
    const src = fs.readFileSync(path.join(views, f), 'utf8');
    if (!/stretch-demo\.js/.test(src)) continue;
    for (const id of ids) assert.ok(!new RegExp(`id=["']${id}["']`).test(src), `${f} defines #${id}, which the demo sheet owns`);
  }
});

// The live logger saves an edited reps/weight immediately through the shared editor.
// It used to keep edits in memory until "finish", which never saved them.
test('the live logger saves set edits as they are made, and dates sessions in ET', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'views', 'workout.ejs'), 'utf8');
  const fn = src.slice(src.indexOf('async function updateSetField'), src.indexOf('async function deleteSet'));
  assert.match(fn, /fetch\('\/logs\/api\/set\/' \+ set\.id, \{ method: 'PATCH'/);
  assert.ok(!/full save on finish/.test(fn));
  assert.ok(!/toISOString\(\)\.split\('T'\)\[0\]/.test(src), 'a UTC date in the logger');
});
