// Interaction test through the real DOM: node tools/play.js <outdir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const out = process.argv[2];
const assert = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok:', m); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message + e.stack));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(800);
  await p.evaluate(() => localStorage.clear());
  await p.click('#btnPlay', { force: true }); await p.waitForTimeout(700);
  await p.click('.lcard .btn', { force: true }); await p.waitForTimeout(900);
  const G = (f) => p.evaluate(f);
  assert(await G(() => App.screen === 'game' && App.game.levelIdx === 0), 'level 1 started');
  const S = await G(() => { const g = App.game, o = []; for (let y = 120; y < 560; y += 24) for (let x = 60; x < 1100; x += 24) { if (g.canPlace('squirrel', x, y) && Math.min(...g.paths.map(p => p.distTo(x, y))) < 80 && !o.some(q => Math.hypot(q[0]-x, q[1]-y) < 60)) o.push([x, y]); } return o; });
  console.log('spots', S.length);
  // drag from shop card onto map
  const card = await p.$('.card[data-type="squirrel"]'); const cb = await card.boundingBox();
  await p.mouse.move(cb.x + 40, cb.y + 40); await p.mouse.down();
  await p.mouse.move(S[0][0], S[0][1], { steps: 8 }); await p.mouse.up();
  assert(await G(() => App.game.towers.length === 1 && App.game.gold === 200), 'drag-place squirrel (gold 200)');
  // invalid spot (on the road) should not place
  await p.keyboard.press('1'); await p.mouse.move(120, 186); await p.mouse.click(120, 186);
  assert(await G(() => App.game.towers.length === 1), 'cannot place on road');
  await p.keyboard.press('Escape');
  // click-place mortar
  await p.click('.card[data-type="mortar"]', { force: true }); await p.mouse.move(S[1][0], S[1][1]); await p.mouse.click(S[1][0], S[1][1]);
  assert(await G(() => App.game.towers.length === 2), 'click-place mortar');
  // select tower and upgrade via the panel button
  await G(() => { App.game.gold = 2000; });
  await p.mouse.click(S[0][0], S[0][1] - 20); await p.waitForTimeout(250);
  assert(await p.isVisible('#towerPanel'), 'panel opens on tower click');
  await p.click('[data-act="up"]'); await p.waitForTimeout(150);
  await p.click('[data-act="up"]'); await p.waitForTimeout(150);
  assert(await G(() => App.game.towers[0].level === 3), 'upgraded to Lv3 through panel');
  await p.screenshot({ path: `${out}/p-branch.png` });
  await p.click('[data-act="branch"][data-b="A"]'); await p.waitForTimeout(200);
  assert(await G(() => App.game.towers[0].branch === 'A' && App.game.towers[0].target === 'strong'), 'branch A chosen (sniper, targets strong)');
  await p.screenshot({ path: `${out}/p-max.png` });
  await p.click('[data-act="target"][data-mode="first"]');
  assert(await G(() => App.game.towers[0].target === 'first'), 'targeting mode change');
  const before = await G(() => App.game.gold);
  await p.click('[data-act="sell"]'); await p.waitForTimeout(150);
  assert(await G(() => App.game.towers.length === 1), 'sell removes tower');
  assert((await G(() => App.game.gold)) > before, 'sell refunds gold');
  // wave + speed + pause
  await p.click('#btnWave', { force: true });
  assert(await G(() => App.game.waveIdx === 1), 'wave started by button');
  await p.click('#btnSpeed', { force: true });
  assert(await G(() => App.game.speed === 2), 'speed x2');
  await p.keyboard.press('p'); await p.waitForTimeout(200);
  assert(await p.isVisible('#pause'), 'pause menu');
  await p.screenshot({ path: `${out}/p-pause.png` });
  await p.click('#btnResume', { force: true }); await p.waitForTimeout(200);
  assert(!(await p.isVisible('#pause')) && !(await G(() => App.game.paused)), 'resume');
  // fast-forward a full win: give big defense
  await p.evaluate((SPOTS) => {
    const g = App.game; g.gold = 99999;
    const spots = SPOTS;
    for (const [x, y] of spots) { if (!g.canPlace('thunder', x, y)) continue; const t = g.place(['thunder', 'squirrel', 'mortar'][Math.floor(Math.random() * 3)], x, y); if (t) { g.upgrade(t); g.upgrade(t); g.upgrade(t, 'A'); } }
    let n = 0;
    while (g.state === 'play' && n++ < 60 * 60 * 20) { if (g.canCallWave() && g.enemies.length === 0) g.startNextWave(); g.update(DT); }
    for (let i = 0; i < 200; i++) g.update(DT);
  }, S);
  await p.waitForTimeout(1800);
  assert(await p.isVisible('#result'), 'result screen after win');
  await p.screenshot({ path: `${out}/p-win.png` });
  assert(await G(() => JSON.parse(localStorage.getItem('pw-progress'))[0] >= 1), 'progress saved');
  await p.click('#resButtons .btn.green', { force: true }); await p.waitForTimeout(1000);
  assert(await G(() => App.game.levelIdx === 1 && App.screen === 'game'), 'next level from result');
  // lose flow
  await G(() => { const g = App.game; g.startNextWave(); g.lives = 1; for (let i = 0; i < 60 * 60 && g.state === 'play'; i++) g.update(DT); for (let i = 0; i < 120; i++) g.update(DT); });
  await p.waitForTimeout(800);
  assert(await G(() => App.game.state === 'lost') && await p.isVisible('#result'), 'lose flow shows result');
  await p.screenshot({ path: `${out}/p-lose.png` });
  await p.click('#resButtons .btn.cream', { force: true }); await p.waitForTimeout(1000);
  assert(await p.isVisible('#levels'), 'back to level select');
  await p.screenshot({ path: `${out}/p-levels2.png` });
  console.log('page errors:', errs.length, errs.slice(0, 3).join('\n'));
  await b.close();
})();
