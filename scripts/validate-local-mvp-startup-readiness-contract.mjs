import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'local-mvp-startup-readiness-contract-validate');
const plaintextSecret = 'LOCAL_MVP_STARTUP_SECRET_SHOULD_NOT_LEAK';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const blockedApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'blocked-store.json'),
    replaceWithSeed: true,
  });

  let response = blockedApi.handle({
    method: 'GET',
    path: '/local-mvp-startup-readiness',
  });
  assert(response.status === 200, `Blocked startup readiness returned ${response.status}.`);
  let readiness = response.body.localMvpStartupReadiness;
  assert(readiness?.schemaVersion === 'local-mvp-startup-readiness/v1', 'Startup readiness must expose its schema version.');
  assert(readiness.status === 'backend-vault-required', 'Startup readiness must block provider setup when the Secret Vault is absent.');
  assert(readiness.readyForSettingsEntry === true, 'The backend route itself must prove Settings can read backend startup guidance.');
  assert(readiness.readyForProviderSetup === false, 'Provider setup must be blocked until the Vault can seal secrets.');
  assert(readiness.readyForFirstProjectRun === false, 'First project run must remain blocked before providers are configured.');
  assert(readiness.nextAction?.id === 'start-agents-server-with-secret-vault', 'Startup readiness must tell the user to start agents:server with Secret Vault env.');
  assert(readiness.backendRoutes?.localMvpStartupReadiness === '/local-mvp-startup-readiness', 'Startup readiness must expose its route.');
  assert(readiness.backendRoutes?.settingsProviderReadiness === '/settings/provider-readiness', 'Startup readiness must link Settings provider readiness.');
  assert(readiness.validationCommands?.includes('npm run ui:settings-agents-server'), 'Startup readiness must link the Settings browser gate.');

  response = blockedApi.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: 'startup_readiness_validation',
      name: 'Startup Readiness Validation',
      brief: 'Validate startup readiness as a Manager proof surface.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200, `Startup validation project returned ${response.status}.`);

  response = blockedApi.handle({
    method: 'GET',
    path: '/projects/startup_readiness_validation/readiness-proof-map',
  });
  assert(response.status === 200, `Startup proof map returned ${response.status}.`);
  let proofMap = response.body;
  assert(proofMap.localMvpStartupReadinessSummary?.count === 1, 'Readiness Proof Map must expose local MVP startup readiness.');
  assert(proofMap.localMvpStartupReadinessRoutes?.[0]?.apiPath === '/local-mvp-startup-readiness', 'Startup proof route must point to the global startup readiness API.');
  assert(proofMap.localMvpStartupReadinessRoutes?.[0]?.readyForProduction === false, 'Startup proof route must not claim production readiness.');

  response = blockedApi.handle({
    method: 'GET',
    path: '/projects/startup_readiness_validation/manager-ready-package',
  });
  assert(response.status === 200, `Startup Manager Ready Package returned ${response.status}.`);
  let managerReadyPackage = response.body;
  assert(managerReadyPackage.localMvpStartupReadiness?.schemaVersion === 'local-mvp-startup-readiness/v1', 'Manager Ready Package must include local MVP startup readiness.');
  assert(managerReadyPackage.summary?.localMvpReadyForSettingsEntry === true, 'Manager Ready Package summary must report Settings entry readiness.');
  assert(managerReadyPackage.summary?.localMvpReadyForFirstProjectRun === false, 'Manager Ready Package must keep first project run blocked without providers.');

  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: 'local-mvp-startup-readiness-validation-key',
    keyId: 'local-mvp-startup-readiness-v1',
  });
  const readyApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'ready-store.json'),
    replaceWithSeed: true,
    secretVault,
  });

  response = readyApi.handle({
    method: 'GET',
    path: '/local-mvp-startup-readiness',
  });
  assert(response.status === 200, `Ready startup readiness returned ${response.status}.`);
  readiness = response.body.localMvpStartupReadiness;
  assert(readiness.status === 'provider-setup-required', 'Ready Vault should move startup readiness into provider setup required state before provider values exist.');
  assert(readiness.readyForProviderSetup === true, 'Ready Vault must allow provider setup.');
  assert(readiness.readyForFirstProjectRun === false, 'Startup readiness must not claim first project run readiness before model/search providers are configured.');
  assert(readiness.nextAction?.id === 'seal-model-provider', 'Startup readiness must ask for model provider sealing before first project run.');
  assert(readiness.gates?.some((gate) => gate.id === 'secret-vault-ready' && gate.passed === true), 'Startup readiness must show the Secret Vault gate passing.');
  assert(readiness.gates?.some((gate) => gate.id === 'model-provider-runtime-ready' && gate.passed === false), 'Startup readiness must show model provider runtime still missing.');

  response = await readyApi.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    body: {
      name: 'model.apiKey',
      value: plaintextSecret,
      scope: 'model-provider',
      source: 'local-mvp-startup-readiness-validation',
      metadata: {
        providerKind: 'model',
        secretKind: 'api-key',
      },
    },
  });
  assert(response.status === 200, `Startup readiness seal route returned ${response.status}.`);

  response = readyApi.handle({
    method: 'GET',
    path: '/local-mvp-startup-readiness',
  });
  readiness = response.body.localMvpStartupReadiness;
  const serialized = JSON.stringify(readiness);
  assert(readiness.providerVaultBindings?.summary?.vaultRecordCount >= 1, 'Startup readiness must include provider-vault binding metadata after sealing.');
  assert(readiness.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Startup readiness provider-vault metadata must remain redacted.');
  assert(!serialized.includes(plaintextSecret), 'Startup readiness must not expose plaintext provider secrets.');
  assert(readiness.readyForProduction === false, 'Startup readiness must not claim public production readiness.');

  console.log('Local MVP startup readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
