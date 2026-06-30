import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const COLS = 10;
const ROWS = 20;
const CELL = 1;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_D = CELL;

const GRAVITY = -32;
const SUBSTEPS = 6;
const SPRING_ITERS = 4;
const LOCK_VELOCITY = 0.35;
const LOCK_TIME = 0.35;

const TETROMINOES = {
  I: { color: 0x38bdf8, cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  O: { color: 0xfacc15, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { color: 0xa78bfa, cells: [[0, 0], [1, 0], [2, 0], [1, 1]] },
  S: { color: 0x4ade80, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { color: 0xf87171, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { color: 0x60a5fa, cells: [[0, 0], [0, 1], [0, 2], [1, 2]] },
  L: { color: 0xfb923c, cells: [[1, 0], [1, 1], [1, 2], [0, 2]] },
};

const PIECE_TYPES = Object.keys(TETROMINOES);

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const highEl = document.getElementById("high-score");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");
const canvas = document.getElementById("game-canvas");

let score = 0;
let lines = 0;
let level = 1;
let highScore = Number(localStorage.getItem("composer25-high") || 0);
let paused = false;
let gameOver = false;
let dropTimer = 0;
let lockTimer = 0;
let nextType = randomPiece();
let activePiece = null;
let lockedBodies = [];
let grid = createEmptyGrid();

highEl.textContent = highScore;

function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  return PIECE_TYPES[(Math.random() * PIECE_TYPES.length) | 0];
}

function rotateCells(cells, dir) {
  return cells.map(([x, y]) => (dir > 0 ? [-y, x] : [y, -x]));
}

function normalizeCells(cells) {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

class Particle {
  constructor(x, y, z, invMass = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.px = x;
    this.py = y;
    this.pz = z;
    this.invMass = invMass;
  }

  integrate(dt, gravity) {
    if (this.invMass === 0) return;
    const vx = (this.x - this.px) * 0.992;
    const vy = (this.y - this.py) * 0.992;
    const vz = (this.z - this.pz) * 0.992;
    this.px = this.x;
    this.py = this.y;
    this.pz = this.z;
    this.x += vx;
    this.y += vy + gravity * dt * dt;
    this.z += vz;
  }

  setPosition(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.px = x;
    this.py = y;
    this.pz = z;
  }

  translate(dx, dy, dz) {
    this.x += dx;
    this.y += dy;
    this.z += dz;
    this.px += dx;
    this.py += dy;
    this.pz += dz;
  }

  velocitySq() {
    const vx = this.x - this.px;
    const vy = this.y - this.py;
    const vz = this.z - this.pz;
    return vx * vx + vy * vy + vz * vz;
  }
}

class Spring {
  constructor(a, b, rest, stiffness = 0.65) {
    this.a = a;
    this.b = b;
    this.rest = rest;
    this.stiffness = stiffness;
  }

  solve() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    const dz = this.b.z - this.a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
    const diff = ((dist - this.rest) / dist) * this.stiffness;
    const ox = dx * diff;
    const oy = dy * diff;
    const oz = dz * diff;
    const invSum = this.a.invMass + this.b.invMass;
    if (invSum === 0) return;
    const aRatio = this.a.invMass / invSum;
    const bRatio = this.b.invMass / invSum;
    if (this.a.invMass) {
      this.a.x += ox * aRatio;
      this.a.y += oy * aRatio;
      this.a.z += oz * aRatio;
    }
    if (this.b.invMass) {
      this.b.x -= ox * bRatio;
      this.b.y -= oy * bRatio;
      this.b.z -= oz * bRatio;
    }
  }
}

class SoftBodyCube {
  constructor(originX, originY, originZ, color, size = CELL * 0.92) {
    this.color = color;
    this.size = size;
    this.half = size * 0.5;
    this.origin = new THREE.Vector3(originX, originY, originZ);
    this.particles = [];
    this.springs = [];
    this.locked = false;

    const seg = 2;
    const step = size / seg;
    const start = -this.half;

    for (let ix = 0; ix <= seg; ix++) {
      for (let iy = 0; iy <= seg; iy++) {
        for (let iz = 0; iz <= seg; iz++) {
          const fx = ix / seg;
          const fy = iy / seg;
          const fz = iz / seg;
          const edge =
            (ix === 0 || ix === seg ? 1 : 0) +
            (iy === 0 || iy === seg ? 1 : 0) +
            (iz === 0 || iz === seg ? 1 : 0);
          const invMass = edge >= 2 ? 1 : edge === 1 ? 0.75 : 0.55;
          this.particles.push(
            new Particle(
              originX + start + ix * step,
              originY + start + iy * step,
              originZ + start + iz * step,
              invMass
            )
          );
        }
      }
    }

    this.gridSize = seg + 1;
    this.index = (ix, iy, iz) => ix + iy * this.gridSize + iz * this.gridSize * this.gridSize;

    for (let ix = 0; ix <= seg; ix++) {
      for (let iy = 0; iy <= seg; iy++) {
        for (let iz = 0; iz <= seg; iz++) {
          const i = this.index(ix, iy, iz);
          const neighbors = [
            [ix + 1, iy, iz],
            [ix, iy + 1, iz],
            [ix, iy, iz + 1],
            [ix + 1, iy + 1, iz],
            [ix + 1, iy, iz + 1],
            [ix, iy + 1, iz + 1],
            [ix + 1, iy + 1, iz + 1],
          ];
          for (const [nx, ny, nz] of neighbors) {
            if (nx <= seg && ny <= seg && nz <= seg) {
              const j = this.index(nx, ny, nz);
              if (j > i) {
                const pa = this.particles[i];
                const pb = this.particles[j];
                const rest = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
                const diag = nx - ix + ny - iy + nz - iz > 1;
                this.springs.push(new Spring(pa, pb, rest, diag ? 0.35 : 0.7));
              }
            }
          }
        }
      }
    }

    this.mesh = this.createMesh();
  }

  createMesh() {
    const geo = new THREE.BoxGeometry(this.size, this.size, this.size * 0.65, 2, 2, 1);
    this.basePositions = geo.attributes.position.array.slice();
    const mat = new THREE.MeshPhysicalMaterial({
      color: this.color,
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      emissive: this.color,
      emissiveIntensity: 0.08,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  getCenter() {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const p of this.particles) {
      x += p.x;
      y += p.y;
      z += p.z;
    }
    const n = this.particles.length;
    return { x: x / n, y: y / n, z: z / n };
  }

  translate(dx, dy, dz) {
    for (const p of this.particles) p.translate(dx, dy, dz);
    this.origin.x += dx;
    this.origin.y += dy;
    this.origin.z += dz;
  }

  rotateAround(cx, cy, cz, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const p of this.particles) {
      const lx = p.x - cx;
      const ly = p.y - cy;
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      p.setPosition(cx + rx, cy + ry, p.z);
    }
  }

  integrate(dt) {
    for (const p of this.particles) p.integrate(dt, GRAVITY);
  }

  satisfySprings() {
    for (let i = 0; i < SPRING_ITERS; i++) {
      for (const s of this.springs) s.solve();
    }
  }

  pinBottom(y) {
    for (const p of this.particles) {
      if (p.y < y + this.half * 0.6) {
        p.y = Math.max(p.y, y);
        if (p.y <= y + 0.02) {
          p.py = p.y;
          p.invMass = 0;
        }
      }
    }
  }

  collideWalls(minX, maxX, minZ, maxZ) {
    for (const p of this.particles) {
      if (p.x < minX) {
        p.x = minX;
        p.px = minX;
      }
      if (p.x > maxX) {
        p.x = maxX;
        p.px = maxX;
      }
      if (p.z < minZ) {
        p.z = minZ;
        p.pz = minZ;
      }
      if (p.z > maxZ) {
        p.z = maxZ;
        p.pz = maxZ;
      }
    }
  }

  avgVelocitySq() {
    let sum = 0;
    for (const p of this.particles) sum += p.velocitySq();
    return sum / this.particles.length;
  }

  sampleVolume(u, v, w) {
    const seg = 2;
    const x = u * seg;
    const y = v * seg;
    const z = w * seg;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = Math.min(x0 + 1, seg);
    const y1 = Math.min(y0 + 1, seg);
    const z1 = Math.min(z0 + 1, seg);
    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;

    const p = (ix, iy, iz) => this.particles[this.index(ix, iy, iz)];

    const c000 = p(x0, y0, z0);
    const c100 = p(x1, y0, z0);
    const c010 = p(x0, y1, z0);
    const c110 = p(x1, y1, z0);
    const c001 = p(x0, y0, z1);
    const c101 = p(x1, y0, z1);
    const c011 = p(x0, y1, z1);
    const c111 = p(x1, y1, z1);

    const lerp = (a, b, t) => a + (b - a) * t;
    const x00 = lerp(c000.x, c100.x, tx);
    const y00 = lerp(c000.y, c100.y, tx);
    const z00 = lerp(c000.z, c100.z, tx);
    const x10 = lerp(c010.x, c110.x, tx);
    const y10 = lerp(c010.y, c110.y, tx);
    const z10 = lerp(c010.z, c110.z, tx);
    const x01 = lerp(c001.x, c101.x, tx);
    const y01 = lerp(c001.y, c101.y, tx);
    const z01 = lerp(c001.z, c101.z, tx);
    const x11 = lerp(c011.x, c111.x, tx);
    const y11 = lerp(c011.y, c111.y, tx);
    const z11 = lerp(c011.z, c111.z, tx);
    const x0v = lerp(x00, x10, ty);
    const y0v = lerp(y00, y10, ty);
    const z0v = lerp(z00, z10, ty);
    const x1v = lerp(x01, x11, ty);
    const y1v = lerp(y01, y11, ty);
    const z1v = lerp(z01, z11, ty);
    return {
      x: lerp(x0v, x1v, tz),
      y: lerp(y0v, y1v, tz),
      z: lerp(z0v, z1v, tz),
    };
  }

  updateMesh() {
    const pos = this.mesh.geometry.attributes.position;
    const arr = pos.array;
    const base = this.basePositions;
    const depth = this.size * 0.65;

    for (let vi = 0; vi < pos.count; vi++) {
      const bx = base[vi * 3];
      const by = base[vi * 3 + 1];
      const bz = base[vi * 3 + 2];
      const u = bx / this.size + 0.5;
      const v = by / this.size + 0.5;
      const w = bz / depth + 0.5;
      const pt = this.sampleVolume(u, v, w);
      arr[vi * 3] = pt.x;
      arr[vi * 3 + 1] = pt.y;
      arr[vi * 3 + 2] = pt.z;
    }

    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

class Tetromino {
  constructor(type, gridX, gridY) {
    this.type = type;
    this.cells = normalizeCells([...TETROMINOES[type].cells]);
    this.color = TETROMINOES[type].color;
    this.gridX = gridX;
    this.gridY = gridY;
    this.cubes = [];
    this.anchorSprings = [];
    this.buildCubes();
  }

  buildCubes() {
    const boardCenterZ = BOARD_D * 0.5;
    for (const [cx, cy] of this.cells) {
      const wx = (this.gridX + cx + 0.5) * CELL;
      const wy = (this.gridY + cy + 0.5) * CELL;
      const cube = new SoftBodyCube(wx, wy, boardCenterZ, this.color);
      this.cubes.push({ cube, cell: [cx, cy] });
    }
    this.connectAnchors();
  }

  connectAnchors() {
    for (let i = 0; i < this.cubes.length; i++) {
      for (let j = i + 1; j < this.cubes.length; j++) {
        const [ax, ay] = this.cubes[i].cell;
        const [bx, by] = this.cubes[j].cell;
        if (Math.abs(ax - bx) + Math.abs(ay - by) === 1) {
          const ca = this.cubes[i].cube.getCenter();
          const cb = this.cubes[j].cube.getCenter();
          const rest = Math.hypot(cb.x - ca.x, cb.y - ca.y, cb.z - ca.z);
          const pa = this.cubes[i].cube.particles[0];
          const pb = this.cubes[j].cube.particles[0];
          this.anchorSprings.push(new Spring(pa, pb, rest, 0.25));
        }
      }
    }
  }

  getOccupiedCells() {
    return this.cells.map(([cx, cy]) => [this.gridX + cx, this.gridY + cy]);
  }

  canPlaceAt(gx, gy, cells = this.cells) {
    for (const [cx, cy] of cells) {
      const x = gx + cx;
      const y = gy + cy;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
      if (grid[y][x]) return false;
    }
    return true;
  }

  tryMove(dx, dy) {
    if (this.canPlaceAt(this.gridX + dx, this.gridY + dy)) {
      this.gridX += dx;
      this.gridY += dy;
      for (const { cube } of this.cubes) cube.translate(dx * CELL, dy * CELL, 0);
      lockTimer = 0;
      return true;
    }
    return false;
  }

  tryRotate(dir) {
    const rotated = normalizeCells(rotateCells(this.cells, dir));
    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [kx, ky] of kicks) {
      if (this.canPlaceAt(this.gridX + kx, this.gridY + ky, rotated)) {
        const pivotX = (this.gridX + kx + 0.5) * CELL;
        const pivotY = (this.gridY + ky + 0.5) * CELL;
        const angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        for (const { cube } of this.cubes) {
          cube.rotateAround(pivotX, pivotY, cube.origin.z, angle);
        }
        this.gridX += kx;
        this.gridY += ky;
        this.cells = rotated;
        this.reassignCellsToCubes();
        lockTimer = 0;
        return true;
      }
    }
    return false;
  }

  reassignCellsToCubes() {
    const boardCenterZ = BOARD_D * 0.5;
    const unmatched = [...this.cubes];
    this.cubes = [];
    this.anchorSprings = [];
    for (const [cx, cy] of this.cells) {
      const targetX = (this.gridX + cx + 0.5) * CELL;
      const targetY = (this.gridY + cy + 0.5) * CELL;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < unmatched.length; i++) {
        const c = unmatched[i].cube.getCenter();
        const d = (c.x - targetX) ** 2 + (c.y - targetY) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const picked = unmatched.splice(bestIdx, 1)[0];
      picked.cell = [cx, cy];
      const center = picked.cube.getCenter();
      picked.cube.translate(targetX - center.x, targetY - center.y, 0);
      picked.cube.origin.set(targetX, targetY, boardCenterZ);
      this.cubes.push(picked);
    }
    this.connectAnchors();
  }

  hardDrop() {
    while (this.tryMove(0, -1)) {}
    lockTimer = LOCK_TIME;
  }

  integrate(dt) {
    for (const { cube } of this.cubes) cube.integrate(dt);
    for (let i = 0; i < SPRING_ITERS; i++) {
      for (const { cube } of this.cubes) {
        for (const s of cube.springs) s.solve();
      }
      for (const s of this.anchorSprings) s.solve();
    }
  }

  collide(floorY, minX, maxX, minZ, maxZ) {
    for (const { cube } of this.cubes) {
      cube.collideWalls(minX, maxX, minZ, maxZ);
      cube.pinBottom(floorY);
    }
  }

  avgVelocitySq() {
    let sum = 0;
    for (const { cube } of this.cubes) sum += cube.avgVelocitySq();
    return sum / this.cubes.length;
  }

  updateMeshes() {
    for (const { cube } of this.cubes) cube.updateMesh();
  }

  addToScene(scene) {
    for (const { cube } of this.cubes) scene.add(cube.mesh);
  }

  removeFromScene(scene) {
    for (const { cube } of this.cubes) scene.remove(cube.mesh);
  }

  lock() {
    for (const { cube } of this.cubes) cube.locked = true;
    for (const [gx, gy] of this.getOccupiedCells()) {
      grid[gy][gx] = this;
    }
    lockedBodies.push(this);
  }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080810);
scene.fog = new THREE.Fog(0x080810, 18, 42);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(BOARD_W * 0.55, BOARD_H * 0.42, 22);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(BOARD_W * 0.5, BOARD_H * 0.45, BOARD_D * 0.5);
controls.minDistance = 12;
controls.maxDistance = 38;
controls.maxPolarAngle = Math.PI * 0.48;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0x404070, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(8, 18, 14);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
rimLight.position.set(-6, 8, -8);
scene.add(rimLight);
const fillLight = new THREE.PointLight(0xa78bfa, 0.35, 40);
fillLight.position.set(BOARD_W * 0.5, BOARD_H * 0.8, 6);
scene.add(fillLight);

function buildBoardFrame() {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    metalness: 0.4,
    roughness: 0.5,
    emissive: 0x312e81,
    emissiveIntensity: 0.15,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.08,
    roughness: 0.1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.4, 0.25, BOARD_D + 0.4), frameMat);
  floor.position.set(BOARD_W * 0.5, -0.125, BOARD_D * 0.5);
  floor.receiveShadow = true;
  group.add(floor);

  const back = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W + 0.4, BOARD_H + 0.4, 0.15), frameMat);
  back.position.set(BOARD_W * 0.5, BOARD_H * 0.5, -0.075);
  group.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.15, BOARD_H + 0.4, BOARD_D + 0.4), frameMat);
  left.position.set(-0.075, BOARD_H * 0.5, BOARD_D * 0.5);
  group.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.15, BOARD_H + 0.4, BOARD_D + 0.4), frameMat);
  right.position.set(BOARD_W + 0.075, BOARD_H * 0.5, BOARD_D * 0.5);
  group.add(right);

  const glass = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, BOARD_H, BOARD_D), glassMat);
  glass.position.set(BOARD_W * 0.5, BOARD_H * 0.5, BOARD_D * 0.5);
  group.add(glass);

  const gridHelper = new THREE.GridHelper(BOARD_W, COLS, 0x334155, 0x1e293b);
  gridHelper.position.set(BOARD_W * 0.5, 0.01, BOARD_D * 0.5);
  gridHelper.rotation.x = 0;
  group.add(gridHelper);

  return group;
}

