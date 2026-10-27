/**
 * service.js — token-gated endpoints for cortex ↔ health service calls.
 * Auth: X-Service-Token header must match HEALTH_SERVICE_TOKEN env var.
 */
'use strict';

const express = require('express');
const { Op } = require('sequelize');
const router  = express.Router();
const getDatabase = require('../../database');
const { partition } = require('../dedupe-sets');
const { detectPR, rebuildPRs } = require('../pr-detect');
const { macrosForTemplate, describe, provenance } = require('../meal-template');
const { isFinished, mealFor } = require('../meal-prep');
const { resolveExerciseNames, questionText, canonicalKey } = require('../exercise-names');
const { parseWorkout } = require('../workout-parse');
const { resolveSessionTitle, titleQuestionText, seedSessionTitles } = require('../session-titles');

/**
 * Every exercise name this account already uses.
 *
 * Both what they have actually logged and the exercise library, because a name
 * in the library is one they can pick in the web app tomorrow — matching only
 * against past sets would let the two vocabularies drift apart, which is the
 * same failure one level up.
 */
async function knownExerciseNames(db) {
  const [logged] = await db.sequelize.query(
    'select distinct exerciseName as n from WorkoutSets where exerciseName is not null'
  );
  const defs = await db.ExerciseDefinition.findAll({ attributes: ['name'] });
  return [...new Set([...logged.map(r => r.n), ...defs.map(d => d.name)].filter(Boolean))];
}

// Whose database a service call lands in when the caller doesn't say.
//
// This used to be the ONLY answer: one env var decided the owner of every write
// on this API, so the health service had no per-user concept at all. That was
// fine while exactly one person could talk to Neith and is a data leak the
// moment a second can — their workouts, weight, meals and goals would all be
// written into this account.
//
// Callers now name the account (X-Service-User). The default remains, so a
// caller that hasn't been updated behaves exactly as before and the default
// account's data stays where it is — health can deploy before cortex does.
const SERVICE_USER = process.env.HEALTH_SERVICE_USER || 'psychopathy';

// A username becomes a FILENAME (`data/<username>_health.sqlite`). While it came
// from a const or from octopus-auth that was safe; arriving in a header it is
// not, so it is checked against a whitelist rather than sanitised — a name that
// doesn't match is refused, never repaired into something that opens a
// different account's database or a path outside the data directory.
const USERNAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The account this call is for. Header first, then body/query for callers that
 * can't set headers, then the configured default.
 * @throws {Error} with .status 400 on a name that could escape the data dir
 */
function serviceUser(req) {
  // `username` in the body is the convention the planned cross-app data-rights
  // endpoints use (POST /api/service/export-user { username }, /delete-user) —
  // accepted here so this API has one idea of who a call is for, not two.
  const raw = req.get('X-Service-User')
           || (req.body && (req.body.username || req.body.user))
           || (req.query && (req.query.username || req.query.user))
           || SERVICE_USER;
  const name = String(raw).trim();
  if (!USERNAME_RE.test(name)) {
    throw Object.assign(new Error(`invalid user "${name}"`), { status: 400 });
  }
  return name;
}

/**
 * Every set logged since `since`, flat, newest sessions included.
 *
 * Ten days is enough to catch a transcript being re-read without making a
 * genuine repeat of the same session a month later look like a duplicate.
 */
async function recentSetRows(db, since) {
  const { QueryTypes } = require('sequelize');
  return db.sequelize.query(
    `SELECT ws.id AS sessionId, ws.date AS date, s.exerciseName, s.reps, s.weight,
            s.duration, s.setNumber
       FROM WorkoutSets s
       JOIN WorkoutSessions ws ON ws.id = s.sessionId
      WHERE ws.date >= :since
      ORDER BY ws.date DESC, s.exerciseOrder ASC, s.setNumber ASC`,
    { replacements: { since }, type: QueryTypes.SELECT },
  ).catch(() => []);
}

function requireToken(req, res, next) {
  const expected = process.env.HEALTH_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ error: 'HEALTH_SERVICE_TOKEN not configured' });
  if (req.get('X-Service-Token') !== expected) return res.status(401).json({ error: 'invalid token' });
  next();
}

// Resolve the account once, before any handler runs. Doing it inside a handler
// would surface a bad username as a 500 — every route here ends in a catch that
// reports 500 — and "invalid user" is a request error the caller must see as
// one. requireToken runs first so an unauthenticated caller still gets 401.
router.use(requireToken, (req, res, next) => {
  try { req.serviceUser = serviceUser(req); next(); }
  catch (e) { res.status(e.status || 400).json({ ok: false, error: e.message }); }
});

/**
 * The database for THIS request's account.
 *
 * Takes `req` rather than a username so a route physically cannot forget to
 * scope itself — there is no zero-argument form that quietly means "the
 * default account".
 */
async function getDB(req) {
  const db = getDatabase(req.serviceUser || serviceUser(req));
  // Create any missing tables — only if sequelize is available (safe no-op if tables exist)
  if (db.sequelize) await db.sequelize.sync().catch(() => {});
  // Additive column migrations (health uses plain sync(), so new columns need ALTER).
  if (db.migrate) await db.migrate().catch(() => {});
  return db;
}

