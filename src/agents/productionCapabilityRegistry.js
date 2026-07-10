const CAPABILITIES = [
  ['environment-classification', 'truth', 'Environment classification'],
  ['capability-registry', 'truth', 'Capability registry'],
  ['release-gate', 'truth', 'Release gate'],
  ['user-authentication', 'identity', 'User authentication'],
  ['tenant-isolation', 'identity', 'Tenant isolation'],
  ['fine-grained-authorization', 'identity', 'Fine-grained authorization'],
  ['service-identity', 'identity', 'Service identity'],
  ['managed-secrets', 'secrets', 'Managed secrets'],
  ['durable-relational-persistence', 'data', 'Durable relational persistence'],
  ['schema-migration-safety', 'data', 'Schema migration safety'],
  ['object-artifacts', 'data', 'Object artifacts'],
  ['audit-integrity', 'data', 'Audit integrity'],
  ['privacy-lifecycle', 'data', 'Privacy lifecycle'],
  ['backup-recovery', 'data', 'Backup recovery'],
  ['durable-queue', 'jobs', 'Durable queue'],
  ['idempotency', 'jobs', 'Idempotency'],
  ['retry-backoff', 'jobs', 'Retry and backoff'],
  ['timeout-cancellation', 'jobs', 'Timeout and cancellation'],
  ['durable-scheduling', 'jobs', 'Durable scheduling'],
  ['dead-letter-operations', 'jobs', 'Dead-letter operations'],
  ['dependency-readiness', 'reliability', 'Dependency readiness'],
  ['rate-and-concurrency-control', 'reliability', 'Rate and concurrency control'],
  ['circuit-breakers', 'reliability', 'Circuit breakers'],
  ['graceful-shutdown', 'reliability', 'Graceful shutdown'],
  ['incident-recovery', 'reliability', 'Incident recovery'],
  ['structured-logs', 'observability', 'Structured logs'],
  ['distributed-traces', 'observability', 'Distributed traces'],
  ['metrics-and-slos', 'observability', 'Metrics and SLOs'],
  ['error-reporting', 'observability', 'Error reporting'],
  ['cost-ledger', 'observability', 'Cost ledger'],
  ['tool-grants', 'agent-safety', 'Tool grants'],
  ['prompt-and-data-boundaries', 'agent-safety', 'Prompt and data boundaries'],
  ['human-approval', 'agent-safety', 'Human approval'],
  ['evaluation-and-quality', 'agent-safety', 'Evaluation and quality'],
  ['model-fallback', 'agent-safety', 'Model fallback'],
  ['team-composer', 'team-system', 'Team composer'],
  ['delegation-graph', 'team-system', 'Delegation graph'],
  ['shared-memory', 'team-system', 'Shared memory'],
  ['handoffs-and-reviews', 'team-system', 'Handoffs and reviews'],
  ['autonomy-governor', 'team-system', 'Autonomy governor'],
  ['study-planner', 'learning', 'Study planner', 'learning'],
  ['tutor-safety', 'learning', 'Tutor safety'],
  ['academic-writing-pipeline', 'writing', 'Academic writing pipeline', 'academic-writing'],
  ['citation-integrity', 'writing', 'Citation integrity'],
  ['investigation-case-workflow', 'investigation', 'Investigation case workflow', 'investigation'],
  ['investigation-safety', 'investigation', 'Investigation safety'],
  ['technical-delivery-workflow', 'technical', 'Technical delivery workflow', 'technical-delivery'],
  ['engineering-security', 'technical', 'Engineering security'],
  ['creative-studio-workflow', 'creative', 'Creative studio workflow', 'creative-studio'],
  ['rights-and-provenance', 'creative', 'Rights and provenance'],
];

export const PRODUCTION_CAPABILITY_DEFINITIONS = Object.freeze(CAPABILITIES.map(([id, domain, label, workMode]) => Object.freeze({
  id,
  domain,
  label,
  workMode: workMode || null,
})));

