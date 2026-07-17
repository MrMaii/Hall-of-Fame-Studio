import {
  buildPersonaSkillBlend,
  buildSkillRoomReply,
  createRoundtablePlan,
  describeSkillIntent,
  getPersonSkill,
} from '../skills/personSkillSystem.js';
import { createTranslator, localizeText, normalizeLanguage } from '../i18n/runtime.js';
import { meetingTurnDelayMs } from './meetingQueueProtocol.js';
import { evaluateLocalIntervalSchedule } from './localScheduleGovernance.js';
import { createHash } from 'node:crypto';

export const DIRECTOR_AGENT_ID = 'director';
export const EVENT_LEDGER_RETAINED_LIMIT = 5000;
export const EVENT_LEDGER_GENESIS_HASH = '0'.repeat(64);

function eventLedgerChecksum(value) {
  const stableJson = (input) => {
    if (Array.isArray(input)) return `[${input.map((item) => stableJson(item)).join(',')}]`;
    if (input && typeof input === 'object') return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${stableJson(input[key])}`).join(',')}}`;
    return JSON.stringify(input);
  };
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function eventPayloadForChecksum(event = {}) {
  const { eventChecksum: _eventChecksum, previousEventHash: _previousEventHash, eventHash: _eventHash, ...base } = event;
  return base;
}

function sealEvent(event, previousEventHash) {
  const base = structuredClone(eventPayloadForChecksum(event));
  const eventChecksum = eventLedgerChecksum(base);
  const chainBase = { sequence: base.sequence, eventChecksum, previousEventHash };
  return { ...base, eventChecksum, previousEventHash, eventHash: eventLedgerChecksum(chainBase) };
}

export function verifyProjectEventLedger(project = {}) {
  const events = Array.isArray(project.eventLedger) ? project.eventLedger : [];
  const findings = [];
  let previousHash = project.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH;
  events.forEach((event, index) => {
    const expectedSequence = index === 0 ? event.sequence : events[index - 1].sequence + 1;
    const expectedChecksum = eventLedgerChecksum(eventPayloadForChecksum(event));
    const expectedHash = eventLedgerChecksum({ sequence: event.sequence, eventChecksum: expectedChecksum, previousEventHash: previousHash });
    if (!Number.isInteger(event.sequence) || event.sequence !== expectedSequence) findings.push({ code: 'event-sequence-gap', eventId: event.id || null });
    if (project.id && event.projectId && event.projectId !== project.id) findings.push({ code: 'event-project-mismatch', eventId: event.id || null });
    if (event.eventChecksum !== expectedChecksum) findings.push({ code: 'event-checksum-mismatch', eventId: event.id || null });
    if (event.previousEventHash !== previousHash) findings.push({ code: 'event-previous-hash-mismatch', eventId: event.id || null });
    if (event.eventHash !== expectedHash) findings.push({ code: 'event-hash-mismatch', eventId: event.id || null });
    previousHash = event.eventHash || previousHash;
  });
  const computedRootHash = events.at(-1)?.eventHash || project.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH;
  if (project.eventLedgerRootHash && project.eventLedgerRootHash !== computedRootHash) findings.push({ code: 'event-root-hash-mismatch', eventId: null });
  if (project.eventLedgerFirstSequence && project.eventLedgerFirstSequence !== (events[0]?.sequence || 0)) findings.push({ code: 'event-first-sequence-mismatch', eventId: events[0]?.id || null });
  if (project.eventLedgerLastSequence && project.eventLedgerLastSequence !== (events.at(-1)?.sequence || 0)) findings.push({ code: 'event-last-sequence-mismatch', eventId: events.at(-1)?.id || null });
  return {
    schemaVersion: 'project-event-ledger-integrity/v1',
    valid: findings.length === 0 && (events.length === 0 || project.eventLedgerChainVersion === 1),
    findings,
    retainedCount: events.length,
    firstSequence: events[0]?.sequence || 0,
    lastSequence: events.at(-1)?.sequence || 0,
    previousRetainedHash: project.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH,
    rootHash: computedRootHash,
  };
}

export function sealLegacyProjectEventLedger(project = {}) {
  if (project.eventLedgerChainVersion === 1) return project;
  let previousHash = EVENT_LEDGER_GENESIS_HASH;
  const events = (project.eventLedger || []).map((event) => {
    const sealed = sealEvent(event, previousHash);
    previousHash = sealed.eventHash;
    return sealed;
  });
  return { ...project, eventLedger: events, eventLedgerChainVersion: 1, eventLedgerPreviousHash: EVENT_LEDGER_GENESIS_HASH, eventLedgerRootHash: previousHash };
}

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

function compactObject(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => (
    item !== null
    && item !== undefined
    && (!(Array.isArray(item)) || item.length > 0)
  )));
}

const GENERATED_TEXT_KEYS = new Set([
  'text',
  'log',
  'summary',
  'label',
  'description',
  'weight',
  'focus',
  'next',
  'due',
]);

function localizeGeneratedObject(value, language = 'en') {
  const normalizedLanguage = normalizeLanguage(language);
  if (normalizedLanguage === 'en') return value;
  if (Array.isArray(value)) {
    return value.map((item) => localizeGeneratedObject(item, normalizedLanguage));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item === 'string' && GENERATED_TEXT_KEYS.has(key)) {
      return [key, localizeText(item, normalizedLanguage)];
    }
    return [key, localizeGeneratedObject(item, normalizedLanguage)];
  }));
}

