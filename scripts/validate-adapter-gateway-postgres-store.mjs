import { createAdapterGatewayServer } from '../src/agents/adapterGatewayServer.js';
import { createAdapterGatewayPostgresStore } from '../src/agents/adapterGatewayStore.js';
import { verifyHttpJsonAdapterGateway } from '../src/agents/adapterGatewayClient.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const capturedOperations = [];
const fakeDatabase = {
  tableRecords: new Map(),
  queueRows: new Map(),
  queueLeases: new Map(),
  deadLetters: new Map(),
  dryRuns: new Map(),
  snapshots: [],
};

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

const query = async (text, values, operation) => {
  capturedOperations.push({
    name: operation.name,
    checksum: operation.checksum,
    text,
    valueCount: values.length,
  });
  if (operation.name === 'upsert-table-record') {
    fakeDatabase.tableRecords.set(`${values[0]}:${values[1]}:${values[2]}`, parseJson(values[3]));
  }
  if (operation.name === 'upsert-queue-row') {
    fakeDatabase.queueRows.set(`${values[0]}:${values[1]}`, parseJson(values[2]));
  }
  if (operation.name === 'upsert-queue-lease') {
    fakeDatabase.queueLeases.set(`${values[0]}:${values[1]}`, parseJson(values[3]));
  }
  if (operation.name === 'upsert-dead-letter') {
    fakeDatabase.deadLetters.set(`${values[0]}:${values[1]}`, parseJson(values[2]));
  }
  if (operation.name === 'insert-persistence-dry-run') {
    fakeDatabase.dryRuns.set(values[0], { kind: 'persistence', receipt: parseJson(values[2]) });
  }
  if (operation.name === 'insert-worker-queue-dry-run') {
    fakeDatabase.dryRuns.set(values[0], { kind: 'worker-queue', receipt: parseJson(values[2]) });
  }
  if (operation.name === 'insert-state-snapshot') {
    fakeDatabase.snapshots.push({
      snapshotId: values[0],
      state: parseJson(values[1]),
      stateChecksum: values[2],
    });
  }
  if (operation.name === 'readback-state-snapshot') {
    const latest = fakeDatabase.snapshots.at(-1);
    return latest
      ? { rowCount: 1, rows: [{ state: latest.state, stateChecksum: latest.stateChecksum }] }
      : { rowCount: 0, rows: [] };
  }
  if (operation.name === 'readback-store-counts') {
    return {
      rowCount: 1,
      rows: [{
        tableRecordCount: fakeDatabase.tableRecords.size,
        queueRowCount: fakeDatabase.queueRows.size,
        leaseCount: fakeDatabase.queueLeases.size,
        deadLetterCount: fakeDatabase.deadLetters.size,
        persistenceDryRunCount: [...fakeDatabase.dryRuns.values()].filter((row) => row.kind === 'persistence').length,
        workerQueueDryRunCount: [...fakeDatabase.dryRuns.values()].filter((row) => row.kind === 'worker-queue').length,
      }],
    };
  }
  return { rowCount: 1, rows: [] };
};

