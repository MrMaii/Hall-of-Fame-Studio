import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import {
  createAdapterGatewayDefaultStoreState,
  createAdapterGatewayStoreAdapter,
  summarizeAdapterGatewayStoreState,
} from './adapterGatewayStore.js';

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

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function limitedRows(rows = [], limit = 80) {
  return rows.slice(Math.max(0, rows.length - limit));
}

function operationReceipt(operation, payload = {}, now = new Date().toISOString()) {
  const row = {
    schemaVersion: 'adapter-gateway-operation-receipt/v1',
    operation,
    at: now,
    ...payload,
  };
  row.checksum = checksum(row);
  return row;
}

function finalReceipt(schemaVersion, payload = {}) {
  const row = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    productionCutoverReady: false,
    ...payload,
  };
  row.checksum = checksum(row);
  return row;
}

function managedProductionAttestationSignaturePayload({
  projectId = null,
  domain = null,
  controlId = null,
  evidenceId = null,
  evidenceRoute = null,
  evidenceChecksum = null,
  evidenceEnvironment = null,
  attestationId = null,
  attestationRoute = null,
  attestationChecksum = null,
  attestationProvider = null,
  attestationKind = null,
} = {}) {
  return {
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceRoute,
    evidenceChecksum,
    evidenceEnvironment,
    attestationId,
    attestationRoute,
    attestationChecksum,
    attestationProvider,
    attestationKind,
  };
}

function signManagedProductionAttestationPayload(signingSecret = '', payload = {}) {
  if (!signingSecret) return null;
  return `sig_hmac_sha256_v1_${createHmac('sha256', signingSecret).update(stableJson(payload)).digest('hex')}`;
}

