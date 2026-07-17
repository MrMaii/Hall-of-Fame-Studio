import React from 'react';
import { Database, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardGroupChatTranscriptIndex({ view = {} }) {
  const {
    backendOnline,
    channels = [],
    collaborationRows = [],
    collaborationSourceLabel,
    managerDemo,
    messageCount,
    onOpenChatProof,
    onOpenTimelineProof,
    onOpenTranscript,
    onSyncManagerDashboard,
    onSyncTranscripts,
    recoverableProofCount,
    syncDisabled,
    transcriptMissing,
    transcriptReady,
    transcriptSourceLabel,
  } = view;

  return (
    <div data-testid="group-chat-transcript-index" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Group Chat Transcript Index</div>
          <div className="font-serif text-2xl leading-tight">Every project channel, latest message, receipts, and direct mentions.</div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            data-testid="group-chat-transcript-source"
            className={`node-status-tag ${
              transcriptMissing
                ? 'bg-[#8f1e18] text-white'
                : transcriptReady
                  ? 'bg-[#59684b] text-white'
                  : managerDemo
                    ? 'bg-[#b9782b] text-white'
                    : 'bg-[#251b13] text-[#efe2bd]'
            }`}
          >
            {transcriptSourceLabel}
          </span>
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
            {transcriptMissing
              ? 'transcript read model missing'
              : `${messageCount} messages / ${recoverableProofCount} recoverable proofs`}
          </span>
          {backendOnline && (
            <button
              type="button"
              data-testid="backend-sync-transcripts"
              onClick={onSyncTranscripts}
              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
            >
              <MessageSquare size={10} /> Sync transcripts
            </button>
          )}
        </div>
      </div>
      {transcriptMissing && (
        <div data-testid="backend-transcript-index-required" className="mb-3 border border-[#8f1e18] bg-[#251b13]/95 px-3 py-2 text-[#efe2bd]">
          <div className="font-mono text-[8px] uppercase tracking-widest">Backend transcript model missing</div>
          <div className="mt-1 font-serif text-sm leading-relaxed">
            This real backend project requires `GET /projects/:id/transcripts`; browser-local chat recovery is suppressed until Sync transcripts succeeds.
          </div>
        </div>
      )}
      <div className="space-y-3">
        {channels.map(row => (
          <div key={`transcript-${row.channel.id}`} data-testid={`transcript-channel-${row.channel.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{row.channel.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.channel.category || 'channel'} / {row.channel.description || 'project transcript'}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenTranscript(row)}
                className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
              >
                <MessageSquare size={10} /> Open transcript
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Message Count</div>
                <div className="font-serif text-base leading-tight">{row.messageCount}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Archived Proofs</div>
                <div className="font-serif text-base leading-tight">{row.archivedProofIds.length}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Speaker</div>
                <div className="font-serif text-base leading-tight truncate">{row.latest?.author || 'none'}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Receipt Coverage</div>
                <div className="font-serif text-base leading-tight">{row.receiptCoverage}</div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Direct Mentions</div>
                <div className="font-serif text-base leading-tight truncate">{row.directTargetNames.join(', ') || 'none'}</div>
              </div>
            </div>
            <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
              Latest Message: {row.latest?.text || 'No transcript yet'}
            </div>
          </div>
        ))}
      </div>
      {collaborationSourceLabel === 'backend-required' && !collaborationRows.length && (
        <div data-testid="group-chat-collaboration-proof-backend-required" className="mt-4 border border-[#8f1e18] bg-[#251b13]/95 px-3 py-2 text-[#efe2bd]">
          <div className="font-mono text-[8px] uppercase tracking-widest">Backend collaboration proof rows required</div>
          <div className="mt-1 font-serif text-sm leading-relaxed">
            This real backend project requires Manager Dashboard collaboration rows before evidence, submissions, reviews, revisions, or final delivery can be shown as transcript proof.
          </div>
          <button
            type="button"
            data-testid="group-chat-collaboration-proof-sync-manager-dashboard"
            onClick={onSyncManagerDashboard}
            disabled={syncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-white hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Manager Dashboard
          </button>
        </div>
      )}
      {collaborationRows.length > 0 && (
        <div data-testid="group-chat-collaboration-proof-rows" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Collaboration Proof Rows</div>
              <div className="font-serif text-lg leading-tight">Submissions, evidence searches, reviews, revisions, and final delivery traced back to transcript proof.</div>
            </div>
            <span className={`node-status-tag ${
              collaborationSourceLabel === 'backend-backed'
                ? 'bg-[#59684b] text-white'
                : collaborationSourceLabel === 'backend-required'
                  ? 'bg-[#8f1e18] text-white'
                  : 'bg-[#251b13] text-[#efe2bd]'
            }`}>
              {collaborationSourceLabel}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {collaborationRows.map(row => (
              <div key={row.id} data-testid={`transcript-collaboration-proof-row-${row.safeId}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.typeLabel}</span>
                    <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{row.status}</span>
                  </div>
                  <div className="mt-1 font-serif text-sm leading-tight truncate">{row.title}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">
                    {row.actor} / {row.stageLabel} / {row.route || 'route pending'}
                  </div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">
                    {String(row.detail || '')}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    data-testid={`transcript-collaboration-proof-chat-${row.safeId}`}
                    onClick={() => onOpenChatProof(row.chatProofIds, row.channelId || 'main')}
                    disabled={!row.chatProofIds.length}
                    className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageSquare size={10} /> Chat proof
                  </button>
                  <button
                    type="button"
                    data-testid={`transcript-collaboration-proof-timeline-${row.safeId}`}
                    onClick={() => onOpenTimelineProof(row.timelineLogIds)}
                    disabled={!row.timelineLogIds.length}
                    className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ScrollText size={10} /> Timeline proof
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
