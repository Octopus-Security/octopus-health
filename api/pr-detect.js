'use strict';

/**
 * pr-detect.js — "is this set a personal record", in one place.
 *
 * It used to live inline in the web set-logging route and NOWHERE ELSE. The
 * service route that cortex writes through — every workout logged by talking to
 * Neith — created WorkoutSessions, WorkoutSets and an Exercise row, and never
 * touched PersonalRecord. So months of Discord-logged training produced no PRs
 * at all, under a stats page that says "they auto-detect when you log sets".
 *
 * Three kinds of exercise, three meanings of "better":
 *
 *   timed     lower duration wins   (a mile, a plank held to failure is not this)
 *   weighted  higher weight wins
 *   reps-only higher reps wins      (pull-ups, push-ups)
 *
 * A set that is both weighted and timed is treated as weighted; that is the
 * order the web route used and changing it would silently redefine old records.
 */

/**
 * @param {object}  models        needs { PersonalRecord }
 * @param {object}  set           { exerciseName, reps, weight, weightUnit, duration, distance, distanceUnit }
 * @param {string}  date          the session's date
 * @returns {Promise<object|null>} the created PR, or null if it wasn't one
 */
async function detectPR({ PersonalRecord }, set, date) {
  const { exerciseName, reps, weight, weightUnit, duration, distance, distanceUnit } = set;
  if (!exerciseName) return null;

  const existing = await PersonalRecord.findAll({ where: { exerciseName } });

  // Timed only when there is nothing else to judge it by. A set with a duration
  // AND reps is rep work that happened to be timed, and belongs in the reps
  // branch — this guard is load-bearing and was in the original.
  if (duration != null && weight == null && reps == null) {
    const best = existing.reduce((b, pr) => (pr.durationSecs != null && (b == null || pr.durationSecs < b) ? pr.durationSecs : b), null);
    if (best == null || duration < best) {
      return PersonalRecord.create({
        exerciseName, durationSecs: duration, distance: distance || null, date,
        notes: distanceUnit ? `${distance} ${distanceUnit}` : null,
      });
    }
    return null;
  }

  if (weight != null) {
    const best = existing.reduce((b, pr) => (pr.weight != null && (b == null || pr.weight > b) ? pr.weight : b), null);
    if (best == null || weight > best) {
      return PersonalRecord.create({ exerciseName, weight, weightUnit: weightUnit || 'lbs', reps: reps || null, date });
    }
    return null;
  }

  if (reps != null) {
    const best = existing.reduce((b, pr) => (pr.reps != null && (b == null || pr.reps > b) ? pr.reps : b), null);
    if (best == null || reps > best) {
      return PersonalRecord.create({ exerciseName, reps, date });
    }
  }
  return null;
}

/**
 * Walk every set already stored, oldest first, and create the PRs that logging
 * them should have. Existing PRs are respected, so this is safe to run twice and
 * safe to run on an account that has been using the web app all along.
 *
 * This exists because the bug was silent for months: fixing the write path only
 * helps future sets, and the training that is already logged is the whole point
 * of the page.
 *
 * @returns {Promise<{scanned:number, created:object[]}>}
 */
async function rebuildPRs({ PersonalRecord, WorkoutSet, WorkoutSession }) {
  // No sequelize associations are declared in database.js, so this joins by hand
  // rather than with `include` — which throws rather than degrading.
  const sessions = await WorkoutSession.findAll({ attributes: ['id', 'date'] });
  const dateOf = new Map(sessions.map(s => [s.id, s.date]));

  const sets = await WorkoutSet.findAll();
  // Walk in the order the training actually happened, not insertion order. A
  // session can be logged for a past date ("log yesterday's workout"), so set id
  // ascending is not chronological, and "better than everything before it" is
  // only meaningful in date order.
  sets.sort((a, b) => {
    const da = dateOf.get(a.sessionId) || '', db = dateOf.get(b.sessionId) || '';
    return String(da).localeCompare(String(db))
        || (a.exerciseOrder ?? 0) - (b.exerciseOrder ?? 0)
        || (a.setNumber ?? 0) - (b.setNumber ?? 0);
  });

  const created = [];
  for (const s of sets) {
    const pr = await detectPR({ PersonalRecord }, {
      exerciseName: s.exerciseName,
      reps:         s.reps,
      weight:       s.weight,
      weightUnit:   s.weightUnit,
      duration:     s.duration,
    }, dateOf.get(s.sessionId) || s.createdAt);
    if (pr) created.push(pr);
  }
  return { scanned: sets.length, created };
}

module.exports = { detectPR, rebuildPRs };
