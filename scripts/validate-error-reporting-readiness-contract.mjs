import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `error-reporting-readiness-contract-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'error_reporting_readiness_validation';
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
      name: 'Error Reporting Readiness Validation',
      brief: 'Validate backend-owned local error reporting readiness without claiming production observability.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/error-reporting-readiness`,
  });
  assert(response.status === 200, `Error reporting readiness returned ${response.status}.`);
  const readiness = response.body.errorReportingReadiness;
  assert(readiness?.schemaVersion === 'error-reporting-readiness/v1', 'Error reporting readiness must expose its schema version.');
  assert(readiness.readyForProduction === false, 'Error reporting readiness must not claim production observability.');
  assert(readiness.backendRoutes?.errorReportingReadiness === `/projects/${projectId}/error-reporting-readiness`, 'Readiness must expose its own backend route.');
  assert(readiness.backendRoutes?.operationsReadiness === `/projects/${projectId}/operations-readiness`, 'Readiness must link back to Operations Readiness.');
  assert(readiness.rows?.some((row) => row.id === 'local-log-streams' && row.route?.endsWith('/operations-readiness')), 'Readiness must expose local log stream routing.');
  assert(readiness.rows?.some((row) => row.id === 'local-alert-rules' && row.route?.endsWith('/operations-readiness')), 'Readiness must expose local alert rule routing.');
  assert(readiness.rows?.some((row) => row.id === 'recovery-runbook' && row.route?.endsWith('/operations-readiness')), 'Readiness must expose recovery runbook routing.');
  assert(readiness.gates?.some((gate) => gate.id === 'centralized-logs-traces-production-blocked' && gate.status === 'blocked'), 'Readiness must keep centralized logs/traces as a production blocker.');
  assert(readiness.summary?.logStreamCount >= 1, 'Readiness summary must count local log streams.');
  assert(readiness.summary?.alertRuleCount >= 1, 'Readiness summary must count local alert rules.');
  assert(readiness.summary?.recoveryStepCount >= 1, 'Readiness summary must count recovery runbook steps.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Readiness Proof Map returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.errorReportingReadinessSummary?.count === 1, 'Readiness Proof Map must expose error reporting readiness as a formal proof surface.');
  assert(proofMap.errorReportingReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/error-reporting-readiness`, 'Error reporting proof route must point to the error reporting readiness API.');
  assert(proofMap.errorReportingReadinessRoutes?.[0]?.readyForProduction === false, 'Error reporting proof route must not claim production observability.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Manager Ready Package returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.errorReportingReadiness?.schemaVersion === 'error-reporting-readiness/v1', 'Manager Ready Package must include error reporting readiness.');
  assert(managerReadyPackage.summary?.errorReportingReadinessReady === true, 'Manager Ready Package summary must report local error reporting readiness.');
  assert(managerReadyPackage.summary?.errorReportingReadinessProductionReady === false, 'Manager Ready Package must keep production observability blocked.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200, `Project settings returned ${response.status}.`);
  const capabilities = response.body.projectSettings?.integrationCapabilities;
  assert(capabilities?.backendRoutes?.errorReportingReadiness === `/projects/${projectId}/error-reporting-readiness`, 'Integration capabilities must expose error reporting readiness route.');
  const errorReportingRow = capabilities?.rows?.find((row) => row.id === 'error-reporting');
  assert(errorReportingRow?.requiredBackendRoute === `/projects/${projectId}/error-reporting-readiness`, 'Error Reporting settings row must point to error-reporting-readiness.');
  assert(errorReportingRow.status === 'backend-backed' && errorReportingRow.editable === false, 'Error Reporting must be a backend-backed read-only readiness contract until production observability exists.');
  assert(errorReportingRow.readyForProduction === false, 'Error Reporting settings row must not claim production observability.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.id === projectId, 'File-backed store must persist the validation project.');

  console.log('Error reporting readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
