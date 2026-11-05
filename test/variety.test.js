'use strict';

/**
 * Variety (step 3): the exercises, routines and plans added for soft tissue, neck, wrists, knees,
 * feet, grip, balance, conditioning and breathing. Checks that everything resolves, declares its
 * gear, fits the owner's kit, carries no treatment claim, and cannot become a day's plan.
 *
 * Run: node --test test/variety.test.js
 */

require('./helpers/data-dir');
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../api/equipment');
const mob = require('../api/mobility');
const PM = require('../public/pose-map');
const { RECOVERY_NOTE } = require('../lib/recovery-note');

const seed = () => {
  let getDatabase = null;
  try { require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* read the source */ }
  if (getDatabase) return { ex: getDatabase.SEED_EXERCISES, tpl: getDatabase.SEED_WORKOUT_TEMPLATES };
  const src = fs.readFileSync(path.join(__dirname, '..', 'database.js'), 'utf8');
  const grab = n => eval(src.match(new RegExp('const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);'))[1]); // eslint-disable-line no-eval
  return { ex: grab('SEED_EXERCISES'), tpl: grab('SEED_WORKOUT_TEMPLATES') };
};
const { ex: EX, tpl: TPL } = seed();
const byName = new Map(EX.map(e => [e.name, e]));
const homeIds = () => E.CATALOGUE.gyms.find(g => g.slug === 'home').equipment.map(e => e.id);

const NEW_EX = {
  'Soft tissue (lacrosse ball)': ['Lacrosse Ball Hamstring Roll', 'Lacrosse Ball Quad Roll', 'Lacrosse Ball Calf Roll', 'Lacrosse Ball Forearm Roll',
    'Lacrosse Ball Upper Trap Wall Roll', 'Lacrosse Ball Lat Wall Roll', 'Lacrosse Ball Foot Roll'],
  Neck: ['Supine Chin Tuck', 'Neck Rotation Turns', 'Neck Isometric Side Press'],
  'Wrists and forearms': ['Wrist Extensor Stretch', 'Band Wrist Curl', 'Band Reverse Wrist Curl', 'Quadruped Wrist Rocks'],
  Knees: ['Spanish Squat', 'Wall Sit', 'Tempo Bodyweight Squat'],
  'Feet, shins, ankles': ['Tibialis Raise (Wall)', 'Ankle Alphabet', 'Toe Yoga', 'Short Foot Exercise', 'Banded Ankle Eversion'],
  Grip: ['Scapular Pull-up', 'Towel Hang', 'Flexed-Arm Hang'],
  Balance: ['Single-Leg Stand', 'Single-Leg Reach', 'Single-Leg RDL (Bodyweight)', 'Heel-to-Toe Walk'],
  Conditioning: ['Jump Rope — Room Intervals', 'Jump Rope — Boxer Skip'],
  Breathing: ['Box Breathing', 'Extended Exhale Breathing', 'Belly Breathing (Lying)', 'Progressive Muscle Relaxation'],
};
const NEW_EX_ALL = Object.values(NEW_EX).flat();
const NEW_ROUTINES = ['rest-day-flow', 'light-day-recovery', 'post-shift-winddown', 'pre-sleep-10', 'desk-reset', 'post-grappling', 'wrist-prep', 'hips-hamstrings-ball', 'full-body-ball'];
const NEW_TPL = ['kit:ab-roller-core', 'kit:rope-conditioning', 'kit:tower-bands-full-body', 'kit:minimal-20', 'kit:deload-light'];

// Claims this app does not make about what a movement does to the body, as words. Tested below on
// sample strings so the list itself cannot silently stop matching.
const BANNED = /\b(treat(s|ed|ing|ment)?|fix(es|ed|ing)?|prevent(s|ed|ing|ion)?|correct(s|ed|ing|ion)?|heal(s|ed|ing)?|cure[sd]?|releas(e|es|ed|ing)|fascia|fascial|adhesions?|knots?|scar tissue|toxins?|flush(es|ed)?|detox|rehab|rehabilitat\w*|therap\w*|inflammation|studies|research|proven|clinically|scientific\w*|nervous system|parasympathetic|cortisol|stress hormones?|reduces?|relieves?|relief|lengthens?|realign\w*|decompress\w*|break(s)? up|lubricat\w*|alleviat\w*|diagnos\w*)\b/i;

