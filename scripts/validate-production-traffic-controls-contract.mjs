import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-traffic-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-traffic-attestation-secret';
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
  'ADAPTER_GATEWAY_HTTP_ENDPOINT',
  'ADAPTER_GATEWAY_AUTH_TOKEN',
  'PRODUCTION_DOMAIN_NAME',
  'PRODUCTION_TLS_CERTIFICATE_ID',
  'PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT',
  'PRODUCTION_HEALTHCHECK_URL',
  'PRODUCTION_RELEASE_APPROVAL_ID',
  'PRODUCTION_ROLLBACK_RUNBOOK_ID',
  'PRODUCTION_ROLLBACK_SMOKE_TEST_URL',
  'PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID',
  'PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE',
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
  domain = 'security',
  controlId = 'managed-identity-provider',
  evidenceId = '',
  evidenceChecksum = '',
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

function setProductionDataGovernanceEnv() {
  process.env.PRODUCTION_DATA_RETENTION_POLICY_ID = 'retention-policy-env-only';
  process.env.PRODUCTION_DATA_RESIDENCY_REGION = 'us-managed-region';
  process.env.PRODUCTION_DATA_DELETION_JOB_ENDPOINT = 'https://deletion.example.test/jobs?token=delete-token-should-not-leak';
  process.env.PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT = 'https://exports.example.test/bucket?token=export-token-should-not-leak';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID = 'data-governance-receipt-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM = 'data-governance-checksum-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE = startupAttestationSignature({
    domain: 'data-governance',
    controlId: 'production-data-governance',
    evidenceId: process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM,
  });
}

function setAdapterGatewayEnv() {
  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = 'https://adapter-gateway.example.test/api?token=gateway-token-should-not-leak';
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = 'adapter-gateway-auth-token-should-not-leak';
}

function setProductionTrafficEnv({ signature = 'sig_invalid_traffic' } = {}) {
  process.env.PRODUCTION_DOMAIN_NAME = 'app.example.test';
  process.env.PRODUCTION_TLS_CERTIFICATE_ID = 'tls-cert-env-only';
  process.env.PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT = 'https://traffic.example.test/route?token=traffic-token-should-not-leak';
  process.env.PRODUCTION_HEALTHCHECK_URL = 'https://app.example.test/health?token=health-token-should-not-leak';
  process.env.PRODUCTION_RELEASE_APPROVAL_ID = 'release-approval-env-only';
  process.env.PRODUCTION_ROLLBACK_RUNBOOK_ID = 'rollback-runbook-env-only';
  process.env.PRODUCTION_ROLLBACK_SMOKE_TEST_URL = 'https://app.example.test/rollback-smoke?token=rollback-token-should-not-leak';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID = 'traffic-control-receipt-env-only';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM = 'traffic-control-checksum-env-only';
  process.env.PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE = signature;
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
        keySource: 'managed-secret-manager',
        rawSecretExposure: false,
        rotationSupported: true,
        accessAuditSupported: true,
      };
    },
  };
}

