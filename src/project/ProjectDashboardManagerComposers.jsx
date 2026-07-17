import React from 'react';
import { CheckCircle2, ClipboardList, CornerDownRight, Send } from 'lucide-react';

export default function ProjectDashboardManagerComposers({ view = {} }) {
  const {
    assignmentSubmitDisabled,
    assignmentTargets,
    changeSubmitDisabled,
    managerAssignmentDraft,
    managerChangeDraft,
    managerReadModelSourceBadge,
    managerRequirementMatrix,
    managerRequirementMatrixDisplayRows,
    onAssignmentDraftChange,
    onChangeDraft,
    onOpenRequirement,
    onSubmitAssignment,
    onSubmitChange,
    onSyncRequirementMatrix,
    syncDisabled,
  } = view;

  return (
    <>
      <div data-testid="manager-requirement-matrix" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Requirement Matrix</div>
            <div className="font-serif text-2xl leading-tight">Each requested condition mapped to concrete chat, timeline, or read-model proof.</div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {managerReadModelSourceBadge(managerRequirementMatrix, 'manager-requirement-matrix-source')}
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {managerRequirementMatrix.passedCount ?? managerRequirementMatrixDisplayRows.filter(row => row.passed).length}/{managerRequirementMatrix.count ?? managerRequirementMatrixDisplayRows.length} covered
            </span>
          </div>
        </div>
        {managerRequirementMatrix.frontendMockSuppressed && (
          <div data-testid="manager-requirement-matrix-backend-required" className="mb-4 border border-[#8f1e18] bg-red-50 px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">
            Backend Manager Requirement Matrix is required for this real project. Local requirement rows are suppressed until /manager-requirement-matrix returns manager-requirement-matrix/v1.
            <button
              type="button"
              data-testid="manager-requirement-matrix-sync-read-model"
              onClick={onSyncRequirementMatrix}
              disabled={syncDisabled}
              className="mt-3 inline-flex items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ClipboardList size={10} /> Sync Matrix
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          {managerRequirementMatrixDisplayRows.map((row, index) => (
            <div key={`manager-requirement-${row.id}`} data-testid={`manager-requirement-row-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-[10px] ${row.passed ? 'border-green-700 bg-green-700 text-white' : 'border-[#b9782b] bg-[#f7edcf] text-[#8f1e18]'}`}>
                    {row.passed ? <CheckCircle2 size={13} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-base leading-tight">{row.requirement}</span>
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.evidence}</span>
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`node-status-tag ${row.passed ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>{row.passed ? 'Covered' : 'Needs Proof'}</span>
                  <button
                    type="button"
                    data-testid={`manager-requirement-proof-${row.id}`}
                    onClick={() => onOpenRequirement(row)}
                    disabled={!(row.proofIds?.length || row.timelineIds?.length || row.timelineLogIds?.length)}
                    className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CornerDownRight size={10} /> Requirement proof
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-testid="manager-leader-assignment-composer" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Leader Assignment Composer</div>
            <div className="font-serif text-2xl leading-tight">Ask the confirmed Leader to @assign custom work in group chat.</div>
          </div>
          <span className="node-status-tag bg-[#59684b] text-white">Group @Assignment</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <textarea
            data-testid="manager-assignment-composer-input"
            value={managerAssignmentDraft.text}
            onChange={(event) => onAssignmentDraftChange({ text: event.target.value })}
            rows={3}
            className="w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-serif text-base leading-relaxed text-[#251b13] outline-none focus:border-[#8f1e18]"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <select
              data-testid="manager-assignment-composer-target"
              value={managerAssignmentDraft.targetAgentId}
              onChange={(event) => onAssignmentDraftChange({ targetAgentId: event.target.value })}
              className="border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
            >
              {assignmentTargets.map(agent => (
                <option key={`assignment-target-${agent.id}`} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Leader @Mention</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Assignee Inbox</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Acknowledgement</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Timeline Logs</span>
              <button
                type="button"
                data-testid="manager-assignment-composer-submit"
                onClick={onSubmitAssignment}
                disabled={assignmentSubmitDisabled}
                className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={10} /> Submit Assignment
              </button>
            </div>
          </div>
        </div>
      </div>

      <div data-testid="manager-change-intake-composer" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Change Intake</div>
            <div className="font-serif text-2xl leading-tight">Custom change request into meeting, Google Chat, or both.</div>
          </div>
          <span className="node-status-tag bg-[#b9782b] text-white">{managerChangeDraft.mode === 'dual' ? 'War Room + Google Chat' : managerChangeDraft.mode === 'meeting' ? 'War Room' : 'Google Chat'}</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <textarea
            data-testid="manager-change-composer-input"
            value={managerChangeDraft.text}
            onChange={(event) => onChangeDraft({ text: event.target.value })}
            rows={3}
            className="w-full resize-none border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-serif text-base leading-relaxed text-[#251b13] outline-none focus:border-[#8f1e18]"
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <select
              data-testid="manager-change-composer-mode"
              value={managerChangeDraft.mode}
              onChange={(event) => onChangeDraft({ mode: event.target.value })}
              className="border border-[#d8c99f] bg-[#efe2bd] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#251b13] outline-none focus:border-[#8f1e18]"
            >
              <option value="dual">War Room + Google Chat</option>
              <option value="meeting">War Room meeting</option>
              <option value="google_chat">Google Chat</option>
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Discussion</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner Confirmation</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Owner Plan</span>
              <span className="node-status-tag bg-[#efe2bd] text-[#251b13]">Team Sync</span>
              <button
                type="button"
                data-testid="manager-change-composer-submit"
                onClick={onSubmitChange}
                disabled={changeSubmitDisabled}
                className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#8f1e18] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={10} /> Submit Change
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
