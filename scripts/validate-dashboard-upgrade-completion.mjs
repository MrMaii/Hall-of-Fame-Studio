import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

run('Dashboard responsibility contracts', [
  '--test',
  'tests/projectDashboardAdvancedViewUiContract.test.mjs',
  'tests/projectDashboardContentLayoutUiContract.test.mjs',
  'tests/projectDashboardToolLauncherUiContract.test.mjs',
  'tests/managerDashboardResponsiveUiContract.test.mjs',
]);
run('Production build', ['node_modules/vite/bin/vite.js', 'build']);
run('Current local product release contract', ['scripts/validate-current-local-product-release.mjs']);
run('Frontend bundle budget', ['scripts/validate-frontend-bundle.mjs']);

console.log('Dashboard upgrade completion check passed.');
