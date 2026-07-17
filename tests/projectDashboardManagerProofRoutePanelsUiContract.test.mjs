import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblyUrl = new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url);

test('Dashboard Manager Proof Map route panels share one lazy assembly while every operation stays in App', () => {
  assert.ok(existsSync(assemblyUrl), 'ProjectDashboardManagerProofRoutePanels must exist');
  const assemblySource = readFileSync(assemblyUrl, 'utf8');

  assert.ok(appSource.includes("const ProjectDashboardManagerProofRoutePanels = lazy(() => import('./project/ProjectDashboardManagerProofRoutePanels.jsx'))"));
  assert.ok(appSource.includes('<ProjectDashboardManagerProofRoutePanels'));

  const components = [
    'ProjectDashboardTranscriptProofCoverage',
    'ProjectDashboardTranscriptChannelRoutes',
    'ProjectDashboardTranscriptChannelPinRoutes',
    'ProjectDashboardTranscriptPinRoutes',
    'ProjectDashboardTranscriptReplyRoutes',
    'ProjectDashboardTranscriptMentionRoutes',
    'ProjectDashboardTranscriptAttachmentRoutes',
    'ProjectDashboardTranscriptMemberPresenceRoutes',
    'ProjectDashboardAgentMessageRoutes',
    'ProjectDashboardAgentContractRoutes',
    'ProjectDashboardCollaborationIntentQueue',
    'ProjectDashboardSubmissionReviewWorkflow',
  ];
  for (const component of components) {
    assert.ok(assemblySource.includes(`lazy(() => import('./${component}.jsx'))`), `${component} must stay lazy`);
    assert.ok(assemblySource.includes(`<${component}`), `${component} must remain rendered`);
    assert.ok(!appSource.includes(`lazy(() => import('./project/${component}.jsx'))`), `${component} must leave the application entry`);
    assert.equal(new RegExp(`<${component}(?:\\s|>)`).test(appSource), false, `${component} assembly must leave App`);
  }
  const renderIndexes = components.map(component => assemblySource.indexOf(`<${component}`));
  assert.ok(renderIndexes.every((index, position) => position === 0 || index > renderIndexes[position - 1]), 'Manager Proof Map route panels must retain their original display order');

  for (const condition of [
    'view.backendTranscriptProofCoverageSummary &&',
    'view.backendTranscriptChannelSummary &&',
    'view.backendTranscriptChannelPinSummary &&',
    'view.backendTranscriptPinSummary &&',
    'view.backendTranscriptReplySummary &&',
    'view.backendTranscriptMentionSummary &&',
    'view.backendTranscriptAttachmentSummary &&',
    'view.backendTranscriptMemberPresenceSummary &&',
    'view.backendAgentMessageSummary &&',
    'view.backendAgentContractSummary &&',
    'view.backendCollaborationIntentQueue &&',
    'view.backendSubmissionReviewWorkflow &&',
  ]) assert.ok(assemblySource.includes(condition), `Assembly must retain display condition: ${condition}`);

  for (const retainedOperation of [
    'managerProofMapRouteSyncButton',
    'openProjectChatProof',
    'openProjectTimelineProof',
    'setSelectedAgentFocusId',
    'syncBackendAgentDashboard',
  ]) assert.ok(appSource.includes(retainedOperation), `App must retain ${retainedOperation}`);

  for (const guardedView of [
    'agentContractRoutesView: backendAgentContractSummary ? {',
    'collaborationIntentQueueView: backendCollaborationIntentQueue ? {',
    'submissionReviewWorkflowView: backendSubmissionReviewWorkflow ? {',
  ]) assert.ok(appSource.includes(guardedView), `App must not construct optional proof-route view data before its backend model exists: ${guardedView}`);
});
