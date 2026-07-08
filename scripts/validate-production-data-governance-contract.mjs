import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-data-governance-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-data-governance-attestation-secret';
const envKeys = [
  'AGENT_ACCESS_CONTROL_MODE',
  'AGENT_ACCESS_SIGNING_SECRET',
  'AGENT_ACCESS_REPLAY_PROTECTION',
  'AGENT_ACCESS_AUDIT_FAIL_CLOSED',
  'PRODUCTION_IDENTITY_PROVIDER',
  'PRODUCTION_IDENTITY_ISSUER',
  'PRODUCTION_IDENTITY_JWKS_URI',
  'PRODUCTION_SERVICE_IDENTITY_AUDIENCE',
  'PRODUCTION_SERVICE_IDENTITY_SUBJECT',
  'PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID',
  'PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE',
  'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'MANAGED_SECRET_MANAGER_ENDPOINT',
  'MANAGED_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_DATABASE_URL',
  'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER',
  'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID',
  'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM',
  'MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE',
  'WORKER_QUEUE_ADAPTER_DRIVER',
  'WORKER_QUEUE_HTTP_ENDPOINT',
  'WORKER_QUEUE_REQUIRE_REAL_ADAPTER',
  'MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_ID',
  'MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_CHECKSUM',
  'MANAGED_WORKER_QUEUE_CUTOVER_ATTESTATION_SIGNATURE',
  'PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS',
  'PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT',
  'PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT',
  'PRODUCTION_COST_ALERT_ENDPOINT',
  'PRODUCTION_COST_CONTROL_RECEIPT_ID',
  'PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE',
  'PRODUCTION_DATA_RETENTION_POLICY_ID',
  'PRODUCTION_DATA_RESIDENCY_REGION',
  'PRODUCTION_DATA_DELETION_JOB_ENDPOINT',
  'PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT',
  'PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID',
  'PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM',
  'PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE',
];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function startupAttestationSignature({
  signingSecret = ATTESTATION_SIGNING_SECRET,
  controlId = 'managed-identity-provider',
  evidenceId = '',
  evidenceChecksum = '',
  domain = 'security',
} = {}) {
  const payload = {
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId: 'public-production-startup',
    domain,
    controlId,
    evidenceId,
    evidenceRoute: null,
    evidenceChecksum,
    evidenceEnvironment: 'managed-production',
    attestationId: evidenceId ? `${evidenceId}:managed-production-attestation` : null,
    attestationRoute: null,
    attestationChecksum: evidenceChecksum,
    attestationProvider: 'public-production-startup',
    attestationKind: 'startup-control-receipt',
  };
  return `sig_hmac_sha256_v1_${createHmac('sha256', signingSecret).update(stableJson(payload)).digest('hex')}`;
}

function restoreEnv() {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

function clearEnv() {
  for (const key of envKeys) delete process.env[key];
}

function setStrictAccessEnv() {
  process.env.AGENT_ACCESS_CONTROL_MODE = 'enforced';
  process.env.AGENT_ACCESS_SIGNING_SECRET = ACCESS_SIGNING_SECRET;
  process.env.AGENT_ACCESS_REPLAY_PROTECTION = 'true';
  process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED = 'true';
}

function setSignedManagedIdentityEnv() {
  process.env.PRODUCTION_IDENTITY_PROVIDER = 'oidc';
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json';
  process.env.PRODUCTION_SERVICE_IDENTITY_AUDIENCE = 'hofs-public-production';
  process.env.PRODUCTION_SERVICE_IDENTITY_SUBJECT = 'service-account:hofs-agent-runtime';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID = 'managed-identity-receipt';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM = 'managed-identity-checksum';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = ATTESTATION_SIGNING_SECRET;
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    evidenceId: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM,
  });
}

function setManagedSecretsEnv() {
  process.env.MANAGED_SECRET_MANAGER_ENDPOINT = 'https://managed-secret.example.test/api';
  process.env.MANAGED_KMS_KEY_ID = 'managed-kms-key-env';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_ID = 'managed-secret-attestation';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM = 'managed-secret-checksum';
}

function setManagedPersistenceEnv() {
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'postgres';
  process.env.MANAGED_PERSISTENCE_DATABASE_URL = 'postgres://user:db-password-should-not-leak@managed-db.example.test/hofs';
  process.env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID = 'managed-persistence-cutover-receipt';
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM = 'managed-persistence-cutover-checksum';
  process.env.MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE = startupAttestationSignature({
    domain: 'operations',
    controlId: 'managed-persistence-cutover',
    evidenceId: process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID,
    evidenceChecksum: process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM,
  });
}

