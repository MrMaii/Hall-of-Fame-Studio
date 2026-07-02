import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalSecretVault } from '../src/agents/secretVault.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'settings-runtime-readiness-contract-validate');
const plaintextSecret = 'SETTINGS_RUNTIME_SECRET_SHOULD_NOT_LEAK';
const runtimeProjectId = 'settings_runtime_readiness_project';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const blockedApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'blocked-store.json'),
    replaceWithSeed: true,
  });

  let response = blockedApi.handle({
    method: 'GET',
    path: '/settings/runtime-readiness',
  });
  assert(response.status === 200, `Blocked Settings runtime returned ${response.status}.`);
  let readiness = response.body.settingsRuntimeReadiness;
  assert(readiness?.schemaVersion === 'settings-runtime-readiness/v1', 'Settings runtime must expose its schema version.');
  assert(readiness.status === 'runtime-setup-required', 'Settings runtime must require setup when Secret Vault/provider runtime is missing.');
  assert(readiness.rows?.some((row) => row.id === 'backend-api' && row.status === 'pass'), 'Settings runtime must prove the backend API route is reachable.');
  assert(readiness.rows?.some((row) => row.id === 'model-runtime' && row.status === 'fail'), 'Settings runtime must fail model runtime while Vault/provider setup is missing.');
  assert(readiness.rows?.some((row) => row.id === 'search-runtime' && row.status === 'fail'), 'Settings runtime must fail search runtime while Vault/provider setup is missing.');
  assert(readiness.rows?.some((row) => row.id === 'deployment-preflight' && row.status === 'pending'), 'Global Settings runtime must keep project deployment preflight pending until a project is open.');
  assert(readiness.backendRoutes?.settingsRuntimeReadiness === '/settings/runtime-readiness', 'Settings runtime must expose its global route.');
  assert(readiness.backendRoutes?.workerStatus === '/workers/autonomous/status', 'Settings runtime must expose the worker status route.');
  assert(readiness.summary?.readyForProduction === false, 'Settings runtime must not claim production readiness.');
  assert(readiness.validationCommands?.includes('npm run agents:settings-runtime-readiness'), 'Settings runtime must expose its focused validation command.');

  const secretVault = createLocalSecretVault({
    enabled: true,
    masterKey: 'settings-runtime-readiness-validation-key',
    keyId: 'settings-runtime-readiness-v1',
  });
  const readyApi = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'ready-store.json'),
    replaceWithSeed: true,
    secretVault,
  });

  response = readyApi.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId: runtimeProjectId,
      name: 'Settings Runtime Readiness Project',
      brief: 'Validate project-scoped Settings runtime readiness.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
    },
  });
  assert(response.status === 200, `Settings runtime validation project returned ${response.status}.`);

  response = readyApi.handle({
    method: 'GET',
    path: '/settings/runtime-readiness',
  });
  readiness = response.body.settingsRuntimeReadiness;
  assert(readiness.rows?.some((row) => row.id === 'model-runtime' && row.status === 'pending'), 'Settings runtime must ask for model setup once Vault is ready.');
  assert(readiness.rows?.some((row) => row.id === 'persistence-adapter' && row.status === 'pass'), 'Settings runtime must expose local persistence adapter readiness.');
  assert(readiness.rows?.some((row) => row.id === 'worker-queue-adapter' && row.status === 'pass'), 'Settings runtime must expose local worker queue adapter readiness.');
  assert(readiness.deploymentRuntime?.schedulerStatusRoute === '/workers/autonomous/status', 'Settings runtime must keep scheduler status as an explicit backend route.');

  response = await readyApi.handleAsync({
    method: 'POST',
    path: '/secret-vault/seal',
    body: {
      name: 'model.apiKey',
      value: plaintextSecret,
      scope: 'model-provider',
      source: 'settings-runtime-readiness-validation',
      metadata: {
        providerKind: 'model',
        secretKind: 'api-key',
      },
    },
  });
  assert(response.status === 200, `Settings runtime seal route returned ${response.status}.`);

  response = readyApi.handle({
    method: 'GET',
    path: `/projects/${runtimeProjectId}/settings-runtime-readiness`,
  });
  readiness = response.body.settingsRuntimeReadiness;
  const serialized = JSON.stringify(readiness);
  assert(readiness.projectId === runtimeProjectId, 'Project-scoped Settings runtime must echo the project id.');
  assert(readiness.backendRoutes?.settingsRuntimeReadiness === `/projects/${runtimeProjectId}/settings-runtime-readiness`, 'Project-scoped Settings runtime must expose its project route.');
  assert(readiness.backendRoutes?.deploymentPreflight === `/projects/${runtimeProjectId}/deployment-preflight`, 'Project-scoped Settings runtime must link deployment preflight.');
  assert(readiness.modelRuntime?.providerVaultBindings?.redaction?.rawLeakCount === 0, 'Settings runtime must include redacted provider-vault binding proof.');
  assert(!serialized.includes(plaintextSecret), 'Settings runtime must not expose plaintext provider secrets.');
  assert(readiness.readyForProduction === false, 'Settings runtime must keep production readiness false after local secret sealing.');

  response = readyApi.handle({
    method: 'GET',
    path: `/projects/${runtimeProjectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Settings runtime proof map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.settingsRuntimeReadinessSummary?.count === 1, 'Readiness Proof Map must expose Settings runtime readiness.');
  assert(proofMap.settingsRuntimeReadinessRoutes?.[0]?.apiPath === `/projects/${runtimeProjectId}/settings-runtime-readiness`, 'Settings runtime proof route must point to the project-scoped readiness API.');
  assert(proofMap.settingsRuntimeReadinessRoutes?.[0]?.readyForProduction === false, 'Settings runtime proof route must not claim production readiness.');

  response = readyApi.handle({
    method: 'GET',
    path: `/projects/${runtimeProjectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Settings runtime Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.settingsRuntimeReadiness?.schemaVersion === 'settings-runtime-readiness/v1', 'Manager Ready Package must include Settings runtime readiness.');
  assert(managerReadyPackage.summary?.settingsRuntimeReadinessStatus, 'Manager Ready Package summary must expose Settings runtime status.');
  assert(managerReadyPackage.summary?.settingsRuntimeProductionReady === false, 'Manager Ready Package must keep runtime production-blocked.');

  console.log('Settings runtime readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
