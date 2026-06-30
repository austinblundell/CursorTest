import * as THREE from "https://unpkg.com/three@0.166.1/build/three.module.js";

const BOARD_WIDTH = 8;
const BOARD_DEPTH = 8;
const BOARD_HEIGHT = 18;
const CELL_SIZE = 1;

const PIECES = {
  I: {
    color: 0x51d9ff,
    cells: [
      [-2, 0, 0],
      [-1, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
    ],
  },
  O: {
    color: 0xffd45f,
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
  },
  T: {
    color: 0xbb7cff,
    cells: [
      [-1, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
  },
  L: {
    color: 0xff9f5f,
    cells: [
      [-1, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
    ],
  },
  J: {
    color: 0x7da0ff,
    cells: [
      [-1, 0, 0],
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 1],
    ],
  },
  S: {
    color: 0x7ef89f,
    cells: [
      [-1, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
    ],
  },
  Z: {
    color: 0xff6c98,
    cells: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 0, 1],
      [-1, 0, 1],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);
const SCORE_PER_CLEAR = [0, 120, 340, 560, 900];

const stageEl = document.getElementById("stage");
const overlayEl = document.getElementById("overlay");
const overlayTitleEl = document.getElementById("overlay-title");
const overlayMessageEl = document.getElementById("overlay-message");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const nextPieceEl = document.getElementById("next-piece");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x091126);
scene.fog = new THREE.Fog(0x091126, 16, 42);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(12, 16, 14);
camera.lookAt(0, 8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stageEl.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0x83a7ff, 0x071020, 1.15);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(8, 15, 11);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x5e86ff, 0.45);
fillLight.position.set(-9, 7, -8);
scene.add(fillLight);

const boardGroup = new THREE.Group();
scene.add(boardGroup);

const halfW = (BOARD_WIDTH * CELL_SIZE) / 2;
const halfD = (BOARD_DEPTH * CELL_SIZE) / 2;

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_WIDTH + 1.4, BOARD_DEPTH + 1.4),
  new THREE.MeshPhongMaterial({
    color: 0x10213f,
    shininess: 42,
    transparent: true,
    opacity: 0.88,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.5, 0);
boardGroup.add(floor);

const bounds = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH)),
  new THREE.LineBasicMaterial({ color: 0x4f79ba }),
);
bounds.position.y = BOARD_HEIGHT / 2 - 0.5;
boardGroup.add(bounds);

const baseGrid = new THREE.GridHelper(BOARD_WIDTH + 1.2, BOARD_WIDTH, 0x35598e, 0x1b3155);
baseGrid.position.y = -0.48;
baseGrid.material.opacity = 0.46;
baseGrid.material.transparent = true;
boardGroup.add(baseGrid);

const blockGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9, CELL_SIZE * 0.9);

const boardCells = new Map();
const settledBlocks = [];

let activePiece = null;
let nextPieceType = randomPieceType();
let score = 0;
let clearedLines = 0;
let level = 1;
let paused = false;
let gameOver = false;
let dropAccumulator = 0;
let simTime = 0;

const clock = new THREE.Clock();

function randomPieceType() {
  return PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
}

function boardKey(x, y, z) {
  return `${x},${y},${z}`;
}

function worldFromGrid(vec) {
  return new THREE.Vector3(
    (vec.x + 0.5) * CELL_SIZE - halfW,
    (vec.y + 0.5) * CELL_SIZE,
    (vec.z + 0.5) * CELL_SIZE - halfD,
  );
}

function createBlockVisual(color, alpha = 1) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.15),
    roughness: 0.4,
    metalness: 0.18,
    transparent: alpha < 1,
    opacity: alpha,
  });

  const mesh = new THREE.Mesh(blockGeometry, material);
  scene.add(mesh);

  return {
    mesh,
    grid: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    squash: 1,
  };
}

function impulseBlock(block, power = 1) {
  block.vel.x += (Math.random() - 0.5) * 2.2 * power;
  block.vel.y += (Math.random() * 1.6 + 0.35) * power;
  block.vel.z += (Math.random() - 0.5) * 2.2 * power;
  block.squash = Math.max(0.78, block.squash - 0.1 * power);
}

function updateBlockPhysics(block, dt) {
  const target = worldFromGrid(block.grid);
  const springStrength = 34;
  const drag = 0.16;
  const pull = target.sub(block.pos).multiplyScalar(springStrength * dt);
  block.vel.add(pull);
  block.vel.multiplyScalar(Math.pow(drag, dt));
  block.pos.addScaledVector(block.vel, dt);

  const speed = block.vel.length();
  const targetSquash = THREE.MathUtils.clamp(1 - speed * 0.015, 0.82, 1.08);
  block.squash += (targetSquash - block.squash) * Math.min(1, dt * 11);

  block.mesh.position.copy(block.pos);
  const side = 1 / Math.sqrt(block.squash);
  block.mesh.scale.set(side, block.squash, side);
}

