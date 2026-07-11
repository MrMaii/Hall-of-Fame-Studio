import { createHash } from 'node:crypto';

import { SUPER_AGENT_WORK_MODES } from './workModes.js';

const SUITE_VERSION = '2026-07-10.v1';
const WORK_MODE_ORDER = ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'];
const OBSERVATION_FIELDS = new Set([
  'scenarioId',
  'workMode',
  'teamReady',
  'reviewerIndependent',
  'acceptedArtifactTypes',
  'passedAcceptanceCheckIds',
  'resolvedEscalationIds',
  'evidenceIds',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localQualityEvaluationChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeIdentifier(value, label, { fallback = '', maxLength = 160 } = {}) {
  const normalized = String(value || fallback).trim();
  if (!normalized) throw new Error(`quality-evaluation-${label}-required`);
  if (normalized.length > maxLength || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) {
    throw new Error(`quality-evaluation-${label}-invalid`);
  }
  return normalized;
}

function normalizeIdentifierList(values = [], label = 'identifier') {
  return uniqueStrings(values).map((value) => normalizeIdentifier(value, label));
}

function buildSuite() {
  const scenarios = WORK_MODE_ORDER.map((workMode) => {
    const definition = SUPER_AGENT_WORK_MODES[workMode];
    return {
      id: `${workMode}-contract-v1`,
      workMode,
      label: `${definition.label} contract regression`,
      requiredArtifacts: [...definition.requiredArtifacts],
      requiredAcceptanceCheckIds: definition.acceptanceChecks.map((check) => check.id),
      requiredEscalationIds: definition.escalationChecks.map((check) => check.id),
      criteria: [
        'team-ready',
        'reviewer-independent',
        'required-artifacts-accepted',
        'acceptance-checks-passed',
        'escalations-resolved',
        'evidence-linked',
      ],
    };
  });
  const base = {
    schemaVersion: 'local-quality-evaluation-suite/v1',
    version: SUITE_VERSION,
    evaluationType: 'deterministic-work-mode-contract',
    scenarioCount: scenarios.length,
    scenarios,
    limitations: [
      'does not judge semantic correctness or subjective quality',
      'does not call a model, Provider, cloud evaluator, or remote telemetry service',
      'requires separate calibrated human or model evaluation before public production release',
    ],
  };
  return { ...base, checksum: localQualityEvaluationChecksum(base) };
}

const QUALITY_EVALUATION_SUITE = buildSuite();

export function getLocalQualityEvaluationSuite() {
  return structuredClone(QUALITY_EVALUATION_SUITE);
}

function includesAll(actual = [], required = []) {
  const actualIds = new Set(normalizeIdentifierList(actual));
  return required.every((id) => actualIds.has(id));
}

function validateObservations(observations = []) {
  if (!Array.isArray(observations)) throw new Error('quality-evaluation-observations-required');
  observations.forEach((observation) => {
    Object.keys(observation || {}).forEach((field) => {
      if (!OBSERVATION_FIELDS.has(field)) throw new Error(`unexpected-quality-evaluation-field:${field}`);
    });
  });
  const scenarioIds = observations.map((row) => String(row?.scenarioId || '').trim());
  if (new Set(scenarioIds).size !== scenarioIds.length) throw new Error('duplicate-quality-evaluation-scenario');
  const expectedIds = new Set(QUALITY_EVALUATION_SUITE.scenarios.map((scenario) => scenario.id));
  const unknownId = scenarioIds.find((id) => !expectedIds.has(id));
  if (unknownId) throw new Error(`unknown-quality-evaluation-scenario:${unknownId || 'missing'}`);
  if (observations.length !== QUALITY_EVALUATION_SUITE.scenarios.length) {
    throw new Error('quality-evaluation-scenario-coverage-incomplete');
  }
}

function evaluateScenario(scenario, observation) {
  if (observation.workMode !== scenario.workMode) {
    throw new Error(`quality-evaluation-work-mode-mismatch:${scenario.id}`);
  }
  const acceptedArtifactTypes = normalizeIdentifierList(observation.acceptedArtifactTypes, 'artifact-id')
    .filter((id) => scenario.requiredArtifacts.includes(id));
  const passedAcceptanceCheckIds = normalizeIdentifierList(observation.passedAcceptanceCheckIds, 'acceptance-check-id')
    .filter((id) => scenario.requiredAcceptanceCheckIds.includes(id));
  const resolvedEscalationIds = normalizeIdentifierList(observation.resolvedEscalationIds, 'escalation-id')
    .filter((id) => scenario.requiredEscalationIds.includes(id));
  const evidenceIds = normalizeIdentifierList(observation.evidenceIds, 'evidence-id');
  const criteria = [
    { id: 'team-ready', passed: observation.teamReady === true },
    { id: 'reviewer-independent', passed: observation.reviewerIndependent === true },
    { id: 'required-artifacts-accepted', passed: includesAll(acceptedArtifactTypes, scenario.requiredArtifacts) },
    { id: 'acceptance-checks-passed', passed: includesAll(passedAcceptanceCheckIds, scenario.requiredAcceptanceCheckIds) },
    { id: 'escalations-resolved', passed: includesAll(resolvedEscalationIds, scenario.requiredEscalationIds) },
    { id: 'evidence-linked', passed: evidenceIds.length > 0 },
  ].map((criterion) => ({
    ...criterion,
    criterionId: `${scenario.workMode}:${criterion.id}`,
    status: criterion.passed ? 'passed' : 'failed',
  }));
  const passedCriterionCount = criteria.filter((criterion) => criterion.passed).length;
  return {
    scenarioId: scenario.id,
    workMode: scenario.workMode,
    status: passedCriterionCount === criteria.length ? 'passed' : 'failed',
    score: Math.round((passedCriterionCount / criteria.length) * 100),
    criteria,
    evidenceIds,
    acceptedArtifactTypes,
    passedAcceptanceCheckIds,
    resolvedEscalationIds,
  };
}

export function createLocalQualityEvaluationRun({
  projectId = '',
  input = {},
  baselineRun = null,
  now = new Date().toISOString(),
} = {}) {
  const normalizedProjectId = String(projectId || '').trim();
  const candidateVersion = normalizeIdentifier(input.candidateVersion, 'candidate-version', { maxLength: 120 });
  const idempotencyKey = normalizeIdentifier(input.idempotencyKey, 'idempotency-key', { maxLength: 160 });
  if (!normalizedProjectId) throw new Error('quality-evaluation-project-required');
  validateObservations(input.observations);
  const observationsById = new Map(input.observations.map((row) => [row.scenarioId, row]));
  const scenarioResults = QUALITY_EVALUATION_SUITE.scenarios.map((scenario) => (
    evaluateScenario(scenario, observationsById.get(scenario.id))
  ));
  const criteria = scenarioResults.flatMap((scenario) => scenario.criteria);
  const passedCriterionCount = criteria.filter((criterion) => criterion.passed).length;
  const score = Math.round((passedCriterionCount / criteria.length) * 100);
  const baselineCriteria = new Map((baselineRun?.scenarioResults || [])
    .flatMap((scenario) => scenario.criteria || [])
    .map((criterion) => [criterion.criterionId, criterion]));
  const regressionCriterionIds = criteria
    .filter((criterion) => baselineCriteria.get(criterion.criterionId)?.passed === true && !criterion.passed)
    .map((criterion) => criterion.criterionId)
    .sort();
  const releaseBlocked = regressionCriterionIds.length > 0 || scenarioResults.some((scenario) => scenario.status !== 'passed');
  const componentVersions = {
    model: normalizeIdentifier(input.componentVersions?.model, 'model-version', { fallback: 'unversioned', maxLength: 120 }),
    prompt: normalizeIdentifier(input.componentVersions?.prompt, 'prompt-version', { fallback: 'unversioned', maxLength: 120 }),
    policy: normalizeIdentifier(input.componentVersions?.policy, 'policy-version', { fallback: 'unversioned', maxLength: 120 }),
  };
  const intent = {
    projectId: normalizedProjectId,
    suiteVersion: QUALITY_EVALUATION_SUITE.version,
    suiteChecksum: QUALITY_EVALUATION_SUITE.checksum,
    candidateVersion,
    componentVersions,
    idempotencyKey,
    observations: input.observations.map((observation) => canonicalize(observation)),
  };
  const intentChecksum = localQualityEvaluationChecksum(intent);
  const id = `quality_eval_${localQualityEvaluationChecksum(`${normalizedProjectId}:${idempotencyKey}`).slice(0, 24)}`;
  const base = {
    schemaVersion: 'local-quality-evaluation-run/v1',
    id,
    projectId: normalizedProjectId,
    suiteVersion: QUALITY_EVALUATION_SUITE.version,
    suiteChecksum: QUALITY_EVALUATION_SUITE.checksum,
    candidateVersion,
    componentVersions,
    idempotencyKey,
    intentChecksum,
    createdAt: now,
    status: regressionCriterionIds.length
      ? 'regression-detected'
      : releaseBlocked
        ? 'failed'
        : 'passed',
    score,
    releaseBlocked,
    scenarioResults,
    regressionCriterionIds,
    baselineComparison: {
      baselineRunId: baselineRun?.id || null,
      baselineRunChecksum: baselineRun?.checksum || null,
      baselineScore: baselineRun?.score ?? null,
      scoreDelta: baselineRun ? score - baselineRun.score : null,
      regressionCount: regressionCriterionIds.length,
    },
    summary: {
      scenarioCount: scenarioResults.length,
      passedScenarioCount: scenarioResults.filter((scenario) => scenario.status === 'passed').length,
      failedScenarioCount: scenarioResults.filter((scenario) => scenario.status !== 'passed').length,
      criterionCount: criteria.length,
      passedCriterionCount,
      failedCriterionCount: criteria.length - passedCriterionCount,
      regressionCount: regressionCriterionIds.length,
    },
    storesRawContent: false,
    readyForLocalRelease: !releaseBlocked,
    readyForProduction: false,
  };
  return { ...base, checksum: localQualityEvaluationChecksum(base) };
}

export function verifyLocalQualityEvaluationRun(run = {}) {
  const { checksum, ...base } = run;
  const suiteValid = run.suiteVersion === QUALITY_EVALUATION_SUITE.version
    && run.suiteChecksum === QUALITY_EVALUATION_SUITE.checksum;
  const checksumValid = Boolean(checksum) && checksum === localQualityEvaluationChecksum(base);
  return { valid: suiteValid && checksumValid, suiteValid, checksumValid };
}

export function publicLocalQualityEvaluationRun(run = {}) {
  const integrity = verifyLocalQualityEvaluationRun(run);
  return {
    ...run,
    status: integrity.valid ? run.status : 'integrity-invalid',
    releaseBlocked: integrity.valid ? Boolean(run.releaseBlocked) : true,
    readyForLocalRelease: integrity.valid ? Boolean(run.readyForLocalRelease) : false,
    integrity,
  };
}
