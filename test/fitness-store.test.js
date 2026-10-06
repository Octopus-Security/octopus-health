'use strict';

/**
 * The database half: per-user isolation, seeding, attempts and unlocks, results
 * and trends, benchmarks, and the reminder as stored state. Uses the real
 * database.js against throwaway accounts (data/zz_fx_<pid>_*_health.sqlite,
 * removed afterwards). Skips when sequelize/sqlite3 are not installed, like the
 * other DB-backed tests in the estate.
 *
 * Run: node --test test/fitness-store.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let getDatabase;
try { require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped below */ }
const skip = !getDatabase && 'sequelize/sqlite3 not installed on this machine';

const S = require('../api/fitness-store');
const B = require('../api/benchmarks');

const stamp = `zz_fx_${process.pid}`;
const names = [];
async function fresh(tag) {
  const name = `${stamp}_${tag}`;
  names.push(name);
  const db = getDatabase(name);
  await db.sequelize.sync();
  return db;
}
after(() => {
  for (const n of names) for (const ext of ['']) { try { fs.unlinkSync(path.join(__dirname, '..', 'data', `${n}_health.sqlite${ext}`)); } catch { /* not created */ } }
});

const ET = iso => new Date(iso + '-04:00');
const names_ = rows => rows.map(r => r.item);

test('seeding creates the defaults once; running it again changes nothing', { skip }, async () => {
  const db = await fresh('seed');
  await S.seedBenchmarks(db);
  const first = names_(await db.Benchmark.findAll({ order: [['position', 'ASC']] }));
  assert.deepStrictEqual(first, B.DEFAULT_BENCHMARKS.map(d => d.item));
  await S.seedBenchmarks(db); await S.seedBenchmarks(db);
  assert.strictEqual(await db.Benchmark.count(), B.DEFAULT_BENCHMARKS.length);
  assert.strictEqual(await db.BenchmarkSeed.count(), B.DEFAULT_BENCHMARKS.length);
});

test('a user\'s edits survive re-seeding (a "redeploy"); a deleted default stays deleted', { skip }, async () => {
  const db = await fresh('edits');
  await S.seedBenchmarks(db);
  await S.updateBenchmark(db, 'plank', { name: 'My plank', everyWeeks: 2, dayOfWeek: 'wednesday', focus: 'core' });
  await S.removeBenchmark(db, 'hollow');
  await S.moveBenchmark(db, 'treadmill', { to: 1 });
  await S.seedBenchmarks(db);                         // what a new boot does
  const rows = await db.Benchmark.findAll({ order: [['position', 'ASC']] });
  const plank = rows.find(r => r.item === 'plank_hold');
  assert.deepStrictEqual([plank.name, plank.everyWeeks, plank.dayOfWeek], ['My plank', 2, 3]);
  assert.ok(!rows.some(r => r.item === 'hollow_hold'), 'deleted default did not come back');
  assert.strictEqual(rows[0].item, 'treadmill_stage', 'reorder kept');
  assert.deepStrictEqual(rows.map(r => r.position), rows.map((_, i) => i), 'positions stay 0..n-1');
});

test('a default added in a later release reaches existing users once', { skip }, async () => {
  const db = await fresh('newdefault');
  await S.seedBenchmarks(db);
  B.DEFAULT_BENCHMARKS.push({ seedKey: 'max_pullups', item: 'max_pullups', focus: 'pull', everyWeeks: 1 });
  try {
    await S.seedBenchmarks(db); await S.seedBenchmarks(db);
    assert.strictEqual(await db.Benchmark.count({ where: { item: 'max_pullups' } }), 1);
  } finally { B.DEFAULT_BENCHMARKS.pop(); }
});

