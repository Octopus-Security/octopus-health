/**
 * service.js — token-gated endpoints for cortex ↔ health service calls.
 * Auth: X-Service-Token header must match HEALTH_SERVICE_TOKEN env var.
 */
'use strict';

const express = require('express');
const router  = express.Router();
const getDatabase = require('../../database');
const { partition } = require('../dedupe-sets');
const { detectPR, rebuildPRs } = require('../pr-detect');

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
router.post('/sessions', requireToken, async (req, res) => {
  try {
    const { Exercise, WorkoutSession, WorkoutSet, PersonalRecord } = await getDB(req);
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

    // Create the session
    const session = await WorkoutSession.create({
      date: today, type, title: title || null,
      startedAt: new Date(), finishedAt: new Date(),
      duration: durationMins || null,
      effort: effort || null,
      notes: notes || null,
      status: 'finished',
    });

    // Create sets, and detect PRs exactly as the web app does.
    //
    // This path did not do the PR half at all. Everything logged by talking to
    // Neith produced sets and no records, so the stats page — which tells you
    // records "auto-detect when you log sets" — stayed empty for months of real
    // training. One shared implementation now, in api/pr-detect.js.
    let exerciseOrder = 0;
    const newPRs = [];
    for (const exGroup of keep) {
      let setNumber = 1;
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
      exerciseOrder++;
    }

    // Write to simple Exercise table so dashboard shows activity today
    await Exercise.create({
      date: today,
      type: title || type,
      duration: durationMins || Math.max(30, keep.length * 5),
      notes: `Logged via Neith — ${keep.length} exercise(s)`,
    });

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
    });
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
      `SELECT sessionId, exerciseName, exerciseOrder, setNumber, reps, weight, weightUnit, duration, notes
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
        ex.sets.push({ reps: r.reps, weight: r.weight, unit: r.weightUnit, duration: r.duration, notes: r.notes });
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

// GET /api/service/goals?active=1  → goals for the service user (active = not completed)
router.get('/goals', requireToken, async (req, res) => {
  try {
    const { Goal } = await getDB(req);
    const where = {};
    if (req.query.active === '1' || req.query.active === 'true') where.completed = false;
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

module.exports = router;
