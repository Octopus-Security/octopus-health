/**
 * service.js — token-gated endpoints for cortex ↔ health service calls.
 * Auth: X-Service-Token header must match HEALTH_SERVICE_TOKEN env var.
 */
'use strict';

const express = require('express');
const router  = express.Router();
const getDatabase = require('../../database');

// Username whose SQLite DB to use for service calls.
// Must match the username Nick registered with in the health app.
const SERVICE_USER = process.env.HEALTH_SERVICE_USER || 'psychopathy';

function requireToken(req, res, next) {
  const expected = process.env.HEALTH_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ error: 'HEALTH_SERVICE_TOKEN not configured' });
  if (req.get('X-Service-Token') !== expected) return res.status(401).json({ error: 'invalid token' });
  next();
}

async function getDB() {
  const db = getDatabase(SERVICE_USER);
  // Create any missing tables — only if sequelize is available (safe no-op if tables exist)
  if (db.sequelize) await db.sequelize.sync().catch(() => {});
  return db;
}

// GET /api/service/prs?exercise=Pull-up
router.get('/prs', requireToken, async (req, res) => {
  try {
    const { PersonalRecord } = await getDB();
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
    const { PersonalRecord } = await getDB();
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
    const { PersonalRecord, sequelize } = await getDB();
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
    const { Exercise, WorkoutSession, WorkoutSet } = await getDB();
    const { type = 'strength', title, date, durationMins, effort, notes, sets = [] } = req.body;
    const today = date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Create the session
    const session = await WorkoutSession.create({
      date: today, type, title: title || null,
      startedAt: new Date(), finishedAt: new Date(),
      duration: durationMins || null,
      effort: effort || null,
      notes: notes || null,
      status: 'finished',
    });

    // Create sets
    let exerciseOrder = 0;
    for (const exGroup of sets) {
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
        setNumber++;
      }
      exerciseOrder++;
    }

    // Write to simple Exercise table so dashboard shows activity today
    await Exercise.create({
      date: today,
      type: title || type,
      duration: durationMins || Math.max(30, sets.length * 5),
      notes: `Logged via Neith — ${sets.length} exercise(s)`,
    });

    res.json({ ok: true, sessionId: session.id, exerciseCount: sets.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/service/logged-today
// Did Nick log any training today (ET)? Counts finished workout sessions + PRs.
// Used by the gym-nudge scheduler to avoid pestering after he's already trained.
router.get('/logged-today', requireToken, async (req, res) => {
  try {
    const { WorkoutSession, PersonalRecord } = await getDB();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [sessions, prs] = await Promise.all([
      WorkoutSession.count({ where: { date: today, status: 'finished' } }),
      PersonalRecord.count({ where: { date: today } }),
    ]);
    res.json({ ok: true, date: today, sessions, prs, any: (sessions + prs) > 0 });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/meals  { mealType, description, calories, protein, carbs, fats, date, time, notes }
// For Neith to log meals into Nick's account so nutrition coaching has data.
router.post('/meals', requireToken, async (req, res) => {
  try {
    const { Meal } = await getDB();
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

// GET /api/service/nutrition-today — today's macro totals + meal count (ET)
router.get('/nutrition-today', requireToken, async (req, res) => {
  try {
    const { Meal } = await getDB();
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
    const { PersonalRecord, WorkoutTemplate } = await getDB();
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
// For Neith (Discord/Telegram) to read/log Nick's weight into his account. The
// open, per-account weight UI lives at /weight — this is the bot's service path.

// GET /api/service/weight/latest — most recent bodyweight entry
router.get('/weight/latest', requireToken, async (req, res) => {
  try {
    const { WeightEntry } = await getDB();
    const row = await WeightEntry.findOne({ order: [['date', 'DESC'], ['createdAt', 'DESC']] });
    res.json({ ok: true, weight: row });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/weight  { weight, unit, date, notes } — idempotent per date
router.post('/weight', requireToken, async (req, res) => {
  try {
    const { WeightEntry } = await getDB();
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

module.exports = router;
