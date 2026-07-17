import React from 'react';

export default function ProjectDashboardBrainstormLayer({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-brainstorm-layer-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Brainstorm Layer')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'brainstorm-layer-needs-work')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForPrivatePilotBrainstorm ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForPrivatePilotBrainstorm ? text('local ready') : text('needs work')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Boards'), model.summary?.brainstormBoardCount ?? 0],
          [text('Alternatives'), model.summary?.alternativeCount ?? 0],
          [text('Participants'), model.summary?.participantCount ?? 0],
          [text('Evidence'), model.summary?.evidenceSearchCount ?? 0],
          [text('Downstream'), model.summary?.downstreamArtifactCount ?? 0],
          [text('Failed Gates'), model.summary?.failedGateCount ?? 0],
          [text('Proofs'), model.summary?.proofIdCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`brainstorm-layer-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(model.rows || []).slice(0, 3).map(row => (
          <div key={`brainstorm-layer-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.title || row.submissionId}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.agentName || row.agentId || 'agent'} / {row.taskId || 'task'}</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.alternativeCount ?? 0} {text('options')}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {text('Brainstorm route')}: {routePath}
      </div>
    </div>
  );
}
