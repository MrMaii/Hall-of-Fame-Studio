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
    progressPercent: Number(activeProject?.progress) || 0,
    markerPercent: Number(activeProject?.progress) || 0,
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
              {language === 'zh' ? '正在推进' : 'In progress'} · {executionPlan.currentPhase?.label}
            </div>
            <p data-testid="project-dashboard-current-focus" className="mt-4 max-w-4xl font-serif text-xl leading-relaxed text-[#3f3528] sm:text-2xl">{briefing.focusSummary}</p>

            <div data-testid="project-dashboard-execution-rail" className="mt-9 border-y border-[#b8a57d] bg-white/20 px-2 py-5 sm:px-4">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8f1e18]">{language === 'zh' ? '连续执行位置' : 'Continuous execution position'}</div>
                  <div className="mt-1 font-serif text-lg text-[#251b13]">{language === 'zh' ? `已推进 ${executionPlan.progressPercent}%` : `${executionPlan.progressPercent}% advanced`}</div>
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
                    <span className={`mt-2 block whitespace-nowrap font-mono text-[8px] uppercase tracking-widest ${index === 0 ? 'translate-x-0' : index === executionPlan.stages.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${executionPlan.currentPhase?.key === stage.key ? 'text-[#8f1e18]' : 'text-[#7d6a49]'}`}>{stage.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <dl className="divide-y divide-[#d8c99f] border-y border-[#b8a57d] font-mono text-[9px] uppercase tracking-widest">
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '当前阶段' : 'Current stage'}</dt><dd className="text-[#251b13]">{briefing.stage}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '下一节点' : 'Next milestone'}</dt><dd className="text-[#251b13]">{briefing.nextMilestone}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '预计完工' : 'Expected finish'}</dt><dd data-testid="project-dashboard-expected-completion" className="text-[#251b13]">{formatBriefTime(executionPlan.expectedCompletionAt, language, language === 'zh' ? '待负责人排期' : 'Awaiting Leader schedule')}</dd></div>
            <div className="grid grid-cols-[100px_1fr] gap-3 py-3"><dt className="text-[#8f1e18]">{language === 'zh' ? '最后更新' : 'Last updated'}</dt><dd className="text-[#251b13]">{formatBriefTime(briefing.lastUpdatedAt, language)}</dd></div>
          </dl>
        </div>

        <section data-testid="project-dashboard-execution-plan" className="mt-8 border-t border-[#b8a57d] pt-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8f1e18]">Leader plan</div><h2 className="mt-1 font-serif text-2xl text-[#251b13]">{language === 'zh' ? '预期执行计划' : 'Expected execution plan'}</h2></div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{language === 'zh' ? '按负责人截止时间排序' : 'Ordered by Leader deadline'}</p>
          </div>
          <ol className="mt-4 grid gap-px bg-[#b8a57d] sm:grid-cols-2 xl:grid-cols-4">
            {(executionPlan.rows || []).slice(0, 4).map((row, index) => (
              <li key={row.id || index} className="min-w-0 bg-[#f7edcf] p-4">
                <div className="flex items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-widest"><span className="text-[#8f1e18]">{String(index + 1).padStart(2, '0')} · {row.ownerName}</span><span className="text-[#7d6a49]">{row.progressPercent}%</span></div>
                <p className="mt-3 line-clamp-2 font-serif text-base leading-snug text-[#3f3528]">{row.text}</p>
                <div className="mt-4 h-1 bg-[#d8c99f]"><span className="block h-full bg-[#59684b]" style={{ width: `${Math.max(2, row.progressPercent)}%` }} /></div>
                <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{formatBriefTime(row.dueAt, language, language === 'zh' ? '待排期' : 'Unscheduled')}</div>
              </li>
            ))}
          </ol>
        </section>
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
