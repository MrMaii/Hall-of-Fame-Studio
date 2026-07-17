import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const validatorSource = readFileSync(new URL('../scripts/validate-manager-backend-core-ui.mjs', import.meta.url), 'utf8');
const advancedViewSource = readFileSync(new URL('../src/project/ProjectDashboardAdvancedView.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');

test('complete Dashboard validation covers compact computers and high display scaling', () => {
  for (const contract of [
    'const DASHBOARD_RESPONSIVE_VIEWPORTS = [',
    '{ width: 1440, height: 1100 }',
    '{ width: 1280, height: 720 }',
    '{ width: 1024, height: 768 }',
    '{ width: 960, height: 540 }',
    'async function assertDashboardResponsive(page)',
    "page.getByTestId('project-dashboard-view')",
    "page.getByTestId('project-overview')",
    'overview.scrollWidth - overview.clientWidth',
    'getComputedStyle(overview).overflowX',
    "['hidden', 'clip'].includes(metrics.overviewOverflowMode)",
    'document.body.scrollWidth - document.body.clientWidth',
    'await page.setViewportSize(viewport);',
    'await assertDashboardResponsive(page);',
    'await page.setViewportSize(VIEWPORT);',
  ]) {
    assert.ok(validatorSource.includes(contract), `complete Dashboard responsive validation is missing: ${contract}`);
  }
});

test('complete Dashboard keeps its original structure while using compact responsive spacing', () => {
  assert.ok(advancedViewSource.includes('data-testid="project-overview" className="relative z-10 h-full overflow-x-hidden overflow-y-auto p-3 md:p-6 xl:p-12"'));
  assert.ok(contentLayoutSource.includes('className="project-paper min-w-0 w-full border border-[#7b6542] p-4 md:p-6 xl:p-10 grid grid-cols-12 gap-4 md:gap-6 xl:gap-8 min-h-[calc(100vh-96px)]"'));
  assert.ok(advancedViewSource.includes('data-testid="project-dashboard-view" className="project-room relative flex-1 overflow-hidden text-[#251b13]"'));
});
