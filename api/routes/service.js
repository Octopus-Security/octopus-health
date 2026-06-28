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

module.exports = router;