function isoTime(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : null;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const text = stableJson(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function environmentAttestationState(attestation = {}, nowMs) {
  if (!attestation?.id) return { status: 'missing', reason: 'environment-attestation-missing' };
  const validSchema = attestation.schemaVersion === 'managed-production-environment-attestation/v1';
  const validEnvironment = attestation.environment === 'managed-production';
  const validSignature = Boolean(attestation.signature && attestation.signatureVerified);
  const validChecksum = Boolean(attestation.checksum);
  const expiresAtMs = isoTime(attestation.expiresAt);
  if (!validSchema || !validEnvironment || !validSignature || !validChecksum) {
    return { status: 'untrusted', reason: 'environment-attestation-untrusted' };
  }
  if (!expiresAtMs || expiresAtMs <= nowMs) return { status: 'stale', reason: 'environment-attestation-stale' };
  return { status: 'verified', reason: null };
}

function evidenceState(evidence, attestation, attestationState, nowMs) {
  if (!evidence) return { status: 'missing', reason: 'capability-evidence-missing' };
  if (String(evidence.evidenceEnvironment || '').trim() === 'local-rehearsal') {
    return { status: 'local-rehearsal', reason: 'local-rehearsal-evidence' };
  }
  if (attestationState.status !== 'verified') {
    return { status: 'external-unattested', reason: attestationState.reason };
  }
  const expiresAtMs = isoTime(evidence.expiresAt);
  if (!expiresAtMs || expiresAtMs <= nowMs) return { status: 'stale', reason: 'capability-evidence-stale' };
  const validReceipt = Boolean(evidence.receiptId && evidence.receiptChecksum);
  const attestationMatches = evidence.environmentAttestationId === attestation.id;
  const explicitlyVerified = evidence.status === 'verified';
  if (!validReceipt || !attestationMatches || !explicitlyVerified) {
    return { status: 'external-unattested', reason: 'capability-evidence-untrusted' };
  }
  return { status: 'verified', reason: null };
}

function redactedAttestation(attestation = {}, state = {}) {
  return {
    schemaVersion: attestation.schemaVersion || null,
    id: attestation.id || null,
    environment: attestation.environment || null,
    checksum: attestation.checksum || null,
    issuedAt: attestation.issuedAt || null,
    expiresAt: attestation.expiresAt || null,
    status: state.status,
    reason: state.reason,
  };
}

export function buildProductionCapabilityRegistry({
  environmentAttestation = null,
  capabilityEvidence = [],
  now = new Date().toISOString(),
} = {}) {
  const nowMs = isoTime(now) || Date.now();
  const attestation = environmentAttestation || {};
  const attestationState = environmentAttestationState(attestation, nowMs);
  const evidenceByCapabilityId = new Map(
    (Array.isArray(capabilityEvidence) ? capabilityEvidence : [])
      .filter((evidence) => evidence?.capabilityId)
      .map((evidence) => [evidence.capabilityId, evidence]),
  );
  const capabilities = PRODUCTION_CAPABILITY_DEFINITIONS.map((definition) => {
    const evidence = evidenceByCapabilityId.get(definition.id) || null;
    const state = evidenceState(evidence, attestation, attestationState, nowMs);
    return {
      ...definition,
      evidenceStatus: state.status,
      blocker: state.reason,
      receiptId: evidence?.receiptId || null,
      receiptChecksum: evidence?.receiptChecksum || null,
      verifiedAt: state.status === 'verified' ? evidence.verifiedAt || null : null,
      expiresAt: evidence?.expiresAt || null,
    };
  });
  const verifiedCapabilityCount = capabilities.filter((capability) => capability.evidenceStatus === 'verified').length;
  const blockers = [...new Set([
    attestationState.reason,
    ...(verifiedCapabilityCount === capabilities.length ? [] : ['capability-evidence-incomplete']),
  ].filter(Boolean))];
  const base = {
    schemaVersion: 'production-capability-registry/v1',
    generatedAt: new Date(nowMs).toISOString(),
    environmentAttestation: redactedAttestation(attestation, attestationState),
    capabilities,
    summary: {
      requiredCapabilityCount: capabilities.length,
      verifiedCapabilityCount,
      missingCapabilityCount: capabilities.filter((capability) => capability.evidenceStatus === 'missing').length,
      staleCapabilityCount: capabilities.filter((capability) => capability.evidenceStatus === 'stale').length,
      localRehearsalCapabilityCount: capabilities.filter((capability) => capability.evidenceStatus === 'local-rehearsal').length,
      externalUnattestedCapabilityCount: capabilities.filter((capability) => capability.evidenceStatus === 'external-unattested').length,
    },
    blockers,
    readyForProduction: Boolean(attestationState.status === 'verified' && verifiedCapabilityCount === capabilities.length),
  };
  return {
    ...base,
    checksum: checksum({
      schemaVersion: base.schemaVersion,
      generatedAt: base.generatedAt,
      environmentAttestation: base.environmentAttestation,
      capabilityStates: capabilities.map((capability) => [capability.id, capability.evidenceStatus, capability.receiptChecksum]),
      blockers,
    }),
  };
}
