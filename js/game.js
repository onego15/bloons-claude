'use strict';
// ---------------------------------------------------------------------------
// Game: simulation + world rendering. Has no DOM dependency so it can also be
// driven headless (tools/sim.js) for balance testing.
// ---------------------------------------------------------------------------
const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Yu Gothic UI", sans-serif';
const DT = 1 / 60;
const TS = 1.14, ES = 1.12; // world scale of tower / enemy sprites
const TARGET_MODES = ['first', 'last', 'strong', 'close'];
const TARGET_NAMES = { first: '先頭', last: '最後尾', strong: '強い敵', close: '近い敵' };

class Game {
  constructor(levelIdx, opts = {}) {
    this.levelIdx = levelIdx;
    this.L = LEVELS[levelIdx];
    this.demo = !!opts.demo;
    this.headless = !!opts.headless;
    this.paths = this.L.paths.map((p) => new Path(p));
    this.scenery = buildScenery(this.L, this.paths);
    this.gold = this.L.gold;
    this.lives = this.maxLives = this.L.lives;
    this.waveIdx = 0;
    this.totalWaves = this.L.waves.length;
    this.towers = []; this.enemies = []; this.projs = []; this.fx = []; this.decals = []; this.ambient = [];
    this.spawners = [];
    this.time = 0; this.realTime = 0;
    this.nextWaveTimer = -1;          // countdown until auto-start (-1 = not running)
    this.state = 'play';
    this.endTimer = 0;
    this.speed = 1; this.paused = false;
    this.shake = 0; this.homeHit = 0; this.leakFlash = 0;
    this.selected = null; this.placing = null; this.hover = null;
    this.idSeq = 1;
    this.on = opts.on || {};
    this.uiBlocks = [];
    this.seen = new Set(this.demo || this.headless ? Object.keys(ENEMIES) : Store.get('pw-seen', []));
    this.record = { kills: 0, leaked: 0, built: 0 };
    this.boss = null;
    this.entry = this.paths.map((p) => { const d = p.entryDist(); return p.at(d + 6); });
    this.cloudShadows = [];
    for (let i = 0; i < 4; i++) this.cloudShadows.push({ x: rand(0, W), y: rand(0, H), r: rand(90, 160), v: rand(8, 16) });
    if (this.demo) this.setupDemo();
  }

  emit(n, ...a) { const f = this.on[n]; if (f) f(...a); }

  // ------------------------------------------------------------------ waves
  canCallWave() {
    if (this.state !== 'play' || this.waveIdx >= this.totalWaves) return false;
    if (this.waveIdx === 0) return true;
    return this.spawners.every((s) => s.left === 0);
  }
  earlyBonus() { return this.nextWaveTimer > 0 && this.waveIdx > 0 ? Math.ceil(this.nextWaveTimer * 2) : 0; }

  startNextWave() {
    if (!this.canCallWave()) return false;
    const bonus = this.earlyBonus();
    if (bonus > 0) {
      this.gold += bonus;
      this.addText(W - 150, H - 140, `はやよび +${bonus}`, '#ffd84a', 22);
    }
    if (this.waveIdx > 0) {
      const wb = 20 + this.waveIdx * 4;
      this.gold += wb;
      this.addText(250, 80, `ウェーブボーナス +${wb}`, '#ffd84a', 20);
    }
    const wave = this.L.waves[this.waveIdx];
    this.waveIdx++;
    const hpScale = this.L.hpMul * (1 + 0.075 * (this.waveIdx - 1));
    for (const g of wave) {
      const [type, count, gap, delay = 0, path = 0] = g;
      this.spawners.push({ type, left: count, gap, t: delay, path, alt: 0, hpScale, first: true });
    }
    this.nextWaveTimer = -1;
    // honey farms pay out
    for (const tw of this.towers) {
      if (tw.type !== 'farm') continue;
      const inc = tw.st.income;
      this.gold += inc;
      tw.earned = (tw.earned || 0) + inc;
      tw.fireAnim = 1;
      this.addText(tw.x, tw.y - 70, `+${inc}`, '#ffd84a', 22);
      for (let i = 0; i < 5; i++) this.fx.push({ k: 'coin', x: tw.x, y: tw.y - 40, sx: tw.x, sy: tw.y - 40, tx: 205, ty: 34, t: -i * 0.07, T: 0.75 });
    }
    const last = this.waveIdx === this.totalWaves;
    const hasBoss = wave.some((g) => ENEMIES[g[0]].boss);
    this.emit('banner', hasBoss ? 'ボス襲来！' : last ? 'さいごのウェーブ！' : `ウェーブ ${this.waveIdx}`, hasBoss ? 'グルームキングが現れた' : last ? 'ここを守りきれば勝利だ' : `${this.waveIdx} / ${this.totalWaves}`, hasBoss);
    Sound.play(hasBoss ? 'boss' : 'wave');
    return true;
  }

  updateSpawners(dt) {
    for (const s of this.spawners) {
      if (s.left <= 0) continue;
      s.t -= dt;
      while (s.t <= 0 && s.left > 0) {
        let pi = s.path;
        if (pi === -1) { pi = s.alt % this.paths.length; s.alt++; }
        pi = Math.min(pi, this.paths.length - 1);
        if (s.first) {
          s.first = false;
          if (!this.seen.has(s.type)) {
            this.seen.add(s.type);
            Store.set('pw-seen', [...this.seen]);
            this.emit('intro', s.type);
          }
        }
        this.spawnEnemy(s.type, pi, s.hpScale, 0);
        s.left--;
        s.t += s.gap;
      }
    }
    if (this.waveIdx > 0 && this.waveIdx < this.totalWaves && this.nextWaveTimer < 0 && this.spawners.every((x) => x.left === 0)) {
      this.nextWaveTimer = 20;
      this.spawners = this.spawners.filter((x) => x.left > 0);
    }
  }

  spawnEnemy(type, pi, hpScale, d, off) {
    const def = ENEMIES[type];
    const hp = Math.round(def.hp * (def.boss ? this.L.hpMul : hpScale));
    const e = {
      id: this.idSeq++, type, def, hp, maxHp: hp, pi, path: this.paths[pi], dist: d,
      speed: def.speed * rand(0.96, 1.04), slowT: 0, slowF: 0, stunT: 0, flash: 0, hitT: 0,
      ph: rand(0, TAU), x: -100, y: -100, face: 1, alive: true, r: def.r, fly: !!def.fly,
      armor: def.armor || 0, mres: def.mres || 0, off: off !== undefined ? off : rand(-9, 9),
      healT: 2.5, summonT: 6, born: 0,
    };
    this.placeEnemy(e);
    this.enemies.push(e);
    if (def.boss) { this.boss = e; this.emit('boss', e); this.shake = Math.max(this.shake, 10); }
    return e;
  }

