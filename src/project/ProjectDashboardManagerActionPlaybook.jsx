import React from 'react';
import { CheckCircle2, ClipboardList, CornerDownRight, Play } from 'lucide-react';

export default function ProjectDashboardManagerActionPlaybook({ view = {} }) {
  const {
    backendCommandAvailable,
    backendStation,
    backendWorkerStationSyncDisabled,
    managerActionPlaybook,
    managerReadModelSourceBadge,
    onOpenRow,
    onRunRow,
    onSyncActionQueue,
    projectText,
  } = view;

  return (
    <div data-testid="manager-action-playbook" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Action Playbook</div>
          <div className="font-serif text-2xl leading-tight">Operational next steps mapped to runnable backend routes and exact proof exits.</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {managerReadModelSourceBadge(managerActionPlaybook, 'manager-action-playbook-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0} complete`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          ['Complete', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.completedCount ?? 0],
          ['Ready', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.readyCount ?? 0],
          ['Blocked', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.blockedCount ?? 0],
          ['Next', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.nextAction?.label || 'All complete'],
        ].map(([label, value]) => (
          <div key={`manager-action-playbook-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-base leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      {managerActionPlaybook.frontendMockSuppressed && (
        <div data-testid="manager-action-playbook-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Manager Action Queue is required for this real project. Local action rows are suppressed until /manager-action-queue returns manager-action-queue/v1.</span>
          <button
            type="button"
            data-testid="manager-action-playbook-sync-action-queue"
            onClick={onSyncActionQueue}
            disabled={backendWorkerStationSyncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ClipboardList size={10} /> Sync Queue
          </button>
        </div>
      )}
      <div className="space-y-2">
        {(managerActionPlaybook.rows || []).map((row, index) => (
          <div key={`manager-action-playbook-${row.id}`} data-testid={`manager-action-playbook-row-${row.requirementId || row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.status === 'complete' ? 'border-green-700 bg-green-700 text-white' : row.status === 'ready' ? 'border-[#8f1e18] bg-[#8f1e18] text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                  {row.status === 'complete' ? <CheckCircle2 size={13} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg leading-tight">{row.label}</span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    {row.phase} / {row.status} / {row.evidence || row.description}
                  </span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                    {row.method} {row.apiPath} / {row.routeResolved === false ? 'needs context' : 'route resolved'}{row.rerunnable ? ' / rerunnable' : ''}
                  </span>
                  {row.runApiPath && row.method !== 'GET' && (
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                      Run route: {row.runApiPath}
                    </span>
                  )}
                  {row.requestBodyTemplate && (
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                      {projectText('Body template')}: {projectText(JSON.stringify(row.requestBodyTemplate))}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid={`manager-action-playbook-run-${row.requirementId || row.id}`}
                  onClick={() => onRunRow(row)}
                  disabled={!backendCommandAvailable || backendStation.loading || !row.canRun || row.routeResolved === false || String(row.apiPath || '').includes(':')}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={10} /> {projectText(row.status === 'complete' && row.rerunnable ? 'Run Again' : 'Run Action')}
                </button>
                <button
                  type="button"
                  data-testid={`manager-action-playbook-open-${row.requirementId || row.id}`}
                  onClick={() => onOpenRow(row)}
                  disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length || row.uiTarget)}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CornerDownRight size={10} /> Open Step
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
