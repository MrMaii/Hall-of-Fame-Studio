import React from 'react';

export default function ProjectDashboardEvidenceIndexReadiness({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-evidence-index-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Evidence Index Readiness')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'local-evidence-index-incomplete')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalMvp ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalMvp ? text('local index ready') : text('index blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Index Rows'), model.summary?.rowCount ?? 0],
          [text('Evidence Searches'), model.summary?.evidenceSearchCount ?? 0],
          [text('Submissions'), model.summary?.submissionCount ?? 0],
          [text('Source Snapshots'), model.summary?.sourceSnapshotCount ?? 0],
          [text('Provider Receipts'), model.summary?.providerReceiptCount ?? 0],
          [text('Storage Proofs'), model.summary?.artifactStorageProofCount ?? 0],
          [text('Proof Routes'), `${model.summary?.proofLinkedCount ?? 0}/${model.summary?.proofRouteCount ?? 0}`],
          [text('Failed Local Gates'), model.summary?.failedLocalGateCount ?? 0],
          [text('Production'), model.readyForProduction ? text('ready') : text('blocked')],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`evidence-index-readiness-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(model.failedLocalGates?.length ? model.failedLocalGates : model.gates || []).slice(0, 4).map(row => (
          <div key={`evidence-index-readiness-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || '')}</div>
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : row.severity === 'production-blocker' ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>{text(row.status || (row.passed ? 'passed' : 'blocked'))}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {text('Index route')}: {routePath}
      </div>
    </div>
  );
}
