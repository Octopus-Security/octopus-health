/* Unassigned logged exercises: names the muscle map could not credit.
   The person picks the muscles. Nothing on this page guesses one. */
(function () {
  'use strict';

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (text != null) node.textContent = text;
    return node;
  }

  function checked(root, name) {
    return Array.prototype.map.call(root.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
  }

  function fill(root, primary, secondary) {
    var p = {}, s = {};
    (primary || []).forEach(function (id) { p[id] = true; });
    (secondary || []).forEach(function (id) { s[id] = true; });
    root.querySelectorAll('input[name="primary"]').forEach(function (i) { i.checked = !!p[i.value]; });
    root.querySelectorAll('input[name="secondary"]').forEach(function (i) { i.checked = !!s[i.value] && !p[i.value]; });
  }

  function muscleBox(muscles, name) {
    var box = el('div', { className: 'muscle-picks' });
    muscles.forEach(function (m) {
      var label = el('label');
      var input = el('input');
      input.type = 'checkbox';
      input.name = name;
      input.value = m.id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + m.name));
      box.appendChild(label);
    });
    return box;
  }

  function mount(root, opts) {
    if (!root) return;
    var exercises = (opts && opts.exercises) || [];
    var muscles = (opts && opts.muscles) || [];
    var note = root.querySelector('[data-unassigned-note]');
    var list = root.querySelector('[data-unassigned-list]');
    if (!list) return;
    root.removeAttribute('hidden');
    list.textContent = '';
    if (note) {
      note.textContent = exercises.length
        ? 'These sets are in the log. They are not on the figure until you pick the muscles. Nothing is guessed.'
        : 'Every logged exercise in this range is on the map.';
    }
    exercises.forEach(function (item) {
      var li = el('li');
      var title = el('p', { className: 'bm-unassigned-name' }, item.name);
      var meta = el('p', { className: 'bm-meta' });
      var why = item.reason === 'no-muscles' ? 'In your library with no muscles. ' : 'Not in your library. ';
      meta.textContent = why + item.hardSets + ' hard set' + (item.hardSets === 1 ? '' : 's') + ' of ' + item.sets + ' set' + (item.sets === 1 ? '' : 's') + '.';
      var actions = el('div', { className: 'bm-unassigned-actions' });
      var open = el('button', { type: 'button', className: 'btn' }, 'Assign muscles');
      var stretch = el('button', { type: 'button', className: 'btn' }, 'This is a stretch');
      var status = el('p', { className: 'bm-meta', role: 'status' });
      var form = el('form', { className: 'bm-unassigned-form', hidden: '' });
      form.appendChild(el('p', { className: 'bm-sub' }, 'Primary'));
      form.appendChild(muscleBox(muscles, 'primary'));
      form.appendChild(el('p', { className: 'bm-sub' }, 'Secondary'));
      form.appendChild(muscleBox(muscles, 'secondary'));
      var copyLabel = el('label', { className: 'bm-unassigned-copy' }, 'Copy muscles from');
      var copy = el('select');
      copy.appendChild(el('option', { value: '' }, 'Choose an exercise'));
      copyLabel.appendChild(copy);
      form.appendChild(copyLabel);
      var publishLabel = el('label', { className: 'bm-unassigned-copy' });
      var publish = el('input');
      publish.type = 'checkbox';
      publishLabel.appendChild(publish);
      publishLabel.appendChild(document.createTextNode(' Ask to add this to the shared catalogue'));
      form.appendChild(publishLabel);
      var save = el('button', { type: 'submit', className: 'btn' }, 'Save muscles');
      form.appendChild(save);

      function say(text) { status.textContent = text || ''; }

      open.addEventListener('click', function () {
        if (form.hasAttribute('hidden')) form.removeAttribute('hidden');
        else form.setAttribute('hidden', '');
        if (copy.options.length > 1) return;
        fetch('/volume/api/with-muscles', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            (j.exercises || []).forEach(function (ex) {
              var opt = el('option', { value: ex.name }, ex.name);
              opt._primary = ex.primary;
              opt._secondary = ex.secondary;
              copy.appendChild(opt);
            });
          })
          .catch(function () { say('The exercise list did not load. You can still pick muscles.'); });
      });
      copy.addEventListener('change', function () {
        var opt = copy.options[copy.selectedIndex];
        if (!opt || !opt._primary) return;
        fill(form, opt._primary, opt._secondary);
      });
      stretch.addEventListener('click', function () {
        say('Saving...');
        post({ name: item.name, exerciseId: item.exerciseId, as: 'stretch' }, false);
      });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var primary = checked(form, 'primary');
        if (!primary.length) { say('Pick at least one primary muscle. Nothing is guessed.'); return; }
        say('Saving...');
        post({
          name: item.name,
          exerciseId: item.exerciseId,
          primaryMuscles: primary,
          secondaryMuscles: checked(form, 'secondary'),
        }, publish.checked);
      });

      function post(body, alsoPublish) {
        fetch('/volume/api/assign', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(body),
        }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (res) {
            if (!res.ok || !res.j.success) throw new Error((res.j && res.j.error) || 'Could not save.');
            if (!alsoPublish) {
              say(body.as === 'stretch' ? 'Saved as a stretch. Stretches stay off the muscle map.' : 'Saved.');
              if (opts.onSaved) opts.onSaved();
              return;
            }
            var ex = res.j.exercise || {};
            return fetch('/library/api/exercises', {
              method: 'POST', credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                name: ex.name || item.name,
                category: ex.category || 'strength',
                equipment: ex.equipment || 'none',
                primaryMuscles: ex.primaryMuscles || body.primaryMuscles,
                secondaryMuscles: ex.secondaryMuscles || [],
                requestPublication: true,
              }),
            }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
              .then(function (pub) {
                if (pub.j && pub.j.publication && pub.j.publication.ok) say('Saved, and sent for review.');
                else say('Muscles saved. ' + ((pub.j && (pub.j.error || (pub.j.publication && pub.j.publication.error))) || 'The review request did not send.'));
                if (opts.onSaved) opts.onSaved();
              });
          })
          .catch(function (err) { say(err.message || 'Could not save.'); });
      }

      actions.appendChild(open);
      actions.appendChild(stretch);
      li.appendChild(title);
      li.appendChild(meta);
      li.appendChild(actions);
      li.appendChild(form);
      li.appendChild(status);
      list.appendChild(li);
    });
  }

  window.Unassigned = { mount: mount };
})();
