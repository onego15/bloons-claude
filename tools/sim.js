// Headless balance simulator: plays each level with a simple bot.
// usage: node tools/sim.js [strategy] [level]
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..', 'js');
const files = ['util.js', 'data.js', 'art.js', 'audio.js', 'game.js'];
let src = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');

src += `
function candidates(g) {
  const out = [];
  for (let x = 30; x < W - 30; x += 20) for (let y = 50; y < H - 20; y += 20) {
    if (!g.canPlace('squirrel', x, y)) continue;
    let cov = 0;
    for (const p of g.paths) for (let d = 0; d < p.length; d += 10) { const q = p.at(d); if (dist2(q.x, q.y, x, y) < 150 * 150) cov++; }
    out.push({ x, y, cov });
  }
  return out.sort((a, b) => b.cov - a.cov);
}
function runBot(levelIdx, strategy) {
  const g = new Game(levelIdx, { headless: true }); const lk={}; const ol=g.leak.bind(g); g.leak=(e)=>{const k=g.waveIdx+':'+e.type; lk[k]=(lk[k]||0)+1; ol(e);};
  let cands = candidates(g);
  const opening = strategy === 'weak' ? ['squirrel', 'squirrel'] : ['squirrel', 'squirrel', 'farm', 'mortar', 'frost', 'thunder'];
  let oi = 0, cyc = 0, br = 0;
  const cycle = ['squirrel', 'mortar', 'thunder', 'frost', 'squirrel', 'thunder'];
  const placeBest = (type) => {
    if (g.gold < TOWERS[type].cost) return false;
    let spot;
    if (type === 'farm') spot = cands[cands.length - 1]; // farms go where coverage is worst
    else spot = cands.find((c) => g.canPlace(type, c.x, c.y));
    if (!spot || !g.canPlace(type, spot.x, spot.y)) { cands = candidates(g); return false; }
    g.place(type, spot.x, spot.y);
    cands = cands.filter((c) => dist2(c.x, c.y, spot.x, spot.y) > 44 * 44);
    return true;
  };
  let steps = 0; let lastL = g.lives; const leaks = {};
  while (g.state === 'play' && steps < 60 * 60 * 40) {
    steps++;
    if (steps % 30 === 0) {
      if (strategy === 'weak') {
        if (g.gold >= 100) placeBest('squirrel');
      } else if (oi < opening.length) { if (placeBest(opening[oi])) oi++; }
      else {
        const ups = g.towers.filter((t) => t.level < 3 && (t.type !== 'farm' || g.waveIdx < g.totalWaves - 4)).sort((a, b) => a.level - b.level);
        const nonFarm = g.towers.filter((t) => t.type !== 'farm');
        if (ups.length && nonFarm.filter(t=>t.level<3).length >= nonFarm.length/2) { const t = ups[0]; const c = g.upgradeCost(t); if (g.gold >= c) g.upgrade(t); }
        else if (nonFarm.length < 7 + g.waveIdx / 2) { if (placeBest(cycle[cyc % cycle.length])) cyc++; }
        else {
          const b = nonFarm.find((t) => t.level === 3 && !t.branch);
          if (b) { const k = br % 2 ? 'B' : 'A'; if (g.gold >= g.upgradeCost(b, k)) { g.upgrade(b, k); br++; } }
          else if (ups.length) { const t = ups[0]; if (g.gold >= g.upgradeCost(t)) g.upgrade(t); }
          else if (placeBest(cycle[cyc % cycle.length])) cyc++;
        }
      }
    }
    if (g.canCallWave() && (g.enemies.length === 0)) g.startNextWave();
    g.update(DT);
    if (g.lives !== lastL && false) {}
    if (g.lives !== lastL) { leaks[g.waveIdx] = (leaks[g.waveIdx]||0) + (lastL - g.lives); lastL = g.lives; }
  }
  return { level: levelIdx, state: g.state, lives: g.lives, wave: g.waveIdx + '/' + g.totalWaves, gold: g.gold, towers: g.towers.map(t => t.type[0] + t.level + (t.branch||'')).join(' '), mins: (g.time/60).toFixed(1), leaks, lk };
}
const strat = STRAT;
for (const l of LEVELS_TO_RUN) console.log(JSON.stringify(runBot(l, strat)));
`;
const strat = process.argv[2] || 'normal';
const lv = process.argv[3] !== undefined ? [Number(process.argv[3])] : [0, 1, 2];
src = src.replace('STRAT', JSON.stringify(strat)).replace('LEVELS_TO_RUN', JSON.stringify(lv));
const store = {};
const ctx = vm.createContext({ console, performance: { now: () => Date.now() }, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, window: {}, document: {} });
vm.runInContext(src, ctx, { filename: 'sim.js' });
