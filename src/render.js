import { TILE, ARMOR, clamp, hash } from './constants.js';

const THEMES = {
  forest: {
    sky: ['#07141b', '#0c252b', '#1d3b38', '#6f5c43'],
    glowSky: '#c98a5a',
    far: '#0a1c1f',
    mid: '#102a2a',
    near: '#0a1917',
    ground: '#243a2e',
    groundDark: '#16261e',
    cap: '#5f9455',
    cap2: '#86bb6d',
    edge: '#3a5a41',
    platform: '#5b4632',
    platformTop: '#99764c',
    platformDark: '#39281b',
    spike: '#b6c7a5',
    fog: '#0b1d1d',
    mote: '#ffe9a8',
    accent: '#8ff7df',
    warm: '#ffcf7a'
  },
  cavern: {
    sky: ['#05070f', '#0a0f1d', '#171a30', '#2a2240'],
    glowSky: '#4a3f7a',
    far: '#0b0d18',
    mid: '#141529',
    near: '#090a12',
    ground: '#262138',
    groundDark: '#171325',
    cap: '#575077',
    cap2: '#8b7fc0',
    edge: '#3a3155',
    platform: '#3b3457',
    platformTop: '#6f6895',
    platformDark: '#242038',
    spike: '#a9d8d0',
    fog: '#090b17',
    mote: '#8ff7df',
    accent: '#9fd8ff',
    warm: '#c08bff'
  },
  summit: {
    sky: ['#070a18', '#10152e', '#232a52', '#403b66'],
    glowSky: '#6c7fd8',
    far: '#0c1024',
    mid: '#151b38',
    near: '#0a0d1e',
    ground: '#2b2c48',
    groundDark: '#1a1b2f',
    cap: '#8a86c7',
    cap2: '#d6d2f2',
    edge: '#4b4877',
    platform: '#4a4a70',
    platformTop: '#8d89b5',
    platformDark: '#2b2b45',
    spike: '#d9e2ff',
    fog: '#0a0d1e',
    mote: '#c6ffef',
    accent: '#8ff7df',
    warm: '#ffd76a'
  }
};

const p0 = {
  plate: '#7e8a58',
  trim: '#c9a35c',
  cloth: '#3f4f36',
  plume: '#c5773c',
  eye: '#ffe082'
};

