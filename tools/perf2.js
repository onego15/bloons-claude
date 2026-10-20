const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: process.argv[2] === 'gpu' ? ['--enable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] }); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(700);
  await p.evaluate(() => App.startLevel(2)); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const g = App.game; g.gold = 1e6;
    let placed = 0;
    for (let y = 100; y < 600 && placed < 26; y += 40) for (let x = 60; x < 1200 && placed < 26; x += 50) { const t = ['squirrel','mortar','frost','thunder'][placed % 4]; if (g.canPlace(t, x, y) && Math.min(...g.paths.map(p=>p.distTo(x,y))) < 120) { const tw = g.place(t, x, y); g.upgrade(tw); g.upgrade(tw); g.upgrade(tw, placed % 8 < 4 ? 'A' : 'B'); placed++; } }
    for (let i = 0; i < 160; i++) g.spawnEnemy(['gloomlet','shell','moth','wisp','bubble'][i % 5], i % 2, 30, 100 + i * 9);
    for (let i = 0; i < 120; i++) g.update(DT);
    const ctx = App.ctx; App.ensureBg();
    const time = (f, n = 30) => { const t = performance.now(); for (let i = 0; i < n; i++) f(); ctx.getImageData(0,0,1,1); return ((performance.now() - t) / n).toFixed(2); };
    const res = {};
    res.bg = time(() => ctx.drawImage(App.bg, 0, 0, W, H));
    res.towers = time(() => { for (const tw of g.towers) g.drawTower(ctx, tw, g.time); });
    res.enemies = time(() => { for (const e of g.enemies) g.drawEnemy(ctx, e, g.time); });
    res.fx = time(() => g.drawFx(ctx, g.time));
    res.full = time(() => g.render(ctx, App.bg));
    res.n = [g.towers.length, g.enemies.length, g.fx.length];
    return res;
  });
  console.log(r);
  await b.close();
})();
