/* Public session page: animate each figure, wire the Print button. Everything works without this file
   (the server draws still frames); it only upgrades the screen view. No user text is read or written. */
(function () {
  'use strict';
  var live = document.querySelectorAll('.sp-live');
  var Player = window.StickFigurePlayer;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.hasAttribute && t.hasAttribute('data-print')) window.print();
  });

  function start() {
    Player = window.StickFigurePlayer;
    if (!Player || reduce) return; // reduced motion keeps the still frames
    var cache = {};
    Array.prototype.forEach.call(live, function (box) {
      var key = box.getAttribute('data-pose');
      if (!key || !/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(key)) return;
      cache[key] = cache[key] || fetch('/poses/' + key + '.json', { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
      cache[key].then(function (data) {
        new Player(box, data, { autoplay: true });
        box.parentNode.classList.add('js-live');
        document.documentElement.classList.add('js-live-any');
      }).catch(function () { /* the stills stay visible */ });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
