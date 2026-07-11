import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `budget-alert-readiness-contract-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'budget_alert_readiness_validation';
const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
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
      name: 'Budget Alert Readiness Validation',
      brief: 'Validate backend-owned local budget alert readiness without claiming production alert routing.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/budget-alert-readiness`,
  });
  assert(response.status === 200, `Initial budget alert readiness returned ${response.status}.`);
  let readiness = response.body.budgetAlertReadiness;
  assert(readiness?.schemaVersion === 'budget-alert-readiness/v1', 'Budget alert readiness must expose its schema version.');
  assert(readiness.readyForLocalMvp === true, 'Default project budget alert readiness must be locally computable.');
  assert(readiness.alertState === 'unlimited-local-budget', 'Default project should report unlimited local budget state.');
  assert(readiness.readyForProduction === false, 'Budget alert readiness must not claim production alert routing.');

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
      source: 'budget-alert-readiness-validation',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200, `Project budget policy update returned ${response.status}.`);

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/budget-alert-readiness`,
  });
  assert(response.status === 200, `Final budget alert readiness returned ${response.status}.`);
  readiness = response.body.budgetAlertReadiness;
  assert(readiness.schemaVersion === 'budget-alert-readiness/v1', 'Final readiness must preserve schema version.');
  assert(readiness.readyForLocalMvp === true, 'Configured budget alert readiness must remain locally ready.');
  assert(readiness.readyForPrivatePilot === true, 'Configured budget alert readiness should be private-pilot usable.');
  assert(readiness.readyForProduction === false, 'Production alert routing must remain blocked.');
  assert(readiness.backendRoutes.budgetAlertReadiness === `/projects/${projectId}/budget-alert-readiness`, 'Readiness must expose its backend route.');
  assert(readiness.backendRoutes.providerBudgetApprovals === `/projects/${projectId}/provider-budget-approvals`, 'Readiness must expose the bounded overage approval route.');
  assert(readiness.costForecast?.schemaVersion === 'local-provider-cost-forecast/v1' && readiness.costForecast.estimateOnly === true, 'Readiness must expose an explicitly estimated local cost forecast.');
  assert(readiness.projectBudgetPolicy.dailyBudgetCents === 500, 'Readiness must read the project daily budget policy.');
  assert(readiness.projectBudgetPolicy.maxRequestsPerProjectHour === 20, 'Readiness must read the project hourly request policy.');
  assert(readiness.summary.dailyBudgetRemainingCents === 500, 'Readiness must calculate daily budget headroom.');
  assert(readiness.summary.hourlyRequestsRemaining === 20, 'Readiness must calculate hourly request headroom.');
  assert(readiness.rows.some((row) => row.id === 'daily-provider-budget' && row.status === 'ok'), 'Daily provider budget row must be present and OK.');
  assert(readiness.rows.some((row) => row.id === 'hourly-provider-requests' && row.status === 'ok'), 'Hourly provider request row must be present and OK.');
  assert(readiness.gates.some((gate) => gate.id === 'managed-alert-routing-production-blocked' && gate.status === 'blocked'), 'Readiness must keep managed alert routing as a production blocker.');

  const approvalNow = new Date().toISOString();
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/provider-budget-approvals`,
    body: {
      operation: 'search:evidence',
      maxExtraCostCents: 100,
      maxExtraRequests: 1,
      approvedBy: 'budget-validation-manager',
      ttlMs: 60 * 60 * 1000,
      now: approvalNow,
    },
  });
  assert(response.status === 201 && response.body.providerBudgetApproval?.status === 'active', 'Budget readiness gate must create one bounded local overage approval.');
  response = api.handle({ method: 'GET', path: `/projects/${projectId}/budget-alert-readiness` });
  readiness = response.body.budgetAlertReadiness;
  assert(readiness.summary.activeProviderBudgetApprovalCount === 1, 'Readiness must count one active local overage approval.');
  assert(readiness.providerBudgetApprovals?.rows?.[0]?.operation === 'search:evidence', 'Readiness must expose redacted approval scope evidence.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Readiness Proof Map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.budgetAlertReadinessSummary?.count === 1, 'Readiness Proof Map must expose budget alert readiness as a formal proof surface.');
  assert(proofMap.budgetAlertReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/budget-alert-readiness`, 'Budget alert proof route must point to the budget alert readiness API.');
  assert(proofMap.budgetAlertReadinessRoutes?.[0]?.readyForProduction === false, 'Budget alert proof route must not claim production alert routing.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.budgetAlertReadiness?.schemaVersion === 'budget-alert-readiness/v1', 'Manager Ready Package must include budget alert readiness.');
  assert(managerReadyPackage.summary?.budgetAlertReadinessReady === true, 'Manager Ready Package summary must report local budget alert readiness.');
  assert(managerReadyPackage.summary?.budgetAlertReadinessProductionReady === false, 'Manager Ready Package must keep production alert routing blocked.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200, `Project settings returned ${response.status}.`);
  const capabilities = response.body.projectSettings?.integrationCapabilities;
  assert(capabilities?.backendRoutes?.budgetAlertReadiness === `/projects/${projectId}/budget-alert-readiness`, 'Integration capabilities must expose budget alert readiness route.');
  const budgetAlertRow = capabilities?.rows?.find((row) => row.id === 'budget-alerts');
  assert(budgetAlertRow?.requiredBackendRoute === `/projects/${projectId}/budget-alert-readiness`, 'Budget Alerts settings row must point to budget-alert-readiness.');
  assert(budgetAlertRow.status === 'backend-backed' && budgetAlertRow.editable === false, 'Budget Alerts must be a backend-backed read-only readiness contract until production alert routing exists.');
  assert(budgetAlertRow.readyForProduction === false, 'Budget Alerts settings row must not claim production alert routing.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.providerBudgetPolicy?.dailyBudgetCents === 500, 'File-backed store must persist the provider budget policy.');
  assert(storedProject?.projectSettings?.integrationCapabilities?.backendRoutes?.budgetAlertReadiness === `/projects/${projectId}/budget-alert-readiness`, 'File-backed settings must persist the budget alert route.');
  assert(storedProject?.providerBudgetApprovals?.length === 1, 'File-backed store must persist the bounded Provider overage approval.');

  console.log('Budget alert readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
