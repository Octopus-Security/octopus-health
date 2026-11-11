'use strict';

/**
 * Goal add-ons (api/addons.js, content/addons/*.json, api/web-addons.js, GET /api/service/addons/today).
 *
 * Pure parts (catalogue, phases, placement, deload, merge) need nothing installed. The database,
 * web and service tests use the real database.js against throwaway accounts and skip when
 * sequelize/sqlite3/express/ejs are missing, like the other DB-backed tests in this repo.
 *
 * Run: node --test test/addons.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { BANNED, stripDisclaimers } = require('./helpers/banned');

let getDatabase, express, ejs;
try { require('sequelize'); require('sqlite3'); getDatabase = require('../database'); express = require('express'); ejs = require('ejs'); } catch { /* skipped below */ }
const skip = !getDatabase && 'sequelize/sqlite3/express/ejs not installed on this machine';

const A = require('../api/addons');
const B = require('../api/benchmarks');
const E = require('../api/equipment');
const { addDays, todayET } = require('../lib/et');

// ── catalogue ────────────────────────────────────────────────────────────────

const ALL_IDS = ['desk-posture', 'head-height-kick', 'pull-up', 'splits', 'visible-abs'];

function refs() {
  const seed = require('../database');
  return {
    exercises: new Set(seed.SEED_EXERCISES.map(e => e.name)),
    routines: new Set(require('../api/mobility').ROUTINES.map(r => r.id)),
    equipment: new Set(E.ITEMS.map(i => i.id)),
  };
}

test('the catalogue loads with no errors and holds the five add-ons', () => {
  const { addons, errors } = A.loadCatalogue();
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(addons.map(a => a.id).sort(), ALL_IDS);
});

test('every referenced exercise is a SEED_EXERCISES name, every routine a ROUTINES id, every equipment id real', { skip }, () => {
  const r = refs();
  for (const a of A.CATALOGUE) assert.deepStrictEqual(A.validateAddon(a, r), [], a.id);
});

test('the validator catches a bad exercise, routine, equipment id, phase gap and missing quota', { skip }, () => {
  const r = refs();
  const base = JSON.parse(JSON.stringify(A.getAddon('visible-abs')));
  const bad = (mut) => { const a = JSON.parse(JSON.stringify(base)); mut(a); return A.validateAddon(a, r); };
  assert.ok(bad(a => { a.weeks[0].tracks[0].sessions[0][0].exercise = 'Not A Real Exercise'; }).some(e => /not a SEED_EXERCISES/.test(e)));
  assert.ok(bad(a => { a.weeks[0].tracks[0].sessions[0][0] = { routine: 'nope' }; }).some(e => /unknown routine/.test(e)));
  assert.ok(bad(a => { a.requires = ['not-gear']; }).some(e => /unknown equipment/.test(e)));
  assert.ok(bad(a => { a.weeks[1].from = 4; }).some(e => /contiguous/.test(e)));
  assert.ok(bad(a => { a.weeks[a.weeks.length - 1].to = 12; }).some(e => /ongoing/.test(e)));
  assert.ok(bad(a => { delete a.weeks[0].tracks[0].sessionsPerWeek; }).some(e => /sessionsPerWeek/.test(e)));
  assert.ok(bad(a => { a.weeks[0].tracks[0].placement = 'sometimes'; }).some(e => /placement/.test(e)));
  assert.ok(bad(a => { a.weeks[0].tracks[0].sessions[0][0].reps = 5; a.weeks[0].tracks[0].sessions[0][0].duration = 5; }).some(e => /exactly one of reps or duration/.test(e)));
  assert.ok(bad(a => { a.deload = 'maybe'; }).some(e => /deload/.test(e)));
});

test('no banned claim words anywhere in any add-on (same list as the exercise copy)', () => {
  const strings = [];
  const walk = (v, k) => {
    if (typeof v === 'string') { if (!String(k).startsWith('_')) strings.push(v); }
    else if (Array.isArray(v)) v.forEach(x => walk(x, k));
    else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) { if (kk !== 'id' && kk !== 'exercise' && kk !== 'routine' && kk !== 'name') walk(x, kk); }
  };
  for (const a of A.CATALOGUE) walk(a);
  assert.ok(strings.length > 20);
  for (const s of strings) {
    assert.doesNotMatch(stripDisclaimers(s), BANNED, s);
    assert.doesNotMatch(s, /belly fat|spot[- ]?reduc|lose weight fast|guarantee/i, s);
  }
});