test('the banned-word list catches what it is meant to, and not plain description', () => {
  for (const bad of ['releases fascia', 'treats knee pain', 'prevents injury', 'fixes posture', 'breaks up knots', 'heals the tendon', 'studies show', 'calms the nervous system', 'cures tightness', 'corrects form', 'reduces stress', 'relieves pain', 'breaks up adhesions'])
    assert.match(bad, BANNED, bad);
  for (const ok of ['Sit on the floor with the ball under the thigh.', 'Many people find slow breathing calming.', 'Keep it off the kneecap.', 'You should feel the front of the shins working.'])
    assert.doesNotMatch(ok, BANNED, ok);
});

// ── exercises ────────────────────────────────────────────────────────────────

test('every new exercise is seeded exactly once, in the audited regions, with no invented media', () => {
  assert.strictEqual(NEW_EX_ALL.length, 35);
  for (const n of NEW_EX_ALL) {
    assert.strictEqual(EX.filter(e => e.name === n).length, 1, n);
    const e = byName.get(n);
    assert.ok(['recovery', 'strength', 'conditioning'].includes(e.category), n);
    assert.strictEqual(e.videoUrl, null, `${n}: never an invented video`);
    assert.ok(!('mediaUrl' in e), `${n}: mediaUrl is not a column`);
    assert.ok(e.instructions && e.instructions.length > 60, n);
    assert.ok(e.primaryMuscles.length > 0, n);
  }
  // existing seeds were not renamed or dropped: the originals are all still there
  for (const n of ['Chin Tuck', 'Neck Isometric Holds', 'Wrist CARS', 'Terminal Knee Extension (TKE)', 'Elbow Flexion/Extension', 'Dead Hang', 'Weighted Jump Rope', 'Spiky Ball Foot Roll', 'Lacrosse Ball Glute Release', 'Shadow Boxing', '90/90 Breathing'])
    assert.ok(byName.has(n), n);
});

test('starting points are stated, and a risky movement carries its own caution', () => {
  for (const n of NEW_EX_ALL) {
    const e = byName.get(n);
    assert.match(e.instructions, /starting point/i, `${n} states a starting point`);
  }
  const need = {
    'Supine Chin Tuck': /dizziness|tingling/i, 'Neck Rotation Turns': /dizziness|tingling/i, 'Neck Isometric Side Press': /dizziness|tingling/i,
    'Band Wrist Curl': /stop if/i, 'Band Reverse Wrist Curl': /stop if/i, 'Quadruped Wrist Rocks': /sore|complain/i, 'Lacrosse Ball Forearm Roll': /tingles|numb/i,
    'Spanish Squat': /stop if the knees hurt/i, 'Wall Sit': /knee hurts/i, 'Tempo Bodyweight Squat': /knees hurt/i,
    'Tibialis Raise (Wall)': /stop if/i, 'Towel Hang': /step down/i, 'Flexed-Arm Hang': /step down|sore/i, 'Scapular Pull-up': /step down/i,
    'Single-Leg RDL (Bodyweight)': /back flat/i, 'Box Breathing': /lightheaded/i, 'Progressive Muscle Relaxation': /sore|injured/i,
    'Jump Rope — Room Intervals': /ceiling/i, 'Jump Rope — Boxer Skip': /ceiling/i,
  };
  for (const [n, re] of Object.entries(need)) assert.match(byName.get(n).instructions, re, `${n} caution`);
  // the neck set is gentle: no bridges, no loading
  for (const n of NEW_EX.Neck) assert.doesNotMatch(byName.get(n).instructions, /bridge|weight|resist(ance)? band/i, n);
  // ball work keeps its placement limits
  for (const n of NEW_EX['Soft tissue (lacrosse ball)']) assert.match(byName.get(n).instructions, /off the|stay off/i, `${n} names where the ball must not go`);
  assert.match(byName.get('Lacrosse Ball Upper Trap Wall Roll').instructions, /off the neck, the spine/i);
});

