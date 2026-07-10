const REQUIRED_WRITE_CONTEXT_FIELDS = Object.freeze([
  'tenantId',
  'projectId',
  'actorId',
  'requestId',
  'idempotencyKey',
  'retentionClass',
]);

function nonEmpty(value) {
  return typeof value === 'string' ? value.trim() : value ? String(value).trim() : '';
}

function safeNow(now) {
  const value = now();
  return Number.isFinite(Date.parse(value)) ? value : new Date().toISOString();
}

function contextReceipt(context = {}) {
  return {
    tenantId: nonEmpty(context.tenantId) || null,
    projectId: nonEmpty(context.projectId) || null,
    actorId: nonEmpty(context.actorId) || null,
    requestId: nonEmpty(context.requestId) || null,
    idempotencyKey: nonEmpty(context.idempotencyKey) || null,
    retentionClass: nonEmpty(context.retentionClass) || null,
  };
}

function configuredManagedAdapter(adapter, requiredMethods = []) {
  return Boolean(
    adapter
    && adapter.mode === 'managed'
    && requiredMethods.every((method) => typeof adapter[method] === 'function'),
  );
}

export function validateProductionWriteContext(context = {}) {
  const normalized = contextReceipt(context);
  const missing = REQUIRED_WRITE_CONTEXT_FIELDS.filter((field) => !normalized[field]);
  return {
    ok: missing.length === 0,
    missing,
    context: normalized,
  };
}

export function createProductionPersistencePort({
  adapter = null,
  now = () => new Date().toISOString(),
} = {}) {
  const completedByIdempotencyKey = new Map();
  const inFlightByIdempotencyKey = new Map();
  let receiptSequence = 0;
  const configured = configuredManagedAdapter(adapter, ['transaction']);
  const status = () => ({
    schemaVersion: 'production-persistence-port-status/v1',
    status: configured ? 'managed-driver-configured' : 'managed-driver-not-configured',
    configured,
    sourceKind: configured ? 'managed' : adapter?.mode === 'local-rehearsal' ? 'local-rehearsal' : 'missing',
    readyForProduction: false,
    requiredContextFields: [...REQUIRED_WRITE_CONTEXT_FIELDS],
  });
  const runWrite = async ({ context, operation }) => {
    const validation = validateProductionWriteContext(context);
    const at = safeNow(now);
    if (!validation.ok) {
      return {
        schemaVersion: 'production-persistence-write-receipt/v1',
        id: `persistence_write_${++receiptSequence}`,
        status: 'rejected',
        reason: 'write-context-invalid',
        missingContext: validation.missing,
        ...validation.context,
        businessEffectCommitted: false,
        at,
      };
    }
    if (!configured) {
      return {
        schemaVersion: 'production-persistence-write-receipt/v1',
        id: `persistence_write_${++receiptSequence}`,
        status: 'blocked',
        reason: 'managed-driver-not-configured',
        ...validation.context,
        businessEffectCommitted: false,
        at,
      };
    }
    if (typeof operation !== 'function') {
      return {
        schemaVersion: 'production-persistence-write-receipt/v1',
        id: `persistence_write_${++receiptSequence}`,
        status: 'rejected',
        reason: 'write-operation-missing',
        ...validation.context,
        businessEffectCommitted: false,
        at,
      };
    }
    const existing = completedByIdempotencyKey.get(validation.context.idempotencyKey);
    if (existing) {
      return {
        ...existing,
        status: 'duplicate',
        duplicate: true,
        originalReceiptId: existing.id,
        businessEffectCommitted: true,
        at,
      };
    }
    const running = inFlightByIdempotencyKey.get(validation.context.idempotencyKey);
    if (running) {
      const original = await running;
      return {
        ...original,
        status: original.status === 'committed' ? 'duplicate' : original.status,
        duplicate: original.status === 'committed',
        originalReceiptId: original.id,
        at,
      };
    }
    const execution = (async () => {
      const id = `persistence_write_${++receiptSequence}`;
      try {
        const result = await adapter.transaction(validation.context, (transaction) => operation(transaction));
        const receipt = {
          schemaVersion: 'production-persistence-write-receipt/v1',
          id,
          status: 'committed',
          ...validation.context,
          businessEffectCommitted: true,
          result,
          at,
        };
        completedByIdempotencyKey.set(validation.context.idempotencyKey, receipt);
        return receipt;
      } catch {
        return {
          schemaVersion: 'production-persistence-write-receipt/v1',
          id,
          status: 'failed',
          errorClass: 'operation-failed',
          ...validation.context,
          businessEffectCommitted: false,
          at,
        };
      } finally {
        inFlightByIdempotencyKey.delete(validation.context.idempotencyKey);
      }
    })();
    inFlightByIdempotencyKey.set(validation.context.idempotencyKey, execution);
    return execution;
  };
  return { status, write: runWrite };
}

export function createProductionArtifactPort({
  storage = null,
  now = () => new Date().toISOString(),
} = {}) {
  const configured = configuredManagedAdapter(storage, ['scan', 'putImmutable']);
  let receiptSequence = 0;
  const status = () => ({
    schemaVersion: 'production-artifact-port-status/v1',
    status: configured ? 'managed-artifact-store-configured' : 'managed-artifact-store-not-configured',
    configured,
    sourceKind: configured ? 'managed' : storage?.mode === 'local-rehearsal' ? 'local-rehearsal' : 'missing',
    readyForProduction: false,
    requirements: ['malware-scan', 'immutable-version', 'encryption', 'retention-class'],
  });
  return {
    status,
    async store({ context, artifact = {} } = {}) {
      const validation = validateProductionWriteContext(context);
      const at = safeNow(now);
      const base = {
        schemaVersion: 'production-artifact-write-receipt/v1',
        id: `artifact_write_${++receiptSequence}`,
        ...validation.context,
        artifactId: nonEmpty(artifact.id) || null,
        contentChecksum: nonEmpty(artifact.contentChecksum) || null,
        mediaType: nonEmpty(artifact.mediaType) || null,
        at,
      };
      if (!validation.ok) return { ...base, status: 'rejected', reason: 'write-context-invalid', missingContext: validation.missing };
      if (!configured) return { ...base, status: 'blocked', reason: 'managed-artifact-store-not-configured' };
      if (!base.artifactId || !base.contentChecksum || !base.mediaType) {
        return { ...base, status: 'rejected', reason: 'artifact-metadata-invalid' };
      }
      let scan;
      try {
        scan = await storage.scan({ context: validation.context, artifact });
      } catch {
        return { ...base, status: 'failed', reason: 'malware-scan-unavailable' };
      }
      if (scan?.status !== 'passed') {
        return { ...base, status: 'rejected', reason: 'malware-scan-not-passed', scanId: scan?.scanId || null };
      }
      try {
        const stored = await storage.putImmutable({ context: validation.context, artifact, scan });
        if (!stored?.versionId || stored.encrypted !== true) {
          return { ...base, status: 'rejected', reason: 'immutable-encrypted-storage-required', scanId: scan.scanId || null };
        }
        return {
          ...base,
          status: 'published',
          versionId: stored.versionId,
          encrypted: true,
          scanId: scan.scanId || null,
        };
      } catch {
        return { ...base, status: 'failed', reason: 'artifact-storage-failed', scanId: scan.scanId || null };
      }
    },
  };
}
