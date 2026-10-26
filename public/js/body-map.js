/* Body map: select a muscle or joint, fetch its stretches and exercises. */
(function () {
  'use strict';
  var panel = document.getElementById('bm-panel');
  if (!panel) return;
  var $ = function (id) { return document.getElementById(id); };
  var selected = null, seq = 0;

  function setView(view) {
    document.querySelectorAll('.bm-svg').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== view; });
    document.querySelectorAll('.bm-view-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === view));
    });
  }
  document.querySelectorAll('.bm-view-btn').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });

  function mark(kind, id) {
    document.querySelectorAll('[data-kind][data-id]').forEach(function (el) {
      var on = el.getAttribute('data-kind') === kind && el.getAttribute('data-id') === id;
      el.setAttribute('aria-pressed', String(on));
    });
  }

  function fmt(e) {
    var bits = [];
    if (e.defaultDuration) bits.push((e.defaultSets ? e.defaultSets + ' x ' : '') + e.defaultDuration + 's');
    else if (e.defaultSets && e.defaultReps) bits.push(e.defaultSets + ' x ' + e.defaultReps);
    if (e.equipment && e.equipment !== 'none') bits.push(String(e.equipment).replace(/_/g, ' '));
    if (e.isCustom) bits.push('custom');
    return bits.join(' - ');
  }

  function fill(listId, countId, items, emptyText, withDaily) {
    var ul = $(listId); ul.textContent = '';
    $(countId).textContent = '(' + items.length + ')';
    if (!items.length) {
      var li = document.createElement('li'); li.className = 'bm-none'; li.textContent = emptyText; ul.appendChild(li); return;
    }
    items.forEach(function (e) {
      var li = document.createElement('li');
      var a = document.createElement(window.StretchDemo ? 'button' : 'a');
      if (window.StretchDemo) { a.type = 'button'; window.StretchDemo.link(a, e); }
      else a.href = '/library?ex=' + encodeURIComponent(e.id);
      a.textContent = e.name;
      li.appendChild(a);
      var m = fmt(e);
      if (m) { var s = document.createElement('span'); s.className = 'bm-meta'; s.textContent = m; li.appendChild(s); }
      if (withDaily && window.DailyStretches) li.appendChild(window.DailyStretches.toggleButton(e));
      ul.appendChild(li);
    });
  }

  function open() { panel.setAttribute('data-open', 'true'); }
  function close() { panel.setAttribute('data-open', 'false'); }
  $('bm-close').addEventListener('click', close);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });

  function select(kind, id) {
    selected = { kind: kind, id: id };
    mark(kind, id);
    var mine = ++seq;
    $('bm-empty').hidden = true;
    $('bm-result').hidden = false;
    $('bm-title').textContent = 'Loading...';
    $('bm-sub').textContent = '';
    open();
    fetch('/body/api/exercises?' + kind + '=' + encodeURIComponent(id), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (mine !== seq) return; // a newer click won
        if (!res.ok || !res.j.success) throw new Error((res.j && res.j.error) || 'failed');
        var d = res.j;
        $('bm-title').textContent = d.target.name;
        $('bm-sub').textContent = kind === 'joint'
          ? 'Mobility work and exercises for the muscles that cross this joint.'
          : (d.target.joints && d.target.joints.length ? 'Crosses: ' + d.target.joints.map(function (j) { return j.replace(/_/g, ' '); }).join(', ') : '');
        fill('bm-stretches', 'bm-n-stretch', d.stretches, 'No stretches for this yet.', true);
        fill('bm-primary', 'bm-n-primary', d.primary, 'None.');
        fill('bm-secondary', 'bm-n-secondary', d.secondary, 'None.');
        panel.scrollTop = 0;
      })
      .catch(function () {
        if (mine !== seq) return;
        $('bm-title').textContent = 'Could not load';
        $('bm-sub').textContent = 'Try again in a moment.';
      });
  }

  if (window.DailyStretches) window.DailyStretches.load().catch(function () { /* toggles just read 'add' until it loads */ });

  document.querySelectorAll('[data-kind][data-id]').forEach(function (el) {
    el.addEventListener('click', function () { select(el.getAttribute('data-kind'), el.getAttribute('data-id')); });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(el.getAttribute('data-kind'), el.getAttribute('data-id')); }
    });
  });
})();
