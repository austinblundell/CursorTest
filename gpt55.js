const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const startButton = document.getElementById("start-button");

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const BOARD_X = 140;
const BOARD_Y = 76;
const DEPTH = 12;
const LOCK_DELAY = 420;
const STORAGE_KEY = "gpt55-soft-body-tetris-best";

const COLORS = {
  I: { base: "#37f7ff", dark: "#0998c8", light: "#b7ffff" },
  J: { base: "#5f7cff", dark: "#3145b9", light: "#c3d0ff" },
  L: { base: "#ffad37", dark: "#bc6814", light: "#ffe1aa" },
  O: { base: "#ffe45c", dark: "#bd9b14", light: "#fff6be" },
  S: { base: "#62ff8f", dark: "#18a54a", light: "#c9ffd7" },
  T: { base: "#c77dff", dark: "#7b30c6", light: "#edd0ff" },
  Z: { base: "#ff5e8a", dark: "#ba244b", light: "#ffc1d0" },
};

const PIECES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
};

const BAG_TYPES = Object.keys(PIECES);
const SCORE_TABLE = [0, 100, 300, 500, 800];

let board;
let active;
let nextType;
let bag;
let particles;
let score;
let lines;
let level;
let best = Number(localStorage.getItem(STORAGE_KEY) || 0);
let dropTimer;
let lockTimer;
let lastTime;
let animationFrameId = null;
let running = false;
let paused = false;
let gameOver = false;
let touchStart = null;

bestEl.textContent = best;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function createSoftBody(gridX, gridY, color, burst = false) {
  return {
    x: gridX,
    y: gridY,
    vx: (Math.random() - 0.5) * (burst ? 2.2 : 0.5),
    vy: burst ? -7 - Math.random() * 4 : 0,
    scaleX: 1,
    scaleY: 1,
    sxv: 0,
    syv: 0,
    angle: 0,
    av: (Math.random() - 0.5) * 0.08,
    wobble: Math.random() * Math.PI * 2,
    color,
  };
}

function randomBag() {
  const types = BAG_TYPES.slice();
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

function takeFromBag() {
  if (!bag || bag.length === 0) bag = randomBag();
  return bag.pop();
}

function makePiece(type) {
  const rotation = 0;
  const x = type === "I" ? 3 : 3;
  const y = -2;
  const color = COLORS[type];
  const cells = PIECES[type][rotation];
  return {
    type,
    rotation,
    x,
    y,
    bodies: cells.map(([dx, dy]) => createSoftBody(x + dx, y + dy, color, true)),
  };
}

function cellsFor(piece, x = piece.x, y = piece.y, rotation = piece.rotation) {
  return PIECES[piece.type][rotation].map(([dx, dy], index) => ({
    x: x + dx,
    y: y + dy,
    body: piece.bodies[index],
  }));
}

function isValid(piece, x = piece.x, y = piece.y, rotation = piece.rotation) {
  return cellsFor(piece, x, y, rotation).every((cell) => {
    if (cell.x < 0 || cell.x >= COLS || cell.y >= ROWS) return false;
    return cell.y < 0 || !board[cell.y][cell.x];
  });
}

function spawnPiece() {
  active = makePiece(nextType || takeFromBag());
  nextType = takeFromBag();
  lockTimer = 0;
  drawNext();

  if (!isValid(active)) {
    endGame();
  }
}

function startGame() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  board = createBoard();
  particles = [];
  bag = randomBag();
  nextType = takeFromBag();
  score = 0;
  lines = 0;
  level = 1;
  dropTimer = 0;
  lockTimer = 0;
  running = true;
  paused = false;
  gameOver = false;
  lastTime = performance.now();
  spawnPiece();
  updateHud();
  hideOverlay();
  animationFrameId = requestAnimationFrame(loop);
}

function updateHud() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
  bestEl.textContent = best;
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function endGame() {
  gameOver = true;
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem(STORAGE_KEY, String(best));
  }
  updateHud();
  showOverlay("Game Over", `Score ${score}. Press Enter or tap Start to reshape the stack.`);
}

function togglePause() {
  if (gameOver) return;
  if (!running) {
    startGame();
    return;
  }
  paused = !paused;
  if (paused) {
    showOverlay("Paused", "Press P, Escape, or tap Pause to keep stacking.");
  } else {
    hideOverlay();
    lastTime = performance.now();
    animationFrameId = requestAnimationFrame(loop);
  }
}

