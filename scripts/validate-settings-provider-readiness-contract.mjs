import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `settings-provider-readiness-contract-validate-${process.pid}`);
const plaintextSecret = 'SETTINGS_PROVIDER_READINESS_SECRET_SHOULD_NOT_LEAK';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const blockedApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'blocked-store.json'),
    replaceWithSeed: true,
  });

  let response = blockedApi.handle({
    method: 'GET',
    path: '/settings/provider-readiness',
  });
  assert(response.status === 200, `Blocked readiness route returned ${response.status}.`);
  let readiness = response.body.settingsProviderReadiness;
  assert(readiness?.schemaVersion === 'settings-provider-readiness/v1', 'Settings provider readiness must expose its schema version.');
  assert(readiness.status === 'backend-vault-required', 'Readiness must block sealing when the Secret Vault is not configured.');
  assert(readiness.canTypeApiFields === true, 'Readiness must allow transient provider draft entry even before the Secret Vault is ready.');
  assert(readiness.canSealSecrets === false, 'Readiness must deny Seal until the Secret Vault is ready.');
  assert(readiness.browserPersistsSecrets === false, 'Readiness must forbid browser-local provider secret persistence.');
  assert(readiness.actionRequired?.id === 'start-secret-vault-backend', 'Readiness must point users to backend Vault startup when blocked.');
  assert(readiness.actionRequired?.detail?.includes('Seal stays locked'), 'Readiness must explain that Seal is locked until the backend Vault is ready.');
  assert(readiness.uiGuidance?.message?.includes('Provider secret draft fields are editable'), 'Readiness guidance must explain draft entry before Vault readiness.');
  assert(readiness.backendRoutes?.secretVaultSeal === '/secret-vault/seal', 'Readiness must expose the backend seal route.');

  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: 'settings-provider-readiness-validation-key',
    keyId: 'settings-provider-readiness-v1',
  });
  const readyApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'ready-store.json'),
    replaceWithSeed: true,
    secretVault,
  });

  response = readyApi.handle({
    method: 'GET',
    path: '/settings/provider-readiness',
  });
  assert(response.status === 200, `Ready readiness route returned ${response.status}.`);
  readiness = response.body.settingsProviderReadiness;
  assert(readiness.status === 'ready-to-seal-provider-secrets', 'Ready Vault should move Settings into ready-to-seal state before provider values exist.');
  assert(readiness.canTypeApiFields === true, 'Ready Vault must allow provider secret entry.');
  assert(readiness.canSealSecrets === true, 'Ready Vault must allow Seal.');
  assert(readiness.uiGuidance?.message?.includes('sealed through the backend Vault'), 'Readiness must provide user-facing backend Vault guidance.');
  assert(readiness.steps?.some((step) => step.id === 'model-provider-runtime' && step.status === 'action-required'), 'Readiness must identify model provider sealing as an action-required step.');
  assert(!JSON.stringify(readiness).includes(plaintextSecret), 'Readiness must not expose plaintext secrets before sealing.');

  response = await readyApi.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    body: {
      name: 'model.apiKey',
      value: plaintextSecret,
      scope: 'model-provider',
      source: 'settings-provider-readiness-validation',
      metadata: {
        providerKind: 'model',
        secretKind: 'api-key',
      },
    },
  });
  assert(response.status === 200, `Seal route returned ${response.status}.`);
  assert(response.body.secretVaultSealReceipt?.schemaVersion === 'secret-vault-seal-receipt/v1', 'Seal route must return a backend receipt.');
  assert(!JSON.stringify(response.body).includes(plaintextSecret), 'Seal response must not expose plaintext provider secrets.');

  response = readyApi.handle({
    method: 'GET',
    path: '/settings/provider-readiness',
  });
  readiness = response.body.settingsProviderReadiness;
  assert(readiness.canSealSecrets === true, 'Readiness must continue allowing additional provider seals after one encrypted record exists.');
  assert(readiness.actionRequired?.route === '/secret-vault/seal', 'Readiness must keep provider setup on the backend seal route after one encrypted record exists.');
  assert(readiness.providerVaultBindings?.summary?.vaultRecordCount >= 1, 'Readiness must reflect sealed Vault record metadata.');
  assert(readiness.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Readiness must keep provider-vault metadata redacted.');
  assert(!JSON.stringify(readiness).includes(plaintextSecret), 'Readiness must not expose plaintext provider secrets after sealing.');

  response = readyApi.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'settings_provider_readiness_project',
      name: 'Settings Provider Readiness Project',
      brief: 'Validate project-scoped Settings provider readiness.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
    },
  });
  assert(response.status === 200, `Project initiate returned ${response.status}.`);
  response = readyApi.handle({
    method: 'GET',
    path: '/projects/settings_provider_readiness_project/settings-provider-readiness',
  });
  assert(response.status === 200, `Project-scoped readiness route returned ${response.status}.`);
  readiness = response.body.settingsProviderReadiness;
  assert(readiness.projectId === 'settings_provider_readiness_project', 'Project-scoped readiness must carry the project id.');
  assert(readiness.backendRoutes?.settingsProviderReadiness === '/projects/settings_provider_readiness_project/settings-provider-readiness', 'Project-scoped readiness must expose its project route.');

  response = readyApi.handle({
    method: 'GET',
    path: '/projects/settings_provider_readiness_project/readiness-proof-map',
  });
  assert(response.status === 200, `Settings provider proof map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.settingsProviderReadinessSummary?.count === 1, 'Readiness Proof Map must expose Settings provider readiness.');
  assert(proofMap.settingsProviderReadinessRoutes?.[0]?.apiPath === '/projects/settings_provider_readiness_project/settings-provider-readiness', 'Settings provider proof route must point to the project-scoped readiness API.');
  assert(proofMap.settingsProviderReadinessRoutes?.[0]?.readyForProduction === false, 'Settings provider proof route must not claim production readiness.');

  response = readyApi.handle({
    method: 'GET',
    path: '/projects/settings_provider_readiness_project/manager-ready-package',
  });
  assert(response.status === 200, `Settings provider Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.settingsProviderReadiness?.schemaVersion === 'settings-provider-readiness/v1', 'Manager Ready Package must include Settings provider readiness.');
  assert(managerReadyPackage.summary?.settingsProviderCanTypeApiFields === true, 'Manager Ready Package summary must report provider secret fields are enabled after Vault readiness.');
  assert(managerReadyPackage.summary?.settingsProviderProductionReady === false, 'Manager Ready Package must keep provider setup production-blocked.');

  console.log('Settings provider readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
