import React from 'react';
import { Activity, Database, ScrollText } from 'lucide-react';

export default function ProjectDashboardAgentManagementMesh({ view = {} }) {
  const {
    agentNameById,
    commandDisabled,
    managerReadModelSourceBadge,
    mesh,
    onOpenTimelineProof,
    onRunManagementSync,
    onSyncCockpit,
    peerRows,
    rows,
    syncDisabled,
  } = view;

  return (
    <div data-testid="agent-management-mesh" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Agent Management Mesh</div>
          <div className="font-serif text-2xl leading-tight">Leader chain, peer-management, and check-in proof.</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {managerReadModelSourceBadge(mesh, 'agent-management-mesh-source')}
          <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{rows.length} Agents</span>
        </div>
      </div>
      {mesh.frontendMockSuppressed && (
        <div data-testid="agent-management-mesh-backend-required" className="mb-4 flex flex-col gap-2 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] md:flex-row md:items-center md:justify-between">
          <span>Backend Agent Management Mesh required. Local management and peer-proof rows are suppressed until Manager Dashboard returns agent-management-mesh/v1.</span>
          <button
            type="button"
            data-testid="agent-management-mesh-sync-cockpit"
            onClick={onSyncCockpit}
            disabled={syncDisabled}
            className="inline-flex shrink-0 items-center justify-center gap-1 border border-[#8f1e18] bg-red-50 px-2 py-1 text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Database size={10} /> Sync Cockpit
          </button>
        </div>
      )}
      <div data-testid="peer-management-matrix" className="mb-4 border border-[#d8c99f] bg-[#efe2bd]/50 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Peer Management Matrix</div>
            <div className="font-serif text-lg leading-tight">Every independent Agent has a peer manager and a peer target.</div>
          </div>
          <span className="node-status-tag bg-[#b9782b] text-white">{peerRows.length} Matrix Rows</span>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {peerRows.slice(0, 6).map(row => (
            <button
              key={`peer-management-matrix-${row.agentId}`}
              type="button"
              data-testid={`peer-management-matrix-${row.agentId}`}
              onClick={() => row.proofLogIds.length && onOpenTimelineProof(row.proofLogIds)}
              className="border border-[#d8c99f] bg-[#f7edcf] px-3 py-2 text-left transition-colors hover:border-[#8f1e18]"
            >
              <div className="font-serif text-base leading-tight">{row.agentName}</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                Manages {row.peerManagedNames.join(', ') || 'none'} / Managed by {row.peerManagerNames.join(', ') || 'none'}
              </div>
              <div className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">
                {row.proofLogIds.length} peer-management proof{row.proofLogIds.length === 1 ? '' : 's'}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(row => (
          <div key={`management-${row.agent.id}`} data-testid={`management-mesh-${row.agent.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="font-serif text-lg leading-tight">{row.agent.name}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{row.agent.role}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {row.agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                {row.managerNames.length > 0 && <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Managed by {row.managerNames.join(', ')}</span>}
                {row.managedNames.length > 0 && <span className="node-status-tag bg-[#59684b] text-white">Manages {row.managedNames.length}</span>}
                {row.peerManagedNames.length > 0 && <span className="node-status-tag bg-[#b9782b] text-white">Peer manages {row.peerManagedNames.length}</span>}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Chain</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {row.managerNames.length ? row.managerNames.join(', ') : row.agent.isLeader ? 'Director-confirmed lead' : 'self-directed'}
                </div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Managed Agents</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {row.managedNames.concat(row.peerManagedNames).join(', ') || 'none'}
                </div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Latest Check-in</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {row.latestEvent ? `${row.latestEvent.kind} -> ${agentNameById[row.latestEvent.targetAgentId] || row.latestEvent.targetName || row.latestEvent.targetAgentId}` : row.workerResponseTargets.length ? `Responded -> ${row.workerResponseTargets.join(', ')}` : row.workerTargets.length ? `Agent pulse -> ${row.workerTargets.join(', ')}` : 'waiting for next pulse'}
                </div>
              </div>
              <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Management Proof</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">
                  {row.checkInCount} timeline management event{row.checkInCount === 1 ? '' : 's'} / {row.responseCount || 0} response{row.responseCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            {row.proofLogIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenTimelineProof(row.proofLogIds)}
                  className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                >
                  <ScrollText size={10} /> Management timeline proof
                </button>
                <button
                  type="button"
                  data-testid={`agent-management-sync-${row.agent.id}`}
                  onClick={() => onRunManagementSync(row.agent.id)}
                  disabled={commandDisabled}
                  className="inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Activity size={10} /> Run Management Sync
                </button>
              </div>
            )}
            {row.proofLogIds.length === 0 && (
              <button
                type="button"
                data-testid={`agent-management-sync-${row.agent.id}`}
                onClick={() => onRunManagementSync(row.agent.id)}
                disabled={commandDisabled}
                className="mt-3 inline-flex items-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Activity size={10} /> Run Management Sync
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