export function createProjectLedgerEvent({
  id,
  type = 'project-event',
  time = nowIso(),
  actor = 'Agent Runtime',
  summary = '',
  source = 'runtime',
  channelId = null,
  evidenceIds = [],
  entityIds = {},
  payload = {},
} = {}) {
  const timestamp = Date.parse(time) || Date.now();
  return compactObject({
    id: id || `evt_${type}_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    time,
    actor,
    summary,
    source,
    channelId,
    evidenceIds: evidenceIds.filter(Boolean),
    entityIds: compactObject(entityIds),
    payload: compactObject(payload),
  });
}

export function appendProjectEvents(project = {}, events = []) {
  const chainedProject = sealLegacyProjectEventLedger(project);
  const integrity = verifyProjectEventLedger(chainedProject);
  if (!integrity.valid) throw new Error(`project-event-ledger-integrity-invalid:${integrity.findings.map((finding) => finding.code).join(',')}`);
  const existing = chainedProject.eventLedger || [];
  const lastKnownSequence = Math.max(
    chainedProject.eventLedgerLastSequence || 0,
    existing.reduce((max, event) => Math.max(max, event.sequence || 0), 0),
  );
  let previousHash = existing.at(-1)?.eventHash || chainedProject.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH;
  const normalizedEvents = events
    .filter(Boolean)
    .map((event, index) => {
      const sealed = sealEvent({ ...event, sequence: lastKnownSequence + index + 1, projectId: chainedProject.id || event.projectId || null }, previousHash);
      previousHash = sealed.eventHash;
      return sealed;
    });
  const combined = [...existing, ...normalizedEvents];
  const removed = combined.slice(0, Math.max(0, combined.length - EVENT_LEDGER_RETAINED_LIMIT));
  const nextLedger = combined.slice(-EVENT_LEDGER_RETAINED_LIMIT);
  const lastEvent = nextLedger[nextLedger.length - 1] || null;
  const updatedProject = {
    ...chainedProject,
    eventLedger: nextLedger,
    eventLedgerChainVersion: 1,
    eventLedgerPreviousHash: removed.at(-1)?.eventHash || chainedProject.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH,
    eventLedgerRootHash: lastEvent?.eventHash || chainedProject.eventLedgerPreviousHash || EVENT_LEDGER_GENESIS_HASH,
    eventLedgerFirstSequence: nextLedger[0]?.sequence || 0,
    eventLedgerLastSequence: lastEvent?.sequence || lastKnownSequence,
    eventLedgerEventCount: Math.max(project.eventLedgerEventCount || 0, lastKnownSequence) + normalizedEvents.length,
  };
  const updatedIntegrity = verifyProjectEventLedger(updatedProject);
  if (!updatedIntegrity.valid) throw new Error(`project-event-ledger-append-invalid:${updatedIntegrity.findings.map((finding) => finding.code).join(',')}`);
  return updatedProject;
}

function ledgerEventsFromLogs(logs = [], source = 'timeline-log') {
  return logs.map((log) => createProjectLedgerEvent({
    id: `evt_${log.id}`,
    type: log.eventType || 'timeline-log',
    time: log.time || nowIso(),
    actor: log.agent || log.agentId || 'Agent Runtime',
    summary: log.log || '',
    source,
    channelId: log.sourceChannelId || null,
    evidenceIds: [log.id],
    entityIds: {
      messageId: String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : null,
      taskId: log.taskId || null,
      agentId: log.agentId || null,
      targetAgentId: log.targetAgentId || null,
    },
    payload: {
      cadence: log.cadence || null,
      receiptCount: log.receiptCount || null,
      directTargetIds: log.directTargetIds || [],
    },
  }));
}

function uniqueLedgerEvents(events = []) {
  const seen = new Set();
  return events.filter(Boolean).filter((event) => {
    const key = event.id || `${event.type}:${event.time}:${event.source}:${event.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortLedgerEvents(events = []) {
  return events
    .filter(Boolean)
    .map((event, index) => ({ event, index, timeMs: Date.parse(event.time) || 0 }))
    .sort((a, b) => a.timeMs - b.timeMs || a.index - b.index)
    .map(({ event }) => {
      const { sequence, projectId, ...eventWithoutRuntimeCursors } = event;
      return eventWithoutRuntimeCursors;
    });
}

function legacyKickoffLedgerEvents(project = {}) {
  const initiation = project.initiation || {};
  const roleTranscript = initiation.roleNegotiation?.transcript || project.roleNegotiation?.transcript || [];
  const leaderTranscript = initiation.leaderElection?.transcript || project.leaderElection?.transcript || [];
  const charter = project.kickoffCharter || {};
  const kickoffTime = charter.createdAt || initiation.approvedAt || initiation.createdAt || project.createdAt || nowIso();
  const directorBriefIds = charter.evidence?.directorBriefIds?.length
    ? charter.evidence.directorBriefIds
    : [initiation.directorBriefId].filter(Boolean);
  const directorBriefEvents = directorBriefIds.map((id) => createProjectLedgerEvent({
    id: `evt_${id}`,
    type: 'kickoff-director-brief',
    time: kickoffTime,
    actor: 'Director',
    summary: initiation.summary || project.currentObjective || project.objective || project.name || '',
    source: 'kickoff-meeting-migration',
    channelId: 'main',
    evidenceIds: [id],
    entityIds: { speakerId: 'director' },
    payload: { hears: (project.team || []).map((agent) => agent.id).filter(Boolean) },
  }));
  const roleSpeechEvents = roleTranscript
    .filter((item) => item?.type === 'role-question' || item?.type === 'role-volunteer')
    .map((item) => createProjectLedgerEvent({
      id: `evt_${item.id}`,
      type: item.type === 'role-question' ? 'kickoff-role-question' : 'kickoff-role-volunteer',
      time: item.createdAt || item.time || kickoffTime,
      actor: item.speaker || item.speakerId || 'Agent',
      summary: item.text || '',
      source: 'kickoff-meeting-migration',
      channelId: item.channelId || 'main',
      evidenceIds: [item.id],
      entityIds: { speakerId: item.speakerId || null },
      payload: { hears: item.hears || [] },
    }));
  const leaderCampaignEvents = leaderTranscript
    .filter(Boolean)
    .map((item) => createProjectLedgerEvent({
      id: `evt_${item.id}`,
      type: 'kickoff-leader-campaign',
      time: item.createdAt || item.time || kickoffTime,
      actor: item.speaker || item.speakerId || 'Agent',
      summary: item.text || '',
      source: 'kickoff-meeting-migration',
      channelId: item.channelId || 'main',
      evidenceIds: [item.id],
      entityIds: { speakerId: item.speakerId || null },
      payload: { hears: item.hearsOthers || item.hears || [] },
    }));
  const charterEvent = charter.id ? createProjectLedgerEvent({
    id: `evt_${charter.id}`,
    type: 'kickoff-charter-approved',
    time: kickoffTime,
    actor: 'Director',
    summary: `${charter.title || project.name || 'Project kickoff charter'} approved.`,
    source: 'kickoff-meeting-migration',
    channelId: 'main',
    evidenceIds: [
      charter.id,
      ...(charter.evidence?.directorBriefIds || []),
      ...(charter.evidence?.roleTranscriptIds || []),
      ...(charter.evidence?.leaderCampaignIds || []),
      ...(charter.evidence?.assignmentMessageIds || []),
      ...(charter.evidence?.acknowledgementMessageIds || []),
    ],
    entityIds: {
      leaderId: charter.governance?.leaderId || initiation.leaderId || null,
      reviewerId: charter.governance?.reviewerId || null,
    },
    payload: {
      roleQuestionCount: charter.meeting?.roleQuestionCount || roleSpeechEvents.filter((event) => event.type === 'kickoff-role-question').length,
      selfNominationCount: charter.meeting?.selfNominationCount || roleSpeechEvents.filter((event) => event.type === 'kickoff-role-volunteer').length,
      leaderCandidateCount: charter.meeting?.leaderCandidateCount || leaderCampaignEvents.length,
    },
  }) : null;

  return [
    ...(charter.ledgerEvents || []),
    ...(charter.ledgerEvent ? [charter.ledgerEvent] : []),
    ...directorBriefEvents,
    ...roleSpeechEvents,
    ...leaderCampaignEvents,
    charterEvent,
  ];
}

function legacyChangeLedgerEvents(changes = []) {
  return changes.map((change) => createProjectLedgerEvent({
    id: `evt_${change.id}`,
    type: 'change-confirmed-and-synced',
    time: change.requestedAt || change.confirmedAt || nowIso(),
    actor: change.ownerName || change.leadName || 'Responsible Agent',
    summary: `${change.ownerName || 'Owner'} accepted "${change.requestText || change.taskId || 'change'}" from ${change.source || 'change request'} and synced ${change.teamSyncCount || 0} Agent(s).`,
    source: change.source || 'change-ledger-migration',
    channelId: change.sourceChannelId || null,
    evidenceIds: [
      change.id,
      change.confirmationMessageId,
      change.syncMessageId,
      ...(change.discussionMessageIds || []),
    ].filter(Boolean),
    entityIds: {
      taskId: change.taskId || null,
      ownerId: change.ownerId || null,
      changeRecordId: change.id || null,
    },
    payload: {
      status: change.status || null,
      teamSyncCount: change.teamSyncCount || 0,
      sourceChannelId: change.sourceChannelId || null,
    },
  }));
}

function legacyPeerHandoffLedgerEvents(handoffs = []) {
  return handoffs.map((handoff) => createProjectLedgerEvent({
    id: `evt_${handoff.id}`,
    type: 'peer-handoff-accepted',
    time: handoff.acknowledgedAt || handoff.requestedAt || nowIso(),
    actor: handoff.requesterName || handoff.requesterId || 'Requesting Agent',
    summary: `${handoff.requesterName || 'Requester'} handed a dependency to ${handoff.targetName || 'peer'} and received acknowledgement.`,
    source: 'peer-handoff-migration',
    channelId: handoff.sourceChannelId || null,
    evidenceIds: [
      handoff.id,
      handoff.requestMessageId,
      handoff.acknowledgementMessageId,
    ].filter(Boolean),
    entityIds: {
      taskId: handoff.taskId || null,
      requesterId: handoff.requesterId || null,
      targetAgentId: handoff.targetId || null,
    },
    payload: { status: handoff.status || null },
  }));
}

function legacyAutonomousSchedulerLedgerEvents(schedulerRecords = []) {
  return schedulerRecords.map((record) => createProjectLedgerEvent({
    id: `evt_${record.id}`,
    type: 'autonomous-scheduler',
    time: record.ranAt || record.dueAt || record.createdAt || nowIso(),
    actor: 'Agent Runtime',
    summary: `${record.trigger || 'autonomous'} ${record.cadence || 'hourly'} cycle ran; next run ${record.nextRunAt || 'unscheduled'}.`,
    source: 'autonomous-scheduler-migration',
    evidenceIds: [record.id].filter(Boolean),
    entityIds: { cycleId: record.cycleId || record.id || null },
    payload: {
      trigger: record.trigger || null,
      reason: record.reason || record.schedulerReason || null,
      dueAt: record.dueAt || null,
      nextRunAt: record.nextRunAt || null,
    },
  }));
}

export function backfillProjectEventLedger(project = {}) {
  const retainedEvents = Array.isArray(project.eventLedger) ? project.eventLedger : [];
  const ledgerCandidate = retainedEvents.length > 0
    ? project
    : {
        ...project,
        eventLedger: [],
        eventLedgerChainVersion: 1,
        eventLedgerPreviousHash: EVENT_LEDGER_GENESIS_HASH,
        eventLedgerRootHash: EVENT_LEDGER_GENESIS_HASH,
        eventLedgerFirstSequence: 0,
        eventLedgerLastSequence: 0,
        eventLedgerEventCount: 0,
      };
  const chainedProject = sealLegacyProjectEventLedger(ledgerCandidate);
  const integrity = verifyProjectEventLedger(chainedProject);
  if (!integrity.valid) return { ...project, eventLedgerIntegrityStatus: 'invalid' };
  const currentSummary = summarizeProjectEventLedger(chainedProject);
  const retainedProjection = projectEventReplayProjection(chainedProject, { includeRecovered: false });
  if (currentSummary.contiguous && retainedProjection.replayReady) return chainedProject;

  const generatedEvents = uniqueLedgerEvents(sortLedgerEvents([
    ...(chainedProject.eventLedger || []),
    ...legacyKickoffLedgerEvents(chainedProject),
    ...ledgerEventsFromLogs(chainedProject.logs || [], 'timeline-log-migration'),
    ...legacyChangeLedgerEvents(chainedProject.changeLedger || []),
    ...legacyPeerHandoffLedgerEvents(chainedProject.peerHandoffs || []),
    ...legacyAutonomousSchedulerLedgerEvents(chainedProject.autonomousSchedulerLedger || []),
  ]));

  if (!generatedEvents.length) return project;

  return appendProjectEvents({
    ...chainedProject,
    eventLedger: [],
    eventLedgerPreviousHash: EVENT_LEDGER_GENESIS_HASH,
    eventLedgerRootHash: EVENT_LEDGER_GENESIS_HASH,
    eventLedgerFirstSequence: 0,
    eventLedgerLastSequence: 0,
    eventLedgerEventCount: 0,
  }, generatedEvents);
}

export function summarizeProjectEventLedger(project = {}) {
  const events = project.eventLedger || [];
  const typeCounts = events.reduce((counts, event) => ({
    ...counts,
    [event.type]: (counts[event.type] || 0) + 1,
  }), {});
  const integrity = verifyProjectEventLedger(project);
  const contiguous = integrity.valid && events.every((event, index) => (
    index === 0 || event.sequence === events[index - 1].sequence + 1
  ));
  const latestByType = Object.fromEntries(events.map((event) => [event.type, event]));
  const replayProjection = projectEventReplayProjection(project);
  const replayCoverage = replayProjection.coverage || {};
  return {
    eventCount: project.eventLedgerEventCount || project.eventLedgerLastSequence || events.length,
    retainedCount: events.length,
    firstSequence: project.eventLedgerFirstSequence || events[0]?.sequence || 0,
    lastSequence: project.eventLedgerLastSequence || events[events.length - 1]?.sequence || 0,
    contiguous,
    integrity,
    typeCounts,
    latestByType,
    replayProjection,
    coverage: {
      kickoff: Boolean(typeCounts['kickoff-charter-approved'] || replayCoverage.kickoff),
      kickoffRoleQuestion: Boolean(typeCounts['kickoff-role-question'] || replayCoverage.kickoffRoleQuestion),
      kickoffRoleVolunteer: Boolean(typeCounts['kickoff-role-volunteer'] || replayCoverage.kickoffRoleVolunteer),
      kickoffLeaderCampaign: Boolean(typeCounts['kickoff-leader-campaign'] || replayCoverage.kickoffLeaderCampaign),
      leaderAssignment: Boolean(typeCounts['leader-assignment'] || replayCoverage.leaderAssignment),
      change: Boolean(typeCounts['change-confirmed-and-synced'] || replayCoverage.change),
      peerHandoff: Boolean(typeCounts['peer-handoff-accepted'] || replayCoverage.peerHandoff),
      autonomous: Boolean(typeCounts['autonomous-scheduler'] || replayCoverage.autonomous),
    },
  };
}

function replayEventsForProject(project = {}, { includeRecovered = true } = {}) {
  if (!includeRecovered) return project.eventLedger || [];
  return uniqueLedgerEvents(sortLedgerEvents([
    ...(project.eventLedger || []),
    ...legacyKickoffLedgerEvents(project),
    ...legacyChangeLedgerEvents(project.changeLedger || []),
    ...legacyPeerHandoffLedgerEvents(project.peerHandoffs || []),
    ...legacyAutonomousSchedulerLedgerEvents(project.autonomousSchedulerLedger || []),
  ]));
}

export function projectEventReplayProjection(project = {}, { includeRecovered = true } = {}) {
  const events = replayEventsForProject(project, { includeRecovered });
  const typeCounts = events.reduce((counts, event) => ({
    ...counts,
    [event.type]: (counts[event.type] || 0) + 1,
  }), {});
  const byType = (type) => events.filter((event) => event.type === type);
  const roleQuestions = byType('kickoff-role-question');
  const roleVolunteers = byType('kickoff-role-volunteer');
  const leaderCampaigns = byType('kickoff-leader-campaign');
  const assignments = byType('leader-assignment');
  const assignmentAcks = byType('assignment-acknowledged');
  const changes = byType('change-confirmed-and-synced');
  const handoffs = byType('peer-handoff-accepted');
  const autonomousSchedulers = byType('autonomous-scheduler');
  const managementEvents = events.filter((event) => ['management-check-in', 'peer-management-check-in', 'review-sweep'].includes(event.type));
  const taskCompletions = byType('task-completed');

  return {
    typeCounts,
    kickoffSpeechCount: roleQuestions.length + roleVolunteers.length + leaderCampaigns.length,
    roleQuestionCount: roleQuestions.length,
    roleVolunteerCount: roleVolunteers.length,
    leaderCampaignCount: leaderCampaigns.length,
    leaderAssignmentCount: assignments.length,
    assignmentAcknowledgementCount: assignmentAcks.length,
    changeConfirmationCount: changes.length,
    peerHandoffCount: handoffs.length,
    autonomousRunCount: autonomousSchedulers.length,
    managementEventCount: managementEvents.length,
    taskCompletionCount: taskCompletions.length,
    latestEvent: events[events.length - 1] || null,
    coverage: {
      kickoff: Boolean(typeCounts['kickoff-charter-approved']),
      kickoffRoleQuestion: Boolean(typeCounts['kickoff-role-question']),
      kickoffRoleVolunteer: Boolean(typeCounts['kickoff-role-volunteer']),
      kickoffLeaderCampaign: Boolean(typeCounts['kickoff-leader-campaign']),
      leaderAssignment: Boolean(typeCounts['leader-assignment']),
      change: Boolean(typeCounts['change-confirmed-and-synced']),
      peerHandoff: Boolean(typeCounts['peer-handoff-accepted']),
      autonomous: Boolean(typeCounts['autonomous-scheduler']),
    },
    replayReady: Boolean(
      roleQuestions.length
      && roleVolunteers.length
      && leaderCampaigns.length
      && assignments.length
      && changes.length
      && handoffs.length
      && autonomousSchedulers.length
    ),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getMeetingProtocol(type = DEFAULT_PROTOCOL_ID, language = 'en') {
  const protocol = MEETING_PROTOCOLS[type] || MEETING_PROTOCOLS[DEFAULT_PROTOCOL_ID];
  const translated = createTranslator(language)(`protocols.${protocol.id}`);
  return translated && typeof translated === 'object' ? { ...protocol, ...translated } : protocol;
}

function getCadence(cadence = 'hourly') {
  return WORK_CADENCE[cadence] || WORK_CADENCE.hourly;
}

export function intervalMsForCadence(cadence = 'hourly') {
  return getCadence(cadence).horizonHours * 60 * 60 * 1000;
}

function safeDateMs(value, fallback = Date.now()) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function evaluateAutonomousSchedule({ project = {}, cadence = project.autonomy?.cadence || project.autonomousCadence || 'hourly', now = nowIso() } = {}) {
  const intervalMs = intervalMsForCadence(cadence);
  const lastRunAt = project.lastAutonomousRunAt || null;
  const storedNextRunAt = project.nextAutonomousRunAt || null;
  const enabled = Boolean(project.autonomy?.enabled);
  const schedule = evaluateLocalIntervalSchedule({
    lane: 'project', now, intervalMs, lastCompletedAt: lastRunAt, storedNextAt: storedNextRunAt,
    enabled,
    reasons: {
      disabled: 'autonomy-paused', first: 'no-previous-autonomous-cycle',
      due: `${cadence}-cadence-due`, waiting: `${cadence}-cadence-waiting`,
      clockRegression: 'project-clock-regression-recovery', missed: 'project-missed-cadence-recovery',
    },
  });

  return {
    ...schedule,
    cadence,
    enabled,
    lastRunAt,
    intervalMs,
    lagMs: schedule.due ? Math.max(0, Date.parse(schedule.now) - Date.parse(schedule.scheduledAt)) : 0,
  };
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
    context,
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

function workRoutineForAgent(agent = {}, language = 'en') {
  const capability = (agent.capabilities || []).find((item) => WORK_ROUTINES[item]) || 'generalist';
  const routine = WORK_ROUTINES[capability] || WORK_ROUTINES.generalist;
  const translated = createTranslator(language)(`routines.${capability}`);
  return {
    ...routine,
    ...(translated && typeof translated === 'object' ? translated : {}),
    capability,
    checklist: [...((translated && typeof translated === 'object' ? translated.checklist : routine.checklist) || routine.checklist)],
  };
}

function buildFallbackReply(agent, directive = '', context = {}) {
  const t = createTranslator(context.language);
  const leadName = context.lead?.id === agent.id
    ? t('agent.fallbackLead')
    : t('agent.fallbackSync', { lead: context.lead?.name || t('common.manager') });
  const reviewerName = context.reviewer?.id === agent.id
    ? t('agent.fallbackReviewerSelf')
    : t('agent.fallbackReviewer', { reviewer: context.reviewer?.name || t('common.manager') });
  const rawFocus = context.intent?.target || fallbackIntent(agent);
  const focus = normalizeLanguage(context.language) === 'en' && /[\u4e00-\u9fff]/.test(rawFocus)
    ? fallbackIntent(agent)
    : rawFocus;
  const directiveText = directive ? t('agent.fallbackDirective', { directive: directive.slice(0, 96) }) : '';
  const protocol = getMeetingProtocol(context.meetingType, context.language);
  const frame = context.isLead ? protocol.leadFrame : protocol.memberFrame;
  return t('agent.fallbackReply', {
    leadLine: leadName,
    reviewerLine: reviewerName,
    directiveLine: directiveText,
    focus,
    frame: frameSentence(frame),
  });
}

function buildAgentReply(agent, directive = '', context = {}) {
  const skill = getPersonSkill(agent.id);
  if (normalizeLanguage(context.language) === 'en') return buildFallbackReply(agent, directive, context);
  if (!skill) return buildFallbackReply(agent, directive, context);
  const reply = buildSkillRoomReply(agent.id, directive, context.intent || {});
  if (!reply) return buildFallbackReply(agent, directive, context);
  const protocol = getMeetingProtocol(context.meetingType, context.language);
  const frame = context.isLead ? protocol.leadFrame : protocol.memberFrame;
  const managedNames = (agent.managedIds || [])
    .map((id) => getAgent(context.network, id)?.name)
    .filter(Boolean);
  const managementLine = managedNames.length
    ? (normalizeLanguage(context.language) === 'zh'
      ? ` 我会协调 ${managedNames.join('、')}，并保持决策路径清晰。`
      : ` I will coordinate ${managedNames.join(', ')} and keep the decision path explicit.`)
    : '';
  return normalizeLanguage(context.language) === 'zh'
    ? `${reply}${managementLine} 框架：${frameSentence(frame)}。`
    : `${reply}${managementLine} Frame: ${frameSentence(frame)}.`;
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
  const language = normalizeLanguage(context.language);
  const t = createTranslator(language);
  const network = createAgentNetwork(team, context);
  const facilitator = getLead(network);
  const reviewer = getReviewer(network);
  const protocol = getMeetingProtocol(context.meetingType || 'kickoff', language);
  const openingText = facilitator
    ? t('agent.opening', {
      facilitator: facilitator.name,
      protocol: protocol.label,
      reviewerLine: reviewer ? t('agent.reviewerLine', { reviewer: reviewer.name }) : '',
      frame: frameSentence(protocol.memberFrame),
    })
    : t('agent.networkOnlinePrompt');

  return localizeGeneratedObject({
    network,
    protocol,
    events: [
      { kind: 'system', text: t('agent.networkOnline', { projectName: context.projectName || 'Untitled Project' }) },
      facilitator ? { kind: 'agent', agent: facilitator, text: openingText } : null,
    ].filter(Boolean),
  }, language);
}

export function routeDirectorDirective({ team = [], directive = '', targetIds = [], context = {} }) {
  const language = normalizeLanguage(context.language);
  const t = createTranslator(language);
  const network = createAgentNetwork(team, { ...context, directive, topic: directive });
  const targets = selectTargets(network, targetIds, directive);
  const targetNames = targets.length ? targets.map((agent) => agent.name.toUpperCase()) : ['ALL'];
  const intentions = buildIntentions(network, directive);
  const intentById = new Map(intentions.map((intent) => [intent.id, intent]));
  const protocol = getMeetingProtocol(context.meetingType, language);
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
      language,
    }),
    delayMs: meetingTurnDelayMs(index),
  }));

  const coordination = lead && reviewer && !targets.some((agent) => agent.id === lead.id)
    ? [{
      kind: 'agent',
      agent: lead,
      text: t('agent.coordination', { reviewer: reviewer.name, output: protocol.output }),
      delayMs: meetingTurnDelayMs(replies.length),
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
  const language = normalizeLanguage(context.language);
  const network = createAgentNetwork(team, { ...context, directive, topic: directive });
  const intentions = buildIntentions(network, directive);
  const intentById = new Map(intentions.map((intent) => [intent.id, intent]));
  const maxSpeakers = Math.max(1, Math.min(
    intentions.length,
    Number(context.maxSpeakers) || intentions.length,
  ));
  const speakers = intentions.slice(0, maxSpeakers);
  const protocol = getMeetingProtocol(context.meetingType || 'sync', language);
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
        delayMs: meetingTurnDelayMs(index),
        text: buildAgentReply(agent, directive, {
          network,
          lead,
          reviewer,
          intent: intentById.get(intent.id),
          isLead: lead?.id === agent.id,
          meetingType: protocol.id,
          language,
        }),
      };
    }),
  };
}

