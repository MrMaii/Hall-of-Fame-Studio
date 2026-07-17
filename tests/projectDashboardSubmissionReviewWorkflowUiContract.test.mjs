import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const coreAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const evidencePanelsUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageEvidencePanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardSubmissionReviewWorkflowSnapshot.jsx', import.meta.url);

test('submission review workflow stays lazy and preserves both original proof actions', () => {
  assert.ok(existsSync(componentUrl), 'Submission review workflow component must exist');
  assert.ok(existsSync(evidencePanelsUrl), 'Manager Ready Package evidence panels component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');
  const evidencePanelsSource = readFileSync(evidencePanelsUrl, 'utf8');

  assert.ok(coreAssemblySource.includes("const ProjectDashboardManagerReadyPackageEvidencePanels = lazy(() => import('./ProjectDashboardManagerReadyPackageEvidencePanels.jsx'))"));
  assert.ok(evidencePanelsSource.includes("const ProjectDashboardSubmissionReviewWorkflowSnapshot = lazy(() => import('./ProjectDashboardSubmissionReviewWorkflowSnapshot.jsx'));"));
  assert.ok(evidencePanelsSource.includes('<ProjectDashboardSubmissionReviewWorkflowSnapshot'));
  assert.ok(appSource.includes('chatProofIdsFromIds,'));
  assert.ok(appSource.includes('onOpenSubmissionReviewChatProof: (proofIds, channelId) => openProjectChatProof(activeProject, proofIds, channelId)'));
  assert.ok(appSource.includes('onOpenSubmissionReviewTimelineProof: openProjectTimelineProof'));
  assert.ok(evidencePanelsSource.includes('onOpenChatProof={onOpenSubmissionReviewChatProof}'));
  assert.ok(evidencePanelsSource.includes('onOpenTimelineProof={onOpenSubmissionReviewTimelineProof}'));
  assert.ok(evidencePanelsSource.includes('route={readyPackage.backendRoutes?.submissionReviewWorkflow}'));
  assert.ok(evidencePanelsSource.includes("sourceBadge={<span data-testid=\"backend-submission-review-workflow-source\""));
  assert.ok(evidencePanelsSource.includes("syncButton={managerProofModelSyncButton(submissionReviewWorkflow, 'backend-submission-review-workflow-sync-proof-models')}"));
  assert.ok(evidencePanelsSource.includes('workflow={submissionReviewWorkflow}'));

  for (const contract of [
    'backend-submission-review-workflow-snapshot',
    'Submission Review Workflow',
    'readyForPrivatePilotReview',
    'Review Rounds',
    'Accepted',
    'Change Requests',
    'Open Changes',
    'Revision Responses',
    'Final Accepted',
    'Proof Ready',
    'Packet',
    'backend-submission-review-workflow-proof-rows',
    'workflow.openChangeRequestRows?.length ? workflow.openChangeRequestRows : workflow.roundRows || []',
    '.slice(0, 4)',
    'const workflowReviewChatProofIds = chatProofIdsFromIds(row.proofIds || [])',
    'backend-submission-review-workflow-chat-proof-',
    "onOpenChatProof(workflowReviewChatProofIds, row.channelId || 'main')",
    'disabled={!workflowReviewChatProofIds.length}',
    'Review chat proof',
    'backend-submission-review-workflow-timeline-proof-',
    'onOpenTimelineProof(workflowReviewTimelineIds)',
    'disabled={!workflowReviewTimelineIds.length}',
    'Review timeline proof',
    'Review workflow route',
    '`/projects/${projectId}/submission-review-workflow`',
  ]) {
    assert.ok(componentSource.includes(contract), `Submission review workflow must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-submission-review-workflow-snapshot"'),
    false,
    'Submission review workflow markup must no longer remain duplicated in App',
  );
});