function move(dx, dy) {
  if (!active || paused || gameOver) return false;
  if (!isValid(active, active.x + dx, active.y + dy)) return false;
  active.x += dx;
  active.y += dy;
  if (dx !== 0) stretchActive(1.13, 0.9, dx * 0.32);
  if (dy > 0) stretchActive(0.9, 1.15, 0);
  lockTimer = 0;
  return true;
}

function rotate(direction = 1) {
  if (!active || paused || gameOver) return;
  const nextRotation = (active.rotation + direction + 4) % 4;
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (isValid(active, active.x + kick, active.y, nextRotation)) {
      active.x += kick;
      active.rotation = nextRotation;
      active.bodies.forEach((body, index) => {
        body.av += (index - 1.5) * 0.045 * direction;
        body.sxv += 0.09;
        body.syv -= 0.08;
      });
      lockTimer = 0;
      return;
    }
  }
}

function hardDrop() {
  if (!active || paused || gameOver) return;
  let distance = 0;
  while (move(0, 1)) distance++;
  score += distance * 2;
  stretchActive(0.72, 1.42, 0);
  lockPiece(true);
}

function softDrop() {
  if (move(0, 1)) {
    score += 1;
    updateHud();
  }
}

function stretchActive(scaleX, scaleY, spin) {
  active.bodies.forEach((body) => {
    body.sxv += (scaleX - body.scaleX) * 0.28;
    body.syv += (scaleY - body.scaleY) * 0.28;
    body.av += spin;
  });
}

function lockPiece(slammed = false) {
  const cells = cellsFor(active);
  if (cells.some((cell) => cell.y < 0)) {
    endGame();
    return;
  }

  cells.forEach((cell) => {
    const body = cell.body;
    body.vy += slammed ? 7 : 2.5;
    body.sxv += slammed ? 0.22 : 0.08;
    body.syv -= slammed ? 0.25 : 0.08;
    board[cell.y][cell.x] = {
      type: active.type,
      color: COLORS[active.type],
      body,
      born: performance.now(),
    };
  });
  active = null;

  const cleared = clearLines();
  if (cleared === 0) {
    spawnPiece();
  }
}

function clearLines() {
  const fullRows = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every(Boolean)) fullRows.push(y);
  }

  if (fullRows.length === 0) return 0;

  fullRows.forEach((rowIndex) => {
    for (let x = 0; x < COLS; x++) {
      const cell = board[rowIndex][x];
      if (!cell) continue;
      emitBurst(x, rowIndex, cell.color);
    }
  });

  board = board.filter((row, rowIndex) => !fullRows.includes(rowIndex));
  while (board.length < ROWS) {
    board.unshift(Array(COLS).fill(null));
  }

  score += SCORE_TABLE[fullRows.length] * level;
  lines += fullRows.length;
  level = Math.floor(lines / 10) + 1;
  updateHud();

  forEachBoardCell((cell, x, y) => {
    cell.body.vy += 4 + fullRows.length;
    cell.body.sxv += 0.12;
    cell.body.syv -= 0.1;
    setBodyTarget(cell.body, x, y);
  });

  setTimeout(() => {
    if (!gameOver) spawnPiece();
  }, 90);
  return fullRows.length;
}

function fallInterval() {
  return Math.max(95, 760 - (level - 1) * 58);
}

function step(delta) {
  if (!running || paused || gameOver) return;

  dropTimer += delta;
  if (dropTimer >= fallInterval()) {
    dropTimer = 0;
    if (!move(0, 1)) {
      lockTimer += fallInterval();
    }
  }

  if (active && isValid(active, active.x, active.y + 1)) {
    lockTimer = 0;
  } else if (active) {
    lockTimer += delta;
    if (lockTimer >= LOCK_DELAY) lockPiece(false);
  }
}

function setBodyTarget(body, gridX, gridY) {
  const stiffness = 0.18;
  body.vx += (gridX - body.x) * stiffness;
  body.vy += (gridY - body.y) * stiffness;
}

function updateSoftBody(body, targetX, targetY, delta) {
  const frameScale = Math.min(2.2, delta / 16.67);
  body.vx += (targetX - body.x) * 0.19 * frameScale;
  body.vy += (targetY - body.y) * 0.19 * frameScale;
  body.vx *= Math.pow(0.72, frameScale);
  body.vy *= Math.pow(0.72, frameScale);
  body.x += body.vx * frameScale;
  body.y += body.vy * frameScale;

  body.sxv += (1 - body.scaleX) * 0.18 * frameScale;
  body.syv += (1 - body.scaleY) * 0.18 * frameScale;
  body.sxv *= Math.pow(0.68, frameScale);
  body.syv *= Math.pow(0.68, frameScale);
  body.scaleX = clamp(body.scaleX + body.sxv * frameScale, 0.62, 1.42);
  body.scaleY = clamp(body.scaleY + body.syv * frameScale, 0.62, 1.42);

  body.angle += body.av * frameScale;
  body.av *= Math.pow(0.82, frameScale);
  body.wobble += 0.045 * frameScale;
}

