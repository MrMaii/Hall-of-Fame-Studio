import React from 'react';
import { GitCommit } from 'lucide-react';

export default function ProjectDashboardRecentCommitLine({ view = {} }) {
  const {
    backendRequired,
    events,
    eventStyles,
    onSyncTimeline,
    syncDisabled,
  } = view;

  return (
    <aside className="col-span-12 lg:col-span-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-4">Recent Commit Line</div>
      <div className="relative pl-7 space-y-5">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#8f1e18]" />
        {backendRequired && (
          <div data-testid="recent-commit-line-backend-required" className="relative flex flex-col gap-2 border border-[#8f1e18] bg-red-50 p-4 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
            <span>Backend timeline read model is required before this real project can show recent commit history.</span>
            <button
              type="button"
              data-testid="recent-commit-line-sync-timeline-events"
              onClick={onSyncTimeline}
              disabled={syncDisabled}
              className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <GitCommit size={10} /> Sync Timeline
            </button>
          </div>
        )}
        {events.map(event => (
          <div key={event.id} className="relative bg-[#f7edcf]/75 border border-[#b8a57d] p-4">
            <div className="absolute -left-[26px] top-5 w-3 h-3 rounded-full bg-[#8f1e18] ring-4 ring-[#efe2bd]" />
            <div className="flex items-center gap-2 mb-2">
              <span className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 ${eventStyles[event.type] || 'bg-[#251b13] text-[#efe2bd]'}`}>{event.type}</span>
              <span className="font-mono text-[9px] text-[#7d6a49]">{event.day} / {event.hour}</span>
            </div>
            <div className="font-serif text-xl">{event.title}</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{event.contributor}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
