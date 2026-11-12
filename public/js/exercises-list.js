/* Exercises list: filter, Rename, Merge. Every change is previewed first (the server
   writes nothing without confirm:true) and confirmed in the themed dialog. */
(function () {
  'use strict';
  var all = JSON.parse(document.getElementById('ex-data').textContent || '{}');
  var data = all.names || [];
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
  // One group: every spelling into the radio-picked one. Preview first, then the themed confirm.
  function mergeAll(card, gi) {
    var names = all.groups[gi], picked = card.querySelector('input[type=radio]:checked');
    if (!picked) return null;
    var target = picked.value, base = { names: names, target: target };
    return api('/logs/api/exercises/merge-group', base).then(function (p) {
      if (!p.ok) return oDialog.alert({ title: 'Cannot do that', body: p.error || 'Failed.' });
      if (p.alreadyDone) return oDialog.alert({ title: 'Nothing to do', body: 'Already one spelling.' });
      return oDialog.confirm({
        title: 'Merge all into “' + target + '”?',
        body: plural(p.sets, 'set') + ' in ' + plural(p.sessions, 'session') + ' from ' + plural(p.spellings, 'other spelling') + ' will move into “' + target + '”, which has ' + plural(p.targetSets, 'set') + '. Future logs of those spellings land on it. No set is deleted.',
        confirmLabel: 'Merge',
      }).then(function (yes) {
        if (!yes) return null;
        return api('/logs/api/exercises/merge-group', { names: names, target: target, confirm: true }).then(function (r) {
          return r.ok ? done(r.moved) : oDialog.alert({ title: 'Failed', body: r.error || 'Failed.' });
        });
      });
    });
  }
  // A suggestion: the person picks which exercise to KEEP; every spelling of the others moves into it.
  function mergeOthers(si, gi) {
    var groups = all.suggest[si], keep = groups[gi][0];
    var from = [];
    groups.forEach(function (names, i) { if (i !== gi) names.forEach(function (n) { from.push(n); }); });
    return Promise.all(from.map(function (n) { return post({ from: n, to: keep, exact: true }); })).then(function (ps) {
      var bad = ps.filter(function (p) { return !p.ok; })[0];
      if (bad) return oDialog.alert({ title: 'Cannot do that', body: bad.error || 'Failed.' });
      var sets = ps.reduce(function (n, p) { return n + p.sets; }, 0), sess = ps.reduce(function (n, p) { return n + p.sessions; }, 0);
      return oDialog.confirm({
        title: 'These are the same exercise?',
        body: plural(sets, 'set') + ' in ' + plural(sess, 'session') + ' will move into “' + keep + '”. Only do this if they really are one lift (same equipment, same movement). No set is deleted.',
        confirmLabel: 'Merge',
      }).then(function (yes) {
        if (!yes) return null;
        return from.reduce(function (chain, n) {
          return chain.then(function (acc) { return post({ from: n, to: keep, exact: true, confirm: true }).then(function (r) { return acc + (r.ok ? r.moved : 0); }); });
        }, Promise.resolve(0)).then(done);
      });
    });
  }
  var review = document.getElementById('review');
  if (review) {
    review.addEventListener('change', function (ev) {
      var radio = ev.target.closest('input[type=radio]');
      if (!radio) return;
      var card = radio.closest('.rv-card');
      card.querySelector('.rv-target').textContent = radio.value;
    });
    review.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      if (btn.getAttribute('data-act') === 'merge-all') {
        var card = btn.closest('.rv-card');
        mergeAll(card, Number(card.getAttribute('data-group')));
      } else if (btn.getAttribute('data-act') === 'merge-others') {
        mergeOthers(Number(btn.getAttribute('data-sug')), Number(btn.getAttribute('data-grp')));
      }
    });
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
