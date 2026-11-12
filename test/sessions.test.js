'use strict';

/**
 * Shareable sessions: ownership, the three visibilities, link revocation, and the privacy rule
 * that nothing from the private tailoring block ever reaches a public page.
 *
 * Over real HTTP against the REAL entrypoint (index.js) with a stub octopus-auth, so middleware
 * order is under test: the public routes must answer with no cookie at all, before the login and
 * app-access gates. Seeding goes through the real authoring API as the admin.
 *
 * Run: node --test test/sessions.test.js
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
  'admin-token': { username: 'sessAdmin', userId: 1, role: 'admin' },
  'other-token': { username: 'sessOther', userId: 2, role: 'user' },
};
const MARK = 'ZZPRIVATEMARKERZZ';

const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});
function startStubAuth() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      req.resume();
      req.on('end', () => {
        const url = (req.url || '').split('?')[0];
        const json = (code, b) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)); };
        if (req.method === 'POST' && url === '/api/auth/verify') {
          const m = /Bearer\s+(\S+)/.exec(req.headers.authorization || '');
          const user = m && USERS[m[1]];
          return json(200, user ? { valid: true, user } : { valid: false });
        }
        if (/^\/api\/auth\/apps\/[^/]+\/allowed$/.test(url)) return json(200, { allowed: true });
        json(404, {});
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}
async function startApp(authBase, extraEnv = {}) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-'));
  const env = { ...process.env, PORT: String(port), DATA_DIR: tmp, AUTH_SERVICE_URL: authBase, AUTH_PUBLIC_URL: 'https://auth.example.test', AUTH_REMOTE_VERIFY: '', ROLE_CACHE_MS: '150', ...extraEnv };
  const child = spawn(process.execPath, ['index.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { if ((await fetch(`${base}/api/build`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 150));
  }
  if (!(await fetch(`${base}/api/build`).then(r => r.ok, () => false))) { child.kill('SIGKILL'); throw new Error('server did not start:\n' + out.trim()); }
  return { base, tmp, stop() { child.kill('SIGKILL'); fs.rmSync(tmp, { recursive: true, force: true }); } };
}

const as = (t) => ({ Cookie: `octopus_sso=${t}` });
let auth, app;
const J = { 'Content-Type': 'application/json' };
async function api(method, url, token, body) {
  const r = await fetch(app.base + url, { method, headers: { ...J, ...(token ? as(token) : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  return { status: r.status, body: j };
}
const get = (url, token) => fetch(app.base + url, { headers: token ? as(token) : {}, redirect: 'manual' });

const sessionBody = () => ({
  title: 'Hip mobility basics',
  intro: 'A gentle start.',
  items: [
    { type: 'exercise', ref: 'exercise:1', name: 'Push-up', poseKey: 'push-up', cues: ['Ribs down'], instructions: 'Lower under control.', dose: '3 x 8', note: 'Go slow <b>today</b>' },
    { type: 'mma', ref: 'mma:boxing-jab', name: 'Jab', poseKey: 'mma/boxing-jab', cues: [], instructions: '', dose: '', note: '' },
  ],
  tailoring: { forName: `${MARK}-name`, goal: `${MARK}-goal`, limitsNote: `${MARK}-limits`, focus: ['glutes'], limits: ['knee'], equipment: ['dumbbells'] },
});

before(async () => { auth = await startStubAuth(); app = await startApp(`http://127.0.0.1:${auth.address().port}`); });
after(() => { app?.stop(); auth?.close(); });

test('a new session is PRIVATE by default and has a long random token', async () => {
  const r = await api('POST', '/sessions/api', 'admin-token', sessionBody());
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.session.visibility, 'private');
  assert.strictEqual(r.body.session.slug, null);
  // 24 random bytes = 192 bits, base64url = 32 characters, comfortably over the 128-bit minimum
  assert.match(r.body.session.token, /^[A-Za-z0-9_-]{32}$/);
  const r2 = await api('POST', '/sessions/api', 'admin-token', {});
  assert.notStrictEqual(r2.body.session.token, r.body.session.token);
});

test('anonymous and other accounts get nothing on a private session (404, never 403)', async () => {
  const mine = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  assert.strictEqual((await get('/s/' + mine.token)).status, 404, 'anonymous, by token');
  assert.strictEqual((await get('/s/' + mine.slug)).status, 404);
  // a signed-in user who is not an admin: every authoring route is 404
  for (const [m, u] of [['GET', '/sessions'], ['GET', `/sessions/${mine.id}`], ['GET', '/sessions/api/list'], ['GET', '/sessions/api/library']]) {
    const r = await fetch(app.base + u, { method: m, headers: as('other-token'), redirect: 'manual' });
    assert.strictEqual(r.status, 404, `${m} ${u} for a non-admin`);
  }
  for (const [m, u, b] of [['PUT', `/sessions/api/${mine.id}`, { title: 'x' }], ['POST', `/sessions/api/${mine.id}/visibility`, { visibility: 'public' }], ['DELETE', `/sessions/api/${mine.id}`], ['POST', '/sessions/api', {}]]) {
    assert.strictEqual((await api(m, u, 'other-token', b)).status, 404, `${m} ${u} for a non-admin`);
  }
  // anonymous authoring is bounced to login, not served
  const anon = await get('/sessions');
  assert.strictEqual(anon.status, 302);
  assert.match(anon.headers.get('location'), /\/login\?redirect=/);
  // and the owner's session is untouched
  const again = await api('GET', '/sessions/api/list', 'admin-token');
  assert.ok(again.body.sessions.some(s => s.id === mine.id && s.title === 'Hip mobility basics'));
});

test('a second ADMIN account still cannot see or change the first one\'s session', async () => {
  USERS['admin2-token'] = { username: 'sessAdmin2', userId: 3, role: 'admin' };
  const mine = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  assert.strictEqual((await api('PUT', `/sessions/api/${mine.id}`, 'admin2-token', { title: 'hijack' })).status, 404);
  assert.strictEqual((await api('POST', `/sessions/api/${mine.id}/visibility`, 'admin2-token', { visibility: 'public' })).status, 404);
  assert.strictEqual((await api('DELETE', `/sessions/api/${mine.id}`, 'admin2-token')).status, 404);
  assert.strictEqual((await get(`/sessions/${mine.id}`, 'admin2-token')).status, 404);
  const list = await api('GET', '/sessions/api/list', 'admin2-token');
  assert.deepStrictEqual(list.body.sessions, []);
});

test('unlisted: reachable only by token, noindex, no-referrer, not in the storefront or sitemap', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  const v = await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  assert.strictEqual(v.body.session.visibility, 'unlisted');
  const page = await get('/s/' + s.token);   // no cookie at all
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.strictEqual(page.headers.get('referrer-policy'), 'no-referrer');
  assert.match(page.headers.get('cache-control'), /no-store/);
  const html = await page.text();
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.match(html, /Hip mobility basics/);
  const list = await (await get('/s')).text();
  assert.doesNotMatch(list, /Hip mobility basics/);
  const map = await (await get('/s/sitemap.xml')).text();
  assert.ok(!map.includes(s.token));
});

test('revoking: setting a session back to private makes its link 404 at once; a new link kills the old one', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  assert.strictEqual((await get('/s/' + s.token)).status, 200);
  const rot = await api('POST', `/sessions/api/${s.id}/rotate-link`, 'admin-token');
  assert.notStrictEqual(rot.body.session.token, s.token);
  assert.strictEqual((await get('/s/' + s.token)).status, 404, 'old link dead after rotation');
  assert.strictEqual((await get('/s/' + rot.body.session.token)).status, 200);
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'private' });
  assert.strictEqual((await get('/s/' + rot.body.session.token)).status, 404, 'private again');
  // deleting also ends it
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  await api('DELETE', `/sessions/api/${s.id}`, 'admin-token');
  assert.strictEqual((await get('/s/' + rot.body.session.token)).status, 404);
});

test('public: in the storefront and the sitemap, by slug, with a canonical link and no noindex', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', { ...sessionBody(), title: 'Public Pull Day' })).body.session;
  const v = (await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'public' })).body.session;
  assert.match(v.slug, /^public-pull-day-[0-9a-f]{6}$/);
  const store = await get('/s');
  assert.strictEqual(store.status, 200);
  assert.strictEqual(store.headers.get('referrer-policy'), 'no-referrer');
  const storeHtml = await store.text();
  assert.match(storeHtml, /Public Pull Day/);
  assert.match(storeHtml, new RegExp(`href="/s/${v.slug}"`));
  assert.doesNotMatch(storeHtml, /Hip mobility basics/, 'private/unlisted sessions are not listed');
  const page = await get('/s/' + v.slug);
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.headers.get('x-robots-tag'), null);
  assert.match(await page.text(), /rel="canonical" href="[^"]*\/s\/public-pull-day-/);
  const map = await get('/s/sitemap.xml');
  assert.match(map.headers.get('content-type'), /xml/);
  assert.match(await map.text(), new RegExp(`/s/${v.slug}`));
  // the token of a public session redirects to its public address
  const viaToken = await get('/s/' + s.token);
  assert.strictEqual(viaToken.status, 302);
  assert.strictEqual(viaToken.headers.get('location'), '/s/' + v.slug);
  // back to private: gone from the list, the sitemap and both addresses
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'private' });
  assert.strictEqual((await get('/s/' + v.slug)).status, 404);
  assert.doesNotMatch(await (await get('/s')).text(), /Public Pull Day/);
  assert.doesNotMatch(await (await get('/s/sitemap.xml')).text(), new RegExp(v.slug));
});

test('PRIVACY: nothing from the tailoring block appears in any public or unlisted output', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  // the owner's editor does hold it (that is where it is written) ...
  assert.ok((await (await get(`/sessions/${s.id}`, 'admin-token')).text()).includes(MARK));
  // ... and no public rendering does, for the same session in either visibility
  const check = async (url) => {
    const r = await get(url);
    assert.strictEqual(r.status, 200, url);
    const body = await r.text();
    for (const h of [...r.headers.values()]) assert.ok(!h.includes(MARK), 'header leak');
    assert.ok(!body.includes(MARK), `${url} leaked the tailoring marker`);
    for (const word of ['sessAdmin', 'forName', 'limitsNote', 'tailoring', '"owner"']) assert.ok(!body.includes(word), `${url} contains ${word}`);
  };
  await check('/s/' + s.token);
  const pub = (await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'public' })).body.session;
  await check('/s/' + pub.slug);
  await check('/s');
  await check('/s/sitemap.xml');
});

test('user text is escaped on the public page', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', { ...sessionBody(), title: '<script>alert(1)</script>', intro: '"><img src=x onerror=alert(2)>' })).body.session;
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  const html = await (await get('/s/' + s.token)).text();
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>today</b>'), 'item note is escaped');
  assert.match(html, /&lt;script&gt;alert\(1\)/);
});

test('the public page draws a figure server-side, and snapshots survive the library changing', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'unlisted' });
  const html = await (await get('/s/' + s.token)).text();
  assert.ok((html.match(/<svg /g) || []).length >= 4, 'still frames are rendered without JavaScript');
  assert.match(html, /data-pose="mma\/boxing-jab"/);
  assert.match(html, /Ribs down/);
  assert.match(html, /Visible|Shared by Serpopard/);
  assert.match(html, /general information, not medical advice/i);
  const st = JSON.stringify(s.items);
  assert.ok(st.includes('"poseKey":"push-up"') && st.includes('Ribs down'), 'cues and pose key are stored on the item itself');
});

test('a pose key that is not a real file is dropped on save (no path tricks reach a URL)', async () => {
  const body = sessionBody();
  body.items[0].poseKey = '../../etc/passwd'; body.items[1].poseKey = 'does-not-exist';
  const s = (await api('POST', '/sessions/api', 'admin-token', body)).body.session;
  assert.deepStrictEqual(s.items.map(i => i.poseKey), [null, null]);
});

test('visibility must be one of the three values', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', {})).body.session;
  assert.strictEqual((await api('POST', `/sessions/api/${s.id}/visibility`, 'admin-token', { visibility: 'members' })).status, 400);
});

test('state-changing authoring routes refuse non-JSON and cross-origin requests', async () => {
  const r1 = await fetch(app.base + '/sessions/api', { method: 'POST', headers: { ...as('admin-token'), 'Content-Type': 'text/plain' }, body: '{}' });
  assert.strictEqual(r1.status, 415);
  const r2 = await fetch(app.base + '/sessions/api', { method: 'POST', headers: { ...as('admin-token'), ...J, Origin: 'https://evil.example' }, body: '{}' });
  assert.strictEqual(r2.status, 403);
});

test('the editor page renders for the admin, with the nav link, and the list page too', async () => {
  const s = (await api('POST', '/sessions/api', 'admin-token', sessionBody())).body.session;
  const edit = await (await get(`/sessions/${s.id}`, 'admin-token')).text();
  assert.match(edit, /shown to whoever has the link/i);
  assert.match(edit, /href="\/sessions"/);
  const list = await get('/sessions', 'admin-token');
  assert.strictEqual(list.status, 200);
  const other = await get('/', 'other-token');
  assert.doesNotMatch(await other.text(), /href="\/sessions"/, 'the nav link is not offered to non-admins');
});

test('suggestions come back, never add anything, and respect limits and gear', async () => {
  const r = await api('POST', '/sessions/api/suggest', 'admin-token', { tailoring: { focus: ['quads'], limits: ['knee'], equipment: ['dumbbells'] } });
  assert.strictEqual(r.status, 200);
  const sg = r.body.suggestions;
  assert.ok(Array.isArray(sg.suggested) && Array.isArray(sg.check));
  assert.ok(sg.check.length > 0, 'knee-loading items are flagged for a check');
  assert.ok(!sg.suggested.some(x => sg.check.some(c => c.ref === x.ref)), 'flagged items are not also suggested');
  const list = await api('GET', '/sessions/api/list', 'admin-token');
  assert.ok(list.body.sessions.every(x => x.items.length === 0 || x.items.length === 2), 'suggesting changed no session');
});

test('the tracker is not reachable on a dedicated public host when PUBLIC_HOST is set', async () => {
  const pub = await startApp(`http://127.0.0.1:${auth.address().port}`, { PUBLIC_HOST: 'localhost' });
  try {
    // hostname "localhost" is the public host for this instance; 127.0.0.1 is not
    const viaPublic = (p) => fetch(pub.base.replace('127.0.0.1', 'localhost') + p, { redirect: 'manual' });
    assert.strictEqual((await viaPublic('/')).status, 302);
    assert.strictEqual((await viaPublic('/')).headers.get('location'), '/s');
    assert.strictEqual((await viaPublic('/s')).status, 200);
    assert.strictEqual((await viaPublic('/p/sitemap.xml')).status, 200, 'plan pages are public too');
    assert.strictEqual((await viaPublic('/trainer-plans')).status, 404);
    assert.strictEqual((await viaPublic('/settings')).status, 404);
    assert.strictEqual((await viaPublic('/sessions')).status, 404);
    assert.strictEqual((await viaPublic('/api/health/anything')).status, 404);
    assert.match(await (await viaPublic('/s/sitemap.xml')).text(), /https:\/\/localhost\/s/);
    // off the public host nothing changes
    assert.strictEqual((await fetch(pub.base + '/settings', { redirect: 'manual' })).status, 302);
  } finally { pub.stop(); }
});
