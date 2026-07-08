import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

console.log('[launch:public-production:no-go] production infrastructure rehearsal');
const infraResult = spawnSync(process.execPath, ['scripts/validate-production-infrastructure-gates.mjs'], {
  cwd: repoRoot,
  env: { ...process.env },
  stdio: 'inherit',
});
if (infraResult.status !== 0) {
  process.exit(infraResult.status || 1);
}

const service = createAgentProjectService();
const readiness = service.getPublicProductionStartupReadiness();
assert(
  readiness?.schemaVersion === 'public-production-startup-readiness/v1',
  'Public production no-go check must read public-production-startup-readiness/v1.',
);
assert(
  readiness.readyForPublicProduction === false,
  'launch:public-production:no-go must fail if the current environment claims public production readiness.',
);
assert(
  readiness.readyForProduction === false,
  'launch:public-production:no-go must fail if the current environment claims production readiness.',
);
assert(
  readiness.status === 'public-production-startup-blocked',
  `Expected public-production-startup-blocked; got ${readiness.status || 'missing status'}.`,
);
assert(
  Array.isArray(readiness.failedGates) && readiness.failedGates.length > 0,
  'Public production no-go check must expose failed public-production gates.',
);
assert(
  readiness.backendRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness',
  'Public production no-go check must expose the startup readiness route.',
);

console.log('[launch:public-production:no-go] redacted operator report');
const reportResult = spawnSync(process.execPath, ['scripts/report-public-production-readiness.mjs'], {
  cwd: repoRoot,
  env: { ...process.env },
  encoding: 'utf8',
});
if (reportResult.status !== 0) {
  process.stderr.write(reportResult.stderr || reportResult.stdout);
  process.exit(reportResult.status || 1);
}

let report;
try {
  report = JSON.parse(reportResult.stdout);
} catch (error) {
  throw new Error(`Public production operator report must emit JSON: ${error.message}`);
}

assert(
  report.schemaVersion === 'public-production-readiness-operator-report/v1',
  'Public production no-go check must read the operator report schema.',
);
assert(
  report.readyForPublicProduction === false,
  'Operator report must not claim public production readiness during the no-go check.',
);
assert(
  report.status === 'public-production-blocked',
  `Expected operator report status public-production-blocked; got ${report.status || 'missing status'}.`,
);
assert(
  report.backendRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness',
  'Operator report must link the public-production startup readiness route.',
);
assert(
  report.managedEnvironmentPreflight?.readyForPublicProduction === false,
  'Managed environment preflight must not claim public production readiness.',
);
assert(
  report.summary?.blockedSetupRowCount > 0,
  'Operator report must expose blocked public-production setup rows.',
);
assert(
  report.operatorActionPlan?.schemaVersion === 'public-production-action-plan/v1',
  'Operator report must expose public-production-action-plan/v1.',
);
assert(
  report.operatorActionPlan.readyForPublicProduction === false
    && report.operatorActionPlan.status === 'public-production-blocked',
  'Operator action plan must preserve public-production no-go state.',
);
assert(
  report.operatorActionPlan.actionCount >= report.summary.blockedSetupRowCount,
  'Operator action plan must expose actionable rows for blocked setup domains.',
);

console.log('Public production no-go validation passed.');