scene.add(buildBoardFrame());

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener("resize", resize);
resize();

function spawnPiece() {
  const type = nextType;
  nextType = randomPiece();
  updateNextPreview();
  const startY = ROWS - 2;
  const piece = new Tetromino(type, 3, startY);
  if (!piece.canPlaceAt(piece.gridX, piece.gridY)) {
    endGame();
    return null;
  }
  piece.addToScene(scene);
  activePiece = piece;
  lockTimer = 0;
  return piece;
}

function dropInterval() {
  return Math.max(0.08, 0.85 - (level - 1) * 0.07);
}

function updateHUD() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function showOverlay(title, message, hidden = false) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayEl.classList.toggle("hidden", hidden);
}

function endGame() {
  gameOver = true;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("composer25-high", String(highScore));
    highEl.textContent = highScore;
  }
  showOverlay("Game Over", `Score: ${score} · Press Space to play again`);
}

function clearFullRows() {
  let cleared = 0;
  for (let y = 0; y < ROWS; y++) {
    if (grid[y].every((cell) => cell !== null)) {
      cleared++;
      const removedPieces = new Set();
      for (let x = 0; x < COLS; x++) {
        const occupant = grid[y][x];
        if (occupant && !removedPieces.has(occupant)) {
          removedPieces.add(occupant);
          for (const { cube } of occupant.cubes) {
            scene.remove(cube.mesh);
            cube.mesh.geometry.dispose();
            cube.mesh.material.dispose();
          }
          const idx = lockedBodies.indexOf(occupant);
          if (idx >= 0) lockedBodies.splice(idx, 1);
        }
        grid[y][x] = null;
      }
      for (let yy = y; yy < ROWS - 1; yy++) {
        grid[yy] = grid[yy + 1];
        for (let x = 0; x < COLS; x++) {
          const cell = grid[yy][x];
          if (cell) {
            cell.gridY = yy;
            for (const { cube, cell: c } of cell.cubes) {
              const targetY = (yy + c[1] + 0.5) * CELL;
              const center = cube.getCenter();
              cube.translate(0, targetY - center.y, 0);
            }
          }
        }
      }
      grid[ROWS - 1] = Array(COLS).fill(null);
      y--;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] || 800;
    score += points * level;
    lines += cleared;
    level = 1 + Math.floor(lines / 10);
    updateHUD();
  }
}

