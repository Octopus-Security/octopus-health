'use strict';

/**
 * web-nutrition.js - the Targets page: daily calorie / protein targets, today's
 * progress, a 7-day view and a starting-point estimate. Works with no Discord,
 * Telegram or cortex. Mounted from index.js with the app's own requireLogin; every
 * handler opens getDatabase(req.user.username) and nothing else (one sqlite file
 * per account, so no owner column and no way to name another account).
 *
 *   GET    /nutrition/targets               page (optional ?weight=&unit=&goal=&activity= shows an estimate)
 *   GET    /nutrition/targets/api           { targets, week }
 *   PUT    /nutrition/targets/api           {calories, protein, carbs?, fats?, source?}
 *   DELETE /nutrition/targets/api           clear
 *
 * Same CSRF stance as web-gyms.js: JSON body required, Origin must match.
 */

const N = require('./nutrition-targets');

function mount(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);

  function sameOriginJson(req, res, next) {
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* refused below */ }
      if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
    }
    if (!/^application\/json\b/i.test(req.get('content-type') || '')) return res.status(415).json({ ok: false, error: 'send application/json' });
    next();
  }
  const api = fn => async (req, res) => {
    try { const db = dbFor(req); await db.sequelize.sync(); res.json(await fn(req, db)); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error(e); }
  };

  app.get('/nutrition/targets', requireLogin, async (req, res) => {
    const db = dbFor(req);
    await db.sequelize.sync();
    const data = await N.overview(db);
    let est = null, estError = null;
    const q = req.query || {};
    if (q.weight) {
      try { est = N.estimate({ weight: q.weight, unit: q.unit, goal: q.goal, activity: q.activity }); }
      catch (e) { if (!e.status) throw e; estError = e.message; }
    }
    const last = await db.WeightEntry.findOne({ order: [['date', 'DESC']] });
    res.render('nutrition-targets', {
      title: 'Nutrition targets', user: req.user, activeTab: 'nutrition',
      ...data, N, est, estError, q,
      lastWeight: last ? { weight: last.weight, unit: last.unit } : null,
    });
  });

  app.get('/nutrition/targets/api', requireLogin, api(async (req, db) => N.overview(db)));
  app.put('/nutrition/targets/api', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, targets: await N.setTargets(db, req.body) })));
  app.delete('/nutrition/targets/api', requireLogin, sameOriginJson, api(async (req, db) => { await N.clearTargets(db); return { ok: true, targets: null }; }));
}

module.exports = mount;
