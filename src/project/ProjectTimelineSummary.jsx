import { ArrowLeft, CalendarClock } from 'lucide-react';
import { projectActivityText, recentUserFacingProjectActivity } from './projectActivity.js';

const TYPE_LABELS = {
  decision: '决定',
  meeting: '会议',
  'meeting-agent-turn': '会议回复',
  'work-log': '工作进展',
  'timeline-log': '工作记录',
  'task-completed': '任务完成',
  completed: '已完成',
};

function eventTime(row = {}) {
  const value = row.time || row.timestamp || row.createdAt || row.updatedAt;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ProjectTimelineSummary({ project, onBack } = {}) {
  if (!project) return null;
  const logs = recentUserFacingProjectActivity(project, 30);

  return (
    <div data-testid="project-simple-timeline" className="h-screen overflow-y-auto bg-[#f5f4f0] px-6 py-8 text-[#1a1a1a] md:px-10 md:py-10">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-[#c9c5ba] pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-[#6b665c] hover:text-[#1a1a1a]"><ArrowLeft size={16} /> 返回项目</button>
            <div className="mt-5 font-mono text-xs uppercase tracking-[0.24em] text-[#8f1e18]">时间线</div>
            <h1 className="mt-3 font-serif text-4xl leading-tight md:text-6xl">最近工作记录</h1>
            <p className="mt-3 font-serif text-lg text-[#5c574d]">{project.name}</p>
          </div>
          <div className="border border-[#d1d0c9] bg-white px-5 py-3 text-sm text-[#5c574d]">显示最近 {logs.length} 条</div>
        </header>

        <section className="mt-7 border border-[#d1d0c9] bg-white">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-[#6b665c]">还没有工作记录。会议、任务和结果会按时间显示在这里。</div>
          ) : (
            <div className="divide-y divide-[#e1ded5]">
              {logs.map((row, index) => {
                const text = projectActivityText(row);
                const shortText = text.length > 260 ? `${text.slice(0, 260).trim()}…` : text;
                const type = TYPE_LABELS[row.eventType] || TYPE_LABELS[row.type] || '项目更新';
                return (
                  <article key={row.id || `${eventTime(row)}-${index}`} className="grid gap-3 p-5 md:grid-cols-[150px_1fr] md:p-6">
                    <div className="text-sm text-[#6b665c]">
                      <div className="inline-flex items-center gap-2"><CalendarClock size={15} /> {eventTime(row) || '时间未记录'}</div>
                      <div className="mt-2 text-[#8f1e18]">{type}</div>
                    </div>
                    <div>
                      <div className="font-serif text-lg leading-relaxed">{shortText}</div>
                      {(row.agent || row.actor || row.author) && <div className="mt-2 text-sm text-[#6b665c]">{row.agent || row.actor || row.author}</div>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
