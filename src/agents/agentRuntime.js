import {
  buildSkillRoomReply,
  createRoundtablePlan,
  describeSkillIntent,
  getPersonSkill,
} from '../skills/personSkillSystem.js';

export const DIRECTOR_AGENT_ID = 'director';

const ROLE_PATTERNS = [
  { test: /manager|lead|founder|steward|driver|vision|strategy/i, capability: 'orchestration' },
  { test: /tech|engineer|architect|system|research|rd/i, capability: 'implementation' },
  { test: /design|ux|product|vision/i, capability: 'product' },
  { test: /review|evidence|quality|risk|security|market/i, capability: 'review' },
];

const FALLBACK_INTENTS = {
  orchestration: 'scope, owners, sequence',
  implementation: 'system boundary and execution path',
  product: 'user experience and product clarity',
  review: 'risk, evidence, and tradeoffs',
};

const WORK_ROUTINES = {
  orchestration: {
    id: 'orchestration-routine',
    label: 'Coordination routine',
    checklist: ['refresh ownership map', 'scan dependencies', 'sequence next handoff', 'publish decision delta'],
    artifact: 'coordination ledger update',
  },
  implementation: {
    id: 'implementation-routine',
    label: 'Implementation routine',
    checklist: ['inspect task boundary', 'change code or contract', 'record integration risk', 'publish runnable evidence'],
    artifact: 'implementation progress note',
  },
  product: {
    id: 'product-routine',
    label: 'Product routine',
    checklist: ['inspect user flow', 'tighten interaction copy', 'remove friction', 'publish UX evidence'],
    artifact: 'product flow update',
  },
  review: {
    id: 'review-routine',
    label: 'Review routine',
    checklist: ['check acceptance bar', 'challenge risk', 'verify evidence', 'publish verdict'],
    artifact: 'review evidence note',
  },
  generalist: {
    id: 'generalist-routine',
    label: 'General execution routine',
    checklist: ['read latest state', 'pick next obligation', 'publish useful progress', 'surface blocker'],
    artifact: 'work progress note',
  },
};

export const MEETING_PROTOCOLS = {
  kickoff: {
    id: 'kickoff',
    label: 'Project kickoff',
    leadFrame: ['goal', 'scope', 'owners', 'first-cycle deadline', 'decision log'],
    memberFrame: ['role', 'first artifact', 'dependency', 'risk', 'deadline'],
    output: 'charter',
  },
  sync: {
    id: 'sync',
    label: 'Recurring sync',
    leadFrame: ['progress map', 'blockers', 'deadline pressure', 'decision queue'],
    memberFrame: ['done', 'doing', 'blocked-by', 'next-delivery', 'confidence'],
    output: 'status ledger',
  },
  review: {
    id: 'review',
    label: 'Review',
    leadFrame: ['review target', 'acceptance bar', 'open risks', 'owner fixes'],
    memberFrame: ['finding', 'evidence', 'severity', 'fix owner', 'verification'],
    output: 'review verdict',
  },
  working: {
    id: 'working',
    label: 'Working discussion',
    leadFrame: ['current objective', 'coordination need', 'handoff point'],
    memberFrame: ['signal', 'interpretation', 'action', 'request'],
    output: 'work notes',
  },
};

const DEFAULT_PROTOCOL_ID = 'working';

const WORK_CADENCE = {
  hourly: {
    id: 'hourly',
    horizonHours: 1,
    speakThreshold: 70,
    frame: ['last observable change', 'current task', 'blocked signal', 'next hour'],
  },
  daily: {
    id: 'daily',
    horizonHours: 24,
    speakThreshold: 52,
    frame: ['completed', 'planned', 'deadline', 'risks', 'requests'],
  },
};

const MESSAGE_WEIGHTS = {
  decision: 100,
  mention: 88,
  blocker: 86,
  handoff: 78,
  update: 56,
  note: 32,
};

const CAPABILITY_KEYWORDS = {
  orchestration: /scope|owner|timeline|deadline|sequence|decision|roadmap|priority|milestone|分工|负责人|期限|决策|排期|里程碑/i,
  implementation: /api|backend|frontend|code|runtime|architecture|schema|deploy|bug|工程|代码|后端|前端|架构|接口|部署/i,
  product: /user|ux|flow|interface|experience|copy|prototype|用户|体验|界面|流程|原型|产品/i,
  review: /risk|evidence|test|quality|security|review|verify|风险|证据|测试|质量|安全|复核|验证/i,
  generalist: /./i,
};

