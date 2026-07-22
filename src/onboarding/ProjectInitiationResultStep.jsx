import React from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function ProjectInitiationResultStep({
  activeLanguage = 'zh',
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
  deliverableDrafts,
  deliverablesReady,
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
  onUpdateDeliverable,
  onAddDeliverable,
  onSelectLeader,
  onApprove,
}) {
  const text = (chinese, english) => activeLanguage === 'zh' ? chinese : english;

  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-[#efe2bd] text-[#251b13] border border-[#7b6542] p-8">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#8f1e18] mb-5">{text('第 6 步 / 立项结果', 'Step 06 / Initiation Result')}</div>
        <h2 className="font-serif text-5xl leading-none mb-7">{text('立项结果：待总监确认', 'Initiation Result: Awaiting Director Confirmation')}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            [text('项目名称', 'Project Name'), draft.name],
            [text('工作类型', 'Operating Mode'), workModeLabel],
            [text('首任负责人', 'First Leader'), firstLead.name],
            [text('复核人', 'Reviewer'), reporter.name],
            [text('执行成员', 'Execution Members'), workingGroup.map(member => member.name).join(' / ') || firstLead.name],
            [text('产出格式', 'Output Format'), draft.output],
            [text('来源会议', 'Source Meeting'), text('必须完成的立项圆桌会议', 'Mandatory initiation roundtable')],
            [text('本地工作区', 'Local Workspace'), workspaceDraft.verification?.workspacePath || workspaceDraft.receipt?.workspacePath || workspacePath],
            [text('工作区验证', 'Workspace Verification'), workspaceDraft.verification ? `${workspaceDraft.verification.writePath} / ${text('读取', 'read')} ${workspaceDraft.verification.readBytes} ${text('字节', 'bytes')}` : text('等待项目批准', 'pending project approval')],
          ].map(([label, value]) => (
            <div key={label} className="border border-[#b8a57d] bg-[#f7edcf] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] mb-2">{label}</div>
              <div className="font-serif text-2xl leading-tight">{value}</div>
            </div>
          ))}
        </div>
        <div data-testid="initiation-director-decisions" className="mt-6 border border-[#8f1e18] bg-[#251b13] text-[#efe2bd] p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#efe2bd] mb-4">{text('立项会议五项确认', 'Five Kickoff Confirmations')}</div>
          <div className="mb-4 border border-[#7b6542] bg-[#1a120d] p-4">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">{text('01 · 明确项目', '01 · Project')}</div>
            <div className="font-serif text-2xl leading-tight">{draft.name}</div>
            <p className="mt-2 font-serif text-base leading-relaxed text-[#d8c99f]">{draft.intent || draft.summary}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">{text('02 · 确认各自职责', '02 · Responsibilities')}</div>
              <div className="space-y-2">
                {invitedMembers.map(member => (
                  <button
                    key={member.id}
                    type="button"
                    data-testid={`confirmed-team-${member.id}`}
                    onClick={() => onToggleConfirmedMember(member.id)}
                    className={`w-full border px-3 py-2 text-left font-mono text-[8px] uppercase tracking-widest leading-relaxed transition-colors ${confirmedMemberIds.includes(member.id) ? 'border-[#efe2bd] bg-[#251b13] text-[#efe2bd]' : 'border-[#7b6542] bg-[#1a120d] text-[#7d6a49]'} ${member.id === firstLead.id ? 'cursor-default' : 'hover:border-[#efe2bd] hover:text-[#efe2bd]'}`}
                  >
                    {member.name} / {member.id === firstLead.id ? text('负责人，必须保留', 'Leader marker required') : confirmedMemberIds.includes(member.id) ? (member.id === reporter.id ? text('复核与汇报', 'Reviewer/reporting') : text('执行成员', 'Execution Agent')) : text('会议后移除', 'Removed after meeting')}
                  </button>
                ))}
              </div>
              <div data-testid="confirmed-team-count" className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
                {activeLanguage === 'zh' ? `已确认 ${confirmedMembersCount} 位智能体` : `${confirmedMembersCount} confirmed Agent${confirmedMembersCount === 1 ? '' : 's'}`}
              </div>
            </div>
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">{text('03 · 选定 Leader', '03 · Leader')}</div>
              <div className="font-serif text-2xl leading-tight">{firstLead.name}</div>
              <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86]">{text('由总监从候选成员中选定', 'Director selected from the campaign slate')}</div>
            </div>
            <div className="border border-[#7b6542] bg-[#1a120d] p-4">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">{text('04 · 确定下一步', '04 · Next Steps')}</div>
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
                {text('添加下一项工作', 'Add next action')}
              </button>
            </div>
          </div>
          <div data-testid="initiation-deliverables-confirmation" className="mt-4 border border-[#7b6542] bg-[#1a120d] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">{text('05 · 确认最终交付物', '05 · Final Deliverables')}</div>
              <div data-testid="initiation-deliverables-readiness" className={`font-mono text-[8px] uppercase tracking-widest ${deliverablesReady ? 'text-[#b9d18f]' : 'text-[#e08f87]'}`}>
                {deliverablesReady ? text('可以确认', 'Ready to confirm') : text('请补全文件、负责人和验收条件', 'Complete file, owner, and acceptance details')}
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {deliverableDrafts.map((deliverable, index) => (
                <div key={deliverable.id || `deliverable-${index}`} data-testid={`initiation-deliverable-${index}`} className="border border-[#7b6542] bg-[#251b13] p-4">
                  <input
                    data-testid={`initiation-deliverable-title-${index}`}
                    aria-label={text(`交付物 ${index + 1} 名称`, `Deliverable ${index + 1} title`)}
                    value={deliverable.title}
                    onChange={(event) => onUpdateDeliverable(index, 'title', event.target.value)}
                    className="w-full border-b border-[#7b6542] bg-transparent pb-2 font-serif text-xl text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      data-testid={`initiation-deliverable-file-${index}`}
                      aria-label={text(`交付物 ${index + 1} 文件名`, `Deliverable ${index + 1} filename`)}
                      value={deliverable.fileName}
                      onChange={(event) => onUpdateDeliverable(index, 'fileName', event.target.value)}
                      className="border border-[#7b6542] bg-[#1a120d] px-3 py-2 font-mono text-[9px] text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                    />
                    <select
                      data-testid={`initiation-deliverable-owner-${index}`}
                      aria-label={text(`交付物 ${index + 1} 负责人`, `Deliverable ${index + 1} owner`)}
                      value={deliverable.ownerId || ''}
                      onChange={(event) => onUpdateDeliverable(index, 'ownerId', event.target.value)}
                      className="border border-[#7b6542] bg-[#1a120d] px-3 py-2 font-mono text-[9px] text-[#efe2bd] outline-none focus:border-[#efe2bd]"
                    >
                      <option value="">{text('选择负责人', 'Choose owner')}</option>
                      {invitedMembers.filter(member => confirmedMemberIds.includes(member.id)).map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    data-testid={`initiation-deliverable-acceptance-${index}`}
                    aria-label={text(`交付物 ${index + 1} 验收条件`, `Deliverable ${index + 1} acceptance condition`)}
                    value={deliverable.acceptanceCriteria?.[0] || ''}
                    onChange={(event) => onUpdateDeliverable(index, 'acceptanceCriteria', event.target.value)}
                    placeholder={text('验收条件', 'Acceptance condition')}
                    className="mt-2 w-full border border-[#7b6542] bg-[#1a120d] px-3 py-2 font-mono text-[9px] text-[#efe2bd] outline-none placeholder:text-[#7d6a49] focus:border-[#efe2bd]"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              data-testid="initiation-add-deliverable"
              onClick={onAddDeliverable}
              className="mt-3 border border-[#7b6542] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] hover:border-[#efe2bd] hover:text-[#efe2bd] transition-colors"
            >
              {text('添加一个交付文件', 'Add deliverable file')}
            </button>
          </div>
          <div className="mt-4 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]">
            {text('批准后会保存立项群聊记录、分配首项工作、启动首次自主执行，并打开项目看板。', 'Approval creates kickoff group chat evidence, assigns first work, starts the first autonomous pulse, and opens the manager dashboard.')}
          </div>
          {meetingSession && (
            <div data-testid="initiation-result-session-proof" className="mt-4 border border-[#7b6542] bg-[#1a120d] p-3">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-1">{text('会议记录证据', 'Meeting Session Evidence')}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#efe2bd]">
                {meetingSession.id} / {meetingSession.status} / {meetingSession.evidence?.roleTranscriptIds?.length || 0} {text('次角色发言', 'role turns')} / {meetingSession.evidence?.leaderCampaignIds?.length || 0} {text('位负责人候选', 'campaigns')}
              </div>
              <div data-testid="initiation-result-generation-source" className="mt-1 font-mono text-[7px] uppercase tracking-widest text-[#bcae86]">
                {text('来源', 'SOURCE')}: {generationLabel} / {generationProvenance?.productionClaim || text('正式使用条件尚未完成', 'production blocked')}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 border border-[#b8a57d] bg-[#f7edcf] p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-4">{text('负责人选择', 'Leader Election')}</div>
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
                    <span className="font-mono text-[8px] uppercase tracking-widest">{candidate.score} {text('分', 'pts')}</span>
                  </div>
                  {selected && <div className="font-mono text-[8px] uppercase tracking-widest text-[#d8c99f] mb-2">{text('总监已选择', 'Director selected')}</div>}
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
              {approvalLabel || text('正在创建项目并启动智能体团队', 'Creating the project and starting the Agent team')}
            </span>
          ) : text('生成项目并进入看板', 'Create project and open dashboard')}
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