test('visible-abs says plainly that abs depend on body fat and links nutrition; desk-posture makes no pain claim', () => {
  const abs = A.getAddon('visible-abs');
  assert.strictEqual(abs.nutritionLink, true);
  assert.match(abs.honesty, /body fat/);
  assert.match(abs.honesty, /does not remove fat/);
  assert.match(A.getAddon('desk-posture').honesty, /professional/);
  assert.match(A.getAddon('head-height-kick').honesty, /gradual/);
  assert.match(A.getAddon('head-height-kick').honesty, /flexibility and hip strength/);
  assert.deepStrictEqual(A.getAddon('pull-up').requires, ['bar']);
});

test('shape facts from the brief: kick 4 mobility + 2 strength, abs 3 on training days, desk daily, pull-up 3', () => {
  const t = (id, w = 0) => A.getAddon(id).weeks[w].tracks;
  assert.deepStrictEqual(t('head-height-kick').map(x => [x.id, x.sessionsPerWeek, x.placement]), [['strength', 2, 'training'], ['mobility', 4, 'any']]);
  assert.deepStrictEqual(t('visible-abs').map(x => [x.sessionsPerWeek, x.placement]), [[3, 'training']]);
  assert.deepStrictEqual(t('desk-posture').map(x => [x.sessionsPerWeek, x.placement]), [[7, 'daily']]);
  assert.deepStrictEqual(t('pull-up').map(x => [x.sessionsPerWeek, x.placement]), [[3, 'training']]);
  const kick = A.getAddon('head-height-kick');
  const routines = kick.weeks[2].tracks[1].sessions.map(s => s.map(i => i.routine));
  assert.deepStrictEqual(routines, [['kick-range', 'hips-20'], ['kick-range', 'hips-hamstrings-ball']], 'alternates');
});

// ── phases ───────────────────────────────────────────────────────────────────

test('week index counts whole weeks since the start date (ET) and picks the phase', () => {
  assert.strictEqual(A.weekIndex('2026-11-02', '2026-11-02'), 1);
  assert.strictEqual(A.weekIndex('2026-11-02', '2026-11-08'), 1);
  assert.strictEqual(A.weekIndex('2026-11-02', '2026-11-09'), 2);
  assert.strictEqual(A.weekIndex('2026-11-02', '2026-11-30'), 5);
  assert.strictEqual(A.weekIndex('2026-11-02', '2026-10-01'), 1, 'never below 1');
  const kick = A.getAddon('head-height-kick');
  assert.strictEqual(A.phaseFor(kick, 1).from, 1);
  assert.strictEqual(A.phaseFor(kick, 2).from, 1);
  assert.strictEqual(A.phaseFor(kick, 3).from, 3);
  assert.strictEqual(A.phaseFor(kick, 4).from, 3);
  assert.strictEqual(A.phaseFor(kick, 5).from, 5);
  assert.strictEqual(A.phaseFor(kick, 8).from, 5);
  assert.strictEqual(A.phaseFor(kick, 9).from, 9);
  assert.strictEqual(A.phaseFor(kick, 52).to, null, 'ongoing');
  assert.strictEqual(A.phaseLabel(A.phaseFor(kick, 3)), 'Weeks 3-4');
  assert.strictEqual(A.phaseLabel(A.phaseFor(kick, 20)), 'Week 9+');
});

test('the ET week index flips on the ET date, not the UTC one', () => {
  // 2026-11-09 23:30 ET is already 2026-11-10 in UTC; todayET must keep it on the 9th.
  const lateEvening = new Date('2026-11-10T04:30:00Z');
  assert.strictEqual(todayET(lateEvening), '2026-11-09');
  assert.strictEqual(A.weekIndex('2026-11-02', todayET(lateEvening)), 2);
  assert.strictEqual(A.weekIndex('2026-11-03', todayET(lateEvening)), 1);
});

// ── placement, spreading, deload, merge ──────────────────────────────────────

const MON = '2026-11-09';   // a Monday
const weekDays = (ws = MON) => A.weekSkeleton(ws);
const place = (id, start, opts, ws = MON) => A.placeWeek([{ addonId: id, startDate: start }], weekDays(ws), opts);
const datesOf = (res, id) => Object.entries(res.byDate).filter(([, es]) => es.some(e => e.addonId === id)).map(([d]) => d);

