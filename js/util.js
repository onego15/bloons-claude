'use strict';
// ---------------------------------------------------------------------------
// Small math / helper library shared by every module.
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const W = 1280, H = 720;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
};

// Distance from point p to segment ab
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

// --- colour helpers --------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function rgba(hex, a) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// ---------------------------------------------------------------------------
// Path: Catmull-Rom smoothed polyline resampled at a uniform step so that
// position lookup by travelled distance is O(1).
// ---------------------------------------------------------------------------
class Path {
  constructor(ctrl, step = 2) {
    this.ctrl = ctrl;
    const dense = [];
    const P = ctrl;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const segs = 24;
      for (let s = 0; s < segs; s++) {
        const t = s / segs, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    dense.push(P[P.length - 1].slice());
    // resample uniformly
    const out = [dense[0]];
    let carry = 0;
    for (let i = 1; i < dense.length; i++) {
      let [ax, ay] = dense[i - 1];
      const [bx, by] = dense[i];
      let seg = dist(ax, ay, bx, by);
      let d = step - carry;
      while (d <= seg) {
        const t = d / seg;
        out.push([lerp(ax, bx, t), lerp(ay, by, t)]);
        d += step;
      }
      carry = seg - (d - step);
    }
    out.push(dense[dense.length - 1]);
    this.pts = out;
    this.step = step;
    this.length = (out.length - 1) * step;
  }
  at(d, o) {
    o = o || {};
    const f = clamp(d / this.step, 0, this.pts.length - 1.001);
    const i = Math.floor(f), t = f - i;
    const a = this.pts[i], b = this.pts[i + 1];
    o.x = lerp(a[0], b[0], t); o.y = lerp(a[1], b[1], t);
    o.dx = b[0] - a[0]; o.dy = b[1] - a[1];
    return o;
  }
  distTo(x, y) {
    let best = 1e9;
    const p = this.pts;
    for (let i = 0; i < p.length - 1; i += 3) {
      const j = Math.min(i + 3, p.length - 1);
      const d = segDist(x, y, p[i][0], p[i][1], p[j][0], p[j][1]);
      if (d < best) best = d;
    }
    return best;
  }
  // first distance where path is inside the screen
  entryDist() {
    for (let i = 0; i < this.pts.length; i++) {
      const [x, y] = this.pts[i];
      if (x > 6 && x < W - 6 && y > 6 && y < H - 6) return i * this.step;
    }
    return 0;
  }
}

// safe localStorage
const Store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};
