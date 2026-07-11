import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
function scriptNodeTargets(command = '') {
  const normalized = command.replace(/\\/g, '/');
  const targets = [];
  const pattern = /(?:^|&&|\s)node\s+(scripts\/[^\s&]+)/g;
  let match = pattern.exec(normalized);
  while (match) {
    targets.push(match[1]);
    match = pattern.exec(normalized);
  }
  return targets;
}

function commandsForGateSection(source, sectionTitle) {
  const header = `## ${sectionTitle}`;
  const start = source.indexOf(header);
  assert(start >= 0, `Launch gates document must include ${header}.`);
  const next = source.indexOf('\n## ', start + header.length);
  const section = source.slice(start, next === -1 ? source.length : next);
  const requiredStart = section.indexOf('Required commands:') >= 0
    ? section.indexOf('Required commands:')
    : section.indexOf('Required production-oriented commands');
  assert(requiredStart >= 0, `${sectionTitle} must include a required command block.`);
  const fenceStart = section.indexOf('```bash', requiredStart);
  assert(fenceStart >= 0, `${sectionTitle} Required commands must use a bash fence.`);
  const fenceEnd = section.indexOf('```', fenceStart + '```bash'.length);
  assert(fenceEnd >= 0, `${sectionTitle} Required commands fence must be closed.`);
  const commands = section
    .slice(fenceStart, fenceEnd)
    .matchAll(/npm run ([^\s#`]+)/g);
  return [...new Set([...commands].map((match) => match[1]))];
}

const gateDocPath = 'docs/LAUNCH_READINESS_GATES.md';
assert(existsSync(resolve(repoRoot, gateDocPath)), 'Launch readiness gate document must exist.');

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const gateDoc = read(gateDocPath);
const infraGateSource = read('scripts/validate-production-infrastructure-gates.mjs');
const publicProductionNoGoSource = read('scripts/validate-public-production-no-go.mjs');

const requiredScripts = [
  'build',
  'skills:check',
  'skills:blend',
  'agents:scenario',
  'agents:scenario:contract',
  'agents:server',
  'agents:server:validate',
  'agents:local-mvp-startup-readiness',
  'agents:public-production-startup-readiness',
  'agents:production-access-control',
  'agents:production-managed-identity',
  'agents:production-managed-secrets',
  'agents:production-managed-persistence',
  'agents:production-managed-worker-queue',
  'agents:production-provider-controls',
  'agents:production-data-governance',
  'agents:production-traffic-controls',
  'agents:production-customer-acceptance',
  'agents:production-operations-startup',
  'agents:public-production-readiness-report',
  'agents:public-production-readiness-report:validate',
  'agents:managed-environment-preflight',
  'agents:managed-environment-preflight:validate',
  'agents:managed-infrastructure-cutover-attestations',
  'agents:settings-health-readiness',
  'agents:settings-runtime-readiness',
  'agents:model-provider-adapter',
  'agents:settings-provider-readiness',
  'agents:settings-integration-readiness',
  'agents:settings-contracts',
  'agents:evidence-index-readiness',
  'agents:budget-alert-readiness',
  'agents:error-reporting-readiness',
  'agents:search-provider:vault-endpoint',
  'agents:agent-workbench-contract',
  'agents:agent-message-contract',
  'agents:agent-contract',
  'agents:manager-chat-command-contract',
  'agents:project-settings:privacy',
  'agents:project-settings:provider-budget',
  'agents:project-settings:tool-grants',
  'agents:local-tool-grants',
  'agents:prompt-boundary',
  'agents:action-approvals',
  'agents:quality-evaluation',
  'agents:model-degradation',
  'agents:team-formation',
  'agents:delegation-governance',
  'agents:shared-memory',
  'agents:review-handoff',
  'agents:autonomy-governor',
  'agents:learning-program',
  'agents:teaching-safety',
  'agents:academic-writing-pipeline',
  'agents:citation-integrity',
  'agents:investigation-case',
  'agents:investigation-safety',
  'agents:technical-delivery',
  'agents:engineering-security',
  'agents:creative-studio',
  'agents:rights-provenance',
  'agents:fine-grained-authorization',
  'agents:store-migration-safety',
  'agents:local-artifact-storage',
  'agents:local-audit-integrity',
  'agents:local-privacy-lifecycle',
  'agents:local-durable-task-queue',
  'agents:local-idempotent-execution',
  'agents:local-timeout-cancellation',
  'agents:local-scheduling-governance',
  'agents:local-dead-letter-governance',
  'agents:local-rate-concurrency-governance',
  'agents:local-graceful-shutdown',
  'agents:local-event-recovery',
  'agents:local-causal-request-tracing',
  'agents:project-settings:integrations',
  'agents:project-settings:workspace',
  'agents:product-team:smoke',
  'agents:mission-runner:startup',
  'agents:mvp-readiness:operator-actions',
  'agents:product-team:local-mvp',
  'agents:product-team:core',
  'agents:product-team:core:file-backed',
  'agents:real-user-zero-to-autonomy',
  'agents:real-user-zero-to-autonomy-report',
  'agents:real-user-zero-to-autonomy-report:validate',
  'agents:private-mvp-launch-package',
  'agents:private-mvp-launch-package:validate',
  'agents:launch-operations:private-mvp',
  'agents:product-team:research-sample',
  'agents:product-team:cycle-consistency',
  'agents:product-team:private-pilot:handoff-focused',
  'agents:product-team:private-pilot:release-focused',
  'agents:product-team:private-pilot:launch-acceptance-focused',
  'agents:product-team:private-pilot:focused',
  'agents:product-team:private-pilot:release',
  'agents:product-team:private-pilot:launch',
  'agents:product-team:private-pilot:health',
  'agents:product-team:private-pilot:acceptance',
  'agents:product-team:private-pilot:ops-readiness',
  'agents:product-team:production-ops-controls',
  'agents:product-team:production-deployment-controls',
  'agents:product-team:production-security-controls',
  'agents:product-team:production-provider-controls',
  'agents:product-team:production-evidence-integrity',
  'agents:product-team:production-launch-governance',
  'agents:product-team:private-pilot',
  'launch:private-pilot:check',
  'agents:product-team',
  'agents:transcript-contracts',
  'agents:transcript-channel-create',
  'agents:transcript-search',
  'agents:transcript-channel-pin',
  'agents:transcript-pin',
  'agents:transcript-reply',
  'agents:transcript-mention',
  'agents:transcript-attachment',
  'agents:transcript-member-presence',
  'agents:timeline-action',
  'ui:mock-boundaries',
  'ui:manager-backend:core',
  'ui:manager-backend:core:dev',
  'ui:manager-backend:real-user-chain',
  'ui:manager-backend:real-user-chain:dev',
  'ui:manager-backend:proof-navigation',
  'ui:manager-backend:private-pilot-panels',
  'ui:manager-backend:production-controls',
  'ui:manager-provider-proof',
  'ui:settings-agents-server',
  'ui:settings-agents-server:dev',
  'ui:manager-mission-runner',
  'ui:real-user-zero-to-autonomy',
  'ui:real-user-zero-to-autonomy:dev',
  'ui:manager-private-pilot',
  'ui:manager-private-pilot:dev',
  'ui:manager-backend:legacy-full',
  'adapters:gateway',
  'adapters:gateway-server:validate',
  'adapters:gateway-http:validate',
  'adapters:gateway-postgres-store:validate',
  'launch:gates',
  'launch:local-mvp:check',
  'launch:infra',
  'launch:public-production:no-go',
];

for (const scriptName of requiredScripts) {
  assert(scripts[scriptName], `package.json must expose ${scriptName}.`);
  assert(
    gateDoc.includes(`npm run ${scriptName}`) || scriptName === 'launch:gates',
    `${gateDocPath} must list npm run ${scriptName}.`,
  );
  for (const target of scriptNodeTargets(scripts[scriptName])) {
    assert(existsSync(resolve(repoRoot, target)), `${scriptName} points to missing script target ${target}.`);
  }
}

const requiredScriptSet = new Set(requiredScripts);
for (const section of [
  'P0 - Local Backend MVP',
  'P1 - Customer Private Pilot',
  'P2 - Public Production',
]) {
  for (const command of commandsForGateSection(gateDoc, section)) {
    assert(
      requiredScriptSet.has(command),
      `${gateDocPath} ${section} Required commands must be covered by launch:gates requiredScripts: npm run ${command}.`,
    );
  }
}

for (const section of [
  'P0 - Local Backend MVP',
  'P1 - Customer Private Pilot',
  'P2 - Public Production',
]) {
  assert(gateDoc.includes(section), `${gateDocPath} must include ${section}.`);
}

for (const positioning of [
  'Research Project remains a validation sample',
  'general AI product-team system',
  'Public production remains blocked',
]) {
  assert(gateDoc.includes(positioning), `${gateDocPath} must preserve product positioning: ${positioning}.`);
}

for (const blocker of [
  'Managed persistence',
  'Managed queue/cron',
  'BYOK and providers',
  'Security',
  'Operations',
  'Evidence export',
  'Launch governance',
]) {
  assert(gateDoc.includes(blocker), `${gateDocPath} must list production blocker domain: ${blocker}.`);
}

for (const contract of [
  'brainstorm-board',
  'evidence-packet',
  'product-brief',
  'implementation-plan',
  'final-deliverable',
  'production-infrastructure-rehearsal',
  'Settings provider seal',
  'local-mvp-startup-readiness/v1',
  'public-production-startup-readiness/v1',
  'production-customer-acceptance-startup-readiness/v1',
  'customer-production-acceptance-policy',
  'managed-infrastructure-cutover-attestation-run/v1',
  'project-level Production Launch Control Center',
  'settings-health-readiness/v1',
  'settings-runtime-readiness/v1',
  'model-provider-adapter-manifest/v1',
  'settings-integration-readiness/v1',
  '/secret-vault/seal',
  '/search/test',
  '/workspace/bind',
  '/local-runtime',
  'POST /product-team-missions',
  'zero-to-autonomy',
  'C/A handoff',
  'requested-change review',
  'linked revision',
  'accepted final-deliverable',
  'Planner / Executor / Reviewer state machine',
  'planner-executor-reviewer-state-machine/v1',
  'project-integration-capabilities/v1',
  'evidence-index-readiness/v1',
  'budget-alert-readiness/v1',
  'error-reporting-readiness/v1',
  'Agent submission node',
  'Runtime Autonomy Status',
  'Manager Flow Graph',
  'Readiness Proof Map',
  'Product Team Delivery Trace',
  'Group Chat transcript',
  'transcript-channel-created/v1',
  'event ledger',
]) {
  assert(gateDoc.includes(contract), `${gateDocPath} must keep generic product-team evidence contract: ${contract}.`);
}

assert(
  scripts['agents:real-user-zero-to-autonomy']?.includes('validate-real-user-zero-to-autonomy-agents-server-api.mjs'),
  'agents:real-user-zero-to-autonomy must run the real agents:server API validation script.',
);
assert(
  scripts['agents:real-user-zero-to-autonomy-report'] === 'node scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs --report'
    && scripts['agents:real-user-zero-to-autonomy-report:validate'] === 'node scripts/validate-real-user-zero-to-autonomy-report.mjs',
  'Real-user zero-to-autonomy operator report scripts must stay wired to the real backend API validation path.',
);
assert(
  scripts['agents:private-mvp-launch-package'] === 'node scripts/report-private-mvp-launch-package.mjs'
    && scripts['agents:private-mvp-launch-package:validate'] === 'node scripts/validate-private-mvp-launch-package.mjs',
  'Private MVP launch package scripts must stay wired to the launch-package report and validator.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs')),
  'Real-user zero-to-autonomy agents:server API validation script must exist.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/validate-real-user-zero-to-autonomy-report.mjs')),
  'Real-user zero-to-autonomy operator report validation script must exist.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/report-private-mvp-launch-package.mjs'))
    && existsSync(resolve(repoRoot, 'scripts/validate-private-mvp-launch-package.mjs')),
  'Private MVP launch package report and validation scripts must exist.',
);
assert(
  scripts['ui:real-user-zero-to-autonomy']?.includes('validate-real-user-zero-to-autonomy-agents-server-ui.mjs'),
  'ui:real-user-zero-to-autonomy must run the real agents:server browser validation script.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs')),
  'Real-user zero-to-autonomy agents:server validation script must exist.',
);
assert(
  scripts['launch:private-pilot:check'] === 'npm run agents:product-team:private-pilot && npm run ui:manager-private-pilot',
  'launch:private-pilot:check must run the backend private-pilot chain and the built Manager private-pilot UI handoff gate.',
);
assert(
  gateDoc.includes('`npm run launch:private-pilot:check` is the one-command P1 release gate')
    && gateDoc.includes('Use the two component commands only when isolating a backend or UI failure.'),
  `${gateDocPath} must explain when to use the aggregate P1 release gate versus component gates.`,
);
assert(
  scripts['launch:public-production:no-go'] === 'node scripts/validate-public-production-no-go.mjs',
  'launch:public-production:no-go must use the dedicated public-production no-go validator.',
);
assert(
  gateDoc.includes('`npm run launch:public-production:no-go` is the operator-facing public-production decision check')
    && gateDoc.includes('scripts/validate-public-production-no-go.mjs')
    && gateDoc.includes('directly checks `public-production-startup-readiness/v1` and the redacted operator report still return explicit public-production no-go')
    && gateDoc.includes('Use it when the question is "can we open public traffic now"'),
  `${gateDocPath} must explain the public-production no-go aggregate and prevent interpreting rehearsal as approval.`,
);
assert(
  gateDoc.includes('`npm run agents:production-access-control` is the focused production access-control contract')
    && gateDoc.includes('setup-access-control')
    && gateDoc.includes('signed request enforcement')
    && gateDoc.includes('fail-closed audit-sink behavior')
    && gateDoc.includes('GET /access-control-policy'),
  `${gateDocPath} must document the focused production access-control gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-managed-identity` is the focused managed identity startup contract')
    && gateDoc.includes('setup-managed-identity')
    && gateDoc.includes('service identity')
    && gateDoc.includes('signed managed-production identity evidence')
    && gateDoc.includes('GET /managed-identity-policy'),
  `${gateDocPath} must document the focused production managed identity gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-managed-secrets` is the focused managed Secret Manager/KMS startup contract')
    && gateDoc.includes('setup-managed-secrets')
    && gateDoc.includes('managed provider')
    && gateDoc.includes('raw secret exposure')
    && gateDoc.includes('GET /managed-secret-manager-policy'),
  `${gateDocPath} must document the focused production managed secrets gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-managed-persistence` is the focused managed database persistence startup contract')
    && gateDoc.includes('setup-managed-persistence')
    && gateDoc.includes('real adapter')
    && gateDoc.includes('signed managed-production cutover evidence')
    && gateDoc.includes('GET /managed-persistence-policy'),
  `${gateDocPath} must document the focused production managed persistence gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-managed-worker-queue` is the focused managed durable queue startup contract')
    && gateDoc.includes('setup-managed-worker-queue')
    && gateDoc.includes('signed managed-production queue cutover evidence')
    && gateDoc.includes('GET /managed-worker-queue-policy'),
  `${gateDocPath} must document the focused production managed worker queue gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-provider-controls` is the focused production provider/BYOK controls startup contract')
    && gateDoc.includes('setup-production-cost-controls')
    && gateDoc.includes('signed managed-production cost-control evidence')
    && gateDoc.includes('GET /production-provider-controls-policy'),
  `${gateDocPath} must document the focused production provider/BYOK controls gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-data-governance` is the focused production data governance startup contract')
    && gateDoc.includes('setup-production-data-governance')
    && gateDoc.includes('signed managed-production data-governance evidence')
    && gateDoc.includes('GET /production-data-governance-policy'),
  `${gateDocPath} must document the focused production data governance gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-traffic-controls` is the focused production traffic/rollback startup contract')
    && gateDoc.includes('setup-production-traffic')
    && gateDoc.includes('signed managed-production traffic-control evidence')
    && gateDoc.includes('GET /production-traffic-policy'),
  `${gateDocPath} must document the focused production traffic/rollback gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-customer-acceptance` is the focused production customer acceptance startup contract')
    && gateDoc.includes('setup-customer-production-acceptance')
    && gateDoc.includes('signed managed-production customer-acceptance evidence')
    && gateDoc.includes('GET /production-customer-acceptance-policy'),
  `${gateDocPath} must document the focused production customer acceptance gate.`,
);
assert(
  gateDoc.includes('`npm run agents:production-operations-startup` is the focused production operations startup contract')
    && gateDoc.includes('setup-observability')
    && gateDoc.includes('signed managed-production operations evidence')
    && gateDoc.includes('GET /production-operations-policy'),
  `${gateDocPath} must document the focused production operations startup gate.`,
);
assert(
  gateDoc.includes('`npm run agents:public-production-readiness-report` is the low-write operator report')
    && gateDoc.includes('production-environment-setup/v1')
    && gateDoc.includes('public-production-action-plan/v1')
    && gateDoc.includes('managed-environment-preflight-report/v1')
    && gateDoc.includes('intentionally omits configured values')
    && gateDoc.includes('does not leak production URLs'),
  `${gateDocPath} must document the redacted public-production operator report.`,
);
assert(
  gateDoc.includes('`npm run agents:private-mvp-launch-package` emits `private-mvp-launch-package/v1`')
    && gateDoc.includes('private-mvp-ready-public-production-blocked')
    && gateDoc.includes('must not be used as public-production approval')
    && gateDoc.includes('`npm run agents:launch-operations:private-mvp`')
    && gateDoc.includes('Launch Operations Private MVP visibility')
    && gateDoc.includes('hides the package boundary')
    && gateDoc.includes('Public Production Next Steps')
    && gateDoc.includes('owner, action, why-blocked, validation-command, route, and run-route fields')
    && gateDoc.includes('launch-operations-next-step-run/v1')
    && gateDoc.includes('hides public-production next steps')
    && gateDoc.includes('drops the next-step receipt'),
  `${gateDocPath} must document the Private MVP launch package boundary.`,
);
assert(
  gateDoc.includes('`npm run agents:managed-environment-preflight` is the low-write bridge from rehearsal to real managed infrastructure')
    && gateDoc.includes('does not make network calls')
    && gateDoc.includes('--check-network')
    && gateDoc.includes('local/private endpoints stay blocked'),
  `${gateDocPath} must document the managed environment preflight and its fail-closed default.`,
);

