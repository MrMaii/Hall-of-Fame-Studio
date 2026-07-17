import React from 'react';
import { MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardCommunicationFlow({ view = {} }) {
  const {
    agentRows = [],
    deliveryRows = [],
    onOpenAgentChatProof,
    onOpenPeerChatProof,
    onOpenPeerTimelineProof,
    peerRows = [],
  } = view;

  return (
    <>
      {peerRows.length > 0 && (
        <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Peer Handoffs</div>
          <div className="space-y-3">
            {peerRows.map(handoff => (
              <div key={handoff.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-serif text-lg leading-tight">{handoff.requesterName || handoff.requesterId} {'->'} {handoff.targetName || handoff.targetId}</div>
                  <span className="node-status-tag bg-[#59684b] text-white">{handoff.status}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Task {handoff.taskId}</span>
                  <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {handoff.sourceChannelName}</span>
                </div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                  Request {handoff.requestMessageId} / Ack {handoff.acknowledgementMessageId}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {handoff.chatProofIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenPeerChatProof(handoff)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <MessageSquare size={10} /> Peer chat proof
                    </button>
                  )}
                  {handoff.timelineProofIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenPeerTimelineProof(handoff)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <ScrollText size={10} /> Peer timeline proof
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {agentRows.length > 0 && (
        <div data-testid="agent-communication-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Agent Communication Flow</div>
              <div className="font-serif text-2xl leading-tight">Agent-authored messages, target inbox proof, and sender worklog proof.</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{agentRows.length} traced</span>
          </div>
          {deliveryRows.length > 0 && (
            <div data-testid="agent-message-delivery-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Agent Message Delivery Matrix</div>
                  <div className="font-serif text-lg leading-tight">Every Agent-authored @message mapped to target receipt, inbox, and obligation state.</div>
                </div>
                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
                  {deliveryRows.filter(row => row.receiptSeen && row.inboxSeen).length}/{deliveryRows.length} delivered
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {deliveryRows.slice(0, 8).map(row => (
                  <div key={`delivery-${row.id}`} data-testid={`agent-message-delivery-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-serif text-base leading-tight">{row.senderName} {'->'} {row.targetName}</div>
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.message.text}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        <span className={`node-status-tag ${row.receiptSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Direct Receipt</span>
                        <span className={`node-status-tag ${row.inboxSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Target Inbox</span>
                        <span className={`node-status-tag ${row.obligationSeen ? 'bg-green-700 text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>Obligation</span>
                        <span className={`node-status-tag ${row.senderWorklogSeen ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Sender Worklog</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAgentChatProof(row)}
                      disabled={!row.transcriptProofIds.length}
                      className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <MessageSquare size={10} /> Delivery chat proof
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-3">
            {agentRows.map(row => (
              <div key={`agent-comm-${row.message.id}`} data-testid={`agent-communication-${row.message.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-lg leading-tight">{row.senderName} {'->'} {row.targetNames.join(', ') || 'team'}</div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.message.text}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{row.channelName}</span>
                    <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{row.receiptCount} receipts</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Target Inbox</div>
                    <div className="font-serif text-base leading-tight">{row.inboxSeen ? 'received' : 'pending'}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Open Obligation</div>
                    <div className="font-serif text-base leading-tight">{row.obligationSeen ? 'created' : 'not required'}</div>
                  </div>
                  <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Sender Worklog</div>
                    <div className="font-serif text-base leading-tight">{row.senderWorklogSeen ? 'recorded' : 'pending'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAgentChatProof(row)}
                  disabled={!row.transcriptProofIds.length}
                  className="mt-3 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                >
                  <MessageSquare size={10} /> Agent chat proof
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
