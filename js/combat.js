import { Magic, Goods, spawnFoe, growHero } from './data.js';
import { tap, flushTaps } from './input.js';
import * as sfx from './audio.js';

const MAIN = ['Attack', 'Magic', 'Item', 'Flee'];

export class Combat {
  constructor(painter, onDone) {
    this.p = painter;
    this.onDone = onDone;
    this.clear();
  }

  clear() {
    this.heroes = [];
    this.foes = [];
    this.mode = 'intro';
    this.menu = 0;
    this.sub = 0;
    this.actor = 0;
    this.log = [];
    this.logT = 0;
    this.tick = 0;
    this.queue = [];
    this.turn = null;
    this.pending = null;
    this.pick = 0;
    this.subMode = null;
    this.bag = {};
    this.coins = 0;
    this.xpGain = 0;
    this.coinGain = 0;
    this.levels = [];
    this.introT = 0;
    this.winT = 0;
    this.animT = 0;
    this.canRun = true;
  }

  start(heroes, foeKeys, bag, coins, canRun = true) {
    this.clear();
    this.heroes = heroes.map(h => ({ ...h, down: h.hp <= 0 }));
    this.foes = foeKeys.map(spawnFoe);
    this.bag = { ...bag };
    this.coins = coins;
    this.canRun = canRun;
    this.mode = 'intro';
    this.introT = 55;
    sfx.sfxEncounter();
  }

  update() {
    this.tick++;

    if (this.mode === 'intro') {
      this.introT--;
      if (this.introT <= 0) {
        this.mode = 'menu';
        this.planTurns();
        this.nextActor();
      }
      return;
    }

    if (this.mode === 'msg') {
      this.logT--;
      if (this.logT <= 0) this.afterMsg();
      if (tap('ok')) this.logT = 0;
      flushTaps();
      return;
    }

    if (this.mode === 'anim') {
      this.animT--;
      if (this.animT <= 0) this.resolve();
      return;
    }

    if (this.mode === 'menu') {
      this.menuInput();
      return;
    }

    if (this.mode === 'sub') {
      this.subInput();
      return;
    }

    if (this.mode === 'pick') {
      this.pickInput();
      return;
    }

    if (this.mode === 'win') {
      this.winT--;
      if (this.winT <= 0 || tap('ok')) {
        this.onDone({
          won: true,
          heroes: this.heroes,
          bag: this.bag,
          coins: this.coins + this.coinGain,
          xp: this.xpGain,
          levels: this.levels,
        });
      }
      flushTaps();
      return;
    }

    if (this.mode === 'lose') {
      if (tap('ok')) {
        this.onDone({ won: false, heroes: this.heroes, bag: this.bag, coins: this.coins });
      }
      flushTaps();
    }
  }

  say(text, frames = 50) {
    this.log.push(text);
    if (this.log.length > 6) this.log.shift();
    this.mode = 'msg';
    this.logT = frames;
  }

  afterMsg() {
    if (this.checkEnd()) return;
    if (this.pending) {
      this.mode = 'anim';
      this.animT = 18;
      return;
    }
    this.nextActor();
  }

  planTurns() {
    const all = [
      ...this.heroes.filter(h => h.hp > 0).map(h => ({ side: 'hero', ref: h, spd: h.spd })),
      ...this.foes.filter(f => f.hp > 0).map(f => ({ side: 'foe', ref: f, spd: f.spd })),
    ];
    all.sort((a, b) => b.spd - a.spd || Math.random() - 0.5);
    this.queue = all;
  }

  nextActor() {
    while (this.queue.length) {
      const next = this.queue.shift();
      if (next.ref.hp <= 0) continue;
      this.turn = next;
      if (next.side === 'hero') {
        this.actor = this.heroes.indexOf(next.ref);
        this.menu = 0;
        this.mode = 'menu';
      } else {
        this.foeAct();
      }
      return;
    }
    this.planTurns();
    this.nextActor();
  }

  menuInput() {
    const h = this.heroes[this.actor];
    if (tap('up')) {
      sfx.sfxCursor();
      this.menu = (this.menu + MAIN.length - 1) % MAIN.length;
    }
    if (tap('down')) {
      sfx.sfxCursor();
      this.menu = (this.menu + 1) % MAIN.length;
    }
    if (tap('ok')) {
      sfx.sfxConfirm();
      const choice = MAIN[this.menu];
      if (choice === 'Attack') {
        this.pending = { kind: 'attack' };
        this.pick = 0;
        this.mode = 'pick';
      } else if (choice === 'Magic') {
        if (!h.skills.length) {
          this.say(`${h.name} has no magic!`);
          return;
        }
        this.subMode = 'magic';
        this.sub = 0;
        this.mode = 'sub';
      } else if (choice === 'Item') {
        const keys = Object.keys(this.bag).filter(k => this.bag[k] > 0);
        if (!keys.length) {
          this.say('No items!');
          return;
        }
        this.subMode = 'item';
        this.sub = 0;
        this.itemKeys = keys;
        this.mode = 'sub';
      } else if (choice === 'Flee') {
        if (!this.canRun) {
          this.say("Can't flee!");
          return;
        }
        if (Math.random() < 0.55) {
          sfx.sfxFlee();
          this.onDone({ fled: true, heroes: this.heroes, bag: this.bag, coins: this.coins });
        } else {
          this.say('Could not escape!');
          this.pending = null;
        }
      }
    }
    flushTaps();
  }

