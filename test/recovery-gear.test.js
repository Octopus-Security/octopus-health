'use strict';

/**
 * Recovery gear: massage balls and the other small kit in the catalogue, the recovery
 * exercises that declare them, substitution when a tool is missing, and routines that name
 * the tool (or swap) for the active gym. Pure rules first; DB/route parts skip without
 * express/sequelize/sqlite3.
 *
 * Run: node --test test/recovery-gear.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../api/equipment');
const mob = require('../api/mobility');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';
const seedSrc = () => {
  if (getDatabase) return { ex: getDatabase.SEED_EXERCISES, tpl: getDatabase.SEED_WORKOUT_TEMPLATES };
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  const grab = n => eval(src.match(new RegExp('const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]); // eslint-disable-line no-eval
  return { ex: grab('SEED_EXERCISES'), tpl: grab('SEED_WORKOUT_TEMPLATES') };
};
const homeIds = () => E.CATALOGUE.gyms.find(g => g.slug === 'home').equipment.map(e => e.id);
const NEW_IDS = ['massage-ball', 'massage-ball-peanut', 'massage-ball-spiky', 'massage-ball-lacrosse', 'massage-ball-set', 'foam-roller', 'strap', 'yoga-block', 'step'];

test('new ids exist, are kebab-case, and the aliases people say resolve', () => {
  for (const id of NEW_IDS) { assert.ok(E.IDS.includes(id), id); assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/); }
  assert.strictEqual(E.toId('lacrosse ball'), 'massage-ball-lacrosse');
  assert.strictEqual(E.toId('peanut ball'), 'massage-ball-peanut');
  assert.strictEqual(E.toId('spiky ball'), 'massage-ball-spiky');
  assert.strictEqual(E.toId('massage ball'), 'massage-ball');
  assert.strictEqual(E.toId('QLDT massage ball set'), 'massage-ball-set');
  assert.strictEqual(E.toId('yoga block'), 'yoga-block');
  assert.strictEqual(E.toId('foam roller'), 'foam-roller');
  assert.strictEqual(E.toId('stretching strap'), 'strap');
  assert.strictEqual(E.toId('stairs'), 'step');
  assert.strictEqual(E.toId('step'), 'step', 'a step is now its own item (stored data holds ids, so nothing is orphaned)');
  assert.strictEqual(E.toId('a box'), null, 'a bare box is ambiguous: neither a chair nor a plyo box');
  assert.strictEqual(E.toId('a plyo box'), 'plyo-box');
  assert.strictEqual(E.toId('bench'), 'chair');
});

test('any ball, and the set, satisfy the generic massage ball; a ball does not satisfy another kind', () => {
  for (const k of ['peanut', 'spiky', 'lacrosse']) {
    assert.ok(E.expand([`massage-ball-${k}`]).has('massage-ball'), k);
    assert.deepStrictEqual(E.unmet(['massage-ball'], E.expand([`massage-ball-${k}`])), []);
  }
  const set = E.expand(['massage-ball-set']);
  for (const id of ['massage-ball-peanut', 'massage-ball-spiky', 'massage-ball-lacrosse', 'massage-ball']) assert.ok(set.has(id), id);
  assert.deepStrictEqual(E.unmet(['massage-ball'], E.expand(['mat'])), ['massage-ball']);
  assert.deepStrictEqual(E.unmet(['massage-ball-lacrosse'], E.expand(['massage-ball-peanut'])), ['massage-ball-lacrosse']);
});

test('the buy link is the set, tagged once, and makes no health claim', () => {
  const b = E.buyLink('massage-ball-set');
  assert.strictEqual(b.label, 'QLDT 3-in-1 massage ball set');
  assert.strictEqual(b.url, 'https://www.amazon.com/dp/B0GRMVPCGZ?tag=octopustec031-20');
  for (const id of ['foam-roller', 'strap', 'yoga-block', 'step', 'massage-ball']) assert.strictEqual(E.buyLink(id), null, `${id} has no buy link`);
  const text = JSON.stringify(E.ITEMS.filter(i => NEW_IDS.includes(i.id)));
  assert.doesNotMatch(text, /plantar|fasciitis|pain|relief|heal|therap|cure|treat/i);
});

test('Home defaults: massage ball set and jump rope, no garage claim; foam roller, strap, block, step are in no gym', () => {
  const home = E.CATALOGUE.gyms.find(g => g.slug === 'home');
  assert.ok(homeIds().includes('massage-ball-set') && homeIds().includes('jump-rope'));
  assert.doesNotMatch(home.notes, /garage|no jump rope/i);
  for (const g of E.CATALOGUE.gyms) for (const id of ['foam-roller', 'strap', 'yoga-block', 'step']) assert.ok(!g.equipment.some(e => e.id === id), `${g.slug} must not default ${id}`);
});

// Add-on gear is not in the seeded Home: an account ticks it on /gyms when it owns it.
const KIT_EXTRA_GEAR = { 'kit:dip-belt': ['dip-belt', 'weight-plates'], 'kit:ab-straps': ['ab-straps'], 'kit:landmine-power': ['landmine', 'barbell'] };

test('Home, plus any add-on gear a plan names, fits every kit plan (those with buy links, and the variety plans) without dropping or swapping anything', () => {
  const { tpl } = seedSrc();
  const kits = tpl.filter(t => String(t.slug).startsWith('kit:'));
  assert.strictEqual(kits.filter(t => E.KIT_PLAN_ITEM[t.slug]).length, 7, 'seven plans carry a buy link');
  assert.ok(kits.length >= 5);
  for (const t of kits) {
    const fit = E.fitExercises(t.exercises, [...homeIds(), ...(KIT_EXTRA_GEAR[t.slug] || [])]);
    assert.deepStrictEqual(fit.omitted, [], t.slug);
    assert.deepStrictEqual(fit.substitutions, [], t.slug);
    assert.strictEqual(fit.exercises.length, t.exercises.length, t.slug);
  }
});

test('recovery exercises that need gear declare it: foam roller, bands, bar, balls', () => {
  const { ex } = seedSrc();
  const rec = ex.filter(e => e.category === 'recovery');
  const need = (name, id) => {
    const r = E.requirementsFor({ name });
    assert.ok(r.requires.some(q => q.split('|').includes(id)), `${name} must require ${id}`);
  };
  const foam = rec.filter(e => /foam roll|over roller/i.test(e.name));
  assert.strictEqual(foam.length, 7, 'the seven foam-roller exercises');
  for (const e of foam) need(e.name, 'foam-roller');
  for (const n of ['Banded Ankle Dorsiflexion', 'Terminal Knee Extension (TKE)', 'Overhead Banded Shoulder Stretch', 'Band Pull-Apart']) need(n, 'resistance-bands');
  for (const n of ['Lat Stretch on Pull-up Bar', 'Relaxed Dead Hang']) need(n, 'bar');
  need('Spiky Ball Foot Roll', 'massage-ball-spiky');
  need('Peanut Ball Upper Back Release', 'massage-ball-peanut');
  need('Lacrosse Ball Glute Release', 'massage-ball-lacrosse');
  need('Lacrosse Ball Chest and Shoulder Release', 'massage-ball-lacrosse');
});

test('strap and block gear is optional: the stretch stays, with a cue for what to use instead', () => {
  const have = E.expand(homeIds());           // Home has bands, no strap
  const withBand = E.fitExercises([{ exerciseName: 'Supine Hamstring Stretch' }], ['resistance-bands']);
  assert.strictEqual(withBand.exercises[0].gearNote, undefined, 'a band stands in for a strap');
  const bare = E.fitExercises([{ exerciseName: 'Supine Hamstring Stretch' }, { exerciseName: 'Prone Quad Stretch' }, { exerciseName: 'PNF Hamstring Contract-Relax' }, { exerciseName: 'Supported Bridge (Block Under Hips)' }], []);
  assert.strictEqual(bare.exercises.length, 4, 'nothing dropped');
  assert.deepStrictEqual(bare.omitted, []);
  assert.match(bare.exercises[0].gearNote, /towel/i);
  assert.match(bare.exercises[1].gearNote, /towel|hand/i);
  assert.match(bare.exercises[3].gearNote, /cushion|towel/i);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Supported Bridge (Block Under Hips)' }], ['yoga-block']).exercises[0].gearNote, undefined);
  for (const n of ['Supine Hamstring Stretch', 'Prone Quad Stretch', 'PNF Hamstring Contract-Relax']) assert.deepStrictEqual(E.requirementsFor({ name: n }).requires, [], `${n} is never blocked`);
  assert.ok(have.has('resistance-bands'));
});

test('substitution table: every foam-roller exercise falls back, and every substitute is a real seeded exercise', () => {
  const { ex } = seedSrc();
  const names = new Set(ex.map(e => e.name));
  const want = {
    'Foam Roll Thoracic Spine': 'Thoracic Open Book', 'Thoracic Extension over Roller': 'Thoracic Open Book',
    'Foam Roll Hip Flexors': 'Half-Kneeling Hip Flexor Stretch', 'Foam Roll Adductors': 'Butterfly Stretch',
    'Foam Roll Lats': "Child's Pose", 'Calf Foam Roll': 'Standing Calf Stretch (Wall)', 'ITB Foam Roll': 'Standing Crossover IT Band Stretch',
  };
  for (const [from, to] of Object.entries(want)) {
    const fit = E.fitExercises([{ exerciseName: from }], ['mat']);
    assert.deepStrictEqual(fit.substitutions, [{ from, to }], from);
    assert.ok(names.has(to), `${to} must be a seeded exercise`);
    assert.strictEqual(E.fitExercises([{ exerciseName: from }], ['foam-roller']).substitutions.length, 0, `${from} stays with a roller`);
  }
  // the honest massage-ball version, where there is one, comes first
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Foam Roll Thoracic Spine' }], ['massage-ball-peanut']).substitutions,
    [{ from: 'Foam Roll Thoracic Spine', to: 'Peanut Ball Upper Back Release' }]);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Foam Roll Thoracic Spine' }], ['massage-ball-set']).substitutions.map(s => s.to), ['Peanut Ball Upper Back Release']);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Foam Roll Thoracic Spine' }], ['massage-ball-lacrosse']).substitutions.map(s => s.to), ['Thoracic Open Book'], 'a lacrosse ball is not the upper-back tool');
  // bands and bar
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Banded Ankle Dorsiflexion' }], []).substitutions, [{ from: 'Banded Ankle Dorsiflexion', to: 'Ankle Dorsiflexion Wall Drill' }]);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Overhead Banded Shoulder Stretch' }], []).substitutions.map(s => s.to), ['Cross-Body Shoulder Stretch']);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Lat Stretch on Pull-up Bar' }], []).substitutions.map(s => s.to), ['Overhead Triceps Stretch']);
  // no sensible substitute: reported as left out, not hidden
  for (const n of ['Terminal Knee Extension (TKE)', 'Relaxed Dead Hang', 'Spiky Ball Foot Roll']) {
    const f = E.fitExercises([{ exerciseName: n }], []);
    assert.strictEqual(f.exercises.length, 0, n); assert.strictEqual(f.omitted.length, 1, n);
  }
  // every substitute named anywhere in the new rules exists
  for (const r of E.CATALOGUE.exerciseRules) for (const s of r.substitutes || []) if (/foam|ball|band|bar/i.test(r.match + r.requires)) assert.ok(names.has(s.name) || /cable|dumbbell|lying|hollow|wide|diamond|push-up|bodyweight|lat pulldown/i.test(s.name), `${r.match} -> ${s.name}`);
});

test('the four ball exercises are seeded once each, with placement safety and no sizes or claims', () => {
  const { ex } = seedSrc();
  const balls = ex.filter(e => ['Spiky Ball Foot Roll', 'Peanut Ball Upper Back Release', 'Lacrosse Ball Glute Release', 'Lacrosse Ball Chest and Shoulder Release'].includes(e.name));   // the later lacrosse entries are in variety.test.js
  assert.strictEqual(balls.length, 4);
  for (const e of balls) {
    assert.strictEqual(e.category, 'recovery');
    assert.doesNotMatch(e.instructions, /\b\d+\s?(mm|cm|inch|in\b)|firm|soft|hard|plantar|fasciitis|relieve|heal|cure|treat/i, e.name);
  }
  assert.match(balls.find(e => /Peanut/.test(e.name)).instructions, /never on the spine/);
  assert.match(balls.find(e => /Glute/.test(e.name)).instructions, /off the tailbone/);
  assert.match(balls.find(e => /Chest/.test(e.name)).instructions, /front of the neck/);
});

test('routine items: declared gear uses real ids, tool cues are short, and no per-card safety text is added', () => {
  const ids = new Set(E.IDS);
  let gear = 0;
  for (const r of mob.ROUTINES) for (const it of r.items) {
    if (!it.requires) { assert.ok(!it.tool && !it.alt, `${it.id}: tool without requires`); continue; }
    gear++;
    for (const q of it.requires) for (const a of q.split('|')) assert.ok(ids.has(a), `${it.id}: unknown ${a}`);
    assert.ok(it.tool && it.tool.length <= 60, `${it.id}: tool cue`);
    assert.doesNotMatch(it.tool, /pain|stop/i, 'the safety line is the single NOTE, not per card');
    if (it.alt) { assert.ok(it.alt.name && it.alt.cue && it.alt.demo, `${it.id}: alt`); for (const q of it.alt.requires || []) for (const a of q.split('|')) assert.ok(ids.has(a)); }
  }
  assert.ok(gear >= 10, `gear items: ${gear}`);
  const byId = Object.fromEntries(mob.ROUTINES.flatMap(r => r.items.map(i => [i.id, i])));
  for (const [id, need] of Object.entries({ 'heel-drop': 'step', 'band-pull-aparts': 'resistance-bands', 'band-er': 'resistance-bands', 'face-pull': 'resistance-bands', 'finger-wrist': 'resistance-bands', copenhagen: 'chair' })) {
    assert.ok(byId[id].requires.join('|').includes(need), id);
  }
});

// the item as shown: an item that was swapped for its alternative is NOT the original
const find = (routines, id) => routines.flatMap(r => r.items).find(i => i.id === id && !i.swappedFrom);

test('Home: balls and bands show their tool; heel drops and Copenhagen swap because Home has no step or bench', () => {
  const home = E.expand(homeIds());
  const R = mob.fitRoutines(mob.ROUTINES, home);
  assert.strictEqual(find(R, 'ball-foot').tool, 'Use the spiky ball');
  assert.strictEqual(find(R, 'ball-upper-back').tool, 'Use the peanut ball');
  assert.strictEqual(find(R, 'ball-glute').tool, 'Use the lacrosse ball');
  assert.strictEqual(find(R, 'ball-chest').tool, 'Use the lacrosse ball');
  assert.strictEqual(find(R, 'band-pull-aparts').tool, 'Use a resistance band');
  assert.strictEqual(find(R, 'face-pull').tool, 'Use a resistance band anchored at head height');
  assert.strictEqual(find(R, 'heel-drop'), undefined);
  assert.strictEqual(find(R, 'copenhagen'), undefined);
  const sw = R.flatMap(r => r.items).filter(i => i.swappedFrom).map(i => i.swappedFrom);
  assert.ok(sw.some(n => /heel drops/i.test(n)) && sw.some(n => /Copenhagen/i.test(n)));
  assert.ok(R.every(r => Array.isArray(r.omitted)));
  // add a chair at Home and both come back with their tool
  const withChair = mob.fitRoutines(mob.ROUTINES, E.expand([...homeIds(), 'chair']));
  assert.strictEqual(find(withChair, 'heel-drop').tool, 'Use a step or the edge of a stair');
  assert.strictEqual(find(withChair, 'copenhagen').tool, 'Use a chair or bench');
});

test('without the tool a routine substitutes, and says so; with no substitute it lists the item as left out', () => {
  const park = E.expand(['bar', 'jump-rope']);
  const R = mob.fitRoutines(mob.ROUTINES, park);
  const sunday = R.find(r => r.id === 'sunday-flow');
  const ub = sunday.items.find(i => i.swappedFrom === 'Peanut ball upper-back release');
  assert.strictEqual(ub.name, 'Open book');
  assert.match(ub.swapNote, /no Peanut massage ball here/);
  assert.strictEqual(ub.tool, undefined);
  assert.ok(sunday.items.find(i => i.swappedFrom === 'Lacrosse ball glute release'));
  assert.ok(sunday.items.find(i => i.swappedFrom === 'Lacrosse ball chest and shoulder release'));
  assert.ok(!sunday.items.some(i => i.id === 'ball-foot'));
  assert.ok(sunday.omitted.some(o => /Spiky ball foot roll left out/.test(o.note)), 'no substitute: said, not hidden');
  const inj = R.find(r => r.id === 'injury-prevention');
  assert.ok(inj.omitted.some(o => /Face pulls left out/.test(o.note)));
  assert.strictEqual(R.flatMap(r => r.items).find(i => i.id === 'band-er').name, 'Side-lying external rotation');
  // no duplicate names in any routine
  for (const r of R) { const n = r.items.map(i => i.name.toLowerCase()); assert.strictEqual(new Set(n).size, n.length, r.id); }
  // gym unknown: nothing swapped, hidden or claimed
  const unknown = mob.fitRoutines(mob.ROUTINES, null);
  assert.ok(unknown.every(r => r.items.length === mob.ROUTINES.find(x => x.id === r.id).items.length && r.items.every(i => !i.tool && !i.swappedFrom)));
  // the raw routines are never mutated by fitting
  assert.ok(mob.ROUTINES.flatMap(r => r.items).some(i => i.alt && i.requires));
});

test('body-map lookups carry the tool too', () => {
  const home = E.expand(homeIds());
  const items = mob.itemsFor('muscle', 'glutes', home);
  const g = items.find(i => i.id === 'ball-glute');
  assert.ok(g && g.tool === 'Use the lacrosse ball');
  assert.ok(mob.itemsFor('muscle', 'glutes').every(i => !i.tool), 'no gym, no tool claimed');
});

const stamp = `zz_rg_${process.pid}`;
const used = new Set();
let server, base;
before(async () => {
  if (skip) return;
  const G = require('../api/gyms-store');
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { const u = req.get('x-test-user'); if (!u) return res.status(401).end(); used.add(u); req.user = { username: u }; next(); });
  const requireLogin = (req, res, next) => next();
  mob(app, { requireLogin, getDatabase });
  app.get('/gyms-probe', async (req, res) => { const db = getDatabase(req.user.username); await db.sequelize.sync(); res.json(await G.listGyms(db)); });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of used) { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* not created */ } }
});
const get = (user, p) => fetch(base + p, { headers: { 'x-test-user': user } }).then(async r => ({ status: r.status, j: await r.json() }));

