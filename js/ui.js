'use strict';
// ---------------------------------------------------------------------------
// DOM user interface: HUD, shop, tower panel, banners, screens.
// ---------------------------------------------------------------------------
const S = 'stroke="#2b1d3a" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"';
const ICONS = {
  heart: `<svg viewBox="0 0 32 32"><path d="M16 28C6 21 3 15.5 3 11a6.5 6.5 0 0 1 13-1 6.5 6.5 0 0 1 13 1c0 4.5-3 10-13 17z" fill="#ff5d6c" ${S}/><path d="M7.5 9.5a3 3 0 0 1 4-2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`,
  coin: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.5" fill="#ffd84a" ${S}/><circle cx="16" cy="16" r="8" fill="#f5b82a" stroke="#d89412" stroke-width="2"/><path d="M16 10.5c3 2 3 9 0 11-3-2-3-9 0-11z" fill="#ffe680"/><path d="M8.5 11a8.5 8.5 0 0 1 4-4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".85"/></svg>`,
  fast: `<svg viewBox="0 0 32 32"><path d="M4 8l11 8-11 8z" fill="#5cbcf2" ${S}/><path d="M16 8l11 8-11 8z" fill="#5cbcf2" ${S}/></svg>`,
  pause: `<svg viewBox="0 0 32 32"><rect x="7" y="6" width="7" height="20" rx="2.5" fill="#fff" ${S}/><rect x="18" y="6" width="7" height="20" rx="2.5" fill="#fff" ${S}/></svg>`,
  sound: `<svg viewBox="0 0 32 32"><path d="M5 12h5l7-6v20l-7-6H5z" fill="#ffd84a" ${S}/><path d="M21 11a6 6 0 0 1 0 10M24 7.5a11 11 0 0 1 0 17" fill="none" ${S}/></svg>`,
  music: `<svg viewBox="0 0 32 32"><path d="M12 23V7l14-3v16" fill="none" ${S}/><ellipse cx="8.5" cy="23.5" rx="4.5" ry="3.6" fill="#ff8fb5" ${S}/><ellipse cx="22.5" cy="20.5" rx="4.5" ry="3.6" fill="#ff8fb5" ${S}/></svg>`,
  full: `<svg viewBox="0 0 32 32"><path d="M5 12V5h7M27 12V5h-7M5 20v7h7M27 20v7h-7" fill="none" ${S} stroke-width="3.2"/></svg>`,
  back: `<svg viewBox="0 0 32 32"><path d="M19 6L8 16l11 10" fill="none" ${S} stroke-width="4"/></svg>`,
  star: `<svg viewBox="0 0 32 32"><path d="M16 2.8l4 8.6 9.3 1.1-6.9 6.4 1.9 9.3L16 23.5l-8.3 4.7 1.9-9.3-6.9-6.4 9.3-1.1z" fill="#ffd84a" ${S}/><path d="M11.5 12.5l2-.3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`,
  starOff: `<svg viewBox="0 0 32 32"><path d="M16 2.8l4 8.6 9.3 1.1-6.9 6.4 1.9 9.3L16 23.5l-8.3 4.7 1.9-9.3-6.9-6.4 9.3-1.1z" fill="#d9cfe3" ${S}/></svg>`,
  lock: `<svg viewBox="0 0 32 32"><path d="M10 14v-4a6 6 0 0 1 12 0v4" fill="none" ${S} stroke-width="3.4"/><rect x="6" y="13" width="20" height="15" rx="4" fill="#ffd84a" ${S}/><circle cx="16" cy="20" r="2.4" fill="#2b1d3a"/></svg>`,
  sell: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12.5" fill="#ffd84a" ${S}/><path d="M11 16h10" ${S} stroke-width="3.4"/></svg>`,
};
function icon(name) { return `<span class="ico">${ICONS[name]}</span>`; }

const $ = (id) => document.getElementById(id);

