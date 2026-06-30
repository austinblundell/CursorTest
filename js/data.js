export const TILE = 16;
export const CANVAS_W = 512;
export const CANVAS_H = 448;

export const TILES = {
  GRASS: 0,
  WATER: 1,
  SAND: 2,
  FOREST: 3,
  MOUNTAIN: 4,
  TOWN_FLOOR: 5,
  WALL: 6,
  DOOR: 7,
  BRIDGE: 8,
  CAVE: 9,
  CRYSTAL: 10,
};

export const TILE_COLORS = {
  [TILES.GRASS]: ['#2d8a2d', '#3cb043', '#248024'],
  [TILES.WATER]: ['#1858a8', '#2878d8', '#104878'],
  [TILES.SAND]: ['#c8a848', '#d8c060', '#a88830'],
  [TILES.FOREST]: ['#1a5828', '#287838', '#0f3818'],
  [TILES.MOUNTAIN]: ['#686868', '#888888', '#484848'],
  [TILES.TOWN_FLOOR]: ['#a87848', '#c89860', '#886030'],
  [TILES.WALL]: ['#484848', '#686868', '#303030'],
  [TILES.DOOR]: ['#784818', '#986028', '#583010'],
  [TILES.BRIDGE]: ['#886838', '#a88850', '#685020'],
  [TILES.CAVE]: ['#383838', '#505050', '#282828'],
  [TILES.CRYSTAL]: ['#4848c8', '#6868f0', '#3030a0'],
};

export const PARTY = [
  {
    id: 'warrior',
    name: 'Cecil',
    class: 'Dark Knight',
    color: '#6868c8',
    accent: '#9898f0',
    hp: 120,
    maxHp: 120,
    mp: 10,
    maxMp: 10,
    atk: 18,
    def: 12,
    mag: 5,
    spd: 8,
    level: 1,
    exp: 0,
    expToNext: 30,
    spells: [],
  },
  {
    id: 'mage',
    name: 'Rydia',
    class: 'Summoner',
    color: '#48a848',
    accent: '#78d878',
    hp: 55,
    maxHp: 55,
    mp: 45,
    maxMp: 45,
    atk: 6,
    def: 5,
    mag: 22,
    spd: 10,
    level: 1,
    exp: 0,
    expToNext: 30,
    spells: ['fire', 'thunder', 'cure'],
  },
  {
    id: 'healer',
    name: 'Rosa',
    class: 'White Mage',
    color: '#f8f8f8',
    accent: '#f8d878',
    hp: 65,
    maxHp: 65,
    mp: 50,
    maxMp: 50,
    atk: 8,
    def: 6,
    mag: 18,
    spd: 9,
    level: 1,
    exp: 0,
    expToNext: 30,
    spells: ['cure', 'cure2', 'holy'],
  },
];

export const SPELLS = {
  fire: { name: 'Fire', mp: 5, power: 35, element: 'fire', target: 'enemy' },
  ice: { name: 'Blizzard', mp: 5, power: 35, element: 'ice', target: 'enemy' },
  thunder: { name: 'Thunder', mp: 5, power: 40, element: 'lightning', target: 'enemy' },
  cure: { name: 'Cure', mp: 4, power: 40, element: 'holy', target: 'ally' },
  cure2: { name: 'Cure II', mp: 12, power: 90, element: 'holy', target: 'ally' },
  holy: { name: 'Holy', mp: 20, power: 80, element: 'holy', target: 'enemy' },
  meteor: { name: 'Meteor', mp: 35, power: 120, element: 'fire', target: 'all-enemies' },
};

export const ITEMS = {
  potion: { name: 'Potion', heal: 50, desc: 'Restores 50 HP' },
  hiPotion: { name: 'Hi-Potion', heal: 150, desc: 'Restores 150 HP' },
  ether: { name: 'Ether', mp: 30, desc: 'Restores 30 MP' },
  phoenix: { name: 'Phoenix Down', revive: true, desc: 'Revives fallen ally' },
};

export const ENEMIES = {
  goblin: {
    name: 'Goblin',
    hp: 30,
    atk: 8,
    def: 3,
    mag: 0,
    spd: 6,
    exp: 12,
    gold: 8,
    color: '#48a848',
  },
  wolf: {
    name: 'Wolf',
    hp: 45,
    atk: 12,
    def: 4,
    mag: 0,
    spd: 10,
    exp: 18,
    gold: 12,
    color: '#888888',
  },
  skeleton: {
    name: 'Skeleton',
    hp: 55,
    atk: 14,
    def: 6,
    mag: 0,
    spd: 7,
    exp: 22,
    gold: 15,
    color: '#d8d8c8',
  },
  imp: {
    name: 'Imp',
    hp: 40,
    atk: 8,
    def: 5,
    mag: 15,
    spd: 9,
    exp: 25,
    gold: 20,
    color: '#c84848',
    spell: 'fire',
  },
  ogre: {
    name: 'Ogre',
    hp: 120,
    atk: 22,
    def: 10,
    mag: 0,
    spd: 5,
    exp: 45,
    gold: 35,
    color: '#785838',
  },
  darkKnight: {
    name: 'Dark Knight',
    hp: 180,
    atk: 28,
    def: 14,
    mag: 12,
    spd: 11,
    exp: 80,
    gold: 60,
    color: '#383868',
    spell: 'thunder',
  },
  dragon: {
    name: 'Shadow Dragon',
    hp: 500,
    atk: 35,
    def: 18,
    mag: 25,
    spd: 12,
    exp: 300,
    gold: 200,
    color: '#482848',
    spell: 'fire',
    boss: true,
  },
};

