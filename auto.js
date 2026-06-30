import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLS = 10;
const ROWS = 20;
const CELL = 1;
const SEGMENTS = 2;
const HIGH_SCORE_KEY = "auto-high-score";

const PIECE_DEFS = {
  I: { color: 0x38bdf8, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  O: { color: 0xfacc15, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { color: 0xa78bfa, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  S: { color: 0x4ade80, cells: [[0, 1], [1, 1], [1, 0], [2, 0]] },
  Z: { color: 0xf87171, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: 0x60a5fa, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  L: { color: 0xfb923c, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
};

const PIECE_KEYS = Object.keys(PIECE_DEFS);
const LINE_SCORES = [0, 100, 300, 500, 800];

function rotateCells(cells, dir) {
  return cells.map(([x, y]) => (dir > 0 ? [-y, x] : [y, -x]));
}

function normalizeCells(cells) {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { key, ...PIECE_DEFS[key], cells: normalizeCells(PIECE_DEFS[key].cells) };
}

function gridIndex(x, y) {
  return y * COLS + x;
}

class SoftBlock {
  constructor(color, scene) {
    const half = CELL * 0.46;
    this.geometry = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, CELL * 0.92, SEGMENTS, SEGMENTS, SEGMENTS);
    this.material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.08,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    const pos = this.geometry.attributes.position;
    const seg = SEGMENTS + 1;
    this.particles = [];
    this.restLocal = [];
    this.springs = [];
    this.anchors = [];
    this.locked = false;
    this.removing = false;
    this.removeProgress = 0;

    for (let iz = 0; iz < seg; iz++) {
      for (let iy = 0; iy < seg; iy++) {
        for (let ix = 0; ix < seg; ix++) {
          const idx = iz * seg * seg + iy * seg + ix;
          const lx = -half + (ix / SEGMENTS) * (half * 2);
          const ly = -half + (iy / SEGMENTS) * (half * 2);
          const lz = -half + (iz / SEGMENTS) * (half * 2);
          this.restLocal.push({ x: lx, y: ly, z: lz });
          this.particles.push({
            x: lx, y: ly, z: lz,
            px: lx, py: ly, pz: lz,
            vx: 0, vy: 0, vz: 0,
            invMass: 1,
          });
          pos.setXYZ(idx, lx, ly, lz);
        }
      }
    }

    for (let iz = 0; iz < seg; iz++) {
      for (let iy = 0; iy < seg; iy++) {
        for (let ix = 0; ix < seg; ix++) {
          const a = iz * seg * seg + iy * seg + ix;
          if (ix < seg - 1) this.springs.push([a, a + 1, 1]);
          if (iy < seg - 1) this.springs.push([a, a + seg, 1]);
          if (iz < seg - 1) this.springs.push([a, a + seg * seg, 1]);
        }
      }
    }

    this.origin = { x: 0, y: 0, z: 0 };
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  setOrigin(x, y, z) {
    this.origin.x = x;
    this.origin.y = y;
    this.origin.z = z;
  }

  setAnchors(active) {
    this.anchors = active ? this.particles.map((_, i) => ({
      local: this.restLocal[i],
      strength: 42,
    })) : [];
  }

  step(dt, gravity, bounds, others = []) {
    const damp = Math.pow(0.04, dt);
    const stiffness = 180;

    for (const p of this.particles) {
      if (this.removing) continue;
      p.vy += gravity * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.vz *= damp;
    }

    for (const [a, b, restScale] of this.springs) {
      const pa = this.particles[a];
      const pb = this.particles[b];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const dist = Math.hypot(dx, dy, dz) || 0.0001;
      const rest = Math.hypot(
        this.restLocal[b].x - this.restLocal[a].x,
        this.restLocal[b].y - this.restLocal[a].y,
        this.restLocal[b].z - this.restLocal[a].z,
      ) * restScale;
      const force = (dist - rest) * stiffness;
      const nx = (dx / dist) * force;
      const ny = (dy / dist) * force;
      const nz = (dz / dist) * force;
      pa.vx += nx * dt;
      pa.vy += ny * dt;
      pa.vz += nz * dt;
      pb.vx -= nx * dt;
      pb.vy -= ny * dt;
      pb.vz -= nz * dt;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (this.removing) continue;

      const anchor = this.anchors[i];
      if (anchor) {
        const tx = anchor.local.x;
        const ty = anchor.local.y;
        const tz = anchor.local.z;
        p.vx += (tx - p.x) * anchor.strength * dt;
        p.vy += (ty - p.y) * anchor.strength * dt;
        p.vz += (tz - p.z) * anchor.strength * dt;
      }

      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const wx = this.origin.x + p.x;
      const wy = this.origin.y + p.y;
      const wz = this.origin.z + p.z;

      if (wy < bounds.floorY + 0.02) {
        const pen = bounds.floorY + 0.02 - wy;
        p.y += pen;
        p.vy = Math.abs(p.vy) * 0.15;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      if (wx < bounds.minX) { p.x += bounds.minX - wx; p.vx *= -0.2; }
      if (wx > bounds.maxX) { p.x -= wx - bounds.maxX; p.vx *= -0.2; }
      if (wz < bounds.minZ) { p.z += bounds.minZ - wz; p.vz *= -0.2; }
      if (wz > bounds.maxZ) { p.z -= wz - bounds.maxZ; p.vz *= -0.2; }

      if (this.locked && !this.removing) {
        for (const other of others) {
          if (other === this || !other.locked || other.removing) continue;
          const dx = wx - other.origin.x;
          const dy = wy - other.origin.y;
          const dz = wz - other.origin.z;
          const dist = Math.hypot(dx, dy, dz);
          const minDist = CELL * 0.52;
          if (dist < minDist && dist > 0.0001) {
            const pen = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            p.x += nx * pen * 0.3;
            p.y += ny * pen * 0.3;
            p.z += nz * pen * 0.3;
            p.vx += nx * pen * 10 * dt;
            p.vy += ny * pen * 10 * dt;
            p.vz += nz * pen * 10 * dt;
          }
        }
      }
    }

    if (this.removing) {
      this.removeProgress += dt * 2.5;
      this.material.opacity = Math.max(0, 1 - this.removeProgress);
      this.material.transparent = true;
      for (const p of this.particles) {
        p.vy -= 6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
    }

    this.syncMesh();
  }

  syncMesh() {
    const pos = this.geometry.attributes.position;
    for (let i = 0; i < this.particles.length; i++) {
      pos.setXYZ(i, this.particles[i].x, this.particles[i].y, this.particles[i].z);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.mesh.position.set(this.origin.x, this.origin.y, this.origin.z);
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

class AutoGame {
  constructor() {
    this.canvas = document.getElementById("game");
    this.nextCanvas = document.getElementById("next-canvas");
    this.overlay = document.getElementById("overlay");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayMessage = document.getElementById("overlay-message");
    this.scoreEl = document.getElementById("score");
    this.linesEl = document.getElementById("lines");
    this.levelEl = document.getElementById("level");
    this.highScoreEl = document.getElementById("high-score");

    this.highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    this.highScoreEl.textContent = String(this.highScore);

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = "idle";
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.softDropping = false;

    this.grid = new Array(COLS * ROWS).fill(null);
    this.blocks = [];
    this.activeBlocks = [];
    this.activeCells = [];
    this.activeColor = 0xffffff;
    this.pieceX = 3;
    this.pieceY = ROWS - 1;
    this.currentPiece = null;
    this.nextPiece = randomPiece();

    this.rotationIndex = 0;
    this.rotationCache = new Map();

    this.setupRenderer();
    this.bindInput();
    this.spawnPiece();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  setupRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0812);
    this.scene.fog = new THREE.Fog(0x0a0812, 18, 42);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(5.5, 8, 14);
    this.camera.lookAt(4.5, 9, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.target.set(COLS / 2 - 0.5, ROWS / 2, 0);

    const ambient = new THREE.AmbientLight(0x6b5f8f, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(6, 18, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const rim = new THREE.DirectionalLight(0xa78bfa, 0.45);
    rim.position.set(-8, 6, -6);
    this.scene.add(ambient, key, rim);

    const frameGeo = new THREE.BoxGeometry(COLS * CELL + 0.3, ROWS * CELL + 0.3, CELL * 2.2);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1e1630,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(COLS / 2 - 0.5, ROWS / 2, 0);
    this.scene.add(frame);

    const floorGeo = new THREE.PlaneGeometry(COLS * CELL + 1, CELL * 3);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x120e1c, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(COLS / 2 - 0.5, 0, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(COLS, COLS, 0x3d2f5c, 0x241a38);
    gridHelper.position.set(COLS / 2 - 0.5, 0.01, 0);
    this.scene.add(gridHelper);

    this.physicsBounds = {
      floorY: 0.02,
      minX: -0.35,
      maxX: COLS - 0.65,
      minZ: -0.55,
      maxZ: 0.55,
    };
  }

  boardToWorld(x, y) {
    return { x: x * CELL, y: y * CELL + CELL * 0.5, z: 0 };
  }

  getRotatedCells(piece, rotationIndex) {
    const key = `${piece.key}:${rotationIndex}`;
    if (!this.rotationCache.has(key)) {
      let cells = piece.cells;
      for (let i = 0; i < rotationIndex; i++) cells = rotateCells(cells, 1);
      cells = normalizeCells(cells);
      this.rotationCache.set(key, cells);
    }
    return this.rotationCache.get(key);
  }

  spawnPiece() {
    this.currentPiece = this.nextPiece;
    this.nextPiece = randomPiece();
    this.rotationIndex = 0;
    this.activeColor = this.currentPiece.color;
    this.activeCells = this.getRotatedCells(this.currentPiece, 0);
    this.pieceX = Math.floor((COLS - Math.max(...this.activeCells.map(([x]) => x)) - 1) / 2);
    this.pieceY = ROWS - 1 - Math.max(...this.activeCells.map(([, y]) => y));

    this.clearActiveBlocks();
    for (const [cx, cy] of this.activeCells) {
      const block = new SoftBlock(this.activeColor, this.scene);
      block.setAnchors(true);
      const w = this.boardToWorld(this.pieceX + cx, this.pieceY - cy);
      block.setOrigin(w.x, w.y, w.z);
      this.activeBlocks.push({ block, ox: cx, oy: cy });
    }

    this.drawNextPiece();

    if (!this.canPlace(this.activeCells, this.pieceX, this.pieceY)) {
      this.gameOver();
    }
  }

  clearActiveBlocks() {
    for (const { block } of this.activeBlocks) block.dispose(this.scene);
    this.activeBlocks = [];
  }

  canPlace(cells, px, py) {
    for (const [cx, cy] of cells) {
      const x = px + cx;
      const y = py - cy;
      if (x < 0 || x >= COLS || y < 0) return false;
      if (y < ROWS && this.grid[gridIndex(x, y)]) return false;
    }
    return true;
  }

  lockPiece() {
    for (const { block, ox, oy } of this.activeBlocks) {
      const x = this.pieceX + ox;
      const y = this.pieceY - oy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        this.grid[gridIndex(x, y)] = block;
        this.blocks.push(block);
      } else {
        block.dispose(this.scene);
      }
      block.setAnchors(false);
      block.locked = true;
    }
    this.activeBlocks = [];
    this.clearCompletedLines();
    this.spawnPiece();
  }

  clearCompletedLines() {
    const fullRows = [];
    for (let y = 0; y < ROWS; y++) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (!this.grid[gridIndex(x, y)]) { full = false; break; }
      }
      if (full) fullRows.push(y);
    }
    if (!fullRows.length) return;

    const count = fullRows.length;
    this.lines += count;
    this.score += LINE_SCORES[count] * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    this.updateHud();

    for (const row of fullRows) {
      for (let x = 0; x < COLS; x++) {
        const block = this.grid[gridIndex(x, row)];
        if (block) {
          block.removing = true;
          this.grid[gridIndex(x, row)] = null;
        }
      }
    }

    setTimeout(() => this.collapseAfterClear(fullRows), 450);
  }

  collapseAfterClear(clearedRows) {
    for (const block of [...this.blocks]) {
      if (!block.removing) continue;
      const idx = this.blocks.indexOf(block);
      if (idx >= 0) this.blocks.splice(idx, 1);
      block.dispose(this.scene);
    }

    const remaining = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const block = this.grid[gridIndex(x, y)];
        if (block && !block.removing) remaining.push({ x, y, block });
        this.grid[gridIndex(x, y)] = null;
      }
    }

    for (const { x, y, block } of remaining) {
      let drop = 0;
      for (const row of clearedRows) {
        if (row < y) drop++;
      }
      const newY = y - drop;
      this.grid[gridIndex(x, newY)] = block;
      const w = this.boardToWorld(x, newY);
      block.setOrigin(w.x, w.y, w.z);
      for (const p of block.particles) {
        p.vy -= 2;
      }
    }
  }

  move(dx) {
    if (this.state !== "playing") return;
    const nx = this.pieceX + dx;
    if (this.canPlace(this.activeCells, nx, this.pieceY)) {
      this.pieceX = nx;
      this.syncActiveBlocks();
    }
  }

  rotate(dir) {
    if (this.state !== "playing") return;
    const nextRot = (this.rotationIndex + (dir > 0 ? 1 : 3)) % 4;
    const nextCells = this.getRotatedCells(this.currentPiece, nextRot);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (this.canPlace(nextCells, this.pieceX + kick, this.pieceY)) {
        this.rotationIndex = nextRot;
        this.activeCells = nextCells;
        this.pieceX += kick;
        this.rebuildActiveBlocks();
        return;
      }
    }
  }

  softDrop() {
    if (this.state !== "playing") return;
    this.softDropping = true;
    this.tryStepDown();
  }

  hardDrop() {
    if (this.state !== "playing") return;
    while (this.tryStepDown()) { /* drop */ }
    this.lockPiece();
  }

  tryStepDown() {
    if (!this.canPlace(this.activeCells, this.pieceX, this.pieceY - 1)) {
      this.softDropping = false;
      return false;
    }
    this.pieceY -= 1;
    this.syncActiveBlocks();
    this.score += 1;
    this.updateHud();
    return true;
  }

  rebuildActiveBlocks() {
    const color = this.activeColor;
    this.clearActiveBlocks();
    for (const [cx, cy] of this.activeCells) {
      const block = new SoftBlock(color, this.scene);
      block.setAnchors(true);
      const w = this.boardToWorld(this.pieceX + cx, this.pieceY - cy);
      block.setOrigin(w.x, w.y, w.z);
      this.activeBlocks.push({ block, ox: cx, oy: cy });
    }
  }

  syncActiveBlocks() {
    for (const { block, ox, oy } of this.activeBlocks) {
      const w = this.boardToWorld(this.pieceX + ox, this.pieceY - oy);
      block.setOrigin(w.x, w.y, w.z);
      for (let i = 0; i < block.particles.length; i++) {
        const p = block.particles[i];
        const a = block.anchors[i];
        if (a) {
          p.x = a.local.x;
          p.y = a.local.y;
          p.z = a.local.z;
          p.vx = p.vy = p.vz = 0;
        }
      }
    }
  }

  dropInterval() {
    return Math.max(0.08, 0.85 - (this.level - 1) * 0.07);
  }

  updateHud() {
    this.scoreEl.textContent = String(this.score);
    this.linesEl.textContent = String(this.lines);
    this.levelEl.textContent = String(this.level);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      this.highScoreEl.textContent = String(this.highScore);
    }
  }

  drawNextPiece() {
    const ctx = this.nextCanvas.getContext("2d");
    const { width, height } = this.nextCanvas;
    ctx.clearRect(0, 0, width, height);
    const cells = this.nextPiece.cells;
    const maxX = Math.max(...cells.map(([x]) => x));
    const maxY = Math.max(...cells.map(([, y]) => y));
    const size = 22;
    const offsetX = (width - (maxX + 1) * size) / 2;
    const offsetY = (height - (maxY + 1) * size) / 2;
    const color = `#${this.nextPiece.color.toString(16).padStart(6, "0")}`;
    for (const [x, y] of cells) {
      const px = offsetX + x * size;
      const py = offsetY + y * size;
      const grad = ctx.createLinearGradient(px, py, px + size, py + size);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "#ffffff33");
      ctx.fillStyle = grad;
      roundRect(ctx, px + 1, py + 1, size - 2, size - 2, 5);
      ctx.fill();
    }
  }

  start() {
    if (this.state === "playing") return;
    this.reset();
    this.state = "playing";
    this.overlay.classList.add("hidden");
  }

  pauseToggle() {
    if (this.state === "playing") {
      this.state = "paused";
      this.overlayTitle.textContent = "Paused";
      this.overlayMessage.textContent = "Press Space or tap Play to resume";
      this.overlay.classList.remove("hidden");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.overlay.classList.add("hidden");
    }
  }

  reset() {
    for (const block of this.blocks) block.dispose(this.scene);
    this.clearActiveBlocks();
    this.blocks = [];
    this.grid.fill(null);
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.nextPiece = randomPiece();
    this.updateHud();
    this.spawnPiece();
  }

  gameOver() {
    this.state = "gameover";
    this.clearActiveBlocks();
    this.overlayTitle.textContent = "Game Over";
    this.overlayMessage.textContent = `Score: ${this.score} · Press Space or tap Play`;
    this.overlay.classList.remove("hidden");
  }

  bindInput() {
    const keyMap = {
      ArrowLeft: () => this.move(-1),
      ArrowRight: () => this.move(1),
      ArrowDown: () => this.softDrop(),
      ArrowUp: () => this.rotate(1),
      KeyA: () => this.move(-1),
      KeyD: () => this.move(1),
      KeyS: () => this.softDrop(),
      KeyW: () => this.rotate(1),
      KeyX: () => this.rotate(1),
      KeyZ: () => this.rotate(-1),
    };

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (this.state === "idle" || this.state === "gameover") this.start();
        else if (this.state === "playing") this.hardDrop();
        else if (this.state === "paused") this.pauseToggle();
        return;
      }
      if (e.code === "KeyP") {
        if (this.state === "playing" || this.state === "paused") this.pauseToggle();
        return;
      }
      if (this.state !== "playing") return;
      const action = keyMap[e.code];
      if (action) {
        e.preventDefault();
        action();
      }
    });

    document.getElementById("play-btn").addEventListener("click", () => {
      if (this.state === "idle" || this.state === "gameover") this.start();
      else if (this.state === "paused") this.pauseToggle();
    });
    document.getElementById("pause-btn").addEventListener("click", () => this.pauseToggle());
    document.getElementById("drop-btn").addEventListener("click", () => {
      if (this.state === "playing") this.hardDrop();
    });

    document.querySelectorAll(".dpad [data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.state !== "playing") return;
        const action = btn.dataset.action;
        if (action === "left") this.move(-1);
        if (action === "right") this.move(1);
        if (action === "down") this.softDrop();
        if (action === "rotate") this.rotate(1);
      });
    });
  }

  resize() {
    const wrapper = this.canvas.parentElement;
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop(now) {
    const dt = Math.min(0.033, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state === "playing") {
      const interval = this.softDropping ? 0.04 : this.dropInterval();
      this.dropTimer += dt;
      if (this.dropTimer >= interval) {
        this.dropTimer = 0;
        if (!this.tryStepDown()) {
          this.lockTimer += interval;
          if (this.lockTimer >= 0.4) {
            this.lockTimer = 0;
            this.lockPiece();
          }
        } else {
          this.lockTimer = 0;
        }
      }
    }

    const gravity = this.state === "playing" ? -14 : -6;
    const allBlocks = [...this.blocks, ...this.activeBlocks.map((b) => b.block)];
    for (const block of allBlocks) {
      block.step(dt, gravity, this.physicsBounds, allBlocks);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.loop(t));
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

new AutoGame();
