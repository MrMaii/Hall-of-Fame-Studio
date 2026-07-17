import { useState } from 'react';

export default function ProjectDashboardAgentAutonomousActionQueue({
  MessageSquare,
  Play,
  ScrollText,
  managerRoute,
  onOpenChatProof,
  onOpenTimelineProof,
  onRunRow,
  pendingAgentId,
  projectId,
  projectText,
  queue,
  renderAutonomousActionDecision,
  runDisabled,
  runOutput,
  runReceipt,
  sourceBadge,
}) {
  const [optimisticPendingAgentId, setOptimisticPendingAgentId] = useState(null);
  const effectivePendingAgentId = pendingAgentId || optimisticPendingAgentId;
  const runRow = async (row) => {
    setOptimisticPendingAgentId(row.agentId);
    try {
      await onRunRow(row);
    } finally {
      setOptimisticPendingAgentId(current => current === row.agentId ? null : current);
    }
  };

  return (
    <div data-testid="backend-agent-autonomous-action-queue-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Agent Autonomous Queue')}</div>
          <div className="font-serif text-base leading-tight">Backend-selected Agent next moves, ready to run through the worker contract.</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {sourceBadge}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {queue.readyCount ?? 0}/{queue.count ?? 0} ready
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Ready', queue.readyCount ?? 0],
          ['Due', queue.dueCount ?? 0],
          ['Monitoring', queue.monitoringCount ?? 0],
          ['Next', queue.nextAction?.actionLabel || queue.nextAction?.selectedAction || 'none'],
        ].map(([label, value]) => (
          <div key={`agent-autonomous-queue-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
            <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        Route: {queue.backendRoutes?.agentAutonomousActionQueue || managerRoute || `/projects/${projectId}/agent-autonomous-action-queue`}
      </div>
      {effectivePendingAgentId && (
        <div
          data-testid="backend-agent-autonomous-action-running"
          role="status"
          className="mt-2 flex items-center gap-2 border border-[#7b6542] bg-[#efe2bd]/70 px-2 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d]"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8f1e18]" aria-hidden="true" />
          {projectText('Running Agent Action…')} {projectText((queue.rows || []).find(row => row.agentId === effectivePendingAgentId)?.name || effectivePendingAgentId)}
        </div>
      )}
      {runReceipt && (
        <div data-testid="backend-agent-autonomous-action-run-receipt" className="mt-2 border border-[#7b6542] bg-[#efe2bd]/70 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Run receipt: {runReceipt.actionLabel || runReceipt.selectedAction} / {runReceipt.agentId} / strategy {runReceipt.strategyDecisionId || 'recorded'}
        </div>
      )}
      {runOutput && (
        <div data-testid="backend-agent-autonomous-action-run-output" data-run-id={runOutput.runId || ''} className={`mt-2 border px-2 py-2 ${runOutput.status === 'failed' ? 'border-red-800 bg-red-50' : 'border-[#d8c99f] bg-[#efe2bd]/70'}`}>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText(runOutput.status === 'failed' ? 'Agent Action Failed' : 'Agent Action Output Nodes')}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {runOutput.status === 'failed'
              ? projectText(`No local run receipt was created: ${runOutput.error || 'backend run failed'}`)
              : `${projectText(runOutput.actionLabel || 'agent action')} / ${projectText(runOutput.runId || 'receipt pending')}`}
          </div>
          {runOutput.status === 'failed' ? (
            <div data-testid="backend-agent-autonomous-action-run-output-failed" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
              {projectText('Backend Agent action failed; previous successful receipts were cleared from this panel.')}
            </div>
          ) : (
            <>
              {renderAutonomousActionDecision(runOutput.autonomousActionDecision, {
                testId: 'backend-agent-autonomous-action-decision',
              })}
              {(() => {
                const output = runOutput || {};
                const rows = [
                  output.workSubmission ? {
                    id: 'work-submission',
                    label: 'Agent Submission',
                    title: output.workSubmission.title || output.workSubmission.artifactType || output.workSubmission.id,
                    detail: `${output.workSubmission.artifactType || 'artifact'} / ${output.workSubmission.status || output.workSubmission.reviewStatus || 'submitted'}`,
                    route: output.workSubmission.route || (projectId && output.workSubmission.id ? `/projects/${projectId}/submissions/${output.workSubmission.id}` : null),
                    eventId: output.workSubmission.eventId,
                    proofIds: [output.workSubmission.messageId, output.workSubmission.timelineLogId, output.workSubmission.eventId, output.workSubmission.artifactStorageProofChecksum],
                    chatProofIds: [output.workSubmission.messageId],
                    timelineProofIds: [output.workSubmission.timelineLogId],
                  } : null,
                  output.artifact && !output.workSubmission ? {
                    id: 'artifact',
                    label: 'Artifact',
                    title: output.artifact.title || output.artifact.artifactType || output.artifact.id,
                    detail: `${output.artifact.artifactType || output.artifact.type || 'artifact'} / ${output.artifact.status || 'stored'}`,
                    route: output.artifact.route || (projectId && output.artifact.id ? `/projects/${projectId}/artifacts/${output.artifact.id}` : null),
                    eventId: output.artifact.eventId,
                    proofIds: [output.artifact.id, output.artifact.storageProofChecksum, output.artifact.eventId],
                    chatProofIds: [],
                    timelineProofIds: [output.artifact.timelineLogId],
                  } : null,
                  output.evidenceSearch ? {
                    id: 'evidence-search',
                    label: 'Evidence Search',
                    title: output.evidenceSearch.query || output.evidenceSearch.purpose || output.evidenceSearch.id,
                    detail: `${output.evidenceSearch.evidenceJudgement || output.evidenceSearch.confidence || 'evidence'} / score ${output.evidenceSearch.qualityScore ?? output.evidenceSearch.averageQualityScore ?? 'n/a'}`,
                    route: output.evidenceSearch.route || (projectId && output.evidenceSearch.id ? `/projects/${projectId}/evidence-searches/${output.evidenceSearch.id}` : null),
                    eventId: output.evidenceSearch.eventId,
                    proofIds: [output.evidenceSearch.id, output.evidenceSearch.messageId, output.evidenceSearch.logId, output.evidenceSearch.eventId],
                    chatProofIds: [output.evidenceSearch.messageId],
                    timelineProofIds: [output.evidenceSearch.logId, output.evidenceSearch.timelineLogId],
                  } : null,
                  output.review ? {
                    id: 'submission-review',
                    label: 'Submission Review',
                    title: output.review.verdict || output.review.status || output.review.id,
                    detail: `${output.review.submissionId || 'submission'} / ${output.review.reviewerAgentName || output.review.reviewerAgentId || 'reviewer'}`,
                    route: output.review.route || (projectId && output.review.id ? `/projects/${projectId}/submission-reviews/${output.review.id}` : null),
                    eventId: output.review.eventId,
                    proofIds: [output.review.id, output.review.messageId, output.review.timelineLogId, output.review.eventId],
                    chatProofIds: [output.review.messageId],
                    timelineProofIds: [output.review.timelineLogId],
                  } : null,
                  output.reviewResponseSubmission ? {
                    id: 'review-response-submission',
                    label: 'Review Response',
                    title: output.reviewResponseSubmission.title || output.reviewResponseSubmission.artifactType || output.reviewResponseSubmission.id,
                    detail: `${output.reviewResponseSubmission.artifactType || 'artifact'} / review ${output.reviewResponseSubmission.respondsToReviewId || 'linked'}`,
                    route: output.reviewResponseSubmission.route || (projectId && output.reviewResponseSubmission.id ? `/projects/${projectId}/submissions/${output.reviewResponseSubmission.id}` : null),
                    eventId: output.reviewResponseSubmission.eventId,
                    proofIds: [output.reviewResponseSubmission.messageId, output.reviewResponseSubmission.timelineLogId, output.reviewResponseSubmission.eventId, output.reviewResponseSubmission.respondsToReviewId],
                    chatProofIds: [output.reviewResponseSubmission.messageId],
                    timelineProofIds: [output.reviewResponseSubmission.timelineLogId],
                  } : null,
                  output.reviewResponseArtifact && !output.reviewResponseSubmission ? {
                    id: 'review-response-artifact',
                    label: 'Review Response Artifact',
                    title: output.reviewResponseArtifact.title || output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.id,
                    detail: `${output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.type || 'artifact'} / review ${output.review?.id || output.reviewedSubmission?.id || 'linked'}`,
                    route: output.reviewResponseArtifact.route || (projectId && output.reviewResponseArtifact.id ? `/projects/${projectId}/artifacts/${output.reviewResponseArtifact.id}` : null),
                    eventId: output.reviewResponseArtifact.eventId,
                    proofIds: [output.reviewResponseArtifact.id, output.reviewResponseArtifact.storageProofChecksum, output.reviewResponseArtifact.eventId],
                    chatProofIds: [],
                    timelineProofIds: [output.reviewResponseArtifact.timelineLogId],
                  } : null,
                  output.resultMessageIds?.length ? {
                    id: 'result-messages',
                    label: 'Result Messages',
                    title: `${output.resultMessageIds.length} transcript message(s)`,
                    detail: `${output.agentId || 'agent'} / ${output.actionLabel || 'agent action'}`,
                    route: projectId ? `/projects/${projectId}/transcripts/${output.channelId || 'main'}` : null,
                    eventId: output.eventId || output.eventIds?.[0],
                    proofIds: output.resultMessageIds,
                    chatProofIds: output.resultMessageIds,
                    timelineProofIds: [],
                  } : null,
                ].filter(Boolean);
                if (!rows.length) {
                  return (
                    <div data-testid="backend-agent-autonomous-action-run-output-empty" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      {projectText('No Agent output returned yet')}
                    </div>
                  );
                }
                return (
                  <div data-testid="backend-agent-autonomous-action-run-output-rows" className="mt-2 space-y-1">
                    {rows.map(row => {
                      const proofIds = Array.from(new Set((row.proofIds || []).filter(Boolean)));
                      const chatProofIds = Array.from(new Set((row.chatProofIds || []).filter(Boolean)));
                      const timelineProofIds = Array.from(new Set((row.timelineProofIds || []).filter(Boolean)));
                      return (
                        <div key={`agent-autonomous-output-${row.id}`} data-testid={`backend-agent-autonomous-action-output-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <div className="min-w-0">
                              <div className="font-serif text-sm leading-tight truncate">{projectText(row.label)}: {projectText(row.title || 'output')}</div>
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.detail || 'backend output')}</div>
                              <div data-testid={`agent-autonomous-action-output-route-${row.id}`} className="font-mono text-[7px] uppercase tracking-widest text-[#59684b] truncate">
                                Route: {row.route || 'route pending'} / Event: {row.eventId || 'missing'}
                              </div>
                            </div>
                            <span className="node-status-tag bg-[#59684b] text-white">{proofIds.length}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`agent-autonomous-action-output-chat-proof-${row.id}`}
                              onClick={() => onOpenChatProof(chatProofIds)}
                              disabled={!chatProofIds.length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> Output chat proof
                            </button>
                            <button
                              type="button"
                              data-testid={`agent-autonomous-action-output-timeline-proof-${row.id}`}
                              onClick={() => onOpenTimelineProof(timelineProofIds)}
                              disabled={!timelineProofIds.length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ScrollText size={10} /> Output timeline proof
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {(queue.rows || []).slice(0, 5).map(row => (
          <div key={row.id || row.agentId} data-testid={`backend-agent-autonomous-action-row-${row.agentId}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight">{row.name || row.agentId}</div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                  {row.actionLabel || row.selectedAction} / {row.status} / priority {row.managementPriority ?? 0}
                </div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                  {row.nextStep || 'next step pending'}
                </div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
                  Run route: {row.runApiPath || row.agentWorkCycleApiPath || 'route pending'}
                </div>
              </div>
              <button
                type="button"
                data-testid={`backend-agent-autonomous-action-run-${row.agentId}`}
                onClick={() => runRow(row)}
                disabled={runDisabled || Boolean(effectivePendingAgentId) || !row.canRun || row.routeResolved === false}
                className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={10} /> {effectivePendingAgentId === row.agentId ? projectText('Running Agent Action…') : projectText('Run Agent Action')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
