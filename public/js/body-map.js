/* Body map: select a muscle or joint, fetch its stretches and exercises. */
(function () {
  'use strict';
  var panel = document.getElementById('bm-panel');
  if (!panel) return;
  var $ = function (id) { return document.getElementById(id); };
  var selected = null, seq = 0, currentView = 'front';

  // Class, not the SVG hidden property. Setting .hidden on an SVG does not
  // reliably change the attribute, and display:block on .bm-svg then keeps
  // both figures. The front one stays on screen, so Back looks selected
  // while the front muscles are what you still see and tap.
  function setView(view) {
    currentView = view === 'back' ? 'back' : 'front';
    document.querySelectorAll('.bm-svg').forEach(function (s) {
      var on = s.getAttribute('data-view') === currentView;
      s.classList.toggle('bm-on', on);
      if (on) s.removeAttribute('hidden');
      else s.setAttribute('hidden', '');
    });
    document.querySelectorAll('.bm-view-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === currentView));
    });
    document.querySelectorAll('.bm-chip[data-view]').forEach(function (c) {
      var v = c.getAttribute('data-view');
      var show = v === 'both' || v === currentView;
      if (show) c.removeAttribute('hidden');
      else c.setAttribute('hidden', '');
    });
    viewNote();
  }

  function viewNote() {
    var note = $('bm-view-note');
    if (!note) return;
    if (!selected || selected.kind !== 'muscle') { note.textContent = ''; return; }
    var chip = document.querySelector('.bm-chip[data-kind="muscle"][data-id="' + selected.id + '"]');
    var mv = chip && chip.getAttribute('data-view');
    note.textContent = (mv && mv !== 'both' && mv !== currentView)
      ? 'That muscle is drawn on the ' + mv + '. This view shows the other side.'
      : '';
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

  function loadMobility(kind, id, mine) {
    var ul = $('bm-mobility'); if (!ul) return;
    ul.textContent = ''; $('bm-n-mobility').textContent = '';
    fetch('/mobility/api/' + kind + '/' + encodeURIComponent(id), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (mine !== seq || !j.success) return;
        $('bm-n-mobility').textContent = '(' + j.items.length + ')';
        $('bm-mobility-note').textContent = j.note;
        if (!j.items.length) { var n = document.createElement('li'); n.className = 'bm-none'; n.textContent = 'No routine drills for this yet.'; ul.appendChild(n); return; }
        j.items.forEach(function (e) {
          var li = document.createElement('li');
          var a = document.createElement(window.StretchDemo ? 'button' : 'span');
          if (window.StretchDemo) { a.type = 'button'; window.StretchDemo.link(a, { id: null, name: e.demo, category: 'recovery' }); }
          a.textContent = e.name; li.appendChild(a);
          var s = document.createElement('span'); s.className = 'bm-meta'; s.textContent = e.rx + ' - ' + e.routine + (e.tool ? ' - ' + e.tool : '') + (e.swapNote ? ' - ' + e.swapNote : ''); li.appendChild(s);
          ul.appendChild(li);
        });
      })
      .catch(function () { /* the rest of the panel is unaffected */ });
  }

  function open() { panel.setAttribute('data-open', 'true'); }
  function close() { panel.setAttribute('data-open', 'false'); }
  $('bm-close').addEventListener('click', close);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });

  var week = null;
  var WEEK_STATUS = { untrained: 1, under: 1, ok: 1, over: 1 };

  function weekLine(id) {
    var el = $('bm-week');
    if (!el) return;
    var c = week && week.byId && week.byId[id];
    if (!c) { el.textContent = ''; return; }
    var g = week.guideline || { min: 10, max: 20 };
    var sentence = c.weeklySets + ' hard sets in the last 7 days. ';
    if (c.status === 'untrained') sentence += 'Nothing logged hits this muscle. The primary exercises below are the direct work.';
    else if (c.status === 'under') sentence += 'Short of ' + g.min + '. The primary list is what adds sets.';
    else if (c.status === 'ok') sentence += 'Inside ' + g.min + ' to ' + g.max + '.';
    else if (c.status === 'over') sentence += 'Past ' + g.max + '. More sets are optional. That ceiling is a working assumption.';
    var n = week.unassigned ? week.unassigned.length : 0;
    if (n) sentence += ' ' + n + (n === 1 ? ' logged exercise is' : ' logged exercises are') + ' not on the map yet. Assign the muscles below. Nothing is guessed.';
    el.textContent = sentence;
  }

  function applyWeek(report) {
    var w = report.windows[report.windows.length - 1];
    week = { byId: w.muscles, guideline: report.params.guideline, start: w.start, end: w.end, unassigned: (report.skipped && report.skipped.exercises) || [] };
    if (window.Unassigned) {
      var muscles = [];
      try { muscles = JSON.parse((document.getElementById('bm-muscles') || {}).textContent || '[]'); } catch (e) { muscles = []; }
      window.Unassigned.mount(document.getElementById('bm-unassigned'), { exercises: week.unassigned, muscles: muscles, onSaved: loadWeek });
    }
    document.querySelectorAll('.bm-part[data-kind="muscle"], .bm-chip[data-kind="muscle"]').forEach(function (el) {
      var c = w.muscles[el.getAttribute('data-id')];
      if (!c || !WEEK_STATUS[c.status]) { el.removeAttribute('data-week'); return; }
      el.setAttribute('data-week', c.status);
      if (el.classList.contains('bm-chip')) el.title = c.weeklySets + ' hard sets, ' + c.status;
    });
    var legend = $('bm-week-legend');
    if (legend) legend.textContent = w.start + ' to ' + w.end + '.';
    if (selected && selected.kind === 'muscle') weekLine(selected.id);
  }

  function loadWeek() {
    var fig = document.querySelector('.bm-figure');
    var from = fig && fig.getAttribute('data-week-from');
    var to = fig && fig.getAttribute('data-week-to');
    var legend = $('bm-week-legend');
    if (!from || !to) return;
    fetch('/volume/api/windows?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&length=7&step=7', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.j.success || !res.j.windows || !res.j.windows.length) throw new Error('no window');
        applyWeek(res.j);
      })
      .catch(function () {
        if (legend) legend.textContent = 'This week\'s sets could not load. Muscles and exercises still work.';
      });
  }

  function select(kind, id) {
    selected = { kind: kind, id: id };
    mark(kind, id);
    viewNote();
    if (kind === 'muscle') weekLine(id);
    else if ($('bm-week')) $('bm-week').textContent = '';
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
        loadMobility(kind, id, mine);
      })
      .catch(function () {
        if (mine !== seq) return;
        $('bm-title').textContent = 'Could not load';
        $('bm-sub').textContent = 'Try again in a moment.';
      });
  }

  if (window.DailyStretches) window.DailyStretches.load().catch(function () { /* toggles just read 'add' until it loads */ });

  loadWeek();

  document.querySelectorAll('[data-kind][data-id]').forEach(function (el) {
    el.addEventListener('click', function () { select(el.getAttribute('data-kind'), el.getAttribute('data-id')); });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(el.getAttribute('data-kind'), el.getAttribute('data-id')); }
    });
  });
})();
