// Screenshot an html file to PNG with Playwright.
//   node scripts/pose-shot.cjs /abs/path/sheet.html out.png [width=1500]
// Playwright is NOT a dependency of this repo: resolve it from another checkout with NODE_PATH, and set
// CHROMIUM_PATH to a Chromium / headless-shell binary if Playwright's own download is not installed.
const { chromium } = require('playwright');
(async () => {
  const [,, html, png, width] = process.argv;
  if (!html || !png) { console.error('usage: pose-shot.cjs <abs html path> <out.png> [width]'); process.exit(2); }
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: +(width || 1500), height: 900 } });
  await p.goto('file://' + html);
  await p.screenshot({ path: png, fullPage: true });
  await b.close();
})();
