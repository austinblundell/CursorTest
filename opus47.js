// Opus 4.7 — Soft Body Tetris
// 3D Tetris where every tetromino cube is a mass-spring jelly that squishes,
// wobbles and bounces using Verlet + PBD-style distance constraints.

import * as THREE from 'three';

// ---------- Tunables ----------
const GRID_W = 10;
const GRID_H = 20;
const GRID_TOP_BUFFER = 4; // hidden rows above the visible field

const SPAWN_GRID_X = 3;
const SPAWN_GRID_Y = GRID_H - 3;

const PHYS_SUBSTEPS = 3;
const CONSTRAINT_ITER = 4;

// PBD distance-constraint stiffness (per iteration).
const EDGE_STIFF = 0.55;
const DIAG_STIFF = 0.35;

// "Anchor" — how strongly each particle is pulled toward its target rest position.
const ANCHOR_ACTIVE = 0.18;
const ANCHOR_SETTLED = 0.32;

// Pseudo-gravity expressed as a per-substep velocity nudge (units / s^2).
const GRAVITY = 12;

// Velocity damping factor per substep (lower = more wobble bleed-off).
const DAMPING = 0.92;

// Floor / wall coordinates (the play field is x in [0, GRID_W], y in [0, GRID_H+top]).
const FLOOR_Y = 0;

// Gameplay timing.
const LOCK_DELAY_SEC = 0.45;
const BASE_FALL_SPEED = 1.3; // cells / second at level 1
const SOFT_DROP_SPEED = 14;
const HARD_DROP_VELOCITY = 22;
const BURST_DURATION = 0.85;
const SPAWN_GAP_SEC = 0.18;

const SCORE_TABLE = [0, 100, 300, 500, 800];

// ---------- Tetromino definitions ----------
// Each rotation is a list of cell [x, y] offsets inside a bounding box where
// y grows upward, matching the world we render in.
const TETROMINOES = {
  I: {
    color: 0x39e0ff,
    states: [
      [[0,2],[1,2],[2,2],[3,2]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,1],[1,1],[2,1],[3,1]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
  },
  O: {
    color: 0xffe440,
    states: [
      [[1,1],[2,1],[1,2],[2,2]],
      [[1,1],[2,1],[1,2],[2,2]],
      [[1,1],[2,1],[1,2],[2,2]],
      [[1,1],[2,1],[1,2],[2,2]],
    ],
  },
  T: {
    color: 0xb24fff,
    states: [
      [[1,2],[0,1],[1,1],[2,1]],
      [[1,2],[1,1],[2,1],[1,0]],
      [[0,1],[1,1],[2,1],[1,0]],
      [[1,2],[0,1],[1,1],[1,0]],
    ],
  },
  S: {
    color: 0x5be0a5,
    states: [
      [[1,2],[2,2],[0,1],[1,1]],
      [[1,2],[1,1],[2,1],[2,0]],
      [[1,1],[2,1],[0,0],[1,0]],
      [[0,2],[0,1],[1,1],[1,0]],
    ],
  },
  Z: {
    color: 0xff5f6a,
    states: [
      [[0,2],[1,2],[1,1],[2,1]],
      [[2,2],[1,1],[2,1],[1,0]],
      [[0,1],[1,1],[1,0],[2,0]],
      [[1,2],[0,1],[1,1],[0,0]],
    ],
  },
  J: {
    color: 0x4682ff,
    states: [
      [[0,2],[0,1],[1,1],[2,1]],
      [[1,2],[2,2],[1,1],[1,0]],
      [[0,1],[1,1],[2,1],[2,0]],
      [[1,2],[1,1],[0,0],[1,0]],
    ],
  },
  L: {
    color: 0xff9b3a,
    states: [
      [[2,2],[0,1],[1,1],[2,1]],
      [[1,2],[1,1],[1,0],[2,0]],
      [[0,1],[1,1],[2,1],[0,0]],
      [[0,2],[1,2],[1,1],[1,0]],
    ],
  },
};

const PIECE_TYPES = Object.keys(TETROMINOES);

// ---------- Soft-body primitives ----------
class Particle {
  constructor(x, y, z) {
    this.pos = new THREE.Vector3(x, y, z);
    this.prev = new THREE.Vector3(x, y, z);
    this.target = new THREE.Vector3(x, y, z);
    // unit-cube local offset (each axis in {0,1})
    this.lx = 0; this.ly = 0; this.lz = 0;
  }
}

class DistanceConstraint {
  constructor(a, b, rest, stiffness) {
    this.a = a;
    this.b = b;
    this.rest = rest;
    this.stiffness = stiffness;
  }
}

// Material library reused for all pieces of a given type — reduces draw cost.
const MATERIAL_CACHE = new Map();
function getMaterial(colorHex) {
  if (MATERIAL_CACHE.has(colorHex)) return MATERIAL_CACHE.get(colorHex);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.32,
    metalness: 0.08,
    flatShading: true,
    emissive: colorHex,
    emissiveIntensity: 0.18,
  });
  MATERIAL_CACHE.set(colorHex, mat);
  return mat;
}