function nowIso() {
  return new Date().toISOString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getMeetingProtocol(type = DEFAULT_PROTOCOL_ID) {
  return MEETING_PROTOCOLS[type] || MEETING_PROTOCOLS[DEFAULT_PROTOCOL_ID];
}

function getCadence(cadence = 'hourly') {
  return WORK_CADENCE[cadence] || WORK_CADENCE.hourly;
}

function hasCapabilitySignal(agent, text = '') {
  return (agent.capabilities || ['generalist']).some((capability) => (
    CAPABILITY_KEYWORDS[capability] || CAPABILITY_KEYWORDS.generalist
  ).test(text));
}

function messageWeight(message = {}) {
  const base = MESSAGE_WEIGHTS[message.kind] || MESSAGE_WEIGHTS[message.type] || MESSAGE_WEIGHTS.note;
  const targetBoost = message.targetIds?.length ? 18 : 0;
  return Math.min(100, base + targetBoost);
}

function frameSentence(frame = []) {
  return frame.map((item) => item.replace(/-/g, ' ')).join(' / ');
}

function reasonLabels(reasons = {}) {
  return [
    reasons.directMention ? 'direct mention' : null,
    reasons.fromLead ? 'lead broadcast' : null,
    reasons.fromManagedPeer ? 'managed peer' : null,
    reasons.capabilityMatch ? 'capability match' : null,
  ].filter(Boolean);
}

function capabilityFor(agent) {
  const text = `${agent.role || ''} ${agent.skill || ''} ${agent.title || ''}`;
  const hits = ROLE_PATTERNS.filter(({ test }) => test.test(text)).map(({ capability }) => capability);
  return hits.length ? unique(hits) : ['generalist'];
}

function managementScore(agent) {
  const text = `${agent.role || ''} ${agent.skill || ''} ${agent.title || ''}`;
  let score = 0;
  if (/manager|lead|founder|steward|driver/i.test(text)) score += 40;
  if (/strategy|vision|product/i.test(text)) score += 20;
  if (/review|evidence|risk|quality/i.test(text)) score += 16;
  const skill = getPersonSkill(agent.id);
  if (skill) score += skill.scores.leadership * 0.22 + skill.scores.initiative * 0.16 + skill.scores.collaboration * 0.12;
  return score;
}

function normalizeAgent(agent, index = 0) {
  const skill = getPersonSkill(agent.id);
  return {
    ...agent,
    id: agent.id,
    name: agent.name,
    role: agent.role || agent.title || 'Agent',
    slug: skill?.slug || agent.id,
    capabilities: capabilityFor(agent),
    autonomy: {
      canInitiate: true,
      canReviewPeers: true,
      canEscalateToDirector: true,
    },
    mind: {
      currentGoal: null,
      obligations: [],
      inboxCursor: null,
      workingMemory: [],
      confidence: 0.72,
      attentionPolicy: {
        directMention: 100,
        managedPeer: 82,
        capabilityMatch: 72,
        leadBroadcast: 64,
        ambient: 35,
      },
    },
    state: {
      status: 'idle',
      load: 0,
      order: index,
      lastEventAt: null,
    },
  };
}

function chooseGovernance(agents, taskText = '') {
  const skillPlan = createRoundtablePlan(agents.map((agent) => agent.id), taskText);
  const rankedByManagement = [...agents].sort((a, b) => managementScore(b) - managementScore(a));
  const explicitLead = agents.find((agent) => agent.isLeader);
  const lead = explicitLead
    || (skillPlan.lead ? agents.find((agent) => agent.id === skillPlan.lead.slug) : null)
    || rankedByManagement[0];
  const reviewer = skillPlan.reviewer
    ? agents.find((agent) => agent.id === skillPlan.reviewer.slug && agent.id !== lead?.id)
    : rankedByManagement.find((agent) => agent.id !== lead?.id);

  const edges = [];
  if (lead) {
    agents
      .filter((agent) => agent.id !== lead.id)
      .forEach((agent) => edges.push({ from: lead.id, to: agent.id, type: 'coordinates' }));
  }
  if (reviewer && lead) {
    edges.push({ from: reviewer.id, to: lead.id, type: 'reviews' });
  }

  return { lead, reviewer, edges, skillPlan };
}

export function createAgentNetwork(team = [], context = {}) {
  const agents = team.map(normalizeAgent);
  const governance = chooseGovernance(agents, context.topic || context.directive || '');
  const managedBy = new Map();
  const manages = new Map();

  governance.edges.forEach((edge) => {
    if (edge.type !== 'coordinates') return;
    managedBy.set(edge.to, edge.from);
    manages.set(edge.from, [...(manages.get(edge.from) || []), edge.to]);
  });

  return {
    id: context.projectId || `network_${Date.now()}`,
    topic: context.topic || '',
    agents: agents.map((agent) => ({
      ...agent,
      managerId: managedBy.get(agent.id) || null,
      managedIds: manages.get(agent.id) || [],
      peerIds: agents.filter((peer) => peer.id !== agent.id).map((peer) => peer.id),
    })),
    governance,
    createdAt: nowIso(),
  };
}

function getAgent(network, id) {
  return network.agents.find((agent) => agent.id === id) || null;
}

function getLead(network) {
  return network.governance.lead ? getAgent(network, network.governance.lead.id) : network.agents[0] || null;
}

function getReviewer(network) {
  return network.governance.reviewer ? getAgent(network, network.governance.reviewer.id) : null;
}

function fallbackIntent(agent, index = 0) {
  const capability = agent.capabilities[0] || 'generalist';
  return FALLBACK_INTENTS[capability] || (index === 0 ? 'first response' : 'peer contribution');
}

function workRoutineForAgent(agent = {}) {
  const capability = (agent.capabilities || []).find((item) => WORK_ROUTINES[item]) || 'generalist';
  const routine = WORK_ROUTINES[capability] || WORK_ROUTINES.generalist;
  return {
    ...routine,
    capability,
    checklist: [...routine.checklist],
  };
}

function buildFallbackReply(agent, directive = '', context = {}) {
  const leadName = context.lead?.id === agent.id ? 'I will coordinate the board' : `I will sync through ${context.lead?.name || 'the lead'}`;
  const reviewerName = context.reviewer?.id === agent.id ? 'and I will run the review loop' : `with ${context.reviewer?.name || 'the reviewer'} checking risk`;
  const focus = context.intent?.target || fallbackIntent(agent);
  const directiveText = directive ? ` On "${directive.slice(0, 96)}",` : '';
  const protocol = getMeetingProtocol(context.meetingType);
  const frame = context.isLead ? protocol.leadFrame : protocol.memberFrame;
  return `${leadName}; ${reviewerName}.${directiveText} my lane is ${focus}. Frame: ${frameSentence(frame)}. Next I will turn this into one owner, one artifact, and one decision checkpoint.`;
}

function buildAgentReply(agent, directive = '', context = {}) {
  const skill = getPersonSkill(agent.id);
  if (!skill) return buildFallbackReply(agent, directive, context);
  const reply = buildSkillRoomReply(agent.id, directive, context.intent || {});
  if (!reply) return buildFallbackReply(agent, directive, context);
  const protocol = getMeetingProtocol(context.meetingType);
  const frame = context.isLead ? protocol.leadFrame : protocol.memberFrame;
  const managedNames = (agent.managedIds || [])
    .map((id) => getAgent(context.network, id)?.name)
    .filter(Boolean);
  const managementLine = managedNames.length
    ? ` I will coordinate ${managedNames.join(', ')} and keep the decision path explicit.`
    : '';
  return `${reply}${managementLine} Frame: ${frameSentence(frame)}.`;
}

function buildIntentions(network, directive = '') {
  const plan = network.governance.skillPlan;
  const taskMatches = new Map(plan.taskMatches.map((item, index) => [item.skill.slug, { ...item, index }]));
  const firstSpeakerRank = new Map(plan.firstSpeakers.map((skill, index) => [skill.slug, index]));

  return network.agents.map((agent, index) => {
    const skill = getPersonSkill(agent.id);
    const match = taskMatches.get(agent.id);
    const speakerRank = firstSpeakerRank.has(agent.id) ? firstSpeakerRank.get(agent.id) : 99;
    const fallbackScore = 4 + Math.max(0, 4 - index);
    const score = skill
      ? Math.max(5, Math.min(10, Math.round((match?.score || 0) / 18) + 5 - Math.min(speakerRank, 2)))
      : fallbackScore;

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      target: skill ? describeSkillIntent(agent.id, directive, plan) : fallbackIntent(agent, index),
      origin: directive.slice(0, 28) || 'director directive',
      score,
      rank: match?.index ?? 99,
      speakerRank,
      wait: index + 1,
      status: 'queued',
      managerId: agent.managerId,
      managedIds: agent.managedIds,
    };
  }).sort((a, b) => a.speakerRank - b.speakerRank || b.score - a.score || a.rank - b.rank || a.wait - b.wait);
}

function selectTargets(network, targetIds = [], directive = '') {
  if (targetIds.length) {
    return targetIds.map((id) => getAgent(network, id)).filter(Boolean);
  }
  const intentions = buildIntentions(network, directive);
  const selectedIds = intentions.slice(0, Math.min(3, Math.max(1, intentions.length))).map((intent) => intent.id);
  return selectedIds.map((id) => getAgent(network, id)).filter(Boolean);
}

export function startAgentSession(team = [], context = {}) {
  const network = createAgentNetwork(team, context);
  const facilitator = getLead(network);
  const reviewer = getReviewer(network);
  const protocol = getMeetingProtocol(context.meetingType || 'kickoff');
  const openingText = facilitator
    ? `${facilitator.name} is coordinating this ${protocol.label}. ${reviewer ? `${reviewer.name} is assigned as reviewer. ` : ''}Every agent will speak through this frame: ${frameSentence(protocol.memberFrame)}. What is the primary directive?`
    : 'Agent network is online. What is the primary directive?';

  return {
    network,
    protocol,
    events: [
      { kind: 'system', text: `AGENT NETWORK ONLINE: ${context.projectName || 'Untitled Project'}` },
      facilitator ? { kind: 'agent', agent: facilitator, text: openingText } : null,
    ].filter(Boolean),
  };
}

export function routeDirectorDirective({ team = [], directive = '', targetIds = [], context = {} }) {
  const network = createAgentNetwork(team, { ...context, directive, topic: directive });
  const targets = selectTargets(network, targetIds, directive);
  const targetNames = targets.length ? targets.map((agent) => agent.name.toUpperCase()) : ['ALL'];
  const intentions = buildIntentions(network, directive);
  const intentById = new Map(intentions.map((intent) => [intent.id, intent]));
  const protocol = getMeetingProtocol(context.meetingType);
  const lead = getLead(network);
  const reviewer = getReviewer(network);

  const replies = targets.map((agent, index) => ({
    kind: 'agent',
    agent,
    text: buildAgentReply(agent, directive, {
      network,
      lead,
      reviewer,
      intent: intentById.get(agent.id),
      isLead: lead?.id === agent.id,
      meetingType: protocol.id,
    }),
    delayMs: 1300 + index * 900,
  }));

  const coordination = lead && reviewer && !targets.some((agent) => agent.id === lead.id)
    ? [{
      kind: 'agent',
      agent: lead,
      text: `${reviewer.name}, please review the risk surface after the first pass. I will keep ownership, deadlines, and the ${protocol.output} visible.`,
      delayMs: 1300 + replies.length * 900,
      relation: { to: reviewer.id, type: 'delegates-review' },
    }]
    : [];

  return {
    network,
    protocol,
    targetNames,
    events: [
      { kind: 'director', text: directive, targetNames },
      ...replies,
      ...coordination,
    ],
  };
}

export function runRoundtableExchange(team = [], directive = '', context = {}) {
  const network = createAgentNetwork(team, { ...context, directive, topic: directive });
  const intentions = buildIntentions(network, directive);
  const intentById = new Map(intentions.map((intent) => [intent.id, intent]));
  const speakers = intentions.slice(0, Math.min(3, intentions.length));
  const protocol = getMeetingProtocol(context.meetingType || 'sync');
  const lead = getLead(network);
  const reviewer = getReviewer(network);

  return {
    network,
    protocol,
    intentions,
    responses: speakers.map((intent, index) => {
      const agent = getAgent(network, intent.id);
      return {
        id: `${intent.id}_${Date.now()}_${index}`,
        speakerId: intent.id,
        speaker: intent.name,
        role: intent.role,
        score: intent.score,
        delayMs: 650 + index * 1450,
        text: buildAgentReply(agent, directive, {
          network,
          lead,
          reviewer,
          intent: intentById.get(intent.id),
          isLead: lead?.id === agent.id,
          meetingType: protocol.id,
        }),
      };
    }),
  };
}

