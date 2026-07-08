import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readArg(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function runJsonScript(args, { timeout = 180000 } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env },
    timeout,
  });
  if (result.status !== 0) {
    const output = result.stderr || result.stdout || `status=${result.status}`;
    throw new Error(`${args.join(' ')} failed: ${output}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${args.join(' ')} must emit JSON: ${error.message}`);
  }
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function compactStage(row = {}) {
  return {
    id: row.id || '',
    label: row.label || row.id || '',
    ready: Boolean(row.ready),
    status: row.status || (row.ready ? 'ready' : 'blocked'),
    route: row.route || '',
    proofCount: toArray(row.proofIds).length,
    detail: row.detail || '',
  };
}

function compactAction(action = {}) {
  return {
    id: action.id || '',
    source: action.source || '',
    domain: action.domain || 'unknown',
    label: action.label || action.id || '',
    status: action.status || 'blocked',
    nextAction: action.nextAction || '',
    apiPath: action.apiPath || '',
    validationCommand: action.validationCommand || '',
    requiredEnvVars: toArray(action.requiredEnvVars),
  };
}

export async function buildPrivateMvpLaunchPackage() {
  const zeroToAutonomy = runJsonScript([
    'scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs',
    '--report',
  ], { timeout: 180000 });
  const publicProduction = runJsonScript([
    'scripts/report-public-production-readiness.mjs',
  ], { timeout: 120000 });

  const localMvpReady = zeroToAutonomy.readyForLocalMvpTrial === true
    && zeroToAutonomy.summary?.readyStageCount === zeroToAutonomy.summary?.stageCount;
  const privatePilotDeliveryReady = zeroToAutonomy.readyForPrivatePilotDelivery === true;
  const publicProductionBlocked = publicProduction.readyForPublicProduction === false
    && zeroToAutonomy.readyForPublicProduction === false;
  const status = localMvpReady && privatePilotDeliveryReady && publicProductionBlocked
    ? 'private-mvp-ready-public-production-blocked'
    : 'private-mvp-launch-package-blocked';
  const publicActions = toArray(publicProduction.operatorActionPlan?.actions).map(compactAction);

  return {
    schemaVersion: 'private-mvp-launch-package/v1',
    generatedAt: new Date().toISOString(),
    status,
    decision: {
      localBackendMvp: localMvpReady ? 'ready' : 'blocked',
      controlledPrivatePilot: privatePilotDeliveryReady ? 'ready-for-rehearsal' : 'blocked',
      publicProduction: publicProductionBlocked ? 'no-go' : 'unsafe-claim-detected',
    },
    allowedClaims: [
      'Local backend MVP can run the generic product-team zero-to-autonomy chain.',
      'Controlled private-pilot rehearsal can use the generated proof package with operator supervision.',
      'Research Project remains a validation sample for generic product-team capability, not a research-only product.',
    ],
    forbiddenClaims: [
      'Do not claim public production readiness.',
      'Do not run unattended production traffic.',
      'Do not process unapproved sensitive customer data.',
      'Do not claim managed KMS, managed database, managed queue, centralized observability, or incident recovery are complete.',
    ],
    localMvpEvidence: {
      sourceReportSchema: zeroToAutonomy.schemaVersion,
      status: zeroToAutonomy.status,
      readyForLocalMvpTrial: Boolean(zeroToAutonomy.readyForLocalMvpTrial),
      readyForPrivatePilotDelivery: Boolean(zeroToAutonomy.readyForPrivatePilotDelivery),
      missionType: zeroToAutonomy.missionType,
      projectId: zeroToAutonomy.projectId,
      summary: zeroToAutonomy.summary || {},
      stageRows: toArray(zeroToAutonomy.stageRows).map(compactStage),
      artifactTypes: toArray(zeroToAutonomy.artifactTypes),
      backendRoutes: zeroToAutonomy.backendRoutes || {},
      redaction: zeroToAutonomy.redaction || {},
    },
    publicProductionNoGo: {
      sourceReportSchema: publicProduction.schemaVersion,
      status: publicProduction.status,
      readyForPublicProduction: Boolean(publicProduction.readyForPublicProduction),
      publicProductionStartupStatus: publicProduction.publicProductionStartupStatus,
      summary: publicProduction.summary || {},
      nextAction: publicProduction.operatorActionPlan?.nextAction || publicProduction.nextAction || null,
      blockedDomains: toArray(publicProduction.summary?.blockedDomains),
      blockedActionCount: publicActions.length,
      backendRoutes: publicProduction.backendRoutes || {},
      validationCommands: unique([
        ...toArray(publicProduction.validationCommands),
        ...toArray(publicProduction.operatorActionPlan?.validationCommands),
      ]),
      topActions: publicActions.slice(0, 8),
    },
    validationCommands: unique([
      'npm run agents:product-team:local-mvp',
      'npm run agents:real-user-zero-to-autonomy-report:validate',
      'npm run ui:settings-agents-server',
      'npm run ui:real-user-zero-to-autonomy',
      'npm run launch:local-mvp:check',
      'npm run launch:public-production:no-go',
      'npm run agents:public-production-readiness-report:validate',
      'npm run agents:private-mvp-launch-package:validate',
    ]),
  };
}

