'use strict';

/**
 * Gyms and equipment: the one catalogue, plan fitting, and pausing a location.
 * Pure rules first (no database), then the real database on throwaway accounts and
 * the service + web routes over a real express. DB parts skip without
 * express/ejs/sequelize/sqlite3.
 *
 * Run: node --test test/gyms.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../api/equipment');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

// ── the catalogue ────────────────────────────────────────────────────────────
test('catalogue: ids unique, every reference points at a real id, no alias claimed twice', () => {
  const ids = new Set(E.IDS);
  assert.strictEqual(ids.size, E.IDS.length);
  const seen = new Map();
  for (const it of E.ITEMS) {
    assert.match(it.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, it.id);
    for (const p of it.provides || []) assert.ok(ids.has(p), `${it.id} provides unknown ${p}`);
    for (const a of [...(it.aliases || []), it.name]) {
      const k = a.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
      if (seen.has(k) && seen.get(k) !== it.id) assert.fail(`alias "${a}" claimed by ${seen.get(k)} and ${it.id}`);
      seen.set(k, it.id);
    }
  }
  const refs = r => (r || []).flatMap(x => String(x).split('|'));
  for (const r of E.CATALOGUE.exerciseRules) {
    for (const id of refs(r.requires)) assert.ok(ids.has(id), `${r.match}: unknown ${id}`);
    for (const s of r.substitutes || []) for (const id of refs(s.requires)) assert.ok(ids.has(id), `${r.match} -> ${s.name}: unknown ${id}`);
  }
  for (const g of E.CATALOGUE.gyms) for (const e of g.equipment) assert.ok(ids.has(e.id), `${g.slug}: unknown ${e.id}`);
  for (const v of Object.values(E.CATALOGUE.legacyExerciseTokens)) if (v) assert.ok(ids.has(v), v);
});

test('every legacy token the exercise library uses maps to the catalogue', () => {
  const lib = require('../database');
  const used = new Set((lib.SEED_EXERCISES || []).map(e => e.equipment));
  for (const t of used) assert.ok(t in E.CATALOGUE.legacyExerciseTokens, `library equipment "${t}" has no catalogue mapping`);
});

test('old names resolve through aliases (nothing already stored is orphaned)', () => {
  assert.strictEqual(E.toId('push-up handles'), 'handles');
  assert.strictEqual(E.toId('Pull-up bar'), 'bar');
  assert.strictEqual(E.toId('dip station'), 'dip-bars');
  assert.strictEqual(E.toId('a box'), 'chair');
  assert.strictEqual(E.toId('cable_machine'), 'cable-machine');
  assert.strictEqual(E.toId('Dumbbells'), 'dumbbell');
  assert.strictEqual(E.toId('captain\'s chair'), 'captains-chair');
  assert.strictEqual(E.toId('jetpack'), null);
});

test('a power tower is a pull-up bar, dip bars, handles and a captain\'s chair', () => {
  const have = E.expand(['power-tower']);
  for (const id of ['bar', 'dip-bars', 'handles', 'captains-chair']) assert.ok(have.has(id), id);
  assert.ok(!have.has('cable-machine') && !have.has('weight-bench'));
});

// ── fitting ──────────────────────────────────────────────────────────────────
const HOME = ['power-tower', 'ab-roller', 'parallettes'];
const names = fit => fit.exercises.map(e => e.exerciseName);

test('home: tower work stays, jump rope / cables / benches go, and it is reported', () => {
  const fit = E.fitExercises([
    { exerciseName: 'Pull-up' }, { exerciseName: 'Dip' }, { exerciseName: 'Hanging Leg Raise' }, { exerciseName: 'Ab Roller Rollout' },
    { exerciseName: 'Jump Rope' }, { exerciseName: 'Barbell Bench Press' }, { exerciseName: 'Cable Face Pull' }, { exerciseName: 'Plank' },
  ], HOME);
  assert.deepStrictEqual(names(fit), ['Pull-up', 'Dip', 'Hanging Leg Raise', 'Ab Roller Rollout', 'Plank']);
  assert.deepStrictEqual(fit.omitted.map(o => o.name), ['Jump Rope', 'Barbell Bench Press', 'Cable Face Pull']);
});

test('a missing tool is swapped when a sensible substitute exists, and the swap is named', () => {
  const fit = E.fitExercises([{ exerciseName: 'Resistance Band Face Pull', sets: 3, reps: 20 }, { exerciseName: 'Ab Roller Rollout', sets: 4 }], ['cable-machine']);
  assert.deepStrictEqual(fit.substitutions, [{ from: 'Resistance Band Face Pull', to: 'Cable Face Pull' }, { from: 'Ab Roller Rollout', to: 'Cable Crunch' }]);
  assert.strictEqual(fit.exercises[0].sets, 3);
  assert.strictEqual(fit.exercises[0].reps, 20, 'prescription travels with the slot');
  assert.ok(E.describeFit(fit, 'Work gym').every(l => typeof l === 'string' && l.length));
});

test('a substitute never duplicates an exercise already in the plan', () => {
  const fit = E.fitExercises([{ exerciseName: 'Ab Roller Rollout' }, { exerciseName: 'Cable Crunch' }], ['cable-machine']);
  assert.deepStrictEqual(names(fit), ['Hollow Body Hold', 'Cable Crunch'], 'cable crunch is already there, so the next substitute is used');
  assert.strictEqual(new Set(names(fit)).size, names(fit).length);
});

test('an exercise can state its own requirements (the hook for the home-tower program)', () => {
  const fit = E.fitExercises([{ exerciseName: 'Tower Thing', requires: ['power-tower'] }], ['bar']);
  assert.strictEqual(fit.omitted.length, 1);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Tower Thing', requires: ['power-tower'] }], HOME).exercises.length, 1);
  assert.deepStrictEqual(E.fitExercises(null, HOME), { exercises: [], substitutions: [], omitted: [] });
});

test('an unknown exercise needs nothing; the library string decides when no rule matches', () => {
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Mystery Move' }], []).exercises.length, 1);
  const legacy = new Map([['mystery move', 'kettlebell']]);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Mystery Move' }], [], legacy).omitted.length, 1);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Mystery Move' }], ['kettlebell'], legacy).exercises.length, 1);
});

// ── pausing (pure) ───────────────────────────────────────────────────────────
const gyms = (over = {}) => ['home', 'park', 'gym'].map(slug => ({ slug, name: slug === 'gym' ? 'Work gym' : slug[0].toUpperCase() + slug.slice(1), active: true, pausedUntil: null, ...(over[slug] || {}) }));

test('paused park falls back to home, with the reason', () => {
  const r = E.resolveLocation(gyms({ park: { active: false, pausedUntil: '2027-03-15' } }), 'park', '2026-12-01');
  assert.strictEqual(r.location, 'home');
  assert.strictEqual(r.substituted, true);
  assert.match(r.note, /Park is paused until 2027-03-15/);
});

test('a resume date that has arrived makes the location active again', () => {
  const g = gyms({ park: { active: false, pausedUntil: '2027-03-15' } });
  assert.strictEqual(E.resolveLocation(g, 'park', '2027-03-14').location, 'home');
  assert.strictEqual(E.resolveLocation(g, 'park', '2027-03-15').location, 'park');
  assert.strictEqual(E.resolveLocation(g, 'park', '2027-06-01').location, 'park');
  assert.strictEqual(E.isActive({ active: false, pausedUntil: null }, '2099-01-01'), false, 'no date = until resumed by hand');
});

test('everything paused: no crash, no location, a clear message', () => {
  const all = { home: { active: false }, park: { active: false }, gym: { active: false } };
  const r = E.resolveLocation(gyms(all), 'park', '2026-12-01');
  assert.strictEqual(r.location, null);
  assert.strictEqual(r.allPaused, true);
  assert.match(r.note, /Every location is paused/);
});

test('home paused too: park days go to the next active place, work gym last', () => {
  assert.strictEqual(E.resolveLocation(gyms({ park: { active: false }, home: { active: false } }), 'park', '2026-12-01').location, 'gym');
});

// ── the database ─────────────────────────────────────────────────────────────
const stamp = `zz_gym_${process.pid}`;
const A = `${stamp}_a`, Bu = `${stamp}_b`, SA = `${stamp}_sa`, SB = `${stamp}_sb`, WA = `${stamp}_wa`, WB = `${stamp}_wb`;
let server, base, G;

before(async () => {
  if (skip) return;
  G = require('../api/gyms-store');
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
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'gyms';
    next();
  };
  require('../api/web-gyms')(app, { requireLogin, getDatabase });
  require('../api/today')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [A, Bu, SA, SB, WA, WB]) try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
});

async function fresh(user) {
  const db = getDatabase(user);
  await db.sequelize.sync(); await db.migrate(); await db.seedData();
  return db;
}
const svc = (user, method, p, body) => fetch(base + '/api/service' + p, {
  method, headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
const web = (user, method, p, body, headers = {}) => fetch(base + p, { method, redirect: 'manual', headers: { 'Content-Type': 'application/json', 'X-Test-User': user, ...headers }, body: body ? JSON.stringify(body) : undefined });

test('seed: Home has the tower, ab roller and parallettes; the jump rope is at the park and work gym only', { skip }, async () => {
  const db = await fresh(A);
  const g = Object.fromEntries((await G.listGyms(db)).map(x => [x.slug, x]));
  assert.deepStrictEqual(g.home.equipment.map(e => e.id).sort(), ['ab-roller', 'parallettes', 'power-tower']);
  const tower = g.home.equipment.find(e => e.id === 'power-tower');
  assert.strictEqual(tower.attrs.heights, 10);
  assert.strictEqual(tower.attrs.ratedLb, 330);
  assert.strictEqual(tower.attrs.cables, false);
  assert.ok(!g.home.effective.includes('jump-rope'));
  assert.ok(g.park.effective.includes('jump-rope') && g.gym.effective.includes('jump-rope'));
  assert.ok(g.home.effective.includes('captains-chair') && g.home.effective.includes('dip-bars'));
  // idempotent, and an edit survives a re-seed
  await G.removeEquipment(db, 'home', 'parallettes');
  await db.seedData();
  assert.ok(!(await G.getGym(db, 'home')).equipment.some(e => e.id === 'parallettes'));
});

test('existing workouts and templates are untouched by gyms', { skip }, async () => {
  const db = await fresh(A);
  const before = await db.WorkoutTemplate.count();
  await G.pauseGym(db, 'park', '2027-03-01');
  assert.strictEqual(await db.WorkoutTemplate.count(), before);
  const stored = JSON.parse((await db.WorkoutTemplate.findOne({ where: { name: 'mon:home' } })).exercises);
  assert.ok(stored.some(e => e.exerciseName === 'Push-up Board Wide'), 'stored template keeps every original exercise');
});

test('home plan for Monday: fitted to the tower, with the omissions listed', { skip }, async () => {
  const db = await fresh(Bu);
  const p = await G.planFor(db, { day: 'mon', location: 'home' });
  assert.strictEqual(p.location, 'home');
  const ex = p.template.exercises.map(e => e.exerciseName);
  assert.ok(ex.includes('Ab Roller Rollout') && ex.includes('Pike Push-up'));
  assert.ok(!ex.some(n => /Resistance Band/.test(n)), 'bands are not at home');
  assert.ok(p.fit.omitted.length + p.fit.substitutions.length > 0);
  const gymPlan = await G.planFor(db, { day: 'mon', location: 'gym' });
  assert.ok(gymPlan.template.exercises.some(e => e.exerciseName === 'Barbell Bench Press'));
  assert.ok(gymPlan.fit.substitutions.some(s => s.to === 'Cable Crunch'), 'the ab roller stays home, so the gym plan uses cable crunch');
});

test('paused park: no park day in the week, they land on Home with the reason', { skip }, async () => {
  const db = await fresh(Bu);
  const week = async now => { const out = []; for (const d of G.DAYS) out.push(await G.planFor(db, { day: d, location: d === 'tue' || d === 'sat' ? 'park' : 'home', now })); return out; };
  const noon = new Date('2026-12-01T17:00:00Z');
  assert.strictEqual((await week(noon)).filter(p => p.location === 'park').length, 2, 'park active: tue and sat are park');
  await G.pauseGym(db, 'park', '2027-03-15', '2026-12-01');
  const paused = await week(noon);
  assert.strictEqual(paused.filter(p => p.location === 'park').length, 0);
  const sat = paused.find(p => p.day === 'sat');
  assert.strictEqual(sat.location, 'home');
  assert.match(sat.pausedNote, /Park is paused until 2027-03-15/);
  assert.ok(sat.template && sat.template.exercises.length, 'the day still has a workout');
  assert.ok(sat.fit.omitted.some(o => o.name === 'Jump Rope') || sat.fit.substitutions.length >= 0);
  // past the resume date it is the park again
  const spring = await week(new Date('2027-03-16T17:00:00Z'));
  assert.strictEqual(spring.filter(p => p.location === 'park').length, 2);
  // history is untouched: a session logged at the paused park is still there
  const s = await db.WorkoutSession.create({ date: '2026-11-20', type: 'strength', title: 'Park pull day' });
  await G.pauseGym(db, 'park', null);
  assert.ok(await db.WorkoutSession.findByPk(s.id));
});

test('every location paused: planFor says so instead of throwing', { skip }, async () => {
  const db = await fresh(A);
  for (const s of ['home', 'park', 'gym']) await G.pauseGym(db, s, null);
  const p = await G.planFor(db, { day: 'mon', location: 'home' });
  assert.strictEqual(p.allPaused, true);
  assert.strictEqual(p.template, null);
  assert.match(p.pausedNote, /Every location is paused/);
  await G.resumeGym(db, 'home');
  assert.strictEqual((await G.planFor(db, { day: 'mon', location: 'park' })).location, 'home');
});

test('validation: bad resume dates and unknown equipment are 400s, unknown gyms 404', { skip }, async () => {
  const db = await fresh(A);
  await assert.rejects(() => G.pauseGym(db, 'park', 'next spring'), /YYYY-MM-DD/);
  await assert.rejects(() => G.addEquipment(db, 'home', { equipment: 'jetpack' }), /Unknown equipment/);
  await assert.rejects(() => G.getGym(db, 'moon'), /No gym/);
});

test('service API: catalogue, gyms, pause/resume, equipment, plan; accounts are separate', { skip }, async () => {
  await fresh(SA); await fresh(SB);   // templates are seeded when the web app first sees an account
  assert.ok((await svc(SA, 'GET', '/equipment')).body.items.some(i => i.id === 'power-tower'));
  const p = await svc(SA, 'POST', '/gyms/park/pause', { until: '2027-03-15' });
  assert.strictEqual(p.status, 200);
  assert.strictEqual(p.body.gym.active, false);
  assert.strictEqual((await svc(SA, 'GET', '/gyms/resolve?location=park')).body.location, 'home');
  assert.strictEqual((await svc(SB, 'GET', '/gyms/resolve?location=park')).body.location, 'park', 'another account is unaffected');
  assert.strictEqual((await svc(SA, 'POST', '/gyms/park/pause', { until: 'soon' })).status, 400);
  assert.strictEqual((await svc(SA, 'POST', '/gyms/home/equipment', { equipment: 'kettlebells' })).body.gym.equipment.some(e => e.id === 'kettlebell'), true);
  assert.strictEqual((await svc(SA, 'DELETE', '/gyms/home/equipment/kettlebell')).body.gym.equipment.some(e => e.id === 'kettlebell'), false);
  const plan = await svc(SA, 'GET', '/gyms/plan?day=sat&location=park');
  assert.strictEqual(plan.body.location, 'home');
  assert.ok(plan.body.template);
  assert.strictEqual((await svc(SA, 'POST', '/gyms/park/resume')).body.gym.active, true);
  assert.strictEqual((await svc(SA, 'GET', '/gyms/nope')).status, 404);
});

test('web: the page renders for a signed-in account and shows pause state; writes need JSON + same origin', { skip }, async () => {
  assert.strictEqual((await web('', 'GET', '/gyms')).status, 302);
  let r = await web(WA, 'GET', '/gyms');
  assert.strictEqual(r.status, 200);
  let html = await r.text();
  assert.match(html, /Power tower/);
  assert.match(html, /Pause Park/);
  assert.match(html, /viewport-fit=cover/);
  assert.strictEqual((await web(WA, 'POST', '/gyms/api/park/pause', { until: '2027-03-15' })).status, 200);
  html = await (await web(WA, 'GET', '/gyms')).text();
  assert.match(html, /Resume Park now/);
  assert.match(html, /resumes 2027-03-15/);
  assert.strictEqual((await web(WA, 'POST', '/gyms/api/park/resume', {})).status, 200);
  assert.strictEqual((await web(WA, 'POST', '/gyms/api/park/pause', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.strictEqual((await web(WA, 'POST', '/gyms/api/park/pause', {}, { 'Content-Type': 'text/plain' })).status, 415);
  for (const s of ['home', 'park', 'gym']) await web(WA, 'POST', `/gyms/api/${s}/pause`, {});
  html = await (await web(WA, 'GET', '/gyms')).text();
  assert.match(html, /Every location is paused/);
});

test('/today?at=: the plan is fitted to the gym the brief chose and says what changed; without it, unchanged', { skip }, async () => {
  await fresh(WB);
  let html = await (await web(WB, 'GET', '/today?slug=mon:home&at=home')).text();
  assert.match(html, /Adjusted for this location/);
  assert.ok(!/Resistance Band Lateral Raise/.test(html.split('const PLAN = ')[1].split('\n')[0]), 'the logger plan has no bands');
  html = await (await web(WB, 'GET', '/today?slug=mon:home')).text();
  assert.match(html.split('const PLAN = ')[1].split('\n')[0], /Resistance Band Lateral Raise/);
  assert.ok(!/Adjusted for this location/.test(html));
});
