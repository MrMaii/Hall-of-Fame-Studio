import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProductionArtifactPort,
  createProductionPersistencePort,
  validateProductionWriteContext,
} from '../src/agents/productionDataPorts.js';

const context = {
  tenantId: 'tenant_1',
  projectId: 'project_1',
  actorId: 'user_1',
  requestId: 'request_1',
  idempotencyKey: 'write_1',
  retentionClass: 'customer-project-30d',
};

test('requires tenant, actor, request, idempotency, and retention context for every production write', () => {
  assert.equal(validateProductionWriteContext(context).ok, true);
  assert.deepEqual(
    validateProductionWriteContext({ tenantId: 'tenant_1' }).missing,
    ['projectId', 'actorId', 'requestId', 'idempotencyKey', 'retentionClass'],
  );
});

test('fails closed when a managed persistence driver is not configured', async () => {
  const port = createProductionPersistencePort();
  const result = await port.write({ context, operation: async () => ({ ok: true }) });

  assert.equal(port.status().status, 'managed-driver-not-configured');
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'managed-driver-not-configured');
});

test('runs a managed write once per idempotency key and preserves actor context in the receipt', async () => {
  let transactionCount = 0;
  let operationCount = 0;
  const port = createProductionPersistencePort({
    adapter: {
      mode: 'managed',
      async transaction(metadata, operation) {
        transactionCount += 1;
        assert.equal(metadata.tenantId, 'tenant_1');
        return operation({ query: async () => ({ rows: [] }) });
      },
    },
  });
  const operation = async () => {
    operationCount += 1;
    return { recordId: 'record_1' };
  };

  const first = await port.write({ context, operation });
  const duplicate = await port.write({ context, operation });

  assert.equal(first.status, 'committed');
  assert.equal(first.actorId, 'user_1');
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.originalReceiptId, first.id);
  assert.equal(transactionCount, 1);
  assert.equal(operationCount, 1);
});

test('classifies a transaction failure without emitting a committed business effect', async () => {
  const port = createProductionPersistencePort({
    adapter: {
      mode: 'managed',
      async transaction(_metadata, operation) {
        return operation({});
      },
    },
  });
  const result = await port.write({
    context,
    operation: async () => { throw new Error('database unavailable'); },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.errorClass, 'operation-failed');
  assert.equal(result.businessEffectCommitted, false);
  assert.equal(JSON.stringify(result).includes('database unavailable'), false);
});

test('rejects an artifact before immutable storage when the malware scan does not pass', async () => {
  let putCalled = false;
  const port = createProductionArtifactPort({
    storage: {
      mode: 'managed',
      async scan() { return { status: 'failed' }; },
      async putImmutable() { putCalled = true; return { versionId: 'never' }; },
    },
  });
  const result = await port.store({
    context,
    artifact: {
      id: 'artifact_1',
      contentChecksum: 'chk_content_1',
      mediaType: 'text/markdown',
    },
  });

  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'malware-scan-not-passed');
  assert.equal(putCalled, false);
});

test('publishes only immutable, encrypted artifacts with a retention class', async () => {
  const port = createProductionArtifactPort({
    storage: {
      mode: 'managed',
      async scan() { return { status: 'passed', scanId: 'scan_1' }; },
      async putImmutable(input) {
        assert.equal(input.context.tenantId, 'tenant_1');
        return { versionId: 'version_1', encrypted: true };
      },
    },
  });
  const result = await port.store({
    context,
    artifact: {
      id: 'artifact_1',
      contentChecksum: 'chk_content_1',
      mediaType: 'text/markdown',
    },
  });

  assert.equal(result.status, 'published');
  assert.equal(result.versionId, 'version_1');
  assert.equal(result.encrypted, true);
  assert.equal(result.retentionClass, 'customer-project-30d');
});
