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
  'agents:product-team:core',
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
  'ui:manager-backend',
  'ui:manager-private-pilot',
  'adapters:gateway',
  'adapters:gateway-server:validate',
  'adapters:gateway-http:validate',
  'adapters:gateway-postgres-store:validate',
  'launch:gates',
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
  'Manager Flow Graph',
  'Readiness Proof Map',
]) {
  assert(gateDoc.includes(contract), `${gateDocPath} must keep generic product-team evidence contract: ${contract}.`);
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
