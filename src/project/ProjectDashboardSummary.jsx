import React from 'react';

export default function ProjectDashboardSummary({ view = {} }) {
  const {
    activeProject,
    briefing = {},
    language: viewLanguage,
    projectText = value => value,
  } = view;
  const language = viewLanguage || activeProject?.language || 'zh';
  const metrics = [
    { id: 'members', value: briefing.metrics?.memberCount ?? activeProject?.team?.length ?? 0, label: language === 'zh' ? '位成员' : 'Members' },
    { id: 'active', value: briefing.metrics?.activeCount ?? 0, label: language === 'zh' ? '项进行中' : 'In progress' },
    { id: 'waiting', value: briefing.metrics?.waitingCount ?? 0, label: language === 'zh' ? '项待确认' : 'Waiting' },
    { id: 'blocked', value: briefing.metrics?.blockedCount ?? 0, label: language === 'zh' ? '个阻塞' : 'Blocked' },
  ];

  return (
    <div data-testid="project-dashboard-quiet-metrics" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#b8a57d] pb-5 font-mono text-[9px] uppercase tracking-widest text-[#6b5a3d]">
      <span className="text-[#8f1e18]">{projectText('Project pulse')}</span>
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.id}>
          {index > 0 && <span aria-hidden="true" className="text-[#b8a57d]">·</span>}
          <span data-testid={`project-dashboard-brief-metric-${metric.id}`}>
            <strong className="mr-1 font-serif text-base font-normal text-[#251b13]">{metric.value}</strong>
            {metric.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}
