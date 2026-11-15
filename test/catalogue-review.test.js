'use strict';
// A person can ask for an exercise to be shared. Only an admin sees the queue.
// Approving copies it onto the admin account and onto a newly seeded account.
// Rejecting leaves it off. Run: node --test test/catalogue-review.test.js
require('./helpers/data-dir');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let express, ejs, getDatabase;
try {
  express = require('express');
  ejs = require('ejs');
  require('sequelize');
  require('sqlite3');
  getDatabase = require('../database');
} catch { /* skipped */ }
const skip = !getDatabase && 'express/ejs/sequelize/sqlite3 not installed on this machine';
const stamp = `zz_cat_${process.pid}`;
const PAT = `${stamp}_pat`;
const ADA = `${stamp}_ada`;
const NEWB = `${stamp}_new`;
let server, base;

before(async () => {
  if (skip) return;
  const { asset } = require('../build');
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.asset = asset;
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  const requireLogin = async (req, res, next) => {
    const u = req.get('x-test-user');
    if (!u) return res.status(302).end();
    req.user = { username: u, role: req.get('x-test-role') || 'user' };
    res.locals.user = req.user;
    await getDatabase(u).ensure();
    next();
  };
  require('../api/catalogue-review')(app, { requireLogin, getDatabase });
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  if (server) server.close();
  for (const n of [PAT, ADA, NEWB]) {
    try { fs.unlinkSync(path.join(process.env.DATA_DIR, `${n}_health.sqlite`)); } catch { /* none */ }
  }
});

const headers = (user, role, json) => ({
  'X-Test-User': user,
  'X-Test-Role': role || 'user',
  Accept: json ? 'application/json' : 'text/html',
  ...(json ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' }),
});

const exercise = (name, muscles) => ({
  name, category: 'strength', equipment: 'none', primaryMuscles: muscles, requestPublication: true,
  instructions: 'Sit tall and open the arms.',
});

test('a non-admin gets 404, an approval is copied, a rejection is not', { skip }, async () => {
  const offered = await fetch(base + '/library/api/exercises', {
    method: 'POST', headers: headers(PAT, 'user', true), body: JSON.stringify(exercise('Zed Catalogue Press', ['chest'])),
  });
  const offeredJson = await offered.json();
  assert.strictEqual(offered.status, 201);
  assert.strictEqual(offeredJson.publication.ok, true);

  const hidden = await fetch(base + '/library/review', { headers: headers(PAT, 'user', false) });
  assert.strictEqual(hidden.status, 404);

  const queue = await fetch(base + '/library/review', { headers: headers(ADA, 'admin', false) });
  assert.strictEqual(queue.status, 200);
  const html = await queue.text();
  assert.match(html, /Zed Catalogue Press/);
  assert.match(html, /Add to catalogue/);
  const id = /\/library\/review\/(\d+)/.exec(html)[1];

  const yes = await fetch(base + '/library/review/' + id, {
    method: 'POST', redirect: 'manual', headers: headers(ADA, 'admin', false),
    body: 'decision=approve',
  });
  assert.strictEqual(yes.status, 302);

  const onAdmin = await getDatabase(ADA).ExerciseDefinition.findOne({ where: { name: 'Zed Catalogue Press' } });
  assert.ok(onAdmin);
  assert.strictEqual(onAdmin.isCustom, false);
  assert.deepStrictEqual(JSON.parse(onAdmin.primaryMuscles), ['chest']);

  const refused = await fetch(base + '/library/api/exercises', {
    method: 'POST', headers: headers(PAT, 'user', true), body: JSON.stringify(exercise('Zed Catalogue Row', ['lats'])),
  });
  assert.strictEqual((await refused.json()).publication.ok, true);
  const queue2 = await (await fetch(base + '/library/review', { headers: headers(ADA, 'admin', false) })).text();
  const id2 = /Zed Catalogue Row[\s\S]*?\/library\/review\/(\d+)/.exec(queue2)[1];
  const no = await fetch(base + '/library/review/' + id2, {
    method: 'POST', redirect: 'manual', headers: headers(ADA, 'admin', false),
    body: 'decision=reject&note=Not+clear',
  });
  assert.strictEqual(no.status, 302);
  const sneak = await fetch(base + '/library/review/' + id2, {
    method: 'POST', redirect: 'manual', headers: headers(PAT, 'user', false), body: 'decision=approve',
  });
  assert.strictEqual(sneak.status, 404);

  const fresh = getDatabase(NEWB);
  await fresh.ensureSeeded();
  const copied = await fresh.ExerciseDefinition.findOne({ where: { name: 'Zed Catalogue Press' } });
  const left = await fresh.ExerciseDefinition.findOne({ where: { name: 'Zed Catalogue Row' } });
  assert.ok(copied, 'a new account receives an approved exercise');
  assert.deepStrictEqual(JSON.parse(copied.primaryMuscles), ['chest']);
  assert.strictEqual(left, null);
});

test('publishing with no known muscle is refused and the account row is not required', { skip }, async () => {
  const r = await fetch(base + '/library/api/exercises', {
    method: 'POST', headers: headers(PAT, 'user', true),
    body: JSON.stringify({ name: 'Mystery Press', category: 'strength', equipment: 'none', primaryMuscles: ['wibble'], requestPublication: true }),
  });
  assert.strictEqual(r.status, 400);
});

test('saving without muscles still works, and a pose already stored is kept when the field is omitted', { skip }, async () => {
  const made = await fetch(base + '/library/api/exercises', {
    method: 'POST', headers: headers(PAT, 'user', true),
    body: JSON.stringify({ name: 'Pose Keep Press', category: 'strength', equipment: 'none', poseKey: 'bench-press', instructions: 'Lower and press.' }),
  });
  assert.strictEqual(made.status, 201);
  const again = await fetch(base + '/library/api/exercises', {
    method: 'POST', headers: headers(PAT, 'user', true),
    body: JSON.stringify({ name: 'Pose Keep Press', category: 'strength', equipment: 'dumbbell', primaryMuscles: ['chest'] }),
  });
  assert.ok(again.ok);
  const row = await getDatabase(PAT).ExerciseDefinition.findOne({ where: { name: 'Pose Keep Press' } });
  assert.strictEqual(row.poseKey, 'bench-press');
  assert.strictEqual(row.instructions, 'Lower and press.');
  assert.deepStrictEqual(JSON.parse(row.primaryMuscles), ['chest']);
});
