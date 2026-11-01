import {
  TILE,
  GRAVITY,
  MOVE_SPEED,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  DASH_SPEED,
  ARMOR,
  approach,
  clamp,
  overlap,
  lerp,
  sign
} from './constants.js';
import { moveBody, hazardAt } from './physics.js';
import { burst, dust } from './effects.js';

const ENEMY_SPECS = {
  slime: { w: 38, h: 30, hp: 4 },
  beetle: { w: 42, h: 26, hp: 7 },
  bat: { w: 36, h: 26, hp: 3 },
  spitter: { w: 32, h: 44, hp: 4 }
};

export class Player {
  constructor(x, y, armorTier = 0) {
    this.w = 26;
    this.h = 38;
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.jumpHeld = false;
    this.airJumps = 0;
    this.dropTimer = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.attackT = 0;
    this.attackCd = 0;
    this.hitSet = new Set();
    this.invuln = 0;
    this.anim = 0;
    this.stepPhase = 0;
    this.dead = false;
    this.armorTier = 0;
    this.maxHp = 3;
    this.hp = 3;
    this.setArmorTier(armorTier, true);
  }

  setArmorTier(tier, heal = false) {
    this.armorTier = clamp(tier, 0, ARMOR.length);
    const bonus = this.armorTier > 0 ? ARMOR[this.armorTier - 1].hearts : 0;
    this.maxHp = 3 + bonus;
    if (heal) this.hp = this.maxHp;
    else this.hp = Math.min(this.hp, this.maxHp);
  }

