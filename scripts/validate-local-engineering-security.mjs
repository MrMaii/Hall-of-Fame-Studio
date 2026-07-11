import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localEngineeringSecurity.test.mjs',
  'tests/localEngineeringSecurityApi.test.mjs',
  'tests/localTechnicalDelivery.test.mjs',
  'tests/localTechnicalDeliveryApi.test.mjs',
], {
  cwd: repoRoot,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local engineering security validation passed.');
