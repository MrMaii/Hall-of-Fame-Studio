import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localTaskTraceChain.test.mjs',
  'tests/localTraceGraph.test.mjs',
  'tests/localTelemetryHttpServer.test.mjs',
  'tests/localDurableTaskQueue.test.mjs',
  'tests/localProviderIdempotency.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local causal request tracing validation passed.');
