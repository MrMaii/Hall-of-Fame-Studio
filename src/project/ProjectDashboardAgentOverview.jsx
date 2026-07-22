import React, { useState } from 'react';
import { Activity, Check, ChevronDown, Circle, Clock3, Database, ListChecks, Network } from 'lucide-react';

const statusClass = {
  active: 'text-[#8f1e18]',
  reviewing: 'text-[#8a5d1d]',
  waiting: 'text-[#75631d]',
  blocked: 'text-[#8f1e18]',
  completed: 'text-[#3f5136]',
};

function formatDeadline(value, language = 'zh') {
  if (!value) return language === 'zh' ? '待负责人确认' : 'Awaiting Leader';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export default function ProjectDashboardAgentOverview({ view = {} }) {
  const {
    activeProject,
    agentStateSummary,
    backendCommandAvailable,
    backendStation,
    backendWorkerStationSyncDisabled,
    briefing = {},
    language: viewLanguage,
    managerReadModelSourceBadge,
    onOpenManagerFlowGraph,
    onRunAgentPulse,
    onSyncCockpit,
    operationsBoardBackendRequired,
    sceneTransition,
  } = view;
  const language = viewLanguage || activeProject?.language || 'zh';
  const teamRows = briefing.teamRows || [];
  const [expandedAgentIds, setExpandedAgentIds] = useState(() => new Set());
  const toggleAgent = (agentId) => {
    setExpandedAgentIds((previous) => {
      const next = new Set(previous);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <section data-testid="dashboard-agent-status" className="mb-6 min-h-[18rem] border-b border-[#b8a57d] pb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#8f1e18]">{language === 'zh' ? '团队现场' : 'Team floor'}</div>
          <h2 className="mt-2 font-serif text-3xl leading-tight text-[#251b13]">{language === 'zh' ? '谁在做什么' : 'Who is doing what'}</h2>
          <p className="mt-2 max-w-2xl font-serif text-sm leading-relaxed text-[#6b5a3d]">{language === 'zh' ? '先看每个人要交付的文件，再看用途、位置和当前状态；内部运行记录不计入完成度。' : 'Start with each person’s deliverable, then its purpose, location, and status; internal runtime activity does not count as completion.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {managerReadModelSourceBadge(agentStateSummary, 'dashboard-agent-status-source')}
          <button
            type="button"
            onClick={onOpenManagerFlowGraph}
            disabled={Boolean(sceneTransition)}
            className="inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[8px] uppercase tracking-widest hover:bg-[#efe2bd] disabled:opacity-40"
          >
            <Network size={12} /> {language === 'zh' ? '查看协作关系' : 'View collaboration'}
          </button>
        </div>
      </div>

      {operationsBoardBackendRequired && (
        <div data-testid="dashboard-agent-status-backend-required" className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-2 border-[#8f1e18] bg-red-50/70 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          <span>{language === 'zh' ? '需要同步团队当前工作，才会显示正式成员摘要。' : 'Sync the team workspace to show official member summaries.'}</span>
          <button
            type="button"
            data-testid="dashboard-agent-status-sync-cockpit"
            onClick={onSyncCockpit}
            disabled={backendWorkerStationSyncDisabled}
            className="inline-flex items-center gap-1 border border-[#8f1e18] bg-white px-2 py-1 disabled:opacity-40"
          >
            <Database size={10} /> {language === 'zh' ? '同步团队' : 'Sync team'}
          </button>
        </div>
      )}

      <div className="border-y border-[#b8a57d]">
        {teamRows.map(row => {
          const expanded = expandedAgentIds.has(row.id);
          const initial = String(row.agent?.name || '?').trim().charAt(0).toUpperCase();
          const completedTodos = (row.todos || []).filter(todo => todo.status === 'completed').length;
          return (
            <article
              key={row.id}
              data-testid={`dashboard-agent-status-${row.id}`}
              className={`relative border-b border-[#d8c99f] last:border-b-0 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:transition-colors ${expanded ? 'bg-[#f7edcf]/76 before:bg-[#8f1e18]' : 'hover:bg-[#efe2bd]/45 before:bg-transparent'}`}
            >
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`dashboard-agent-detail-${row.id}`}
                onClick={() => toggleAgent(row.id)}
                className="grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left sm:grid-cols-[52px_150px_minmax(0,1fr)_auto] sm:px-4"
              >
                {row.avatarSrc ? (
                  <img src={row.avatarSrc} alt="" className="h-11 w-11 border border-[#b8a57d] object-cover sm:h-12 sm:w-12" />
                ) : (
                  <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center border border-[#7b6542] bg-[#efe2bd] font-serif text-xl text-[#251b13] sm:h-12 sm:w-12">
                    {initial}
                  </span>
                )}
                <span className="min-w-0 sm:block">
                  <span className="block truncate font-serif text-lg leading-tight text-[#251b13]">{row.agent?.name}</span>
                  <span className="mt-1 block truncate font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{row.agent?.role || row.agent?.title}</span>
                </span>
                <span className="col-span-3 min-w-0 sm:col-span-1">
                  <span className="block font-serif text-base leading-snug text-[#4d412d]">{row.sentence}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                    <span className="inline-flex items-center gap-1"><Clock3 size={10} /> {formatDeadline(row.deadlineAt, language)}</span>
                    <span>{completedTodos}/{(row.todos || []).length} {language === 'zh' ? '项待办完成' : 'todos done'}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`whitespace-nowrap font-mono text-[8px] uppercase tracking-widest ${statusClass[row.status?.key] || statusClass.active}`}>{row.status?.label}</span>
                  <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </span>
              </button>

              {expanded && (
                <div id={`dashboard-agent-detail-${row.id}`} data-testid={`dashboard-agent-detail-${row.id}`} className="grid gap-5 border-t border-[#d8c99f] px-4 py-5 sm:ml-16 sm:grid-cols-[minmax(0,1.25fr)_minmax(230px,.75fr)] sm:pr-6">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.18em] text-[#8f1e18]"><ListChecks size={12} />{language === 'zh' ? '负责人设置的待办' : 'Leader-set todos'}</div>
                    <ol data-testid={`dashboard-agent-todos-${row.id}`} className="mt-3 space-y-2">
                      {(row.todos || []).length ? row.todos.map((todo, index) => (
                        <li key={todo.id || `${row.id}-todo-${index}`} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 border-b border-[#d8c99f]/70 pb-2 last:border-b-0">
                          <span aria-hidden="true" className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border ${todo.status === 'completed' ? 'border-[#59684b] bg-[#59684b] text-white' : todo.status === 'in-progress' ? 'border-[#8f1e18] text-[#8f1e18]' : 'border-[#b8a57d] text-[#b8a57d]'}`}>
                            {todo.status === 'completed' ? <Check size={10} /> : <Circle size={7} fill={todo.status === 'in-progress' ? 'currentColor' : 'none'} />}
                          </span>
                          <span className={`font-serif text-sm leading-relaxed ${todo.status === 'completed' ? 'text-[#8a7b60] line-through decoration-[#b8a57d]' : 'text-[#3f3528]'}`}>{todo.text}</span>
                          <span className={`font-mono text-[7px] uppercase tracking-widest ${todo.status === 'in-progress' ? 'text-[#8f1e18]' : 'text-[#8a7b60]'}`}>{todo.status === 'completed' ? (language === 'zh' ? '完成' : 'Done') : todo.status === 'in-progress' ? (language === 'zh' ? '当前' : 'Now') : (language === 'zh' ? '待办' : 'Next')}</span>
                        </li>
                      )) : (
                        <li className="border-l-2 border-[#8f1e18] bg-white/35 px-3 py-2 font-serif text-sm text-[#6b5a3d]">{language === 'zh' ? '负责人尚未为这名成员设置正式待办。' : 'The Leader has not set a formal todo for this member yet.'}</li>
                      )}
                    </ol>
                    <div className="mt-4 h-1.5 overflow-hidden bg-[#d8c99f]/60" aria-label={language === 'zh' ? '个人任务进度' : 'Individual task progress'}>
                      <span className="block h-full bg-[#8f1e18] transition-[width]" style={{ width: `${Math.max(2, row.taskProgressPercent || 0)}%` }} />
                    </div>
                  </div>
                  <aside className="border-l border-[#b8a57d] pl-4">
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{language === 'zh' ? '要交付的文件' : 'Deliverable file'}</div>
                    <p className="mt-2 font-serif text-base leading-relaxed text-[#251b13]">{row.deliverable || row.nextStep}</p>
                    {row.deliverablePurpose && <p className="mt-2 font-serif text-sm leading-relaxed text-[#4d412d]">{row.deliverablePurpose}</p>}
                    {row.deliverablePath && <p data-no-localize="" className="mt-3 break-all font-mono text-[8px] leading-relaxed text-[#7d6a49]">{row.deliverablePath}</p>}
                    {row.deliverableStatus && <div className="mt-3 inline-flex border border-[#b8a57d] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#59684b]">{row.deliverableStatus}</div>}
                    <div className="mt-4 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{language === 'zh' ? '最近动作' : 'Latest action'}</div>
                    <p className="mt-2 font-serif text-sm leading-relaxed text-[#4d412d]">{row.latestAction}</p>
                    <button
                      type="button"
                      onClick={() => onRunAgentPulse(row.id)}
                      disabled={!backendCommandAvailable || backendStation.loading}
                      className="mt-5 inline-flex items-center gap-2 border border-[#7b6542] px-3 py-2 font-mono text-[8px] uppercase tracking-widest hover:bg-[#efe2bd] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Activity size={11} /> {language === 'zh' ? '推进一次工作' : 'Run one work pulse'}
                    </button>
                  </aside>
                </div>
              )}
            </article>
          );
        })}
        {!teamRows.length && !operationsBoardBackendRequired && (
          <div className="px-4 py-8 text-center font-serif text-base text-[#6b5a3d]">
            {language === 'zh' ? '项目团队尚未形成正式工作摘要。' : 'No official team work summary is available yet.'}
          </div>
        )}
      </div>
    </section>
  );
}
