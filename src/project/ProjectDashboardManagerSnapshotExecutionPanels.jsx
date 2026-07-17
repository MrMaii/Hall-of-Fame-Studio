import React, { lazy, Suspense } from 'react';

const ProjectDashboardManagerSnapshotSummary = lazy(() => import('./ProjectDashboardManagerSnapshotSummary.jsx'));
const ProjectDashboardProductTeamMissionRunner = lazy(() => import('./ProjectDashboardProductTeamMissionRunner.jsx'));

export default function ProjectDashboardManagerSnapshotExecutionPanels({
  MessageSquare,
  Network,
  Play,
  ScrollText,
  activeProject,
  agentAutonomousActionQueue,
  autonomousRunControl,
  handoffChatProofDisabled,
  handoffTimelineProofDisabled,
  latestProductTeamMissionRun,
  managerActionQueue,
  managerDashboard,
  managerReadModelSourceBadge,
  managerScenarioTrail,
  managerScenarioWalkthrough,
  missionChatProofDisabled,
  missionFlowNodeDisabled,
  missionHandoffExecution,
  missionHandoffExecutionOutputRows,
  missionHandoffIntentRow,
  missionTimelineProofDisabled,
  onOpenHandoffChatProof,
  onOpenHandoffTimelineProof,
  onOpenMissionChatProof,
  onOpenMissionFlowNode,
  onOpenMissionTimelineProof,
  onRunHandoffIntent,
  productTeamMissionRows,
  productTeamMissionRuns,
  projectText,
  runHandoffIntentDisabled,
  transcriptProofCoverageSummary,
}) {
  return (
    <>
      <Suspense fallback={<div data-testid="project-dashboard-manager-snapshot-summary-loading" className="min-h-56" role="status" aria-label="正在加载经理快照摘要" />}>
        <ProjectDashboardManagerSnapshotSummary
          view={{
            backendAgentAutonomousActionQueue: agentAutonomousActionQueue,
            backendAutonomousRunControl: autonomousRunControl,
            backendManagerActionQueue: managerActionQueue,
            backendManagerDashboard: managerDashboard,
            backendManagerScenarioTrail: managerScenarioTrail,
            backendManagerScenarioWalkthrough: managerScenarioWalkthrough,
            backendProductTeamMissionRows: productTeamMissionRows,
            backendProductTeamMissionRuns: productTeamMissionRuns,
            backendTranscriptProofCoverageSummary: transcriptProofCoverageSummary,
            managerReadModelSourceBadge,
            projectText,
          }}
        />
      </Suspense>
      {latestProductTeamMissionRun && (
        <Suspense fallback={<div data-testid="project-dashboard-product-team-mission-runner-loading" className="min-h-56" role="status" aria-label="正在加载产品团队任务运行状态" />}>
          <ProjectDashboardProductTeamMissionRunner
            view={{
              MessageSquare,
              Network,
              Play,
              ScrollText,
              activeProject,
              backendLatestProductTeamMissionRun: latestProductTeamMissionRun,
              backendMissionHandoffExecution: missionHandoffExecution,
              backendMissionHandoffExecutionOutputRows: missionHandoffExecutionOutputRows,
              backendMissionHandoffIntentRow: missionHandoffIntentRow,
              backendProductTeamMissionRows: productTeamMissionRows,
              backendProductTeamMissionRuns: productTeamMissionRuns,
              projectText,
            }}
            onRunHandoffIntent={onRunHandoffIntent}
            runHandoffIntentDisabled={runHandoffIntentDisabled}
            onOpenHandoffChatProof={onOpenHandoffChatProof}
            handoffChatProofDisabled={handoffChatProofDisabled}
            onOpenHandoffTimelineProof={onOpenHandoffTimelineProof}
            handoffTimelineProofDisabled={handoffTimelineProofDisabled}
            onOpenMissionChatProof={onOpenMissionChatProof}
            missionChatProofDisabled={missionChatProofDisabled}
            onOpenMissionTimelineProof={onOpenMissionTimelineProof}
            missionTimelineProofDisabled={missionTimelineProofDisabled}
            onOpenMissionFlowNode={onOpenMissionFlowNode}
            missionFlowNodeDisabled={missionFlowNodeDisabled}
          />
        </Suspense>
      )}
    </>
  );
}