test('the week skeleton marks Mon/Wed/Fri as training and carries the plan routines', () => {
  const d = weekDays();
  assert.deepStrictEqual(d.map(x => x.kind), ['train', 'rest', 'train', 'rest', 'train', 'rest', 'rest']);
  assert.deepStrictEqual(d.map(x => x.routines), [['injury-prevention'], [], [], [], ['injury-prevention'], [], []]);
  assert.strictEqual(d[0].date, MON);
  assert.strictEqual(d[6].date, '2026-11-15');
});

test('training placement uses only training days; abs get three, one per day', () => {
  const r = place('visible-abs', '2026-11-01');
  assert.deepStrictEqual(datesOf(r, 'visible-abs'), ['2026-11-09', '2026-11-11', '2026-11-13']);
  for (const es of Object.values(r.byDate)) assert.ok(es.length <= 1);
  assert.strictEqual(r.summary[0].planned, 3);
});

test('daily placement fills all seven days', () => {
  assert.strictEqual(datesOf(place('desk-posture', '2026-11-01'), 'desk-posture').length, 7);
});

test('"any" placement spreads evenly: 4 across 7 days is never back-to-back clumped', () => {
  const picks = A.spread([0, 1, 2, 3, 4, 5, 6], 4);
  assert.strictEqual(new Set(picks).size, 4);
  const gaps = picks.slice(1).map((p, i) => p - picks[i]);
  assert.ok(Math.max(...gaps) <= 2, `gaps ${gaps}`);
  assert.deepStrictEqual(A.spread([1, 2, 3], 3), [1, 2, 3]);
  assert.deepStrictEqual(A.spread([1, 2], 5), [1, 2], 'asked for more than there are');
  assert.strictEqual(A.spread([0, 1, 2, 3, 4, 5, 6], 3).length, 3);
});

test('two tracks of one add-on never share a day: 2 strength + 4 mobility use six distinct days', () => {
  const r = place('head-height-kick', '2026-11-01');
  const days = datesOf(r, 'head-height-kick');
  assert.strictEqual(days.length, 6);
  for (const es of Object.values(r.byDate)) assert.ok(es.filter(e => e.addonId === 'head-height-kick').length <= 1);
  const strength = Object.values(r.byDate).flat().filter(e => e.track === 'strength');
  assert.strictEqual(strength.length, 2);
  for (const e of strength) assert.strictEqual(weekDays().find(d => d.date === e.date).kind, 'train');
});

test('the phase follows the week: weeks 1, 3 and 9 of the kick add-on differ', () => {
  const at = (start) => place('head-height-kick', start, {}).summary[0];
  assert.strictEqual(at('2026-11-09').phase.label, 'Weeks 1-2');
  assert.strictEqual(at('2026-10-26').phase.label, 'Weeks 3-4');   // 2 weeks before MON
  assert.strictEqual(at('2026-10-12').phase.label, 'Weeks 5-8');
  assert.strictEqual(at('2026-09-01').phase.label, 'Week 9+');
});

