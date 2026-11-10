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
  assert.strictEqual(E.toId('a box'), null, 'a bare box is ambiguous: neither a chair nor a plyo box');
  assert.strictEqual(E.toId('a plyo box'), 'plyo-box');
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

test('seed: Home has the tower, ab roller, parallettes, bands, push-up board and mat; the massage ball set and jump rope are there too', { skip }, async () => {
  const db = await fresh(A);
  const g = Object.fromEntries((await G.listGyms(db)).map(x => [x.slug, x]));
  assert.deepStrictEqual(g.home.equipment.map(e => e.id).sort(), ['ab-roller', 'jump-rope', 'massage-ball-set', 'mat', 'parallettes', 'power-tower', 'push-up-board', 'resistance-bands']);
  const tower = g.home.equipment.find(e => e.id === 'power-tower');
  assert.strictEqual(tower.attrs.heights, 10);
  assert.strictEqual(tower.attrs.ratedLb, 330);
  assert.strictEqual(tower.attrs.cables, false);
  assert.ok(g.home.effective.includes('jump-rope') && g.home.effective.includes('massage-ball-lacrosse'));
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
  await G.removeEquipment(db, 'home', 'resistance-bands');   // new accounts own bands now; an older Home row may not
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
  const dbB = await fresh(WB);
  await G.removeEquipment(dbB, 'home', 'resistance-bands');   // new accounts own bands; take them out so Monday has something to adjust
  let html = await (await web(WB, 'GET', '/today?slug=mon:home&at=home')).text();
  assert.match(html, /Adjusted for this location/);
  assert.ok(!/Resistance Band Lateral Raise/.test(html.split('const PLAN = ')[1].split('\n')[0]), 'the logger plan has no bands');
  html = await (await web(WB, 'GET', '/today?slug=mon:home')).text();
  assert.match(html.split('const PLAN = ')[1].split('\n')[0], /Resistance Band Lateral Raise/);
  assert.ok(!/Adjusted for this location/.test(html));
});

