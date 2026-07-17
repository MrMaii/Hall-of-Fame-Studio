import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerCompatibilityProofPanels.jsx', import.meta.url);
const componentUrl = new URL('../src/project/ProjectDashboardCollaborationIntentFallback.jsx', import.meta.url);

test('Dashboard fallback collaboration intent queue stays lazy while App keeps its run and proof actions', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager compatibility proof wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardCollaborationIntentFallback = lazy(() => import('./ProjectDashboardCollaborationIntentFallback.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardCollaborationIntentFallback'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerCompatibilityProofPanels'));
  assert.ok(existsSync(componentUrl), 'Dashboard fallback collaboration intent queue component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-collaboration-intent-queue-snapshot',
    'backend-collaboration-intent-queue-source',
    'Collaboration Intent Queue',
    'Rows',
    'Runnable',
    'Mission Handoff',
    'Intent Runs',
    'backend-collaboration-intent-queue-rows',
    'collaboration-intent-run-',
    'Run intent',
    'backend-collaboration-intent-run-output',
    'Intent Run Failed',
    'Intent Output Nodes',
    'backend-collaboration-intent-output-work-submission',
    'backend-collaboration-intent-handoff-output-routes',
    'collaboration-intent-output-chat-proof-work-submission',
    'collaboration-intent-output-timeline-proof-work-submission',
    'backend-collaboration-intent-standalone-output-rows',
    'collaboration-intent-output-chat-proof-',
    'collaboration-intent-output-timeline-proof-',
    'backend-collaboration-intent-queue-route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Fallback collaboration intent queue must keep ${publicContract}`);
  }

  assert.ok(wrapperSource.includes('collaborationIntentQueue && !managerReadyPackage && ('), 'Fallback queue must retain its original condition');

  for (const appContract of [
    'collaborationIntentQueue: backendCollaborationIntentQueue',
    'onRunIntent: (row) => runCollaborationIntentQueueRow(row)',
    'intentRunDisabled: (row) => !backendCommandAvailable || backendStation.loading || !row.canRun || !row.runIntentApiPath',
    "onOpenOutputChatProof: (proofIds) => openProjectChatProof(activeProject, proofIds, 'main')",
    'outputChatProofDisabled: (proofIds) => !proofIds.length',
    'onOpenOutputTimelineProof: (proofIds) => openProjectTimelineProof(proofIds)',
    'outputTimelineProofDisabled: (proofIds) => !proofIds.length',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain fallback collaboration intent action ${appContract}`);
  }
});
