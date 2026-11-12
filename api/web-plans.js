'use strict';

/**
 * web-plans.js - AUTHORING for shareable plans (trainer or admin; PLANS.md).
 *
 *   GET    /trainer-plans                       list page
 *   GET    /trainer-plans/:id                   editor page
 *   GET    /trainer-plans/api/list              the owner's plans
 *   GET    /trainer-plans/api/sessions          the owner's sessions, for the day picker
 *   POST   /trainer-plans/api                   create (private, empty)
 *   PUT    /trainer-plans/api/:id               save title, intro, weeks
 *   POST   /trainer-plans/api/:id/visibility    {visibility}
 *   POST   /trainer-plans/api/:id/rotate-link
 *   DELETE /trainer-plans/api/:id
 *
 * Same guard as web-sessions: non trainer/admin and foreign ids are 404; role re-checked within ~30 s.
 * Everything is filtered by owner (username, the key sessions already use).
 */

const P = require('./plans-store');
const S = require('./sessions-store');
const { getSharedDatabase } = require('./sessions-db');
const { trainerGuard } = require('./trainer-guard');

function mount(app, { requireLogin, verifyFresh }) {
  const guard = [requireLogin, trainerGuard(verifyFresh)];

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
    try { const h = await getSharedDatabase().ready(); res.json({ ok: true, ...(await fn(req, h)) }); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error('plans:', e.message); }
  };
  const me = req => req.user.username;

  app.get('/trainer-plans', ...guard, async (req, res) => {
    const h = await getSharedDatabase().ready();
    res.render('trainer-plans', { title: 'Shared plans', user: req.user, activeTab: 'trainer-plans', plans: await P.listOwned(h, me(req)) });
  });

  app.get('/trainer-plans/api/list', ...guard, api(async (req, h) => ({ plans: await P.listOwned(h, me(req)) })));
  app.get('/trainer-plans/api/sessions', ...guard, api(async (req, h) => ({
    sessions: (await S.listOwned(h, me(req))).map(s => ({ id: s.id, title: s.title, visibility: s.visibility, itemCount: s.items.length })),
  })));

  app.post('/trainer-plans/api', ...guard, sameOriginJson, api(async (req, h) => ({ plan: await P.create(h, me(req), req.body) })));
  app.put('/trainer-plans/api/:id', ...guard, sameOriginJson, api(async (req, h) => ({ plan: await P.update(h, me(req), req.params.id, req.body) })));
  app.post('/trainer-plans/api/:id/visibility', ...guard, sameOriginJson, api(async (req, h) => ({ plan: await P.setVisibility(h, me(req), req.params.id, (req.body || {}).visibility) })));
  app.post('/trainer-plans/api/:id/rotate-link', ...guard, sameOriginJson, api(async (req, h) => ({ plan: await P.rotateToken(h, me(req), req.params.id) })));
  app.delete('/trainer-plans/api/:id', ...guard, sameOriginJson, api(async (req, h) => P.remove(h, me(req), req.params.id)));

  app.get('/trainer-plans/:id(\\d+)', ...guard, async (req, res, next) => {
    const h = await getSharedDatabase().ready();
    let plan;
    try { plan = P.ownerView(await P.getOwned(h, me(req), req.params.id)); } catch (e) { if (e.status === 404) return next(); throw e; }
    const planJson = JSON.stringify(plan).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    res.render('trainer-plan-edit', { title: 'Edit plan', user: req.user, activeTab: 'trainer-plans', plan, planJson });
  });
}

module.exports = mount;
