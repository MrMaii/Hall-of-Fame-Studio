import React from 'react';
import { CornerDownRight, Database, GitCommit, MessageSquare, ScrollText } from 'lucide-react';

export default function ProjectDashboardChangeFlow({ view = {} }) {
  const {
    activeTeamSize = 0,
    changeFlow = {},
    flowRows = [],
    managerReadModelSourceBadge = () => null,
    onOpenChangeChatProof,
    onOpenChangeTimelineProof,
    onOpenOwnerWorkChatProof,
    onOpenOwnerWorkTimelineProof,
    onOpenResolutionProof,
    onOpenSourceProof,
    onSyncCockpit,
    sourceRows = [],
    syncDisabled,
  } = view;

  return (
    <div className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div data-testid="dual-channel-change-intake-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Dual-channel Change Intake Matrix</div>
            <div className="font-serif text-lg leading-tight">War Room and Google Chat requests mapped to receipts, discussion, owner confirmation, and team sync.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {managerReadModelSourceBadge(changeFlow, 'dual-channel-change-intake-source')}
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {sourceRows.filter(row => row.sourceMessageId && row.receiptCount > 0).length}/{sourceRows.length} source-proofed
            </span>
          </div>
        </div>
        {changeFlow.frontendMockSuppressed && (
          <div data-testid="change-flow-backend-required" className="mt-3 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
            <span>Backend Change Flow required. Local change/source-intake rows are suppressed for this backend project.</span>
            <button
              type="button"
              data-testid="change-flow-sync-cockpit"
              onClick={onSyncCockpit}
              disabled={syncDisabled}
              className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Database size={10} /> Sync Cockpit
            </button>
          </div>
        )}
        <div className="mt-3 space-y-2">
          {sourceRows.map(row => (
            <div key={`change-source-intake-${row.id}`} data-testid={`change-source-intake-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-base leading-tight">{row.requestText || row.change?.requestText || 'Backend Change Flow read model required'}</div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    {row.channelName} / Owner {row.ownerName} / {row.sourceChannelCount > 1 ? 'dual-channel' : 'single-channel'}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <span className={`node-status-tag ${row.sourceMessageId ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Source Message</span>
                  <span className={`node-status-tag ${row.receiptCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Source Receipts</span>
                  <span className={`node-status-tag ${row.discussionCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Discussed</span>
                  <span className={`node-status-tag ${row.ownerConfirmed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Confirmed</span>
                  <span className={`node-status-tag ${row.teamSyncCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Synced</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                {[
                  ['Source Channel', row.channelName],
                  ['Receipts', `${row.receiptCount} seen / ${row.directTargetCount} direct`],
                  ['Agent Delivery', `${row.deliveredCount}-${activeTeamSize} inbox / ${row.obligationCount} obligations`],
                  ['Discussion', `${row.discussionCount} turn${row.discussionCount === 1 ? '' : 's'}`],
                  ['Resolution', row.ownerPlanLinked ? `${row.teamSyncCount} synced` : 'plan pending'],
                ].map(([label, value]) => (
                  <div key={`${row.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                    <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.sourceMessageId && (
                  <button
                    type="button"
                    onClick={() => onOpenSourceProof(row)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Source channel proof
                  </button>
                )}
                {row.resolutionProofIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenResolutionProof(row)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <CornerDownRight size={10} /> Resolution chat proof
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-testid="change-resolution-matrix" className="mb-5 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Change Resolution Matrix</div>
            <div className="font-serif text-lg leading-tight">Feature-change intake to owner work pulse, in one manager-readable chain.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {managerReadModelSourceBadge(changeFlow, 'change-flow-source')}
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {flowRows.filter(row => row.ownerPlanLinked && row.teamSyncCount > 0 && row.ownerWorkStarted).length}/{flowRows.length} resolved
            </span>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {flowRows.map(row => {
            const { change, discussionCount, ownerPlanLinked, teamSyncCount, ownerWorkStarted, ownerWorkMessageIds, ownerWorkTimelineIds, discussionDeliveryCount, sourceName } = row;
            return (
              <div key={`change-resolution-${change.id}`} data-testid={`change-resolution-row-${change.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-base leading-tight">{change.requestText}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                      Source {sourceName} / Owner {change.ownerName || change.ownerId || 'pending'}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Discussion {discussionCount}</span>
                    <span className={`node-status-tag ${change.confirmationMessageId ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Confirmed</span>
                    <span className={`node-status-tag ${ownerPlanLinked ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Plan Updated</span>
                    <span className={`node-status-tag ${teamSyncCount > 0 ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Team Synced</span>
                    <span className={`node-status-tag ${ownerWorkStarted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Owner Work Pulse</span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-6 gap-2">
                  {[
                    ['Source Intake', sourceName],
                    ['Team Discussion', `${discussionCount} turns / ${discussionDeliveryCount}-${activeTeamSize} receipts`],
                    ['Owner Confirmation', change.confirmationMessageId ? change.ownerName || change.ownerId || 'confirmed' : 'pending'],
                    ['Owner Plan Update', ownerPlanLinked ? 'linked to plan' : 'pending'],
                    ['Team Resync', `${teamSyncCount} Agent${teamSyncCount === 1 ? '' : 's'}`],
                    ['Owner First Work', ownerWorkStarted ? 'started' : 'pending'],
                  ].map(([label, value]) => (
                    <div key={`${change.id}-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-1 min-w-0">
                      <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">{label}</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ownerWorkMessageIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenOwnerWorkChatProof(row)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <MessageSquare size={10} /> Owner work chat proof
                    </button>
                  )}
                  {ownerWorkTimelineIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenOwnerWorkTimelineProof(row)}
                      className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                    >
                      <GitCommit size={10} /> Owner work timeline proof
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Change Ledger</div>
      <div className="space-y-3">
        {flowRows.map(row => {
          const { change, sourceName, discussionCount, ownerPlanLinked, syncedAgentNames, teamSyncCount, discussionDeliveryCount, discussionObligationCount } = row;
          return (
            <div key={change.id} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-serif text-lg leading-tight">{change.requestText}</div>
                <span className="node-status-tag bg-green-700 text-white">{change.status}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">Owner {change.ownerName || change.ownerId}</span>
                <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">From {sourceName}</span>
                {change.reviewerName && <span className="node-status-tag bg-[#59684b] text-white">Reviewed by {change.reviewerName}</span>}
                {change.teamStateSynced && <span className="node-status-tag bg-[#b9782b] text-white">Synced to {teamSyncCount}</span>}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                {change.planUpdate || 'Plan sync pending'}
              </div>
              <div data-testid={`change-stage-${change.id}`} className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Source Request</div>
                  <div className="font-serif text-base leading-tight">{sourceName}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Team Discussion</div>
                  <div className="font-serif text-base leading-tight">{discussionCount} message{discussionCount === 1 ? '' : 's'}</div>
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">receipts {discussionDeliveryCount}-{activeTeamSize}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owner Confirmation</div>
                  <div className="font-serif text-base leading-tight">{change.confirmationMessageId ? change.ownerName || change.ownerId || 'owner' : 'pending'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Owner Plan</div>
                  <div className="font-serif text-base leading-tight">{ownerPlanLinked ? 'updated' : 'pending'}</div>
                </div>
                <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
                  <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Team Sync</div>
                  <div className="font-serif text-base leading-tight">{teamSyncCount} Agent{teamSyncCount === 1 ? '' : 's'}</div>
                </div>
              </div>
              {syncedAgentNames.length > 0 && (
                <div data-testid={`change-sync-targets-${change.id}`} className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                  Sync Targets: {syncedAgentNames.join(', ')}
                </div>
              )}
              <div data-testid={`change-discussion-receipts-${change.id}`} className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                Discussion receipts: {discussionDeliveryCount}-{activeTeamSize} / obligations {discussionObligationCount}-{activeTeamSize}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.changeChatProofIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenChangeChatProof(row)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Change chat proof
                  </button>
                )}
                {row.changeTimelineProofIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenChangeTimelineProof(row)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <ScrollText size={10} /> Change timeline proof
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
