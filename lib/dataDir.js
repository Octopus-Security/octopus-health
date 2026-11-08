// Where per-user SQLite files live. Defaults to <repo>/data, which is what the
// production volume (health_data) mounts over, so production is unchanged.
// DATA_DIR overrides it (tests point it at a temp dir).
const path = require('path');
module.exports = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