test('nothing is placed before the start date; a mid-week start gets the remaining days only', () => {
  const r = place('desk-posture', '2026-11-12');   // Thursday
  assert.deepStrictEqual(datesOf(r, 'desk-posture'), ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  const none = place('desk-posture', '2026-11-30');
  assert.strictEqual(datesOf(none, 'desk-posture').length, 0);
});

test('deload halves exercise sets (min 1) for follow add-ons and leaves keep add-ons alone', () => {
  const normal = place('visible-abs', '2026-11-01');
  const light = place('visible-abs', '2026-11-01', { deload: true });
  const n = normal.byDate[MON][0].items.find(i => i.name === 'Dead Bug');
  const l = light.byDate[MON][0].items.find(i => i.name === 'Dead Bug');
  assert.strictEqual(n.sets, 3);
  assert.strictEqual(l.sets, 2);
  assert.strictEqual(l.detail, '2x8');
  assert.strictEqual(light.byDate[MON][0].deloaded, true);
  const side = light.byDate[MON][0].items.find(i => i.name === 'Side Plank');
  assert.strictEqual(side.sets, 1, 'two sets halve to one');
  assert.strictEqual(A.getAddon('desk-posture').deload, 'keep');
  const keep = place('desk-posture', '2026-11-01', { deload: true }).byDate[MON][0];
  assert.strictEqual(keep.deloaded, false);
  // applyDeload is idempotent and does not edit its input
  const once = A.applyDeload(normal.byDate[MON][0]);
  assert.strictEqual(A.applyDeload(once).items.find(i => i.name === 'Dead Bug').sets, 2);
  assert.strictEqual(normal.byDate[MON][0].items.find(i => i.name === 'Dead Bug').sets, 3);
});

test('merge: a routine the plan already has that day is not repeated; two add-ons do not both carry it', () => {
  const days = weekDays();
  // Fake a catalogue entry that wants injury-prevention on training days.
  const fake = { id: 'zz-merge', title: 'Merge test', goalKind: 'other', summary: 's', honesty: 'h', deload: 'follow',
    weeks: [{ from: 1, to: null, focus: 'f', tracks: [{ id: 't', sessionsPerWeek: 3, placement: 'training', sessions: [[{ routine: 'injury-prevention' }, { routine: 'desk-reset' }]] }] }] };
  assert.deepStrictEqual(A.validateAddon(fake), []);
  A.CATALOGUE.push(fake);
  try {
    const res = A.placeWeek([{ addonId: 'zz-merge', startDate: '2026-11-01' }, { addonId: 'desk-posture', startDate: '2026-11-01' }], days, {});
    const mon = res.byDate[MON];
    const mine = mon.find(e => e.addonId === 'zz-merge');
    assert.deepStrictEqual(mine.merged, ['injury-prevention'], 'Monday already has it in the plan');
    assert.ok(!mine.items.some(i => i.id === 'injury-prevention'));
    const wedMine = res.byDate['2026-11-11'].find(e => e.addonId === 'zz-merge');
    assert.deepStrictEqual(wedMine.merged, [], 'Wednesday (day B) has no plan routine');
    assert.ok(wedMine.items.some(i => i.id === 'injury-prevention'));
    // desk-posture is placed after zz-merge and also wants desk-reset: one copy per day
    const monDesk = mon.find(e => e.addonId === 'desk-posture');
    assert.deepStrictEqual(monDesk.merged, ['desk-reset']);
    for (const es of Object.values(res.byDate)) {
      const ids = es.flatMap(e => e.items.filter(i => i.kind === 'routine').map(i => i.id));
      assert.strictEqual(new Set(ids).size, ids.length, 'no duplicate routine on a day');
    }
  } finally { A.CATALOGUE.pop(); }
});

test('equipment: pull-up with no bar swaps bar work for rows; with a bar nothing changes; unknown gear is left alone', () => {
  const noBar = new Set(['resistance-bands']);
  const withBar = E.expand(['bar', 'resistance-bands']);
  const r1 = place('pull-up', '2026-11-01', { have: noBar }).byDate[MON][0];
  assert.deepStrictEqual(r1.items.map(i => i.name), ['Inverted Row', 'Resistance Band Row']);
  assert.ok(r1.items.every(i => i.substitutedFor));
  const r2 = place('pull-up', '2026-11-01', { have: withBar }).byDate[MON][0];
  assert.deepStrictEqual(r2.items.map(i => i.name), ['Dead Hang', 'Scapular Pull-up']);
  const r3 = place('pull-up', '2026-11-01', { have: null }).byDate[MON][0];
  assert.deepStrictEqual(r3.items.map(i => i.name), ['Dead Hang', 'Scapular Pull-up']);
  assert.match(A.getAddon('pull-up').requiresNote, /Needs a pull-up bar/);
});

test('entry detail text is "3x8", "3x30 s" or "12 min"', () => {
  const e = place('head-height-kick', '2026-11-01').byDate;
  const items = Object.values(e).flat().flatMap(x => x.items);
  assert.ok(items.some(i => i.kind === 'routine' && i.detail === '12 min'));
  assert.ok(items.some(i => i.detail === '2x6'));
  assert.ok(items.some(i => i.detail === '2x30 s'));
});

// ── buildPlan integration ────────────────────────────────────────────────────

test('buildPlan carries a separate addons section per day and deloadWeek halves it', () => {
  const W = require('../api/week-plan');
  const tree = { skills: [], byId: new Map(), get: () => null };
  const ctxBase = { tree, st: { get: () => ({ status: 'locked' }) }, have: new Set(), focus: 'balanced', benchmarks: [], lastByItem: new Map(), date: MON, benchmarkDay: 6 };
  const plan = W.buildPlan({ ...ctxBase, addonStates: [{ addonId: 'visible-abs', startDate: '2026-11-01' }] });
  assert.ok(plan.days.every(d => Array.isArray(d.addons)));
  const train = plan.days.filter(d => d.kind === 'train');
  assert.ok(train.every(d => d.addons.length === 1 && d.addons[0].title === 'Visible abs'));
  assert.ok(plan.days.filter(d => d.kind !== 'train').every(d => d.addons.length === 0));
  const light = W.deloadWeek(plan);
  assert.strictEqual(light.days[0].addons[0].items.find(i => i.name === 'Dead Bug').sets, 2);
  assert.strictEqual(plan.days[0].addons[0].items.find(i => i.name === 'Dead Bug').sets, 3, 'the real plan is untouched');
});

// ── database ─────────────────────────────────────────────────────────────────

const stamp = `zz_addons_${process.pid}`;
const made = [];
async function fresh(tag) {
  const name = `${stamp}_${tag}`;
  made.push(name);
  const db = getDatabase(name);
  await db.sequelize.sync();
  await db.migrate();
  return db;
}
after(() => { for (const n of made) { try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* not created */ } } });

