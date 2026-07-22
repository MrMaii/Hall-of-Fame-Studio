import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const releaseGateSource = readFileSync(
  new URL('../scripts/validate-current-local-product-release.mjs', import.meta.url),
  'utf8',
);
const productTeamSmokeSource = readFileSync(
  new URL('../scripts/validate-product-team-core-smoke.mjs', import.meta.url),
  'utf8',
);
const primaryProjectFlowSource = readFileSync(
  new URL('../scripts/validate-primary-project-flow-ui.mjs', import.meta.url),
  'utf8',
);
const managerScenarioGateSource = readFileSync(
  new URL('../scripts/validate-agent-manager-scenario.mjs', import.meta.url),
  'utf8',
);
const workspaceCapabilitiesGateSource = readFileSync(
  new URL('../scripts/validate-project-settings-workspace-capabilities.mjs', import.meta.url),
  'utf8',
);

test('the local release gate follows the current advanced dashboard architecture', () => {
  assert.ok(!releaseGateSource.includes('src/project/ProjectOverview.jsx'));
  assert.ok(!releaseGateSource.includes("'ProjectOverview'"));
  assert.ok(releaseGateSource.includes('src/project/ProjectDashboardAdvancedView.jsx'));
  assert.ok(releaseGateSource.includes("'ProjectDashboardAdvancedView'"));
});

test('the product-team smoke reads Agent Workbench proof from its current component', () => {
  assert.ok(productTeamSmokeSource.includes("../src/project/ProjectDashboardTeam.jsx"));
  assert.ok(productTeamSmokeSource.includes("projectDashboardTeamSource.includes('agent-workbench-artifact-draft-proof')"));
  assert.ok(!productTeamSmokeSource.includes("appSource.includes('agent-workbench-artifact-draft-proof')"));
});

test('the product-team smoke recognizes localized professional labels case-insensitively', () => {
  assert.ok(productTeamSmokeSource.includes(".toLocaleLowerCase().includes(String(label).toLocaleLowerCase())"));
});

test('the product-team smoke follows the narrowed workflow decision taxonomy', () => {
  assert.ok(productTeamSmokeSource.includes("node.category === 'governance' && node.subtype === 'leader-decision'"));
  assert.ok(!productTeamSmokeSource.includes("node.category === 'decision'), 'Compact Manager Flow Graph must retain major project decisions."));
});

test('the primary project browser gate targets the current advanced dashboard', () => {
  assert.ok(!primaryProjectFlowSource.includes('project-simple-dashboard'));
  assert.ok(primaryProjectFlowSource.includes("getByTestId('project-dashboard-view')"));
  assert.ok(primaryProjectFlowSource.includes("getByTestId('project-dashboard-core-models-preloader')"));
  assert.ok(primaryProjectFlowSource.includes('consoleShellLatencyMs < 5000'));
});

test('the manager scenario gate accepts the component-localized timeline focus label', () => {
  assert.ok(managerScenarioGateSource.includes("timelineUiSource.includes('Timeline proof focus')"));
  assert.ok(!managerScenarioGateSource.includes("timelineUiSource.includes('Timeline proof focus:')"));
});

test('the manager scenario gate reads modular proof blockers from the project UI bundle', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('backend-proof-transcript-required')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('backend-proof-timeline-required')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('const selectedChatProofIds = selectedNode ? chatProofIdsFromNode(selectedNode) : []')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('backend-proof-transcript-required')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('backend-proof-timeline-required')"));
});

test('the manager scenario gate reads kickoff provenance from its current dashboard module', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('kickoff-dashboard-generation-source')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('Kickoff Generation Source')"));
  assert.ok(!managerScenarioGateSource.includes("projectDashboardAgentOverviewSource.includes('kickoff-dashboard-generation-source')"));
});

test('the manager scenario gate reads initiation errors from the onboarding UI bundle', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('initiation-backend-error')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('initiation-backend-error')"));
});

test('the manager scenario gate accepts localized scheduler control label fragments', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('AGENT CONTROL')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('STRATEGY')"));
  assert.ok(!managerScenarioGateSource.includes("projectUiSource.includes('AGENT CONTROL: STRATEGY')"));
});