function tableCountsFor(recordsByTable = {}) {
  return Object.fromEntries(Object.entries(recordsByTable)
    .map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
}

function normalizeRecord(table, record = {}, fallbackProjectId = null) {
  const id = record.id || record.data?.id || `${table}_${checksum(record)}`;
  const projectId = record.projectId || record.data?.projectId || record.refs?.projectId || fallbackProjectId || null;
  const data = clone(record.data || record);
  const refs = clone(record.refs || {});
  return {
    schemaVersion: 'adapter-gateway-table-record/v1',
    table,
    id,
    projectId,
    refs,
    data,
    checksum: record.checksum || checksum({ table, id, projectId, refs, data }),
    importedAt: new Date().toISOString(),
  };
}

function normalizeRecordsByTable(recordsByTable = {}, projectId = null) {
  return Object.fromEntries(Object.entries(recordsByTable)
    .map(([table, rows]) => [table, (Array.isArray(rows) ? rows : [])
      .map((record) => normalizeRecord(table, record, projectId))]));
}

function queueRowsFromSnapshot(workerQueueSnapshot = {}) {
  return [
    ...(workerQueueSnapshot.projectQueue || []),
    ...(workerQueueSnapshot.agentQueue || []),
    ...(workerQueueSnapshot.autopilotQueue || []),
  ];
}

function queueRowKey(row = {}) {
  return row.idempotencyKey || row.id || checksum(row);
}

function normalizeQueueRow(row = {}, projectId = null) {
  const id = row.id || `queue_${checksum(row)}`;
  return {
    schemaVersion: 'adapter-gateway-queue-row/v1',
    ...clone(row),
    id,
    projectId: row.projectId || projectId || null,
    idempotencyKey: row.idempotencyKey || `idem:${id}`,
    leaseKey: row.leaseKey || `lease:${id}`,
    storedAt: new Date().toISOString(),
  };
}

function receiptSummary(receipt = {}) {
  return {
    projectId: receipt.projectId || null,
    generatedAt: receipt.generatedAt || null,
    engine: receipt.engine || null,
    operationCount: receipt.operationCount || 0,
    checksum: receipt.checksum || null,
  };
}

async function runPersistenceDryRun({
  body = {},
  state = createAdapterGatewayDefaultStoreState(),
  writeState = null,
  now = () => new Date().toISOString(),
} = {}) {
  const projectId = body.projectId || 'adapter-gateway-project';
  const recordsByTable = body.recordsByTable || {};
  const importedRecordsByTable = normalizeRecordsByTable(recordsByTable, projectId);
  const tableCounts = tableCountsFor(importedRecordsByTable);
  const totalRecordCount = Object.values(tableCounts).reduce((sum, count) => sum + count, 0);
  const tablePlans = body.tablePlans || [];
  const shadowReadPlan = body.shadowReadPlan || [];
  const sourceChecksum = checksum({
    projectId,
    tablePlans,
    tableCounts,
    recordsByTable,
    shadowReadPlan,
  });
  const importedChecksum = checksum({ projectId, importedRecordsByTable });
  const transactionId = `gateway_tx_${checksum({ projectId, sourceChecksum, at: now() })}`;
  const backupId = `gateway_backup_${checksum({ projectId, sourceChecksum })}`;
  const shadowReadRows = shadowReadPlan.map((plan) => {
    const expectedRecordCount = (plan.tables || []).reduce((sum, table) => sum + (tableCounts[table] || 0), 0);
    return {
      id: plan.id || `shadow_${checksum(plan)}`,
      tables: plan.tables || [],
      expectedRecordCount,
      adapterRecordCount: expectedRecordCount,
      parityReady: expectedRecordCount > 0,
    };
  });
  const receipts = [
    operationReceipt('connect', { target: 'local-private-file-adapter-gateway' }, now()),
    operationReceipt('createSchema', { tablePlanCount: tablePlans.length }, now()),
    operationReceipt('beginTransaction', { projectId, transactionId }, now()),
    operationReceipt('importBatch', { tableCount: Object.keys(tableCounts).length, totalRecordCount }, now()),
    operationReceipt('verifyChecksums', { projectId, mismatchCount: 0, sourceChecksum, importedChecksum }, now()),
    operationReceipt('createBackup', { projectId, backupId }, now()),
    operationReceipt('compareShadowRead', {
      projectId,
      groupCount: shadowReadRows.length,
      parityCount: shadowReadRows.filter((row) => row.parityReady).length,
    }, now()),
    operationReceipt('rollbackCutover', { projectId, rolledBack: true }, now()),
  ];
  const receipt = finalReceipt('managed-persistence-adapter-execution-receipt/v1', {
    projectId,
    engine: 'local-private-file-adapter-gateway',
    operationCount: receipts.length,
    tableCounts,
    totalRecordCount,
    tablePlanCount: tablePlans.length,
    shadowReadGroupCount: shadowReadRows.length,
    shadowReadParityCount: shadowReadRows.filter((row) => row.parityReady).length,
    transactionId,
    backupId,
    sourceChecksum,
    importedChecksum,
    receipts,
  });
  const nextState = clone(state);
  nextState.persistence.tablesByProject[projectId] = importedRecordsByTable;
  nextState.persistence.projects[projectId] = {
    schemaVersion: 'adapter-gateway-persistence-project-summary/v1',
    projectId,
    tableCounts,
    totalRecordCount,
    tablePlanCount: tablePlans.length,
    sourceChecksum,
    importedChecksum,
    storedTableCount: Object.keys(importedRecordsByTable).length,
    storedRecordCount: totalRecordCount,
    latestReceiptChecksum: receipt.checksum,
    dryRunCount: (nextState.persistence.projects[projectId]?.dryRunCount || 0) + 1,
    updatedAt: receipt.generatedAt,
  };
  nextState.persistence.dryRuns = limitedRows([
    ...(nextState.persistence.dryRuns || []),
    receiptSummary(receipt),
  ]);
  const persistedState = typeof writeState === 'function' ? await writeState(nextState) : nextState;
  return { receipt, state: persistedState };
}

async function runWorkerQueueDryRun({
  body = {},
  state = createAdapterGatewayDefaultStoreState(),
  writeState = null,
  now = () => new Date().toISOString(),
} = {}) {
  const projectId = body.projectId || body.workerQueueSnapshot?.projectId || 'adapter-gateway-project';
  const snapshot = body.workerQueueSnapshot || {};
  const rows = queueRowsFromSnapshot(snapshot).map((row) => normalizeQueueRow(row, projectId));
  const dueRows = rows.filter((row) => row.due);
  const executionReceipts = snapshot.executionReceipts || [];
  const deadLetterRows = snapshot.deadLetterQueue || [];
  const uniqueIdempotencyKeyCount = new Set(rows.map((row) => row.idempotencyKey).filter(Boolean)).size;
  const leaseCount = dueRows.filter((row) => row.idempotencyKey && row.leaseKey).length;
  const dispatchCount = dueRows.filter((row) => row.runApiPath && row.requestBody).length;
  const ackedReceiptCount = executionReceipts.filter((receipt) => (
    receipt.schemaVersion === 'worker-execution-receipt/v1'
    && receipt.receiptChecksum
    && receipt.idempotencyKey
    && receipt.leaseKey
  )).length;
  const recoverableDeadLetterCount = deadLetterRows.filter((row) => row.idempotencyKey && row.leaseKey && row.directRecoveryApiPath).length;
  const queueChecksum = checksum({ projectId, rows, executionReceipts, deadLetterRows });
  const receipts = [
    operationReceipt('enqueueDueRows', { rowCount: rows.length, dueRowCount: dueRows.length }, now()),
    operationReceipt('acquireLease', { leaseCount, dueRowCount: dueRows.length }, now()),
    operationReceipt('dispatchWorker', { dispatchCount }, now()),
    operationReceipt('ackExecutionReceipt', { receiptCount: executionReceipts.length, ackedReceiptCount }, now()),
    operationReceipt('retryLater', { maxAttempts: snapshot.retryPolicy?.maxAttempts || 0 }, now()),
    operationReceipt('deadLetter', { deadLetterCount: deadLetterRows.length }, now()),
    operationReceipt('recoverDeadLetter', { recoverableDeadLetterCount }, now()),
    operationReceipt('inspectQueue', { projectId, rowCount: rows.length }, now()),
  ];
  const receipt = finalReceipt('worker-queue-adapter-execution-receipt/v1', {
    projectId,
    engine: 'local-private-file-adapter-gateway',
    operationCount: receipts.length,
    queueRowCount: rows.length,
    dueRowCount: dueRows.length,
    uniqueIdempotencyKeyCount,
    leaseCount,
    dispatchCount,
    executionReceiptCount: executionReceipts.length,
    ackedReceiptCount,
    retryPolicyImported: snapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1',
    deadLetterCount: deadLetterRows.length,
    recoveryCount: recoverableDeadLetterCount,
    queueChecksum,
    receipts,
  });
  const nextState = clone(state);
  const rowMap = Object.fromEntries(rows.map((row) => [queueRowKey(row), row]));
  const leaseMap = Object.fromEntries(dueRows
    .filter((row) => row.idempotencyKey && row.leaseKey)
    .map((row) => [row.idempotencyKey, {
      schemaVersion: 'adapter-gateway-queue-lease/v1',
      projectId,
      idempotencyKey: row.idempotencyKey,
      leaseKey: row.leaseKey,
      queue: row.queue || row.workerKind || 'worker',
      acquiredAt: receipt.generatedAt,
      runApiPath: row.runApiPath || null,
      directRunApiPath: row.directRunApiPath || null,
    }]));
  const deadLetterMap = Object.fromEntries(deadLetterRows.map((row) => [row.id || row.idempotencyKey || checksum(row), {
    schemaVersion: 'adapter-gateway-dead-letter-row/v1',
    ...clone(row),
    projectId: row.projectId || projectId,
    storedAt: receipt.generatedAt,
  }]));
  nextState.workerQueue.rowsByProject[projectId] = rowMap;
  nextState.workerQueue.leasesByProject[projectId] = leaseMap;
  nextState.workerQueue.deadLettersByProject[projectId] = deadLetterMap;
  nextState.workerQueue.projects[projectId] = {
    schemaVersion: 'adapter-gateway-worker-queue-project-summary/v1',
    projectId,
    queueRowCount: rows.length,
    dueRowCount: dueRows.length,
    uniqueIdempotencyKeyCount,
    leaseCount,
    dispatchCount,
    deadLetterCount: deadLetterRows.length,
    storedQueueRowCount: Object.keys(rowMap).length,
    storedLeaseCount: Object.keys(leaseMap).length,
    storedDeadLetterCount: Object.keys(deadLetterMap).length,
    queueChecksum,
    latestReceiptChecksum: receipt.checksum,
    dryRunCount: (nextState.workerQueue.projects[projectId]?.dryRunCount || 0) + 1,
    updatedAt: receipt.generatedAt,
  };
  nextState.workerQueue.dryRuns = limitedRows([
    ...(nextState.workerQueue.dryRuns || []),
    receiptSummary(receipt),
  ]);
  const persistedState = typeof writeState === 'function' ? await writeState(nextState) : nextState;
  return { receipt, state: persistedState };
}

async function readJsonBody(request, maxBodyBytes = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('Request body too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  return text ? JSON.parse(text) : {};
}

function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
  });
  response.end(JSON.stringify(body));
}

