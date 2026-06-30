export const W = 512;
export const H = 448;
export const T = 16;

export const Tile = {
  GRASS: 0,
  WATER: 1,
  SAND: 2,
  WOODS: 3,
  ROCK: 4,
  PATH: 5,
  WALL: 6,
  GATE: 7,
  BRIDGE: 8,
  DARK: 9,
  STAR: 10,
};

export const TilePalette = {
  [Tile.GRASS]: ['#2a7a2a', '#3cb043', '#1e601e'],
  [Tile.WATER]: ['#1458a0', '#2878d0', '#0c3868'],
  [Tile.SAND]: ['#c09840', '#d8b858', '#987028'],
  [Tile.WOODS]: ['#184828', '#287038', '#0c3018'],
  [Tile.ROCK]: ['#606060', '#808080', '#404040'],
  [Tile.PATH]: ['#987048', '#b89058', '#705030'],
  [Tile.WALL]: ['#404040', '#606060', '#282828'],
  [Tile.GATE]: ['#684018', '#885028', '#482810'],
  [Tile.BRIDGE]: ['#806030', '#a08048', '#604020'],
  [Tile.DARK]: ['#303030', '#484848', '#202020'],
  [Tile.STAR]: ['#4040b0', '#6868f0', '#2828a0'],
};

export const Heroes = [
  {
    id: 'knight',
    name: 'Garrik',
    role: 'Knight',
    tint: '#6870c8',
    glow: '#98a0f0',
    hp: 130,
    maxHp: 130,
    mp: 8,
    maxMp: 8,
    atk: 20,
    def: 14,
    mag: 4,
    spd: 7,
    lvl: 1,
    xp: 0,
    xpNext: 28,
    skills: [],
  },
  {
    id: 'mage',
    name: 'Selene',
    role: 'Arcanist',
    tint: '#8848b8',
    glow: '#b878e8',
    hp: 52,
    maxHp: 52,
    mp: 48,
    maxMp: 48,
    atk: 6,
    def: 4,
    mag: 24,
    spd: 11,
    lvl: 1,
    xp: 0,
    xpNext: 28,
    skills: ['ember', 'frost', 'volt'],
  },
  {
    id: 'cleric',
    name: 'Elara',
    role: 'Cleric',
    tint: '#f0f0f0',
    glow: '#f8d878',
    hp: 68,
    maxHp: 68,
    mp: 52,
    maxMp: 52,
    atk: 7,
    def: 6,
    mag: 19,
    spd: 9,
    lvl: 1,
    xp: 0,
    xpNext: 28,
    skills: ['mend', 'mend2', 'radiance'],
  },
];

export const Magic = {
  ember: { label: 'Ember', cost: 5, power: 38, kind: 'fire', side: 'foe' },
  frost: { label: 'Frost', cost: 5, power: 38, kind: 'ice', side: 'foe' },
  volt: { label: 'Volt', cost: 6, power: 42, kind: 'bolt', side: 'foe' },
  mend: { label: 'Mend', cost: 4, power: 45, kind: 'holy', side: 'ally' },
  mend2: { label: 'Mend II', cost: 11, power: 95, kind: 'holy', side: 'ally' },
  radiance: { label: 'Radiance', cost: 18, power: 85, kind: 'holy', side: 'foe' },
  nova: { label: 'Nova', cost: 32, power: 125, kind: 'fire', side: 'all-foes' },
};

export const Goods = {
  tonic: { label: 'Tonic', heal: 55, blurb: 'Restores 55 HP' },
  elixir: { label: 'Elixir', heal: 160, blurb: 'Restores 160 HP' },
  mist: { label: 'Mist', mp: 35, blurb: 'Restores 35 MP' },
  feather: { label: 'Phoenix Feather', revive: true, blurb: 'Revives ally' },
};

export const Foes = {
  slime: { name: 'Slime', hp: 28, atk: 7, def: 2, mag: 0, spd: 4, xp: 10, coin: 6, hue: '#48c848' },
  bat: { name: 'Bat', hp: 38, atk: 11, def: 3, mag: 0, spd: 12, xp: 14, coin: 9, hue: '#686868' },
  bandit: { name: 'Bandit', hp: 52, atk: 15, def: 5, mag: 0, spd: 8, xp: 20, coin: 14, hue: '#a06030' },
  wraith: { name: 'Wraith', hp: 48, atk: 9, def: 6, mag: 16, spd: 10, xp: 24, coin: 18, hue: '#6868a8', cast: 'ember' },
  golem: { name: 'Golem', hp: 110, atk: 20, def: 12, mag: 0, spd: 4, xp: 42, coin: 32, hue: '#787060' },
  sentinel: { name: 'Sentinel', hp: 165, atk: 26, def: 15, mag: 14, spd: 9, xp: 70, coin: 55, hue: '#384878', cast: 'volt' },
  devourer: {
    name: 'Star Devourer',
    hp: 520,
    atk: 34,
    def: 17,
    mag: 28,
    spd: 11,
    xp: 320,
    coin: 250,
    hue: '#502060',
    cast: 'ember',
    boss: true,
  },
};

export const Zones = {
  fields: ['slime', 'slime', 'bat', 'bat', 'bandit'],
  woods: ['bat', 'bandit', 'wraith', 'wraith', 'golem'],
  spire: ['wraith', 'golem', 'sentinel', 'sentinel', 'golem'],
};