function lockActivePiece() {
  if (!activePiece) return;
  activePiece.lock();
  clearFullRows();
  activePiece = null;
  if (!gameOver) spawnPiece();
}

function getStackFloor(gx, gy) {
  for (let y = 0; y < gy; y++) {
    if (grid[y][gx]) return (y + 1) * CELL;
  }
  return 0;
}

function physicsStep(dt) {
  if (!activePiece) return;

  const minX = CELL * 0.08;
  const maxX = BOARD_W - CELL * 0.08;
  const minZ = CELL * 0.08;
  const maxZ = BOARD_D - CELL * 0.08;

  for (let i = 0; i < SUBSTEPS; i++) {
    const subDt = dt / SUBSTEPS;
    activePiece.integrate(subDt);

    for (const [gx, gy] of activePiece.getOccupiedCells()) {
      const floorY = getStackFloor(gx, gy);
      activePiece.collide(floorY, minX, maxX, minZ, maxZ);
    }

    for (const body of lockedBodies) {
      for (const { cube } of body.cubes) {
        for (let s = 0; s < 2; s++) {
          for (const sp of cube.springs) sp.solve();
        }
        cube.pinBottom(0);
        cube.collideWalls(minX, maxX, minZ, maxZ);
      }
    }
  }

  activePiece.updateMeshes();
  for (const body of lockedBodies) {
    for (const { cube } of body.cubes) cube.updateMesh();
  }
}

