import React from 'react';

export default function ProjectDashboardOperationsReadiness({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendOperationsReadiness = {},
    backendPersistenceAdapterDryRun,
    backendPersistenceAdapterPlan,
    backendWorkerQueueAdapterDryRun,
    backendWorkerQueueAdapterPlan,
    managerReadModelSourceBadge,
  } = view;

  return (
    <div data-testid="backend-operations-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Operations Readiness</div>
          <div className="font-serif text-base leading-tight">{backendOperationsReadiness.status || 'unknown'} / production blocked</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {managerReadModelSourceBadge(backendOperationsReadiness, 'backend-operations-readiness-source')}
          <span className={`node-status-tag ${backendOperationsReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendOperationsReadiness.readyForLocalPilot ? 'Local Ops Ready' : 'Needs Ops Work'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Gates', `${backendOperationsReadiness.summary?.passedGateCount ?? 0}/${backendOperationsReadiness.summary?.gateCount ?? 0}`],
          ['DB Adapter Plan', backendPersistenceAdapterPlan?.status || (backendOperationsReadiness.summary?.persistenceAdapterPlanReady ? 'ready' : 'blocked')],
          ['DB Adapter Dry Run', backendPersistenceAdapterDryRun?.status || backendOperationsReadiness.summary?.persistenceAdapterDryRunStatus || 'unknown'],
          ['DB Driver', backendPersistenceAdapterDryRun?.summary?.adapterDriver || backendOperationsReadiness.summary?.persistenceAdapterDriver || 'unknown'],
          ['DB Cutover', (backendPersistenceAdapterDryRun?.summary?.adapterProductionCutoverReady ?? backendOperationsReadiness.summary?.persistenceAdapterProductionCutoverReady) ? 'ready' : 'blocked'],
          ['Shadow Reads', `${backendPersistenceAdapterDryRun?.summary?.shadowReadParityCount ?? backendOperationsReadiness.summary?.persistenceAdapterShadowReadParityCount ?? 0}/${backendPersistenceAdapterDryRun?.summary?.shadowReadGroupCount ?? backendOperationsReadiness.observability?.metrics?.persistenceAdapterShadowReadGroupCount ?? 0}`],
          ['Rollback', (backendPersistenceAdapterDryRun?.summary?.transactionRollbackReady ?? backendOperationsReadiness.summary?.persistenceAdapterRollbackReady) ? 'ready' : 'blocked'],
          ['Backup Restore', (backendPersistenceAdapterDryRun?.summary?.backupRestoreReady ?? backendOperationsReadiness.summary?.persistenceAdapterBackupRestoreReady) ? 'ready' : 'blocked'],
          ['DB Adapter Ops', backendPersistenceAdapterDryRun?.summary?.adapterOperationCount ?? backendOperationsReadiness.summary?.persistenceAdapterOperationCount ?? 0],
          ['DB Tables', backendPersistenceAdapterDryRun?.summary?.adapterImportedTableCount ?? backendOperationsReadiness.summary?.persistenceAdapterImportedTableCount ?? 0],
          ['Adapter Plan', backendWorkerQueueAdapterPlan?.status || (backendOperationsReadiness.summary?.queueAdapterPlanReady ? 'ready' : 'blocked')],
          ['Adapter Dry Run', backendWorkerQueueAdapterDryRun?.status || backendOperationsReadiness.summary?.queueAdapterDryRunStatus || 'unknown'],
          ['Queue Driver', backendWorkerQueueAdapterDryRun?.summary?.adapterDriver || backendOperationsReadiness.summary?.queueAdapterDriver || 'unknown'],
          ['Queue Cutover', (backendWorkerQueueAdapterDryRun?.summary?.adapterProductionCutoverReady ?? backendOperationsReadiness.summary?.queueAdapterProductionCutoverReady) ? 'ready' : 'blocked'],
          ['Adapter Gates', backendWorkerQueueAdapterDryRun?.summary?.failedGateCount ?? backendOperationsReadiness.summary?.queueAdapterFailedGateCount ?? 0],
          ['Queue Ops', backendWorkerQueueAdapterDryRun?.summary?.adapterOperationCount ?? backendOperationsReadiness.summary?.queueAdapterOperationCount ?? 0],
          ['Queue Rows', backendWorkerQueueAdapterDryRun?.summary?.adapterQueueRowCount ?? backendOperationsReadiness.summary?.queueAdapterQueueRowCount ?? 0],
          ['Dispatches', backendWorkerQueueAdapterDryRun?.summary?.dispatchCount ?? backendOperationsReadiness.summary?.queueAdapterDispatchCount ?? 0],
          ['Leases', backendWorkerQueueAdapterDryRun?.summary?.leaseAcquisitionCount ?? backendOperationsReadiness.summary?.queueAdapterLeaseAcquisitionCount ?? 0],
          ['Snapshot Parity', (backendWorkerQueueAdapterDryRun?.summary?.snapshotParityReady ?? backendOperationsReadiness.summary?.queueAdapterSnapshotParityReady) ? 'ready' : 'blocked'],
          ['Lease Parity', (backendWorkerQueueAdapterDryRun?.summary?.snapshotLeaseParityReady ?? backendOperationsReadiness.summary?.queueAdapterSnapshotLeaseParityReady) ? 'ready' : 'blocked'],
          ['Worker Runs', backendOperationsReadiness.summary?.workerRunCount ?? 0],
          ['Receipts', backendOperationsReadiness.summary?.workerExecutionReceiptCount ?? 0],
          ['Retryable', backendOperationsReadiness.summary?.workerRetryableFailureCount ?? 0],
          ['Dead Letters', backendOperationsReadiness.summary?.workerDeadLetterCount ?? 0],
          ['Recovery', backendOperationsReadiness.summary?.workerRecoveryContractReady ? 'ready' : 'blocked'],
          ['Incident Drill', backendOperationsReadiness.summary?.incidentDrillReady ? 'ready' : 'blocked'],
          ['Drill Receipts', `${backendOperationsReadiness.summary?.incidentDrillReceiptCount ?? 0}/${backendOperationsReadiness.summary?.incidentDrillFailedReceiptCount ?? 0}`],
          ['Drill Alerts', `${backendOperationsReadiness.summary?.incidentDrillRoutedAlertRuleCount ?? 0}/${backendOperationsReadiness.summary?.alertRuleCount ?? 0}`],
          ['Max Attempts', backendOperationsReadiness.observability?.metrics?.workerMaxAttempts ?? 0],
          ['Alerts', backendOperationsReadiness.summary?.alertRuleCount ?? 0],
        ].map(([label, value]) => (
          <div key={`operations-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(backendOperationsReadiness.failedGates?.length ? backendOperationsReadiness.failedGates : backendOperationsReadiness.observability?.alertRules || []).slice(0, 3).map(row => (
          <div key={`operations-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.condition}</div>
              {(row.apiPath || row.route) && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath || row.route}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'watch'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Operations route: {backendManagerReadyPackage.backendRoutes?.operationsReadiness || `/projects/${activeProject.id}/operations-readiness`}
      </div>
    </div>
  );
}
