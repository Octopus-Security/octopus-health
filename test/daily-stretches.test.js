'use strict';

/**
 * Daily stretches: the selection default, add / remove / reorder / edit, presets
 * (replace and add, with dedupe), the service route cortex calls, and seeding
 * that must never overwrite a choice.
 *
 * Uses the real database.js against throwaway accounts (data/zz_ds_<pid>_*),
 * removed afterwards. DB-backed tests skip without express/sequelize/sqlite3.
 *
 * Run: node --test test/daily-stretches.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, ejs, getDatabase, ds;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); ds = require('../api/daily-stretches'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

const stamp = `zz_ds_${process.pid}`;
const used = new Set();
const userFor = (tag) => { const n = `${stamp}_${tag}`; used.add(n); return n; };
const STARTER = 'Daily Starter Stretch (10 min)';
const names = (d) => d.items.map(i => i.name);

async function fresh(tag) {
  const username = userFor(tag);
  const db = getDatabase(username);
  await db.sequelize.sync();
  await db.seedData();
  return { username, db };
}
const idOf = async (db, name) => (await db.ExerciseDefinition.findOne({ where: { name } })).id;
const presetId = async (db, name) => (await db.ExercisePlan.findOne({ where: { name } })).id;

let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    used.add(u);
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'stretch';
    const db = getDatabase(u); await db.sequelize.sync(); await db.seedData(); next();
  };
  ds(app, { requireLogin, getDatabase });
  require('../api/body-map')(app, { requireLogin, getDatabase });
  app.use('/api/service', require('../api/routes/service'));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of used) { try { fs.unlinkSync(path.join(__dirname, '..', 'data', `${n}_health.sqlite`)); } catch { /* not created */ } }
});

// ── Seeds ────────────────────────────────────────────────────────────────────

test('every preset item names a stretch that exists in the catalogue', { skip }, () => {
  const catalogue = new Map(getDatabase.SEED_EXERCISES.map(e => [e.name, e]));
  const presets = getDatabase.SEED_EXERCISE_PLANS.filter(p => p.type === 'stretch');
  assert.ok(presets.length >= 5, 'starter plus four presets');
  for (const p of presets) for (const i of p.items) {
    assert.ok(catalogue.has(i.name), `${p.name}: ${i.name} is not in the catalogue`);
    assert.strictEqual(catalogue.get(i.name).category, 'recovery', `${p.name}: ${i.name} is not a stretch`);
  }
  const wanted = ['Desk Worker Posture Stretch', 'Hips & Lower Body Stretch (BJJ)', 'Upper Body & Shoulders Stretch', 'Quick 5 Minute Stretch', STARTER];
  for (const w of wanted) assert.ok(presets.some(p => p.name === w), `missing preset ${w}`);
});

test('the quick preset really is about five minutes', { skip }, () => {
  const q = getDatabase.SEED_EXERCISE_PLANS.find(p => p.name === 'Quick 5 Minute Stretch');
  assert.strictEqual(ds.totalMinutes(q.items.map(ds.fromStored)), 5);
});

// ── Selection default ────────────────────────────────────────────────────────

test('with nothing chosen the daily list is the Daily Starter, and reading stores nothing', { skip }, async () => {
  const { db } = await fresh('default');
  const d = await ds.loadDaily(db);
  assert.strictEqual(d.isDefault, true);
  assert.strictEqual(d.name, STARTER);
  assert.strictEqual(d.items.length, 8);
  assert.strictEqual(await db.UserSetting.count({ where: { key: ds.SETTING_KEY } }), 0);
  assert.strictEqual(await db.ExercisePlan.count({ where: { name: ds.MY_NAME } }), 0);
  assert.strictEqual(ds.totalMinutes(d.items), 8);
});

test('a deleted starter with nothing chosen is an empty list, not an error', { skip }, async () => {
  const { db } = await fresh('nostarter');
  await db.ExercisePlan.destroy({ where: { name: STARTER } });
  const d = await ds.loadDaily(db);
  assert.deepStrictEqual(d.items, []);
  assert.strictEqual(ds.totalMinutes(d.items), 0);
});

// ── Add / remove / reorder / edit ────────────────────────────────────────────

test('the first change copies the starter into the user\'s own plan and leaves the starter alone', { skip }, async () => {
  const { username, db } = await fresh('copy');
  const before_ = (await db.ExercisePlan.findOne({ where: { name: STARTER } })).items;
  const r = await ds.addStretch(db, username, await idOf(db, 'Pigeon Stretch'));
  assert.strictEqual(r.daily.isDefault, false);
  assert.strictEqual(r.daily.name, ds.MY_NAME);
  assert.strictEqual(r.daily.items.length, 9);
  assert.strictEqual(r.daily.items[8].name, 'Pigeon Stretch');
  assert.strictEqual((await db.ExercisePlan.findOne({ where: { name: STARTER } })).items, before_, 'starter was edited');
});

