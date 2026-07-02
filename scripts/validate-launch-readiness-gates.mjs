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

const gateDocPath = 'docs/LAUNCH_READINESS_GATES.md';
assert(existsSync(resolve(repoRoot, gateDocPath)), 'Launch readiness gate document must exist.');

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const gateDoc = read(gateDocPath);

const requiredScripts = [
  'build',
  'skills:check',
  'agents:scenario',
  'agents:server',
  'agents:server:validate',
  'agents:local-mvp-startup-readiness',
  'agents:settings-health-readiness',
  'agents:settings-runtime-readiness',
  'agents:settings-provider-readiness',
  'agents:settings-integration-readiness',
  'agents:evidence-index-readiness',
  'agents:budget-alert-readiness',
  'agents:error-reporting-readiness',
  'agents:search-provider:vault-endpoint',
  'agents:project-settings:privacy',
  'agents:project-settings:provider-budget',
  'agents:project-settings:tool-grants',
  'agents:project-settings:integrations',
  'agents:product-team:core',
  'agents:real-user-zero-to-autonomy',
  'agents:product-team:research-sample',
  'agents:product-team:cycle-consistency',
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
  'agents:product-team',
  'ui:manager-backend:core',
  'ui:manager-provider-proof',
  'ui:settings-agents-server',
  'ui:manager-mission-runner',
  'ui:real-user-zero-to-autonomy',
  'ui:manager-backend',
  'ui:manager-private-pilot',
  'adapters:gateway',
  'adapters:gateway-server:validate',
  'adapters:gateway-http:validate',
  'adapters:gateway-postgres-store:validate',
  'launch:gates',
  'launch:local-mvp:check',
  'launch:infra',
];

for (const scriptName of requiredScripts) {
  assert(scripts[scriptName], `package.json must expose ${scriptName}.`);
  assert(
    gateDoc.includes(`npm run ${scriptName}`) || scriptName === 'launch:gates',
    `${gateDocPath} must list npm run ${scriptName}.`,
  );
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
  'settings-health-readiness/v1',
  'settings-runtime-readiness/v1',
  'settings-integration-readiness/v1',
  '/secret-vault/seal',
  '/search/test',
  'POST /product-team-missions',
  'zero-to-autonomy',
  'C/A handoff',
  'requested-change review',
  'linked revision',
  'accepted final-deliverable',
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
  'event ledger',
]) {
  assert(gateDoc.includes(contract), `${gateDocPath} must keep generic product-team evidence contract: ${contract}.`);
}

assert(
  scripts['agents:real-user-zero-to-autonomy']?.includes('validate-real-user-zero-to-autonomy-agents-server-api.mjs'),
  'agents:real-user-zero-to-autonomy must run the real agents:server API validation script.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs')),
  'Real-user zero-to-autonomy agents:server API validation script must exist.',
);
assert(
  scripts['ui:real-user-zero-to-autonomy']?.includes('validate-real-user-zero-to-autonomy-agents-server-ui.mjs'),
  'ui:real-user-zero-to-autonomy must run the real agents:server browser validation script.',
);
assert(
  existsSync(resolve(repoRoot, 'scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs')),
  'Real-user zero-to-autonomy agents:server validation script must exist.',
);

for (const currentEvidence of [
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