  subInput() {
    const h = this.heroes[this.actor];
    if (this.subMode === 'magic') {
      const list = h.skills;
      if (tap('up')) {
        sfx.sfxCursor();
        this.sub = (this.sub + list.length - 1) % list.length;
      }
      if (tap('down')) {
        sfx.sfxCursor();
        this.sub = (this.sub + 1) % list.length;
      }
      if (tap('back')) {
        sfx.sfxBack();
        this.mode = 'menu';
      }
      if (tap('ok')) {
        const key = list[this.sub];
        const spell = Magic[key];
        if (h.mp < spell.cost) {
          this.say('Not enough MP!');
          return;
        }
        sfx.sfxConfirm();
        this.pending = { kind: 'magic', key };
        if (spell.side === 'ally') {
          this.pick = this.actor;
          this.mode = 'pick';
        } else if (spell.side === 'all-foes') {
          this.mode = 'anim';
          this.animT = 22;
        } else {
          this.pick = 0;
          this.mode = 'pick';
        }
      }
    }

    if (this.subMode === 'item') {
      const keys = this.itemKeys;
      if (tap('up')) {
        sfx.sfxCursor();
        this.sub = (this.sub + keys.length - 1) % keys.length;
      }
      if (tap('down')) {
        sfx.sfxCursor();
        this.sub = (this.sub + 1) % keys.length;
      }
      if (tap('back')) {
        sfx.sfxBack();
        this.mode = 'menu';
      }
      if (tap('ok')) {
        sfx.sfxConfirm();
        this.pending = { kind: 'item', key: keys[this.sub] };
        this.pick = this.actor;
        this.mode = 'pick';
      }
    }
    flushTaps();
  }

  pickInput() {
    const targetFoe =
      this.pending?.kind === 'attack' ||
      (this.pending?.kind === 'magic' && Magic[this.pending.key]?.side === 'foe');

    const live = targetFoe
      ? this.foes.map((f, i) => (f.hp > 0 ? i : -1)).filter(i => i >= 0)
      : this.heroes.map((h, i) => (h.hp > 0 || Goods[this.pending?.key]?.revive ? i : -1)).filter(i => i >= 0);

    if (tap('up') || tap('left')) {
      sfx.sfxCursor();
      this.pick = (this.pick + live.length - 1) % live.length;
    }
    if (tap('down') || tap('right')) {
      sfx.sfxCursor();
      this.pick = (this.pick + 1) % live.length;
    }
    if (tap('back')) {
      sfx.sfxBack();
      this.pending = null;
      this.mode = this.subMode ? 'sub' : 'menu';
    }
    if (tap('ok')) {
      sfx.sfxConfirm();
      const idx = live[this.pick];
      this.pending.target = idx;
      this.mode = 'anim';
      this.animT = 16;
    }
    flushTaps();
  }

  resolve() {
    const h = this.heroes[this.actor];
    const act = this.pending;
    if (!act) return;

    if (act.kind === 'attack') {
      const f = this.foes[act.target];
      const dmg = Math.max(1, Math.floor(h.atk * (0.85 + Math.random() * 0.3) - f.def * 0.4));
      f.hp -= dmg;
      sfx.sfxHit();
      this.p.rumble(3, 8);
      this.say(`${h.name} hits ${f.name} for ${dmg}!`);
    }

    if (act.kind === 'magic') {
      const spell = Magic[act.key];
      h.mp -= spell.cost;
      sfx.sfxMagic();
      this.p.burst(0.5);

      if (spell.side === 'all-foes') {
        let total = 0;
        for (const f of this.foes) {
          if (f.hp <= 0) continue;
          const dmg = Math.max(1, Math.floor(h.mag * spell.power / 30 - f.def * 0.2));
          f.hp -= dmg;
          total += dmg;
        }
        this.say(`${h.name} casts ${spell.label}! ${total} total!`);
      } else if (spell.side === 'ally') {
        const ally = this.heroes[act.target];
        const heal = Math.floor(spell.power * (1 + h.mag * 0.02));
        ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        sfx.sfxHeal();
        this.say(`${h.name} casts ${spell.label}! +${heal} HP`);
      } else {
        const f = this.foes[act.target];
        const dmg = Math.max(1, Math.floor(h.mag * spell.power / 28 - f.def * 0.15));
        f.hp -= dmg;
        this.say(`${h.name} casts ${spell.label}! ${dmg} dmg!`);
      }
    }

    if (act.kind === 'item') {
      const item = Goods[act.key];
      const ally = this.heroes[act.target];
      this.bag[act.key]--;
      if (item.revive) {
        if (ally.hp > 0) {
          this.say('Already standing!');
          this.bag[act.key]++;
        } else {
          ally.hp = Math.floor(ally.maxHp * 0.3);
          sfx.sfxHeal();
          this.say(`${ally.name} revived!`);
        }
      } else if (item.heal) {
        ally.hp = Math.min(ally.maxHp, ally.hp + item.heal);
        sfx.sfxHeal();
        this.say(`Used ${item.label}! +${item.heal} HP`);
      } else if (item.mp) {
        ally.mp = Math.min(ally.maxMp, ally.mp + item.mp);
        sfx.sfxHeal();
        this.say(`Used ${item.label}! +${item.mp} MP`);
      }
    }

    this.pending = null;
    this.checkEnd();
  }

