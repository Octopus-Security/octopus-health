/* Exercises list: filter, Rename, Merge. Every change is previewed first (the server
   writes nothing without confirm:true) and confirmed in the themed dialog. */
(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('ex-data').textContent || '[]');
  var counts = {}; data.forEach(function (e) { counts[e.name] = e.sets; });
  var list = document.getElementById('ex-list');
  var filter = document.getElementById('ex-filter');

  function norm(s) { return String(s || '').toLowerCase(); }
  if (filter) filter.addEventListener('input', function () {
    var q = norm(filter.value);
    Array.prototype.forEach.call(list.children, function (li) { li.hidden = q && norm(li.getAttribute('data-name')).indexOf(q) === -1; });
  });

  function post(body) {
    return fetch('/logs/api/exercises/move', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: 'bad reply' }; }); });
  }

  function move(from, to) {
    return post({ from: from, to: to }).then(function (p) {
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
        return post({ from: from, to: to, confirm: true }).then(function (r) {
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

  if (list) list.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var from = btn.closest('li').getAttribute('data-name');
    if (btn.getAttribute('data-act') === 'merge') {
      pickFrom = from; pickFilter.value = ''; renderPick(); bg.hidden = false; pickFilter.focus();
    } else {
      oDialog.prompt({ title: 'Rename exercise', label: 'New name for "' + from + '"', value: from, required: true, confirmLabel: 'Next' })
        .then(function (v) { v = v && String(v).trim(); if (v && v !== from) return move(from, v); });
    }
  });
})();
