export const MEETING_MAX_PEER_EXCHANGES = 3;

export const MEETING_INTERACTION_INTENTS = [
  'support',
  'challenge',
  'clarify',
  'compete',
  'synthesize',
  'escalate',
  'yield',
];

const CONVERGENCE_INTENTS = new Set(['synthesize', 'escalate', 'yield']);

function selectedSynthesizerId(meeting = {}) {
  const confirmedLeaderId = meeting.leaderElectionResolution?.managerConfirmed
    ? meeting.leaderElectionResolution.selectedLeaderId
    : null;
  return confirmedLeaderId
    || meeting.recommendedLeaderId
    || (meeting.team || []).find((agent) => agent.isLeader || agent.leader)?.id
    || meeting.team?.[0]?.id
    || null;
}

function fallbackSynthesisText(meeting = {}) {
  const chinese = String(meeting.language || '').toLowerCase().startsWith('zh');
  return chinese
    ? '本轮分歧已达上限。我向总监汇报当前共识、分歧与待决问题。'
    : 'This exchange reached its limit. I am reporting the consensus, disagreement, and open question to the Director.';
}

function normalizedIntent(value, fallback = 'clarify') {
  const intent = String(value || '').trim().toLowerCase();
  return MEETING_INTERACTION_INTENTS.includes(intent) ? intent : fallback;
}

function turnSpeakerId(turn = {}) {
  return turn.speakerId || turn.agentId || null;
}

function compactText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function serializedLength(value) {
  return JSON.stringify(value).length;
}

export function buildMeetingContextPacket({
  meeting = {},
  latestDirectorInput = '',
  maxRecentTurns = 6,
  maxCharacters = 7000,
} = {}) {
  const budget = Math.max(800, Number(maxCharacters) || 7000);
  const tightBudget = budget < 1800;
  const transcript = (meeting.transcript || []).filter((turn) => turn?.id && turn?.text);
  const recentSource = transcript.slice(-Math.max(0, Number(maxRecentTurns) || 0));
  const openQuestions = (meeting.roleQuestionResolutions || [])
    .filter((row) => !row.answered)
    .slice(0, tightBudget ? 3 : 6)
    .map((row) => ({
      questionId: row.questionId,
      speakerId: row.speakerId || null,
      questionText: compactText(row.questionText, tightBudget ? 120 : 240),
    }));
  const packet = {
    project: {
      id: meeting.projectId || null,
      name: compactText(meeting.name, tightBudget ? 100 : 180),
      brief: compactText(meeting.brief || meeting.name, tightBudget ? 120 : 360),
      language: meeting.language || 'en',
    },
    latestDirectorInput: compactText(latestDirectorInput, tightBudget ? 100 : 320),
    team: (meeting.team || []).filter((agent) => agent?.id).map((agent) => ({
      id: agent.id,
      name: compactText(agent.name, 80),
      role: compactText(agent.role || agent.title || 'Agent', tightBudget ? 60 : 120),
    })),
    leadership: {
      recommendedLeaderId: meeting.recommendedLeaderId || null,
      selectedLeaderId: meeting.leaderElectionResolution?.managerConfirmed
        ? meeting.leaderElectionResolution.selectedLeaderId
        : null,
      reviewerId: meeting.reviewerId || null,
    },
    discussionState: meeting.discussionState || {
      topicId: `${meeting.id || 'meeting'}_topic`,
      peerExchangeCount: 0,
      status: 'active',
      synthesizerId: selectedSynthesizerId(meeting),
    },
    decisionSummary: compactText(meeting.evidence?.decisionSummary, tightBudget ? 160 : 400),
    risks: (meeting.evidence?.risks || []).slice(0, tightBudget ? 3 : 6)
      .map((risk) => compactText(risk, tightBudget ? 120 : 240)),
    openQuestions,
    recentTurns: [],
    compactedTurnCount: transcript.length,
  };

  for (const turn of recentSource) {
    const compactTurn = {
      id: turn.id,
      speakerId: turnSpeakerId(turn),
      type: turn.type || '',
      text: compactText(turn.text, tightBudget ? 100 : 260),
      replyToTurnId: turn.replyToTurnId || turn.repliesTo || null,
      interactionIntent: turn.interactionIntent || null,
    };
    const candidate = {
      ...packet,
      recentTurns: [...packet.recentTurns, compactTurn],
    };
    if (serializedLength(candidate) > budget) continue;
    packet.recentTurns.push(compactTurn);
  }
  packet.compactedTurnCount = Math.max(0, transcript.length - packet.recentTurns.length);

  return packet;
}

