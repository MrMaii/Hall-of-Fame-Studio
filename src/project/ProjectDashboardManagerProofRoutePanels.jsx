import React, { Suspense, lazy } from 'react';

const ProjectDashboardTranscriptProofCoverage = lazy(() => import('./ProjectDashboardTranscriptProofCoverage.jsx'));
const ProjectDashboardTranscriptChannelRoutes = lazy(() => import('./ProjectDashboardTranscriptChannelRoutes.jsx'));
const ProjectDashboardTranscriptChannelPinRoutes = lazy(() => import('./ProjectDashboardTranscriptChannelPinRoutes.jsx'));
const ProjectDashboardTranscriptPinRoutes = lazy(() => import('./ProjectDashboardTranscriptPinRoutes.jsx'));
const ProjectDashboardTranscriptReplyRoutes = lazy(() => import('./ProjectDashboardTranscriptReplyRoutes.jsx'));
const ProjectDashboardTranscriptMentionRoutes = lazy(() => import('./ProjectDashboardTranscriptMentionRoutes.jsx'));
const ProjectDashboardTranscriptAttachmentRoutes = lazy(() => import('./ProjectDashboardTranscriptAttachmentRoutes.jsx'));
const ProjectDashboardTranscriptMemberPresenceRoutes = lazy(() => import('./ProjectDashboardTranscriptMemberPresenceRoutes.jsx'));
const ProjectDashboardAgentMessageRoutes = lazy(() => import('./ProjectDashboardAgentMessageRoutes.jsx'));
const ProjectDashboardAgentContractRoutes = lazy(() => import('./ProjectDashboardAgentContractRoutes.jsx'));
const ProjectDashboardCollaborationIntentQueue = lazy(() => import('./ProjectDashboardCollaborationIntentQueue.jsx'));
const ProjectDashboardSubmissionReviewWorkflow = lazy(() => import('./ProjectDashboardSubmissionReviewWorkflow.jsx'));

export default function ProjectDashboardManagerProofRoutePanels({ view }) {
  return (
    <>
      {view.backendTranscriptProofCoverageSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-proof-coverage-loading" className="min-h-24 border border-[#d8c99f]" role="status" aria-label="正在加载聊天证明覆盖状态" />}>
          <ProjectDashboardTranscriptProofCoverage view={view.transcriptProofCoverageView} />
        </Suspense>
      )}
      {view.backendTranscriptChannelSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-channel-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载聊天频道路由" />}>
          <ProjectDashboardTranscriptChannelRoutes view={view.transcriptChannelRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptChannelPinSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-channel-pin-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载频道固定路由" />}>
          <ProjectDashboardTranscriptChannelPinRoutes view={view.transcriptChannelPinRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptPinSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-pin-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载消息固定路由" />}>
          <ProjectDashboardTranscriptPinRoutes view={view.transcriptPinRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptReplySummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-reply-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载回复路由" />}>
          <ProjectDashboardTranscriptReplyRoutes view={view.transcriptReplyRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptMentionSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-mention-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载提及路由" />}>
          <ProjectDashboardTranscriptMentionRoutes view={view.transcriptMentionRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptAttachmentSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-attachment-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载附件路由" />}>
          <ProjectDashboardTranscriptAttachmentRoutes view={view.transcriptAttachmentRoutesView} />
        </Suspense>
      )}
      {view.backendTranscriptMemberPresenceSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-transcript-member-presence-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载成员在线状态路由" />}>
          <ProjectDashboardTranscriptMemberPresenceRoutes view={view.transcriptMemberPresenceRoutesView} />
        </Suspense>
      )}
      {view.backendAgentMessageSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-agent-message-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载 Agent 消息路由" />}>
          <ProjectDashboardAgentMessageRoutes view={view.agentMessageRoutesView} />
        </Suspense>
      )}
      {view.backendAgentContractSummary && (
        <Suspense fallback={<div data-testid="project-dashboard-agent-contract-routes-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载 Agent 合同路由" />}>
          <ProjectDashboardAgentContractRoutes view={view.agentContractRoutesView} />
        </Suspense>
      )}
      {view.backendCollaborationIntentQueue && (
        <Suspense fallback={<div data-testid="project-dashboard-collaboration-intent-queue-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载协作意图队列" />}>
          <ProjectDashboardCollaborationIntentQueue view={view.collaborationIntentQueueView} />
        </Suspense>
      )}
      {view.backendSubmissionReviewWorkflow && (
        <Suspense fallback={<div data-testid="project-dashboard-submission-review-workflow-loading" className="min-h-28 border border-[#d8c99f]" role="status" aria-label="正在加载提交评审流程" />}>
          <ProjectDashboardSubmissionReviewWorkflow view={view.submissionReviewWorkflowView} />
        </Suspense>
      )}
    </>
  );
}
