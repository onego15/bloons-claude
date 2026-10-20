const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(700);
  await p.evaluate(() => App.startLevel(0)); await p.waitForTimeout(800);
  const shots = [['mortar', 'A', 'kab', 4], ['thunder', 'A', 'bolt', 1], ['thunder', 'B', 'kab', 4], ['frost', 'A', 'ring', 2], ['squirrel', 'A', 'tracer', 1], ['mortar', 'B', 'kab', 6]];
  for (const [t, br, kind, extra] of shots) {
    const box = await p.evaluate(([t, br, kind, extra]) => {
      const g = App.game; g.gold = 99999; g.towers = []; g.enemies = []; g.fx = []; g.projs = [];
      const tw = g.place(t, 440, 400); g.upgrade(tw); g.upgrade(tw); g.upgrade(tw, br); tw.upT = 9; tw.born = 9;
      for (let i = 0; i < 8; i++) { const e = g.spawnEnemy(i % 2 ? 'shell' : 'gloomlet', 0, 3, 700 + i * 22); }
      g.paused = true;
      let n = 0;
      while (n++ < 600) { g.update(DT); if (g.fx.some(f => f.k === kind)) break; }
      for (let i = 0; i < extra; i++) g.update(DT);
      const f = g.fx.find(f => f.k === kind) || { x: 440, y: 400 };
      const x = f.x !== undefined ? f.x : (f.pts ? f.pts[0][0] : 440), y = f.y !== undefined ? f.y : (f.pts ? f.pts[0][1] : 400);
      return { x: Math.max(0, Math.min(1280 - 400, x - 200)), y: Math.max(0, Math.min(720 - 260, y - 150)) };
    }, [t, br, kind, extra]);
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${out}/fx-${t}${br}.png`, clip: { x: box.x, y: box.y, width: 400, height: 260 } });
  }
  await b.close();
})();
