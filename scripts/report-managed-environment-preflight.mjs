import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readArg(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  return process.argv.includes(name) ? '1' : '';
}

function configured(name) {
  return String(process.env[name] || '').trim().length > 0;
}

function configuredNames(names = []) {
  return names.filter((name) => configured(name));
}

function endpointClass(value = '') {
  if (!value) return 'missing';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(host)) return 'local';
    if (url.protocol !== 'https:') return 'non-https';
    return 'external-https';
  } catch {
    return 'invalid';
  }
}

function envRow({ id, domain, label, ready, detail, requiredEnvVars = [], anyOfEnvVarGroups = [], nextAction }) {
  return {
    id,
    domain,
    label,
    ready: Boolean(ready),
    status: ready ? 'ready' : 'blocked',
    detail,
    requiredEnvVars,
    anyOfEnvVarGroups,
    configuredEnvVars: configuredNames(requiredEnvVars),
    configuredAnyOfGroups: anyOfEnvVarGroups.map((group) => configuredNames(group)),
    nextAction,
  };
}

async function safeFetchJson(url, { token, timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { schemaVersion: 'invalid-json' };
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, errorName: error?.name || 'FetchError' };
  } finally {
    clearTimeout(timer);
  }
}

function redactHealth(body = {}) {
  return {
    schemaVersion: body.schemaVersion || null,
    capabilityCount: Array.isArray(body.capabilities) ? body.capabilities.length : 0,
    hasPersistenceCapability: Array.isArray(body.capabilities)
      ? body.capabilities.includes('managed-persistence-adapter-contract/v2')
      : false,
    hasQueueCapability: Array.isArray(body.capabilities)
      ? body.capabilities.includes('worker-queue-adapter-contract/v1')
      : false,
    storageDriver: body.storageAdapter?.driver || null,
  };
}

function redactState(body = {}) {
  return {
    schemaVersion: body.schemaVersion || null,
    storageDriver: body.storageAdapter?.driver || null,
    persistenceDryRunCount: body.persistence?.dryRunCount || 0,
    workerQueueDryRunCount: body.workerQueue?.dryRunCount || 0,
    tableRecordCount: body.persistence?.tableRecordCount || 0,
    queueRowCount: body.workerQueue?.queueRowCount || 0,
    leaseCount: body.workerQueue?.leaseCount || 0,
  };
}