export function buildAgentChatReplies({ team = [], text = '', targets = [], channelId = 'main', context = {} }) {
  const normalizedTargets = targets.map((target) => target.toLowerCase());
  const explicitAll = normalizedTargets.includes('all');
  const targetIds = explicitAll
    ? team.map((agent) => agent.id)
    : team
      .filter((agent) => normalizedTargets.includes(agent.name.toLowerCase()) || normalizedTargets.includes(agent.id.toLowerCase()))
      .map((agent) => agent.id);
  const processed = processWorkCommunication({
    team,
    message: {
      id: `chat_${Date.now()}`,
      authorId: DIRECTOR_AGENT_ID,
      kind: targetIds.length ? 'mention' : 'update',
      text,
      targetIds,
    },
    context: {
      ...context,
      meetingType: 'working',
      maxSpeakers: explicitAll ? 3 : Math.max(1, targetIds.length || 2),
    },
  });

  return processed.utterances.map((utterance, index) => {
    const agent = processed.network.agents.find((item) => item.id === utterance.agentId);
    const reading = processed.readings.find((item) => item.agentId === utterance.agentId);
    return {
      id: `agent_chat_${Date.now()}_${index}`,
      channelId,
      type: utterance.obligationCount ? 'mention' : 'text',
      author: agent?.name || utterance.agentId,
      role: agent?.role || 'Agent',
      time: 'Now',
      text: utterance.text,
      targets: utterance.obligationCount ? [DIRECTOR_AGENT_ID] : [],
      weight: utterance.obligationCount ? 'Obligation' : null,
      diagnostics: reading ? {
        attentionScore: reading.score,
        reasons: reasonLabels(reading.reasons),
        obligationCount: reading.obligations.length,
        decision: reading.shouldSpeak ? 'speak' : reading.shouldRead ? 'read' : 'ignore',
      } : null,
    };
  });
}

export function readCommunication(agent, message = {}, network = null) {
  const targetIds = message.targetIds || message.targets || [];
  const text = message.text || '';
  const fromLead = network?.governance?.lead?.id && message.authorId === network.governance.lead.id;
  const fromManagedPeer = network && (agent.managedIds || []).includes(message.authorId);
  const directMention = targetIds.includes(agent.id)
    || targetIds.includes(agent.name)
    || text.toLowerCase().includes(`@${agent.name.toLowerCase()}`)
    || text.toLowerCase().includes(`@${agent.id.toLowerCase()}`);
  const capabilityMatch = hasCapabilitySignal(agent, text);
  const relationScore = directMention
    ? agent.mind.attentionPolicy.directMention
    : fromManagedPeer
      ? agent.mind.attentionPolicy.managedPeer
      : fromLead
        ? agent.mind.attentionPolicy.leadBroadcast
        : capabilityMatch
          ? agent.mind.attentionPolicy.capabilityMatch
          : agent.mind.attentionPolicy.ambient;
  const score = Math.min(100, Math.round((relationScore * 0.62) + (messageWeight(message) * 0.38)));

  const obligations = [];
  if (directMention || /please|need|owner|负责|需要|请|交付|deadline|期限/i.test(text)) {
    obligations.push({
      kind: /review|risk|复核|风险|验证/i.test(text) ? 'review' : 'action',
      sourceMessageId: message.id || null,
      ownerId: agent.id,
      due: message.due || null,
      status: 'open',
    });
  }
  if (/blocked|blocker|阻塞|卡住|依赖/i.test(text)) {
    obligations.push({
      kind: 'unblock',
      sourceMessageId: message.id || null,
      ownerId: agent.managerId || agent.id,
      due: message.due || null,
      status: 'open',
    });
  }

  return {
    agentId: agent.id,
    messageId: message.id || null,
    score,
    shouldRead: score >= 45,
    shouldSpeak: directMention || score >= 72,
    decision: directMention || score >= 72 ? 'speak' : score >= 45 ? 'read' : 'ignore',
    explanation: reasonLabels({
      directMention,
      fromLead: Boolean(fromLead),
      fromManagedPeer: Boolean(fromManagedPeer),
      capabilityMatch,
    }).join(', ') || 'ambient low-priority signal',
    reasons: {
      directMention,
      fromLead: Boolean(fromLead),
      fromManagedPeer: Boolean(fromManagedPeer),
      capabilityMatch,
    },
    obligations,
  };
}

export function planAgentUtterance(agent, reading, context = {}) {
  const protocol = getMeetingProtocol(context.meetingType);
  const cadence = context.cadence ? getCadence(context.cadence) : null;
  const frame = cadence?.frame || (context.isLead ? protocol.leadFrame : protocol.memberFrame);
  const text = reading?.shouldSpeak
    ? `${agent.name}: I read this as ${frameSentence(frame)}. I will ${reading.obligations?.length ? 'take the open obligation and report back with evidence' : 'respond only where my lane changes the plan'}.`
    : `${agent.name}: noted; no interruption unless the owner or deadline changes.`;

  return {
    agentId: agent.id,
    kind: reading?.shouldSpeak ? 'reply' : 'silent-read',
    frame,
    text,
    obligationCount: reading?.obligations?.length || 0,
  };
}

export function processWorkCommunication({ team = [], message = {}, context = {} }) {
  const network = createAgentNetwork(team, {
    ...context,
    topic: message.text || context.topic || '',
  });
  const lead = getLead(network);

  const readings = network.agents.map((agent) => readCommunication(agent, message, network));
  const utterances = readings
    .filter((reading) => reading.shouldSpeak)
    .sort((a, b) => b.score - a.score)
    .slice(0, context.maxSpeakers || 3)
    .map((reading) => {
      const agent = getAgent(network, reading.agentId);
      return planAgentUtterance(agent, reading, {
        ...context,
        isLead: lead?.id === agent.id,
      });
    });

  return {
    network,
    readings,
    utterances,
    obligations: readings.flatMap((reading) => reading.obligations),
    diagnostics: readings.map((reading) => ({
      agentId: reading.agentId,
      messageId: reading.messageId,
      attentionScore: reading.score,
      decision: reading.decision,
      explanation: reading.explanation,
      obligationCount: reading.obligations.length,
    })),
  };
}

function agentWorkPriority(agent, context = {}) {
  const taskText = `${context.projectName || ''} ${context.topic || ''} ${context.currentObjective || ''}`;
  let score = hasCapabilitySignal(agent, taskText) ? 72 : 46;
  if (agent.managerId) score += 4;
  if (context.blockers?.some((blocker) => blocker.ownerId === agent.id || blocker.targetIds?.includes(agent.id))) score += 18;
  if (context.deadlines?.some((deadline) => deadline.ownerId === agent.id)) score += 12;
  return Math.min(100, score);
}

export function planAutonomousWorkCycle({ team = [], project = {}, cadence = 'hourly', messages = [], now = nowIso() }) {
  const cadenceProfile = getCadence(cadence);
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: project.objective || project.name || '',
  });
  const lead = getLead(network);
  const reviewer = getReviewer(network);

  const agentPlans = network.agents.map((agent) => {
    const routine = workRoutineForAgent(agent);
    const readings = messages.map((message) => readCommunication(agent, message, network));
    const obligations = readings.flatMap((reading) => reading.obligations);
    const priority = agentWorkPriority(agent, {
      projectName: project.name,
      topic: project.objective,
      currentObjective: project.currentObjective,
      blockers: project.blockers || [],
      deadlines: project.deadlines || [],
    });
    const shouldPublish = priority >= cadenceProfile.speakThreshold
      || obligations.length > 0
      || lead?.id === agent.id
      || (cadence === 'daily' && reviewer?.id === agent.id);

    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      managerId: agent.managerId,
      managedIds: agent.managedIds,
      cadence,
      priority,
      reads: readings.filter((reading) => reading.shouldRead).length,
      obligations,
      privateWork: {
        focus: fallbackIntent(agent),
        horizonHours: cadenceProfile.horizonHours,
        evidenceRequired: agent.capabilities.includes('review') || reviewer?.id === agent.id,
        routine,
      },
      publish: shouldPublish
        ? {
          kind: cadence === 'daily' ? 'daily-report' : 'work-pulse',
          frame: cadenceProfile.frame,
          channel: lead?.id === agent.id ? 'project-ledger' : 'team-worklog',
          routine,
          text: `${agent.name}: ${routine.label}; ${routine.checklist.join(' -> ')}. Owner=${agent.name}; manager=${agent.managerId ? getAgent(network, agent.managerId)?.name : 'self'}; artifact=${routine.artifact}; next horizon=${cadenceProfile.horizonHours}h.`,
        }
        : null,
    };
  });
  const communicationDiagnostics = messages.flatMap((message) => (
    network.agents.map((agent) => {
      const reading = readCommunication(agent, message, network);
      return {
        messageId: message.id || null,
        agentId: agent.id,
        attentionScore: reading.score,
        decision: reading.decision,
        explanation: reading.explanation,
        obligationCount: reading.obligations.length,
      };
    })
  ));

  const leadPlan = lead
    ? {
      agentId: lead.id,
      kind: 'coordination',
      text: `${lead.name}: consolidate work pulses, resolve cross-agent dependencies, and escalate only decisions that need Director judgment.`,
      watches: network.agents.filter((agent) => agent.id !== lead.id).map((agent) => agent.id),
    }
    : null;

  return {
    network,
    cadence,
    now,
    leadPlan,
    agentPlans,
    communicationDiagnostics,
    events: [
      leadPlan,
      ...agentPlans.map((plan) => plan.publish).filter(Boolean),
    ].filter(Boolean),
  };
}

