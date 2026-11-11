'use strict';
// Guard: no native alert()/confirm()/prompt() in client code. Every dialog is the themed octopus-kit one
// (oDialog), so the theme is controlled in one place. Server code is not scanned.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|ejs|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
// bare or window.-qualified call that is not a method of something else (oDialog.confirm, x.alert)
const NATIVE = /(?<![\w.$])(?:window\s*\.\s*)?(alert|confirm|prompt)\s*\(/;

test('client code uses oDialog, never native alert/confirm/prompt', () => {
  const files = [...walk(path.join(root, 'views')), ...walk(path.join(root, 'public'))]
    .filter((f) => !f.includes(`${path.sep}third_party${path.sep}`) && !/\.min\./.test(f));
  const hits = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (NATIVE.test(line) || /\bwindow\.(alert|confirm|prompt)\b/.test(line)) hits.push(`${path.relative(root, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepStrictEqual(hits, [], 'native dialog calls found:\n' + hits.join('\n'));
});

test('every page that loads theme.css also loads the dialog partial', () => {
  const missing = fs.readdirSync(path.join(root, 'views')).filter((f) => f.endsWith('.ejs')).filter((f) => {
    const s = fs.readFileSync(path.join(root, 'views', f), 'utf8');
    return s.includes("asset('/theme.css')") && !s.includes("include('partials/dialog')");
  });
  assert.deepStrictEqual(missing, []);
});

test('form confirms go through oConfirmForm, which blocks the native submit first', () => {
  const src = fs.readFileSync(path.join(root, 'public/js/confirm-form.js'), 'utf8');
  assert.ok(src.indexOf('e.preventDefault()') < src.indexOf('oDialog.confirm'), 'preventDefault must precede the await');
  assert.ok(/prototype\.submit\.call/.test(src), 'submit must bypass the onsubmit handler to avoid a loop');
});

test('kit dialog files resolve and are stamped', () => {
  const { kitFile, KIT_FILES, asset } = require('../build');
  for (const u of Object.keys(KIT_FILES)) {
    if (!fs.existsSync(kitFile(u))) { console.log('  (octopus-kit not installed here: ' + u + ')'); continue; }
    assert.match(asset(u), /\?v=[0-9a-f]{8}$/);
  }
});

test('oConfirmForm: no submit before the answer, submits on yes, never on no', async () => {
  const vm = require('node:vm');
  for (const answer of [true, false]) {
    let submitted = 0, prevented = 0, resolve;
    const form = { closest: () => form };
    const win = { oDialog: { confirm: () => new Promise((r) => { resolve = r; }) },
      HTMLFormElement: { prototype: { submit() { submitted++; } } } };
    win.window = win;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'public/js/confirm-form.js'), 'utf8'), win);
    win.HTMLFormElement.prototype.submit = function () { submitted++; };
    const ret = win.oConfirmForm({ preventDefault() { prevented++; }, target: form }, 'x', 'Delete');
    assert.strictEqual(ret, false); assert.strictEqual(prevented, 1); assert.strictEqual(submitted, 0);
    resolve(answer); await new Promise((r) => setImmediate(r));
    assert.strictEqual(submitted, answer ? 1 : 0);
  }
});
