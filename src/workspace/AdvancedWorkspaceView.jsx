const AdvancedWorkspaceView = ({ view }) => {
  const {
    Activity,
    Box,
    ChevronRight,
    ClipboardList,
    Cpu,
    DoorOpen,
    INITIATION_CONSENSUS,
    MessageSquare,
    Plus,
    RefreshCw,
    Server,
    Settings,
    activeLanguage,
    backendStation,
    backendUrlConfigured,
    launchManagerDemoProject,
    localMvpStartupReadiness,
    navToInitiation,
    navToProject,
    openWorkspaceStartInitiation,
    portfolioSourceMeta,
    projects,
    providerRuntimeStatus,
    sampleFixtureMeta,
    setSettingsOpen,
    setSettingsTab,
    setWorkspaceAdvancedOpen,
    settingsTabForStartupReadiness,
    startupNextActionLabel,
    startupReadyForFirstRun,
    startupReadyForProviderSetup,
    startupStatus,
    startupStatusClass,
    syncBackendProjectCatalog,
    syncSettingsProviderRuntime,
    workspaceActiveProjectCount,
    workspaceActiveProjectSourceMeta,
    workspaceBackendCatalogRequiredDetail,
    workspaceBackendCatalogSummary,
    workspaceBackendCatalogSyncLabel,
    workspaceBackendProjectCount,
    workspaceBackendProjectSourceMeta,
    workspaceOpenTaskCount,
    workspaceOpenTaskSourceMeta,
    workspacePortfolioCatalogRequired,
    workspaceStoredMessageCount,
    workspaceStoredMessageSourceMeta,
  } = view;

  return (
      <div className="flex-1 p-12 overflow-y-auto fade-in bg-[#fdfdfc]">
        <header className="mb-10 flex flex-col items-start justify-between gap-8 xl:flex-row">
          <div>
            <h1 className="font-serif text-5xl mb-3 tracking-tight">{activeLanguage === 'zh' ? '项目与工作进展' : 'System Overview.'}</h1>
            <p className="font-mono text-xs text-gray-500 tracking-widest">{activeLanguage === 'zh' ? '本地项目、团队和当前工作' : 'Global Dashboard & Resource Allocation'}</p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <button type="button" onClick={() => setWorkspaceAdvancedOpen(false)} className="border border-[#251b13] bg-white px-4 py-3 text-sm hover:bg-[#efe2bd]">
              {activeLanguage === 'zh' ? '返回简洁工作区' : 'Back to simple workspace'}
            </button>
            <button
              data-testid="start-initiation-button"
              onClick={openWorkspaceStartInitiation}
              className="group bg-[#1a1a1a] text-[#f5f4f0] border border-[#1a1a1a] px-5 py-4 flex items-center gap-4 shadow-[8px_8px_0_rgba(143,30,24,0.18)] hover:shadow-[4px_4px_0_rgba(143,30,24,0.28)] hover:-translate-y-0.5 transition-all"
            >
              <span className="w-9 h-9 border border-[#f5f4f0]/30 flex items-center justify-center group-hover:border-[#f5f4f0] transition-colors">
                <Plus size={18} />
              </span>
              <span className="text-left">
                <span className="block font-serif text-xl leading-none">{activeLanguage === 'zh' ? '创建项目' : 'Start Initiation'}</span>
                <span data-testid="start-initiation-backend-state" className="block font-mono text-[9px] tracking-widest text-[#bcae86] mt-1">
                  {activeLanguage === 'zh'
                    ? (startupReadyForFirstRun ? '已经可以开始' : backendUrlConfigured ? '开始前需要完成设置' : '请先设置本地服务')
                    : (startupReadyForFirstRun ? 'Backend ready for first run' : backendUrlConfigured ? 'Setup required before kickoff' : 'Set backend URL before kickoff')}
                </span>
              </span>
            </button>
            <details data-testid="manager-demo-tools" className="border border-[#d1d0c9] bg-white px-4 py-3">
              <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-[#5f5a50]">{activeLanguage === 'zh' ? '示例数据与产品检查' : 'Sample data and product checks'}</summary>
              <button
                data-testid="run-manager-demo-button"
                onClick={launchManagerDemoProject}
                className="group mt-3 border border-[#8f1e18] bg-[#efe2bd] text-[#251b13] px-5 py-4 flex items-center gap-4 transition-colors hover:bg-[#f7edcf]"
              >
                <span className="w-9 h-9 border border-[#8f1e18]/30 flex items-center justify-center group-hover:border-[#8f1e18] transition-colors">
                  <Activity size={18} />
                </span>
                <span className="text-left">
                  <span className="block font-serif text-xl leading-none">{activeLanguage === 'zh' ? '载入经理演示数据' : 'Load Sample Fixture'}</span>
                  <span className="block font-mono text-[9px] tracking-widest text-[#8f1e18] mt-1">{activeLanguage === 'zh' ? '仅用于检查，不是真实项目' : 'Manager demo data'}</span>
                </span>
              </button>
            </details>
          </div>
        </header>
  
        <section data-testid="workspace-local-mvp-startup-readiness" className="mb-10 border border-[#d1d0c9] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d786b]">/local-mvp-startup-readiness</div>
              <h2 className="mt-2 font-serif text-2xl leading-none text-[#1a1a1a]">Backend readiness before initiation</h2>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span data-testid="workspace-local-mvp-startup-status" className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${startupStatusClass}`}>
                {startupStatus}
              </span>
              <button
                type="button"
                data-testid="workspace-sync-local-mvp-startup"
                onClick={() => syncSettingsProviderRuntime({ runTests: false })}
                disabled={providerRuntimeStatus.running || !backendUrlConfigured}
                className="inline-flex items-center justify-center gap-2 border border-[#251b13] bg-[#efe2bd] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:bg-[#251b13] hover:text-[#efe2bd] disabled:opacity-50"
              >
                <RefreshCw size={13} /> Sync startup
              </button>
              {!startupReadyForFirstRun && (
                <button
                  type="button"
                  data-testid="workspace-open-startup-settings"
                  onClick={() => { setSettingsTab(settingsTabForStartupReadiness(localMvpStartupReadiness)); setSettingsOpen(true); }}
                  className="inline-flex items-center justify-center gap-2 border border-[#8f1e18] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] hover:bg-[#8f1e18] hover:text-white"
                >
                  <Settings size={13} /> Settings
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-3 font-mono text-[11px] text-[#5f5a50] md:grid-cols-4">
            <div data-testid="workspace-local-mvp-settings-entry" className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">Settings entry</div>
              <div className="mt-1 text-[#1a1a1a]">{localMvpStartupReadiness?.readyForSettingsEntry ? 'ready' : localMvpStartupReadiness ? 'blocked' : 'not synced'}</div>
            </div>
            <div data-testid="workspace-local-mvp-provider-setup" className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">Provider setup</div>
              <div className="mt-1 text-[#1a1a1a]">{startupReadyForProviderSetup ? 'ready' : localMvpStartupReadiness ? 'blocked' : 'not synced'}</div>
            </div>
            <div data-testid="workspace-local-mvp-first-run" className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">First project run</div>
              <div className="mt-1 text-[#1a1a1a]">{startupReadyForFirstRun ? 'ready' : localMvpStartupReadiness ? 'blocked' : 'not synced'}</div>
            </div>
            <div data-testid="workspace-local-mvp-next-action" className="border border-[#d1d0c9] bg-[#f8f6ee] p-3">
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#7d786b]">Next action</div>
              <div className="mt-1 line-clamp-2 text-[#1a1a1a]">{startupNextActionLabel}</div>
            </div>
          </div>
          <div data-testid="workspace-local-mvp-startup-route" className="mt-3 break-all font-mono text-[10px] uppercase tracking-[0.14em] text-[#7d786b]">
            Route: {localMvpStartupReadiness?.backendRoutes?.localMvpStartupReadiness || '/local-mvp-startup-readiness'}
          </div>
        </section>
  
        {false && (
          <>
        <section className="mb-10 border border-[#251b13] bg-[#171411] text-[#efe2bd] overflow-hidden">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-6">
                <DoorOpen size={16} className="text-[#8f1e18]" />
                Initiation Pipeline
              </div>
              <h2 className="font-serif text-4xl leading-tight mb-4">Enter a project name, invite participants, then run a required kickoff roundtable.</h2>
              <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
                New projects now pass through a real kickoff workflow before they enter the dashboard.
              </p>
            </div>
            <div className="border-l border-[#3a2a1c] p-6 bg-[#0f0d0b]">
              <div className="grid grid-cols-2 gap-3 h-full">
                {[
                  { label: 'Step 01', value: 'Enter project brief' },
                  { label: 'Step 02', value: 'Invite participants' },
                  { label: 'Step 03', value: 'Start kickoff meeting' },
                  { label: 'Step 04', value: 'Create after approval' },
                ].map(item => (
                  <div key={item.label} className="border border-[#3a2a1c] p-4 bg-[#1a130e]">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                    <div className="font-serif text-lg leading-tight">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
  
        <section className="hidden mb-10 border border-[#251b13] bg-[#171411] text-[#efe2bd] overflow-hidden">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
            <div className="p-8">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.28em] text-[#bcae86] mb-6">
                <DoorOpen size={16} className="text-[#8f1e18]" />
                Project Birth Protocol
              </div>
              <h2 className="font-serif text-4xl leading-tight mb-4">Projects are approved through the roundtable, not spawned from a form.</h2>
              <p className="font-serif text-xl leading-relaxed text-[#d8c99f] max-w-3xl">
                The owner explains the goal, the team discusses leadership and execution, and approval creates the project.
              </p>
            </div>
            <div className="border-l border-[#3a2a1c] p-6 bg-[#0f0d0b]">
              <div className="grid grid-cols-2 gap-3 h-full">
                {INITIATION_CONSENSUS.slice(1).map(item => (
                  <div key={item.label} className="border border-[#3a2a1c] p-4 bg-[#1a130e]">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
                    <div className="font-serif text-lg leading-tight">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
          </>
        )}
  
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {[
            { icon: Cpu, label: 'Active Projects', val: workspaceActiveProjectCount },
            { icon: Server, label: 'Backend Projects', val: workspaceBackendProjectCount },
            { icon: ClipboardList, label: 'Open Tasks', val: workspaceOpenTaskCount },
            { icon: MessageSquare, label: 'Stored Messages', val: workspaceStoredMessageCount }
          ].map((stat, i) => {
            const statId = stat.label.toLowerCase().replace(/\s+/g, '-');
            const statSourceMeta = stat.label === 'Open Tasks'
              ? workspaceOpenTaskSourceMeta
              : stat.label === 'Active Projects'
                ? workspaceActiveProjectSourceMeta
              : stat.label === 'Backend Projects'
                ? workspaceBackendProjectSourceMeta
              : stat.label === 'Stored Messages'
                ? workspaceStoredMessageSourceMeta
                : null;
            return (
            <div key={i} className="border border-[#d1d0c9] bg-white p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-6 text-gray-500">
                <span className="font-mono text-xs uppercase tracking-widest">{stat.label}</span>
                <stat.icon size={16} />
              </div>
              <span className="font-serif text-4xl">{stat.val}</span>
              {statSourceMeta && (
                <div className="mt-4 flex flex-col gap-1">
                  <span
                    data-testid={`workspace-stat-source-${statId}`}
                    className={`w-fit border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${statSourceMeta.className}`}
                  >
                    {statSourceMeta.label}
                  </span>
                  <span
                    data-testid={`workspace-stat-source-detail-${statId}`}
                    className="font-mono text-[9px] uppercase tracking-widest text-gray-500"
                  >
                    {statSourceMeta.detail}
                  </span>
                </div>
              )}
            </div>
            );
          })}
        </div>
  
        <div className="border border-[#d1d0c9] bg-white p-8 shadow-sm">
           <div className="mb-6 flex items-center justify-between gap-4">
             <div>
               <h2 className="font-serif text-2xl">Active Portfolios</h2>
               <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-gray-500">
                 {workspaceBackendCatalogSummary}
               </p>
             </div>
              <button
                type="button"
                data-testid="backend-sync-project-catalog"
                onClick={() => syncBackendProjectCatalog({ silent: false })}
                disabled={backendStation.loading || !backendUrlConfigured}
                title={backendUrlConfigured ? 'Sync /projects from the configured backend.' : 'Save Backend URL in Settings Deployment before syncing backend projects.'}
                className="inline-flex items-center justify-center gap-2 border border-[#251b13] bg-[#efe2bd] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:bg-[#251b13] hover:text-[#efe2bd] disabled:opacity-50"
              >
                <Server size={14} /> {workspaceBackendCatalogSyncLabel}
              </button>
           </div>
           <div className="flex flex-col gap-4">
             {workspacePortfolioCatalogRequired && (
               <div data-testid="workspace-portfolio-catalog-required" className="border border-[#8f1e18] bg-[#f7e6df] p-6">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#8f1e18] mb-2">Backend catalog required</div>
                  <div className="font-serif text-2xl mb-2">Sync backend projects before trusting this portfolio list.</div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#5f5a50] mb-4">
                    {workspaceBackendCatalogRequiredDetail}
                  </p>
                  <button
                    type="button"
                    data-testid="workspace-portfolio-sync-catalog-required"
                    onClick={() => syncBackendProjectCatalog({ silent: false })}
                    disabled={backendStation.loading || !backendUrlConfigured}
                    title={backendUrlConfigured ? 'Sync /projects from the configured backend.' : 'Save Backend URL in Settings Deployment before syncing backend projects.'}
                    className="inline-flex items-center justify-center gap-2 border border-[#251b13] bg-[#efe2bd] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#251b13] hover:bg-[#251b13] hover:text-[#efe2bd] disabled:opacity-50"
                  >
                    <Server size={14} /> {workspaceBackendCatalogSyncLabel}
                  </button>
               </div>
             )}
             {!workspacePortfolioCatalogRequired && projects.length === 0 && (
               <div className="border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                 <div className="font-serif text-2xl mb-2">No projects yet</div>
                 <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500 mb-5">Create one through the real kickoff workflow.</p>
                 <button
                   onClick={navToInitiation}
                   className="bg-black text-white px-5 py-3 font-mono text-[10px] uppercase tracking-widest hover:bg-[#8f1e18] transition-colors"
                 >
                   New Project
                 </button>
               </div>
            )}
            {projects.map(proj => {
              const fixtureMeta = sampleFixtureMeta(proj);
              const sourceMeta = portfolioSourceMeta(proj, fixtureMeta);
              return (
               <button
                 type="button"
                 key={proj.id} 
                 aria-label={`打开项目：${proj.name}`}
                 onClick={() => navToProject(proj.id)}
                 className="w-full border border-gray-200 p-5 text-left hover:border-black transition-colors cursor-pointer group flex items-center justify-between"
               >
                 <div className="flex items-center gap-6">
                   <div className={`p-3 border ${proj.status === 'executing' || proj.status === 'initiated' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                     <Box size={20} className={proj.status === 'executing' || proj.status === 'initiated' ? 'text-green-700' : 'text-gray-500'} />
                   </div>
                   <div>
                     <h3 className="font-serif text-2xl mb-1 group-hover:underline">{proj.name}</h3>
                     <p className="font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                       ID: {proj.id} | {proj.team.length} Members | {proj.status}
                     </p>
                     <div className="mt-2 flex flex-wrap items-center gap-2">
                       <span
                         className={`border px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${sourceMeta.className}`}
                         data-testid={`project-source-${proj.id}`}
                       >
                         {sourceMeta.label}
                       </span>
                       <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500" data-testid={`project-source-detail-${proj.id}`}>
                         {sourceMeta.detail}
                       </span>
                     </div>
                     {fixtureMeta && (
                       <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#b9782b]" data-testid={`project-sample-fixture-${proj.id}`}>
                         Sample fixture only / not a real project path
                       </p>
                     )}
                     {proj.initiation && (
                       <p className="font-serif text-sm text-[#8f1e18] mt-1">
                         From initiation roundtable: {proj.initiation.firstLead} leads, {proj.initiation.reporter} reports.
                       </p>
                     )}
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono text-xs text-gray-500">{proj.progress}%</span>
                      <div className="w-32 h-1 bg-gray-100"><div className="h-full bg-black" style={{width: `${proj.progress}%`}}></div></div>
                      <span
                        className={`mt-1 border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${sourceMeta.className}`}
                        data-testid={`project-progress-source-${proj.id}`}
                      >
                        {sourceMeta.label}
                      </span>
                      <span
                        className="max-w-[180px] text-right font-mono text-[8px] uppercase tracking-widest text-gray-500"
                        data-testid={`project-progress-source-detail-${proj.id}`}
                      >
                        {sourceMeta.detail}
                      </span>
                    </div>
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-black transition-colors" />
                 </div>
               </button>
              );
             })}
           </div>
        </div>
      </div>
      );
};

export default AdvancedWorkspaceView;

