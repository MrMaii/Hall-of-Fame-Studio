export default function ProjectDashboardLaunchOperationsOverview({
  blockerRows,
  nextAction,
  nextStepRows,
  nextStepRun,
  onRunNextStep,
  overviewRows,
  privateMvpLaunchPackage,
  privatePilotAccepted,
  privatePilotStatus,
  projectText,
  publicProductionReady,
  routes,
  runDisabled,
  sourceBadge,
}) {
  return (
    <div data-testid="backend-launch-operations-overview" className="mb-3 border border-[#7b6542] bg-[#f7edcf] p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Launch Operations Overview')}</div>
          <div className="font-serif text-lg leading-tight">
            {privatePilotAccepted ? projectText('Private pilot accepted') : projectText('Private pilot action required')} / {publicProductionReady ? projectText('public production ready') : projectText('public production no-go')}
          </div>
          <div data-testid="backend-launch-operations-next-action" className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] break-words">
            Next: {nextAction?.action || nextAction?.label || nextAction?.id || 'none'} / Route: {nextAction?.apiPath || nextAction?.route || routes[0] || 'none'}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          <span data-testid="backend-launch-operations-private-pilot-status" className={`node-status-tag ${privatePilotAccepted ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {projectText(privatePilotStatus)}
          </span>
          <span data-testid="backend-launch-operations-public-production-status" className={`node-status-tag ${publicProductionReady ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>
            {publicProductionReady ? projectText('public ready') : projectText('public no-go')}
          </span>
        </div>
      </div>
      {privateMvpLaunchPackage && (
        <div data-testid="backend-private-mvp-launch-package" className="mt-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText('Private MVP Launch Package')}</div>
              <div data-testid="backend-private-mvp-launch-package-status" className="font-serif text-sm leading-tight break-words">
                {projectText(privateMvpLaunchPackage.status || 'backend required')}
              </div>
              <div data-testid="backend-private-mvp-launch-package-commands" className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
                {privateMvpLaunchPackage.packageCommand || 'package command missing'} / {privateMvpLaunchPackage.validationCommand || 'validation command missing'}
              </div>
            </div>
            <span data-testid="backend-private-mvp-launch-package-boundary" className={`node-status-tag ${privateMvpLaunchPackage.readyForControlledPrivateMvp ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
              {privateMvpLaunchPackage.readyForControlledPrivateMvp ? projectText('private MVP only') : projectText('review required')}
            </span>
          </div>
        </div>
      )}
      {nextStepRows.length > 0 && (
        <div data-testid="backend-public-production-next-steps" className="mt-2 space-y-1">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{projectText('Public Production Next Steps')}</div>
          {nextStepRows.map((row, index) => (
            <div key={`public-production-next-step-${row.id || index}`} data-testid={`backend-public-production-next-step-${index + 1}`} className="border border-[#d8c99f] bg-[#fff8df] px-2 py-1">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-sm leading-tight break-words">{projectText(row.label || row.id || `Public production step ${index + 1}`)}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] break-words">
                    Owner: {projectText(row.owner || 'manager')} / Validate: {row.validationCommand || 'npm run launch:public-production:no-go'}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-[#5f5138] break-words">{projectText(row.whyBlocked || row.action || 'Public production evidence is still required.')}</div>
                  <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#9b875c] break-words">
                    Action: {projectText(row.action || 'Attach managed-production evidence.')} / Route: {row.apiPath || row.route || 'route pending'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 md:items-end">
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{projectText(row.status || 'blocked')}</span>
                  <button
                    type="button"
                    data-testid={`backend-public-production-next-step-run-${index + 1}`}
                    onClick={() => onRunNextStep(row)}
                    disabled={runDisabled}
                    className="px-2 py-1 border border-[#7b6542] bg-[#f7edcf] font-mono text-[7px] uppercase tracking-widest text-[#251b13] disabled:opacity-50"
                  >
                    {projectText('Record')}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {nextStepRun && (
            <div data-testid="backend-public-production-next-step-receipt" className={`border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${nextStepRun.status === 'failed' ? 'border-red-800 bg-red-50 text-[#8f1e18]' : 'border-[#d8c99f] bg-[#efe2bd]/70 text-[#6b5a3d]'}`}>
              {nextStepRun.status === 'failed'
                ? `Action failed: ${nextStepRun.error || 'No local receipt was created.'}`
                : `Receipt: ${nextStepRun.stepLabel || nextStepRun.stepId || 'public-production next step'} / ${nextStepRun.status || 'recorded'} / ${nextStepRun.runApiPath || 'run route pending'}`}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {overviewRows.map((row) => (
          <div key={`launch-operations-overview-${row.id || row.label}`} className="border border-[#d8c99f] bg-[#efe2bd]/70 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(row.label)}</div>
            <div className="font-serif text-sm leading-tight break-words">{projectText(String(row.value ?? 'missing'))}</div>
          </div>
        ))}
      </div>
      <div data-testid="backend-launch-operations-routes" className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] break-words">
        Routes: {routes.filter(Boolean).join(' / ')}
      </div>
      {blockerRows.length > 0 && (
        <div data-testid="backend-launch-operations-blockers" className="mt-2 space-y-1">
          {blockerRows.map((row, index) => (
            <div key={`launch-operations-blocker-${row.id || index}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#efe2bd]/60 px-2 py-1">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">{projectText(row.label || row.id || `Production blocker ${index + 1}`)}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{projectText(row.action || row.detail || row.status || 'production evidence required')}</div>
              </div>
              <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{projectText(row.status || 'blocked')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
