import React from 'react';
import { GitCommit } from 'lucide-react';

export default function ProjectDashboardEventLedger({ view = {} }) {
  const {
    events = [],
    onSyncTimeline,
    readModel = {},
    sourceBadge = null,
    summary = {},
    syncDisabled,
  } = view;
  const replayProjection = summary.replayProjection || {};

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18]">Unified Event Ledger</div>
        {sourceBadge}
      </div>
      {readModel.frontendMockSuppressed && (
        <div data-testid="event-ledger-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Event Ledger required. Local event-ledger rows are suppressed for this backend project.
          <button
            type="button"
            data-testid="event-ledger-sync-timeline-events"
            onClick={onSyncTimeline}
            disabled={syncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <GitCommit size={10} /> Sync Timeline
          </button>
        </div>
      )}
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-4">
        Retained {summary.retainedCount} / Total {summary.eventCount} / Seq {summary.firstSequence}-{summary.lastSequence}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {[
          ['Kickoff', replayProjection.kickoffSpeechCount],
          ['Assign', replayProjection.leaderAssignmentCount],
          ['Change', replayProjection.changeConfirmationCount],
          ['Handoff', replayProjection.peerHandoffCount],
          ['Auto', replayProjection.autonomousRunCount],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-lg leading-none">{value}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {events.slice(-5).reverse().map(event => (
          <div key={event.id} className="border-t border-[#d8c99f] pt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="font-serif text-base leading-tight">{event.summary || event.type}</div>
              <span className="node-id-tag">#{event.sequence}</span>
            </div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
              {event.type} / {event.actor} / {event.source}{event.channelId ? ` / #${event.channelId}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