test('add is idempotent, remove drops one, and only stretches can be added', { skip }, async () => {
  const { username, db } = await fresh('addrm');
  const id = await idOf(db, 'Frog Stretch');
  await ds.addStretch(db, username, id);
  const again = await ds.addStretch(db, username, id);
  assert.strictEqual(again.changed, false);
  assert.strictEqual(names(again.daily).filter(n => n === 'Frog Stretch').length, 1);
  const rm = await ds.removeStretch(db, username, { exerciseId: id });
  assert.ok(!names(rm.daily).includes('Frog Stretch'));
  const rmAgain = await ds.removeStretch(db, username, { exerciseId: id });
  assert.strictEqual(rmAgain.changed, false);
  await assert.rejects(ds.addStretch(db, username, await idOf(db, 'Barbell Back Squat')), /only stretches/);
  await assert.rejects(ds.addStretch(db, username, 999999), /unknown exercise/);
  await assert.rejects(ds.addStretch(db, username, 'x'), /unknown exercise/);
  assert.strictEqual(await db.ExercisePlan.count({ where: { name: ds.MY_NAME } }), 1, 'one own plan only');
});

test('emptying the list stays empty (it does not fall back to the starter)', { skip }, async () => {
  const { username, db } = await fresh('empty');
  let d = await ds.loadDaily(db);
  for (const i of d.items) await ds.removeStretch(db, username, i);
  d = await ds.loadDaily(db);
  assert.deepStrictEqual(d.items, []);
  assert.strictEqual(d.isDefault, false);
});

test('reorder moves one place, and stops at the ends', { skip }, async () => {
  const { username, db } = await fresh('order');
  const first = names(await ds.view(db))[0], second = names(await ds.view(db))[1];
  let r = await ds.moveStretch(db, username, { name: first }, 'down');
  assert.deepStrictEqual(names(r.daily).slice(0, 2), [second, first]);
  r = await ds.moveStretch(db, username, { name: second }, 'up');
  assert.strictEqual(r.changed, false, 'already first');
  const last = names(r.daily).at(-1);
  r = await ds.moveStretch(db, username, { name: last }, 'down');
  assert.strictEqual(r.changed, false, 'already last');
  await assert.rejects(ds.moveStretch(db, username, { name: first }, 'sideways'), /direction/);
  await assert.rejects(ds.moveStretch(db, username, { name: 'Nope' }, 'up'), /not in your daily/);
});

test('hold seconds and sides are editable, validated, and counted in the total', { skip }, async () => {
  const { username, db } = await fresh('edit');
  const name = names(await ds.view(db))[0];
  let r = await ds.updateStretch(db, username, { name }, { holdSeconds: 60 });
  assert.strictEqual(r.daily.items[0].holdSeconds, 60);
  assert.strictEqual(r.daily.totalMinutes, 9);   // 8 min + 30s * 2 sides more
  r = await ds.updateStretch(db, username, { name }, { sides: 1 });
  assert.strictEqual(r.daily.items[0].sides, 1);
  assert.strictEqual(r.daily.totalMinutes, 8);
  await assert.rejects(ds.updateStretch(db, username, { name }, { holdSeconds: 2 }), /holdSeconds/);
  await assert.rejects(ds.updateStretch(db, username, { name }, { holdSeconds: 9999 }), /holdSeconds/);
  await assert.rejects(ds.updateStretch(db, username, { name }, { sides: 3 }), /sides/);
  await assert.rejects(ds.updateStretch(db, username, { name }, {}), /give/);
});

test('two quick adds do not create two own plans', { skip }, async () => {
  const { username, db } = await fresh('race');
  await Promise.all([
    ds.addStretch(db, username, await idOf(db, 'Frog Stretch')),
    ds.addStretch(db, username, await idOf(db, 'Pigeon Stretch')),
    ds.addStretch(db, username, await idOf(db, 'Cobra Stretch')),
  ]);
  assert.strictEqual(await db.ExercisePlan.count({ where: { name: ds.MY_NAME } }), 1);
  const d = await ds.view(db);
  for (const n of ['Frog Stretch', 'Pigeon Stretch', 'Cobra Stretch']) assert.ok(names(d).includes(n), `${n} lost to a race`);
});

// ── Presets ──────────────────────────────────────────────────────────────────