test('the safety line is shown once per page, never copied onto a card', () => {
  const key = RECOVERY_NOTE.split('.').map(s => s.trim()).filter(Boolean);
  const copy = [...NEW_EX_ALL.map(n => byName.get(n).instructions),
    ...mob.ROUTINES.filter(r => NEW_ROUTINES.includes(r.id)).flatMap(r => r.items.flatMap(i => [i.cue, i.tool || '', i.alt ? i.alt.cue : '']))].join('\n');
  for (const part of key) assert.ok(!copy.includes(part), `"${part}" is copied onto a card`);
  assert.doesNotMatch(copy, /not medical advice|see a professional/i);
  const today = fs.readFileSync(path.join(__dirname, '..', 'views', 'today.ejs'), 'utf8');
  assert.strictEqual(today.split('mobility.note').length - 1, 1, 'today shows the mobility note once');
  assert.match(mob.NOTE, /starting points/);
  assert.match(mob.NOTE, /neck, loaded wrists and knees/);
});

test('no banned claim word in any new copy, and no URL or dead host anywhere in it', () => {
  const chunks = [];
  for (const n of NEW_EX_ALL) chunks.push([n, `${n} ${byName.get(n).instructions}`]);
  for (const r of mob.ROUTINES.filter(x => NEW_ROUTINES.includes(x.id))) {
    chunks.push([r.id, `${r.name} ${r.blurb}`]);
    for (const i of r.items) chunks.push([i.id, [i.name, i.rx, i.cue, i.tool || '', i.alt ? `${i.alt.name} ${i.alt.rx || ''} ${i.alt.cue}` : ''].join(' ')]);
  }
  for (const t of TPL.filter(x => NEW_TPL.includes(x.slug))) {
    chunks.push([t.slug, [t.name, t.description, t.warmup, t.cooldown, ...t.exercises.map(e => e.notes)].join(' ')]);
  }
  chunks.push(['NOTE', mob.NOTE.replace(RECOVERY_NOTE, '')]);
  for (const [id, text] of chunks) {
    assert.doesNotMatch(text, BANNED, `${id}: ${(text.match(BANNED) || [])[0]}`);
    assert.doesNotMatch(text, /https?:\/\/|website-cdn\.com|www\./i, `${id}: no URL in new copy`);
    assert.doesNotMatch(text, /\b(19|20)\d\d\b|\d+\s?%|\bper ?cent\b/i, `${id}: no dates or statistics`);
  }
  // no real names in the new copy either
  assert.doesNotMatch(chunks.map(c => c[1]).join('\n'), /\b(Nick|ndiramio)\b/i);
  const rules = JSON.stringify(E.CATALOGUE.exerciseRules);
  assert.doesNotMatch(rules, /website-cdn\.com/);
});

test('every new exercise declares the gear it needs, and none that it does not', () => {
  const need = (n, ids) => assert.deepStrictEqual(E.requirementsFor({ name: n }).requires, ids, n);
  for (const n of NEW_EX['Soft tissue (lacrosse ball)']) need(n, ['massage-ball-lacrosse']);
  for (const n of ['Band Wrist Curl', 'Band Reverse Wrist Curl', 'Banded Ankle Eversion', 'Spanish Squat']) need(n, ['resistance-bands']);
  for (const n of NEW_EX.Grip) need(n, ['bar']);
  for (const n of NEW_EX.Conditioning) need(n, ['jump-rope']);
  for (const n of [...NEW_EX.Neck, ...NEW_EX.Breathing, ...NEW_EX.Balance, 'Wall Sit', 'Tempo Bodyweight Squat', 'Tibialis Raise (Wall)', 'Ankle Alphabet', 'Toe Yoga', 'Short Foot Exercise', 'Wrist Extensor Stretch', 'Quadruped Wrist Rocks']) need(n, []);
});

