/*
 * Opus 4.8 — Soft Body Physics Tetris
 *
 * Classic Tetris rules drive a logical grid, while the active piece is rendered
 * as a wobbly mass-spring jelly. The logical position is authoritative for
 * collisions and line clears; the soft body springs toward that target so the
 * piece bounces, sags and squashes as it falls and rotates.
 */
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('Three.js failed to load.');
    return;
  }

  // ----- Board configuration -------------------------------------------------
  const COLS = 8;
  const ROWS = 16;
  const DEPTH = 1; // one cell deep

  // ----- Tetromino definitions (square matrices, 1 = filled) ------------------
  const SHAPES = {
    I: { color: 0x4fd1c5, matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ] },
    O: { color: 0xf6e05e, matrix: [
      [1, 1],
      [1, 1],
    ] },
    T: { color: 0xb794f6, matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ] },
    S: { color: 0x68d391, matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ] },
    Z: { color: 0xfc8181, matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ] },
    J: { color: 0x63b3ed, matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ] },
    L: { color: 0xf6ad55, matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ] },
  };
  const SHAPE_KEYS = Object.keys(SHAPES);

  function rotateMatrixCW(m) {
    const n = m.length;
    const out = [];
    for (let r = 0; r < n; r++) {
      out.push(new Array(n).fill(0));
    }
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        out[c][n - 1 - r] = m[r][c];
      }
    }
    return out;
  }

  // cells occupied by a matrix, in matrix-local (col, row) coordinates
  function matrixCells(m) {
    const cells = [];
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (m[r][c]) cells.push([c, r]);
      }
    }
    return cells;
  }

  // ----- Coordinate mapping (board space -> world space) ----------------------
  // Board space: bx in [0, COLS], by in [0, ROWS] (0 = top), bz in [0, DEPTH].
  function boardToWorld(bx, by, bz, out) {
    out.x = bx - COLS / 2;
    out.y = ROWS / 2 - by;
    out.z = bz - DEPTH / 2;
    return out;
  }

  // ===========================================================================
  // Soft body for the active piece
  // ===========================================================================
  class SoftPiece {
    constructor(cells, color) {
      this.color = color;
      this.particles = [];      // {pos, vel, target}
      this.springs = [];        // {a, b, rest}
      this.cellCorners = [];    // per cell: 8 particle indices
      this.build(cells);
      this.buildMesh();
    }

    cornerKey(x, y, z) { return x + ',' + y + ',' + z; }

    // cells: array of [bx, by] integer board cells the piece occupies
    build(cells) {
      const map = new Map();
      const getParticle = (x, y, z) => {
        const key = this.cornerKey(x, y, z);
        if (map.has(key)) return map.get(key);
        const idx = this.particles.length;
        const pos = new THREE.Vector3();
        boardToWorld(x, y, z, pos);
        this.particles.push({
          pos: pos.clone(),
          vel: new THREE.Vector3(),
          target: pos.clone(),
          board: new THREE.Vector3(x, y, z), // board-space rest, updated on move
        });
        map.set(key, idx);
        return idx;
      };

      const springSet = new Set();
      const addSpring = (a, b) => {
        if (a === b) return;
        const key = a < b ? a + '-' + b : b + '-' + a;
        if (springSet.has(key)) return;
        springSet.add(key);
        const rest = this.particles[a].pos.distanceTo(this.particles[b].pos);
        this.springs.push({ a, b, rest });
      };

      for (const [bx, by] of cells) {
        // 8 corners of the unit cube for this cell
        const corners = [];
        for (let dz = 0; dz <= DEPTH; dz += DEPTH) {
          for (let dy = 0; dy <= 1; dy++) {
            for (let dx = 0; dx <= 1; dx++) {
              corners.push(getParticle(bx + dx, by + dy, dz));
            }
          }
        }
        this.cellCorners.push(corners);
        // fully connect the 8 corners -> structural + shear + bend springs
        for (let i = 0; i < corners.length; i++) {
          for (let j = i + 1; j < corners.length; j++) {
            addSpring(corners[i], corners[j]);
          }
        }
      }
    }

    buildMesh() {
      // 12 triangles (6 faces) per cell. Corner index layout within a cell:
      // index = dz*4 + dy*2 + dx  =>  bit0:x bit1:y bit2:z
      const faceQuads = [
        [0, 1, 3, 2], // z = back (dz 0)
        [4, 6, 7, 5], // z = front (dz 1)
        [0, 4, 5, 1], // y = bottom
        [2, 3, 7, 6], // y = top
        [0, 2, 6, 4], // x = left
        [1, 5, 7, 3], // x = right
      ];
      const triIndices = [];
      const vertexParticle = []; // geometry vertex -> particle index
      for (const corners of this.cellCorners) {
        for (const q of faceQuads) {
          const base = vertexParticle.length;
          for (const ci of q) vertexParticle.push(corners[ci]);
          triIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
      this.vertexParticle = vertexParticle;
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(vertexParticle.length * 3);
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setIndex(triIndices);

      // Wireframe edges (12 per cell), mapped to particles for cheap updates
      const cubeEdges = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
      ];
      const edgeParticle = [];
      const edgeSeen = new Set();
      for (const corners of this.cellCorners) {
        for (const [i, j] of cubeEdges) {
          const a = corners[i], b = corners[j];
          const key = a < b ? a + '-' + b : b + '-' + a;
          if (edgeSeen.has(key)) continue;
          edgeSeen.add(key);
          edgeParticle.push(a, b);
        }
      }
      this.edgeParticle = edgeParticle;

      const mat = new THREE.MeshPhysicalMaterial({
        color: this.color,
        roughness: 0.15,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.25,
        transmission: 0.25,
        thickness: 1.2,
        transparent: true,
        opacity: 0.92,
        emissive: this.color,
        emissiveIntensity: 0.18,
      });
      this.mesh = new THREE.Mesh(geom, mat);

      const wireGeo = new THREE.BufferGeometry();
      wireGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.edgeParticle.length * 3), 3));
      const wire = new THREE.LineSegments(
        wireGeo,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
      );
      this.mesh.add(wire);
      this.wire = wire;
      this.updateGeometry();
    }

    // Apply a board-space translation to every target (move / fall, no reshape)
    translate(dx, dy) {
      for (const p of this.particles) {
        p.board.x += dx;
        p.board.y += dy;
        boardToWorld(p.board.x, p.board.y, p.board.z, p.target);
      }
    }

    // Give the jelly an inward squash kick (used on rotate / drop)
    kick(strength) {
      const c = new THREE.Vector3();
      for (const p of this.particles) c.add(p.pos);
      c.multiplyScalar(1 / this.particles.length);
      const tmp = new THREE.Vector3();
      for (const p of this.particles) {
        tmp.copy(c).sub(p.pos).normalize().multiplyScalar(strength);
        p.vel.add(tmp);
      }
    }

    step(dt, params) {
      const { kAnchor, kSpring, gravity, damping } = params;
      const substeps = 4;
      const h = dt / substeps;
      const f = new THREE.Vector3();
      for (let s = 0; s < substeps; s++) {
        // anchor + gravity forces
        for (const p of this.particles) {
          f.copy(p.target).sub(p.pos).multiplyScalar(kAnchor);
          f.y -= gravity; // world y is up, gravity pulls down
          p.vel.addScaledVector(f, h);
        }
        // spring forces
        for (const sp of this.springs) {
          const pa = this.particles[sp.a];
          const pb = this.particles[sp.b];
          f.copy(pb.pos).sub(pa.pos);
          const len = f.length() || 1e-6;
          const diff = (len - sp.rest) / len;
          f.multiplyScalar(kSpring * diff);
          pa.vel.addScaledVector(f, h);
          pb.vel.addScaledVector(f, -h);
        }
        // integrate + damping
        const d = Math.pow(damping, h * 60);
        for (const p of this.particles) {
          p.vel.multiplyScalar(d);
          p.pos.addScaledVector(p.vel, h);
        }
      }
    }

    // distance between current jelly center and its target (for settle check)
    restError() {
      let maxErr = 0;
      for (const p of this.particles) {
        const e = p.pos.distanceTo(p.target);
        if (e > maxErr) maxErr = e;
      }
      return maxErr;
    }

    updateGeometry() {
      const attr = this.mesh.geometry.attributes.position;
      const arr = attr.array;
      const vp = this.vertexParticle;
      for (let i = 0; i < vp.length; i++) {
        const p = this.particles[vp[i]].pos;
        arr[i * 3] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      attr.needsUpdate = true;
      this.mesh.geometry.computeVertexNormals();
      this.mesh.geometry.computeBoundingSphere();
      if (this.wire) {
        const wattr = this.wire.geometry.attributes.position;
        const warr = wattr.array;
        const ep = this.edgeParticle;
        for (let i = 0; i < ep.length; i++) {
          const p = this.particles[ep[i]].pos;
          warr[i * 3] = p.x;
          warr[i * 3 + 1] = p.y;
          warr[i * 3 + 2] = p.z;
        }
        wattr.needsUpdate = true;
      }
    }

    dispose() {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      if (this.wire) {
        this.wire.geometry.dispose();
        this.wire.material.dispose();
      }
    }
  }

  // ===========================================================================
  // Game
  // ===========================================================================
  class Game {
    constructor() {
      this.canvas = document.getElementById('game');
      this.scoreEl = document.getElementById('score');
      this.linesEl = document.getElementById('lines');
      this.levelEl = document.getElementById('level');
      this.highEl = document.getElementById('high-score');
      this.overlay = document.getElementById('overlay');
      this.overlayTitle = document.getElementById('overlay-title');
      this.overlayMsg = document.getElementById('overlay-message');

      this.physics = { kAnchor: 80, kSpring: 90, gravity: 5.5, damping: 0.82 };

      this.highScore = Number(localStorage.getItem('opus48-high') || 0);
      this.highEl.textContent = this.highScore;

      this.initThree();
      this.initBoardVisuals();
      this.bindInput();
      this.reset(false);

      this.lastTime = performance.now();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    // --- Three.js setup ------------------------------------------------------
    initThree() {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.resizeRenderer();

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x0b0815, 0.018);

      this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      this.camera.position.set(2.5, 1.5, 22);
      this.updateCameraAspect();

      // Lights
      this.scene.add(new THREE.AmbientLight(0x6b6bb0, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(6, 14, 12);
      this.scene.add(key);
      const fill = new THREE.PointLight(0x8ab4ff, 0.6, 80);
      fill.position.set(-10, 4, 14);
      this.scene.add(fill);
      const rim = new THREE.PointLight(0xff8ad8, 0.5, 80);
      rim.position.set(10, -6, -8);
      this.scene.add(rim);

      // Orbit controls (optional)
      if (typeof THREE.OrbitControls === 'function') {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enablePan = false;
        this.controls.minDistance = 12;
        this.controls.maxDistance = 36;
        this.controls.maxPolarAngle = Math.PI * 0.85;
        this.controls.minPolarAngle = Math.PI * 0.15;
        this.controls.update();
      }

      window.addEventListener('resize', () => {
        this.resizeRenderer();
        this.updateCameraAspect();
      });
    }

    updateCameraAspect() {
      const w = this.canvas.clientWidth || 460;
      const h = this.canvas.clientHeight || 560;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    resizeRenderer() {
      const w = this.canvas.clientWidth || 460;
      const h = this.canvas.clientHeight || 560;
      this.renderer.setSize(w, h, false);
    }

    initBoardVisuals() {
      this.boardGroup = new THREE.Group();
      this.scene.add(this.boardGroup);

      // Well frame (wireframe box around the play field)
      const min = new THREE.Vector3();
      const max = new THREE.Vector3();
      boardToWorld(0, ROWS, 0, min);
      boardToWorld(COLS, 0, DEPTH, max);
      const size = new THREE.Vector3().subVectors(max, min);
      const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
      const frameGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const frame = new THREE.LineSegments(
        new THREE.EdgesGeometry(frameGeo),
        new THREE.LineBasicMaterial({ color: 0x8b7fd6, transparent: true, opacity: 0.45 })
      );
      frame.position.copy(center);
      this.scene.add(frame);

      // translucent back / floor panels
      const panelMat = new THREE.MeshBasicMaterial({
        color: 0x1c1538, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.y), panelMat);
      back.position.set(center.x, center.y, min.z);
      this.scene.add(back);

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(size.x, size.z), panelMat.clone());
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(center.x, min.y, center.z);
      this.scene.add(floor);

      // grid helper on the back wall
      const grid = new THREE.GridHelper(Math.max(size.x, size.y), Math.max(COLS, ROWS), 0x4a3f7a, 0x2c2550);
      grid.material.transparent = true;
      grid.material.opacity = 0.25;
      grid.rotation.x = Math.PI / 2;
      grid.position.set(center.x, center.y, min.z + 0.02);
      // scale grid to field
      grid.scale.set(size.x / Math.max(size.x, size.y), 1, size.y / Math.max(size.x, size.y));
      this.scene.add(grid);

      this.settledGroup = new THREE.Group();
      this.scene.add(this.settledGroup);

      this._v = new THREE.Vector3();
    }

    // --- Game state ----------------------------------------------------------
    reset(autoStart) {
      this.board = [];
      for (let r = 0; r < ROWS; r++) this.board.push(new Array(COLS).fill(null));

      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.gameOver = false;
      this.paused = false;
      this.running = !!autoStart;

      this.dropInterval = 0.85;       // seconds between gravity steps
      this.dropTimer = 0;
      this.softDrop = false;
      this.LOCK_DELAY = 0.5;          // grace period once a piece is grounded
      this.lockTimer = this.LOCK_DELAY;

      this.clearActivePiece();
      this.bag = [];
      this.rebuildSettled();
      this.updateHud();

      if (autoStart) {
        this.spawnPiece();
        this.hideOverlay();
      } else {
        this.showOverlay('Opus 4.8', 'Squishy 3D Tetris. Press <strong>Enter</strong> or tap Play to start.', 'Play');
      }
    }

    start() {
      if (this.running && !this.gameOver) return;
      this.reset(true);
    }

    clearActivePiece() {
      if (this.soft) {
        this.boardGroup.remove(this.soft.mesh);
        this.soft.dispose();
        this.soft = null;
      }
      this.active = null;
    }

    nextFromBag() {
      if (this.bag.length === 0) {
        this.bag = SHAPE_KEYS.slice();
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }

    spawnPiece() {
      const key = this.nextFromBag();
      const def = SHAPES[key];
      const matrix = def.matrix.map((row) => row.slice());
      const n = matrix.length;
      const piece = {
        key,
        color: def.color,
        matrix,
        col: Math.floor((COLS - n) / 2),
        row: -this.topOffset(matrix),
        rot: 0,
      };
      if (this.collides(piece, piece.col, piece.row, piece.matrix)) {
        this.endGame();
        return;
      }
      this.active = piece;
      this.lockTimer = this.LOCK_DELAY;
      this.buildSoft();
    }

    // distance from the top of the matrix to the first filled row
    topOffset(matrix) {
      for (let r = 0; r < matrix.length; r++) {
        if (matrix[r].some((v) => v)) return r;
      }
      return 0;
    }

    pieceCells(piece, col, row, matrix) {
      const cells = [];
      for (const [c, r] of matrixCells(matrix)) {
        cells.push([col + c, row + r]);
      }
      return cells;
    }

    collides(piece, col, row, matrix) {
      for (const [bx, by] of this.pieceCells(piece, col, row, matrix)) {
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by][bx]) return true;
      }
      return false;
    }

    buildSoft() {
      if (this.soft) {
        this.boardGroup.remove(this.soft.mesh);
        this.soft.dispose();
      }
      const cells = this.pieceCells(this.active, this.active.col, this.active.row, this.active.matrix);
      this.soft = new SoftPiece(cells, this.active.color);
      this.boardGroup.add(this.soft.mesh);
    }

    // --- Player actions ------------------------------------------------------
    move(dir) {
      if (!this.canPlay()) return;
      const nc = this.active.col + dir;
      if (!this.collides(this.active, nc, this.active.row, this.active.matrix)) {
        this.active.col = nc;
        if (this.soft) this.soft.translate(dir, 0);
        this.lockTimer = this.LOCK_DELAY; // moving refreshes the lock delay
      }
    }

    rotate(dirCW) {
      if (!this.canPlay()) return;
      let m = this.active.matrix;
      const times = dirCW ? 1 : 3;
      for (let i = 0; i < times; i++) m = rotateMatrixCW(m);
      // wall kicks: try a few horizontal nudges
      const kicks = [0, -1, 1, -2, 2];
      for (const k of kicks) {
        if (!this.collides(this.active, this.active.col + k, this.active.row, m)) {
          this.active.col += k;
          this.active.matrix = m;
          this.active.rot = (this.active.rot + (dirCW ? 1 : 3)) % 4;
          this.buildSoft();          // reshape jelly
          this.soft.kick(2.2);       // squash on rotate
          this.lockTimer = this.LOCK_DELAY;
          return;
        }
      }
    }

    setSoftDrop(on) { this.softDrop = on; }

    hardDrop() {
      if (!this.canPlay()) return;
      let drop = 0;
      while (!this.collides(this.active, this.active.col, this.active.row + 1, this.active.matrix)) {
        this.active.row++;
        drop++;
      }
      if (drop > 0 && this.soft) this.soft.translate(0, drop);
      this.score += drop * 2;
      if (this.soft) this.soft.kick(-3.5); // stretch/splat
      this.lockTimer = 0.16; // brief splat before lock
      this.updateHud();
    }

    canPlay() {
      return this.running && !this.paused && !this.gameOver && this.active;
    }

    grounded() {
      return this.collides(this.active, this.active.col, this.active.row + 1, this.active.matrix);
    }

    moveDown() {
      if (this.grounded()) return false;
      this.active.row++;
      if (this.soft) this.soft.translate(0, 1);
      return true;
    }

    lockPiece() {
      const cells = this.pieceCells(this.active, this.active.col, this.active.row, this.active.matrix);
      for (const [bx, by] of cells) {
        if (by < 0) { this.endGame(); return; }
        this.board[by][bx] = this.active.color;
      }
      this.clearActivePiece();
      const cleared = this.clearLines();
      this.addScore(cleared);
      this.rebuildSettled();
      this.spawnPiece();
    }

    clearLines() {
      let cleared = 0;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.board[r].every((c) => c)) {
          this.board.splice(r, 1);
          this.board.unshift(new Array(COLS).fill(null));
          cleared++;
          r++; // re-check this row index after shift
        }
      }
      return cleared;
    }

    addScore(cleared) {
      if (cleared > 0) {
        const table = [0, 100, 300, 500, 800];
        this.score += table[cleared] * this.level;
        this.lines += cleared;
        const newLevel = Math.floor(this.lines / 10) + 1;
        if (newLevel !== this.level) {
          this.level = newLevel;
          this.dropInterval = Math.max(0.1, 0.85 - (this.level - 1) * 0.07);
        }
      }
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('opus48-high', String(this.highScore));
      }
      this.updateHud();
    }

    // --- Settled blocks rendering -------------------------------------------
    rebuildSettled() {
      while (this.settledGroup.children.length) {
        const child = this.settledGroup.children.pop();
        child.geometry.dispose();
        child.material.dispose();
      }
      const geo = new THREE.BoxGeometry(0.92, 0.92, DEPTH * 0.92);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const color = this.board[r][c];
          if (!color) continue;
          const mat = new THREE.MeshPhysicalMaterial({
            color, roughness: 0.3, metalness: 0.0,
            clearcoat: 0.8, clearcoatRoughness: 0.4,
            emissive: color, emissiveIntensity: 0.12,
          });
          const cube = new THREE.Mesh(geo.clone(), mat);
          boardToWorld(c + 0.5, r + 0.5, DEPTH / 2, this._v);
          cube.position.copy(this._v);
          this.settledGroup.add(cube);
        }
      }
      geo.dispose();
    }

    // --- HUD / overlay -------------------------------------------------------
    updateHud() {
      this.scoreEl.textContent = this.score;
      this.linesEl.textContent = this.lines;
      this.levelEl.textContent = this.level;
      this.highEl.textContent = this.highScore;
    }

    showOverlay(title, msg, btnLabel) {
      this.overlayTitle.textContent = title;
      this.overlayMsg.innerHTML = msg;
      const btn = document.getElementById('start-btn');
      if (btn) btn.textContent = btnLabel || 'Play';
      this.overlay.classList.remove('hidden');
    }

    hideOverlay() { this.overlay.classList.add('hidden'); }

    togglePause() {
      if (!this.running || this.gameOver) return;
      this.paused = !this.paused;
      if (this.paused) {
        this.showOverlay('Paused', 'Press <strong>P</strong> or tap Pause to resume.', 'Resume');
      } else {
        this.hideOverlay();
      }
    }

    endGame() {
      this.gameOver = true;
      this.running = false;
      this.clearActivePiece();
      this.showOverlay('Game Over', 'Score: <strong>' + this.score + '</strong> · Lines: <strong>' + this.lines + '</strong><br>Press <strong>Enter</strong> or tap Play to try again.', 'Play again');
    }

    // --- Input ---------------------------------------------------------------
    bindInput() {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (!this.running || this.gameOver) { this.start(); e.preventDefault(); }
          return;
        }
        if (e.key === 'p' || e.key === 'P') { this.togglePause(); e.preventDefault(); return; }
        if (!this.canPlay()) return;
        switch (e.key) {
          case 'ArrowLeft': case 'a': case 'A': this.move(-1); e.preventDefault(); break;
          case 'ArrowRight': case 'd': case 'D': this.move(1); e.preventDefault(); break;
          case 'ArrowDown': case 's': case 'S': this.setSoftDrop(true); e.preventDefault(); break;
          case 'ArrowUp': case 'w': case 'W': case 'e': case 'E': this.rotate(true); e.preventDefault(); break;
          case 'q': case 'Q': case 'z': case 'Z': this.rotate(false); e.preventDefault(); break;
          case ' ': this.hardDrop(); e.preventDefault(); break;
        }
      });
      window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') this.setSoftDrop(false);
      });

      const startBtn = document.getElementById('start-btn');
      if (startBtn) startBtn.addEventListener('click', () => {
        if (this.paused) { this.togglePause(); return; }
        this.start();
      });

      // Mobile / touch buttons
      const handle = (action) => {
        switch (action) {
          case 'left': this.move(-1); break;
          case 'right': this.move(1); break;
          case 'down': this.tickAndSoft(); break;
          case 'rotate': this.rotate(true); break;
          case 'drop': this.hardDrop(); break;
          case 'pause': this.togglePause(); break;
          case 'restart': this.start(); break;
        }
      };
      document.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', (e) => { e.preventDefault(); handle(btn.dataset.action); });
      });
    }

    tickAndSoft() {
      if (!this.canPlay()) return;
      if (this.moveDown()) {
        this.dropTimer = 0;
        this.score += 1;
        this.updateHud();
      }
    }

    // --- Main loop -----------------------------------------------------------
    animate() {
      const now = performance.now();
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.05) dt = 0.05; // clamp big frame gaps

      if (this.running && !this.paused && !this.gameOver && this.active) {
        if (this.grounded()) {
          // lock countdown — wait for the jelly to mostly settle for a nice squash
          this.dropTimer = 0;
          this.lockTimer -= dt;
          const settled = this.soft && this.soft.restError() < 0.5;
          if ((this.lockTimer <= 0 && settled) || this.lockTimer <= -0.7) {
            this.lockPiece();
          }
        } else {
          this.lockTimer = this.LOCK_DELAY;
          const interval = this.softDrop ? Math.min(this.dropInterval, 0.04) : this.dropInterval;
          this.dropTimer += dt;
          if (this.dropTimer >= interval) {
            this.dropTimer = 0;
            this.moveDown();
            if (this.softDrop) this.score += 1;
            this.updateHud();
          }
        }
      }

      if (this.soft) {
        this.soft.step(dt, this.physics);
        this.soft.updateGeometry();
      }

      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.animate);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    new Game();
  });
})();