test('presets list excludes the user\'s own plan; replace swaps the list', { skip }, async () => {
  const { username, db } = await fresh('replace');
  await ds.addStretch(db, username, await idOf(db, 'Frog Stretch'));
  const list = await ds.listPresets(db);
  assert.ok(list.some(p => p.name === 'Quick 5 Minute Stretch'));
  assert.ok(list.some(p => p.name === STARTER));
  assert.ok(!list.some(p => p.name === ds.MY_NAME), 'own plan offered as a preset');
  const r = await ds.loadPreset(db, username, await presetId(db, 'Quick 5 Minute Stretch'), 'replace');
  assert.strictEqual(r.daily.items.length, 5);
  assert.strictEqual(r.daily.totalMinutes, 5);
  assert.ok(!names(r.daily).includes('Frog Stretch'));
});

test('add mode appends only what is missing and reports the skipped', { skip }, async () => {
  const { username, db } = await fresh('add');
  await ds.loadPreset(db, username, await presetId(db, 'Quick 5 Minute Stretch'), 'replace');
  const r = await ds.loadPreset(db, username, await presetId(db, 'Desk Worker Posture Stretch'), 'add');
  // Desk Worker has 5; it shares Upper Trap, Doorway Chest, Thoracic Open Book and Half-Kneeling Hip Flexor with Quick 5.
  assert.strictEqual(r.skipped, 4);
  assert.strictEqual(r.added, 1);
  const n = names(r.daily);
  assert.strictEqual(n.length, 6);
  assert.strictEqual(new Set(n).size, n.length, 'duplicates');
  const again = await ds.loadPreset(db, username, await presetId(db, 'Desk Worker Posture Stretch'), 'add');
  assert.strictEqual(again.added, 0);
  assert.strictEqual(again.daily.items.length, 6);
});

test('add mode on an untouched account builds on the starter', { skip }, async () => {
  const { username, db } = await fresh('addstarter');
  const r = await ds.loadPreset(db, username, await presetId(db, 'Hips & Lower Body Stretch (BJJ)'), 'add');
  assert.ok(r.daily.items.length >= 8 && r.daily.items.length <= 14);
  assert.strictEqual(new Set(names(r.daily)).size, r.daily.items.length);
  assert.ok(names(r.daily).includes('Pigeon Stretch'));
  assert.ok(names(r.daily).includes('Doorway Chest Stretch'), 'starter content kept');
});

test('a loaded preset is a copy: editing the list never edits the preset', { skip }, async () => {
  const { username, db } = await fresh('copyfix');
  const id = await presetId(db, 'Quick 5 Minute Stretch');
  const before_ = (await db.ExercisePlan.findByPk(id)).items;
  await ds.loadPreset(db, username, id, 'replace');
  const first = names(await ds.view(db))[0];
  await ds.updateStretch(db, username, { name: first }, { holdSeconds: 90 });
  await ds.removeStretch(db, username, { name: first });
  assert.strictEqual((await db.ExercisePlan.findByPk(id)).items, before_);
});

test('bad preset requests are refused', { skip }, async () => {
  const { username, db } = await fresh('badpreset');
  await assert.rejects(ds.loadPreset(db, username, await presetId(db, 'Quick 5 Minute Stretch'), 'merge'), /mode/);
  await assert.rejects(ds.loadPreset(db, username, 99999, 'add'), /unknown preset/);
  const strength = await db.ExercisePlan.create({ name: 'Leg day', type: 'strength', items: '[]' });
  await assert.rejects(ds.loadPreset(db, username, strength.id, 'add'), /unknown preset/);
});

// ── Seeding never overwrites a choice ────────────────────────────────────────

test('re-seeding is idempotent and leaves a chosen list, and the choice, alone', { skip }, async () => {
  const { username, db } = await fresh('seed');
  await ds.loadPreset(db, username, await presetId(db, 'Quick 5 Minute Stretch'), 'replace');
  await ds.moveStretch(db, username, { name: names(await ds.view(db))[0] }, 'down');
  const mine = (await ds.loadDaily(db)).plan;
  const snapshot = mine.items;
  const plans = await db.ExercisePlan.count();
  await db.seedData(); await db.seedData();
  assert.strictEqual(await db.ExercisePlan.count(), plans, 'seeding duplicated plans');
  assert.strictEqual((await db.ExercisePlan.findByPk(mine.id)).items, snapshot, 'seeding rewrote the chosen list');
  assert.strictEqual((await ds.loadDaily(db)).plan.id, mine.id);
  // and a deleted preset comes back (additive by name) without disturbing the choice
  await db.ExercisePlan.destroy({ where: { name: 'Desk Worker Posture Stretch' } });
  await db.seedData();
  assert.strictEqual(await db.ExercisePlan.count({ where: { name: 'Desk Worker Posture Stretch' } }), 1);
  assert.strictEqual((await db.ExercisePlan.findByPk(mine.id)).items, snapshot);
});

