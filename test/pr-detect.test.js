'use strict';

/**
 * Personal records.
 *
 * PR detection lived inline in the web set-logging route and nowhere else. The
 * service route — every workout logged by talking to Neith through Discord —
 * wrote WorkoutSessions, WorkoutSets and an Exercise row, and never touched
 * PersonalRecord. Months of real training therefore produced no records at all,
 * on a page whose empty state reads "No PRs yet — they auto-detect when you log
 * sets". It was not detecting anything; that path never ran.
 *
 * These tests pin the branch behaviour first, because the fix moves the logic
 * and a silently redefined record is worse than a missing one.
 *
 * Run: node --test test/pr-detect.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');

const { detectPR, rebuildPRs, bestPerExercise } = require('../api/pr-detect');

/** Minimal stand-in for the PersonalRecord model. */
function prModel(seed = []) {
  const rows = seed.map(r => ({ ...r }));
  return {
    rows,
    findAll: async ({ where } = {}) =>
      (where?.exerciseName ? rows.filter(r => r.exerciseName === where.exerciseName) : rows),
    create: async r => { const row = { ...r }; rows.push(row); return row; },
  };
}

test('first time an exercise is seen is always a record', async () => {
  const PersonalRecord = prModel();
  const pr = await detectPR({ PersonalRecord }, { exerciseName: 'Bench Press', weight: 135, reps: 5 }, '2026-08-01');
  assert.ok(pr);
  assert.equal(pr.weight, 135);
});

test('heavier is a record, lighter is not', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Bench Press', weight: 135 }]);
  assert.ok(await detectPR({ PersonalRecord }, { exerciseName: 'Bench Press', weight: 145, reps: 3 }, '2026-08-02'));
  assert.equal(await detectPR({ PersonalRecord }, { exerciseName: 'Bench Press', weight: 125, reps: 8 }, '2026-08-03'), null);
});

test('rep-only work is judged on reps', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Pull-up', reps: 10 }]);
  assert.ok(await detectPR({ PersonalRecord }, { exerciseName: 'Pull-up', reps: 12 }, '2026-08-02'));
  assert.equal(await detectPR({ PersonalRecord }, { exerciseName: 'Pull-up', reps: 8 }, '2026-08-03'), null);
});

test('timed work is judged on being FASTER', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Mile Run', durationSecs: 480 }]);
  assert.ok(await detectPR({ PersonalRecord }, { exerciseName: 'Mile Run', duration: 450 }, '2026-08-02'));
  assert.equal(await detectPR({ PersonalRecord }, { exerciseName: 'Mile Run', duration: 500 }, '2026-08-03'), null);
});

// ── The branch guards, pinned ────────────────────────────────────────────────
// These two are why the extraction is risky: get either wrong and old records
// change meaning without anything failing.

test('weighted AND timed is judged as weighted, not as a slow rep', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Farmer Carry', weight: 100 }]);
  const pr = await detectPR({ PersonalRecord }, { exerciseName: 'Farmer Carry', weight: 120, duration: 60 }, '2026-08-02');
  assert.ok(pr);
  assert.equal(pr.weight, 120);
  assert.equal(pr.durationSecs, undefined, 'must not be filed as a timed record');
});

test('reps AND a duration is rep work, not a timed record', async () => {
  // The original guarded the timed branch with `reps == null`. Dropping that
  // would file a 20-rep set that took 90s as a 90-second "record", and then
  // every faster-but-worse set after it would look like an improvement.
  const PersonalRecord = prModel([{ exerciseName: 'Burpees', reps: 20 }]);
  const pr = await detectPR({ PersonalRecord }, { exerciseName: 'Burpees', reps: 25, duration: 90 }, '2026-08-02');
  assert.ok(pr);
  assert.equal(pr.reps, 25);
  assert.equal(pr.durationSecs, undefined);
});

test('records are per exercise, not global', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Squat', weight: 225 }]);
  assert.ok(await detectPR({ PersonalRecord }, { exerciseName: 'Bench Press', weight: 95 }, '2026-08-02'),
    '95lb bench is a first-time bench record even though a heavier squat exists');
});

// ── Backfill ─────────────────────────────────────────────────────────────────

function setModel(rows) { return { findAll: async () => rows.map(r => ({ ...r })) }; }

test('rebuild derives records from sets already logged', async () => {
  const PersonalRecord = prModel();
  const WorkoutSession = setModel([{ id: 1, date: '2026-07-01' }, { id: 2, date: '2026-07-08' }]);
  const WorkoutSet = setModel([
    { sessionId: 1, exerciseName: 'Bench Press', weight: 135, reps: 5, exerciseOrder: 0, setNumber: 1 },
    { sessionId: 2, exerciseName: 'Bench Press', weight: 155, reps: 5, exerciseOrder: 0, setNumber: 1 },
    { sessionId: 2, exerciseName: 'Pull-up',     reps: 12,             exerciseOrder: 1, setNumber: 1 },
  ]);

  const { scanned, created } = await rebuildPRs({ PersonalRecord, WorkoutSet, WorkoutSession });
  assert.equal(scanned, 3);
  assert.equal(created.length, 3, '135 then 155 are both records in order, plus the first pull-up');
  assert.equal(PersonalRecord.rows.filter(r => r.exerciseName === 'Bench Press').pop().weight, 155);
});

