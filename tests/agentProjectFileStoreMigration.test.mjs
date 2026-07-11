import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import { createAgentProjectFileStore, rollbackAgentProjectFileStoreMigration } from '../src/agents/agentProjectFileStore.js';

const journalChecksum = (journal) => {
  const { checksum: _checksum, ...base } = journal;
  return createHash('sha256').update(JSON.stringify(base)).digest('hex');
};

const writeJournal = (path, journal) => {
  const base = { ...journal };
  delete base.checksum;
  writeFileSync(path, JSON.stringify({ ...base, checksum: journalChecksum(base) }, null, 2));
};

test('migrates a version-one snapshot to the current local store version without losing its project', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-migration-'));
  const filePath = join(directory, 'projects.json');
  try {
    const sourceBytes = JSON.stringify({
      version: 1,
      projects: [{ id: 'project_v1', name: 'Version one project' }],
      messages: [],
      kickoffMeetings: [],
      securityAccessAuditRecords: [],
      accessReplayRecords: [],
    }, null, 2);
    writeFileSync(filePath, sourceBytes, 'utf8');

    const store = createAgentProjectFileStore({ filePath });

    assert.equal(store.getProject('project_v1').name, 'Version one project');
    assert.equal(store.integrity.status, 'migrated');
    assert.equal(store.integrity.migratedFromVersion, 1);
    assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).version, 2);
    assert.equal(store.integrity.migrationTransaction.status, 'committed');
    assert.equal(store.integrity.migrationTransaction.sourceVersion, 1);
    assert.equal(store.integrity.migrationTransaction.targetVersion, 2);
    assert.equal(store.integrity.migrationTransaction.targetVerified, true);
    assert.match(store.integrity.migrationTransaction.id, /^migration_[a-f0-9]{24}$/);
    assert.equal(existsSync(store.integrity.migrationTransaction.sourceArchivePath), true);
    assert.equal(readFileSync(store.integrity.migrationTransaction.sourceArchivePath, 'utf8'), sourceBytes);
    assert.match(store.integrity.migrationTransaction.rollbackCommand, /--execute --migration-id/);
    const archiveBytes = readFileSync(store.integrity.migrationTransaction.sourceArchivePath, 'utf8');
    store.saveProject({ id: 'project_v2', name: 'Written after migration' });
    assert.equal(readFileSync(store.integrity.migrationTransaction.sourceArchivePath, 'utf8'), archiveBytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('fails closed on a snapshot newer than the local migration registry', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-future-version-'));
  const filePath = join(directory, 'projects.json');
  try {
    const future = JSON.stringify({ version: 999, projects: [] });
    writeFileSync(filePath, future, 'utf8');

    assert.throws(() => createAgentProjectFileStore({ filePath }), /agent-project-store-version-unsupported/);
    assert.equal(readFileSync(filePath, 'utf8'), future);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('idempotently recovers prepared migration journals before and after target replacement', () => {
  for (const phase of ['before-target-replacement', 'after-target-replacement']) {
    const directory = mkdtempSync(join(tmpdir(), `hofs-project-store-migration-${phase}-`));
    const filePath = join(directory, 'projects.json');
    try {
      const sourceBytes = JSON.stringify({ version: 1, projects: [{ id: 'recover', name: phase }], messages: [], kickoffMeetings: [], securityAccessAuditRecords: [], accessReplayRecords: [] }, null, 2);
      writeFileSync(filePath, sourceBytes);
      const first = createAgentProjectFileStore({ filePath });
      const transactionId = first.integrity.migrationTransaction.id;
      const journalPath = `${filePath}.migration.json`;
      const committed = JSON.parse(readFileSync(journalPath, 'utf8'));
      writeJournal(journalPath, { ...committed, status: 'prepared', targetVerified: false, committedAt: null });
      if (phase === 'before-target-replacement') writeFileSync(filePath, sourceBytes);

      const recovered = createAgentProjectFileStore({ filePath });
      assert.equal(recovered.getProject('recover').name, phase);
      assert.equal(recovered.integrity.migrationTransaction.id, transactionId);
      assert.equal(recovered.integrity.migrationTransaction.status, 'committed');
      assert.equal(recovered.integrity.migrationTransaction.targetVerified, true);
      assert.equal(JSON.parse(readFileSync(filePath, 'utf8')).version, 2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('fails closed without replacing evidence when migration journal or source archive is tampered', () => {
  for (const target of ['journal', 'archive']) {
    const directory = mkdtempSync(join(tmpdir(), `hofs-project-store-migration-tamper-${target}-`));
    const filePath = join(directory, 'projects.json');
    try {
      const sourceBytes = JSON.stringify({ version: 1, projects: [{ id: 'safe', name: 'Keep me' }], messages: [], kickoffMeetings: [], securityAccessAuditRecords: [], accessReplayRecords: [] }, null, 2);
      writeFileSync(filePath, sourceBytes);
      const first = createAgentProjectFileStore({ filePath });
      const journalPath = `${filePath}.migration.json`;
      const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
      if (target === 'journal') {
        writeFileSync(journalPath, JSON.stringify({ ...journal, status: 'forged' }));
      } else {
        writeFileSync(filePath, sourceBytes);
        writeJournal(journalPath, { ...journal, status: 'prepared', targetVerified: false, committedAt: null });
        writeFileSync(journal.sourceArchivePath, 'forged source archive');
      }
      const primaryBefore = readFileSync(filePath, 'utf8');
      assert.throws(() => createAgentProjectFileStore({ filePath }), target === 'journal' ? /migration-journal-invalid/ : /migration-archive-invalid/);
      assert.equal(readFileSync(filePath, 'utf8'), primaryBefore);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test('explicitly rolls the current snapshot down while preserving post-migration project data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-project-store-migration-rollback-'));
  const filePath = join(directory, 'projects.json');
  try {
    writeFileSync(filePath, JSON.stringify({ version: 1, projects: [{ id: 'before', name: 'Before migration' }], messages: [], kickoffMeetings: [], securityAccessAuditRecords: [], accessReplayRecords: [] }, null, 2));
    const store = createAgentProjectFileStore({ filePath });
    const migrationId = store.integrity.migrationTransaction.id;
    store.saveProject({ id: 'after', name: 'After migration' });
    const dryRun = spawnSync(process.execPath, ['scripts/rollback-agent-project-store-migration.mjs', '--store', filePath], { cwd: process.cwd(), encoding: 'utf8', windowsHide: true });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(JSON.parse(dryRun.stdout).rollbackReady, true);
    assert.equal(JSON.parse(dryRun.stdout).mode, 'dry-run');
    assert.throws(() => rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId: 'wrong-id' }), /migration-id-mismatch/);

    const result = rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId: migrationId, now: '2026-07-11T20:00:00.000Z' });
    assert.equal(result.status, 'rolled-back');
    assert.equal(result.sourceVersion, 1);
    assert.equal(result.rollbackVerified, true);
    assert.equal(existsSync(result.rollbackArchivePath), true);
    const rolledBack = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(rolledBack.version, 1);
    assert.deepEqual(rolledBack.projects.map((project) => project.id).sort(), ['after', 'before']);
    assert.equal(JSON.parse(readFileSync(result.rollbackArchivePath, 'utf8')).version, 2);
    assert.equal(JSON.parse(readFileSync(`${filePath}.migration.json`, 'utf8')).status, 'rolled-back');
    assert.throws(() => rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId: migrationId }), /migration-not-committed/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