function updateBodies(delta) {
  forEachBoardCell((cell, x, y) => updateSoftBody(cell.body, x, y, delta));
  if (active) {
    cellsFor(active).forEach((cell) => {
      updateSoftBody(cell.body, cell.x, cell.y, delta);
    });
  }
  updateParticles(delta);
}

function forEachBoardCell(callback) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) callback(board[y][x], x, y);
    }
  }
}

function emitBurst(gridX, gridY, color) {
  const origin = gridToScreen(gridX + 0.5, gridY + 0.5);
  for (let i = 0; i < 9; i++) {
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 7 - 1,
      life: 460 + Math.random() * 260,
      maxLife: 720,
      radius: 2 + Math.random() * 4,
      color: color.light,
    });
  }
}

function updateParticles(delta) {
  particles = particles.filter((particle) => {
    particle.life -= delta;
    particle.vy += 0.18 * (delta / 16.67);
    particle.x += particle.vx * (delta / 16.67);
    particle.y += particle.vy * (delta / 16.67);
    return particle.life > 0;
  });
}

function loop(now) {
  if (!running || paused) {
    animationFrameId = null;
    return;
  }
  const delta = Math.min(48, now - lastTime);
  lastTime = now;
  step(delta);
  updateBodies(delta);
  draw();
  animationFrameId = requestAnimationFrame(loop);
}

function gridToScreen(gridX, gridY) {
  const lean = (gridY - ROWS / 2) * 1.65;
  return {
    x: BOARD_X + gridX * CELL + lean,
    y: BOARD_Y + gridY * CELL,
  };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawWell();

  const drawables = [];
  forEachBoardCell((cell) => drawables.push({ body: cell.body, color: cell.color, y: cell.body.y }));
  if (active) {
    cellsFor(active).forEach((cell) => {
      drawables.push({ body: cell.body, color: COLORS[active.type], y: cell.body.y, active: true });
    });
    drawGhost();
  }

  drawables
    .sort((a, b) => a.y - b.y)
    .forEach((item) => drawGelCube(item.body, item.color, item.active));

  drawParticles();
  drawVignette();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#07182b");
  gradient.addColorStop(0.55, "#080d1d");
  gradient.addColorStop(1, "#170a22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#5ef6ff";
  ctx.lineWidth = 1;
  for (let i = -canvas.height; i < canvas.width; i += 34) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + canvas.height, canvas.height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWell() {
  const topLeft = gridToScreen(0, 0);
  const topRight = gridToScreen(COLS, 0);
  const bottomLeft = gridToScreen(0, ROWS);
  const bottomRight = gridToScreen(COLS, ROWS);

  ctx.save();
  ctx.fillStyle = "rgba(3, 8, 18, 0.76)";
  ctx.strokeStyle = "rgba(97, 245, 255, 0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    const start = gridToScreen(x, 0);
    const end = gridToScreen(x, ROWS);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    const start = gridToScreen(0, y);
    const end = gridToScreen(COLS, y);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  drawWall(bottomLeft, topLeft, -DEPTH * 1.25);
  drawWall(topRight, bottomRight, DEPTH * 1.25);
  ctx.restore();
}

function drawWall(a, b, offset) {
  ctx.fillStyle = "rgba(73, 209, 255, 0.08)";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x + offset, b.y - DEPTH);
  ctx.lineTo(a.x + offset, a.y - DEPTH);
  ctx.closePath();
  ctx.fill();
}

function drawGhost() {
  if (!active) return;
  let ghostY = active.y;
  while (isValid(active, active.x, ghostY + 1, active.rotation)) ghostY++;

  ctx.save();
  ctx.globalAlpha = 0.18;
  cellsFor(active, active.x, ghostY, active.rotation).forEach((cell) => {
    const pos = gridToScreen(cell.x, cell.y);
    ctx.strokeStyle = COLORS[active.type].light;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x + 2, pos.y + 2, CELL - 4, CELL - 4);
  });
  ctx.restore();
}

