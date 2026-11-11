'use strict';

/**
 * web-constraints.js - the Constraints page: injuries, travel and missing kit that every
 * suggested workout has to honour until cleared. Mounted from index.js with the app's
 * own requireLogin; every handler opens getDatabase(req.user.username) and nothing else.
 *
 *   GET    /constraints                page
 *   POST   /constraints/api            {text, equipment?, until?}   add
 *   PUT    /constraints/api/:id        the three fields as given (blank = none)
 *   DELETE /constraints/api/:id        clear one
 *   POST   /constraints/api/clear      clear every active one
 *
 * Same CSRF stance as web-gyms.js: JSON body required, Origin must match.
 */

const C = require('./constraints');
const { todayET } = require('../lib/et');

function mount(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);

  function sameOriginJson(req, res, next) {
    const origin = req.get('origin');
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* refused below */ }
      if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
    }
    if (req.method !== 'DELETE' && !/^application\/json\b/i.test(req.get('content-type') || '')) return res.status(415).json({ ok: false, error: 'send application/json' });
    next();
  }
  const api = fn => async (req, res) => {
    try { const db = dbFor(req); res.json(await fn(req, db)); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error(e); }
  };

  app.get('/constraints', requireLogin, async (req, res) => {
    const db = dbFor(req);
    const all = await C.list(db, { all: true });
    res.render('constraints', {
      title: 'Constraints', user: req.user, activeTab: 'constraints',
      active: all.filter(c => c.active), past: all.filter(c => !c.active).slice(0, 20), today: todayET(),
    });
  });

  app.post('/constraints/api', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, constraint: await C.create(db, req.body, { source: 'web' }) })));
  app.post('/constraints/api/clear', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, cleared: await C.clearAll(db) })));
  app.put('/constraints/api/:id', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, constraint: await C.update(db, req.params.id, req.body, { full: true }) })));
  app.delete('/constraints/api/:id', requireLogin, sameOriginJson, api(async (req, db) => ({ ok: true, constraint: await C.clear(db, req.params.id) })));
}

module.exports = mount;