test('the manager scenario gate follows the modular scheduler seed-disabled prop', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('seedDisabled: backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('disabled={seedDisabled}')"));
  assert.ok(!managerScenarioGateSource.includes("projectUiSource.includes('seedDisabled={backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)}')"));
});

test('the manager scenario gate accepts the component-localized dashboard sync label', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('Manager dashboard sync')"));
  assert.ok(!managerScenarioGateSource.includes("projectUiSource.includes('Manager dashboard sync:')"));
});

test('the manager scenario gate accepts all component-localized sync labels', () => {
  for (const label of [
    'Command center sync',
    'Scenario walkthrough sync',
    'Scenario trail sync',
    'Requirement matrix sync',
    'Sync protocol audit sync',
    'Use case audit sync',
  ]) {
    assert.ok(managerScenarioGateSource.includes(`projectUiSource.includes('${label}')`));
    assert.ok(!managerScenarioGateSource.includes(`projectUiSource.includes('${label}:')`));
  }
});

test('the manager scenario gate accepts localized queue and ready-package sync labels', () => {
  for (const label of ['Action queue sync', 'Agent autonomous queue sync', 'Ready package sync']) {
    assert.ok(managerScenarioGateSource.includes(`projectUiSource.includes('${label}')`));
    assert.ok(!managerScenarioGateSource.includes(`projectUiSource.includes('${label}:')`));
  }
});

test('the manager scenario gate follows the modular autonomous-queue run callback prop', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('onRunRow: runAgentAutonomousActionQueueRow')"));
  assert.ok(!managerScenarioGateSource.includes("projectUiSource.includes('onRunRow={runAgentAutonomousActionQueueRow}')"));
});

test('the manager scenario gate reads ready-package source badges from the project UI bundle', () => {
  for (const marker of [
    'backend-brainstorm-layer-source',
    'backend-artifact-quality-audit-source',
    'backend-submission-review-workflow-source',
    'backend-evidence-quality-audit-source',
    'backend-evidence-source-review-workflow-source',
    'backend-evidence-custody-readiness-source',
  ]) {
    assert.ok(managerScenarioGateSource.includes(`projectUiSource.includes('${marker}')`));
    assert.ok(!managerScenarioGateSource.includes(`appSource.includes('${marker}')`));
  }
});

test('the manager scenario gate follows modular worker-station props and controls', () => {
  assert.ok(managerScenarioGateSource.includes("appSource.includes('onSyncManagerView: refreshBackendManagerView')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('onSyncManagerView={refreshBackendManagerView}')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('backend-url-input')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('Save URL')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('backend-url-input')"));
});

test('the manager scenario gate follows modular autonomy disabled props', () => {
  assert.ok(managerScenarioGateSource.includes("appSource.includes('commandDisabled: !backendCommandAvailable || backendStation.loading')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('runDisabled: !backendCommandAvailable || backendStation.loading')"));
  assert.ok(managerScenarioGateSource.includes("agentAutonomousActionQueueUiSource.includes('disabled={runDisabled || Boolean(effectivePendingAgentId) || !row.canRun || row.routeResolved === false}')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('commandDisabled={!backendCommandAvailable || backendStation.loading}')"));
});

test('the manager scenario gate reads the modular flow graph from the project UI bundle', () => {
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('manager-flow-graph/missing-backend')"));
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('onClick={() => confirmManagerFlowNode(selectedNode.id, false)}')"));
  assert.ok(!managerScenarioGateSource.includes("timelineUiSource.includes('manager-flow-graph/missing-backend')"));
});

test('the manager scenario gate follows the modular reviewer-disabled callback prop', () => {
  assert.ok(managerScenarioGateSource.includes("appSource.includes('reviewSubmitDisabled: (reviewerId) => !backendCommandAvailable || backendStation.loading || !reviewerId')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('reviewSubmitDisabled={(reviewerId) => !backendCommandAvailable || backendStation.loading || !reviewerId}')"));
});

