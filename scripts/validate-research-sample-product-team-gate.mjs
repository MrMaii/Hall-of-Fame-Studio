import { readFileSync } from 'node:fs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const coreSmokeSource = readFileSync(new URL('./validate-product-team-core-smoke.mjs', import.meta.url), 'utf8');

const requiredContractMarkers = [
  'research-style brief only as a sample customer goal',
  "productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1'",
  'researchOnly === false',
  "missionType === 'generic-product-team'",
  'role self-marketing / clarification',
  'leader-campaign',
  'self-nomination',
  'discovery-report',
  'brainstorm-board',
  'evidence-packet',
  '/evidence-source-review-workflow',
  'sourceReviewDecisionCount',
  'pendingDecisionSourceCount === 0',
  'product-brief',
  'agent-artifact-draft/v1',
  'local-artifact-draft-generator',
  'decision-proposal',
  'risk-review',
  'implementation-plan',
  'changes-requested',
  'revision-note',
  'final-deliverable',
  'accepted',
  '/brainstorm-layer',
  '/artifact-quality-audit',
  'draft-review-revision-final-loop',
  'generic-artifact-type-coverage',
  '/submission-review-workflow',
  '/product-team-delivery-trace',
  '/planner-executor-reviewer-state-machine',
  'readyForLocalProductTeamStateMachine',
  'managerCommandCenterRoutes',
  'managerScenarioTrailRoutes',
  'managerScenarioWalkthroughRoutes',
  'managerRequirementMatrixRoutes',
  'syncProtocolAuditRoutes',
  'managerUseCaseAuditRoutes',
  'managerActionQueueRoutes',
  'Manager Flow Graph must expose ${nodeId} as a C-side governance/action route node.',
  'manager-action-queue/:actionId/run',
  '/manager-flow-graph',
  '/readiness-proof-map',
  '/transcripts/main',
  '/timeline',
  '/events',
  '/evidence-index-readiness',
  '/project-evidence-archive',
  "archive.status === 'archive-ready'",
  'readyForManagerHandoff === true',
  'evidence-source-review-decisions',
  'artifact-storage-proofs',
  'workspaceFileProofCount',
  'project-memory-readiness/v1',
  'readyForProduction === false',
];

for (const marker of requiredContractMarkers) {
  assert(coreSmokeSource.includes(marker), `Research validation sample gate requires core smoke marker: ${marker}`);
}

assert(
  !/\b(paper|thesis|manuscript)\b|论文/i.test(coreSmokeSource),
  'Research validation sample gate must not depend on paper/thesis/manuscript-specific protocol fields.',
);

await import('./validate-product-team-core-smoke.mjs');

console.log('Research validation sample product-team gate passed.');
