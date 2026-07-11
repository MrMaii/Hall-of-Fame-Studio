import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverScript = readFileSync(resolve(repoRoot, 'scripts/agent-project-server.mjs'), 'utf8');
if (!serverScript.includes('if (shutdownPromise) return shutdownPromise')
  || !serverScript.includes('process.exit(result.complete ? 0 : 1)')) {
  throw new Error('Local process signal shutdown must remain single-flight and truthful.');
}
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localGracefulShutdownReceipt.test.mjs',
  'tests/localSchedulerShutdown.test.mjs',
  'tests/localTimeoutCancellationApi.test.mjs',
  'tests/localDurableTaskQueue.test.mjs',
  'tests/localIdempotentExecution.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local graceful shutdown validation passed.');
