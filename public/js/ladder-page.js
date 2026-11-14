/**
 * Agility ladder designer. The page posts the form to /ladder/api/plan and
 * draws that answer. Meshes stay on the server. data-token on #fit is the
 * last DOM write of each update so a headless check can see that it finished.
 */
(function () {
  var bootEl = document.getElementById('ladder-boot');
  var boot = { input: { runs: [{ squares: 4, turn: 0 }] } };
  try { boot = JSON.parse(bootEl.textContent); } catch (e) { /* server HTML still shows */ }
  var runs = ((boot.input && boot.input.runs) || [{ squares: 4, turn: 0 }]).map(function (run) {
    return { squares: Number(run.squares) || 1, turn: Number(run.turn) || 0 };
  });
  var form = document.getElementById('ladder-form');
  var fit = document.getElementById('fit');
  var seq = 0;
  var token = 0;
  var timer = null;
  var writing = false;

  function val(id) {
    return document.getElementById(id).value;
  }

  function payload() {
    var ports = val('ports');
    return {
      printer: val('printer'),
      bed: Number(val('bed')),
      rails: val('rails'),
      rungs: val('rungs'),
      width: Number(val('width')),
      spacing: Number(val('spacing')),
      grip: Number(val('grip')),
      cord: Number(val('cord')),
      stickW: Number(val('stickW')),
      stickH: Number(val('stickH')),
      dowel: Number(val('dowel')),
      ports: ports === 'auto' ? 'auto' : Number(ports),
      runs: runs.map(function (run) { return { squares: run.squares, turn: run.turn }; }),
    };
  }

  function either(kind) {
    return val('rails') === kind || val('rungs') === kind;
  }

  function showFields() {
    document.getElementById('field-bed').hidden = val('printer') !== 'custom';
    document.getElementById('field-cord').hidden = !either('cord');
    document.getElementById('field-stick-w').hidden = !either('stick');
    document.getElementById('field-stick-h').hidden = !either('stick');
    document.getElementById('field-dowel').hidden = !either('dowel');
  }

  function pathText() {
    return runs.map(function (run) {
      var s = run.squares + (run.squares === 1 ? ' bay' : ' bays');
      if (run.turn) s += ', then ' + (run.turn > 0 ? 'left ' : 'right ') + Math.abs(run.turn) + '°';
      return s;
    }).join(' · ');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    el.hidden = !text;
    el.textContent = text || '';
  }

  function markPresets() {
    var rails = val('rails');
    var rungs = val('rungs');
    var narrow = rails === 'stick' && rungs === 'stick' && val('width') === '190' && val('spacing') === '190';
    var name = narrow ? 'narrow'
      : (rails === 'cord' && rungs === 'stick' ? 'cord-stick'
        : (rails === 'cord' && rungs === 'dowel' ? 'cord-dowel'
          : (rails === 'stick' && rungs === 'stick' ? 'all-stick' : '')));
    document.querySelectorAll('#presets button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-preset') === name ? 'true' : 'false');
    });
  }

  function paint(plan) {
    writing = true;
    showFields();
    setText('fit-line', plan.fitLine || plan.error || (plan.lines && plan.lines[0]) || '');
    setText('grip-line', plan.gripLine || '');
    setText('rung-line', plan.rungLine || '');
    setText('rail-line', plan.railLine || '');
    setText('cord-line', plan.cordLine || '');
    setText('dowel-line', plan.dowelLine && plan.dowelLine !== plan.rungLine ? plan.dowelLine : '');
    var extra = (plan.messages || []).slice(2).concat(plan.warnings || []);
    if (plan.ok === false && plan.error && extra.indexOf(plan.error) === -1) extra.unshift(plan.error);
    setText('notice', extra.join(' '));
    document.getElementById('ports-note').textContent = plan.portsNote || '';
    var ports = document.getElementById('ports');
    var opt4 = ports.querySelector('option[value="4"]');
    if (plan.lockPorts) {
      if (ports.value === '4' || ports.value === 'auto') ports.value = '8';
      opt4.disabled = true;
    } else {
      opt4.disabled = false;
    }
    document.getElementById('path-text').textContent = pathText();
    var counts = plan.counts;
    setText('counts', counts
      ? counts.couplers + ' connectors · ' + counts.pins + ' pins · ' + counts.joiners + ' joiners · ' + counts.rungPieces + ' rung pieces · ' + counts.railPieces + ' rail pieces'
      : '');
    var list = document.getElementById('parts');
    list.replaceChildren();
    (plan.parts || []).forEach(function (row) {
      var li = document.createElement('li');
      li.textContent = row.count + ' × ' + row.name + ' (' + row.size + ')';
      list.appendChild(li);
    });
    var preview = document.getElementById('preview');
    preview.innerHTML = plan.svg || '';
    if (plan.rails) {
      var pack = [];
      if (plan.rails === 'cord' || plan.rungs === 'cord') pack.push('Paracord connectors slide along the cord. Push them together to pack the ladder. The knots stay in the cups on the ends.');
      if (plan.rails === 'stick' || plan.rungs === 'stick') pack.push('Printed bars pull out after you push the pins up from below.');
      if (plan.rails === 'dowel' || plan.rungs === 'dowel') pack.push('A dowel sits in a square channel and is held with a zip tie.');
      document.getElementById('pack-note').textContent = pack.join(' ');
    }
    markPresets();
    writing = false;
    token += 1;
    fit.dataset.token = String(token);
  }

  function refresh() {
    var mine = ++seq;
    showFields();
    markPresets();
    return fetch('/ladder/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) {
      return res.json().then(function (plan) {
        if (!res.ok && plan && !plan.error) plan.error = 'Could not build that ladder.';
        return plan;
      });
    }).then(function (plan) {
      if (mine !== seq) return;
      paint(plan);
    }).catch(function () {
      if (mine !== seq) return;
      paint({ ok: false, error: 'Could not reach the planner.', parts: [], svg: '' });
    });
  }

  function soon() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 250);
  }

  function now() {
    clearTimeout(timer);
    return refresh();
  }

  form.addEventListener('submit', function (ev) { ev.preventDefault(); now(); });
  form.addEventListener('input', function () {
    if (writing) return;
    soon();
  });
  form.addEventListener('change', function () {
    if (writing) return;
    showFields();
    now();
  });

  function setMaterials(rails, rungs) {
    document.getElementById('rails').value = rails;
    document.getElementById('rungs').value = rungs;
    showFields();
  }

  document.getElementById('presets').addEventListener('click', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;
    var kind = btn.getAttribute('data-preset');
    if (kind === 'cord-stick') setMaterials('cord', 'stick');
    if (kind === 'cord-dowel') setMaterials('cord', 'dowel');
    if (kind === 'all-stick') setMaterials('stick', 'stick');
    if (kind === 'narrow') {
      setMaterials('stick', 'stick');
      document.getElementById('width').value = '190';
      document.getElementById('spacing').value = '190';
    }
    now();
  });

  function addBay() {
    var last = runs[runs.length - 1];
    if (last.turn) {
      if (runs.length >= 8) return;
      runs.push({ squares: 1, turn: 0 });
    } else if (last.squares < 20) {
      last.squares += 1;
    }
  }

  function turn(deg) {
    var last = runs[runs.length - 1];
    if (last.turn) return;
    if (runs.length >= 8) return;
    last.turn = deg;
    runs.push({ squares: 1, turn: 0 });
  }

  function undo() {
    if (runs.length > 1) {
      var last = runs[runs.length - 1];
      if (last.squares === 1 && !last.turn) {
        runs.pop();
        runs[runs.length - 1].turn = 0;
        return;
      }
    }
    var last = runs[runs.length - 1];
    if (last.squares > 1) {
      last.squares -= 1;
      return;
    }
    if (last.turn) last.turn = 0;
  }

  document.getElementById('add-bay').addEventListener('click', function () { addBay(); now(); });
  document.getElementById('left-45').addEventListener('click', function () { turn(45); now(); });
  document.getElementById('right-45').addEventListener('click', function () { turn(-45); now(); });
  document.getElementById('left-90').addEventListener('click', function () { turn(90); now(); });
  document.getElementById('right-90').addEventListener('click', function () { turn(-90); now(); });
  document.getElementById('undo').addEventListener('click', function () { undo(); now(); });

  document.getElementById('download').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    fetch('/ladder/api/kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/zip, application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (!res.ok || type.indexOf('application/zip') === -1) {
        return res.json().then(function (body) {
          paint({ ok: false, error: (body && body.error) || 'Could not build that kit.', parts: [], svg: '' });
        });
      }
      return res.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'agility-ladder.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      });
    }).catch(function () {
      paint({ ok: false, error: 'Could not reach the planner.', parts: [], svg: '' });
    }).then(function () {
      btn.disabled = false;
    });
  });

  showFields();
  markPresets();
  token = 1;
  fit.dataset.token = '1';

  function waitUntil(fn) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function tick() {
        if (fn()) return resolve(true);
        if (Date.now() - started > 8000) return resolve(false);
        setTimeout(tick, 40);
      })();
    });
  }

  async function runCheck() {
    var problems = [];
    var out = document.getElementById('ladder-check');
    out.hidden = false;
    function currentToken() { return Number(fit.dataset.token); }

    async function after(label, action) {
      var before = currentToken();
      action();
      var ok = await waitUntil(function () { return currentToken() > before; });
      if (!ok) problems.push('timed out: ' + label);
      return ok;
    }

    if (!/A1 mini/i.test(document.getElementById('fit-line').textContent)) {
      problems.push('initial fit ' + document.getElementById('fit-line').textContent);
    }

    await after('add bay', function () { document.getElementById('add-bay').click(); });
    if (!/5 bays/.test(document.getElementById('path-text').textContent)) {
      problems.push('bay count ' + document.getElementById('path-text').textContent);
    }

    await after('left 45', function () { document.getElementById('left-45').click(); });
    var turned = document.getElementById('path-text').textContent;
    if (!/left 45/.test(turned)) problems.push('turn ' + turned);
    if (!/8 socket/.test(document.getElementById('ports-note').textContent)) {
      problems.push('ports ' + document.getElementById('ports-note').textContent);
    }
    if (!document.getElementById('ports').querySelector('option[value="4"]').disabled) {
      problems.push('4 sockets stayed available');
    }

    await after('undo', function () { document.getElementById('undo').click(); });
    if (/45/.test(document.getElementById('path-text').textContent)) {
      problems.push('undo left ' + document.getElementById('path-text').textContent);
    }

    var pathBeforePreset = document.getElementById('path-text').textContent;
    await after('dowel preset', function () { document.querySelector('[data-preset="cord-dowel"]').click(); });
    var rung = document.getElementById('rung-line').textContent;
    if (!/zip tie/i.test(rung)) problems.push('dowel copy ' + rung);
    if (document.getElementById('path-text').textContent !== pathBeforePreset) {
      problems.push('preset changed the path');
    }
    if (!/A1 mini/i.test(document.getElementById('fit-line').textContent)) {
      problems.push('fit lost the printer');
    }

    var rungBefore = rung;
    await after('width', function () {
      var width = document.getElementById('width');
      width.value = '520';
      width.dispatchEvent(new Event('input', { bubbles: true }));
    });
    if (document.getElementById('rung-line').textContent === rungBefore) {
      problems.push('width did not change the rung');
    }

    await after('grip', function () {
      document.getElementById('rails').value = 'stick';
      document.getElementById('rungs').value = 'stick';
      document.getElementById('grip').value = '60';
      document.getElementById('stickW').value = '25';
      document.getElementById('rails').dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (!/Shortened the grip to \d/.test(document.getElementById('notice').textContent)) {
      problems.push('grip clamp ' + document.getElementById('notice').textContent);
    }

    var vw = document.documentElement.clientWidth;
    document.querySelectorAll('.ladder-page button, .ladder-page input, .ladder-page select').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      if (el.tagName === 'BUTTON' && (box.width < 44 || box.height < 44)) {
        problems.push('small button ' + (el.id || el.textContent.trim()) + ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
      }
      if (el.tagName !== 'BUTTON' && box.height < 44) {
        problems.push('small field ' + el.id + ' ' + Math.round(box.height));
      }
      var size = parseFloat(getComputedStyle(el).fontSize);
      if (el.tagName !== 'BUTTON' && size < 16) problems.push('font ' + el.id + ' ' + size);
    });
    document.querySelectorAll('.ladder-page *').forEach(function (el) {
      if (el.closest('svg') || el.closest('[hidden]')) return;
      var box = el.getBoundingClientRect();
      if (box.width > vw + 1) {
        problems.push('wide ' + (el.id || el.className || el.tagName) + ' ' + Math.round(box.width) + '>' + vw);
      }
    });

    out.textContent = (problems.length ? problems.join(' | ') : 'ok') + ' w=' + vw;
    out.dataset.done = '1';
    token += 1;
    fit.dataset.token = String(token);
  }

  if (new URLSearchParams(location.search).get('check') === '1') runCheck();
})();