  respawn(x, y) {
    this.x = x - this.w / 2;
    this.y = y - this.h;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.invuln = 1.4;
    this.dashT = 0;
    this.dashCd = 0;
    this.attackT = 0;
    this.attackCd = 0;
    this.hp = this.maxHp;
    this.dead = false;
    this.dropTimer = 0;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  update(dt, game) {
    this.prevY = this.y;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dropTimer = Math.max(0, this.dropTimer - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.anim += dt * (2 + Math.abs(this.vx) / 55);
    if (this.onGround && Math.abs(this.vx) > 30) this.stepPhase += dt * 12;

    const input = game.input;
    const ax = input.axis();
    if (ax !== 0) this.facing = ax;

    if (input.pressed('jump')) this.jumpBuf = 0.13;

    if (input.pressed('dash') && this.dashCd <= 0 && this.dashT <= 0 && (this.onGround || this.airJumps > 0)) {
      this.dashT = 0.16;
      this.dashCd = 0.78;
      this.dashDir = ax !== 0 ? ax : this.facing;
      this.facing = this.dashDir;
      this.invuln = Math.max(this.invuln, 0.18);
      if (!this.onGround) this.airJumps = 0;
      this.vy = 0;
      game.audio.slash();
      burst(game, this.cx, this.cy, {
        count: 8,
        color: '#8ff7df',
        color2: '#ffffff',
        speed: 160,
        dir: this.dashDir > 0 ? Math.PI : 0,
        spread: 1.4,
        life: 0.35,
        gravity: 0,
        glow: true,
        size: 2.5
      });
    }

    if (this.dashT > 0) {
      this.dashT = Math.max(0, this.dashT - dt);
      this.vx = this.dashDir * DASH_SPEED;
      this.vy = 0;
      this.onGround = false;
      if (game.time % 0.03 < dt) dust(game, this.cx, this.y + this.h - 4, 1, '#b9f5e6');
    } else {
      const accel = this.onGround ? 2400 : 1650;
      if (ax !== 0) this.vx = approach(this.vx, ax * MOVE_SPEED, accel * dt);
      else this.vx = approach(this.vx, 0, (this.onGround ? 2800 : 950) * dt);

      this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);

      if (this.jumpBuf > 0) {
        if (this.onGround || this.coyote > 0) {
          this.vy = -JUMP_VELOCITY;
          this.jumpBuf = 0;
          this.coyote = 0;
          this.onGround = false;
          game.audio.jump();
          dust(game, this.cx, this.y + this.h, 4);
        } else if (this.airJumps > 0) {
          this.airJumps -= 1;
          this.vy = -DOUBLE_JUMP_VELOCITY;
          this.jumpBuf = 0;
          game.audio.airJump();
          burst(game, this.cx, this.y + this.h - 6, {
            count: 10,
            color: '#8ff7df',
            color2: '#ffe28a',
            speed: 150,
            life: 0.4,
            gravity: 0,
            glow: true,
            size: 2.5
          });
        }
      }

      if (!input.isDown('jump') && this.vy < -170) this.vy += GRAVITY * 1.15 * dt;
      this.vy = Math.min(this.vy + GRAVITY * dt, 1500);
    }

    if (input.pressed('attack') && this.attackCd <= 0 && this.dashT <= 0) {
      this.attackT = 0.26;
      this.attackCd = 0.3;
      this.hitSet = new Set();
      game.audio.slash();
    }

    const wasGround = this.onGround;
    const fallSpeed = this.vy;
    const res = moveBody(this, this.vx * dt, this.vy * dt, game.level, {
      oneWay: true,
      dropTimer: this.dropTimer
    });
    if (res.hitX) this.vx = 0;
    if (res.hitY) this.vy = Math.max(0, this.vy);
    if (res.onGround) {
      if (!wasGround && fallSpeed > 260) {
        dust(game, this.cx, this.y + this.h, 6);
        game.audio.thud();
      }
      this.onGround = true;
      this.vy = 0;
      this.airJumps = this.armorTier >= 3 ? 1 : 0;
    } else {
      this.onGround = false;
    }

    if (this.dashT > 0) this.onGround = false;

    this.x = clamp(this.x, 2, game.level.widthPx - this.w - 2);

    if (this.attackT > 0) {
      const phase = 0.26 - this.attackT;
      if (phase > 0.02 && phase < 0.2) {
        const hb = {
          x: this.facing > 0 ? this.x + this.w - 4 : this.x - 58,
          y: this.y - 10,
          w: 62,
          h: this.h + 16
        };
        game.playerStrike(hb, this);
      }
      this.attackT = Math.max(0, this.attackT - dt);
    }

    if (this.invuln <= 0 && this.dashT <= 0) {
      const hazard = hazardAt(this, game.level);
      if (hazard) this.hurt(1, hazard.x, game, true);
    }

    if (this.y > game.level.heightPx + 140) game.playerDown(true);
  }

  hurt(dmg, fromX, game, isSpike = false) {
    if (this.invuln > 0 || game.state !== 'playing') return false;
    this.hp -= dmg;
    this.invuln = 1.15;
    const dir = this.cx < fromX ? -1 : 1;
    this.vx = dir * 250;
    this.vy = isSpike ? -420 : -320;
    this.onGround = false;
    game.audio.hurt();
    game.shake = Math.max(game.shake, 11);
    game.hitstop = 0.055;
    game.flashHurt = 0.35;
    burst(game, this.cx, this.cy, {
      count: 12,
      color: '#ff6b6b',
      color2: '#ffd76a',
      speed: 260,
      life: 0.45,
      gravity: 500,
      size: 3.4
    });
    if (this.hp <= 0) {
      this.hp = 0;
      game.playerDown(false);
    }
    return true;
  }
}

export class Enemy {
  constructor(def, game) {
    const spec = ENEMY_SPECS[def.type] || ENEMY_SPECS.slime;
    this.type = def.type;
    this.w = spec.w;
    this.h = spec.h;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.spawn = { ...def };
    this.x = def.x - this.w / 2;
    this.y = def.y - this.h;
    if (def.type === 'bat') this.y = def.y - this.h - 14;
    this.anchorX = def.x;
    this.anchorY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.onGround = false;
    this.flash = 0;
    this.t = Math.random() * 2;
    this.phase = Math.random() * Math.PI * 2;
    this.hopT = 0.4 + Math.random();
    this.castT = 0;
    this.castDelay = 1.2 + Math.random();
    this.dead = false;
    this.flap = 0;
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  reset() {
    this.hp = this.maxHp;
    this.x = this.spawn.x - this.w / 2;
    this.y = this.spawn.y - this.h;
    if (this.type === 'bat') this.y = this.spawn.y - this.h - 14;
    this.vx = 0;
    this.vy = 0;
    this.flash = 0;
    this.dead = false;
    this.castT = 0;
    this.dir = -1;
    this.t = Math.random() * 2;
  }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    this.t += dt;
    if (this.type === 'slime') this.updateSlime(dt, game);
    else if (this.type === 'beetle') this.updateBeetle(dt, game);
    else if (this.type === 'bat') this.updateBat(dt, game);
    else if (this.type === 'spitter') this.updateSpitter(dt, game);
  }

