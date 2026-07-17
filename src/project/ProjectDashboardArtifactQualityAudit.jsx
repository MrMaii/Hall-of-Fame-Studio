import React from 'react';

export default function ProjectDashboardArtifactQualityAudit({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-artifact-quality-audit-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Artifact Quality Audit')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'unknown')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilot ? text('local ready') : text('review needed')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Submissions'), model.summary?.submissionCount ?? 0],
          [text('Types'), `${model.summary?.coveredArtifactTypeCount ?? 0}/${model.summary?.requiredArtifactTypeCount ?? 0}`],
          [text('Quality'), model.summary?.averageQualityScore ?? 0],
          [text('Quality Ready'), `${model.summary?.qualityReadyCount ?? 0}/${model.summary?.submissionCount ?? 0}`],
          [text('Proof Ready'), `${model.summary?.proofReadyCount ?? 0}/${model.summary?.submissionCount ?? 0}`],
          [text('Reviews'), model.summary?.reviewCount ?? 0],
          [text('Revisions'), model.summary?.revisionCount ?? 0],
          [text('Generated Drafts'), `${model.summary?.generatedDraftQualityReadyCount ?? 0}/${model.summary?.generatedDraftCount ?? 0}`],
          [text('Failed Gates'), model.summary?.failedLocalDecisionGateCount ?? 0],
          [text('Production Controls'), model.summary?.productionControlCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`artifact-quality-audit-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-artifact-quality-audit-types" className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-1">
        {(model.requiredArtifactTypes || []).map(type => {
          const missing = (model.missingRequiredArtifactTypes || []).includes(type);
          return (
            <div key={`artifact-quality-type-${type}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{type}</div>
              <span className={`node-status-tag ${missing ? 'bg-[#8f1e18] text-white' : 'bg-[#59684b] text-white'}`}>
                {missing ? text('missing') : text('present')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 space-y-1">
        {(model.failedLocalDecisionGates?.length ? model.failedLocalDecisionGates : model.requiredProductionControls || []).slice(0, 3).map(row => (
          <div key={`artifact-quality-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || '')}</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status || row.severity || 'watch'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Audit route: {routePath}
      </div>
    </div>
  );
}
