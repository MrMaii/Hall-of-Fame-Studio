import React from 'react';
import { CalendarDays, MessageCircle, RefreshCw, Users } from 'lucide-react';

function formatBriefTime(value, language = 'zh', fallback = null) {
  if (!value) return fallback || (language === 'zh' ? '等待首次更新' : 'Awaiting first update');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function planTaskStatus(status, language = 'zh') {
  const normalized = String(status || '').toLowerCase();
  if (/done|completed|complete/.test(normalized)) return language === 'zh' ? '已完成' : 'Completed';
  if (/review/.test(normalized)) return language === 'zh' ? '复核中' : 'In review';
  if (/blocked|failed/.test(normalized)) return language === 'zh' ? '受阻' : 'Blocked';
  if (/in-progress|working|active/.test(normalized)) return language === 'zh' ? '制作中' : 'In progress';
  return language === 'zh' ? '待开始' : 'Not started';
}

export default function ProjectDashboardHeader({ view = {} }) {
  const {
    activeProject,
    briefing = {},
    briefingRefreshDisabled,
    fixtureMeta,
    language: viewLanguage,
    projectDashboardSnapshotSourceMeta,
    projectText = value => value,
    onRefreshBriefing,
    onOpenMeeting,
    onOpenChat,
    onOpenTimeline,
  } = view;
  const language = viewLanguage || activeProject?.language || 'zh';
  const executionPlan = briefing.executionPlan || {
    planStatus: 'planning',
    progressAvailable: false,
    leaderName: activeProject?.team?.find(member => member.isLeader)?.name || (language === 'zh' ? '负责人' : 'Leader'),
    progressPercent: null,
    markerPercent: null,
    elapsedPercent: 0,
    expectedCompletionAt: null,
    currentPhase: { label: briefing.stage || (language === 'zh' ? '项目执行' : 'Execution') },
    stages: [],
    rows: [],
  };

  return (
    <>
      <header data-testid="project-dashboard-briefing-header" className="col-span-12 border-b border-[#b8a57d] pb-8">
        <div className="flex flex-col gap-4 border-b border-[#d8c99f] pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#8f1e18]">
              {projectText('Project Dashboard')} / Living Project Brief
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#6b5a3d]">
              <span className="truncate font-serif text-base normal-case tracking-normal text-[#251b13]">{activeProject.name}</span>
              <span>·</span>
              <span>{projectText(activeProject.status)}</span>
              <span>·</span>
              <span>{activeProject.team.length} {projectText('Members')}</span>
              <span data-testid="project-dashboard-snapshot-source" className={`border px-2 py-1 ${projectDashboardSnapshotSourceMeta.className}`}>
                {projectDashboardSnapshotSourceMeta.label}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid="project-dashboard-refresh-briefing" onClick={onRefreshBriefing} disabled={briefingRefreshDisabled} className="inline-flex items-center gap-2 border border-[#8f1e18] bg-[#8f1e18] px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white transition-colors hover:bg-[#6f1713] disabled:cursor-not-allowed disabled:opacity-40">
              <RefreshCw size={13} /> {language === 'zh' ? '更新项目简报' : 'Refresh briefing'}
            </button>
            <button type="button" data-testid="project-open-meeting" onClick={onOpenMeeting} className="inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#efe2bd]"><Users size={13} /> {projectText('Open project meeting')}</button>
            <button type="button" data-testid="project-open-chat" onClick={onOpenChat} className="inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#efe2bd]"><MessageCircle size={13} /> {projectText('Open project chat')}</button>
            <button type="button" data-testid="project-open-timeline" onClick={onOpenTimeline} className="inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[9px] uppercase tracking-widest hover:bg-[#efe2bd]"><CalendarDays size={13} /> {projectText('View full timeline')}</button>
          </div>
        </div>

        <div className="grid gap-8 pt-8 xl:grid-cols-[minmax(0,1fr)_310px] xl:items-end">
          <div className="min-w-0">
            <h1 className="font-serif text-4xl leading-none text-[#251b13] sm:text-5xl xl:text-6xl">{language === 'zh' ? '目前项目在做什么' : 'What the project is doing now'}</h1>
            <div className="mt-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-[#8f1e18]">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#8f1e18] shadow-[0_0_0_4px_rgba(143,30,24,0.09)]" />
              {executionPlan.progressAvailable
                ? (language === 'zh' ? '按计划推进' : 'Executing the submitted plan')
                : (language === 'zh' ? '工作计划制定中' : 'Work plan in preparation')} · {executionPlan.currentPhase?.label}
            </div>
            <p data-testid="project-dashboard-current-focus" className="mt-4 max-w-4xl font-serif text-xl leading-relaxed text-[#3f3528] sm:text-2xl">{briefing.focusSummary}</p>

            {executionPlan.progressAvailable ? <div data-testid="project-dashboard-execution-rail" className="mt-9 border-y border-[#b8a57d] bg-white/20 px-2 py-5 sm:px-4">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8f1e18]">{language === 'zh' ? 'Leader 正式工作计划' : 'Submitted Leader work plan'}</div>
                  <div className="mt-1 font-serif text-lg text-[#251b13]">{language === 'zh' ? `已完成 ${executionPlan.progressPercent}%` : `${executionPlan.progressPercent}% complete`}</div>
                </div>
                <div className="flex gap-4 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                  <span>{language === 'zh' ? '工作完成度' : 'Work'} {executionPlan.progressPercent}%</span>
                  <span>{language === 'zh' ? '计划时间已用' : 'Time used'} {executionPlan.elapsedPercent}%</span>
                </div>
              </div>
              <div className="relative mx-1 h-12">
                <div className="absolute inset-x-0 top-3 h-[2px] bg-[#d8c99f]" />
                <div className="absolute left-0 top-3 h-[2px] bg-[#8f1e18] transition-[width]" style={{ width: `${executionPlan.markerPercent}%` }} />
                <span data-testid="project-dashboard-current-marker" className="absolute top-[5px] z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-[#8f1e18] bg-[#f7edcf] shadow-[0_0_0_5px_rgba(143,30,24,.10)] transition-[left]" style={{ left: `${executionPlan.markerPercent}%` }}>
                  <span className="sr-only">{language === 'zh' ? '当前执行位置' : 'Current execution position'} {executionPlan.markerPercent}%</span>
                </span>
                {(executionPlan.stages || []).map((stage, index) => (
                  <span key={stage.key} className="absolute top-0 -translate-x-1/2" style={{ left: `${stage.position}%` }}>
                    <span aria-hidden="true" className={`block h-3.5 w-3.5 rounded-full border-2 ${executionPlan.markerPercent >= stage.position ? 'border-[#8f1e18] bg-[#f7edcf]' : 'border-[#9b875c] bg-[#efe2bd]'}`} />
                    <span title={`${stage.label} · ${stage.ownerName} · ${formatBriefTime(stage.dueAt, language, '')}`} className={`mt-2 block max-w-32 truncate whitespace-nowrap font-mono text-[8px] uppercase tracking-widest ${index === 0 ? 'translate-x-0' : index === executionPlan.stages.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${executionPlan.currentPhase?.key === stage.key ? 'text-[#8f1e18]' : 'text-[#7d6a49]'}`}>{stage.label}</span>
                  </span>
                ))}
              </div>
            </div> : (
              <section data-testid="project-dashboard-leader-planning" className="mt-9 border border-[#b8a57d] bg-[#fff8e3]/70 p-5 sm:p-6">
                <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-[#8f1e18]">{language === 'zh' ? '计划制定中 · 暂不计算项目进度' : 'Planning · project progress unavailable'}</div>
                <h2 className="mt-2 font-serif text-2xl text-[#251b13]">{language === 'zh' ? `${executionPlan.leaderName} 正在制定项目工作计划` : `${executionPlan.leaderName} is preparing the project work plan`}</h2>
                <p className="mt-3 max-w-3xl font-serif text-base leading-relaxed text-[#5c4b35]">{language === 'zh'
                  ? 'Leader 正在把立项会议确认的目标、分工和交付物整理成可执行节点。每个节点必须写清负责人、交付物和预计完成时间，提交并通过校验后才会生成正式进度条。'
                  : 'The Leader is turning the kickoff decisions into accountable milestones. Every milestone must name an owner, deliverable, and expected finish before formal progress can begin.'}</p>
                <div className="mt-5 grid gap-px bg-[#d8c99f] sm:grid-cols-3">
                  {[
                    language === 'zh' ? '工作节点与交付物' : 'Milestones and deliverables',
                    language === 'zh' ? '每项工作的负责人' : 'Owner for every item',
                    language === 'zh' ? '预计开始与完成时间' : 'Expected start and finish',
                  ].map((item, index) => <div key={item} className="bg-[#f7edcf] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#5c4b35]">{String(index + 1).padStart(2, '0')} · {item}</div>)}
                </div>
              </section>
            )}
          </div>

          <dl className="divide-y divide-[#d8c99f] border-y border-[#b8a57d] font-mono text-[9px] uppercase tracking-widest">
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '当前阶段' : 'Current stage'}</dt><dd className="text-[#251b13]">{briefing.stage}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '下一节点' : 'Next milestone'}</dt><dd className="text-[#251b13]">{briefing.nextMilestone}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '预计完工' : 'Expected finish'}</dt><dd data-testid="project-dashboard-expected-completion" className="text-[#251b13]">{formatBriefTime(executionPlan.expectedCompletionAt, language, language === 'zh' ? '待负责人排期' : 'Awaiting Leader schedule')}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '最后更新' : 'Last updated'}</dt><dd className="text-[#251b13]">{formatBriefTime(briefing.lastUpdatedAt, language)}</dd></div>
          </dl>
        </div>

        {executionPlan.progressAvailable && <section data-testid="project-dashboard-execution-plan" className="mt-8 border-t border-[#b8a57d] pt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8f1e18]">{language === 'zh' ? 'Leader 已提交' : 'Submitted by Leader'} · {formatBriefTime(executionPlan.submittedAt, language)}</div><h2 className="mt-1 font-serif text-2xl text-[#251b13]">{language === 'zh' ? '项目工作计划' : 'Project work plan'}</h2></div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{language === 'zh' ? '按预计完成时间排序' : 'Ordered by expected finish'}</p>
          </div>
          <ol className="mt-4 grid gap-px bg-[#b8a57d] sm:grid-cols-2 xl:grid-cols-4">
            {(executionPlan.rows || []).slice(0, 4).map((row, index) => (
              <li key={row.id || index} className="min-w-0 bg-[#f7edcf] p-4">
                <div className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest"><span className="text-[#8f1e18]">{String(index + 1).padStart(2, '0')} · {row.ownerName}</span><span className="text-[#7d6a49]">{planTaskStatus(row.status, language)}</span></div>
                <p className="mt-3 line-clamp-2 font-serif text-base leading-snug text-[#3f3528]">{row.artifactTitle || row.text}</p>
                <div className="mt-4 h-1 bg-[#d8c99f]"><span className="block h-full bg-[#59684b]" style={{ width: `${Math.max(2, row.progressPercent)}%` }} /></div>
                <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{language === 'zh' ? '预计完成' : 'Expected finish'} · {formatBriefTime(row.dueAt, language, language === 'zh' ? '待排期' : 'Unscheduled')}</div>
              </li>
            ))}
          </ol>
        </section>}
      </header>

      {fixtureMeta && (
        <div data-testid="project-sample-fixture-banner" className="col-span-12 border-l-2 border-[#b9782b] bg-[#fff6d7]/60 px-4 py-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#8f1e18]">{fixtureMeta.label || 'Sample Fixture'} · </span>
          <span className="font-serif text-sm text-[#4d412d]">{projectText(fixtureMeta.purpose || 'Validation and demo data only; create real work through initiation.')}</span>
        </div>
      )}
    </>
  );
}
