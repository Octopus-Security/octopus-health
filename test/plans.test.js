'use strict';

/**
 * Trainer role + shareable plans. Real entrypoint, stub octopus-auth (mutable USERS so a role can be
 * revoked mid-test), ROLE_CACHE_MS=150 so the short role cache is observable.
 *
 * Run: node --test test/plans.test.js
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
  'admin-token': { username: 'plAdmin', userId: 1, role: 'admin' },
  'ta-token': { username: 'trainerA', userId: 2, role: 'trainer' },
  'tb-token': { username: 'trainerB', userId: 3, role: 'trainer' },
  'user-token': { username: 'plainUser', userId: 4, role: 'user' },
  'rev-token': { username: 'revokable', userId: 5, role: 'trainer' },
};
const MARK = 'ZZPLANMARKERZZ';
let verifyCalls = 0;

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
          verifyCalls++;
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
async function startApp(authBase) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plans-'));
  const env = { ...process.env, PORT: String(port), DATA_DIR: tmp, AUTH_SERVICE_URL: authBase, AUTH_PUBLIC_URL: 'https://auth.example.test', AUTH_REMOTE_VERIFY: '', ROLE_CACHE_MS: '150' };
  const child = spawn(process.execPath, ['index.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    try { if ((await fetch(`${base}/api/build`, { signal: AbortSignal.timeout(1000) })).ok) break; } catch { /* not up */ }
    await new Promise(r => setTimeout(r, 150));
  }
  if (!(await fetch(`${base}/api/build`).then(r => r.ok, () => false))) { child.kill('SIGKILL'); throw new Error('server did not start:\n' + out.trim()); }
  return { base, stop() { child.kill('SIGKILL'); fs.rmSync(tmp, { recursive: true, force: true }); } };
}

