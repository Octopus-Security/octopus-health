'use strict';

/**
 * content/: the reading material has the shape it promises.
 *
 * content/ is plain Markdown that no route serves yet (see content/README.md
 * for why it is not seeded into the database). With no loader, nothing else
 * would ever notice a piece that lost its warm-up, an MMA breakdown with no
 * safety notes, or a link someone typed from memory. Those are the failures
 * this guards:
 *
 *  - a workout missing any of Goal / Equipment / Warm-up / The session /
 *    Cool-down / Progression — a session without a warm-up or progression is
 *    the incomplete advice the format exists to prevent;
 *  - an MMA piece without a "Safety notes" section — combat-sports technique
 *    with the safety half dropped is the one omission here that can hurt
 *    someone;
 *  - a URL on links.md that is neither the root of a short list of canonical
 *    domains nor marked "⚠ verify" — i.e. a guessed link presented as
 *    trustworthy;
 *  - a file with no front matter title/category, which a future loader would
 *    have to special-case.
 *
 * Pure fs, no dependencies — runs without the GitHub Packages token.
 *
 * Run: node --test test/content.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const path     = require('node:path');

const ROOT = path.join(__dirname, '..', 'content');

function mdFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir))
    .filter(f => f.endsWith('.md'))
    .map(f => ({ name: `${dir}/${f}`, text: fs.readFileSync(path.join(ROOT, dir, f), 'utf8') }));
}

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

function headings(text) {
  return text.split('\n').filter(l => /^## /.test(l)).map(l => l.slice(3).trim().toLowerCase());
}

const WORKOUTS  = mdFiles('workouts');
const NUTRITION = mdFiles('nutrition');
const MMA       = mdFiles('mma');
const LINKS     = { name: 'links.md', text: fs.readFileSync(path.join(ROOT, 'links.md'), 'utf8') };

test('the batch is all there: 6 workouts, 4 nutrition, 4 MMA', () => {
  assert.strictEqual(WORKOUTS.length, 6);
  assert.strictEqual(NUTRITION.length, 4);
  assert.strictEqual(MMA.length, 4);
});

test('every content file has front matter with a title and the right category', () => {
  const expect = [
    ...WORKOUTS.map(f => [f, 'workout']),
    ...NUTRITION.map(f => [f, 'nutrition']),
    ...MMA.map(f => [f, 'mma']),
    [LINKS, 'links'],
  ];
  for (const [f, category] of expect) {
    const fm = frontMatter(f.text);
    assert.ok(fm, `${f.name}: no front matter`);
    assert.ok(fm.title, `${f.name}: no title`);
    assert.strictEqual(fm.category, category, `${f.name}: category`);
  }
});

test('every workout has goal, equipment, warm-up, session, cool-down, progression', () => {
  const required = [/^goal$/, /^equipment$/, /^warm-up/, /^the session$/, /^cool-down/, /^progression$/];
  for (const f of WORKOUTS) {
    const hs = headings(f.text);
    for (const re of required) {
      assert.ok(hs.some(h => re.test(h)), `${f.name}: missing section ${re}`);
    }
  }
});

test('the four MMA pieces cover striking, grappling, conditioning and fight IQ, each with safety notes', () => {
  const disciplines = MMA.map(f => frontMatter(f.text).discipline).sort();
  assert.deepStrictEqual(disciplines, ['conditioning', 'fight-iq', 'grappling', 'striking']);
  for (const f of MMA) {
    assert.ok(headings(f.text).includes('safety notes'), `${f.name}: no "Safety notes" section`);
  }
});

// Long-standing canonical domains, linked at their ROOT only. Judged from
// knowledge when links.md was written — the sandbox's proxy refused every one
// of them (CONNECT 403), so none was fetched. Anything else must carry
// "⚠ verify" on the same line. Adding a domain here is a claim that it is the
// real, current site — do not add one just to make this test pass.
const CANONICAL_DOMAINS = new Set([
  'www.acsm.org', 'www.nsca.com', 'exrx.net', 'www.strongerbyscience.com',
  'www.myplate.gov', 'www.dietaryguidelines.gov', 'fdc.nal.usda.gov',
  'www.foodsafety.gov', 'ods.od.nih.gov', 'www.eatright.org',
  'www.ufc.com', 'ibjjf.com', 'www.sherdog.com', 'www.tapology.com', 'www.bjjheroes.com',
]);

test('every link on links.md is https and either a canonical domain root or marked ⚠ verify', () => {
  const lines = LINKS.text.split('\n').filter(l => /\]\(https?:/.test(l));
  assert.ok(lines.length >= 15, 'links page looks empty');
  for (const line of lines) {
    for (const [, url] of line.matchAll(/\]\((https?:[^)\s]+)\)/g)) {
      const u = new URL(url);
      assert.strictEqual(u.protocol, 'https:', `${url}: not https`);
      const canonicalRoot = CANONICAL_DOMAINS.has(u.hostname) && (u.pathname === '/' || u.pathname === '');
      assert.ok(canonicalRoot || line.includes('⚠ verify'),
        `${url}: neither a canonical domain root nor marked "⚠ verify"`);
    }
  }
});

test('links inside articles point only at canonical domains', () => {
  for (const f of [...WORKOUTS, ...NUTRITION, ...MMA]) {
    for (const [, url] of f.text.matchAll(/\]\((https?:[^)\s]+)\)/g)) {
      assert.ok(CANONICAL_DOMAINS.has(new URL(url).hostname), `${f.name}: non-canonical link ${url}`);
    }
  }
});
