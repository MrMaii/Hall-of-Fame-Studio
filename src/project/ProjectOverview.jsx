import { CalendarClock, ChevronRight, MessageSquare, ScrollText, Users } from 'lucide-react';
import ProjectTaskList from '../tasks/ProjectTaskList.jsx';
import { projectActivityText, recentUserFacingProjectActivity } from './projectActivity.js';

const STATUS_LABELS = {
  executing: '进行中',
  initiated: '准备中',
  paused: '已暂停',
  completed: '已完成',
};

export default function ProjectOverview({
  project,
  onEnterMeeting,
  onEnterChat,
  onEnterTimeline,
  onOpenAdvanced,
} = {}) {
  if (!project) return null;
  const team = Array.isArray(project.team) ? project.team : [];
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const recentLogs = recentUserFacingProjectActivity(project, 3);
  const progress = Number.isFinite(Number(project.progress)) ? Math.max(0, Math.min(100, Number(project.progress))) : 0;
  const goal = project.goal || project.description || project.initiation?.summary || '项目目标已经确认，团队正在准备下一项工作。';
  const conciseGoal = String(goal).length > 180 ? `${String(goal).slice(0, 180).trim()}…` : String(goal);
  const progressLabel = progress >= 100 && project.status !== 'completed' ? '当前阶段已完成' : `${progress}% 完成`;
  const decisions = Array.isArray(project.decisions) ? project.decisions.filter(Boolean).slice(-3).reverse() : [];

  return (
    <div data-testid="project-overview" className="h-full overflow-y-auto bg-[#f5f4f0] px-4 py-6 text-[#1a1a1a] sm:px-6 md:px-10 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[#c9c5ba] pb-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#8f1e18]">项目</div>
              <h1 className="mt-3 max-w-4xl break-words font-serif text-4xl leading-tight md:text-6xl">{project.name}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#5c574d]">
                <span>{STATUS_LABELS[project.status] || '进行中'}</span>
                <span>{team.length} 位成员</span>
                <span>{progressLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onEnterMeeting} className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#251b13] bg-[#251b13] px-5 py-3 text-white hover:bg-[#8f1e18]">
                <CalendarClock size={17} /> 进入项目会议
              </button>
              <button type="button" data-testid="project-overview-open-advanced" onClick={onOpenAdvanced} className="inline-flex shrink-0 items-center justify-center border border-[#251b13] px-5 py-3 text-sm hover:bg-[#efe2bd]">
                查看完整项目控制台
              </button>
            </div>
          </div>
          <div className="mt-5 h-2 bg-[#e1ded5]" aria-label={`项目进度 ${progress}%`}><div className="h-full bg-[#59684b]" style={{ width: `${progress}%` }} /></div>
        </header>

        <section className="mt-7 border border-[#d1d0c9] bg-white p-5 sm:p-6">
          <div className="text-sm text-[#6b665c]">项目目标</div>
          <p className="mt-3 max-w-4xl break-words font-serif text-2xl leading-relaxed">{conciseGoal}</p>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="min-w-0 space-y-6">
            <ProjectTaskList tasks={tasks} />

            <section className="border border-[#d1d0c9] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><ScrollText size={16} /> 最近结果</div>
              <h2 className="mt-2 font-serif text-3xl">最新记录</h2>
              <div className="mt-5 space-y-3">
                {(recentLogs.length ? recentLogs : [{ id: 'empty', text: '还没有新的工作记录。进入会议或群聊开始推进项目。' }]).map((log) => (
                  <div key={log.id || log.timestamp || log.text} className="break-words border-l-2 border-[#59684b] py-1 pl-4 text-sm leading-relaxed text-[#5c574d]">{projectActivityText(log)}</div>
                ))}
              </div>
              <button type="button" onClick={onEnterTimeline} className="mt-5 inline-flex items-center gap-2 text-sm underline underline-offset-4">查看工作记录 <ChevronRight size={15} /></button>
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="border border-[#d1d0c9] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm text-[#6b665c]"><Users size={16} /> 团队</div>
              <div className="mt-4 divide-y divide-[#e1ded5]">
                {(team.length ? team : [{ id: 'empty', name: '团队尚未组建', role: '完成立项后会在这里显示成员' }]).map((member) => (
                  <div key={member.id || member.name} className="py-3">
                    <div className="break-words font-serif text-lg">{member.name}</div>
                    <div className="mt-1 break-words text-sm text-[#6b665c]">{member.role || member.title || '项目成员'}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-[#d1d0c9] bg-white p-5 sm:p-6">
              <div className="text-sm text-[#6b665c]">需要你确认</div>
              <div className="mt-3 font-serif text-xl">{decisions.length ? `${decisions.length} 项待确认内容` : '当前没有待确认内容'}</div>
              <button type="button" onClick={onEnterChat} className="mt-5 inline-flex w-full items-center justify-center gap-2 border border-[#251b13] px-4 py-3 text-sm hover:bg-[#251b13] hover:text-white">
                <MessageSquare size={16} /> 打开项目群聊
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
