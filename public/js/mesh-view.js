/**
 * Small WebGL viewer for a binary STL. Orbit with a drag, zoom with the wheel
 * or a pinch. No extra library: the bytes are the same mesh the download uses.
 */
(function (root) {
  function parseStl(buffer) {
    var view = new DataView(buffer);
    if (buffer.byteLength < 84) throw new Error('short STL');
    var count = view.getUint32(80, true);
    if (84 + count * 50 !== buffer.byteLength) throw new Error('STL length does not match the triangle count');
    var pos = new Float32Array(count * 9);
    var norm = new Float32Array(count * 9);
    var min = [Infinity, Infinity, Infinity];
    var max = [-Infinity, -Infinity, -Infinity];
    var o = 84;
    for (var i = 0; i < count; i++) {
      var nx = view.getFloat32(o, true);
      var ny = view.getFloat32(o + 4, true);
      var nz = view.getFloat32(o + 8, true);
      o += 12;
      for (var k = 0; k < 3; k++) {
        var x = view.getFloat32(o, true);
        var y = view.getFloat32(o + 4, true);
        var z = view.getFloat32(o + 8, true);
        var base = i * 9 + k * 3;
        pos[base] = x;
        pos[base + 1] = y;
        pos[base + 2] = z;
        norm[base] = nx;
        norm[base + 1] = ny;
        norm[base + 2] = nz;
        if (x < min[0]) min[0] = x;
        if (y < min[1]) min[1] = y;
        if (z < min[2]) min[2] = z;
        if (x > max[0]) max[0] = x;
        if (y > max[1]) max[1] = y;
        if (z > max[2]) max[2] = z;
        o += 12;
      }
      o += 2;
    }
    return { pos: pos, norm: norm, min: min, max: max, count: count };
  }

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  function rotation(rx, ry) {
    var cx = Math.cos(rx);
    var sx = Math.sin(rx);
    var cy = Math.cos(ry);
    var sy = Math.sin(ry);
    var rxm = new Float32Array([1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1]);
    var rym = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
    return mul(rxm, rym);
  }

  function mount(canvas) {
    var gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) return { ok: false, setStl: function () {}, resize: function () {}, destroy: function () {} };
    var vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, [
      'attribute vec3 aPos;',
      'attribute vec3 aNrm;',
      'uniform mat4 uMvp;',
      'uniform mat4 uRot;',
      'varying vec3 vN;',
      'void main(){',
      '  vN = mat3(uRot) * aNrm;',
      '  gl_Position = uMvp * vec4(aPos, 1.0);',
      '}',
    ].join('\n'));
    gl.compileShader(vs);
    var fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, [
      'precision mediump float;',
      'varying vec3 vN;',
      'void main(){',
      '  vec3 n = normalize(vN);',
      '  float d = abs(dot(n, normalize(vec3(0.35, 0.75, 0.55))));',
      '  float f = abs(dot(n, normalize(vec3(-0.6, 0.2, 0.4))));',
      '  float light = 0.22 + 0.62 * d + 0.22 * f;',
      '  gl_FragColor = vec4(vec3(0.18, 0.62, 0.38) * light, 1.0);',
      '}',
    ].join('\n'));
    gl.compileShader(fs);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.bindAttribLocation(prog, 1, 'aNrm');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      return { ok: false, setStl: function () {}, resize: function () {}, destroy: function () {} };
    }
    gl.useProgram(prog);
    var uMvp = gl.getUniformLocation(prog, 'uMvp');
    var uRot = gl.getUniformLocation(prog, 'uRot');
    var bufP = gl.createBuffer();
    var bufN = gl.createBuffer();
    var count = 0;
    var center = [0, 0, 0];
    var scale = 1;
    var rx = 0.7;
    var ry = 0.5;
    var dist = 3.2;
    var mesh = null;

    function resize() {
      var w = Math.max(1, canvas.clientWidth || 640);
      var h = Math.max(1, canvas.clientHeight || 320);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var pw = Math.round(w * dpr);
      var ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      resize();
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0.055, 0.055, 0.055, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!count) return;
      var aspect = canvas.width / Math.max(1, canvas.height);
      var proj = perspective(Math.PI / 5, aspect, 0.02, 40);
      var rot = rotation(rx, ry);
      var view = new Float32Array(16);
      for (var i = 0; i < 12; i++) view[i] = rot[i] * scale;
      view[15] = 1;
      var cx = center[0];
      var cy = center[1];
      var cz = center[2];
      view[12] = -(rot[0] * cx + rot[4] * cy + rot[8] * cz) * scale;
      view[13] = -(rot[1] * cx + rot[5] * cy + rot[9] * cz) * scale;
      view[14] = -(rot[2] * cx + rot[6] * cy + rot[10] * cz) * scale - dist;
      gl.uniformMatrix4fv(uMvp, false, mul(proj, view));
      gl.uniformMatrix4fv(uRot, false, rot);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufP);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufN);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }

    function setStl(buffer) {
      mesh = parseStl(buffer);
      count = mesh.count * 3;
      center = [
        (mesh.min[0] + mesh.max[0]) / 2,
        (mesh.min[1] + mesh.max[1]) / 2,
        (mesh.min[2] + mesh.max[2]) / 2,
      ];
      var dx = mesh.max[0] - mesh.min[0];
      var dy = mesh.max[1] - mesh.min[1];
      var dz = mesh.max[2] - mesh.min[2];
      var radius = Math.max(dx, dy, dz) / 2 || 1;
      // Meshes are in millimetres. Fit them into the unit camera so the far plane can see them.
      scale = 1 / radius;
      dist = 3.4;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufP);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufN);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.norm, gl.STATIC_DRAW);
      draw();
    }

    var dragging = false;
    var lastX = 0;
    var lastY = 0;
    var pinch = 0;

    function point(ev) {
      var t = ev.touches ? ev.touches[0] : ev;
      return { x: t.clientX, y: t.clientY };
    }

    canvas.addEventListener('pointerdown', function (ev) {
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      ry += (ev.clientX - lastX) * 0.01;
      rx += (ev.clientY - lastY) * 0.01;
      lastX = ev.clientX;
      lastY = ev.clientY;
      draw();
    });
    function stop() { dragging = false; }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      dist *= ev.deltaY > 0 ? 1.08 : 0.92;
      dist = Math.max(0.4, Math.min(40, dist));
      draw();
    }, { passive: false });
    canvas.addEventListener('touchstart', function (ev) {
      if (ev.touches.length === 2) {
        var a = ev.touches[0];
        var b = ev.touches[1];
        pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (ev) {
      if (ev.touches.length === 2 && pinch) {
        var a = ev.touches[0];
        var b = ev.touches[1];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        dist *= pinch / d;
        dist = Math.max(0.4, Math.min(40, dist));
        pinch = d;
        draw();
      }
    }, { passive: true });

    return {
      ok: true,
      setStl: setStl,
      resize: function () { draw(); },
      destroy: function () {},
      draw: draw,
    };
  }

  root.MeshView = { parseStl: parseStl, mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
