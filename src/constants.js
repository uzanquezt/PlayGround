export const TILE = 48;

export const GRAVITY = 2000;
export const MOVE_SPEED = 285;
export const JUMP_VELOCITY = 695;
export const DOUBLE_JUMP_VELOCITY = 620;
export const DASH_SPEED = 640;

export const ARMOR = [
  {
    id: 'bark',
    name: 'Barkbound Mail',
    cost: 10,
    hearts: 1,
    tag: 'Warden of the grove',
    desc: 'Living bark turns aside claws. Gain one extra heart.',
    colors: { plate: '#8a5a34', trim: '#d8a45f', cloth: '#4f6b3b', plume: '#c68a4a' }
  },
  {
    id: 'iron',
    name: 'Ironbark Plate',
    cost: 25,
    hearts: 2,
    tag: 'Forged in ember and iron',
    desc: 'Heavy plate beneath the bark. Gain two extra hearts.',
    colors: { plate: '#5d7387', trim: '#d9c07a', cloth: '#35445c', plume: '#7fd8d0' }
  },
  {
    id: 'aegis',
    name: 'Sporelight Aegis',
    cost: 45,
    hearts: 3,
    tag: 'Woven from living light',
    desc: 'Gain three extra hearts, a stronger blade, and a second midair leap.',
    colors: { plate: '#e8e2c8', trim: '#ffd76a', cloth: '#6f5ba8', plume: '#8ff7df' }
  }
];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const approach = (v, target, amount) => {
  if (v < target) return Math.min(v + amount, target);
  return Math.max(v - amount, target);
};

export const lerp = (a, b, t) => a + (b - a) * t;

export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
