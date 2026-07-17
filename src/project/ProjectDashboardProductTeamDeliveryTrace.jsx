import React from 'react';

export default function ProjectDashboardProductTeamDeliveryTrace({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-product-team-delivery-trace-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Product Team Delivery Trace')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'product-team-delivery-trace-incomplete')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForPrivatePilotDelivery ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForPrivatePilotDelivery ? text('trace closed') : text('trace open')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Ready Rows'), `${model.summary?.readyCount ?? 0}/${model.summary?.rowCount ?? 0}`],
          [text('Missing Rows'), model.summary?.missingCount ?? 0],
          [text('Brainstorm Options'), model.summary?.brainstormAlternativeCount ?? 0],
          [text('Evidence Searches'), model.summary?.evidenceSearchCount ?? 0],
          [text('Generated Drafts'), model.summary?.generatedDraftCount ?? 0],
          [text('Review Rounds'), model.summary?.reviewRoundCount ?? 0],
          [text('Revisions'), model.summary?.revisionResponseCount ?? 0],
          [text('Final Accepted'), model.summary?.acceptedFinalDeliverableCount ?? 0],
          [text('Proofs'), model.summary?.proofIdCount ?? 0],
          [text('Timeline'), model.summary?.timelineLogIdCount ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`product-team-delivery-trace-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(model.rows || []).slice(0, 8).map(row => (
          <div key={`product-team-delivery-trace-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(`${row.stage || 'stage'} / proofs ${(row.proofIds || []).length}`)}</div>
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{text(row.status || 'missing')}</span>
          </div>
        ))}
      </div>
      <div data-testid="backend-product-team-delivery-trace-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Trace route: {routePath}
      </div>
    </div>
  );
}
