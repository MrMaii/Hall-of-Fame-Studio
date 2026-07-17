import React from 'react';
import { CheckCircle2, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardSubmissionWorkspace({
  view = {},
  reviewDraftFor,
  defaultReviewerId,
  chatProofIdsForRow,
  chatProofIdsForIds,
  onUpdateReviewDraft,
  onRunSubmissionReview,
  onOpenChatProof,
  onOpenTimelineProof,
  reviewInputDisabled,
  reviewSubmitDisabled,
  proofDisabled,
}) {
  const {
    activeProject,
    backendManagerDashboard,
    managerSubmissionReviewRows = [],
    managerSubmissionReviewRowsBackendRequired,
    submissionReviewVerdicts = [],
  } = view;
  const projectId = activeProject?.id;

  return (
    <>
      <div data-testid="backend-manager-submissions-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Submissions route: {backendManagerDashboard.backendRoutes?.submissions || `/projects/${projectId}/submissions`} / {backendManagerDashboard.submissions?.count ?? 0} submitted
      </div>
      <div data-testid="backend-manager-artifact-drafts-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Draft route: {`/projects/${projectId}/agents/:agentId/artifact-drafts`} / {backendManagerDashboard.submissions?.generatedDraftCount ?? 0} generated
      </div>
      <div data-testid="backend-manager-evidence-searches-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Evidence route: {backendManagerDashboard.backendRoutes?.evidenceSearches || `/projects/${projectId}/evidence-searches`} / {backendManagerDashboard.evidenceSearches?.count ?? 0} searches
        {' '} / Audit route: {backendManagerDashboard.backendRoutes?.evidenceQualityAudit || `/projects/${projectId}/evidence-quality-audit`}
      </div>
      <div data-testid="backend-manager-submission-reviews-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Review route: {backendManagerDashboard.backendRoutes?.submissionReviews || `/projects/${projectId}/submission-reviews`} / {backendManagerDashboard.submissionReviews?.count ?? 0} reviews
      </div>
      {backendManagerDashboard.submissions?.rows?.length > 0 && (
        <div data-testid="backend-manager-submissions-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Submissions</div>
          <div className="mt-2 space-y-1">
            {backendManagerDashboard.submissions.rows.slice(0, 40).map(row => {
              const reviewDraft = reviewDraftFor(row.id, projectId);
              const backendReviewReceipt = (backendManagerDashboard.submissionReviews?.rows || [])
                .find(review => review.submissionId === row.id);
              const reviewReceipt = reviewDraft.lastReceipt || (backendReviewReceipt ? {
                reviewId: backendReviewReceipt.id,
                readModels: { managerFlowGraphRoute: backendReviewReceipt.proofRoute || backendReviewReceipt.submissionRoute || null },
              } : null);
              const reviewReceiptFailed = reviewReceipt?.action === 'submission-review-failed';
              const rowReviewerId = reviewDraft.reviewerAgentId || defaultReviewerId(row);
              const rowVerdict = reviewDraft.verdict || (row.artifactType === 'final-deliverable' ? 'accepted' : 'changes-requested');
              const submissionChatProofIds = chatProofIdsForRow(row);
              const submissionTimelineProofIds = Array.from(new Set([row.timelineLogId, ...(row.timelineLogIds || [])].filter(Boolean)));
              return (
                <div key={row.id} data-testid={`backend-manager-submission-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="min-w-0">
                      <div className="font-serif text-sm leading-tight truncate">{row.title}</div>
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.agentName} / {row.artifactType} / {row.reviewStatus}</div>
                      {(row.isGeneratedDraft || row.artifactDraft) && (
                        <div data-testid="backend-manager-artifact-drafts-snapshot" className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18] truncate">
                          Draft {row.artifactDraftModelUsed ? 'model' : 'local'} / {row.artifactDraftSource || row.artifactDraft?.source || 'artifact-draft'} / {row.artifactDraftId || row.artifactDraft?.draftId || 'draft'}
                        </div>
                      )}
                    </div>
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid={`submission-chat-proof-${row.id}`}
                      onClick={() => onOpenChatProof(submissionChatProofIds, row.channelId || 'main')}
                      disabled={proofDisabled(submissionChatProofIds)}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageSquare size={10} /> Submission chat proof
                    </button>
                    <button
                      type="button"
                      data-testid={`submission-timeline-proof-${row.id}`}
                      onClick={() => onOpenTimelineProof(submissionTimelineProofIds)}
                      disabled={proofDisabled(submissionTimelineProofIds)}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ScrollText size={10} /> Submission timeline proof
                    </button>
                  </div>
                  <div data-testid={`submission-review-composer-${row.id}`} className="mt-2 border-t border-[#d8c99f] pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                      <select
                        data-testid={`submission-review-reviewer-${row.id}`}
                        value={rowReviewerId}
                        onChange={(event) => onUpdateReviewDraft(row.id, { reviewerAgentId: event.target.value })}
                        disabled={reviewInputDisabled}
                        className="w-full border border-[#d8c99f] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                      >
                        {(activeProject.team || []).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                      <select
                        data-testid={`submission-review-verdict-${row.id}`}
                        value={rowVerdict}
                        onChange={(event) => onUpdateReviewDraft(row.id, { verdict: event.target.value })}
                        disabled={reviewInputDisabled}
                        className="w-full border border-[#d8c99f] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                      >
                        {submissionReviewVerdicts.map(verdict => (
                          <option key={verdict.id} value={verdict.id}>{verdict.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid={`submission-review-submit-${row.id}`}
                        onClick={() => onRunSubmissionReview(row)}
                        disabled={reviewSubmitDisabled(rowReviewerId)}
                        className="inline-flex items-center justify-center gap-1.5 border border-[#7b6542] bg-[#efe2bd] px-3 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 size={10} /> Review
                      </button>
                    </div>
                    <textarea
                      data-testid={`submission-review-comments-${row.id}`}
                      value={reviewDraft.comments || ''}
                      onChange={(event) => onUpdateReviewDraft(row.id, { comments: event.target.value })}
                      disabled={reviewInputDisabled}
                      rows={2}
                      placeholder={rowVerdict === 'accepted' ? 'Acceptance note' : 'Reviewer comments'}
                      className="mt-2 w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] leading-relaxed text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                    />
                    <textarea
                      data-testid={`submission-review-requested-changes-${row.id}`}
                      value={reviewDraft.requestedChanges || ''}
                      onChange={(event) => onUpdateReviewDraft(row.id, { requestedChanges: event.target.value })}
                      disabled={reviewInputDisabled}
                      rows={2}
                      placeholder="Requested changes, one per line"
                      className="mt-2 w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] leading-relaxed text-[#251b13] placeholder:text-[#9b875c] disabled:opacity-50"
                    />
                    {reviewReceipt && (
                      <div data-testid={`submission-review-receipt-${row.id}`} className={`mt-2 font-mono text-[7px] uppercase tracking-widest leading-relaxed break-words ${reviewReceiptFailed ? 'text-[#8f1e18]' : 'text-[#59684b]'}`}>
                        {reviewReceiptFailed
                          ? `Review write failed: ${reviewReceipt.error || 'backend submission review failed; no local review receipt was created.'}`
                          : `Review receipt: ${reviewReceipt.reviewId || 'recorded'} / ${reviewReceipt.readModels?.managerFlowGraphRoute || `/projects/${projectId}/manager-flow-graph`}`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {backendManagerDashboard.evidenceSearches?.rows?.length > 0 && (
        <div data-testid="backend-manager-evidence-searches-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Evidence Searches</div>
          <div className="mt-2 space-y-1">
            {backendManagerDashboard.evidenceSearches.rows.slice(0, 4).map(row => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight truncate">{row.query}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.agentName} / {row.sources?.length || 0} sources / {row.confidence}</div>
                </div>
                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(managerSubmissionReviewRows.length > 0 || managerSubmissionReviewRowsBackendRequired) && (
        <div data-testid="backend-manager-submission-reviews-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Submission Reviews</div>
          {managerSubmissionReviewRowsBackendRequired && (
            <div data-testid="backend-manager-submission-reviews-required" className="mt-2 border border-[#8f1e18] bg-[#f7edcf] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
              Manager Dashboard submission-review rows are required before this real project can show review receipts.
            </div>
          )}
          <div className="mt-2 space-y-1">
            {managerSubmissionReviewRows.slice(0, 6).map(row => {
              const managerReviewChatProofIds = chatProofIdsForIds([
                row.messageId,
                ...(row.proofIds || []),
              ].filter(Boolean));
              const managerReviewTimelineIds = Array.from(new Set([
                row.timelineLogId,
                ...(row.timelineLogIds || []),
                row.eventId,
                ...(row.eventIds || []),
              ].filter(Boolean)));
              return (
                <div key={row.id} data-testid={`backend-manager-submission-review-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="min-w-0">
                      <div className="font-serif text-sm leading-tight truncate">{row.comments}</div>
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.reviewerAgentName} / {row.submitterAgentName} / {row.submissionId}</div>
                    </div>
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.verdict}</span>
                  </div>
                  <div data-testid={`backend-manager-submission-review-route-${row.id}`} className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#59684b] leading-relaxed break-words">
                    Review: {row.proofRoute || `/projects/${projectId}/submission-reviews/${row.id}`}
                    {' '} / Submission: {row.submissionRoute || `/projects/${projectId}/submissions/${row.submissionId}`}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid={`backend-manager-submission-review-chat-proof-${row.id}`}
                      onClick={() => onOpenChatProof(managerReviewChatProofIds, row.channelId || 'main')}
                      disabled={proofDisabled(managerReviewChatProofIds)}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MessageSquare size={10} /> Review chat proof
                    </button>
                    <button
                      type="button"
                      data-testid={`backend-manager-submission-review-timeline-proof-${row.id}`}
                      onClick={() => onOpenTimelineProof(managerReviewTimelineIds)}
                      disabled={proofDisabled(managerReviewTimelineIds)}
                      className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ScrollText size={10} /> Review timeline proof
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
