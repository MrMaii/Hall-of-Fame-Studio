import React from 'react';

export default function ProjectDashboardZeroToAutonomyReport({ view = {} }) {
  const {
    model,
    routePath,
    sourceBadge,
    syncButton,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-zero-to-autonomy-report-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-[#9b875c]">{text('Zero-to-autonomy')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'project-zero-to-autonomy-incomplete')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${model.readyForLocalMvpTrial ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForLocalMvpTrial ? text('local trial ready') : text('trial blocked')}
          </span>
          <span className={`node-status-tag ${model.readyForPublicProduction ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForPublicProduction ? text('production ready') : text('production blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid gap-1 text-[10px] text-[#5f5136] sm:grid-cols-4">
        {[
          [text('Ready Stages'), `${model.summary?.readyStageCount ?? 0}/${model.summary?.stageCount ?? 0}`],
          [text('Artifact Types'), `${model.summary?.submittedArtifactTypeCount ?? 0}/${model.summary?.requiredArtifactTypeCount ?? 0}`],
          [text('Provider Usage'), model.summary?.providerUsageCount ?? 0],
          [text('Provider Receipts'), model.summary?.providerReceiptCount ?? 0],
          [text('Source Decisions'), model.summary?.sourceReviewDecisionCount ?? 0],
          [text('Proofs'), model.summary?.proofIdCount ?? 0],
          [text('Timeline'), model.summary?.timelineLogIdCount ?? 0],
          [text('Events'), model.summary?.eventIdCount ?? 0],
          [text('Archive Leaks'), model.summary?.archiveRawLeakCount ?? 0],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`zero-to-autonomy-report-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="uppercase tracking-[0.18em] text-[#9b875c]">{label}</div>
            <div className="font-mono text-[10px] text-[#2f2618]">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-1 text-[10px] text-[#5f5136] sm:grid-cols-2">
        {(model.stageRows || []).slice(0, 10).map((row) => {
          const rowProofCount = row.proofIds?.length || 0;
          const rowTimelineCount = row.timelineLogIds?.length || 0;
          const rowEventCount = row.eventIds?.length || 0;
          return (
            <div key={`zero-to-autonomy-report-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <span>{text(row.label || row.id)}</span>
                <span className={`font-mono uppercase ${row.ready ? 'text-[#59684b]' : 'text-[#8f1e18]'}`}>
                  {row.ready ? text('ready') : text('needs proof')}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 font-mono text-[8px] uppercase tracking-widest text-[#7b6542]">
                <span data-testid={`backend-zero-to-autonomy-report-stage-proof-count-${row.id}`}>
                  {text('Proof IDs')}: {rowProofCount}
                </span>
                <span data-testid={`backend-zero-to-autonomy-report-stage-timeline-count-${row.id}`}>
                  {text('Timeline')}: {rowTimelineCount}
                </span>
                <span data-testid={`backend-zero-to-autonomy-report-stage-event-count-${row.id}`}>
                  {text('Events')}: {rowEventCount}
                </span>
              </div>
              {row.route && (
                <div data-testid={`backend-zero-to-autonomy-report-stage-route-${row.id}`} className="mt-1 break-all font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                  {text('Stage route')}: {row.route}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div data-testid="backend-zero-to-autonomy-report-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {text('Report route')}: {routePath}
      </div>
    </div>
  );
}
