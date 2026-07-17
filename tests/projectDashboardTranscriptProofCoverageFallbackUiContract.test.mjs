import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendSnapshotPanels.jsx', import.meta.url), 'utf8');
const proofRouteAssemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerCompatibilityProofPanels.jsx', import.meta.url);
const fallbackUrl = new URL('../src/project/ProjectDashboardTranscriptProofCoverageFallback.jsx', import.meta.url);

test('Manager Dashboard transcript proof fallback stays lazy while App keeps its Group Chat proof action', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager compatibility proof wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardTranscriptProofCoverageFallback = lazy(() => import('./ProjectDashboardTranscriptProofCoverageFallback.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardTranscriptProofCoverageFallback'));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerCompatibilityProofPanels'));
  assert.ok(existsSync(fallbackUrl), 'Manager Dashboard transcript proof fallback component must exist');

  const componentSource = readFileSync(fallbackUrl, 'utf8');
  for (const publicContract of [
    'backend-transcript-proof-coverage-snapshot',
    'backend-transcript-proof-coverage-open',
    'Transcript Proof Coverage',
    'Backend transcript proof is complete',
    'Backend transcript proof has gaps',
    'No work-node transcript proof yet',
    'Backend Transcript Ready',
    'Needs Backend Transcript',
    "['Expected', summary.expectedProofIdCount ?? 0]",
    "['Archived', summary.archivedProofIdCount ?? 0]",
    "['Missing', summary.missingProofIdCount ?? 0]",
    "['Submissions', summary.submissionProofIdCount ?? 0]",
    "['Evidence', summary.evidenceSearchProofIdCount ?? 0]",
    "['Source Reviews', summary.evidenceSourceReviewProofIdCount ?? 0]",
    "['Submission Reviews', summary.submissionReviewProofIdCount ?? 0]",
    "['Route', summary.routeReady ? 'ready' : 'missing']",
    'Open transcript coverage proof',
    'Transcript route:',
    'Missing proof ids:',
    'disabled={openDisabled}',
    'onClick={onOpen}',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Manager Dashboard transcript proof fallback must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('transcriptProofCoverageSummary: backendTranscriptProofCoverageSummary'));
  assert.ok(appSource.includes('transcriptProofOpenDisabled: !backendTranscriptProofCoverageIds.length'));
  assert.ok(appSource.includes("onOpenTranscriptProof: () => openProjectChatProof(activeProject, backendTranscriptProofCoverageIds, backendTranscriptProofCoverageRoute?.channelId || 'main')"));
  assert.ok(appSource.includes("transcriptProofRoute: backendTranscriptProofCoverageRoute?.apiPath || `/projects/${activeProject.id}/transcripts`"));

  assert.ok(proofRouteAssemblySource.includes("const ProjectDashboardTranscriptProofCoverage = lazy(() => import('./ProjectDashboardTranscriptProofCoverage.jsx'))"));
  assert.ok(proofRouteAssemblySource.includes('<ProjectDashboardTranscriptProofCoverage'));
});
