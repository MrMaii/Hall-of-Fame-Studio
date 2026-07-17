export default function ProjectDashboardDeploymentPreflight({
  gatewayPreflight,
  preflight,
  projectId,
  readyPackage,
}) {
  return (
    <div data-testid="backend-deployment-preflight-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Deployment Preflight</div>
          <div className="font-serif text-base leading-tight">{preflight.status || 'unknown'} / production blocked</div>
        </div>
        <span className={`node-status-tag ${preflight.privatePilotDeploymentReady ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
          Pilot Env {preflight.privatePilotDeploymentReady ? 'Ready' : 'Blocked'}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Gates', `${preflight.summary?.passedGateCount ?? 0}/${preflight.summary?.gateCount ?? 0}`],
          ['Blockers', preflight.summary?.failedBlockerGateCount ?? 0],
          ['Warnings', preflight.summary?.failedWarningGateCount ?? 0],
          ['Prod Controls', `${preflight.summary?.productionControlReadyCount ?? 0}/${preflight.summary?.productionControlCount ?? 0}`],
          ['Scheduler', preflight.backendRuntime?.schedulerEnabled ? 'auto' : 'manual'],
          ['Agent Mode', preflight.backendRuntime?.schedulerAgentControls?.useAgentAutonomousStrategy ? 'strategy' : 'manual'],
          ['Agent Artifacts', preflight.backendRuntime?.schedulerAgentControls?.submitAgentWorkArtifacts ? (preflight.backendRuntime?.schedulerAgentControls?.workArtifactType || 'auto') : 'off'],
          ['Agent Revisions', preflight.backendRuntime?.schedulerAgentControls?.respondToReviewObligations ? 'on' : 'off'],
          ['Store', preflight.backendRuntime?.storePath ? 'file' : 'memory'],
          ['DB Adapter', preflight.adapters?.managedPersistence?.driver || 'unknown'],
          ['Queue Adapter', preflight.adapters?.workerQueue?.driver || 'unknown'],
          ['Gateway', preflight.adapters?.gateway?.preflight?.status || gatewayPreflight?.status || 'unknown'],
          ['Gateway Live', (preflight.adapters?.gateway?.preflight?.liveGatewayReady ?? gatewayPreflight?.summary?.liveGatewayReady) ? 'ready' : 'pending'],
          ['Gateway State', (preflight.adapters?.gateway?.preflight?.stateReadable ?? gatewayPreflight?.summary?.stateReadable) ? 'readable' : 'pending'],
          ['Packet', preflight.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`deployment-preflight-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(preflight.failedGates?.length ? preflight.failedGates : preflight.gates || []).slice(0, 3).map(row => (
          <div key={`deployment-preflight-gap-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.passed ? 'ready' : row.severity || 'watch'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Preflight route: {readyPackage.backendRoutes?.deploymentPreflight || `/projects/${projectId}/deployment-preflight`}
        {' '} / Gateway route: {readyPackage.backendRoutes?.adapterGatewayPreflight || preflight.backendRoutes?.adapterGatewayPreflight || `/projects/${projectId}/adapter-gateway-preflight`}
      </div>
    </div>
  );
}