export function buildAgentChatReplies({ team = [], text = '', targets = [], channelId = 'main', context = {} }) {
  const language = normalizeLanguage(context.language);
  const t = createTranslator(language);
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
      language,
      maxSpeakers: explicitAll ? 3 : Math.max(1, targetIds.length || 2),
    },
  });

  const replies = attachReceiptsToMessages(processed.utterances.map((utterance, index) => {
    const agent = processed.network.agents.find((item) => item.id === utterance.agentId);
    const reading = processed.readings.find((item) => item.agentId === utterance.agentId);
    return {
      id: `agent_chat_${Date.now()}_${index}`,
      channelId,
      type: utterance.obligationCount ? 'mention' : 'text',
      author: agent?.name || utterance.agentId,
      role: agent?.role || t('common.agent'),
      time: t('agent.timeNow'),
      text: utterance.text,
      targets: utterance.obligationCount ? [DIRECTOR_AGENT_ID] : [],
      weight: utterance.obligationCount ? t('agent.obligation') : null,
      diagnostics: reading ? {
        attentionScore: reading.score,
        reasons: reasonLabels(reading.reasons),
        obligationCount: reading.obligations.length,
        decision: reading.shouldSpeak ? 'speak' : reading.shouldRead ? 'read' : 'ignore',
      } : null,
    };
  }), team, { seenAt: context.now || null });
  return localizeGeneratedObject(replies, language);
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
    }).join(', ') || createTranslator(message.language || network?.context?.language)('agent.ambientSignal'),
    reasons: {
      directMention,
      fromLead: Boolean(fromLead),
      fromManagedPeer: Boolean(fromManagedPeer),
      capabilityMatch,
    },
    obligations,
  };
}

function targetMatchesAgent(target = '', agent = {}) {
  const normalized = String(target).toLowerCase();
  if (!normalized) return false;
  return normalized === String(agent.id || '').toLowerCase()
    || normalized === String(agent.name || '').toLowerCase()
    || (agent.slug && normalized === String(agent.slug).toLowerCase());
}

function authorMatchesAgent(message = {}, agent = {}) {
  return targetMatchesAgent(message.authorId || '', agent)
    || targetMatchesAgent(message.author || '', agent);
}

export function attachMessageReceipts(message = {}, team = [], options = {}) {
  const targetTokens = new Set([
    ...(message.targetIds || []),
    ...(message.targets || []),
  ].map((target) => String(target).toLowerCase()));
  const text = message.text || '';
  const broadcast = options.broadcast ?? (
    targetTokens.has('all')
    || /@all\b/i.test(text)
    || ['main', 'google_chat'].includes(message.channelId)
  );
  const directTargets = team.filter((agent) => (
    targetTokens.has(String(agent.id || '').toLowerCase())
    || targetTokens.has(String(agent.name || '').toLowerCase())
    || text.toLowerCase().includes(`@${String(agent.name || '').toLowerCase()}`)
    || text.toLowerCase().includes(`@${String(agent.id || '').toLowerCase()}`)
  ));
  const recipients = team.filter((agent) => (
    !authorMatchesAgent(message, agent)
    && (broadcast || directTargets.some((target) => target.id === agent.id))
  ));
  const directTargetIds = directTargets.map((agent) => agent.id);
  const receipts = recipients.map((agent) => ({
    agentId: agent.id,
    agentName: agent.name,
    mode: directTargetIds.includes(agent.id) || targetTokens.has('all') ? 'direct' : 'ambient',
    seenAt: options.seenAt || message.createdAt || null,
    channelId: message.channelId || 'main',
  }));

  return {
    ...message,
    heardBy: receipts.map((receipt) => receipt.agentId),
    directTargetIds,
    receipts,
    visibility: {
      scope: broadcast ? 'project-team' : 'direct-targets',
      channelId: message.channelId || 'main',
      receiptCount: receipts.length,
      directTargetCount: directTargetIds.length,
    },
  };
}

export function attachReceiptsToMessages(messages = [], team = [], options = {}) {
  return messages.map((message) => attachMessageReceipts(message, team, options));
}

export function applyChatMessagesToAgentStates({
  project = {},
  team = project.team || [],
  messages = [],
  now = nowIso(),
  source = 'group-chat',
  language = project.language || 'en',
} = {}) {
  if (!messages.length) return project;
  const t = createTranslator(language);
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: messages.map((message) => message.text).join(' '),
  });
  const previousStates = project.agentStates || {};
  const nextAgentStates = { ...previousStates };

  network.agents.forEach((agent) => {
    const previous = previousStates[agent.id] || {};
    const receivedMessages = messages.filter((message) => (
      (message.receipts || []).some((receipt) => receipt.agentId === agent.id)
    ));
    const directMessages = receivedMessages.filter((message) => (
      (message.directTargetIds || []).includes(agent.id)
      || (message.receipts || []).some((receipt) => receipt.agentId === agent.id && receipt.mode === 'direct')
    ));
    const authoredMessages = messages.filter((message) => authorMatchesAgent(message, agent));
    if (!receivedMessages.length && !authoredMessages.length && previousStates[agent.id]) return;

    const existingMessageIds = new Set((previous.inbox || []).map((item) => item.sourceMessageId || item.messageId).filter(Boolean));
    const inboxItems = directMessages
      .filter((message) => !existingMessageIds.has(message.id))
      .map((message) => ({
        id: `chat_inbox_${message.id}_${agent.id}`,
        source,
        sourceMessageId: message.id,
        channelId: message.channelId || 'main',
        from: message.authorId || message.author || 'unknown',
        text: message.text || '',
        taskId: message.assignment?.taskId || message.assignmentReceipt?.taskId || message.handoffReceipt?.taskId || null,
        receiptMode: 'direct',
        receivedAt: now,
      }));
    const obligationItems = inboxItems.map((item) => ({
      id: `chat_obligation_${item.sourceMessageId}_${agent.id}`,
      source,
      sourceMessageId: item.sourceMessageId,
      text: item.text,
      status: 'open',
      openedAt: now,
      due: t('agent.nextVisibleResponse'),
    }));
    const worklogItems = authoredMessages.map((message) => ({
      id: `chat_worklog_${message.id}_${agent.id}`,
      at: now,
      kind: 'chat-message-sent',
      source,
      sourceMessageId: message.id,
      channelId: message.channelId || 'main',
      text: message.text || '',
    }));

    nextAgentStates[agent.id] = {
      agentId: agent.id,
      name: previous.name || agent.name,
      role: previous.role || agent.role,
      managerId: previous.managerId || agent.managerId || null,
      managedIds: previous.managedIds || agent.managedIds || [],
      peerManagedIds: previous.peerManagedIds || [],
      peerManagerId: previous.peerManagerId || null,
      peerManagerIds: previous.peerManagerIds || [],
      peerIds: previous.peerIds || agent.peerIds || [],
      status: inboxItems.length ? 'reading-chat' : previous.status || (authoredMessages.length ? 'responding-chat' : 'monitoring'),
      currentPlan: previous.currentPlan || {
        focus: t('agent.currentPlanFocus'),
        next: t('agent.currentPlanNext'),
        routine: workRoutineForAgent(agent, language),
      },
      taskIds: previous.taskIds || [],
      inbox: [...inboxItems, ...(previous.inbox || [])].slice(0, 80),
      obligations: [...obligationItems, ...(previous.obligations || [])].slice(0, 80),
      worklog: [...worklogItems, ...(previous.worklog || [])].slice(0, 80),
      lastActiveAt: (inboxItems.length || authoredMessages.length) ? now : previous.lastActiveAt || null,
    };
  });

  const ledgerEvents = messages.map((message) => createProjectLedgerEvent({
    id: `evt_chat_${message.id}`,
    type: 'group-chat-message',
    time: now,
    actor: message.author || message.authorId || 'Chat',
    summary: message.text || '',
    source,
    channelId: message.channelId || 'main',
    evidenceIds: [message.id],
    entityIds: {
      messageId: message.id,
    },
    payload: {
      receiptCount: message.visibility?.receiptCount || message.receipts?.length || 0,
      directTargetIds: message.directTargetIds || [],
      heardBy: message.heardBy || [],
    },
  }));

  return appendProjectEvents({
    ...project,
    agentStates: nextAgentStates,
  }, ledgerEvents);
}

