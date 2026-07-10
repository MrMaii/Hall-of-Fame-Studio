import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { buildProductionCapabilityRegistry } from '../src/agents/productionCapabilityRegistry.js';
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

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function actionFromSetupRow(row = {}, index = 0) {
  return {
    id: `setup-${row.id || index}`,
    source: 'production-environment-setup',
    domain: row.domain || 'unknown',
    label: row.label || row.id || `Setup action ${index + 1}`,
    status: row.status || 'blocked',
    nextAction: row.nextAction || row.detail || 'Complete the missing production setup evidence.',
    apiPath: row.apiPath || '/public-production-startup-readiness',
    validationCommand: row.validationCommand || 'npm run agents:public-production-startup-readiness',
    requiredEnvVars: uniqueValues([
      ...toArray(row.requiredEnvVars),
      ...toArray(row.missingEnvVars),
      ...toArray(row.missingAnyOfGroups).flat(),
    ]),
  };
}

function actionFromManagedPreflightRow(row = {}, index = 0) {
  return {
    id: `managed-preflight-${row.id || index}`,
    source: 'managed-environment-preflight',
    domain: row.domain || 'unknown',
    label: row.label || row.id || `Managed preflight action ${index + 1}`,
    status: row.status || 'blocked',
    nextAction: row.nextAction || row.detail || 'Complete the managed environment preflight evidence.',
    apiPath: '/public-production-startup-readiness',
    validationCommand: 'npm run agents:managed-environment-preflight',
    requiredEnvVars: uniqueValues([
      ...toArray(row.requiredEnvVars),
      ...toArray(row.anyOfEnvVarGroups).flat(),
    ]),
  };
}

function buildOperatorActionPlan({
  readiness = {},
  managedEnvironmentPreflight = {},
  blockedRows = [],
  baseActionPlan = null,
} = {}) {
  const actions = [];
  const seen = new Set();
  const baseActions = toArray(baseActionPlan?.actions).length
    ? toArray(baseActionPlan.actions)
    : blockedRows.map(actionFromSetupRow);
  for (const action of [
    ...baseActions,
    ...toArray(managedEnvironmentPreflight.blockedRows).map(actionFromManagedPreflightRow),
  ]) {
    const key = `${action.source}:${action.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }
  const validationCommands = uniqueValues([
    ...toArray(baseActionPlan?.validationCommands),
    ...actions.map((action) => action.validationCommand),
    'npm run agents:public-production-startup-readiness',
    'npm run agents:managed-environment-preflight',
    'npm run launch:public-production:no-go',
  ]);

  return {
    schemaVersion: 'public-production-action-plan/v1',
    status: baseActionPlan?.status || (readiness.readyForPublicProduction ? 'ready-for-public-production' : 'public-production-blocked'),
    readyForPublicProduction: Boolean(readiness.readyForPublicProduction),
    actionCount: actions.length,
    blockedDomains: uniqueValues(actions.map((action) => action.domain)).sort(),
    nextAction: actions[0] || {
      id: 'public-production-ready',
      source: 'public-production-startup-readiness',
      domain: 'launch',
      label: 'Public production startup readiness',
      status: 'ready',
      nextAction: 'Public production startup readiness has no blocked action rows.',
      apiPath: readiness.backendRoutes?.publicProductionStartupReadiness || '/public-production-startup-readiness',
      validationCommand: 'npm run launch:public-production:no-go',
      requiredEnvVars: [],
    },
    validationCommands,
    actions,
  };
}

async function buildReport() {
  const service = createAgentProjectService();
  const readiness = service.getPublicProductionStartupReadiness();
  const productionCapabilityRegistry = buildProductionCapabilityRegistry();
  const managedEnvironmentPreflight = redactedManagedEnvironmentPreflight(await buildManagedEnvironmentPreflightReport());
  const setup = readiness.productionEnvironmentSetup || {};
  const rows = toArray(setup.rows).map(redactedRow);
  const blockedRows = rows.filter((row) => !row.ready);
  const blockedDomains = [...new Set(blockedRows.map((row) => row.domain))].sort();
  const operatorActionPlan = buildOperatorActionPlan({
    readiness,
    managedEnvironmentPreflight,
    blockedRows,
    baseActionPlan: readiness.publicProductionActionPlan,
  });

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
      requiredProductionCapabilityCount: productionCapabilityRegistry.summary.requiredCapabilityCount,
      verifiedProductionCapabilityCount: productionCapabilityRegistry.summary.verifiedCapabilityCount,
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
      productionCapabilities: '/production-capabilities',
    },
    productionCapabilityRegistry: {
      schemaVersion: productionCapabilityRegistry.schemaVersion,
      checksum: productionCapabilityRegistry.checksum,
      readyForProduction: productionCapabilityRegistry.readyForProduction,
      summary: productionCapabilityRegistry.summary,
      blockers: productionCapabilityRegistry.blockers,
      environmentAttestation: productionCapabilityRegistry.environmentAttestation,
    },
    managedEnvironmentPreflight,
    operatorActionPlan,
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
    `Verified production capabilities: ${report.summary.verifiedProductionCapabilityCount}/${report.summary.requiredProductionCapabilityCount}`,
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
    report.operatorActionPlan?.nextAction
      ? `- ${report.operatorActionPlan.nextAction.label || report.operatorActionPlan.nextAction.id}: ${report.operatorActionPlan.nextAction.nextAction || ''}`
      : '- None',
    '',
    '## Validation Commands',
    '',
    ...toArray(report.operatorActionPlan?.validationCommands).map((command) => `- ${command}`),
    ...(toArray(report.operatorActionPlan?.validationCommands).length ? [] : ['- None']),
    '',
    '## Operator Action Plan',
    '',
  ];

  for (const action of toArray(report.operatorActionPlan?.actions)) {
    lines.push(`- ${action.domain} / ${action.label}: ${action.nextAction}`);
    if (action.apiPath) lines.push(`  Route: ${action.apiPath}`);
    if (action.validationCommand) lines.push(`  Validate: ${action.validationCommand}`);
    if (action.requiredEnvVars.length) lines.push(`  Required env names: ${action.requiredEnvVars.join(', ')}`);
  }

  if (!toArray(report.operatorActionPlan?.actions).length) lines.push('- None');
  lines.push(
    '',
    '## Blocked Rows',
    '',
  );

  for (const row of report.blockedRows) {
    lines.push(`- ${row.domain} / ${row.label}: ${row.nextAction || row.detail}`);
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