// SoftCube: a 1×1×1 jelly cube. 8 particles, distance constraints across edges,
// faces and body diagonals. Renders a flat-shaded mesh whose geometry is
// re-driven by the particle positions each frame.
class SoftCube {
  constructor(x, y, z, colorHex) {
    this.particles = [];
    for (let dz = 0; dz <= 1; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const p = new Particle(x + dx, y + dy, z + dz);
          p.lx = dx; p.ly = dy; p.lz = dz;
          this.particles.push(p);
        }
      }
    }

    this.constraints = [];
    this._buildConstraints();

    this.color = colorHex;
    this.bursting = false;
    this.burstTimer = 0;
    this.burstVel = new THREE.Vector3();
    this.gridX = 0;
    this.gridY = 0;
    this.removed = false;

    this._buildMesh();
  }

  _cornerIndex(dx, dy, dz) {
    return dz * 4 + dy * 2 + dx;
  }

  _buildConstraints() {
    const ps = this.particles;
    const ci = (dx, dy, dz) => this._cornerIndex(dx, dy, dz);
    const add = (i, j, rest, stiffness) => {
      this.constraints.push(new DistanceConstraint(ps[i], ps[j], rest, stiffness));
    };

    // 12 edges (length 1).
    for (let dz = 0; dz <= 1; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        add(ci(0, dy, dz), ci(1, dy, dz), 1, EDGE_STIFF);
      }
    }
    for (let dz = 0; dz <= 1; dz++) {
      for (let dx = 0; dx <= 1; dx++) {
        add(ci(dx, 0, dz), ci(dx, 1, dz), 1, EDGE_STIFF);
      }
    }
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        add(ci(dx, dy, 0), ci(dx, dy, 1), 1, EDGE_STIFF);
      }
    }

    // 12 face diagonals (length sqrt(2)).
    const s2 = Math.SQRT2;
    // -z and +z faces.
    add(ci(0,0,0), ci(1,1,0), s2, DIAG_STIFF); add(ci(1,0,0), ci(0,1,0), s2, DIAG_STIFF);
    add(ci(0,0,1), ci(1,1,1), s2, DIAG_STIFF); add(ci(1,0,1), ci(0,1,1), s2, DIAG_STIFF);
    // -y and +y faces.
    add(ci(0,0,0), ci(1,0,1), s2, DIAG_STIFF); add(ci(1,0,0), ci(0,0,1), s2, DIAG_STIFF);
    add(ci(0,1,0), ci(1,1,1), s2, DIAG_STIFF); add(ci(1,1,0), ci(0,1,1), s2, DIAG_STIFF);
    // -x and +x faces.
    add(ci(0,0,0), ci(0,1,1), s2, DIAG_STIFF); add(ci(0,1,0), ci(0,0,1), s2, DIAG_STIFF);
    add(ci(1,0,0), ci(1,1,1), s2, DIAG_STIFF); add(ci(1,1,0), ci(1,0,1), s2, DIAG_STIFF);

    // 4 body diagonals (length sqrt(3)).
    const s3 = Math.sqrt(3);
    add(ci(0,0,0), ci(1,1,1), s3, DIAG_STIFF);
    add(ci(1,0,0), ci(0,1,1), s3, DIAG_STIFF);
    add(ci(0,1,0), ci(1,0,1), s3, DIAG_STIFF);
    add(ci(1,1,0), ci(0,0,1), s3, DIAG_STIFF);
  }

  _buildMesh() {
    const ci = (dx, dy, dz) => this._cornerIndex(dx, dy, dz);
    // CCW order looking from outside, so vertex normals come out facing
    // outward when computeVertexNormals runs.
    const faces = [
      [ci(0,0,0), ci(1,0,0), ci(1,1,0), ci(0,1,0)], // -z
      [ci(1,0,1), ci(0,0,1), ci(0,1,1), ci(1,1,1)], // +z
      [ci(0,0,0), ci(0,0,1), ci(1,0,1), ci(1,0,0)], // -y
      [ci(0,1,0), ci(1,1,0), ci(1,1,1), ci(0,1,1)], // +y
      [ci(0,0,0), ci(0,1,0), ci(0,1,1), ci(0,0,1)], // -x
      [ci(1,0,0), ci(1,0,1), ci(1,1,1), ci(1,1,0)], // +x
    ];

    const positions = new Float32Array(24 * 3);
    const indices = new Uint16Array(36);
    this._vertexToParticle = new Int16Array(24);

    let idx = 0;
    for (let f = 0; f < 6; f++) {
      const base = f * 4;
      for (let i = 0; i < 4; i++) this._vertexToParticle[base + i] = faces[f][i];
      indices[idx++] = base;
      indices[idx++] = base + 1;
      indices[idx++] = base + 2;
      indices[idx++] = base;
      indices[idx++] = base + 2;
      indices[idx++] = base + 3;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.material = getMaterial(this.color);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.updateGeometry();
  }

  updateGeometry() {
    const positions = this.geometry.attributes.position.array;
    for (let i = 0; i < 24; i++) {
      const p = this.particles[this._vertexToParticle[i]];
      positions[i * 3 + 0] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  setTarget(x, y, z = 0) {
    for (const p of this.particles) {
      p.target.set(x + p.lx, y + p.ly, z + p.lz);
    }
  }

  // Add a velocity impulse to every particle. Verlet velocity is
  // (pos - prev), so to inject (vx, vy, vz) we subtract it from prev.
  applyImpulse(vx, vy, vz) {
    for (const p of this.particles) {
      p.prev.x -= vx;
      p.prev.y -= vy;
      p.prev.z -= vz;
    }
  }

  step(dt, gravity, anchorAlpha) {
    const damp = DAMPING;
    const g = gravity * dt * dt;
    // Verlet integrate with anchor pull.
    for (const p of this.particles) {
      const vx = (p.pos.x - p.prev.x) * damp;
      const vy = (p.pos.y - p.prev.y) * damp;
      const vz = (p.pos.z - p.prev.z) * damp;
      p.prev.copy(p.pos);
      p.pos.x += vx + (p.target.x - p.pos.x) * anchorAlpha;
      p.pos.y += vy - g + (p.target.y - p.pos.y) * anchorAlpha;
      p.pos.z += vz + (p.target.z - p.pos.z) * anchorAlpha;
    }

    // Iterate PBD distance constraints.
    for (let iter = 0; iter < CONSTRAINT_ITER; iter++) {
      for (const c of this.constraints) {
        const a = c.a, b = c.b;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const dz = b.pos.z - a.pos.z;
        const len2 = dx * dx + dy * dy + dz * dz;
        if (len2 < 1e-9) continue;
        const len = Math.sqrt(len2);
        const corr = ((len - c.rest) / len) * 0.5 * c.stiffness;
        a.pos.x += dx * corr; a.pos.y += dy * corr; a.pos.z += dz * corr;
        b.pos.x -= dx * corr; b.pos.y -= dy * corr; b.pos.z -= dz * corr;
      }
    }

    // Boundary collisions: floor & side walls. Z is unconstrained — the playfield
    // is one cell deep, but settled wobble can briefly push particles in z.
    for (const p of this.particles) {
      if (p.pos.y < FLOOR_Y) p.pos.y = FLOOR_Y;
      if (p.pos.x < 0) p.pos.x = 0;
      if (p.pos.x > GRID_W) p.pos.x = GRID_W;
    }
  }
}

// ---------- Piece (a Tetris tetromino) ----------
class Piece {
  constructor(type) {
    const def = TETROMINOES[type];
    this.type = type;
    this.color = def.color;
    this.def = def;
    this.rotation = 0;
    this.gridX = SPAWN_GRID_X;
    this.gridY = SPAWN_GRID_Y;
    this.subY = 0; // sub-cell vertical drift in (-1, 0]
    this.lockTimer = 0;
    this.settled = false;

    this.cubes = [];
    const cells = def.states[0];
    for (const [cx, cy] of cells) {
      const cube = new SoftCube(this.gridX + cx, this.gridY + cy, 0, this.color);
      this.cubes.push(cube);
    }
    this._syncTargets();
  }

  _syncTargets() {
    const cells = this.def.states[this.rotation];
    for (let i = 0; i < this.cubes.length; i++) {
      const [cx, cy] = cells[i];
      this.cubes[i].setTarget(this.gridX + cx, this.gridY + cy + this.subY, 0);
    }
  }

  setLogicalPosition(gx, gy, rot, subY = 0) {
    this.gridX = gx;
    this.gridY = gy;
    this.rotation = ((rot % 4) + 4) % 4;
    this.subY = subY;
    this._syncTargets();
  }

  occupiedCells(gx = this.gridX, gy = this.gridY, rot = this.rotation) {
    const out = [];
    const cells = this.def.states[((rot % 4) + 4) % 4];
    for (const [cx, cy] of cells) out.push([gx + cx, gy + cy]);
    return out;
  }
}

// ---------- Game state ----------
class Game {
  constructor(scene) {
    this.scene = scene;
    this.reset();
  }

  reset() {
    if (this.currentPiece) {
      for (const c of this.currentPiece.cubes) this.scene.remove(c.mesh);
    }
    if (this.settledCubes) {
      for (const c of this.settledCubes) this.scene.remove(c.mesh);
    }
    if (this.burstingCubes) {
      for (const c of this.burstingCubes) {
        this.scene.remove(c.mesh);
        if (c.material && c.material.dispose) c.material.dispose();
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
      }
    }
    // grid[x][y] -> cube or null. y can go up to GRID_H + GRID_TOP_BUFFER.
    this.grid = [];
    for (let x = 0; x < GRID_W; x++) {
      this.grid[x] = new Array(GRID_H + GRID_TOP_BUFFER).fill(null);
    }
    this.settledCubes = [];
    this.burstingCubes = [];
    this.currentPiece = null;
    this.nextType = this._randomType();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.respawnTimer = 0;
    this.softDrop = false;
    this.hardDropPending = false;
    this._spawnPiece();
  }

  _randomType() {
    return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
  }

  _spawnPiece() {
    const type = this.nextType;
    this.nextType = this._randomType();
    const piece = new Piece(type);
    if (this._collides(piece, piece.gridX, piece.gridY, piece.rotation)) {
      // Spawn already overlaps the pile -> game over.
      this.gameOver = true;
      return;
    }
    this.currentPiece = piece;
    for (const cube of piece.cubes) this.scene.add(cube.mesh);
  }

  _collides(piece, gx, gy, rot) {
    const cells = piece.def.states[((rot % 4) + 4) % 4];
    for (const [cx, cy] of cells) {
      const x = gx + cx;
      const y = gy + cy;
      if (x < 0 || x >= GRID_W || y < 0) return true;
      if (y >= this.grid[0].length) return true;
      if (this.grid[x][y]) return true;
    }
    return false;
  }

  tryMove(dx, dy, dr) {
    if (!this.currentPiece || this.gameOver || this.paused) return false;
    const p = this.currentPiece;
    const nx = p.gridX + dx;
    const ny = p.gridY + dy;
    const nr = ((p.rotation + dr) % 4 + 4) % 4;
    if (!this._collides(p, nx, ny, nr)) {
      p.setLogicalPosition(nx, ny, nr, p.subY);
      p.lockTimer = 0;
      return true;
    }
    return false;
  }

  hardDrop() {
    if (!this.currentPiece || this.gameOver || this.paused) return;
    const p = this.currentPiece;
    let drop = 0;
    while (!this._collides(p, p.gridX, p.gridY - 1, p.rotation)) {
      p.gridY -= 1;
      drop += 1;
    }
    p.subY = 0;
    p._syncTargets();
    if (drop > 0) {
      // Teleport particles to just above their new resting position and
      // give them a strong downward velocity. The strong settled anchor
      // (after lock) yanks them to the floor with a satisfying squish.
      const dropHeight = 0.55;
      const v = HARD_DROP_VELOCITY / 60;
      const cells = p.def.states[p.rotation];
      for (let i = 0; i < p.cubes.length; i++) {
        const cube = p.cubes[i];
        const [cx, cy] = cells[i];
        const tx = p.gridX + cx;
        const ty = p.gridY + cy;
        for (const pt of cube.particles) {
          pt.pos.set(tx + pt.lx, ty + pt.ly + dropHeight, pt.lz);
          pt.prev.set(tx + pt.lx, ty + pt.ly + dropHeight + v, pt.lz);
        }
        cube.updateGeometry();
      }
    }
    this.score += drop * 2;
    p.lockTimer = LOCK_DELAY_SEC; // force lock next step
    this.hardDropPending = true;
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  _lockPiece() {
    const p = this.currentPiece;
    if (!p) return;
    const cells = p.def.states[p.rotation];
    for (let i = 0; i < cells.length; i++) {
      const [cx, cy] = cells[i];
      const x = p.gridX + cx;
      const y = p.gridY + cy;
      const cube = p.cubes[i];
      cube.gridX = x;
      cube.gridY = y;
      // Snap target to integer cell so the settled wobble unwinds toward it.
      cube.setTarget(x, y, 0);
      this.grid[x][y] = cube;
      this.settledCubes.push(cube);
    }
    this.currentPiece = null;
    this._clearLines();
    if (!this.gameOver) {
      this.respawnTimer = SPAWN_GAP_SEC;
    }
  }

  _clearLines() {
    const fullRows = [];
    for (let y = 0; y < GRID_H + GRID_TOP_BUFFER; y++) {
      let full = true;
      for (let x = 0; x < GRID_W; x++) {
        if (!this.grid[x][y]) { full = false; break; }
      }
      if (full) fullRows.push(y);
    }
    if (fullRows.length === 0) {
      // Still shake nearby settled blocks for impact feel.
      this._impactShake();
      return;
    }
    const fullSet = new Set(fullRows);

    // Burst all cubes living on cleared rows.
    for (const y of fullRows) {
      for (let x = 0; x < GRID_W; x++) {
        const cube = this.grid[x][y];
        if (!cube) continue;
        this.grid[x][y] = null;
        cube.bursting = true;
        cube.burstTimer = BURST_DURATION;
        cube.burstVel.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 6 + 4,
          (Math.random() - 0.5) * 3
        );
        // Strip particles of any anchor by retargeting to their current pos.
        for (const pt of cube.particles) pt.target.copy(pt.pos);
        // Kick prev backwards so initial velocity is the burst velocity.
        for (const pt of cube.particles) {
          pt.prev.x = pt.pos.x - cube.burstVel.x / 60;
          pt.prev.y = pt.pos.y - cube.burstVel.y / 60;
          pt.prev.z = pt.pos.z - cube.burstVel.z / 60;
        }
        this.burstingCubes.push(cube);
      }
    }

    // Compact remaining cubes downward column by column.
    for (let x = 0; x < GRID_W; x++) {
      let writeY = 0;
      for (let y = 0; y < this.grid[x].length; y++) {
        const cube = this.grid[x][y];
        if (cube && !fullSet.has(y)) {
          if (writeY !== y) {
            this.grid[x][writeY] = cube;
            this.grid[x][y] = null;
            cube.gridY = writeY;
            cube.setTarget(x, writeY, 0);
          }
          writeY++;
        }
      }
    }

    // Settled cubes that were marked bursting are no longer "settled".
    this.settledCubes = this.settledCubes.filter((c) => !c.bursting);

    const n = fullRows.length;
    this.score += (SCORE_TABLE[n] || 800) * this.level;
    this.lines += n;
    const newLevel = 1 + Math.floor(this.lines / 10);
    if (newLevel !== this.level) this.level = newLevel;
    this._impactShake(1.5 + n * 0.6);
  }

  _impactShake(strength = 0.6) {
    // Wobble all settled cubes slightly to convey impact reverberation.
    const dyKick = strength / 60;
    for (const cube of this.settledCubes) {
      for (const pt of cube.particles) {
        pt.prev.y += dyKick * (0.5 + Math.random() * 0.5);
      }
    }
  }

  fallSpeed() {
    const base = BASE_FALL_SPEED + (this.level - 1) * 0.45;
    return this.softDrop ? Math.max(SOFT_DROP_SPEED, base) : base;
  }

  step(dt) {
    if (this.gameOver || this.paused) return;

    if (this.currentPiece) {
      const p = this.currentPiece;
      const speed = this.fallSpeed();
      p.subY -= speed * dt;

      while (p.subY <= -1) {
        if (!this._collides(p, p.gridX, p.gridY - 1, p.rotation)) {
          p.gridY -= 1;
          p.subY += 1;
          if (this.softDrop) this.score += 1;
        } else {
          p.subY = 0;
          break;
        }
      }
      p._syncTargets();

      // Lock-in delay when piece is grounded.
      if (this._collides(p, p.gridX, p.gridY - 1, p.rotation)) {
        p.lockTimer += dt;
        if (p.lockTimer >= LOCK_DELAY_SEC) {
          this._lockPiece();
          this.hardDropPending = false;
        }
      } else {
        p.lockTimer = 0;
      }
    } else if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && !this.gameOver) {
        this._spawnPiece();
      }
    }

    // Substep the soft-body simulation.
    const sub = dt / PHYS_SUBSTEPS;
    for (let s = 0; s < PHYS_SUBSTEPS; s++) {
      if (this.currentPiece) {
        for (const cube of this.currentPiece.cubes) {
          cube.step(sub, GRAVITY * 0.4, ANCHOR_ACTIVE);
        }
      }
      for (const cube of this.settledCubes) {
        if (cube.removed) continue;
        cube.step(sub, GRAVITY * 0.08, ANCHOR_SETTLED);
      }
      for (const cube of this.burstingCubes) {
        if (cube.removed) continue;
        cube.step(sub, GRAVITY, 0);
      }
    }

    // Update rendered geometries.
    if (this.currentPiece) {
      for (const cube of this.currentPiece.cubes) cube.updateGeometry();
    }
    for (const cube of this.settledCubes) cube.updateGeometry();
    for (const cube of this.burstingCubes) {
      cube.burstTimer -= dt;
      const t = Math.max(0, cube.burstTimer / BURST_DURATION);
      if (cube.material === getMaterial(cube.color)) {
        // Clone the material so per-cube fade doesn't affect other cubes.
        cube.material = cube.material.clone();
        cube.mesh.material = cube.material;
      }
      cube.material.opacity = t;
      cube.material.transparent = true;
      cube.material.emissiveIntensity = 0.18 + (1 - t) * 0.6;
      cube.updateGeometry();
      if (cube.burstTimer <= 0) {
        cube.removed = true;
        this.scene.remove(cube.mesh);
        cube.geometry.dispose();
        cube.material.dispose();
      }
    }
    this.burstingCubes = this.burstingCubes.filter((c) => !c.removed);
  }
}

