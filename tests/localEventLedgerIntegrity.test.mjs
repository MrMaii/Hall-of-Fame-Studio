import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendProjectEvents,
  createProjectLedgerEvent,
  EVENT_LEDGER_RETAINED_LIMIT,
  sealLegacyProjectEventLedger,
  summarizeProjectEventLedger,
  verifyProjectEventLedger,
} from '../src/agents/agentRuntime.js';

function event(id, sequence = undefined) {
  return createProjectLedgerEvent({
    id,
    type: 'test-event',
    time: '2026-07-11T12:00:00.000Z',
    actor: 'test-runtime',
    summary: `event ${id}`,
    source: 'test',
    ...(sequence ? { sequence } : {}),
  });
}

test('project event ledger seals content and fails closed after mutation', () => {
  const project = appendProjectEvents({ id: 'project_event_integrity' }, [event('evt_1'), event('evt_2')]);
  const verification = verifyProjectEventLedger(project);
  assert.equal(verification.valid, true);
  assert.match(project.eventLedger[0].eventChecksum, /^[a-f0-9]{64}$/);
  assert.equal(project.eventLedger[1].previousEventHash, project.eventLedger[0].eventHash);
  assert.equal(project.eventLedgerRootHash, project.eventLedger[1].eventHash);
  assert.equal(summarizeProjectEventLedger(project).contiguous, true);

  const corrupted = structuredClone(project);
  corrupted.eventLedger[0].summary = 'mutated after persistence';
  const corruptedVerification = verifyProjectEventLedger(corrupted);
  assert.equal(corruptedVerification.valid, false);
  assert.ok(corruptedVerification.findings.some((finding) => finding.code === 'event-checksum-mismatch'));
  assert.equal(summarizeProjectEventLedger(corrupted).contiguous, false);
  assert.throws(() => appendProjectEvents(corrupted, [event('evt_3')]), /project-event-ledger-integrity-invalid/);
});

test('legacy ledgers migrate once and chain-versioned corruption is never resealed', () => {
  const legacy = {
    id: 'project_legacy_event_integrity',
    eventLedger: [{ ...event('legacy_1'), sequence: 7, projectId: 'project_legacy_event_integrity' }],
    eventLedgerLastSequence: 7,
  };
  const migrated = sealLegacyProjectEventLedger(legacy);
  assert.equal(verifyProjectEventLedger(migrated).valid, true);
  assert.equal(sealLegacyProjectEventLedger(migrated), migrated);

  const corrupted = structuredClone(migrated);
  corrupted.eventLedger[0].payload = { changed: true };
  assert.equal(sealLegacyProjectEventLedger(corrupted), corrupted);
  assert.equal(verifyProjectEventLedger(corrupted).valid, false);
});

test('sealed events detach nested payloads from mutable business objects', () => {
  const mutable = { revision: { updatedAt: '2026-07-11T12:00:00.000Z' } };
  const project = appendProjectEvents({ id: 'project_event_alias' }, [createProjectLedgerEvent({
    id: 'evt_alias', type: 'alias-test', time: '2026-07-11T12:00:00.000Z', actor: 'test-runtime',
    summary: 'nested payload alias', source: 'test', payload: mutable,
  })]);
  mutable.revision.updatedAt = 'mutated-after-append';
  assert.equal(project.eventLedger[0].payload.revision.updatedAt, '2026-07-11T12:00:00.000Z');
  assert.equal(verifyProjectEventLedger(project).valid, true);
});

test('retention preserves the predecessor boundary and verifies the retained chain', () => {
  const events = Array.from({ length: EVENT_LEDGER_RETAINED_LIMIT + 2 }, (_, index) => event(`evt_${index + 1}`));
  const project = appendProjectEvents({ id: 'project_event_retention' }, events);
  assert.equal(project.eventLedger.length, EVENT_LEDGER_RETAINED_LIMIT);
  assert.equal(project.eventLedger[0].sequence, 3);
  assert.equal(project.eventLedger[0].previousEventHash, project.eventLedgerPreviousHash);
  assert.equal(project.eventLedgerEventCount, EVENT_LEDGER_RETAINED_LIMIT + 2);
  assert.equal(verifyProjectEventLedger(project).valid, true);

  const metadataTamper = { ...project, eventLedgerRootHash: 'f'.repeat(64) };
  assert.ok(verifyProjectEventLedger(metadataTamper).findings.some((finding) => finding.code === 'event-root-hash-mismatch'));
});
