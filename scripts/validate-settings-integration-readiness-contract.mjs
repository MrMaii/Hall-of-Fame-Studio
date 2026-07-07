import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `settings-integration-readiness-contract-validate-${process.pid}`);
const projectId = 'settings_integration_readiness_project';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const api = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'store.json'),
    replaceWithSeed: true,
  });

  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Settings Integration Readiness Project',
      brief: 'Validate Settings Integrations as backend-owned readiness rows.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiate returned ${response.status}.`);

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/settings-integration-readiness`,
  });
  assert(response.status === 200, `Settings integration readiness returned ${response.status}.`);
  let readiness = response.body.settingsIntegrationReadiness;
  assert(readiness?.schemaVersion === 'settings-integration-readiness/v1', 'Settings integration readiness must expose its schema version.');
  assert(readiness.projectId === projectId, 'Settings integration readiness must carry the project id.');
  assert(readiness.readyForSettingsIntegrationsPanel === true, 'Settings Integrations panel must be backed by readable backend route contracts.');
  assert(readiness.readyForProduction === false, 'Settings integration readiness must not claim production readiness.');
  assert(readiness.backendRoutes?.settingsIntegrationReadiness === `/projects/${projectId}/settings-integration-readiness`, 'Readiness must expose its own backend route.');
  assert(readiness.summary?.rowCount >= 7, 'Readiness must cover all Settings Integration rows.');
  assert(readiness.summary?.routeReadyCount === readiness.summary.rowCount, 'Every Settings Integration row must have a readable backend route contract.');
  for (const id of ['provider-budget-policy', 'agent-tool-grant-policy', 'vector-store', 'proxy-webhook', 'mcp-tools', 'budget-alerts', 'error-reporting']) {
    const row = readiness.rows.find((item) => item.id === id);
    assert(row, `${id} readiness row must be present.`);
    assert(row.routeReady === true, `${id} must be route-backed, not a frontend-only mock.`);
    assert(row.readyForProduction === false, `${id} must keep production readiness blocked.`);
    assert(row.requiredBackendRoute?.includes(projectId), `${id} must expose a project-scoped backend route.`);
  }
  assert(readiness.rows.find((row) => row.id === 'proxy-webhook')?.readinessSchemaVersion === 'adapter-gateway-preflight/v1', 'Proxy/Webhook row must read Adapter Gateway preflight.');
  assert(readiness.rows.find((row) => row.id === 'vector-store')?.readinessSchemaVersion === 'evidence-index-readiness/v1', 'Vector Store row must read Evidence Index readiness.');
  assert(readiness.rows.find((row) => row.id === 'budget-alerts')?.readinessSchemaVersion === 'budget-alert-readiness/v1', 'Budget Alerts row must read Budget Alert readiness.');
  assert(readiness.rows.find((row) => row.id === 'error-reporting')?.readinessSchemaVersion === 'error-reporting-readiness/v1', 'Error Reporting row must read Error Reporting readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Readiness Proof Map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.settingsIntegrationReadinessSummary?.count === 1, 'Readiness Proof Map must expose Settings integration readiness.');
  assert(proofMap.settingsIntegrationReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/settings-integration-readiness`, 'Settings integration proof route must point to the readiness API.');
  assert(proofMap.settingsIntegrationReadinessRoutes?.[0]?.readyForProduction === false, 'Settings integration proof route must not claim production readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.settingsIntegrationReadiness?.schemaVersion === 'settings-integration-readiness/v1', 'Manager Ready Package must include Settings integration readiness.');
  assert(managerReadyPackage.summary?.settingsIntegrationPanelReady === true, 'Manager Ready Package summary must report Settings Integrations panel readiness.');
  assert(managerReadyPackage.summary?.settingsIntegrationProductionReady === false, 'Manager Ready Package must keep Settings Integrations production-blocked.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200, `Project settings returned ${response.status}.`);
  const capabilities = response.body.projectSettings?.integrationCapabilities;
  assert(capabilities?.backendRoutes?.settingsIntegrationReadiness === `/projects/${projectId}/settings-integration-readiness`, 'Integration capabilities must expose the Settings integration readiness aggregate route.');

  console.log('Settings integration readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