// ---------- Renderer setup ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0x110f22, 25, 60);

// Camera framed on the playfield.
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const camTarget = new THREE.Vector3(GRID_W / 2, GRID_H / 2 - 1, 0.5);
function placeCamera() {
  camera.position.set(GRID_W / 2 + 0.4, GRID_H / 2 + 2, 26);
  camera.lookAt(camTarget);
}
placeCamera();

// Lights.
const ambient = new THREE.AmbientLight(0xa9b4ff, 0.45);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
keyLight.position.set(8, 30, 14);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 30;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x8a7bff, 0.45);
rimLight.position.set(-6, 8, -10);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x5be0a5, 0.45, 40);
fillLight.position.set(GRID_W / 2, 2, 6);
scene.add(fillLight);

// Floor.
const floorGeo = new THREE.PlaneGeometry(60, 60);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x1a1830,
  roughness: 0.95,
  metalness: 0.0,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(GRID_W / 2, 0, 0.5);
floor.receiveShadow = true;
scene.add(floor);

// Subtle backdrop wall behind the playfield.
const backWallGeo = new THREE.PlaneGeometry(40, 40);
const backWallMat = new THREE.MeshStandardMaterial({
  color: 0x141328,
  roughness: 1.0,
  metalness: 0.0,
  transparent: true,
  opacity: 0.85,
});
const backWall = new THREE.Mesh(backWallGeo, backWallMat);
backWall.position.set(GRID_W / 2, GRID_H / 2, -1.2);
backWall.receiveShadow = true;
scene.add(backWall);

