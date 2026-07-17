import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const intentUrl = new URL('../src/project/ProjectDashboardCollaborationIntentQueue.jsx', import.meta.url);
const reviewUrl = new URL('../src/project/ProjectDashboardSubmissionReviewWorkflow.jsx', import.meta.url);

test('Dashboard collaboration intent and submission review cards stay lazy and keep proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardCollaborationIntentQueue = lazy(() => import('./ProjectDashboardCollaborationIntentQueue.jsx'))"));
  assert.ok(assemblySource.includes("const ProjectDashboardSubmissionReviewWorkflow = lazy(() => import('./ProjectDashboardSubmissionReviewWorkflow.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardCollaborationIntentQueue'));
  assert.ok(assemblySource.includes('<ProjectDashboardSubmissionReviewWorkflow'));
  assert.ok(existsSync(intentUrl), 'Dashboard collaboration intent queue component must exist');
  assert.ok(existsSync(reviewUrl), 'Dashboard submission review workflow component must exist');

  const intentSource = readFileSync(intentUrl, 'utf8');
  for (const publicContract of [
    'proof-map-collaboration-intent-queue',
    'Collaboration Intent Queue',
    'queue.summary?.runnableCount',
    'queue.summary?.rowCount',
    'queue.rows?.length',
    'queue.summary?.agentInitiativeIntentCount',
    'Intent chat proof',
    'Intent timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(intentSource.includes(publicContract), `Dashboard collaboration intent queue must keep ${publicContract}`);
  }

  const reviewSource = readFileSync(reviewUrl, 'utf8');
  for (const publicContract of [
    'proof-map-submission-review-workflow',
    'Submission Review Workflow',
    'workflow.summary?.reviewCount',
    'workflow.summary?.revisionResponseCount',
    'workflow.summary?.acceptedFinalDeliverableCount',
    'Review chat proof',
    'Review timeline proof',
    'disabled={!chatProofIds.length}',
    'disabled={!timelineIds.length}',
    'onClick={onOpenChat}',
    'onClick={onOpenTimeline}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(reviewSource.includes(publicContract), `Dashboard submission review workflow must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('queue: backendCollaborationIntentQueue'));
  assert.ok(appSource.includes('chatProofIds: backendCollaborationIntentQueueChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendCollaborationIntentQueueTimelineIds'));
  assert.ok(appSource.includes('workflow: backendSubmissionReviewWorkflow'));
  assert.ok(appSource.includes('chatProofIds: backendSubmissionReviewWorkflowChatProofIds'));
  assert.ok(appSource.includes('timelineIds: backendSubmissionReviewWorkflowTimelineIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendCollaborationIntentQueueRoute, 'proof-map-collaboration-intent-queue-sync-proof-map')"));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendSubmissionReviewWorkflowRoute, 'proof-map-submission-review-workflow-sync-proof-map')"));
});
