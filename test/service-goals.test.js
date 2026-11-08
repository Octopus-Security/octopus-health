'use strict';

/**
 * GET /api/service/goals?active=1 — a goal past its deadline is not active.
 *
 * "Active" used to mean only "not completed", so a dated goal whose day had gone
 * (a superfight taper that ended 2026-09-29) was still listed under "Working
 * toward" in every morning brief a month later, and injected into the coaching
 * context on every message. Tested at the route, with a positive control: the
 * expired goal is still returned without ?active, so nothing is hidden or lost.
 *
 * Run: node --test test/service-goals.test.js
 */

require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, getDatabase;
try { express = require('express'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

const user = `zz_goals_${process.pid}`;
let server, base;
before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${user}_health.sqlite`)); } catch { /* not created */ }
});

const svc = (method, p, body) => fetch(base + '/api/service' + p, {
  method,
  headers: { 'Content-Type': 'application/json', 'X-Service-Token': 'test-token', 'X-Service-User': user },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const etDay = (offsetDays) => new Date(Date.now() + offsetDays * 86400000)
  .toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

test('a goal past its deadline is not active; undated, today and future ones are', { skip }, async () => {
  for (const [title, deadline] of [['Superfight taper', etDay(-27)], ['Due today', etDay(0)], ['Next month', etDay(30)], ['Handstand', null]]) {
    const r = await svc('POST', '/goals', { title, deadline });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  }
  const done = await svc('POST', '/goals', { title: 'Finished thing' });
  await svc('PATCH', `/goals/${done.body.goal.id}`, { completed: true });

  const active = await svc('GET', '/goals?active=1');
  assert.deepStrictEqual(active.body.goals.map(g => g.title).sort(), ['Due today', 'Handstand', 'Next month']);

  // positive control: nothing is deleted, the full list still has the expired and the completed goal
  const all = await svc('GET', '/goals');
  assert.deepStrictEqual(all.body.goals.map(g => g.title).sort(),
    ['Due today', 'Finished thing', 'Handstand', 'Next month', 'Superfight taper']);
});
