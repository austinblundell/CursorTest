# Classic Games

Browser-based classic games built with HTML, CSS, and JavaScript.

## How to Play

Open `index.html` in a browser, or serve the folder locally:

```bash
python3 -m http.server 8080
```

Then visit [http://localhost:8080](http://localhost:8080).

## Games

| Game | Entry point | Description |
|------|-------------|-------------|
| Snake | [snake.html](snake.html) | Eat food, grow, and avoid walls and your tail |
| Minesweeper | [minesweeper.html](minesweeper.html) | Reveal safe cells and flag all mines |

### Snake controls

- Arrow keys or WASD — move
- Space — pause / resume
- Space (after game over) — play again

For mobile, use the self-contained [play.html](play.html) with touch/swipe controls.

### Minesweeper controls

- Left-click — reveal a cell
- Right-click — place or remove a flag
- Double-click a revealed number — chord (reveal neighbors when enough flags are placed)
- Long-press (touch) — flag a cell

#### Difficulty levels

| Level        | Grid   | Mines |
|--------------|--------|-------|
| Beginner     | 9×9    | 10    |
| Intermediate | 16×16  | 40    |
| Expert       | 30×16  | 99    |

The first click is always safe — mines are placed after your opening move.
