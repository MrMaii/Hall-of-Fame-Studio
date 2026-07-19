import React from 'react';
import { CircleDot, MessageSquare } from 'lucide-react';

export default function ProjectDashboardKickoffCharter({ view = {} }) {
  const {
    charter = {},
    onOpenChatProof,
    proofIds = [],
    projectText,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">{projectText('Kickoff Charter')}</div>
          <div className="font-serif text-2xl leading-tight">{projectText(charter.title)}</div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mt-2">
            {charter.meeting?.result} / {charter.meeting?.leaderCandidateCount || 0} leader candidates
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="node-status-tag bg-green-700 text-white">{charter.status}</span>
          {proofIds.length > 0 && (
            <button
              type="button"
              onClick={onOpenChatProof}
              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
            >
              <MessageSquare size={10} /> Kickoff chat proof
            </button>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-3">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-1">Confirmed Leader</div>
          <div className="font-serif text-xl">{charter.governance?.leaderName || 'Unassigned'}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-3">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-1">Reviewer</div>
          <div className="font-serif text-xl">{charter.governance?.reviewerName || 'Unassigned'}</div>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {charter.nextActions?.slice(0, 3).map(action => (
          <div key={action.id || action.text} className="flex items-start gap-3 border-t border-[#d8c99f] pt-2">
            <CircleDot size={13} className={action.status === 'done' ? 'text-green-700 mt-1' : 'text-[#8f1e18] mt-1'} />
            <div className="min-w-0 flex-1 pr-4">
              <div className="font-serif text-base leading-tight">{projectText(action.text)}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{action.ownerName || action.ownerId || 'unassigned'} / {action.status}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
        {charter.communicationRules?.slice(0, 2).join(' / ')}
      </div>
    </div>
  );
}
