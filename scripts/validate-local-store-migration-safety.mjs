import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [
  '--test',
  'tests/agentProjectFileStoreMigration.test.mjs',
  'tests/agentProjectFileStoreRecovery.test.mjs',
  'tests/atomicFileReplace.test.mjs',
], { cwd: repoRoot, stdio: 'inherit', windowsHide: true });

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('Local store migration safety validation passed.');
