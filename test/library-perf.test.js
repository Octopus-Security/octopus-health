'use strict';

/**
 * The Exercises page must be usable quickly (HANDOFF: slow on a phone). It used to build ~550 cards and fetch
 * ~290 pose files up front. Now: cards in chunks, a figure fetched only when its card nears the viewport, and
 * pose files cacheable. Real entrypoint over real HTTP, stub auth that signs in two different users.
 *
 * Run: node --test test/library-perf.test.js
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
let stub, child, base, out = '';

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

before(async () => {
  stub = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.includes('/verify')) {
        const tok = String(req.headers.authorization || '').replace('Bearer ', '');
        return res.end(JSON.stringify({ valid: true, user: { username: tok, role: 'user' } }));
      }
      res.end('{}');
    });
  });
  await new Promise(r => stub.listen(0, '127.0.0.1', r));
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libperf-'));
  child = spawn(process.execPath, ['index.js'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(tmp, 'x.db'), DATA_DIR: tmp,
      AUTH_SERVICE_URL: `http://127.0.0.1:${stub.address().port}`, AUTH_REMOTE_VERIFY: '' },
  });
  child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { if ((await fetch(`${base}/api/build`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`server did not start:\n${out.trim() || '(nothing)'}`);
});

after(() => { if (child) child.kill('SIGKILL'); if (stub) stub.close(); });

const page = (user, p = '/exercises') => fetch(base + p, { headers: { Cookie: `octopus_sso=${user}` } });

test('the page builds cards in chunks and mounts figures only near the viewport', async () => {
  const html = await (await page('alice')).text();
  assert.match(html, /const CHUNK = \d+/);
  assert.match(html, /IntersectionObserver/);
  assert.doesNotMatch(html, /setTimeout\(initStickFigures/, 'no eager mount of every figure');
  assert.match(html, /window\.POSE_VERSION = "[^"]+"/, 'pose requests carry the build version');
});

test('the exercise list is the signed-in user\'s own database, not shared between users', async () => {
  const [a, b] = await Promise.all([page('alice'), page('bob')]);
  const grab = async r => JSON.parse(/const ALL_EXERCISES = (\[.*\]);/.exec(await r.text())[1]);
  const la = await grab(a), lb = await grab(b);
  assert.ok(la.length > 100 && lb.length > 100);
  // Add a custom exercise for alice only; bob's list must not gain it.
  const r = await fetch(base + '/api/workout/exercises', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'octopus_sso=alice', Authorization: 'Bearer alice' },
    body: JSON.stringify({ name: 'Alice Only Move', category: 'strength', equipment: 'none' }) });
  assert.ok(r.ok, "custom exercise create " + r.status);
  {
    const la2 = await grab(await page('alice')), lb2 = await grab(await page('bob'));
    assert.ok(la2.some(e => e.name === 'Alice Only Move'));
    assert.ok(!lb2.some(e => e.name === 'Alice Only Move'));
  }
});

test('pose files are cacheable: immutable when versioned, short when bare, 404 when unknown', async () => {
  const v = await fetch(`${base}/poses/back-squat.json?v=abc`);
  assert.strictEqual(v.status, 200);
  assert.match(v.headers.get('cache-control'), /immutable/);
  assert.match(v.headers.get('cache-control'), /max-age=31536000/);
  const bare = await fetch(`${base}/poses/back-squat.json`);
  assert.strictEqual(bare.status, 200);
  assert.match(bare.headers.get('cache-control'), /max-age=300/);
  assert.doesNotMatch(bare.headers.get('cache-control'), /immutable/);
  assert.strictEqual((await fetch(`${base}/poses/no-such-pose-xyz.json?v=abc`)).status, 404);
});

test('stick-figure.js passes the version on pose fetches', () => {
  const src = fs.readFileSync(path.join(root, 'public', 'stick-figure.js'), 'utf8');
  assert.match(src, /window\.POSE_VERSION \? '\?v='/);
});
