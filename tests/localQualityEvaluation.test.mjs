import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  createKickoffProjectFromMeeting,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';
import {
  createLocalQualityEvaluationRun,
  getLocalQualityEvaluationSuite,
  verifyLocalQualityEvaluationRun,
} from '../src/agents/localQualityEvaluation.js';

function completeObservations(suite) {
  return suite.scenarios.map((scenario) => ({
    scenarioId: scenario.id,
    workMode: scenario.workMode,
    teamReady: true,
    reviewerIndependent: true,
    acceptedArtifactTypes: [...scenario.requiredArtifacts],
    passedAcceptanceCheckIds: [...scenario.requiredAcceptanceCheckIds],
    resolvedEscalationIds: [...scenario.requiredEscalationIds],
    evidenceIds: [`evidence_${scenario.workMode}`],
  }));
}

test('evaluates a versioned five-mode suite and blocks criterion-level baseline regressions', () => {
  const suite = getLocalQualityEvaluationSuite();
  assert.equal(suite.schemaVersion, 'local-quality-evaluation-suite/v1');
  assert.equal(suite.version, '2026-07-10.v1');
  assert.deepEqual(
    suite.scenarios.map((scenario) => scenario.workMode),
    ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'],
  );
  assert.ok(suite.checksum);

  const observations = completeObservations(suite);
  const baseline = createLocalQualityEvaluationRun({
    projectId: 'quality_eval_project',
    input: {
      candidateVersion: 'candidate-v1',
      componentVersions: { model: 'local-model-v1', prompt: 'prompt-v1', policy: 'policy-v1' },
      idempotencyKey: 'quality-baseline-001',
      observations,
    },
    now: '2026-07-10T20:00:00.000Z',
  });
  assert.equal(baseline.schemaVersion, 'local-quality-evaluation-run/v1');
  assert.equal(baseline.status, 'passed');
  assert.equal(baseline.score, 100);
  assert.equal(baseline.releaseBlocked, false);
  assert.equal(baseline.scenarioResults.length, 5);
  assert.equal(verifyLocalQualityEvaluationRun(baseline).valid, true);

  const candidateObservations = completeObservations(suite);
  const technical = candidateObservations.find((row) => row.workMode === 'technical-delivery');
  technical.acceptedArtifactTypes = technical.acceptedArtifactTypes.filter((id) => id !== 'rollback-plan');
  const candidate = createLocalQualityEvaluationRun({
    projectId: 'quality_eval_project',
    baselineRun: baseline,
    input: {
      candidateVersion: 'candidate-v2',
      componentVersions: { model: 'local-model-v2', prompt: 'prompt-v2', policy: 'policy-v1' },
      idempotencyKey: 'quality-candidate-002',
      observations: candidateObservations,
    },
    now: '2026-07-10T20:05:00.000Z',
  });
  assert.equal(candidate.status, 'regression-detected');
  assert.equal(candidate.releaseBlocked, true);
  assert.ok(candidate.score < baseline.score);
  assert.deepEqual(candidate.regressionCriterionIds, ['technical-delivery:required-artifacts-accepted']);
  assert.equal(candidate.baselineComparison.baselineRunId, baseline.id);
  assert.equal(verifyLocalQualityEvaluationRun(candidate).valid, true);
  assert.equal(JSON.stringify(candidate).includes('local-model-v2'), true);
  assert.equal(JSON.stringify(candidate).includes('student answer body'), false);

  assert.throws(() => createLocalQualityEvaluationRun({
    projectId: 'quality_eval_project',
    input: {
      candidateVersion: 'duplicate-scenario',
      idempotencyKey: 'quality-invalid-duplicate',
      observations: [...observations, observations[0]],
    },
  }), /duplicate-quality-evaluation-scenario/);
  assert.throws(() => createLocalQualityEvaluationRun({
    projectId: 'quality_eval_project',
    input: {
      candidateVersion: 'raw-output-attempt',
      idempotencyKey: 'quality-invalid-output',
      observations: observations.map((row, index) => (index ? row : { ...row, output: 'student answer body' })),
    },
  }), /unexpected-quality-evaluation-field:output/);
});

function createRuntime(directory, { seed = false } = {}) {
  const kickoff = seed ? createKickoffProjectFromMeeting({
    projectId: 'quality_eval_api_project',
    name: 'Quality evaluation API project',
    brief: 'Detect five-mode quality regressions before local release.',
    now: '2026-07-10T20:30:00.000Z',
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer' },
    ],
  }) : null;
  const store = createAgentProjectFileStore({
    filePath: join(directory, 'projects.json'),
    ...(kickoff ? { projects: [kickoff.project], messages: kickoff.messages, replaceWithSeed: true } : {}),
    hydrateProject: hydrateAgentProject,
  });
  const service = createAgentProjectService({ store });
  return { store, service, api: createAgentProjectApi({ service }) };
}

