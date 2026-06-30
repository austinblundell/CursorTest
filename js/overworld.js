import { TILE, MAPS, ENCOUNTER_TABLES, ITEMS, generateMapTiles, CANVAS_W, CANVAS_H } from './data.js';
import { isPressed, isDown, clearJustPressed } from './input.js';
import * as audio from './audio.js';

const VIEW_W = 32;
const VIEW_H = 28;

export class Overworld {
  constructor(renderer, game) {
    this.renderer = renderer;
    this.game = game;
    this.currentMap = 'overworld';
    this.playerX = 20;
    this.playerY = 15;
    this.facing = 'down';
    this.frame = 0;
    this.moveTimer = 0;
    this.dialog = null;
    this.dialogIndex = 0;
    this.shopOpen = false;
    this.shopIndex = 0;
    this.transition = null;
    this.stepsSinceEncounter = 0;
    this.bossDefeated = false;
  }

  init() {
    Object.keys(MAPS).forEach(generateMapTiles);
    const map = MAPS[this.currentMap];
    this.playerX = map.spawn.x;
    this.playerY = map.spawn.y;
  }

  loadMap(mapId, spawnX, spawnY) {
    this.currentMap = mapId;
    if (!MAPS[mapId].tiles) generateMapTiles(mapId);
    this.playerX = spawnX;
    this.playerY = spawnY;
    this.stepsSinceEncounter = 0;
  }

  update() {
    this.frame++;

    if (this.transition) {
      this.transition.timer--;
      if (this.transition.timer <= 0) {
        this.loadMap(this.transition.to, this.transition.spawnX, this.transition.spawnY);
        this.transition = null;
      }
      return;
    }

    if (this.dialog) {
      if (isPressed('Enter')) {
        audio.playConfirm();
        this.dialogIndex++;
        const lines = this.dialog.lines;
        if (this.dialogIndex >= lines.length) {
          if (this.dialog.inn) {
            this.restAtInn();
          } else if (this.dialog.shop) {
            this.shopOpen = true;
            this.shopIndex = 0;
          }
          this.dialog = null;
        }
      }
      if (isPressed('Cancel')) {
        audio.playCancel();
        this.dialog = null;
      }
      clearJustPressed();
      return;
    }

    if (this.shopOpen) {
      this.updateShop();
      return;
    }

    this.handleMovement();
    this.checkWarp();
    this.checkNPC();
    this.checkBoss();
    clearJustPressed();
  }

  handleMovement() {
    if (this.moveTimer > 0) {
      this.moveTimer--;
      return;
    }

    let dx = 0, dy = 0;
    if (isDown('ArrowUp')) { dy = -1; this.facing = 'up'; }
    else if (isDown('ArrowDown')) { dy = 1; this.facing = 'down'; }
    else if (isDown('ArrowLeft')) { dx = -1; this.facing = 'left'; }
    else if (isDown('ArrowRight')) { dx = 1; this.facing = 'right'; }

    if (dx === 0 && dy === 0) return;

    const nx = this.playerX + dx;
    const ny = this.playerY + dy;

    if (this.canWalk(nx, ny)) {
      this.playerX = nx;
      this.playerY = ny;
      this.moveTimer = 8;
      this.stepsSinceEncounter++;
      audio.playStep();

      const map = MAPS[this.currentMap];
      if (map.encounterRate > 0 && this.stepsSinceEncounter > 5) {
        if (Math.random() < map.encounterRate) {
          this.triggerEncounter(map.encounterZone);
        }
      }
    }
  }

  canWalk(x, y) {
    const map = MAPS[this.currentMap];
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;

    const tile = map.tiles[y][x];
    const blocked = [1, 4, 6];
    if (blocked.includes(tile)) return false;

    const npcBlock = map.npcs.some(n => n.x === x && n.y === y);
    if (npcBlock) return false;

    return true;
  }

  checkWarp() {
    const map = MAPS[this.currentMap];
    const warp = map.warps.find(w => w.x === this.playerX && w.y === this.playerY);
    if (warp) {
      this.transition = { to: warp.to, spawnX: warp.spawnX, spawnY: warp.spawnY, timer: 30 };
      audio.playConfirm();
    }
  }

  checkNPC() {
    if (!isPressed('Enter')) return;

    const map = MAPS[this.currentMap];
    let target = map.npcs.find(n => n.x === this.playerX && n.y === this.playerY);

    if (!target) {
      const offsets = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
      for (const o of offsets) {
        const npc = map.npcs.find(n => n.x === this.playerX + o.x && n.y === this.playerY + o.y);
        if (npc) { target = npc; break; }
      }
    }

    if (target) {
      audio.playConfirm();
      this.dialog = {
        name: target.name,
        lines: target.dialog,
        inn: target.inn,
        shop: target.shop,
      };
      this.dialogIndex = 0;
    }
  }

