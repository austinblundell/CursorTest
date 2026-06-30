import { SPELLS, ITEMS, cloneEnemy, levelUp, CANVAS_W, CANVAS_H } from './data.js';
import { isPressed, clearJustPressed } from './input.js';
import * as audio from './audio.js';

export class BattleSystem {
  constructor(renderer, onEnd) {
    this.renderer = renderer;
    this.onEnd = onEnd;
    this.reset();
  }

  reset() {
    this.party = [];
    this.enemies = [];
    this.phase = 'intro';
    this.menuIndex = 0;
    this.subMenuIndex = 0;
    this.activeMember = 0;
    this.messages = [];
    this.messageTimer = 0;
    this.frame = 0;
    this.turnQueue = [];
    this.currentActor = null;
    this.pendingAction = null;
    this.targetIndex = 0;
    this.subMenu = null;
    this.inventory = {};
    this.gold = 0;
    this.expGained = 0;
    this.goldGained = 0;
    this.levelUps = [];
    this.introTimer = 0;
    this.victoryTimer = 0;
    this.animTimer = 0;
    this.canFlee = true;
  }

  start(party, enemyKeys, inventory, gold, canFlee = true) {
    this.reset();
    this.party = party.map(m => ({ ...m, isDead: m.hp <= 0 }));
    this.enemies = enemyKeys.map(k => cloneEnemy(k));
    this.inventory = { ...inventory };
    this.gold = gold;
    this.canFlee = canFlee;
    this.phase = 'intro';
    this.introTimer = 60;
    audio.playEncounter();
  }

  update() {
    this.frame++;

    if (this.phase === 'intro') {
      this.introTimer--;
      if (this.introTimer <= 0) {
        this.phase = 'menu';
        this.buildTurnQueue();
        this.nextTurn();
      }
      return;
    }

    if (this.phase === 'message') {
      this.messageTimer--;
      if (this.messageTimer <= 0) {
        if (this.messages.length > 0) {
          this.showNextMessage();
        } else {
          this.afterMessages();
        }
      }
      if (isPressed('Enter')) {
        this.messageTimer = 0;
      }
      clearJustPressed();
      return;
    }

    if (this.phase === 'animating') {
      this.animTimer--;
      if (this.animTimer <= 0) {
        this.resolveAction();
      }
      return;
    }

    if (this.phase === 'menu') {
      this.handleMenuInput();
      return;
    }

    if (this.phase === 'submenu') {
      this.handleSubMenuInput();
      return;
    }

    if (this.phase === 'target') {
      this.handleTargetInput();
      return;
    }

    if (this.phase === 'victory') {
      this.victoryTimer--;
      if (this.victoryTimer <= 0 || isPressed('Enter')) {
        this.onEnd({
          victory: true,
          party: this.party,
          inventory: this.inventory,
          gold: this.gold + this.goldGained,
          expGained: this.expGained,
          levelUps: this.levelUps,
        });
      }
      clearJustPressed();
      return;
    }

    if (this.phase === 'defeat') {
      if (isPressed('Enter')) {
        this.onEnd({ victory: false, party: this.party });
      }
      clearJustPressed();
    }
  }

  buildTurnQueue() {
    const actors = [];
    this.party.forEach((m, i) => {
      if (!m.isDead) actors.push({ type: 'party', index: i, spd: m.spd + Math.random() * 3 });
    });
    this.enemies.forEach((e, i) => {
      if (e.currentHp > 0) actors.push({ type: 'enemy', index: i, spd: e.spd + Math.random() * 3 });
    });
    actors.sort((a, b) => b.spd - a.spd);
    this.turnQueue = actors;
  }

  nextTurn() {
    if (this.checkBattleEnd()) return;

    if (this.turnQueue.length === 0) {
      this.buildTurnQueue();
    }

    this.currentActor = this.turnQueue.shift();

    if (this.currentActor.type === 'party') {
      const member = this.party[this.currentActor.index];
      if (member.isDead) {
        this.nextTurn();
        return;
      }
      this.activeMember = this.currentActor.index;
      this.phase = 'menu';
      this.menuIndex = 0;
    } else {
      this.enemyTurn(this.currentActor.index);
    }
  }