test('the manager scenario gate reads modular autonomy-panel source badges', () => {
  for (const marker of [
    'backend-product-team-delivery-trace-source',
    'backend-product-team-operating-loop-source',
    'backend-team-collaboration-diagnostics-source',
    'backend-runtime-contracts-source',
    'backend-autonomous-cycle-consistency-source',
  ]) {
    assert.ok(managerScenarioGateSource.includes(`projectUiSource.includes('${marker}')`));
    assert.ok(!managerScenarioGateSource.includes(`appSource.includes('${marker}')`));
  }
  assert.ok(managerScenarioGateSource.includes("projectUiSource.includes('managerReadModelSourceLabel(operatingLoop)')"));
});

test('the manager scenario gate checks event-ledger hydration at the project service boundary', () => {
  assert.ok(managerScenarioGateSource.includes("serviceSource.includes('export function hydrateAgentProject(project = {})')"));
  assert.ok(managerScenarioGateSource.includes("serviceSource.includes('attachWorkerRunControlsToProject(backfillProjectEventLedger(project))')"));
  assert.ok(!managerScenarioGateSource.includes("appSource.includes('const hydrateProject = (project) => backfillProjectEventLedger')"));
});

test('the manager scenario service fixture retains kickoff transcripts for archive recovery', () => {
  assert.ok(managerScenarioGateSource.includes('projects: [{'));
  assert.ok(managerScenarioGateSource.includes('...publishedCycleChat.project,'));
  assert.ok(managerScenarioGateSource.includes('initiation: { roleNegotiation, leaderElection, leaderId, approvedAt: kickoffCharter.createdAt }'));
  assert.ok(!managerScenarioGateSource.includes('[manager-scenario debug transcript-index]'));
});

test('the manager scenario recognizes management check-ins by durable message identity', () => {
  assert.ok(managerScenarioGateSource.includes("/^agent_management_turing_curie/.test(message.id || '')"));
  assert.ok(managerScenarioGateSource.includes("message.agentWorker?.targetAgentId === 'curie'"));
  assert.ok(managerScenarioGateSource.includes("/^agent_management_response_curie_turing/.test(message.id || '')"));
  assert.ok(!managerScenarioGateSource.includes('[manager-scenario debug direct-agent-worker]'));
  assert.ok(!managerScenarioGateSource.includes("/management check-in/i.test(message.text || '')"));
  assert.ok(!managerScenarioGateSource.includes("/picked up your management signal/i.test(message.text || '')"));
});

test('the manager scenario recognizes Agent work messages by durable identity', () => {
  assert.ok(managerScenarioGateSource.includes("message.agentWorker?.agentId === 'turing' && /^agent_work_turing_/.test(message.id || '')"));
  assert.ok(!managerScenarioGateSource.includes("/Progress on|Completed/.test(message.text || '')"));
});

test('the manager scenario checks visible priority reasons without requiring internal jargon', () => {
  assert.ok(managerScenarioGateSource.includes('priorityDueAgentCycle.processed[0].managementReasons.some((reason) => message.text.includes(reason))'));
  assert.ok(!managerScenarioGateSource.includes('/Management priority:/i.test(message.text)'));
});

test('approved legacy kickoff transcripts recover implicit role-question confirmation', () => {
  const serviceSource = readFileSync(new URL('../src/agents/agentProjectService.js', import.meta.url), 'utf8');
  assert.ok(serviceSource.includes("!project.initiation?.roleQuestionResolutions?.length && charter?.status === 'approved'"));
  assert.ok(serviceSource.includes('recoveredRows.map((row, index) =>'));
  assert.ok(serviceSource.includes("source: 'approved-kickoff-charter'"));
});

test('the workspace-capabilities gate reads modular Settings UI', () => {
  assert.ok(workspaceCapabilitiesGateSource.includes("readdir(resolve(repoRoot, 'src', 'settings'))"));
  assert.ok(workspaceCapabilitiesGateSource.includes("const settingsUiSource = `${appSource}\\n${settingsComponentSource}`"));
  assert.ok(workspaceCapabilitiesGateSource.includes("settingsUiSource.includes('settings-workspace-bind-contract')"));
  assert.ok(!workspaceCapabilitiesGateSource.includes("appSource.includes('settings-workspace-bind-contract')"));
});
