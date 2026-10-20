'use strict';
// ---------------------------------------------------------------------------
// Bootstrap: screens, main loop, input, resize.
// ---------------------------------------------------------------------------
const App = {
  screen: 'title',
  game: null,
  scale: 1, dpr: 1,
  cv: null, ctx: null, bg: null, bgKey: '',
  acc: 0, lastT: 0,
  drag: null,
  progress: Store.get('pw-progress', [0, 0, 0]),

  init() {
    this.cv = $('cv');
    this.ctx = this.cv.getContext('2d');
    UI.init({
      shopDown: (t, e) => this.shopDown(t, e),
      deselect: () => this.select(null),
      startLevel: (i) => this.startLevel(i),
      showLevels: () => this.showLevels(),
      scale: () => this.scale,
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindInput();
    this.bindButtons();
    this.game = new Game(0, { demo: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.screen === 'game' && this.game.state === 'play') this.pause(true); });
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.scale = s;
    const st = $('stage');
    st.style.transform = `scale(${s})`;
    st.style.left = Math.round((window.innerWidth - W * s) / 2) + 'px';
    st.style.top = Math.round((window.innerHeight - H * s) / 2) + 'px';
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = s * this.dpr;
    this.cv.width = Math.round(W * k); this.cv.height = Math.round(H * k);
    Sprites.setScale((this.cv.width / W) * 1.15);
    this.bgKey = '';
  },

  ensureBg() {
    const g = this.game;
    const key = g.levelIdx + ':' + this.cv.width;
    if (this.bgKey === key) return;
    this.bgKey = key;
    if (!this.bg) this.bg = document.createElement('canvas');
    this.bg.width = this.cv.width; this.bg.height = this.cv.height;
    const c = this.bg.getContext('2d');
    const k = this.cv.width / W;
    c.setTransform(k, 0, 0, k, 0, 0);
    Art.renderBackground(c, g.L, g.paths, g.scenery);
  },

  loop(t) {
    const real = Math.min(0.1, (t - (this.lastT || t)) / 1000);
    this.lastT = t;
    const g = this.game;
    if (g) {
      const running = !(this.screen === 'game' && (g.paused || $('result').classList.contains('hidden') === false));
      if (running) {
        this.acc += real * (this.screen === 'game' ? g.speed : 1);
        let n = 0;
        while (this.acc >= DT && n < 8) { g.update(DT); this.acc -= DT; n++; }
        if (n === 8) this.acc = 0;
        g.updateAmbient(real);
      }
      g.realTime += real;
      this.ensureBg();
      const k = this.cv.width / W;
      this.ctx.setTransform(k, 0, 0, k, 0, 0);
      g.render(this.ctx, this.bg);
      if (this.screen === 'game') UI.update(g);
    }
    requestAnimationFrame((tt) => this.loop(tt));
  },

  // ------------------------------------------------------------------ screens
  fade(fn) {
    const f = $('fade');
    f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 300);
  },
  showTitle() {
    this.fade(() => {
      this.screen = 'title';
      this.hideAll();
      $('title').classList.remove('hidden');
      this.game = new Game(0, { demo: true });
    });
  },
  showLevels() {
    this.fade(() => {
      this.screen = 'levels';
      this.hideAll();
      UI.buildLevels(this.progress);
      $('levels').classList.remove('hidden');
      if (!this.game || !this.game.demo) this.game = new Game(0, { demo: true });
    });
  },
  hideAll() {
    for (const id of ['title', 'levels', 'pause', 'result', 'hud']) $(id).classList.add('hidden');
    UI.hideTip();
  },
  startLevel(i) {
    this.fade(() => {
      this.screen = 'game';
      this.hideAll();
      $('hud').classList.remove('hidden');
      const g = new Game(i, {
        on: {
          banner: (a, b, c) => UI.banner(a, b, c),
          intro: (t) => UI.intro(t),
          boss: (e) => UI.boss(e),
          end: (won, stars) => this.end(won, stars),
        },
      });
      this.game = g;
      g.speed = 1;
      $('btnSpeed').classList.remove('on'); $('speedLbl').textContent = 'x1';
      UI.bindGame(g);
      UI.setPlacing(null);
      setTimeout(() => UI.banner(g.L.name, `ステージ ${i + 1} ／ ウェーブ ${g.totalWaves}`), 350);
    });
  },
  end(won, stars) {
    const g = this.game;
    this.cancelPlacing(); this.select(null);
    if (won) {
      this.progress[g.levelIdx] = Math.max(this.progress[g.levelIdx] || 0, stars);
      Store.set('pw-progress', this.progress);
      Sound.play('win');
    }
    UI.showResult(won, stars, g);
  },
  pause(on) {
    const g = this.game;
    if (this.screen !== 'game' || g.state !== 'play') return;
    g.paused = on;
    $('pause').classList.toggle('hidden', !on);
    this.syncToggles();
  },

  // ------------------------------------------------------------------ input
  toWorld(e) {
    const r = $('stage').getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
  },
  shopDown(type, e) {
    Sound.init();
    const g = this.game;
    if (this.screen !== 'game' || g.state !== 'play') return;
    if (g.gold < TOWERS[type].cost) { Sound.play('error'); UI.shakeCard(type); return; }
    this.select(null);
    if (g.placing === type) { this.cancelPlacing(); return; }
    g.placing = type;
    g.hover = null;
    UI.setPlacing(type);
    Sound.play('click');
    this.drag = { type, x: e.clientX, y: e.clientY, moved: false };
  },
  cancelPlacing() {
    if (!this.game) return;
    this.game.placing = null;
    UI.setPlacing(null);
  },
  select(tw) {
    const g = this.game;
    if (!g) return;
    g.selected = tw;
    if (tw) UI.openPanel(tw); else UI.closePanel();
  },
  tryPlace(p) {
    const g = this.game;
    const type = g.placing;
    if (!type) return false;
    if (g.gold < TOWERS[type].cost) { Sound.play('error'); UI.shakeCard(type); this.cancelPlacing(); return false; }
    if (!g.canPlace(type, p.x, p.y)) { Sound.play('error'); return false; }
    const tw = g.place(type, p.x, p.y);
    this.cancelPlacing();
    return !!tw;
  },
  bindInput() {
    const stage = $('stage');
    window.addEventListener('pointermove', (e) => {
      if (this.screen !== 'game') return;
      const g = this.game, p = this.toWorld(e);
      g.hover = p;
      if (this.drag && Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 12) this.drag.moved = true;
      const over = !g.placing && g.towerAt(p.x, p.y);
      this.cv.style.cursor = g.placing ? 'none' : over ? 'pointer' : 'default';
    });
    window.addEventListener('pointerup', (e) => {
      if (this.screen !== 'game' || !this.drag) return;
      const d = this.drag; this.drag = null;
      if (d.moved && this.game.placing) {
        const p = this.toWorld(e);
        if (!this.tryPlace(p)) this.cancelPlacing();
      }
    });
    this.cv.addEventListener('pointerdown', (e) => {
      Sound.init();
      if (this.screen !== 'game') return;
      const g = this.game, p = this.toWorld(e);
      g.hover = p;
      if (e.button === 2) { this.cancelPlacing(); this.select(null); return; }
      if (g.placing) {
        if (e.pointerType === 'touch' && !this.touchArmed) {
          // first tap on touch shows the ghost; second tap on the same spot places
          this.touchArmed = p; return;
        }
        if (e.pointerType === 'touch' && dist(p.x, p.y, this.touchArmed.x, this.touchArmed.y) > 30) { this.touchArmed = p; return; }
        this.touchArmed = null;
        this.tryPlace(p);
        return;
      }
      const tw = g.towerAt(p.x, p.y);
      if (tw) { Sound.play('click'); this.select(tw === g.selected ? null : tw); }
      else this.select(null);
    });
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      Sound.init();
      if (this.screen !== 'game') { if (this.screen === 'title' && (e.key === 'Enter' || e.key === ' ')) $('btnPlay').click(); return; }
      const g = this.game;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (e.key === 'Escape' && (g.placing || g.selected)) { this.cancelPlacing(); this.select(null); return; }
        this.pause(!g.paused); return;
      }
      if (g.paused || g.state !== 'play') return;
      const i = TOWER_ORDER.findIndex((t) => TOWERS[t].key === e.key);
      if (i >= 0) {
        const type = TOWER_ORDER[i];
        if (g.gold < TOWERS[type].cost) { Sound.play('error'); UI.shakeCard(type); return; }
        this.select(null); g.placing = g.placing === type ? null : type; UI.setPlacing(g.placing); Sound.play('click');
      } else if (e.key === ' ') { e.preventDefault(); if (g.startNextWave()) Sound.play('click'); }
      else if (e.key === 'f' || e.key === 'F') $('btnSpeed').click();
      else if ((e.key === 'u' || e.key === 'U') && g.selected) {
        const tw = g.selected;
        const ok = tw.level < 3 ? g.upgrade(tw) : false;
        if (ok) UI.renderPanel(); else Sound.play('error');
      }
    });
  },
  syncToggles() {
    for (const id of ['tSfx', 'pSfx']) $(id).classList.toggle('off', !Sound.sfxOn);
    for (const id of ['tMusic', 'pMusic']) $(id).classList.toggle('off', !Sound.musicOn);
  },
  bindButtons() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); Sound.init(); Sound.play('click'); fn(); });
    click('btnPlay', () => this.showLevels());
    click('btnBack', () => this.showTitle());
    click('btnPause', () => this.pause(true));
    click('btnResume', () => this.pause(false));
    click('btnRestart', () => this.startLevel(this.game.levelIdx));
    click('btnQuit', () => this.showLevels());
    click('btnSpeed', () => {
      const g = this.game;
      g.speed = g.speed === 1 ? 2 : g.speed === 2 ? 3 : 1;
      $('speedLbl').textContent = 'x' + g.speed;
      $('btnSpeed').classList.toggle('on', g.speed > 1);
    });
    $('btnWave').addEventListener('pointerdown', (e) => e.stopPropagation());
    click('btnWave', () => { this.game.startNextWave(); });
    const sfx = () => { Sound.setSfx(!Sound.sfxOn); this.syncToggles(); };
    const mus = () => { Sound.setMusic(!Sound.musicOn); this.syncToggles(); };
    const full = () => { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else d.documentElement.requestFullscreen && d.documentElement.requestFullscreen().catch(() => {}); };
    click('tSfx', sfx); click('pSfx', sfx); click('tMusic', mus); click('pMusic', mus); click('tFull', full); click('pFull', full);
    document.querySelectorAll('#hud .btn, #btnWave').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));
    this.syncToggles();
  },
};

window.addEventListener('load', () => {
  const go = () => App.init();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`800 20px ${FONT}`, 'ふわもりあ0'), document.fonts.load(`500 20px ${FONT}`, 'ふわもりあ0')]).then(go, go);
  } else go();
});
