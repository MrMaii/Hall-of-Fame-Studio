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

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function redactEndpoint(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.username) url.username = '[REDACTED]';
    if (url.password) url.password = '[REDACTED]';
    url.search = '';
    return url.toString();
  } catch {
    return '[REDACTED]';
  }
}

function rowsFromSnapshot(workerQueueSnapshot = {}) {
  return [
    ...(workerQueueSnapshot.projectQueue || []),
    ...(workerQueueSnapshot.agentQueue || []),
  ].map((row) => ({
    ...row,
    adapterQueue: row.queue || row.workerKind || 'worker',
  }));
}

function queueSnapshotExpectedCounts(workerQueueSnapshot = {}, projectId = null) {
  const rows = rowsFromSnapshot(workerQueueSnapshot)
    .filter((row) => !projectId || row.projectId === projectId);
  const dueRows = rows.filter((row) => row.due);
  const executionReceipts = (workerQueueSnapshot.executionReceipts || [])
    .filter((receipt) => !projectId || receipt.projectId === projectId);
  const deadLetterRows = (workerQueueSnapshot.deadLetterQueue || [])
    .filter((row) => !projectId || row.projectId === projectId);
  return {
    queueRowCount: rows.length,
    dueRowCount: dueRows.length,
    leaseCount: dueRows.filter((row) => row.idempotencyKey && row.leaseKey).length,
    acknowledgementCount: executionReceipts.length,
    ackedReceiptCount: executionReceipts.filter((receipt) => (
      receipt.schemaVersion === 'worker-execution-receipt/v1'
      && receipt.receiptChecksum
      && receipt.idempotencyKey
      && receipt.leaseKey
    )).length,
    deadLetterCount: deadLetterRows.length,
    recoverableDeadLetterCount: deadLetterRows.filter((row) => row.idempotencyKey && row.leaseKey && row.directRecoveryApiPath).length,
    uniqueIdempotencyKeyCount: new Set(rows.map((row) => row.idempotencyKey).filter(Boolean)).size,
  };
}

function queueCountsMatch(expected = {}, actual = {}, keys = []) {
  return keys.every((key) => Number(expected[key] || 0) === Number(actual[key] || 0));
}

export function workerQueueAdapterStatus(env = globalThis.process?.env || {}) {
  const driver = String(env.WORKER_QUEUE_ADAPTER_DRIVER || env.WORKER_QUEUE_DRIVER || 'local-shadow')
    .trim()
    .toLowerCase()
    || 'local-shadow';
  const httpEndpoint = env.WORKER_QUEUE_HTTP_ENDPOINT || env.ADAPTER_GATEWAY_HTTP_ENDPOINT || '';
  const requireRealAdapter = parseBoolean(env.WORKER_QUEUE_REQUIRE_REAL_ADAPTER);
  const supportedLocalDrivers = ['local-shadow'];
  const supportedExternalDrivers = ['http-json', 'managed-queue'];
  const localDriver = supportedLocalDrivers.includes(driver);
  const externalDriver = supportedExternalDrivers.includes(driver);
  const externalConfigured = externalDriver && Boolean(httpEndpoint);
  const gatewayExecutionSupported = driver === 'http-json' && Boolean(httpEndpoint);
  const unsupportedDriver = !localDriver && !externalDriver;
  const missingConfiguration = externalDriver && !externalConfigured;
  const executableInCurrentRuntime = localDriver;
  const productionCutoverReady = false;
  const status = unsupportedDriver
    ? 'unsupported-queue-adapter-driver'
    : localDriver
      ? 'local-shadow-ready-production-blocked'
      : missingConfiguration
        ? 'external-queue-adapter-missing-configuration'
        : gatewayExecutionSupported
          ? 'http-json-gateway-configured-production-blocked'
          : 'external-queue-adapter-configured-execution-not-yet-supported';

  return {
    schemaVersion: 'worker-queue-adapter-status/v1',
    driver,
    status,
    sourceKind: localDriver ? 'local-shadow' : 'external-queue-adapter',
    configured: localDriver || externalConfigured,
    executableInCurrentRuntime,
    productionCutoverReady,
    requireRealAdapter,
    externalConfigured,
    gatewayExecutionSupported,
    missingConfiguration,
    unsupportedDriver,
    httpEndpointConfigured: Boolean(httpEndpoint),
    redactedHttpEndpoint: redactEndpoint(httpEndpoint),
    gatewayVerificationAvailable: true,
    gatewayValidationCommand: 'npm run adapters:gateway',
    requiredEnv: [
      'WORKER_QUEUE_ADAPTER_DRIVER=local-shadow|http-json|managed-queue',
      'WORKER_QUEUE_HTTP_ENDPOINT or ADAPTER_GATEWAY_HTTP_ENDPOINT for http-json/non-shadow drivers',
      'ADAPTER_GATEWAY_AUTH_TOKEN when the private http-json gateway requires bearer authentication',
      'WORKER_QUEUE_REQUIRE_REAL_ADAPTER=true before production cutover approval',
    ],
    remainingProductionControls: [
      'Implement the selected managed queue or private queue gateway driver behind this facade.',
      'Run the product-team Harness against durable queue leases in an isolated environment.',
      'Prove idempotent enqueue, lease expiry, dispatch acknowledgement, retry, dead-letter, and recovery against the real queue.',
    ],
  };
}

