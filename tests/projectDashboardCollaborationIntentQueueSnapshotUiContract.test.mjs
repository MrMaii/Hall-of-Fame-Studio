import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardCollaborationIntentQueueSnapshot.jsx', import.meta.url);

test('ready package collaboration intent queue stays lazy and preserves run and proof actions', () => {
  assert.ok(existsSync(componentUrl), 'Ready package collaboration intent queue component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardCollaborationIntentQueueSnapshot = lazy(() => import('./ProjectDashboardCollaborationIntentQueueSnapshot.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardCollaborationIntentQueueSnapshot'));
  assert.ok(appSource.includes('chatProofIdsFromRow,'));
  assert.ok(appSource.includes('intentRunDisabled: (row) => !backendCommandAvailable || backendStation.loading || !row.canRun || !row.runIntentApiPath'));
  assert.ok(appSource.includes('onOpenChatProof: (proofIds, channelId) => openProjectChatProof(activeProject, proofIds, channelId)'));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('onRunIntent: runCollaborationIntentQueueRow'));
  assert.ok(appSource.includes('projectId: activeProject.id'));
  assert.ok(appSource.includes('renderActionDecision: renderAutonomousActionDecision'));
  assert.ok(appSource.includes('runOutput: backendCollaborationIntentRunOutput'));
  assert.ok(appSource.includes('runReceipt: backendCollaborationIntentRunReceipt'));
  assert.ok(appSource.includes('sourceBadge: <span data-testid="backend-collaboration-intent-queue-source"'));
  assert.ok(appSource.includes('workflow: backendCollaborationIntentQueue'));

  for (const contract of [
    'backend-collaboration-intent-queue-snapshot',
    'Collaboration Intent Queue',
    'readyForLocalPilotIntentQueue',
    'Rows',
    'Runnable',
    'Meetings',
    'Group Chat',
    'Mission Handoff',
    'Intent Runs',
    'Agent Intent',
    'Review Intent',
    'Proof IDs',
    'Events',
    'backend-collaboration-intent-queue-next',
    'backend-collaboration-intent-queue-rows',
    '.slice(0, 8)',
    'chatProofIdsFromRow(row)',
    'collaboration-intent-chat-proof-',
    "onOpenChatProof(rowChatProofIds, row.channelId || 'main')",
    'disabled={!rowChatProofIds.length}',
    'Intent chat proof',
    'collaboration-intent-timeline-proof-',
    'onOpenTimelineProof(rowTimelineProofIds)',
    'disabled={!rowTimelineProofIds.length}',
    'Intent timeline proof',
    'collaboration-intent-run-',
    'onRunIntent(row)',
    'disabled={intentRunDisabled(row)}',
    'Run intent',
    'backend-collaboration-intent-run-receipt',
    'backend-collaboration-intent-run-output',
    'backend-collaboration-intent-run-output-failed',
    'backend-collaboration-intent-action-decision',
    'backend-collaboration-intent-run-output-empty',
    'backend-collaboration-intent-run-output-rows',
    'collaboration-intent-output-chat-proof-',
    "onOpenChatProof(chatProofIds, 'main')",
    'collaboration-intent-output-timeline-proof-',
    'onOpenTimelineProof(timelineProofIds)',
    'backend-collaboration-intent-queue-route',
    '`/projects/${projectId}/collaboration-intent-queue`',
  ]) {
    assert.ok(componentSource.includes(contract), `Ready package collaboration intent queue must keep ${contract}`);
  }

  assert.equal(
    appSource.includes('data-testid="backend-collaboration-intent-queue-snapshot"'),
    false,
    'Ready package collaboration intent queue markup must no longer remain duplicated in App',
  );
});
