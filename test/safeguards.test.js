'use strict';
/**
 * HIPAA technical safeguards, over real HTTP against the real entrypoint (stub auth): security
 * headers on every answer, no-store for signed-in answers and not for public pages, and the
 * trainer idle logoff leaves a plain account alone.
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
const USERS = {
  'trainer-token': { username: 'sgTrainer', userId: 1, role: 'trainer' },
  'plain-token': { username: 'sgPlain', userId: 2, role: 'user' },
};
const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
function stubAuth() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        const json = (c, b) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
        const url = (req.url || '').split('?')[0];
        if (req.method === 'POST' && url === '/api/auth/verify') {
          const m = /Bearer\s+(\S+)/.exec(req.headers.authorization || '');
          const user = m && USERS[m[1]];
          return json(200, user ? { valid: true, user } : { valid: false });
        }
        if (/\/apps\/[^/]+\/allowed$/.test(url)) return json(200, { allowed: true });
        json(404, {});
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
let auth, child, base, tmp;
before(async () => {
  auth = await stubAuth();
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
  const env = { ...process.env, PORT: String(port), DB_PATH: path.join(tmp, 'x.db'), DATA_DIR: tmp,
    AUTH_SERVICE_URL: `http://127.0.0.1:${auth.address().port}`, AUTH_PUBLIC_URL: 'https://auth.octopustechnology.net', AUTH_REMOTE_VERIFY: '' };
  child = spawn(process.execPath, ['index.js'], { cwd: root, stdio: 'ignore', env });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { if ((await fetch(`${base}/api/build`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 150));
  }
});
after(() => {
  child?.kill('SIGKILL'); auth?.close(); fs.rmSync(tmp, { recursive: true, force: true });
  try { fs.readdirSync(path.join(root, 'data')).filter(f => /^sg(Trainer|Plain)_/.test(f)).forEach(f => fs.rmSync(path.join(root, 'data', f), { force: true })); } catch { /* none */ }
});
const as = t => ({ Cookie: `octopus_sso=${t}` });

test('security headers on liveness, a page, a redirect and a 404', async () => {
  for (const url of ['/api/build', '/health', '/settings', '/definitely-not-here']) {
    const r = await fetch(base + url, { redirect: 'manual' });
    assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff', url);
    assert.strictEqual(r.headers.get('x-frame-options'), 'DENY', url);
    // Express's own 404 page sends its own stricter CSP (default-src 'none'), which also forbids framing.
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'|default-src 'none'/, url);
    assert.strictEqual(r.headers.get('x-powered-by'), null, url);
  }
});

test('a signed-in page is no-store; a signed-out one is not forced to be', async () => {
  const r = await fetch(base + '/settings', { headers: as('plain-token'), redirect: 'manual' });
  assert.strictEqual(r.headers.get('cache-control'), 'no-store');
});

test('trainer gets the idle cookie, a plain account does not', async () => {
  const t = await fetch(base + '/settings', { headers: as('trainer-token'), redirect: 'manual' });
  assert.match(t.headers.get('set-cookie') || '', /^o_idle=/);
  const p = await fetch(base + '/settings', { headers: as('plain-token'), redirect: 'manual' });
  assert.ok(!/o_idle/.test(p.headers.get('set-cookie') || ''));
});
