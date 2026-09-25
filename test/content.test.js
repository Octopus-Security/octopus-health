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
 *    have to special-case;
 *  - (calisthenics) a progression-ladder rung without its "Move up when"
 *    standard or its "Regression" — a ladder with no standard gives no rule
 *    for when to move up, and one with no regression leaves someone stuck on
 *    a rung that is too hard, which is how people grind through bad reps and
 *    get hurt;
 *  - (calisthenics) equipment beyond the owner's pull-up bar, dip bars and
 *    push-up handles creeping in unmarked — rings, weights, bands — when the
 *    batch was written for exactly that kit and anything else must say
 *    "optional".
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
const CAL_LADDERS  = mdFiles('calisthenics').filter(f => !f.name.endsWith('/README.md'));
const CAL_ROUTINES = mdFiles('calisthenics/routines');
const CAL_INDEX    = { name: 'calisthenics/README.md', text: fs.readFileSync(path.join(ROOT, 'calisthenics', 'README.md'), 'utf8') };
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
    ...CAL_LADDERS.map(f => [f, 'calisthenics-ladder']),
    ...CAL_ROUTINES.map(f => [f, 'calisthenics-routine']),
    [CAL_INDEX, 'calisthenics-index'],
    [LINKS, 'links'],
  ];
  for (const [f, category] of expect) {
    const fm = frontMatter(f.text);
    assert.ok(fm, `${f.name}: no front matter`);
    assert.ok(fm.title, `${f.name}: no title`);
    assert.strictEqual(fm.category, category, `${f.name}: category`);
  }
});

test('every workout and calisthenics routine has goal, equipment, warm-up, session, cool-down, progression', () => {
  const required = [/^goal$/, /^equipment$/, /^warm-up/, /^the session$/, /^cool-down/, /^progression$/];
  for (const f of [...WORKOUTS, ...CAL_ROUTINES]) {
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
  for (const f of [...WORKOUTS, ...NUTRITION, ...MMA, ...CAL_LADDERS, ...CAL_ROUTINES, CAL_INDEX]) {
    for (const [, url] of f.text.matchAll(/\]\((https?:[^)\s]+)\)/g)) {
      assert.ok(CANONICAL_DOMAINS.has(new URL(url).hostname), `${f.name}: non-canonical link ${url}`);
    }
  }
});

// ── Calisthenics ────────────────────────────────────────────────────────────

// A rung is a numbered "### N. Name" heading and everything up to the next
// heading of level 2 or 3. Un-numbered "###" headings are side notes (bench
// dips, Korean dips), deliberately not rungs.
function rungs(text) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^### (\d+)\. (.+)$/);
    if (!m) continue;
    let j = i + 1;
    while (j < lines.length && !/^#{2,3} /.test(lines[j])) j++;
    out.push({ n: Number(m[1]), name: m[2], body: lines.slice(i + 1, j).join('\n') });
  }
  return out;
}

const RUNG_FIELDS = ['Equipment', 'How', 'Common faults', 'Move up when', 'Regression'];

test('calisthenics: every required movement family has a ladder, plus 4 routines', () => {
  const families = CAL_LADDERS.map(f => frontMatter(f.text).family).sort();
  assert.deepStrictEqual(families,
    ['chin-ups', 'core', 'dips', 'legs', 'pike-hspu', 'pull-ups', 'push-ups', 'rows', 'skills']);
  assert.strictEqual(CAL_ROUTINES.length, 4);
});

test('calisthenics: every ladder rung has equipment, cues, faults, a move-up standard and a regression', () => {
  for (const f of CAL_LADDERS) {
    const rs = rungs(f.text);
    assert.ok(rs.length >= 4, `${f.name}: only ${rs.length} rungs`);
    rs.forEach((r, i) => assert.strictEqual(r.n, i + 1, `${f.name}: rung numbering breaks at "${r.name}"`));
    for (const r of rs) {
      for (const field of RUNG_FIELDS) {
        const m = r.body.match(new RegExp(`^- \\*\\*${field}:\\*\\*\\s*(\\S.*)$`, 'm'));
        assert.ok(m, `${f.name} rung ${r.n} "${r.name}": missing or empty "${field}"`);
      }
    }
  }
});

test('calisthenics: every ladder ends with safety notes', () => {
  for (const f of CAL_LADDERS) {
    assert.ok(headings(f.text).includes('safety notes'), `${f.name}: no "Safety notes" section`);
  }
});

// The owner has a pull-up bar, dip bars and push-up handles. Anything else
// named as equipment must be marked optional on the same line.
const OUTSIDE_KIT = /\b(rings?|dumbbells?|barbells?|kettlebells?|weight vest|weights?|bands?|resistance band|cable)\b/i;

test('calisthenics: equipment beyond bar, dip bars and handles is always marked optional', () => {
  const equipmentLines = [];
  for (const f of CAL_LADDERS) {
    for (const r of rungs(f.text)) {
      const m = r.body.match(/^- \*\*Equipment:\*\*(.*)$/m);
      if (m) equipmentLines.push([`${f.name} rung ${r.n}`, m[1]]);
    }
  }
  for (const f of CAL_ROUTINES) {
    const sec = f.text.split(/^## /m).find(s => /^equipment\b/i.test(s)) || '';
    for (const line of sec.split('\n').slice(1)) if (line.trim()) equipmentLines.push([f.name, line]);
  }
  assert.ok(equipmentLines.length > 40, 'equipment lines not found');
  for (const [where, line] of equipmentLines) {
    if (OUTSIDE_KIT.test(line)) {
      assert.match(line, /optional/i, `${where}: "${line.trim()}" names equipment outside the kit without marking it optional`);
    }
  }
});

test('calisthenics: the index states the handle assumption and how progression, regression and deloads work', () => {
  const t = CAL_INDEX.text;
  assert.match(t, /\*\*Assumption:\*\*[^\n]*parallettes/i, 'handles-as-parallettes assumption not stated');
  for (const h of ['the standards', 'moving up', 'regressing', 'stalls and deloads']) {
    assert.ok(headings(t).concat(t.split('\n').filter(l => /^### /.test(l)).map(l => l.slice(4).trim().toLowerCase())).includes(h),
      `index: no "${h}" section`);
  }
});
