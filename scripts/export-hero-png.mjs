import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const svgPath = `file:///${path.join(ROOT, 'docs', 'assets', 'hero-banner.svg').replace(/\\/g, '/')}`;
  await page.goto(svgPath, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(ROOT, 'docs', 'assets', 'hero-banner.png'),
    timeout: 10000,
  });
  await browser.close();
  console.log('Hero PNG exported.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
