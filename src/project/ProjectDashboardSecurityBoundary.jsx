import React from 'react';

export default function ProjectDashboardSecurityBoundary({ view = {} }) {
  const {
    activeProject,
    backendManagerReadyPackage = {},
    backendSecurityBoundary = {},
    managerReadModelSourceBadge,
  } = view;

  return (
    <div data-testid="backend-security-boundary-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Security Boundary</div>
          <div className="font-serif text-base leading-tight">{backendSecurityBoundary.status || 'unknown'} / {backendSecurityBoundary.production?.status || 'production-blocked'}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {managerReadModelSourceBadge(backendSecurityBoundary, 'backend-security-boundary-source')}
          <span className={`node-status-tag ${backendSecurityBoundary.readyForLocalPilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {backendSecurityBoundary.readyForLocalPilot ? 'Local Safe' : 'Needs Attention'}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Routes', backendSecurityBoundary.routeSummary?.count ?? 0],
          ['Sensitive Sets', backendSecurityBoundary.summary?.sensitiveCollectionCount ?? 0],
          ['Access Policy', backendSecurityBoundary.accessControl?.status || 'unknown'],
          ['Audit Rows', backendSecurityBoundary.accessAudit?.count ?? 0],
          ['Audit Stream', backendSecurityBoundary.accessAudit?.stream?.count ?? 0],
          ['Audit Chain', backendSecurityBoundary.accessAudit?.stream?.hashChainReady ? 'ready' : 'blocked'],
          ['Identity Sessions', backendSecurityBoundary.summary?.identitySessionActiveCount ?? backendManagerReadyPackage.summary?.identitySessionActiveCount ?? 0],
          ['Session Rows', backendSecurityBoundary.summary?.identitySessionCount ?? backendManagerReadyPackage.summary?.identitySessionCount ?? 0],
          ['Secret Vault', backendSecurityBoundary.summary?.secretVaultReady ? 'ready' : 'blocked'],
          ['Vault Records', backendSecurityBoundary.summary?.secretVaultEncryptedRecordCount ?? 0],
          ['Vault Rotation', backendSecurityBoundary.summary?.secretVaultRotationReady ? 'ready' : 'blocked'],
          ['Denied', backendSecurityBoundary.accessAudit?.deniedCount ?? 0],
          ['Raw Leaks', backendSecurityBoundary.redactionScan?.rawLeakCount ?? 0],
          ['Security Blockers', backendSecurityBoundary.production?.blockerCount ?? 0],
        ].map(([label, value]) => (
          <div key={`security-boundary-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        Security route: {backendManagerReadyPackage.backendRoutes?.securityBoundary || `/projects/${activeProject.id}/security-boundary`}
        {' '} / Identity route: {backendManagerReadyPackage.backendRoutes?.identitySessions || `/projects/${activeProject.id}/identity-sessions`}
      </div>
    </div>
  );
}
