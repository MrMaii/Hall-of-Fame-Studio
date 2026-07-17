import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerSubmissionRoutePanels.jsx', import.meta.url);
const workspaceUrl = new URL('../src/project/ProjectDashboardSubmissionWorkspace.jsx', import.meta.url);

test('Manager Dashboard submission workspace stays lazy while App keeps review writes and proof navigation', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager submission route wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardSubmissionWorkspace = lazy(() => import('./ProjectDashboardSubmissionWorkspace.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardSubmissionWorkspace'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerSubmissionRoutePanels'));
  assert.ok(existsSync(workspaceUrl), 'Manager Dashboard submission workspace component must exist');

  const componentSource = readFileSync(workspaceUrl, 'utf8');
  for (const publicContract of [
    'backend-manager-submissions-route',
    'backend-manager-artifact-drafts-route',
    'backend-manager-evidence-searches-route',
    'backend-manager-submission-reviews-route',
    'backend-manager-submissions-snapshot',
    'backend-manager-submission-row-',
    'backend-manager-artifact-drafts-snapshot',
    'submission-chat-proof-',
    'submission-timeline-proof-',
    'submission-review-composer-',
    'submission-review-reviewer-',
    'submission-review-verdict-',
    'submission-review-submit-',
    'submission-review-comments-',
    'submission-review-requested-changes-',
    'submission-review-receipt-',
    'backend-manager-evidence-searches-snapshot',
    'backend-manager-submission-reviews-snapshot',
    'backend-manager-submission-reviews-required',
    'backend-manager-submission-review-row-',
    'backend-manager-submission-review-route-',
    'backend-manager-submission-review-chat-proof-',
    'backend-manager-submission-review-timeline-proof-',
    'Agent Submissions',
    'Evidence Searches',
    'Submission Reviews',
    'Submission chat proof',
    'Submission timeline proof',
    'Requested changes, one per line',
    'Review write failed:',
    'Review receipt:',
    'Review chat proof',
    'Review timeline proof',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Manager Dashboard submission workspace must keep ${publicContract}`);
  }

  for (const appContract of [
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
    assert.ok(appSource.includes(appContract), `App must keep submission workspace behavior ${appContract}`);
  }
});
