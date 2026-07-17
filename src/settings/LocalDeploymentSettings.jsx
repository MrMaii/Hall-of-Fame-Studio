import { RefreshCw } from 'lucide-react';

export default function LocalDeploymentSettings({
  labelClass = '',
  SmallButton,
  backendUrlConfigured = false,
  backendConfiguredTargetLabel = '',
  backendStation = {},
  onBackendUrlDraftChange,
  onSaveBackendUrl,
  onSyncRuntime,
  providerRuntimeStatus = {},
  settingsRuntimeReadiness = null,
  settingsRuntimeRows = [],
  settingsRuntimeReadinessSourceClass = '',
  settingsRuntimeReadinessSourceStatus = '',
  settingsRuntimeReadinessSourceDetail = '',
  healthStatusClass = {},
  activeProject = null,
  settingsProviderVaultBindings = null,
} = {}) {
  const runtimeRows = settingsRuntimeRows.length ? settingsRuntimeRows : [
    {
      id: 'runtime-not-synced',
      label: 'Runtime readiness',
      status: 'idle',
      detail: backendUrlConfigured
        ? 'Click Sync runtime to read the backend contract.'
        : 'Save Backend URL in Deployment before runtime readiness sync.',
      route: activeProject?.id ? `/projects/${activeProject.id}/settings-runtime-readiness` : '/settings/runtime-readiness',
    },
  ];
  const routeRows = [
    ['Model status', '/llm/status', providerRuntimeStatus.modelProvider?.enabled && providerRuntimeStatus.modelProvider?.configured],
    ['Evidence status', '/search/status', providerRuntimeStatus.searchProvider?.enabled && providerRuntimeStatus.searchProvider?.configured],
    ['Provider vault bindings', '/provider-vault-bindings', settingsProviderVaultBindings?.summary?.boundProviderCount > 0],
    ['Provider readiness', activeProject?.id ? `/projects/${activeProject.id}/provider-readiness` : '/projects/:id/provider-readiness', Boolean(providerRuntimeStatus.modelProvider?.enabled && providerRuntimeStatus.searchProvider?.enabled)],
  ];

  return (
    <div data-testid="settings-local-deployment">
      <div className="space-y-6" data-testid="settings-deployment-runtime-boundary">
        <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className={labelClass}>Backend Runtime Target</div>
              <h3 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">Deployment is owned by the worker station</h3>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                This screen reflects the configured backend runtime. Deployment mode, provider endpoints, concurrency, retry, and scheduler controls must come from backend env, adapter gateway, or managed infrastructure receipts.
              </p>
            </div>
            <SmallButton data-testid="settings-local-auth-sync-runtime" onClick={onSyncRuntime} disabled={providerRuntimeStatus.running || !backendUrlConfigured}>
              <RefreshCw size={12} className="mr-2 inline-block" />Sync runtime
            </SmallButton>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className={labelClass}>Backend URL</div>
              <div data-testid="settings-deployment-backend-url" className="mt-2 break-all font-mono text-xs text-[#1a1a1a]">{backendConfiguredTargetLabel}</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  data-testid="settings-deployment-backend-url-input"
                  value={backendStation.draftBaseUrl || ''}
                  onChange={(event) => onBackendUrlDraftChange?.(event.target.value)}
                  className="min-w-0 flex-1 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                  aria-label="Settings backend API URL"
                />
                <button
                  type="button"
                  data-testid="settings-deployment-save-backend-url"
                  onClick={onSaveBackendUrl}
                  disabled={backendStation.loading}
                  className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${backendStation.loading ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                >
                  Save URL
                </button>
              </div>
            </div>
            <div className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className={labelClass}>Worker Route</div>
              <div className="mt-2 break-all font-mono text-xs text-[#1a1a1a]">/workers/autonomous/status</div>
            </div>
          </div>
        </div>

        <div data-testid="settings-runtime-readiness-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={labelClass}>/settings/runtime-readiness</div>
              <div className="mt-2 font-serif text-xl leading-tight">Backend-owned runtime readiness</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span data-testid="settings-runtime-readiness-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${settingsRuntimeReadinessSourceClass}`}>
                  {settingsRuntimeReadinessSourceStatus}
                </span>
                <span data-testid="settings-runtime-readiness-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">
                  {settingsRuntimeReadinessSourceDetail}
                </span>
              </div>
            </div>
            <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
              settingsRuntimeReadiness?.readyForLocalMvpRuntime ? healthStatusClass.pass : settingsRuntimeReadiness ? healthStatusClass.pending : healthStatusClass.idle
            }`}>
              {settingsRuntimeReadiness?.status || 'not synced'}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {runtimeRows.map(row => (
              <div key={row.id} data-testid={`settings-runtime-readiness-row-${row.id}`} className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1a1a1a]">{row.label}</div>
                  <span className={`border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] ${healthStatusClass[row.status] || healthStatusClass.idle}`}>
                    {row.status || 'idle'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#5f5a50]">{row.detail}</p>
                <div className="mt-2 break-all font-mono text-[9px] text-[#7d786b]">{row.route}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 break-all font-mono text-[10px] leading-relaxed text-[#7d786b]">
            Validation: {(settingsRuntimeReadiness?.validationCommands || ['npm run agents:settings-runtime-readiness']).join(' / ')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {routeRows.map(([label, route, ready]) => (
            <div key={label} data-testid={`settings-deployment-route-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
              <div className={labelClass}>{label}</div>
              <div className="mt-2 break-all font-mono text-[11px] text-[#1a1a1a]">{route}</div>
              <div className={`mt-3 inline-flex border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${ready ? healthStatusClass.pass : healthStatusClass.idle}`}>
                {ready ? 'backend ready' : 'sync required'}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-[#d1d0c9] bg-[#f5f4f0] p-4 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
          Production rule: the browser cannot switch deployment environments or provider endpoints. Public production deployment still requires managed persistence, durable queue/cron, signed access, centralized audit, provider/BYOK controls, and launch-governance receipts.
        </div>
      </div>
    </div>
  );
}
