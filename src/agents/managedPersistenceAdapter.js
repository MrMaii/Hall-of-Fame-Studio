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

function cloneTables(sourceTables = new Map()) {
  const next = new Map();
  sourceTables.forEach((state, table) => {
    next.set(table, {
      ...clone(state),
      rows: clone(state.rows || []),
      ids: new Set(state.rows?.map((row) => String(row.id)) || []),
    });
  });
  return next;
}

function projectIdForRecord(record = {}) {
  return record.projectId || record.data?.projectId || record.refs?.projectId || null;
}

function normalizeRecord(table, record = {}, fallbackProjectId = null) {
  const id = record.id || record.data?.id || `${table}_${checksum(record)}`;
  const projectId = projectIdForRecord(record) || fallbackProjectId || null;
  const refs = clone(record.refs || {});
  const data = clone(record.data || record);
  return {
    table,
    id,
    projectId,
    refs,
    data,
    checksum: record.checksum || checksum({ table, id, refs, data }),
    importedAt: new Date().toISOString(),
  };
}

function tableRows(tables, table) {
  if (!tables.has(table)) {
    tables.set(table, {
      table,
      primaryKey: ['id'],
      rlsDraft: '',
      rows: [],
      ids: new Set(),
    });
  }
  return tables.get(table);
}

function relationIssuesForTables(tables) {
  const ids = (table) => new Set((tables.get(table)?.rows || []).map((row) => String(row.id)));
  const agentIds = new Set((tables.get('agent_states')?.rows || [])
    .map((row) => String(row.data?.agentId || row.refs?.agentId || ''))
    .filter(Boolean));
  const taskIds = ids('project_tasks');
  const submissionIds = ids('agent_submissions');
  const evidenceSearchIds = ids('evidence_searches');
  const issues = [];
  const check = ({ table, row, field, targetSet, optional = true }) => {
    const value = row.data?.[field] || row.refs?.[field];
    if ((value === null || value === undefined || value === '') && optional) return;
    if (!targetSet.has(String(value))) {
      issues.push({
        table,
        recordId: row.id,
        field,
        targetId: value || null,
        issue: 'missing-target-record',
      });
    }
  };
  (tables.get('agent_submissions')?.rows || []).forEach((row) => {
    check({ table: 'agent_submissions', row, field: 'agentId', targetSet: agentIds, optional: false });
    check({ table: 'agent_submissions', row, field: 'taskId', targetSet: taskIds, optional: true });
  });
  (tables.get('evidence_searches')?.rows || []).forEach((row) => {
    check({ table: 'evidence_searches', row, field: 'agentId', targetSet: agentIds, optional: false });
    check({ table: 'evidence_searches', row, field: 'taskId', targetSet: taskIds, optional: true });
    check({ table: 'evidence_searches', row, field: 'submissionId', targetSet: submissionIds, optional: true });
  });
  (tables.get('evidence_sources')?.rows || []).forEach((row) => {
    check({ table: 'evidence_sources', row, field: 'evidenceSearchId', targetSet: evidenceSearchIds, optional: false });
  });
  (tables.get('submission_reviews')?.rows || []).forEach((row) => {
    check({ table: 'submission_reviews', row, field: 'submissionId', targetSet: submissionIds, optional: false });
  });
  (tables.get('artifact_files')?.rows || []).forEach((row) => {
    check({ table: 'artifact_files', row, field: 'submissionId', targetSet: submissionIds, optional: false });
  });
  return issues;
}

