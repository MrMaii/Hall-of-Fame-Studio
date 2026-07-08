import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-customer-acceptance-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-customer-acceptance-attestation-secret';
const envKeys = [
  'AGENT_ACCESS_CONTROL_MODE', 'AGENT_ACCESS_SIGNING_SECRET', 'AGENT_ACCESS_REPLAY_PROTECTION', 'AGENT_ACCESS_AUDIT_FAIL_CLOSED',
  'PRODUCTION_IDENTITY_PROVIDER', 'PRODUCTION_IDENTITY_ISSUER', 'PRODUCTION_IDENTITY_JWKS_URI', 'PRODUCTION_SERVICE_IDENTITY_AUDIENCE', 'PRODUCTION_SERVICE_IDENTITY_SUBJECT',
  'PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID', 'PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM', 'PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE', 'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'MANAGED_SECRET_MANAGER_ENDPOINT', 'MANAGED_KMS_KEY_ID', 'MANAGED_SECRET_MANAGER_ATTESTATION_ID', 'MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER', 'MANAGED_PERSISTENCE_DATABASE_URL', 'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER', 'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID', 'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM', 'MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE',
  'WORKER_QUEUE_ADAPTER_DRIVER', 'WORKER_QUEUE_HTTP_ENDPOINT', 'WORKER_QUEUE_REQUIRE_REAL_ADAPTER', 'MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_ID', 'MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_CHECKSUM', 'MANAGED_WORKER_QUEUE_CUTOVER_ATTESTATION_SIGNATURE',
  'PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS', 'PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT', 'PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT', 'PRODUCTION_COST_ALERT_ENDPOINT', 'PRODUCTION_COST_CONTROL_RECEIPT_ID', 'PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM', 'PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE',
  'PRODUCTION_DATA_RETENTION_POLICY_ID', 'PRODUCTION_DATA_RESIDENCY_REGION', 'PRODUCTION_DATA_DELETION_JOB_ENDPOINT', 'PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT', 'PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID', 'PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM', 'PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE',
  'ADAPTER_GATEWAY_HTTP_ENDPOINT', 'ADAPTER_GATEWAY_AUTH_TOKEN',
  'PRODUCTION_DOMAIN_NAME', 'PRODUCTION_TLS_CERTIFICATE_ID', 'PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT', 'PRODUCTION_HEALTHCHECK_URL', 'PRODUCTION_RELEASE_APPROVAL_ID', 'PRODUCTION_ROLLBACK_RUNBOOK_ID', 'PRODUCTION_ROLLBACK_SMOKE_TEST_URL', 'PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID', 'PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM', 'PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID', 'PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID', 'PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT', 'PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVER_ROLE', 'PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID', 'PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID', 'PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID', 'PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM', 'PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE',
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

function signature({ domain = 'operations', controlId, evidenceId, evidenceChecksum }) {
  const payload = {
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId: 'public-production-startup',
    domain,
    controlId,
    evidenceId,
    evidenceRoute: null,
    evidenceChecksum,
    evidenceEnvironment: 'managed-production',
    attestationId: `${evidenceId}:managed-production-attestation`,
    attestationRoute: null,
    attestationChecksum: evidenceChecksum,
    attestationProvider: 'public-production-startup',
    attestationKind: 'startup-control-receipt',
  };
  return `sig_hmac_sha256_v1_${createHmac('sha256', ATTESTATION_SIGNING_SECRET).update(stableJson(payload)).digest('hex')}`;
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

function setPriorReadyEnv() {
  process.env.AGENT_ACCESS_CONTROL_MODE = 'enforced';
  process.env.AGENT_ACCESS_SIGNING_SECRET = ACCESS_SIGNING_SECRET;
  process.env.AGENT_ACCESS_REPLAY_PROTECTION = 'true';
  process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED = 'true';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = ATTESTATION_SIGNING_SECRET;

  process.env.PRODUCTION_IDENTITY_PROVIDER = 'oidc';
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json';
  process.env.PRODUCTION_SERVICE_IDENTITY_AUDIENCE = 'hofs-public-production';
  process.env.PRODUCTION_SERVICE_IDENTITY_SUBJECT = 'service-account:hofs-agent-runtime';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID = 'identity-receipt';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM = 'identity-checksum';
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = signature({ domain: 'security', controlId: 'managed-identity-provider', evidenceId: 'identity-receipt', evidenceChecksum: 'identity-checksum' });

  process.env.MANAGED_SECRET_MANAGER_ENDPOINT = 'https://managed-secret.example.test/api';
  process.env.MANAGED_KMS_KEY_ID = 'managed-kms-key-env';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_ID = 'managed-secret-attestation';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM = 'managed-secret-checksum';

  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'postgres';
  process.env.MANAGED_PERSISTENCE_DATABASE_URL = 'postgres://user:db-password-should-not-leak@managed-db.example.test/hofs';
  process.env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID = 'persistence-receipt';
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM = 'persistence-checksum';
  process.env.MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE = signature({ controlId: 'managed-persistence-cutover', evidenceId: 'persistence-receipt', evidenceChecksum: 'persistence-checksum' });

  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = 'https://queue.example.test/enqueue';
  process.env.WORKER_QUEUE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_ID = 'queue-receipt';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_RECEIPT_CHECKSUM = 'queue-checksum';
  process.env.MANAGED_WORKER_QUEUE_CUTOVER_ATTESTATION_SIGNATURE = signature({ controlId: 'managed-worker-queue-cutover', evidenceId: 'queue-receipt', evidenceChecksum: 'queue-checksum' });

  process.env.PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS = '250000';
  process.env.PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT = '12000';
  process.env.PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT = 'https://provider-audit.example.test/usage';
  process.env.PRODUCTION_COST_ALERT_ENDPOINT = 'https://cost-alerts.example.test/page';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID = 'cost-receipt';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM = 'cost-checksum';
  process.env.PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE = signature({ domain: 'provider', controlId: 'production-cost-controls', evidenceId: 'cost-receipt', evidenceChecksum: 'cost-checksum' });

  process.env.PRODUCTION_DATA_RETENTION_POLICY_ID = 'retention-policy';
  process.env.PRODUCTION_DATA_RESIDENCY_REGION = 'us-managed-region';
  process.env.PRODUCTION_DATA_DELETION_JOB_ENDPOINT = 'https://deletion.example.test/jobs';
  process.env.PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT = 'https://exports.example.test/bucket';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID = 'data-receipt';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM = 'data-checksum';
  process.env.PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE = signature({ domain: 'data-governance', controlId: 'production-data-governance', evidenceId: 'data-receipt', evidenceChecksum: 'data-checksum' });

  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = 'https://adapter-gateway.example.test/api';
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = 'adapter-token-should-not-leak';

  process.env.PRODUCTION_DOMAIN_NAME = 'app.example.test';
  process.env.PRODUCTION_TLS_CERTIFICATE_ID = 'tls-cert';
  process.env.PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT = 'https://traffic.example.test/route';
  process.env.PRODUCTION_HEALTHCHECK_URL = 'https://app.example.test/health';
  process.env.PRODUCTION_RELEASE_APPROVAL_ID = 'release-approval';
  process.env.PRODUCTION_ROLLBACK_RUNBOOK_ID = 'rollback-runbook';
  process.env.PRODUCTION_ROLLBACK_SMOKE_TEST_URL = 'https://app.example.test/rollback-smoke';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID = 'traffic-receipt';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM = 'traffic-checksum';
  process.env.PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE = signature({ domain: 'deployment', controlId: 'production-traffic-control', evidenceId: 'traffic-receipt', evidenceChecksum: 'traffic-checksum' });
}

function setCustomerAcceptanceEnv({ signed = false } = {}) {
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID = 'customer-acceptance-policy-env-only';
  process.env.PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID = 'customer-success-criteria-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT = '95';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVER_ROLE = 'customer-approver-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID = 'customer-approval-env-only';
  process.env.PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID = 'customer-rollback-criteria-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID = 'customer-acceptance-receipt-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM = 'customer-acceptance-checksum-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE = signed
    ? signature({
      domain: 'customer-acceptance',
      controlId: 'customer-production-acceptance-policy',
      evidenceId: 'customer-acceptance-receipt-env-only',
      evidenceChecksum: 'customer-acceptance-checksum-env-only',
    })
    : 'sig_invalid_customer_acceptance';
}

function serviceOptions() {
  return {
    secretVault: { status: () => ({ provider: 'managed-secret-manager', enabled: true, configured: true, ready: true, encryptionReady: true, rawSecretExposure: false, rotationSupported: true, accessAuditSupported: true }) },
    llmProvider: { status: () => ({ provider: 'openai-compatible', enabled: true, configured: true, runtimeEnabled: true, apiKeySource: 'local-secret-vault', hasApiKey: true }) },
    searchProvider: { status: () => ({ provider: 'http-json', enabled: true, configured: true, runtimeEnabled: true, apiKeySource: 'local-secret-vault', endpointSource: 'local-secret-vault', hasApiKey: true, hasEndpoint: true, baseURL: 'https://search.example.test/redacted' }) },
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

function assertProductionCustomerAcceptancePolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService(serviceOptions()) });
  const response = api.handle({ method: 'GET', path: '/production-customer-acceptance-policy' });
  const policy = response.body.productionCustomerAcceptancePolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Production customer acceptance policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'production-customer-acceptance-policy/v1', 'Production customer acceptance policy route must expose production-customer-acceptance-policy/v1.');
  assert(policy.apiPath === '/production-customer-acceptance-policy', 'Production customer acceptance policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Production customer acceptance policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-customer-acceptance', 'Production customer acceptance policy must expose its focused validation command.');
  assert(policy.acceptancePolicyContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID'), 'Production customer acceptance policy must document customer policy env names.');
  assert(policy.acceptancePolicyContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID'), 'Production customer acceptance policy must document success criteria env names.');
  assert(policy.acceptancePolicyContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT'), 'Production customer acceptance policy must document threshold env names.');
  assert(policy.approvalContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID'), 'Production customer acceptance policy must document approval env names.');
  assert(policy.rollbackCriteriaContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID'), 'Production customer acceptance policy must document rollback criteria env names.');
  assert(policy.managedProductionEvidenceContract?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE'), 'Production customer acceptance policy must document signed customer acceptance evidence env names.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.domain === 'customer-acceptance', 'Production customer acceptance policy must document the attestation domain.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.controlId === 'customer-production-acceptance-policy', 'Production customer acceptance policy must document the attestation control id.');
  assert(policy.relatedRoutes?.productionTrafficPolicy === '/production-traffic-policy', 'Production customer acceptance policy must link the traffic policy route.');
  assert(policy.relatedRoutes?.productionOperationsPolicy === '/production-operations-policy', 'Production customer acceptance policy must link the operations policy route.');
  assert(!serialized.includes('customer-acceptance-checksum-env-only'), 'Production customer acceptance policy must not expose customer acceptance checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Production customer acceptance policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Production customer acceptance policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setPriorReadyEnv();

  let snapshot = readiness();
  let row = setupRowById(snapshot, 'customer-production-acceptance');
  let customerAcceptance = snapshot.productionCustomerAcceptanceStartup;
  let action = actionById(snapshot, 'setup-customer-production-acceptance');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-customer-production-acceptance', 'After traffic controls are ready, next action must be setup-customer-production-acceptance.');
  assert(row?.status === 'blocked', 'Customer production acceptance setup row must block when customer acceptance controls are missing.');
  assert(customerAcceptance?.policyConfigured === false, 'Customer production acceptance must require policy controls.');
  assert(customerAcceptance?.successCriteriaConfigured === false, 'Customer production acceptance must require success criteria.');
  assert(customerAcceptance?.thresholdConfigured === false, 'Customer production acceptance must require acceptance threshold.');
  assert(customerAcceptance?.approvalConfigured === false, 'Customer production acceptance must require approval controls.');
  assert(customerAcceptance?.rollbackCriteriaConfigured === false, 'Customer production acceptance must require rollback criteria.');
  assert(customerAcceptance?.evidenceReady === false, 'Customer production acceptance must require signed managed-production evidence.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID'), 'Customer acceptance action must list policy env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID'), 'Customer acceptance action must list approval env.');
  assert(action?.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE'), 'Customer acceptance action must list signed evidence env.');

  setCustomerAcceptanceEnv();
  snapshot = readiness();
  row = setupRowById(snapshot, 'customer-production-acceptance');
  customerAcceptance = snapshot.productionCustomerAcceptanceStartup;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(row?.status === 'blocked', 'Customer production acceptance must stay blocked with env-only controls.');
  assert(customerAcceptance?.policyConfigured === true, 'Customer production acceptance must recognize configured policy env.');
  assert(customerAcceptance?.successCriteriaConfigured === true, 'Customer production acceptance must recognize configured success criteria env.');
  assert(customerAcceptance?.thresholdConfigured === true, 'Customer production acceptance must recognize configured acceptance threshold env.');
  assert(customerAcceptance?.approvalConfigured === true, 'Customer production acceptance must recognize configured approval env.');
  assert(customerAcceptance?.rollbackCriteriaConfigured === true, 'Customer production acceptance must recognize configured rollback criteria env.');
  assert(customerAcceptance?.attestationSignatureReady === false, 'Customer production acceptance must reject invalid attestation signatures.');
  assert(customerAcceptance?.evidenceReady === false && customerAcceptance?.ready === false, 'Customer production acceptance must not pass from env names alone.');
  assert(snapshot.gates?.some((gate) => gate.id === 'customer-production-acceptance-policy' && gate.passed === false), 'Customer production acceptance gate must stay blocked without valid evidence.');
  assert(!envOnlySerialized.includes('customer-acceptance-checksum-env-only'), 'Customer production acceptance readiness must not expose receipt checksum values.');
  assertProductionCustomerAcceptancePolicyRoute();

  setCustomerAcceptanceEnv({ signed: true });
  snapshot = readiness();
  row = setupRowById(snapshot, 'customer-production-acceptance');
  customerAcceptance = snapshot.productionCustomerAcceptanceStartup;
  action = actionById(snapshot, 'setup-customer-production-acceptance');

  assert(customerAcceptance?.attestationSignatureReady === true, 'Customer production acceptance must accept matching customer-acceptance attestation signature.');
  assert(customerAcceptance?.evidenceReady === true && customerAcceptance?.ready === true, 'Customer production acceptance must pass after policy, criteria, threshold, approval, rollback, and signed evidence are ready.');
  assert(row?.status === 'ready', 'Production setup matrix must mark customer acceptance ready after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'customer-production-acceptance-policy' && gate.passed === true), 'Customer production acceptance gate must pass after signed evidence.');
  assert(action === null, 'Public production action plan must remove setup-customer-production-acceptance after signed customer acceptance evidence.');
  assert(actionById(snapshot, 'setup-observability'), 'Public production action plan must continue to operations setup.');
  assert(snapshot.readyForPublicProduction === false, 'Customer production acceptance alone must not approve public production.');

  console.log('production-customer-acceptance-contract: ok');
} finally {
  restoreEnv();
}
