(function () {
  'use strict';
  var btn = document.getElementById('sx-new'), msg = document.getElementById('sx-msg');
  if (!btn) return;
  btn.addEventListener('click', function () {
    btn.disabled = true;
    fetch('/sessions/api', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New session' }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) { location.href = '/sessions/' + j.session.id; return; }
        msg.className = 'sx-msg error'; msg.textContent = (j && j.error) || 'Could not create the session'; btn.disabled = false;
      })
      .catch(function () { msg.className = 'sx-msg error'; msg.textContent = 'Could not reach the server'; btn.disabled = false; });
  });
})();
