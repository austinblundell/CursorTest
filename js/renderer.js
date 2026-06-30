import { CANVAS_W, CANVAS_H, TILE, TILE_COLORS } from './data.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.flashAlpha = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  clear(color = '#000') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  getOffset() {
    let ox = 0, oy = 0;
    if (this.shakeTimer > 0) {
      ox = (Math.random() - 0.5) * this.shakeIntensity;
      oy = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeTimer--;
    }
    return { ox, oy };
  }

  shake(intensity = 4, duration = 10) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  flash(alpha = 0.8) {
    this.flashAlpha = alpha;
  }

  drawFlash() {
    if (this.flashAlpha > 0) {
      this.ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha})`;
      this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      this.flashAlpha *= 0.85;
      if (this.flashAlpha < 0.02) this.flashAlpha = 0;
    }
  }

  drawTile(tileType, sx, sy, frame = 0) {
    const colors = TILE_COLORS[tileType] || TILE_COLORS[0];
    const x = sx * TILE;
    const y = sy * TILE;

    this.ctx.fillStyle = colors[0];
    this.ctx.fillRect(x, y, TILE, TILE);

    this.ctx.fillStyle = colors[1];
    this.ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);

    this.ctx.fillStyle = colors[2];
    this.ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);

    if (tileType === 1) {
      const wave = Math.sin(frame * 0.1 + sx + sy) * 2;
      this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
      this.ctx.fillRect(x + 3, y + 6 + wave, TILE - 6, 2);
    }

    if (tileType === 10) {
      this.ctx.fillStyle = `rgba(200,200,255,${0.5 + Math.sin(frame * 0.08) * 0.3})`;
      this.ctx.fillRect(x + 4, y + 2, TILE - 8, TILE - 4);
    }
  }

  drawMap(tiles, camX, camY, viewW, viewH, frame = 0) {
    const { ox, oy } = this.getOffset();
    const startX = Math.max(0, Math.floor(camX));
    const startY = Math.max(0, Math.floor(camY));
    const endX = Math.min(tiles[0].length, startX + viewW + 1);
    const endY = Math.min(tiles.length, startY + viewH + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const screenX = (x - camX) * TILE + ox;
        const screenY = (y - camY) * TILE + oy;
        const colors = TILE_COLORS[tiles[y][x]] || TILE_COLORS[0];

        this.ctx.fillStyle = colors[0];
        this.ctx.fillRect(screenX, screenY, TILE, TILE);
        this.ctx.fillStyle = colors[1];
        this.ctx.fillRect(screenX + 2, screenY + 2, TILE - 4, TILE - 4);
        this.ctx.fillStyle = colors[2];
        this.ctx.fillRect(screenX + 4, screenY + 4, TILE - 8, TILE - 8);

        if (tiles[y][x] === 1) {
          const wave = Math.sin(frame * 0.1 + x + y) * 2;
          this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
          this.ctx.fillRect(screenX + 3, screenY + 6 + wave, TILE - 6, 2);
        }
        if (tiles[y][x] === 10) {
          this.ctx.fillStyle = `rgba(200,200,255,${0.5 + Math.sin(frame * 0.08) * 0.3})`;
          this.ctx.fillRect(screenX + 4, screenY + 2, TILE - 8, TILE - 4);
        }
      }
    }
  }

  drawCharacter(px, py, color, accent, camX, camY, frame, facing = 'down') {
    const { ox, oy } = this.getOffset();
    const x = (px - camX) * TILE + ox;
    const y = (py - camY) * TILE + oy;
    const bob = Math.sin(frame * 0.15) * (frame % 2 === 0 ? 1 : 0);

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x + 3, y + 2 + bob, 10, 12);

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x + 4, y + 4 + bob, 8, 8);

    this.ctx.fillStyle = accent;
    this.ctx.fillRect(x + 5, y + 3 + bob, 6, 3);

    this.ctx.fillStyle = '#f8c8a8';
    this.ctx.fillRect(x + 5, y + 1 + bob, 6, 4);

    const legOffset = Math.sin(frame * 0.2) * 1;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x + 4, y + 12 + bob, 3, 3 + legOffset);
    this.ctx.fillRect(x + 9, y + 12 + bob - legOffset, 3, 3 + legOffset);
  }

  drawEnemySprite(enemy, x, y, frame) {
    const bob = Math.sin(frame * 0.06 + x) * 3;
    const color = enemy.color || '#888';

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x - 2, y + bob, 68, 60);

    this.ctx.fillStyle = color;
    if (enemy.boss) {
      this.ctx.fillRect(x, y - 10 + bob, 64, 64);
      this.ctx.fillStyle = '#f84848';
      this.ctx.fillRect(x + 16, y + 10 + bob, 8, 8);
      this.ctx.fillRect(x + 40, y + 10 + bob, 8, 8);
      this.ctx.fillStyle = '#f8d878';
      this.ctx.fillRect(x + 20, y + 30 + bob, 24, 8);
    } else {
      this.ctx.fillRect(x + 8, y + 10 + bob, 48, 40);
      this.ctx.fillStyle = '#f84848';
      this.ctx.fillRect(x + 16, y + 18 + bob, 6, 6);
      this.ctx.fillRect(x + 38, y + 18 + bob, 6, 6);
    }
  }

  drawWindow(x, y, w, h, opacity = 0.92) {
    this.ctx.fillStyle = `rgba(0, 0, 168, ${opacity})`;
    this.ctx.fillRect(x, y, w, h);

    this.ctx.strokeStyle = '#f8f8f8';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    this.ctx.strokeStyle = '#6868f0';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  }

  drawText(text, x, y, color = '#f8f8f8', size = 8, align = 'left') {
    this.ctx.font = `${size}px 'Press Start 2P'`;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'top';

    const lines = String(text).split('\n');
    lines.forEach((line, i) => {
      this.ctx.fillText(line, x, y + i * (size + 6));
    });
  }

  drawHPBar(x, y, w, current, max, label = '') {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, y, w, 10);
    const pct = Math.max(0, current / max);
    this.ctx.fillStyle = pct > 0.5 ? '#58d854' : pct > 0.25 ? '#f8d878' : '#e85050';
    this.ctx.fillRect(x + 1, y + 1, (w - 2) * pct, 8);
    this.ctx.strokeStyle = '#f8f8f8';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, 10);
    if (label) {
      this.drawText(`${label} ${current}/${max}`, x, y - 12, '#f8f8f8', 7);
    }
  }

  drawMPBar(x, y, w, current, max) {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(x, y, w, 8);
    const pct = Math.max(0, current / max);
    this.ctx.fillStyle = '#6868f0';
    this.ctx.fillRect(x + 1, y + 1, (w - 2) * pct, 6);
    this.ctx.strokeStyle = '#f8f8f8';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, w, 8);
    this.drawText(`MP ${current}/${max}`, x, y - 12, '#9898f0', 7);
  }

  drawMenu(items, x, y, w, selected, visible = true) {
    if (!visible) return;
    const h = items.length * 24 + 16;
    this.drawWindow(x, y, w, h);

    items.forEach((item, i) => {
      const iy = y + 12 + i * 24;
      const isSelected = i === selected;
      if (isSelected) {
        this.ctx.fillStyle = '#f8f8f8';
        this.ctx.fillRect(x + 8, iy - 2, w - 16, 20);
        this.drawText(item, x + 16, iy, '#0000a8', 8);
        this.drawText('▶', x + 4, iy, '#0000a8', 8);
      } else {
        this.drawText(item, x + 16, iy, '#f8f8f8', 8);
      }
    });
  }

  drawBattleBackground(frame) {
    const grad = this.ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#0a0828');
    grad.addColorStop(0.5, '#181848');
    grad.addColorStop(1, '#080818');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (let i = 0; i < 30; i++) {
      const sx = (i * 47 + frame * 0.2) % CANVAS_W;
      const sy = (i * 31) % (CANVAS_H * 0.5);
      this.ctx.fillStyle = `rgba(255,255,255,${0.1 + (i % 3) * 0.1})`;
      this.ctx.fillRect(sx, sy, 2, 2);
    }

    this.ctx.fillStyle = '#1a1a3a';
    this.ctx.fillRect(0, CANVAS_H * 0.55, CANVAS_W, CANVAS_H * 0.45);
  }

  drawTitleScreen(frame) {
    this.clear('#080818');

    for (let i = 0; i < 50; i++) {
      const sx = (i * 37 + frame * 0.3) % CANVAS_W;
      const sy = (i * 23 + Math.sin(frame * 0.02 + i) * 10) % CANVAS_H;
      this.ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.1})`;
      this.ctx.fillRect(sx, sy, 2, 2);
    }

    this.drawText('CRYSTAL', CANVAS_W / 2, 80, '#f8d878', 24, 'center');
    this.drawText('CHRONICLES', CANVAS_W / 2, 120, '#f8f8f8', 16, 'center');

    this.ctx.fillStyle = '#4848c8';
    this.ctx.beginPath();
    this.ctx.moveTo(CANVAS_W / 2, 180);
    this.ctx.lineTo(CANVAS_W / 2 - 20, 230);
    this.ctx.lineTo(CANVAS_W / 2 + 20, 230);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = `rgba(200,200,255,${0.6 + Math.sin(frame * 0.05) * 0.3})`;
    this.ctx.fillRect(CANVAS_W / 2 - 8, 190, 16, 30);

    this.drawText('A Final Fantasy Tribute', CANVAS_W / 2, 260, '#9898f0', 8, 'center');

    if (Math.floor(frame / 30) % 2 === 0) {
      this.drawText('Press ENTER to Start', CANVAS_W / 2, 340, '#f8f8f8', 8, 'center');
    }

    this.drawText('Arrow Keys / WASD — Move', CANVAS_W / 2, 390, '#686868', 7, 'center');
    this.drawText('Enter / Z — Confirm', CANVAS_W / 2, 410, '#686868', 7, 'center');
  }

  drawTransition(alpha) {
    this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  drawDialog(text, speaker = '') {
    this.drawWindow(16, CANVAS_H - 120, CANVAS_W - 32, 104);

    if (speaker) {
      this.drawText(speaker, 28, CANVAS_H - 108, '#f8d878', 8);
    }

    const lines = text.split('\n');
    lines.forEach((line, i) => {
      this.drawText(line, 28, CANVAS_H - 88 + i * 18, '#f8f8f8', 8);
    });

    if (Math.floor(Date.now() / 400) % 2 === 0) {
      this.drawText('▼', CANVAS_W - 48, CANVAS_H - 32, '#f8f8f8', 8);
    }
  }

  drawPartyStatus(party, x, y) {
    this.drawWindow(x, y, 200, party.length * 36 + 16);
    party.forEach((m, i) => {
      const my = y + 12 + i * 36;
      this.drawText(m.name, x + 12, my, m.color === '#f8f8f8' ? '#f8f8f8' : m.color, 7);
      this.drawHPBar(x + 12, my + 14, 176, m.hp, m.maxHp);
    });
  }

  drawGold(gold, x, y) {
    this.drawWindow(x, y, 120, 28);
    this.drawText(`GP ${gold}`, x + 12, y + 8, '#f8d878', 8);
  }
}
