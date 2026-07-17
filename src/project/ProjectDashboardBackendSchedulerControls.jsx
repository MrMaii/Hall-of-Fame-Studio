export default function ProjectDashboardBackendSchedulerControls({
  Activity,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  GitCommit,
  PackageCheck,
  Play,
  Save,
  Search,
  Server,
  StopCircle,
  immediateStartVisible,
  onCheck,
  onSeed,
  onServerPulse,
  onStart,
  onStop,
  onSyncActionQueue,
  onSyncAgentQueue,
  onSyncCockpit,
  onSyncCommandCenter,
  onSyncIntentQueue,
  onSyncManagerView,
  onSyncProofModels,
  onSyncProjects,
  onSyncProtocolAudit,
  onSyncReadyPackage,
  onSyncRequirementMatrix,
  onSyncScenarioTrail,
  onSyncScenarioWalkthrough,
  onSyncState,
  onSyncTimeline,
  onSyncUseCaseAudit,
  schedulerControlDisabled,
  seedDisabled,
  workerSyncDisabled,
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onCheck}
        disabled={schedulerControlDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Search size={13} /> Check
      </button>
      <button
        type="button"
        onClick={onStart}
        disabled={schedulerControlDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-50"
      >
        <Play size={13} /> Start
      </button>
      {immediateStartVisible && (
        <span className="inline-flex items-center justify-center border border-[#59684b] bg-[#1f2b1d] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#dff0cf]">
          IMMEDIATE START: YES
        </span>
      )}
      <button
        type="button"
        onClick={onStop}
        disabled={schedulerControlDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <StopCircle size={13} /> Stop
      </button>
      <button
        type="button"
        onClick={onSyncState}
        disabled={schedulerControlDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Database size={13} /> Sync State
      </button>
      <button
        type="button"
        data-testid="backend-save-project"
        onClick={onSeed}
        disabled={seedDisabled}
        title="Sample/dev snapshot seed only; real projects save through backend receipt routes."
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Save size={13} /> Seed Sample/Dev
      </button>
      <button
        type="button"
        data-testid="backend-sync-project-catalog-detail"
        onClick={onSyncProjects}
        disabled={schedulerControlDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Server size={13} /> Sync Projects
      </button>
      <button
        type="button"
        data-testid="backend-sync-manager-view"
        onClick={onSyncManagerView}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Database size={13} /> Sync Manager View
      </button>
      <button
        type="button"
        data-testid="backend-sync-ready-package"
        onClick={onSyncReadyPackage}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <PackageCheck size={13} /> Sync Package
      </button>
      <button
        type="button"
        data-testid="backend-sync-proof-models"
        onClick={onSyncProofModels}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <FileText size={13} /> Sync Proof Models
      </button>
      <button
        type="button"
        data-testid="backend-sync-command-center"
        onClick={onSyncCommandCenter}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Activity size={13} /> Sync Command
      </button>
      <button
        type="button"
        data-testid="backend-sync-scenario-walkthrough"
        onClick={onSyncScenarioWalkthrough}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <GitCommit size={13} /> Sync Walkthrough
      </button>
      <button
        type="button"
        data-testid="backend-sync-scenario-trail"
        onClick={onSyncScenarioTrail}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <GitCommit size={13} /> Sync Trail
      </button>
      <button
        type="button"
        data-testid="backend-sync-requirement-matrix"
        onClick={onSyncRequirementMatrix}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <CheckCircle2 size={13} /> Sync Matrix
      </button>
      <button
        type="button"
        data-testid="backend-sync-sync-protocol-audit"
        onClick={onSyncProtocolAudit}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <GitCommit size={13} /> Sync Protocol
      </button>
      <button
        type="button"
        data-testid="backend-sync-use-case-audit"
        onClick={onSyncUseCaseAudit}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <ClipboardList size={13} /> Sync Audit
      </button>
      <button
        type="button"
        data-testid="backend-sync-cockpit-models"
        onClick={onSyncCockpit}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <Database size={13} /> Sync Cockpit
      </button>
      <button
        type="button"
        data-testid="backend-sync-action-queue"
        onClick={onSyncActionQueue}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <ClipboardList size={13} /> Sync Queue
      </button>
      <button
        type="button"
        data-testid="backend-sync-agent-autonomous-action-queue"
        onClick={onSyncAgentQueue}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <ClipboardList size={13} /> Sync Agent Queue
      </button>
      <button
        type="button"
        data-testid="backend-sync-collaboration-intent-queue"
        onClick={onSyncIntentQueue}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <ClipboardList size={13} /> Sync Intent Queue
      </button>
      <button
        type="button"
        data-testid="backend-sync-timeline-events"
        onClick={onSyncTimeline}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#efe2bd] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-50"
      >
        <GitCommit size={13} /> Sync Timeline
      </button>
      <button
        type="button"
        onClick={onServerPulse}
        disabled={workerSyncDisabled}
        className="inline-flex items-center justify-center gap-2 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-50"
      >
        <Server size={13} /> Server Pulse
      </button>
    </div>
  );
}
