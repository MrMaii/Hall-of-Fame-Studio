import React from 'react';
import { CornerDownRight, Database, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardManagerActionRunLedger({ view = {} }) {
  const {
    backendManagerActionRunOutput,
    backendManagerActionRuns,
    backendWorkerStationSyncDisabled,
    managerReadModelSourceBadge,
    onOpenChatProof,
    onOpenTimelineProof,
    onSyncManagerDashboard,
    projectText,
  } = view;

  return (
    <div data-testid="manager-action-run-ledger" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Action Run Ledger</div>
          <div className="font-serif text-2xl leading-tight">Every Playbook execution becomes timeline evidence and a backend action receipt.</div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {managerReadModelSourceBadge(backendManagerActionRuns, 'manager-action-run-ledger-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {backendManagerActionRuns?.count || 0} runs
          </span>
        </div>
      </div>
      {backendManagerActionRuns.frontendMockSuppressed && (
        <div data-testid="manager-action-run-ledger-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Manager Action Run Ledger is required for this real project. Local run history is suppressed until Manager Dashboard returns manager-action-runs/v1.</span>
          <button
            type="button"
            data-testid="manager-action-run-ledger-sync-manager-dashboard"
            onClick={onSyncManagerDashboard}
            disabled={backendWorkerStationSyncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Dashboard
          </button>
        </div>
      )}
      {backendManagerActionRunOutput && (
        <div data-testid="manager-action-run-output" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/70 px-3 py-3">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Manager Action Output Nodes')}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(backendManagerActionRunOutput.actionLabel || 'manager action')} / {projectText(backendManagerActionRunOutput.resultRoute || 'manager-action-queue-item-run')} / {projectText(backendManagerActionRunOutput.runId || 'receipt pending')}
          </div>
          {(() => {
            const output = backendManagerActionRunOutput || {};
            const rows = [
              output.resultMessageIds?.length ? {
                id: 'result-messages',
                label: 'Result Messages',
                title: `${output.resultMessageIds.length} transcript message(s)`,
                detail: `${output.requirementId || output.actionId || 'manager-action'} / ${output.resultRoute || 'manager-action-queue-item-run'}`,
                proofIds: output.resultMessageIds,
                chatProofIds: output.resultMessageIds,
                timelineProofIds: output.timelineLogIds || [],
              } : null,
              output.task ? {
                id: 'task',
                label: 'Task Node',
                title: output.task.text || output.task.title || output.task.id,
                detail: `${output.task.ownerName || output.task.ownerId || 'owner'} / ${output.task.status || 'task'}`,
                proofIds: [output.task.id, output.task.assignmentMessageId, output.task.acknowledgementMessageId, ...(output.task.timelineLogIds || [])],
                chatProofIds: [output.task.assignmentMessageId, output.task.acknowledgementMessageId],
                timelineProofIds: output.task.timelineLogIds || [],
              } : null,
              output.workSubmission ? {
                id: 'work-submission',
                label: 'Agent Submission',
                title: output.workSubmission.title || output.workSubmission.artifactType || output.workSubmission.id,
                detail: `${output.workSubmission.artifactType || 'artifact'} / ${output.workSubmission.status || output.workSubmission.reviewStatus || 'submitted'}`,
                proofIds: [output.workSubmission.messageId, output.workSubmission.timelineLogId, output.workSubmission.eventId, output.workSubmission.artifactStorageProofChecksum],
                chatProofIds: [output.workSubmission.messageId],
                timelineProofIds: [output.workSubmission.timelineLogId],
              } : null,
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
                proofIds: [output.evidenceSearch.id, output.evidenceSearch.messageId, output.evidenceSearch.logId, output.evidenceSearch.eventId],
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
              output.cycle ? {
                id: 'autonomous-cycle',
                label: 'Autonomous Cycle',
                title: output.cycle.cadence || output.cycle.id,
                detail: `${output.cycle.status || 'cycle'} / ${output.cycle.completedTaskIds?.length || 0} completed`,
                proofIds: [output.cycle.id, output.cycle.logId, output.cycle.eventId],
                chatProofIds: [],
                timelineProofIds: [output.cycle.logId],
              } : null,
              output.schedulerTick ? {
                id: 'scheduler-tick',
                label: 'Scheduler Tick',
                title: output.schedulerTick.trigger || output.schedulerTick.schemaVersion || 'scheduler tick',
                detail: `projects ${output.schedulerTick.projectProcessedCount ?? 0} / agents ${output.schedulerTick.agentProcessedCount ?? 0}`,
                proofIds: [output.schedulerTick.trigger, output.schedulerTick.agentTrigger, ...(output.timelineLogIds || [])],
                chatProofIds: output.resultMessageIds || [],
                timelineProofIds: output.timelineLogIds || [],
              } : null,
            ].filter(Boolean);
            if (!rows.length) {
              return (
                <div data-testid="manager-action-run-output-empty" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                  {projectText('No Manager action output returned yet')}
                </div>
              );
            }
            return (
              <div data-testid="manager-action-run-output-rows" className="mt-2 space-y-1">
                {rows.map(row => {
                  const proofIds = Array.from(new Set((row.proofIds || []).filter(Boolean)));
                  const chatProofIds = Array.from(new Set((row.chatProofIds || []).filter(Boolean)));
                  const timelineProofIds = Array.from(new Set((row.timelineProofIds || []).filter(Boolean)));
                  return (
                    <div key={`manager-action-output-${row.id}`} data-testid={`manager-action-output-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
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
                          data-testid={`manager-action-output-chat-proof-${row.id}`}
                          onClick={() => onOpenChatProof(chatProofIds)}
                          disabled={!chatProofIds.length}
                          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageSquare size={10} /> Output chat proof
                        </button>
                        <button
                          type="button"
                          data-testid={`manager-action-output-timeline-proof-${row.id}`}
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
        </div>
      )}
      <div className="space-y-2">
        {(backendManagerActionRuns?.rows || []).slice(0, 4).map((run, index) => (
          <div key={`manager-action-run-${run.id || index}`} data-testid={`manager-action-run-row-${run.requirementId || run.actionId || index}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{run.actionLabel || run.label || run.requirementId || 'Manager action'}</div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                  {run.executedAt ? new Date(run.executedAt).toLocaleString() : 'recent'} / {run.resultRoute || 'manager-action-queue-item-run'} / {run.runApiPath || run.route || 'run route pending'}
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
                  Timeline proof: {(run.timelineLogIds || [run.logId].filter(Boolean)).length} / Messages: {run.resultMessageCount || 0}
                </div>
              </div>
              <button
                type="button"
                data-testid={`manager-action-run-proof-${run.requirementId || run.actionId || index}`}
                onClick={() => onOpenTimelineProof((run.timelineLogIds || [run.logId]).filter(Boolean))}
                disabled={!(run.timelineLogIds?.length || run.logId)}
                className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CornerDownRight size={10} /> Run proof
              </button>
            </div>
          </div>
        ))}
        {!(backendManagerActionRuns?.rows || []).length && !backendManagerActionRuns.frontendMockSuppressed && (
          <div className="border border-dashed border-[#d8c99f] bg-[#efe2bd]/45 p-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
            No Playbook runs yet. Use Run Action on a ready row to create the first audit receipt.
          </div>
        )}
      </div>
    </div>
  );
}
