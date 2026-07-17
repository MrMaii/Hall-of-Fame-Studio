import React from 'react';
import { CheckCircle2, MessageSquare } from 'lucide-react';

export default function ProjectDashboardTranscriptProofCoverage({ view = {} }) {
  const {
    onOpen,
    proofIds,
    ready,
    sourceBadge,
    summary,
    syncButton,
  } = view;

  return (
    <div data-testid="proof-map-transcript-proof-coverage" className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 size={14} className={ready ? 'text-green-700' : 'text-[#8f1e18]'} />
            <div className="font-serif text-base leading-tight">Backend transcript proof coverage</div>
            {sourceBadge}
            <span className={`node-status-tag ${ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
              {ready ? 'Ready' : 'Needs proof'}
            </span>
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
            Transcript coverage / {summary.archivedProofIdCount ?? 0} archived of {summary.expectedProofIdCount ?? 0} expected, {summary.missingProofIdCount ?? 0} missing
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          {syncButton}
          <button
            type="button"
            data-testid="proof-map-transcript-proof-coverage-open"
            onClick={onOpen}
            disabled={!proofIds.length}
            className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageSquare size={10} />
            Transcript coverage proof
          </button>
        </div>
      </div>
    </div>
  );
}
