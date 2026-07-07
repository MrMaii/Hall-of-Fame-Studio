import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { buildManagedEnvironmentPreflightReport } from './report-managed-environment-preflight.mjs';

function readArg(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function redactedRow(row = {}) {
  return {
    id: row.id || '',
    domain: row.domain || 'unknown',
    label: row.label || row.id || '',
    ready: Boolean(row.ready),
    status: row.ready ? 'ready' : 'blocked',
    detail: row.detail || '',
    nextAction: row.nextAction || '',
    apiPath: row.apiPath || '',
    validationCommand: row.validationCommand || '',
    requiredEnvVars: toArray(row.envVars).length
      ? toArray(row.envVars)
      : [
        ...toArray(row.allOfEnvVars),
        ...toArray(row.anyOfEnvVarGroups).flat(),
      ],
    configuredEnvVars: toArray(row.configuredEnvVars),
    missingEnvVars: toArray(row.missingEnvVars),
    missingAnyOfGroups: toArray(row.missingAnyOfGroups),
  };
}

function redactedManagedEnvironmentPreflight(report = {}) {
  return {
    schemaVersion: report.schemaVersion || 'managed-environment-preflight-report/v1',
    status: report.status || 'unknown',
    readyForManagedEnvironment: Boolean(report.readyForManagedEnvironment),
    readyForPublicProduction: Boolean(report.readyForPublicProduction),
    summary: report.summary || {},
    network: {
      requested: Boolean(report.network?.requested),
      status: report.network?.status || 'unknown',
      healthReady: Boolean(report.network?.healthReady),
      stateReady: Boolean(report.network?.stateReady),
      managedStorageReady: Boolean(report.network?.managedStorageReady),
      summary: report.network?.summary || null,
    },
    nextAction: report.nextAction || null,
    validationCommands: toArray(report.validationCommands),
    blockedRows: toArray(report.blockedRows).map((row) => ({
      id: row.id || '',
      domain: row.domain || 'unknown',
      label: row.label || row.id || '',
      status: row.status || (row.ready ? 'ready' : 'blocked'),
      detail: row.detail || '',
      nextAction: row.nextAction || '',
      requiredEnvVars: toArray(row.requiredEnvVars),
      anyOfEnvVarGroups: toArray(row.anyOfEnvVarGroups),
    })),
  };
}

async function buildReport() {
  const service = createAgentProjectService();
  const readiness = service.getPublicProductionStartupReadiness();
  const managedEnvironmentPreflight = await buildManagedEnvironmentPreflightReport();
  const setup = readiness.productionEnvironmentSetup || {};
  const rows = toArray(setup.rows).map(redactedRow);
  const blockedRows = rows.filter((row) => !row.ready);
  const blockedDomains = [...new Set(blockedRows.map((row) => row.domain))].sort();

  return {
    schemaVersion: 'public-production-readiness-operator-report/v1',
    generatedAt: readiness.generatedAt || new Date().toISOString(),
    status: readiness.readyForPublicProduction ? 'ready-for-public-production' : 'public-production-blocked',
    readyForPublicProduction: Boolean(readiness.readyForPublicProduction),
    publicProductionStartupStatus: readiness.status || 'unknown',
    summary: {
      gateCount: readiness.summary?.gateCount || toArray(readiness.gates).length,
      failedGateCount: readiness.summary?.failedGateCount || toArray(readiness.failedGates).length,
      failedBlockerGateCount: readiness.summary?.failedBlockerGateCount || 0,
      setupRowCount: setup.summary?.rowCount || rows.length,
      blockedSetupRowCount: setup.summary?.blockedRowCount || blockedRows.length,
      blockedDomains,
    },
    nextAction: readiness.nextAction || setup.nextAction || null,
    validationCommands: [
      'npm run agents:public-production-startup-readiness',
      'npm run agents:managed-environment-preflight',
      'npm run launch:infra',
    ],
    backendRoutes: {
      publicProductionStartupReadiness: readiness.backendRoutes?.publicProductionStartupReadiness || '/public-production-startup-readiness',
      productionEnvironmentSetup: readiness.backendRoutes?.publicProductionStartupReadiness || '/public-production-startup-readiness',
    },
    managedEnvironmentPreflight: redactedManagedEnvironmentPreflight(managedEnvironmentPreflight),
    blockedRows,
    rows,
  };
}

function formatMarkdown(report) {
  const lines = [
    '# Public Production Readiness Report',
    '',
    `Status: ${report.status}`,
    `Ready for public production: ${report.readyForPublicProduction ? 'yes' : 'no'}`,
    `Blocked setup rows: ${report.summary.blockedSetupRowCount}/${report.summary.setupRowCount}`,
    `Blocked domains: ${report.summary.blockedDomains.join(', ') || 'none'}`,
    '',
    '## Managed Environment Preflight',
    '',
    `- Status: ${report.managedEnvironmentPreflight.status}`,
    `- Ready for managed environment: ${report.managedEnvironmentPreflight.readyForManagedEnvironment ? 'yes' : 'no'}`,
    `- Blocked rows: ${report.managedEnvironmentPreflight.summary.blockedRowCount}/${report.managedEnvironmentPreflight.summary.rowCount}`,
    `- Network check: ${report.managedEnvironmentPreflight.network.status}`,
    report.managedEnvironmentPreflight.nextAction
      ? `- Next action: ${report.managedEnvironmentPreflight.nextAction.label}: ${report.managedEnvironmentPreflight.nextAction.detail}`
      : '- Next action: None',
    '',
    '## Next Action',
    '',
    report.nextAction
      ? `- ${report.nextAction.label || report.nextAction.id}: ${report.nextAction.detail || ''}`
      : '- None',
    '',
    '## Blocked Rows',
    '',
  ];

  for (const row of report.blockedRows) {
    lines.push(`- ${row.domain} / ${row.label}: ${row.nextAction || row.detail}`);
    if (row.apiPath) lines.push(`  Route: ${row.apiPath}`);
    if (row.validationCommand) lines.push(`  Validate: ${row.validationCommand}`);
    if (row.requiredEnvVars.length) lines.push(`  Required env names: ${row.requiredEnvVars.join(', ')}`);
  }

  if (!report.blockedRows.length) lines.push('- None');
  lines.push('');
  lines.push('Values are intentionally omitted. This report lists env var names and backend routes only.');
  return `${lines.join('\n')}\n`;
}

const report = await buildReport();
const format = readArg('--format') || 'json';
if (format === 'markdown') {
  process.stdout.write(formatMarkdown(report));
} else {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
