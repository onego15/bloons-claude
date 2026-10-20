'use strict';
// ---------------------------------------------------------------------------
// Synthesised sound effects + a light procedural background tune (WebAudio).
// No external audio files are needed.
// ---------------------------------------------------------------------------
const Sound = {
  ctx: null, master: null, sfx: null, music: null,
  sfxOn: Store.get('pw-sfx', true), musicOn: Store.get('pw-music', true),
  last: {},
  noiseBuf: null,
  musicTimer: null, nextNote: 0, step: 0,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 0.55 : 0; this.sfx.connect(this.master);
    this.music = this.ctx.createGain(); this.music.gain.value = this.musicOn ? 0.16 : 0; this.music.connect(this.master);
    const len = this.ctx.sampleRate * 1.0;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },

  setSfx(on) { this.sfxOn = on; Store.set('pw-sfx', on); if (this.sfx) this.sfx.gain.value = on ? 0.55 : 0; },
  setMusic(on) { this.musicOn = on; Store.set('pw-music', on); if (this.music) this.music.gain.value = on ? 0.16 : 0; },

  tone(type, f0, f1, dur, vol, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, f0, f1, type = 'lowpass', when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name, pitch = 1) {
    if (!this.ctx || !this.sfxOn) return;
    const now = performance.now();
    const gap = { shoot: 45, pop: 35, hit: 30, zap: 60, frost: 60, coin: 40, boom: 70 }[name] || 0;
    if (gap && now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    const p = pitch * (0.94 + Math.random() * 0.12);
    switch (name) {
      case 'shoot': this.tone('triangle', 720 * p, 360 * p, 0.07, 0.18); break;
      case 'sniper': this.tone('square', 220, 90, 0.12, 0.12); this.noise(0.12, 0.25, 4000, 600, 'bandpass'); break;
      case 'mortar': this.tone('sine', 190 * p, 70, 0.16, 0.35); this.noise(0.08, 0.15, 1200, 300); break;
      case 'boom': this.noise(0.4, 0.5, 900 * p, 120); this.tone('sine', 110 * p, 40, 0.35, 0.45); break;
      case 'zap': this.tone('sawtooth', 1400 * p, 260, 0.12, 0.12); this.noise(0.1, 0.2, 6000, 2000, 'highpass'); break;
      case 'thunder': this.noise(0.6, 0.55, 2500, 100); this.tone('sawtooth', 120, 40, 0.5, 0.2); break;
      case 'frost': this.tone('triangle', 1500 * p, 2400 * p, 0.12, 0.12); this.tone('sine', 2900 * p, 3300 * p, 0.1, 0.06, 0.03); break;
      case 'blizzard': this.noise(0.5, 0.25, 3000, 8000, 'bandpass'); this.tone('sine', 1800, 2600, 0.3, 0.06); break;
      case 'hit': this.tone('square', 260 * p, 120, 0.04, 0.05); break;
      case 'pop': this.tone('sine', 380 * p, 980 * p, 0.09, 0.22); this.noise(0.05, 0.1, 3000, 800); break;
      case 'bigpop': this.tone('sine', 160, 520, 0.25, 0.4); this.noise(0.3, 0.35, 2000, 200); break;
      case 'coin': this.tone('square', 988, 988, 0.06, 0.06); this.tone('square', 1319, 1319, 0.1, 0.06, 0.06); break;
      case 'build': this.noise(0.12, 0.3, 700, 150); this.tone('triangle', 330, 660, 0.15, 0.18, 0.05); break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.15, i * 0.06)); break;
      case 'sell': [880, 660, 520].forEach((f, i) => this.tone('square', f, f, 0.07, 0.06, i * 0.05)); break;
      case 'leak': this.tone('sine', 220, 70, 0.35, 0.4); this.noise(0.2, 0.2, 500, 100); break;
      case 'wave': [392, 523, 659].forEach((f, i) => this.tone('sawtooth', f, f, 0.22, 0.08, i * 0.09)); break;
      case 'boss': this.tone('sawtooth', 70, 50, 1.2, 0.25); this.noise(1.0, 0.2, 300, 60); break;
      case 'heal': this.tone('sine', 700, 1100, 0.18, 0.06); break;
      case 'click': this.tone('triangle', 900, 700, 0.04, 0.1); break;
      case 'error': this.tone('square', 200, 150, 0.12, 0.08); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.16, i * 0.11)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.35, 0.16, i * 0.22)); break;
      case 'star': this.tone('triangle', 1047 * p, 1568 * p, 0.25, 0.15); break;
    }
  },

  // gentle looping tune: I - vi - IV - V in C, pentatonic plucks + bass
  startMusic() {
    if (this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.step = 0;
    const bpm = 104, s16 = 60 / bpm / 4;
    const chords = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];
    // one note per eighth (0 = rest), four bars following the chords
    const tune = [64, 0, 67, 0, 69, 67, 64, 62, 69, 0, 72, 0, 69, 67, 64, 0, 65, 0, 69, 0, 72, 69, 67, 0, 67, 0, 71, 0, 74, 72, 71, 67];
    const melody = [];
    for (let i = 0; i < 64; i++) melody.push(i % 2 === 0 ? tune[i / 2] : 0);
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const pluck = (m, t, dur, vol, type = 'triangle') => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    };
    this.musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this.nextNote < this.ctx.currentTime + 0.2) {
        const st = this.step % 64, bar = Math.floor(st / 16), ch = chords[bar];
        const t = this.nextNote;
        if (st % 16 === 0) pluck(ch[0] - 12, t, s16 * 14, 0.5, 'sine');
        if (st % 16 === 8) pluck(ch[0] - 12, t, s16 * 6, 0.35, 'sine');
        if (st % 4 === 2) pluck(ch[(st >> 2) % 3] + 12, t, s16 * 3, 0.12);
        if (melody[st] && (this.step >> 6) % 2 === 1) pluck(melody[st], t, s16 * 3.5, 0.2);
        this.nextNote += s16; this.step++;
      }
    }, 50);
  },
};
