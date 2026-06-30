import { cloneParty } from './data.js';
import { initInput, isPressed, clearJustPressed } from './input.js';
import { initAudio } from './audio.js';
import { Renderer } from './renderer.js';
import { BattleSystem } from './battle.js';
import { Overworld } from './overworld.js';
import * as audio from './audio.js';

class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.battle = new BattleSystem(this.renderer, result => this.onBattleEnd(result));
    this.overworld = new Overworld(this.renderer, this);
    this.state = 'title';
    this.frame = 0;
    this.party = cloneParty();
    this.inventory = { potion: 3, ether: 1 };
    this.gold = 50;
  }

  init() {
    initInput();
    initAudio();
    this.overworld.init();
    this.loadSave();
    this.loop();
  }

  loadSave() {
    try {
      const saved = localStorage.getItem('crystal-chronicles-save');
      if (saved) {
        const data = JSON.parse(saved);
        this.party = data.party;
        this.inventory = data.inventory;
        this.gold = data.gold;
        this.overworld.currentMap = data.map || 'overworld';
        this.overworld.playerX = data.x || 20;
        this.overworld.playerY = data.y || 15;
        this.overworld.bossDefeated = data.bossDefeated || false;
      }
    } catch {
      // fresh start
    }
  }

  save() {
    const data = {
      party: this.party,
      inventory: this.inventory,
      gold: this.gold,
      map: this.overworld.currentMap,
      x: this.overworld.playerX,
      y: this.overworld.playerY,
      bossDefeated: this.overworld.bossDefeated,
    };
    localStorage.setItem('crystal-chronicles-save', JSON.stringify(data));
  }

  startBattle(enemyKeys, canFlee) {
    this.state = 'battle';
    this.battle.start(this.party, enemyKeys, this.inventory, this.gold, canFlee);
  }

  onBattleEnd(result) {
    if (result.fled) {
      this.party = result.party;
      this.state = 'overworld';
      return;
    }

    if (result.victory) {
      this.party = result.party;
      this.inventory = result.inventory;
      this.gold = result.gold;

      const wasBoss = this.battle.enemies.some(e => e.boss);
      if (wasBoss) {
        this.overworld.onBossDefeated();
      }

      this.save();
      this.state = 'overworld';
      return;
    }

    this.state = 'gameover';
    this.gameOverTimer = 0;
  }

  update() {
    this.frame++;

    if (this.state === 'title') {
      if (isPressed('Enter')) {
        audio.playConfirm();
        initAudio();
        this.state = 'overworld';
      }
      clearJustPressed();
      return;
    }

    if (this.state === 'overworld') {
      this.overworld.update();
      if (this.frame % 300 === 0) this.save();
      return;
    }

    if (this.state === 'battle') {
      this.battle.update();
      return;
    }

    if (this.state === 'gameover') {
      this.gameOverTimer++;
      if (isPressed('Enter')) {
        localStorage.removeItem('crystal-chronicles-save');
        this.party = cloneParty();
        this.inventory = { potion: 3, ether: 1 };
        this.gold = 50;
        this.overworld.init();
        this.overworld.bossDefeated = false;
        this.state = 'title';
        audio.playConfirm();
      }
      clearJustPressed();
    }
  }

  draw() {
    if (this.state === 'title') {
      this.renderer.drawTitleScreen(this.frame);
      return;
    }

    if (this.state === 'overworld') {
      this.overworld.draw();
      return;
    }

    if (this.state === 'battle') {
      this.battle.draw();
      return;
    }

    if (this.state === 'gameover') {
      this.renderer.clear('#080818');
      this.renderer.drawWindow(100, 160, 312, 100);
      this.renderer.drawText('GAME OVER', 256, 180, '#e85050', 14, 'center');
      this.renderer.drawText('Press ENTER to retry', 256, 220, '#9898f0', 7, 'center');
    }
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
game.init();