test('the GoalAddon migration is idempotent: run twice, data intact, no error', { skip }, async () => {
  const db = await fresh('mig');
  await A.startAddon(db, 'visible-abs');
  await db.migrate();
  await db.migrate();
  await db.sequelize.sync();
  const rows = await A.listStates(db);
  assert.strictEqual(rows.length, 1);
  const cols = (await db.sequelize.query('PRAGMA table_info("GoalAddons")'))[0].map(c => c.name);
  for (const c of ['addonId', 'status', 'startDate', 'goalId', 'reminder']) assert.ok(cols.includes(c), c);
  assert.strictEqual(rows[0].reminder, false);
});

test('start / pause / resume / stop; start is idempotent; it links or creates a Goal of the right kind', { skip }, async () => {
  const db = await fresh('life');
  const t = todayET();
  const s1 = await A.startAddon(db, 'pull-up');
  assert.strictEqual(s1.status, 'active');
  assert.strictEqual(s1.startDate, t);
  const goal = await db.Goal.findByPk(s1.goalId);
  assert.strictEqual(goal.kind, 'skill');
  assert.strictEqual(goal.status, 'active');
  const again = await A.startAddon(db, 'pull-up');
  assert.strictEqual(again.id, s1.id);
  assert.strictEqual((await db.GoalAddon.count()), 1);
  assert.strictEqual((await A.pauseAddon(db, 'pull-up')).status, 'paused');
  await assert.rejects(() => A.pauseAddon(db, 'pull-up'), { status: 409 });
  assert.strictEqual((await A.activeStates(db)).length, 0);
  assert.strictEqual((await A.resumeAddon(db, 'pull-up')).status, 'active');
  assert.strictEqual((await A.stopAddon(db, 'pull-up')).status, 'done');
  const s2 = await A.startAddon(db, 'pull-up');
  assert.notStrictEqual(s2.id, s1.id, 'a finished add-on restarts as a new run');
  assert.strictEqual(s2.goalId, s1.goalId, 'linked to the existing active goal');
  assert.strictEqual(await db.Goal.count(), 1);
  await assert.rejects(() => A.startAddon(db, 'nope'), { status: 404 });
  const abs = await A.startAddon(db, 'visible-abs');
  assert.strictEqual((await db.Goal.findByPk(abs.goalId)).kind, 'body_comp');
});

