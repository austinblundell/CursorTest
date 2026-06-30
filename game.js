const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const FACES = {
  idle: "🙂",
  won: "😎",
  lost: "😵",
  thinking: "😮",
};

const boardEl = document.getElementById("board");
const mineCounterEl = document.getElementById("mine-counter");
const timerEl = document.getElementById("timer");
const resetButton = document.getElementById("reset-button");
const difficultySelect = document.getElementById("difficulty");
const messageEl = document.getElementById("message");

let rows = 9;
let cols = 9;
let mineCount = 10;
let grid = [];
let revealedCount = 0;
let flagCount = 0;
let gameOver = false;
let gameWon = false;
let firstClick = true;
let timerInterval = null;
let elapsedSeconds = 0;
let mouseDownOnBoard = false;

function init() {
  difficultySelect.addEventListener("change", newGame);
  resetButton.addEventListener("click", newGame);
  boardEl.addEventListener("contextmenu", (e) => e.preventDefault());
  boardEl.addEventListener("mousedown", () => {
    if (!gameOver && !gameWon) {
      mouseDownOnBoard = true;
      resetButton.textContent = FACES.thinking;
    }
  });
  document.addEventListener("mouseup", () => {
    if (mouseDownOnBoard && !gameOver && !gameWon) {
      resetButton.textContent = FACES.idle;
    }
    mouseDownOnBoard = false;
  });

  newGame();
}

function newGame() {
  stopTimer();
  const diff = DIFFICULTIES[difficultySelect.value];
  rows = diff.rows;
  cols = diff.cols;
  mineCount = diff.mines;
  grid = [];
  revealedCount = 0;
  flagCount = 0;
  gameOver = false;
  gameWon = false;
  firstClick = true;
  elapsedSeconds = 0;

  resetButton.textContent = FACES.idle;
  updateMineCounter();
  updateTimer();
  setMessage("");

  boardEl.style.gridTemplateColumns = `repeat(${cols}, 28px)`;
  boardEl.innerHTML = "";

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = createCell(r, c);
      grid[r][c] = {
        row: r,
        col: c,
        isMine: false,
        adjacentMines: 0,
        revealed: false,
        flagged: false,
        element: cell,
      };
      boardEl.appendChild(cell);
    }
  }
}

function createCell(row, col) {
  const cell = document.createElement("button");
  cell.className = "cell";
  cell.type = "button";
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-label", `Cell row ${row + 1} column ${col + 1}`);
  cell.dataset.row = row;
  cell.dataset.col = col;

  cell.addEventListener("click", (e) => handleLeftClick(row, col, e));
  cell.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    handleRightClick(row, col);
  });
  cell.addEventListener("dblclick", () => handleChord(row, col));

  let touchTimer = null;
  cell.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchTimer = setTimeout(() => {
      handleRightClick(row, col);
      touchTimer = null;
    }, 400);
  }, { passive: false });
  cell.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
      handleLeftClick(row, col);
    }
  }, { passive: false });
  cell.addEventListener("touchmove", () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
  });

  return cell;
}

function placeMines(safeRow, safeCol) {
  const safeZone = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = safeRow + dr;
      const nc = safeCol + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        safeZone.add(`${nr},${nc}`);
      }
    }
  }

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (safeZone.has(`${r},${c}`) || grid[r][c].isMine) continue;
    grid[r][c].isMine = true;
    placed++;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].isMine) continue;
      grid[r][c].adjacentMines = countAdjacentMines(r, c);
    }
  }
}

function countAdjacentMines(row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc].isMine) {
        count++;
      }
    }
  }
  return count;
}

function handleLeftClick(row, col, e) {
  if (gameOver || gameWon) return;
  const cell = grid[row][col];
  if (cell.flagged || cell.revealed) return;

  if (firstClick) {
    firstClick = false;
    placeMines(row, col);
    startTimer();
  }

  revealCell(row, col);
}

