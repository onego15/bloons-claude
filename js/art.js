'use strict';
// ---------------------------------------------------------------------------
// Art: every sprite in the game is painted procedurally with the same rules
// (thick plum outline, two-tone cel shading lit from the top-left, glossy
// highlight, soft plum ground shadow) so the whole game shares one style.
// ---------------------------------------------------------------------------
const INK = '#2b1d3a';

const Art = {};

Art.cel = function (ctx, pathFn, base, dark, ox, oy, lw) {
  ctx.save();
  pathFn();
  ctx.fillStyle = dark; ctx.fill();
  ctx.clip();
  ctx.translate(ox, oy);
  pathFn();
  ctx.fillStyle = base; ctx.fill();
  ctx.restore();
  if (lw) {
    pathFn();
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke();
  }
};

Art.ball = function (ctx, x, y, r, base, dark, lw = 2.5, gloss = 0.55) {
  Art.cel(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }, base, dark, -r * 0.2, -r * 0.24, lw);
  if (gloss) Art.gloss(ctx, x - r * 0.38, y - r * 0.42, r * 0.26, r * 0.15, -0.6, gloss);
};

Art.gloss = function (ctx, x, y, rx, ry, rot, a = 0.55) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill();
};

Art.shadow = function (ctx, x, y, rx, ry, a = 0.22) {
  ctx.fillStyle = `rgba(43,29,58,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
};

Art.ellipse = function (ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); };

// gumdrop silhouette, bottom centre at (0,0)
Art.gumdrop = function (ctx, w, h, lean = 0) {
  ctx.beginPath();
  ctx.moveTo(lean, -h);
  ctx.bezierCurveTo(lean + w * 0.85, -h, w, -h * 0.62, w, -h * 0.3);
  ctx.bezierCurveTo(w, -h * 0.02, w * 0.65, 0, 0, 0);
  ctx.bezierCurveTo(-w * 0.65, 0, -w, -h * 0.02, -w, -h * 0.3);
  ctx.bezierCurveTo(-w, -h * 0.62, lean - w * 0.85, -h, lean, -h);
  ctx.closePath();
};

Art.eyes = function (ctx, x, y, s, gap, blink, angry, look = 0.25) {
  for (const sx of [-1, 1]) {
    const ex = x + sx * gap;
    ctx.beginPath(); ctx.ellipse(ex, y, s * 0.8, s * (blink ? 0.14 : 1), 0, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = Math.max(1.4, s * 0.32); ctx.strokeStyle = INK; ctx.stroke();
    if (!blink) {
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex + s * look, y + s * 0.12, s * 0.48, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + s * (look + 0.14), y - s * 0.12, s * 0.17, 0, TAU); ctx.fill();
    }
  }
  if (angry) {
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * 0.45); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - gap - s * 0.8, y - s * 1.35); ctx.lineTo(x - gap + s * 0.7, y - s * 0.85);
    ctx.moveTo(x + gap + s * 0.8, y - s * 1.35); ctx.lineTo(x + gap - s * 0.7, y - s * 0.85);
    ctx.stroke();
  }
};

Art.star = function (ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
};

// ---------------------------------------------------------------------------
// Enemy palettes (normal / frozen / hit-flash variants are cached)
// ---------------------------------------------------------------------------
const ENEMY_PAL = {
  gloomlet: { a: '#9468dc', b: '#6342ad', c: '#ffb3d1' },
  zipper: { a: '#ff69a8', b: '#cc3b7d', c: '#ffd1e4' },
  shell: { a: '#58a0e0', b: '#3767a8', c: '#c4bcb0', d: '#8d837a' },
  bubble: { a: '#c9b3ff', b: '#9b7fe6', c: '#9468dc', d: '#6342ad' },
  moth: { a: '#6a46a6', b: '#432870', c: '#ffa152', d: '#e0663a', e: '#ffe58a' },
  wisp: { a: '#a8f4ff', b: '#4fc4e8', c: '#effdff' },
  mender: { a: '#62d69c', b: '#35a06f', c: '#a9ec6c', d: '#ff8fb5' },
  brute: { a: '#7444bb', b: '#4b2783', c: '#f6e7c8', d: '#cdb894' },
  king: { a: '#8247d1', b: '#542597', c: '#ffd23f', d: '#e09a1a', e: '#e4414f', f: '#a8253a' },
};
const _palCache = new Map();
function enemyPal(type, state) {
  const key = type + state;
  let p = _palCache.get(key);
  if (p) return p;
  const src = ENEMY_PAL[type];
  p = {};
  for (const k in src) {
    if (state === 1) p[k] = mix(src[k], '#bdefff', 0.5);
    else if (state === 2) p[k] = mix(src[k], '#ffffff', 0.82);
    else p[k] = src[k];
  }
  _palCache.set(key, p);
  return p;
}

Art.enemy = {};
const ENEMY_FRAMES = { moth: 32 };
Art.enemySprite = function (type, st, fr, blink) {
  const r = ENEMIES[type].r;
  const hw = r * 2.6 + 12, top = r * 3.3 + 16;
  const F = ENEMY_FRAMES[type] || 16;
  const b = ENEMIES[type].fly ? [-hw, -top, hw, top * 0.6] : [-hw, -top, hw, 10];
  return Sprites.get(`e${type}${st}${fr}${blink ? 'b' : ''}`, b, (c) => Art.enemy[type](c, enemyPal(type, st), (fr / F) * TAU, 1, blink));
};

Art.enemy.gloomlet = function (ctx, p, ph, scale = 1, blink = false) {
  const hop = Math.abs(Math.sin(ph));
  const sq = Math.cos(ph * 2) * 0.07;
  const w = 13 * scale, h = 24 * scale;
  // feet
  ctx.fillStyle = p.b;
  for (const s of [-1, 1]) {
    Art.ellipse(ctx, s * 6 * scale + Math.sin(ph) * s * 2, -1, 4.5 * scale, 3 * scale);
    ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -hop * 3 * scale - 2);
  ctx.scale(1 + sq, 1 - sq);
  // tuft
  ctx.beginPath(); ctx.moveTo(-2 * scale, -h + 2); ctx.quadraticCurveTo(-6 * scale, -h - 9 * scale, 3 * scale, -h - 8 * scale);
  ctx.quadraticCurveTo(-1 * scale, -h - 4 * scale, 3 * scale, -h + 2); ctx.closePath();
  ctx.fillStyle = p.b; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  Art.cel(ctx, () => Art.gumdrop(ctx, w, h), p.a, p.b, -3 * scale, -3 * scale, 2.5);
  Art.gloss(ctx, -w * 0.45, -h * 0.72, 3.4 * scale, 2 * scale, -0.6, 0.6);
  // blush + eyes + mouth
  ctx.fillStyle = rgba(p.c, 0.7);
  Art.ellipse(ctx, w * 0.62, -h * 0.36, 3 * scale, 1.8 * scale); ctx.fill();
  Art.eyes(ctx, w * 0.3, -h * 0.56, 3.6 * scale, 4.2 * scale, blink, false);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.34, 2.6 * scale, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
};

Art.enemy.zipper = function (ctx, p, ph, scale = 1, blink = false) {
  const w = 11 * scale, h = 19 * scale;
  const run = Math.sin(ph * 2);
  // speed streaks
  ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = -6 - i * 6, l = 8 + (((ph / TAU) * 12 + i * 2) % 6);
    ctx.beginPath(); ctx.moveTo(-w - 4, y); ctx.lineTo(-w - 4 - l, y); ctx.stroke();
  }
  ctx.fillStyle = p.b;
  for (const s of [-1, 1]) {
    Art.ellipse(ctx, s * 4 + run * s * 4, -1, 3.6, 2.4); ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -2 - Math.abs(run) * 2);
  ctx.rotate(0.22);
  // swept-back teardrop
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 1.9, -h * 0.85);
    ctx.bezierCurveTo(-w * 0.6, -h * 1.15, w, -h * 0.95, w, -h * 0.42);
    ctx.bezierCurveTo(w, -h * 0.05, w * 0.4, 0, -w * 0.2, 0);
    ctx.bezierCurveTo(-w * 0.9, 0, -w, -h * 0.35, -w * 0.7, -h * 0.6);
    ctx.closePath();
  };
  Art.cel(ctx, body, p.a, p.b, -2.5, -2.5, 2.4);
  Art.gloss(ctx, -w * 0.1, -h * 0.78, 3, 1.6, -0.3, 0.6);
  Art.eyes(ctx, w * 0.35, -h * 0.55, 3.0 * scale, 3.4 * scale, blink, true, 0.35);
  ctx.restore();
};

Art.enemy.shell = function (ctx, p, ph, scale = 1, blink = false) {
  const w = 18 * scale, h = 22 * scale;
  const step = Math.sin(ph);
  ctx.fillStyle = p.b;
  for (const s of [-1, 0.4, 1]) {
    Art.ellipse(ctx, s * 10 + step * 2 * (s > 0 ? 1 : -1), -1, 4.8, 3.2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -2 - Math.abs(step) * 1.2);
  Art.cel(ctx, () => Art.gumdrop(ctx, w, h * 0.78), p.a, p.b, -3, -3, 2.6);
  Art.eyes(ctx, w * 0.42, -h * 0.34, 3.3, 3.9, blink, false, 0.4);
  // stone shell dome
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(-w * 1.08, -h * 0.42);
    ctx.bezierCurveTo(-w * 1.1, -h * 1.45, w * 0.95, -h * 1.5, w * 0.82, -h * 0.55);
    ctx.quadraticCurveTo(0, -h * 0.72, -w * 1.08, -h * 0.42);
    ctx.closePath();
  };
  Art.cel(ctx, dome, p.c, p.d, -3, -3, 2.6);
  // plate seams
  ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-w * 0.15, -h * 1.12); ctx.quadraticCurveTo(-w * 0.2, -h * 0.85, -w * 0.12, -h * 0.62);
  ctx.moveTo(-w * 0.85, -h * 0.85); ctx.quadraticCurveTo(-w * 0.2, -h * 0.9, w * 0.55, -h * 1.0);
  ctx.moveTo(w * 0.35, -h * 1.12); ctx.quadraticCurveTo(w * 0.42, -h * 0.85, w * 0.4, -h * 0.62);
  ctx.stroke();
  Art.gloss(ctx, -w * 0.45, -h * 1.05, 4, 2.2, -0.5, 0.5);
  ctx.restore();
};

Art.enemy.bubble = function (ctx, p, ph, scale = 1, blink = false) {
  const r = 18 * scale;
  const wob = Math.sin(ph * 2) * 0.07;
  ctx.save();
  ctx.translate(0, -r - 2 - Math.abs(Math.sin(ph)) * 2);
  ctx.scale(1 + wob, 1 - wob);
  // inner babies
  for (let i = 0; i < 3; i++) {
    const a = ph + i * TAU / 3;
    const bx = Math.cos(a) * r * 0.38, by = Math.sin(a) * r * 0.3 + 3;
    Art.ball(ctx, bx, by, 5.2 * scale, p.c, p.d, 1.6, 0);
    ctx.fillStyle = '#fff'; Art.ellipse(ctx, bx + 1.6, by - 1, 1.3, 1.6); ctx.fill();
  }
  // membrane
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = rgba(p.a, 0.5); ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.arc(r * 0.25, r * 0.3, r * 1.02, 0, TAU); ctx.arc(-r * 0.05, -r * 0.05, r * 0.95, 0, TAU, true);
  ctx.fillStyle = rgba(p.b, 0.55); ctx.fill();
  ctx.restore();
  Art.gloss(ctx, -r * 0.4, -r * 0.45, r * 0.32, r * 0.18, -0.7, 0.75);
  Art.gloss(ctx, r * 0.45, r * 0.38, r * 0.08, r * 0.08, 0, 0.6);
  Art.eyes(ctx, r * 0.3, -r * 0.3, 3.6 * scale, 4.4 * scale, blink, false);
  ctx.restore();
};

Art.enemy.moth = function (ctx, p, ph, scale = 1, blink = false) {
  // drawn at hover height by caller (origin = body centre)
  const flap = Math.sin(ph * 4);
  const wing = (rot, s, col, dark) => {
    ctx.save(); ctx.rotate(rot + flap * 0.38); ctx.scale(1, 0.75 + 0.25 * Math.abs(flap));
    const path = () => {
      ctx.beginPath(); ctx.moveTo(-3, -1);
      ctx.bezierCurveTo(-16 * s, -8 * s, -17 * s, -30 * s, -4 * s, -31 * s);
      ctx.bezierCurveTo(8 * s, -32 * s, 10 * s, -14 * s, 4, -2); ctx.closePath();
    };
    Art.cel(ctx, path, col, dark, 1.5, -2, 2.2);
    ctx.fillStyle = p.e; Art.ellipse(ctx, -3.5 * s, -20 * s, 3.6 * s, 4.4 * s, -0.3); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  };
  wing(-0.65, 0.95, p.d, mix(p.d, INK, 0.25));
  Art.cel(ctx, () => Art.ellipse(ctx, 0, 0, 12 * scale, 9 * scale), p.a, p.b, -2, -2, 2.4);
  ctx.fillStyle = p.b; for (const x of [-7, -3]) { ctx.fillRect(x, -7, 2, 14); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(6, -6); ctx.quadraticCurveTo(10, -16, 16, -15); ctx.moveTo(8, -5); ctx.quadraticCurveTo(15, -12, 19, -8); ctx.stroke();
  ctx.fillStyle = p.e; Art.ellipse(ctx, 16, -15, 2.2, 2.2); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); Art.ellipse(ctx, 19, -8, 2.2, 2.2); ctx.fill(); ctx.stroke();
  Art.eyes(ctx, 5, 0, 3, 3.4, blink, false, 0.4);
  wing(-0.15, 0.85, p.c, p.d);
};

Art.enemy.wisp = function (ctx, p, ph, scale = 1, blink = false) {
  const r = 13 * scale;
  ctx.save();
  ctx.translate(0, -r - 8 + Math.sin(ph) * 3);
  // glow
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.2);
  g.addColorStop(0, rgba(p.a, 0.55)); g.addColorStop(1, rgba(p.a, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill();
  const tail = Math.sin(ph * 3) * 4;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-r * 2.1, -r * 0.6 + tail);
    ctx.bezierCurveTo(-r * 1.2, -r * 0.2, -r * 1.3, -r * 1.1, -r * 0.2, -r);
    ctx.bezierCurveTo(r * 0.9, -r * 1.05, r * 1.1, r * 0.1, r * 0.8, r * 0.55);
    ctx.bezierCurveTo(r * 0.4, r * 1.15, -r * 0.8, r * 1.05, -r * 1.0, r * 0.25);
    ctx.bezierCurveTo(-r * 1.25, -r * 0.1, -r * 1.6, -r * 0.3, -r * 2.1, -r * 0.6 + tail);
    ctx.closePath();
  };
  ctx.globalAlpha *= 0.92;
  Art.cel(ctx, body, p.a, p.b, -2, -3, 2.4);
  ctx.fillStyle = rgba(p.c, 0.85); Art.ellipse(ctx, r * 0.05, r * 0.1, r * 0.5, r * 0.45); ctx.fill();
  ctx.globalAlpha /= 0.92;
  Art.eyes(ctx, r * 0.15, -r * 0.1, 3.2 * scale, 4 * scale, blink, true, 0.3);
  ctx.restore();
};

Art.enemy.mender = function (ctx, p, ph, scale = 1, blink = false) {
  const w = 15 * scale, h = 25 * scale;
  const hop = Math.abs(Math.sin(ph));
  ctx.fillStyle = p.b;
  for (const s of [-1, 1]) { Art.ellipse(ctx, s * 7 + Math.sin(ph) * s * 2, -1, 4.6, 3); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.save();
  ctx.translate(0, -hop * 2.5 - 2);
  // sprout
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(1, -h - 8); ctx.stroke();
  for (const s of [-1, 1]) {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(1 + s * 6, -h - 9, 6, 3.2, s * 0.5, 0, TAU); }, p.c, mix(p.c, '#3a8a3a', 0.4), -1, -1, 2);
  }
  Art.cel(ctx, () => Art.gumdrop(ctx, w, h), p.a, p.b, -3, -3, 2.5);
  Art.gloss(ctx, -w * 0.45, -h * 0.72, 3.6, 2, -0.6, 0.6);
  // little white cross badge
  ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ctx.beginPath();
  const cx = -w * 0.35, cy = -h * 0.3, a = 2.2, b = 5.5;
  ctx.rect(cx - a, cy - b, a * 2, b * 2); ctx.rect(cx - b, cy - a, b * 2, a * 2);
  ctx.fill();
  Art.eyes(ctx, w * 0.32, -h * 0.58, 3.6, 4.2, blink, false);
  ctx.fillStyle = rgba(p.d, 0.7); Art.ellipse(ctx, w * 0.65, -h * 0.38, 3, 1.8); ctx.fill();
  ctx.restore();
};

Art.enemy.brute = function (ctx, p, ph, scale = 1, blink = false) {
  const w = 26 * scale, h = 44 * scale;
  const step = Math.sin(ph);
  ctx.fillStyle = p.b;
  for (const s of [-1, 1]) { Art.ellipse(ctx, s * 13 + step * s * 3, -1, 8, 5); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.save();
  ctx.translate(0, -2 - Math.abs(step) * 2);
  const sq = Math.cos(ph * 2) * 0.04; ctx.scale(1 + sq, 1 - sq);
  // horns
  for (const s of [-1, 1]) {
    const horn = () => {
      ctx.beginPath(); ctx.moveTo(s * w * 0.3, -h * 0.9);
      ctx.quadraticCurveTo(s * w * 0.75, -h * 1.1, s * w * 0.62, -h * 1.32);
      ctx.quadraticCurveTo(s * w * 0.4, -h * 1.05, s * w * 0.05, -h * 0.98); ctx.closePath();
    };
    Art.cel(ctx, horn, p.c, p.d, -1.5, -1.5, 2.4);
  }
  Art.cel(ctx, () => Art.gumdrop(ctx, w, h), p.a, p.b, -5, -5, 3);
  Art.gloss(ctx, -w * 0.45, -h * 0.74, 6, 3.4, -0.6, 0.55);
  Art.eyes(ctx, w * 0.28, -h * 0.58, 5.4, 6.4, blink, true);
  // toothy grin
  ctx.fillStyle = INK; ctx.beginPath();
  ctx.moveTo(w * 0.0, -h * 0.34); ctx.quadraticCurveTo(w * 0.35, -h * 0.18, w * 0.7, -h * 0.36); ctx.quadraticCurveTo(w * 0.35, -h * 0.28, w * 0.0, -h * 0.34); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(w * 0.15, -h * 0.315); ctx.lineTo(w * 0.22, -h * 0.25); ctx.lineTo(w * 0.29, -h * 0.29); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.45, -h * 0.295); ctx.lineTo(w * 0.52, -h * 0.24); ctx.lineTo(w * 0.58, -h * 0.315); ctx.fill();
  ctx.restore();
};

Art.enemy.king = function (ctx, p, ph, scale = 1, blink = false) {
  const w = 40 * scale, h = 70 * scale;
  const step = Math.sin(ph);
  // cape behind
  const cape = () => {
    ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.85);
    ctx.bezierCurveTo(-w * 1.3, -h * 0.7, -w * 1.5 + step * 4, -h * 0.1, -w * 1.25 + step * 6, -2);
    ctx.lineTo(w * 0.2, -2); ctx.closePath();
  };
  Art.cel(ctx, cape, p.e, p.f, -3, -3, 3);
  ctx.fillStyle = p.b;
  for (const s of [-1, 1]) { Art.ellipse(ctx, s * 20 + step * s * 3, -1, 11, 6.5); ctx.fill(); ctx.lineWidth = 2.8; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.save();
  ctx.translate(0, -2 - Math.abs(step) * 2.5);
  Art.cel(ctx, () => Art.gumdrop(ctx, w, h), p.a, p.b, -7, -7, 3.4);
  Art.gloss(ctx, -w * 0.45, -h * 0.74, 9, 5, -0.6, 0.5);
  // fur collar
  ctx.fillStyle = '#fff6e8'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const x = -w * 0.95 + (i / 8) * w * 1.9;
    const y = -h * 0.3 + Math.sin((i / 8) * Math.PI) * h * 0.06;
    ctx.arc(x, y, 6.5, 0, TAU);
  }
  ctx.fill();
  for (let i = 0; i <= 8; i++) {
    const x = -w * 0.95 + (i / 8) * w * 1.9;
    const y = -h * 0.3 + Math.sin((i / 8) * Math.PI) * h * 0.06;
    ctx.beginPath(); ctx.arc(x, y, 6.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
  Art.eyes(ctx, w * 0.25, -h * 0.6, 7, 9, blink, true);
  // moustache
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(w * 0.25, -h * 0.45);
    ctx.quadraticCurveTo(w * 0.25 + s * 14, -h * 0.48, w * 0.25 + s * 20, -h * 0.4);
    ctx.quadraticCurveTo(w * 0.25 + s * 12, -h * 0.42, w * 0.25, -h * 0.41); ctx.fill();
  }
  // crown
  ctx.save(); ctx.translate(w * 0.05, -h * 0.98 + Math.sin(ph * 2) * 1.5); ctx.rotate(0.08);
  const crown = () => {
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-23, -22); ctx.lineTo(-11, -11); ctx.lineTo(0, -27); ctx.lineTo(11, -11); ctx.lineTo(23, -22); ctx.lineTo(20, 0); ctx.closePath();
  };
  Art.cel(ctx, crown, p.c, p.d, -2, -2, 2.6);
  for (const [x, y, c] of [[0, -8, '#5ad1ff'], [-12, -5, '#ff5a7a'], [12, -5, '#7cf06b']]) {
    ctx.fillStyle = c; Art.ellipse(ctx, x, y, 3.2, 3.2); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------
const PLAT = [
  { side: '#9a6235', top: '#c98a4b', line: '#a8703f' },
  { side: '#8f8780', top: '#c9c2b9', line: '#a39b93' },
  { side: '#8f8780', top: '#d6cfc6', line: '#a39b93', trim: '#ffcc3d' },
  { side: '#7d6fa0', top: '#e8e2f2', line: '#b9aed0', trim: '#ffcc3d' },
];
Art.platform = function (ctx, lvl, flag) {
  const P = PLAT[Math.min(lvl, 4) - 1];
  const rx = 27, ry = 12.5, th = 7;
  const sil = () => {
    ctx.beginPath(); ctx.moveTo(-rx, -th); ctx.lineTo(-rx, 0);
    ctx.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(rx, -th); ctx.ellipse(0, -th, rx, ry, 0, 0, Math.PI, true); ctx.closePath();
  };
  sil(); ctx.fillStyle = P.side; ctx.fill();
  if (P.trim) {
    ctx.save(); sil(); ctx.clip();
    ctx.fillStyle = P.trim; ctx.fillRect(-rx, -th + ry - 2, rx * 2, 3.5);
    ctx.beginPath(); ctx.ellipse(0, -th + 2.5, rx, ry, 0, 0, Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = P.trim; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(0, -th, rx, ry, 0, 0, TAU); ctx.fillStyle = P.top; ctx.fill();
  // surface detail
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, -th, rx, ry, 0, 0, TAU); ctx.clip();
  ctx.strokeStyle = P.line; ctx.lineWidth = 1.5;
  if (lvl === 1) {
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10, -th - ry); ctx.lineTo(i * 10, -th + ry); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.ellipse(0, -th, rx * 0.62, ry * 0.62, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * 0.62, -th + Math.sin(a) * ry * 0.62); ctx.lineTo(Math.cos(a) * rx, -th + Math.sin(a) * ry); ctx.stroke(); }
  }
  ctx.restore();
  ctx.beginPath(); ctx.ellipse(-rx * 0.3, -th - ry * 0.35, rx * 0.45, ry * 0.3, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  sil(); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -th, rx, ry, 0, Math.PI, 0); ctx.lineWidth = 1.6; ctx.stroke();
  if (flag) {
    const fx = rx - 6, fy = -th - 2;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 30); ctx.stroke();
    const wave = Math.sin(performance.now() / 260) * 2;
    const fl = () => { ctx.beginPath(); ctx.moveTo(fx, fy - 30); ctx.quadraticCurveTo(fx + 8, fy - 31 + wave, fx + 15, fy - 26 + wave); ctx.lineTo(fx, fy - 20); ctx.closePath(); };
    Art.cel(ctx, fl, flag, mix(flag, INK, 0.3), 0, -1.5, 2);
  }
};

function aimSide(angle) {
  const c = Math.cos(angle);
  const face = c < 0 ? -1 : 1;
  let la = Math.atan2(Math.sin(angle), Math.abs(c));
  return { face, la };
}

// ---------------------------------------------------------------------------
// Sprite cache: static parts are rendered once to offscreen canvases at the
// current backing resolution and blitted afterwards.
// ---------------------------------------------------------------------------
const Sprites = {
  k: 2, map: new Map(), glows: new Map(),
  setScale(k) { if (Math.abs(k - this.k) > 1e-3) { this.k = k; this.map.clear(); this.glows.clear(); } },
  get(key, b, fn) {
    let s = this.map.get(key);
    if (!s) {
      const k = this.k, c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil((b[2] - b[0]) * k)); c.height = Math.max(1, Math.ceil((b[3] - b[1]) * k));
      const x = c.getContext('2d');
      x.setTransform(k, 0, 0, k, -b[0] * k, -b[1] * k);
      fn(x);
      s = { c, x0: b[0], y0: b[1], w: b[2] - b[0], h: b[3] - b[1] };
      this.map.set(key, s);
    }
    return s;
  },
  draw(ctx, s, dx = 0, dy = 0) { ctx.drawImage(s.c, s.x0 + dx, s.y0 + dy, s.w, s.h); },
  glow(rgb) {
    let c = this.glows.get(rgb);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.45, `rgba(${rgb},0.45)`); g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      this.glows.set(rgb, c);
    }
    return c;
  },
};

// draw a sub-part either live or through the sprite cache
function part(ctx, cache, key, b, fn) {
  if (cache) Sprites.draw(ctx, Sprites.get(key, b, fn));
  else fn(ctx);
}
Art.glow = function (ctx, x, y, R, rgb, a, cache) {
  if (cache) {
    const pa = ctx.globalAlpha; ctx.globalAlpha = pa * clamp(a, 0, 1);
    ctx.drawImage(Sprites.glow(rgb), x - R, y - R, R * 2, R * 2);
    ctx.globalAlpha = pa;
  } else {
    const g = ctx.createRadialGradient(x, y, 2, x, y, R);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  }
};

const TB = [-46, -46, 46, 22]; // bounds of a tower base sprite
Art.tower = {};
Art.towerBase = {};

// ---- squirrel -------------------------------------------------------------
const stumpH = (lvl) => 14 + Math.min(lvl, 3) * 2;
Art.towerBase.squirrel = function (ctx, lvl, br) {
  Art.platform(ctx, br ? 4 : lvl, br === 'A' ? '#e4414f' : br === 'B' ? '#3f8ef0' : null);
  const sh = stumpH(lvl);
  const stump = () => {
    ctx.beginPath(); ctx.moveTo(-15, -8); ctx.lineTo(-14, -8 - sh); ctx.ellipse(0, -8 - sh, 14, 6, 0, Math.PI, 0); ctx.lineTo(15, -8);
    ctx.ellipse(0, -8, 15, 6, 0, 0, Math.PI); ctx.closePath();
  };
  Art.cel(ctx, stump, '#a8693a', '#7a4826', -3, 0, 2.4);
  ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-6, -4 - sh); ctx.moveTo(6, -8); ctx.lineTo(6, -2 - sh); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -8 - sh, 14, 6, 0, 0, TAU); ctx.fillStyle = '#efcf96'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -8 - sh, 8, 3.2, 0, 0, TAU); ctx.lineWidth = 1.3; ctx.strokeStyle = '#c99a5b'; ctx.stroke();
};

Art.squirrelBody = function (ctx, lvl, br, la, recoil) {
  const fur = '#ee8a3c', furD = '#bf5f22', belly = '#fff0d4';
  const tail = () => {
    ctx.beginPath(); ctx.moveTo(-3, -2);
    ctx.bezierCurveTo(-24, 0, -28, -28, -17, -40);
    ctx.bezierCurveTo(-8, -50, 6, -44, 1, -35);
    ctx.bezierCurveTo(-5, -31, -13, -25, -8, -12); ctx.closePath();
  };
  ctx.save(); ctx.translate(-2, 0); Art.cel(ctx, tail, fur, furD, 3, -3, 2.4);
  ctx.strokeStyle = rgba('#ffd9a8', 0.9); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-15, -12); ctx.quadraticCurveTo(-22, -28, -12, -38); ctx.stroke(); ctx.restore();
  Art.cel(ctx, () => Art.ellipse(ctx, 2, -12, 10, 12), fur, furD, -2, -2, 2.4);
  ctx.fillStyle = belly; Art.ellipse(ctx, 6, -10, 5, 8); ctx.fill();
  const hx = 5, hy = -28 - recoil * 1.5;
  for (const ex of [0, 8]) {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(hx + ex - 5, hy - 5); ctx.lineTo(hx + ex - 2, hy - 15); ctx.lineTo(hx + ex + 3, hy - 6); ctx.closePath(); }, fur, furD, -1, -1, 2.2);
  }
  Art.cel(ctx, () => { ctx.beginPath(); ctx.arc(hx, hy, 9.5, 0, TAU); }, fur, furD, -2, -2, 2.4);
  ctx.fillStyle = belly; Art.ellipse(ctx, hx + 6, hy + 3, 5.5, 4.2); ctx.fill();
  ctx.fillStyle = INK; Art.ellipse(ctx, hx + 11, hy + 1, 2.2, 1.8); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + 3.5, hy - 2, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 4.3, hy - 3, 0.9, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#ff7a9c', 0.55); Art.ellipse(ctx, hx + 1, hy + 4, 2.6, 1.6); ctx.fill();
  if (br === 'A') {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(hx, hy - 8, 14, 4, -0.1, 0, TAU); }, '#7a5a3a', '#4f3a26', 0, -1, 2);
    Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(hx - 8, hy - 9); ctx.quadraticCurveTo(hx - 7, hy - 21, hx + 1, hy - 20); ctx.quadraticCurveTo(hx + 8, hy - 19, hx + 7, hy - 9); ctx.closePath(); }, '#9a7550', '#6b4f33', -1, -1, 2);
    ctx.fillStyle = '#e4414f'; ctx.fillRect(hx - 7.5, hy - 12, 15, 3);
  } else if (br === 'B') {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.arc(hx, hy - 4, 10.5, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); }, '#6f8d4a', '#4c6533', -1, -1, 2.2);
    ctx.fillStyle = '#ffcc3d'; Art.star(ctx, hx, hy - 9, 3.4, 1.5); ctx.fill();
  } else if (lvl >= 2) {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(hx - 1, hy - 10, 9, 4.5, -0.4, 0, TAU); }, '#79c94f', '#4f9a35', -1, -1, 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx - 1, hy - 12); ctx.lineTo(hx + 3, hy - 17); ctx.stroke();
  }
  if (lvl >= 3 && !br) {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(hx - 1, hy + 8.5, 8, 3, 0.1, 0, TAU); }, '#e4414f', '#a8253a', 0, -1, 2);
    Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(hx - 6, hy + 8); ctx.lineTo(hx - 14, hy + 14); ctx.lineTo(hx - 9, hy + 16); ctx.closePath(); }, '#e4414f', '#a8253a', 0, -1, 1.8);
  }
  ctx.save();
  ctx.translate(7, -15);
  ctx.rotate(clamp(la, -1.25, 0.95));
  ctx.translate(-recoil * 4, 0);
  if (br === 'A') {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(-4, -3, 30, 6); }, '#8a5a32', '#5f3c20', 0, -1.5, 2.2);
    Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(14, -2, 18, 4); }, '#ffcc3d', '#d49a1a', 0, -1, 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(4, -11); ctx.quadraticCurveTo(12, 0, 4, 11); ctx.stroke();
  } else if (br === 'B') {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(4, -6, 20, 12); }, '#6f8d4a', '#4c6533', 0, -2, 2.2);
    for (let i = -1; i <= 1; i++) Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(22, i * 4 - 1.6, 9, 3.2); }, '#c9c2b9', '#8f8780', 0, -1, 1.6);
    Art.ball(ctx, 8, 0, 6, '#a8693a', '#7a4826', 2, 0.4);
  } else {
    ctx.strokeStyle = '#7a4826'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0); ctx.moveTo(12, 0); ctx.lineTo(18, -6); ctx.moveTo(12, 0); ctx.lineTo(18, 6); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(18, -6); ctx.lineTo(10 - recoil * 3, 0); ctx.lineTo(18, 6); ctx.stroke();
    if (recoil < 0.3) Art.acorn(ctx, 11, 0, 0, 0.75);
  }
  Art.ball(ctx, 0, 0, 3.6, fur, furD, 2, 0);
  ctx.restore();
};

Art.tower.squirrel = function (ctx, tw, t, cache) {
  const lvl = tw.level, br = tw.branch;
  part(ctx, cache, `sb${lvl}${br}`, TB, (c) => Art.towerBase.squirrel(c, lvl, br));
  const { face, la } = aimSide(tw.angle);
  const recoil = tw.fireAnim || 0;
  ctx.save();
  ctx.translate(0, -10 - stumpH(lvl));
  ctx.scale(face, 1);
  if (cache) {
    const ab = Math.round((clamp(la, -1.25, 0.95) + 1.25) / 2.2 * 14), rb = Math.round(recoil * 3);
    part(ctx, true, `sq${lvl}${br}:${ab}:${rb}`, [-36, -62, 52, 14], (c) => Art.squirrelBody(c, lvl, br, -1.25 + (ab / 14) * 2.2, rb / 3));
  } else Art.squirrelBody(ctx, lvl, br, la, recoil);
  ctx.restore();
};

Art.acorn = function (ctx, x, y, rot, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(1.5, 0, 5.5, 4.4, 0, 0, TAU); }, '#c98a4b', '#9a6235', -1, -1, 1.8);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(-2.5, 0, 3.4, 5, 0, 0, TAU); }, '#7a4826', '#5a331a', -0.5, -0.5, 1.8);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(-8, -1); ctx.stroke();
  ctx.restore();
};

// ---- mushroom mortar ---------------------------------------------------------
const MORTAR_COL = { A: ['#ff6a3d', '#c43f22'], B: ['#c25ee8', '#8a35b0'], null: ['#ec4b55', '#b0303d'] };
Art.towerBase.mortar = function (ctx, lvl, br) {
  Art.platform(ctx, br ? 4 : lvl, br === 'A' ? '#ff8a3d' : br === 'B' ? '#c25ee8' : null);
  if (br === 'B') {
    const [capCol, capDark] = MORTAR_COL.B;
    for (const [x, y] of [[-18, -10], [18, -11]]) {
      ctx.save(); ctx.translate(x, y);
      Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(-3.5, -12, 7, 12); }, '#fbecd2', '#dcc39c', -1, 0, 2);
      Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -12, 9, 7, 0, Math.PI, 0); ctx.closePath(); }, capCol, capDark, -1, -1.5, 2);
      ctx.fillStyle = '#fff'; Art.ellipse(ctx, -3, -15, 1.8, 1.4); ctx.fill();
      ctx.restore();
    }
  }
};
Art.mushroom = function (ctx, lvl, br) {
  const [capCol, capDark] = MORTAR_COL[br];
  const big = br === 'A' ? 1.18 : 1 + (lvl - 1) * 0.07;
  const stem = () => { ctx.beginPath(); ctx.moveTo(-11, 0); ctx.quadraticCurveTo(-8, -12, -9, -22); ctx.lineTo(9, -22); ctx.quadraticCurveTo(8, -12, 11, 0); ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI); ctx.closePath(); };
  Art.cel(ctx, stem, '#fbecd2', '#dcc39c', -3, 0, 2.4);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-3.5, -9, 1.7, 0, TAU); ctx.arc(3.5, -9, 1.7, 0, TAU); ctx.fill();
  ctx.fillStyle = rgba('#ff7a9c', 0.55); Art.ellipse(ctx, -6.5, -6, 2.2, 1.3); ctx.fill(); Art.ellipse(ctx, 6.5, -6, 2.2, 1.3); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(0, -7, 1.8, 0.2, Math.PI - 0.2); ctx.stroke();
  if (lvl >= 3 || br) Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(-10, -21, 20, 4); }, '#ffcc3d', '#d49a1a', 0, -1, 1.8);
  ctx.save();
  ctx.translate(0, -22);
  ctx.scale(big, big);
  const cap = () => {
    ctx.beginPath(); ctx.moveTo(-26, 2);
    ctx.bezierCurveTo(-28, -26, 28, -26, 26, 2);
    for (let i = 0; i < 6; i++) { const x0 = 26 - (i * 52) / 6, x1 = 26 - ((i + 1) * 52) / 6; ctx.quadraticCurveTo((x0 + x1) / 2, 6, x1, 2); }
    ctx.closePath();
  };
  Art.cel(ctx, cap, capCol, capDark, -3, -4, 2.6);
  const spots = [[-14, -9, 4.4], [12, -12, 3.6], [-2, -15, 2.8], [17, -3, 2.6], [-20, -2, 2.4]];
  ctx.fillStyle = '#fff6ea';
  for (let i = 0; i < Math.min(5, 3 + lvl); i++) { const s = spots[i]; Art.ellipse(ctx, s[0], s[1], s[2], s[2] * 0.8); ctx.fill(); }
  ctx.fillStyle = '#5a2d3a'; Art.ellipse(ctx, 0, -17, 7.5, 3.6); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = INK; Art.ellipse(ctx, 0, -16.5, 5, 2.2); ctx.fill();
  if (br === 'A') {
    ctx.fillStyle = '#c9c2b9';
    for (let i = 0; i < 5; i++) { const a = Math.PI + 0.35 + i * 0.6; ctx.beginPath(); ctx.arc(Math.cos(a) * 21, -2 + Math.sin(a) * 15, 2.2, 0, TAU); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  Art.gloss(ctx, -12, -15, 6, 3, -0.4, 0.4);
  ctx.restore();
};
Art.tower.mortar = function (ctx, tw, t, cache) {
  const lvl = tw.level, br = tw.branch;
  part(ctx, cache, `mb${lvl}${br}`, TB, (c) => Art.towerBase.mortar(c, lvl, br));
  const fa = tw.fireAnim || 0;
  const spring = Math.sin((1 - fa) * Math.PI * 3) * fa;
  ctx.save();
  ctx.translate(0, -8);
  ctx.scale(1 + spring * 0.18, 1 - spring * 0.22);
  part(ctx, cache, `mm${lvl}${br}`, [-38, -66, 38, 8], (c) => Art.mushroom(c, lvl, br));
  ctx.restore();
};

// ---- frost shrine --------------------------------------------------------------
Art.towerBase.frost = function (ctx, lvl, br) {
  Art.platform(ctx, br ? 4 : lvl, br === 'A' ? '#8fe3ff' : br === 'B' ? '#4f8fe0' : null);
  const ped = () => { ctx.beginPath(); ctx.moveTo(-13, -8); ctx.lineTo(-9, -30); ctx.lineTo(9, -30); ctx.lineTo(13, -8); ctx.ellipse(0, -8, 13, 4.5, 0, 0, Math.PI); ctx.closePath(); };
  Art.cel(ctx, ped, '#c6d6e8', '#8ea4c0', -3, 0, 2.4);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(-12, -34, 24, 6); }, '#e3edf7', '#a9bcd3', 0, -1.5, 2.2);
  ctx.strokeStyle = '#5fc8f0'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(0, -25); ctx.lineTo(0, -13); ctx.moveTo(-5, -22); ctx.lineTo(5, -16); ctx.moveTo(5, -22); ctx.lineTo(-5, -16); ctx.stroke();
};
Art.crystal = function (ctx, lvl, br) {
  const sc = br === 'B' ? 1.0 : 1 + (lvl - 1) * 0.08;
  const tall = br === 'B' ? 1.7 : 1;
  ctx.save(); ctx.scale(sc, sc * tall);
  const crystal = () => { ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(9, -6); ctx.lineTo(7, 8); ctx.lineTo(0, 15); ctx.lineTo(-7, 8); ctx.lineTo(-9, -6); ctx.closePath(); };
  crystal(); ctx.fillStyle = '#7fd4f5'; ctx.fill();
  ctx.fillStyle = '#c9f5ff'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(-9, -6); ctx.lineTo(-7, 8); ctx.lineTo(0, 15); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4fb1e0'; ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(7, 8); ctx.lineTo(9, -6); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(-1, -12); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();
  ctx.lineJoin = 'round'; crystal(); ctx.lineWidth = 2.4 / sc; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
};
Art.snowflake = function (ctx) {
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const flake = () => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26); const mx = Math.cos(a) * 20, my = Math.sin(a) * 20; ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a + 0.8) * 6, my + Math.sin(a + 0.8) * 6); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a - 0.8) * 6, my + Math.sin(a - 0.8) * 6); } };
  flake(); ctx.stroke(); ctx.strokeStyle = '#c9f5ff'; ctx.lineWidth = 2.4; flake(); ctx.stroke();
};
Art.miniShard = function (ctx) {
  const sh = () => { ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(3.5, 0); ctx.lineTo(0, 6); ctx.lineTo(-3.5, 0); ctx.closePath(); };
  Art.cel(ctx, sh, '#c9f5ff', '#6cc3ea', -1, -1, 1.8);
};
Art.tower.frost = function (ctx, tw, t, cache) {
  const lvl = tw.level, br = tw.branch;
  part(ctx, cache, `fb${lvl}${br}`, TB, (c) => Art.towerBase.frost(c, lvl, br));
  const fa = tw.fireAnim || 0;
  const bob = Math.sin(t * 2.4 + (tw.x || 0)) * 2.5;
  const cy = -54 + bob;
  Art.glow(ctx, 0, cy, 30 + fa * 12, '170,240,255', 0.55 + fa * 0.4, cache);
  if (br === 'A') {
    ctx.save(); ctx.translate(0, cy); ctx.rotate(t * 0.8);
    part(ctx, cache, 'flake', [-30, -30, 30, 30], Art.snowflake);
    ctx.restore();
  }
  ctx.save(); ctx.translate(0, cy);
  part(ctx, cache, `fc${lvl}${br}`, [-14, -30, 14, 30], (c) => Art.crystal(c, lvl, br));
  ctx.restore();
  const n = br ? 3 : lvl - 1;
  for (let i = 0; i < n; i++) {
    const a = t * 1.6 + i * TAU / n;
    ctx.save(); ctx.translate(Math.cos(a) * 22, cy + Math.sin(a) * 7); ctx.rotate(a);
    part(ctx, cache, 'fshard', [-6, -8, 6, 8], Art.miniShard);
    ctx.restore();
  }
};

// ---- thunder totem ---------------------------------------------------------------
const totemH = (lvl, br) => 34 + Math.min(lvl, 3) * 4 + (br ? 4 : 0);
Art.towerBase.thunder = function (ctx, lvl, br) {
  Art.platform(ctx, br ? 4 : lvl, br === 'A' ? '#ffcc3d' : br === 'B' ? '#6c7a96' : null);
  const hgt = totemH(lvl, br);
  const pole = () => { ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-11, -hgt); ctx.lineTo(11, -hgt); ctx.lineTo(12, -6); ctx.ellipse(0, -6, 12, 4.5, 0, 0, Math.PI); ctx.closePath(); };
  Art.cel(ctx, pole, '#5f9fa0', '#3d7273', -3, 0, 2.4);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(-12.5, -hgt * 0.55 - 4, 25, 8); }, '#b5784a', '#83522d', 0, -1.5, 2);
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(-7, -17); ctx.lineTo(-2, -15); ctx.lineTo(-7, -13); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(7, -17); ctx.lineTo(2, -15); ctx.lineTo(7, -13); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffe14d'; ctx.fillRect(-4, -10, 8, 2.4);
  if (lvl >= 2 || br) {
    for (const s of [-1, 1]) {
      Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(s * 11, -hgt * 0.55 - 2); ctx.lineTo(s * 22, -hgt * 0.55 - 10); ctx.lineTo(s * 19, -hgt * 0.55 + 2); ctx.lineTo(s * 11, -hgt * 0.55 + 4); ctx.closePath(); }, '#ffcc3d', '#d49a1a', 0, -1, 2);
    }
  }
  const cupY = -hgt;
  Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(-13, cupY); ctx.lineTo(-9, cupY - 7); ctx.lineTo(9, cupY - 7); ctx.lineTo(13, cupY); ctx.closePath(); }, '#e0894a', '#a85a2a', 0, -1.5, 2.2);
  if (br === 'A') {
    ctx.strokeStyle = '#e0894a'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, cupY + 6 + i * 6, 13, 3.5, 0, 0, Math.PI); ctx.stroke(); }
  }
};
Art.stormCloud = function (ctx) {
  const cloud = () => { ctx.beginPath(); ctx.arc(-12, 2, 9, 0, TAU); ctx.arc(0, -4, 12, 0, TAU); ctx.arc(13, 1, 9, 0, TAU); ctx.rect(-12, 2, 25, 8); };
  cloud(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  Art.cel(ctx, cloud, '#8a94b0', '#5b6482', -2, -3, 0);
  Art.gloss(ctx, -4, -9, 6, 3, -0.3, 0.35);
};
Art.tower.thunder = function (ctx, tw, t, cache) {
  const lvl = tw.level, br = tw.branch;
  part(ctx, cache, `tb${lvl}${br}`, [-46, -80, 46, 22], (c) => Art.towerBase.thunder(c, lvl, br));
  const fa = tw.fireAnim || 0;
  const oy = -totemH(lvl, br) - 15;
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  Art.glow(ctx, 0, oy, 28 + fa * 14, '255,236,120', 0.5 + 0.2 * pulse + fa * 0.3, cache);
  const hot = fa > 0.2;
  ctx.save(); ctx.translate(0, oy); ctx.scale(1 + fa * 0.45, 1 + fa * 0.45);
  part(ctx, cache, hot ? 'orbH' : 'orb', [-12, -12, 12, 12], (c) => Art.ball(c, 0, 0, 9, hot ? '#fffbe0' : '#ffe14d', '#f2b01e', 2.4, 0.7));
  ctx.restore();
  const R = 9 + fa * 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
  const rr = mulberry32(Math.floor(t * 12) + (tw.id || 0) * 7);
  for (let k = 0; k < 2; k++) {
    const a = rr() * TAU; let x = Math.cos(a) * R, y = oy + Math.sin(a) * R;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) { x += Math.cos(a) * 5 + (rr() - 0.5) * 6; y += Math.sin(a) * 5 + (rr() - 0.5) * 6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  if (br === 'B') {
    ctx.save(); ctx.translate(0, oy - 26 + Math.sin(t * 1.5) * 2);
    part(ctx, cache, 'cloud', [-26, -20, 26, 16], Art.stormCloud);
    ctx.restore();
  }
};

// ---- honey farm ---------------------------------------------------------------
Art.towerBase.farm = function (ctx, lvl) {
  Art.platform(ctx, lvl, null);
  if (lvl >= 2) {
    for (const [x, y, c] of [[-18, -6, '#ff8fb5'], [19, -4, '#fff'], [-10, 1, '#ffd84d'], [14, 2, '#ff8fb5']]) Art.flower(ctx, x, y, 3.4, c);
  }
  const gold = lvl >= 3;
  const hc = gold ? '#ffd84a' : '#f5bf45', hd = gold ? '#e09a1a' : '#c98a24';
  ctx.save(); ctx.translate(0, -8);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.fillStyle = '#a8693a';
  ctx.beginPath(); ctx.rect(-12, -4, 4, 6); ctx.rect(8, -4, 4, 6); ctx.fill(); ctx.stroke();
  const rings = [[16, -4], [17.5, -13], [16.5, -22], [13.5, -30], [9, -37]];
  for (const [rw, y] of rings) Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, y - 4, rw, 6, 0, 0, TAU); }, hc, hd, -2, -2.5, 2.2);
  Art.ball(ctx, 0, -43, 5, hc, hd, 2.2, 0.5);
  ctx.fillStyle = '#5a3418'; ctx.beginPath(); ctx.ellipse(3, -8, 5, 4.4, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(-9, -23); ctx.quadraticCurveTo(-7, -14, -6, -13); ctx.arc(-7, -13, 2.4, 0, Math.PI); ctx.quadraticCurveTo(-9, -16, -12, -23); ctx.closePath(); }, '#ff9f1c', '#d9750a', -0.5, -0.5, 1.6);
  Art.gloss(ctx, -8, -33, 4, 2, -0.4, 0.5);
  if (gold) {
    ctx.save(); ctx.translate(0, -48);
    Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, -5); ctx.lineTo(0, -11); ctx.lineTo(3, -5); ctx.lineTo(8, -9); ctx.lineTo(7, 0); ctx.closePath(); }, '#ffd23f', '#e09a1a', -1, -1, 1.8);
    ctx.restore();
  }
  ctx.restore();
};
Art.tower.farm = function (ctx, tw, t, cache) {
  const lvl = tw.level;
  part(ctx, cache, `hb${lvl}`, [-46, -72, 46, 22], (c) => Art.towerBase.farm(c, lvl));
  const n = 1 + lvl;
  for (let i = 0; i < n; i++) {
    const a = t * (1.6 + i * 0.25) + i * 2.1;
    const bx = Math.cos(a) * (22 + i * 3), by = -30 + Math.sin(a * 1.3) * 12;
    const face = Math.sin(a) > 0 ? -1 : 1;
    if (cache) {
      const fb = Math.floor(t * 30 + i) % 3;
      ctx.save(); ctx.translate(bx, by); ctx.scale(face, 1);
      part(ctx, true, 'bee' + fb, [-7, -10, 7, 6], (c) => Art.bee(c, 0, 0, 1, fb === 0 ? 0 : fb === 1 ? 0.02 : 0.04));
      ctx.restore();
    } else Art.bee(ctx, bx, by, face, t);
  }
};

Art.bee = function (ctx, x, y, face, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const flap = Math.abs(Math.sin(t * 40));
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
  Art.ellipse(ctx, -1, -4, 3, 2 + flap * 1.5, -0.4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; Art.ellipse(ctx, 0, 0, 4.2, 3.2); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = INK; ctx.fillRect(-1.2, -3, 1.6, 6); ctx.beginPath(); ctx.arc(3, -0.6, 0.9, 0, TAU); ctx.fill();
  ctx.restore();
};

Art.flower = function (ctx, x, y, r, c) {
  ctx.fillStyle = c; ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.6, r * 0.55, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
};

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
Art.spore = function (ctx, x, y, r, rot, col = '#ec4b55', dark = '#b0303d') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  Art.ball(ctx, 0, 0, r, col, dark, 2, 0.5);
  ctx.fillStyle = '#fff6ea'; Art.ellipse(ctx, r * 0.3, -r * 0.2, r * 0.25, r * 0.22); ctx.fill(); Art.ellipse(ctx, -r * 0.35, r * 0.3, r * 0.2, r * 0.18); ctx.fill();
  ctx.restore();
};

Art.shard = function (ctx, x, y, ang, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
  g.addColorStop(0, 'rgba(190,245,255,0.8)'); g.addColorStop(1, 'rgba(190,245,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
  const sh = () => { ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(0, -4); ctx.lineTo(-8, 0); ctx.lineTo(0, 4); ctx.closePath(); };
  Art.cel(ctx, sh, '#d9f8ff', '#7fd4f5', -1, -1.2, 1.8);
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Home (goal) and enemy portal
// ---------------------------------------------------------------------------
Art.homeBase = function (ctx, t) {
  Art.shadow(ctx, 0, 4, 46, 16, 0.25);
  // trunk house
  const trunk = () => { ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-30, -26, -27, -52); ctx.lineTo(27, -52); ctx.quadraticCurveTo(30, -26, 34, 0); ctx.ellipse(0, 0, 34, 10, 0, 0, Math.PI); ctx.closePath(); };
  Art.cel(ctx, trunk, '#b5784a', '#83522d', -5, 0, 3);
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(-20, -40); ctx.moveTo(23, -4); ctx.lineTo(21, -38); ctx.stroke();
  // roots
  for (const s of [-1, 1]) Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(s * 28, -10); ctx.quadraticCurveTo(s * 44, -2, s * 48, 6); ctx.quadraticCurveTo(s * 36, 4, s * 26, 2); ctx.closePath(); }, '#b5784a', '#83522d', -2, -1, 2.4);
  // door
  Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(-10, -18); ctx.arc(0, -18, 10, Math.PI, 0); ctx.lineTo(10, 4); ctx.closePath(); }, '#e0894a', '#a85a2a', -2, -1, 2.4);
  ctx.fillStyle = '#ffcc3d'; ctx.beginPath(); ctx.arc(5, -8, 1.8, 0, TAU); ctx.fill();
  // window
  const glow = 0.75 + 0.25 * Math.sin(t * 2);
  ctx.fillStyle = `rgba(255,214,90,${glow})`; ctx.beginPath(); ctx.arc(19, -32, 6, 0, TAU); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -32); ctx.lineTo(25, -32); ctx.moveTo(19, -38); ctx.lineTo(19, -26); ctx.lineWidth = 1.5; ctx.stroke();
  // leafy roof
  const canopy = () => { ctx.beginPath(); ctx.arc(-26, -58, 18, 0, TAU); ctx.arc(26, -58, 18, 0, TAU); ctx.arc(-12, -72, 22, 0, TAU); ctx.arc(14, -72, 21, 0, TAU); ctx.arc(0, -56, 22, 0, TAU); };
  canopy(); ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
  Art.cel(ctx, canopy, '#6cc657', '#3f9147', -5, -6, 0);
  Art.gloss(ctx, -18, -80, 9, 4.5, -0.4, 0.35);
};
Art.home = function (ctx, x, y, t, hit, cache) {
  ctx.save();
  const shake = hit > 0 ? Math.sin(t * 60) * hit * 4 : 0;
  ctx.translate(x + shake, y);
  part(ctx, cache, 'home', [-60, -100, 60, 22], (c) => Art.homeBase(c, 0.5));
  // sun seed
  const sy = -100 + Math.sin(t * 2) * 3;
  ctx.save(); ctx.translate(0, sy); ctx.rotate(t * 0.4);
  ctx.fillStyle = 'rgba(255,220,90,0.35)';
  for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 30, i * TAU / 8 - 0.13, i * TAU / 8 + 0.13); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  Art.glow(ctx, 0, sy, 28, '255,240,150', 0.9, cache);
  ctx.save(); ctx.translate(0, sy);
  part(ctx, cache, 'seed', [-14, -16, 14, 14], (c) => {
    Art.cel(c, () => { c.beginPath(); c.moveTo(0, -13); c.bezierCurveTo(11, -6, 11, 10, 0, 11); c.bezierCurveTo(-11, 10, -11, -6, 0, -13); }, '#ffd84a', '#f29a1e', -2, -2, 2.4);
    Art.gloss(c, -3.5, -3, 3, 2, -0.5, 0.75);
  });
  ctx.restore();
  ctx.restore();
};

Art.portal = function (ctx, x, y, t, cache) {
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(1, 0.66); Art.glow(ctx, 0, 0, 62, '90,40,140', 0.6, cache); ctx.restore();
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = t * (1.5 + i * 0.4) + i * 2;
    ctx.strokeStyle = rgba(i === 1 ? '#c99bff' : '#7d4fc7', 0.75);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 18 + i * 7, 10 + i * 4, 0, a, a + 2.2); ctx.stroke();
  }
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Background generation and rendering
// ---------------------------------------------------------------------------
const THEMES = {
  meadow: {
    ground: '#8fd36c', dark: '#7cc35b', light: '#a7e185', tuft: '#5fae4a',
    path: '#f3d9a4', pathEdge: '#d6b277', pathDark: '#b98f57', pathLight: '#fbecc8',
    trees: [['#62c05a', '#3f9147'], ['#7fd05c', '#4fa142'], ['#56b46a', '#357f4c']],
    trunk: ['#a8693a', '#7a4826'], flowers: ['#ffffff', '#ffd84d', '#ff8fb5', '#b9a2ff'],
    rock: ['#c8c3bd', '#968f88'], bush: ['#4fae4a', '#357f37'], water: ['#6fd0ec', '#3fa6cf', '#bdf0fb'],
    ambient: 'butterfly',
  },
  autumn: {
    ground: '#c2cf68', dark: '#adbd56', light: '#d3de84', tuft: '#8a9a3a',
    path: '#efcf9f', pathEdge: '#cfa36c', pathDark: '#ad7f4c', pathLight: '#f9e4c2',
    trees: [['#f59a45', '#c96a24'], ['#ea5a4f', '#b33a3b'], ['#f7c948', '#d39a24']],
    trunk: ['#8f5a35', '#64391e'], flowers: ['#ffffff', '#ff9e5e', '#e9604f', '#ffd84d'],
    rock: ['#c9bfb1', '#958a7c'], bush: ['#d98a3a', '#a85f22'], water: ['#6fd0ec', '#3fa6cf', '#bdf0fb'],
    ambient: 'leaf',
  },
  snow: {
    ground: '#eaf3fa', dark: '#d8e7f3', light: '#ffffff', tuft: '#b7cfe2',
    path: '#dcc6a3', pathEdge: '#b8996f', pathDark: '#9a7a54', pathLight: '#efe3cc',
    trees: [['#3f9a82', '#2a6b5b'], ['#4aa98a', '#2f7a63']],
    trunk: ['#8f5a35', '#64391e'], flowers: ['#bfe9ff', '#ffffff'],
    rock: ['#a9b6c8', '#76839a'], bush: ['#4aa98a', '#2f7a63'], water: ['#9fe0f5', '#6cbfe0', '#e8fbff'],
    ambient: 'snow',
  },
};

// Build static decoration + placement blockers for a level (deterministic)
function buildScenery(level, paths) {
  const th = THEMES[level.theme];
  const rng = mulberry32(level.seed * 9973);
  const R = (a, b) => a + rng() * (b - a);
  const pathHalf = 26;
  const pd = (x, y) => Math.min(...paths.map((p) => p.distTo(x, y)));
  const deco = [];
  const blockers = [];
  const hx = level.home[0], hy = level.home[1];
  blockers.push({ x: hx, y: hy - 30, r: 52 });
  for (const [x, y, rx, ry] of level.pond) {
    deco.push({ k: 'pond', x, y, rx, ry });
    blockers.push({ x, y, r: Math.max(rx, ry) * 0.92, ell: [rx, ry] });
  }
  const free = (x, y, r) => {
    for (const b of blockers) if (dist(x, y, b.x, b.y) < b.r + r) return false;
    return true;
  };
  // trees: keep away from the road so there is a ring of build space
  let tries = 0, trees = 0;
  const target = level.theme === 'snow' ? 20 : 22;
  while (trees < target && tries++ < 1400) {
    const x = R(-10, W + 10), y = R(-10, H + 20);
    const r = R(20, 30);
    if (pd(x, y) < pathHalf + r + 70) continue;
    if (dist(x, y, hx, hy) < 110) continue;
    if (!free(x, y, r + 6)) continue;
    // prefer the edges of the map
    const edge = Math.min(x, W - x, y, H - y);
    if (edge > 140 && rng() < 0.75) continue;
    const kind = level.theme === 'snow' ? 'pine' : 'tree';
    deco.push({ k: kind, x, y, r, c: Math.floor(rng() * th.trees.length), s: rng() });
    blockers.push({ x, y: y - r * 0.4, r: r * 0.95 });
    trees++;
  }
  // rocks & bushes
  for (let i = 0, n = 0; i < 600 && n < 16; i++) {
    const x = R(20, W - 20), y = R(30, H - 10);
    const r = R(9, 17);
    if (pd(x, y) < pathHalf + r + 14) continue;
    if (!free(x, y, r + 4)) continue;
    const k = rng() < 0.45 ? 'rock' : (level.theme === 'autumn' && rng() < 0.5 ? 'shroom' : 'bush');
    deco.push({ k, x, y, r, s: rng() });
    blockers.push({ x, y, r: r * 0.9 });
    n++;
  }
  // non-blocking ground detail
  const ground = [];
  for (let i = 0; i < 260; i++) {
    const x = R(0, W), y = R(0, H);
    if (pd(x, y) < pathHalf + 8) continue;
    const roll = rng();
    if (roll < 0.55) ground.push({ k: 'tuft', x, y, s: R(0.7, 1.3) });
    else if (roll < 0.85) ground.push({ k: 'flower', x, y, c: Math.floor(rng() * th.flowers.length), s: R(0.8, 1.2) });
    else ground.push({ k: 'pebble', x, y, s: R(0.6, 1.2) });
  }
  const patches = [];
  for (let i = 0; i < 46; i++) patches.push({ x: R(-40, W + 40), y: R(-40, H + 40), r: R(40, 120), light: rng() < 0.5, sx: R(1.1, 1.9) });
  const pebbles = [];
  for (const p of paths) {
    for (let d = 0; d < p.length; d += 18) {
      if (rng() < 0.45) continue;
      const pt = p.at(d), len = Math.hypot(pt.dx, pt.dy) || 1;
      const off = R(-18, 18);
      pebbles.push({ x: pt.x - (pt.dy / len) * off, y: pt.y + (pt.dx / len) * off, s: R(1.2, 2.8), c: rng() });
    }
  }
  return { theme: th, deco, blockers, ground, patches, pebbles };
}

Art.tree = function (ctx, x, y, r, cols, trunk, s) {
  Art.shadow(ctx, x + 6, y + 4, r * 1.05, r * 0.42, 0.24);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(x - 6, y + 2); ctx.lineTo(x - 5, y - r * 0.9); ctx.lineTo(x + 5, y - r * 0.9); ctx.lineTo(x + 6, y + 2); ctx.closePath(); }, trunk[0], trunk[1], -2, 0, 2.4);
  const cy = y - r * 1.15;
  const blobs = [[0, 0, r], [-r * 0.6, r * 0.15, r * 0.7], [r * 0.62, r * 0.2, r * 0.66], [r * 0.05, -r * 0.55, r * 0.68]];
  const canopy = () => { ctx.beginPath(); for (const [bx, by, br] of blobs) { ctx.moveTo(x + bx + br, cy + by); ctx.arc(x + bx, cy + by, br, 0, TAU); } };
  canopy(); ctx.lineWidth = 5.5; ctx.strokeStyle = INK; ctx.stroke();
  Art.cel(ctx, canopy, cols[0], cols[1], -r * 0.22, -r * 0.24, 0);
  // inner leaf lines
  ctx.strokeStyle = rgba(cols[1], 0.9); ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x + r * 0.25, cy + r * 0.25, r * 0.4, 0.3, 1.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.4, cy - r * 0.05, r * 0.3, 1.8, 2.8); ctx.stroke();
  Art.gloss(ctx, x - r * 0.35, cy - r * 0.6, r * 0.3, r * 0.16, -0.5, 0.3);
  if (s > 0.6) { ctx.fillStyle = '#ff5d6c'; for (const [ax, ay] of [[-0.3, 0.1], [0.35, -0.2], [0.1, 0.35]]) { ctx.beginPath(); ctx.arc(x + ax * r, cy + ay * r, 3, 0, TAU); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke(); } }
};

Art.pine = function (ctx, x, y, r, cols, trunk) {
  Art.shadow(ctx, x + 6, y + 4, r * 0.95, r * 0.38, 0.22);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(x - 5, y - 14, 10, 16); }, trunk[0], trunk[1], -2, 0, 2.4);
  for (let i = 0; i < 3; i++) {
    const w = r * (1.05 - i * 0.22), by = y - 10 - i * r * 0.62, top = by - r * 0.95;
    const tri = () => { ctx.beginPath(); ctx.moveTo(x, top); ctx.quadraticCurveTo(x + w * 0.5, by - r * 0.3, x + w, by); ctx.quadraticCurveTo(x, by + 7, x - w, by); ctx.quadraticCurveTo(x - w * 0.5, by - r * 0.3, x, top); ctx.closePath(); };
    Art.cel(ctx, tri, cols[0], cols[1], -4, -2, 2.6);
    // snow cap
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.quadraticCurveTo(x + w * 0.25, top + r * 0.3, x + w * 0.45, top + r * 0.42); ctx.quadraticCurveTo(x + w * 0.2, top + r * 0.32, x, top + r * 0.48); ctx.quadraticCurveTo(x - w * 0.2, top + r * 0.32, x - w * 0.45, top + r * 0.42); ctx.quadraticCurveTo(x - w * 0.25, top + r * 0.3, x, top + 1); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  }
};

Art.rock = function (ctx, x, y, r, cols) {
  Art.shadow(ctx, x + 3, y + 3, r * 1.1, r * 0.45, 0.22);
  const rk = () => { ctx.beginPath(); ctx.moveTo(x - r, y + 2); ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.8, x - r * 0.2, y - r * 0.95); ctx.quadraticCurveTo(x + r * 0.9, y - r, x + r, y + 2); ctx.quadraticCurveTo(x, y + r * 0.35, x - r, y + 2); ctx.closePath(); };
  Art.cel(ctx, rk, cols[0], cols[1], -r * 0.2, -r * 0.2, 2.4);
  Art.gloss(ctx, x - r * 0.35, y - r * 0.6, r * 0.25, r * 0.12, -0.3, 0.4);
};

Art.bush = function (ctx, x, y, r, cols, berries) {
  Art.shadow(ctx, x + 3, y + 3, r * 1.2, r * 0.45, 0.2);
  const b = () => { ctx.beginPath(); ctx.arc(x - r * 0.55, y - r * 0.4, r * 0.62, 0, TAU); ctx.arc(x + r * 0.55, y - r * 0.38, r * 0.6, 0, TAU); ctx.arc(x, y - r * 0.72, r * 0.72, 0, TAU); ctx.rect(x - r * 1.0, y - r * 0.5, r * 2, r * 0.5); };
  b(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  Art.cel(ctx, b, cols[0], cols[1], -r * 0.2, -r * 0.25, 0);
  if (berries) { ctx.fillStyle = '#ff5d6c'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2; for (const [bx, by] of [[-0.4, -0.5], [0.3, -0.8], [0.5, -0.35]]) { ctx.beginPath(); ctx.arc(x + bx * r, y + by * r, 2.4, 0, TAU); ctx.fill(); ctx.stroke(); } }
};

Art.bigShroom = function (ctx, x, y, r) {
  Art.shadow(ctx, x + 3, y + 3, r, r * 0.4, 0.2);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.rect(x - r * 0.28, y - r * 0.9, r * 0.56, r * 0.92); }, '#fbecd2', '#dcc39c', -2, 0, 2.2);
  Art.cel(ctx, () => { ctx.beginPath(); ctx.ellipse(x, y - r * 0.9, r, r * 0.75, 0, Math.PI, 0); ctx.closePath(); }, '#e86a3a', '#b8461f', -2, -2, 2.4);
  ctx.fillStyle = '#fff6ea'; Art.ellipse(ctx, x - r * 0.4, y - r * 1.2, r * 0.18, r * 0.14); ctx.fill(); Art.ellipse(ctx, x + r * 0.3, y - r * 1.35, r * 0.13, r * 0.1); ctx.fill();
};

Art.pond = function (ctx, x, y, rx, ry, cols, t) {
  const pp = () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); };
  ctx.save(); pp(); ctx.lineWidth = 10; ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.stroke(); ctx.restore();
  Art.cel(ctx, pp, cols[0], cols[1], rx * 0.08, ry * 0.15, 3);
  ctx.save(); pp(); ctx.clip();
  ctx.strokeStyle = rgba(cols[2], 0.8); ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x - rx * 0.5 + i * 18, y - ry * 0.3 + i * 10); ctx.lineTo(x - rx * 0.5 + i * 18 + 16, y - ry * 0.3 + i * 10); ctx.stroke(); }
  ctx.restore();
  // lily pads
  for (const [lx, ly] of [[x + rx * 0.4, y + ry * 0.2], [x - rx * 0.35, y + ry * 0.35]]) {
    Art.cel(ctx, () => { ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, 9, 0.4, TAU - 0.1); ctx.closePath(); }, '#7fd05c', '#4fa142', -1, -1, 2);
  }
  Art.flower(ctx, x + rx * 0.4 + 2, y + ry * 0.2 - 1, 3, '#ff8fb5');
};

Art.renderBackground = function (ctx, level, paths, sc) {
  const th = sc.theme;
  ctx.fillStyle = th.ground; ctx.fillRect(0, 0, W, H);
  for (const p of sc.patches) {
    ctx.fillStyle = p.light ? rgba(th.light, 0.55) : rgba(th.dark, 0.6);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * p.sx, p.r, 0, 0, TAU); ctx.fill();
  }
  // soft light from the top-left
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(255,250,220,0.18)'); lg.addColorStop(1, 'rgba(60,40,90,0.08)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  // ground details
  for (const g of sc.ground) {
    if (g.k === 'tuft') {
      ctx.strokeStyle = th.tuft; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const s = g.s * 5;
      ctx.beginPath(); ctx.moveTo(g.x - s, g.y - s * 1.1); ctx.lineTo(g.x - s * 0.3, g.y); ctx.lineTo(g.x, g.y - s * 1.5); ctx.lineTo(g.x + s * 0.3, g.y); ctx.lineTo(g.x + s, g.y - s * 1.1); ctx.stroke();
    } else if (g.k === 'pebble') {
      ctx.fillStyle = rgba(th.rock[1], 0.6); Art.ellipse(ctx, g.x, g.y, 3 * g.s, 2 * g.s); ctx.fill();
    }
  }
  // road: all outlines first, then all fills so junctions merge cleanly
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const stroke = (w, col) => { for (const p of paths) { ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(); } };
  ctx.save(); ctx.translate(0, 4); stroke(64, rgba(INK, 0.16)); ctx.restore();
  stroke(60, INK);
  stroke(55, th.pathDark);
  ctx.save(); ctx.translate(-1.5, -2.5); stroke(48, th.path); ctx.restore();
  ctx.save(); ctx.translate(-3, -4); stroke(22, rgba(th.pathLight, 0.55)); ctx.restore();
  for (const pb of sc.pebbles) {
    ctx.fillStyle = pb.c < 0.5 ? th.pathEdge : th.pathDark;
    Art.ellipse(ctx, pb.x, pb.y, pb.s * 1.3, pb.s); ctx.fill();
  }
  // flowers drawn after road so they never sit under it
  for (const g of sc.ground) if (g.k === 'flower') Art.flower(ctx, g.x, g.y, 3.2 * g.s, th.flowers[g.c]);
  // sorted scenery
  const ds = sc.deco.slice().sort((a, b) => a.y - b.y);
  for (const d of ds) {
    if (d.k === 'pond') Art.pond(ctx, d.x, d.y, d.rx, d.ry, th.water, 0);
  }
  for (const d of ds) {
    if (d.k === 'tree') Art.tree(ctx, d.x, d.y, d.r, th.trees[d.c], th.trunk, d.s);
    else if (d.k === 'pine') Art.pine(ctx, d.x, d.y, d.r, th.trees[d.c], th.trunk);
    else if (d.k === 'rock') Art.rock(ctx, d.x, d.y, d.r, th.rock);
    else if (d.k === 'bush') Art.bush(ctx, d.x, d.y, d.r, th.bush, d.s > 0.6 && level.theme !== 'snow');
    else if (d.k === 'shroom') Art.bigShroom(ctx, d.x, d.y, d.r * 1.1);
  }
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05);
  vg.addColorStop(0, 'rgba(40,20,60,0)'); vg.addColorStop(1, 'rgba(40,20,60,0.32)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
};

// tower icon to a small canvas (used by the shop UI)
Art.towerIcon = function (type, size = 84, level = 1, branch = null) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.translate(size / 2, size * 0.9);
  const s = size / 92;
  ctx.scale(s, s);
  Art.tower[type](ctx, { level, branch, angle: -0.3, x: 0, id: 1 }, 0.3, false);
  return c;
};

Art.enemyIcon = function (type, size = 64) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const def = ENEMIES[type];
  const s = (size / 64) * Math.min(1.25, 22 / def.r);
  ctx.translate(size / 2, def.fly ? size * 0.55 : size * 0.86);
  ctx.scale(s, s);
  Art.enemy[type](ctx, enemyPal(type, 0), 0.6, 1, false);
  return c;
};