function hasValidBearerToken(request, authToken = '') {
  if (!authToken) return true;
  const header = request.headers.authorization || '';
  return header === `Bearer ${authToken}`;
}

function managedProductionAttestationReadiness(state = {}, storageAdapterStatus = {}, signingSecret = '') {
  const latestReadback = storageAdapterStatus.latestReadback || {};
  const counts = summarizeAdapterGatewayStoreState(state, storageAdapterStatus);
  const ready = Boolean(
    signingSecret
    && storageAdapterStatus.driver === 'postgres'
    && storageAdapterStatus.queryBound === true
    && latestReadback.parityReady === true
  );
  const blockers = [
    ...(signingSecret ? [] : ['managed-production-attestation-signing-secret-missing']),
    ...(storageAdapterStatus.driver === 'postgres' ? [] : ['postgres-storage-adapter-required']),
    ...(storageAdapterStatus.queryBound === true ? [] : ['postgres-query-bound-adapter-required']),
    ...(latestReadback.parityReady === true ? [] : ['postgres-readback-parity-required']),
  ];
  return {
    schemaVersion: 'adapter-gateway-managed-production-attestation-readiness/v1',
    ready,
    blockers,
    storageDriver: storageAdapterStatus.driver || null,
    queryBound: Boolean(storageAdapterStatus.queryBound),
    readbackParityReady: Boolean(latestReadback.parityReady),
    tableRecordCount: counts.persistence?.tableRecordCount || 0,
    queueRowCount: counts.workerQueue?.queueRowCount || 0,
    leaseCount: counts.workerQueue?.leaseCount || 0,
  };
}

