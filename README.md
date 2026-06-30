# Classic Games

Browser-based classic games built with HTML, CSS, and JavaScript.

## How to Play

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Use the **Snake** / **Minesweeper** / **Composer 2.5** / **Opus 4.8** buttons at the top of any page to switch games without going back to the home screen.

## Games

| Game | Entry point | Description |
|------|-------------|-------------|
| Snake | [snake.html](snake.html) | Eat food, grow, and avoid walls and your tail |
| Minesweeper | [minesweeper.html](minesweeper.html) | Reveal safe cells and flag all mines |
| Composer 2.5 | [composer25.html](composer25.html) | 3D soft body physics Tetris with squishy jelly blocks |
| Opus 4.8 | [opus48.html](opus48.html) | Soft body physics Tetris with wobbly 3D jelly pieces |

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

### Composer 2.5 controls

**Desktop**

- Arrow keys or WASD — move and rotate pieces
- Enter — hard drop
- Space — start / pause / restart after game over
- Mouse drag — orbit the 3D camera

**Mobile**

- On-screen buttons — move, rotate, drop, pause, and play
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
