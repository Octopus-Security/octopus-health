/**
 * Jump-rope handle page. The two parts are fixed. This script only previews
 * them, updates the cord-length sentence, and downloads the zip.
 */
(function () {
  var previewNote = document.getElementById('preview-note');
  var previewSelect = document.getElementById('preview-part');
  var parts = [];
  var view = window.MeshView
    ? window.MeshView.mount(document.getElementById('preview-canvas'))
    : { ok: false, setStl: function () {} };
  if (!view.ok && previewNote) {
    previewNote.textContent = 'This browser cannot draw the part here. The download is the same part.';
  }

  function cordText(cm) {
    var n = Number(cm);
    if (!isFinite(n) || n < 120 || n > 220) n = 170;
    var metres = ((n + 90) / 100).toFixed(1);
    return 'A starting length is your height plus about 90 cm (about ' + metres + ' m if you are ' + Math.round(n) + ' cm tall).';
  }

  var height = document.getElementById('height');
  var cord = document.getElementById('cord-length');
  function writeCord() {
    if (cord && height) cord.textContent = cordText(height.value);
  }
  if (height) height.addEventListener('input', writeCord);

  function decodeStl(b64) {
    var bin = atob(b64);
    var buf = new ArrayBuffer(bin.length);
    var bytes = new Uint8Array(buf);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return buf;
  }

  function showPart(name) {
    if (!view.ok) return;
    var part = null;
    for (var i = 0; i < parts.length; i++) if (parts[i].name === name) part = parts[i];
    if (!part || !part.stl) return;
    try { view.setStl(decodeStl(part.stl)); }
    catch (e) { previewNote.textContent = 'Could not draw that part. The download is the same part.'; }
  }

  function fill() {
    var keep = previewSelect.value;
    previewSelect.replaceChildren();
    parts.forEach(function (part) {
      var opt = document.createElement('option');
      opt.value = part.name;
      opt.textContent = (part.count || 1) + ' × ' + part.name + (part.size ? ' (' + part.size + ')' : '');
      previewSelect.appendChild(opt);
    });
    if (keep && parts.some(function (part) { return part.name === keep; })) previewSelect.value = keep;
    if (parts.length) showPart(previewSelect.value);
  }

  fetch('/rope/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: '{}',
  }).then(function (res) {
    return res.json();
  }).then(function (body) {
    parts = (body && body.parts) || [];
    fill();
    if (!parts.length) previewNote.textContent = (body && body.error) || 'No part to preview. The download is the same part.';
  }).catch(function () {
    previewNote.textContent = 'Could not load the part preview. The download is the same part.';
  });

  previewSelect.addEventListener('change', function () { showPart(previewSelect.value); });

  document.getElementById('download').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    fetch('/rope/api/kit', {
      method: 'POST',
      headers: { 'Accept': 'application/zip, application/json' },
    }).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (!res.ok || type.indexOf('application/zip') === -1) {
        return res.json().then(function (body) {
          previewNote.textContent = (body && body.error) || 'Could not build that kit.';
        });
      }
      return res.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jump-rope-handles.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      });
    }).catch(function () {
      previewNote.textContent = 'Could not reach the download.';
    }).then(function () {
      btn.disabled = false;
    });
  });

  function waitUntil(fn, ms) {
    return new Promise(function (resolve) {
      var started = Date.now();
      (function tick() {
        if (fn()) return resolve(true);
        if (Date.now() - started > ms) return resolve(false);
        setTimeout(tick, 50);
      })();
    });
  }

  async function runCheck() {
    var problems = [];
    var out = document.getElementById('rope-check');
    out.hidden = false;
    var loaded = await waitUntil(function () {
      var text = previewSelect.innerHTML;
      return text.indexOf('cap.stl') !== -1 && text.indexOf('handle.stl') !== -1;
    }, 20000);
    if (!loaded) problems.push('preview parts missing');
    if (!view.ok && !(previewNote.textContent || '').trim()) problems.push('missing webgl note');
    if (cord && !/2\.6 m/.test(cord.textContent)) problems.push('cord ' + cord.textContent);
    if (height) {
      height.value = '160';
      height.dispatchEvent(new Event('input', { bubbles: true }));
      if (cord && !/2\.5 m/.test(cord.textContent)) problems.push('height ' + (cord && cord.textContent));
      height.value = '170';
      height.dispatchEvent(new Event('input', { bubbles: true }));
    }
    var thread = document.body.textContent;
    if (!/5\.5 mm per turn/.test(thread)) problems.push('pitch missing');
    if (!/double knot/i.test(thread)) problems.push('knot missing');
    if (!/unscrew/i.test(thread)) problems.push('unscrew missing');

    var vw = document.documentElement.clientWidth;
    document.querySelectorAll('.rope-page button, .rope-page input, .rope-page select').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      if (el.tagName === 'BUTTON' && (box.width < 44 || box.height < 44)) {
        problems.push('small button ' + (el.id || el.textContent.trim()) + ' ' + Math.round(box.width) + 'x' + Math.round(box.height));
      }
      if (el.tagName !== 'BUTTON' && box.height < 44) problems.push('small field ' + el.id + ' ' + Math.round(box.height));
      var size = parseFloat(getComputedStyle(el).fontSize);
      if (el.tagName !== 'BUTTON' && size < 16) problems.push('font ' + el.id + ' ' + size);
    });
    document.querySelectorAll('.rope-page *').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var box = el.getBoundingClientRect();
      if (box.width > vw + 1) problems.push('wide ' + (el.id || el.className || el.tagName) + ' ' + Math.round(box.width) + '>' + vw);
    });
    out.textContent = (problems.length ? problems.join(' | ') : 'ok') + ' w=' + vw;
    out.dataset.done = '1';
  }

  if (new URLSearchParams(location.search).get('check') === '1') runCheck();
})();