// Playfield frame.
const frameGroup = new THREE.Group();
const frameMat = new THREE.MeshStandardMaterial({
  color: 0x6f7bff,
  emissive: 0x2e3380,
  emissiveIntensity: 0.7,
  roughness: 0.4,
  metalness: 0.3,
});
const frameThickness = 0.15;
function addFrame(x, y, z, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(g, frameMat);
  m.position.set(x, y, z);
  frameGroup.add(m);
}
// Left & right vertical rails.
addFrame(-frameThickness / 2, GRID_H / 2, 0.5, frameThickness, GRID_H, 1.2);
addFrame(GRID_W + frameThickness / 2, GRID_H / 2, 0.5, frameThickness, GRID_H, 1.2);
// Bottom rail.
addFrame(GRID_W / 2, -frameThickness / 2, 0.5, GRID_W + frameThickness * 2, frameThickness, 1.2);
// Top guard (above visible field).
const topGuardMat = new THREE.MeshStandardMaterial({
  color: 0x6f7bff,
  emissive: 0x2e3380,
  emissiveIntensity: 0.25,
  roughness: 0.4,
  metalness: 0.3,
  transparent: true,
  opacity: 0.35,
});
const topGuard = new THREE.Mesh(
  new THREE.BoxGeometry(GRID_W + frameThickness * 2, frameThickness, 1.2),
  topGuardMat
);
topGuard.position.set(GRID_W / 2, GRID_H + frameThickness / 2, 0.5);
frameGroup.add(topGuard);
scene.add(frameGroup);

