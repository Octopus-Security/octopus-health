/**
 * gyms-service.js — gyms, equipment and plan fitting for cortex (Neith). Mounted by
 * service.js, so it inherits X-Service-Token + X-Service-User and getDB().
 *
 *   GET  /equipment                     the ONE catalogue (ids, names, aliases, provides)
 *   GET  /gyms                          every gym with its equipment and active/paused state
 *   PUT  /gyms/:slug                    {name?, notes?, active?, pausedUntil?}
 *   POST /gyms/:slug/pause              {until?: "YYYY-MM-DD" (ET)}
 *   POST /gyms/:slug/resume
 *   POST /gyms/:slug/equipment          {equipment: id or words, label?, attrs?}
 *   DELETE /gyms/:slug/equipment/:id
 *   GET  /gyms/resolve?location=park    where a day that wanted `park` happens today
 *   GET  /gyms/plan?day=tue&location=park   the day's template fitted to that location's
 *                                       equipment, with substitutions/omissions reported
 */
'use strict';

const E = require('../equipment');
const G = require('../gyms-store');

module.exports = function mount(router, getDB) {
  const h = fn => async (req, res) => {
    try { res.json(await fn(req, await getDB(req))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message }); }
  };

  router.get('/equipment', h(async () => ({ ok: true, version: E.CATALOGUE.version, items: E.ITEMS })));
  router.get('/gyms', h(async (req, db) => ({ ok: true, today: G.todayET(), gyms: await G.listGyms(db) })));
  // Registered before /gyms/:slug routes so "resolve" and "plan" are never read as a slug.
  router.get('/gyms/resolve', h(async (req, db) => {
    const r = await G.resolve(db, req.query.location ? String(req.query.location).toLowerCase() : null);
    const { gyms, ...rest } = r;
    return { ok: true, ...rest };
  }));
  router.get('/gyms/plan', h(async (req, db) => G.planFor(db, { day: String(req.query.day || '').toLowerCase(), location: req.query.location })));
  router.put('/gyms/:slug', h(async (req, db) => ({ ok: true, gym: await G.updateGym(db, req.params.slug, req.body || {}) })));
  router.post('/gyms/:slug/pause', h(async (req, db) => ({ ok: true, gym: await G.pauseGym(db, req.params.slug, (req.body || {}).until) })));
  router.post('/gyms/:slug/resume', h(async (req, db) => ({ ok: true, gym: await G.resumeGym(db, req.params.slug) })));
  router.post('/gyms/:slug/equipment', h(async (req, db) => ({ ok: true, gym: await G.addEquipment(db, req.params.slug, req.body || {}) })));
  router.delete('/gyms/:slug/equipment/:id', h(async (req, db) => ({ ok: true, gym: await G.removeEquipment(db, req.params.slug, req.params.id) })));
};
