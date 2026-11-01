import { TILE } from './constants.js';

function createBuilder(def) {
  const { width, height } = def;
  const grid = Array.from({ length: height }, () => new Array(width).fill('.'));
  const out = {
    pickups: [],
    enemies: [],
    checkpoints: [],
    forges: [],
    torches: [],
    door: null
  };

  const set = (tx, ty, ch) => {
    if (tx >= 0 && tx < width && ty >= 0 && ty < height) grid[ty][tx] = ch;
  };
  const cx = (tx) => (tx + 0.5) * TILE;
  const feet = (ty) => (ty + 1) * TILE;

  const g = {
    put: set,
    ground(tx1, tx2, top) {
      for (let x = tx1; x <= tx2; x++) for (let y = top; y < height; y++) set(x, y, '#');
    },
    block(tx1, tx2, ty1, ty2) {
      for (let x = tx1; x <= tx2; x++) for (let y = ty1; y <= ty2; y++) set(x, y, '#');
    },
    plat(tx1, tx2, ty) {
      for (let x = tx1; x <= tx2; x++) set(x, ty, '=');
    },
    spikes(tx1, tx2, ty) {
      for (let x = tx1; x <= tx2; x++) set(x, ty, '^');
    },
    mushroom(tx, ty, big = false) {
      out.pickups.push({ type: 'spore', x: cx(tx), y: (ty + 0.5) * TILE, value: big ? 3 : 1, big });
    },
    heart(tx, ty) {
      out.pickups.push({ type: 'heart', x: cx(tx), y: (ty + 0.5) * TILE, value: 1 });
    },
    enemy(type, tx, ty) {
      out.enemies.push({ type, x: cx(tx), y: feet(ty) });
    },
    checkpoint(tx, ty) {
      out.checkpoints.push({ x: cx(tx), y: feet(ty) });
    },
    forge(tx, ty) {
      out.forges.push({ x: cx(tx), y: feet(ty) });
    },
    torch(tx, ty) {
      out.torches.push({ x: cx(tx), y: (ty + 0.5) * TILE });
    },
    door(tx, ty) {
      out.door = { x: cx(tx), y: feet(ty) };
    }
  };
  return { grid, out, g };
}