export const WorldMaps = {
  fields: {
    label: 'Aldoria Fields',
    cols: 38,
    rows: 28,
    roam: 0.11,
    zone: 'fields',
    start: { x: 19, y: 14 },
    folk: [
      {
        x: 17,
        y: 13,
        tag: 'Scout',
        lines: ['The Star Crystal fades.', 'Millhaven lies south.', 'The Spire towers east.'],
      },
      {
        x: 21,
        y: 15,
        tag: 'Traveler',
        lines: ['Need supplies?', 'Talk to me to shop.'],
        vendor: true,
      },
    ],
    doors: [
      { x: 19, y: 22, map: 'village', sx: 8, sy: 10 },
      { x: 32, y: 6, map: 'spire', sx: 4, sy: 13 },
    ],
  },
  village: {
    label: 'Millhaven',
    cols: 18,
    rows: 14,
    roam: 0,
    start: { x: 8, y: 10 },
    folk: [
      {
        x: 6,
        y: 5,
        tag: 'Innkeeper',
        lines: ['Rest for 12 GP?', 'Full recovery awaits.'],
        lodge: true,
      },
      { x: 11, y: 5, tag: 'Merchant', lines: ['Welcome!'], vendor: true },
      {
        x: 8,
        y: 3,
        tag: 'Elder',
        lines: ['The Star Devourer', 'feeds on our crystal.', 'End this in the Spire.'],
      },
    ],
    doors: [{ x: 8, y: 12, map: 'fields', sx: 19, sy: 23 }],
  },
  spire: {
    label: 'Obsidian Spire',
    cols: 22,
    rows: 16,
    roam: 0.17,
    zone: 'spire',
    start: { x: 4, y: 13 },
    folk: [],
    doors: [{ x: 4, y: 14, map: 'fields', sx: 32, sy: 7 }],
    throne: { x: 17, y: 3, foe: 'devourer', beaten: false },
  },
};

export function freshHeroes() {
  return Heroes.map(h => ({ ...h, skills: [...h.skills] }));
}

export function spawnFoe(key) {
  const f = Foes[key];
  return { key, ...f, maxHp: f.hp, hp: f.hp };
}

export function xpThreshold(lvl) {
  return Math.floor(28 * Math.pow(1.38, lvl - 1));
}

export function growHero(h) {
  h.lvl++;
  h.maxHp += Math.floor(9 + h.lvl * 2);
  h.maxMp += Math.floor(3 + h.lvl);
  h.atk += Math.floor(2 + h.lvl * 0.5);
  h.def += Math.floor(1 + h.lvl * 0.35);
  h.mag += Math.floor(1 + h.lvl * 0.45);
  h.spd += 1;
  h.hp = h.maxHp;
  h.mp = h.maxMp;
  h.xpNext = xpThreshold(h.lvl);

  if (h.lvl === 3 && h.id === 'knight') h.skills.push('radiance');
  if (h.lvl === 4 && h.id === 'mage') h.skills.push('frost');
  if (h.lvl === 5 && h.id === 'mage') h.skills.push('nova');
}

export function bakeMap(id) {
  const m = WorldMaps[id];
  const grid = [];
  for (let y = 0; y < m.rows; y++) {
    const row = [];
    for (let x = 0; x < m.cols; x++) row.push(pickTile(id, x, y, m));
    grid.push(row);
  }
  m.grid = grid;
  return grid;
}

function pickTile(id, x, y, m) {
  if (id === 'fields') return fieldTile(x, y, m);
  if (id === 'village') return townTile(x, y, m);
  if (id === 'spire') return spireTile(x, y, m);
  return Tile.GRASS;
}

function fieldTile(x, y, m) {
  if (x === 0 || y === 0 || x === m.cols - 1 || y === m.rows - 1) return Tile.WATER;

  const cx = m.cols / 2;
  const cy = m.rows / 2;
  const d = Math.hypot(x - cx, y - cy);

  if (d > 13) return Tile.ROCK;
  if (d > 11 && (x * 5 + y * 11) % 4 === 0) return Tile.WOODS;

  if (x >= 16 && x <= 22 && y >= 20 && y <= 24) return Tile.PATH;
  if (x >= 30 && x <= 34 && y >= 4 && y <= 8) return Tile.DARK;

  if ((x === 32 && y >= 5 && y <= 7) || (y === 6 && x >= 31 && x <= 33)) return Tile.BRIDGE;

  const n = Math.sin(x * 0.65) * Math.cos(y * 0.55);
  if (n > 0.55) return Tile.WOODS;
  if (n < -0.65) return Tile.SAND;
  return Tile.GRASS;
}

function townTile(x, y, m) {
  if (x === 0 || y === 0 || x === m.cols - 1 || y === m.rows - 1) return Tile.WALL;
  if (y === 3 && x >= 7 && x <= 9) return Tile.GATE;
  if (y === 12 && x >= 7 && x <= 9) return Tile.GATE;
  return Tile.PATH;
}

function spireTile(x, y, m) {
  if (x === 0 || y === 0 || x === m.cols - 1 || y === m.rows - 1) return Tile.WALL;
  if (y >= 12 && x >= 3 && x <= 5) return Tile.GATE;
  if (x === 17 && y === 3) return Tile.STAR;

  const n = Math.sin(x * 1.1 + y * 0.9) * Math.cos(y * 1.05);
  if (n > 0.25) return Tile.DARK;
  if (n < -0.45) return Tile.WATER;
  return Tile.DARK;
}