  enemyTurn(index) {
    const enemy = this.enemies[index];
    const aliveParty = this.party.filter(m => !m.isDead);
    if (aliveParty.length === 0) return;

    this.phase = 'animating';
    this.animTimer = 30;

    if (enemy.spell && Math.random() < 0.4) {
      const spell = SPELLS[enemy.spell];
      const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
      const dmg = Math.max(1, Math.floor(spell.power + enemy.mag * 0.8 - target.def * 0.3));
      this.pendingAction = {
        type: 'magic',
        source: enemy,
        target,
        spell,
        damage: dmg,
      };
      this.queueMessage(`${enemy.name} casts ${spell.name}!`);
    } else {
      const target = aliveParty[Math.floor(Math.random() * aliveParty.length)];
      const dmg = Math.max(1, Math.floor(enemy.atk * 1.2 - target.def * 0.5));
      this.pendingAction = {
        type: 'attack',
        source: enemy,
        target,
        damage: dmg,
      };
      this.queueMessage(`${enemy.name} attacks ${target.name}!`);
    }
  }

  handleMenuInput() {
    const menus = ['Attack', 'Magic', 'Item', this.canFlee ? 'Run' : 'Defend'];
    if (isPressed('ArrowUp')) { this.menuIndex = (this.menuIndex - 1 + menus.length) % menus.length; audio.playCursor(); }
    if (isPressed('ArrowDown')) { this.menuIndex = (this.menuIndex + 1) % menus.length; audio.playCursor(); }

    if (isPressed('Enter')) {
      audio.playConfirm();
      const choice = menus[this.menuIndex];
      if (choice === 'Attack') {
        this.subMenu = 'enemy-target';
        this.targetIndex = 0;
        this.phase = 'target';
      } else if (choice === 'Magic') {
        const member = this.party[this.activeMember];
        if (member.spells.length === 0) {
          this.queueMessage(`${member.name} has no magic!`);
          this.phase = 'message';
          this.messageTimer = 60;
        } else {
          this.subMenu = 'magic';
          this.subMenuIndex = 0;
          this.phase = 'submenu';
        }
      } else if (choice === 'Item') {
        const itemKeys = Object.keys(this.inventory).filter(k => this.inventory[k] > 0);
        if (itemKeys.length === 0) {
          this.queueMessage('No items!');
          this.phase = 'message';
          this.messageTimer = 60;
        } else {
          this.subMenu = 'item';
          this.subMenuIndex = 0;
          this.phase = 'submenu';
        }
      } else if (choice === 'Run') {
        if (Math.random() < 0.6) {
          this.queueMessage('Escaped safely!');
          this.phase = 'message';
          this.messageTimer = 60;
          this.pendingAction = { type: 'flee' };
        } else {
          this.queueMessage("Can't escape!");
          this.phase = 'message';
          this.messageTimer = 60;
          this.pendingAction = { type: 'skip' };
        }
      } else {
        this.pendingAction = { type: 'defend', target: this.party[this.activeMember] };
        this.queueMessage(`${this.party[this.activeMember].name} defends!`);
        this.phase = 'animating';
        this.animTimer = 20;
      }
    }
    clearJustPressed();
  }