const authToken = 'ADAPTER_GATEWAY_POSTGRES_VALIDATION_TOKEN';
const storeAdapter = createAdapterGatewayPostgresStore({
  databaseUrl: 'postgres://gateway_user:secret_password@localhost:5432/hofs',
  schema: 'hofs_gateway_validation',
  query,
});
const gateway = createAdapterGatewayServer({
  storeAdapter,
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
  assert(healthResponse.status === 200, 'Postgres gateway health must be readable with bearer token.');
  const health = await healthResponse.json();
  assert(health.storageAdapter?.driver === 'postgres', 'Gateway health must identify the postgres storage adapter.');
  assert(health.storageAdapter.queryBound === true, 'Postgres validation must run with a query-bound adapter.');
  assert(
    health.storageAdapter.schemaPlan?.schemaVersion === 'adapter-gateway-postgres-schema-plan/v1',
    'Postgres storage adapter must expose the schema plan contract.'
  );
  assert(
    health.storageAdapter.schemaPlan.tableCount === health.storageAdapter.schemaPlan.tables.length,
    'Postgres schema plan tableCount must match the declared table list.'
  );
  assert(
    !String(health.storageAdapter.storage?.path || '').includes('secret_password'),
    'Postgres storage adapter status must redact database credentials.'
  );
  assert(
    health.storageAdapter.storage?.schema === 'hofs_gateway_validation',
    'Postgres storage adapter status must expose the selected safe schema.'
  );

  const verification = await verifyHttpJsonAdapterGateway({
    baseUrl: runtime.url,
    projectId: 'adapter-gateway-postgres-probe',
    timeoutMs: 30000,
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(verification.status === 'passed', 'Postgres-backed gateway must satisfy the shared gateway contract.');

  process.env.ADAPTER_GATEWAY_HTTP_ENDPOINT = runtime.url;
  process.env.ADAPTER_GATEWAY_AUTH_TOKEN = authToken;
  process.env.ADAPTER_GATEWAY_TIMEOUT_MS = '30000';
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'http-json';
  process.env.MANAGED_PERSISTENCE_HTTP_ENDPOINT = runtime.url;
  process.env.WORKER_QUEUE_ADAPTER_DRIVER = 'http-json';
  process.env.WORKER_QUEUE_HTTP_ENDPOINT = runtime.url;

  const service = createAgentProjectService();
  const api = createAgentProjectApi({ service });
  const projectId = 'adapter_gateway_postgres_store_validation_project';
  const kickoff = await api.handleAsync({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      projectId,
      name: 'Adapter Gateway Postgres Store Validation',
      brief: 'Validate that the private adapter gateway can emit Postgres-compatible schema and write operations.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', title: 'Product Visionary' },
        { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
        { id: 'turing', name: 'Alan Turing', title: 'System Architect' },
      ],
      selectedLeaderId: 'turing',
      reviewerId: 'curie',
    },
  });
  assert(kickoff.status === 200 && kickoff.body.project?.id === projectId, 'API must create a postgres store validation project.');

  const persistence = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/persistence-adapter-dry-run`,
  });
  assert(persistence.status === 200, 'Persistence adapter route must execute through the postgres-backed gateway.');
  assert(
    persistence.body.persistenceAdapterDryRun?.adapterExecution?.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'Persistence adapter route must return the reference gateway persistence receipt.'
  );

  const workerQueue = await api.handleAsync({
    method: 'GET',
    path: `/projects/${projectId}/worker-queue-adapter-dry-run`,
  });
  assert(workerQueue.status === 200, 'Worker queue route must execute through the postgres-backed gateway.');
  assert(
    workerQueue.body.workerQueueAdapterDryRun?.adapterExecution?.finalReceipt?.engine === 'local-private-file-adapter-gateway',
    'Worker queue route must return the reference gateway queue receipt.'
  );

  const operationNames = new Set(capturedOperations.map((operation) => operation.name));
  [
    'schema-plan',
    'upsert-persistence-project-summary',
    'upsert-queue-project-summary',
    'upsert-table-record',
    'upsert-queue-row',
    'upsert-queue-lease',
    'insert-persistence-dry-run',
    'insert-worker-queue-dry-run',
    'insert-state-snapshot',
    'readback-state-snapshot',
    'readback-store-counts',
  ].forEach((name) => {
    assert(operationNames.has(name), `Postgres store validation must emit operation: ${name}.`);
  });

  const stateResponse = await fetch(`${runtime.url}/state`, {
    headers: {
      authorization: `Bearer ${authToken}`,
    },
  });
  assert(stateResponse.status === 200, 'Postgres gateway state summary must be readable with bearer token.');
  const stateSummary = await stateResponse.json();
  assert(stateSummary.storageAdapter?.driver === 'postgres', 'State summary must identify the postgres storage adapter.');
  assert(stateSummary.storageAdapter.latestExecution?.queryBound === true, 'State summary must include the latest query-bound execution.');
  assert(stateSummary.storageAdapter.latestExecution?.failedOperationCount === 0, 'Postgres write execution must not fail.');
  assert(
    stateSummary.storageAdapter.latestReadback?.schemaVersion === 'adapter-gateway-postgres-readback/v1',
    'Postgres state summary must expose the latest readback receipt.'
  );
  assert(stateSummary.storageAdapter.latestReadback?.snapshotParityReady === true, 'Postgres readback must prove snapshot parity.');
  assert(stateSummary.storageAdapter.latestReadback?.countParityReady === true, 'Postgres readback must prove table/queue count parity.');
  assert(stateSummary.storageAdapter.latestReadback?.parityReady === true, 'Postgres readback must prove full parity readiness.');
  assert(stateSummary.persistence.tableRecordCount > 0, 'Postgres store state summary must expose persisted table records.');
  assert(stateSummary.workerQueue.queueRowCount > 0, 'Postgres store state summary must expose persisted queue rows.');
  assert(stateSummary.workerQueue.leaseCount > 0, 'Postgres store state summary must expose persisted queue leases.');

  console.log('Adapter gateway postgres store validation passed.');
} finally {
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  await gateway.close();
}
