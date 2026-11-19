/* Fix exercises: bulk-correct muscles, per-side, category and figure (api/exercise-fix.js).
 * Edits are STAGED here and written only after the server's preview is confirmed. */
(function () {
  'use strict';
  var API = '/logs/api/exercises/fix';
  var VOCAB = JSON.parse(document.getElementById('fx-vocab').textContent);
  var MNAME = {}; VOCAB.forEach(function (m) { MNAME[m.id] = m.name; });
  var SIDE_LABEL = { unilateral: 'each side separately', bilateral: 'both sides together' };
  var ISSUE_LABEL = { 'no-muscles': 'no muscles', 'sides-unset': 'per-side not set', 'not-in-library': 'not in library', tidy: 'other spellings' };

  var rows = [];
  var staged = new Map();      // name -> { field: value }
  var selected = new Set();
  var filter = 'no-muscles';
  var q = '';
  var loggedOnly = true;
  var posesView = false;
  var figObs = null;

  var $ = function (id) { return document.getElementById(id); };
  var list = $('fx-list'), status = $('fx-status');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /** The row as it will be after the staged edits. */
  function current(r) {
    var d = r.def || { category: 'strength', primary: [], secondary: [], sides: null, poseKey: null };
    var s = staged.get(r.name) || {};
    return {
      category: s.category !== undefined ? s.category : d.category,
      primary: s.primaryMuscles !== undefined ? s.primaryMuscles : d.primary,
      secondary: s.secondaryMuscles !== undefined ? s.secondaryMuscles : d.secondary,
      sides: s.sides !== undefined ? s.sides : d.sides,
      poseKey: s.poseKey !== undefined ? s.poseKey : d.poseKey,
    };
  }
  function figureKey(r) {
    var c = current(r);
    return c.poseKey || (window.PoseMap ? PoseMap.keyFor(r.name, c.category) : null);
  }
  function stage(name, patch) {
    var r = rows.find(function (x) { return x.name === name; });
    var cur = Object.assign({}, staged.get(name) || {}, patch);
    // Drop fields that are back to what is stored.
    var d = (r && r.def) || {};
    var same = function (a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); };
    if (cur.sides !== undefined && same(cur.sides, d.sides)) delete cur.sides;
    if (cur.category !== undefined && same(cur.category, d.category)) delete cur.category;
    if (cur.poseKey !== undefined && same(cur.poseKey, d.poseKey)) delete cur.poseKey;
    if (cur.primaryMuscles !== undefined && same(cur.primaryMuscles, d.primary) && (cur.secondaryMuscles === undefined || same(cur.secondaryMuscles, d.secondary))) { delete cur.primaryMuscles; delete cur.secondaryMuscles; }
    if (Object.keys(cur).length) staged.set(name, cur); else staged.delete(name);
  }

  function visible() {
    var ql = q.toLowerCase();
    return rows.filter(function (r) {
      if (loggedOnly && !r.logged) return false;
      if (ql && r.name.toLowerCase().indexOf(ql) < 0) return false;
      if (filter === 'all') return true;
      return r.issues.indexOf(filter) >= 0 || staged.has(r.name);
    });
  }

  function chips(c) {
    if (c.category === 'recovery') return '<span class="fx-chip fx-stretch">stretch (not counted)</span>';
    if (!c.primary.length) return '<span class="fx-chip fx-bad">no muscles</span>';
    return c.primary.map(function (m) { return '<span class="fx-chip fx-p">' + esc(MNAME[m] || m) + '</span>'; }).join('')
      + c.secondary.map(function (m) { return '<span class="fx-chip">' + esc(MNAME[m] || m) + '</span>'; }).join('');
  }

  function rowHtml(r) {
    var c = current(r), s = r.suggest, st = staged.has(r.name);
    var meta = r.logged ? r.sets + ' set' + (r.sets === 1 ? '' : 's') + (r.last ? ' · last ' + esc(r.last) : '') : 'library only';
    if (r.perSideNotes) meta += ' · ' + r.perSideNotes + ' logged "each side"';
    var tags = r.issues.filter(function (i) { return i !== 'no-muscles' && (i !== 'sides-unset' || !c.sides); }).map(function (i) { return '<span class="fx-tag">' + ISSUE_LABEL[i] + '</span>'; }).join('');
    if (r.def && !r.def.isCustom) tags += '<span class="fx-tag fx-cat">catalogue</span>';
    var sugg = '';
    if (s.muscles && !c.primary.length && c.category !== 'recovery') {
      sugg += '<div class="fx-sugg">Suggest muscles of <strong>' + esc(s.muscles.from) + '</strong> (' + esc(s.muscles.why) + '): '
        + s.muscles.primary.map(function (m) { return esc(MNAME[m] || m); }).join(', ')
        + ' <button type="button" class="mini" data-act="take-muscles">Use</button></div>';
    }
    if (s.sides && !c.sides) {
      sugg += '<div class="fx-sugg">Suggest <strong>' + SIDE_LABEL[s.sides.sides] + '</strong> (' + esc(s.sides.why) + ') <button type="button" class="mini" data-act="take-sides">Use</button></div>';
    }
    var cats = ['strength', 'conditioning', 'cardio', 'mma', 'bjj', 'muay_thai', 'recovery'];
    var poses = window.PoseMap ? PoseMap.keys() : [];
    return '<li class="fx-row' + (st ? ' fx-staged' : '') + (selected.has(r.name) ? ' fx-sel' : '') + '" data-name="' + esc(r.name) + '">'
      + '<label class="fx-pick"><input type="checkbox"' + (selected.has(r.name) ? ' checked' : '') + ' aria-label="Select ' + esc(r.name) + '"></label>'
      + '<div class="fx-fig" data-pose="' + esc(figureKey(r) || '') + '"></div>'
      + '<div class="fx-main">'
      + '<div class="fx-name">' + (r.logged ? '<a href="/logs/exercises/detail?name=' + encodeURIComponent(r.name) + '">' + esc(r.name) + '</a>' : esc(r.name)) + ' <span class="fx-meta">' + meta + '</span></div>'
      + '<div class="fx-tags">' + tags + '</div>'
      + '<div class="fx-muscles">' + chips(c) + '</div>'
      + sugg
      + '<div class="fx-ctrls">'
      + '<label>Per side <select data-field="sides"><option value=""' + (!c.sides ? ' selected' : '') + '>not set</option>'
      + '<option value="unilateral"' + (c.sides === 'unilateral' ? ' selected' : '') + '>each side separately</option>'
      + '<option value="bilateral"' + (c.sides === 'bilateral' ? ' selected' : '') + '>both sides together</option></select></label>'
      + '<label>Category <select data-field="category">' + cats.map(function (k) { return '<option value="' + k + '"' + (c.category === k ? ' selected' : '') + '>' + k.replace('_', ' ') + '</option>'; }).join('') + '</select></label>'
      + '<label>Figure <select data-field="poseKey"><option value=""' + (!c.poseKey ? ' selected' : '') + '>automatic (' + esc(window.PoseMap ? PoseMap.keyFor(r.name, c.category) : '') + ')</option>'
      + poses.map(function (k) { return '<option value="' + esc(k) + '"' + (c.poseKey === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></label>'
      + '</div></div></li>';
  }

  function counts() {
    var base = rows.filter(function (r) { return !loggedOnly || r.logged; });
    document.querySelectorAll('.fx-f').forEach(function (b) {
      var f = b.dataset.f;
      var n = f === 'all' ? base.length : base.filter(function (r) { return r.issues.indexOf(f) >= 0; }).length;
      b.querySelector('.fx-n').textContent = '(' + n + ')';
      b.setAttribute('aria-pressed', String(f === filter));
    });
  }

  function render() {
    counts();
    var v = visible();
    if (posesView) v = v.slice().sort(function (a, b) { return String(figureKey(a)).localeCompare(String(figureKey(b))) || a.name.localeCompare(b.name); });
    status.textContent = v.length ? v.length + ' shown' + (filter !== 'all' ? ' (rows you changed stay in view)' : '') : (filter === 'all' ? 'Nothing here.' : 'Nothing needs this fix. 🎉');
    var html = '', lastKey = null;
    v.forEach(function (r) {
      if (posesView) { var k = figureKey(r); if (k !== lastKey) { html += '<li class="fx-group"><h3>' + esc(k) + '</h3></li>'; lastKey = k; } }
      html += rowHtml(r);
    });
    list.classList.toggle('fx-grid', posesView);
    list.innerHTML = html;
    mountFigures();
    bars();
  }

  function bars() {
    var nSel = selected.size, nStaged = staged.size;
    $('fx-bulk').hidden = !nSel;
    $('fx-selcount').textContent = nSel + ' selected';
    $('fx-savebar').hidden = !nStaged;
    $('fx-pending').textContent = nStaged + ' exercise' + (nStaged === 1 ? '' : 's') + ' changed, not saved';
    $('fx-bar').hidden = !nSel && !nStaged;
    document.body.classList.toggle('fx-has-bar', !!(nSel || nStaged));
  }

  // Figures: mounted when a row comes near the viewport; a bad pose shows text, never breaks the list.
  function mountFigures() {
    if (!('IntersectionObserver' in window)) return;
    if (figObs) figObs.disconnect();
    figObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { figObs.unobserve(e.target); mountOne(e.target, 0); } });
    }, { rootMargin: '200px' });
    list.querySelectorAll('.fx-fig[data-pose]').forEach(function (el) { if (el.dataset.pose) figObs.observe(el); });
  }
  function mountOne(el, tries) {
    if (!el.isConnected) return;
    if (typeof StickFigurePlayer === 'undefined') { if (tries < 100) setTimeout(function () { mountOne(el, tries + 1); }, 100); return; }
    try {
      StickFigurePlayer.mount(el, el.dataset.pose, { autoplay: posesView }, function (err, p) {
        if (err) el.innerHTML = '<span class="fx-nofig">no figure</span>';
        else if (p && !el.isConnected) p.destroy();
      });
    } catch (e) { el.innerHTML = '<span class="fx-nofig">no figure</span>'; }
  }

  // --- row events
  list.addEventListener('change', function (e) {
    var li = e.target.closest('.fx-row'); if (!li) return;
    var name = li.dataset.name;
    if (e.target.type === 'checkbox') {
      if (e.target.checked) selected.add(name); else selected.delete(name);
      li.classList.toggle('fx-sel', e.target.checked); bars(); return;
    }
    var f = e.target.dataset.field; if (!f) return;
    var patch = {}; patch[f] = e.target.value || null;
    stage(name, patch); rerow(name);
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var r = rows.find(function (x) { return x.name === b.closest('.fx-row').dataset.name; });
    if (b.dataset.act === 'take-muscles') takeMuscles(r);
    if (b.dataset.act === 'take-sides') stage(r.name, { sides: r.suggest.sides.sides });
    rerow(r.name);
  });
  function takeMuscles(r) {
    var m = r.suggest.muscles; if (!m) return;
    var patch = { primaryMuscles: m.primary.slice(), secondaryMuscles: m.secondary.filter(function (x) { return m.primary.indexOf(x) < 0; }) };
    if (current(r).category === 'recovery' || !r.def) patch.category = m.category && m.category !== 'recovery' ? m.category : 'strength';
    stage(r.name, patch);
  }
  function rerow(name) {
    var li = list.querySelector('.fx-row[data-name="' + CSS.escape(name) + '"]');
    var r = rows.find(function (x) { return x.name === name; });
    if (li && r) { var t = document.createElement('div'); t.innerHTML = rowHtml(r); var n = t.firstChild; li.replaceWith(n); if (figObs && n.querySelector('.fx-fig').dataset.pose) figObs.observe(n.querySelector('.fx-fig')); }
    counts(); bars();
  }

  // --- filters and tools
  document.querySelectorAll('.fx-f').forEach(function (b) { b.addEventListener('click', function () { filter = b.dataset.f; render(); }); });
  $('fx-q').addEventListener('input', function (e) { q = e.target.value.trim(); render(); });
  $('fx-logged').addEventListener('change', function (e) { loggedOnly = e.target.checked; render(); });
  $('fx-poses').addEventListener('change', function (e) { posesView = e.target.checked; render(); });
  $('fx-all').addEventListener('click', function () { visible().forEach(function (r) { selected.add(r.name); }); render(); });

  // --- bulk bar
  document.querySelectorAll('[data-bulk]').forEach(function (b) {
    b.addEventListener('click', function () {
      var names = Array.from(selected), act = b.dataset.bulk;
      var byName = function (n) { return rows.find(function (x) { return x.name === n; }); };
      if (act === 'none') { selected.clear(); render(); return; }
      if (act === 'muscles') { openMuscles(); return; }
      names.forEach(function (n) {
        var r = byName(n); if (!r) return;
        if (act === 'accept') {
          if (r.suggest.muscles && !current(r).primary.length && current(r).category !== 'recovery') takeMuscles(r);
          if (r.suggest.sides && !current(r).sides) stage(n, { sides: r.suggest.sides.sides });
        }
        if (act === 'uni') stage(n, { sides: 'unilateral' });
        if (act === 'bi') stage(n, { sides: 'bilateral' });
        if (act === 'copy') {
          var from = rows.find(function (x) { return x.name.toLowerCase() === $('fx-copy').value.trim().toLowerCase(); });
          if (from) { var c = current(from); if (c.primary.length) stage(n, { primaryMuscles: c.primary.slice(), secondaryMuscles: c.secondary.slice(), category: c.category === 'recovery' ? 'strength' : c.category }); }
        }
      });
      if (act === 'copy' && !rows.some(function (x) { return x.name.toLowerCase() === $('fx-copy').value.trim().toLowerCase(); })) { status.textContent = 'No exercise called "' + $('fx-copy').value + '" to copy from.'; }
      render();
    });
  });
  $('fx-cat').addEventListener('change', function (e) { if (!e.target.value) return; selected.forEach(function (n) { stage(n, { category: e.target.value }); }); e.target.value = ''; render(); });
  $('fx-pose').addEventListener('change', function (e) { if (!e.target.value) return; var v = e.target.value === '__auto' ? null : e.target.value; selected.forEach(function (n) { stage(n, { poseKey: v }); }); e.target.value = ''; render(); });

  function openMuscles() {
    var dlg = $('fx-muscles-dlg');
    dlg.querySelectorAll('input[type=radio][value=""]').forEach(function (i) { i.checked = true; });
    dlg.returnValue = '';
    dlg.showModal();
  }
  $('fx-muscles-dlg').addEventListener('close', function () {
    var dlg = $('fx-muscles-dlg'); if (dlg.returnValue !== 'ok') return;
    var p = [], s = [];
    VOCAB.forEach(function (m) { var v = dlg.querySelector('input[name="m-' + m.id + '"]:checked'); if (v && v.value === 'p') p.push(m.id); if (v && v.value === 's') s.push(m.id); });
    if (!p.length) { status.textContent = 'Pick at least one primary muscle.'; return; }
    selected.forEach(function (n) {
      var r = rows.find(function (x) { return x.name === n; });
      var patch = { primaryMuscles: p, secondaryMuscles: s };
      if (r && current(r).category === 'recovery') patch.category = 'strength';
      stage(n, patch);
    });
    render();
  });

  // --- save: server preview, then confirm
  function payload() { return Array.from(staged.entries()).map(function (e) { return Object.assign({ name: e[0] }, e[1]); }); }
  function post(confirm) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ changes: payload(), confirm: !!confirm }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || 'Saving failed'); return j; }); });
  }
  function diffText(b, a) {
    var out = [];
    // A new library entry has no "before": compare with what a new one would be, so unchanged fields stay quiet.
    b = b || { category: null, sides: null, poseKey: null, primaryMuscles: [], secondaryMuscles: [] };
    var mus = function (x) { return x && x.primaryMuscles.length ? x.primaryMuscles.map(function (m) { return MNAME[m] || m; }).join(', ') + (x.secondaryMuscles.length ? ' (+ ' + x.secondaryMuscles.map(function (m) { return MNAME[m] || m; }).join(', ') + ')' : '') : 'none'; };
    if (mus(b) !== mus(a)) out.push('muscles: ' + mus(b) + ' → ' + mus(a));
    if ((b.sides || null) !== (a.sides || null)) out.push('per side: ' + (b.sides ? SIDE_LABEL[b.sides] : 'not set') + ' → ' + (a.sides ? SIDE_LABEL[a.sides] : 'not set'));
    if (b.category !== a.category) out.push('category: ' + (b.category || 'new') + ' → ' + a.category);
    if ((b.poseKey || null) !== (a.poseKey || null)) out.push('figure: ' + (b.poseKey ? b.poseKey : 'automatic') + ' → ' + (a.poseKey || 'automatic'));
    return out;
  }
  $('fx-review').addEventListener('click', function () {
    status.textContent = 'Checking…';
    post(false).then(function (j) {
      $('fx-review-body').innerHTML = '<p class="ex-sub">' + j.changes.length + ' exercise' + (j.changes.length === 1 ? '' : 's') + '. Nothing is saved until you press Save all.</p><ul class="fx-diff">'
        + j.changes.map(function (c) {
          return '<li><strong>' + esc(c.name) + '</strong>' + (c.action === 'create' ? ' <span class="fx-tag">added to your library</span>' : '') + (c.catalogue ? ' <span class="fx-tag fx-cat">your copy of a catalogue exercise</span>' : '')
            + '<br><span class="fx-meta">' + diffText(c.before, c.after).map(esc).join('<br>') + '</span></li>';
        }).join('') + '</ul>';
      status.textContent = '';
      $('fx-review-dlg').returnValue = '';
      $('fx-review-dlg').showModal();
    }).catch(function (e) { status.textContent = e.message; });
  });
  $('fx-review-dlg').addEventListener('close', function () {
    if ($('fx-review-dlg').returnValue !== 'ok') return;
    status.textContent = 'Saving…';
    post(true).then(function (j) {
      staged.clear(); selected.clear();
      status.textContent = 'Saved ' + j.saved + '. The Body Map and volume use the new values now.';
      return load(true);
    }).catch(function (e) { status.textContent = e.message; });
  });
  $('fx-discard').addEventListener('click', function () { staged.clear(); render(); });
  window.addEventListener('beforeunload', function (e) { if (staged.size) { e.preventDefault(); e.returnValue = ''; } });

  function load(keepStatus) {
    return fetch(API, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'Could not load');
      rows = j.rows;
      $('fx-names').innerHTML = rows.filter(function (r) { return r.def && r.def.primary.length; }).map(function (r) { return '<option value="' + esc(r.name) + '">'; }).join('');
      var msg = status.textContent;
      // Start on the first filter that has something in it.
      if (!keepStatus) { var order = ['no-muscles', 'sides-unset', 'not-in-library', 'tidy']; filter = order.find(function (f) { return rows.some(function (r) { return r.logged && r.issues.indexOf(f) >= 0; }); }) || 'all'; }
      render();
      if (keepStatus) status.textContent = msg;
    }).catch(function (e) { status.textContent = e.message; });
  }
  var qs = new URLSearchParams(location.search);
  if (qs.get('q')) { q = qs.get('q'); $('fx-q').value = q; }
  load(false).then(function () { if (qs.get('show') && document.querySelector('.fx-f[data-f="' + qs.get('show') + '"]')) { filter = qs.get('show'); render(); } });
})();
