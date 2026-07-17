import React from 'react';
import { CheckCircle2, CornerDownRight, Search } from 'lucide-react';

export default function ProjectDashboardManagerScenarioTrail({ view = {} }) {
  const {
    backendWorkerStationSyncDisabled,
    managerReadModelSourceBadge,
    managerScenarioTrail,
    managerScenarioTrailDisplayRows,
    onOpenRow,
    onSyncTrail,
  } = view;

  return (
    <div data-testid="manager-scenario-trail" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Scenario Trail</div>
          <div className="font-serif text-2xl leading-tight">One end-to-end route from kickoff meeting to continuous Agent work and mid-project change sync.</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {managerReadModelSourceBadge(managerScenarioTrail, 'manager-scenario-trail-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {managerScenarioTrail.passedCount ?? managerScenarioTrailDisplayRows.filter(row => row.passed).length}/{managerScenarioTrail.count ?? managerScenarioTrailDisplayRows.length} ready
          </span>
        </div>
      </div>
      {managerScenarioTrail.frontendMockSuppressed && (
        <div data-testid="manager-scenario-trail-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Manager Scenario Trail is required for this real project. Local scenario rows are suppressed until /manager-scenario-trail returns manager-scenario-trail/v1.
          <button
            type="button"
            data-testid="manager-scenario-trail-sync-read-model"
            onClick={onSyncTrail}
            disabled={backendWorkerStationSyncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search size={10} /> Sync Trail
          </button>
        </div>
      )}
      <div className="space-y-2">
        {managerScenarioTrailDisplayRows.map((row, index) => (
          <div key={`manager-scenario-trail-${row.id}`} data-testid={`manager-scenario-trail-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.passed ? 'border-green-700 bg-green-700 text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                  {row.passed ? <CheckCircle2 size={13} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg leading-tight">{row.stage}</span>
                  <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.outcome}</span>
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{row.passed ? 'Ready' : 'Needs Proof'}</span>
                <button
                  type="button"
                  data-testid={`manager-scenario-trail-proof-${row.id}`}
                  onClick={() => onOpenRow(row)}
                  disabled={!(row.proofIds?.length || row.timelineIds?.length || row.timelineLogIds?.length)}
                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CornerDownRight size={10} /> Trail proof
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
