const SCALES = {
  forest: [0, 3, 5, 7, 10, 12, 15, 17],
  cavern: [0, 2, 3, 7, 8, 12, 14, 15],
  summit: [0, 2, 5, 7, 9, 12, 14, 17],
  boss: [0, 3, 5, 6, 7, 10, 12, 15]
};

const pattern = [0, 4, 2, 5, 3, 6, 4, 2, 1, 5, 3, 7, 4, 6, 2, 5];

export class AudioEngine {
  constructor(muted = false) {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.muted = muted;
    this.musicTimer = null;
    this.musicTheme = null;
    this.beat = 0;
    this.nextNote = 0;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.3;
    this.musicBus.connect(this.master);

    const length = Math.floor(this.ctx.sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  tone(freq, dur, type = 'sine', gain = 0.15, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noise(dur = 0.12, gain = 0.15, filter = 1400, delay = 0, type = 'highpass') {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filter;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  jump() {
    this.tone(320, 0.14, 'square', 0.055, 540);
  }

  airJump() {
    this.tone(480, 0.18, 'triangle', 0.09, 860);
    this.tone(720, 0.22, 'sine', 0.05, 1180);
  }

  slash() {
    this.noise(0.1, 0.12, 2200, 0, 'highpass');
    this.tone(760, 0.11, 'sawtooth', 0.035, 260);
  }

  hit() {
    this.noise(0.08, 0.2, 900, 0, 'lowpass');
    this.tone(160, 0.1, 'square', 0.1, 70);
  }

  stomp() {
    this.tone(120, 0.13, 'square', 0.15, 60);
    this.noise(0.09, 0.14, 700, 0, 'lowpass');
  }

  hurt() {
    this.tone(300, 0.24, 'sawtooth', 0.09, 80);
    this.noise(0.18, 0.12, 800, 0, 'lowpass');
  }

  coin() {
    this.tone(880, 0.09, 'triangle', 0.07);
    this.tone(1320, 0.14, 'sine', 0.06, null, 0.06);
  }

  heal() {
    this.tone(523, 0.16, 'sine', 0.08);
    this.tone(784, 0.22, 'sine', 0.07, null, 0.08);
    this.tone(1046, 0.28, 'sine', 0.05, null, 0.16);
  }

  checkpoint() {
    [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.06, null, i * 0.08));
  }

  buy() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.26, 'triangle', 0.07, null, i * 0.06));
    this.noise(0.2, 0.05, 3200, 0, 'highpass');
  }

  deny() {
    this.tone(180, 0.12, 'square', 0.06, 150);
    this.tone(150, 0.16, 'square', 0.05, 120, 0.09);
  }

  door() {
    this.tone(220, 0.7, 'sine', 0.1, 880);
    this.tone(330, 0.8, 'triangle', 0.05, 1320, 0.1);
    this.noise(0.5, 0.06, 1200, 0.1, 'bandpass');
  }

  bossRoar() {
    this.noise(0.7, 0.22, 300, 0, 'lowpass');
    this.tone(90, 0.9, 'sawtooth', 0.14, 48);
    this.tone(140, 0.7, 'square', 0.07, 60, 0.08);
  }

  bossDie() {
    this.noise(1.1, 0.3, 500, 0, 'lowpass');
    this.tone(220, 1.2, 'sawtooth', 0.16, 40);
    for (let i = 0; i < 5; i++) this.tone(800 - i * 90, 0.3, 'triangle', 0.06, 180, i * 0.1);
  }

  shoot() {
    this.tone(520, 0.12, 'triangle', 0.05, 240);
  }

  thud() {
    this.tone(80, 0.2, 'sine', 0.16, 40);
    this.noise(0.14, 0.08, 500, 0, 'lowpass');
  }

  startMusic(theme = 'forest') {
    this.init();
    if (!this.ctx) return;
    if (this.musicTheme === theme && this.musicTimer) return;
    this.stopMusic();
    this.musicTheme = theme;
    this.beat = 0;
    this.nextNote = this.ctx.currentTime + 0.15;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 160);
    this.scheduleMusic();
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicTheme = null;
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicTheme) return;
    const theme = this.musicTheme;
    const tempo = theme === 'boss' ? 0.2 : theme === 'cavern' ? 0.4 : theme === 'summit' ? 0.34 : 0.32;
    const base = theme === 'boss' ? 110 : theme === 'cavern' ? 146.83 : theme === 'summit' ? 196 : 174.61;
    const scale = SCALES[theme] || SCALES.forest;
    const lookahead = this.ctx.currentTime + 0.45;

    while (this.nextNote < lookahead) {
      const t = this.nextNote;
      const step = pattern[this.beat % pattern.length];
      const degree = step % scale.length;
      const octave = this.beat % 16 >= 8 ? 12 : 0;
      const freq = base * Math.pow(2, (scale[degree] + octave) / 12);
      this.note(freq, t, tempo * 0.92, 0.045, 'triangle');
      if (this.beat % 4 === 0) {
        const bass = base / 2 * Math.pow(2, scale[[0, 0, 3, 5][Math.floor(this.beat / 4) % 4]] / 12);
        this.musicNote(bass, t, tempo * 3.4, 0.07, 'sine');
      }
      if (theme === 'boss' && this.beat % 2 === 1) {
        this.musicNoise(t, 0.05, 0.025);
      }
      this.nextNote += tempo;
      this.beat++;
    }
  }

  note(freq, time, dur, gain, type) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  musicNote(freq, time, dur, gain, type) {
    this.note(freq, time, dur, gain, type);
  }

  musicNoise(time, dur, gain) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(time);
    src.stop(time + dur + 0.02);
  }
}
