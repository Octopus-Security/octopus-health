'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const presets = require('../api/timer-presets');

function memDb() {
  const rows = new Map();
  return {
    rows,
    UserSetting: {
      async findByPk(k) { return rows.has(k) ? { key: k, value: rows.get(k) } : null; },
      async upsert({ key, value }) { rows.set(key, value); },
    },
  };
}

test('a zero-length round becomes one second, and combo strikes stay in canonical order', () => {
  const round = presets.normalizeOne('round', { rounds: 500, workMin: 0, workSec: 0, countdown: -3 });
  assert.equal(round.rounds, 99);
  assert.equal(round.workSec, 1);
  assert.equal(round.countdown, 0);
  const combo = presets.normalizeOne('combo', { min: 5, max: 2, strikes: ['K', 'nope', '1'] });
  assert.equal(combo.max, 5);
  assert.deepEqual(combo.strikes, ['1', 'K']);
  const empty = presets.normalizeOne('combo', { strikes: [] });
  assert.deepEqual(empty.strikes, ['1', '2', '3', '4', '5', '6']);
});

test('save keeps one kind from wiping another, collapses duplicates, and refuses a bad id', async () => {
  const db = memDb();
  await presets.save(db, 'amrap', [{ minutes: 8, seconds: 30 }]);
  const rounds = await presets.save(db, 'round', [
    { rounds: 3, workMin: 2, workSec: 0, restMin: 1, restSec: 0, countdown: 5 },
  ]);
  assert.match(rounds[0].id, /^c[0-9a-f]{12}$/);
  const again = await presets.save(db, 'emom', [
    { minutes: 12, work: 40 },
    { minutes: 12, work: 40 },
    { id: 'strict-pull-up', minutes: 8, work: 30 },
  ]);
  assert.equal(again.length, 2);
  assert.match(again[1].id, /^c[0-9a-f]{12}$/);
  assert.notEqual(again[1].id, 'strict-pull-up');
  const all = await presets.list(db);
  assert.equal(all.amrap.length, 1);
  assert.equal(all.amrap[0].seconds, 30);
  assert.equal(all.round[0].workMin, 2);
  assert.equal(all.interval.length, 0);
  assert.equal(all.combo.length, 0);
});

test('a valid id is kept, a second account is a different list, and the caps hold', async () => {
  const id = 'c' + 'a'.repeat(12);
  const a = memDb();
  const saved = await presets.save(a, 'interval', [{ id, rounds: 4, work: 30, rest: 15 }]);
  assert.equal(saved[0].id, id);
  assert.equal(saved[0].work, 30);
  const b = memDb();
  assert.equal((await presets.list(b)).interval.length, 0);
  const many = Array.from({ length: 31 }, (_, i) => ({ rounds: i + 1, work: 20, rest: 10 }));
  await assert.rejects(() => presets.save(a, 'interval', many), /30/);
  await assert.rejects(() => presets.save(a, 'stopwatch', []), /unknown/);
  await assert.rejects(() => presets.save(a, 'interval', { rounds: 1 }), /list/);
  a.rows.set(presets.SETTING_KEY, '{');
  assert.equal((await presets.list(a)).round.length, 0);
});

test('every setup tab has a +, and the stopwatch does not', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'views', 'timers.ejs'), 'utf8');
  for (const id of ['rt-add', 'it-add', 'em-add', 'am-add', 'cb-add']) {
    assert.match(page, new RegExp('id="' + id + '"[^>]*aria-label="Add timer"'));
  }
  assert.doesNotMatch(page, /id="sw-add"/);
  const tempo = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'tempo-page.js'), 'utf8');
  assert.match(tempo, /aria-label', 'Add timer'/);
});