const as = (t) => ({ Cookie: `octopus_sso=${t}` });
const J = { 'Content-Type': 'application/json' };
let auth, app;
async function api(method, url, token, body) {
  const r = await fetch(app.base + url, { method, headers: { ...J, ...(token ? as(token) : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  let j = null; try { j = await r.json(); } catch { /* not json */ }
  return { status: r.status, body: j };
}
const get = (url, token) => fetch(app.base + url, { headers: token ? as(token) : {}, redirect: 'manual' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const sessBody = (title = 'Leg day') => ({
  title, intro: 'Squat focus.',
  items: [{ type: 'exercise', ref: 'exercise:1', name: 'Goblet squat', poseKey: 'push-up', cues: ['Chest up'], instructions: '', dose: '3 x 8', note: 'brace' }],
  tailoring: { forName: `${MARK}-name`, goal: `${MARK}-goal`, limitsNote: `${MARK}-limits`, focus: [], limits: [], equipment: [] },
});
const mkSession = async (tok, title) => (await api('POST', '/sessions/api', tok, sessBody(title))).body.session;
const mkPlan = async (tok, body) => {
  const p = (await api('POST', '/trainer-plans/api', tok, {})).body.plan;
  if (!body) return p;
  const r = await api('PUT', `/trainer-plans/api/${p.id}`, tok, body);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  return r.body.plan;
};
const vis = async (tok, id, v) => (await api('POST', `/trainer-plans/api/${id}/visibility`, tok, { visibility: v })).body.plan;

before(async () => { auth = await startStubAuth(); app = await startApp(`http://127.0.0.1:${auth.address().port}`); });
after(() => { app?.stop(); auth?.close(); });

test('trainer and admin may author; a plain user gets 404 on every sessions and plans route', async () => {
  for (const tok of ['ta-token', 'admin-token']) {
    assert.strictEqual((await api('POST', '/sessions/api', tok, {})).status, 200, tok);
    assert.strictEqual((await get('/sessions', tok)).status, 200);
    assert.strictEqual((await get('/trainer-plans', tok)).status, 200);
  }
  for (const [m, u, b] of [['GET', '/sessions'], ['GET', '/sessions/api/list'], ['GET', '/sessions/api/library'], ['POST', '/sessions/api', {}], ['GET', '/trainer-plans'], ['GET', '/trainer-plans/api/list'], ['GET', '/trainer-plans/api/sessions'], ['POST', '/trainer-plans/api', {}], ['PUT', '/trainer-plans/api/1', {}], ['DELETE', '/trainer-plans/api/1']]) {
    const r = await fetch(app.base + u, { method: m, headers: { ...as('user-token'), ...J }, body: b ? JSON.stringify(b) : undefined, redirect: 'manual' });
    assert.strictEqual(r.status, 404, `${m} ${u}`);
  }
  assert.strictEqual((await get('/trainer-plans')).status, 302, 'anonymous goes to login');
});

test('role freshness: revoking trainer in auth stops authoring within the short cache, even though the token still verifies', async () => {
  assert.strictEqual((await api('POST', '/sessions/api', 'rev-token', {})).status, 200);
  const plan = await mkPlan('rev-token');
  USERS['rev-token'].role = 'user'; // revoked in auth
  await sleep(400);                 // > ROLE_CACHE_MS (150)
  assert.strictEqual((await api('POST', '/sessions/api', 'rev-token', {})).status, 404);
  assert.strictEqual((await api('GET', '/sessions/api/list', 'rev-token')).status, 404);
  assert.strictEqual((await api('PUT', `/trainer-plans/api/${plan.id}`, 'rev-token', { title: 'x' })).status, 404);
  assert.strictEqual((await get('/trainer-plans', 'rev-token')).status, 404);
  USERS['rev-token'].role = 'trainer'; // and granting works again
  await sleep(400);
  assert.strictEqual((await api('POST', '/sessions/api', 'rev-token', {})).status, 200);
});

test('a token the auth service no longer knows stops authoring too', async () => {
  USERS['gone-token'] = { username: 'goneTrainer', userId: 9, role: 'trainer' };
  assert.strictEqual((await api('POST', '/sessions/api', 'gone-token', {})).status, 200);
  delete USERS['gone-token'];
  await sleep(400);
  assert.notStrictEqual((await api('POST', '/sessions/api', 'gone-token', {})).status, 200);
});

test('ISOLATION (sessions): trainer B sees nothing of trainer A on any route; admin sees only its own', async () => {
  const s = await mkSession('ta-token', 'AlphaOnlySession');
  await api('POST', `/sessions/api/${s.id}/visibility`, 'ta-token', { visibility: 'unlisted' });
  for (const tok of ['tb-token', 'admin-token']) {
    assert.deepStrictEqual((await api('GET', '/sessions/api/list', tok)).body.sessions.filter(x => x.id === s.id), [], tok);
    assert.strictEqual((await get(`/sessions/${s.id}`, tok)).status, 404);
    assert.doesNotMatch(await (await get('/sessions', tok)).text(), /AlphaOnlySession/);
    assert.strictEqual((await api('PUT', `/sessions/api/${s.id}`, tok, { title: 'hijack' })).status, 404);
    assert.strictEqual((await api('POST', `/sessions/api/${s.id}/visibility`, tok, { visibility: 'public' })).status, 404);
    assert.strictEqual((await api('POST', `/sessions/api/${s.id}/rotate-link`, tok)).status, 404);
    assert.strictEqual((await api('DELETE', `/sessions/api/${s.id}`, tok)).status, 404);
  }
  const mine = (await api('GET', '/sessions/api/list', 'ta-token')).body.sessions.find(x => x.id === s.id);
  assert.strictEqual(mine.title, 'AlphaOnlySession');
  assert.strictEqual(mine.visibility, 'unlisted');
});

test('ISOLATION (plans): every plan route is 404 for another trainer, the admin and a user', async () => {
  const mySess = await mkSession('ta-token', 'A sess');
  const p = await mkPlan('ta-token', { title: 'AlphaPlanTitle', weeks: [{ title: 'W1', days: [{ label: 'Mon', sessionId: mySess.id }] }] });
  await vis('ta-token', p.id, 'unlisted');
  for (const tok of ['tb-token', 'admin-token']) {
    assert.deepStrictEqual((await api('GET', '/trainer-plans/api/list', tok)).body.plans.filter(x => x.id === p.id), [], tok);
    assert.strictEqual((await get(`/trainer-plans/${p.id}`, tok)).status, 404);
    assert.doesNotMatch(await (await get('/trainer-plans', tok)).text(), /AlphaPlanTitle/);
    assert.strictEqual((await api('PUT', `/trainer-plans/api/${p.id}`, tok, { title: 'hijack' })).status, 404);
    assert.strictEqual((await api('POST', `/trainer-plans/api/${p.id}/visibility`, tok, { visibility: 'public' })).status, 404);
    assert.strictEqual((await api('POST', `/trainer-plans/api/${p.id}/rotate-link`, tok)).status, 404);
    assert.strictEqual((await api('DELETE', `/trainer-plans/api/${p.id}`, tok)).status, 404);
    assert.ok(!(await api('GET', '/trainer-plans/api/sessions', tok)).body.sessions.some(x => x.id === mySess.id), 'session picker is owner-only');
  }
  const own = (await api('GET', '/trainer-plans/api/list', 'ta-token')).body.plans.find(x => x.id === p.id);
  assert.strictEqual(own.title, 'AlphaPlanTitle');
  assert.strictEqual((await get(`/trainer-plans/${p.id}`, 'ta-token')).status, 200);
});

test('a plan may only reference the same trainer\'s sessions (foreign and unknown ids refused, on create-by-save and update)', async () => {
  const bSess = await mkSession('tb-token', 'B sess');
  const p = await mkPlan('ta-token');
  const w = (id) => ({ weeks: [{ days: [{ sessionId: id }] }] });
  assert.strictEqual((await api('PUT', `/trainer-plans/api/${p.id}`, 'ta-token', w(bSess.id))).status, 400);
  assert.strictEqual((await api('PUT', `/trainer-plans/api/${p.id}`, 'ta-token', w(999999))).status, 400);
  assert.strictEqual((await api('POST', '/trainer-plans/api', 'ta-token', w(bSess.id))).status, 400);
  assert.deepStrictEqual((await api('GET', '/trainer-plans/api/list', 'ta-token')).body.plans.find(x => x.id === p.id).weeks, [], 'nothing was saved');
});

test('public side: private 404; unlisted by token with noindex; public by slug with canonical; sitemap lists public only; revoke and rotate', async () => {
  const sess = await mkSession('ta-token', 'Inline session');
  const p = await mkPlan('ta-token', { title: 'Eight week plan', intro: 'Go steady.', weeks: [{ title: 'Base', days: [{ label: 'Mon', sessionId: sess.id, note: 'warm up first' }, { label: 'Tue', note: 'rest' }] }] });
  assert.strictEqual((await get('/p/' + p.token)).status, 404, 'private');
  await vis('ta-token', p.id, 'unlisted');
  const page = await get('/p/' + p.token);
  assert.strictEqual(page.status, 200);
  assert.strictEqual(page.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(page.headers.get('cache-control'), /no-store/);
  assert.strictEqual(page.headers.get('referrer-policy'), 'no-referrer');
  const html = await page.text();
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.doesNotMatch(html, /rel="canonical"/);
  for (const t of ['Eight week plan', 'Go steady.', 'Base', 'Mon', 'warm up first', 'rest', 'Inline session', 'Goblet squat', 'Chest up']) assert.ok(html.includes(t), t);
  assert.ok((html.match(/<svg /g) || []).length >= 2, 'stills are drawn on the server');
  assert.ok(!(await (await get('/p/sitemap.xml')).text()).includes(p.token), 'unlisted is not in the sitemap');

  const pub = await vis('ta-token', p.id, 'public');
  assert.match(pub.slug, /^eight-week-plan-[0-9a-f]{6}$/);
  const ph = await get('/p/' + pub.slug);
  assert.strictEqual(ph.status, 200);
  assert.strictEqual(ph.headers.get('x-robots-tag'), null);
  assert.match(await ph.text(), /rel="canonical" href="[^"]*\/p\/eight-week-plan-/);
  assert.match(await (await get('/p/sitemap.xml')).text(), new RegExp('/p/' + pub.slug));
  const viaToken = await get('/p/' + p.token);
  assert.strictEqual(viaToken.status, 302);
  assert.strictEqual(viaToken.headers.get('location'), '/p/' + pub.slug);

  const rot = (await api('POST', `/trainer-plans/api/${p.id}/rotate-link`, 'ta-token')).body.plan;
  assert.strictEqual((await get('/p/' + p.token)).status, 404, 'old token dead');
  assert.strictEqual((await get('/p/' + rot.token)).status, 302);
  await vis('ta-token', p.id, 'private');
  assert.strictEqual((await get('/p/' + pub.slug)).status, 404);
  assert.strictEqual((await get('/p/' + rot.token)).status, 404);
  assert.doesNotMatch(await (await get('/p/sitemap.xml')).text(), new RegExp(pub.slug));
  await vis('ta-token', p.id, 'unlisted');
  await api('DELETE', `/trainer-plans/api/${p.id}`, 'ta-token');
  assert.strictEqual((await get('/p/' + rot.token)).status, 404);
});

test('LIVE: editing the plan, or any session in it, changes what the same link shows; a deleted session leaves a placeholder', async () => {
  const sess = await mkSession('ta-token', 'Live before');
  const p = await mkPlan('ta-token', { title: 'Live plan', weeks: [{ days: [{ label: 'Mon', sessionId: sess.id }] }] });
  await vis('ta-token', p.id, 'unlisted');
  const url = '/p/' + p.token;
  assert.match(await (await get(url)).text(), /Live before/);

  await api('PUT', `/sessions/api/${sess.id}`, 'ta-token', { title: 'Live after', items: [...sessBody().items, { type: 'exercise', ref: 'e:2', name: 'Added lunge', poseKey: null, cues: [], dose: '', note: '' }] });
  let html = await (await get(url)).text();
  assert.match(html, /Live after/); assert.doesNotMatch(html, /Live before/); assert.match(html, /Added lunge/);

  await api('PUT', `/trainer-plans/api/${p.id}`, 'ta-token', { title: 'Renamed plan', weeks: [{ days: [{ label: 'Wed', sessionId: sess.id, note: 'new note' }] }] });
  html = await (await get(url)).text();
  assert.match(html, /Renamed plan/); assert.match(html, /Wed/); assert.match(html, /new note/); assert.doesNotMatch(html, /Mon</);

  await api('DELETE', `/sessions/api/${sess.id}`, 'ta-token');
  const r = await get(url);
  assert.strictEqual(r.status, 200, 'no 500');
  html = await r.text();
  assert.match(html, /no longer available/); assert.match(html, /Renamed plan/);
});

test('DECISION: a PRIVATE session inside a shared plan renders inline (the plan governs); its own link stays 404; tailoring never appears', async () => {
  const sess = await mkSession('ta-token', 'Private inside');
  assert.strictEqual(sess.visibility, 'private');
  const p = await mkPlan('ta-token', { title: 'Governing plan', weeks: [{ days: [{ label: 'Fri', sessionId: sess.id }] }] });
  await vis('ta-token', p.id, 'unlisted');
  const html = await (await get('/p/' + p.token)).text();
  assert.match(html, /Private inside/); assert.match(html, /Goblet squat/);
  assert.strictEqual((await get('/s/' + sess.token)).status, 404, 'the session link itself is still closed');
  const pub = await vis('ta-token', p.id, 'public');
  for (const u of ['/p/' + pub.slug, '/p/sitemap.xml']) {
    const r = await get(u); const body = await r.text();
    for (const h of [...r.headers.values()]) assert.ok(!h.includes(MARK));
    assert.ok(!body.includes(MARK), u + ' leaked tailoring');
    for (const w of ['trainerA', 'forName', 'limitsNote', 'tailoring', '"owner"']) assert.ok(!body.includes(w), `${u} contains ${w}`);
  }
  assert.ok((await (await get(`/sessions/${sess.id}`, 'ta-token')).text()).includes(MARK), 'owner editor still has it');
  assert.strictEqual((await get('/s/sitemap.xml')).status, 200);
  assert.doesNotMatch(await (await get('/s')).text(), /Private inside/);
});

test('read side re-checks the owner: a session id owned by someone else renders as missing, never as content', async () => {
  const P = require('../api/plans-store');
  let asked = null;
  const h = { SharedSession: { findAll: async ({ where }) => { asked = where; return []; } } };
  const view = await P.planPublicView(h, { owner: 'trainerA', title: 't', intro: '', visibility: 'unlisted', slug: null, weeks: JSON.stringify([{ title: '', days: [{ label: '', note: '', sessionId: 77 }] }]) });
  assert.strictEqual(asked.owner, 'trainerA', 'query is scoped to the plan owner');
  assert.strictEqual(view.weeks[0].days[0].session, null);
  assert.strictEqual(view.weeks[0].days[0].missing, true);
});

test('user text on the plan page is escaped', async () => {
  const sess = await mkSession('ta-token', '<script>alert(3)</script>');
  const p = await mkPlan('ta-token', { title: '<script>alert(1)</script>', intro: '"><img src=x onerror=alert(2)>', weeks: [{ title: '<b>w</b>', days: [{ label: '<i>d</i>', note: '<u>n</u>', sessionId: sess.id }] }] });
  await vis('ta-token', p.id, 'unlisted');
  const html = await (await get('/p/' + p.token)).text();
  for (const bad of ['<script>alert', '<img src=x', '<b>w</b>', '<i>d</i>', '<u>n</u>']) assert.ok(!html.includes(bad), bad);
  assert.match(html, /&lt;script&gt;alert\(1\)/);
});

test('plan routes refuse non-JSON and cross-origin writes; visibility must be valid', async () => {
  const p = await mkPlan('ta-token');
  assert.strictEqual((await fetch(app.base + '/trainer-plans/api', { method: 'POST', headers: { ...as('ta-token'), 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
  assert.strictEqual((await fetch(app.base + '/trainer-plans/api', { method: 'POST', headers: { ...as('ta-token'), ...J, Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.strictEqual((await api('POST', `/trainer-plans/api/${p.id}/visibility`, 'ta-token', { visibility: 'members' })).status, 400);
  assert.strictEqual((await api('PUT', `/trainer-plans/api/${p.id}`, 'ta-token', { weeks: 'nope' })).status, 400);
  const many = { weeks: Array.from({ length: 60 }, () => ({ days: Array.from({ length: 14 }, () => ({ note: 'x' })) })) };
  assert.strictEqual((await api('PUT', `/trainer-plans/api/${p.id}`, 'ta-token', many)).status, 400, 'over the total-days cap');
});

test('editor and list pages render with the nav link for a trainer, and not for a user', async () => {
  const p = await mkPlan('ta-token', { title: 'Page plan' });
  const edit = await (await get(`/trainer-plans/${p.id}`, 'ta-token')).text();
  assert.match(edit, /Weeks and days/);
  assert.match(edit, /href="\/trainer-plans"/);
  assert.match(await (await get('/trainer-plans', 'ta-token')).text(), /Page plan/);
  assert.match(await (await get('/', 'ta-token')).text(), /href="\/sessions"/);
  assert.doesNotMatch(await (await get('/', 'user-token')).text(), /href="\/(sessions|trainer-plans)"/);
});
