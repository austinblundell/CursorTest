# Crystal Chronicles

A browser-based JRPG inspired by classic Final Fantasy games. Explore the kingdom of Baron, battle monsters in turn-based combat, and defeat the Shadow Dragon to restore the crystal of light.

**Play online:** [austinblundell.github.io/CursorTest/](https://austinblundell.github.io/CursorTest/)

## How to Play

### Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Enter / Z / Space | Confirm / Talk |
| Escape / X | Cancel |
| Touch controls | Available on mobile |

### Objective

1. Talk to the Guard in the overworld for directions
2. Visit **Baron Town** (southwest) to shop and rest at the inn
3. Enter the **Crystal Cave** (northeast) through the bridge
4. Defeat the **Shadow Dragon** boss at the crystal altar

### Combat

- **Attack** — Physical strike against a single enemy
- **Magic** — Cast spells (Fire, Cure, Holy, and more). Costs MP
- **Item** — Use Potions, Ethers, or Phoenix Downs from inventory
- **Run** — Attempt to flee (not available during boss fights)

### Party

| Character | Class | Role |
|-----------|-------|------|
| Cecil | Dark Knight | Physical damage |
| Rydia | Summoner | Offensive magic |
| Rosa | White Mage | Healing and Holy magic |

Progress is saved automatically to your browser. Defeat resets your save; victory persists.

## Local Development

```bash
# Serve locally (any static file server works)
npx serve .
# Open http://localhost:3000
```

## GitHub Pages

This project is a static site. Enable GitHub Pages on the `main` branch (root directory) in repository settings. No build step required.

## Tech Stack

- HTML5 Canvas
- Vanilla JavaScript (ES modules)
- Web Audio API for retro sound effects
- LocalStorage for save data
