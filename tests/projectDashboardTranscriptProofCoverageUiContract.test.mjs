import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerProofRoutePanels.jsx', import.meta.url), 'utf8');
const coverageUrl = new URL('../src/project/ProjectDashboardTranscriptProofCoverage.jsx', import.meta.url);

test('Dashboard transcript proof coverage stays lazy and keeps sync and chat-proof actions', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardTranscriptProofCoverage = lazy(() => import('./ProjectDashboardTranscriptProofCoverage.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardTranscriptProofCoverage'));
  assert.ok(existsSync(coverageUrl), 'Dashboard transcript proof coverage component must exist');

  const componentSource = readFileSync(coverageUrl, 'utf8');
  for (const publicContract of [
    'proof-map-transcript-proof-coverage',
    'Backend transcript proof coverage',
    'Transcript coverage proof',
    'summary.archivedProofIdCount',
    'summary.expectedProofIdCount',
    'summary.missingProofIdCount',
    'disabled={!proofIds.length}',
    'onClick={onOpen}',
    '{syncButton}',
    '{sourceBadge}',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard transcript proof coverage must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('summary: backendTranscriptProofCoverageSummary'));
  assert.ok(appSource.includes('ready: backendTranscriptProofCoverageReady'));
  assert.ok(appSource.includes('proofIds: backendTranscriptProofCoverageIds'));
  assert.ok(appSource.includes("managerProofMapRouteSyncButton(backendTranscriptProofCoverageRoute, 'proof-map-transcript-proof-coverage-sync-proof-map')"));
  assert.ok(appSource.includes("openProjectChatProof(activeProject, backendTranscriptProofCoverageIds, backendTranscriptProofCoverageRoute?.channelId || 'main')"));
});
