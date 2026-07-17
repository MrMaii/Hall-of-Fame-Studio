import React from 'react';
import { MessageSquare, ScrollText, Search } from 'lucide-react';

export default function ProjectDashboardSyncProtocolAudit({ view = {} }) {
  const {
    backendWorkerStationSyncDisabled,
    chatProofIdsFromRow,
    managerReadModelSourceClass,
    managerReadModelSourceLabel,
    onOpenChatProof,
    onOpenTimelineProof,
    onSyncProtocol,
    syncProtocolAudit,
  } = view;

  return (
    <div data-testid="sync-protocol-audit" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Sync Protocol Audit</div>
          <div className="font-serif text-2xl leading-tight">Backend collaboration protocol from message source to Agent state, timeline, and ledger.</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span data-testid="sync-protocol-audit-source" className={`node-status-tag ${managerReadModelSourceClass(syncProtocolAudit)}`}>
            {managerReadModelSourceLabel(syncProtocolAudit)}
          </span>
          <span className={`node-status-tag ${syncProtocolAudit.status === 'synced' ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
            {syncProtocolAudit.syncedCount || 0}/{syncProtocolAudit.count || 0} synced
          </span>
        </div>
      </div>
      {syncProtocolAudit.frontendMockSuppressed && (
        <div data-testid="sync-protocol-audit-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
          Backend Sync Protocol Audit is required for this real project. Local protocol rows are suppressed until /sync-protocol-audit returns sync-protocol-audit/v1.
          <button
            type="button"
            data-testid="sync-protocol-audit-sync-read-model"
            onClick={onSyncProtocol}
            disabled={backendWorkerStationSyncDisabled}
            className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search size={10} /> Sync Protocol
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2">
        {(syncProtocolAudit.rows || []).map(row => {
          const timelineIds = row.timelineLogIds || row.timelineIds || [];
          const chatIds = chatProofIdsFromRow(row);
          return (
            <div key={`sync-protocol-${row.id}`} data-testid={`sync-protocol-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-lg leading-tight">{row.protocol}</div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    {row.managerMeaning}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
                    Source {row.source} / {row.passedCount || 0}-{row.totalCount || 0} checks / {row.status}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {[
                    ['Published', row.published],
                    ['Delivered', row.delivered],
                    ['Agent State', row.agentStateWritten],
                    ['Timeline', row.timelineRecorded],
                    ['Ledger', row.eventLedgerRecorded],
                  ].map(([label, passed]) => (
                    <span key={`${row.id}-${label}`} className={`node-status-tag ${passed ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>{label}</span>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {chatIds.length > 0 && (
                  <button
                    type="button"
                    data-testid={`sync-protocol-chat-proof-${row.id}`}
                    onClick={() => onOpenChatProof(row, chatIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Protocol chat proof
                  </button>
                )}
                {timelineIds.length > 0 && (
                  <button
                    type="button"
                    data-testid={`sync-protocol-timeline-proof-${row.id}`}
                    onClick={() => onOpenTimelineProof(timelineIds)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <ScrollText size={10} /> Protocol timeline proof
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
