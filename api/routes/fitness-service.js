/**
 * fitness-service.js — the skill-tree / tests / benchmarks half of the service
 * API cortex (Neith) calls. Mounted by service.js, so it inherits that router's
 * guards: X-Service-Token required, and `req.serviceUser` is the validated
 * account the call is FOR (X-Service-User). Every handler opens the database
 * through getDB(req) and nothing else, so a call can only ever reach its own
 * account's file; a row id from another account is simply not there (404).
 *
 *   GET  /skills/summary                    achieved / in progress / available
 *   GET  /skills/tree[?line=]               every skill with the user's status
 *   GET  /skills/progression?q=             route to a skill (or a line), position marked
 *   GET  /skills/random?mode=new|today      weighted random pick (equipment preferred)
 *   POST /skills/attempts                   {skill,result,reps,seconds,notes,date}
 *   GET  /skills/attempts[?skill=]          DELETE /skills/attempts/:id
 *   GET|PUT /skills/equipment               {action:set|add|remove|reset, equipment:[...]}
 *   GET  /plan/week[?equipment=]            3-day plan + benchmark day
 *   GET  /tests/catalog[?battery=]          GET /tests/info?item=
 *   POST /tests/results                     GET /tests/results?item=  DELETE /tests/results/:id
 *   GET  /tests/trends[?battery=]
 *   GET|POST /benchmarks                    list (with trends) / add
 *   POST /benchmarks/log                    {benchmark,value,date,notes}
 *   PUT  /benchmarks/focus  /benchmarks/day
 *   PATCH|DELETE /benchmarks/:q             POST /benchmarks/:q/move
 *   GET|PUT /benchmarks/reminder            GET /benchmarks/reminder/check[?now=]
 *   POST /benchmarks/reminder/ack           {kind:'send'|'nudge', date, items}
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const T = require('../skill-tree');
const F = require('../fitness-tests');
const S = require('../fitness-store');

module.exports = function mount(router, getDB) {
  const h = fn => async (req, res) => {
    try { res.json(await fn(req, await getDB(req))); }
    catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message, ...(e.candidates ? { candidates: e.candidates } : {}), ...(e.line ? { line: e.line } : {}) }); }
  };
  const equipmentParam = req => req.query.equipment ? String(req.query.equipment).split(',') : undefined;

  // ── skills ─────────────────────────────────────────────────────────────────
  router.get('/skills/summary', h(async (req, db) => {
    const { tree, st, have } = await S.skillState(db);
    return { ok: true, equipment: [...have], ...T.summary(tree, st, have) };
  }));

  router.get('/skills/tree', h(async (req, db) => {
    const { tree, st, have } = await S.skillState(db);
    let skills = tree.skills;
    if (req.query.line) skills = skills.filter(s => s.line === req.query.line);
    return { ok: true, lines: Object.fromEntries(Object.entries(T.LINES).map(([k, v]) => [k, v.title])), skills: skills.map(s => T.describeSkill(tree, st, have, s)) };
  }));

  router.get('/skills/progression', h(async (req, db) => {
    const { tree, st, have } = await S.skillState(db, equipmentParam(req));
    const r = T.findSkill(tree, req.query.q);
    if (!r) throw Object.assign(new Error(`No skill or line matches "${req.query.q}".`), { status: 404 });
    if (r.candidates) return { ok: true, ambiguous: true, candidates: r.candidates.map(s => ({ id: s.id, name: s.name })) };
    if (r.line) return { ok: true, kind: 'line', ...T.progressionLine(tree, st, have, r.line) };
    return { ok: true, kind: 'skill', ...T.progressionTo(tree, st, have, r.skill.id) };
  }));

  router.get('/skills/random', h(async (req, db) => {
    const mode = req.query.mode === 'today' ? 'today' : 'new';
    const { tree, st, have } = await S.skillState(db, equipmentParam(req));
    const pick = (mode === 'today' ? T.randomToday : T.randomNew)(tree, st, have);
    return { ok: true, mode, pick, equipment: [...have] };
  }));

  router.post('/skills/attempts', h(async (req, db) => S.logAttempt(db, req.body || {})));
  router.get('/skills/attempts', h(async (req, db) => ({ ok: true, attempts: await S.listAttempts(db, { skill: req.query.skill, limit: req.query.limit }) })));
  router.delete('/skills/attempts/:id', h(async (req, db) => S.deleteAttempt(db, req.params.id)));

  router.get('/skills/equipment', h(async (req, db) => ({ ok: true, known: T.KNOWN_EQUIPMENT, ...(await S.getEquipment(db)) })));
  router.put('/skills/equipment', h(async (req, db) => ({ ok: true, ...(await S.changeEquipment(db, (req.body || {}).action || 'set', (req.body || {}).equipment)) })));

  router.get('/plan/week', h(async (req, db) => ({ ok: true, plan: await S.weekPlan(db, new Date(), { equipment: equipmentParam(req) }) })));

  // ── tests ──────────────────────────────────────────────────────────────────
  router.get('/tests/catalog', h(async (req) => ({ ok: true, batteries: F.BATTERIES, items: F.catalog(req.query.battery) })));
  router.get('/tests/info', h(async (req, db) => {
    const info = await S.itemInfoFor(db, req.query.item);
    if (!info) throw Object.assign(new Error('Unknown test item'), { status: 404 });
    return { ok: true, item: info.cat || { id: info.id, name: info.name, unit: info.unit, better: info.better }, trend: await S.trendFor(db, info.id, info.better) };
  }));
  router.post('/tests/results', h(async (req, db) => S.logResult(db, req.body || {})));
  router.get('/tests/results', h(async (req, db) => {
    const info = await S.itemInfoFor(db, req.query.item);
    if (!info) throw Object.assign(new Error('Unknown test item'), { status: 404 });
    return { ok: true, item: info.id, name: info.name, unit: info.unit, results: (await S.resultsFor(db, info.id)).reverse(), trend: await S.trendFor(db, info.id, info.better) };
  }));
  router.delete('/tests/results/:id', h(async (req, db) => S.deleteResult(db, req.params.id)));
  router.get('/tests/trends', h(async (req, db) => ({ ok: true, trends: await S.allTrends(db, { battery: req.query.battery }) })));

  // ── benchmarks (static paths first so ":q" never swallows them) ────────────
  router.get('/benchmarks', h(async (req, db) => ({ ok: true, ...(await S.listBenchmarks(db)) })));
  router.post('/benchmarks', h(async (req, db) => S.addBenchmark(db, req.body || {})));
  router.post('/benchmarks/log', h(async (req, db) => S.logBenchmark(db, req.body || {})));
  router.put('/benchmarks/focus', h(async (req, db) => S.setFocus(db, (req.body || {}).focus)));
  router.put('/benchmarks/day', h(async (req, db) => S.setBenchmarkDay(db, (req.body || {}).day)));
  router.get('/benchmarks/reminder', h(async (req, db) => { await S.seedBenchmarks(db); return { ok: true, reminder: await S.getReminder(db) }; }));
  router.put('/benchmarks/reminder', h(async (req, db) => S.updateReminder(db, req.body || {})));
  router.post('/benchmarks/reminder/ack', h(async (req, db) => S.reminderAck(db, req.body || {})));

  // check: a read that must not CREATE an account's database. A linked chat user
  // who has never touched health has no file, and the sweep runs every tick, so
  // opening one per linked user would litter empty databases.
  router.get('/benchmarks/reminder/check', async (req, res) => {
    try {
      const file = path.join(__dirname, '..', '..', 'data', `${req.serviceUser}_health.sqlite`);
      if (!fs.existsSync(file)) return res.json({ ok: true, action: 'none', reason: 'no data' });
      const now = req.query.now ? new Date(String(req.query.now)) : new Date();
      if (Number.isNaN(now.getTime())) return res.status(400).json({ ok: false, error: 'bad now' });
      const db = await getDB(req);
      res.json({ ok: true, ...(await S.reminderCheck(db, now)) });
    } catch (e) { res.status(e.status || 500).json({ ok: false, error: e.message }); }
  });

  router.patch('/benchmarks/:q', h(async (req, db) => S.updateBenchmark(db, req.params.q, req.body || {})));
  router.delete('/benchmarks/:q', h(async (req, db) => S.removeBenchmark(db, req.params.q)));
  router.post('/benchmarks/:q/move', h(async (req, db) => S.moveBenchmark(db, req.params.q, req.body || {})));
};
