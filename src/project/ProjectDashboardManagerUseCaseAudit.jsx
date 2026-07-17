import React from 'react';
import { CheckCircle2, CornerDownRight, Play, Search } from 'lucide-react';

export default function ProjectDashboardManagerUseCaseAudit({ view = {} }) {
  const {
    activeProject,
    backendCommandAvailable = false,
    backendStation = {},
    backendWorkerStationSyncDisabled = false,
    managerReadModelSourceBadge,
    managerUseCaseAudit = {},
    openManagerUseCaseAuditRow,
    runManagerActionPlaybookRow,
    syncBackendManagerUseCaseAudit,
  } = view;

  return (
    <div data-testid="manager-use-case-audit" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Use Case Audit</div>
          <div className="font-serif text-2xl leading-tight">The user story translated into manager-readable coverage checks and proof exits.</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {managerReadModelSourceBadge(managerUseCaseAudit, 'manager-use-case-audit-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {managerUseCaseAudit.coveredCount || 0}/{managerUseCaseAudit.count || 0} covered
          </span>
        </div>
      </div>
      {managerUseCaseAudit.frontendMockSuppressed && (
        <div data-testid="manager-use-case-audit-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Manager Use Case Audit is required for this real project. Local use-case rows are suppressed until /manager-use-case-audit returns manager-use-case-audit/v1.
          <button
            type="button"
            data-testid="manager-use-case-audit-sync-read-model"
            onClick={() => syncBackendManagerUseCaseAudit({ silent: false, projectId: activeProject.id })}
            disabled={backendWorkerStationSyncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search size={10} /> Sync Audit
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {(managerUseCaseAudit.rows || []).map((row, index) => (
          <div key={`manager-use-case-${row.id}`} data-testid={`manager-use-case-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.status === 'covered' ? 'border-green-700 bg-green-700 text-white' : row.status === 'partial' ? 'border-[#b9782b] bg-[#b9782b] text-white' : 'border-[#8f1e18] bg-[#f7edcf] text-[#8f1e18]'}`}>
                  {row.status === 'covered' ? <CheckCircle2 size={13} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-base leading-tight">{row.stage}</span>
                  <span className="mt-1 block font-serif text-sm leading-tight text-[#4a3827]">{row.managerQuestion}</span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    {row.coveredCount}/{row.requirementCount} requirements / {row.status}
                  </span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                    Next action: {row.nextAction?.label || 'No runnable action'} / Runnable actions: {row.runnableActionCount || 0}
                  </span>
                  {row.nextAction?.runApiPath && (
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                      Run route: {row.nextAction.runApiPath}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`node-status-tag ${row.status === 'covered' ? 'bg-green-700 text-white' : row.status === 'partial' ? 'bg-[#b9782b] text-white' : 'bg-[#8f1e18] text-white'}`}>{row.status}</span>
                <button
                  type="button"
                  data-testid={`manager-use-case-run-${row.id}`}
                  onClick={() => runManagerActionPlaybookRow(row.nextAction)}
                  disabled={!backendCommandAvailable || backendStation.loading || !row.nextAction?.canRun || row.nextAction?.routeResolved === false || String(row.nextAction?.apiPath || '').includes(':')}
                  className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={10} /> Run use case action
                </button>
                <button
                  type="button"
                  data-testid={`manager-use-case-proof-${row.id}`}
                  onClick={() => openManagerUseCaseAuditRow(row)}
                  disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length)}
                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CornerDownRight size={10} /> Use case proof
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