export function planAgentUtterance(agent, reading, context = {}) {
  const language = normalizeLanguage(context.language);
  const t = createTranslator(language);
  const protocol = getMeetingProtocol(context.meetingType, language);
  const cadence = context.cadence ? getCadence(context.cadence) : null;
  const frame = cadence?.frame || (context.isLead ? protocol.leadFrame : protocol.memberFrame);
  const text = reading?.shouldSpeak
    ? t('agent.readReply', {
      agent: agent.name,
      frame: frameSentence(frame),
      action: reading.obligations?.length ? t('agent.readActionObligation') : t('agent.readActionLane'),
    })
    : t('agent.silentRead', { agent: agent.name });

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

function taskBelongsToAgent(task = {}, agent = {}) {
  return task.ownerId === agent.id
    || task.assignee === agent.id
    || task.assignee === agent.name;
}

function buildManagementEvents({ network, project = {}, cadence = 'hourly', language = project.language || network?.context?.language } = {}) {
  const currentLanguage = normalizeLanguage(language);
  const lead = getLead(network);
  const reviewer = getReviewer(network);
  const t = createTranslator(currentLanguage);
  const openTasks = (project.tasks || []).filter((task) => task.status !== 'done');
  const events = [];

  if (lead) {
    (lead.managedIds || [])
      .map((managedId) => getAgent(network, managedId))
      .filter(Boolean)
      .forEach((managedAgent) => {
        const ownedTasks = openTasks.filter((task) => taskBelongsToAgent(task, managedAgent));
        if (!ownedTasks.length) return;
        const blockedCount = ownedTasks.filter((task) => task.status === 'blocked').length;
        events.push({
          kind: 'management-check-in',
          agentId: lead.id,
          targetAgentId: managedAgent.id,
          targetName: managedAgent.name,
          taskIds: ownedTasks.map((task) => task.id).filter(Boolean).slice(0, 3),
          channel: 'team-management',
          text: currentLanguage === 'zh'
            ? `${lead.name}：@${managedAgent.name} 管理检查：当前有 ${ownedTasks.length} 个开放任务。${blockedCount ? `${blockedCount} 个阻塞需要升级；` : ''}请在下一次 ${cadence} 脉冲前确认下一项产物和时间线证据。`
            : `${lead.name}: @${managedAgent.name} management check-in for ${ownedTasks.length} open task${ownedTasks.length === 1 ? '' : 's'}. ${blockedCount ? `${blockedCount} blocker${blockedCount === 1 ? '' : 's'} need escalation; ` : ''}confirm next artifact and timeline proof before the next ${cadence} pulse.`,
        });
      });
  }

  if (reviewer && lead && reviewer.id !== lead.id && (cadence === 'daily' || (project.changeLedger || []).length || (project.peerHandoffs || []).length)) {
    const evidencedTasks = (project.tasks || [])
      .filter((task) => (task.timelineLogIds || []).length || task.completedAt || task.confirmationMessageId || task.acknowledgementMessageId)
      .slice(0, 4);
    events.push({
      kind: 'review-sweep',
      agentId: reviewer.id,
      targetAgentId: lead.id,
      targetName: lead.name,
      taskIds: evidencedTasks.map((task) => task.id).filter(Boolean),
      channel: 'evidence-review',
      text: currentLanguage === 'zh'
        ? `${reviewer.name}：@${lead.name} 复核扫描已启动。我正在检查 ${evidencedTasks.length || '当前'} 条证据线，确认分配证据、负责人确认和时间线连续性。`
        : `${reviewer.name}: @${lead.name} review sweep is active. I am checking ${evidencedTasks.length || 'the current'} evidence thread${evidencedTasks.length === 1 ? '' : 's'} for assignment proof, owner acknowledgement, and timeline continuity.`,
    });
  }

  Object.values(project.agentStates || {}).forEach((state) => {
    const requester = getAgent(network, state.agentId);
    if (!requester) return;
    (state.peerManagedIds || []).forEach((targetId) => {
      const target = getAgent(network, targetId);
      if (!target) return;
      const ownedTasks = openTasks.filter((task) => taskBelongsToAgent(task, target));
      events.push({
        kind: 'peer-management-check-in',
        agentId: requester.id,
        targetAgentId: target.id,
        targetName: target.name,
        taskIds: ownedTasks.map((task) => task.id).filter(Boolean).slice(0, 2),
        channel: 'peer-management',
        text: t('agent.managementCheckIn', {
          agent: requester.name,
          target: target.name,
          kind: t('agent.peerManagement'),
          focus: currentLanguage === 'zh' ? '我们的依赖' : 'our dependency',
        }),
      });
    });
  });

  return events.slice(0, 6);
}

export function planAutonomousWorkCycle({ team = [], project = {}, cadence = 'hourly', messages = [], now = nowIso(), language = project.language || 'en' }) {
  const currentLanguage = normalizeLanguage(language);
  const cadenceProfile = getCadence(cadence);
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: project.objective || project.name || '',
    language: currentLanguage,
  });
  const lead = getLead(network);
  const reviewer = getReviewer(network);

  const agentPlans = network.agents.map((agent) => {
    const routine = workRoutineForAgent(agent, currentLanguage);
    const blend = buildPersonaSkillBlend(agent.id, project.currentObjective || project.objective || project.name || '');
    const professionalSkill = {
      id: blend.selectedSkill.id,
      label: currentLanguage === 'zh' ? blend.selectedSkill.zh || blend.selectedSkill.label : blend.selectedSkill.label,
      method: blend.selectedProcess,
      personaEdge: blend.edge,
      affinity: blend.selectedAffinity,
    };
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
        focus: professionalSkill.label,
        horizonHours: cadenceProfile.horizonHours,
        evidenceRequired: agent.capabilities.includes('review') || reviewer?.id === agent.id,
        routine,
        professionalSkill,
      },
      publish: shouldPublish
        ? {
          agentId: agent.id,
          kind: cadence === 'daily' ? 'daily-report' : 'work-pulse',
          frame: cadenceProfile.frame,
          channel: lead?.id === agent.id ? 'project-ledger' : 'team-worklog',
          routine,
          professionalSkill,
          text: currentLanguage === 'zh'
            ? `${agent.name}：${routine.label}；${routine.checklist.join(' → ')}。负责人=${agent.name}；管理者=${agent.managerId ? getAgent(network, agent.managerId)?.name : '自己'}；产物=${routine.artifact}；下一周期=${cadenceProfile.horizonHours} 小时。`
            : `${agent.name}: ${routine.label}; ${routine.checklist.join(' -> ')}. Owner=${agent.name}; manager=${agent.managerId ? getAgent(network, agent.managerId)?.name : 'self'}; artifact=${routine.artifact}; next horizon=${cadenceProfile.horizonHours}h.`,
        }
        : null,
    };
  });
  const managementEvents = buildManagementEvents({ network, project, cadence, language: currentLanguage });
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
      text: currentLanguage === 'zh'
        ? `${lead.name}：汇总工作脉冲，解决跨 Agent 依赖，只升级需要总监判断的决策。`
        : `${lead.name}: consolidate work pulses, resolve cross-agent dependencies, and escalate only decisions that need Director judgment.`,
      watches: network.agents.filter((agent) => agent.id !== lead.id).map((agent) => agent.id),
    }
    : null;

  return {
    network,
    cadence,
    now,
    leadPlan,
    agentPlans,
    managementEvents,
    communicationDiagnostics,
    events: [
      leadPlan,
      ...managementEvents,
      ...agentPlans.map((plan) => plan.publish).filter(Boolean),
    ].filter(Boolean),
  };
}

function updateAgentStates({ project = {}, cycle, messages = [], tasks = [], logs = [], now = nowIso(), cadence = 'hourly', cycleId = '', scheduledNextRunAt = null, language = project.language || cycle?.network?.context?.language || 'en' }) {
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
    const managementInboxItems = (cycle.managementEvents || [])
      .filter((event) => event.targetAgentId === agent.id)
      .map((event, index) => ({
        id: `${cycleId}_management_inbox_${agent.id}_${index}`,
        messageId: `${cycleId}_${event.agentId}_${event.kind}_${index}`,
        from: event.agentId,
        source: event.kind,
        decision: 'accept',
        attentionScore: 100,
        explanation: `${event.kind} from ${getAgent(cycle.network, event.agentId)?.name || 'manager'}`,
        obligationCount: 1,
        taskIds: event.taskIds || [],
        receivedAt: now,
      }));
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
    ].slice(0, 80);
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
        routine: plan?.privateWork?.routine || workRoutineForAgent(agent, language),
        professionalSkill: plan?.privateWork?.professionalSkill || null,
      },
      taskIds: assignedTasks.map((task) => task.id).filter(Boolean),
      inbox: [...managementInboxItems, ...inboxItems, ...(previous.inbox || [])].slice(0, 80),
      obligations,
      worklog: [...worklogItems, ...(previous.worklog || [])].slice(0, 80),
      lastActiveAt: (plan?.publish || managementInboxItems.length || inboxItems.length || worklogItems.length) ? now : previous.lastActiveAt || null,
      nextAgentRunAt: scheduledNextRunAt || previous.nextAgentRunAt || null,
    }];
  }));
}

export function advanceAutonomousProjectCycle({
  project = {},
  team = project.team || [],
  cadence = 'hourly',
  messages = [],
  now = nowIso(),
  trigger = 'manual',
  schedulerReason = null,
  dueAt = null,
  language = project.language || 'en',
}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
  const cycle = planAutonomousWorkCycle({ team, project, cadence, messages, now, language: currentLanguage });
  const progressDelta = cadence === 'daily' ? 4 : 1;
  const publishEvents = cycle.events.filter((event) => event.text);
  const cycleId = `cycle_${cadence}_${Date.parse(now) || Date.now()}`;
  const intervalMs = intervalMsForCadence(cadence);
  const nowMs = safeDateMs(now);
  const nextRunAt = new Date(nowMs + intervalMs).toISOString();
  const schedulerRecord = {
    id: `scheduler_${cycleId}`,
    cycleId,
    cadence,
    trigger,
    reason: schedulerReason || (trigger === 'scheduler' ? `${cadence}-cadence-due` : `${trigger}-autonomous-cycle`),
    dueAt: dueAt || now,
    ranAt: now,
    nextRunAt,
    intervalHours: getCadence(cadence).horizonHours,
  };
  const nextLogs = publishEvents.map((event, index) => {
    const agent = cycle.network.agents.find((item) => item.id === event.agentId);
    return {
      id: `${cycleId}_${event.kind || 'event'}_${event.agentId || 'runtime'}_${event.targetAgentId || 'self'}_${index + 1}`,
      time: now,
      agent: agent?.name || 'Agent Runtime',
      agentId: event.agentId || null,
      log: event.text,
      cadence,
      eventType: event.kind || 'work-cycle',
      targetAgentId: event.targetAgentId || null,
      targetName: event.targetName || null,
      taskIds: event.taskIds || [],
      sourceChannelId: 'main',
      professionalSkill: event.professionalSkill || null,
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
        log: currentLanguage === 'zh'
          ? `${ownerPlan.name} 完成了“${task.text}”，并把结果发布到项目时间线。`
          : `${ownerPlan.name} completed "${task.text}" and published the result to the project timeline.`,
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
    scheduledNextRunAt: nextRunAt,
    language: currentLanguage,
  });
  const nextProjectState = {
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
        trigger,
        schedulerReason: schedulerRecord.reason,
        dueAt: schedulerRecord.dueAt,
        nextRunAt,
        leadId: cycle.leadPlan?.agentId || null,
        publishedEventCount: publishEvents.length,
        managementEventCount: cycle.managementEvents?.length || 0,
        managementEvents: (cycle.managementEvents || []).map((event) => ({
          kind: event.kind,
          agentId: event.agentId,
          targetAgentId: event.targetAgentId || null,
          taskIds: event.taskIds || [],
        })),
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
          professionalSkill: plan.privateWork?.professionalSkill || null,
        })),
        communicationDiagnostics: (cycle.communicationDiagnostics || [])
          .filter((item) => item.decision !== 'ignore' || item.obligationCount > 0)
          .slice(0, 24),
      },
      ...(project.autonomousLedger || []),
    ].slice(0, 50),
    lastAutonomousRunAt: now,
    nextAutonomousRunAt: nextRunAt,
    autonomousCadence: cadence,
    autonomousSchedulerLedger: [
      schedulerRecord,
      ...(project.autonomousSchedulerLedger || []),
    ].slice(0, 50),
  };
  const projectWithLedger = appendProjectEvents(nextProjectState, [
    createProjectLedgerEvent({
      id: `evt_${schedulerRecord.id}`,
      type: 'autonomous-scheduler',
      time: now,
      actor: 'Agent Runtime',
      summary: currentLanguage === 'zh'
        ? `${trigger} ${cadence} 循环已运行；下一次运行 ${nextRunAt}。`
        : `${trigger} ${cadence} cycle ran; next run ${nextRunAt}.`,
      source: 'autonomous-scheduler',
      evidenceIds: [schedulerRecord.id, cycleId],
      entityIds: { cycleId },
      payload: { reason: schedulerRecord.reason, dueAt: schedulerRecord.dueAt, nextRunAt },
    }),
    ...ledgerEventsFromLogs(combinedLogs, 'autonomous-cycle'),
  ]);

  return {
    cycle: {
      ...cycle,
      taskCompletionEvents: completedTaskLogs,
      agentStates: nextAgentStates,
    },
    project: projectWithLedger,
  };
}

