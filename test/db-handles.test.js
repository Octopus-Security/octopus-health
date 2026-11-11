'use strict';
/**
 * getDatabase() memoises one handle per database FILE, closes evicted ones, never lets one account's
 * handle serve another, applies the sqlite pragmas, creates the indexes, and ensure() is the single
 * "tables exist" step that the API and service routes rely on now that they no longer sync() per call.
 * Also: the SSO verify cache (bounded, short negative cache only for a DEFINITE rejection, deduped) and
 * the app gate's in-flight dedupe.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let getDatabase, express;
try { require('sequelize'); require('sqlite3'); express = require('express'); getDatabase = require('../database'); } catch { /* skipped */ }
const skip = !getDatabase && 'express/sequelize/sqlite3 not installed on this machine';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'health-handles-'));
process.env.DATA_DIR = tmp;
const stamp = `zz_h_${process.pid}`;
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

test('the same account gets the same handle; different accounts never share one', { skip }, async () => {
  const a1 = getDatabase(`${stamp}_alice`), a2 = getDatabase(`${stamp}_alice`), b = getDatabase(`${stamp}_bob`);
  assert.strictEqual(a1, a2);
  assert.notStrictEqual(a1, b);
  assert.notStrictEqual(a1.sequelize, b.sequelize);
  await a1.ensureSeeded(); await b.ensureSeeded();
  await a1.WeightEntry.create({ weight: 150, unit: 'lbs' });
  assert.strictEqual(await a1.WeightEntry.count(), 1);
  assert.strictEqual(await getDatabase(`${stamp}_bob`).WeightEntry.count(), 0, "bob never sees alice's row");
  assert.notStrictEqual(a1.sequelize.options.storage, b.sequelize.options.storage);
});

test('ensure() is shared by concurrent callers and creates tables, indexes and (ensureSeeded) the catalogue', { skip }, async () => {
  const h = getDatabase(`${stamp}_ens`);
  const [p1, p2] = [h.ensure(), h.ensure()];
  assert.strictEqual(p1, p2, 'one in-flight ensure');
  await p1;
  const idx = (await h.sequelize.query("SELECT name FROM sqlite_master WHERE type='index'", { type: 'SELECT' })).map(r => r.name);
  for (const n of ['WorkoutSets_sessionId', 'WorkoutSets_exerciseName', 'WorkoutSessions_date', 'WorkoutSessions_status',
                   'Exercises_date', 'Meals_date', 'WeightEntries_date']) {
    assert.ok(idx.includes(`idx_${n}`), `index idx_${n} exists`);
  }
  await h.migrate();   // rerun is a no-op
  assert.strictEqual(await h.ExerciseDefinition.count(), 0, 'ensure() alone does not seed (service path)');
  await h.ensureSeeded();
  assert.ok(await h.ExerciseDefinition.count() > 100, 'ensureSeeded seeds');
});

test('pragmas: WAL, busy_timeout and synchronous=NORMAL on the connection (and on a transaction connection)', { skip }, async () => {
  const h = getDatabase(`${stamp}_prag`); await h.ensure();
  const one = async (q, opts) => (await h.sequelize.query(q, { type: 'SELECT', ...opts }))[0];
  assert.strictEqual((await one('PRAGMA journal_mode')).journal_mode, 'wal');
  assert.strictEqual((await one('PRAGMA busy_timeout')).timeout, 5000);
  assert.strictEqual((await one('PRAGMA synchronous')).synchronous, 1);
  await h.sequelize.transaction(async (t) => {
    assert.strictEqual((await one('PRAGMA busy_timeout', { transaction: t })).timeout, 5000, 'per-transaction connection too');
  });
});

test('LRU eviction closes the evicted handle after the grace period; the survivor stays open', { skip }, async () => {
  const cache = getDatabase._cache;
  const prevMax = process.env.HEALTH_DB_CACHE_MAX, prevDelay = process.env.HEALTH_DB_CLOSE_DELAY_MS;
  // DB_CACHE_MAX is read at load time, so exercise the same path by shrinking the live cache.
  const sub = fs.mkdtempSync(path.join(tmp, 'evict-')); const was = process.env.DATA_DIR; process.env.DATA_DIR = sub;
  process.env.HEALTH_DB_CLOSE_DELAY_MS = '10';
  try {
    for (const k of [...cache.keys()]) cache.delete(k);
    const first = getDatabase(`${stamp}_e0`); await first.ensure();
    let closed = false; const realClose = first.sequelize.close.bind(first.sequelize);
    first.sequelize.close = () => { closed = true; return realClose(); };
    const keep = [];
    for (let i = 1; i <= getDatabase.DB_CACHE_MAX; i++) keep.push(getDatabase(`${stamp}_e${i}`));
    assert.strictEqual(cache.size, getDatabase.DB_CACHE_MAX, 'cache is capped');
    assert.ok(!cache.has(first.sequelize.options.storage), 'oldest was evicted');
    assert.strictEqual(closed, false, 'not closed synchronously (an in-flight request keeps working)');
    await first.WeightEntry.count();            // still usable during the grace period
    await new Promise(r => setTimeout(r, 80));
    assert.strictEqual(closed, true, 'closed after the grace period');
    assert.strictEqual(getDatabase(`${stamp}_e${getDatabase.DB_CACHE_MAX}`), keep[keep.length - 1], 'newest survives');
    const again = getDatabase(`${stamp}_e0`); await again.ensure();   // evicted account simply gets a fresh handle
    assert.notStrictEqual(again, first);
  } finally {
    process.env.DATA_DIR = was;
    if (prevMax === undefined) delete process.env.HEALTH_DB_CACHE_MAX; else process.env.HEALTH_DB_CACHE_MAX = prevMax;
    if (prevDelay === undefined) delete process.env.HEALTH_DB_CLOSE_DELAY_MS; else process.env.HEALTH_DB_CLOSE_DELAY_MS = prevDelay;
    for (const k of [...cache.keys()]) { const h = cache.get(k); cache.delete(k); h.sequelize.close().catch(() => {}); }
  }
});

