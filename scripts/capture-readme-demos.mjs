/**
 * Capture README demo screenshots from the running Vite dev server.
 * Usage: npm run dev (separate terminal) && node scripts/capture-readme-demos.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'assets');
const BASE = process.env.DEMO_BASE_URL || 'http://localhost:5173';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log('saved', file);
  return file;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await wait(1200);

    // Demo 1: Dashboard overview
    await shot(page, 'demo-dashboard');

    // Talent Market
    await page.getByRole('button', { name: /Talent Market/i }).click();
    await wait(1800);
    await shot(page, 'demo-pantheon');

    // Open first dossier card
    const dossierCard = page.locator('.dossier-card').first();
    if (await dossierCard.count()) {
      await dossierCard.click();
      await wait(2500);
      await shot(page, 'demo-dossier');
    }

    // Initiation flow (return to dashboard first)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await wait(1000);
    await page.getByRole('button', { name: /Start Initiation Mandatory/i }).click();
    await wait(1500);
    await shot(page, 'demo-kickoff');

    // Try war room if there's a start meeting button
    const startMeeting = page.getByRole('button', { name: /Start Roundtable|Begin Roundtable|开始圆桌|Enter War Room|War Room/i }).first();
    if (await startMeeting.count()) {
      await startMeeting.click();
      await wait(2500);
      await shot(page, 'demo-warroom');
    }

    // Manager Demo
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await wait(1000);
    await page.getByTestId('workspace-open-advanced').click();
    await page.getByTestId('manager-demo-tools').click();
    await page.getByRole('button', { name: /Load Sample Fixture/i }).click();
    await wait(3500);
    await shot(page, 'demo-manager');

    // Project workspace tabs
    const tabLabels = [/Dashboard/i, /Chat/i, /Timeline/i, /Meeting/i];
    for (let i = 0; i < tabLabels.length; i++) {
      const tab = page.getByRole('button', { name: tabLabels[i] }).first();
      if (await tab.count()) {
        await tab.click();
        await wait(1500);
        await shot(page, `demo-workspace-${i + 1}`);
      }
    }
    await shot(page, 'demo-workspace');

    console.log('Capture complete.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
