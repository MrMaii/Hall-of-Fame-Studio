import React from 'react';

export default function ProjectDashboardProjectEvidenceArchive({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-project-evidence-archive-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Project Evidence Archive')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'unknown')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForManagerHandoff ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForManagerHandoff ? text('ready') : text('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Manifest'), `${model.summary?.readyManifestEntryCount ?? 0}/${model.summary?.manifestEntryCount ?? 0}`],
          [text('Submissions'), model.summary?.submissionCount ?? 0],
          [text('Final Deliverables'), model.summary?.finalDeliverableCount ?? 0],
          [text('Evidence Searches'), model.summary?.evidenceSearchCount ?? 0],
          [text('Storage Proofs'), `${model.summary?.artifactStorageProofCount ?? 0}/${model.summary?.submissionCount ?? 0}`],
          [text('Workspace Files'), `${model.summary?.workspaceFileProofCount ?? 0}/${model.summary?.submissionCount ?? 0}`],
          [text('Source Decisions'), model.summary?.evidenceSourceReviewDecisionCount ?? 0],
          [text('Reviews'), model.summary?.submissionReviewCount ?? 0],
          [text('Transcript Messages'), model.summary?.transcriptMessageCount ?? 0],
          [text('Raw Leaks'), model.summary?.rawLeakCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`project-evidence-archive-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {text('Archive route')}: {routePath}
      </div>
    </div>
  );
}
