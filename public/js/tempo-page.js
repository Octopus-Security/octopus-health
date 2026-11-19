/**
 * tempo-page.js — the Tempo tab on /timers. The protocol maths live in
 * api/tempo.js and are mirrored here only for the running clock; saving goes
 * through /timers/api/protocols so the list is the account's, not this browser's.
 *
 * Voice is the combo caller's speechSynthesis settings, passed in as `speak`.
 */
(function () {
  var KEY_HINT = 'Tap + to keep this timer. It is saved on your account. The strict pull-up is always here.';

  function $(id) { return document.getElementById(id); }

  function mount(opts) {
    opts = opts || {};
    var speak = opts.speak || function () {};
    var bell = opts.bell || function () {};
    var toast = opts.toast || function (msg) { if (window.oDialog && oDialog.toast) oDialog.toast(msg); else console.info(msg); };
    var confirmDelete = opts.confirmDelete || function () { return Promise.resolve(true); };

    var saved = [];
    var currentId = 'strict-pull-up';
    var timer = null;
    var running = null;
    var saveTimer = null;
    var ready = false;
    var busy = false;

    function builtin() {
      return {
        id: 'strict-pull-up', name: 'Strict pull-up', reps: 5, builtin: true,
        phases: [
          { label: 'Up', speak: 'up', seconds: 5 },
          { label: 'Top', speak: 'hold', seconds: 5 },
          { label: 'Down', speak: 'down', seconds: 5 },
          { label: 'Dead hang', speak: 'hang', seconds: 5 },
        ],
      };
    }

    function blankPhase() { return { label: 'Phase', speak: 'phase', seconds: 5 }; }

    function readForm() {
      var phases = [];
      document.querySelectorAll('#tp-phases .tp-row').forEach(function (row) {
        phases.push({
          label: row.querySelector('.tp-label').value,
          speak: row.querySelector('.tp-speak').value,
          seconds: row.querySelector('.tp-seconds').value,
        });
      });
      return {
        id: currentId === 'strict-pull-up' ? '' : currentId,
        name: $('tp-name').value,
        reps: $('tp-reps').value,
        phases: phases,
      };
    }

    function fillForm(p) {
      clearTimeout(saveTimer);
      currentId = p.id || '';
      $('tp-name').value = p.name;
      $('tp-reps').value = p.reps;
      var box = $('tp-phases');
      box.innerHTML = '';
      p.phases.forEach(function (ph) { box.appendChild(rowEl(ph)); });
      $('tp-delete').style.display = p.builtin ? 'none' : '';
      renderChips();
    }

    function rowEl(ph) {
      var row = document.createElement('div');
      row.className = 'tp-row';
      row.innerHTML =
        '<label>Phase <input class="tp-label" maxlength="40"></label>' +
        '<label>Say <input class="tp-speak" maxlength="40"></label>' +
        '<label>Sec <input class="tp-seconds" type="number" min="1" max="180"></label>' +
        '<button type="button" class="btn tp-remove" aria-label="Remove phase">✕</button>';
      row.querySelector('.tp-label').value = ph.label;
      row.querySelector('.tp-speak').value = ph.speak;
      row.querySelector('.tp-seconds').value = ph.seconds;
      row.querySelector('.tp-remove').addEventListener('click', function () {
        if (document.querySelectorAll('#tp-phases .tp-row').length <= 1) return;
        row.remove();
        scheduleSave();
      });
      return row;
    }

    function allProtocols() {
      return [builtin()].concat(saved);
    }

    function renderChips() {
      var box = $('tp-saved');
      box.innerHTML = '';
      allProtocols().forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'it-preset' + (p.id === currentId ? ' on' : '');
        b.textContent = p.name;
        b.addEventListener('click', function () {
          if (running) return;
          fillForm(p);
          resetDisplay();
        });
        box.appendChild(b);
      });
      var add = document.createElement('button');
      add.type = 'button';
      add.id = 'tp-add-timer';
      add.className = 'it-preset timer-add';
      add.textContent = '+';
      add.setAttribute('aria-label', 'Add timer');
      add.disabled = !ready || busy;
      add.addEventListener('click', addProtocol);
      box.appendChild(add);
    }

    function uniqueName(base) {
      var taken = {};
      saved.forEach(function (p) { taken[p.name.toLowerCase()] = true; });
      var name = base;
      var i = 2;
      while (taken[name.toLowerCase()]) {
        name = base + ' ' + i;
        i += 1;
      }
      return name;
    }

    function activePhases() {
      var phases = [];
      document.querySelectorAll('#tp-phases .tp-row').forEach(function (row) {
        var seconds = Math.round(Number(row.querySelector('.tp-seconds').value));
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        phases.push({
          label: row.querySelector('.tp-label').value.trim() || 'Phase',
          speak: row.querySelector('.tp-speak').value.trim() || row.querySelector('.tp-label').value.trim() || 'phase',
          seconds: Math.min(180, seconds),
        });
      });
      return phases.length ? phases : builtin().phases;
    }

    function buildSteps() {
      var phases = activePhases();
      var reps = Math.min(100, Math.max(1, Math.round(Number($('tp-reps').value)) || 5));
      var out = [];
      for (var r = 1; r <= reps; r++) {
        phases.forEach(function (ph, i) {
          out.push({ rep: r, reps: reps, label: ph.label, speak: ph.speak, seconds: ph.seconds, repStart: i === 0 });
        });
      }
      return out;
    }

    function show(step, left) {
      $('tp-phase').textContent = step.label;
      $('tp-rep').textContent = 'Rep ' + step.rep + ' / ' + step.reps;
      $('tp-display').textContent = format(left);
      var pct = Math.max(0, Math.min(100, (left / step.seconds) * 100));
      $('tp-bar').style.width = pct + '%';
    }

    function format(s) {
      s = Math.max(0, Math.ceil(s));
      var m = Math.floor(s / 60);
      var sec = s % 60;
      return m + ':' + String(sec).padStart(2, '0');
    }

    function resetDisplay() {
      var steps = buildSteps();
      var first = steps[0];
      $('tp-phase').textContent = first ? first.label : '—';
      $('tp-rep').textContent = first ? ('Rep 1 / ' + first.reps) : '';
      $('tp-display').textContent = first ? format(first.seconds) : '0:00';
      $('tp-bar').style.width = '100%';
      $('tp-display').className = 'timer-display';
    }

    function stopTimer() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function setRunningUi(on) {
      $('tp-start').style.display = on ? 'none' : '';
      $('tp-pause').style.display = on ? '' : 'none';
      $('tp-pause').textContent = '⏸ Pause';
    }

    function finish() {
      stopTimer();
      running = null;
      setRunningUi(false);
      $('tp-start').textContent = '▶ Start';
      $('tp-phase').textContent = 'Done';
      $('tp-rep').textContent = '';
      $('tp-display').textContent = '0:00';
      $('tp-bar').style.width = '0%';
      $('tp-display').className = 'timer-display';
      try { speak('done'); } catch (e) { /* voice is optional */ }
      bell(440, 0.5);
    }

    function arm(step, endsAt) {
      show(step, (endsAt - Date.now()) / 1000);
      $('tp-display').className = 'timer-display running';
      var line = step.repStart ? ('rep ' + step.rep + '. ' + step.speak) : step.speak;
      try { speak(line); } catch (e) { bell(660, 0.15); }
      if (step.repStart) bell(880, 0.25);
    }

    function start() {
      if (opts.resumeAudio) opts.resumeAudio();
      if (running && running.paused) {
        running.paused = false;
        running.endsAt = Date.now() + running.leftMs;
        setRunningUi(true);
        arm(running.steps[running.i], running.endsAt);
        tick();
        return;
      }
      var steps = buildSteps();
      if (!steps.length) return;
      running = { steps: steps, i: 0, endsAt: Date.now() + steps[0].seconds * 1000, paused: false, leftMs: 0 };
      setRunningUi(true);
      arm(steps[0], running.endsAt);
      tick();
    }

    function tick() {
      stopTimer();
      timer = setInterval(function () {
        if (!running || running.paused) return;
        var advanced = false;
        while (running && running.endsAt <= Date.now()) {
          running.i += 1;
          if (running.i >= running.steps.length) { finish(); return; }
          running.endsAt += running.steps[running.i].seconds * 1000;
          advanced = true;
        }
        if (!running) return;
        if (advanced) arm(running.steps[running.i], running.endsAt);
        else show(running.steps[running.i], (running.endsAt - Date.now()) / 1000);
      }, 200);
    }

    function pause() {
      if (!running) return;
      running.paused = true;
      running.leftMs = Math.max(0, running.endsAt - Date.now());
      stopTimer();
      $('tp-pause').style.display = 'none';
      $('tp-start').style.display = '';
      $('tp-start').textContent = '▶ Resume';
      $('tp-display').className = 'timer-display';
      if (opts.cancelSpeech) opts.cancelSpeech();
    }

    function reset() {
      stopTimer();
      running = null;
      setRunningUi(false);
      $('tp-start').textContent = '▶ Start';
      if (opts.cancelSpeech) opts.cancelSpeech();
      resetDisplay();
    }

    function persist(next) {
      return fetch('/timers/api/protocols', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocols: next }),
      }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (b) {
          throw new Error(b.error || 'could not save');
        });
        return r.json();
      }).then(function (body) {
        saved = body.protocols || [];
        renderChips();
      });
    }

    $('tp-add').addEventListener('click', function () {
      if (running) return;
      if (document.querySelectorAll('#tp-phases .tp-row').length >= 8) return;
      $('tp-phases').appendChild(rowEl(blankPhase()));
      scheduleSave();
    });

    function scheduleSave() {
      if (!ready || busy || running || !currentId || currentId === 'strict-pull-up') return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveCurrent, 400);
    }

    function saveCurrent() {
      if (!ready || busy || running || !currentId || currentId === 'strict-pull-up') return;
      var previous = saved.find(function (p) { return p.id === currentId; });
      if (!previous) return;
      var name = ($('tp-name').value || '').trim();
      if (!name || name.toLowerCase() === 'strict pull-up') name = previous.name;
      var body = { id: currentId, name: name, reps: $('tp-reps').value, phases: activePhases() };
      var next = saved.map(function (p) { return p.id === currentId ? body : p; });
      busy = true;
      persist(next).catch(function (e) { toast(e.message); }).then(function () { busy = false; renderChips(); });
    }

    function addProtocol() {
      clearTimeout(saveTimer);
      if (!ready || running || busy) return;
      var name = ($('tp-name').value || '').trim();
      if (!name || name.toLowerCase() === 'strict pull-up') name = 'Custom';
      name = uniqueName(name);
      var body = { name: name, reps: $('tp-reps').value, phases: activePhases() };
      busy = true;
      renderChips();
      persist([body].concat(saved)).then(function () {
        var stored = saved.find(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
        if (stored) {
          fillForm(stored);
          resetDisplay();
          $('tp-name').focus();
          try { $('tp-name').select(); } catch (e) { /* the name is still there to edit */ }
        }
      }).catch(function (e) { toast(e.message); }).then(function () { busy = false; renderChips(); });
    }

    $('tp-start').addEventListener('click', start);
    $('tp-pause').addEventListener('click', pause);
    $('tp-reset').addEventListener('click', reset);

    $('tp-name').addEventListener('input', scheduleSave);
    $('tp-reps').addEventListener('input', scheduleSave);
    $('tp-phases').addEventListener('input', scheduleSave);

    $('tp-save').addEventListener('click', function () {
      clearTimeout(saveTimer);
      if (!ready || running || busy) return;
      var form = readForm();
      var phases = activePhases();
      var body = {
        id: form.id,
        name: ($('tp-name').value || '').trim() || 'Custom',
        reps: $('tp-reps').value,
        phases: phases,
      };
      if (body.name.toLowerCase() === 'strict pull-up') {
        toast('That name is the built-in. Pick another name to save your own.');
        return;
      }
      var existing = saved.find(function (p) { return p.name.toLowerCase() === body.name.toLowerCase(); });
      if (existing) body.id = existing.id;
      var next = saved.filter(function (p) { return p.id !== body.id; });
      next.unshift(body);
      busy = true;
      renderChips();
      persist(next).then(function () {
        var stored = saved.find(function (p) { return p.name.toLowerCase() === body.name.toLowerCase(); });
        if (stored) fillForm(stored);
        toast('Saved.');
      }).catch(function (e) { toast(e.message); }).then(function () { busy = false; renderChips(); });
    });

    $('tp-delete').addEventListener('click', function () {
      if (running || !currentId || currentId === 'strict-pull-up') return;
      var name = $('tp-name').value;
      confirmDelete(name).then(function (ok) {
        if (!ok) return;
        persist(saved.filter(function (p) { return p.id !== currentId; })).then(function () {
          fillForm(builtin());
          resetDisplay();
        }).catch(function (e) { toast(e.message); });
      });
    });

    $('tp-hint').textContent = KEY_HINT;
    fillForm(builtin());
    resetDisplay();

    fetch('/timers/api/protocols', { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error('load'); return r.json(); })
      .then(function (body) {
        if (busy) return;
        saved = body.protocols || [];
        ready = true;
        renderChips();
      })
      .catch(function () { $('tp-hint').textContent = 'Could not load saved protocols. The strict pull-up still runs.'; });
  }

  window.TempoPage = { mount: mount };
})();
