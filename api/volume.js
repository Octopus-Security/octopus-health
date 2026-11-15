'use strict';
const { todayET } = require('../lib/et');
const V = require('../lib/volume');
const M = require('../lib/muscles');
const assignMuscles = require('../lib/assign-muscles');
const GEOMETRY = require('../lib/body-geometry.json');

/**
 * volume.js - training volume per muscle, as a page and as JSON/CSV.
 * Mounted from index.js with the app's own requireLogin; every handler opens
 * getDatabase(req.user.username) and nothing else, so only the signed-in
 * user's own sets are ever read (each account is its own sqlite file).
 *
 *   GET /volume                      the page (heat map on the body figure + muscle x window grid)
 *   GET /volume/api/windows          JSON (default) or ?format=csv; see docs/MUSCLE-VOLUME.md
 *
 * Query: from, to (YYYY-MM-DD, ET), length (days, 30), step (days, 1), guidelineMin, guidelineMax
 * (weekly hard sets per muscle), primaryCredit, secondaryCredit (0-1).
 */
module.exports = (app, { requireLogin, getDatabase }) => {
  app.get('/volume', requireLogin, (req, res) => {
    res.render('volume', {
      title: 'Training volume', user: req.user, vocab: M.publicVocabulary(), geometry: GEOMETRY,
      defaults: { length: 30, step: 1, guideline: V.DEFAULT_GUIDELINE, primaryCredit: V.PRIMARY_CREDIT, secondaryCredit: V.SECONDARY_CREDIT },
    });
  });

  app.get('/volume/api/windows', requireLogin, async (req, res) => {
    try {
      const { WorkoutSession, WorkoutSet, ExerciseDefinition } = getDatabase(req.user.username);
      const first = await WorkoutSession.min('date');
      const last = await WorkoutSession.max('date');
      const p = V.parseParams(req.query, { today: todayET(), firstDate: first });
      if (!p.ok) return res.status(400).json({ success: false, error: p.error });

      // Sets only from sessions inside the span the windows can cover.
      const sessions = await WorkoutSession.findAll({ where: { date: { [require('sequelize').Op.between]: [p.from, p.to] } }, attributes: ['id', 'date'], raw: true });
      const dateOf = new Map(sessions.map(s => [s.id, s.date]));
      const rows = dateOf.size ? await WorkoutSet.findAll({ where: { sessionId: [...dateOf.keys()] }, raw: true }) : [];
      const defs = await ExerciseDefinition.findAll({ raw: true });
      const byId = new Map(defs.map(d => [d.id, d]));
      const byName = new Map(defs.map(d => [String(d.name).toLowerCase(), d]));
      let published = new Map();
      try { published = await require('./catalogue-db').approvedByName(); } catch { /* this account's own definitions still count */ }
      const credits = (d) => V.creditsFor(d);
      const resolveDef = (s) => {
        const idDef = s.exerciseId != null ? (byId.get(s.exerciseId) || byId.get(Number(s.exerciseId)) || null) : null;
        const key = String(s.exerciseName || '').toLowerCase();
        return V.pickDef(idDef, byName.get(key) || null, published.get(key) || null, credits);
      };
      const sets = rows.map(r => ({ ...r, date: dateOf.get(r.sessionId) }));

      const report = V.compute(sets, resolveDef, p);
      report.dataRange = { first: first || null, last: last || null };
      if (req.query.format === 'csv') {
        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', 'attachment; filename="muscle-volume.csv"');
        return res.send(V.toCsv(report));
      }
      res.set('Cache-Control', 'private, no-store');
      res.json({ success: true, ...report });
    } catch (e) {
      console.error('volume failed:', e.message);
      res.status(500).json({ success: false, error: 'could not compute volume' });
    }
  });

  // Exercises this account already has muscles for, so the unassigned form can
  // copy a choice the person makes. The copy fills the form. It does not save.
  app.get('/volume/api/with-muscles', requireLogin, async (req, res) => {
    try {
      const { ExerciseDefinition } = getDatabase(req.user.username);
      const defs = await ExerciseDefinition.findAll({ attributes: ['name', 'primaryMuscles', 'secondaryMuscles'], raw: true });
      const exercises = [];
      for (const d of defs) {
        const primary = M.normalize(d.primaryMuscles).muscles;
        if (!primary.length) continue;
        const secondary = M.normalize(d.secondaryMuscles).muscles.filter((m) => !primary.includes(m));
        exercises.push({ name: d.name, primary, secondary });
      }
      exercises.sort((a, b) => a.name.localeCompare(b.name));
      res.set('Cache-Control', 'private, no-store');
      res.json({ success: true, exercises });
    } catch (e) {
      console.error('with-muscles failed:', e.message);
      res.status(500).json({ success: false, error: 'could not load exercises' });
    }
  });

  // Attach muscles to a logged name on this account. The body map calls this.
  // Muscles that are not in the vocabulary are dropped. Nothing is guessed.
  app.post('/volume/api/assign', requireLogin, async (req, res) => {
    try {
      const { ExerciseDefinition } = getDatabase(req.user.username);
      const result = await assignMuscles.apply(ExerciseDefinition, req.body || {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.set('Cache-Control', 'private, no-store');
      res.json({ success: true, exercise: result.exercise });
    } catch (e) {
      console.error('assign muscles failed:', e.message);
      res.status(500).json({ success: false, error: 'could not save muscles' });
    }
  });
};
