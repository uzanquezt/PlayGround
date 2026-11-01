import { mulberry32 } from './constants.js';

const MAX_PARTICLES = 800;

export function addParticle(game, p) {
  if (game.particles.length >= MAX_PARTICLES) game.particles.shift();
  game.particles.push(p);
}

export function burst(game, x, y, opts = {}) {
  const {
    count = 8,
    color = '#ffffff',
    color2 = null,
    speed = 220,
    spread = Math.PI * 2,
    dir = 0,
    life = 0.5,
    size = 3,
    gravity = 700,
    drag = 1.6,
    glow = false,
    shape = 'circle'
  } = opts;
  for (let i = 0; i < count; i++) {
    const a = dir + (Math.random() - 0.5) * spread;
    const s = speed * (0.35 + Math.random() * 0.8);
    const l = life * (0.6 + Math.random() * 0.7);
    addParticle(game, {
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: l,
      max: l,
      size: size * (0.5 + Math.random()),
      color: color2 && Math.random() < 0.4 ? color2 : color,
      gravity,
      drag,
      glow,
      shape
    });
  }
}

export function dust(game, x, y, count = 5, color = '#d8c8a8') {
  for (let i = 0; i < count; i++) {
    const l = 0.35 + Math.random() * 0.35;
    addParticle(game, {
      x: x + (Math.random() - 0.5) * 22,
      y: y - Math.random() * 4,
      vx: (Math.random() - 0.5) * 90,
      vy: -20 - Math.random() * 60,
      life: l,
      max: l,
      size: 3 + Math.random() * 4,
      color,
      gravity: 160,
      drag: 2.5,
      glow: false,
      shape: 'circle'
    });
  }
}

export function spores(game, x, y, count = 6, color = '#8ff7df') {
  for (let i = 0; i < count; i++) {
    const l = 0.8 + Math.random() * 0.7;
    addParticle(game, {
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 70,
      life: l,
      max: l,
      size: 2 + Math.random() * 3,
      color,
      gravity: -10,
      drag: 0.9,
      glow: true,
      shape: 'circle'
    });
  }
}

export function updateParticles(game, dt) {
  const list = game.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    const d = Math.exp(-p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

export function createAmbient(level) {
  const rng = mulberry32(level.id.length * 9217 + level.width);
  const motes = [];
  const count = 70;
  for (let i = 0; i < count; i++) {
    motes.push({
      x: rng() * level.widthPx,
      y: 40 + rng() * (level.heightPx - 100),
      size: 1 + rng() * 2.4,
      phase: rng() * Math.PI * 2,
      speed: 0.3 + rng() * 1.1,
      drift: 4 + rng() * 14,
      kind: rng() > 0.7 ? 'firefly' : 'mote'
    });
  }
  return motes;
}
