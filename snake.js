const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');

const GRID = 20;
const CELL = canvas.width / GRID;
const TICK_MS = 120;

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyW: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

let snake;
let direction;
let nextDirection;
let food;
let score;
let highScore = Number(localStorage.getItem('snake-high-score') || 0);
let tickId;
let paused = false;
let gameOver = false;

highScoreEl.textContent = highScore;

function initGame() {
  const mid = Math.floor(GRID / 2);
  snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { ...direction };
  score = 0;
  scoreEl.textContent = score;
  paused = false;
  gameOver = false;
  placeFood();
  hideOverlay();
  clearInterval(tickId);
  tickId = setInterval(tick, TICK_MS);
  draw();
}

function placeFood() {
  let spot;
  do {
    spot = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((segment) => segment.x === spot.x && segment.y === spot.y));
  food = spot;
}

function tick() {
  if (paused || gameOver) return;

  direction = nextDirection;
  const head = snake[0];
  const newHead = { x: head.x + direction.x, y: head.y + direction.y };

  if (
    newHead.x < 0 ||
    newHead.x >= GRID ||
    newHead.y < 0 ||
    newHead.y >= GRID ||
    snake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)
  ) {
    endGame();
    return;
  }

  snake.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem('snake-high-score', String(highScore));
    }
    placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function drawCell(x, y, color) {
  const pad = 1;
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
}

function draw() {
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCell(food.x, food.y, '#ff7b72');

  snake.forEach((segment, index) => {
    const shade = index === 0 ? '#7ee787' : '#3fb950';
    drawCell(segment.x, segment.y, shade);
  });
}

function showOverlay(title, message) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function endGame() {
  gameOver = true;
  clearInterval(tickId);
  showOverlay('Game Over', `Score: ${score} · Press Space to play again`);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (paused) {
    showOverlay('Paused', 'Press Space to resume');
  } else {
    hideOverlay();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (gameOver) {
      initGame();
    } else {
      togglePause();
    }
    return;
  }

  const next = DIRECTIONS[event.code];
  if (!next) return;

  event.preventDefault();

  if (gameOver) return;

  const isReverse =
    next.x === -direction.x && next.y === -direction.y;
  if (!isReverse) {
    nextDirection = next;
  }

  if (paused) {
    paused = false;
    hideOverlay();
  }
});

initGame();
