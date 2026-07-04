import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAdapterGatewayServer } from '../src/agents/adapterGatewayServer.js';
import { verifyHttpJsonAdapterGateway } from '../src/agents/adapterGatewayClient.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const root = fileURLToPath(new URL('../.tmp/adapter-gateway-server-validation', import.meta.url));
mkdirSync(root, { recursive: true });
const storagePath = `${root}/adapter-gateway-store-${Date.now()}.json`;
const preserveTmp = process.env.HOFS_ADAPTER_GATEWAY_PRESERVE_TMP === '1';
function cleanupTmp() {
  if (!preserveTmp) {
    rmSync(root, { recursive: true, force: true });
  }
}
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
  process.once(signal, () => {
    cleanupTmp();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
});
const authToken = 'ADAPTER_GATEWAY_VALIDATION_TOKEN';
const gateway = createAdapterGatewayServer({
  storageDriver: 'json-file',
  storagePath,
  authToken,
});

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
  const runtime = await gateway.listen({ port: 0 });
  const healthResponse = await fetch(`${runtime.url}/health`, {
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(healthResponse.status === 200, 'Adapter gateway health must be readable with bearer token.');
  const health = await healthResponse.json();
  assert(
    health.storageAdapter?.schemaVersion === 'adapter-gateway-storage-adapter-status/v1',
    'Adapter gateway health must expose the storage adapter status contract.'
  );
  assert(
    health.storageAdapter.driver === 'json-file',
    'Adapter gateway validation must run against the json-file storage adapter.'
  );
  const denied = await fetch(`${runtime.url}/persistence/dry-run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId: 'unauthorized_probe' }),
  });
  assert(denied.status === 401, 'Adapter gateway server must reject missing bearer token when configured.');

  const verification = await verifyHttpJsonAdapterGateway({
    baseUrl: runtime.url,
    projectId: 'adapter-gateway-server-probe',
    timeoutMs: 30000,
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(verification.status === 'passed', 'Adapter gateway server must satisfy the shared gateway contract.');
  assert(
    verification.persistenceReceipt.engine === 'local-private-file-adapter-gateway',
    'Persistence receipt must come from the reference local private gateway.'
  );
  assert(
    verification.workerQueueReceipt.engine === 'local-private-file-adapter-gateway',
    'Worker queue receipt must come from the reference local private gateway.'
  );

  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = runtime.url;
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = authToken;
  process.env.ADAPTER_GATEWAY_TIMEOUT_MS = '30000';
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'http-json';
  process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT = runtime.url;
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = runtime.url;

  const service = createAgentProjectService();
  const api = createAgentProjectApi({ service });
  const team = [
    { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
    { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
    { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
    { id: 'da_vinci', name: 'Leonardo da Vinci', title: 'Brainstorm Synthesizer' },
  ];
  const projectId = 'adapter_gateway_server_validation_project';
  const kickoff = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId,
      name: 'Adapter Gateway Server Validation',
      brief: 'Validate a deployable private adapter gateway process for persistence and queue dry-runs.',
      team,
      selectedLeaderId: 'turing',
      reviewerId: 'curie',
    },
  });
  assert(kickoff.status === 200 && kickoff.body.project?.id === projectId, 'API must create a gateway server validation project.');

  const persistence = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
  });
  assert(persistence.status === 200, 'Persistence adapter API dry-run route must respond.');
  const persistenceDryRun = persistence.body.persistenceAdapterDryRun;
  assert(
    persistenceDryRun?.adapterExecution?.schemaVersion === 'managed-persistence-adapter-gateway-execution/v1',
    'Persistence adapter API dry-run must use the gateway execution path.'
  );
  assert(
    persistenceDryRun.adapterExecution.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'Persistence adapter API dry-run must return the reference gateway persistence receipt.'
  );
  assert(
    persistenceDryRun.adapterExecution.finalReceipt?.tableCounts?.projects >= 1,
    'Persistence gateway receipt must include imported project rows.'
  );

  const workerQueue = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/worker-queue-adapter-dry-run`,
  });
  assert(workerQueue.status === 200, 'Worker queue adapter API dry-run route must respond.');
  const workerQueueDryRun = workerQueue.body.workerQueueAdapterDryRun;
  assert(
    workerQueueDryRun?.adapterExecution?.schemaVersion === 'worker-queue-adapter-gateway-execution/v1',
    'Worker queue adapter API dry-run must use the gateway execution path.'
  );
  assert(
    workerQueueDryRun.adapterExecution.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'Worker queue adapter API dry-run must return the reference gateway queue receipt.'
  );
  assert(
    workerQueueDryRun.adapterExecution.finalReceipt?.queueRowCount > 0,
    'Worker queue gateway receipt must include queue rows.'
  );

  const gatewayPreflightResponse = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/adapter-gateway-preflight`,
  });
  assert(gatewayPreflightResponse.status === 200, 'Adapter gateway preflight API route must respond.');
  const adapterGatewayPreflight = gatewayPreflightResponse.body.adapterGatewayPreflight;
  assert(
    adapterGatewayPreflight?.schemaVersion === 'adapter-gateway-preflight/v1',
    'Adapter gateway preflight API route must expose the preflight contract.'
  );
  assert(
    adapterGatewayPreflight.status === 'adapter-gateway-live-preflight-ready',
    'Adapter gateway preflight must pass when the reference private gateway is live.'
  );
  assert(adapterGatewayPreflight.liveGatewayReady === true, 'Adapter gateway preflight must mark the live gateway ready.');
  assert(adapterGatewayPreflight.privateGatewayReady === true, 'Adapter gateway preflight must mark private gateway readiness.');
  assert(adapterGatewayPreflight.productionCutoverReady === false, 'Adapter gateway preflight must not approve production cutover.');
  assert(adapterGatewayPreflight.summary?.stateReadable === true, 'Adapter gateway preflight must prove the state endpoint is readable.');
  assert(adapterGatewayPreflight.health?.capabilities?.includes('managed-persistence-adapter-contract/v2'), 'Adapter gateway preflight must expose managed persistence capability.');
  assert(adapterGatewayPreflight.health?.capabilities?.includes('worker-queue-adapter-contract/v1'), 'Adapter gateway preflight must expose worker queue capability.');
  assert(adapterGatewayPreflight.state?.storageAdapter?.driver === 'json-file', 'Adapter gateway preflight must expose the json-file state storage adapter.');

  const stateResponse = await fetch(`${runtime.url}/state`, {
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(stateResponse.status === 200, 'Adapter gateway state summary must be readable with bearer token.');
  const stateSummary = await stateResponse.json();
  assert(
    stateSummary.storageAdapter?.schemaVersion === 'adapter-gateway-storage-adapter-status/v1',
    'Adapter gateway state summary must expose the storage adapter status contract.'
  );
  assert(stateSummary.storageAdapter.driver === 'json-file', 'Adapter gateway state summary must identify the json-file storage adapter.');
  assert(stateSummary.persistence.dryRunCount >= 2, 'Adapter gateway must persist persistence dry-run summaries.');
  assert(stateSummary.workerQueue.dryRunCount >= 2, 'Adapter gateway must persist worker queue dry-run summaries.');
  assert(stateSummary.persistence.tableRecordCount > 0, 'Adapter gateway state summary must expose persisted table record counts.');
  assert(stateSummary.workerQueue.queueRowCount > 0, 'Adapter gateway state summary must expose persisted queue row counts.');
  assert(stateSummary.workerQueue.leaseCount > 0, 'Adapter gateway state summary must expose persisted lease counts.');

  const storeSnapshot = JSON.parse(readFileSync(storagePath, 'utf8'));
  assert(
    storeSnapshot.persistence.projects[projectId]?.latestReceiptChecksum,
    'Adapter gateway store must persist the project persistence receipt summary.'
  );
  assert(
    storeSnapshot.persistence.tablesByProject[projectId]?.projects?.length >= 1,
    'Adapter gateway store must persist imported project table records.'
  );
  assert(
    storeSnapshot.persistence.projects[projectId]?.storedRecordCount > 0,
    'Adapter gateway store must persist imported table record counts.'
  );
  assert(
    storeSnapshot.workerQueue.projects[projectId]?.latestReceiptChecksum,
    'Adapter gateway store must persist the project queue receipt summary.'
  );
  assert(
    Object.keys(storeSnapshot.workerQueue.rowsByProject[projectId] || {}).length > 0,
    'Adapter gateway store must persist imported queue rows.'
  );
  assert(
    Object.keys(storeSnapshot.workerQueue.leasesByProject[projectId] || {}).length > 0,
    'Adapter gateway store must persist durable queue lease records.'
  );
  assert(
    storeSnapshot.workerQueue.projects[projectId]?.storedQueueRowCount > 0,
    'Adapter gateway project queue summary must expose persisted queue row count.'
  );

  console.log('Adapter gateway server validation passed.');
} finally {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  await gateway.close();
  cleanupTmp();
}