test('persists an approved baseline, blocks a regression, and degrades tampered runs after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-quality-evaluation-'));
  try {
    let runtime = createRuntime(directory, { seed: true });
    let response = await runtime.api.handleAsync({
      method: 'GET',
      path: '/projects/quality_eval_api_project/quality-evaluation-suite',
    });
    assert.equal(response.status, 200);
    const suite = response.body.qualityEvaluationSuite;
    const observations = completeObservations(suite);
    const baselineBody = {
      candidateVersion: 'candidate-v1',
      componentVersions: { model: 'local-v1', prompt: 'prompt-v1', policy: 'policy-v1' },
      idempotencyKey: 'api-quality-baseline-001',
      observations,
      now: '2026-07-10T20:31:00.000Z',
    };
    response = await runtime.api.handleAsync({
      method: 'POST',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
      headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'eval-worker' },
      body: baselineBody,
    });
    assert.equal(response.status, 201);
    const baselineRun = response.body.qualityEvaluationRun;
    assert.equal(baselineRun.status, 'passed');

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
      headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'eval-worker' },
      body: baselineBody,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    assert.equal(response.body.qualityEvaluationRun.id, baselineRun.id);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/quality_eval_api_project/quality-evaluation-runs/${baselineRun.id}/baseline`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'quality-owner' },
      body: { now: '2026-07-10T20:32:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.qualityEvaluationGovernance.baseline.runId, baselineRun.id);

    response = await runtime.api.handleAsync({
      method: 'POST',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
      headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'eval-worker' },
      body: baselineBody,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.idempotent, true);
    assert.equal(response.body.qualityEvaluationRun.id, baselineRun.id);

    const candidateObservations = completeObservations(suite);
    candidateObservations.find((row) => row.workMode === 'technical-delivery').passedAcceptanceCheckIds = ['requirements-traceable'];
    response = await runtime.api.handleAsync({
      method: 'POST',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
      headers: { 'x-hofs-role': 'runtime-platform', 'x-hofs-user-id': 'eval-worker' },
      body: {
        candidateVersion: 'candidate-v2',
        componentVersions: { model: 'local-v2', prompt: 'prompt-v2', policy: 'policy-v1' },
        idempotencyKey: 'api-quality-candidate-002',
        observations: candidateObservations,
        now: '2026-07-10T20:33:00.000Z',
      },
    });
    assert.equal(response.status, 201);
    const regressingRun = response.body.qualityEvaluationRun;
    assert.equal(regressingRun.releaseBlocked, true);
    assert.deepEqual(regressingRun.regressionCriterionIds, ['technical-delivery:acceptance-checks-passed']);

    const rejectedBaseline = await runtime.api.handleAsync({
      method: 'POST',
      path: `/projects/quality_eval_api_project/quality-evaluation-runs/${regressingRun.id}/baseline`,
      headers: { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'quality-owner' },
      body: { now: '2026-07-10T20:34:00.000Z' },
    });
    assert.equal(rejectedBaseline.status, 400);
    assert.match(rejectedBaseline.body.message || rejectedBaseline.body.error || '', /passing-quality-evaluation-required/);

    runtime = createRuntime(directory);
    response = await runtime.api.handleAsync({
      method: 'GET',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.qualityEvaluationGovernance.baseline.runId, baselineRun.id);
    assert.equal(response.body.qualityEvaluationGovernance.summary.runCount, 2);
    assert.equal(response.body.qualityEvaluationGovernance.integrity.valid, true);

    const tamperedProject = runtime.store.getProject('quality_eval_api_project');
    tamperedProject.qualityEvaluationRuns[0].scenarioResults[0].criteria[0].passed = false;
    runtime.store.saveProject(tamperedProject);
    response = await runtime.api.handleAsync({
      method: 'GET',
      path: '/projects/quality_eval_api_project/quality-evaluation-runs',
    });
    assert.equal(response.body.qualityEvaluationGovernance.integrity.valid, false);
    assert.equal(response.body.qualityEvaluationGovernance.rows[0].status, 'integrity-invalid');
    assert.equal(response.body.qualityEvaluationGovernance.rows[0].releaseBlocked, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