  updateSlime(dt, game) {
    if (this.onGround) {
      this.vx = approach(this.vx, 0, 700 * dt);
      this.hopT -= dt;
      if (this.hopT <= 0) {
        this.hopT = 0.9 + Math.random() * 0.7;
        const p = game.player;
        const dx = p.cx - this.cx;
        this.dir = Math.abs(dx) < 380 ? sign(dx) || 1 : Math.random() < 0.5 ? -1 : 1;
        this.vx = this.dir * 105;
        this.vy = -400;
        this.onGround = false;
      }
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, 1200);
    const res = moveBody(this, this.vx * dt, this.vy * dt, game.level);
    if (res.hitX) this.vx = 0;
    if (res.onGround) {
      this.onGround = true;
      this.vy = 0;
      this.vx *= 0.5;
    } else {
      this.onGround = false;
    }
  }

  updateBeetle(dt, game) {
    const p = game.player;
    const dx = p.cx - this.cx;
    if (Math.abs(dx) < 330 && Math.abs(p.y + p.h - (this.y + this.h)) < 80) {
      this.dir = sign(dx) || this.dir;
    }
    if (this.onGround) {
      this.vx = this.dir * 82;
      const aheadX = this.dir > 0 ? this.x + this.w + 6 : this.x - 6;
      const belowY = this.y + this.h + 8;
      const tx = Math.floor(aheadX / TILE);
      const ty = Math.floor(belowY / TILE);
      const supported = game.level.isSolid(tx, ty) || game.level.isOneWay(tx, ty) || game.level.isOneWay(tx, ty - 1);
      if (!supported) {
        this.dir *= -1;
        this.vx = 0;
      }
    }
    this.vy = Math.min(this.vy + GRAVITY * dt, 1200);
    const res = moveBody(this, this.vx * dt, this.vy * dt, game.level);
    if (res.hitX) {
      this.dir *= -1;
      this.vx = 0;
    }
    if (res.onGround) {
      this.onGround = true;
      this.vy = 0;
    } else {
      this.onGround = false;
    }
  }

  updateBat(dt, game) {
    const p = game.player;
    this.flap = Math.sin(this.t * 14);
    const dx = p.cx - this.cx;
    const dy = p.y + p.h / 2 - this.cy;
    const dist = Math.hypot(dx, dy) || 1;
    let tx;
    let ty;
    let speed;
    if (dist < 440 && game.state === 'playing') {
      tx = p.cx - Math.sin(this.t * 2.2) * 26;
      ty = p.y + p.h / 2 - 18;
      speed = 175;
    } else {
      tx = this.anchorX + Math.cos(this.t * 0.8 + this.phase) * 68;
      ty = this.anchorY + this.h / 2 + Math.sin(this.t * 1.5 + this.phase) * 32;
      speed = 55;
    }
    this.x += clamp(tx - this.cx, -speed * dt, speed * dt);
    this.y += clamp(ty - this.cy, -speed * dt, speed * dt);
    this.x = clamp(this.x, 8, game.level.widthPx - this.w - 8);
    this.y = clamp(this.y, 20, game.level.heightPx - this.h - 20);
  }

