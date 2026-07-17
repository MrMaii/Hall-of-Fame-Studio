import React from 'react';

export default function ProjectDashboardManagerReadModelSnapshots({
  backendManagerDashboard,
  activeProjectId,
  backendManagerCommandCenter,
  backendManagerScenarioWalkthrough,
  backendManagerScenarioTrail,
  backendManagerRequirementMatrix,
  backendSyncProtocolAudit,
  backendManagerUseCaseAudit,
  managerReadModelSourceBadge,
  projectText,
}) {
  return (
    <>
      {backendManagerCommandCenter && (
        <div data-testid="backend-manager-command-center-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Manager Command Center</div>
            {managerReadModelSourceBadge(backendManagerCommandCenter, 'backend-manager-command-center-source')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['Status', backendManagerCommandCenter.status || 'unknown'],
              ['Attention', backendManagerCommandCenter.attentionCount ?? 0],
              ['Agents', backendManagerCommandCenter.agentRows?.length || 0],
              ['Next', backendManagerCommandCenter.nextBestActionLabel || backendManagerCommandCenter.nextBestAction?.label || 'monitor'],
            ].map(([label, value]) => (
              <div key={`command-center-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Command center route: {backendManagerDashboard?.backendRoutes?.managerCommandCenter || `/projects/${activeProjectId}/manager-command-center`}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Next run route: {backendManagerCommandCenter.nextBestAction?.runApiPath || backendManagerCommandCenter.nextBestActionRunApiPath || `/projects/${activeProjectId}/manager-command-center/run-next`}
          </div>
        </div>
      )}
      {backendManagerScenarioWalkthrough && (
        <div data-testid="backend-manager-scenario-walkthrough-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Manager Scenario Walkthrough</div>
            {managerReadModelSourceBadge(backendManagerScenarioWalkthrough, 'backend-manager-scenario-walkthrough-source')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['Status', backendManagerScenarioWalkthrough.status || 'unknown'],
              ['Complete', `${backendManagerScenarioWalkthrough.completedCount ?? 0}/${backendManagerScenarioWalkthrough.count ?? 0}`],
              ['Runnable', backendManagerScenarioWalkthrough.runnableCount ?? 0],
              ['Next Gap', backendManagerScenarioWalkthrough.nextIncompleteStep?.stage || 'all covered'],
            ].map(([label, value]) => (
              <div key={`scenario-walkthrough-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Walkthrough route: {backendManagerDashboard?.backendRoutes?.managerScenarioWalkthrough || `/projects/${activeProjectId}/manager-scenario-walkthrough`}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Next run route: {backendManagerScenarioWalkthrough.nextRunnableStep?.primaryAction?.runApiPath || backendManagerScenarioWalkthrough.rows?.find(row => row.primaryAction?.canRun)?.primaryAction?.runApiPath || `/projects/${activeProjectId}/manager-scenario-walkthrough/next/run`}
          </div>
        </div>
      )}
      {backendManagerScenarioTrail && (
        <div data-testid="backend-manager-scenario-trail-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Standalone Trail</div>
            {managerReadModelSourceBadge(backendManagerScenarioTrail, 'backend-manager-scenario-trail-source')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Ready Rows</div>
              <div className="font-serif text-base leading-tight">{backendManagerScenarioTrail.passedCount ?? 0}/{backendManagerScenarioTrail.count ?? 0}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Endpoint</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                {backendManagerDashboard?.backendRoutes?.managerScenarioTrail || `/projects/${activeProjectId}/manager-scenario-trail`}
              </div>
            </div>
          </div>
        </div>
      )}
      {backendManagerRequirementMatrix && (
        <div data-testid="backend-manager-requirement-matrix-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Manager Requirement Matrix</div>
            {managerReadModelSourceBadge(backendManagerRequirementMatrix, 'backend-manager-requirement-matrix-source')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Ready Rows</div>
              <div className="font-serif text-base leading-tight">{backendManagerRequirementMatrix.passedCount ?? 0}/{backendManagerRequirementMatrix.count ?? 0}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">Endpoint</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                {backendManagerDashboard?.backendRoutes?.managerRequirementMatrix || `/projects/${activeProjectId}/manager-requirement-matrix`}
              </div>
            </div>
          </div>
        </div>
      )}
      {backendSyncProtocolAudit && (
        <div data-testid="backend-sync-protocol-audit-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Sync Protocol Audit</div>
            {managerReadModelSourceBadge(backendSyncProtocolAudit, 'backend-sync-protocol-audit-source')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['Status', backendSyncProtocolAudit.status || 'unknown'],
              ['Complete', `${backendSyncProtocolAudit.passedCount ?? backendSyncProtocolAudit.completeCount ?? 0}/${backendSyncProtocolAudit.count ?? 0}`],
              ['Rows', backendSyncProtocolAudit.rows?.length || 0],
              ['Route', backendManagerDashboard?.backendRoutes?.syncProtocolAudit || `/projects/${activeProjectId}/sync-protocol-audit`],
            ].map(([label, value]) => (
              <div key={`sync-protocol-audit-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-base leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            C/A route: {backendManagerDashboard?.backendRoutes?.syncProtocolAudit || `/projects/${activeProjectId}/sync-protocol-audit`}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Latest protocol row: {backendSyncProtocolAudit.rows?.find(row => row.complete)?.label || backendSyncProtocolAudit.rows?.[0]?.label || 'none'}
          </div>
        </div>
      )}
      {backendManagerUseCaseAudit && (
        <div data-testid="backend-manager-use-case-audit-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Manager Use Case Audit</div>
            {managerReadModelSourceBadge(backendManagerUseCaseAudit, 'backend-manager-use-case-audit-source')}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['Status', backendManagerUseCaseAudit.status || 'unknown'],
              ['Covered', `${backendManagerUseCaseAudit.coveredCount ?? 0}/${backendManagerUseCaseAudit.count ?? 0}`],
              ['Partial', backendManagerUseCaseAudit.partialCount ?? 0],
              ['Missing', backendManagerUseCaseAudit.missingCount ?? 0],
            ].map(([label, value]) => (
              <div key={`use-case-audit-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-base leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Use case route: {backendManagerDashboard?.backendRoutes?.managerUseCaseAudit || `/projects/${activeProjectId}/manager-use-case-audit`}
          </div>
          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
            Latest stage: {backendManagerUseCaseAudit.rows?.[0]?.stage || 'none'}
          </div>
        </div>
      )}
    </>
  );
}
