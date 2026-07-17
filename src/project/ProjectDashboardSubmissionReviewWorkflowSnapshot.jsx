import { MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardSubmissionReviewWorkflowSnapshot({
  chatProofIdsFromIds,
  onOpenChatProof,
  onOpenTimelineProof,
  projectId,
  projectText,
  route,
  sourceBadge,
  syncButton,
  workflow,
}) {
  const workflowRoute = workflow.backendRoutes?.submissionReviewWorkflow || route || `/projects/${projectId}/submission-review-workflow`;

  return (
    <div data-testid="backend-submission-review-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Submission Review Workflow')}</div>
          <div className="font-serif text-base leading-tight">{projectText(workflow.status || 'review-loop-open')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          {syncButton}
          <span className={`node-status-tag ${workflow.readyForPrivatePilotReview ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {workflow.readyForPrivatePilotReview ? projectText('loop closed') : projectText('review open')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Review Rounds'), workflow.summary?.reviewRoundCount ?? 0],
          [projectText('Accepted'), workflow.summary?.acceptedCount ?? 0],
          [projectText('Change Requests'), workflow.summary?.changesRequestedCount ?? 0],
          [projectText('Open Changes'), workflow.summary?.openChangeRequestCount ?? 0],
          [projectText('Revision Responses'), workflow.summary?.revisionResponseCount ?? 0],
          [projectText('Final Accepted'), `${workflow.summary?.acceptedFinalDeliverableCount ?? 0}/${workflow.summary?.finalDeliverableCount ?? 0}`],
          [projectText('Proof Ready'), `${workflow.summary?.proofReadyCount ?? 0}/${workflow.summary?.reviewRoundCount ?? 0}`],
          [projectText('Packet'), workflow.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`submission-review-workflow-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-submission-review-workflow-proof-rows" className="mt-2 space-y-1">
        {(workflow.openChangeRequestRows?.length ? workflow.openChangeRequestRows : workflow.roundRows || []).slice(0, 4).map(row => {
          const workflowReviewChatProofIds = chatProofIdsFromIds(row.proofIds || []);
          const workflowReviewTimelineIds = Array.from(new Set([
            ...(row.timelineLogIds || []),
            ...(row.eventIds || []),
          ].filter(Boolean)));
          return (
            <div key={`submission-review-workflow-row-${row.id}`} data-testid={`backend-submission-review-workflow-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight truncate">{projectText(row.submissionTitle || row.submissionId || row.id)}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(`${row.verdict || 'review'} / ${row.responseSubmissionIds?.length || 0} response(s)`)}</div>
                </div>
                <span className={`node-status-tag ${row.status === 'closed' ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{projectText(row.status || 'open')}</span>
              </div>
              <div data-testid={`backend-submission-review-workflow-route-${row.id}`} className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#59684b] leading-relaxed break-words">
                Review: {row.route || `/projects/${projectId}/submission-reviews/${row.id}`}
                {' '} / Submission: {row.submissionRoute || `/projects/${projectId}/submissions/${row.submissionId}`}
                {' '} / Response: {(row.responseRoutes || []).slice(0, 2).join(' / ') || 'pending'}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid={`backend-submission-review-workflow-chat-proof-${row.id}`}
                  onClick={() => onOpenChatProof(workflowReviewChatProofIds, row.channelId || 'main')}
                  disabled={!workflowReviewChatProofIds.length}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={10} /> Review chat proof
                </button>
                <button
                  type="button"
                  data-testid={`backend-submission-review-workflow-timeline-proof-${row.id}`}
                  onClick={() => onOpenTimelineProof(workflowReviewTimelineIds)}
                  disabled={!workflowReviewTimelineIds.length}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScrollText size={10} /> Review timeline proof
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Review workflow route')}: {workflowRoute}
      </div>
    </div>
  );
}
