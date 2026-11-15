/**
 * Landmine page. Ball diameter and bar diameter are sent to the server.
 * The plan answer has no mesh. The preview answer is the same STL as the zip.
 */
(function () {
  var previewNote = document.getElementById('preview-note');
  var previewSelect = document.getElementById('preview-part');
  var barInput = document.getElementById('bar');
  var ballInput = document.getElementById('ball');
  var printer = document.getElementById('printer');
  var bed = document.getElementById('bed');
  var bedField = document.getElementById('field-bed');
  var parts = [];
  var planTimer = 0;
  var previewTimer = 0;
  var planSeq = 0;
  var previewSeq = 0;
  var view = window.MeshView
    ? window.MeshView.mount(document.getElementById('preview-canvas'))
    : { ok: false, setStl: function () {} };
  if (!view.ok && previewNote) {
    previewNote.textContent = 'This browser cannot draw the part here. The download is the same part.';
  }

  function payload() {
    return {
      bar: barInput.value,
      ball: ballInput.value,
      printer: printer.value,
      bed: bed.value,
    };
  }

  function markBars() {
    var buttons = document.querySelectorAll('#bars [data-bar]');
    for (var i = 0; i < buttons.length; i++) {
      var same = Math.abs(Number(buttons[i].getAttribute('data-bar')) - Number(barInput.value)) < 0.001;
      buttons[i].setAttribute('aria-pressed', same ? 'true' : 'false');
    }
  }

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

  function fillSelect() {
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

  function writePlan(body) {
    if (!body) return;
    var hole = document.getElementById('hole-line');
    var ball = document.getElementById('ball-line');
    var fit = document.getElementById('fit-line');
    var thread = document.getElementById('thread-line');
    var notice = document.getElementById('notice');
    if (hole) hole.textContent = body.holeLine || body.error || '';
    if (ball) ball.textContent = body.ballLine || '';
    if (fit) fit.textContent = body.fitLine || '';
    if (thread) thread.textContent = body.threadLine || '';
    if (notice) notice.textContent = (body.notes || []).join(' ');
    var list = document.getElementById('parts');
    if (list && body.parts) {
      list.replaceChildren();
      body.parts.forEach(function (row) {
        var li = document.createElement('li');
        li.textContent = (row.count || 1) + ' × ' + row.name + (row.size ? ' (' + row.size + ')' : '');
        list.appendChild(li);
      });
    }
  }

  function refreshPlan() {
    var seq = ++planSeq;
    fetch('/landmine/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) { return res.json(); }).then(function (body) {
      if (seq !== planSeq) return;
      writePlan(body);
    }).catch(function () {
      if (seq !== planSeq) return;
      var notice = document.getElementById('notice');
      if (notice) notice.textContent = 'Could not update the sizes.';
    });
  }

  function refreshPreview() {
    var seq = ++previewSeq;
    fetch('/landmine/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) { return res.json(); }).then(function (body) {
      if (seq !== previewSeq) return;
      parts = (body && body.parts) || [];
      fillSelect();
      if (!parts.length && previewNote) previewNote.textContent = (body && body.error) || 'No part to preview. The download is the same part.';
    }).catch(function () {
      if (seq !== previewSeq) return;
      if (previewNote) previewNote.textContent = 'Could not load the part preview. The download is the same part.';
    });
  }

  function soon() {
    clearTimeout(planTimer);
    clearTimeout(previewTimer);
    planTimer = setTimeout(refreshPlan, 250);
    previewTimer = setTimeout(refreshPreview, 700);
  }

  document.getElementById('bars').addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-bar]');
    if (!btn) return;
    barInput.value = btn.getAttribute('data-bar');
    markBars();
    soon();
  });
  barInput.addEventListener('input', function () { markBars(); soon(); });
  ballInput.addEventListener('input', soon);
  bed.addEventListener('input', soon);
  printer.addEventListener('change', function () {
    bedField.hidden = printer.value !== 'custom';
    soon();
  });
  previewSelect.addEventListener('change', function () { showPart(previewSelect.value); });

  document.getElementById('download').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    fetch('/landmine/api/kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/zip, application/json' },
      body: JSON.stringify(payload()),
    }).then(function (res) {
      var type = res.headers.get('content-type') || '';
      if (!res.ok || type.indexOf('application/zip') === -1) {
        return res.json().then(function (body) {
          previewNote.textContent = (body && body.error) || 'Could not build that landmine.';
        });
      }
      return res.blob().then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'landmine.zip';
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

  refreshPreview();

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
    var out = document.getElementById('landmine-check');
    out.hidden = false;
    var loaded = await waitUntil(function () {
      var text = previewSelect.innerHTML;
      return text.indexOf('sleeve.stl') !== -1 && text.indexOf('rocker.stl') !== -1;
    }, 20000);
    if (!loaded) problems.push('preview parts missing');
    if (!view.ok && !(previewNote.textContent || '').trim()) problems.push('missing webgl note');
    if (view.ok) {
      function greenCount() {
        var canvas = document.getElementById('preview-canvas');
        var copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        var ctx = copy.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        var pix = ctx.getImageData(0, 0, copy.width, copy.height).data;
        var n = 0;
        for (var i = 0; i < pix.length; i += 4) {
          if (pix[i + 1] > 25 && pix[i + 1] > pix[i] + 8 && pix[i + 1] > pix[i + 2]) n++;
        }
        return n;
      }
      var sleeveGreen = greenCount();
      if (sleeveGreen < 80) problems.push('sleeve draw ' + sleeveGreen);
      previewSelect.value = 'rocker.stl';
      previewSelect.dispatchEvent(new Event('change', { bubbles: true }));
      var rockerGreen = greenCount();
      if (rockerGreen < 80) problems.push('rocker draw ' + rockerGreen);
    }
    var hole = document.getElementById('hole-line').textContent;
    if (!/52/.test(hole) || !/50\.8/.test(hole)) problems.push('hole ' + hole);
    if (!/2 in/.test(document.body.textContent)) problems.push('preset label');
    ballInput.value = '140';
    ballInput.dispatchEvent(new Event('input', { bubbles: true }));
    var ballChanged = await waitUntil(function () {
      return /140 mm ball/.test(document.getElementById('parts').textContent);
    }, 8000);
    if (!ballChanged) problems.push('ball ' + document.getElementById('parts').textContent);
    document.querySelector('#bars [data-bar="25.4"]').click();
    var inch = await waitUntil(function () {
      return /26\.6/.test(document.getElementById('hole-line').textContent);
    }, 8000);
    if (!inch) problems.push('inch ' + document.getElementById('hole-line').textContent);
    var copy = document.body.textContent;
    if (!/PETG/.test(copy)) problems.push('petg');
    if (!/screw/i.test(copy)) problems.push('screw');
    if (!/smooth/i.test(copy)) problems.push('smooth');
    var vw = document.documentElement.clientWidth;
    document.querySelectorAll('.landmine-page button, .landmine-page input, .landmine-page select').forEach(function (el) {
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
    document.querySelectorAll('.landmine-page *').forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var box = el.getBoundingClientRect();
      if (box.width > vw + 1) problems.push('wide ' + (el.id || el.className || el.tagName) + ' ' + Math.round(box.width) + '>' + vw);
    });
    out.textContent = (problems.length ? problems.join(' | ') : 'ok') + ' w=' + vw;
    out.dataset.done = '1';
  }

  if (new URLSearchParams(location.search).get('check') === '1') runCheck();
})();