  handleSubMenuInput() {
    const member = this.party[this.activeMember];

    if (this.subMenu === 'magic') {
      const spells = member.spells;
      if (isPressed('ArrowUp')) { this.subMenuIndex = (this.subMenuIndex - 1 + spells.length) % spells.length; audio.playCursor(); }
      if (isPressed('ArrowDown')) { this.subMenuIndex = (this.subMenuIndex + 1) % spells.length; audio.playCursor(); }

      if (isPressed('Enter')) {
        const spellKey = spells[this.subMenuIndex];
        const spell = SPELLS[spellKey];
        if (member.mp < spell.mp) {
          this.queueMessage('Not enough MP!');
          this.phase = 'message';
          this.messageTimer = 60;
        } else {
          audio.playConfirm();
          this.pendingAction = { type: 'magic', spellKey, spell, caster: member };
          if (spell.target === 'ally') {
            this.subMenu = 'ally-target';
            this.targetIndex = 0;
            this.phase = 'target';
          } else {
            this.subMenu = 'enemy-target';
            this.targetIndex = 0;
            this.phase = 'target';
          }
        }
      }
    }

    if (this.subMenu === 'item') {
      const itemKeys = Object.keys(this.inventory).filter(k => this.inventory[k] > 0);
      if (isPressed('ArrowUp')) { this.subMenuIndex = (this.subMenuIndex - 1 + itemKeys.length) % itemKeys.length; audio.playCursor(); }
      if (isPressed('ArrowDown')) { this.subMenuIndex = (this.subMenuIndex + 1) % itemKeys.length; audio.playCursor(); }

      if (isPressed('Enter')) {
        audio.playConfirm();
        const itemKey = itemKeys[this.subMenuIndex];
        this.pendingAction = { type: 'item', itemKey, item: ITEMS[itemKey] };
        this.subMenu = 'ally-target';
        this.targetIndex = 0;
        this.phase = 'target';
      }
    }

    if (isPressed('Cancel')) {
      audio.playCancel();
      this.phase = 'menu';
    }
    clearJustPressed();
  }

  handleTargetInput() {
    const isEnemy = this.subMenu === 'enemy-target';
    const targets = isEnemy
      ? this.enemies.filter(e => e.currentHp > 0)
      : this.party.filter(m => !m.isDead || (this.pendingAction?.item?.revive));

    if (targets.length === 0) {
      this.phase = 'menu';
      return;
    }

    if (isPressed('ArrowUp')) { this.targetIndex = (this.targetIndex - 1 + targets.length) % targets.length; audio.playCursor(); }
    if (isPressed('ArrowDown')) { this.targetIndex = (this.targetIndex + 1) % targets.length; audio.playCursor(); }

    if (isPressed('Enter')) {
      audio.playConfirm();
      this.pendingAction.target = targets[this.targetIndex];
      this.pendingAction.targetIndex = this.enemies.indexOf(targets[this.targetIndex]);
      this.phase = 'animating';
      this.animTimer = 25;

      const member = this.party[this.activeMember];
      if (this.pendingAction.type === 'magic') {
        this.queueMessage(`${member.name} casts ${this.pendingAction.spell.name}!`);
      } else if (this.pendingAction.type === 'item') {
        this.queueMessage(`${member.name} uses ${this.pendingAction.item.name}!`);
      } else {
        this.queueMessage(`${member.name} attacks!`);
      }
    }

    if (isPressed('Cancel')) {
      audio.playCancel();
      this.phase = this.pendingAction?.type === 'magic' || this.pendingAction?.type === 'item' ? 'submenu' : 'menu';
    }
    clearJustPressed();
  }

