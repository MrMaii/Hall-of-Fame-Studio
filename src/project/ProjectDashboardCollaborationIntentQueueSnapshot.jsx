import React from 'react';
import { MessageSquare, Play, ScrollText } from 'lucide-react';

export default function ProjectDashboardCollaborationIntentQueueSnapshot({
  chatProofIdsFromRow,
  intentRunDisabled,
  onOpenChatProof,
  onOpenTimelineProof,
  onRunIntent,
  projectId,
  projectText,
  renderActionDecision,
  route,
  runOutput,
  runReceipt,
  sourceBadge,
  workflow,
}) {
  return (
    <div data-testid="backend-collaboration-intent-queue-snapshot" className="mt-3 border border-[#7b6542] bg-[#f7edcf] p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Collaboration Intent Queue')}</div>
          <div className="font-serif text-base leading-tight">{projectText(workflow.status || 'backend-model-missing')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          <span className={`node-status-tag ${workflow.readyForLocalPilotIntentQueue ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {workflow.readyForLocalPilotIntentQueue ? projectText('intent routing ready') : projectText('backend required')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Rows'), workflow.summary?.rowCount ?? workflow.rows?.length ?? 0],
          [projectText('Runnable'), workflow.summary?.runnableCount ?? 0],
          [projectText('Meetings'), workflow.summary?.meetingIntentCount ?? 0],
          [projectText('Group Chat'), workflow.summary?.chatIntentCount ?? 0],
          [projectText('Mission Handoff'), workflow.summary?.customerAgentHandoffIntentCount ?? 0],
          [projectText('Intent Runs'), workflow.summary?.collaborationIntentRunCount ?? workflow.recentRuns?.length ?? 0],
          [projectText('Agent Intent'), workflow.summary?.agentInitiativeIntentCount ?? 0],
          [projectText('Review Intent'), workflow.summary?.reviewIntentCount ?? 0],
          [projectText('Proof IDs'), workflow.summary?.proofIdCount ?? workflow.proofIds?.length ?? 0],
          [projectText('Events'), workflow.summary?.eventIdCount ?? workflow.eventIds?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`collaboration-intent-queue-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      {workflow.nextRunnableIntent && (
        <div data-testid="backend-collaboration-intent-queue-next" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{projectText(workflow.nextRunnableIntent.intent || workflow.nextRunnableIntent.id || 'Next intent')}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                {projectText(workflow.nextRunnableIntent.actorName || workflow.nextRunnableIntent.agentName || workflow.nextRunnableIntent.actorType || 'agent')} / {projectText(workflow.nextRunnableIntent.lane || 'intent')} / {projectText(workflow.nextRunnableIntent.runApiPath || workflow.nextRunnableIntent.apiPath || 'route pending')}
              </div>
            </div>
            <span className="node-status-tag bg-[#59684b] text-white">{projectText('next')}</span>
          </div>
        </div>
      )}
      <div data-testid="backend-collaboration-intent-queue-rows" className="mt-2 space-y-1">
        {(workflow.rows || []).slice(0, 8).map(row => {
          const rowChatProofIds = chatProofIdsFromRow(row);
          const rowTimelineProofIds = Array.from(new Set([
            row.timelineLogId,
            ...(row.timelineLogIds || []),
          ].filter(Boolean)));
          return (
            <div key={`collaboration-intent-queue-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight truncate">
                    {row.queuePosition ? `#${row.queuePosition} ` : ''}{projectText(row.intent || row.id)}
                  </div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                    {projectText(row.actorName || row.agentName || row.actorType || 'agent')} / {projectText(row.lane || row.stage || 'intent')} / {projectText(row.status || 'pending')}
                  </div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                    {projectText(row.rationale || row.runApiPath || row.apiPath || 'proof-backed intent')}
                  </div>
                  {(row.latestRunId || row.latestDelegatedReceiptId) && (
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#59684b] truncate">
                      {projectText('Last run')}: {projectText(row.latestRunId || row.latestDelegatedReceiptId)} / {projectText(row.latestDelegatedRunKind || row.latestRunStatus || 'executed')}
                    </div>
                  )}
                </div>
                <span className={`node-status-tag ${row.canRun ? 'bg-[#59684b] text-white' : row.requiresManager ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
                  {projectText(row.canRun ? 'runnable' : row.requiresManager ? 'manager' : row.status || 'wait')}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid={`collaboration-intent-chat-proof-${row.id}`}
                  onClick={() => onOpenChatProof(rowChatProofIds, row.channelId || 'main')}
                  disabled={!rowChatProofIds.length}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={10} /> Intent chat proof
                </button>
                <button
                  type="button"
                  data-testid={`collaboration-intent-timeline-proof-${row.id}`}
                  onClick={() => onOpenTimelineProof(rowTimelineProofIds)}
                  disabled={!rowTimelineProofIds.length}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ScrollText size={10} /> Intent timeline proof
                </button>
                <button
                  type="button"
                  data-testid={`collaboration-intent-run-${row.id}`}
                  onClick={() => onRunIntent(row)}
                  disabled={intentRunDisabled(row)}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={10} /> Run intent
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {runReceipt && (
        <div data-testid="backend-collaboration-intent-run-receipt" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#59684b] break-words">
          Intent run receipt: {runReceipt.intentId || runReceipt.id} / {runReceipt.delegatedRunKind || 'delegated'} / {runReceipt.delegatedReceiptId || 'receipt pending'}
        </div>
      )}
      {runOutput && (
        <div data-testid="backend-collaboration-intent-run-output" className={`mt-2 border px-2 py-2 ${runOutput.status === 'failed' ? 'border-red-800 bg-red-50' : 'border-[#d8c99f] bg-[#efe2bd]/70'}`}>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText(runOutput.status === 'failed' ? 'Intent Run Failed' : 'Intent Output Nodes')}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {runOutput.status === 'failed'
              ? projectText(`No local intent receipt was created: ${runOutput.error || 'backend run failed'}`)
              : `${projectText(runOutput.delegatedRunKind || 'delegated')} / ${projectText(runOutput.delegatedReceiptId || runOutput.runId || 'receipt pending')}`}
          </div>
          {runOutput.status === 'failed' ? (
            <div data-testid="backend-collaboration-intent-run-output-failed" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
              {projectText('Backend intent run failed; previous successful receipts were cleared from this panel.')}
            </div>
          ) : (
            <>
              {renderActionDecision(runOutput.autonomousActionDecision, {
                testId: 'backend-collaboration-intent-action-decision',
              })}
              {(() => {
                const output = runOutput || {};
                const outputRows = [
                  output.workSubmission ? {
                    id: 'work-submission',
                    label: 'Agent Submission',
                    title: output.workSubmission.title || output.workSubmission.artifactType || output.workSubmission.id,
                    detail: `${output.workSubmission.artifactType || 'artifact'} / ${output.workSubmission.status || output.workSubmission.reviewStatus || 'submitted'}`,
                    entityId: output.workSubmission.id,
                    proofIds: [output.workSubmission.messageId, output.workSubmission.timelineLogId, output.workSubmission.eventId, output.workSubmission.artifactStorageProofChecksum],
                    chatProofIds: [output.workSubmission.messageId],
                    timelineProofIds: [output.workSubmission.timelineLogId],
                  } : null,
                  output.artifact && !output.workSubmission ? {
                    id: 'artifact',
                    label: 'Artifact',
                    title: output.artifact.title || output.artifact.artifactType || output.artifact.id,
                    detail: `${output.artifact.artifactType || output.artifact.type || 'artifact'} / ${output.artifact.status || 'stored'}`,
                    entityId: output.artifact.id,
                    proofIds: [output.artifact.id, output.artifact.storageProofChecksum, output.artifact.eventId],
                    chatProofIds: [],
                    timelineProofIds: [output.artifact.timelineLogId],
                  } : null,
                  output.evidenceSearch ? {
                    id: 'evidence-search',
                    label: 'Evidence Search',
                    title: output.evidenceSearch.query || output.evidenceSearch.purpose || output.evidenceSearch.id,
                    detail: `${output.evidenceSearch.evidenceJudgement || output.evidenceSearch.confidence || 'evidence'} / score ${output.evidenceSearch.qualityScore ?? output.evidenceSearch.averageQualityScore ?? 'n/a'}`,
                    entityId: output.evidenceSearch.id,
                    proofIds: [output.evidenceSearch.id, output.evidenceSearch.logId, output.evidenceSearch.eventId, output.evidenceSearch.providerReceiptId],
                    chatProofIds: [output.evidenceSearch.messageId],
                    timelineProofIds: [output.evidenceSearch.logId, output.evidenceSearch.timelineLogId],
                  } : null,
                  output.review ? {
                    id: 'submission-review',
                    label: 'Submission Review',
                    title: output.review.verdict || output.review.status || output.review.id,
                    detail: `${output.review.submissionId || 'submission'} / ${output.review.reviewerAgentName || output.review.reviewerAgentId || 'reviewer'}`,
                    entityId: output.review.id,
                    proofIds: [output.review.id, output.review.messageId, output.review.timelineLogId, output.review.eventId],
                    chatProofIds: [output.review.messageId],
                    timelineProofIds: [output.review.timelineLogId],
                  } : null,
                  output.reviewResponseSubmission ? {
                    id: 'review-response-submission',
                    label: 'Review Response',
                    title: output.reviewResponseSubmission.title || output.reviewResponseSubmission.artifactType || output.reviewResponseSubmission.id,
                    detail: `${output.reviewResponseSubmission.artifactType || 'artifact'} / review ${output.reviewResponseSubmission.respondsToReviewId || 'linked'}`,
                    entityId: output.reviewResponseSubmission.id,
                    proofIds: [output.reviewResponseSubmission.messageId, output.reviewResponseSubmission.timelineLogId, output.reviewResponseSubmission.eventId, output.reviewResponseSubmission.respondsToReviewId],
                    chatProofIds: [output.reviewResponseSubmission.messageId],
                    timelineProofIds: [output.reviewResponseSubmission.timelineLogId],
                  } : null,
                  output.reviewResponseArtifact && !output.reviewResponseSubmission ? {
                    id: 'review-response-artifact',
                    label: 'Review Response Artifact',
                    title: output.reviewResponseArtifact.title || output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.id,
                    detail: `${output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.type || 'artifact'} / review ${output.review?.id || output.reviewedSubmission?.id || 'linked'}`,
                    entityId: output.reviewResponseArtifact.id,
                    proofIds: [output.reviewResponseArtifact.id, output.reviewResponseArtifact.storageProofChecksum, output.reviewResponseArtifact.eventId],
                    chatProofIds: [],
                    timelineProofIds: [output.reviewResponseArtifact.timelineLogId],
                  } : null,
                  output.resultMessageIds?.length ? {
                    id: 'result-messages',
                    label: 'Result Messages',
                    title: `${output.resultMessageIds.length} message(s)`,
                    detail: output.resultMessageIds.slice(0, 3).join(' / '),
                    entityId: output.runId,
                    proofIds: output.resultMessageIds,
                    chatProofIds: output.resultMessageIds,
                    timelineProofIds: [],
                  } : null,
                ].filter(Boolean);
                if (!outputRows.length) {
                  return (
                    <div data-testid="backend-collaboration-intent-run-output-empty" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                      {projectText('No delegated output returned yet')}
                    </div>
                  );
                }
                return (
                  <div data-testid="backend-collaboration-intent-run-output-rows" className="mt-2 space-y-1">
                    {outputRows.map(row => {
                      const proofIds = Array.from(new Set((row.proofIds || []).filter(Boolean)));
                      const chatProofIds = Array.from(new Set((row.chatProofIds || []).filter(Boolean)));
                      const timelineProofIds = Array.from(new Set((row.timelineProofIds || []).filter(Boolean)));
                      return (
                        <div key={`collaboration-intent-run-output-${row.id}`} data-testid={`backend-collaboration-intent-output-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                          <div className="grid grid-cols-[1fr_auto] gap-2">
                            <div className="min-w-0">
                              <div className="font-serif text-sm leading-tight truncate">{projectText(row.label)}: {projectText(row.title || row.entityId || 'output')}</div>
                              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.detail || row.entityId || 'backend output')}</div>
                            </div>
                            <span className="node-status-tag bg-[#59684b] text-white">{proofIds.length}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <button
                              type="button"
                              data-testid={`collaboration-intent-output-chat-proof-${row.id}`}
                              onClick={() => onOpenChatProof(chatProofIds, 'main')}
                              disabled={!chatProofIds.length}
                              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} /> Output chat proof
                            </button>
                            <button
                              type="button"
                              data-testid={`collaboration-intent-output-timeline-proof-${row.id}`}
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
      <div data-testid="backend-collaboration-intent-queue-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Collaboration intent route: {route || `/projects/${projectId}/collaboration-intent-queue`}
      </div>
    </div>
  );
}