assert(
  infraGateSource.includes('scripts/validate-public-production-startup-readiness-contract.mjs'),
  'launch:infra must run the public production startup readiness blocker contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-access-control-contract.mjs'),
  'launch:infra must run the production access-control enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-managed-identity-contract.mjs'),
  'launch:infra must run the production managed identity enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-managed-secrets-contract.mjs'),
  'launch:infra must run the production managed secrets enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-managed-persistence-contract.mjs'),
  'launch:infra must run the production managed persistence enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-managed-worker-queue-contract.mjs'),
  'launch:infra must run the production managed worker queue enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-provider-controls-contract.mjs'),
  'launch:infra must run the production provider/BYOK controls enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-data-governance-contract.mjs'),
  'launch:infra must run the production data governance enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-traffic-controls-contract.mjs'),
  'launch:infra must run the production traffic/rollback enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-customer-acceptance-contract.mjs'),
  'launch:infra must run the production customer acceptance enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-production-operations-startup-contract.mjs'),
  'launch:infra must run the production operations startup enforcement contract.',
);
assert(
  infraGateSource.includes('scripts/validate-public-production-readiness-report.mjs'),
  'launch:infra must run the redacted public production operator report validation.',
);
assert(
  infraGateSource.includes('scripts/validate-managed-environment-preflight.mjs'),
  'launch:infra must run the managed environment preflight validation.',
);
assert(
  infraGateSource.includes('scripts/validate-managed-infrastructure-cutover-attestations.mjs'),
  'launch:infra must run the managed infrastructure cutover attestation bridge.',
);
assert(
  publicProductionNoGoSource.includes('scripts/validate-production-infrastructure-gates.mjs')
    && publicProductionNoGoSource.includes('getPublicProductionStartupReadiness')
    && publicProductionNoGoSource.includes("readyForPublicProduction === false")
    && publicProductionNoGoSource.includes('scripts/report-public-production-readiness.mjs')
    && publicProductionNoGoSource.includes("status === 'public-production-blocked'"),
  'launch:public-production:no-go must reuse infrastructure rehearsal and explicitly assert public-production no-go readiness/report status.',
);