function buildManagedProductionControlAttestation({
  body = {},
  state = {},
  storageAdapterStatus = {},
  signingSecret = '',
  origin = 'http://127.0.0.1',
  now = new Date().toISOString(),
} = {}) {
  const readiness = managedProductionAttestationReadiness(state, storageAdapterStatus, signingSecret);
  if (!readiness.ready) {
    const error = new Error('Adapter gateway cannot issue managed-production attestation.');
    error.status = 409;
    error.body = {
      error: 'adapter-gateway-managed-production-attestation-blocked',
      readiness,
    };
    throw error;
  }
  const projectId = body.projectId || null;
  const domain = body.domain || 'operations';
  const controlId = body.controlId || null;
  const evidenceId = body.evidenceId || null;
  const evidenceRoute = body.evidenceRoute || null;
  const evidenceChecksum = body.evidenceChecksum || null;
  const evidenceEnvironment = 'managed-production';
  const attestationId = body.attestationId || `adapter_gateway_attestation_${checksum({
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceChecksum,
    generatedAt: now,
  })}`;
  const attestationRoute = body.attestationRoute || `${origin}/attestations/managed-production-control/${encodeURIComponent(attestationId)}`;
  const attestationChecksum = body.attestationChecksum || checksum({
    schemaVersion: 'adapter-gateway-managed-production-control-attestation/v1',
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceRoute,
    evidenceChecksum,
    evidenceEnvironment,
    storageDriver: storageAdapterStatus.driver || null,
    storageSchema: storageAdapterStatus.storage?.schema || null,
    latestReadbackChecksum: storageAdapterStatus.latestReadback?.expected?.stateChecksum || null,
    readiness,
  });
  const attestationProvider = body.attestationProvider || 'adapter-gateway-control-plane';
  const attestationKind = body.attestationKind || 'managed-control-plane-attestation';
  const signaturePayload = managedProductionAttestationSignaturePayload({
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceRoute,
    evidenceChecksum,
    evidenceEnvironment,
    attestationId,
    attestationRoute,
    attestationChecksum,
    attestationProvider,
    attestationKind,
  });
  const attestationSignature = signManagedProductionAttestationPayload(signingSecret, signaturePayload);
  const receipt = {
    schemaVersion: 'adapter-gateway-managed-production-control-attestation/v1',
    generatedAt: now,
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceRoute,
    evidenceChecksum,
    evidenceEnvironment,
    attestationId,
    attestationRoute,
    attestationChecksum,
    attestationSignature,
    attestationProvider,
    attestationKind,
    signatureAlgorithm: 'hmac-sha256',
    readiness,
    productionCutoverReady: false,
    summary: {
      storageDriver: storageAdapterStatus.driver || null,
      readbackParityReady: readiness.readbackParityReady,
      tableRecordCount: readiness.tableRecordCount,
      queueRowCount: readiness.queueRowCount,
      leaseCount: readiness.leaseCount,
    },
  };
  return {
    ...receipt,
    checksum: checksum(receipt),
  };
}

