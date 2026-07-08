import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

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
  signingSecret,
  controlId,
  evidenceId,
  evidenceChecksum,
  domain = 'operations',
}) {
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

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `public-production-startup-readiness-contract-validate-${process.pid}`);
const plaintextSecret = 'PUBLIC_PRODUCTION_STARTUP_SECRET_SHOULD_NOT_LEAK';
const validationProjectId = 'public_production_startup_readiness_project';
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
  'PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS',
  'PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT',
  'PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT',
  'PRODUCTION_PROVIDER_COST_LEDGER_ENDPOINT',
  'PRODUCTION_COST_ALERT_ENDPOINT',
  'PRODUCTION_BUDGET_ALERT_ROUTING_ENDPOINT',
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
  'PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID',
  'PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVER_ROLE',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID',
  'PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM',
  'PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE',
  'PRODUCTION_SECRET_MANAGER_ENDPOINT',
  'PRODUCTION_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ENDPOINT',
  'MANAGED_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM',
  'PRODUCTION_KMS_ATTESTATION_ID',
  'PRODUCTION_KMS_ATTESTATION_CHECKSUM',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_DATABASE_URL',
  'MANAGED_PERSISTENCE_HTTP_ENDPOINT',
  'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER',
  'WORKER_QUEUE_ADAPTER_DRIVER',
  'WORKER_QUEUE_HTTP_ENDPOINT',
  'WORKER_QUEUE_REQUIRE_REAL_ADAPTER',
  'ADAPTER_GATEWAY_HTTP_ENDPOINT',
  'ADAPTER_GATEWAY_AUTH_TOKEN',
  'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'PRODUCTION_LOGS_ENDPOINT',
  'PRODUCTION_METRICS_ENDPOINT',
  'PRODUCTION_TRACES_ENDPOINT',
  'PRODUCTION_OBSERVABILITY_ENDPOINT',
  'PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_ID',
  'PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_OBSERVABILITY_CONTROL_ATTESTATION_SIGNATURE',
  'PRODUCTION_ALERT_ROUTING_ENDPOINT',
  'PRODUCTION_PAGERDUTY_ROUTING_KEY',
  'PRODUCTION_OPSGENIE_ROUTING_KEY',
  'PRODUCTION_ONCALL_SCHEDULE_ID',
  'PRODUCTION_ONCALL_OWNER',
  'PRODUCTION_INCIDENT_SYSTEM_ENDPOINT',
  'PRODUCTION_INCIDENT_PROJECT_KEY',
  'PRODUCTION_INCIDENT_RESPONSE_RECEIPT_ID',
  'PRODUCTION_INCIDENT_RESPONSE_RECEIPT_CHECKSUM',
  'PRODUCTION_INCIDENT_RESPONSE_ATTESTATION_SIGNATURE',
  'PRODUCTION_RESTORE_DRILL_RECEIPT_ID',
  'PRODUCTION_RESTORE_DRILL_COMPLETED_AT',
  'PRODUCTION_RESTORE_DRILL_RECEIPT_CHECKSUM',
  'PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE',
  'PRODUCTION_SECURITY_AUDIT_SINK',
  'PRODUCTION_AUDIT_LOG_ENDPOINT',
  'PRODUCTION_AUDIT_RETENTION_RECEIPT_ID',
  'PRODUCTION_AUDIT_RETENTION_RECEIPT_CHECKSUM',
  'PRODUCTION_AUDIT_RETENTION_ATTESTATION_SIGNATURE',
];

const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