export async function buildManagedEnvironmentPreflightReport() {
  const checkNetwork = Boolean(readArg('--check-network'));
  const gatewayEndpoint = process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT || '';
  const gatewayClass = endpointClass(gatewayEndpoint);
  const persistenceEndpointClass = endpointClass(process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT || process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT || '');
  const queueEndpointClass = endpointClass(process.env.WORKER_QUEUE_HTTP_ENDPOINT || process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT || '');
  const timeoutMs = Number(process.env.ADAPTER_GATEWAY_TIMEOUT_MS || 8000);

  const rows = [
    envRow({
      id: 'external-adapter-gateway',
      domain: 'control-plane',
      label: 'External private adapter gateway endpoint',
      ready: gatewayClass === 'external-https',
      detail: `Gateway endpoint class: ${gatewayClass}.`,
      requiredEnvVars: ['ADAPTER_GATEWAY_HTTP_ENDPOINT'],
      nextAction: 'Configure an external HTTPS private adapter gateway endpoint, not localhost or an in-process rehearsal URL.',
    }),
    envRow({
      id: 'adapter-gateway-auth',
      domain: 'control-plane',
      label: 'Adapter gateway bearer authentication',
      ready: configured('ADAPTER_GATEWAY_AUTH_TOKEN'),
      detail: configured('ADAPTER_GATEWAY_AUTH_TOKEN') ? 'Bearer auth token is configured.' : 'Bearer auth token is missing.',
      requiredEnvVars: ['ADAPTER_GATEWAY_AUTH_TOKEN'],
      nextAction: 'Configure ADAPTER_GATEWAY_AUTH_TOKEN for the private adapter gateway.',
    }),
    envRow({
      id: 'managed-persistence-real-adapter',
      domain: 'infrastructure',
      label: 'Managed persistence real adapter requirement',
      ready: configured('MANAGED_PERSISTENCE_ADAPTER_DRIVER')
        && String(process.env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER || '').toLowerCase() === 'true'
        && ['external-https', 'non-https'].includes(persistenceEndpointClass),
      detail: `Persistence endpoint class: ${persistenceEndpointClass}.`,
      requiredEnvVars: ['MANAGED_PERSISTENCE_ADAPTER_DRIVER', 'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER'],
      anyOfEnvVarGroups: [['MANAGED_PERSISTENCE_DATABASE_URL', 'MANAGED_PERSISTENCE_HTTP_ENDPOINT', 'ADAPTER_GATEWAY_HTTP_ENDPOINT']],
      nextAction: 'Use a real managed persistence adapter and require real adapter mode before public production.',
    }),
    envRow({
      id: 'managed-worker-queue-real-adapter',
      domain: 'infrastructure',
      label: 'Durable worker queue real adapter requirement',
      ready: configured('WORKER_QUEUE_ADAPTER_DRIVER')
        && String(process.env.WORKER_QUEUE_REQUIRE_REAL_ADAPTER || '').toLowerCase() === 'true'
        && ['external-https', 'non-https'].includes(queueEndpointClass),
      detail: `Queue endpoint class: ${queueEndpointClass}.`,
      requiredEnvVars: ['WORKER_QUEUE_ADAPTER_DRIVER', 'WORKER_QUEUE_REQUIRE_REAL_ADAPTER'],
      anyOfEnvVarGroups: [['WORKER_QUEUE_HTTP_ENDPOINT', 'ADAPTER_GATEWAY_HTTP_ENDPOINT']],
      nextAction: 'Use a durable worker queue adapter and require real adapter mode before public production.',
    }),
    envRow({
      id: 'managed-production-attestation-signing',
      domain: 'control-plane',
      label: 'Managed-production attestation signing',
      ready: configured('MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET') || configured('PRODUCTION_ATTESTATION_SIGNING_SECRET'),
      detail: configured('MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET') || configured('PRODUCTION_ATTESTATION_SIGNING_SECRET')
        ? 'Attestation signing secret is configured.'
        : 'Attestation signing secret is missing.',
      anyOfEnvVarGroups: [['MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET', 'PRODUCTION_ATTESTATION_SIGNING_SECRET']],
      nextAction: 'Configure managed-production attestation signing so gateway receipts can become managed-production evidence.',
    }),
    envRow({
      id: 'network-health-check',
      domain: 'control-plane',
      label: 'Live gateway health/state network check',
      ready: false,
      detail: checkNetwork ? 'Network check requested; results pending.' : 'Network check not requested.',
      requiredEnvVars: ['ADAPTER_GATEWAY_HTTP_ENDPOINT', 'ADAPTER_GATEWAY_AUTH_TOKEN'],
      nextAction: 'Run with --check-network after configuring an external private gateway.',
    }),
  ];

  const network = {
    requested: checkNetwork,
    status: checkNetwork ? 'blocked' : 'skipped',
    healthReady: false,
    stateReady: false,
    managedStorageReady: false,
    summary: null,
  };

  if (checkNetwork && gatewayClass === 'external-https' && configured('ADAPTER_GATEWAY_AUTH_TOKEN')) {
    const baseUrl = gatewayEndpoint.replace(/\/+$/, '');
    const health = await safeFetchJson(`${baseUrl}/health`, { token: process.env.ADAPTER_GATEWAY_AUTH_TOKEN, timeoutMs });
    const state = await safeFetchJson(`${baseUrl}/state`, { token: process.env.ADAPTER_GATEWAY_AUTH_TOKEN, timeoutMs });
    const healthSummary = redactHealth(health.body);
    const stateSummary = redactState(state.body);
    network.healthReady = Boolean(
      health.ok
      && healthSummary.schemaVersion === 'adapter-gateway-health/v1'
      && healthSummary.hasPersistenceCapability
      && healthSummary.hasQueueCapability
    );
    network.stateReady = Boolean(state.ok && stateSummary.storageDriver);
    network.managedStorageReady = Boolean(
      network.stateReady
      && !['memory', 'json-file', 'local-shadow'].includes(String(stateSummary.storageDriver || '').toLowerCase())
    );
    network.status = network.healthReady && network.stateReady && network.managedStorageReady ? 'ready' : 'blocked';
    network.summary = {
      healthStatus: health.status,
      stateStatus: state.status,
      health: healthSummary,
      state: stateSummary,
    };
  }

  const healthRow = rows.find((row) => row.id === 'network-health-check');
  if (healthRow) {
    healthRow.ready = network.status === 'ready';
    healthRow.status = healthRow.ready ? 'ready' : 'blocked';
    healthRow.detail = checkNetwork
      ? `Network check status: ${network.status}.`
      : 'Network check not requested.';
  }

  const blockedRows = rows.filter((row) => !row.ready);
  return {
    schemaVersion: 'managed-environment-preflight-report/v1',
    generatedAt: new Date().toISOString(),
    status: blockedRows.length ? 'managed-environment-blocked' : 'managed-environment-ready',
    readyForManagedEnvironment: blockedRows.length === 0,
    readyForPublicProduction: false,
    network,
    summary: {
      rowCount: rows.length,
      blockedRowCount: blockedRows.length,
      readyRowCount: rows.length - blockedRows.length,
      blockedDomains: [...new Set(blockedRows.map((row) => row.domain))].sort(),
      gatewayEndpointClass: gatewayClass,
      persistenceEndpointClass,
      queueEndpointClass,
    },
    validationCommands: [
      'npm run agents:managed-environment-preflight',
      'npm run launch:infra',
      'npm run agents:public-production-readiness-report',
    ],
    nextAction: blockedRows[0]
      ? {
        id: blockedRows[0].id,
        label: blockedRows[0].label,
        detail: blockedRows[0].nextAction,
      }
      : {
        id: 'run-public-production-startup-readiness',
        label: 'Run public production startup readiness',
        detail: 'Managed environment preflight is ready. Continue with public-production startup readiness and production launch control evidence.',
      },
    rows,
    blockedRows,
  };
}

