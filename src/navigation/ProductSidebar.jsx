import { Grid, LayoutPanelLeft, Network, Plus, Settings, UserCircle } from 'lucide-react';
import { projectCatalogPresentation, projectCatalogRowState } from '../project/projectCatalogRecovery.js';

export default function ProductSidebar({
  collapsed,
  onToggle,
  activeRoute,
  onDashboard,
  onMarket,
  projects,
  projectCatalogStatus = 'idle',
  onCreateProject,
  onProject,
  selectedProjectId,
  onSettings,
  directorName,
  directorHandle,
  logoSrc,
  t,
  activeLanguage,
}) {
  const projectRouteActive = !['dashboard', 'agent_market', 'agent_dossier', 'project_initiation'].includes(activeRoute);
  const catalogPresentation = projectCatalogPresentation({
    syncStatus: projectCatalogStatus,
    projectCount: projects.length,
    language: activeLanguage,
  });

  return (
    <div className={`h-screen shrink-0 border-r border-[#d1d0c9] bg-[#ebe9e0] flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-16' : 'w-16 md:w-64'}`}>
      <div className={`h-16 flex items-center px-4 border-b border-[#d1d0c9] ${collapsed ? 'justify-center' : 'justify-center md:justify-between'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <img src={logoSrc} alt="Hall of Fame Studio logo" className={`h-8 w-8 object-contain shrink-0 ${collapsed ? 'hidden' : 'hidden md:block'}`} />
          {!collapsed && (
            <span className="hidden min-w-0 md:block">
              <span className="block font-serif text-lg font-bold tracking-tight leading-none">Hall of Fame</span>
              <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-gray-500 mt-1">{t('nav.hallOfFameSubtitle')}</span>
            </span>
          )}
        </div>
        <button type="button" onClick={onToggle} className="p-1 hover:bg-[#d1d0c9] rounded transition-colors text-gray-600 hover:text-black"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'} title={collapsed ? '展开侧边栏' : '收起侧边栏'}>
          <LayoutPanelLeft size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
        <div className="px-3 flex flex-col gap-1">
          <button type="button" onClick={onDashboard} className={`flex items-center gap-3 px-3 py-2 text-sm font-mono rounded-sm transition-colors ${activeRoute === 'dashboard' ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'hover:bg-[#d1d0c9] text-gray-700'}`}>
            <Grid size={16} /> {!collapsed && <span className="hidden md:inline">{t('nav.workspaceHub')}</span>}
          </button>
          <button type="button" onClick={onMarket} className={`flex items-center gap-3 px-3 py-2 text-sm font-mono rounded-sm transition-colors ${activeRoute === 'agent_market' || activeRoute === 'agent_dossier' ? 'bg-[#1a1a1a] text-[#f5f4f0]' : 'hover:bg-[#d1d0c9] text-gray-700'}`}>
            <Network size={16} /> {!collapsed && <span className="hidden md:inline">{t('nav.talentMarket')}</span>}
          </button>
        </div>

        {!collapsed && (
          <div className="hidden px-6 md:flex md:flex-col md:gap-2">
            <div className="flex items-center justify-between text-gray-600 font-mono text-xs tracking-widest mb-2">
              <span>{t('nav.activeProjects')}</span>
              <button type="button" onClick={onCreateProject} className="hover:text-black" title="创建项目" aria-label="创建项目"><Plus size={12}/></button>
            </div>
            {['checking', 'offline'].includes(catalogPresentation.state) && (
              <div data-testid="sidebar-project-catalog-status" role="status" className="font-mono text-[10px] tracking-wide text-[#75631d]">
                {catalogPresentation.label}
              </div>
            )}
            {projects.map((project) => {
              const rowState = projectCatalogRowState(project, projectCatalogStatus);
              const recovered = rowState !== 'verified';
              return (
                <button type="button" key={project.id} data-testid={`project-nav-${project.id}`} onClick={() => onProject(project.id)} disabled={recovered}
                  className={`flex items-center gap-2 text-left font-serif text-lg transition-colors group disabled:cursor-wait ${selectedProjectId === project.id && projectRouteActive ? 'text-black font-semibold' : 'text-gray-500 hover:text-black'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${recovered ? 'bg-amber-500' : project.status === 'executing' || project.status === 'initiated' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {recovered && <span className="shrink-0 font-mono text-[9px]">{rowState === 'offline' ? '离线' : '校验中'}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#d1d0c9]">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-center gap-3 md:justify-start'}`}>
          {!collapsed && (
            <div data-testid="sidebar-identity" className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
              <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center border border-[#1a1a1a] bg-[#1a1a1a] font-serif text-lg text-[#f5f4f0]">{activeLanguage === 'zh' ? '总' : 'D'}</div>
              <div className="min-w-0 flex-1">
                <span className="block truncate font-serif text-base leading-none text-[#1a1a1a]">{directorName}</span>
                <span className="mt-1 flex items-center gap-1.5 font-mono text-xs tracking-[0.12em] text-green-700"><UserCircle size={13} />{directorHandle}</span>
              </div>
            </div>
          )}
          <button type="button" data-testid="open-settings-button" onClick={onSettings} className="shrink-0 p-2 text-gray-600 transition-colors hover:bg-[#d1d0c9] hover:text-black" aria-label={activeLanguage === 'zh' ? '打开设置' : 'Open settings'} title={activeLanguage === 'zh' ? '设置' : 'Settings'}><Settings size={16} /></button>
        </div>
      </div>
    </div>
  );
}