export const ENCOUNTER_TABLES = {
  grass: ['goblin', 'goblin', 'wolf', 'wolf', 'imp'],
  forest: ['wolf', 'wolf', 'skeleton', 'imp', 'ogre'],
  cave: ['skeleton', 'skeleton', 'imp', 'ogre', 'darkKnight'],
};

export const MAPS = {
  overworld: {
    name: 'Kingdom of Baron',
    width: 40,
    height: 30,
    encounterRate: 0.12,
    encounterZone: 'grass',
    spawn: { x: 20, y: 15 },
    tiles: null,
    npcs: [
      { x: 18, y: 14, name: 'Guard', dialog: ['Welcome, heroes!', 'The Shadow Dragon', 'threatens our realm.', 'Seek the crystal cave', 'to the northeast.'] },
      { x: 22, y: 16, name: 'Merchant', dialog: ['I sell potions!', 'Press A near me', 'to rest and shop.'], shop: true },
    ],
    warps: [
      { x: 28, y: 8, to: 'cave', spawnX: 5, spawnY: 12 },
      { x: 12, y: 20, to: 'town', spawnX: 7, spawnY: 9 },
    ],
  },
  town: {
    name: 'Baron Town',
    width: 16,
    height: 14,
    encounterRate: 0,
    spawn: { x: 7, y: 9 },
    tiles: null,
    npcs: [
      { x: 5, y: 5, name: 'Innkeeper', dialog: ['Rest here for 10 GP?', 'Your party will', 'be fully healed.'], inn: true },
      { x: 10, y: 5, name: 'Shopkeeper', dialog: ['Welcome to my shop!'], shop: true },
      { x: 7, y: 3, name: 'Elder', dialog: ['The crystal of light', 'has been stolen.', 'Only you can stop', 'the Shadow Dragon.'] },
    ],
    warps: [
      { x: 7, y: 12, to: 'overworld', spawnX: 12, spawnY: 21 },
    ],
  },
  cave: {
    name: 'Crystal Cave',
    width: 20,
    height: 16,
    encounterRate: 0.18,
    encounterZone: 'cave',
    spawn: { x: 5, y: 12 },
    tiles: null,
    npcs: [],
    warps: [
      { x: 5, y: 13, to: 'overworld', spawnX: 28, spawnY: 9 },
    ],
    boss: { x: 15, y: 3, enemy: 'dragon', defeated: false },
  },
};

export function generateMapTiles(mapId) {
  const map = MAPS[mapId];
  const tiles = [];

  for (let y = 0; y < map.height; y++) {
    const row = [];
    for (let x = 0; x < map.width; x++) {
      row.push(generateTile(mapId, x, y, map));
    }
    tiles.push(row);
  }

  map.tiles = tiles;
  return tiles;
}

function generateTile(mapId, x, y, map) {
  if (mapId === 'overworld') return generateOverworldTile(x, y, map);
  if (mapId === 'town') return generateTownTile(x, y, map);
  if (mapId === 'cave') return generateCaveTile(x, y, map);
  return TILES.GRASS;
}

function generateOverworldTile(x, y, map) {
  const cx = map.width / 2;
  const cy = map.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
    return TILES.WATER;
  }

  if (dist > 14) return TILES.MOUNTAIN;
  if (dist > 12 && ((x * 7 + y * 13) % 3 === 0)) return TILES.FOREST;

  if (x >= 10 && x <= 14 && y >= 18 && y <= 22) return TILES.TOWN_FLOOR;
  if (x >= 26 && x <= 30 && y >= 6 && y <= 10) return TILES.CAVE;

  if ((x === 28 && y >= 7 && y <= 9) || (y === 8 && x >= 27 && x <= 29)) {
    return TILES.BRIDGE;
  }

  const noise = Math.sin(x * 0.7) * Math.cos(y * 0.5);
  if (noise > 0.6) return TILES.FOREST;
  if (noise < -0.7) return TILES.SAND;

  return TILES.GRASS;
}

function generateTownTile(x, y, map) {
  if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
    return TILES.WALL;
  }
  if (y === 3 && x >= 6 && x <= 8) return TILES.DOOR;
  if (y === 12 && x >= 6 && x <= 8) return TILES.DOOR;
  return TILES.TOWN_FLOOR;
}

function generateCaveTile(x, y, map) {
  if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
    return TILES.WALL;
  }
  if (y >= 12 && x >= 4 && x <= 6) return TILES.DOOR;
  if (x === 15 && y === 3) return TILES.CRYSTAL;

  const noise = Math.sin(x * 1.2 + y * 0.8) * Math.cos(y * 1.1);
  if (noise > 0.3) return TILES.CAVE;
  if (noise < -0.5) return TILES.WATER;
  return TILES.CAVE;
}

export function cloneParty() {
  return PARTY.map(m => ({
    ...m,
    spells: [...m.spells],
  }));
}

export function cloneEnemy(key) {
  const e = ENEMIES[key];
  return {
    key,
    ...e,
    maxHp: e.hp,
    currentHp: e.hp,
  };
}

export function expForLevel(level) {
  return Math.floor(30 * Math.pow(1.4, level - 1));
}

export function levelUp(member) {
  member.level++;
  member.maxHp += Math.floor(8 + member.level * 2);
  member.maxMp += Math.floor(3 + member.level);
  member.atk += Math.floor(2 + member.level * 0.5);
  member.def += Math.floor(1 + member.level * 0.3);
  member.mag += Math.floor(1 + member.level * 0.4);
  member.spd += 1;
  member.hp = member.maxHp;
  member.mp = member.maxMp;
  member.expToNext = expForLevel(member.level);

  if (member.level === 3 && member.id === 'warrior') member.spells.push('holy');
  if (member.level === 4 && member.id === 'mage') member.spells.push('ice');
  if (member.level === 5 && member.id === 'mage') member.spells.push('meteor');
}