test('a deleted own plan falls back to the default instead of failing', { skip }, async () => {
  const { username, db } = await fresh('gone');
  await ds.addStretch(db, username, await idOf(db, 'Frog Stretch'));
  await db.ExercisePlan.destroy({ where: { name: ds.MY_NAME } });
  const d = await ds.view(db);
  assert.strictEqual(d.isDefault, true);
  assert.strictEqual(d.items.length, 8);
});

// ── Web routes ───────────────────────────────────────────────────────────────

const web = (user, method, p, body) => fetch(base + p, {
  method, redirect: 'manual',
  headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
  body: method === 'GET' ? undefined : JSON.stringify(body || {}),
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

test('every daily-stretch route refuses an anonymous caller', { skip }, async () => {
  for (const [m, p] of [['GET', '/stretch/api/daily'], ['POST', '/stretch/api/daily/add'], ['POST', '/stretch/api/daily/remove'],
    ['POST', '/stretch/api/daily/move'], ['POST', '/stretch/api/daily/update'], ['POST', '/stretch/api/daily/preset']]) {
    assert.strictEqual((await web(null, m, p, {})).status, 302, `${m} ${p}`);
  }
});

test('web routes round-trip, and one user never sees or changes another\'s list', { skip }, async () => {
  const A = userFor('web_a'), B = userFor('web_b');
  const start = await web(A, 'GET', '/stretch/api/daily');
  assert.strictEqual(start.status, 200);
  assert.strictEqual(start.body.daily.isDefault, true);
  assert.ok(start.body.presets.length >= 5);
  const frog = await idOf(getDatabase(A), 'Frog Stretch');
  const added = await web(A, 'POST', '/stretch/api/daily/add', { exerciseId: frog });
  assert.strictEqual(added.body.daily.items.at(-1).name, 'Frog Stretch');
  const preset = start.body.presets.find(p => p.name === 'Quick 5 Minute Stretch');
  const loaded = await web(A, 'POST', '/stretch/api/daily/preset', { presetId: preset.id, mode: 'replace' });
  assert.strictEqual(loaded.body.daily.items.length, 5);
  assert.strictEqual((await web(A, 'POST', '/stretch/api/daily/preset', { presetId: preset.id, mode: 'x' })).status, 400);
  assert.strictEqual((await web(A, 'POST', '/stretch/api/daily/add', { exerciseId: 999999 })).status, 404);
  const theirs = await web(B, 'GET', '/stretch/api/daily');
  assert.strictEqual(theirs.body.daily.isDefault, true, 'B was changed by A');
  assert.strictEqual(theirs.body.daily.items.length, 8);
});

// ── Service route ────────────────────────────────────────────────────────────

const svc = (user, headers = {}) => fetch(base + '/api/service/stretches/daily', {
  headers: { ...(user ? { 'X-Service-User': user } : {}), ...headers },
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

test('service route: a token is required', { skip }, async () => {
  const u = userFor('svc_tok');
  assert.strictEqual((await svc(u)).status, 401);
  assert.strictEqual((await svc(u, { 'X-Service-Token': 'wrong' })).status, 401);
  assert.strictEqual((await svc(u, { 'X-Service-Token': 'test-token' })).status, 200);
});

test('service route: a bad username is refused, never turned into a path', { skip }, async () => {
  const r = await svc('../evil', { 'X-Service-Token': 'test-token' });
  assert.strictEqual(r.status, 400);
});

test('service route: shape, and a first-time account gets the starter', { skip }, async () => {
  const u = userFor('svc_shape');          // never opened the web UI: not even seeded
  const r = await svc(u, { 'X-Service-Token': 'test-token' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.ok, true);
  assert.strictEqual(r.body.name, STARTER);
  assert.strictEqual(r.body.totalMinutes, 8);
  assert.strictEqual(r.body.items.length, 8);
  assert.match(r.body.url, /^https?:\/\/.+\/stretch$/);
  const it = r.body.items[0];
  assert.deepStrictEqual(Object.keys(it).sort(), ['holdSeconds', 'instructions', 'name', 'sets', 'sides']);
  assert.strictEqual(it.holdSeconds, 30);
  assert.strictEqual(it.sides, 2);
  assert.ok(it.instructions.length > 0 && it.instructions.length <= 160);
});

test('service route: returns only that user\'s own list', { skip }, async () => {
  const A = userFor('svc_a'), B = userFor('svc_b');
  const H = { 'X-Service-Token': 'test-token' };
  await svc(A, H); await svc(B, H);
  const dbA = getDatabase(A);
  await ds.loadPreset(dbA, A, await presetId(dbA, 'Quick 5 Minute Stretch'), 'replace');
  await ds.addStretch(dbA, A, await idOf(dbA, 'Pigeon Stretch'));
  const a = await svc(A, H), b = await svc(B, H);
  assert.strictEqual(a.body.items.length, 6);
  assert.ok(a.body.items.some(i => i.name === 'Pigeon Stretch'));
  assert.strictEqual(b.body.items.length, 8);
  assert.ok(!b.body.items.some(i => i.name === 'Pigeon Stretch'), 'B received A\'s stretch');
});

test('service route: an emptied list is a valid empty answer, not an error and not the default', { skip }, async () => {
  const u = userFor('svc_empty');
  const H = { 'X-Service-Token': 'test-token' };
  await svc(u, H);
  const db = getDatabase(u);
  for (const i of (await ds.loadDaily(db)).items) await ds.removeStretch(db, u, i);
  const r = await svc(u, H);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.ok, true);
  assert.deepStrictEqual(r.body.items, []);
  assert.strictEqual(r.body.totalMinutes, 0);
});

// ── Pages ────────────────────────────────────────────────────────────────────

test('instructions are shortened on a sentence or word boundary', () => {
  const { shortInstructions } = require('../api/daily-stretches');
  assert.strictEqual(shortInstructions('Short one.'), 'Short one.');
  const long = 'Lie on your back and loop a strap around one foot. ' + 'Keep going and breathe slowly through the whole thing, '.repeat(6);
  const s = shortInstructions(long);
  assert.ok(s.length <= 143, s.length);
  assert.ok(!/\s$/.test(s));
});

test('the stretch page renders the daily section with only stretches in its picker, and escapes data', { skip }, async () => {
  const lib = [
    { id: 1, name: 'Frog Stretch', category: 'recovery' },
    { id: 2, name: 'Barbell Back Squat', category: 'strength' },
    { id: 3, name: '</script><b>x', category: 'recovery' },
  ];
  const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'stretch.ejs'), {
    title: 'Stretch Builder', user: { username: 'x' }, routines: [], exerciseLibrary: lib,
    asset: (p) => p, activeTab: 'stretch',
  });
  const m = html.match(/<script type="application\/json" id="ds-library">([\s\S]*?)<\/script>/);
  assert.ok(m, 'picker data present');
  const picked = JSON.parse(m[1]);
  assert.deepStrictEqual(picked.map(p => p.id), [1, 3]);
  assert.ok(html.includes('id="ds-root"') && html.includes('/js/daily-stretches.js'));
});

test('the demo route returns the how-to by id or by name, and is login-gated', { skip }, async () => {
  const { username: u, db } = await fresh('demo');
  const id = await idOf(db, 'Half-Kneeling Hip Flexor Stretch');
  const byId = await web(u, 'GET', `/stretch/api/demo?id=${id}&name=x`);
  assert.strictEqual(byId.body.exercise.name, 'Half-Kneeling Hip Flexor Stretch');
  assert.strictEqual(byId.body.exercise.id, id);
  const byName = await web(u, 'GET', '/stretch/api/demo?name=' + encodeURIComponent('half-kneeling hip flexor stretch'));
  assert.strictEqual(byName.body.exercise.id, id);
  const none = await web(u, 'GET', '/stretch/api/demo?name=nothing-like-this');
  assert.strictEqual(none.body.exercise, null);
  assert.strictEqual((await web(null, 'GET', '/stretch/api/demo?id=' + id)).status, 302);
});

test('the demo sheet is wired into /stretch and /body, and daily names open it', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  for (const v of ['views/stretch.ejs', 'views/body.ejs']) {
    const html = read(v);
    assert.match(html, /stretch-demo\.css/, v);
    assert.match(html, /js\/stretch-demo\.js/, v);
  }
  assert.match(read('views/body.ejs'), /stick-figure\.js[\s\S]*pose-map\.js/);
  assert.match(read('public/js/daily-stretches.js'), /StretchDemo\.link/);
  assert.match(read('public/js/body-map.js'), /StretchDemo\.link/);
});

test('the head row of the daily card has the same gap below it as inside it', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'daily-stretches.css'), 'utf8');
  const head = css.match(/\.ds-head \{([^}]*)\}/)[1];
  assert.match(head, /gap: var\(--space-3\)/);
  assert.match(head, /padding-bottom: var\(--space-3\)/);
});
