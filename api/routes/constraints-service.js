/**
 * constraints-service.js - workout constraints for cortex (Neith). Mounted by service.js,
 * so it inherits X-Service-Token + X-Service-User and getDB(): every call lands in the
 * database of the account the caller names, and only that one.
 *
 *   GET    /constraints               the ACTIVE ones (?all=1: also expired and cleared)
 *   POST   /constraints               {text, equipment?, until?}  add one
 *   PATCH  /constraints/:id           {text?, equipment?, until?, active?}
 *   DELETE /constraints/:id           clear one (the row is kept)
 *   POST   /constraints/clear         clear every active one
 *   POST   /constraints/import        {text, equipment?, until?}  one-time copy from cortex; idempotent
 */
'use strict';

const C = require('../constraints');
const { todayET } = require('../../lib/et');

module.exports = function mount(router, getDB) {
  const h = fn => async (req, res) => {
    try { res.json(await fn(req, await getDB(req))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Something went wrong' }); if (!e.status) console.error(e); }
  };

  router.get('/constraints', h(async (req, db) => {
    const all = ['1', 'true'].includes(String(req.query.all || ''));
    return { ok: true, today: todayET(), constraints: await C.list(db, { all }) };
  }));
  // Registered before the :id routes so "clear" and "import" are never read as an id.
  router.post('/constraints/clear', h(async (req, db) => ({ ok: true, cleared: await C.clearAll(db) })));
  router.post('/constraints/import', h(async (req, db) => ({ ok: true, ...(await C.importOne(db, req.body)) })));
  router.post('/constraints', h(async (req, db) => ({ ok: true, constraint: await C.create(db, req.body, { source: 'cortex' }) })));
  router.patch('/constraints/:id', h(async (req, db) => ({ ok: true, constraint: await C.update(db, req.params.id, req.body, { full: false }) })));
  router.delete('/constraints/:id', h(async (req, db) => ({ ok: true, constraint: await C.clear(db, req.params.id) })));
};