function updateGame(dt) {
  if (paused || gameOver) return;

  dropTimer += dt;
  if (dropTimer >= dropInterval()) {
    dropTimer = 0;
    if (!activePiece.tryMove(0, -1)) {
      lockTimer += dropInterval();
    } else {
      lockTimer = 0;
    }
  }

  physicsStep(dt);

  if (activePiece) {
    const vel = activePiece.avgVelocitySq();
    const atRest = vel < LOCK_VELOCITY * LOCK_VELOCITY;
    const cantFall = !activePiece.canPlaceAt(activePiece.gridX, activePiece.gridY - 1);

    if (cantFall) {
      lockTimer += dt;
      if (lockTimer >= LOCK_TIME && atRest) {
        lockActivePiece();
      }
    } else if (atRest && lockTimer > 0) {
      lockTimer += dt * 0.5;
    }
  }
}

let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateGame(dt);
  controls.update();
  renderer.render(scene, camera);
}

const previewScene = new THREE.Scene();
previewScene.background = new THREE.Color(0x0a0a14);
const previewCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
previewCamera.position.set(2, 2, 4);
previewCamera.lookAt(1, 1, 0);
const previewRenderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("next-preview"),
  antialias: true,
});
previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
previewScene.add(new THREE.AmbientLight(0xffffff, 0.6));
const previewLight = new THREE.DirectionalLight(0xffffff, 0.9);
previewLight.position.set(2, 4, 3);
previewScene.add(previewLight);

