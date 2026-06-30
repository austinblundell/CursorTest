import { T, WorldMaps, Zones, Goods, bakeMap } from './data.js';
import { tap, down, flushTaps, dirVector } from './input.js';
import * as sfx from './audio.js';

const VIEW_W = 32;
const VIEW_H = 28;

const SHOP = [
  { key: 'tonic', label: Goods.tonic.label, price: 25 },
  { key: 'elixir', label: Goods.elixir.label, price: 80 },
  { key: 'mist', label: Goods.mist.label, price: 40 },
  { key: 'feather', label: Goods.feather.label, price: 150 },
];

const BLOCKED = new Set([1, 4, 6]);

export class World {
  constructor(painter, app) {
    this.p = painter;
    this.app = app;
    this.mapId = 'fields';
    this.px = 19;
    this.py = 14;
    this.face = 'down';
    this.tick = 0;
    this.stepCd = 0;
    this.chat = null;
    this.chatLine = 0;
    this.store = false;
    this.storeIdx = 0;
    this.fade = null;
    this.steps = 0;
    this.bossDown = false;
  }

  reset() {
    Object.keys(WorldMaps).forEach(bakeMap);
    const start = WorldMaps[this.mapId].start;
    this.px = start.x;
    this.py = start.y;
    this.face = 'down';
    this.steps = 0;
    this.bossDown = false;
    this.chat = null;
    this.store = false;
    this.fade = null;
  }

  load(mapId, sx, sy) {
    this.mapId = mapId;
    if (!WorldMaps[mapId].grid) bakeMap(mapId);
    this.px = sx;
    this.py = sy;
    this.steps = 0;
  }

  map() {
    return WorldMaps[this.mapId];
  }

  update() {
    this.tick++;

    if (this.fade) {
      this.fade.t--;
      if (this.fade.t <= 0) {
        this.load(this.fade.map, this.fade.sx, this.fade.sy);
        this.fade = null;
      }
      return;
    }

    if (this.chat) {
      if (tap('ok')) {
        sfx.sfxConfirm();
        this.chatLine++;
        if (this.chatLine >= this.chat.lines.length) {
          if (this.chat.lodge) this.rest();
          else if (this.chat.vendor) {
            this.store = true;
            this.storeIdx = 0;
          }
          this.chat = null;
        }
      }
      if (tap('back')) {
        sfx.sfxBack();
        this.chat = null;
      }
      flushTaps();
      return;
    }

    if (this.store) {
      this.updateStore();
      return;
    }

    const vec = dirVector();
    if (vec) {
      this.face = vec.face;
      if (this.stepCd <= 0) {
        this.tryStep(vec.x, vec.y);
        this.stepCd = 10;
      }
    }
    if (this.stepCd > 0) this.stepCd--;

    if (tap('ok')) {
      this.interact();
      sfx.sfxConfirm();
    }

    flushTaps();
  }

  tryStep(dx, dy) {
    const nx = this.px + dx;
    const ny = this.py + dy;
    const m = this.map();

    if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows) return;

    const tile = m.grid[ny][nx];
    if (BLOCKED.has(tile)) return;

    for (const folk of m.folk) {
      if (folk.x === nx && folk.y === ny) return;
    }

    const throne = m.throne;
    if (throne && throne.x === nx && throne.y === ny && !throne.beaten && !this.bossDown) return;

    this.px = nx;
    this.py = ny;
    this.steps++;
    sfx.sfxStep();

    for (const door of m.doors) {
      if (door.x === nx && door.y === ny) {
        this.fade = { map: door.map, sx: door.sx, sy: door.sy, t: 24 };
        return;
      }
    }

    const boss = m.throne;
    if (boss && boss.x === nx && boss.y === ny && !boss.beaten && !this.bossDown) {
      this.app.beginFight([boss.foe], false);
      return;
    }

    if (m.roam > 0 && (tile === 0 || tile === 3)) {
      if (this.steps > 8 && Math.random() < m.roam) {
        const pool = Zones[m.zone];
        const count = Math.random() < 0.25 ? 2 : 1;
        const keys = [];
        for (let i = 0; i < count; i++) {
          keys.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        this.app.beginFight(keys, true);
        this.steps = 0;
      }
    }
  }

  interact() {
    const m = this.map();
    const fx = this.px + (this.face === 'left' ? -1 : this.face === 'right' ? 1 : 0);
    const fy = this.py + (this.face === 'up' ? -1 : this.face === 'down' ? 1 : 0);

    for (const folk of m.folk) {
      if (folk.x === fx && folk.y === fy || folk.x === this.px && folk.y === this.py) {
        this.chat = { lines: folk.lines, lodge: folk.lodge, vendor: folk.vendor };
        this.chatLine = 0;
        return;
      }
    }
  }

  rest() {
    if (this.app.coins < 12) {
      this.chat = { lines: ['Not enough gold.'] };
      this.chatLine = 0;
      return;
    }
    this.app.coins -= 12;
    for (const h of this.app.heroes) {
      h.hp = h.maxHp;
      h.mp = h.maxMp;
    }
    this.app.save();
  }

  updateStore() {
    if (tap('up')) {
      sfx.sfxCursor();
      this.storeIdx = (this.storeIdx + SHOP.length - 1) % SHOP.length;
    }
    if (tap('down')) {
      sfx.sfxCursor();
      this.storeIdx = (this.storeIdx + 1) % SHOP.length;
    }
    if (tap('ok')) {
      const item = SHOP[this.storeIdx];
      if (this.app.coins >= item.price) {
        this.app.coins -= item.price;
        this.app.bag[item.key] = (this.app.bag[item.key] || 0) + 1;
        sfx.sfxConfirm();
        this.app.save();
      } else {
        sfx.sfxBack();
      }
    }
    if (tap('back')) {
      sfx.sfxBack();
      this.store = false;
    }
    flushTaps();
  }

  onBossWin() {
    this.bossDown = true;
    const throne = WorldMaps.spire.throne;
    if (throne) throne.beaten = true;
  }

  draw() {
    const m = this.map();
    const camX = this.px - VIEW_W / 2;
    const camY = this.py - VIEW_H / 2;

    this.p.wipe('#000');
    this.p.map(m.grid, camX, camY, VIEW_W, VIEW_H, this.tick);

    for (const folk of m.folk) {
      const sx = (folk.x - camX) * T;
      const sy = (folk.y - camY) * T;
      if (sx < -T || sy < -T || sx > 512 || sy > 448) continue;
      this.p.c.save();
      this.p.c.translate(sx, sy);
      this.p.sprite(0, 0, '#d8a848', 'down', this.tick, 'hero');
      this.p.c.restore();
    }

    const lead = this.app.heroes[0];
    this.p.sprite(this.px - camX, this.py - camY, lead.tint, this.face, this.tick, 'hero');
    this.p.hud(this.app.heroes, this.app.coins, m.label);

    if (this.chat) this.p.dialogBox(this.chat.lines, this.chatLine);
    if (this.store) this.p.shopMenu(SHOP, this.storeIdx, this.app.coins);

    if (this.fade) {
      const a = 1 - this.fade.t / 24;
      this.p.c.fillStyle = `rgba(0,0,0,${a})`;
      this.p.c.fillRect(0, 0, 512, 448);
    }

    this.p.paintFlash();
  }
}
