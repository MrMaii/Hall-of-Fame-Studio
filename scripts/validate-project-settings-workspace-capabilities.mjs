import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `project-settings-workspace-capabilities-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const runtimeRoot = resolve(tempRoot, 'runtime');
const boundWorkspaceRoot = resolve(tempRoot, 'bound-workspace');
const projectId = 'project_settings_workspace_capabilities_validation';
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
    projectRuntime: createLocalProjectRuntime({
      rootPath: runtimeRoot,
    }),
  });

  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Project Settings Workspace Capabilities Validation',
      brief: 'Validate Settings Workspace backend capability rows without exposing fake editable controls.',
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
      language: 'zh',
      workspacePolicy: {
        interfaceDensity: 'compact',
        defaultVisibility: 'manager-only',
        autosaveCadenceSeconds: 120,
      },
      updatedBy: 'Director',
      source: 'workspace-capabilities-validation',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200, `Project settings update returned ${response.status}.`);
  const workspacePolicy = response.body.projectSettings?.workspacePolicy;
  assert(workspacePolicy?.schemaVersion === 'project-workspace-policy/v1', 'Project settings must persist a workspace policy.');
  assert(workspacePolicy.interfaceDensity === 'compact', 'Workspace policy must persist interface density.');
  assert(workspacePolicy.defaultVisibility === 'manager-only', 'Workspace policy must persist default visibility.');
  assert(workspacePolicy.autosaveCadenceSeconds === 120, 'Workspace policy must persist autosave cadence.');
  assert(workspacePolicy.readyForProduction === false, 'Workspace policy must not overclaim production readiness.');
  const capabilities = response.body.projectSettings?.workspaceCapabilities;
  assert(capabilities?.schemaVersion === 'project-workspace-capabilities/v1', 'Project settings must expose workspace capability rows.');
  assert(capabilities.summary?.backendBackedCount >= 8, 'Workspace capabilities must mark project language, workspace policy controls, local workspace binding, runtime contracts, memory readiness, and meeting summaries backend-backed.');
  assert(capabilities.summary?.browserLocalCount >= 1, 'Workspace capabilities must explicitly mark global language browser-local.');
  assert(capabilities.summary?.backendRequiredCount === 0, 'Workspace capabilities must not show route-backed Workspace controls as missing backend APIs.');
  assert(capabilities.rows?.some((row) => row.id === 'project-language' && row.status === 'backend-backed' && row.editable), 'Project language row must be backend-backed and editable.');
  assert(capabilities.rows?.some((row) => row.id === 'global-interface-language' && row.status === 'browser-local' && row.editable), 'Global interface language row must be explicit browser-local state.');
  for (const id of ['interface-density', 'default-visibility', 'autosave-cadence']) {
    const row = capabilities.rows.find((item) => item.id === id);
    assert(row?.status === 'backend-backed' && row.editable === true, `${id} must be backend-backed through project-workspace-policy/v1.`);
    assert(row.requiredBackendRoute === `/projects/${projectId}/project-settings`, `${id} must write through the project settings route.`);
    assert(row.readyForProduction === false, `${id} must not overclaim production readiness.`);
  }
  const localWorkspaceBindingRow = capabilities.rows.find((item) => item.id === 'local-workspace-binding');
  assert(localWorkspaceBindingRow?.status === 'backend-backed' && localWorkspaceBindingRow.editable === true, 'Local workspace binding must be backend-backed and editable through the local runtime route.');
  assert(localWorkspaceBindingRow.requiredBackendRoute === `/projects/${projectId}/workspace/bind`, 'Local workspace binding must point to the project workspace bind route.');
  assert(localWorkspaceBindingRow.readyForLocalMvp === true && localWorkspaceBindingRow.readyForProduction === false, 'Local workspace binding must prove local MVP readiness without claiming production managed workspace readiness.');
  const projectRulesRow = capabilities.rows.find((item) => item.id === 'project-rules');
  assert(projectRulesRow?.status === 'backend-backed' && projectRulesRow.editable === false, 'Project rules must expose the backend runtime contract manifest without pretending to be editable.');
  assert(projectRulesRow.requiredBackendRoute === `/projects/${projectId}/runtime-contracts`, 'Project rules must point to the real runtime contracts route.');
  assert(projectRulesRow.readyForLocalMvp === true && projectRulesRow.readyForProduction === false, 'Project rules must be local-MVP route-backed without production overclaim.');
  const memoryRow = capabilities.rows.find((item) => item.id === 'long-term-memory');
  assert(memoryRow?.status === 'backend-backed' && memoryRow.editable === false, 'Long-term memory must expose backend memory readiness without pretending to be editable.');
  assert(memoryRow.requiredBackendRoute === `/projects/${projectId}/memory-readiness`, 'Long-term memory must point to the project memory readiness route.');
  assert(memoryRow.readyForLocalMvp === true && memoryRow.readyForProduction === false, 'Long-term memory readiness must be local-MVP route-backed without production overclaim.');
  const meetingSummariesRow = capabilities.rows.find((item) => item.id === 'meeting-summaries');
  assert(meetingSummariesRow?.status === 'backend-backed' && meetingSummariesRow.editable === true, 'Meeting summaries must be route-backed instead of a fake disabled workspace control.');
  assert(meetingSummariesRow.requiredBackendRoute === `/projects/${projectId}/meeting-summaries`, 'Meeting summaries must expose the project-scoped backend summary route.');
  assert(meetingSummariesRow.readyForProduction === false, 'Meeting summaries must not overclaim production readiness.');
  assert(capabilities.backendRoutes?.projectSettings === `/projects/${projectId}/project-settings`, 'Workspace capabilities must expose the project settings route.');
  assert(capabilities.backendRoutes?.workspaceBind === `/projects/${projectId}/workspace/bind`, 'Workspace capabilities must expose the workspace bind route.');
  assert(capabilities.backendRoutes?.localRuntime === `/projects/${projectId}/local-runtime`, 'Workspace capabilities must expose the local runtime route.');
  assert(capabilities.backendRoutes?.transcripts === `/projects/${projectId}/transcripts`, 'Workspace capabilities must expose the transcript route for meeting-summary readiness.');
  assert(capabilities.backendRoutes?.meetingSummaries === `/projects/${projectId}/meeting-summaries`, 'Workspace capabilities must expose the meeting summaries route.');
  assert(capabilities.backendRoutes?.persistenceAdapterPlan === `/projects/${projectId}/persistence-adapter-plan`, 'Workspace capabilities must expose the persistence adapter route for memory readiness.');
  assert(capabilities.backendRoutes?.memoryReadiness === `/projects/${projectId}/memory-readiness`, 'Workspace capabilities must expose the project memory readiness route.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/meeting`,
    body: {
      includeReadModels: false,
      text: 'Kickoff meeting: confirm evidence plan, assign drafting actions, note launch risks, and prepare a product-team summary.',
      now: '2026-06-01T10:08:00.000Z',
    },
  });
  assert(response.status === 200, `Meeting command returned ${response.status}.`);
  assert(response.body.meetingAgentTurns?.length >= 1, 'Meeting command must create backend-authored Agent turns before summaries can be trusted.');
  assert(response.body.meetingAgentTurns.every((turn) => turn.timelineLogIds?.length >= 1), 'Meeting Agent turns must include timeline proof ids.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/meeting-summaries`,
  });
  assert(response.status === 200, `Meeting summaries route returned ${response.status}.`);
  const meetingSummaries = response.body.meetingSummaries;
  const summaryRow = meetingSummaries?.rows?.[0];
  assert(meetingSummaries?.schemaVersion === 'meeting-summaries/v1', 'Meeting summaries must expose the backend read-model schema.');
  assert(meetingSummaries.status === 'meeting-summaries-ready', 'Meeting summaries must become locally ready after backend meeting proof exists.');
  assert(meetingSummaries.backendRoutes?.meetingSummaries === `/projects/${projectId}/meeting-summaries`, 'Meeting summaries must expose its own refresh route.');
  assert(meetingSummaries.summary?.rowCount >= 1 && summaryRow?.source === 'backend-transcript-derived', 'Meeting summaries must derive rows from backend transcripts.');
  assert(summaryRow.proofIds?.length >= 1 && summaryRow.timelineLogIds?.length >= 1, 'Meeting summary rows must carry transcript proof ids and timeline proof ids.');
  assert(summaryRow.transcriptRoute === `/projects/${projectId}/transcripts/main`, 'Meeting summary rows must link back to the source transcript route.');
  assert(summaryRow.readyForLocalMvp === true && summaryRow.readyForProduction === false, 'Meeting summaries must prove local MVP readiness without claiming production readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/runtime-contracts`,
  });
  assert(response.status === 200, `Runtime contracts route returned ${response.status}.`);
  assert(response.body.runtimeContracts?.schemaVersion === 'runtime-contract-freeze/v1', 'Project rules row must point to a real runtime contract freeze manifest.');
  assert(response.body.runtimeContracts.backendRoutes?.runtimeContracts === `/projects/${projectId}/runtime-contracts`, 'Runtime contracts must expose the same project-scoped route as the workspace capability row.');
  assert(response.body.runtimeContracts.readyForProduction === false, 'Runtime contracts must not overclaim public production readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/memory-readiness`,
  });
  assert(response.status === 200, `Memory readiness route returned ${response.status}.`);
  const memoryReadiness = response.body.projectMemoryReadiness;
  assert(memoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Long-term memory row must point to a real project memory readiness read model.');
  assert(memoryReadiness.backendRoutes?.memoryReadiness === `/projects/${projectId}/memory-readiness`, 'Memory readiness must expose its own project-scoped route.');
  assert(memoryReadiness.backendRoutes?.evidenceIndexReadiness === `/projects/${projectId}/evidence-index-readiness`, 'Memory readiness must link to the evidence/artifact index route.');
  assert(memoryReadiness.backendRoutes?.persistenceAdapterPlan === `/projects/${projectId}/persistence-adapter-plan`, 'Memory readiness must link to the persistence adapter plan route.');
  assert(memoryReadiness.rows?.some((row) => row.id === 'transcript-memory'), 'Memory readiness must include transcript memory rows.');
  assert(memoryReadiness.rows?.some((row) => row.id === 'evidence-artifact-memory'), 'Memory readiness must include evidence/artifact memory rows.');
  assert(memoryReadiness.gates?.some((gate) => gate.id === 'managed-long-term-memory-production-blocked' && gate.status === 'blocked'), 'Memory readiness must keep managed long-term memory as a production blocker.');
  assert(memoryReadiness.readyForProduction === false, 'Memory readiness must not overclaim production readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/readiness-proof-map`,
  });
  assert(response.status === 200, `Readiness Proof Map route returned ${response.status}.`);
  const proofMap = response.body;
  assert(proofMap.projectMemoryReadinessSummary?.count === 1, 'Readiness Proof Map must expose project memory readiness as a formal proof surface.');
  assert(proofMap.projectMemoryReadinessRoutes?.[0]?.apiPath === `/projects/${projectId}/memory-readiness`, 'Project memory proof route must point to the memory readiness API.');
  assert(proofMap.projectMemoryReadinessRoutes?.[0]?.readyForProduction === false, 'Project memory proof route must not overclaim production readiness.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/manager-ready-package`,
  });
  assert(response.status === 200, `Manager Ready Package route returned ${response.status}.`);
  const managerReadyPackage = response.body;
  assert(managerReadyPackage.projectMemoryReadiness?.schemaVersion === 'project-memory-readiness/v1', 'Manager Ready Package must include project memory readiness.');
  assert(managerReadyPackage.summary?.projectMemoryReadinessRowCount >= 4, 'Manager Ready Package summary must report memory readiness rows.');
  assert(managerReadyPackage.summary?.projectMemoryReadinessProductionReady === false, 'Manager Ready Package must keep managed memory production-blocked.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200 && response.body.projectSettings?.workspaceCapabilities?.checksum === capabilities.checksum, 'GET project-settings must return the same workspace capability contract.');
  assert(response.body.projectSettings?.workspacePolicy?.interfaceDensity === 'compact', 'GET project-settings must return the persisted workspace policy.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/workspace/bind`,
    body: {
      workspacePath: boundWorkspaceRoot,
      createIfMissing: true,
      now: '2026-06-01T10:20:00.000Z',
    },
  });
  assert(response.status === 200, `Workspace bind route returned ${response.status}.`);
  assert(response.body.route === 'workspace-bound', 'Workspace bind route must return a workspace-bound receipt.');
  assert(response.body.localRuntime?.workspacePath === boundWorkspaceRoot, 'Workspace bind route must return the bound absolute workspace path.');
  assert(response.body.project?.localRuntime?.workspacePath === boundWorkspaceRoot, 'Workspace bind route must persist the bound path onto the project snapshot.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/local-runtime`,
  });
  assert(response.status === 200, `Local runtime route returned ${response.status}.`);
  assert(response.body.localRuntime?.workspacePath === boundWorkspaceRoot, 'Local runtime route must read back the Settings-bound workspace path.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/timeline`,
  });
  assert(response.status === 200 && response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.workspaceCapabilities?.schemaVersion === 'project-workspace-capabilities/v1'), 'Timeline must expose workspace capability settings proof.');
  assert(response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.workspacePolicy?.schemaVersion === 'project-workspace-policy/v1'), 'Timeline must expose workspace policy proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/events`,
  });
  assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.workspaceCapabilities?.schemaVersion === 'project-workspace-capabilities/v1'), 'Event ledger must expose workspace capability settings proof.');
  assert(response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.workspacePolicy?.schemaVersion === 'project-workspace-policy/v1'), 'Event ledger must expose workspace policy proof.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.workspacePolicy?.defaultVisibility === 'manager-only', 'File-backed store must persist the workspace policy.');
  assert(storedProject?.projectSettings?.workspaceCapabilities?.checksum === capabilities.checksum, 'File-backed store must persist the workspace capability contract.');
  assert(storedProject?.localRuntime?.workspacePath === boundWorkspaceRoot, 'File-backed store must persist the Settings-bound local workspace path.');
  assert(storedProject?.projectSettingsAudit?.some((entry) => entry.workspaceCapabilities?.checksum === capabilities.checksum), 'File-backed store must persist the workspace capability audit entry.');

  const appSource = await readFile(resolve(repoRoot, 'src', 'App.jsx'), 'utf8');
  const settingsComponentSource = (await Promise.all(
    (await readdir(resolve(repoRoot, 'src', 'settings')))
      .filter((name) => /\.jsx$/.test(name))
      .sort()
      .map((name) => readFile(resolve(repoRoot, 'src', 'settings', name), 'utf8')),
  )).join('\n');
  const settingsUiSource = `${appSource}\n${settingsComponentSource}`;
  assert(settingsUiSource.includes('settings-workspace-bind-contract'), 'Settings Workspace UI must render the backend workspace bind contract.');
  assert(settingsUiSource.includes('settings-workspace-bind-path-input'), 'Settings Workspace UI must expose a workspace path input.');
  assert(settingsUiSource.includes('settings-workspace-bind-submit'), 'Settings Workspace UI must expose a backend workspace bind action.');
  assert(settingsUiSource.includes('/workspace/bind') && settingsUiSource.includes('/local-runtime'), 'Settings Workspace UI must show the workspace bind and local runtime routes.');
  assert(appSource.includes('bindProjectWorkspaceFromSettings') && appSource.includes('requestAgentBackend(`/projects/${encodeURIComponent(activeProject.id)}/workspace/bind`'), 'Settings Workspace bind action must call the backend workspace bind route.');

  const apiSource = await readFile(resolve(repoRoot, 'src', 'agents', 'agentProjectApi.js'), 'utf8');
  assert(apiSource.includes("route.action === 'workspace'") && apiSource.includes("route.tail[0] === 'bind'") && apiSource.includes('service.bindProjectWorkspace'), 'Agent project API must expose the workspace bind route.');

  const serviceSource = await readFile(resolve(repoRoot, 'src', 'agents', 'agentProjectService.js'), 'utf8');
  assert(serviceSource.includes("id: 'local-workspace-binding'") && serviceSource.includes("workspaceBind: projectId ? `/projects/${projectId}/workspace/bind`"), 'Agent project service must include local workspace binding in the workspace capability contract.');

  console.log('Project settings workspace capabilities validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