function makeOverlay(title, message, show = true) {
  overlayTitleEl.textContent = title;
  overlayMessageEl.textContent = message;
  overlayEl.classList.toggle("hidden", !show);
}

function updateHud() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(clearedLines);
  levelEl.textContent = String(level);
  nextPieceEl.textContent = nextPieceType;
}

function getDropInterval() {
  return Math.max(0.11, 0.84 - (level - 1) * 0.07);
}

function cloneCells(cells) {
  return cells.map(([x, y, z]) => ({ x, y, z }));
}

function getPieceWorldCells(origin, cells) {
  return cells.map((cell) => ({
    x: origin.x + cell.x,
    y: origin.y + cell.y,
    z: origin.z + cell.z,
  }));
}

function canPlace(origin, cells) {
  const worldCells = getPieceWorldCells(origin, cells);
  for (const c of worldCells) {
    if (c.x < 0 || c.x >= BOARD_WIDTH || c.z < 0 || c.z >= BOARD_DEPTH || c.y < 0) {
      return false;
    }
    if (c.y < BOARD_HEIGHT && boardCells.has(boardKey(c.x, c.y, c.z))) {
      return false;
    }
  }
  return true;
}

function rotateY(cells, direction) {
  return cells.map((c) => (
    direction > 0
      ? { x: -c.z, y: c.y, z: c.x }
      : { x: c.z, y: c.y, z: -c.x }
  ));
}

function syncActiveVisuals() {
  if (!activePiece) {
    return;
  }

  const worldCells = getPieceWorldCells(activePiece.origin, activePiece.cells);
  worldCells.forEach((cell, index) => {
    const block = activePiece.blocks[index];
    block.grid.set(cell.x, cell.y, cell.z);
  });
}

function spawnPiece() {
  const type = nextPieceType;
  nextPieceType = randomPieceType();

  const pieceDef = PIECES[type];
  const origin = { x: Math.floor(BOARD_WIDTH / 2), y: BOARD_HEIGHT + 1, z: Math.floor(BOARD_DEPTH / 2) };
  const cells = cloneCells(pieceDef.cells);

  if (!canPlace(origin, cells)) {
    gameOver = true;
    makeOverlay("Game Over", "Press Enter to restart");
    return;
  }

  activePiece = {
    type,
    color: pieceDef.color,
    origin,
    cells,
    blocks: cells.map(() => createBlockVisual(pieceDef.color, 0.92)),
  };

  activePiece.blocks.forEach((block) => {
    block.mesh.material.emissiveIntensity = 1.1;
    block.mesh.castShadow = false;
  });

  syncActiveVisuals();
  updateHud();
}

function removeActivePieceVisuals() {
  if (!activePiece) {
    return;
  }
  activePiece.blocks.forEach((block) => {
    scene.remove(block.mesh);
    block.mesh.material.dispose();
  });
  activePiece = null;
}

function movePiece(dx, dy, dz) {
  if (!activePiece || gameOver || paused) {
    return false;
  }

  const candidate = {
    x: activePiece.origin.x + dx,
    y: activePiece.origin.y + dy,
    z: activePiece.origin.z + dz,
  };

  if (!canPlace(candidate, activePiece.cells)) {
    return false;
  }

  activePiece.origin = candidate;
  activePiece.blocks.forEach((block) => impulseBlock(block, 0.22));
  syncActiveVisuals();
  return true;
}

function rotatePiece(direction) {
  if (!activePiece || gameOver || paused) {
    return false;
  }

  const rotated = rotateY(activePiece.cells, direction);
  const kicks = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 },
    { x: 1, z: 1 },
    { x: -1, z: -1 },
  ];

  for (const kick of kicks) {
    const candidate = {
      x: activePiece.origin.x + kick.x,
      y: activePiece.origin.y,
      z: activePiece.origin.z + kick.z,
    };
    if (canPlace(candidate, rotated)) {
      activePiece.origin = candidate;
      activePiece.cells = rotated;
      activePiece.blocks.forEach((block) => impulseBlock(block, 0.36));
      syncActiveVisuals();
      return true;
    }
  }

  return false;
}

function settlePiece() {
  if (!activePiece) {
    return;
  }

  const worldCells = getPieceWorldCells(activePiece.origin, activePiece.cells);
  const lockAboveTop = worldCells.some((c) => c.y >= BOARD_HEIGHT);

  worldCells.forEach((cell, index) => {
    const block = activePiece.blocks[index];
    block.grid.set(cell.x, cell.y, cell.z);
    block.mesh.material.opacity = 1;
    block.mesh.material.transparent = false;
    block.mesh.material.emissiveIntensity = 0.68;
    impulseBlock(block, 0.52);
    settledBlocks.push(block);
    if (cell.y < BOARD_HEIGHT) {
      boardCells.set(boardKey(cell.x, cell.y, cell.z), block);
    }
  });

  activePiece = null;

  if (lockAboveTop) {
    gameOver = true;
    makeOverlay("Game Over", "Stack reached the top. Press Enter");
    return;
  }

  const removed = clearFilledLayers();
  if (removed > 0) {
    clearedLines += removed;
    level = 1 + Math.floor(clearedLines / 10);
    score += SCORE_PER_CLEAR[removed] * level;
  } else {
    score += 12;
  }
  updateHud();
  spawnPiece();
}