function setManagedWorkerQueueEnv() {
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = 'https://queue.example.test/enqueue';
  process.env.WORKER_QUEUE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_ID = 'managed-worker-queue-cutover-receipt';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_CHECKSUM = 'managed-worker-queue-cutover-checksum';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_ATTESTATION_SIGNATURE = startupAttestationSignature({
    domain: 'operations',
    controlId: 'managed-worker-queue-cutover',
    evidenceId: process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_ID,
    evidenceChecksum: process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_CHECKSUM,
  });
}

function setProductionProviderControlsEnv() {
  process.env.PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS = '250000';
  process.env.PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT = '12000';
  process.env.PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT = 'https://provider-audit.example.test/usage';
  process.env.PRODUCTION_COST_ALERT_ENDPOINT = 'https://cost-alerts.example.test/page';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID = 'production-cost-control-receipt';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM = 'production-cost-control-checksum';
  process.env.PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    domain: 'provider',
    controlId: 'production-cost-controls',
    evidenceId: process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM,
  });
}

function setProductionDataGovernanceEnv({ signature = 'sig_invalid_data_governance' } = {}) {
  process.env.PRODUCTION_DATA_RETENTION_POLICY_ID = 'retention-policy-env-only';
  process.env.PRODUCTION_DATA_RESIDENCY_REGION = 'us-managed-region';
  process.env.PRODUCTION_DATA_DELETION_JOB_ENDPOINT = 'https://deletion.example.test/jobs?token=delete-token-should-not-leak';
  process.env.PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT = 'https://exports.example.test/bucket?token=export-token-should-not-leak';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID = 'data-governance-receipt-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM = 'data-governance-checksum-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE = signature;
}

function managedVault() {
  return {
    status() {
      return {
        schemaVersion: 'secret-vault-status/v1',
        provider: 'managed-secret-manager',
        enabled: true,
        configured: true,
        ready: true,
        encryptionReady: true,
        keyId: 'managed-kms-key',
        keySource: 'managed-secret-manager',
        secretCount: 1,
        encryptedRecordCount: 1,
        rawSecretRecordCount: 0,
        rawSecretExposure: false,
        rotationSupported: true,
        latestRotation: {
          schemaVersion: 'secret-vault-rotation-receipt/v1',
          rotatedAt: '2026-07-07T00:00:00.000Z',
          nextKeyId: 'managed-kms-key',
          recordCount: 1,
          rotatedRecordCount: 1,
          failedRecordCount: 0,
          plaintextExposed: false,
          checksum: 'managed-rotation-checksum',
        },
        accessAuditSupported: true,
        productionReady: false,
      };
    },
  };
}

const modelProvider = {
  status() {
    return {
      provider: 'openai-compatible',
      enabled: true,
      configured: true,
      runtimeEnabled: true,
      apiKeySource: 'local-secret-vault',
      hasApiKey: true,
    };
  },
};

const searchProvider = {
  status() {
    return {
      provider: 'http-json',
      enabled: true,
      configured: true,
      runtimeEnabled: true,
      apiKeySource: 'local-secret-vault',
      endpointSource: 'local-secret-vault',
      hasApiKey: true,
      hasEndpoint: true,
      baseURL: 'https://search.example.test/redacted',
    };
  },
};

function serviceOptions() {
  return {
    secretVault: managedVault(),
    llmProvider: modelProvider,
    searchProvider,
  };
}

function readiness() {
  return createAgentProjectService(serviceOptions()).getPublicProductionStartupReadiness();
}

function actionById(snapshot, id) {
  return snapshot.publicProductionActionPlan?.actions?.find((action) => action.id === id) || null;
}

function setupRowById(snapshot, id) {
  return snapshot.productionEnvironmentSetup?.rows?.find((row) => row.id === id) || null;
}

function assertProductionDataGovernancePolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService(serviceOptions()) });
  const response = api.handle({
    method: 'GET',
    path: '/production-data-governance-policy',
  });
  const policy = response.body.productionDataGovernancePolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Production data governance policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'production-data-governance-policy/v1', 'Production data governance policy route must expose production-data-governance-policy/v1.');
  assert(policy.apiPath === '/production-data-governance-policy', 'Production data governance policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Production data governance policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-data-governance', 'Production data governance policy must expose its focused validation command.');
  assert(policy.retentionResidencyContract?.requiredEnvVars?.includes('PRODUCTION_DATA_RETENTION_POLICY_ID'), 'Production data governance policy must document retention policy env names.');
  assert(policy.retentionResidencyContract?.requiredEnvVars?.includes('PRODUCTION_DATA_RESIDENCY_REGION'), 'Production data governance policy must document data residency env names.');
  assert(policy.deletionContract?.requiredEnvVars?.includes('PRODUCTION_DATA_DELETION_JOB_ENDPOINT'), 'Production data governance policy must document deletion job env names.');
  assert(policy.exportContract?.requiredEnvVars?.includes('PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT'), 'Production data governance policy must document export storage env names.');
  assert(policy.managedProductionEvidenceContract?.requiredEnvVars?.includes('PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE'), 'Production data governance policy must document signed evidence env names.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.controlId === 'production-data-governance', 'Production data governance policy must document the attestation control id.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.domain === 'data-governance', 'Production data governance policy must document the attestation domain.');
  assert(policy.relatedRoutes?.productionProviderControlsPolicy === '/production-provider-controls-policy', 'Production data governance policy must link the provider controls policy route.');
  assert(!serialized.includes('delete-token-should-not-leak'), 'Production data governance policy must not expose deletion endpoint token values.');
  assert(!serialized.includes('export-token-should-not-leak'), 'Production data governance policy must not expose export endpoint token values.');
  assert(!serialized.includes('data-governance-checksum-env-only'), 'Production data governance policy must not expose data governance checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Production data governance policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Production data governance policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setStrictAccessEnv();
  setSignedManagedIdentityEnv();
  setManagedSecretsEnv();
  setManagedPersistenceEnv();
  setManagedWorkerQueueEnv();
  setProductionProviderControlsEnv();

  let snapshot = readiness();
  let row = setupRowById(snapshot, 'production-data-governance');
  let data = snapshot.productionDataGovernanceStartup;
  let action = actionById(snapshot, 'setup-production-data-governance');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-production-data-governance', 'After provider controls are ready, next action must be setup-production-data-governance.');
  assert(row?.status === 'blocked', 'Production data governance setup row must block when governance controls are missing.');
  assert(data?.retentionPolicyConfigured === false, 'Production data governance must require retention and residency policy.');
  assert(data?.deletionJobConfigured === false, 'Production data governance must require deletion job controls.');
  assert(data?.exportStorageConfigured === false, 'Production data governance must require export storage controls.');
  assert(data?.evidenceReady === false, 'Production data governance must require signed managed-production evidence.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_DATA_RETENTION_POLICY_ID'), 'Production data governance action must list retention policy env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_DATA_DELETION_JOB_ENDPOINT'), 'Production data governance action must list deletion job env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT'), 'Production data governance action must list export storage env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE'), 'Production data governance action must list signed evidence env.');

  setProductionDataGovernanceEnv();
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-data-governance');
  data = snapshot.productionDataGovernanceStartup;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(row?.status === 'blocked', 'Production data governance must stay blocked with env-only data controls.');
  assert(data?.retentionPolicyConfigured === true, 'Production data governance must recognize retention/residency env.');
  assert(data?.deletionJobConfigured === true, 'Production data governance must recognize deletion job env.');
  assert(data?.exportStorageConfigured === true, 'Production data governance must recognize export storage env.');
  assert(data?.attestationSignatureReady === false, 'Production data governance must reject invalid attestation signatures.');
  assert(data?.evidenceReady === false && data?.ready === false, 'Production data governance must not pass from env names alone.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-data-governance' && gate.passed === false), 'Production data governance startup gate must stay blocked without valid evidence.');
  assert(!envOnlySerialized.includes('delete-token-should-not-leak'), 'Production data governance readiness must not expose deletion endpoint token values.');
  assert(!envOnlySerialized.includes('export-token-should-not-leak'), 'Production data governance readiness must not expose export storage token values.');
  assert(!envOnlySerialized.includes('data-governance-checksum-env-only'), 'Production data governance readiness must not expose receipt checksum values.');
  assertProductionDataGovernancePolicyRoute();

  setProductionDataGovernanceEnv({
    signature: startupAttestationSignature({
      domain: 'data-governance',
      controlId: 'production-data-governance',
      evidenceId: 'data-governance-receipt-env-only',
      evidenceChecksum: 'data-governance-checksum-env-only',
    }),
  });
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-data-governance');
  data = snapshot.productionDataGovernanceStartup;
  action = actionById(snapshot, 'setup-production-data-governance');

  assert(data?.attestationSignatureReady === true, 'Production data governance must accept matching data-governance attestation signature.');
  assert(data?.evidenceReady === true && data?.ready === true, 'Production data governance must pass after policy, deletion, export, residency, and signed evidence are ready.');
  assert(row?.status === 'ready', 'Production setup matrix must mark data governance ready after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-data-governance' && gate.passed === true), 'Production data governance startup gate must pass after signed evidence.');
  assert(action === null, 'Public production action plan must remove setup-production-data-governance after signed data governance evidence.');
  assert(actionById(snapshot, 'setup-production-traffic'), 'Public production action plan must continue to traffic setup.');
  assert(snapshot.readyForPublicProduction === false, 'Data governance controls alone must not approve public production.');

  console.log('production-data-governance-contract: ok');
} finally {
  restoreEnv();
}
