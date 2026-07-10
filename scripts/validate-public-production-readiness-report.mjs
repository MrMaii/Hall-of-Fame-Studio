import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportEnv = {
  ...process.env,
  PRODUCTION_DOMAIN_NAME: 'prod.example.invalid',
  PRODUCTION_HEALTHCHECK_URL: 'https://prod.example.invalid/health',
  PRODUCTION_SECRET_MANAGER_ENDPOINT: 'https://secret.example.invalid',
  MANAGED_PERSISTENCE_DATABASE_URL: 'postgres://user:password@db.example.invalid/hofs',
  WORKER_QUEUE_HTTP_ENDPOINT: 'https://queue.example.invalid',
};
const result = spawnSync(process.execPath, ['scripts/report-public-production-readiness.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: reportEnv,
});
const markdownResult = spawnSync(process.execPath, ['scripts/report-public-production-readiness.mjs', '--format=markdown'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: reportEnv,
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}
if (markdownResult.status !== 0) {
  process.stderr.write(markdownResult.stderr || markdownResult.stdout);
  process.exit(markdownResult.status || 1);
}

const report = JSON.parse(result.stdout);
const serialized = JSON.stringify(report);
const markdown = markdownResult.stdout;

assert(report.schemaVersion === 'public-production-readiness-operator-report/v1', 'Report must expose the operator report schema.');
assert(report.readyForPublicProduction === false, 'Report must not claim public production readiness from partial/env-only config.');
assert(report.status === 'public-production-blocked', 'Report must remain blocked without signed managed-production evidence.');
assert(report.productionCapabilityRegistry?.schemaVersion === 'production-capability-registry/v1', 'Report must embed the production capability registry.');
assert(report.productionCapabilityRegistry?.readyForProduction === false, 'Capability registry must fail closed without managed-production evidence.');
assert(report.productionCapabilityRegistry?.summary?.requiredCapabilityCount === 50, 'Capability registry must cover all fifty production capabilities.');
assert(report.productionCapabilityRegistry?.summary?.verifiedCapabilityCount === 0, 'Environment-only configuration must not verify a production capability.');
assert(report.backendRoutes.productionCapabilities === '/production-capabilities', 'Report must expose the production capability registry route.');
assert(report.summary.blockedSetupRowCount >= 1, 'Report must list blocked setup rows.');
assert(report.blockedRows.some((row) => row.id === 'managed-secrets'), 'Report must include managed secret/KMS blockers.');
assert(report.blockedRows.some((row) => row.id === 'managed-persistence'), 'Report must include managed persistence blockers.');
assert(report.blockedRows.some((row) => row.id === 'managed-worker-queue'), 'Report must include durable queue blockers.');
assert(report.blockedRows.some((row) => row.id === 'customer-production-acceptance'), 'Report must include customer production acceptance blockers.');
assert(report.validationCommands.includes('npm run agents:public-production-startup-readiness'), 'Report must include the focused public startup validation command.');
assert(report.validationCommands.includes('npm run agents:managed-environment-preflight'), 'Report must include the managed environment preflight command.');
assert(report.validationCommands.includes('npm run launch:infra'), 'Report must include the infrastructure rehearsal command.');
assert(report.backendRoutes.publicProductionStartupReadiness === '/public-production-startup-readiness', 'Report must link the public startup route.');
assert(report.managedEnvironmentPreflight?.schemaVersion === 'managed-environment-preflight-report/v1', 'Report must embed the managed environment preflight summary.');
assert(report.managedEnvironmentPreflight.readyForManagedEnvironment === false, 'Report must not claim managed environment readiness from partial/env-only config.');
assert(report.managedEnvironmentPreflight.readyForPublicProduction === false, 'Managed environment preflight must never claim public production readiness.');
assert(report.managedEnvironmentPreflight.validationCommands.includes('npm run agents:managed-environment-preflight'), 'Embedded managed preflight must include its focused validation command.');
assert(report.operatorActionPlan?.schemaVersion === 'public-production-action-plan/v1', 'Report must embed the public production operator action plan.');
assert(report.operatorActionPlan.readyForPublicProduction === false, 'Operator action plan must not claim public production readiness.');
assert(report.operatorActionPlan.status === 'public-production-blocked', 'Operator action plan must stay blocked under partial/env-only config.');
assert(report.operatorActionPlan.actionCount >= report.summary.blockedSetupRowCount, 'Operator action plan must include setup blocker actions.');
assert(report.operatorActionPlan.validationCommands.includes('npm run launch:public-production:no-go'), 'Operator action plan must include the public no-go command.');
assert(report.operatorActionPlan.validationCommands.includes('npm run agents:production-provider-controls'), 'Operator action plan must aggregate the focused provider/BYOK cost-control command.');
assert(report.operatorActionPlan.validationCommands.includes('npm run agents:managed-environment-preflight'), 'Operator action plan must aggregate the managed environment preflight command.');
assert(report.operatorActionPlan.actions.some((row) => row.id === 'setup-managed-secrets'), 'Operator action plan must include managed secret/KMS setup action.');
assert(report.operatorActionPlan.actions.some((row) => row.id === 'setup-managed-persistence'), 'Operator action plan must include managed persistence setup action.');
assert(report.operatorActionPlan.actions.some((row) => row.id === 'setup-managed-worker-queue'), 'Operator action plan must include durable queue setup action.');
assert(report.operatorActionPlan.actions.some((row) => row.id === 'setup-production-cost-controls' && row.validationCommand === 'npm run agents:production-provider-controls'), 'Operator action plan must include the focused provider/BYOK cost-control setup action.');
assert(report.operatorActionPlan.actions.some((row) => row.id === 'managed-preflight-external-adapter-gateway'), 'Operator action plan must include external adapter gateway preflight action.');
assert(markdown.includes('## Validation Commands'), 'Markdown operator report must expose a top-level validation command section.');
assert(markdown.includes('Verified production capabilities: 0/50'), 'Markdown report must expose the capability registry summary.');
assert(markdown.includes('- npm run agents:production-provider-controls'), 'Markdown operator report must include the focused provider/BYOK command.');
assert(markdown.includes('- npm run agents:managed-environment-preflight'), 'Markdown operator report must include the managed environment preflight command.');
assert(!serialized.includes('prod.example.invalid'), 'Report must not expose configured production URLs.');
assert(!serialized.includes('secret.example.invalid'), 'Report must not expose secret manager endpoint values.');
assert(!serialized.includes('password'), 'Report must not expose database URL credentials.');
assert(!serialized.includes('queue.example.invalid'), 'Report must not expose queue endpoint values.');
assert(!markdown.includes('prod.example.invalid'), 'Markdown report must not expose configured production URLs.');
assert(!markdown.includes('secret.example.invalid'), 'Markdown report must not expose secret manager endpoint values.');
assert(!markdown.includes('password'), 'Markdown report must not expose database URL credentials.');
assert(!markdown.includes('queue.example.invalid'), 'Markdown report must not expose queue endpoint values.');

console.log('Public production readiness operator report validation passed.');