export function normalizeMeetingInteractionChain({
  meeting = {},
  turns = [],
  now = new Date().toISOString(),
  maxPeerExchanges = MEETING_MAX_PEER_EXCHANGES,
} = {}) {
  const team = (meeting.team || []).filter((agent) => agent?.id);
  const teamById = new Map(team.map((agent) => [agent.id, agent]));
  const knownTurns = new Map((meeting.transcript || []).filter((turn) => turn?.id).map((turn) => [turn.id, turn]));
  const lastStoredTurn = [...knownTurns.values()].at(-1) || null;
  const timestamp = Date.parse(now) || Date.now();
  const topicId = meeting.discussionState?.topicId || `${meeting.id || 'meeting'}_topic`;
  const synthesizerId = selectedSynthesizerId(meeting);
  const normalizedTurns = [];
  let peerExchangeCount = 0;
  let droppedTurnCount = 0;
  let converged = false;

  for (const [index, sourceTurn] of (turns || []).entries()) {
    const agentId = turnSpeakerId(sourceTurn);
    const agent = teamById.get(agentId);
    const text = String(sourceTurn?.text || '').trim();
    if (!agent || !text) {
      droppedTurnCount += 1;
      continue;
    }

    const id = sourceTurn.id || `${meeting.id || 'meeting'}_peer_turn_${timestamp}_${index + 1}`;
    const previousPlannedTurn = normalizedTurns.at(-1) || null;
    const replyToTurnId = sourceTurn.replyToTurnId
      || sourceTurn.repliesTo
      || previousPlannedTurn?.id
      || lastStoredTurn?.id
      || null;
    const parent = replyToTurnId
      ? knownTurns.get(replyToTurnId) || normalizedTurns.find((turn) => turn.id === replyToTurnId)
      : null;
    if (replyToTurnId && !parent) {
      droppedTurnCount += 1;
      continue;
    }

    const parentSpeakerId = turnSpeakerId(parent);
    let interactionIntent = normalizedIntent(
      sourceTurn.interactionIntent,
      previousPlannedTurn ? 'clarify' : sourceTurn.type === 'leader-campaign' ? 'compete' : 'clarify',
    );
    if (parentSpeakerId === agentId && !CONVERGENCE_INTENTS.has(interactionIntent)) {
      droppedTurnCount += 1;
      continue;
    }

    const isPeerResponse = Boolean(previousPlannedTurn && replyToTurnId === previousPlannedTurn.id);
    if (isPeerResponse && peerExchangeCount >= Math.max(1, Number(maxPeerExchanges) || MEETING_MAX_PEER_EXCHANGES)) {
      if (agentId !== synthesizerId) {
        droppedTurnCount += 1;
        continue;
      }
      interactionIntent = 'synthesize';
    } else if (isPeerResponse) {
      peerExchangeCount += 1;
    }

    if (CONVERGENCE_INTENTS.has(interactionIntent)) converged = true;
    const targetSpeakerId = sourceTurn.targetSpeakerId
      || (parentSpeakerId && parentSpeakerId !== 'director' ? parentSpeakerId : null);
    const addressedAgentIds = [...new Set([
      ...(Array.isArray(sourceTurn.addressedAgentIds) ? sourceTurn.addressedAgentIds : []),
      targetSpeakerId,
    ].filter((targetId) => targetId && targetId !== agentId && teamById.has(targetId)))];
    const normalizedTurn = {
      ...sourceTurn,
      id,
      agentId,
      speakerId: agentId,
      speaker: sourceTurn.speaker || agent.name,
      role: sourceTurn.role || agent.role || agent.title || 'Agent',
      text: interactionIntent === 'synthesize' && peerExchangeCount >= maxPeerExchanges
        ? fallbackSynthesisText(meeting)
        : text,
      replyToTurnId,
      repliesTo: replyToTurnId,
      targetSpeakerId,
      interactionIntent,
      topicId,
      exchangeIndex: isPeerResponse ? Math.min(peerExchangeCount, maxPeerExchanges) : 0,
      addressedAgentIds,
      createdAt: sourceTurn.createdAt || now,
    };
    normalizedTurns.push(normalizedTurn);
    knownTurns.set(id, normalizedTurn);
  }

  if (peerExchangeCount >= maxPeerExchanges && !converged && synthesizerId) {
    const parent = normalizedTurns.at(-1);
    const synthesizer = teamById.get(synthesizerId);
    if (parent && synthesizer) {
      const id = `${meeting.id || 'meeting'}_peer_turn_${timestamp}_${(turns || []).length + 1}`;
      normalizedTurns.push({
        id,
        agentId: synthesizerId,
        speakerId: synthesizerId,
        speaker: synthesizer.name,
        role: synthesizer.role || synthesizer.title || 'Agent',
        type: 'meeting-synthesis',
        stage: 'meeting-convergence',
        text: fallbackSynthesisText(meeting),
        replyToTurnId: parent.id,
        repliesTo: parent.id,
        targetSpeakerId: parent.speakerId === synthesizerId ? null : parent.speakerId,
        interactionIntent: 'synthesize',
        topicId,
        exchangeIndex: peerExchangeCount,
        addressedAgentIds: parent.speakerId === synthesizerId ? [] : [parent.speakerId],
        createdAt: now,
      });
      converged = true;
    }
  }

  return {
    turns: normalizedTurns,
    state: {
      topicId,
      peerExchangeCount,
      status: converged ? 'converged' : 'active',
      synthesizerId,
      droppedTurnCount,
    },
  };
}
