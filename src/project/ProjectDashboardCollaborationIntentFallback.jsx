import React from 'react';

export default function ProjectDashboardCollaborationIntentFallback({
  view = {},
  onRunIntent,
  intentRunDisabled,
  onOpenOutputChatProof,
  outputChatProofDisabled,
  onOpenOutputTimelineProof,
  outputTimelineProofDisabled,
}) {
  const {
    MessageSquare,
    Play,
    ScrollText,
    activeProject,
    backendCollaborationIntentQueue,
    backendCollaborationIntentRunOutput,
    managerReadModelSourceClass,
    managerReadModelSourceLabel,
    projectText,
  } = view;

  return (
    <div data-testid="backend-collaboration-intent-queue-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Collaboration Intent Queue</div>
          <div className="font-serif text-base leading-tight">{projectText(backendCollaborationIntentQueue.status || 'backend-backed intent queue')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          <span data-testid="backend-collaboration-intent-queue-source" className={`node-status-tag ${managerReadModelSourceClass(backendCollaborationIntentQueue)}`}>
            {managerReadModelSourceLabel(backendCollaborationIntentQueue)}
          </span>
          <span className={`node-status-tag ${backendCollaborationIntentQueue.readyForLocalPilotIntentQueue ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendCollaborationIntentQueue.readyForLocalPilotIntentQueue ? 'intent routing ready' : 'backend required'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Rows', backendCollaborationIntentQueue.summary?.rowCount ?? backendCollaborationIntentQueue.rows?.length ?? 0],
          ['Runnable', backendCollaborationIntentQueue.summary?.runnableCount ?? 0],
          ['Mission Handoff', backendCollaborationIntentQueue.summary?.customerAgentHandoffIntentCount ?? 0],
          ['Intent Runs', backendCollaborationIntentQueue.summary?.collaborationIntentRunCount ?? backendCollaborationIntentQueue.recentRuns?.length ?? 0],
        ].map(([label, value]) => (
          <div key={`dashboard-collaboration-intent-queue-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-collaboration-intent-queue-rows" className="mt-2 space-y-1">
        {[
          ...(backendCollaborationIntentQueue.rows || []).filter(row => row.id === 'customer-agent-handoff-intent'),
          ...(backendCollaborationIntentQueue.rows || []).filter(row => row.id !== 'customer-agent-handoff-intent'),
        ].slice(0, 6).map(row => (
          <div key={`dashboard-collaboration-intent-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">
                  {row.queuePosition ? `#${row.queuePosition} ` : ''}{projectText(row.intent || row.id)}
                </div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                  {projectText(row.actorName || row.agentName || row.actorType || 'agent')} / {projectText(row.lane || row.stage || 'intent')} / {projectText(row.status || 'pending')}
                </div>
              </div>
              <span className={`node-status-tag ${row.canRun ? 'bg-[#59684b] text-white' : row.requiresManager ? 'bg-[#251b13] text-[#efe2bd]' : 'bg-[#8f1e18] text-white'}`}>
                {projectText(row.canRun ? 'runnable' : row.requiresManager ? 'manager' : row.status || 'wait')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
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
        ))}
      </div>
      {backendCollaborationIntentRunOutput && (
        <div data-testid="backend-collaboration-intent-run-output" className={`mt-2 border px-2 py-2 ${backendCollaborationIntentRunOutput.status === 'failed' ? 'border-red-800 bg-red-50' : 'border-[#d8c99f] bg-[#f7edcf]'}`}>
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{backendCollaborationIntentRunOutput.status === 'failed' ? 'Intent Run Failed' : 'Intent Output Nodes'}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {backendCollaborationIntentRunOutput.status === 'failed'
              ? `No local intent receipt was created: ${backendCollaborationIntentRunOutput.error || 'backend run failed'}`
              : `${projectText(backendCollaborationIntentRunOutput.delegatedRunKind || 'delegated')} / ${projectText(backendCollaborationIntentRunOutput.delegatedReceiptId || backendCollaborationIntentRunOutput.runId || 'receipt pending')}`}
          </div>
          {backendCollaborationIntentRunOutput.workSubmission && (
            <div data-testid="backend-collaboration-intent-output-work-submission" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
              <div className="font-serif text-sm leading-tight truncate">
                Agent Submission: {projectText(backendCollaborationIntentRunOutput.workSubmission.title || backendCollaborationIntentRunOutput.workSubmission.artifactType || backendCollaborationIntentRunOutput.workSubmission.id)}
              </div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                {projectText(backendCollaborationIntentRunOutput.workSubmission.artifactType || 'artifact')} / {projectText(backendCollaborationIntentRunOutput.workSubmission.status || backendCollaborationIntentRunOutput.workSubmission.reviewStatus || 'submitted')}
              </div>
              <div data-testid="backend-collaboration-intent-handoff-output-routes" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#59684b] break-words">
                Submission route: {backendCollaborationIntentRunOutput.workSubmission.route || (activeProject?.id && backendCollaborationIntentRunOutput.workSubmission.id ? `/projects/${activeProject.id}/submissions/${backendCollaborationIntentRunOutput.workSubmission.id}` : '/projects/:id/submissions/:submissionId')}
                {' '} / Timeline: {backendCollaborationIntentRunOutput.workSubmission.timelineLogId || 'missing'}
                {' '} / Event: {backendCollaborationIntentRunOutput.workSubmission.eventId || 'missing'}
              </div>
              <button
                type="button"
                data-testid="collaboration-intent-output-chat-proof-work-submission"
                onClick={() => onOpenOutputChatProof([backendCollaborationIntentRunOutput.workSubmission.messageId].filter(Boolean))}
                disabled={outputChatProofDisabled([backendCollaborationIntentRunOutput.workSubmission.messageId].filter(Boolean))}
                className="mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <MessageSquare size={10} /> Output chat proof
              </button>
              <button
                type="button"
                data-testid="collaboration-intent-output-timeline-proof-work-submission"
                onClick={() => onOpenOutputTimelineProof([backendCollaborationIntentRunOutput.workSubmission.timelineLogId].filter(Boolean))}
                disabled={outputTimelineProofDisabled([backendCollaborationIntentRunOutput.workSubmission.timelineLogId].filter(Boolean))}
                className="ml-2 mt-2 inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ScrollText size={10} /> Output timeline proof
              </button>
            </div>
          )}
          {(() => {
            const output = backendCollaborationIntentRunOutput || {};
            const standaloneRows = [
              output.artifact && !output.workSubmission ? {
                id: 'artifact',
                label: 'Artifact',
                title: output.artifact.title || output.artifact.artifactType || output.artifact.id,
                detail: `${output.artifact.artifactType || output.artifact.type || 'artifact'} / ${output.artifact.status || 'stored'}`,
                proofIds: [output.artifact.id, output.artifact.storageProofChecksum, output.artifact.eventId],
                chatProofIds: [],
                timelineProofIds: [output.artifact.timelineLogId],
              } : null,
              output.evidenceSearch ? {
                id: 'evidence-search',
                label: 'Evidence Search',
                title: output.evidenceSearch.query || output.evidenceSearch.purpose || output.evidenceSearch.id,
                detail: `${output.evidenceSearch.evidenceJudgement || output.evidenceSearch.confidence || 'evidence'} / score ${output.evidenceSearch.qualityScore ?? output.evidenceSearch.averageQualityScore ?? 'n/a'}`,
                proofIds: [output.evidenceSearch.id, output.evidenceSearch.messageId, output.evidenceSearch.logId, output.evidenceSearch.eventId, output.evidenceSearch.providerReceiptId],
                chatProofIds: [output.evidenceSearch.messageId],
                timelineProofIds: [output.evidenceSearch.logId, output.evidenceSearch.timelineLogId],
              } : null,
              output.review ? {
                id: 'submission-review',
                label: 'Submission Review',
                title: output.review.verdict || output.review.status || output.review.id,
                detail: `${output.review.submissionId || output.reviewedSubmission?.id || 'submission'} / ${output.review.reviewerAgentName || output.review.reviewerAgentId || 'reviewer'}`,
                proofIds: [output.review.id, output.review.messageId, output.review.timelineLogId, output.review.eventId],
                chatProofIds: [output.review.messageId],
                timelineProofIds: [output.review.timelineLogId],
              } : null,
              output.reviewResponseSubmission ? {
                id: 'review-response-submission',
                label: 'Review Response',
                title: output.reviewResponseSubmission.title || output.reviewResponseSubmission.artifactType || output.reviewResponseSubmission.id,
                detail: `${output.reviewResponseSubmission.artifactType || 'artifact'} / review ${output.reviewResponseSubmission.respondsToReviewId || 'linked'}`,
                proofIds: [output.reviewResponseSubmission.messageId, output.reviewResponseSubmission.timelineLogId, output.reviewResponseSubmission.eventId, output.reviewResponseSubmission.respondsToReviewId],
                chatProofIds: [output.reviewResponseSubmission.messageId],
                timelineProofIds: [output.reviewResponseSubmission.timelineLogId],
              } : null,
              output.reviewResponseArtifact && !output.reviewResponseSubmission ? {
                id: 'review-response-artifact',
                label: 'Review Response Artifact',
                title: output.reviewResponseArtifact.title || output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.id,
                detail: `${output.reviewResponseArtifact.artifactType || output.reviewResponseArtifact.type || 'artifact'} / review ${output.review?.id || output.reviewedSubmission?.id || 'linked'}`,
                proofIds: [output.reviewResponseArtifact.id, output.reviewResponseArtifact.storageProofChecksum, output.reviewResponseArtifact.eventId],
                chatProofIds: [],
                timelineProofIds: [output.reviewResponseArtifact.timelineLogId],
              } : null,
              output.resultMessageIds?.length ? {
                id: 'result-messages',
                label: 'Result Messages',
                title: `${output.resultMessageIds.length} transcript message(s)`,
                detail: output.resultMessageIds.slice(0, 3).join(' / '),
                proofIds: output.resultMessageIds,
                chatProofIds: output.resultMessageIds,
                timelineProofIds: output.timelineLogIds || [],
              } : null,
            ].filter(Boolean);
            if (!standaloneRows.length) return null;
            return (
              <div data-testid="backend-collaboration-intent-standalone-output-rows" className="mt-2 space-y-1">
                {standaloneRows.map(row => {
                  const proofIds = Array.from(new Set((row.proofIds || []).filter(Boolean)));
                  const chatProofIds = Array.from(new Set((row.chatProofIds || []).filter(Boolean)));
                  const timelineProofIds = Array.from(new Set((row.timelineProofIds || []).filter(Boolean)));
                  return (
                    <div key={`dashboard-collaboration-intent-output-${row.id}`} data-testid={`backend-collaboration-intent-output-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="min-w-0">
                          <div className="font-serif text-sm leading-tight truncate">{projectText(row.label)}: {projectText(row.title || 'output')}</div>
                          <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.detail || 'backend output')}</div>
                        </div>
                        <span className="node-status-tag bg-[#59684b] text-white">{proofIds.length}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          data-testid={`collaboration-intent-output-chat-proof-${row.id}`}
                          onClick={() => onOpenOutputChatProof(chatProofIds)}
                          disabled={outputChatProofDisabled(chatProofIds)}
                          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageSquare size={10} /> Output chat proof
                        </button>
                        <button
                          type="button"
                          data-testid={`collaboration-intent-output-timeline-proof-${row.id}`}
                          onClick={() => onOpenOutputTimelineProof(timelineProofIds)}
                          disabled={outputTimelineProofDisabled(timelineProofIds)}
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
        </div>
      )}
      <div data-testid="backend-collaboration-intent-queue-route" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        Collaboration intent route: {backendCollaborationIntentQueue.backendRoutes?.collaborationIntentQueue || `/projects/${activeProject.id}/collaboration-intent-queue`}
      </div>
    </div>
  );
}
