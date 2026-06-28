import { createServer } from 'node:http';
import { verifyHttpJsonAdapterGateway } from '../src/agents/adapterGatewayClient.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksum(value) {
  const text = stableJson(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

function writeJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function receipt(schemaVersion, body) {
  const row = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    productionCutoverReady: false,
    ...body,
  };
  row.checksum = checksum(row);
  return row;
}

function createMockAdapterGateway() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/health') {
        writeJson(response, 200, {
          schemaVersion: 'adapter-gateway-health/v1',
          status: 'mock-ready-production-blocked',
          productionCutoverReady: false,
          capabilities: [
            'managed-persistence-adapter-contract/v2',
            'worker-queue-adapter-contract/v1',
          ],
          requiredApproval: [
            'real managed database backup restore drill',
            'real durable queue lease and dead-letter drill',
          ],
        });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/persistence/dry-run') {
        const body = await readBody(request);
        const tableCounts = Object.fromEntries(Object.entries(body.recordsByTable || {})
          .map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
        writeJson(response, 200, receipt('managed-persistence-adapter-execution-receipt/v1', {
          projectId: body.projectId || null,
          engine: 'mock-http-json-managed-persistence-gateway',
          operationCount: 7,
          tableCounts,
          shadowReadGroupCount: body.shadowReadPlan?.length || 0,
          receipts: [
            { operation: 'connect' },
            { operation: 'createSchema', tablePlanCount: body.tablePlans?.length || 0 },
            { operation: 'importBatch', tableCount: Object.keys(tableCounts).length },
            { operation: 'verifyChecksums' },
            { operation: 'createBackup' },
            { operation: 'compareShadowRead' },
            { operation: 'rollbackCutover' },
          ],
        }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/worker-queue/dry-run') {
        const body = await readBody(request);
        const snapshot = body.workerQueueSnapshot || {};
        const rows = [
          ...(snapshot.projectQueue || []),
          ...(snapshot.agentQueue || []),
        ];
        writeJson(response, 200, receipt('worker-queue-adapter-execution-receipt/v1', {
          projectId: body.projectId || null,
          engine: 'mock-http-json-worker-queue-gateway',
          operationCount: 5,
          queueRowCount: rows.length,
          dueRowCount: rows.filter((row) => row.due).length,
          leaseCount: rows.filter((row) => row.idempotencyKey && row.leaseKey).length,
          receipts: [
            { operation: 'enqueueDueRows', rowCount: rows.length },
            { operation: 'acquireLease' },
            { operation: 'dispatchWorker' },
            { operation: 'ackExecutionReceipt' },
            { operation: 'inspectQueue' },
          ],
        }));
        return;
      }
      writeJson(response, 404, { error: 'mock-adapter-gateway-not-found' });
    } catch (error) {
      writeJson(response, 500, {
        error: 'mock-adapter-gateway-error',
        message: error.message || String(error),
      });
    }
  });
  return server;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const server = createMockAdapterGateway();
const baseUrl = await listen(server);
let apiServer = null;
const originalEnv = {
  ADAPTER_GATEWAY_HTTP_ENDPOINT: process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT,
  ADAPTER_GATEWAY_TIMEOUT_MS: process.env.ADAPTER_GATEWAY_TIMEOUT_MS,
  MANAGED_PERSISTENCE_ADAPTER_DRIVER: process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER,
  MANAGED_PERSISTENCE_HTTP_ENDPOINT: process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT,
  WORKER_QUEUE_ADAPTER_DRIVER: process.env.WORKER_QUEUE_ADAPTER_DRIVER,
  WORKER_QUEUE_HTTP_ENDPOINT: process.env.WORKER_QUEUE_HTTP_ENDPOINT,
};
try {
  const verification = await verifyHttpJsonAdapterGateway({
    baseUrl,
    projectId: 'adapter-gateway-contract-validation',
  });
  if (verification.status !== 'passed') {
    throw new Error(`Adapter gateway verification did not pass: ${verification.status}`);
  }
  apiServer = createMockAdapterGateway();
  const apiBaseUrl = await listen(apiServer);
  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = apiBaseUrl;
  process.env.ADAPTER_GATEWAY_TIMEOUT_MS = '30000';
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'http-json';
  process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT = apiBaseUrl;
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = apiBaseUrl;

  const service = createAgentProjectService();
  const api = createAgentProjectApi({ service });
  const team = [
    { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
    { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
    { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
  ];
  const projectId = 'adapter_gateway_api_validation_project';
  const kickoff = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId,
      name: 'Adapter Gateway API Validation',
      brief: 'Validate that backend project dry-run routes can execute the shared http-json adapter gateway contract.',
      team,
      selectedLeaderId: 'turing',
      reviewerId: 'curie',
    },
  });
  assert(kickoff.status === 200 && kickoff.body.project?.id === projectId, 'API must create a gateway validation project.');

  const persistence = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
  });
  assert(persistence.status === 200, 'Persistence adapter API dry-run route must respond.');
  assert(
    persistence.body.persistenceAdapterDryRun?.adapterExecution?.schemaVersion === 'managed-persistence-adapter-gateway-execution/v1',
    'Persistence adapter API dry-run must execute through the http-json gateway path.'
  );
  assert(
    persistence.body.persistenceAdapterDryRun.adapterExecution.finalReceipt?.engine === 'mock-http-json-managed-persistence-gateway',
    `Persistence adapter API dry-run must include the gateway persistence receipt, got ${persistence.body.persistenceAdapterDryRun.adapterExecution.finalReceipt?.engine || 'missing'}; error ${persistence.body.persistenceAdapterDryRun.adapterExecution.error?.message || 'none'}; cause ${persistence.body.persistenceAdapterDryRun.adapterExecution.error?.cause || 'none'}.`
  );

  const workerQueue = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/worker-queue-adapter-dry-run`,
  });
  assert(workerQueue.status === 200, 'Worker queue adapter API dry-run route must respond.');
  assert(
    workerQueue.body.workerQueueAdapterDryRun?.adapterExecution?.schemaVersion === 'worker-queue-adapter-gateway-execution/v1',
    'Worker queue adapter API dry-run must execute through the http-json gateway path.'
  );
  assert(
    workerQueue.body.workerQueueAdapterDryRun.adapterExecution.finalReceipt?.engine === 'mock-http-json-worker-queue-gateway',
    'Worker queue adapter API dry-run must include the gateway worker queue receipt.'
  );
  console.log('Adapter gateway contract validation passed.');
} finally {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  if (apiServer) await close(apiServer);
  await close(server);
}