test('every substitute named by a new rule is a seeded exercise that needs nothing, and a missing tool swaps or is reported', () => {
  const rules = E.CATALOGUE.exerciseRules.filter(r => NEW_EX_ALL.some(n => new RegExp(r.match, 'i').test(n)));
  assert.ok(rules.length >= 10);
  for (const r of rules) for (const s of r.substitutes || []) {
    assert.ok(byName.has(s.name), `${r.match} -> ${s.name}`);
    assert.deepStrictEqual(E.requirementsFor({ name: s.name }).requires.filter(Boolean), [], `${s.name} is a no-gear fallback`);
  }
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Lacrosse Ball Hamstring Roll' }], ['mat']).substitutions, [{ from: 'Lacrosse Ball Hamstring Roll', to: 'Supine Hamstring Stretch' }]);
  assert.deepStrictEqual(E.fitExercises([{ exerciseName: 'Spanish Squat' }], ['mat']).substitutions, [{ from: 'Spanish Squat', to: 'Tempo Bodyweight Squat' }]);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Band Wrist Curl' }], ['mat']).omitted.length, 1, 'no substitute: said, not hidden');
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Towel Hang' }], ['mat']).omitted.length, 1);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Towel Hang' }], ['power-tower']).omitted.length, 0, 'the tower is a bar');
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Jump Rope — Room Intervals' }], ['jump-rope']).omitted.length, 0);
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Lacrosse Ball Calf Roll' }], ['massage-ball-set']).substitutions.length, 0, 'the QLDT set holds a lacrosse ball');
  assert.strictEqual(E.fitExercises([{ exerciseName: 'Lacrosse Ball Calf Roll' }], ['massage-ball-peanut']).substitutions.length, 1, 'a peanut ball is not a lacrosse ball');
});

// ── poses ────────────────────────────────────────────────────────────────────

test('poses: each new exercise maps to a pose that exists, or deliberately to none (and then falls to its category figure)', () => {
  const POSES = path.join(__dirname, '..', 'public', 'poses');
  const none = [];
  for (const n of NEW_EX_ALL) {
    const k = PM.match(n);
    if (k === null) { none.push(n); continue; }
    assert.ok(fs.existsSync(path.join(POSES, k + '.json')), `${n} -> ${k}`);
  }
  assert.ok(none.length >= 20, 'most of the new set has no figure yet; step 5 authors them');
  // the three that MUST NOT fall through to a looser rule
  assert.strictEqual(PM.match('Lacrosse Ball Upper Trap Wall Roll'), null, 'not the neck stretch');
  assert.strictEqual(PM.match('Band Wrist Curl'), null, 'not the wrist circle');
  assert.strictEqual(PM.match('Spanish Squat'), null, 'not a free squat');
  assert.strictEqual(PM.keyFor('Band Wrist Curl', 'strength'), 'squat', 'null falls to the category figure, like Tuck L-sit Hold');
  assert.ok(!PM.keys().includes(null) && !PM.keys().includes('null'));
});

// ── routines ─────────────────────────────────────────────────────────────────

const newRoutines = () => mob.ROUTINES.filter(r => NEW_ROUTINES.includes(r.id));

test('the nine new routines exist with the asked-for shapes and lengths', () => {
  assert.deepStrictEqual(newRoutines().map(r => r.id).sort(), [...NEW_ROUTINES].sort());
  const get = id => mob.ROUTINES.find(r => r.id === id);
  assert.ok(get('rest-day-flow').minutes >= 15 && get('rest-day-flow').minutes <= 20);
  assert.strictEqual(get('desk-reset').minutes, 5);
  assert.strictEqual(get('pre-sleep-10').minutes, 10);
  assert.match(mob.NOTE, /starting points/, 'said once, in the shared note, not on every routine');
  for (const r of newRoutines()) assert.ok(r.items.length >= 5, r.id);
  assert.strictEqual(new Set(mob.ROUTINES.map(r => r.id)).size, mob.ROUTINES.length);
});

test("every new routine item's demo (and its alternative's) resolves to a real seeded exercise card", () => {
  for (const r of newRoutines()) for (const i of r.items) {
    assert.ok(byName.has(i.demo), `${r.id}/${i.id}: demo "${i.demo}" is not a seeded exercise`);
    if (i.alt) assert.ok(byName.has(i.alt.demo), `${r.id}/${i.id}: alt demo "${i.alt.demo}"`);
  }
  // the older routines still resolve to something that draws (a name rule), as before
  for (const r of mob.ROUTINES) for (const i of r.items) assert.ok(PM.keyFor(i.demo, 'recovery'), `${r.id}/${i.id}`);
});