export function createWorkerQueueShadowAdapter({
  now = () => new Date().toISOString(),
  engine = 'local-shadow-managed-queue-compatible',
} = {}) {
  const receipts = [];
  const rowsByIdempotencyKey = new Map();
  const leases = new Map();
  const dispatches = [];
  const acknowledgements = [];
  const retryRows = [];
  const deadLetters = new Map();
  const recoveries = [];
  const receipt = (operation, payload = {}) => {
    const row = {
      schemaVersion: 'worker-queue-adapter-operation-receipt/v1',
      operation,
      at: now(),
      ...payload,
    };
    row.checksum = checksum(row);
    receipts.push(row);
    return row;
  };

  return {
    schemaVersion: 'worker-queue-adapter-implementation/v1',
    engine,
    enqueueDueRows(workerQueueSnapshot = {}) {
      const rows = rowsFromSnapshot(workerQueueSnapshot);
      rows.forEach((row) => {
        if (!row.idempotencyKey) return;
        rowsByIdempotencyKey.set(row.idempotencyKey, clone(row));
      });
      return receipt('enqueueDueRows', {
        rowCount: rows.length,
        dueRowCount: rows.filter((row) => row.due).length,
        queuedRowCount: rows.filter((row) => row.status === 'queued').length,
      });
    },
    acquireLease(idempotencyKey, leaseKey) {
      const acquired = Boolean(idempotencyKey && leaseKey && rowsByIdempotencyKey.has(idempotencyKey));
      if (acquired) {
        leases.set(idempotencyKey, {
          idempotencyKey,
          leaseKey,
          acquiredAt: now(),
        });
      }
      return receipt('acquireLease', {
        idempotencyKey: idempotencyKey || null,
        leaseKey: leaseKey || null,
        acquired,
      });
    },
    dispatchWorker(runApiPath, requestBody = {}) {
      const dispatchable = Boolean(runApiPath && requestBody);
      const dispatch = {
        runApiPath: runApiPath || null,
        requestBodyChecksum: checksum(requestBody || {}),
        dispatchable,
      };
      dispatches.push(dispatch);
      return receipt('dispatchWorker', dispatch);
    },
    ackExecutionReceipt(workerExecutionReceipt = {}) {
      const acked = Boolean(
        workerExecutionReceipt.schemaVersion === 'worker-execution-receipt/v1'
        && workerExecutionReceipt.receiptChecksum
        && workerExecutionReceipt.idempotencyKey
        && workerExecutionReceipt.leaseKey
      );
      const ack = {
        runId: workerExecutionReceipt.runId || null,
        idempotencyKey: workerExecutionReceipt.idempotencyKey || null,
        leaseKey: workerExecutionReceipt.leaseKey || null,
        receiptChecksum: workerExecutionReceipt.receiptChecksum || null,
        acked,
      };
      acknowledgements.push(ack);
      return receipt('ackExecutionReceipt', ack);
    },
    retryLater(idempotencyKey, retryState = {}) {
      const retry = {
        idempotencyKey: idempotencyKey || null,
        retryable: Boolean(retryState.retryable ?? true),
        attemptCount: retryState.attemptCount || 0,
        maxAttempts: retryState.maxAttempts || 0,
      };
      retryRows.push(retry);
      return receipt('retryLater', retry);
    },
    deadLetter(workerDeadLetter = {}) {
      if (workerDeadLetter.id) deadLetters.set(workerDeadLetter.id, clone(workerDeadLetter));
      return receipt('deadLetter', {
        id: workerDeadLetter.id || null,
        idempotencyKey: workerDeadLetter.idempotencyKey || null,
        leaseKey: workerDeadLetter.leaseKey || null,
        stored: Boolean(workerDeadLetter.id),
      });
    },
    recoverDeadLetter(deadLetterId, directRecoveryApiPath = null) {
      const row = deadLetters.get(deadLetterId);
      const recovered = Boolean(row && directRecoveryApiPath);
      recoveries.push({
        deadLetterId,
        directRecoveryApiPath,
        recovered,
      });
      return receipt('recoverDeadLetter', {
        deadLetterId: deadLetterId || null,
        directRecoveryApiPath,
        recovered,
      });
    },
    inspectQueue(projectId = null) {
      const rows = [...rowsByIdempotencyKey.values()].filter((row) => !projectId || row.projectId === projectId);
      return receipt('inspectQueue', {
        projectId,
        rowCount: rows.length,
        leaseCount: [...leases.values()].filter((row) => !projectId || rowsByIdempotencyKey.get(row.idempotencyKey)?.projectId === projectId).length,
      });
    },
    inspectSnapshotParity(workerQueueSnapshot = {}, projectId = null) {
      const expected = queueSnapshotExpectedCounts(workerQueueSnapshot, projectId);
      const rows = [...rowsByIdempotencyKey.values()].filter((row) => !projectId || row.projectId === projectId);
      const leasedRows = [...leases.values()].filter((row) => !projectId || rowsByIdempotencyKey.get(row.idempotencyKey)?.projectId === projectId);
      const deadLetterRows = [...deadLetters.values()].filter((row) => !projectId || row.projectId === projectId);
      const actual = {
        queueRowCount: rows.length,
        dueRowCount: rows.filter((row) => row.due).length,
        leaseCount: leasedRows.length,
        acknowledgementCount: acknowledgements.length,
        ackedReceiptCount: acknowledgements.filter((row) => row.acked).length,
        deadLetterCount: deadLetterRows.length,
        recoverableDeadLetterCount: recoveries.filter((row) => row.recovered).length,
        uniqueIdempotencyKeyCount: new Set(rows.map((row) => row.idempotencyKey).filter(Boolean)).size,
      };
      const queueRowParityReady = queueCountsMatch(expected, actual, ['queueRowCount', 'dueRowCount', 'uniqueIdempotencyKeyCount']);
      const leaseParityReady = queueCountsMatch(expected, actual, ['leaseCount']);
      const acknowledgementParityReady = queueCountsMatch(expected, actual, ['acknowledgementCount', 'ackedReceiptCount']);
      const deadLetterParityReady = queueCountsMatch(expected, actual, ['deadLetterCount', 'recoverableDeadLetterCount']);
      return receipt('inspectSnapshotParity', {
        schemaVersion: 'worker-queue-adapter-snapshot-parity/v1',
        projectId,
        expected,
        actual,
        queueRowParityReady,
        leaseParityReady,
        acknowledgementParityReady,
        deadLetterParityReady,
        parityReady: Boolean(
          queueRowParityReady
          && leaseParityReady
          && acknowledgementParityReady
          && deadLetterParityReady
        ),
      });
    },
    executionReceipt(projectId = null) {
      const rows = [...rowsByIdempotencyKey.values()].filter((row) => !projectId || row.projectId === projectId);
      const leasedRows = [...leases.values()].filter((row) => !projectId || rowsByIdempotencyKey.get(row.idempotencyKey)?.projectId === projectId);
      return {
        schemaVersion: 'worker-queue-adapter-execution-receipt/v1',
        projectId,
        engine,
        operationCount: receipts.length,
        queueRowCount: rows.length,
        dueRowCount: rows.filter((row) => row.due).length,
        leaseCount: leasedRows.length,
        dispatchCount: dispatches.length,
        acknowledgementCount: acknowledgements.length,
        ackedReceiptCount: acknowledgements.filter((row) => row.acked).length,
        retryRowCount: retryRows.length,
        deadLetterCount: deadLetters.size,
        recoveryCount: recoveries.filter((row) => row.recovered).length,
        receipts: receipts.map((row) => clone(row)),
        checksum: checksum({ projectId, engine, rows, receipts }),
      };
    },
  };
}

export function createWorkerQueueAdapterFromEnv({
  env = globalThis.process?.env || {},
  now = () => new Date().toISOString(),
} = {}) {
  const status = workerQueueAdapterStatus(env);
  const adapter = createWorkerQueueShadowAdapter({
    now,
    engine: status.sourceKind === 'local-shadow'
      ? 'local-shadow-managed-queue-compatible'
      : `local-shadow-for-${status.driver}`,
  });
  return {
    adapter,
    status,
  };
}
