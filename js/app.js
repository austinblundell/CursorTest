import { freshHeroes, WorldMaps, bakeMap } from './data.js';
import { bootInput, tap, flushTaps } from './input.js';
import { primeAudio, sfxConfirm } from './audio.js';
import { Painter } from './render.js';
import { World } from './world.js';
import { Combat } from './combat.js';

const SAVE_KEY = 'starfall-saga-v1';

class App {
  constructor(canvas) {
    this.painter = new Painter(canvas);
    this.world = new World(this.painter, this);
    this.combat = new Combat(this.painter, r => this.endFight(r));
    this.scene = 'title';
    this.frame = 0;
    this.heroes = freshHeroes();
    this.bag = { tonic: 3, mist: 1 };
    this.coins = 60;
    this.overTimer = 0;
  }

  boot() {
    bootInput();
    primeAudio();
    this.world.reset();
    this.readSave();
    this.loop();
  }

  readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      this.heroes = data.heroes;
      this.bag = data.bag;
      this.coins = data.coins;
      this.world.mapId = data.map || 'fields';
      this.world.px = data.x ?? 19;
      this.world.py = data.y ?? 14;
      this.world.bossDown = data.bossDown || false;
      if (data.throneBeaten) {
        const throne = WorldMaps.spire.throne;
        if (throne) throne.beaten = true;
      }
      Object.keys(WorldMaps).forEach(id => {
        if (!WorldMaps[id].grid) bakeMap(id);
      });
    } catch {
      // ignore corrupt saves
    }
  }

  save() {
    const data = {
      heroes: this.heroes,
      bag: this.bag,
      coins: this.coins,
      map: this.world.mapId,
      x: this.world.px,
      y: this.world.py,
      bossDown: this.world.bossDown,
      throneBeaten: this.world.bossDown,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  beginFight(foeKeys, canRun) {
    this.scene = 'fight';
    this.combat.start(this.heroes, foeKeys, this.bag, this.coins, canRun);
  }

  endFight(result) {
    if (result.fled) {
      this.heroes = result.heroes;
      this.scene = 'field';
      return;
    }

    if (result.won) {
      this.heroes = result.heroes;
      this.bag = result.bag;
      this.coins = result.coins;
      const boss = this.combat.foes.some(f => f.boss);
      if (boss) this.world.onBossWin();
      this.save();
      this.scene = 'field';
      return;
    }

    this.scene = 'over';
    this.overTimer = 0;
  }

  update() {
    this.frame++;

    if (this.scene === 'title') {
      if (tap('ok')) {
        sfxConfirm();
        primeAudio();
        this.scene = 'field';
      }
      flushTaps();
      return;
    }

    if (this.scene === 'field') {
      this.world.update();
      if (this.frame % 360 === 0) this.save();
      return;
    }

    if (this.scene === 'fight') {
      this.combat.update();
      return;
    }

    if (this.scene === 'over') {
      this.overTimer++;
      if (tap('ok')) {
        localStorage.removeItem(SAVE_KEY);
        this.heroes = freshHeroes();
        this.bag = { tonic: 3, mist: 1 };
        this.coins = 60;
        this.world.reset();
        this.scene = 'title';
        sfxConfirm();
      }
      flushTaps();
    }
  }

  draw() {
    if (this.scene === 'title') {
      this.painter.title(this.frame);
      return;
    }
    if (this.scene === 'field') {
      this.world.draw();
      return;
    }
    if (this.scene === 'fight') {
      this.combat.draw();
      return;
    }
    if (this.scene === 'over') {
      this.painter.wipe('#080818');
      this.painter.panel(100, 160, 312, 100);
      this.painter.label('GAME OVER', 256, 180, '#e85050', 14, 'center');
      this.painter.label('Press ENTER to retry', 256, 220, '#9898f0', 7, 'center');
    }
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

const canvas = document.getElementById('screen');
const app = new App(canvas);
app.boot();
