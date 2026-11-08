// Require FIRST in any test that touches a database: points DATA_DIR at a temp
// dir (removed on exit) so tests never write into the repo's data/.
const fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'health-test-'));
process.env.DATA_DIR = dir;
process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });
module.exports = dir;
