/**
 * Ladder path edits shared by the page and the server.
 * A bay is one square. A turn sits on the last bay before the corner.
 * Deleting that bay keeps the corner by moving the turn onto the bay before it.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LadderPath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SHAPES = {
    straight: [{ squares: 8, turn: 0 }],
    l: [{ squares: 6, turn: 90 }, { squares: 4, turn: 0 }],
    square: [
      { squares: 4, turn: 90 },
      { squares: 4, turn: 90 },
      { squares: 4, turn: 90 },
      { squares: 4, turn: 0 },
    ],
    zigzag: [
      { squares: 3, turn: 45 },
      { squares: 3, turn: -45 },
      { squares: 3, turn: 45 },
      { squares: 3, turn: 0 },
    ],
    u: [
      { squares: 2, turn: 90 },
      { squares: 6, turn: 90 },
      { squares: 2, turn: 0 },
    ],
  };

  function expandRuns(runs) {
    var list = runs && runs.length ? runs : [{ squares: 1, turn: 0 }];
    var bays = [];
    for (var ri = 0; ri < list.length; ri++) {
      var run = list[ri] || {};
      var n = Math.round(Number(run.squares));
      if (!isFinite(n) || n < 1) n = 1;
      if (n > 20) n = 20;
      var turn = Number(run.turn) || 0;
      for (var k = 0; k < n; k++) {
        var last = k === n - 1;
        bays.push({ turnAfter: last && ri < list.length - 1 ? turn : 0 });
      }
    }
    return bays;
  }

  function compressRuns(bays) {
    if (!bays.length) return [{ squares: 1, turn: 0 }];
    var runs = [];
    var squares = 0;
    for (var i = 0; i < bays.length; i++) {
      squares += 1;
      var turn = i === bays.length - 1 ? 0 : (Number(bays[i].turnAfter) || 0);
      if (turn || i === bays.length - 1) {
        runs.push({ squares: squares, turn: turn });
        squares = 0;
      }
    }
    while (runs.length > 8) {
      var extra = runs.pop();
      runs[runs.length - 1].squares += extra.squares;
      runs[runs.length - 1].turn = 0;
    }
    runs[runs.length - 1].turn = 0;
    return runs;
  }

  function deleteBay(runs, index) {
    var bays = expandRuns(runs);
    if (bays.length <= 1) return compressRuns(bays);
    index = Number(index);
    if (!isFinite(index) || index < 0 || index >= bays.length) return compressRuns(bays);
    var removed = bays[index];
    if (removed.turnAfter && index > 0 && !bays[index - 1].turnAfter) {
      bays[index - 1].turnAfter = removed.turnAfter;
    }
    bays.splice(index, 1);
    return compressRuns(bays);
  }

  function shapeRuns(name) {
    var rows = SHAPES[name];
    if (!rows) return null;
    return rows.map(function (run) { return { squares: run.squares, turn: run.turn }; });
  }

  return {
    SHAPES: SHAPES,
    expandRuns: expandRuns,
    compressRuns: compressRuns,
    deleteBay: deleteBay,
    shapeRuns: shapeRuns,
  };
});
