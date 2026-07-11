import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localWorkspaceCommandCancellation.test.mjs',
  'tests/localTimeoutCancellationApi.test.mjs',
  'tests/localDurableTaskQueue.test.mjs',
  'tests/localDurableTaskQueueApi.test.mjs',
  'tests/localAutopilotCancellation.test.mjs',
  'tests/localIdempotentExecution.test.mjs',
  'tests/localProviderIdempotency.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local timeout and cancellation validation passed.');
