import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAdapterGatewayServer } from '../src/agents/adapterGatewayServer.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const body = await response.json();
  return { status: response.status, body };
}

async function requestJson(url, options = {}) {
  return readJson(await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  }));
}

const root = fileURLToPath(new URL('../.tmp/adapter-gateway-http-mode-validation', import.meta.url));
mkdirSync(root, { recursive: true });

const storagePath = `${root}/adapter-gateway-store-${Date.now()}.json`;
const projectStorePath = `${root}/agent-project-store-${Date.now()}.json`;
const authToken = 'ADAPTER_GATEWAY_HTTP_MODE_VALIDATION_TOKEN';
const gateway = createAdapterGatewayServer({
  storageDriver: 'json-file',
  storagePath,
  authToken,
});
let projectServer = null;

const originalEnv = {
  ADAPTER_GATEWAY_HTTP_ENDPOINT: process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT,
  ADAPTER_GATEWAY_AUTH_TOKEN: process.env.ADAPTER_GATEWAY_AUTH_TOKEN,
  ADAPTER_GATEWAY_TIMEOUT_MS: process.env.ADAPTER_GATEWAY_TIMEOUT_MS,
  MANAGED_PERSISTENCE_ADAPTER_DRIVER: process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER,
  MANAGED_PERSISTENCE_HTTP_ENDPOINT: process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT,
  WORKER_QUEUE_ADAPTER_DRIVER: process.env.WORKER_QUEUE_ADAPTER_DRIVER,
  WORKER_QUEUE_HTTP_ENDPOINT: process.env.WORKER_QUEUE_HTTP_ENDPOINT,
};

try {
  const gatewayRuntime = await gateway.listen({ port: 0 });
  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = gatewayRuntime.url;
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = authToken;
  process.env.ADAPTER_GATEWAY_TIMEOUT_MS = '30000';
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'http-json';
  process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT = gatewayRuntime.url;
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = gatewayRuntime.url;

  projectServer = createAgentProjectHttpServer({ filePath: projectStorePath });
  const projectRuntime = await projectServer.listen({ port: 0 });
  const projectId = 'adapter_gateway_http_mode_project';
  const team = [
    { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
    { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
    { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
  ];
  const kickoff = await requestJson(`${projectRuntime.url}/projects/initiate`, {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      name: 'Adapter Gateway HTTP Mode Validation',
      brief: 'Validate Agent HTTP server adapter dry-runs through an env-configured private gateway endpoint.',
      team,
      selectedLeaderId: 'turing',
      reviewerId: 'curie',
    }),
  });
  assert(kickoff.status === 200 && kickoff.body.project?.id === projectId, 'HTTP API must create a gateway-mode validation project.');

  const persistence = await requestJson(`${projectRuntime.url}/projects/${projectId}/persistence-adapter-dry-run`);
  assert(persistence.status === 200, 'HTTP persistence adapter dry-run route must respond.');
  const persistenceDryRun = persistence.body.persistenceAdapterDryRun;
  assert(
    persistenceDryRun?.adapterExecution?.schemaVersion === 'managed-persistence-adapter-gateway-execution/v1',
    'HTTP persistence adapter dry-run must execute through the configured gateway endpoint.',
  );
  assert(
    persistenceDryRun.adapterExecution.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'HTTP persistence adapter dry-run must return the private gateway persistence receipt.',
  );
  assert(
    persistenceDryRun.adapterExecution.finalReceipt?.tableCounts?.projects >= 1,
    'HTTP persistence gateway receipt must include imported project rows.',
  );

  const workerQueue = await requestJson(`${projectRuntime.url}/projects/${projectId}/worker-queue-adapter-dry-run`);
  assert(workerQueue.status === 200, 'HTTP worker queue adapter dry-run route must respond.');
  const workerQueueDryRun = workerQueue.body.workerQueueAdapterDryRun;
  assert(
    workerQueueDryRun?.adapterExecution?.schemaVersion === 'worker-queue-adapter-gateway-execution/v1',
    'HTTP worker queue adapter dry-run must execute through the configured gateway endpoint.',
  );
  assert(
    workerQueueDryRun.adapterExecution.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'HTTP worker queue dry-run must return the private gateway queue receipt.',
  );
  assert(
    workerQueueDryRun.adapterExecution.finalReceipt?.queueRowCount > 0,
    'HTTP worker queue gateway receipt must include queue rows.',
  );

  const preflight = await requestJson(`${projectRuntime.url}/projects/${projectId}/adapter-gateway-preflight`);
  assert(preflight.status === 200, 'HTTP adapter gateway preflight route must respond.');
  const adapterGatewayPreflight = preflight.body.adapterGatewayPreflight;
  assert(
    adapterGatewayPreflight?.status === 'adapter-gateway-live-preflight-ready',
    'HTTP adapter gateway preflight must pass against the env-configured gateway endpoint.',
  );
  assert(adapterGatewayPreflight.liveGatewayReady === true, 'HTTP adapter gateway preflight must mark live gateway ready.');
  assert(adapterGatewayPreflight.privateGatewayReady === true, 'HTTP adapter gateway preflight must mark private gateway ready.');
  assert(adapterGatewayPreflight.productionCutoverReady === false, 'HTTP gateway-mode rehearsal must not claim production cutover.');
  assert(adapterGatewayPreflight.summary?.stateReadable === true, 'HTTP gateway-mode rehearsal must prove gateway state readability.');

  const gatewayState = await requestJson(`${gatewayRuntime.url}/state`, {
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(gatewayState.status === 200, 'Private adapter gateway state must be readable with bearer token.');
  assert(gatewayState.body.persistence.tableRecordCount > 0, 'Private adapter gateway state must persist table records from HTTP dry-run.');
  assert(gatewayState.body.workerQueue.queueRowCount > 0, 'Private adapter gateway state must persist queue rows from HTTP dry-run.');
  assert(gatewayState.body.workerQueue.leaseCount > 0, 'Private adapter gateway state must persist queue leases from HTTP dry-run.');

  const storeSnapshot = JSON.parse(readFileSync(storagePath, 'utf8'));
  assert(
    storeSnapshot.persistence.projects[projectId]?.latestReceiptChecksum,
    'Gateway store must persist HTTP-mode persistence receipt summary.',
  );
  assert(
    storeSnapshot.workerQueue.projects[projectId]?.latestReceiptChecksum,
    'Gateway store must persist HTTP-mode worker queue receipt summary.',
  );

  console.log('Adapter gateway HTTP mode validation passed.');
} finally {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  if (projectServer) await projectServer.close();
  await gateway.close();
}