  updateSpitter(dt, game) {
    const p = game.player;
    const dx = p.cx - this.cx;
    const dy = p.y + p.h / 2 - (this.y + 12);
    const dist = Math.hypot(dx, dy);
    if (this.castT > 0) {
      this.castT -= dt;
      if (this.castT <= 0) {
        const len = Math.hypot(dx, dy) || 1;
        game.spawnProjectile({
          x: this.cx,
          y: this.y + 10,
          vx: (dx / len) * 255,
          vy: (dy / len) * 255,
          r: 8,
          type: 'seed',
          life: 4
        });
        game.audio.shoot();
      }
    } else {
      this.castDelay -= dt;
      if (this.castDelay <= 0 && dist < 520) {
        this.castT = 0.5;
        this.castDelay = 1.9 + Math.random() * 0.6;
      }
    }
  }

  hurt(dmg, dir, game) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.15;
    this.vx = dir * 190;
    this.vy = this.type === 'bat' ? -60 : -130;
    burst(game, this.cx, this.cy, {
      count: 7,
      color: '#ffe9a8',
      color2: '#ff9f6b',
      speed: 210,
      life: 0.35,
      gravity: 500,
      size: 2.6
    });
    game.audio.hit();
    game.addText(this.cx, this.y - 4, `${dmg}`, '#ffe9a8');
    if (this.hp <= 0) {
      this.dead = true;
      game.onEnemyKilled(this);
    }
  }
}

export class Projectile {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.vx = def.vx;
    this.vy = def.vy;
    this.r = def.r || 9;
    this.gravity = def.gravity || 0;
    this.life = def.life || 5;
    this.type = def.type || 'goo';
    this.dead = false;
    this.spin = Math.random() * 6;
    this.t = 0;
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.spin += dt * 6;

    const tx = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    if (game.level.isSolid(tx, ty)) {
      this.burst(game);
      return;
    }

    const p = game.player;
    if (p && overlap({ x: this.x - this.r, y: this.y - this.r, w: this.r * 2, h: this.r * 2 }, p)) {
      p.hurt(1, this.x, game);
      this.burst(game);
      return;
    }

    if (this.y > game.level.heightPx + 80) this.dead = true;
  }

  burst(game) {
    if (this.dead) return;
    this.dead = true;
    const colors = {
      goo: ['#8ee05f', '#d8ff8a'],
      seed: ['#c08bff', '#ffd76a'],
      screech: ['#ff86c8', '#ffd3ef'],
      rock: ['#a99578', '#e0cba4']
    };
    const [a, b] = colors[this.type] || colors.goo;
    burst(game, this.x, this.y, {
      count: 8,
      color: a,
      color2: b,
      speed: 150,
      life: 0.4,
      gravity: 500,
      size: 2.6,
      glow: this.type === 'screech'
    });
  }
}

export class Pickup {
  constructor(def) {
    this.type = def.type;
    this.value = def.value || 1;
    this.big = !!def.big;
    this.x = def.x;
    this.y = def.y;
    this.baseY = def.y;
    this.t = Math.random() * 8;
    this.seed = Math.random() * 6;
    this.dead = false;
    this.r = this.big ? 16 : 11;
  }

  update(dt, game) {
    if (this.dead) return;
    this.t += dt;
    this.y = this.baseY + Math.sin(this.t * 2.4 + this.seed) * 5;
    this.x += Math.sin(this.t * 1.7 + this.seed) * 4 * dt;

    const p = game.player;
    if (!p) return;
    const dx = p.cx - this.x;
    const dy = p.cy - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 105) {
      const pull = 420 * (1 - d / 130);
      this.x += (dx / d) * pull * dt;
      this.y += (dy / d) * pull * dt;
      this.baseY = this.y;
    }
    if (d < 27) {
      this.dead = true;
      game.collectPickup(this);
    }
  }
}

