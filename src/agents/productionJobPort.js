const REQUIRED_JOB_FIELDS = Object.freeze([
  'jobId',
  'tenantId',
  'projectId',
  'actorId',
  'idempotencyKey',
  'kind',
  'deadlineAt',
  'retryPolicy',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : value ? String(value).trim() : '';
}

function asTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}

function validAdapter(adapter) {
  return Boolean(
    adapter
    && adapter.mode === 'managed'
    && ['enqueue', 'acquireLease', 'acknowledge', 'defer', 'deadLetter', 'cancel', 'replay']
      .every((method) => typeof adapter[method] === 'function'),
  );
}

function jobReceipt(job = {}) {
  return {
    jobId: text(job.id) || null,
    tenantId: text(job.tenantId) || null,
    projectId: text(job.projectId) || null,
    actorId: text(job.actorId) || null,
    idempotencyKey: text(job.idempotencyKey) || null,
    kind: text(job.kind) || null,
    deadlineAt: text(job.deadlineAt) || null,
    retryPolicy: job.retryPolicy || null,
  };
}

export function calculateRetryDelayMs({ attempt = 1, baseDelayMs = 1000, maxDelayMs = 300_000 } = {}) {
  const exponent = Math.max(0, Number(attempt || 1) - 1);
  const base = Math.max(1, Number(baseDelayMs) || 1000);
  const ceiling = Math.max(base, Number(maxDelayMs) || 300_000);
  return Math.min(ceiling, base * (2 ** exponent));
}

export function validateProductionJob(job = {}, now = new Date().toISOString()) {
  const receipt = jobReceipt(job);
  const missing = REQUIRED_JOB_FIELDS.filter((field) => !receipt[field]);
  const deadlineMs = asTime(receipt.deadlineAt);
  const nowMs = asTime(now) || Date.now();
  const maxAttempts = Number(receipt.retryPolicy?.maxAttempts);
  if (!deadlineMs) missing.push('deadlineAt-valid');
  if (deadlineMs && deadlineMs <= nowMs) missing.push('deadlineAt-future');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) missing.push('retryPolicy.maxAttempts');
  return { ok: missing.length === 0, missing: [...new Set(missing)], job: receipt };
}