  checkBoss() {
    const map = MAPS[this.currentMap];
    if (!map.boss || map.boss.defeated || this.bossDefeated) return;

    if (this.playerX === map.boss.x && this.playerY === map.boss.y) {
      audio.playEncounter();
      this.game.startBattle([map.boss.enemy], false);
    }
  }

  triggerEncounter(zone) {
    const table = ENCOUNTER_TABLES[zone] || ENCOUNTER_TABLES.grass;
    const count = Math.random() < 0.3 ? 2 : 1;
    const enemies = [];
    for (let i = 0; i < count; i++) {
      enemies.push(table[Math.floor(Math.random() * table.length)]);
    }
    this.stepsSinceEncounter = 0;
    this.game.startBattle(enemies, true);
  }

  restAtInn() {
    if (this.game.gold >= 10) {
      this.game.gold -= 10;
      this.game.party.forEach(m => {
        m.hp = m.maxHp;
        m.mp = m.maxMp;
        m.isDead = false;
      });
      this.dialog = { name: 'Innkeeper', lines: ['Rest well, heroes!', 'Your party is fully healed.'] };
      this.dialogIndex = 0;
      audio.playHeal();
    } else {
      this.dialog = { name: 'Innkeeper', lines: ['Not enough GP!', 'Come back when you have 10 GP.'] };
      this.dialogIndex = 0;
    }
  }

  updateShop() {
    const shopItems = [
      { key: 'potion', price: 15 },
      { key: 'hiPotion', price: 50 },
      { key: 'ether', price: 30 },
      { key: 'phoenix', price: 100 },
    ];

    const labels = shopItems.map(s => `${ITEMS[s.key].name} ${s.price}G`);
    labels.push('Exit');

    if (isPressed('ArrowUp')) { this.shopIndex = (this.shopIndex - 1 + labels.length) % labels.length; audio.playCursor(); }
    if (isPressed('ArrowDown')) { this.shopIndex = (this.shopIndex + 1) % labels.length; audio.playCursor(); }

    if (isPressed('Enter')) {
      if (this.shopIndex === labels.length - 1) {
        audio.playCancel();
        this.shopOpen = false;
      } else {
        const item = shopItems[this.shopIndex];
        if (this.game.gold >= item.price) {
          this.game.gold -= item.price;
          this.game.inventory[item.key] = (this.game.inventory[item.key] || 0) + 1;
          audio.playConfirm();
        } else {
          audio.playCancel();
        }
      }
    }

    if (isPressed('Cancel')) {
      audio.playCancel();
      this.shopOpen = false;
    }
    clearJustPressed();
  }

  onBossDefeated() {
    this.bossDefeated = true;
    MAPS.cave.boss.defeated = true;
  }

  draw() {
    const r = this.renderer;
    const map = MAPS[this.currentMap];
    const camX = this.playerX - VIEW_W / 2;
    const camY = this.playerY - VIEW_H / 2;

    r.clear('#102010');
    r.drawMap(map.tiles, camX, camY, VIEW_W, VIEW_H, this.frame);

    map.npcs.forEach(npc => {
      r.drawCharacter(npc.x, npc.y, '#c84848', '#f87878', camX, camY, this.frame + npc.x);
    });

    const hero = this.game.party[0];
    r.drawCharacter(this.playerX, this.playerY, hero.color, hero.accent, camX, camY, this.frame, this.facing);

    r.drawWindow(8, 8, 180, 24);
    r.drawText(map.name, 16, 14, '#f8d878', 7);
    r.drawGold(this.game.gold, CANVAS_W - 128, 8);
    r.drawPartyStatus(this.game.party, 8, CANVAS_H - 130);

    if (this.dialog) {
      r.drawDialog(this.dialog.lines[this.dialogIndex], this.dialog.name);
    }

    if (this.shopOpen) {
      const shopItems = [
        { key: 'potion', price: 15 },
        { key: 'hiPotion', price: 50 },
        { key: 'ether', price: 30 },
        { key: 'phoenix', price: 100 },
      ];
      const labels = shopItems.map(s => `${ITEMS[s.key].name} ${s.price}G`);
      labels.push('Exit');
      r.drawWindow(140, 80, 232, labels.length * 24 + 32);
      r.drawText('SHOP', 156, 92, '#f8d878', 8);
      r.drawMenu(labels, 148, 112, 216, this.shopIndex);
      r.drawText(`GP: ${this.game.gold}`, 156, 88 + labels.length * 24 + 16, '#f8d878', 7);
    }

    if (this.transition) {
      const alpha = 1 - this.transition.timer / 30;
      r.drawTransition(alpha);
    }

    if (this.bossDefeated && this.currentMap === 'cave') {
      r.drawWindow(100, 180, CANVAS_W - 200, 60);
      r.drawText('Crystal restored!', CANVAS_W / 2, 196, '#f8d878', 8, 'center');
      r.drawText('Peace returns to Baron.', CANVAS_W / 2, 216, '#f8f8f8', 7, 'center');
    }

    r.drawFlash();
  }
}
