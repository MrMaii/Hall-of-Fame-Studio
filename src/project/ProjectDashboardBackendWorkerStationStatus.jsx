import React from 'react';
import { Save } from 'lucide-react';

export default function ProjectDashboardBackendWorkerStationStatus({
  backendConfiguredTargetLabel,
  backendOnline,
  backendScheduler,
  backendSchedulerAgentControls,
  backendSchedulerAutopilotControls,
  backendStation,
  backendStatusText,
  backendWorkerStationTargetRequiredDetail,
  onBaseUrlChange,
  onOpenDeployment,
  onSaveBaseUrl,
  projectText,
}) {
  return (
    <>
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Backend Worker Station')}</div>
      <div className="font-serif text-xl leading-tight">{projectText(backendStatusText)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
        <span data-testid="backend-worker-connection-status" className={`border px-2 py-1 ${backendOnline ? 'border-[#2f6f47] text-[#2f6f47]' : 'border-[#8f1e18] text-[#8f1e18]'}`}>
          {projectText(backendOnline ? 'Online' : backendStation.connectionStatus === 'unknown' ? 'Not checked' : 'Offline')}
        </span>
        <span>{backendConfiguredTargetLabel}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          data-testid="backend-url-input"
          value={backendStation.draftBaseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          className="min-w-[260px] flex-1 border border-[#b8a57d] bg-[#f7edcf] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
          aria-label="Backend worker station URL"
        />
        <button
          type="button"
          onClick={onSaveBaseUrl}
          disabled={backendStation.loading}
          className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
        >
          <Save size={13} /> {projectText('Save URL')}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Ticks', backendScheduler.tickCount ?? 0],
          ['Processed', backendScheduler.processedCount ?? 0],
          ['Agent Runs', backendScheduler.agentProcessedCount ?? 0],
          ['Autopilot Runs', backendScheduler.autopilotProcessedCount ?? 0],
          ['Skipped', backendScheduler.skippedCount ?? 0],
          ['Agent Skips', backendScheduler.agentSkippedCount ?? 0],
          ['Autopilot Skips', backendScheduler.autopilotSkippedCount ?? 0],
          ['Messages', backendScheduler.messageCount ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
            <div className="font-serif text-lg leading-none">{value}</div>
          </div>
        ))}
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-3">
        {projectText('Last tick')}: {backendScheduler.lastTickAt ? new Date(backendScheduler.lastTickAt).toLocaleString() : projectText('none')} / {projectText('Last complete')}: {backendScheduler.lastCompletedAt ? new Date(backendScheduler.lastCompletedAt).toLocaleString() : projectText('none')}
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        {/* Compatibility proof anchor: Immediate Start */}
        IMMEDIATE START: {(backendScheduler.lastStartedRunImmediately || /Started backend scheduler/i.test(backendStation.lastAction || '')) ? 'YES' : 'NO'} / RUNNING: {backendScheduler.running ? 'YES' : 'NO'}
      </div>
      <div data-testid="backend-scheduler-agent-controls" className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1 break-words">
        AGENT CONTROL: STRATEGY {backendSchedulerAgentControls.useAgentAutonomousStrategy ? 'YES' : 'NO'} / SUBMISSIONS {backendSchedulerAgentControls.submitAgentWorkArtifacts ? 'YES' : 'NO'} / REVIEW RESPONSES {backendSchedulerAgentControls.respondToReviewObligations ? 'YES' : 'NO'} / ARTIFACT {backendSchedulerAgentControls.workArtifactType || 'none'}
      </div>
      <div data-testid="backend-scheduler-autopilot-controls" className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1 break-words">
        AUTOPILOT CONTROL: {backendSchedulerAutopilotControls.enabled ? 'ENABLED' : 'OFF'} / LOOP {backendSchedulerAutopilotControls.loopCount || 'none'} / SESSIONS {backendScheduler.autopilotSessionTickCount ?? 0} / TARGET {backendSchedulerAutopilotControls.targetKind || 'product-team-delivery-trace'}
      </div>
      {(backendScheduler.startupAgentControlSummary || backendScheduler.scheduledAgentControlSummary) && (
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1 break-words">
          STARTUP CONTROL: {backendScheduler.startupAgentControlSummary?.schemaVersion || 'none'} / SCHEDULED CONTROL: {backendScheduler.scheduledAgentControlSummary?.schemaVersion || 'none'}
        </div>
      )}
      {(backendScheduler.startupAutopilotControlSummary || backendScheduler.scheduledAutopilotControlSummary || backendScheduler.lastTickAutopilotControlSummary) && (
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1 break-words">
          AUTOPILOT SCHEDULER: {backendScheduler.lastTickAutopilotControlSummary?.schemaVersion || 'not ticked'} / STARTUP {backendScheduler.startupAutopilotControlSummary?.enabled ? 'on' : 'off'} / SCHEDULED {backendScheduler.scheduledAutopilotControlSummary?.enabled ? 'on' : 'off'}
        </div>
      )}
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        {projectText('Project sync')}: {backendStation.lastProjectSyncAt ? new Date(backendStation.lastProjectSyncAt).toLocaleString() : projectText('not synced')} / {backendStation.projectSyncCount || 0} {projectText('pulls')}
      </div>
      {backendWorkerStationTargetRequiredDetail && (
        <div data-testid="backend-worker-station-target-required" className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-[#8f1e18] bg-[#f4d6c7] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          <span>{backendWorkerStationTargetRequiredDetail}</span>
          <button
            type="button"
            data-testid="backend-worker-station-open-deployment"
            onClick={onOpenDeployment}
            className="border border-[#8f1e18] bg-[#f7edcf] px-2 py-1 text-[#8f1e18] hover:bg-[#efe2bd]"
          >
            {projectText('Open Settings Deployment')}
          </button>
        </div>
      )}
      <div data-testid="backend-project-catalog-sync-status" className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Project catalog sync: {backendStation.lastProjectCatalogSyncAt ? new Date(backendStation.lastProjectCatalogSyncAt).toLocaleString() : 'not synced'} / {backendStation.projectCatalogSyncCount || 0} pulls / {(backendStation.projectCatalog || []).length} projects
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Ready package sync: {backendStation.lastManagerReadyPackageSyncAt ? new Date(backendStation.lastManagerReadyPackageSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerReadyPackageSyncCount || 0} pulls
      </div>
      {backendStation.lastManagerReadyPackageSyncAt && (
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
          BACKEND MANAGER READY PACKAGE SYNCED
        </div>
      )}
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Manager dashboard sync: {backendStation.lastManagerDashboardSyncAt ? new Date(backendStation.lastManagerDashboardSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerDashboardSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Command center sync: {backendStation.lastManagerCommandCenterSyncAt ? new Date(backendStation.lastManagerCommandCenterSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerCommandCenterSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Scenario walkthrough sync: {backendStation.lastManagerScenarioWalkthroughSyncAt ? new Date(backendStation.lastManagerScenarioWalkthroughSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerScenarioWalkthroughSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Scenario trail sync: {backendStation.lastManagerScenarioTrailSyncAt ? new Date(backendStation.lastManagerScenarioTrailSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerScenarioTrailSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Requirement matrix sync: {backendStation.lastManagerRequirementMatrixSyncAt ? new Date(backendStation.lastManagerRequirementMatrixSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerRequirementMatrixSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Sync protocol audit sync: {backendStation.lastSyncProtocolAuditSyncAt ? new Date(backendStation.lastSyncProtocolAuditSyncAt).toLocaleString() : 'not synced'} / {backendStation.syncProtocolAuditSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Use case audit sync: {backendStation.lastManagerUseCaseAuditSyncAt ? new Date(backendStation.lastManagerUseCaseAuditSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerUseCaseAuditSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Action queue sync: {backendStation.lastManagerActionQueueSyncAt ? new Date(backendStation.lastManagerActionQueueSyncAt).toLocaleString() : 'not synced'} / {backendStation.managerActionQueueSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Agent autonomous queue sync: {backendStation.lastAgentAutonomousActionQueueSyncAt ? new Date(backendStation.lastAgentAutonomousActionQueueSyncAt).toLocaleString() : 'not synced'} / {backendStation.agentAutonomousActionQueueSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Collaboration intent queue sync: {backendStation.lastCollaborationIntentQueueSyncAt ? new Date(backendStation.lastCollaborationIntentQueueSyncAt).toLocaleString() : 'not synced'} / {backendStation.collaborationIntentQueueSyncCount || 0} pulls
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Autonomous run control sync: {backendStation.lastAutonomousRunControlSyncAt ? new Date(backendStation.lastAutonomousRunControlSyncAt).toLocaleString() : 'not synced'} / {backendStation.autonomousRunControlSyncCount || 0} pulls
      </div>
      <div data-testid="backend-runtime-autonomy-status-sync" className="font-mono text-[8px] uppercase tracking-widest text-[#9b875c] mt-1">
        Runtime autonomy sync: {backendStation.lastRuntimeAutonomyStatusSyncAt ? new Date(backendStation.lastRuntimeAutonomyStatusSyncAt).toLocaleString() : 'not synced'} / {backendStation.runtimeAutonomyStatusSyncCount || 0} pulls
      </div>
      {backendStation.lastAction && (
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] mt-1">{backendStation.lastAction}</div>
      )}
    </>
  );
}