// Faint horizontal grid lines for sight reference.
const gridLines = new THREE.Group();
const lineMat = new THREE.LineBasicMaterial({
  color: 0x3a3a66,
  transparent: true,
  opacity: 0.35,
});
for (let y = 1; y < GRID_H; y++) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, y, -0.05),
    new THREE.Vector3(GRID_W, y, -0.05),
  ]);
  gridLines.add(new THREE.Line(geo, lineMat));
}
for (let x = 1; x < GRID_W; x++) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, 0, -0.05),
    new THREE.Vector3(x, GRID_H, -0.05),
  ]);
  gridLines.add(new THREE.Line(geo, lineMat));
}
scene.add(gridLines);

// ---------- HUD wiring ----------
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');
const overlayButton = document.getElementById('overlay-button');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

function renderNextPiece(type) {
  const ctx = nextCtx;
  const dpr = window.devicePixelRatio || 1;
  const cssW = nextCanvas.clientWidth || nextCanvas.width;
  const cssH = nextCanvas.clientHeight || nextCanvas.height;
  if (nextCanvas.width !== Math.round(cssW * dpr)) {
    nextCanvas.width = Math.round(cssW * dpr);
    nextCanvas.height = Math.round(cssH * dpr);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  ctx.scale(dpr, dpr);
  if (!type) return;
  const def = TETROMINOES[type];
  const cells = def.states[0];
  let minX = 9, maxX = -1, minY = 9, maxY = -1;
  for (const [x, y] of cells) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const padding = 8;
  const size = Math.min(
    (cssW - padding * 2) / w,
    (cssH - padding * 2) / h
  );
  const offsetX = (cssW - size * w) / 2;
  const offsetY = (cssH - size * h) / 2;
  const color = '#' + def.color.toString(16).padStart(6, '0');
  for (const [x, y] of cells) {
    const px = offsetX + (x - minX) * size;
    // Flip y for canvas (canvas y grows down, game y grows up).
    const py = offsetY + (maxY - y) * size;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px + 1, py + 1, size - 2, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px + 1, py + size - 4, size - 2, 3);
  }
}