export class Boss {
  constructor(kind, arena, game) {
    this.kind = kind;
    this.arena = arena;
    this.game = game;
    this.w = kind === 'mushroomMonarch' ? 122 : kind === 'slimeKing' ? 114 : 100;
    this.h = kind === 'mushroomMonarch' ? 118 : kind === 'slimeKing' ? 82 : 64;
    this.maxHp = kind === 'mushroomMonarch' ? 88 : kind === 'batQueen' ? 56 : 50;
    this.hp = this.maxHp;
    this.x = arena.x0 + arena.w / 2 - this.w / 2;
    this.y = kind === 'batQueen' ? arena.groundY - 265 : arena.groundY - this.h;
    this.groundY = arena.groundY;
    this.vx = 0;
    this.vy = 0;
    this.intro = 1.2;
    this.flash = 0;
    this.dying = false;
    this.deathT = 0;
    this.phase = 1;
    this.state = 'idle';
    this.timer = 1.3;
    this.stateT = 0;
    this.dir = 1;
    this.enraged = false;
    this.t = 0;
    this.flap = 0;
    this.squash = 0;
    this.angle = 0;
    this.rainT = 0;
    this.spawnT = 0;
    this.hoverY = this.y;
    this.name = kind === 'slimeKing' ? 'The Slime King' : kind === 'batQueen' ? 'The Bat Queen' : 'The Mushroom Monarch';
  }

  get cx() {
    return this.x + this.w / 2;
  }

  get cy() {
    return this.y + this.h / 2;
  }

  contactDamage() {
    if (this.intro > 0 || this.dying) return 0;
    if (this.kind === 'batQueen' && this.state !== 'dive') return 0;
    return 1;
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);

    if (this.dying) {
      this.deathT += dt;
      if (Math.random() < dt * 14) {
        burst(game, this.cx + (Math.random() - 0.5) * this.w, this.cy + (Math.random() - 0.5) * this.h, {
          count: 8,
          color: '#ffe28a',
          color2: this.kind === 'batQueen' ? '#c08bff' : '#8ff7df',
          speed: 240,
          life: 0.6,
          gravity: 300,
          size: 4,
          glow: true
        });
      }
      return;
    }

    if (this.intro > 0) {
      this.intro -= dt;
      this.squash = Math.sin(this.t * 8) * 0.04;
      if (this.intro <= 0) game.audio.bossRoar();
      return;
    }

    this.phase = this.hp <= this.maxHp / 2 ? 2 : 1;

    if (this.kind === 'slimeKing') this.updateSlimeKing(dt, game);
    else if (this.kind === 'batQueen') this.updateBatQueen(dt, game);
    else this.updateMonarch(dt, game);