test('a new account at Home sees tools on the routines endpoint; an account without the balls sees swaps', { skip }, async () => {
  const G = require('../api/gyms-store');
  const a = `${stamp}_a`, b = `${stamp}_b`;
  let r = await get(a, '/mobility/api/routines');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.j.gym.slug, 'home');
  const sunday = r.j.routines.find(x => x.id === 'sunday-flow');
  assert.strictEqual(sunday.items.find(i => i.id === 'ball-glute').tool, 'Use the lacrosse ball');
  assert.strictEqual(sunday.items.find(i => i.id === 'ball-glute').requires, undefined, 'gear internals are not sent');
  assert.match(r.j.note, /sharp pain/, 'the single safety note still ships');
  // b: same defaults, then the ball set is removed on /gyms
  await get(b, '/gyms-probe');
  const db = getDatabase(b); await db.sequelize.sync();
  await G.removeEquipment(db, 'home', 'massage-ball-set');
  r = await get(b, '/mobility/api/routines');
  const s2 = r.j.routines.find(x => x.id === 'sunday-flow');
  assert.ok(!s2.items.some(i => i.id === 'ball-glute' && !i.swappedFrom));
  assert.ok(s2.items.some(i => i.swappedFrom === 'Lacrosse ball glute release'));
  // account a is unaffected by b
  r = await get(a, '/mobility/api/routines');
  assert.ok(r.j.routines.find(x => x.id === 'sunday-flow').items.some(i => i.id === 'ball-glute' && !i.swappedFrom));
  // at= another location
  r = await get(a, '/mobility/api/routines?at=park');
  assert.strictEqual(r.j.gym.slug, 'park');
});