function updateAgentStates({ project = {}, cycle, messages = [], tasks = [], logs = [], now = nowIso(), cadence = 'hourly', cycleId = '' }) {
  const previousStates = project.agentStates || {};
  return Object.fromEntries(cycle.network.agents.map((agent) => {
    const previous = previousStates[agent.id] || {};
    const plan = cycle.agentPlans.find((item) => item.agentId === agent.id);
    const assignedTasks = tasks.filter((task) => (
      task.ownerId === agent.id
      || task.assignee === agent.id
      || task.assignee === agent.name
    ));
    const diagnostics = (cycle.communicationDiagnostics || [])
      .filter((item) => item.agentId === agent.id && (item.decision !== 'ignore' || item.obligationCount > 0));
    const inboxItems = diagnostics.map((item, index) => {
      const source = messages.find((message) => message.id === item.messageId);
      return {
        id: `${cycleId}_inbox_${agent.id}_${index}`,
        messageId: item.messageId,
        from: source?.authorId || source?.author || 'unknown',
        decision: item.decision,
        attentionScore: item.attentionScore,
        explanation: item.explanation,
        obligationCount: item.obligationCount,
        receivedAt: now,
      };
    });
    const worklogItems = logs
      .filter((log) => log.agentId === agent.id || log.agent === agent.name)
      .map((log) => ({
        id: log.id,
        time: log.time,
        kind: log.eventType || log.cadence || 'worklog',
        text: log.log,
      }));
    const obligations = [
      ...(plan?.obligations || []).map((obligation, index) => ({
        ...obligation,
        id: obligation.id || `${cycleId}_obligation_${agent.id}_${index}`,
        openedAt: now,
      })),
      ...(previous.obligations || []).filter((obligation) => obligation.status === 'open'),
    ].slice(0, 20);
    const status = assignedTasks.some((task) => task.status === 'blocked')
      ? 'blocked'
      : plan?.publish
        ? 'publishing'
        : assignedTasks.some((task) => task.status === 'pending' || task.status === 'in-progress')
          ? 'working'
          : 'monitoring';

    return [agent.id, {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      managerId: agent.managerId,
      managedIds: agent.managedIds || [],
      peerManagedIds: previous.peerManagedIds || [],
      peerManagerId: previous.peerManagerId || null,
      peerManagerIds: previous.peerManagerIds || [],
      peerIds: agent.peerIds || [],
      status,
      currentPlan: {
        cadence,
        priority: plan?.priority || 0,
        focus: plan?.privateWork?.focus || fallbackIntent(agent),
        horizonHours: plan?.privateWork?.horizonHours || getCadence(cadence).horizonHours,
        publishChannel: plan?.publish?.channel || null,
        evidenceRequired: Boolean(plan?.privateWork?.evidenceRequired),
        routine: plan?.privateWork?.routine || workRoutineForAgent(agent),
      },
      taskIds: assignedTasks.map((task) => task.id).filter(Boolean),
      inbox: [...inboxItems, ...(previous.inbox || [])].slice(0, 20),
      obligations,
      worklog: [...worklogItems, ...(previous.worklog || [])].slice(0, 20),
      lastActiveAt: (plan?.publish || inboxItems.length || worklogItems.length) ? now : previous.lastActiveAt || null,
    }];
  }));
}

export function advanceAutonomousProjectCycle({ project = {}, team = project.team || [], cadence = 'hourly', messages = [], now = nowIso() }) {
  const cycle = planAutonomousWorkCycle({ team, project, cadence, messages, now });
  const progressDelta = cadence === 'daily' ? 4 : 1;
  const publishEvents = cycle.events.filter((event) => event.text);
  const cycleId = `cycle_${cadence}_${Date.parse(now) || Date.now()}`;
  const nextLogs = publishEvents.map((event) => {
    const agent = cycle.network.agents.find((item) => item.id === event.agentId);
    return {
      id: `${cycleId}_${event.agentId || event.kind || 'event'}`,
      time: now,
      agent: agent?.name || 'Agent Runtime',
      log: event.text,
      cadence,
      eventType: event.kind || 'work-cycle',
    };
  });
  const completedTaskLogs = [];
  const completionThreshold = cadence === 'daily' ? 1 : 3;
  const nextTasks = (project.tasks || []).map((task) => {
    if (task.status === 'done') return task;
    const ownerPlan = cycle.agentPlans.find((plan) => plan.name === task.assignee || plan.agentId === task.assignee);
    if (!ownerPlan) return task;
    const workPulseCount = (task.workPulseCount || 0) + (ownerPlan.publish ? 1 : 0);
    const nextStatus = ownerPlan.obligations.length
      ? 'blocked'
      : workPulseCount >= completionThreshold
        ? 'done'
        : task.status === 'pending'
          ? 'in-progress'
          : task.status;
    if (nextStatus === 'done' && task.status !== 'done') {
      completedTaskLogs.push({
        id: `${cycleId}_task_${task.id || completedTaskLogs.length}`,
        time: now,
        agent: ownerPlan.name,
        agentId: ownerPlan.agentId,
        log: `${ownerPlan.name} completed "${task.text}" and published the result to the project timeline.`,
        cadence,
        eventType: 'task-completed',
        taskId: task.id || null,
      });
    }
    return {
      ...task,
      status: nextStatus,
      lastTouchedAt: now,
      workPulseCount,
      completedAt: nextStatus === 'done' ? now : task.completedAt,
    };
  });
  const combinedLogs = [...completedTaskLogs, ...nextLogs];
  const nextAgentStates = updateAgentStates({
    project,
    cycle,
    messages,
    tasks: nextTasks,
    logs: combinedLogs,
    now,
    cadence,
    cycleId,
  });

  return {
    cycle: {
      ...cycle,
      taskCompletionEvents: completedTaskLogs,
      agentStates: nextAgentStates,
    },
    project: {
      ...project,
      progress: Math.min(100, (project.progress || 0) + (publishEvents.length ? progressDelta : 0) + (completedTaskLogs.length * 2)),
      tasks: nextTasks,
      logs: [...combinedLogs, ...(project.logs || [])],
      agentStates: nextAgentStates,
      autonomousLedger: [
        {
          id: cycleId,
          cadence,
          ranAt: now,
          leadId: cycle.leadPlan?.agentId || null,
          publishedEventCount: publishEvents.length,
          agentPlans: cycle.agentPlans.map((plan) => ({
            agentId: plan.agentId,
            priority: plan.priority,
            readCount: plan.reads,
            obligationCount: plan.obligations.length,
            published: Boolean(plan.publish),
            channel: plan.publish?.channel || null,
            status: nextAgentStates[plan.agentId]?.status || 'unknown',
            routineId: plan.privateWork?.routine?.id || null,
            routineLabel: plan.privateWork?.routine?.label || null,
            routineArtifact: plan.privateWork?.routine?.artifact || null,
            routineChecklist: plan.privateWork?.routine?.checklist || [],
          })),
          communicationDiagnostics: (cycle.communicationDiagnostics || [])
            .filter((item) => item.decision !== 'ignore' || item.obligationCount > 0)
            .slice(0, 24),
        },
        ...(project.autonomousLedger || []),
      ].slice(0, 50),
      lastAutonomousRunAt: now,
      autonomousCadence: cadence,
    },
  };
}

export function createAutonomousCycleChatMessages({ project = {}, cycle = {}, cadence = cycle.cadence || 'hourly', projectId = project.id } = {}) {
  const team = project.team || cycle.network?.agents || [];
  const cycleTime = cycle.now || cycle.ranAt || nowIso();
  const timestamp = Date.parse(cycleTime) || Date.now();
  const cycleEvents = [
    ...(cycle.events || []),
    ...(cycle.taskCompletionEvents || []).map((event) => ({
      ...event,
      kind: 'task-completed',
      text: event.log || event.text,
    })),
  ].filter((event) => event?.text);

  return cycleEvents.slice(0, 8).map((event, index) => {
    const agent = team.find((item) => item.id === event.agentId || item.name === event.agent);
    return {
      id: `auto_${projectId || 'project'}_${timestamp}_${index}`,
      projectId: projectId || project.id || null,
      channelId: 'main',
      type: event.kind === 'coordination' ? 'decision' : 'progress',
      author: agent?.name || event.agent || 'Agent Runtime',
      role: agent?.role || 'Autonomy',
      time: event.kind === 'task-completed' ? 'Completed' : cadence === 'daily' ? 'Daily' : 'Hourly',
      text: event.text,
      decisionId: event.kind === 'coordination' ? `AUTO-${String(timestamp).slice(-4)}` : undefined,
      autonomous: {
        cadence,
        kind: event.kind || 'work-cycle',
        cycleId: cycle.id || null,
      },
    };
  });
}

