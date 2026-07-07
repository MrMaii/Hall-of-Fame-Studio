import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['scripts/report-managed-environment-preflight.mjs'], {
  cwd: repoRoot,
  encoding: 'utf8',
  env: {
    ...process.env,
    ADAPTER_GATEWAY_HTTP_ENDPOINT: 'http://127.0.0.1:4177/private-gateway-token-should-not-leak',
    ADAPTER_GATEWAY_AUTH_TOKEN: 'ADAPTER_GATEWAY_TOKEN_SHOULD_NOT_LEAK',
    MANAGED_PERSISTENCE_ADAPTER_DRIVER: 'http-json',
    MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER: 'true',
    MANAGED_PERSISTENCE_DATABASE_URL: 'postgres://user:password@db.example.invalid/hofs',
    WORKER_QUEUE_ADAPTER_DRIVER: 'http-json',
    WORKER_QUEUE_REQUIRE_REAL_ADAPTER: 'true',
    WORKER_QUEUE_HTTP_ENDPOINT: 'https://queue.example.invalid/enqueue?token=queue-secret',
    MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET: 'ATTESTATION_SECRET_SHOULD_NOT_LEAK',
  },
});

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const report = JSON.parse(result.stdout);
const serialized = JSON.stringify(report);

assert(report.schemaVersion === 'managed-environment-preflight-report/v1', 'Managed environment preflight must expose its schema.');
assert(report.readyForManagedEnvironment === false, 'Local/private endpoints must not pass managed environment preflight.');
assert(report.readyForPublicProduction === false, 'Managed environment preflight must not claim public production readiness.');
assert(report.summary.gatewayEndpointClass === 'local', 'Local gateway endpoint must be classified as local.');
assert(report.blockedRows.some((row) => row.id === 'external-adapter-gateway'), 'Report must block local adapter gateway endpoints.');
assert(report.blockedRows.some((row) => row.id === 'network-health-check'), 'Report must block until explicit network health/state check runs.');
assert(report.validationCommands.includes('npm run launch:infra'), 'Report must link launch infrastructure rehearsal.');
assert(!serialized.includes('private-gateway-token-should-not-leak'), 'Report must not expose gateway URL path or tokens.');
assert(!serialized.includes('ADAPTER_GATEWAY_TOKEN_SHOULD_NOT_LEAK'), 'Report must not expose gateway auth token.');
assert(!serialized.includes('password'), 'Report must not expose database credentials.');
assert(!serialized.includes('queue-secret'), 'Report must not expose queue endpoint tokens.');
assert(!serialized.includes('ATTESTATION_SECRET_SHOULD_NOT_LEAK'), 'Report must not expose attestation signing secret.');

const markdown = spawnSync(process.execPath, ['scripts/report-managed-environment-preflight.mjs', '--format=markdown'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
assert(markdown.status === 0, 'Markdown managed environment preflight report must render.');
assert(markdown.stdout.includes('# Managed Environment Preflight'), 'Markdown report must include a title.');

console.log('Managed environment preflight validation passed.');
