'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.join(__dirname, '..');
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; } };

test('.gitignore covers sqlite databases and sidecars', (t) => {
  if (git('rev-parse', '--git-dir') === null) return t.skip('not a git checkout');
  for (const f of ['x.sqlite', 'data/x.sqlite', 'x.sqlite-wal', 'x.sqlite-shm', 'x.sqlite-journal']) {
    assert.ok(git('check-ignore', '-q', f) !== null, f + ' should be ignored');
  }
});

test('no database files are tracked under data/', (t) => {
  const out = git('ls-files', 'data/');
  if (out === null) return t.skip('not a git checkout');
  assert.deepStrictEqual(out.split('\n').filter(f => f && f !== 'data/.gitkeep'), []);
});