let previewMeshes = [];

function updateNextPreview() {
  for (const m of previewMeshes) {
    previewScene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }
  previewMeshes = [];
  const def = TETROMINOES[nextType];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of def.cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX + 1) * 0.5;
  const cy = (minY + maxY + 1) * 0.5;
  for (const [x, y] of def.cells) {
    const geo = new THREE.BoxGeometry(0.85, 0.85, 0.55);
    const mat = new THREE.MeshPhysicalMaterial({
      color: def.color,
      roughness: 0.35,
      clearcoat: 0.5,
      emissive: def.color,
      emissiveIntensity: 0.12,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x - cx + 1, y - cy + 1, 0);
    previewScene.add(mesh);
    previewMeshes.push(mesh);
  }
  const canvasEl = document.getElementById("next-preview");
  previewRenderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);
  previewRenderer.render(previewScene, previewCamera);
}

function resetGame() {
  if (activePiece) {
    activePiece.removeFromScene(scene);
    activePiece = null;
  }
  for (const body of lockedBodies) {
    for (const { cube } of body.cubes) {
      scene.remove(cube.mesh);
      cube.mesh.geometry.dispose();
      cube.mesh.material.dispose();
    }
  }
  lockedBodies = [];
  grid = createEmptyGrid();
  score = 0;
  lines = 0;
  level = 1;
  gameOver = false;
  paused = false;
  dropTimer = 0;
  lockTimer = 0;
  nextType = randomPiece();
  updateHUD();
  updateNextPreview();
  showOverlay("Composer 2.5", "Soft body jelly blocks — press Space to start", false);
}

