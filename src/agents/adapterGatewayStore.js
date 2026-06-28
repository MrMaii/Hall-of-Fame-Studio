import { dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
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

function redactConnectionValue(value) {
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

function sanitizeSqlIdentifier(value = 'public') {
  const text = String(value || 'public').trim();
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text) ? text : 'public';
}

export function createAdapterGatewayDefaultStoreState() {
  return {
    schemaVersion: 'adapter-gateway-store/v1',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    persistence: {
      projects: {},
      tablesByProject: {},
      dryRuns: [],
    },
    workerQueue: {
      projects: {},
      rowsByProject: {},
      leasesByProject: {},
      deadLettersByProject: {},
      dryRuns: [],
    },
  };
}

export function normalizeAdapterGatewayStoreState(input = {}) {
  const defaults = createAdapterGatewayDefaultStoreState();
  return {
    ...defaults,
    ...clone(input),
    persistence: {
      projects: input.persistence?.projects || {},
      tablesByProject: input.persistence?.tablesByProject || {},
      dryRuns: input.persistence?.dryRuns || [],
    },
    workerQueue: {
      projects: input.workerQueue?.projects || {},
      rowsByProject: input.workerQueue?.rowsByProject || {},
      leasesByProject: input.workerQueue?.leasesByProject || {},
      deadLettersByProject: input.workerQueue?.deadLettersByProject || {},
      dryRuns: input.workerQueue?.dryRuns || [],
    },
  };
}

function readJsonFileState(storagePath) {
  if (!storagePath || !existsSync(storagePath)) return createAdapterGatewayDefaultStoreState();
  try {
    return normalizeAdapterGatewayStoreState(JSON.parse(readFileSync(storagePath, 'utf8')));
  } catch {
    return createAdapterGatewayDefaultStoreState();
  }
}

function writeJsonFileState(storagePath, state) {
  if (!storagePath) return normalizeAdapterGatewayStoreState(state);
  mkdirSync(dirname(storagePath), { recursive: true });
  const nextState = normalizeAdapterGatewayStoreState({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  const tmpPath = `${storagePath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  renameSync(tmpPath, storagePath);
  return nextState;
}

function storeCounts(state = {}) {
  const tableRecordCount = Object.values(state.persistence?.tablesByProject || {})
    .reduce((sum, tables) => sum + Object.values(tables || {})
      .reduce((innerSum, rows) => innerSum + (Array.isArray(rows) ? rows.length : 0), 0), 0);
  const queueRowCount = Object.values(state.workerQueue?.rowsByProject || {})
    .reduce((sum, rows) => sum + Object.keys(rows || {}).length, 0);
  const leaseCount = Object.values(state.workerQueue?.leasesByProject || {})
    .reduce((sum, rows) => sum + Object.keys(rows || {}).length, 0);
  const deadLetterCount = Object.values(state.workerQueue?.deadLettersByProject || {})
    .reduce((sum, rows) => sum + Object.keys(rows || {}).length, 0);
  return {
    tableRecordCount,
    queueRowCount,
    leaseCount,
    deadLetterCount,
  };
}

export function summarizeAdapterGatewayStoreState(state = {}, adapterStatus = {}) {
  const safeState = normalizeAdapterGatewayStoreState(state);
  const persistenceProjects = Object.values(safeState.persistence?.projects || {});
  const queueProjects = Object.values(safeState.workerQueue?.projects || {});
  const counts = storeCounts(safeState);
  return {
    schemaVersion: 'adapter-gateway-state-summary/v1',
    storage: adapterStatus.storage || {
      type: adapterStatus.driver || 'unknown',
      path: adapterStatus.storagePath || null,
      persisted: false,
    },
    storageAdapter: adapterStatus,
    persistence: {
      projectCount: persistenceProjects.length,
      tableRecordCount: counts.tableRecordCount,
      dryRunCount: safeState.persistence?.dryRuns?.length || 0,
      latestDryRun: safeState.persistence?.dryRuns?.slice(-1)[0] || null,
      latestProjects: persistenceProjects.slice(-10),
    },
    workerQueue: {
      projectCount: queueProjects.length,
      queueRowCount: counts.queueRowCount,
      leaseCount: counts.leaseCount,
      deadLetterCount: counts.deadLetterCount,
      dryRunCount: safeState.workerQueue?.dryRuns?.length || 0,
      latestDryRun: safeState.workerQueue?.dryRuns?.slice(-1)[0] || null,
      latestProjects: queueProjects.slice(-10),
    },
  };
}

export function buildAdapterGatewayPostgresSchemaPlan({ schema = 'public' } = {}) {
  const safeSchema = sanitizeSqlIdentifier(schema);
  const table = (name) => `${safeSchema}.${name}`;
  const tables = [
    'adapter_gateway_projects',
    'adapter_gateway_table_records',
    'adapter_gateway_queue_rows',
    'adapter_gateway_queue_leases',
    'adapter_gateway_dead_letters',
    'adapter_gateway_dry_runs',
    'adapter_gateway_state_snapshots',
  ];
  const statements = [
    `CREATE SCHEMA IF NOT EXISTS ${safeSchema};`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_projects')} (project_id text PRIMARY KEY, persistence_summary jsonb NOT NULL DEFAULT '{}'::jsonb, queue_summary jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_table_records')} (project_id text NOT NULL, table_name text NOT NULL, record_id text NOT NULL, record jsonb NOT NULL, record_checksum text, imported_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (project_id, table_name, record_id));`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_queue_rows')} (project_id text NOT NULL, idempotency_key text NOT NULL, queue_row jsonb NOT NULL, lease_key text, row_checksum text, stored_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (project_id, idempotency_key));`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_queue_leases')} (project_id text NOT NULL, idempotency_key text NOT NULL, lease_key text NOT NULL, lease_row jsonb NOT NULL, acquired_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (project_id, idempotency_key));`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_dead_letters')} (project_id text NOT NULL, dead_letter_id text NOT NULL, dead_letter_row jsonb NOT NULL, stored_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (project_id, dead_letter_id));`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_dry_runs')} (receipt_checksum text PRIMARY KEY, project_id text, kind text NOT NULL, receipt_summary jsonb NOT NULL, generated_at timestamptz NOT NULL DEFAULT now());`,
    `CREATE TABLE IF NOT EXISTS ${table('adapter_gateway_state_snapshots')} (snapshot_id text PRIMARY KEY, state jsonb NOT NULL, state_checksum text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
    `CREATE INDEX IF NOT EXISTS adapter_gateway_table_records_project_table_idx ON ${table('adapter_gateway_table_records')} (project_id, table_name);`,
    `CREATE INDEX IF NOT EXISTS adapter_gateway_queue_rows_project_idx ON ${table('adapter_gateway_queue_rows')} (project_id);`,
    `CREATE INDEX IF NOT EXISTS adapter_gateway_queue_leases_project_idx ON ${table('adapter_gateway_queue_leases')} (project_id);`,
  ];
  return {
    schemaVersion: 'adapter-gateway-postgres-schema-plan/v1',
    schema: safeSchema,
    tableCount: tables.length,
    statementCount: statements.length,
    statements,
    tables,
    productionRequirement: 'Execute this schema plan against a managed Postgres database, then run gateway validation with a real query function and backup/restore checks before cutover.',
  };
}

function buildPostgresWriteOperations(state = {}, { schema = 'public' } = {}) {
  const safeSchema = sanitizeSqlIdentifier(schema);
  const table = (name) => `${safeSchema}.${name}`;
  const operations = [];
  const add = (name, text, values = []) => {
    operations.push({
      name,
      text,
      values,
      checksum: checksum({ name, text, values }),
    });
  };
  const safeState = normalizeAdapterGatewayStoreState(state);
  Object.entries(safeState.persistence.projects || {}).forEach(([projectId, summary]) => {
    add(
      'upsert-persistence-project-summary',
      `INSERT INTO ${table('adapter_gateway_projects')} (project_id, persistence_summary, queue_summary, updated_at) VALUES ($1, $2::jsonb, COALESCE((SELECT queue_summary FROM ${table('adapter_gateway_projects')} WHERE project_id = $1), '{}'::jsonb), now()) ON CONFLICT (project_id) DO UPDATE SET persistence_summary = EXCLUDED.persistence_summary, updated_at = now();`,
      [projectId, JSON.stringify(summary)]
    );
  });
  Object.entries(safeState.workerQueue.projects || {}).forEach(([projectId, summary]) => {
    add(
      'upsert-queue-project-summary',
      `INSERT INTO ${table('adapter_gateway_projects')} (project_id, persistence_summary, queue_summary, updated_at) VALUES ($1, COALESCE((SELECT persistence_summary FROM ${table('adapter_gateway_projects')} WHERE project_id = $1), '{}'::jsonb), $2::jsonb, now()) ON CONFLICT (project_id) DO UPDATE SET queue_summary = EXCLUDED.queue_summary, updated_at = now();`,
      [projectId, JSON.stringify(summary)]
    );
  });
  Object.entries(safeState.persistence.tablesByProject || {}).forEach(([projectId, tables]) => {
    Object.entries(tables || {}).forEach(([tableName, rows]) => {
      (rows || []).forEach((row) => {
        add(
          'upsert-table-record',
          `INSERT INTO ${table('adapter_gateway_table_records')} (project_id, table_name, record_id, record, record_checksum, imported_at) VALUES ($1, $2, $3, $4::jsonb, $5, now()) ON CONFLICT (project_id, table_name, record_id) DO UPDATE SET record = EXCLUDED.record, record_checksum = EXCLUDED.record_checksum, imported_at = now();`,
          [projectId, tableName, row.id, JSON.stringify(row), row.checksum || checksum(row)]
        );
      });
    });
  });
  Object.entries(safeState.workerQueue.rowsByProject || {}).forEach(([projectId, rowsByKey]) => {
    Object.entries(rowsByKey || {}).forEach(([idempotencyKey, row]) => {
      add(
        'upsert-queue-row',
        `INSERT INTO ${table('adapter_gateway_queue_rows')} (project_id, idempotency_key, queue_row, lease_key, row_checksum, stored_at) VALUES ($1, $2, $3::jsonb, $4, $5, now()) ON CONFLICT (project_id, idempotency_key) DO UPDATE SET queue_row = EXCLUDED.queue_row, lease_key = EXCLUDED.lease_key, row_checksum = EXCLUDED.row_checksum, stored_at = now();`,
        [projectId, idempotencyKey, JSON.stringify(row), row.leaseKey || null, checksum(row)]
      );
    });
  });
  Object.entries(safeState.workerQueue.leasesByProject || {}).forEach(([projectId, leasesByKey]) => {
    Object.entries(leasesByKey || {}).forEach(([idempotencyKey, row]) => {
      add(
        'upsert-queue-lease',
        `INSERT INTO ${table('adapter_gateway_queue_leases')} (project_id, idempotency_key, lease_key, lease_row, acquired_at) VALUES ($1, $2, $3, $4::jsonb, now()) ON CONFLICT (project_id, idempotency_key) DO UPDATE SET lease_key = EXCLUDED.lease_key, lease_row = EXCLUDED.lease_row, acquired_at = now();`,
        [projectId, idempotencyKey, row.leaseKey, JSON.stringify(row)]
      );
    });
  });
  Object.entries(safeState.workerQueue.deadLettersByProject || {}).forEach(([projectId, rowsByKey]) => {
    Object.entries(rowsByKey || {}).forEach(([deadLetterId, row]) => {
      add(
        'upsert-dead-letter',
        `INSERT INTO ${table('adapter_gateway_dead_letters')} (project_id, dead_letter_id, dead_letter_row, stored_at) VALUES ($1, $2, $3::jsonb, now()) ON CONFLICT (project_id, dead_letter_id) DO UPDATE SET dead_letter_row = EXCLUDED.dead_letter_row, stored_at = now();`,
        [projectId, deadLetterId, JSON.stringify(row)]
      );
    });
  });
  (safeState.persistence.dryRuns || []).forEach((row) => {
    add(
      'insert-persistence-dry-run',
      `INSERT INTO ${table('adapter_gateway_dry_runs')} (receipt_checksum, project_id, kind, receipt_summary, generated_at) VALUES ($1, $2, 'persistence', $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (receipt_checksum) DO NOTHING;`,
      [row.checksum, row.projectId, JSON.stringify(row), row.generatedAt || null]
    );
  });
  (safeState.workerQueue.dryRuns || []).forEach((row) => {
    add(
      'insert-worker-queue-dry-run',
      `INSERT INTO ${table('adapter_gateway_dry_runs')} (receipt_checksum, project_id, kind, receipt_summary, generated_at) VALUES ($1, $2, 'worker-queue', $3::jsonb, COALESCE($4::timestamptz, now())) ON CONFLICT (receipt_checksum) DO NOTHING;`,
      [row.checksum, row.projectId, JSON.stringify(row), row.generatedAt || null]
    );
  });
  add(
    'insert-state-snapshot',
    `INSERT INTO ${table('adapter_gateway_state_snapshots')} (snapshot_id, state, state_checksum, created_at) VALUES ($1, $2::jsonb, $3, now()) ON CONFLICT (snapshot_id) DO NOTHING;`,
    [`snapshot_${Date.now()}`, JSON.stringify(safeState), checksum(safeState)]
  );
  return operations;
}

function buildPostgresReadbackOperations({ schema = 'public' } = {}) {
  const safeSchema = sanitizeSqlIdentifier(schema);
  const table = (name) => `${safeSchema}.${name}`;
  const add = (name, text, values = []) => ({
    name,
    text,
    values,
    checksum: checksum({ name, text, values }),
  });
  return [
    add(
      'readback-state-snapshot',
      `SELECT state, state_checksum AS "stateChecksum" FROM ${table('adapter_gateway_state_snapshots')} ORDER BY created_at DESC LIMIT 1;`
    ),
    add(
      'readback-store-counts',
      `SELECT (SELECT COUNT(*)::int FROM ${table('adapter_gateway_table_records')}) AS "tableRecordCount", (SELECT COUNT(*)::int FROM ${table('adapter_gateway_queue_rows')}) AS "queueRowCount", (SELECT COUNT(*)::int FROM ${table('adapter_gateway_queue_leases')}) AS "leaseCount", (SELECT COUNT(*)::int FROM ${table('adapter_gateway_dead_letters')}) AS "deadLetterCount", (SELECT COUNT(*)::int FROM ${table('adapter_gateway_dry_runs')} WHERE kind = 'persistence') AS "persistenceDryRunCount", (SELECT COUNT(*)::int FROM ${table('adapter_gateway_dry_runs')} WHERE kind = 'worker-queue') AS "workerQueueDryRunCount";`
    ),
  ];
}

function expectedPostgresReadbackMetrics(state = {}) {
  const safeState = normalizeAdapterGatewayStoreState(state);
  const counts = storeCounts(safeState);
  return {
    ...counts,
    persistenceDryRunCount: safeState.persistence?.dryRuns?.length || 0,
    workerQueueDryRunCount: safeState.workerQueue?.dryRuns?.length || 0,
    stateChecksum: checksum(safeState),
  };
}

function countValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizePostgresCountRow(row = {}) {
  return {
    tableRecordCount: countValue(row.tableRecordCount ?? row.table_record_count),
    queueRowCount: countValue(row.queueRowCount ?? row.queue_row_count),
    leaseCount: countValue(row.leaseCount ?? row.lease_count),
    deadLetterCount: countValue(row.deadLetterCount ?? row.dead_letter_count),
    persistenceDryRunCount: countValue(row.persistenceDryRunCount ?? row.persistence_dry_run_count),
    workerQueueDryRunCount: countValue(row.workerQueueDryRunCount ?? row.worker_queue_dry_run_count),
  };
}

function normalizeSnapshotRow(row = {}) {
  const rawState = row.state || row.stateJson || row.state_json || null;
  const parsedState = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
  const normalizedState = parsedState ? normalizeAdapterGatewayStoreState(parsedState) : null;
  return {
    state: normalizedState,
    stateChecksum: row.stateChecksum || row.state_checksum || (normalizedState ? checksum(normalizedState) : null),
  };
}

function countsMatch(expected = {}, actual = {}) {
  return [
    'tableRecordCount',
    'queueRowCount',
    'leaseCount',
    'deadLetterCount',
    'persistenceDryRunCount',
    'workerQueueDryRunCount',
  ].every((key) => countValue(expected[key]) === countValue(actual[key]));
}

export function createAdapterGatewayMemoryStore({ initialState = null } = {}) {
  let state = normalizeAdapterGatewayStoreState(initialState || createAdapterGatewayDefaultStoreState());
  const status = () => ({
    schemaVersion: 'adapter-gateway-storage-adapter-status/v1',
    driver: 'memory',
    status: 'memory-shadow-ready-production-blocked',
    configured: true,
    productionCutoverReady: false,
    storage: {
      type: 'memory',
      path: null,
      persisted: false,
    },
    methods: ['readState', 'writeState', 'summary'],
    remainingProductionControls: [
      'Replace memory storage with managed persistence before production.',
      'Run adapter gateway validation against durable storage and queue leases.',
    ],
  });
  return {
    schemaVersion: 'adapter-gateway-storage-adapter/v1',
    driver: 'memory',
    status,
    readState() {
      return state;
    },
    writeState(nextState = state) {
      state = normalizeAdapterGatewayStoreState({
        ...nextState,
        updatedAt: new Date().toISOString(),
      });
      return state;
    },
    summary() {
      return summarizeAdapterGatewayStoreState(state, status());
    },
  };
}

export function createAdapterGatewayJsonFileStore({ storagePath } = {}) {
  if (!storagePath) throw new Error('createAdapterGatewayJsonFileStore requires storagePath.');
  const resolvedStoragePath = resolve(storagePath);
  let state = readJsonFileState(resolvedStoragePath);
  const status = () => ({
    schemaVersion: 'adapter-gateway-storage-adapter-status/v1',
    driver: 'json-file',
    status: 'json-file-shadow-ready-production-blocked',
    configured: Boolean(resolvedStoragePath),
    productionCutoverReady: false,
    storage: {
      type: 'json-file',
      path: resolvedStoragePath,
      persisted: existsSync(resolvedStoragePath),
    },
    methods: ['readState', 'writeState', 'summary'],
    remainingProductionControls: [
      'Replace JSON file storage with managed database records before production.',
      'Replace local queue state with durable queue leases and managed dead-letter storage.',
      'Add managed backup/restore, retention, and operational monitoring around the gateway store.',
    ],
  });
  return {
    schemaVersion: 'adapter-gateway-storage-adapter/v1',
    driver: 'json-file',
    storagePath: resolvedStoragePath,
    status,
    readState() {
      return state;
    },
    writeState(nextState = state) {
      state = writeJsonFileState(resolvedStoragePath, nextState);
      return state;
    },
    summary() {
      return summarizeAdapterGatewayStoreState(state, status());
    },
  };
}

export function createAdapterGatewayPostgresStore({
  databaseUrl = '',
  schema = 'public',
  query = null,
  initialState = null,
} = {}) {
  let state = normalizeAdapterGatewayStoreState(initialState || createAdapterGatewayDefaultStoreState());
  const schemaPlan = buildAdapterGatewayPostgresSchemaPlan({ schema });
  const queryBound = typeof query === 'function';
  const executedOperations = [];
  const readbackExecutions = [];
  const status = () => ({
    schemaVersion: 'adapter-gateway-storage-adapter-status/v1',
    driver: 'postgres',
    status: queryBound ? 'postgres-query-bound-production-blocked' : 'postgres-plan-only-query-not-bound',
    configured: Boolean(databaseUrl || queryBound),
    queryBound,
    productionCutoverReady: false,
    storage: {
      type: 'postgres-compatible',
      path: redactConnectionValue(databaseUrl),
      persisted: queryBound,
      schema: schemaPlan.schema,
    },
    methods: ['readState', 'writeState', 'summary', 'schemaPlan'],
    schemaPlan,
    latestExecution: executedOperations.at(-1) || null,
    latestReadback: readbackExecutions.at(-1) || null,
    remainingProductionControls: [
      'Bind this adapter to a managed Postgres client and run validation against an isolated database, not only the query shim.',
      'Prove readback parity from normalized table records, queue rows, leases, dead letters, and dry-run receipts against the real database.',
      'Add managed backup/restore, RLS enforcement, retention, monitoring, and incident controls before cutover.',
    ],
  });
  const runQuery = async (operation) => {
    if (!queryBound) {
      return {
        skipped: true,
        reason: 'postgres-query-not-bound',
      };
    }
    const result = await query(operation.text, operation.values, operation);
    return {
      skipped: false,
      rowCount: result?.rowCount ?? result?.rows?.length ?? 0,
      rows: Array.isArray(result?.rows) ? result.rows : [],
    };
  };
  const runReadback = async (expectedState) => {
    const expected = expectedPostgresReadbackMetrics(expectedState);
    const operations = buildPostgresReadbackOperations({ schema: schemaPlan.schema });
    const readback = {
      schemaVersion: 'adapter-gateway-postgres-readback/v1',
      generatedAt: new Date().toISOString(),
      queryBound,
      operationCount: operations.length,
      operationChecksums: operations.map((operation) => operation.checksum),
      expected,
      actualCounts: null,
      snapshotStateChecksum: null,
      snapshotReadable: false,
      snapshotParityReady: false,
      countParityReady: false,
      parityReady: false,
      skippedOperationCount: 0,
      failedOperationCount: 0,
      productionCutoverReady: false,
    };
    for (const operation of operations) {
      try {
        const result = await runQuery(operation);
        if (result.skipped) {
          readback.skippedOperationCount += 1;
          continue;
        }
        if (operation.name === 'readback-state-snapshot') {
          const snapshot = normalizeSnapshotRow(result.rows[0] || {});
          readback.snapshotReadable = Boolean(snapshot.state);
          readback.snapshotStateChecksum = snapshot.stateChecksum;
          readback.snapshotParityReady = Boolean(
            snapshot.state
            && snapshot.stateChecksum === expected.stateChecksum
            && checksum(snapshot.state) === expected.stateChecksum
          );
        }
        if (operation.name === 'readback-store-counts') {
          readback.actualCounts = normalizePostgresCountRow(result.rows[0] || {});
          readback.countParityReady = countsMatch(expected, readback.actualCounts);
        }
      } catch (error) {
        readback.failedOperationCount += 1;
        readback.error = {
          operation: operation.name,
          message: error.message || String(error),
        };
        throw error;
      }
    }
    readback.parityReady = Boolean(
      queryBound
      && readback.failedOperationCount === 0
      && readback.skippedOperationCount === 0
      && readback.snapshotParityReady
      && readback.countParityReady
    );
    readback.checksum = checksum(readback);
    readbackExecutions.push(readback);
    return readback;
  };
  return {
    schemaVersion: 'adapter-gateway-storage-adapter/v1',
    driver: 'postgres',
    schemaPlan,
    status,
    async readState() {
      return state;
    },
    async writeState(nextState = state) {
      state = normalizeAdapterGatewayStoreState({
        ...nextState,
        updatedAt: new Date().toISOString(),
      });
      const operations = [
        ...schemaPlan.statements.map((statement) => ({
          name: 'schema-plan',
          text: statement,
          values: [],
          checksum: checksum(statement),
        })),
        ...buildPostgresWriteOperations(state, { schema: schemaPlan.schema }),
      ];
      const execution = {
        schemaVersion: 'adapter-gateway-postgres-write-execution/v1',
        generatedAt: new Date().toISOString(),
        queryBound,
        operationCount: operations.length + buildPostgresReadbackOperations({ schema: schemaPlan.schema }).length,
        schemaStatementCount: schemaPlan.statementCount,
        writeOperationCount: operations.length - schemaPlan.statementCount,
        readbackOperationCount: buildPostgresReadbackOperations({ schema: schemaPlan.schema }).length,
        operationChecksums: operations.map((operation) => operation.checksum),
        skippedOperationCount: 0,
        failedOperationCount: 0,
      };
      for (const operation of operations) {
        try {
          const result = await runQuery(operation);
          if (result.skipped) execution.skippedOperationCount += 1;
        } catch (error) {
          execution.failedOperationCount += 1;
          execution.error = {
            operation: operation.name,
            message: error.message || String(error),
          };
          throw error;
        }
      }
      execution.readback = await runReadback(state);
      execution.operationChecksums = [
        ...execution.operationChecksums,
        ...execution.readback.operationChecksums,
      ];
      execution.checksum = checksum(execution);
      executedOperations.push(execution);
      return state;
    },
    summary() {
      return summarizeAdapterGatewayStoreState(state, status());
    },
  };
}

export function createAdapterGatewayStoreAdapter({
  driver = 'json-file',
  storagePath = null,
  initialState = null,
  databaseUrl = '',
  schema = 'public',
  query = null,
} = {}) {
  const normalizedDriver = String(driver || 'json-file').trim().toLowerCase();
  if (normalizedDriver === 'memory') {
    return createAdapterGatewayMemoryStore({ initialState });
  }
  if (normalizedDriver === 'json-file') {
    return createAdapterGatewayJsonFileStore({ storagePath });
  }
  if (['postgres', 'postgres-compatible'].includes(normalizedDriver)) {
    return createAdapterGatewayPostgresStore({ databaseUrl, schema, query, initialState });
  }
  throw new Error(`Unsupported adapter gateway storage driver: ${normalizedDriver}`);
}