export function formatPrivateMvpLaunchPackageMarkdown(report) {
  const lines = [
    '# Private MVP Launch Package',
    '',
    `Status: ${report.status}`,
    `Local backend MVP: ${report.decision.localBackendMvp}`,
    `Controlled private pilot: ${report.decision.controlledPrivatePilot}`,
    `Public production: ${report.decision.publicProduction}`,
    '',
    '## Allowed Claims',
    '',
    ...report.allowedClaims.map((claim) => `- ${claim}`),
    '',
    '## Forbidden Claims',
    '',
    ...report.forbiddenClaims.map((claim) => `- ${claim}`),
    '',
    '## Local MVP Evidence',
    '',
    `- Source report: ${report.localMvpEvidence.sourceReportSchema}`,
    `- Status: ${report.localMvpEvidence.status}`,
    `- Mission type: ${report.localMvpEvidence.missionType}`,
    `- Ready stages: ${report.localMvpEvidence.summary.readyStageCount}/${report.localMvpEvidence.summary.stageCount}`,
    `- Generic artifact coverage: ${report.localMvpEvidence.summary.submittedArtifactTypeCount}/${report.localMvpEvidence.summary.requiredArtifactTypeCount}`,
    `- Provider usage proof rows: ${report.localMvpEvidence.summary.providerUsageCount}`,
    `- Provider receipt proof rows: ${report.localMvpEvidence.summary.providerReceiptCount}`,
    '',
    '## Stage Rows',
    '',
  ];
  for (const row of report.localMvpEvidence.stageRows) {
    lines.push(`- ${row.status} / ${row.label} (${row.route || 'no route'})`);
  }
  lines.push(
    '',
    '## Public Production No-Go',
    '',
    `- Source report: ${report.publicProductionNoGo.sourceReportSchema}`,
    `- Status: ${report.publicProductionNoGo.status}`,
    `- Ready for public production: ${report.publicProductionNoGo.readyForPublicProduction ? 'yes' : 'no'}`,
    `- Blocked setup rows: ${report.publicProductionNoGo.summary.blockedSetupRowCount}/${report.publicProductionNoGo.summary.setupRowCount}`,
    `- Blocked domains: ${report.publicProductionNoGo.blockedDomains.join(', ') || 'none'}`,
    '',
    '## Next Production Actions',
    '',
  );
  for (const action of report.publicProductionNoGo.topActions) {
    lines.push(`- ${action.domain} / ${action.label}: ${action.nextAction}`);
    if (action.validationCommand) lines.push(`  Validate: ${action.validationCommand}`);
  }
  if (!report.publicProductionNoGo.topActions.length) lines.push('- None');
  lines.push(
    '',
    '## Validation Commands',
    '',
    ...report.validationCommands.map((command) => `- ${command}`),
    '',
    'This package is intentionally a private-MVP launch artifact. It must not be used as public-production approval.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const report = await buildPrivateMvpLaunchPackage();
  const format = readArg('--format') || 'json';
  if (format === 'markdown') {
    process.stdout.write(formatPrivateMvpLaunchPackageMarkdown(report));
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