export function evaluateCollaborationState({ project = {}, team = project.team || [], messages = [] }) {
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: project.objective || project.name || '',
  });
  const lead = getLead(network);
  const reviewer = getReviewer(network);
  const teamNames = new Set(network.agents.map((agent) => agent.name));
  const teamIds = new Set(network.agents.map((agent) => agent.id));
  const checks = [];

  const addCheck = (id, passed, label, detail = '') => {
    checks.push({ id, passed, label, detail });
  };

  addCheck('lead-present', Boolean(lead), 'Lead exists', lead ? `${lead.name} owns coordination.` : 'No Lead selected.');
  addCheck('reviewer-present', Boolean(reviewer), 'Reviewer exists', reviewer ? `${reviewer.name} owns challenge/review.` : 'No Reviewer selected.');
  addCheck(
    'lead-reviewer-separated',
    Boolean(lead && reviewer && lead.id !== reviewer.id),
    'Lead and Reviewer are separate',
    lead && reviewer ? `${lead.name} / ${reviewer.name}` : 'Missing role.',
  );

  const tasks = project.tasks || [];
  const ownerlessTasks = tasks.filter((task) => {
    if (!task.assignee) return true;
    return !teamNames.has(task.assignee) && !teamIds.has(task.assignee);
  });
  addCheck(
    'no-ownerless-task',
    ownerlessTasks.length === 0,
    'No ownerless task',
    ownerlessTasks.length ? ownerlessTasks.map((task) => task.text).join(' | ') : 'Every task has a team owner.',
  );

  const blockedTasks = tasks.filter((task) => task.status === 'blocked');
  addCheck(
    'blocked-has-owner',
    blockedTasks.every((task) => Boolean(task.assignee)),
    'Blocked work has owner',
    blockedTasks.length ? `${blockedTasks.length} blocked task(s) tracked.` : 'No blocked tasks.',
  );

  const riskSignals = messages.filter((message) => /risk|review|security|verify|blocked|风险|复核|安全|验证|阻塞/i.test(message.text || ''));
  addCheck(
    'risk-visible-to-reviewer',
    riskSignals.length === 0 || Boolean(reviewer),
    'Risk visible to Reviewer',
    riskSignals.length ? `${riskSignals.length} risk signal(s) require reviewer visibility.` : 'No current risk signal.',
  );

  const latestCycle = project.autonomousLedger?.[0];
  addCheck(
    'cycle-has-diagnostics',
    Boolean(latestCycle?.communicationDiagnostics?.length || latestCycle?.agentPlans?.length),
    'Cycle has collaboration evidence',
    latestCycle ? `${latestCycle.publishedEventCount} published event(s), ${latestCycle.communicationDiagnostics?.length || 0} communication diagnostic(s).` : 'No autonomous cycle recorded yet.',
  );

  const passedCount = checks.filter((check) => check.passed).length;
  return {
    network,
    lead,
    reviewer,
    checks,
    score: checks.length ? Math.round((passedCount / checks.length) * 100) : 0,
    status: checks.every((check) => check.passed) ? 'healthy' : 'needs-attention',
  };
}

