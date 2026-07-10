import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalRecoveryBundle, restoreLocalRecoveryBundle } from '../src/agents/localRecoveryBundle.js';

test('creates an encrypted local recovery bundle and restores verified files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-recovery-'));
  try {
    const source = join(directory, 'source');
    const backups = join(directory, 'backups');
    const restored = join(directory, 'restored');
    mkdirSync(join(source, 'runtime', 'artifacts'), { recursive: true });
    writeFileSync(join(source, 'projects.json'), '{"projects":["private-project"]}', 'utf8');
    writeFileSync(join(source, 'auth.json'), '{"users":["owner"]}', 'utf8');
    writeFileSync(join(source, 'runtime', 'artifacts', 'deliverable.txt'), 'local private deliverable', 'utf8');

    const backup = createLocalRecoveryBundle({
      backupDirectory: backups,
      passphrase: 'local recovery passphrase',
      sources: [
        { key: 'project-store', path: join(source, 'projects.json'), kind: 'file', required: true },
        { key: 'local-auth', path: join(source, 'auth.json'), kind: 'file', required: true },
        { key: 'project-runtime', path: join(source, 'runtime'), kind: 'directory', required: true },
      ],
      now: '2026-07-09T12:00:00.000Z',
    });
    assert.equal(backup.schemaVersion, 'local-recovery-bundle/v1');
    assert.equal(backup.entryCount, 3);
    assert.ok(readFileSync(backup.bundlePath, 'utf8').includes('private-project') === false);

    const recovered = restoreLocalRecoveryBundle({
      bundlePath: backup.bundlePath,
      passphrase: 'local recovery passphrase',
      destinations: {
        'project-store': join(restored, 'projects.json'),
        'local-auth': join(restored, 'auth.json'),
        'project-runtime': join(restored, 'runtime'),
      },
    });
    assert.equal(recovered.entryCount, 3);
    assert.equal(readFileSync(join(restored, 'projects.json'), 'utf8'), '{"projects":["private-project"]}');
    assert.equal(readFileSync(join(restored, 'runtime', 'artifacts', 'deliverable.txt'), 'utf8'), 'local private deliverable');
    assert.throws(() => restoreLocalRecoveryBundle({
      bundlePath: backup.bundlePath,
      passphrase: 'wrong passphrase',
      destinations: {},
    }), /local-recovery-passphrase-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
