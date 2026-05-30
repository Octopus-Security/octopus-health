/**
 * service.js — token-gated endpoints for cortex ↔ health service calls.
 * Auth: X-Service-Token header must match HEALTH_SERVICE_TOKEN env var.
 */
'use strict';

const express = require('express');
const router  = express.Router();
const getDatabase = require('../../database');

function requireToken(req, res, next) {
  const expected = process.env.HEALTH_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ error: 'HEALTH_SERVICE_TOKEN not configured' });
  if (req.get('X-Service-Token') !== expected) return res.status(401).json({ error: 'invalid token' });
  next();
}

// GET /api/service/prs?exercise=Pull-up
// Returns all PRs for an exercise (or all if no query), newest first.
router.get('/prs', requireToken, async (req, res) => {
  try {
    const { PersonalRecord } = await getDatabase();
    const where = req.query.exercise ? { exerciseName: req.query.exercise } : {};
    const rows = await PersonalRecord.findAll({
      where, order: [['date', 'DESC'], ['createdAt', 'DESC']], limit: 100,
    });
    res.json({ ok: true, prs: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/service/prs  { exerciseName, reps, sets, weight, weightUnit, durationSecs, date, notes }
// Logs a PR entry. No uniqueness constraint — every session log is kept.
router.post('/prs', requireToken, async (req, res) => {
  try {
    const { PersonalRecord } = await getDatabase();
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
// Returns the best (max reps) entry per exercise — used to personalise workout targets.
router.get('/prs/bests', requireToken, async (req, res) => {
  try {
    const { PersonalRecord, sequelize } = await getDatabase();
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

module.exports = router;