export function createLeaderElection(team = [], projectBrief = '', context = {}) {
  const network = createAgentNetwork(team, {
    ...context,
    topic: projectBrief,
  });
  const candidates = [...network.agents]
    .map((agent) => {
      const score = Math.round(managementScore(agent) + (hasCapabilitySignal(agent, projectBrief) ? 18 : 0));
      const managedLane = fallbackIntent(agent);
      return {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        score,
        claim: `${agent.name}: I want to lead this project because my lane is ${managedLane}. I will turn the brief into owners, deadlines, and a visible project ledger.`,
        hearsOthers: network.agents.filter((peer) => peer.id !== agent.id).map((peer) => peer.id),
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    network,
    candidates,
    recommendedLeaderId: candidates[0]?.agentId || null,
    transcript: candidates.map((candidate) => ({
      id: `leader_bid_${candidate.agentId}`,
      speakerId: candidate.agentId,
      speaker: candidate.name,
      role: candidate.role,
      text: candidate.claim,
      type: 'leader-campaign',
    })),
  };
}

export function createKickoffRoleNegotiation(team = [], projectBrief = '', context = {}) {
  const network = createAgentNetwork(team, {
    ...context,
    topic: projectBrief,
  });
  const ranked = buildIntentions(network, projectBrief);

  return {
    network,
    transcript: ranked.map((intent, index) => {
      const agent = getAgent(network, intent.id);
      const wantsClarification = index % 3 === 1;
      return {
        id: `role_negotiation_${intent.id}`,
        speakerId: intent.id,
        speaker: intent.name,
        role: intent.role,
        type: wantsClarification ? 'role-question' : 'role-volunteer',
        text: wantsClarification
          ? `${intent.name}: I understand the project direction. What should I own here so my work does not overlap with ${network.agents.filter((peer) => peer.id !== intent.id)[0]?.name || 'the team'}?`
          : `${intent.name}: I recommend myself for ${intent.target}. I can take the first artifact and expose progress in the project timeline.`,
        hears: agent?.peerIds || [],
      };
    }),
  };
}

export function createLeaderAssignmentPackage({ project = {}, leaderId, now = nowIso() }) {
  const team = project.team || [];
  const leader = team.find((agent) => agent.id === leaderId || agent.name === leaderId)
    || team.find((agent) => agent.isLeader)
    || team[0];
  const members = team.filter((agent) => agent.id !== leader?.id);
  const tasks = project.tasks || [];

  const assignmentMessages = tasks
    .filter((task) => task.status !== 'done')
    .map((task, index) => {
      const assignee = team.find((agent) => agent.name === task.assignee || agent.id === task.assignee)
        || members[index % Math.max(1, members.length)]
        || leader;
      return {
        id: `assign_${Date.parse(now) || Date.now()}_${task.id || index}`,
        channelId: 'main',
        type: 'mention',
        author: leader?.name || 'Leader',
        role: leader?.role || 'Leader',
        time: 'Now',
        text: `@${assignee?.name || 'team'} please take ownership of "${task.text}". Report progress in the work stream and push every meaningful update to the timeline.`,
        targets: [assignee?.name || assignee?.id].filter(Boolean),
        weight: 'Assigned',
        assignment: {
          taskId: task.id,
          ownerId: assignee?.id || null,
          ownerName: assignee?.name || null,
          assignedBy: leader?.id || null,
        },
      };
    });

  const assignmentLogs = assignmentMessages.map((message) => ({
    id: `log_${message.id}`,
    time: now,
    agent: message.author,
    log: message.text,
    eventType: 'leader-assignment',
    cadence: 'kickoff',
  }));
  const acknowledgementMessages = assignmentMessages.map((message, index) => {
    const assignee = team.find((agent) => agent.id === message.assignment?.ownerId || agent.name === message.assignment?.ownerName);
    return {
      id: `ack_${Date.parse(now) || Date.now()}_${message.assignment?.taskId || index}`,
      channelId: message.channelId,
      type: 'progress',
      author: assignee?.name || message.assignment?.ownerName || 'Assigned Agent',
      role: assignee?.role || 'Agent',
      time: 'Now',
      text: `Received @${message.author}. I own "${message.assignment?.taskId ? tasks.find((task) => task.id === message.assignment.taskId)?.text : 'the assigned task'}" and I am starting work now. I will publish progress to the timeline.`,
      targets: [message.author].filter(Boolean),
      weight: 'Acknowledged',
      assignmentReceipt: {
        taskId: message.assignment?.taskId || null,
        ownerId: message.assignment?.ownerId || null,
        ownerName: message.assignment?.ownerName || null,
        assignedBy: message.assignment?.assignedBy || leader?.id || null,
        receivedAt: now,
      },
    };
  });
  const acknowledgementLogs = acknowledgementMessages.map((message) => ({
    id: `log_${message.id}`,
    time: now,
    agent: message.author,
    log: message.text,
    eventType: 'assignment-acknowledged',
    cadence: 'kickoff',
  }));

  return {
    leader,
    assignmentMessages,
    assignmentLogs,
    acknowledgementMessages,
    acknowledgementLogs,
    tasks: tasks.map((task, index) => {
      if (task.status === 'done') return task;
      const assignee = team.find((agent) => agent.name === task.assignee || agent.id === task.assignee)
        || members[index % Math.max(1, members.length)]
        || leader;
      return {
        ...task,
        assignee: assignee?.name || task.assignee,
        ownerId: assignee?.id || task.ownerId || null,
        assignedBy: leader?.id || task.assignedBy || null,
        assignedAt: now,
        status: task.status === 'pending' ? 'in-progress' : task.status,
      };
    }),
  };
}

const LEADER_ASSIGNMENT_PATTERN = /\b(assign|delegate|handoff|route|own|take)\b|\u5206\u914d|\u6307\u6d3e|\u5b89\u6392|\u4ea4\u7ed9/i;

export function isLeaderAssignmentRequest(text = '') {
  return Boolean(text && text.includes('@') && LEADER_ASSIGNMENT_PATTERN.test(text));
}

function findMentionedAssignmentTarget(team = [], text = '', leaderId = null) {
  const normalizedText = text.toLowerCase();
  const nonLeaderTeam = team.filter((agent) => agent.id !== leaderId && !agent.isLeader);
  const directNameMatch = team.find((agent) => {
    const name = String(agent.name || '').toLowerCase();
    const id = String(agent.id || '').toLowerCase();
    return (name && normalizedText.includes(`@${name}`)) || (id && normalizedText.includes(`@${id}`));
  });
  if (directNameMatch && directNameMatch.id !== leaderId) return directNameMatch;

  const mentionToken = [...text.matchAll(/@([A-Za-z0-9_-]+)/g)][0]?.[1]?.toLowerCase();
  if (mentionToken && mentionToken !== 'all') {
    const tokenMatch = team.find((agent) => (
      String(agent.id || '').toLowerCase() === mentionToken
      || String(agent.name || '').toLowerCase().split(/\s+/).includes(mentionToken)
    ));
    if (tokenMatch && tokenMatch.id !== leaderId) return tokenMatch;
  }

  return nonLeaderTeam[0] || team.find((agent) => agent.id !== leaderId) || team[0] || null;
}

function extractAssignedWorkText(text = '', target = null) {
  const targetName = target?.name || '';
  const targetId = target?.id || '';
  let workText = text
    .replace(new RegExp(`@${targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'ig'), '')
    .replace(new RegExp(`@${targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'ig'), '')
    .replace(/@([A-Za-z0-9_-]+)/g, '')
    .replace(/\b(leader|lead|please|pls|assign|delegate|handoff|route|own|take|to)\b/ig, '')
    .replace(/[:;,.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!workText) workText = 'Follow up on the new assigned work and publish progress evidence';
  return workText;
}

function createAgentStateFromAssignment(agent, { leader, task, now, existingState = {} }) {
  const isLeader = agent.id === leader?.id;
  const assignmentInbox = isLeader
    ? existingState.inbox || []
    : [
      {
        id: `inbox_${task.id}`,
        from: leader?.id || null,
        taskId: task.id,
        text: task.text,
        receivedAt: now,
      },
      ...(existingState.inbox || []),
    ];
  const worklogEntry = {
    id: `worklog_${task.id}_${agent.id}`,
    at: now,
    text: isLeader
      ? `Assigned "${task.text}" to ${task.assignee}.`
      : `Accepted "${task.text}" from ${leader?.name || 'Leader'}.`,
  };
  return {
    agentId: agent.id,
    managerId: isLeader ? null : leader?.id || existingState.managerId || null,
    managedIds: isLeader
      ? Array.from(new Set([...(existingState.managedIds || []), task.ownerId].filter(Boolean)))
      : existingState.managedIds || [],
    inbox: assignmentInbox,
    obligations: isLeader
      ? existingState.obligations || []
      : [
        {
          id: `obligation_${task.id}`,
          taskId: task.id,
          text: task.text,
          source: 'leader-chat-assignment',
          due: 'next visible work pulse',
        },
        ...(existingState.obligations || []),
      ],
    currentPlan: isLeader
      ? existingState.currentPlan || { focus: 'coordinate assigned work', next: 'watch acknowledgements and timeline proof' }
      : { focus: task.text, next: 'publish progress to the timeline' },
    taskIds: Array.from(new Set([...(existingState.taskIds || []), ...(isLeader ? [] : [task.id])])),
    worklog: [worklogEntry, ...(existingState.worklog || [])],
    status: isLeader ? 'coordinating' : 'working',
    lastActiveAt: now,
  };
}

export function handleLeaderChatAssignment({
  project = {},
  text = '',
  leaderId,
  channelId = 'main',
  now = nowIso(),
} = {}) {
  const team = project.team || [];
  const leader = team.find((agent) => agent.id === leaderId || agent.name === leaderId)
    || team.find((agent) => agent.isLeader)
    || team[0]
    || null;
  const assignee = findMentionedAssignmentTarget(team, text, leader?.id);
  const workText = extractAssignedWorkText(text, assignee);
  const timestamp = Date.parse(now) || Date.now();
  const task = {
    id: `leader_task_${timestamp}`,
    text: workText,
    assignee: assignee?.name || 'Assigned Agent',
    ownerId: assignee?.id || null,
    status: 'in-progress',
    source: 'leader-chat-assignment',
    sourceChannelId: channelId,
    assignedBy: leader?.id || null,
    assignedAt: now,
    workPulseCount: 0,
  };
  const assignmentMessage = {
    id: `leader_assign_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'mention',
    author: leader?.name || 'Leader',
    role: leader?.role || 'Leader',
    time: 'Now',
    text: `@${assignee?.name || 'team'} please own "${task.text}". Start now, keep the group updated, and publish progress to the timeline.`,
    targets: [assignee?.name || assignee?.id].filter(Boolean),
    weight: 'Assigned',
    assignment: {
      taskId: task.id,
      ownerId: task.ownerId,
      ownerName: task.assignee,
      assignedBy: task.assignedBy,
      source: task.source,
    },
  };
  const acknowledgementMessage = {
    id: `leader_ack_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'progress',
    author: assignee?.name || 'Assigned Agent',
    role: assignee?.role || 'Agent',
    time: 'Now',
    text: `Received @${assignmentMessage.author}. I own "${task.text}" and I am starting work now. I will publish progress to the timeline.`,
    targets: [assignmentMessage.author].filter(Boolean),
    weight: 'Acknowledged',
    assignmentReceipt: {
      taskId: task.id,
      ownerId: task.ownerId,
      ownerName: task.assignee,
      assignedBy: task.assignedBy,
      receivedAt: now,
    },
  };
  const logs = [
    {
      id: `log_${assignmentMessage.id}`,
      time: now,
      agent: assignmentMessage.author,
      log: assignmentMessage.text,
      eventType: 'leader-assignment',
      cadence: 'chat',
    },
    {
      id: `log_${acknowledgementMessage.id}`,
      time: now,
      agent: acknowledgementMessage.author,
      log: acknowledgementMessage.text,
      eventType: 'assignment-acknowledged',
      cadence: 'chat',
    },
  ];
  const previousStates = project.agentStates || {};
  const nextAgentStates = { ...previousStates };
  [leader, assignee].filter(Boolean).forEach((agent) => {
    nextAgentStates[agent.id] = createAgentStateFromAssignment(agent, {
      leader,
      task,
      now,
      existingState: previousStates[agent.id] || {},
    });
  });

  return {
    task,
    assignmentMessage,
    acknowledgementMessage,
    logs,
    project: {
      ...project,
      tasks: [task, ...(project.tasks || [])],
      logs: [...logs, ...(project.logs || [])],
      agentStates: nextAgentStates,
    },
  };
}

const PEER_HANDOFF_PATTERN = /\b(handoff|dependency|depend|help|review|unblock|coordinate|support)\b|\u4f9d\u8d56|\u534f\u4f5c|\u8bc4\u5ba1|\u652f\u6301|\u5e2e\u6211|\u5361\u4f4f/i;

export function isPeerHandoffRequest(text = '') {
  return Boolean(text && text.includes('@') && PEER_HANDOFF_PATTERN.test(text));
}

function findRequesterAgent(team = [], text = '', targetId = null, explicitRequesterId = null) {
  if (explicitRequesterId) {
    const explicit = team.find((agent) => agent.id === explicitRequesterId || agent.name === explicitRequesterId);
    if (explicit) return explicit;
  }
  const normalizedText = text.toLowerCase();
  const namedRequester = team.find((agent) => {
    if (agent.id === targetId) return false;
    const name = String(agent.name || '').toLowerCase();
    const id = String(agent.id || '').toLowerCase();
    return (name && normalizedText.includes(name) && !normalizedText.includes(`@${name}`))
      || (id && normalizedText.includes(id) && !normalizedText.includes(`@${id}`));
  });
  if (namedRequester) return namedRequester;
  return team.find((agent) => agent.id !== targetId && !agent.isLeader)
    || team.find((agent) => agent.id !== targetId)
    || team[0]
    || null;
}

function extractPeerHandoffText(text = '', requester = null, target = null) {
  const requesterName = requester?.name || '';
  const requesterId = requester?.id || '';
  let workText = extractAssignedWorkText(text, target)
    .replace(new RegExp(requesterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(new RegExp(requesterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(/\b(asks|ask|needs|need|handoff|dependency|depend|help|review|unblock|coordinate|support|from|for|with)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!workText) workText = 'Support the open dependency and publish evidence';
  return workText;
}

export function handlePeerHandoff({
  project = {},
  text = '',
  requesterId,
  channelId = 'main',
  now = nowIso(),
} = {}) {
  const team = project.team || [];
  const preliminaryTarget = findMentionedAssignmentTarget(team, text, requesterId);
  const requester = findRequesterAgent(team, text, preliminaryTarget?.id, requesterId);
  const target = findMentionedAssignmentTarget(team, text, requester?.id);
  const workText = extractPeerHandoffText(text, requester, target);
  const timestamp = Date.parse(now) || Date.now();
  const dependencyTask = {
    id: `peer_handoff_task_${timestamp}`,
    text: workText,
    assignee: target?.name || 'Peer Agent',
    ownerId: target?.id || null,
    status: 'in-progress',
    source: 'peer-handoff',
    sourceChannelId: channelId,
    requestedBy: requester?.id || null,
    assignedBy: requester?.id || null,
    assignedAt: now,
    workPulseCount: 0,
  };
  const requestMessage = {
    id: `peer_handoff_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'mention',
    author: requester?.name || 'Requesting Agent',
    role: requester?.role || 'Agent',
    time: 'Now',
    text: `@${target?.name || 'team'} I need your help with "${dependencyTask.text}". This is a dependency for my current plan; please confirm ownership and publish progress to the timeline.`,
    targets: [target?.name || target?.id].filter(Boolean),
    weight: 'Peer Handoff',
    handoff: {
      taskId: dependencyTask.id,
      requesterId: requester?.id || null,
      requesterName: requester?.name || null,
      targetId: target?.id || null,
      targetName: target?.name || null,
    },
  };
  const acknowledgementMessage = {
    id: `peer_handoff_ack_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'progress',
    author: target?.name || 'Peer Agent',
    role: target?.role || 'Agent',
    time: 'Now',
    text: `Received @${requestMessage.author}. I own the dependency "${dependencyTask.text}" and I am starting work now. I will sync progress back to the group and timeline.`,
    targets: [requestMessage.author].filter(Boolean),
    weight: 'Dependency Accepted',
    handoffReceipt: {
      taskId: dependencyTask.id,
      requesterId: requester?.id || null,
      targetId: target?.id || null,
      receivedAt: now,
    },
  };
  const logs = [
    {
      id: `log_${requestMessage.id}`,
      time: now,
      agent: requestMessage.author,
      log: requestMessage.text,
      eventType: 'peer-handoff',
      cadence: 'chat',
    },
    {
      id: `log_${acknowledgementMessage.id}`,
      time: now,
      agent: acknowledgementMessage.author,
      log: acknowledgementMessage.text,
      eventType: 'peer-handoff-ack',
      cadence: 'chat',
    },
  ];
  const handoffRecord = {
    id: `peer_handoff_record_${timestamp}`,
    projectId: project.id || null,
    taskId: dependencyTask.id,
    requesterId: requester?.id || null,
    requesterName: requester?.name || null,
    targetId: target?.id || null,
    targetName: target?.name || null,
    status: 'accepted',
    sourceChannelId: channelId,
    requestedAt: now,
    acknowledgedAt: now,
    requestMessageId: requestMessage.id,
    acknowledgementMessageId: acknowledgementMessage.id,
  };
  const previousStates = project.agentStates || {};
  const requesterState = previousStates[requester?.id] || {};
  const targetState = previousStates[target?.id] || {};
  const nextAgentStates = { ...previousStates };
  if (requester) {
    nextAgentStates[requester.id] = {
      agentId: requester.id,
      managerId: requesterState.managerId || null,
      managedIds: requesterState.managedIds || [],
      peerManagedIds: Array.from(new Set([...(requesterState.peerManagedIds || []), target?.id].filter(Boolean))),
      inbox: requesterState.inbox || [],
      obligations: requesterState.obligations || [],
      currentPlan: requesterState.currentPlan || { focus: 'coordinate dependency handoffs', next: 'watch peer acknowledgement and timeline proof' },
      taskIds: requesterState.taskIds || [],
      worklog: [
        {
          id: `worklog_${dependencyTask.id}_${requester.id}`,
          at: now,
          text: `Requested peer handoff "${dependencyTask.text}" from ${target?.name || 'peer'}.`,
        },
        ...(requesterState.worklog || []),
      ],
      status: 'coordinating-dependency',
      lastActiveAt: now,
    };
  }
  if (target) {
    nextAgentStates[target.id] = {
      agentId: target.id,
      managerId: targetState.managerId || null,
      managedIds: targetState.managedIds || [],
      peerManagerId: requester?.id || targetState.peerManagerId || null,
      peerManagerIds: Array.from(new Set([...(targetState.peerManagerIds || []), requester?.id].filter(Boolean))),
      inbox: [
        {
          id: `inbox_${dependencyTask.id}`,
          from: requester?.id || null,
          taskId: dependencyTask.id,
          text: dependencyTask.text,
          receivedAt: now,
          source: 'peer-handoff',
        },
        ...(targetState.inbox || []),
      ],
      obligations: [
        {
          id: `obligation_${dependencyTask.id}`,
          taskId: dependencyTask.id,
          text: dependencyTask.text,
          source: 'peer-handoff',
          due: 'next visible work pulse',
        },
        ...(targetState.obligations || []),
      ],
      currentPlan: { focus: dependencyTask.text, next: 'sync dependency progress to requester and timeline' },
      taskIds: Array.from(new Set([...(targetState.taskIds || []), dependencyTask.id])),
      worklog: [
        {
          id: `worklog_${dependencyTask.id}_${target.id}`,
          at: now,
          text: `Accepted peer dependency "${dependencyTask.text}" from ${requester?.name || 'peer'}.`,
        },
        ...(targetState.worklog || []),
      ],
      status: 'working-peer-dependency',
      lastActiveAt: now,
    };
  }

  return {
    task: dependencyTask,
    handoffRecord,
    requestMessage,
    acknowledgementMessage,
    logs,
    project: {
      ...project,
      tasks: [dependencyTask, ...(project.tasks || [])],
      logs: [...logs, ...(project.logs || [])],
      peerHandoffs: [handoffRecord, ...(project.peerHandoffs || [])],
      agentStates: nextAgentStates,
    },
  };
}

export function createKickoffCharter({
  project = {},
  leaderId,
  reviewerId,
  roleNegotiation = {},
  leaderElection = {},
  assignmentPackage = {},
  now = nowIso(),
} = {}) {
  const team = project.team || [];
  const leader = team.find((agent) => agent.id === leaderId || agent.isLeader) || assignmentPackage.leader || team[0] || null;
  const reviewer = team.find((agent) => agent.id === reviewerId && agent.id !== leader?.id)
    || team.find((agent) => /reviewer|reporter|evidence|quality|risk/i.test(`${agent.role || ''} ${agent.skill || ''}`) && agent.id !== leader?.id)
    || team.find((agent) => agent.id !== leader?.id)
    || null;
  const roleQuestions = (roleNegotiation.transcript || []).filter((item) => item.type === 'role-question');
  const roleVolunteers = (roleNegotiation.transcript || []).filter((item) => item.type === 'role-volunteer');
  const candidateCount = leaderElection.candidates?.length || leaderElection.transcript?.length || 0;
  const assignments = assignmentPackage.assignmentMessages || [];
  const acknowledgements = assignmentPackage.acknowledgementMessages || [];

  return {
    id: `charter_${project.id || Date.parse(now) || Date.now()}`,
    projectId: project.id || null,
    createdAt: now,
    title: `${project.name || 'Project'} Kickoff Charter`,
    status: 'approved',
    meeting: {
      type: 'kickoff',
      result: 'approved-for-autonomous-execution',
      roleQuestionCount: roleQuestions.length,
      selfNominationCount: roleVolunteers.length,
      leaderCandidateCount: candidateCount,
    },
    governance: {
      leaderId: leader?.id || null,
      leaderName: leader?.name || null,
      reviewerId: reviewer?.id || null,
      reviewerName: reviewer?.name || null,
      decisionMode: 'Director-confirmed Leader election',
    },
    team: team.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role || agent.title || 'Agent',
      isLeader: Boolean(agent.isLeader || agent.id === leader?.id),
    })),
    nextActions: (assignmentPackage.tasks || project.tasks || []).map((task) => ({
      id: task.id,
      text: task.text,
      ownerId: task.ownerId || team.find((agent) => agent.name === task.assignee)?.id || null,
      ownerName: task.assignee || null,
      status: task.status || 'pending',
      assignedBy: task.assignedBy || leader?.id || null,
    })),
    communicationRules: [
      'Leader assigns work in group chat with @mentions.',
      'Mentioned Agents read immediately, accept obligations, and publish progress to the timeline.',
      'Feature changes from meetings or Google Chat require Lead acknowledgement, Reviewer challenge, owner confirmation, and owner sync.',
      'Autonomous cycles update project logs, agent states, task state, and the timeline.',
    ],
    evidence: {
      roleTranscriptIds: (roleNegotiation.transcript || []).map((item) => item.id),
      leaderCampaignIds: (leaderElection.transcript || []).map((item) => item.id),
      assignmentMessageIds: assignments.map((message) => message.id),
      acknowledgementMessageIds: acknowledgements.map((message) => message.id),
    },
  };
}

const FEATURE_CHANGE_PATTERN = /add|new feature|feature|change|\u65b0\u589e|\u589e\u52a0|\u52a0\u4e00\u4e2a|\u529f\u80fd|\u6539\u4e00\u4e0b|\u53d8\u66f4/i;

export function isFeatureChangeRequest(text = '') {
  return FEATURE_CHANGE_PATTERN.test(text);
}

export function handleFeatureChangeRequest({
  project = {},
  text = '',
  author = DIRECTOR_AGENT_ID,
  now = nowIso(),
  channelId = 'main',
  source = 'group-chat-change-request',
} = {}) {
  const team = project.team || [];
  const timestamp = Date.parse(now) || Date.now();
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: text,
  });
  const lead = getLead(network);
  const reviewer = getReviewer(network);
  const readings = network.agents.map((agent) => readCommunication(agent, {
    id: `change_${timestamp}`,
    authorId: author,
    kind: 'mention',
    text,
    targetIds: network.agents.map((agentItem) => agentItem.id),
  }, network));
  const responsible = readings
    .filter((reading) => reading.agentId !== reviewer?.id)
    .sort((a, b) => b.score - a.score)[0];
  const owner = getAgent(network, responsible?.agentId) || lead || network.agents[0];
  const changeTask = {
    id: `change_${timestamp}`,
    text: `Feature change: ${text}`,
    assignee: owner?.name || lead?.name || 'Leader',
    ownerId: owner?.id || lead?.id || null,
    status: 'pending',
    createdAt: now,
    source,
    sourceChannelId: channelId,
  };
  const discussionMessages = [
    {
      id: `change_discuss_${timestamp}_lead`,
      channelId,
      type: 'mention',
      author: lead?.name || 'Leader',
      role: lead?.role || 'Leader',
      time: 'Now',
      text: `I see the change request: "${text}". Team, discuss impact first; ${owner?.name || 'the owner'} will confirm scope before it enters the plan.`,
      targets: network.agents.map((agent) => agent.name),
      weight: 'Change Review',
    },
    ...(reviewer ? [{
      id: `change_discuss_${timestamp}_reviewer`,
      channelId,
      type: 'text',
      author: reviewer.name,
      role: reviewer.role,
      time: 'Now',
      text: `Before accepting it, I need the risk and verification path attached to the change. No silent scope drift.`,
      targets: [],
      weight: null,
    }] : []),
    {
      id: `change_confirm_${timestamp}_owner`,
      channelId,
      type: 'decision',
      author: owner?.name || lead?.name || 'Responsible Agent',
      role: owner?.role || lead?.role || 'Owner',
      time: 'Now',
      text: `Confirmed. I am adding "${text}" to my plan, will sync dependencies with the team, and will report progress on the timeline.`,
      targets: [],
      weight: 'Confirmed',
      decisionId: `CHG-${String(timestamp).slice(-5)}`,
    },
    {
      id: `change_sync_${timestamp}_owner`,
      channelId,
      type: 'mention',
      author: owner?.name || lead?.name || 'Responsible Agent',
      role: owner?.role || lead?.role || 'Owner',
      time: 'Now',
      text: `@all Plan updated: I own "${text}" now. I will publish the next progress pulse to the timeline and call out any dependency in this channel.`,
      targets: network.agents.map((agent) => agent.name),
      weight: 'Plan Sync',
    },
  ];
  const confirmationMessage = discussionMessages.find((message) => message.type === 'decision');
  const syncMessage = discussionMessages.find((message) => message.id.includes('change_sync'));
  const previousStates = project.agentStates || {};
  const ownerState = previousStates[owner?.id] || {};
  const ownerRoutine = owner ? workRoutineForAgent(owner) : null;
  const ownerStateUpdate = owner ? {
    agentId: owner.id,
    name: owner.name,
    role: owner.role,
    managerId: ownerState.managerId || owner.managerId || null,
    managedIds: ownerState.managedIds || owner.managedIds || [],
    peerManagedIds: ownerState.peerManagedIds || [],
    peerManagerId: ownerState.peerManagerId || null,
    peerManagerIds: ownerState.peerManagerIds || [],
    peerIds: ownerState.peerIds || owner.peerIds || [],
    status: 'working-change-request',
    currentPlan: {
      ...(ownerState.currentPlan || {}),
      focus: `Feature change: ${text}`,
      next: 'publish the next progress pulse and sync dependencies',
      source,
      sourceChannelId: channelId,
      changeRecordId: `change_record_${timestamp}`,
      taskId: changeTask.id,
      routine: ownerState.currentPlan?.routine || ownerRoutine,
    },
    taskIds: Array.from(new Set([...(ownerState.taskIds || []), changeTask.id])),
    inbox: [
      {
        id: `inbox_${changeTask.id}`,
        from: author,
        taskId: changeTask.id,
        text,
        source,
        sourceChannelId: channelId,
        receivedAt: now,
      },
      ...(ownerState.inbox || []),
    ].slice(0, 20),
    obligations: [
      {
        id: `obligation_${changeTask.id}`,
        taskId: changeTask.id,
        text: `Own confirmed feature change: ${text}`,
        source,
        due: 'next visible work pulse',
        status: 'open',
        openedAt: now,
      },
      ...(ownerState.obligations || []).filter((obligation) => obligation.status === 'open'),
    ].slice(0, 20),
    worklog: [
      {
        id: `worklog_${changeTask.id}_${owner.id}`,
        at: now,
        kind: 'change-plan-sync',
        text: syncMessage?.text || `Plan updated for "${text}".`,
      },
      ...(ownerState.worklog || []),
    ].slice(0, 20),
    lastActiveAt: now,
  } : null;
  const nextAgentStates = ownerStateUpdate
    ? { ...previousStates, [owner.id]: ownerStateUpdate }
    : previousStates;
  const changeRecord = {
    id: `change_record_${timestamp}`,
    projectId: project.id || null,
    requestedAt: now,
    requestedBy: author,
    requestText: text,
    source,
    sourceChannelId: channelId,
    status: 'confirmed-and-synced',
    leadId: lead?.id || null,
    leadName: lead?.name || null,
    reviewerId: reviewer?.id || null,
    reviewerName: reviewer?.name || null,
    ownerId: owner?.id || lead?.id || null,
    ownerName: owner?.name || lead?.name || null,
    taskId: changeTask.id,
    discussionMessageIds: discussionMessages.map((message) => message.id),
    confirmationMessageId: confirmationMessage?.id || null,
    syncMessageId: syncMessage?.id || null,
    planUpdate: syncMessage?.text || null,
    ownerStateUpdated: Boolean(ownerStateUpdate),
  };
  const logs = discussionMessages.map((message) => ({
    id: `log_${message.id}`,
    time: now,
    agent: message.author,
    log: message.text,
    eventType: message.id.includes('change_sync') ? 'change-sync' : message.type === 'decision' ? 'change-confirmed' : 'change-discussion',
    cadence: 'change',
    source,
    sourceChannelId: channelId,
  }));

  return {
    network,
    owner,
    changeTask,
    changeRecord,
    ownerStateUpdate,
    discussionMessages,
    logs,
    project: {
      ...project,
      tasks: [...(project.tasks || []), changeTask],
      changeLedger: [changeRecord, ...(project.changeLedger || [])],
      logs: [...logs, ...(project.logs || [])],
      agentStates: nextAgentStates,
    },
    diagnostics: readings.map((reading) => ({
      agentId: reading.agentId,
      attentionScore: reading.score,
      decision: reading.decision,
      explanation: reading.explanation,
      obligationCount: reading.obligations.length,
    })),
  };
}