for (const key of envKeys) {
  delete process.env[key];
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const blockedApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'blocked-store.json'),
    replaceWithSeed: true,
  });

  let response = blockedApi.handle({
    method: 'GET',
    path: '/public-production-startup-readiness',
  });
  assert(response.status === 200, `Public production startup readiness returned ${response.status}.`);
  let readiness = response.body.publicProductionStartupReadiness;
  assert(readiness?.schemaVersion === 'public-production-startup-readiness/v1', 'Public production startup readiness must expose its schema version.');
  assert(readiness.status === 'public-production-startup-blocked', 'Public production startup readiness must block public traffic by default.');
  assert(readiness.readyForPublicProduction === false, 'Public production startup readiness must not claim public production readiness.');
  assert(readiness.readyForProduction === false, 'Public production startup readiness must not claim production readiness.');
  assert(readiness.backendRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness', 'Public production startup readiness must expose its global route.');
  assert(readiness.validationCommands?.includes('npm run agents:public-production-startup-readiness'), 'Public production startup readiness must expose its focused validation command.');

  for (const gateId of [
    'backend-api-reachable',
    'access-control-enforced',
    'managed-identity-provider',
    'production-cost-controls',
    'production-data-governance',
    'managed-secret-manager-or-kms',
    'managed-persistence-real-adapter',
    'managed-worker-queue-real-adapter',
    'provider-runtime-and-redaction',
    'adapter-gateway-and-attestation',
    'production-traffic-controls',
    'customer-production-acceptance-policy',
    'centralized-observability',
    'production-alert-routing',
    'production-on-call',
    'production-incident-system',
    'restore-drill-receipt',
    'centralized-audit-retention',
  ]) {
    assert(readiness.gates?.some((gate) => gate.id === gateId), `Public production startup readiness must expose gate ${gateId}.`);
  }
  assert(readiness.gates?.some((gate) => gate.id === 'backend-api-reachable' && gate.passed === true), 'Backend route gate must pass because the API generated the response.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-identity-provider' && gate.passed === false), 'Managed identity provider gate must block by default.');
  assert(readiness.managedIdentityStartup?.schemaVersion === 'managed-identity-startup-readiness/v1', 'Public production startup readiness must expose managed identity startup readiness evidence.');
  assert(readiness.managedIdentityStartup?.ready === false, 'Managed identity startup readiness must block by default.');
  assert(readiness.managedIdentityStartup?.providerConfigured === false, 'Managed identity startup readiness must require provider metadata.');
  assert(readiness.managedIdentityStartup?.serviceIdentityConfigured === false, 'Managed identity startup readiness must require service identity boundaries.');
  assert(readiness.managedIdentityStartup?.evidenceReady === false, 'Managed identity startup readiness must require signed managed-production evidence.');
  assert(readiness.gates?.some((gate) => gate.id === 'production-cost-controls' && gate.passed === false), 'Production cost-control gate must block by default.');
  assert(readiness.productionCostControlStartup?.schemaVersion === 'production-cost-control-startup-readiness/v1', 'Public production startup readiness must expose production cost-control readiness evidence.');
  assert(readiness.productionCostControlStartup?.ready === false, 'Production cost-control startup readiness must block by default.');
  assert(readiness.productionCostControlStartup?.budgetPolicyConfigured === false, 'Production cost-control startup readiness must require budget and rate-limit policy.');
  assert(readiness.productionCostControlStartup?.usageAuditConfigured === false, 'Production cost-control startup readiness must require usage/cost audit sink.');
  assert(readiness.productionCostControlStartup?.alertRoutingConfigured === false, 'Production cost-control startup readiness must require cost alert routing.');
  assert(readiness.productionCostControlStartup?.evidenceReady === false, 'Production cost-control startup readiness must require signed managed-production evidence.');
  assert(readiness.gates?.some((gate) => gate.id === 'production-data-governance' && gate.passed === false), 'Production data-governance gate must block by default.');
  assert(readiness.productionDataGovernanceStartup?.schemaVersion === 'production-data-governance-startup-readiness/v1', 'Public production startup readiness must expose production data-governance readiness evidence.');
  assert(readiness.productionDataGovernanceStartup?.ready === false, 'Production data-governance startup readiness must block by default.');
  assert(readiness.productionDataGovernanceStartup?.retentionPolicyConfigured === false, 'Production data-governance startup readiness must require retention and residency policy.');
  assert(readiness.productionDataGovernanceStartup?.deletionJobConfigured === false, 'Production data-governance startup readiness must require deletion job controls.');
  assert(readiness.productionDataGovernanceStartup?.exportStorageConfigured === false, 'Production data-governance startup readiness must require export storage controls.');
  assert(readiness.productionDataGovernanceStartup?.evidenceReady === false, 'Production data-governance startup readiness must require signed managed-production evidence.');
  assert(readiness.gates?.some((gate) => gate.id === 'production-traffic-controls' && gate.passed === false), 'Production traffic-control gate must block by default.');
  assert(readiness.productionTrafficStartup?.schemaVersion === 'production-traffic-startup-readiness/v1', 'Public production startup readiness must expose production traffic startup readiness evidence.');
  assert(readiness.productionTrafficStartup?.ready === false, 'Production traffic startup readiness must block by default.');
  assert(readiness.productionTrafficStartup?.domainTlsConfigured === false, 'Production traffic startup readiness must require production domain/TLS controls.');
  assert(readiness.productionTrafficStartup?.trafficGatewayConfigured === false, 'Production traffic startup readiness must require traffic gateway and health check controls.');
  assert(readiness.productionTrafficStartup?.releaseApprovalConfigured === false, 'Production traffic startup readiness must require release approval.');
  assert(readiness.productionTrafficStartup?.rollbackConfigured === false, 'Production traffic startup readiness must require rollback smoke-test controls.');
  assert(readiness.productionTrafficStartup?.evidenceReady === false, 'Production traffic startup readiness must require signed managed-production evidence.');
  assert(readiness.gates?.some((gate) => gate.id === 'customer-production-acceptance-policy' && gate.passed === false), 'Customer production acceptance policy gate must block by default.');
  assert(readiness.productionCustomerAcceptanceStartup?.schemaVersion === 'production-customer-acceptance-startup-readiness/v1', 'Public production startup readiness must expose customer production acceptance readiness evidence.');
  assert(readiness.productionCustomerAcceptanceStartup?.ready === false, 'Customer production acceptance startup readiness must block by default.');
  assert(readiness.productionCustomerAcceptanceStartup?.policyConfigured === false, 'Customer production acceptance readiness must require a configured policy and thresholds.');
  assert(readiness.productionCustomerAcceptanceStartup?.successCriteriaConfigured === false, 'Customer production acceptance readiness must require customer success criteria.');
  assert(readiness.productionCustomerAcceptanceStartup?.approvalConfigured === false, 'Customer production acceptance readiness must require human approval authority.');
  assert(readiness.productionCustomerAcceptanceStartup?.rollbackCriteriaConfigured === false, 'Customer production acceptance readiness must require rollback criteria.');
  assert(readiness.productionCustomerAcceptanceStartup?.evidenceReady === false, 'Customer production acceptance readiness must require signed managed-production evidence.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-secret-manager-or-kms' && gate.passed === false), 'Managed Secret Manager/KMS gate must block local-only startup.');
  assert(readiness.managedSecretManager?.schemaVersion === 'managed-secret-manager-readiness/v1', 'Public production startup readiness must expose managed Secret Manager/KMS readiness evidence.');
  assert(readiness.managedSecretManager?.ready === false, 'Managed Secret Manager/KMS readiness must block by default.');
  assert(readiness.managedSecretManager?.providerReady === false, 'Managed Secret Manager/KMS readiness must not treat the local provider as production ready.');
  assert(readiness.managedSecretManager?.configurationReady === false, 'Managed Secret Manager/KMS readiness must require managed endpoint/key configuration.');
  assert(readiness.managedSecretManager?.attestationReady === false, 'Managed Secret Manager/KMS readiness must require attestation evidence.');
  assert(readiness.managedSecretManager?.missingAnyOfEnvVarGroups?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ATTESTATION_ID')), 'Managed Secret Manager/KMS readiness must expose missing attestation id env names.');
  assert(readiness.managedSecretManager?.missingAnyOfEnvVarGroups?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM')), 'Managed Secret Manager/KMS readiness must expose missing attestation checksum env names.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-persistence-real-adapter' && gate.passed === false), 'Managed persistence gate must block local-shadow startup.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-worker-queue-real-adapter' && gate.passed === false), 'Managed worker queue gate must block local-shadow startup.');
  assert(readiness.managedInfrastructureCutover?.schemaVersion === 'managed-infrastructure-cutover-readiness/v1', 'Public production startup readiness must expose managed infrastructure cutover readiness evidence.');
  assert(readiness.managedInfrastructureCutover?.ready === false, 'Managed infrastructure cutover readiness must block by default.');
  assert(readiness.managedInfrastructureCutover?.rows?.some((row) => (
    row.id === 'managed-persistence'
    && row.ready === false
    && row.configurationReady === false
    && row.cutoverReady === false
    && row.localShadow === true
  )), 'Managed infrastructure cutover readiness must show local-shadow persistence as blocked.');
  assert(readiness.managedInfrastructureCutover?.rows?.some((row) => (
    row.id === 'managed-worker-queue'
    && row.ready === false
    && row.configurationReady === false
    && row.cutoverReady === false
    && row.localShadow === true
  )), 'Managed infrastructure cutover readiness must show local-shadow queue as blocked.');
  assert(readiness.productionOperationsStartup?.schemaVersion === 'production-operations-startup-readiness/v1', 'Public production startup readiness must expose production operations startup readiness evidence.');
  assert(readiness.productionOperationsStartup?.ready === false, 'Production operations startup readiness must block by default.');
  assert(readiness.productionOperationsStartup?.rows?.some((row) => (
    row.id === 'observability'
    && row.configurationReady === false
    && row.evidenceReady === false
    && row.ready === false
  )), 'Production operations startup readiness must show missing observability config/evidence.');
  assert(readiness.productionOperationsStartup?.rows?.some((row) => (
    row.id === 'incident-response'
    && row.configurationReady === false
    && row.evidenceReady === false
    && row.ready === false
  )), 'Production operations startup readiness must show missing incident response config/evidence.');
  assert(readiness.productionBlockers?.length >= 8, 'Public production startup readiness must list concrete production blockers.');
  assert(readiness.nextAction?.id === 'access-control-enforced', 'Public production startup readiness must point to the first missing production gate.');
  assert(readiness.productionEnvironmentSetup?.schemaVersion === 'production-environment-setup/v1', 'Public production startup readiness must expose the production environment setup matrix.');
  assert(readiness.productionEnvironmentSetup?.readyForPublicProduction === false, 'Production environment setup matrix must keep public production blocked.');
  assert(readiness.productionEnvironmentSetup?.summary?.blockedRowCount >= 1, 'Production environment setup matrix must expose blocked setup rows.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'managed-identity'
    && row.status === 'blocked'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_IDENTITY_PROVIDER')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_SERVICE_IDENTITY_AUDIENCE')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE')
    && row.nextAction
  )), 'Production environment setup matrix must show managed identity provider and service identity gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'production-cost-controls'
    && row.status === 'blocked'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE')
    && row.missingAnyOfEnvVarGroups?.some((group) => group.includes('PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT'))
    && row.missingAnyOfEnvVarGroups?.some((group) => group.includes('PRODUCTION_COST_ALERT_ENDPOINT'))
    && row.nextAction
  )), 'Production environment setup matrix must show production provider cost-control gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'production-data-governance'
    && row.status === 'blocked'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_DATA_RETENTION_POLICY_ID')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_DATA_DELETION_JOB_ENDPOINT')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE')
    && row.nextAction
  )), 'Production environment setup matrix must show production data governance gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'production-traffic'
    && row.status === 'blocked'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_DOMAIN_NAME')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_ROLLBACK_SMOKE_TEST_URL')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE')
    && row.nextAction
  )), 'Production environment setup matrix must show production traffic, health check, approval, and rollback gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'customer-production-acceptance'
    && row.status === 'blocked'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE')
    && row.nextAction
  )), 'Production environment setup matrix must show customer production acceptance policy gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'managed-secrets'
    && row.status === 'blocked'
    && row.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ATTESTATION_ID'))
    && row.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM'))
    && row.nextAction
  )), 'Production environment setup matrix must show managed Secret Manager/KMS provider plus attestation gaps.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'managed-persistence'
    && row.status === 'blocked'
    && row.anyOfEnvVarGroups?.flat?.().includes('MANAGED_PERSISTENCE_DATABASE_URL')
    && row.nextAction
  )), 'Production environment setup matrix must show the managed persistence configuration gap.');
  assert(readiness.productionEnvironmentSetup?.rows?.some((row) => (
    row.id === 'incident-response'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_ONCALL_OWNER')
    && row.anyOfEnvVarGroups?.flat?.().includes('PRODUCTION_PAGERDUTY_ROUTING_KEY')
  )), 'Production environment setup matrix must show concrete incident-response env gaps.');
  assert(readiness.productionEnvironmentSetup?.nextAction?.validationCommand === 'npm run agents:public-production-startup-readiness', 'Production environment setup next action must point to the focused validation command.');
  assert(readiness.publicProductionActionPlan?.schemaVersion === 'public-production-action-plan/v1', 'Public production startup readiness must expose the public production action plan.');
  assert(readiness.publicProductionActionPlan?.readyForPublicProduction === false, 'Public production action plan must keep public production blocked.');
  assert(readiness.publicProductionActionPlan?.actionCount >= readiness.productionEnvironmentSetup.summary.blockedRowCount, 'Public production action plan must cover blocked setup rows.');
  assert(readiness.publicProductionActionPlan?.actions?.some((action) => (
    action.id === 'setup-managed-persistence'
    && action.validationCommand
    && action.requiredEnvVars?.includes('MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER')
  )), 'Public production action plan must include a routed managed persistence action.');
  assert(readiness.publicProductionActionPlan?.validationCommands?.includes('npm run agents:production-provider-controls'), 'Public production action plan must aggregate focused provider/BYOK validation commands.');
  assert(readiness.publicProductionActionPlan?.actions?.some((action) => (
    action.id === 'setup-production-cost-controls'
    && action.validationCommand === 'npm run agents:production-provider-controls'
    && action.requiredEnvVars?.includes('PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS')
  )), 'Public production action plan must include a focused provider/BYOK setup action.');
  assert(readiness.publicProductionActionPlan?.actions?.some((action) => (
    action.id === 'setup-customer-production-acceptance'
    && action.domain === 'governance'
    && action.requiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID')
  )), 'Public production action plan must include a customer production acceptance action.');

  response = blockedApi.handle({
    method: 'GET',
    path: '/settings/runtime-readiness',
  });
  assert(response.status === 200, `Settings runtime readiness returned ${response.status}.`);
  const runtimeReadiness = response.body.settingsRuntimeReadiness;
  assert(runtimeReadiness.rows?.some((row) => row.id === 'public-production-startup-readiness' && row.route === '/public-production-startup-readiness'), 'Settings runtime readiness must expose the public production startup row.');
  assert(runtimeReadiness.backendRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness', 'Settings runtime readiness must link the public production startup route.');
  assert(runtimeReadiness.summary?.publicProductionStartupReady === false, 'Settings runtime readiness must keep public production startup blocked.');

  response = blockedApi.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: validationProjectId,
      name: 'Public Production Startup Readiness Project',
      brief: 'Validate public production startup readiness as a Manager proof surface.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
    },
  });
  assert(response.status === 200, `Public production startup validation project returned ${response.status}.`);

  response = blockedApi.handle({
    method: 'GET',
    path: `/projects/${validationProjectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Public production startup proof map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.publicProductionStartupReadinessSummary?.count === 1, 'Readiness Proof Map must expose public production startup readiness.');
  assert(proofMap.publicProductionStartupReadinessRoutes?.[0]?.apiPath === '/public-production-startup-readiness', 'Public production startup proof route must point to the global API.');
  assert(proofMap.publicProductionStartupReadinessRoutes?.[0]?.readyForPublicProduction === false, 'Public production startup proof route must not claim public production readiness.');
  assert(proofMap.publicProductionStartupReadinessRoutes?.[0]?.productionBlocker === true, 'Public production startup proof route must stay marked as a production blocker.');
  assert(proofMap.productionLaunchGapRoutes?.some((route) => (
    route.apiPath?.endsWith('/production-launch-gap-register')
    && route.publicProductionEnvironmentSetupOpenCount >= 1
    && route.publicProductionStartupReady === false
  )), 'Readiness Proof Map production launch gap route must expose public environment setup gaps.');
  assert(proofMap.productionLaunchGapSummary?.publicProductionEnvironmentSetupOpenCount >= 1, 'Readiness Proof Map production launch gap summary must count public environment setup gaps.');
  assert(proofMap.productionLaunchGapSummary?.publicProductionEnvironmentSetupBlockedDomains?.includes('release-governance'), 'Readiness Proof Map production launch gap summary must include customer acceptance release-governance setup gaps.');

  response = blockedApi.handle({
    method: 'GET',
    path: `/projects/${validationProjectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Public production startup Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.publicProductionStartupReadiness?.schemaVersion === 'public-production-startup-readiness/v1', 'Manager Ready Package must include public production startup readiness.');
  assert(managerReadyPackage.publicProductionStartupReadiness?.readyForPublicProduction === false, 'Manager Ready Package must keep public production startup blocked.');
  assert(managerReadyPackage.backendRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness', 'Manager Ready Package must link the public production startup route.');
  assert(managerReadyPackage.summary?.publicProductionStartupReady === false, 'Manager Ready Package summary must expose the blocked public startup status.');
  assert(managerReadyPackage.summary?.publicProductionStartupFailedBlockerGateCount >= 1, 'Manager Ready Package summary must expose public production blocker count.');
  assert(managerReadyPackage.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'public-production-startup-readiness' && row.ready === false && row.apiPath === '/public-production-startup-readiness'), 'Production launch control center must include the global public production startup blocker.');
  assert(managerReadyPackage.productionLaunchControlCenter?.stageRows?.some((row) => row.id === 'public-production-startup' && row.ready === false), 'Production launch control center must expose public production startup as a blocked stage.');
  assert(managerReadyPackage.productionLaunchControlCenter?.summary?.publicProductionStartupReady === false, 'Production launch control center summary must keep public production startup blocked.');
  assert(managerReadyPackage.productionLaunchGapRegister?.gapRows?.some((row) => (
    row.source === 'public-production-environment-setup'
    && row.id === 'public-production-environment-managed-persistence'
    && row.apiPath === '/public-production-startup-readiness'
    && row.validationCommand
  )), 'Production launch gap register must project public production environment setup rows as routed gaps.');
  assert(managerReadyPackage.productionLaunchGapRegister?.gapRows?.some((row) => (
    row.source === 'public-production-environment-setup'
    && row.id === 'public-production-environment-customer-production-acceptance'
    && row.domain === 'release-governance'
    && row.owner === 'manager'
    && row.apiPath === '/public-production-startup-readiness'
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID')
    && row.missingRequiredEnvVars?.includes('PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE')
  )), 'Production launch gap register must project customer production acceptance setup as a routed release-governance gap.');
  assert(managerReadyPackage.productionLaunchGapRegister?.summary?.publicProductionEnvironmentSetupOpenCount >= 1, 'Production launch gap register summary must count public production environment setup gaps.');

  response = blockedApi.handle({
    method: 'GET',
    path: `/projects/${validationProjectId}/production-launch-gap-register`,
  });
  assert(response.status === 200, `Public production setup gap register returned ${response.status}.`);
  const gapRegister = response.body.productionLaunchGapRegister;
  assert(gapRegister?.gapRows?.some((row) => (
    row.source === 'public-production-environment-setup'
    && row.missingAnyOfEnvVarGroups?.some((group) => group.includes('MANAGED_PERSISTENCE_DATABASE_URL'))
  )), 'Standalone production launch gap register must expose managed persistence env setup gaps.');
  assert(gapRegister?.gapRows?.some((row) => (
    row.source === 'public-production-environment-setup'
    && row.id === 'public-production-environment-customer-production-acceptance'
    && row.domain === 'release-governance'
    && row.owner === 'manager'
    && row.apiPath === '/public-production-startup-readiness'
    && row.validationCommand === 'npm run agents:public-production-startup-readiness'
  )), 'Standalone production launch gap register must expose customer production acceptance as a release-governance setup gap.');
  assert(gapRegister?.summary?.publicProductionStartupReady === false, 'Standalone production launch gap register must carry the blocked public startup summary.');

  response = blockedApi.handle({
    method: 'GET',
    path: `/projects/${validationProjectId}/manager-flow-graph`,
  });
  assert(response.status === 200, `Public production startup Flow Graph returned ${response.status}.`);
  assert(response.body.nodes?.some((node) => (
    node.id === 'public-production-startup-readiness'
    && node.status === 'blocked'
    && node.route === '/public-production-startup-readiness'
  )), 'Manager Flow Graph must expose the public production startup readiness blocker node.');
  assert(response.body.edges?.some((edge) => (
    edge.fromNodeId === 'public-production-startup-readiness'
    && edge.toNodeId === 'production-launch-control-center'
    && edge.source === 'publicProductionStartupReadiness'
  )), 'Manager Flow Graph must connect public startup readiness into Production Launch Control Center.');
  assert(response.body.nodes?.some((node) => (
    node.id === 'production-launch-gap-register'
    && node.attachments?.some((attachment) => (
      attachment.type === 'production-launch-gap-register'
      && attachment.publicProductionEnvironmentSetupOpenCount >= 1
      && attachment.summary?.includes('public environment setup')
    ))
  )), 'Manager Flow Graph production launch gap register node must expose public environment setup gap evidence.');

  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: 'public-production-startup-readiness-validation-key',
    keyId: 'public-production-startup-readiness-v1',
  });
  const vaultApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'vault-store.json'),
    replaceWithSeed: true,
    secretVault,
  });

  response = await vaultApi.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    body: {
      name: 'model.apiKey',
      value: plaintextSecret,
      scope: 'model-provider',
      source: 'public-production-startup-readiness-validation',
      metadata: {
        providerKind: 'model',
        secretKind: 'api-key',
      },
    },
  });
  assert(response.status === 200, `Secret Vault seal returned ${response.status}.`);

  response = vaultApi.handle({
    method: 'GET',
    path: '/public-production-startup-readiness',
  });
  readiness = response.body.publicProductionStartupReadiness;
  const serialized = JSON.stringify(readiness);
  assert(readiness.providerRuntime?.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Public production startup readiness must keep provider-vault metadata redacted.');
  assert(readiness.productionEnvironmentSetup?.rows?.every((row) => !('value' in row) && !('redactedValue' in row)), 'Production environment setup rows must not expose env values.');
  assert(readiness.managedSecretManager?.configuredEnvVars?.every((key) => envKeys.includes(key)), 'Managed Secret Manager/KMS readiness must only expose configured env names from the approved allowlist.');
  assert(readiness.managedIdentityStartup?.configuredEnvVars?.every((key) => envKeys.includes(key)), 'Managed identity startup readiness must only expose configured env names from the approved allowlist.');
  assert(!serialized.includes(plaintextSecret), 'Public production startup readiness must not expose plaintext provider secrets.');
  assert(readiness.readyForPublicProduction === false, 'Local Secret Vault proof must not promote public production readiness.');
  assert(readiness.productionBlockers?.some((row) => row.id === 'managed-secret-manager-or-kms'), 'Local Secret Vault proof must keep managed KMS/Secret Manager as a blocker.');

  process.env.PRODUCTION_IDENTITY_PROVIDER = 'oidc';
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer?token=identity-token-should-not-leak';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json?token=jwks-token-should-not-leak';
  process.env.PRODUCTION_SERVICE_IDENTITY_AUDIENCE = 'hofs-public-production';
  process.env.PRODUCTION_SERVICE_IDENTITY_SUBJECT = 'service-account:hcx-agent-runtime';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID = 'identity-receipt-env-only';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM = 'identity-checksum-env-only';
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = 'sig_invalid_identity';
  process.env.PRODUCTION_PROVIDER_DAILY_BUDGET_CENTS = '250000';
  process.env.PRODUCTION_PROVIDER_HOURLY_REQUEST_LIMIT = '12000';
  process.env.PRODUCTION_PROVIDER_USAGE_AUDIT_ENDPOINT = 'https://provider-audit.example.test/usage?token=usage-audit-token-should-not-leak';
  process.env.PRODUCTION_COST_ALERT_ENDPOINT = 'https://cost-alerts.example.test/page?key=cost-alert-key-should-not-leak';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID = 'cost-control-receipt-env-only';
  process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM = 'cost-control-checksum-env-only';
  process.env.PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE = 'sig_invalid_cost';
  process.env.PRODUCTION_DATA_RETENTION_POLICY_ID = 'retention-policy-env-only';
  process.env.PRODUCTION_DATA_RESIDENCY_REGION = 'us-managed-region';
  process.env.PRODUCTION_DATA_DELETION_JOB_ENDPOINT = 'https://deletion.example.test/jobs?token=delete-token-should-not-leak';
  process.env.PRODUCTION_DATA_EXPORT_STORAGE_ENDPOINT = 'https://exports.example.test/bucket?token=export-token-should-not-leak';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID = 'data-governance-receipt-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM = 'data-governance-checksum-env-only';
  process.env.PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE = 'sig_invalid_data_governance';
  process.env.PRODUCTION_DOMAIN_NAME = 'app.example.test';
  process.env.PRODUCTION_TLS_CERTIFICATE_ID = 'tls-cert-env-only';
  process.env.PRODUCTION_TRAFFIC_GATEWAY_ENDPOINT = 'https://traffic.example.test/route?token=traffic-token-should-not-leak';
  process.env.PRODUCTION_HEALTHCHECK_URL = 'https://app.example.test/health?token=health-token-should-not-leak';
  process.env.PRODUCTION_RELEASE_APPROVAL_ID = 'release-approval-env-only';
  process.env.PRODUCTION_ROLLBACK_RUNBOOK_ID = 'rollback-runbook-env-only';
  process.env.PRODUCTION_ROLLBACK_SMOKE_TEST_URL = 'https://app.example.test/rollback-smoke?token=rollback-token-should-not-leak';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID = 'traffic-control-receipt-env-only';
  process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM = 'traffic-control-checksum-env-only';
  process.env.PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE = 'sig_invalid_traffic';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_POLICY_ID = 'customer-acceptance-policy-env-only';
  process.env.PRODUCTION_CUSTOMER_SUCCESS_CRITERIA_ID = 'customer-success-criteria-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_THRESHOLD_PERCENT = '95';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVER_ROLE = 'customer-approver-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_APPROVAL_ID = 'customer-approval-env-only';
  process.env.PRODUCTION_CUSTOMER_ROLLBACK_CRITERIA_ID = 'customer-rollback-criteria-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID = 'customer-acceptance-receipt-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM = 'customer-acceptance-checksum-env-only';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE = 'sig_invalid_customer_acceptance';
  process.env.MANAGED_SECRET_MANAGER_ENDPOINT = 'https://managed-secret.example.test';
  process.env.MANAGED_KMS_KEY_ID = 'kms-key-env-only-should-not-pass';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_ID = 'managed-secret-attestation-env-only';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM = 'managed-secret-attestation-checksum-env-only';
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'postgres';
  process.env.MANAGED_PERSISTENCE_DATABASE_URL = 'postgres://user:db-password-should-not-leak@managed-db.example.test/hofs?secret=db-query-secret';
  process.env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = 'https://queue.example.test/enqueue?token=queue-token-should-not-leak';
  process.env.WORKER_QUEUE_REQUIRE_REAL_ADAPTER = 'true';
  process.env.PRODUCTION_OBSERVABILITY_ENDPOINT = 'https://observability.example.test/ingest?token=observability-token-should-not-leak';
  process.env.PRODUCTION_ALERT_ROUTING_ENDPOINT = 'https://alerts.example.test/page?key=alert-routing-key-should-not-leak';
  process.env.PRODUCTION_ONCALL_SCHEDULE_ID = 'oncall-schedule-env-only';
  process.env.PRODUCTION_ONCALL_OWNER = 'ops-owner-env-only';
  process.env.PRODUCTION_INCIDENT_SYSTEM_ENDPOINT = 'https://incidents.example.test/api?token=incident-token-should-not-leak';
  process.env.PRODUCTION_INCIDENT_PROJECT_KEY = 'incident-project-env-only';
  process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_ID = 'restore-drill-env-only';
  process.env.PRODUCTION_RESTORE_DRILL_COMPLETED_AT = '2026-07-06T00:00:00.000Z';
  process.env.PRODUCTION_SECURITY_AUDIT_SINK = 'https://audit.example.test/append?token=audit-token-should-not-leak';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = 'startup-attestation-signing-secret-should-not-leak';
  process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_ID = 'observability-receipt-env-only';
  process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_CHECKSUM = 'observability-checksum-env-only';
  process.env.PRODUCTION_OBSERVABILITY_CONTROL_ATTESTATION_SIGNATURE = 'sig_invalid_observability';
  process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_ID = 'incident-response-receipt-env-only';
  process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_CHECKSUM = 'incident-response-checksum-env-only';
  process.env.PRODUCTION_INCIDENT_RESPONSE_ATTESTATION_SIGNATURE = 'sig_invalid_incident';
  process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_CHECKSUM = 'restore-drill-checksum-env-only';
  process.env.PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE = 'sig_invalid_restore';
  process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_ID = 'audit-retention-receipt-env-only';
  process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_CHECKSUM = 'audit-retention-checksum-env-only';
  process.env.PRODUCTION_AUDIT_RETENTION_ATTESTATION_SIGNATURE = 'sig_invalid_audit';
  response = vaultApi.handle({
    method: 'GET',
    path: '/public-production-startup-readiness',
  });
  const envOnlyReadiness = response.body.publicProductionStartupReadiness;
  const envOnlySerialized = JSON.stringify(envOnlyReadiness);
  assert(envOnlyReadiness.managedIdentityStartup?.providerConfigured === true, 'Managed identity startup readiness must recognize configured identity provider metadata.');
  assert(envOnlyReadiness.managedIdentityStartup?.serviceIdentityConfigured === true, 'Managed identity startup readiness must recognize configured service identity boundaries.');
  assert(envOnlyReadiness.managedIdentityStartup?.evidenceReady === false, 'Managed identity startup readiness must reject invalid or unsigned managed-production evidence.');
  assert(envOnlyReadiness.managedIdentityStartup?.attestationSignatureReady === false, 'Managed identity startup readiness must not accept invalid attestation signatures.');
  assert(envOnlyReadiness.managedIdentityStartup?.ready === false, 'Managed identity startup readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'managed-identity-provider' && gate.passed === false), 'Managed identity provider gate must stay blocked without valid managed-production evidence.');
  assert(!envOnlySerialized.includes('identity-token-should-not-leak'), 'Managed identity startup readiness must not expose identity issuer token values.');
  assert(!envOnlySerialized.includes('jwks-token-should-not-leak'), 'Managed identity startup readiness must not expose JWKS URI token values.');
  assert(!envOnlySerialized.includes('identity-checksum-env-only'), 'Managed identity startup readiness must not expose identity receipt checksum values.');
  assert(envOnlyReadiness.productionCostControlStartup?.budgetPolicyConfigured === true, 'Production cost-control startup readiness must recognize configured budget/rate policy.');
  assert(envOnlyReadiness.productionCostControlStartup?.usageAuditConfigured === true, 'Production cost-control startup readiness must recognize configured usage audit sink.');
  assert(envOnlyReadiness.productionCostControlStartup?.alertRoutingConfigured === true, 'Production cost-control startup readiness must recognize configured cost alert routing.');
  assert(envOnlyReadiness.productionCostControlStartup?.evidenceReady === false, 'Production cost-control startup readiness must reject invalid or unsigned managed-production evidence.');
  assert(envOnlyReadiness.productionCostControlStartup?.attestationSignatureReady === false, 'Production cost-control startup readiness must not accept invalid cost-control attestation signatures.');
  assert(envOnlyReadiness.productionCostControlStartup?.ready === false, 'Production cost-control startup readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'production-cost-controls' && gate.passed === false), 'Production cost-control gate must stay blocked without valid managed-production evidence.');
  assert(!envOnlySerialized.includes('usage-audit-token-should-not-leak'), 'Production cost-control startup readiness must not expose usage audit endpoint token values.');
  assert(!envOnlySerialized.includes('cost-alert-key-should-not-leak'), 'Production cost-control startup readiness must not expose cost alert token values.');
  assert(!envOnlySerialized.includes('cost-control-checksum-env-only'), 'Production cost-control startup readiness must not expose cost-control receipt checksum values.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.retentionPolicyConfigured === true, 'Production data-governance startup readiness must recognize configured retention/residency policy.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.deletionJobConfigured === true, 'Production data-governance startup readiness must recognize configured deletion job.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.exportStorageConfigured === true, 'Production data-governance startup readiness must recognize configured export storage.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.evidenceReady === false, 'Production data-governance startup readiness must reject invalid or unsigned managed-production evidence.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.attestationSignatureReady === false, 'Production data-governance startup readiness must not accept invalid data-governance attestation signatures.');
  assert(envOnlyReadiness.productionDataGovernanceStartup?.ready === false, 'Production data-governance startup readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'production-data-governance' && gate.passed === false), 'Production data-governance gate must stay blocked without valid managed-production evidence.');
  assert(!envOnlySerialized.includes('delete-token-should-not-leak'), 'Production data-governance startup readiness must not expose deletion endpoint token values.');
  assert(!envOnlySerialized.includes('export-token-should-not-leak'), 'Production data-governance startup readiness must not expose export storage token values.');
  assert(!envOnlySerialized.includes('data-governance-checksum-env-only'), 'Production data-governance startup readiness must not expose data-governance receipt checksum values.');
  assert(envOnlyReadiness.productionTrafficStartup?.domainTlsConfigured === true, 'Production traffic startup readiness must recognize configured production domain/TLS controls.');
  assert(envOnlyReadiness.productionTrafficStartup?.trafficGatewayConfigured === true, 'Production traffic startup readiness must recognize configured traffic gateway and health check controls.');
  assert(envOnlyReadiness.productionTrafficStartup?.releaseApprovalConfigured === true, 'Production traffic startup readiness must recognize configured release approval.');
  assert(envOnlyReadiness.productionTrafficStartup?.rollbackConfigured === true, 'Production traffic startup readiness must recognize configured rollback controls.');
  assert(envOnlyReadiness.productionTrafficStartup?.evidenceReady === false, 'Production traffic startup readiness must reject invalid or unsigned managed-production evidence.');
  assert(envOnlyReadiness.productionTrafficStartup?.attestationSignatureReady === false, 'Production traffic startup readiness must not accept invalid traffic-control attestation signatures.');
  assert(envOnlyReadiness.productionTrafficStartup?.ready === false, 'Production traffic startup readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'production-traffic-controls' && gate.passed === false), 'Production traffic-control gate must stay blocked without valid managed-production evidence.');
  assert(!envOnlySerialized.includes('traffic-token-should-not-leak'), 'Production traffic startup readiness must not expose traffic gateway token values.');
  assert(!envOnlySerialized.includes('health-token-should-not-leak'), 'Production traffic startup readiness must not expose health check token values.');
  assert(!envOnlySerialized.includes('rollback-token-should-not-leak'), 'Production traffic startup readiness must not expose rollback smoke-test token values.');
  assert(!envOnlySerialized.includes('traffic-control-checksum-env-only'), 'Production traffic startup readiness must not expose traffic-control receipt checksum values.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.policyConfigured === true, 'Customer production acceptance startup readiness must recognize configured policy env names.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.successCriteriaConfigured === true, 'Customer production acceptance startup readiness must recognize configured success criteria.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.approvalConfigured === true, 'Customer production acceptance startup readiness must recognize configured approval authority.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.rollbackCriteriaConfigured === true, 'Customer production acceptance startup readiness must recognize configured rollback criteria.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.evidenceReady === false, 'Customer production acceptance startup readiness must reject invalid or unsigned managed-production evidence.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.attestationSignatureReady === false, 'Customer production acceptance startup readiness must not accept invalid customer-acceptance attestation signatures.');
  assert(envOnlyReadiness.productionCustomerAcceptanceStartup?.ready === false, 'Customer production acceptance startup readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'customer-production-acceptance-policy' && gate.passed === false), 'Customer production acceptance gate must stay blocked without valid managed-production evidence.');
  assert(!envOnlySerialized.includes('customer-acceptance-checksum-env-only'), 'Customer production acceptance startup readiness must not expose customer acceptance receipt checksum values.');
  assert(envOnlyReadiness.managedSecretManager?.configurationReady === true, 'Managed Secret Manager/KMS readiness must recognize configured env names.');
  assert(envOnlyReadiness.managedSecretManager?.attestationReady === true, 'Managed Secret Manager/KMS readiness must recognize a matched attestation id/checksum pair.');
  assert(envOnlyReadiness.managedSecretManager?.providerReady === false, 'Managed Secret Manager/KMS readiness must still reject local vault even when env names are configured.');
  assert(envOnlyReadiness.managedSecretManager?.ready === false, 'Managed Secret Manager/KMS readiness must not pass from env names alone.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'managed-secret-manager-or-kms' && gate.passed === false), 'Managed Secret Manager/KMS gate must stay blocked when only env names and local vault are present.');
  assert(envOnlyReadiness.readyForPublicProduction === false, 'Env-only managed Secret Manager/KMS proof must not promote public production readiness.');
  assert(!envOnlySerialized.includes('https://managed-secret.example.test'), 'Public production startup readiness must not expose managed Secret Manager endpoint values.');
  assert(!envOnlySerialized.includes('managed-secret-attestation-checksum-env-only'), 'Public production startup readiness must not expose managed Secret Manager attestation checksum values.');
  const envOnlyCutover = envOnlyReadiness.managedInfrastructureCutover;
  const envOnlyCutoverSerialized = JSON.stringify(envOnlyCutover);
  assert(envOnlyCutover?.rows?.some((row) => (
    row.id === 'managed-persistence'
    && row.configurationReady === true
    && row.requireRealAdapter === true
    && row.cutoverReady === false
    && row.ready === false
  )), 'Managed infrastructure cutover readiness must keep persistence blocked when env config exists without cutover proof.');
  assert(envOnlyCutover?.rows?.some((row) => (
    row.id === 'managed-worker-queue'
    && row.configurationReady === true
    && row.requireRealAdapter === true
    && row.cutoverReady === false
    && row.ready === false
  )), 'Managed infrastructure cutover readiness must keep worker queue blocked when env config exists without cutover proof.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'managed-persistence-real-adapter' && gate.passed === false), 'Managed persistence gate must stay blocked without cutover proof.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'managed-worker-queue-real-adapter' && gate.passed === false), 'Managed worker queue gate must stay blocked without cutover proof.');
  assert(!envOnlyCutoverSerialized.includes('db-password-should-not-leak'), 'Managed infrastructure cutover readiness must not expose database password values.');
  assert(!envOnlyCutoverSerialized.includes('queue-token-should-not-leak'), 'Managed infrastructure cutover readiness must not expose queue token values.');
  const envOnlyOperations = envOnlyReadiness.productionOperationsStartup;
  const envOnlyOperationsSerialized = JSON.stringify(envOnlyOperations);
  assert(envOnlyOperations?.rows?.some((row) => (
    row.id === 'observability'
    && row.configurationReady === true
    && row.evidenceReady === false
    && row.attestationSignatureReady === false
    && row.attestationFailureReason === 'managed-production-attestation-signature-invalid'
    && row.ready === false
  )), 'Production operations startup readiness must keep observability blocked when endpoint config exists without evidence receipts.');
  assert(envOnlyOperations?.rows?.some((row) => (
    row.id === 'incident-response'
    && row.configurationReady === true
    && row.evidenceReady === false
    && row.attestationSignatureReady === false
    && row.ready === false
  )), 'Production operations startup readiness must keep incident response blocked when config exists without evidence receipts.');
  assert(envOnlyOperations?.rows?.some((row) => (
    row.id === 'restore-drill'
    && row.configurationReady === true
    && row.evidenceReady === false
    && row.attestationSignatureReady === false
    && row.ready === false
  )), 'Production operations startup readiness must keep restore drill blocked without receipt checksum evidence.');
  assert(envOnlyOperations?.rows?.some((row) => (
    row.id === 'audit-retention'
    && row.configurationReady === true
    && row.evidenceReady === false
    && row.attestationSignatureReady === false
    && row.ready === false
  )), 'Production operations startup readiness must keep audit retention blocked when sink config exists without evidence receipts.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'centralized-observability' && gate.passed === false), 'Centralized observability gate must stay blocked without evidence receipts.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'production-incident-system' && gate.passed === false), 'Production incident system gate must stay blocked without evidence receipts.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'restore-drill-receipt' && gate.passed === false), 'Restore drill gate must stay blocked without checksum evidence.');
  assert(envOnlyReadiness.gates?.some((gate) => gate.id === 'centralized-audit-retention' && gate.passed === false), 'Centralized audit gate must stay blocked without evidence receipts.');
  assert(!envOnlyOperationsSerialized.includes('observability-token-should-not-leak'), 'Production operations startup readiness must not expose observability endpoint token values.');
  assert(!envOnlyOperationsSerialized.includes('alert-routing-key-should-not-leak'), 'Production operations startup readiness must not expose alert routing key values.');
  assert(!envOnlyOperationsSerialized.includes('incident-token-should-not-leak'), 'Production operations startup readiness must not expose incident endpoint token values.');
  assert(!envOnlyOperationsSerialized.includes('audit-token-should-not-leak'), 'Production operations startup readiness must not expose audit sink token values.');
  assert(!envOnlySerialized.includes('startup-attestation-signing-secret-should-not-leak'), 'Public production startup readiness must not expose managed-production attestation signing secret values.');

  process.env.PRODUCTION_OBSERVABILITY_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    controlId: 'centralized-observability',
    evidenceId: process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_OBSERVABILITY_CONTROL_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_INCIDENT_RESPONSE_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    controlId: 'incident-response',
    evidenceId: process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_INCIDENT_RESPONSE_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_RESTORE_DRILL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    controlId: 'restore-drill',
    evidenceId: process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_RESTORE_DRILL_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_AUDIT_RETENTION_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    controlId: 'centralized-audit-retention',
    evidenceId: process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_AUDIT_RETENTION_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    domain: 'security',
    controlId: 'managed-identity-provider',
    evidenceId: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_COST_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    domain: 'provider',
    controlId: 'production-cost-controls',
    evidenceId: process.env.PRODUCTION_COST_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_COST_CONTROL_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_DATA_GOVERNANCE_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    domain: 'data-governance',
    controlId: 'production-data-governance',
    evidenceId: process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_DATA_GOVERNANCE_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_TRAFFIC_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    domain: 'deployment',
    controlId: 'production-traffic-control',
    evidenceId: process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_TRAFFIC_CONTROL_RECEIPT_CHECKSUM,
  });
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID = 'customer-acceptance-receipt-signed';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM = 'customer-acceptance-checksum-signed';
  process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_ATTESTATION_SIGNATURE = startupAttestationSignature({
    signingSecret: process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
    domain: 'customer-acceptance',
    controlId: 'customer-production-acceptance-policy',
    evidenceId: process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_CUSTOMER_ACCEPTANCE_RECEIPT_CHECKSUM,
  });
  response = vaultApi.handle({
    method: 'GET',
    path: '/public-production-startup-readiness',
  });
  const signedOperationsReadiness = response.body.publicProductionStartupReadiness;
  assert(signedOperationsReadiness.managedIdentityStartup?.ready === true, 'Managed identity startup readiness must accept matching managed-production identity attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'managed-identity-provider' && gate.passed === true), 'Managed identity provider gate must pass after signed identity evidence.');
  assert(signedOperationsReadiness.productionCostControlStartup?.ready === true, 'Production cost-control startup readiness must accept matching managed-production cost-control attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'production-cost-controls' && gate.passed === true), 'Production cost-control gate must pass after signed cost-control evidence.');
  assert(signedOperationsReadiness.productionDataGovernanceStartup?.ready === true, 'Production data-governance startup readiness must accept matching managed-production data-governance attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'production-data-governance' && gate.passed === true), 'Production data-governance gate must pass after signed data-governance evidence.');
  assert(signedOperationsReadiness.productionTrafficStartup?.ready === true, 'Production traffic startup readiness must accept matching managed-production traffic-control attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'production-traffic-controls' && gate.passed === true), 'Production traffic-control gate must pass after signed traffic-control evidence.');
  assert(signedOperationsReadiness.productionCustomerAcceptanceStartup?.ready === true, 'Customer production acceptance startup readiness must accept matching managed-production customer acceptance attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'customer-production-acceptance-policy' && gate.passed === true), 'Customer production acceptance gate must pass after signed customer acceptance evidence.');
  assert(signedOperationsReadiness.productionOperationsStartup?.rows?.every((row) => (
    row.configurationReady === true
    && row.evidenceReady === true
    && row.attestationSignatureReady === true
    && row.ready === true
  )), 'Production operations startup readiness must accept matching managed-production attestation signatures.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'centralized-observability' && gate.passed === true), 'Centralized observability gate must pass after signed evidence receipts.');
  assert(signedOperationsReadiness.gates?.some((gate) => gate.id === 'restore-drill-receipt' && gate.passed === true), 'Restore drill gate must pass after signed evidence receipts.');
  assert(signedOperationsReadiness.readyForPublicProduction === false, 'Signed operations evidence alone must not promote public production readiness while other managed controls remain blocked.');

  const appSource = readFileSync(resolve(repoRoot, 'src/App.jsx'), 'utf8');
  assert(appSource.includes('backend-public-production-startup-readiness-snapshot'), 'Manager Ready Package UI must expose public production startup readiness.');
  assert(appSource.includes('Public Production Startup Readiness') && appSource.includes('/public-production-startup-readiness'), 'Manager UI must expose the public production startup route and label.');
  assert(appSource.includes('backend-managed-identity-startup-readiness') && appSource.includes('Managed Identity Startup'), 'Manager UI must expose managed identity startup readiness from the backend startup contract.');
  assert(appSource.includes('managedIdentityStartup.providerConfigured') && appSource.includes('managedIdentityStartup.serviceIdentityConfigured'), 'Manager UI must render managed identity provider and service identity readiness without deriving them locally.');
  assert(appSource.includes('backend-production-cost-control-startup-readiness') && appSource.includes('Production Cost Control Startup'), 'Manager UI must expose production cost-control startup readiness from the backend startup contract.');
  assert(appSource.includes('productionCostControlStartup.budgetPolicyConfigured') && appSource.includes('productionCostControlStartup.usageAuditConfigured'), 'Manager UI must render production cost-control readiness without deriving it locally.');
  assert(appSource.includes('backend-production-data-governance-startup-readiness') && appSource.includes('Production Data Governance Startup'), 'Manager UI must expose production data-governance startup readiness from the backend startup contract.');
  assert(appSource.includes('productionDataGovernanceStartup.retentionPolicyConfigured') && appSource.includes('productionDataGovernanceStartup.deletionJobConfigured'), 'Manager UI must render production data-governance readiness without deriving it locally.');
  assert(appSource.includes('backend-production-traffic-startup-readiness') && appSource.includes('Production Traffic Startup'), 'Manager UI must expose production traffic startup readiness from the backend startup contract.');
  assert(appSource.includes('productionTrafficStartup.trafficGatewayConfigured') && appSource.includes('productionTrafficStartup.rollbackConfigured'), 'Manager UI must render production traffic and rollback readiness without deriving it locally.');
  assert(appSource.includes('backend-production-customer-acceptance-startup-readiness') && appSource.includes('Production Customer Acceptance Startup'), 'Manager UI must expose customer production acceptance startup readiness from the backend startup contract.');
  assert(appSource.includes('productionCustomerAcceptanceStartup.policyConfigured') && appSource.includes('productionCustomerAcceptanceStartup.rollbackCriteriaConfigured'), 'Manager UI must render customer production acceptance readiness without deriving it locally.');
  assert(appSource.includes('backend-managed-secret-manager-readiness') && appSource.includes('Managed Secret Manager Readiness'), 'Manager UI must expose managed Secret Manager/KMS readiness from the backend startup contract.');
  assert(appSource.includes('managedSecretManager.providerReady') && appSource.includes('managedSecretManager.attestationReady'), 'Manager UI must render provider and attestation readiness without deriving them locally.');
  assert(appSource.includes('backend-managed-infrastructure-cutover-readiness') && appSource.includes('Managed Infrastructure Cutover'), 'Manager UI must expose managed database/queue cutover readiness from the backend startup contract.');
  assert(appSource.includes('backend-managed-infrastructure-cutover-row-') && appSource.includes('cutoverReady'), 'Manager UI must render managed infrastructure cutover rows from backend data.');
  assert(appSource.includes('backend-production-operations-startup-readiness') && appSource.includes('Production Operations Startup'), 'Manager UI must expose production operations startup readiness from the backend startup contract.');
  assert(appSource.includes('backend-production-operations-startup-row-') && appSource.includes('evidenceReady') && appSource.includes('attestationSignatureReady'), 'Manager UI must render production operations startup rows from backend data.');
  assert(appSource.includes('backend-production-environment-setup-matrix'), 'Manager UI must expose the production environment setup matrix.');
  assert(appSource.includes('backend-production-environment-setup-row-') && appSource.includes('Production Environment Setup'), 'Manager UI must render production environment setup rows.');
  assert(appSource.includes('backend-public-production-action-plan') && appSource.includes('Public Production Action Plan'), 'Manager UI must expose the backend public production action plan.');
  assert(appSource.includes('backend-public-production-action-plan-row-') && appSource.includes('publicProductionActionPlan.actions'), 'Manager UI must render public production action plan rows from backend data.');
  assert(appSource.includes('backend-public-production-action-plan-required-env-') && appSource.includes('backend-public-production-action-plan-route-'), 'Manager UI must render required env names and routes for public production action plan rows.');
  assert(appSource.includes('publicProductionEnvironmentSetupOpenCount') && appSource.includes('Env Setup'), 'Manager UI gap register must surface public production environment setup gap counts.');

  console.log('Public production startup readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
