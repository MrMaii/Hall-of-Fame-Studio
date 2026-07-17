import React from 'react';
import { CheckCircle2, FileText } from 'lucide-react';

export default function ProjectDashboardManagerScenarioReadiness({ view = {} }) {
  const {
    checks,
    managerReadModelSourceBadge,
    onSyncProofMap,
    proofMap,
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Scenario Readiness</div>
          <div className="font-serif text-4xl leading-none">{proofMap.score ?? 0}%</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(proofMap, 'manager-scenario-readiness-source')}
          <div className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${
            proofMap.status === 'manager-ready'
              ? 'border-green-700 text-green-800 bg-green-50'
              : 'border-[#8f1e18] text-[#8f1e18] bg-[#efe2bd]'
          }`}>
            {proofMap.status} / {proofMap.passedCount ?? 0}-{proofMap.totalCount ?? 0}
          </div>
        </div>
      </div>
      {proofMap.frontendMockSuppressed && (
        <div data-testid="manager-scenario-readiness-backend-required" className="mb-3 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Readiness Proof Map required. Local scenario readiness is suppressed for this backend project.
          <button
            type="button"
            data-testid="manager-scenario-readiness-sync-proof-map"
            onClick={onSyncProofMap}
            disabled={syncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={10} /> Sync Proof Map
          </button>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-2">
        {checks.map(check => (
          <div key={check.id} className="border-t border-[#d8c99f] pt-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={14} className={check.passed ? 'text-green-700 mt-0.5' : 'text-[#8f1e18] mt-0.5'} />
              <div className="min-w-0">
                <div className="font-serif text-base leading-tight">{check.label}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{check.detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