function updateHud(game) {
  scoreEl.textContent = String(game.score);
  linesEl.textContent = String(game.lines);
  levelEl.textContent = String(game.level);
  renderNextPiece(game.nextType);
}

function showOverlay(title, message, buttonLabel) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonLabel;
  overlayEl.classList.remove('hidden');
}
function hideOverlay() {
  overlayEl.classList.add('hidden');
}

// ---------- Game instance + input ----------
const game = new Game(scene);
updateHud(game);

const input = {
  left: false,
  right: false,
  softDrop: false,
  moveCooldown: 0,
  initialDelay: 0.16,
  repeatRate: 0.055,
};

function tryRotate(dir) {
  if (!game.currentPiece) return;
  if (game.tryMove(0, 0, dir)) return;
  // Simple wall-kicks: try ±1 horizontal, then ±2 (for the I-piece).
  const kicks = [1, -1, 2, -2];
  for (const dx of kicks) {
    if (game.tryMove(dx, 0, dir)) return;
  }
  // Last resort: kick up.
  if (game.tryMove(0, 1, dir)) return;
}

window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  switch (ev.code) {
    case 'ArrowLeft':
    case 'KeyA':
      input.left = true;
      input.right = false;
      game.tryMove(-1, 0, 0);
      input.moveCooldown = input.initialDelay;
      ev.preventDefault();
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = true;
      input.left = false;
      game.tryMove(1, 0, 0);
      input.moveCooldown = input.initialDelay;
      ev.preventDefault();
      break;
    case 'ArrowUp':
    case 'KeyW':
    case 'KeyX':
      tryRotate(1);
      ev.preventDefault();
      break;
    case 'KeyZ':
      tryRotate(-1);
      ev.preventDefault();
      break;
    case 'ArrowDown':
    case 'KeyS':
      input.softDrop = true;
      game.softDrop = true;
      ev.preventDefault();
      break;
    case 'Space':
      game.hardDrop();
      ev.preventDefault();
      break;
    case 'KeyP':
    case 'Escape':
      game.togglePause();
      if (game.paused) showOverlay('Paused', 'Press P to resume.', 'Resume');
      else hideOverlay();
      ev.preventDefault();
      break;
    case 'KeyR':
      restart();
      ev.preventDefault();
      break;
  }
});