function clearFilledLayers() {
  const fullLayers = [];
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    let count = 0;
    for (let x = 0; x < BOARD_WIDTH; x++) {
      for (let z = 0; z < BOARD_DEPTH; z++) {
        if (boardCells.has(boardKey(x, y, z))) {
          count++;
        }
      }
    }
    if (count === BOARD_WIDTH * BOARD_DEPTH) {
      fullLayers.push(y);
    }
  }

  if (fullLayers.length === 0) {
    return 0;
  }

  const removedSet = new Set(fullLayers);
  const survivors = [];

  for (const block of settledBlocks.splice(0, settledBlocks.length)) {
    const y = block.grid.y;
    if (removedSet.has(y)) {
      scene.remove(block.mesh);
      block.mesh.material.dispose();
      continue;
    }
    let drop = 0;
    for (const layer of fullLayers) {
      if (layer < y) {
        drop++;
      }
    }
    block.grid.y -= drop;
    impulseBlock(block, 0.95);
    survivors.push(block);
  }

  settledBlocks.push(...survivors);
  boardCells.clear();
  for (const block of settledBlocks) {
    boardCells.set(boardKey(block.grid.x, block.grid.y, block.grid.z), block);
  }

  return fullLayers.length;
}

function hardDrop() {
  if (!activePiece || gameOver || paused) {
    return;
  }
  let dropped = 0;
  while (movePiece(0, -1, 0)) {
    dropped++;
  }
  score += dropped * 2;
  updateHud();
  settlePiece();
}

function stepGameDown() {
  if (!activePiece || gameOver || paused) {
    return;
  }
  if (!movePiece(0, -1, 0)) {
    settlePiece();
  }
}

function resetGame() {
  for (const block of settledBlocks) {
    scene.remove(block.mesh);
    block.mesh.material.dispose();
  }
  settledBlocks.length = 0;
  boardCells.clear();
  removeActivePieceVisuals();

  score = 0;
  clearedLines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropAccumulator = 0;
  nextPieceType = randomPieceType();

  makeOverlay("Codex", "Soft-body 3D Tetris. Press any move key to play", false);
  updateHud();
  spawnPiece();
}

function togglePause() {
  if (gameOver) {
    return;
  }
  paused = !paused;
  if (paused) {
    makeOverlay("Paused", "Press P to resume");
  } else {
    makeOverlay("", "", false);
  }
}

function handleKeydown(event) {
  const code = event.code;
  const handled = [
    "KeyA",
    "KeyD",
    "KeyW",
    "KeyS",
    "KeyQ",
    "KeyE",
    "ArrowDown",
    "Space",
    "KeyP",
    "Enter",
  ].includes(code);

  if (handled) {
    event.preventDefault();
  }

  if (code === "Enter") {
    resetGame();
    return;
  }

  if (code === "KeyP") {
    togglePause();
    return;
  }

  if (paused || gameOver || !activePiece) {
    return;
  }

  if (code === "KeyA") movePiece(-1, 0, 0);
  if (code === "KeyD") movePiece(1, 0, 0);
  if (code === "KeyW") movePiece(0, 0, -1);
  if (code === "KeyS") movePiece(0, 0, 1);
  if (code === "KeyQ") rotatePiece(-1);
  if (code === "KeyE") rotatePiece(1);
  if (code === "ArrowDown") {
    if (movePiece(0, -1, 0)) {
      score += 1;
      updateHud();
    }
  }
  if (code === "Space") hardDrop();
}

function resizeRenderer() {
  const width = stageEl.clientWidth;
  const height = stageEl.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  simTime += dt;

  if (!paused && !gameOver && activePiece) {
    dropAccumulator += dt;
    const interval = getDropInterval();
    while (dropAccumulator >= interval) {
      stepGameDown();
      dropAccumulator -= interval;
    }
  }

  if (activePiece) {
    syncActiveVisuals();
    activePiece.blocks.forEach((block) => updateBlockPhysics(block, dt));
  }

  settledBlocks.forEach((block) => updateBlockPhysics(block, dt));

  camera.position.x = Math.sin(simTime * 0.18) * 2 + 12;
  camera.position.z = Math.cos(simTime * 0.18) * 2 + 14;
  camera.lookAt(0, BOARD_HEIGHT * 0.35, 0);

  renderer.render(scene, camera);
}

window.addEventListener("resize", resizeRenderer);
window.addEventListener("keydown", handleKeydown);

resizeRenderer();
resetGame();
animate();