for (const currentEvidence of [
  'Latest built browser confirmation',
  'npm run ui:real-user-zero-to-autonomy',
  'This confirms the private-MVP browser path only',
  'Latest low-write browser preflight',
  'npm run ui:real-user-zero-to-autonomy:dev',
  'does not replace the built launch gate above',
  'Latest low-write launch metadata and mock-boundary confirmation',
  'npm run ui:mock-boundaries',
  'frontend mock-replacement fail-closed boundaries',
  'metadata and static-boundary proof only',
  'Latest foundation and core-chain validation confirmation',
  'npm run skills:check',
  '40 persona packages',
  '55 routing regression cases',
  'backend transcript channel creation',
  'P2 operations controls',
  'P2 deployment controls',
  'P2 security controls',
  'P2 provider controls',
  'P2 managed-evidence classification',
  'P2 launch-governance approval contract',
  'production-hardening rehearsal evidence, not public-production certification',
]) {
  assert(gateDoc.includes(currentEvidence), `${gateDocPath} must preserve current evidence boundary: ${currentEvidence}.`);
}

const crossReferenceFiles = [
  'README.md',
  'ROADMAP.md',
  'TECHNICAL.md',
  'src/agents/README.md',
  'src/agents/ARCHITECTURE_AUDIT.md',
  'docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md',
];

for (const file of crossReferenceFiles) {
  assert(read(file).includes(gateDocPath), `${file} must reference ${gateDocPath}.`);
}

console.log('Launch readiness gate validation passed.');