test('add: catalogue item, custom item, re-adding re-enables; bad input is a 400', { skip }, async () => {
  const db = await fresh('add');
  await S.addBenchmark(db, { item: 'max_pullups', everyWeeks: 2 });
  await S.addBenchmark(db, { name: 'Max burpees', unit: 'reps' });
  const again = await S.addBenchmark(db, { item: 'max_pullups' });
  assert.strictEqual(again.existed, true);
  assert.strictEqual(await db.Benchmark.count({ where: { item: 'max_pullups' } }), 1);
  assert.ok(await db.Benchmark.findOne({ where: { item: 'custom_max-burpees' } }));
  await assert.rejects(S.addBenchmark(db, { name: 'x', everyWeeks: 99 }), { status: 400 });
  await assert.rejects(S.addBenchmark(db, { name: 'x', focus: 'vibes' }), { status: 400 });
  await assert.rejects(S.addBenchmark(db, {}), { status: 400 });
});

test('benchmark lookup: names resolve, ambiguity is a 409, an unknown id is a plain 404', { skip }, async () => {
  const db = await fresh('find');
  await S.seedBenchmarks(db);
  assert.strictEqual((await S.findBenchmarkRow(db, 'pushups')).item, 'max_pushups_handles');
  assert.strictEqual((await S.findBenchmarkRow(db, 'pike')).item, 'max_pike_pushups');
  await assert.rejects(S.findBenchmarkRow(db, 'push'), { status: 409 });
  await assert.rejects(S.findBenchmarkRow(db, 'nonsense'), { status: 404 });
  // "6" is an id, never a fragment of "60 s"
  await assert.rejects(S.findBenchmarkRow(db, '9999'), { status: 404 });
  await assert.rejects(S.updateBenchmark(db, '6000', { name: 'hijack' }), { status: 404 });
});

test('attempts: success achieves, reports what it unlocked; "not yet" changes nothing; delete re-locks', { skip }, async () => {
  const db = await fresh('attempts');
  const miss = await S.logAttempt(db, { skill: 'wrist prep', result: 'not yet', seconds: 40 });
  assert.strictEqual(miss.newlyAchieved, false);
  assert.deepStrictEqual(miss.newlyUnlocked, []);
  const ok = await S.logAttempt(db, { skill: 'wrist prep', result: 'success', seconds: 120 });
  assert.strictEqual(ok.newlyAchieved, true);
  assert.ok(ok.newlyUnlocked.some(s => s.id === 'wall-plank'), 'wall plank unlocked');
  // a repeat success is not "newly" anything
  assert.strictEqual((await S.logAttempt(db, { skill: 'wrist-prep', result: 'succeeded' })).newlyAchieved, false);
  // below the standard is accepted on the user's word, and says so
  const low = await S.logAttempt(db, { skill: 'plank', result: 'succeeded', seconds: 10 });
  assert.match(low.criterionNote, /standard is 3 × 30 s/);
  await assert.rejects(S.logAttempt(db, { skill: 'plank', result: 'maybe' }), { status: 400 });
  await assert.rejects(S.logAttempt(db, { skill: 'plank', result: 'succeeded', reps: -4 }), { status: 400 });
  await assert.rejects(S.logAttempt(db, { skill: 'plank', result: 'succeeded', date: '2026-13-45' }), { status: 400 });
  await assert.rejects(S.logAttempt(db, { skill: 'no such skill', result: 'succeeded' }), { status: 404 });
  // deleting both successes re-locks the dependent
  for (const a of (await S.listAttempts(db, { skill: 'wrist-prep' })).filter(a => a.result === 'succeeded')) await S.deleteAttempt(db, a.id);
  const { st } = await S.skillState(db);
  assert.strictEqual(st.get('wall-plank').status, 'locked');
});

test('a locked skill can still be reported; the reply lists the prerequisites skipped', { skip }, async () => {
  const db = await fresh('skip');
  const r = await S.logAttempt(db, { skill: 'pistol squat', result: 'succeeded', reps: 5 });
  assert.ok(r.skippedPrerequisites.includes('Bodyweight squat'));
});

