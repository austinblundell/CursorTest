# Three.js Rubik's Cube

An interactive 3D Rubik's Cube built with [Three.js](https://threejs.org/). Orbit
around a fully colored 3x3 cube, turn any face with smooth animations, scramble
it, and reset it back to a solved state.

## Features

- Real 3x3 Rubik's Cube rendered with Three.js (`MeshStandardMaterial` + lighting)
- Smooth, queued quarter-turn animations with ease-in/out
- All six faces, clockwise and counter-clockwise (prime) turns
- One-click **Scramble** (25 random moves) and **Reset**
- Orbit / zoom camera controls (drag to rotate, scroll to zoom)
- Keyboard shortcuts: `U D L R F B` to turn faces, hold **Shift** for prime turns

## Running

No build step or dependencies to install — everything is loaded from a CDN via an
import map. Because ES modules require an HTTP origin, serve the folder with any
static server:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000> in your browser.

## How it works

Each of the 27 cubies is a `BoxGeometry` mesh whose six faces are colored only
where they sit on the outer surface of the cube. To turn a face, the cubies in
that slice are temporarily re-parented to a `pivot` group, the pivot is rotated
90°, and then the cubies are baked back into the main group with their positions
snapped to the grid. This keeps the cube state stable across any number of moves.

## Files

- `index.html` — markup, control buttons, and the Three.js import map
- `style.css` — UI styling and layout
- `main.js` — scene setup, cube construction, and the move engine