function handleRightClick(row, col) {
  if (gameOver || gameWon || firstClick) return;
  const cell = grid[row][col];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  updateMineCounter();
  renderCell(cell);
}

function handleChord(row, col) {
  if (gameOver || gameWon || firstClick) return;
  const cell = grid[row][col];
  if (!cell.revealed || cell.adjacentMines === 0) return;

  const neighbors = getNeighbors(row, col);
  const flaggedNeighbors = neighbors.filter((n) => n.flagged).length;
  if (flaggedNeighbors !== cell.adjacentMines) return;

  for (const neighbor of neighbors) {
    if (!neighbor.flagged && !neighbor.revealed) {
      revealCell(neighbor.row, neighbor.col);
    }
  }
}

function revealCell(row, col) {
  const cell = grid[row][col];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  revealedCount++;
  renderCell(cell);

  if (cell.isMine) {
    endGame(false);
    return;
  }

  if (cell.adjacentMines === 0) {
    floodReveal(row, col);
  }

  checkWin();
}

function floodReveal(row, col) {
  const queue = [[row, col]];
  const visited = new Set([`${row},${col}`]);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    for (const neighbor of getNeighbors(r, c)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (visited.has(key) || neighbor.revealed || neighbor.flagged) continue;
      visited.add(key);
      neighbor.revealed = true;
      revealedCount++;
      renderCell(neighbor);
      if (neighbor.adjacentMines === 0) {
        queue.push([neighbor.row, neighbor.col]);
      }
    }
  }
}

function getNeighbors(row, col) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push(grid[nr][nc]);
      }
    }
  }
  return neighbors;
}

function renderCell(cell) {
  const el = cell.element;
  el.className = "cell";
  el.textContent = "";

  if (cell.flagged && !cell.revealed) {
    el.classList.add("flagged");
    el.innerHTML = '<span class="flag">🚩</span>';
    el.setAttribute("aria-label", `Flagged cell row ${cell.row + 1} column ${cell.col + 1}`);
    return;
  }

  if (!cell.revealed) return;

  el.classList.add("revealed");

  if (cell.isMine) {
    el.classList.add("mine-hit");
    el.innerHTML = '<span class="mine">💣</span>';
    return;
  }

  if (cell.adjacentMines > 0) {
    el.textContent = cell.adjacentMines;
    el.classList.add(`num-${cell.adjacentMines}`);
  }
}

function checkWin() {
  const totalSafe = rows * cols - mineCount;
  if (revealedCount === totalSafe) {
    endGame(true);
  }
}

function endGame(won) {
  gameOver = !won;
  gameWon = won;
  stopTimer();

  resetButton.textContent = won ? FACES.won : FACES.lost;
  setMessage(won ? "You win! All safe cells revealed." : "Boom! You hit a mine.", won ? "" : "lose");

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      const el = cell.element;

      if (cell.isMine) {
        if (!cell.flagged) {
          cell.revealed = true;
          el.className = "cell revealed";
          el.innerHTML = '<span class="mine">💣</span>';
        }
      } else if (cell.flagged) {
        el.classList.add("mine-wrong");
        el.innerHTML = '<span class="flag">🚩</span>';
      }
    }
  }

  if (won) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.isMine && !cell.flagged) {
          cell.flagged = true;
          renderCell(cell);
        }
      }
    }
    updateMineCounter();
  }
}

function updateMineCounter() {
  const remaining = Math.max(0, mineCount - flagCount);
  mineCounterEl.textContent = String(remaining).padStart(3, "0");
}

function updateTimer() {
  timerEl.textContent = String(Math.min(elapsedSeconds, 999)).padStart(3, "0");
}

function startTimer() {
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    updateTimer();
    if (elapsedSeconds >= 999) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function setMessage(text, extraClass = "") {
  messageEl.textContent = text;
  messageEl.className = "message" + (extraClass ? ` ${extraClass}` : "");
}

init();