export function managedPersistenceAdapterStatus(env = globalThis.process?.env || {}) {
  const driver = String(env.MANAGED_PERSISTENCE_ADAPTER_DRIVER || env.MANAGED_PERSISTENCE_DRIVER || 'local-shadow')
    .trim()
    .toLowerCase()
    || 'local-shadow';
  const databaseUrl = env.MANAGED_PERSISTENCE_DATABASE_URL || '';
  const httpEndpoint = env.MANAGED_PERSISTENCE_HTTP_ENDPOINT || env.ADAPTER_GATEWAY_HTTP_ENDPOINT || '';
  const requireRealAdapter = parseBoolean(env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER);
  const supportedLocalDrivers = ['local-shadow'];
  const supportedExternalDrivers = ['postgres', 'http-json'];
  const localDriver = supportedLocalDrivers.includes(driver);
  const externalDriver = supportedExternalDrivers.includes(driver);
  const externalConfigured = driver === 'postgres'
    ? Boolean(databaseUrl)
    : driver === 'http-json'
      ? Boolean(httpEndpoint)
      : false;
  const gatewayExecutionSupported = driver === 'http-json' && Boolean(httpEndpoint);
  const executableInCurrentRuntime = localDriver;
  const productionCutoverReady = false;
  const missingConfiguration = externalDriver && !externalConfigured;
  const unsupportedDriver = !localDriver && !externalDriver;
  const status = unsupportedDriver
    ? 'unsupported-adapter-driver'
    : localDriver
      ? 'local-shadow-ready-production-blocked'
      : missingConfiguration
        ? 'external-adapter-missing-configuration'
        : gatewayExecutionSupported
          ? 'http-json-gateway-configured-production-blocked'
          : 'external-adapter-configured-execution-not-yet-supported';

  return {
    schemaVersion: 'managed-persistence-adapter-status/v1',
    driver,
    status,
    sourceKind: localDriver ? 'local-shadow' : 'external-managed-adapter',
    configured: localDriver || externalConfigured,
    executableInCurrentRuntime,
    productionCutoverReady,
    requireRealAdapter,
    externalConfigured,
    gatewayExecutionSupported,
    missingConfiguration,
    unsupportedDriver,
    databaseUrlConfigured: Boolean(databaseUrl),
    httpEndpointConfigured: Boolean(httpEndpoint),
    redactedDatabaseUrl: redactConnectionValue(databaseUrl),
    redactedHttpEndpoint: redactConnectionValue(httpEndpoint),
    gatewayVerificationAvailable: true,
    gatewayValidationCommand: 'npm run adapters:gateway',
    requiredEnv: [
      'MANAGED_PERSISTENCE_ADAPTER_DRIVER=local-shadow|postgres|http-json',
      'MANAGED_PERSISTENCE_DATABASE_URL for postgres or MANAGED_PERSISTENCE_HTTP_ENDPOINT / ADAPTER_GATEWAY_HTTP_ENDPOINT for http-json',
      'ADAPTER_GATEWAY_AUTH_TOKEN when the private http-json gateway requires bearer authentication',
      'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER=true before production cutover approval',
    ],
    remainingProductionControls: [
      'Implement the selected managed database driver behind this facade.',
      'Run the product-team Harness against a real isolated database in shadow-read mode.',
      'Prove backup restore, rollback, RLS enforcement, and audit-stream continuity against the real database.',
    ],
  };
}

export function createManagedPersistenceAdapterFromEnv({
  env = globalThis.process?.env || {},
  now = () => new Date().toISOString(),
} = {}) {
  const status = managedPersistenceAdapterStatus(env);
  const adapter = createManagedPersistenceShadowAdapter({
    now,
    engine: status.sourceKind === 'local-shadow'
      ? 'local-shadow-managed-postgres-compatible'
      : `local-shadow-for-${status.driver}`,
  });
  return {
    adapter,
    status,
  };
}

