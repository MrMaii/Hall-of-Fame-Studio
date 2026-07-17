export default function ProjectDashboardPublicProductionStartupReadiness({
  fallbackRoute,
  projectText,
  readiness,
  summary,
}) {
  return (
    <div data-testid="backend-public-production-startup-readiness-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      {summary}
      {readiness.managedIdentityStartup && (
        <div data-testid="backend-managed-identity-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Managed Identity Startup')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.managedIdentityStartup.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.managedIdentityStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.managedIdentityStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Provider Config'), readiness.managedIdentityStartup.providerConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Service Identity'), readiness.managedIdentityStartup.serviceIdentityConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Evidence'), readiness.managedIdentityStartup.evidenceReady ? projectText('ready') : projectText('missing')],
              [projectText('Signature'), readiness.managedIdentityStartup.attestationSignatureReady ? projectText('ready') : projectText('missing')],
              [projectText('Prototype Signed'), readiness.managedIdentityStartup.signedAccessOnly ? projectText('only') : projectText('no')],
              [projectText('Configured Env'), readiness.managedIdentityStartup.configuredEnvVars?.length ?? 0],
              [projectText('Route'), readiness.managedIdentityStartup.apiPath || '/public-production-startup-readiness'],
              [projectText('Check'), readiness.managedIdentityStartup.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`managed-identity-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.managedIdentityStartup.detail || readiness.managedIdentityStartup.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.productionCostControlStartup && (
        <div data-testid="backend-production-cost-control-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Cost Control Startup')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.productionCostControlStartup.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionCostControlStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.productionCostControlStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Budget Policy'), readiness.productionCostControlStartup.budgetPolicyConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Usage Audit'), readiness.productionCostControlStartup.usageAuditConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Cost Alerts'), readiness.productionCostControlStartup.alertRoutingConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Evidence'), readiness.productionCostControlStartup.evidenceReady ? projectText('ready') : projectText('missing')],
              [projectText('Signature'), readiness.productionCostControlStartup.attestationSignatureReady ? projectText('ready') : projectText('missing')],
              [projectText('Configured Env'), readiness.productionCostControlStartup.configuredEnvVars?.length ?? 0],
              [projectText('Route'), readiness.productionCostControlStartup.apiPath || '/public-production-startup-readiness'],
              [projectText('Check'), readiness.productionCostControlStartup.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`production-cost-control-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.productionCostControlStartup.detail || readiness.productionCostControlStartup.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.productionDataGovernanceStartup && (
        <div data-testid="backend-production-data-governance-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Data Governance Startup')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.productionDataGovernanceStartup.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionDataGovernanceStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.productionDataGovernanceStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Retention'), readiness.productionDataGovernanceStartup.retentionPolicyConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Deletion Job'), readiness.productionDataGovernanceStartup.deletionJobConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Export Storage'), readiness.productionDataGovernanceStartup.exportStorageConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Evidence'), readiness.productionDataGovernanceStartup.evidenceReady ? projectText('ready') : projectText('missing')],
              [projectText('Signature'), readiness.productionDataGovernanceStartup.attestationSignatureReady ? projectText('ready') : projectText('missing')],
              [projectText('Configured Env'), readiness.productionDataGovernanceStartup.configuredEnvVars?.length ?? 0],
              [projectText('Route'), readiness.productionDataGovernanceStartup.apiPath || '/public-production-startup-readiness'],
              [projectText('Check'), readiness.productionDataGovernanceStartup.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`production-data-governance-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.productionDataGovernanceStartup.detail || readiness.productionDataGovernanceStartup.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.productionTrafficStartup && (
        <div data-testid="backend-production-traffic-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Traffic Startup')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.productionTrafficStartup.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionTrafficStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.productionTrafficStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Domain/TLS'), readiness.productionTrafficStartup.domainTlsConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Traffic Gateway'), readiness.productionTrafficStartup.trafficGatewayConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Release Approval'), readiness.productionTrafficStartup.releaseApprovalConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Rollback'), readiness.productionTrafficStartup.rollbackConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Evidence'), readiness.productionTrafficStartup.evidenceReady ? projectText('ready') : projectText('missing')],
              [projectText('Signature'), readiness.productionTrafficStartup.attestationSignatureReady ? projectText('ready') : projectText('missing')],
              [projectText('Configured Env'), readiness.productionTrafficStartup.configuredEnvVars?.length ?? 0],
              [projectText('Check'), readiness.productionTrafficStartup.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`production-traffic-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.productionTrafficStartup.detail || readiness.productionTrafficStartup.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.productionCustomerAcceptanceStartup && (
        <div data-testid="backend-production-customer-acceptance-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Customer Acceptance Startup')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.productionCustomerAcceptanceStartup.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionCustomerAcceptanceStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.productionCustomerAcceptanceStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Policy'), readiness.productionCustomerAcceptanceStartup.policyConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Success Criteria'), readiness.productionCustomerAcceptanceStartup.successCriteriaConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Threshold'), readiness.productionCustomerAcceptanceStartup.thresholdConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Approval'), readiness.productionCustomerAcceptanceStartup.approvalConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Rollback Criteria'), readiness.productionCustomerAcceptanceStartup.rollbackCriteriaConfigured ? projectText('configured') : projectText('missing')],
              [projectText('Evidence'), readiness.productionCustomerAcceptanceStartup.evidenceReady ? projectText('ready') : projectText('missing')],
              [projectText('Signature'), readiness.productionCustomerAcceptanceStartup.attestationSignatureReady ? projectText('ready') : projectText('missing')],
              [projectText('Check'), readiness.productionCustomerAcceptanceStartup.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`production-customer-acceptance-startup-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.productionCustomerAcceptanceStartup.detail || readiness.productionCustomerAcceptanceStartup.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.managedSecretManager && (
        <div data-testid="backend-managed-secret-manager-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Managed Secret Manager Readiness')}</div>
              <div className="font-serif text-sm leading-tight break-words">
                {projectText(readiness.managedSecretManager.status || 'blocked')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.managedSecretManager.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.managedSecretManager.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              [projectText('Provider'), readiness.managedSecretManager.provider || 'none'],
              [projectText('Provider Proof'), readiness.managedSecretManager.providerReady ? projectText('ready') : projectText('blocked')],
              [projectText('Config'), readiness.managedSecretManager.configurationReady ? projectText('configured') : projectText('missing')],
              [projectText('Attestation'), readiness.managedSecretManager.attestationReady ? projectText('matched') : projectText('missing')],
              [projectText('Raw Secret'), readiness.managedSecretManager.rawExposureBlocked ? projectText('blocked') : projectText('clear')],
              [projectText('Configured Env'), readiness.managedSecretManager.configuredEnvVars?.length ?? 0],
              [projectText('Route'), readiness.managedSecretManager.apiPath || '/secret-vault/status'],
              [projectText('Check'), readiness.managedSecretManager.validationCommand || 'npm run agents:public-production-startup-readiness'],
            ].map(([label, value]) => (
              <div key={`managed-secret-manager-readiness-${label}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                <div className="font-serif text-sm leading-tight break-words">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
            {projectText(readiness.managedSecretManager.detail || readiness.managedSecretManager.productionRequirement || '')}
          </div>
        </div>
      )}
      {readiness.managedInfrastructureCutover && (
        <div data-testid="backend-managed-infrastructure-cutover-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Managed Infrastructure Cutover')}</div>
              <div className="font-serif text-sm leading-tight">
                {readiness.managedInfrastructureCutover.summary?.readyRowCount ?? 0}/{readiness.managedInfrastructureCutover.summary?.rowCount ?? 0} {projectText('domains ready')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.managedInfrastructureCutover.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.managedInfrastructureCutover.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {(readiness.managedInfrastructureCutover.rows || []).map((row) => (
              <div data-testid={`backend-managed-infrastructure-cutover-row-${row.id}`} key={`managed-infrastructure-cutover-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight truncate">{projectText(row.label || row.id)}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                    {row.driver || 'unknown'} / {row.configurationReady ? projectText('configured') : projectText('missing config')} / {row.requireRealAdapter ? projectText('real adapter required') : projectText('real adapter not required')} / {row.cutoverReady ? projectText('cutover proof ready') : projectText('cutover proof missing')}
                  </div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                    {row.validationCommand || row.apiPath || projectText(row.detail || '')}
                  </div>
                </div>
                <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                  {row.ready ? projectText('ready') : projectText(row.status || 'blocked')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {readiness.productionOperationsStartup && (
        <div data-testid="backend-production-operations-startup-readiness" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Operations Startup')}</div>
              <div className="font-serif text-sm leading-tight">
                {readiness.productionOperationsStartup.summary?.readyRowCount ?? 0}/{readiness.productionOperationsStartup.summary?.rowCount ?? 0} {projectText('controls ready')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionOperationsStartup.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {readiness.productionOperationsStartup.ready ? projectText('ready') : projectText('blocked')}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {(readiness.productionOperationsStartup.rows || []).map((row) => (
              <div data-testid={`backend-production-operations-startup-row-${row.id}`} key={`production-operations-startup-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight truncate">{projectText(row.label || row.id)}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                    {row.configurationReady ? projectText('configured') : projectText('missing config')} / {row.evidenceReady ? projectText('evidence ready') : projectText('evidence missing')} / {row.attestationSignatureReady ? projectText('signature ready') : projectText('signature missing')}
                  </div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                    {row.validationCommand || row.apiPath || projectText(row.detail || '')}
                  </div>
                </div>
                <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                  {row.ready ? projectText('ready') : projectText(row.status || 'blocked')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2 space-y-1">
        {(readiness.failedGates?.length ? readiness.failedGates : readiness.gates || []).slice(0, 5).map(row => (
          <div key={`public-production-startup-readiness-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{projectText(row.label || row.id)}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.detail || row.status || '')}</div>
              {(row.apiPath || row.envVars?.length) && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                  {row.apiPath ? `Route: ${row.apiPath}` : `Env: ${row.envVars.slice(0, 2).join(', ')}`}
                </div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : projectText(row.status || 'blocked')}</span>
          </div>
        ))}
      </div>
      {readiness.productionEnvironmentSetup?.rows?.length > 0 && (
        <div data-testid="backend-production-environment-setup-matrix" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Environment Setup')}</div>
              <div className="font-serif text-sm leading-tight">
                {readiness.productionEnvironmentSetup.summary?.readyRowCount ?? 0}/{readiness.productionEnvironmentSetup.summary?.rowCount ?? 0} {projectText('setup domains ready')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.productionEnvironmentSetup.readyForPublicProduction ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
              {readiness.productionEnvironmentSetup.readyForPublicProduction ? projectText('public ready') : projectText('setup blocked')}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {readiness.productionEnvironmentSetup.rows.slice(0, 6).map((row) => {
              const missingRequired = row.missingRequiredEnvVars || [];
              const missingAnyOfGroups = row.missingAnyOfEnvVarGroups || [];
              const missingEnvLabel = missingRequired.length
                ? missingRequired.slice(0, 3).join(', ')
                : missingAnyOfGroups.length
                  ? missingAnyOfGroups[0].slice(0, 3).join(' | ')
                  : (row.configuredEnvVars || []).slice(0, 3).join(', ') || row.apiPath || 'no env gaps';
              return (
                <div data-testid={`backend-production-environment-setup-row-${row.id}`} key={`production-environment-setup-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-serif text-sm leading-tight">{projectText(row.label || row.id)}</span>
                      <span className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(row.domain || 'production')}</span>
                    </div>
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                      {projectText('Missing')}: {missingEnvLabel}
                    </div>
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                      {row.validationCommand || row.apiPath || projectText(row.nextAction || '')}
                    </div>
                  </div>
                  <span className={`node-status-tag ${row.ready ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                    {row.ready ? projectText('ready') : projectText(row.status || 'blocked')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {readiness.publicProductionActionPlan?.actions?.length > 0 && (
        <div data-testid="backend-public-production-action-plan" className="mt-2 border border-[#d8c99f] bg-[#f7edcf] p-2">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Public Production Action Plan')}</div>
              <div className="font-serif text-sm leading-tight">
                {readiness.publicProductionActionPlan.actionCount ?? readiness.publicProductionActionPlan.actions.length} {projectText('blocked action(s)')}
              </div>
            </div>
            <span className={`node-status-tag ${readiness.publicProductionActionPlan.readyForPublicProduction ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
              {readiness.publicProductionActionPlan.readyForPublicProduction ? projectText('public ready') : projectText('no-go')}
            </span>
          </div>
          {readiness.publicProductionActionPlan.validationCommands?.length > 0 && (
            <div data-testid="backend-public-production-action-plan-validation-commands" className="mt-2 border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Validation commands')}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {readiness.publicProductionActionPlan.validationCommands.slice(0, 8).map((command) => (
                  <span key={`public-production-action-plan-command-${command}`} className="border border-[#d8c99f] bg-[#f7edcf] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-widest text-[#5f513a]">
                    {command}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 space-y-1">
            {readiness.publicProductionActionPlan.actions.slice(0, 6).map((action) => {
              const requiredEnvVars = action.requiredEnvVars || [];
              const visibleRequiredEnvVars = requiredEnvVars.slice(0, 6);
              const requiredEnvLabel = visibleRequiredEnvVars.length
                ? `${visibleRequiredEnvVars.join(', ')}${requiredEnvVars.length > visibleRequiredEnvVars.length ? ` +${requiredEnvVars.length - visibleRequiredEnvVars.length} more` : ''}`
                : 'none listed';
              return (
                <div data-testid={`backend-public-production-action-plan-row-${action.id}`} key={`public-production-action-plan-${action.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-serif text-sm leading-tight">{projectText(action.label || action.id)}</span>
                      <span className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(action.domain || 'production')}</span>
                    </div>
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
                      {projectText('Next')}: {projectText(action.nextAction || 'Complete production evidence')}
                    </div>
                    <div data-testid={`backend-public-production-action-plan-required-env-${action.id}`} className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] break-words">
                      {projectText('Required')}: {requiredEnvLabel}
                    </div>
                    <div data-testid={`backend-public-production-action-plan-route-${action.id}`} className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] break-words">
                      {projectText('Route')}: {action.apiPath || '/public-production-startup-readiness'}
                    </div>
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] break-words">
                      {projectText('Check')}: {action.validationCommand || projectText(action.source || '')}
                    </div>
                  </div>
                  <span className={`node-status-tag ${action.status === 'ready' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
                    {projectText(action.status || 'blocked')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        {projectText('Public startup route')}: {readiness.backendRoutes?.publicProductionStartupReadiness || fallbackRoute || '/public-production-startup-readiness'}
      </div>
    </div>

  );
}
