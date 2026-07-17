import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('isolated startup verification does not overwrite the active local runtime status', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-startup-isolation-'));
  const activeStatusPath = join(directory, 'active-runtime-status.json');
  const activeStatus = '{"schemaVersion":"local-runtime-status/v1","marker":"active-user-runtime"}\n';
  writeFileSync(activeStatusPath, activeStatus, 'utf8');

  try {
    const result = spawnSync(process.execPath, ['scripts/validate-local-dev-startup.mjs'], {
      cwd: resolve(fileURLToPath(new URL('..', import.meta.url))),
      env: {
        ...process.env,
        AGENT_LOCAL_RUNTIME_STATUS_FILE: activeStatusPath,
      },
      encoding: 'utf8',
      timeout: 40_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(activeStatusPath, 'utf8'), activeStatus);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
