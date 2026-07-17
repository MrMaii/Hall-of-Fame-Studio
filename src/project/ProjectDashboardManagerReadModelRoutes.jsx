import React from 'react';

export default function ProjectDashboardManagerReadModelRoutes({
  backendManagerDashboard,
  activeProjectId,
  backendManagerCommandCenter,
  backendManagerScenarioTrail,
  backendManagerScenarioWalkthrough,
  backendManagerRequirementMatrix,
  backendManagerActionQueue,
  backendAgentAutonomousActionQueue,
  backendAutonomousRunControl,
}) {
  return (
    <>
      <div data-testid="backend-manager-command-center-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Command center route: {backendManagerDashboard.backendRoutes?.managerCommandCenter || '/manager-command-center'} / {backendManagerCommandCenter ? (backendManagerCommandCenter.nextBestAction?.canRun ? 'next action ready' : backendManagerCommandCenter.status || 'monitoring') : 'backend required'}
      </div>
      <div data-testid="backend-manager-scenario-trail-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Scenario trail route: {backendManagerDashboard.backendRoutes?.managerScenarioTrail || '/manager-scenario-trail'} / {backendManagerScenarioTrail ? `${backendManagerScenarioTrail.passedCount ?? 0}-${backendManagerScenarioTrail.count ?? 0} ready` : 'backend required'}
      </div>
      <div data-testid="backend-manager-scenario-walkthrough-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Walkthrough route: {backendManagerDashboard.backendRoutes?.managerScenarioWalkthrough || '/manager-scenario-walkthrough'} / {backendManagerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough.completedCount ?? 0}-${backendManagerScenarioWalkthrough.count ?? 0} complete` : 'backend required'}
      </div>
      <div data-testid="backend-manager-requirement-matrix-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Requirement matrix route: {backendManagerDashboard.backendRoutes?.managerRequirementMatrix || '/manager-requirement-matrix'} / {backendManagerRequirementMatrix ? `${backendManagerRequirementMatrix.passedCount ?? 0}-${backendManagerRequirementMatrix.count ?? 0} ready` : 'backend required'}
      </div>
      <div data-testid="backend-manager-action-queue-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Action queue route: {backendManagerDashboard.backendRoutes?.managerActionQueue || '/manager-action-queue'} / {backendManagerActionQueue ? `${backendManagerActionQueue.readyCount ?? 0} ready next actions` : 'backend required'}
      </div>
      <div data-testid="backend-agent-autonomous-action-queue-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Agent autonomous queue route: {backendManagerDashboard.backendRoutes?.agentAutonomousActionQueue || `/projects/${activeProjectId}/agent-autonomous-action-queue`} / {backendAgentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue.readyCount ?? 0} ready Agent actions` : 'backend required'}
      </div>
      <div data-testid="backend-autonomous-run-control-route" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Autonomous run control route: {backendAutonomousRunControl?.backendRoutes?.autonomousRunControl || backendManagerDashboard.backendRoutes?.autonomousRunControl || `/projects/${activeProjectId}/autonomous-run-control`} / {backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable actions` : 'backend required'}
      </div>
    </>
  );
}
