const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8123/tools/gallery.html'); await p.waitForTimeout(500);
await p.screenshot({ path: process.argv[2] }); await b.close(); })();