    this.x = clamp(this.x, this.arena.x0 + 10, this.arena.x1 - this.w - 10);
  }

  updateSlimeKing(dt, game) {
    const p = game.player;
    if (this.state === 'idle') {
      this.y = this.groundY - this.h;
      this.vx = 0;
      this.squash = Math.sin(this.t * 5) * 0.03;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'crouch';
        this.timer = 0.34;
        this.dir = sign(p.cx - this.cx) || 1;
      }
    } else if (this.state === 'crouch') {
      this.y = this.groundY - this.h;
      this.squash = -0.12;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'air';
        this.squash = 0;
        this.vy = -780;
        this.vx = this.dir * (this.phase === 2 ? 285 : 215);
        game.audio.jump();
      }
    } else if (this.state === 'air') {
      this.vy += GRAVITY * 0.95 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.squash = clamp(-this.vy / 3000, -0.08, 0.08);

      if (this.x <= this.arena.x0 + 12) {
        this.x = this.arena.x0 + 12;
        this.vx = Math.abs(this.vx);
      }
      if (this.x + this.w >= this.arena.x1 - 12) {
        this.x = this.arena.x1 - this.w - 12;
        this.vx = -Math.abs(this.vx);
      }

      if (this.y + this.h >= this.groundY) {
        this.y = this.groundY - this.h;
        this.vy = 0;
        this.state = 'idle';
        this.squash = 0.16;
        this.timer = this.phase === 2 ? 0.7 : 1.2;
        game.shake = Math.max(game.shake, 12);
        game.hitstop = 0.035;
        game.audio.thud();
        dust(game, this.cx, this.groundY, 18, '#c8b58a');
        const n = this.phase === 2 ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          game.spawnProjectile({
            x: this.cx + side * 30,
            y: this.groundY - 18,
            vx: side * (120 + i * 60),
            vy: -330,
            gravity: 780,
            r: 10,
            type: 'goo',
            life: 5
          });
        }
        if (this.hp <= this.maxHp * 0.5 && !this.enraged) {
          this.enraged = true;
          for (let i = 0; i < 2; i++) {
            game.spawnEnemyAt('slime', this.cx + (i === 0 ? -130 : 130), this.groundY);
          }
          game.shake = Math.max(game.shake, 14);
        }
      }
    }
  }

  updateBatQueen(dt, game) {
    const p = game.player;
    const arena = this.arena;
    this.flap = Math.sin(this.t * 11) * (this.state === 'dive' ? 1.3 : 1);

    if (this.state === 'idle') {
      this.state = 'hover';
      this.timer = 1.1;
    }

    if (this.state === 'hover') {
      this.angle += dt * 0.75;
      const tx = arena.x0 + arena.w / 2 + Math.cos(this.angle) * Math.min(255, arena.w * 0.32) - this.w / 2;
      const ty = this.groundY - 205 + Math.sin(this.angle * 1.4) * 18;
      this.x = lerp(this.x, tx, 1 - Math.exp(-1.8 * dt));
      this.y = lerp(this.y, ty, 1 - Math.exp(-1.8 * dt));
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.phase === 2 ? 1.5 : 2;
        const roll = Math.random();
        if (roll < 0.55) {
          this.state = 'tele';
          this.stateT = 0.45;
          this.next = 'dive';
        } else if (roll < 0.85 || this.phase === 1) {
          this.state = 'tele';
          this.stateT = 0.52;
          this.next = 'screech';
        } else {
          this.state = 'summon';
          this.stateT = 0.42;
        }
      }
    } else if (this.state === 'tele') {
      this.stateT -= dt;
      this.y += Math.sin(this.t * 30) * 0.8;
      if (this.stateT <= 0) {
        if (this.next === 'dive') {
          const dx = p.cx - this.cx;
          const dy = p.cy - this.cy;
          const len = Math.hypot(dx, dy) || 1;
          this.state = 'dive';
          this.stateT = 0.9;
          this.vx = (dx / len) * 620;
          this.vy = (dy / len) * 620;
          game.audio.shoot();
        } else if (this.next === 'screech') {
          this.screech(game);
          this.state = 'hover';
          this.timer = 1.6;
        } else {
          this.spawnMinions(game);
          this.state = 'hover';
          this.timer = 1.8;
        }
      }
    } else if (this.state === 'dive') {
      this.stateT -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 1.005;
      this.vy *= 1.005;
      const hitWall = this.x < arena.x0 + 8 || this.x + this.w > arena.x1 - 8;
      const hitGround = this.y + this.h > this.groundY - 30;
      if (hitGround) {
        // The queen crashes low enough to punish before she can rise again.
        this.y = this.groundY - this.h - 20;
        this.state = 'recover';
        this.stateT = 0.8;
        this.vx = 0;
        this.vy = 0;
        game.shake = Math.max(game.shake, 10);
        dust(game, this.cx, this.y + this.h, 12, '#b6a5d8');
      } else if (this.stateT <= 0 || hitWall || this.y < 20) {
        this.state = 'rise';
        this.stateT = 0.7;
        game.shake = Math.max(game.shake, 8);
        dust(game, this.cx, this.y + this.h, 8, '#b6a5d8');
      }
      this.x = clamp(this.x, arena.x0 + 8, arena.x1 - this.w - 8);
      this.y = clamp(this.y, 10, this.groundY - this.h - 20);
    } else if (this.state === 'recover') {
      this.stateT -= dt;
      this.y = this.groundY - this.h - 20;
      this.x += Math.sin(this.t * 30) * 0.6;
      if (this.stateT <= 0) {
        this.state = 'rise';
        this.stateT = 0.55;
      }
    } else if (this.state === 'rise') {
      this.stateT -= dt;
      this.y = lerp(this.y, this.groundY - 205, 1 - Math.exp(-3 * dt));
      this.x = lerp(this.x, arena.x0 + arena.w / 2 - this.w / 2, 1 - Math.exp(-1.2 * dt));
      if (this.stateT <= 0) {
        this.state = 'hover';
        this.timer = this.phase === 2 ? 1.2 : 1.7;
      }
    } else if (this.state === 'summon') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.spawnMinions(game);
        this.state = 'hover';
        this.timer = 1.7;
      }
    }

    if (this.hp <= this.maxHp * 0.5 && !this.enraged) {
      this.enraged = true;
      this.spawnMinions(game);
      game.shake = Math.max(game.shake, 14);
    }
  }

  screech(game) {
    const p = game.player;
    const baseA = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    for (let i = -2; i <= 2; i++) {
      const a = baseA + i * 0.24;
      game.spawnProjectile({
        x: this.cx,
        y: this.cy + 10,
        vx: Math.cos(a) * 300,
        vy: Math.sin(a) * 300,
        r: 9,
        type: 'screech',
        life: 3.2
      });
    }
    game.audio.bossRoar();
    game.shake = Math.max(game.shake, 7);
  }

  spawnMinions(game) {
    const arena = this.arena;
    game.spawnEnemyAt('bat', arena.x0 + 100, this.groundY - 260);
    game.spawnEnemyAt('bat', arena.x1 - 100, this.groundY - 220);
  }

  updateMonarch(dt, game) {
    const p = game.player;
    const arena = this.arena;
    this.y = this.groundY - this.h;

    if (this.state === 'idle') {
      const dx = p.cx - this.cx;
      this.dir = sign(dx) || 1;
      this.vx = this.dir * (this.phase === 2 ? 58 : 40);
      this.x += this.vx * dt;
      this.squash = Math.sin(this.t * 4) * 0.02;
      this.timer -= dt;
      if (this.timer <= 0) this.chooseAttack(game);
    } else if (this.state === 'windup') {
      this.squash = -0.1;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'charge';
        this.timer = 1.0;
        this.vx = this.dir * (this.phase === 2 ? 660 : 550);
        this.squash = 0.1;
        game.audio.bossRoar();
      }
    } else if (this.state === 'charge') {
      this.timer -= dt;
      this.x += this.vx * dt;
      const hitWall = this.x < arena.x0 + 8 || this.x + this.w > arena.x1 - 8;
      if (hitWall) {
        this.x = clamp(this.x, arena.x0 + 8, arena.x1 - this.w - 8);
        this.state = 'stunned';
        this.timer = 1.35;
        this.vx = 0;
        game.shake = Math.max(game.shake, 18);
        game.hitstop = 0.08;
        game.audio.thud();
        dust(game, this.cx, this.groundY, 20, '#b9a98a');
      } else if (this.timer <= 0) {
        this.state = 'stunned';
        this.timer = 1.0;
        this.vx = 0;
      }
    } else if (this.state === 'stunned') {
      this.timer -= dt;
      this.squash = Math.sin(this.t * 16) * 0.035;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = this.phase === 2 ? 0.8 : 1.2;
      }
    } else if (this.state === 'cast') {
      this.timer -= dt;
      this.vx = 0;
      if (this.timer <= 0) {
        this.state = 'rain';
        this.rainT = 1.8;
        this.spawnT = 0;
        game.audio.bossRoar();
      }
    } else if (this.state === 'rain') {
      this.rainT -= dt;
      this.spawnT -= dt;
      this.vx = 0;
      if (this.spawnT <= 0) {
        this.spawnT = this.phase === 2 ? 0.08 : 0.13;
        const x = arena.x0 + 40 + Math.random() * (arena.w - 80);
        game.spawnProjectile({
          x,
          y: arena.groundY - 620 + Math.random() * 80,
          vx: (Math.random() - 0.5) * 40,
          vy: 170 + Math.random() * 90,
          gravity: 120,
          r: 9,
          type: 'seed',
          life: 6
        });
      }
      if (this.rainT <= 0) {
        this.state = 'idle';
        this.timer = 1.1;
      }
    } else if (this.state === 'blinkOut') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.x = clamp(p.cx - this.w / 2 + (Math.random() < 0.5 ? -260 : 260), arena.x0 + 20, arena.x1 - this.w - 20);
        this.state = 'blinkIn';
        this.timer = 0.28;
        const n = 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          game.spawnProjectile({
            x: this.cx,
            y: this.cy,
            vx: Math.cos(a) * 240,
            vy: Math.sin(a) * 240,
            r: 8,
            type: 'screech',
            life: 3.2
          });
        }
        game.audio.shoot();
        game.shake = Math.max(game.shake, 8);
      }
    } else if (this.state === 'blinkIn') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 0.9;
      }
    }

    if (this.hp <= this.maxHp * 0.5 && !this.enraged) {
      this.enraged = true;
      game.shake = Math.max(game.shake, 16);
      for (let i = 0; i < 2; i++) {
        game.spawnEnemyAt('slime', this.cx + (i === 0 ? -160 : 160), this.groundY);
      }
      game.audio.bossRoar();
    }
  }

  chooseAttack(game) {
    const r = Math.random();
    if (this.phase === 2 && r < 0.25) {
      this.state = 'blinkOut';
      this.timer = 0.3;
    } else if (r < 0.55) {
      this.state = 'cast';
      this.timer = 0.55;
    } else if (r < 0.78) {
      const arena = this.arena;
      for (let i = 0; i < (this.phase === 2 ? 2 : 1); i++) {
        game.spawnEnemyAt(
          Math.random() < 0.5 ? 'slime' : 'beetle',
          arena.x0 + 90 + i * 120,
          this.groundY
        );
      }
      this.state = 'idle';
      this.timer = 1.2;
    } else {
      this.state = 'windup';
      this.timer = 0.62;
      this.dir = sign(game.player.cx - this.cx) || 1;
    }
  }

  hit(dmg, game) {
    if (this.dying || this.intro > 0) return;
    const mult = this.kind === 'mushroomMonarch' && this.state === 'stunned' ? 1.6 : 1;
    this.hp -= dmg * mult;
    this.flash = 0.15;
    game.audio.hit();
    game.shake = Math.max(game.shake, 5);
    burst(game, this.cx + (Math.random() - 0.5) * this.w * 0.6, this.cy, {
      count: 10,
      color: '#ffe9a8',
      color2: '#ff8a5b',
      speed: 240,
      life: 0.4,
      gravity: 450,
      size: 3.4,
      glow: true
    });
    game.addText(this.cx, this.y - 8, `${Math.round(dmg * mult)}`, '#ffe28a');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dying = true;
      this.deathT = 0;
      game.audio.bossDie();
      game.shake = 24;
      game.onBossDefeated(this);
    }
  }
}