export function createAutonomousCycleChatMessages({ project = {}, cycle = {}, cadence = cycle.cadence || 'hourly', projectId = project.id, language = project.language || cycle.network?.context?.language || 'en' } = {}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
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

  return attachReceiptsToMessages(cycleEvents.slice(0, 8).map((event, index) => {
    const agent = team.find((item) => item.id === event.agentId || item.name === event.agent);
    const isManagementEvent = ['management-check-in', 'peer-management-check-in', 'review-sweep'].includes(event.kind);
    return {
      id: `auto_${projectId || 'project'}_${timestamp}_${index}`,
      projectId: projectId || project.id || null,
      channelId: 'main',
      type: event.kind === 'coordination' ? 'decision' : isManagementEvent ? 'mention' : 'progress',
      author: agent?.name || event.agent || 'Agent Runtime',
      role: agent?.role || (currentLanguage === 'zh' ? '自治' : 'Autonomy'),
      time: event.kind === 'task-completed'
        ? t('agent.completedWeight')
        : isManagementEvent
          ? (currentLanguage === 'zh' ? '检查' : 'Check-in')
          : cadence === 'daily'
            ? (currentLanguage === 'zh' ? '每日' : 'Daily')
            : (currentLanguage === 'zh' ? '每小时' : 'Hourly'),
      text: event.text,
      targets: event.targetName ? [event.targetName] : [],
      weight: isManagementEvent ? t('agent.management') : undefined,
      decisionId: event.kind === 'coordination' ? `AUTO-${String(timestamp).slice(-4)}` : undefined,
      autonomous: {
        cadence,
        kind: event.kind || 'work-cycle',
        cycleId: cycle.id || null,
        professionalSkill: event.professionalSkill || null,
      },
    };
  }), team, { seenAt: cycleTime });
}