const UI = {
  game: null,
  handlers: {},
  last: {},
  hintStep: 0,

  init(handlers) {
    this.handlers = handlers;
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
    this.buildShop();
    this.buildLogo();
    const face = Art.enemyIcon('gloomlet', 64);
    $('waveFace').appendChild(face);
    $('intro').addEventListener('click', () => $('intro').classList.add('hidden'));
  },

  // ------------------------------------------------------------------ shop
  buildShop() {
    const shop = $('shop');
    shop.innerHTML = '';
    for (const type of TOWER_ORDER) {
      const def = TOWERS[type];
      const card = document.createElement('div');
      card.className = 'card'; card.dataset.type = type;
      card.appendChild(Art.towerIcon(type, 80));
      card.insertAdjacentHTML('beforeend', `<span class="key">${def.key}</span><span class="cost">${icon('coin')}${def.cost}</span>`);
      card.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.hideTip(); this.handlers.shopDown(type, e); });
      card.addEventListener('pointerenter', () => this.showTip(type, card));
      card.addEventListener('pointerleave', () => this.hideTip());
      shop.appendChild(card);
    }
  },
  shakeCard(type) {
    const c = document.querySelector(`.card[data-type="${type}"]`);
    if (!c) return;
    c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  },
  showTip(type, card) {
    const def = TOWERS[type], l = def.levels[0];
    const tags = [];
    if (def.kind !== 'farm') {
      tags.push(def.dtype === 'phys' ? '<span class="tag">物理攻撃</span>' : '<span class="tag">魔法攻撃</span>');
      tags.push(def.air ? '<span class="tag good">空の敵OK</span>' : '<span class="tag bad">空の敵NG</span>');
      if (l.splash) tags.push('<span class="tag">範囲攻撃</span>');
      if (l.slow) tags.push('<span class="tag">スロウ</span>');
      if (l.chains) tags.push('<span class="tag">連鎖</span>');
    } else tags.push('<span class="tag good">収入</span>');
    const tip = $('tooltip');
    tip.innerHTML = `<h3>${def.name}</h3><p>${def.blurb}</p><div class="tags">${tags.join('')}</div>`;
    tip.classList.remove('hidden');
    const r = this.stageRect(card);
    tip.style.left = clamp(r.x + r.w / 2 - 135, 8, W - 278) + 'px';
    tip.style.top = (r.y - tip.offsetHeight - 22) + 'px';
  },
  hideTip() { $('tooltip').classList.add('hidden'); },
  stageRect(el) {
    const s = this.handlers.scale(), sr = $('stage').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  },

  // ------------------------------------------------------------------ hud
  bindGame(game) {
    this.game = game;
    this.last = {};
    this.closePanel();
    $('bossbar').classList.add('hidden');
    $('intro').classList.add('hidden');
    $('banner').className = '';
    this.hintStep = game.levelIdx === 0 && !Store.get('pw-tutorial', false) ? 1 : 0;
    // register UI rectangles that block tower placement
    requestAnimationFrame(() => {
      game.uiBlocks = ['shop', 'btnWave'].map((id) => this.stageRect($(id)));
      game.uiBlocks.push({ x: 0, y: 0, w: 470, h: 92 }, { x: W - 160, y: 0, w: 160, h: 92 });
    });
  },

  bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 160); },

  update(g) {
    const L = this.last;
    if (L.gold !== g.gold) { if (L.gold !== undefined && g.gold > L.gold) this.bump('gold'); $('gold').textContent = g.gold; L.gold = g.gold; this.refreshAffordability(g); }
    if (L.lives !== g.lives) {
      if (L.lives !== undefined && g.lives < L.lives) { const p = $('pLives'); p.classList.remove('hurt'); void p.offsetWidth; p.classList.add('hurt'); }
      $('lives').textContent = g.lives; L.lives = g.lives;
    }
    const wv = `${g.waveIdx}/${g.totalWaves}`;
    if (L.wave !== wv) { $('wave').textContent = wv; L.wave = wv; }
    // wave button
    const can = g.canCallWave();
    const btn = $('btnWave');
    const st = can ? (g.waveIdx === 0 ? 'first' : 'next') : 'off';
    if (L.wst !== st) {
      btn.classList.toggle('off', st === 'off');
      btn.classList.toggle('ready', st === 'first');
      $('waveLbl').textContent = st === 'first' ? 'ウェーブ開始' : 'つぎのウェーブ';
      L.wst = st;
    }
    if (can) {
      const total = 20, left = g.nextWaveTimer > 0 ? g.nextWaveTimer : (g.waveIdx === 0 ? total : 0);
      const off = 276.5 * (left / total);
      const k = Math.round(off);
      if (L.ring !== k) { $('waveRing').style.strokeDashoffset = 276.5 - off; L.ring = k; }
      const b = g.earlyBonus();
      const bt = b > 0 ? `はやよび +${b}` : '';
      if (L.bonus !== bt) { $('waveBonus').textContent = bt; L.bonus = bt; }
    }
    // boss bar
    if (g.boss) {
      const pct = Math.max(0, g.boss.hp / g.boss.maxHp) * 100;
      const k = Math.round(pct * 2);
      if (L.boss !== k) { $('bossFill').style.width = pct + '%'; L.boss = k; }
    }
    // panel live state
    if (this.panelTw) {
      if (!g.towers.includes(this.panelTw)) this.closePanel();
      else this.refreshPanelButtons();
    }
    this.updateHint(g);
  },

  refreshAffordability(g) {
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('poor', g.gold < TOWERS[c.dataset.type].cost));
    if (this.panelTw) this.refreshPanelButtons();
  },

  setPlacing(type) {
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('sel', c.dataset.type === type));
  },

  banner(t, s, boss) {
    const b = $('banner');
    $('bannerT').textContent = t; $('bannerS').textContent = s;
    b.className = ''; void b.offsetWidth; b.className = 'show' + (boss ? ' boss' : '');
  },

  intro(type) {
    const d = ENEMIES[type];
    const el = $('intro');
    el.innerHTML = `<span class="new">NEW!</span><div class="ic"></div><div><h4>${d.name}</h4><p>${d.desc}</p></div>`;
    el.querySelector('.ic').appendChild(Art.enemyIcon(type, 72));
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this.introT);
    this.introT = setTimeout(() => el.classList.add('hidden'), 7000);
  },

  boss(e) {
    $('bossbar').classList.toggle('hidden', !e);
    this.last.boss = -1;
  },

  updateHint(g) {
    const h = $('hint');
    if (!this.hintStep || g.demo) { h.classList.add('hidden'); return; }
    let text = '', x = 0, y = 0, ax = '50%';
    if (this.hintStep === 1) {
      if (g.towers.length > 0) this.hintStep = 2;
      else if (g.placing) { text = '道のそばをクリックして配置！'; x = 470; y = 520; }
      else { text = 'タワーをえらんで 道のそばに置こう！'; x = 470; y = 548; }
    }
    if (this.hintStep === 2) {
      if (g.waveIdx > 0) { this.hintStep = 3; this.hintT = g.time; }
      else { text = 'じゅんびができたら ウェーブ開始！'; x = 900; y = 556; ax = '86%'; }
    }
    if (this.hintStep === 3) {
      if (g.waveIdx >= 2 && g.time - this.hintT > 2) {
        if (g.towers.some((t) => t.level > 1) || g.time - this.hintT > 40) { this.hintStep = 0; Store.set('pw-tutorial', true); }
        else if (g.towers[0]) { const t = g.towers[0]; text = 'タワーをクリックすると強化できるよ'; x = clamp(t.x - 140, 10, W - 300); y = t.y - 130; ax = clamp(t.x - x, 20, 260) + 'px'; }
      }
    }
    if (!text) { h.classList.add('hidden'); return; }
    if (h.textContent !== text) h.textContent = text;
    h.style.left = x + 'px'; h.style.top = y + 'px'; h.style.setProperty('--ax', ax);
    h.classList.remove('hidden');
  },

  // ------------------------------------------------------------------ tower panel
  openPanel(tw) {
    this.panelTw = tw;
    this.renderPanel();
  },
  closePanel() {
    this.panelTw = null;
    $('towerPanel').classList.add('hidden');
    if (this.game) this.game.previewRange = 0;
  },

  statRows(tw, next) {
    const st = tw.st, rows = [];
    const fmt = (k, v, nv, unit = '') => {
      const up = nv !== undefined && nv !== v ? ` <span class="up">→ ${nv}${unit}</span>` : '';
      return `<dt>${k}</dt><dd>${v}${unit}${up}</dd>`;
    };
    const n = next || {};
    if (tw.type === 'farm') {
      rows.push(fmt('収入', st.income, n.income, ' / ウェーブ'));
      rows.push(fmt('これまで', tw.earned || 0, undefined, ' G'));
    } else {
      const dmgLbl = TOWERS[tw.type].dtype === 'phys' ? '攻撃力 (物理)' : '攻撃力 (魔法)';
      rows.push(fmt(dmgLbl, Math.round(st.dmg), n.dmg !== undefined ? Math.round(n.dmg) : undefined));
      rows.push(fmt('攻撃速度', st.rate.toFixed(1), n.rate !== undefined ? n.rate.toFixed(1) : undefined, ' 回/秒'));
      rows.push(fmt('射程', st.range, n.range));
      if (st.splash || n.splash) rows.push(fmt('爆発範囲', st.splash || 0, n.splash));
      if (st.chains) rows.push(fmt('連鎖', st.chains, n.chains, ' 体'));
      if (st.slow) rows.push(fmt('スロウ', Math.round(st.slow * 100), n.slow !== undefined ? Math.round(n.slow * 100) : undefined, '%'));
      const sp = [];
      if (st.pierce) sp.push('装甲無視');
      if (st.stun) sp.push('しびれ');
      if (st.pulse) sp.push('全体凍結');
      if (st.shatter) sp.push('凍結2倍');
      if (st.cluster) sp.push(`子爆弾×${st.cluster}`);
      if (sp.length) rows.push(`<dt>特殊</dt><dd>${sp.join('・')}</dd>`);
      rows.push(`<dt>撃破数</dt><dd>${tw.kills}</dd>`);
    }
    return rows.join('');
  },

  renderPanel() {
    const tw = this.panelTw, g = this.game;
    if (!tw) return;
    const def = TOWERS[tw.type];
    const p = $('towerPanel');
    const title = tw.branch ? def.branches[tw.branch].title : def.name;
    const pips = [1, 2, 3, 4].slice(0, def.branches ? 4 : 3).map((i) => `<i class="${tw.level >= i ? 'on' : ''}"></i>`).join('');
    let html = `<div class="tp-head"><div class="ic"></div><div><div class="tp-name">${title}</div><div class="tp-lv">Lv ${pips}</div></div><button class="tp-close" data-act="close">✕</button></div>`;
    html += `<dl class="tp-stats" id="tpStats">${this.statRows(tw)}</dl>`;
    if (tw.type !== 'farm') {
      html += `<div class="tp-target-lbl">ねらう敵</div><div class="tp-target">${TARGET_MODES.map((m) => `<button data-act="target" data-mode="${m}" class="${tw.target === m ? 'on' : ''}">${TARGET_NAMES[m]}</button>`).join('')}</div>`;
    }
    if (tw.level < 3) {
      const u = def.levels[tw.level];
      html += `<button class="btn green tp-up" data-act="up"><span class="t"><span>${u.title}</span><span class="c">${icon('coin')}${u.cost}</span></span><span class="d">${u.desc}</span></button>`;
    } else if (!tw.branch && def.branches) {
      html += `<div class="tp-branches">` + ['A', 'B'].map((k) => {
        const b = def.branches[k];
        return `<button class="btn ${k === 'A' ? 'red' : 'blue'} tp-branch" data-act="branch" data-b="${k}"><span class="bi" data-b="${k}"></span><span class="t">${b.title}</span><span class="d">${b.desc}</span><span class="c">${icon('coin')}${b.cost}</span></button>`;
      }).join('') + `</div>`;
    } else {
      html += `<div class="tp-max">★ 最大レベル ★</div>`;
    }
    html += `<button class="btn red tp-sell" data-act="sell">${icon('sell')}売却 <span style="color:#ffd84a">+${g.sellValue(tw)}</span></button>`;
    p.innerHTML = html;
    p.querySelector('.ic').appendChild(Art.towerIcon(tw.type, 64, tw.level, tw.branch));
    p.querySelectorAll('.bi').forEach((el) => el.replaceWith(Art.towerIcon(tw.type, 64, 4, el.dataset.b)));
    p.classList.remove('hidden');
    p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
    // position next to the tower
    const ph = p.offsetHeight;
    let x = tw.x < W / 2 ? tw.x + 46 : tw.x - 46 - 300;
    let y = clamp(tw.y - ph / 2 - 20, 66, H - ph - 120);
    if (y + ph > H - 116 && x > 330 && x < 950) y = Math.max(66, H - 116 - ph);
    p.style.left = x + 'px'; p.style.top = y + 'px';
    // events
    p.onpointerdown = (e) => e.stopPropagation();
    p.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const a = b.dataset.act;
        if (a === 'close') { Sound.play('click'); this.handlers.deselect(); }
        else if (a === 'target') { tw.target = b.dataset.mode; Sound.play('click'); this.renderPanel(); }
        else if (a === 'up' || a === 'branch') {
          if (g.upgrade(tw, b.dataset.b)) { g.previewRange = 0; this.renderPanel(); }
          else Sound.play('error');
        } else if (a === 'sell') { g.sell(tw); this.closePanel(); }
      });
      if (b.dataset.act === 'up' || b.dataset.act === 'branch') {
        b.addEventListener('pointerenter', () => {
          const nx = tw.level < 3 ? g.stats(tw.type, tw.level + 1, null) : g.stats(tw.type, 4, b.dataset.b);
          $('tpStats').innerHTML = this.statRows(tw, nx);
          g.previewRange = nx.range || 0;
        });
        b.addEventListener('pointerleave', () => { $('tpStats').innerHTML = this.statRows(tw); g.previewRange = 0; });
      }
    });
    this.refreshPanelButtons();
  },

  refreshPanelButtons() {
    const tw = this.panelTw, g = this.game;
    const p = $('towerPanel');
    p.querySelectorAll('[data-act="up"],[data-act="branch"]').forEach((b) => {
      const c = g.upgradeCost(tw, b.dataset.b);
      b.classList.toggle('disabled', c == null || g.gold < c);
    });
  },

  // ------------------------------------------------------------------ title / levels / result
  buildLogo() {
    $('logo').innerHTML = `<svg viewBox="0 0 760 300">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff59a"/><stop offset=".55" stop-color="#ffd84a"/><stop offset="1" stop-color="#ff9f2e"/></linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4f59a"/><stop offset=".55" stop-color="#7ddb5a"/><stop offset="1" stop-color="#3fae4a"/></linearGradient>
      </defs>
      <g transform="translate(118 70) rotate(-24)"><path d="M0 0c-26-20-24-52 0-66 24 14 26 46 0 66z" fill="#7ddb5a" stroke="#2b1d3a" stroke-width="5" stroke-linejoin="round"/><path d="M0 -6v-50" stroke="#3f9a3a" stroke-width="4" stroke-linecap="round"/></g>
      <g transform="translate(650 64) rotate(28)"><path d="M0 0c-22-18-20-46 0-58 20 12 22 40 0 58z" fill="#ffb02e" stroke="#2b1d3a" stroke-width="5" stroke-linejoin="round"/><path d="M0 -6v-44" stroke="#d9750a" stroke-width="4" stroke-linecap="round"/></g>
      <g font-family="M PLUS Rounded 1c, sans-serif" font-weight="800" text-anchor="middle" stroke-linejoin="round">
        <text x="380" y="158" font-size="138" letter-spacing="4" fill="#2b1d3a" stroke="#2b1d3a" stroke-width="26">ふわもり</text>
        <text x="380" y="148" font-size="138" letter-spacing="4" fill="url(#lg1)" stroke="#2b1d3a" stroke-width="22" paint-order="stroke">ふわもり</text>
        <text x="380" y="252" font-size="84" letter-spacing="6" fill="#2b1d3a" stroke="#2b1d3a" stroke-width="22">ディフェンス</text>
        <text x="380" y="244" font-size="84" letter-spacing="6" fill="url(#lg2)" stroke="#2b1d3a" stroke-width="18" paint-order="stroke">ディフェンス</text>
      </g>
      <g transform="translate(380 284)">
        <rect x="-128" y="-17" width="256" height="34" rx="17" fill="#2b1d3a"/>
        <text x="0" y="7" font-family="M PLUS Rounded 1c, sans-serif" font-weight="800" font-size="19" letter-spacing="5" fill="#fff" text-anchor="middle">PUFFWOOD DEFENSE</text>
      </g>
    </svg>`;
  },

  levelThumb(i) {
    const L = LEVELS[i];
    const c = document.createElement('canvas');
    c.width = 672; c.height = 378;
    const ctx = c.getContext('2d');
    ctx.scale(672 / W, 378 / H);
    const paths = L.paths.map((p) => new Path(p));
    const sc = buildScenery(L, paths);
    Art.renderBackground(ctx, L, paths, sc);
    Art.home(ctx, L.home[0], L.home[1], 0.5, 0);
    return c;
  },

  buildLevels(progress) {
    const wrap = $('levelCards');
    wrap.innerHTML = '';
    if (!this.thumbs) this.thumbs = LEVELS.map((_, i) => this.levelThumb(i));
    LEVELS.forEach((L, i) => {
      const unlocked = i === 0 || (progress[i - 1] || 0) > 0;
      const stars = progress[i] || 0;
      const card = document.createElement('div');
      card.className = 'lcard' + (unlocked ? '' : ' locked');
      card.innerHTML = `<div class="thumb"><span class="num">${i + 1}</span>${unlocked ? '' : `<div class="lock">${icon('lock')}<div>前のステージをクリア</div></div>`}</div>
        <h3>${L.name}</h3><div class="sub">${L.sub}</div>
        <div class="lstars">${[1, 2, 3].map((k) => icon(stars >= k ? 'star' : 'starOff')).join('')}</div>
        <div class="meta">ウェーブ ${L.waves.length} ／ 初期ゴールド ${L.gold}</div>
        <button class="btn green">${unlocked ? 'あそぶ' : 'ロック中'}</button>`;
      card.querySelector('.thumb').prepend(this.thumbs[i]);
      const b = card.querySelector('.btn');
      if (!unlocked) b.classList.add('disabled');
      b.addEventListener('click', () => { if (unlocked) this.handlers.startLevel(i); else Sound.play('error'); });
      wrap.appendChild(card);
    });
  },

  showResult(won, stars, g) {
    $('resTitle').textContent = won ? 'ステージクリア！' : 'まけちゃった…';
    const st = $('resStars');
    st.innerHTML = won ? [1, 2, 3].map(() => '<span class="ico"></span>').join('') : '';
    st.style.height = won ? '' : '10px';
    if (won) {
      [...st.children].forEach((el, i) => {
        el.innerHTML = ICONS[i < stars ? 'star' : 'starOff'];
        setTimeout(() => { el.classList.add('in'); if (i < stars) Sound.play('star', 1 + i * 0.25); }, 350 + i * 330);
      });
    }
    $('resStats').innerHTML = `<div><small>たおした敵</small>${g.record.kills}</div><div><small>のこりライフ</small>${g.lives} / ${g.maxLives}</div><div><small>ウェーブ</small>${g.waveIdx} / ${g.totalWaves}</div>`;
    const btns = $('resButtons');
    btns.innerHTML = '';
    const add = (cls, text, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = text; b.addEventListener('click', () => { Sound.play('click'); fn(); }); btns.appendChild(b); };
    if (won && g.levelIdx < LEVELS.length - 1) add('green', 'つぎのステージ', () => this.handlers.startLevel(g.levelIdx + 1));
    add(won ? 'yellow' : 'green', 'もう一度', () => this.handlers.startLevel(g.levelIdx));
    add('cream', 'ステージ選択', () => this.handlers.showLevels());
    if (won && g.levelIdx === LEVELS.length - 1) {
      $('resTitle').textContent = 'ぜんぶクリア！';
    }
    $('result').classList.remove('hidden');
  },
};
