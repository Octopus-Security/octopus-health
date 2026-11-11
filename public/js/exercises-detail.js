/* Strength-over-time graph for one exercise (chart.js, served from node_modules). */
(function () {
  'use strict';
  var el = document.getElementById('ex-series'), canvas = document.getElementById('ex-canvas');
  if (!el || !canvas || typeof Chart === 'undefined') return;
  var data = JSON.parse(el.textContent), s = data.series;
  var labels = s.map(function (p) { return p.date; });
  var common = { tension: 0.25, pointRadius: 3, borderWidth: 2 };
  var sets;
  if (data.mode === 'weighted') {
    sets = [
      Object.assign({ label: 'Est. 1RM (lbs)', data: s.map(function (p) { return p.e1rm; }), borderColor: '#2ecc71', backgroundColor: '#2ecc71', spanGaps: true }, common),
      Object.assign({ label: 'Top set (lbs)', data: s.map(function (p) { return p.topWeight; }), borderColor: '#5dade2', backgroundColor: '#5dade2', borderDash: [5, 4] }, common),
    ];
  } else if (data.mode === 'reps') {
    sets = [Object.assign({ label: 'Best reps', data: s.map(function (p) { return p.topReps; }), borderColor: '#2ecc71', backgroundColor: '#2ecc71' }, common)];
  } else {
    sets = [Object.assign({ label: 'Best hold (s)', data: s.map(function (p) { return p.topSeconds; }), borderColor: '#2ecc71', backgroundColor: '#2ecc71' }, common)];
  }
  new Chart(canvas, {
    type: 'line',
    data: { labels: labels, datasets: sets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { ticks: { color: '#888', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: '#1a1a1a' } },
        y: { ticks: { color: '#888' }, grid: { color: '#1a1a1a' }, beginAtZero: false },
      },
      plugins: { legend: { labels: { color: '#bbb' } } },
    },
  });
})();
