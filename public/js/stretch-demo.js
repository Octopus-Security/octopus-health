/* Exercise demo sheet. StretchDemo.open({id, name, category}) shows the stick-figure animation
   (public/stick-figure.js + pose-map.js, the same as the library and stretch cards) and the
   how-to text, in a sheet over the current page so unsaved edits are not lost.
   StretchDemo.link(el, ex) makes an element open it. Needs StickFigurePlayer and PoseMap. */
(function () {
  'use strict';
  var overlay = null, player = null, opener = null, seq = 0;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function build() {
    overlay = el('div', 'sd-overlay'); overlay.hidden = true;
    var sheet = el('div', 'sd-sheet');
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sd-title');
    var top = el('div', 'sd-top');
    var h = el('h3', 'sd-title'); h.id = 'sd-title';
    var x = el('button', 'sd-close', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close demo');
    top.appendChild(h); top.appendChild(x);
    var media = el('div', 'sd-media'); media.id = 'sd-media';
    var how = el('p', 'sd-how'); how.id = 'sd-how';
    var actions = el('div', 'sd-actions');
    var full = el('a', 'btn'); full.id = 'sd-full'; full.textContent = 'Full page'; full.hidden = true;
    var done = el('button', 'btn', 'Close'); done.type = 'button';
    actions.appendChild(full); actions.appendChild(done);
    sheet.appendChild(top); sheet.appendChild(media); sheet.appendChild(how); sheet.appendChild(actions);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    x.addEventListener('click', close); done.addEventListener('click', close);
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) close(); });
    overlay.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); close(); return; }
      if (ev.key !== 'Tab') return;
      var f = Array.prototype.filter.call(sheet.querySelectorAll('button, a[href]'), function (n) { return !n.hidden && !n.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    seq++;
    if (player) { player.destroy(); player = null; }
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
  }

  function fullLink(id) { return id ? '/library?ex=' + encodeURIComponent(id) : null; }

  function open(ex, trigger) {
    if (!overlay) build();
    var mine = ++seq;
    opener = trigger || document.activeElement;
    var name = ex.name || 'Exercise';
    document.getElementById('sd-title').textContent = name;
    var media = document.getElementById('sd-media'); media.textContent = '';
    var how = document.getElementById('sd-how'); how.className = 'sd-how sd-muted'; how.textContent = 'Loading how-to...';
    var full = document.getElementById('sd-full');
    var href = fullLink(ex.id); full.hidden = !href; if (href) full.href = href;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    var key = window.PoseMap ? window.PoseMap.keyFor(name, ex.category) : null;
    if (player) { player.destroy(); player = null; }
    if (key && window.StickFigurePlayer) {
      var box = el('div', 'sf-container'); media.appendChild(box);
      window.StickFigurePlayer.load(box, key, { autoplay: true }, function (err, p) {
        if (mine !== seq) { if (p) p.destroy(); return; }
        if (err) { media.textContent = ''; media.appendChild(el('span', 'sd-nopose', '🧘')); } else player = p;
      });
    } else media.appendChild(el('span', 'sd-nopose', '🧘'));

    overlay.querySelector('.sd-close').focus();

    var q = (ex.id != null ? 'id=' + encodeURIComponent(ex.id) + '&' : '') + 'name=' + encodeURIComponent(name);
    fetch('/stretch/api/demo?' + q, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (mine !== seq) return;
        var d = j && j.exercise;
        if (d && d.instructions) { how.className = 'sd-how'; how.textContent = d.instructions; }
        else { how.className = 'sd-how sd-muted'; how.textContent = 'No how-to written for this one yet. Watch the animation, hold the stretch, and breathe slowly.'; }
        if (d && d.id && !href) { full.href = fullLink(d.id); full.hidden = false; }
      })
      .catch(function () {
        if (mine !== seq) return;
        how.className = 'sd-how sd-muted'; how.textContent = 'Could not load the how-to. The animation above still works.';
      });
  }

  /** Make `node` open the demo for `ex` on click (buttons and links already handle Enter/Space). */
  function link(node, ex) {
    node.classList.add('demo-link');
    node.setAttribute('aria-haspopup', 'dialog');
    node.title = 'Show how to do ' + ex.name;
    node.addEventListener('click', function (ev) { ev.preventDefault(); open(ex, node); });
    return node;
  }

  window.StretchDemo = { open: open, close: close, link: link };
})();