test('rebuild walks by session DATE, not insertion order', async () => {
  // A session can be logged for a past date ("log yesterday's workout"), so set
  // id order is not chronological. Judged out of order, the older lighter set
  // would look like an improvement on the newer heavier one.
  const PersonalRecord = prModel();
  const WorkoutSession = setModel([{ id: 1, date: '2026-07-20' }, { id: 2, date: '2026-07-10' }]);
  const WorkoutSet = setModel([
    { sessionId: 1, exerciseName: 'Deadlift', weight: 315, reps: 3, exerciseOrder: 0, setNumber: 1 }, // later date, logged first
    { sessionId: 2, exerciseName: 'Deadlift', weight: 275, reps: 5, exerciseOrder: 0, setNumber: 1 }, // earlier date
  ]);

  const { created } = await rebuildPRs({ PersonalRecord, WorkoutSet, WorkoutSession });
  assert.equal(created.length, 2, '275 on the 10th, then 315 on the 20th — both records, in that order');
  assert.equal(created[0].weight, 275);
  assert.equal(created[1].weight, 315);
});

test('rebuild respects records that already exist', async () => {
  const PersonalRecord = prModel([{ exerciseName: 'Squat', weight: 315 }]);
  const WorkoutSession = setModel([{ id: 1, date: '2026-07-01' }]);
  const WorkoutSet = setModel([{ sessionId: 1, exerciseName: 'Squat', weight: 225, reps: 5, exerciseOrder: 0, setNumber: 1 }]);

  const { created } = await rebuildPRs({ PersonalRecord, WorkoutSet, WorkoutSession });
  assert.equal(created.length, 0, 'safe to run twice, and on an account that used the web app all along');
});

// ── Picking which record to show ─────────────────────────────────────────────
//
// Every one of these was visible on the Stats page at once: bodyweight lifts
// listed with no weight (correct), barbell lifts listed with no weight
// (wrong — the weighted record existed in the sets and never made it to a PR),
// and rows showing a bare dash because nothing at all was recorded.

test('a weighted record outranks a reps-only one for the same exercise', () => {
  // The bug this replaces: three sequential `if`s over one accumulator, so the
  // reps-only branch still ran after the weighted branch had already won and
  // could overwrite it. It bit hardest when the weighted PR had no reps stored,
  // because then `cur.reps == null` was true and the overwrite always fired.
  const best = bestPerExercise([
    { exerciseName: 'Bench Press', weight: 225, reps: null, durationSecs: null },
    { exerciseName: 'Bench Press', weight: null, reps: 12,  durationSecs: null },
  ]);
  assert.equal(best.length, 1);
  assert.equal(best[0].weight, 225, '225 lbs is the record, not 12 reps');
});

test('within a kind, the better number wins', () => {
  const best = bestPerExercise([
    { exerciseName: 'Squat', weight: 295, reps: 5,  durationSecs: null },
    { exerciseName: 'Squat', weight: 315, reps: 1,  durationSecs: null },
    { exerciseName: 'Squat', weight: 315, reps: 3,  durationSecs: null },
  ]);
  assert.equal(best[0].weight, 315);
  assert.equal(best[0].reps, 3, 'same weight, more reps is the better set');
});

test('bodyweight exercises keep their reps-only record', () => {
  // Dips and chin-ups genuinely have no weight. They are not broken rows and
  // must not be filtered out with the ones that are.
  const best = bestPerExercise([
    { exerciseName: 'Dips', weight: null, reps: 20, durationSecs: null },
    { exerciseName: 'Dips', weight: null, reps: 12, durationSecs: null },
  ]);
  assert.equal(best.length, 1);
  assert.equal(best[0].reps, 20);
  assert.equal(best[0].weight, null);
});

test('a row recording nothing at all is not a personal best', () => {
  // Ten of these existed on the first account, from an early import. They
  // rendered as an exercise name beside a dash.
  const best = bestPerExercise([
    { exerciseName: 'Dead Bug',  weight: null, reps: null, durationSecs: null },
    { exerciseName: 'Band Pull', weight: null, reps: 20,   durationSecs: null },
  ]);
  assert.deepEqual(best.map(b => b.exerciseName), ['Band Pull']);
});

test('timed efforts rank above reps-only and prefer the shorter time', () => {
  const best = bestPerExercise([
    { exerciseName: 'Mile', weight: null, reps: null, durationSecs: 420 },
    { exerciseName: 'Mile', weight: null, reps: null, durationSecs: 390 },
    { exerciseName: 'Mile', weight: null, reps: 1,    durationSecs: null },
  ]);
  assert.equal(best[0].durationSecs, 390, 'faster, matching detectPR');
});

test('records come back sorted, one per exercise', () => {
  const best = bestPerExercise([
    { exerciseName: 'Squat', weight: 315, reps: 1, durationSecs: null },
    { exerciseName: 'Dips',  weight: null, reps: 20, durationSecs: null },
    { exerciseName: 'Bench', weight: 225, reps: 5, durationSecs: null },
  ]);
  assert.deepEqual(best.map(b => b.exerciseName), ['Bench', 'Dips', 'Squat']);
});