test('equipment is per user: set, add, remove, reset; random picks follow it', { skip }, async () => {
  const a = await fresh('eqa'), b = await fresh('eqb');
  assert.strictEqual((await S.getEquipment(a)).isDefault, true);
  const e = await S.changeEquipment(a, 'add', 'push-up handles');
  assert.ok(e.effective.includes('handles') && e.effective.includes('wall'));
  assert.ok(!(await S.getEquipment(b)).effective.includes('handles'), 'another account is unaffected');
  assert.ok(!(await S.changeEquipment(a, 'remove', ['wall'])).effective.includes('wall'));
  await assert.rejects(S.changeEquipment(a, 'set', ['jetpack']), { status: 400 });
  assert.strictEqual((await S.changeEquipment(a, 'reset')).isDefault, true);
  const T = require('../api/skill-tree');
  await S.changeEquipment(a, 'set', ['handles']);
  const s = await S.skillState(a);
  for (let i = 0; i < 30; i++) assert.deepStrictEqual(T.randomNew(s.tree, s.st, s.have).skill.missingEquipment, []);
});

test('results and trends: logged per item, compared with the user\'s own history, times parse', { skip }, async () => {
  const db = await fresh('results');
  await S.logResult(db, { item: 'pushups', value: 10, date: '2026-09-06' });          // found by short name
  await S.logResult(db, { item: 'max_pushups_handles', value: 14, date: '2026-10-04' });
  const r = await S.logResult(db, { item: 'max_pushups_handles', value: 16, date: '2026-10-05' });
  assert.strictEqual(r.trend.latest.value, 16);
  assert.strictEqual(r.trend.vsPrevious.delta, 2);
  assert.strictEqual(r.trend.vs4Weeks.delta, 6);
  assert.strictEqual(r.trend.best.value, 16);
  const mile = await S.logResult(db, { item: 'run_1_5mi_s', value: '12:30', date: '2026-10-01' });
  assert.strictEqual(mile.result.value, 750);
  await assert.rejects(S.logResult(db, { item: 'nonsense', value: 3 }), { status: 404 });
  await assert.rejects(S.logResult(db, { item: 'plank', value: 'abc' }), { status: 400 });
  const trends = await S.allTrends(db);
  assert.deepStrictEqual(trends.map(t => t.item).sort(), ['max_pushups_handles', 'run_1_5mi_s']);
});

test('logging a benchmark writes an ordinary result for its item (one history)', { skip }, async () => {
  const db = await fresh('benchlog');
  const r = await S.logBenchmark(db, { benchmark: 'pushups', value: 22, date: '2026-10-03' });
  assert.strictEqual(r.item, 'max_pushups_handles');
  assert.strictEqual((await S.resultsFor(db, 'max_pushups_handles')).length, 1);
  const list = await S.listBenchmarks(db, ET('2026-10-03T10:00:00'));
  const row = list.benchmarks.find(b => b.item === 'max_pushups_handles');
  assert.strictEqual(row.trend.latest.value, 22);
  assert.strictEqual(row.lastDate, '2026-10-03');
});

test('focus: a view ordering that never rewrites the stored positions', { skip }, async () => {
  const db = await fresh('focus');
  await S.seedBenchmarks(db);
  await S.setFocus(db, 'endurance');
  const view = await S.listBenchmarks(db);
  assert.strictEqual(view.benchmarks[0].item, 'treadmill_stage');
  assert.strictEqual((await db.Benchmark.findOne({ where: { item: 'treadmill_stage' } })).position, B.DEFAULT_BENCHMARKS.length - 1);
  await assert.rejects(S.setFocus(db, 'vibes'), { status: 400 });
});

test('the week plan from the database carries the user\'s benchmarks on their chosen day', { skip }, async () => {
  const db = await fresh('plan');
  await S.seedBenchmarks(db);
  await S.setBenchmarkDay(db, 'friday');
  await S.updateBenchmark(db, 'plank', { dayOfWeek: 'wed' });
  await S.removeBenchmark(db, 'squats');
  const plan = await S.weekPlan(db, ET('2026-10-03T10:00:00'), { equipment: ['handles'] });
  const on = d => plan.days.find(x => x.name === d).benchmarks.map(b => b.item);
  assert.ok(on('Friday').includes('max_pushups_handles'));
  assert.deepStrictEqual(on('Wednesday'), ['plank_hold']);
  assert.ok(!plan.benchmarksDue.some(b => b.item === 'squats_60s'), 'removed benchmark is not planned');
  assert.ok(plan.days.flatMap(d => d.blocks).length > 0);
});

