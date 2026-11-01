import { TILE, ARMOR, clamp, damp, overlap, sign } from './constants.js';
import { LEVEL_DEFS, buildLevel } from './levels.js';
import { Player, Enemy, Boss, Projectile, Pickup } from './entities.js';
import { createAmbient, updateParticles, burst } from './effects.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';

const SAVE_KEY = 'sporefall.save.v1';

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}

const $ = (id) => document.getElementById(id);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.saved = readSave();
    this.audio = new AudioEngine(Boolean(this.saved?.muted));

    this.time = 0;
    this.runTime = 0;
    this.scale = 1;
    this.dpr = 1;
    this.viewW = 1000;
    this.viewH = 560;
    this.camera = { x: 0, y: 0 };
    this.cameraBounds = null;
    this.shake = 0;
    this.hitstop = 0;
    this.flashHurt = 0;
    this.deathTimer = 0;
    this.state = 'title';

    this.levelIndex = 0;
    this.armor = 0;
    this.spores = 0;
    this.totalCollected = 0;
    this.deaths = 0;

    this.enemies = [];
    this.pickups = [];
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.ambient = [];
    this.boss = null;
    this.bossActive = false;
    this.bossDead = false;
    this.nearForge = null;
    this.nearDoor = false;
    this.levelCardTimer = null;
    this.toastTimer = null;

    this.dom = {
      hud: $('hud'),
      hearts: $('hearts'),
      sporeCount: $('sporeCount'),
      armorName: $('armorName'),
      levelName: $('levelName'),
      bossWrap: $('bossWrap'),
      bossName: $('bossName'),
      bossFill: $('bossFill'),
      prompt: $('prompt'),
      title: $('title'),
      shop: $('shop'),
      shopSpores: $('shopSpores'),
      shopNotice: $('shopNotice'),
      armorList: $('armorList'),
      pause: $('pause'),
      clear: $('clear'),
      clearKicker: $('clearKicker'),
      clearTitle: $('clearTitle'),
      clearText: $('clearText'),
      clearStats: $('clearStats'),
      clearNext: $('clearNext'),
      victory: $('victory'),
      victoryStats: $('victoryStats'),
      levelCard: $('levelCard'),
      levelCardNumber: $('levelCardNumber'),
      levelCardName: $('levelCardName'),
      levelCardSub: $('levelCardSub'),
      toast: $('toast'),
      continueBtn: $('continueBtn'),
      playBtn: $('playBtn'),
      pauseBtn: $('pauseBtn'),
      muteBtn: $('muteBtn'),
      shopClose: $('shopClose'),
      resumeBtn: $('resumeBtn'),
      quitBtn: $('quitBtn'),
      againBtn: $('againBtn'),
      menuBtn: $('menuBtn')
    };

    this.bindUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.loadLevel(0, { title: true });
    this.updateContinueButton();
    this.updateMuteButton();
    this.applyChrome();

    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 5) {
        this.step(STEP);
        acc -= STEP;
        guard++;
      }
      this.renderer.draw(this, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
  }

  get theme() {
    return LEVEL_DEFS[this.levelIndex]?.theme || 'forest';
  }

  resize() {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(320, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const aspect = w / h;
    let scale = Math.min(w / 1000, h / 560);
    if (aspect < 0.95) scale = Math.max(w / 500, h / 900);
    scale = clamp(scale, 0.58, 2.2);
    this.scale = scale;
    this.viewW = w / scale;
    this.viewH = h / scale;
    this.snapCamera();
  }

  bindUI() {
    const d = this.dom;
    d.playBtn.addEventListener('click', () => this.startRun(true));
    d.continueBtn.addEventListener('click', () => this.startRun(false));
    d.pauseBtn.addEventListener('click', () => {
      if (this.state === 'playing') this.pauseGame();
      else if (this.state === 'paused') this.resumeGame();
    });
    d.muteBtn.addEventListener('click', () => this.toggleMute());
    d.shopClose.addEventListener('click', () => this.closeShop());
    d.resumeBtn.addEventListener('click', () => this.resumeGame());
    d.quitBtn.addEventListener('click', () => this.quitToTitle());
    d.againBtn.addEventListener('click', () => this.startRun(true));
    d.menuBtn.addEventListener('click', () => this.quitToTitle());
    d.clearNext.addEventListener('click', () => this.nextFromClear());

    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });

    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Enter') return;
      if (this.state === 'title') this.startRun(true);
      else if (this.state === 'clear') this.nextFromClear();
    });
  }

  updateContinueButton() {
    const save = this.saved;
    const usable = save && (save.levelIndex > 0 || save.armor > 0 || save.spores > 0 || save.completed);
    this.dom.continueBtn.classList.toggle('hidden', !usable);
    if (usable) {
      this.dom.continueBtn.textContent = `Continue · ${LEVEL_DEFS[save.levelIndex]?.name || 'Mossgrove'}`;
    }
  }

  updateMuteButton() {
    this.dom.muteBtn.textContent = this.audio.muted ? '×' : '♪';
    this.dom.muteBtn.setAttribute('aria-label', this.audio.muted ? 'Unmute sound' : 'Mute sound');
    this.dom.muteBtn.setAttribute('aria-pressed', String(this.audio.muted));
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.updateMuteButton();
    this.saveProgress(false);
  }

  startRun(fresh) {
    this.audio.init();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (fresh) {
      this.armor = 0;
      this.spores = 0;
      this.totalCollected = 0;
      this.deaths = 0;
      this.runTime = 0;
      this.levelIndex = 0;
    } else if (this.saved) {
      this.armor = clamp(this.saved.armor || 0, 0, 3);
      this.spores = this.saved.spores || 0;
      this.totalCollected = this.spores;
      this.deaths = this.saved.deaths || 0;
      this.runTime = 0;
      this.levelIndex = clamp(this.saved.levelIndex || 0, 0, LEVEL_DEFS.length - 1);
    }
    this.dom.title.classList.add('hidden');
    this.dom.victory.classList.add('hidden');
    this.dom.clear.classList.add('hidden');
    this.loadLevel(this.levelIndex, { title: false });
    this.showLevelCard();
    this.audio.startMusic(this.theme);
    this.applyChrome();
  }

  loadLevel(index, { title = false } = {}) {
    this.levelIndex = clamp(index, 0, LEVEL_DEFS.length - 1);
    clearTimeout(this.levelCardTimer);
    this.dom.levelCard.classList.remove('show');
    this.dom.levelCard.classList.add('hidden');
    this.level = buildLevel(this.levelIndex);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y, this.armor);
    if (title) {
      this.player.x = 12.5 * TILE - this.player.w / 2;
      this.player.y = this.level.arenaData.groundY - this.player.h;
      this.player.facing = -1;
      this.player.invuln = 0;
    }
    this.enemies = this.level.enemies.map((def) => new Enemy(def, this));
    this.pickups = this.level.pickups.map((def) => new Pickup(def));
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.ambient = createAmbient(this.level);
    this.boss = null;
    this.bossActive = false;
    this.bossDead = false;
    this.cameraBounds = null;
    this.nearForge = null;
    this.nearDoor = false;
    this.checkpoint = { x: this.level.spawn.x, y: this.level.spawn.y };
    this.level.checkpoints.forEach((c) => (c.active = false));
    this.flashHurt = 0;
    this.shake = 0;
    this.hitstop = 0;
    this.dom.bossWrap.classList.add('hidden');
    this.hidePrompt();
    this.state = title ? 'title' : 'playing';
    this.dom.hud.classList.toggle('hidden', title);
    this.dom.levelName.textContent = this.level.name;
    this.updateHUD();
    this.snapCamera();
    this.applyChrome();
    if (!title) {
      this.saveProgress();
      this.audio.startMusic(this.theme);
    }
  }

  showLevelCard() {
    const d = this.dom;
    const def = LEVEL_DEFS[this.levelIndex];
    d.levelCardNumber.textContent = `Chapter ${def.number}`;
    d.levelCardName.textContent = def.name;
    d.levelCardSub.textContent = def.subtitle;
    d.levelCard.classList.remove('hidden');
    requestAnimationFrame(() => d.levelCard.classList.add('show'));
    clearTimeout(this.levelCardTimer);
    this.levelCardTimer = setTimeout(() => {
      d.levelCard.classList.remove('show');
      setTimeout(() => d.levelCard.classList.add('hidden'), 650);
    }, 2600);
  }

  saveProgress(verbose = true) {
    if (!this.level) return;
    this.saved = {
      levelIndex: this.levelIndex,
      armor: this.armor,
      spores: this.spores,
      deaths: this.deaths,
      muted: this.audio.muted,
      completed: this.state === 'victory'
    };
    writeSave(this.saved);
    this.updateContinueButton();
  }

  updateHUD() {
    const hearts = [];
    for (let i = 0; i < this.player.maxHp; i++) {
      hearts.push(`<span class="heart ${i < this.player.hp ? 'full' : 'empty'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.6-4.8-9.7-9.2A5.6 5.6 0 0112 5.9a5.6 5.6 0 019.7 5.9C19.6 16.2 12 21 12 21z"/></svg>
      </span>`);
    }
    this.dom.hearts.innerHTML = hearts.join('');
    this.dom.sporeCount.textContent = this.spores;
    this.dom.armorName.textContent = this.armor > 0 ? ARMOR[this.armor - 1].name : "Wayfarer's tunic";
    this.dom.levelName.textContent = this.level?.name || '';
  }

  updateBossBar() {
    if (!this.boss || this.boss.dying) return;
    this.dom.bossFill.style.width = `${Math.max(0, (this.boss.hp / this.boss.maxHp) * 100)}%`;
  }

  showBossBar() {
    this.dom.bossName.textContent = this.level.bossName;
    this.dom.bossWrap.classList.remove('hidden');
    this.dom.bossFill.style.width = '100%';
  }

  hideBossBar() {
    this.dom.bossWrap.classList.add('hidden');
  }

  showPrompt(text) {
    this.dom.prompt.textContent = text;
    this.dom.prompt.classList.remove('hidden');
  }

  hidePrompt() {
    this.dom.prompt.classList.add('hidden');
  }

  toast(text, duration = 2400) {
    const el = this.dom.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  applyChrome() {
    const inGame = ['playing', 'paused', 'shop', 'dead', 'clear'].includes(this.state);
    document.body.classList.toggle('in-game', inGame);
    document.body.classList.toggle('is-paused', this.state === 'paused' || this.state === 'shop');
    this.dom.pauseBtn.textContent = this.state === 'paused' ? '▶' : 'II';
    this.dom.pauseBtn.setAttribute('aria-label', this.state === 'paused' ? 'Resume' : 'Pause');
  }

  step(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 42);
    this.flashHurt = Math.max(0, this.flashHurt - dt);

    if (this.state === 'title') {
      this.updateTitle(dt);
      this.input.clearFrame();
      return;
    }

    if (this.state === 'dead') {
      this.deathTimer -= dt;
      this.updateParticles(dt);
      this.shake = Math.max(0, this.shake - dt * 10);
      if (this.deathTimer <= 0) this.respawnPlayer();
      this.input.clearFrame();
      this.applyChrome();
      return;
    }

    if (this.state === 'paused' || this.state === 'shop' || this.state === 'clear' || this.state === 'victory') {
      if (this.input.pressed('pause')) {
        if (this.state === 'paused') this.resumeGame();
        else if (this.state === 'shop') this.closeShop();
        else if (this.state === 'clear') this.nextFromClear();
      }
      this.input.clearFrame();
      this.applyChrome();
      return;
    }

    if (this.input.pressed('pause')) {
      this.pauseGame();
      this.input.clearFrame();
      this.applyChrome();
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.input.clearFrame();
      return;
    }

    this.runTime += dt;

    this.player.update(dt, this);
    if (this.state !== 'playing') {
      this.input.clearFrame();
      this.applyChrome();
      return;
    }

    for (const enemy of this.enemies) {
      if (!enemy.dead) enemy.update(dt, this);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (this.boss) {
      this.boss.update(dt, this);
      if (this.boss.dying && this.boss.deathT > 1.8) this.boss = null;
    }

    for (const projectile of this.projectiles) projectile.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    for (const pickup of this.pickups) pickup.update(dt, this);
    this.pickups = this.pickups.filter((p) => !p.dead);

    this.handleContacts();
    this.checkBossTrigger();
    this.checkCheckpoints();
    this.updateInteraction();
    this.updateArenaBounds();

    this.updateParticles(dt);
    this.updateTexts(dt);
    this.updateCamera(dt);
    this.updateBossBar();
    this.applyChrome();
    this.input.clearFrame();
  }

  updateTitle(dt) {
    const lvl = this.level;
    const targetX =
      this.level.spawn.x - this.viewW * 0.36 + Math.sin(this.time * 0.09) * this.viewW * 0.07;
    const targetY = lvl.arenaData.groundY - this.viewH * 0.66;
    const bounds = this.titleBounds || { x0: 0, x1: lvl.widthPx, y0: 0, y1: lvl.heightPx };
    const maxX = Math.max(bounds.x0, bounds.x1 - this.viewW);
    const targetXClamped = clamp(targetX, bounds.x0, maxX);
    this.camera.x = damp(this.camera.x, targetXClamped, 1.5, dt);
    this.camera.y = damp(this.camera.y, targetY, 1.5, dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
  }

  updateParticles(dt) {
    updateParticles(this, dt);
  }

  updateTexts(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 38 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  addText(x, y, text, color = '#ffe9a8') {
    this.texts.push({ x, y, text, color, life: 0.8, max: 0.8 });
  }

  handleContacts() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || !overlap(p, e)) continue;
      const stomp = p.vy > 70 && p.prevY + p.h <= e.y + 16 && e.type !== 'spitter';
      if (stomp) {
        e.hurt(2, sign(e.cx - p.cx) || 1, this);
        p.vy = -470;
        p.onGround = false;
        p.airJumps = p.armorTier >= 3 ? 1 : p.airJumps;
        this.audio.stomp();
        this.shake = Math.max(this.shake, 5);
        this.hitstop = Math.max(this.hitstop, 0.03);
      } else {
        p.hurt(1, e.cx, this);
      }
    }

    if (this.boss && !this.boss.dying && this.boss.contactDamage() > 0 && overlap(p, this.boss)) {
      p.hurt(this.boss.contactDamage(), this.boss.cx, this);
    }
  }

  playerStrike(hb, player) {
    const dmg = 2 + (player.armorTier >= 3 ? 1 : 0);
    for (const e of this.enemies) {
      if (e.dead || player.hitSet.has(e) || !overlap(hb, e)) continue;
      player.hitSet.add(e);
      e.hurt(dmg, player.facing, this);
      this.hitstop = Math.max(this.hitstop, 0.035);
      this.shake = Math.max(this.shake, 5);
    }

    if (this.boss && !this.boss.dying && this.boss.intro <= 0 && !player.hitSet.has(this.boss) && overlap(hb, this.boss)) {
      player.hitSet.add(this.boss);
      this.boss.hit(dmg, this);
      this.hitstop = Math.max(this.hitstop, 0.045);
      this.shake = Math.max(this.shake, 7);
    }

    for (const projectile of this.projectiles) {
      if (projectile.dead || player.hitSet.has(projectile)) continue;
      if (overlap(hb, { x: projectile.x - projectile.r, y: projectile.y - projectile.r, w: projectile.r * 2, h: projectile.r * 2 })) {
        player.hitSet.add(projectile);
        projectile.burst(this);
        this.audio.hit();
      }
    }
  }

  collectPickup(pickup) {
    if (pickup.type === 'heart') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      this.audio.heal();
      this.addText(pickup.x, pickup.y - 10, '+1 heart', '#ff9fb0');
      this.updateHUD();
      return;
    }
    this.spores += pickup.value;
    this.totalCollected += pickup.value;
    this.audio.coin();
    this.addText(pickup.x, pickup.y - 10, `+${pickup.value}`, '#ffd76a');
    burstSmall(this, pickup.x, pickup.y);
    this.updateHUD();
  }

  spawnProjectile(def) {
    this.projectiles.push(new Projectile(def));
  }

  spawnEnemyAt(type, x, groundY) {
    const def = { type, x, y: groundY };
    this.enemies.push(new Enemy(def, this));
  }

  onEnemyKilled(enemy) {
    burstBig(this, enemy.cx, enemy.cy);
    this.audio.hit();
    for (let i = 0; i < 2; i++) {
      this.pickups.push(
        new Pickup({
          type: 'spore',
          x: enemy.cx + (Math.random() - 0.5) * 34,
          y: enemy.cy - 6 + (Math.random() - 0.5) * 20,
          value: 1
        })
      );
    }
    if (Math.random() < 0.12) {
      this.pickups.push(new Pickup({ type: 'heart', x: enemy.cx, y: enemy.cy - 16, value: 1 }));
    }
  }

  checkBossTrigger() {
    if (this.bossActive || this.bossDead) return;
    const arena = this.level.arenaData;
    if (this.player.cx > arena.triggerX) {
      this.boss = new Boss(this.level.boss, arena, this);
      this.bossActive = true;
      this.cameraBounds = {
        x0: arena.x0 - 40,
        x1: arena.x1 + 40,
        y0: arena.groundY - 740,
        y1: arena.groundY + 60
      };
      this.showBossBar();
      clearTimeout(this.levelCardTimer);
      this.dom.levelCard.classList.remove('show');
      this.dom.levelCard.classList.add('hidden');
      this.audio.startMusic('boss');
      this.shake = Math.max(this.shake, 12);
      this.toast(`${this.level.bossName} awakens`);
      this.player.invuln = Math.max(this.player.invuln, 0.8);
    }
  }

  updateArenaBounds() {
    if (!this.bossActive) return;
    const a = this.level.arenaData;
    const p = this.player;
    if (p.x < a.x0 + 12) {
      p.x = a.x0 + 12;
      p.vx = Math.max(0, p.vx);
    }
    if (p.x + p.w > a.x1 - 12) {
      p.x = a.x1 - p.w - 12;
      p.vx = Math.min(0, p.vx);
    }
  }

  checkCheckpoints() {
    const p = this.player;
    for (const c of this.level.checkpoints) {
      if (c.active) continue;
      if (Math.hypot(p.cx - c.x, p.cy - c.y) < 74) {
        c.active = true;
        this.checkpoint = { x: c.x, y: c.y };
        p.hp = p.maxHp;
        this.audio.checkpoint();
        this.toast('Checkpoint lit — the spores remember');
        this.addText(c.x, c.y - 70, 'Checkpoint', '#8ff7df');
        this.shake = Math.max(this.shake, 3);
        this.saveProgress();
        this.updateHUD();
        for (let i = 0; i < 14; i++) {
          this.particles.push({
            x: c.x,
            y: c.y - 36,
            vx: (Math.random() - 0.5) * 120,
            vy: -40 - Math.random() * 120,
            life: 0.8,
            max: 0.8,
            size: 2 + Math.random() * 3,
            color: '#8ff7df',
            gravity: -30,
            drag: 1,
            glow: true,
            shape: 'circle'
          });
        }
      }
    }
  }

  updateInteraction() {
    const p = this.player;
    this.nearForge = null;
    this.nearDoor = false;
    for (const f of this.level.forges) {
      if (Math.hypot(p.cx - f.x, p.cy - f.y + 20) < 86) this.nearForge = f;
    }
    if (this.level.door && Math.hypot(p.cx - this.level.door.x, p.cy - (this.level.door.y - 30)) < 88) {
      this.nearDoor = true;
    }

    if (this.nearForge) {
      this.showPrompt('E · Enter the Lantern Forge');
    } else if (this.nearDoor) {
      this.showPrompt(this.bossDead ? 'E · Step through the waygate' : 'Sealed — the guardian still breathes');
    } else {
      this.hidePrompt();
    }

    if (!this.input.pressed('interact')) return;
    if (this.nearForge) {
      this.openShop();
    } else if (this.nearDoor) {
      if (this.bossDead) this.completeLevel();
      else {
        this.audio.deny();
        this.toast('The waygate is sealed');
      }
    }
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.dom.pause.classList.remove('hidden');
    this.dom.hud.classList.remove('hidden');
    this.audio.setMuted(this.audio.muted);
    if (this.audio.ctx) this.audio.musicBus.gain.setTargetAtTime(0.08, this.audio.ctx.currentTime, 0.1);
    this.hidePrompt();
    this.applyChrome();
  }

  resumeGame() {
    if (this.state !== 'paused' && this.state !== 'shop') return;
    this.dom.pause.classList.add('hidden');
    this.dom.shop.classList.add('hidden');
    this.state = 'playing';
    if (this.audio.ctx) this.audio.musicBus.gain.setTargetAtTime(0.3, this.audio.ctx.currentTime, 0.15);
    this.audio.init();
    this.applyChrome();
  }

  quitToTitle() {
    this.dom.pause.classList.add('hidden');
    this.dom.shop.classList.add('hidden');
    this.dom.clear.classList.add('hidden');
    this.dom.victory.classList.add('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.title.classList.remove('hidden');
    this.dom.prompt.classList.add('hidden');
    this.hideBossBar();
    this.state = 'title';
    this.levelIndex = 0;
    this.armor = this.saved?.armor || 0;
    this.spores = this.saved?.spores || 0;
    this.loadLevel(0, { title: true });
    this.audio.startMusic('forest');
    this.updateContinueButton();
    this.applyChrome();
  }

  openShop() {
    if (this.state !== 'playing') return;
    this.state = 'shop';
    this.dom.shop.classList.remove('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.toast.classList.remove('show');
    this.hidePrompt();
    this.shopMessage = '';
    this.renderShop();
    this.audio.deny();
    this.applyChrome();
  }

  closeShop() {
    if (this.state !== 'shop') return;
    this.dom.shop.classList.add('hidden');
    this.state = 'playing';
    this.audio.init();
    this.applyChrome();
  }

  renderShop() {
    this.dom.shopSpores.textContent = this.spores;
    this.dom.shopNotice.textContent = this.shopMessage || '';
    this.dom.shopNotice.classList.toggle('show', Boolean(this.shopMessage));
    const next = this.armor + 1;
    this.dom.armorList.innerHTML = ARMOR.map((a, i) => {
      const tier = i + 1;
      const owned = this.armor >= tier;
      const isNext = tier === next;
      const affordable = this.spores >= a.cost;
      let label;
      if (owned) label = 'Worn';
      else if (isNext) label = affordable ? `Forge · ${a.cost}` : `Need ${a.cost - this.spores} more`;
      else label = 'Sealed';
      return `<article class="armor-card ${owned ? 'owned' : ''} ${isNext ? 'next' : ''}">
        <div class="armor-swatch tier-${tier}" aria-hidden="true">
          <span class="helm"></span>
          <span class="plume"></span>
        </div>
        <div class="armor-copy">
          <div class="armor-top"><h3>${a.name}</h3><span class="armor-hearts">+${a.hearts} ♥</span></div>
          <p>${a.desc}</p>
          <span class="armor-tag">${a.tag}</span>
        </div>
        <button class="btn btn-small ${isNext && affordable ? 'btn-primary' : ''}" data-buy="${tier}"
          ${owned || !isNext || !affordable ? 'disabled' : ''}>${label}</button>
      </article>`;
    }).join('');
    this.dom.armorList.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => this.buyArmor(Number(btn.dataset.buy)));
    });
  }

  buyArmor(tier) {
    if (tier !== this.armor + 1) {
      this.audio.deny();
      return;
    }
    const armor = ARMOR[tier - 1];
    if (this.spores < armor.cost) {
      this.audio.deny();
      return;
    }
    this.spores -= armor.cost;
    this.armor = tier;
    this.player.setArmorTier(tier, true);
    this.audio.buy();
    this.shake = Math.max(this.shake, 6);
    this.updateHUD();
    this.shopMessage =
      tier === ARMOR.length
        ? `${armor.name} forged — the full aegis is yours.`
        : `${armor.name} forged — your heart steadies.`;
    this.renderShop();
    this.saveProgress();
    for (let i = 0; i < 26; i++) {
      this.particles.push({
        x: this.player.cx,
        y: this.player.cy,
        vx: (Math.random() - 0.5) * 260,
        vy: -60 - Math.random() * 220,
        life: 0.9,
        max: 0.9,
        size: 2 + Math.random() * 4,
        color: i % 3 === 0 ? '#ffd76a' : i % 3 === 1 ? '#8ff7df' : '#ffffff',
        gravity: 220,
        drag: 0.8,
        glow: true,
        shape: 'circle'
      });
    }
  }

  playerDown(fell) {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.deathTimer = fell ? 1.1 : 1.5;
    this.deaths += 1;
    this.hidePrompt();
    this.shake = Math.max(this.shake, fell ? 6 : 14);
    if (this.bossActive) {
      this.boss = null;
      this.bossActive = false;
      this.hideBossBar();
      this.cameraBounds = null;
      this.audio.startMusic(this.theme);
    }
    this.projectiles = [];
    this.applyChrome();
  }

  respawnPlayer() {
    this.enemies = this.level.enemies.map((def) => new Enemy(def, this));
    this.player.respawn(this.checkpoint.x, this.checkpoint.y);
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.state = 'playing';
    this.flashHurt = 0;
    this.hitstop = 0;
    this.cameraBounds = null;
    this.boss = null;
    this.bossActive = false;
    this.hideBossBar();
    this.updateHUD();
    this.snapCamera();
    this.audio.startMusic(this.theme);
    this.toast('The spores carry you back');
    this.applyChrome();
  }

  onBossDefeated(boss) {
    this.bossActive = false;
    this.bossDead = true;
    this.cameraBounds = null;
    this.hideBossBar();
    this.audio.startMusic(this.theme);
    this.flashHurt = 0;
    this.toast(`${this.level.bossName} is felled — the waygate opens`, 3200);
    const drops = 10 + this.levelIndex * 3;
    for (let i = 0; i < drops; i++) {
      this.pickups.push(
        new Pickup({
          type: 'spore',
          x: boss.cx + (Math.random() - 0.5) * 260,
          y: Math.min(boss.cy + (Math.random() - 0.5) * 110, boss.arena.groundY - 26),
          value: i % 6 === 0 ? 3 : 1,
          big: i % 6 === 0
        })
      );
    }
    for (let i = 0; i < 2; i++) {
      this.pickups.push(new Pickup({ type: 'heart', x: boss.cx + (i ? 60 : -60), y: Math.min(boss.cy - 20, boss.arena.groundY - 30) }));
    }
    this.saveProgress();
  }

  completeLevel() {
    if (this.state !== 'playing') return;
    const last = this.levelIndex >= LEVEL_DEFS.length - 1;
    if (last) {
      this.winGame();
      return;
    }
    this.state = 'clear';
    this.audio.door();
    this.dom.clearKicker.textContent = 'Guardian felled';
    this.dom.clearTitle.textContent = this.level.name;
    this.dom.clearText.textContent = LEVEL_DEFS[this.levelIndex + 1].subtitle;
    this.dom.clearStats.innerHTML = `
      <span><b>${this.spores}</b> spores</span>
      <span><b>${this.armor}</b>/3 armor</span>
      <span><b>${this.deaths}</b> falls</span>
      <span><b>${formatTime(this.runTime)}</b> journey</span>`;
    this.dom.clearNext.textContent = 'Onward';
    this.dom.clear.classList.remove('hidden');
    this.hidePrompt();
    this.applyChrome();
    this.saveProgress();
  }

  nextFromClear() {
    if (this.state !== 'clear') return;
    this.dom.clear.classList.add('hidden');
    this.levelIndex += 1;
    this.loadLevel(this.levelIndex);
    this.state = 'playing';
    this.showLevelCard();
    this.audio.startMusic(this.theme);
    this.applyChrome();
  }

  winGame() {
    this.state = 'victory';
    this.audio.stopMusic();
    this.audio.startMusic('summit');
    this.dom.hud.classList.add('hidden');
    this.dom.victory.classList.remove('hidden');
    this.dom.victoryStats.innerHTML = `
      <span><b>${this.totalCollected}</b> spores gathered</span>
      <span><b>${this.armor}</b>/3 armor forged</span>
      <span><b>${this.deaths}</b> falls</span>
      <span><b>${formatTime(this.runTime)}</b> journey</span>`;
    this.hidePrompt();
    this.saveProgress();
    this.applyChrome();
  }

  snapCamera() {
    if (!this.level || !this.player) return;
    const b = this.cameraBounds || { x0: 0, x1: this.level.widthPx, y0: 0, y1: this.level.heightPx };
    this.camera.x = clamp(
      this.player.cx - this.viewW / 2,
      b.x0,
      Math.max(b.x0, b.x1 - this.viewW)
    );
    this.camera.y = clamp(
      this.player.cy - this.viewH * 0.58,
      Math.min(b.y0, b.y1 - this.viewH),
      Math.max(b.y0, b.y1 - this.viewH)
    );
  }

  updateCamera(dt) {
    const p = this.player;
    const lvl = this.level;
    const b = this.cameraBounds || { x0: 0, x1: lvl.widthPx, y0: 0, y1: lvl.heightPx };
    const look = this.bossActive ? 0 : clamp(p.facing * 60, -60, 60);
    // While a guardian is awake, frame the space between knight and boss so
    // neither fighter drifts off-screen in the arena.
    const focusX =
      this.bossActive && this.boss && !this.boss.dying ? (p.cx + this.boss.cx) / 2 : p.cx + look;
    const targetX = focusX - this.viewW / 2;
    const targetY = p.cy - this.viewH * 0.56;
    const maxX = Math.max(b.x0, b.x1 - this.viewW);
    const minY = Math.min(b.y0, b.y1 - this.viewH);
    const maxY = Math.max(b.y0, b.y1 - this.viewH);
    this.camera.x = damp(this.camera.x, clamp(targetX, b.x0, maxX), 7, dt);
    this.camera.y = damp(this.camera.y, clamp(targetY, minY, maxY), 6, dt);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function burstSmall(game, x, y) {
  burst(game, x, y, {
    count: 6,
    color: '#ffd76a',
    color2: '#fff4c2',
    speed: 120,
    life: 0.35,
    gravity: 250,
    size: 2.4,
    glow: true
  });
}

function burstBig(game, x, y) {
  burst(game, x, y, {
    count: 20,
    color: '#ffe28a',
    color2: '#8ff7df',
    speed: 290,
    life: 0.6,
    gravity: 420,
    size: 4,
    glow: true
  });
}
