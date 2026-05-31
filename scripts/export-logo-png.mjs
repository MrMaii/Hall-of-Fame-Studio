import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const svgPath = `file:///${path.join(ROOT, 'public', 'hall-of-fame-studio-logo.svg').replace(/\\/g, '/')}`;
  await page.goto(svgPath);
  await page.screenshot({
    path: path.join(ROOT, 'public', 'hall-of-fame-studio-logo.png'),
    omitBackground: false,
  });
  await page.screenshot({
    path: path.join(ROOT, 'docs', 'assets', 'logo-mark.png'),
    omitBackground: false,
  });
  await browser.close();
  console.log('Logo PNG exported.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