  resolveAction() {
    const action = this.pendingAction;
    this.pendingAction = null;

    if (action?.type === 'flee') {
      this.onEnd({ fled: true, party: this.party, inventory: this.inventory, gold: this.gold });
      return;
    }

    if (action?.type === 'skip') {
      this.phase = 'message';
      this.messageTimer = 60;
      return;
    }

    if (action?.type === 'attack') {
      audio.playAttack();
      const dmg = action.damage ?? this.calcPhysical(this.party[this.activeMember], action.target);
      this.applyDamage(action.target, dmg, action.target.currentHp !== undefined);
      this.renderer.shake(3, 8);
      audio.playHit();
    }

    if (action?.type === 'magic') {
      audio.playMagic();
      const caster = action.caster || action.source;
      if (action.caster) caster.mp -= action.spell.mp;

      if (action.spell.target === 'ally') {
        const heal = action.spell.power + caster.mag;
        action.target.hp = Math.min(action.target.maxHp, action.target.hp + heal);
        action.target.isDead = false;
        audio.playHeal();
        this.queueMessage(`${action.target.name} recovered ${heal} HP!`);
      } else if (action.spell.target === 'all-enemies') {
        this.enemies.forEach(e => {
          if (e.currentHp > 0) {
            const dmg = Math.max(1, Math.floor(action.spell.power + caster.mag - e.def * 0.3));
            e.currentHp = Math.max(0, e.currentHp - dmg);
          }
        });
        this.renderer.shake(5, 12);
        this.queueMessage(`Dealt massive damage!`);
      } else {
        const dmg = action.damage ?? Math.max(1, Math.floor(action.spell.power + caster.mag - (action.target.def || 0) * 0.3));
        this.applyDamage(action.target, dmg, action.target.currentHp !== undefined);
        this.renderer.shake(4, 10);
      }
    }

    if (action?.type === 'item') {
      const item = action.item;
      this.inventory[action.itemKey]--;
      if (item.heal) {
        action.target.hp = Math.min(action.target.maxHp, action.target.hp + item.heal);
        action.target.isDead = false;
        audio.playHeal();
        this.queueMessage(`${action.target.name} recovered ${item.heal} HP!`);
      } else if (item.mp) {
        action.target.mp = Math.min(action.target.maxMp, action.target.mp + item.mp);
        this.queueMessage(`${action.target.name} recovered ${item.mp} MP!`);
      } else if (item.revive) {
        action.target.hp = Math.floor(action.target.maxHp * 0.3);
        action.target.isDead = false;
        this.queueMessage(`${action.target.name} was revived!`);
      }
    }

    this.phase = 'message';
    this.messageTimer = 60;
  }

  calcPhysical(attacker, defender) {
    const atk = attacker.atk || 0;
    const def = defender.def || 0;
    return Math.max(1, Math.floor(atk * 1.3 - def * 0.5 + Math.random() * 4));
  }

  applyDamage(target, dmg, isEnemy) {
    if (isEnemy) {
      target.currentHp = Math.max(0, target.currentHp - dmg);
      this.queueMessage(`${target.name} took ${dmg} damage!`);
      if (target.currentHp <= 0) {
        this.queueMessage(`${target.name} was defeated!`);
      }
    } else {
      target.hp = Math.max(0, target.hp - dmg);
      this.queueMessage(`${target.name} took ${dmg} damage!`);
      if (target.hp <= 0) {
        target.isDead = true;
        this.queueMessage(`${target.name} was KO'd!`);
      }
    }
  }

  afterMessages() {
    if (this.checkBattleEnd()) return;
    this.nextTurn();
  }

  checkBattleEnd() {
    const allEnemiesDead = this.enemies.every(e => e.currentHp <= 0);
    const allPartyDead = this.party.every(m => m.isDead);

    if (allEnemiesDead) {
      this.startVictory();
      return true;
    }

    if (allPartyDead) {
      this.phase = 'defeat';
      audio.playDefeat();
      return true;
    }

    return false;
  }

  startVictory() {
    this.phase = 'victory';
    this.victoryTimer = 180;
    audio.playVictory();

    this.expGained = this.enemies.reduce((s, e) => s + e.exp, 0);
    this.goldGained = this.enemies.reduce((s, e) => s + e.gold, 0);

    this.party.forEach(m => {
      if (!m.isDead) {
        m.exp += this.expGained;
        while (m.exp >= m.expToNext) {
          m.exp -= m.expToNext;
          levelUp(m);
          this.levelUps.push(m.name);
          audio.playLevelUp();
        }
      }
    });
  }

  queueMessage(msg) {
    this.messages.push(msg);
    if (this.phase !== 'message') {
      this.showNextMessage();
      this.phase = 'message';
    }
  }