// GET /api/service/prs?exercise=Pull-up
router.get('/prs', requireToken, async (req, res) => {
  try {
    const { PersonalRecord } = await getDB(req);
    const where = req.query.exercise ? { exerciseName: req.query.exercise } : {};
    const rows = await PersonalRecord.findAll({
      where, order: [['date', 'DESC'], ['createdAt', 'DESC']], limit: 100,
    });
    res.json({ ok: true, prs: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/prs  { exerciseName, reps, sets, weight, weightUnit, durationSecs, date, notes }
router.post('/prs', requireToken, async (req, res) => {
  try {
    const { PersonalRecord } = await getDB(req);
    const { exerciseName, reps, sets, weight, weightUnit, durationSecs, date, notes } = req.body;
    if (!exerciseName) return res.status(400).json({ error: 'exerciseName required' });
    const row = await PersonalRecord.create({
      exerciseName,
      reps:         reps        != null ? parseInt(reps)         : null,
      sets:         sets        != null ? parseInt(sets)         : null,
      weight:       weight      != null ? parseFloat(weight)     : null,
      weightUnit:   weightUnit  || 'lbs',
      durationSecs: durationSecs != null ? parseInt(durationSecs) : null,
      date:         date        || new Date().toISOString().slice(0, 10),
      notes:        notes       || null,
    });
    res.json({ ok: true, pr: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/prs/bests
router.get('/prs/bests', requireToken, async (req, res) => {
  try {
    const { PersonalRecord, sequelize } = await getDB(req);
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(
      `SELECT exerciseName,
              MAX(reps)         AS bestReps,
              MAX(durationSecs) AS bestDurationSecs,
              MAX(date)         AS lastLogged
       FROM PersonalRecords
       GROUP BY exerciseName`,
      { type: QueryTypes.SELECT }
    );
    res.json({ ok: true, bests: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/sessions
// Log a complete workout session with its sets. Also writes an Exercise entry
// so the dashboard "Today's Exercise" stat updates immediately.
// Body: { type, title, date, durationMins, effort, notes, sets: [{ exerciseName, sets: [{ reps, weight, duration, notes }] }] }
async function logSession(req, res) {
  try {
    const { Exercise, WorkoutSession, WorkoutSet, PersonalRecord } = await getDB(req);
    // `newTitle` is still ACCEPTED in the body and ignored: a title no longer
    // needs confirming, and cortex deploys separately, so an older one still
    // sending it must not be an error.
    const { type = 'strength', title, date, durationMins, effort, notes, sets = [], force = false } = req.body;

    // Resolve the day this session belongs to.
    //
    // Callers may log a session from another day — "yesterday", or last night's
    // training entered after midnight — so a date is accepted. It is checked
    // rather than trusted: a malformed or absurd one silently rewriting history
    // is worse than refusing it, and a caller that got the year wrong should
    // hear about it now. Everything is Eastern Time, which is the only clock
    // this log is kept in.
    const nowET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    let today = nowET;
    if (date != null && String(date).trim() !== '') {
      const asked = String(date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asked) || Number.isNaN(Date.parse(asked))) {
        return res.status(400).json({ ok: false, error: `date must be YYYY-MM-DD, got "${asked}"` });
      }
      if (asked > nowET) {
        return res.status(400).json({ ok: false, error: `date ${asked} is in the future (today is ${nowET})` });
      }
      const oldest = new Date(Date.now() - 366 * 24 * 3600 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      if (asked < oldest) {
        return res.status(400).json({ ok: false, error: `date ${asked} is more than a year ago — check the year` });
      }
      today = asked;
    }

    // ── The title, which is never a reason to refuse a workout ───────────────
    //
    // This used to ask, and refuse to write anything, whenever a title was not
    // already in the account's list. It cost FOUR DAYS of training: the log's
    // last entry was 2026-10-10 and 10-11 through 10-14 were all reported in
    // chat, parsed correctly, and thrown away at this gate. On 10-11 the owner
    // was asked for a title three times in one session; on 10-14 "Leg Day"
    // produced the question, he answered it, and the answer arrived alongside a
    // naming question that discarded the workout again.
    //
    // The title question was modelled on the exercise-name question below, and
    // that was the mistake — they are not the same kind of question. A split
    // exercise name splits a lift's HISTORY, so a 205 lb bench and a 185 lb
    // bench stop being comparable and neither is the record; that is worth
    // blocking a write for. A title is a headline on a card, the Logs page
    // already leads with the DATE, and sessions are grouped by day regardless —
    // so a messy title costs nothing a later edit cannot fix, and the Logs page
    // has had a Title field all along.
    //
    // So: a title given is used, and added to the known list if it is new. The
    // list still exists and still curates the account's own spelling — "pull"
    // resolves to the seeded "Pull" — it just no longer has a veto.
    //
    // cortex cannot send one at all now (its two log tools dropped the
    // parameter), which is what fixes this for chat logging without waiting on
    // a health deploy. This half is for every OTHER caller: the web quick-log,
    // and anything written later.
    let resolvedTitle = null;
    if (title != null && String(title).trim() !== '') {
      const titleDb = await getDB(req);
      await seedSessionTitles(titleDb);
      const knownTitles = (await titleDb.SessionTitle.findAll({ attributes: ['name'] })).map(t => t.name);
      const asked = String(title).trim();
      const r = resolveSessionTitle(asked, knownTitles);
      if (r.status === 'known') {
        resolvedTitle = r.name;                 // the account's own spelling/case
      } else {
        // findOrCreate rather than create: two requests racing on the same
        // brand-new title (a slow reply, re-sent) must not create two rows.
        const [row] = await titleDb.SessionTitle.findOrCreate({ where: { name: asked } });
        resolvedTitle = row.name;
      }
    }

    // ── Is every exercise one this account already knows? ────────────────────
    //
    // Asked BEFORE anything is written, and for the whole message at once.
    //
    // The log grew seven pairs of near-duplicates — `Bench Press` beside
    // `Barbell Bench Press`, `Tricep Pushdown` beside `Cable Tricep Pushdown` —
    // because a name logged from a chat is whatever got said that day, and each
    // spelling then keeps its own history. A 205 lb bench and a 185 lb bench sat
    // in the table as two different lifts and neither one was the record.
    //
    // The account's own exercise names are right here, so the question belongs
    // here too, while the person who knows the answer is still in the
    // conversation. Note that equipment is never assumed away: `Cable Face Pull`
    // and `Resistance Band Face Pull` have the same shape as the pairs above and
    // are genuinely different lifts, so this asks rather than deciding.
    // See api/exercise-names.js.
    // A name the person already answered "which did you mean?" for is
    // rewritten before it is checked, so the question is asked once, ever.
    let namingAsk = null;         // ambiguous names: asked AFTER the write, see below
    const answered = new Set();   // names the person already settled — never asked again
    if (sets.length) {
      const aliases = await aliasMap(await getDB(req));
      for (const s of sets) {
        const a = s.exerciseName && aliases.get(canonicalKey(s.exerciseName));
        if (a) { s.exerciseName = a; answered.add(a); }
      }
    }

    if (sets.length) {
      const known = await knownExerciseNames(await getDB(req));
      const { resolved, questions: asked } = resolveExerciseNames(
        sets.map(s => s.exerciseName).filter(Boolean), known);
      const questions = asked.filter(q => !answered.has(q.exerciseName));

      // ── An ambiguous name is now a FOLLOW-UP, not a refusal ──────────────
      //
      // This used to return `sessionId: null` and write nothing. It was the
      // last gate of that shape, and on 2026-10-14 it is what discarded a leg
      // day the owner had already re-sent twice — "Bar =", "X", and "L Sit Pull
      // Ups" were enough to throw away nine exercises he really did.
      //
      // The reasoning above is still right: a split name splits a lift's
      // HISTORY, and that is worth asking about. What was wrong was the price.
      // Losing the session is the more expensive error, and it is the
      // irrecoverable one — the training happened once, while a name is
      // fixable for as long as the row exists (api/log-edit.js renames an
      // exercise within a session, the Logs page does it, and the answer is
      // remembered as an alias so the question is asked once ever).
      //
      // The owner's own words, deciding this: "I will forget to give the
      // correct name sometimes" — so the common case is not a typo to catch,
      // it is a name that needs tidying later. Tidying later is cheap.
      //
      // So: write it under the name AS TYPED, and hand the questions back for
      // the caller to ask afterwards.
      //
      // Reported under a NEW key. `needsNaming` meant "nothing was saved" to
      // every existing caller, and cortex deploys separately — reusing the key
      // for an advisory would make a deployed cortex announce that a workout it
      // just saved was discarded. An older cortex seeing only `namingAsk`
      // ignores it and correctly reports what was logged, which is the right
      // way to fail. (This is the same trap the `needsConfirm`/`skipped` alias
      // and the needsTitle `.length` note below were both written about.)
      namingAsk = questions.length ? questions : null;

      // Write under the name the account already uses, so today's sets join
      // their own history instead of starting a second one beside it. An
      // ambiguous name is not in `resolved`, so it keeps the typed spelling.
      for (const s of sets) {
        const name = resolved.get(s.exerciseName);
        if (name) s.exerciseName = name;
      }
    }

    // Hold back exercises that are already in the log, unless forced.
    //
    // Neith logs from a chat whose history contains previous days' logs, and it
    // has repeatedly re-sent those old exercises along with the new ones — a
    // three-exercise push day came back as ten, carrying another day's squats
    // and rows at that day's exact weights. Its tool description already says in
    // capitals to log only what was reported; it did it anyway, so the check
    // belongs here, where an instruction cannot be argued with.
    //
    // HELD, not dropped. This used to decide, and it was wrong in the expensive
    // direction: a warm-up is byte-identical every session by design, so a
    // 5-minute bike and 2x10 goblet squats became unloggable the day after they
    // were first logged. An identical submission is also just plainly legitimate
    // when it is a later day — repeating a workout is a normal thing to do.
    //
    // A fabricated log is bad. A log with unexplained holes is worse, because it
    // costs you confidence in all of it and then the tracking is pointless. So
    // nothing is discarded: what collides comes back as a question.
    // See api/dedupe-sets.js.
    let keep = sets, needsConfirm = [];
    if (!force && sets.length) {
      const since = new Date(Date.now() - 10 * 24 * 3600 * 1000)
        .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const recent = await recentSetRows(await getDB(req), since);
      ({ keep, needsConfirm } = partition(sets, recent, today));
    }

    if (!keep.length && needsConfirm.length) {
      // Everything collided. Do NOT create an empty session, and do NOT throw
      // the request away either — answer with the question.
      return res.json({
        ok: true, sessionId: null, date: today, exerciseCount: 0,
        needsConfirm,
        // Kept under the old key too: cortex is deployed separately and may be a
        // release behind, and a rename that silently empties a field is how the
        // caller stops mentioning the skip at all.
        skipped: needsConfirm,
        question: needsConfirm.length === 1
          ? `${needsConfirm[0].exerciseName} is already in the log (${needsConfirm[0].alreadyLoggedOn}). Did you do it again? Nothing has been saved yet.`
          : `${needsConfirm.length} of these are already in the log. Did you do them again? Nothing has been saved yet.`,
        message: 'NOTHING WAS SAVED. Every exercise sent is already in the log. '
               + 'Ask whether they were really done again, and re-send with force: true if yes. '
               + 'Do not silently drop them and do not claim they were logged.',
      });
    }

    // Find or create TODAY's session of this TYPE.
    //
    // "exercises should be grouped by day" (the user's own words) means a
    // workout reported across three messages is one session, not three — the
    // Logs page showed three "1 exercise · 1 set" cards for what was really
    // one day of training. Merged on date + type, not date alone, so Strength
    // and Conditioning on the same day stay separate sessions and the Logs
    // page's type filter keeps working exactly as it does today.
    let session = await WorkoutSession.findOne({ where: { date: today, type } });
    if (!session) {
      session = await WorkoutSession.create({
        date: today, type, title: resolvedTitle || null,
        startedAt: new Date(), finishedAt: new Date(),
        duration: durationMins || null,
        effort: effort || null,
        notes: notes || null,
        status: 'finished',
      });
    } else {
      // Appending to a session created earlier today. finishedAt and effort
      // move forward with the latest call — a later RPE is usually the fuller
      // picture of the whole day, not a correction of an earlier one — and
      // duration accumulates, because a second message is more training on
      // top of the first, not a restatement of it. Nothing here subtracts.
      session.finishedAt = new Date();
      if (durationMins != null) session.duration = (session.duration || 0) + durationMins;
      if (effort != null) session.effort = effort;
      if (notes) session.notes = session.notes ? `${session.notes}\n${notes}` : notes;
      // Only fill a title the session doesn't have yet. A session that
      // already has one keeps it — a later message's title is not assumed to
      // supersede the first, since nothing asked which should win.
      if (resolvedTitle && !session.title) session.title = resolvedTitle;
      await session.save();
    }

    // Continue exerciseOrder from this session's current max rather than
    // restarting at 0. The Logs page groups sets into exercises by
    // exerciseOrder (octopus-health/index.js, the /logs route) — restarting
    // would assign an already-used order to a NEW exercise and merge two
    // different exercises into one row on the page.
    let nextOrder = await WorkoutSet.max('exerciseOrder', { where: { sessionId: session.id } });
    nextOrder = (nextOrder == null ? -1 : nextOrder) + 1;

    // Create sets, and detect PRs exactly as the web app does.
    //
    // This path did not do the PR half at all. Everything logged by talking to
    // Neith produced sets and no records, so the stats page — which tells you
    // records "auto-detect when you log sets" — stayed empty for months of real
    // training. One shared implementation now, in api/pr-detect.js.
    const newPRs = [];
    for (const exGroup of keep) {
      // Same exercise already in this session — earlier in today's session, or
      // from an earlier message that appended to it. Its sets join that group
      // (continuing setNumber) rather than starting a second group with the
      // same name, so three separate bicep-curl messages read as one exercise
      // with three sets. Exact match: sets were already rewritten to the
      // account's known spelling above, so this is a plain compare, not
      // another round of fuzzy matching.
      const existingSet = await WorkoutSet.findOne({
        where: { sessionId: session.id, exerciseName: exGroup.exerciseName },
        order: [['exerciseOrder', 'DESC']],
      });
      let exerciseOrder, setNumber;
      if (existingSet) {
        exerciseOrder = existingSet.exerciseOrder;
        const maxSetNumber = await WorkoutSet.max('setNumber', { where: { sessionId: session.id, exerciseOrder } });
        setNumber = (maxSetNumber == null ? 0 : maxSetNumber) + 1;
      } else {
        exerciseOrder = nextOrder++;
        setNumber = 1;
      }
      for (const s of (exGroup.sets || [])) {
        await WorkoutSet.create({
          sessionId:     session.id,
          exerciseName:  exGroup.exerciseName,
          exerciseOrder,
          setNumber,
          reps:          s.reps    || null,
          weight:        s.weight  || null,
          weightUnit:    s.weightUnit || 'lbs',
          duration:      s.duration || null,
          notes:         s.notes   || null,
        });
        try {
          const pr = await detectPR({ PersonalRecord }, {
            exerciseName: exGroup.exerciseName,
            reps: s.reps || null, weight: s.weight || null,
            weightUnit: s.weightUnit || 'lbs', duration: s.duration || null,
          }, today);
          if (pr) newPRs.push({ exerciseName: pr.exerciseName, weight: pr.weight, reps: pr.reps, durationSecs: pr.durationSecs });
        } catch (_) { /* never fail a logged set over PR bookkeeping */ }
        setNumber++;
      }
    }

    // Keep the dashboard "Today's Exercise" stat as ONE row per day, updated —
    // not a row appended per call, which is what used to double- (or triple-)
    // count a day the moment a workout was logged across more than one
    // message. Recomputed from today's own sessions/sets rather than
    // incremented field-by-field: an incremented counter drifts the moment a
    // call is retried, and this way the row is always a correct restatement of
    // what is actually in WorkoutSessions/WorkoutSets for the day, not a
    // running tally of calls made.
    const todaysSessions = await WorkoutSession.findAll({ where: { date: today } });
    const todaysSets = todaysSessions.length
      ? await WorkoutSet.findAll({ where: { sessionId: todaysSessions.map(s => s.id) } })
      : [];
    const exerciseGroupCount = new Set(todaysSets.map(s => `${s.sessionId}:${s.exerciseOrder}`)).size;
    const totalDurationMins = todaysSessions.reduce((sum, s) => sum + (s.duration || 0), 0)
      || Math.max(30, exerciseGroupCount * 5);
    const [exerciseRow] = await Exercise.findOrCreate({
      where: { date: today },
      defaults: {
        type: resolvedTitle || type,
        duration: totalDurationMins,
        notes: `Logged via Neith — ${exerciseGroupCount} exercise(s)`,
      },
    });
    exerciseRow.type = resolvedTitle || exerciseRow.type;
    exerciseRow.duration = totalDurationMins;
    exerciseRow.notes = `Logged via Neith — ${exerciseGroupCount} exercise(s)`;
    await exerciseRow.save();

    res.json({
      // The date it actually landed on, so the caller reports that rather than
      // whatever it assumed. A wrong date is invisible otherwise.
      ok: true, sessionId: session.id, date: today, exerciseCount: keep.length,
      // What was actually written, so the caller reports the log rather than
      // whatever it believed it sent.
      logged: keep.map(e => ({ exerciseName: e.exerciseName, sets: (e.sets || []).length })),
      needsConfirm,
      skipped: needsConfirm,          // legacy key — see the note above
      question: needsConfirm.length
        ? `${needsConfirm.map(n => n.exerciseName).join(', ')} ${needsConfirm.length === 1 ? 'is' : 'are'} already in the log and ${needsConfirm.length === 1 ? 'was' : 'were'} NOT saved. Did you do ${needsConfirm.length === 1 ? 'it' : 'them'} again?`
        : null,
      // So Neith can say "that's a PR" in the same breath as confirming the log.
      newPRs,
      // Names that resemble something already in the log, written as typed and
      // asked about AFTER the fact. Advisory: the workout IS saved. A caller
      // that does not know this key ignores it and reports the log correctly.
      namingAsk,
      namingQuestion: namingAsk
        ? questionText(namingAsk).replace(' Nothing has been saved yet.', '')
            .replace('\nAnswer each one. Nothing has been saved yet.', '')
          + ` These are LOGGED under the names as typed${namingAsk.length === 1 ? '' : ''} — answer and they will be renamed.`
        : null,
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
}
router.post('/sessions', requireToken, logSession);

// ── Remembered name answers (ExerciseAlias) ────────────────────────────────────
async function aliasMap(db) {
  if (!db.ExerciseAlias) return new Map();
  const rows = await db.ExerciseAlias.findAll().catch(() => []);
  return new Map(rows.map(r => [r.key, r.name]));
}

/** Record "when I say `asked` I mean `name`" — one row per key, last answer wins. */
async function rememberAlias(db, asked, name) {
  const key = canonicalKey(asked);
  // A same-name answer ("Leg Raises" → "Leg Raises") is kept too: it means
  // "a new exercise, not one of those", and without it the question returns.
  if (!key || !name || !db.ExerciseAlias) return;
  const [row, created] = await db.ExerciseAlias.findOrCreate({ where: { key }, defaults: { name } });
  if (!created && row.name !== name) { row.name = name; await row.save(); }
}

// POST /api/service/sessions/from-text
// Body: { text, date?, type?, title?, force?, names?: { "<as typed>": "<meant>" } }
// (`newTitle` is accepted and ignored — see logSession.)
//
// The model's whole job becomes: pass the person's message through VERBATIM.
// Everything that went wrong on 2026-10-11 across four turns and two models —
// a read-back instead of a log, a title invented and then questioned, "50+bar"
// carried as text, Friday's exercises pulled into Sunday — was the model
// transcribing a workout. Copying a string is the one thing every model does
// the same way; the parse (api/workout-parse.js) is code, so one message gives
// one result whichever model relayed it.
//
// Then it goes through logSession unchanged: name questions, title questions,
// the duplicate hold and day-merging all still apply.
router.post('/sessions/from-text', requireToken, async (req, res) => {
  try {
    const db = await getDB(req);
    const { text, date, type = 'strength', title, force, names, dryRun } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ ok: false, error: 'text is required — the message as the person wrote it' });

    // dryRun: parse only, write nothing, remember nothing. cortex asks this to
    // decide whether the CURRENT chat message is itself a workout — one parser,
    // here, rather than a second copy there drifting from it.
    if (dryRun) {
      const p = parseWorkout(String(text));
      return res.json({ ok: true, dryRun: true, exercises: p.exercises.length,
        read: p.exercises.map(e => ({ exerciseName: e.name, sets: e.sets })), unparsed: p.unparsed });
    }

    // Answers to an earlier "which did you mean?" — kept, so it is asked once ever.
    if (names && typeof names === 'object') {
      for (const [asked, meant] of Object.entries(names)) {
        if (typeof meant === 'string' && meant.trim()) await rememberAlias(db, asked, meant.trim());
      }
    }

    const parsed = parseWorkout(String(text));
    // Unparsed lines with a number in them were meant to be workout and could
    // not be read; lines with none (a question, "felt good") and a bare 2FA
    // code are not workout at all.
    const unread  = parsed.unparsed.filter(l => /\d/.test(l) && !/^\s*\d{5,}\s*$/.test(l));
    const ignored = parsed.unparsed.filter(l => !unread.includes(l));

    if (unread.length || !parsed.exercises.length) {
      // Nothing written. A half-logged workout is worse than none: the person
      // cannot tell which half made it.
      return res.json({
        ok: true, sessionId: null, exerciseCount: 0,
        needsReading: unread, ignored,
        read: parsed.exercises.map(e => ({ exerciseName: e.name, sets: e.sets })),
        message: parsed.exercises.length
          ? `NOTHING WAS SAVED. These lines could not be read: ${unread.map(l => `"${l}"`).join(', ')}. `
            + 'Ask the person to rewrite just those lines (e.g. "bench 3x10 135lb", "20 pull ups"), then send the WHOLE message again.'
          : 'NOTHING WAS SAVED — no exercise with a number was found in that text. If it was meant to be a workout, ask for it as e.g. "bench 3x10 135lb, 20 pull ups".',
      });
    }

    const aliases = await aliasMap(db);
    const sets = parsed.exercises.map(e => ({
      exerciseName: aliases.get(canonicalKey(e.name)) || e.name,
      sets: e.sets.map(x => ({ reps: x.reps, weight: x.weight, weightUnit: x.weightUnit || 'lbs', duration: x.duration, notes: x.note || undefined })),
    }));

    req.body = { type, title, date, force, sets };
    // Hand logSession's reply back with what was read, so the caller can show
    // the person their own numbers as the database will hold them.
    const json = res.json.bind(res);
    res.json = body => {
      const out = { ...body, read: sets, ignored };
      // The structured path says "re-send using the names chosen"; here the
      // text stays as typed and the answers travel beside it, which is also
      // what lets them be remembered.
      if (body && body.needsNaming && body.needsNaming.length) {
        out.message = 'NOTHING WAS SAVED. Ask which exercise is meant for each of these — ALL in one message: '
          + body.needsNaming.map(q => `"${q.asked || q.exerciseName}" → ${(q.candidates || []).join(' or ')}`).join('; ')
          + '. Then call again with the SAME text and names: { "<as typed>": "<the one picked>" }. '
          + 'The answer is remembered, so it is asked only once.';
      }
      return json(out);
    };
    return logSession(req, res);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/sessions?date=YYYY-MM-DD  (or ?days=N for a range back from today)
// What was actually LOGGED, with every set. This is the read path for "what did
// I do today" — without it a caller can only answer from its own conversation
// history, which is how Sunday's squats got reported as Monday's session.
router.get('/sessions', requireToken, async (req, res) => {
  try {
    const { WorkoutSession, WorkoutSet, sequelize } = await getDB(req);
    const { QueryTypes } = require('sequelize');
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const days = Math.max(1, Math.min(60, Number(req.query.days) || 1));
    const date = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
    const from = date || new Date(Date.now() - (days - 1) * 864e5)
      .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const to   = date || todayET;

    const sessions = await WorkoutSession.findAll({
      where: { date: { [require('sequelize').Op.between]: [from, to] } },
      order: [['date', 'DESC'], ['id', 'ASC']],
    });
    if (!sessions.length) {
      return res.json({ ok: true, from, to, today: todayET, sessions: [], note: 'nothing logged in that range' });
    }

    const rows = await sequelize.query(
      `SELECT id, sessionId, exerciseName, exerciseOrder, setNumber, reps, weight, weightUnit, duration, notes
         FROM WorkoutSets WHERE sessionId IN (:ids)
        ORDER BY sessionId ASC, exerciseOrder ASC, setNumber ASC`,
      { replacements: { ids: sessions.map(s => s.id) }, type: QueryTypes.SELECT },
    );

    const out = sessions.map(s => {
      const mine = rows.filter(r => r.sessionId === s.id);
      const byExercise = [];
      for (const r of mine) {
        let ex = byExercise.find(e => e.exerciseName === r.exerciseName);
        if (!ex) { ex = { exerciseName: r.exerciseName, sets: [] }; byExercise.push(ex); }
        // `id` lets a caller correct THIS set (PATCH /sets/:id) — additive field.
        ex.sets.push({ id: r.id, setNumber: r.setNumber, reps: r.reps, weight: r.weight, unit: r.weightUnit, duration: r.duration, notes: r.notes });
      }
      return {
        id: s.id, date: s.date, type: s.type, title: s.title,
        duration: s.duration, effort: s.effort, notes: s.notes,
        exercises: byExercise,
      };
    });

    res.json({ ok: true, from, to, today: todayET, sessions: out });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Correcting the log (api/log-edit.js) ──────────────────────────────────────
// The same operations the Logs page has, for cortex: until 2026-10-11 a wrong
// log could only be fixed from chat by deleting the day. The account is
// X-Service-User's own database, so an id from someone else's is a 404.
const LogEdit = require('../log-edit');
const editRoute = fn => async (req, res) => {
  try {
    const r = await fn(await getDB(req), req);
    res.status(r.ok ? 200 : (r.status || 400)).json(r);
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
};
router.get('/known-names', requireToken, editRoute(async (db, req) =>
  ({ ok: true, names: await require('../web-log-edit').knownNames(db, req.query.q) })));
router.get('/sessions/:id', requireToken, editRoute((db, req) => LogEdit.getSession(db, req.params.id)));
router.patch('/sessions/:id', requireToken, editRoute((db, req) => LogEdit.editSession(db, req.params.id, req.body || {})));
router.delete('/sessions/:id', requireToken, editRoute((db, req) => LogEdit.deleteSession(db, req.params.id)));
router.post('/sessions/:id/sets', requireToken, editRoute((db, req) => LogEdit.addSet(db, req.params.id, req.body || {})));
router.post('/sessions/:id/rename', requireToken,
  editRoute((db, req) => LogEdit.renameExercise(db, req.params.id, (req.body || {}).from, (req.body || {}).to)));
router.patch('/sets/:id', requireToken, editRoute((db, req) => LogEdit.editSet(db, req.params.id, req.body || {})));
router.delete('/sets/:id', requireToken, editRoute((db, req) => LogEdit.deleteSet(db, req.params.id)));

// GET /api/service/logged-today
// Did the default account log any training today (ET)? Counts finished
// workout sessions + PRs.
// Used by the gym-nudge scheduler to avoid pestering after they have trained.
router.get('/logged-today', requireToken, async (req, res) => {
  try {
    const { WorkoutSession, PersonalRecord } = await getDB(req);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [sessions, prs] = await Promise.all([
      WorkoutSession.count({ where: { date: today, status: 'finished' } }),
      PersonalRecord.count({ where: { date: today } }),
    ]);
    res.json({ ok: true, date: today, sessions, prs, any: (sessions + prs) > 0 });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/meals  { mealType, description, calories, protein, carbs, fats, date, time, notes }
// For Neith to log meals into the default account so nutrition coaching has data.
router.post('/meals', requireToken, async (req, res) => {
  try {
    const { Meal } = await getDB(req);
    const { mealType, description, calories, protein, carbs, fats, date, time, notes } = req.body;
    if (!description) return res.status(400).json({ ok: false, error: 'description required' });
    const day  = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const now  = time || new Date().toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false });
    const meal = await Meal.create({
      date: day, time: now,
      mealType: ['breakfast','lunch','dinner','snack'].includes(mealType) ? mealType : 'snack',
      description,
      calories: calories != null ? parseInt(calories) : null,
      protein:  protein  != null ? parseFloat(protein) : null,
      carbs:    carbs    != null ? parseFloat(carbs)   : null,
      fats:     fats     != null ? parseFloat(fats)    : null,
      notes: notes || null,
    });
    res.json({ ok: true, mealId: meal.id, date: day });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/meal-templates — the caller's saved meals, names and ids only.
//
// Neith needs this to turn "log my shake" into an id. Macros are deliberately not
// computed here: the list is read to pick from, and resolving every template's
// unlabelled ingredients through USDA on every list call would be several network
// round-trips to answer a question nobody asked.
router.get('/meal-templates', requireToken, async (req, res) => {
  try {
    const { MealTemplate } = await getDB(req);
    const rows = await MealTemplate.findAll({ where: { archived: false }, order: [['name', 'ASC']] });
    res.json({
      ok: true,
      templates: rows.map(t => {
        let slots = [];
        try { slots = JSON.parse(t.ingredients || '[]'); } catch { /* a corrupt row still lists */ }
        return {
          id: t.id, name: t.name, mealType: t.mealType,
          ingredients: slots.map(s => `${s.measure || ''} ${s.name}`.trim()),
        };
      }),
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/meal-preps — what is actually in the fridge right now.
//
// The question this exists to answer out loud is "how many meal preps do I
// have", so finished batches are excluded: a zero row is history, and Neith
// reading it back as an option is worse than not mentioning it.
router.get('/meal-preps', requireToken, async (req, res) => {
  try {
    const { MealPrep } = await getDB(req);
    const rows = await MealPrep.findAll({
      where: { portionsLeft: { [Op.gt]: 0 } },
      order: [['preppedOn', 'DESC'], ['name', 'ASC']],
    });
    res.json({
      ok: true,
      preps: rows.map(p => ({
        id: p.id, name: p.name, portionsLeft: p.portionsLeft, portions: p.portions,
        preppedOn: p.preppedOn, mealType: p.mealType,
        perPortion: { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fats: p.fats },
      })),
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/meal-preps/:id/log — eat one portion.
//
// Deliberately NOT given a `servings` multiplier like the template route has.
// A batch is a counted thing: eating two is two portions off the count, and
// accepting a fractional multiplier here would let the log and the count
// disagree about what is left, which is the one number this table exists for.
router.post('/meal-preps/:id/log', requireToken, async (req, res) => {
  try {
    const { MealPrep, Meal } = await getDB(req);
    const p = await MealPrep.findByPk(req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'no such meal prep' });
    if (isFinished(p)) {
      return res.status(409).json({ ok: false, error: `${p.name} is finished — nothing left to log` });
    }

    await Meal.create(mealFor(p, req.body));
    await p.update({ portionsLeft: p.portionsLeft - 1 });

    res.json({
      ok: true, name: p.name, portionsLeft: p.portionsLeft,
      logged: { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fats: p.fats },
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/meal-templates/:id/log  { servings?, mealType?, date?, time? }
//
// findByPk with no owner clause is correct here and only here: getDB(req) already
// resolved the account at the door and opened THAT person's database file, so
// there is no row in it belonging to anyone else. A template that isn't found is a
// 404 — a 403 would confirm the id exists in someone else's file.
router.post('/meal-templates/:id/log', requireToken, async (req, res) => {
  try {
    const { MealTemplate, Meal, IngredientMatch } = await getDB(req);
    const t = await MealTemplate.findByPk(req.params.id);
    if (!t) return res.status(404).json({ ok: false, error: 'no such saved meal' });

    let slots = [];
    try { slots = JSON.parse(t.ingredients || '[]'); } catch { /* treated as empty below */ }
    const servings = Number(req.body.servings) > 0 ? Number(req.body.servings) : 1;
    const result = await macrosForTemplate(slots, {
      IngredientMatch, apiKey: process.env.FDC_API_KEY, servings,
    });

    const day = req.body.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const now = req.body.time || new Date().toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false });
    const meal = await Meal.create({
      date: day, time: now,
      mealType: ['breakfast','lunch','dinner','snack'].includes(req.body.mealType) ? req.body.mealType : t.mealType,
      description: describe(t.name, slots, servings),
      calories: result.totals.kcal    || null,
      protein:  result.totals.protein || null,
      carbs:    result.totals.carbs   || null,
      fats:     result.totals.fats    || null,
      notes: [t.notes, provenance(result)].filter(Boolean).join('\n'),
    });

    // `skipped` is returned rather than folded into a success message so the model
    // has to see it. A shake logged without its peanut butter is a wrong number,
    // and Neith repeating a wrong number as fact is the failure this whole
    // nutrition path is built to avoid.
    res.json({
      ok: true, mealId: meal.id, date: day, name: t.name, servings,
      totals: result.totals, counted: result.counted, skipped: result.skipped,
      approximate: result.approximate, coverage: result.coverage,
      note: result.skipped.length
        ? `Logged, but ${result.skipped.length} ingredient(s) could not be counted — the totals are LOW. Tell the user which.`
        : undefined,
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/meals/from-recipe
//   { recipeId, mealType?, servings?, calories?, protein?, carbs?, fats?, date?, time? }
//
// Logs a meal from a recipe held in octopus-shopper. Recipes live there because
// their ingredient list is the join key for price lookups, which is shopper's job;
// health only needs the name and the macros, so it reads rather than owns them.
//
// Macros are NOT derived here. Turning "2 cups heavy cream" into grams of fat
// needs a nutrition database or a model, and health has neither — inventing a
// number would be worse than leaving it blank, because nutrition coaching reads
// these totals as fact. So: pass them in if you have them (Neith estimates them
// the same way it does for free-text meals), and if you do not, the meal is logged
// with macros null and the response says so plainly.
router.post('/meals/from-recipe', requireToken, async (req, res) => {
  try {
    const { recipeId, mealType, servings, calories, protein, carbs, fats, date, time } = req.body;
    if (!recipeId) return res.status(400).json({ ok: false, error: 'recipeId required' });

    const base  = process.env.SHOPPER_URL || 'http://octopus_shopper_internal:3004';
    const token = process.env.SHOPPER_SERVICE_TOKEN;
    if (!token) return res.status(500).json({ ok: false, error: 'SHOPPER_SERVICE_TOKEN not configured on octopus-health' });

    const r = await fetch(`${base}/api/recipes/${encodeURIComponent(recipeId)}`, {
      headers: { 'X-Service-Token': token },
    });
    if (!r.ok) {
      const detail = r.status === 404 ? 'no recipe with that id' : `shopper returned ${r.status}`;
      return res.status(r.status === 404 ? 404 : 502).json({ ok: false, error: detail });
    }
    const { recipe } = await r.json();

    const portions = Number(servings) > 0 ? Number(servings) : 1;
    const ingredients = (recipe.ingredients || [])
      .map(i => (typeof i === 'string' ? i : i.name))
      .filter(Boolean);

    // The description is what nutrition coaching and the UI read back, so it
    // carries the portion count — "half the cheesecake" and "the cheesecake" are
    // not the same meal.
    const description = portions === 1
      ? recipe.title
      : `${recipe.title} — ${portions} serving${portions === 1 ? '' : 's'}`;

    const { Meal, IngredientMatch } = await getDB(req);
    const day = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const now = time || new Date().toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false });

    // Macros: caller-supplied wins, otherwise resolve them from USDA FoodData
    // Central (free, and measured rather than estimated). Scaled by portions
    // eaten over portions the recipe makes — logging one slice of an 8-serving
    // cheesecake should not record the whole cake.
    let macros = { calories, protein, carbs, fats };
    let nutrition = null;
    const fdcKey = process.env.FDC_API_KEY;
    if (calories == null && protein == null && fdcKey) {
      try {
        const { macrosForIngredients } = require('../nutrition');
        const perRecipe = await macrosForIngredients(recipe.ingredients || [], { IngredientMatch, apiKey: fdcKey });
        const scale = portions / (Number(recipe.servings) > 0 ? Number(recipe.servings) : 1);
        macros = {
          calories: Math.round(perRecipe.totals.kcal    * scale),
          protein:  Math.round(perRecipe.totals.protein * scale * 10) / 10,
          carbs:    Math.round(perRecipe.totals.carbs   * scale * 10) / 10,
          fats:     Math.round(perRecipe.totals.fats    * scale * 10) / 10,
        };
        nutrition = {
          source: 'usda',
          coverage: perRecipe.coverage,
          approximate: perRecipe.approximate,
          skipped: perRecipe.skipped,
          matched: perRecipe.counted.length,
        };
        // Refuse to record a number built on almost nothing. Below half the
        // ingredients the total is not an underestimate, it is a different meal.
        if (perRecipe.coverage < 50) {
          macros = { calories: null, protein: null, carbs: null, fats: null };
          nutrition.discarded = `only ${perRecipe.coverage}% of ingredients resolved — macros left blank rather than recording a total this incomplete`;
        }
      } catch (e) {
        nutrition = { source: 'usda', error: e.message };
      }
    }
    const { calories: kcal2, protein: pro2, carbs: carb2, fats: fat2 } = macros;

    const meal = await Meal.create({
      date: day, time: now,
      mealType: ['breakfast','lunch','dinner','snack'].includes(mealType) ? mealType : 'snack',
      description,
      calories: kcal2 != null ? parseInt(kcal2)   : null,
      protein:  pro2  != null ? parseFloat(pro2)  : null,
      carbs:    carb2 != null ? parseFloat(carb2) : null,
      fats:     fat2  != null ? parseFloat(fat2)  : null,
      // Keep the provenance: which recipe, and what was in it at the time. Recipes
      // get edited, so a bare id would not tell you what you actually ate.
      notes: `From shopper recipe #${recipe.id}` +
             (recipe.servings ? ` (recipe serves ${recipe.servings})` : '') +
             (ingredients.length ? `\nIngredients: ${ingredients.join(', ')}` : ''),
    });

    res.json({
      ok: true, mealId: meal.id, date: day,
      recipe: { id: recipe.id, title: recipe.title },
      macros: { calories: kcal2, protein: pro2, carbs: carb2, fats: fat2 },
      // The caller is told exactly how the numbers were arrived at, including what
      // was left out. A total with no provenance invites more trust than it earns.
      nutrition: nutrition || (calories != null || protein != null ? { source: 'caller' } : { source: 'none' }),
      note: (kcal2 == null)
        ? (fdcKey ? 'Logged with no macros — see nutrition.skipped for why.' : 'Logged with no macros — set FDC_API_KEY to resolve them from USDA, or pass them in.')
        : undefined,
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/nutrition-today — today's macro totals + meal count (ET)
router.get('/nutrition-today', requireToken, async (req, res) => {
  try {
    const { Meal } = await getDB(req);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const meals = await Meal.findAll({ where: { date: today } });
    const sum = k => meals.reduce((t, m) => t + (m[k] || 0), 0);
    res.json({
      ok: true, date: today, meals: meals.length,
      calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fats: sum('fats'),
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/templates?slug=mon:gym
// Returns workout template by slug (dayKey:location), or all if no slug.
router.get('/templates', requireToken, async (req, res) => {
  try {
    const { PersonalRecord, WorkoutTemplate } = await getDB(req);
    const where = req.query.slug ? { name: req.query.slug } : {};
    const rows = await WorkoutTemplate.findAll({ where, order: [['name', 'ASC']] });
    const templates = rows.map(t => {
      let meta = {};
      try { meta = JSON.parse(t.description || '{}'); } catch {}
      return {
        id: t.id, slug: t.name, label: meta.label || t.name,
        type: t.type, location: meta.location || 'home',
        warmup: meta.warmup, cooldown: meta.cooldown,
        exercises: JSON.parse(t.exercises || '[]'),
        isCustom: t.isCustom,
      };
    });
    if (req.query.slug) {
      return res.json({ ok: true, template: templates[0] || null });
    }
    res.json({ ok: true, templates });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Weight ────────────────────────────────────────────────────────────────────
// For Neith (Discord/Telegram) to read/log the default account's weight. The
// open, per-account weight UI lives at /weight — this is the bot's service path.

// GET /api/service/weight/latest — most recent bodyweight entry
router.get('/weight/latest', requireToken, async (req, res) => {
  try {
    const { WeightEntry } = await getDB(req);
    const row = await WeightEntry.findOne({ order: [['date', 'DESC'], ['createdAt', 'DESC']] });
    res.json({ ok: true, weight: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/weight  { weight, unit, date, notes } — idempotent per date
router.post('/weight', requireToken, async (req, res) => {
  try {
    const { WeightEntry } = await getDB(req);
    const { weight, unit, date, notes } = req.body;
    const value = parseFloat(weight);
    if (!Number.isFinite(value)) return res.status(400).json({ error: 'weight (number) required' });
    const day = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const existing = await WeightEntry.findOne({ where: { date: day } });
    let row;
    if (existing) {
      existing.weight = value;
      if (unit)          existing.unit  = unit;
      if (notes != null) existing.notes = notes;
      row = await existing.save();
    } else {
      row = await WeightEntry.create({ weight: value, unit: unit || 'lbs', date: day, notes: notes || null });
    }
    res.json({ ok: true, weight: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/goals?active=1  → goals for the service user that are still live:
// not completed AND not past their deadline (ET). A dated goal whose day has gone
// (the 2026-09-29 superfight taper) kept appearing in every morning brief and in the
// coaching context for a month, because "active" only ever meant "not completed".
// Without ?active the full list is returned, expired ones included.
router.get('/goals', requireToken, async (req, res) => {
  try {
    const { Goal } = await getDB(req);
    const where = {};
    if (req.query.active === '1' || req.query.active === 'true') {
      const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      where.completed = false;
      where[Op.or] = [{ deadline: null }, { deadline: { [Op.gte]: todayET } }];
    }
    const rows = await Goal.findAll({ where, order: [['deadline', 'ASC'], ['createdAt', 'DESC']] });
    res.json({ ok: true, goals: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/goals
//   { type, title, exerciseName, targetValue, currentValue, unit, deadline, progression, description }
// type defaults to 'exercise'. targetValue is required by the schema; skill goals
// with no number default to 0.
/**
 * Compare goal names the way a person would.
 *
 * set_goal creates, and it was called more than once for the same ambition with
 * the wording drifting slightly each time — "Freestanding Handstand Push-up -> 1"
 * and "Freestanding Handstand Push-up -> 1 reps" became two rows, as did two
 * phrasings of "Visible Abs". Every one of them is then injected into the
 * coaching context on every message, so the duplication is not cosmetic: it is
 * paid for in tokens and it teaches the model there are two separate goals.
 *
 * Punctuation, case and a trailing target ("-> 1", "1 reps") are noise here.
 */
function goalKey(title, exerciseName) {
  return String(title || exerciseName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d+\s*(reps?|secs?|seconds?|mins?|minutes?|lbs?|kg)?\b\s*$/g, '')
    .trim();
}

router.post('/goals', requireToken, async (req, res) => {
  try {
    const { Goal } = await getDB(req);
    const b = req.body || {};
    const type = ['weight', 'exercise', 'calories'].includes(b.type) ? b.type : 'exercise';
    const target = b.targetValue != null ? parseFloat(b.targetValue) : 0;

    // Update the matching goal rather than adding a second one. An ambition
    // restated is the same ambition — the newer wording and progression win,
    // and nothing is lost because this is an UPDATE, never a delete.
    const key = goalKey(b.title, b.exerciseName);
    if (key) {
      const existing = (await Goal.findAll({ where: { completed: false } }))
        .find(g => goalKey(g.title, g.exerciseName) === key);
      if (existing) {
        for (const [f, v] of Object.entries({
          title:        b.title        || existing.title,
          exerciseName: b.exerciseName || existing.exerciseName,
          targetValue:  Number.isFinite(target) && target ? target : existing.targetValue,
          currentValue: b.currentValue != null ? parseFloat(b.currentValue) : existing.currentValue,
          unit:         b.unit         || existing.unit,
          deadline:     b.deadline     || existing.deadline,
          progression:  b.progression  || existing.progression,
          description:  b.description  || existing.description,
        })) existing[f] = v;
        await existing.save();
        return res.json({ ok: true, goal: existing, updatedExisting: true });
      }
    }

    const row = await Goal.create({
      type,
      title:        b.title        || b.exerciseName || null,
      exerciseName: b.exerciseName || null,
      targetValue:  Number.isFinite(target) ? target : 0,
      currentValue: b.currentValue != null ? parseFloat(b.currentValue) : null,
      unit:         b.unit         || null,
      deadline:     b.deadline     || null,
      progression:  b.progression  || null,
      description:  b.description   || null,
      completed:    false,
    });
    res.json({ ok: true, goal: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/service/goals/:id  { currentValue, completed, progression, ... }
router.patch('/goals/:id', requireToken, async (req, res) => {
  try {
    const { Goal } = await getDB(req);
    const row = await Goal.findByPk(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'goal not found' });
    const b = req.body || {};
    for (const f of ['title', 'exerciseName', 'unit', 'deadline', 'progression', 'description']) {
      if (b[f] !== undefined) row[f] = b[f];
    }
    if (b.targetValue  !== undefined) row.targetValue  = parseFloat(b.targetValue);
    if (b.currentValue !== undefined) row.currentValue = b.currentValue == null ? null : parseFloat(b.currentValue);
    if (b.completed    !== undefined) row.completed    = !!b.completed;
    await row.save();
    res.json({ ok: true, goal: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Training plans (service side — cortex tools) ─────────────────────────────
//
// Mirrors the user-auth /workout/plans routes, but token-scoped to the acting
// account so cortex can start a comp-prep plan and read the day's session.

// GET /api/service/plans  → available plans + the active assignment
router.get('/plans', requireToken, async (req, res) => {
  try {
    const { TrainingPlan, TrainingPlanAssignment } = await getDB(req);
    const plans = await TrainingPlan.findAll({ order: [['sport', 'ASC'], ['durationWeeks', 'ASC']] });
    const active = await TrainingPlanAssignment.findOne({ where: { status: 'active' }, order: [['createdAt', 'DESC']] });
    res.json({ ok: true, plans, activeAssignment: active });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/plans/start  { sport?, compDate }
// Picks the plan that fits the weeks until the comp, back-dates the start so the
// taper lands on comp week, and makes it the active assignment. One call.
router.post('/plans/start', requireToken, async (req, res) => {
  try {
    const { TrainingPlan, TrainingPlanAssignment } = await getDB(req);
    const { sport = 'bjj', compDate } = req.body || {};
    if (!compDate) return res.status(400).json({ ok: false, error: 'compDate required (YYYY-MM-DD)' });
    const { weeksUntil, selectPlan, alignedStartDate } = require('../plan-select');
    const rows = await TrainingPlan.findAll({ where: { sport } });
    if (!rows.length) return res.status(404).json({ ok: false, error: `No ${sport} plans available` });
    const weeks = weeksUntil(compDate);
    const plan = selectPlan(rows.map(r => r.toJSON()), weeks);
    const startDate = alignedStartDate(compDate, plan.durationWeeks);
    await TrainingPlanAssignment.update({ status: 'paused' }, { where: { status: 'active' } });
    const assignment = await TrainingPlanAssignment.create({ planId: plan.id, startDate, status: 'active' });
    res.status(201).json({ ok: true, plan: plan.name, sport, durationWeeks: plan.durationWeeks,
      weeksUntil: weeks, startDate, compDate, assignment });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/plans/today  → today's session from the active plan (deterministic)
router.get('/plans/today', requireToken, async (req, res) => {
  try {
    const { TrainingPlan, TrainingPlanAssignment } = await getDB(req);
    const assignment = await TrainingPlanAssignment.findOne({ where: { status: 'active' } });
    if (!assignment) return res.json({ ok: true, active: false });
    const plan = await TrainingPlan.findByPk(assignment.planId);
    if (!plan) return res.json({ ok: true, active: false });
    const phases = JSON.parse(plan.phases || '[]');
    const start = new Date(assignment.startDate);
    const today = new Date();
    const weekNumber = Math.floor((today - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const dayOfWeek = today.getDay();
    let currentPhase = phases[0];
    for (const phase of phases) {
      const [startW, endW] = String(phase.weeks).split('–').map(Number);
      if (weekNumber >= startW && weekNumber <= endW) { currentPhase = phase; break; }
    }
    const todaySession = currentPhase?.weeklySchedule?.find(d => d.day === dayOfWeek) || null;
    res.json({ ok: true, active: true, plan: plan.name, durationWeeks: plan.durationWeeks,
      phase: currentPhase?.name, weekNumber, todaySession });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ── Daily stretches (service side — cortex's morning message) ────────────────
//
// The acting account's own daily stretch list (api/daily-stretches.js). Scoped by
// getDB(req), i.e. by X-Service-User, like every route here. An empty list is an
// answer ({ items: [] }), not an error: cortex leaves the section out.

// GET /api/service/stretches/daily → { ok, name, totalMinutes, items, url }
router.get('/stretches/daily', requireToken, async (req, res) => {
  try {
    const db = await getDB(req);
    const ds = require('../daily-stretches');
    // An account that has never opened the web UI has no seeded starter plan yet.
    // Seeding is additive and idempotent; skipped once the person has a list of
    // their own, so an emptied list stays empty.
    if (!(await ds.ownPlan(db))) await db.seedData().catch(() => {});
    res.json({ ok: true, ...(await ds.serviceView(db)) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Skill tree, fitness tests, weekly benchmarks. Mounted here so they share this
// router's token + X-Service-User guards and getDB(); see fitness-service.js.
require('./fitness-service')(router, getDB);

module.exports = router;
