import React from 'react';

export default function ProjectDashboardEvidenceSourceReviewWorkflow({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-evidence-source-review-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Evidence Source Review Workflow</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'unknown')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilot ? text('local ready') : text('review blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Review Items'), model.summary?.reviewItemCount ?? 0],
          [text('Decision Required'), model.summary?.decisionRequiredSourceCount ?? 0],
          [text('Decisions'), model.summary?.sourceReviewDecisionCount ?? 0],
          [text('Approved'), model.summary?.approvedSourceReviewCount ?? 0],
          [text('Pending'), model.summary?.pendingDecisionSourceCount ?? 0],
          [text('Queued'), model.summary?.reviewRequiredSourceCount ?? 0],
          [text('Auto Cleared'), model.summary?.autoClearedSourceCount ?? 0],
          [text('Blocked Sources'), model.summary?.blockedSourceCount ?? 0],
          [text('Proof Routes'), `${model.summary?.proofedReviewItemCount ?? 0}/${model.summary?.reviewItemCount ?? 0}`],
          [text('Decision Gates'), `${(model.summary?.gateCount ?? 0) - (model.summary?.failedGateCount ?? 0)}/${model.summary?.gateCount ?? 0}`],
          [text('Source Safety'), model.summary?.sourceSafetyReady ? text('ready') : text('review')],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`evidence-source-review-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(model.reviewQueue?.length ? model.reviewQueue : model.requiredProductionControls || []).slice(0, 3).map(row => (
          <div key={`evidence-source-review-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.title || row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.reviewerAction || row.detail}</div>
              {(row.proofRoute?.apiPath || row.apiPath) && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.proofRoute?.apiPath || row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Source review route: {routePath}
      </div>
    </div>
  );
}
