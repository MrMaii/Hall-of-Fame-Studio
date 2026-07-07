import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs', '--report'], {
  cwd: repoRoot,
  encoding: 'utf8',
  timeout: 180000,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const report = JSON.parse(result.stdout);
const serialized = JSON.stringify(report);
const requiredStages = [
  'settings-byok-seal',
  'startup-readiness',
  'kickoff-self-marketing',
  'workspace-binding',
  'ca-handoff-autonomous-agent-output',
  'provider-evidence-source-review',
  'brainstorm-draft-review-revision-final',
  'generic-artifact-coverage',
  'manager-proof-surfaces',
  'project-evidence-archive',
];
const requiredArtifactTypes = [
  'discovery-report',
  'brainstorm-board',
  'evidence-packet',
  'product-brief',
  'decision-proposal',
  'risk-review',
  'revision-note',
  'implementation-plan',
  'final-deliverable',
];

assert(report.schemaVersion === 'real-user-zero-to-autonomy-operator-report/v1', 'Report must expose the zero-to-autonomy operator schema.');
assert(report.status === 'local-mvp-zero-to-autonomy-ready', 'Report must show the local MVP zero-to-autonomy chain ready after the real backend run.');
assert(report.readyForLocalMvpTrial === true, 'Report must mark the local MVP trial path ready.');
assert(report.readyForPrivatePilotDelivery === true, 'Report must mark the generic delivery trace ready for private-pilot handoff.');
assert(report.readyForPublicProduction === false, 'Report must not claim public production readiness.');
assert(report.missionType === 'generic-product-team', 'Report must preserve generic product-team positioning.');
assert(report.summary?.stageCount === requiredStages.length, 'Report must expose every required stage row.');
assert(report.summary?.readyStageCount === requiredStages.length, 'Every required stage row must be ready.');
assert(report.summary?.requiredArtifactTypeCount === requiredArtifactTypes.length, 'Report must count every required generic artifact type.');
assert(report.summary?.submittedArtifactTypeCount === requiredArtifactTypes.length, 'Report must prove required generic artifact coverage.');
assert(report.summary?.providerSourceCount >= 2, 'Report must include provider-backed evidence source count.');
assert(report.summary?.sourceReviewDecisionCount >= report.summary.providerSourceCount, 'Report must show every provider source received Reviewer judgement.');
assert(report.summary?.archiveRawLeakCount === 0, 'Report must keep archive raw leak count at zero.');
assert(requiredStages.every((id) => report.stageRows?.some((row) => row.id === id && row.ready === true)), 'Report must include all required ready stage rows.');
assert(requiredArtifactTypes.every((artifactType) => report.artifactTypes?.some((row) => row.artifactType === artifactType && row.present === true)), 'Report must include every required generic artifact type.');
assert(report.backendRoutes?.productTeamMissions === '/product-team-missions', 'Report must link Mission Runner.');
assert(report.backendRoutes?.managerFlowGraph?.endsWith('/manager-flow-graph'), 'Report must link Manager Flow Graph.');
assert(report.backendRoutes?.readinessProofMap?.endsWith('/readiness-proof-map'), 'Report must link Readiness Proof Map.');
assert(report.backendRoutes?.projectEvidenceArchive?.endsWith('/project-evidence-archive'), 'Report must link Project Evidence Archive.');
assert(report.productionBlockers?.length >= 5, 'Report must list concrete public-production blockers.');
assert(report.redaction?.plaintextProviderSecretsExposed === false, 'Report must declare plaintext provider secrets unexposed.');
assert(report.redaction?.ciphertextExposed === false, 'Report must declare ciphertext unexposed.');
assert(!serialized.includes('SHOULD_NOT_LEAK'), 'Report must not expose validation plaintext secrets.');
assert(!serialized.includes('"ciphertext":'), 'Report must not expose vault ciphertext fields.');

const markdownResult = spawnSync(process.execPath, ['scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs', '--report', '--format=markdown'], {
  cwd: repoRoot,
  encoding: 'utf8',
  timeout: 180000,
});
if (markdownResult.status !== 0) {
  process.stderr.write(markdownResult.stderr || markdownResult.stdout);
  process.exit(markdownResult.status || 1);
}
assert(markdownResult.stdout.includes('# Real User Zero-To-Autonomy Report'), 'Markdown report must render a readable title.');
assert(markdownResult.stdout.includes('Ready for public production: no'), 'Markdown report must keep public production blocked.');
assert(!markdownResult.stdout.includes('SHOULD_NOT_LEAK'), 'Markdown report must not expose validation plaintext secrets.');

console.log('Real-user zero-to-autonomy operator report validation passed.');
