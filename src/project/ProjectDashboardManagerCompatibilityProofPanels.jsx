import React, { lazy, Suspense } from 'react';

const ProjectDashboardCollaborationIntentFallback = lazy(() => import('./ProjectDashboardCollaborationIntentFallback.jsx'));
const ProjectDashboardTranscriptProofCoverageFallback = lazy(() => import('./ProjectDashboardTranscriptProofCoverageFallback.jsx'));

export default function ProjectDashboardManagerCompatibilityProofPanels({
  MessageSquare,
  Play,
  ScrollText,
  activeProject,
  collaborationIntentQueue,
  collaborationIntentRunOutput,
  intentRunDisabled,
  managerReadModelSourceClass,
  managerReadModelSourceLabel,
  managerReadyPackage,
  onOpenOutputChatProof,
  onOpenOutputTimelineProof,
  onOpenTranscriptProof,
  onRunIntent,
  outputChatProofDisabled,
  outputTimelineProofDisabled,
  projectText,
  transcriptProofCoverageSummary,
  transcriptProofOpenDisabled,
  transcriptProofRoute,
}) {
  return (
    <>
      {collaborationIntentQueue && !managerReadyPackage && (
        <Suspense fallback={<div data-testid="project-dashboard-collaboration-intent-fallback-loading" className="min-h-48" role="status" aria-label="正在加载兼容协作意图队列" />}>
          <ProjectDashboardCollaborationIntentFallback
            view={{
              MessageSquare,
              Play,
              ScrollText,
              activeProject,
              backendCollaborationIntentQueue: collaborationIntentQueue,
              backendCollaborationIntentRunOutput: collaborationIntentRunOutput,
              managerReadModelSourceClass,
              managerReadModelSourceLabel,
              projectText,
            }}
            onRunIntent={onRunIntent}
            intentRunDisabled={intentRunDisabled}
            onOpenOutputChatProof={onOpenOutputChatProof}
            outputChatProofDisabled={outputChatProofDisabled}
            onOpenOutputTimelineProof={onOpenOutputTimelineProof}
            outputTimelineProofDisabled={outputTimelineProofDisabled}
          />
        </Suspense>
      )}
      {transcriptProofCoverageSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-proof-coverage-fallback-loading" className="min-h-40" role="status" aria-label="正在加载对话证明覆盖" />}>
          <ProjectDashboardTranscriptProofCoverageFallback
            summary={transcriptProofCoverageSummary}
            transcriptRoute={transcriptProofRoute}
            onOpen={onOpenTranscriptProof}
            openDisabled={transcriptProofOpenDisabled}
          />
        </Suspense>
      )}
    </>
  );
}