export function publishAutonomousCycleChat({
  project = {},
  cycle = {},
  cadence = cycle.cadence || 'hourly',
  projectId = project.id,
  now = cycle.now || cycle.ranAt || nowIso(),
  source = 'autonomous-cycle-chat',
  language = project.language || cycle.network?.context?.language || 'en',
} = {}) {
  const messages = createAutonomousCycleChatMessages({
    project,
    cycle,
    cadence,
    projectId,
    language,
  }).map((message) => ({
    ...message,
    source,
  }));
  if (!messages.length) {
    return { project, messages };
  }
  return {
    project: applyChatMessagesToAgentStates({
      project,
      team: project.team || cycle.network?.agents || [],
      messages,
      now,
      source,
      language,
    }),
    messages,
  };
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

export function evaluateManagerScenarioReadiness({ project = {}, team = project.team || [], messages = [] } = {}) {
  const charter = project.kickoffCharter || {};
  const evidence = charter.evidence || {};
  const projectLogs = project.logs || [];
  const projectTasks = project.tasks || [];
  const projectStates = project.agentStates || {};
  const changes = project.changeLedger || [];
  const peerHandoffs = project.peerHandoffs || [];
  const ledger = project.autonomousLedger || [];
  const schedulerLedger = project.autonomousSchedulerLedger || [];
  const eventLedger = project.eventLedger || [];
  const eventLedgerSummary = summarizeProjectEventLedger(project);
  const leaderId = charter.governance?.leaderId || team.find((agent) => agent.isLeader)?.id || null;
  const leader = team.find((agent) => agent.id === leaderId || agent.isLeader);
  const latestCycle = ledger[0] || null;
  const projectMessages = messages.filter((message) => !project.id || !message.projectId || message.projectId === project.id);
  const add = (id, passed, label, detail = '') => ({ id, passed: Boolean(passed), label, detail });
  const agentNameById = Object.fromEntries(team
    .filter((agent) => agent.id)
    .map((agent) => [agent.id, agent.name || agent.id]));
  const hasDurableChangeSyncReceipt = (change, agentId) => {
    const agentState = projectStates[agentId] || {};
    const agentName = agentNameById[agentId] || agentId;
    const teamSyncAgentIds = change.teamSyncAgentIds || [];
    const matchesChange = (text = '') => !change.requestText || String(text).includes(change.requestText);
    const directReceipt = (record = {}) => (
      (record.directTargetIds || []).includes(agentId)
      || (record.payload?.directTargetIds || []).includes(agentId)
      || (Number(record.receiptCount || record.payload?.receiptCount || 0) >= teamSyncAgentIds.length && teamSyncAgentIds.length > 0)
      || String(record.summary || record.log || '').includes(`@${agentName}`)
      || /@all\b/i.test(String(record.summary || record.log || ''))
    );

    return (agentState.inbox || []).some((item) => item.source === 'change-sync' && item.taskId === change.taskId)
      || (agentState.worklog || []).some((item) => item.kind === 'change-sync-received' && matchesChange(item.text))
      || projectLogs.some((log) => (
        log.eventType === 'change-sync'
        && (!change.syncMessageId || log.id === `log_${change.syncMessageId}` || String(log.id || '').includes(change.syncMessageId) || matchesChange(log.log))
        && directReceipt(log)
      ))
      || eventLedger.some((event) => (
        event.type === 'change-sync'
        && (!change.syncMessageId || event.entityIds?.messageId === change.syncMessageId || (event.evidenceIds || []).includes(`log_${change.syncMessageId}`) || matchesChange(event.summary))
        && directReceipt(event)
      ))
      || Boolean(change.teamStateSynced && teamSyncAgentIds.includes(agentId) && (change.syncMessageId || change.teamSyncCount));
  };

  const changeWithOwnerSync = changes.find((change) => {
    const ownerState = projectStates[change.ownerId] || {};
    return change.status === 'confirmed-and-synced'
      && change.ownerStateUpdated
      && (
        ownerState.currentPlan?.taskId === change.taskId
        || (ownerState.taskIds || []).includes(change.taskId)
        || (ownerState.obligations || []).some((item) => item.taskId === change.taskId)
        || (ownerState.worklog || []).some((item) => item.text?.includes(change.requestText))
      );
  });
  const changeWithTeamSync = changes.find((change) => (
    change.status === 'confirmed-and-synced'
    && change.teamStateSynced
    && (change.teamSyncAgentIds || []).length > 0
    && (change.teamSyncAgentIds || []).every((agentId) => hasDurableChangeSyncReceipt(change, agentId))
  ));
  const logTypes = new Set(projectLogs.map((log) => log.eventType).filter(Boolean));
  const managementLogTypes = ['management-check-in', 'peer-management-check-in', 'review-sweep'];
  const hasManagementTimeline = projectLogs.some((log) => managementLogTypes.includes(log.eventType));
  const hasManagementInbox = Object.values(projectStates).some((state) => (
    (state.inbox || []).some((item) => managementLogTypes.includes(item.source))
  ));
  const hasMessageReceiptEvidence = projectMessages.some((message) => (
    (message.heardBy || []).length > 0
    && (message.receipts || []).length === (message.heardBy || []).length
    && message.visibility?.receiptCount > 0
  ));
  const hasDurableReceiptEvidence = projectLogs.some((log) => log.receiptCount > 0);
  const durableGroupChatEvidence = Boolean(
    (evidence.assignmentMessageIds || []).length
      || peerHandoffs.some((handoff) => handoff.requestMessageId && handoff.acknowledgementMessageId)
      || changes.some((change) => (change.discussionMessageIds || []).length)
      || ledger.some((cycle) => cycle.publishedEventCount > 0 || cycle.managementEventCount > 0)
  );
  const evidenceTasks = projectTasks.filter((task) => (
    task.source === 'leader-chat-assignment'
    || task.source === 'peer-handoff'
    || task.source === 'google-chat-mention-change-request'
    || task.source === 'war-room-meeting-change-request'
    || task.assignedBy
  ));
  const taskHasMessageEvidence = (task) => Boolean(
    (task.assignmentMessageId && task.acknowledgementMessageId)
    || (task.requestMessageId && task.acknowledgementMessageId)
    || (task.confirmationMessageId && task.syncMessageId)
  );

  const checks = [
    add(
      'kickoff-approved',
      charter.status === 'approved',
      'Kickoff approved',
      charter.status ? `${charter.title || 'Project'} is ${charter.status}.` : 'No approved kickoff charter.',
    ),
    add(
      'role-clarification',
      (charter.meeting?.roleQuestionCount || 0) > 0 && (charter.meeting?.selfNominationCount || 0) > 0,
      'Role questions and self-nominations captured',
      `${charter.meeting?.roleQuestionCount || 0} role question(s), ${charter.meeting?.selfNominationCount || 0} self-nomination(s).`,
    ),
    add(
      'agents-hear-each-other',
      (evidence.roleHearingEdges || []).some((edge) => edge.hears?.length > 0)
        && (evidence.leaderHearingEdges || []).some((edge) => edge.hears?.length > 0),
      'Agents hear peer turns',
      `${(evidence.roleHearingEdges || []).length} role hearing edge(s), ${(evidence.leaderHearingEdges || []).length} Leader hearing edge(s).`,
    ),
    add(
      'leader-election-confirmed',
      Boolean(leader && leader.isLeader && (charter.meeting?.leaderCandidateCount || 0) >= 2),
      'Leader elected and confirmed',
      leader ? `${leader.name} has Leader marker after ${charter.meeting?.leaderCandidateCount || 0} candidate(s).` : 'No confirmed Leader marker.',
    ),
    add(
      'leader-assignments-acknowledged',
      (evidence.assignmentMessageIds || []).length > 0
        && (evidence.acknowledgementMessageIds || []).length >= (evidence.assignmentMessageIds || []).length
        && logTypes.has('leader-assignment')
        && logTypes.has('assignment-acknowledged'),
      'Leader @assignments acknowledged',
      `${(evidence.assignmentMessageIds || []).length} assignment message(s), ${(evidence.acknowledgementMessageIds || []).length} acknowledgement(s).`,
    ),
    add(
      'task-evidence-linked',
      evidenceTasks.length > 0
        && evidenceTasks.every((task) => taskHasMessageEvidence(task) && task.sourceChannelId && (task.timelineLogIds || []).length > 0),
      'Tasks link chat and timeline evidence',
      `${evidenceTasks.filter((task) => taskHasMessageEvidence(task) && task.sourceChannelId && (task.timelineLogIds || []).length > 0).length}/${evidenceTasks.length} evidence task(s) linked.`,
    ),
    add(
      'agent-states-independent',
      team.length > 0 && team.every((agent) => projectStates[agent.id]?.currentPlan?.routine?.id),
      'Independent Agent states and routines',
      `${Object.keys(projectStates).length}/${team.length} Agent state(s) with current plans.`,
    ),
    add(
      'autonomous-work-running',
      Boolean(latestCycle?.publishedEventCount > 0 && latestCycle.agentPlans?.every((plan) => plan.routineId && plan.routineArtifact)),
      '24/7 autonomous work evidence',
      latestCycle ? `${latestCycle.cadence} cycle, ${latestCycle.publishedEventCount} published event(s).` : 'No autonomous cycle recorded.',
    ),
    add(
      'management-loop-running',
      Boolean(latestCycle?.managementEventCount > 0 && hasManagementTimeline && hasManagementInbox),
      'Agents actively manage each other',
      latestCycle ? `${latestCycle.managementEventCount || 0} management event(s), timeline=${hasManagementTimeline}, inbox=${hasManagementInbox}.` : 'No autonomous management cycle recorded.',
    ),
    add(
      'autonomous-scheduler-evidence',
      Boolean(project.nextAutonomousRunAt && schedulerLedger[0]?.nextRunAt === project.nextAutonomousRunAt && latestCycle?.nextRunAt === project.nextAutonomousRunAt),
      'Autonomous scheduler evidence',
      schedulerLedger[0] ? `${schedulerLedger[0].trigger} / ${schedulerLedger[0].reason} / next ${schedulerLedger[0].nextRunAt}.` : 'No scheduler ledger record.',
    ),
    add(
      'timeline-progress',
      logTypes.has('work-pulse') || logTypes.has('daily-report') || logTypes.has('task-completed'),
      'Progress reaches timeline',
      logTypes.has('task-completed') ? 'Task completion published.' : 'Work pulse or daily report published.',
    ),
    add(
      'group-chat-visible',
      projectMessages.some((message) => message.channelId === 'main' && (message.type === 'mention' || message.type === 'progress' || message.type === 'decision'))
        || durableGroupChatEvidence,
      'Group chat evidence visible',
      durableGroupChatEvidence
        ? 'Durable project evidence contains group-chat messages.'
        : `${projectMessages.filter((message) => message.channelId === 'main').length} main-channel message(s).`,
    ),
    add(
      'message-receipts-recorded',
      hasMessageReceiptEvidence || hasDurableReceiptEvidence,
      'Message receipt evidence recorded',
      hasMessageReceiptEvidence
        ? `${projectMessages.filter((message) => message.visibility?.receiptCount > 0).length} message(s) carry receipts.`
        : `${projectLogs.filter((log) => log.receiptCount > 0).length} durable log receipt(s).`,
    ),
    add(
      'event-ledger-continuity',
      eventLedger.length > 0
        && eventLedgerSummary.contiguous
        && eventLedgerSummary.lastSequence >= eventLedgerSummary.firstSequence
        && eventLedgerSummary.coverage.kickoff
        && eventLedgerSummary.coverage.kickoffRoleQuestion
        && eventLedgerSummary.coverage.kickoffRoleVolunteer
        && eventLedgerSummary.coverage.kickoffLeaderCampaign
        && eventLedgerSummary.coverage.leaderAssignment
        && eventLedgerSummary.coverage.change
        && eventLedgerSummary.coverage.peerHandoff
        && eventLedgerSummary.coverage.autonomous,
      'Unified project event ledger',
      eventLedger.length
        ? `${eventLedgerSummary.retainedCount}/${eventLedgerSummary.eventCount} event(s), sequence ${eventLedgerSummary.firstSequence}-${eventLedgerSummary.lastSequence}.`
        : 'No project event ledger.',
    ),
    add(
      'event-ledger-replay-ready',
      Boolean(eventLedgerSummary.replayProjection.replayReady),
      'Event ledger can replay manager scenario',
      eventLedgerSummary.replayProjection.replayReady
        ? `${eventLedgerSummary.replayProjection.kickoffSpeechCount} kickoff speech event(s), ${eventLedgerSummary.replayProjection.leaderAssignmentCount} assignment(s), ${eventLedgerSummary.replayProjection.changeConfirmationCount} change(s), ${eventLedgerSummary.replayProjection.peerHandoffCount} handoff(s), ${eventLedgerSummary.replayProjection.autonomousRunCount} autonomous run(s).`
        : 'Event ledger is missing one or more replay stages.',
    ),
    add(
      'peer-handoff-accepted',
      peerHandoffs.some((handoff) => handoff.status === 'accepted') && logTypes.has('peer-handoff') && logTypes.has('peer-handoff-ack'),
      'Agent-to-Agent handoff accepted',
      `${peerHandoffs.length} peer handoff record(s).`,
    ),
    add(
      'midproject-change-synced',
      Boolean(changeWithOwnerSync),
      'Mid-project change confirmed and synced',
      changeWithOwnerSync ? `${changeWithOwnerSync.ownerName || changeWithOwnerSync.ownerId} owns ${changeWithOwnerSync.taskId}.` : 'No owner-synced change record.',
    ),
    add(
      'team-received-change-sync',
      Boolean(changeWithTeamSync),
      'Team received owner sync',
      changeWithTeamSync ? `${changeWithTeamSync.teamSyncCount || changeWithTeamSync.teamSyncAgentIds?.length || 0} Agent sync receipt(s).` : 'No team sync receipt state.',
    ),
    add(
      'google-chat-change-source',
      changes.some((change) => change.sourceChannelId === 'google_chat'),
      'Google Chat source preserved',
      `${changes.filter((change) => change.sourceChannelId === 'google_chat').length} Google Chat change(s).`,
    ),
    add(
      'meeting-change-source',
      changes.some((change) => change.source === 'war-room-meeting-change-request'),
      'Meeting change source preserved',
      `${changes.filter((change) => change.source === 'war-room-meeting-change-request').length} meeting change(s).`,
    ),
    add(
      'dual-channel-change-source',
      changes.some((change) => (
        change.source === 'multi-channel-change-request'
        && (change.sourceMessageIds || []).length >= 2
        && ((change.sourceModes || []).includes('war_room_meeting') || (change.sourceChannelIds || []).includes('main'))
        && (change.sourceChannelIds || []).includes('google_chat')
      )),
      'Meeting plus Google Chat broadcast preserved',
      `${changes.filter((change) => change.source === 'multi-channel-change-request').length} dual-channel change(s).`,
    ),
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  return {
    status: checks.every((check) => check.passed) ? 'manager-ready' : 'needs-evidence',
    score: checks.length ? Math.round((passedCount / checks.length) * 100) : 0,
    passedCount,
    totalCount: checks.length,
    checks,
  };
}

export function createLeaderElection(team = [], projectBrief = '', context = {}) {
  const currentLanguage = normalizeLanguage(context.language || 'en');
  const network = createAgentNetwork(team, {
    ...context,
    topic: projectBrief,
  });
  const candidates = [...network.agents]
    .map((agent) => {
      const score = Math.round(managementScore(agent) + (hasCapabilitySignal(agent, projectBrief) ? 18 : 0));
      const managedLane = localizeText(fallbackIntent(agent), currentLanguage);
      return {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        score,
        claim: currentLanguage === 'zh'
          ? `${agent.name}：我申请负责这个项目，因为我的职责线是${managedLane}。我会把简报转成负责人、期限和可见项目账本。`
          : `${agent.name}: I want to lead this project because my lane is ${managedLane}. I will turn the brief into owners, deadlines, and a visible project ledger.`,
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
      hearsOthers: candidate.hearsOthers || [],
    })),
  };
}

export function createKickoffRoleNegotiation(team = [], projectBrief = '', context = {}) {
  const currentLanguage = normalizeLanguage(context.language || 'en');
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
      const target = localizeText(intent.target, currentLanguage);
      const peerName = network.agents.filter((peer) => peer.id !== intent.id)[0]?.name || (currentLanguage === 'zh' ? '团队' : 'the team');
      return {
        id: `role_negotiation_${intent.id}`,
        speakerId: intent.id,
        speaker: intent.name,
        role: intent.role,
        type: wantsClarification ? 'role-question' : 'role-volunteer',
        text: wantsClarification
          ? currentLanguage === 'zh'
            ? `${intent.name}：我理解项目方向。这里应该由我负责哪一块，才能避免和 ${peerName} 的工作重叠？`
            : `${intent.name}: I understand the project direction. What should I own here so my work does not overlap with ${peerName}?`
          : currentLanguage === 'zh'
            ? `${intent.name}：我建议自己负责${target}。我可以接下第一项产物，并把进展暴露到项目时间线。`
            : `${intent.name}: I recommend myself for ${target}. I can take the first artifact and expose progress in the project timeline.`,
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

  const assignmentMessages = attachReceiptsToMessages(tasks
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
    }), team, { seenAt: now });

  const assignmentLogs = assignmentMessages.map((message) => ({
    id: `log_${message.id}`,
    time: now,
    agent: message.author,
    log: message.text,
    eventType: 'leader-assignment',
    cadence: 'kickoff',
    receiptCount: message.visibility?.receiptCount || 0,
    directTargetIds: message.directTargetIds || [],
  }));
  const acknowledgementMessages = attachReceiptsToMessages(assignmentMessages.map((message, index) => {
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
  }), team, { seenAt: now });
  const acknowledgementLogs = acknowledgementMessages.map((message) => ({
    id: `log_${message.id}`,
    time: now,
    agent: message.author,
    log: message.text,
    eventType: 'assignment-acknowledged',
    cadence: 'kickoff',
    receiptCount: message.visibility?.receiptCount || 0,
    directTargetIds: message.directTargetIds || [],
  }));
  const assignmentEvidenceByTaskId = new Map(assignmentMessages.map((message, index) => [
    message.assignment?.taskId,
    {
      assignmentMessageId: message.id,
      acknowledgementMessageId: acknowledgementMessages[index]?.id || null,
      acknowledgedAt: now,
      timelineLogIds: [
        assignmentLogs[index]?.id,
        acknowledgementLogs[index]?.id,
      ].filter(Boolean),
    },
  ]));

  return {
    leader,
    assignmentMessages,
    assignmentLogs,
    acknowledgementMessages,
    acknowledgementLogs,
    ledgerEvents: ledgerEventsFromLogs([...assignmentLogs, ...acknowledgementLogs], 'kickoff-leader-assignment'),
    tasks: tasks.map((task, index) => {
      if (task.status === 'done') return task;
      const assignee = team.find((agent) => agent.name === task.assignee || agent.id === task.assignee)
        || members[index % Math.max(1, members.length)]
        || leader;
      const evidence = assignmentEvidenceByTaskId.get(task.id) || {};
      return {
        ...task,
        assignee: assignee?.name || task.assignee,
        ownerId: assignee?.id || task.ownerId || null,
        assignedBy: leader?.id || task.assignedBy || null,
        assignedAt: now,
        source: task.source || 'kickoff-leader-assignment',
        sourceChannelId: task.sourceChannelId || 'main',
        assignmentMessageId: evidence.assignmentMessageId || task.assignmentMessageId || null,
        acknowledgementMessageId: evidence.acknowledgementMessageId || task.acknowledgementMessageId || null,
        acknowledgedAt: evidence.acknowledgedAt || task.acknowledgedAt || null,
        timelineLogIds: Array.from(new Set([
          ...(task.timelineLogIds || []),
          ...(evidence.timelineLogIds || []),
        ])),
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

function extractAssignedWorkText(text = '', target = null, language = 'en') {
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
  if (!workText) workText = normalizeLanguage(language) === 'zh' ? '跟进新的分配工作并发布进展证据' : 'Follow up on the new assigned work and publish progress evidence';
  return workText;
}

function createAgentStateFromAssignment(agent, { leader, task, now, existingState = {}, language = 'en' }) {
  const currentLanguage = normalizeLanguage(language);
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
      ? (currentLanguage === 'zh' ? `已将“${task.text}”分配给 ${task.assignee}。` : `Assigned "${task.text}" to ${task.assignee}.`)
      : (currentLanguage === 'zh' ? `已接受来自 ${leader?.name || 'Leader'} 的“${task.text}”。` : `Accepted "${task.text}" from ${leader?.name || 'Leader'}.`),
  };
  const previousPlan = existingState.currentPlan || {};
  const nextPlan = isLeader
    ? previousPlan.focus
      ? previousPlan
      : {
        focus: currentLanguage === 'zh' ? '协调已分配工作' : 'coordinate assigned work',
        next: currentLanguage === 'zh' ? '观察确认回执和时间线证据' : 'watch acknowledgements and timeline proof',
        routine: workRoutineForAgent(agent, currentLanguage),
      }
    : {
      ...previousPlan,
      focus: task.text,
      next: currentLanguage === 'zh' ? '把进展发布到时间线' : 'publish progress to the timeline',
      routine: previousPlan.routine || workRoutineForAgent(agent, currentLanguage),
    };
  return {
    ...existingState,
    agentId: agent.id,
    name: existingState.name || agent.name,
    role: existingState.role || agent.role,
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
          due: currentLanguage === 'zh' ? '下一次可见工作脉冲' : 'next visible work pulse',
        },
        ...(existingState.obligations || []),
      ],
    currentPlan: nextPlan,
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
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
  const team = project.team || [];
  const leader = team.find((agent) => agent.id === leaderId || agent.name === leaderId)
    || team.find((agent) => agent.isLeader)
    || team[0]
    || null;
  const assignee = findMentionedAssignmentTarget(team, text, leader?.id);
  const workText = extractAssignedWorkText(text, assignee, currentLanguage);
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
  const assignmentMessage = attachMessageReceipts({
    id: `leader_assign_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'mention',
    author: leader?.name || 'Leader',
    role: leader?.role || 'Leader',
    time: t('agent.timeNow'),
    text: currentLanguage === 'zh'
      ? `@${assignee?.name || '团队'} 请负责“${task.text}”。现在开始，持续同步团队，并把进展发布到时间线。`
      : `@${assignee?.name || 'team'} please own "${task.text}". Start now, keep the group updated, and publish progress to the timeline.`,
    targets: [assignee?.name || assignee?.id].filter(Boolean),
    weight: currentLanguage === 'zh' ? '已分配' : 'Assigned',
    assignment: {
      taskId: task.id,
      ownerId: task.ownerId,
      ownerName: task.assignee,
      assignedBy: task.assignedBy,
      source: task.source,
    },
  }, team, { seenAt: now });
  const acknowledgementMessage = attachMessageReceipts({
    id: `leader_ack_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'progress',
    author: assignee?.name || 'Assigned Agent',
    role: assignee?.role || 'Agent',
    time: t('agent.timeNow'),
    text: currentLanguage === 'zh'
      ? `收到 @${assignmentMessage.author}。我负责“${task.text}”，现在开始工作。我会把进展发布到时间线。`
      : `Received @${assignmentMessage.author}. I own "${task.text}" and I am starting work now. I will publish progress to the timeline.`,
    targets: [assignmentMessage.author].filter(Boolean),
    weight: currentLanguage === 'zh' ? '已确认' : 'Acknowledged',
    assignmentReceipt: {
      taskId: task.id,
      ownerId: task.ownerId,
      ownerName: task.assignee,
      assignedBy: task.assignedBy,
      receivedAt: now,
    },
  }, team, { seenAt: now });
  const logs = [
    {
      id: `log_${assignmentMessage.id}`,
      time: now,
      agent: assignmentMessage.author,
      log: assignmentMessage.text,
      eventType: 'leader-assignment',
      cadence: 'chat',
      receiptCount: assignmentMessage.visibility?.receiptCount || 0,
      directTargetIds: assignmentMessage.directTargetIds || [],
    },
    {
      id: `log_${acknowledgementMessage.id}`,
      time: now,
      agent: acknowledgementMessage.author,
      log: acknowledgementMessage.text,
      eventType: 'assignment-acknowledged',
      cadence: 'chat',
      receiptCount: acknowledgementMessage.visibility?.receiptCount || 0,
      directTargetIds: acknowledgementMessage.directTargetIds || [],
    },
  ];
  const evidencedTask = {
    ...task,
    assignmentMessageId: assignmentMessage.id,
    acknowledgementMessageId: acknowledgementMessage.id,
    acknowledgedAt: now,
    timelineLogIds: logs.map((log) => log.id),
  };
  const previousStates = project.agentStates || {};
  const nextAgentStates = { ...previousStates };
  [leader, assignee].filter(Boolean).forEach((agent) => {
    nextAgentStates[agent.id] = createAgentStateFromAssignment(agent, {
      leader,
      task: evidencedTask,
      now,
      existingState: previousStates[agent.id] || {},
      language: currentLanguage,
    });
  });
  const projectWithLedger = appendProjectEvents({
    ...project,
    tasks: [evidencedTask, ...(project.tasks || [])],
    logs: [...logs, ...(project.logs || [])],
    agentStates: nextAgentStates,
  }, ledgerEventsFromLogs(logs, 'leader-chat-assignment'));

  return {
    task: evidencedTask,
    assignmentMessage,
    acknowledgementMessage,
    logs,
    project: projectWithLedger,
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

function extractPeerHandoffText(text = '', requester = null, target = null, language = 'en') {
  const requesterName = requester?.name || '';
  const requesterId = requester?.id || '';
  let workText = extractAssignedWorkText(text, target, language)
    .replace(new RegExp(requesterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(new RegExp(requesterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '')
    .replace(/\b(asks|ask|needs|need|handoff|dependency|depend|help|review|unblock|coordinate|support|from|for|with)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!workText) workText = normalizeLanguage(language) === 'zh' ? '支持当前开放依赖并发布证据' : 'Support the open dependency and publish evidence';
  return workText;
}

export function handlePeerHandoff({
  project = {},
  text = '',
  requesterId,
  channelId = 'main',
  now = nowIso(),
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
  const team = project.team || [];
  const preliminaryTarget = findMentionedAssignmentTarget(team, text, requesterId);
  const requester = findRequesterAgent(team, text, preliminaryTarget?.id, requesterId);
  const target = findMentionedAssignmentTarget(team, text, requester?.id);
  const workText = extractPeerHandoffText(text, requester, target, currentLanguage);
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
  const requestMessage = attachMessageReceipts({
    id: `peer_handoff_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'mention',
    author: requester?.name || 'Requesting Agent',
    role: requester?.role || 'Agent',
    time: t('agent.timeNow'),
    text: currentLanguage === 'zh'
      ? `@${target?.name || '团队'} 我需要你协助“${dependencyTask.text}”。这是我当前计划的依赖；请确认负责人，并把进展发布到时间线。`
      : `@${target?.name || 'team'} I need your help with "${dependencyTask.text}". This is a dependency for my current plan; please confirm ownership and publish progress to the timeline.`,
    targets: [target?.name || target?.id].filter(Boolean),
    weight: currentLanguage === 'zh' ? '同级交接' : 'Peer Handoff',
    handoff: {
      taskId: dependencyTask.id,
      requesterId: requester?.id || null,
      requesterName: requester?.name || null,
      targetId: target?.id || null,
      targetName: target?.name || null,
    },
  }, team, { seenAt: now });
  const acknowledgementMessage = attachMessageReceipts({
    id: `peer_handoff_ack_${timestamp}`,
    projectId: project.id || null,
    channelId,
    type: 'progress',
    author: target?.name || 'Peer Agent',
    role: target?.role || 'Agent',
    time: t('agent.timeNow'),
    text: currentLanguage === 'zh'
      ? `收到 @${requestMessage.author}。我负责依赖“${dependencyTask.text}”，现在开始工作。我会把进展同步回群组和时间线。`
      : `Received @${requestMessage.author}. I own the dependency "${dependencyTask.text}" and I am starting work now. I will sync progress back to the group and timeline.`,
    targets: [requestMessage.author].filter(Boolean),
    weight: currentLanguage === 'zh' ? '依赖已接受' : 'Dependency Accepted',
    handoffReceipt: {
      taskId: dependencyTask.id,
      requesterId: requester?.id || null,
      targetId: target?.id || null,
      receivedAt: now,
    },
  }, team, { seenAt: now });
  const logs = [
    {
      id: `log_${requestMessage.id}`,
      time: now,
      agent: requestMessage.author,
      log: requestMessage.text,
      eventType: 'peer-handoff',
      cadence: 'chat',
      receiptCount: requestMessage.visibility?.receiptCount || 0,
      directTargetIds: requestMessage.directTargetIds || [],
    },
    {
      id: `log_${acknowledgementMessage.id}`,
      time: now,
      agent: acknowledgementMessage.author,
      log: acknowledgementMessage.text,
      eventType: 'peer-handoff-ack',
      cadence: 'chat',
      receiptCount: acknowledgementMessage.visibility?.receiptCount || 0,
      directTargetIds: acknowledgementMessage.directTargetIds || [],
    },
  ];
  const evidencedDependencyTask = {
    ...dependencyTask,
    requestMessageId: requestMessage.id,
    acknowledgementMessageId: acknowledgementMessage.id,
    acknowledgedAt: now,
    timelineLogIds: logs.map((log) => log.id),
  };
  const handoffRecord = {
    id: `peer_handoff_record_${timestamp}`,
    projectId: project.id || null,
    taskId: evidencedDependencyTask.id,
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
      currentPlan: requesterState.currentPlan || {
        focus: currentLanguage === 'zh' ? '协调依赖交接' : 'coordinate dependency handoffs',
        next: currentLanguage === 'zh' ? '观察同级确认和时间线证据' : 'watch peer acknowledgement and timeline proof',
      },
      taskIds: requesterState.taskIds || [],
      worklog: [
        {
          id: `worklog_${dependencyTask.id}_${requester.id}`,
          at: now,
          text: currentLanguage === 'zh'
            ? `已向 ${target?.name || '同级'} 请求交接“${dependencyTask.text}”。`
            : `Requested peer handoff "${dependencyTask.text}" from ${target?.name || 'peer'}.`,
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
          due: currentLanguage === 'zh' ? '下一次可见工作脉冲' : 'next visible work pulse',
        },
        ...(targetState.obligations || []),
      ],
      currentPlan: {
        focus: dependencyTask.text,
        next: currentLanguage === 'zh' ? '把依赖进展同步给请求方和时间线' : 'sync dependency progress to requester and timeline',
      },
      taskIds: Array.from(new Set([...(targetState.taskIds || []), dependencyTask.id])),
      worklog: [
        {
          id: `worklog_${dependencyTask.id}_${target.id}`,
          at: now,
          text: currentLanguage === 'zh'
            ? `已接受来自 ${requester?.name || '同级'} 的同级依赖“${dependencyTask.text}”。`
            : `Accepted peer dependency "${dependencyTask.text}" from ${requester?.name || 'peer'}.`,
        },
        ...(targetState.worklog || []),
      ],
      status: 'working-peer-dependency',
      lastActiveAt: now,
    };
  }
  const projectWithLedger = appendProjectEvents({
    ...project,
    tasks: [evidencedDependencyTask, ...(project.tasks || [])],
    logs: [...logs, ...(project.logs || [])],
    peerHandoffs: [handoffRecord, ...(project.peerHandoffs || [])],
    agentStates: nextAgentStates,
  }, [
    createProjectLedgerEvent({
      id: `evt_${handoffRecord.id}`,
      type: 'peer-handoff-accepted',
      time: now,
      actor: requester?.name || 'Requesting Agent',
      summary: currentLanguage === 'zh'
        ? `${requester?.name || '请求方'} 将“${dependencyTask.text}”交接给 ${target?.name || '同级'}，并收到了确认。`
        : `${requester?.name || 'Requester'} handed "${dependencyTask.text}" to ${target?.name || 'peer'} and received acknowledgement.`,
      source: 'peer-handoff',
      channelId,
      evidenceIds: [requestMessage.id, acknowledgementMessage.id, handoffRecord.id],
      entityIds: { taskId: evidencedDependencyTask.id, requesterId: requester?.id || null, targetAgentId: target?.id || null },
    }),
    ...ledgerEventsFromLogs(logs, 'peer-handoff'),
  ]);

  return {
    task: evidencedDependencyTask,
    handoffRecord,
    requestMessage,
    acknowledgementMessage,
    logs,
    project: projectWithLedger,
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
  const directorBriefId = project.initiation?.directorBriefId || `director_brief_${project.id || Date.parse(now) || Date.now()}`;
  const directorBriefText = project.initiation?.summary || project.currentObjective || project.objective || project.name || '';

  const charter = {
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
      directorBriefIds: [directorBriefId].filter(Boolean),
      roleTranscriptIds: (roleNegotiation.transcript || []).map((item) => item.id),
      leaderCampaignIds: (leaderElection.transcript || []).map((item) => item.id),
      assignmentMessageIds: assignments.map((message) => message.id),
      acknowledgementMessageIds: acknowledgements.map((message) => message.id),
      briefHearingEdges: [{
        speakerId: 'director',
        hears: team.map((agent) => agent.id),
      }],
      roleHearingEdges: (roleNegotiation.transcript || []).map((item) => ({
        speakerId: item.speakerId,
        hears: item.hears || [],
      })),
      leaderHearingEdges: (leaderElection.transcript || []).map((item) => ({
        speakerId: item.speakerId,
        hears: item.hearsOthers || [],
      })),
    },
  };
  const directorBriefEvent = createProjectLedgerEvent({
    id: `evt_${directorBriefId}`,
    type: 'kickoff-director-brief',
    time: now,
    actor: 'Director',
    summary: directorBriefText,
    source: 'kickoff-meeting',
    channelId: 'main',
    evidenceIds: [directorBriefId],
    entityIds: { speakerId: 'director' },
    payload: { hears: team.map((agent) => agent.id) },
  });
  const roleSpeechEvents = (roleNegotiation.transcript || []).map((item) => createProjectLedgerEvent({
    id: `evt_${item.id}`,
    type: item.type === 'role-question' ? 'kickoff-role-question' : 'kickoff-role-volunteer',
    time: now,
    actor: item.speaker || item.speakerId || 'Agent',
    summary: item.text || '',
    source: 'kickoff-meeting',
    channelId: 'main',
    evidenceIds: [item.id],
    entityIds: { speakerId: item.speakerId || null },
    payload: { hears: item.hears || [] },
  }));
  const leaderCampaignEvents = (leaderElection.transcript || []).map((item) => createProjectLedgerEvent({
    id: `evt_${item.id}`,
    type: 'kickoff-leader-campaign',
    time: now,
    actor: item.speaker || item.speakerId || 'Agent',
    summary: item.text || '',
    source: 'kickoff-meeting',
    channelId: 'main',
    evidenceIds: [item.id],
    entityIds: { speakerId: item.speakerId || null },
    payload: { hears: item.hearsOthers || [] },
  }));
  const charterLedgerEvent = createProjectLedgerEvent({
    id: `evt_${charter.id}`,
    type: 'kickoff-charter-approved',
    time: now,
    actor: 'Director',
    summary: `${charter.title} approved with ${leader?.name || 'Leader'} as Leader and ${reviewer?.name || 'Reviewer'} as Reviewer.`,
    source: 'kickoff-meeting',
    channelId: 'main',
    evidenceIds: [
      charter.id,
      ...(charter.evidence.directorBriefIds || []),
      ...(charter.evidence.roleTranscriptIds || []),
      ...(charter.evidence.leaderCampaignIds || []),
      ...(charter.evidence.assignmentMessageIds || []),
      ...(charter.evidence.acknowledgementMessageIds || []),
    ],
    entityIds: { leaderId: leader?.id || null, reviewerId: reviewer?.id || null },
    payload: {
      roleQuestionCount: charter.meeting.roleQuestionCount,
      selfNominationCount: charter.meeting.selfNominationCount,
      leaderCandidateCount: charter.meeting.leaderCandidateCount,
    },
  });
  return {
    ...charter,
    ledgerEvent: charterLedgerEvent,
    ledgerEvents: [
      directorBriefEvent,
      ...roleSpeechEvents,
      ...leaderCampaignEvents,
      charterLedgerEvent,
    ],
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
  requestMessageId = null,
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
  const team = project.team || [];
  const timestamp = Date.parse(now) || Date.now();
  const network = createAgentNetwork(team, {
    projectId: project.id,
    projectName: project.name,
    topic: text,
    language: currentLanguage,
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
    text: currentLanguage === 'zh' ? `功能变更：${text}` : `Feature change: ${text}`,
    assignee: owner?.name || lead?.name || 'Leader',
    ownerId: owner?.id || lead?.id || null,
    status: 'pending',
    createdAt: now,
    source,
    sourceChannelId: channelId,
    requestMessageId,
  };
  const discussionMessages = attachReceiptsToMessages([
    {
      id: `change_discuss_${timestamp}_lead`,
      channelId,
      type: 'mention',
      author: lead?.name || 'Leader',
      role: lead?.role || 'Leader',
      time: t('agent.timeNow'),
      text: currentLanguage === 'zh'
        ? `我看到变更请求：“${text}”。团队先讨论影响；${owner?.name || '负责人'} 会在进入计划前确认范围。`
        : `I see the change request: "${text}". Team, discuss impact first; ${owner?.name || 'the owner'} will confirm scope before it enters the plan.`,
      targets: network.agents.map((agent) => agent.name),
      weight: currentLanguage === 'zh' ? '变更复核' : 'Change Review',
    },
    ...(reviewer ? [{
      id: `change_discuss_${timestamp}_reviewer`,
      channelId,
      type: 'text',
      author: reviewer.name,
      role: reviewer.role,
      time: t('agent.timeNow'),
      text: currentLanguage === 'zh'
        ? '在接受之前，我需要把风险和验证路径附到这次变更上。不能静默扩大范围。'
        : 'Before accepting it, I need the risk and verification path attached to the change. No silent scope drift.',
      targets: [],
      weight: null,
    }] : []),
    {
      id: `change_confirm_${timestamp}_owner`,
      channelId,
      type: 'decision',
      author: owner?.name || lead?.name || 'Responsible Agent',
      role: owner?.role || lead?.role || 'Owner',
      time: t('agent.timeNow'),
      text: currentLanguage === 'zh'
        ? `已确认。我会把“${text}”加入我的计划，与团队同步依赖，并在时间线上汇报进展。`
        : `Confirmed. I am adding "${text}" to my plan, will sync dependencies with the team, and will report progress on the timeline.`,
      targets: [],
      weight: currentLanguage === 'zh' ? '已确认' : 'Confirmed',
      decisionId: `CHG-${String(timestamp).slice(-5)}`,
    },
    {
      id: `change_sync_${timestamp}_owner`,
      channelId,
      type: 'mention',
      author: owner?.name || lead?.name || 'Responsible Agent',
      role: owner?.role || lead?.role || 'Owner',
      time: t('agent.timeNow'),
      text: currentLanguage === 'zh'
        ? `@all 计划已更新：现在由我负责“${text}”。我会把下一次进展脉冲发布到时间线，并在此频道说明任何依赖。`
        : `@all Plan updated: I own "${text}" now. I will publish the next progress pulse to the timeline and call out any dependency in this channel.`,
      targets: network.agents.map((agent) => agent.name),
      weight: currentLanguage === 'zh' ? '计划同步' : 'Plan Sync',
    },
  ], team, { seenAt: now });
  const confirmationMessage = discussionMessages.find((message) => message.type === 'decision');
  const syncMessage = discussionMessages.find((message) => message.id.includes('change_sync'));
  const previousStates = project.agentStates || {};
  const ownerState = previousStates[owner?.id] || {};
  const ownerRoutine = owner ? workRoutineForAgent(owner, currentLanguage) : null;
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
      focus: currentLanguage === 'zh' ? `功能变更：${text}` : `Feature change: ${text}`,
      next: currentLanguage === 'zh' ? '发布下一次进展脉冲并同步依赖' : 'publish the next progress pulse and sync dependencies',
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
    ].slice(0, 80),
    obligations: [
      {
        id: `obligation_${changeTask.id}`,
        taskId: changeTask.id,
        text: currentLanguage === 'zh' ? `负责已确认的功能变更：${text}` : `Own confirmed feature change: ${text}`,
        source,
        due: currentLanguage === 'zh' ? '下一次可见工作脉冲' : 'next visible work pulse',
        status: 'open',
        openedAt: now,
      },
      ...(ownerState.obligations || []).filter((obligation) => obligation.status === 'open'),
    ].slice(0, 80),
    worklog: [
      {
        id: `worklog_${changeTask.id}_${owner.id}`,
        at: now,
        kind: 'change-plan-sync',
        text: syncMessage?.text || (currentLanguage === 'zh' ? `“${text}”的计划已更新。` : `Plan updated for "${text}".`),
      },
      ...(ownerState.worklog || []),
    ].slice(0, 80),
    lastActiveAt: now,
  } : null;
  const teamSyncAgentIds = network.agents
    .filter((agent) => agent.id !== owner?.id)
    .map((agent) => agent.id);
  const teamSyncStateUpdates = Object.fromEntries(teamSyncAgentIds.map((agentId) => {
    const agent = getAgent(network, agentId);
    const previous = previousStates[agentId] || {};
    return [agentId, {
      agentId,
      name: previous.name || agent?.name,
      role: previous.role || agent?.role,
      managerId: previous.managerId || agent?.managerId || null,
      managedIds: previous.managedIds || agent?.managedIds || [],
      peerManagedIds: previous.peerManagedIds || [],
      peerManagerId: previous.peerManagerId || null,
      peerManagerIds: previous.peerManagerIds || [],
      peerIds: previous.peerIds || agent?.peerIds || [],
      status: previous.status || 'synced-change',
      currentPlan: previous.currentPlan || {
        focus: currentLanguage === 'zh' ? '跟踪已接受的变更同步' : 'track accepted change sync',
        next: currentLanguage === 'zh' ? '观察负责人的进展脉冲' : 'watch owner progress pulse',
        routine: agent ? workRoutineForAgent(agent, currentLanguage) : null,
      },
      taskIds: previous.taskIds || [],
      inbox: [
        {
          id: `sync_inbox_${changeTask.id}_${agentId}`,
          from: owner?.id || lead?.id || null,
          taskId: changeTask.id,
          text: syncMessage?.text || (currentLanguage === 'zh' ? `“${text}”的计划已更新。` : `Plan updated for "${text}".`),
          source: 'change-sync',
          sourceChannelId: channelId,
          sourceMessageId: syncMessage?.id || null,
          receivedAt: now,
        },
        ...(previous.inbox || []),
      ].slice(0, 80),
      obligations: previous.obligations || [],
      worklog: [
        {
          id: `sync_worklog_${changeTask.id}_${agentId}`,
          at: now,
          kind: 'change-sync-received',
          text: currentLanguage === 'zh' ? `已收到“${text}”的负责人同步。` : `Received owner sync for "${text}".`,
        },
        ...(previous.worklog || []),
      ].slice(0, 80),
      lastActiveAt: previous.lastActiveAt || now,
    }];
  }));
  const nextAgentStates = {
    ...previousStates,
    ...teamSyncStateUpdates,
    ...(ownerStateUpdate ? { [owner.id]: ownerStateUpdate } : {}),
  };
  const changeRecord = {
    id: `change_record_${timestamp}`,
    projectId: project.id || null,
    requestedAt: now,
    requestedBy: author,
    requestText: text,
    source,
    sourceChannelId: channelId,
    requestMessageId,
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
    teamSyncAgentIds,
    teamSyncCount: teamSyncAgentIds.length,
    planUpdate: syncMessage?.text || null,
    ownerStateUpdated: Boolean(ownerStateUpdate),
    teamStateSynced: teamSyncAgentIds.length > 0,
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
    receiptCount: message.visibility?.receiptCount || 0,
    directTargetIds: message.directTargetIds || [],
  }));
  const evidencedChangeTask = {
    ...changeTask,
    confirmationMessageId: confirmationMessage?.id || null,
    syncMessageId: syncMessage?.id || null,
    acknowledgedAt: now,
    timelineLogIds: logs.map((log) => log.id),
  };
  const projectWithLedger = appendProjectEvents({
    ...project,
    tasks: [...(project.tasks || []), evidencedChangeTask],
    changeLedger: [changeRecord, ...(project.changeLedger || [])],
    logs: [...logs, ...(project.logs || [])],
    agentStates: nextAgentStates,
  }, [
    createProjectLedgerEvent({
      id: `evt_${changeRecord.id}`,
      type: 'change-confirmed-and-synced',
      time: now,
      actor: owner?.name || lead?.name || 'Responsible Agent',
      summary: currentLanguage === 'zh'
        ? `${owner?.name || '负责人'} 接受了来自 ${source} 的“${text}”，并同步了 ${teamSyncAgentIds.length} 个 Agent。`
        : `${owner?.name || 'Owner'} accepted "${text}" from ${source} and synced ${teamSyncAgentIds.length} Agent(s).`,
      source,
      channelId,
      evidenceIds: [
        changeRecord.id,
        requestMessageId,
        confirmationMessage?.id,
        syncMessage?.id,
        ...logs.map((log) => log.id),
      ].filter(Boolean),
      entityIds: { taskId: evidencedChangeTask.id, ownerId: owner?.id || null, changeRecordId: changeRecord.id, messageId: requestMessageId },
      payload: { teamSyncCount: teamSyncAgentIds.length, sourceChannelId: channelId },
    }),
    ...ledgerEventsFromLogs(logs, source),
  ]);
  const projectWithDiscussionDelivery = applyChatMessagesToAgentStates({
    project: projectWithLedger,
    team,
    messages: discussionMessages,
    now,
    source: 'change-discussion-chat',
    language: currentLanguage,
  });

  return {
    ...localizeGeneratedObject({
      network,
      owner,
      changeTask: evidencedChangeTask,
      changeRecord,
      ownerStateUpdate,
      teamSyncStateUpdates,
      discussionMessages,
      logs,
      diagnostics: readings.map((reading) => ({
        agentId: reading.agentId,
        attentionScore: reading.score,
        decision: reading.decision,
        explanation: reading.explanation,
        obligationCount: reading.obligations.length,
      })),
    }, currentLanguage),
    project: projectWithDiscussionDelivery,
  };
}