function drawGelCube(body, color, isActive = false) {
  if (body.y < -2.8) return;

  const pos = gridToScreen(body.x, body.y);
  const wobble = Math.sin(body.wobble) * 0.045;
  const width = CELL * body.scaleX * (1 + wobble);
  const height = CELL * body.scaleY * (1 - wobble);
  const x = pos.x + (CELL - width) / 2;
  const y = pos.y + (CELL - height) / 2;
  const depth = DEPTH + Math.sin(body.wobble * 0.7) * 2;

  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(body.angle * 0.08);
  ctx.translate(-width / 2, -height / 2);

  ctx.shadowColor = color.base;
  ctx.shadowBlur = isActive ? 18 : 9;
  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  roundedRect(3, height + depth * 0.35, width, 7, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  drawFace([
    [depth, -depth],
    [width + depth, -depth],
    [width, 0],
    [0, 0],
  ], color.light, 0.82);

  drawFace([
    [width, 0],
    [width + depth, -depth],
    [width + depth, height - depth],
    [width, height],
  ], color.dark, 0.88);

  const faceGradient = ctx.createLinearGradient(0, 0, width, height);
  faceGradient.addColorStop(0, color.light);
  faceGradient.addColorStop(0.45, color.base);
  faceGradient.addColorStop(1, color.dark);
  ctx.fillStyle = faceGradient;
  roundedRect(0, 0, width, height, 7);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
  ctx.lineWidth = 1.5;
  roundedRect(1.5, 1.5, width - 3, height - 3, 6);
  ctx.stroke();

  const shine = ctx.createRadialGradient(width * 0.32, height * 0.25, 1, width * 0.32, height * 0.25, width * 0.75);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.42)");
  shine.addColorStop(0.38, "rgba(255, 255, 255, 0.12)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shine;
  roundedRect(3, 3, width - 6, height - 6, 6);
  ctx.fill();

  ctx.restore();
}

function drawFace(points, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawParticles() {
  ctx.save();
  particles.forEach((particle) => {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.42, 180, canvas.width / 2, canvas.height / 2, 470);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.48)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "rgba(2, 8, 18, 0.74)";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const cells = PIECES[nextType][0];
  const color = COLORS[nextType];
  const minX = Math.min(...cells.map(([x]) => x));
  const maxX = Math.max(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const maxY = Math.max(...cells.map(([, y]) => y));
  const size = 26;
  const offsetX = (nextCanvas.width - (maxX - minX + 1) * size) / 2;
  const offsetY = (nextCanvas.height - (maxY - minY + 1) * size) / 2;

  cells.forEach(([x, y]) => {
    const px = offsetX + (x - minX) * size;
    const py = offsetY + (y - minY) * size;
    nextCtx.fillStyle = color.base;
    nextCtx.fillRect(px, py, size - 3, size - 3);
    nextCtx.fillStyle = "rgba(255, 255, 255, 0.34)";
    nextCtx.fillRect(px + 3, py + 3, size - 10, 5);
    nextCtx.fillStyle = color.dark;
    nextCtx.fillRect(px + size - 8, py + 4, 5, size - 9);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.addEventListener("keydown", (event) => {
  const code = event.code;
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"].includes(code)) {
    event.preventDefault();
  }

  if (code === "Enter") {
    startGame();
  } else if (code === "ArrowLeft" || code === "KeyA") {
    move(-1, 0);
  } else if (code === "ArrowRight" || code === "KeyD") {
    move(1, 0);
  } else if (code === "ArrowDown" || code === "KeyS") {
    softDrop();
  } else if (code === "ArrowUp" || code === "KeyW" || code === "KeyX") {
    rotate(1);
  } else if (code === "KeyZ") {
    rotate(-1);
  } else if (code === "Space") {
    hardDrop();
  } else if (code === "KeyP" || code === "Escape") {
    togglePause();
  }
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (!running && action !== "pause") startGame();
    if (action === "left") move(-1, 0);
    if (action === "right") move(1, 0);
    if (action === "rotate") rotate(1);
    if (action === "softDrop") softDrop();
    if (action === "hardDrop") hardDrop();
    if (action === "pause") togglePause();
  });
});

startButton.addEventListener("click", startGame);

canvas.addEventListener("touchstart", (event) => {
  touchStart = event.changedTouches[0];
}, { passive: true });

canvas.addEventListener("touchend", (event) => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.clientX;
  const dy = touch.clientY - touchStart.clientY;
  touchStart = null;

  if (!running) startGame();
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
    rotate(1);
    return;
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? 1 : -1, 0);
  } else if (dy > 0) {
    hardDrop();
  } else {
    rotate(1);
  }
}, { passive: true });

board = createBoard();
particles = [];
bag = randomBag();
nextType = takeFromBag();
drawNext();
draw();
