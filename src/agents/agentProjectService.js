import {
  advanceAutonomousProjectCycle,
  appendProjectEvents,
  applyChatMessagesToAgentStates,
  attachMessageReceipts,
  backfillProjectEventLedger,
  buildAgentChatReplies,
  createProjectLedgerEvent,
  createKickoffCharter,
  createKickoffRoleNegotiation,
  createLeaderAssignmentPackage,
  createLeaderElection,
  evaluateAutonomousSchedule,
  evaluateManagerScenarioReadiness,
  handleFeatureChangeRequest,
  handleLeaderChatAssignment,
  handlePeerHandoff,
  isFeatureChangeRequest,
  isLeaderAssignmentRequest,
  isPeerHandoffRequest,
  publishAutonomousCycleChat,
  summarizeProjectEventLedger,
} from './agentRuntime.js';
import { createAgentProjectMemoryStore } from './agentProjectStore.js';
import { createTranslator, localizeText, normalizeLanguage } from '../i18n/runtime.js';

const nowIso = () => new Date().toISOString();
const DEFAULT_AGENT_WORK_INTERVAL_MS = 30 * 60 * 1000;

const READ_MODEL_LOCALIZED_KEYS = new Set([
  'stage',
  'outcome',
  'requirement',
  'evidence',
  'label',
  'description',
  'managerQuestion',
  'protocol',
  'managerMeaning',
  'phase',
  'detail',
  'title',
  'summary',
  'proof',
  'actionLabel',
]);

function localizeReadModel(value, language = 'en', key = '') {
  const currentLanguage = normalizeLanguage(language);
  if (typeof value === 'string') {
    return READ_MODEL_LOCALIZED_KEYS.has(key) ? localizeText(value, currentLanguage) : value;
  }
  if (Array.isArray(value)) return value.map((item) => localizeReadModel(item, currentLanguage, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, item]) => [childKey, localizeReadModel(item, currentLanguage, childKey)]));
  }
  return value;
}

function materializeActionTemplate(value, now = nowIso()) {
  if (Array.isArray(value)) return value.map((item) => materializeActionTemplate(item, now));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materializeActionTemplate(item, now)]));
  }
  return value === 'now-iso' ? now : value;
}

function extractAgentIdFromActionPath(path = '') {
  return String(path || '').match(/\/agents\/([^/]+)\/work-cycle$/)?.[1] || null;
}

function extractKickoffActionFromPath(path = '') {
  const parts = String(path || '').split('/').filter(Boolean);
  if (parts[0] !== 'kickoff-meetings') return null;
  return {
    meetingId: parts[1] || null,
    action: parts[2] || 'create',
  };
}

function multiChannelSourceModeFor(channelId, sourceMode) {
  if (sourceMode) return sourceMode;
  return channelId === 'google_chat' ? 'google_chat' : 'war_room_meeting';
}

function multiChannelSourceLabelFor(sourceMode, channelId) {
  const normalizedMode = multiChannelSourceModeFor(channelId, sourceMode);
  if (normalizedMode === 'google_chat') return 'Google Chat';
  if (normalizedMode === 'war_room_meeting') return 'War Room';
  return normalizedMode || channelId || 'Source';
}

export function buildPeerManagementMatrix(team = [], { leaderId, reviewerId } = {}) {
  const agents = team.filter((agent) => agent?.id);
  if (agents.length <= 1) {
    return agents.map((agent) => ({
      agentId: agent.id,
      peerManagedIds: [],
      peerManagerIds: [],
      peerIds: [],
    }));
  }

  const orderedAgents = [
    ...agents.filter((agent) => agent.id === leaderId),
    ...agents.filter((agent) => agent.id === reviewerId && agent.id !== leaderId),
    ...agents.filter((agent) => agent.id !== leaderId && agent.id !== reviewerId),
  ];
  const peerManagedByAgent = new Map(orderedAgents.map((agent) => [agent.id, []]));
  const peerManagersByAgent = new Map(orderedAgents.map((agent) => [agent.id, []]));

  orderedAgents.forEach((agent, index) => {
    const target = orderedAgents[(index + 1) % orderedAgents.length];
    if (!target || target.id === agent.id) return;
    peerManagedByAgent.set(agent.id, uniqueStrings([...(peerManagedByAgent.get(agent.id) || []), target.id]));
    peerManagersByAgent.set(target.id, uniqueStrings([...(peerManagersByAgent.get(target.id) || []), agent.id]));
  });

  return agents.map((agent) => ({
    agentId: agent.id,
    peerManagedIds: peerManagedByAgent.get(agent.id) || [],
    peerManagerIds: peerManagersByAgent.get(agent.id) || [],
    peerIds: agents.filter((peer) => peer.id !== agent.id).map((peer) => peer.id),
  }));
}

export function applyPeerManagementMatrix({
  project = {},
  leaderId,
  reviewerId,
  now = nowIso(),
} = {}) {
  const team = project.team || [];
  const matrixRows = buildPeerManagementMatrix(team, { leaderId, reviewerId });
  const matrixByAgentId = Object.fromEntries(matrixRows.map((row) => [row.agentId, row]));
  const previousStates = project.agentStates || {};
  const nextTeam = team.map((agent) => {
    const row = matrixByAgentId[agent.id] || {};
    return {
      ...agent,
      peerManagedIds: uniqueStrings([...(agent.peerManagedIds || []), ...(row.peerManagedIds || [])]),
      peerManagerIds: uniqueStrings([...(agent.peerManagerIds || []), ...(row.peerManagerIds || [])]),
      peerIds: uniqueStrings([...(agent.peerIds || []), ...(row.peerIds || [])]),
    };
  });
  const nextStates = Object.fromEntries(nextTeam.map((agent) => {
    const previous = previousStates[agent.id] || {};
    return [agent.id, {
      ...previous,
      agentId: agent.id,
      name: previous.name || agent.name,
      role: previous.role || agent.role || agent.title || 'Agent',
      managerId: previous.managerId || (agent.id === leaderId ? null : leaderId || agent.managerId || null),
      managedIds: uniqueStrings([...(previous.managedIds || []), ...(agent.managedIds || [])]),
      peerManagedIds: uniqueStrings([...(previous.peerManagedIds || []), ...(matrixByAgentId[agent.id]?.peerManagedIds || [])]),
      peerManagerIds: uniqueStrings([...(previous.peerManagerIds || []), ...(matrixByAgentId[agent.id]?.peerManagerIds || [])]),
      peerManagerId: previous.peerManagerId || matrixByAgentId[agent.id]?.peerManagerIds?.[0] || null,
      peerIds: uniqueStrings([...(previous.peerIds || []), ...(matrixByAgentId[agent.id]?.peerIds || [])]),
      currentPlan: previous.currentPlan || null,
      inbox: previous.inbox || [],
      obligations: previous.obligations || [],
      taskIds: previous.taskIds || [],
      worklog: previous.worklog || [],
      status: previous.status || 'standing-by',
      peerManagementEstablishedAt: previous.peerManagementEstablishedAt || now,
    }];
  }));

  return {
    ...project,
    team: nextTeam,
    agentStates: {
      ...previousStates,
      ...nextStates,
    },
    peerManagementMatrix: matrixRows,
  };
}

function taskBelongsToAgent(task = {}, agent = {}) {
  return task.ownerId === agent.id
    || task.assignee === agent.id
    || task.assignee === agent.name;
}

function openAgentTask(project = {}, agent = {}, preferredTaskId = null) {
  const tasks = project.tasks || [];
  if (preferredTaskId) {
    const preferredTask = tasks.find((task) => String(task.id || '') === String(preferredTaskId));
    if (preferredTask && taskBelongsToAgent(preferredTask, agent) && preferredTask.status !== 'done') return preferredTask;
  }
  return tasks.find((task) => taskBelongsToAgent(task, agent) && task.status !== 'done') || null;
}

function safeDateMs(value, fallback = Date.now()) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function agentWorkIntervalMs(project = {}, state = {}, intervalMs) {
  const configuredMinutes = state.workCadenceMinutes
    || project.agentAutonomy?.intervalMinutes
    || project.autonomy?.agentIntervalMinutes;
  const configuredMs = Number(configuredMinutes) > 0 ? Number(configuredMinutes) * 60 * 1000 : null;
  return intervalMs || configuredMs || DEFAULT_AGENT_WORK_INTERVAL_MS;
}

function agentManagementPriority({ project = {}, agent = {}, state = {} } = {}) {
  const team = project.team || [];
  const openTasks = (project.tasks || []).filter((task) => taskBelongsToAgent(task, agent) && task.status !== 'done');
  const inboxItems = state.inbox || [];
  const obligations = (state.obligations || []).filter((obligation) => obligation.status !== 'done' && obligation.status !== 'resolved');
  const managerIds = [
    state.managerId,
    ...(state.peerManagerIds || []),
  ].filter(Boolean);
  const managerNames = managerIds
    .map((managerId) => team.find((member) => member.id === managerId)?.name || managerId)
    .filter(Boolean);
  const managerRefs = new Set([...managerIds, ...managerNames]);
  const directManagementInbox = inboxItems.filter((item) => (
    ['management-check-in', 'peer-management-check-in', 'review-sweep', 'change-sync'].includes(item.source)
    || managerRefs.has(item.from)
    || /management check-in|peer-management|review sweep|plan updated/i.test(item.text || '')
  ));
  const peerDependencyCount = (project.peerHandoffs || [])
    .filter((handoff) => handoff.targetId === agent.id && handoff.status === 'accepted')
    .length;
  const reviewTargetCount = (project.logs || [])
    .filter((log) => log.eventType === 'review-sweep' && (log.targetAgentId === agent.id || log.agentId === agent.id))
    .length;
  const reasons = [
    openTasks.length ? `${openTasks.length} open owned task${openTasks.length === 1 ? '' : 's'}` : null,
    obligations.length ? `${obligations.length} open obligation${obligations.length === 1 ? '' : 's'}` : null,
    directManagementInbox.length ? `${directManagementInbox.length} management inbox signal${directManagementInbox.length === 1 ? '' : 's'}` : null,
    managerNames.length ? `managed by ${managerNames.join(' / ')}` : null,
    peerDependencyCount ? `${peerDependencyCount} peer dependency handoff${peerDependencyCount === 1 ? '' : 's'}` : null,
    reviewTargetCount ? `${reviewTargetCount} review sweep signal${reviewTargetCount === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return {
    score: (openTasks.length * 30)
      + (obligations.length * 20)
      + (directManagementInbox.length * 18)
      + (managerIds.length * 12)
      + (peerDependencyCount * 14)
      + (reviewTargetCount * 8),
    reasons,
    managerIds,
    managedBy: managerNames,
    openTaskCount: openTasks.length,
    obligationCount: obligations.length,
    managementInboxCount: directManagementInbox.length,
    peerDependencyCount,
    reviewTargetCount,
  };
}

function slugifyArtifactPart(value = 'artifact') {
  return String(value || 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'artifact';
}

function buildAgentArtifactDraft({
  project = {},
  agent = {},
  task = null,
  workText = '',
  workSummary = '',
  now = nowIso(),
  completed = false,
  cycleId = '',
} = {}) {
  const projectSlug = slugifyArtifactPart(project.name || project.id || 'project');
  const agentSlug = slugifyArtifactPart(agent.name || agent.id || 'agent');
  const taskSlug = slugifyArtifactPart(task?.text || workText || 'work');
  const fileName = `${agentSlug}-${taskSlug}-${Date.parse(now) || Date.now()}.md`;
  const relativePath = `agent-artifacts/${projectSlug}/${fileName}`;
  const content = [
    `# ${task?.text || workText || 'Agent work artifact'}`,
    '',
    `Project: ${project.name || project.id || 'Untitled project'}`,
    `Agent: ${agent.name || agent.id || 'Agent'}`,
    `Role: ${agent.role || agent.title || 'Agent'}`,
    `Status: ${completed ? 'completed' : 'in-progress'}`,
    `Created at: ${now}`,
    `Cycle: ${cycleId || 'agent-work-cycle'}`,
    '',
    '## Work Summary',
    workSummary || 'Agent produced a durable work artifact for timeline review.',
    '',
    '## Next Evidence',
    completed
      ? 'This artifact is ready for manager review and downstream handoff.'
      : 'Continue the next work pulse, update this artifact, and publish timeline evidence.',
    '',
  ].join('\n');
  return {
    id: `artifact_${agent.id || agentSlug}_${Date.parse(now) || Date.now()}`,
    type: completed ? 'deliverable-artifact' : 'work-artifact',
    title: task?.text || workText || 'Agent work artifact',
    fileName,
    relativePath,
    path: relativePath,
    content,
    createdAt: now,
    agentId: agent.id || null,
    taskId: task?.id || null,
    cycleId,
    status: completed ? 'completed' : 'in-progress',
  };
}

function timelineCommitAreaKey(time = nowIso()) {
  const parsed = Date.parse(time);
  if (!Number.isFinite(parsed)) return String(time || 'unscheduled');
  const date = new Date(parsed);
  date.setSeconds(0, 0);
  return date.toISOString();
}

function buildAgentTimelineToolSubmission({
  project = {},
  agent = {},
  task = null,
  now = nowIso(),
  cycleId = '',
  completed = false,
  workText = '',
  workSummary = '',
  routine = null,
  artifactRecord = null,
  managementReasons = [],
  collaboratorIds = [],
  trigger = 'agent-worker',
  cadence = 'agent-pulse',
} = {}) {
  const thinkingFrame = {
    routineId: routine?.id || 'generalist-routine',
    routineLabel: routine?.label || 'Agent work routine',
    checklist: routine?.checklist || ['read latest state', 'choose next obligation', 'publish timeline evidence'],
    artifact: routine?.artifact || artifactRecord?.title || 'timeline evidence',
    intentSource: 'agent-current-plan',
  };
  const commitMessage = completed
    ? `${agent.name || 'Agent'} completed ${task?.text || workText || 'the assigned work'} and submitted the deliverable.`
    : `${agent.name || 'Agent'} published progress on ${task?.text || workText || 'the current work pulse'}.`;
  return {
    id: `timeline_submission_${agent.id || 'agent'}_${Date.parse(now) || Date.now()}`,
    tool: 'manager-flow-timeline',
    protocolVersion: 'agent-timeline-submit/v1',
    commitAreaKey: timelineCommitAreaKey(now),
    axis: 'x-time-single-axis',
    branchPolicy: 'same-time-small-branch',
    submittedAt: now,
    submittedByAgentId: agent.id || null,
    submittedByAgentName: agent.name || 'Agent',
    taskId: task?.id || null,
    cycleId,
    trigger,
    cadence,
    category: completed ? 'submission' : 'execution',
    subtype: completed ? 'deliverable-submit' : 'work-pulse-submit',
    intent: completed
      ? 'Agent completed the task and self-published a timeline commit for manager/user review.'
      : 'Agent used the timeline tool to publish a progress commit after its work pulse.',
    commitMessage,
    thinkingFrame,
    collaborationContext: {
      managerId: agent.managerId || null,
      collaboratorIds: uniqueStrings(collaboratorIds),
      managementReasons: uniqueStrings(managementReasons),
    },
    requiredFields: ['category', 'subtype', 'commitMessage', 'submitter', 'attachment'],
    autoFields: ['id', 'submittedAt', 'commitAreaKey', 'axis', 'status', 'source'],
    attachmentIds: [artifactRecord?.id].filter(Boolean),
    attachments: artifactRecord ? [artifactRecord] : [],
    summary: workSummary || commitMessage,
  };
}

function resolveAgentRef(ref, team = []) {
  if (!ref) return null;
  const normalized = String(ref).toLowerCase();
  return team.find((agent) => (
    String(agent.id || '').toLowerCase() === normalized
    || String(agent.name || '').toLowerCase() === normalized
  )) || null;
}

function managementSignalItems({ project = {}, agent = {}, state = {} } = {}) {
  const team = project.team || [];
  const managerIds = uniqueStrings([
    state.managerId,
    ...(state.peerManagerIds || []),
  ]);
  const managerRefs = new Set([
    ...managerIds,
    ...managerIds.map((id) => team.find((member) => member.id === id)?.name).filter(Boolean),
  ]);
  return (state.inbox || []).filter((item) => {
    if (item.status === 'addressed' || item.status === 'done' || item.respondedAt) return false;
    return ['management-check-in', 'peer-management-check-in', 'review-sweep', 'change-sync'].includes(item.source)
      || managerRefs.has(item.from)
      || /management check-in|peer-management|review sweep|plan updated/i.test(item.text || '');
  }).slice(0, 4);
}

function managementResponseTargets({ project = {}, state = {}, signals = [] } = {}) {
  const team = project.team || [];
  const signalManagers = signals
    .map((item) => resolveAgentRef(item.from, team)?.id)
    .filter(Boolean);
  return uniqueStrings([
    ...signalManagers,
    state.managerId,
    ...(state.peerManagerIds || []),
  ]).filter(Boolean);
}

export function evaluateAgentWorkSchedule({
  project = {},
  agentId,
  now = nowIso(),
  intervalMs,
  forceDue = false,
  forceReason = 'agent-forced-sweep',
} = {}) {
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) {
    return {
      due: false,
      reason: 'agent-not-found',
      agentId,
      nextRunAt: null,
    };
  }
  if (project.autonomy?.enabled === false || project.agentAutonomy?.enabled === false) {
    return {
      due: false,
      reason: 'agent-autonomy-disabled',
      agentId: agent.id,
      nextRunAt: null,
    };
  }

  const state = project.agentStates?.[agent.id] || {};
  const management = agentManagementPriority({ project, agent, state });
  const nowMs = safeDateMs(now);
  const cadenceMs = agentWorkIntervalMs(project, state, intervalMs);
  const nextRunAt = state.nextAgentRunAt
    || (state.lastAgentRunAt ? new Date(safeDateMs(state.lastAgentRunAt, nowMs) + cadenceMs).toISOString() : now);
  const nextRunMs = safeDateMs(nextRunAt, nowMs);
  const due = Boolean(forceDue) || nextRunMs <= nowMs;

  return {
    due,
    reason: forceDue ? forceReason : due ? 'agent-cadence-due' : 'agent-cadence-waiting',
    agentId: agent.id,
    cadenceMs,
    dueAt: forceDue ? now : nextRunAt,
    nextRunAt,
    forced: Boolean(forceDue),
    managementPriority: management.score,
    managementReasons: management.reasons,
    management,
  };
}

export function hydrateAgentProject(project = {}) {
  return backfillProjectEventLedger(project);
}

export function resolveProjectChatTargets(text = '', team = []) {
  const normalized = text.toLowerCase();
  if (/@all\b/i.test(text)) return ['all'];
  const tokenTargets = [...text.matchAll(/@([A-Za-z0-9_-]+)/g)].map((match) => match[1].toLowerCase());

  return Array.from(new Set(team
    .filter((agent) => {
      const name = String(agent.name || '').toLowerCase();
      const id = String(agent.id || '').toLowerCase();
      return (name && normalized.includes(`@${name}`))
        || (id && normalized.includes(`@${id}`))
        || tokenTargets.includes(id)
        || name.split(/\s+/).some((part) => tokenTargets.includes(part));
    })
    .map((agent) => agent.name)));
}

export function createDirectorChatMessage({
  project = {},
  text = '',
  channelId = 'main',
  now = nowIso(),
  id = `m_${Date.now()}`,
  author = 'Director',
  authorId = null,
  source,
  targetIds = [],
  time = 'Now',
  weight,
  targets = resolveProjectChatTargets(text, project.team || []),
} = {}) {
  return attachMessageReceipts({
    id,
    projectId: project.id,
    channelId,
    type: targets.length ? 'mention' : 'text',
    author,
    authorId,
    source,
    time,
    text,
    targets,
    targetIds,
    weight: weight ?? (targets.length ? 'Raised' : null),
  }, project.team || [], { seenAt: now });
}

export function submitProjectChatMessage({
  project = {},
  text = '',
  channelId = 'main',
  now = nowIso(),
  messageId,
  author = 'Director',
  authorId,
  leaderId,
  source,
  targetIds = [],
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      project,
      messages: [],
      route: 'empty',
      responses: {},
    };
  }

  const team = project.team || [];
  const targetNames = targetIds
    .map((targetId) => team.find((agent) => agent.id === targetId || agent.name === targetId)?.name || targetId)
    .filter(Boolean);
  const targets = uniqueStrings([
    ...resolveProjectChatTargets(trimmedText, team),
    ...targetNames,
  ]);
  const userMessageSource = source || (channelId === 'google_chat' ? 'google-chat-message' : 'group-chat-message');
  const userMessage = createDirectorChatMessage({
    project,
    text: trimmedText,
    channelId,
    now,
    id: messageId || `m_${Date.now()}`,
    author,
    authorId,
    source: userMessageSource,
    targetIds,
    targets,
  });
  const projectAfterUserMessage = applyChatMessagesToAgentStates({
    project,
    team,
    messages: [userMessage],
    now,
    source: userMessageSource,
    language: currentLanguage,
  });

  const isFeatureChange = isFeatureChangeRequest(trimmedText);
  const isPeerHandoff = !isFeatureChange && isPeerHandoffRequest(trimmedText) && !/^\s*leader\b/i.test(trimmedText);
  const isLeaderAssignment = !isFeatureChange && !isPeerHandoff && isLeaderAssignmentRequest(trimmedText);

  const leaderAssignmentResponse = isLeaderAssignment ? handleLeaderChatAssignment({
    project: projectAfterUserMessage,
    text: trimmedText,
    leaderId: leaderId || project.kickoffCharter?.governance?.leaderId || team.find((agent) => agent.isLeader)?.id,
    now,
    channelId,
    language: currentLanguage,
  }) : null;
  const leaderAssignmentStartWorkResponse = leaderAssignmentResponse?.task?.ownerId ? runAgentWorkCycle({
    project: leaderAssignmentResponse.project,
    agentId: leaderAssignmentResponse.task.ownerId,
    now,
    trigger: 'leader-assignment-start-work',
    cadence: 'assignment-start',
    channelId,
    dueAt: now,
    taskId: leaderAssignmentResponse.task.id,
    language: currentLanguage,
  }) : null;
  const peerHandoffResponse = isPeerHandoff ? handlePeerHandoff({
    project: projectAfterUserMessage,
    text: trimmedText,
    now,
    channelId,
    language: currentLanguage,
  }) : null;
  const agentReplies = leaderAssignmentResponse || peerHandoffResponse ? [] : buildAgentChatReplies({
    team,
    text: trimmedText,
    targets,
    channelId,
    context: {
      projectId: project.id,
      projectName: project.name,
      language: currentLanguage,
    },
  });
  const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
    project: projectAfterUserMessage,
    text: trimmedText,
    author: author.toLowerCase(),
    now,
    channelId,
    source: channelId === 'google_chat' ? 'google-chat-mention-change-request' : 'group-chat-change-request',
    requestMessageId: userMessage.id,
    language: currentLanguage,
  }) : null;
  const changeOwnerStartWorkResponse = changeResponse?.changeTask?.ownerId ? runAgentWorkCycle({
    project: changeResponse.project,
    agentId: changeResponse.changeTask.ownerId,
    now,
    trigger: 'change-owner-start-work',
    cadence: 'change-start',
    channelId,
    dueAt: now,
    taskId: changeResponse.changeTask.id,
    language: currentLanguage,
  }) : null;
  const ordinaryChatProject = !changeResponse && !leaderAssignmentResponse && !peerHandoffResponse
    ? applyChatMessagesToAgentStates({
      project: projectAfterUserMessage,
      team,
      messages: agentReplies.map((message) => ({ ...message, projectId: project.id })),
      now,
      source: userMessageSource,
      language: currentLanguage,
    })
    : null;
  const finalProject = changeOwnerStartWorkResponse?.project
    || changeResponse?.project
    || leaderAssignmentStartWorkResponse?.project
    || leaderAssignmentResponse?.project
    || peerHandoffResponse?.project
    || ordinaryChatProject
    || projectAfterUserMessage;
  const route = changeResponse ? 'feature-change'
    : leaderAssignmentResponse ? 'leader-assignment'
      : peerHandoffResponse ? 'peer-handoff'
        : 'ordinary-chat';

  return {
    project: finalProject,
    messages: [
      userMessage,
      ...(leaderAssignmentResponse ? [
        leaderAssignmentResponse.assignmentMessage,
        leaderAssignmentResponse.acknowledgementMessage,
      ] : []),
      ...(leaderAssignmentStartWorkResponse?.messages || []),
      ...(peerHandoffResponse ? [
        peerHandoffResponse.requestMessage,
        peerHandoffResponse.acknowledgementMessage,
      ] : []),
      ...agentReplies,
      ...(changeResponse?.discussionMessages || []),
      ...(changeOwnerStartWorkResponse?.messages || []),
    ].map((message) => ({ ...message, projectId: project.id })),
    route,
    userMessage,
    responses: {
      changeResponse,
      changeOwnerStartWorkResponse,
      leaderAssignmentResponse,
      leaderAssignmentStartWorkResponse,
      peerHandoffResponse,
      agentReplies,
    },
  };
}

export function submitAgentMessage({
  project = {},
  agentId,
  text = '',
  targetAgentIds = [],
  channelId = 'main',
  now = nowIso(),
  messageId,
  language = project.language || 'en',
} = {}) {
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const targetIds = uniqueStrings(targetAgentIds);
  const result = submitProjectChatMessage({
    project,
    text,
    channelId,
    now,
    messageId: messageId || `agent_message_${agent.id}_${Date.parse(now) || Date.now()}`,
    author: agent.name,
    authorId: agent.id,
    leaderId: agent.isLeader ? agent.id : project.kickoffCharter?.governance?.leaderId,
    source: 'agent-to-agent-message',
    targetIds,
    language,
  });

  return {
    ...result,
    route: result.route === 'ordinary-chat' ? 'agent-message' : result.route,
    agent: result.project.agentStates?.[agent.id] || null,
    senderAgentId: agent.id,
    targetAgentIds: targetIds,
  };
}

export function submitProjectMeetingMessage({
  project = {},
  text = '',
  now = nowIso(),
  messageId,
  channelId = 'main',
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      project,
      messages: [],
      route: 'empty',
      responses: {},
    };
  }

  const team = project.team || [];
  const targets = resolveProjectChatTargets(trimmedText, team);
  const userMessage = createDirectorChatMessage({
    project,
    text: trimmedText,
    channelId,
    now,
    id: messageId || `room_change_user_${Date.now()}`,
    time: 'War Room',
    weight: targets.length ? 'Meeting Change' : null,
    targets,
  });
  const projectAfterMeetingMessage = applyChatMessagesToAgentStates({
    project,
    team,
    messages: [userMessage],
    now,
    source: 'war-room-meeting-message',
    language: currentLanguage,
  });
  const isFeatureChange = isFeatureChangeRequest(trimmedText);
  const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
    project: projectAfterMeetingMessage,
    text: trimmedText,
    author: 'director',
    now,
    channelId,
    source: 'war-room-meeting-change-request',
    requestMessageId: userMessage.id,
    language: currentLanguage,
  }) : null;
  const changeOwnerStartWorkResponse = changeResponse?.changeTask?.ownerId ? runAgentWorkCycle({
    project: changeResponse.project,
    agentId: changeResponse.changeTask.ownerId,
    now,
    trigger: 'change-owner-start-work',
    cadence: 'change-start',
    channelId,
    dueAt: now,
    taskId: changeResponse.changeTask.id,
    language: currentLanguage,
  }) : null;

  return {
    project: changeOwnerStartWorkResponse?.project || changeResponse?.project || projectAfterMeetingMessage,
    messages: [
      userMessage,
      ...(changeResponse?.discussionMessages || []),
      ...(changeOwnerStartWorkResponse?.messages || []),
    ].map((message) => ({ ...message, projectId: project.id })),
    route: changeResponse ? 'war-room-meeting-change' : 'war-room-meeting-message',
    userMessage,
    responses: {
      changeResponse,
      changeOwnerStartWorkResponse,
    },
  };
}

export function submitProjectMultiChannelChangeRequest({
  project = {},
  text = '',
  now = nowIso(),
  channelIds = ['main', 'google_chat'],
  sourceModes = [],
  messageIdPrefix = `multi_channel_change_${Date.parse(now) || Date.now()}`,
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const trimmedText = text.trim();
  if (!trimmedText) {
    return {
      project,
      messages: [],
      route: 'empty',
      responses: {},
    };
  }

  const team = project.team || [];
  const channels = uniqueStrings(channelIds.length ? channelIds : ['main', 'google_chat']);
  const sourceModeIds = channels.map((channelId, index) => multiChannelSourceModeFor(channelId, sourceModes[index]));
  const sourceModeLabels = sourceModeIds.map((sourceMode, index) => multiChannelSourceLabelFor(sourceMode, channels[index]));
  const targets = resolveProjectChatTargets(trimmedText, team);
  const sourceMessages = channels.map((channelId, index) => createDirectorChatMessage({
    project,
    text: trimmedText,
    channelId,
    now,
    id: `${messageIdPrefix}_${channelId}_${index}`,
    source: sourceModeIds[index] === 'google_chat' ? 'google-chat-message' : 'war-room-meeting-message',
    time: sourceModeLabels[index],
    weight: 'Multi-Channel Change',
    targets,
  }));
  const projectAfterSourceMessages = applyChatMessagesToAgentStates({
    project,
    team,
    messages: sourceMessages,
    now,
    source: 'multi-channel-change-source',
    language: currentLanguage,
  });
  const isFeatureChange = isFeatureChangeRequest(trimmedText);
  const changeResponse = isFeatureChange ? handleFeatureChangeRequest({
    project: projectAfterSourceMessages,
    text: trimmedText,
    author: 'director',
    now,
    channelId: 'main',
    source: 'multi-channel-change-request',
    requestMessageId: sourceMessages[0]?.id || null,
    language: currentLanguage,
  }) : null;
  const nextProject = changeResponse?.project || projectAfterSourceMessages;
  const enrichedChangeProject = changeResponse?.changeRecord ? {
    ...nextProject,
    changeLedger: (nextProject.changeLedger || []).map((change) => (
      change.id === changeResponse.changeRecord.id
        ? {
          ...change,
          source: 'multi-channel-change-request',
          sourceChannelId: 'multi',
          sourceChannelIds: channels,
          sourceModes: sourceModeIds,
          sourceModeLabels,
          sourceMessageIds: sourceMessages.map((message) => message.id),
          requestMessageId: sourceMessages[0]?.id || change.requestMessageId,
        }
        : change
    )),
  } : nextProject;
  const enrichedChangeResponse = changeResponse ? {
    ...changeResponse,
    project: enrichedChangeProject,
    changeRecord: {
      ...changeResponse.changeRecord,
      source: 'multi-channel-change-request',
      sourceChannelId: 'multi',
      sourceChannelIds: channels,
      sourceModes: sourceModeIds,
      sourceModeLabels,
      sourceMessageIds: sourceMessages.map((message) => message.id),
      requestMessageId: sourceMessages[0]?.id || changeResponse.changeRecord.requestMessageId,
    },
  } : null;
  const changeOwnerStartWorkResponse = enrichedChangeResponse?.changeTask?.ownerId ? runAgentWorkCycle({
    project: enrichedChangeProject,
    agentId: enrichedChangeResponse.changeTask.ownerId,
    now,
    trigger: 'change-owner-start-work',
    cadence: 'change-start',
    channelId: 'main',
    dueAt: now,
    taskId: enrichedChangeResponse.changeTask.id,
    language: currentLanguage,
  }) : null;
  const finalProject = changeOwnerStartWorkResponse?.project || enrichedChangeProject;

  return {
    project: finalProject,
    messages: [
      ...sourceMessages,
      ...(changeResponse?.discussionMessages || []),
      ...(changeOwnerStartWorkResponse?.messages || []),
    ].map((message) => ({ ...message, projectId: project.id })),
    route: changeResponse ? 'multi-channel-change' : 'multi-channel-message',
    userMessages: sourceMessages,
    responses: {
      changeResponse: enrichedChangeResponse,
      changeOwnerStartWorkResponse,
    },
  };
}

export function runProjectAutonomousCycle({
  project = {},
  cadence = 'hourly',
  messages = [],
  now = nowIso(),
  trigger = 'manual',
  schedulerReason = `${cadence}-pulse-requested`,
  dueAt = now,
  source = 'autonomous-cycle-chat',
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const result = advanceAutonomousProjectCycle({
    project,
    team: project.team || [],
    cadence,
    messages,
    now,
    trigger,
    schedulerReason,
    dueAt,
    language: currentLanguage,
  });
  const publishedCycle = publishAutonomousCycleChat({
    project: result.project,
    cycle: result.cycle,
    cadence,
    projectId: project.id,
    now,
    source,
    language: currentLanguage,
  });

  return {
    project: publishedCycle.project,
    cycle: result.cycle,
    messages: publishedCycle.messages,
  };
}

export function runAgentWorkCycle({
  project = {},
  agentId,
  now = nowIso(),
  trigger = 'agent-worker',
  cadence = 'agent-pulse',
  channelId = 'main',
  dueAt = now,
  intervalMs,
  managementPriority = 0,
  managementReasons = [],
  taskId,
  language = project.language || 'en',
  artifactWriter = null,
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const t = createTranslator(currentLanguage);
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const previousStates = project.agentStates || {};
  const previousState = previousStates[agent.id] || {
    agentId: agent.id,
    name: agent.name,
    role: agent.role,
    inbox: [],
    obligations: [],
    worklog: [],
    currentPlan: null,
    taskIds: [],
  };
  const computedManagement = agentManagementPriority({ project, agent, state: previousState });
  const resolvedManagementPriority = managementPriority || computedManagement.score;
  const resolvedManagementReasons = managementReasons.length ? managementReasons : computedManagement.reasons;
  const managementSignals = managementSignalItems({ project, agent, state: previousState });
  const managementSignalIds = new Set(managementSignals.map((item) => item.id).filter(Boolean));
  const managementSignalMessageIds = new Set(managementSignals.map((item) => item.sourceMessageId || item.messageId).filter(Boolean));
  const managementResponderTargetIds = managementResponseTargets({
    project,
    state: previousState,
    signals: managementSignals,
  }).filter((targetId) => targetId !== agent.id);
  const managementResponderTargets = managementResponderTargetIds
    .map((targetId) => team.find((member) => member.id === targetId || member.name === targetId))
    .filter(Boolean);
  const task = openAgentTask(project, agent, taskId);
  const timestamp = Date.parse(now) || Date.now();
  const cycleId = `agent_cycle_${agent.id}_${timestamp}`;
  const nextRunAt = new Date(safeDateMs(now) + agentWorkIntervalMs(project, previousState, intervalMs)).toISOString();
  const routine = previousState.currentPlan?.routine || null;
  const workText = task?.text || previousState.currentPlan?.focus || t('agent.monitorWork');
  const workPulseCount = task ? (task.workPulseCount || 0) + 1 : 0;
  const completed = Boolean(task && workPulseCount >= 2);
  const taskStatus = completed ? 'done' : task ? 'in-progress' : 'monitoring';
  const artifact = routine?.artifact || (currentLanguage === 'zh' ? '时间线证据' : 'timeline evidence');
  const messageId = `agent_work_${agent.id}_${timestamp}`;
  const logId = `log_${messageId}`;
  const workSummary = completed
    ? t('agent.workCompletedLog', { agent: agent.name, workText, artifact })
    : t('agent.workProgressLog', { agent: agent.name, workText, routine: routine?.label || (currentLanguage === 'zh' ? '固定工作例行程序' : 'their fixed work routine'), artifact });
  const managementLine = resolvedManagementReasons.length ? t('agent.managementPriority', { reasons: resolvedManagementReasons.join('; ') }) : '';
  const managementResponseLine = managementSignals.length
    ? t('agent.managementResponse', {
      count: managementSignals.length,
      plural: managementSignals.length === 1 ? '' : 's',
      targets: managementResponderTargets.map((target) => target.name).join(' / ') || (currentLanguage === 'zh' ? '管理链' : 'the management chain'),
    })
    : '';
  const progressMessage = attachMessageReceipts({
    id: messageId,
    projectId: project.id,
    channelId,
    type: completed ? 'decision' : 'progress',
    author: agent.name,
    role: agent.role,
    time: t('agent.agentPulse'),
    text: completed
      ? t('agent.completed', { workText, artifact, managementLine, responseLine: managementResponseLine })
      : t('agent.progress', { workText, routine: routine?.label || (currentLanguage === 'zh' ? '我的固定例行程序' : 'my fixed routine'), artifact, managementLine, responseLine: managementResponseLine }),
    targets: [],
    weight: completed ? t('agent.completedWeight') : t('agent.progressWeight'),
    agentWorker: {
      cycleId,
      agentId: agent.id,
      taskId: task?.id || null,
      trigger,
      cadence,
      dueAt,
      nextRunAt,
      managementPriority: resolvedManagementPriority,
      managementReasons: resolvedManagementReasons,
    },
  }, team, { seenAt: now });
  const artifactDraft = buildAgentArtifactDraft({
    project,
    agent,
    task,
    workText,
    workSummary,
    now,
    completed,
    cycleId,
  });
  const writtenArtifact = typeof artifactWriter === 'function'
    ? artifactWriter(artifactDraft, { project, agent, task, now, completed, cycleId })
    : null;
  const artifactRecord = {
    ...artifactDraft,
    ...(writtenArtifact || {}),
    existsOnDisk: Boolean(writtenArtifact?.absolutePath || writtenArtifact?.path),
    source: typeof artifactWriter === 'function' ? 'agent-artifact-writer' : 'agent-artifact-draft',
  };
  const timelineSubmission = buildAgentTimelineToolSubmission({
    project,
    agent,
    task,
    now,
    cycleId,
    completed,
    workText,
    workSummary,
    routine,
    artifactRecord,
    managementReasons: resolvedManagementReasons,
    collaboratorIds: managementResponderTargetIds,
    trigger,
    cadence,
  });
  const progressLog = {
    id: logId,
    time: now,
    agent: agent.name,
    agentId: agent.id,
    log: workSummary,
    cadence,
    eventType: completed ? 'agent-task-completed' : 'agent-work-pulse',
    taskId: task?.id || null,
    sourceChannelId: channelId,
    receiptCount: progressMessage.visibility?.receiptCount || 0,
    directTargetIds: progressMessage.directTargetIds || [],
    attachments: [artifactRecord],
    artifactIds: [artifactRecord.id],
    artifactPaths: [artifactRecord.absolutePath || artifactRecord.path || artifactRecord.relativePath].filter(Boolean),
    timelineSubmission,
    commitAreaKey: timelineSubmission.commitAreaKey,
    commitMessage: timelineSubmission.commitMessage,
    thinkingFrame: timelineSubmission.thinkingFrame,
    collaborationContext: timelineSubmission.collaborationContext,
  };
  const managementResponseMessages = managementResponderTargets.map((target, index) => attachMessageReceipts({
    id: `agent_management_response_${agent.id}_${target.id}_${timestamp}_${index}`,
    projectId: project.id,
    channelId,
    type: 'mention',
    author: agent.name,
    role: agent.role,
    time: t('agent.agentPulse'),
    text: t('agent.managementResponseMessage', { agent: agent.name, target: target.name, workText, artifact }),
    targets: [target.name],
    directTargetIds: [target.id],
    heardBy: [target.id],
    weight: currentLanguage === 'zh' ? '管理回应' : 'Management Response',
    agentWorker: {
      cycleId,
      agentId: agent.id,
      targetAgentId: target.id,
      taskId: task?.id || null,
      trigger,
      cadence,
      dueAt,
      nextRunAt,
      managementPriority: resolvedManagementPriority,
      managementReasons: resolvedManagementReasons,
      managementSignalIds: managementSignals.map((item) => item.id).filter(Boolean),
    },
  }, team, { seenAt: now }));
  const managementResponseLogs = managementResponderTargets.map((target, index) => ({
    id: `log_agent_management_response_${agent.id}_${target.id}_${timestamp}_${index}`,
    time: now,
    agent: agent.name,
    agentId: agent.id,
    targetAgentId: target.id,
    log: t('agent.managementResponseLog', { agent: agent.name, target: target.name }),
    cadence,
    eventType: 'management-response',
    taskId: task?.id || null,
    sourceChannelId: channelId,
    receiptCount: managementResponseMessages[index]?.visibility?.receiptCount || 0,
    directTargetIds: [target.id],
  }));
  const managementTargetIds = Array.from(new Set([
    ...(previousState.managedIds || agent.managedIds || []),
    ...(previousState.peerManagedIds || []),
  ].filter((targetId) => targetId && targetId !== agent.id)));
  const managementTargets = managementTargetIds
    .map((targetId) => team.find((member) => member.id === targetId || member.name === targetId))
    .filter(Boolean);
  const managementMessages = managementTargets.map((target, index) => {
    const targetState = previousStates[target.id] || {};
    const isPeerManaged = (previousState.peerManagedIds || []).includes(target.id);
    return attachMessageReceipts({
      id: `agent_management_${agent.id}_${target.id}_${timestamp}_${index}`,
      projectId: project.id,
      channelId,
      type: 'mention',
      author: agent.name,
      role: agent.role,
      time: t('agent.agentPulse'),
      text: t('agent.managementCheckIn', {
        agent: agent.name,
        target: target.name,
        kind: isPeerManaged ? t('agent.peerManagement') : t('agent.management'),
        focus: targetState.currentPlan?.focus || t('agent.currentObligation'),
      }),
      targets: [target.name],
      directTargetIds: [target.id],
      heardBy: [target.id],
      weight: isPeerManaged ? t('agent.peerManagement') : t('agent.management'),
      agentWorker: {
        cycleId,
        agentId: agent.id,
        targetAgentId: target.id,
        taskId: task?.id || null,
        trigger,
        cadence,
        dueAt,
        nextRunAt,
        managementPriority: resolvedManagementPriority,
        managementReasons: resolvedManagementReasons,
      },
    }, team, { seenAt: now });
  });
  const managementLogs = managementTargets.map((target, index) => {
    const isPeerManaged = (previousState.peerManagedIds || []).includes(target.id);
    return {
      id: `log_agent_management_${agent.id}_${target.id}_${timestamp}_${index}`,
      time: now,
      agent: agent.name,
      agentId: agent.id,
      targetAgentId: target.id,
      log: t('agent.managementCheckInLog', { agent: agent.name, kind: isPeerManaged ? t('agent.peerManagement') : t('agent.management'), target: target.name }),
      cadence,
      eventType: isPeerManaged ? 'peer-management-check-in' : 'management-check-in',
      taskId: task?.id || null,
      sourceChannelId: channelId,
      receiptCount: managementMessages[index]?.visibility?.receiptCount || 0,
      directTargetIds: [target.id],
    };
  });
  const nextTasks = (project.tasks || []).map((item) => {
    if (!task || String(item.id) !== String(task.id)) return item;
    return {
      ...item,
      status: completed ? 'done' : 'in-progress',
      lastTouchedAt: now,
      workPulseCount,
      completedAt: completed ? now : item.completedAt,
      evidenceMessageIds: Array.from(new Set([...(item.evidenceMessageIds || []), progressMessage.id])),
      timelineLogIds: Array.from(new Set([...(item.timelineLogIds || []), progressLog.id])),
      attachments: [
        ...(item.attachments || []),
        artifactRecord,
      ].filter((attachment, index, all) => all.findIndex((candidate) => candidate.id === attachment.id) === index),
      artifactIds: Array.from(new Set([...(item.artifactIds || []), artifactRecord.id])),
      artifactPaths: Array.from(new Set([...(item.artifactPaths || []), ...(progressLog.artifactPaths || [])])),
    };
  });
  const nextState = {
    ...previousState,
    agentId: agent.id,
    name: previousState.name || agent.name,
    role: previousState.role || agent.role,
    status: task ? (completed ? 'completed-task' : 'working') : 'monitoring',
    currentPlan: {
      ...(previousState.currentPlan || {}),
      focus: workText,
      next: completed ? t('agent.waitNext') : t('agent.continueWork'),
      taskId: task?.id || previousState.currentPlan?.taskId || null,
      routine,
    },
    taskIds: Array.from(new Set([...(previousState.taskIds || []), task?.id].filter(Boolean))),
    inbox: (previousState.inbox || []).map((item) => {
      const matchesSignal = managementSignalIds.has(item.id)
        || managementSignalMessageIds.has(item.sourceMessageId || item.messageId);
      if (!matchesSignal) return item;
      return {
        ...item,
        status: 'addressed',
        respondedAt: now,
        responseMessageIds: managementResponseMessages.map((message) => message.id),
      };
    }),
    obligations: (previousState.obligations || []).map((obligation) => {
      const matchesTask = task && String(obligation.taskId || '') === String(task.id);
      const matchesManagementSignal = managementSignalMessageIds.has(obligation.sourceMessageId || obligation.messageId);
      if (matchesManagementSignal) {
        return {
          ...obligation,
          status: 'done',
          lastWorkedAt: now,
          completedAt: now,
          responseMessageIds: managementResponseMessages.map((message) => message.id),
        };
      }
      if (!matchesTask) return obligation;
      return {
        ...obligation,
        status: completed ? 'done' : 'in-progress',
        lastWorkedAt: now,
        completedAt: completed ? now : obligation.completedAt,
      };
    }),
    worklog: [
      {
        id: `worklog_${messageId}`,
        at: now,
        kind: completed ? 'agent-task-completed' : 'agent-work-pulse',
        source: 'agent-work-cycle',
        sourceMessageId: progressMessage.id,
        taskId: task?.id || null,
        text: workSummary,
        artifactId: artifactRecord.id,
        artifactPath: artifactRecord.absolutePath || artifactRecord.path || artifactRecord.relativePath,
        timelineSubmissionId: timelineSubmission.id,
        commitAreaKey: timelineSubmission.commitAreaKey,
        thinkingFrame: timelineSubmission.thinkingFrame,
      },
      ...(managementSignals.length ? [{
        id: `worklog_management_response_${messageId}`,
        at: now,
        kind: 'management-response',
        source: 'agent-work-cycle',
        sourceMessageIds: Array.from(managementSignalMessageIds),
        responseMessageIds: managementResponseMessages.map((message) => message.id),
        taskId: task?.id || null,
        text: currentLanguage === 'zh'
          ? `${agent.name} 在继续工作脉冲前回应了 ${managementSignals.length} 条管理信号。`
          : `${agent.name} responded to ${managementSignals.length} management signal${managementSignals.length === 1 ? '' : 's'} before continuing the work pulse.`,
      }] : []),
      ...(previousState.worklog || []),
    ].slice(0, 80),
    lastActiveAt: now,
    lastAgentRunAt: now,
    nextAgentRunAt: nextRunAt,
  };
  const projectWithState = {
    ...project,
    progress: Math.min(100, (project.progress || 0) + (completed ? 2 : task ? 1 : 0)),
    tasks: nextTasks,
    logs: [...managementResponseLogs, ...managementLogs, progressLog, ...(project.logs || [])],
    agentStates: {
      ...previousStates,
      [agent.id]: nextState,
    },
    agentWorkerLedger: [
      {
        id: cycleId,
        agentId: agent.id,
        taskId: task?.id || null,
        trigger,
        cadence,
        dueAt,
        nextRunAt,
        managementPriority: resolvedManagementPriority,
        managementReasons: resolvedManagementReasons,
        ranAt: now,
        status: taskStatus,
        messageId: progressMessage.id,
        logId: progressLog.id,
        managementTargetIds: managementTargets.map((target) => target.id),
        managementResponseTargetIds: managementResponderTargets.map((target) => target.id),
        managementSignalIds: managementSignals.map((item) => item.id).filter(Boolean),
        managementResponseCount: managementResponseLogs.length,
        managementEventCount: managementLogs.length,
      },
      ...(project.agentWorkerLedger || []),
    ].slice(0, 100),
  };
  const projectWithTimelineEvent = appendProjectEvents(projectWithState, [
    createProjectLedgerEvent({
      id: `evt_${logId}`,
      type: progressLog.eventType,
      time: now,
      actor: agent.name,
      summary: progressLog.log,
      source: 'agent-work-cycle',
      channelId,
      evidenceIds: [progressLog.id, progressMessage.id, artifactRecord.id],
      entityIds: {
        agentId: agent.id,
        taskId: task?.id || null,
        messageId: progressMessage.id,
        logId: progressLog.id,
      },
      payload: {
        trigger,
        cadence,
        dueAt,
        nextRunAt,
        completed,
        managementPriority: resolvedManagementPriority,
        managementReasons: resolvedManagementReasons,
        managementSignalIds: managementSignals.map((item) => item.id).filter(Boolean),
        artifact: artifactRecord,
        timelineSubmission,
      },
    }),
    ...managementResponseLogs.map((log, index) => createProjectLedgerEvent({
      id: `evt_${log.id}`,
      type: log.eventType,
      time: now,
      actor: agent.name,
      summary: log.log,
      source: 'agent-work-cycle-management-response',
      channelId,
      evidenceIds: [log.id, managementResponseMessages[index]?.id, ...Array.from(managementSignalMessageIds)].filter(Boolean),
      entityIds: {
        agentId: agent.id,
        targetAgentId: log.targetAgentId,
        taskId: task?.id || null,
        messageId: managementResponseMessages[index]?.id || null,
        logId: log.id,
      },
      payload: {
        trigger,
        cadence,
        dueAt,
        nextRunAt,
        managementPriority: resolvedManagementPriority,
        managementReasons: resolvedManagementReasons,
        managementSignalIds: managementSignals.map((item) => item.id).filter(Boolean),
      },
    })),
    ...managementLogs.map((log, index) => createProjectLedgerEvent({
      id: `evt_${log.id}`,
      type: log.eventType,
      time: now,
      actor: agent.name,
      summary: log.log,
      source: 'agent-work-cycle-management',
      channelId,
      evidenceIds: [log.id, managementMessages[index]?.id].filter(Boolean),
      entityIds: {
        agentId: agent.id,
        targetAgentId: log.targetAgentId,
        taskId: task?.id || null,
        messageId: managementMessages[index]?.id || null,
        logId: log.id,
      },
      payload: {
        trigger,
        cadence,
        dueAt,
        nextRunAt,
        managementPriority: resolvedManagementPriority,
        managementReasons: resolvedManagementReasons,
      },
    })),
  ]);
  const finalProject = applyChatMessagesToAgentStates({
    project: projectWithTimelineEvent,
    team,
    messages: [progressMessage, ...managementResponseMessages, ...managementMessages],
    now,
    source: 'agent-work-cycle-chat',
    language: currentLanguage,
  });

  return {
    project: finalProject,
    messages: [progressMessage, ...managementResponseMessages, ...managementMessages].map((message) => ({ ...message, projectId: project.id })),
    route: 'agent-work-cycle',
    agent: finalProject.agentStates?.[agent.id] || nextState,
    cycle: finalProject.agentWorkerLedger?.[0] || null,
    log: progressLog,
    task: task ? nextTasks.find((item) => String(item.id) === String(task.id)) : null,
  };
}

export function runDueProjectAutonomousCycles({
  projects = [],
  getMessages = () => [],
  now = nowIso(),
  trigger = 'backend-scheduler',
  source = 'backend-scheduler-autonomous-chat',
  forceDue = false,
  forceReason = 'project-forced-sweep',
  forceProjectIds = [],
} = {}) {
  const forceProjectIdSet = new Set((forceProjectIds || []).map((id) => String(id)));
  return projects.reduce((summary, project) => {
    const cadence = project.autonomy?.cadence || project.autonomousCadence || 'hourly';
    const schedule = evaluateAutonomousSchedule({ project, cadence, now });
    const projectForceDue = Boolean(forceDue) && (!forceProjectIdSet.size || forceProjectIdSet.has(String(project.id)));
    if (!projectForceDue && !schedule.due) {
      summary.skipped.push({
        projectId: project.id,
        cadence,
        reason: schedule.reason,
        nextRunAt: schedule.nextRunAt,
      });
      return summary;
    }

    const result = runProjectAutonomousCycle({
      project,
      cadence,
      messages: getMessages(project.id),
      now,
      trigger,
      schedulerReason: projectForceDue ? forceReason : schedule.reason,
      dueAt: projectForceDue ? now : schedule.dueAt,
      source,
    });
    summary.processed.push({
      projectId: project.id,
      cadence,
      reason: projectForceDue ? forceReason : schedule.reason,
      dueAt: projectForceDue ? now : schedule.dueAt,
      nextRunAt: result.project.nextAutonomousRunAt,
      result,
    });
    summary.messages.push(...result.messages);
    return summary;
  }, {
    processed: [],
    skipped: [],
    messages: [],
  });
}

export function runDueAgentWorkCycles({
  projects = [],
  now = nowIso(),
  trigger = 'backend-agent-scheduler',
  intervalMs,
  maxAgentsPerProject = Infinity,
  maxProjects = Infinity,
  forceDue = false,
  forceReason = 'agent-forced-sweep',
  forceProjectIds = [],
} = {}) {
  const forceProjectIdSet = new Set((forceProjectIds || []).map((id) => String(id)));
  return projects.reduce((summary, originalProject) => {
    if (summary.processedProjectCount >= maxProjects) {
      summary.skipped.push({
        projectId: originalProject.id,
        reason: 'agent-project-limit-reached',
        nextRunAt: originalProject.nextAgentRunAt || null,
        agents: [],
      });
      return summary;
    }
    let project = originalProject;
    const projectForceDue = Boolean(forceDue) && (!forceProjectIdSet.size || forceProjectIdSet.has(String(project.id)));
    const dueAgents = [];
    const skippedAgents = [];

    const dueCandidates = [];
    (project.team || []).forEach((agent) => {
      const schedule = evaluateAgentWorkSchedule({
        project,
        agentId: agent.id,
        now,
        intervalMs,
        forceDue: projectForceDue,
        forceReason,
      });
      if (schedule.due) {
        dueCandidates.push({ agent, schedule });
      } else {
        skippedAgents.push({
          projectId: project.id,
          agentId: agent.id,
          reason: schedule.reason,
          nextRunAt: schedule.nextRunAt,
          managementPriority: schedule.managementPriority || 0,
          managementReasons: schedule.managementReasons || [],
        });
      }
    });
    dueCandidates
      .sort((a, b) => (
        (b.schedule.managementPriority || 0) - (a.schedule.managementPriority || 0)
        || safeDateMs(a.schedule.dueAt, 0) - safeDateMs(b.schedule.dueAt, 0)
        || String(a.agent.id).localeCompare(String(b.agent.id))
      ))
      .forEach((candidate, index) => {
        if (index < maxAgentsPerProject) {
          dueAgents.push(candidate);
          return;
        }
        skippedAgents.push({
          projectId: project.id,
          agentId: candidate.agent.id,
          reason: 'agent-max-per-project-limit',
          nextRunAt: candidate.schedule.nextRunAt,
          managementPriority: candidate.schedule.managementPriority || 0,
          managementReasons: candidate.schedule.managementReasons || [],
        });
      });

    dueAgents.forEach(({ agent, schedule }) => {
      const result = runAgentWorkCycle({
        project,
        agentId: agent.id,
        now,
        trigger,
        dueAt: schedule.dueAt,
        intervalMs: schedule.cadenceMs,
        managementPriority: schedule.managementPriority,
        managementReasons: schedule.managementReasons,
      });
      project = result.project;
      summary.processed.push({
        projectId: project.id,
        agentId: agent.id,
        reason: schedule.reason,
        dueAt: schedule.dueAt,
        nextRunAt: result.cycle?.nextRunAt || result.agent?.nextAgentRunAt,
        managementPriority: schedule.managementPriority || 0,
        managementReasons: schedule.managementReasons || [],
        result,
      });
      summary.messages.push(...result.messages);
    });

    if (dueAgents.length) {
      summary.processedProjectCount += 1;
      summary.projects.push(project);
    }
    summary.skipped.push(...skippedAgents);
    return summary;
  }, {
    processed: [],
    skipped: [],
    projects: [],
    messages: [],
    processedProjectCount: 0,
  });
}

function buildRoleQuestionResolutions({ transcript = [], clarifications = [] } = {}) {
  const roleQuestions = transcript.filter((item) => item.stage === 'role-clarification' || item.type === 'role-question');
  return roleQuestions.map((question) => {
    const answers = clarifications.filter((item) => item.repliesTo === question.id);
    const latestAnswer = answers.at(-1) || null;
    return {
      questionId: question.id,
      speakerId: question.speakerId || null,
      speakerName: question.speaker || question.agentName || question.speakerId || 'Agent',
      questionText: question.text || '',
      answered: answers.length > 0,
      answerIds: answers.map((item) => item.id).filter(Boolean),
      answerText: latestAnswer?.text || null,
      answeredAt: latestAnswer?.createdAt || null,
    };
  });
}

function buildLeaderElectionResolution({
  leaderElection = {},
  selectedLeaderId,
  team = [],
  now = nowIso(),
  managerConfirmed = false,
} = {}) {
  const candidates = leaderElection.candidates || [];
  const transcript = leaderElection.transcript || [];
  const selectedCandidate = candidates.find((candidate) => candidate.agentId === selectedLeaderId || candidate.id === selectedLeaderId)
    || candidates.find((candidate) => candidate.agentId === leaderElection.recommendedLeaderId || candidate.id === leaderElection.recommendedLeaderId)
    || candidates[0]
    || null;
  const selectedAgent = team.find((agent) => agent.id === (selectedLeaderId || selectedCandidate?.agentId) || agent.name === selectedLeaderId)
    || team.find((agent) => agent.id === selectedCandidate?.agentId)
    || null;
  const resolvedLeaderId = selectedLeaderId || selectedCandidate?.agentId || selectedAgent?.id || null;
  const candidateRows = candidates.map((candidate) => {
    const campaignTurn = transcript.find((item) => item.speakerId === candidate.agentId || item.agentId === candidate.agentId);
    return {
      agentId: candidate.agentId || candidate.id,
      name: candidate.name || team.find((agent) => agent.id === candidate.agentId)?.name || candidate.agentId,
      role: candidate.role || team.find((agent) => agent.id === candidate.agentId)?.role || '',
      score: candidate.score || 0,
      campaignId: campaignTurn?.id || null,
      heardBy: candidate.hearsOthers || campaignTurn?.hearsOthers || campaignTurn?.hears || [],
      selected: resolvedLeaderId === (candidate.agentId || candidate.id),
    };
  });

  return {
    status: managerConfirmed ? 'manager-confirmed' : 'awaiting-manager-confirmation',
    recommendedLeaderId: leaderElection.recommendedLeaderId || candidates[0]?.agentId || null,
    selectedLeaderId: resolvedLeaderId,
    selectedLeaderName: selectedAgent?.name || selectedCandidate?.name || resolvedLeaderId || null,
    selectedFromCandidateSlate: candidateRows.some((candidate) => candidate.agentId === resolvedLeaderId),
    managerConfirmed: Boolean(managerConfirmed),
    confirmedAt: managerConfirmed ? now : null,
    candidateCount: candidateRows.length,
    campaignIds: transcript.map((item) => item.id).filter(Boolean),
    hearingEdgeCount: transcript.reduce((sum, item) => sum + (item.hearsOthers?.length || item.hears?.length || 0), 0),
    candidates: candidateRows,
  };
}

export function createKickoffMeetingSession({
  meetingId = `kickoff_meeting_${Date.now()}`,
  projectId = `project_${Date.now()}`,
  name = 'Untitled Agent Project',
  brief = '',
  team = [],
  selectedLeaderId,
  reviewerId,
  tasks = [],
  now = nowIso(),
  source = 'backend-kickoff-meeting-session',
  language = 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const projectBrief = [name, brief].filter(Boolean).join(' ');
  const roleNegotiation = createKickoffRoleNegotiation(team, projectBrief, { projectId, projectName: name, language: currentLanguage });
  const leaderElection = createLeaderElection(team, projectBrief, { projectId, projectName: name, language: currentLanguage });
  const recommendedLeader = team.find((agent) => agent.id === (selectedLeaderId || leaderElection.recommendedLeaderId))
    || team.find((agent) => agent.id === leaderElection.recommendedLeaderId)
    || team[0]
    || null;
  const reviewer = team.find((agent) => agent.id === reviewerId || agent.name === reviewerId)
    || team.find((agent) => agent.id !== recommendedLeader?.id && /review|evidence|qa|critic|report/i.test(`${agent.role || ''} ${agent.title || ''} ${agent.skill || ''}`))
    || team.find((agent) => agent.id !== recommendedLeader?.id)
    || recommendedLeader;
  const transcript = [
    {
      id: `${meetingId}_director_brief`,
      type: 'director-brief',
      speaker: 'Director',
      speakerId: 'director',
      role: 'Project Owner',
      text: brief || name,
      hears: team.map((agent) => agent.id),
      stage: 'brief',
    },
    ...(roleNegotiation.transcript || []).map((item) => ({
      ...item,
      stage: item.type === 'role-question' ? 'role-clarification' : 'self-nomination',
      hears: item.hears || team.filter((agent) => agent.id !== item.speakerId).map((agent) => agent.id),
    })),
    ...(leaderElection.transcript || []).map((item) => ({
      ...item,
      stage: 'leader-campaign',
      hears: item.hearsOthers || item.hears || team.filter((agent) => agent.id !== item.speakerId).map((agent) => agent.id),
    })),
  ];
  const roleQuestionResolutions = buildRoleQuestionResolutions({ transcript, clarifications: [] });
  const leaderElectionResolution = buildLeaderElectionResolution({
    leaderElection,
    selectedLeaderId,
    team,
    now,
    managerConfirmed: false,
  });
  const nextActionResolution = buildNextActionResolution({
    tasks,
    team,
    selectedLeaderId: leaderElectionResolution.selectedLeaderId || recommendedLeader?.id,
    now,
    managerConfirmed: false,
  });

  return {
    id: meetingId,
    projectId,
    name,
    brief,
    source,
    status: 'awaiting-manager-decision',
    createdAt: now,
    updatedAt: now,
    team,
    tasks,
    recommendedLeaderId: recommendedLeader?.id || null,
    recommendedLeaderName: recommendedLeader?.name || null,
    reviewerId: reviewer?.id || null,
    reviewerName: reviewer?.name || null,
    roleNegotiation,
    leaderElection,
    transcript,
    roleQuestionResolutions,
    leaderElectionResolution,
    nextActionResolution,
    decisionOptions: {
      selectableTeamIds: team.map((agent) => agent.id),
      leaderCandidateIds: uniqueStrings((leaderElection.candidates || []).map((candidate) => candidate.id)),
      recommendedLeaderId: recommendedLeader?.id || null,
      reviewerId: reviewer?.id || null,
      taskCount: tasks.length,
    },
    evidence: {
      transcriptIds: transcript.map((item) => item.id).filter(Boolean),
      roleTranscriptIds: (roleNegotiation.transcript || []).map((item) => item.id),
      leaderCampaignIds: (leaderElection.transcript || []).map((item) => item.id),
      roleQuestionResolutions,
      leaderElectionResolution,
      nextActionResolution,
      unansweredRoleQuestionIds: roleQuestionResolutions.filter((item) => !item.answered).map((item) => item.questionId),
      hearingEdgeCount: transcript.reduce((count, item) => count + (item.hears?.length || item.hearsOthers?.length || 0), 0),
    },
  };
}

export function confirmKickoffMeetingLeader({
  meeting = {},
  selectedLeaderId,
  now = nowIso(),
} = {}) {
  const leaderElectionResolution = buildLeaderElectionResolution({
    leaderElection: meeting.leaderElection || {},
    selectedLeaderId: selectedLeaderId || meeting.recommendedLeaderId,
    team: meeting.team || [],
    now,
    managerConfirmed: true,
  });
  return {
    ...meeting,
    updatedAt: now,
    recommendedLeaderId: leaderElectionResolution.selectedLeaderId || meeting.recommendedLeaderId || null,
    recommendedLeaderName: leaderElectionResolution.selectedLeaderName || meeting.recommendedLeaderName || null,
    leaderElectionResolution,
    evidence: {
      ...(meeting.evidence || {}),
      leaderElectionResolution,
      leaderCampaignIds: leaderElectionResolution.campaignIds,
      leaderHearingEdgeCount: leaderElectionResolution.hearingEdgeCount,
    },
  };
}

export function buildNextActionResolution({
  tasks = [],
  team = [],
  selectedLeaderId,
  now = nowIso(),
  managerConfirmed = false,
  source = 'kickoff-meeting-next-actions',
} = {}) {
  const leader = team.find((agent) => agent.id === selectedLeaderId || agent.name === selectedLeaderId || agent.isLeader)
    || team.find((agent) => agent.isLeader)
    || team[0]
    || null;
  const taskRows = (tasks || [])
    .map((task, index) => {
      const taskObject = typeof task === 'object' && task ? task : {};
      const text = typeof task === 'string' ? task.trim() : String(taskObject.text || '').trim();
      if (!text) return null;
      const owner = team.find((agent) => (
        agent.id === taskObject.ownerId
        || agent.id === taskObject.assignee
        || agent.name === taskObject.assignee
        || agent.name === taskObject.ownerName
      ));
      return {
        ...taskObject,
        id: taskObject.id || `meeting_next_action_${index + 1}`,
        text,
        ownerId: taskObject.ownerId || owner?.id || leader?.id || null,
        ownerName: taskObject.ownerName || taskObject.assignee || owner?.name || leader?.name || null,
        assignee: taskObject.assignee || taskObject.ownerName || owner?.name || leader?.name || null,
        status: taskObject.status || 'pending',
      };
    })
    .filter(Boolean);

  return {
    status: managerConfirmed ? 'manager-confirmed' : 'awaiting-manager-confirmation',
    managerConfirmed: Boolean(managerConfirmed),
    confirmedAt: managerConfirmed ? now : null,
    source,
    taskCount: taskRows.length,
    actionIds: taskRows.map((task) => task.id).filter(Boolean),
    tasks: taskRows,
    leaderAssignmentMode: leader ? 'leader-assigns-first-actions' : 'awaiting-leader',
    leaderId: leader?.id || selectedLeaderId || null,
    leaderName: leader?.name || null,
  };
}

export function confirmKickoffMeetingNextActions({
  meeting = {},
  tasks,
  now = nowIso(),
} = {}) {
  const nextActionResolution = buildNextActionResolution({
    tasks: tasks || meeting.tasks || meeting.nextActionResolution?.tasks || [],
    team: meeting.team || [],
    selectedLeaderId: meeting.leaderElectionResolution?.selectedLeaderId || meeting.recommendedLeaderId,
    now,
    managerConfirmed: true,
  });
  return {
    ...meeting,
    tasks: nextActionResolution.tasks,
    updatedAt: now,
    nextActionResolution,
    evidence: {
      ...(meeting.evidence || {}),
      nextActionResolution,
      nextActionIds: nextActionResolution.actionIds,
    },
  };
}

export function addKickoffMeetingClarification({
  meeting = {},
  questionId,
  text = '',
  now = nowIso(),
  author = 'Director',
} = {}) {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error('Kickoff meeting clarification text is required.');
  const transcript = meeting.transcript || [];
  const question = transcript.find((item) => item.id === questionId)
    || transcript.find((item) => item.stage === 'role-clarification' || item.type === 'role-question')
    || null;
  const timestamp = Date.parse(now) || Date.now();
  const clarification = {
    id: `${meeting.id || 'kickoff_meeting'}_director_clarification_${timestamp}`,
    type: 'director-clarification',
    stage: 'director-clarification',
    speaker: author,
    speakerId: 'director',
    role: 'Project Owner',
    text: trimmedText,
    repliesTo: question?.id || null,
    targetSpeakerId: question?.speakerId || null,
    targetSpeakerName: question?.speaker || null,
    hears: (meeting.team || []).map((agent) => agent.id),
    createdAt: now,
  };
  const clarifications = [...(meeting.managerClarifications || []), clarification];
  const nextTranscript = [...transcript, clarification];
  const roleQuestionResolutions = buildRoleQuestionResolutions({
    transcript: nextTranscript,
    clarifications,
  });

  return {
    ...meeting,
    updatedAt: now,
    managerClarifications: clarifications,
    transcript: nextTranscript,
    roleQuestionResolutions,
    evidence: {
      ...(meeting.evidence || {}),
      transcriptIds: nextTranscript.map((item) => item.id).filter(Boolean),
      clarificationIds: clarifications.map((item) => item.id).filter(Boolean),
      roleQuestionResolutions,
      unansweredRoleQuestionIds: roleQuestionResolutions.filter((item) => !item.answered).map((item) => item.questionId),
      hearingEdgeCount: nextTranscript.reduce((count, item) => count + (item.hears?.length || item.hearsOthers?.length || 0), 0),
    },
  };
}

export function approveKickoffMeetingSession({
  meeting = {},
  selectedTeamIds,
  selectedLeaderId,
  reviewerId,
  tasks,
  now = nowIso(),
} = {}) {
  const selectedIds = selectedTeamIds?.length ? new Set(selectedTeamIds) : null;
  const team = selectedIds
    ? (meeting.team || []).filter((agent) => selectedIds.has(agent.id))
    : meeting.team || [];
  const meetingLeaderResolution = meeting.leaderElectionResolution || meeting.evidence?.leaderElectionResolution || null;
  const approvedLeaderId = selectedLeaderId || meetingLeaderResolution?.selectedLeaderId || meeting.recommendedLeaderId;
  const approvedReviewerId = reviewerId || meeting.reviewerId;
  const approvedTasks = tasks || meeting.nextActionResolution?.tasks || meeting.evidence?.nextActionResolution?.tasks || meeting.tasks || [];
  const meetingNextActionResolution = meeting.nextActionResolution?.managerConfirmed
    ? meeting.nextActionResolution
    : buildNextActionResolution({
      tasks: approvedTasks,
      team,
      selectedLeaderId: approvedLeaderId,
      now,
      managerConfirmed: true,
    });
  const kickoffResult = createKickoffProjectFromMeeting({
    meetingId: meeting.id,
    projectId: meeting.projectId,
    name: meeting.name,
    brief: meeting.brief,
    team,
    selectedLeaderId: approvedLeaderId,
    reviewerId: approvedReviewerId,
    tasks: approvedTasks,
    roleNegotiation: meeting.roleNegotiation,
    leaderElection: meeting.leaderElection,
    meetingClarifications: meeting.managerClarifications || [],
    roleQuestionResolutions: meeting.roleQuestionResolutions || meeting.evidence?.roleQuestionResolutions || [],
    leaderElectionResolution: meetingLeaderResolution,
    nextActionResolution: meetingNextActionResolution,
    now,
    source: 'backend-kickoff-meeting-session-approval',
  });
  const approvedMeeting = {
    ...meeting,
    status: 'approved',
    updatedAt: now,
    approvedAt: now,
    nextActionResolution: meetingNextActionResolution,
    approvedProjectId: kickoffResult.project.id,
    managerDecision: {
      selectedTeamIds: team.map((agent) => agent.id),
      selectedLeaderId: kickoffResult.kickoffCharter?.governance?.leaderId || approvedLeaderId || null,
      selectedLeaderName: kickoffResult.kickoffCharter?.governance?.leaderName || null,
      reviewerId: kickoffResult.kickoffCharter?.governance?.reviewerId || approvedReviewerId || null,
      reviewerName: kickoffResult.kickoffCharter?.governance?.reviewerName || null,
      taskIds: (kickoffResult.project.tasks || []).map((task) => task.id),
      nextActionIds: meetingNextActionResolution.actionIds,
    },
    kickoffCharterId: kickoffResult.kickoffCharter?.id || null,
    firstPulse: {
      started: Boolean(kickoffResult.firstPulse?.messages?.length || kickoffResult.project.autonomousSchedulerLedger?.length),
      trigger: kickoffResult.project.autonomousSchedulerLedger?.[0]?.trigger || null,
      messageIds: (kickoffResult.messages || [])
        .filter((message) => message.time === 'First Pulse' || message.source === 'backend-kickoff-first-pulse-chat')
        .map((message) => message.id),
    },
  };

  return {
    ...kickoffResult,
    meeting: approvedMeeting,
    route: 'kickoff-meeting-approved',
  };
}

export function createKickoffProjectFromMeeting({
  meetingId = null,
  projectId = `project_${Date.now()}`,
  name = 'Untitled Agent Project',
  brief = '',
  team = [],
  selectedLeaderId,
  reviewerId,
  tasks = [],
  roleNegotiation: savedRoleNegotiation,
  leaderElection: savedLeaderElection,
  meetingClarifications = [],
  roleQuestionResolutions = [],
  leaderElectionResolution: savedLeaderElectionResolution,
  nextActionResolution: savedNextActionResolution,
  now = nowIso(),
  autonomy = { enabled: true, cadence: 'hourly' },
  source = 'backend-kickoff-api',
  language = 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const projectBrief = [name, brief].filter(Boolean).join(' ');
  const roleNegotiation = savedRoleNegotiation || createKickoffRoleNegotiation(team, projectBrief, { projectId, projectName: name, language: currentLanguage });
  const leaderElection = savedLeaderElection || createLeaderElection(team, projectBrief, { projectId, projectName: name, language: currentLanguage });
  const leader = team.find((agent) => agent.id === selectedLeaderId || agent.name === selectedLeaderId)
    || team.find((agent) => agent.id === leaderElection.recommendedLeaderId)
    || team[0];
  const reviewer = team.find((agent) => agent.id === reviewerId || agent.name === reviewerId)
    || team.find((agent) => agent.id !== leader?.id && /review|evidence|qa|critic|report/i.test(`${agent.role || ''} ${agent.title || ''} ${agent.skill || ''}`))
    || team.find((agent) => agent.id !== leader?.id)
    || leader;
  const confirmedTeam = team.map((agent) => ({
    ...agent,
    role: agent.id === leader?.id ? 'Leader' : agent.role || agent.title || 'Agent',
    skill: agent.skill || agent.title || agent.role || 'Agent',
    isLeader: agent.id === leader?.id,
  }));
  const leaderElectionResolution = {
    ...buildLeaderElectionResolution({
      leaderElection,
      selectedLeaderId: leader?.id,
      team,
      now,
      managerConfirmed: true,
    }),
    ...(savedLeaderElectionResolution || {}),
    selectedLeaderId: leader?.id || savedLeaderElectionResolution?.selectedLeaderId || null,
    selectedLeaderName: leader?.name || savedLeaderElectionResolution?.selectedLeaderName || null,
    managerConfirmed: true,
    status: 'manager-confirmed',
    confirmedAt: savedLeaderElectionResolution?.confirmedAt || now,
    leaderMarkerPersisted: confirmedTeam.some((agent) => agent.id === leader?.id && agent.isLeader),
  };
  const openTasks = tasks.length ? tasks : [
    {
      id: `${projectId}_task_1`,
      text: `Convert kickoff agreement for ${name} into the first execution artifact`,
      assignee: confirmedTeam.find((agent) => !agent.isLeader)?.name || leader?.name || 'Agent',
      status: 'pending',
    },
    {
      id: `${projectId}_task_2`,
      text: `Prepare timeline evidence and manager-review packet for ${name}`,
      assignee: reviewer?.name || leader?.name || 'Agent',
      status: 'pending',
    },
  ];
  const nextActionResolution = {
    ...buildNextActionResolution({
      tasks: openTasks,
      team: confirmedTeam,
      selectedLeaderId: leader?.id,
      now,
      managerConfirmed: true,
    }),
    ...(savedNextActionResolution || {}),
    tasks: (savedNextActionResolution?.tasks?.length ? savedNextActionResolution.tasks : openTasks),
    taskCount: (savedNextActionResolution?.tasks?.length ? savedNextActionResolution.tasks : openTasks).length,
    actionIds: (savedNextActionResolution?.tasks?.length ? savedNextActionResolution.tasks : openTasks).map((task) => task.id).filter(Boolean),
    managerConfirmed: true,
    status: 'manager-confirmed',
    confirmedAt: savedNextActionResolution?.confirmedAt || now,
  };
  const directorBriefMessageId = `director_brief_${projectId}`;
  const baseProject = {
    id: projectId,
    name,
    objective: projectBrief,
    currentObjective: brief || name,
    status: 'executing',
    progress: 8,
    autonomy,
    lastAutonomousRunAt: null,
    nextAutonomousRunAt: null,
    team: confirmedTeam,
    tasks: openTasks,
    logs: [
      {
        id: `log_${projectId}_approved`,
        time: now,
        agent: 'Director',
        log: `${name} approved from kickoff meeting after role negotiation and Leader election.`,
        eventType: 'project-approved',
      },
      {
        id: `log_${projectId}_leader`,
        time: now,
        agent: leader?.name || 'Leader',
        log: `${leader?.name || 'Leader'} was confirmed by the Director and received the Leader marker.`,
        eventType: 'leader-confirmed',
      },
    ],
    initiation: {
      source,
      meetingId,
      kickoffMeetingId: meetingId,
      leaderId: leader?.id || null,
      firstLead: leader?.name || null,
      reporter: reviewer?.name || null,
      directorBriefId: directorBriefMessageId,
      roleNegotiation,
      leaderElection,
      managerClarifications: meetingClarifications,
      roleQuestionResolutions,
      leaderElectionResolution,
      nextActionResolution,
      approvedAt: now,
      summary: brief,
      output: openTasks.map((task) => task.text).join('; '),
      reason: 'Created through backend kickoff project command.',
    },
  };
  const peerManagedBaseProject = applyPeerManagementMatrix({
    project: baseProject,
    leaderId: leader?.id,
    reviewerId: reviewer?.id,
    now,
  });
  const assignmentPackage = createLeaderAssignmentPackage({
    project: peerManagedBaseProject,
    leaderId: leader?.id,
    now,
  });
  const assignedProject = {
    ...peerManagedBaseProject,
    tasks: assignmentPackage.tasks,
    logs: [...assignmentPackage.acknowledgementLogs, ...assignmentPackage.assignmentLogs, ...peerManagedBaseProject.logs],
  };
  const directorBriefMessage = attachMessageReceipts({
    id: directorBriefMessageId,
    projectId,
    channelId: 'main',
    type: 'decision',
    author: 'Director',
    role: 'Project Owner',
    time: 'Kickoff',
    text: brief || name,
    targets: confirmedTeam.map((agent) => agent.name),
    heardBy: confirmedTeam.map((agent) => agent.id),
    weight: 'Project Brief',
    kickoffBrief: {
      projectId,
      teamIds: confirmedTeam.map((agent) => agent.id),
      source,
    },
  }, confirmedTeam, { seenAt: now });
  const kickoffCharter = createKickoffCharter({
    project: assignedProject,
    leaderId: leader?.id,
    reviewerId: reviewer?.id,
    roleNegotiation,
    leaderElection,
    assignmentPackage,
    now,
  });
  const kickoffCharterWithNextActionResolution = {
    ...kickoffCharter,
    meetingSessionId: meetingId,
    nextActionResolution,
    evidence: {
      ...(kickoffCharter.evidence || {}),
      kickoffMeetingId: meetingId,
      nextActionIds: nextActionResolution.actionIds,
    },
  };
  const kickoffProject = appendProjectEvents({
    ...assignedProject,
    kickoffCharter: kickoffCharterWithNextActionResolution,
  }, [
    createProjectLedgerEvent({
      id: `evt_${projectId}_peer_management_matrix`,
      type: 'peer-management-matrix',
      time: now,
      actor: 'Agent Runtime',
      summary: `${name} established ${peerManagedBaseProject.peerManagementMatrix?.length || 0} peer-management relationship rows for independent Agents.`,
      source: 'backend-kickoff-api',
      evidenceIds: (peerManagedBaseProject.peerManagementMatrix || []).map((row) => `peer_management_${projectId}_${row.agentId}`),
      entityIds: {
        leaderId: leader?.id || null,
        reviewerId: reviewer?.id || null,
      },
      payload: {
        matrix: peerManagedBaseProject.peerManagementMatrix || [],
      },
    }),
    ...meetingClarifications.map((item) => createProjectLedgerEvent({
      id: `evt_${item.id}`,
      type: 'kickoff-director-clarification',
      time: item.createdAt || now,
      actor: item.speaker || 'Director',
      summary: item.text || '',
      source: 'backend-kickoff-meeting-session',
      channelId: 'main',
      evidenceIds: [item.id].filter(Boolean),
      entityIds: {
        messageId: item.id,
        targetAgentId: item.targetSpeakerId || null,
      },
      payload: {
        repliesTo: item.repliesTo || null,
        hears: item.hears || [],
      },
    })),
    createProjectLedgerEvent({
      id: `evt_${projectId}_next_action_resolution`,
      type: 'kickoff-next-action-resolution',
      time: nextActionResolution.confirmedAt || now,
      actor: 'Director',
      summary: `${nextActionResolution.taskCount} first execution action${nextActionResolution.taskCount === 1 ? '' : 's'} confirmed for Leader assignment.`,
      source: nextActionResolution.source || 'kickoff-meeting-next-actions',
      channelId: 'decisions',
      evidenceIds: nextActionResolution.actionIds,
      entityIds: {
        leaderId: leader?.id || null,
      },
      payload: nextActionResolution,
    }),
    ...(kickoffCharterWithNextActionResolution.ledgerEvents || [kickoffCharterWithNextActionResolution.ledgerEvent]).filter(Boolean),
    ...(assignmentPackage.ledgerEvents || []),
  ]);
  const kickoffDecisionMessages = [
    {
      id: `decision_${projectId}_leader`,
      projectId,
      channelId: 'decisions',
      type: 'decision',
      author: 'Director',
      time: 'Kickoff',
      text: `${leader?.name || 'Leader'} is confirmed as Leader for ${name}.`,
      targets: ['all'],
      decisionId: `LEAD-${projectId}`,
    },
    {
      id: `decision_${projectId}_next_actions`,
      projectId,
      channelId: 'decisions',
      type: 'decision',
      author: 'Director',
      time: 'Kickoff',
      text: `${nextActionResolution.taskCount} first execution action${nextActionResolution.taskCount === 1 ? '' : 's'} confirmed for Leader assignment.`,
      targets: ['all'],
      decisionId: `NEXT-${projectId}`,
      weight: 'Next Action Resolution',
      nextActionIds: nextActionResolution.actionIds,
    },
  ].map((message) => attachMessageReceipts(message, assignedProject.team || [], { seenAt: now }));
  const kickoffDecisionProject = applyChatMessagesToAgentStates({
    project: kickoffProject,
    team: kickoffProject.team || [],
    messages: kickoffDecisionMessages,
    now,
    source: 'kickoff-decision-broadcast',
  });
  const kickoffChatProject = applyChatMessagesToAgentStates({
    project: kickoffDecisionProject,
    team: kickoffProject.team || [],
    messages: [
      ...assignmentPackage.assignmentMessages,
      ...assignmentPackage.acknowledgementMessages,
    ].map((message) => ({ ...message, projectId })),
    now,
    source: 'backend-kickoff-chat',
  });
  const firstPulse = runProjectAutonomousCycle({
    project: kickoffChatProject,
    cadence: autonomy?.cadence || 'hourly',
    messages: [],
    now,
    trigger: 'initiation-approval',
    schedulerReason: 'initiation-approved-first-work-pulse',
    dueAt: now,
    source: 'backend-kickoff-first-pulse-chat',
  });
  const kickoffMessages = [
    {
      id: `system_${projectId}_kickoff`,
      projectId,
      channelId: 'main',
      type: 'system',
      author: 'System',
      time: 'Kickoff',
      text: `${name} created from backend kickoff: role negotiation, Leader election, assignments, and first autonomous pulse are recorded.`,
    },
    directorBriefMessage,
    ...roleNegotiation.transcript.map((item) => ({
      id: item.id,
      projectId,
      channelId: 'main',
      type: item.type === 'role-question' ? 'question' : 'text',
      author: item.speaker,
      role: item.role,
      time: 'Kickoff',
      text: item.text,
      targets: item.hears || [],
    })),
    ...meetingClarifications.map((item) => ({
      id: item.id,
      projectId,
      channelId: 'main',
      type: 'decision',
      author: item.speaker || 'Director',
      role: item.role || 'Project Owner',
      time: 'Kickoff',
      text: item.text,
      targets: item.hears || [],
      repliesTo: item.repliesTo || null,
      weight: 'Director Clarification',
    })),
    ...leaderElection.transcript.map((item) => ({
      id: item.id,
      projectId,
      channelId: 'main',
      type: 'text',
      author: item.speaker,
      role: item.role,
      time: 'Election',
      text: item.text,
      targets: item.hearsOthers || [],
    })),
    ...kickoffDecisionMessages,
    ...assignmentPackage.assignmentMessages.map((message) => ({ ...message, projectId, time: 'Kickoff' })),
    ...assignmentPackage.acknowledgementMessages.map((message) => ({ ...message, projectId, time: 'Kickoff' })),
    ...firstPulse.messages.map((message) => ({
      ...message,
      projectId,
      time: message.time === 'Completed' ? 'Completed' : 'First Pulse',
    })),
  ];

  return {
    project: firstPulse.project,
    messages: kickoffMessages,
    route: 'kickoff-project-created',
    roleNegotiation,
    leaderElection,
    assignmentPackage,
    kickoffCharter: kickoffCharterWithNextActionResolution,
    firstPulse,
  };
}

function collectTaskEvidenceIds(project = {}, task = {}) {
  const messageIds = new Set();
  const logIds = new Set(task.timelineLogIds || []);
  const addMessageId = (id) => {
    if (id) messageIds.add(String(id));
  };
  const addMessageIds = (ids = []) => {
    ids.forEach(addMessageId);
  };

  addMessageId(task.assignmentMessageId);
  addMessageId(task.acknowledgementMessageId);
  addMessageId(task.requestMessageId);
  addMessageId(task.confirmationMessageId);
  addMessageId(task.syncMessageId);
  addMessageIds(task.discussionMessageIds || []);
  addMessageIds(task.evidenceMessageIds || []);
  addMessageIds(task.messageIds || []);

  (project.changeLedger || [])
    .filter((record) => String(record.taskId || '') === String(task.id || ''))
    .forEach((record) => {
      addMessageIds(record.discussionMessageIds || []);
      addMessageId(record.requestMessageId);
      addMessageId(record.confirmationMessageId);
      addMessageId(record.syncMessageId);
      (record.timelineLogIds || []).forEach((id) => logIds.add(String(id)));
    });

  (project.peerHandoffs || [])
    .filter((record) => String(record.taskId || '') === String(task.id || ''))
    .forEach((record) => {
      addMessageId(record.requestMessageId);
      addMessageId(record.acknowledgementMessageId);
      (record.timelineLogIds || []).forEach((id) => logIds.add(String(id)));
    });

  return {
    messageIds,
    logIds,
  };
}

function getTaskEvidenceFromProject({ project = {}, taskId, messages = [] } = {}) {
  const task = (project.tasks || []).find((item) => String(item.id) === String(taskId));
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const { messageIds, logIds } = collectTaskEvidenceIds(project, task);
  const logs = (project.logs || []).filter((log) => {
    const logId = String(log.id || '');
    const linkedMessageId = logId.startsWith('log_') ? logId.slice(4) : '';
    return logIds.has(logId)
      || (linkedMessageId && messageIds.has(linkedMessageId))
      || String(log.taskId || '') === String(task.id);
  });
  logs.forEach((log) => logIds.add(String(log.id || '')));

  const events = (project.eventLedger || []).filter((event) => {
    const eventEvidenceIds = new Set([
      ...(event.evidenceIds || []),
      event.entityIds?.messageId,
      event.entityIds?.logId,
    ].filter(Boolean).map(String));
    const taskMatch = String(event.entityIds?.taskId || '') === String(task.id);
    const messageMatch = [...messageIds].some((id) => eventEvidenceIds.has(id));
    const logMatch = [...logIds].some((id) => eventEvidenceIds.has(id));
    return taskMatch || messageMatch || logMatch;
  });

  return {
    task,
    evidenceMessageIds: [...messageIds],
    evidenceLogIds: [...logIds],
    messages: messages.filter((message) => messageIds.has(String(message.id || ''))),
    logs,
    events,
  };
}

function chatTypeForTranscriptProof(type = '', eventType = '') {
  if (type === 'role-question') return 'question';
  if (eventType === 'change-confirmed' || eventType === 'leader-confirmed') return 'decision';
  if (eventType === 'assignment-acknowledged' || eventType === 'peer-handoff-ack' || eventType === 'work-pulse' || eventType === 'daily-report' || eventType === 'agent-work-pulse') return 'progress';
  if (eventType === 'leader-assignment' || eventType === 'peer-handoff' || eventType === 'change-sync' || eventType === 'change-discussion' || eventType === 'management-check-in' || eventType === 'peer-management-check-in') return 'mention';
  return 'text';
}

function transcriptRecoveredMessages(project = {}) {
  const recovered = [];
  [
    ...(project.initiation?.roleNegotiation?.transcript || []),
    ...(project.initiation?.leaderElection?.transcript || []),
    ...(project.initiation?.managerClarifications || []),
  ].forEach((item) => {
    if (!item?.id) return;
    recovered.push({
      id: item.id,
      projectId: project.id || null,
      channelId: 'main',
      type: item.type === 'director-clarification' ? 'decision' : chatTypeForTranscriptProof(item.type),
      author: item.speaker || item.author || 'Agent',
      role: item.role || '',
      time: item.type === 'leader-campaign' ? 'Leader Election' : 'Kickoff',
      text: item.text || '',
      targets: item.hears || item.hearsOthers || [],
      weight: item.type === 'director-clarification' ? 'Director Clarification' : item.weight,
      recoveredProof: true,
      source: 'kickoff-transcript',
    });
  });

  (project.logs || []).forEach((log) => {
    const messageId = String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : log.messageId;
    if (!messageId) return;
    recovered.push({
      id: messageId,
      projectId: project.id || null,
      channelId: log.sourceChannelId || 'main',
      type: chatTypeForTranscriptProof('', log.eventType),
      author: log.agent || 'Agent',
      role: log.eventType || '',
      time: log.time || 'Recovered Proof',
      text: log.log || '',
      directTargetIds: log.directTargetIds || [],
      receiptCount: log.receiptCount || 0,
      recoveredProof: true,
      source: 'timeline-log',
      logId: log.id || null,
    });
  });

  const byId = new Map();
  recovered.forEach((message) => {
    if (!byId.has(message.id)) byId.set(message.id, message);
  });
  return [...byId.values()];
}

function buildTranscriptIndex({ project = {}, messages = [] } = {}) {
  const currentMessages = messages.filter((message) => !project.id || message.projectId === project.id);
  const recoveredMessages = transcriptRecoveredMessages(project);
  const currentIds = new Set(currentMessages.map((message) => String(message.id || '')));
  const archivedMessages = recoveredMessages.filter((message) => !currentIds.has(String(message.id || '')));
  const channelIds = Array.from(new Set([
    'main',
    'google_chat',
    'decisions',
    ...currentMessages.map((message) => message.channelId || 'main'),
    ...recoveredMessages.map((message) => message.channelId || 'main'),
  ]));

  const channels = channelIds.map((channelId) => {
    const channelMessages = currentMessages.filter((message) => (message.channelId || 'main') === channelId);
    const channelArchived = archivedMessages.filter((message) => (message.channelId || 'main') === channelId);
    const allProofMessages = [...channelMessages, ...channelArchived];
    const latestMessage = channelMessages[channelMessages.length - 1] || channelArchived[channelArchived.length - 1] || null;
    const directTargetIds = Array.from(new Set(allProofMessages.flatMap((message) => message.directTargetIds || [])));
    const receiptCoverage = allProofMessages.reduce((sum, message) => (
      sum + (message.visibility?.receiptCount || message.receiptCount || message.heardBy?.length || 0)
    ), 0);
    return {
      channelId,
      messageCount: channelMessages.length,
      archivedProofCount: channelArchived.length,
      totalProofCount: allProofMessages.length,
      latestMessage,
      directTargetIds,
      receiptCoverage,
      proofIds: allProofMessages.map((message) => message.id).filter(Boolean),
    };
  });

  return {
    projectId: project.id || null,
    channels,
    messageCount: currentMessages.length,
    archivedProofCount: archivedMessages.length,
    recoverableProofCount: recoveredMessages.length,
  };
}

function buildChannelTranscript({ project = {}, messages = [], channelId = 'main' } = {}) {
  const index = buildTranscriptIndex({ project, messages });
  const currentMessages = messages.filter((message) => (
    (!project.id || message.projectId === project.id)
    && (message.channelId || 'main') === channelId
  ));
  const currentIds = new Set(currentMessages.map((message) => String(message.id || '')));
  const archivedProofMessages = transcriptRecoveredMessages(project)
    .filter((message) => (message.channelId || 'main') === channelId && !currentIds.has(String(message.id || '')));
  return {
    projectId: project.id || null,
    channelId,
    messages: currentMessages,
    archivedProofMessages,
    proofIds: [...currentMessages, ...archivedProofMessages].map((message) => message.id).filter(Boolean),
    summary: index.channels.find((channel) => channel.channelId === channelId) || {
      channelId,
      messageCount: 0,
      archivedProofCount: 0,
      totalProofCount: 0,
      directTargetIds: [],
      receiptCoverage: 0,
      proofIds: [],
    },
  };
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function logIdsForEventTypes(project = {}, eventTypes = []) {
  const types = new Set(eventTypes);
  return (project.logs || [])
    .filter((log) => types.has(log.eventType))
    .map((log) => log.id)
    .filter(Boolean);
}

function ledgerEventIdsForTypes(project = {}, eventTypes = []) {
  const types = new Set(eventTypes);
  return (project.eventLedger || [])
    .filter((event) => types.has(event.type) || types.has(event.source))
    .map((event) => event.id)
    .filter(Boolean);
}

function idsFromTasks(tasks = [], fields = []) {
  return tasks.flatMap((task) => fields.flatMap((field) => task[field] || []));
}

function buildReadinessProofMap({ project = {}, messages = [] } = {}) {
  const projectId = project.id || null;
  const readiness = evaluateManagerScenarioReadiness({
    project,
    team: project.team || [],
    messages,
  });
  const tasks = project.tasks || [];
  const changes = project.changeLedger || [];
  const peerHandoffs = project.peerHandoffs || [];
  const agentStates = project.agentStates || {};
  const charterEvidence = project.kickoffCharter?.evidence || {};
  const transcriptIndex = buildTranscriptIndex({ project, messages });

  const kickoffProofIds = uniqueStrings([
    project.initiation?.directorBriefId,
    ...(charterEvidence.directorBriefIds || []),
    ...(project.initiation?.roleNegotiation?.transcript || []).map((item) => item.id),
    ...(project.initiation?.leaderElection?.transcript || []).map((item) => item.id),
    ...(project.initiation?.managerClarifications || []).map((item) => item.id),
    ...(charterEvidence.roleQuestionIds || []),
    ...(charterEvidence.selfNominationIds || []),
    ...(charterEvidence.leaderCampaignIds || []),
  ]);
  const assignmentTaskIds = uniqueStrings(tasks
    .filter((task) => task.assignmentMessageId || task.source === 'leader-chat-assignment' || task.source === 'kickoff-leader-assignment')
    .map((task) => task.id));
  const assignmentProofIds = uniqueStrings([
    ...(charterEvidence.assignmentMessageIds || []),
    ...(charterEvidence.acknowledgementMessageIds || []),
    ...idsFromTasks(tasks, ['assignmentMessageId', 'acknowledgementMessageId']),
  ]);
  const assignmentLogIds = uniqueStrings([
    ...idsFromTasks(tasks, ['timelineLogIds']),
    ...logIdsForEventTypes(project, ['leader-assignment', 'assignment-acknowledged']),
  ]);
  const changeProofIds = uniqueStrings(changes.flatMap((change) => [
    change.requestMessageId,
    ...(change.sourceMessageIds || []),
    change.confirmationMessageId,
    change.syncMessageId,
    ...(change.discussionMessageIds || []),
  ]));
  const changeLogIds = uniqueStrings([
    ...changes.flatMap((change) => change.timelineLogIds || []),
    ...logIdsForEventTypes(project, ['change-requested', 'change-discussion', 'change-confirmed', 'change-sync']),
  ]);
  const peerProofIds = uniqueStrings(peerHandoffs.flatMap((handoff) => [
    handoff.requestMessageId,
    handoff.acknowledgementMessageId,
  ]));
  const peerLogIds = uniqueStrings([
    ...peerHandoffs.flatMap((handoff) => handoff.timelineLogIds || []),
    ...logIdsForEventTypes(project, ['peer-handoff', 'peer-handoff-ack']),
  ]);
  const managementLogIds = uniqueStrings(logIdsForEventTypes(project, [
    'management-check-in',
    'peer-management-check-in',
    'review-sweep',
  ]));
  const workLogIds = uniqueStrings(logIdsForEventTypes(project, [
    'work-pulse',
    'daily-report',
    'task-completed',
    'agent-work-pulse',
    'agent-task-completed',
  ]));
  const receiptProofIds = uniqueStrings([
    ...messages
      .filter((message) => message.visibility?.receiptCount > 0 || (message.heardBy || []).length > 0)
      .map((message) => message.id),
    ...logIdsForEventTypes(project, ['leader-assignment', 'assignment-acknowledged', 'change-discussion', 'change-sync']),
  ]);
  const agentIds = uniqueStrings(Object.keys(agentStates));
  const allTaskEvidenceIds = uniqueStrings(tasks.map((task) => task.id));

  const route = (kind, label, path, extra = {}) => ({
    proofKind: kind,
    proofLabel: label,
    apiPath: projectId ? path : null,
    channelId: null,
    proofIds: [],
    timelineLogIds: [],
    taskIds: [],
    eventIds: [],
    agentIds: [],
    ...extra,
  });

  const routeForCheck = (check = {}) => {
    if (['kickoff-approved', 'role-clarification', 'agents-hear-each-other', 'leader-election-confirmed'].includes(check.id)) {
      return route('transcript', 'Kickoff chat proof', `/projects/${projectId}/transcripts/main`, {
        channelId: 'main',
        proofIds: kickoffProofIds,
        eventIds: ledgerEventIdsForTypes(project, [
          'kickoff-role-question',
          'kickoff-role-volunteer',
          'kickoff-leader-campaign',
          'kickoff-charter',
        ]),
      });
    }
    if (['leader-assignments-acknowledged', 'task-evidence-linked'].includes(check.id)) {
      return route('task-evidence', 'Assignment task proof', `/projects/${projectId}/tasks`, {
        channelId: 'main',
        proofIds: assignmentProofIds,
        timelineLogIds: assignmentLogIds,
        taskIds: assignmentTaskIds,
        eventIds: ledgerEventIdsForTypes(project, ['leader-assignment', 'assignment-acknowledged']),
      });
    }
    if (['agent-states-independent'].includes(check.id)) {
      return route('agent-state', 'Agent state proof', `/projects/${projectId}/agents`, {
        agentIds,
      });
    }
    if (['autonomous-work-running', 'autonomous-scheduler-evidence'].includes(check.id)) {
      return route('timeline', 'Autonomous worker proof', `/projects/${projectId}/timeline`, {
        timelineLogIds: workLogIds,
        eventIds: ledgerEventIdsForTypes(project, ['autonomous-cycle', 'autonomous-work', 'agent-work-cycle']),
      });
    }
    if (['management-loop-running'].includes(check.id)) {
      return route('timeline', 'Management proof', `/projects/${projectId}/timeline`, {
        timelineLogIds: managementLogIds,
        eventIds: ledgerEventIdsForTypes(project, ['management-check-in', 'management-response', 'agent-work-cycle-management', 'agent-work-cycle-management-response']),
        agentIds,
      });
    }
    if (['timeline-progress'].includes(check.id)) {
      return route('timeline', 'Timeline proof', `/projects/${projectId}/timeline`, {
        timelineLogIds: workLogIds,
        eventIds: ledgerEventIdsForTypes(project, ['work-pulse', 'daily-report', 'task-completed', 'agent-work-pulse', 'agent-task-completed']),
      });
    }
    if (['group-chat-visible', 'message-receipts-recorded'].includes(check.id)) {
      return route('transcript', 'Group chat proof', `/projects/${projectId}/transcripts/main`, {
        channelId: 'main',
        proofIds: check.id === 'message-receipts-recorded'
          ? receiptProofIds
          : transcriptIndex.channels.find((channel) => channel.channelId === 'main')?.proofIds || [],
      });
    }
    if (['event-ledger-continuity', 'event-ledger-replay-ready'].includes(check.id)) {
      return route('event-ledger', 'Event ledger proof', `/projects/${projectId}/events`, {
        eventIds: uniqueStrings((project.eventLedger || []).map((event) => event.id)),
      });
    }
    if (['peer-handoff-accepted'].includes(check.id)) {
      return route('timeline', 'Peer handoff proof', `/projects/${projectId}/timeline`, {
        channelId: 'main',
        proofIds: peerProofIds,
        timelineLogIds: peerLogIds,
        taskIds: uniqueStrings(peerHandoffs.map((handoff) => handoff.taskId)),
        eventIds: ledgerEventIdsForTypes(project, ['peer-handoff', 'peer-handoff-ack']),
      });
    }
    if (['midproject-change-synced', 'team-received-change-sync', 'google-chat-change-source', 'meeting-change-source', 'dual-channel-change-source'].includes(check.id)) {
      const channelId = check.id === 'google-chat-change-source' ? 'google_chat' : 'main';
      return route('change-ledger', 'Change proof', `/projects/${projectId}/transcripts/${channelId}`, {
        channelId,
        proofIds: changeProofIds,
        timelineLogIds: changeLogIds,
        taskIds: uniqueStrings(changes.map((change) => change.taskId)),
        eventIds: ledgerEventIdsForTypes(project, ['change-requested', 'change-confirmed', 'change-sync', 'feature-change']),
      });
    }
    return route('project', 'Project proof', `/projects/${projectId}`, {
      taskIds: allTaskEvidenceIds,
      agentIds,
    });
  };

  return {
    projectId,
    status: readiness.status,
    score: readiness.score,
    passedCount: readiness.passedCount,
    totalCount: readiness.totalCount,
    readiness,
    routes: readiness.checks.map((check) => ({
      checkId: check.id,
      label: check.label,
      detail: check.detail,
      passed: check.passed,
      ...routeForCheck(check),
    })),
  };
}

function buildAgentDashboardSnapshot({ project = {}, messages = [], agentId } = {}) {
  const projectId = project.id || null;
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const agentStates = project.agentStates || {};
  const state = agentStates[agent.id]
    || Object.values(agentStates).find((item) => item.agentId === agent.id || item.name === agent.name)
    || {};
  const normalizedState = {
    agentId: agent.id,
    name: state.name || agent.name,
    role: state.role || agent.role || agent.title || '',
    inbox: state.inbox || [],
    obligations: state.obligations || [],
    worklog: state.worklog || [],
    currentPlan: state.currentPlan || null,
    taskIds: state.taskIds || [],
    ...state,
  };
  const agentNameById = Object.fromEntries(team.map((member) => [member.id, member.name]));
  const latestWorker = (project.agentWorkerLedger || []).find((record) => record.agentId === agent.id) || null;
  const management = agentManagementPriority({ project, agent, state: normalizedState });
  const managerIds = uniqueStrings([normalizedState.managerId, ...(normalizedState.peerManagerIds || [])]);
  const managedIds = uniqueStrings([...(normalizedState.managedIds || agent.managedIds || [])]);
  const peerManagedIds = uniqueStrings(normalizedState.peerManagedIds || []);
  const ownedTasks = (project.tasks || [])
    .filter((task) => taskBelongsToAgent(task, agent))
    .map((task) => {
      const { messageIds, logIds } = collectTaskEvidenceIds(project, task);
      const taskLogs = (project.logs || []).filter((log) => (
        logIds.has(String(log.id || ''))
        || String(log.taskId || '') === String(task.id || '')
      ));
      taskLogs.forEach((log) => logIds.add(String(log.id || '')));
      const taskEvents = (project.eventLedger || []).filter((event) => {
        const evidenceIds = new Set([
          ...(event.evidenceIds || []),
          event.entityIds?.messageId,
          event.entityIds?.logId,
        ].filter(Boolean).map(String));
        return String(event.entityIds?.taskId || '') === String(task.id || '')
          || [...messageIds].some((id) => evidenceIds.has(id))
          || [...logIds].some((id) => evidenceIds.has(id));
      });
      return {
        ...task,
        evidence: {
          chatIds: [...messageIds],
          timelineLogIds: [...logIds],
          eventIds: uniqueStrings(taskEvents.map((event) => event.id)),
          taskEvidencePath: projectId ? `/projects/${projectId}/tasks/${task.id}/evidence` : null,
        },
      };
    });

  const ownedTaskIds = new Set(ownedTasks.map((task) => String(task.id || '')));
  const agentTokens = new Set([agent.id, agent.name].filter(Boolean).map(String));
  const inboxMessageIds = uniqueStrings((normalizedState.inbox || []).flatMap((item) => [
    item.sourceMessageId,
    item.messageId,
  ]));
  const obligationMessageIds = uniqueStrings((normalizedState.obligations || []).flatMap((item) => [
    item.sourceMessageId,
    item.messageId,
  ]));
  const worklogMessageIds = uniqueStrings((normalizedState.worklog || []).flatMap((item) => [
    item.sourceMessageId,
    item.messageId,
    item.evidenceMessageId,
  ]));
  const taskChatProofIds = uniqueStrings(ownedTasks.flatMap((task) => task.evidence.chatIds));
  const taskTimelineLogIds = uniqueStrings(ownedTasks.flatMap((task) => task.evidence.timelineLogIds));
  const allAgentProofMessageIds = new Set([
    ...inboxMessageIds,
    ...obligationMessageIds,
    ...worklogMessageIds,
    ...taskChatProofIds,
  ]);
  const allMessages = [...messages, ...transcriptRecoveredMessages(project)];
  const messagesById = new Map();
  allMessages
    .filter((message) => !projectId || !message.projectId || message.projectId === projectId)
    .forEach((message) => {
      const id = String(message.id || '');
      if (id && !messagesById.has(id)) messagesById.set(id, message);
    });
  const relevantMessages = [...messagesById.values()].filter((message) => {
    const directTargetIds = (message.directTargetIds || []).map(String);
    const heardBy = (message.heardBy || []).map(String);
    const targets = (message.targets || []).map(String);
    return allAgentProofMessageIds.has(String(message.id || ''))
      || String(message.author || '') === agent.name
      || directTargetIds.some((id) => agentTokens.has(id))
      || heardBy.some((id) => agentTokens.has(id))
      || targets.some((target) => agentTokens.has(target))
      || message.agentWorker?.agentId === agent.id
      || message.agentWorker?.targetAgentId === agent.id;
  }).slice(-40);

  const agentLogs = (project.logs || []).filter((log) => (
    log.agentId === agent.id
    || log.targetAgentId === agent.id
    || log.ownerId === agent.id
    || log.agent === agent.name
    || ownedTaskIds.has(String(log.taskId || ''))
    || (log.directTargetIds || []).map(String).includes(String(agent.id))
  ));
  const managementLogTypes = ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'];
  const managementProofLogs = agentLogs.filter((log) => managementLogTypes.includes(log.eventType));
  const proofTimelineLogIds = uniqueStrings([
    ...taskTimelineLogIds,
    ...agentLogs.map((log) => log.id),
  ]);
  const proofChatIds = uniqueStrings([
    ...taskChatProofIds,
    ...inboxMessageIds,
    ...obligationMessageIds,
    ...worklogMessageIds,
    ...relevantMessages.map((message) => message.id),
  ]);
  const relevantEvents = (project.eventLedger || []).filter((event) => {
    const entityIds = event.entityIds || {};
    const evidenceIds = new Set([
      ...(event.evidenceIds || []),
      entityIds.messageId,
      entityIds.logId,
    ].filter(Boolean).map(String));
    return entityIds.agentId === agent.id
      || entityIds.targetAgentId === agent.id
      || entityIds.ownerId === agent.id
      || ownedTaskIds.has(String(entityIds.taskId || ''))
      || proofChatIds.some((id) => evidenceIds.has(id))
      || proofTimelineLogIds.some((id) => evidenceIds.has(id));
  });

  return {
    projectId,
    agentId: agent.id,
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role || agent.title || '',
      isLeader: Boolean(agent.isLeader),
    },
    state: normalizedState,
    status: normalizedState.status || agent.status || 'waiting',
    currentPlan: normalizedState.currentPlan || null,
    routine: normalizedState.currentPlan?.routine || null,
    schedule: {
      nextAgentRunAt: normalizedState.nextAgentRunAt || latestWorker?.nextRunAt || null,
      lastAgentRunAt: normalizedState.lastAgentRunAt || latestWorker?.ranAt || latestWorker?.completedAt || null,
      lastActiveAt: normalizedState.lastActiveAt || normalizedState.worklog?.[0]?.at || null,
    },
    management: {
      ...management,
      managerIds,
      managerNames: managerIds.map((id) => agentNameById[id] || id).filter(Boolean),
      managedIds,
      managedNames: managedIds.map((id) => agentNameById[id] || id).filter(Boolean),
      peerManagedIds,
      peerManagedNames: peerManagedIds.map((id) => agentNameById[id] || id).filter(Boolean),
    },
    latestWorker,
    workerLedger: (project.agentWorkerLedger || [])
      .filter((record) => (
        record.agentId === agent.id
        || (record.managementTargetIds || []).includes(agent.id)
        || (record.managementResponseTargetIds || []).includes(agent.id)
        || record.targetAgentId === agent.id
      ))
      .slice(0, 10),
    inbox: normalizedState.inbox.slice(0, 40),
    obligations: normalizedState.obligations.slice(0, 40),
    worklog: normalizedState.worklog.slice(0, 40),
    latestInbox: normalizedState.inbox[0] || null,
    latestObligation: normalizedState.obligations[0] || null,
    latestWorklog: normalizedState.worklog[0] || null,
    ownedTasks,
    openTaskCount: ownedTasks.filter((task) => task.status !== 'done').length,
    messages: relevantMessages,
    timeline: {
      logs: agentLogs.slice(0, 40),
      managementProofLogs: managementProofLogs.slice(0, 20),
      managementProofLogIds: uniqueStrings(managementProofLogs.map((log) => log.id)),
    },
    events: relevantEvents.slice(0, 40),
    proof: {
      chatProofIds: proofChatIds,
      timelineLogIds: proofTimelineLogIds,
      managementProofLogIds: uniqueStrings(managementProofLogs.map((log) => log.id)),
      eventIds: uniqueStrings(relevantEvents.map((event) => event.id)),
      taskIds: uniqueStrings(ownedTasks.map((task) => task.id)),
    },
    backendRoutes: {
      agent: projectId ? `/projects/${projectId}/agents/${agent.id}` : null,
      dashboard: projectId ? `/projects/${projectId}/agents/${agent.id}/dashboard` : null,
      inbox: projectId ? `/projects/${projectId}/agents/${agent.id}/inbox` : null,
      worklog: projectId ? `/projects/${projectId}/agents/${agent.id}/worklog` : null,
      obligations: projectId ? `/projects/${projectId}/agents/${agent.id}/obligations` : null,
      plan: projectId ? `/projects/${projectId}/agents/${agent.id}/plan` : null,
      tasks: projectId ? `/projects/${projectId}/tasks` : null,
      timeline: projectId ? `/projects/${projectId}/timeline` : null,
      transcripts: projectId ? `/projects/${projectId}/transcripts/main` : null,
    },
  };
}

function buildManagerDashboardSnapshot({ project = {}, messages = [] } = {}) {
  const projectId = project.id || null;
  const team = project.team || [];
  const agentStates = project.agentStates || {};
  const agentNameById = Object.fromEntries(team.map((agent) => [agent.id, agent.name]));
  const latestAgentWorkerById = {};
  (project.agentWorkerLedger || []).forEach((record) => {
    if (record.agentId && !latestAgentWorkerById[record.agentId]) {
      latestAgentWorkerById[record.agentId] = record;
    }
  });

  const transcriptIndex = buildTranscriptIndex({ project, messages });
  const readinessProofMap = buildReadinessProofMap({ project, messages });
  const eventLedgerSummary = summarizeProjectEventLedger(project);
  const projectMessages = messages.filter((message) => !projectId || message.projectId === projectId);
  const latestProjectCycle = project.autonomousLedger?.[0] || null;
  const latestSchedulerRecord = project.autonomousSchedulerLedger?.[0] || null;
  const kickoffMeetingId = project.initiation?.meetingId
    || project.initiation?.kickoffMeetingId
    || project.kickoffCharter?.meetingSessionId
    || project.kickoffCharter?.evidence?.kickoffMeetingId
    || null;
  const kickoffMeetingRoute = (action = '') => {
    const base = kickoffMeetingId
      ? `/kickoff-meetings/${encodeURIComponent(kickoffMeetingId)}`
      : '/kickoff-meetings/:meetingId';
    return action ? `${base}/${action}` : base;
  };
  const managementLogTypes = ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'];

  const operationsAgents = team.map((agent) => {
    const state = agentStates[agent.id] || {};
    const latestWorker = latestAgentWorkerById[agent.id] || {};
    const latestWorklog = state.worklog?.[0] || null;
    const management = agentManagementPriority({ project, agent, state });
    const openObligations = (state.obligations || [])
      .filter((item) => item.status !== 'done' && item.status !== 'resolved');
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role || agent.title || '',
      status: state.status || agent.status || 'waiting',
      nextRunAt: state.nextAgentRunAt || latestWorker.nextRunAt || null,
      lastRunAt: latestWorker.ranAt || latestWorker.completedAt || state.lastActiveAt || latestWorklog?.at || null,
      trigger: latestWorker.trigger || latestWorklog?.source || state.status || 'waiting',
      latestInbox: state.inbox?.[0] || null,
      latestWorklog,
      openObligationCount: openObligations.length,
      managementPriority: latestWorker.managementPriority ?? management.score,
      managementReasons: latestWorker.managementReasons || management.reasons,
      managementResponseCount: latestWorker.managementResponseCount || 0,
      managementResponseTargetIds: latestWorker.managementResponseTargetIds || [],
      managementResponseTargets: (latestWorker.managementResponseTargetIds || []).map((id) => agentNameById[id] || id).filter(Boolean),
      managedBy: management.managedBy,
      routine: state.currentPlan?.routine || null,
      currentPlan: state.currentPlan || null,
      dashboardPath: projectId ? `/projects/${projectId}/agents/${agent.id}/dashboard` : null,
    };
  });
  const continuousWorkLoopRows = operationsAgents.map((row) => {
    const state = agentStates[row.agentId] || {};
    const latestWorker = latestAgentWorkerById[row.agentId] || {};
    const latestWorklog = state.worklog?.[0] || {};
    const timelineLogIds = uniqueStrings([
      latestWorker.logId,
      ...(latestWorker.timelineLogIds || []),
      ...(latestWorklog.timelineLogIds || []),
    ]);
    const chatProofIds = uniqueStrings([
      latestWorker.messageId,
      latestWorklog.sourceMessageId,
      ...(latestWorklog.sourceMessageIds || []),
      ...(latestWorklog.responseMessageIds || []),
    ]);
    return {
      agentId: row.agentId,
      name: row.name,
      role: row.role,
      loopState: row.nextRunAt
        ? row.lastRunAt ? 'loop-scheduled' : 'queued-first-run'
        : row.lastRunAt ? 'needs-next-schedule' : 'waiting',
      nextRunAt: row.nextRunAt,
      lastRunAt: row.lastRunAt,
      trigger: row.trigger,
      routineLabel: row.currentPlan?.routine?.label || 'fixed routine',
      focus: row.currentPlan?.focus || latestWorklog.text || 'monitor project lane',
      nextStep: row.currentPlan?.next || 'publish the next proof marker',
      chatProofIds,
      timelineLogIds,
      proofReady: chatProofIds.length > 0 || timelineLogIds.length > 0,
    };
  });

  const managementMeshRows = team.map((agent) => {
    const state = agentStates[agent.id] || {};
    const managedIds = state.managedIds || agent.managedIds || [];
    const peerManagedIds = state.peerManagedIds || [];
    const managerIds = uniqueStrings([state.managerId, ...(state.peerManagerIds || [])]);
    const proofLogs = (project.logs || []).filter((log) => (
      managementLogTypes.includes(log.eventType)
      && (log.agentId === agent.id || log.targetAgentId === agent.id)
    ));
    const latestCycleEvents = (project.autonomousLedger || [])
      .flatMap((cycle) => cycle.managementEvents || [])
      .filter((event) => event.agentId === agent.id || event.targetAgentId === agent.id);
    const latestWorker = latestAgentWorkerById[agent.id] || {};
    return {
      agentId: agent.id,
      name: agent.name,
      managerIds,
      managerNames: managerIds.map((id) => agentNameById[id] || id),
      managedIds,
      managedNames: managedIds.map((id) => agentNameById[id] || id).filter(Boolean),
      peerManagedIds,
      peerManagedNames: peerManagedIds.map((id) => agentNameById[id] || id).filter(Boolean),
      latestEvent: latestCycleEvents[0] || null,
      workerTargetIds: latestWorker.managementTargetIds || [],
      workerTargets: (latestWorker.managementTargetIds || []).map((id) => agentNameById[id] || id).filter(Boolean),
      workerResponseTargetIds: latestWorker.managementResponseTargetIds || [],
      workerResponseTargets: (latestWorker.managementResponseTargetIds || []).map((id) => agentNameById[id] || id).filter(Boolean),
      proofLogIds: proofLogs.map((log) => log.id).filter(Boolean).slice(0, 8),
      responseCount: proofLogs.filter((log) => log.eventType === 'management-response').length,
      checkInCount: proofLogs.length,
    };
  });
  const peerManagementMatrixRows = (project.peerManagementMatrix?.length
    ? project.peerManagementMatrix
    : buildPeerManagementMatrix(team, {
      leaderId: team.find((agent) => agent.isLeader)?.id || project.kickoffCharter?.governance?.leaderId,
      reviewerId: project.kickoffCharter?.governance?.reviewerId,
    })
  ).map((row) => ({
    ...row,
    agentName: agentNameById[row.agentId] || row.agentId,
    peerManagedNames: (row.peerManagedIds || []).map((id) => agentNameById[id] || id).filter(Boolean),
    peerManagerNames: (row.peerManagerIds || []).map((id) => agentNameById[id] || id).filter(Boolean),
    proofLogIds: uniqueStrings((project.logs || [])
      .filter((log) => log.eventType === 'peer-management-check-in' && (
        log.agentId === row.agentId
        || log.targetAgentId === row.agentId
      ))
      .map((log) => log.id)),
  }));

  const charter = project.kickoffCharter || null;
  const roleTranscript = project.initiation?.roleNegotiation?.transcript || project.roleNegotiation?.transcript || [];
  const leaderTranscript = project.initiation?.leaderElection?.transcript || project.leaderElection?.transcript || [];
  const managerClarifications = project.initiation?.managerClarifications || [];
  let roleQuestionResolutionRows = project.initiation?.roleQuestionResolutions?.length
    ? project.initiation.roleQuestionResolutions
    : buildRoleQuestionResolutions({
      transcript: roleTranscript,
      clarifications: managerClarifications,
    });
  if (!roleQuestionResolutionRows.length && (charter?.meeting?.roleQuestionCount || 0) > 0 && charter?.status === 'approved') {
    const charterRoleQuestionIds = (charter?.evidence?.roleTranscriptIds || []).slice(0, charter.meeting.roleQuestionCount);
    roleQuestionResolutionRows = charterRoleQuestionIds.map((questionId, index) => ({
      questionId,
      speakerId: null,
      speakerName: 'Kickoff participant',
      questionText: 'Recovered role question from approved kickoff charter.',
      answered: true,
      answerIds: [charter.id].filter(Boolean),
      answerText: 'Director approved the kickoff charter after role clarification, team confirmation, and first execution planning.',
      answeredAt: charter.createdAt || project.updatedAt || project.createdAt || null,
      source: 'approved-kickoff-charter',
      ordinal: index + 1,
    }));
  }
  const leaderCandidates = project.initiation?.leaderElection?.candidates || project.leaderElection?.candidates || [];
  const recoveredLeaderCandidateIds = uniqueStrings([
    ...leaderTranscript.map((item) => item.speakerId || item.agentId).filter(Boolean),
    ...(charter?.evidence?.leaderHearingEdges || []).map((edge) => edge.speakerId).filter(Boolean),
    ...(charter?.evidence?.leaderCampaignIds || []).map((id) => String(id).replace(/^leader_bid_/, '')).filter(Boolean),
  ]);
  const leaderCandidateRows = leaderCandidates.length
    ? leaderCandidates
    : recoveredLeaderCandidateIds.map((agentId) => {
      const agent = team.find((row) => row.id === agentId) || {};
      return {
        agentId,
        name: agent.name || agentId,
        role: agent.role || agent.title || 'Leader candidate',
      };
    });
  const confirmedLeader = team.find((agent) => (
    agent.id === charter?.governance?.leaderId
    || agent.name === charter?.governance?.leaderName
    || agent.isLeader
  ));
  const confirmedTeamProofLogIds = uniqueStrings((project.logs || [])
    .filter((log) => ['project-approved', 'leader-confirmed'].includes(log.eventType))
    .map((log) => log.id));
  const confirmedTeamMatrixRows = (charter?.team?.length ? charter.team : team).map((member) => {
    const projectAgent = team.find((agent) => agent.id === member.id || agent.name === member.name);
    const isLeader = Boolean(projectAgent?.isLeader || member.isLeader || member.id === charter?.governance?.leaderId);
    const isReviewer = Boolean(member.id === charter?.governance?.reviewerId || projectAgent?.id === charter?.governance?.reviewerId);
    return {
      id: member.id || projectAgent?.id || member.name,
      name: member.name || projectAgent?.name || 'Agent',
      role: projectAgent?.role || member.role || member.title || 'Agent',
      inProjectState: Boolean(projectAgent),
      inKickoffCharter: Boolean(charter?.team?.some((agent) => agent.id === member.id || agent.name === member.name)),
      isLeader,
      isReviewer,
      governanceLabel: isLeader ? 'leader-marker' : isReviewer ? 'reviewer' : 'execution-agent',
      proofLogIds: confirmedTeamProofLogIds,
    };
  });
  const leaderElectionResolution = project.initiation?.leaderElectionResolution || {
    ...buildLeaderElectionResolution({
      leaderElection: project.initiation?.leaderElection || project.leaderElection || {},
      selectedLeaderId: confirmedLeader?.id || charter?.governance?.leaderId,
      team,
      now: project.initiation?.approvedAt || project.updatedAt || nowIso(),
      managerConfirmed: Boolean(confirmedLeader || charter?.governance?.leaderId),
    }),
    leaderMarkerPersisted: Boolean(confirmedLeader?.isLeader),
  };
  const charterNextActions = charter?.nextActions || [];
  const nextActionResolution = project.initiation?.nextActionResolution || charter?.nextActionResolution || (
    charter?.status === 'approved' && charterNextActions.length
      ? {
        ...buildNextActionResolution({
          tasks: charterNextActions,
          team,
          selectedLeaderId: confirmedLeader?.id || charter?.governance?.leaderId,
          now: charter.createdAt || project.updatedAt || project.createdAt || nowIso(),
          managerConfirmed: true,
        }),
        tasks: charterNextActions,
        taskCount: charterNextActions.length,
        actionIds: charterNextActions.map((action) => action.id).filter(Boolean),
        managerConfirmed: true,
        status: 'manager-confirmed',
        confirmedAt: charter.createdAt || project.updatedAt || project.createdAt || null,
        source: 'approved-kickoff-charter',
      }
      : null
  );
  const nextActionDecisionMessageId = projectId ? `decision_${projectId}_next_actions` : null;
  const nextActionResolutionDelivery = nextActionResolution ? {
    messageId: nextActionDecisionMessageId,
    deliveredAgentIds: team
      .filter((agent) => (agentStates[agent.id]?.inbox || []).some((item) => item.sourceMessageId === nextActionDecisionMessageId))
      .map((agent) => agent.id),
    obligationAgentIds: team
      .filter((agent) => (agentStates[agent.id]?.obligations || []).some((item) => item.sourceMessageId === nextActionDecisionMessageId))
      .map((agent) => agent.id),
    teamCount: team.length,
  } : null;
  if (nextActionResolutionDelivery) {
    nextActionResolutionDelivery.allAgentsReceived = nextActionResolutionDelivery.deliveredAgentIds.length === nextActionResolutionDelivery.teamCount;
    nextActionResolutionDelivery.allAgentsObligated = nextActionResolutionDelivery.obligationAgentIds.length === nextActionResolutionDelivery.teamCount;
  }
  const transcriptConversationRows = [
    ...roleTranscript.map((item) => ({
      id: item.id,
      stage: item.type === 'role-question' ? 'role-clarification' : 'self-nomination',
      speakerId: item.speakerId || null,
      speakerName: item.speaker || item.agentName || item.speakerId || 'Agent',
      role: item.role || '',
      text: item.text || '',
      heardBy: item.hears || item.hearsOthers || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
    })),
    ...leaderTranscript.map((item) => ({
      id: item.id,
      stage: 'leader-campaign',
      speakerId: item.speakerId || item.agentId || null,
      speakerName: item.speaker || item.agentName || item.name || item.speakerId || 'Agent',
      role: item.role || 'Leader candidate',
      text: item.text || '',
      heardBy: item.hearsOthers || item.hears || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
    })),
    ...managerClarifications.map((item) => ({
      id: item.id,
      stage: 'director-clarification',
      speakerId: item.speakerId || 'director',
      speakerName: item.speaker || 'Director',
      role: item.role || 'Project Owner',
      text: item.text || '',
      heardBy: item.hears || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
      repliesTo: item.repliesTo || null,
    })),
  ];
  const kickoffConversationRows = transcriptConversationRows.length ? transcriptConversationRows : [
    ...(charter?.evidence?.roleTranscriptIds || []).map((id, index) => ({
      id,
      stage: index === 0 ? 'role-clarification' : 'self-nomination',
      speakerId: null,
      speakerName: 'Kickoff participant',
      role: '',
      text: 'Recovered kickoff role-negotiation proof. Open the transcript proof for the original turn.',
      heardBy: [],
      proofIds: [id].filter(Boolean),
      channelId: 'main',
    })),
    ...(charter?.evidence?.leaderCampaignIds || []).map((id) => ({
      id,
      stage: 'leader-campaign',
      speakerId: null,
      speakerName: 'Leader candidate',
      role: 'Leader candidate',
      text: 'Recovered Leader campaign proof. Open the transcript proof for the original turn.',
      heardBy: [],
      proofIds: [id].filter(Boolean),
      channelId: 'main',
    })),
  ];
  const kickoffHearingMatrixRows = kickoffConversationRows.map((row) => {
    const heardBy = uniqueStrings(row.heardBy || []);
    const heardNames = heardBy
      .map((id) => agentNameById[id] || id)
      .filter(Boolean);
    const expectedPeerCount = row.speakerId && row.speakerId !== 'director'
      ? Math.max(0, team.length - 1)
      : team.length;
    return {
      ...row,
      heardBy,
      heardNames,
      heardLabel: heardNames.length ? heardNames.join(' / ') : 'No peer receipts',
      coverageComplete: expectedPeerCount > 0 && heardBy.length >= expectedPeerCount,
    };
  });
  const directorBriefIds = uniqueStrings([
    ...(charter?.evidence?.directorBriefIds || []),
    project.initiation?.directorBriefId,
  ]);
  const directorBriefText = project.initiation?.summary || project.currentObjective || project.objective || project.name || '';
  const kickoffBriefAlignment = charter ? {
    briefIds: directorBriefIds,
    text: directorBriefText,
    speakerName: 'Director',
    heardByAgentIds: team.map((agent) => agent.id),
    heardByAgentNames: team.map((agent) => agent.name).filter(Boolean),
    roleQuestionCount: roleTranscript.filter((item) => item.type === 'role-question').length,
    selfNominationCount: roleTranscript.filter((item) => item.type === 'role-volunteer').length,
    responseRows: roleTranscript.map((item) => ({
      id: item.id,
      speakerId: item.speakerId || null,
      speakerName: item.speaker || item.agentName || item.speakerId || 'Agent',
      responseType: item.type === 'role-question' ? 'role-question' : 'self-nomination',
      text: item.text || '',
      heardBy: item.hears || item.hearsOthers || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
    })),
    proofIds: directorBriefIds.length ? directorBriefIds : [],
    channelId: 'main',
  } : null;
  const kickoffMeetingFlow = charter ? {
    roleQuestionCount: charter.meeting?.roleQuestionCount || roleTranscript.filter((item) => item.type === 'role-question').length,
    roleQuestionAnsweredCount: roleQuestionResolutionRows.filter((row) => row.answered).length,
    roleQuestionUnansweredCount: roleQuestionResolutionRows.filter((row) => !row.answered).length,
    roleQuestionResolutions: roleQuestionResolutionRows,
    selfNominationCount: charter.meeting?.selfNominationCount || roleTranscript.filter((item) => item.type === 'role-volunteer').length,
    leaderCampaignCount: leaderTranscript.length || charter.meeting?.leaderCandidateCount || 0,
    leaderElectionResolution: {
      ...leaderElectionResolution,
      leaderMarkerPersisted: Boolean(confirmedLeader?.isLeader || leaderElectionResolution.leaderMarkerPersisted),
    },
    directorClarificationCount: managerClarifications.length,
    leaderCandidateNames: leaderCandidateRows.map((candidate) => (
      candidate.agentName
      || candidate.name
      || team.find((agent) => agent.id === candidate.agentId)?.name
      || candidate.agentId
    )).filter(Boolean),
    roleHearingCount: (charter.evidence?.roleHearingEdges || []).reduce((sum, edge) => sum + (edge.hears?.length || 0), 0),
    leaderHearingCount: (charter.evidence?.leaderHearingEdges || []).reduce((sum, edge) => sum + (edge.hears?.length || 0), 0),
    confirmedTeamCount: charter.team?.length || team.length,
    confirmedTeamMatrixRows,
    confirmedTeamProofLogIds,
    confirmedLeaderId: confirmedLeader?.id || charter.governance?.leaderId || null,
    confirmedLeaderName: charter.governance?.leaderName || confirmedLeader?.name || 'Unassigned',
    leaderMarkerPersisted: Boolean(confirmedLeader?.isLeader),
    briefAlignment: kickoffBriefAlignment,
    proofIds: uniqueStrings([
      ...(charter.evidence?.directorBriefIds || []),
      ...(charter.evidence?.roleTranscriptIds || []),
      ...(charter.evidence?.leaderCampaignIds || []),
      ...(charter.evidence?.assignmentMessageIds || []),
      ...(charter.evidence?.acknowledgementMessageIds || []),
    ]),
    conversationRows: kickoffConversationRows,
    hearingMatrixRows: kickoffHearingMatrixRows,
  } : null;

  const taskEvidence = (task = {}) => ({
    chatIds: uniqueStrings([
      task.assignmentMessageId,
      task.requestMessageId,
      task.acknowledgementMessageId,
      task.confirmationMessageId,
      task.syncMessageId,
    ]),
    timelineIds: uniqueStrings(task.timelineLogIds || []),
    hasAssignment: Boolean(task.assignmentMessageId || task.requestMessageId),
    hasAcknowledgement: Boolean(task.acknowledgementMessageId || task.confirmationMessageId),
    hasOwnerSync: Boolean(task.syncMessageId),
    timelineCount: task.timelineLogIds?.length || 0,
  });
  const ownerForTask = (task = {}) => team.find((agent) => (
    agent.id === task.ownerId
    || agent.id === task.assignee
    || agent.name === task.assignee
    || agent.name === task.ownerName
  ));
  const assignmentFlowRows = (project.tasks || [])
    .filter((task) => taskEvidence(task).hasAssignment || task.assignedBy || task.source === 'kickoff-leader-assignment')
    .slice(0, 8)
    .map((task) => {
      const owner = ownerForTask(task);
      const ownerState = owner ? agentStates[owner.id] || {} : {};
      const evidence = taskEvidence(task);
      const assignmentIds = uniqueStrings([task.assignmentMessageId, task.requestMessageId]);
      return {
        taskId: task.id,
        text: task.text,
        ownerId: owner?.id || task.ownerId || null,
        ownerName: owner?.name || task.ownerName || task.assignee || null,
        sourceChannelId: task.sourceChannelId || 'main',
        evidence,
        inboxSeen: Boolean(ownerState.inbox?.some((item) => (
          String(item.taskId || '') === String(task.id)
          || assignmentIds.includes(String(item.sourceMessageId || ''))
          || assignmentIds.includes(String(item.messageId || ''))
        ))),
        obligationSeen: Boolean(ownerState.obligations?.some((item) => String(item.taskId || '') === String(task.id))),
        workSeen: Boolean(task.workPulseCount > 0 || ownerState.worklog?.some((item) => String(item.taskId || '') === String(task.id))),
        timelineSeen: evidence.timelineCount > 0,
      };
    });
  const assignmentTimelineMatrixRows = assignmentFlowRows.map((row) => {
    const assignmentTimelineLogIds = (row.evidence.timelineIds || []).filter((id) => (
      [row.evidence.chatIds?.[0], row.evidence.chatIds?.[1]]
        .filter(Boolean)
        .some((messageId) => String(id).includes(String(messageId)))
    ));
    const workTimelineLogIds = (row.evidence.timelineIds || []).filter((id) => !assignmentTimelineLogIds.includes(id));
    return {
      ...row,
      assignmentPosted: row.evidence.hasAssignment,
      assigneeReceived: row.inboxSeen || row.obligationSeen,
      assigneeAccepted: row.evidence.hasAcknowledgement,
      timelineRecorded: row.timelineSeen,
      assignmentTimelineLogIds,
      workTimelineLogIds,
    };
  });
  const assignmentProgressEventTypes = new Set(['work-pulse', 'daily-report', 'task-completed', 'agent-work-pulse', 'agent-task-completed']);
  const assignmentCompletionEventTypes = new Set(['task-completed', 'agent-task-completed']);
  const taskByAssignmentId = Object.fromEntries((project.tasks || []).map((task) => [String(task.id), task]));
  const assignmentWorkProgressRows = assignmentTimelineMatrixRows.map((row) => {
    const task = taskByAssignmentId[String(row.taskId || '')] || {};
    const ownerState = row.ownerId ? agentStates[row.ownerId] || {} : {};
    const taskLogs = (project.logs || []).filter((log) => (
      String(log.taskId || '') === String(row.taskId || '')
      || (log.taskIds || []).map((id) => String(id)).includes(String(row.taskId || ''))
      || (row.evidence.timelineIds || []).includes(log.id)
    ));
    const progressLogs = taskLogs.filter((log) => assignmentProgressEventTypes.has(log.eventType));
    const completionLogs = taskLogs.filter((log) => assignmentCompletionEventTypes.has(log.eventType));
    const chatProgressIds = uniqueStrings([
      ...(task.evidenceMessageIds || []),
      ...(ownerState.worklog || [])
        .filter((item) => String(item.taskId || '') === String(row.taskId || ''))
        .flatMap((item) => [item.sourceMessageId, item.messageId, ...(item.sourceMessageIds || [])]),
    ]);
    const timelineProgressLogIds = uniqueStrings([
      ...progressLogs.map((log) => log.id),
      ...row.workTimelineLogIds,
    ]);
    const latestProgressLog = progressLogs[0] || taskLogs[0] || null;
    return {
      ...row,
      status: task.status || null,
      workPulseCount: task.workPulseCount || progressLogs.length || 0,
      completedAt: task.completedAt || completionLogs[0]?.time || null,
      progressLogIds: progressLogs.map((log) => log.id),
      completionLogIds: completionLogs.map((log) => log.id),
      timelineProgressLogIds,
      chatProgressIds,
      latestProgressText: latestProgressLog?.log || ownerState.worklog?.find((item) => String(item.taskId || '') === String(row.taskId || ''))?.text || task.text || row.text,
      progressPublished: timelineProgressLogIds.length > 0,
      completionPublished: Boolean(task.status === 'done' || task.completedAt || completionLogs.length > 0),
    };
  });
  const kickoffActionIds = uniqueStrings((charter?.nextActions || []).map((action) => action.id));
  const kickoffAssignmentRows = assignmentFlowRows.filter((row) => (
    kickoffActionIds.includes(String(row.taskId || ''))
    || row.source === 'kickoff-leader-assignment'
    || (project.tasks || []).find((task) => task.id === row.taskId)?.source === 'kickoff-leader-assignment'
  ));
  const firstPulseMessages = projectMessages.filter((message) => (
    message.time === 'First Pulse'
    || message.source === 'backend-kickoff-first-pulse-chat'
    || message.autonomousCycle?.trigger === 'initiation-approval'
    || message.agentWorker?.trigger === 'initiation-approval'
  ));
  const firstPulseSchedulerRecord = (project.autonomousSchedulerLedger || [])
    .find((record) => record.trigger === 'initiation-approval') || null;
  const firstAutonomousCycle = (project.autonomousLedger || [])
    .find((cycle) => cycle.trigger === 'initiation-approval')
    || project.autonomousLedger?.[project.autonomousLedger.length - 1]
    || null;
  const firstPulsePlanByAgentId = Object.fromEntries((firstAutonomousCycle?.agentPlans || [])
    .filter((plan) => plan?.agentId)
    .map((plan) => [plan.agentId, plan]));
  const allAgentStartupRows = team.map((agent) => {
    const state = agentStates[agent.id] || {};
    const plan = firstPulsePlanByAgentId[agent.id] || {};
    const hasRoutinePlan = Boolean(state.currentPlan?.routine || plan.routineId || plan.routineLabel);
    const hasFirstPulsePlan = Boolean(firstPulsePlanByAgentId[agent.id]);
    const hasWorkerStartup = Boolean((project.agentWorkerLedger || []).some((record) => (
      record.agentId === agent.id
      && (
        record.trigger === 'initiation-approval'
        || record.trigger === 'http-autonomous-scheduler-startup-agents'
        || record.reason === 'scheduler-start-agent-sweep'
      )
    )));
    const proofLogIds = uniqueStrings((project.logs || [])
      .filter((log) => log.agentId === agent.id || log.agent === agent.name)
      .map((log) => log.id))
      .slice(0, 8);
    const startupProofTypes = [
      hasRoutinePlan ? 'routine-plan' : null,
      hasFirstPulsePlan ? 'first-pulse-plan' : null,
      hasWorkerStartup ? 'agent-worker-startup' : null,
      proofLogIds.length ? 'timeline-proof' : null,
    ].filter(Boolean);
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role || agent.title || '',
      started: Boolean(hasRoutinePlan || hasFirstPulsePlan || state.status),
      scheduled: Boolean(state.nextAgentRunAt || firstPulseSchedulerRecord?.nextRunAt || project.nextAutonomousRunAt),
      hasRoutinePlan,
      hasFirstPulsePlan,
      hasWorkerStartup,
      startupProofTypes,
      status: state.status || plan.status || 'waiting',
      nextRunAt: state.nextAgentRunAt || firstPulseSchedulerRecord?.nextRunAt || project.nextAutonomousRunAt || null,
      routineLabel: state.currentPlan?.routine?.label || plan.routineLabel || 'fixed routine',
      routineArtifact: state.currentPlan?.routine?.artifact || plan.routineArtifact || null,
      planFocus: state.currentPlan?.focus || plan.focus || null,
      proofLogIds,
    };
  });
  const kickoffExecutionFlow = charter ? {
    nextActionResolution,
    nextActionResolutionDelivery,
    nextActions: (charter.nextActions || []).slice(0, 8).map((action) => ({
      ...action,
      ownerName: action.ownerName || agentNameById[action.ownerId] || action.ownerId || 'Unassigned',
      assignmentSeen: kickoffAssignmentRows.some((row) => String(row.taskId || '') === String(action.id || '')),
    })),
    assignmentRows: kickoffAssignmentRows,
    firstPulse: {
      started: Boolean(firstPulseSchedulerRecord || firstPulseMessages.length),
      trigger: firstPulseSchedulerRecord?.trigger || firstPulseMessages[0]?.autonomousCycle?.trigger || null,
      nextRunAt: firstPulseSchedulerRecord?.nextRunAt || project.nextAutonomousRunAt || null,
      messageIds: uniqueStrings(firstPulseMessages.map((message) => message.id)),
      timelineLogIds: uniqueStrings(logIdsForEventTypes(project, ['work-pulse', 'daily-report', 'task-completed', 'agent-work-pulse', 'agent-task-completed'])),
      schedulerRecord: firstPulseSchedulerRecord,
    },
    allAgentStartupRows,
    allAgentsStarted: allAgentStartupRows.length > 0 && allAgentStartupRows.every((row) => row.started),
    allAgentsScheduled: allAgentStartupRows.length > 0 && allAgentStartupRows.every((row) => row.scheduled),
    readyForAutonomy: Boolean(firstPulseSchedulerRecord || project.nextAutonomousRunAt || project.autonomy?.enabled),
  } : null;

  const changeFlowRows = (project.changeLedger || []).slice(0, 8).map((change) => {
    const ownerState = change.ownerId ? agentStates[change.ownerId] || {} : {};
    const changeTask = (project.tasks || []).find((task) => task.id === change.taskId) || {};
    const ownerWorkCycle = (project.agentWorkerLedger || []).find((record) => (
      record.taskId === change.taskId
      && record.trigger === 'change-owner-start-work'
    )) || null;
    const syncedAgentNames = (change.teamSyncAgentIds || []).map((agentId) => agentNameById[agentId] || agentId).filter(Boolean);
    const discussionProofIds = uniqueStrings([
      ...(change.discussionMessageIds || []),
      change.confirmationMessageId,
      change.syncMessageId,
    ]);
    const discussionDeliveredAgentIds = team
      .filter((agent) => (agentStates[agent.id]?.inbox || []).some((item) => discussionProofIds.includes(item.sourceMessageId || item.messageId)))
      .map((agent) => agent.id);
    const discussionObligationAgentIds = team
      .filter((agent) => (agentStates[agent.id]?.obligations || []).some((item) => discussionProofIds.includes(item.sourceMessageId || item.messageId)))
      .map((agent) => agent.id);
    const sourceMessageIds = change.sourceMessageIds || [change.requestMessageId].filter(Boolean);
    const sourceChannelIds = change.sourceChannelIds || [change.sourceChannelId].filter(Boolean);
    const sourceModes = sourceChannelIds.map((channelId, index) => multiChannelSourceModeFor(channelId, change.sourceModes?.[index]));
    const sourceModeLabels = sourceModes.map((sourceMode, index) => multiChannelSourceLabelFor(sourceMode, sourceChannelIds[index]));
    const sourceIntakeRows = (sourceChannelIds.length ? sourceChannelIds : ['main']).map((channelId, index) => {
      const sourceMessageId = sourceMessageIds[index] || sourceMessageIds[0] || change.requestMessageId || null;
      const sourceMessage = projectMessages.find((message) => message.id === sourceMessageId) || {};
      const deliveredAgentIds = team
        .filter((agent) => (agentStates[agent.id]?.inbox || []).some((item) => sourceMessageId && sourceMessageId === (item.sourceMessageId || item.messageId)))
        .map((agent) => agent.id);
      const obligatedAgentIds = team
        .filter((agent) => (agentStates[agent.id]?.obligations || []).some((item) => sourceMessageId && sourceMessageId === (item.sourceMessageId || item.messageId)))
        .map((agent) => agent.id);
      return {
        id: `${change.id}_${channelId}_${index}`,
        changeId: change.id,
        channelId,
        sourceMode: sourceModes[index] || multiChannelSourceModeFor(channelId),
        sourceModeLabel: sourceModeLabels[index] || multiChannelSourceLabelFor(null, channelId),
        sourceMessageId,
        source: sourceModeLabels[index] || (channelId === 'google_chat' ? 'Google Chat' : channelId === 'main' ? 'War Room' : channelId),
        requestText: sourceMessage.text || change.requestText,
        receiptCount: sourceMessage.visibility?.receiptCount || sourceMessage.receipts?.length || sourceMessage.heardBy?.length || deliveredAgentIds.length,
        directTargetCount: sourceMessage.visibility?.directTargetCount || sourceMessage.directTargetIds?.length || 0,
        deliveredAgentIds,
        obligatedAgentIds,
        deliveredCount: deliveredAgentIds.length,
        obligationCount: obligatedAgentIds.length,
      };
    });
    return {
      changeId: change.id,
      taskId: change.taskId,
      requestText: change.requestText,
      source: change.source,
      sourceChannelId: change.sourceChannelId,
      sourceChannelIds,
      sourceModes,
      sourceModeLabels,
      requestMessageId: change.requestMessageId || null,
      sourceMessageIds,
      sourceIntakeRows,
      discussionMessageIds: change.discussionMessageIds || [],
      confirmationMessageId: change.confirmationMessageId || null,
      syncMessageId: change.syncMessageId || null,
      ownerId: change.ownerId,
      ownerName: change.ownerName,
      ownerPlanLinked: Boolean(
        change.planUpdate
        || ownerState.currentPlan?.changeRecordId === change.id
        || ownerState.currentPlan?.taskId === change.taskId
      ),
      ownerWorkStarted: Boolean(ownerWorkCycle || changeTask.workPulseCount > 0),
      ownerWorkTrigger: ownerWorkCycle?.trigger || null,
      ownerWorkMessageIds: uniqueStrings([
        ownerWorkCycle?.messageId,
        ...(changeTask.evidenceMessageIds || []),
      ]),
      ownerWorkTimelineLogIds: uniqueStrings([
        ownerWorkCycle?.logId,
        ...(changeTask.timelineLogIds || []),
      ]),
      teamSyncCount: change.teamSyncCount || syncedAgentNames.length || 0,
      syncedAgentNames,
      discussionDeliveredAgentIds,
      discussionObligationAgentIds,
      discussionDeliveryCount: discussionDeliveredAgentIds.length,
      discussionObligationCount: discussionObligationAgentIds.length,
      discussionDeliveryComplete: discussionDeliveredAgentIds.length === team.length,
      timelineLogIds: uniqueStrings(project.tasks?.find((task) => task.id === change.taskId)?.timelineLogIds || []),
    };
  });
  const changeSourceIntakeRows = changeFlowRows.flatMap((row) => row.sourceIntakeRows.map((sourceRow) => ({
    ...sourceRow,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    discussionCount: row.discussionMessageIds.length,
    ownerConfirmed: Boolean(row.confirmationMessageId),
    ownerPlanLinked: row.ownerPlanLinked,
    teamSyncCount: row.teamSyncCount,
    sourceChannelCount: row.sourceChannelIds.length,
    discussionMessageIds: row.discussionMessageIds,
    confirmationMessageId: row.confirmationMessageId,
    syncMessageId: row.syncMessageId,
  })));
  const agentCommunicationRows = projectMessages
    .filter((message) => (
      message.source === 'agent-to-agent-message'
      || (team.some((agent) => agent.id === message.authorId || agent.name === message.author) && (message.directTargetIds || []).length > 0)
    ))
    .slice(-40)
    .reverse()
    .map((message) => {
      const sender = team.find((agent) => agent.id === message.authorId || agent.name === message.author);
      const targetIds = uniqueStrings([
        ...(message.directTargetIds || []),
        ...(message.targetIds || []),
      ]);
      const targetNames = targetIds.map((id) => agentNameById[id] || id).filter(Boolean);
      const senderState = sender ? agentStates[sender.id] || {} : {};
      const targetStates = targetIds.map((targetId) => agentStates[targetId] || {});
      return {
        messageId: message.id,
        channelId: message.channelId || 'main',
        source: message.source || 'group-chat-message',
        text: message.text || '',
        senderId: sender?.id || message.authorId || null,
        senderName: sender?.name || message.author || 'Agent',
        targetIds,
        targetNames,
        receiptCount: message.visibility?.receiptCount || message.receipts?.length || message.heardBy?.length || 0,
        directTargetCount: message.visibility?.directTargetCount || targetIds.length,
        inboxSeen: targetStates.some((state) => (state.inbox || []).some((item) => item.sourceMessageId === message.id || item.messageId === message.id)),
        obligationSeen: targetStates.some((state) => (state.obligations || []).some((item) => item.sourceMessageId === message.id || item.messageId === message.id)),
        senderWorklogSeen: Boolean((senderState.worklog || []).some((item) => item.sourceMessageId === message.id || item.messageId === message.id)),
        proofIds: [message.id].filter(Boolean),
        apiPath: projectId ? `/projects/${projectId}/transcripts/${message.channelId || 'main'}` : null,
      };
    });
  const agentMessageDeliveryRows = agentCommunicationRows.flatMap((row) => {
    const message = projectMessages.find((item) => item.id === row.messageId) || {};
    const targetIds = row.targetIds?.length ? row.targetIds : message.heardBy || [];
    return targetIds.map((targetId) => {
      const targetState = agentStates[targetId] || {};
      const receiptSeen = Boolean(
        (message.directTargetIds || []).includes(targetId)
        || (message.heardBy || []).includes(targetId)
        || (message.receipts || []).some((receipt) => receipt.agentId === targetId)
      );
      const inboxSeen = Boolean((targetState.inbox || []).some((item) => item.sourceMessageId === row.messageId || item.messageId === row.messageId));
      const obligationSeen = Boolean((targetState.obligations || []).some((item) => item.sourceMessageId === row.messageId || item.messageId === row.messageId));
      return {
        id: `${row.messageId}_${targetId}`,
        messageId: row.messageId,
        channelId: row.channelId,
        senderId: row.senderId,
        senderName: row.senderName,
        targetId,
        targetName: agentNameById[targetId] || targetId,
        text: row.text,
        receiptSeen,
        inboxSeen,
        obligationSeen,
        senderWorklogSeen: row.senderWorklogSeen,
        proofIds: row.proofIds || [],
      };
    });
  });
  const eventLedgerHasEvidence = (ids = []) => {
    const wanted = new Set(ids.filter(Boolean).map(String));
    if (!wanted.size) return false;
    return (project.eventLedger || []).some((event) => {
      const evidenceIds = [
        event.id,
        ...(event.evidenceIds || []),
        event.entityIds?.messageId,
        event.entityIds?.logId,
        event.entityIds?.taskId,
      ].filter(Boolean).map(String);
      return evidenceIds.some((id) => wanted.has(id));
    });
  };
  const syncProtocolRows = [
    {
      id: 'kickoff-next-action-sync',
      protocol: 'Kickoff Decision Sync',
      managerMeaning: 'Meeting decisions become Agent inbox, obligation, schedule, timeline, and ledger state.',
      source: 'kickoff-meeting',
      published: Boolean(nextActionResolution),
      delivered: Boolean(nextActionResolutionDelivery?.allAgentsReceived),
      agentStateWritten: Boolean(nextActionResolutionDelivery?.allAgentsObligated && kickoffExecutionFlow?.allAgentsStarted),
      timelineRecorded: Boolean(kickoffExecutionFlow?.firstPulse?.timelineLogIds?.length),
      eventLedgerRecorded: eventLedgerHasEvidence([
        nextActionDecisionMessageId,
        ...(kickoffExecutionFlow?.firstPulse?.timelineLogIds || []),
      ]),
      proofIds: [nextActionDecisionMessageId].filter(Boolean),
      timelineLogIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
      route: projectId ? `/projects/${projectId}/manager-dashboard#kickoff-execution-flow` : null,
    },
    {
      id: 'leader-assignment-sync',
      protocol: 'Leader @Assignment Sync',
      managerMeaning: 'Leader @messages create tasks, assignee inbox state, work start, and timeline proof.',
      source: 'group-chat',
      published: assignmentTimelineMatrixRows.some((row) => row.assignmentPosted),
      delivered: assignmentTimelineMatrixRows.some((row) => row.assigneeReceived),
      agentStateWritten: assignmentTimelineMatrixRows.some((row) => row.assigneeReceived && row.assigneeAccepted),
      timelineRecorded: assignmentTimelineMatrixRows.some((row) => row.timelineRecorded),
      eventLedgerRecorded: eventLedgerHasEvidence(assignmentTimelineMatrixRows.flatMap((row) => [
        ...(row.evidence?.chatIds || []),
        ...(row.evidence?.timelineIds || []),
        row.taskId,
      ])),
      proofIds: assignmentTimelineMatrixRows.flatMap((row) => row.evidence?.chatIds || []).slice(0, 8),
      timelineLogIds: assignmentTimelineMatrixRows.flatMap((row) => row.evidence?.timelineIds || []).slice(0, 8),
      route: projectId ? `/projects/${projectId}/tasks` : null,
    },
    {
      id: 'agent-message-sync',
      protocol: 'Agent-to-Agent Message Sync',
      managerMeaning: 'Agent-authored messages reach target inbox/obligations and sender worklog.',
      source: 'agent-group-chat',
      published: agentCommunicationRows.length > 0,
      delivered: agentMessageDeliveryRows.some((row) => row.receiptSeen && row.inboxSeen),
      agentStateWritten: agentMessageDeliveryRows.some((row) => row.inboxSeen && row.senderWorklogSeen),
      timelineRecorded: agentCommunicationRows.some((row) => eventLedgerHasEvidence(row.proofIds)),
      eventLedgerRecorded: agentCommunicationRows.some((row) => eventLedgerHasEvidence(row.proofIds)),
      proofIds: agentCommunicationRows.flatMap((row) => row.proofIds || []).slice(0, 8),
      timelineLogIds: [],
      route: projectId ? `/projects/${projectId}/transcripts/main` : null,
    },
    {
      id: 'change-request-sync',
      protocol: 'Change Request Sync',
      managerMeaning: 'Meeting/Google Chat changes become discussion, owner confirmation, owner plan, team sync, and timeline proof.',
      source: 'meeting-google-chat',
      published: changeSourceIntakeRows.some((row) => row.sourceMessageId),
      delivered: changeSourceIntakeRows.some((row) => row.receiptCount > 0),
      agentStateWritten: changeFlowRows.some((row) => row.ownerPlanLinked && row.teamSyncCount > 0),
      timelineRecorded: changeFlowRows.some((row) => row.timelineLogIds?.length > 0 || row.ownerWorkTimelineLogIds?.length > 0),
      eventLedgerRecorded: eventLedgerHasEvidence(changeFlowRows.flatMap((row) => [
        row.requestMessageId,
        ...(row.sourceMessageIds || []),
        ...(row.discussionMessageIds || []),
        row.confirmationMessageId,
        row.syncMessageId,
        ...(row.timelineLogIds || []),
        ...(row.ownerWorkTimelineLogIds || []),
      ])),
      proofIds: changeFlowRows.flatMap((row) => [
        ...(row.sourceMessageIds || []),
        ...(row.discussionMessageIds || []),
        row.confirmationMessageId,
        row.syncMessageId,
      ]).filter(Boolean).slice(0, 8),
      timelineLogIds: changeFlowRows.flatMap((row) => [
        ...(row.timelineLogIds || []),
        ...(row.ownerWorkTimelineLogIds || []),
      ]).slice(0, 8),
      route: projectId ? `/projects/${projectId}/manager-dashboard#change-resolution-matrix` : null,
    },
    {
      id: 'management-sync',
      protocol: 'Agent Management Sync',
      managerMeaning: 'Leader and peer-management check-ins are delivered, answered, and visible as management proof.',
      source: 'agent-worker',
      published: managementMeshRows.some((row) => row.checkInCount > 0),
      delivered: managementMeshRows.some((row) => row.workerTargetIds?.length > 0 || row.proofLogIds?.length > 0),
      agentStateWritten: managementMeshRows.some((row) => row.responseCount > 0 || row.workerResponseTargetIds?.length > 0),
      timelineRecorded: managementMeshRows.some((row) => row.proofLogIds?.length > 0),
      eventLedgerRecorded: eventLedgerHasEvidence(managementMeshRows.flatMap((row) => row.proofLogIds || [])),
      proofIds: [],
      timelineLogIds: managementMeshRows.flatMap((row) => row.proofLogIds || []).slice(0, 8),
      route: projectId ? `/projects/${projectId}/timeline` : null,
    },
    {
      id: 'continuous-worker-sync',
      protocol: '24/7 Worker Sync',
      managerMeaning: 'Scheduler/worker pulses keep every Agent routine, next run, chat proof, and timeline proof current.',
      source: 'scheduler-worker',
      published: Boolean(latestProjectCycle || latestSchedulerRecord || project.agentWorkerLedger?.length),
      delivered: continuousWorkLoopRows.some((row) => row.proofReady),
      agentStateWritten: continuousWorkLoopRows.length > 0 && continuousWorkLoopRows.every((row) => row.nextRunAt || row.lastRunAt),
      timelineRecorded: continuousWorkLoopRows.some((row) => row.timelineLogIds?.length > 0),
      eventLedgerRecorded: eventLedgerHasEvidence(continuousWorkLoopRows.flatMap((row) => [
        ...(row.chatProofIds || []),
        ...(row.timelineLogIds || []),
      ])),
      proofIds: continuousWorkLoopRows.flatMap((row) => row.chatProofIds || []).slice(0, 8),
      timelineLogIds: continuousWorkLoopRows.flatMap((row) => row.timelineLogIds || []).slice(0, 8),
      route: projectId ? `/projects/${projectId}/workers/agents/due` : null,
    },
  ].map((row) => {
    const checks = ['published', 'delivered', 'agentStateWritten', 'timelineRecorded', 'eventLedgerRecorded'];
    const passedCount = checks.filter((key) => row[key]).length;
    return {
      ...row,
      checks,
      passedCount,
      totalCount: checks.length,
      complete: passedCount === checks.length,
      status: passedCount === checks.length ? 'synced' : passedCount > 0 ? 'partial' : 'waiting',
    };
  });
  const syncProtocolAudit = {
    count: syncProtocolRows.length,
    syncedCount: syncProtocolRows.filter((row) => row.complete).length,
    partialCount: syncProtocolRows.filter((row) => row.status === 'partial').length,
    waitingCount: syncProtocolRows.filter((row) => row.status === 'waiting').length,
    status: syncProtocolRows.every((row) => row.complete) ? 'synced' : 'needs-attention',
    rows: syncProtocolRows,
  };
  const managerScenarioTrailRows = [
    {
      id: 'kickoff-brief',
      stage: 'Project Brief Heard',
      outcome: `${kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length || 0}/${team.length} Agents heard the brief`,
      passed: Boolean(kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length),
      proofKind: 'chat',
      proofIds: kickoffMeetingFlow?.briefAlignment?.proofIds || kickoffMeetingFlow?.proofIds || [],
      channelId: kickoffMeetingFlow?.briefAlignment?.channelId || 'main',
    },
    {
      id: 'role-and-campaign',
      stage: 'Role Questions + Leader Campaign',
      outcome: `${kickoffMeetingFlow?.roleQuestionCount || 0} questions / ${kickoffMeetingFlow?.leaderCampaignCount || 0} campaigns`,
      passed: Boolean(kickoffMeetingFlow?.roleQuestionCount || kickoffMeetingFlow?.leaderCampaignCount),
      proofKind: 'chat',
      proofIds: kickoffMeetingFlow?.proofIds || [],
      channelId: 'main',
    },
    {
      id: 'leader-confirmed',
      stage: 'Leader Marker Confirmed',
      outcome: kickoffMeetingFlow?.confirmedLeaderName || 'Leader pending',
      passed: Boolean(kickoffMeetingFlow?.leaderMarkerPersisted),
      proofKind: 'timeline',
      timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
    },
    {
      id: 'team-confirmed',
      stage: 'Confirmed Team',
      outcome: `${kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter((row) => row.inProjectState && row.inKickoffCharter).length || 0}/${kickoffMeetingFlow?.confirmedTeamMatrixRows?.length || team.length} roster rows persisted`,
      passed: Boolean(kickoffMeetingFlow?.confirmedTeamMatrixRows?.length && kickoffMeetingFlow.confirmedTeamMatrixRows.every((row) => row.inProjectState && row.inKickoffCharter)),
      proofKind: 'timeline',
      timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
    },
    {
      id: 'next-actions-to-autonomy',
      stage: 'Next Actions + 24/7 Startup',
      outcome: `${kickoffExecutionFlow?.nextActions?.length || 0} actions / ${kickoffExecutionFlow?.allAgentStartupRows?.filter((row) => row.started && row.scheduled).length || 0} Agents started`,
      passed: Boolean(kickoffExecutionFlow?.nextActions?.length && kickoffExecutionFlow?.allAgentsStarted && kickoffExecutionFlow?.allAgentsScheduled),
      proofKind: 'timeline',
      timelineLogIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
    },
    {
      id: 'leader-assignment',
      stage: 'Leader @Assignment',
      outcome: `${assignmentTimelineMatrixRows.filter((row) => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded).length}/${assignmentTimelineMatrixRows.length} assignment chains timeline-ready`,
      passed: Boolean(assignmentTimelineMatrixRows.some((row) => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded)),
      proofKind: 'task-evidence',
      proofIds: assignmentTimelineMatrixRows.flatMap((row) => row.evidence.chatIds || []).slice(0, 8),
      timelineLogIds: assignmentTimelineMatrixRows.flatMap((row) => row.evidence.timelineIds || []).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'assignment-progress',
      stage: 'Assigned Work Progress',
      outcome: `${assignmentWorkProgressRows.filter((row) => row.progressPublished).length}/${assignmentWorkProgressRows.length} assigned tasks publishing progress`,
      passed: Boolean(assignmentWorkProgressRows.some((row) => row.progressPublished)),
      proofKind: 'timeline',
      timelineLogIds: assignmentWorkProgressRows.flatMap((row) => row.timelineProgressLogIds || []).slice(0, 8),
    },
    {
      id: 'agent-chat-delivery',
      stage: 'Agent-to-Agent Chat Delivery',
      outcome: `${agentMessageDeliveryRows.filter((row) => row.receiptSeen && row.inboxSeen).length}/${agentMessageDeliveryRows.length} direct messages delivered`,
      passed: Boolean(agentMessageDeliveryRows.some((row) => row.receiptSeen && row.inboxSeen)),
      proofKind: 'chat',
      proofIds: agentMessageDeliveryRows.flatMap((row) => row.proofIds || []).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'continuous-work',
      stage: 'Continuous Work Loop',
      outcome: `${continuousWorkLoopRows.filter((row) => row.proofReady).length}/${continuousWorkLoopRows.length} Agents have loop proof`,
      passed: Boolean(continuousWorkLoopRows.some((row) => row.proofReady && row.nextRunAt)),
      proofKind: 'timeline',
      timelineLogIds: continuousWorkLoopRows.flatMap((row) => row.timelineLogIds || []).slice(0, 8),
    },
    {
      id: 'dual-channel-change',
      stage: 'Meeting + Google Chat Change',
      outcome: `${changeSourceIntakeRows.filter((row) => row.sourceChannelCount > 1).length} dual-channel source rows`,
      passed: Boolean(changeSourceIntakeRows.some((row) => row.sourceChannelCount > 1 && row.channelId === 'google_chat' && row.sourceMessageId)),
      proofKind: 'chat',
      proofIds: changeSourceIntakeRows.filter((row) => row.sourceChannelCount > 1).map((row) => row.sourceMessageId).filter(Boolean).slice(0, 8),
      channelId: 'google_chat',
    },
    {
      id: 'owner-plan-sync',
      stage: 'Owner Plan + Team Sync',
      outcome: `${changeFlowRows.filter((row) => row.ownerPlanLinked && row.teamSyncCount > 0).length}/${changeFlowRows.length} changes synced`,
      passed: Boolean(changeFlowRows.some((row) => row.ownerPlanLinked && row.teamSyncCount > 0)),
      proofKind: 'chat',
      proofIds: changeFlowRows.flatMap((row) => [row.confirmationMessageId, row.syncMessageId]).filter(Boolean).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'management-mesh',
      stage: 'Mutual Management',
      outcome: `${managementMeshRows.filter((row) => row.checkInCount > 0 || row.responseCount > 0).length}/${managementMeshRows.length} Agents with management proof`,
      passed: Boolean(managementMeshRows.some((row) => row.checkInCount > 0 && row.responseCount > 0)),
      proofKind: 'timeline',
      timelineLogIds: managementMeshRows.flatMap((row) => row.proofLogIds || []).slice(0, 8),
    },
  ];
  const trailById = Object.fromEntries(managerScenarioTrailRows.map((row) => [row.id, row]));
  const managerRequirementMatrixRows = [
    {
      id: 'kickoff-brief-understood',
      requirement: 'Director opens a kickoff meeting and briefs the project.',
      evidence: trailById['kickoff-brief']?.outcome || 'brief pending',
      passed: Boolean(trailById['kickoff-brief']?.passed),
      proofKind: 'chat',
      proofIds: trailById['kickoff-brief']?.proofIds || [],
      channelId: trailById['kickoff-brief']?.channelId || 'main',
    },
    {
      id: 'roles-questions-and-self-nominations',
      requirement: 'Agents ask role questions and self-nominate based on their responsibilities.',
      evidence: `${kickoffMeetingFlow?.roleQuestionCount || 0} role questions / ${kickoffMeetingFlow?.selfNominationCount || 0} self-nominations`,
      passed: Boolean((kickoffMeetingFlow?.roleQuestionCount || 0) > 0 && (kickoffMeetingFlow?.selfNominationCount || 0) > 0),
      proofKind: 'chat',
      proofIds: kickoffMeetingFlow?.proofIds || [],
      channelId: 'main',
    },
    {
      id: 'agents-hear-each-other',
      requirement: 'Agents can hear each other during role clarification and leader campaign.',
      evidence: `${(kickoffMeetingFlow?.roleHearingCount || 0) + (kickoffMeetingFlow?.leaderHearingCount || 0)} hearing edges`,
      passed: Boolean((kickoffMeetingFlow?.roleHearingCount || 0) > 0 && (kickoffMeetingFlow?.leaderHearingCount || 0) > 0),
      proofKind: 'chat',
      proofIds: kickoffMeetingFlow?.proofIds || [],
      channelId: 'main',
    },
    {
      id: 'confirmed-team',
      requirement: 'Director finalizes the team after the kickoff discussion.',
      evidence: trailById['team-confirmed']?.outcome || 'team pending',
      passed: Boolean(trailById['team-confirmed']?.passed),
      proofKind: 'timeline',
      timelineLogIds: trailById['team-confirmed']?.timelineLogIds || [],
    },
    {
      id: 'leader-election-marker',
      requirement: 'Leader emerges through campaign, is confirmed by Director, and receives a leader marker.',
      evidence: trailById['leader-confirmed']?.outcome || 'leader pending',
      passed: Boolean(trailById['role-and-campaign']?.passed && trailById['leader-confirmed']?.passed),
      proofKind: 'timeline',
      proofIds: trailById['role-and-campaign']?.proofIds || [],
      timelineLogIds: trailById['leader-confirmed']?.timelineLogIds || [],
      channelId: 'main',
    },
    {
      id: 'next-actions-and-autonomy',
      requirement: 'The meeting confirms next actions and starts 24/7 Agent work.',
      evidence: trailById['next-actions-to-autonomy']?.outcome || 'startup pending',
      passed: Boolean(trailById['next-actions-to-autonomy']?.passed),
      proofKind: 'timeline',
      timelineLogIds: trailById['next-actions-to-autonomy']?.timelineLogIds || [],
    },
    {
      id: 'leader-group-assignment',
      requirement: 'Leader assigns tasks by @mentioning Agents in group chat.',
      evidence: trailById['leader-assignment']?.outcome || 'assignment pending',
      passed: Boolean(trailById['leader-assignment']?.passed),
      proofKind: 'task-evidence',
      proofIds: trailById['leader-assignment']?.proofIds || [],
      timelineLogIds: trailById['leader-assignment']?.timelineLogIds || [],
      channelId: 'main',
    },
    {
      id: 'assignee-receives-and-starts',
      requirement: '@mentioned Agents immediately receive the assignment and start work.',
      evidence: `${assignmentTimelineMatrixRows.filter((row) => row.assigneeReceived && row.workSeen).length}/${assignmentTimelineMatrixRows.length} assignments received and started`,
      passed: Boolean(assignmentTimelineMatrixRows.some((row) => row.assigneeReceived && row.workSeen)),
      proofKind: 'timeline',
      proofIds: assignmentTimelineMatrixRows.flatMap((row) => row.evidence.chatIds || []).slice(0, 8),
      timelineLogIds: assignmentTimelineMatrixRows.flatMap((row) => row.workTimelineLogIds || row.evidence.timelineIds || []).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'progress-to-timeline',
      requirement: 'Work progress and completion are uploaded to the big timeline.',
      evidence: trailById['assignment-progress']?.outcome || 'progress pending',
      passed: Boolean(trailById['assignment-progress']?.passed),
      proofKind: 'timeline',
      timelineLogIds: trailById['assignment-progress']?.timelineLogIds || [],
    },
    {
      id: 'group-chat-visible',
      requirement: 'The manager can see Agent chat records in group chat.',
      evidence: trailById['agent-chat-delivery']?.outcome || 'chat pending',
      passed: Boolean(trailById['agent-chat-delivery']?.passed),
      proofKind: 'chat',
      proofIds: trailById['agent-chat-delivery']?.proofIds || [],
      channelId: 'main',
    },
    {
      id: 'fixed-continuous-routines',
      requirement: 'All Agents keep running fixed work routines continuously.',
      evidence: trailById['continuous-work']?.outcome || 'loop pending',
      passed: Boolean(trailById['continuous-work']?.passed),
      proofKind: 'timeline',
      timelineLogIds: trailById['continuous-work']?.timelineLogIds || [],
    },
    {
      id: 'midproject-dual-channel-change',
      requirement: 'Manager can raise a new feature in War Room and Google Chat at the same time.',
      evidence: trailById['dual-channel-change']?.outcome || 'change intake pending',
      passed: Boolean(trailById['dual-channel-change']?.passed),
      proofKind: 'chat',
      proofIds: trailById['dual-channel-change']?.proofIds || [],
      channelId: trailById['dual-channel-change']?.channelId || 'google_chat',
    },
    {
      id: 'change-discussion-owner-confirm',
      requirement: 'Agents discuss the change and the responsible owner confirms it.',
      evidence: `${changeFlowRows.filter((row) => row.discussionMessageIds.length > 0 && row.confirmationMessageId).length}/${changeFlowRows.length} changes discussed and confirmed`,
      passed: Boolean(changeFlowRows.some((row) => row.discussionMessageIds.length > 0 && row.confirmationMessageId)),
      proofKind: 'chat',
      proofIds: changeFlowRows.flatMap((row) => [...(row.discussionMessageIds || []), row.confirmationMessageId]).filter(Boolean).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'owner-plan-and-team-sync',
      requirement: 'The owner adds the change to their plan and syncs it back to the team.',
      evidence: trailById['owner-plan-sync']?.outcome || 'owner sync pending',
      passed: Boolean(trailById['owner-plan-sync']?.passed),
      proofKind: 'chat',
      proofIds: trailById['owner-plan-sync']?.proofIds || [],
      channelId: 'main',
    },
    {
      id: 'agents-mutually-manage',
      requirement: 'Agents can mutually manage one another with auditable check-ins.',
      evidence: trailById['management-mesh']?.outcome || 'management pending',
      passed: Boolean(trailById['management-mesh']?.passed),
      proofKind: 'timeline',
      timelineLogIds: trailById['management-mesh']?.timelineLogIds || [],
    },
  ];
  const requirementById = Object.fromEntries(managerRequirementMatrixRows.map((row) => [row.id, row]));
  const useCaseAuditSpecs = [
    {
      id: 'kickoff-meeting-understanding',
      stage: 'Kickoff Meeting',
      managerQuestion: 'Can the Director brief the project, answer role questions, hear self-nominations, and finalize the team?',
      requirementIds: ['kickoff-brief-understood', 'roles-questions-and-self-nominations', 'agents-hear-each-other', 'confirmed-team'],
    },
    {
      id: 'leader-election-and-marker',
      stage: 'Leader Election',
      managerQuestion: 'Can Leader candidates campaign, hear one another, and receive a Director-confirmed leader marker?',
      requirementIds: ['leader-election-marker'],
    },
    {
      id: 'next-actions-to-continuous-work',
      stage: '24/7 Work Start',
      managerQuestion: 'Can the meeting confirm next actions and start continuous fixed Agent routines?',
      requirementIds: ['next-actions-and-autonomy', 'fixed-continuous-routines'],
    },
    {
      id: 'group-chat-assignment-start',
      stage: 'Group @Assignment',
      managerQuestion: 'Can the Leader @assign Agents in group chat and have the assignee immediately start work?',
      requirementIds: ['leader-group-assignment', 'assignee-receives-and-starts'],
    },
    {
      id: 'progress-and-chat-visibility',
      stage: 'Progress Visibility',
      managerQuestion: 'Can progress reach the big timeline while the manager can still see the group chat record?',
      requirementIds: ['progress-to-timeline', 'group-chat-visible'],
    },
    {
      id: 'midproject-change-intake',
      stage: 'Change Intake',
      managerQuestion: 'Can the manager raise a new feature through a meeting and Google Chat at the same time?',
      requirementIds: ['midproject-dual-channel-change'],
    },
    {
      id: 'change-discussion-owner-confirm',
      stage: 'Owner Confirmation',
      managerQuestion: 'Do Agents discuss the change and does the responsible owner explicitly confirm it?',
      requirementIds: ['change-discussion-owner-confirm'],
    },
    {
      id: 'owner-plan-team-sync',
      stage: 'Plan + Team Sync',
      managerQuestion: 'Does the owner add the change to their plan and sync it back to everyone?',
      requirementIds: ['owner-plan-and-team-sync'],
    },
    {
      id: 'mutual-agent-management',
      stage: 'Mutual Management',
      managerQuestion: 'Can Agents mutually manage one another with auditable check-ins?',
      requirementIds: ['agents-mutually-manage'],
    },
  ];
  const managerUseCaseAuditRows = useCaseAuditSpecs.map((spec) => {
    const requirements = spec.requirementIds.map((id) => requirementById[id]).filter(Boolean);
    const coveredCount = requirements.filter((row) => row.passed).length;
    const status = coveredCount === requirements.length ? 'covered' : coveredCount > 0 ? 'partial' : 'missing';
    return {
      ...spec,
      status,
      covered: status === 'covered',
      coveredCount,
      requirementCount: requirements.length,
      missingRequirementIds: requirements.filter((row) => !row.passed).map((row) => row.id),
      evidence: requirements.map((row) => `${row.id}: ${row.evidence}`).join(' / '),
      proofKind: requirements.some((row) => row.timelineLogIds?.length) ? 'hybrid' : 'chat',
      proofIds: uniqueStrings(requirements.flatMap((row) => row.proofIds || [])).slice(0, 12),
      timelineLogIds: uniqueStrings(requirements.flatMap((row) => row.timelineLogIds || [])).slice(0, 12),
      channelId: requirements.find((row) => row.channelId)?.channelId || 'main',
      requirementRows: requirements.map((row) => ({
        id: row.id,
        requirement: row.requirement,
        passed: row.passed,
        evidence: row.evidence,
      })),
    };
  });
  const defaultActionOwner = team.find((agent) => !agent.isLeader) || team[0] || {};
  const confirmedLeaderId = kickoffMeetingFlow?.confirmedLeaderId || confirmedLeader?.id || project.kickoffCharter?.governance?.leaderId || team.find((agent) => agent.isLeader)?.id || null;
  const defaultNextAction = kickoffExecutionFlow?.nextActions?.[0] || nextActionResolution?.tasks?.[0] || project.tasks?.[0] || {};
  const nowTemplate = 'now-iso';
  const managerActionSpecs = {
    'kickoff-brief-understood': {
      phase: 'Kickoff',
      label: 'Open kickoff meeting',
      description: 'Create or resume the project kickoff meeting, brief the project, and let Agents hear the Director context.',
      method: 'POST',
      apiPath: '/kickoff-meetings',
      requestBodyTemplate: {
        projectId: projectId || 'project-id',
        name: project.name || 'Untitled Agent Project',
        brief: project.currentObjective || project.objective || project.name || 'Describe the project brief here.',
        team,
        selectedLeaderId: confirmedLeaderId,
        tasks: (kickoffExecutionFlow?.nextActions || project.tasks || []).slice(0, 3).map((task) => ({
          id: task.id,
          text: task.text,
          ownerId: task.ownerId || defaultActionOwner.id || null,
          status: task.status || 'pending',
        })),
        now: nowTemplate,
      },
      uiTarget: 'start-initiation-button',
    },
    'roles-questions-and-self-nominations': {
      phase: 'Kickoff',
      label: 'Answer role questions',
      description: 'Capture manager clarification so role questions, self-nominations, and responsibility claims become durable meeting evidence.',
      method: 'POST',
      apiPath: kickoffMeetingRoute('clarify'),
      requestBodyTemplate: {
        questionId: kickoffMeetingFlow?.roleQuestionResolutions?.find((row) => !row.answered)?.questionId || kickoffMeetingFlow?.roleQuestionResolutions?.[0]?.questionId || 'role-question-id',
        text: `Director clarification for ${project.name || 'this project'}: ${defaultActionOwner.name || 'the assigned Agent'} owns the next evidence packet.`,
        now: nowTemplate,
      },
      uiTarget: 'initiation-meeting-save-clarification',
    },
    'agents-hear-each-other': {
      phase: 'Kickoff',
      label: 'Review hearing coverage',
      description: 'Open the kickoff transcript and verify Agents heard role clarification and Leader campaign turns from one another.',
      method: 'GET',
      apiPath: projectId ? `/projects/${projectId}/transcripts/main` : '/projects/:projectId/transcripts/main',
      uiTarget: 'kickoff-hearing-matrix',
    },
    'confirmed-team': {
      phase: 'Kickoff',
      label: 'Confirm team roster',
      description: 'Finalize the project roster from the meeting so the kickoff charter and project state match.',
      method: 'POST',
      apiPath: kickoffMeetingRoute('approve'),
      requestBodyTemplate: {
        selectedTeamIds: team.map((agent) => agent.id).filter(Boolean),
        selectedLeaderId: confirmedLeaderId,
        reviewerId: project.kickoffCharter?.governance?.reviewerId || team.find((agent) => agent.id !== confirmedLeaderId)?.id || null,
        tasks: (kickoffExecutionFlow?.nextActions || project.tasks || []).slice(0, 3).map((task) => ({
          id: task.id,
          text: task.text,
          ownerId: task.ownerId || defaultActionOwner.id || null,
          status: task.status || 'pending',
        })),
        now: nowTemplate,
      },
      uiTarget: 'initiation-meeting-confirmed-team',
    },
    'leader-election-marker': {
      phase: 'Leader Election',
      label: 'Confirm Leader marker',
      description: 'Select the winning Leader after campaign statements and persist the Leader marker.',
      method: 'POST',
      apiPath: kickoffMeetingRoute('leader'),
      requestBodyTemplate: {
        selectedLeaderId: confirmedLeaderId || team[0]?.id || 'leader-agent-id',
        now: nowTemplate,
      },
      uiTarget: 'initiation-meeting-leader-resolution',
    },
    'next-actions-and-autonomy': {
      phase: 'Execution Start',
      label: 'Confirm next actions',
      description: 'Approve first execution tasks and start the 24/7 autonomous project and Agent work pulse.',
      method: 'POST',
      apiPath: kickoffMeetingRoute('next-actions'),
      requestBodyTemplate: {
        tasks: (kickoffExecutionFlow?.nextActions?.length ? kickoffExecutionFlow.nextActions : [defaultNextAction]).filter(Boolean).slice(0, 3).map((task, index) => ({
          id: task.id || `next_action_${index + 1}`,
          text: task.text || `Prepare first execution evidence for ${project.name || 'the project'}`,
          ownerId: task.ownerId || defaultActionOwner.id || null,
          status: task.status || 'pending',
        })),
        now: nowTemplate,
      },
      uiTarget: 'initiation-meeting-save-next-actions',
    },
    'leader-group-assignment': {
      phase: 'Leader Assignment',
      label: 'Ask Leader to @assign',
      description: 'Have the confirmed Leader publish a group-chat @assignment that creates task, inbox, and timeline evidence.',
      method: 'POST',
      rerunnable: true,
      apiPath: projectId ? `/projects/${projectId}/chat` : '/projects/:projectId/chat',
      requestBodyTemplate: {
        channelId: 'main',
        text: `leader assign @${defaultActionOwner.name || 'Agent'} prepare the next manager-review evidence packet`,
        now: nowTemplate,
      },
      uiTarget: 'manager-leader-assignment-composer',
    },
    'assignee-receives-and-starts': {
      phase: 'Agent Work',
      label: 'Run assignee work pulse',
      description: 'Start the assigned Agent work cycle so the @mentioned Agent acknowledges and begins work immediately.',
      method: 'POST',
      rerunnable: true,
      apiPath: projectId && defaultActionOwner.id ? `/projects/${projectId}/agents/${defaultActionOwner.id}/work-cycle` : '/projects/:projectId/agents/:agentId/work-cycle',
      requestBodyTemplate: {
        trigger: 'manager-action-playbook-assignee-start',
        cadence: 'assignment-start',
        source: 'manager-action-playbook',
        now: nowTemplate,
      },
      uiTarget: defaultActionOwner.id ? `agent-work-cycle-${defaultActionOwner.id}` : 'agent-work-cycle-:agentId',
    },
    'progress-to-timeline': {
      phase: 'Timeline Evidence',
      label: 'Open timeline progress',
      description: 'Inspect assignment progress and completion markers that were uploaded to the project timeline.',
      method: 'GET',
      apiPath: projectId ? `/projects/${projectId}/timeline` : '/projects/:projectId/timeline',
      uiTarget: 'assignment-work-progress-matrix',
    },
    'group-chat-visible': {
      phase: 'Transcript',
      label: 'Open group chat transcript',
      description: 'Review Agent chat records, delivery receipts, and direct @mention evidence in the group chat transcript.',
      method: 'GET',
      apiPath: projectId ? `/projects/${projectId}/transcripts/main` : '/projects/:projectId/transcripts/main',
      uiTarget: 'group-chat-transcript-index',
    },
    'fixed-continuous-routines': {
      phase: '24/7 Operations',
      label: 'Run 24/7 pulse',
      description: 'Trigger the project autonomous cycle or scheduler so every Agent continues their fixed routine.',
      method: 'POST',
      rerunnable: true,
      apiPath: projectId ? `/projects/${projectId}/autonomous-cycle` : '/projects/:projectId/autonomous-cycle',
      requestBodyTemplate: {
        cadence: project.autonomy?.cadence || 'hourly',
        trigger: 'manager-action-playbook-24-7-pulse',
        source: 'manager-action-playbook',
        now: nowTemplate,
      },
      uiTarget: 'backend-worker-station',
    },
    'midproject-dual-channel-change': {
      phase: 'Change Intake',
      label: 'Broadcast dual-channel change',
      description: 'Send the manager feature request through War Room and Google Chat so both sources are auditable.',
      method: 'POST',
      rerunnable: true,
      apiPath: projectId ? `/projects/${projectId}/change-request` : '/projects/:projectId/change-request',
      requestBodyTemplate: {
        text: '@all add manager-facing feature request from the action playbook',
        channelIds: ['main', 'google_chat'],
        sourceModes: ['war_room_meeting', 'google_chat'],
        ownerId: defaultActionOwner.id || null,
        now: nowTemplate,
      },
      uiTarget: 'manager-change-intake-composer',
    },
    'change-discussion-owner-confirm': {
      phase: 'Change Resolution',
      label: 'Review owner confirmation',
      description: 'Verify Agents discussed the change and the responsible owner confirmed the request.',
      method: 'GET',
      apiPath: projectId ? `/projects/${projectId}/manager-dashboard` : '/projects/:projectId/manager-dashboard',
      uiTarget: 'change-resolution-matrix',
    },
    'owner-plan-and-team-sync': {
      phase: 'Change Sync',
      label: 'Verify owner plan sync',
      description: 'Confirm the owner added the change to their plan and synced it back to every Agent.',
      method: 'GET',
      apiPath: projectId ? `/projects/${projectId}/manager-requirement-matrix` : '/projects/:projectId/manager-requirement-matrix',
      uiTarget: 'change-resolution-matrix',
    },
    'agents-mutually-manage': {
      phase: 'Management Loop',
      label: 'Run management sync',
      description: 'Trigger or inspect peer-management check-ins so Agents can mutually manage one another with timeline proof.',
      method: 'POST',
      rerunnable: true,
      apiPath: projectId && defaultActionOwner.id ? `/projects/${projectId}/agents/${defaultActionOwner.id}/work-cycle` : '/projects/:projectId/agents/:agentId/work-cycle',
      requestBodyTemplate: {
        trigger: 'manager-action-playbook-management-sync',
        cadence: 'management-sync',
        source: 'manager-action-playbook',
        now: nowTemplate,
      },
      uiTarget: 'agent-management-mesh',
    },
  };
  const firstPendingActionIndex = managerRequirementMatrixRows.findIndex((row) => !row.passed);
  const managerActionQueueRows = managerRequirementMatrixRows.map((row, index) => {
    const spec = managerActionSpecs[row.id] || {};
    const status = row.passed ? 'complete' : index === firstPendingActionIndex ? 'ready' : 'blocked';
    const apiPath = spec.apiPath || (projectId ? `/projects/${projectId}/manager-dashboard` : '/projects/:projectId/manager-dashboard');
    const routeResolved = !String(apiPath).includes(':');
    const method = spec.method || 'GET';
    const rerunnable = Boolean(spec.rerunnable);
    const canRun = routeResolved && method !== 'GET' && (status === 'ready' || (status === 'complete' && rerunnable));
    return {
      id: `manager-action-${row.id}`,
      requirementId: row.id,
      phase: spec.phase || 'Scenario',
      label: spec.label || row.requirement,
      description: spec.description || row.requirement,
      status,
      canRun,
      rerunnable,
      method,
      apiPath,
      runApiPath: projectId ? `/projects/${projectId}/manager-action-queue/${row.id}/run` : null,
      routeResolved,
      requestBodyTemplate: spec.requestBodyTemplate || null,
      requestBodyRequired: method !== 'GET',
      context: {
        projectId,
        kickoffMeetingId,
        defaultAgentId: defaultActionOwner.id || null,
        defaultAgentName: defaultActionOwner.name || null,
        requiresKickoffMeetingId: String(apiPath).includes(':meetingId'),
        requiresAgentId: String(apiPath).includes(':agentId'),
      },
      uiTarget: spec.uiTarget || null,
      evidence: row.evidence,
      proofKind: row.proofKind,
      proofIds: row.proofIds || [],
      timelineLogIds: row.timelineLogIds || [],
      channelId: row.channelId || null,
    };
  });
  const nextManagerAction = managerActionQueueRows.find((row) => row.status === 'ready') || null;
  const actionQueueByRequirementId = Object.fromEntries(managerActionQueueRows.map((row) => [row.requirementId, row]));
  const toUseCaseAction = (action) => action ? ({
    id: action.id,
    requirementId: action.requirementId,
    label: action.label,
    status: action.status,
    canRun: Boolean(action.canRun),
    rerunnable: Boolean(action.rerunnable),
    method: action.method,
    apiPath: action.apiPath,
    runApiPath: action.runApiPath,
    routeResolved: action.routeResolved,
  }) : null;
  const managerUseCaseAuditRowsWithActions = managerUseCaseAuditRows.map((row) => {
    const actions = row.requirementIds.map((requirementId) => toUseCaseAction(actionQueueByRequirementId[requirementId])).filter(Boolean);
    const nextAction = actions.find((action) => action.status === 'ready' && action.canRun) || actions.find((action) => action.canRun) || null;
    return {
      ...row,
      actionIds: actions.map((action) => action.id),
      actions,
      runnableActionCount: actions.filter((action) => action.canRun).length,
      nextAction,
    };
  });
  const useCaseAuditById = Object.fromEntries(managerUseCaseAuditRowsWithActions.map((row) => [row.id, row]));
  const walkthroughSpecs = [
    {
      id: 'kickoff-meeting',
      stage: 'Kickoff Meeting',
      managerIntent: 'Brief the project, answer role questions, hear self-nominations, and finalize the roster.',
      useCaseId: 'kickoff-meeting-understanding',
      trailIds: ['kickoff-brief', 'role-and-campaign', 'team-confirmed'],
      primaryRequirementId: 'kickoff-brief-understood',
    },
    {
      id: 'leader-election',
      stage: 'Leader Election',
      managerIntent: 'Let candidates campaign, then confirm the Leader marker.',
      useCaseId: 'leader-election-and-marker',
      trailIds: ['role-and-campaign', 'leader-confirmed'],
      primaryRequirementId: 'leader-election-marker',
    },
    {
      id: 'start-24-7-work',
      stage: '24/7 Work Start',
      managerIntent: 'Confirm next actions and start fixed Agent routines.',
      useCaseId: 'next-actions-to-continuous-work',
      trailIds: ['next-actions-to-autonomy', 'continuous-work'],
      primaryRequirementId: 'fixed-continuous-routines',
    },
    {
      id: 'leader-group-assignment',
      stage: 'Group @Assignment',
      managerIntent: 'Ask the Leader to @assign work and have the assignee start immediately.',
      useCaseId: 'group-chat-assignment-start',
      trailIds: ['leader-assignment'],
      primaryRequirementId: 'leader-group-assignment',
    },
    {
      id: 'progress-visibility',
      stage: 'Progress Visibility',
      managerIntent: 'Confirm work progress reaches the big timeline while chat stays inspectable.',
      useCaseId: 'progress-and-chat-visibility',
      trailIds: ['assignment-progress', 'agent-chat-delivery'],
      primaryRequirementId: 'progress-to-timeline',
    },
    {
      id: 'midproject-change-intake',
      stage: 'Change Intake',
      managerIntent: 'Broadcast a new feature request through the meeting path and Google Chat.',
      useCaseId: 'midproject-change-intake',
      trailIds: ['dual-channel-change'],
      primaryRequirementId: 'midproject-dual-channel-change',
    },
    {
      id: 'owner-confirmation',
      stage: 'Owner Confirmation',
      managerIntent: 'Verify Agents discussed the change and the responsible owner confirmed it.',
      useCaseId: 'change-discussion-owner-confirm',
      trailIds: ['owner-plan-sync'],
      primaryRequirementId: 'change-discussion-owner-confirm',
    },
    {
      id: 'owner-plan-team-sync',
      stage: 'Plan + Team Sync',
      managerIntent: 'Check that the owner added the feature to their plan and synchronized it back to the team.',
      useCaseId: 'owner-plan-team-sync',
      trailIds: ['owner-plan-sync'],
      primaryRequirementId: 'owner-plan-and-team-sync',
    },
    {
      id: 'mutual-agent-management',
      stage: 'Mutual Management',
      managerIntent: 'Run or inspect peer-management check-ins so Agents manage each other continuously.',
      useCaseId: 'mutual-agent-management',
      trailIds: ['management-mesh'],
      primaryRequirementId: 'agents-mutually-manage',
    },
  ];
  const managerScenarioWalkthroughRows = walkthroughSpecs.map((spec, index) => {
    const auditRow = useCaseAuditById[spec.useCaseId] || {};
    const trailRows = spec.trailIds.map((id) => trailById[id]).filter(Boolean);
    const primaryAction = toUseCaseAction(actionQueueByRequirementId[spec.primaryRequirementId])
      || auditRow.nextAction
      || null;
    const actions = uniqueStrings([
      ...(auditRow.actions || []).map((action) => action.requirementId),
      spec.primaryRequirementId,
    ]).map((requirementId) => toUseCaseAction(actionQueueByRequirementId[requirementId])).filter(Boolean);
    const proofIds = uniqueStrings([
      ...(auditRow.proofIds || []),
      ...trailRows.flatMap((row) => row.proofIds || []),
    ]).slice(0, 12);
    const timelineLogIds = uniqueStrings([
      ...(auditRow.timelineLogIds || []),
      ...trailRows.flatMap((row) => row.timelineLogIds || []),
    ]).slice(0, 12);
    const completed = auditRow.status === 'covered' || trailRows.some((row) => row.passed);
    return {
      ...spec,
      sequence: index + 1,
      status: auditRow.status || (completed ? 'covered' : 'missing'),
      completed,
      coveredCount: auditRow.coveredCount || trailRows.filter((row) => row.passed).length,
      requirementCount: auditRow.requirementCount || Math.max(1, trailRows.length),
      evidence: auditRow.evidence || trailRows.map((row) => row.outcome).join(' / '),
      proofKind: timelineLogIds.length && proofIds.length ? 'hybrid' : timelineLogIds.length ? 'timeline' : 'chat',
      proofIds,
      timelineLogIds,
      channelId: auditRow.channelId || trailRows.find((row) => row.channelId)?.channelId || 'main',
      trailIds: spec.trailIds,
      trailRows: trailRows.map((row) => ({
        id: row.id,
        stage: row.stage,
        outcome: row.outcome,
        passed: row.passed,
      })),
      actionIds: actions.map((action) => action.id),
      actions,
      primaryAction,
      runnableActionCount: actions.filter((action) => action.canRun).length,
      managerRoute: projectId ? `/projects/${projectId}/manager-scenario-walkthrough#${spec.id}` : null,
      runApiPath: projectId ? `/projects/${projectId}/manager-scenario-walkthrough/${spec.id}/run` : null,
    };
  });
  const nextIncompleteWalkthroughStep = managerScenarioWalkthroughRows.find((row) => !row.completed) || null;
  const nextRunnableWalkthroughStep = managerScenarioWalkthroughRows.find((row) => !row.completed && row.primaryAction?.canRun)
    || managerScenarioWalkthroughRows.find((row) => row.primaryAction?.canRun)
    || null;
  const nextWalkthroughStep = nextIncompleteWalkthroughStep || nextRunnableWalkthroughStep || null;
  const managerActionRunRows = (project.managerActionRunLedger || []).slice(0, 12).map((run) => ({
    ...run,
    actionLabel: run.actionLabel || run.label || run.requirementId || run.actionId,
    routeLabel: run.runApiPath || run.apiPath || '',
    timelineLogIds: uniqueStrings([run.logId, ...(run.timelineLogIds || [])]),
    eventIds: uniqueStrings([run.eventId, ...(run.eventIds || [])]),
  }));
  const managerCommandPrimaryAction = nextRunnableWalkthroughStep?.primaryAction
    || nextManagerAction
    || managerScenarioWalkthroughRows.find((row) => row.primaryAction?.canRun)?.primaryAction
    || null;
  const managerCommandAttentionRows = [
    ...(managerCommandPrimaryAction ? [{
      id: `next-action-${managerCommandPrimaryAction.requirementId || managerCommandPrimaryAction.id}`,
      type: 'next-action',
      severity: 'action',
      title: managerCommandPrimaryAction.label || 'Run next manager action',
      detail: managerCommandPrimaryAction.description || managerCommandPrimaryAction.apiPath || 'Ready manager action available.',
      actionId: managerCommandPrimaryAction.id,
      requirementId: managerCommandPrimaryAction.requirementId || null,
      canRun: Boolean(managerCommandPrimaryAction.canRun),
      runApiPath: managerCommandPrimaryAction.runApiPath || null,
      uiTarget: managerCommandPrimaryAction.uiTarget || null,
    }] : []),
    ...syncProtocolRows
      .filter((row) => !row.complete)
      .slice(0, 4)
      .map((row) => ({
        id: `protocol-${row.id}`,
        type: 'sync-protocol',
        severity: row.status === 'waiting' ? 'critical' : 'watch',
        title: row.protocol,
        detail: `${row.passedCount}/${row.totalCount} sync checks passed: ${row.managerMeaning}`,
        proofIds: row.proofIds || [],
        timelineLogIds: row.timelineLogIds || [],
        uiTarget: 'sync-protocol-audit',
      })),
    ...operationsAgents
      .filter((agent) => agent.openObligationCount > 0 || !agent.nextRunAt)
      .slice(0, 4)
      .map((agent) => ({
        id: `agent-${agent.agentId}`,
        type: 'agent',
        severity: agent.openObligationCount > 0 ? 'watch' : 'critical',
        title: agent.name,
        detail: agent.openObligationCount > 0
          ? `${agent.openObligationCount} open obligation(s); routine ${agent.routine?.label || agent.currentPlan?.routine?.label || 'active'}`
          : 'No next run scheduled for this Agent.',
        agentId: agent.agentId,
        uiTarget: agent.dashboardPath || 'agent-focus-workspace',
      })),
    ...changeFlowRows
      .filter((row) => !row.ownerPlanLinked || !row.teamSyncCount)
      .slice(0, 3)
      .map((row) => ({
        id: `change-${row.changeId}`,
        type: 'change',
        severity: !row.ownerPlanLinked ? 'critical' : 'watch',
        title: row.requestText || 'Change request',
        detail: `${row.ownerName || 'Owner'} ${row.ownerPlanLinked ? 'has a plan' : 'needs to add this to plan'} / team sync ${row.teamSyncCount || 0}`,
        changeId: row.changeId,
        proofIds: uniqueStrings([row.requestMessageId, ...(row.sourceMessageIds || []), ...(row.discussionMessageIds || []), row.confirmationMessageId, row.syncMessageId]),
        timelineLogIds: uniqueStrings([...(row.timelineLogIds || []), ...(row.ownerWorkTimelineLogIds || [])]),
        uiTarget: 'change-resolution-matrix',
      })),
  ].slice(0, 10);
  const managerCommandAgentRows = operationsAgents.map((agent) => {
    const state = agentStates[agent.agentId] || {};
    const latestInbox = state.inbox?.[0] || agent.latestInbox || null;
    const latestObligation = (state.obligations || []).find((item) => item.status !== 'done' && item.status !== 'resolved')
      || state.obligations?.[0]
      || null;
    const latestWorklog = state.worklog?.[0] || agent.latestWorklog || null;
    const directReceiptMessageId = latestInbox?.sourceMessageId || latestInbox?.messageId || null;
    const obligationMessageId = latestObligation?.sourceMessageId || latestObligation?.messageId || null;
    const worklogMessageId = latestWorklog?.sourceMessageId || latestWorklog?.messageId || null;
    const workMatchesLatestSignal = Boolean(
      latestWorklog
      && (
        (latestObligation?.taskId && latestWorklog.taskId === latestObligation.taskId)
        || (latestInbox?.taskId && latestWorklog.taskId === latestInbox.taskId)
        || [directReceiptMessageId, obligationMessageId].filter(Boolean).some((id) => (
          id === worklogMessageId
          || (latestWorklog.sourceMessageIds || []).includes(id)
          || (latestWorklog.responseMessageIds || []).includes(id)
        ))
        || (latestInbox && latestObligation)
      )
    );
    const receiptState = latestInbox && latestObligation && workMatchesLatestSignal
      ? 'received-and-working'
      : latestInbox && latestObligation
        ? 'received-obligated'
        : latestInbox
          ? 'received'
          : 'waiting';
    return {
      agentId: agent.agentId,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      routineLabel: agent.currentPlan?.routine?.label || agent.routine?.label || 'fixed routine',
      focus: agent.currentPlan?.focus || latestWorklog?.text || 'monitor project lane',
      nextRunAt: agent.nextRunAt,
      lastRunAt: agent.lastRunAt,
      openObligationCount: agent.openObligationCount,
      managementPriority: agent.managementPriority || 0,
      latestInbox,
      latestObligation,
      latestWorklog,
      receiptState,
      receivedLatestSignal: Boolean(latestInbox),
      obligatedLatestSignal: Boolean(latestObligation),
      workingLatestSignal: workMatchesLatestSignal,
      inboxProofIds: uniqueStrings([directReceiptMessageId]),
      obligationProofIds: uniqueStrings([obligationMessageId]),
      workProofIds: uniqueStrings([
        worklogMessageId,
        ...(latestWorklog?.sourceMessageIds || []),
        ...(latestWorklog?.responseMessageIds || []),
      ]),
      timelineLogIds: uniqueStrings(latestWorklog?.timelineLogIds || []),
      needsAttention: Boolean(agent.openObligationCount > 0 || !agent.nextRunAt || (agent.managementPriority || 0) > 0 || !latestInbox),
      dashboardPath: agent.dashboardPath,
    };
  });
  const managerCommandChangeRows = changeFlowRows.slice(0, 5).map((row) => {
    const sourceReady = Boolean(row.requestMessageId || row.sourceMessageIds?.length);
    const discussed = row.discussionMessageIds?.length > 0;
    const ownerConfirmed = Boolean(row.confirmationMessageId);
    const teamSynced = row.teamSyncCount > 0;
    const teamSyncComplete = team.length > 1
      ? row.teamSyncCount >= Math.max(1, team.length - 1)
      : row.teamSyncCount > 0;
    const ownerWorkStarted = Boolean(row.ownerWorkStarted);
    const checks = [sourceReady, discussed, ownerConfirmed, row.ownerPlanLinked, teamSynced, ownerWorkStarted];
    const passedCount = checks.filter(Boolean).length;
    return {
      changeId: row.changeId,
      taskId: row.taskId,
      requestText: row.requestText,
      ownerId: row.ownerId,
      ownerName: row.ownerName || agentNameById[row.ownerId] || row.ownerId || 'Owner pending',
      source: row.source,
      sourceChannelId: row.sourceChannelId,
      sourceChannelIds: row.sourceChannelIds || [],
      sourceModeLabels: row.sourceModeLabels || [],
      sourceReady,
      discussed,
      ownerConfirmed,
      ownerPlanLinked: Boolean(row.ownerPlanLinked),
      teamSynced,
      teamSyncComplete,
      ownerWorkStarted,
      discussionCount: row.discussionMessageIds?.length || 0,
      discussionDeliveryCount: row.discussionDeliveryCount || 0,
      discussionObligationCount: row.discussionObligationCount || 0,
      teamSyncCount: row.teamSyncCount || 0,
      syncedAgentNames: row.syncedAgentNames || [],
      status: passedCount === checks.length
        ? 'synced'
        : ownerConfirmed && row.ownerPlanLinked
          ? 'owner-plan-ready'
          : discussed
            ? 'awaiting-owner-confirmation'
            : sourceReady
              ? 'discussion-open'
              : 'waiting',
      passedCount,
      totalCount: checks.length,
      proofIds: uniqueStrings([
        row.requestMessageId,
        ...(row.sourceMessageIds || []),
        ...(row.discussionMessageIds || []),
        row.confirmationMessageId,
        row.syncMessageId,
        ...(row.ownerWorkMessageIds || []),
      ]),
      timelineLogIds: uniqueStrings([
        ...(row.timelineLogIds || []),
        ...(row.ownerWorkTimelineLogIds || []),
      ]),
    };
  });
  const dualChannelChangeRows = changeFlowRows.filter((row) => (
    (row.sourceChannelIds || []).length > 1
    || ((row.sourceChannelIds || []).includes('main') && (row.sourceChannelIds || []).includes('google_chat'))
  ));
  const dualChannelSourceRows = changeSourceIntakeRows.filter((row) => row.sourceChannelCount > 1);
  const changeDiscussionRows = changeFlowRows.filter((row) => row.discussionMessageIds?.length > 0);
  const changeOwnerConfirmedRows = changeFlowRows.filter((row) => row.confirmationMessageId);
  const changeOwnerPlanRows = changeFlowRows.filter((row) => row.ownerPlanLinked);
  const changeTeamSyncRows = changeFlowRows.filter((row) => row.teamSyncCount > 0);
  const changeOwnerWorkRows = changeFlowRows.filter((row) => row.ownerWorkStarted);
  const managerCommandChangeProtocolRows = [
    {
      id: 'dual-channel-source',
      label: 'War Room + Google Chat',
      status: dualChannelSourceRows.some((row) => row.channelId === 'google_chat' && row.sourceMessageId) && dualChannelSourceRows.some((row) => row.channelId === 'main' && row.sourceMessageId) ? 'source-proofed' : dualChannelSourceRows.length ? 'partial' : 'waiting',
      detail: `${dualChannelChangeRows.length} unified dual-channel change(s) / ${dualChannelSourceRows.filter((row) => row.sourceMessageId).length} source message(s)`,
      passed: dualChannelSourceRows.some((row) => row.channelId === 'google_chat' && row.sourceMessageId) && dualChannelSourceRows.some((row) => row.channelId === 'main' && row.sourceMessageId),
      proofIds: uniqueStrings(dualChannelSourceRows.map((row) => row.sourceMessageId)).slice(0, 8),
      timelineLogIds: [],
      channelId: 'google_chat',
    },
    {
      id: 'team-discussion',
      label: 'Team Discussion',
      status: changeDiscussionRows.some((row) => row.discussionDeliveryCount > 0 && row.discussionObligationCount > 0) ? 'discussed' : changeDiscussionRows.length ? 'active' : 'waiting',
      detail: `${changeDiscussionRows.length}/${changeFlowRows.length} change(s) have Agent discussion; ${changeDiscussionRows.reduce((sum, row) => sum + (row.discussionDeliveryCount || 0), 0)} receipt(s)`,
      passed: changeDiscussionRows.some((row) => row.discussionDeliveryCount > 0 && row.discussionObligationCount > 0),
      proofIds: uniqueStrings(changeDiscussionRows.flatMap((row) => row.discussionMessageIds || [])).slice(0, 8),
      timelineLogIds: [],
      channelId: 'main',
    },
    {
      id: 'owner-confirmation',
      label: 'Owner Confirmation',
      status: changeOwnerConfirmedRows.length ? 'confirmed' : 'waiting',
      detail: `${changeOwnerConfirmedRows.length}/${changeFlowRows.length} owner confirmation(s)`,
      passed: changeOwnerConfirmedRows.length > 0,
      proofIds: uniqueStrings(changeOwnerConfirmedRows.map((row) => row.confirmationMessageId)).slice(0, 8),
      timelineLogIds: [],
      channelId: 'main',
    },
    {
      id: 'owner-plan',
      label: 'Owner Plan Updated',
      status: changeOwnerPlanRows.length ? 'plan-linked' : 'waiting',
      detail: `${changeOwnerPlanRows.length}/${changeFlowRows.length} change(s) linked into owner plan`,
      passed: changeOwnerPlanRows.length > 0,
      proofIds: uniqueStrings(changeOwnerPlanRows.flatMap((row) => [row.confirmationMessageId, row.syncMessageId])).slice(0, 8),
      timelineLogIds: uniqueStrings(changeOwnerPlanRows.flatMap((row) => row.timelineLogIds || [])).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'team-resync',
      label: 'Team Resync',
      status: changeTeamSyncRows.some((row) => row.teamSyncComplete) ? 'team-synced' : changeTeamSyncRows.length ? 'partial' : 'waiting',
      detail: `${changeTeamSyncRows.reduce((sum, row) => sum + (row.teamSyncCount || 0), 0)} Agent sync receipt(s) across ${changeTeamSyncRows.length} change(s)`,
      passed: changeTeamSyncRows.some((row) => row.teamSyncComplete || row.teamSyncCount > 0),
      proofIds: uniqueStrings(changeTeamSyncRows.map((row) => row.syncMessageId)).slice(0, 8),
      timelineLogIds: uniqueStrings(changeTeamSyncRows.flatMap((row) => row.timelineLogIds || [])).slice(0, 8),
      channelId: 'main',
    },
    {
      id: 'owner-work',
      label: 'Owner Work Started',
      status: changeOwnerWorkRows.length ? 'working' : 'waiting',
      detail: `${changeOwnerWorkRows.length}/${changeFlowRows.length} owner work pulse(s) started`,
      passed: changeOwnerWorkRows.length > 0,
      proofIds: uniqueStrings(changeOwnerWorkRows.flatMap((row) => row.ownerWorkMessageIds || [])).slice(0, 8),
      timelineLogIds: uniqueStrings(changeOwnerWorkRows.flatMap((row) => row.ownerWorkTimelineLogIds || [])).slice(0, 8),
      channelId: 'main',
    },
  ];
  const managerCommandChangeProtocolBoard = {
    count: managerCommandChangeProtocolRows.length,
    readyCount: managerCommandChangeProtocolRows.filter((row) => row.passed).length,
    dualChannelCount: dualChannelChangeRows.length,
    sourceReadyCount: dualChannelSourceRows.filter((row) => row.sourceMessageId && row.receiptCount > 0).length,
    discussionCount: changeDiscussionRows.length,
    ownerConfirmedCount: changeOwnerConfirmedRows.length,
    ownerPlanCount: changeOwnerPlanRows.length,
    teamSyncCount: changeTeamSyncRows.length,
    ownerWorkCount: changeOwnerWorkRows.length,
    status: managerCommandChangeProtocolRows.every((row) => row.passed)
      ? 'synced'
      : managerCommandChangeProtocolRows.some((row) => row.passed)
        ? 'active'
        : 'waiting',
    rows: managerCommandChangeProtocolRows,
  };
  const startupRowsByAgentId = Object.fromEntries((kickoffExecutionFlow?.allAgentStartupRows || [])
    .filter((row) => row.agentId)
    .map((row) => [row.agentId, row]));
  const managerCommandWorkLoopRows = continuousWorkLoopRows.map((row) => {
    const startup = startupRowsByAgentId[row.agentId] || {};
    const routineReady = Boolean(row.routineLabel || startup.hasRoutinePlan);
    const firstPulseReady = Boolean(startup.hasFirstPulsePlan || startup.hasWorkerStartup || row.lastRunAt);
    const scheduled = Boolean(row.nextRunAt || startup.nextRunAt);
    const timelineReady = Boolean((row.timelineLogIds || []).length || (startup.proofLogIds || []).length);
    const proofReady = Boolean(row.proofReady || timelineReady || firstPulseReady);
    return {
      agentId: row.agentId,
      name: row.name,
      role: row.role,
      loopState: row.loopState,
      routineLabel: row.routineLabel || startup.routineLabel || 'fixed routine',
      focus: row.focus || startup.planFocus || 'monitor project lane',
      nextStep: row.nextStep || 'publish the next proof marker',
      nextRunAt: row.nextRunAt || startup.nextRunAt || null,
      lastRunAt: row.lastRunAt || null,
      trigger: row.trigger || startup.status || 'waiting',
      scheduled,
      routineReady,
      firstPulseReady,
      proofReady,
      timelineReady,
      startupProofTypes: startup.startupProofTypes || [],
      chatProofIds: row.chatProofIds || [],
      timelineLogIds: uniqueStrings([
        ...(row.timelineLogIds || []),
        ...(startup.proofLogIds || []),
      ]).slice(0, 8),
      status: scheduled && routineReady && proofReady
        ? 'running'
        : scheduled
          ? 'scheduled'
          : proofReady
            ? 'needs-schedule'
            : 'waiting',
    };
  });
  const managerCommandWorkLoopBoard = {
    count: managerCommandWorkLoopRows.length,
    runningCount: managerCommandWorkLoopRows.filter((row) => row.status === 'running').length,
    scheduledCount: managerCommandWorkLoopRows.filter((row) => row.scheduled).length,
    routineCount: managerCommandWorkLoopRows.filter((row) => row.routineReady).length,
    proofedCount: managerCommandWorkLoopRows.filter((row) => row.proofReady).length,
    timelineProofCount: managerCommandWorkLoopRows.reduce((sum, row) => sum + (row.timelineLogIds?.length || 0), 0),
    status: managerCommandWorkLoopRows.length && managerCommandWorkLoopRows.every((row) => row.status === 'running')
      ? 'running'
      : managerCommandWorkLoopRows.some((row) => row.scheduled)
        ? 'active'
        : 'waiting',
    rows: managerCommandWorkLoopRows,
  };
  const leaderAssignmentTimelineLogIds = uniqueStrings(assignmentFlowRows.flatMap((row) => row.evidence?.timelineIds || []));
  const leaderAssignmentProofIds = uniqueStrings(assignmentFlowRows.flatMap((row) => row.evidence?.chatIds || []));
  const agentMessageProofIds = uniqueStrings(agentCommunicationRows.flatMap((row) => row.proofIds || []));
  const peerHandoffProofIds = uniqueStrings((project.peerHandoffs || []).flatMap((handoff) => [
    handoff.requestMessageId,
    handoff.acknowledgementMessageId,
  ]));
  const peerHandoffTimelineLogIds = uniqueStrings((project.logs || [])
    .filter((log) => ['peer-handoff', 'peer-handoff-ack'].includes(log.eventType))
    .map((log) => log.id));
  const managementTimelineLogIds = uniqueStrings(managementMeshRows.flatMap((row) => row.proofLogIds || []));
  const managerCommandCollaborationRows = [
    {
      id: 'leader-assignments',
      label: 'Leader @Assignments',
      status: assignmentFlowRows.length && assignmentFlowRows.some((row) => row.inboxSeen && row.workSeen && row.timelineSeen) ? 'synced' : assignmentFlowRows.length ? 'active' : 'waiting',
      detail: `${assignmentFlowRows.filter((row) => row.inboxSeen).length}/${assignmentFlowRows.length} assignees saw group @assignments`,
      passed: assignmentFlowRows.some((row) => row.inboxSeen && row.workSeen && row.timelineSeen),
      proofIds: leaderAssignmentProofIds.slice(0, 8),
      timelineLogIds: leaderAssignmentTimelineLogIds.slice(0, 8),
    },
    {
      id: 'agent-messages',
      label: 'Agent Message Delivery',
      status: agentCommunicationRows.length && agentMessageDeliveryRows.some((row) => row.receiptSeen && row.inboxSeen && row.senderWorklogSeen) ? 'delivered' : agentCommunicationRows.length ? 'active' : 'waiting',
      detail: `${agentMessageDeliveryRows.filter((row) => row.receiptSeen && row.inboxSeen).length}/${agentMessageDeliveryRows.length} direct deliveries reached inbox`,
      passed: agentMessageDeliveryRows.some((row) => row.receiptSeen && row.inboxSeen && row.senderWorklogSeen),
      proofIds: agentMessageProofIds.slice(0, 8),
      timelineLogIds: [],
    },
    {
      id: 'peer-handoffs',
      label: 'Peer Handoffs',
      status: (project.peerHandoffs || []).some((handoff) => handoff.status === 'accepted') ? 'accepted' : (project.peerHandoffs || []).length ? 'active' : 'waiting',
      detail: `${(project.peerHandoffs || []).filter((handoff) => handoff.status === 'accepted').length}/${project.peerHandoffs?.length || 0} peer dependencies accepted`,
      passed: (project.peerHandoffs || []).some((handoff) => handoff.status === 'accepted'),
      proofIds: peerHandoffProofIds.slice(0, 8),
      timelineLogIds: peerHandoffTimelineLogIds.slice(0, 8),
    },
    {
      id: 'mutual-management',
      label: 'Mutual Management',
      status: peerManagementMatrixRows.length === team.length && managementMeshRows.some((row) => row.checkInCount > 0 && row.responseCount > 0) ? 'managed' : peerManagementMatrixRows.length ? 'mapped' : 'waiting',
      detail: `${peerManagementMatrixRows.filter((row) => row.peerManagedIds?.length && row.peerManagerIds?.length).length}/${team.length} peer manager links mapped`,
      passed: peerManagementMatrixRows.length === team.length && peerManagementMatrixRows.every((row) => row.peerManagedIds?.length && row.peerManagerIds?.length),
      proofIds: [],
      timelineLogIds: managementTimelineLogIds.slice(0, 8),
    },
  ];
  const managerCommandCollaborationBoard = {
    count: managerCommandCollaborationRows.length,
    readyCount: managerCommandCollaborationRows.filter((row) => row.passed).length,
    assignmentCount: assignmentFlowRows.length,
    agentMessageCount: agentCommunicationRows.length,
    deliveredMessageCount: agentMessageDeliveryRows.filter((row) => row.receiptSeen && row.inboxSeen).length,
    peerHandoffCount: project.peerHandoffs?.length || 0,
    managementLinkCount: peerManagementMatrixRows.filter((row) => row.peerManagedIds?.length && row.peerManagerIds?.length).length,
    status: managerCommandCollaborationRows.every((row) => row.passed)
      ? 'synced'
      : managerCommandCollaborationRows.some((row) => row.passed)
        ? 'active'
        : 'waiting',
    rows: managerCommandCollaborationRows,
  };
  const managerCommandKickoffRows = [
    {
      id: 'project-brief',
      label: 'Project Brief Heard',
      passed: Boolean(kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length),
      detail: `${kickoffMeetingFlow?.briefAlignment?.heardByAgentIds?.length || 0}/${team.length} Agents heard the Director brief`,
      proofIds: kickoffMeetingFlow?.briefAlignment?.proofIds || kickoffMeetingFlow?.proofIds || [],
      timelineLogIds: [],
    },
    {
      id: 'role-questions',
      label: 'Role Questions Answered',
      passed: Boolean((kickoffMeetingFlow?.roleQuestionCount || 0) > 0 && (kickoffMeetingFlow?.roleQuestionUnansweredCount || 0) === 0),
      detail: `${kickoffMeetingFlow?.roleQuestionAnsweredCount || 0}/${kickoffMeetingFlow?.roleQuestionCount || 0} role questions answered`,
      proofIds: kickoffMeetingFlow?.roleQuestionResolutions?.flatMap((row) => [row.questionId, ...(row.answerIds || [])]) || kickoffMeetingFlow?.proofIds || [],
      timelineLogIds: [],
    },
    {
      id: 'self-nominations',
      label: 'Self Nominations Heard',
      passed: Boolean((kickoffMeetingFlow?.selfNominationCount || 0) > 0),
      detail: `${kickoffMeetingFlow?.selfNominationCount || 0} self-nomination turn(s)`,
      proofIds: (kickoffMeetingFlow?.conversationRows || [])
        .filter((row) => row.stage === 'self-nomination')
        .flatMap((row) => row.proofIds || []),
      timelineLogIds: [],
    },
    {
      id: 'leader-campaign',
      label: 'Leader Campaign',
      passed: Boolean((kickoffMeetingFlow?.leaderCampaignCount || 0) > 0 && (kickoffMeetingFlow?.leaderCandidateNames || []).length > 0),
      detail: `${kickoffMeetingFlow?.leaderCampaignCount || 0} campaign turn(s) / ${(kickoffMeetingFlow?.leaderCandidateNames || []).slice(0, 3).join(', ') || 'no candidates'}`,
      proofIds: (kickoffMeetingFlow?.conversationRows || [])
        .filter((row) => row.stage === 'leader-campaign')
        .flatMap((row) => row.proofIds || []),
      timelineLogIds: [],
    },
    {
      id: 'team-confirmed',
      label: 'Team Confirmed',
      passed: Boolean(kickoffMeetingFlow?.confirmedTeamMatrixRows?.length && kickoffMeetingFlow.confirmedTeamMatrixRows.every((row) => row.inProjectState && row.inKickoffCharter)),
      detail: `${kickoffMeetingFlow?.confirmedTeamMatrixRows?.filter((row) => row.inProjectState && row.inKickoffCharter).length || 0}/${kickoffMeetingFlow?.confirmedTeamMatrixRows?.length || team.length} roster rows persisted`,
      proofIds: [],
      timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
    },
    {
      id: 'leader-marker',
      label: 'Leader Marker',
      passed: Boolean(kickoffMeetingFlow?.leaderMarkerPersisted),
      detail: kickoffMeetingFlow?.confirmedLeaderName || 'Leader pending',
      proofIds: kickoffMeetingFlow?.leaderElectionResolution?.campaignIds || [],
      timelineLogIds: kickoffMeetingFlow?.confirmedTeamProofLogIds || [],
    },
    {
      id: 'next-actions',
      label: 'Next Actions Confirmed',
      passed: Boolean(kickoffExecutionFlow?.nextActionResolution?.managerConfirmed && kickoffExecutionFlow?.nextActions?.length > 0),
      detail: `${kickoffExecutionFlow?.nextActions?.length || 0} first execution action(s) / receipts ${kickoffExecutionFlow?.nextActionResolutionDelivery?.deliveredAgentIds?.length || 0}-${kickoffExecutionFlow?.nextActionResolutionDelivery?.teamCount || team.length}`,
      proofIds: [nextActionDecisionMessageId].filter(Boolean),
      timelineLogIds: kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
    },
  ].map((row) => ({
    ...row,
    proofIds: uniqueStrings(row.proofIds || []).slice(0, 8),
    timelineLogIds: uniqueStrings(row.timelineLogIds || []).slice(0, 8),
  }));
  const managerCommandKickoffBoard = {
    count: managerCommandKickoffRows.length,
    readyCount: managerCommandKickoffRows.filter((row) => row.passed).length,
    status: managerCommandKickoffRows.every((row) => row.passed) ? 'ready' : managerCommandKickoffRows.some((row) => row.passed) ? 'active' : 'waiting',
    leaderName: kickoffMeetingFlow?.confirmedLeaderName || null,
    nextActionCount: kickoffExecutionFlow?.nextActions?.length || 0,
    rows: managerCommandKickoffRows,
  };
  const managerCommandLiveLanes = [
    {
      id: 'kickoff',
      label: 'Kickoff',
      status: kickoffMeetingFlow?.leaderMarkerPersisted ? 'ready' : kickoffMeetingFlow ? 'active' : 'waiting',
      detail: kickoffMeetingFlow
        ? `${kickoffMeetingFlow.roleQuestionCount || 0} questions / ${kickoffMeetingFlow.leaderCampaignCount || 0} leader campaigns`
        : 'Kickoff meeting not started.',
      proofCount: kickoffMeetingFlow?.proofIds?.length || 0,
      route: kickoffMeetingRoute(),
    },
    {
      id: 'group-chat',
      label: 'Group Chat',
      status: transcriptIndex.channels?.find((channel) => channel.channelId === 'main')?.messageCount ? 'active' : 'waiting',
      detail: `${transcriptIndex.channels?.find((channel) => channel.channelId === 'main')?.messageCount || 0} messages with receipts`,
      proofCount: transcriptIndex.channels?.find((channel) => channel.channelId === 'main')?.messageCount || 0,
      route: projectId ? `/projects/${projectId}/transcripts/main` : null,
    },
    {
      id: 'google-chat',
      label: 'Google Chat',
      status: changeSourceIntakeRows.some((row) => row.channelId === 'google_chat' && row.sourceMessageId) ? 'active' : 'waiting',
      detail: `${changeSourceIntakeRows.filter((row) => row.channelId === 'google_chat' && row.sourceMessageId).length} change source row(s)`,
      proofCount: changeSourceIntakeRows.filter((row) => row.channelId === 'google_chat' && row.sourceMessageId).length,
      route: projectId ? `/projects/${projectId}/transcripts/google_chat` : null,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      status: (project.logs || []).length ? 'active' : 'waiting',
      detail: `${project.logs?.length || 0} timeline logs / ${project.eventLedger?.length || 0} ledger events`,
      proofCount: project.logs?.length || 0,
      route: projectId ? `/projects/${projectId}/timeline` : null,
    },
    {
      id: 'workers',
      label: '24/7 Workers',
      status: continuousWorkLoopRows.some((row) => row.nextRunAt) ? 'active' : 'waiting',
      detail: `${continuousWorkLoopRows.filter((row) => row.nextRunAt).length}/${continuousWorkLoopRows.length} Agents scheduled`,
      proofCount: continuousWorkLoopRows.filter((row) => row.proofReady).length,
      route: projectId ? `/projects/${projectId}/autonomous-cycle` : null,
    },
  ];
  const managerCommandCenter = {
    status: managerCommandAttentionRows.some((row) => row.severity === 'critical')
      ? 'needs-action'
      : managerCommandPrimaryAction?.canRun
        ? 'action-ready'
        : syncProtocolAudit.status === 'synced'
          ? 'live'
          : 'watch',
    headline: nextWalkthroughStep
      ? `Current stage: ${nextWalkthroughStep.stage}`
      : 'All core scenario stages are covered.',
    currentStage: nextWalkthroughStep?.stage || 'Live Operations',
    nextBestAction: managerCommandPrimaryAction,
    nextBestActionLabel: managerCommandPrimaryAction?.label || 'Keep monitoring live operations',
    nextBestActionRunApiPath: managerCommandPrimaryAction?.runApiPath || null,
    attentionCount: managerCommandAttentionRows.length,
    criticalCount: managerCommandAttentionRows.filter((row) => row.severity === 'critical').length,
    stats: {
      scenarioTrail: `${managerScenarioTrailRows.filter((row) => row.passed).length}/${managerScenarioTrailRows.length}`,
      walkthrough: `${managerScenarioWalkthroughRows.filter((row) => row.completed).length}/${managerScenarioWalkthroughRows.length}`,
      syncProtocols: `${syncProtocolAudit.syncedCount}/${syncProtocolAudit.count}`,
      actionQueue: `${managerActionQueueRows.filter((row) => row.status === 'complete').length}/${managerActionQueueRows.length}`,
      agentsScheduled: `${continuousWorkLoopRows.filter((row) => row.nextRunAt).length}/${continuousWorkLoopRows.length}`,
      openTasks: (project.tasks || []).filter((task) => task.status !== 'done').length,
      changeRequests: changeFlowRows.length,
    },
    attentionRows: managerCommandAttentionRows,
    liveLanes: managerCommandLiveLanes,
    kickoffBoard: managerCommandKickoffBoard,
    workLoopBoard: managerCommandWorkLoopBoard,
    collaborationBoard: managerCommandCollaborationBoard,
    changeProtocolBoard: managerCommandChangeProtocolBoard,
    agentRows: managerCommandAgentRows,
    changeRows: managerCommandChangeRows,
    changeReadyCount: managerCommandChangeRows.filter((row) => row.status === 'synced').length,
    recentEvidenceRows: [
      ...managerActionRunRows.slice(0, 3).map((run) => ({
        id: run.id,
        type: 'manager-action-run',
        label: run.actionLabel,
        detail: run.routeLabel,
        time: run.executedAt || run.time,
        proofIds: run.resultMessageIds || [],
        timelineLogIds: run.timelineLogIds || [],
      })),
      ...(project.logs || []).slice(0, 3).map((log) => ({
        id: log.id,
        type: log.eventType || 'timeline-log',
        label: log.agent || log.actor || 'Timeline',
        detail: log.log || log.text || '',
        time: log.time,
        proofIds: [],
        timelineLogIds: [log.id].filter(Boolean),
      })),
    ].slice(0, 6),
  };

  return {
    projectId,
    project: {
      id: projectId,
      name: project.name || '',
      status: project.status || '',
      autonomy: project.autonomy || {},
      agentAutonomy: project.agentAutonomy || {},
      teamCount: team.length,
      taskCount: project.tasks?.length || 0,
      openTaskCount: (project.tasks || []).filter((task) => task.status !== 'done').length,
      messageCount: projectMessages.length,
      logCount: project.logs?.length || 0,
      nextAutonomousRunAt: project.nextAutonomousRunAt || null,
      lastAutonomousRunAt: project.lastAutonomousRunAt || null,
    },
    readiness: readinessProofMap.readiness,
    readinessProofMap,
    managerCommandCenter,
    managerScenarioTrail: {
      count: managerScenarioTrailRows.length,
      passedCount: managerScenarioTrailRows.filter((row) => row.passed).length,
      rows: managerScenarioTrailRows,
    },
    managerScenarioWalkthrough: {
      count: managerScenarioWalkthroughRows.length,
      completedCount: managerScenarioWalkthroughRows.filter((row) => row.completed).length,
      runnableCount: managerScenarioWalkthroughRows.reduce((sum, row) => sum + row.runnableActionCount, 0),
      status: managerScenarioWalkthroughRows.every((row) => row.completed) ? 'covered' : 'needs-attention',
      nextStepId: nextWalkthroughStep?.id || null,
      nextStep: nextWalkthroughStep,
      nextIncompleteStepId: nextIncompleteWalkthroughStep?.id || null,
      nextIncompleteStep: nextIncompleteWalkthroughStep,
      nextRunnableStepId: nextRunnableWalkthroughStep?.id || null,
      nextRunnableStep: nextRunnableWalkthroughStep,
      rows: managerScenarioWalkthroughRows,
    },
    managerRequirementMatrix: {
      count: managerRequirementMatrixRows.length,
      passedCount: managerRequirementMatrixRows.filter((row) => row.passed).length,
      rows: managerRequirementMatrixRows,
    },
    syncProtocolAudit,
    managerUseCaseAudit: {
      count: managerUseCaseAuditRowsWithActions.length,
      coveredCount: managerUseCaseAuditRowsWithActions.filter((row) => row.covered).length,
      partialCount: managerUseCaseAuditRowsWithActions.filter((row) => row.status === 'partial').length,
      missingCount: managerUseCaseAuditRowsWithActions.filter((row) => row.status === 'missing').length,
      runnableActionCount: managerUseCaseAuditRowsWithActions.reduce((sum, row) => sum + row.runnableActionCount, 0),
      status: managerUseCaseAuditRowsWithActions.every((row) => row.covered) ? 'covered' : 'needs-attention',
      rows: managerUseCaseAuditRowsWithActions,
    },
    managerActionQueue: {
      count: managerActionQueueRows.length,
      completedCount: managerActionQueueRows.filter((row) => row.status === 'complete').length,
      readyCount: managerActionQueueRows.filter((row) => row.status === 'ready').length,
      blockedCount: managerActionQueueRows.filter((row) => row.status === 'blocked').length,
      unresolvedRouteCount: managerActionQueueRows.filter((row) => !row.routeResolved).length,
      nextActionId: nextManagerAction?.id || null,
      nextAction: nextManagerAction,
      rows: managerActionQueueRows,
    },
    managerActionRuns: {
      count: project.managerActionRunLedger?.length || 0,
      latestRun: managerActionRunRows[0] || null,
      rows: managerActionRunRows,
    },
    managerActionContext: {
      projectId,
      kickoffMeetingId,
      kickoffMeetingResolved: Boolean(kickoffMeetingId),
    },
    transcriptIndex,
    latestMessages: projectMessages.slice(-20),
    timeline: {
      logCount: project.logs?.length || 0,
      latestLogs: (project.logs || []).slice(0, 20),
      eventLedgerSummary,
      latestEventLedgerEvents: (project.eventLedger || []).slice(0, 20),
    },
    operationsBoard: {
      projectNextRunAt: project.nextAutonomousRunAt || latestSchedulerRecord?.nextRunAt || null,
      projectLastRunAt: project.lastAutonomousRunAt || latestSchedulerRecord?.ranAt || null,
      latestProjectCycle,
      latestSchedulerRecord,
      agentRunQueueCount: operationsAgents.filter((agent) => agent.nextRunAt).length,
      agents: operationsAgents,
    },
    continuousWorkLoop: {
      schedulerState: latestSchedulerRecord ? 'scheduler-evidence' : project.autonomy?.enabled ? 'cadence-enabled' : 'cadence-pending',
      nextProjectPulseAt: project.nextAutonomousRunAt || latestSchedulerRecord?.nextRunAt || null,
      scheduledAgentCount: continuousWorkLoopRows.filter((row) => row.nextRunAt).length,
      proofedAgentCount: continuousWorkLoopRows.filter((row) => row.proofReady).length,
      timelineProofCount: continuousWorkLoopRows.reduce((sum, row) => sum + row.timelineLogIds.length, 0),
      rows: continuousWorkLoopRows,
    },
    agents: {
      count: team.length,
      states: operationsAgents,
      managementMesh: managementMeshRows,
      peerManagementMatrix: peerManagementMatrixRows,
    },
    kickoffMeetingFlow,
    kickoffExecutionFlow,
    assignmentFlow: {
      count: assignmentFlowRows.length,
      rows: assignmentFlowRows,
    },
    assignmentTimelineMatrix: {
      count: assignmentTimelineMatrixRows.length,
      timelineReadyCount: assignmentTimelineMatrixRows.filter((row) => row.assignmentPosted && row.assigneeReceived && row.timelineRecorded).length,
      rows: assignmentTimelineMatrixRows,
    },
    assignmentWorkProgress: {
      count: assignmentWorkProgressRows.length,
      progressReadyCount: assignmentWorkProgressRows.filter((row) => row.progressPublished).length,
      completionReadyCount: assignmentWorkProgressRows.filter((row) => row.completionPublished).length,
      rows: assignmentWorkProgressRows,
    },
    changeFlow: {
      count: changeFlowRows.length,
      rows: changeFlowRows,
    },
    changeSourceIntake: {
      count: changeSourceIntakeRows.length,
      dualChannelCount: changeFlowRows.filter((row) => row.sourceChannelIds.length > 1).length,
      sourceReadyCount: changeSourceIntakeRows.filter((row) => row.sourceMessageId && row.receiptCount > 0).length,
      rows: changeSourceIntakeRows,
    },
    agentCommunicationFlow: {
      count: agentCommunicationRows.length,
      rows: agentCommunicationRows,
      deliveryRows: agentMessageDeliveryRows,
      deliveredCount: agentMessageDeliveryRows.filter((row) => row.receiptSeen && row.inboxSeen).length,
    },
    peerHandoffs: {
      count: project.peerHandoffs?.length || 0,
      rows: (project.peerHandoffs || []).slice(0, 8).map((handoff) => ({
        ...handoff,
        requesterName: handoff.requesterName || agentNameById[handoff.requesterId],
        targetName: handoff.targetName || agentNameById[handoff.targetId],
      })),
    },
    tasks: {
      count: project.tasks?.length || 0,
      openCount: (project.tasks || []).filter((task) => task.status !== 'done').length,
      rows: (project.tasks || []).slice(0, 30).map((task) => ({
        ...task,
        evidence: taskEvidence(task),
      })),
    },
    backendRoutes: {
      project: projectId ? `/projects/${projectId}` : null,
      readiness: projectId ? `/projects/${projectId}/readiness` : null,
      readinessProofMap: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
      managerReadyPackage: projectId ? `/projects/${projectId}/manager-ready-package` : null,
      managerFlowGraph: projectId ? `/projects/${projectId}/manager-flow-graph` : null,
      managerCommandCenter: projectId ? `/projects/${projectId}/manager-command-center` : null,
      managerScenarioTrail: projectId ? `/projects/${projectId}/manager-scenario-trail` : null,
      managerScenarioWalkthrough: projectId ? `/projects/${projectId}/manager-scenario-walkthrough` : null,
      managerRequirementMatrix: projectId ? `/projects/${projectId}/manager-requirement-matrix` : null,
      managerUseCaseAudit: projectId ? `/projects/${projectId}/manager-use-case-audit` : null,
      managerActionQueue: projectId ? `/projects/${projectId}/manager-action-queue` : null,
      managerActionRunTemplate: projectId ? `/projects/${projectId}/manager-action-queue/:actionId/run` : null,
      transcripts: projectId ? `/projects/${projectId}/transcripts` : null,
      timeline: projectId ? `/projects/${projectId}/timeline` : null,
      events: projectId ? `/projects/${projectId}/events` : null,
      agents: projectId ? `/projects/${projectId}/agents` : null,
      agentDashboardTemplate: projectId ? `/projects/${projectId}/agents/:agentId/dashboard` : null,
      tasks: projectId ? `/projects/${projectId}/tasks` : null,
    },
  };
}

const MANAGER_FLOW_CATEGORIES = {
  thinking: { label: 'Thinking', lane: 'Thinking' },
  submission: { label: 'Submission', lane: 'Submissions' },
  decision: { label: 'Decision', lane: 'Decisions' },
  execution: { label: 'Execution', lane: 'Execution' },
  collaboration: { label: 'Collaboration', lane: 'Collaboration' },
  communication: { label: 'Communication', lane: 'Communication' },
  monitoring: { label: 'Monitoring', lane: 'Monitoring' },
  evidence: { label: 'Evidence', lane: 'Evidence' },
};

const MANAGER_FLOW_CATEGORY_ORDER = [
  'thinking',
  'decision',
  'collaboration',
  'execution',
  'submission',
  'communication',
  'monitoring',
  'evidence',
];

const MANAGER_FLOW_EDGE_TYPES = {
  leader_assignment: 'Leader assignment line',
  agent_collaboration: 'Agent collaboration line',
  task_dependency: 'Task dependency line',
  change_impact: 'Change impact line',
  reporting: 'Report line',
  evidence: 'Evidence line',
};

function normalizeManagerFlowStatus(value, fallback = 'published') {
  const normalized = String(value || '').toLowerCase();
  if (['draft', 'published', 'confirmed', 'superseded', 'blocked', 'resolved', 'archived'].includes(normalized)) {
    return normalized;
  }
  if (/block|wait|missing|needs|offline|unresolved|pending/.test(normalized)) return 'blocked';
  if (/confirm|approved|persisted|synced|complete|done|ready|covered|live|resolved/.test(normalized)) return 'resolved';
  if (/archive/.test(normalized)) return 'archived';
  return fallback;
}

function normalizeManagerFlowImportance(value, fallback = 'normal') {
  const normalized = String(value || '').toLowerCase();
  return ['minor', 'normal', 'major', 'critical'].includes(normalized) ? normalized : fallback;
}

function higherManagerFlowImportance(left = 'normal', right = 'normal') {
  const rank = { minor: 0, normal: 1, major: 2, critical: 3 };
  return (rank[right] || 0) > (rank[left] || 0) ? right : left;
}

function firstEvidenceTime({ ids = [], logsById = new Map(), messagesById = new Map(), eventsById = new Map(), fallback } = {}) {
  for (const id of ids.filter(Boolean)) {
    const key = String(id);
    const candidates = [
      logsById.get(key)?.time,
      eventsById.get(key)?.time,
      messagesById.get(key)?.createdAt,
      messagesById.get(key)?.sentAt,
      messagesById.get(key)?.time,
    ];
    const found = candidates.find((value) => Number.isFinite(Date.parse(value)));
    if (found) return found;
  }
  return fallback || nowIso();
}

function inferManagerFlowSubmissionIntent({ category, subtype, title, source } = {}) {
  const text = `${category || ''} ${subtype || ''} ${title || ''} ${source || ''}`.toLowerCase();
  if (/meeting|transcript/.test(text)) return 'Submit meeting minutes, decisions, attendance, and transcript proof.';
  if (/leader|assignment|personnel/.test(text)) return 'Submit the assignment decision and ownership contract.';
  if (/requirement|understanding|analysis|risk|dependency/.test(text)) return 'Submit the Agent reasoning record behind the work.';
  if (/change|scope/.test(text)) return 'Submit the change request, decision, impacted people, and execution plan.';
  if (/handoff|collaboration/.test(text)) return 'Submit a collaboration handoff with requester, receiver, and accepted responsibility.';
  if (/report|summary|test|submission/.test(text)) return 'Submit a deliverable report or evidence artifact for user review.';
  if (/heartbeat|monitor|loop|quality|risk-check/.test(text)) return 'Submit an operational check-in generated by the Agent runtime.';
  if (/message|chat|communication/.test(text)) return 'Submit a communication record with delivery and receipt evidence.';
  if (/evidence|proof/.test(text)) return 'Submit traceable evidence that supports another workflow node.';
  return 'Submit an Agent-authored workflow commit for the manager graph.';
}

function inferManagerFlowAttachmentType({ category, subtype, source } = {}) {
  const text = `${category || ''} ${subtype || ''} ${source || ''}`.toLowerCase();
  if (/meeting/.test(text)) return 'meeting-minutes';
  if (/transcript/.test(text)) return 'transcript';
  if (/leader|assignment/.test(text)) return 'assignment-brief';
  if (/requirement|understanding|analysis|risk|dependency/.test(text)) return 'reasoning-note';
  if (/change|scope/.test(text)) return 'change-packet';
  if (/handoff|collaboration/.test(text)) return 'handoff-note';
  if (/test/.test(text)) return 'test-result';
  if (/report|summary|submission/.test(text)) return 'report';
  if (/heartbeat|monitor|loop|quality|risk-check/.test(text)) return 'runtime-check';
  if (/message|chat|communication/.test(text)) return 'chat-record';
  if (/evidence|proof/.test(text)) return 'evidence-packet';
  if (/execution/.test(text)) return 'work-log';
  return 'workflow-attachment';
}

function buildManagerFlowSubmissionArtifacts(input = {}, node = {}) {
  const baseAttachment = {
    id: `${node.id}_attachment_main`,
    type: input.attachmentType || inferManagerFlowAttachmentType(node),
    title: input.attachmentTitle || `${node.title} artifact`,
    summary: input.attachmentSummary || node.summary,
    source: node.source,
    autoGenerated: !input.attachmentTitle && !(input.attachments || []).length,
    proofIds: node.proofIds || [],
    timelineLogIds: node.timelineLogIds || [],
    eventIds: node.eventIds || [],
    taskId: node.taskId || null,
    route: node.route || null,
  };
  const explicitAttachments = (input.attachments || []).map((attachment, index) => ({
    id: attachment.id || `${node.id}_attachment_${index + 1}`,
    type: attachment.type || baseAttachment.type,
    title: attachment.title || `${node.title} attachment ${index + 1}`,
    summary: attachment.summary || node.summary,
    source: attachment.source || node.source,
    autoGenerated: Boolean(attachment.autoGenerated),
    proofIds: uniqueStrings(attachment.proofIds || []),
    timelineLogIds: uniqueStrings(attachment.timelineLogIds || []),
    eventIds: uniqueStrings(attachment.eventIds || []),
    taskId: attachment.taskId || node.taskId || null,
    route: attachment.route || node.route || null,
  }));
  const attachments = explicitAttachments.length ? explicitAttachments : [baseAttachment];
  if ((node.proofIds || []).length) {
    attachments.push({
      id: `${node.id}_attachment_chat_proof`,
      type: 'chat-proof',
      title: 'Chat proof packet',
      summary: `${node.proofIds.length} chat proof id(s) linked to this commit.`,
      source: 'messages',
      autoGenerated: true,
      proofIds: node.proofIds,
      timelineLogIds: [],
      eventIds: [],
      taskId: node.taskId || null,
      route: node.channelId ? `/transcripts/${node.channelId}` : null,
    });
  }
  if ((node.timelineLogIds || []).length) {
    attachments.push({
      id: `${node.id}_attachment_timeline_proof`,
      type: 'timeline-proof',
      title: 'Timeline proof packet',
      summary: `${node.timelineLogIds.length} timeline log id(s) linked to this commit.`,
      source: 'timeline logs',
      autoGenerated: true,
      proofIds: [],
      timelineLogIds: node.timelineLogIds,
      eventIds: [],
      taskId: node.taskId || null,
      route: null,
    });
  }
  if ((node.eventIds || []).length) {
    attachments.push({
      id: `${node.id}_attachment_ledger_proof`,
      type: 'ledger-proof',
      title: 'Event ledger proof packet',
      summary: `${node.eventIds.length} ledger event id(s) linked to this commit.`,
      source: 'eventLedger',
      autoGenerated: true,
      proofIds: [],
      timelineLogIds: [],
      eventIds: node.eventIds,
      taskId: node.taskId || null,
      route: null,
    });
  }
  const field = (id, label, source, value, required = true) => ({
    id,
    label,
    source,
    required,
    status: required && (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) ? 'missing' : 'filled',
  });
  const submission = {
    id: input.submissionId || `submission_${node.id}`,
    generatedBy: 'manager-flow-agent-protocol',
    intent: input.submissionIntent || inferManagerFlowSubmissionIntent(node),
    commitMessage: node.commitMessage,
    submittedByAgentId: node.agentId || null,
    submittedByAgentName: node.agentName || 'Project',
    committerIds: node.committerIds || [],
    coAuthorIds: node.coAuthorIds || [],
    participantIds: node.participantIds || [],
    attachmentIds: attachments.map((attachment) => attachment.id),
    requiredFields: [
      field('category', 'Category', 'agent', node.category),
      field('subtype', 'Subtype', 'agent', node.subtype),
      field('commitMessage', 'Commit message', 'agent', node.commitMessage),
      field('submitter', 'Submitting Agent', 'agent', node.agentId || node.agentName),
      field('attachments', 'Submitted artifact attachment', 'agent', attachments),
    ],
    autoFields: [
      field('id', 'Node ID', 'system', node.id, false),
      field('time', 'Commit time', 'system', node.time, false),
      field('status', 'Workflow status', 'system', node.status, false),
      field('importance', 'Importance', 'system', node.importance, false),
      field('source', 'Source ledger', 'system', node.source, false),
      field('proofIds', 'Proof IDs', 'system', node.proofIds, false),
    ],
  };
  return { submission, attachments };
}

function buildManagerFlowGraphSnapshot({ project = {}, messages = [] } = {}) {
  const dashboard = buildManagerDashboardSnapshot({ project, messages });
  const projectId = project.id || dashboard.projectId || null;
  const team = project.team || [];
  const agentNameById = Object.fromEntries(team.map((agent) => [agent.id, agent.name]));
  const allMessages = [...messages, ...transcriptRecoveredMessages(project)]
    .filter((message) => !projectId || !message.projectId || message.projectId === projectId);
  const messagesById = new Map(allMessages.map((message) => [String(message.id || ''), message]));
  const logsById = new Map((project.logs || []).map((log) => [String(log.id || ''), log]));
  const eventsById = new Map((project.eventLedger || []).map((event) => [String(event.id || ''), event]));
  const taskById = new Map((project.tasks || []).map((task) => [String(task.id || ''), task]));
  const confirmations = project.managerFlowGraphNodeConfirmations || {};
  const fallbackTime = project.updatedAt || project.createdAt || nowIso();
  const nodesById = new Map();
  const edgesById = new Map();

  const makeProofIds = (...groups) => uniqueStrings(groups.flatMap((group) => group || []));
  const timeFor = (ids, fallback = fallbackTime) => firstEvidenceTime({
    ids,
    logsById,
    messagesById,
    eventsById,
    fallback,
  });
  const agentLabel = (agentId) => agentNameById[agentId] || agentId || 'Project';

  const addNode = (input = {}) => {
    if (!input.id) return null;
    const id = String(input.id);
    const category = MANAGER_FLOW_CATEGORIES[input.category] ? input.category : 'execution';
    const proofIds = makeProofIds(
      input.proofIds,
      input.timelineLogIds,
      input.eventIds,
      input.taskId ? [input.taskId] : [],
    );
    const node = {
      id,
      category,
      categoryLabel: MANAGER_FLOW_CATEGORIES[category].label,
      subtype: input.subtype || 'record',
      title: input.title || id,
      agentId: input.agentId || null,
      agentName: input.agentName || agentLabel(input.agentId),
      taskId: input.taskId || null,
      time: input.time || timeFor(proofIds, input.fallbackTime || fallbackTime),
      summary: input.summary || input.title || id,
      status: normalizeManagerFlowStatus(input.status),
      importance: normalizeManagerFlowImportance(input.importance),
      source: input.source || 'managerDashboard',
      proofIds,
      relatedNodeIds: uniqueStrings(input.relatedNodeIds || []),
      affectedAgentIds: uniqueStrings(input.affectedAgentIds || []),
      affectedTaskIds: uniqueStrings(input.affectedTaskIds || []),
      committerIds: uniqueStrings([input.agentId, ...(input.committerIds || [])].filter(Boolean)),
      coAuthorIds: uniqueStrings(input.coAuthorIds || []),
      participantIds: uniqueStrings(input.participantIds || input.affectedAgentIds || []),
      relationshipRoles: input.relationshipRoles || {},
      commitMessage: input.commitMessage || input.summary || input.title || id,
      commitAreaKey: input.commitAreaKey || null,
      thinkingFrame: input.thinkingFrame || null,
      collaborationContext: input.collaborationContext || null,
      timelineSubmissionId: input.submissionId || null,
      timelineLogIds: uniqueStrings(input.timelineLogIds || []),
      eventIds: uniqueStrings(input.eventIds || []),
      route: input.route || null,
      channelId: input.channelId || null,
      lane: input.lane || MANAGER_FLOW_CATEGORIES[category].lane,
      sourceLabel: input.sourceLabel || input.source || 'managerDashboard',
      confirmation: confirmations[id] || null,
    };

    if (node.confirmation) {
      node.status = node.confirmation.valid === false ? 'superseded' : 'confirmed';
    }

    const artifacts = buildManagerFlowSubmissionArtifacts(input, node);
    node.submission = artifacts.submission;
    node.attachments = artifacts.attachments;

    const existing = nodesById.get(id);
    if (existing) {
      const merged = {
        ...existing,
        ...node,
        proofIds: uniqueStrings([...(existing.proofIds || []), ...(node.proofIds || [])]),
        relatedNodeIds: uniqueStrings([...(existing.relatedNodeIds || []), ...(node.relatedNodeIds || [])]),
        affectedAgentIds: uniqueStrings([...(existing.affectedAgentIds || []), ...(node.affectedAgentIds || [])]),
        affectedTaskIds: uniqueStrings([...(existing.affectedTaskIds || []), ...(node.affectedTaskIds || [])]),
        committerIds: uniqueStrings([...(existing.committerIds || []), ...(node.committerIds || [])]),
        coAuthorIds: uniqueStrings([...(existing.coAuthorIds || []), ...(node.coAuthorIds || [])]),
        participantIds: uniqueStrings([...(existing.participantIds || []), ...(node.participantIds || [])]),
        relationshipRoles: { ...(existing.relationshipRoles || {}), ...(node.relationshipRoles || {}) },
        commitAreaKey: existing.commitAreaKey || node.commitAreaKey,
        thinkingFrame: existing.thinkingFrame || node.thinkingFrame,
        collaborationContext: existing.collaborationContext || node.collaborationContext,
        timelineSubmissionId: existing.timelineSubmissionId || node.timelineSubmissionId,
        attachments: [
          ...(existing.attachments || []),
          ...(node.attachments || []),
        ].filter((attachment, index, all) => all.findIndex((item) => item.id === attachment.id) === index),
        submission: {
          ...(existing.submission || {}),
          ...(node.submission || {}),
          attachmentIds: uniqueStrings([
            ...((existing.submission || {}).attachmentIds || []),
            ...((node.submission || {}).attachmentIds || []),
          ]),
          committerIds: uniqueStrings([
            ...((existing.submission || {}).committerIds || []),
            ...((node.submission || {}).committerIds || []),
          ]),
          coAuthorIds: uniqueStrings([
            ...((existing.submission || {}).coAuthorIds || []),
            ...((node.submission || {}).coAuthorIds || []),
          ]),
          participantIds: uniqueStrings([
            ...((existing.submission || {}).participantIds || []),
            ...((node.submission || {}).participantIds || []),
          ]),
        },
        timelineLogIds: uniqueStrings([...(existing.timelineLogIds || []), ...(node.timelineLogIds || [])]),
        eventIds: uniqueStrings([...(existing.eventIds || []), ...(node.eventIds || [])]),
        importance: higherManagerFlowImportance(existing.importance, node.importance),
      };
      nodesById.set(id, merged);
      return merged;
    }

    nodesById.set(id, node);
    return node;
  };

  const addEdge = (input = {}) => {
    if (!input.fromNodeId || !input.toNodeId) return null;
    const type = MANAGER_FLOW_EDGE_TYPES[input.type] ? input.type : 'task_dependency';
    const id = input.id || `${type}_${input.fromNodeId}_${input.toNodeId}`;
    if (edgesById.has(id)) return edgesById.get(id);
    const edge = {
      id,
      type,
      typeLabel: MANAGER_FLOW_EDGE_TYPES[type],
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      label: input.label || MANAGER_FLOW_EDGE_TYPES[type],
      status: normalizeManagerFlowStatus(input.status),
      importance: normalizeManagerFlowImportance(input.importance),
      source: input.source || 'managerDashboard',
      proofIds: makeProofIds(input.proofIds, input.timelineLogIds, input.eventIds),
      timelineLogIds: uniqueStrings(input.timelineLogIds || []),
      eventIds: uniqueStrings(input.eventIds || []),
    };
    edgesById.set(id, edge);
    return edge;
  };

  const attachEvidenceNode = ({
    parentId,
    id,
    title,
    summary,
    source = 'managerDashboard',
    proofIds = [],
    timelineLogIds = [],
    eventIds = [],
    channelId = null,
    importance = 'normal',
  } = {}) => {
    if (!parentId || !(proofIds.length || timelineLogIds.length || eventIds.length)) return null;
    const node = addNode({
      id,
      category: 'evidence',
      subtype: source.includes('timeline') ? 'timeline-evidence' : source.includes('task') ? 'task-evidence' : 'proof',
      title,
      summary,
      status: 'published',
      importance,
      source,
      proofIds,
      timelineLogIds,
      eventIds,
      channelId,
      submissionIntent: 'Submit an evidence attachment linked to the parent workflow commit.',
      attachmentType: 'evidence-packet',
      attachmentTitle: title,
      relatedNodeIds: [parentId],
    });
    addEdge({
      type: 'evidence',
      fromNodeId: parentId,
      toNodeId: node?.id,
      label: 'Evidence trace',
      source,
      proofIds,
      timelineLogIds,
      eventIds,
      importance,
    });
    return node;
  };

  const kickoffFlow = dashboard.kickoffMeetingFlow || {};
  const kickoffExecution = dashboard.kickoffExecutionFlow || {};
  const leaderId = kickoffFlow.confirmedLeaderId || project.kickoffCharter?.governance?.leaderId || team.find((agent) => agent.isLeader)?.id || null;

  const kickoffRoot = addNode({
    id: 'kickoff-meeting',
    category: 'communication',
    subtype: 'meeting',
    title: 'Kickoff meeting opened',
    agentId: leaderId,
    summary: kickoffFlow.briefAlignment?.text || project.initiation?.summary || project.name || 'Project kickoff',
    status: project.kickoffCharter ? 'resolved' : 'draft',
    importance: 'critical',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.proofIds || kickoffFlow.briefAlignment?.proofIds || [],
    timelineLogIds: kickoffFlow.confirmedTeamProofLogIds || [],
    affectedAgentIds: team.map((agent) => agent.id),
    participantIds: team.map((agent) => agent.id),
    relationshipRoles: Object.fromEntries(team.map((agent) => [
      agent.id,
      agent.id === leaderId ? 'meeting-lead' : 'participant',
    ])),
    commitMessage: kickoffFlow.briefAlignment?.text || project.initiation?.summary || 'Project kickoff meeting record',
    submissionIntent: 'Submit the kickoff meeting minutes as the first durable project artifact.',
    attachmentType: 'meeting-minutes',
    attachmentTitle: 'Kickoff meeting minutes and decision packet',
    attachmentSummary: 'Meeting brief, attendee participation, Leader decision, next actions, and transcript proof.',
    route: projectId ? `/projects/${projectId}/manager-dashboard#kickoff-meeting-flow` : null,
  });

  addNode({
    id: 'kickoff-requirement-understanding',
    category: 'thinking',
    subtype: 'requirement-understanding',
    title: 'Requirement understood and heard',
    agentId: leaderId,
    summary: `${kickoffFlow.briefAlignment?.heardByAgentIds?.length || 0}/${team.length} Agents heard the Director brief.`,
    status: kickoffFlow.briefAlignment?.heardByAgentIds?.length ? 'resolved' : 'blocked',
    importance: 'critical',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.briefAlignment?.proofIds || kickoffFlow.proofIds || [],
    participantIds: kickoffFlow.briefAlignment?.heardByAgentIds || team.map((agent) => agent.id),
    relationshipRoles: Object.fromEntries((kickoffFlow.briefAlignment?.heardByAgentIds || team.map((agent) => agent.id)).map((agentId) => [
      agentId,
      agentId === leaderId ? 'brief-owner' : 'heard-brief',
    ])),
    submissionIntent: 'Submit the Agent understanding record that proves the team heard the requirement.',
    attachmentType: 'reasoning-note',
    attachmentTitle: 'Requirement understanding note',
    relatedNodeIds: [kickoffRoot?.id],
  });
  addEdge({
    type: 'reporting',
    fromNodeId: kickoffRoot?.id,
    toNodeId: 'kickoff-requirement-understanding',
    label: 'Brief heard',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.briefAlignment?.proofIds || [],
    importance: 'critical',
  });

  addNode({
    id: 'kickoff-role-risk-analysis',
    category: 'thinking',
    subtype: 'dependency-judgement',
    title: 'Roles, dependencies, and risks discussed',
    agentId: leaderId,
    summary: `${kickoffFlow.roleQuestionCount || 0} role questions, ${kickoffFlow.selfNominationCount || 0} self nominations, ${kickoffFlow.leaderCampaignCount || 0} leader campaigns.`,
    status: (kickoffFlow.roleQuestionCount || kickoffFlow.leaderCampaignCount) ? 'resolved' : 'blocked',
    importance: 'major',
    source: 'messages',
    proofIds: kickoffFlow.proofIds || [],
    participantIds: team.map((agent) => agent.id),
    relationshipRoles: Object.fromEntries(team.map((agent) => [
      agent.id,
      agent.id === leaderId ? 'analysis-owner' : 'contributor',
    ])),
    submissionIntent: 'Submit the role, dependency, and risk analysis generated during kickoff.',
    attachmentType: 'analysis-note',
    attachmentTitle: 'Role and risk analysis note',
    relatedNodeIds: ['kickoff-requirement-understanding'],
  });
  addEdge({
    type: 'task_dependency',
    fromNodeId: 'kickoff-requirement-understanding',
    toNodeId: 'kickoff-role-risk-analysis',
    label: 'Goal decomposition',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.proofIds || [],
    importance: 'major',
  });

  addNode({
    id: 'leader-election',
    category: 'decision',
    subtype: 'leader-decision',
    title: 'Leader elected and marker persisted',
    agentId: leaderId,
    summary: kickoffFlow.confirmedLeaderName || 'Leader pending',
    status: kickoffFlow.leaderMarkerPersisted ? 'confirmed' : 'blocked',
    importance: 'critical',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.leaderElectionResolution?.campaignIds || kickoffFlow.proofIds || [],
    timelineLogIds: kickoffFlow.confirmedTeamProofLogIds || [],
    participantIds: team.map((agent) => agent.id),
    relationshipRoles: Object.fromEntries(team.map((agent) => [
      agent.id,
      agent.id === leaderId ? 'confirmed-leader' : 'voter-or-observer',
    ])),
    submissionIntent: 'Submit the Leader election decision with campaign proof.',
    attachmentType: 'decision-packet',
    attachmentTitle: 'Leader election decision packet',
    relatedNodeIds: ['kickoff-role-risk-analysis'],
  });
  addEdge({
    type: 'leader_assignment',
    fromNodeId: 'kickoff-role-risk-analysis',
    toNodeId: 'leader-election',
    label: 'Leader campaign resolved',
    source: 'kickoffCharter',
    proofIds: kickoffFlow.leaderElectionResolution?.campaignIds || kickoffFlow.proofIds || [],
    timelineLogIds: kickoffFlow.confirmedTeamProofLogIds || [],
    importance: 'critical',
  });

  addNode({
    id: 'team-roster-confirmed',
    category: 'decision',
    subtype: 'personnel-assignment',
    title: 'Team roster and governance confirmed',
    agentId: leaderId,
    summary: `${kickoffFlow.confirmedTeamMatrixRows?.filter((row) => row.inProjectState && row.inKickoffCharter).length || 0}/${kickoffFlow.confirmedTeamMatrixRows?.length || team.length} roster rows persisted.`,
    status: kickoffFlow.confirmedTeamMatrixRows?.length ? 'confirmed' : 'blocked',
    importance: 'major',
    source: 'kickoffCharter',
    timelineLogIds: kickoffFlow.confirmedTeamProofLogIds || [],
    affectedAgentIds: team.map((agent) => agent.id),
    participantIds: team.map((agent) => agent.id),
    relationshipRoles: Object.fromEntries(team.map((agent) => [
      agent.id,
      agent.id === leaderId ? 'governance-owner' : 'team-member',
    ])),
    submissionIntent: 'Submit the confirmed team roster and governance marker.',
    attachmentType: 'roster-packet',
    attachmentTitle: 'Team roster and governance packet',
    relatedNodeIds: ['leader-election'],
  });
  addEdge({
    type: 'leader_assignment',
    fromNodeId: 'leader-election',
    toNodeId: 'team-roster-confirmed',
    label: 'Governance marker',
    source: 'kickoffCharter',
    timelineLogIds: kickoffFlow.confirmedTeamProofLogIds || [],
    importance: 'major',
  });

  addNode({
    id: 'kickoff-next-actions-confirmed',
    category: 'decision',
    subtype: 'next-step-plan',
    title: 'Kickoff next actions confirmed',
    agentId: leaderId,
    summary: `${kickoffExecution.nextActions?.length || 0} first execution actions; ${kickoffExecution.nextActionResolutionDelivery?.deliveredAgentIds?.length || 0}/${team.length} receipts.`,
    status: kickoffExecution.nextActionResolution?.managerConfirmed ? 'confirmed' : 'blocked',
    importance: 'critical',
    source: 'kickoffCharter',
    proofIds: [kickoffExecution.nextActionResolutionDelivery?.messageId].filter(Boolean),
    timelineLogIds: kickoffExecution.firstPulse?.timelineLogIds || [],
    affectedAgentIds: kickoffExecution.nextActionResolutionDelivery?.deliveredAgentIds || [],
    affectedTaskIds: (kickoffExecution.nextActions || []).map((action) => action.id).filter(Boolean),
    participantIds: uniqueStrings([leaderId, ...(kickoffExecution.nextActionResolutionDelivery?.deliveredAgentIds || [])].filter(Boolean)),
    relationshipRoles: Object.fromEntries(uniqueStrings([leaderId, ...(kickoffExecution.nextActionResolutionDelivery?.deliveredAgentIds || [])].filter(Boolean)).map((agentId) => [
      agentId,
      agentId === leaderId ? 'plan-owner' : 'action-recipient',
    ])),
    submissionIntent: 'Submit the first execution plan and delivery receipts.',
    attachmentType: 'execution-plan',
    attachmentTitle: 'Kickoff next-action execution plan',
    relatedNodeIds: ['team-roster-confirmed'],
  });
  addEdge({
    type: 'leader_assignment',
    fromNodeId: 'team-roster-confirmed',
    toNodeId: 'kickoff-next-actions-confirmed',
    label: 'First execution plan',
    source: 'kickoffCharter',
    proofIds: [kickoffExecution.nextActionResolutionDelivery?.messageId].filter(Boolean),
    importance: 'critical',
  });

  (dashboard.assignmentFlow?.rows || []).forEach((row) => {
    const task = taskById.get(String(row.taskId || '')) || {};
    const progressRow = (dashboard.assignmentWorkProgress?.rows || []).find((item) => String(item.taskId || '') === String(row.taskId || '')) || {};
    const assignmentNodeId = `assignment-${row.taskId}`;
    const executionNodeId = `task-execution-${row.taskId}`;
    const submissionNodeId = `task-submission-${row.taskId}`;
    addNode({
      id: assignmentNodeId,
      category: 'collaboration',
      subtype: 'leader-assignment',
      title: `Leader assigned ${row.ownerName || row.ownerId || 'Agent'}`,
      agentId: row.ownerId,
      taskId: row.taskId,
      summary: row.text || task.text || 'Leader assignment',
      status: row.inboxSeen || row.obligationSeen ? 'confirmed' : 'blocked',
      importance: task.priority === 'critical' ? 'critical' : 'major',
      source: 'tasks',
      proofIds: row.evidence?.chatIds || [],
      timelineLogIds: row.evidence?.timelineIds || [],
      affectedAgentIds: uniqueStrings([leaderId, row.ownerId].filter(Boolean)),
      participantIds: uniqueStrings([leaderId, row.ownerId].filter(Boolean)),
      relationshipRoles: {
        ...(leaderId ? { [leaderId]: 'assigner' } : {}),
        ...(row.ownerId ? { [row.ownerId]: 'assignee' } : {}),
      },
      submissionIntent: 'Submit the Leader assignment as an executable task contract.',
      attachmentType: 'assignment-brief',
      attachmentTitle: `Assignment brief for ${row.ownerName || row.ownerId || row.taskId}`,
      route: projectId && row.taskId ? `/projects/${projectId}/tasks/${encodeURIComponent(row.taskId)}` : null,
      relatedNodeIds: ['kickoff-next-actions-confirmed'],
    });
    addEdge({
      type: 'leader_assignment',
      fromNodeId: 'kickoff-next-actions-confirmed',
      toNodeId: assignmentNodeId,
      label: 'Leader assignment',
      source: 'tasks',
      proofIds: row.evidence?.chatIds || [],
      timelineLogIds: row.evidence?.timelineIds || [],
      importance: 'major',
    });
    addNode({
      id: executionNodeId,
      category: 'execution',
      subtype: task.status === 'done' ? 'complete-task' : row.workSeen ? 'advance-task' : 'start-task',
      title: `${row.ownerName || row.ownerId || 'Agent'} execution path`,
      agentId: row.ownerId,
      taskId: row.taskId,
      summary: progressRow.latestProgressText || task.text || row.text || 'Agent work path',
      status: task.status === 'done' || progressRow.completionPublished ? 'resolved' : row.workSeen ? 'published' : 'blocked',
      importance: row.workSeen ? 'normal' : 'major',
      source: 'agentStates',
      proofIds: progressRow.chatProgressIds || row.evidence?.chatIds || [],
      timelineLogIds: progressRow.timelineProgressLogIds || row.evidence?.timelineIds || [],
      affectedAgentIds: uniqueStrings([row.ownerId].filter(Boolean)),
      participantIds: uniqueStrings([row.ownerId].filter(Boolean)),
      relationshipRoles: row.ownerId ? { [row.ownerId]: 'executor' } : {},
      submissionIntent: 'Submit the Agent work log generated while executing the assigned task.',
      attachmentType: 'work-log',
      attachmentTitle: `Work log for ${row.ownerName || row.ownerId || row.taskId}`,
      relatedNodeIds: [assignmentNodeId],
    });
    addEdge({
      type: 'task_dependency',
      fromNodeId: assignmentNodeId,
      toNodeId: executionNodeId,
      label: 'Task dependency',
      source: 'tasks',
      proofIds: row.evidence?.chatIds || [],
      timelineLogIds: row.evidence?.timelineIds || [],
      importance: 'normal',
    });
    if ((progressRow.timelineProgressLogIds || []).length || progressRow.completionPublished || task.status === 'done') {
      addNode({
        id: submissionNodeId,
        category: 'submission',
        subtype: task.status === 'done' ? 'stage-summary' : 'report',
        title: `${row.ownerName || row.ownerId || 'Agent'} published work evidence`,
        agentId: row.ownerId,
        taskId: row.taskId,
        summary: progressRow.latestProgressText || task.text || 'Work evidence published',
        status: progressRow.completionPublished || task.status === 'done' ? 'resolved' : 'published',
        importance: progressRow.completionPublished ? 'major' : 'normal',
        source: 'timeline logs',
        proofIds: progressRow.chatProgressIds || [],
        timelineLogIds: progressRow.timelineProgressLogIds || progressRow.completionLogIds || [],
        affectedAgentIds: uniqueStrings([row.ownerId, leaderId].filter(Boolean)),
        participantIds: uniqueStrings([row.ownerId, leaderId].filter(Boolean)),
        relationshipRoles: {
          ...(row.ownerId ? { [row.ownerId]: 'submitter' } : {}),
          ...(leaderId ? { [leaderId]: 'reviewer' } : {}),
        },
        submissionIntent: 'Submit the visible work result for manager/user review.',
        attachmentType: task.status === 'done' ? 'stage-summary' : 'report',
        attachmentTitle: `${row.ownerName || row.ownerId || 'Agent'} deliverable report`,
        relatedNodeIds: [executionNodeId],
      });
      addEdge({
        type: 'reporting',
        fromNodeId: executionNodeId,
        toNodeId: submissionNodeId,
        label: 'Progress report',
        source: 'timeline logs',
        proofIds: progressRow.chatProgressIds || [],
        timelineLogIds: progressRow.timelineProgressLogIds || [],
        importance: progressRow.completionPublished ? 'major' : 'normal',
      });
    }
    attachEvidenceNode({
      parentId: assignmentNodeId,
      id: `evidence-assignment-${row.taskId}`,
      title: `Assignment evidence for ${row.ownerName || row.ownerId || row.taskId}`,
      summary: `${row.evidence?.chatIds?.length || 0} chat proofs, ${row.evidence?.timelineIds?.length || 0} timeline proofs.`,
      source: 'task evidence',
      proofIds: row.evidence?.chatIds || [],
      timelineLogIds: row.evidence?.timelineIds || [],
      importance: 'normal',
    });
  });

  (dashboard.changeFlow?.rows || []).forEach((row) => {
    const intakeId = `change-${row.changeId}-intake`;
    const decisionId = `change-${row.changeId}-decision`;
    const executionId = `change-${row.changeId}-execution`;
    const sourceProofIds = makeProofIds(row.sourceMessageIds, [row.requestMessageId]);
    const discussionProofIds = makeProofIds(row.discussionMessageIds, [row.confirmationMessageId, row.syncMessageId]);
    addNode({
      id: intakeId,
      category: 'communication',
      subtype: row.sourceChannelIds?.length > 1 ? 'multi-channel-change' : 'group-chat',
      title: 'Change request intake',
      agentId: row.ownerId || leaderId,
      taskId: row.taskId,
      summary: row.requestText || 'Change request',
      status: sourceProofIds.length ? 'published' : 'blocked',
      importance: row.sourceChannelIds?.length > 1 ? 'critical' : 'major',
      source: 'changeLedger',
      proofIds: sourceProofIds,
      channelId: row.sourceChannelId || row.sourceChannelIds?.[0] || 'main',
      affectedAgentIds: row.discussionDeliveredAgentIds || [],
      participantIds: uniqueStrings([row.ownerId || leaderId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)),
      relationshipRoles: Object.fromEntries(uniqueStrings([row.ownerId || leaderId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)).map((agentId) => [
        agentId,
        agentId === (row.ownerId || leaderId) ? 'change-owner' : 'notified',
      ])),
      affectedTaskIds: [row.taskId].filter(Boolean),
      submissionIntent: 'Submit the incoming change request with source-channel evidence.',
      attachmentType: 'change-request',
      attachmentTitle: 'Change request intake packet',
    });
    addNode({
      id: decisionId,
      category: 'decision',
      subtype: 'scope-change',
      title: `${row.ownerName || row.ownerId || 'Owner'} confirmed change path`,
      agentId: row.ownerId,
      taskId: row.taskId,
      summary: `${row.discussionMessageIds?.length || 0} discussion messages, owner confirmed: ${row.confirmationMessageId ? 'yes' : 'no'}.`,
      status: row.confirmationMessageId ? 'confirmed' : 'blocked',
      importance: 'major',
      source: 'changeLedger',
      proofIds: discussionProofIds,
      timelineLogIds: row.timelineLogIds || [],
      affectedAgentIds: row.discussionDeliveredAgentIds || [],
      participantIds: uniqueStrings([row.ownerId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)),
      relationshipRoles: Object.fromEntries(uniqueStrings([row.ownerId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)).map((agentId) => [
        agentId,
        agentId === row.ownerId ? 'decision-owner' : 'consulted',
      ])),
      submissionIntent: 'Submit the change decision and impacted collaborator list.',
      attachmentType: 'change-decision',
      attachmentTitle: 'Change decision packet',
      relatedNodeIds: [intakeId],
    });
    addNode({
      id: executionId,
      category: 'execution',
      subtype: row.ownerWorkStarted ? 'advance-task' : 'update-plan',
      title: `${row.ownerName || row.ownerId || 'Owner'} change execution`,
      agentId: row.ownerId,
      taskId: row.taskId,
      summary: row.ownerPlanLinked ? 'Owner plan linked and team sync visible.' : 'Owner plan pending.',
      status: row.ownerWorkStarted ? 'resolved' : row.ownerPlanLinked ? 'published' : 'blocked',
      importance: row.ownerWorkStarted ? 'normal' : 'major',
      source: 'changeLedger',
      proofIds: row.ownerWorkMessageIds || [],
      timelineLogIds: row.ownerWorkTimelineLogIds || row.timelineLogIds || [],
      affectedAgentIds: row.discussionDeliveredAgentIds || [],
      participantIds: uniqueStrings([row.ownerId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)),
      relationshipRoles: Object.fromEntries(uniqueStrings([row.ownerId, ...(row.discussionDeliveredAgentIds || [])].filter(Boolean)).map((agentId) => [
        agentId,
        agentId === row.ownerId ? 'executor' : 'impacted',
      ])),
      submissionIntent: 'Submit the change execution update and impacted task links.',
      attachmentType: 'change-execution-log',
      attachmentTitle: 'Change execution log',
      relatedNodeIds: [decisionId],
    });
    addEdge({
      type: 'change_impact',
      fromNodeId: intakeId,
      toNodeId: decisionId,
      label: 'Change impact assessed',
      source: 'changeLedger',
      proofIds: sourceProofIds,
      importance: 'major',
    });
    addEdge({
      type: 'change_impact',
      fromNodeId: decisionId,
      toNodeId: executionId,
      label: 'Owner plan and execution',
      source: 'changeLedger',
      proofIds: discussionProofIds,
      timelineLogIds: row.ownerWorkTimelineLogIds || row.timelineLogIds || [],
      importance: 'major',
    });
    if (row.taskId && nodesById.has(`task-execution-${row.taskId}`)) {
      addEdge({
        type: 'change_impact',
        fromNodeId: executionId,
        toNodeId: `task-execution-${row.taskId}`,
        label: 'Change affects task',
        source: 'changeLedger',
        timelineLogIds: row.ownerWorkTimelineLogIds || [],
        importance: 'major',
      });
    }
    attachEvidenceNode({
      parentId: decisionId,
      id: `evidence-change-${row.changeId}`,
      title: 'Change evidence packet',
      summary: `${sourceProofIds.length + discussionProofIds.length} chat proofs and ${(row.ownerWorkTimelineLogIds || row.timelineLogIds || []).length} timeline proofs.`,
      source: 'change evidence',
      proofIds: [...sourceProofIds, ...discussionProofIds],
      timelineLogIds: row.ownerWorkTimelineLogIds || row.timelineLogIds || [],
      importance: 'major',
    });
  });

  (dashboard.agentCommunicationFlow?.rows || []).slice(0, 16).forEach((row) => {
    const nodeId = `agent-message-${row.messageId}`;
    addNode({
      id: nodeId,
      category: 'communication',
      subtype: 'group-chat',
      title: `${row.senderName} messaged ${row.targetNames?.join(' / ') || 'team'}`,
      agentId: row.senderId,
      summary: row.text || 'Agent communication',
      status: row.inboxSeen || row.receiptCount ? 'published' : 'blocked',
      importance: row.obligationSeen ? 'major' : 'normal',
      source: 'messages',
      proofIds: row.proofIds || [row.messageId].filter(Boolean),
      channelId: row.channelId || 'main',
      affectedAgentIds: row.targetIds || [],
      participantIds: uniqueStrings([row.senderId, ...(row.targetIds || [])].filter(Boolean)),
      relationshipRoles: {
        ...(row.senderId ? { [row.senderId]: 'sender' } : {}),
        ...Object.fromEntries((row.targetIds || []).map((targetId) => [targetId, 'recipient'])),
      },
      submissionIntent: 'Submit the Agent communication record with delivery/receipt context.',
      attachmentType: 'chat-record',
      attachmentTitle: `${row.senderName || row.senderId || 'Agent'} communication record`,
    });
    (row.targetIds || []).forEach((targetId) => {
      const targetStatusId = `agent-status-${targetId}`;
      if (nodesById.has(targetStatusId)) {
        addEdge({
          type: 'agent_collaboration',
          fromNodeId: nodeId,
          toNodeId: targetStatusId,
          label: 'Agent collaboration',
          source: 'messages',
          proofIds: row.proofIds || [row.messageId].filter(Boolean),
          importance: row.obligationSeen ? 'major' : 'normal',
        });
      }
    });
  });

  (dashboard.peerHandoffs?.rows || []).forEach((handoff) => {
    const nodeId = `peer-handoff-${handoff.id || handoff.taskId || handoff.requestMessageId}`;
    addNode({
      id: nodeId,
      category: 'collaboration',
      subtype: 'task-handoff',
      title: `${handoff.requesterName || handoff.requesterId || 'Agent'} handed off to ${handoff.targetName || handoff.targetId || 'Agent'}`,
      agentId: handoff.targetId,
      taskId: handoff.taskId,
      summary: handoff.text || handoff.reason || 'Peer handoff accepted',
      status: handoff.status === 'accepted' ? 'confirmed' : normalizeManagerFlowStatus(handoff.status, 'published'),
      importance: 'major',
      source: 'messages',
      proofIds: [handoff.requestMessageId, handoff.acknowledgementMessageId].filter(Boolean),
      timelineLogIds: handoff.timelineLogIds || [],
      affectedAgentIds: [handoff.requesterId, handoff.targetId].filter(Boolean),
      participantIds: [handoff.requesterId, handoff.targetId].filter(Boolean),
      relationshipRoles: {
        ...(handoff.requesterId ? { [handoff.requesterId]: 'handoff-requester' } : {}),
        ...(handoff.targetId ? { [handoff.targetId]: 'handoff-owner' } : {}),
      },
      submissionIntent: 'Submit the task handoff agreement and acknowledgement.',
      attachmentType: 'handoff-note',
      attachmentTitle: 'Peer handoff agreement',
    });
    if (handoff.taskId && nodesById.has(`task-execution-${handoff.taskId}`)) {
      addEdge({
        type: 'agent_collaboration',
        fromNodeId: `task-execution-${handoff.taskId}`,
        toNodeId: nodeId,
        label: 'Task handoff',
        source: 'messages',
        proofIds: [handoff.requestMessageId, handoff.acknowledgementMessageId].filter(Boolean),
        timelineLogIds: handoff.timelineLogIds || [],
        importance: 'major',
      });
    }
  });

  (dashboard.operationsBoard?.agents || []).forEach((agentRow) => {
    const statusNodeId = `agent-status-${agentRow.agentId}`;
    const workNodeId = `agent-work-${agentRow.agentId}`;
    addNode({
      id: statusNodeId,
      category: 'monitoring',
      subtype: 'agent-heartbeat',
      title: `${agentRow.name} current state`,
      agentId: agentRow.agentId,
      summary: `${agentRow.status || 'waiting'}; next run ${agentRow.nextRunAt || 'not scheduled'}.`,
      status: agentRow.status === 'blocked' ? 'blocked' : agentRow.nextRunAt || agentRow.lastRunAt ? 'published' : 'draft',
      importance: agentRow.managementPriority > 50 ? 'major' : 'normal',
      source: 'agentStates',
      proofIds: [agentRow.latestInbox?.sourceMessageId, agentRow.latestInbox?.messageId].filter(Boolean),
      submissionIntent: 'Submit the Agent runtime heartbeat for manager visibility.',
      attachmentType: 'runtime-check',
      attachmentTitle: `${agentRow.name} runtime heartbeat`,
      route: agentRow.dashboardPath,
    });
    addNode({
      id: workNodeId,
      category: 'execution',
      subtype: 'advance-task',
      title: `${agentRow.name} working path`,
      agentId: agentRow.agentId,
      summary: agentRow.currentPlan?.focus || agentRow.latestWorklog?.text || agentRow.trigger || 'Work path pending',
      status: agentRow.latestWorklog || agentRow.currentPlan ? 'published' : 'draft',
      importance: agentRow.openObligationCount ? 'major' : 'normal',
      source: 'agentStates',
      proofIds: [agentRow.latestWorklog?.sourceMessageId, agentRow.latestWorklog?.messageId].filter(Boolean),
      participantIds: uniqueStrings([agentRow.agentId].filter(Boolean)),
      relationshipRoles: agentRow.agentId ? { [agentRow.agentId]: 'worker' } : {},
      submissionIntent: 'Submit the Agent current work path and next intended action.',
      attachmentType: 'work-log',
      attachmentTitle: `${agentRow.name} current work path`,
      relatedNodeIds: [statusNodeId],
    });
    addEdge({
      type: 'task_dependency',
      fromNodeId: statusNodeId,
      toNodeId: workNodeId,
      label: 'Agent work path',
      source: 'agentStates',
      proofIds: [agentRow.latestWorklog?.sourceMessageId, agentRow.latestWorklog?.messageId].filter(Boolean),
      importance: agentRow.openObligationCount ? 'major' : 'normal',
    });
  });

  (dashboard.continuousWorkLoop?.rows || []).forEach((row) => {
    const nodeId = `worker-loop-${row.agentId}`;
    addNode({
      id: nodeId,
      category: 'monitoring',
      subtype: 'timed-loop',
      title: `${row.name} worker loop`,
      agentId: row.agentId,
      summary: `${row.loopState}; ${row.nextStep || row.focus || 'routine pulse pending'}.`,
      status: row.proofReady ? 'resolved' : row.nextRunAt ? 'published' : 'blocked',
      importance: row.proofReady ? 'normal' : 'major',
      source: 'agentStates',
      proofIds: row.chatProofIds || [],
      timelineLogIds: row.timelineLogIds || [],
      participantIds: uniqueStrings([row.agentId].filter(Boolean)),
      relationshipRoles: row.agentId ? { [row.agentId]: 'runtime-owner' } : {},
      submissionIntent: 'Submit the scheduled Agent loop pulse.',
      attachmentType: 'runtime-loop',
      attachmentTitle: `${row.name} scheduled loop pulse`,
      relatedNodeIds: [`agent-status-${row.agentId}`, `agent-work-${row.agentId}`],
    });
    addEdge({
      type: 'task_dependency',
      fromNodeId: `agent-work-${row.agentId}`,
      toNodeId: nodeId,
      label: 'Worker cadence',
      source: 'agentStates',
      proofIds: row.chatProofIds || [],
      timelineLogIds: row.timelineLogIds || [],
      importance: row.proofReady ? 'normal' : 'major',
    });
  });

  (dashboard.syncProtocolAudit?.rows || []).forEach((row) => {
    const nodeId = `protocol-${row.id}`;
    addNode({
      id: nodeId,
      category: 'monitoring',
      subtype: row.id.includes('risk') ? 'risk-check' : 'quality-check',
      title: row.protocol,
      summary: row.managerMeaning,
      status: row.complete ? 'resolved' : row.status,
      importance: row.complete ? 'normal' : 'major',
      source: 'managerDashboard',
      proofIds: row.proofIds || [],
      timelineLogIds: row.timelineLogIds || [],
      submissionIntent: 'Submit a manager protocol audit check with linked proof.',
      attachmentType: row.id.includes('risk') ? 'risk-check' : 'quality-check',
      attachmentTitle: `${row.protocol} audit packet`,
      relatedNodeIds: ['kickoff-next-actions-confirmed'],
    });
    addEdge({
      type: 'evidence',
      fromNodeId: nodeId,
      toNodeId: 'project-evidence-ledger',
      label: 'Protocol evidence',
      source: 'managerDashboard',
      proofIds: row.proofIds || [],
      timelineLogIds: row.timelineLogIds || [],
      importance: row.complete ? 'normal' : 'major',
    });
  });

  (project.logs || []).slice(0, 36).forEach((log, index) => {
    const lowerType = String(log.eventType || '').toLowerCase();
    const category = /daily|report|summary|completed|test/.test(lowerType)
      ? 'submission'
      : /decision|confirmed|approved/.test(lowerType)
        ? 'decision'
        : /management|review|sweep|scheduler|worker/.test(lowerType)
          ? 'monitoring'
          : /message|chat|meeting|handoff/.test(lowerType)
            ? 'communication'
            : 'execution';
    const subtype = /test/.test(lowerType)
      ? 'test-result'
      : /report|summary/.test(lowerType)
        ? 'report'
        : /completed/.test(lowerType)
          ? 'complete-task'
          : /review/.test(lowerType)
            ? 'review'
            : lowerType || 'timeline-log';
    const agent = team.find((item) => item.id === log.agentId || item.name === log.agent);
    const nodeId = `timeline-log-${log.id || index}`;
    addNode({
      id: nodeId,
      category,
      subtype,
      title: log.agent || log.actor || log.eventType || 'Timeline log',
      agentId: log.agentId || agent?.id || null,
      taskId: log.taskId || null,
      time: log.time || fallbackTime,
      summary: log.log || log.text || 'Timeline log',
      status: /blocked/.test(lowerType) ? 'blocked' : /completed|confirmed|approved/.test(lowerType) ? 'resolved' : 'published',
      importance: index < 8 || /critical|blocked|confirmed|approved/.test(lowerType) ? 'major' : 'normal',
      source: 'timeline logs',
      timelineLogIds: [log.id].filter(Boolean),
      proofIds: [String(log.id || '').startsWith('log_') ? String(log.id).slice(4) : null].filter(Boolean),
      affectedAgentIds: uniqueStrings([log.agentId, log.targetAgentId, ...(log.directTargetIds || [])]),
      affectedTaskIds: uniqueStrings([log.taskId, ...(log.taskIds || [])]),
      participantIds: uniqueStrings([log.agentId, log.targetAgentId, ...(log.directTargetIds || [])]),
      relationshipRoles: Object.fromEntries(uniqueStrings([log.agentId, log.targetAgentId, ...(log.directTargetIds || [])]).map((agentId) => [
        agentId,
        agentId === log.agentId ? 'timeline-submitter' : 'timeline-target',
      ])),
      commitAreaKey: log.commitAreaKey || log.timelineSubmission?.commitAreaKey || timelineCommitAreaKey(log.time || fallbackTime),
      commitMessage: log.commitMessage || log.timelineSubmission?.commitMessage || log.log || log.text || 'Timeline commit',
      thinkingFrame: log.thinkingFrame || log.timelineSubmission?.thinkingFrame || null,
      collaborationContext: log.collaborationContext || log.timelineSubmission?.collaborationContext || null,
      submissionId: log.timelineSubmission?.id || null,
      submissionIntent: log.timelineSubmission?.intent || (category === 'submission'
        ? 'Submit a timeline deliverable record.'
        : 'Submit a timeline workflow record generated by Agent activity.'),
      attachmentType: log.timelineSubmission?.attachments?.[0]?.type || (category === 'submission' ? 'timeline-report' : 'timeline-log'),
      attachmentTitle: `${log.agent || log.actor || 'Agent'} timeline attachment`,
      attachments: log.timelineSubmission?.attachments?.length ? log.timelineSubmission.attachments : log.attachments,
    });
    const taskExecutionNodeId = log.taskId ? `task-execution-${log.taskId}` : null;
    if (taskExecutionNodeId && nodesById.has(taskExecutionNodeId)) {
      addEdge({
        type: category === 'submission' ? 'reporting' : 'task_dependency',
        fromNodeId: taskExecutionNodeId,
        toNodeId: nodeId,
        label: category === 'submission' ? 'Report evidence' : 'Timeline progress',
        source: 'timeline logs',
        timelineLogIds: [log.id].filter(Boolean),
        importance: 'normal',
      });
    } else if (log.agentId && nodesById.has(`agent-work-${log.agentId}`)) {
      addEdge({
        type: category === 'submission' ? 'reporting' : 'task_dependency',
        fromNodeId: `agent-work-${log.agentId}`,
        toNodeId: nodeId,
        label: category === 'submission' ? 'Agent report' : 'Agent progress',
        source: 'timeline logs',
        timelineLogIds: [log.id].filter(Boolean),
        importance: 'normal',
      });
    }
  });

  addNode({
    id: 'project-evidence-ledger',
    category: 'evidence',
    subtype: 'timeline-evidence',
    title: 'Project evidence ledger',
    summary: `${project.logs?.length || 0} timeline logs and ${project.eventLedger?.length || 0} ledger events.`,
    status: (project.logs?.length || project.eventLedger?.length) ? 'published' : 'draft',
    importance: 'major',
    source: 'eventLedger',
    timelineLogIds: (project.logs || []).slice(0, 24).map((log) => log.id).filter(Boolean),
    eventIds: (project.eventLedger || []).slice(0, 24).map((event) => event.id).filter(Boolean),
    submissionIntent: 'Submit the project evidence ledger as a traceability attachment.',
    attachmentType: 'evidence-ledger',
    attachmentTitle: 'Project evidence ledger packet',
    route: projectId ? `/projects/${projectId}/events` : null,
  });

  (dashboard.transcriptIndex?.channels || []).forEach((channel) => {
    const nodeId = `project-evidence-transcript-${channel.channelId || channel.id || 'main'}`;
    addNode({
      id: nodeId,
      category: 'evidence',
      subtype: channel.channelId === 'google_chat' ? 'chat-evidence' : channel.channelId === 'main' ? 'meeting-evidence' : 'chat-evidence',
      title: `${channel.name || channel.channelName || channel.channelId || 'Channel'} transcript evidence`,
      summary: `${channel.messageCount || 0} messages, ${channel.recoverableProofCount || channel.proofIds?.length || 0} recoverable proofs.`,
      status: (channel.messageCount || channel.proofIds?.length) ? 'published' : 'draft',
      importance: channel.channelId === 'main' ? 'major' : 'normal',
      source: 'messages',
      proofIds: channel.proofIds || [],
      channelId: channel.channelId || channel.id || 'main',
      submissionIntent: 'Submit transcript evidence as an attachment for graph traceability.',
      attachmentType: channel.channelId === 'main' ? 'meeting-transcript' : 'chat-transcript',
      attachmentTitle: `${channel.name || channel.channelName || channel.channelId || 'Channel'} transcript attachment`,
      route: channel.apiPath || (projectId ? `/projects/${projectId}/transcripts/${channel.channelId || 'main'}` : null),
    });
    addEdge({
      type: 'evidence',
      fromNodeId: 'kickoff-meeting',
      toNodeId: nodeId,
      label: 'Chat evidence',
      source: 'messages',
      proofIds: channel.proofIds || [],
      importance: channel.channelId === 'main' ? 'major' : 'normal',
    });
  });

  const nodes = [...nodesById.values()]
    .map((node, index) => ({
      ...node,
      sequence: index + 1,
      hasProof: Boolean((node.proofIds || []).length || (node.timelineLogIds || []).length || (node.eventIds || []).length),
    }))
    .sort((a, b) => {
      const timeA = Date.parse(a.time) || 0;
      const timeB = Date.parse(b.time) || 0;
      if (timeA !== timeB) return timeA - timeB;
      return MANAGER_FLOW_CATEGORY_ORDER.indexOf(a.category) - MANAGER_FLOW_CATEGORY_ORDER.indexOf(b.category);
    })
    .map((node, index) => ({ ...node, sequence: index + 1 }));
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const edges = [...edgesById.values()].filter((edge) => nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId));
  const relatedByNode = edges.reduce((acc, edge) => {
    acc[edge.fromNodeId] = uniqueStrings([...(acc[edge.fromNodeId] || []), edge.toNodeId]);
    acc[edge.toNodeId] = uniqueStrings([...(acc[edge.toNodeId] || []), edge.fromNodeId]);
    return acc;
  }, {});
  const areaKeyForNode = (node) => node.commitAreaKey || timelineCommitAreaKey(node.time || fallbackTime);
  const groupedLayoutNodes = nodes.reduce((acc, node) => {
    const key = areaKeyForNode(node);
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(node);
    return acc;
  }, new Map());
  const commitAreas = [...groupedLayoutNodes.entries()]
    .map(([key, areaNodes]) => {
      const sortedAreaNodes = areaNodes
        .slice()
        .sort((a, b) => {
          const timeA = Date.parse(a.time) || 0;
          const timeB = Date.parse(b.time) || 0;
          if (timeA !== timeB) return timeA - timeB;
          const importanceRank = { minor: 0, normal: 1, major: 2, critical: 3 };
          const importanceDelta = (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0);
          if (importanceDelta) return importanceDelta;
          return (a.sequence || 0) - (b.sequence || 0);
        });
      return {
        key,
        time: sortedAreaNodes[0]?.time || key,
        nodeIds: sortedAreaNodes.map((node) => node.id),
        branchCount: sortedAreaNodes.length,
      };
    })
    .sort((a, b) => {
      const timeA = Date.parse(a.time) || 0;
      const timeB = Date.parse(b.time) || 0;
      if (timeA !== timeB) return timeA - timeB;
      return String(a.key).localeCompare(String(b.key));
    })
    .map((area, index) => ({ ...area, index }));
  const commitAreaByNodeId = new Map(commitAreas.flatMap((area) => area.nodeIds.map((nodeId, branchIndex) => [
    nodeId,
    {
      key: area.key,
      index: area.index,
      branchIndex,
      branchCount: area.branchCount,
    },
  ])));
  const enrichedNodes = nodes.map((node) => ({
    ...node,
    commitArea: commitAreaByNodeId.get(node.id) || {
      key: areaKeyForNode(node),
      index: 0,
      branchIndex: 0,
      branchCount: 1,
    },
    relatedNodeIds: uniqueStrings([...(node.relatedNodeIds || []), ...(relatedByNode[node.id] || [])]),
  }));
  const countBy = (items, field) => items.reduce((acc, item) => {
    const key = item[field] || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'manager-flow-graph/v1',
    categories: MANAGER_FLOW_CATEGORY_ORDER.map((id) => ({
      id,
      ...MANAGER_FLOW_CATEGORIES[id],
      count: enrichedNodes.filter((node) => node.category === id).length,
    })),
    statuses: ['draft', 'published', 'confirmed', 'superseded', 'blocked', 'resolved', 'archived'],
    importances: ['minor', 'normal', 'major', 'critical'],
    zoomRules: {
      compact: { label: 'Major and critical only', importances: ['major', 'critical'], nodeDetail: 'category-committer' },
      medium: { label: 'Agent working path', categories: ['decision', 'collaboration', 'execution', 'submission', 'monitoring'], nodeDetail: 'commit-summary' },
      expanded: { label: 'Chat, report, evidence, and detail', categories: MANAGER_FLOW_CATEGORY_ORDER, nodeDetail: 'full-card' },
    },
    layout: {
      axis: 'x-time-single-axis',
      source: 'backend-manager-flow-graph',
      sortedBy: ['commitArea.time', 'commitArea.branchIndex', 'sequence'],
      branchPolicy: 'same-time-small-branch-not-y-axis',
      commitAreas,
      nodeLayoutHints: Object.fromEntries(enrichedNodes.map((node) => [node.id, node.commitArea])),
    },
    edgeTypes: Object.entries(MANAGER_FLOW_EDGE_TYPES).map(([id, label]) => ({ id, label })),
    dataSources: {
      eventLedger: project.eventLedger?.length || 0,
      timelineLogs: project.logs?.length || 0,
      messages: allMessages.length,
      tasks: project.tasks?.length || 0,
      agentStates: Object.keys(project.agentStates || {}).length,
      kickoffCharter: Boolean(project.kickoffCharter),
      changeLedger: project.changeLedger?.length || 0,
      managerDashboard: Boolean(dashboard.projectId),
    },
    summary: {
      nodeCount: enrichedNodes.length,
      edgeCount: edges.length,
      proofedNodeCount: enrichedNodes.filter((node) => node.hasProof).length,
      confirmedNodeCount: enrichedNodes.filter((node) => node.status === 'confirmed').length,
      blockedNodeCount: enrichedNodes.filter((node) => node.status === 'blocked').length,
      majorVisibleCount: enrichedNodes.filter((node) => ['major', 'critical'].includes(node.importance)).length,
      byCategory: countBy(enrichedNodes, 'category'),
      byStatus: countBy(enrichedNodes, 'status'),
      byImportance: countBy(enrichedNodes, 'importance'),
    },
    nodes: enrichedNodes,
    edges,
  };
}

export function createAgentProjectService({
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  artifactWriter = null,
  store = createAgentProjectMemoryStore({
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    hydrateProject: hydrateAgentProject,
  }),
} = {}) {
  const persistResult = (result) => {
    if (result.project?.id) {
      store.saveProject(result.project);
    }
    if (result.messages?.length) {
      store.appendMessages(result.messages);
    }
    return {
      ...result,
      messages: result.messages || [],
      allMessages: store.getMessages(result.project?.id),
    };
  };
  const persistMeetingResult = (result) => {
    if (result.meeting?.id && store.saveKickoffMeeting) {
      store.saveKickoffMeeting(result.meeting);
    }
    return persistResult(result);
  };
  const requireKickoffMeeting = (meetingId) => {
    if (!store.getKickoffMeeting) throw new Error(`Kickoff meeting not found: ${meetingId}`);
    return store.getKickoffMeeting(meetingId);
  };

  return {
    listProjects() {
      return store.listProjects();
    },
    listKickoffMeetings() {
      return store.listKickoffMeetings ? store.listKickoffMeetings() : [];
    },
    getKickoffMeeting(meetingId) {
      return requireKickoffMeeting(meetingId);
    },
    createKickoffMeeting(input = {}) {
      const meeting = createKickoffMeetingSession(input);
      if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
      store.saveKickoffMeeting(meeting);
      return {
        meeting,
        messages: [],
        route: 'kickoff-meeting-created',
      };
    },
    clarifyKickoffMeeting({ meetingId, ...input } = {}) {
      const meeting = requireKickoffMeeting(meetingId);
      const clarifiedMeeting = addKickoffMeetingClarification({
        meeting,
        ...input,
      });
      if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
      store.saveKickoffMeeting(clarifiedMeeting);
      return {
        meeting: clarifiedMeeting,
        messages: [],
        route: 'kickoff-meeting-clarified',
      };
    },
    confirmKickoffMeetingLeader({ meetingId, ...input } = {}) {
      const meeting = requireKickoffMeeting(meetingId);
      const confirmedMeeting = confirmKickoffMeetingLeader({
        meeting,
        ...input,
      });
      if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
      store.saveKickoffMeeting(confirmedMeeting);
      return {
        meeting: confirmedMeeting,
        messages: [],
        route: 'kickoff-meeting-leader-confirmed',
      };
    },
    confirmKickoffMeetingNextActions({ meetingId, ...input } = {}) {
      const meeting = requireKickoffMeeting(meetingId);
      const confirmedMeeting = confirmKickoffMeetingNextActions({
        meeting,
        ...input,
      });
      if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
      store.saveKickoffMeeting(confirmedMeeting);
      return {
        meeting: confirmedMeeting,
        messages: [],
        route: 'kickoff-meeting-next-actions-confirmed',
      };
    },
    approveKickoffMeeting({ meetingId, ...input } = {}) {
      const meeting = requireKickoffMeeting(meetingId);
      return persistMeetingResult(approveKickoffMeetingSession({
        meeting,
        ...input,
      }));
    },
    getProject(projectId) {
      return store.getProject(projectId);
    },
    getMessages(projectId) {
      return store.getMessages(projectId);
    },
    getTranscriptIndex(projectId) {
      return buildTranscriptIndex({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
      });
    },
    getChannelTranscript(projectId, channelId = 'main') {
      return buildChannelTranscript({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        channelId,
      });
    },
    getReadinessProofMap(projectId) {
      return buildReadinessProofMap({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
      });
    },
    getManagerDashboard(projectId, options = {}) {
      return localizeReadModel(buildManagerDashboardSnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
      }), options.language || store.getProject(projectId)?.language || 'en');
    },
    getManagerFlowGraph(projectId, options = {}) {
      return localizeReadModel(buildManagerFlowGraphSnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
      }), options.language || store.getProject(projectId)?.language || 'en');
    },
    confirmManagerFlowGraphNode({
      projectId,
      nodeId,
      valid = true,
      note = '',
      actor = 'Director',
      now = nowIso(),
    } = {}) {
      const project = store.getProject(projectId);
      const graph = buildManagerFlowGraphSnapshot({
        project,
        messages: store.getMessages(projectId),
      });
      const node = (graph.nodes || []).find((item) => item.id === nodeId);
      if (!node) throw new Error(`Manager flow graph node not found: ${nodeId}`);

      const timestamp = Date.parse(now) || Date.now();
      const confirmation = {
        nodeId,
        valid: Boolean(valid),
        status: valid ? 'confirmed' : 'superseded',
        confirmedAt: now,
        actor,
        note,
        previousStatus: node.status,
      };
      const log = {
        id: `log_manager_flow_confirm_${nodeId}_${timestamp}`,
        time: now,
        agent: actor,
        actor,
        eventType: valid ? 'manager-flow-node-confirmed' : 'manager-flow-node-superseded',
        source: 'manager-flow-graph',
        channelId: 'manager-flow-graph',
        nodeId,
        log: `${actor} marked manager flow node "${node.title}" as ${confirmation.status}.`,
      };
      const updatedProject = appendProjectEvents({
        ...project,
        managerFlowGraphNodeConfirmations: {
          ...(project.managerFlowGraphNodeConfirmations || {}),
          [nodeId]: confirmation,
        },
        logs: [log, ...(project.logs || [])],
      }, [
        createProjectLedgerEvent({
          id: `evt_manager_flow_confirm_${nodeId}_${timestamp}`,
          type: log.eventType,
          time: now,
          actor,
          summary: log.log,
          source: 'manager-flow-graph',
          channelId: 'manager-flow-graph',
          evidenceIds: [log.id, ...((node.proofIds || []).slice(0, 8))],
          entityIds: {
            projectId,
            nodeId,
            taskId: node.taskId || null,
            agentId: node.agentId || null,
            logId: log.id,
          },
          payload: {
            valid: Boolean(valid),
            previousStatus: node.status,
            note,
          },
        }),
      ]);
      store.saveProject(updatedProject);
      return {
        route: 'manager-flow-graph-node-confirmed',
        project: updatedProject,
        messages: [],
        confirmation,
        managerFlowGraph: buildManagerFlowGraphSnapshot({
          project: updatedProject,
          messages: store.getMessages(projectId),
        }),
      };
    },
    getManagerCommandCenter(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerCommandCenter;
    },
    runManagerCommandCenterNext({
      projectId,
      requestBodyOverrides = {},
      now = nowIso(),
      force = false,
    } = {}) {
      const commandCenter = this.getManagerCommandCenter(projectId);
      const nextAction = commandCenter.nextBestAction;
      if (!nextAction) throw new Error('Manager command center has no next action.');
      if (!nextAction.canRun && !force) {
        throw new Error(`Manager command center next action is not runnable: ${nextAction.label || nextAction.id}`);
      }
      const actionId = nextAction.requirementId || nextAction.id;
      const result = this.runManagerActionQueueItem({
        projectId,
        actionId,
        requestBodyOverrides,
        now,
        force,
      });
      const updatedProjectId = result.project?.id || projectId;
      return {
        ...result,
        route: 'manager-command-center-run-next',
        managerCommandCenterRun: {
          id: `manager_command_run_${projectId}_${actionId}_${Date.parse(now) || Date.now()}`,
          actionId: nextAction.id,
          requirementId: nextAction.requirementId || null,
          actionLabel: nextAction.label || actionId,
          commandCenterStatusBeforeRun: commandCenter.status,
          executedAt: now,
          delegatedRunApiPath: result.managerActionRun?.runApiPath || nextAction.runApiPath || null,
          resultMessageIds: result.managerActionRun?.resultMessageIds || [],
          timelineLogIds: result.managerActionRun?.timelineLogIds || [],
          eventIds: result.managerActionRun?.eventIds || [],
        },
        managerCommandCenter: this.getManagerCommandCenter(updatedProjectId, { language: requestBodyOverrides.language }),
        managerReadyPackage: this.getManagerReadyPackage(updatedProjectId, { language: requestBodyOverrides.language }),
      };
    },
    getManagerScenarioTrail(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerScenarioTrail;
    },
    getManagerScenarioWalkthrough(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerScenarioWalkthrough;
    },
    runManagerScenarioWalkthroughStep({
      projectId,
      stepId = 'next',
      requestBodyOverrides = {},
      now = nowIso(),
      force = false,
    } = {}) {
      const walkthrough = this.getManagerScenarioWalkthrough(projectId);
      const step = stepId === 'next'
        ? walkthrough.nextStep
        : (walkthrough.rows || []).find((row) => row.id === stepId);
      if (!step) throw new Error(`Manager walkthrough step not found: ${stepId}`);
      const primaryActionId = step.primaryAction?.requirementId || step.primaryRequirementId;
      if (!primaryActionId) throw new Error(`Manager walkthrough step has no primary action: ${step.id}`);
      const result = this.runManagerActionQueueItem({
        projectId,
        actionId: primaryActionId,
        requestBodyOverrides,
        now,
        force,
      });
      const projectAfterRun = result.project?.id || projectId;
      const resultInspection = {
        stepId: step.id,
        stage: step.stage,
        delegatedActionId: primaryActionId,
        actionLabel: result.managerAction?.label || step.primaryAction?.label || primaryActionId,
        messageCount: result.managerActionRun?.resultMessageCount || result.messages?.length || 0,
        messageIds: result.managerActionRun?.resultMessageIds || (result.messages || []).map((message) => message.id).filter(Boolean),
        timelineLogIds: result.managerActionRun?.timelineLogIds || [result.managerActionLog?.id].filter(Boolean),
        eventIds: result.managerActionRun?.eventIds || [],
        taskId: result.managerActionRun?.resultTaskId || result.task?.id || null,
        cycleId: result.managerActionRun?.resultCycleId || result.cycle?.id || null,
        runApiPath: `/projects/${projectId}/manager-scenario-walkthrough/${encodeURIComponent(step.id)}/run`,
        delegatedRunApiPath: result.managerActionRun?.runApiPath || result.managerAction?.runApiPath || null,
        proofRoute: projectId ? `/projects/${projectId}/timeline` : null,
      };
      return {
        ...result,
        route: 'manager-scenario-walkthrough-step-run',
        managerScenarioWalkthroughStep: {
          ...step,
          executedAt: now,
          delegatedActionId: primaryActionId,
          runRoute: `/projects/${projectId}/manager-scenario-walkthrough/${encodeURIComponent(step.id)}/run`,
          resultInspection,
        },
        resultInspection,
        managerScenarioWalkthrough: this.getManagerScenarioWalkthrough(projectAfterRun, { language: requestBodyOverrides.language }),
      };
    },
    getManagerRequirementMatrix(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerRequirementMatrix;
    },
    getManagerUseCaseAudit(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerUseCaseAudit;
    },
    getManagerActionQueue(projectId, options = {}) {
      return this.getManagerDashboard(projectId, options).managerActionQueue;
    },
    runManagerActionQueueItem({
      projectId,
      actionId = 'next',
      requestBodyOverrides = {},
      now = nowIso(),
      force = false,
    } = {}) {
      const actionQueue = this.getManagerActionQueue(projectId);
      const row = actionId === 'next'
        ? actionQueue.nextAction
        : (actionQueue.rows || []).find((item) => (
          item.id === actionId
          || item.requirementId === actionId
          || item.id === `manager-action-${actionId}`
        ));
      if (!row) throw new Error(`Manager action not found: ${actionId}`);
      if ((row.method || 'GET') === 'GET') throw new Error(`Manager action is read-only: ${row.requirementId || row.id}`);
      if (row.routeResolved === false || String(row.apiPath || '').includes(':')) {
        throw new Error(`Manager action route is not resolved: ${row.apiPath || row.requirementId || row.id}`);
      }
      if (row.status === 'blocked' && !force) {
        throw new Error(`Manager action is blocked: ${row.requirementId || row.id}`);
      }
      if (row.status === 'complete' && !row.rerunnable && !force) {
        throw new Error(`Manager action is complete and not rerunnable: ${row.requirementId || row.id}`);
      }
      const requestBody = {
        ...materializeActionTemplate(row.requestBodyTemplate || {}, now),
        ...requestBodyOverrides,
      };
      let result;
      const apiPath = String(row.apiPath || '');
      const kickoffRoute = extractKickoffActionFromPath(apiPath);
      const agentId = extractAgentIdFromActionPath(apiPath);

      if (kickoffRoute) {
        if (kickoffRoute.action === 'create') {
          result = this.createKickoffMeeting({ ...requestBody, now });
        } else if (kickoffRoute.action === 'clarify') {
          result = this.clarifyKickoffMeeting({ meetingId: kickoffRoute.meetingId, ...requestBody, now });
        } else if (kickoffRoute.action === 'leader') {
          result = this.confirmKickoffMeetingLeader({ meetingId: kickoffRoute.meetingId, ...requestBody, now });
        } else if (kickoffRoute.action === 'next-actions') {
          result = this.confirmKickoffMeetingNextActions({ meetingId: kickoffRoute.meetingId, ...requestBody, now });
        } else if (kickoffRoute.action === 'approve') {
          result = this.approveKickoffMeeting({ meetingId: kickoffRoute.meetingId, ...requestBody, now });
        } else {
          throw new Error(`Unsupported kickoff manager action: ${apiPath}`);
        }
      } else if (agentId) {
        result = this.runAgentWorkCycle({ projectId, agentId, ...requestBody, now });
      } else if (apiPath.endsWith('/chat')) {
        result = this.submitChatMessage({ projectId, ...requestBody, now });
      } else if (apiPath.endsWith('/meeting')) {
        result = this.submitMeetingMessage({ projectId, ...requestBody, now });
      } else if (apiPath.endsWith('/change-request')) {
        result = this.submitMultiChannelChangeRequest({ projectId, ...requestBody, now });
      } else if (apiPath.endsWith('/autonomous-cycle')) {
        result = this.runAutonomousCycle({ projectId, ...requestBody, now });
      } else {
        throw new Error(`Unsupported manager action route: ${apiPath}`);
      }

      const projectAfterAction = result.project?.id ? result.project : store.getProject(projectId);
      const actionKey = row.requirementId || row.id || 'manager-action';
      const timestamp = Date.parse(now) || Date.now();
      const actionRunId = `manager_action_run_${projectId}_${actionKey}_${timestamp}`;
      const actionRunLog = {
        id: `log_${actionRunId}`,
        time: now,
        agent: 'Manager Action Playbook',
        actor: 'Manager Action Playbook',
        eventType: 'manager-action-run',
        source: 'manager-action-playbook',
        channelId: 'manager-dashboard',
        actionId: row.id,
        requirementId: row.requirementId,
        actionLabel: row.label,
        route: row.runApiPath || `/projects/${projectId}/manager-action-queue/${encodeURIComponent(actionKey)}/run`,
        apiPath,
        runApiPath: row.runApiPath || `/projects/${projectId}/manager-action-queue/${encodeURIComponent(actionKey)}/run`,
        log: `Manager ran "${row.label}" from the Action Queue playbook.`,
      };
      const actionRunEventId = `evt_${actionRunId}`;
      const resultMessageIds = uniqueStrings((result.messages || []).map((message) => message.id));
      const resultTimelineLogIds = uniqueStrings([
        actionRunLog.id,
        result.log?.id,
        result.cycle?.logId,
        ...(result.task?.timelineLogIds || []),
      ]);
      const actionRunLedgerItem = {
        id: actionRunId,
        actionId: row.id,
        requirementId: row.requirementId,
        actionLabel: row.label,
        statusBeforeRun: row.status,
        method: row.method,
        apiPath,
        runApiPath: actionRunLog.runApiPath,
        requestBody,
        executedAt: now,
        logId: actionRunLog.id,
        timelineLogIds: resultTimelineLogIds,
        eventIds: [actionRunEventId],
        resultMessageIds,
        resultRoute: result.route || null,
        resultMessageCount: result.messages?.length || 0,
        resultCycleId: result.cycle?.id || null,
        resultTaskId: result.task?.id || null,
      };
      const managerActionProject = appendProjectEvents({
        ...projectAfterAction,
        logs: [actionRunLog, ...(projectAfterAction.logs || [])],
        managerActionRunLedger: [actionRunLedgerItem, ...(projectAfterAction.managerActionRunLedger || [])].slice(0, 100),
      }, [
        createProjectLedgerEvent({
          id: actionRunEventId,
          type: 'manager-action-run',
          time: now,
          actor: 'Manager Action Playbook',
          summary: actionRunLog.log,
          source: 'manager-action-playbook',
          channelId: 'manager-dashboard',
          evidenceIds: uniqueStrings([
            actionRunLog.id,
            result.log?.id,
            result.cycle?.logId,
            ...(result.messages || []).map((message) => message.id),
          ]),
          entityIds: {
            projectId,
            actionId: row.id,
            requirementId: row.requirementId,
            logId: actionRunLog.id,
            taskId: result.task?.id || null,
          },
          payload: {
            method: row.method,
            apiPath,
            runApiPath: actionRunLog.runApiPath,
            requestBody,
            statusBeforeRun: row.status,
          },
        }),
      ]);
      store.saveProject(managerActionProject);

      return {
        ...result,
        project: managerActionProject,
        route: 'manager-action-queue-item-run',
        managerAction: {
          ...row,
          executedAt: now,
          requestBody,
          runRoute: `/projects/${projectId}/manager-action-queue/${encodeURIComponent(row.requirementId || row.id)}/run`,
        },
        managerActionRun: actionRunLedgerItem,
        managerActionLog: actionRunLog,
        managerActionQueue: this.getManagerActionQueue(result.project?.id || projectId, { language: requestBodyOverrides.language }),
      };
    },
    getManagerReadyPackage(projectId, options = {}) {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      return localizeReadModel({
        projectId,
        status: managerDashboard.readiness?.status || 'unknown',
        ready: managerDashboard.readiness?.status === 'manager-ready',
        score: managerDashboard.readiness?.score || 0,
        generatedAt: nowIso(),
        managerDashboard,
        managerFlowGraph,
        managerCommandCenter: managerDashboard.managerCommandCenter,
        managerScenarioTrail: managerDashboard.managerScenarioTrail,
        managerScenarioWalkthrough: managerDashboard.managerScenarioWalkthrough,
        managerRequirementMatrix: managerDashboard.managerRequirementMatrix,
        syncProtocolAudit: managerDashboard.syncProtocolAudit,
        managerUseCaseAudit: managerDashboard.managerUseCaseAudit,
        managerActionQueue: managerDashboard.managerActionQueue,
        managerActionRuns: managerDashboard.managerActionRuns,
        managerActionContext: managerDashboard.managerActionContext,
        readinessProofMap: managerDashboard.readinessProofMap,
        transcriptIndex: managerDashboard.transcriptIndex,
        operationsBoard: managerDashboard.operationsBoard,
        backendRoutes: managerDashboard.backendRoutes,
        summary: {
          proofRouteCount: managerDashboard.readinessProofMap?.routes?.length || 0,
          commandCenterAttentionCount: managerDashboard.managerCommandCenter?.attentionCount || 0,
          commandCenterCriticalCount: managerDashboard.managerCommandCenter?.criticalCount || 0,
          kickoffBoardReadyCount: managerDashboard.managerCommandCenter?.kickoffBoard?.readyCount || 0,
          kickoffBoardCount: managerDashboard.managerCommandCenter?.kickoffBoard?.count || 0,
          workLoopRunningCount: managerDashboard.managerCommandCenter?.workLoopBoard?.runningCount || 0,
          workLoopCount: managerDashboard.managerCommandCenter?.workLoopBoard?.count || 0,
          collaborationReadyCount: managerDashboard.managerCommandCenter?.collaborationBoard?.readyCount || 0,
          collaborationBoardCount: managerDashboard.managerCommandCenter?.collaborationBoard?.count || 0,
          changeProtocolReadyCount: managerDashboard.managerCommandCenter?.changeProtocolBoard?.readyCount || 0,
          changeProtocolBoardCount: managerDashboard.managerCommandCenter?.changeProtocolBoard?.count || 0,
          changeOwnerReadyCount: managerDashboard.managerCommandCenter?.changeReadyCount || 0,
          changeOwnerCount: managerDashboard.managerCommandCenter?.changeRows?.length || 0,
          scenarioTrailReadyCount: managerDashboard.managerScenarioTrail?.passedCount || 0,
          scenarioTrailCount: managerDashboard.managerScenarioTrail?.count || 0,
          walkthroughCompletedCount: managerDashboard.managerScenarioWalkthrough?.completedCount || 0,
          walkthroughCount: managerDashboard.managerScenarioWalkthrough?.count || 0,
          walkthroughRunnableCount: managerDashboard.managerScenarioWalkthrough?.runnableCount || 0,
          requirementReadyCount: managerDashboard.managerRequirementMatrix?.passedCount || 0,
          requirementCount: managerDashboard.managerRequirementMatrix?.count || 0,
          syncProtocolSyncedCount: managerDashboard.syncProtocolAudit?.syncedCount || 0,
          syncProtocolCount: managerDashboard.syncProtocolAudit?.count || 0,
          useCaseCoveredCount: managerDashboard.managerUseCaseAudit?.coveredCount || 0,
          useCaseCount: managerDashboard.managerUseCaseAudit?.count || 0,
          actionQueueReadyCount: managerDashboard.managerActionQueue?.readyCount || 0,
          actionQueueCompletedCount: managerDashboard.managerActionQueue?.completedCount || 0,
          actionQueueCount: managerDashboard.managerActionQueue?.count || 0,
          actionQueueUnresolvedRouteCount: managerDashboard.managerActionQueue?.unresolvedRouteCount || 0,
          managerActionRunCount: managerDashboard.managerActionRuns?.count || 0,
          transcriptChannelCount: managerDashboard.transcriptIndex?.channels?.length || 0,
          operationsAgentCount: managerDashboard.operationsBoard?.agents?.length || 0,
          changeCount: managerDashboard.changeFlow?.count || 0,
          assignmentCount: managerDashboard.assignmentFlow?.count || 0,
          flowGraphNodeCount: managerFlowGraph.summary?.nodeCount || 0,
          flowGraphEdgeCount: managerFlowGraph.summary?.edgeCount || 0,
          flowGraphProofedNodeCount: managerFlowGraph.summary?.proofedNodeCount || 0,
        },
      }, language);
    },
    getAgentDashboard(projectId, agentId) {
      return buildAgentDashboardSnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        agentId,
      });
    },
    getTimeline(projectId) {
      const project = store.getProject(projectId);
      return {
        projectId,
        logs: project.logs || [],
        logCount: project.logs?.length || 0,
      };
    },
    getEventLedger(projectId) {
      const project = store.getProject(projectId);
      return {
        projectId,
        eventLedger: project.eventLedger || [],
        summary: summarizeProjectEventLedger(project),
      };
    },
    listTasks(projectId) {
      const project = store.getProject(projectId);
      return (project.tasks || []).map((task) => ({
        ...task,
        projectId,
      }));
    },
    getTask(projectId, taskId) {
      const task = (store.getProject(projectId).tasks || []).find((item) => String(item.id) === String(taskId));
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return {
        ...task,
        projectId,
      };
    },
    getTaskEvidence(projectId, taskId) {
      return {
        projectId,
        ...getTaskEvidenceFromProject({
          project: store.getProject(projectId),
          taskId,
          messages: store.getMessages(projectId),
        }),
      };
    },
    listAgentStates(projectId) {
      const project = store.getProject(projectId);
      return Object.values(project.agentStates || {}).map((state) => ({
        ...state,
        projectId,
      }));
    },
    getAgentState(projectId, agentId) {
      const project = store.getProject(projectId);
      const state = project.agentStates?.[agentId]
        || Object.values(project.agentStates || {}).find((item) => item.agentId === agentId || item.name === agentId);
      if (!state) throw new Error(`Agent state not found: ${agentId}`);
      return {
        ...state,
        projectId,
      };
    },
    replaceProject(project) {
      return store.saveProject(project);
    },
    initiateProject(input = {}) {
      return persistResult(createKickoffProjectFromMeeting(input));
    },
    submitChatMessage({ projectId, ...input }) {
      return persistResult(submitProjectChatMessage({
        project: store.getProject(projectId),
        ...input,
      }));
    },
    submitMeetingMessage({ projectId, ...input }) {
      return persistResult(submitProjectMeetingMessage({
        project: store.getProject(projectId),
        ...input,
      }));
    },
    submitMultiChannelChangeRequest({ projectId, ...input }) {
      return persistResult(submitProjectMultiChannelChangeRequest({
        project: store.getProject(projectId),
        ...input,
      }));
    },
    submitAgentMessage({ projectId, agentId, ...input }) {
      return persistResult(submitAgentMessage({
        project: store.getProject(projectId),
        agentId,
        ...input,
      }));
    },
    runAutonomousCycle({ projectId, ...input }) {
      return persistResult(runProjectAutonomousCycle({
        project: store.getProject(projectId),
        messages: input.messages || store.getMessages(projectId),
        ...input,
      }));
    },
    runAgentWorkCycle({ projectId, agentId, ...input }) {
      return persistResult(runAgentWorkCycle({
        project: store.getProject(projectId),
        agentId,
        artifactWriter,
        ...input,
      }));
    },
    runDueAutonomousCycles(input = {}) {
      const summary = runDueProjectAutonomousCycles({
        projects: store.listProjects(),
        getMessages: (projectId) => store.getMessages(projectId),
        ...input,
      });
      summary.processed.forEach((item) => {
        store.saveProject(item.result.project);
      });
      if (summary.messages.length) {
        store.appendMessages(summary.messages);
      }
      return {
        ...summary,
        allMessages: store.getMessages(),
      };
    },
    runDueAgentWorkCycles(input = {}) {
      const summary = runDueAgentWorkCycles({
        projects: store.listProjects(),
        ...input,
      });
      summary.projects.forEach((project) => {
        store.saveProject(project);
      });
      if (summary.messages.length) {
        store.appendMessages(summary.messages);
      }
      return {
        ...summary,
        allMessages: store.getMessages(),
      };
    },
    evaluateReadiness(projectId) {
      const project = store.getProject(projectId);
      return evaluateManagerScenarioReadiness({
        project,
        team: project.team || [],
        messages: store.getMessages(projectId),
      });
    },
    snapshot() {
      return store.snapshot();
    },
  };
}
