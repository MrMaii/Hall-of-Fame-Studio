import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-provider-controls-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-provider-controls-attestation-secret';
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
  'PRODUCTION_SECRET_MANAGER_ENDPOINT',
  'PRODUCTION_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ENDPOINT',
  'MANAGED_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_DATABASE_URL',
  'MANAGED_PERSISTENCE_HTTP_ENDPOINT',
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
  'PRODUCTION_PROVIDER_COST_LEDGER_ENDPOINT',
  'PRODUCTION_COST_ALERT_ENDPOINT',
  'PRODUCTION_BUDGET_ALERT_ROUTING_ENDPOINT',
  'PRODUCTION_COST_CONTROL_RECEIPT_ID',
  'PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE',
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
  process.env.MANAGED_PERSISTENCE_DATABASE_URL = 'postgres://user:db-password-should-not-leak@managed-db.example.test/hofs?secret=db-token-should-not-leak';
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
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = 'https://queue.example.test/enqueue?token=queue-token-should-not-leak';
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

function setProductionProviderControlsEnv({ signature = 'sig_invalid_cost' } = {}) {
  process.env.PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS = '250000';
  process.env.PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT = '12000';
  process.env.PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT = 'https://provider-audit.example.test/usage?token=usage-audit-token-should-not-leak';
  process.env.PRODUCTION_COST_ALERT_ENDPOINT = 'https://cost-alerts.example.test/page?key=cost-alert-key-should-not-leak';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID = 'production-cost-control-receipt';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM = 'production-cost-control-checksum-should-not-leak';
  process.env.PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE = signature;
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
      secretVault: { ready: true, keyId: 'managed-kms-key' },
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
      secretVault: { ready: true, keyId: 'managed-kms-key' },
    };
  },
};

function readiness() {
  return createAgentProjectService({
    secretVault: managedVault(),
    llmProvider: modelProvider,
    searchProvider,
  }).getPublicProductionStartupReadiness();
}

function actionById(snapshot, id) {
  return snapshot.publicProductionActionPlan?.actions?.find((action) => action.id === id) || null;
}

function setupRowById(snapshot, id) {
  return snapshot.productionEnvironmentSetup?.rows?.find((row) => row.id === id) || null;
}

function serviceOptions() {
  return {
    secretVault: managedVault(),
    llmProvider: modelProvider,
    searchProvider,
  };
}

function assertProductionProviderControlsPolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService(serviceOptions()) });
  const response = api.handle({
    method: 'GET',
    path: '/production-provider-controls-policy',
  });
  const policy = response.body.productionProviderControlsPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Production provider controls policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'production-provider-controls-policy/v1', 'Production provider controls policy route must expose production-provider-controls-policy/v1.');
  assert(policy.apiPath === '/production-provider-controls-policy', 'Production provider controls policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Production provider controls policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-provider-controls', 'Production provider controls policy must expose its focused validation command.');
  assert(policy.budgetRateLimitContract?.requiredEnvVars?.includes('PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS'), 'Production provider controls policy must document daily budget env names.');
  assert(policy.budgetRateLimitContract?.requiredEnvVars?.includes('PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT'), 'Production provider controls policy must document hourly request limit env names.');
  assert(policy.usageAuditContract?.anyOfEnvVarGroups?.some((group) => group.includes('PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT')), 'Production provider controls policy must document usage audit endpoint env names.');
  assert(policy.costAlertContract?.anyOfEnvVarGroups?.some((group) => group.includes('PRODUCTION_COST_ALERT_ENDPOINT')), 'Production provider controls policy must document cost alert endpoint env names.');
  assert(policy.managedProductionEvidenceContract?.requiredEnvVars?.includes('PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE'), 'Production provider controls policy must document signed cost-control evidence env names.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.controlId === 'production-cost-controls', 'Production provider controls policy must document the provider cost-control attestation control id.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.domain === 'provider', 'Production provider controls policy must document the provider attestation domain.');
  assert(policy.relatedRoutes?.providerReadiness === '/projects/:projectId/provider-readiness', 'Production provider controls policy must link provider readiness.');
  assert(policy.relatedRoutes?.productionProviderControlReceipts === '/projects/:projectId/production-provider-control-receipts', 'Production provider controls policy must link provider control receipts.');
  assert(!serialized.includes('usage-audit-token-should-not-leak'), 'Production provider controls policy must not expose usage audit endpoint token values.');
  assert(!serialized.includes('cost-alert-key-should-not-leak'), 'Production provider controls policy must not expose cost alert routing token values.');
  assert(!serialized.includes('production-cost-control-checksum-should-not-leak'), 'Production provider controls policy must not expose cost-control checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Production provider controls policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Production provider controls policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setStrictAccessEnv();
  setSignedManagedIdentityEnv();
  setManagedSecretsEnv();
  setManagedPersistenceEnv();
  setManagedWorkerQueueEnv();

  let snapshot = readiness();
  let row = setupRowById(snapshot, 'production-cost-controls');
  let cost = snapshot.productionCostControlStartup;
  let action = actionById(snapshot, 'setup-production-cost-controls');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-production-cost-controls', 'After provider runtime is ready, next action must be setup-production-cost-controls.');
  assert(row?.status === 'blocked', 'Production provider controls setup row must block when production cost controls are missing.');
  assert(cost?.budgetPolicyConfigured === false, 'Production provider controls must require budget and rate-limit policy.');
  assert(cost?.usageAuditConfigured === false, 'Production provider controls must require usage/cost audit sink.');
  assert(cost?.alertRoutingConfigured === false, 'Production provider controls must require cost alert routing.');
  assert(cost?.evidenceReady === false, 'Production provider controls must require signed managed-production cost-control evidence.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS'), 'Production provider action must list daily budget env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT'), 'Production provider action must list hourly request limit env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT'), 'Production provider action must list usage audit env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_COST_ALERT_ENDPOINT'), 'Production provider action must list alert routing env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE'), 'Production provider action must list signed cost-control evidence env.');

  setProductionProviderControlsEnv();
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-cost-controls');
  cost = snapshot.productionCostControlStartup;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(row?.status === 'blocked', 'Production provider controls must stay blocked with env-only cost control config.');
  assert(cost?.budgetPolicyConfigured === true, 'Production provider controls must recognize budget/rate policy env.');
  assert(cost?.usageAuditConfigured === true, 'Production provider controls must recognize usage audit env.');
  assert(cost?.alertRoutingConfigured === true, 'Production provider controls must recognize alert routing env.');
  assert(cost?.attestationSignatureReady === false, 'Production provider controls must reject invalid attestation signatures.');
  assert(cost?.evidenceReady === false && cost?.ready === false, 'Production provider controls must not pass from env names alone.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-cost-controls' && gate.passed === false), 'Production provider startup gate must stay blocked without valid evidence.');
  assert(!envOnlySerialized.includes('usage-audit-token-should-not-leak'), 'Production provider controls must not expose usage audit endpoint token values.');
  assert(!envOnlySerialized.includes('cost-alert-key-should-not-leak'), 'Production provider controls must not expose cost alert token values.');
  assert(!envOnlySerialized.includes('production-cost-control-checksum-should-not-leak'), 'Production provider controls must not expose cost-control receipt checksum values.');
  assertProductionProviderControlsPolicyRoute();

  setProductionProviderControlsEnv({
    signature: startupAttestationSignature({
      domain: 'provider',
      controlId: 'production-cost-controls',
      evidenceId: 'production-cost-control-receipt',
      evidenceChecksum: 'production-cost-control-checksum-should-not-leak',
    }),
  });
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-cost-controls');
  cost = snapshot.productionCostControlStartup;
  action = actionById(snapshot, 'setup-production-cost-controls');

  assert(cost?.attestationSignatureReady === true, 'Production provider controls must accept matching cost-control attestation signature.');
  assert(cost?.evidenceReady === true && cost?.ready === true, 'Production provider controls must pass after policy, audit, alerting, and signed evidence are ready.');
  assert(row?.status === 'ready', 'Production setup matrix must mark provider controls ready after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-cost-controls' && gate.passed === true), 'Production provider startup gate must pass after signed evidence.');
  assert(action === null, 'Public production action plan must remove setup-production-cost-controls after signed provider evidence.');
  assert(actionById(snapshot, 'setup-production-data-governance'), 'Public production action plan must continue to data-governance setup.');
  assert(snapshot.readyForPublicProduction === false, 'Provider production controls alone must not approve public production.');

  console.log('production-provider-controls-contract: ok');
} finally {
  restoreEnv();
}
