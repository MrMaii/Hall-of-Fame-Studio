export default function ProjectDashboardProductionLaunchProofPanels({
  controlCenter,
  evidenceDossier,
  fallbackRoutes,
  gapRegister,
  integrityAudit,
  projectText,
  proofSyncButton,
  sourceBadge,
  sourceClass,
  sourceLabel,
}) {
  return (
    <>
  {gapRegister && (
    <div data-testid="backend-production-launch-gap-register-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Launch Gap Register')}</div>
          <div className="font-serif text-base leading-tight">{projectText(gapRegister.status || 'production-gaps-open')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          <span data-testid="backend-production-launch-gap-register-source" className={`node-status-tag ${sourceClass(gapRegister)}`}>
            {sourceLabel(gapRegister)}
          </span>
          {proofSyncButton(gapRegister, 'backend-production-launch-gap-register-sync-proof-models')}
          <span className="node-status-tag bg-[#8f1e18] text-white">
            {gapRegister.readyForProduction ? projectText('production ready') : projectText('production blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Open Gaps'), gapRegister.summary?.openGapCount ?? 0],
          [projectText('Blockers'), gapRegister.summary?.blockerCount ?? 0],
          [projectText('Domains'), gapRegister.summary?.domainCount ?? 0],
          [projectText('Owners'), gapRegister.summary?.ownerCount ?? 0],
          [projectText('Next Action'), gapRegister.nextAction?.id || 'none'],
          [projectText('Owner'), gapRegister.nextAction?.owner || 'manager'],
          [projectText('Private Pilot'), gapRegister.summary?.privatePilotAccepted ? projectText('accepted') : projectText('open')],
          [projectText('Production'), gapRegister.productionDecision || 'no-go'],
          [projectText('Security'), gapRegister.summary?.securityGapCount ?? 0],
          [projectText('Infra'), gapRegister.summary?.infrastructureGapCount ?? 0],
          [projectText('Ops'), gapRegister.summary?.operationsGapCount ?? 0],
          [projectText('Provider'), gapRegister.summary?.providerGapCount ?? 0],
          [projectText('Env Setup'), gapRegister.summary?.publicProductionEnvironmentSetupOpenCount ?? 0],
        ].map(([label, value]) => (
          <div key={`production-launch-gap-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(gapRegister.gapRows || []).slice(0, 5).map(row => (
          <div key={`production-launch-gap-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.owner || 'manager'} / {row.domain || 'production-hardening'}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">{row.action || row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
              {row.validationCommand && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Check: {row.validationCommand}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.status === 'ready' ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.status || 'blocked'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Gap register route')}: {gapRegister.backendRoutes?.productionLaunchGapRegister || fallbackRoutes.gapRegister}
      </div>
    </div>
  )}
  {controlCenter && (
    <div data-testid="backend-production-launch-control-center-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Launch Control Center')}</div>
          <div className="font-serif text-base leading-tight">{projectText(controlCenter.status || 'production-launch-controls-blocked')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          <span data-testid="backend-production-launch-control-center-source" className={`node-status-tag ${sourceClass(controlCenter)}`}>
            {sourceLabel(controlCenter)}
          </span>
          {proofSyncButton(controlCenter, 'backend-production-launch-control-center-sync-proof-models')}
          <span className="node-status-tag bg-[#8f1e18] text-white">
            {controlCenter.readyForProduction ? projectText('production ready') : projectText('no-go')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Controls'), controlCenter.summary?.controlCount ?? 0],
          [projectText('Ready'), controlCenter.summary?.readyControlCount ?? 0],
          [projectText('Blocked'), controlCenter.summary?.blockedControlCount ?? 0],
          [projectText('Owners'), controlCenter.summary?.ownerCount ?? 0],
          [projectText('Open Gaps'), controlCenter.summary?.openGapCount ?? 0],
          [projectText('Next Action'), controlCenter.nextAction?.id || 'none'],
          [projectText('Owner'), controlCenter.nextAction?.owner || 'manager'],
          [projectText('Decision'), controlCenter.productionDecision || 'no-go'],
        ].map(([label, value]) => (
          <div key={`production-launch-control-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(controlCenter.blockedRows?.length ? controlCenter.blockedRows : controlCenter.controlRows || []).slice(0, 5).map(row => (
          <div key={`production-launch-control-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.owner || 'manager'} / {row.domain || 'release-governance'}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">{row.detail || row.action || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.ready ? projectText('ready') : projectText('blocked')}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Control center route')}: {controlCenter.backendRoutes?.productionLaunchControlCenter || fallbackRoutes.controlCenter}
      </div>
    </div>
  )}
  {evidenceDossier && (
    <div data-testid="backend-production-launch-evidence-dossier-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Launch Evidence Dossier')}</div>
          <div className="font-serif text-base leading-tight">{projectText(evidenceDossier.status || 'production-evidence-dossier-building')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          <span data-testid="backend-production-launch-evidence-dossier-source" className={`node-status-tag ${sourceClass(evidenceDossier)}`}>
            {sourceLabel(evidenceDossier)}
          </span>
          {proofSyncButton(evidenceDossier, 'backend-production-launch-evidence-dossier-sync-proof-models')}
          <span className={`node-status-tag ${evidenceDossier.readyForProduction ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {evidenceDossier.readyForProduction ? projectText('production ready') : projectText('production no-go')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Manifest'), evidenceDossier.summary?.manifestEntryCount ?? evidenceDossier.manifest?.length ?? 0],
          [projectText('Domains'), evidenceDossier.summary?.controlDomainCount ?? evidenceDossier.controlDomainRows?.length ?? 0],
          [projectText('Ready Domains'), evidenceDossier.summary?.readyDomainCount ?? 0],
          [projectText('Managed Domains'), evidenceDossier.summary?.managedProductionDomainCount ?? 0],
          [projectText('Open Gaps'), evidenceDossier.summary?.openGapCount ?? evidenceDossier.openGapRows?.length ?? 0],
          [projectText('Proofs'), evidenceDossier.summary?.proofIdCount ?? evidenceDossier.proofIds?.length ?? 0],
          [projectText('Private Pilot'), evidenceDossier.readyForPrivatePilotDossier ? projectText('dossier ready') : projectText('building')],
          [projectText('Decision'), evidenceDossier.productionDecision || 'no-go'],
        ].map(([label, value]) => (
          <div key={`production-launch-evidence-dossier-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(evidenceDossier.controlDomainRows || []).slice(0, 4).map(row => (
          <div key={`production-launch-evidence-dossier-domain-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.owner || 'manager'} / {row.verifiedControlCount ?? 0}/{row.requiredControlCount ?? 0} verified</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">managed {row.managedProductionControlCount ?? 0} / local {row.localRehearsalControlCount ?? 0} / missing {row.missingEvidenceControlCount ?? row.missingControlCount ?? 0}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.readyForProduction ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
              {row.readyForProduction ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Dossier route')}: {evidenceDossier.backendRoutes?.productionLaunchEvidenceDossier || fallbackRoutes.evidenceDossier}
      </div>
    </div>
  )}
  {integrityAudit && (
    <div data-testid="backend-production-evidence-integrity-audit-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Evidence Integrity Audit')}</div>
          <div className="font-serif text-base leading-tight">{projectText(integrityAudit.status || 'managed-production-evidence-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge(integrityAudit, 'backend-production-evidence-integrity-audit-source')}
          {proofSyncButton(integrityAudit, 'backend-production-evidence-integrity-audit-sync-proof-models')}
          <span className={`node-status-tag ${integrityAudit.readyForManagedProductionEvidence ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {integrityAudit.readyForManagedProductionEvidence ? projectText('managed proof ready') : projectText('production proof needed')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Controls'), integrityAudit.summary?.requiredControlCount ?? 0],
          [projectText('Verified'), integrityAudit.summary?.verifiedControlCount ?? 0],
          [projectText('Managed Proof'), integrityAudit.summary?.managedProductionControlCount ?? 0],
          [projectText('Local Rehearsal'), integrityAudit.summary?.localRehearsalControlCount ?? 0],
          [projectText('External Unattested'), integrityAudit.summary?.externalUnattestedControlCount ?? 0],
          [projectText('Missing'), integrityAudit.summary?.missingControlCount ?? 0],
          [projectText('Domains'), integrityAudit.summary?.domainCount ?? 0],
          [projectText('Production'), integrityAudit.readyForProduction ? projectText('ready') : projectText('no-go')],
        ].map(([label, value]) => (
          <div key={`production-evidence-integrity-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(integrityAudit.domainRows || []).slice(0, 4).map(row => (
          <div key={`production-evidence-integrity-domain-${row.domain}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.domain || 'production'}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.owner || 'manager'} / {row.verifiedControlCount ?? 0}/{row.requiredControlCount ?? 0} verified</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">managed {row.managedProductionControlCount ?? 0} / local {row.localRehearsalControlCount ?? 0} / missing {row.missingControlCount ?? 0}</div>
            </div>
            <span className={`node-status-tag ${row.readyForManagedProductionEvidence ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
              {row.readyForManagedProductionEvidence ? projectText('managed') : projectText('blocked')}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Evidence integrity route')}: {integrityAudit.backendRoutes?.productionEvidenceIntegrityAudit || fallbackRoutes.integrityAudit}
      </div>
    </div>
  )}
    </>
  );
}
