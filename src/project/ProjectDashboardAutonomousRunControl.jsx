import { Activity, MessageSquare, Play, ScrollText, StopCircle } from 'lucide-react';

export default function ProjectDashboardAutonomousRunControl({
  commandDisabled,
  control,
  latestLoop,
  latestRun,
  onCancelSession,
  onDirectTick,
  onOpenChatProof,
  onOpenTimelineProof,
  onPauseSession,
  onRunAction,
  onRunLoop,
  onSchedulerTick,
  onStartSession,
  projectId,
  projectText,
  providerEvidenceReceipt,
  renderAutonomousActionDecision,
  runOutput,
  sessionAvailable,
  sessionReceipt,
  sessionSchedulerPending,
  sessionTickReceipt,
  sessionWorkerReceipt,
  sourceBadge,
}) {
  return (
    <div data-testid="backend-autonomous-run-control-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Autonomous Run Control')}</div>
          <div className="font-serif text-base leading-tight break-words">
            {projectText(control.status || 'unknown')} / {projectText(control.summary?.nextActionLane || 'no lane')}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {sourceBadge}
          <span className={`node-status-tag ${control.readyForLocalPilotAutonomy ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
            {control.summary?.runnableActionCount ?? 0} runnable
          </span>
          <button
            type="button"
            data-testid="backend-autonomous-run-control-loop-run"
            onClick={() => onRunLoop()}
            disabled={commandDisabled}
            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={10} /> Run Loop
          </button>
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              data-testid="backend-autonomous-run-control-session-start"
              onClick={() => onStartSession()}
              disabled={commandDisabled}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#f7edcf] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={9} /> Start Session
            </button>
            <button
              type="button"
              data-testid="backend-autonomous-run-control-session-scheduler-tick"
              onClick={() => onSchedulerTick()}
              disabled={commandDisabled || !sessionAvailable}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#f7edcf] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Activity size={9} /> {sessionSchedulerPending ? projectText('Running Scheduler Tick…') : projectText('Scheduler Tick')}
            </button>
            <button
              type="button"
              data-testid="backend-autonomous-run-control-session-tick"
              onClick={() => onDirectTick()}
              disabled={commandDisabled || !sessionAvailable}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Activity size={9} /> Direct Tick
            </button>
            <button
              type="button"
              data-testid="backend-autonomous-run-control-session-pause"
              onClick={() => onPauseSession()}
              disabled={commandDisabled || !sessionAvailable}
              className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <StopCircle size={9} /> Pause
            </button>
            <button
              type="button"
              data-testid="backend-autonomous-run-control-session-cancel"
              onClick={() => onCancelSession()}
              disabled={commandDisabled || !sessionAvailable}
              className="inline-flex items-center justify-center gap-1 border border-[#8f1e18] bg-[#f8d8d3] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#6f1612] hover:border-[#4c0f0c] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <StopCircle size={9} /> Cancel
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Manager Ready', control.summary?.managerReadyCount ?? 0],
          ['Agent Ready', control.summary?.agentReadyCount ?? 0],
          ['Worker Queued', control.summary?.workerQueuedCount ?? 0],
          ['Proof Routes', (control.summary?.proofIdCount ?? 0) + (control.summary?.timelineLogIdCount ?? 0)],
        ].map(([label, value]) => (
          <div key={`autonomous-run-control-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
            <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        Route: {control.backendRoutes?.autonomousRunControl || `/projects/${projectId}/autonomous-run-control`} / Tick: {control.backendRoutes?.schedulerTick || '/workers/autonomous/tick'}
      </div>
      {latestRun && (
        <div data-testid="backend-autonomous-run-control-run-receipt" className="mt-2 border border-[#7b6542] bg-[#efe2bd]/70 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Run receipt: {latestRun.actionLabel || latestRun.actionId} / {latestRun.actionLane || 'lane'} / {latestRun.delegatedRunKind || 'delegated'}
        </div>
      )}
      {runOutput && (
        <div data-testid="backend-autonomous-run-control-run-output" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Run Control Output Nodes')}</div>
          <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(runOutput.actionLabel || 'run control action')} / {projectText(runOutput.delegatedRunKind || 'delegated')} / {projectText(runOutput.runId || 'receipt pending')}
          </div>
          {renderAutonomousActionDecision(runOutput.autonomousActionDecision, {
            testId: 'backend-run-control-action-decision',
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
                detail: `${output.actionLane || 'lane'} / ${output.delegatedRunKind || 'delegated'}`,
                proofIds: output.resultMessageIds,
                chatProofIds: output.resultMessageIds,
                timelineProofIds: output.timelineLogIds || [],
              } : null,
            ].filter(Boolean);
            if (!rows.length) {
              return (
                <div data-testid="backend-autonomous-run-control-run-output-empty" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                  {projectText('No run output returned yet')}
                </div>
              );
            }
            return (
              <div data-testid="backend-autonomous-run-control-run-output-rows" className="mt-2 space-y-1">
                {rows.map(row => {
                  const proofIds = Array.from(new Set((row.proofIds || []).filter(Boolean)));
                  const chatProofIds = Array.from(new Set((row.chatProofIds || []).filter(Boolean)));
                  const timelineProofIds = Array.from(new Set((row.timelineProofIds || []).filter(Boolean)));
                  return (
                    <div key={`autonomous-run-control-output-${row.id}`} data-testid={`backend-autonomous-run-control-output-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
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
                          data-testid={`autonomous-run-control-output-chat-proof-${row.id}`}
                          onClick={() => onOpenChatProof(chatProofIds)}
                          disabled={!chatProofIds.length}
                          className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MessageSquare size={10} /> Output chat proof
                        </button>
                        <button
                          type="button"
                          data-testid={`autonomous-run-control-output-timeline-proof-${row.id}`}
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
      {latestLoop && (
        <div data-testid="backend-autonomous-run-control-loop-receipt" className="mt-2 border border-[#7b6542] bg-[#f7edcf] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Loop receipt: {latestLoop.stepCount ?? 0}/{latestLoop.maxSteps ?? 0} steps / {latestLoop.stoppedReason || 'complete'} / receipts {(latestLoop.runReceiptIds || []).length}
        </div>
      )}
      {sessionReceipt && (
        <div data-testid="backend-autonomous-run-control-session-receipt" className="mt-2 border border-[#7b6542] bg-[#efe2bd]/70 px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Autopilot session: {sessionReceipt.status || 'unknown'} / {sessionReceipt.completedSteps ?? 0}/{sessionReceipt.maxTotalSteps ?? 0} steps / ticks {sessionReceipt.tickCount ?? 0} / target {sessionReceipt.targetReadyCount ?? sessionReceipt.targetSnapshot?.readyCount ?? 0}/{sessionReceipt.targetSnapshot?.rowCount ?? 'unknown'} / next {sessionReceipt.targetNextMissingStageId || sessionReceipt.targetSnapshot?.nextMissingStageId || 'complete'}
        </div>
      )}
      {sessionSchedulerPending && (
        <div data-testid="backend-autonomous-run-control-session-scheduler-running" role="status" className="mt-2 flex items-center gap-2 border border-[#7b6542] bg-[#efe2bd]/70 px-2 py-2 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#8f1e18]" aria-hidden="true" />
          {projectText('Running Scheduler Tick…')}
        </div>
      )}
      {sessionTickReceipt && (
        <div data-testid="backend-autonomous-run-control-session-tick-receipt" className="mt-2 border border-[#7b6542] bg-[#f7edcf] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          Autopilot tick: {sessionTickReceipt.stepCount ?? 0} steps / loops {(sessionTickReceipt.loopReceiptIds || []).length} / agents {(sessionTickReceipt.agentIds || []).join(', ') || 'none'} / {sessionTickReceipt.statusBefore || 'unknown'} to {sessionTickReceipt.statusAfter || 'unknown'} / target {sessionTickReceipt.targetReadyCount ?? sessionTickReceipt.targetSnapshot?.readyCount ?? 0}/{sessionTickReceipt.targetSnapshot?.rowCount ?? 'unknown'} / next {sessionTickReceipt.targetNextMissingStageId || sessionTickReceipt.targetSnapshot?.nextMissingStageId || 'complete'} / control {sessionTickReceipt.targetControl?.targetStageId || 'none'}
        </div>
      )}
      {sessionWorkerReceipt && (
        <div data-testid="backend-autonomous-run-control-session-worker-receipt" className="mt-2 border border-[#59684b] bg-[#eef5df] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#3f5136] leading-relaxed break-words">
          {'Autopilot worker: /workers/autonomous/tick -> /workers/autopilot/due / session '} {sessionWorkerReceipt.sessionId || 'active'} / tick {sessionWorkerReceipt.tickId || sessionTickReceipt?.id || 'pending'} / stage {sessionWorkerReceipt.targetStageId || sessionTickReceipt?.targetControl?.targetStageId || 'none'} / lanes {(sessionWorkerReceipt.actionLanes || []).join(', ') || 'none'}
        </div>
      )}
      {providerEvidenceReceipt?.providerEvidenceSearch && (
        <div data-testid="backend-autopilot-provider-evidence-receipt" className="mt-2 border border-[#59684b] bg-[#eef5df] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#3f5136] leading-relaxed break-words">
          Provider evidence: {providerEvidenceReceipt.status || providerEvidenceReceipt.providerEvidenceSearch.status || 'recorded'} / {providerEvidenceReceipt.provider || providerEvidenceReceipt.providerEvidenceSearch.provider || 'provider'} / evidence {providerEvidenceReceipt.evidenceSearchId || 'pending'} / usage {providerEvidenceReceipt.providerUsageId || 'pending'} / receipt {providerEvidenceReceipt.providerReceiptId || 'pending'} / sources {providerEvidenceReceipt.sourceCount ?? 0}
        </div>
      )}
      <div className="mt-2 space-y-2">
        {(control.nextActions || []).slice(0, 3).map(action => (
          <div key={action.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight break-words">{projectText(action.label || action.id)}</div>
                <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                  {projectText(action.lane || 'lane')} / {projectText(action.status || 'unknown')} / {action.method || 'POST'} {action.runApiPath || action.apiPath || 'route pending'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`node-status-tag ${action.canRun ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                  {action.canRun ? 'ready' : 'blocked'}
                </span>
                <button
                  type="button"
                  data-testid={`backend-autonomous-run-control-action-run-${action.id}`}
                  onClick={() => onRunAction(action)}
                  disabled={commandDisabled || !action.canRun}
                  className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={10} /> Run
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {control.gates?.length > 0 && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          {control.gates.slice(0, 4).map(gate => (
            <div key={gate.id} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight break-words">{projectText(gate.label || gate.id)}</div>
                  <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{projectText(gate.apiPath || 'route pending')}</div>
                </div>
                <span className={`node-status-tag ${gate.passed ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                  {gate.passed ? 'passed' : 'blocked'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
