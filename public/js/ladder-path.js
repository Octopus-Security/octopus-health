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
  // A closed 45° shape needs eight turns, so nine runs. The old limit of 8
  // stopped at 315° and refused the turn that completes the loop.
  var MAX_RUNS = 24;

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
    // Eight equal 45° turns: 360°, so the ring closes on itself. The first and
    // last runs are one side between them, which is what makes the ends meet.
    octagon: [
      { squares: 1, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 2, turn: 45 },
      { squares: 1, turn: 0 },
    ],
    diamond: [
      { squares: 2, turn: 90 },
      { squares: 3, turn: 90 },
      { squares: 3, turn: 90 },
      { squares: 3, turn: 90 },
      { squares: 1, turn: 0 },
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
    while (runs.length > MAX_RUNS) {
      var extra = runs.pop();
      runs[runs.length - 1].squares += extra.squares;
      runs[runs.length - 1].turn = 0;
    }
    runs[runs.length - 1].turn = 0;
    return runs;
  }

  // Degrees already turned. The last run's turn is always 0, so this is the
  // heading at the end of the ladder relative to the start.
  function headingOf(runs) {
    var total = 0;
    var list = runs || [];
    for (var i = 0; i < list.length; i++) total += Number(list[i].turn) || 0;
    return total;
  }

  // What it would take to point the ladder back the way it started: the turns
  // still owed, as a list of 45/90 steps in the direction already being used.
  function remainingTurns(runs) {
    var heading = headingOf(runs);
    if (!heading) return [];
    var sign = heading > 0 ? 1 : -1;
    var owed = 360 - Math.abs(heading % 360);
    if (owed === 360) return [];
    var steps = [];
    while (owed >= 90 && owed % 90 === 0) {
      steps.push(90 * sign);
      owed -= 90;
    }
    while (owed >= 45) {
      steps.push(45 * sign);
      owed -= 45;
    }
    if (owed) return null;
    return steps;
  }

  // Add a turn to the end of the path. Returns null when it cannot, so the
  // caller can say why rather than doing nothing.
  function addTurn(runs, deg, squaresAfter) {
    var list = (runs || []).map(function (run) {
      return { squares: run.squares, turn: run.turn };
    });
    if (!list.length) list = [{ squares: 1, turn: 0 }];
    if ([45, -45, 90, -90].indexOf(Number(deg)) === -1) return null;
    if (list.length >= MAX_RUNS) return null;
    var last = list[list.length - 1];
    if (last.turn) return null;
    last.turn = Number(deg);
    var n = Math.round(Number(squaresAfter));
    list.push({ squares: isFinite(n) && n >= 1 ? Math.min(20, n) : 1, turn: 0 });
    return list;
  }

  // Finish the shape: add every turn still owed, then make the ring actually
  // meet. The first and last runs lie along the SAME side of the ring, so they
  // have to add up to one side on their own — a last run as long as the others
  // closes the heading but leaves the end a side's length past the start.
  function closeShape(runs) {
    var steps = remainingTurns(runs);
    if (!steps || !steps.length) return null;
    var list = (runs || []).map(function (run) {
      return { squares: run.squares, turn: run.turn };
    });
    if (list.length + steps.length > MAX_RUNS) return null;
    // The side length is what the shape is already using between corners,
    // taken from a middle run so the short opening run does not set it.
    var side = list.length > 1 ? list[1].squares : list[0].squares;
    if (!(side >= 1)) side = 1;
    var head = list[0].squares;
    // The tail is whatever is left of one side after the opening run. A long
    // opening run means the ring is simply one side bigger.
    var tail = side - head;
    while (tail < 1) {
      side += 1;
      tail = side - head;
    }
    for (var i = 0; i < steps.length; i++) {
      var last = i === steps.length - 1;
      var next = addTurn(list, steps[i], last ? tail : side);
      if (!next) return null;
      list = next;
    }
    return list;
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
    MAX_RUNS: MAX_RUNS,
    expandRuns: expandRuns,
    compressRuns: compressRuns,
    deleteBay: deleteBay,
    shapeRuns: shapeRuns,
    headingOf: headingOf,
    remainingTurns: remainingTurns,
    addTurn: addTurn,
    closeShape: closeShape,
  };
});
