'use strict';

/** Pure rules for shareable sessions: token strength, cleaning, the public whitelist, the assist. */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const S = require('../api/sessions-store');
const L = require('../api/sessions-library');
const SF = require('../public/stick-figure.js');

test('tokens: 192 bits of crypto randomness, url-safe, never repeated', () => {
  assert.ok(S.TOKEN_BYTES * 8 >= 128);
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const t = S.newToken(); assert.match(t, /^[A-Za-z0-9_-]{32}$/); seen.add(t); }
  assert.strictEqual(seen.size, 500);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'api', 'sessions-store.js'), 'utf8'), /Math\.random/);
});

test('publicView is a whitelist: no owner, id, tailoring or token', () => {
  const row = { id: 7, owner: 'someone', title: 'T', intro: 'I', visibility: 'unlisted', slug: null, token: 'tok',
    tailoring: JSON.stringify({ forName: 'SECRET' }), items: JSON.stringify([{ type: 'exercise', name: 'N', poseKey: null, cues: ['c'], note: 'n', tailoring: 'SECRET' }]) };
  const v = S.publicView(row);
  assert.deepStrictEqual(Object.keys(v).sort(), ['intro', 'items', 'slug', 'title', 'visibility']);
  assert.ok(!JSON.stringify(v).includes('SECRET') && !JSON.stringify(v).includes('someone') && !JSON.stringify(v).includes('tok'));
  assert.deepStrictEqual(Object.keys(v.items[0]).sort(), ['cues', 'dose', 'instructions', 'name', 'note', 'poseKey', 'type']);
});

test('cleaning caps lengths and item counts and drops junk', () => {
  const d = S.cleanInput({ title: 'x'.repeat(500), items: Array.from({ length: 100 }, () => ({ type: 'exercise', name: 'n' })).concat([{ type: 'bogus', name: 'z' }, null, 5]) });
  assert.strictEqual(d.title.length, 120);
  assert.strictEqual(d.items.length, S.MAX_ITEMS);
  assert.throws(() => S.cleanInput({ items: 'no' }), /list/);
  assert.strictEqual(S.cleanInput({ title: '   ' }).title, 'Untitled session');
});

test('the assist filters by gear, flags limited joints and ranks by focus; it only returns lists', () => {
  const lib = [
    { type: 'exercise', ref: 'a', name: 'Goblet Squat', primary: ['quads', 'glutes'], secondary: [], joints: [], requires: ['dumbbells'], stretch: false },
    { type: 'exercise', ref: 'b', name: 'Barbell Squat', primary: ['quads'], secondary: [], joints: [], requires: ['barbell'], stretch: false },
    { type: 'exercise', ref: 'c', name: 'Dead Bug', primary: ['abs'], secondary: [], joints: [], requires: [], stretch: false },
    { type: 'exercise', ref: 'd', name: 'Hip Flexor Stretch', primary: ['hip_flexors'], secondary: [], joints: ['hip'], requires: [], stretch: true },
  ];
  const r = L.suggest(lib, { focus: ['glutes'], limits: [], equipment: ['dumbbells'] });
  assert.deepStrictEqual(r.suggested.map(x => x.ref), ['a']);
  assert.strictEqual(r.unavailable, 1, 'the barbell item needs gear that is not listed');
  const k = L.suggest(lib, { focus: ['quads'], limits: ['knee'], equipment: [] });
  assert.deepStrictEqual(k.suggested, []);
  assert.deepStrictEqual(k.check.map(x => x.ref).sort(), ['a', 'b']);
  const none = L.suggest(lib, {});
  assert.strictEqual(none.suggested.length, 4, 'with nothing stated, nothing is filtered');
  assert.ok(/not medical advice/.test(r.note));
});

test('library entries carry only real pose files', () => {
  const lib = [...L.fromMma(), ...L.fromRoutines(require('../api/mobility').ROUTINES)];
  assert.ok(lib.length > 40);
  for (const e of lib) if (e.poseKey) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'poses', e.poseKey + '.json')), e.poseKey);
});

test('server-side stills are produced for animated poses and are valid svg', () => {
  const { stillsFor } = require('../lib/session-stills');
  const st = stillsFor('push-up');
  assert.ok(st.length >= 2);
  assert.match(st[0].svg, /^<svg [^>]*viewBox="[^"]+">/);
  assert.deepStrictEqual(stillsFor('nope/nope'), []);
  assert.deepStrictEqual(stillsFor(null), []);
});
