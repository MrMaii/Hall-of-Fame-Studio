import React from 'react';
import { Server } from 'lucide-react';

export default function ProjectDashboardGovernanceSpeechProtocol({ view = {} }) {
  const {
    lead,
    onSyncGovernance,
    protocols = [],
    projectText,
    readModel = {},
    reviewer,
    sourceBadge = null,
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18]">{projectText('Governance & Speech Protocol')}</div>
        {sourceBadge}
      </div>
      {readModel.frontendMockSuppressed && (
        <div data-testid="governance-protocol-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Kickoff Charter governance required. Local governance inference is suppressed for this backend project.</span>
          <button
            type="button"
            data-testid="governance-protocol-sync-governance"
            onClick={onSyncGovernance}
            disabled={syncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Server size={10} /> Sync Governance
          </button>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">{projectText('Lead decides')}</div>
          <div className="font-serif text-2xl leading-tight">{lead?.name || 'Unassigned'}</div>
          <div className="font-serif text-sm leading-relaxed text-[#6b5a3d] mt-2">
            {projectText('Owns agenda, owners, dependencies, deadlines, and Director escalation.')}
          </div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/60 p-4">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">{projectText('Reviewer challenges')}</div>
          <div className="font-serif text-2xl leading-tight">{reviewer?.name || 'Unassigned'}</div>
          <div className="font-serif text-sm leading-relaxed text-[#6b5a3d] mt-2">
            {projectText('Checks evidence, risk, acceptance criteria, and whether the Lead is overreaching.')}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {protocols.map(protocol => (
          <div key={protocol.id} className="border-t border-[#d8c99f] pt-3">
            <div className="font-serif text-lg leading-tight">{projectText(protocol.label)}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
              {projectText('Lead')}: {protocol.leadFrame.map(projectText).join(' / ')}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
              {projectText('Members')}: {protocol.memberFrame.map(projectText).join(' / ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
