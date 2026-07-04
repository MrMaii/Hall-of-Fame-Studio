import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'public-production-startup-readiness-contract-validate');
const plaintextSecret = 'PUBLIC_PRODUCTION_STARTUP_SECRET_SHOULD_NOT_LEAK';
const validationProjectId = 'public_production_startup_readiness_project';
const envKeys = [
  'AGENT_ACCESS_CONTROL_MODE',
  'AGENT_ACCESS_SIGNING_SECRET',
  'AGENT_ACCESS_REPLAY_PROTECTION',
  'AGENT_ACCESS_AUDIT_FAIL_CLOSED',
  'PRODUCTION_SECRET_MANAGER_ENDPOINT',
  'PRODUCTION_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ENDPOINT',
  'MANAGED_KMS_KEY_ID',
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_DATABASE_URL',
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
  'PRODUCTION_ALERT_ROUTING_ENDPOINT',
  'PRODUCTION_PAGERDUTY_ROUTING_KEY',
  'PRODUCTION_OPSGENIE_ROUTING_KEY',
  'PRODUCTION_ONCALL_SCHEDULE_ID',
  'PRODUCTION_ONCALL_OWNER',
  'PRODUCTION_INCIDENT_SYSTEM_ENDPOINT',
  'PRODUCTION_INCIDENT_PROJECT_KEY',
  'PRODUCTION_RESTORE_DRILL_RECEIPT_ID',
  'PRODUCTION_RESTORE_DRILL_COMPLETED_AT',
  'PRODUCTION_SECURITY_AUDIT_SINK',
  'PRODUCTION_AUDIT_LOG_ENDPOINT',
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
    'managed-secret-manager-or-kms',
    'managed-persistence-real-adapter',
    'managed-worker-queue-real-adapter',
    'provider-runtime-and-redaction',
    'adapter-gateway-and-attestation',
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
  assert(readiness.gates?.some((gate) => gate.id === 'managed-secret-manager-or-kms' && gate.passed === false), 'Managed Secret Manager/KMS gate must block local-only startup.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-persistence-real-adapter' && gate.passed === false), 'Managed persistence gate must block local-shadow startup.');
  assert(readiness.gates?.some((gate) => gate.id === 'managed-worker-queue-real-adapter' && gate.passed === false), 'Managed worker queue gate must block local-shadow startup.');
  assert(readiness.productionBlockers?.length >= 8, 'Public production startup readiness must list concrete production blockers.');
  assert(readiness.nextAction?.id === 'access-control-enforced', 'Public production startup readiness must point to the first missing production gate.');

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
  assert(!serialized.includes(plaintextSecret), 'Public production startup readiness must not expose plaintext provider secrets.');
  assert(readiness.readyForPublicProduction === false, 'Local Secret Vault proof must not promote public production readiness.');
  assert(readiness.productionBlockers?.some((row) => row.id === 'managed-secret-manager-or-kms'), 'Local Secret Vault proof must keep managed KMS/Secret Manager as a blocker.');

  const appSource = readFileSync(resolve(repoRoot, 'src/App.jsx'), 'utf8');
  assert(appSource.includes('backend-public-production-startup-readiness-snapshot'), 'Manager Ready Package UI must expose public production startup readiness.');
  assert(appSource.includes('Public Production Startup Readiness') && appSource.includes('/public-production-startup-readiness'), 'Manager UI must expose the public production startup route and label.');

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
