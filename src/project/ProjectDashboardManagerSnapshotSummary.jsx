import React from 'react';

export default function ProjectDashboardManagerSnapshotSummary({ view = {} }) {
  const {
    backendAgentAutonomousActionQueue,
    backendAutonomousRunControl,
    backendManagerActionQueue,
    backendManagerDashboard = {},
    backendManagerScenarioTrail,
    backendManagerScenarioWalkthrough,
    backendProductTeamMissionRows = [],
    backendProductTeamMissionRuns,
    backendTranscriptProofCoverageSummary,
    managerReadModelSourceBadge,
    projectText,
  } = view;

  return (
    <>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Backend Manager Snapshot</div>
        {managerReadModelSourceBadge(backendManagerDashboard, 'backend-manager-dashboard-source')}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Readiness', backendManagerDashboard.readiness?.score ?? 0],
          ['Proof Routes', backendManagerDashboard.readinessProofMap?.routes?.length ?? 0],
          ['Scenario Trail', backendManagerDashboard.managerScenarioTrail ? backendManagerDashboard.managerScenarioTrail.passedCount ?? 0 : projectText('backend required')],
          ['Walkthrough', backendManagerScenarioWalkthrough || backendManagerDashboard.managerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough?.completedCount ?? backendManagerDashboard.managerScenarioWalkthrough?.completedCount ?? 0}/${backendManagerScenarioWalkthrough?.count ?? backendManagerDashboard.managerScenarioWalkthrough?.count ?? 0}` : projectText('backend required')],
          ['Standalone Trail', backendManagerScenarioTrail ? backendManagerScenarioTrail.passedCount ?? 0 : projectText('backend required')],
          ['Action Queue', backendManagerActionQueue || backendManagerDashboard.managerActionQueue ? `${backendManagerActionQueue?.completedCount ?? backendManagerDashboard.managerActionQueue?.completedCount ?? 0}/${backendManagerActionQueue?.count ?? backendManagerDashboard.managerActionQueue?.count ?? 0}` : projectText('backend required')],
          ['Agent Queue', backendAgentAutonomousActionQueue || backendManagerDashboard.agentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue?.readyCount ?? backendManagerDashboard.agentAutonomousActionQueue?.readyCount ?? 0}/${backendAgentAutonomousActionQueue?.count ?? backendManagerDashboard.agentAutonomousActionQueue?.count ?? 0}` : projectText('backend required')],
          ['Run Control', backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable` : projectText('backend required')],
          ['Mission Runs', backendProductTeamMissionRuns?.count ?? backendProductTeamMissionRows.length ?? 0],
          ['Mission Sessions', backendProductTeamMissionRuns?.autonomousSessionCount ?? backendProductTeamMissionRows.filter(row => row.autonomousSessionId).length ?? 0],
          ['Control Runs', backendManagerDashboard.autonomousRunControlRuns?.count ?? 0],
          ['Control Loops', backendManagerDashboard.autonomousRunControlLoops?.count ?? 0],
          ['Transcript Proofs', backendManagerDashboard.transcriptIndex?.recoverableProofCount ?? 0],
          ['Transcript Coverage', backendTranscriptProofCoverageSummary ? `${backendTranscriptProofCoverageSummary.archivedProofIdCount ?? 0}/${backendTranscriptProofCoverageSummary.expectedProofIdCount ?? 0}` : 'missing'],
          ['Missing Transcript', backendTranscriptProofCoverageSummary?.missingProofIdCount ?? 'missing'],
          ['Brief Alignment', backendManagerDashboard.kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length ?? 0],
          ['Confirmed Team', backendManagerDashboard.kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter(row => row.inProjectState && row.inKickoffCharter).length ?? 0],
          ['Startup Agents', backendManagerDashboard.kickoffExecutionFlow?.allAgentStartupRows?.filter(row => row.started && row.scheduled).length ?? 0],
          ['Ops Agents', backendManagerDashboard.operationsBoard?.agents?.length ?? 0],
          ['Continuous Rows', backendManagerDashboard.continuousWorkLoop?.rows?.length ?? 0],
          ['Continuous Proofs', backendManagerDashboard.continuousWorkLoop?.proofedAgentCount ?? 0],
          ['Management Checks', backendManagerDashboard.agents?.managementMesh?.reduce((sum, row) => sum + (row.checkInCount || 0), 0) ?? 0],
          ['Agent Messages', backendManagerDashboard.agentCommunicationFlow?.rows?.length ?? 0],
          ['Delivered Messages', backendManagerDashboard.agentCommunicationFlow?.deliveredCount ?? 0],
          ['Assignment Rows', backendManagerDashboard.assignmentFlow?.rows?.length ?? 0],
          ['Assignment Timeline', backendManagerDashboard.assignmentTimelineMatrix?.timelineReadyCount ?? 0],
          ['Assignment Progress', backendManagerDashboard.assignmentWorkProgress?.progressReadyCount ?? 0],
          ['Change Rows', backendManagerDashboard.changeFlow?.rows?.length ?? 0],
          ['Change Intake', backendManagerDashboard.changeSourceIntake?.sourceReadyCount ?? 0],
          ['Change Owner Pulses', backendManagerDashboard.changeFlow?.rows?.filter(row => row.ownerWorkStarted).length ?? 0],
          ['Submissions', backendManagerDashboard.submissions?.count ?? 0],
          ['Generated Drafts', backendManagerDashboard.submissions?.generatedDraftCount ?? 0],
          ['Final Deliverables', backendManagerDashboard.submissions?.finalDeliverableCount ?? 0],
          ['Pending Review', backendManagerDashboard.submissions?.pendingReviewCount ?? 0],
          ['Evidence Searches', backendManagerDashboard.evidenceSearches?.count ?? 0],
          ['Evidence Sources', backendManagerDashboard.evidenceSearches?.sourceCount ?? 0],
          ['Accepted Reviews', backendManagerDashboard.submissionReviews?.acceptedCount ?? 0],
          ['Change Requests', backendManagerDashboard.submissionReviews?.changesRequestedCount ?? 0],
          ['Open Tasks', backendManagerDashboard.tasks?.openCount ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-base leading-tight">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Backend route: {backendManagerDashboard.backendRoutes?.readinessProofMap || 'not available'}
      </div>
    </>
  );
}