test('several add-ons run at once; the week merges them and done tracking is per add-on per ET day', { skip }, async () => {
  const db = await fresh('multi');
  await A.startAddon(db, 'visible-abs', new Date('2026-11-01T15:00:00Z'));
  await A.startAddon(db, 'desk-posture', new Date('2026-11-01T15:00:00Z'));
  const week = await A.addonsForWeek(db, MON, { have: null });
  assert.strictEqual(week.summary.length, 2);
  assert.deepStrictEqual(week.summary.map(s => s.planned).sort(), [3, 7]);
  assert.strictEqual(week.days[MON].length, 2);
  assert.strictEqual(week.days['2026-11-10'].length, 1);
  assert.strictEqual(week.days[MON].every(e => e.done === false), true);
  await A.setSessionDone(db, 'visible-abs', true, MON);
  const after1 = await A.addonsForWeek(db, MON, { have: null });
  assert.strictEqual(after1.days[MON].find(e => e.addonId === 'visible-abs').done, true);
  assert.strictEqual(after1.days[MON].find(e => e.addonId === 'desk-posture').done, false);
  assert.strictEqual(after1.summary.find(s => s.addonId === 'visible-abs').done, 1);
  assert.strictEqual(after1.summary.find(s => s.addonId === 'visible-abs').remaining, 2);
  const row = await db.UserSetting.findByPk(A.doneKey('visible-abs', MON));
  assert.ok(row, 'stored as addonDone:<id>:<date>');
  await A.setSessionDone(db, 'visible-abs', false, MON);
  assert.strictEqual(await db.UserSetting.findByPk(A.doneKey('visible-abs', MON)), null);
  await assert.rejects(() => A.setSessionDone(db, 'visible-abs', true, addDays(todayET(), 3)), { status: 400 });
  await assert.rejects(() => A.setSessionDone(db, 'visible-abs', true, 'tomorrow'), { status: 400 });
  const day = await A.addonsForDay(db, '2026-11-10', { have: null });
  assert.strictEqual(day.entries.length, 1);
  assert.strictEqual(day.entries[0].addonId, 'desk-posture');
});

test('a paused add-on places nothing', { skip }, async () => {
  const db = await fresh('paused');
  await A.startAddon(db, 'desk-posture', new Date('2026-11-01T15:00:00Z'));
  await A.pauseAddon(db, 'desk-posture');
  assert.strictEqual((await A.addonsForWeek(db, MON, { have: null })).summary.length, 0);
});

test('the reminder time is a per-account setting, HH:MM, unset by default', { skip }, async () => {
  const db = await fresh('remind');
  assert.strictEqual(await A.getRemindAt(db), null);
  assert.strictEqual(await A.setRemindAt(db, '07:30'), '07:30');
  assert.strictEqual((await db.UserSetting.findByPk('addons:remindAt')).value, '07:30');
  await assert.rejects(() => A.setRemindAt(db, '25:00'), { status: 400 });
  await assert.rejects(() => A.setRemindAt(db, '7:30'), { status: 400 });
  assert.strictEqual(await A.setRemindAt(db, null), null);
  assert.strictEqual(await A.getRemindAt(db), null);
});

test('weekPlan (the real store path) carries the add-ons section', { skip }, async () => {
  const S = require('../api/fitness-store');
  const db = await fresh('plan');
  await A.startAddon(db, 'visible-abs', new Date('2026-10-01T15:00:00Z'));
  const plan = await S.weekPlan(db, new Date('2026-11-10T15:00:00Z'));
  assert.ok(plan.days.every(d => Array.isArray(d.addons)));
  assert.strictEqual(plan.days.filter(d => d.addons.length).length, 3);
  assert.strictEqual(plan.addonsSummary[0].addonId, 'visible-abs');
  const light = require('../api/week-plan').deloadWeek(plan);
  assert.ok(light.days.some(d => d.addons.some(a => a.deloaded)));
});

// ── reminder text ────────────────────────────────────────────────────────────

test('reminderText is plain, within 900 chars, and empty when nothing is due or all is done', () => {
  assert.strictEqual(A.reminderText([]), '');
  const done = [{ title: 'X', phase: 'Week 1', sessionDone: true, entries: [{ name: 'a', detail: '3x8' }] }];
  assert.strictEqual(A.reminderText(done), '');
  const open = [{ title: 'Visible abs', phase: 'Weeks 1-2', sessionDone: false, entries: [{ name: 'Dead Bug', detail: '3x8' }] }];
  const t = A.reminderText(open);
  assert.match(t, /Visible abs \(Weeks 1-2\)/);
  assert.match(t, /- Dead Bug 3x8/);
  const huge = [{ title: 'T', phase: 'P', sessionDone: false, entries: Array.from({ length: 200 }, (_, i) => ({ name: 'Exercise number ' + i, detail: '3x8' })) }];
  assert.ok(A.reminderText(huge).length <= 900);
});