test('a database file that vanished is not served from a stale handle', { skip }, async () => {
  const u = `${stamp}_gone`; const h = getDatabase(u); await h.ensure();
  fs.rmSync(path.join(tmp, `${u}_health.sqlite`), { force: true });
  for (const x of ['-wal', '-shm']) fs.rmSync(path.join(tmp, `${u}_health.sqlite${x}`), { force: true });
  const h2 = getDatabase(u);
  assert.notStrictEqual(h2, h);
  await h2.ensure();
  assert.strictEqual(await h2.WeightEntry.count(), 0);
});

test('API route for an account with NO database file creates it (bearer/cookie API path has no requireLogin)', { skip }, async () => {
  const u = `${stamp}_apionly`;
  assert.ok(!fs.existsSync(path.join(tmp, `${u}_health.sqlite`)));
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { username: u }; next(); });   // what index.js's cookie middleware sets
  app.use('/api/workout', require('../api/routes/workout'));
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/workout/sessions`);
    const body = await r.json();
    assert.strictEqual(r.status, 200, JSON.stringify(body));
    assert.strictEqual(body.success, true);
    assert.ok(fs.existsSync(path.join(tmp, `${u}_health.sqlite`)));
  } finally { server.close(); }
});

// ── verify cache ───────────────────────────────────────────────────────────
const { createVerifyCache } = require('../lib/verify-cache');
const httpErr = (status) => Object.assign(new Error('http ' + status), { response: { status } });

test('verify cache: positive answers cached; dedupes concurrent lookups', async () => {
  let n = 0;
  const v = createVerifyCache({ call: async () => { n++; await new Promise(r => setTimeout(r, 10)); return { valid: true, user: { username: 'a' } }; } });
  const [x, y] = await Promise.all([v('t'), v('t')]);
  assert.deepStrictEqual([x.username, y.username, n], ['a', 'a', 1]);
  await v('t'); assert.strictEqual(n, 1);
});

test('verify cache: a definite rejection is negative-cached briefly, then asked again', async () => {
  let n = 0, t = 1000;
  const v = createVerifyCache({ negTtl: 30000, now: () => t, call: async () => { n++; if (n === 1) return { valid: false }; if (n === 2) throw httpErr(401); return { valid: true, user: { username: 'a' } }; } });
  assert.strictEqual(await v('bad'), null); assert.strictEqual(await v('bad'), null); assert.strictEqual(n, 1);
  t += 31000; assert.strictEqual(await v('bad'), null); assert.strictEqual(n, 2);   // 401 cached too
  assert.strictEqual(await v('bad'), null); assert.strictEqual(n, 2);
  t += 31000; assert.strictEqual((await v('bad')).username, 'a');
});

test('verify cache: timeout, network error and 5xx are NEVER cached — an auth blip does not lock users out', async () => {
  let n = 0;
  const v = createVerifyCache({ call: async () => {
    n++;
    if (n === 1) throw httpErr(500);
    if (n === 2) throw Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' });
    if (n === 3) return {};                       // odd body: not a definite rejection
    return { valid: true, user: { username: 'a' } };
  } });
  assert.strictEqual(await v('t'), null); assert.strictEqual(await v('t'), null); assert.strictEqual(await v('t'), null);
  assert.strictEqual(n, 3, 'every failed attempt went back to auth');
  assert.strictEqual((await v('t')).username, 'a', 'recovers on the very next request');
});

test('verify cache: bounded (LRU) and expired entries are refreshed', async () => {
  let n = 0, t = 0;
  const v = createVerifyCache({ max: 3, ttl: 1000, now: () => t, call: async (tok) => { n++; return { valid: true, user: { username: tok } }; } });
  for (const k of ['a', 'b', 'c', 'd', 'e']) await v(k);
  assert.strictEqual(v.size(), 3);
  n = 0; await v('a'); assert.strictEqual(n, 1, 'evicted entry is re-asked');
  n = 0; t += 2000; await v('a'); assert.strictEqual(n, 1, 'expired entry is re-asked');
});

// ── app gate ───────────────────────────────────────────────────────────────
test('app gate: concurrent checks for one user share one request, and the request carries a timeout signal', async () => {
  const { createAppGate } = require('../appAccess');
  let calls = 0, sawSignal = false;
  const gate = createAppGate({ authUrl: 'http://auth', slug: 'health', fetchImpl: async (_u, o) => { calls++; sawSignal = !!o.signal; await new Promise(r => setTimeout(r, 10)); return { ok: true, status: 200, json: async () => ({ allowed: true }) }; } });
  const req = { user: { username: 'u' }, get: () => undefined, originalUrl: '/' };
  const run = () => new Promise((resolve, reject) => gate(req, { status() { reject(new Error('denied')); return this; } }, (e) => (e ? reject(e) : resolve('next'))));
  assert.deepStrictEqual(await Promise.all([run(), run(), run()]), ['next', 'next', 'next']);
  assert.strictEqual(calls, 1); assert.ok(sawSignal);
});
