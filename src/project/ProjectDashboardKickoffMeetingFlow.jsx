import React from 'react';
import { GitCommit, MessageSquare } from 'lucide-react';

export default function ProjectDashboardKickoffMeetingFlow({ view = {} }) {
  const {
    flow = {},
    onOpenChatProof,
    onOpenTimelineProof,
    proofIds = [],
    proofIdsFromRow = () => [],
    text = value => value,
  } = view;

  return (
    <div data-testid="kickoff-meeting-flow" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Kickoff Meeting Flow</div>
          <div className="font-serif text-2xl leading-tight">Role negotiation to Director-confirmed Leader marker</div>
        </div>
        {proofIds.length > 0 && (
          <button
            type="button"
            onClick={() => onOpenChatProof(proofIds, 'main')}
            className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
          >
            <MessageSquare size={10} /> Kickoff meeting proof
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Role Clarification</div>
          <div className="font-serif text-base leading-tight">{flow.roleQuestionCount} question{flow.roleQuestionCount === 1 ? '' : 's'}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Self Nominations</div>
          <div className="font-serif text-base leading-tight">{flow.selfNominationCount} volunteer{flow.selfNominationCount === 1 ? '' : 's'}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Peer Hearing</div>
          <div className="font-serif text-base leading-tight">{flow.roleHearingCount + flow.leaderHearingCount} edges</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Campaign</div>
          <div className="font-serif text-base leading-tight">{flow.leaderCampaignCount} candidate{flow.leaderCampaignCount === 1 ? '' : 's'}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Director Confirmation</div>
          <div className="font-serif text-base leading-tight">{flow.confirmedLeaderName}</div>
        </div>
        <div className="border border-[#d8c99f] bg-[#efe2bd]/55 px-2 py-2">
          <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Leader Marker</div>
          <div className="font-serif text-base leading-tight">{flow.leaderMarkerPersisted ? 'persisted' : 'pending'}</div>
        </div>
      </div>
      <div className="mt-3 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
        Confirmed Team: {flow.confirmedTeamCount} Agents
        {flow.leaderCandidateNames.length > 0 && ` / Candidate Slate: ${flow.leaderCandidateNames.slice(0, 4).join(', ')}`}
        {flow.roleQuestionResolutions?.length > 0 && ` / Role Answers: ${flow.roleQuestionAnsweredCount}-${flow.roleQuestionResolutions.length}`}
      </div>
      <div data-testid="kickoff-dashboard-generation-source-detail" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Generation Source</div>
            <div className="mt-1 font-serif text-lg leading-tight">{text(flow.generationLabel)}</div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
              {text(flow.generationProvenance?.label || 'Generation provenance not recorded')} / {text(flow.generationProvenance?.mode || 'missing')}
            </div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
              {text(flow.generationProvenance?.productionBlocker || 'Production claim remains blocked until provider controls are recorded.')}
            </div>
          </div>
          <span className={`node-status-tag ${flow.generationProvenance?.productionClaim === 'blocked' ? 'bg-[#8f1e18] text-white' : 'bg-[#59684b] text-white'}`}>
            {text(flow.generationProvenance?.productionClaim || 'blocked')}
          </span>
        </div>
      </div>
      {flow.briefAlignment && (
        <div data-testid="kickoff-brief-alignment" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Brief Alignment</div>
              <div className="mt-1 font-serif text-lg leading-tight">Director brief received before role questions and self-nominations.</div>
              <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">
                {flow.briefAlignment.text || 'No brief text recorded'}
              </div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              Heard by {flow.briefAlignment.heardByAgentIds?.length || 0}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Project Brief</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{flow.briefAlignment.speakerName}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1 min-w-0">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Brief Heard By</div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#4d412d] leading-relaxed break-words">{flow.briefAlignment.heardByAgentNames?.join(', ') || 'none'}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Role Questions</div>
              <div className="font-serif text-base leading-tight">{flow.briefAlignment.roleQuestionCount}</div>
            </div>
            <div className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#8f1e18]">Self Nominations</div>
              <div className="font-serif text-base leading-tight">{flow.briefAlignment.selfNominationCount}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {flow.briefAlignment.proofIds?.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenChatProof(flow.briefAlignment.proofIds, flow.briefAlignment.channelId || 'main')}
                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
              >
                <MessageSquare size={10} /> Brief proof
              </button>
            )}
            {flow.briefAlignment.responseRows?.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenChatProof(flow.briefAlignment.responseRows.flatMap(row => row.proofIds || []).slice(0, 8), 'main')}
                className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
              >
                <MessageSquare size={10} /> Role response proof
              </button>
            )}
          </div>
        </div>
      )}
      {flow.confirmedTeamMatrixRows?.length > 0 && (
        <div data-testid="kickoff-confirmed-team-matrix" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Confirmed Team Matrix</div>
              <div className="font-serif text-lg leading-tight">Director-selected roster persisted to project state and kickoff charter.</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {flow.confirmedTeamMatrixRows.filter(row => row.inProjectState && row.inKickoffCharter).length}/{flow.confirmedTeamMatrixRows.length} confirmed
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {flow.confirmedTeamMatrixRows.map(row => (
              <div key={`confirmed-team-${row.id}`} data-testid={`kickoff-confirmed-team-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-base leading-tight">{row.name}</div>
                    <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.role}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className={`node-status-tag ${row.inProjectState ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Project State</span>
                    <span className={`node-status-tag ${row.inKickoffCharter ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>Charter</span>
                    <span className={`node-status-tag ${row.isLeader ? 'bg-[#8f1e18] text-white' : row.isReviewer ? 'bg-[#59684b] text-white' : 'bg-[#d8c99f] text-[#251b13]'}`}>{row.governanceLabel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {flow.confirmedTeamProofLogIds?.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenTimelineProof(flow.confirmedTeamProofLogIds)}
              className="mt-3 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
            >
              <GitCommit size={10} /> Team timeline proof
            </button>
          )}
        </div>
      )}
      {flow.leaderElectionResolution && (
        <div data-testid="kickoff-leader-election-resolution" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Leader Election Resolution</div>
              <div className="mt-1 font-serif text-base leading-tight">{flow.leaderElectionResolution.selectedLeaderName || flow.confirmedLeaderName}</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                {flow.leaderElectionResolution.candidateCount || flow.leaderCampaignCount} candidates / {flow.leaderElectionResolution.managerConfirmed ? 'manager-confirmed' : 'awaiting confirmation'} / marker {flow.leaderElectionResolution.leaderMarkerPersisted ? 'persisted' : 'pending'}
              </div>
            </div>
            <span className={`node-status-tag ${flow.leaderElectionResolution.managerConfirmed && flow.leaderElectionResolution.leaderMarkerPersisted ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
              {flow.leaderElectionResolution.status || 'leader election'}
            </span>
          </div>
        </div>
      )}
      {flow.roleQuestionResolutions?.length > 0 && (
        <div data-testid="kickoff-role-question-answers" className="mt-4 space-y-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Role Question Answers</div>
          {flow.roleQuestionResolutions.slice(0, 4).map(row => (
            <div key={`role-question-answer-${row.questionId}`} data-testid={`kickoff-role-question-answer-${row.questionId}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.answered ? row.answerText : row.questionText}</div>
                </div>
                <span className={`node-status-tag ${row.answered ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                  {row.answered ? 'Answered' : 'Waiting'}
                </span>
              </div>
              {row.answerIds?.length > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenChatProof(row.answerIds, 'main')}
                  className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                >
                  <MessageSquare size={10} /> Answer proof
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {flow.hearingMatrixRows?.length > 0 && (
        <div data-testid="kickoff-hearing-matrix" className="mt-4 border border-[#d8c99f] bg-[#efe2bd]/45 p-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Kickoff Hearing Matrix</div>
              <div className="font-serif text-lg leading-tight">Every kickoff turn mapped to the Agents who heard it.</div>
            </div>
            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">
              {flow.roleHearingCount + flow.leaderHearingCount} hearing edges
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
            {flow.hearingMatrixRows.slice(0, 8).map(row => {
              const rowProofIds = proofIdsFromRow(row);
              return (
                <div key={`kickoff-hearing-${row.id}`} data-testid={`kickoff-hearing-row-${row.id}`} className="border border-[#d8c99f] bg-[#f7edcf]/70 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                      <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] leading-relaxed">{row.stage}</div>
                    </div>
                    <span className={`node-status-tag ${row.coverageComplete ? 'bg-green-700 text-white' : 'bg-[#b9782b] text-white'}`}>
                      Heard by {row.heardBy?.length || 0}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">
                    Heard By: {row.heardLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChatProof(rowProofIds, row.channelId || 'main')}
                    disabled={!rowProofIds.length}
                    className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                  >
                    <MessageSquare size={10} /> Hearing proof
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {flow.conversationRows?.length > 0 && (
        <div data-testid="kickoff-conversation-flow" className="mt-4 space-y-2">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">Conversation Evidence</div>
          {flow.conversationRows.slice(0, 6).map(row => {
            const rowProofIds = proofIdsFromRow(row);
            return (
              <div key={`kickoff-conversation-${row.id}`} data-testid={`kickoff-conversation-${row.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="font-serif text-base leading-tight">{row.speakerName}</div>
                    <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed break-words">{row.stage} / {row.role || 'kickoff participant'}</div>
                  </div>
                  <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">Heard by {row.heardBy?.length || 0}</span>
                </div>
                <div className="mt-2 font-mono text-[8px] text-[#4d412d] leading-relaxed break-words">{row.text}</div>
                <button
                  type="button"
                  onClick={() => onOpenChatProof(rowProofIds, row.channelId || 'main')}
                  disabled={!rowProofIds.length}
                  className="mt-2 inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                >
                  <MessageSquare size={10} /> Conversation proof
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
