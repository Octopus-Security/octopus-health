/* Training volume: fetch /volume/api/windows, paint the Body Map figure and a muscle x window grid. */
(function () {
  'use strict';
  var root = document.getElementById('vol-root');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('vol-form'), slider = $('vol-slider'), playBtn = $('vol-play');
  var report = null, cur = 0, timer = null, selected = null;

  // ── colour ────────────────────────────────────────────────────────────────
  // weeklySets: grey = none, blue = under the minimum, green = in range, orange to red = over.
  // Other metrics: one sequential ramp scaled to the biggest value in the report.
  var NONE = '#2a3a44';
  function hsl(h, s, l) { return 'hsl(' + h + ',' + s + '%,' + l + '%)'; }
  function scaleFor(metric, cell, g, max) {
    if (metric === 'weeklySets') {
      if (cell.status === 'untrained') return NONE;
      if (cell.status === 'under') return hsl(210, 70, 30 + 25 * Math.min(1, cell.weeklySets / Math.max(g.min, 1)));
      if (cell.status === 'ok') return hsl(140, 55, 38);
      var over = Math.min(1, (cell.weeklySets - g.max) / Math.max(g.max, 1)); // 0 at max, 1 at double
      return hsl(35 - 35 * over, 85, 48);
    }
    var v = cell[metric];
    if (!(v > 0)) return NONE;
    return hsl(190, 60, 22 + 33 * Math.min(1, v / Math.max(max, 1)));
  }
  function legend(metric, g) {
    var el = $('vol-legend'); el.textContent = '';
    var items = metric === 'weeklySets'
      ? [[NONE, 'none'], [hsl(210, 70, 45), 'under ' + g.min], [hsl(140, 55, 38), g.min + '-' + g.max + ' ok'], [hsl(20, 85, 48), 'over ' + g.max]]
      : [[NONE, 'none'], [hsl(190, 60, 30), 'low'], [hsl(190, 60, 55), 'high']];
    items.forEach(function (it) {
      var s = document.createElement('span'), i = document.createElement('i');
      i.style.background = it[0]; s.appendChild(i); s.appendChild(document.createTextNode(it[1])); el.appendChild(s);
    });
  }
  function metricMax(metric) {
    var mx = 0;
    report.windows.forEach(function (w) { Object.keys(w.muscles).forEach(function (m) { mx = Math.max(mx, w.muscles[m][metric] || 0); }); });
    return mx;
  }

  // ── painting ──────────────────────────────────────────────────────────────
  function metric() { return $('vol-metric').value; }
  function paint() {
    if (!report || !report.windows.length) return;
    var w = report.windows[cur], g = report.params.guideline, k = metric(), mx = metricMax(k);
    document.querySelectorAll('.vol-part').forEach(function (el) {
      var c = w.muscles[el.getAttribute('data-id')];
      el.querySelectorAll('polygon').forEach(function (p) { p.style.fill = c ? scaleFor(k, c, g, mx) : NONE; });
    });
    document.querySelectorAll('#vol-grid td').forEach(function (td) {
      td.classList.toggle('vol-cur', Number(td.getAttribute('data-w')) === cur);
    });
    $('vol-label').textContent = 'Window ' + (cur + 1) + ' of ' + report.windows.length + ': ' + w.start + ' to ' + w.end + ' (' + report.params.length + ' days)';
    slider.value = String(cur);
    legend(k, g);
    tip();
  }
  function tip() {
    var el = $('vol-tip');
    if (!selected) { el.textContent = 'Tap a muscle for its numbers.'; return; }
    var c = report.windows[cur].muscles[selected], name = (report.muscles.filter(function (m) { return m.id === selected; })[0] || {}).name;
    el.textContent = name + ': ' + c.weeklySets + ' weekly hard sets (' + c.status + '), ' + c.hardSets + ' hard sets, ' + c.sets + ' sets, ' + c.reps + ' reps, ' + c.tonnageLbs + ' lbs' + (c.seconds ? ', ' + c.seconds + ' s held' : '') + '.';
  }
  function select(id) {
    selected = id;
    document.querySelectorAll('.vol-part').forEach(function (el) { el.classList.toggle('vol-sel', el.getAttribute('data-id') === id); });
    tip();
  }

  function buildGrid() {
    var t = $('vol-grid'), cap = t.querySelector('caption');
    t.textContent = ''; if (cap) t.appendChild(cap);
    var g = report.params.guideline, k = metric(), mx = metricMax(k);
    var head = document.createElement('tr'), corner = document.createElement('th');
    corner.className = 'vol-row'; corner.textContent = 'Muscle'; head.appendChild(corner);
    var every = Math.max(1, Math.ceil(report.windows.length / 12));
    report.windows.forEach(function (w, i) {
      var th = document.createElement('th'); th.className = 'vol-col'; th.scope = 'col';
      th.textContent = i % every === 0 ? w.start.slice(5) : ''; th.title = w.start + ' to ' + w.end; head.appendChild(th);
    });
    t.appendChild(head);
    report.muscles.forEach(function (m) {
      var tr = document.createElement('tr'), th = document.createElement('th');
      th.className = 'vol-row'; th.scope = 'row'; th.textContent = m.name; tr.appendChild(th);
      report.windows.forEach(function (w, i) {
        var c = w.muscles[m.id], td = document.createElement('td');
        td.style.background = scaleFor(k, c, g, mx);
        td.setAttribute('data-w', i); td.tabIndex = -1;
        td.title = m.name + ', ' + w.start + ' to ' + w.end + ': ' + c.weeklySets + ' weekly sets (' + c.status + '), ' + c.tonnageLbs + ' lbs';
        td.addEventListener('click', function () { cur = i; select(m.id); paint(); });
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
  }

  // ── data ──────────────────────────────────────────────────────────────────
  function query() {
    var q = new URLSearchParams();
    ['from', 'to', 'length', 'step', 'guidelineMin', 'guidelineMax', 'secondaryCredit'].forEach(function (n) {
      var v = form.elements[n].value; if (v !== '') q.set(n, v);
    });
    return q;
  }
  function links(q) {
    var base = '/volume/api/windows?' + q.toString();
    $('vol-csv').href = base + '&format=csv';
    $('vol-json').href = base;
  }
  function stop() { if (timer) clearInterval(timer); timer = null; playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed', 'false'); }
  function load() {
    stop();
    var q = query(); links(q);
    $('vol-label').textContent = 'Loading...';
    fetch('/volume/api/windows?' + q.toString(), { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok || !x.j.success) { $('vol-label').textContent = (x.j && x.j.error) || 'Could not load volume.'; return; }
        report = x.j;
        form.elements.from.value = report.params.from; form.elements.to.value = report.params.to;
        links(query());
        slider.max = String(Math.max(0, report.windows.length - 1));
        cur = report.windows.length - 1; // newest window first: that is "now"
        if (!report.windows.length) { $('vol-label').textContent = 'The range is shorter than one window.'; return; }
        buildGrid(); paint();
      })
      .catch(function () { $('vol-label').textContent = 'Could not load volume.'; });
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); load(); });
  $('vol-metric').addEventListener('change', function () { if (report) { buildGrid(); paint(); } });
  slider.addEventListener('input', function () { cur = Number(slider.value); paint(); });
  playBtn.addEventListener('click', function () {
    if (timer) { stop(); return; }
    if (!report || report.windows.length < 2) return;
    if (cur >= report.windows.length - 1) cur = 0;
    playBtn.textContent = 'Pause'; playBtn.setAttribute('aria-pressed', 'true');
    timer = setInterval(function () {
      if (cur >= report.windows.length - 1) { stop(); return; }
      cur += 1; paint();
    }, 350);
  });
  document.querySelectorAll('.bm-view-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-view');
      document.querySelectorAll('.bm-svg').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== v; });
      document.querySelectorAll('.bm-view-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  document.querySelectorAll('.vol-part').forEach(function (el) {
    el.addEventListener('click', function () { select(el.getAttribute('data-id')); });
  });
  load();
})();
