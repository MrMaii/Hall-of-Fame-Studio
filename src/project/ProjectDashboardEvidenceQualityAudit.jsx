import React from 'react';

export default function ProjectDashboardEvidenceQualityAudit({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-evidence-quality-audit-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Evidence Quality Audit</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'unknown')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForDecision ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForDecision ? text('decision ready') : text('review needed')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Evidence Rows'), model.summary?.rowCount ?? 0],
          [text('Sources'), model.summary?.sourceCount ?? 0],
          [text('Quality'), model.summary?.averageQualityScore ?? 0],
          [text('Strong Evidence'), model.summary?.strongEvidenceCount ?? 0],
          [text('Usable Evidence'), model.summary?.usableEvidenceCount ?? 0],
          [text('Source Safety'), model.summary?.sourceSafetyReady ? text('ready') : text('review')],
          [text('Blocked Sources'), model.summary?.sourceSafetyBlockedSourceCount ?? 0],
          [text('Proof Routes'), `${model.summary?.readyProofRouteCount ?? 0}/${model.summary?.proofRouteCount ?? 0}`],
          [text('Decision Gates'), `${(model.summary?.gateCount ?? 0) - (model.summary?.failedGateCount ?? 0)}/${model.summary?.gateCount ?? 0}`],
          [text('Failed Decision'), model.summary?.failedDecisionGateCount ?? 0],
          [text('Production Controls'), model.summary?.productionControlCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`evidence-quality-audit-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(model.failedDecisionGates?.length ? model.failedDecisionGates : model.requiredProductionControls || []).slice(0, 3).map(row => (
          <div key={`evidence-quality-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Audit route: {routePath}
      </div>
    </div>
  );
}
