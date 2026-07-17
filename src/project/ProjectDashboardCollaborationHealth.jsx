import React from 'react';
import { CheckCircle2, FileText } from 'lucide-react';

export default function ProjectDashboardCollaborationHealth({ view = {} }) {
  const {
    health,
    managerReadModelSourceBadge,
    onSyncDiagnostics,
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Collaboration Health</div>
          <div className="font-serif text-4xl leading-none">{health.score}%</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(health, 'collaboration-health-source')}
          <div className={`font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${
            health.status === 'healthy'
              ? 'border-green-700 text-green-800 bg-green-50'
              : 'border-[#8f1e18] text-[#8f1e18] bg-[#efe2bd]'
          }`}>
            {health.status}
          </div>
        </div>
      </div>
      {health.frontendMockSuppressed && (
        <div data-testid="collaboration-health-backend-required" className="mb-3 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Team Collaboration Diagnostics required. Local collaboration health is suppressed for this backend project.</span>
          <button
            type="button"
            data-testid="collaboration-health-sync-diagnostics"
            onClick={onSyncDiagnostics}
            disabled={syncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={10} /> Sync Proof Models
          </button>
        </div>
      )}
      <div className="space-y-2">
        {health.checks.map(check => (
          <div key={check.id} className="flex items-start gap-3 border-t border-[#d8c99f] pt-2">
            <CheckCircle2 size={14} className={check.passed ? 'text-green-700 mt-0.5' : 'text-[#8f1e18] mt-0.5'} />
            <div className="min-w-0">
              <div className="font-serif text-base leading-tight">{check.label}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">{check.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
