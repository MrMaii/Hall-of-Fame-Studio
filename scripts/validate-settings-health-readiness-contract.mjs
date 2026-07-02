import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'settings-health-readiness-contract-validate');
const plaintextSecret = 'SETTINGS_HEALTH_SECRET_SHOULD_NOT_LEAK';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const blockedApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'blocked-store.json'),
    replaceWithSeed: true,
  });

  let response = blockedApi.handle({
    method: 'GET',
    path: '/settings/health-readiness',
  });
  assert(response.status === 200, `Blocked Settings health returned ${response.status}.`);
  let readiness = response.body.settingsHealthReadiness;
  assert(readiness?.schemaVersion === 'settings-health-readiness/v1', 'Settings health must expose its schema version.');
  assert(readiness.status === 'action-required', 'Settings health must require action when Secret Vault is missing.');
  assert(readiness.rows?.some((row) => row.id === 'backend-api' && row.status === 'pass'), 'Settings health must prove the backend API route is reachable.');
  assert(readiness.rows?.some((row) => row.id === 'secret-vault' && row.status === 'fail'), 'Settings health must fail the Secret Vault row when Vault is absent.');
  assert(readiness.backendRoutes?.settingsHealthReadiness === '/settings/health-readiness', 'Settings health must expose its route.');
  assert(readiness.backendRoutes?.localMvpStartupReadiness === '/local-mvp-startup-readiness', 'Settings health must link startup readiness.');
  assert(readiness.summary?.readyForProduction === false, 'Settings health must not claim production readiness.');
  assert(readiness.validationCommands?.includes('npm run agents:settings-health-readiness'), 'Settings health must expose its focused validation command.');

  response = blockedApi.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'settings_health_readiness_validation',
      name: 'Settings Health Readiness Validation',
      brief: 'Validate Settings health readiness as a Manager proof surface.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200, `Settings health validation project returned ${response.status}.`);

  response = blockedApi.handle({
    method: 'GET',
    path: '/projects/settings_health_readiness_validation/readiness-proof-map',
  });
  assert(response.status === 200, `Settings health proof map returned ${response.status}.`);
  let proofMap = response.body;
  assert(proofMap.settingsHealthReadinessSummary?.count === 1, 'Readiness Proof Map must expose Settings health readiness.');
  assert(proofMap.settingsHealthReadinessRoutes?.[0]?.apiPath === '/settings/health-readiness', 'Settings health proof route must point to the Settings health API.');
  assert(proofMap.settingsHealthReadinessRoutes?.[0]?.readyForProduction === false, 'Settings health proof route must not claim production readiness.');

  response = blockedApi.handle({
    method: 'GET',
    path: '/projects/settings_health_readiness_validation/manager-ready-package',
  });
  assert(response.status === 200, `Settings health Manager Ready Package returned ${response.status}.`);
  let managerReadyPackage = response.body;
  assert(managerReadyPackage.settingsHealthReadiness?.schemaVersion === 'settings-health-readiness/v1', 'Manager Ready Package must include Settings health readiness.');
  assert(managerReadyPackage.localMvpStartupReadiness?.schemaVersion === 'local-mvp-startup-readiness/v1', 'Manager Ready Package must include the startup readiness referenced by Settings health.');
  assert(managerReadyPackage.summary?.settingsHealthReadyForWorkflowSmoke === false, 'Manager Ready Package must keep workflow smoke blocked before providers are configured.');

  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: 'settings-health-readiness-validation-key',
    keyId: 'settings-health-readiness-v1',
  });
  const readyApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'ready-store.json'),
    replaceWithSeed: true,
    secretVault,
  });

  response = readyApi.handle({
    method: 'GET',
    path: '/settings/health-readiness',
  });
  readiness = response.body.settingsHealthReadiness;
  assert(readiness.rows?.some((row) => row.id === 'secret-vault' && row.status === 'pass'), 'Settings health must pass the Secret Vault row when Vault is ready.');
  assert(readiness.rows?.some((row) => row.id === 'model-provider' && row.status === 'pending'), 'Settings health must ask for model setup before provider keys exist.');
  assert(readiness.startupReadiness?.status === 'provider-setup-required', 'Settings health must embed startup readiness state.');

  response = await readyApi.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    body: {
      name: 'model.apiKey',
      value: plaintextSecret,
      scope: 'model-provider',
      source: 'settings-health-readiness-validation',
      metadata: {
        providerKind: 'model',
        secretKind: 'api-key',
      },
    },
  });
  assert(response.status === 200, `Settings health seal route returned ${response.status}.`);

  response = readyApi.handle({
    method: 'GET',
    path: '/settings/health-readiness',
  });
  readiness = response.body.settingsHealthReadiness;
  const serialized = JSON.stringify(readiness);
  assert(readiness.secretVaultStatus?.encryptedRecordCount >= 1, 'Settings health must see the sealed Vault record metadata.');
  assert(readiness.startupReadiness?.status === 'provider-setup-required', 'Settings health must keep runtime provider setup required when no model provider instance is attached.');
  assert(readiness.rows?.some((row) => row.id === 'search-provider' && row.status === 'pending'), 'Settings health must keep search setup pending until search provider is configured.');
  assert(readiness.summary?.readyForProviderTests === false, 'Settings health must not say provider tests are ready until model and search providers are configured.');
  assert(!serialized.includes(plaintextSecret), 'Settings health must not expose plaintext provider secrets.');
  assert(readiness.summary?.readyForProduction === false, 'Settings health must keep production readiness false after local secret sealing.');

  console.log('Settings health readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
