# Classic Games

Browser-based classic games built with HTML, CSS, and JavaScript.

## How to Play

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Use the game buttons at the top of any page to switch games without going back to the home screen.

## Games

| Game | Entry point | Description |
|------|-------------|-------------|
| Snake | [snake.html](snake.html) | Eat food, grow, and avoid walls and your tail |
| Minesweeper | [minesweeper.html](minesweeper.html) | Reveal safe cells and flag all mines |
| Codex | [codex.html](codex.html) | Stack springy 3D tetrominoes and clear full horizontal layers |
| Auto | [auto.html](auto.html) | 3D soft-body physics tetris — squishy pieces, line clears, rising levels |
| GPT 5.5 | [gpt55.html](gpt55.html) | Stack soft-body tetrominoes in a glowing 3D Tetris well |
| Composer 2.5 | [composer25.html](composer25.html) | 3D soft body physics Tetris with squishy jelly blocks |
| Opus 4.8 | [opus48.html](opus48.html) | Soft body physics Tetris with wobbly 3D jelly pieces |
| Sonnet 4.6 | [sonnet46.html](sonnet46.html) | 3D soft-body Tetris — spring-physics blocks squish, wobble and bounce |

### Opus 4.8 controls

Classic Tetris rules drive a logical grid while the falling piece is rendered as
a wobbly mass-spring jelly that sags, bounces and squashes on impact.

**Desktop**

- ← / → or A / D — move left / right
- ↑ / W / E — rotate clockwise · Q / Z — rotate counter-clockwise
- ↓ / S — soft drop (hold)
- Space — hard drop
- P — pause / resume · Enter — start / restart
- Mouse drag — orbit the 3D camera

**Mobile**

- On-screen buttons — move, rotate, soft drop, hard drop, pause, restart
- Drag on the canvas — orbit the camera

### Snake controls

**Desktop**

- Arrow keys or WASD — move
- Space — pause / resume
- Space (after game over) — play again

**Mobile**

- Swipe on the board or use the on-screen D-pad to move
- **Play** — start or restart
- **Pause** — pause / resume

### Minesweeper controls

**Desktop**

- Left-click — reveal a cell
- Right-click — place or remove a flag
- Double-click a revealed number — chord (reveal neighbors when enough flags are placed)

**Mobile**

- Tap — reveal a cell (Reveal mode) or place a flag (Flag mode)
- Long-press — flag a cell while in Reveal mode
- Use the **Reveal** / **Flag** mode buttons below the board to switch tap behavior

#### Difficulty levels

| Level        | Grid   | Mines |
|--------------|--------|-------|
| Beginner     | 9×9    | 10    |
| Intermediate | 16×16  | 40    |
| Expert       | 30×16  | 99    |

The first click is always safe — mines are placed after your opening move.

### Codex controls

- A / D — move active piece on X axis
- W / S — move active piece on Z axis
- Q / E — rotate active piece
- Down Arrow — soft drop
- Space — hard drop
- P — pause / resume
- Enter — restart game

### Auto controls

**Desktop**

- Arrow keys or WASD — move and soft drop
- Up / W / X — rotate clockwise
- Z — rotate counter-clockwise
- Space — hard drop (while playing) or start / restart
- P — pause / resume
- Mouse drag — orbit the 3D camera

**Mobile**

- D-pad — move, rotate, and soft drop
- **Drop** — hard drop the current piece
- **Play** — start or restart
- **Pause** — pause / resume

### GPT 5.5 controls

**Desktop**

- Arrow keys or A/D — move
- Up, W, or X — rotate clockwise
- Z — rotate counter-clockwise
- Down or S — soft drop
- Space — hard drop
- P or Escape — pause / resume
- Enter — start / restart

**Mobile**

- Tap the well — rotate
- Swipe left/right — move
- Swipe down — hard drop
- Use the on-screen buttons for movement, spin, drop, slam, pause, and restart

### Composer 2.5 controls

**Desktop**

- Arrow keys or WASD — move and rotate pieces
- Enter — hard drop
- Space — start / pause / restart after game over
- Mouse drag — orbit the 3D camera

**Mobile**

- On-screen buttons — move, rotate, drop, pause, and play
- Drag on the canvas — orbit the camera

### Sonnet 4.6 controls

**Desktop**

- ← → — move
- ↑ or X — rotate clockwise
- Z — rotate counter-clockwise
- ↓ — soft drop
- Space — hard drop
- C — hold piece
- P — pause / resume
