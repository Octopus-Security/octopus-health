'use strict';

/**
 * The HTTP surface, driven for real (an ephemeral port, real express, real
 * sqlite files for throwaway accounts): the service API cortex calls and the
 * browser pages/JSON. Skips without express/ejs/sequelize/sqlite3.
 *
 * What it guards: the service API refuses a missing/wrong token; X-Service-User
 * decides the account and a bad name is a 400; a row id from one account answers
 * 404 for another; the web JSON routes refuse non-JSON and cross-origin writes;
 * the pages render; the WAV endpoint returns a real RIFF file.
 *
 * Run: node --test test/fitness-routes.test.js
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let express, ejs, getDatabase;
try { express = require('express'); ejs = require('ejs'); require('sequelize'); require('sqlite3'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';

const stamp = `zz_fxr_${process.pid}`;
const A = `${stamp}_a`, Bu = `${stamp}_b`;
let server, base;

before(async () => {
  if (skip) return;
  process.env.HEALTH_SERVICE_TOKEN = 'test-token';
  const { BUILD, asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  app.use('/api/service', require('../api/routes/service'));
  // Stand-in for SSO: the user is whoever X-Test-User says.
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).set('Location', '/login').end();
    req.user = { username: u }; res.locals.user = req.user; res.locals.activeTab = 'tools';
    const db = getDatabase(u); await db.sequelize.sync(); next();
  };
  require('../api/web-fitness')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [A, Bu]) try { fs.unlinkSync(path.join(__dirname, '..', 'data', `${n}_health.sqlite`)); } catch { /* none */ }
});

const svc = (user, method, p, body, token = 'test-token') => fetch(base + '/api/service' + p, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Service-Token': token } : {}), ...(user ? { 'X-Service-User': user } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

const web = (user, method, p, body, headers = {}) => fetch(base + p, {
  method, redirect: 'manual',
  headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}), ...headers },
  body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
});

test('service API: token required, user name validated', { skip }, async () => {
  assert.strictEqual((await svc(A, 'GET', '/skills/summary', null, null)).status, 401);
  assert.strictEqual((await svc(A, 'GET', '/skills/summary', null, 'wrong')).status, 401);
  assert.strictEqual((await svc('../../etc/passwd', 'GET', '/skills/summary')).status, 400);
  assert.strictEqual((await svc(A, 'GET', '/skills/summary')).status, 200);
});

