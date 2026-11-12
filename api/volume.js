'use strict';
const { todayET } = require('../lib/et');
const V = require('../lib/volume');
const M = require('../lib/muscles');
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
      const resolveDef = s => byId.get(s.exerciseId) || byName.get(String(s.exerciseName || '').toLowerCase()) || null;
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
};
