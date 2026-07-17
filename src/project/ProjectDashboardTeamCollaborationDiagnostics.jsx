import React from 'react';

export default function ProjectDashboardTeamCollaborationDiagnostics({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-team-collaboration-diagnostics-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Team Collaboration Diagnostics')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalPilotCollaboration ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalPilotCollaboration ? text('collaboration ready') : text('handoff break')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Score'), model.summary?.collaborationScore ?? model.collaborationState?.score ?? 0],
          [text('Rows Ready'), `${model.summary?.readyRowCount ?? 0}/${model.summary?.localRowCount ?? model.diagnosticRows?.length ?? 0}`],
          [text('Handoff Breaks'), model.handoffBreaks?.length ?? model.summary?.failedLocalRowCount ?? 0],
          [text('Initiatives'), model.summary?.initiativeCount ?? 0],
          [text('Transcripts'), model.summary?.transcriptChannelCount ?? 0],
          [text('Messages'), model.summary?.transcriptMessageCount ?? 0],
          [text('Proof Routes'), model.summary?.proofRouteCount ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? model.eventIds?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`team-collaboration-diagnostics-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-team-collaboration-diagnostics-rows" className="mt-2 space-y-1">
        {(model.diagnosticRows || []).slice(0, 8).map(row => (
          <div key={`team-collaboration-diagnostics-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{text(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{text(row.detail || row.apiPath || 'backend proof')}</div>
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : row.productionBlocker ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
              {text(row.passed ? 'ready' : row.productionBlocker ? 'prod blocked' : 'missing')}
            </span>
          </div>
        ))}
      </div>
      <div data-testid="backend-team-collaboration-diagnostics-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Collaboration diagnostics route: {routePath}
      </div>
    </div>
  );
}
