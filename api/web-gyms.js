'use strict';

/**
 * web-gyms.js — the Gyms page: where you train, what is there, and an
 * active / paused switch per location (e.g. park paused for winter).
 * Mounted from index.js with the app's own requireLogin; every handler opens
 * getDatabase(req.user.username) and nothing else (one sqlite file per account).
 *
 *   GET    /gyms                                page
 *   PUT    /gyms/api/:slug                      {name?, notes?}
 *   POST   /gyms/api/:slug/pause                {until?: YYYY-MM-DD (ET)}
 *   POST   /gyms/api/:slug/resume
 *   POST   /gyms/api/:slug/equipment            {equipment, label?}
 *   DELETE /gyms/api/:slug/equipment/:id
 *
 * Same CSRF stance as web-fitness.js: JSON body required, Origin must match.
 */

const E = require('./equipment');
const G = require('./gyms-store');

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

  app.get('/gyms', requireLogin, async (req, res) => {
    const db = dbFor(req);
    await db.sequelize.sync();
    const gyms = await G.listGyms(db);
    const groups = {};
    for (const it of E.ITEMS) (groups[it.group] = groups[it.group] || []).push(it);
    res.render('gyms', { title: 'Gyms', user: req.user, activeTab: 'gyms', gyms, groups, today: G.todayET(), allPaused: gyms.length > 0 && gyms.every(g => !g.active) });
  });

  app.put('/gyms/api/:slug', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, gym: await G.updateGym(db, req.params.slug, { name: req.body.name, notes: req.body.notes }) })));
  app.post('/gyms/api/:slug/pause', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, gym: await G.pauseGym(db, req.params.slug, (req.body || {}).until) })));
  app.post('/gyms/api/:slug/resume', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, gym: await G.resumeGym(db, req.params.slug) })));
  app.post('/gyms/api/:slug/equipment', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, gym: await G.addEquipment(db, req.params.slug, req.body || {}) })));
  app.delete('/gyms/api/:slug/equipment/:id', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, gym: await G.removeEquipment(db, req.params.slug, req.params.id) })));
}

module.exports = mount;
