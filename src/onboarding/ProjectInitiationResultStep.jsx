import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function ProjectInitiationResultStep({
  draft,
  workModeLabel,
  firstLead,
  reporter,
  workingGroup,
  workspaceDraft,
  workspacePath,
  invitedMembers,
  confirmedMemberIds,
  confirmedMembersCount,
  actionDrafts,
  meetingSession,
  generationLabel,
  generationProvenance,
  leaderCandidates,
  approvalDisabled,
  approvalRunning,
  approvalLabel,
  onToggleConfirmedMember,
  onUpdateAction,
  onAddAction,
  onSelectLeader,
  onApprove,
}) {
  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">Step 06 / Initiation Result</div>
        <h2 className="font-serif text-5xl leading-none mb-7">Initiation Result: Approved</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            ['Project Name', draft.name],
            ['Operating Mode', workModeLabel],
            ['First Leader', firstLead.name],
            ['Reviewer', reporter.name],
            ['Execution Members', workingGroup.map(member => member.name).join(' / ') || firstLead.name],
            ['Output Format', draft.output],
            ['Source Meeting', 'Mandatory initiation roundtable'],
            ['Local Workspace', workspaceDraft.verification?.workspacePath || workspaceDraft.receipt?.workspacePath || workspacePath],
            ['Workspace Verification', workspaceDraft.verification ? `${workspaceDraft.verification.writePath} / read ${workspaceDraft.verification.readBytes} bytes` : 'pending project approval'],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
              <div className="font-serif text-2xl leading-tight">{value}</div>
            </div>
          ))}
        </div>
        <div data-testid="initiation-director-decisions" className="mt-6 border border-[#8f1e18] bg-[#251b13] text-[#efe2bd] p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#efe2bd] mb-4">Director Decisions</div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Confirmed Team</div>
              <div className="space-y-2">
                {invitedMembers.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    data-testid={`confirmed-team-${member.id}`}
                    onClick={() => onToggleConfirmedMember(member.id)}
                    className={`w-full border px-3 py-2 text-left font-mono text-[8px] uppercase tracking-widest leading-relaxed transition-colors ${confirmedMemberIds.includes(member.id) ? 'border-[#efe2bd] bg-[#251b13] text-[#efe2bd]' : 'border-[#7b6542] bg-[#1a120d] text-[#7d6a49]'} ${member.id === firstLead.id ? 'cursor-default' : 'hover:border-[#efe2bd] hover:text-[#efe2bd]'}`}
                  >
                    {member.name} / {member.id === firstLead.id ? 'Leader marker required' : confirmedMemberIds.includes(member.id) ? (member.id === reporter.id ? 'Reviewer/reporting' : 'Execution Agent') : 'Removed after meeting'}
                  </button>
                ))}
              </div>
              <div data-testid="confirmed-team-count" className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
                {confirmedMembersCount} confirmed Agent{confirmedMembersCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Confirmed Leader Marker</div>
              <div className="font-serif text-2xl leading-tight">{firstLead.name}</div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">Director selected from the campaign slate</div>
            </div>
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">First Execution Plan</div>
              <div className="space-y-2">
                {actionDrafts.map((action, index) => (
                  <input
                    key={`initiation-action-${index}`}
                    data-testid={`initiation-next-action-${index}`}
                    value={action}
                    onChange={(event) => onUpdateAction(index, event.target.value)}
                    className="w-full border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest leading-relaxed text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                  />
                ))}
              </div>
              <button
                type="button"
                data-testid="initiation-add-next-action"
                onClick={onAddAction}
                className="mt-3 w-full border border-[#7b6542] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] hover:border-[#efe2bd] hover:text-[#efe2bd] transition-colors"
              >
                Add next action
              </button>
            </div>
          </div>
          <div className="mt-4 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
            Approval creates kickoff group chat evidence, assigns first work, starts the first autonomous pulse, and opens the manager dashboard.
          </div>
          {meetingSession && (
            <div data-testid="initiation-result-session-proof" className="mt-4 border border-[#7b6542] bg-[#1a120d] p-3">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-1">Meeting Session Evidence</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">
                {meetingSession.id} / {meetingSession.status} / {meetingSession.evidence?.roleTranscriptIds?.length || 0} role turns / {meetingSession.evidence?.leaderCampaignIds?.length || 0} campaigns
              </div>
              <div data-testid="initiation-result-generation-source" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                SOURCE: {generationLabel} / {generationProvenance?.productionClaim || 'production blocked'}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 border border-[#b8a57d] bg-[#f7edcf] p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">Leader Election</div>
          <div className="grid md:grid-cols-2 gap-3">
            {leaderCandidates.slice(0, 4).map(candidate => {
              const selected = firstLead.id === candidate.agentId;
              return (
                <button
                  key={candidate.agentId}
                  type="button"
                  data-testid={`leader-candidate-${candidate.agentId}`}
                  onClick={() => onSelectLeader(candidate.agentId)}
                  className={`text-left border p-4 transition-colors ${selected ? 'border-[#8f1e18] bg-[#251b13] text-[#efe2bd]' : 'border-[#b8a57d] bg-[#efe2bd] text-[#251b13] hover:border-[#8f1e18]'}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="font-serif text-2xl leading-none">{candidate.name}</span>
                    <span className="font-mono text-[8px] uppercase tracking-widest">{candidate.score} pts</span>
                  </div>
                  {selected && <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">Director selected</div>}
                  <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mb-2">{candidate.role}</div>
                  <p className="font-serif text-base leading-relaxed">{candidate.claim}</p>
                </button>
              );
            })}
          </div>
        </div>
        <button
          data-testid="initiation-approve-create"
          onClick={onApprove}
          disabled={approvalDisabled || approvalRunning}
          aria-busy={approvalRunning}
          className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          {approvalRunning ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
          {approvalRunning ? (
            <span data-testid="initiation-approval-progress" role="status">
              {approvalLabel || '正在创建项目并启动 Agent 团队'}
            </span>
          ) : '生成项目并进入 dashboard'}
        </button>
      </section>
      <aside className="hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#8f1e18] mb-5">Project Gate</div>
        <p className="font-serif text-2xl leading-relaxed text-[#d8c99f]">
          现在才可以生成项目。通过后，这个项目会出现在 dashboard，并带上本次会议的第一领导人、汇报人和产出形式。
        </p>
        <button
          onClick={onApprove}
          disabled={approvalDisabled || approvalRunning}
          aria-busy={approvalRunning}
          className="mt-7 w-full bg-[#8f1e18] disabled:bg-[#3a2a1c] disabled:text-[#7d6a49] hover:bg-[#a62a22] text-white px-4 py-4 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-widest transition-colors"
        >
          <CheckCircle2 size={16} />
          生成项目并进入 dashboard
        </button>
      </aside>
    </div>
  );
}
