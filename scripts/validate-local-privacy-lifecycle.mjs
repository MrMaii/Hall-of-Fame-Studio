import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/localPrivacyLifecycle.test.mjs',
  'tests/localPrivacyLifecycleApi.test.mjs',
  'tests/localPrivacyExport.test.mjs',
  'tests/localPrivacyDeletionRequest.test.mjs',
  'tests/localPrivacyDeletionExecution.test.mjs',
  'tests/localArtifactContentAddressing.test.mjs',
  'tests/localActionApproval.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local privacy lifecycle validation passed.');