window.addEventListener('keyup', (ev) => {
  switch (ev.code) {
    case 'ArrowLeft':
    case 'KeyA':
      input.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      input.right = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      input.softDrop = false;
      game.softDrop = false;
      break;
  }
});

overlayButton.addEventListener('click', () => {
  if (game.gameOver) restart();
  else {
    game.paused = false;
    hideOverlay();
  }
});

function restart() {
  game.reset();
  hideOverlay();
  updateHud(game);
}

// Mobile controls.
const mobileToolbar = document.querySelector('.opus-mobile');
if (mobileToolbar) {
  mobileToolbar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    switch (action) {
      case 'left': game.tryMove(-1, 0, 0); break;
      case 'right': game.tryMove(1, 0, 0); break;
      case 'rotate': tryRotate(1); break;
      case 'soft':
        game.softDrop = true;
        clearTimeout(window.__opusSoftDropTimer);
        window.__opusSoftDropTimer = setTimeout(() => { game.softDrop = false; }, 220);
        break;
      case 'hard': game.hardDrop(); break;
      case 'pause':
        game.togglePause();
        if (game.paused) showOverlay('Paused', 'Tap Resume to keep playing.', 'Resume');
        else hideOverlay();
        break;
      case 'restart': restart(); break;
    }
  });
}

