import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localIdempotentExecution.test.mjs',
  'tests/localIdempotentExecutionApi.test.mjs',
  'tests/localProviderIdempotency.test.mjs',
  'tests/localDurableTaskQueue.test.mjs',
  'tests/modelProvider.test.mjs',
  'tests/searchProvider.test.mjs',
  'tests/localProviderBudgetReservation.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local idempotent execution validation passed.');
