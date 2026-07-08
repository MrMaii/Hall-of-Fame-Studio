import {
  buildPrivateMvpLaunchPackage,
  formatPrivateMvpLaunchPackageMarkdown,
} from './report-private-mvp-launch-package.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const report = await buildPrivateMvpLaunchPackage();
const serialized = JSON.stringify(report);
const markdown = formatPrivateMvpLaunchPackageMarkdown(report);
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

assert(report.schemaVersion === 'private-mvp-launch-package/v1', 'Private MVP package must expose its schema.');
assert(report.status === 'private-mvp-ready-public-production-blocked', 'Private MVP package must be ready only while public production stays blocked.');
assert(report.decision.localBackendMvp === 'ready', 'Private MVP package must mark local backend MVP ready.');
assert(report.decision.controlledPrivatePilot === 'ready-for-rehearsal', 'Private MVP package must mark controlled private-pilot rehearsal ready.');
assert(report.decision.publicProduction === 'no-go', 'Private MVP package must keep public production no-go.');
assert(report.localMvpEvidence.sourceReportSchema === 'real-user-zero-to-autonomy-operator-report/v1', 'Private MVP package must consume the zero-to-autonomy operator report.');
assert(report.localMvpEvidence.readyForLocalMvpTrial === true, 'Private MVP package must prove local MVP trial readiness.');
assert(report.localMvpEvidence.readyForPrivatePilotDelivery === true, 'Private MVP package must prove private-pilot delivery readiness.');
assert(report.localMvpEvidence.missionType === 'generic-product-team', 'Private MVP package must preserve generic product-team positioning.');
assert(report.localMvpEvidence.summary.readyStageCount === report.localMvpEvidence.summary.stageCount, 'Private MVP package must prove every local MVP stage is ready.');
assert(report.localMvpEvidence.summary.submittedArtifactTypeCount === requiredArtifactTypes.length, 'Private MVP package must prove all generic artifact types are present.');
assert(report.localMvpEvidence.summary.providerUsageCount >= 2, 'Private MVP package must include provider usage proof.');
assert(report.localMvpEvidence.summary.providerReceiptCount >= 1, 'Private MVP package must include provider receipt proof.');
assert(requiredStages.every((id) => report.localMvpEvidence.stageRows.some((row) => row.id === id && row.ready === true)), 'Private MVP package must include every required ready stage.');
assert(requiredArtifactTypes.every((artifactType) => report.localMvpEvidence.artifactTypes.some((row) => row.artifactType === artifactType && row.present === true)), 'Private MVP package must include every required generic artifact type.');
assert(report.publicProductionNoGo.sourceReportSchema === 'public-production-readiness-operator-report/v1', 'Private MVP package must consume the public production operator report.');
assert(report.publicProductionNoGo.readyForPublicProduction === false, 'Private MVP package must not claim public production readiness.');
assert(report.publicProductionNoGo.status === 'public-production-blocked', 'Private MVP package must embed public-production blocked status.');
assert(report.publicProductionNoGo.blockedActionCount >= report.publicProductionNoGo.summary.blockedSetupRowCount, 'Private MVP package must expose actionable production blocker rows.');
assert(report.publicProductionNoGo.validationCommands.includes('npm run launch:public-production:no-go'), 'Private MVP package must include the public no-go validation command.');
assert(report.validationCommands.includes('npm run agents:private-mvp-launch-package:validate'), 'Private MVP package must self-reference its validation command.');
assert(report.validationCommands.includes('npm run ui:real-user-zero-to-autonomy'), 'Private MVP package must name the built UI real-user gate.');
assert(report.forbiddenClaims.some((claim) => /public production readiness/i.test(claim)), 'Private MVP package must forbid public-production claims.');
assert(markdown.includes('# Private MVP Launch Package'), 'Markdown package must render a readable title.');
assert(markdown.includes('Public production: no-go'), 'Markdown package must keep public production no-go visible.');
assert(markdown.includes('## Forbidden Claims'), 'Markdown package must expose forbidden claims.');
assert(markdown.includes('npm run launch:public-production:no-go'), 'Markdown package must list no-go validation.');
assert(!serialized.includes('SHOULD_NOT_LEAK'), 'Private MVP package must not expose validation plaintext secrets.');
assert(!serialized.includes('"ciphertext":'), 'Private MVP package must not expose vault ciphertext fields.');
assert(!markdown.includes('SHOULD_NOT_LEAK'), 'Markdown package must not expose validation plaintext secrets.');

console.log('Private MVP launch package validation passed.');