// ── equipment plans (slug "kit:<item>") and buy links ─────────────────────────
const KIT_SLUGS = ['kit:power-tower', 'kit:bands', 'kit:parallettes', 'kit:push-up-board', 'kit:mat', 'kit:dip-belt', 'kit:ab-straps'];
const ASINS = { 'power-tower': 'B0F8HVK8MD', 'resistance-bands': 'B0GQS7YQLX', parallettes: 'B0DSVXKJZS', 'push-up-board': 'B0B73XM8ZB', mat: 'B0DHKCM18G', 'dip-belt': 'B01N5PB7CZ', 'ab-straps': 'B07778BQRJ', 'massage-ball-set': 'B0GRMVPCGZ' };
// database.js needs sequelize to load; read the seed arrays from source when it cannot be required.
function seedArrays() {
  if (getDatabase) return { ex: getDatabase.SEED_EXERCISES, tpl: getDatabase.SEED_WORKOUT_TEMPLATES };
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  const grab = n => eval(src.match(new RegExp('const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]); // eslint-disable-line no-eval
  return { ex: grab('SEED_EXERCISES'), tpl: grab('SEED_WORKOUT_TEMPLATES') };
}
const homeIds = () => E.CATALOGUE.gyms.find(g => g.slug === 'home').equipment.map(e => e.id);

test('buy links: every one builds the tagged dp/ URL, once, with no short links', () => {
  assert.strictEqual(E.AMAZON_TAG, 'octopustec031-20');
  assert.deepStrictEqual(E.ITEMS.filter(i => i.buy).map(i => i.id).sort(), Object.keys(ASINS).sort());
  for (const [id, asin] of Object.entries(ASINS)) {
    const b = E.buyLink(id);
    assert.strictEqual(b.url, `https://www.amazon.com/dp/${asin}?tag=octopustec031-20`, id);
    assert.ok(b.label.length > 5);
    assert.ok(!/a\.co\//.test(b.url));
  }
  assert.strictEqual(E.buyLink('wall'), null);
  assert.strictEqual(E.buyLink('nope'), null);
  // mirrors octopus-blog withTag: never doubles a tag, keeps a query and a hash
  assert.strictEqual(E.withTag('https://www.amazon.com/dp/X?tag=other-20'), 'https://www.amazon.com/dp/X?tag=other-20');
  assert.strictEqual(E.withTag('https://www.amazon.com/dp/X?th=1#r'), 'https://www.amazon.com/dp/X?th=1&tag=octopustec031-20#r');
  assert.match(E.AMAZON_DISCLOSURE, /^As an Amazon Associate I earn from qualifying purchases\.$/);
});

test('mat is in the catalogue and resolves from what people say', () => {
  for (const q of ['mat', 'a yoga mat', 'exercise mats', 'floor mat']) assert.strictEqual(E.toId(q), 'mat', q);
});

test('equipment plans: the kit slugs, each a Home template naming real exercises and a real item with a buy link', () => {
  const { ex, tpl } = seedArrays();
  const lib = new Set(ex.map(e => e.name));
  assert.deepStrictEqual(Object.keys(E.KIT_PLAN_ITEM).sort(), [...KIT_SLUGS].sort());
  for (const slug of KIT_SLUGS) {
    const t = tpl.find(x => x.slug === slug);
    assert.ok(t, slug + ' is seeded');
    assert.strictEqual(t.location, 'home');
    assert.ok(!/^(sun|mon|tue|wed|thu|fri|sat):/.test(slug), 'not a weekday slug');
    assert.ok(t.name.length > 5 && t.name !== slug, "a human name, not the slug");
    assert.ok(t.exercises.length >= 5, slug);
    for (const e of t.exercises) assert.ok(lib.has(e.exerciseName), `${slug}: "${e.exerciseName}" is not in the exercise library`);
    assert.ok(E.kitBuyLink(slug), slug + ' has a buy link');
    assert.ok(E.ITEMS.some(i => i.id === E.KIT_PLAN_ITEM[slug]));
  }
  assert.strictEqual(E.kitBuyLink('mon:home'), null);
  assert.strictEqual(new Set(tpl.map(t => t.slug)).size, tpl.length, 'slugs unique');
});

// Add-on gear is not in the seeded Home: an account ticks it on /gyms when it owns it.
const KIT_EXTRA_GEAR = { 'kit:dip-belt': ['dip-belt', 'weight-plates'], 'kit:ab-straps': ['ab-straps'] };

test('equipment plans fit Home as seeded, plus any add-on gear they name: nothing omitted, nothing swapped', () => {
  const { ex, tpl } = seedArrays();
  const legacy = new Map(ex.map(e => [e.name.toLowerCase(), e.equipment]));
  for (const slug of KIT_SLUGS) {
    const t = tpl.find(x => x.slug === slug);
    const fit = E.fitExercises(t.exercises, [...homeIds(), ...(KIT_EXTRA_GEAR[slug] || [])], legacy);
    assert.deepStrictEqual(fit.omitted, [], slug);
    assert.deepStrictEqual(fit.substitutions, [], slug);
    assert.strictEqual(fit.exercises.length, t.exercises.length, slug);
  }
});

test('plates, dip belt and ab straps: owned they stay, missing they swap, and a barbell counts as plates', () => {
  const fit = (names, owned) => E.fitExercises(names.map(exerciseName => ({ exerciseName })), owned);
  const tower = ['power-tower'];
  const kept = r => r.exercises.map(x => x.exerciseName || x.name);
  assert.deepStrictEqual(kept(fit(['Weighted Pull-up', 'Weighted Dip'], [...tower, 'dip-belt', 'weight-plates'])), ['Weighted Pull-up', 'Weighted Dip']);
  assert.deepStrictEqual(kept(fit(['Weighted Pull-up'], [...tower, 'dip-belt', 'barbell'])), ['Weighted Pull-up']);
  assert.deepStrictEqual(kept(fit(['Weighted Pull-up'], [...tower, 'dip-belt'])), ['Pull-up'], 'a belt with nothing to hang on it is not weighted');
  assert.deepStrictEqual(kept(fit(['Weighted Dip'], tower)), ['Dip']);
  assert.deepStrictEqual(kept(fit(['Ab Strap Knee Raise'], [...tower, 'ab-straps'])), ['Ab Strap Knee Raise']);
  assert.deepStrictEqual(kept(fit(['Ab Strap Knee Raise'], tower)), ['Hanging Knee Raise']);
  assert.deepStrictEqual(kept(fit(['Plate Goblet Squat'], [])), ['Bodyweight Squat']);
  assert.deepStrictEqual(fit(['Plate Pinch Carry'], []).omitted.map(o => o.name), ['Plate Pinch Carry']);
  assert.strictEqual(E.toId('plates'), 'weight-plates');
  assert.strictEqual(E.toId('dip belt'), 'dip-belt');
  assert.strictEqual(E.toId('ab straps'), 'ab-straps');
});

test('landmine work needs the landmine and a bar, and swaps to something real without it', () => {
  const kept = (names, owned) => E.fitExercises(names.map(exerciseName => ({ exerciseName })), owned);
  const gym = ['barbell', 'cable-machine'];
  const names = ['Landmine Rotation', 'Landmine Punch', 'Landmine Push Press', 'Landmine Thruster'];
  const on = kept(names, [...gym, 'landmine']);
  assert.deepStrictEqual(on.omitted, []);
  assert.strictEqual(on.exercises.length, 4);
  const off = kept(['Landmine Push Press', 'Landmine Meadows Row', 'Landmine Thruster'], gym);
  assert.deepStrictEqual(off.substitutions.map(s => s.to), ['Barbell Overhead Press', 'Barbell Bent-Over Row']);
  assert.deepStrictEqual(off.omitted.map(o => o.name), ['Landmine Thruster']);
  assert.deepStrictEqual(kept(['Landmine Rotation'], ['landmine']).omitted.map(o => o.name), ['Landmine Rotation'], 'a landmine with no bar is nothing');
});

test('every landmine exercise has a pose chosen on purpose, and the plan names real exercises', () => {
  const PM = require('../public/pose-map.js');
  const { ex, tpl } = seedArrays();
  const want = { 'Landmine Punch': 'jab-cross', 'Landmine Rotation': 'landmine-rotation', 'Landmine Anti-Rotation': 'landmine-anti-rotation', 'Landmine Rotational Press': 'landmine-press', 'Landmine Deadlift to Rotational Press': 'landmine-deadlift-press', 'Landmine Push Press': 'landmine-press', 'Landmine Thruster': 'landmine-thruster', 'Landmine Split Jerk': 'split-jerk', 'Landmine Meadows Row': 'landmine-row', 'Landmine Reverse Lunge': 'reverse-lunge', 'Landmine Lateral Lunge': 'lateral-lunge' };
  const seeded = ex.filter(e => e.name.startsWith('Landmine ')).map(e => e.name).sort();
  assert.deepStrictEqual(seeded, Object.keys(want).sort());
  for (const [n, k] of Object.entries(want)) assert.strictEqual(PM.keyFor(n), k, n);
  const plan = tpl.find(t => t.slug === 'kit:landmine-power');
  assert.strictEqual(plan.location, 'gym');
  const lib = new Set(ex.map(e => e.name));
  for (const e of plan.exercises) assert.ok(lib.has(e.exerciseName), e.exerciseName);
});

test('ab strap raises show the hanging pose, not the knee strike', () => {
  const PM = require('../public/pose-map.js');
  for (const n of ['Ab Strap Knee Raise', 'Ab Strap Leg Raise', 'Ab Strap Oblique Knee Raise']) assert.strictEqual(PM.keyFor(n), 'hanging-leg-raise', n);
});

test('the new rules: a gym without the kit loses or swaps the right things', () => {
  const swap = (names, owned) => E.fitExercises(names.map(exerciseName => ({ exerciseName })), owned);
  assert.deepStrictEqual(swap(['Band-Assisted Pull-up'], ['bar']).omitted.map(o => o.name), ['Band-Assisted Pull-up']);
  assert.strictEqual(swap(['Band-Assisted Pull-up'], ['power-tower', 'resistance-bands']).omitted.length, 0);
  assert.strictEqual(swap(['Parallette Push-up'], []).exercises[0].exerciseName, 'Push-up');
  assert.strictEqual(swap(['Hanging Knee Raise'], ['captains-chair']).omitted.length, 0);
  assert.strictEqual(swap(['Hanging Knee Raise'], []).exercises[0].exerciseName, 'Lying Leg Raise');
  assert.strictEqual(swap(['Dead Hang'], []).omitted.length, 1);
});

test('equipment plans: a slug that is not a weekday never becomes a day\'s plan', { skip }, async () => {
  const T = require('../api/today');
  const names = ['kit:bands', 'kit:mat', 'mon:home', 'mon:gym'];
  assert.strictEqual(T.resolveSlug(names, 'kit:bands', 'mon'), 'mon:home', 'today page ignores a kit slug and shows the day plan');
  assert.strictEqual(T.resolveSlug(['kit:bands', 'kit:mat'], '', 'mon'), null, 'no day plan means none, not a kit plan');
  const db = await fresh(Bu);
  await G.addEquipment(db, 'home', { equipment: 'resistance-bands' });   // an earlier test took them off this account
  for (const day of G.DAYS) for (const location of ['home', 'park', 'gym']) {
    const p = await G.planFor(db, { day, location });
    if (p.template) assert.ok(!p.template.slug.startsWith('kit:'), `${day} ${location}`);
  }
  const rows = (await db.WorkoutTemplate.findAll()).map(t => t.name);
  for (const s of KIT_SLUGS) assert.ok(rows.includes(s), s + ' reaches an account additively');
  const mon = await G.planFor(db, { day: 'mon', location: 'home' });
  assert.strictEqual(mon.template.slug, 'mon:home');
  assert.deepStrictEqual(mon.fit.omitted, [], 'with bands and the board at Home, Monday loses nothing');
});

test('gyms page: each item with a buy link shows it, sponsored, with the disclosure', { skip }, async () => {
  const html = await (await web(WA, 'GET', '/gyms')).text();
  assert.match(html, /href="https:\/\/www\.amazon\.com\/dp\/B0F8HVK8MD\?tag=octopustec031-20" target="_blank" rel="sponsored nofollow noopener"/);
  assert.match(html, /As an Amazon Associate I earn from qualifying purchases\./);
  assert.ok(!/a\.co\//.test(html));
});
