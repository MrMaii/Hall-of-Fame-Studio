import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `project-settings-integration-capabilities-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'project_settings_integration_capabilities_validation';
const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
  { id: 'turing', name: 'Alan Turing', title: 'Systems Architect' },
];

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
  });

  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Project Settings Integration Capabilities Validation',
      brief: 'Validate Settings Integrations backend capability rows without exposing fake editable controls.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'PUT',
    path: `/projects/${projectId}/project-settings`,
    body: {
      includeReadModels: false,
      providerBudgetPolicy: {
        dailyBudgetCents: 500,
        maxRequestsPerProjectHour: 20,
        currency: 'USD',
      },
      toolGrantPolicy: {
        defaultToolGrants: ['provider:test', 'model:kickoff', 'model:intent', 'model:artifact-draft'],
      },
      updatedBy: 'Director',
      source: 'integration-capabilities-validation',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200, `Project settings update returned ${response.status}.`);
  const capabilities = response.body.projectSettings?.integrationCapabilities;
  assert(capabilities?.schemaVersion === 'project-integration-capabilities/v1', 'Project settings must expose integration capability rows.');
  assert(capabilities.status === 'integration-local-contracts-ready-production-blocked', 'Integration capabilities must report local route contracts ready while production remains blocked.');
  assert(capabilities.summary?.backendBackedCount >= 7, 'Integration capabilities must mark every Settings Integration row with an existing backend route as backend-backed.');
  assert(capabilities.summary?.backendRequiredCount === 0, 'Integration capabilities must not label route-backed Settings Integration rows as missing backend APIs.');
  assert(capabilities.rows?.some((row) => row.id === 'provider-budget-policy' && row.status === 'backend-backed' && row.editable), 'Provider budget row must be backend-backed and editable.');
  assert(capabilities.rows?.some((row) => row.id === 'agent-tool-grant-policy' && row.status === 'backend-backed' && row.editable), 'Agent tool grant row must be backend-backed and editable.');
  assert(capabilities.backendRoutes?.evidenceIndexReadiness === `/projects/${projectId}/evidence-index-readiness`, 'Integration capabilities must expose the evidence index readiness route.');
  assert(capabilities.backendRoutes?.budgetAlertReadiness === `/projects/${projectId}/budget-alert-readiness`, 'Integration capabilities must expose the budget alert readiness route.');
  assert(capabilities.backendRoutes?.errorReportingReadiness === `/projects/${projectId}/error-reporting-readiness`, 'Integration capabilities must expose the error reporting readiness route.');
  for (const id of ['vector-store', 'proxy-webhook', 'mcp-tools', 'budget-alerts', 'error-reporting']) {
    const row = capabilities.rows.find((item) => item.id === id);
    assert(row?.status === 'backend-backed' && row.editable === false, `${id} must be backend-backed through a read-only route contract, not a fake editable control.`);
    assert(row.requiredBackendRoute?.includes(projectId), `${id} must expose a project-scoped required backend route.`);
    assert(row.readyForProduction === false, `${id} must not overclaim production readiness.`);
  }
  const vectorStoreRow = capabilities.rows.find((item) => item.id === 'vector-store');
  assert(vectorStoreRow?.requiredBackendRoute === `/projects/${projectId}/evidence-index-readiness`, 'Vector store row must point to evidence index readiness instead of a fake editable control.');
  const proxyWebhookRow = capabilities.rows.find((item) => item.id === 'proxy-webhook');
  assert(proxyWebhookRow?.requiredBackendRoute === `/projects/${projectId}/adapter-gateway-preflight`, 'Proxy/Webhook row must point to adapter gateway preflight instead of a fake editable control.');
  const mcpToolsRow = capabilities.rows.find((item) => item.id === 'mcp-tools');
  assert(mcpToolsRow?.requiredBackendRoute === `/projects/${projectId}/provider-readiness`, 'MCP tools row must point to provider readiness instead of a fake editable control.');
  const budgetAlertRow = capabilities.rows.find((item) => item.id === 'budget-alerts');
  assert(budgetAlertRow?.requiredBackendRoute === `/projects/${projectId}/budget-alert-readiness`, 'Budget Alerts row must point to budget alert readiness instead of a fake editable control.');
  const errorReportingRow = capabilities.rows.find((item) => item.id === 'error-reporting');
  assert(errorReportingRow?.requiredBackendRoute === `/projects/${projectId}/error-reporting-readiness`, 'Error Reporting row must point to error reporting readiness instead of a fake editable control.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200 && response.body.projectSettings?.integrationCapabilities?.checksum === capabilities.checksum, 'GET project-settings must return the same integration capability contract.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/timeline`,
  });
  assert(response.status === 200 && response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.integrationCapabilities?.schemaVersion === 'project-integration-capabilities/v1'), 'Timeline must expose integration capability settings proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/events`,
  });
  assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.integrationCapabilities?.schemaVersion === 'project-integration-capabilities/v1'), 'Event ledger must expose integration capability settings proof.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.integrationCapabilities?.checksum === capabilities.checksum, 'File-backed store must persist the integration capability contract.');
  assert(storedProject?.projectSettingsAudit?.some((entry) => entry.integrationCapabilities?.checksum === capabilities.checksum), 'File-backed store must persist the integration capability audit entry.');

  console.log('Project settings integration capabilities validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