function startGame() {
  if (!gameOver && activePiece) return;
  showOverlay("", "", true);
  if (gameOver) resetGame();
  gameOver = false;
  spawnPiece();
}

function togglePause() {
  if (gameOver || !activePiece) return;
  paused = !paused;
  if (paused) {
    showOverlay("Paused", "Press Space to resume");
  } else {
    showOverlay("", "", true);
  }
}

document.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
    e.preventDefault();
  }
  if (e.key === " " && (gameOver || !activePiece)) {
    startGame();
    return;
  }
  if (e.key === " " && !gameOver) {
    togglePause();
    return;
  }
  if (paused || gameOver || !activePiece) return;

  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      activePiece.tryMove(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      activePiece.tryMove(1, 0);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      if (activePiece.tryMove(0, -1)) {
        score += 1;
        updateHUD();
        dropTimer = 0;
      }
      break;
    case "ArrowUp":
    case "w":
    case "W":
      activePiece.tryRotate(1);
      break;
    case "q":
    case "Q":
      activePiece.tryRotate(-1);
      break;
    case "Enter":
      activePiece.hardDrop();
      score += 2;
      updateHUD();
      break;
  }
});

document.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    if (action === "start") {
      startGame();
      return;
    }
    if (paused || gameOver || !activePiece) return;
    switch (action) {
      case "left":
        activePiece.tryMove(-1, 0);
        break;
      case "right":
        activePiece.tryMove(1, 0);
        break;
      case "down":
        activePiece.tryMove(0, -1);
        break;
      case "rotate":
        activePiece.tryRotate(1);
        break;
      case "drop":
        activePiece.hardDrop();
        score += 2;
        updateHUD();
        break;
      case "pause":
        togglePause();
        break;
    }
  });
});

resetGame();
requestAnimationFrame(animate);