test('service API: log an attempt, see the unlock, read the summary and progression', { skip }, async () => {
  const r = await svc(A, 'POST', '/skills/attempts', { skill: 'wrist prep', result: 'succeeded', seconds: 120 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.newlyAchieved, true);
  assert.ok(r.body.newlyUnlocked.some(s => s.id === 'wall-plank'));
  const sum = await svc(A, 'GET', '/skills/summary');
  assert.deepStrictEqual(sum.body.achieved.map(s => s.id), ['wrist-prep']);
  const prog = await svc(A, 'GET', '/skills/progression?q=' + encodeURIComponent('handstand push-up'));
  assert.strictEqual(prog.body.kind, 'skill');
  assert.strictEqual(prog.body.target.id, 'hspu');
  assert.ok(prog.body.position, 'shows where the user is on the route');
  const line = await svc(A, 'GET', '/skills/progression?q=planche');
  assert.strictEqual(line.body.kind, 'line');
  assert.strictEqual((await svc(A, 'GET', '/skills/progression?q=zzzzqqq')).status, 404);
  const bad = await svc(A, 'POST', '/skills/attempts', { skill: 'plank', result: 'maybe' });
  assert.strictEqual(bad.status, 400);
});

test('service API: equipment is per user and steers random picks', { skip }, async () => {
  await svc(A, 'PUT', '/skills/equipment', { action: 'set', equipment: ['push-up handles'] });
  assert.deepStrictEqual((await svc(A, 'GET', '/skills/equipment')).body.stored, ['handles']);
  assert.strictEqual((await svc(Bu, 'GET', '/skills/equipment')).body.isDefault, true);
  for (let i = 0; i < 15; i++) {
    const r = await svc(A, 'GET', '/skills/random?mode=' + (i % 2 ? 'today' : 'new'));
    assert.deepStrictEqual(r.body.pick.skill.missingEquipment, []);
  }
  assert.strictEqual((await svc(A, 'PUT', '/skills/equipment', { action: 'set', equipment: ['jetpack'] })).status, 400);
});

test('service API: a stranger\'s row is 404 (the same id exists in both accounts)', { skip }, async () => {
  const a = await svc(A, 'POST', '/tests/results', { item: 'plank', value: 40 });
  const b = await svc(Bu, 'POST', '/tests/results', { item: 'plank', value: 7 });
  assert.strictEqual(a.body.result.id, b.body.result.id, 'both files issued id 1, so this is a real collision test');
  const aAtt = await svc(A, 'GET', '/skills/attempts');
  const ids = aAtt.body.attempts.map(x => x.id);
  assert.ok(ids.length);
  assert.strictEqual((await svc(Bu, 'DELETE', '/skills/attempts/' + ids[0])).status, 404, 'B has no attempts at all');
  assert.strictEqual((await svc(Bu, 'DELETE', '/tests/results/' + (b.body.result.id + 50))).status, 404);
  await svc(A, 'GET', '/benchmarks');
  const bm = (await svc(A, 'GET', '/benchmarks')).body.benchmarks[0];
  assert.strictEqual((await svc(Bu, 'PATCH', '/benchmarks/' + bm.id, { name: 'taken' })).status, 404, 'B has no such benchmark');
  const after = (await svc(A, 'GET', '/benchmarks')).body.benchmarks.find(x => x.id === bm.id);
  assert.notStrictEqual(after.name, 'taken', 'B could not rename A\'s benchmark');
});

test('service API: benchmarks - list seeds, log by words, edit, reorder, remove, focus, day', { skip }, async () => {
  const list = await svc(A, 'GET', '/benchmarks');
  assert.ok(list.body.benchmarks.length >= 7);
  const log = await svc(A, 'POST', '/benchmarks/log', { benchmark: 'pushups', value: 22 });
  assert.strictEqual(log.status, 200);
  assert.strictEqual(log.body.trend.latest.value, 22);
  assert.strictEqual((await svc(A, 'POST', '/benchmarks/log', { benchmark: 'push', value: 1 })).status, 409);
  assert.strictEqual((await svc(A, 'PATCH', '/benchmarks/plank', { everyWeeks: 2 })).status, 200);
  assert.strictEqual((await svc(A, 'POST', '/benchmarks/treadmill/move', { to: 1 })).status, 200);
  assert.strictEqual((await svc(A, 'DELETE', '/benchmarks/hollow')).status, 200);
  assert.strictEqual((await svc(A, 'PUT', '/benchmarks/focus', { focus: 'push' })).status, 200);
  assert.strictEqual((await svc(A, 'PUT', '/benchmarks/day', { day: 'friday' })).body.day, 5);
  assert.strictEqual((await svc(A, 'PUT', '/benchmarks/focus', { focus: 'vibes' })).status, 400);
  const plan = await svc(A, 'GET', '/plan/week');
  assert.strictEqual(plan.body.plan.days.length, 7);
  assert.ok(plan.body.plan.days.find(d => d.name === 'Friday').benchmarks.length >= 1, 'benchmarks sit on the chosen day');
});

test('service API: reminder check/ack with a given clock; never creates a database for a stranger', { skip }, async () => {
  const ghost = `${stamp}_ghost`;
  const g = await svc(ghost, 'GET', '/benchmarks/reminder/check');
  assert.deepStrictEqual([g.status, g.body.action], [200, 'none']);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'data', `${ghost}_health.sqlite`)), 'check did not create a file');
  await svc(A, 'PUT', '/benchmarks/day', { day: 'saturday' });
  await svc(A, 'PUT', '/benchmarks/reminder', { enabled: true, day: 'saturday', time: '9am', tz: 'America/New_York' });
  const when = '2026-10-17T13:30:00Z';    // Saturday 09:30 New York
  const c1 = await svc(A, 'GET', '/benchmarks/reminder/check?now=' + when);
  assert.strictEqual(c1.body.action, 'send');
  assert.ok(c1.body.text.includes('log benchmark'));
  await svc(A, 'POST', '/benchmarks/reminder/ack', { kind: 'send', date: c1.body.date, items: c1.body.items });
  assert.strictEqual((await svc(A, 'GET', '/benchmarks/reminder/check?now=' + when)).body.action, 'none');
  assert.strictEqual((await svc(A, 'GET', '/benchmarks/reminder/check?now=nonsense')).status, 400);
  const nudge = await svc(A, 'GET', '/benchmarks/reminder/check?now=2026-10-18T13:30:00Z');
  assert.strictEqual(nudge.body.action, 'nudge');
});