  foeAct() {
    const f = this.turn.ref;
    if (f.hp <= 0) {
      this.nextActor();
      return;
    }

    const live = this.heroes.filter(h => h.hp > 0);
    if (!live.length) {
      this.checkEnd();
      return;
    }

    const target = live[Math.floor(Math.random() * live.length)];

    if (f.cast && f.mag > 0 && Math.random() < 0.35) {
      const spell = Magic[f.cast];
      const dmg = Math.max(1, Math.floor(f.mag * spell.power / 32 - target.def * 0.1));
      target.hp -= dmg;
      sfx.sfxMagic();
      this.say(`${f.name} casts ${spell.label}! ${dmg} to ${target.name}!`);
    } else {
      const dmg = Math.max(1, Math.floor(f.atk * (0.8 + Math.random() * 0.35) - target.def * 0.35));
      target.hp -= dmg;
      sfx.sfxHit();
      this.p.rumble(4, 6);
      this.say(`${f.name} attacks ${target.name}! ${dmg} dmg!`);
    }

    this.pending = null;
    this.checkEnd();
  }

  checkEnd() {
    const heroesUp = this.heroes.some(h => h.hp > 0);
    const foesUp = this.foes.some(f => f.hp > 0);

    if (!foesUp) {
      this.xpGain = this.foes.reduce((s, f) => s + f.xp, 0);
      this.coinGain = this.foes.reduce((s, f) => s + f.coin, 0);
      this.levels = [];

      for (const h of this.heroes) {
        if (h.hp <= 0) continue;
        h.xp += this.xpGain;
        while (h.xp >= h.xpNext) {
          h.xp -= h.xpNext;
          growHero(h);
          this.levels.push(h.name);
        }
      }

      sfx.sfxVictory();
      const lvl = this.levels.length ? ` Level up: ${this.levels.join(', ')}!` : '';
      this.log.push(`Victory! +${this.xpGain} XP, +${this.coinGain} GP.${lvl}`);
      this.mode = 'win';
      this.winT = 120;
      return true;
    }

    if (!heroesUp) {
      sfx.sfxDefeat();
      this.log.push('The party has fallen...');
      this.mode = 'lose';
      return true;
    }

    return false;
  }

  draw() {
    if (this.mode === 'intro') {
      this.p.encounterSplash();
      return;
    }

    this.p.battleBg(this.tick);
    this.p.battleFoes(this.foes, this.tick);
    this.p.battleHeroes(this.heroes);
    this.p.battleLog(this.log);

    if (this.mode === 'menu') {
      this.p.battleMenu(MAIN, this.menu, this.heroes[this.actor].name);
    }

    if (this.mode === 'sub' && this.subMode === 'magic') {
      const h = this.heroes[this.actor];
      const opts = h.skills.map(k => {
        const s = Magic[k];
        return `${s.label} (${s.cost} MP)`;
      });
      this.p.battleMenu(opts, this.sub, 'Magic');
    }

    if (this.mode === 'sub' && this.subMode === 'item') {
      const opts = this.itemKeys.map(k => `${Goods[k].label} x${this.bag[k]}`);
      this.p.battleMenu(opts, this.sub, 'Items');
    }

    if (this.mode === 'pick') {
      const label = this.pending?.kind === 'attack' ? 'Target' : 'Select';
      const opts =
        this.pending?.kind === 'attack' || (this.pending?.kind === 'magic' && Magic[this.pending.key]?.side === 'foe')
          ? this.foes.filter(f => f.hp > 0).map(f => f.name)
          : this.heroes.map(h => `${h.name} ${h.hp}/${h.maxHp}`);
      this.p.battleMenu(opts, this.pick, label);
    }

    if (this.mode === 'win') {
      this.p.panel(100, 170, 312, 90);
      this.p.label('VICTORY!', 256, 188, '#f8d878', 12, 'center');
      this.p.label(`+${this.xpGain} XP  +${this.coinGain} GP`, 256, 220, '#58d854', 7, 'center');
    }

    if (this.mode === 'lose') {
      this.p.panel(100, 170, 312, 90);
      this.p.label('DEFEATED', 256, 200, '#e85050', 12, 'center');
      this.p.label('Press ENTER', 256, 230, '#8888a8', 7, 'center');
    }

    this.p.paintFlash();
  }
}
