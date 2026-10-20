const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(700);
  await p.evaluate(() => App.startLevel(2)); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    Sound.init(); for (const n of ['shoot','sniper','mortar','boom','zap','thunder','frost','blizzard','hit','pop','bigpop','coin','build','upgrade','sell','leak','wave','boss','heal','click','error','win','lose','star']) Sound.play(n);
    const g = App.game; g.gold = 1e6;
    let placed = 0;
    for (let y = 100; y < 600 && placed < 26; y += 40) for (let x = 60; x < 1200 && placed < 26; x += 50) { const t = ['squirrel','mortar','frost','thunder'][placed % 4]; if (g.canPlace(t, x, y) && Math.min(...g.paths.map(p=>p.distTo(x,y))) < 120) { const tw = g.place(t, x, y); g.upgrade(tw); g.upgrade(tw); g.upgrade(tw, placed % 8 < 4 ? 'A' : 'B'); placed++; } }
    for (let i = 0; i < 160; i++) g.spawnEnemy(['gloomlet','shell','moth','wisp','bubble'][i % 5], i % 2, 30, 100 + i * 9);
    const t0 = performance.now(); for (let i = 0; i < 120; i++) g.update(DT); const tu = (performance.now() - t0) / 120;
    const ctx = App.ctx; App.ensureBg();
    const t1 = performance.now(); for (let i = 0; i < 60; i++) g.render(ctx, App.bg); const tr = (performance.now() - t1) / 60;
    return { towers: g.towers.length, enemies: g.enemies.length, fx: g.fx.length, updateMs: tu.toFixed(2), renderMs: tr.toFixed(2), audio: Sound.ctx && Sound.ctx.state };
  });
  console.log(r);
  await b.close();
})();