export const LEVEL_DEFS = [
  {
    id: 'grove',
    name: 'Mossgrove',
    number: 'I',
    subtitle: 'Where the first spores fall',
    theme: 'forest',
    width: 118,
    height: 17,
    groundTop: 13,
    arena: { start: 90, end: 116, ground: 13 },
    boss: 'slimeKing',
    bossName: 'The Slime King',
    spawn: { tx: 3, ty: 12 },
    build(g) {
      g.ground(0, 14, 13);
      g.torch(2, 11);
      g.mushroom(5, 11);
      g.mushroom(7, 12);
      g.mushroom(12, 12);
      g.plat(8, 11, 11);
      g.mushroom(9, 10);
      g.mushroom(10, 10);
      g.enemy('slime', 10, 12);

      g.ground(18, 33, 13);
      g.spikes(20, 21, 12);
      g.plat(24, 27, 11);
      g.mushroom(25, 9);
      g.mushroom(22, 12);
      g.mushroom(31, 12);
      g.enemy('slime', 30, 12);

      g.ground(37, 52, 13);
      g.checkpoint(38, 12);
      g.torch(40, 11);
      g.spikes(41, 42, 12);
      g.enemy('beetle', 45, 12);
      g.mushroom(44, 12);
      g.plat(45, 48, 11);
      g.mushroom(46, 9);
      g.mushroom(47, 9);
      g.enemy('spitter', 50, 12);
      g.mushroom(48, 12);

      g.ground(56, 72, 13);
      g.ground(60, 66, 11);
      g.mushroom(61, 10);
      g.mushroom(63, 9);
      g.mushroom(65, 10);
      g.enemy('beetle', 58, 12);
      g.enemy('bat', 64, 8);
      g.plat(68, 71, 11);
      g.mushroom(69, 9);
      g.mushroom(70, 9);
      g.mushroom(57, 12);

      g.ground(76, 116, 13);
      g.forge(79, 12);
      g.torch(81, 11);
      g.mushroom(77, 12);
      g.mushroom(82, 12);
      g.checkpoint(85, 12);
      g.enemy('slime', 87, 12);
      g.plat(94, 97, 11);
      g.plat(106, 109, 11);
      g.mushroom(95, 9);
      g.mushroom(107, 9);
      g.heart(83, 12);
      g.door(114, 12);
    }
  },
  {
    id: 'caverns',
    name: 'Hollow Caverns',
    number: 'II',
    subtitle: 'Beneath the roots, something hums',
    theme: 'cavern',
    width: 126,
    height: 20,
    groundTop: 16,
    arena: { start: 92, end: 122, ground: 16 },
    boss: 'batQueen',
    bossName: 'The Bat Queen',
    spawn: { tx: 3, ty: 15 },
    build(g) {
      g.ground(0, 12, 16);
      g.torch(2, 14);
      g.mushroom(4, 15);
      g.mushroom(9, 14);
      g.plat(6, 9, 14);
      g.mushroom(7, 12);
      g.enemy('bat', 8, 11);

      g.ground(16, 30, 16);
      g.checkpoint(18, 15);
      g.torch(20, 14);
      g.enemy('beetle', 21, 15);
      g.spikes(23, 24, 15);
      g.plat(26, 29, 14);
      g.mushroom(27, 12);
      g.mushroom(28, 12);
      g.mushroom(23, 14);
      g.mushroom(29, 15);

      g.ground(34, 48, 16);
      g.ground(38, 44, 14);
      g.plat(35, 37, 12);
      g.mushroom(36, 10);
      g.enemy('bat', 36, 9);
      g.mushroom(39, 13);
      g.mushroom(42, 12);
      g.plat(45, 47, 14);
      g.mushroom(46, 12);
      g.enemy('bat', 46, 9);

      g.ground(52, 68, 16);
      g.checkpoint(54, 15);
      g.torch(56, 14);
      g.enemy('slime', 56, 15);
      g.plat(57, 59, 14);
      g.mushroom(58, 12);
      g.spikes(60, 62, 15);
      g.mushroom(61, 14);
      g.enemy('spitter', 65, 15);
      g.plat(66, 68, 14);
      g.mushroom(67, 12);
      g.heart(63, 14);

      g.ground(72, 88, 16);
      g.forge(74, 15);
      g.torch(76, 14);
      g.mushroom(73, 15);
      g.enemy('beetle', 78, 15);
      g.plat(80, 84, 14);
      g.mushroom(81, 12);
      g.mushroom(83, 12);
      g.enemy('bat', 82, 10);
      g.checkpoint(86, 15);

      g.ground(92, 122, 16);
      g.plat(98, 102, 14);
      g.plat(112, 116, 14);
      g.mushroom(99, 12);
      g.mushroom(113, 12);
      g.door(120, 15);
    }
  },
  {
    id: 'summit',
    name: 'Sporefall Summit',
    number: 'III',
    subtitle: 'The last light before the crown',
    theme: 'summit',
    width: 132,
    height: 18,
    groundTop: 14,
    arena: { start: 90, end: 128, ground: 14 },
    boss: 'mushroomMonarch',
    bossName: 'The Mushroom Monarch',
    spawn: { tx: 3, ty: 13 },
    build(g) {
      g.ground(0, 10, 14);
      g.torch(2, 12);
      g.mushroom(4, 13);
      g.plat(3, 6, 12);
      g.mushroom(4, 10);
      g.enemy('slime', 8, 13);

      g.ground(14, 28, 14);
      g.checkpoint(16, 13);
      g.torch(18, 12);
      g.plat(18, 21, 12);
      g.mushroom(19, 10);
      g.spikes(21, 22, 13);
      g.enemy('bat', 24, 9);
      g.enemy('beetle', 26, 13);
      g.plat(25, 27, 12);
      g.mushroom(26, 10);
      g.mushroom(23, 13);

      g.ground(32, 48, 14);
      g.ground(36, 42, 12);
      g.plat(33, 35, 10);
      g.mushroom(34, 9);
      g.mushroom(37, 11);
      g.mushroom(41, 10);
      g.enemy('bat', 40, 7);
      g.spikes(43, 44, 13);
      g.enemy('spitter', 46, 13);
      g.plat(46, 48, 12);
      g.mushroom(47, 10);

      g.ground(52, 66, 14);
      g.checkpoint(54, 13);
      g.enemy('beetle', 56, 13);
      g.spikes(57, 59, 13);
      g.plat(52, 55, 12);
      g.mushroom(53, 10);
      g.enemy('spitter', 63, 13);
      g.forge(64, 13);
      g.mushroom(65, 13);

      g.ground(70, 86, 14);
      g.plat(71, 74, 12);
      g.mushroom(72, 10);
      g.plat(75, 77, 10);
      g.plat(76, 79, 8);
      g.mushroom(78, 7);
      g.enemy('bat', 73, 8);
      g.enemy('beetle', 81, 13);
      g.spikes(83, 84, 13);
      g.checkpoint(85, 13);
      g.heart(75, 13);

      g.ground(90, 127, 14);
      g.plat(95, 99, 12);
      g.plat(108, 112, 12);
      g.mushroom(96, 10);
      g.mushroom(109, 10);
      g.door(125, 13);
    }
  }
];

export function buildLevel(index) {
  const def = LEVEL_DEFS[index];
  const built = createBuilder(def);
  def.build(built.g);

  const level = {
    ...def,
    grid: built.grid,
    widthPx: def.width * TILE,
    heightPx: def.height * TILE,
    spawn: { x: (def.spawn.tx + 0.5) * TILE, y: (def.spawn.ty + 1) * TILE },
    pickups: built.out.pickups,
    enemies: built.out.enemies,
    checkpoints: built.out.checkpoints.map((c, i) => ({ ...c, id: i, active: false })),
    forges: built.out.forges,
    torches: built.out.torches,
    door: built.out.door,
    arenaData: {
      x0: def.arena.start * TILE,
      x1: def.arena.end * TILE,
      groundY: def.arena.ground * TILE,
      w: (def.arena.end - def.arena.start) * TILE,
      triggerX: (def.arena.start + 1.5) * TILE
    },
    isSolid(tx, ty) {
      if (tx < 0 || tx >= def.width) return true;
      if (ty < 0 || ty >= def.height) return false;
      return this.grid[ty][tx] === '#';
    },
    isOneWay(tx, ty) {
      if (tx < 0 || tx >= def.width || ty < 0 || ty >= def.height) return false;
      return this.grid[ty][tx] === '=';
    },
    isHazard(tx, ty) {
      if (tx < 0 || tx >= def.width || ty < 0 || ty >= def.height) return false;
      return this.grid[ty][tx] === '^';
    },
    charAt(tx, ty) {
      if (ty < 0 || ty >= def.height || tx < 0 || tx >= def.width) return '.';
      return this.grid[ty][tx];
    }
  };
  return level;
}