function rgba(hex, a) {
  if (!hex) return `rgba(255,255,255,${a})`;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }

  draw(game, dt) {
    if (!game.level || !game.player) return;
    const ctx = this.ctx;
    if (!ctx) return;
    this.game = game;
    this.level = game.level;
    this.theme = THEMES[game.level.theme] || THEMES.forest;
    this.t = game.time;
    this.cam = game.camera;
    this.vw = game.viewW;
    this.vh = game.viewH;

    const dpr = game.dpr;
    const scale = game.scale;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    const shake = game.shake;
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    this.drawSky();
    this.drawParallax();

    ctx.save();
    ctx.translate(-this.cam.x, -this.cam.y);
    this.drawWorld();
    ctx.restore();

    this.drawForeground();
  }

  drawSky() {
    const ctx = this.ctx;
    const { sky } = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, this.vh);
    g.addColorStop(0, sky[0]);
    g.addColorStop(0.45, sky[1]);
    g.addColorStop(0.75, sky[2]);
    g.addColorStop(1, sky[3]);
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.vw + 80, this.vh + 80);

    // horizon glow
    const glowY = clamp((this.level.arenaData.groundY - this.cam.y) * 0.92, 0, this.vh * 1.1);
    const rg = ctx.createRadialGradient(this.vw * 0.5, glowY, 10, this.vw * 0.5, glowY, this.vw * 0.65);
    rg.addColorStop(0, rgba(this.theme.glowSky, 0.32));
    rg.addColorStop(0.55, rgba(this.theme.glowSky, 0.1));
    rg.addColorStop(1, rgba(this.theme.glowSky, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, this.vw, this.vh);

    if (this.level.theme === 'summit' || this.level.theme === 'forest') {
      this.drawStars();
      this.drawMoon();
    }
  }

  drawStars() {
    const ctx = this.ctx;
    const count = this.level.theme === 'summit' ? 90 : 45;
    for (let i = 0; i < count; i++) {
      const x = (hash(i * 3.1) * 1.4 - 0.2) * this.vw;
      const y = hash(i * 7.7 + 2) * this.vh * 0.62;
      const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(this.t * (0.6 + hash(i) * 1.7) + i));
      const s = 0.6 + hash(i * 5.9) * 1.6;
      ctx.fillStyle = `rgba(220,235,255,${tw * (this.level.theme === 'summit' ? 0.9 : 0.55)})`;
      ctx.fillRect(x, y, s, s);
    }
  }

  drawMoon() {
    const ctx = this.ctx;
    const x = this.vw * 0.78;
    const y = this.vh * (this.level.theme === 'summit' ? 0.18 : 0.2);
    const r = this.level.theme === 'summit' ? 44 : 30;
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 4.2);
    glow.addColorStop(0, rgba('#dfe9ff', 0.32));
    glow.addColorStop(0.4, rgba('#b9c8f0', 0.1));
    glow.addColorStop(1, rgba('#8fa4d8', 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);

    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    disc.addColorStop(0, '#f2f5ff');
    disc.addColorStop(1, this.level.theme === 'forest' ? '#d7c9a8' : '#c8d4ff');
    ctx.fillStyle = disc;
    ellipse(ctx, x, y, r, r);
    ctx.fill();

    ctx.fillStyle = 'rgba(140,150,190,0.22)';
    ellipse(ctx, x - r * 0.3, y + r * 0.15, r * 0.22, r * 0.16);
    ctx.fill();
    ellipse(ctx, x + r * 0.28, y - r * 0.2, r * 0.14, r * 0.11);
    ctx.fill();
  }

  drawParallax() {
    const ctx = this.ctx;
    const theme = this.theme;
    const groundScreen = this.level.arenaData.groundY - this.cam.y;
    const horizon = clamp(groundScreen * 0.9, -this.vh * 0.2, this.vh * 1.1);

    if (this.level.theme === 'forest') {
      this.layer(260, 0.12, (x, i) => {
        const h = 140 + hash(i * 4.4) * 150;
        ctx.fillStyle = rgba(theme.far, 0.9);
        ctx.beginPath();
        ctx.moveTo(x - 300, horizon + 120);
        ctx.quadraticCurveTo(x - 90, horizon + 30 - h * 0.4, x, horizon - h * 0.16);
        ctx.quadraticCurveTo(x + 110, horizon + 30 - h * 0.35, x + 300, horizon + 120);
        ctx.closePath();
        ctx.fill();
      });
      this.drawForestTrees(horizon, 0.28, 118, theme.mid, 0.7);
      this.drawForestMushrooms(horizon, 0.46, 430);
      this.drawForestTrees(horizon + 26, 0.6, 86, theme.near, 0.9);
    } else if (this.level.theme === 'cavern') {
      ctx.fillStyle = rgba(theme.far, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, horizon + 90);
      for (let x = 0; x <= this.vw + 40; x += 40) {
        const y = horizon - 40 - Math.sin(x * 0.008 + 1.3) * 60 - hash(x) * 30;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.vw + 40, horizon + 140);
      ctx.closePath();
      ctx.fill();

      this.layer(150, 0.18, (x, i) => {
        const len = 50 + hash(i * 9.1) * 150;
        const w = 16 + hash(i * 3.7) * 26;
        ctx.fillStyle = rgba('#141726', 0.95);
        ctx.beginPath();
        ctx.moveTo(x - w, -20);
        ctx.lineTo(x, -20 + len);
        ctx.lineTo(x + w, -20);
        ctx.closePath();
        ctx.fill();
      });

      this.layer(190, 0.42, (x, i) => {
        const h = 45 + hash(i * 6.2) * 95;
        const hue = i % 3 === 0 ? theme.warm : theme.accent;
        const glow = ctx.createRadialGradient(x, horizon, 2, x, horizon, h * 1.1);
        glow.addColorStop(0, rgba(hue, 0.2));
        glow.addColorStop(1, rgba(hue, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(x - h, horizon - h, h * 2, h * 2);
        ctx.fillStyle = rgba('#1b1b31', 0.95);
        ctx.beginPath();
        ctx.moveTo(x - 18, horizon + 30);
        ctx.lineTo(x - 4, horizon - h);
        ctx.lineTo(x + 12, horizon + 30);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(hue, 0.5);
        ctx.beginPath();
        ctx.moveTo(x - 4, horizon - h + 10);
        ctx.lineTo(x + 3, horizon - h + 34);
        ctx.lineTo(x - 9, horizon - h + 30);
        ctx.closePath();
        ctx.fill();
      });

      this.layer(130, 0.62, (x, i) => {
        const len = 60 + hash(i * 2.3) * 120;
        ctx.strokeStyle = rgba(theme.mid, 0.7);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, -10);
        ctx.quadraticCurveTo(x + 20, len * 0.6, x + 10, len);
        ctx.stroke();
        ctx.fillStyle = rgba(theme.accent, 0.25);
        ellipse(ctx, x + 10, len, 3.5, 3.5);
        ctx.fill();
      });
    } else {
      this.drawAurora(horizon);
      this.layer(280, 0.16, (x, i) => {
        const h = 220 + hash(i * 5.3) * 240;
        ctx.fillStyle = rgba(theme.far, 0.85);
        ctx.beginPath();
        ctx.moveTo(x - 220, horizon + 100);
        ctx.lineTo(x - 60, horizon - h * 0.6);
        ctx.lineTo(x + 10, horizon - h);
        ctx.lineTo(x + 80, horizon - h * 0.55);
        ctx.lineTo(x + 240, horizon + 100);
        ctx.closePath();
        ctx.fill();
      });
      this.layer(160, 0.36, (x, i) => {
        const h = 90 + hash(i * 8.1) * 130;
        ctx.fillStyle = rgba(theme.mid, 0.8);
        ctx.beginPath();
        ctx.moveTo(x - 130, horizon + 60);
        ctx.lineTo(x - 36, horizon - h * 0.45);
        ctx.lineTo(x, horizon - h);
        ctx.lineTo(x + 42, horizon - h * 0.5);
        ctx.lineTo(x + 150, horizon + 60);
        ctx.closePath();
        ctx.fill();
      });
      this.layer(320, 0.55, (x, i) => {
        const y = horizon - 20 - hash(i * 2.9) * 40;
        const g = ctx.createLinearGradient(0, y - 20, 0, y + 32);
        g.addColorStop(0, rgba('#b8c6ff', 0.22));
        g.addColorStop(1, rgba('#b8c6ff', 0));
        ctx.fillStyle = g;
        ellipse(ctx, x, y, 150, 30);
        ctx.fill();
      });
    }

    // horizon fog band
    const fog = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 150);
    fog.addColorStop(0, rgba(this.theme.fog, 0));
    fog.addColorStop(0.5, rgba(this.theme.fog, 0.4));
    fog.addColorStop(1, rgba(this.theme.fog, 0));
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 60, this.vw, 210);

    // Keep the world below the horizon dark, so chasms read as depth rather
    // than exposing the warm ends of the sky gradient.
    const abyss = ctx.createLinearGradient(0, this.vh * 0.48, 0, this.vh);
    abyss.addColorStop(0, rgba(this.theme.fog, 0));
    abyss.addColorStop(0.42, rgba(this.theme.fog, 0.34));
    abyss.addColorStop(1, rgba(this.theme.near, 0.94));
    ctx.fillStyle = abyss;
    ctx.fillRect(0, this.vh * 0.48, this.vw, this.vh * 0.52);
  }

  layer(spacing, p, cb) {
    const offset = this.cam.x * p;
    const start = Math.floor((offset - spacing) / spacing);
    const end = Math.ceil((offset + this.vw + spacing) / spacing);
    for (let i = start; i <= end; i++) cb(i * spacing - offset, i);
  }

  drawForestTrees(horizon, p, spacing, color, alpha) {
    const ctx = this.ctx;
    this.layer(spacing, p, (x, i) => {
      const h = 120 + hash(i * 6.7) * 130;
      const w = 16 + hash(i * 2.2) * 18;
      ctx.fillStyle = rgba(color, alpha);
      ctx.beginPath();
      ctx.moveTo(x - w, horizon + 30);
      ctx.lineTo(x - w * 0.4, horizon - h);
      ctx.lineTo(x + w * 0.4, horizon - h);
      ctx.lineTo(x + w, horizon + 30);
      ctx.closePath();
      ctx.fill();
      for (let b = 0; b < 3; b++) {
        const bx = x + (hash(i * 3 + b) - 0.5) * 90;
        const by = horizon - h + (hash(i * 5 + b) - 0.5) * 60;
        const r = 24 + hash(i * 7 + b) * 40;
        ellipse(ctx, bx, by, r, r * 0.7);
        ctx.fill();
      }
    });
  }

  drawForestMushrooms(horizon, p, spacing) {
    const ctx = this.ctx;
    this.layer(spacing, p, (x, i) => {
      const h = 110 + hash(i * 3.3) * 150;
      const capW = 50 + hash(i * 8.4) * 60;
      const stemW = 10 + hash(i * 1.1) * 10;
      const glow = ctx.createRadialGradient(x, horizon - h, 4, x, horizon - h, capW * 1.6);
      glow.addColorStop(0, rgba(i % 2 ? this.theme.accent : this.theme.warm, 0.16));
      glow.addColorStop(1, rgba(this.theme.warm, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - capW * 2, horizon - h - capW * 2, capW * 4, capW * 3.4);

      ctx.fillStyle = rgba(this.theme.mid, 0.95);
      ctx.beginPath();
      ctx.moveTo(x - stemW, horizon + 10);
      ctx.quadraticCurveTo(x - stemW * 0.6, horizon - h * 0.55, x - stemW * 0.4, horizon - h);
      ctx.lineTo(x + stemW * 0.4, horizon - h);
      ctx.quadraticCurveTo(x + stemW * 0.6, horizon - h * 0.55, x + stemW, horizon + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = rgba(this.theme.near, 0.95);
      ctx.beginPath();
      ctx.ellipse(x, horizon - h, capW, capW * 0.42, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(this.theme.accent, 0.16);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, horizon - h, capW * 0.95, capW * 0.36, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    });
  }

  drawAurora(horizon) {
    const ctx = this.ctx;
    const colors = ['#68f0c8', '#8f9bff', '#d68bff'];
    for (let band = 0; band < 3; band++) {
      const color = colors[band];
      const baseY = this.vh * (0.1 + band * 0.08);
      const g = ctx.createLinearGradient(0, baseY - 90, 0, baseY + 90);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.5, rgba(color, 0.12));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      const amp = 26 + band * 10;
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= this.vw + 20; x += 24) {
        const y = baseY + Math.sin(x * 0.008 + this.t * 0.18 + band * 1.4) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(this.vw + 20, baseY + 130);
      ctx.lineTo(0, baseY + 130);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawWorld() {
    this.drawTiles();
    this.drawArenaWall();
    this.drawProps();
    this.drawAmbient();

    for (const pickup of this.game.pickups) this.drawPickup(pickup);
    for (const enemy of this.game.enemies) this.drawEnemy(enemy);
    if (this.game.boss) this.drawBoss(this.game.boss);
    this.drawPlayer(this.game.player);
    for (const projectile of this.game.projectiles) this.drawProjectile(projectile);
    this.drawParticles();
    this.drawTexts();
  }

  drawTiles() {
    const ctx = this.ctx;
    const level = this.level;
    const T = TILE;
    const x0 = Math.floor(this.cam.x / T) - 1;
    const x1 = Math.ceil((this.cam.x + this.vw) / T) + 1;
    const y0 = Math.floor(this.cam.y / T) - 1;
    const y1 = Math.ceil((this.cam.y + this.vh) / T) + 1;
    const theme = this.theme;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = level.charAt(tx, ty);
        if (ch === '#') {
          const x = tx * T;
          const y = ty * T;
          const above = level.charAt(tx, ty - 1);
          const top = above !== '#';
          ctx.fillStyle = this.groundTexture();
          ctx.fillRect(x, y, T, T);
          if (top) this.drawGroundSurface(tx, ty, x, y);
          if (level.charAt(tx, ty + 1) !== '#') {
            ctx.fillStyle = rgba(theme.groundDark, 0.85);
            ctx.fillRect(x, y + T - 9, T, 9);
            ctx.fillStyle = rgba(theme.edge, 0.25);
            ctx.fillRect(x, y + T - 9, T, 2);
          }
          const openLeft = level.charAt(tx - 1, ty) !== '#';
          const openRight = level.charAt(tx + 1, ty) !== '#';
          if (openLeft) {
            ctx.fillStyle = rgba(theme.edge, 0.55);
            ctx.fillRect(x, y, 2, T);
            this.drawEdgeRoot(tx, ty, x + 2, y, 1);
          }
          if (openRight) {
            ctx.fillStyle = rgba(theme.edge, 0.32);
            ctx.fillRect(x + T - 2, y, 2, T);
            this.drawEdgeRoot(tx, ty, x + T - 2, y, -1);
          }
        } else if (ch === '=') {
          this.drawPlatform(tx, ty, tx * T, ty * T);
        } else if (ch === '^') {
          const x = tx * T;
          const y = ty * T;
          ctx.fillStyle = rgba(theme.groundDark, 0.5);
          ctx.fillRect(x, y + T - 4, T, 4);
          for (let s = 0; s < 3; s++) {
            const bx = x + 8 + s * 14;
            const by = y + T - 2;
            ctx.fillStyle = theme.spike;
            ctx.beginPath();
            ctx.moveTo(bx - 6, by);
            ctx.lineTo(bx, by - 22);
            ctx.lineTo(bx + 6, by);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = rgba('#ffffff', 0.35);
            ctx.beginPath();
            ctx.moveTo(bx - 1, by - 2);
            ctx.lineTo(bx, by - 20);
            ctx.lineTo(bx + 2, by - 2);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }
  }

  groundTexture() {
    const key = this.level.theme;
    if (this._groundTexKey === key) return this._groundTex;
    const theme = this.theme;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = theme.ground;
    g.fillRect(0, 0, 128, 128);

    for (let i = 0; i < 24; i++) {
      const x = 6 + hash(i * 7.1 + 1.3) * 116;
      const y = 6 + hash(i * 3.7 + 8.2) * 116;
      const r = 7 + hash(i * 5.9 + 2.4) * 24;
      g.fillStyle = rgba(i % 3 === 0 ? theme.cap : theme.groundDark, 0.045 + hash(i * 2.3) * 0.05);
      ellipse(g, x, y, r, r * (0.45 + hash(i * 9.1) * 0.35));
      g.fill();
    }

    for (let i = 0; i < 4; i++) {
      g.strokeStyle = rgba(theme.groundDark, 0.22);
      g.lineWidth = 1 + hash(i * 4.2) * 1.4;
      g.beginPath();
      const sy = 14 + i * 30 + hash(i * 3.3) * 10;
      g.moveTo(3, sy);
      g.bezierCurveTo(34, sy + 5, 76, sy - 6, 125, sy + 3);
      g.stroke();
    }

    for (let i = 0; i < 7; i++) {
      const x = 8 + hash(i * 8.7) * 112;
      const y = 4 + hash(i * 2.9 + 4) * 110;
      g.strokeStyle = rgba(i % 2 ? theme.edge : theme.groundDark, 0.3);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 6, y + 14, x - 5, y + 28, x + 2, y + 40);
      g.stroke();
    }

    for (let i = 0; i < 46; i++) {
      const x = hash(i * 6.3 + 2.1) * 126;
      const y = hash(i * 4.9 + 7.7) * 126;
      const s = 0.8 + hash(i * 7.7) * 2.1;
      g.fillStyle = rgba(i % 4 === 0 ? theme.cap2 : theme.groundDark, 0.16 + hash(i * 3.1) * 0.18);
      g.fillRect(x, y, s, s);
    }

    for (let i = 0; i < 8; i++) {
      const x = 10 + hash(i * 9.3 + 3.3) * 108;
      const y = 10 + hash(i * 5.1 + 1.7) * 108;
      g.fillStyle = rgba(theme.edge, 0.16 + hash(i * 2.7) * 0.14);
      g.beginPath();
      g.ellipse(x, y, 1.5 + hash(i * 4.1) * 2.5, 1 + hash(i * 6.1) * 1.6, hash(i) * 3, 0, Math.PI * 2);
      g.fill();
    }

    this._groundTex = this.ctx.createPattern(c, 'repeat');
    this._groundTexKey = key;
    return this._groundTex;
  }

  drawGroundSurface(tx, ty, x, y) {
    const ctx = this.ctx;
    const theme = this.theme;
    const T = TILE;
    ctx.fillStyle = theme.cap;
    ctx.fillRect(x, y, T, 12);
    ctx.fillStyle = theme.cap2;
    ctx.fillRect(x, y, T, 3.5);
    ctx.fillStyle = rgba(theme.groundDark, 0.38);
    ctx.fillRect(x, y + 12, T, 3);

    // soft moss lumps along the lip
    for (let i = 0; i < 4; i++) {
      const bx = x + 4 + hash(tx * 5.9 + i * 9.1) * (T - 8);
      const by = y + 8 + hash(tx * 2.7 + i * 3.3) * 4;
      ctx.fillStyle = rgba(i % 2 ? theme.cap : theme.cap2, 0.28 + hash(i + tx) * 0.22);
      ellipse(ctx, bx, by, 2.4 + hash(tx + i * 2.1) * 4.2, 1.5 + hash(tx * 3.1 + i) * 1.8);
      ctx.fill();
    }

    // grass blades poking above the surface
    for (let i = 0; i < 6; i++) {
      const bx = x + 3 + hash(tx * 3.1 + i * 7.7) * (T - 6);
      const bh = 3.5 + hash(tx * 5.3 + i * 1.9) * 11;
      const lean = (hash(tx * 8.1 + i * 4.3) - 0.5) * 7;
      ctx.strokeStyle = rgba(i % 2 === 0 ? theme.cap2 : theme.cap, 0.55 + hash(tx + i) * 0.3);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(bx, y + 1.5);
      ctx.quadraticCurveTo(bx + lean * 0.35, y - bh * 0.55, bx + lean, y - bh);
      ctx.stroke();
    }

    // a rare tiny bloom or glowing cap
    if (hash(tx * 12.7 + ty * 3.1) > 0.9) {
      const bx = x + 8 + hash(tx * 4.3) * (T - 16);
      ctx.strokeStyle = rgba(theme.cap, 0.8);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, y + 1);
      ctx.lineTo(bx, y - 8);
      ctx.stroke();
      ctx.fillStyle = rgba(theme.warm, 0.7);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        ellipse(ctx, bx + Math.cos(a) * 2.3, y - 9 + Math.sin(a) * 2.3, 1.5, 1.5);
        ctx.fill();
      }
      ctx.fillStyle = '#fff7d8';
      ellipse(ctx, bx, y - 9, 1.3, 1.3);
      ctx.fill();
    }
  }

  drawEdgeRoot(tx, ty, px, y, dir) {
    if (hash(tx * 5.1 + ty * 7.7) < 0.42) return;
    const ctx = this.ctx;
    const theme = this.theme;
    const len = 12 + hash(tx * 3.7 + ty * 1.9) * 24;
    ctx.strokeStyle = rgba(theme.groundDark, 0.7);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px, y + 13);
    ctx.bezierCurveTo(px + dir * 7, y + 22, px - dir * 5, y + len, px + dir * 2, y + 12 + len);
    ctx.stroke();
    if (len > 24) {
      ctx.strokeStyle = rgba(theme.cap, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, y + 20);
      ctx.quadraticCurveTo(px - dir * 8, y + 32, px + dir * 4, y + 42);
      ctx.stroke();
    }
  }

  drawPlatform(tx, ty, x, y) {
    const ctx = this.ctx;
    const theme = this.theme;
    const T = TILE;
    const kind = this.level.theme;

    if (kind === 'forest') {
      ctx.fillStyle = theme.platformDark;
      ctx.fillRect(x + 6, y + 14, 5, 17 + hash(tx * 2.3) * 5);
      ctx.fillRect(x + T - 12, y + 14, 5, 14 + hash(tx * 4.7) * 6);
      ctx.fillStyle = theme.platform;
      roundRect(ctx, x - 0.5, y, T + 1, 15, 4);
      ctx.fill();
      ctx.fillStyle = theme.platformTop;
      roundRect(ctx, x - 0.5, y, T + 1, 6, 3);
      ctx.fill();
      ctx.strokeStyle = rgba(theme.platformDark, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 9 + hash(tx * 3.3) * 2);
      ctx.lineTo(x + T - 5, y + 9 + hash(tx * 5.7) * 2);
      ctx.stroke();
      ctx.fillStyle = rgba(theme.groundDark, 0.45);
      ctx.fillRect(x + 3, y + 15, T - 6, 2);

      for (let i = 0; i < 3; i++) {
        if (hash(tx * 7.1 + i * 3.7) > 0.55) {
          const bx = x + 6 + hash(tx * 2.1 + i) * (T - 12);
          ctx.fillStyle = rgba(i % 2 ? theme.cap : theme.cap2, 0.5);
          ellipse(ctx, bx, y + 2, 2 + hash(i + tx) * 3, 1.2 + hash(i * 2.3 + tx) * 1.4);
          ctx.fill();
        }
      }
      if (hash(tx * 4.1 + ty * 8.3) > 0.62) {
        const vx = x + 8 + hash(tx * 6.1) * (T - 16);
        const len = 8 + hash(tx * 1.7) * 22;
        ctx.strokeStyle = rgba(theme.cap, 0.38);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(vx, y + 15);
        ctx.quadraticCurveTo(vx + 5, y + 15 + len * 0.6, vx - 2, y + 15 + len);
        ctx.stroke();
        ctx.fillStyle = rgba(theme.cap2, 0.45);
        ellipse(ctx, vx - 3, y + 15 + len, 2.2, 1.3);
        ctx.fill();
      }
    } else if (kind === 'cavern') {
      const glow = ctx.createLinearGradient(x, y + 10, x, y + 28);
      glow.addColorStop(0, rgba(theme.accent, 0.1));
      glow.addColorStop(1, rgba(theme.accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 2, y + 10, T + 4, 24);
      ctx.fillStyle = theme.platform;
      roundRect(ctx, x - 1, y, T + 2, 14, 3);
      ctx.fill();
      ctx.fillStyle = theme.platformTop;
      ctx.fillRect(x, y, T + 1, 4);
      ctx.fillStyle = rgba(theme.groundDark, 0.45);
      ctx.fillRect(x, y + 12, T + 1, 2);
      // rough underside
      ctx.fillStyle = theme.platformDark;
      for (let i = 0; i < 3; i++) {
        const bx = x + 5 + i * 16 + hash(tx * 3.1 + i) * 6;
        const bh = 4 + hash(tx * 5.3 + i * 2.1) * 9;
        ctx.beginPath();
        ctx.moveTo(bx - 5, y + 14);
        ctx.lineTo(bx, y + 14 + bh);
        ctx.lineTo(bx + 5, y + 14);
        ctx.closePath();
        ctx.fill();
      }
      if (hash(tx * 9.1 + ty * 2.3) > 0.72) {
        const cx = x + T - 10;
        const cy = y + 17;
        ctx.fillStyle = rgba(theme.accent, 0.5);
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx + 4, cy);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx - 4, cy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.5);
        ctx.fillRect(cx - 0.8, cy - 4, 1.6, 5);
      }
    } else {
      const glow = ctx.createLinearGradient(x, y + 10, x, y + 30);
      glow.addColorStop(0, rgba(theme.cap2, 0.12));
      glow.addColorStop(1, rgba(theme.cap2, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 2, y + 10, T + 4, 26);
      ctx.fillStyle = theme.platform;
      roundRect(ctx, x - 1, y, T + 2, 14, 3);
      ctx.fill();
      ctx.fillStyle = theme.cap2;
      roundRect(ctx, x - 1, y, T + 2, 4.5, 2.5);
      ctx.fill();
      ctx.fillStyle = rgba(theme.groundDark, 0.4);
      ctx.fillRect(x, y + 13, T + 1, 2);
      ctx.fillStyle = theme.platformDark;
      for (let i = 0; i < 3; i++) {
        const bx = x + 6 + i * 16 + hash(tx * 4.7 + i) * 5;
        const len = 4 + hash(tx * 6.1 + i * 3.3) * 12;
        ctx.beginPath();
        ctx.moveTo(bx - 2.5, y + 14);
        ctx.lineTo(bx, y + 14 + len);
        ctx.lineTo(bx + 2.5, y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = rgba(theme.spike, 0.2);
        ctx.fillRect(bx - 0.7, y + 15, 1.4, len * 0.5);
        ctx.fillStyle = theme.platformDark;
      }
    }
  }

  drawArenaWall() {
    if (!this.game.bossActive) return;
    const ctx = this.ctx;
    const x = this.level.arenaData.x0 + 4;
    const ground = this.level.arenaData.groundY;
    const h = 430;
    const g = ctx.createLinearGradient(x, ground, x, ground - h);
    g.addColorStop(0, rgba(this.theme.accent, 0.22));
    g.addColorStop(0.5, rgba(this.theme.accent, 0.07));
    g.addColorStop(1, rgba(this.theme.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 16, ground - h, 32, h);
    ctx.strokeStyle = rgba(this.theme.accent, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ground);
    ctx.lineTo(x + Math.sin(this.t * 3) * 6, ground - h);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const yy = ground - 50 - i * 78 + Math.sin(this.t * 2 + i) * 10;
      ctx.strokeStyle = rgba(this.theme.accent, 0.25);
      ctx.beginPath();
      ctx.arc(x + Math.sin(this.t * 2 + i) * 8, yy, 5 + (i % 2) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawProps() {
    const ctx = this.ctx;
    for (const torch of this.level.torches) {
      if (torch.x < this.cam.x - 100 || torch.x > this.cam.x + this.vw + 100) continue;
      const { x, y } = torch;
      const flick = 0.8 + Math.sin(this.t * 12 + x) * 0.12 + Math.sin(this.t * 23 + x) * 0.06;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 120 * flick);
      glow.addColorStop(0, rgba(this.theme.warm, 0.34));
      glow.addColorStop(0.4, rgba(this.theme.warm, 0.1));
      glow.addColorStop(1, rgba(this.theme.warm, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 130, y - 130, 260, 260);
      ctx.restore();
      ctx.strokeStyle = '#2a2119';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + 20);
      ctx.lineTo(x, y + 46);
      ctx.stroke();
      ctx.fillStyle = '#4a3826';
      roundRect(ctx, x - 5, y + 6, 10, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 8);
      ctx.quadraticCurveTo(x - 11, y - 8, x + 1, y - 22 - flick * 8);
      ctx.quadraticCurveTo(x + 12, y - 6, x + 6, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 3, 6 * flick, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let p = 0; p < 2; p++) {
        const py = y - 26 - ((this.t * 28 + p * 22) % 44);
        ctx.fillStyle = rgba('#ffd76a', 0.5 * (1 - ((py - (y - 40)) / 40)));
        ellipse(ctx, x + Math.sin(this.t * 3 + p) * 6, py, 1.5, 1.5);
        ctx.fill();
      }
    }

    for (const cp of this.level.checkpoints) {
      if (cp.x < this.cam.x - 90 || cp.x > this.cam.x + this.vw + 90) continue;
      this.drawCheckpoint(cp);
    }
    for (const forge of this.level.forges) {
      if (forge.x < this.cam.x - 120 || forge.x > this.cam.x + this.vw + 120) continue;
      this.drawForge(forge);
    }
    if (this.level.door) this.drawDoor(this.level.door);
  }

  drawCheckpoint(cp) {
    const ctx = this.ctx;
    const { x, y } = cp;
    const active = cp.active;
    const color = active ? this.theme.accent : '#6f7c6f';
    ctx.fillStyle = '#2a2620';
    ctx.fillRect(x - 3, y - 58, 6, 58);
    ctx.fillStyle = '#3b342a';
    roundRect(ctx, x - 14, y - 74, 28, 24, 5);
    ctx.fill();
    ctx.strokeStyle = active ? color : '#5a5646';
    ctx.lineWidth = 2;
    roundRect(ctx, x - 11, y - 71, 22, 18, 4);
    ctx.stroke();
    if (active) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y - 60, 2, x, y - 60, 90);
      glow.addColorStop(0, rgba(color, 0.4));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 95, y - 155, 190, 190);
      ctx.restore();
    }
    ctx.fillStyle = active ? '#d8fff5' : '#3d4a3d';
    ellipse(ctx, x, y - 61, 6, 8);
    ctx.fill();
    if (active) {
      ctx.fillStyle = rgba('#ffffff', 0.7);
      ellipse(ctx, x - 2, y - 64, 2, 3);
      ctx.fill();
    }
  }

  drawForge(forge) {
    const ctx = this.ctx;
    const { x, y } = forge;
    const near = this.game.nearForge === forge;
    const pulse = 0.65 + Math.sin(this.t * 2.4) * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, y - 36, 4, x, y - 36, near ? 120 : 80);
    glow.addColorStop(0, rgba(this.theme.warm, 0.3 * pulse));
    glow.addColorStop(1, rgba(this.theme.warm, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, y - 170, 260, 260);
    ctx.restore();

    ctx.fillStyle = '#3a2a1e';
    roundRect(ctx, x - 30, y - 30, 60, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#6b5136';
    roundRect(ctx, x - 26, y - 34, 52, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#8c6b45';
    roundRect(ctx, x - 18, y - 48, 36, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#2a2119';
    ctx.fillRect(x - 34, y - 4, 68, 4);

    // awning mushroom
    ctx.fillStyle = '#4d3b2a';
    ctx.fillRect(x + 26, y - 96, 4, 96);
    ctx.fillStyle = '#6d4f2c';
    ctx.beginPath();
    ctx.ellipse(x + 28, y - 98, 34, 13, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(this.theme.warm, 0.8);
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, x + 6 + i * 14, y - 100, 2.5, 1.6);
      ctx.fill();
    }

    ctx.fillStyle = rgba(this.theme.warm, 0.9);
    ellipse(ctx, x, y - 54, 4, 5 + Math.sin(this.t * 3) * 1.5);
    ctx.fill();
    ctx.strokeStyle = rgba(this.theme.warm, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 70, 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawDoor(door) {
    const ctx = this.ctx;
    const { x, y } = door;
    const open = this.game.bossDead;
    const color = open ? this.theme.accent : '#6b5a4a';
    const g = ctx.createLinearGradient(x - 40, y - 110, x + 40, y);
    g.addColorStop(0, rgba(open ? this.theme.accent : '#3a2f27', 0.16));
    g.addColorStop(1, rgba(open ? this.theme.accent : '#1a1512', 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 34, y);
    ctx.lineTo(x - 34, y - 70);
    ctx.quadraticCurveTo(x, y - 125, x + 34, y - 70);
    ctx.lineTo(x + 34, y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba(color, open ? 0.9 : 0.5);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 36, y);
    ctx.lineTo(x - 36, y - 72);
    ctx.quadraticCurveTo(x, y - 130, x + 36, y - 72);
    ctx.lineTo(x + 36, y);
    ctx.stroke();

    if (open) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(x, y - 55, 4, x, y - 55, 100);
      glow.addColorStop(0, rgba(this.theme.accent, 0.4));
      glow.addColorStop(1, rgba(this.theme.accent, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - 110, y - 160, 220, 220);
      ctx.restore();
      for (let i = 0; i < 5; i++) {
        const yy = y - 10 - ((this.t * 32 + i * 22) % 95);
        ctx.strokeStyle = rgba(this.theme.accent, 0.3);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 22 + i * 11, yy);
        ctx.lineTo(x - 16 + i * 11, yy - 16);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = rgba('#8a6a45', 0.5);
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 14, y - 16);
        ctx.lineTo(x + i * 14, y - 82);
        ctx.stroke();
      }
      ctx.fillStyle = rgba('#ffd76a', 0.5);
      ellipse(ctx, x, y - 60, 4, 4);
      ctx.fill();
    }
  }

  drawAmbient() {
    const ctx = this.ctx;
    const accent = this.theme.mote;
    for (const mote of this.game.ambient) {
      if (mote.x < this.cam.x - 30 || mote.x > this.cam.x + this.vw + 30) continue;
      if (mote.y < this.cam.y - 30 || mote.y > this.cam.y + this.vh + 30) continue;
      const drift = Math.sin(this.t * mote.speed + mote.phase) * mote.drift;
      const x = mote.x + drift;
      const y = mote.y + Math.cos(this.t * mote.speed * 0.7 + mote.phase) * 6;
      const alpha = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(this.t * 1.7 + mote.phase));
      if (mote.kind === 'firefly') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
        g.addColorStop(0, rgba(accent, alpha * 0.9));
        g.addColorStop(1, rgba(accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - 14, y - 14, 28, 28);
        ctx.restore();
        ctx.fillStyle = rgba('#ffffff', alpha);
        ellipse(ctx, x, y, 1.4, 1.4);
        ctx.fill();
      } else {
        ctx.fillStyle = rgba(accent, alpha * 0.5);
        ellipse(ctx, x, y, mote.size * 0.8, mote.size * 0.8);
        ctx.fill();
      }
    }
  }

  drawPickup(pickup) {
    const ctx = this.ctx;
    const { x, y } = pickup;
    if (x < this.cam.x - 50 || x > this.cam.x + this.vw + 50) return;
    if (pickup.type === 'heart') {
      const pulse = 0.9 + Math.sin(this.t * 4 + pickup.seed) * 0.1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 1, x, y, 26);
      g.addColorStop(0, 'rgba(255,120,150,0.35)');
      g.addColorStop(1, 'rgba(255,120,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 30, y - 30, 60, 60);
      ctx.restore();
      ctx.fillStyle = '#ff8aa6';
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-14, -2, -12, -14, -4, -14);
      ctx.bezierCurveTo(-1, -14, 0, -11, 0, -9);
      ctx.bezierCurveTo(0, -11, 1, -14, 4, -14);
      ctx.bezierCurveTo(12, -14, 14, -2, 0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }

    const big = pickup.big;
    const bob = Math.sin(this.t * 2.4 + pickup.seed) * 3;
    const cap = big ? 15 : 9;
    const stemH = big ? 12 : 7;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, cap * 3.4);
    g.addColorStop(0, rgba(big ? '#ffd76a' : this.theme.accent, 0.22));
    g.addColorStop(1, rgba(big ? '#ffd76a' : this.theme.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - cap * 4, y - cap * 4, cap * 8, cap * 8);
    ctx.restore();

    ctx.fillStyle = '#dfd2b0';
    ctx.fillRect(x - 2, y - 2 + bob, 4, stemH);
    ctx.fillStyle = big ? '#ffce5c' : '#e76f51';
    ctx.beginPath();
    ctx.ellipse(x, y - 2 + bob, cap, cap * 0.72, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba('#fff6d8', 0.75);
    ellipse(ctx, x - cap * 0.35, y - 5 + bob, cap * 0.2, cap * 0.14);
    ctx.fill();
    ellipse(ctx, x + cap * 0.28, y - 7 + bob, cap * 0.14, cap * 0.1);
    ctx.fill();
    if (big) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ellipse(ctx, x + cap * 0.55, y - 11 + bob, 1.4, 1.4);
      ctx.fill();
    }
  }

  drawEnemy(enemy) {
    const ctx = this.ctx;
    if (enemy.x < this.cam.x - 80 || enemy.x > this.cam.x + this.vw + 80) return;
    ctx.save();
    if (enemy.flash > 0) {
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 12;
    }
    if (enemy.type === 'slime') this.drawSlime(enemy);
    else if (enemy.type === 'beetle') this.drawBeetle(enemy);
    else if (enemy.type === 'bat') this.drawBat(enemy);
    else if (enemy.type === 'spitter') this.drawSpitter(enemy);
    ctx.restore();
  }

  drawSlime(e) {
    const ctx = this.ctx;
    const squash = e.onGround ? 1 + Math.sin(this.t * 6 + e.phase) * 0.05 : 1 + clamp(e.vy / 5000, -0.1, 0.16);
    const rx = (e.w / 2) * (1.1 - squash * 0.1);
    const ry = (e.h / 2) * squash;
    const cx = e.cx;
    const feet = e.y + e.h;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx, feet - 2, rx * 0.9, 4);
    ctx.fill();
    const g = ctx.createLinearGradient(cx, feet - ry * 2, cx, feet);
    if (e.flash > 0) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#e9fff4');
    } else {
      g.addColorStop(0, '#9fe06b');
      g.addColorStop(1, '#4c8f4a');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, feet - ry, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + rx, feet - 3);
    ctx.quadraticCurveTo(cx, feet + 4, cx - rx, feet - 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ellipse(ctx, cx - rx * 0.3, feet - ry * 1.45, rx * 0.26, ry * 0.22);
    ctx.fill();
    ctx.fillStyle = '#23301f';
    ellipse(ctx, cx - rx * 0.32, feet - ry * 1.15, 3, 4.2);
    ctx.fill();
    ellipse(ctx, cx + rx * 0.32, feet - ry * 1.15, 3, 4.2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, cx - rx * 0.34, feet - ry * 1.25, 1, 1.3);
    ctx.fill();
    ellipse(ctx, cx + rx * 0.3, feet - ry * 1.25, 1, 1.3);
    ctx.fill();
  }

  drawBeetle(e) {
    const ctx = this.ctx;
    const cx = e.cx;
    const feet = e.y + e.h;
    const wob = Math.sin(this.t * 12 + e.phase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx, feet - 1, e.w * 0.45, 3);
    ctx.fill();
    ctx.strokeStyle = '#1a1a22';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 12, feet - 6);
      ctx.lineTo(cx + i * 18, feet - 1 + wob * i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + i * 6, feet - 6);
      ctx.lineTo(cx + i * 10, feet - 1 - wob * i);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(cx, e.y, cx, feet);
    g.addColorStop(0, e.flash > 0 ? '#ffffff' : '#4a5c8a');
    g.addColorStop(1, e.flash > 0 ? '#eaf6ff' : '#232b45');
    ctx.fillStyle = g;
    ellipse(ctx, cx, e.y + e.h * 0.55, e.w * 0.5, e.h * 0.52);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, e.y + 4);
    ctx.lineTo(cx, feet - 5);
    ctx.stroke();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#1a2034';
    ellipse(ctx, cx + e.dir * e.w * 0.42, e.y + e.h * 0.5, e.w * 0.18, e.h * 0.32);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ellipse(ctx, cx + e.dir * e.w * 0.45, e.y + e.h * 0.45, 2, 2);
    ctx.fill();
    ctx.strokeStyle = '#1a2034';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + e.dir * e.w * 0.5, e.y + e.h * 0.36);
    ctx.quadraticCurveTo(cx + e.dir * e.w * 0.68, e.y + 2, cx + e.dir * e.w * 0.58, e.y - 2);
    ctx.stroke();
    ctx.fillStyle = '#7f8fc9';
    ellipse(ctx, cx - e.w * 0.18, e.y + 5, 7, 2.5);
    ctx.fill();
  }

  drawBat(e) {
    const ctx = this.ctx;
    const cx = e.cx;
    const cy = e.cy;
    const flap = Math.sin(this.t * 12 + e.phase) * 0.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#3a2b4d';
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-22, -18 + flap * 9, -40, -4 + flap * 12);
    ctx.quadraticCurveTo(-28, 2 + flap * 4, -30, 16 + flap * 6);
    ctx.quadraticCurveTo(-14, 10, -2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.quadraticCurveTo(22, -18 + flap * 9, 40, -4 + flap * 12);
    ctx.quadraticCurveTo(28, 2 + flap * 4, 30, 16 + flap * 6);
    ctx.quadraticCurveTo(14, 10, 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#241b33';
    ellipse(ctx, 0, 2, 10, 12);
    ctx.fill();
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#4a3a63';
    ellipse(ctx, 0, 4, 6, 8);
    ctx.fill();
    ctx.fillStyle = '#241b33';
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(-6, -20);
    ctx.lineTo(0, -9);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -8);
    ctx.lineTo(6, -20);
    ctx.lineTo(0, -9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8ad0';
    ellipse(ctx, -4, -2, 2, 3);
    ctx.fill();
    ellipse(ctx, 4, -2, 2, 3);
    ctx.fill();
    ctx.restore();
  }

  drawSpitter(e) {
    const ctx = this.ctx;
    const cx = e.cx;
    const feet = e.y + e.h;
    const sway = Math.sin(this.t * 2.4 + e.phase) * 2;
    const charge = e.castT > 0 ? 1 + (1 - e.castT / 0.5) * 0.3 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, cx, feet - 1, 16, 3);
    ctx.fill();
    ctx.strokeStyle = e.flash > 0 ? '#ffffff' : '#3c6b48';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, feet);
    ctx.quadraticCurveTo(cx + 6, feet - 22, cx + sway, feet - 38);
    ctx.stroke();
    ctx.fillStyle = '#4f8a5a';
    ctx.beginPath();
    ctx.ellipse(cx - 14, feet - 16, 12, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 14, feet - 24, 11, 5, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx + sway, feet - 44);
    const pulse = 0.7 + Math.sin(this.t * 5) * 0.15;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 28 * charge);
    glow.addColorStop(0, rgba(this.theme.warm, 0.35 * pulse * charge));
    glow.addColorStop(1, rgba(this.theme.warm, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(-34, -34, 68, 68);
    ctx.restore();

    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#7a4f9c';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.t * 0.3;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 12, Math.sin(a) * 10, 8, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#4b2f66';
    ellipse(ctx, 0, 0, 12, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ellipse(ctx, 0, 0, 4.5 * charge, 4.5 * charge);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ellipse(ctx, -1, -1, 1.5, 1.5);
    ctx.fill();
    ctx.restore();
  }

  drawBoss(boss) {
    const ctx = this.ctx;
    if (boss.x < this.cam.x - 200 || boss.x > this.cam.x + this.vw + 200) return;
    ctx.save();
    if (boss.dying) {
      ctx.globalAlpha = clamp(1 - boss.deathT / 2.1, 0, 1);
      ctx.translate(boss.cx, boss.cy);
      ctx.scale(1 + boss.deathT * 0.16, 1 + boss.deathT * 0.16);
      ctx.translate(-boss.cx, -boss.cy);
    }
    if (boss.flash > 0) {
      ctx.shadowColor = 'rgba(255,255,255,0.9)';
      ctx.shadowBlur = 22;
    }
    if (boss.kind === 'slimeKing') this.drawSlimeKing(boss);
    else if (boss.kind === 'batQueen') this.drawBatQueen(boss);
    else this.drawMonarch(boss);
    ctx.restore();

    if (!boss.dying && boss.intro <= 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(boss.cx, boss.cy, 10, boss.cx, boss.cy, boss.w * 1.2);
      g.addColorStop(0, rgba(this.theme.warm, 0.08));
      g.addColorStop(1, rgba(this.theme.warm, 0));
      ctx.fillStyle = g;
      ctx.fillRect(boss.cx - boss.w * 1.4, boss.cy - boss.w * 1.2, boss.w * 2.8, boss.w * 2.4);
      ctx.restore();
    }
  }

  drawSlimeKing(b) {
    const ctx = this.ctx;
    const squash = 1 + (b.squash || 0);
    const cx = b.cx;
    const feet = b.y + b.h;
    const rx = (b.w / 2) * (1.14 - squash * 0.08);
    const ry = (b.h / 2) * squash;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(ctx, cx, feet - 2, rx * 0.95, 7);
    ctx.fill();
    const g = ctx.createLinearGradient(cx, feet - ry * 2, cx, feet);
    if (b.flash > 0) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#e9fff4');
    } else {
      g.addColorStop(0, '#b7e86a');
      g.addColorStop(0.5, '#65b350');
      g.addColorStop(1, '#2f6b42');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, feet - ry, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + rx, feet - 6);
    ctx.quadraticCurveTo(cx, feet + 6, cx - rx, feet - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ellipse(ctx, cx - rx * 0.35, feet - ry * 1.5, rx * 0.24, ry * 0.24);
    ctx.fill();
    // spots
    ctx.fillStyle = 'rgba(255,255,220,0.18)';
    ellipse(ctx, cx + rx * 0.36, feet - ry * 1.6, 10, 7);
    ctx.fill();
    ellipse(ctx, cx - rx * 0.1, feet - ry * 0.7, 6, 4);
    ctx.fill();
    // face
    ctx.fillStyle = '#223322';
    ellipse(ctx, cx - rx * 0.34, feet - ry * 1.3, 7, 8);
    ctx.fill();
    ellipse(ctx, cx + rx * 0.34, feet - ry * 1.3, 7, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ellipse(ctx, cx - rx * 0.32, feet - ry * 1.34, 3, 3.4);
    ctx.fill();
    ellipse(ctx, cx + rx * 0.36, feet - ry * 1.34, 3, 3.4);
    ctx.fill();
    ctx.fillStyle = '#1c2b1c';
    ctx.beginPath();
    ctx.moveTo(cx - 26, feet - ry * 0.9);
    ctx.quadraticCurveTo(cx, feet - ry * 0.55, cx + 26, feet - ry * 0.9);
    ctx.quadraticCurveTo(cx, feet - ry * 0.74, cx - 26, feet - ry * 0.9);
    ctx.fill();
    // crown
    const cy = feet - ry * 2 - 4;
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx - 30, cy - 22);
    ctx.lineTo(cx - 12, cy - 10);
    ctx.lineTo(cx, cy - 30);
    ctx.lineTo(cx + 12, cy - 10);
    ctx.lineTo(cx + 30, cy - 22);
    ctx.lineTo(cx + 26, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8862f';
    ctx.fillRect(cx - 26, cy - 2, 52, 5);
    ctx.fillStyle = '#ff7a7a';
    ellipse(ctx, cx, cy - 6, 3, 3);
    ctx.fill();
  }

  drawBatQueen(b) {
    const ctx = this.ctx;
    const cx = b.cx;
    const cy = b.cy;
    const flap = b.flap || 0;
    const aura = b.phase === 2 ? 1.3 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 150 * aura);
    g.addColorStop(0, rgba('#c08bff', 0.14));
    g.addColorStop(1, rgba('#c08bff', 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - 170, cy - 170, 340, 340);
    ctx.restore();

    for (const side of [-1, 1]) {
      ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#2a1c3f';
      ctx.beginPath();
      ctx.moveTo(cx + side * 8, cy - 10);
      ctx.quadraticCurveTo(cx + side * 74, cy - 82 + flap * 24, cx + side * 132, cy - 20 + flap * 38);
      ctx.quadraticCurveTo(cx + side * 96, cy + 2 + flap * 16, cx + side * 108, cy + 48 + flap * 22);
      ctx.quadraticCurveTo(cx + side * 54, cy + 26, cx + side * 14, cy + 22);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#b07af0', 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + side * 10, cy - 6);
      ctx.quadraticCurveTo(cx + side * 70, cy - 50 + flap * 20, cx + side * 120, cy - 12 + flap * 34);
      ctx.stroke();
    }
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#241833';
    ellipse(ctx, cx, cy + 4, 30, 36);
    ctx.fill();
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#4a2f66';
    ellipse(ctx, cx, cy + 10, 20, 26);
    ctx.fill();
    ctx.fillStyle = '#241833';
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 22);
    ctx.lineTo(cx - 16, cy - 56);
    ctx.lineTo(cx - 2, cy - 28);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy - 22);
    ctx.lineTo(cx + 16, cy - 56);
    ctx.lineTo(cx + 2, cy - 28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = b.state === 'dive' ? '#ffffff' : b.state === 'recover' ? '#ffd76a' : '#ff7ad0';
    ellipse(ctx, cx - 11, cy - 4, 5, 7);
    ctx.fill();
    ellipse(ctx, cx + 11, cy - 4, 5, 7);
    ctx.fill();
    ctx.fillStyle = '#1c1024';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 18);
    ctx.lineTo(cx - 3, cy + 28);
    ctx.lineTo(cx + 2, cy + 18);
    ctx.lineTo(cx + 7, cy + 28);
    ctx.lineTo(cx + 10, cy + 18);
    ctx.closePath();
    ctx.fill();
    // crown
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 36);
    ctx.lineTo(cx - 22, cy - 54);
    ctx.lineTo(cx - 8, cy - 45);
    ctx.lineTo(cx, cy - 60);
    ctx.lineTo(cx + 8, cy - 45);
    ctx.lineTo(cx + 22, cy - 54);
    ctx.lineTo(cx + 18, cy - 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8862f';
    ctx.fillRect(cx - 18, cy - 38, 36, 4);
    if (b.state === 'tele') {
      ctx.strokeStyle = rgba('#ff9be0', 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 58 + Math.sin(this.t * 20) * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (b.state === 'recover') {
      ctx.fillStyle = '#ffe28a';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i / 3) * Math.PI * 2;
        ellipse(ctx, cx + Math.cos(a) * 34, cy - 56 + Math.sin(a) * 5, 2.5, 2.5);
        ctx.fill();
      }
    }
  }

  drawMonarch(b) {
    const ctx = this.ctx;
    const cx = b.cx;
    const feet = b.y + b.h;
    const sway = b.state === 'stunned' ? Math.sin(this.t * 18) * 0.08 : Math.sin(this.t * 1.6) * 0.02;
    ctx.save();
    ctx.translate(cx, feet);
    ctx.rotate(sway);
    // robe
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#3c2c52';
    ctx.beginPath();
    ctx.moveTo(-16, -76);
    ctx.quadraticCurveTo(-38, -38, -48, 0);
    ctx.lineTo(48, 0);
    ctx.quadraticCurveTo(38, -38, 16, -76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(143,247,223,0.2)';
    ctx.beginPath();
    ctx.moveTo(-8, -70);
    ctx.quadraticCurveTo(-12, -40, -18, -4);
    ctx.lineTo(-6, -4);
    ctx.quadraticCurveTo(-4, -38, 0, -70);
    ctx.closePath();
    ctx.fill();
    // staff
    ctx.strokeStyle = '#6d4f2c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(46, 2);
    ctx.lineTo(54, -96);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(54, -104, 2, 54, -104, 46);
    glow.addColorStop(0, 'rgba(143,247,223,0.5)');
    glow.addColorStop(1, 'rgba(143,247,223,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(8, -150, 92, 92);
    ctx.restore();
    ctx.fillStyle = '#8ff7df';
    ellipse(ctx, 54, -104, 8, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 52, -106, 2.5, 2.5);
    ctx.fill();
    // arms
    ctx.strokeStyle = b.flash > 0 ? '#ffffff' : '#5a4372';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, -58);
    ctx.lineTo(-42, -32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24, -58);
    ctx.lineTo(42, -48);
    ctx.stroke();
    // cap
    const capY = -96;
    const capW = 74;
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#b24a5e';
    ctx.beginPath();
    ctx.ellipse(0, capY, capW, 46, 0, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(capW * 0.2, capY + 18, -capW, capY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.7)';
    ellipse(ctx, -32, capY - 18, 9, 7);
    ctx.fill();
    ellipse(ctx, 12, capY - 28, 6, 5);
    ctx.fill();
    ellipse(ctx, 38, capY - 10, 7, 5);
    ctx.fill();
    ctx.fillStyle = '#e8d8b8';
    ctx.beginPath();
    ctx.moveTo(-20, capY + 14);
    ctx.quadraticCurveTo(0, capY + 22, 20, capY + 14);
    ctx.lineTo(18, capY + 30);
    ctx.quadraticCurveTo(0, capY + 36, -18, capY + 30);
    ctx.closePath();
    ctx.fill();
    // face
    ctx.fillStyle = '#2a1f33';
    ellipse(ctx, -14, capY + 30, 5, 6);
    ctx.fill();
    ellipse(ctx, 14, capY + 30, 5, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ellipse(ctx, -14, capY + 31, 2.4, 3);
    ctx.fill();
    ellipse(ctx, 14, capY + 31, 2.4, 3);
    ctx.fill();
    ctx.strokeStyle = '#2a1f33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, capY + 43);
    ctx.quadraticCurveTo(0, capY + 48, 8, capY + 43);
    ctx.stroke();
    // crown
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(-24, capY - 34);
    ctx.lineTo(-30, capY - 58);
    ctx.lineTo(-12, capY - 44);
    ctx.lineTo(0, capY - 66);
    ctx.lineTo(12, capY - 44);
    ctx.lineTo(30, capY - 58);
    ctx.lineTo(24, capY - 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8862f';
    ctx.fillRect(-24, capY - 36, 48, 5);
    ctx.restore();

    if (b.state === 'stunned') {
      ctx.fillStyle = '#ffe28a';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + (i / 3) * Math.PI * 2;
        ellipse(ctx, cx + Math.cos(a) * 34, b.y - 12 + Math.sin(a) * 6, 3, 3);
        ctx.fill();
      }
    }
    if (b.state === 'windup') {
      ctx.strokeStyle = rgba('#ff8a5b', 0.5);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, feet - 20, 80 + Math.sin(this.t * 25) * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPlayer(p) {
    const ctx = this.ctx;
    if (p.invuln > 0 && Math.floor(this.t * 24) % 2 === 0 && this.game.state === 'playing') {
      ctx.globalAlpha = 0.55;
    }
    if (p.dashT > 0) {
      ctx.save();
      ctx.globalAlpha *= 0.18;
      ctx.translate(-p.facing * 16, 0);
      this.drawKnight(p, p.dashDir || p.facing);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= 0.1;
      ctx.translate(-p.facing * 30, 0);
      this.drawKnight(p, p.dashDir || p.facing);
      ctx.restore();
    }
    this.drawKnight(p, p.facing);
    ctx.globalAlpha = 1;
  }

  drawKnight(p, facing) {
    const ctx = this.ctx;
    const armor = p.armorTier > 0 ? ARMOR[p.armorTier - 1].colors : p0;
    const cx = p.x + p.w / 2;
    const feet = p.y + p.h;
    const moving = Math.abs(p.vx) > 25 && p.onGround;
    const walk = moving ? Math.sin(p.anim * 2.1) : 0;
    const bob = moving ? Math.abs(Math.sin(p.anim * 2.1)) * 1.4 : Math.sin(this.t * 2) * 0.6;
    const air = !p.onGround;
    const attackPhase = p.attackT > 0 ? 1 - p.attackT / 0.26 : -1;

    ctx.save();
    ctx.translate(cx, feet + bob);

    if (p.armorTier >= 3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, -20, 2, 0, -20, 45);
      g.addColorStop(0, 'rgba(143,247,223,0.18)');
      g.addColorStop(1, 'rgba(143,247,223,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-50, -70, 100, 100);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ellipse(ctx, 0, 0, 16, 4);
    ctx.fill();

    ctx.scale(facing, 1);

    // cape
    const capeSwing = Math.sin(this.t * 5 + (moving ? p.anim : 0)) * 4 + (air ? -6 : 0);
    ctx.fillStyle = armor.cloth;
    ctx.beginPath();
    ctx.moveTo(-2, -29);
    ctx.quadraticCurveTo(-16 - Math.abs(p.vx) * 0.02, -18 + capeSwing, -12 - Math.abs(p.vx) * 0.025, -2 + capeSwing * 0.5);
    ctx.lineTo(-3, -4);
    ctx.lineTo(1, -12);
    ctx.closePath();
    ctx.fill();

    // back arm
    ctx.strokeStyle = armor.cloth;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -23);
    ctx.lineTo(-9, -12 + (moving ? walk * 2 : 0));
    ctx.stroke();

    // legs
    const legLift = moving ? walk * 4 : 0;
    ctx.fillStyle = '#2e2a25';
    roundRect(ctx, -7, -10 + Math.max(0, legLift), 6, 10 - Math.max(0, legLift), 2);
    ctx.fill();
    roundRect(ctx, 1, -10 + Math.max(0, -legLift), 6, 10 - Math.max(0, -legLift), 2);
    ctx.fill();
    ctx.fillStyle = armor.trim;
    ctx.fillRect(-7, -3 + Math.max(0, legLift), 6, 2);
    ctx.fillRect(1, -3 + Math.max(0, -legLift), 6, 2);

    // torso
    ctx.fillStyle = armor.plate;
    roundRect(ctx, -8, -28, 16, 20, 5);
    ctx.fill();
    ctx.fillStyle = armor.cloth;
    roundRect(ctx, -8, -14, 16, 5, 2);
    ctx.fill();
    ctx.fillStyle = armor.trim;
    ctx.fillRect(-2, -13, 4, 3);
    ctx.strokeStyle = rgba(armor.trim, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(0, -16);
    ctx.stroke();

    // shoulders
    ctx.fillStyle = armor.plate;
    ellipse(ctx, -8.5, -25, 5, 4);
    ctx.fill();
    ellipse(ctx, 8.5, -25, 5, 4);
    ctx.fill();
    ctx.fillStyle = armor.trim;
    ellipse(ctx, -8.5, -26.5, 4, 2);
    ctx.fill();
    ellipse(ctx, 8.5, -26.5, 4, 2);
    ctx.fill();

    // head / helmet
    ctx.fillStyle = armor.plate;
    roundRect(ctx, -6.5, -38, 13, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#171a16';
    roundRect(ctx, 1, -34.5, 6.5, 4, 1.5);
    ctx.fill();
    ctx.fillStyle = armor.eye || '#ffe082';
    ctx.fillRect(4.5, -33.8, 2.5, 2);
    ctx.fillStyle = armor.trim;
    ctx.fillRect(-6.5, -38, 13, 2);
    // plume
    ctx.fillStyle = armor.plume;
    ctx.beginPath();
    ctx.moveTo(-2, -38);
    ctx.quadraticCurveTo(-14, -44 + Math.sin(this.t * 4) * 2, -12, -52);
    ctx.quadraticCurveTo(-42, -36, -4, -35);
    ctx.closePath();
    ctx.fill();

    // sword arm & blade
    const handX = 8;
    const handY = -20;
    let angle = 0.5;
    if (attackPhase >= 0) angle = -1.7 + attackPhase * 2.7;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(angle);
    ctx.strokeStyle = armor.cloth;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(3, 5);
    ctx.stroke();
    ctx.fillStyle = '#6b5136';
    ctx.fillRect(3, -2, 5, 4);
    const bladeGradient = ctx.createLinearGradient(7, 0, 34, 0);
    bladeGradient.addColorStop(0, '#c8d6da');
    bladeGradient.addColorStop(1, '#f4ffff');
    ctx.fillStyle = bladeGradient;
    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(30, -1.5);
    ctx.lineTo(36, 0);
    ctx.lineTo(30, 1.5);
    ctx.lineTo(8, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (attackPhase > 0.05 && attackPhase < 0.92) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(220,255,250,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(4, -18, 34, -1.5 + attackPhase * 1.2, -1.1 + attackPhase * 2.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(143,247,223,0.35)';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(4, -18, 33, -1.4 + attackPhase * 1.2, -1.1 + attackPhase * 2.1);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  drawProjectile(p) {
    const ctx = this.ctx;
    if (p.x < this.cam.x - 60 || p.x > this.cam.x + this.vw + 60) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.type === 'screech') {
      ctx.rotate(p.spin);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 24);
      g.addColorStop(0, 'rgba(255,140,210,0.4)');
      g.addColorStop(1, 'rgba(255,140,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-26, -26, 52, 52);
      ctx.restore();
      ctx.strokeStyle = '#ff9bd8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0.5, Math.PI * 1.5);
      ctx.stroke();
    } else if (p.type === 'seed') {
      ctx.rotate(p.spin);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 20);
      g.addColorStop(0, 'rgba(192,139,255,0.35)');
      g.addColorStop(1, 'rgba(192,139,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-22, -22, 44, 44);
      ctx.restore();
      ctx.fillStyle = '#7a4f9c';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
        ctx.lineTo(Math.cos(a + 0.6) * 11, Math.sin(a + 0.6) * 11);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffd76a';
      ellipse(ctx, 0, 0, 4.5, 4.5);
      ctx.fill();
    } else {
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, p.r);
      g.addColorStop(0, '#c8ff9a');
      g.addColorStop(1, '#4f9138');
      ctx.fillStyle = g;
      ellipse(ctx, 0, 0, p.r, p.r);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ellipse(ctx, -p.r * 0.3, -p.r * 0.35, p.r * 0.25, p.r * 0.25);
      ctx.fill();
    }
    ctx.restore();
  }

  drawParticles() {
    const ctx = this.ctx;
    for (const p of this.game.particles) {
      if (p.x < this.cam.x - 40 || p.x > this.cam.x + this.vw + 40) continue;
      if (p.y < this.cam.y - 40 || p.y > this.cam.y + this.vh + 40) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(p.color, a * 0.18);
        ellipse(ctx, p.x, p.y, p.size * 2.6, p.size * 2.6);
        ctx.fill();
      }
      ctx.fillStyle = rgba(p.color, a);
      ellipse(ctx, p.x, p.y, p.size * 0.75, p.size * 0.75);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTexts() {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.game.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.font = '700 15px "Palatino Linotype", Palatino, Georgia, serif';
      ctx.fillStyle = rgba('#08120e', a * 0.65);
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = rgba(t.color, a);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  drawForegroundFlora() {
    const ctx = this.ctx;
    const theme = this.theme;
    const layers = [
      { spacing: 210, p: 1.06, scale: 0.6, alpha: 0.42, color: theme.near },
      { spacing: 300, p: 1.2, scale: 0.86, alpha: 0.7, color: theme.groundDark }
    ];
    const baseY = this.vh + 5;

    layers.forEach((L, li) => {
      const color = rgba(L.color, L.alpha);
      this.layer(L.spacing, L.p, (x, i) => {
        const seed = i * 13.7 + li * 31.1;
        const pick = hash(seed);
        const h = (26 + hash(seed + 4.2) * 46) * L.scale;
        ctx.save();
        if (pick < 0.4) {
          // grass tuft
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          for (let b = 0; b < 7; b++) {
            const bx = x + (hash(seed + b * 3.1) - 0.5) * 30;
            const bh = h * (0.45 + hash(seed + b * 5.7) * 0.7);
            const lean = (hash(seed + b * 7.3) - 0.5) * 18;
            ctx.beginPath();
            ctx.moveTo(bx, baseY);
            ctx.quadraticCurveTo(bx + lean * 0.3, baseY - bh * 0.6, bx + lean, baseY - bh);
            ctx.stroke();
          }
        } else if (pick < 0.68) {
          // fern
          const sway = (hash(seed + 8.1) - 0.5) * 20;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, baseY);
          ctx.quadraticCurveTo(x + sway * 0.3, baseY - h * 0.55, x + sway, baseY - h);
          ctx.stroke();
          ctx.fillStyle = color;
          for (let f = 0; f < 5; f++) {
            const t = 0.24 + f * 0.14;
            const px = x + sway * t;
            const py = baseY - h * t;
            const len = h * 0.26 * (1 - t * 0.45) * (0.75 + hash(seed + f) * 0.5);
            for (const side of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.quadraticCurveTo(px + side * len * 0.7, py - len * 0.32, px + side * len, py - len * 0.55);
              ctx.quadraticCurveTo(px + side * len * 0.5, py + len * 0.05, px, py);
              ctx.closePath();
              ctx.fill();
            }
          }
        } else if (pick < 0.87) {
          // mushroom silhouette
          const stemW = 4 + h * 0.065;
          ctx.fillStyle = color;
          roundRect(ctx, x - stemW / 2, baseY - h * 0.58, stemW, h * 0.58, stemW / 2);
          ctx.fill();
          ellipse(ctx, x, baseY - h * 0.6, h * 0.31, h * 0.16);
          ctx.fill();
          ctx.strokeStyle = rgba(theme.cap, 0.32);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(x, baseY - h * 0.605, h * 0.3, h * 0.145, 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = rgba(theme.cap2, 0.18);
          ellipse(ctx, x - h * 0.09, baseY - h * 0.66, h * 0.06, h * 0.035);
          ctx.fill();
          ellipse(ctx, x + h * 0.11, baseY - h * 0.62, h * 0.045, h * 0.028);
          ctx.fill();
        } else {
          // mossy rock
          ctx.fillStyle = color;
          ellipse(ctx, x, baseY - h * 0.18, h * 0.34, h * 0.22);
          ctx.fill();
          ctx.fillStyle = rgba(theme.cap, 0.14);
          ellipse(ctx, x - h * 0.06, baseY - h * 0.26, h * 0.18, h * 0.07);
          ctx.fill();
        }
        ctx.restore();
      });
    });

    // soft foreground spore lights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = (hash(i * 9.1 + 4.4) * this.vw + this.t * (4 + i * 2) + this.cam.x * 0.05) % this.vw;
      const y = this.vh * (0.74 + hash(i * 5.3) * 0.2) + Math.sin(this.t * 0.7 + i) * 8;
      const a = 0.16 + 0.12 * (0.5 + 0.5 * Math.sin(this.t * 1.3 + i * 2));
      const col = i % 3 === 0 ? theme.warm : theme.accent;
      ctx.fillStyle = rgba(col, a * 0.5);
      ellipse(ctx, x, y, 7, 7);
      ctx.fill();
      ctx.fillStyle = rgba(col, a);
      ellipse(ctx, x, y, 1.6, 1.6);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWeather() {
    const ctx = this.ctx;
    const theme = this.theme;
    const kind = this.level.theme;
    ctx.save();
    if (kind === 'summit') {
      ctx.fillStyle = 'rgba(232,240,255,0.8)';
      for (let i = 0; i < 44; i++) {
        const speed = 14 + hash(i * 3.1) * 34;
        const x =
          (hash(i * 7.7) * this.vw + Math.sin(this.t * 0.35 + i) * 20 + this.vw) % this.vw;
        const y = (hash(i * 5.1) * this.vh + this.t * speed) % (this.vh + 30) - 15;
        const s = 0.7 + hash(i * 2.3) * 2;
        ctx.globalAlpha = 0.18 + hash(i * 4.9) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'forest') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const speed = 5 + hash(i * 2.7) * 9;
        const x =
          (hash(i * 6.1) * this.vw + Math.sin(this.t * 0.5 + i * 1.7) * 26 + this.t * speed) % this.vw;
        const y = (hash(i * 8.3) * this.vh + this.t * speed * 0.6) % this.vh;
        const a = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(this.t * 1.6 + i));
        ctx.fillStyle = rgba(i % 3 === 0 ? theme.warm : theme.accent, a);
        ellipse(ctx, x, y, 1.4 + hash(i) * 1.4, 1.4 + hash(i) * 1.4);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 18; i++) {
        const speed = 8 + hash(i * 3.3) * 20;
        const x = (hash(i * 7.1) * this.vw + Math.sin(this.t * 0.3 + i) * 16 + this.vw) % this.vw;
        const y = (hash(i * 5.7) * this.vh + this.t * speed) % (this.vh + 20) - 10;
        const a = 0.12 + hash(i * 2.9) * 0.24;
        ctx.fillStyle = rgba(i % 4 === 0 ? theme.warm : theme.accent, a);
        ellipse(ctx, x, y, 1 + hash(i) * 1.6, 2 + hash(i * 2.1) * 3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawForeground() {
    const ctx = this.ctx;
    // ground / bottom fog
    const fog = ctx.createLinearGradient(0, this.vh * 0.72, 0, this.vh + 20);
    fog.addColorStop(0, rgba(this.theme.fog, 0));
    fog.addColorStop(1, rgba(this.theme.fog, 0.52));
    ctx.fillStyle = fog;
    ctx.fillRect(0, this.vh * 0.72, this.vw, this.vh * 0.4);

    this.drawForegroundFlora();
    this.drawWeather();

    // battle tension at the edges of the screen
    if (this.game.bossActive && !this.game.bossDead) {
      const pulse = 0.7 + Math.sin(this.t * 2.2) * 0.3;
      const danger = ctx.createRadialGradient(
        this.vw / 2,
        this.vh / 2,
        Math.min(this.vw, this.vh) * 0.3,
        this.vw / 2,
        this.vh / 2,
        Math.max(this.vw, this.vh) * 0.72
      );
      danger.addColorStop(0, 'rgba(0,0,0,0)');
      danger.addColorStop(1, `rgba(78,12,20,${0.22 * pulse})`);
      ctx.fillStyle = danger;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    // vignette
    const vg = ctx.createRadialGradient(
      this.vw / 2,
      this.vh / 2,
      Math.min(this.vw, this.vh) * 0.28,
      this.vw / 2,
      this.vh / 2,
      Math.max(this.vw, this.vh) * 0.78
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.vw, this.vh);

    if (this.game.state === 'title') {
      ctx.fillStyle = 'rgba(4,10,10,0.28)';
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    if (this.game.flashHurt > 0) {
      ctx.fillStyle = `rgba(180,30,40,${this.game.flashHurt * 0.4})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }

    if (this.level.theme === 'forest') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const x = this.vw * (0.16 + i * 0.3) - ((this.cam.x * 0.4) % (this.vw * 0.9));
        const g = ctx.createLinearGradient(x, 0, x + 140, this.vh);
        g.addColorStop(0, 'rgba(255,220,160,0.04)');
        g.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 60, 0);
        ctx.lineTo(x + 220, this.vh);
        ctx.lineTo(x + 120, this.vh);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