export function createManagedPersistenceShadowAdapter({
  now = () => new Date().toISOString(),
  engine = 'local-shadow-managed-postgres-compatible',
} = {}) {
  let connected = false;
  let baseTables = new Map();
  let transaction = null;
  const backups = new Map();
  const receipts = [];
  const activeTables = () => transaction?.tables || baseTables;
  const receipt = (operation, payload = {}) => {
    const row = {
      schemaVersion: 'managed-persistence-adapter-operation-receipt/v1',
      operation,
      at: now(),
      ...payload,
    };
    row.checksum = checksum(row);
    receipts.push(row);
    return row;
  };

  return {
    schemaVersion: 'managed-persistence-adapter-implementation/v1',
    engine,
    connect(connectionConfig = {}) {
      connected = true;
      return receipt('connect', {
        connected,
        target: connectionConfig.target || 'local-shadow',
        redactedDsn: connectionConfig.dsn ? '[REDACTED]' : null,
      });
    },
    createSchema(tablePlans = []) {
      const tables = activeTables();
      tablePlans.forEach((plan) => {
        if (!plan?.table) return;
        tables.set(plan.table, {
          table: plan.table,
          primaryKey: Array.isArray(plan.primaryKey) && plan.primaryKey.length ? plan.primaryKey : ['id'],
          rlsDraft: plan.rlsDraft || '',
          rows: [],
          ids: new Set(),
        });
      });
      return receipt('createSchema', {
        tableCount: tablePlans.filter((plan) => plan?.table).length,
      });
    },
    beginTransaction(projectId) {
      transaction = {
        id: `managed_tx_${checksum({ projectId, at: now(), count: receipts.length })}`,
        projectId,
        startedAt: now(),
        tables: cloneTables(baseTables),
      };
      return receipt('beginTransaction', {
        transactionId: transaction.id,
        projectId,
      });
    },
    importBatch(table, rows = []) {
      const target = tableRows(activeTables(), table);
      const duplicates = [];
      const importedRows = [];
      rows.forEach((row) => {
        const normalized = normalizeRecord(table, row, transaction?.projectId);
        if (target.ids.has(String(normalized.id))) duplicates.push(normalized.id);
        target.ids.add(String(normalized.id));
        target.rows.push(normalized);
        importedRows.push(normalized);
      });
      return receipt('importBatch', {
        table,
        rowCount: importedRows.length,
        duplicateCount: duplicates.length,
        firstRecordId: importedRows[0]?.id || null,
        lastRecordId: importedRows.at(-1)?.id || null,
      });
    },
    readTable(table, projectId = null) {
      return (activeTables().get(table)?.rows || [])
        .filter((row) => !projectId || projectIdForRecord(row) === projectId)
        .map((row) => clone(row));
    },
    appendProjectEvent(eventRecord = {}) {
      return this.importBatch('project_event_ledger', [eventRecord]);
    },
    appendSecurityAuditStream(streamRecord = {}) {
      return this.importBatch('security_audit_stream', [streamRecord]);
    },
    writeAccessReplayRecord(replayRecord = {}) {
      return this.importBatch('access_replay_records', [replayRecord]);
    },
    writeReadModelCheckpoint(checkpoint = {}) {
      return this.importBatch('read_model_checkpoints', [checkpoint]);
    },
    verifyChecksums(projectId, sourceRecordsByTable = {}) {
      const mismatches = [];
      Object.entries(sourceRecordsByTable).forEach(([table, rows]) => {
        const importedById = new Map(this.readTable(table, projectId).map((row) => [String(row.id), row]));
        (rows || []).forEach((source) => {
          const imported = importedById.get(String(source.id));
          if (!imported || imported.checksum !== source.checksum) {
            mismatches.push({ table, id: source.id, sourceChecksum: source.checksum || null, importedChecksum: imported?.checksum || null });
          }
        });
      });
      return receipt('verifyChecksums', {
        projectId,
        mismatchCount: mismatches.length,
        mismatches: mismatches.slice(0, 20),
      });
    },
    verifyRelations(projectId) {
      const issues = relationIssuesForTables(activeTables())
        .filter((issue) => !projectId || this.readTable(issue.table, projectId).some((row) => row.id === issue.recordId));
      return receipt('verifyRelations', {
        projectId,
        issueCount: issues.length,
        issues: issues.slice(0, 20),
      });
    },
    verifyRowLevelPolicies(tablePlans = []) {
      const missing = tablePlans.filter((plan) => !plan.rlsDraft).map((plan) => plan.table);
      return receipt('verifyRowLevelPolicies', {
        tableCount: tablePlans.length,
        missingPolicyCount: missing.length,
        missingPolicies: missing,
      });
    },
    createBackup(projectId) {
      const backupId = `managed_backup_${checksum({ projectId, at: now(), count: backups.size })}`;
      backups.set(backupId, {
        id: backupId,
        projectId,
        createdAt: now(),
        tables: cloneTables(activeTables()),
      });
      return receipt('createBackup', {
        projectId,
        backupId,
        tableCount: activeTables().size,
      });
    },
    restoreBackup(projectId, backupId) {
      const backup = backups.get(backupId);
      if (!backup) {
        return receipt('restoreBackup', {
          projectId,
          backupId,
          restored: false,
          reason: 'backup-not-found',
        });
      }
      if (transaction) transaction.tables = cloneTables(backup.tables);
      else baseTables = cloneTables(backup.tables);
      return receipt('restoreBackup', {
        projectId,
        backupId,
        restored: true,
        tableCount: activeTables().size,
      });
    },
    compareShadowRead(projectId, shadowReadPlan = [], sourceRecordsByTable = {}) {
      const rows = shadowReadPlan.map((plan) => {
        const sourceRecordCount = (plan.tables || [])
          .reduce((sum, table) => sum + ((sourceRecordsByTable[table] || []).filter((row) => !projectId || projectIdForRecord(row) === projectId).length), 0);
        const adapterRecordCount = (plan.tables || [])
          .reduce((sum, table) => sum + this.readTable(table, projectId).length, 0);
        return {
          id: plan.id,
          route: plan.route || null,
          tables: plan.tables || [],
          sourceRecordCount,
          adapterRecordCount,
          parityReady: sourceRecordCount === adapterRecordCount && sourceRecordCount > 0,
          checksum: checksum({ id: plan.id, sourceRecordCount, adapterRecordCount, tables: plan.tables || [] }),
        };
      });
      return receipt('compareShadowRead', {
        projectId,
        groupCount: rows.length,
        parityCount: rows.filter((row) => row.parityReady).length,
        rows,
      });
    },
    commitCutover(projectId) {
      if (transaction) {
        baseTables = cloneTables(transaction.tables);
        transaction = null;
      }
      return receipt('commitCutover', {
        projectId,
        committed: true,
        tableCount: baseTables.size,
      });
    },
    rollbackCutover(projectId) {
      const rolledBack = Boolean(transaction);
      transaction = null;
      return receipt('rollbackCutover', {
        projectId,
        rolledBack,
        tableCount: baseTables.size,
      });
    },
    executionReceipt(projectId) {
      const tableCounts = Object.fromEntries([...activeTables().entries()].map(([table, state]) => [table, state.rows.length]));
      return {
        schemaVersion: 'managed-persistence-adapter-execution-receipt/v1',
        projectId,
        engine,
        connected,
        operationCount: receipts.length,
        tableCounts,
        receipts: receipts.map((row) => clone(row)),
        checksum: checksum({ projectId, engine, tableCounts, receipts }),
      };
    },
  };
}
