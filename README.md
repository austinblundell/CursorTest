# Classic Games

Browser-based classic games built with HTML, CSS, and JavaScript.

## How to Play

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

Use the **Snake** / **Minesweeper** / **Opus 4.7** buttons at the top of any page to switch games without going back to the home screen.

## Games

| Game | Entry point | Description |
|------|-------------|-------------|
| Snake | [snake.html](snake.html) | Eat food, grow, and avoid walls and your tail |
| Minesweeper | [minesweeper.html](minesweeper.html) | Reveal safe cells and flag all mines |
| Opus 4.7 | [opus47.html](opus47.html) | 3D Tetris where every piece is a wobbling soft-body jelly |

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

### Opus 4.7 controls

Opus 4.7 is a 3D take on Tetris where every tetromino cube is a mass-spring jelly that
squishes, wobbles and bounces on impact. The simulation uses Verlet integration with
PBD-style distance constraints; rendering is done with Three.js (loaded from a CDN).

**Desktop**

- `←` `→` or `A` `D` — move the falling piece
- `↑`, `W`, or `X` — rotate clockwise
- `Z` — rotate counter-clockwise
- `↓` or `S` — soft drop (faster fall while held)
- `Space` — hard drop (instant slam with a juicy squish)
- `P` or `Esc` — pause / resume
- `R` — restart

**Mobile**

- Use the on-screen pad to move and rotate
- **Hard Drop** slams the piece down with a bounce
- **Pause** and **Restart** are available in the toolbar

Clearing one, two, three or four rows scores 100, 300, 500 or 800 points (multiplied
by the current level). Every ten cleared lines bumps the level and the falling speed.