  showNextMessage() {
    if (this.messages.length > 0) {
      this.currentMessage = this.messages.shift();
      this.messageTimer = 50;
    }
  }

  draw() {
    const r = this.renderer;
    r.drawBattleBackground(this.frame);

    this.enemies.forEach((e, i) => {
      if (e.currentHp > 0) {
        const ex = 80 + i * 140;
        const ey = 60 + (e.boss ? 0 : 20);
        r.drawEnemySprite(e, ex, ey, this.frame);
        r.drawHPBar(ex, ey + 70, 64, e.currentHp, e.maxHp, e.name);
      }
    });

    r.drawWindow(0, CANVAS_H - 180, CANVAS_W, 180);

    const menus = ['Attack', 'Magic', 'Item', this.canFlee ? 'Run' : 'Defend'];
    if (this.phase === 'menu' || this.phase === 'submenu' || this.phase === 'target') {
      r.drawMenu(menus, 20, CANVAS_H - 168, 120, this.menuIndex);
    }

    if (this.phase === 'submenu' && this.subMenu === 'magic') {
      const member = this.party[this.activeMember];
      const spellItems = member.spells.map(k => `${SPELLS[k].name} (${SPELLS[k].mp})`);
      r.drawMenu(spellItems, 150, CANVAS_H - 168, 160, this.subMenuIndex);
    }

    if (this.phase === 'submenu' && this.subMenu === 'item') {
      const itemKeys = Object.keys(this.inventory).filter(k => this.inventory[k] > 0);
      const itemItems = itemKeys.map(k => `${ITEMS[k].name} x${this.inventory[k]}`);
      r.drawMenu(itemItems, 150, CANVAS_H - 168, 180, this.subMenuIndex);
    }

    this.party.forEach((m, i) => {
      const px = 320 + (i % 2) * 90;
      const py = CANVAS_H - 160 + Math.floor(i / 2) * 50;
      if (i === this.activeMember && this.phase === 'menu') {
        r.drawText('▶', px - 12, py, '#f8d878', 8);
      }
      r.drawText(m.name, px, py, m.isDead ? '#686868' : '#f8f8f8', 7);
      r.drawHPBar(px, py + 14, 80, m.hp, m.maxHp);
      if (m.maxMp > 0) r.drawMPBar(px, py + 28, 80, m.mp, m.maxMp);
    });

    if (this.phase === 'intro') {
      r.drawText('ENCOUNTER!', CANVAS_W / 2, 20, '#f84848', 12, 'center');
    }

    if (this.phase === 'message' && this.currentMessage) {
      r.drawWindow(40, 20, CANVAS_W - 80, 48);
      r.drawText(this.currentMessage, 52, 32, '#f8f8f8', 8);
    }

    if (this.phase === 'victory') {
      r.drawWindow(80, 100, CANVAS_W - 160, 160);
      r.drawText('VICTORY!', CANVAS_W / 2, 116, '#f8d878', 12, 'center');
      r.drawText(`EXP +${this.expGained}`, CANVAS_W / 2, 148, '#f8f8f8', 8, 'center');
      r.drawText(`GP +${this.goldGained}`, CANVAS_W / 2, 168, '#f8d878', 8, 'center');
      if (this.levelUps.length > 0) {
        r.drawText(`${this.levelUps.join(', ')} level up!`, CANVAS_W / 2, 200, '#58d854', 7, 'center');
      }
      r.drawText('Press ENTER', CANVAS_W / 2, 240, '#9898f0', 7, 'center');
    }

    if (this.phase === 'defeat') {
      r.drawWindow(100, 140, CANVAS_W - 200, 80);
      r.drawText('DEFEATED...', CANVAS_W / 2, 160, '#e85050', 12, 'center');
      r.drawText('Press ENTER', CANVAS_W / 2, 190, '#9898f0', 7, 'center');
    }

    r.drawFlash();
  }
}
