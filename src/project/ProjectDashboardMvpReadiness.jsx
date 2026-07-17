import React from 'react';

export default function ProjectDashboardMvpReadiness({ view = {} }) {
  const {
    activeProject,
    backendCommandAvailable = false,
    backendManagerReadyPackage = {},
    backendMvpReadiness = {},
    backendMvpReadinessOperatorActionRunReceipt,
    backendStation = {},
    runMvpReadinessOperatorAction,
  } = view;

  return (
    <div data-testid="backend-mvp-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">MVP Readiness</div>
          <div className="font-serif text-base leading-tight">{backendMvpReadiness.status || 'unknown'} / {backendMvpReadiness.production?.status || 'production-blocked'}</div>
        </div>
        <span className={`node-status-tag ${backendMvpReadiness.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
          {backendMvpReadiness.readyForLocalPilot ? 'Local Pilot Ready' : 'Core Blocked'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Core', `${backendMvpReadiness.localPilot?.passedCount ?? 0}/${backendMvpReadiness.localPilot?.totalCount ?? 0}`],
          ['Core Blockers', backendMvpReadiness.localPilot?.blockerCount ?? 0],
          ['Production Blockers', backendMvpReadiness.production?.blockerCount ?? 0],
          ['Next Action', backendMvpReadiness.nextShortestPath?.id || 'none'],
        ].map(([label, value]) => (
          <div key={`mvp-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      {backendMvpReadiness.operatorActions?.length > 0 && (
        <div data-testid="mvp-readiness-operator-actions" className="mt-2 space-y-1">
          {backendMvpReadiness.operatorActions.slice(0, 3).map(action => (
            <div key={`mvp-operator-action-${action.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">{action.label || action.id}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{action.scope || 'mvp'} / {action.owner || 'manager'} / {action.method || 'GET'}</div>
                {action.apiPath && (
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {action.apiPath}</div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`node-status-tag ${action.productionBlocker ? 'bg-[#8f1e18] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{action.status || 'queued'}</span>
                <button
                  type="button"
                  data-testid={`mvp-readiness-operator-action-run-${action.id}`}
                  onClick={() => runMvpReadinessOperatorAction(action)}
                  disabled={!backendCommandAvailable || backendStation.loading}
                  className="border border-[#251b13] bg-[#251b13] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] disabled:opacity-40"
                >
                  Record
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {backendMvpReadinessOperatorActionRunReceipt && (
        <div data-testid="mvp-readiness-operator-action-receipt" className={`mt-2 border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${backendMvpReadinessOperatorActionRunReceipt.status === 'failed' ? 'border-red-800 bg-red-50 text-[#8f1e18]' : 'border-[#d8c99f] bg-[#fff8df] text-[#6b5a3d]'}`}>
          {backendMvpReadinessOperatorActionRunReceipt.status === 'failed'
            ? `Action failed: ${backendMvpReadinessOperatorActionRunReceipt.actionLabel || backendMvpReadinessOperatorActionRunReceipt.actionId} / no local operator receipt was created / ${backendMvpReadinessOperatorActionRunReceipt.error || 'backend run failed'}`
            : `Receipt: ${backendMvpReadinessOperatorActionRunReceipt.actionLabel || backendMvpReadinessOperatorActionRunReceipt.actionId} / ${backendMvpReadinessOperatorActionRunReceipt.status || 'recorded'} / ${backendMvpReadinessOperatorActionRunReceipt.runApiPath || 'run route pending'} / target ${backendMvpReadinessOperatorActionRunReceipt.targetStageId || 'manual'}`}
        </div>
      )}
      <div className="mt-2 space-y-1">
        {(backendMvpReadiness.blockerRows?.length ? backendMvpReadiness.blockerRows : backendMvpReadiness.production?.rows || []).slice(0, 3).map(row => (
          <div key={`mvp-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        MVP route: {backendManagerReadyPackage.backendRoutes?.mvpReadiness || `/projects/${activeProject.id}/mvp-readiness`}
      </div>
    </div>
  );
}