  placeEnemy(e) {
    const p = e.path.at(e.dist, this._tmp || (this._tmp = {}));
    const len = Math.hypot(p.dx, p.dy) || 1;
    e.x = p.x - (p.dy / len) * e.off;
    e.y = p.y + (p.dx / len) * e.off;
    if (Math.abs(p.dx) > 0.3) e.face = p.dx > 0 ? 1 : -1;
  }

  // ---------------------------------------------------------------- towers
  stats(type, level, branch) {
    const def = TOWERS[type];
    const base = Object.assign({}, def.levels[Math.min(level, 3) - 1]);
    if (branch) Object.assign(base, def.branches[branch]);
    delete base.cost; delete base.title; delete base.desc;
    return base;
  }

  canPlace(type, x, y) {
    if (x < 24 || x > W - 24 || y < 40 || y > H - 12) return false;
    for (const r of this.uiBlocks) if (x > r.x - 18 && x < r.x + r.w + 18 && y > r.y - 12 && y < r.y + r.h + 30) return false;
    for (const p of this.paths) if (p.distTo(x, y) < 26 + 19) return false;
    for (const b of this.scenery.blockers) if (dist(x, y, b.x, b.y) < b.r + 14) return false;
    for (const t of this.towers) if (dist2(x, y, t.x, t.y) < 48 * 48) return false;
    return true;
  }

  place(type, x, y) {
    const def = TOWERS[type];
    if (this.gold < def.cost || !this.canPlace(type, x, y)) return null;
    this.gold -= def.cost;
    const tw = {
      id: this.idSeq++, type, x, y, level: 1, branch: null, spent: def.cost, cooldown: 0.2,
      angle: -Math.PI / 2 + (x > W / 2 ? Math.PI : 0) * 0.0, target: def.levels[0].target || 'first', fireAnim: 0, born: 0, upT: 9, kills: 0, dmgDone: 0,
    };
    tw.st = this.stats(type, 1, null);
    this.towers.push(tw);
    this.record.built++;
    this.dust(x, y, 14);
    Sound.play('build');
    return tw;
  }

  upgradeCost(tw, branch) {
    const def = TOWERS[tw.type];
    if (tw.branch) return null;
    if (tw.level < 3) return def.levels[tw.level].cost;
    if (!def.branches) return null;
    return branch ? def.branches[branch].cost : null;
  }

  upgrade(tw, branch) {
    const cost = this.upgradeCost(tw, branch);
    if (cost == null || this.gold < cost) return false;
    this.gold -= cost;
    tw.spent += cost;
    if (tw.level < 3) tw.level++;
    else { tw.branch = branch; tw.level = 4; if (TOWERS[tw.type].branches[branch].target) tw.target = TOWERS[tw.type].branches[branch].target; }
    tw.st = this.stats(tw.type, tw.level, tw.branch);
    tw.upT = 0;
    this.burst(tw.x, tw.y - 30, ['#ffd84a', '#fff6c2', '#ffffff'], 18, 220);
    this.fx.push({ k: 'ring', x: tw.x, y: tw.y - 8, r0: 10, r1: 60, life: 0.45, max: 0.45, col: '#ffe680', lw: 5 });
    this.addText(tw.x, tw.y - 72, 'LEVEL UP!', '#ffe14d', 22);
    Sound.play('upgrade');
    return true;
  }

  sellValue(tw) { return Math.floor(tw.spent * 0.7); }

  sell(tw) {
    const v = this.sellValue(tw);
    this.gold += v;
    this.towers = this.towers.filter((t) => t !== tw);
    if (this.selected === tw) this.selected = null;
    this.dust(tw.x, tw.y, 12);
    this.addText(tw.x, tw.y - 40, `+${v}`, '#ffd84a', 24);
    for (let i = 0; i < 4; i++) this.fx.push({ k: 'coin', x: tw.x, y: tw.y - 20, sx: tw.x, sy: tw.y - 20, tx: 205, ty: 34, t: -i * 0.06, T: 0.6 });
    Sound.play('sell');
  }