export function createProductionJobPort({
  adapter = null,
  now = () => new Date().toISOString(),
} = {}) {
  const configured = validAdapter(adapter);
  const jobsByIdempotencyKey = new Map();
  let sequence = 0;
  const at = () => {
    const value = now();
    return asTime(value) ? value : new Date().toISOString();
  };
  const receipt = (status, payload = {}) => ({
    schemaVersion: 'production-job-receipt/v1',
    id: `production_job_receipt_${++sequence}`,
    status,
    at: at(),
    ...payload,
  });
  const status = () => ({
    schemaVersion: 'production-job-port-status/v1',
    status: configured ? 'managed-queue-configured' : 'managed-queue-not-configured',
    configured,
    sourceKind: configured ? 'managed' : adapter?.mode === 'local-rehearsal' ? 'local-rehearsal' : 'missing',
    readyForProduction: false,
    requiredJobFields: [...REQUIRED_JOB_FIELDS],
    requiredOperations: ['enqueue', 'acquireLease', 'acknowledge', 'defer', 'deadLetter', 'cancel', 'replay'],
  });

  return {
    status,
    async enqueue(job = {}) {
      const validation = validateProductionJob(job, at());
      if (!validation.ok) return receipt('rejected', { reason: 'job-contract-invalid', missing: validation.missing, ...validation.job });
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', ...validation.job });
      const duplicate = jobsByIdempotencyKey.get(validation.job.idempotencyKey);
      if (duplicate) return receipt('duplicate', { originalReceiptId: duplicate.id, ...validation.job, availableAt: duplicate.availableAt });
      const delayMs = Math.max(0, Number(job.delayMs) || 0);
      const availableAt = new Date((asTime(at()) || Date.now()) + delayMs).toISOString();
      const queuedJob = { ...job, availableAt, attempt: 0 };
      try {
        await adapter.enqueue(queuedJob);
        const result = receipt('queued', { ...validation.job, availableAt, attempt: 0 });
        jobsByIdempotencyKey.set(validation.job.idempotencyKey, result);
        return result;
      } catch {
        return receipt('failed', { reason: 'queue-enqueue-failed', ...validation.job });
      }
    },
    async lease({ job, workerId } = {}) {
      const validation = validateProductionJob(job, at());
      if (!validation.ok) return receipt('rejected', { reason: 'job-contract-invalid', missing: validation.missing, ...validation.job });
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', ...validation.job });
      if (!text(workerId)) return receipt('rejected', { reason: 'worker-id-required', ...validation.job });
      try {
        const lease = await adapter.acquireLease({ jobId: validation.job.jobId, workerId: text(workerId), deadlineAt: validation.job.deadlineAt });
        return receipt('leased', { ...validation.job, workerId: text(workerId), leaseId: lease?.leaseId || null, leaseExpiresAt: lease?.expiresAt || null });
      } catch {
        return receipt('failed', { reason: 'queue-lease-failed', ...validation.job });
      }
    },
    async acknowledge({ jobId, leaseId, workerId } = {}) {
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', jobId: text(jobId) || null });
      if (!text(jobId) || !text(leaseId) || !text(workerId)) return receipt('rejected', { reason: 'acknowledgement-contract-invalid', jobId: text(jobId) || null });
      try {
        await adapter.acknowledge({ jobId: text(jobId), leaseId: text(leaseId), workerId: text(workerId) });
        return receipt('acknowledged', { jobId: text(jobId), leaseId: text(leaseId), workerId: text(workerId) });
      } catch {
        return receipt('failed', { reason: 'queue-acknowledgement-failed', jobId: text(jobId) || null });
      }
    },
    async nack({ job, attempt = 1, errorClass = 'unknown' } = {}) {
      const validation = validateProductionJob(job, at());
      if (!validation.ok) return receipt('rejected', { reason: 'job-contract-invalid', missing: validation.missing, ...validation.job });
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', ...validation.job });
      const retryPolicy = validation.job.retryPolicy;
      const retryable = ['provider-timeout', 'provider-unavailable', 'temporary-network'].includes(text(errorClass));
      const resolvedAttempt = Math.max(1, Number(attempt) || 1);
      if (retryable && resolvedAttempt < Number(retryPolicy.maxAttempts)) {
        const delayMs = calculateRetryDelayMs({ attempt: resolvedAttempt, ...retryPolicy });
        const retryAt = new Date((asTime(at()) || Date.now()) + delayMs).toISOString();
        try {
          await adapter.defer({ jobId: validation.job.jobId, attempt: resolvedAttempt, retryAt, errorClass: text(errorClass) });
          return receipt('retry-scheduled', { ...validation.job, attempt: resolvedAttempt, errorClass: text(errorClass), delayMs, retryAt });
        } catch {
          return receipt('failed', { reason: 'queue-defer-failed', ...validation.job });
        }
      }
      try {
        const deadLetter = await adapter.deadLetter({ jobId: validation.job.jobId, attempt: resolvedAttempt, errorClass: text(errorClass) || 'unknown' });
        return receipt('dead-lettered', { ...validation.job, attempt: resolvedAttempt, errorClass: text(errorClass) || 'unknown', deadLetterId: deadLetter?.deadLetterId || null });
      } catch {
        return receipt('failed', { reason: 'queue-dead-letter-failed', ...validation.job });
      }
    },
    async cancel({ jobId, actorId, reason } = {}) {
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', jobId: text(jobId) || null });
      if (!text(jobId) || !text(actorId) || !text(reason)) return receipt('rejected', { reason: 'cancellation-contract-invalid', jobId: text(jobId) || null });
      try {
        await adapter.cancel({ jobId: text(jobId), actorId: text(actorId), reason: text(reason) });
        return receipt('cancelled', { jobId: text(jobId), actorId: text(actorId), reason: text(reason) });
      } catch {
        return receipt('failed', { reason: 'queue-cancellation-failed', jobId: text(jobId) || null });
      }
    },
    async replay({ deadLetterId, approval = {} } = {}) {
      if (!configured) return receipt('blocked', { reason: 'managed-queue-not-configured', deadLetterId: text(deadLetterId) || null });
      if (!text(deadLetterId) || !text(approval.actorId) || !text(approval.reason)) {
        return receipt('rejected', { reason: 'dead-letter-replay-approval-required', deadLetterId: text(deadLetterId) || null });
      }
      try {
        const replay = await adapter.replay({ deadLetterId: text(deadLetterId), approval: { actorId: text(approval.actorId), reason: text(approval.reason) } });
        return receipt('replayed', { deadLetterId: text(deadLetterId), replayedJobId: replay?.jobId || null, approvedBy: text(approval.actorId) });
      } catch {
        return receipt('failed', { reason: 'dead-letter-replay-failed', deadLetterId: text(deadLetterId) || null });
      }
    },
  };
}
