// Ratchet helper: a guard keeps an explicit list of KNOWN offenders, each with a reason and the audit
// finding it came from (docs/EXERCISE-AUDIT.md). The check fails on
//   - any offender that is not on the list (a new problem), and
//   - any listed entry that is no longer an offender (it was fixed: delete it from the list),
// so the lists only ever shrink.
const assert = require('node:assert/strict');

function ratchet(label, actualKeys, known) {
  const seen = new Set();
  for (const k of known) {
    assert.ok(k.key && k.finding && k.reason, `${label}: every known entry needs key, finding and reason (${JSON.stringify(k)})`);
    assert.ok(!seen.has(k.key), `${label}: duplicate known entry ${k.key}`);
    seen.add(k.key);
  }
  const actual = new Set(actualKeys);
  const added = [...actual].filter(k => !seen.has(k)).sort();
  const fixed = [...seen].filter(k => !actual.has(k)).sort();
  assert.deepEqual(added, [], `${label}: NEW offenders (fix them, or add to the known list with a reason and finding):\n  ${added.join('\n  ')}`);
  assert.deepEqual(fixed, [], `${label}: these known entries are now fixed - delete them from test/helpers/exercise-ratchet.js:\n  ${fixed.join('\n  ')}`);
}

module.exports = { ratchet };
