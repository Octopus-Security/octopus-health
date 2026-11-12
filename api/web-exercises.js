'use strict';
const { safeError } = require('../lib/safeguards');

/**
 * web-exercises.js - the Exercises section of the Logs area.
 *
 *   GET  /logs/exercises                 every exercise logged, counts, last date; Rename / Merge
 *   GET  /logs/exercises/detail?name=    one exercise: PRs, strength graph, plateau tips
 *   GET  /logs/api/exercises             the list as JSON
 *   GET  /logs/api/exercises/stats?name= the detail as JSON
 *   POST /logs/api/exercises/move        { from, to, confirm } - rename / merge (preview first)
 *   POST /logs/api/exercises/merge-group { names, target, confirm }
 *   POST /logs/api/exercises/merge-selected { from[], to, confirm } - merge only the chosen names
 *   POST /logs/api/exercises/delete      { name, confirm, typed } - delete every set of one exact name (preview first)
 *
 * The name is a QUERY parameter, not a path segment: exercise names hold slashes,
 * parentheses and em dashes, and a path segment has to survive every proxy intact.
 * Cookie session, the account's own database. Writes are same-origin JSON only.
 */

const X = require('./exercise-manage');
const S = require('./exercise-stats');
const { bestPerExercise } = require('./pr-detect');
const { groupKey, dominantSpelling } = require('./exercise-names');

function sameOriginJson(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* fall through */ }
    if (host !== req.get('host')) return res.status(403).json({ ok: false, error: 'cross-origin request refused' });
  }
  if (!/^application\/json\b/i.test(req.get('content-type') || '')) {
    return res.status(415).json({ ok: false, error: 'send application/json' });
  }
  next();
}

/**
 * One exercise = every spelling of it (same canonical key and iso / single-arm signature), so a
 * "Pull ups" never splits the record of a "Pull-up". Shown under the dominant spelling; `spellings`
 * lists the rest so the page can say so.
 */
async function detail(db, name) {
  const stats = await X.spellingStats(db);
  const gk = groupKey(name);
  const same = stats.filter(r => groupKey(r.name) === gk);
  if (!same.length) return null;
  const names = same.map(r => r.name);
  const shown = dominantSpelling(names, stats);
  const rows = await X.setsFor(db, names);
  if (!rows.length) return null;
  const a = S.analyse(rows);
  let stored = null;
  try {
    const recs = (await db.PersonalRecord.findAll()).filter(r => groupKey(r.exerciseName) === gk);
    stored = bestPerExercise(recs.map(r => r.toJSON()), stats)[0] || null;
  } catch { /* the computed PRs stand on their own */ }
  return { name: shown, spellings: names, totalSets: rows.length, ...a, storedRecord: stored };
}

module.exports = function mountExercises(app, { requireLogin, getDatabase }) {
  const dbFor = req => getDatabase(req.user.username);
  const api = fn => async (req, res) => {
    try {
      const r = await fn(dbFor(req), req);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { console.error('[health] request failed:', safeError(e)); res.status(500).json({ ok: false, error: 'Something went wrong' }); }
  };

  app.get('/logs/exercises', requireLogin, async (req, res) => {
    try {
      const db = dbFor(req);
      const list = await X.listExercises(db);
      const review = await X.reviewExercises(db);
      res.render('exercises-list', { title: 'Exercises in your log', user: req.user, activeTab: 'logs', list, review });
    } catch (e) { res.status(500).send('Could not load exercises'); }
  });

  app.get('/logs/exercises/detail', requireLogin, async (req, res) => {
    try {
      const name = String(req.query.name || '').trim();
      const d = name ? await detail(dbFor(req), name) : null;
      if (!d) return res.status(404).render('exercises-detail', { title: 'Exercise not found', user: req.user, activeTab: 'logs', d: null, name, S });
      res.render('exercises-detail', { title: d.name, user: req.user, activeTab: 'logs', d, name: d.name, S });
    } catch (e) { res.status(500).send('Could not load exercise'); }
  });

  app.get('/logs/api/exercises', requireLogin, api(async db => ({ ok: true, exercises: await X.listExercises(db) })));
  app.get('/logs/api/exercises/stats', requireLogin, api(async (db, req) => {
    const d = await detail(db, String(req.query.name || '').trim());
    return d ? { ok: true, ...d } : { ok: false, status: 404, error: 'no such exercise' };
  }));
  app.get('/logs/api/exercises/review', requireLogin, api(async db => ({ ok: true, ...(await X.reviewExercises(db)) })));
  // Rename / merge one name. `exact` = "make this THE spelling" (the UI sets it for a typed or picked
  // target); without it a target that is another spelling of an existing exercise is redirected to the dominant one.
  app.post('/logs/api/exercises/move', requireLogin, sameOriginJson,
    api((db, req) => X.moveExercise(db, (req.body || {}).from, (req.body || {}).to,
      { confirm: (req.body || {}).confirm === true, exact: (req.body || {}).exact === true })));
  // Merge every spelling of one exercise into the chosen one: preview, then confirm.
  app.post('/logs/api/exercises/merge-group', requireLogin, sameOriginJson,
    api((db, req) => X.mergeGroup(db, (req.body || {}).names, (req.body || {}).target, { confirm: (req.body || {}).confirm === true })));
  // Merge only the chosen names into one: preview, then confirm. Unchosen names are untouched.
  app.post('/logs/api/exercises/merge-selected', requireLogin, sameOriginJson,
    api((db, req) => X.mergeSelected(db, (req.body || {}).from, (req.body || {}).to, { confirm: (req.body || {}).confirm === true })));
  // Delete every set logged under one exact name: preview (writes nothing), then confirm.
  app.post('/logs/api/exercises/delete', requireLogin, sameOriginJson,
    api((db, req) => X.deleteExercise(db, (req.body || {}).name,
      { confirm: (req.body || {}).confirm === true, typed: (req.body || {}).typed })));
};
module.exports.detail = detail;