// ── service route ────────────────────────────────────────────────────────────

let server, base, webServer, webBase, webUser;
const svcUser = `${stamp}_svc`;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;

  webUser = `${stamp}_web`;
  const web = express();
  web.engine('ejs', ejs.renderFile);
  web.set('view engine', 'ejs');
  web.set('views', path.join(__dirname, '..', 'views'));
  web.locals.asset = p => p;
  web.use(express.json());
  const requireLogin = (req, res, next) => { req.user = { username: webUser, role: 'user' }; next(); };
  require('../api/web-addons')(web, { requireLogin, getDatabase });
  require('../api/web-week')(web, { requireLogin, getDatabase });
  await new Promise(r => { webServer = web.listen(0, r); });
  webBase = `http://127.0.0.1:${webServer.address().port}`;
  made.push(svcUser, webUser);
});
after(() => { if (server) server.close(); if (webServer) webServer.close(); });

const svc = (p, { token = 'test-token', user = svcUser } = {}) => fetch(base + '/api/service' + p, {
  headers: { ...(token ? { 'X-Service-Token': token } : {}), 'X-Service-User': user },
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

test('GET /api/service/addons/today: auth, 404 for an unknown user, and the exact contract shape', { skip }, async () => {
  assert.strictEqual((await svc('/addons/today', { token: null })).status, 401);
  assert.strictEqual((await svc('/addons/today', { token: 'wrong' })).status, 401);
  assert.strictEqual((await svc('/addons/today', { user: `${stamp}_nobody` })).status, 404);
  assert.strictEqual((await svc('/addons/today', { user: 'bad name!' })).status, 400);

  const db = await fresh('svc').catch(() => null);   // unrelated account; proves 404 above did not create files
  assert.ok(!fs.existsSync(path.join(process.env.DATA_DIR, `${stamp}_nobody_health.sqlite`)), 'a 404 creates nothing');
  void db;

  // An account with an add-on whose reminder is off, and no reminder time.
  const mine = getDatabase(svcUser);
  await mine.sequelize.sync(); await mine.migrate();
  await A.startAddon(mine, 'desk-posture', new Date('2026-10-01T15:00:00Z'));
  const off = await svc('/addons/today');
  assert.strictEqual(off.status, 200);
  assert.deepStrictEqual(Object.keys(off.body), ['user', 'date', 'remindAt', 'reminders', 'items', 'text']);
  assert.strictEqual(off.body.user, svcUser);
  assert.strictEqual(off.body.date, todayET());
  assert.strictEqual(off.body.remindAt, null);
  assert.strictEqual(off.body.reminders, false);
  assert.deepStrictEqual(off.body.items, [], 'reminder=false add-ons are not listed');
  assert.strictEqual(off.body.text, '');

  // Reminder on but no time: reminders stay false, the item is listed.
  await A.setReminder(mine, 'desk-posture', true);
  const noTime = await svc('/addons/today');
  assert.strictEqual(noTime.body.reminders, false);
  assert.strictEqual(noTime.body.items.length, 1);

  // Both: reminders true, full item shape, ready text.
  await A.setRemindAt(mine, '07:30');
  const on = (await svc('/addons/today')).body;
  assert.strictEqual(on.remindAt, '07:30');
  assert.strictEqual(on.reminders, true);
  assert.strictEqual(on.items.length, 1);
  const it = on.items[0];
  assert.deepStrictEqual(Object.keys(it), ['addonId', 'title', 'phase', 'sessionDone', 'summary', 'entries']);
  assert.strictEqual(it.addonId, 'desk-posture');
  assert.strictEqual(it.title, 'Desk posture');
  assert.match(it.phase, /^Weeks? \d/);
  assert.strictEqual(it.sessionDone, false);
  assert.strictEqual(typeof it.summary, 'string');
  assert.ok(it.entries.length >= 1);
  for (const e of it.entries) {
    assert.deepStrictEqual(Object.keys(e), ['kind', 'name', 'detail']);
    assert.ok(['routine', 'exercise'].includes(e.kind));
  }
  assert.deepStrictEqual(it.entries[0], { kind: 'routine', name: 'Desk or long-shift reset', detail: '5 min' });
  assert.ok(on.text.length > 0 && on.text.length <= 900);
  assert.match(on.text, /Desk posture/);

  // Everything done: the session is ticked and the text goes empty.
  await A.setSessionDone(mine, 'desk-posture', true);
  const done = (await svc('/addons/today')).body;
  assert.strictEqual(done.items[0].sessionDone, true);
  assert.strictEqual(done.text, '');
  assert.strictEqual(done.reminders, true);
});

// ── web routes ───────────────────────────────────────────────────────────────

const web = (method, p, body, headers = {}) => fetch(webBase + p, {
  method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
}).then(async r => { const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* html */ } return { status: r.status, text, json }; });

test('web: the page lists every add-on with its honesty text, then start, remind, done, pause, resume, stop', { skip }, async () => {
  const page = await web('GET', '/addons');
  assert.strictEqual(page.status, 200);
  for (const a of A.CATALOGUE) assert.ok(page.text.includes(a.title.replace(/&/g, '&amp;')), a.id);
  assert.match(page.text, /does not remove fat from one area/);
  assert.match(page.text, /Reminder time/);
  assert.match(page.text, /name="viewport"[^>]*viewport-fit=cover/);

  assert.strictEqual((await web('POST', '/addons/api/start', { addonId: 'splits' }, { Origin: 'http://evil.example' })).status, 403);
  assert.strictEqual((await fetch(webBase + '/addons/api/start', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.strictEqual((await web('POST', '/addons/api/start', { addonId: 'nope' })).status, 404);

  const start = await web('POST', '/addons/api/start', { addonId: 'visible-abs' });
  assert.strictEqual(start.status, 200);
  assert.strictEqual(start.json.state.status, 'active');
  const nutritionPage = await web('GET', '/addons');
  assert.match(nutritionPage.text, /\/nutrition\/targets/);
  assert.match(nutritionPage.text, /This week:/);

  assert.strictEqual((await web('PUT', '/addons/api/reminder', { addonId: 'visible-abs', reminder: true })).json.state.reminder, true);
  assert.strictEqual((await web('PUT', '/addons/api/remind-at', { time: '06:45' })).json.remindAt, '06:45');
  assert.strictEqual((await web('PUT', '/addons/api/remind-at', { time: 'soon' })).status, 400);
  const api = (await web('GET', '/addons/api')).json;
  assert.strictEqual(api.remindAt, '06:45');
  const card = api.cards.find(c => c.id === 'visible-abs');
  assert.strictEqual(card.state.status, 'active');
  assert.strictEqual(card.state.reminder, true);
  assert.strictEqual(card.quota.planned > 0, true);

  const done = await web('POST', '/addons/api/done', { addonId: 'visible-abs', done: true });
  assert.strictEqual(done.json.date, todayET());
  assert.strictEqual((await web('POST', '/addons/api/done', { addonId: 'visible-abs', done: true, date: addDays(todayET(), 2) })).status, 400);

  assert.strictEqual((await web('POST', '/addons/api/pause', { addonId: 'visible-abs' })).json.state.status, 'paused');
  assert.strictEqual((await web('POST', '/addons/api/pause', { addonId: 'visible-abs' })).status, 409);
  assert.strictEqual((await web('POST', '/addons/api/resume', { addonId: 'visible-abs' })).json.state.status, 'active');
  assert.strictEqual((await web('POST', '/addons/api/stop', { addonId: 'visible-abs' })).json.state.status, 'done');
});

test('web: /week shows add-on sessions with a done tick', { skip }, async () => {
  await web('POST', '/addons/api/start', { addonId: 'desk-posture' });
  const week = await web('GET', '/week');
  assert.strictEqual(week.status, 200);
  assert.match(week.text, /Goal add-ons/);
  assert.match(week.text, /Desk posture/);
});

test('the page, /today and /week render the add-on list partial and the nav links to it', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
  assert.match(read('views', 'partials', 'nav.ejs'), /\['addons', '\/addons', 'Add-ons'\]/);
  assert.match(read('views', 'today.ejs'), /partials\/addon-list/);
  assert.match(read('views', 'week.ejs'), /partials\/addon-list/);
  assert.match(read('views', 'addons.ejs'), /viewport-fit=cover/);
  assert.match(read('index.js'), /web-addons/);
});
