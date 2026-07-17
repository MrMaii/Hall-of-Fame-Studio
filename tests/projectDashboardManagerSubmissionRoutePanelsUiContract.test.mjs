import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSubmissionRoutePanels.jsx', import.meta.url);

test('Manager submission workspace and read-model routes stay lazy while App retains every review and proof rule', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager submission route wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerSubmissionRoutePanels = lazy(() => import('./ProjectDashboardManagerSubmissionRoutePanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSubmissionRoutePanels'));

  for (const contract of [
    'reviewDraftFor: submissionReviewDraftFor',
    'defaultReviewerId: defaultSubmissionReviewerId',
    'chatProofIdsForRow: chatProofIdsFromRow',
    'chatProofIdsForIds: chatProofIdsFromIds',
    'onUpdateReviewDraft: updateSubmissionReviewDraft',
    'onRunSubmissionReview: runBackendSubmissionReview',
    'onOpenChatProof: (proofIds, channelId) => openProjectChatProof(activeProject, proofIds, channelId)',
    'onOpenTimelineProof: openProjectTimelineProof',
    'reviewInputDisabled: !backendCommandAvailable || backendStation.loading',
    'reviewSubmitDisabled: (reviewerId) => !backendCommandAvailable || backendStation.loading || !reviewerId',
    'proofDisabled: (proofIds) => !proofIds.length',
  ]) {
    assert.ok(appSource.includes(contract), `App must retain ${contract}`);
  }

  const components = [
    'ProjectDashboardSubmissionWorkspace',
    'ProjectDashboardManagerReadModelRoutes',
  ];
  for (const component of components) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }
  const mountOrder = components.map(component => wrapperSource.indexOf(`<${component}`));
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Submission workspace and read-model routes must retain their original order');

  for (const contract of [
    'backendManagerDashboard: managerDashboard,',
    'managerSubmissionReviewRows,',
    'managerSubmissionReviewRowsBackendRequired,',
    'submissionReviewVerdicts,',
    'reviewDraftFor={reviewDraftFor}',
    'defaultReviewerId={defaultReviewerId}',
    'chatProofIdsForRow={chatProofIdsForRow}',
    'chatProofIdsForIds={chatProofIdsForIds}',
    'onUpdateReviewDraft={onUpdateReviewDraft}',
    'onRunSubmissionReview={onRunSubmissionReview}',
    'onOpenChatProof={onOpenChatProof}',
    'onOpenTimelineProof={onOpenTimelineProof}',
    'reviewInputDisabled={reviewInputDisabled}',
    'reviewSubmitDisabled={reviewSubmitDisabled}',
    'proofDisabled={proofDisabled}',
    'backendManagerDashboard={managerDashboard}',
    'activeProjectId={activeProject.id}',
    'backendManagerCommandCenter={managerCommandCenter}',
    'backendManagerScenarioTrail={managerScenarioTrail}',
    'backendManagerScenarioWalkthrough={managerScenarioWalkthrough}',
    'backendManagerRequirementMatrix={managerRequirementMatrix}',
    'backendManagerActionQueue={managerActionQueue}',
    'backendAgentAutonomousActionQueue={agentAutonomousActionQueue}',
    'backendAutonomousRunControl={autonomousRunControl}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Manager submission route wrapper must retain ${contract}`);
  }
});