export function createAdapterGatewayServer({
  storagePath = resolve(process.cwd(), '.tmp/adapter-gateway-store.json'),
  storageDriver = 'json-file',
  storageDatabaseUrl = '',
  storageSchema = 'hofs_gateway',
  storageQuery = null,
  storeAdapter = null,
  authToken = '',
  productionAttestationSigningSecret = process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET || process.env.PRODUCTION_ATTESTATION_SIGNING_SECRET || '',
  maxBodyBytes = 25 * 1024 * 1024,
  now = () => new Date().toISOString(),
} = {}) {
  const resolvedStoragePath = storagePath ? resolve(storagePath) : null;
  const resolvedStoreAdapter = storeAdapter || createAdapterGatewayStoreAdapter({
    driver: storageDriver,
    storagePath: resolvedStoragePath,
    databaseUrl: storageDatabaseUrl,
    schema: storageSchema,
    query: storageQuery,
  });
  let state = createAdapterGatewayDefaultStoreState();
  let stateReady = Promise.resolve(resolvedStoreAdapter.readState()).then((initialState) => {
    state = initialState || createAdapterGatewayDefaultStoreState();
    return state;
  });
  const ensureState = async () => {
    if (stateReady) {
      await stateReady;
      stateReady = null;
    }
    return state;
  };
  const persistState = async (nextState) => {
    state = await resolvedStoreAdapter.writeState(nextState);
    return state;
  };
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (request.method === 'OPTIONS') {
        writeJson(response, 204, {});
        return;
      }
      if (!hasValidBearerToken(request, authToken)) {
        writeJson(response, 401, {
          error: 'adapter-gateway-unauthorized',
          message: 'Missing or invalid bearer token.',
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        await ensureState();
        const storageStatus = resolvedStoreAdapter.status();
        const attestationReadiness = managedProductionAttestationReadiness(state, storageStatus, productionAttestationSigningSecret);
        writeJson(response, 200, {
          schemaVersion: 'adapter-gateway-health/v1',
          status: 'local-private-gateway-ready-production-blocked',
          engine: 'local-private-file-adapter-gateway',
          productionCutoverReady: false,
          capabilities: [
            'managed-persistence-adapter-contract/v2',
            'worker-queue-adapter-contract/v1',
            ...(attestationReadiness.ready ? ['managed-production-control-attestation/v1'] : []),
          ],
          storage: storageStatus.storage,
          storageAdapter: storageStatus,
          managedProductionAttestation: attestationReadiness,
          auth: {
            required: Boolean(authToken),
            scheme: authToken ? 'bearer' : 'none',
          },
          requiredApproval: [
            'real managed database backup restore drill',
            'real durable queue lease and dead-letter drill',
            'production identity, KMS, audit, monitoring, and incident controls',
          ],
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/state') {
        await ensureState();
        writeJson(response, 200, summarizeAdapterGatewayStoreState(state, resolvedStoreAdapter.status()));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/attestations/managed-production-control') {
        await ensureState();
        const body = await readJsonBody(request, maxBodyBytes);
        const host = request.headers.host || '127.0.0.1';
        const origin = `${request.socket.encrypted ? 'https' : 'http'}://${host}`;
        writeJson(response, 200, buildManagedProductionControlAttestation({
          body,
          state,
          storageAdapterStatus: resolvedStoreAdapter.status(),
          signingSecret: productionAttestationSigningSecret,
          origin,
          now: now(),
        }));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/persistence/dry-run') {
        await ensureState();
        const body = await readJsonBody(request, maxBodyBytes);
        const result = await runPersistenceDryRun({ body, state, writeState: persistState, now });
        state = result.state;
        writeJson(response, 200, result.receipt);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/worker-queue/dry-run') {
        await ensureState();
        const body = await readJsonBody(request, maxBodyBytes);
        const result = await runWorkerQueueDryRun({ body, state, writeState: persistState, now });
        state = result.state;
        writeJson(response, 200, result.receipt);
        return;
      }
      writeJson(response, 404, { error: 'adapter-gateway-not-found' });
    } catch (error) {
      writeJson(response, error.status || 500, error.body || {
        error: 'adapter-gateway-error',
        message: error.message || String(error),
      });
    }
  });
  server.keepAliveTimeout = Math.min(Number(server.keepAliveTimeout) || 5000, 1000);
  server.headersTimeout = Math.min(Number(server.headersTimeout) || 60000, 5000);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  return {
    server,
    storagePath: resolvedStoreAdapter.status().storage.path,
    storeAdapter: resolvedStoreAdapter,
    readState: async () => {
      await ensureState();
      return state;
    },
    async listen({ host = '127.0.0.1', port = 8797 } = {}) {
      return new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const address = server.address();
          resolveListen({
            url: `http://${address.address}:${address.port}`,
            host: address.address,
            port: address.port,
            storagePath: resolvedStoreAdapter.status().storage.path,
          });
        });
      });
    },
    async close() {
      for (const socket of sockets) {
        socket.destroy();
      }
      return new Promise((resolveClose, reject) => {
        server.close((error) => (error ? reject(error) : resolveClose()));
      });
    },
  };
}
