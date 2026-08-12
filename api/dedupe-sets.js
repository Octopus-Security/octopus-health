'use strict';
/**
 * dedupe-sets.js — never write a workout twice, and never throw one away.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Neith logs sessions from a chat. The conversation it is reading contains
 * previous days' logs, and it has repeatedly re-sent those old exercises
 * alongside the new ones: one message reporting bench, incline press and flyes
 * came back as a ten-exercise session including the squats, RDLs and rows from a
 * previous day, at those days' exact weights. Every POST creates a new session,
 * so the same thing also produces duplicate sessions.
 *
 * The tool description already says, in capitals, to log exactly what was
 * reported and nothing more. It did it anyway. An instruction cannot be the
 * control — the check has to be somewhere a model cannot talk its way past.
 *
 * ── Why it no longer DECIDES ─────────────────────────────────────────────────
 * The first version guessed, using exact repetition as proof of a replay. That
 * is a good signal for a main lift — nobody hits 295x10 twice in a fortnight by
 * accident — and a terrible one for a warm-up, which is byte-identical every
 * session by design. Five minutes on the bike and 2x10 goblet squats at 40 and
 * 50 lb were logged once on 2026-08-05 and then became unloggable forever. On
 * 2026-08-12 both were dropped twice in one session while the squats around them
 * went in fine, and Neith twice offered to "force them through" and twice did
 * not.
 *
 * Two lessons, and the second is the important one:
 *
 *   1. An identical submission can be perfectly legitimate. The same workout on
 *      a later day is a normal thing to do.
 *   2. Silently dropping is worse than either mistake it prevents. A fabricated
 *      log is bad; a log with unexplained holes in it is worse, because you stop
 *      being able to trust ANY of it, and then the tracking is pointless.
 *
 * So this no longer decides. It writes what is unambiguously new, holds anything
 * that collides, and hands back the question. Nothing is discarded — a held
 * exercise becomes a yes/no, and `force: true` writes it.
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
 * Split submitted exercises into what to write now and what to ask about.
 *
 * @param {object[]} submitted  exercises from the request
 * @param {object[]} recentSets rows of { sessionId, date, exerciseName, reps, weight, duration, setNumber }
 * @param {string}   today      ET date string, for describing when the match was
 * @returns {{ keep: object[], needsConfirm: object[] }}
 *   `needsConfirm` is NOT a rejection. Each entry carries `why` and
 *   `alreadyLoggedOn` so the caller can ask a question a person can answer
 *   without going and looking the session up.
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
      // Keep the most recent date for a repeated fingerprint: "you did this on
      // Tuesday" is a more useful question than "you did this three weeks ago".
      const prev = seen.get(fp);
      if (!prev || date > prev) seen.set(fp, date);
    }
  }

  const keep = [], needsConfirm = [];
  const withinRequest = new Set();      // the same exercise twice in one payload

  for (const ex of submitted) {
    const fp = fingerprint(ex);

    // The one case that is still decided here rather than asked about: the same
    // exercise twice inside a SINGLE request. There is no version of that which
    // is two real efforts — one message describes one set of work — and asking
    // would be asking about the sender's own typo.
    if (withinRequest.has(fp)) continue;
    withinRequest.add(fp);

    const when = seen.get(fp);
    if (when) {
      needsConfirm.push({
        exerciseName: ex.exerciseName,
        why: when === today
          ? 'identical sets are already logged today'
          : `identical sets were already logged on ${when}`,
        alreadyLoggedOn: when,
        exercise: ex,          // so the caller can re-send it verbatim on a yes
      });
      continue;
    }
    keep.push(ex);
  }

  return { keep, needsConfirm };
}

module.exports = { fingerprint, partition };