test("at the owner's kit every new routine shows all its items; nothing is swapped and nothing is left out", () => {
  const have = E.expand(homeIds());
  for (const r of mob.fitRoutines(mob.ROUTINES, have).filter(x => NEW_ROUTINES.includes(x.id))) {
    assert.deepStrictEqual(r.omitted, [], `${r.id} omits something at Home`);
    assert.strictEqual(r.items.length, mob.ROUTINES.find(x => x.id === r.id).items.length, r.id);
    assert.ok(r.items.every(i => !i.swappedFrom), `${r.id} swaps something at Home`);
    for (const i of r.items) assert.ok(!i.requires && !i.alt, 'gear internals are not sent');
  }
});

test('with no kit at all, nothing is dropped silently: each item is shown, swapped for a named alternative, or listed as left out', () => {
  for (const have of [E.expand([]), E.expand(['bar', 'jump-rope']), E.expand(['massage-ball-peanut']), null]) {
    for (const r of mob.fitRoutines(mob.ROUTINES, have).filter(x => NEW_ROUTINES.includes(x.id))) {
      const src = mob.ROUTINES.find(x => x.id === r.id);
      assert.strictEqual(r.items.length + r.omitted.length, src.items.length, `${r.id}: ${r.items.length}+${r.omitted.length}`);
      const names = r.items.map(i => i.name.toLowerCase());
      assert.strictEqual(new Set(names).size, names.length, `${r.id}: no duplicate names after swapping`);
      for (const i of r.items.filter(x => x.swappedFrom)) assert.ok(i.swapNote && byName.has(i.demo), `${r.id}/${i.id}`);
    }
  }
  const bare = mob.fitRoutines(mob.ROUTINES, E.expand([])).find(r => r.id === 'full-body-ball');
  assert.ok(bare.items.length >= 8, 'every ball item has a no-gear alternative');
  assert.ok(bare.items.every(i => i.swappedFrom));
  const wrist = mob.fitRoutines(mob.ROUTINES, E.expand([])).find(r => r.id === 'wrist-prep');
  assert.ok(wrist.omitted.some(o => /Band wrist curls, light left out/.test(o.note)));
});

test('new routine items state gear the same way as the old ones: real ids, a short tool cue, no safety text in it', () => {
  const ids = new Set(E.IDS);
  let gear = 0;
  for (const r of newRoutines()) for (const i of r.items) {
    for (const j of i.joints) assert.ok(require('../lib/muscles').isJoint(j), i.id);
    if (!i.requires) { assert.ok(!i.tool && !i.alt, `${i.id}: tool without requires`); continue; }
    gear++;
    for (const q of i.requires) for (const a of q.split('|')) assert.ok(ids.has(a), `${i.id}: ${a}`);
    assert.ok(i.tool && i.tool.length <= 60, i.id);
    assert.doesNotMatch(i.tool, /pain|stop/i, i.id);
    if (i.alt) assert.ok(i.alt.name && i.alt.cue && i.alt.demo, i.id);
  }
  assert.ok(gear >= 20, `gear items: ${gear}`);
});

test('the routines keep a usable length on a phone: collapsed, with one open', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'views', 'today.ejs'), 'utf8');
  assert.match(t, /class="mob-more"/);
  assert.match(t, /r\.id === mobility\.dailyId \? 'open'/, 'only the daily routine opens by default');
  assert.strictEqual((t.match(/<details/g) || []).length, (t.match(/<\/details>/g) || []).length);
  assert.ok(mob.ROUTINES.length >= 15);
});

// ── workout plans ────────────────────────────────────────────────────────────

