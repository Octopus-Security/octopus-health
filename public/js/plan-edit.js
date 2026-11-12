/* Plan editor. All text is set with textContent / .value, never innerHTML. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var P = JSON.parse($('sx-data').textContent);
  var weeks = (P.weeks || []).slice();
  var sessions = [];
  var API = '/trainer-plans/api/';

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function say(text, bad) { var m = $('sx-msg'); m.className = 'sx-msg' + (bad ? ' error' : ''); m.textContent = text || ''; }
  function api(method, url, body) {
    return fetch(url, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Bad response' }; }); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'Failed'); return j; });
  }
  function btn(text, label, fn, cls) {
    var b = el('button', cls || 'sx-mini', text); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('click', fn); return b;
  }
  function move(list, i, d) { var j = i + d; if (j < 0 || j >= list.length) return; var t = list[i]; list[i] = list[j]; list[j] = t; render(); }

  function sessionSelect(day) {
    var sel = el('select'); sel.setAttribute('aria-label', 'Session for this day');
    var none = el('option', null, 'No session'); none.value = ''; sel.appendChild(none);
    var known = false;
    sessions.forEach(function (s) {
      var o = el('option', null, s.title + (s.visibility === 'private' ? ' (private)' : '')); o.value = String(s.id);
      if (day.sessionId === s.id) { o.selected = true; known = true; }
      sel.appendChild(o);
    });
    if (day.sessionId && !known) { var m = el('option', null, 'Session ' + day.sessionId + ' (missing)'); m.value = String(day.sessionId); m.selected = true; sel.appendChild(m); }
    sel.addEventListener('change', function () { day.sessionId = sel.value ? Number(sel.value) : null; });
    return sel;
  }

  function render() {
    var box = $('px-weeks'); box.textContent = '';
    $('px-empty').hidden = weeks.length > 0;
    weeks.forEach(function (w, wi) {
      var sec = el('div', 'sx-item px-week');
      var head = el('div', 'sx-head');
      var t = el('input'); t.type = 'text'; t.maxLength = 80; t.value = w.title || ''; t.placeholder = 'Week ' + (wi + 1) + ' title (optional)'; t.setAttribute('aria-label', 'Title of week ' + (wi + 1));
      t.addEventListener('input', function () { w.title = t.value; });
      head.appendChild(t);
      head.appendChild(btn('↑', 'Move week ' + (wi + 1) + ' up', function () { move(weeks, wi, -1); }));
      head.appendChild(btn('↓', 'Move week ' + (wi + 1) + ' down', function () { move(weeks, wi, 1); }));
      head.appendChild(btn('×', 'Remove week ' + (wi + 1), function () { weeks.splice(wi, 1); render(); }, 'sx-mini sx-danger'));
      sec.appendChild(head);
      var ol = el('ol', 'sx-items');
      (w.days || []).forEach(function (d, di) {
        var li = el('li', 'sx-item');
        var dh = el('div', 'sx-head');
        dh.appendChild(el('strong', null, 'Day ' + (di + 1)));
        dh.appendChild(btn('↑', 'Move day ' + (di + 1) + ' of week ' + (wi + 1) + ' up', function () { move(w.days, di, -1); }));
        dh.appendChild(btn('↓', 'Move day ' + (di + 1) + ' of week ' + (wi + 1) + ' down', function () { move(w.days, di, 1); }));
        dh.appendChild(btn('×', 'Remove day ' + (di + 1) + ' of week ' + (wi + 1), function () { w.days.splice(di, 1); render(); }, 'sx-mini sx-danger'));
        li.appendChild(dh);
        var lab = el('input'); lab.type = 'text'; lab.maxLength = 60; lab.value = d.label || ''; lab.placeholder = 'Label, e.g. Monday'; lab.setAttribute('aria-label', 'Label for day ' + (di + 1));
        lab.addEventListener('input', function () { d.label = lab.value; });
        li.appendChild(lab);
        li.appendChild(sessionSelect(d));
        var note = el('textarea'); note.rows = 2; note.maxLength = 600; note.value = d.note || ''; note.placeholder = 'Note, e.g. rest, or easy 20 min run'; note.setAttribute('aria-label', 'Note for day ' + (di + 1));
        note.addEventListener('input', function () { d.note = note.value; });
        li.appendChild(note);
        ol.appendChild(li);
      });
      sec.appendChild(ol);
      sec.appendChild(btn('Add a day', 'Add a day to week ' + (wi + 1), function () { (w.days = w.days || []).push({ label: '', sessionId: null, note: '' }); render(); }, 'sx-btn'));
      box.appendChild(sec);
    });
  }

  function paintShare() {
    var v = P.visibility;
    Array.prototype.forEach.call(document.querySelectorAll('input[name=sx-vis]'), function (r) { r.checked = r.value === v; });
    var box = $('sx-link'); box.hidden = v === 'private';
    if (v === 'private') return;
    var path = v === 'public' ? '/p/' + P.slug : '/p/' + P.token;
    $('sx-url').value = location.origin + path; $('sx-open').href = path;
  }

  function save() {
    return api('PUT', API + P.id, { title: $('px-title').value, intro: $('px-intro').value, weeks: weeks })
      .then(function (j) { P = j.plan; weeks = P.weeks.slice(); render(); paintShare(); say('Saved.'); });
  }

  $('px-title').value = P.title; $('px-intro').value = P.intro;
  render(); paintShare();
  api('GET', API + 'sessions').then(function (j) { sessions = j.sessions; render(); }).catch(function (e) { say('Could not load your sessions: ' + e.message, true); });

  $('px-addweek').addEventListener('click', function () { weeks.push({ title: '', days: [{ label: '', sessionId: null, note: '' }] }); render(); });
  $('sx-save').addEventListener('click', function () { save().catch(function (e) { say(e.message, true); }); });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=sx-vis]'), function (r) {
    r.addEventListener('change', function () {
      var want = r.value;
      save().then(function () { return api('POST', API + P.id + '/visibility', { visibility: want }); })
        .then(function (j) { P = j.plan; paintShare(); say('Now ' + P.visibility + '.'); })
        .catch(function (e) { say(e.message, true); paintShare(); });
    });
  });
  $('sx-copy').addEventListener('click', function () {
    var u = $('sx-url'); u.select();
    (navigator.clipboard ? navigator.clipboard.writeText(u.value) : Promise.reject()).then(function () { say('Link copied.'); }, function () { try { document.execCommand('copy'); say('Link copied.'); } catch (e) { say('Select the link and copy it.', true); } });
  });
  $('sx-rotate').addEventListener('click', async function () {
    if (!(await oDialog.confirm({ title: 'Make a new link?', body: 'Anyone with the old one loses access.', confirmLabel: 'Make new link', danger: true }))) return;
    api('POST', API + P.id + '/rotate-link').then(function (j) { P = j.plan; paintShare(); say('New link made. The old one no longer works.'); }).catch(function (e) { say(e.message, true); });
  });
  $('sx-delete').addEventListener('click', async function () {
    if (!(await oDialog.confirm({ title: 'Delete this plan?', body: 'Its link stops working. Your sessions are not deleted.', confirmLabel: 'Delete', danger: true }))) return;
    api('DELETE', API + P.id).then(function () { location.href = '/trainer-plans'; }).catch(function (e) { say(e.message, true); });
  });
})();
