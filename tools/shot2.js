// Action screenshots: node tools/shot2.js <outdir> <level> <wave>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const out = process.argv[2] || 'shots'; const lvl = Number(process.argv[3] || 2); const wave = Number(process.argv[4] || 10);
const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message + '\n' + e.stack));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/index.html');
  await p.waitForTimeout(800);
  await p.evaluate(([lvl, st]) => { window.SIMT = st; App.startLevel(lvl); }, [lvl, Number(process.argv[5] || 9)]);
  await p.waitForTimeout(900);
  await p.evaluate(([wave]) => {
    const g = App.game; g.gold = 99999;
    const cands = [];
    for (let x = 30; x < W - 30; x += 16) for (let y = 50; y < H - 20; y += 16) {
      if (!g.canPlace('squirrel', x, y)) continue;
      let cov = 0;
      for (const p of g.paths) for (let d = 0; d < p.length; d += 10) { const q = p.at(d); if (dist2(q.x, q.y, x, y) < 140 * 140) cov++; }
      cands.push({ x, y, cov });
    }
    cands.sort((a, b) => b.cov - a.cov);
    const plan = [['squirrel', 'A'], ['mortar', 'A'], ['frost', 'A'], ['thunder', 'A'], ['squirrel', 'B'], ['mortar', 'B'], ['frost', 'B'], ['thunder', 'B'], ['squirrel', null], ['mortar', null], ['frost', null], ['thunder', null], ['farm', null]];
    for (const [t, br] of plan) {
      const c = cands.find((c) => g.canPlace(t, c.x, c.y));
      if (!c) continue;
      const tw = g.place(t, c.x, c.y);
      if (br) { g.upgrade(tw); g.upgrade(tw); g.upgrade(tw, br); } else if (Math.random() < 0.5) g.upgrade(tw);
    }
    g.waveIdx = wave - 1;
    g.startNextWave();
    for (let i = 0; i < 60 * (window.SIMT||9); i++) g.update(DT);
    g.paused = true;
  }, [wave]);
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => { const g = App.game; for (let i = 0; i < 9; i++) g.update(DT); });
    await p.waitForTimeout(80);
    await p.screenshot({ path: `${out}/act-${lvl}-${i}.png` });
  }
  fs.writeFileSync(`${out}/errors2.txt`, errs.join('\n'));
  console.log('errors:', errs.length, errs.slice(0, 5).join('\n'));
  await b.close();
})();
