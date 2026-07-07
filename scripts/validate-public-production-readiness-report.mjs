import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['scripts/report-public-production-readiness.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    PRODUCTION_DOMAIN_NAME: 'prod.example.invalid',
    PRODUCTION_HEALTHCHECK_URL: 'https://prod.example.invalid/health',
    PRODUCTION_SECRET_MANAGER_ENDPOINT: 'https://secret.example.invalid',
    MANAGED_PERSISTENCE_DATABASE_URL: 'postgres://user:password@db.example.invalid/hofs',
    WORKER_QUEUE_HTTP_ENDPOINT: 'https://queue.example.invalid',
  },
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const report = JSON.parse(result.stdout);
const serialized = JSON.stringify(report);

assert(report.schemaVersion === 'public-production-readiness-operator-report/v1', 'Report must expose the operator report schema.');
assert(report.readyForPublicProduction === false, 'Report must not claim public production readiness from partial/env-only config.');
assert(report.status === 'public-production-blocked', 'Report must remain blocked without signed managed-production evidence.');
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
assert(!serialized.includes('prod.example.invalid'), 'Report must not expose configured production URLs.');
assert(!serialized.includes('secret.example.invalid'), 'Report must not expose secret manager endpoint values.');
assert(!serialized.includes('password'), 'Report must not expose database URL credentials.');
assert(!serialized.includes('queue.example.invalid'), 'Report must not expose queue endpoint values.');

console.log('Public production readiness operator report validation passed.');
