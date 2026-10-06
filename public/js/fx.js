/* fx.js — tiny shared client for the skills / tests / benchmarks pages.
 * <form data-json action=URL data-method=POST>   -> JSON fetch, reload on success
 * <button data-act data-url=URL data-method=DELETE data-body='{"a":1}' data-confirm="...">
 * Numbers: <input type=number> values are sent as numbers, empty fields are
 * omitted, checkboxes are booleans. Errors show in the nearest .fx-msg. */
(function () {
  'use strict';
  function msgFor(el) { return (el.closest('[data-msg-root]') || document).querySelector('.fx-msg') || document.querySelector('.fx-msg'); }
  function show(el, text, ok) { var m = msgFor(el); if (m) { m.textContent = text; m.className = 'fx-msg ' + (ok ? 'success' : 'error'); } }
  async function send(url, method, body) {
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body == null ? undefined : JSON.stringify(body) });
    var j = {}; try { j = await r.json(); } catch (e) { /* non-JSON error page */ }
    if (!r.ok || j.ok === false) throw new Error(j.error || ('Request failed (' + r.status + ')'));
    return j;
  }
  window.fxSend = send;
  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('form[data-json]'); if (!f) return;
    e.preventDefault();
    var body = {};
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') { body[el.name] = el.checked; return; }
      if (el.type === 'radio' && !el.checked) return;
      if (el.multiple) { body[el.name] = Array.prototype.filter.call(el.options, function (o) { return o.selected; }).map(function (o) { return o.value; }); return; }
      if (el.value === '') return;
      body[el.name] = el.type === 'number' ? Number(el.value) : el.value;
    });
    try { await send(f.getAttribute('action'), f.dataset.method || 'POST', body); if (f.dataset.reload !== 'no') location.reload(); else show(f, 'Saved', true); }
    catch (err) { show(f, err.message, false); }
  });
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.confirm && !window.confirm(b.dataset.confirm)) return;
    var body = null; if (b.dataset.body) { try { body = JSON.parse(b.dataset.body); } catch (x) { body = null; } }
    try { await send(b.dataset.url, b.dataset.method || 'POST', body); location.reload(); }
    catch (err) { show(b, err.message, false); }
  });
})();
