import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-operations-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-operations-attestation-secret';
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
  'PRODUCTION_OBSERVABILITY_ENDPOINT', 'PRODUCTION_ALERT_ROUTING_ENDPOINT', 'PRODUCTION_ONCALL_SCHEDULE_ID', 'PRODUCTION_ONCALL_OWNER', 'PRODUCTION_INCIDENT_SYSTEM_ENDPOINT', 'PRODUCTION_INCIDENT_PROJECT_KEY', 'PRODUCTION_RESTORE_DRILL_RECEIPT_ID', 'PRODUCTION_RESTORE_DRILL_COMPLETED_AT', 'PRODUCTION_SECURITY_AUDIT_SINK',
  'PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_ID', 'PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_CHECKSUM', 'PRODUCTION_OBSERVABILITY_CONTROL_ATTESTATION_SIGNATURE',
  'PRODUCTION_INCIDENT_RESPONSE_RECEIPT_ID', 'PRODUCTION_INCIDENT_RESPONSE_RECEIPT_CHECKSUM', 'PRODUCTION_INCIDENT_RESPONSE_ATTESTATION_SIGNATURE',
  'PRODUCTION_RESTORE_DRILL_RECEIPT_CHECKSUM', 'PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE',
  'PRODUCTION_AUDIT_RETENTION_RECEIPT_ID', 'PRODUCTION_AUDIT_RETENTION_RECEIPT_CHECKSUM', 'PRODUCTION_AUDIT_RETENTION_ATTESTATION_SIGNATURE',
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

  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID = 'customer-policy';
  process.env.PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID = 'customer-success';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT = '95';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVER_ROLE = 'customer-approver';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID = 'customer-approval';
  process.env.PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID = 'customer-rollback';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID = 'customer-receipt';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM = 'customer-checksum';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE = signature({ domain: 'customer-acceptance', controlId: 'customer-production-acceptance-policy', evidenceId: 'customer-receipt', evidenceChecksum: 'customer-checksum' });
}

