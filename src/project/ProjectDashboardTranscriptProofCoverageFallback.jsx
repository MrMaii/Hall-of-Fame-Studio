import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function ProjectDashboardTranscriptProofCoverageFallback({
  summary = {},
  transcriptRoute,
  onOpen,
  openDisabled,
}) {
  return (
    <div data-testid="backend-transcript-proof-coverage-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase text-[#8f1e18]">Transcript Proof Coverage</div>
          <div className="font-serif text-base leading-tight">
            {summary.readyForBackendTranscriptProof
              ? 'Backend transcript proof is complete'
              : (summary.expectedProofIdCount || 0) > 0
                ? 'Backend transcript proof has gaps'
                : 'No work-node transcript proof yet'}
          </div>
        </div>
        <span className={`node-status-tag ${summary.readyForBackendTranscriptProof ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
          {summary.readyForBackendTranscriptProof ? 'Backend Transcript Ready' : 'Needs Backend Transcript'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Expected', summary.expectedProofIdCount ?? 0],
          ['Archived', summary.archivedProofIdCount ?? 0],
          ['Missing', summary.missingProofIdCount ?? 0],
          ['Submissions', summary.submissionProofIdCount ?? 0],
          ['Evidence', summary.evidenceSearchProofIdCount ?? 0],
          ['Source Reviews', summary.evidenceSourceReviewProofIdCount ?? 0],
          ['Submission Reviews', summary.submissionReviewProofIdCount ?? 0],
          ['Route', summary.routeReady ? 'ready' : 'missing'],
        ].map(([label, value]) => (
          <div key={`transcript-proof-coverage-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="backend-transcript-proof-coverage-open"
          onClick={onOpen}
          disabled={openDisabled}
          className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MessageSquare size={10} /> Open transcript coverage proof
        </button>
        <span className="font-mono text-[8px] uppercase text-[#9b875c]">
          Transcript route: {transcriptRoute}
        </span>
      </div>
      {summary.missingProofIds?.length > 0 && (
        <div className="mt-2 font-mono text-[8px] uppercase text-[#8f1e18] break-words">
          Missing proof ids: {summary.missingProofIds.slice(0, 4).join(', ')}
        </div>
      )}
    </div>
  );
}
