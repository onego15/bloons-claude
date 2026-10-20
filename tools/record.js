// Records gameplay frames for the README GIF: node tools/record.js <outdir>
// The sim is stepped manually (4 ticks = 1/15 s per frame) so the clip plays at real speed.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const out = process.argv[2] || 'frames'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:8123/index.html');
  await p.evaluate(() => { localStorage.setItem('pw-tutorial', 'true'); localStorage.setItem('pw-seen', JSON.stringify(Object.keys(ENEMIES))); });
  await p.reload(); await p.waitForTimeout(800);
  await p.evaluate(() => App.startLevel(1));
  await p.waitForTimeout(1500);
  const spots = await p.evaluate(() => {
    const g = App.game; g.gold = 99999;
    const cands = [];
    for (let x = 60; x < W - 60; x += 16) for (let y = 110; y < H - 130; y += 16) {
      if (!g.canPlace('mortar', x, y)) continue;
      let cov = 0;
      for (const pa of g.paths) for (let d = 0; d < pa.length; d += 10) { const q = pa.at(d); if (dist2(q.x, q.y, x, y) < 130 * 130) cov++; }
      cands.push({ x, y, cov });
    }
    cands.sort((a, b) => b.cov - a.cov);
    const pick = []; for (const c of cands) if (pick.every((q) => dist2(q.x, q.y, c.x, c.y) > 110 * 110)) pick.push(c);
    const plan = [['squirrel', 3], ['frost', 2], ['thunder', 3], ['mortar', 2], ['squirrel', 2], ['thunder', 1], ['frost', 1]];
    plan.forEach(([t, lv], i) => { const c = pick[i + 1]; const tw = g.place(t, c.x, c.y); for (let k = 0; k < lv; k++) g.upgrade(tw); });
    g.waveIdx = 9; g.gold = 900;
    g.paused = true;
    return [pick[0]];
  });
  let n = 0;
  const step = async (ticks = 4) => {
    await p.evaluate((t) => { const g = App.game; for (let i = 0; i < t; i++) g.update(DT); g.updateAmbient(t * DT); }, ticks);
    await p.waitForTimeout(40);
    await p.screenshot({ path: `${out}/f${String(n++).padStart(4, '0')}.png` });
  };
  // start the wave, let enemies walk in
  await p.evaluate(() => { const g = App.game; g.startNextWave(); for (let i = 0; i < 60 * 9; i++) g.update(DT); });
  for (let i = 0; i < 30; i++) await step();
  // place a mortar with the ghost sliding toward the spot
  const s = spots[0];
  await p.evaluate(() => { const g = App.game; g.placing = 'mortar'; UI.setPlacing('mortar'); });
  await p.mouse.move(s.x - 160, s.y + 90);
  for (let i = 0; i <= 12; i++) { const t = i / 12; await p.mouse.move(s.x - 160 * (1 - t), s.y + 90 * (1 - t)); await step(); }
  await p.evaluate((s) => App.tryPlace(s), s);
  for (let i = 0; i < 45; i++) await step();
  // open the upgrade panel on the new mortar and upgrade it twice
  await p.evaluate((s) => App.select(App.game.towerAt(s.x, s.y)), s);
  for (let i = 0; i < 8; i++) await step();
  for (let k = 0; k < 2; k++) {
    await p.evaluate(() => { const g = App.game; g.upgrade(g.selected); UI.renderPanel(); });
    for (let i = 0; i < 8; i++) await step();
  }
  await p.evaluate(() => App.select(null));
  await p.mouse.move(1270, 700);
  for (let i = 0; i < 60; i++) await step();
  console.log('frames', n);
  await b.close();
})();
