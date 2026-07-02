import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'project-settings-tool-grant-policy-validate');
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'project_settings_tool_grant_validation';
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
      name: 'Project Settings Tool Grant Validation',
      brief: 'Validate project-level Agent tool grants as a generic AI product-team backend receipt.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T11:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'PUT',
    path: `/projects/${projectId}/project-settings`,
    body: {
      includeReadModels: false,
      toolGrantPolicy: {
        defaultToolGrants: ['provider:test', 'model:artifact-draft'],
        agentToolGrants: {
          curie: [],
        },
      },
      updatedBy: 'Director',
      source: 'tool-grant-validation',
      now: '2026-06-01T11:05:00.000Z',
    },
  });
  assert(response.status === 200, `Tool grant settings update returned ${response.status}.`);
  assert(response.body.projectSettings?.toolGrantPolicy?.schemaVersion === 'project-tool-grant-policy/v1', 'Project settings must expose a typed tool grant policy.');
  assert(response.body.projectSettings.toolGrantPolicy.defaultToolGrants.includes('model:artifact-draft'), 'Tool grant policy must persist model artifact draft access.');
  assert(!response.body.projectSettings.toolGrantPolicy.defaultToolGrants.includes('search:evidence'), 'Tool grant policy must persist removal of search evidence access.');
  assert(response.body.projectSettings.toolGrantPolicy.readyForProduction === false, 'Local tool grant policy must not overclaim production readiness.');
  assert(response.body.projectSettingsAuditEntry?.toolGrantPolicy?.defaultToolGrants?.includes('provider:test'), 'Tool grant writes must produce an audit entry.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/provider-readiness`,
  });
  assert(response.status === 200 && response.body.providerReadiness?.providerControlPolicy?.schemaVersion === 'provider-control-policy/v1', 'Provider readiness must expose provider control policy after tool grant update.');
  assert(!response.body.providerReadiness.providerControlPolicy.defaultToolGrants.includes('search:evidence'), 'Provider readiness must consume project-level tool grants.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/provider-controlled-run`,
  });
  assert(response.status === 200 && response.body.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1', 'Provider controlled run route must respond after tool grant settings update.');
  const searchRow = response.body.providerControlledRun.operationPlan?.find((row) => row.operation === 'search:evidence');
  assert(searchRow, 'Provider controlled run must include the search evidence operation.');
  assert(searchRow.policyAllowed === false, 'Provider controlled run must deny search evidence when the project grant is removed.');
  assert(searchRow.policyReason === 'agent-tool-grant-missing', 'Provider controlled run must explain missing search grant.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/timeline`,
  });
  assert(response.status === 200 && response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.toolGrantPolicy?.defaultToolGrants?.includes('model:artifact-draft')), 'Timeline must expose tool grant settings proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/events`,
  });
  assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.toolGrantPolicy?.defaultToolGrants?.includes('provider:test')), 'Event ledger must expose tool grant settings proof.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.toolGrantPolicy?.defaultToolGrants?.includes('model:artifact-draft'), 'File-backed store must persist the tool grant policy.');
  assert(!storedProject?.projectSettings?.toolGrantPolicy?.defaultToolGrants?.includes('search:evidence'), 'File-backed store must persist removed search evidence access.');
  assert(storedProject?.projectSettingsAudit?.some((entry) => entry.toolGrantPolicy?.defaultToolGrants?.includes('provider:test')), 'File-backed store must persist the tool grant audit entry.');

  console.log('Project settings tool grant policy validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
