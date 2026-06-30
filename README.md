# Starfall Saga

A browser-based Final Fantasy tribute RPG built from scratch with HTML5 Canvas and vanilla JavaScript.

**Play:** [austinblundell.github.io/CursorTest/](https://austinblundell.github.io/CursorTest/)

## Story

The Star Crystal that protects the kingdom of Aldoria is fading. Lead knights Garrik, Selene, and Elara across the fields, rest in Millhaven, and climb the Obsidian Spire to defeat the Star Devourer.

## Features

- Tile-based overworld with towns, caves, and map transitions
- Classic turn-based combat with ATB-style speed ordering
- Three-party jobs: Knight, Arcanist, and Cleric
- Magic, items, shops, and inns
- Random encounters and a final boss
- Chiptune-style Web Audio effects
- Touch controls for mobile
- Auto-save to `localStorage`

## Controls

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move |
| Enter / Z / Space | Confirm |
| Escape / X | Cancel |
| On-screen D-pad + A | Mobile controls |

## Local development

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## GitHub Pages

This repo is configured for GitHub Pages project site deployment:

1. Push to `main`
2. In repository **Settings → Pages**, set source to **Deploy from branch** → `main` → `/ (root)`
3. The game is served at `https://austinblundell.github.io/CursorTest/`

The `.nojekyll` file ensures GitHub Pages serves ES modules correctly.

## Tech

- No build step or dependencies
- ES modules
- 512×448 pixel canvas (16×16 tiles)
- Relative asset paths for GitHub Pages compatibility
