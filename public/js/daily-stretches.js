/* Daily stretches: shared state (used by /stretch and /body) and the "My daily stretches" section. */
(function () {
  'use strict';
  var state = { daily: null, presets: [] };
  var listeners = [];
  var inflight = null;

  function keyOf(name) { return String(name || '').trim().toLowerCase(); }

  function api(method, path, body) {
    var opt = { method: method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/stretch/api/daily' + path, opt).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || !j.success) throw new Error((j && j.error) || 'failed'); return j; });
    });
  }
  function apply(j) {
    if (j.daily) state.daily = j.daily;
    if (j.presets) state.presets = j.presets;
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { /* a listener must not break the others */ } });
    return state;
  }

  var DS = window.DailyStretches = {
    load: function () { return api('GET', '').then(apply); },
    subscribe: function (fn) { listeners.push(fn); if (state.daily) fn(state); },
    has: function (e) {
      if (!state.daily) return false;
      var k = keyOf(e.name);
      return state.daily.items.some(function (i) { return (e.id != null && i.exerciseId === e.id) || keyOf(i.name) === k; });
    },
    add: function (id) { return api('POST', '/add', { exerciseId: id }).then(apply); },
    remove: function (ref) { return api('POST', '/remove', ref).then(apply); },
    move: function (ref, dir) { return api('POST', '/move', { exerciseId: ref.exerciseId, name: ref.name, direction: dir }).then(apply); },
    update: function (ref, patch) { return api('POST', '/update', Object.assign({ exerciseId: ref.exerciseId, name: ref.name }, patch)).then(apply); },
    preset: function (id, mode) { return api('POST', '/preset', { presetId: id, mode: mode }).then(apply); },
    toggle: function (e) {
      return DS.has(e) ? DS.remove({ exerciseId: e.id, name: e.name }) : DS.add(e.id);
    },
    /** A button that shows and flips whether stretch `e` ({id,name}) is a daily stretch. */
    toggleButton: function (e) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ds-toggle';
      function paint() {
        var on = DS.has(e);
        b.setAttribute('aria-pressed', String(on));
        b.textContent = on ? 'In daily' : '+ Daily';
        b.title = on ? 'Remove from my daily stretches' : 'Add to my daily stretches';
        b.setAttribute('aria-label', (on ? 'Remove ' : 'Add ') + e.name + (on ? ' from' : ' to') + ' my daily stretches');
      }
      DS.subscribe(paint);
      b.addEventListener('click', function () {
        b.disabled = true;
        DS.toggle(e).catch(function () { b.title = 'Could not save. Try again.'; }).then(function () { b.disabled = false; paint(); });
      });
      paint();
      return b;
    },
  };

  // ── The section on /stretch ──────────────────────────────────────────────
  var root = document.getElementById('ds-root');
  if (!root) { DS.load().catch(function () {}); return; }

  var $ = function (id) { return document.getElementById(id); };
  var LIB = [];
  try { LIB = JSON.parse($('ds-library').textContent) || []; } catch (e) { LIB = []; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function msg(t, bad) { var m = $('ds-msg'); m.textContent = t || ''; m.className = 'ds-msg' + (bad ? ' ds-bad' : ''); }
  function guard(p) { return p.then(function () { msg(''); }, function (e) { msg(e.message === 'failed' ? 'Could not save. Try again.' : e.message, true); }); }

  function fmtMin(m) { return (Math.round(m * 10) / 10) + ' min'; }

  function row(it, idx, n) {
    var li = el('li', 'ds-row');
    var ref = { exerciseId: it.exerciseId, name: it.name };
    li.appendChild(el('span', 'ds-name', it.name));
    var hold = el('input', 'ds-hold'); hold.type = 'number'; hold.min = 5; hold.max = 600; hold.step = 5; hold.value = it.holdSeconds;
    hold.setAttribute('aria-label', 'Hold seconds for ' + it.name);
    hold.addEventListener('change', function () { guard(DS.update(ref, { holdSeconds: Number(hold.value) })); });
    var holdWrap = el('label', 'ds-field'); holdWrap.appendChild(hold); holdWrap.appendChild(el('span', null, 's'));
    li.appendChild(holdWrap);
    var sides = el('select', 'ds-sides');
    sides.setAttribute('aria-label', 'Sides for ' + it.name);
    [[2, 'each side'], [1, 'one hold']].forEach(function (o) {
      var op = el('option', null, o[1]); op.value = o[0]; if (it.sides === o[0]) op.selected = true; sides.appendChild(op);
    });
    sides.addEventListener('change', function () { guard(DS.update(ref, { sides: Number(sides.value) })); });
    li.appendChild(sides);
    var ctl = el('span', 'ds-ctl');
    [['up', '↑', 'Move up', idx === 0], ['down', '↓', 'Move down', idx === n - 1]].forEach(function (c) {
      var b = el('button', 'ds-icon', c[1]); b.type = 'button'; b.disabled = c[3];
      b.setAttribute('aria-label', c[2] + ': ' + it.name);
      b.addEventListener('click', function () { guard(DS.move(ref, c[0])); });
      ctl.appendChild(b);
    });
    var rm = el('button', 'ds-icon ds-remove', '×'); rm.type = 'button';
    rm.setAttribute('aria-label', 'Remove ' + it.name + ' from my daily stretches');
    rm.addEventListener('click', function () { guard(DS.remove(ref)); });
    ctl.appendChild(rm);
    li.appendChild(ctl);
    return li;
  }

  function renderList() {
    var d = state.daily; if (!d) return;
    $('ds-title').textContent = d.name;
    $('ds-total').textContent = d.items.length + (d.items.length === 1 ? ' stretch' : ' stretches') + ' · ' + fmtMin(d.totalMinutes);
    $('ds-default').hidden = !d.isDefault;
    var ul = $('ds-list'); ul.textContent = '';
    if (!d.items.length) ul.appendChild(el('li', 'ds-empty', 'Nothing here yet. Add a stretch below or load a preset.'));
    d.items.forEach(function (it, i) { ul.appendChild(row(it, i, d.items.length)); });
  }

  function renderPresets() {
    var sel = $('ds-preset'); var keep = sel.value; sel.textContent = '';
    state.presets.forEach(function (p) {
      var o = el('option', null, p.name + ' - ' + p.itemCount + ' stretches, ' + fmtMin(p.totalMinutes)); o.value = p.id; sel.appendChild(o);
    });
    if (keep) sel.value = keep;
    $('ds-load').disabled = !state.presets.length;
  }

  function renderLibrary() {
    var q = keyOf($('ds-search').value);
    var ul = $('ds-lib'); ul.textContent = '';
    LIB.filter(function (e) { return !q || keyOf(e.name).indexOf(q) >= 0; }).slice(0, 80).forEach(function (e) {
      var li = el('li', 'ds-libitem');
      li.appendChild(el('span', 'ds-name', e.name));
      li.appendChild(DS.toggleButton(e));
      ul.appendChild(li);
    });
  }

  $('ds-load').addEventListener('click', function () {
    var id = Number($('ds-preset').value); if (!id) return;
    var mode = document.querySelector('input[name="ds-mode"]:checked').value;
    var name = $('ds-preset').selectedOptions[0].textContent.replace(/ - \d+ stretches.*$/, '');
    if (mode === 'replace' && !window.confirm('Replace your daily stretches with "' + name + '"? Your current list will be lost.')) return;
    guard(DS.preset(id, mode).then(function () { msg(mode === 'replace' ? 'Loaded ' + name + '.' : 'Added the stretches from ' + name + ' that were not already there.'); }));
  });
  $('ds-search').addEventListener('input', renderLibrary);

  DS.subscribe(function () { renderList(); renderPresets(); });
  renderLibrary();
  DS.load().catch(function () { $('ds-list').textContent = ''; $('ds-list').appendChild(el('li', 'ds-empty', 'Could not load your daily stretches. Reload to try again.')); });
})();