function setOperationsEnv({ signed = false } = {}) {
  process.env.PRODUCTION_OBSERVABILITY_ENDPOINT = 'https://observability.example.test/ingest?token=observability-token-should-not-leak';
  process.env.PRODUCTION_ALERT_ROUTING_ENDPOINT = 'https://alerts.example.test/page?key=alert-routing-key-should-not-leak';
  process.env.PRODUCTION_ONCALL_SCHEDULE_ID = 'oncall-schedule';
  process.env.PRODUCTION_ONCALL_OWNER = 'ops-owner';
  process.env.PRODUCTION_INCIDENT_SYSTEM_ENDPOINT = 'https://incidents.example.test/api?token=incident-token-should-not-leak';
  process.env.PRODUCTION_INCIDENT_PROJECT_KEY = 'incident-project';
  process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_ID = 'restore-receipt';
  process.env.PRODUCTION_RESTORE_DRILL_COMPLETED_AT = '2026-07-06T00:00:00.000Z';
  process.env.PRODUCTION_SECURITY_AUDIT_SINK = 'https://audit.example.test/append?token=audit-token-should-not-leak';

  process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_ID = 'observability-receipt';
  process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_CHECKSUM = 'observability-checksum';
  process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_ID = 'incident-receipt';
  process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_CHECKSUM = 'incident-checksum';
  process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_CHECKSUM = 'restore-checksum';
  process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_ID = 'audit-receipt';
  process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_CHECKSUM = 'audit-checksum';

  process.env.PRODUCTION_OBSERVABILITY_CONTROL_ATTESTATION_SIGNATURE = signed ? signature({ controlId: 'centralized-observability', evidenceId: 'observability-receipt', evidenceChecksum: 'observability-checksum' }) : 'sig_invalid_observability';
  process.env.PRODUCTION_INCIDENT_RESPONSE_ATTESTATION_SIGNATURE = signed ? signature({ controlId: 'incident-response', evidenceId: 'incident-receipt', evidenceChecksum: 'incident-checksum' }) : 'sig_invalid_incident';
  process.env.PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE = signed ? signature({ controlId: 'restore-drill', evidenceId: 'restore-receipt', evidenceChecksum: 'restore-checksum' }) : 'sig_invalid_restore';
  process.env.PRODUCTION_AUDIT_RETENTION_ATTESTATION_SIGNATURE = signed ? signature({ controlId: 'centralized-audit-retention', evidenceId: 'audit-receipt', evidenceChecksum: 'audit-checksum' }) : 'sig_invalid_audit';
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

function assertProductionOperationsPolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService(serviceOptions()) });
  const response = api.handle({ method: 'GET', path: '/production-operations-policy' });
  const policy = response.body.productionOperationsPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Production operations policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'production-operations-policy/v1', 'Production operations policy route must expose production-operations-policy/v1.');
  assert(policy.apiPath === '/production-operations-policy', 'Production operations policy route must expose its API path.');
  assert(policy.validationCommand === 'npm run agents:production-operations-startup', 'Production operations policy must expose its focused validation command.');
  assert(policy.observabilityContract?.anyOfEnvVarGroups?.flat().includes('PRODUCTION_OBSERVABILITY_ENDPOINT'), 'Production operations policy must document observability env names.');
  assert(policy.auditRetentionContract?.anyOfEnvVarGroups?.flat().includes('PRODUCTION_SECURITY_AUDIT_SINK'), 'Production operations policy must document audit sink env names.');
  assert(policy.incidentResponseContract?.requiredEnvVars?.includes('PRODUCTION_INCIDENT_SYSTEM_ENDPOINT'), 'Production operations policy must document incident system env names.');
  assert(policy.restoreDrillContract?.requiredEnvVars?.includes('PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE'), 'Production operations policy must document restore evidence env names.');
  assert(policy.relatedRoutes?.productionTrafficPolicy === '/production-traffic-policy', 'Production operations policy must link the traffic policy route.');
  assert(!serialized.includes('observability-token-should-not-leak'), 'Production operations policy must not expose observability endpoint token values.');
  assert(!serialized.includes('alert-routing-key-should-not-leak'), 'Production operations policy must not expose alert routing key values.');
  assert(!serialized.includes('incident-token-should-not-leak'), 'Production operations policy must not expose incident endpoint token values.');
  assert(!serialized.includes('audit-token-should-not-leak'), 'Production operations policy must not expose audit sink token values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Production operations policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Production operations policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setPriorReadyEnv();

  let snapshot = readiness();
  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-observability', 'After customer acceptance is ready, next action must be setup-observability.');
  assert(snapshot.productionOperationsStartup?.ready === false, 'Production operations must block when operations controls are missing.');
  assert(actionById(snapshot, 'setup-observability'), 'Action plan must list observability setup.');
  assert(actionById(snapshot, 'setup-incident-response'), 'Action plan must list incident-response setup.');

  setOperationsEnv();
  snapshot = readiness();
  const envOnlyOperations = snapshot.productionOperationsStartup;
  const envOnlySerialized = JSON.stringify(envOnlyOperations);
  assert(envOnlyOperations?.rows?.every((row) => row.configurationReady === true), 'Production operations must recognize configured env-only operations controls.');
  assert(envOnlyOperations?.rows?.every((row) => row.evidenceReady === false && row.attestationSignatureReady === false && row.ready === false), 'Production operations must reject invalid or unsigned evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'centralized-observability' && gate.passed === false), 'Centralized observability gate must stay blocked without valid evidence.');
  assert(!envOnlySerialized.includes('observability-token-should-not-leak'), 'Production operations readiness must not expose observability endpoint token values.');
  assert(!envOnlySerialized.includes('alert-routing-key-should-not-leak'), 'Production operations readiness must not expose alert routing key values.');
  assert(!envOnlySerialized.includes('incident-token-should-not-leak'), 'Production operations readiness must not expose incident endpoint token values.');
  assert(!envOnlySerialized.includes('audit-token-should-not-leak'), 'Production operations readiness must not expose audit sink token values.');
  assertProductionOperationsPolicyRoute();

  setOperationsEnv({ signed: true });
  snapshot = readiness();
  assert(snapshot.productionOperationsStartup?.ready === true, 'Production operations must pass after signed managed-production operations evidence.');
  assert(snapshot.productionOperationsStartup?.rows?.every((row) => row.configurationReady && row.evidenceReady && row.attestationSignatureReady && row.ready), 'Every production operations row must pass after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'centralized-observability' && gate.passed === true), 'Centralized observability gate must pass after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'production-incident-system' && gate.passed === true), 'Production incident system gate must pass after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'restore-drill-receipt' && gate.passed === true), 'Restore drill gate must pass after signed evidence.');
  assert(snapshot.gates?.some((gate) => gate.id === 'centralized-audit-retention' && gate.passed === true), 'Audit retention gate must pass after signed evidence.');
  assert(actionById(snapshot, 'setup-observability') === null, 'Action plan must remove setup-observability after signed operations evidence.');
  assert(actionById(snapshot, 'setup-incident-response') === null, 'Action plan must remove setup-incident-response after signed operations evidence.');

  console.log('production-operations-startup-contract: ok');
} finally {
  restoreEnv();
}
