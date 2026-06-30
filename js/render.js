import { W, H, T, TilePalette } from './data.js';

export class Painter {
  constructor(canvas) {
    this.c = canvas.getContext('2d');
    this.c.imageSmoothingEnabled = false;
    this.flash = 0;
    this.shakeT = 0;
    this.shakeA = 0;
  }

  wipe(color = '#000') {
    this.c.fillStyle = color;
    this.c.fillRect(0, 0, W, H);
  }

  jitter() {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    this.shakeT--;
    return {
      x: (Math.random() - 0.5) * this.shakeA,
      y: (Math.random() - 0.5) * this.shakeA,
    };
  }

  rumble(amount = 4, frames = 10) {
    this.shakeA = amount;
    this.shakeT = frames;
  }

  burst(alpha = 0.75) {
    this.flash = alpha;
  }

  paintFlash() {
    if (this.flash <= 0) return;
    this.c.fillStyle = `rgba(255,255,255,${this.flash})`;
    this.c.fillRect(0, 0, W, H);
    this.flash *= 0.86;
    if (this.flash < 0.02) this.flash = 0;
  }

  tile(kind, sx, sy, tick = 0) {
    const pal = TilePalette[kind] || TilePalette[0];
    const x = sx * T;
    const y = sy * T;
    this.c.fillStyle = pal[0];
    this.c.fillRect(x, y, T, T);
    this.c.fillStyle = pal[1];
    this.c.fillRect(x + 2, y + 2, T - 4, T - 4);
    this.c.fillStyle = pal[2];
    this.c.fillRect(x + 4, y + 4, T - 8, T - 8);

    if (kind === 1) {
      const wave = Math.sin(tick * 0.1 + sx + sy) * 2;
      this.c.fillStyle = 'rgba(255,255,255,0.22)';
      this.c.fillRect(x + 3, y + 6 + wave, T - 6, 2);
    }
    if (kind === 10) {
      const glow = 0.5 + Math.sin(tick * 0.09) * 0.3;
      this.c.fillStyle = `rgba(200,200,255,${glow})`;
      this.c.fillRect(x + 4, y + 2, T - 8, T - 4);
    }
  }