  towerAt(x, y) {
    let best = null, bd = 38 * 38;
    for (const t of this.towers) {
      const d = dist2(x, y, t.x, t.y - 22);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  findTarget(tw, range, air, exclude) {
    let best = null, bv = Infinity;
    const r2 = range * range;
    for (const e of this.enemies) {
      if (!e.alive || (e.fly && !air) || e === exclude) continue;
      if (e.dist < 4) continue;
      if (dist2(tw.x, tw.y - 10, e.x, e.y) > r2) continue;
      let v;
      switch (tw.target) {
        case 'first': v = e.path.length - e.dist; break;
        case 'last': v = e.dist - e.path.length; break;
        case 'strong': v = -(e.hp + e.maxHp * 0.001) * 1000 + (e.path.length - e.dist) * 0.001; break;
        case 'close': v = dist2(tw.x, tw.y, e.x, e.y); break;
      }
      if (v < bv) { bv = v; best = e; }
    }
    return best;
  }

  updateTower(tw, dt) {
    tw.born += dt; tw.upT += dt;
    tw.fireAnim = Math.max(0, tw.fireAnim - dt * 3.2);
    if (tw.type === 'farm') return;
    const st = tw.st;
    tw.cooldown -= dt;
    const def = TOWERS[tw.type];
    const tgt = this.findTarget(tw, st.range, def.air);
    if (tgt) {
      const want = Math.atan2(tgt.y - (tw.y - 34), tgt.x - tw.x);
      let da = want - tw.angle;
      while (da > Math.PI) da -= TAU;
      while (da < -Math.PI) da += TAU;
      tw.angle += da * Math.min(1, dt * 14);
    }
    if (tw.cooldown > 0 || !tgt) return;
    tw.cooldown = 1 / st.rate;
    tw.fireAnim = 1;
    this.fire(tw, tgt);
  }

  fire(tw, tgt) {
    const st = tw.st;
    switch (tw.type) {
      case 'shooter':
      case 'squirrel': {
        const ox = tw.x + Math.cos(tw.angle) * 20, oy = tw.y - 40 + Math.sin(tw.angle) * 20;
        if (tw.branch === 'A') {
          // sniper: instant tracer
          this.damage(tgt, st.dmg, 'phys', 1, tw);
          this.fx.push({ k: 'tracer', x0: ox, y0: oy, x1: tgt.x, y1: tgt.y - tgt.r, life: 0.18, max: 0.18 });
          this.fx.push({ k: 'flash', x: ox, y: oy, r: 18, life: 0.08, max: 0.08, col: '255,230,150' });
          this.hitSparks(tgt.x, tgt.y - tgt.r, ['#ffe680', '#ffffff', '#c98a4b'], 10, 260);
          this.fx.push({ k: 'ring', x: tgt.x, y: tgt.y - tgt.r, r0: 4, r1: 30, life: 0.25, max: 0.25, col: '#fff3b0', lw: 4 });
          this.shake = Math.max(this.shake, 2.5);
          Sound.play('sniper');
        } else {
          const spread = tw.branch === 'B' ? rand(-0.08, 0.08) : 0;
          this.projs.push({ k: 'acorn', x: ox, y: oy, target: tgt, tx: tgt.x, ty: tgt.y - tgt.r, speed: tw.branch === 'B' ? 640 : 540, dmg: st.dmg, src: tw, rot: 0, spread, life: 1.2 });
          Sound.play('shoot', tw.branch === 'B' ? 1.3 : 1);
        }
        break;
      }
      case 'mortar': {
        const T = 0.7 + dist(tw.x, tw.y, tgt.x, tgt.y) / 700;
        const sp = tgt.stunT > 0 ? 0 : tgt.speed * (tgt.slowT > 0 ? 1 - tgt.slowF : 1);
        const fut = tgt.path.at(Math.min(tgt.path.length, tgt.dist + sp * T));
        const len = Math.hypot(fut.dx, fut.dy) || 1;
        const fx = fut.x - (fut.dy / len) * tgt.off, fy = fut.y + (fut.dx / len) * tgt.off;
        const big = tw.branch === 'A';
        const col = big ? ['#ff6a3d', '#c43f22'] : tw.branch === 'B' ? ['#c25ee8', '#8a35b0'] : ['#ec4b55', '#b0303d'];
        this.projs.push({ k: 'spore', x0: tw.x, y0: tw.y - 60, x1: fx, y1: fy, t: 0, T, h: 120 + T * 60, dmg: st.dmg, splash: st.splash, stun: st.stun || 0, cluster: st.cluster || 0, clusterDmg: st.clusterDmg || 0, src: tw, r: big ? 10 : 7.5, col, x: tw.x, y: tw.y - 60 });
        this.smoke(tw.x, tw.y - 64, 4, '#fff1e0');
        Sound.play('mortar');
        break;
      }
      case 'frost': {
        if (st.pulse) {
          const r2 = st.range * st.range;
          for (const e of this.enemies) {
            if (!e.alive || dist2(tw.x, tw.y, e.x, e.y) > r2) continue;
            this.applySlow(e, st.slow, st.slowDur);
            this.damage(e, st.dmg, 'magic', 0, tw);
          }
          this.fx.push({ k: 'ring', x: tw.x, y: tw.y - 8, r0: 20, r1: st.range, life: 0.55, max: 0.55, col: '#c9f5ff', lw: 8, fill: 'rgba(190,240,255,0.18)' });
          for (let i = 0; i < 26; i++) {
            const a = rand(0, TAU), r = rand(10, st.range);
            this.fx.push({ k: 'snow', x: tw.x + Math.cos(a) * r, y: tw.y + Math.sin(a) * r * 0.6 - 10, vx: rand(-20, 20), vy: rand(-40, -10), life: rand(0.5, 0.9), max: 0.9, r: rand(2, 4) });
          }
          Sound.play('blizzard');
        } else {
          const big = tw.branch === 'B';
          this.projs.push({ k: 'shard', x: tw.x, y: tw.y - 62, target: tgt, tx: tgt.x, ty: tgt.y - tgt.r, speed: big ? 480 : 420, dmg: st.dmg, slow: st.slow, slowDur: st.slowDur, splash: st.splash || 0, shatter: st.shatter || 0, src: tw, big, life: 1.4, trailT: 0 });
          Sound.play('frost', big ? 0.7 : 1);
        }
        break;
      }
      case 'thunder': {
        const oy = tw.y - ((34 + Math.min(tw.level, 3) * 4 + (tw.branch ? 4 : 0)) + 15) * TS;
        if (st.storm) {
          this.projs.push({ k: 'strike', x: tgt.x, y: tgt.y, target: tgt, t: 0.28, dmg: st.dmg, splash: st.splash, stun: st.stun, src: tw });
          this.fx.push({ k: 'warn', x: tgt.x, y: tgt.y, life: 0.28, max: 0.28, r: st.splash });
          break;
        }
        let from = { x: tw.x, y: oy };
        const hit = new Set();
        let cur = tgt, dmg = st.dmg;
        for (let i = 0; i < st.chains && cur; i++) {
          hit.add(cur);
          this.bolt(from.x, from.y, cur.x, cur.y - cur.r, i === 0 ? 3.2 : 2.4);
          this.damage(cur, dmg, 'magic', 0, tw);
          this.hitSparks(cur.x, cur.y - cur.r, ['#fff7b0', '#ffe14d', '#ffffff'], 5, 200);
          from = { x: cur.x, y: cur.y - cur.r };
          dmg *= 0.85;
          let nb = null, nd = 120 * 120;
          for (const e of this.enemies) {
            if (!e.alive || hit.has(e)) continue;
            const d = dist2(cur.x, cur.y, e.x, e.y);
            if (d < nd) { nd = d; nb = e; }
          }
          cur = nb;
        }
        this.fx.push({ k: 'flash', x: tw.x, y: oy, r: 30, life: 0.12, max: 0.12, col: '255,240,150' });
        Sound.play('zap');
        break;
      }
    }
  }

  applySlow(e, f, dur) {
    if (e.def.boss) f *= 0.5;
    if (f >= e.slowF || e.slowT <= 0) e.slowF = f;
    e.slowT = Math.max(e.slowT, dur);
  }

  damage(e, amt, dtype, pierce = 0, src) {
    if (!e.alive) return 0;
    let m = 1;
    if (dtype === 'phys') m = 1 - e.armor * (1 - pierce);
    else if (dtype === 'magic') m = 1 - e.mres;
    const d = amt * m;
    e.hp -= d;
    e.flash = 0.07; e.hitT = 0.12;
    if (src) src.dmgDone += d;
    if (m < 0.5 && Math.random() < 0.25) this.addText(e.x + rand(-6, 6), e.y - e.r * 2 - 6, 'カキン', '#c9d6e8', 15);
    if (e.hp <= 0) this.kill(e, src);
    return d;
  }

  kill(e, src) {
    e.alive = false;
    this.gold += e.def.reward;
    this.record.kills++;
    if (src) src.kills++;
    const p = ENEMY_PAL[e.type];
    const cy = e.fly ? e.y - 32 : e.y - e.r;
    const big = e.r >= 24;
    // ink pop
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const a = rand(0, TAU), s = rand(80, big ? 340 : 230);
      this.fx.push({ k: 'drop', x: cy ? e.x : e.x, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, g: 600, r: rand(2.5, big ? 8 : 5.5), col: Math.random() < 0.5 ? p.a : p.b, life: rand(0.35, 0.7), max: 0.7 });
    }
    for (let i = 0; i < (big ? 10 : 4); i++) {
      const a = rand(0, TAU), s = rand(60, 180);
      this.fx.push({ k: 'star', x: e.x, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, rot: rand(0, TAU), vr: rand(-8, 8), r: rand(4, 7), col: pick(['#fff6c2', '#ffd84a', '#ffffff']), life: rand(0.4, 0.7), max: 0.7 });
    }
    this.fx.push({ k: 'ring', x: e.x, y: cy, r0: e.r * 0.5, r1: e.r * 2.2, life: 0.3, max: 0.3, col: '#ffffff', lw: 4 });
    this.fx.push({ k: 'pow', x: e.x, y: cy, r: e.r * 1.5, rot: rand(0, 1), life: 0.16, max: 0.16 });
    this.fx.push({ k: 'flash', x: e.x, y: cy, r: e.r * 2.2, life: 0.1, max: 0.1, col: '255,255,255' });
    if (!e.fly) this.decals.push({ x: e.x, y: e.y - 2, r: e.r * 1.2, col: p.b, life: 7, max: 7, seed: Math.random() * 1000 });
    this.addText(e.x, cy - e.r - 6, `+${e.def.reward}`, '#ffd84a', big ? 24 : 17);
    if (big) { this.shake = Math.max(this.shake, e.def.boss ? 18 : 7); Sound.play('bigpop'); } else Sound.play('pop', 0.8 + Math.random() * 0.5);
    if (e.def.split) {
      for (let i = 0; i < e.def.split; i++) {
        const c = this.spawnEnemy('gloomlet', e.pi, (e.maxHp / e.def.hp) * 0.9, Math.max(0, e.dist + (i - 1) * 12), clamp(e.off + (i - 1) * 9, -14, 14));
        c.born = 0; c.hop = 0.35;
      }
    }
    if (e === this.boss) { this.boss = null; this.emit('boss', null); }
  }

  leak(e) {
    e.alive = false;
    if (this.demo) return;
    this.lives = Math.max(0, this.lives - e.def.lives);
    this.record.leaked += e.def.lives;
    this.homeHit = 1; this.leakFlash = 1;
    this.shake = Math.max(this.shake, 6);
    const [hx, hy] = this.L.home;
    this.addText(hx, hy - 120, `-${e.def.lives}`, '#ff5d6c', 28);
    this.burst(hx, hy - 50, ['#ff5d6c', '#ffb3c0', '#ffffff'], 10, 200);
    Sound.play('leak');
    if (e === this.boss) { this.boss = null; this.emit('boss', null); }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    if (this.state === 'play') {
      this.updateSpawners(dt);
      if (this.nextWaveTimer > 0) {
        this.nextWaveTimer -= dt;
        if (this.nextWaveTimer <= 0) { this.nextWaveTimer = 0; this.startNextWave(); }
      }
    }
    if (this.demo) this.updateDemo(dt);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.born += dt;
      e.flash -= dt; e.hitT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      let sp = 0;
      if (e.stunT > 0) e.stunT -= dt;
      else {
        sp = e.speed * (e.slowT > 0 ? 1 - e.slowF : 1);
        if (e.hop > 0) { e.hop -= dt; sp *= 0.2; }
        e.dist += sp * dt;
        e.ph += dt * (3 + sp / 14);
      }
      this.placeEnemy(e);
      if (e.def.heal) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 2.6;
          let any = false;
          for (const o of this.enemies) {
            if (!o.alive || o.def.boss || dist2(o.x, o.y, e.x, e.y) > 95 * 95 || o.hp >= o.maxHp) continue;
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); any = true;
            this.fx.push({ k: 'plus', x: o.x + rand(-6, 6), y: o.y - o.r * 2, vy: -40, life: 0.7, max: 0.7 });
          }
          this.fx.push({ k: 'ring', x: e.x, y: e.y - 6, r0: 10, r1: 95, life: 0.6, max: 0.6, col: '#7cf0a8', lw: 5, fill: 'rgba(124,240,168,0.12)' });
          if (any) Sound.play('heal');
        }
      }
      if (e.def.boss) {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 7;
          for (let i = 0; i < 4; i++) this.spawnEnemy(i % 2 ? 'zipper' : 'gloomlet', e.pi, this.L.hpMul * 1.6, Math.max(0, e.dist - 30 - i * 14));
          this.fx.push({ k: 'ring', x: e.x, y: e.y - 30, r0: 20, r1: 110, life: 0.5, max: 0.5, col: '#c99bff', lw: 6 });
          this.shake = Math.max(this.shake, 5);
        }
      }
      if (e.dist >= e.path.length) this.leak(e);
    }
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    for (const tw of this.towers) this.updateTower(tw, dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.homeHit = Math.max(0, this.homeHit - dt * 2.5);
    this.leakFlash = Math.max(0, this.leakFlash - dt * 2);
    // end conditions
    if (this.state === 'play' && !this.demo) {
      if (this.lives <= 0) { this.state = 'lost'; this.endTimer = 1.2; Sound.play('lose'); }
      else if (this.waveIdx >= this.totalWaves && this.spawners.every((s) => s.left === 0) && this.enemies.length === 0) {
        this.state = 'won'; this.endTimer = 1.4;
      }
    } else if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.state === 'won' && Math.random() < 0.25) this.burst(rand(200, W - 200), rand(100, 400), ['#ffd84a', '#ff8fb5', '#8fe3ff', '#b9a2ff', '#ffffff'], 14, 260);
      if (this.endTimer <= 0) {
        this.endTimer = -1;
        const stars = this.lives >= this.maxLives * 0.9 ? 3 : this.lives >= this.maxLives * 0.5 ? 2 : 1;
        this.emit('end', this.state === 'won', stars);
      }
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projs) {
      let alive = true;
      if (p.k === 'acorn' || p.k === 'shard') {
        if (p.target.alive) { p.tx = p.target.x; p.ty = p.target.y - (p.target.fly ? 32 : p.target.r); }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        const step = p.speed * dt;
        p.rot += dt * 18;
        p.ang = Math.atan2(dy, dx) + (p.spread || 0);
        p.life -= dt;
        if (d <= step + 4) {
          alive = false;
          if (p.target.alive) this.projHit(p);
          else this.poof(p.x, p.y, p.k === 'shard' ? '#c9f5ff' : '#c98a4b');
        } else {
          p.x += (dx / d) * step; p.y += (dy / d) * step;
          if (p.k === 'shard') {
            p.trailT -= dt;
            if (p.trailT <= 0) { p.trailT = 0.03; this.fx.push({ k: 'glint', x: p.x, y: p.y, life: 0.3, max: 0.3, r: p.big ? 4 : 2.6 }); }
          }
        }
        if (p.life <= 0) alive = false;
      } else if (p.k === 'spore' || p.k === 'bomblet') {
        p.t += dt;
        const u = Math.min(1, p.t / p.T);
        p.x = lerp(p.x0, p.x1, u);
        p.y = lerp(p.y0, p.y1, u) - Math.sin(u * Math.PI) * p.h;
        if (p.k === 'spore' && Math.random() < 0.5) this.fx.push({ k: 'puff', x: p.x, y: p.y, r: rand(3, 5), vx: 0, vy: -10, life: 0.4, max: 0.4, col: '#fff1e0' });
        if (u >= 1) { alive = false; this.explode(p); }
      } else if (p.k === 'strike') {
        p.t -= dt;
        if (p.target.alive) { p.x = p.target.x; p.y = p.target.y; }
        if (p.t <= 0) {
          alive = false;
          this.bolt(p.x + rand(-30, 30), -20, p.x, p.y - 10, 6, true);
          this.bolt(p.x + rand(-60, 60), -20, p.x, p.y - 10, 3, true);
          this.splashDamage(p.x, p.y, p.splash, p.dmg, 'magic', 0, p.src, true, p.stun);
          this.explosionFx(p.x, p.y, p.splash, ['#fff7b0', '#ffe14d', '#ffffff'], true);
          this.shake = Math.max(this.shake, 9);
          Sound.play('thunder');
        }
      }
      if (alive) keep.push(p);
    }
    this.projs = keep;
  }

  projHit(p) {
    const e = p.target;
    if (p.k === 'acorn') {
      this.damage(e, p.dmg, 'phys', 0, p.src);
      this.hitSparks(p.x, p.y, ['#c98a4b', '#7a4826', '#fff6c2'], 4, 160);
      Sound.play('hit');
    } else {
      const shat = p.shatter && e.slowT > 0 ? p.shatter : 1;
      if (p.splash) {
        const r2 = p.splash * p.splash;
        for (const o of this.enemies) {
          if (!o.alive || dist2(o.x, o.y, e.x, e.y) > r2) continue;
          this.applySlow(o, p.slow, p.slowDur);
          if (o !== e) this.damage(o, p.dmg * 0.5, 'magic', 0, p.src);
        }
        this.fx.push({ k: 'ring', x: e.x, y: e.y - 4, r0: 6, r1: p.splash, life: 0.35, max: 0.35, col: '#c9f5ff', lw: 4, fill: 'rgba(190,240,255,0.18)' });
      }
      this.applySlow(e, p.slow, p.slowDur);
      this.damage(e, p.dmg * shat, 'magic', 0, p.src);
      for (let i = 0; i < (p.big ? 10 : 6); i++) {
        const a = rand(0, TAU), s = rand(60, 180);
        this.fx.push({ k: 'ice', x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 400, rot: rand(0, TAU), vr: rand(-10, 10), r: rand(2.5, p.big ? 6 : 4.5), life: rand(0.3, 0.55), max: 0.55 });
      }
      if (shat > 1) { this.addText(e.x, e.y - e.r * 2 - 8, 'クラッシュ!', '#bdf0ff', 18); this.shake = Math.max(this.shake, 3); }
    }
  }

  splashDamage(x, y, r, dmg, dtype, pierce, src, air, stun) {
    const r2 = r * r;
    for (const e of this.enemies) {
      if (!e.alive || (e.fly && !air)) continue;
      const d2 = dist2(x, y, e.x, e.y);
      if (d2 > r2) continue;
      const f = 1 - 0.4 * Math.sqrt(d2) / r;
      if (stun) e.stunT = Math.max(e.stunT, e.def.boss ? stun * 0.3 : stun);
      this.damage(e, dmg * f, dtype, pierce, src);
    }
  }

  explode(p) {
    this.splashDamage(p.x1, p.y1, p.splash, p.dmg, 'phys', 0, p.src, false, p.stun);
    const small = p.k === 'bomblet';
    this.explosionFx(p.x1, p.y1, p.splash, small ? ['#ffb0f0', '#ffffff', '#c25ee8'] : ['#ffd84a', '#ff8a3d', '#ffffff', p.col[0]], false, small);
    this.decals.push({ x: p.x1, y: p.y1, r: p.splash * 0.45, col: '#4a3428', life: 4, max: 4, seed: Math.random() * 1000, scorch: true });
    if (p.cluster) {
      for (let i = 0; i < p.cluster; i++) {
        const a = (i / p.cluster) * TAU + rand(-0.3, 0.3), r = rand(35, 70);
        this.projs.push({ k: 'bomblet', x0: p.x1, y0: p.y1 - 10, x1: p.x1 + Math.cos(a) * r, y1: p.y1 + Math.sin(a) * r * 0.7, t: 0, T: rand(0.35, 0.5), h: rand(40, 70), dmg: p.clusterDmg, splash: 38, stun: 0, cluster: 0, src: p.src, r: 4.5, col: ['#c25ee8', '#8a35b0'], x: p.x1, y: p.y1 });
      }
    }
    this.shake = Math.max(this.shake, small ? 1.5 : p.stun ? 8 : 4);
    Sound.play('boom', small ? 1.6 : p.stun ? 0.7 : 1);
  }

  explosionFx(x, y, r, cols, electric, small) {
    this.fx.push({ k: 'flash', x, y: y - 6, r: r * 1.4, life: 0.14, max: 0.14, col: electric ? '255,250,200' : '255,220,150' });
    const nk = small ? 2 : r > 80 ? 7 : 5;
    for (let i = 0; i < nk; i++) {
      const a = (i / nk) * TAU + rand(-0.4, 0.4), d = i === 0 ? 0 : rand(r * 0.18, r * 0.42);
      this.fx.push({ k: 'kab', x: x + Math.cos(a) * d, y: y - 10 + Math.sin(a) * d * 0.6 - (i === 0 ? 6 : 0), r: rand(r * 0.26, r * 0.38) * (small ? 0.8 : 1) * (i === 0 ? 1.25 : 1), life: 0.55 + i * 0.03, max: 0.55 + i * 0.03, el: electric });
    }
    this.fx.push({ k: 'ring', x, y: y - 2, r0: r * 0.2, r1: r * 1.05, life: 0.32, max: 0.32, col: '#ffffff', lw: small ? 3 : 6, flat: true });
    const n = small ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(80, r * 4);
      this.fx.push({ k: 'drop', x, y: y - 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 120, g: 700, r: rand(2.5, small ? 4 : 6), col: pick(cols), life: rand(0.35, 0.6), max: 0.6 });
    }
    for (let i = 0; i < (small ? 0 : 3); i++) {
      const a = rand(0, TAU), rr = rand(r * 0.3, r * 0.6);
      this.fx.push({ k: 'puff', x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.6 - 8, r: rand(8, small ? 10 : 16), vx: Math.cos(a) * 20, vy: -30, life: rand(0.5, 0.9), max: 0.9, col: electric ? '#fffbe0' : '#fff1e0' });
    }
  }

  // ---------------------------------------------------------------- fx
  addText(x, y, text, col, size) { if (!this.headless) this.fx.push({ k: 'text', x, y, text, col, size, life: 0.9, max: 0.9 }); }
  burst(x, y, cols, n, sp) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(sp * 0.3, sp);
      this.fx.push({ k: 'star', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, rot: rand(0, TAU), vr: rand(-8, 8), r: rand(3, 6), col: pick(cols), life: rand(0.4, 0.8), max: 0.8 });
    }
  }
  hitSparks(x, y, cols, n, sp) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(sp * 0.4, sp);
      this.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, col: pick(cols), life: rand(0.15, 0.3), max: 0.3 });
    }
  }
  dust(x, y, n) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.fx.push({ k: 'puff', x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 9 - 4, r: rand(6, 10), vx: Math.cos(a) * 50, vy: Math.sin(a) * 20 - 10, life: rand(0.4, 0.6), max: 0.6, col: '#fff6e6' });
    }
  }
  smoke(x, y, n, col) { if (this.headless) return; for (let i = 0; i < n; i++) this.fx.push({ k: 'puff', x: x + rand(-4, 4), y, r: rand(4, 7), vx: rand(-15, 15), vy: rand(-50, -20), life: rand(0.35, 0.55), max: 0.55, col }); }
  poof(x, y, col) { if (this.headless) return; this.fx.push({ k: 'puff', x, y, r: 5, vx: 0, vy: -10, life: 0.3, max: 0.3, col: '#ffffff' }); }
  bolt(x0, y0, x1, y1, w, sky) {
    if (this.headless) return;
    const pts = [];
    const n = Math.max(4, Math.floor(dist(x0, y0, x1, y1) / 14));
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n, j = i === 0 || i === n ? 0 : rand(-1, 1) * (sky ? 22 : 11);
      pts.push([lerp(x0, x1, u) + (nx / nl) * j, lerp(y0, y1, u) + (ny / nl) * j]);
    }
    this.fx.push({ k: 'bolt', pts, w, life: sky ? 0.3 : 0.18, max: sky ? 0.3 : 0.18 });
  }

  updateFx(dt) {
    if (this.headless) { this.fx.length = 0; return; }
    const keep = [];
    for (const f of this.fx) {
      if (f.k === 'coin') {
        f.t += dt;
        if (f.t >= f.T) { Sound.play('coin'); continue; }
        if (f.t > 0) {
          const u = Ease.inCubic(f.t / f.T);
          f.x = lerp(f.sx, f.tx, u); f.y = lerp(f.sy, f.ty, u) - Math.sin((f.t / f.T) * Math.PI) * 80;
        }
        keep.push(f); continue;
      }
      f.life -= dt;
      if (f.life <= 0) continue;
      if (f.vx !== undefined) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.g) f.vy += f.g * dt;
        f.vx *= 1 - dt * 2.5; if (!f.g) f.vy *= 1 - dt * 2.5;
      }
      if (f.vr) f.rot += f.vr * dt;
      if (f.k === 'text') f.y -= dt * 40;
      if (f.k === 'plus') f.y += f.vy * dt;
      keep.push(f);
    }
    this.fx = keep;
    if (this.decals.length) {
      for (const d of this.decals) d.life -= dt;
      this.decals = this.decals.filter((d) => d.life > 0);
      if (this.decals.length > 80) this.decals.splice(0, this.decals.length - 80);
    }
  }

  updateAmbient(dt) {
    const th = this.scenery.theme.ambient;
    for (const c of this.cloudShadows) { c.x += c.v * dt; if (c.x - c.r * 2 > W) { c.x = -c.r * 2; c.y = rand(0, H); } }
    const max = th === 'snow' ? 70 : th === 'leaf' ? 18 : 6;
    if (this.ambient.length < max && Math.random() < dt * (th === 'snow' ? 30 : 4)) {
      if (th === 'butterfly') this.ambient.push({ x: rand(0, W), y: rand(80, H - 80), vx: rand(-25, 25), vy: rand(-10, 10), ph: rand(0, TAU), col: pick(['#ffffff', '#ffd84d', '#ff9fc6', '#b9a2ff']), life: rand(8, 16) });
      else if (th === 'leaf') this.ambient.push({ x: rand(-50, W), y: -20, vx: rand(15, 45), vy: rand(30, 55), ph: rand(0, TAU), col: pick(['#f59a45', '#ea5a4f', '#f7c948']), life: 30 });
      else this.ambient.push({ x: rand(-50, W), y: -10, vx: rand(5, 25), vy: rand(25, 55), ph: rand(0, TAU), r: rand(1.5, 3.5), life: 30 });
    }
    for (const a of this.ambient) {
      a.ph += dt * 3; a.life -= dt;
      if (th === 'butterfly') { a.vx += rand(-40, 40) * dt; a.vy += rand(-40, 40) * dt; a.vx = clamp(a.vx, -35, 35); a.vy = clamp(a.vy, -25, 25); }
      a.x += (a.vx + (th !== 'butterfly' ? Math.sin(a.ph) * 20 : 0)) * dt; a.y += a.vy * dt;
    }
    this.ambient = this.ambient.filter((a) => a.life > 0 && a.y < H + 30 && a.x > -60 && a.x < W + 60);
  }

  // ---------------------------------------------------------------- demo (title screen)
  setupDemo() {
    this.gold = 99999;
    const rng = mulberry32(7);
    const types = ['squirrel', 'mortar', 'thunder', 'frost', 'squirrel', 'mortar', 'frost', 'thunder', 'farm', 'squirrel'];
    const spots = [];
    for (let y = 90; y < H - 40; y += 18) for (let x = 40; x < W - 40; x += 18) {
      const d = Math.min(...this.paths.map((p) => p.distTo(x, y)));
      if (d > 52 && d < 80 && this.canPlace('squirrel', x, y) && Math.abs(x - W / 2) > 200) spots.push([x, y]);
    }
    let n = 0;
    while (n < types.length && spots.length) {
      const [x, y] = spots.splice(Math.floor(rng() * spots.length), 1)[0];
      if (!this.canPlace(types[n], x, y) || this.towers.some((t) => dist(t.x, t.y, x, y) < 140)) continue;
      const tw = this.place(types[n], x, y);
      if (tw.type !== 'farm') { this.upgrade(tw); if (rng() < 0.6) this.upgrade(tw); if (rng() < 0.4) { this.upgrade(tw); this.upgrade(tw, rng() < 0.5 ? 'A' : 'B'); } }
      tw.upT = 9; tw.born = 9;
      n++;
    }
    this.fx.length = 0;
    this.demoT = 0;
  }
  updateDemo(dt) {
    this.demoT -= dt;
    if (this.demoT <= 0) {
      this.demoT = rand(0.5, 1.3);
      this.spawnEnemy(pick(['gloomlet', 'gloomlet', 'zipper', 'shell', 'bubble', 'moth', 'wisp', 'mender']), 0, 1.6, 0);
    }
  }

  // ---------------------------------------------------------------- render
  render(ctx, bg) {
    const t = this.time;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    ctx.drawImage(bg, 0, 0, W, H);
    // decals
    for (const d of this.decals) {
      const a = Math.min(1, d.life / 1.5) * (d.scorch ? 0.28 : 0.42);
      ctx.fillStyle = rgba(d.col, a);
      const rr = mulberry32(d.seed);
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.5, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 5; i++) { const an = rr() * TAU, dd = d.r * (0.8 + rr() * 0.6); ctx.beginPath(); ctx.ellipse(d.x + Math.cos(an) * dd, d.y + Math.sin(an) * dd * 0.5, d.r * 0.22, d.r * 0.12, 0, 0, TAU); ctx.fill(); }
    }
    // portals
    for (const p of this.entry) Art.portal(ctx, clamp(p.x, 18, W - 18), clamp(p.y, 18, H - 18), t, true);
    // selected range / placement ghost underlay
    const sel = this.selected;
    if (sel && sel.st.range) this.drawRange(ctx, sel.x, sel.y, sel.st.range, true);
    if (sel && this.previewRange && this.previewRange !== sel.st.range) this.drawRange(ctx, sel.x, sel.y, this.previewRange, true, true);
    if (this.placing && this.hover) {
      const def = TOWERS[this.placing];
      const ok = this.canPlace(this.placing, this.hover.x, this.hover.y) && this.gold >= def.cost;
      if (def.levels[0].range) this.drawRange(ctx, this.hover.x, this.hover.y, def.levels[0].range, ok);
    }
    // shadows
    for (const tw of this.towers) Art.shadow(ctx, tw.x + 3, tw.y + 3, 36, 15, 0.25);
    for (const e of this.enemies) {
      const s = (e.r / 14) * ES;
      Art.shadow(ctx, e.x, e.y + 1, (e.fly ? 10 : 13) * s, (e.fly ? 4 : 5) * s, e.fly ? 0.16 : 0.24);
    }
    // home
    Art.home(ctx, this.L.home[0], this.L.home[1], t, this.homeHit, true);
    // y-sorted towers + ground enemies
    const list = this._list || (this._list = []);
    list.length = 0;
    for (const tw of this.towers) list.push(tw);
    for (const e of this.enemies) if (!e.fly) list.push(e);
    list.sort((a, b) => a.y - b.y);
    for (const o of list) { if (o.def) this.drawEnemy(ctx, o, t); else this.drawTower(ctx, o, t); }
    // projectiles
    for (const p of this.projs) this.drawProj(ctx, p, t);
    // fliers on top
    for (const e of this.enemies) if (e.fly) this.drawEnemy(ctx, e, t);
    // hp bars
    for (const e of this.enemies) this.drawHp(ctx, e);
    this.drawFx(ctx, t);
    // ghost tower
    if (this.placing && this.hover) {
      const ok = this.canPlace(this.placing, this.hover.x, this.hover.y) && this.gold >= TOWERS[this.placing].cost;
      ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(this.hover.x, this.hover.y);
      ctx.fillStyle = ok ? 'rgba(120,255,140,0.35)' : 'rgba(255,80,100,0.4)';
      ctx.beginPath(); ctx.ellipse(0, 0, 32, 14, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = ok ? '#7dff9a' : '#ff5d6c'; ctx.stroke();
      ctx.translate(0, -Math.abs(Math.sin(this.realTime * 5)) * 3);
      ctx.scale(TS, TS);
      Art.tower[this.placing](ctx, { level: 1, branch: null, angle: -0.4, x: 0, id: 0 }, t);
      ctx.restore();
    }
    // ambient
    this.drawAmbient(ctx);
    ctx.restore();
    if (this.leakFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      g.addColorStop(0, 'rgba(255,60,90,0)'); g.addColorStop(1, `rgba(255,60,90,${0.45 * this.leakFlash})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  drawRange(ctx, x, y, r, ok, preview) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y - 8, r, r, 0, 0, TAU);
    if (preview) { ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(140,255,120,0.95)'; ctx.stroke(); ctx.restore(); return; }
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.16)' : 'rgba(255,80,100,0.14)'; ctx.fill();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.realTime * 20;
    ctx.lineWidth = 3; ctx.strokeStyle = ok ? 'rgba(255,255,255,0.85)' : 'rgba(255,90,110,0.85)'; ctx.stroke();
    ctx.restore();
  }

  drawTower(ctx, tw, t) {
    ctx.save();
    ctx.translate(tw.x, tw.y);
    let sx = 1, sy = 1;
    if (tw.born < 0.4) { const u = Ease.outBack(Math.min(1, tw.born / 0.4)); sx = sy = Math.max(0.01, u); }
    if (tw.upT < 0.45) { const u = tw.upT / 0.45; const k = Math.sin(u * Math.PI * 2.5) * (1 - u) * 0.18; sx *= 1 + k; sy *= 1 - k; }
    if (this.selected === tw) { const k = Math.sin(this.realTime * 6) * 0.025; sx *= 1 + k; sy *= 1 - k; }
    ctx.scale(sx * TS, sy * TS);
    Art.tower[tw.type](ctx, tw, t, true);
    ctx.restore();
  }

  drawEnemy(ctx, e, t) {
    const st = e.flash > 0 ? 2 : e.slowT > 0 ? 1 : 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.fly) ctx.translate(0, -32 + Math.sin(e.ph * 0.8) * 4);
    let sx = 1, sy = 1;
    if (e.hitT > 0) { const k = e.hitT / 0.12; sx = 1 + 0.14 * k; sy = 1 - 0.12 * k; }
    if (e.born < 0.25 && e.hop !== undefined) { const u = Ease.outBack(e.born / 0.25); sx *= u; sy *= u; }
    ctx.scale(e.face * sx * ES, sy * ES);
    const blink = st === 0 && ((t + e.id * 0.37) % 3.3) < 0.12;
    const F = ENEMY_FRAMES[e.type] || 16;
    const fr = st === 2 ? 0 : Math.floor((((e.ph % TAU) + TAU) % TAU) / TAU * F) % F;
    Sprites.draw(ctx, Art.enemySprite(e.type, st, fr, blink));
    ctx.restore();
    if (e.stunT > 0) {
      const top = e.fly ? e.y - 54 : e.y - e.r * 2.1 * ES - 8;
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * TAU / 3;
        ctx.fillStyle = '#ffe14d'; Art.star(ctx, e.x + Math.cos(a) * e.r * 0.8, top + Math.sin(a) * 4, 5, 2.2); ctx.fill();
        ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
      }
    }
  }

  drawHp(ctx, e) {
    if (e.hp >= e.maxHp || e.def.boss) return;
    const w = clamp(e.r * 2, 22, 56), h = 6;
    const x = e.x - w / 2, y = (e.fly ? e.y - 32 - e.r - 18 : e.y - e.r * 2.1 * ES - (e.type === 'shell' ? 10 : 6)) - 6;
    const u = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
    ctx.fillStyle = u > 0.5 ? '#7be35a' : u > 0.25 ? '#ffd23f' : '#ff5d6c';
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(2, w * u), h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 1, y + 1, Math.max(0, w * u - 2), 2);
  }

  drawProj(ctx, p, t) {
    if (p.k === 'acorn') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); Sprites.draw(ctx, Sprites.get('acorn', [-10, -7, 9, 7], (c) => Art.acorn(c, 0, 0, 0, 1))); ctx.restore();
    } else if (p.k === 'shard') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0); Sprites.draw(ctx, Sprites.get(p.big ? 'shardB' : 'shard', [-24, -24, 24, 24], (c) => Art.shard(c, 0, 0, 0, p.big ? 1.6 : 1))); ctx.restore();
    } else if (p.k === 'spore' || p.k === 'bomblet') {
      const u = Math.min(1, p.t / p.T);
      const gx = lerp(p.x0, p.x1, u), gy = lerp(p.y0 + 60 * (p.k === 'spore' ? 1 : 0), p.y1, u);
      Art.shadow(ctx, gx, gy, p.r * 1.2, p.r * 0.5, 0.2);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t * 8); Sprites.draw(ctx, Sprites.get('spore' + p.col[0] + p.r, [-p.r - 3, -p.r - 3, p.r + 3, p.r + 3], (c) => Art.spore(c, 0, 0, p.r, 0, p.col[0], p.col[1]))); ctx.restore();
    }
  }

  drawFx(ctx, t) {
    for (const f of this.fx) {
      const u = f.life / f.max;
      switch (f.k) {
        case 'kab': {
          const k = 1 - u;
          const rr = f.r * (0.45 + 0.75 * Ease.outCubic(Math.min(1, k * 2.2))) * (k > 0.65 ? 1 - (k - 0.65) * 0.9 : 1);
          let c0, c1;
          if (k < 0.08) { c0 = '#ffffff'; c1 = '#fff3b0'; }
          else if (k < 0.32) { c0 = f.el ? '#fffbe0' : '#ffe14d'; c1 = f.el ? '#ffe14d' : '#ff9f2e'; }
          else if (k < 0.62) { c0 = f.el ? '#ffe14d' : '#ff8a3d'; c1 = f.el ? '#f2b01e' : '#d9482a'; }
          else { c0 = '#9d8ca6'; c1 = '#6e5c7a'; }
          ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
          Art.cel(ctx, () => { ctx.beginPath(); ctx.arc(f.x, f.y - k * 14, rr, 0, TAU); }, c0, c1, -rr * 0.2, -rr * 0.25, 2.4);
          ctx.globalAlpha = 1;
          break;
        }
        case 'pow':
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, u * 2);
          const pr = f.r * (1.3 - u * 0.5);
          Art.star(ctx, 0, 0, pr, pr * 0.5, 8); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
          ctx.restore();
          break;
        case 'drop':
          ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * u), 0, TAU); ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
          break;
        case 'star':
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.col;
          Art.star(ctx, 0, 0, f.r * (0.5 + 0.5 * u), f.r * 0.45 * (0.5 + 0.5 * u)); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
          ctx.restore();
          break;
        case 'ice':
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = '#d9f8ff'; ctx.strokeStyle = '#4fb1e0'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(f.r * 0.5, 0); ctx.lineTo(0, f.r); ctx.lineTo(-f.r * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
          break;
        case 'ring': {
          const k = Ease.outCubic(1 - u);
          const r = lerp(f.r0, f.r1, k);
          ctx.beginPath(); ctx.ellipse(f.x, f.y, r, f.flat ? r * 0.5 : r, 0, 0, TAU);
          if (f.fill) { ctx.fillStyle = f.fill; ctx.fill(); }
          ctx.globalAlpha = u; ctx.lineWidth = f.lw * u + 1; ctx.strokeStyle = f.col; ctx.stroke(); ctx.globalAlpha = 1;
          break;
        }
        case 'puff':
          ctx.globalAlpha = Math.min(1, u * 1.5) * 0.9;
          ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1.6 - u * 0.6), 0, TAU); ctx.fill();
          ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(43,29,58,0.45)'; ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        case 'text': {
          const k = 1 - u;
          const s = k < 0.15 ? Ease.outBack(k / 0.15) : 1;
          ctx.save(); ctx.translate(f.x, f.y); ctx.scale(s, s);
          ctx.globalAlpha = Math.min(1, u * 3);
          ctx.font = `800 ${f.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(f.text, 0, 0);
          ctx.fillStyle = f.col; ctx.fillText(f.text, 0, 0);
          ctx.restore();
          break;
        }
        case 'plus':
          ctx.globalAlpha = u; ctx.font = `800 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeText('+', f.x, f.y); ctx.fillStyle = '#7cf0a8'; ctx.fillText('+', f.x, f.y);
          ctx.globalAlpha = 1;
          break;
        case 'coin':
          if (f.t > 0) { Art.ball(ctx, f.x, f.y, 7, '#ffd84a', '#e09a1a', 2, 0.6); }
          break;
        case 'snow':
          ctx.globalAlpha = u; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
          break;
        case 'warn':
          ctx.globalAlpha = 0.6 * (1 - u) + 0.2; ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + 0.5 * (1 - u)), f.r * 0.5 * (0.5 + 0.5 * (1 - u)), 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
          break;
      }
    }
    // additive pass
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fx) {
      const u = f.life / f.max;
      if (f.k === 'spark') {
        ctx.strokeStyle = f.col; ctx.lineWidth = 2.5 * u + 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04); ctx.stroke();
      } else if (f.k === 'flash') {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(${f.col},${0.9 * u})`); g.addColorStop(1, `rgba(${f.col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      } else if (f.k === 'glint') {
        ctx.fillStyle = `rgba(170,235,255,${0.8 * u})`; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * u + 0.5, 0, TAU); ctx.fill();
      } else if (f.k === 'bolt') {
        const jit = Math.random() < 0.5;
        for (const [w, c] of [[f.w * 4, `rgba(255,220,80,${0.35 * u})`], [f.w * 1.8, `rgba(255,245,170,${0.9 * u})`], [f.w * 0.7, `rgba(255,255,255,${u})`]]) {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.beginPath();
          f.pts.forEach((q, i) => { const jx = jit && i && i < f.pts.length - 1 ? rand(-2, 2) : 0; i ? ctx.lineTo(q[0] + jx, q[1] + jx) : ctx.moveTo(q[0], q[1]); });
          ctx.stroke();
        }
      } else if (f.k === 'tracer') {
        ctx.strokeStyle = `rgba(255,240,180,${u})`; ctx.lineWidth = 5 * u + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${u})`; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.moveTo(f.x0, f.y0); ctx.lineTo(f.x1, f.y1); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawAmbient(ctx) {
    const th = this.scenery.theme.ambient;
    ctx.fillStyle = 'rgba(30,20,60,0.07)';
    for (const c of this.cloudShadows) { ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 1.6, c.r * 0.7, 0, 0, TAU); ctx.ellipse(c.x + c.r * 0.9, c.y - c.r * 0.2, c.r, c.r * 0.55, 0, 0, TAU); ctx.fill(); }
    for (const a of this.ambient) {
      if (th === 'butterfly') {
        const f = Math.abs(Math.sin(a.ph * 4));
        ctx.save(); ctx.translate(a.x, a.y);
        ctx.fillStyle = a.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 3.5 * f, 0, 3.5 * f + 0.5, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      } else if (th === 'leaf') {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ph); ctx.scale(1, Math.sin(a.ph * 0.7));
        ctx.fillStyle = a.col; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
      }
    }
  }
}
