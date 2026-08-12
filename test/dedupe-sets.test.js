'use strict';

/**
 * Refusing a duplicate workout without refusing a warm-up.
 *
 * The check exists because Neith logs from a chat whose transcript contains
 * previous days' logs, and it repeatedly re-sent those old exercises alongside
 * the new ones. The tool description says in capitals not to. It did it anyway,
 * so the control has to live here, where an instruction cannot be argued with.
 *
 * The original signal was exact repetition, and for main lifts that is a good
 * one — nobody hits 295x10 twice in a fortnight by coincidence. For WARM-UPS it
 * is the norm, and that was the bug: five minutes on the bike and 2x10 goblet
 * squats at 40 and 50 lb are byte-identical every session, so once they were
 * logged they could never be logged again. On 2026-08-12 both were dropped
 * twice in one session, while the squats around them went in fine.
 *
 * Several heuristics were tried for telling a replay from a repeated warm-up.
 * All of them are wrong sometimes, and BOTH ways of being wrong corrupt the log:
 * a fabricated session, or a real one with holes in it. The second is worse,
 * because it costs you confidence in the whole history.
 *
 * So it does not decide any more. What is unambiguously new is written, what
 * collides is HELD and handed back as a question, and `force: true` writes it
 * after a yes. These tests exist mostly to keep it that way.
 *
 * Run: node --test test/dedupe-sets.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const { partition, fingerprint } = require('../api/dedupe-sets');

const TODAY = '2026-08-12';
const AUG5  = '2026-08-05';

/** A recent-set row as the SQL returns it. */
const row = (sessionId, date, exerciseName, setNumber, reps, weight, duration = null) =>
  ({ sessionId, date, exerciseName, setNumber, reps, weight, duration });

/** A submitted exercise. */
const ex = (exerciseName, sets) => ({ exerciseName, sets });

// Aug 5: a full session — bike warm-up, goblet squats, then the real work.
const AUG5_SESSION = [
  row(1, AUG5, 'Assault Bike',  1, null, null, 300),
  row(1, AUG5, 'Goblet Squat',  1, 10, 40),
  row(1, AUG5, 'Goblet Squat',  2, 10, 50),
  row(1, AUG5, 'Barbell Back Squat', 1, 15, 135),
  row(1, AUG5, 'Barbell Back Squat', 2, 15, 185),
];

test('a repeated warm-up is ASKED about, never dropped', () => {
  // The exact case from 2026-08-12: bike and goblet squats identical to Aug 5,
  // sent alongside squat numbers that are new. The new work goes in; the two
  // collisions come back as a question carrying enough to re-send them.
  const { keep, needsConfirm } = partition([
    ex('Assault Bike', [{ reps: null, weight: null, duration: 300 }]),
    ex('Goblet Squat', [{ reps: 10, weight: 40 }, { reps: 10, weight: 50 }]),
    ex('Barbell Back Squat', [{ reps: 10, weight: 295 }]),
  ], AUG5_SESSION, TODAY);

  assert.deepEqual(keep.map(k => k.exerciseName), ['Barbell Back Squat']);
  assert.deepEqual(needsConfirm.map(n => n.exerciseName), ['Assault Bike', 'Goblet Squat']);
  for (const n of needsConfirm) {
    assert.match(n.why, /already logged on 2026-08-05/);
    assert.ok(n.exercise, 'the held exercise must come back verbatim so a yes can re-send it');
  }
});

test('a whole old session replayed is held, and nothing is written', () => {
  // A transcript being re-read: several exercises from Aug 5 at Aug 5 numbers.
  const { keep, needsConfirm } = partition([
    ex('Assault Bike', [{ reps: null, weight: null, duration: 300 }]),
    ex('Goblet Squat', [{ reps: 10, weight: 40 }, { reps: 10, weight: 50 }]),
    ex('Barbell Back Squat', [{ reps: 15, weight: 135 }, { reps: 15, weight: 185 }]),
  ], AUG5_SESSION, TODAY);

  assert.equal(keep.length, 0, 'a replayed session must not be written unasked');
  assert.equal(needsConfirm.length, 3);
  for (const s of needsConfirm) assert.match(s.why, /already logged on 2026-08-05/);
});

test('a same-day collision is asked about too — it can still be a second session', () => {
  // Logging in two messages is normal, and re-sending what the first message
  // already logged is the other half of the original bug.
  const todaySession = [
    row(9, TODAY, 'Muscle Up', 1, 5, null),
  ];
  const { keep, needsConfirm } = partition([
    ex('Muscle Up', [{ reps: 5, weight: null }]),
    ex('Dips', [{ reps: 10, weight: null }]),
  ], todaySession, TODAY);

  assert.deepEqual(keep.map(k => k.exerciseName), ['Dips']);
  assert.equal(needsConfirm.length, 1);
  assert.match(needsConfirm[0].why, /already logged today/);
  assert.ok(needsConfirm[0].exercise, 'a yes has to be able to write it');
});

test('the same exercise twice in ONE payload is collapsed, not asked about', () => {
  // The only thing still decided rather than asked. One message describes one
  // set of work, so this is the sender's own typo — asking about it would be
  // asking somebody to confirm their own duplicate line.
  const { keep, needsConfirm } = partition([
    ex('Dips', [{ reps: 10, weight: null }]),
    ex('Dips', [{ reps: 10, weight: null }]),
  ], [], TODAY);
  assert.equal(keep.length, 1);
  assert.equal(needsConfirm.length, 0);
});

test('a genuinely new weight is never questioned', () => {
  const { keep, needsConfirm } = partition([
    ex('Goblet Squat', [{ reps: 10, weight: 40 }, { reps: 10, weight: 55 }]),
  ], AUG5_SESSION, TODAY);
  assert.equal(needsConfirm.length, 0);
  assert.equal(keep.length, 1);
});

test('the question names the MOST RECENT day it was done', () => {
  // "you did this on Tuesday" is answerable; "you did this three weeks ago"
  // sends you looking it up.
  const recent = [
    row(1, '2026-07-28', 'Goblet Squat', 1, 10, 40),
    row(2, '2026-08-10', 'Goblet Squat', 1, 10, 40),
  ];
  const { needsConfirm } = partition(
    [ex('Goblet Squat', [{ reps: 10, weight: 40 }])], recent, TODAY);
  assert.equal(needsConfirm[0].alreadyLoggedOn, '2026-08-10');
});

test('fingerprint ignores name case and surrounding space', () => {
  assert.equal(
    fingerprint({ exerciseName: '  Goblet Squat ', sets: [{ reps: 10, weight: 40 }] }),
    fingerprint({ exerciseName: 'goblet squat',    sets: [{ reps: 10, weight: 40 }] }),
  );
});
