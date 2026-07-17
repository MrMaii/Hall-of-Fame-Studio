import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerCompatibilityProofPanels.jsx', import.meta.url);

test('Manager compatibility and transcript proof panels stay lazy while App retains every operation rule', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager compatibility proof wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerCompatibilityProofPanels = lazy(() => import('./ProjectDashboardManagerCompatibilityProofPanels.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerCompatibilityProofPanels'));

  for (const contract of [
    'onRunIntent: (row) => runCollaborationIntentQueueRow(row)',
    'intentRunDisabled: (row) => !backendCommandAvailable || backendStation.loading || !row.canRun || !row.runIntentApiPath',
    "onOpenOutputChatProof: (proofIds) => openProjectChatProof(activeProject, proofIds, 'main')",
    'outputChatProofDisabled: (proofIds) => !proofIds.length',
    'onOpenOutputTimelineProof: (proofIds) => openProjectTimelineProof(proofIds)',
    'outputTimelineProofDisabled: (proofIds) => !proofIds.length',
    "onOpenTranscriptProof: () => openProjectChatProof(activeProject, backendTranscriptProofCoverageIds, backendTranscriptProofCoverageRoute?.channelId || 'main')",
    'transcriptProofOpenDisabled: !backendTranscriptProofCoverageIds.length',
  ]) {
    assert.ok(appSource.includes(contract), `App must retain ${contract}`);
  }

  const components = [
    'ProjectDashboardCollaborationIntentFallback',
    'ProjectDashboardTranscriptProofCoverageFallback',
  ];
  for (const component of components) {
    assert.ok(wrapperSource.includes(`const ${component} = lazy(() => import('./${component}.jsx'));`), `${component} must remain lazy`);
    assert.ok(wrapperSource.includes(`<${component}`), `${component} must remain mounted`);
  }
  const mountOrder = components.map(component => wrapperSource.indexOf(`<${component}`));
  assert.deepEqual(mountOrder, [...mountOrder].sort((left, right) => left - right), 'Compatibility and transcript proof panels must retain their original order');

  for (const contract of [
    'collaborationIntentQueue && !managerReadyPackage && (',
    'backendCollaborationIntentQueue: collaborationIntentQueue,',
    'backendCollaborationIntentRunOutput: collaborationIntentRunOutput,',
    'onRunIntent={onRunIntent}',
    'intentRunDisabled={intentRunDisabled}',
    'onOpenOutputChatProof={onOpenOutputChatProof}',
    'outputChatProofDisabled={outputChatProofDisabled}',
    'onOpenOutputTimelineProof={onOpenOutputTimelineProof}',
    'outputTimelineProofDisabled={outputTimelineProofDisabled}',
    'transcriptProofCoverageSummary && (',
    'summary={transcriptProofCoverageSummary}',
    'transcriptRoute={transcriptProofRoute}',
    'onOpen={onOpenTranscriptProof}',
    'openDisabled={transcriptProofOpenDisabled}',
  ]) {
    assert.ok(wrapperSource.includes(contract), `Manager compatibility proof wrapper must retain ${contract}`);
  }
});
