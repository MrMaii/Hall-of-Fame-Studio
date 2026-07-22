import React, { useState } from 'react';
import { ChevronDown, GitCommit } from 'lucide-react';

function formatUpdateTime(value, language = 'zh') {
  if (!value) return language === 'zh' ? '时间待确认' : 'Time pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function ProjectDashboardRecentCommitLine({ view = {} }) {
  const {
    backendRequired,
    events = [],
    language = 'zh',
    onSyncTimeline,
    syncDisabled,
  } = view;
  const [expandedUpdateId, setExpandedUpdateId] = useState(events[0]?.id || null);
  const activeUpdateId = events.some(event => event.id === expandedUpdateId) ? expandedUpdateId : events[0]?.id;

  return (
    <aside data-testid="project-dashboard-official-updates" className="col-span-12 min-h-[18rem] lg:col-span-5 lg:border-l lg:border-[#b8a57d] lg:pl-6">
      <div className="mb-4 border-b border-[#b8a57d] pb-4">
        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#8f1e18]">Official Project Updates</div>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-[#251b13]">{language === 'zh' ? '项目动态' : 'Project updates'}</h2>
        <p className="mt-2 font-serif text-sm leading-relaxed text-[#6b5a3d]">
          {language === 'zh' ? '只记录影响项目方向、版本、交付和团队工作的正式变化。' : 'Only formal changes to direction, versions, delivery, and team work.'}
        </p>
      </div>

      {backendRequired && (
        <div data-testid="recent-commit-line-backend-required" className="mb-4 border-l-2 border-[#8f1e18] bg-red-50/70 p-3 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          <p>{language === 'zh' ? '需要同步正式项目动态，原始本地记录不会在这里冒充官方更新。' : 'Sync the official project timeline before showing updates.'}</p>
          <button
            type="button"
            data-testid="recent-commit-line-sync-timeline-events"
            onClick={onSyncTimeline}
            disabled={syncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] bg-white px-2 py-1 disabled:opacity-40"
          >
            <GitCommit size={10} /> {language === 'zh' ? '同步项目动态' : 'Sync updates'}
          </button>
        </div>
      )}

      <div className="relative pl-5">
        <div aria-hidden="true" className="absolute bottom-4 left-[5px] top-4 w-px bg-[#8f1e18]" />
        {events.map(event => {
          const expanded = event.id === activeUpdateId;
          return (
            <article key={event.id} className="relative border-b border-[#d8c99f] py-4 first:pt-1 last:border-b-0">
              <span aria-hidden="true" className="absolute -left-5 top-6 h-3 w-3 rounded-full border-2 border-[#efe2bd] bg-[#8f1e18] ring-1 ring-[#8f1e18]" />
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpandedUpdateId(expanded ? null : event.id)}
                className="w-full text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-xl leading-snug text-[#8f1e18]">{event.title}</h3>
                  <ChevronDown size={14} className={`mt-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                  <time>{formatUpdateTime(event.timestamp || event.hour, language)}</time>
                  <span>·</span>
                  <span>{event.contributor}</span>
                </div>
              </button>
              {expanded && (
                <div data-testid={`project-update-detail-${event.id}`} className="mt-3 border-l border-[#b8a57d] pl-3">
                  <p className="font-serif text-sm leading-relaxed text-[#4d412d]">{event.detail || event.title}</p>
                  <span className="mt-2 inline-block font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
                    {language === 'zh' ? '官方项目摘要' : 'Official project summary'}
                  </span>
                </div>
              )}
            </article>
          );
        })}
        {!events.length && !backendRequired && (
          <div className="py-8 font-serif text-sm leading-relaxed text-[#6b5a3d]">
            {language === 'zh' ? '暂无值得发布的重大项目动态。' : 'No major project update is ready to publish.'}
          </div>
        )}
      </div>
    </aside>
  );
}