const providerStatus = {
  provider: 'openai-compatible',
  enabled: true,
  configured: true,
  runtimeEnabled: true,
  apiKeySource: 'local-secret-vault',
  hasApiKey: true,
};
const searchStatus = {
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

function serviceOptions() {
  return {
    secretVault: managedVault(),
    llmProvider: { status: () => providerStatus },
    searchProvider: { status: () => searchStatus },
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

function assertProductionTrafficPolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService(serviceOptions()) });
  const response = api.handle({ method: 'GET', path: '/production-traffic-policy' });
  const policy = response.body.productionTrafficPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Production traffic policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'production-traffic-policy/v1', 'Production traffic policy route must expose production-traffic-policy/v1.');
  assert(policy.apiPath === '/production-traffic-policy', 'Production traffic policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Production traffic policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-traffic-controls', 'Production traffic policy must expose its focused validation command.');
  assert(policy.domainTlsContract?.requiredEnvVars?.includes('PRODUCTION_DOMAIN_NAME'), 'Production traffic policy must document production domain env names.');
  assert(policy.domainTlsContract?.requiredEnvVars?.includes('PRODUCTION_TLS_CERTIFICATE_ID'), 'Production traffic policy must document TLS certificate env names.');
  assert(policy.trafficGatewayHealthContract?.requiredEnvVars?.includes('PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT'), 'Production traffic policy must document traffic gateway env names.');
  assert(policy.trafficGatewayHealthContract?.requiredEnvVars?.includes('PRODUCTION_HEALTHCHECK_URL'), 'Production traffic policy must document health check env names.');
  assert(policy.releaseApprovalContract?.requiredEnvVars?.includes('PRODUCTION_RELEASE_APPROVAL_ID'), 'Production traffic policy must document release approval env names.');
  assert(policy.rollbackContract?.requiredEnvVars?.includes('PRODUCTION_ROLLBACK_SMOKE_TEST_URL'), 'Production traffic policy must document rollback smoke-test env names.');
  assert(policy.managedProductionEvidenceContract?.requiredEnvVars?.includes('PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE'), 'Production traffic policy must document signed traffic-control evidence env names.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.controlId === 'production-traffic-control', 'Production traffic policy must document the attestation control id.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.domain === 'deployment', 'Production traffic policy must document the attestation domain.');
  assert(policy.relatedRoutes?.productionDataGovernancePolicy === '/production-data-governance-policy', 'Production traffic policy must link the data governance policy route.');
  assert(!serialized.includes('traffic-token-should-not-leak'), 'Production traffic policy must not expose traffic gateway token values.');
  assert(!serialized.includes('health-token-should-not-leak'), 'Production traffic policy must not expose health check token values.');
  assert(!serialized.includes('rollback-token-should-not-leak'), 'Production traffic policy must not expose rollback smoke-test token values.');
  assert(!serialized.includes('traffic-control-checksum-env-only'), 'Production traffic policy must not expose traffic-control checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Production traffic policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Production traffic policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setStrictAccessEnv();
  setSignedManagedIdentityEnv();
  setManagedSecretsEnv();
  setManagedPersistenceEnv();
  setManagedWorkerQueueEnv();
  setProductionProviderControlsEnv();
  setProductionDataGovernanceEnv();
  setAdapterGatewayEnv();

  let snapshot = readiness();
  let row = setupRowById(snapshot, 'production-traffic');
  let traffic = snapshot.productionTrafficStartup;
  let action = actionById(snapshot, 'setup-production-traffic');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-production-traffic', 'After data governance is ready, next action must be setup-production-traffic.');
  assert(row?.status === 'blocked', 'Production traffic setup row must block when traffic controls are missing.');
  assert(traffic?.domainTlsConfigured === false, 'Production traffic must require domain/TLS controls.');
  assert(traffic?.trafficGatewayConfigured === false, 'Production traffic must require gateway and health check controls.');
  assert(traffic?.releaseApprovalConfigured === false, 'Production traffic must require release approval.');
  assert(traffic?.rollbackConfigured === false, 'Production traffic must require rollback controls.');
  assert(traffic?.evidenceReady === false, 'Production traffic must require signed managed-production evidence.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_DOMAIN_NAME'), 'Production traffic action must list production domain env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT'), 'Production traffic action must list traffic gateway env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_ROLLBACK_SMOKE_TEST_URL'), 'Production traffic action must list rollback smoke-test env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE'), 'Production traffic action must list signed evidence env.');

  setProductionTrafficEnv();
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-traffic');
  traffic = snapshot.productionTrafficStartup;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(row?.status === 'blocked', 'Production traffic must stay blocked with env-only traffic controls.');
  assert(traffic?.domainTlsConfigured === true, 'Production traffic must recognize configured domain/TLS env.');
  assert(traffic?.trafficGatewayConfigured === true, 'Production traffic must recognize configured gateway and health check env.');
  assert(traffic?.releaseApprovalConfigured === true, 'Production traffic must recognize configured release approval env.');
  assert(traffic?.rollbackConfigured === true, 'Production traffic must recognize configured rollback env.');
  assert(traffic?.attestationSignatureReady === false, 'Production traffic must reject invalid attestation signatures.');
  assert(traffic?.evidenceReady === false && traffic?.ready === false, 'Production traffic must not pass from env names alone.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-traffic-controls' && gate.passed === false), 'Production traffic startup gate must stay blocked without valid evidence.');
  assert(!envOnlySerialized.includes('traffic-token-should-not-leak'), 'Production traffic readiness must not expose traffic gateway token values.');
  assert(!envOnlySerialized.includes('health-token-should-not-leak'), 'Production traffic readiness must not expose health check token values.');
  assert(!envOnlySerialized.includes('rollback-token-should-not-leak'), 'Production traffic readiness must not expose rollback smoke-test token values.');
  assert(!envOnlySerialized.includes('traffic-control-checksum-env-only'), 'Production traffic readiness must not expose receipt checksum values.');
  assertProductionTrafficPolicyRoute();

  setProductionTrafficEnv({
    signature: startupAttestationSignature({
      domain: 'deployment',
      controlId: 'production-traffic-control',
      evidenceId: 'traffic-control-receipt-env-only',
      evidenceChecksum: 'traffic-control-checksum-env-only',
    }),
  });
  snapshot = readiness();
  row = setupRowById(snapshot, 'production-traffic');
  traffic = snapshot.productionTrafficStartup;
  action = actionById(snapshot, 'setup-production-traffic');

  assert(traffic?.attestationSignatureReady === true, 'Production traffic must accept matching traffic-control attestation signature.');
  assert(traffic?.evidenceReady === true && traffic?.ready === true, 'Production traffic must pass after domain/TLS, gateway, health, approval, rollback, and signed evidence are ready.');
  assert(row?.status === 'ready', 'Production setup matrix must mark traffic controls ready after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-traffic-controls' && gate.passed === true), 'Production traffic startup gate must pass after signed evidence.');
  assert(action === null, 'Public production action plan must remove setup-production-traffic after signed traffic evidence.');
  assert(actionById(snapshot, 'setup-customer-production-acceptance'), 'Public production action plan must continue to customer acceptance setup.');
  assert(snapshot.readyForPublicProduction === false, 'Traffic controls alone must not approve public production.');

  console.log('production-traffic-controls-contract: ok');
} finally {
  restoreEnv();
}
