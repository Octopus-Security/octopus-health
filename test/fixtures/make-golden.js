// Regenerates stick-figure-golden.json. Only run this when single-figure drawing is MEANT to change.
//   node test/fixtures/make-golden.js > test/fixtures/stick-figure-golden.json
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..', '..');
const SF = require(path.join(root, 'public/stick-figure.js'));
const out = {};
(function walk(d, pre) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name), pre + f.name + '/');
    else if (f.name.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(path.join(d, f.name), 'utf8'));
      if (SF.hasPartner(data)) continue;
      const h = crypto.createHash('sha256');
      SF.resolveFrames(data).forEach((_, i) => { h.update(SF.svgFor(data, i, 0)); h.update(SF.svgFor(data, i, 0.5)); });
      const dur = SF.duration(data);
      for (let k = 0; k <= 24; k++) h.update(SF.svgAt(data, dur * k / 24));
      out[pre + f.name.slice(0, -5)] = h.digest('hex').slice(0, 16);
    }
  }
})(path.join(root, 'public/poses'), '');
console.log(JSON.stringify(out));