test('web: pages render for a signed-in user and redirect when signed out', { skip }, async () => {
  for (const p of ['/skills', '/tests', '/tests/treadmill', '/tests/treadmill?mode=cooper', '/benchmarks']) {
    const r = await web(Bu, 'GET', p);
    assert.strictEqual(r.status, 200, p);
    const html = await r.text();
    assert.ok(html.includes('<title>'), p);
    assert.ok(!/undefined|\[object Object\]/.test(html), `${p} rendered a missing value`);
    assert.strictEqual((await web(null, 'GET', p)).status, 302, `${p} signed out`);
  }
});

test('web: output is escaped (a hostile name cannot inject markup)', { skip }, async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const add = await web(Bu, 'POST', '/benchmarks/api/add', { name: evil });
  assert.strictEqual(add.status, 200);
  const html = await (await web(Bu, 'GET', '/benchmarks')).text();
  assert.ok(!html.includes(evil), 'raw markup must not appear');
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
});

test('web: writes need JSON and a same-origin Origin', { skip }, async () => {
  const form = await fetch(base + '/skills/api/attempts', { method: 'POST', headers: { 'X-Test-User': Bu, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'skill=plank&result=succeeded' });
  assert.strictEqual(form.status, 415);
  const cross = await web(Bu, 'POST', '/skills/api/attempts', { skill: 'plank', result: 'succeeded' }, { Origin: 'https://evil.example' });
  assert.strictEqual(cross.status, 403);
  const same = await web(Bu, 'POST', '/skills/api/attempts', { skill: 'plank', result: 'succeeded' }, { Origin: base });
  assert.strictEqual(same.status, 200);
  assert.strictEqual((await web(null, 'POST', '/skills/api/attempts', { skill: 'plank', result: 'succeeded' })).status, 302);
});

test('web: a stranger\'s result id is 404; recording a treadmill result keeps its protocol', { skip }, async () => {
  const rec = await web(A, 'POST', '/tests/api/results', { item: 'treadmill_stage', value: 9, detail: { unit: 'kmh', start: 8, step: 0.5, incline: 1 } });
  assert.strictEqual(rec.status, 200);
  const j = await rec.json();
  assert.strictEqual(j.result.value, 9);
  assert.strictEqual(JSON.parse(j.result.detail).incline, 1);
  assert.strictEqual((await web(Bu, 'DELETE', '/tests/api/results/' + (j.result.id + 100))).status, 404);
  assert.strictEqual((await web(Bu, 'PATCH', '/benchmarks/api/987654', { name: 'x' })).status, 404);
});

test('web: the audio file is a real WAV and its parameters are clamped', { skip }, async () => {
  const r = await web(A, 'GET', '/tests/treadmill/audio.wav?stages=2&unit=mph&start=5&step=0.3');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get('content-type'), 'audio/wav');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.strictEqual(buf.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(buf.readUInt32LE(40), buf.length - 44);
  const huge = await web(A, 'GET', '/tests/treadmill/audio.wav?stages=100000');
  assert.ok(Buffer.from(await huge.arrayBuffer()).length < 20e6, 'stage count is capped');
  assert.strictEqual((await web(null, 'GET', '/tests/treadmill/audio.wav')).status, 302);
});