export function formatManagedEnvironmentPreflightMarkdown(report) {
  const lines = [
    '# Managed Environment Preflight',
    '',
    `Status: ${report.status}`,
    `Ready for managed environment: ${report.readyForManagedEnvironment ? 'yes' : 'no'}`,
    `Ready for public production: ${report.readyForPublicProduction ? 'yes' : 'no'}`,
    `Blocked rows: ${report.summary.blockedRowCount}/${report.summary.rowCount}`,
    `Blocked domains: ${report.summary.blockedDomains.join(', ') || 'none'}`,
    `Network check: ${report.network.status}`,
    '',
    '## Next Action',
    '',
    `- ${report.nextAction.label}: ${report.nextAction.detail}`,
    '',
    '## Blocked Rows',
    '',
  ];
  for (const row of report.blockedRows) {
    lines.push(`- ${row.domain} / ${row.label}: ${row.nextAction}`);
    const envNames = [...row.requiredEnvVars, ...row.anyOfEnvVarGroups.flat()];
    if (envNames.length) lines.push(`  Required env names: ${[...new Set(envNames)].join(', ')}`);
  }
  if (!report.blockedRows.length) lines.push('- None');
  lines.push('');
  lines.push('Values are intentionally omitted. Endpoint classes are reported without hosts, tokens, or credentials.');
  return `${lines.join('\n')}\n`;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  const report = await buildManagedEnvironmentPreflightReport();
  if ((readArg('--format') || 'json') === 'markdown') {
    process.stdout.write(formatManagedEnvironmentPreflightMarkdown(report));
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}
