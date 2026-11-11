/* Session editor. All text is set with textContent / .value, never innerHTML. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var S = JSON.parse($('sx-data').textContent);
  var lib = [], byRef = {};
  var items = (S.items || []).slice();
  var T = S.tailoring || {};

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function say(text, bad) { var m = $('sx-msg'); m.className = 'sx-msg' + (bad ? ' error' : ''); m.textContent = text || ''; }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Bad response' }; }); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Failed'); return j; });
  }

  // ── items ───────────────────────────────────────────────────────────────
  function renderItems() {
    var ol = $('sx-items'); ol.textContent = '';
    $('sx-items-empty').hidden = items.length > 0;
    items.forEach(function (it, i) {
      var li = el('li', 'sx-item');
      var head = el('div', 'sx-head');
      head.appendChild(el('strong', null, (i + 1) + '. ' + it.name));
      head.appendChild(el('span', 'sx-kind', it.type));
      [['Up', -1], ['Down', 1]].forEach(function (d) {
        var b = el('button', 'sx-mini', d[0] === 'Up' ? '↑' : '↓'); b.type = 'button'; b.setAttribute('aria-label', 'Move ' + it.name + ' ' + d[0].toLowerCase());
        b.addEventListener('click', function () { var j = i + d[1]; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; renderItems(); });
        head.appendChild(b);
      });
      var rm = el('button', 'sx-mini sx-danger', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + it.name);
      rm.addEventListener('click', function () { items.splice(i, 1); renderItems(); });
      head.appendChild(rm);
      li.appendChild(head);
      var dose = el('input'); dose.type = 'text'; dose.maxLength = 80; dose.value = it.dose || ''; dose.placeholder = 'Sets, reps or time, e.g. 3 x 8 or 45 s each side'; dose.setAttribute('aria-label', 'Sets, reps or time for ' + it.name);
      dose.addEventListener('input', function () { it.dose = dose.value; });
      li.appendChild(dose);
      var note = el('textarea'); note.rows = 2; note.maxLength = 600; note.value = it.note || ''; note.placeholder = 'Your note on this item'; note.setAttribute('aria-label', 'Note on ' + it.name);
      note.addEventListener('input', function () { it.note = note.value; });
      li.appendChild(note);
      li.appendChild(el('span', 'sx-vis-note', 'Visible to whoever has the link. Do not put anything private here.'));
      ol.appendChild(li);
    });
  }

  function addByRef(ref) {
    var e = byRef[ref]; if (!e) return;
    items.push({ type: e.type, ref: e.ref, name: e.name, poseKey: e.poseKey, cues: e.cues || [], instructions: e.instructions || '', dose: e.dose || '', note: '' });
    renderItems(); say('Added ' + e.name + '. Save when you are done.');
  }

  function renderResults() {
    var q = $('sx-q').value.trim().toLowerCase(), kind = $('sx-type').value, ul = $('sx-results'); ul.textContent = '';
    var shown = 0;
    for (var i = 0; i < lib.length && shown < 40; i++) {
      var e = lib[i];
      if (kind && e.type !== kind) continue;
      if (q && e.name.toLowerCase().indexOf(q) < 0) continue;
      shown++;
      var li = el('li'); li.appendChild(el('span', 'sx-name', e.name)); li.appendChild(el('span', 'sx-kind', e.type + (e.group ? ' · ' + e.group : '')));
      var b = el('button', 'sx-btn', 'Add'); b.type = 'button'; b.setAttribute('aria-label', 'Add ' + e.name);
      (function (ref) { b.addEventListener('click', function () { addByRef(ref); }); })(e.ref);
      li.appendChild(b); ul.appendChild(li);
    }
    if (!shown) ul.appendChild(el('li', 'fx-meta', lib.length ? 'No match.' : 'Loading the library...'));
  }

  // ── tailoring ───────────────────────────────────────────────────────────
  function chips(boxId, list, selected) {
    var box = $(boxId); box.textContent = '';
    list.forEach(function (o) {
      var l = el('label'); var c = el('input'); c.type = 'checkbox'; c.value = o.id; c.checked = selected.indexOf(o.id) >= 0;
      l.appendChild(c); l.appendChild(document.createTextNode(' ' + o.name)); box.appendChild(l);
    });
  }
  function checked(boxId) { return Array.prototype.map.call($(boxId).querySelectorAll('input:checked'), function (c) { return c.value; }); }
  function readTailoring() {
    return { forName: $('sx-for').value, goal: $('sx-goal').value, limitsNote: $('sx-limitsnote').value, focus: checked('sx-focus'), limits: checked('sx-limits'), equipment: checked('sx-equip') };
  }

  function renderSuggestions(s) {
    var box = $('sx-suggestions'); box.textContent = '';
    function block(title, list, withAdd) {
      if (!list.length) return;
      box.appendChild(el('p', 'sx-group', title));
      var ul = el('ul', 'sx-results');
      list.forEach(function (x) {
        var li = el('li'); li.appendChild(el('span', 'sx-name', x.name)); if (x.why) li.appendChild(el('span', 'sx-kind', x.why));
        if (withAdd && byRef[x.ref]) { var b = el('button', 'sx-btn', 'Add'); b.type = 'button'; b.setAttribute('aria-label', 'Add ' + x.name); b.addEventListener('click', function () { addByRef(x.ref); }); li.appendChild(b); }
        ul.appendChild(li);
      });
      box.appendChild(ul);
    }
    block('Suggested (you choose)', s.suggested, true);
    block('Check before using: loads a limited joint', s.check, true);
    if (s.unavailable) box.appendChild(el('p', 'fx-meta', s.unavailable + ' library item(s) hidden because they need gear not ticked above.'));
    box.appendChild(el('p', 'fx-meta', s.note));
  }

  // ── sharing ─────────────────────────────────────────────────────────────
  function paintShare() {
    var v = S.visibility;
    Array.prototype.forEach.call(document.querySelectorAll('input[name=sx-vis]'), function (r) { r.checked = r.value === v; });
    var box = $('sx-link'); box.hidden = v === 'private';
    if (v === 'private') return;
    var path = v === 'public' ? '/s/' + S.slug : '/s/' + S.token;
    $('sx-url').value = location.origin + path; $('sx-open').href = path;
  }

  function collect() { return { title: $('sx-title').value, intro: $('sx-intro').value, items: items, tailoring: readTailoring() }; }
  function save() {
    return api('PUT', '/sessions/api/' + S.id, collect()).then(function (j) { S = j.session; items = S.items.slice(); renderItems(); say('Saved.'); paintShare(); });
  }

  $('sx-title').value = S.title; $('sx-intro').value = S.intro;
  $('sx-for').value = T.forName || ''; $('sx-goal').value = T.goal || ''; $('sx-limitsnote').value = T.limitsNote || '';
  renderItems(); paintShare(); renderResults();

  api('GET', '/sessions/api/library').then(function (j) {
    lib = j.library; lib.forEach(function (e) { byRef[e.ref] = e; });
    var muscles = j.vocab.muscles.map(function (m) { return { id: m.id, name: m.name }; });
    var joints = j.vocab.joints.map(function (m) { return { id: m.id, name: m.name + ' (joint)' }; });
    chips('sx-focus', muscles.concat(joints), T.focus || []);
    chips('sx-limits', j.vocab.joints.map(function (m) { return { id: m.id, name: m.name }; }), T.limits || []);
    chips('sx-equip', j.equipment, T.equipment || []);
    renderResults();
  }).catch(function (e) { say('Could not load the library: ' + e.message, true); });

  $('sx-q').addEventListener('input', renderResults); $('sx-type').addEventListener('change', renderResults);
  $('sx-save').addEventListener('click', function () { save().catch(function (e) { say(e.message, true); }); });
  $('sx-suggest').addEventListener('click', function () {
    api('POST', '/sessions/api/suggest', { tailoring: readTailoring() }).then(function (j) { renderSuggestions(j.suggestions); }).catch(function (e) { say(e.message, true); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=sx-vis]'), function (r) {
    r.addEventListener('change', function () {
      var want = r.value;
      save().then(function () { return api('POST', '/sessions/api/' + S.id + '/visibility', { visibility: want }); })
        .then(function (j) { S = j.session; paintShare(); say('Now ' + S.visibility + '.'); })
        .catch(function (e) { say(e.message, true); paintShare(); });
    });
  });
  $('sx-copy').addEventListener('click', function () {
    var u = $('sx-url'); u.select();
    (navigator.clipboard ? navigator.clipboard.writeText(u.value) : Promise.reject()).then(function () { say('Link copied.'); }, function () { try { document.execCommand('copy'); say('Link copied.'); } catch (e) { say('Select the link and copy it.', true); } });
  });
  $('sx-rotate').addEventListener('click', async function () {
    if (!(await oDialog.confirm({ title: 'Make a new link?', body: 'Anyone with the old one loses access.', confirmLabel: 'Make new link', danger: true }))) return;
    api('POST', '/sessions/api/' + S.id + '/rotate-link').then(function (j) { S = j.session; paintShare(); say('New link made. The old one no longer works.'); }).catch(function (e) { say(e.message, true); });
  });
  $('sx-delete').addEventListener('click', async function () {
    if (!(await oDialog.confirm({ title: 'Delete this session?', body: 'Its link stops working.', confirmLabel: 'Delete', danger: true }))) return;
    api('DELETE', '/sessions/api/' + S.id).then(function () { location.href = '/sessions'; }).catch(function (e) { say(e.message, true); });
  });
})();