  map(grid, camX, camY, vw, vh, tick = 0) {
    const { x: jx, y: jy } = this.jitter();
    const x0 = Math.max(0, Math.floor(camX));
    const y0 = Math.max(0, Math.floor(camY));
    const x1 = Math.min(grid[0].length, x0 + vw + 1);
    const y1 = Math.min(grid.length, y0 + vh + 1);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const sx = (x - camX) * T + jx;
        const sy = (y - camY) * T + jy;
        this.c.save();
        this.c.translate(sx, sy);
        this.tile(grid[y][x], 0, 0, tick);
        this.c.restore();
      }
    }
  }

  sprite(px, py, tint, facing, tick, kind = 'hero') {
    const bob = Math.sin(tick * 0.15) * (kind === 'hero' ? 1 : 0.5);
    const x = px * T;
    const y = py * T + bob;

    this.c.fillStyle = '#101018';
    this.c.fillRect(x + 4, y + 12, T - 8, 3);

    this.c.fillStyle = tint;
    if (kind === 'hero') {
      this.c.fillRect(x + 5, y + 4, T - 10, T - 8);
      this.c.fillStyle = '#f8d878';
      this.c.fillRect(x + 6, y + 2, T - 12, 4);
    } else {
      this.c.fillRect(x + 3, y + 3, T - 6, T - 6);
      this.c.fillStyle = 'rgba(255,255,255,0.25)';
      this.c.fillRect(x + 5, y + 5, 3, 3);
    }

    if (facing === 'left') {
      this.c.fillStyle = '#000';
      this.c.fillRect(x + 4, y + 7, 2, 2);
    } else if (facing === 'right') {
      this.c.fillStyle = '#000';
      this.c.fillRect(x + T - 6, y + 7, 2, 2);
    } else {
      this.c.fillStyle = '#000';
      this.c.fillRect(x + 6, y + 7, 2, 2);
      this.c.fillRect(x + T - 8, y + 7, 2, 2);
    }
  }

  panel(x, y, w, h) {
    this.c.fillStyle = '#0000a8';
    this.c.fillRect(x, y, w, h);
    this.c.strokeStyle = '#f8f8f8';
    this.c.lineWidth = 2;
    this.c.strokeRect(x + 1, y + 1, w - 2, h - 2);
    this.c.strokeStyle = '#1818d8';
    this.c.lineWidth = 1;
    this.c.strokeRect(x + 4, y + 4, w - 8, h - 8);
  }

  label(text, x, y, color = '#f8f8f8', size = 8, align = 'left') {
    this.c.fillStyle = color;
    this.c.font = `${size}px 'Press Start 2P', monospace`;
    this.c.textAlign = align;
    this.c.textBaseline = 'top';
    this.c.fillText(text, x, y);
  }

  wrap(text, x, y, maxW, size = 8, color = '#f8f8f8', lineH = 14) {
    this.c.font = `${size}px 'Press Start 2P', monospace`;
    const words = text.split(' ');
    let line = '';
    let cy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (this.c.measureText(test).width > maxW && line) {
        this.label(line, x, cy, color, size);
        line = word;
        cy += lineH;
      } else {
        line = test;
      }
    }
    if (line) this.label(line, x, cy, color, size);
    return cy + lineH - y;
  }

  title(tick) {
    this.wipe('#080818');
    const stars = 40;
    for (let i = 0; i < stars; i++) {
      const sx = (i * 97 + tick * 0.3) % W;
      const sy = (i * 53) % (H * 0.6);
      const bright = 0.3 + Math.sin(tick * 0.05 + i) * 0.3;
      this.c.fillStyle = `rgba(255,255,255,${bright})`;
      this.c.fillRect(sx, sy, 2, 2);
    }

    this.label('STAR', W / 2, 80, '#f8d878', 20, 'center');
    this.label('FALL', W / 2, 108, '#98a0f0', 20, 'center');
    this.label('SAGA', W / 2, 136, '#f8f8f8', 20, 'center');

    this.panel(96, 200, 320, 72);
    this.wrap('A Final Fantasy tribute. The Star Crystal dims — journey to the Obsidian Spire.', 112, 212, 288, 7, '#c8c8f0');

    const blink = Math.floor(tick / 30) % 2 === 0;
    if (blink) this.label('PRESS ENTER', W / 2, 310, '#58d854', 8, 'center');

    this.label('Arrows / WASD move   Z / Enter confirm', W / 2, 400, '#686898', 6, 'center');
  }

  hud(heroes, coins, mapName) {
    this.panel(4, 4, 200, 52);
    heroes.forEach((h, i) => {
      const y = 10 + i * 14;
      const col = h.hp <= 0 ? '#e85050' : h.hp < h.maxHp * 0.3 ? '#f8d878' : '#58d854';
      this.label(`${h.name}`, 12, y, h.tint, 6);
      this.label(`${h.hp}`, 90, y, col, 6);
      this.label(`/${h.maxHp}`, 118, y, '#8888a8', 6);
    });

    this.panel(W - 140, 4, 136, 24);
    this.label(`${coins} GP`, W - 72, 10, '#f8d878', 7, 'center');
    this.label(mapName, W / 2, H - 18, '#686898', 6, 'center');
  }

  dialogBox(lines, index) {
    this.panel(16, H - 108, W - 32, 92);
    const shown = lines.slice(0, index + 1);
    let y = H - 94;
    for (const line of shown) {
      this.label(line, 28, y, '#f8f8f8', 7);
      y += 16;
    }
    if (Math.floor(Date.now() / 400) % 2 === 0) {
      this.label('▼', W - 44, H - 28, '#f8d878', 8);
    }
  }

  shopMenu(items, index, coins) {
    this.panel(80, 60, 352, 280);
    this.label('SHOP', 256, 72, '#f8d878', 10, 'center');
    this.label(`GP: ${coins}`, 100, 100, '#f8d878', 7);
    items.forEach((item, i) => {
      const sel = i === index;
      const prefix = sel ? '►' : ' ';
      const afford = coins >= item.price ? '#f8f8f8' : '#e85050';
      this.label(`${prefix} ${item.label}  ${item.price}G`, 100, 130 + i * 22, sel ? '#f8d878' : afford, 7);
    });
    this.label('ENTER buy   ESC leave', 256, 310, '#8888a8', 6, 'center');
  }

  battleBg(tick) {
    const g = this.c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#101028');
    g.addColorStop(1, '#282850');
    this.c.fillStyle = g;
    this.c.fillRect(0, 0, W, H);

    for (let i = 0; i < 6; i++) {
      const bx = 60 + i * 70;
      const by = 80 + Math.sin(tick * 0.04 + i) * 8;
      this.c.fillStyle = 'rgba(255,255,255,0.06)';
      this.c.beginPath();
      this.c.ellipse(bx, by, 28, 10, 0, 0, Math.PI * 2);
      this.c.fill();
    }
  }

  battleFoes(foes, tick) {
    foes.forEach((f, i) => {
      if (f.hp <= 0) return;
      const x = 280 + (i % 2) * 48;
      const y = 60 + Math.floor(i / 2) * 56;
      const scale = f.boss ? 1.6 : 1;
      this.c.save();
      this.c.translate(x * T, y * T);
      this.c.scale(scale, scale);
      this.sprite(0, 0, f.hue, 'down', tick, 'foe');
      this.c.restore();
      this.label(f.name, x * T + 8, y * T - 10, '#f8f8f8', 6);
    });
  }

  battleHeroes(heroes) {
    this.panel(8, H - 148, 220, 140);
    heroes.forEach((h, i) => {
      const y = H - 136 + i * 42;
      const dead = h.hp <= 0;
      this.label(h.name, 16, y, dead ? '#686868' : h.tint, 7);
      this.label(`HP ${h.hp}/${h.maxHp}`, 16, y + 12, dead ? '#e85050' : '#58d854', 6);
      this.label(`MP ${h.mp}/${h.maxMp}`, 16, y + 24, '#6868f0', 6);
    });
  }

  battleMenu(options, index, actorName) {
    this.panel(240, H - 148, 264, 140);
    this.label(actorName, 252, H - 136, '#f8d878', 7);
    options.forEach((opt, i) => {
      const sel = i === index;
      this.label(`${sel ? '►' : ' '} ${opt}`, 252, H - 112 + i * 22, sel ? '#f8d878' : '#f8f8f8', 7);
    });
  }

  battleLog(lines) {
    this.panel(8, 8, W - 16, 56);
    lines.slice(-3).forEach((line, i) => {
      this.label(line, 16, 16 + i * 14, '#c8c8f0', 6);
    });
  }

  encounterSplash() {
    this.wipe('#000');
    this.label('ENCOUNTER!', W / 2, H / 2 - 8, '#e85050', 14, 'center');
  }
}
