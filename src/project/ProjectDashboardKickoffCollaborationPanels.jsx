import React, { Suspense, lazy } from 'react';

const ProjectDashboardGovernanceSpeechProtocol = lazy(() => import('./ProjectDashboardGovernanceSpeechProtocol.jsx'));
const ProjectDashboardKickoffCharter = lazy(() => import('./ProjectDashboardKickoffCharter.jsx'));
const ProjectDashboardKickoffMeetingFlow = lazy(() => import('./ProjectDashboardKickoffMeetingFlow.jsx'));
const ProjectDashboardKickoffExecutionFlow = lazy(() => import('./ProjectDashboardKickoffExecutionFlow.jsx'));
const ProjectDashboardGroupChatTranscriptIndex = lazy(() => import('./ProjectDashboardGroupChatTranscriptIndex.jsx'));

export default function ProjectDashboardKickoffCollaborationPanels({ view }) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-governance-speech-protocol-loading" className="min-h-72" role="status" aria-label="正在加载治理与发言规则" />}>
        <ProjectDashboardGovernanceSpeechProtocol view={view.governanceSpeechProtocol} />
      </Suspense>

      {view.kickoffCharter && (
        <Suspense fallback={<div data-testid="project-dashboard-kickoff-charter-loading" className="min-h-64" role="status" aria-label="正在加载立项章程" />}>
          <ProjectDashboardKickoffCharter view={view.kickoffCharterView} />
        </Suspense>
      )}

      {view.kickoffMeetingFlow && (
        <Suspense fallback={<div data-testid="project-dashboard-kickoff-meeting-flow-loading" className="min-h-96" role="status" aria-label="正在加载立项会议流程" />}>
          <ProjectDashboardKickoffMeetingFlow view={view.kickoffMeetingFlowView} />
        </Suspense>
      )}

      {(view.kickoffExecutionFlowBackendRequired || view.kickoffExecutionFlow) && (
        <Suspense fallback={<div data-testid="project-dashboard-kickoff-execution-flow-loading" className="min-h-96" role="status" aria-label="正在加载立项执行流程" />}>
          <ProjectDashboardKickoffExecutionFlow view={view.kickoffExecutionFlowView} />
        </Suspense>
      )}

      <Suspense fallback={<div data-testid="project-dashboard-group-chat-transcript-index-loading" className="min-h-96" role="status" aria-label="正在加载群聊记录索引" />}>
        <ProjectDashboardGroupChatTranscriptIndex view={view.groupChatTranscriptIndex} />
      </Suspense>
    </>
  );
}
