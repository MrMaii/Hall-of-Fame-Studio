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

function trimSlash(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayUrl(baseUrl, path) {
  return `${trimSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      schemaVersion: 'adapter-gateway-invalid-json/v1',
      textPreview: text.slice(0, 240),
    };
  }
}

function assertGatewayShape(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

export function createHttpJsonAdapterGatewayClient({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  headers = {},
} = {}) {
  if (!baseUrl) throw new Error('createHttpJsonAdapterGatewayClient requires baseUrl.');
  if (typeof fetchImpl !== 'function') throw new Error('createHttpJsonAdapterGatewayClient requires fetch.');

  const requestJson = async (path, { method = 'GET', body = null } = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(gatewayUrl(baseUrl, path), {
        method,
        headers: {
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = await readJsonResponse(response);
      return {
        ok: response.ok,
        status: response.status,
        body: json,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    schemaVersion: 'http-json-adapter-gateway-client/v1',
    baseUrl: trimSlash(baseUrl),
    async health() {
      return requestJson('/health');
    },
    async state() {
      return requestJson('/state');
    },
    async runPersistenceDryRun(payload = {}) {
      return requestJson('/persistence/dry-run', {
        method: 'POST',
        body: payload,
      });
    },
    async runWorkerQueueDryRun(payload = {}) {
      return requestJson('/worker-queue/dry-run', {
        method: 'POST',
        body: payload,
      });
    },
  };
}

export function buildAdapterGatewayProbePayloads({
  projectId = 'adapter-gateway-probe-project',
} = {}) {
  const persistenceRecordsByTable = {
    projects: [{
      id: projectId,
      projectId,
      data: { id: projectId, name: 'Adapter Gateway Probe' },
      refs: {},
      checksum: checksum({ table: 'projects', id: projectId }),
    }],
    project_event_ledger: [{
      id: `${projectId}_event_1`,
      projectId,
      data: { id: `${projectId}_event_1`, projectId, type: 'adapter-gateway-probe', sequence: 1 },
      refs: { projectId },
      checksum: checksum({ table: 'project_event_ledger', id: `${projectId}_event_1` }),
    }],
  };
  const workerQueueRows = [{
    id: `${projectId}_queue_1`,
    queue: 'project-autonomous',
    workerKind: 'project-autonomous',
    projectId,
    due: true,
    status: 'queued',
    idempotencyKey: `idem:${projectId}:1`,
    leaseKey: `lease:idem:${projectId}:1`,
    runApiPath: '/workers/autonomous/due',
    directRunApiPath: `/projects/${projectId}/autonomous-cycle`,
    requestBody: { projectId, forceDue: true },
  }];

  return {
    projectId,
    persistence: {
      schemaVersion: 'managed-persistence-http-json-probe/v1',
      projectId,
      tablePlans: [
        { table: 'projects', primaryKey: ['id'], rlsDraft: 'project member read; security-admin write' },
        { table: 'project_event_ledger', primaryKey: ['id'], rlsDraft: 'project member read; runtime append' },
      ],
      recordsByTable: persistenceRecordsByTable,
      shadowReadPlan: [
        { id: 'probe-project-state', tables: ['projects'] },
        { id: 'probe-event-ledger', tables: ['project_event_ledger'] },
      ],
    },
    workerQueue: {
      schemaVersion: 'worker-queue-http-json-probe/v1',
      projectId,
      workerQueueSnapshot: {
        schemaVersion: 'worker-queue-snapshot/v1',
        projectId,
        projectQueue: workerQueueRows,
        agentQueue: [],
        executionReceipts: [],
        deadLetterQueue: [],
        retryPolicy: {
          schemaVersion: 'worker-queue-retry-policy/v1',
          maxAttempts: 3,
          retryBackoffSeconds: [30, 120, 300],
        },
        deadLetterPolicy: {
          schemaVersion: 'worker-dead-letter-policy/v1',
          deadLetterAfterAttempts: 3,
        },
      },
    },
  };
}

export async function verifyHttpJsonAdapterGateway({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  projectId = 'adapter-gateway-probe-project',
  headers = {},
} = {}) {
  const client = createHttpJsonAdapterGatewayClient({ baseUrl, fetchImpl, timeoutMs, headers });
  const probePayloads = buildAdapterGatewayProbePayloads({ projectId });
  const health = await client.health();
  assertGatewayShape(health.ok, 'Adapter gateway health check failed.', { health });
  assertGatewayShape(
    health.body?.schemaVersion === 'adapter-gateway-health/v1',
    'Adapter gateway health response must use adapter-gateway-health/v1.',
    { health }
  );
  assertGatewayShape(
    (health.body.capabilities || []).includes('managed-persistence-adapter-contract/v2'),
    'Adapter gateway health must advertise managed-persistence-adapter-contract/v2.',
    { health }
  );
  assertGatewayShape(
    (health.body.capabilities || []).includes('worker-queue-adapter-contract/v1'),
    'Adapter gateway health must advertise worker-queue-adapter-contract/v1.',
    { health }
  );

  const persistence = await client.runPersistenceDryRun(probePayloads.persistence);
  assertGatewayShape(persistence.ok, 'Adapter gateway persistence dry-run failed.', { persistence });
  assertGatewayShape(
    persistence.body?.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1',
    'Persistence dry-run must return managed-persistence-adapter-execution-receipt/v1.',
    { persistence }
  );
  assertGatewayShape(
    persistence.body.productionCutoverReady === false,
    'Persistence gateway probe must not claim production cutover readiness.',
    { persistence }
  );
  assertGatewayShape(
    (persistence.body.operationCount || 0) >= 4,
    'Persistence gateway probe must execute multiple adapter operations.',
    { persistence }
  );

  const workerQueue = await client.runWorkerQueueDryRun(probePayloads.workerQueue);
  assertGatewayShape(workerQueue.ok, 'Adapter gateway worker queue dry-run failed.', { workerQueue });
  assertGatewayShape(
    workerQueue.body?.schemaVersion === 'worker-queue-adapter-execution-receipt/v1',
    'Worker queue dry-run must return worker-queue-adapter-execution-receipt/v1.',
    { workerQueue }
  );
  assertGatewayShape(
    workerQueue.body.productionCutoverReady === false,
    'Worker queue gateway probe must not claim production cutover readiness.',
    { workerQueue }
  );
  assertGatewayShape(
    (workerQueue.body.operationCount || 0) >= 3,
    'Worker queue gateway probe must execute multiple adapter operations.',
    { workerQueue }
  );

  return {
    schemaVersion: 'http-json-adapter-gateway-verification/v1',
    status: 'passed',
    projectId,
    baseUrl: client.baseUrl,
    health: health.body,
    persistenceReceipt: persistence.body,
    workerQueueReceipt: workerQueue.body,
    summary: {
      capabilityCount: health.body.capabilities?.length || 0,
      persistenceOperationCount: persistence.body.operationCount || 0,
      queueOperationCount: workerQueue.body.operationCount || 0,
      productionCutoverReady: Boolean(persistence.body.productionCutoverReady && workerQueue.body.productionCutoverReady),
    },
  };
}