test("existing accounts' Home rows are never changed by the new defaults", { skip }, async () => {
  const G = require('../api/gyms-store');
  const u = `${stamp}_old`; used.add(u);
  const db = getDatabase(u);
  await db.sequelize.sync(); await db.migrate();
  // an account created before this change: Home already exists with its own, shorter list
  const home = await db.Gym.create({ slug: 'home', name: 'Home', notes: 'Garage setup: my old notes', sortOrder: 0 });
  for (const id of ['power-tower', 'ab-roller', 'mat']) await db.GymEquipment.create({ gymId: home.id, equipmentId: id });
  await db.seedData();
  const gyms = await G.listGyms(db);
  const h = gyms.find(g => g.slug === 'home');
  assert.deepStrictEqual(h.equipment.map(e => e.id).sort(), ['ab-roller', 'mat', 'power-tower']);
  assert.strictEqual(h.notes, 'Garage setup: my old notes');
  assert.ok(!h.effective.includes('massage-ball') && !h.effective.includes('jump-rope'));
  // and the routines for that account do not claim gear it lacks
  const R = mob.fitRoutines(mob.ROUTINES, new Set(h.effective));
  assert.strictEqual(find(R, 'ball-glute'), undefined);
});

test('daily stretches carry a gear cue for display and keep their stored names', { skip }, async () => {
  const ds = require('../api/daily-stretches');
  const u = `${stamp}_ds`; used.add(u);
  const db = getDatabase(u);
  await db.sequelize.sync(); await db.migrate(); await db.seedData();
  const items = ds.withGear([{ name: 'Supine Hamstring Stretch' }, { name: 'Foam Roll Lats' }, { name: 'Terminal Knee Extension (TKE)' }, { name: 'Thoracic Open Book' }], E.expand(homeIds()));
  assert.deepStrictEqual(items.map(i => i.name), ['Supine Hamstring Stretch', 'Foam Roll Lats', 'Terminal Knee Extension (TKE)', 'Thoracic Open Book']);
  assert.strictEqual(items[0].gear.state, 'ok', 'Home has bands, which stand in for a strap');
  assert.match(items[1].gear.text, /Swapped for Child's Pose/);
  assert.strictEqual(items[2].gear.state, 'ok', 'Home has bands, so the TKE stays');
  assert.strictEqual(items[3].gear, undefined);
  const bare = ds.withGear([{ name: 'Supine Hamstring Stretch' }], new Set());
  assert.strictEqual(bare[0].gear.state, 'optional-missing');
  assert.match(bare[0].gear.text, /towel/);
  assert.strictEqual(ds.withGear([{ name: 'Foam Roll Lats' }], null)[0].gear, undefined, 'unknown gym says nothing');
  const v = await ds.view(db);
  assert.ok(v.items.length > 0);
});