// ---------- Resize ----------
function resize() {
  const stage = document.querySelector('.opus-stage');
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Frame the playfield to fit the viewport.
  const vAspect = w / h;
  const padding = 1.6;
  const targetWorldH = GRID_H + padding * 2;
  const targetWorldW = GRID_W + padding * 2;
  const distForHeight = (targetWorldH / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);
  const distForWidth = (targetWorldW / 2) / (Math.tan((camera.fov * Math.PI / 180) / 2) * vAspect);
  const dist = Math.max(distForHeight, distForWidth);
  camera.position.set(GRID_W / 2 + 0.6, GRID_H / 2, dist);
  camera.lookAt(GRID_W / 2, GRID_H / 2 - 0.5, 0.5);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- Main loop ----------
let lastT = performance.now();
let lastHudPiece = null;
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  // Auto-repeat horizontal movement (simple DAS / ARR — initial delay then
  // a faster repeat rate as long as the key is held).
  if (game.currentPiece && !game.paused && !game.gameOver) {
    const dir = input.left ? -1 : input.right ? 1 : 0;
    if (dir !== 0) {
      input.moveCooldown -= dt;
      let safety = 8;
      while (input.moveCooldown <= 0 && safety-- > 0) {
        game.tryMove(dir, 0, 0);
        input.moveCooldown += input.repeatRate;
      }
    } else {
      input.moveCooldown = 0;
    }
  } else {
    input.moveCooldown = 0;
  }

  game.step(dt);

  // HUD updates.
  if (lastHudPiece !== game.nextType) {
    lastHudPiece = game.nextType;
  }
  updateHud(game);

  if (game.gameOver && overlayEl.classList.contains('hidden')) {
    showOverlay('Game Over', `Final score: ${game.score}`, 'Play again');
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
