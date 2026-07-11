import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function completeObservations(suite) {
  return suite.scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    workMode: scenario.workMode,
    teamReady: true,
    reviewerIndependent: true,
    acceptedArtifactTypes: scenario.requiredArtifacts,
    passedAcceptanceCheckIds: scenario.requiredAcceptanceCheckIds,
    resolvedEscalationIds: scenario.requiredEscalationIds,
    evidenceIds: [`gate_${scenario.workMode}`],
  }));
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-quality-evaluation-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
const projectId = 'local_quality_evaluation_validation';

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  let api = createFileBackedAgentProjectApi({ filePath, replaceWithSeed: true });
  let response = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Local Quality Evaluation Validation',
      brief: 'Detect model, prompt, and policy regressions across every local work mode.',
      team: [
        { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader' },
        { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
      ],
      selectedLeaderId: 'leader',
      reviewerId: 'reviewer',
      now: '2026-07-10T21:00:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiation returned ${response.status}.`);

  response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/quality-evaluation-suite` });
  const suite = response.body.qualityEvaluationSuite;
  assert(response.status === 200 && suite.schemaVersion === 'local-quality-evaluation-suite/v1', 'Versioned suite route must be available.');
  assert(suite.scenarioCount === 5, 'Suite must cover exactly five work modes.');
  assert(
    suite.scenarios.map((scenario) => scenario.workMode).join(',')
      === 'learning,academic-writing,investigation,technical-delivery,creative-studio',
    'Suite work-mode coverage must remain stable.',
  );

  const baselineBody = {
    candidateVersion: 'quality-candidate-v1',
    componentVersions: { model: 'local-model-v1', prompt: 'prompt-v1', policy: 'policy-v1' },
    idempotencyKey: 'quality-gate-baseline-001',
    observations: completeObservations(suite),
    now: '2026-07-10T21:01:00.000Z',
  };
  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/quality-evaluation-runs`,
    headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'quality-worker' },
    body: baselineBody,
  });
  assert(response.status === 201 && response.body.qualityEvaluationRun.score === 100, 'Perfect candidate must create one passing run.');
  const baselineRun = response.body.qualityEvaluationRun;
  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/quality-evaluation-runs/${baselineRun.id}/baseline`,
    headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'quality-owner' },
    body: { now: '2026-07-10T21:02:00.000Z' },
  });
  assert(response.status === 200 && response.body.qualityEvaluationGovernance.baseline.runId === baselineRun.id, 'Passing run must become the local baseline.');

  const candidateObservations = completeObservations(suite);
  candidateObservations.find((row) => row.workMode === 'technical-delivery').acceptedArtifactTypes = ['implementation-plan', 'test-evidence'];
  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/quality-evaluation-runs`,
    headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'quality-worker' },
    body: {
      candidateVersion: 'quality-candidate-v2',
      componentVersions: { model: 'local-model-v2', prompt: 'prompt-v2', policy: 'policy-v1' },
      idempotencyKey: 'quality-gate-candidate-002',
      observations: candidateObservations,
      now: '2026-07-10T21:03:00.000Z',
    },
  });
  const candidate = response.body.qualityEvaluationRun;
  assert(response.status === 201 && candidate.status === 'regression-detected', 'Candidate regression must be detected.');
  assert(candidate.releaseBlocked === true && candidate.readyForProduction === false, 'Regression must block local release without production overclaim.');
  assert(
    candidate.regressionCriterionIds.join(',') === 'technical-delivery:required-artifacts-accepted',
    'Gate must locate the exact technical-delivery regression.',
  );
  assert(candidate.storesRawContent === false, 'Quality receipt must declare a content-free storage boundary.');

  api = createFileBackedAgentProjectApi({ filePath });
  response = await api.handleAsync({ method: 'GET', path: `/projects/${projectId}/quality-evaluation-runs` });
  const governance = response.body.qualityEvaluationGovernance;
  assert(response.status === 200 && governance.integrity.valid, 'Quality run checksums must survive restart.');
  assert(governance.baseline.runId === baselineRun.id && governance.summary.runCount === 2, 'Baseline and both runs must survive restart.');
  assert(governance.readyForProduction === false, 'Local deterministic evaluation must not claim public production readiness.');

  console.log('Local versioned quality evaluation validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
