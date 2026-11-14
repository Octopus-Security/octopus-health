/**
 * timer-presets.js — the + on Round, Interval, EMOM, AMRAP and Combo Caller.
 *
 * + keeps the numbers on screen as a timer on this account. Tapping it again
 * with the same numbers selects that timer. Changing the numbers steps off the
 * saved timer, so the next + keeps the new one beside it. The stopwatch has
 * nothing to keep. Tempo has its own +.
 *
 * Limits here match api/timer-presets.js. A mismatch would save a second copy
 * of a timer the server had already clamped.
 */
(function () {
  var FIELDS = {
    round: [['rounds', 1, 99, 5], ['workMin', 0, 60, 3], ['workSec', 0, 59, 0], ['restMin', 0, 60, 1], ['restSec', 0, 59, 0], ['countdown', 0, 30, 10]],
    interval: [['rounds', 1, 99, 8], ['work', 1, 3600, 20], ['rest', 0, 3600, 10]],
    emom: [['minutes', 1, 60, 10], ['work', 1, 59, 40]],
    amrap: [['minutes', 1, 120, 10], ['seconds', 0, 59, 0]],
    combo: [['min', 1, 6, 2], ['max', 1, 8, 4], ['delay', 1, 15, 3], ['rounds', 1, 20, 5], ['roundMin', 1, 10, 3], ['rest', 0, 180, 60]]
  };
  var STRIKES = ['1', '2', '3', '4', '5', '6', 'E', 'K', 'N'];
  var DEFAULT_STRIKES = ['1', '2', '3', '4', '5', '6'];

  var panels = {};
  var data = { round: [], interval: [], emom: [], amrap: [], combo: [] };
  var selected = {};
  var writing = false;
  var ready = false;
  var busy = false;
  var confirmDelete = function () { return Promise.resolve(true); };
  var toast = function (msg) { window.alert(msg); };

  function clamp(n, lo, hi, fallback) {
    var x = Math.round(Number(n));
    if (!isFinite(x)) return fallback;
    return Math.min(hi, Math.max(lo, x));
  }

  function normalize(kind, raw) {
    var src = raw || {};
    var out = {};
    FIELDS[kind].forEach(function (f) { out[f[0]] = clamp(src[f[0]], f[1], f[2], f[3]); });
    if (kind === 'round' && out.workMin === 0 && out.workSec === 0) out.workSec = 1;
    if (kind === 'combo') {
      if (out.max < out.min) out.max = out.min;
      var have = {};
      (src.strikes || []).forEach(function (s) { have[String(s)] = true; });
      out.strikes = STRIKES.filter(function (s) { return have[s]; });
      if (!out.strikes.length) out.strikes = DEFAULT_STRIKES.slice();
    }
    return out;
  }

  function signature(kind, preset) {
    var n = normalize(kind, preset);
    if (kind === 'combo') return JSON.stringify([n.min, n.max, n.delay, n.rounds, n.roundMin, n.rest, n.strikes]);
    return FIELDS[kind].map(function (f) { return n[f[0]]; }).join(',');
  }

  function clock(total) {
    var s = Math.max(0, Math.round(total));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function chipText(kind, p) {
    if (kind === 'round') {
      return { title: p.rounds + ' × ' + clock(p.workMin * 60 + p.workSec), sub: 'rest ' + clock(p.restMin * 60 + p.restSec) };
    }
    if (kind === 'interval') return { title: p.rounds + ' × ' + p.work + '/' + p.rest, sub: '' };
    if (kind === 'emom') return { title: p.minutes + ' min', sub: p.work + 's on' };
    if (kind === 'amrap') return { title: clock(p.minutes * 60 + p.seconds), sub: '' };
    var strikes = p.strikes.join('') === '123456' ? '1–6' : p.strikes.join(' ');
    return { title: p.rounds + ' × ' + p.roundMin + ':00', sub: strikes };
  }

  function render(kind) {
    var panel = panels[kind];
    if (!panel) return;
    panel.saved.innerHTML = '';
    data[kind].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'it-preset' + (p.id === selected[kind] ? ' on' : '');
      var view = chipText(kind, p);
      b.appendChild(document.createTextNode(view.title));
      if (view.sub) {
        var s = document.createElement('span');
        s.textContent = view.sub;
        b.appendChild(s);
      }
      b.addEventListener('click', function () {
        if (panel.running()) return;
        select(kind, p);
      });
      panel.saved.appendChild(b);
    });
    panel.add.disabled = !ready || busy;
    panel.del.hidden = !selected[kind];
  }

  function select(kind, p) {
    writing = true;
    selected[kind] = p.id;
    try { panels[kind].write(p); } finally { writing = false; }
    render(kind);
  }

  function deselect(kind) {
    selected[kind] = null;
    render(kind);
  }

  function saveKind(kind, list) {
    busy = true;
    render(kind);
    return fetch('/timers/api/presets', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: kind, presets: list }),
    }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
        throw new Error(b.error || 'could not save');
      });
      return r.json();
    }).then(function (body) {
      data[kind] = body.presets || [];
      if (selected[kind] && !data[kind].some(function (p) { return p.id === selected[kind]; })) {
        selected[kind] = null;
      }
      return data[kind];
    }).finally(function () {
      busy = false;
      render(kind);
    });
  }

  function add(kind) {
    if (!ready || busy || panels[kind].running()) return;
    var draft = normalize(kind, panels[kind].read());
    var sig = signature(kind, draft);
    var existing = data[kind].find(function (p) { return signature(kind, p) === sig; });
    if (existing) { select(kind, existing); return; }
    saveKind(kind, [draft].concat(data[kind])).then(function (list) {
      var made = list.find(function (p) { return signature(kind, p) === sig; });
      if (made) select(kind, made);
    }).catch(function (e) { toast(e.message); });
  }

  // The numbers on screen are the clock about to run. Changing them steps off
  // the saved timer instead of rewriting it. + is what keeps a setup.
  function onEdit(kind) {
    if (writing || !selected[kind]) return;
    var current = data[kind].find(function (p) { return p.id === selected[kind]; });
    if (!current) return;
    var draft = normalize(kind, panels[kind].read());
    if (signature(kind, draft) !== signature(kind, current)) {
      selected[kind] = null;
      render(kind);
    }
  }

  function remove(kind) {
    var id = selected[kind];
    if (!ready || busy || !id) return;
    var preset = data[kind].find(function (p) { return p.id === id; });
    var view = preset ? chipText(kind, preset) : { title: 'this timer' };
    confirmDelete(view.title).then(function (ok) {
      if (!ok) return;
      saveKind(kind, data[kind].filter(function (p) { return p.id !== id; })).then(function () {
        if (selected[kind] === id) selected[kind] = null;
        render(kind);
      }).catch(function (e) { toast(e.message); });
    });
  }

  function mount(opts) {
    panels[opts.kind] = opts;
    opts.add.addEventListener('click', function () { add(opts.kind); });
    opts.del.addEventListener('click', function () { remove(opts.kind); });
    opts.panel.addEventListener('input', function () { onEdit(opts.kind); });
    opts.panel.addEventListener('change', function () { onEdit(opts.kind); });
    opts.add.disabled = true;
    render(opts.kind);
  }

  function load() {
    return fetch('/timers/api/presets', { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('load');
      return r.json();
    }).then(function (body) {
      var presets = body.presets || {};
      Object.keys(panels).forEach(function (kind) {
        data[kind] = presets[kind] || [];
      });
      ready = true;
      Object.keys(panels).forEach(render);
    }).catch(function () {
      ready = false;
      toast('Could not load saved timers.');
    });
  }

  window.TimerPresets = {
    configure: function (opts) {
      opts = opts || {};
      if (opts.toast) toast = opts.toast;
      if (opts.confirmDelete) confirmDelete = opts.confirmDelete;
    },
    mount: mount,
    load: load,
    deselect: deselect,
  };
})();
