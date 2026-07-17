import { ChevronRight, FolderKanban, Plus, Settings, Users } from 'lucide-react';

const STATUS_LABELS = { executing: '进行中', initiated: '准备中', paused: '已暂停', completed: '已完成' };

function projectSummary(project = {}) {
  return project.goal || project.description || project.initiation?.summary || '打开项目查看当前工作、团队进展和最新结果。';
}

export default function ProjectHub({ projects = [], modelReady = false, lastSyncedAt = null, onCreateProject, onOpenProject, onOpenSettings, onOpenAdvanced } = {}) {
  const activeCount = projects.filter((project) => ['executing', 'initiated'].includes(project.status)).length;
  const openTaskCount = projects.reduce((total, project) => total + (project.tasks || []).filter((task) => task.status !== 'done').length, 0);

  return (
    <div data-testid="project-hub" className="h-full overflow-y-auto bg-[#f5f4f0] px-4 py-6 text-[#1a1a1a] sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-6 border-b border-[#c9c5ba] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#8f1e18]">工作区</div>
            <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl md:text-6xl">项目与工作进展</h1>
            <p className="mt-4 font-serif text-lg text-[#5c574d]">查看正在进行的项目，进入会议，或创建一项新工作。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onCreateProject} className="inline-flex items-center justify-center gap-2 border border-[#251b13] bg-[#251b13] px-5 py-3 text-white hover:bg-[#8f1e18]"><Plus size={17} /> 创建项目</button>
            <button type="button" data-testid="workspace-open-advanced" onClick={onOpenAdvanced} className="inline-flex items-center justify-center border border-[#251b13] px-5 py-3 text-sm hover:bg-[#efe2bd]">查看完整工作区</button>
          </div>
        </header>

        {!modelReady && (
          <section className="mt-6 flex flex-col gap-3 border border-[#b9a55f] bg-[#fff8e7] p-4 md:flex-row md:items-center md:justify-between">
            <div><div className="font-serif text-xl">AI 模型尚未完成配置</div><p className="mt-1 text-sm text-[#5c574d]">现有项目仍可查看。开始新的 AI 工作前，需要完成一次本地模型设置。</p></div>
            <button type="button" onClick={onOpenSettings} className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#251b13] px-4 py-2 text-sm"><Settings size={15} /> 配置模型</button>
          </section>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="工作概况">
          <div className="border border-[#d1d0c9] bg-white p-5"><div className="text-sm text-[#6b665c]">全部项目</div><div className="mt-2 font-serif text-4xl">{projects.length}</div></div>
          <div className="border border-[#d1d0c9] bg-white p-5"><div className="text-sm text-[#6b665c]">正在进行</div><div className="mt-2 font-serif text-4xl">{activeCount}</div></div>
          <div className="border border-[#d1d0c9] bg-white p-5"><div className="text-sm text-[#6b665c]">待处理任务</div><div className="mt-2 font-serif text-4xl">{openTaskCount}</div></div>
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-3xl">我的项目</h2>
          <p className="mt-1 text-sm text-[#6b665c]">{lastSyncedAt ? '本地项目已同步' : '项目保存在这台电脑'}</p>
          {projects.length === 0 ? (
            <div className="mt-4 border border-dashed border-[#b8b2a5] bg-white px-5 py-10 text-center"><div className="font-serif text-2xl">还没有项目</div><p className="mt-2 text-sm text-[#6b665c]">创建项目后，团队、任务和工作结果会显示在这里。</p></div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {projects.map((project) => {
                const teamCount = Array.isArray(project.team) ? project.team.length : 0;
                const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0;
                const progressLabel = progress >= 100 && project.status !== 'completed' ? '当前阶段完成' : `${progress}%`;
                return (
                  <button key={project.id} type="button" onClick={() => onOpenProject?.(project.id)} className="group min-w-0 border border-[#d1d0c9] bg-white p-5 text-left transition-colors hover:border-[#251b13] sm:p-6" aria-label={`打开项目：${project.name}`}>
                    <div className="flex items-start justify-between gap-5"><div className="min-w-0"><div className="flex items-center gap-2 text-sm text-[#59684b]"><FolderKanban size={15} /> {STATUS_LABELS[project.status] || '进行中'}</div><h3 className="mt-3 line-clamp-2 break-words font-serif text-3xl leading-tight">{project.name}</h3></div><ChevronRight size={21} className="mt-1 shrink-0 text-[#9b968c] group-hover:text-[#251b13]" /></div>
                    <p className="mt-4 line-clamp-2 min-h-10 break-words text-sm leading-relaxed text-[#5c574d]">{projectSummary(project)}</p>
                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-[#e1ded5] pt-4 text-sm text-[#6b665c]"><span className="inline-flex items-center gap-2"><Users size={15} /> {teamCount} 位成员</span><span>{progressLabel}</span></div>
                    <div className="mt-2 h-1.5 bg-[#e7e3d9]" aria-label={`项目进度 ${progress}%`}><div className="h-full bg-[#59684b]" style={{ width: `${progress}%` }} /></div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
