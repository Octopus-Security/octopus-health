/* Exercises list: filter (text + Needs tidying), Rename, Merge, Delete. Every change is previewed first (the server
   writes nothing without confirm:true) and confirmed in the themed dialog. */
(function () {
  'use strict';
  var all = JSON.parse(document.getElementById('ex-data').textContent || '{}');
  var data = all.names || [];
  var counts = {}; data.forEach(function (e) { counts[e.name] = e.sets; });
  var list = document.getElementById('ex-list');
  var filter = document.getElementById('ex-filter');

  function norm(s) { return String(s || '').toLowerCase(); }
  var segAll = document.getElementById('seg-all'), segTidy = document.getElementById('seg-tidy');
  var tidyOnly = false;
  try { tidyOnly = localStorage.getItem('exTidyOnly') === '1'; } catch (e) { /* storage blocked: default to All */ }
  function applyFilter() {
    if (!list) return;
    var q = filter ? norm(filter.value) : '', shown = 0;
    Array.prototype.forEach.call(list.children, function (li) {
      var hide = (q && norm(li.getAttribute('data-name')).indexOf(q) === -1) || (tidyOnly && !li.hasAttribute('data-tidy'));
      li.hidden = !!hide; if (!hide) shown++;
    });
    var none = document.getElementById('ex-none');
    if (none) none.hidden = shown > 0;
    if (segAll) { segAll.setAttribute('aria-pressed', tidyOnly ? 'false' : 'true'); segTidy.setAttribute('aria-pressed', tidyOnly ? 'true' : 'false'); }
  }
  function setTidy(on) { tidyOnly = on; try { localStorage.setItem('exTidyOnly', on ? '1' : '0'); } catch (e) { /* not remembered */ } applyFilter(); }
  if (segAll) { segAll.addEventListener('click', function () { setTidy(false); }); segTidy.addEventListener('click', function () { setTidy(true); }); }
  if (filter) filter.addEventListener('input', applyFilter);
  applyFilter();

  function post(body) {
    return fetch('/logs/api/exercises/move', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad reply' }; }); });
  }

  function move(from, to) {
    return post({ from: from, to: to, exact: true }).then(function (p) {
      if (!p.ok) return oDialog.alert({ title: 'Cannot do that', body: p.error || 'Failed.' });
      var what = p.merge
        ? p.sets + ' set' + (p.sets === 1 ? '' : 's') + ' in ' + p.sessions + ' session' + (p.sessions === 1 ? '' : 's') + ' will move from "' + from + '" into "' + to + '", which already has ' + p.targetSets + ' set' + (p.targetSets === 1 ? '' : 's') + '.'
        : p.sets + ' set' + (p.sets === 1 ? '' : 's') + ' in ' + p.sessions + ' session' + (p.sessions === 1 ? '' : 's') + ' will be renamed from "' + from + '" to "' + to + '".';
      return oDialog.confirm({
        title: p.merge ? 'Merge exercises?' : 'Rename exercise?',
        body: what + ' Future logs of "' + from + '" will land on "' + to + '". No set is deleted.',
        confirmLabel: p.merge ? 'Merge' : 'Rename',
      }).then(function (yes) {
        if (!yes) return null;
        return post({ from: from, to: to, exact: true, confirm: true }).then(function (r) {
          if (!r.ok) return oDialog.alert({ title: 'Failed', body: r.error || 'Failed.' });
          return oDialog.alert({ title: 'Done', body: r.moved + ' set' + (r.moved === 1 ? '' : 's') + ' moved.' }).then(function () { location.reload(); });
        });
      });
    });
  }

  var bg = document.getElementById('pick-bg'), pickList = document.getElementById('pick-list');
  var pickFilter = document.getElementById('pick-filter'), pickFrom = null;
  function closePick() { bg.hidden = true; pickFrom = null; }
  function renderPick() {
    var q = norm(pickFilter.value);
    pickList.textContent = '';
    data.forEach(function (e) {
      if (e.name === pickFrom || (q && norm(e.name).indexOf(q) === -1)) return;
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      var n = document.createElement('span'); n.textContent = e.name;
      var c = document.createElement('span'); c.className = 'cnt'; c.textContent = e.sets + ' sets';
      b.appendChild(n); b.appendChild(c);
      b.addEventListener('click', function () { var from = pickFrom; closePick(); move(from, e.name); });
      li.appendChild(b); pickList.appendChild(li);
    });
  }
  if (bg) {
    document.getElementById('pick-cancel').addEventListener('click', closePick);
    bg.addEventListener('click', function (e) { if (e.target === bg) closePick(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bg.hidden) closePick(); });
    pickFilter.addEventListener('input', renderPick);
  }

  // ── Review & consolidate ────────────────────────────────────────────────
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function api(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad reply' }; }); });
  }
  function done(r) {
    return oDialog.alert({ title: 'Done', body: plural(r, 'set') + ' moved.' }).then(function () { location.reload(); });
  }
  // A card (spelling group or suggestion): rows with Include + Keep. Only the ticked rows move into the kept one.
  function rowsOf(card) { return Array.prototype.slice.call(card.querySelectorAll('li[data-row]')); }
  function keptRow(card) { var r = card.querySelector('input[type=radio]:checked'); return r ? r.closest('li[data-row]') : null; }
  function chosen(card) {
    var keep = keptRow(card), from = [];
    rowsOf(card).forEach(function (li) {
      if (li === keep) return;
      var cb = li.querySelector('.rv-include');
      if (cb && cb.checked) JSON.parse(li.getAttribute('data-names')).forEach(function (n) { from.push(n); });
    });
    return { keep: keep ? keep.getAttribute('data-keep') : null, from: from };
  }
  function refreshCard(card) {
    var keep = keptRow(card), n = 0;
    rowsOf(card).forEach(function (li) {
      var cb = li.querySelector('.rv-include');
      if (li === keep) { cb.checked = false; cb.disabled = true; } else { cb.disabled = false; if (cb.checked) n++; }
    });
    var btn = card.querySelector('[data-act=merge-sel]'), c = chosen(card);
    btn.disabled = n === 0;
    btn.textContent = n === 0 ? 'Tick at least one other name to merge' : 'Merge ' + n + ' selected into “' + c.keep + '”';
  }
  function mergeSelected(card) {
    var c = chosen(card);
    if (!c.keep || !c.from.length) return null;
    return api('/logs/api/exercises/merge-selected', { from: c.from, to: c.keep }).then(function (p) {
      if (!p.ok) return oDialog.alert({ title: 'Cannot do that', body: p.error || 'Failed.' });
      if (p.alreadyDone) return oDialog.alert({ title: 'Nothing to do', body: 'Already merged.' });
      var lines = p.names.map(function (x) { return '“' + x.name + '” (' + plural(x.sets, 'set') + ')'; }).join(', ');
      return oDialog.confirm({
        title: 'Merge into “' + c.keep + '”?',
        body: 'These will move into “' + c.keep + '” (' + plural(p.sets, 'set') + ' in ' + plural(p.sessions, 'session') + ' in all): ' + lines + '. Names you did not tick are left alone. No set is deleted.',
        confirmLabel: 'Merge ' + plural(p.sets, 'set'),
      }).then(function (yes) {
        if (!yes) return null;
        return api('/logs/api/exercises/merge-selected', { from: c.from, to: c.keep, confirm: true }).then(function (r) {
          return r.ok ? done(r.moved) : oDialog.alert({ title: 'Failed', body: r.error || 'Failed.' });
        });
      });
    });
  }
  var review = document.getElementById('review');
  if (review) {
    Array.prototype.forEach.call(review.querySelectorAll('.rv-card'), refreshCard);
    review.addEventListener('change', function (ev) {
      var card = ev.target.closest('.rv-card');
      if (!card) return;
      // A newly chosen keeper: the old keeper becomes a candidate again (ticked for a spelling group).
      if (ev.target.type === 'radio' && card.hasAttribute('data-group')) {
        rowsOf(card).forEach(function (li) { var cb = li.querySelector('.rv-include'); if (cb.disabled && li !== keptRow(card)) cb.checked = true; });
      }
      refreshCard(card);
    });
    review.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act=merge-sel]');
      if (btn && !btn.disabled) mergeSelected(btn.closest('.rv-card'));
    });
  }

  // Delete every set under one exact name: preview (nothing written), themed confirm, typed name over 20 sets.
  function deleteExercise(name) {
    return api('/logs/api/exercises/delete', { name: name }).then(function (p) {
      if (!p.ok) return oDialog.alert({ title: 'Cannot do that', body: p.error || 'Failed.' });
      if (p.alreadyDone) return oDialog.alert({ title: 'Nothing to do', body: 'No sets are logged under that name.' }).then(function () { location.reload(); });
      var when = p.dates && p.dates.length ? ' Dates: ' + p.dates.join(', ') + '.' : '';
      var emptied = p.emptiedSessions ? ' ' + plural(p.emptiedSessions, 'session') + ' left with no sets will be deleted too.' : '';
      return oDialog.confirm({
        title: 'Delete “' + name + '”?',
        body: plural(p.sets, 'set') + ' in ' + plural(p.sessions, 'session') + ' will be deleted.' + when + emptied + ' This cannot be undone.',
        confirmLabel: 'Delete ' + plural(p.sets, 'set'), danger: true,
      }).then(function (yes) {
        if (!yes) return null;
        var typedStep = p.requiresTyped
          ? oDialog.prompt({ title: 'Type the name to confirm', label: 'Type “' + name + '” exactly', required: true, confirmLabel: 'Delete' })
          : Promise.resolve(null);
        return typedStep.then(function (typed) {
          if (p.requiresTyped && typed !== name) return oDialog.alert({ title: 'Not deleted', body: 'The name did not match, so nothing was deleted.' });
          return api('/logs/api/exercises/delete', { name: name, confirm: true, typed: typed }).then(function (r) {
            if (!r.ok) return oDialog.alert({ title: 'Failed', body: r.error || 'Failed.' });
            return oDialog.alert({ title: 'Deleted', body: plural(r.deleted, 'set') + ' deleted.' }).then(function () { location.reload(); });
          });
        });
      });
    });
  }

  if (list) list.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var from = btn.closest('li').getAttribute('data-name');
    if (btn.getAttribute('data-act') === 'delete') {
      deleteExercise(from);
    } else if (btn.getAttribute('data-act') === 'merge') {
      pickFrom = from; pickFilter.value = ''; renderPick(); bg.hidden = false; pickFilter.focus();
    } else {
      oDialog.prompt({ title: 'Rename exercise', label: 'New name for "' + from + '"', value: from, required: true, confirmLabel: 'Next' })
        .then(function (v) { v = v && String(v).trim(); if (v && v !== from) return move(from, v); });
    }
  });
})();
