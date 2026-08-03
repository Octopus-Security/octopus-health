'use strict';
/**
 * dedupe-sets.js — refuse to log a workout that has already been logged.
 *
 * Neith logs sessions from a chat. The conversation it is reading contains
 * previous days' logs, and it has repeatedly re-sent those old exercises
 * alongside the new ones: one message reporting bench, incline press and flyes
 * came back as a ten-exercise session including the squats, RDLs and rows from
 * a previous day, at those days' exact weights. Every POST creates a new
 * session, so the same thing also produces duplicate sessions.
 *
 * The tool description already says, in capitals, to log exactly what was
 * reported and nothing more. It did it anyway. An instruction cannot be the
 * control here — the check has to be somewhere a model cannot talk its way
 * past, which is the server that owns the data.
 *
 * The signal is exact repetition. An exercise copied out of a transcript comes
 * back with byte-identical numbers: the same sets, in the same order, at the
 * same weights and reps. Actually repeating a workout to the rep and the pound
 * on a later day happens, but rarely, and this reports what it dropped so it
 * can be forced through — being told "I skipped those, say `log anyway` if you
 * really did them" is recoverable, and silently keeping a fabricated log is not.
 */

/** Compact, comparable form of one exercise: name + every set's numbers. */
function fingerprint(exercise) {
  const name = String(exercise.exerciseName || '').trim().toLowerCase();
  const sets = (exercise.sets || []).map(s => [
    s.reps ?? '', s.weight ?? '', s.duration ?? '',
  ].join('/')).join(',');
  return `${name}|${sets}`;
}

/**
 * Split submitted exercises into what to write and what to drop.
 *
 * @param {object[]} submitted  exercises from the request
 * @param {object[]} recentSets rows of { sessionId, date, exerciseName, reps, weight, duration, setNumber }
 * @param {string}   today      ET date string, for describing when the match was
 * @returns {{ keep: object[], skipped: object[] }}
 */
function partition(submitted, recentSets, today) {
  // Rebuild each recent session's exercises so they fingerprint the same way a
  // submission does.
  const bySession = new Map();
  for (const r of recentSets) {
    const key = `${r.sessionId}`;
    if (!bySession.has(key)) bySession.set(key, { date: r.date, exercises: new Map() });
    const ex = bySession.get(key).exercises;
    const name = String(r.exerciseName || '');
    if (!ex.has(name)) ex.set(name, []);
    ex.get(name).push(r);
  }

  const seen = new Map();               // fingerprint -> when it was logged
  for (const { date, exercises } of bySession.values()) {
    for (const [name, rows] of exercises) {
      rows.sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
      const fp = fingerprint({ exerciseName: name, sets: rows });
      if (!seen.has(fp)) seen.set(fp, date);
    }
  }

  const keep = [], skipped = [];
  const withinRequest = new Set();      // the same exercise twice in one payload

  for (const ex of submitted) {
    const fp = fingerprint(ex);
    if (withinRequest.has(fp)) {
      skipped.push({ exerciseName: ex.exerciseName, why: 'listed twice in the same request' });
      continue;
    }
    const when = seen.get(fp);
    if (when) {
      skipped.push({
        exerciseName: ex.exerciseName,
        why: when === today
          ? 'identical sets are already logged today'
          : `identical sets were already logged on ${when}`,
        alreadyLoggedOn: when,
      });
      continue;
    }
    withinRequest.add(fp);
    keep.push(ex);
  }

  return { keep, skipped };
}

module.exports = { fingerprint, partition };
