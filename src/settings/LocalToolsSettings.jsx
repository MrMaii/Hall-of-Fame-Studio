import { BellDot, Database, Globe2, PlugZap, RefreshCw, Server, WalletCards } from 'lucide-react';

const toolText = {
  'provider:test': ['连接检查', '在开始工作前检查模型和调查资料搜索是否可用。'],
  'model:kickoff': ['立项会议使用模型', '允许团队在立项会议中使用已配置的模型。'],
  'model:intent': ['会议意图分析', '允许模型帮助识别会议中的决定、问题和下一步。'],
  'model:artifact-draft': ['工作成果草稿', '允许团队使用模型生成待复核的成果草稿。'],
  'search:evidence': ['调查资料搜索', '允许团队使用已配置的搜索服务收集资料。'],
};

export default function LocalToolsSettings({
  project = null,
  toolOptions = [],
  activeToolIds = new Set(),
  toolPolicy = {},
  toolSaving = false,
  canWrite = false,
  onToolChange,
  budget = {},
  budgetSaving = false,
  onBudgetChange,
  onRefresh,
  refreshing = false,
  integrationCapabilities = null,
  integrationReadiness = null,
  readinessSourceClass = 'border-[#b9a55f] text-[#75631d]',
  readinessSourceStatus = 'backend-required',
  readinessSourceDetail = 'Sync integration readiness before trusting integration status',
  onReadinessSync,
  readinessSyncDisabled = false,
  onProjectSettingsSync,
  projectSyncDisabled = false,
} = {}) {
  const disabled = !project || !canWrite;
  const projectId = project?.id || '';
  const capabilityRows = Array.isArray(integrationCapabilities?.rows) ? integrationCapabilities.rows : [];
  const capabilitySummary = integrationCapabilities?.summary || {};
  const readinessRows = Array.isArray(integrationReadiness?.rows) ? integrationReadiness.rows : [];
  const capabilityById = (id) => capabilityRows.find(row => row.id === id) || null;
  const integrationRouteStatusFallback = integrationCapabilities ? 'contract-row-missing' : 'sync-required';
  const toolGrantCapability = capabilityById('agent-tool-grant-policy');
  const proxyWebhookCapability = capabilityById('proxy-webhook');
  const mcpToolsCapability = capabilityById('mcp-tools');
  const vectorStoreCapability = capabilityById('vector-store');
  const budgetAlertCapability = capabilityById('budget-alerts');
  const errorReportingCapability = capabilityById('error-reporting');
  const routeFor = (suffix) => projectId ? `/projects/${projectId}/${suffix}` : `/projects/:id/${suffix}`;
  const fieldClass = 'mt-2 w-full border border-[#b8b4a8] bg-white px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50';
  const smallButtonClass = 'border border-[#1a1a1a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#f5f4f0] transition-colors hover:bg-[#3a3429] disabled:cursor-not-allowed disabled:opacity-40';
  const boundaryCards = [
    { id: 'browser-tools', icon: Globe2, capability: toolGrantCapability, label: 'Agent tool grant policy', detail: 'project settings', routeTestId: 'settings-agent-tool-grant-policy-route', route: routeFor('project-settings') },
    { id: 'proxy-webhook', icon: PlugZap, capability: proxyWebhookCapability, label: 'Proxy and webhook', detail: 'adapter preflight', routeTestId: 'settings-proxy-webhook-preflight-route', route: routeFor('adapter-gateway-preflight') },
    { id: 'mcp-tools', icon: Server, capability: mcpToolsCapability, label: 'MCP tools', detail: 'provider readiness', routeTestId: 'settings-mcp-tools-readiness-route', route: routeFor('provider-readiness') },
    { id: 'vector', icon: Database, capability: vectorStoreCapability, label: 'Evidence index / vector store', detail: 'local index route', routeTestId: 'settings-evidence-index-readiness-route', route: routeFor('evidence-index-readiness') },
    { id: 'budget', icon: WalletCards, capability: budgetAlertCapability, label: 'Budget alerts', detail: 'local headroom route', routeTestId: 'settings-budget-alert-readiness-route', route: routeFor('budget-alert-readiness') },
    { id: 'error-reporting', icon: BellDot, capability: errorReportingCapability, label: 'Error reporting', detail: 'local error route', routeTestId: 'settings-error-reporting-readiness-route', route: routeFor('error-reporting-readiness') },
  ];

  return (
    <div className="space-y-5" data-testid="settings-integrations-runtime-boundary">
      <div className="space-y-5" data-testid="settings-local-tools-simple">
        <section className="border border-[#d1d0c9] bg-[#f5f4f0] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="font-mono text-xs tracking-[0.18em] text-[#8f1e18]">扩展工具</div>
              <h3 className="mt-2 font-serif text-3xl leading-tight text-[#1a1a1a]">控制团队可以使用的能力</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#5f5a50]">工具权限按项目保存。关闭某项能力后，该项目的团队不会调用对应模型或搜索服务。</p>
            </div>
            <button type="button" onClick={onRefresh} disabled={refreshing || !project} className={smallButtonClass}>
              <RefreshCw size={14} className="mr-2 inline" />刷新工具状态
            </button>
          </div>
          {!project && <div className="mt-4 border border-[#b9a55f] bg-[#fbf7df] p-3 text-sm text-[#75631d]">请先创建或选择项目，再修改工具权限和使用限制。</div>}
        </section>

        <section data-testid="settings-tool-grant-policy" className="space-y-3">
          <div className="grid gap-3">
            {toolOptions.map(option => {
              const [label, detail] = toolText[option.id] || [option.label, option.detail];
              return (
                <label key={option.id} data-testid={`settings-tool-grant-${option.id.replace(':', '-')}`} className="flex items-start gap-3 border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                  <input type="checkbox" checked={activeToolIds.has(option.id)} disabled={disabled || toolSaving} onChange={event => onToolChange?.(option.id, event.currentTarget.checked)} className="mt-1 h-4 w-4 accent-[#1a1a1a]" />
                  <span><strong className="block font-medium text-[#1a1a1a]">{label}</strong><span className="mt-1 block text-sm leading-relaxed text-[#5f5a50]">{detail}</span></span>
                </label>
              );
            })}
          </div>
          <div data-testid="settings-tool-grant-summary" className="text-sm text-[#5f5a50]">Default grants: {activeToolIds.size}/{toolOptions.length}</div>
        </section>

        <section data-testid="settings-provider-budget-policy" className="border border-[#d1d0c9] bg-[#f8f6ee] p-5">
          <div className="flex items-center gap-2"><PlugZap size={18} /><h4 className="font-serif text-2xl">使用限制</h4></div>
          <p className="mt-2 text-sm leading-relaxed text-[#5f5a50]">用于限制外部模型和搜索服务的调用量。本机自身运行不计入这些限制。</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-[#4f4b43]">每日费用上限
              <select data-testid="settings-provider-budget-daily" className={fieldClass} value={String(budget.dailyBudgetCents || 0)} disabled={disabled || budgetSaving} onChange={event => onBudgetChange?.({ dailyBudgetCents: Number(event.currentTarget.value) || 0 })}>
                <option value="0">不限制</option>
                <option value="100">每天最多 1 美元</option>
                <option value="500">每天最多 5 美元</option>
                <option value="2000">每天最多 20 美元</option>
              </select>
            </label>
            <label className="text-sm text-[#4f4b43]">每小时调用次数
              <select data-testid="settings-provider-budget-hourly" className={fieldClass} value={String(budget.maxRequestsPerProjectHour || 0)} disabled={disabled || budgetSaving} onChange={event => onBudgetChange?.({ maxRequestsPerProjectHour: Number(event.currentTarget.value) || 0 })}>
                <option value="0">不限制</option>
                <option value="20">每小时 20 次</option>
                <option value="60">每小时 60 次</option>
                <option value="120">每小时 120 次</option>
              </select>
            </label>
          </div>
          <div data-testid="settings-provider-budget-summary" className="mt-4 text-sm text-[#5f5a50]">
            Budget: {budget.dailyBudgetCents ? `${budget.dailyBudgetCents} cents/day` : 'unlimited local'} · Hourly requests: {budget.maxRequestsPerProjectHour || 'unlimited local'}
          </div>
        </section>
      </div>

      <details data-testid="settings-tools-technical-details" className="border border-[#d1d0c9] bg-[#f5f4f0]">
        <summary className="cursor-pointer px-5 py-3 font-mono text-xs tracking-[0.12em]">查看技术诊断信息</summary>
        <div className="space-y-5 border-t border-[#d1d0c9] p-4">
          <section className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">Backend integration boundary</div>
            <div className="mt-2 font-serif text-xl text-[#1a1a1a]">External tools are backend-governed.</div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">Agent tool grants and provider budget are project settings with backend receipts. Managed integrations remain read-only until their backend controls are ready.</p>
            <div data-testid="settings-integration-capabilities-summary" className="mt-4 grid gap-2 font-mono text-[11px] text-[#5f5a50] sm:grid-cols-3">
              <div>Contract: {integrationCapabilities?.schemaVersion || 'not synced'}</div>
              <div>Backend-backed: {capabilitySummary.backendBackedCount ?? 0}</div>
              <div>Route sync: {integrationCapabilities ? `${capabilitySummary.backendRequiredCount ?? 0} backend route-backed row(s)` : 'contract not synced'}</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={onReadinessSync} disabled={readinessSyncDisabled} className={smallButtonClass}>同步工具就绪状态</button>
              <div data-testid="settings-integration-readiness-summary" className="font-mono text-[10px] leading-relaxed text-[#5f5a50]">
                {integrationReadiness ? `${integrationReadiness.status} / ${integrationReadiness.summary?.routeReadyCount || 0}/${integrationReadiness.summary?.rowCount || 0} routes ready` : 'settings-integration-readiness not synced'}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span data-testid="settings-integration-readiness-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${readinessSourceClass}`}>{readinessSourceStatus}</span>
              <span data-testid="settings-integration-readiness-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">{readinessSourceDetail}</span>
            </div>
            <div data-testid="settings-integration-readiness-route" className="mt-2 break-all font-mono text-[10px] leading-relaxed text-[#7d786b]">Route: {routeFor('settings-integration-readiness')}</div>
          </section>

          {readinessRows.length > 0 && (
            <section data-testid="settings-integration-readiness-contract" className="grid gap-3 lg:grid-cols-2">
              {readinessRows.map(row => (
                <div key={row.id} data-testid={`settings-integration-readiness-row-${row.id}`} className="border border-[#d1d0c9] bg-[#f5f4f0] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">{row.category || 'integration'}</div><div className="mt-1 font-mono text-xs text-[#1a1a1a]">{row.label}</div></div>
                    <span className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${row.currentReady ? 'border-[#59684b] text-[#3f5136]' : row.routeReady ? 'border-[#b9a55f] text-[#75631d]' : 'border-red-800 text-red-800'}`}>{row.currentReady ? 'ready' : row.routeReady ? 'action required' : 'route missing'}</span>
                  </div>
                  <div className="mt-3 space-y-1 font-mono text-[10px] leading-relaxed text-[#7d786b]"><div>Status: {row.currentStatus}</div><div>Route: {row.requiredBackendRoute}</div><div>Schema: {row.readinessSchemaVersion || 'not synced'}</div><div>Checksum: {row.readinessChecksum || 'not synced'}</div><div>Production blocker: {row.productionBlocker}</div></div>
                </div>
              ))}
            </section>
          )}

          <section data-testid="settings-integration-capability-contract" className="grid gap-3 lg:grid-cols-2">
            {capabilityRows.length ? capabilityRows.map(row => (
              <div key={row.id} data-testid={`settings-integration-capability-${row.id}`} className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                <div className="flex items-start justify-between gap-4"><div><div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">{row.category || 'integration'}</div><div className="mt-1 font-mono text-xs text-[#1a1a1a]">{row.label}</div></div><span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${row.status === 'backend-backed' ? 'border-[#59684b] text-[#3f5136]' : 'border-[#b9a55f] text-[#75631d]'}`}>{row.status}</span></div>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">{row.detail}</p>
                <div className="mt-3 space-y-1 font-mono text-[10px] leading-relaxed text-[#7d786b]"><div>Route: {row.requiredBackendRoute}</div><div>Editable: {row.editable ? 'yes' : 'no'}</div><div>Production blocker: {row.productionBlocker}</div></div>
              </div>
            )) : (
              <div data-testid="settings-integration-capabilities-missing" className="border border-[#b9a55f] bg-[#fbf7df] p-4 font-mono text-[11px] leading-relaxed text-[#75631d] lg:col-span-2">
                <div>Integration capability contract not synced. Sync project settings before treating integration controls as backend-backed.</div>
                <button type="button" data-testid="settings-integration-capabilities-sync-project-state" onClick={onProjectSettingsSync} disabled={projectSyncDisabled} className={`${smallButtonClass} mt-3`}>同步项目设置</button>
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boundaryCards.map(({ id, icon: Icon, capability, label, detail, routeTestId, route }) => (
              <div key={id} data-testid={`settings-integration-${id}-boundary`} className="border border-[#d1d0c9] bg-[#f5f4f0] p-4">
                <Icon size={18} className="mb-3" />
                <div className="font-mono text-xs">{capability?.label || label}</div>
                <div className="mt-1 font-mono text-[10px] text-[#7d786b]">{capability?.status || integrationRouteStatusFallback} / {detail}</div>
                <div data-testid={routeTestId} className="mt-2 break-all font-mono text-[9px] leading-relaxed text-[#5f5a50]">{capability?.requiredBackendRoute || route}</div>
              </div>
            ))}
          </section>

          <section data-testid="settings-integrations-route-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
            <div>Agent overrides: {Object.keys(toolPolicy.agentToolGrants || {}).length}</div>
            <div>Policy route: {routeFor('project-settings')}</div>
            <div>Provider readiness: {routeFor('provider-readiness')}</div>
            <div>Controlled run: {routeFor('provider-controlled-run')}</div>
            <div>Search/provider status: /search/status</div>
            <div>Secret vault status: /secret-vault/status</div>
            <div>Production: {toolPolicy.readyForProduction || budget.readyForProduction ? 'ready' : 'blocked'}</div>
            <div>Production integrations stay blocked until managed provider policy, operations controls, and launch gates pass.</div>
          </section>
        </div>
      </details>
    </div>
  );
}
