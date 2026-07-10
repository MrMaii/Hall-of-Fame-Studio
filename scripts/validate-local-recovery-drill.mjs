import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const directory = mkdtempSync(join(tmpdir(), 'hofs-local-recovery-drill-'));
const sourceRoot = join(directory, 'runtime');
const projectStore = join(directory, 'projects.json');
const authStore = join(directory, 'auth.json');
const vaultStore = join(directory, 'vault.json');
const auditStore = join(directory, 'security-audit.jsonl');
const runtimeSettingsStore = join(directory, 'runtime-settings.json');
const telemetryStore = join(directory, 'telemetry.jsonl');
const backupDirectory = join(directory, 'backups');
const env = {
  ...process.env,
  AGENT_PROJECT_STORE: projectStore,
  AGENT_LOCAL_AUTH_STORE: authStore,
  AGENT_SECURITY_AUDIT_LOG: auditStore,
  SECRET_VAULT_RECORDS_FILE: vaultStore,
  AGENT_LOCAL_RUNTIME_SETTINGS_FILE: runtimeSettingsStore,
  AGENT_LOCAL_TELEMETRY_LOG: telemetryStore,
  AGENT_PROJECT_RUNTIME_ROOT: sourceRoot,
  HOFS_LOCAL_RECOVERY_BACKUP_DIR: backupDirectory,
  HOFS_LOCAL_RECOVERY_PASSPHRASE: 'local recovery drill passphrase',
};

try {
  mkdirSync(join(sourceRoot, 'artifact'), { recursive: true });
  writeFileSync(projectStore, '{"project":"before-loss"}', 'utf8');
  writeFileSync(authStore, '{"user":"owner"}', 'utf8');
  writeFileSync(vaultStore, '{"vault":"ciphertext-only"}', 'utf8');
  writeFileSync(runtimeSettingsStore, '{"keyId":"local-user"}', 'utf8');
  writeFileSync(telemetryStore, '{"event":"runtime-start"}\n', 'utf8');
  writeFileSync(join(sourceRoot, 'artifact', 'proof.txt'), 'proof before loss', 'utf8');
  const backup = spawnSync(process.execPath, ['scripts/create-local-recovery-backup.mjs'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(backup.status, 0, backup.stderr || backup.stdout);
  const backupResult = JSON.parse(backup.stdout);
  writeFileSync(projectStore, '{"project":"corrupted"}', 'utf8');
  writeFileSync(join(sourceRoot, 'artifact', 'proof.txt'), 'corrupted proof', 'utf8');
  const restore = spawnSync(process.execPath, ['scripts/restore-local-recovery-backup.mjs'], {
    cwd: root,
    env: {
      ...env,
      HOFS_LOCAL_RECOVERY_BUNDLE: backupResult.bundlePath,
      HOFS_LOCAL_RECOVERY_CONFIRM: 'RESTORE_LOCAL_RUNTIME',
    },
    encoding: 'utf8',
  });
  assert.equal(restore.status, 0, restore.stderr || restore.stdout);
  assert.equal(readFileSync(projectStore, 'utf8'), '{"project":"before-loss"}');
  assert.equal(readFileSync(join(sourceRoot, 'artifact', 'proof.txt'), 'utf8'), 'proof before loss');
  console.log('Local recovery backup and restore drill passed.');
} finally {
  rmSync(directory, { recursive: true, force: true });
}