test('new plans are non-day kit slugs: seeded, in the library, fit Home whole, and never a weekday plan', () => {
  const T = require('../api/today');
  const lib = new Set(EX.map(e => e.name));
  const legacy = new Map(EX.map(e => [e.name.toLowerCase(), e.equipment]));
  for (const slug of NEW_TPL) {
    const t = TPL.find(x => x.slug === slug);
    assert.ok(t, slug);
    assert.strictEqual(t.location, 'home');
    assert.ok(!/^(sun|mon|tue|wed|thu|fri|sat):/.test(slug));
    assert.ok(t.name.length > 5 && t.name !== slug);
    assert.ok(t.exercises.length >= 5, slug);
    for (const e of t.exercises) assert.ok(lib.has(e.exerciseName), `${slug}: ${e.exerciseName}`);
    const fit = E.fitExercises(t.exercises, homeIds(), legacy);
    assert.deepStrictEqual([fit.omitted, fit.substitutions], [[], []], slug);
    assert.strictEqual(E.kitBuyLink(slug), null, 'no new affiliate item');
  }
  assert.deepStrictEqual(Object.keys(E.KIT_PLAN_ITEM).filter(k => NEW_TPL.includes(k)), [], 'no new KIT_PLAN_ITEM entry: no buy link fits');
  assert.strictEqual(new Set(TPL.map(t => t.slug)).size, TPL.length);
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) assert.strictEqual(T.resolveSlug([...NEW_TPL], '', day), null, `${day}: a kit plan is never the day's plan`);
  assert.strictEqual(T.resolveSlug([...NEW_TPL, 'mon:home'], 'kit:minimal-20', 'mon'), 'mon:home', 'Today ignores a kit slug even when asked for; the workout page loads it');
  assert.strictEqual(T.resolveSlug([...NEW_TPL, 'mon:home'], '', 'mon'), 'mon:home');
});

test('the conditioning plan checks the ceiling, and the core plan starts rollouts from the knees', () => {
  const rope = TPL.find(t => t.slug === 'kit:rope-conditioning');
  assert.match(rope.description, /ceiling/i);
  assert.ok(rope.exercises.some(e => e.exerciseName === 'Shadow Boxing'), 'the library has shadowboxing, so the plan uses it');
  assert.match(TPL.find(t => t.slug === 'kit:ab-roller-core').description, /knees/i);
});

// ── deload ───────────────────────────────────────────────────────────────────

test('deload is a derived copy: about half the sets, labelled, no benchmark testing, and the plan it came from is untouched', () => {
  const W = require('../api/week-plan'), B = require('../api/benchmarks');
  const plan = W.buildPlan({
    tree: { skills: [], byId: new Map() }, st: new Map(), have: new Set(), focus: 'balanced',
    benchmarks: [{ id: 1, item: 'push_up', day: 6, position: 0 }], lastByItem: {}, date: '2026-10-28', benchmarkDay: B.DEFAULT_BENCHMARK_DAY,
  });
  const plan2 = JSON.parse(JSON.stringify(plan));
  plan2.days[0].blocks = [{ name: 'Push-up', sets: 4, instruction: '4 sets', target: 'x' }, { name: 'Dip', sets: 1, instruction: '1 set' }];
  plan2.days[0].kind = 'train';
  const before = JSON.stringify(plan2);
  const d = W.deloadWeek(plan2);
  assert.strictEqual(JSON.stringify(plan2), before, 'input not mutated');
  assert.strictEqual(d.deload, true);
  assert.match(d.deloadLabel, /Deload week/);
  assert.match(d.deloadLabel, /normal plan is unchanged/i);
  assert.deepStrictEqual(d.days[0].blocks.map(b => b.sets), [2, 1], 'half, never below one');
  assert.match(d.days[0].blocks[0].instruction, /easy/);
  assert.match(d.days[0].blocks[0].instruction, /usual: 4/);
  assert.ok(d.days.every(x => x.benchmarks.length === 0 && x.kind !== 'benchmarks'));
  assert.deepStrictEqual(d.benchmarksDue, []);
  assert.strictEqual(plan2.deload, undefined);
  // the standalone template says the same thing in plain words
  const t = TPL.find(x => x.slug === 'kit:deload-light');
  assert.match(t.description, /does not replace it/);
  assert.ok(t.exercises.every(e => Number(e.sets) <= 2));
});
