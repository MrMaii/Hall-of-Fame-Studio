import React from 'react';
import { CheckCircle2, CornerDownRight, Network, Play } from 'lucide-react';

export default function ProjectDashboardManagerScenarioWalkthrough({ view = {} }) {
  const {
    backendCommandAvailable,
    backendStation,
    backendWorkerStationSyncDisabled,
    managerActionPlaybook,
    managerReadModelSourceBadge,
    managerScenarioWalkthrough,
    managerScenarioWalkthroughReceipt,
    onOpenRow,
    onRunResultProof,
    onRunRow,
    onSyncWalkthrough,
    projectText,
  } = view;

  return (
    <div data-testid="manager-scenario-walkthrough" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Manager Scenario Walkthrough')}</div>
          <div className="font-serif text-2xl leading-tight">{projectText('A single guided path from kickoff meeting to 24/7 Agent work, change intake, and mutual management.')}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {managerReadModelSourceBadge(managerScenarioWalkthrough, 'manager-scenario-walkthrough-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : `${managerScenarioWalkthrough.completedCount || 0}/${managerScenarioWalkthrough.count || 0} ${projectText('complete')}`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {[
          ['Next Gap', managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : managerScenarioWalkthrough.nextIncompleteStep?.stage || 'All covered'],
          ['Rerunnable', managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : managerScenarioWalkthrough.nextRunnableStep?.stage || 'None'],
          ['Runnable', managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : managerScenarioWalkthrough.runnableCount || 0],
          ['Action Queue', managerScenarioWalkthrough.frontendMockSuppressed || managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0}`],
        ].map(([label, value]) => (
          <div key={`walkthrough-stat-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
            <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
          </div>
        ))}
      </div>
      {managerScenarioWalkthroughReceipt && (
        <div data-testid="manager-walkthrough-run-receipt" className="mb-4 border border-[#7b6542] bg-[#efe2bd]/70 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Walkthrough step ran: {managerScenarioWalkthroughReceipt.stage || managerScenarioWalkthroughReceipt.stepId} / {managerScenarioWalkthroughReceipt.actionLabel || 'primary action'} / {managerScenarioWalkthroughReceipt.runApiPath}
          <span className="mt-1 block">
            Result inspection: messages {managerScenarioWalkthroughReceipt.resultInspection?.messageCount || 0} / timeline proofs {(managerScenarioWalkthroughReceipt.resultInspection?.timelineLogIds || []).length} / task {managerScenarioWalkthroughReceipt.resultInspection?.taskId || 'none'} / cycle {managerScenarioWalkthroughReceipt.resultInspection?.cycleId || 'none'}
          </span>
          <button
            type="button"
            data-testid="manager-walkthrough-run-proof"
            onClick={onRunResultProof}
            disabled={!(managerScenarioWalkthroughReceipt.resultInspection?.timelineLogIds || []).length}
            className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CornerDownRight size={10} /> Run result proof
          </button>
        </div>
      )}
      {managerScenarioWalkthrough.frontendMockSuppressed && (
        <div data-testid="manager-scenario-walkthrough-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Scenario Walkthrough is required for this real project. Local walkthrough rows are suppressed until /manager-scenario-walkthrough returns manager-scenario-walkthrough/v1.
          <button
            type="button"
            data-testid="manager-scenario-walkthrough-sync-read-model"
            onClick={onSyncWalkthrough}
            disabled={backendWorkerStationSyncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Network size={10} /> Sync Walkthrough
          </button>
        </div>
      )}
      <div className="space-y-2">
        {(managerScenarioWalkthrough.rows || []).map((row, index) => (
          <div key={`manager-walkthrough-${row.id}`} data-testid={`manager-walkthrough-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.completed ? 'border-green-700 bg-green-700 text-white' : row.primaryAction?.canRun ? 'border-[#8f1e18] bg-[#8f1e18] text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                  {row.completed ? <CheckCircle2 size={13} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg leading-tight">{row.stage}</span>
                  <span className="mt-1 block font-serif text-sm leading-tight text-[#4a3827]">{row.managerIntent}</span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    {row.coveredCount || 0}/{row.requirementCount || 0} requirements / {row.status}
                  </span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                    Primary action: {row.primaryAction?.label || 'Proof review'} / Runnable actions: {row.runnableActionCount || 0}
                  </span>
                  {row.primaryAction?.runApiPath && (
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                      Manager route: {row.managerRoute || row.primaryAction.runApiPath} / Run route: {row.runApiPath || row.primaryAction.runApiPath}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid={`manager-walkthrough-run-${row.id}`}
                  onClick={() => onRunRow(row)}
                  disabled={!backendCommandAvailable || backendStation.loading || !row.primaryAction?.canRun || row.primaryAction?.routeResolved === false || String(row.primaryAction?.apiPath || '').includes(':')}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={10} /> Run walkthrough step
                </button>
                <button
                  type="button"
                  data-testid={`manager-walkthrough-proof-${row.id}`}
                  onClick={() => onOpenRow(row)}
                  disabled={!(row.proofIds?.length || row.timelineLogIds?.length || row.timelineIds?.length)}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CornerDownRight size={10} /> Walkthrough proof
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
