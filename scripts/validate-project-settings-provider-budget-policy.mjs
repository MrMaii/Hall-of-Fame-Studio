import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', 'project-settings-provider-budget-policy-validate');
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'project_settings_provider_budget_validation';
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
      name: 'Project Settings Provider Budget Validation',
      brief: 'Validate project-level BYOK provider budget settings as a generic AI product-team backend receipt.',
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
      updatedBy: 'Director',
      source: 'provider-budget-validation',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200, `Provider budget settings update returned ${response.status}.`);
  assert(response.body.projectSettings?.providerBudgetPolicy?.schemaVersion === 'project-provider-budget-policy/v1', 'Project settings must expose a typed provider budget policy.');
  assert(response.body.projectSettings.providerBudgetPolicy.dailyBudgetCents === 500, 'Provider budget policy must persist daily budget.');
  assert(response.body.projectSettings.providerBudgetPolicy.maxRequestsPerProjectHour === 20, 'Provider budget policy must persist hourly request limit.');
  assert(response.body.projectSettings.providerBudgetPolicy.readyForProduction === false, 'Local provider budget policy must not overclaim production readiness.');
  assert(response.body.projectSettingsAuditEntry?.providerBudgetPolicy?.dailyBudgetCents === 500, 'Provider budget settings writes must produce an audit entry.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/provider-controlled-run`,
  });
  assert(response.status === 200 && response.body.providerControlledRun?.schemaVersion === 'provider-controlled-run/v1', 'Provider controlled run route must respond after budget settings update.');
  assert(response.body.providerControlledRun.budget?.dailyBudgetCents === 500, 'Provider controlled run must consume the project-level daily budget.');
  assert(response.body.providerControlledRun.budget?.remainingDailyBudgetCents === 500, 'Provider controlled run must calculate remaining daily budget from the project-level policy.');
  assert(response.body.providerControlledRun.budget?.remainingHourlyRequests === 20, 'Provider controlled run must consume the project-level hourly request limit.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/provider-readiness`,
  });
  assert(response.status === 200 && response.body.providerReadiness?.providerControlPolicy?.dailyBudgetCents === 500, 'Provider readiness must consume the project-level budget policy.');
  assert(response.body.providerReadiness.providerControlPolicy.maxRequestsPerProjectHour === 20, 'Provider readiness must consume the project-level hourly request policy.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/timeline`,
  });
  assert(response.status === 200 && response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.providerBudgetPolicy?.dailyBudgetCents === 500), 'Timeline must expose provider budget settings proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/events`,
  });
  assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.providerBudgetPolicy?.maxRequestsPerProjectHour === 20), 'Event ledger must expose provider budget settings proof.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.providerBudgetPolicy?.dailyBudgetCents === 500, 'File-backed store must persist the provider budget policy.');
  assert(storedProject?.projectSettingsAudit?.some((entry) => entry.providerBudgetPolicy?.dailyBudgetCents === 500), 'File-backed store must persist the provider budget audit entry.');

  console.log('Project settings provider budget policy validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