test('reminder as stored state: first use creates it ON, check decides, ack records, one nudge', { skip }, async () => {
  const db = await fresh('reminder');
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-03T09:05:00'))).action, 'none', 'untouched account is never reminded');
  await S.seedBenchmarks(db);
  assert.strictEqual((await S.getReminder(db)).enabled, true);
  const send = await S.reminderCheck(db, ET('2026-10-03T09:05:00'));        // Saturday 09:05 New York
  assert.strictEqual(send.action, 'send');
  await S.reminderAck(db, { kind: 'send', date: send.date, items: send.items });
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-03T09:35:00'))).action, 'none');
  const nudge = await S.reminderCheck(db, ET('2026-10-04T09:05:00'));
  assert.strictEqual(nudge.action, 'nudge');
  await S.reminderAck(db, { kind: 'nudge', date: nudge.date });
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-04T09:35:00'))).action, 'none');
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-05T09:35:00'))).action, 'none');
  // opt out and move it
  await S.updateReminder(db, { enabled: false });
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-10T09:05:00'))).action, 'none');
  await S.updateReminder(db, { enabled: true, day: 'sunday', time: '6pm', tz: 'Europe/London' });
  const r = await S.getReminder(db);
  assert.deepStrictEqual([r.day, r.time, r.tz], [0, '18:00', 'Europe/London']);
  assert.strictEqual((await S.updateReminder(db, { day: 'follow' })).reminder.day, 6, 'day: follow goes back to the benchmark day (Saturday by default)');
  await assert.rejects(S.updateReminder(db, { tz: 'Mars/Olympus' }), { status: 400 });
  await assert.rejects(S.updateReminder(db, { time: 'teatime' }), { status: 400 });
  await assert.rejects(S.reminderAck(db, { kind: 'shout' }), { status: 400 });
});

test('logging everything before the nudge cancels it', { skip }, async () => {
  const db = await fresh('nudgeskip');
  await S.seedBenchmarks(db);
  const send = await S.reminderCheck(db, ET('2026-10-03T09:05:00'));
  await S.reminderAck(db, { kind: 'send', date: send.date, items: send.items });
  for (const item of send.items) await S.logResult(db, { item, value: 5, date: '2026-10-04' });
  assert.strictEqual((await S.reminderCheck(db, ET('2026-10-04T09:05:00'))).action, 'none');
});

test('ownership: another account\'s row ids do not exist here (404, never 403)', { skip }, async () => {
  const a = await fresh('own_a'), b = await fresh('own_b');
  await S.seedBenchmarks(a);
  const att = await S.logAttempt(a, { skill: 'plank', result: 'succeeded' });
  const res = await S.logResult(a, { item: 'plank', value: 40 });
  // Make the ids collide on purpose: b has rows too, so "id 1" exists in both files.
  await S.logAttempt(b, { skill: 'squat', result: 'not_yet' });
  await S.logResult(b, { item: 'plank', value: 5 });
  const bBench = await b.Benchmark.count();
  assert.strictEqual(bBench, 0, 'b never seeded; a\'s benchmarks are not visible to b');
  await assert.rejects(S.deleteAttempt(b, att.attempt.id + 1000), { status: 404 });
  await assert.rejects(S.deleteResult(b, res.result.id + 1000), { status: 404 });
  const aBench = (await a.Benchmark.findAll())[0];
  await assert.rejects(S.removeBenchmark(b, String(aBench.id)), { status: 404 });
  await assert.rejects(S.updateBenchmark(b, String(aBench.id), { name: 'x' }), { status: 404 });
  // a's data is untouched
  assert.ok(await a.Benchmark.findByPk(aBench.id));
  assert.strictEqual((await S.listAttempts(a)).length, 1);
  assert.strictEqual((await S.listAttempts(b)).length, 1);
  assert.strictEqual((await S.listAttempts(b))[0].skillId, 'squat');
});
