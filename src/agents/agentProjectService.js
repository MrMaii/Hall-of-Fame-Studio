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
import {
  REDACTED,
  redactSensitiveObject,
  redactSensitiveText,
  redactUrl,
} from './secretRedaction.js';
import { buildAccessControlPolicySnapshot } from './accessControl.js';
import { createSecretVaultFromEnv, normalizeSecretVaultStatus } from './secretVault.js';
import { createManagedPersistenceAdapterFromEnv, managedPersistenceAdapterStatus } from './managedPersistenceAdapter.js';
import { createWorkerQueueAdapterFromEnv, workerQueueAdapterStatus } from './workerQueueAdapter.js';
import { createHttpJsonAdapterGatewayClient } from './adapterGatewayClient.js';
import { createTranslator, localizeText, normalizeLanguage } from '../i18n/runtime.js';

const nowIso = () => new Date().toISOString();
const DEFAULT_AGENT_WORK_INTERVAL_MS = 30 * 60 * 1000;
const WORKER_QUEUE_RECOMMENDED_LEASE_SECONDS = 300;
const WORKER_QUEUE_MAX_ATTEMPTS = 3;
const WORKER_QUEUE_RETRY_BACKOFF_SECONDS = [30, 120, 300];
const MODEL_INTENT_LEDGER_LIMIT = 120;
const AGENT_SUBMISSION_LIMIT = 240;
const AGENT_EVIDENCE_SEARCH_LIMIT = 240;
const AGENT_SUBMISSION_REVIEW_LIMIT = 240;
const SECURITY_ACCESS_AUDIT_LIMIT = 240;
const PROJECT_MEMBERSHIP_AUDIT_LIMIT = 80;
const IDENTITY_SESSION_LIMIT = 120;
const PROVIDER_USAGE_LEDGER_LIMIT = 240;
const PROJECT_EVIDENCE_EXPORT_LIMIT = 120;
const SECURITY_AUDIT_STREAM_GENESIS_HASH = 'stream_genesis_v1';
const AGENT_SUBMISSION_ARTIFACT_TYPES = new Set([
  'discovery-report',
  'research-report',
  'evidence-packet',
  'brainstorm-board',
  'product-brief',
  'decision-proposal',
  'risk-review',
  'implementation-plan',
  'progress-brief',
  'revision-note',
  'final-deliverable',
]);
const AGENT_SUBMISSION_STATUSES = new Set([
  'drafting',
  'submitted',
  'under-review',
  'accepted',
  'changes-requested',
  'superseded',
  'final',
]);
const AGENT_EVIDENCE_SEARCH_STATUSES = new Set([
  'planned',
  'running',
  'completed',
  'blocked',
  'superseded',
]);
const AGENT_SUBMISSION_REVIEW_STATUSES = new Set([
  'under-review',
  'accepted',
  'changes-requested',
  'rejected',
]);

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

function commandShouldRequestModelIntent(command = '') {
  return /^POST\s+/i.test(command)
    && !/\/llm\//i.test(command)
    && !/\/manager-flow-graph\/nodes\/[^/]+\/confirm/i.test(command);
}

function compactModelIntent(value = {}) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => (
    item !== undefined
    && item !== null
    && (!(Array.isArray(item)) || item.length > 0)
    && (!(typeof item === 'string') || item.trim())
  )));
}

function modelIntentSummary(record = {}) {
  const intent = record.intent || {};
  if (typeof intent.intent === 'string' && intent.intent.trim()) return intent.intent.trim();
  if (typeof record.content === 'string' && record.content.trim()) return record.content.trim().slice(0, 220);
  if (record.error) return `Model intent failed: ${record.error}`;
  return 'Model intent recorded.';
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

function normalizeWorkerKind(workerKind = '') {
  const value = String(workerKind || '').toLowerCase();
  if (value === 'agent-work' || value === 'agent-worker') return 'agent-worker';
  if (value === 'project-scheduler') return 'project-scheduler';
  if (value === 'project-autonomous' || value === 'autonomous-cycle') return 'project-autonomous';
  return value || 'worker';
}

function workerQueueKind(workerKind = '') {
  const normalized = normalizeWorkerKind(workerKind);
  if (normalized === 'agent-worker') return 'agent-work';
  if (normalized === 'project-scheduler') return 'project-autonomous';
  return normalized;
}

function workerRunApiPath(workerKind = '') {
  return normalizeWorkerKind(workerKind) === 'agent-worker'
    ? '/workers/agents/due'
    : '/workers/autonomous/due';
}

function workerDirectRunApiPath({ workerKind = '', projectId = '', agentId = '' } = {}) {
  const encodedProjectId = encodeURIComponent(projectId || '');
  if (normalizeWorkerKind(workerKind) === 'agent-worker') {
    return `/projects/${encodedProjectId}/agents/${encodeURIComponent(agentId || '')}/work-cycle`;
  }
  return `/projects/${encodedProjectId}/autonomous-cycle`;
}

function workerRunReason(run = {}) {
  return run.queueReason || run.reason || run.schedulerReason || run.trigger || null;
}

function buildWorkerIdempotencyKey({
  workerKind = '',
  projectId = '',
  agentId = null,
  dueAt = null,
  reason = null,
} = {}) {
  const queueKind = workerQueueKind(workerKind);
  const payload = {
    workerKind: queueKind,
    projectId,
    dueAt,
  };
  if (agentId) payload.agentId = agentId;
  if (queueKind === 'project-autonomous') payload.trigger = reason;
  else payload.reason = reason;
  return persistenceChecksum(payload);
}

function workerExecutionSucceeded(run = {}) {
  const explicitStatus = String(
    run.executionStatus
    || run.executionReceipt?.status
    || run.workerStatus
    || run.runStatus
    || ''
  ).toLowerCase();
  if (/dead|fail|error|timeout|exception/.test(explicitStatus)) return false;
  if (/success|succeed|complete|ack/.test(explicitStatus)) return true;

  const businessStatus = String(run.status || '').toLowerCase();
  if (/dead|fail|error|timeout|exception/.test(businessStatus)) return false;
  return true;
}

function addSecondsIso(value, seconds = 0) {
  const base = safeDateMs(value, Date.now());
  return new Date(base + (Number(seconds) || 0) * 1000).toISOString();
}

function buildWorkerRetryState({
  status = 'succeeded',
  attemptCount = 1,
  now = nowIso(),
  existing = null,
} = {}) {
  if (existing?.schemaVersion === 'worker-retry-state/v1') return existing;
  const resolvedAttemptCount = Math.max(0, Number(attemptCount) || 0);
  const failed = !['succeeded', 'queued', 'waiting', 'deferred'].includes(String(status || '').toLowerCase());
  const retryable = Boolean(failed && resolvedAttemptCount > 0 && resolvedAttemptCount < WORKER_QUEUE_MAX_ATTEMPTS);
  const backoffSeconds = WORKER_QUEUE_RETRY_BACKOFF_SECONDS[Math.min(
    Math.max(resolvedAttemptCount - 1, 0),
    WORKER_QUEUE_RETRY_BACKOFF_SECONDS.length - 1,
  )] || WORKER_QUEUE_RETRY_BACKOFF_SECONDS[0];
  return {
    schemaVersion: 'worker-retry-state/v1',
    attemptCount: resolvedAttemptCount,
    maxAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
    backoffSeconds: WORKER_QUEUE_RETRY_BACKOFF_SECONDS,
    retryable,
    nextRetryAt: retryable ? addSecondsIso(now, backoffSeconds) : null,
    deadLettered: Boolean(failed && resolvedAttemptCount >= WORKER_QUEUE_MAX_ATTEMPTS),
  };
}

function buildQueuedWorkerControlFields({ idempotencyKey = '', leaseKey = '', status = 'queued' } = {}) {
  return {
    attemptCount: 0,
    maxAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
    executionReceiptExpected: true,
    leaseSeconds: WORKER_QUEUE_RECOMMENDED_LEASE_SECONDS,
    retry: buildWorkerRetryState({ status, attemptCount: 0 }),
    deadLetter: null,
    recovery: {
      rerunByIdempotencyKey: true,
      idempotencyKey,
      leaseKey,
      deadLetterAfterAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
    },
  };
}

function buildWorkerRunControlFields(run = {}, {
  projectId = run.projectId,
  workerKind = run.workerKind,
  now = nowIso(),
} = {}) {
  const resolvedWorkerKind = normalizeWorkerKind(workerKind || run.workerKind);
  const resolvedProjectId = run.projectId || projectId || null;
  const reason = workerRunReason(run);
  const ranAt = run.ranAt || run.time || run.startedAt || run.completedAt || now;
  const dueAt = run.dueAt || ranAt;
  const idempotencyKey = run.idempotencyKey || buildWorkerIdempotencyKey({
    workerKind: resolvedWorkerKind,
    projectId: resolvedProjectId,
    agentId: run.agentId || null,
    dueAt,
    reason,
  });
  const leaseKey = run.leaseKey || `lease:${idempotencyKey}`;
  const executionStatus = workerExecutionSucceeded(run) ? 'succeeded' : 'failed';
  const attemptCount = Math.max(1, Number(run.retry?.attemptCount || run.attemptCount || 1) || 1);
  const retry = buildWorkerRetryState({
    status: executionStatus,
    attemptCount,
    now: ranAt,
    existing: run.retry,
  });
  const messageIds = uniqueStrings([
    run.messageId,
    ...(run.messageIds || []),
  ].filter(Boolean));
  const timelineLogIds = uniqueStrings([
    run.logId,
    ...(run.timelineLogIds || []),
  ].filter(Boolean));
  const receiptPayload = {
    runId: run.id || null,
    projectId: resolvedProjectId,
    workerKind: resolvedWorkerKind,
    agentId: run.agentId || null,
    taskId: run.taskId || null,
    status: executionStatus,
    idempotencyKey,
    leaseKey,
    dueAt,
    ranAt,
    completedAt: run.completedAt || ranAt,
    messageIds,
    timelineLogIds,
  };
  const executionReceipt = run.executionReceipt?.schemaVersion === 'worker-execution-receipt/v1'
    ? run.executionReceipt
    : {
      schemaVersion: 'worker-execution-receipt/v1',
      runId: run.id || null,
      projectId: resolvedProjectId,
      workerKind: resolvedWorkerKind,
      agentId: run.agentId || null,
      status: executionStatus,
      acked: executionStatus === 'succeeded',
      idempotencyKey,
      leaseKey,
      receivedAt: run.completedAt || ranAt,
      messageIds,
      timelineLogIds,
      receiptChecksum: persistenceChecksum(receiptPayload),
    };
  const deadLetter = run.deadLetter || (retry.deadLettered ? {
    schemaVersion: 'worker-dead-letter/v1',
    id: `dead_${idempotencyKey}`,
    runId: run.id || null,
    projectId: resolvedProjectId,
    workerKind: resolvedWorkerKind,
    agentId: run.agentId || null,
    status: 'dead-lettered',
    reason: reason || 'worker-failed-after-retries',
    attemptCount: retry.attemptCount,
    maxAttempts: retry.maxAttempts,
    queuedAt: run.completedAt || ranAt,
    recoveryApiPath: workerRunApiPath(resolvedWorkerKind),
    directRecoveryApiPath: workerDirectRunApiPath({
      workerKind: resolvedWorkerKind,
      projectId: resolvedProjectId,
      agentId: run.agentId || null,
    }),
    idempotencyKey,
    leaseKey,
  } : null);

  return {
    workerKind: resolvedWorkerKind,
    projectId: resolvedProjectId,
    idempotencyKey,
    leaseKey,
    executionStatus,
    attemptCount,
    maxAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
    retry,
    executionReceipt,
    deadLetter,
  };
}

function withWorkerRunControlFields(run = {}, options = {}) {
  return {
    ...run,
    ...buildWorkerRunControlFields(run, options),
  };
}

function workerRunsForProject(project = {}) {
  const projectId = project.id || null;
  return [
    ...(project.autonomousLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'project-autonomous' })),
    ...(project.autonomousSchedulerLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'project-scheduler' })),
    ...(project.agentWorkerLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'agent-worker' })),
  ];
}

function attachWorkerRunControlsToProject(project = {}) {
  const projectId = project.id || null;
  return {
    ...project,
    autonomousLedger: (project.autonomousLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'project-autonomous' })),
    autonomousSchedulerLedger: (project.autonomousSchedulerLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'project-scheduler' })),
    agentWorkerLedger: (project.agentWorkerLedger || []).map((run) => withWorkerRunControlFields(run, { projectId, workerKind: 'agent-worker' })),
  };
}

export function hydrateAgentProject(project = {}) {
  return attachWorkerRunControlsToProject(backfillProjectEventLedger(project));
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
    project: attachWorkerRunControlsToProject(publishedCycle.project),
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
  queueReason = null,
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
  const artifactDraft = redactSensitiveObject(buildAgentArtifactDraft({
    project,
    agent,
    task,
    workText,
    workSummary,
    now,
    completed,
    cycleId,
  }));
  const writtenArtifact = typeof artifactWriter === 'function'
    ? artifactWriter(artifactDraft, { project, agent, task, now, completed, cycleId })
    : null;
  const redactedWrittenArtifact = redactSensitiveObject(writtenArtifact || {});
  const artifactRecord = {
    ...artifactDraft,
    ...redactedWrittenArtifact,
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
      withWorkerRunControlFields({
        id: cycleId,
        agentId: agent.id,
        taskId: task?.id || null,
        trigger,
        queueReason,
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
      }, { projectId: project.id, workerKind: 'agent-worker', now }),
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

export function submitAgentArtifact({
  project = {},
  agentId,
  artifactType = 'progress-brief',
  title = '',
  summary = '',
  body = '',
  taskId = null,
  status = 'submitted',
  reviewStatus = 'pending-review',
  reviewerAgentId = null,
  dependsOn = [],
  revisesSubmissionId = null,
  revisionOfSubmissionId = null,
  respondsToReviewId = null,
  supersedesSubmissionIds = [],
  sourceRefs = [],
  tags = [],
  channelId = 'main',
  now = nowIso(),
  artifactWriter = null,
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const leader = team.find((member) => member.isLeader) || team[0] || null;
  const reviewer = team.find((member) => (
    reviewerAgentId
      ? member.id === reviewerAgentId || member.name === reviewerAgentId
      : (member.id !== agent.id && (/review|evidence|qa|critic|risk/i.test(`${member.role || ''} ${member.title || ''} ${member.skill || ''}`)))
  )) || team.find((member) => member.id !== agent.id && member.id !== leader?.id) || leader || null;
  const task = taskId
    ? (project.tasks || []).find((item) => String(item.id) === String(taskId))
    : null;
  if (taskId && !task) throw new Error(`Task not found: ${taskId}`);
  const explicitReview = respondsToReviewId
    ? (project.submissionReviews || []).find((item) => String(item.id) === String(respondsToReviewId))
    : null;
  if (respondsToReviewId && !explicitReview) throw new Error(`Submission review not found: ${respondsToReviewId}`);
  const explicitRevisionTargetId = revisesSubmissionId || revisionOfSubmissionId || explicitReview?.submissionId || null;
  const revisionTarget = explicitRevisionTargetId
    ? (project.agentSubmissions || []).find((item) => String(item.id) === String(explicitRevisionTargetId))
    : null;
  if (explicitRevisionTargetId && !revisionTarget) throw new Error(`Revision target submission not found: ${explicitRevisionTargetId}`);

  const normalizedType = normalizeAgentSubmissionArtifactType(artifactType);
  const normalizedStatus = normalizeAgentSubmissionStatus(status);
  const timestamp = Date.parse(now) || Date.now();
  const submissionId = `agent_submission_${project.id || 'project'}_${agent.id}_${normalizedType}_${timestamp}`;
  const safeTitle = redactSensitiveText(String(title || '').trim() || `${agent.name || 'Agent'} ${normalizedType.replace(/-/g, ' ')}`);
  const safeSummary = redactSensitiveText(String(summary || '').trim()
    || `${agent.name || 'Agent'} submitted ${safeTitle} for manager review.`);
  const content = redactSensitiveText(String(body || '').trim() || [
    `# ${safeTitle}`,
    '',
    safeSummary,
    '',
    `- Submitter: ${agent.name || agent.id}`,
    `- Artifact type: ${normalizedType}`,
    task ? `- Linked task: ${task.text || task.id}` : null,
    reviewer ? `- Requested reviewer: ${reviewer.name || reviewer.id}` : null,
  ].filter(Boolean).join('\n'));
  const normalizedSourceRefs = (Array.isArray(sourceRefs) ? sourceRefs : [])
    .map((item) => redactSensitiveObject(item))
    .filter(Boolean);
  const normalizedTags = uniqueStrings(tags || []).map((tag) => redactSensitiveText(tag));
  const normalizedRespondsToReviewId = explicitReview?.id || null;
  const normalizedRevisesSubmissionId = revisionTarget?.id || null;
  const normalizedSupersedesSubmissionIds = uniqueStrings([
    normalizedRevisesSubmissionId,
    ...(Array.isArray(supersedesSubmissionIds) ? supersedesSubmissionIds : [supersedesSubmissionIds]),
  ].filter(Boolean));
  const normalizedDependsOn = uniqueStrings([
    ...(Array.isArray(dependsOn) ? dependsOn : [dependsOn]),
    normalizedRevisesSubmissionId,
    normalizedRespondsToReviewId,
  ].filter(Boolean)).map((item) => redactSensitiveText(item));
  const extension = artifactExtensionForType(normalizedType);
  const artifactDraft = {
    id: `artifact_${submissionId}`,
    projectId: project.id || null,
    title: safeTitle,
    type: normalizedType,
    artifactType: normalizedType,
    summary: safeSummary,
    content,
    relativePath: `submissions/${agent.id}/${normalizedType}/${submissionId}.${extension}`,
    path: `submissions/${agent.id}/${normalizedType}/${submissionId}.${extension}`,
    createdAt: now,
    agentId: agent.id,
    taskId: task?.id || null,
    status: normalizedStatus,
    sourceRefs: normalizedSourceRefs,
    tags: normalizedTags,
    revisesSubmissionId: normalizedRevisesSubmissionId,
    respondsToReviewId: normalizedRespondsToReviewId,
    supersedesSubmissionIds: normalizedSupersedesSubmissionIds,
  };
  const writtenArtifact = typeof artifactWriter === 'function'
    ? artifactWriter(artifactDraft, { project, agent, task, now, submissionId, artifactType: normalizedType })
    : null;
  const redactedWrittenArtifact = redactSensitiveObject(writtenArtifact || {});
  const artifactRecord = {
    ...artifactDraft,
    ...redactedWrittenArtifact,
    existsOnDisk: Boolean(writtenArtifact?.absolutePath || writtenArtifact?.path),
    source: typeof artifactWriter === 'function' ? 'agent-submission-artifact-writer' : 'agent-submission-artifact-draft',
  };

  const targetNames = reviewer ? [reviewer.name] : ['all'];
  const submissionMessage = attachMessageReceipts({
    id: `msg_${submissionId}`,
    projectId: project.id,
    channelId,
    type: 'submission',
    author: agent.name,
    authorId: agent.id,
    role: agent.role || agent.title || 'Agent',
    time: 'Submission',
    text: reviewer
      ? `@${reviewer.name} I submitted "${safeTitle}" (${normalizedType}) for review. ${safeSummary}`
      : `@all I submitted "${safeTitle}" (${normalizedType}) for review. ${safeSummary}`,
    targets: targetNames,
    targetIds: reviewer ? [reviewer.id] : ['all'],
    weight: 'Agent Submission',
    submissionId,
    artifactType: normalizedType,
  }, team, { seenAt: now });
  const logId = `log_${submissionId}`;
  const eventId = `evt_${submissionId}`;
  const timelineSubmission = {
    id: `timeline_${submissionId}`,
    tool: 'manager-flow-agent-submission',
    protocolVersion: 'agent-submission/v1',
    commitAreaKey: timelineCommitAreaKey(now),
    axis: 'x-time-single-axis',
    branchPolicy: 'same-time-small-branch',
    submittedAt: now,
    submittedByAgentId: agent.id,
    submittedByAgentName: agent.name || agent.id,
    taskId: task?.id || null,
    category: 'submission',
    subtype: normalizedType,
    intent: 'Agent submitted a typed artifact node for manager review and proof-map traceability.',
    commitMessage: `${agent.name || 'Agent'} submitted ${safeTitle}.`,
    thinkingFrame: {
      artifactType: normalizedType,
      reviewStatus,
      dependsOn: normalizedDependsOn,
      revisesSubmissionId: normalizedRevisesSubmissionId,
      respondsToReviewId: normalizedRespondsToReviewId,
      supersedesSubmissionIds: normalizedSupersedesSubmissionIds,
      sourceRefs: normalizedSourceRefs,
    },
    collaborationContext: {
      reviewerAgentId: reviewer?.id || null,
      reviewerAgentName: reviewer?.name || null,
      leaderAgentId: leader?.id || null,
      participantIds: uniqueStrings([agent.id, reviewer?.id, leader?.id].filter(Boolean)),
    },
    attachmentIds: [artifactRecord.id],
    attachments: [artifactRecord],
    summary: safeSummary,
  };
  const submission = {
    id: submissionId,
    projectId: project.id || null,
    agentId: agent.id,
    agentName: agent.name || agent.id,
    nodeType: 'agent-submission',
    artifactType: normalizedType,
    title: safeTitle,
    summary: safeSummary,
    body: content,
    workspacePath: artifactRecord.relativePath || artifactRecord.path || null,
    artifact: artifactRecord,
    artifactId: artifactRecord.id,
    artifactPath: artifactRecord.absolutePath || artifactRecord.path || artifactRecord.relativePath || null,
    artifactUrl: artifactRecord.url || null,
    status: normalizedStatus,
    reviewStatus,
    taskId: task?.id || null,
    dependsOn: normalizedDependsOn,
    revisesSubmissionId: normalizedRevisesSubmissionId,
    respondsToReviewId: normalizedRespondsToReviewId,
    supersedesSubmissionIds: normalizedSupersedesSubmissionIds,
    revisionLineage: {
      revisesSubmissionId: normalizedRevisesSubmissionId,
      respondsToReviewId: normalizedRespondsToReviewId,
      supersedesSubmissionIds: normalizedSupersedesSubmissionIds,
    },
    sourceRefs: normalizedSourceRefs,
    tags: normalizedTags,
    requestedReviewAgentId: reviewer?.id || null,
    requestedReviewAgentName: reviewer?.name || null,
    channelId,
    messageId: submissionMessage.id,
    timelineLogId: logId,
    eventId,
    evidenceIds: uniqueStrings([submissionMessage.id, logId, eventId, artifactRecord.id]),
    createdAt: now,
    updatedAt: now,
    timelineSubmission,
  };
  const log = {
    id: logId,
    time: now,
    agent: agent.name,
    agentId: agent.id,
    actor: agent.name,
    eventType: 'agent-submission',
    source: 'agent-submission',
    channelId,
    taskId: task?.id || null,
    submissionId,
    artifactType: normalizedType,
    reviewStatus,
    log: `${agent.name || 'Agent'} submitted "${safeTitle}" as ${normalizedType}.`,
    receiptCount: submissionMessage.visibility?.receiptCount || 0,
    directTargetIds: submissionMessage.directTargetIds || [],
    attachments: [artifactRecord],
    artifactIds: [artifactRecord.id],
    artifactPaths: [artifactRecord.absolutePath || artifactRecord.path || artifactRecord.relativePath].filter(Boolean),
    timelineSubmission,
    commitAreaKey: timelineSubmission.commitAreaKey,
    commitMessage: timelineSubmission.commitMessage,
    thinkingFrame: timelineSubmission.thinkingFrame,
    collaborationContext: timelineSubmission.collaborationContext,
  };
  const nextTasks = (project.tasks || []).map((item) => {
    if (!task || String(item.id) !== String(task.id)) return item;
    return {
      ...item,
      status: normalizedStatus === 'final' || normalizedType === 'final-deliverable' ? 'done' : item.status || 'in-progress',
      lastTouchedAt: now,
      completedAt: normalizedStatus === 'final' || normalizedType === 'final-deliverable' ? now : item.completedAt,
      submissionIds: uniqueStrings([...(item.submissionIds || []), submissionId]),
      revisionSubmissionIds: normalizedRevisesSubmissionId
        ? uniqueStrings([...(item.revisionSubmissionIds || []), submissionId])
        : (item.revisionSubmissionIds || []),
      evidenceMessageIds: uniqueStrings([...(item.evidenceMessageIds || []), submissionMessage.id]),
      timelineLogIds: uniqueStrings([...(item.timelineLogIds || []), log.id]),
      artifactIds: uniqueStrings([...(item.artifactIds || []), artifactRecord.id]),
      artifactPaths: uniqueStrings([...(item.artifactPaths || []), ...(log.artifactPaths || [])]),
      attachments: [
        ...(item.attachments || []),
        artifactRecord,
      ].filter((attachment, index, all) => all.findIndex((candidate) => candidate.id === attachment.id) === index),
    };
  });
  const previousState = project.agentStates?.[agent.id] || {};
  const supersededSubmissionIdSet = new Set(normalizedSupersedesSubmissionIds.map(String));
  const existingSubmissionsWithRevision = (project.agentSubmissions || []).map((item) => {
    if (!supersededSubmissionIdSet.has(String(item.id))) return item;
    return {
      ...item,
      status: item.status === 'final' ? item.status : 'superseded',
      revisedBySubmissionIds: uniqueStrings([...(item.revisedBySubmissionIds || []), submissionId]),
      latestRevisionId: submissionId,
      supersededAt: item.status === 'final' ? item.supersededAt : now,
      updatedAt: now,
    };
  });
  const resolveRevisionObligations = (state = {}) => (state.obligations || []).map((item) => {
    const reviewMatches = normalizedRespondsToReviewId && String(item.reviewId || '') === String(normalizedRespondsToReviewId);
    const submissionMatches = normalizedRevisesSubmissionId && String(item.submissionId || '') === String(normalizedRevisesSubmissionId);
    if (!reviewMatches && !submissionMatches) return item;
    return {
      ...item,
      status: 'resolved',
      resolvedAt: now,
      resolvedBySubmissionId: submissionId,
      resolution: 'revision-submitted',
    };
  });
  const nextSubmitterObligations = resolveRevisionObligations(previousState);
  const revisionTargetSubmitter = normalizedRevisesSubmissionId && revisionTarget?.agentId && revisionTarget.agentId !== agent.id
    ? team.find((member) => member.id === revisionTarget.agentId || member.name === revisionTarget.agentName)
    : null;
  const revisionTargetState = revisionTargetSubmitter ? project.agentStates?.[revisionTargetSubmitter.id] || {} : null;
  const projectWithSubmission = appendProjectEvents({
    ...project,
    tasks: nextTasks,
    logs: [log, ...(project.logs || [])],
    agentSubmissions: [submission, ...existingSubmissionsWithRevision].slice(0, AGENT_SUBMISSION_LIMIT),
    agentStates: {
      ...(project.agentStates || {}),
      ...(revisionTargetSubmitter ? {
        [revisionTargetSubmitter.id]: {
          ...revisionTargetState,
          agentId: revisionTargetSubmitter.id,
          name: revisionTargetState.name || revisionTargetSubmitter.name,
          role: revisionTargetState.role || revisionTargetSubmitter.role,
          status: 'revision-submitted',
          currentPlan: {
            ...(revisionTargetState.currentPlan || {}),
            focus: revisionTarget?.title || revisionTargetState.currentPlan?.focus || 'Reviewed submission',
            next: `${agent.name || 'Agent'} submitted a linked revision.`,
            submissionId: normalizedRevisesSubmissionId,
            latestRevisionId: submissionId,
          },
          obligations: resolveRevisionObligations(revisionTargetState),
          lastActiveAt: now,
        },
      } : {}),
      [agent.id]: {
        ...previousState,
        agentId: agent.id,
        name: previousState.name || agent.name,
        role: previousState.role || agent.role,
        status: normalizedType === 'final-deliverable' ? 'submitted-final-deliverable' : 'submitted-artifact',
        currentPlan: {
          ...(previousState.currentPlan || {}),
          focus: safeTitle,
          next: reviewer ? `Await ${reviewer.name}'s review.` : 'Await manager review.',
          taskId: task?.id || previousState.currentPlan?.taskId || null,
          artifactType: normalizedType,
        },
        taskIds: uniqueStrings([...(previousState.taskIds || []), task?.id].filter(Boolean)),
        obligations: nextSubmitterObligations,
        worklog: [
          {
            id: `worklog_${submissionId}`,
            at: now,
            kind: 'agent-submission',
            source: 'agent-submission',
            sourceMessageId: submissionMessage.id,
            submissionId,
            artifactId: artifactRecord.id,
            artifactType: normalizedType,
            artifactPath: submission.artifactPath,
            taskId: task?.id || null,
            text: safeSummary,
            timelineSubmissionId: timelineSubmission.id,
            commitAreaKey: timelineSubmission.commitAreaKey,
          },
          ...(previousState.worklog || []),
        ].slice(0, 80),
        lastActiveAt: now,
      },
    },
  }, [
    createProjectLedgerEvent({
      id: eventId,
      type: 'agent-submission',
      time: now,
      actor: agent.name,
      summary: log.log,
      source: 'agent-submission',
      channelId,
      evidenceIds: submission.evidenceIds,
      entityIds: {
        projectId: project.id || null,
        agentId: agent.id,
        reviewerAgentId: reviewer?.id || null,
        taskId: task?.id || null,
        submissionId,
        artifactId: artifactRecord.id,
        messageId: submissionMessage.id,
        logId: log.id,
      },
      payload: {
        submission,
        artifact: artifactRecord,
        revisionLineage: submission.revisionLineage,
        reviewStatus,
      },
    }),
  ]);
  const finalProject = applyChatMessagesToAgentStates({
    project: projectWithSubmission,
    team,
    messages: [submissionMessage],
    now,
    source: 'agent-submission-chat',
    language: currentLanguage,
  });

  return {
    route: 'agent-submission-created',
    project: finalProject,
    messages: [{ ...submissionMessage, projectId: project.id }],
    submission,
    artifact: artifactRecord,
    log,
    task: task ? nextTasks.find((item) => String(item.id) === String(task.id)) : null,
  };
}

export function recordAgentEvidenceSearch({
  project = {},
  agentId,
  query = '',
  purpose = '',
  taskId = null,
  submissionId = null,
  provider = 'agent-recorded',
  searchMode = 'agent-directed',
  status = 'completed',
  sources = [],
  findings = [],
  confidence = 'medium',
  tags = [],
  channelId = 'main',
  now = nowIso(),
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const team = project.team || [];
  const agent = team.find((member) => member.id === agentId || member.name === agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);
  const leader = team.find((member) => member.isLeader) || team[0] || null;
  const reviewer = team.find((member) => member.id !== agent.id && /review|evidence|qa|critic|risk/i.test(`${member.role || ''} ${member.title || ''} ${member.skill || ''}`))
    || team.find((member) => member.id !== agent.id && member.id !== leader?.id)
    || leader
    || null;
  const task = taskId
    ? (project.tasks || []).find((item) => String(item.id) === String(taskId))
    : null;
  if (taskId && !task) throw new Error(`Task not found: ${taskId}`);
  const linkedSubmission = submissionId
    ? (project.agentSubmissions || []).find((item) => String(item.id) === String(submissionId))
    : null;
  if (submissionId && !linkedSubmission) throw new Error(`Submission not found: ${submissionId}`);

  const timestamp = Date.parse(now) || Date.now();
  const normalizedStatus = normalizeEvidenceSearchStatus(status);
  const safeQuery = redactSensitiveText(String(query || '').trim() || String(purpose || '').trim() || 'Project evidence search');
  const safePurpose = redactSensitiveText(String(purpose || '').trim() || `Collect evidence for ${task?.text || linkedSubmission?.title || project.name || 'the project'}.`);
  const normalizedSources = normalizeEvidenceSources(sources, now);
  const normalizedFindings = (Array.isArray(findings) ? findings : [findings])
    .map((item) => redactSensitiveText(String(item || '').trim()))
    .filter(Boolean)
    .slice(0, 24);
  const normalizedConfidence = normalizeConfidence(confidence);
  const qualitySummary = summarizeEvidenceQuality(normalizedSources, normalizedFindings, normalizedConfidence);
  const sourceSafetySummary = summarizeEvidenceSourceSafety(normalizedSources);
  const evidenceSearchId = `evidence_search_${project.id || 'project'}_${agent.id}_${timestamp}_${slugPart(safeQuery).slice(0, 32)}`;
  const target = reviewer || leader || null;
  const message = attachMessageReceipts({
    id: `msg_${evidenceSearchId}`,
    projectId: project.id,
    channelId,
    type: 'evidence-search',
    author: agent.name,
    authorId: agent.id,
    role: agent.role || agent.title || 'Agent',
    time: 'Evidence Search',
    text: target
      ? `@${target.name} I completed evidence search "${safeQuery}". ${safePurpose}`
      : `@all I completed evidence search "${safeQuery}". ${safePurpose}`,
    targets: target ? [target.name] : ['all'],
    targetIds: target ? [target.id] : ['all'],
    weight: 'Evidence Search',
    evidenceSearchId,
  }, team, { seenAt: now });
  const logId = `log_${evidenceSearchId}`;
  const eventId = `evt_${evidenceSearchId}`;
  const evidenceSearch = {
    id: evidenceSearchId,
    projectId: project.id || null,
    agentId: agent.id,
    agentName: agent.name || agent.id,
    query: safeQuery,
    purpose: safePurpose,
    provider,
    searchMode,
    status: normalizedStatus,
    confidence: normalizedConfidence,
    evidenceJudgement: qualitySummary.judgement,
    qualityScore: qualitySummary.averageScore,
    qualitySummary,
    sourceSafetySummary,
    taskId: task?.id || null,
    submissionId: linkedSubmission?.id || null,
    sources: normalizedSources,
    findings: normalizedFindings,
    sourceRefs: normalizedSources,
    tags: uniqueStrings(tags || []).map((tag) => redactSensitiveText(tag)),
    channelId,
    messageId: message.id,
    timelineLogId: logId,
    eventId,
    evidenceIds: uniqueStrings([message.id, logId, eventId, ...normalizedSources.map((source) => source.id)]),
    createdAt: now,
    updatedAt: now,
  };
  const log = {
    id: logId,
    time: now,
    agent: agent.name,
    agentId: agent.id,
    actor: agent.name,
    eventType: 'evidence-search',
    source: 'agent-evidence-search',
    channelId,
    taskId: task?.id || null,
    submissionId: linkedSubmission?.id || null,
    evidenceSearchId,
    log: `${agent.name || 'Agent'} recorded evidence search "${safeQuery}" with ${normalizedSources.length} source(s).`,
    receiptCount: message.visibility?.receiptCount || 0,
    directTargetIds: message.directTargetIds || [],
    sourceRefs: normalizedSources,
    findings: normalizedFindings,
    confidence: evidenceSearch.confidence,
    evidenceJudgement: evidenceSearch.evidenceJudgement,
    qualityScore: evidenceSearch.qualityScore,
    qualitySummary,
    sourceSafetySummary,
  };
  const nextTasks = (project.tasks || []).map((item) => {
    if (!task || String(item.id) !== String(task.id)) return item;
    return {
      ...item,
      status: item.status === 'done' ? item.status : 'in-progress',
      lastTouchedAt: now,
      evidenceSearchIds: uniqueStrings([...(item.evidenceSearchIds || []), evidenceSearchId]),
      evidenceMessageIds: uniqueStrings([...(item.evidenceMessageIds || []), message.id]),
      timelineLogIds: uniqueStrings([...(item.timelineLogIds || []), log.id]),
      sourceRefs: [
        ...(item.sourceRefs || []).map((source) => redactSensitiveObject(source)),
        ...normalizedSources,
      ].filter((source, index, all) => all.findIndex((candidate) => String(candidate.id) === String(source.id)) === index),
    };
  });
  const nextSubmissions = (project.agentSubmissions || []).map((submission) => {
    if (!linkedSubmission || String(submission.id) !== String(linkedSubmission.id)) return submission;
    return {
      ...submission,
      sourceRefs: [
        ...(submission.sourceRefs || []).map((source) => redactSensitiveObject(source)),
        ...normalizedSources,
      ].filter((source, index, all) => all.findIndex((candidate) => String(candidate.id || candidate.title) === String(source.id || source.title)) === index),
      evidenceSearchIds: uniqueStrings([...(submission.evidenceSearchIds || []), evidenceSearchId]),
      evidenceIds: uniqueStrings([...(submission.evidenceIds || []), ...evidenceSearch.evidenceIds]),
      updatedAt: now,
    };
  });
  const previousState = project.agentStates?.[agent.id] || {};
  const projectWithEvidence = appendProjectEvents({
    ...project,
    tasks: nextTasks,
    logs: [log, ...(project.logs || [])],
    agentSubmissions: nextSubmissions,
    evidenceSearches: [evidenceSearch, ...(project.evidenceSearches || [])].slice(0, AGENT_EVIDENCE_SEARCH_LIMIT),
    agentStates: {
      ...(project.agentStates || {}),
      [agent.id]: {
        ...previousState,
        agentId: agent.id,
        name: previousState.name || agent.name,
        role: previousState.role || agent.role,
        status: 'evidence-search-completed',
        currentPlan: {
          ...(previousState.currentPlan || {}),
          focus: safeQuery,
          next: normalizedStatus === 'completed' ? 'Use evidence in the next artifact or review.' : 'Continue evidence search.',
          taskId: task?.id || previousState.currentPlan?.taskId || null,
          evidenceSearchId,
        },
        taskIds: uniqueStrings([...(previousState.taskIds || []), task?.id].filter(Boolean)),
        worklog: [
          {
            id: `worklog_${evidenceSearchId}`,
            at: now,
            kind: 'evidence-search',
            source: 'agent-evidence-search',
            sourceMessageId: message.id,
            evidenceSearchId,
            taskId: task?.id || null,
            submissionId: linkedSubmission?.id || null,
            text: `${safeQuery} / ${normalizedSources.length} source(s)`,
          },
          ...(previousState.worklog || []),
        ].slice(0, 80),
        lastActiveAt: now,
      },
    },
  }, [
    createProjectLedgerEvent({
      id: eventId,
      type: 'evidence-search',
      time: now,
      actor: agent.name,
      summary: log.log,
      source: 'agent-evidence-search',
      channelId,
      evidenceIds: evidenceSearch.evidenceIds,
      entityIds: {
        projectId: project.id || null,
        agentId: agent.id,
        taskId: task?.id || null,
        submissionId: linkedSubmission?.id || null,
        evidenceSearchId,
        messageId: message.id,
        logId,
      },
      payload: {
        query: safeQuery,
        purpose: safePurpose,
        provider,
        searchMode,
        sourceCount: normalizedSources.length,
        findings: normalizedFindings,
        confidence: evidenceSearch.confidence,
        evidenceJudgement: evidenceSearch.evidenceJudgement,
        qualityScore: evidenceSearch.qualityScore,
        qualitySummary,
        sourceSafetySummary,
      },
    }),
  ]);
  const finalProject = applyChatMessagesToAgentStates({
    project: projectWithEvidence,
    team,
    messages: [message],
    now,
    source: 'agent-evidence-search-chat',
    language: currentLanguage,
  });

  return {
    route: 'agent-evidence-search-created',
    project: finalProject,
    messages: [{ ...message, projectId: project.id }],
    evidenceSearch,
    log,
    task: task ? nextTasks.find((item) => String(item.id) === String(task.id)) : null,
    submission: linkedSubmission ? nextSubmissions.find((item) => String(item.id) === String(linkedSubmission.id)) : null,
  };
}

export function reviewAgentSubmission({
  project = {},
  submissionId,
  reviewerAgentId = null,
  verdict = 'under-review',
  comments = '',
  requestedChanges = [],
  channelId = 'main',
  now = nowIso(),
  language = project.language || 'en',
} = {}) {
  const currentLanguage = normalizeLanguage(language);
  const team = project.team || [];
  const submission = (project.agentSubmissions || []).find((item) => String(item.id) === String(submissionId));
  if (!submission) throw new Error(`Submission not found: ${submissionId}`);
  const submitter = team.find((member) => member.id === submission.agentId || member.name === submission.agentName) || null;
  const reviewer = team.find((member) => (
    reviewerAgentId
      ? member.id === reviewerAgentId || member.name === reviewerAgentId
      : member.id === submission.requestedReviewAgentId || member.name === submission.requestedReviewAgentName
  )) || team.find((member) => member.id !== submitter?.id && /review|evidence|qa|critic|risk/i.test(`${member.role || ''} ${member.title || ''} ${member.skill || ''}`))
    || team.find((member) => member.id !== submitter?.id)
    || submitter;
  if (!reviewer) throw new Error('Reviewer not found.');
  const normalizedVerdict = normalizeSubmissionReviewStatus(verdict);
  const timestamp = Date.parse(now) || Date.now();
  const reviewId = `submission_review_${project.id || 'project'}_${submission.id}_${reviewer.id}_${timestamp}`;
  const normalizedChanges = (Array.isArray(requestedChanges) ? requestedChanges : [requestedChanges])
    .map((item) => redactSensitiveText(String(item || '').trim()))
    .filter(Boolean)
    .slice(0, 12);
  const safeComments = redactSensitiveText(String(comments || '').trim()
    || (normalizedVerdict === 'accepted'
      ? 'Reviewer accepted the submission.'
      : normalizedVerdict === 'changes-requested'
        ? 'Reviewer requested changes before acceptance.'
        : 'Reviewer recorded a submission review.'));
  const message = attachMessageReceipts({
    id: `msg_${reviewId}`,
    projectId: project.id,
    channelId,
    type: 'submission-review',
    author: reviewer.name,
    authorId: reviewer.id,
    role: reviewer.role || reviewer.title || 'Reviewer',
    time: 'Review',
    text: submitter
      ? `@${submitter.name} review for "${submission.title}": ${normalizedVerdict}. ${safeComments}`
      : `@all review for "${submission.title}": ${normalizedVerdict}. ${safeComments}`,
    targets: submitter ? [submitter.name] : ['all'],
    targetIds: submitter ? [submitter.id] : ['all'],
    weight: 'Submission Review',
    submissionId: submission.id,
    reviewId,
  }, team, { seenAt: now });
  const logId = `log_${reviewId}`;
  const eventId = `evt_${reviewId}`;
  const review = {
    id: reviewId,
    projectId: project.id || null,
    submissionId: submission.id,
    taskId: submission.taskId || null,
    artifactType: submission.artifactType || null,
    reviewerAgentId: reviewer.id,
    reviewerAgentName: reviewer.name || reviewer.id,
    submitterAgentId: submitter?.id || submission.agentId || null,
    submitterAgentName: submitter?.name || submission.agentName || null,
    verdict: normalizedVerdict,
    status: normalizedVerdict,
    comments: safeComments,
    requestedChanges: normalizedChanges,
    channelId,
    messageId: message.id,
    timelineLogId: logId,
    eventId,
    evidenceIds: uniqueStrings([message.id, logId, eventId, submission.id, submission.messageId, submission.timelineLogId, submission.eventId]),
    createdAt: now,
    updatedAt: now,
  };
  const nextSubmissionStatus = normalizedVerdict === 'accepted'
    ? (submission.status === 'final' || submission.artifactType === 'final-deliverable' ? 'final' : 'accepted')
    : normalizedVerdict === 'changes-requested' || normalizedVerdict === 'rejected'
      ? 'changes-requested'
      : 'under-review';
  const nextSubmissions = (project.agentSubmissions || []).map((item) => {
    if (String(item.id) !== String(submission.id)) return item;
    return {
      ...item,
      status: nextSubmissionStatus,
      reviewStatus: normalizedVerdict,
      reviewerAgentId: reviewer.id,
      reviewerAgentName: reviewer.name || reviewer.id,
      requestedReviewAgentId: item.requestedReviewAgentId || reviewer.id,
      requestedReviewAgentName: item.requestedReviewAgentName || reviewer.name || reviewer.id,
      reviewIds: uniqueStrings([...(item.reviewIds || []), reviewId]),
      latestReviewId: reviewId,
      latestReview: review,
      requestedChanges: normalizedChanges.length ? normalizedChanges : item.requestedChanges || [],
      evidenceIds: uniqueStrings([...(item.evidenceIds || []), ...review.evidenceIds]),
      updatedAt: now,
      acceptedAt: normalizedVerdict === 'accepted' ? now : item.acceptedAt,
      changesRequestedAt: normalizedVerdict === 'changes-requested' ? now : item.changesRequestedAt,
    };
  });
  const taskId = submission.taskId || null;
  const nextTasks = (project.tasks || []).map((task) => {
    if (!taskId || String(task.id) !== String(taskId)) return task;
    const acceptedFinal = normalizedVerdict === 'accepted' && (submission.artifactType === 'final-deliverable' || submission.status === 'final');
    return {
      ...task,
      status: acceptedFinal ? 'done' : (normalizedVerdict === 'changes-requested' ? 'in-progress' : task.status || 'in-review'),
      lastTouchedAt: now,
      completedAt: acceptedFinal ? now : task.completedAt,
      reviewIds: uniqueStrings([...(task.reviewIds || []), reviewId]),
      evidenceMessageIds: uniqueStrings([...(task.evidenceMessageIds || []), message.id]),
      timelineLogIds: uniqueStrings([...(task.timelineLogIds || []), logId]),
    };
  });
  const log = {
    id: logId,
    time: now,
    agent: reviewer.name,
    agentId: reviewer.id,
    actor: reviewer.name,
    eventType: 'submission-review',
    source: 'agent-submission-review',
    channelId,
    taskId,
    submissionId: submission.id,
    reviewId,
    reviewStatus: normalizedVerdict,
    log: `${reviewer.name || 'Reviewer'} reviewed "${submission.title}" with verdict ${normalizedVerdict}.`,
    receiptCount: message.visibility?.receiptCount || 0,
    directTargetIds: message.directTargetIds || [],
    requestedChanges: normalizedChanges,
  };
  const reviewerState = project.agentStates?.[reviewer.id] || {};
  const submitterState = submitter ? project.agentStates?.[submitter.id] || {} : {};
  const nextAgentStates = {
    ...(project.agentStates || {}),
    [reviewer.id]: {
      ...reviewerState,
      agentId: reviewer.id,
      name: reviewerState.name || reviewer.name,
      role: reviewerState.role || reviewer.role,
      status: normalizedVerdict === 'accepted' ? 'review-accepted-submission' : 'reviewed-submission',
      currentPlan: {
        ...(reviewerState.currentPlan || {}),
        focus: `Review ${submission.title}`,
        next: normalizedVerdict === 'changes-requested' ? 'Wait for revision.' : 'Monitor downstream delivery.',
        submissionId: submission.id,
        reviewId,
      },
      worklog: [
        {
          id: `worklog_${reviewId}`,
          at: now,
          kind: 'submission-review',
          source: 'agent-submission-review',
          sourceMessageId: message.id,
          submissionId: submission.id,
          reviewId,
          verdict: normalizedVerdict,
          text: safeComments,
        },
        ...(reviewerState.worklog || []),
      ].slice(0, 80),
      lastActiveAt: now,
    },
  };
  if (submitter) {
    nextAgentStates[submitter.id] = {
      ...submitterState,
      agentId: submitter.id,
      name: submitterState.name || submitter.name,
      role: submitterState.role || submitter.role,
      status: normalizedVerdict === 'changes-requested' ? 'revision-requested' : (submitterState.status || 'monitoring-review'),
      currentPlan: {
        ...(submitterState.currentPlan || {}),
        focus: submission.title,
        next: normalizedVerdict === 'changes-requested' ? 'Prepare revision note and resubmit.' : 'Continue next deliverable.',
        submissionId: submission.id,
        reviewId,
      },
      inbox: [
        {
          id: `inbox_${reviewId}`,
          at: now,
          source: 'submission-review',
          sourceMessageId: message.id,
          submissionId: submission.id,
          reviewId,
          taskId,
          text: safeComments,
          status: normalizedVerdict,
        },
        ...(submitterState.inbox || []),
      ].slice(0, 80),
      obligations: normalizedVerdict === 'changes-requested'
        ? [
          {
            id: `obligation_${reviewId}`,
            at: now,
            source: 'submission-review',
            sourceMessageId: message.id,
            submissionId: submission.id,
            reviewId,
            taskId,
            text: normalizedChanges.join(' ') || safeComments,
            status: 'open',
          },
          ...(submitterState.obligations || []),
        ].slice(0, 80)
        : (submitterState.obligations || []),
      lastActiveAt: now,
    };
  }
  const projectWithReview = appendProjectEvents({
    ...project,
    tasks: nextTasks,
    logs: [log, ...(project.logs || [])],
    agentSubmissions: nextSubmissions,
    submissionReviews: [review, ...(project.submissionReviews || [])].slice(0, AGENT_SUBMISSION_REVIEW_LIMIT),
    agentStates: nextAgentStates,
  }, [
    createProjectLedgerEvent({
      id: eventId,
      type: 'submission-review',
      time: now,
      actor: reviewer.name,
      summary: log.log,
      source: 'agent-submission-review',
      channelId,
      evidenceIds: review.evidenceIds,
      entityIds: {
        projectId: project.id || null,
        reviewerAgentId: reviewer.id,
        submitterAgentId: submitter?.id || submission.agentId || null,
        taskId,
        submissionId: submission.id,
        reviewId,
        messageId: message.id,
        logId,
      },
      payload: {
        verdict: normalizedVerdict,
        comments: safeComments,
        requestedChanges: normalizedChanges,
      },
    }),
  ]);
  const finalProject = applyChatMessagesToAgentStates({
    project: projectWithReview,
    team,
    messages: [message],
    now,
    source: 'agent-submission-review-chat',
    language: currentLanguage,
  });

  return {
    route: 'agent-submission-reviewed',
    project: finalProject,
    messages: [{ ...message, projectId: project.id }],
    review,
    submission: nextSubmissions.find((item) => String(item.id) === String(submission.id)),
    log,
    task: taskId ? nextTasks.find((item) => String(item.id) === String(taskId)) : null,
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
        queueReason: schedule.reason,
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

function buildModelKickoffMeetingMessages({
  projectId = '',
  meetingId = '',
  name = 'Untitled Agent Project',
  brief = '',
  team = [],
  tasks = [],
  language = 'en',
  now = nowIso(),
} = {}) {
  return [
    {
      role: 'system',
      content: [
        'You are the real kickoff meeting engine for Hall of Fame Studio.',
        'Generate a concise, usable project-initiation meeting from the supplied project brief and agent roster.',
        'Every agent turn must be grounded in the agent role and the user brief. Do not invent hidden requirements, API keys, fake progress, or completed work.',
        'Return JSON only. No markdown.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        now,
        project: { id: projectId, name, brief, language },
        meetingId,
        team: team.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role || agent.title || 'Agent',
          duty: agent.duty || agent.skill || '',
        })),
        requestedNextActions: (tasks || []).map((task, index) => ({
          id: task.id || `task_${index + 1}`,
          text: typeof task === 'string' ? task : task.text,
          ownerId: task.ownerId || null,
          assignee: task.assignee || null,
        })),
        requiredShape: {
          roleTurns: [
            {
              agentId: 'agent id from team',
              type: 'role-question or role-volunteer',
              text: 'one meeting turn in the project language',
              hears: ['other agent ids that heard this turn'],
            },
          ],
          leaderCampaigns: [
            {
              agentId: 'agent id from team',
              score: 1,
              claim: 'why this agent should or should not lead this specific project',
              hears: ['other agent ids that heard this turn'],
            },
          ],
          recommendedLeaderId: 'agent id from team',
          reviewerId: 'agent id from team',
          nextActions: [
            {
              text: 'concrete first action',
              ownerId: 'agent id from team',
            },
          ],
          decisionSummary: 'one sentence meeting result',
          risks: ['real risk or ambiguity from the brief'],
        },
      }),
    },
  ];
}

function normalizeModelArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeModelText(value = '') {
  return String(value || '').trim();
}

function findMeetingAgent(team = [], value = '') {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return null;
  return team.find((agent) => String(agent.id || '').toLowerCase() === normalized)
    || team.find((agent) => String(agent.name || '').toLowerCase() === normalized)
    || null;
}

function normalizeMeetingHearIds(team = [], speakerId, value = []) {
  const ids = normalizeModelArray(value)
    .map((item) => findMeetingAgent(team, item)?.id || String(item || '').trim())
    .filter((id) => id && id !== speakerId && team.some((agent) => agent.id === id));
  const fallback = team.filter((agent) => agent.id !== speakerId).map((agent) => agent.id);
  return uniqueStrings(ids.length ? ids : fallback);
}

function createModelKickoffMeetingSession(input = {}, modelPayload = {}, modelResult = {}) {
  const {
    meetingId = `kickoff_meeting_${Date.now()}`,
    projectId = `project_${Date.now()}`,
    name = 'Untitled Agent Project',
    brief = '',
    team = [],
    tasks = [],
    selectedLeaderId,
    reviewerId,
    now = nowIso(),
    language = 'en',
  } = input;
  const currentLanguage = normalizeLanguage(language);
  const validTeam = team.filter((agent) => agent?.id);
  if (!validTeam.length) throw new Error('kickoff-meeting-requires-team');

  const transcriptFromModel = normalizeModelArray(modelPayload.transcript);
  const roleSource = normalizeModelArray(modelPayload.roleTurns).length
    ? normalizeModelArray(modelPayload.roleTurns)
    : transcriptFromModel.filter((turn) => /role|question|volunteer|nomination/i.test(`${turn.stage || ''} ${turn.type || ''}`));
  const campaignSource = normalizeModelArray(modelPayload.leaderCampaigns).length
    ? normalizeModelArray(modelPayload.leaderCampaigns)
    : transcriptFromModel.filter((turn) => /leader|campaign/i.test(`${turn.stage || ''} ${turn.type || ''}`));

  const roleTranscript = roleSource.map((turn, index) => {
    const speaker = findMeetingAgent(validTeam, turn.agentId || turn.speakerId || turn.speaker || turn.name);
    const text = normalizeModelText(turn.text || turn.question || turn.statement || turn.claim || turn.content);
    if (!speaker || !text) return null;
    const kind = /volunteer|nomination|self/i.test(String(turn.type || turn.stage || '')) ? 'role-volunteer' : 'role-question';
    return {
      id: `${meetingId}_role_${index + 1}`,
      type: kind,
      speaker: speaker.name,
      speakerId: speaker.id,
      agentId: speaker.id,
      role: speaker.role || speaker.title || 'Agent',
      text,
      hears: normalizeMeetingHearIds(validTeam, speaker.id, turn.hears || turn.hearsOthers),
      stage: kind === 'role-question' ? 'role-clarification' : 'self-nomination',
      source: 'model-kickoff-meeting',
    };
  }).filter(Boolean);

  const leaderCampaigns = campaignSource.map((turn, index) => {
    const speaker = findMeetingAgent(validTeam, turn.agentId || turn.speakerId || turn.speaker || turn.name);
    const text = normalizeModelText(turn.claim || turn.text || turn.statement || turn.content);
    if (!speaker || !text) return null;
    const score = Number(turn.score);
    return {
      id: `${meetingId}_leader_${index + 1}`,
      type: 'leader-campaign',
      speaker: speaker.name,
      speakerId: speaker.id,
      agentId: speaker.id,
      role: speaker.role || speaker.title || 'Agent',
      text,
      score: Number.isFinite(score) ? score : Math.max(1, campaignSource.length - index),
      hearsOthers: normalizeMeetingHearIds(validTeam, speaker.id, turn.hears || turn.hearsOthers),
      hears: normalizeMeetingHearIds(validTeam, speaker.id, turn.hears || turn.hearsOthers),
      stage: 'leader-campaign',
      source: 'model-kickoff-meeting',
    };
  }).filter(Boolean);

  if (!roleTranscript.length && !leaderCampaigns.length) {
    throw new Error('model-kickoff-meeting-empty-transcript');
  }

  const leaderCandidates = leaderCampaigns.map((turn, index) => ({
    id: `${meetingId}_candidate_${turn.agentId || index + 1}`,
    agentId: turn.agentId,
    name: turn.speaker,
    role: turn.role,
    score: Number.isFinite(Number(turn.score)) ? Number(turn.score) : Math.max(1, leaderCampaigns.length - index),
    claim: turn.text,
    hearsOthers: turn.hearsOthers || [],
  }));
  const modelLeader = findMeetingAgent(validTeam, selectedLeaderId)
    || findMeetingAgent(validTeam, modelPayload.recommendedLeaderId)
    || findMeetingAgent(validTeam, modelPayload.selectedLeaderId)
    || findMeetingAgent(validTeam, leaderCandidates[0]?.agentId)
    || validTeam[0];
  const modelReviewer = findMeetingAgent(validTeam, reviewerId)
    || findMeetingAgent(validTeam, modelPayload.reviewerId)
    || validTeam.find((agent) => agent.id !== modelLeader?.id)
    || modelLeader;
  const leaderElection = {
    source: 'model-kickoff-meeting',
    projectId,
    projectName: name,
    recommendedLeaderId: modelLeader?.id || null,
    recommendedLeaderName: modelLeader?.name || null,
    candidates: leaderCandidates,
    transcript: leaderCampaigns,
  };
  const roleNegotiation = {
    source: 'model-kickoff-meeting',
    projectId,
    projectName: name,
    transcript: roleTranscript,
  };
  const nextActions = normalizeModelArray(modelPayload.nextActions).length
    ? normalizeModelArray(modelPayload.nextActions).map((action, index) => {
      const owner = findMeetingAgent(validTeam, action.ownerId || action.assignee || action.agentId || action.ownerName);
      return {
        id: action.id || `meeting_next_action_${index + 1}`,
        text: normalizeModelText(action.text || action.title || action.action),
        ownerId: owner?.id || modelLeader?.id || null,
        ownerName: owner?.name || modelLeader?.name || null,
        assignee: owner?.name || modelLeader?.name || null,
        status: action.status || 'pending',
      };
    }).filter((action) => action.text)
    : tasks;
  const transcript = [
    {
      id: `${meetingId}_director_brief`,
      type: 'director-brief',
      speaker: 'Director',
      speakerId: 'director',
      role: 'Project Owner',
      text: brief || name,
      hears: validTeam.map((agent) => agent.id),
      stage: 'brief',
      source: 'director',
    },
    ...roleTranscript,
    ...leaderCampaigns,
  ];
  const roleQuestionResolutions = buildRoleQuestionResolutions({ transcript, clarifications: [] });
  const leaderElectionResolution = buildLeaderElectionResolution({
    leaderElection,
    selectedLeaderId: selectedLeaderId || modelLeader?.id,
    team: validTeam,
    now,
    managerConfirmed: false,
  });
  const nextActionResolution = buildNextActionResolution({
    tasks: nextActions,
    team: validTeam,
    selectedLeaderId: leaderElectionResolution.selectedLeaderId || modelLeader?.id,
    now,
    managerConfirmed: false,
    source: 'model-kickoff-meeting-next-actions',
  });

  return {
    id: meetingId,
    projectId,
    name,
    brief,
    source: 'model-kickoff-meeting-session',
    modelGenerated: true,
    modelProvider: {
      provider: modelResult.provider || null,
      model: modelResult.model || null,
      usage: modelResult.usage || null,
      responseId: modelResult.id || null,
    },
    status: 'awaiting-manager-decision',
    createdAt: now,
    updatedAt: now,
    team: validTeam,
    tasks: nextActionResolution.tasks || nextActions,
    recommendedLeaderId: modelLeader?.id || null,
    recommendedLeaderName: modelLeader?.name || null,
    reviewerId: modelReviewer?.id || null,
    reviewerName: modelReviewer?.name || null,
    roleNegotiation,
    leaderElection,
    transcript,
    roleQuestionResolutions,
    leaderElectionResolution,
    nextActionResolution,
    decisionOptions: {
      selectableTeamIds: validTeam.map((agent) => agent.id),
      leaderCandidateIds: uniqueStrings(leaderCandidates.map((candidate) => candidate.id)),
      recommendedLeaderId: modelLeader?.id || null,
      reviewerId: modelReviewer?.id || null,
      taskCount: nextActionResolution.tasks?.length || nextActions.length || 0,
    },
    evidence: {
      modelGenerated: true,
      decisionSummary: normalizeModelText(modelPayload.decisionSummary),
      risks: normalizeModelArray(modelPayload.risks).map(normalizeModelText).filter(Boolean),
      transcriptIds: transcript.map((item) => item.id).filter(Boolean),
      roleTranscriptIds: roleTranscript.map((item) => item.id),
      leaderCampaignIds: leaderCampaigns.map((item) => item.id),
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
  language = meeting.language || 'en',
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
    language,
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

  (project.agentSubmissions || [])
    .filter((record) => String(record.taskId || '') === String(task.id || ''))
    .forEach((record) => {
      addMessageId(record.messageId);
      if (record.timelineLogId) logIds.add(String(record.timelineLogId));
    });
  (project.evidenceSearches || [])
    .filter((record) => String(record.taskId || '') === String(task.id || ''))
    .forEach((record) => {
      addMessageId(record.messageId);
      if (record.timelineLogId) logIds.add(String(record.timelineLogId));
    });
  (project.submissionReviews || [])
    .filter((record) => String(record.taskId || '') === String(task.id || ''))
    .forEach((record) => {
      addMessageId(record.messageId);
      if (record.timelineLogId) logIds.add(String(record.timelineLogId));
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
  const submissions = (project.agentSubmissions || [])
    .filter((record) => String(record.taskId || '') === String(task.id));
  const evidenceSearches = (project.evidenceSearches || [])
    .filter((record) => String(record.taskId || '') === String(task.id));
  const submissionReviews = (project.submissionReviews || [])
    .filter((record) => String(record.taskId || '') === String(task.id));

  return {
    task,
    evidenceMessageIds: [...messageIds],
    evidenceLogIds: [...logIds],
    messages: messages.filter((message) => messageIds.has(String(message.id || ''))),
    logs,
    events,
    submissions,
    evidenceSearches,
    submissionReviews,
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

function normalizeMembershipUserMap(value = {}) {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value)
    .map(([key, items]) => [
      String(key || '').trim(),
      uniqueStrings(Array.isArray(items) ? items : [items]),
    ])
    .filter(([key, items]) => key && items.length));
}

function normalizeProjectMembershipPolicy(project = {}, policy = {}, {
  now = nowIso(),
  updatedBy = '',
  revision = null,
  source = '',
} = {}) {
  const previous = project.projectMembershipPolicy || {};
  const teamAgentIds = uniqueStrings((project.team || []).map((agent) => agent.id));
  const nextRevision = revision !== null && revision !== undefined && Number.isFinite(Number(revision))
    ? Number(revision)
    : Math.max(1, Number(previous.revision || 0) + 1);
  return {
    schemaVersion: 'project-membership-policy/v1',
    projectId: project.id || policy.projectId || previous.projectId || null,
    source: source || policy.source || previous.source || 'project-state-membership-policy',
    revision: nextRevision,
    createdAt: previous.createdAt || policy.createdAt || now,
    updatedAt: now,
    updatedBy: updatedBy || policy.updatedBy || previous.updatedBy || null,
    managerUserIds: uniqueStrings(policy.managerUserIds || policy.managerUsers || previous.managerUserIds || []),
    securityAdminUserIds: uniqueStrings(policy.securityAdminUserIds || policy.securityAdmins || previous.securityAdminUserIds || []),
    observerUserIds: uniqueStrings(policy.observerUserIds || policy.observerUsers || previous.observerUserIds || []),
    runtimeUserIds: uniqueStrings(policy.runtimeUserIds || policy.runtimeUsers || policy.serviceUserIds || previous.runtimeUserIds || []),
    agentIds: uniqueStrings(policy.agentIds || policy.teamAgentIds || previous.agentIds || teamAgentIds),
    reviewerAgentIds: uniqueStrings(policy.reviewerAgentIds || policy.reviewerIds || previous.reviewerAgentIds || []),
    agentUserIds: normalizeMembershipUserMap(policy.agentUserIds || previous.agentUserIds || {}),
    reviewerUserIds: normalizeMembershipUserMap(policy.reviewerUserIds || previous.reviewerUserIds || {}),
    revokedUserIds: uniqueStrings(policy.revokedUserIds || policy.revokedUsers || previous.revokedUserIds || []),
    revokedAgentIds: uniqueStrings(policy.revokedAgentIds || policy.revokedAgents || previous.revokedAgentIds || []),
  };
}

function summarizeProjectMembershipPolicy(policy = null) {
  if (!policy || typeof policy !== 'object') {
    return {
      configured: false,
      schemaVersion: 'project-membership-policy/v1',
      status: 'missing',
    };
  }
  const agentBindingCount = Object.values(policy.agentUserIds || {}).reduce((sum, items) => sum + (items || []).length, 0);
  const reviewerBindingCount = Object.values(policy.reviewerUserIds || {}).reduce((sum, items) => sum + (items || []).length, 0);
  return {
    configured: true,
    schemaVersion: policy.schemaVersion || 'project-membership-policy/v1',
    status: (policy.revokedUserIds?.length || policy.revokedAgentIds?.length) ? 'configured-with-revocations' : 'configured',
    projectId: policy.projectId || null,
    source: policy.source || 'project-state-membership-policy',
    revision: policy.revision || null,
    updatedAt: policy.updatedAt || null,
    updatedBy: policy.updatedBy || null,
    managerUserCount: policy.managerUserIds?.length || 0,
    securityAdminUserCount: policy.securityAdminUserIds?.length || 0,
    observerUserCount: policy.observerUserIds?.length || 0,
    runtimeUserCount: policy.runtimeUserIds?.length || 0,
    agentCount: policy.agentIds?.length || 0,
    reviewerAgentCount: policy.reviewerAgentIds?.length || 0,
    agentBindingCount,
    reviewerBindingCount,
    revokedUserCount: policy.revokedUserIds?.length || 0,
    revokedAgentCount: policy.revokedAgentIds?.length || 0,
  };
}

function normalizeIdentitySessionRole(role = '') {
  const value = String(role || '').trim().toLowerCase().replace(/_/g, '-');
  if (['admin', 'security', 'security-admin', 'owner'].includes(value)) return 'security-admin';
  if (['lead', 'leader', 'manager', 'director'].includes(value)) return 'manager';
  if (['reviewer', 'reviewer-agent', 'review-agent'].includes(value)) return 'reviewer-agent';
  if (['agent', 'persona-agent'].includes(value)) return 'agent';
  if (['runtime', 'runtime-platform', 'scheduler', 'worker'].includes(value)) return 'runtime-platform';
  if (['viewer', 'observer', 'read-only'].includes(value)) return 'observer';
  if (['ops', 'operator', 'operations', 'operations-owner'].includes(value)) return 'operations-owner';
  return value || 'observer';
}

function identitySessionStatus(session = {}, now = nowIso()) {
  if (session.revokedAt || session.status === 'revoked') return 'revoked';
  const expiresAt = Date.parse(session.expiresAt || '');
  if (Number.isFinite(expiresAt) && expiresAt <= (Date.parse(now) || Date.now())) return 'expired';
  return session.status || 'active';
}

function identitySessionTokenHash(token = '') {
  return persistenceChecksum({ token: String(token || '') });
}

function generateIdentitySessionToken({ projectId = '', role = '', userId = '', agentId = '', now = nowIso(), index = 1 } = {}) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `hofs_sess_${slugPart(projectId || 'project')}_${slugPart(role || 'role')}_${slugPart(userId || agentId || 'actor')}_${Date.parse(now) || Date.now()}_${index}_${randomPart}`;
}

function summarizeIdentitySessions(project = {}, now = nowIso()) {
  const sessions = project.identitySessions || [];
  const rows = sessions.map((session) => ({
    ...session,
    status: identitySessionStatus(session, now),
  }));
  return {
    configured: rows.length > 0,
    schemaVersion: 'identity-session-summary/v1',
    count: rows.length,
    activeCount: rows.filter((session) => session.status === 'active').length,
    expiredCount: rows.filter((session) => session.status === 'expired').length,
    revokedCount: rows.filter((session) => session.status === 'revoked').length,
    managerCount: rows.filter((session) => session.role === 'manager').length,
    agentCount: rows.filter((session) => session.role === 'agent').length,
    reviewerCount: rows.filter((session) => session.role === 'reviewer-agent').length,
    runtimeCount: rows.filter((session) => session.role === 'runtime-platform').length,
    securityAdminCount: rows.filter((session) => session.role === 'security-admin').length,
    latestSessionId: rows[0]?.id || null,
    latestIssuedAt: rows[0]?.issuedAt || null,
  };
}

function buildIdentitySessionRecord(project = {}, input = {}, {
  now = nowIso(),
  token = '',
} = {}) {
  const role = normalizeIdentitySessionRole(input.role || input.actorRole || input.accessRole || 'observer');
  const index = (project.identitySessions || []).length + 1;
  const id = input.id || `identity_session_${role}_${Date.parse(now) || Date.now()}_${index}`;
  const ttlMs = Number.isFinite(Number(input.ttlMs))
    ? Math.max(60_000, Math.min(Number(input.ttlMs), 7 * 24 * 60 * 60 * 1000))
    : 24 * 60 * 60 * 1000;
  const issuedToken = token || generateIdentitySessionToken({
    projectId: project.id || input.projectId,
    role,
    userId: input.userId || input.actorUserId,
    agentId: input.agentId || input.actorAgentId,
    now,
    index,
  });
  const expiresAt = input.expiresAt || new Date((Date.parse(now) || Date.now()) + ttlMs).toISOString();
  const base = {
    id,
    projectId: project.id || input.projectId || null,
    role,
    userId: input.userId || input.actorUserId || '',
    agentId: input.agentId || input.actorAgentId || '',
    issuedAt: now,
    expiresAt,
    issuerRole: normalizeIdentitySessionRole(input.issuerRole || input.updatedByRole || 'manager'),
    issuerId: input.issuerId || input.updatedBy || input.actorUserId || input.userId || '',
    source: input.source || 'identity-session-api',
    status: 'active',
    tokenHash: identitySessionTokenHash(issuedToken),
    scope: uniqueStrings(input.scope || input.scopes || ['project']),
  };
  return {
    session: {
      ...base,
      schemaVersion: 'identity-session/v1',
      checksum: persistenceChecksum(base),
    },
    token: issuedToken,
  };
}

function publicIdentitySession(session = {}, now = nowIso()) {
  if (!session) return null;
  return {
    id: session.id,
    schemaVersion: session.schemaVersion || 'identity-session/v1',
    projectId: session.projectId || null,
    role: session.role || null,
    userId: session.userId || null,
    agentId: session.agentId || null,
    status: identitySessionStatus(session, now),
    issuedAt: session.issuedAt || null,
    expiresAt: session.expiresAt || null,
    revokedAt: session.revokedAt || null,
    issuerRole: session.issuerRole || null,
    issuerId: session.issuerId || null,
    source: session.source || null,
    scope: session.scope || [],
    checksum: session.checksum || null,
    tokenHash: session.tokenHash ? `${String(session.tokenHash).slice(0, 10)}...` : null,
  };
}

function updateProjectMembershipPolicy(project = {}, {
  policy = {},
  now = nowIso(),
  updatedBy = '',
  source = '',
} = {}) {
  const normalizedPolicy = normalizeProjectMembershipPolicy(project, policy, { now, updatedBy, source });
  const summary = summarizeProjectMembershipPolicy(normalizedPolicy);
  const timestamp = Date.parse(now) || Date.now();
  const log = {
    id: `log_project_membership_${project.id}_${timestamp}`,
    time: now,
    agent: 'Security Boundary',
    actor: 'Security Boundary',
    eventType: 'project-membership-policy-updated',
    source: 'project-membership-policy',
    channelId: 'security',
    log: `Project membership policy revision ${normalizedPolicy.revision} was updated for ${project.name || project.id}.`,
    projectMembershipPolicyRevision: normalizedPolicy.revision,
    projectMembershipSummary: summary,
  };
  const eventId = `evt_project_membership_${project.id}_${timestamp}`;
  const auditEntry = {
    id: `membership_audit_${project.id}_${timestamp}`,
    projectId: project.id,
    revision: normalizedPolicy.revision,
    updatedAt: now,
    updatedBy: normalizedPolicy.updatedBy,
    source: normalizedPolicy.source,
    logId: log.id,
    eventId,
    summary,
  };
  const updatedProject = appendProjectEvents({
    ...project,
    projectMembershipPolicy: normalizedPolicy,
    projectMembershipAudit: [auditEntry, ...(project.projectMembershipAudit || [])].slice(0, PROJECT_MEMBERSHIP_AUDIT_LIMIT),
    logs: [log, ...(project.logs || [])],
  }, [
    createProjectLedgerEvent({
      id: eventId,
      type: 'project-membership-policy-updated',
      time: now,
      actor: `Security Boundary:${normalizedPolicy.updatedBy || 'system'}`,
      summary: log.log,
      source: 'project-membership-policy',
      channelId: 'security',
      evidenceIds: [log.id, auditEntry.id],
      entityIds: {
        projectId: project.id,
        membershipPolicyRevision: normalizedPolicy.revision,
        membershipAuditId: auditEntry.id,
      },
      payload: {
        revision: normalizedPolicy.revision,
        source: normalizedPolicy.source,
        summary,
      },
    }),
  ]);
  return {
    project: updatedProject,
    projectMembershipPolicy: normalizedPolicy,
    projectMembershipSummary: summary,
    projectMembershipAuditEntry: auditEntry,
    log,
  };
}

function slugPart(value = 'item') {
  const slug = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'item';
}

function normalizeAgentSubmissionArtifactType(value = 'progress-brief') {
  const normalized = slugPart(value || 'progress-brief');
  return AGENT_SUBMISSION_ARTIFACT_TYPES.has(normalized) ? normalized : 'progress-brief';
}

function normalizeAgentSubmissionStatus(value = 'submitted') {
  const normalized = slugPart(value || 'submitted');
  return AGENT_SUBMISSION_STATUSES.has(normalized) ? normalized : 'submitted';
}

function normalizeEvidenceSearchStatus(value = 'completed') {
  const normalized = slugPart(value || 'completed');
  return AGENT_EVIDENCE_SEARCH_STATUSES.has(normalized) ? normalized : 'completed';
}

function normalizeSubmissionReviewStatus(value = 'under-review') {
  const normalized = slugPart(value || 'under-review');
  if (normalized === 'approved') return 'accepted';
  if (normalized === 'request-changes' || normalized === 'revision-requested') return 'changes-requested';
  return AGENT_SUBMISSION_REVIEW_STATUSES.has(normalized) ? normalized : 'under-review';
}

function normalizeConfidence(value = 'medium') {
  const normalized = slugPart(value || 'medium');
  return ['low', 'medium', 'high', 'unknown'].includes(normalized) ? normalized : 'medium';
}

function evidenceConfidenceScore(confidence = 'medium') {
  const normalized = normalizeConfidence(confidence);
  if (normalized === 'high') return 35;
  if (normalized === 'medium') return 24;
  if (normalized === 'low') return 12;
  return 6;
}

function evidenceQualityLevel(score = 0) {
  const numeric = Number(score) || 0;
  if (numeric >= 80) return 'strong';
  if (numeric >= 60) return 'usable';
  if (numeric >= 40) return 'weak';
  return 'unknown';
}

function safeJsonForInspection(value = {}) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return String(value || '');
  }
}

function inspectSourceUrlSafety(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) {
    return {
      signals: ['url:absent'],
      reviewCount: 0,
      blockedCount: 0,
    };
  }
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.replace(/:$/, '').toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const signals = [`url-scheme:${protocol}`];
    let reviewCount = 0;
    let blockedCount = 0;
    if (!['http', 'https'].includes(protocol)) {
      signals.push('blocked-url-scheme');
      blockedCount += 1;
    }
    if (parsed.username || parsed.password) {
      signals.push('credentialed-url');
      blockedCount += 1;
    }
    if (
      host === 'localhost'
      || host === '0.0.0.0'
      || host === '127.0.0.1'
      || host === '::1'
      || /^127\./.test(host)
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^169\.254\./.test(host)
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      signals.push('blocked-local-or-private-host');
      blockedCount += 1;
    } else {
      signals.push('public-host');
    }
    const secretParamKeys = [...parsed.searchParams.keys()]
      .filter((key) => /api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential/i.test(key));
    if (secretParamKeys.length) {
      signals.push('sensitive-url-parameter-redacted');
      reviewCount += 1;
    }
    return { signals, reviewCount, blockedCount };
  } catch {
    return {
      signals: ['url:unparseable'],
      reviewCount: 1,
      blockedCount: 0,
    };
  }
}

function judgeEvidenceSourceSafety(item = {}) {
  const kind = slugPart(item.kind || item.type || 'source');
  const rawUrl = item.url || item.href || '';
  const rawText = [
    item.title,
    item.name,
    item.summary,
    item.snippet,
    item.note,
    item.content,
    rawUrl,
    safeJsonForInspection(item.metadata || item.extra || {}),
  ].filter(Boolean).join('\n');
  const urlSafety = inspectSourceUrlSafety(rawUrl);
  const promptInjectionSignals = [
    /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|messages|prompts?)\b/i.test(rawText) ? 'prompt-injection:ignore-instructions' : null,
    /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/i.test(rawText) ? 'prompt-injection:system-prompt-reference' : null,
    /\b(?:exfiltrat|leak|reveal|dump|print)\w*\b[\s\S]{0,80}\b(?:secret|token|api[_\s-]?key|credential|prompt)\b/i.test(rawText) ? 'prompt-injection:exfiltration-request' : null,
    /\b(?:tool|function)\s*call\b[\s\S]{0,80}\b(?:without|ignore|bypass)\b/i.test(rawText) ? 'prompt-injection:tool-bypass-request' : null,
  ].filter(Boolean);
  const rawSecretScan = scanTextForRawSecretLeaks(rawText);
  const isInternalProof = /project-proof|runtime-proof|backend-route|task-evidence|ledger|transcript/.test(kind);
  const signals = [
    'source-safety-screened',
    isInternalProof ? 'internal-runtime-proof' : 'external-source',
    ...urlSafety.signals,
    ...promptInjectionSignals,
    rawSecretScan.count > 0 ? 'raw-secret-pattern-redacted' : null,
  ].filter(Boolean);
  const reviewCount = urlSafety.reviewCount
    + promptInjectionSignals.length
    + (rawSecretScan.count > 0 ? 1 : 0);
  const blockedCount = urlSafety.blockedCount;
  const sourceSafetyLevel = blockedCount > 0
    ? 'blocked'
    : reviewCount > 0
      ? 'review'
      : 'safe';
  const sourceSafetyScore = Math.max(0, Math.min(100, 100 - (blockedCount * 45) - (reviewCount * 18)));
  return {
    sourceSafetyLevel,
    sourceSafetyScore,
    sourceSafetySignals: uniqueStrings(signals),
    sourceSafetyReviewCount: reviewCount,
    sourceSafetyBlockedSignalCount: blockedCount,
    promptInjectionSignalCount: promptInjectionSignals.length,
    secretPatternSignalCount: rawSecretScan.count,
    judgement: sourceSafetyLevel === 'blocked'
      ? 'blocked-source'
      : sourceSafetyLevel === 'review'
        ? 'review-source'
        : 'safe-source',
  };
}

function judgeEvidenceSource(item = {}) {
  const confidence = normalizeConfidence(item.confidence || 'medium');
  const kind = slugPart(item.kind || item.type || 'source');
  const hasUrl = Boolean(item.url || item.href);
  const hasSummary = Boolean(String(item.summary || item.snippet || item.note || '').trim());
  const isInternalProof = /project-proof|runtime-proof|backend-route|task-evidence|ledger|transcript/.test(kind);
  const isEvidencePacket = /evidence|source|research|report|proof/.test(kind);
  const signals = [
    `confidence:${confidence}`,
    `kind:${kind}`,
    hasUrl ? 'url-present' : 'url-absent',
    hasSummary ? 'summary-present' : 'summary-absent',
    isInternalProof ? 'internal-runtime-proof' : null,
    isEvidencePacket ? 'evidence-oriented-kind' : null,
  ].filter(Boolean);
  const score = Math.min(100, evidenceConfidenceScore(confidence)
    + (isInternalProof ? 28 : 0)
    + (isEvidencePacket ? 14 : 0)
    + (hasUrl ? 10 : 0)
    + (hasSummary ? 13 : 0));
  return {
    qualityScore: score,
    qualityLevel: evidenceQualityLevel(score),
    qualitySignals: signals,
    judgement: score >= 80
      ? 'strong-source'
      : score >= 60
        ? 'usable-source'
        : score >= 40
          ? 'weak-source'
          : 'unknown-source',
  };
}

function summarizeEvidenceQuality(sources = [], findings = [], confidence = 'medium') {
  const qualityScores = sources.map((source) => Number(source.qualityScore) || 0);
  const averageScore = qualityScores.length
    ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
    : 0;
  const strongSourceCount = sources.filter((source) => source.qualityLevel === 'strong').length;
  const usableSourceCount = sources.filter((source) => ['strong', 'usable'].includes(source.qualityLevel)).length;
  const weakSourceCount = sources.filter((source) => source.qualityLevel === 'weak').length;
  const unknownSourceCount = sources.filter((source) => source.qualityLevel === 'unknown').length;
  const normalizedConfidence = normalizeConfidence(confidence);
  const judgement = strongSourceCount >= 2 && averageScore >= 70
    ? 'strong-evidence'
    : usableSourceCount >= 2 && averageScore >= 55
      ? 'usable-evidence'
      : sources.length > 0
        ? 'needs-corroboration'
        : 'no-evidence';
  return {
    judgement,
    averageScore,
    confidence: normalizedConfidence,
    sourceCount: sources.length,
    findingCount: (findings || []).length,
    strongSourceCount,
    usableSourceCount,
    weakSourceCount,
    unknownSourceCount,
    decisionUse: judgement === 'strong-evidence'
      ? 'decision-ready'
      : judgement === 'usable-evidence'
        ? 'usable-with-review'
        : judgement === 'needs-corroboration'
          ? 'needs-more-sources'
          : 'blocked-no-sources',
  };
}

function summarizeEvidenceSourceSafety(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  const reviewedSourceCount = list.filter((source) => source.sourceSafetyLevel && Array.isArray(source.sourceSafetySignals)).length;
  const safeSourceCount = list.filter((source) => source.sourceSafetyLevel === 'safe').length;
  const reviewSourceCount = list.filter((source) => source.sourceSafetyLevel === 'review').length;
  const blockedSourceCount = list.filter((source) => source.sourceSafetyLevel === 'blocked').length;
  const averageSourceSafetyScore = list.length
    ? Math.round(list.reduce((sum, source) => sum + (Number(source.sourceSafetyScore) || 0), 0) / list.length)
    : 0;
  const promptInjectionSignalCount = list.reduce((sum, source) => sum + (Number(source.promptInjectionSignalCount) || 0), 0);
  const secretPatternSignalCount = list.reduce((sum, source) => sum + (Number(source.secretPatternSignalCount) || 0), 0);
  const blockedSignalCount = list.reduce((sum, source) => sum + (Number(source.sourceSafetyBlockedSignalCount) || 0), 0);
  const highestRiskLevel = blockedSourceCount > 0
    ? 'blocked'
    : reviewSourceCount > 0
      ? 'review'
      : list.length > 0
        ? 'safe'
        : 'unknown';
  return {
    schemaVersion: 'evidence-source-safety/v1',
    sourceCount: list.length,
    reviewedSourceCount,
    safeSourceCount,
    reviewSourceCount,
    blockedSourceCount,
    blockedSignalCount,
    promptInjectionSignalCount,
    secretPatternSignalCount,
    averageSourceSafetyScore,
    highestRiskLevel,
    sourceSafetyReady: list.length > 0 && reviewedSourceCount === list.length && blockedSourceCount === 0,
    decisionUse: blockedSourceCount > 0
      ? 'blocked-source-present'
      : reviewSourceCount > 0
        ? 'usable-with-source-review'
        : list.length > 0
          ? 'safe-to-use'
          : 'no-sources',
  };
}

function normalizeEvidenceSources(sources = [], now = nowIso()) {
  const list = Array.isArray(sources) ? sources : [];
  return list.slice(0, 24).map((source, index) => {
    const item = source && typeof source === 'object' ? source : { title: String(source || '') };
    const title = redactSensitiveText(String(item.title || item.name || item.url || `Evidence source ${index + 1}`).trim());
    const kind = slugPart(item.kind || item.type || 'source');
    const judged = judgeEvidenceSource({ ...item, kind });
    const safety = judgeEvidenceSourceSafety({ ...item, kind });
    return {
      id: item.id || `source_${index + 1}_${slugPart(title).slice(0, 24)}`,
      title,
      kind,
      url: item.url || item.href ? redactUrl(item.url || item.href) : null,
      summary: redactSensitiveText(item.summary || item.snippet || item.note || ''),
      confidence: normalizeConfidence(item.confidence || item.quality || 'medium'),
      qualityScore: judged.qualityScore,
      qualityLevel: judged.qualityLevel,
      qualitySignals: judged.qualitySignals,
      judgement: judged.judgement,
      sourceSafetyLevel: safety.sourceSafetyLevel,
      sourceSafetyScore: safety.sourceSafetyScore,
      sourceSafetySignals: safety.sourceSafetySignals,
      sourceSafetyReviewCount: safety.sourceSafetyReviewCount,
      sourceSafetyBlockedSignalCount: safety.sourceSafetyBlockedSignalCount,
      promptInjectionSignalCount: safety.promptInjectionSignalCount,
      secretPatternSignalCount: safety.secretPatternSignalCount,
      sourceSafetyJudgement: safety.judgement,
      capturedAt: item.capturedAt || item.searchedAt || now,
    };
  }).filter((source) => source.title);
}

function artifactExtensionForType(type = '') {
  if (['brainstorm-board', 'evidence-packet'].includes(type)) return 'md';
  return 'md';
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
  const submissionRecords = project.agentSubmissions || [];
  const submissionProofIds = uniqueStrings(submissionRecords.map((submission) => submission.messageId));
  const submissionLogIds = uniqueStrings(submissionRecords.map((submission) => submission.timelineLogId));
  const submissionEventIds = uniqueStrings(submissionRecords.map((submission) => submission.eventId));
  const revisionRecords = submissionRecords.filter((submission) => (
    submission.revisesSubmissionId
    || submission.respondsToReviewId
    || (submission.supersedesSubmissionIds || []).length
  ));
  const evidenceSearchRecords = project.evidenceSearches || [];
  const evidenceSearchProofIds = uniqueStrings(evidenceSearchRecords.map((record) => record.messageId));
  const evidenceSearchLogIds = uniqueStrings(evidenceSearchRecords.map((record) => record.timelineLogId));
  const evidenceSearchEventIds = uniqueStrings(evidenceSearchRecords.map((record) => record.eventId));
  const submissionReviewRecords = project.submissionReviews || [];
  const submissionReviewProofIds = uniqueStrings(submissionReviewRecords.map((review) => review.messageId));
  const submissionReviewLogIds = uniqueStrings(submissionReviewRecords.map((review) => review.timelineLogId));
  const submissionReviewEventIds = uniqueStrings(submissionReviewRecords.map((review) => review.eventId));
  const launchApprovalRecords = project.launchApprovals || [];
  const launchApprovalEventIdsFor = (approval = {}) => uniqueStrings((project.eventLedger || [])
    .filter((event) => event.entityIds?.launchApprovalId === approval.id)
    .map((event) => event.id));
  const launchApprovalLogIdsFor = (approval = {}) => uniqueStrings((project.logs || [])
    .filter((log) => log.launchApprovalId === approval.id)
    .map((log) => log.id));
  const projectEvidenceExportRecords = project.projectEvidenceExports || [];
  const projectEvidenceExportEventIdsFor = (record = {}) => uniqueStrings((project.eventLedger || [])
    .filter((event) => event.entityIds?.projectEvidenceExportId === record.id || event.entityIds?.exportRequestId === record.exportRequestId)
    .map((event) => event.id));
  const projectEvidenceExportLogIdsFor = (record = {}) => uniqueStrings((project.logs || [])
    .filter((log) => log.projectEvidenceExportId === record.id || log.exportRequestId === record.exportRequestId)
    .map((log) => log.id));
  const kickoffConversationRows = [
    ...(project.initiation?.roleNegotiation?.transcript || []).map((item) => ({
      id: item.id,
      stage: item.type === 'role-question' ? 'role-clarification' : 'self-nomination',
      speakerId: item.speakerId || null,
      speakerName: item.speaker || item.agentName || item.speakerId || 'Agent',
      text: item.text || '',
      heardBy: item.hears || item.hearsOthers || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
    })),
    ...(project.initiation?.leaderElection?.transcript || []).map((item) => ({
      id: item.id,
      stage: 'leader-campaign',
      speakerId: item.speakerId || item.agentId || null,
      speakerName: item.speaker || item.agentName || item.name || item.speakerId || 'Agent',
      text: item.text || '',
      heardBy: item.hearsOthers || item.hears || [],
      proofIds: [item.id].filter(Boolean),
      channelId: item.channelId || 'main',
    })),
  ];
  const eventIdsForProofIds = (proofIds = [], types = []) => {
    const proofSet = new Set((proofIds || []).filter(Boolean).map(String));
    const typeSet = new Set((types || []).filter(Boolean).map(String));
    return uniqueStrings((project.eventLedger || [])
      .filter((event) => (
        (!typeSet.size || typeSet.has(String(event.type || '')))
        && [
          ...(event.evidenceIds || []),
          event.entityIds?.messageId,
          event.entityIds?.logId,
        ].filter(Boolean).some((id) => proofSet.has(String(id)))
      ))
      .map((event) => event.id));
  };
  const roleNegotiationRoutes = kickoffConversationRows
    .filter((row) => ['role-clarification', 'self-nomination'].includes(row.stage))
    .map((row) => {
      const proofIds = uniqueStrings(row.proofIds || [row.id]);
      return {
        proofKind: row.stage === 'self-nomination' ? 'self-marketing' : 'role-negotiation',
        proofLabel: row.stage === 'self-nomination'
          ? `${row.speakerName} role self-nomination`
          : `${row.speakerName} role clarification`,
        apiPath: projectId ? `/projects/${projectId}/transcripts/${row.channelId || 'main'}` : null,
        channelId: row.channelId || 'main',
        proofIds,
        timelineLogIds: [],
        eventIds: eventIdsForProofIds(proofIds, ['kickoff-role-question', 'kickoff-role-volunteer']),
        taskIds: [],
        agentIds: [row.speakerId].filter(Boolean),
        stage: row.stage,
        heardBy: uniqueStrings(row.heardBy || []),
      };
    });
  const selfMarketingRoutes = kickoffConversationRows
    .filter((row) => ['self-nomination', 'leader-campaign'].includes(row.stage))
    .map((row) => {
      const proofIds = uniqueStrings(row.proofIds || [row.id]);
      return {
        proofKind: 'self-marketing',
        proofLabel: row.stage === 'leader-campaign'
          ? `${row.speakerName} Leader campaign`
          : `${row.speakerName} role self-nomination`,
        apiPath: projectId ? `/projects/${projectId}/transcripts/${row.channelId || 'main'}` : null,
        channelId: row.channelId || 'main',
        proofIds,
        timelineLogIds: [],
        eventIds: eventIdsForProofIds(proofIds, ['kickoff-role-volunteer', 'kickoff-leader-campaign']),
        taskIds: [],
        agentIds: [row.speakerId].filter(Boolean),
        stage: row.stage,
        heardBy: uniqueStrings(row.heardBy || []),
      };
    });

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
    roleNegotiationRoutes,
    roleNegotiationSummary: {
      count: roleNegotiationRoutes.length,
      proofIds: uniqueStrings(roleNegotiationRoutes.flatMap((item) => item.proofIds || [])),
      eventIds: uniqueStrings(roleNegotiationRoutes.flatMap((item) => item.eventIds || [])),
      selfNominationCount: roleNegotiationRoutes.filter((item) => item.stage === 'self-nomination').length,
      roleClarificationCount: roleNegotiationRoutes.filter((item) => item.stage === 'role-clarification').length,
    },
    selfMarketingRoutes,
    selfMarketingSummary: {
      count: selfMarketingRoutes.length,
      proofIds: uniqueStrings(selfMarketingRoutes.flatMap((item) => item.proofIds || [])),
      eventIds: uniqueStrings(selfMarketingRoutes.flatMap((item) => item.eventIds || [])),
      selfNominationCount: selfMarketingRoutes.filter((item) => item.stage === 'self-nomination').length,
      leaderCampaignCount: selfMarketingRoutes.filter((item) => item.stage === 'leader-campaign').length,
    },
    submissionRoutes: submissionRecords.map((submission) => ({
      proofKind: 'agent-submission',
      proofLabel: submission.title || submission.artifactType || 'Agent submission',
      apiPath: projectId ? `/projects/${projectId}/submissions/${submission.id}` : null,
      channelId: submission.channelId || 'main',
      proofIds: [submission.messageId].filter(Boolean),
      timelineLogIds: [submission.timelineLogId].filter(Boolean),
      eventIds: [submission.eventId].filter(Boolean),
      taskIds: [submission.taskId].filter(Boolean),
      agentIds: uniqueStrings([submission.agentId, submission.requestedReviewAgentId].filter(Boolean)),
      artifactType: submission.artifactType,
      artifactPath: submission.artifactPath || submission.workspacePath || null,
    })),
    submissionSummary: {
      count: submissionRecords.length,
      proofIds: submissionProofIds,
      timelineLogIds: submissionLogIds,
      eventIds: submissionEventIds,
      artifactTypes: uniqueStrings(submissionRecords.map((submission) => submission.artifactType)),
      revisionCount: revisionRecords.length,
      supersededCount: submissionRecords.filter((submission) => submission.status === 'superseded').length,
    },
    revisionRoutes: revisionRecords.map((submission) => ({
      proofKind: 'artifact-revision',
      proofLabel: submission.title || submission.artifactType || 'Artifact revision',
      apiPath: projectId ? `/projects/${projectId}/submissions/${submission.id}` : null,
      channelId: submission.channelId || 'main',
      proofIds: [submission.messageId].filter(Boolean),
      timelineLogIds: [submission.timelineLogId].filter(Boolean),
      eventIds: [submission.eventId].filter(Boolean),
      taskIds: [submission.taskId].filter(Boolean),
      agentIds: uniqueStrings([submission.agentId, submission.requestedReviewAgentId].filter(Boolean)),
      artifactType: submission.artifactType,
      revisesSubmissionId: submission.revisesSubmissionId || null,
      respondsToReviewId: submission.respondsToReviewId || null,
      supersedesSubmissionIds: submission.supersedesSubmissionIds || [],
    })),
    revisionSummary: {
      count: revisionRecords.length,
      proofIds: uniqueStrings(revisionRecords.map((submission) => submission.messageId)),
      timelineLogIds: uniqueStrings(revisionRecords.map((submission) => submission.timelineLogId)),
      eventIds: uniqueStrings(revisionRecords.map((submission) => submission.eventId)),
      respondedReviewIds: uniqueStrings(revisionRecords.map((submission) => submission.respondsToReviewId)),
      revisedSubmissionIds: uniqueStrings(revisionRecords.flatMap((submission) => [
        submission.revisesSubmissionId,
        ...(submission.supersedesSubmissionIds || []),
      ])),
    },
    evidenceSearchRoutes: evidenceSearchRecords.map((record) => ({
      proofKind: 'evidence-search',
      proofLabel: record.query || 'Evidence search',
      apiPath: projectId ? `/projects/${projectId}/evidence-searches/${record.id}` : null,
      channelId: record.channelId || 'main',
      proofIds: [record.messageId].filter(Boolean),
      timelineLogIds: [record.timelineLogId].filter(Boolean),
      eventIds: [record.eventId].filter(Boolean),
      taskIds: [record.taskId].filter(Boolean),
      agentIds: [record.agentId].filter(Boolean),
      sourceCount: record.sources?.length || 0,
      confidence: record.confidence || null,
      evidenceJudgement: record.evidenceJudgement || record.qualitySummary?.judgement || null,
      qualityScore: record.qualityScore ?? record.qualitySummary?.averageScore ?? null,
      qualitySummary: record.qualitySummary || null,
      sourceSafetySummary: record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || []),
    })),
    evidenceSearchSummary: {
      count: evidenceSearchRecords.length,
      proofIds: evidenceSearchProofIds,
      timelineLogIds: evidenceSearchLogIds,
      eventIds: evidenceSearchEventIds,
      sourceCount: evidenceSearchRecords.reduce((sum, record) => sum + (record.sources?.length || 0), 0),
      averageQualityScore: evidenceSearchRecords.length
        ? Math.round(evidenceSearchRecords.reduce((sum, record) => sum + (Number(record.qualityScore ?? record.qualitySummary?.averageScore) || 0), 0) / evidenceSearchRecords.length)
        : 0,
      strongEvidenceCount: evidenceSearchRecords.filter((record) => record.evidenceJudgement === 'strong-evidence' || record.qualitySummary?.judgement === 'strong-evidence').length,
      usableEvidenceCount: evidenceSearchRecords.filter((record) => ['strong-evidence', 'usable-evidence'].includes(record.evidenceJudgement || record.qualitySummary?.judgement)).length,
      providers: uniqueStrings(evidenceSearchRecords.map((record) => record.provider)),
      sourceSafetyReadyCount: evidenceSearchRecords.filter((record) => (record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).sourceSafetyReady).length,
      sourceSafetyBlockedSourceCount: evidenceSearchRecords.reduce((sum, record) => sum + ((record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).blockedSourceCount || 0), 0),
      sourceSafetyReviewSourceCount: evidenceSearchRecords.reduce((sum, record) => sum + ((record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).reviewSourceCount || 0), 0),
    },
    submissionReviewRoutes: submissionReviewRecords.map((review) => ({
      proofKind: 'submission-review',
      proofLabel: `${review.verdict || 'review'}: ${review.submissionId}`,
      apiPath: projectId ? `/projects/${projectId}/submission-reviews/${review.id}` : null,
      channelId: review.channelId || 'main',
      proofIds: [review.messageId].filter(Boolean),
      timelineLogIds: [review.timelineLogId].filter(Boolean),
      eventIds: [review.eventId].filter(Boolean),
      taskIds: [review.taskId].filter(Boolean),
      agentIds: uniqueStrings([review.reviewerAgentId, review.submitterAgentId].filter(Boolean)),
      verdict: review.verdict || null,
      submissionId: review.submissionId,
    })),
    submissionReviewSummary: {
      count: submissionReviewRecords.length,
      proofIds: submissionReviewProofIds,
      timelineLogIds: submissionReviewLogIds,
      eventIds: submissionReviewEventIds,
      acceptedCount: submissionReviewRecords.filter((review) => review.verdict === 'accepted').length,
      changesRequestedCount: submissionReviewRecords.filter((review) => review.verdict === 'changes-requested').length,
    },
    launchApprovalRoutes: launchApprovalRecords.map((approval) => ({
      proofKind: 'launch-approval',
      proofLabel: `${approval.mode || 'private-pilot'} launch ${approval.decision || approval.status || 'approval'}`,
      apiPath: projectId ? `/projects/${projectId}/launch-approvals` : null,
      channelId: null,
      proofIds: [approval.id, approval.checksum].filter(Boolean),
      timelineLogIds: launchApprovalLogIdsFor(approval),
      eventIds: launchApprovalEventIdsFor(approval),
      taskIds: [],
      agentIds: [],
      mode: approval.mode || 'private-pilot',
      decision: approval.decision || approval.status || 'requested',
      approverRole: approval.approverRole || null,
      approverId: approval.approverId || null,
      checksum: approval.checksum || null,
      linkedAuditChecksum: approval.linkedAuditChecksum || null,
    })),
    launchApprovalSummary: {
      count: launchApprovalRecords.length,
      approvedCount: launchApprovalRecords.filter((approval) => approval.decision === 'approved').length,
      rejectedCount: launchApprovalRecords.filter((approval) => approval.decision === 'rejected').length,
      privatePilotApprovalCount: launchApprovalRecords.filter((approval) => normalizeLaunchApprovalMode(approval.mode) === 'private-pilot').length,
      productionApprovalCount: launchApprovalRecords.filter((approval) => normalizeLaunchApprovalMode(approval.mode) === 'production').length,
      proofIds: uniqueStrings(launchApprovalRecords.flatMap((approval) => [approval.id, approval.checksum])),
      timelineLogIds: uniqueStrings(launchApprovalRecords.flatMap((approval) => launchApprovalLogIdsFor(approval))),
      eventIds: uniqueStrings(launchApprovalRecords.flatMap((approval) => launchApprovalEventIdsFor(approval))),
    },
    projectEvidenceExportRoutes: projectEvidenceExportRecords.map((record) => ({
      proofKind: 'project-evidence-export',
      proofLabel: `${record.mode || 'private-pilot'} evidence export ${record.action || record.decision || 'record'}`,
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
      channelId: null,
      proofIds: [record.id, record.checksum, record.archiveChecksum].filter(Boolean),
      timelineLogIds: projectEvidenceExportLogIdsFor(record),
      eventIds: projectEvidenceExportEventIdsFor(record),
      taskIds: [],
      agentIds: [],
      mode: record.mode || 'private-pilot',
      action: record.action || 'request',
      decision: record.decision || record.status || 'requested',
      actorRole: record.actorRole || null,
      actorId: record.actorId || null,
      archiveChecksum: record.archiveChecksum || null,
      retentionDays: record.retentionDays || null,
      expiresAt: record.expiresAt || null,
      dataResidencyRegion: record.dataResidencyRegion || null,
      checksum: record.checksum || null,
    })),
    projectEvidenceExportSummary: {
      count: projectEvidenceExportRecords.length,
      requestCount: projectEvidenceExportRecords.filter((record) => record.action === 'request').length,
      approvalCount: projectEvidenceExportRecords.filter((record) => record.action === 'approve').length,
      rejectionCount: projectEvidenceExportRecords.filter((record) => record.action === 'reject').length,
      downloadAuditCount: projectEvidenceExportRecords.filter((record) => record.action === 'download-audit').length,
      proofIds: uniqueStrings(projectEvidenceExportRecords.flatMap((record) => [record.id, record.checksum, record.archiveChecksum])),
      timelineLogIds: uniqueStrings(projectEvidenceExportRecords.flatMap((record) => projectEvidenceExportLogIdsFor(record))),
      eventIds: uniqueStrings(projectEvidenceExportRecords.flatMap((record) => projectEvidenceExportEventIdsFor(record))),
    },
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
  const ownedSubmissions = (project.agentSubmissions || [])
    .filter((submission) => submission.agentId === agent.id || submission.requestedReviewAgentId === agent.id)
    .map((submission) => ({
      ...submission,
      roleInSubmission: submission.agentId === agent.id ? 'submitter' : 'reviewer',
      backendPath: projectId ? `/projects/${projectId}/submissions/${submission.id}` : null,
    }));
  const ownedEvidenceSearches = (project.evidenceSearches || [])
    .filter((record) => record.agentId === agent.id)
    .map((record) => ({
      ...record,
      backendPath: projectId ? `/projects/${projectId}/evidence-searches/${record.id}` : null,
    }));
  const ownedSubmissionReviews = (project.submissionReviews || [])
    .filter((review) => review.reviewerAgentId === agent.id || review.submitterAgentId === agent.id)
    .map((review) => ({
      ...review,
      roleInReview: review.reviewerAgentId === agent.id ? 'reviewer' : 'submitter',
      backendPath: projectId ? `/projects/${projectId}/submission-reviews/${review.id}` : null,
    }));

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
  const submissionChatProofIds = uniqueStrings(ownedSubmissions.map((submission) => submission.messageId));
  const submissionTimelineLogIds = uniqueStrings(ownedSubmissions.map((submission) => submission.timelineLogId));
  const evidenceSearchChatProofIds = uniqueStrings(ownedEvidenceSearches.map((record) => record.messageId));
  const evidenceSearchTimelineLogIds = uniqueStrings(ownedEvidenceSearches.map((record) => record.timelineLogId));
  const submissionReviewChatProofIds = uniqueStrings(ownedSubmissionReviews.map((review) => review.messageId));
  const submissionReviewTimelineLogIds = uniqueStrings(ownedSubmissionReviews.map((review) => review.timelineLogId));
  const taskChatProofIds = uniqueStrings(ownedTasks.flatMap((task) => task.evidence.chatIds));
  const taskTimelineLogIds = uniqueStrings(ownedTasks.flatMap((task) => task.evidence.timelineLogIds));
  const allAgentProofMessageIds = new Set([
    ...inboxMessageIds,
    ...obligationMessageIds,
    ...worklogMessageIds,
    ...submissionChatProofIds,
    ...evidenceSearchChatProofIds,
    ...submissionReviewChatProofIds,
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
    || submissionTimelineLogIds.includes(String(log.id || ''))
    || evidenceSearchTimelineLogIds.includes(String(log.id || ''))
    || submissionReviewTimelineLogIds.includes(String(log.id || ''))
    || (log.directTargetIds || []).map(String).includes(String(agent.id))
  ));
  const managementLogTypes = ['management-check-in', 'peer-management-check-in', 'review-sweep', 'management-response'];
  const managementProofLogs = agentLogs.filter((log) => managementLogTypes.includes(log.eventType));
  const proofTimelineLogIds = uniqueStrings([
    ...taskTimelineLogIds,
    ...submissionTimelineLogIds,
    ...evidenceSearchTimelineLogIds,
    ...submissionReviewTimelineLogIds,
    ...agentLogs.map((log) => log.id),
  ]);
  const proofChatIds = uniqueStrings([
    ...taskChatProofIds,
    ...submissionChatProofIds,
    ...evidenceSearchChatProofIds,
    ...submissionReviewChatProofIds,
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
    ownedSubmissions,
    ownedEvidenceSearches,
    ownedSubmissionReviews,
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
      submissionIds: uniqueStrings(ownedSubmissions.map((submission) => submission.id)),
      evidenceSearchIds: uniqueStrings(ownedEvidenceSearches.map((record) => record.id)),
      submissionReviewIds: uniqueStrings(ownedSubmissionReviews.map((review) => review.id)),
    },
    backendRoutes: {
      agent: projectId ? `/projects/${projectId}/agents/${agent.id}` : null,
      dashboard: projectId ? `/projects/${projectId}/agents/${agent.id}/dashboard` : null,
      inbox: projectId ? `/projects/${projectId}/agents/${agent.id}/inbox` : null,
      worklog: projectId ? `/projects/${projectId}/agents/${agent.id}/worklog` : null,
      obligations: projectId ? `/projects/${projectId}/agents/${agent.id}/obligations` : null,
      plan: projectId ? `/projects/${projectId}/agents/${agent.id}/plan` : null,
      tasks: projectId ? `/projects/${projectId}/tasks` : null,
      submissions: projectId ? `/projects/${projectId}/submissions` : null,
      evidenceSearches: projectId ? `/projects/${projectId}/evidence-searches` : null,
      submissionReviews: projectId ? `/projects/${projectId}/submission-reviews` : null,
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
  const securityAccessAudit = summarizeSecurityAccessAudit(project.securityAccessAudit || []);
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
      ...(project.agentSubmissions || [])
        .filter((submission) => String(submission.taskId || '') === String(task.id || ''))
        .map((submission) => submission.messageId),
      ...(project.evidenceSearches || [])
        .filter((record) => String(record.taskId || '') === String(task.id || ''))
        .map((record) => record.messageId),
      ...(project.submissionReviews || [])
        .filter((review) => String(review.taskId || '') === String(task.id || ''))
        .map((review) => review.messageId),
    ]),
    timelineIds: uniqueStrings([
      ...(task.timelineLogIds || []),
      ...(project.agentSubmissions || [])
        .filter((submission) => String(submission.taskId || '') === String(task.id || ''))
        .map((submission) => submission.timelineLogId),
      ...(project.evidenceSearches || [])
        .filter((record) => String(record.taskId || '') === String(task.id || ''))
        .map((record) => record.timelineLogId),
      ...(project.submissionReviews || [])
        .filter((review) => String(review.taskId || '') === String(task.id || ''))
        .map((review) => review.timelineLogId),
    ]),
    submissionIds: uniqueStrings([
      ...(task.submissionIds || []),
      ...(project.agentSubmissions || [])
        .filter((submission) => String(submission.taskId || '') === String(task.id || ''))
        .map((submission) => submission.id),
    ]),
    evidenceSearchIds: uniqueStrings([
      ...(task.evidenceSearchIds || []),
      ...(project.evidenceSearches || [])
        .filter((record) => String(record.taskId || '') === String(task.id || ''))
        .map((record) => record.id),
    ]),
    reviewIds: uniqueStrings([
      ...(task.reviewIds || []),
      ...(project.submissionReviews || [])
        .filter((review) => String(review.taskId || '') === String(task.id || ''))
        .map((review) => review.id),
    ]),
    hasAssignment: Boolean(task.assignmentMessageId || task.requestMessageId),
    hasAcknowledgement: Boolean(task.acknowledgementMessageId || task.confirmationMessageId),
    hasOwnerSync: Boolean(task.syncMessageId),
    timelineCount: uniqueStrings([
      ...(task.timelineLogIds || []),
      ...(project.agentSubmissions || [])
        .filter((submission) => String(submission.taskId || '') === String(task.id || ''))
        .map((submission) => submission.timelineLogId),
      ...(project.evidenceSearches || [])
        .filter((record) => String(record.taskId || '') === String(task.id || ''))
        .map((record) => record.timelineLogId),
      ...(project.submissionReviews || [])
        .filter((review) => String(review.taskId || '') === String(task.id || ''))
        .map((review) => review.timelineLogId),
    ]).length,
  });
  const submissionRows = (project.agentSubmissions || []).slice(0, 40).map((submission) => ({
    ...submission,
    agentName: submission.agentName || agentNameById[submission.agentId] || submission.agentId,
    reviewerName: submission.requestedReviewAgentName || agentNameById[submission.requestedReviewAgentId] || submission.requestedReviewAgentId || null,
    proofRoute: projectId ? `/projects/${projectId}/submissions/${submission.id}` : null,
    transcriptRoute: projectId ? `/projects/${projectId}/transcripts/${submission.channelId || 'main'}` : null,
    timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
    eventRoute: projectId ? `/projects/${projectId}/events` : null,
    taskEvidenceRoute: projectId && submission.taskId ? `/projects/${projectId}/tasks/${submission.taskId}/evidence` : null,
  }));
  const evidenceSearchRows = (project.evidenceSearches || []).slice(0, 40).map((record) => ({
    ...record,
    agentName: record.agentName || agentNameById[record.agentId] || record.agentId,
    proofRoute: projectId ? `/projects/${projectId}/evidence-searches/${record.id}` : null,
    transcriptRoute: projectId ? `/projects/${projectId}/transcripts/${record.channelId || 'main'}` : null,
    timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
    eventRoute: projectId ? `/projects/${projectId}/events` : null,
    taskEvidenceRoute: projectId && record.taskId ? `/projects/${projectId}/tasks/${record.taskId}/evidence` : null,
  }));
  const submissionReviewRows = (project.submissionReviews || []).slice(0, 40).map((review) => ({
    ...review,
    reviewerAgentName: review.reviewerAgentName || agentNameById[review.reviewerAgentId] || review.reviewerAgentId,
    submitterAgentName: review.submitterAgentName || agentNameById[review.submitterAgentId] || review.submitterAgentId,
    proofRoute: projectId ? `/projects/${projectId}/submission-reviews/${review.id}` : null,
    submissionRoute: projectId ? `/projects/${projectId}/submissions/${review.submissionId}` : null,
    transcriptRoute: projectId ? `/projects/${projectId}/transcripts/${review.channelId || 'main'}` : null,
    timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
    eventRoute: projectId ? `/projects/${projectId}/events` : null,
    taskEvidenceRoute: projectId && review.taskId ? `/projects/${projectId}/tasks/${review.taskId}/evidence` : null,
  }));
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
    launchApprovalWorkflow: buildLaunchApprovalWorkflowSnapshot({ project }),
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
    submissions: {
      count: submissionRows.length,
      pendingReviewCount: submissionRows.filter((row) => row.reviewStatus === 'pending-review').length,
      acceptedCount: submissionRows.filter((row) => row.reviewStatus === 'accepted' || row.status === 'accepted').length,
      changesRequestedCount: submissionRows.filter((row) => row.reviewStatus === 'changes-requested').length,
      revisionCount: submissionRows.filter((row) => row.revisesSubmissionId || row.respondsToReviewId || (row.supersedesSubmissionIds || []).length).length,
      supersededCount: submissionRows.filter((row) => row.status === 'superseded').length,
      finalDeliverableCount: submissionRows.filter((row) => row.artifactType === 'final-deliverable' || row.status === 'final').length,
      artifactTypes: uniqueStrings(submissionRows.map((row) => row.artifactType)),
      rows: submissionRows,
    },
    evidenceSearches: {
      count: evidenceSearchRows.length,
      completedCount: evidenceSearchRows.filter((row) => row.status === 'completed').length,
      sourceCount: evidenceSearchRows.reduce((sum, row) => sum + (row.sources?.length || 0), 0),
      highConfidenceCount: evidenceSearchRows.filter((row) => row.confidence === 'high').length,
      averageQualityScore: evidenceSearchRows.length
        ? Math.round(evidenceSearchRows.reduce((sum, row) => sum + (Number(row.qualityScore ?? row.qualitySummary?.averageScore) || 0), 0) / evidenceSearchRows.length)
        : 0,
      strongEvidenceCount: evidenceSearchRows.filter((row) => row.evidenceJudgement === 'strong-evidence' || row.qualitySummary?.judgement === 'strong-evidence').length,
      usableEvidenceCount: evidenceSearchRows.filter((row) => ['strong-evidence', 'usable-evidence'].includes(row.evidenceJudgement || row.qualitySummary?.judgement)).length,
      needsCorroborationCount: evidenceSearchRows.filter((row) => row.evidenceJudgement === 'needs-corroboration' || row.qualitySummary?.judgement === 'needs-corroboration').length,
      providers: uniqueStrings(evidenceSearchRows.map((row) => row.provider)),
      sourceSafetyReadyCount: evidenceSearchRows.filter((row) => (row.sourceSafetySummary || summarizeEvidenceSourceSafety(row.sources || [])).sourceSafetyReady).length,
      sourceSafetyBlockedSourceCount: evidenceSearchRows.reduce((sum, row) => sum + ((row.sourceSafetySummary || summarizeEvidenceSourceSafety(row.sources || [])).blockedSourceCount || 0), 0),
      sourceSafetyReviewSourceCount: evidenceSearchRows.reduce((sum, row) => sum + ((row.sourceSafetySummary || summarizeEvidenceSourceSafety(row.sources || [])).reviewSourceCount || 0), 0),
      rows: evidenceSearchRows,
    },
    submissionReviews: {
      count: submissionReviewRows.length,
      acceptedCount: submissionReviewRows.filter((row) => row.verdict === 'accepted').length,
      changesRequestedCount: submissionReviewRows.filter((row) => row.verdict === 'changes-requested').length,
      underReviewCount: submissionReviewRows.filter((row) => row.verdict === 'under-review').length,
      rows: submissionReviewRows,
    },
    securityAccessAudit,
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
      projectEvidenceArchive: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
      projectEvidenceExports: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
      managerReadyPackage: projectId ? `/projects/${projectId}/manager-ready-package` : null,
      pilotLaunchReadiness: projectId ? `/projects/${projectId}/pilot-launch-readiness` : null,
      deploymentPreflight: projectId ? `/projects/${projectId}/deployment-preflight` : null,
      adapterGatewayPreflight: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
      productionLaunchAudit: projectId ? `/projects/${projectId}/production-launch-audit` : null,
      launchApprovals: projectId ? `/projects/${projectId}/launch-approvals` : null,
      mvpReadiness: projectId ? `/projects/${projectId}/mvp-readiness` : null,
      persistenceSnapshot: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      persistenceAdapterPlan: projectId ? `/projects/${projectId}/persistence-adapter-plan` : null,
      persistenceAdapterDryRun: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
      workerQueue: projectId ? `/projects/${projectId}/worker-queue` : null,
      workerQueueAdapterPlan: projectId ? `/projects/${projectId}/worker-queue-adapter-plan` : null,
      workerQueueAdapterDryRun: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
      operationsReadiness: projectId ? `/projects/${projectId}/operations-readiness` : null,
      providerReadiness: projectId ? `/projects/${projectId}/provider-readiness` : null,
      securityBoundary: projectId ? `/projects/${projectId}/security-boundary` : null,
      securityAccessAudit: projectId ? `/projects/${projectId}/security-access-audit` : null,
      securityAuditStream: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      identitySessions: projectId ? `/projects/${projectId}/identity-sessions` : null,
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
      submissions: projectId ? `/projects/${projectId}/submissions` : null,
      evidenceSearches: projectId ? `/projects/${projectId}/evidence-searches` : null,
      submissionReviews: projectId ? `/projects/${projectId}/submission-reviews` : null,
    },
  };
}

function idsFromRoutes(routes = [], field = 'proofIds') {
  return uniqueStrings((routes || []).flatMap((route) => route?.[field] || [])).slice(0, 12);
}

function buildMvpReadiness({ managerDashboard = {}, managerFlowGraph = {} } = {}) {
  const projectId = managerDashboard.project?.id || managerDashboard.projectId || null;
  const proofMap = managerDashboard.readinessProofMap || {};
  const submissions = managerDashboard.submissions || {};
  const evidenceSearches = managerDashboard.evidenceSearches || {};
  const reviews = managerDashboard.submissionReviews || {};
  const artifactTypes = new Set(submissions.artifactTypes || []);
  const graphSummary = managerFlowGraph.summary || {};
  const selfMarketingSummary = proofMap.selfMarketingSummary || {};
  const roleNegotiationSummary = proofMap.roleNegotiationSummary || {};
  const revisionSummary = proofMap.revisionSummary || {};
  const evidenceSummary = proofMap.evidenceSearchSummary || {};
  const transcriptChannels = managerDashboard.transcriptIndex?.channels || [];
  const latestProjectCycle = managerDashboard.operationsBoard?.latestProjectCycle || null;
  const latestSchedulerRecord = managerDashboard.operationsBoard?.latestSchedulerRecord || null;
  const continuousLoop = managerDashboard.continuousWorkLoop || {};
  const agentStates = managerDashboard.agents?.states || [];

  const row = ({
    id,
    label,
    passed,
    detail,
    apiPath = null,
    proofIds = [],
    timelineLogIds = [],
    eventIds = [],
    phase = 'core-loop',
    owner = 'product-team-runtime',
    severity = 'blocker',
  }) => ({
    id,
    label,
    phase,
    owner,
    severity,
    passed: Boolean(passed),
    status: passed ? 'passed' : 'missing',
    detail,
    apiPath,
    proofIds: uniqueStrings(proofIds).slice(0, 12),
    timelineLogIds: uniqueStrings(timelineLogIds).slice(0, 12),
    eventIds: uniqueStrings(eventIds).slice(0, 12),
  });

  const rows = [
    row({
      id: 'kickoff-governance',
      label: 'Kickoff governance is durable',
      passed: Boolean(managerDashboard.kickoffMeetingFlow?.leaderMarkerPersisted && managerDashboard.kickoffExecutionFlow?.nextActions?.length),
      detail: `${managerDashboard.kickoffMeetingFlow?.confirmedLeaderName || 'Leader pending'} / ${managerDashboard.kickoffExecutionFlow?.nextActions?.length || 0} first action(s)`,
      apiPath: managerDashboard.backendRoutes?.readinessProofMap || null,
      proofIds: idsFromRoutes(proofMap.roleNegotiationRoutes, 'proofIds'),
      timelineLogIds: managerDashboard.kickoffExecutionFlow?.firstPulse?.timelineLogIds || [],
    }),
    row({
      id: 'self-marketing-role-negotiation',
      label: 'Agents self-market and negotiate roles',
      passed: Boolean(
        (selfMarketingSummary.selfNominationCount || 0) > 0
        && (selfMarketingSummary.leaderCampaignCount || 0) > 0
        && (roleNegotiationSummary.roleClarificationCount || 0) > 0
      ),
      detail: `${selfMarketingSummary.selfNominationCount || 0} self nomination(s), ${selfMarketingSummary.leaderCampaignCount || 0} leader campaign(s), ${roleNegotiationSummary.roleClarificationCount || 0} role clarification(s)`,
      apiPath: managerDashboard.backendRoutes?.readinessProofMap || null,
      proofIds: idsFromRoutes(proofMap.selfMarketingRoutes, 'proofIds'),
      eventIds: idsFromRoutes(proofMap.selfMarketingRoutes, 'eventIds'),
    }),
    row({
      id: 'brainstorm-submission',
      label: 'Brainstorm node submitted',
      passed: artifactTypes.has('brainstorm-board'),
      detail: `${submissions.count || 0} submission(s); types: ${(submissions.artifactTypes || []).join(', ') || 'none'}`,
      apiPath: managerDashboard.backendRoutes?.submissions || null,
      proofIds: idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'brainstorm-board'), 'proofIds'),
      timelineLogIds: idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'brainstorm-board'), 'timelineLogIds'),
      eventIds: idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'brainstorm-board'), 'eventIds'),
    }),
    row({
      id: 'evidence-search-quality',
      label: 'Evidence search has quality judgement',
      passed: Boolean((evidenceSearches.usableEvidenceCount || 0) > 0 && (evidenceSummary.averageQualityScore || evidenceSearches.averageQualityScore || 0) >= 60),
      detail: `${evidenceSearches.count || 0} search(es), ${evidenceSearches.sourceCount || 0} source(s), quality ${evidenceSummary.averageQualityScore || evidenceSearches.averageQualityScore || 0}`,
      apiPath: managerDashboard.backendRoutes?.evidenceSearches || null,
      proofIds: idsFromRoutes(proofMap.evidenceSearchRoutes, 'proofIds'),
      timelineLogIds: idsFromRoutes(proofMap.evidenceSearchRoutes, 'timelineLogIds'),
      eventIds: idsFromRoutes(proofMap.evidenceSearchRoutes, 'eventIds'),
    }),
    row({
      id: 'draft-review-revision',
      label: 'Draft, review, and revision loop closed',
      passed: Boolean(
        artifactTypes.has('product-brief')
        && (reviews.changesRequestedCount || 0) > 0
        && (submissions.revisionCount || revisionSummary.count || 0) > 0
        && (submissions.supersededCount || 0) > 0
      ),
      detail: `${reviews.changesRequestedCount || 0} change request(s), ${submissions.revisionCount || revisionSummary.count || 0} revision(s), ${submissions.supersededCount || 0} superseded`,
      apiPath: managerDashboard.backendRoutes?.submissionReviews || null,
      proofIds: [
        ...idsFromRoutes(proofMap.submissionReviewRoutes, 'proofIds'),
        ...idsFromRoutes(proofMap.revisionRoutes, 'proofIds'),
      ],
      timelineLogIds: idsFromRoutes(proofMap.revisionRoutes, 'timelineLogIds'),
      eventIds: idsFromRoutes(proofMap.revisionRoutes, 'eventIds'),
    }),
    row({
      id: 'final-deliverable-accepted',
      label: 'Final deliverable accepted',
      passed: Boolean((submissions.finalDeliverableCount || 0) > 0 && (reviews.acceptedCount || 0) > 0),
      detail: `${submissions.finalDeliverableCount || 0} final deliverable(s), ${reviews.acceptedCount || 0} accepted review(s)`,
      apiPath: managerDashboard.backendRoutes?.submissions || null,
      proofIds: [
        ...idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'final-deliverable'), 'proofIds'),
        ...idsFromRoutes((proofMap.submissionReviewRoutes || []).filter((route) => route.verdict === 'accepted'), 'proofIds'),
      ],
      timelineLogIds: idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'final-deliverable'), 'timelineLogIds'),
      eventIds: idsFromRoutes((proofMap.submissionRoutes || []).filter((route) => route.artifactType === 'final-deliverable'), 'eventIds'),
    }),
    row({
      id: 'proof-surfaces-linked',
      label: 'Proof surfaces are linked',
      passed: Boolean(
        (proofMap.routes?.length || 0) > 0
        && (graphSummary.proofedNodeCount || 0) > 0
        && transcriptChannels.some((channel) => (channel.messageCount || 0) > 0)
        && (managerDashboard.timeline?.eventLedgerSummary?.retainedCount || managerDashboard.timeline?.latestEventLedgerEvents?.length || 0) > 0
      ),
      detail: `${proofMap.routes?.length || 0} proof route(s), ${graphSummary.proofedNodeCount || 0} proofed graph node(s), ${transcriptChannels.length} transcript channel(s)`,
      apiPath: managerDashboard.backendRoutes?.managerFlowGraph || null,
      proofIds: idsFromRoutes(proofMap.routes, 'proofIds'),
      timelineLogIds: idsFromRoutes(proofMap.routes, 'timelineLogIds'),
      eventIds: idsFromRoutes(proofMap.routes, 'eventIds'),
    }),
    row({
      id: 'backend-worker-loop',
      label: 'Backend worker loop has runtime proof',
      passed: Boolean(latestProjectCycle || latestSchedulerRecord || (continuousLoop.proofedAgentCount || 0) > 0),
      detail: `${latestProjectCycle?.trigger || latestSchedulerRecord?.trigger || continuousLoop.schedulerState || 'no runtime proof'} / ${continuousLoop.proofedAgentCount || 0} proofed Agent loop(s)`,
      apiPath: projectId ? `/projects/${projectId}/autonomous-cycle` : null,
      proofIds: continuousLoop.rows?.flatMap((item) => item.chatIds || item.proofIds || []) || [],
      timelineLogIds: [
        ...(latestProjectCycle?.timelineLogIds || []),
        ...(latestProjectCycle?.logId ? [latestProjectCycle.logId] : []),
        ...(continuousLoop.rows || []).flatMap((item) => item.timelineLogIds || []),
      ],
      eventIds: latestProjectCycle?.eventIds || latestSchedulerRecord?.eventIds || [],
    }),
    row({
      id: 'agent-dashboards-addressable',
      label: 'Agent dashboards are addressable',
      passed: Boolean(agentStates.length > 0 && agentStates.length >= (managerDashboard.project?.teamCount || 0)),
      detail: `${agentStates.length}/${managerDashboard.project?.teamCount || 0} Agent state surface(s)`,
      apiPath: managerDashboard.backendRoutes?.agentDashboardTemplate || null,
      proofIds: agentStates.flatMap((agent) => agent.proofIds || agent.latestWorker?.messageIds || []),
      timelineLogIds: agentStates.flatMap((agent) => agent.timelineLogIds || agent.latestWorker?.timelineLogIds || []),
    }),
  ];

  const passedCount = rows.filter((item) => item.passed).length;
  const blockerRows = rows.filter((item) => !item.passed);
  const productionBlockers = [
    {
      id: 'production-secret-vault-rbac',
      label: 'Secret vault, authentication, and role-based access control',
      status: 'blocked',
      severity: 'production-blocker',
      detail: 'Prototype redaction, enforceable access decisions, and optional signed access headers exist, but production still needs encrypted secret storage, authenticated users, issued/rotated runtime credentials, and database-backed project permissions.',
      owner: 'security-platform',
      apiPath: managerDashboard.backendRoutes?.securityBoundary || (projectId ? `/projects/${projectId}/security-boundary` : null),
      progress: 'security-boundary-and-access-policy-exported',
    },
    {
      id: 'production-managed-persistence',
      label: 'Managed database and append-only event storage',
      status: 'blocked',
      severity: 'production-blocker',
      detail: 'The local file store and managed adapter dry-run prove the contract; production still needs a real database adapter, backup/restore drills, shadow reads, and cutover approval.',
      owner: 'backend-platform',
      apiPath: managerDashboard.backendRoutes?.persistenceAdapterDryRun || (projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null),
      progress: 'persistence-adapter-dry-run-exported',
    },
    {
      id: 'production-queue-cron',
      label: 'Production queue or cron scheduler',
      status: 'blocked',
      severity: 'production-blocker',
      detail: 'The Node HTTP scheduler and local adapter dry-run prove project and Agent workers; production should replace the interval runner with queue/cron infrastructure, durable leases, managed dead-letter storage, and recovery drills.',
      owner: 'runtime-platform',
      apiPath: managerDashboard.backendRoutes?.workerQueueAdapterDryRun || (projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : '/workers/queue-snapshot'),
      progress: 'queue-adapter-dry-run-exported',
    },
    {
      id: 'production-real-providers',
      label: 'Real LLM and search provider rollout',
      status: 'blocked',
      severity: 'production-blocker',
      detail: 'The deterministic provider validates the protocol; production needs configured provider allowlists, budget controls, rate limits, and failure handling.',
      owner: 'ai-platform',
      apiPath: managerDashboard.backendRoutes?.providerReadiness || (projectId ? `/projects/${projectId}/provider-readiness` : null),
      progress: 'provider-readiness-contract-exported',
    },
    {
      id: 'production-observability-recovery',
      label: 'Observability, recovery, and incident controls',
      status: 'blocked',
      severity: 'production-blocker',
      detail: 'The operations readiness contract now exposes local logs, metrics, alerts, replay routes, and recovery steps; production still needs centralized observability, incident ownership, and restore drills.',
      owner: 'operations',
      apiPath: managerDashboard.backendRoutes?.operationsReadiness || (projectId ? `/projects/${projectId}/operations-readiness` : null),
      progress: 'operations-readiness-contract-exported',
    },
  ];
  const nextCoreGap = blockerRows[0] || null;
  const nextProductionGap = productionBlockers[0] || null;

  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'product-team-mvp-readiness/v1',
    status: blockerRows.length ? 'needs-core-work' : 'mvp-local-candidate',
    readyForLocalPilot: blockerRows.length === 0,
    readyForProduction: false,
    localPilot: {
      status: blockerRows.length ? 'blocked' : 'ready',
      passedCount,
      totalCount: rows.length,
      blockerCount: blockerRows.length,
      nextGapId: nextCoreGap?.id || null,
    },
    production: {
      status: 'production-blocked',
      blockerCount: productionBlockers.length,
      nextGapId: nextProductionGap?.id || null,
      rows: productionBlockers,
    },
    rows,
    blockerRows,
    nextShortestPath: nextCoreGap ? {
      scope: 'mvp-core',
      id: nextCoreGap.id,
      label: nextCoreGap.label,
      detail: nextCoreGap.detail,
      apiPath: nextCoreGap.apiPath || null,
    } : {
      scope: 'production-hardening',
      id: nextProductionGap?.id || null,
      label: nextProductionGap?.label || 'Production hardening',
      detail: nextProductionGap?.detail || 'Core acceptance is covered; production hardening remains.',
    },
    summary: {
      corePassedCount: passedCount,
      coreTotalCount: rows.length,
      coreBlockerCount: blockerRows.length,
      productionBlockerCount: productionBlockers.length,
      proofRouteCount: proofMap.routes?.length || 0,
      flowGraphProofedNodeCount: graphSummary.proofedNodeCount || 0,
      submissionCount: submissions.count || 0,
      evidenceSearchCount: evidenceSearches.count || 0,
      reviewCount: reviews.count || 0,
      finalDeliverableCount: submissions.finalDeliverableCount || 0,
      schedulerProofedAgentCount: continuousLoop.proofedAgentCount || 0,
    },
  };
}

function buildPilotLaunchReadinessSnapshot({
  project = {},
  managerDashboard = {},
  managerFlowGraph = {},
  mvpReadiness = {},
  securityBoundary = {},
  providerReadiness = {},
  operationsReadiness = {},
  persistenceSnapshot = {},
  persistenceAdapterPlan = {},
  persistenceAdapterDryRun = {},
  workerQueueSnapshot = {},
  workerQueueAdapterPlan = {},
  workerQueueAdapterDryRun = {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || managerDashboard.projectId || mvpReadiness.projectId || null;
  const route = (key, fallback = null) => managerDashboard.backendRoutes?.[key] || fallback;
  const summary = {
    proofRouteCount: managerDashboard.readinessProofMap?.routes?.length || 0,
    flowGraphProofedNodeCount: managerFlowGraph.summary?.proofedNodeCount || 0,
    transcriptChannelCount: managerDashboard.transcriptIndex?.channels?.length || 0,
    eventLedgerCount: project.eventLedger?.length || 0,
    submissionCount: managerDashboard.submissions?.count || 0,
    evidenceSearchCount: managerDashboard.evidenceSearches?.count || 0,
    reviewCount: managerDashboard.submissionReviews?.count || 0,
    workerExecutionReceiptCount: operationsReadiness.summary?.workerExecutionReceiptCount || 0,
    securityRawLeakCount: securityBoundary.summary?.rawLeakCount ?? securityBoundary.redactionScan?.rawLeakCount ?? 0,
    providerFailedGateCount: providerReadiness.summary?.failedGateCount || 0,
    operationsFailedGateCount: operationsReadiness.summary?.failedGateCount || 0,
    persistenceAdapterFailedGateCount: persistenceAdapterDryRun.summary?.failedGateCount || 0,
    queueAdapterFailedGateCount: workerQueueAdapterDryRun.summary?.failedGateCount || 0,
    productionBlockerCount: mvpReadiness.production?.blockerCount || mvpReadiness.summary?.productionBlockerCount || 0,
  };
  const gates = [
    {
      id: 'core-product-team-loop',
      label: 'Generic product-team loop is locally complete',
      passed: Boolean(mvpReadiness.readyForLocalPilot && (mvpReadiness.summary?.coreBlockerCount || 0) === 0),
      detail: `${mvpReadiness.summary?.corePassedCount || 0}/${mvpReadiness.summary?.coreTotalCount || 0} core readiness gate(s) passed.`,
      apiPath: route('mvpReadiness', projectId ? `/projects/${projectId}/mvp-readiness` : null),
    },
    {
      id: 'proof-surfaces-addressable',
      label: 'Manager proof surfaces are addressable',
      passed: Boolean(summary.proofRouteCount >= 8 && summary.flowGraphProofedNodeCount > 0 && summary.transcriptChannelCount > 0 && summary.eventLedgerCount > 0),
      detail: `${summary.proofRouteCount} proof route(s), ${summary.flowGraphProofedNodeCount} proofed flow node(s), ${summary.transcriptChannelCount} transcript channel(s), ${summary.eventLedgerCount} event(s).`,
      apiPath: route('readinessProofMap', projectId ? `/projects/${projectId}/readiness-proof-map` : null),
    },
    {
      id: 'artifact-workflow-complete',
      label: 'Submissions, evidence, reviews, revisions, and final deliverable are visible',
      passed: Boolean(
        summary.submissionCount > 0
        && summary.evidenceSearchCount > 0
        && summary.reviewCount > 0
        && (managerDashboard.submissions?.finalDeliverableCount || 0) > 0
      ),
      detail: `${summary.submissionCount} submission(s), ${summary.evidenceSearchCount} evidence search(es), ${summary.reviewCount} review(s), ${managerDashboard.submissions?.finalDeliverableCount || 0} final deliverable(s).`,
      apiPath: route('submissions', projectId ? `/projects/${projectId}/submissions` : null),
    },
    {
      id: 'security-boundary-local-control',
      label: 'Local security boundary is clean and enforceable',
      passed: Boolean(
        securityBoundary.schemaVersion === 'security-boundary/v1'
        && securityBoundary.status === 'local-boundary-ready'
        && summary.securityRawLeakCount === 0
        && securityBoundary.summary?.secretVaultRotationReady
      ),
      detail: `${summary.securityRawLeakCount} raw leak(s); secret vault rotation ${securityBoundary.summary?.secretVaultRotationReady ? 'ready' : 'blocked'}.`,
      apiPath: route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null),
    },
    {
      id: 'provider-local-control',
      label: 'Provider policy, source safety, and usage ledger are locally controlled',
      passed: Boolean(
        providerReadiness.schemaVersion === 'provider-readiness/v1'
        && providerReadiness.status === 'local-provider-contract-ready'
        && summary.providerFailedGateCount === 0
      ),
      detail: `${summary.providerFailedGateCount} provider gate failure(s), ${providerReadiness.summary?.providerBackedSearchCount || 0} provider-backed search(es).`,
      apiPath: route('providerReadiness', projectId ? `/projects/${projectId}/provider-readiness` : null),
    },
    {
      id: 'persistence-local-control',
      label: 'Persistence adapter dry-run is ready while production cutover stays blocked',
      passed: Boolean(
        persistenceSnapshot.schemaVersion === 'production-persistence-snapshot/v1'
        && persistenceSnapshot.integrity?.status === 'ready'
        && persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot'
        && persistenceAdapterDryRun.status === 'passed'
        && persistenceAdapterDryRun.summary?.adapterProductionCutoverReady === false
      ),
      detail: `${persistenceSnapshot.totalRecordCount || 0} record(s), adapter ${persistenceAdapterDryRun.status || 'unknown'}, production cutover ${persistenceAdapterDryRun.summary?.adapterProductionCutoverReady ? 'ready' : 'blocked'}.`,
      apiPath: route('persistenceAdapterDryRun', projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null),
    },
    {
      id: 'queue-local-control',
      label: 'Queue adapter dry-run is ready while production cutover stays blocked',
      passed: Boolean(
        workerQueueSnapshot.schemaVersion === 'worker-queue-snapshot/v1'
        && workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot'
        && workerQueueAdapterDryRun.status === 'passed'
        && workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady === false
      ),
      detail: `${workerQueueAdapterDryRun.summary?.dispatchCount || 0} dispatch(es), ${workerQueueAdapterDryRun.summary?.leaseAcquisitionCount || 0} lease(s), production cutover ${workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady ? 'ready' : 'blocked'}.`,
      apiPath: route('workerQueueAdapterDryRun', projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null),
    },
    {
      id: 'operations-incident-drill-local-control',
      label: 'Operations readiness and incident drill pass locally',
      passed: Boolean(
        operationsReadiness.schemaVersion === 'operations-readiness/v1'
        && operationsReadiness.readyForLocalPilot
        && operationsReadiness.summary?.incidentDrillReady
      ),
      detail: `${operationsReadiness.summary?.passedGateCount || 0}/${operationsReadiness.summary?.gateCount || 0} operations gate(s), ${operationsReadiness.summary?.incidentDrillReceiptCount || 0} incident drill receipt(s).`,
      apiPath: route('operationsReadiness', projectId ? `/projects/${projectId}/operations-readiness` : null),
    },
    {
      id: 'production-overclaim-blocked',
      label: 'Production launch remains explicitly blocked',
      passed: Boolean(
        mvpReadiness.readyForProduction === false
        && securityBoundary.readyForProduction === false
        && providerReadiness.readyForProduction === false
        && operationsReadiness.readyForProduction === false
        && persistenceAdapterDryRun.summary?.adapterProductionCutoverReady === false
        && workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady === false
      ),
      detail: `${summary.productionBlockerCount} production blocker(s) remain visible; private pilot is evaluated separately from production.`,
      apiPath: route('mvpReadiness', projectId ? `/projects/${projectId}/mvp-readiness` : null),
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  const productionBlockers = [
    ...(mvpReadiness.production?.rows || []),
    ...(securityBoundary.production?.rows || []).map((row) => ({
      ...row,
      source: 'security-boundary',
      apiPath: row.apiPath || route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null),
    })),
    ...(providerReadiness.requiredProductionControls || []).filter((row) => row.status === 'blocked').map((row) => ({
      ...row,
      source: 'provider-readiness',
      apiPath: row.apiPath || route('providerReadiness', projectId ? `/projects/${projectId}/provider-readiness` : null),
    })),
    ...(operationsReadiness.productionGaps || []).map((detail, index) => ({
      id: `operations-production-gap-${index + 1}`,
      label: 'Operations production hardening',
      status: 'blocked',
      severity: 'production-blocker',
      detail,
      source: 'operations-readiness',
      apiPath: route('operationsReadiness', projectId ? `/projects/${projectId}/operations-readiness` : null),
    })),
  ];
  const uniqueProductionBlockers = [];
  const seenBlockerIds = new Set();
  productionBlockers.forEach((blocker) => {
    const id = blocker.id || `${blocker.source || 'production'}-${blocker.label || blocker.detail}`;
    if (seenBlockerIds.has(id)) return;
    seenBlockerIds.add(id);
    uniqueProductionBlockers.push({ ...blocker, id });
  });
  const evidenceRoutes = [
    { id: 'manager-ready-package', route: route('managerReadyPackage', projectId ? `/projects/${projectId}/manager-ready-package` : null), ready: true },
    { id: 'project-evidence-archive', route: route('projectEvidenceArchive', projectId ? `/projects/${projectId}/project-evidence-archive` : null), ready: Boolean(mvpReadiness.readyForLocalPilot) },
    { id: 'project-evidence-exports', route: route('projectEvidenceExports', projectId ? `/projects/${projectId}/project-evidence-exports` : null), ready: true },
    { id: 'mvp-readiness', route: route('mvpReadiness', projectId ? `/projects/${projectId}/mvp-readiness` : null), ready: Boolean(mvpReadiness.schemaVersion) },
    { id: 'readiness-proof-map', route: route('readinessProofMap', projectId ? `/projects/${projectId}/readiness-proof-map` : null), ready: summary.proofRouteCount > 0 },
    { id: 'manager-flow-graph', route: route('managerFlowGraph', projectId ? `/projects/${projectId}/manager-flow-graph` : null), ready: summary.flowGraphProofedNodeCount > 0 },
    { id: 'security-boundary', route: route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null), ready: securityBoundary.status === 'local-boundary-ready' },
    { id: 'provider-readiness', route: route('providerReadiness', projectId ? `/projects/${projectId}/provider-readiness` : null), ready: providerReadiness.status === 'local-provider-contract-ready' },
    { id: 'operations-readiness', route: route('operationsReadiness', projectId ? `/projects/${projectId}/operations-readiness` : null), ready: operationsReadiness.readyForLocalPilot },
    { id: 'persistence-adapter-dry-run', route: route('persistenceAdapterDryRun', projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null), ready: persistenceAdapterDryRun.status === 'passed' },
    { id: 'worker-queue-adapter-dry-run', route: route('workerQueueAdapterDryRun', projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null), ready: workerQueueAdapterDryRun.status === 'passed' },
    { id: 'security-audit-stream', route: route('securityAuditStream', projectId ? `/projects/${projectId}/security-audit-stream` : null), ready: operationsReadiness.observability?.metrics?.securityAuditStreamHashChainReady === true },
  ];
  const privatePilotReady = failedGates.length === 0;
  const launchPacketChecksum = persistenceChecksum({
    projectId,
    gateIds: gates.map((gate) => [gate.id, gate.passed]),
    productionBlockerIds: uniqueProductionBlockers.map((blocker) => blocker.id),
    evidenceRouteIds: evidenceRoutes.map((row) => [row.id, row.ready]),
  });

  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'pilot-launch-readiness/v1',
    status: privatePilotReady ? 'private-pilot-go-production-blocked' : 'private-pilot-blocked',
    privatePilotDecision: privatePilotReady ? 'go' : 'no-go',
    productionDecision: 'no-go',
    readyForPrivatePilot: privatePilotReady,
    readyForProduction: false,
    gates,
    failedGates,
    evidenceRoutes,
    productionBlockers: uniqueProductionBlockers,
    nextShortestPath: failedGates[0] ? {
      scope: 'private-pilot',
      id: failedGates[0].id,
      label: failedGates[0].label,
      detail: failedGates[0].detail,
      apiPath: failedGates[0].apiPath || null,
    } : {
      scope: 'production-hardening',
      id: uniqueProductionBlockers[0]?.id || null,
      label: uniqueProductionBlockers[0]?.label || 'Production hardening',
      detail: uniqueProductionBlockers[0]?.detail || 'Private pilot evidence is complete; production hardening remains blocked.',
      apiPath: uniqueProductionBlockers[0]?.apiPath || null,
    },
    summary: {
      ...summary,
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: failedGates.length,
      evidenceRouteCount: evidenceRoutes.length,
      readyEvidenceRouteCount: evidenceRoutes.filter((row) => row.ready).length,
      productionBlockerCount: uniqueProductionBlockers.length,
      privatePilotReady,
      productionReady: false,
      launchPacketChecksum,
    },
    checksum: launchPacketChecksum,
  };
}

function envFlag(env = {}, key = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(env[key] || '').trim().toLowerCase());
}

function envNumber(env = {}, key = '', fallback = 0) {
  const value = Number(env[key]);
  return Number.isFinite(value) ? value : fallback;
}

function buildDeploymentPreflightSnapshot({
  project = {},
  managerDashboard = {},
  pilotLaunchReadiness = {},
  mvpReadiness = {},
  securityBoundary = {},
  providerReadiness = {},
  operationsReadiness = {},
  persistenceAdapterDryRun = {},
  workerQueueAdapterDryRun = {},
  adapterGatewayPreflight = {},
  modelProviderStatus = {},
  searchProviderStatus = {},
  secretVaultStatus = {},
  providerControlPolicy = {},
  managedPersistenceStatus = {},
  workerQueueStatus = {},
  store = {},
  env = globalThis.process?.env || {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || managerDashboard.projectId || pilotLaunchReadiness.projectId || null;
  const route = (key, fallback = null) => managerDashboard.backendRoutes?.[key] || fallback;
  const schedulerEnabled = envFlag(env, 'AGENT_AUTONOMOUS_SCHEDULER');
  const schedulerIntervalMs = envNumber(env, 'AGENT_AUTONOMOUS_INTERVAL_MS', 60_000);
  const accessMode = String(env.AGENT_ACCESS_CONTROL_MODE || 'prototype-open').trim() || 'prototype-open';
  const signingSecretConfigured = Boolean(env.AGENT_ACCESS_SIGNING_SECRET);
  const replayProtectionEnabled = envFlag(env, 'AGENT_ACCESS_REPLAY_PROTECTION');
  const auditFailClosedEnabled = envFlag(env, 'AGENT_ACCESS_AUDIT_FAIL_CLOSED');
  const gatewayEndpointConfigured = Boolean(env.ADAPTER_GATEWAY_HTTP_ENDPOINT || env.MANAGED_PERSISTENCE_HTTP_ENDPOINT || env.WORKER_QUEUE_HTTP_ENDPOINT);
  const gatewayAuthConfigured = Boolean(env.ADAPTER_GATEWAY_AUTH_TOKEN);
  const modelProviderSafe = redactSensitiveObject(modelProviderStatus || {});
  const searchProviderSafe = redactSensitiveObject(searchProviderStatus || {});
  const safeSecretVaultStatus = normalizeSecretVaultStatus(secretVaultStatus || {});
  const gates = [
    {
      id: 'launch-package-ready',
      label: 'Pilot launch package is available',
      severity: 'blocker',
      passed: Boolean(pilotLaunchReadiness.schemaVersion === 'pilot-launch-readiness/v1' && pilotLaunchReadiness.privatePilotDecision === 'go'),
      detail: `Launch decision ${pilotLaunchReadiness.privatePilotDecision || 'unknown'}, production ${pilotLaunchReadiness.productionDecision || 'unknown'}.`,
      apiPath: route('pilotLaunchReadiness', projectId ? `/projects/${projectId}/pilot-launch-readiness` : null),
    },
    {
      id: 'backend-store-configured',
      label: 'Backend store and audit sink are file-backed',
      severity: store.filePath ? 'info' : 'warning',
      passed: Boolean(store.filePath),
      detail: store.filePath
        ? `Project store ${store.filePath}; audit sink ${store.securityAuditLogPath || 'snapshot-only'}.`
        : 'Memory store is usable for tests, but private pilots should use AGENT_PROJECT_STORE and a file-backed audit sink.',
      apiPath: route('managerReadyPackage', projectId ? `/projects/${projectId}/manager-ready-package` : null),
    },
    {
      id: 'autonomous-scheduler-configured',
      label: 'Autonomous scheduler configuration is visible',
      severity: schedulerEnabled ? 'info' : 'warning',
      passed: schedulerIntervalMs > 0,
      detail: `AGENT_AUTONOMOUS_SCHEDULER=${schedulerEnabled ? 'true' : 'false'}, interval ${schedulerIntervalMs}ms.`,
      apiPath: '/workers/autonomous/status',
    },
    {
      id: 'access-control-hardening-configured',
      label: 'Access-control hardening is configured',
      severity: accessMode === 'enforced' && signingSecretConfigured && replayProtectionEnabled && auditFailClosedEnabled ? 'info' : 'warning',
      passed: Boolean(securityBoundary.status === 'local-boundary-ready' && securityBoundary.summary?.rawLeakCount === 0),
      detail: `mode=${accessMode}, signing=${signingSecretConfigured ? 'configured' : 'missing'}, replay=${replayProtectionEnabled ? 'on' : 'off'}, auditFailClosed=${auditFailClosedEnabled ? 'on' : 'off'}.`,
      apiPath: route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null),
    },
    {
      id: 'secret-vault-ready',
      label: 'Secret vault seal/open/rotation is ready',
      severity: 'blocker',
      passed: Boolean(safeSecretVaultStatus.ready && safeSecretVaultStatus.rotationSupported && safeSecretVaultStatus.latestRotation),
      detail: `${safeSecretVaultStatus.provider || 'vault'} ready=${safeSecretVaultStatus.ready ? 'yes' : 'no'}, records=${safeSecretVaultStatus.encryptedRecordCount || 0}, rotation=${safeSecretVaultStatus.latestRotation?.schemaVersion || 'missing'}.`,
      apiPath: route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null),
    },
    {
      id: 'provider-controls-ready',
      label: 'Provider status and control policy are ready',
      severity: 'blocker',
      passed: Boolean(providerReadiness.status === 'local-provider-contract-ready' && providerReadiness.summary?.failedGateCount === 0),
      detail: `model=${modelProviderSafe.provider || 'unknown'}:${modelProviderSafe.enabled ? 'enabled' : 'disabled'}, search=${searchProviderSafe.provider || 'unknown'}:${searchProviderSafe.enabled ? 'enabled' : 'disabled'}, policy=${providerControlPolicy.configured ? 'configured' : 'default'}.`,
      apiPath: route('providerReadiness', projectId ? `/projects/${projectId}/provider-readiness` : null),
    },
    {
      id: 'managed-persistence-preflight',
      label: 'Managed persistence adapter preflight passes',
      severity: 'blocker',
      passed: Boolean(persistenceAdapterDryRun.status === 'passed' && managedPersistenceStatus.configured),
      detail: `driver=${managedPersistenceStatus.driver || 'unknown'}, dryRun=${persistenceAdapterDryRun.status || 'unknown'}, productionCutover=${persistenceAdapterDryRun.summary?.adapterProductionCutoverReady ? 'ready' : 'blocked'}.`,
      apiPath: route('persistenceAdapterDryRun', projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null),
    },
    {
      id: 'worker-queue-preflight',
      label: 'Worker queue adapter preflight passes',
      severity: 'blocker',
      passed: Boolean(workerQueueAdapterDryRun.status === 'passed' && workerQueueStatus.configured),
      detail: `driver=${workerQueueStatus.driver || 'unknown'}, dryRun=${workerQueueAdapterDryRun.status || 'unknown'}, productionCutover=${workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady ? 'ready' : 'blocked'}.`,
      apiPath: route('workerQueueAdapterDryRun', projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null),
    },
    {
      id: 'adapter-gateway-preflight',
      label: 'Private adapter gateway preflight is explicit',
      severity: gatewayEndpointConfigured || (managedPersistenceStatus.driver === 'local-shadow' && workerQueueStatus.driver === 'local-shadow') ? 'info' : 'warning',
      passed: Boolean(
        adapterGatewayPreflight.privateGatewayReady
        || adapterGatewayPreflight.summary?.endpointConfigured
        || gatewayEndpointConfigured
        || (managedPersistenceStatus.driver === 'local-shadow' && workerQueueStatus.driver === 'local-shadow')
      ),
      detail: adapterGatewayPreflight.schemaVersion === 'adapter-gateway-preflight/v1'
        ? `${adapterGatewayPreflight.status}; live ${adapterGatewayPreflight.summary?.liveGatewayReady ? 'ready' : 'not required or pending'}; bearer auth ${gatewayAuthConfigured ? 'configured' : 'not configured'}.`
        : gatewayEndpointConfigured
          ? `gateway endpoint configured; bearer auth ${gatewayAuthConfigured ? 'configured' : 'not configured'}.`
          : 'Using local-shadow adapters; configure ADAPTER_GATEWAY_HTTP_ENDPOINT for private external gateway rehearsals.',
      apiPath: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
    },
    {
      id: 'operations-recovery-preflight',
      label: 'Operations readiness and incident drill pass',
      severity: 'blocker',
      passed: Boolean(operationsReadiness.readyForLocalPilot && operationsReadiness.summary?.incidentDrillReady),
      detail: `${operationsReadiness.summary?.passedGateCount || 0}/${operationsReadiness.summary?.gateCount || 0} operations gate(s), incident drill ${operationsReadiness.summary?.incidentDrillReady ? 'ready' : 'blocked'}.`,
      apiPath: route('operationsReadiness', projectId ? `/projects/${projectId}/operations-readiness` : null),
    },
    {
      id: 'production-overclaim-preflight',
      label: 'Production overclaim remains blocked',
      severity: 'blocker',
      passed: Boolean(
        mvpReadiness.readyForProduction === false
        && pilotLaunchReadiness.productionDecision === 'no-go'
        && operationsReadiness.readyForProduction === false
        && providerReadiness.readyForProduction === false
      ),
      detail: `productionDecision=${pilotLaunchReadiness.productionDecision || 'unknown'}, production blockers=${pilotLaunchReadiness.summary?.productionBlockerCount || 0}.`,
      apiPath: route('pilotLaunchReadiness', projectId ? `/projects/${projectId}/pilot-launch-readiness` : null),
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  const blockerGates = gates.filter((gate) => gate.severity === 'blocker');
  const failedBlockerGates = blockerGates.filter((gate) => !gate.passed);
  const warningGates = gates.filter((gate) => gate.severity === 'warning');
  const productionControls = [
    {
      id: 'access-control-enforced',
      label: 'Use enforced access mode with signed requests',
      ready: accessMode === 'enforced' && signingSecretConfigured,
      detail: 'Set AGENT_ACCESS_CONTROL_MODE=enforced and AGENT_ACCESS_SIGNING_SECRET before sensitive private pilots.',
    },
    {
      id: 'replay-protection',
      label: 'Enable signed request replay protection',
      ready: replayProtectionEnabled,
      detail: 'Set AGENT_ACCESS_REPLAY_PROTECTION=true for file-backed private pilots.',
    },
    {
      id: 'audit-fail-closed',
      label: 'Enable audit fail-closed mode',
      ready: auditFailClosedEnabled,
      detail: 'Set AGENT_ACCESS_AUDIT_FAIL_CLOSED=true once the audit sink is durable enough to fail closed.',
    },
    {
      id: 'scheduler-autostart',
      label: 'Autostart backend scheduler',
      ready: schedulerEnabled,
      detail: 'Set AGENT_AUTONOMOUS_SCHEDULER=true for unattended 24/7 worker operation.',
    },
    {
      id: 'real-persistence-adapter',
      label: 'Run against real managed persistence adapter',
      ready: Boolean(managedPersistenceStatus.requireRealAdapter && managedPersistenceStatus.productionCutoverReady),
      detail: 'local-shadow/http-json rehearsals do not approve production database cutover.',
    },
    {
      id: 'real-queue-adapter',
      label: 'Run against real managed queue adapter',
      ready: Boolean(workerQueueStatus.requireRealAdapter && workerQueueStatus.productionCutoverReady),
      detail: 'local-shadow/http-json rehearsals do not approve production queue cutover.',
    },
  ];
  const deploymentChecksum = persistenceChecksum({
    projectId,
    gates: gates.map((gate) => [gate.id, gate.passed, gate.severity]),
    productionControls: productionControls.map((row) => [row.id, row.ready]),
    store: Boolean(store.filePath),
    schedulerEnabled,
    accessMode,
  });

  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'deployment-preflight/v1',
    status: failedBlockerGates.length
      ? 'deployment-preflight-blocked'
      : warningGates.some((gate) => !gate.passed)
        ? 'private-pilot-preflight-ready-with-warnings'
        : 'private-pilot-preflight-ready',
    privatePilotDeploymentReady: failedBlockerGates.length === 0,
    productionDeploymentReady: false,
    gates,
    failedGates,
    productionControls,
    backendRuntime: {
      host: env.AGENT_PROJECT_HOST || '127.0.0.1',
      port: Number(env.AGENT_PROJECT_PORT || 8787),
      storePath: store.filePath || env.AGENT_PROJECT_STORE || null,
      securityAuditLogPath: store.securityAuditLogPath || env.AGENT_SECURITY_AUDIT_LOG || null,
      artifactRoot: env.AGENT_ARTIFACT_ROOT || null,
      schedulerEnabled,
      schedulerIntervalMs,
    },
    adapters: {
      managedPersistence: redactSensitiveObject(managedPersistenceStatus || {}),
      workerQueue: redactSensitiveObject(workerQueueStatus || {}),
      gateway: {
        endpointConfigured: gatewayEndpointConfigured,
        bearerAuthConfigured: gatewayAuthConfigured,
        timeoutMs: envNumber(env, 'ADAPTER_GATEWAY_TIMEOUT_MS', 8000),
        preflight: adapterGatewayPreflight.schemaVersion === 'adapter-gateway-preflight/v1'
          ? {
            status: adapterGatewayPreflight.status,
            liveGatewayReady: Boolean(adapterGatewayPreflight.summary?.liveGatewayReady),
            stateReadable: Boolean(adapterGatewayPreflight.summary?.stateReadable),
            failedGateCount: adapterGatewayPreflight.summary?.failedGateCount || 0,
            route: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
          }
          : null,
        validationCommands: [
          'npm run adapters:gateway-server:validate',
          'npm run adapters:gateway-postgres-store:validate',
          'npm run adapters:gateway',
        ],
      },
    },
    providers: {
      model: modelProviderSafe,
      search: searchProviderSafe,
      policy: providerControlPolicy,
      secretVault: safeSecretVaultStatus,
    },
    backendRoutes: {
      managerReadyPackage: route('managerReadyPackage', projectId ? `/projects/${projectId}/manager-ready-package` : null),
      projectEvidenceArchive: route('projectEvidenceArchive', projectId ? `/projects/${projectId}/project-evidence-archive` : null),
      projectEvidenceExports: route('projectEvidenceExports', projectId ? `/projects/${projectId}/project-evidence-exports` : null),
      pilotLaunchReadiness: route('pilotLaunchReadiness', projectId ? `/projects/${projectId}/pilot-launch-readiness` : null),
      deploymentPreflight: projectId ? `/projects/${projectId}/deployment-preflight` : null,
      adapterGatewayPreflight: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
      securityBoundary: route('securityBoundary', projectId ? `/projects/${projectId}/security-boundary` : null),
      providerReadiness: route('providerReadiness', projectId ? `/projects/${projectId}/provider-readiness` : null),
      operationsReadiness: route('operationsReadiness', projectId ? `/projects/${projectId}/operations-readiness` : null),
      persistenceAdapterDryRun: route('persistenceAdapterDryRun', projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null),
      workerQueueAdapterDryRun: route('workerQueueAdapterDryRun', projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null),
    },
    summary: {
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: failedGates.length,
      blockerGateCount: blockerGates.length,
      failedBlockerGateCount: failedBlockerGates.length,
      warningGateCount: warningGates.length,
      failedWarningGateCount: warningGates.filter((gate) => !gate.passed).length,
      productionControlCount: productionControls.length,
      productionControlReadyCount: productionControls.filter((row) => row.ready).length,
      adapterGatewayPreflightStatus: adapterGatewayPreflight.status || 'unknown',
      adapterGatewayLiveReady: Boolean(adapterGatewayPreflight.summary?.liveGatewayReady),
      adapterGatewayStateReadable: Boolean(adapterGatewayPreflight.summary?.stateReadable),
      adapterGatewayFailedGateCount: adapterGatewayPreflight.summary?.failedGateCount || 0,
      deploymentChecksum,
    },
    checksum: deploymentChecksum,
  };
}

const LAUNCH_APPROVAL_REQUIRED_ROLES = {
  'private-pilot': ['manager', 'security-admin'],
  production: ['manager', 'security-admin', 'operations-owner'],
};

const PROJECT_EVIDENCE_EXPORT_REQUIRED_ROLES = {
  'private-pilot': ['manager', 'security-admin'],
  production: ['manager', 'security-admin', 'operations-owner'],
};

function normalizeLaunchApprovalMode(mode = 'private-pilot') {
  const value = String(mode || '').trim().toLowerCase().replace(/_/g, '-');
  if (['prod', 'production', 'public-production'].includes(value)) return 'production';
  return 'private-pilot';
}

function normalizeLaunchApproverRole(role = '') {
  const value = String(role || '').trim().toLowerCase().replace(/_/g, '-');
  if (['admin', 'security', 'security-admin', 'owner'].includes(value)) return 'security-admin';
  if (['lead', 'leader', 'director', 'manager'].includes(value)) return 'manager';
  if (['ops', 'operator', 'operations', 'operations-owner', 'runtime-platform'].includes(value)) return 'operations-owner';
  return value || 'manager';
}

function launchApprovalStatus(decision = 'approved') {
  const value = String(decision || '').trim().toLowerCase().replace(/_/g, '-');
  if (['reject', 'rejected', 'deny', 'denied', 'blocked'].includes(value)) return 'rejected';
  if (['request', 'requested', 'pending'].includes(value)) return 'requested';
  return 'approved';
}

function buildLaunchApprovalRecord({
  project = {},
  input = {},
  now = nowIso(),
} = {}) {
  const mode = normalizeLaunchApprovalMode(input.mode || input.releaseMode);
  const approverRole = normalizeLaunchApproverRole(input.approverRole || input.role || input.actorRole);
  const decision = launchApprovalStatus(input.decision || input.status || 'approved');
  const approvalIndex = (project.launchApprovals || []).length + 1;
  const id = input.id || `launch_approval_${mode}_${approverRole}_${Date.parse(now) || Date.now()}_${approvalIndex}`;
  const checksumPayload = {
    id,
    projectId: project.id || input.projectId || null,
    mode,
    decision,
    approverRole,
    approverId: input.approverId || input.actorUserId || input.userId || '',
    reason: input.reason || input.summary || '',
    approvalIndex,
  };
  return {
    id,
    schemaVersion: 'launch-approval/v1',
    projectId: project.id || input.projectId || null,
    mode,
    decision,
    status: decision,
    approverRole,
    approverId: input.approverId || input.actorUserId || input.userId || '',
    approverName: input.approverName || input.actorName || input.updatedBy || input.approverId || input.actorUserId || input.userId || approverRole,
    reason: redactSensitiveText(input.reason || input.summary || ''),
    source: input.source || 'launch-approval-api',
    linkedAuditChecksum: input.linkedAuditChecksum || input.auditChecksum || null,
    linkedReadinessChecksum: input.linkedReadinessChecksum || null,
    createdAt: now,
    checksum: persistenceChecksum(checksumPayload),
  };
}

function launchApprovalModeSummary(mode, rows = []) {
  const requiredRoles = LAUNCH_APPROVAL_REQUIRED_ROLES[mode] || LAUNCH_APPROVAL_REQUIRED_ROLES['private-pilot'];
  const latestByRole = new Map();
  rows
    .filter((row) => normalizeLaunchApprovalMode(row.mode) === mode)
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .forEach((row) => {
      const role = normalizeLaunchApproverRole(row.approverRole);
      if (!latestByRole.has(role)) latestByRole.set(role, row);
    });
  const approvedRoles = requiredRoles.filter((role) => latestByRole.get(role)?.decision === 'approved');
  const rejectedRoles = requiredRoles.filter((role) => latestByRole.get(role)?.decision === 'rejected');
  const missingRoles = requiredRoles.filter((role) => !approvedRoles.includes(role));
  const latestApproval = [...latestByRole.values()][0] || null;
  return {
    id: mode,
    requiredRoles,
    approvedRoles,
    missingRoles,
    rejectedRoles,
    ready: missingRoles.length === 0 && rejectedRoles.length === 0,
    approvalCount: rows.filter((row) => normalizeLaunchApprovalMode(row.mode) === mode).length,
    latestApprovalId: latestApproval?.id || null,
    latestApprovalChecksum: latestApproval?.checksum || null,
    latestApprovedAt: latestApproval?.createdAt || null,
  };
}

function buildLaunchApprovalWorkflowSnapshot({
  project = {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || null;
  const rows = (project.launchApprovals || [])
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const privatePilot = launchApprovalModeSummary('private-pilot', rows);
  const production = launchApprovalModeSummary('production', rows);
  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'launch-approval-workflow/v1',
    status: production.ready
      ? 'production-approval-complete'
      : privatePilot.ready
        ? 'private-pilot-approval-complete'
        : 'approval-needed',
    readyForPrivatePilot: privatePilot.ready,
    readyForProduction: production.ready,
    modes: [privatePilot, production],
    rows,
    latestApproval: rows[0] || null,
    backendRoutes: {
      launchApprovals: projectId ? `/projects/${projectId}/launch-approvals` : null,
      productionLaunchAudit: projectId ? `/projects/${projectId}/production-launch-audit` : null,
      events: projectId ? `/projects/${projectId}/events` : null,
    },
    summary: {
      approvalCount: rows.length,
      privatePilotApproved: privatePilot.ready,
      productionApproved: production.ready,
      privatePilotMissingRoleCount: privatePilot.missingRoles.length,
      productionMissingRoleCount: production.missingRoles.length,
      latestApprovalChecksum: rows[0]?.checksum || null,
    },
  };
}

function normalizeProjectEvidenceExportMode(mode = 'private-pilot') {
  return normalizeLaunchApprovalMode(mode);
}

function normalizeProjectEvidenceExportAction(action = 'request') {
  const value = String(action || '').trim().toLowerCase().replace(/_/g, '-');
  if (['approve', 'approved', 'approval'].includes(value)) return 'approve';
  if (['reject', 'rejected', 'deny', 'denied', 'block', 'blocked'].includes(value)) return 'reject';
  if (['download', 'downloaded', 'audit-download', 'record-download'].includes(value)) return 'download-audit';
  return 'request';
}

function latestProjectEvidenceExportRequest(project = {}, mode = 'private-pilot') {
  return (project.projectEvidenceExports || [])
    .filter((record) => (
      record.schemaVersion === 'project-evidence-export/v1'
      && record.action === 'request'
      && normalizeProjectEvidenceExportMode(record.mode) === mode
    ))
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0] || null;
}

function buildProjectEvidenceExportRecord({
  project = {},
  input = {},
  archive = {},
  now = nowIso(),
} = {}) {
  const mode = normalizeProjectEvidenceExportMode(input.mode || input.exportMode || input.releaseMode);
  const action = normalizeProjectEvidenceExportAction(input.action || input.decision || 'request');
  const actorRole = normalizeLaunchApproverRole(input.actorRole || input.approverRole || input.role);
  const decision = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'download-audit' ? 'download-recorded' : 'requested';
  const latestRequest = latestProjectEvidenceExportRequest(project, mode);
  const createdAtMs = Date.parse(now) || Date.now();
  const rowIndex = (project.projectEvidenceExports || []).length + 1;
  const id = input.id || `project_evidence_export_${mode}_${action}_${actorRole}_${createdAtMs}_${rowIndex}`;
  const exportRequestId = action === 'request'
    ? id
    : (input.exportRequestId || input.requestId || latestRequest?.exportRequestId || latestRequest?.id || id);
  const retentionDays = Math.max(1, Number(input.retentionDays || input.retentionPolicyDays || 30) || 30);
  const expiresAt = input.expiresAt || new Date(createdAtMs + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const archiveChecksum = archive.checksum || input.archiveChecksum || input.linkedArchiveChecksum || null;
  const checksumPayload = {
    id,
    projectId: project.id || input.projectId || null,
    exportRequestId,
    mode,
    action,
    decision,
    actorRole,
    actorId: input.actorId || input.approverId || input.userId || '',
    archiveChecksum,
    retentionDays,
    dataResidencyRegion: input.dataResidencyRegion || input.region || 'local-private-pilot',
  };
  return redactSensitiveObject({
    id,
    schemaVersion: 'project-evidence-export/v1',
    projectId: project.id || input.projectId || null,
    exportRequestId,
    mode,
    action,
    decision,
    status: decision,
    actorRole,
    actorId: input.actorId || input.approverId || input.userId || '',
    actorName: input.actorName || input.approverName || input.updatedBy || input.actorId || input.approverId || input.userId || actorRole,
    reason: redactSensitiveText(input.reason || input.summary || ''),
    source: input.source || 'project-evidence-export-api',
    archiveId: archive.archiveId || input.archiveId || null,
    archiveChecksum,
    archiveStatus: archive.status || input.archiveStatus || 'unknown',
    archiveSchemaVersion: archive.schemaVersion || input.archiveSchemaVersion || null,
    archiveRawLeakCount: archive.summary?.rawLeakCount ?? input.archiveRawLeakCount ?? null,
    manifestEntryCount: archive.summary?.manifestEntryCount ?? input.manifestEntryCount ?? null,
    retentionDays,
    expiresAt,
    dataResidencyRegion: input.dataResidencyRegion || input.region || 'local-private-pilot',
    watermarkRequired: input.watermarkRequired ?? true,
    downloadAuditRequired: input.downloadAuditRequired ?? true,
    approvalRequired: true,
    encryptedStorageRequired: true,
    encryptedStorageReady: Boolean(input.encryptedStorageReady),
    objectStorageReady: Boolean(input.objectStorageReady),
    downloadUrlIssued: false,
    productionReady: false,
    createdAt: now,
    checksum: persistenceChecksum(checksumPayload),
  });
}

function buildProjectEvidenceExportWorkflowSnapshot({
  project = {},
  archive = {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || archive.projectId || null;
  const rows = (project.projectEvidenceExports || [])
    .filter((record) => record.schemaVersion === 'project-evidence-export/v1')
    .slice()
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const requests = rows.filter((record) => record.action === 'request');
  const latestRequest = requests[0] || null;
  const rowsForRequest = (request = {}) => rows.filter((record) => record.exportRequestId === (request.exportRequestId || request.id));
  const requestSummary = (request = null, mode = 'private-pilot') => {
    const requiredRoles = PROJECT_EVIDENCE_EXPORT_REQUIRED_ROLES[mode] || PROJECT_EVIDENCE_EXPORT_REQUIRED_ROLES['private-pilot'];
    const requestRows = request ? rowsForRequest(request) : rows.filter((record) => normalizeProjectEvidenceExportMode(record.mode) === mode);
    const latestByRole = new Map();
    requestRows
      .filter((record) => ['approve', 'reject'].includes(record.action))
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
      .forEach((record) => {
        const role = normalizeLaunchApproverRole(record.actorRole);
        if (!latestByRole.has(role)) latestByRole.set(role, record);
      });
    const approvedRoles = requiredRoles.filter((role) => latestByRole.get(role)?.decision === 'approved');
    const rejectedRoles = requiredRoles.filter((role) => latestByRole.get(role)?.decision === 'rejected');
    const missingRoles = requiredRoles.filter((role) => !approvedRoles.includes(role));
    return {
      id: mode,
      requestId: request?.exportRequestId || request?.id || null,
      requiredRoles,
      approvedRoles,
      rejectedRoles,
      missingRoles,
      ready: Boolean(request && missingRoles.length === 0 && rejectedRoles.length === 0),
      approvalCount: requestRows.filter((record) => record.action === 'approve').length,
      rejectionCount: requestRows.filter((record) => record.action === 'reject').length,
      downloadAuditCount: requestRows.filter((record) => record.action === 'download-audit').length,
      latestChecksum: requestRows[0]?.checksum || request?.checksum || null,
    };
  };
  const latestPrivatePilotRequest = requests.find((record) => normalizeProjectEvidenceExportMode(record.mode) === 'private-pilot') || null;
  const latestProductionRequest = requests.find((record) => normalizeProjectEvidenceExportMode(record.mode) === 'production') || null;
  const privatePilot = requestSummary(latestPrivatePilotRequest, 'private-pilot');
  const production = requestSummary(latestProductionRequest, 'production');
  const archiveReady = Boolean(archive.readyForManagerHandoff && archive.summary?.rawLeakCount === 0);
  const privatePilotReady = Boolean(privatePilot.ready && archiveReady);
  const gates = [
    {
      id: 'export-request-present',
      label: 'Evidence export request exists',
      passed: Boolean(latestPrivatePilotRequest),
      detail: latestPrivatePilotRequest?.id || 'No private-pilot evidence export request yet.',
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    },
    {
      id: 'archive-ready-and-redacted',
      label: 'Archive is ready and redaction scan is clean',
      passed: archiveReady,
      detail: `${archive.status || 'unknown'}, raw leaks ${archive.summary?.rawLeakCount ?? 'unknown'}.`,
      apiPath: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
    },
    ...PROJECT_EVIDENCE_EXPORT_REQUIRED_ROLES['private-pilot'].map((role) => ({
      id: `private-pilot-${role}-approval`,
      label: `${role} approval recorded`,
      passed: privatePilot.approvedRoles.includes(role),
      detail: privatePilot.approvedRoles.includes(role) ? 'approved' : 'missing',
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    })),
    {
      id: 'retention-policy-attached',
      label: 'Retention policy is attached',
      passed: Boolean(latestPrivatePilotRequest?.retentionDays && latestPrivatePilotRequest?.expiresAt),
      detail: latestPrivatePilotRequest ? `${latestPrivatePilotRequest.retentionDays} day(s), expires ${latestPrivatePilotRequest.expiresAt}.` : 'No request retention policy.',
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    },
    {
      id: 'download-audit-required',
      label: 'Download audit is required before issuing a file',
      passed: latestPrivatePilotRequest?.downloadAuditRequired !== false,
      detail: latestPrivatePilotRequest?.downloadAuditRequired === false ? 'download audit not required' : 'download audit required',
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    },
    {
      id: 'production-export-blocked',
      label: 'Production export remains blocked',
      passed: true,
      detail: 'Encrypted object storage, download URL issuance, watermarking, and data-residency controls are not production-ready.',
      apiPath: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    },
  ];
  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'project-evidence-export-workflow/v1',
    status: privatePilotReady ? 'private-pilot-export-approved' : latestPrivatePilotRequest ? 'export-approval-needed' : 'export-request-needed',
    readyForPrivatePilotHandoff: privatePilotReady,
    readyForProductionExport: false,
    modes: [privatePilot, production],
    rows,
    latestRequest,
    latestPrivatePilotRequest,
    backendRoutes: {
      projectEvidenceExports: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
      projectEvidenceArchive: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
      projectEvidenceExports: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
      securityAuditStream: projectId ? `/projects/${projectId}/security-audit-stream` : null,
    },
    gates,
    productionControls: [
      'authenticated project membership and approval workflow',
      'encrypted object storage',
      'watermarking and download audit',
      'retention and deletion job',
      'customer-specific data residency policy',
    ],
    summary: {
      requestCount: requests.length,
      rowCount: rows.length,
      approvalCount: rows.filter((record) => record.action === 'approve').length,
      rejectionCount: rows.filter((record) => record.action === 'reject').length,
      downloadAuditCount: rows.filter((record) => record.action === 'download-audit').length,
      privatePilotReady,
      productionReady: false,
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: gates.filter((gate) => !gate.passed).length,
      latestRequestChecksum: latestRequest?.checksum || null,
      archiveChecksum: archive.checksum || null,
    },
    checksum: persistenceChecksum({
      projectId,
      schemaVersion: 'project-evidence-export-workflow/v1',
      rows: rows.map((record) => [record.id, record.action, record.decision, record.checksum]),
      archiveChecksum: archive.checksum || null,
      privatePilotReady,
    }),
  };
}

function buildProductionLaunchAuditSnapshot({
  project = {},
  managerDashboard = {},
  mvpReadiness = {},
  pilotLaunchReadiness = {},
  deploymentPreflight = {},
  launchApprovalWorkflow = {},
  securityBoundary = {},
  providerReadiness = {},
  operationsReadiness = {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || managerDashboard.projectId || pilotLaunchReadiness.projectId || deploymentPreflight.projectId || null;
  const route = (key, fallback = null) => managerDashboard.backendRoutes?.[key] || fallback;
  const routeFor = (key, suffix) => route(key, projectId ? `/projects/${projectId}/${suffix}` : null);
  const privatePilotGates = [
    {
      id: 'mvp-local-candidate',
      label: 'MVP local acceptance is complete',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(mvpReadiness.readyForLocalPilot && (mvpReadiness.summary?.coreBlockerCount || 0) === 0),
      detail: `${mvpReadiness.summary?.corePassedCount || 0}/${mvpReadiness.summary?.coreTotalCount || 0} core readiness gate(s) passed.`,
      apiPath: routeFor('mvpReadiness', 'mvp-readiness'),
    },
    {
      id: 'pilot-launch-package-go',
      label: 'Private pilot launch package is approved',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(pilotLaunchReadiness.schemaVersion === 'pilot-launch-readiness/v1' && pilotLaunchReadiness.privatePilotDecision === 'go'),
      detail: `privatePilotDecision=${pilotLaunchReadiness.privatePilotDecision || 'unknown'}, productionDecision=${pilotLaunchReadiness.productionDecision || 'unknown'}.`,
      apiPath: routeFor('pilotLaunchReadiness', 'pilot-launch-readiness'),
    },
    {
      id: 'deployment-preflight-private-ready',
      label: 'Private pilot deployment preflight passes',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(deploymentPreflight.schemaVersion === 'deployment-preflight/v1' && deploymentPreflight.privatePilotDeploymentReady),
      detail: `${deploymentPreflight.summary?.passedGateCount || 0}/${deploymentPreflight.summary?.gateCount || 0} preflight gate(s) passed; ${deploymentPreflight.summary?.failedBlockerGateCount || 0} blocker gate(s) failed.`,
      apiPath: routeFor('deploymentPreflight', 'deployment-preflight'),
    },
    {
      id: 'launch-evidence-routes-ready',
      label: 'Launch evidence routes are ready',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(
        (pilotLaunchReadiness.summary?.evidenceRouteCount || 0) > 0
        && pilotLaunchReadiness.summary?.readyEvidenceRouteCount === pilotLaunchReadiness.summary?.evidenceRouteCount
      ),
      detail: `${pilotLaunchReadiness.summary?.readyEvidenceRouteCount || 0}/${pilotLaunchReadiness.summary?.evidenceRouteCount || 0} evidence route(s) ready.`,
      apiPath: routeFor('pilotLaunchReadiness', 'pilot-launch-readiness'),
    },
    {
      id: 'private-pilot-launch-approval-ready',
      label: 'Private pilot launch approval is complete',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(launchApprovalWorkflow.readyForPrivatePilot),
      detail: `${launchApprovalWorkflow.modes?.find((mode) => mode.id === 'private-pilot')?.approvedRoles?.length || 0}/${LAUNCH_APPROVAL_REQUIRED_ROLES['private-pilot'].length} private-pilot approval role(s) complete.`,
      apiPath: routeFor('launchApprovals', 'launch-approvals'),
    },
    {
      id: 'security-provider-operations-local-ready',
      label: 'Security, provider, and operations local contracts pass',
      scope: 'private-pilot',
      severity: 'blocker',
      passed: Boolean(
        securityBoundary.status === 'local-boundary-ready'
        && providerReadiness.status === 'local-provider-contract-ready'
        && operationsReadiness.readyForLocalPilot
      ),
      detail: `security=${securityBoundary.status || 'unknown'}, provider=${providerReadiness.status || 'unknown'}, operations=${operationsReadiness.status || 'unknown'}.`,
      apiPath: routeFor('managerReadyPackage', 'manager-ready-package'),
    },
  ];
  const privatePilotFailedGates = privatePilotGates.filter((gate) => !gate.passed);
  const privatePilotReady = privatePilotFailedGates.length === 0;
  const deploymentProductionControls = (deploymentPreflight.productionControls || [])
    .filter((control) => !control.ready)
    .map((control) => ({
      id: `deployment-control-${control.id || 'unknown'}`,
      label: control.label || control.id || 'Deployment production control',
      status: 'blocked',
      severity: 'production-control',
      detail: control.detail || 'Production deployment control is not ready.',
      source: 'deployment-preflight',
      apiPath: routeFor('deploymentPreflight', 'deployment-preflight'),
    }));
  const productionBlockerRows = [
    ...(pilotLaunchReadiness.productionBlockers || []),
    ...deploymentProductionControls,
  ];
  const productionBlockers = [];
  const seenProductionBlockers = new Set();
  productionBlockerRows.forEach((blocker) => {
    const id = blocker.id || `${blocker.source || 'production'}-${blocker.label || blocker.detail || productionBlockers.length}`;
    if (seenProductionBlockers.has(id)) return;
    seenProductionBlockers.add(id);
    productionBlockers.push({ ...blocker, id });
  });
  const productionGates = [
    {
      id: 'production-deployment-controls-ready',
      label: 'Production deployment controls are ready',
      scope: 'production',
      severity: 'production-blocker',
      passed: Boolean(deploymentPreflight.productionDeploymentReady),
      detail: `${deploymentPreflight.summary?.productionControlReadyCount || 0}/${deploymentPreflight.summary?.productionControlCount || 0} production control(s) ready.`,
      apiPath: routeFor('deploymentPreflight', 'deployment-preflight'),
    },
    {
      id: 'production-launch-approval-ready',
      label: 'Production launch approval is complete',
      scope: 'production',
      severity: 'production-blocker',
      passed: Boolean(launchApprovalWorkflow.readyForProduction),
      detail: `${launchApprovalWorkflow.modes?.find((mode) => mode.id === 'production')?.approvedRoles?.length || 0}/${LAUNCH_APPROVAL_REQUIRED_ROLES.production.length} production approval role(s) complete.`,
      apiPath: routeFor('launchApprovals', 'launch-approvals'),
    },
    {
      id: 'production-security-provider-operations-ready',
      label: 'Production security, provider, and operations controls are ready',
      scope: 'production',
      severity: 'production-blocker',
      passed: Boolean(securityBoundary.readyForProduction && providerReadiness.readyForProduction && operationsReadiness.readyForProduction),
      detail: `security=${securityBoundary.readyForProduction ? 'ready' : 'blocked'}, provider=${providerReadiness.readyForProduction ? 'ready' : 'blocked'}, operations=${operationsReadiness.readyForProduction ? 'ready' : 'blocked'}.`,
      apiPath: routeFor('managerReadyPackage', 'manager-ready-package'),
    },
    {
      id: 'production-launch-decision-go',
      label: 'Production launch decision is approved',
      scope: 'production',
      severity: 'production-blocker',
      passed: Boolean(
        pilotLaunchReadiness.productionDecision === 'go'
        && mvpReadiness.readyForProduction
        && productionBlockers.length === 0
      ),
      detail: `productionDecision=${pilotLaunchReadiness.productionDecision || 'unknown'}, production blocker(s)=${productionBlockers.length}.`,
      apiPath: routeFor('pilotLaunchReadiness', 'pilot-launch-readiness'),
    },
  ];
  const failedProductionGates = productionGates.filter((gate) => !gate.passed);
  const productionReady = failedProductionGates.length === 0;
  const rawEvidenceRoutes = [
    { id: 'production-launch-audit', route: projectId ? `/projects/${projectId}/production-launch-audit` : null, ready: true },
    { id: 'project-evidence-archive', route: routeFor('projectEvidenceArchive', 'project-evidence-archive'), ready: Boolean(mvpReadiness.readyForLocalPilot) },
    { id: 'project-evidence-exports', route: routeFor('projectEvidenceExports', 'project-evidence-exports'), ready: true },
    { id: 'manager-ready-package', route: routeFor('managerReadyPackage', 'manager-ready-package'), ready: true },
    { id: 'pilot-launch-readiness', route: routeFor('pilotLaunchReadiness', 'pilot-launch-readiness'), ready: pilotLaunchReadiness.schemaVersion === 'pilot-launch-readiness/v1' },
    { id: 'deployment-preflight', route: routeFor('deploymentPreflight', 'deployment-preflight'), ready: deploymentPreflight.schemaVersion === 'deployment-preflight/v1' },
    { id: 'launch-approvals', route: routeFor('launchApprovals', 'launch-approvals'), ready: launchApprovalWorkflow.schemaVersion === 'launch-approval-workflow/v1' },
    { id: 'mvp-readiness', route: routeFor('mvpReadiness', 'mvp-readiness'), ready: Boolean(mvpReadiness.schemaVersion) },
    { id: 'security-boundary', route: routeFor('securityBoundary', 'security-boundary'), ready: securityBoundary.status === 'local-boundary-ready' },
    { id: 'provider-readiness', route: routeFor('providerReadiness', 'provider-readiness'), ready: providerReadiness.status === 'local-provider-contract-ready' },
    { id: 'operations-readiness', route: routeFor('operationsReadiness', 'operations-readiness'), ready: operationsReadiness.readyForLocalPilot },
    ...(pilotLaunchReadiness.evidenceRoutes || []),
  ];
  const evidenceRoutes = [];
  const seenEvidenceRoutes = new Set();
  rawEvidenceRoutes.forEach((row) => {
    const id = row.id || row.route;
    if (!id || seenEvidenceRoutes.has(id)) return;
    seenEvidenceRoutes.add(id);
    evidenceRoutes.push(row);
  });
  const auditIntegrityGates = [
    {
      id: 'production-overclaim-guard',
      label: 'Production overclaim guard is active',
      scope: 'audit-integrity',
      severity: 'blocker',
      passed: Boolean(
        productionReady === false
        && mvpReadiness.readyForProduction === false
        && pilotLaunchReadiness.productionDecision === 'no-go'
        && deploymentPreflight.productionDeploymentReady === false
      ),
      detail: 'Production must stay no-go until real managed identity, persistence, queue, provider, audit, and operations controls pass.',
      apiPath: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    },
    {
      id: 'production-blocker-inventory-visible',
      label: 'Production blocker inventory is visible',
      scope: 'audit-integrity',
      severity: 'blocker',
      passed: productionBlockers.length > 0 || failedProductionGates.length > 0,
      detail: `${productionBlockers.length} production blocker row(s), ${failedProductionGates.length} failed production gate(s).`,
      apiPath: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    },
  ];
  const failedAuditIntegrityGates = auditIntegrityGates.filter((gate) => !gate.passed);
  const privatePilotDecision = privatePilotReady ? 'go' : 'no-go';
  const productionDecision = productionReady ? 'go' : 'no-go';
  const nextShortestPath = privatePilotFailedGates[0] ? {
    scope: 'private-pilot',
    id: privatePilotFailedGates[0].id,
    label: privatePilotFailedGates[0].label,
    detail: privatePilotFailedGates[0].detail,
    apiPath: privatePilotFailedGates[0].apiPath || null,
  } : {
    scope: 'production-hardening',
    id: productionBlockers[0]?.id || failedProductionGates[0]?.id || null,
    label: productionBlockers[0]?.label || failedProductionGates[0]?.label || 'Production hardening',
    detail: productionBlockers[0]?.detail || failedProductionGates[0]?.detail || 'Private pilot evidence is complete; production hardening remains blocked.',
    apiPath: productionBlockers[0]?.apiPath || failedProductionGates[0]?.apiPath || null,
  };
  const checksum = persistenceChecksum({
    projectId,
    privatePilotDecision,
    productionDecision,
    privatePilotGates: privatePilotGates.map((gate) => [gate.id, gate.passed]),
    productionGates: productionGates.map((gate) => [gate.id, gate.passed]),
    auditIntegrityGates: auditIntegrityGates.map((gate) => [gate.id, gate.passed]),
    productionBlockerIds: productionBlockers.map((blocker) => blocker.id),
    evidenceRoutes: evidenceRoutes.map((row) => [row.id, row.ready]),
  });

  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'production-launch-audit/v1',
    status: productionReady
      ? 'production-ready'
      : privatePilotReady
        ? 'private-pilot-ready-production-blocked'
        : 'private-pilot-blocked',
    privatePilotDecision,
    productionDecision,
    readyForPrivatePilot: privatePilotReady,
    readyForProduction: productionReady,
    gates: [...privatePilotGates, ...productionGates, ...auditIntegrityGates],
    privatePilotGates,
    productionGates,
    auditIntegrityGates,
    failedPrivatePilotGates: privatePilotFailedGates,
    failedProductionGates,
    failedAuditIntegrityGates,
    productionBlockers,
    evidenceRoutes,
    releaseModes: [
      {
        id: 'private-pilot',
        decision: privatePilotDecision,
        ready: privatePilotReady,
        status: privatePilotReady ? 'ready' : 'blocked',
        blockerCount: privatePilotFailedGates.length,
      },
      {
        id: 'production',
        decision: productionDecision,
        ready: productionReady,
        status: productionReady ? 'ready' : 'blocked',
        blockerCount: productionBlockers.length + failedProductionGates.length,
      },
    ],
    nextShortestPath,
    backendRoutes: {
      productionLaunchAudit: projectId ? `/projects/${projectId}/production-launch-audit` : null,
      projectEvidenceArchive: routeFor('projectEvidenceArchive', 'project-evidence-archive'),
      projectEvidenceExports: routeFor('projectEvidenceExports', 'project-evidence-exports'),
      launchApprovals: routeFor('launchApprovals', 'launch-approvals'),
      managerReadyPackage: routeFor('managerReadyPackage', 'manager-ready-package'),
      pilotLaunchReadiness: routeFor('pilotLaunchReadiness', 'pilot-launch-readiness'),
      deploymentPreflight: routeFor('deploymentPreflight', 'deployment-preflight'),
      mvpReadiness: routeFor('mvpReadiness', 'mvp-readiness'),
      securityBoundary: routeFor('securityBoundary', 'security-boundary'),
      providerReadiness: routeFor('providerReadiness', 'provider-readiness'),
      operationsReadiness: routeFor('operationsReadiness', 'operations-readiness'),
    },
    summary: {
      privatePilotGateCount: privatePilotGates.length,
      privatePilotPassedGateCount: privatePilotGates.filter((gate) => gate.passed).length,
      failedPrivatePilotGateCount: privatePilotFailedGates.length,
      productionGateCount: productionGates.length,
      productionPassedGateCount: productionGates.filter((gate) => gate.passed).length,
      failedProductionGateCount: failedProductionGates.length,
      auditIntegrityGateCount: auditIntegrityGates.length,
      failedAuditIntegrityGateCount: failedAuditIntegrityGates.length,
      productionBlockerCount: productionBlockers.length,
      launchApprovalCount: launchApprovalWorkflow.summary?.approvalCount || 0,
      launchApprovalPrivatePilotReady: Boolean(launchApprovalWorkflow.readyForPrivatePilot),
      launchApprovalProductionReady: Boolean(launchApprovalWorkflow.readyForProduction),
      evidenceRouteCount: evidenceRoutes.length,
      readyEvidenceRouteCount: evidenceRoutes.filter((row) => row.ready).length,
      privatePilotReady,
      productionReady,
      checksum,
    },
    checksum,
  };
}

function compactProjectEvidenceArchiveContents(contents = {}, manifest = [], backendRoutes = {}) {
  const safeSubmissionSummary = (submission = {}) => ({
    id: submission.id || null,
    title: submission.title || submission.artifact?.title || null,
    artifactType: submission.artifactType || submission.artifact?.artifactType || submission.artifact?.type || null,
    status: submission.status || null,
    reviewStatus: submission.reviewStatus || null,
    agentId: submission.agentId || null,
    taskId: submission.taskId || null,
    bodyChecksum: submission.bodyChecksum || null,
    artifactId: submission.artifactId || submission.artifact?.id || null,
    route: submission.workspacePath || submission.artifactPath || submission.artifact?.relativePath || submission.artifact?.path || null,
  });

  return redactSensitiveObject({
    contentMode: 'manifest-only',
    fullArchiveRoute: backendRoutes.projectEvidenceArchive || null,
    omittedContentReason: 'Manager Ready Package carries checksums, counts, and route proof only; fetch the standalone project evidence archive for full redacted evidence contents.',
    project: contents.project ? {
      id: contents.project.id || null,
      name: contents.project.name || null,
      status: contents.project.status || null,
      language: contents.project.language || null,
      leaderId: contents.project.leaderId || null,
      reviewerId: contents.project.reviewerId || null,
      teamCount: contents.project.team?.length || 0,
      checksum: persistenceChecksum(contents.project),
    } : null,
    manifest: manifest.map((entry) => ({
      id: entry.id,
      route: entry.route || null,
      count: entry.count || 0,
      ready: Boolean(entry.ready),
      checksum: entry.checksum || null,
    })),
    transcripts: {
      channelCount: contents.transcripts?.channels?.length || 0,
      messageCount: (contents.transcripts?.channels || []).reduce((sum, channel) => sum + (channel.messages?.length || 0), 0),
      channels: (contents.transcripts?.channels || []).map((channel) => ({
        channelId: channel.channelId || channel.id || null,
        route: channel.route || null,
        messageCount: channel.messages?.length || 0,
        archivedProofMessageCount: channel.archivedProofMessages?.length || 0,
        checksum: channel.checksum || null,
      })),
      checksum: persistenceChecksum(contents.transcripts || {}),
    },
    submissions: (contents.submissions || []).map(safeSubmissionSummary),
    artifacts: (contents.artifacts || []).map((artifact = {}) => ({
      id: artifact.id || null,
      submissionId: artifact.submissionId || null,
      title: artifact.title || null,
      artifactType: artifact.artifactType || artifact.type || null,
      route: artifact.route || artifact.relativePath || null,
      checksum: artifact.checksum || null,
      existsOnDisk: Boolean(artifact.existsOnDisk),
    })),
    finalDeliverables: (contents.finalDeliverables || []).map(safeSubmissionSummary),
    revisions: (contents.revisions || []).map((submission = {}) => ({
      id: submission.id || null,
      revisesSubmissionId: submission.revisesSubmissionId || null,
      respondsToReviewId: submission.respondsToReviewId || null,
      supersedesSubmissionIds: submission.supersedesSubmissionIds || [],
      bodyChecksum: submission.bodyChecksum || null,
    })),
    evidenceSearches: (contents.evidenceSearches || []).map((record = {}) => ({
      id: record.id || null,
      status: record.status || null,
      sourceCount: record.sources?.length || 0,
      judgement: record.evidenceJudgement || record.qualitySummary?.judgement || null,
      checksum: record.checksum || null,
    })),
    submissionReviews: (contents.submissionReviews || []).map((review = {}) => ({
      id: review.id || null,
      submissionId: review.submissionId || null,
      reviewerId: review.reviewerId || null,
      verdict: review.verdict || null,
      commentsChecksum: review.commentsChecksum || null,
    })),
    timeline: {
      count: contents.timeline?.length || 0,
      latest: contents.timeline?.[0] ? {
        id: contents.timeline[0].id || null,
        eventType: contents.timeline[0].eventType || null,
        time: contents.timeline[0].time || null,
        logChecksum: contents.timeline[0].logChecksum || null,
      } : null,
      checksum: persistenceChecksum(contents.timeline || []),
    },
    eventLedger: {
      count: contents.eventLedger?.length || 0,
      firstSequence: contents.eventLedger?.[0]?.sequence || null,
      lastSequence: contents.eventLedger?.at?.(-1)?.sequence || null,
      checksum: persistenceChecksum(contents.eventLedger || []),
    },
    managerFlowGraph: {
      schemaVersion: contents.managerFlowGraph?.schemaVersion || null,
      summary: contents.managerFlowGraph?.summary || {},
      checksum: persistenceChecksum(contents.managerFlowGraph || {}),
    },
    readinessProofMap: {
      routeCount: contents.readinessProofMap?.routes?.length || 0,
      checksum: persistenceChecksum(contents.readinessProofMap || {}),
    },
    readinessModels: Object.fromEntries(Object.entries(contents.readinessModels || {}).map(([key, model]) => [key, {
      schemaVersion: model?.schemaVersion || null,
      status: model?.status || null,
      checksum: model?.checksum || persistenceChecksum(model || {}),
    }])),
    runtimeEvidence: {
      persistence: {
        schemaVersion: contents.runtimeEvidence?.persistenceSnapshot?.schemaVersion || null,
        storageMode: contents.runtimeEvidence?.persistenceSnapshot?.storageMode || null,
        status: contents.runtimeEvidence?.persistenceSnapshot?.integrity?.status || null,
        checksum: persistenceChecksum(contents.runtimeEvidence?.persistenceSnapshot || {}),
      },
      workerQueue: {
        schemaVersion: contents.runtimeEvidence?.workerQueueSnapshot?.schemaVersion || null,
        status: contents.runtimeEvidence?.workerQueueSnapshot?.status || null,
        receiptCount: contents.runtimeEvidence?.workerQueueSnapshot?.summary?.workerRunReceiptCount || 0,
        checksum: persistenceChecksum(contents.runtimeEvidence?.workerQueueSnapshot || {}),
      },
    },
  });
}

function buildProjectEvidenceArchive({
  project = {},
  messages = [],
  managerDashboard = {},
  managerFlowGraph = {},
  mvpReadiness = {},
  pilotLaunchReadiness = {},
  deploymentPreflight = {},
  productionLaunchAudit = {},
  securityBoundary = {},
  providerReadiness = {},
  operationsReadiness = {},
  persistenceSnapshot = {},
  workerQueueSnapshot = {},
  now = nowIso(),
  includeContents = true,
} = {}) {
  const projectId = project.id || managerDashboard.projectId || null;
  const backendRoutes = {
    ...(managerDashboard.backendRoutes || {}),
    projectEvidenceArchive: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
    projectEvidenceExports: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
  };
  const scopedMessages = (messages || []).filter((message) => !projectId || message.projectId === projectId);
  const transcriptIndex = managerDashboard.transcriptIndex || buildTranscriptIndex({ project, messages });
  const safeMessage = (message = {}) => redactSensitiveObject({
    ...message,
    text: redactSensitiveText(message.text || ''),
    textPreview: compactPreview(message.text || ''),
    textChecksum: persistenceChecksum(message.text || ''),
  });
  const transcriptChannels = (transcriptIndex.channels || []).map((channel) => {
    const channelId = channel.channelId || channel.id || 'main';
    const transcript = buildChannelTranscript({ project, messages, channelId });
    const safeMessages = (transcript.messages || []).map(safeMessage);
    const archivedProofMessages = (transcript.archivedProofMessages || []).map(safeMessage);
    return {
      ...redactSensitiveObject(channel),
      channelId,
      route: projectId ? `/projects/${projectId}/transcripts/${encodeURIComponent(channelId)}` : null,
      messages: safeMessages,
      archivedProofMessages,
      checksum: persistenceChecksum({
        channelId,
        messages: safeMessages.map((message) => [message.id, message.textChecksum]),
        archivedProofMessages: archivedProofMessages.map((message) => [message.id, message.textChecksum]),
      }),
    };
  });
  const safeSubmission = (submission = {}) => redactSensitiveObject({
    ...submission,
    body: redactSensitiveText(submission.body || ''),
    bodyChecksum: persistenceChecksum(submission.body || ''),
    artifact: submission.artifact ? {
      ...submission.artifact,
      content: submission.artifact.content ? redactSensitiveText(submission.artifact.content) : submission.artifact.content,
      contentChecksum: persistenceChecksum(submission.artifact.content || submission.body || ''),
    } : null,
  });
  const submissions = (project.agentSubmissions || []).map(safeSubmission);
  const finalDeliverables = submissions.filter((submission) => (
    submission.artifactType === 'final-deliverable'
    || submission.status === 'final'
    || submission.reviewStatus === 'accepted'
  ));
  const revisions = submissions.filter((submission) => (
    submission.revisesSubmissionId
    || submission.respondsToReviewId
    || (submission.supersedesSubmissionIds || []).length
  ));
  const artifacts = submissions
    .map((submission) => {
      const artifact = submission.artifact || {};
      const route = submission.workspacePath || submission.artifactPath || artifact.relativePath || artifact.path || artifact.url || null;
      return {
        id: submission.artifactId || artifact.id || `artifact_${submission.id}`,
        submissionId: submission.id,
        title: submission.title || artifact.title || 'Agent artifact',
        artifactType: submission.artifactType || artifact.artifactType || artifact.type || 'artifact',
        route,
        relativePath: artifact.relativePath || submission.workspacePath || null,
        checksum: artifact.contentChecksum || submission.bodyChecksum || persistenceChecksum(artifact.content || submission.body || ''),
        existsOnDisk: Boolean(artifact.existsOnDisk),
        source: artifact.source || 'agent-submission',
      };
    })
    .filter((artifact) => artifact.id);
  const evidenceSearches = (project.evidenceSearches || []).map((record) => redactSensitiveObject({
    ...record,
    query: redactSensitiveText(record.query || ''),
    purpose: redactSensitiveText(record.purpose || ''),
    sources: (record.sources || []).map((source) => redactSensitiveObject({
      ...source,
      url: source.url ? redactUrl(source.url) : source.url,
      summary: redactSensitiveText(source.summary || ''),
    })),
    checksum: persistenceChecksum({
      id: record.id,
      query: record.query || '',
      sourceIds: (record.sources || []).map((source) => source.id || source.url || source.title),
      judgement: record.evidenceJudgement || record.qualitySummary?.judgement || null,
    }),
  }));
  const submissionReviews = (project.submissionReviews || []).map((review) => redactSensitiveObject({
    ...review,
    comments: redactSensitiveText(review.comments || ''),
    commentsChecksum: persistenceChecksum(review.comments || ''),
  }));
  const timeline = (project.logs || []).map((log) => redactSensitiveObject({
    ...log,
    log: redactSensitiveText(log.log || log.text || ''),
    logChecksum: persistenceChecksum(log.log || log.text || ''),
  }));
  const eventLedger = (project.eventLedger || []).map((event) => redactSensitiveObject({
    ...event,
    summary: redactSensitiveText(event.summary || ''),
    payloadChecksum: persistenceChecksum(event.payload || {}),
  }));
  const eventSequences = eventLedger.map((event) => event.sequence).filter((value) => Number.isFinite(value));
  const eventLedgerContiguous = eventSequences.every((value, index) => index === 0 || value === eventSequences[index - 1] + 1);
  const agentStates = Object.fromEntries(Object.entries(project.agentStates || {}).map(([agentId, state]) => [agentId, redactSensitiveObject({
    agentId,
    name: state.name || null,
    role: state.role || null,
    status: state.status || null,
    currentPlan: state.currentPlan || null,
    obligations: state.obligations || [],
    worklog: state.worklog || [],
    inbox: state.inbox || [],
    nextAgentRunAt: state.nextAgentRunAt || null,
    lastActiveAt: state.lastActiveAt || null,
  })]));
  const flowGraph = redactSensitiveObject({
    schemaVersion: managerFlowGraph.schemaVersion || 'manager-flow-graph/v1',
    generatedAt: managerFlowGraph.generatedAt || null,
    summary: managerFlowGraph.summary || {},
    nodes: managerFlowGraph.nodes || [],
    edges: managerFlowGraph.edges || [],
  });
  const readinessProofMap = redactSensitiveObject(managerDashboard.readinessProofMap || {});
  const readinessModels = redactSensitiveObject({
    mvpReadiness: {
      schemaVersion: mvpReadiness.schemaVersion || null,
      status: mvpReadiness.status || null,
      readyForLocalPilot: Boolean(mvpReadiness.readyForLocalPilot),
      readyForProduction: Boolean(mvpReadiness.readyForProduction),
      summary: mvpReadiness.summary || {},
    },
    pilotLaunchReadiness: {
      schemaVersion: pilotLaunchReadiness.schemaVersion || null,
      status: pilotLaunchReadiness.status || null,
      privatePilotDecision: pilotLaunchReadiness.privatePilotDecision || null,
      productionDecision: pilotLaunchReadiness.productionDecision || null,
      checksum: pilotLaunchReadiness.checksum || null,
      summary: pilotLaunchReadiness.summary || {},
    },
    deploymentPreflight: {
      schemaVersion: deploymentPreflight.schemaVersion || null,
      status: deploymentPreflight.status || null,
      privatePilotDeploymentReady: Boolean(deploymentPreflight.privatePilotDeploymentReady),
      productionDeploymentReady: Boolean(deploymentPreflight.productionDeploymentReady),
      checksum: deploymentPreflight.checksum || null,
      summary: deploymentPreflight.summary || {},
    },
    productionLaunchAudit: {
      schemaVersion: productionLaunchAudit.schemaVersion || null,
      status: productionLaunchAudit.status || null,
      privatePilotDecision: productionLaunchAudit.privatePilotDecision || null,
      productionDecision: productionLaunchAudit.productionDecision || null,
      checksum: productionLaunchAudit.checksum || null,
      summary: productionLaunchAudit.summary || {},
    },
    securityBoundary: {
      schemaVersion: securityBoundary.schemaVersion || null,
      status: securityBoundary.status || null,
      rawLeakCount: securityBoundary.summary?.rawLeakCount || securityBoundary.redactionScan?.rawLeakCount || 0,
      accessAuditCount: securityBoundary.accessAudit?.count || 0,
    },
    providerReadiness: {
      schemaVersion: providerReadiness.schemaVersion || null,
      status: providerReadiness.status || null,
      readyForProduction: Boolean(providerReadiness.readyForProduction),
      summary: providerReadiness.summary || {},
    },
    operationsReadiness: {
      schemaVersion: operationsReadiness.schemaVersion || null,
      status: operationsReadiness.status || null,
      readyForLocalPilot: Boolean(operationsReadiness.readyForLocalPilot),
      readyForProduction: Boolean(operationsReadiness.readyForProduction),
      summary: operationsReadiness.summary || {},
    },
  });
  const runtimeEvidence = redactSensitiveObject({
    persistenceSnapshot: {
      schemaVersion: persistenceSnapshot.schemaVersion || null,
      storageMode: persistenceSnapshot.storageMode || null,
      integrity: persistenceSnapshot.integrity || {},
      recordCounts: persistenceSnapshot.recordCounts || {},
      totalRecordCount: persistenceSnapshot.totalRecordCount || 0,
    },
    workerQueueSnapshot: {
      schemaVersion: workerQueueSnapshot.schemaVersion || null,
      summary: workerQueueSnapshot.summary || {},
      retryPolicy: workerQueueSnapshot.retryPolicy || null,
      deadLetterPolicy: workerQueueSnapshot.deadLetterPolicy || null,
    },
  });
  const contents = redactSensitiveObject({
    project: {
      id: project.id || null,
      name: project.name || null,
      brief: project.brief || project.description || null,
      language: project.language || null,
      status: project.status || null,
      leaderId: project.leaderId || project.selectedLeaderId || project.kickoffCharter?.leaderId || null,
      reviewerId: project.reviewerId || project.kickoffCharter?.reviewerId || null,
      createdAt: project.createdAt || null,
      updatedAt: project.updatedAt || null,
      team: project.team || [],
    },
    agentStates,
    tasks: project.tasks || [],
    transcripts: {
      index: transcriptIndex,
      channels: transcriptChannels,
    },
    submissions,
    artifacts,
    finalDeliverables,
    revisions,
    evidenceSearches,
    submissionReviews,
    timeline,
    eventLedger,
    managerFlowGraph: flowGraph,
    readinessProofMap,
    readinessModels,
    runtimeEvidence,
  });
  const manifest = [
    {
      id: 'project-record',
      label: 'Project record and team roster',
      route: backendRoutes.project || (projectId ? `/projects/${projectId}` : null),
      count: contents.project.id ? 1 : 0,
      ready: Boolean(contents.project.id),
      checksum: persistenceChecksum(contents.project),
    },
    {
      id: 'group-chat-transcripts',
      label: 'Meeting and group-chat transcripts',
      route: backendRoutes.transcripts || (projectId ? `/projects/${projectId}/transcripts` : null),
      count: scopedMessages.length,
      ready: scopedMessages.length > 0 && transcriptChannels.length > 0,
      checksum: persistenceChecksum(contents.transcripts),
    },
    {
      id: 'flow-graph',
      label: 'Manager Flow Graph nodes and edges',
      route: backendRoutes.managerFlowGraph || (projectId ? `/projects/${projectId}/manager-flow-graph` : null),
      count: managerFlowGraph.summary?.nodeCount || flowGraph.nodes?.length || 0,
      ready: (managerFlowGraph.summary?.proofedNodeCount || 0) > 0,
      checksum: persistenceChecksum(flowGraph),
    },
    {
      id: 'readiness-proof-map',
      label: 'Readiness Proof Map routes',
      route: backendRoutes.readinessProofMap || (projectId ? `/projects/${projectId}/readiness-proof-map` : null),
      count: readinessProofMap.routes?.length || 0,
      ready: (readinessProofMap.routes?.length || 0) > 0,
      checksum: persistenceChecksum(readinessProofMap),
    },
    {
      id: 'agent-submissions',
      label: 'Agent typed submissions and artifacts',
      route: backendRoutes.submissions || (projectId ? `/projects/${projectId}/submissions` : null),
      count: submissions.length,
      ready: submissions.length > 0,
      checksum: persistenceChecksum(submissions),
    },
    {
      id: 'final-deliverables',
      label: 'Accepted or final deliverables',
      route: backendRoutes.submissions || (projectId ? `/projects/${projectId}/submissions` : null),
      count: finalDeliverables.length,
      ready: finalDeliverables.length > 0,
      checksum: persistenceChecksum(finalDeliverables),
    },
    {
      id: 'evidence-searches',
      label: 'Search and evidence packets',
      route: backendRoutes.evidenceSearches || (projectId ? `/projects/${projectId}/evidence-searches` : null),
      count: evidenceSearches.length,
      ready: evidenceSearches.some((record) => record.status === 'completed' || record.evidenceJudgement || record.qualitySummary?.judgement),
      checksum: persistenceChecksum(evidenceSearches),
    },
    {
      id: 'submission-reviews',
      label: 'Reviewer verdicts and requested changes',
      route: backendRoutes.submissionReviews || (projectId ? `/projects/${projectId}/submission-reviews` : null),
      count: submissionReviews.length,
      ready: submissionReviews.length > 0,
      checksum: persistenceChecksum(submissionReviews),
    },
    {
      id: 'revision-lineage',
      label: 'Revision lineage and review responses',
      route: backendRoutes.managerFlowGraph || (projectId ? `/projects/${projectId}/manager-flow-graph` : null),
      count: revisions.length,
      ready: revisions.length > 0,
      checksum: persistenceChecksum(revisions),
    },
    {
      id: 'timeline-and-event-ledger',
      label: 'Timeline logs and event ledger',
      route: backendRoutes.events || (projectId ? `/projects/${projectId}/events` : null),
      count: timeline.length + eventLedger.length,
      ready: timeline.length > 0 && eventLedger.length > 0 && eventLedgerContiguous,
      checksum: persistenceChecksum({ timeline, eventLedger }),
    },
    {
      id: 'launch-and-runtime-readiness',
      label: 'Launch, deployment, provider, security, and operations read models',
      route: backendRoutes.managerReadyPackage || (projectId ? `/projects/${projectId}/manager-ready-package` : null),
      count: Object.keys(readinessModels).length,
      ready: Boolean(mvpReadiness.readyForLocalPilot && pilotLaunchReadiness.schemaVersion && deploymentPreflight.schemaVersion),
      checksum: persistenceChecksum(readinessModels),
    },
    {
      id: 'persistence-and-worker-recovery',
      label: 'Persistence snapshot and worker queue recovery evidence',
      route: backendRoutes.persistenceSnapshot || (projectId ? `/projects/${projectId}/persistence-snapshot` : null),
      count: (persistenceSnapshot.totalRecordCount || 0) + (workerQueueSnapshot.summary?.workerRunReceiptCount || 0),
      ready: persistenceSnapshot.integrity?.status === 'ready' && workerQueueSnapshot.schemaVersion === 'worker-queue-snapshot/v1',
      checksum: persistenceChecksum(runtimeEvidence),
    },
  ];
  const integrityGates = [
    {
      id: 'final-deliverable-present',
      label: 'Final or accepted deliverable is archived',
      passed: finalDeliverables.length > 0,
      detail: `${finalDeliverables.length} final/accepted deliverable(s).`,
      apiPath: backendRoutes.submissions || null,
    },
    {
      id: 'review-verdict-present',
      label: 'Reviewer verdict is archived',
      passed: submissionReviews.some((review) => ['accepted', 'changes-requested', 'rejected', 'under-review'].includes(review.verdict)),
      detail: `${submissionReviews.length} review record(s).`,
      apiPath: backendRoutes.submissionReviews || null,
    },
    {
      id: 'evidence-packet-present',
      label: 'Evidence/search packet is archived',
      passed: evidenceSearches.length > 0 && evidenceSearches.some((record) => record.sources?.length || record.evidenceJudgement || record.qualitySummary?.judgement),
      detail: `${evidenceSearches.length} evidence search(es), ${evidenceSearches.reduce((sum, record) => sum + (record.sources?.length || 0), 0)} source(s).`,
      apiPath: backendRoutes.evidenceSearches || null,
    },
    {
      id: 'transcripts-present',
      label: 'Meeting and group-chat transcript proof is archived',
      passed: scopedMessages.length > 0 && transcriptChannels.length > 0,
      detail: `${transcriptChannels.length} transcript channel(s), ${scopedMessages.length} message(s).`,
      apiPath: backendRoutes.transcripts || null,
    },
    {
      id: 'flow-graph-proofed',
      label: 'Flow Graph contains proofed nodes',
      passed: (managerFlowGraph.summary?.proofedNodeCount || 0) > 0,
      detail: `${managerFlowGraph.summary?.proofedNodeCount || 0}/${managerFlowGraph.summary?.nodeCount || 0} proofed node(s).`,
      apiPath: backendRoutes.managerFlowGraph || null,
    },
    {
      id: 'event-ledger-contiguous',
      label: 'Event ledger append order is contiguous',
      passed: eventLedger.length > 0 && eventLedgerContiguous,
      detail: `${eventLedger.length} event(s), sequence ${eventSequences[0] || 'n/a'} -> ${eventSequences[eventSequences.length - 1] || 'n/a'}.`,
      apiPath: backendRoutes.events || null,
    },
    {
      id: 'private-pilot-readiness-attached',
      label: 'Private-pilot readiness contracts are attached',
      passed: Boolean(mvpReadiness.readyForLocalPilot && pilotLaunchReadiness.schemaVersion === 'pilot-launch-readiness/v1' && deploymentPreflight.schemaVersion === 'deployment-preflight/v1'),
      detail: `mvp=${mvpReadiness.status || 'unknown'}, pilot=${pilotLaunchReadiness.privatePilotDecision || 'unknown'}, deployment=${deploymentPreflight.status || 'unknown'}.`,
      apiPath: backendRoutes.managerReadyPackage || null,
    },
    {
      id: 'production-overclaim-blocked',
      label: 'Production overclaim remains blocked in archive',
      passed: Boolean(
        mvpReadiness.readyForProduction === false
        && pilotLaunchReadiness.productionDecision === 'no-go'
        && deploymentPreflight.productionDeploymentReady === false
        && productionLaunchAudit.productionDecision === 'no-go'
      ),
      detail: `production=${productionLaunchAudit.productionDecision || pilotLaunchReadiness.productionDecision || 'unknown'}.`,
      apiPath: backendRoutes.productionLaunchAudit || null,
    },
    {
      id: 'archive-route-visible',
      label: 'Project evidence archive route is visible',
      passed: Boolean(backendRoutes.projectEvidenceArchive),
      detail: backendRoutes.projectEvidenceArchive || 'archive route missing',
      apiPath: backendRoutes.projectEvidenceArchive || null,
    },
  ];
  const archiveWithoutChecksum = {
    projectId,
    generatedAt: now,
    schemaVersion: 'project-evidence-archive/v1',
    archiveKind: 'manager-verifiable-project-evidence',
    archiveId: `project_archive_${projectId || 'project'}_${persistenceChecksum({
      projectId,
      generatedAt: now,
      manifest: manifest.map((entry) => [entry.id, entry.checksum]),
    })}`,
    status: 'pending-redaction-scan',
    exportPolicy: {
      contentScope: 'project-state-transcripts-submissions-evidence-reviews-flow-graph-readiness',
      redaction: 'secret fields, URL secret params, bearer tokens, and acceptance fixture secrets are redacted before checksum.',
      access: 'manager/security-admin/observer read route; production should require authenticated project membership, approval, retention, and encrypted export storage.',
    },
    backendRoutes,
    manifest,
    contents,
    integrity: {
      gates: integrityGates,
      failedGateCount: integrityGates.filter((gate) => !gate.passed).length,
      eventLedgerContiguous,
    },
    summary: {
      manifestEntryCount: manifest.length,
      readyManifestEntryCount: manifest.filter((entry) => entry.ready).length,
      transcriptChannelCount: transcriptChannels.length,
      transcriptMessageCount: scopedMessages.length,
      submissionCount: submissions.length,
      finalDeliverableCount: finalDeliverables.length,
      evidenceSearchCount: evidenceSearches.length,
      evidenceSourceCount: evidenceSearches.reduce((sum, record) => sum + (record.sources?.length || 0), 0),
      submissionReviewCount: submissionReviews.length,
      revisionCount: revisions.length,
      artifactCount: artifacts.length,
      timelineLogCount: timeline.length,
      eventLedgerCount: eventLedger.length,
      flowGraphNodeCount: managerFlowGraph.summary?.nodeCount || flowGraph.nodes?.length || 0,
      flowGraphProofedNodeCount: managerFlowGraph.summary?.proofedNodeCount || 0,
      readinessProofRouteCount: readinessProofMap.routes?.length || 0,
      privatePilotReady: Boolean(mvpReadiness.readyForLocalPilot && pilotLaunchReadiness.privatePilotDecision === 'go'),
      productionReady: false,
    },
  };
  const redactedArchive = redactSensitiveObject(archiveWithoutChecksum);
  const rawSecretScan = scanTextForRawSecretLeaks(stableJson(redactedArchive));
  const redactionGate = {
    id: 'archive-redaction-clean',
    label: 'Archive contains no raw secret patterns after redaction',
    passed: rawSecretScan.count === 0,
    detail: `${rawSecretScan.count} raw secret pattern(s) detected.`,
    apiPath: backendRoutes.securityBoundary || null,
  };
  const gates = [...integrityGates, redactionGate];
  const failedGates = gates.filter((gate) => !gate.passed);
  const archiveChecksum = persistenceChecksum({
    projectId,
    schemaVersion: redactedArchive.schemaVersion,
    manifest: manifest.map((entry) => [entry.id, entry.count, entry.ready, entry.checksum]),
    gates: gates.map((gate) => [gate.id, gate.passed]),
    summary: redactedArchive.summary,
  });
  const returnedArchive = includeContents ? redactedArchive : {
    ...redactedArchive,
    contents: compactProjectEvidenceArchiveContents(redactedArchive.contents, manifest, backendRoutes),
    contentsMode: 'manifest-only',
    fullArchiveRoute: backendRoutes.projectEvidenceArchive || null,
    exportPolicy: {
      ...redactedArchive.exportPolicy,
      managerReadyPackageContents: 'manifest-only summary; full redacted evidence contents are available from projectEvidenceArchive.',
    },
  };
  return {
    ...returnedArchive,
    status: failedGates.length ? 'archive-needs-attention' : 'archive-ready',
    readyForManagerHandoff: failedGates.length === 0,
    readyForPrivatePilotEvidence: failedGates.length === 0,
    readyForProduction: false,
    integrity: {
      ...redactedArchive.integrity,
      gates,
      failedGates,
      failedGateCount: failedGates.length,
      rawSecretScan,
    },
    summary: {
      ...returnedArchive.summary,
      contentsMode: includeContents ? 'full' : 'manifest-only',
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: failedGates.length,
      rawLeakCount: rawSecretScan.count,
      archiveChecksum,
    },
    checksum: archiveChecksum,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function persistenceChecksum(value) {
  const text = stableJson(value);
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return `chk_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function compactPreview(value = '', limit = 160) {
  const text = redactSensitiveText(String(value || '').replace(/\s+/g, ' ').trim());
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function summarizeSecurityAccessAudit(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const deniedRows = list.filter((row) => !row.allowed || row.status === 'denied');
  const allowedRows = list.filter((row) => row.allowed || row.status === 'allowed');
  const enforcedRows = list.filter((row) => row.enforced);
  return {
    count: list.length,
    allowedCount: allowedRows.length,
    deniedCount: deniedRows.length,
    enforcedCount: enforcedRows.length,
    routeKeys: uniqueStrings(list.map((row) => row.routeKey)).slice(0, 24),
    actorRoles: uniqueStrings(list.map((row) => row.actor?.role || row.actorRole)).slice(0, 12),
    latestDecision: list[0] || null,
    latestDeniedDecision: deniedRows[0] || null,
    rows: list.slice(0, 20),
    deniedRows: deniedRows.slice(0, 12),
  };
}

function summarizeSecurityAuditStream(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const deniedRows = list.filter((row) => !row.allowed || row.status === 'denied');
  const sequenceRows = list
    .filter((row) => Number.isFinite(Number(row.streamSequence)))
    .slice()
    .sort((a, b) => Number(a.streamSequence) - Number(b.streamSequence));
  const sequenceGapCount = sequenceRows.reduce((count, row, index) => {
    if (index === 0) return count;
    const current = Number(row.streamSequence);
    const previous = Number(sequenceRows[index - 1].streamSequence);
    return current === previous + 1 ? count : count + 1;
  }, 0);
  const chainState = sequenceRows.reduce((state, row) => {
    const expectedPreviousHash = state.previousHash || SECURITY_AUDIT_STREAM_GENESIS_HASH;
    const hasChainFields = Boolean(row.previousStreamHash && row.streamHash);
    const expectedHash = hasChainFields ? computeSecurityAuditStreamHash(row) : null;
    const previousMismatch = hasChainFields && row.previousStreamHash !== expectedPreviousHash;
    const hashMismatch = hasChainFields && row.streamHash !== expectedHash;
    return {
      previousHash: row.streamHash || expectedPreviousHash,
      missingHashCount: state.missingHashCount + (hasChainFields ? 0 : 1),
      chainBreakCount: state.chainBreakCount + (previousMismatch ? 1 : 0),
      hashMismatchCount: state.hashMismatchCount + (hashMismatch ? 1 : 0),
      latestHash: row.streamHash || state.latestHash || null,
    };
  }, {
    previousHash: SECURITY_AUDIT_STREAM_GENESIS_HASH,
    missingHashCount: 0,
    chainBreakCount: 0,
    hashMismatchCount: 0,
    latestHash: null,
  });
  const hashChainReady = sequenceRows.length > 0
    && sequenceGapCount === 0
    && chainState.missingHashCount === 0
    && chainState.chainBreakCount === 0
    && chainState.hashMismatchCount === 0;
  return {
    count: list.length,
    deniedCount: deniedRows.length,
    routeKeys: uniqueStrings(list.map((row) => row.routeKey)).slice(0, 24),
    projectIds: uniqueStrings(list.map((row) => row.projectId)).slice(0, 24),
    firstSequence: sequenceRows[0]?.streamSequence || null,
    lastSequence: sequenceRows[sequenceRows.length - 1]?.streamSequence || null,
    sequenceGapCount,
    hashChainReady,
    missingHashCount: chainState.missingHashCount,
    chainBreakCount: chainState.chainBreakCount,
    hashMismatchCount: chainState.hashMismatchCount,
    latestStreamHash: chainState.latestHash,
    latestRecord: list[list.length - 1] || null,
    latestDeniedRecord: deniedRows[deniedRows.length - 1] || null,
    rows: list.slice(-20).reverse(),
  };
}

function buildSecurityAccessAuditRecord({
  projectId,
  decision = {},
  method = 'GET',
  path = '/',
  statusCode = null,
  outcome = '',
  now = nowIso(),
} = {}) {
  const route = decision.route || {};
  const actor = decision.actor || {};
  const routeKey = route.routeKey || 'unknown';
  const timestamp = Date.parse(now) || Date.now();
  return redactSensitiveObject({
    id: `access_audit_${projectId || 'project'}_${routeKey}_${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
    projectId,
    time: now,
    method: String(method || 'GET').toUpperCase(),
    path: redactSensitiveText(path || '/'),
    routeKey,
    capability: route.capability || '',
    sensitivity: route.sensitivity || 'project-data',
    mode: decision.mode || 'prototype-open',
    enforced: Boolean(decision.enforced),
    allowed: Boolean(decision.allowed),
    status: decision.status || (decision.allowed ? 'allowed' : 'denied'),
    reason: redactSensitiveText(decision.reason || ''),
    statusCode,
    outcome,
    actor: {
      role: actor.role || 'anonymous',
      agentId: actor.agentId || null,
      userId: actor.userId || null,
    },
    replay: decision.replay ? {
      required: Boolean(decision.replay.required),
      verified: Boolean(decision.replay.verified),
      detected: Boolean(decision.replay.detected),
      requestId: decision.replay.requestId || null,
      cache: decision.replay.cache || 'api-memory',
      maxAgeMs: decision.replay.maxAgeMs || null,
    } : null,
    membership: decision.membership ? {
      required: Boolean(decision.membership.required),
      verified: Boolean(decision.membership.verified),
      status: decision.membership.status || 'unknown',
      reason: redactSensitiveText(decision.membership.reason || ''),
      schemaVersion: decision.membership.schemaVersion || 'project-membership-policy/v1',
      projectId: decision.membership.projectId || route.projectId || projectId || null,
      role: decision.membership.role || actor.role || 'anonymous',
      agentId: decision.membership.agentId || actor.agentId || null,
      userId: decision.membership.userId || actor.userId || null,
      source: decision.membership.source || 'access-control-project-membership',
      revision: decision.membership.revision || null,
      updatedAt: decision.membership.updatedAt || null,
    } : null,
    identitySession: decision.identitySession ? {
      required: Boolean(decision.identitySession.required),
      verified: Boolean(decision.identitySession.verified),
      sessionId: decision.identitySession.sessionId || null,
      status: decision.identitySession.status || 'unknown',
      expiresAt: decision.identitySession.expiresAt || null,
    } : null,
    route: {
      projectId: route.projectId || projectId || null,
      agentId: route.agentId || null,
      allowedRoles: route.allowedRoles || [],
      selfAgent: Boolean(route.selfAgent),
      reviewerMatch: Boolean(route.reviewerMatch),
      runtimeOnly: Boolean(route.runtimeOnly),
    },
  });
}

function securityAuditStreamChecksumPayload(streamRecord = {}) {
  return {
    id: streamRecord.id,
    projectId: streamRecord.projectId,
    streamType: streamRecord.streamType,
    streamSequence: streamRecord.streamSequence,
    method: streamRecord.method,
    path: streamRecord.path,
    routeKey: streamRecord.routeKey,
    allowed: streamRecord.allowed,
    status: streamRecord.status,
    actor: streamRecord.actor,
    replay: streamRecord.replay,
    membership: streamRecord.membership,
    identitySession: streamRecord.identitySession,
    time: streamRecord.time,
  };
}

function computeSecurityAuditStreamHash(streamRecord = {}) {
  return persistenceChecksum({
    ...securityAuditStreamChecksumPayload(streamRecord),
    previousStreamHash: streamRecord.previousStreamHash || SECURITY_AUDIT_STREAM_GENESIS_HASH,
    streamChecksum: streamRecord.streamChecksum || persistenceChecksum(securityAuditStreamChecksumPayload(streamRecord)),
  });
}

function buildSecurityAuditStreamRecord(record = {}, { sequence = null, previousStreamHash = SECURITY_AUDIT_STREAM_GENESIS_HASH } = {}) {
  const streamRecord = redactSensitiveObject({
    ...record,
    schemaVersion: 'security-audit-stream-record/v1',
    streamType: 'security-access',
    streamSequence: sequence,
    streamSource: 'access-control',
    streamRecordId: `stream_${record.id || `access_${sequence || Date.now()}`}`,
    previousStreamHash: previousStreamHash || SECURITY_AUDIT_STREAM_GENESIS_HASH,
  });
  const streamChecksum = persistenceChecksum(securityAuditStreamChecksumPayload(streamRecord));
  const checksummedRecord = {
    ...streamRecord,
    streamChecksum,
  };
  return {
    ...checksummedRecord,
    streamHash: computeSecurityAuditStreamHash(checksummedRecord),
  };
}

function buildProductionPersistenceSnapshot({
  project = {},
  messages = [],
  managerDashboard = {},
  managerFlowGraph = {},
  mvpReadiness = {},
  securityBoundary = {},
  securityAuditStreamRecords = [],
  accessReplayRecords = [],
} = {}) {
  const projectId = project.id || managerDashboard.projectId || null;
  const agentStates = project.agentStates || {};
  const tables = [
    { name: 'projects', required: true, primaryKey: ['id'], purpose: 'Project metadata and current lifecycle state.' },
    { name: 'project_membership_policies', required: false, primaryKey: ['projectId', 'revision'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Project-level role grants, Agent runtime bindings, Reviewer bindings, and revocation metadata.' },
    { name: 'project_membership_grants', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Normalized membership grant and revocation rows derived from the active project membership policy.' },
    { name: 'identity_sessions', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Local identity-session and runtime credential rows. Raw tokens are returned once and only token hashes/checksums are persisted.' },
    { name: 'project_messages', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Group chat and transcript messages with receipt metadata.' },
    { name: 'project_event_ledger', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Append-only replayable project events.' },
    { name: 'project_timeline_logs', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Manager-visible timeline and flow graph proof logs.' },
    { name: 'project_tasks', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Task ownership and execution state.' },
    { name: 'project_task_evidence_links', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'taskId', table: 'project_tasks' }], purpose: 'Join rows from tasks to messages, logs, events, submissions, artifacts, and sources.' },
    { name: 'agent_states', required: true, primaryKey: ['projectId', 'agentId'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Independent Agent mind state, cadence, and management state.' },
    { name: 'agent_obligations', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'agentId', table: 'agent_states' }], purpose: 'Open and resolved Agent obligations.' },
    { name: 'agent_worklog_entries', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'agentId', table: 'agent_states' }], purpose: 'Private Agent work evidence.' },
    { name: 'agent_submissions', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'agentId', table: 'agent_states' }], purpose: 'Typed Agent artifact submissions.' },
    { name: 'artifact_files', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'submissionId', table: 'agent_submissions' }], purpose: 'Workspace artifact file metadata, paths, and content checksums.' },
    { name: 'evidence_searches', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'agentId', table: 'agent_states' }], purpose: 'Agent evidence search records and aggregate quality judgement.' },
    { name: 'evidence_sources', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'evidenceSearchId', table: 'evidence_searches' }], purpose: 'Normalized evidence source packets with source-level quality and safety judgement.' },
    { name: 'submission_reviews', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'submissionId', table: 'agent_submissions' }], purpose: 'Formal Reviewer verdicts and requested changes.' },
    { name: 'launch_approvals', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Release approval and change-management decisions for private-pilot and production launches.' },
    { name: 'project_evidence_exports', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Evidence archive handoff requests, approvals, retention metadata, data residency, archive checksum, and download-audit controls.' },
    { name: 'access_replay_records', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Accepted signed request ids used to reject replay within the freshness window.' },
    { name: 'security_access_audit', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Security access decisions for enforced-mode backend reads and writes.' },
    { name: 'security_audit_stream', required: false, primaryKey: ['streamRecordId'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Backend-level append-order security audit stream for migration to immutable audit storage.' },
    { name: 'provider_usage_ledger', required: false, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }, { field: 'agentId', table: 'agent_states' }], purpose: 'Provider policy decisions, usage, cost estimates, and evidence lineage for model/search calls.' },
    { name: 'worker_runs', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Project and Agent worker scheduler runs.' },
    { name: 'read_model_checkpoints', required: true, primaryKey: ['id'], foreignKeys: [{ field: 'projectId', table: 'projects' }], purpose: 'Read-model generation checkpoints for manager surfaces.' },
  ];
  const recordsByTable = Object.fromEntries(tables.map((table) => [table.name, []]));
  const addRecord = (table, id, data = {}, refs = {}) => {
    const safeData = redactSensitiveObject(data || {});
    const record = {
      table,
      id: String(id || `${table}_${recordsByTable[table]?.length || 0}`),
      projectId,
      refs: redactSensitiveObject(refs || {}),
      checksum: persistenceChecksum({ table, id, data: safeData, refs }),
      data: safeData,
    };
    if (!recordsByTable[table]) recordsByTable[table] = [];
    recordsByTable[table].push(record);
    return record;
  };

  addRecord('projects', projectId || 'project', {
    id: projectId,
    name: project.name || '',
    status: project.status || '',
    language: project.language || 'en',
    teamCount: project.team?.length || 0,
    taskCount: project.tasks?.length || 0,
    createdAt: project.createdAt || project.initiation?.createdAt || null,
    updatedAt: project.updatedAt || project.lastAutonomousRunAt || project.lastActivityAt || null,
    autonomyEnabled: Boolean(project.autonomy?.enabled),
    nextAutonomousRunAt: project.nextAutonomousRunAt || null,
    lastAutonomousRunAt: project.lastAutonomousRunAt || null,
  });

  const membershipPolicy = project.projectMembershipPolicy || null;
  if (membershipPolicy) {
    const membershipSummary = summarizeProjectMembershipPolicy(membershipPolicy);
    addRecord('project_membership_policies', `${projectId}_${membershipPolicy.revision || 'active'}`, {
      id: `${projectId}_${membershipPolicy.revision || 'active'}`,
      projectId,
      schemaVersion: membershipPolicy.schemaVersion || 'project-membership-policy/v1',
      revision: membershipPolicy.revision || null,
      source: membershipPolicy.source || null,
      status: membershipSummary.status,
      updatedAt: membershipPolicy.updatedAt || null,
      updatedBy: membershipPolicy.updatedBy || null,
      managerUserCount: membershipSummary.managerUserCount,
      securityAdminUserCount: membershipSummary.securityAdminUserCount,
      observerUserCount: membershipSummary.observerUserCount,
      runtimeUserCount: membershipSummary.runtimeUserCount,
      agentCount: membershipSummary.agentCount,
      reviewerAgentCount: membershipSummary.reviewerAgentCount,
      agentBindingCount: membershipSummary.agentBindingCount,
      reviewerBindingCount: membershipSummary.reviewerBindingCount,
      revokedUserCount: membershipSummary.revokedUserCount,
      revokedAgentCount: membershipSummary.revokedAgentCount,
    });
    const addMembershipGrant = ({ role, subjectType = 'user', subjectId, agentId = null, status = 'active' } = {}) => {
      if (!subjectId) return;
      addRecord('project_membership_grants', `${projectId}_${membershipPolicy.revision || 'active'}_${role}_${subjectType}_${agentId || 'global'}_${subjectId}`, {
        projectId,
        policyRevision: membershipPolicy.revision || null,
        role,
        subjectType,
        subjectId,
        agentId,
        status,
      });
    };
    (membershipPolicy.managerUserIds || []).forEach((userId) => addMembershipGrant({ role: 'manager', subjectId: userId }));
    (membershipPolicy.securityAdminUserIds || []).forEach((userId) => addMembershipGrant({ role: 'security-admin', subjectId: userId }));
    (membershipPolicy.observerUserIds || []).forEach((userId) => addMembershipGrant({ role: 'observer', subjectId: userId }));
    (membershipPolicy.runtimeUserIds || []).forEach((userId) => addMembershipGrant({ role: 'runtime-platform', subjectId: userId }));
    (membershipPolicy.agentIds || []).forEach((agentId) => addMembershipGrant({ role: 'agent', subjectType: 'agent', subjectId: agentId, agentId }));
    (membershipPolicy.reviewerAgentIds || []).forEach((agentId) => addMembershipGrant({ role: 'reviewer-agent', subjectType: 'agent', subjectId: agentId, agentId }));
    Object.entries(membershipPolicy.agentUserIds || {}).forEach(([agentId, userIds]) => {
      (userIds || []).forEach((userId) => addMembershipGrant({ role: 'agent-runtime-binding', subjectId: userId, agentId }));
    });
    Object.entries(membershipPolicy.reviewerUserIds || {}).forEach(([agentId, userIds]) => {
      (userIds || []).forEach((userId) => addMembershipGrant({ role: 'reviewer-runtime-binding', subjectId: userId, agentId }));
    });
    (membershipPolicy.revokedUserIds || []).forEach((userId) => addMembershipGrant({ role: 'revoked-user', subjectId: userId, status: 'revoked' }));
    (membershipPolicy.revokedAgentIds || []).forEach((agentId) => addMembershipGrant({ role: 'revoked-agent', subjectType: 'agent', subjectId: agentId, agentId, status: 'revoked' }));
  }

  (project.identitySessions || []).forEach((session) => {
    addRecord('identity_sessions', session.id, {
      id: session.id,
      projectId,
      schemaVersion: session.schemaVersion || 'identity-session/v1',
      role: session.role || 'observer',
      userId: session.userId || null,
      agentId: session.agentId || null,
      status: identitySessionStatus(session),
      issuedAt: session.issuedAt || null,
      expiresAt: session.expiresAt || null,
      revokedAt: session.revokedAt || null,
      revokedBy: session.revokedBy || null,
      issuerRole: session.issuerRole || null,
      issuerId: session.issuerId || null,
      source: session.source || null,
      scope: session.scope || [],
      tokenHash: session.tokenHash || null,
      tokenHashPreview: session.tokenHash ? `${String(session.tokenHash).slice(0, 12)}...` : null,
      checksum: session.checksum || null,
    }, {
      userId: session.userId || null,
      agentId: session.agentId || null,
      issuerId: session.issuerId || null,
    });
  });

  (messages || []).filter((message) => !projectId || message.projectId === projectId).forEach((message) => {
    addRecord('project_messages', message.id, {
      id: message.id,
      projectId: message.projectId || projectId,
      channelId: message.channelId || 'main',
      type: message.type || 'message',
      authorId: message.authorId || null,
      author: message.author || null,
      targetIds: message.targetIds || [],
      heardBy: message.heardBy || [],
      receiptCount: message.visibility?.receiptCount || message.receipts?.length || 0,
      textPreview: compactPreview(message.text),
      textChecksum: persistenceChecksum(message.text || ''),
      createdAt: message.createdAt || message.sentAt || message.time || null,
    });
  });

  (project.eventLedger || []).forEach((event) => {
    addRecord('project_event_ledger', event.id || `event_${event.sequence || recordsByTable.project_event_ledger.length}`, {
      id: event.id || null,
      projectId,
      sequence: event.sequence || null,
      type: event.type || '',
      time: event.time || null,
      actor: event.actor || null,
      source: event.source || null,
      channelId: event.channelId || null,
      evidenceIds: event.evidenceIds || [],
      entityIds: event.entityIds || {},
      summaryPreview: compactPreview(event.summary),
      payloadChecksum: persistenceChecksum(event.payload || {}),
    });
  });

  (project.securityAccessAudit || []).forEach((record) => {
    addRecord('security_access_audit', record.id, {
      id: record.id,
      projectId,
      time: record.time || null,
      method: record.method || '',
      path: record.path || '',
      routeKey: record.routeKey || '',
      capability: record.capability || '',
      sensitivity: record.sensitivity || '',
      mode: record.mode || '',
      enforced: Boolean(record.enforced),
      allowed: Boolean(record.allowed),
      status: record.status || '',
      statusCode: record.statusCode || null,
      outcome: record.outcome || '',
      reasonPreview: compactPreview(record.reason),
      actorRole: record.actor?.role || null,
      actorAgentId: record.actor?.agentId || null,
      actorUserId: record.actor?.userId || null,
      replayRequired: Boolean(record.replay?.required),
      replayVerified: Boolean(record.replay?.verified),
      replayDetected: Boolean(record.replay?.detected),
      replayRequestId: record.replay?.requestId || null,
      membershipRequired: Boolean(record.membership?.required),
      membershipVerified: Boolean(record.membership?.verified),
      membershipStatus: record.membership?.status || null,
      membershipReason: record.membership?.reason || null,
      membershipRevision: record.membership?.revision || null,
      membershipPolicyUpdatedAt: record.membership?.updatedAt || null,
      identitySessionRequired: Boolean(record.identitySession?.required),
      identitySessionVerified: Boolean(record.identitySession?.verified),
      identitySessionId: record.identitySession?.sessionId || null,
      identitySessionStatus: record.identitySession?.status || null,
      identitySessionExpiresAt: record.identitySession?.expiresAt || null,
      routeAgentId: record.route?.agentId || null,
      routeAllowedRoles: record.route?.allowedRoles || [],
    });
  });

  (project.launchApprovals || []).forEach((record) => {
    addRecord('launch_approvals', record.id, {
      id: record.id,
      projectId,
      schemaVersion: record.schemaVersion || 'launch-approval/v1',
      mode: normalizeLaunchApprovalMode(record.mode),
      decision: record.decision || record.status || '',
      approverRole: normalizeLaunchApproverRole(record.approverRole),
      approverId: record.approverId || null,
      approverName: record.approverName || null,
      reasonPreview: compactPreview(record.reason),
      linkedAuditChecksum: record.linkedAuditChecksum || null,
      linkedReadinessChecksum: record.linkedReadinessChecksum || null,
      createdAt: record.createdAt || null,
      checksum: record.checksum || null,
    });
  });

  (project.projectEvidenceExports || []).forEach((record) => {
    addRecord('project_evidence_exports', record.id, {
      id: record.id,
      projectId,
      schemaVersion: record.schemaVersion || 'project-evidence-export/v1',
      exportRequestId: record.exportRequestId || null,
      mode: normalizeProjectEvidenceExportMode(record.mode),
      action: normalizeProjectEvidenceExportAction(record.action),
      decision: record.decision || record.status || '',
      actorRole: normalizeLaunchApproverRole(record.actorRole),
      actorId: record.actorId || null,
      actorName: record.actorName || null,
      reasonPreview: compactPreview(record.reason),
      archiveId: record.archiveId || null,
      archiveChecksum: record.archiveChecksum || null,
      archiveStatus: record.archiveStatus || null,
      archiveRawLeakCount: record.archiveRawLeakCount ?? null,
      manifestEntryCount: record.manifestEntryCount ?? null,
      retentionDays: record.retentionDays || null,
      expiresAt: record.expiresAt || null,
      dataResidencyRegion: record.dataResidencyRegion || null,
      watermarkRequired: Boolean(record.watermarkRequired),
      downloadAuditRequired: Boolean(record.downloadAuditRequired),
      encryptedStorageRequired: Boolean(record.encryptedStorageRequired),
      encryptedStorageReady: Boolean(record.encryptedStorageReady),
      objectStorageReady: Boolean(record.objectStorageReady),
      productionReady: Boolean(record.productionReady),
      createdAt: record.createdAt || null,
      checksum: record.checksum || null,
    });
  });

  (project.providerUsageLedger || []).forEach((record) => {
    addRecord('provider_usage_ledger', record.id, {
      id: record.id,
      projectId,
      agentId: record.agentId || null,
      kind: record.kind || '',
      operation: record.operation || '',
      provider: record.provider || '',
      model: record.model || null,
      allowed: Boolean(record.allowed),
      wouldDeny: Boolean(record.wouldDeny),
      decisionReason: record.decisionReason || null,
      ok: Boolean(record.ok),
      status: record.status || '',
      costCents: Number(record.costCents) || 0,
      currency: record.policy?.currency || 'USD',
      retryAttemptCount: record.retry?.attemptCount || 0,
      retried: Boolean(record.retry?.retried),
      circuitState: record.circuitBreaker?.state || null,
      circuitOpenUntil: record.circuitBreaker?.openUntil || null,
      evidenceIds: record.evidenceIds || [],
      eventId: record.eventId || null,
      startedAt: record.startedAt || null,
      completedAt: record.completedAt || null,
      policyMode: record.policy?.mode || null,
      policyEnforced: Boolean(record.policy?.enforcementEnabled),
      retryPolicyConfigured: Boolean(record.policy?.retryPolicy?.configured),
      circuitBreakerConfigured: Boolean(record.policy?.circuitBreaker?.configured),
    }, {
      agentId: record.agentId || null,
      eventId: record.eventId || null,
    });
  });

  (accessReplayRecords || []).filter((record) => !projectId || record.projectId === projectId).forEach((record) => {
    addRecord('access_replay_records', record.id || `replay_${persistenceChecksum(record.replayKey || record.requestId || '')}`, {
      id: record.id || null,
      projectId: record.projectId || projectId,
      schemaVersion: record.schemaVersion || 'access-replay-record/v1',
      replayKeyChecksum: persistenceChecksum(record.replayKey || ''),
      routeKey: record.routeKey || null,
      method: record.method || '',
      path: record.path || '',
      role: record.role || null,
      agentId: record.agentId || null,
      userId: record.userId || null,
      requestId: record.requestId || null,
      signedAt: record.signedAt || null,
      acceptedAt: record.acceptedAt || null,
      expiresAt: record.expiresAt || null,
      storage: record.storage || null,
    });
  });

  (securityAuditStreamRecords || []).filter((record) => !projectId || record.projectId === projectId).forEach((record) => {
    addRecord('security_audit_stream', record.streamRecordId || `stream_${record.id}`, {
      id: record.id,
      streamRecordId: record.streamRecordId || null,
      projectId,
      schemaVersion: record.schemaVersion || null,
      streamType: record.streamType || 'security-access',
      streamSequence: record.streamSequence || null,
      streamSource: record.streamSource || null,
      streamChecksum: record.streamChecksum || null,
      previousStreamHash: record.previousStreamHash || null,
      streamHash: record.streamHash || null,
      time: record.time || null,
      method: record.method || '',
      path: record.path || '',
      routeKey: record.routeKey || '',
      sensitivity: record.sensitivity || '',
      enforced: Boolean(record.enforced),
      allowed: Boolean(record.allowed),
      status: record.status || '',
      statusCode: record.statusCode || null,
      actorRole: record.actor?.role || null,
      actorAgentId: record.actor?.agentId || null,
      actorUserId: record.actor?.userId || null,
      replayRequired: Boolean(record.replay?.required),
      replayVerified: Boolean(record.replay?.verified),
      replayDetected: Boolean(record.replay?.detected),
      replayRequestId: record.replay?.requestId || null,
      membershipRequired: Boolean(record.membership?.required),
      membershipVerified: Boolean(record.membership?.verified),
      membershipStatus: record.membership?.status || null,
      membershipReason: record.membership?.reason || null,
      membershipRevision: record.membership?.revision || null,
      membershipPolicyUpdatedAt: record.membership?.updatedAt || null,
      identitySessionRequired: Boolean(record.identitySession?.required),
      identitySessionVerified: Boolean(record.identitySession?.verified),
      identitySessionId: record.identitySession?.sessionId || null,
      identitySessionStatus: record.identitySession?.status || null,
      identitySessionExpiresAt: record.identitySession?.expiresAt || null,
    });
  });

  (project.logs || []).forEach((log, index) => {
    const sourceLogId = log.id || `${projectId}_timeline_log_${index}`;
    const exportLogId = `${sourceLogId}_${index}`;
    addRecord('project_timeline_logs', exportLogId, {
      id: exportLogId,
      sourceLogId,
      projectId,
      time: log.time || null,
      agentId: log.agentId || null,
      eventType: log.eventType || null,
      source: log.source || null,
      channelId: log.channelId || null,
      taskId: log.taskId || null,
      submissionId: log.submissionId || null,
      evidenceSearchId: log.evidenceSearchId || null,
      reviewId: log.reviewId || null,
      artifactType: log.artifactType || null,
      receiptCount: log.receiptCount || 0,
      logPreview: compactPreview(log.log || log.text),
      logChecksum: persistenceChecksum(log.log || log.text || ''),
    });
  });

  (project.tasks || []).forEach((task) => {
    addRecord('project_tasks', task.id, {
      id: task.id,
      projectId,
      textPreview: compactPreview(task.text),
      status: task.status || '',
      assignee: task.assignee || null,
      ownerAgentId: task.ownerAgentId || task.assigneeAgentId || null,
      createdAt: task.createdAt || null,
      lastTouchedAt: task.lastTouchedAt || null,
      completedAt: task.completedAt || null,
    });
    const evidenceBuckets = {
      message: task.evidenceMessageIds || [],
      timelineLog: task.timelineLogIds || [],
      submission: task.submissionIds || [],
      evidenceSearch: task.evidenceSearchIds || [],
      artifact: task.artifactIds || [],
      source: (task.sourceRefs || []).map((source) => source.id || source.url || source.title).filter(Boolean),
    };
    Object.entries(evidenceBuckets).forEach(([kind, ids]) => {
      uniqueStrings(ids || []).forEach((targetId) => addRecord('project_task_evidence_links', `${task.id}_${kind}_${targetId}`, {
        id: `${task.id}_${kind}_${targetId}`,
        projectId,
        taskId: task.id,
        evidenceKind: kind,
        targetId,
      }));
    });
  });

  Object.entries(agentStates).forEach(([agentId, state]) => {
    addRecord('agent_states', `${projectId}_${agentId}`, {
      projectId,
      agentId,
      name: state.name || null,
      role: state.role || null,
      status: state.status || '',
      taskIds: state.taskIds || [],
      nextAgentRunAt: state.nextAgentRunAt || null,
      lastActiveAt: state.lastActiveAt || null,
      currentPlanChecksum: persistenceChecksum(state.currentPlan || {}),
      routineLabel: state.currentPlan?.routine?.label || state.routine?.label || null,
    });
    (state.obligations || []).forEach((obligation, index) => addRecord('agent_obligations', obligation.id || `${projectId}_${agentId}_obligation_${index}`, {
      id: obligation.id || null,
      projectId,
      agentId,
      status: obligation.status || '',
      taskId: obligation.taskId || null,
      submissionId: obligation.submissionId || null,
      reviewId: obligation.reviewId || null,
      sourceMessageId: obligation.sourceMessageId || obligation.messageId || null,
      resolvedAt: obligation.resolvedAt || null,
      resolvedBySubmissionId: obligation.resolvedBySubmissionId || null,
      textPreview: compactPreview(obligation.text || obligation.summary),
    }));
    (state.worklog || []).forEach((entry, index) => {
      const sourceWorklogId = entry.id || `${projectId}_${agentId}_worklog_${index}`;
      const exportWorklogId = `${sourceWorklogId}_${index}`;
      addRecord('agent_worklog_entries', exportWorklogId, {
        id: exportWorklogId,
        sourceWorklogId,
        projectId,
        agentId,
        at: entry.at || entry.time || null,
        kind: entry.kind || '',
        source: entry.source || null,
        taskId: entry.taskId || null,
        submissionId: entry.submissionId || null,
        evidenceSearchId: entry.evidenceSearchId || null,
        sourceMessageId: entry.sourceMessageId || null,
        textPreview: compactPreview(entry.text),
      });
    });
  });

  (project.agentSubmissions || []).forEach((submission) => {
    const relativeArtifactPath = submission.artifact?.relativePath || submission.artifact?.path || submission.workspacePath || null;
    addRecord('agent_submissions', submission.id, {
      id: submission.id,
      projectId,
      agentId: submission.agentId || null,
      taskId: submission.taskId || null,
      artifactType: submission.artifactType || null,
      title: submission.title || '',
      summary: submission.summary || '',
      status: submission.status || '',
      reviewStatus: submission.reviewStatus || '',
      requestedReviewAgentId: submission.requestedReviewAgentId || null,
      revisesSubmissionId: submission.revisesSubmissionId || null,
      respondsToReviewId: submission.respondsToReviewId || null,
      supersedesSubmissionIds: submission.supersedesSubmissionIds || [],
      messageId: submission.messageId || null,
      timelineLogId: submission.timelineLogId || null,
      eventId: submission.eventId || null,
      bodyChecksum: persistenceChecksum(submission.body || ''),
      createdAt: submission.createdAt || null,
      updatedAt: submission.updatedAt || null,
    });
    if (submission.artifact || relativeArtifactPath) {
      addRecord('artifact_files', submission.artifactId || submission.artifact?.id || `artifact_${submission.id}`, {
        id: submission.artifactId || submission.artifact?.id || null,
        projectId,
        submissionId: submission.id,
        artifactType: submission.artifactType || submission.artifact?.artifactType || null,
        relativePath: relativeArtifactPath,
        source: submission.artifact?.source || null,
        existsOnDisk: Boolean(submission.artifact?.existsOnDisk),
        contentChecksum: persistenceChecksum(submission.body || submission.artifact?.content || ''),
        createdAt: submission.artifact?.createdAt || submission.createdAt || null,
      });
    }
  });

  (project.evidenceSearches || []).forEach((record) => {
    addRecord('evidence_searches', record.id, {
      id: record.id,
      projectId,
      agentId: record.agentId || null,
      taskId: record.taskId || null,
      submissionId: record.submissionId || null,
      query: record.query || '',
      purposePreview: compactPreview(record.purpose),
      provider: record.provider || null,
      searchMode: record.searchMode || null,
      status: record.status || '',
      confidence: record.confidence || '',
      evidenceJudgement: record.evidenceJudgement || record.qualitySummary?.judgement || null,
      qualityScore: record.qualityScore || record.qualitySummary?.averageScore || 0,
      sourceSafetyReady: Boolean((record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).sourceSafetyReady),
      sourceSafetyBlockedSourceCount: (record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).blockedSourceCount || 0,
      sourceSafetyReviewSourceCount: (record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || [])).reviewSourceCount || 0,
      sourceCount: record.sources?.length || 0,
      messageId: record.messageId || null,
      timelineLogId: record.timelineLogId || null,
      eventId: record.eventId || null,
      createdAt: record.createdAt || null,
    });
    (record.sources || []).forEach((source, index) => addRecord('evidence_sources', source.id || `${record.id}_source_${index}`, {
      id: source.id || null,
      projectId,
      evidenceSearchId: record.id,
      title: source.title || '',
      kind: source.kind || null,
      url: source.url ? redactUrl(source.url) : null,
      confidence: source.confidence || null,
      qualityScore: source.qualityScore || 0,
      qualityLevel: source.qualityLevel || null,
      judgement: source.judgement || null,
      sourceSafetyLevel: source.sourceSafetyLevel || null,
      sourceSafetyScore: source.sourceSafetyScore || 0,
      sourceSafetyJudgement: source.sourceSafetyJudgement || null,
      sourceSafetySignals: source.sourceSafetySignals || [],
      summaryPreview: compactPreview(source.summary),
    }));
  });

  (project.submissionReviews || []).forEach((review) => {
    addRecord('submission_reviews', review.id, {
      id: review.id,
      projectId,
      submissionId: review.submissionId || null,
      reviewerAgentId: review.reviewerAgentId || null,
      submitterAgentId: review.submitterAgentId || null,
      verdict: review.verdict || '',
      requestedChangeCount: review.requestedChanges?.length || 0,
      commentsPreview: compactPreview(review.comments),
      commentsChecksum: persistenceChecksum(review.comments || ''),
      messageId: review.messageId || null,
      timelineLogId: review.timelineLogId || null,
      eventId: review.eventId || null,
      createdAt: review.createdAt || null,
    });
  });

  workerRunsForProject(project).forEach((run, index) => {
    addRecord('worker_runs', run.id || `${projectId}_worker_${index}`, {
      id: run.id || null,
      projectId,
      workerKind: run.workerKind,
      trigger: run.trigger || null,
      reason: run.reason || run.schedulerReason || null,
      ranAt: run.ranAt || run.time || run.startedAt || null,
      nextRunAt: run.nextRunAt || null,
      agentId: run.agentId || null,
      queueReason: run.queueReason || null,
      idempotencyKey: run.idempotencyKey || null,
      leaseKey: run.leaseKey || null,
      executionStatus: run.executionStatus || null,
      attemptCount: run.retry?.attemptCount || run.attemptCount || 0,
      maxAttempts: run.retry?.maxAttempts || run.maxAttempts || WORKER_QUEUE_MAX_ATTEMPTS,
      retryable: Boolean(run.retry?.retryable),
      deadLettered: Boolean(run.retry?.deadLettered || run.deadLetter),
      deadLetterId: run.deadLetter?.id || null,
      deadLetterReason: run.deadLetter?.reason || null,
      receiptChecksum: run.executionReceipt?.receiptChecksum || null,
      receiptAcked: Boolean(run.executionReceipt?.acked),
      completedAt: run.executionReceipt?.receivedAt || run.completedAt || run.ranAt || null,
      messageIds: run.messageIds || [],
      timelineLogIds: run.timelineLogIds || [run.logId].filter(Boolean),
    });
  });

  [
    ['manager-dashboard', managerDashboard],
    ['manager-flow-graph', managerFlowGraph],
    ['mvp-readiness', mvpReadiness],
    ['security-boundary', securityBoundary],
  ].forEach(([name, model]) => addRecord('read_model_checkpoints', `${projectId}_${name}`, {
    id: `${projectId}_${name}`,
    projectId,
    readModel: name,
    schemaVersion: model.schemaVersion || null,
    status: model.status || model.readiness?.status || null,
    generatedAt: model.generatedAt || nowIso(),
    summaryChecksum: persistenceChecksum(model.summary || model.readiness || {}),
    recordCount: Array.isArray(model.rows) ? model.rows.length : (model.summary?.nodeCount || model.readinessProofMap?.routes?.length || 0),
  }));

  const recordCounts = Object.fromEntries(Object.entries(recordsByTable).map(([table, rows]) => [table, rows.length]));
  const relationIssues = [];
  const tableRecordIds = (table) => new Set((recordsByTable[table] || []).map((record) => String(record.id)));
  const taskIds = tableRecordIds('project_tasks');
  const agentIds = new Set((recordsByTable.agent_states || []).map((record) => String(record.data.agentId || record.refs.agentId || '')));
  const submissionIds = tableRecordIds('agent_submissions');
  const evidenceSearchIds = tableRecordIds('evidence_searches');
  const checkRef = ({ table, record, field, targetSet, optional = true }) => {
    const value = record.data?.[field] || record.refs?.[field];
    if ((value === null || value === undefined || value === '') && optional) return;
    if (!targetSet.has(String(value))) {
      relationIssues.push({
        table,
        recordId: record.id,
        field,
        targetId: value || null,
        issue: 'missing-target-record',
      });
    }
  };
  (recordsByTable.agent_submissions || []).forEach((record) => {
    checkRef({ table: 'agent_submissions', record, field: 'agentId', targetSet: agentIds, optional: false });
    checkRef({ table: 'agent_submissions', record, field: 'taskId', targetSet: taskIds, optional: true });
  });
  (recordsByTable.evidence_searches || []).forEach((record) => {
    checkRef({ table: 'evidence_searches', record, field: 'agentId', targetSet: agentIds, optional: false });
    checkRef({ table: 'evidence_searches', record, field: 'taskId', targetSet: taskIds, optional: true });
    checkRef({ table: 'evidence_searches', record, field: 'submissionId', targetSet: submissionIds, optional: true });
  });
  (recordsByTable.evidence_sources || []).forEach((record) => {
    checkRef({ table: 'evidence_sources', record, field: 'evidenceSearchId', targetSet: evidenceSearchIds, optional: false });
  });
  (recordsByTable.submission_reviews || []).forEach((record) => {
    checkRef({ table: 'submission_reviews', record, field: 'submissionId', targetSet: submissionIds, optional: false });
  });
  (recordsByTable.artifact_files || []).forEach((record) => {
    checkRef({ table: 'artifact_files', record, field: 'submissionId', targetSet: submissionIds, optional: false });
  });
  const missingRequiredTables = tables
    .filter((table) => table.required && !(recordsByTable[table.name] || []).length)
    .map((table) => table.name);
  const eventSequences = (project.eventLedger || []).map((event) => event.sequence).filter((value) => Number.isFinite(value));
  const eventLedgerContiguous = eventSequences.every((value, index) => index === 0 || value === eventSequences[index - 1] + 1);

  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'production-persistence-snapshot/v1',
    storageMode: 'normalized-relational-contract',
    tables,
    recordCounts,
    totalRecordCount: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
    requiredTableCount: tables.filter((table) => table.required).length,
    coveredRequiredTableCount: tables.filter((table) => table.required && (recordsByTable[table.name] || []).length).length,
    integrity: {
      status: missingRequiredTables.length || relationIssues.length || !eventLedgerContiguous ? 'needs-attention' : 'ready',
      missingRequiredTables,
      relationIssueCount: relationIssues.length,
      relationIssues: relationIssues.slice(0, 40),
      eventLedgerContiguous,
      eventLedgerSequenceRange: {
        first: eventSequences[0] || project.eventLedgerFirstSequence || null,
        last: eventSequences[eventSequences.length - 1] || project.eventLedgerLastSequence || null,
        retainedCount: eventSequences.length,
        totalCount: project.eventLedgerEventCount || eventSequences.length,
      },
    },
    migrationPlan: [
      'Create tables and indexes from this table manifest.',
      'Backfill projects, messages, events, logs, tasks, Agent state, submissions, searches, reviews, workers, and read-model checkpoints.',
      'Verify checksums and relationIssues before switching reads from JSON store to managed persistence.',
      'Keep event ledger append-only and regenerate Manager Dashboard / Flow Graph / MVP Readiness from normalized records.',
    ],
    recordsByTable,
  };
}

function sqlIdentifier(value = '') {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^([0-9])/, '_$1')
    || 'unnamed_table';
}

function buildManagedPersistenceMigrationPlan({
  persistenceSnapshot = {},
  projectId = persistenceSnapshot.projectId || null,
} = {}) {
  const tables = persistenceSnapshot.tables || [];
  const recordCounts = persistenceSnapshot.recordCounts || {};
  const requiredMissing = persistenceSnapshot.integrity?.missingRequiredTables || [];
  const criticalTables = [
    'projects',
    'project_membership_policies',
    'project_membership_grants',
    'access_replay_records',
    'security_access_audit',
    'security_audit_stream',
    'project_event_ledger',
    'agent_submissions',
    'evidence_searches',
    'submission_reviews',
    'provider_usage_ledger',
    'worker_runs',
    'read_model_checkpoints',
  ];
  const missingCriticalTables = criticalTables.filter((table) => !(recordCounts[table] > 0));
  const orderedGroups = [
    {
      id: 'foundation',
      label: 'Foundation and membership',
      tables: ['projects', 'project_membership_policies', 'project_membership_grants'],
    },
    {
      id: 'conversation-proof',
      label: 'Conversation, timeline, and event proof',
      tables: ['project_messages', 'project_event_ledger', 'project_timeline_logs'],
    },
    {
      id: 'work-state',
      label: 'Tasks and Agent state',
      tables: ['project_tasks', 'project_task_evidence_links', 'agent_states', 'agent_obligations', 'agent_worklog_entries'],
    },
    {
      id: 'artifact-evidence-review',
      label: 'Submissions, evidence, artifacts, and reviews',
      tables: ['agent_submissions', 'artifact_files', 'evidence_searches', 'evidence_sources', 'submission_reviews'],
    },
    {
      id: 'security-runtime',
      label: 'Security, replay, and runtime operations',
      tables: ['identity_sessions', 'access_replay_records', 'security_access_audit', 'security_audit_stream', 'launch_approvals', 'project_evidence_exports', 'provider_usage_ledger', 'worker_runs'],
    },
    {
      id: 'read-models',
      label: 'Regenerable read-model checkpoints',
      tables: ['read_model_checkpoints'],
    },
  ];
  const tableByName = new Map(tables.map((table) => [table.name, table]));
  const tablePlans = tables.map((table) => {
    const tableName = sqlIdentifier(table.name);
    const primaryKey = (table.primaryKey || ['id']).map(sqlIdentifier);
    const primaryKeySql = primaryKey.length ? `, primary key (${primaryKey.join(', ')})` : '';
    const foreignKeyNotes = (table.foreignKeys || [])
      .map((fk) => `${fk.field} -> ${fk.table}`)
      .join('; ');
    return {
      table: table.name,
      required: Boolean(table.required),
      primaryKey: table.primaryKey || ['id'],
      foreignKeys: table.foreignKeys || [],
      recordCount: recordCounts[table.name] || 0,
      purpose: table.purpose || '',
      backfillReady: !table.required || (recordCounts[table.name] || 0) > 0,
      ddl: [
        `create table if not exists ${tableName} (`,
        '  id text not null,',
        '  project_id text not null,',
        '  refs jsonb not null default \'{}\'::jsonb,',
        '  data jsonb not null default \'{}\'::jsonb,',
        '  checksum text not null,',
        '  imported_at timestamptz not null default now()',
        `  ${primaryKeySql.replace(/^, /, ',')}`,
        ');',
      ].join('\n'),
      rlsDraft: table.name === 'security_audit_stream'
        ? 'security-admin only; immutable append/read audit policy'
        : table.name === 'access_replay_records'
          ? 'runtime/security-admin write; no broad user read; expire by expiresAt'
          : table.name.startsWith('project_membership')
            ? 'security-admin write; manager/security-admin read; row scoped by project_id'
            : 'project member read/write according to role and Agent self-scope; row scoped by project_id',
      indexHints: [
        'project_id',
        table.name.includes('audit') ? 'imported_at' : null,
        table.name.includes('replay') ? 'data->>\'expiresAt\'' : null,
      ].filter(Boolean),
      foreignKeyNotes,
    };
  });
  const migrationBatches = orderedGroups.map((group) => ({
    ...group,
    tables: group.tables.filter((table) => tableByName.has(table)),
    recordCount: group.tables.reduce((sum, table) => sum + (recordCounts[table] || 0), 0),
    ready: group.tables
      .filter((table) => tableByName.get(table)?.required)
      .every((table) => (recordCounts[table] || 0) > 0),
  }));
  const verificationGates = [
    {
      id: 'required-table-coverage',
      passed: requiredMissing.length === 0,
      detail: requiredMissing.length ? `Missing required tables: ${requiredMissing.join(', ')}` : 'All required tables have rows.',
    },
    {
      id: 'relation-integrity',
      passed: (persistenceSnapshot.integrity?.relationIssueCount || 0) === 0,
      detail: `${persistenceSnapshot.integrity?.relationIssueCount || 0} relation issues.`,
    },
    {
      id: 'event-ledger-contiguous',
      passed: Boolean(persistenceSnapshot.integrity?.eventLedgerContiguous),
      detail: `Event sequence range ${persistenceSnapshot.integrity?.eventLedgerSequenceRange?.first || 'n/a'} -> ${persistenceSnapshot.integrity?.eventLedgerSequenceRange?.last || 'n/a'}.`,
    },
    {
      id: 'security-critical-records',
      passed: missingCriticalTables.length === 0,
      detail: missingCriticalTables.length ? `Missing critical rows: ${missingCriticalTables.join(', ')}` : 'Security and product-team critical rows are present.',
    },
    {
      id: 'checksum-export',
      passed: Object.values(persistenceSnapshot.recordsByTable || {}).flat().every((record) => Boolean(record.checksum)),
      detail: 'Every exported row must carry a checksum before import.',
    },
  ];
  const blockers = verificationGates
    .filter((gate) => !gate.passed)
    .map((gate) => ({
      id: gate.id,
      detail: gate.detail,
    }));
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'managed-persistence-migration-plan/v1',
    status: blockers.length ? 'blocked' : 'ready-for-managed-database-pilot',
    target: {
      engine: 'postgres-compatible',
      storagePattern: 'record-envelope-with-jsonb-data-and-checksum',
      productionRequirement: 'replace JSON/file store with managed database, migrations, backups, row-level security, and operational restore tests',
    },
    summary: {
      tableCount: tables.length,
      totalRecordCount: persistenceSnapshot.totalRecordCount || 0,
      requiredTableCount: persistenceSnapshot.requiredTableCount || 0,
      coveredRequiredTableCount: persistenceSnapshot.coveredRequiredTableCount || 0,
      criticalTableCount: criticalTables.length,
      coveredCriticalTableCount: criticalTables.length - missingCriticalTables.length,
      blockerCount: blockers.length,
    },
    seedOrder: migrationBatches.flatMap((batch) => batch.tables),
    migrationBatches,
    tablePlans,
    verificationGates,
    blockers,
    cutoverPlan: [
      'Export production-persistence-snapshot/v1 from the file-backed backend.',
      'Create the managed database tables and indexes from tablePlans.',
      'Backfill batches in seedOrder and verify per-row checksums.',
      'Enable project-scoped row-level policies for membership, Agent self-scope, security audit, and runtime workers.',
      'Run the product-team acceptance Harness against the managed backend before allowing pilot traffic.',
    ],
    sourceSnapshot: {
      schemaVersion: persistenceSnapshot.schemaVersion || null,
      integrityStatus: persistenceSnapshot.integrity?.status || 'unknown',
      persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
    },
  };
}

function buildManagedPersistenceDryRunVerification({
  persistenceSnapshot = {},
  migrationPlan = {},
  projectId = persistenceSnapshot.projectId || migrationPlan.projectId || null,
} = {}) {
  const recordsByTable = persistenceSnapshot.recordsByTable || {};
  const tablePlans = migrationPlan.tablePlans || [];
  const tablePlanByName = new Map(tablePlans.map((plan) => [plan.table, plan]));
  const seedOrder = migrationPlan.seedOrder || tablePlans.map((plan) => plan.table);
  const sourceTablesWithRows = Object.entries(recordsByTable)
    .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
    .map(([table]) => table);
  const missingSeedTables = sourceTablesWithRows.filter((table) => !seedOrder.includes(table));
  const unknownSeedTables = seedOrder.filter((table) => !tablePlanByName.has(table));
  const simulatedTables = new Map();
  tablePlans.forEach((plan) => {
    simulatedTables.set(plan.table, {
      table: plan.table,
      primaryKey: Array.isArray(plan.primaryKey) && plan.primaryKey.length ? plan.primaryKey : ['id'],
      rows: [],
      ids: new Set(),
      rlsDraft: plan.rlsDraft || '',
    });
  });
  const primaryKeyValueForRecord = (record, primaryKey = ['id']) => primaryKey
    .map((field) => {
      if (field === 'id') return record.id;
      if (field === 'projectId') return record.projectId || record.data?.projectId || record.refs?.projectId;
      return record.data?.[field] ?? record.refs?.[field] ?? record[field];
    })
    .map((value) => String(value ?? ''))
    .join('::');

  const duplicateRows = [];
  const checksumMissingRows = [];
  const importedRows = [];
  const importBatches = seedOrder.map((table, batchIndex) => {
    const target = simulatedTables.get(table);
    const rows = recordsByTable[table] || [];
    const importedIds = [];
    if (!target) {
      return {
        batchIndex,
        table,
        rowCount: rows.length,
        imported: false,
        reason: 'missing-table-plan',
      };
    }
    rows.forEach((record) => {
      const primaryKeyValue = primaryKeyValueForRecord(record, target.primaryKey);
      if (target.ids.has(primaryKeyValue)) {
        duplicateRows.push({ table, primaryKey: target.primaryKey, primaryKeyValue, id: record.id });
      }
      if (!record.checksum) {
        checksumMissingRows.push({ table, id: record.id });
      }
      const imported = {
        ...record,
        importedPrimaryKey: primaryKeyValue,
        importedChecksum: record.checksum || null,
      };
      target.ids.add(primaryKeyValue);
      target.rows.push(imported);
      importedRows.push(imported);
      importedIds.push(primaryKeyValue);
    });
    return {
      batchIndex,
      table,
      rowCount: rows.length,
      imported: true,
      checksumCount: rows.filter((record) => Boolean(record.checksum)).length,
      firstRecordId: importedIds[0] || null,
      lastRecordId: importedIds[importedIds.length - 1] || null,
    };
  });
  const importedRecordCount = importedRows.length;
  const expectedRecordCount = persistenceSnapshot.totalRecordCount || Object.values(recordsByTable)
    .reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
  const importedTableCounts = Object.fromEntries([...simulatedTables.entries()]
    .map(([table, state]) => [table, state.rows.length]));
  const rlsMissingTables = tablePlans
    .filter((plan) => !plan.rlsDraft)
    .map((plan) => plan.table);
  const migrationPlanFailedGates = (migrationPlan.verificationGates || [])
    .filter((gate) => !gate.passed)
    .map((gate) => gate.id);
  const gates = [
    {
      id: 'adapter-contract',
      passed: tablePlans.length > 0 && seedOrder.length > 0,
      detail: `${tablePlans.length} table plans and ${seedOrder.length} seed steps available.`,
    },
    {
      id: 'schema-plan-created',
      passed: unknownSeedTables.length === 0,
      detail: unknownSeedTables.length ? `Unknown seed tables: ${unknownSeedTables.join(', ')}` : 'Every seed table has a table plan.',
    },
    {
      id: 'seed-order-coverage',
      passed: missingSeedTables.length === 0,
      detail: missingSeedTables.length ? `Rows not covered by seed order: ${missingSeedTables.join(', ')}` : 'Seed order covers every source table with rows.',
    },
    {
      id: 'row-import-count',
      passed: importedRecordCount === expectedRecordCount,
      detail: `Imported ${importedRecordCount} of ${expectedRecordCount} records.`,
    },
    {
      id: 'checksum-preserved',
      passed: checksumMissingRows.length === 0 && importedRows.every((record) => record.importedChecksum === record.checksum),
      detail: checksumMissingRows.length ? `${checksumMissingRows.length} records missing checksums.` : 'All imported records preserve source checksums.',
    },
    {
      id: 'primary-key-uniqueness',
      passed: duplicateRows.length === 0,
      detail: duplicateRows.length ? `${duplicateRows.length} duplicate primary keys found during import.` : 'No duplicate primary keys found during dry-run import.',
    },
    {
      id: 'relation-integrity',
      passed: (persistenceSnapshot.integrity?.relationIssueCount || 0) === 0,
      detail: `${persistenceSnapshot.integrity?.relationIssueCount || 0} relation issues from source snapshot.`,
    },
    {
      id: 'rls-policy-drafts',
      passed: rlsMissingTables.length === 0,
      detail: rlsMissingTables.length ? `Tables missing RLS guidance: ${rlsMissingTables.join(', ')}` : 'Every table plan includes RLS guidance.',
    },
    {
      id: 'migration-plan-gates',
      passed: migrationPlanFailedGates.length === 0,
      detail: migrationPlanFailedGates.length ? `Migration plan failed gates: ${migrationPlanFailedGates.join(', ')}` : 'All migration-plan gates pass.',
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'managed-persistence-dry-run/v1',
    status: failedGates.length ? 'failed' : 'passed',
    adapterContract: {
      schemaVersion: 'managed-persistence-adapter-contract/v1',
      purpose: 'Minimum database adapter surface required before replacing the local JSON/file store.',
      methods: [
        'createSchema(tablePlans)',
        'beginImport(projectId)',
        'importBatch(table, rows)',
        'verifyChecksums(projectId)',
        'verifyRelations(projectId)',
        'verifyRowLevelPolicies(projectId)',
        'commitDryRun(projectId)',
        'rollbackDryRun(projectId)',
      ],
    },
    source: {
      persistenceSnapshotSchemaVersion: persistenceSnapshot.schemaVersion || null,
      migrationPlanSchemaVersion: migrationPlan.schemaVersion || null,
      persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      migrationPlanRoute: projectId ? `/projects/${projectId}/persistence-migration-plan` : null,
    },
    summary: {
      tablePlanCount: tablePlans.length,
      seedStepCount: seedOrder.length,
      expectedRecordCount,
      importedRecordCount,
      importedTableCount: Object.values(importedTableCounts).filter((count) => count > 0).length,
      failedGateCount: failedGates.length,
    },
    importedTableCounts,
    importBatches,
    gates,
    failedGates,
    nextRequiredAdapterWork: failedGates.length
      ? 'Fix failed gates before implementing a managed database adapter.'
      : 'Implement the adapter contract against a managed Postgres database and run this dry-run against exported snapshot rows before pilot traffic.',
  };
}

function buildManagedPersistenceAdapterPlan({
  persistenceSnapshot = {},
  migrationPlan = {},
  migrationDryRun = {},
  projectId = persistenceSnapshot.projectId || migrationPlan.projectId || null,
} = {}) {
  const adapterStatus = managedPersistenceAdapterStatus();
  const recordsByTable = persistenceSnapshot.recordsByTable || {};
  const recordCounts = persistenceSnapshot.recordCounts || Object.fromEntries(Object.entries(recordsByTable)
    .map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
  const tablePlans = migrationPlan.tablePlans || [];
  const tablePlanNames = new Set(tablePlans.map((plan) => plan.table));
  const criticalAdapterTables = [
    'projects',
    'project_messages',
    'project_event_ledger',
    'project_timeline_logs',
    'project_tasks',
    'agent_states',
    'agent_submissions',
    'evidence_searches',
    'submission_reviews',
    'project_membership_policies',
    'access_replay_records',
    'security_access_audit',
    'security_audit_stream',
    'provider_usage_ledger',
    'worker_runs',
    'read_model_checkpoints',
  ];
  const missingCriticalTables = criticalAdapterTables.filter((table) => (recordCounts[table] || 0) <= 0);
  const missingCriticalTablePlans = criticalAdapterTables.filter((table) => !tablePlanNames.has(table));
  const rlsMissingTables = tablePlans.filter((plan) => !plan.rlsDraft).map((plan) => plan.table);
  const auditRows = recordsByTable.security_audit_stream || [];
  const auditHashReady = auditRows.length > 0
    && auditRows.every((record) => record.data?.previousStreamHash && record.data?.streamHash && record.data?.streamChecksum);
  const adapterContract = {
    schemaVersion: 'managed-persistence-adapter-contract/v2',
    purpose: 'Minimum managed database adapter surface required before replacing the JSON/file store.',
    methods: [
      'connect(connectionConfig)',
      'createSchema(tablePlans)',
      'beginTransaction(projectId)',
      'importBatch(table, rows)',
      'readTable(table, projectId)',
      'appendProjectEvent(eventRecord)',
      'appendSecurityAuditStream(streamRecord)',
      'writeAccessReplayRecord(replayRecord)',
      'writeReadModelCheckpoint(checkpoint)',
      'verifyChecksums(projectId)',
      'verifyRelations(projectId)',
      'verifyRowLevelPolicies(projectId)',
      'createBackup(projectId)',
      'restoreBackup(projectId, backupId)',
      'compareShadowRead(projectId)',
      'commitCutover(projectId)',
      'rollbackCutover(projectId)',
    ],
  };
  const rlsPolicyPlan = tablePlans.map((plan) => ({
    table: plan.table,
    status: plan.rlsDraft ? 'drafted' : 'missing',
    policy: plan.rlsDraft || null,
    projectScoped: Boolean((plan.indexHints || []).includes('project_id') || plan.foreignKeys?.some((fk) => fk.field === 'projectId')),
  }));
  const shadowReadPlan = [
    { id: 'project-state', route: projectId ? `/projects/${projectId}` : null, tables: ['projects', 'agent_states', 'project_tasks'] },
    { id: 'conversation-proof', route: projectId ? `/projects/${projectId}/messages` : null, tables: ['project_messages', 'project_event_ledger', 'project_timeline_logs'] },
    { id: 'agent-workflow-proof', route: projectId ? `/projects/${projectId}/manager-ready-package` : null, tables: ['agent_submissions', 'evidence_searches', 'submission_reviews', 'read_model_checkpoints'] },
    { id: 'runtime-security-proof', route: projectId ? `/projects/${projectId}/operations-readiness` : null, tables: ['worker_runs', 'project_membership_policies', 'identity_sessions', 'access_replay_records', 'security_access_audit', 'security_audit_stream', 'provider_usage_ledger'] },
  ].map((row) => ({
    ...row,
    expectedRecordCount: row.tables.reduce((sum, table) => sum + (recordCounts[table] || 0), 0),
    ready: row.tables.every((table) => (recordCounts[table] || 0) > 0 && tablePlanNames.has(table)),
  }));
  const backupRestorePlan = [
    {
      id: 'pre-cutover-backup',
      action: 'Create a full managed database backup before freezing writes.',
      requiredBefore: 'freeze-writes',
    },
    {
      id: 'post-import-restore-drill',
      action: 'Restore the backup into an isolated database namespace and compare checksums.',
      requiredBefore: 'shadow-read',
    },
    {
      id: 'rollback-restore',
      action: 'Keep the JSON/file store as source of truth until restore parity and rollback are verified.',
      requiredBefore: 'commit-cutover',
    },
  ];
  const cutoverStages = [
    { id: 'schema-ready', label: 'Create schema and RLS drafts', requires: ['managed-persistence-migration-plan/v1'] },
    { id: 'import-dry-run', label: 'Import snapshot in dry-run transaction', requires: ['managed-persistence-dry-run/v1'] },
    { id: 'backup-restore-drill', label: 'Create and restore a backup before writes move', requires: ['managed-persistence-adapter-contract/v2'] },
    { id: 'shadow-read', label: 'Compare file-store reads with managed adapter reads', requires: ['compareShadowRead(projectId)'] },
    { id: 'freeze-writes', label: 'Freeze JSON/file writes and drain worker queue leases', requires: ['operations-readiness/v1'] },
    { id: 'promote-adapter', label: 'Promote managed adapter behind the service facade', requires: ['commitCutover(projectId)'] },
    { id: 'rollback-ready', label: 'Keep rollback to JSON/file store available until pilot stabilizes', requires: ['rollbackCutover(projectId)'] },
  ];
  const gates = [
    {
      id: 'migration-plan-ready',
      passed: migrationPlan.status === 'ready-for-managed-database-pilot',
      detail: `Migration plan status ${migrationPlan.status || 'unknown'}.`,
    },
    {
      id: 'migration-dry-run-passed',
      passed: migrationDryRun.status === 'passed',
      detail: `Migration dry-run status ${migrationDryRun.status || 'unknown'}.`,
    },
    {
      id: 'source-snapshot-ready',
      passed: persistenceSnapshot.schemaVersion === 'production-persistence-snapshot/v1'
        && persistenceSnapshot.integrity?.status === 'ready'
        && (persistenceSnapshot.totalRecordCount || 0) > 0,
      detail: `${persistenceSnapshot.totalRecordCount || 0} record(s), integrity ${persistenceSnapshot.integrity?.status || 'unknown'}.`,
    },
    {
      id: 'critical-table-coverage',
      passed: missingCriticalTables.length === 0 && missingCriticalTablePlans.length === 0,
      detail: missingCriticalTables.length || missingCriticalTablePlans.length
        ? `Missing critical rows: ${missingCriticalTables.join(', ') || 'none'}; missing plans: ${missingCriticalTablePlans.join(', ') || 'none'}.`
        : 'Critical runtime, security, provider, worker, and read-model tables are covered.',
    },
    {
      id: 'adapter-method-contract',
      passed: adapterContract.methods.length >= 12,
      detail: `${adapterContract.methods.length} adapter method(s) required.`,
    },
    {
      id: 'rls-policy-drafts',
      passed: rlsMissingTables.length === 0,
      detail: rlsMissingTables.length ? `Tables missing RLS guidance: ${rlsMissingTables.join(', ')}` : 'Every table plan includes RLS guidance.',
    },
    {
      id: 'audit-stream-continuity',
      passed: auditHashReady,
      detail: `${auditRows.length} audit stream row(s), hash chain columns ${auditHashReady ? 'ready' : 'missing'}.`,
    },
    {
      id: 'shadow-read-plan',
      passed: shadowReadPlan.every((row) => row.ready),
      detail: `${shadowReadPlan.filter((row) => row.ready).length}/${shadowReadPlan.length} shadow-read group(s) ready.`,
    },
    {
      id: 'backup-restore-manifest',
      passed: backupRestorePlan.length >= 3,
      detail: `${backupRestorePlan.length} backup/restore step(s).`,
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'managed-persistence-adapter-plan/v1',
    status: failedGates.length ? 'blocked' : 'ready-for-managed-adapter-pilot',
    target: {
      engine: 'managed-postgres-compatible',
      adapterPattern: 'transactional-record-envelope-with-shadow-read-and-rollback',
      productionRequirement: 'replace JSON/file store with managed database adapter, transactional writes, RLS, backups, restore drills, and cutover rollback controls',
    },
    adapterContract,
    adapterStatus,
    rlsPolicyPlan,
    shadowReadPlan,
    backupRestorePlan,
    cutoverStages,
    verificationGates: gates,
    blockers: failedGates.map((gate) => ({ id: gate.id, detail: gate.detail })),
    summary: {
      tablePlanCount: tablePlans.length,
      criticalTableCount: criticalAdapterTables.length,
      missingCriticalTableCount: missingCriticalTables.length + missingCriticalTablePlans.length,
      adapterMethodCount: adapterContract.methods.length,
      shadowReadGroupCount: shadowReadPlan.length,
      readyShadowReadGroupCount: shadowReadPlan.filter((row) => row.ready).length,
      backupRestoreStepCount: backupRestorePlan.length,
      cutoverStageCount: cutoverStages.length,
      gateCount: gates.length,
      failedGateCount: failedGates.length,
      adapterDriver: adapterStatus.driver,
      adapterProductionCutoverReady: Boolean(adapterStatus.productionCutoverReady),
    },
    source: {
      persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      migrationPlanRoute: projectId ? `/projects/${projectId}/persistence-migration-plan` : null,
      migrationDryRunRoute: projectId ? `/projects/${projectId}/persistence-migration-dry-run` : null,
    },
  };
}

function buildManagedPersistenceAdapterDryRunVerification({
  persistenceSnapshot = {},
  migrationPlan = {},
  migrationDryRun = {},
  adapterPlan = {},
  projectId = persistenceSnapshot.projectId || adapterPlan.projectId || null,
} = {}) {
  const recordsByTable = persistenceSnapshot.recordsByTable || {};
  const recordCounts = persistenceSnapshot.recordCounts || Object.fromEntries(Object.entries(recordsByTable)
    .map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]));
  const seedOrder = migrationPlan.seedOrder || Object.keys(recordsByTable);
  const { adapter, status: adapterStatus } = createManagedPersistenceAdapterFromEnv();
  const connectReceipt = adapter.connect({
    target: adapterStatus.sourceKind === 'local-shadow' ? 'local-shadow' : 'external-adapter-shadow',
    dsn: adapterStatus.databaseUrlConfigured ? 'configured' : '',
  });
  const schemaReceipt = adapter.createSchema(migrationPlan.tablePlans || []);
  const transactionReceipt = adapter.beginTransaction(projectId);
  const importReceipts = seedOrder.map((table) => adapter.importBatch(table, recordsByTable[table] || []));
  const checksumReceipt = adapter.verifyChecksums(projectId, recordsByTable);
  const relationReceipt = adapter.verifyRelations(projectId);
  const rlsReceipt = adapter.verifyRowLevelPolicies(migrationPlan.tablePlans || []);
  const backupReceipt = adapter.createBackup(projectId);
  const probeWriteReceipt = adapter.appendProjectEvent({
    id: `adapter_probe_event_${projectId || 'project'}`,
    projectId,
    data: {
      id: `adapter_probe_event_${projectId || 'project'}`,
      projectId,
      eventType: 'managed-persistence-adapter-probe',
      createdAt: nowIso(),
    },
  });
  const restoreReceipt = adapter.restoreBackup(projectId, backupReceipt.backupId);
  const shadowReadReceipt = adapter.compareShadowRead(projectId, adapterPlan.shadowReadPlan || [], recordsByTable);
  const preRollbackExecutionReceipt = adapter.executionReceipt(projectId);
  const rollbackReceipt = adapter.rollbackCutover(projectId);
  const adapterExecutionReceipt = adapter.executionReceipt(projectId);
  const importedTableCounts = preRollbackExecutionReceipt.tableCounts || migrationDryRun.importedTableCounts || {};
  const shadowReads = (shadowReadReceipt.rows || []).map((row) => ({
    ...row,
    importedRecordCount: row.adapterRecordCount,
  }));
  const transactionProbe = {
    schemaVersion: 'managed-persistence-transaction-probe/v1',
    beginSupported: Boolean(adapterPlan.adapterContract?.methods?.includes('beginTransaction(projectId)')),
    rollbackSupported: Boolean(adapterPlan.adapterContract?.methods?.includes('rollbackCutover(projectId)')),
    commitSupported: Boolean(adapterPlan.adapterContract?.methods?.includes('commitCutover(projectId)')),
    transactionId: transactionReceipt.transactionId || null,
    testWriteCount: probeWriteReceipt.rowCount || 1,
    rolledBackWriteCount: rollbackReceipt.rolledBack ? (probeWriteReceipt.rowCount || 1) : 0,
    postRollbackRecordCount: Object.values(adapterExecutionReceipt.tableCounts || {}).reduce((sum, count) => sum + count, 0),
    backupRestored: Boolean(restoreReceipt.restored),
    checksum: persistenceChecksum({
      projectId,
      recordCount: persistenceSnapshot.totalRecordCount || 0,
      migrationDryRunStatus: migrationDryRun.status || 'unknown',
      adapterExecutionChecksum: preRollbackExecutionReceipt.checksum,
    }),
  };
  const backupRestoreProbe = {
    schemaVersion: 'managed-persistence-backup-restore-probe/v1',
    plannedStepCount: adapterPlan.backupRestorePlan?.length || 0,
    backupManifestReady: (adapterPlan.backupRestorePlan?.length || 0) >= 3,
    backupId: backupReceipt.backupId || null,
    backupCreated: Boolean(backupReceipt.backupId),
    backupRestored: Boolean(restoreReceipt.restored),
    restoreParityChecksum: persistenceChecksum({
      recordCounts,
      tableCount: Object.keys(recordCounts).length,
      totalRecordCount: persistenceSnapshot.totalRecordCount || 0,
      adapterExecutionChecksum: preRollbackExecutionReceipt.checksum,
    }),
  };
  const auditRows = recordsByTable.security_audit_stream || [];
  const auditProbe = {
    schemaVersion: 'managed-persistence-audit-cutover-probe/v1',
    rowCount: auditRows.length,
    hashChainReady: auditRows.length > 0
      && auditRows.every((record) => record.data?.previousStreamHash && record.data?.streamHash && record.data?.streamChecksum),
    latestStreamHash: auditRows.at(-1)?.data?.streamHash || null,
  };
  const readModelProbe = {
    schemaVersion: 'managed-persistence-read-model-probe/v1',
    checkpointCount: recordCounts.read_model_checkpoints || 0,
    expectedReadModels: ['manager-dashboard', 'manager-flow-graph', 'mvp-readiness', 'security-boundary'],
    checkpointNames: (recordsByTable.read_model_checkpoints || []).map((record) => record.data?.readModel).filter(Boolean),
  };
  const failedPlanGates = (adapterPlan.verificationGates || [])
    .filter((gate) => !gate.passed)
    .map((gate) => gate.id);
  const gates = [
    {
      id: 'adapter-driver-status',
      passed: adapterStatus.executableInCurrentRuntime
        && (!adapterStatus.requireRealAdapter || adapterStatus.productionCutoverReady),
      detail: adapterStatus.requireRealAdapter
        ? `${adapterStatus.driver} requires real adapter cutover; production ready ${adapterStatus.productionCutoverReady ? 'yes' : 'no'}.`
        : `${adapterStatus.driver} driver status ${adapterStatus.status}; local MVP may use shadow execution while production remains blocked.`,
    },
    {
      id: 'adapter-execution-receipt',
      passed: adapterExecutionReceipt.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1'
        && adapterExecutionReceipt.connected
        && adapterExecutionReceipt.operationCount >= 8
        && Boolean(adapterExecutionReceipt.checksum),
      detail: `${adapterExecutionReceipt.operationCount || 0} adapter operation receipt(s), engine ${adapterExecutionReceipt.engine || 'unknown'}.`,
    },
    {
      id: 'adapter-contract',
      passed: adapterPlan.adapterContract?.schemaVersion === 'managed-persistence-adapter-contract/v2'
        && (adapterPlan.adapterContract?.methods || []).length >= 12,
      detail: `${adapterPlan.adapterContract?.methods?.length || 0} adapter method(s).`,
    },
    {
      id: 'adapter-plan-gates',
      passed: failedPlanGates.length === 0,
      detail: failedPlanGates.length ? `Adapter plan failed gates: ${failedPlanGates.join(', ')}` : 'All adapter-plan gates pass.',
    },
    {
      id: 'migration-import-parity',
      passed: migrationDryRun.status === 'passed'
        && Object.entries(recordCounts).every(([table, count]) => (importedTableCounts[table] || 0) === count),
      detail: `Migration dry-run ${migrationDryRun.status || 'unknown'}; adapter imported ${Object.keys(importedTableCounts).length} table(s).`,
    },
    {
      id: 'shadow-read-parity',
      passed: shadowReads.length > 0 && shadowReads.every((row) => row.parityReady),
      detail: `${shadowReads.filter((row) => row.parityReady).length}/${shadowReads.length} shadow-read group(s) have parity.`,
    },
    {
      id: 'transaction-rollback',
      passed: transactionProbe.beginSupported
        && transactionProbe.rollbackSupported
        && transactionProbe.commitSupported
        && transactionProbe.backupRestored
        && transactionProbe.testWriteCount === transactionProbe.rolledBackWriteCount,
      detail: `${transactionProbe.rolledBackWriteCount}/${transactionProbe.testWriteCount} probe write(s) rolled back after backup restore.`,
    },
    {
      id: 'backup-restore-probe',
      passed: backupRestoreProbe.backupManifestReady
        && backupRestoreProbe.backupCreated
        && backupRestoreProbe.backupRestored
        && Boolean(backupRestoreProbe.restoreParityChecksum),
      detail: `${backupRestoreProbe.plannedStepCount} backup/restore step(s), restored ${backupRestoreProbe.backupRestored ? 'yes' : 'no'}, checksum ${backupRestoreProbe.restoreParityChecksum}.`,
    },
    {
      id: 'audit-stream-cutover',
      passed: auditProbe.hashChainReady,
      detail: `${auditProbe.rowCount} audit stream row(s), hash chain ${auditProbe.hashChainReady ? 'ready' : 'missing'}.`,
    },
    {
      id: 'read-model-checkpoint-parity',
      passed: readModelProbe.expectedReadModels.every((name) => readModelProbe.checkpointNames.includes(name)),
      detail: `${readModelProbe.checkpointCount} checkpoint row(s): ${readModelProbe.checkpointNames.join(', ') || 'none'}.`,
    },
    {
      id: 'rls-policy-coverage',
      passed: (adapterPlan.rlsPolicyPlan || []).length > 0
        && (adapterPlan.rlsPolicyPlan || []).every((row) => row.status === 'drafted'),
      detail: `${(adapterPlan.rlsPolicyPlan || []).filter((row) => row.status === 'drafted').length}/${(adapterPlan.rlsPolicyPlan || []).length} RLS draft(s).`,
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'managed-persistence-adapter-dry-run/v1',
    status: failedGates.length ? 'failed' : 'passed',
    adapterContract: adapterPlan.adapterContract || null,
    adapterExecution: {
      schemaVersion: 'managed-persistence-adapter-shadow-execution/v1',
      implementationSchemaVersion: adapter.schemaVersion,
      engine: adapterExecutionReceipt.engine,
      adapterStatus,
      connectReceipt,
      schemaReceipt,
      importReceipts,
      checksumReceipt,
      relationReceipt,
      rlsReceipt,
      backupReceipt,
      restoreReceipt,
      shadowReadReceipt,
      rollbackReceipt,
      preRollbackReceipt: preRollbackExecutionReceipt,
      finalReceipt: adapterExecutionReceipt,
    },
    source: {
      persistenceSnapshotSchemaVersion: persistenceSnapshot.schemaVersion || null,
      migrationPlanSchemaVersion: migrationPlan.schemaVersion || null,
      migrationDryRunSchemaVersion: migrationDryRun.schemaVersion || null,
      adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
      persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      adapterPlanRoute: projectId ? `/projects/${projectId}/persistence-adapter-plan` : null,
    },
    summary: {
      shadowReadGroupCount: shadowReads.length,
      shadowReadParityCount: shadowReads.filter((row) => row.parityReady).length,
      transactionRollbackReady: gates.find((gate) => gate.id === 'transaction-rollback')?.passed || false,
      backupRestoreReady: gates.find((gate) => gate.id === 'backup-restore-probe')?.passed || false,
      auditStreamCutoverReady: auditProbe.hashChainReady,
      readModelCheckpointCount: readModelProbe.checkpointCount,
      adapterOperationCount: adapterExecutionReceipt.operationCount || 0,
      adapterImportedTableCount: Object.values(importedTableCounts).filter((count) => count > 0).length,
      adapterDriver: adapterStatus.driver,
      adapterStatus: adapterStatus.status,
      adapterProductionCutoverReady: Boolean(adapterStatus.productionCutoverReady),
      failedGateCount: failedGates.length,
    },
    shadowReads,
    transactionProbe,
    backupRestoreProbe,
    auditProbe,
    readModelProbe,
    gates,
    failedGates,
    nextRequiredAdapterWork: failedGates.length
      ? 'Fix failed managed persistence adapter gates before database cutover.'
      : 'Implement this adapter contract against the managed database, then rerun the product-team Harness in shadow-read mode before pilot traffic.',
  };
}

function adapterGatewayHeadersFromEnv(env = globalThis.process?.env || {}) {
  const token = String(
    env.ADAPTER_GATEWAY_AUTH_TOKEN
    || env.MANAGED_PERSISTENCE_HTTP_TOKEN
    || env.WORKER_QUEUE_HTTP_TOKEN
    || ''
  ).trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function adapterGatewayTimeoutMsFromEnv(env = globalThis.process?.env || {}) {
  const value = Number(env.ADAPTER_GATEWAY_TIMEOUT_MS || env.MANAGED_PERSISTENCE_HTTP_TIMEOUT_MS || env.WORKER_QUEUE_HTTP_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : 8000;
}

function adapterGatewayEndpointFromEnv(env = globalThis.process?.env || {}) {
  return String(
    env.ADAPTER_GATEWAY_HTTP_ENDPOINT
    || env.MANAGED_PERSISTENCE_HTTP_ENDPOINT
    || env.WORKER_QUEUE_HTTP_ENDPOINT
    || ''
  ).trim();
}

function buildAdapterGatewayConfigPreflight({
  projectId = null,
  env = globalThis.process?.env || {},
  managedPersistenceStatus = managedPersistenceAdapterStatus(env),
  workerQueueStatus = workerQueueAdapterStatus(env),
  now = nowIso(),
} = {}) {
  const endpoint = adapterGatewayEndpointFromEnv(env);
  const endpointConfigured = Boolean(endpoint);
  const localShadowReady = managedPersistenceStatus.driver === 'local-shadow' && workerQueueStatus.driver === 'local-shadow';
  const gatewayMode = endpointConfigured ? 'http-json-gateway' : 'local-shadow';
  const gates = [
    {
      id: 'gateway-mode-explicit',
      label: 'Adapter gateway mode is explicit',
      passed: endpointConfigured || localShadowReady,
      detail: endpointConfigured
        ? 'External http-json gateway endpoint is configured for live preflight.'
        : 'No external gateway endpoint is configured; local-shadow adapters are the current private-pilot rehearsal path.',
      severity: endpointConfigured ? 'blocker' : 'info',
    },
    {
      id: 'persistence-adapter-compatible',
      label: 'Persistence adapter is gateway compatible',
      passed: endpointConfigured
        ? ['http-json', 'local-shadow'].includes(managedPersistenceStatus.driver)
        : managedPersistenceStatus.driver === 'local-shadow',
      detail: `Managed persistence driver ${managedPersistenceStatus.driver || 'unknown'} / ${managedPersistenceStatus.status || 'unknown'}.`,
      severity: 'blocker',
    },
    {
      id: 'queue-adapter-compatible',
      label: 'Queue adapter is gateway compatible',
      passed: endpointConfigured
        ? ['http-json', 'local-shadow'].includes(workerQueueStatus.driver)
        : workerQueueStatus.driver === 'local-shadow',
      detail: `Worker queue driver ${workerQueueStatus.driver || 'unknown'} / ${workerQueueStatus.status || 'unknown'}.`,
      severity: 'blocker',
    },
    {
      id: 'production-cutover-blocked',
      label: 'Gateway preflight does not approve production cutover',
      passed: true,
      detail: 'Adapter gateway preflight is a private-pilot rehearsal; real production cutover still needs managed infrastructure approval.',
      severity: 'blocker',
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  const checksum = persistenceChecksum({
    projectId,
    gatewayMode,
    endpointConfigured,
    gates: gates.map((gate) => [gate.id, gate.passed]),
    managedPersistenceDriver: managedPersistenceStatus.driver,
    workerQueueDriver: workerQueueStatus.driver,
  });
  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'adapter-gateway-preflight/v1',
    status: failedGates.length
      ? 'adapter-gateway-preflight-blocked'
      : endpointConfigured
        ? 'adapter-gateway-configured-live-check-required'
        : 'local-shadow-adapter-gateway-preflight-ready',
    gatewayMode,
    endpointConfigured,
    endpoint: endpointConfigured ? redactUrl(endpoint) : null,
    bearerAuthConfigured: Object.keys(adapterGatewayHeadersFromEnv(env)).length > 0,
    liveGatewayReady: false,
    privateGatewayReady: failedGates.length === 0 && (endpointConfigured || localShadowReady),
    productionCutoverReady: false,
    readyForProduction: false,
    managedPersistence: redactSensitiveObject(managedPersistenceStatus || {}),
    workerQueue: redactSensitiveObject(workerQueueStatus || {}),
    health: null,
    state: null,
    gates,
    failedGates,
    backendRoutes: {
      adapterGatewayPreflight: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
      persistenceAdapterDryRun: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
      workerQueueAdapterDryRun: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
      deploymentPreflight: projectId ? `/projects/${projectId}/deployment-preflight` : null,
    },
    summary: {
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: failedGates.length,
      gatewayMode,
      endpointConfigured,
      bearerAuthConfigured: Object.keys(adapterGatewayHeadersFromEnv(env)).length > 0,
      liveGatewayReady: false,
      stateReadable: false,
      capabilityCount: 0,
      productionCutoverReady: false,
      checksum,
    },
    checksum,
    nextRequiredAdapterWork: endpointConfigured
      ? 'Call this route through the async API path to prove live gateway health, capabilities, and state readability.'
      : 'Configure ADAPTER_GATEWAY_HTTP_ENDPOINT for external gateway rehearsal, or keep local-shadow adapters for private-pilot validation.',
  };
}

async function buildAdapterGatewayLivePreflight({
  projectId = null,
  env = globalThis.process?.env || {},
  managedPersistenceStatus = managedPersistenceAdapterStatus(env),
  workerQueueStatus = workerQueueAdapterStatus(env),
} = {}) {
  const configPreflight = buildAdapterGatewayConfigPreflight({
    projectId,
    env,
    managedPersistenceStatus,
    workerQueueStatus,
  });
  const endpoint = adapterGatewayEndpointFromEnv(env);
  if (!endpoint) return configPreflight;

  try {
    const client = createHttpJsonAdapterGatewayClient({
      baseUrl: endpoint,
      timeoutMs: adapterGatewayTimeoutMsFromEnv(env),
      headers: adapterGatewayHeadersFromEnv(env),
    });
    const health = await client.health();
    const state = await client.state();
    const capabilities = health.body?.capabilities || [];
    const gates = [
      {
        id: 'gateway-endpoint-configured',
        label: 'Gateway endpoint is configured',
        passed: true,
        detail: `Endpoint ${redactUrl(endpoint)} is configured.`,
        severity: 'blocker',
      },
      {
        id: 'gateway-health',
        label: 'Gateway health contract is readable',
        passed: health.ok && health.body?.schemaVersion === 'adapter-gateway-health/v1',
        detail: `Health HTTP ${health.status}; schema ${health.body?.schemaVersion || 'missing'}.`,
        severity: 'blocker',
      },
      {
        id: 'managed-persistence-capability',
        label: 'Gateway advertises managed persistence capability',
        passed: capabilities.includes('managed-persistence-adapter-contract/v2'),
        detail: `${capabilities.length} advertised capability item(s).`,
        severity: 'blocker',
      },
      {
        id: 'worker-queue-capability',
        label: 'Gateway advertises worker queue capability',
        passed: capabilities.includes('worker-queue-adapter-contract/v1'),
        detail: `${capabilities.length} advertised capability item(s).`,
        severity: 'blocker',
      },
      {
        id: 'gateway-state-readable',
        label: 'Gateway state summary is readable',
        passed: state.ok && state.body?.schemaVersion === 'adapter-gateway-state-summary/v1',
        detail: `State HTTP ${state.status}; schema ${state.body?.schemaVersion || 'missing'}.`,
        severity: 'blocker',
      },
      {
        id: 'production-cutover-blocked',
        label: 'Gateway preflight keeps production cutover blocked',
        passed: health.body?.productionCutoverReady === false,
        detail: `Gateway productionCutoverReady=${String(health.body?.productionCutoverReady)}.`,
        severity: 'blocker',
      },
    ];
    const failedGates = gates.filter((gate) => !gate.passed);
    const checksum = persistenceChecksum({
      projectId,
      endpoint: redactUrl(endpoint),
      capabilities,
      gates: gates.map((gate) => [gate.id, gate.passed]),
      storageDriver: state.body?.storageAdapter?.driver || null,
      persistenceDryRunCount: state.body?.persistence?.dryRunCount || 0,
      workerQueueDryRunCount: state.body?.workerQueue?.dryRunCount || 0,
    });
    return {
      ...configPreflight,
      generatedAt: nowIso(),
      status: failedGates.length ? 'adapter-gateway-live-preflight-blocked' : 'adapter-gateway-live-preflight-ready',
      gatewayMode: 'http-json-gateway',
      liveGatewayReady: failedGates.length === 0,
      privateGatewayReady: failedGates.length === 0,
      productionCutoverReady: false,
      readyForProduction: false,
      health: {
        ok: health.ok,
        status: health.status,
        schemaVersion: health.body?.schemaVersion || null,
        gatewayStatus: health.body?.status || null,
        productionCutoverReady: Boolean(health.body?.productionCutoverReady),
        capabilities,
        storage: redactSensitiveObject(health.body?.storage || {}),
        auth: health.body?.auth || null,
      },
      state: {
        ok: state.ok,
        status: state.status,
        schemaVersion: state.body?.schemaVersion || null,
        storageAdapter: redactSensitiveObject(state.body?.storageAdapter || {}),
        persistence: state.body?.persistence || null,
        workerQueue: state.body?.workerQueue || null,
      },
      gates,
      failedGates,
      summary: {
        gateCount: gates.length,
        passedGateCount: gates.filter((gate) => gate.passed).length,
        failedGateCount: failedGates.length,
        gatewayMode: 'http-json-gateway',
        endpointConfigured: true,
        bearerAuthConfigured: Object.keys(adapterGatewayHeadersFromEnv(env)).length > 0,
        liveGatewayReady: failedGates.length === 0,
        stateReadable: state.ok && state.body?.schemaVersion === 'adapter-gateway-state-summary/v1',
        capabilityCount: capabilities.length,
        persistenceDryRunCount: state.body?.persistence?.dryRunCount || 0,
        workerQueueDryRunCount: state.body?.workerQueue?.dryRunCount || 0,
        storageDriver: state.body?.storageAdapter?.driver || null,
        productionCutoverReady: false,
        checksum,
      },
      checksum,
      nextRequiredAdapterWork: failedGates.length
        ? 'Fix the private adapter gateway health/state/capability gates before using external adapter rehearsals.'
        : 'Run persistence and worker queue dry-run routes through this gateway, then repeat against real managed infrastructure before production cutover.',
    };
  } catch (error) {
    const gate = {
      id: 'gateway-live-request',
      label: 'Gateway live request completed',
      passed: false,
      detail: error.message || String(error),
      severity: 'blocker',
    };
    const checksum = persistenceChecksum({
      projectId,
      endpoint: redactUrl(endpoint),
      error: gate.detail,
    });
    return {
      ...configPreflight,
      generatedAt: nowIso(),
      status: 'adapter-gateway-live-preflight-blocked',
      gatewayMode: 'http-json-gateway',
      liveGatewayReady: false,
      privateGatewayReady: false,
      productionCutoverReady: false,
      readyForProduction: false,
      health: null,
      state: null,
      error: {
        message: gate.detail,
      },
      gates: [gate],
      failedGates: [gate],
      summary: {
        ...configPreflight.summary,
        gateCount: 1,
        passedGateCount: 0,
        failedGateCount: 1,
        gatewayMode: 'http-json-gateway',
        endpointConfigured: true,
        liveGatewayReady: false,
        checksum,
      },
      checksum,
      nextRequiredAdapterWork: 'Fix the configured adapter gateway endpoint/auth/network path before running live gateway preflight again.',
    };
  }
}

function buildManagedPersistenceGatewayFailureDryRun({
  projectId,
  adapterStatus = {},
  adapterPlan = {},
  persistenceSnapshot = {},
  migrationPlan = {},
  migrationDryRun = {},
  error,
} = {}) {
  const gate = {
    id: 'http-json-gateway-execution',
    passed: false,
    detail: error?.message || String(error || 'Adapter gateway execution failed.'),
  };
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'managed-persistence-adapter-dry-run/v1',
    status: 'failed',
    adapterContract: adapterPlan.adapterContract || null,
    adapterExecution: {
      schemaVersion: 'managed-persistence-adapter-gateway-execution/v1',
      implementationSchemaVersion: 'http-json-adapter-gateway-client/v1',
      engine: 'http-json-adapter-gateway',
      adapterStatus: {
        ...adapterStatus,
        gatewayExecutionSupported: adapterStatus.driver === 'http-json' && adapterStatus.httpEndpointConfigured,
      },
      error: {
        message: error?.message || String(error || 'Adapter gateway execution failed.'),
        cause: error?.cause?.message || (error?.cause ? String(error.cause) : null),
        details: error?.details || null,
      },
      finalReceipt: null,
    },
    source: {
      persistenceSnapshotSchemaVersion: persistenceSnapshot.schemaVersion || null,
      migrationPlanSchemaVersion: migrationPlan.schemaVersion || null,
      migrationDryRunSchemaVersion: migrationDryRun.schemaVersion || null,
      adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
      persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      adapterPlanRoute: projectId ? `/projects/${projectId}/persistence-adapter-plan` : null,
    },
    summary: {
      adapterDriver: adapterStatus.driver || 'unknown',
      adapterStatus: adapterStatus.status || 'unknown',
      adapterProductionCutoverReady: false,
      gatewayOperationCount: 0,
      failedGateCount: 1,
    },
    gates: [gate],
    failedGates: [gate],
    nextRequiredAdapterWork: 'Fix the configured http-json persistence gateway or fall back to local-shadow before running cutover rehearsal.',
  };
}

async function buildManagedPersistenceAdapterGatewayDryRunVerification({
  persistenceSnapshot = {},
  migrationPlan = {},
  migrationDryRun = {},
  adapterPlan = {},
  projectId = persistenceSnapshot.projectId || adapterPlan.projectId || null,
  env = globalThis.process?.env || {},
} = {}) {
  const adapterStatus = managedPersistenceAdapterStatus(env);
  try {
    const client = createHttpJsonAdapterGatewayClient({
      baseUrl: env.MANAGED_PERSISTENCE_HTTP_ENDPOINT || env.ADAPTER_GATEWAY_HTTP_ENDPOINT,
      timeoutMs: adapterGatewayTimeoutMsFromEnv(env),
      headers: adapterGatewayHeadersFromEnv(env),
    });
    const payload = {
      schemaVersion: 'managed-persistence-http-json-dry-run/v1',
      projectId,
      generatedAt: nowIso(),
      adapterContract: adapterPlan.adapterContract || null,
      tablePlans: migrationPlan.tablePlans || [],
      recordsByTable: persistenceSnapshot.recordsByTable || {},
      recordCounts: persistenceSnapshot.recordCounts || {},
      seedOrder: migrationPlan.seedOrder || Object.keys(persistenceSnapshot.recordsByTable || {}),
      shadowReadPlan: adapterPlan.shadowReadPlan || [],
      verificationGates: adapterPlan.verificationGates || [],
      migrationDryRun: {
        schemaVersion: migrationDryRun.schemaVersion || null,
        status: migrationDryRun.status || null,
        importedTableCounts: migrationDryRun.importedTableCounts || {},
        failedGateCount: migrationDryRun.summary?.failedGateCount || migrationDryRun.failedGates?.length || 0,
      },
    };
    const health = await client.health();
    const dryRun = await client.runPersistenceDryRun(payload);
    const receipt = dryRun.body || {};
    const failedPlanGates = (adapterPlan.verificationGates || []).filter((gate) => !gate.passed).map((gate) => gate.id);
    const gates = [
      {
        id: 'adapter-driver-status',
        passed: adapterStatus.driver === 'http-json'
          && adapterStatus.httpEndpointConfigured
          && (!adapterStatus.requireRealAdapter || Boolean(receipt.productionCutoverReady)),
        detail: adapterStatus.requireRealAdapter
          ? `${adapterStatus.driver} requires real cutover approval; gateway production ready ${receipt.productionCutoverReady ? 'yes' : 'no'}.`
          : `${adapterStatus.driver} gateway endpoint configured; production cutover remains separately blocked.`,
      },
      {
        id: 'gateway-health',
        passed: health.ok && health.body?.schemaVersion === 'adapter-gateway-health/v1',
        detail: `Gateway health HTTP ${health.status}; schema ${health.body?.schemaVersion || 'missing'}.`,
      },
      {
        id: 'gateway-capability',
        passed: (health.body?.capabilities || []).includes('managed-persistence-adapter-contract/v2'),
        detail: `${health.body?.capabilities?.length || 0} advertised gateway capability item(s).`,
      },
      {
        id: 'adapter-execution-receipt',
        passed: dryRun.ok
          && receipt.schemaVersion === 'managed-persistence-adapter-execution-receipt/v1'
          && (receipt.operationCount || 0) >= 4
          && Boolean(receipt.checksum),
        detail: `Gateway persistence dry-run HTTP ${dryRun.status}; ${receipt.operationCount || 0} operation receipt(s).`,
      },
      {
        id: 'production-cutover-blocked',
        passed: receipt.productionCutoverReady === false,
        detail: `Gateway productionCutoverReady=${String(receipt.productionCutoverReady)}; dry-run must not approve production by itself.`,
      },
      {
        id: 'adapter-plan-gates',
        passed: failedPlanGates.length === 0,
        detail: failedPlanGates.length ? `Adapter plan failed gates: ${failedPlanGates.join(', ')}` : 'All adapter-plan gates pass.',
      },
      {
        id: 'migration-import-ready',
        passed: migrationDryRun.status === 'passed',
        detail: `Migration dry-run status ${migrationDryRun.status || 'unknown'}.`,
      },
    ];
    const failedGates = gates.filter((gate) => !gate.passed);
    return {
      projectId,
      generatedAt: nowIso(),
      schemaVersion: 'managed-persistence-adapter-dry-run/v1',
      status: failedGates.length ? 'failed' : 'passed',
      adapterContract: adapterPlan.adapterContract || null,
      adapterExecution: {
        schemaVersion: 'managed-persistence-adapter-gateway-execution/v1',
        implementationSchemaVersion: client.schemaVersion,
        engine: receipt.engine || 'http-json-adapter-gateway',
        adapterStatus: {
          ...adapterStatus,
          gatewayExecutionSupported: true,
          gatewayExecutionStatus: failedGates.length ? 'failed' : 'passed',
        },
        gateway: {
          baseUrl: client.baseUrl,
          healthStatus: health.status,
          dryRunStatus: dryRun.status,
          health: health.body,
        },
        payloadSummary: {
          tablePlanCount: payload.tablePlans.length,
          tableCount: Object.keys(payload.recordsByTable).length,
          recordCount: Object.values(payload.recordCounts).reduce((sum, count) => sum + (Number(count) || 0), 0),
          shadowReadGroupCount: payload.shadowReadPlan.length,
        },
        finalReceipt: receipt,
      },
      source: {
        persistenceSnapshotSchemaVersion: persistenceSnapshot.schemaVersion || null,
        migrationPlanSchemaVersion: migrationPlan.schemaVersion || null,
        migrationDryRunSchemaVersion: migrationDryRun.schemaVersion || null,
        adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
        persistenceSnapshotRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
        adapterPlanRoute: projectId ? `/projects/${projectId}/persistence-adapter-plan` : null,
      },
      summary: {
        adapterDriver: adapterStatus.driver,
        adapterStatus: adapterStatus.status,
        adapterProductionCutoverReady: Boolean(receipt.productionCutoverReady),
        gatewayOperationCount: receipt.operationCount || 0,
        gatewayTableCount: Object.keys(receipt.tableCounts || {}).length,
        failedGateCount: failedGates.length,
      },
      gates,
      failedGates,
      nextRequiredAdapterWork: failedGates.length
        ? 'Fix failed gateway dry-run gates before database cutover rehearsal.'
        : 'Run this same http-json gateway dry-run against the real isolated managed database, then add shadow-read pilot traffic before production cutover.',
    };
  } catch (error) {
    return buildManagedPersistenceGatewayFailureDryRun({
      projectId,
      adapterStatus,
      adapterPlan,
      persistenceSnapshot,
      migrationPlan,
      migrationDryRun,
      error,
    });
  }
}

function buildWorkerQueueSnapshot({
  projects = [],
  now = nowIso(),
  intervalMs,
  maxAgentsPerProject = Infinity,
  maxProjects = Infinity,
  forceDue = false,
  forceReason = 'queue-preview-forced',
  forceProjectIds = [],
  projectId = null,
} = {}) {
  const forceProjectIdSet = new Set((forceProjectIds || []).map((id) => String(id)));
  const selectedProjects = projectId
    ? projects.filter((project) => String(project.id) === String(projectId))
    : projects;
  const queueIdBase = Date.parse(now) || Date.now();
  const projectQueue = selectedProjects.map((project, index) => {
    const cadence = project.autonomy?.cadence || project.autonomousCadence || 'hourly';
    const schedule = evaluateAutonomousSchedule({ project, cadence, now });
    const forced = Boolean(forceDue) && (!forceProjectIdSet.size || forceProjectIdSet.has(String(project.id)));
    const due = forced || schedule.due;
    const dueAt = forced ? now : schedule.dueAt;
    const queueId = `queue_project_${project.id}_${queueIdBase}`;
    const reason = forced ? forceReason : schedule.reason;
    const idempotencyKey = buildWorkerIdempotencyKey({
      workerKind: 'project-autonomous',
      projectId: project.id,
      dueAt,
      reason,
    });
    const leaseKey = `lease:${idempotencyKey}`;
    return {
      id: queueId,
      queue: 'project-autonomous',
      workerKind: 'project-autonomous',
      projectId: project.id,
      projectName: project.name || project.id,
      status: due ? 'queued' : 'waiting',
      due,
      dueAt,
      nextRunAt: schedule.nextRunAt || project.nextAutonomousRunAt || null,
      cadence,
      reason,
      forced,
      priority: due ? 50 : 0,
      rank: index + 1,
      idempotencyKey,
      leaseKey,
      runApiPath: '/workers/autonomous/due',
      directRunApiPath: `/projects/${encodeURIComponent(project.id)}/autonomous-cycle`,
      ...buildQueuedWorkerControlFields({ idempotencyKey, leaseKey, status: due ? 'queued' : 'waiting' }),
      requestBody: {
        now,
        forceDue: forced,
        forceProjectIds: forced ? [project.id] : [],
      },
    };
  });

  const agentRows = [];
  selectedProjects.forEach((project) => {
    const forcedProject = Boolean(forceDue) && (!forceProjectIdSet.size || forceProjectIdSet.has(String(project.id)));
    (project.team || []).forEach((agent) => {
      const state = project.agentStates?.[agent.id] || {};
      const schedule = evaluateAgentWorkSchedule({
        project,
        agentId: agent.id,
        now,
        intervalMs,
        forceDue: forcedProject,
        forceReason,
      });
      const idempotencyKey = buildWorkerIdempotencyKey({
        workerKind: 'agent-work',
        projectId: project.id,
        agentId: agent.id,
        dueAt: schedule.dueAt,
        reason: schedule.reason,
      });
      const leaseKey = `lease:${idempotencyKey}`;
      agentRows.push({
        id: `queue_agent_${project.id}_${agent.id}_${queueIdBase}`,
        queue: 'agent-work',
        workerKind: 'agent-work',
        projectId: project.id,
        projectName: project.name || project.id,
        agentId: agent.id,
        agentName: agent.name || agent.id,
        status: schedule.due ? 'queued' : 'waiting',
        due: Boolean(schedule.due),
        dueAt: schedule.dueAt || null,
        nextRunAt: schedule.nextRunAt || state.nextAgentRunAt || null,
        cadenceMs: schedule.cadenceMs || null,
        reason: schedule.reason,
        forced: Boolean(schedule.forced),
        priority: schedule.managementPriority || 0,
        managementPriority: schedule.managementPriority || 0,
        managementReasons: schedule.managementReasons || [],
        idempotencyKey,
        leaseKey,
        runApiPath: '/workers/agents/due',
        directRunApiPath: `/projects/${encodeURIComponent(project.id)}/agents/${encodeURIComponent(agent.id)}/work-cycle`,
        ...buildQueuedWorkerControlFields({ idempotencyKey, leaseKey, status: schedule.due ? 'queued' : 'waiting' }),
        requestBody: {
          now,
          forceDue: Boolean(schedule.forced),
          forceProjectIds: schedule.forced ? [project.id] : [],
          maxAgentsPerProject,
          maxProjects,
        },
      });
    });
  });
  const groupedDueCounts = new Map();
  const agentQueue = agentRows
    .sort((a, b) => (
      Number(b.due) - Number(a.due)
      || (b.managementPriority || 0) - (a.managementPriority || 0)
      || safeDateMs(a.dueAt, safeDateMs(now)) - safeDateMs(b.dueAt, safeDateMs(now))
      || String(a.projectId).localeCompare(String(b.projectId))
      || String(a.agentId).localeCompare(String(b.agentId))
    ))
    .map((row, index) => {
      const projectDueCount = groupedDueCounts.get(row.projectId) || 0;
      const projectCanProcess = row.due && projectDueCount < maxAgentsPerProject;
      if (projectCanProcess) groupedDueCounts.set(row.projectId, projectDueCount + 1);
      const willProcess = projectCanProcess && [...groupedDueCounts.values()].filter((count) => count > 0).length <= maxProjects;
      return {
        ...row,
        rank: index + 1,
        status: row.due ? willProcess ? 'queued' : 'deferred' : row.status,
        willProcess,
        deferReason: row.due && !willProcess ? 'queue-concurrency-limit' : null,
      };
    });

  const dueProjectCount = projectQueue.filter((row) => row.due).length;
  const dueAgentCount = agentQueue.filter((row) => row.due).length;
  const queuedAgentCount = agentQueue.filter((row) => row.willProcess).length;
  const waitUntilValues = [
    ...projectQueue.filter((row) => !row.due).map((row) => row.nextRunAt),
    ...agentQueue.filter((row) => !row.due).map((row) => row.nextRunAt),
  ].filter(Boolean).sort((a, b) => safeDateMs(a) - safeDateMs(b));
  const workerRuns = selectedProjects.flatMap((project) => workerRunsForProject(project));
  const executionReceipts = workerRuns
    .map((run) => run.executionReceipt)
    .filter((receipt) => receipt?.schemaVersion === 'worker-execution-receipt/v1');
  const deadLetterQueue = workerRuns
    .filter((run) => run.deadLetter?.schemaVersion === 'worker-dead-letter/v1')
    .map((run) => run.deadLetter);
  const retryableFailureCount = workerRuns.filter((run) => run.retry?.retryable).length;

  return {
    generatedAt: nowIso(),
    requestedAt: now,
    schemaVersion: 'worker-queue-snapshot/v1',
    projectId: projectId || null,
    status: dueProjectCount || queuedAgentCount ? 'work-queued' : 'waiting',
    queueMode: 'preview-no-mutation',
    concurrencyPolicy: {
      maxAgentsPerProject,
      maxProjects,
      projectQueue: 'all-due-projects',
      agentQueue: 'management-priority-then-due-time',
    },
    retryPolicy: {
      schemaVersion: 'worker-queue-retry-policy/v1',
      idempotencyKey: 'stable per worker kind/project/agent/dueAt/reason',
      leaseKey: 'derived from idempotency key',
      recommendedLeaseSeconds: WORKER_QUEUE_RECOMMENDED_LEASE_SECONDS,
      maxAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
      retryBackoffSeconds: WORKER_QUEUE_RETRY_BACKOFF_SECONDS,
      deadLetterAfterAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
      executionReceipt: 'worker-execution-receipt/v1 per completed run',
    },
    deadLetterPolicy: {
      schemaVersion: 'worker-dead-letter-policy/v1',
      status: 'local-contract-ready',
      failureStatuses: ['failed', 'timeout', 'exception'],
      deadLetterAfterAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
      recovery: 'Inspect the dead-letter row, verify the lease/idempotency key, then rerun the due worker or direct project/Agent route.',
    },
    summary: {
      projectCount: selectedProjects.length,
      projectQueuedCount: dueProjectCount,
      projectWaitingCount: projectQueue.length - dueProjectCount,
      agentCount: agentQueue.length,
      agentDueCount: dueAgentCount,
      agentQueuedCount: queuedAgentCount,
      agentDeferredCount: agentQueue.filter((row) => row.status === 'deferred').length,
      agentWaitingCount: agentQueue.filter((row) => row.status === 'waiting').length,
      nextWakeAt: waitUntilValues[0] || null,
      workerRunReceiptCount: executionReceipts.length,
      workerDeadLetterCount: deadLetterQueue.length,
      workerRetryableFailureCount: retryableFailureCount,
      workerMaxAttempts: WORKER_QUEUE_MAX_ATTEMPTS,
    },
    projectQueue,
    agentQueue,
    executionReceipts,
    deadLetterQueue,
    workerRoutes: {
      projectDueWorker: '/workers/autonomous/due',
      agentDueWorker: '/workers/agents/due',
      queueSnapshot: '/workers/queue-snapshot',
      projectQueueTemplate: '/projects/:projectId/worker-queue',
      deadLetterRecovery: '/workers/queue-snapshot',
    },
  };
}

function workerQueueRowsForAdapter(workerQueueSnapshot = {}) {
  return [
    ...(workerQueueSnapshot.projectQueue || []),
    ...(workerQueueSnapshot.agentQueue || []),
  ].map((row) => ({
    ...row,
    adapterQueue: row.queue || workerQueueKind(row.workerKind),
  }));
}

function buildWorkerQueueAdapterPlan({
  workerQueueSnapshot = {},
  projectId = workerQueueSnapshot.projectId || null,
} = {}) {
  const adapterStatus = workerQueueAdapterStatus();
  const rows = workerQueueRowsForAdapter(workerQueueSnapshot);
  const dueRows = rows.filter((row) => row.due);
  const projectRows = rows.filter((row) => row.adapterQueue === 'project-autonomous');
  const agentRows = rows.filter((row) => row.adapterQueue === 'agent-work');
  const executionReceipts = workerQueueSnapshot.executionReceipts || [];
  const deadLetterRows = workerQueueSnapshot.deadLetterQueue || [];
  const queuePlan = (id, label, queueRows, workerRoute, directTemplate) => ({
    id,
    label,
    adapterTopic: `hofs.${id}.due`,
    workerRoute,
    directRunTemplate: directTemplate,
    rowCount: queueRows.length,
    dueCount: queueRows.filter((row) => row.due).length,
    queuedCount: queueRows.filter((row) => row.status === 'queued').length,
    waitingCount: queueRows.filter((row) => row.status === 'waiting').length,
    deferredCount: queueRows.filter((row) => row.status === 'deferred').length,
    idempotency: 'use row.idempotencyKey as the enqueue and replay key',
    lease: `leaseKey with ${workerQueueSnapshot.retryPolicy?.recommendedLeaseSeconds || WORKER_QUEUE_RECOMMENDED_LEASE_SECONDS}s recommended lease`,
    retry: {
      maxAttempts: workerQueueSnapshot.retryPolicy?.maxAttempts || WORKER_QUEUE_MAX_ATTEMPTS,
      backoffSeconds: workerQueueSnapshot.retryPolicy?.retryBackoffSeconds || WORKER_QUEUE_RETRY_BACKOFF_SECONDS,
      deadLetterAfterAttempts: workerQueueSnapshot.retryPolicy?.deadLetterAfterAttempts || WORKER_QUEUE_MAX_ATTEMPTS,
    },
  });
  const adapterContract = {
    schemaVersion: 'worker-queue-adapter-contract/v1',
    purpose: 'Minimum queue/cron adapter surface required before replacing the local Node interval scheduler.',
    methods: [
      'enqueueDueRows(workerQueueSnapshot)',
      'acquireLease(idempotencyKey, leaseKey)',
      'dispatchWorker(runApiPath, requestBody)',
      'ackExecutionReceipt(workerExecutionReceipt)',
      'retryLater(idempotencyKey, retryState)',
      'deadLetter(workerDeadLetter)',
      'recoverDeadLetter(deadLetterId, directRecoveryApiPath)',
      'inspectQueue(projectId)',
      'inspectSnapshotParity(workerQueueSnapshot, projectId)',
    ],
  };
  const gates = [
    {
      id: 'snapshot-contract',
      passed: workerQueueSnapshot.schemaVersion === 'worker-queue-snapshot/v1',
      detail: `Snapshot schema ${workerQueueSnapshot.schemaVersion || 'missing'}.`,
    },
    {
      id: 'queue-row-identity',
      passed: rows.length > 0 && rows.every((row) => row.idempotencyKey && row.leaseKey),
      detail: `${rows.length} queue row(s), ${rows.filter((row) => row.idempotencyKey && row.leaseKey).length} with idempotency/lease.`,
    },
    {
      id: 'dispatch-routes',
      passed: rows.every((row) => row.runApiPath && row.directRunApiPath && row.requestBody),
      detail: `${rows.filter((row) => row.runApiPath && row.directRunApiPath && row.requestBody).length}/${rows.length} row(s) have dispatch and recovery routes.`,
    },
    {
      id: 'retry-dead-letter-policy',
      passed: workerQueueSnapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1'
        && workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1'
        && (workerQueueSnapshot.retryPolicy?.maxAttempts || 0) >= 1,
      detail: `${workerQueueSnapshot.retryPolicy?.maxAttempts || 0} max attempt(s), dead-letter after ${workerQueueSnapshot.deadLetterPolicy?.deadLetterAfterAttempts || workerQueueSnapshot.retryPolicy?.deadLetterAfterAttempts || 'missing'}.`,
    },
    {
      id: 'execution-receipt-contract',
      passed: Array.isArray(executionReceipts)
        && executionReceipts.every((receipt) => receipt.schemaVersion === 'worker-execution-receipt/v1' && receipt.receiptChecksum && receipt.idempotencyKey && receipt.leaseKey),
      detail: `${executionReceipts.length} execution receipt(s) exported.`,
    },
    {
      id: 'dead-letter-recovery-routes',
      passed: Array.isArray(deadLetterRows)
        && deadLetterRows.every((row) => row.idempotencyKey && row.leaseKey && row.recoveryApiPath && row.directRecoveryApiPath),
      detail: `${deadLetterRows.length} dead-letter row(s), ${deadLetterRows.filter((row) => row.directRecoveryApiPath).length} with direct recovery routes.`,
    },
    {
      id: 'concurrency-policy',
      passed: Boolean(workerQueueSnapshot.concurrencyPolicy?.agentQueue && workerQueueSnapshot.concurrencyPolicy?.projectQueue),
      detail: `${workerQueueSnapshot.concurrencyPolicy?.agentQueue || 'missing agent policy'} / ${workerQueueSnapshot.concurrencyPolicy?.projectQueue || 'missing project policy'}.`,
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'worker-queue-adapter-plan/v1',
    status: failedGates.length ? 'blocked' : 'ready-for-queue-adapter-pilot',
    target: {
      engine: 'queue-or-cron-compatible',
      adapterPattern: 'durable-lease-idempotent-dispatch-with-dead-letter-storage',
      productionRequirement: 'replace the local Node interval runner with managed queue/cron infrastructure, durable leases, dead-letter storage, worker identity, and recovery drills',
    },
    adapterContract,
    adapterStatus,
    queuePlans: [
      queuePlan('project-autonomous', 'Project autonomous worker queue', projectRows, '/workers/autonomous/due', '/projects/:projectId/autonomous-cycle'),
      queuePlan('agent-work', 'Independent Agent worker queue', agentRows, '/workers/agents/due', '/projects/:projectId/agents/:agentId/work-cycle'),
    ],
    verificationGates: gates,
    blockers: failedGates.map((gate) => ({ id: gate.id, detail: gate.detail })),
    summary: {
      queueRowCount: rows.length,
      dueRowCount: dueRows.length,
      projectQueueRowCount: projectRows.length,
      agentQueueRowCount: agentRows.length,
      executionReceiptCount: executionReceipts.length,
      deadLetterCount: deadLetterRows.length,
      adapterMethodCount: adapterContract.methods.length,
      gateCount: gates.length,
      failedGateCount: failedGates.length,
      adapterDriver: adapterStatus.driver,
      adapterProductionCutoverReady: Boolean(adapterStatus.productionCutoverReady),
    },
    sourceQueue: {
      schemaVersion: workerQueueSnapshot.schemaVersion || null,
      route: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      generatedAt: workerQueueSnapshot.generatedAt || null,
    },
    rolloutPlan: [
      'Map project-autonomous and agent-work rows to managed queue topics.',
      'Use idempotencyKey as the enqueue/replay key and leaseKey as the durable lease token.',
      'Dispatch due-worker routes with signed runtime worker identity.',
      'Persist worker-execution-receipt/v1 records before acknowledging queue items.',
      'Retry transient failures with the configured backoff, then write worker-dead-letter/v1 rows.',
      'Run the product-team acceptance Harness against the adapter-backed backend before pilot traffic.',
    ],
  };
}

function buildWorkerQueueAdapterDryRunVerification({
  workerQueueSnapshot = {},
  adapterPlan = {},
  projectId = workerQueueSnapshot.projectId || adapterPlan.projectId || null,
} = {}) {
  const rows = workerQueueRowsForAdapter(workerQueueSnapshot);
  const dueRows = rows.filter((row) => row.due);
  const executionReceipts = workerQueueSnapshot.executionReceipts || [];
  const deadLetterRows = workerQueueSnapshot.deadLetterQueue || [];
  const { adapter, status: adapterStatus } = createWorkerQueueAdapterFromEnv();
  const enqueueReceipt = adapter.enqueueDueRows(workerQueueSnapshot);
  const idempotencyCounts = rows.reduce((acc, row) => {
    if (!row.idempotencyKey) return acc;
    acc.set(row.idempotencyKey, (acc.get(row.idempotencyKey) || 0) + 1);
    return acc;
  }, new Map());
  const duplicateIdempotencyKeys = [...idempotencyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const leaseAcquisitions = dueRows.map((row) => {
    const leaseReceipt = adapter.acquireLease(row.idempotencyKey, row.leaseKey);
    return {
      id: row.id,
      queue: row.adapterQueue,
      projectId: row.projectId,
      agentId: row.agentId || null,
      idempotencyKey: row.idempotencyKey || null,
      leaseKey: row.leaseKey || null,
      acquired: Boolean(leaseReceipt.acquired),
      receiptChecksum: leaseReceipt.checksum,
      expiresInSeconds: workerQueueSnapshot.retryPolicy?.recommendedLeaseSeconds || WORKER_QUEUE_RECOMMENDED_LEASE_SECONDS,
    };
  });
  const dispatches = dueRows.map((row) => {
    const dispatchReceipt = adapter.dispatchWorker(row.runApiPath, row.requestBody || {});
    return {
      id: row.id,
      queue: row.adapterQueue,
      runApiPath: row.runApiPath || null,
      directRunApiPath: row.directRunApiPath || null,
      requestBodyChecksum: dispatchReceipt.requestBodyChecksum || persistenceChecksum(row.requestBody || {}),
      dispatchable: Boolean(dispatchReceipt.dispatchable),
      receiptChecksum: dispatchReceipt.checksum,
    };
  });
  const acknowledgements = executionReceipts.map((receipt) => {
    const ackReceipt = adapter.ackExecutionReceipt(receipt);
    return {
      runId: receipt.runId || null,
      idempotencyKey: receipt.idempotencyKey || null,
      leaseKey: receipt.leaseKey || null,
      receiptChecksum: receipt.receiptChecksum || null,
      acked: Boolean(ackReceipt.acked),
      ackReceiptChecksum: ackReceipt.checksum,
    };
  });
  const retryPolicyReceipt = adapter.retryLater('worker-queue-retry-policy-import', {
    retryable: true,
    attemptCount: 0,
    maxAttempts: workerQueueSnapshot.retryPolicy?.maxAttempts || WORKER_QUEUE_MAX_ATTEMPTS,
  });
  const deadLetterRecoveries = deadLetterRows.map((row) => {
    adapter.deadLetter(row);
    const recoveryReceipt = adapter.recoverDeadLetter(row.id, row.directRecoveryApiPath);
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey || null,
      leaseKey: row.leaseKey || null,
      recoveryApiPath: row.recoveryApiPath || null,
      directRecoveryApiPath: row.directRecoveryApiPath || null,
      recoverable: Boolean(recoveryReceipt.recovered),
      receiptChecksum: recoveryReceipt.checksum,
    };
  });
  const inspectReceipt = adapter.inspectQueue(projectId);
  const snapshotParityReceipt = typeof adapter.inspectSnapshotParity === 'function'
    ? adapter.inspectSnapshotParity(workerQueueSnapshot, projectId)
    : {
      schemaVersion: 'worker-queue-adapter-snapshot-parity/v1',
      parityReady: false,
      queueRowParityReady: false,
      leaseParityReady: false,
      acknowledgementParityReady: false,
      deadLetterParityReady: false,
    };
  const adapterExecutionReceipt = adapter.executionReceipt(projectId);
  const failedPlanGates = (adapterPlan.verificationGates || [])
    .filter((gate) => !gate.passed)
    .map((gate) => gate.id);
  const gates = [
    {
      id: 'adapter-driver-status',
      passed: adapterStatus.executableInCurrentRuntime
        && (!adapterStatus.requireRealAdapter || adapterStatus.productionCutoverReady),
      detail: adapterStatus.requireRealAdapter
        ? `${adapterStatus.driver} requires real queue adapter cutover; production ready ${adapterStatus.productionCutoverReady ? 'yes' : 'no'}.`
        : `${adapterStatus.driver} driver status ${adapterStatus.status}; local MVP may use shadow execution while production remains blocked.`,
    },
    {
      id: 'adapter-execution-receipt',
      passed: adapterExecutionReceipt.schemaVersion === 'worker-queue-adapter-execution-receipt/v1'
        && adapterExecutionReceipt.operationCount >= 4
        && Boolean(adapterExecutionReceipt.checksum),
      detail: `${adapterExecutionReceipt.operationCount || 0} queue adapter operation receipt(s), engine ${adapterExecutionReceipt.engine || 'unknown'}.`,
    },
    {
      id: 'adapter-contract',
      passed: adapterPlan.adapterContract?.schemaVersion === 'worker-queue-adapter-contract/v1'
        && (adapterPlan.adapterContract?.methods || []).length >= 6,
      detail: `${adapterPlan.adapterContract?.methods?.length || 0} adapter method(s).`,
    },
    {
      id: 'adapter-plan-gates',
      passed: failedPlanGates.length === 0,
      detail: failedPlanGates.length ? `Adapter plan failed gates: ${failedPlanGates.join(', ')}` : 'All adapter-plan gates pass.',
    },
    {
      id: 'enqueue-row-coverage',
      passed: rows.length === (adapterPlan.summary?.queueRowCount || rows.length) && rows.length > 0,
      detail: `Prepared ${rows.length} queue row(s) for adapter import.`,
    },
    {
      id: 'idempotency-unique',
      passed: duplicateIdempotencyKeys.length === 0 && rows.every((row) => row.idempotencyKey),
      detail: duplicateIdempotencyKeys.length ? `${duplicateIdempotencyKeys.length} duplicate idempotency key(s).` : 'Every queue row has a unique idempotency key.',
    },
    {
      id: 'lease-acquisition',
      passed: leaseAcquisitions.every((row) => row.acquired),
      detail: `${leaseAcquisitions.filter((row) => row.acquired).length}/${leaseAcquisitions.length} due row lease(s) acquired.`,
    },
    {
      id: 'dispatch-route-coverage',
      passed: dispatches.every((row) => row.dispatchable),
      detail: `${dispatches.filter((row) => row.dispatchable).length}/${dispatches.length} due dispatch(es) have worker and recovery routes.`,
    },
    {
      id: 'receipt-acknowledgement',
      passed: acknowledgements.every((row) => row.acked),
      detail: `${acknowledgements.filter((row) => row.acked).length}/${acknowledgements.length} execution receipt(s) are ackable.`,
    },
    {
      id: 'dead-letter-recovery',
      passed: deadLetterRecoveries.every((row) => row.recoverable),
      detail: `${deadLetterRecoveries.filter((row) => row.recoverable).length}/${deadLetterRecoveries.length} dead-letter row(s) are recoverable.`,
    },
    {
      id: 'retry-policy-import',
      passed: workerQueueSnapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1'
        && workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1',
      detail: `${workerQueueSnapshot.retryPolicy?.maxAttempts || 0} max attempt(s), ${workerQueueSnapshot.retryPolicy?.retryBackoffSeconds?.length || 0} backoff step(s).`,
    },
    {
      id: 'snapshot-parity',
      passed: snapshotParityReceipt.schemaVersion === 'worker-queue-adapter-snapshot-parity/v1'
        && snapshotParityReceipt.parityReady === true,
      detail: snapshotParityReceipt.parityReady
        ? 'Adapter queue snapshot parity passed for queue rows, leases, acknowledgements, and dead-letter recovery.'
        : 'Adapter queue snapshot parity did not match the source worker queue snapshot.',
    },
  ];
  const failedGates = gates.filter((gate) => !gate.passed);
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'worker-queue-adapter-dry-run/v1',
    status: failedGates.length ? 'failed' : 'passed',
    adapterContract: adapterPlan.adapterContract || null,
    adapterExecution: {
      schemaVersion: 'worker-queue-adapter-shadow-execution/v1',
      implementationSchemaVersion: adapter.schemaVersion,
      engine: adapterExecutionReceipt.engine,
      adapterStatus,
      enqueueReceipt,
      retryPolicyReceipt,
      inspectReceipt,
      snapshotParityReceipt,
      finalReceipt: adapterExecutionReceipt,
    },
    source: {
      workerQueueSnapshotSchemaVersion: workerQueueSnapshot.schemaVersion || null,
      adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
      workerQueueRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      adapterPlanRoute: projectId ? `/projects/${projectId}/worker-queue-adapter-plan` : null,
    },
    summary: {
      queueRowCount: rows.length,
      dueRowCount: dueRows.length,
      leaseAcquisitionCount: leaseAcquisitions.length,
      dispatchCount: dispatches.length,
      executionReceiptCount: executionReceipts.length,
      ackableReceiptCount: acknowledgements.filter((row) => row.acked).length,
      deadLetterCount: deadLetterRows.length,
      recoverableDeadLetterCount: deadLetterRecoveries.filter((row) => row.recoverable).length,
      failedGateCount: failedGates.length,
      adapterOperationCount: adapterExecutionReceipt.operationCount || 0,
      adapterQueueRowCount: adapterExecutionReceipt.queueRowCount || 0,
      snapshotParityReady: Boolean(snapshotParityReceipt.parityReady),
      snapshotQueueRowParityReady: Boolean(snapshotParityReceipt.queueRowParityReady),
      snapshotLeaseParityReady: Boolean(snapshotParityReceipt.leaseParityReady),
      snapshotAcknowledgementParityReady: Boolean(snapshotParityReceipt.acknowledgementParityReady),
      snapshotDeadLetterParityReady: Boolean(snapshotParityReceipt.deadLetterParityReady),
      adapterDriver: adapterStatus.driver,
      adapterStatus: adapterStatus.status,
      adapterProductionCutoverReady: Boolean(adapterStatus.productionCutoverReady),
    },
    leaseAcquisitions,
    dispatches,
    acknowledgements,
    deadLetterRecoveries,
    gates,
    failedGates,
    nextRequiredAdapterWork: failedGates.length
      ? 'Fix failed queue adapter dry-run gates before replacing the local scheduler.'
      : 'Implement this adapter contract against the selected managed queue/cron service and rerun the product-team Harness before pilot traffic.',
  };
}

function buildWorkerQueueGatewayFailureDryRun({
  projectId,
  adapterStatus = {},
  adapterPlan = {},
  workerQueueSnapshot = {},
  error,
} = {}) {
  const gate = {
    id: 'http-json-gateway-execution',
    passed: false,
    detail: error?.message || String(error || 'Worker queue gateway execution failed.'),
  };
  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'worker-queue-adapter-dry-run/v1',
    status: 'failed',
    adapterContract: adapterPlan.adapterContract || null,
    adapterExecution: {
      schemaVersion: 'worker-queue-adapter-gateway-execution/v1',
      implementationSchemaVersion: 'http-json-adapter-gateway-client/v1',
      engine: 'http-json-adapter-gateway',
      adapterStatus: {
        ...adapterStatus,
        gatewayExecutionSupported: adapterStatus.driver === 'http-json' && adapterStatus.httpEndpointConfigured,
      },
      error: {
        message: error?.message || String(error || 'Worker queue gateway execution failed.'),
        cause: error?.cause?.message || (error?.cause ? String(error.cause) : null),
        details: error?.details || null,
      },
      finalReceipt: null,
    },
    source: {
      workerQueueSnapshotSchemaVersion: workerQueueSnapshot.schemaVersion || null,
      adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
      workerQueueRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      adapterPlanRoute: projectId ? `/projects/${projectId}/worker-queue-adapter-plan` : null,
    },
    summary: {
      adapterDriver: adapterStatus.driver || 'unknown',
      adapterStatus: adapterStatus.status || 'unknown',
      adapterProductionCutoverReady: false,
      gatewayOperationCount: 0,
      failedGateCount: 1,
    },
    gates: [gate],
    failedGates: [gate],
    nextRequiredAdapterWork: 'Fix the configured http-json worker queue gateway or fall back to local-shadow before running queue cutover rehearsal.',
  };
}

async function buildWorkerQueueAdapterGatewayDryRunVerification({
  workerQueueSnapshot = {},
  adapterPlan = {},
  projectId = workerQueueSnapshot.projectId || adapterPlan.projectId || null,
  env = globalThis.process?.env || {},
} = {}) {
  const adapterStatus = workerQueueAdapterStatus(env);
  try {
    const client = createHttpJsonAdapterGatewayClient({
      baseUrl: env.WORKER_QUEUE_HTTP_ENDPOINT || env.ADAPTER_GATEWAY_HTTP_ENDPOINT,
      timeoutMs: adapterGatewayTimeoutMsFromEnv(env),
      headers: adapterGatewayHeadersFromEnv(env),
    });
    const rows = workerQueueRowsForAdapter(workerQueueSnapshot);
    const payload = {
      schemaVersion: 'worker-queue-http-json-dry-run/v1',
      projectId,
      generatedAt: nowIso(),
      adapterContract: adapterPlan.adapterContract || null,
      workerQueueSnapshot,
      queuePlans: adapterPlan.queuePlans || [],
      verificationGates: adapterPlan.verificationGates || [],
      summary: {
        queueRowCount: rows.length,
        dueRowCount: rows.filter((row) => row.due).length,
        executionReceiptCount: workerQueueSnapshot.executionReceipts?.length || 0,
        deadLetterCount: workerQueueSnapshot.deadLetterQueue?.length || 0,
      },
    };
    const health = await client.health();
    const dryRun = await client.runWorkerQueueDryRun(payload);
    const receipt = dryRun.body || {};
    const failedPlanGates = (adapterPlan.verificationGates || []).filter((gate) => !gate.passed).map((gate) => gate.id);
    const gates = [
      {
        id: 'adapter-driver-status',
        passed: adapterStatus.driver === 'http-json'
          && adapterStatus.httpEndpointConfigured
          && (!adapterStatus.requireRealAdapter || Boolean(receipt.productionCutoverReady)),
        detail: adapterStatus.requireRealAdapter
          ? `${adapterStatus.driver} requires real queue approval; gateway production ready ${receipt.productionCutoverReady ? 'yes' : 'no'}.`
          : `${adapterStatus.driver} gateway endpoint configured; production cutover remains separately blocked.`,
      },
      {
        id: 'gateway-health',
        passed: health.ok && health.body?.schemaVersion === 'adapter-gateway-health/v1',
        detail: `Gateway health HTTP ${health.status}; schema ${health.body?.schemaVersion || 'missing'}.`,
      },
      {
        id: 'gateway-capability',
        passed: (health.body?.capabilities || []).includes('worker-queue-adapter-contract/v1'),
        detail: `${health.body?.capabilities?.length || 0} advertised gateway capability item(s).`,
      },
      {
        id: 'adapter-execution-receipt',
        passed: dryRun.ok
          && receipt.schemaVersion === 'worker-queue-adapter-execution-receipt/v1'
          && (receipt.operationCount || 0) >= 3
          && Boolean(receipt.checksum),
        detail: `Gateway worker queue dry-run HTTP ${dryRun.status}; ${receipt.operationCount || 0} operation receipt(s).`,
      },
      {
        id: 'production-cutover-blocked',
        passed: receipt.productionCutoverReady === false,
        detail: `Gateway productionCutoverReady=${String(receipt.productionCutoverReady)}; dry-run must not approve production by itself.`,
      },
      {
        id: 'adapter-plan-gates',
        passed: failedPlanGates.length === 0,
        detail: failedPlanGates.length ? `Adapter plan failed gates: ${failedPlanGates.join(', ')}` : 'All adapter-plan gates pass.',
      },
      {
        id: 'queue-row-coverage',
        passed: rows.length > 0 && (receipt.queueRowCount || rows.length) >= rows.length,
        detail: `Prepared ${rows.length} queue row(s); gateway reported ${receipt.queueRowCount || 0}.`,
      },
    ];
    const failedGates = gates.filter((gate) => !gate.passed);
    return {
      projectId,
      generatedAt: nowIso(),
      schemaVersion: 'worker-queue-adapter-dry-run/v1',
      status: failedGates.length ? 'failed' : 'passed',
      adapterContract: adapterPlan.adapterContract || null,
      adapterExecution: {
        schemaVersion: 'worker-queue-adapter-gateway-execution/v1',
        implementationSchemaVersion: client.schemaVersion,
        engine: receipt.engine || 'http-json-adapter-gateway',
        adapterStatus: {
          ...adapterStatus,
          gatewayExecutionSupported: true,
          gatewayExecutionStatus: failedGates.length ? 'failed' : 'passed',
        },
        gateway: {
          baseUrl: client.baseUrl,
          healthStatus: health.status,
          dryRunStatus: dryRun.status,
          health: health.body,
        },
        payloadSummary: payload.summary,
        finalReceipt: receipt,
      },
      source: {
        workerQueueSnapshotSchemaVersion: workerQueueSnapshot.schemaVersion || null,
        adapterPlanSchemaVersion: adapterPlan.schemaVersion || null,
        workerQueueRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
        adapterPlanRoute: projectId ? `/projects/${projectId}/worker-queue-adapter-plan` : null,
      },
      summary: {
        queueRowCount: rows.length,
        dueRowCount: rows.filter((row) => row.due).length,
        failedGateCount: failedGates.length,
        gatewayOperationCount: receipt.operationCount || 0,
        adapterQueueRowCount: receipt.queueRowCount || 0,
        adapterDriver: adapterStatus.driver,
        adapterStatus: adapterStatus.status,
        adapterProductionCutoverReady: Boolean(receipt.productionCutoverReady),
      },
      gates,
      failedGates,
      nextRequiredAdapterWork: failedGates.length
        ? 'Fix failed queue gateway dry-run gates before replacing the local scheduler.'
        : 'Run this same http-json gateway dry-run against durable queue leases, then rerun the product-team Harness before pilot traffic.',
    };
  } catch (error) {
    return buildWorkerQueueGatewayFailureDryRun({
      projectId,
      adapterStatus,
      adapterPlan,
      workerQueueSnapshot,
      error,
    });
  }
}

function buildOperationsReadinessSnapshot({
  project = {},
  managerDashboard = {},
  mvpReadiness = {},
  securityBoundary = {},
  persistenceSnapshot = {},
  migrationPlan = {},
  migrationDryRun = {},
  persistenceAdapterPlan = {},
  persistenceAdapterDryRun = {},
  workerQueueSnapshot = {},
  workerQueueAdapterPlan = {},
  workerQueueAdapterDryRun = {},
  securityAuditStreamRecords = [],
  now = nowIso(),
} = {}) {
  const projectId = project.id || managerDashboard.projectId || persistenceSnapshot.projectId || null;
  const workerRuns = workerRunsForProject(project);
  const latestWorkerRun = workerRuns
    .slice()
    .sort((a, b) => safeDateMs(b.ranAt || b.time || b.startedAt, 0) - safeDateMs(a.ranAt || a.time || a.startedAt, 0))[0] || null;
  const auditStreamSummary = summarizeSecurityAuditStream(securityAuditStreamRecords);
  const eventLedger = project.eventLedger || [];
  const queueSummary = workerQueueSnapshot.summary || {};
  const persistenceAdapterSummary = persistenceAdapterDryRun.summary || {};
  const queueAdapterPlanSummary = workerQueueAdapterPlan.summary || {};
  const queueAdapterDryRunSummary = workerQueueAdapterDryRun.summary || {};
  const workerExecutionReceipts = workerRuns
    .map((run) => run.executionReceipt)
    .filter((receipt) => receipt?.schemaVersion === 'worker-execution-receipt/v1');
  const workerDeadLetters = workerRuns
    .filter((run) => run.deadLetter?.schemaVersion === 'worker-dead-letter/v1')
    .map((run) => run.deadLetter);
  const workerRetryableFailures = workerRuns.filter((run) => run.retry?.retryable);
  const workerRecoveryContractReady = Boolean(
    workerQueueSnapshot.retryPolicy?.schemaVersion === 'worker-queue-retry-policy/v1'
    && workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1'
    && workerQueueSnapshot.retryPolicy?.maxAttempts >= 1
    && workerExecutionReceipts.length >= workerRuns.length
    && workerRuns.every((run) => (
      run.idempotencyKey
      && run.leaseKey
      && run.retry?.schemaVersion === 'worker-retry-state/v1'
      && run.executionReceipt?.receiptChecksum
    ))
  );
  const persistenceIntegrity = persistenceSnapshot.integrity || {};
  const migrationFailedGateCount = migrationPlan.summary?.failedGateCount || migrationPlan.blockers?.length || 0;
  const dryRunFailedGateCount = migrationDryRun.summary?.failedGateCount || migrationDryRun.failedGates?.length || 0;

  const gates = [
    {
      id: 'worker-run-observable',
      label: 'Worker runs are observable',
      passed: workerRuns.length > 0 && Boolean(latestWorkerRun),
      detail: `${workerRuns.length} worker run(s), latest ${latestWorkerRun?.workerKind || latestWorkerRun?.trigger || 'none'}.`,
      apiPath: projectId ? `/projects/${projectId}/timeline` : null,
    },
    {
      id: 'queue-contract-observable',
      label: 'Queue contract exposes idempotency, lease, and retry data',
      passed: workerQueueSnapshot.schemaVersion === 'worker-queue-snapshot/v1'
        && Boolean(workerQueueSnapshot.retryPolicy?.idempotencyKey)
        && Boolean(workerQueueSnapshot.deadLetterPolicy?.deadLetterAfterAttempts)
        && [
          ...(workerQueueSnapshot.projectQueue || []),
          ...(workerQueueSnapshot.agentQueue || []),
        ].every((row) => row.idempotencyKey && row.leaseKey && row.retry?.schemaVersion === 'worker-retry-state/v1'),
      detail: `${queueSummary.projectQueuedCount || 0} queued project row(s), ${queueSummary.agentQueuedCount || 0} queued Agent row(s).`,
      apiPath: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
    },
    {
      id: 'worker-failure-recovery-contract',
      label: 'Worker retries, receipts, and dead-letter recovery are observable',
      passed: workerRecoveryContractReady,
      detail: `${workerExecutionReceipts.length}/${workerRuns.length} receipt(s), ${workerRetryableFailures.length} retryable failure(s), ${workerDeadLetters.length} dead-letter row(s).`,
      apiPath: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
    },
    {
      id: 'queue-adapter-dry-run',
      label: 'Production queue adapter dry-run passes locally',
      passed: workerQueueAdapterPlan.schemaVersion === 'worker-queue-adapter-plan/v1'
        && workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot'
        && workerQueueAdapterDryRun.schemaVersion === 'worker-queue-adapter-dry-run/v1'
        && workerQueueAdapterDryRun.status === 'passed',
      detail: `${queueAdapterDryRunSummary.dispatchCount || 0} dispatch(es), ${queueAdapterDryRunSummary.leaseAcquisitionCount || 0} lease(s), ${queueAdapterDryRunSummary.failedGateCount || 0} failed dry-run gate(s).`,
      apiPath: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
    },
    {
      id: 'audit-stream-observable',
      label: 'Security audit stream is observable, ordered, and hash-chained',
      passed: auditStreamSummary.count > 0
        && auditStreamSummary.sequenceGapCount === 0
        && auditStreamSummary.hashChainReady,
      detail: `${auditStreamSummary.count} audit stream row(s), ${auditStreamSummary.sequenceGapCount} sequence gap(s), ${auditStreamSummary.chainBreakCount || 0} chain break(s), ${auditStreamSummary.hashMismatchCount || 0} hash mismatch(es).`,
      apiPath: projectId ? `/projects/${projectId}/security-audit-stream` : null,
    },
    {
      id: 'persistence-recovery-source',
      label: 'Persistence snapshot can be used as recovery source',
      passed: persistenceSnapshot.schemaVersion === 'production-persistence-snapshot/v1'
        && persistenceIntegrity.status === 'ready'
        && (persistenceSnapshot.totalRecordCount || 0) > 0,
      detail: `${persistenceSnapshot.totalRecordCount || 0} normalized record(s), ${persistenceIntegrity.relationIssueCount || 0} relation issue(s).`,
      apiPath: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
    },
    {
      id: 'migration-dry-run-recoverable',
      label: 'Migration dry-run passes before cutover',
      passed: migrationPlan.status === 'ready-for-managed-database-pilot'
        && migrationDryRun.status === 'passed'
        && migrationFailedGateCount === 0
        && dryRunFailedGateCount === 0,
      detail: `${migrationFailedGateCount} migration-plan failed gate(s), ${dryRunFailedGateCount} dry-run failed gate(s).`,
      apiPath: projectId ? `/projects/${projectId}/persistence-migration-dry-run` : null,
    },
    {
      id: 'managed-persistence-adapter-cutover',
      label: 'Managed persistence adapter dry-run passes before database cutover',
      passed: persistenceAdapterPlan.schemaVersion === 'managed-persistence-adapter-plan/v1'
        && persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot'
        && persistenceAdapterDryRun.schemaVersion === 'managed-persistence-adapter-dry-run/v1'
        && persistenceAdapterDryRun.status === 'passed',
      detail: `${persistenceAdapterSummary.shadowReadParityCount || 0}/${persistenceAdapterSummary.shadowReadGroupCount || 0} shadow-read group(s), ${persistenceAdapterSummary.failedGateCount || 0} failed adapter gate(s).`,
      apiPath: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
    },
    {
      id: 'proof-surfaces-replayable',
      label: 'Proof surfaces can be replayed from backend state',
      passed: Boolean(
        mvpReadiness.readyForLocalPilot
        && managerDashboard.readinessProofMap?.routes?.length
        && managerDashboard.transcriptIndex?.channels?.length
        && eventLedger.length
      ),
      detail: `${managerDashboard.readinessProofMap?.routes?.length || 0} proof route(s), ${managerDashboard.transcriptIndex?.channels?.length || 0} transcript channel(s), ${eventLedger.length} event(s).`,
      apiPath: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
    },
    {
      id: 'security-boundary-visible',
      label: 'Security boundary and redaction health are visible',
      passed: securityBoundary.schemaVersion === 'security-boundary/v1'
        && securityBoundary.status === 'local-boundary-ready'
        && (securityBoundary.redactionScan?.rawLeakCount || 0) === 0,
      detail: `${securityBoundary.routeSummary?.routeKeys?.length || 0} route policy key(s), ${securityBoundary.redactionScan?.rawLeakCount || 0} raw leak(s).`,
      apiPath: projectId ? `/projects/${projectId}/security-boundary` : null,
    },
  ];
  const alertRules = [
    {
      id: 'audit-stream-gap',
      severity: 'critical',
      condition: 'securityAuditStream.sequenceGapCount > 0',
      route: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      recovery: 'Pause sensitive access, export audit stream, compare stream checksums, and replay missing access decisions from event ledger.',
    },
    {
      id: 'audit-stream-hash-chain-break',
      severity: 'critical',
      condition: 'securityAuditStream.hashChainReady != true',
      route: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      recovery: 'Freeze sensitive access, compare JSONL audit sink with snapshot rows, verify previousStreamHash/streamHash links, and preserve the mismatched files for incident review.',
    },
    {
      id: 'migration-dry-run-failed',
      severity: 'critical',
      condition: 'persistenceMigrationDryRun.status != passed',
      route: projectId ? `/projects/${projectId}/persistence-migration-dry-run` : null,
      recovery: 'Keep JSON/file store as source of truth, fix failed import gates, then rerun dry-run before database cutover.',
    },
    {
      id: 'persistence-adapter-dry-run-failed',
      severity: 'critical',
      condition: 'managedPersistenceAdapterDryRun.status != passed',
      route: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
      recovery: 'Keep JSON/file store as source of truth, inspect adapter plan gates, verify shadow-read parity, rollback, backup/restore, RLS, and audit stream cutover before database promotion.',
    },
    {
      id: 'queue-backlog-or-lease-stall',
      severity: 'warning',
      condition: 'workerQueueSnapshot.agentQueuedCount grows without worker_runs',
      route: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      recovery: 'Inspect queued rows, retry by idempotency key, and verify lease expiry before rerunning due workers.',
    },
    {
      id: 'queue-adapter-dry-run-failed',
      severity: 'critical',
      condition: 'workerQueueAdapterDryRun.status != passed',
      route: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
      recovery: 'Keep the local scheduler as source of truth, inspect adapter-plan gates, verify idempotency/lease/dispatch/receipt/dead-letter checks, then rerun the dry-run before queue cutover.',
    },
    {
      id: 'worker-dead-letter-nonempty',
      severity: 'critical',
      condition: 'workerQueueSnapshot.workerDeadLetterCount > 0',
      route: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      recovery: 'Inspect the dead-letter row, preserve the execution receipt, fix the failing worker input, then rerun the direct project or Agent worker route with the same idempotency key.',
    },
    {
      id: 'proof-surface-regression',
      severity: 'warning',
      condition: 'mvpReadiness.readyForLocalPilot becomes false',
      route: projectId ? `/projects/${projectId}/mvp-readiness` : null,
      recovery: 'Use Readiness Proof Map to identify missing transcript, timeline, event, submission, evidence, or review proof.',
    },
  ];
  const recoveryRunbook = [
    {
      step: 1,
      id: 'freeze-writes',
      action: 'Pause scheduler ticks and sensitive writes while preserving the file store snapshot.',
      evidenceRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
    },
    {
      step: 2,
      id: 'export-source-of-truth',
      action: 'Export persistence snapshot and verify relation integrity plus event-ledger contiguity.',
      evidenceRoute: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
    },
    {
      step: 3,
      id: 'verify-import',
      action: 'Run migration plan and dry-run; only cut over after checksum and primary-key gates pass.',
      evidenceRoute: projectId ? `/projects/${projectId}/persistence-migration-dry-run` : null,
    },
    {
      step: 4,
      id: 'verify-database-adapter',
      action: 'Run the managed persistence adapter plan and dry-run; only cut over after shadow-read, transaction rollback, backup/restore, RLS, and audit-stream gates pass.',
      evidenceRoute: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
    },
    {
      step: 5,
      id: 'rebuild-read-models',
      action: 'Regenerate Manager Dashboard, Flow Graph, MVP Readiness, and Security Boundary from normalized records.',
      evidenceRoute: projectId ? `/projects/${projectId}/manager-ready-package` : null,
    },
    {
      step: 6,
      id: 'verify-queue-adapter',
      action: 'Run the worker queue adapter plan and dry-run; only cut over after idempotency, lease, dispatch, receipt, and dead-letter gates pass.',
      evidenceRoute: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
    },
    {
      step: 7,
      id: 'resume-workers',
      action: 'Resume due workers using queue idempotency keys and lease checks, then compare proof routes and audit stream.',
      evidenceRoute: projectId ? `/projects/${projectId}/operations-readiness` : null,
    },
  ];
  const routedAlertRuleCount = alertRules.filter((rule) => rule.route).length;
  const criticalAlertRuleCount = alertRules.filter((rule) => rule.severity === 'critical').length;
  const executableRecoveryStepCount = recoveryRunbook.filter((step) => step.evidenceRoute).length;
  const incidentDrillReceipts = [
    {
      id: 'detect-runtime-alert',
      phase: 'detect',
      label: 'Runtime alert rules are defined with operator recovery notes',
      passed: alertRules.length >= 5
        && alertRules.every((rule) => rule.id && rule.severity && rule.condition && rule.recovery),
      evidenceRoute: projectId ? `/projects/${projectId}/operations-readiness` : null,
      observed: {
        alertRuleCount: alertRules.length,
        criticalAlertRuleCount,
      },
    },
    {
      id: 'route-alerts-to-proof-surfaces',
      phase: 'route',
      label: 'Every local alert points to a backend proof route',
      passed: alertRules.length > 0 && routedAlertRuleCount === alertRules.length,
      evidenceRoute: projectId ? `/projects/${projectId}/operations-readiness` : null,
      observed: {
        routedAlertRuleCount,
        alertRuleCount: alertRules.length,
      },
    },
    {
      id: 'freeze-writes-runbook-ready',
      phase: 'contain',
      label: 'Runbook can pause scheduler writes before recovery',
      passed: recoveryRunbook.some((step) => step.id === 'freeze-writes' && step.evidenceRoute),
      evidenceRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      observed: {
        recoveryStepCount: recoveryRunbook.length,
        executableRecoveryStepCount,
      },
    },
    {
      id: 'verify-persistence-recovery',
      phase: 'verify',
      label: 'Persistence source, adapter rollback, and backup restore are provable',
      passed: persistenceSnapshot.schemaVersion === 'production-persistence-snapshot/v1'
        && persistenceIntegrity.status === 'ready'
        && (persistenceSnapshot.totalRecordCount || 0) > 0
        && persistenceAdapterDryRun.status === 'passed'
        && Boolean(persistenceAdapterSummary.transactionRollbackReady)
        && Boolean(persistenceAdapterSummary.backupRestoreReady)
        && (persistenceAdapterSummary.shadowReadGroupCount || 0) > 0
        && persistenceAdapterSummary.shadowReadParityCount === persistenceAdapterSummary.shadowReadGroupCount,
      evidenceRoute: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
      observed: {
        persistenceRecordCount: persistenceSnapshot.totalRecordCount || 0,
        persistenceIntegrityStatus: persistenceIntegrity.status || 'unknown',
        persistenceAdapterDryRunStatus: persistenceAdapterDryRun.status || 'unknown',
        shadowReadParityCount: persistenceAdapterSummary.shadowReadParityCount || 0,
        shadowReadGroupCount: persistenceAdapterSummary.shadowReadGroupCount || 0,
        rollbackReady: Boolean(persistenceAdapterSummary.transactionRollbackReady),
        backupRestoreReady: Boolean(persistenceAdapterSummary.backupRestoreReady),
      },
    },
    {
      id: 'verify-queue-recovery',
      phase: 'verify',
      label: 'Queue adapter snapshot, leases, receipts, and recovery contract are provable',
      passed: workerRecoveryContractReady
        && workerQueueAdapterDryRun.status === 'passed'
        && Boolean(queueAdapterDryRunSummary.snapshotParityReady)
        && Boolean(queueAdapterDryRunSummary.snapshotLeaseParityReady),
      evidenceRoute: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
      observed: {
        queueAdapterDryRunStatus: workerQueueAdapterDryRun.status || 'unknown',
        queueAdapterSnapshotParityReady: Boolean(queueAdapterDryRunSummary.snapshotParityReady),
        queueAdapterSnapshotLeaseParityReady: Boolean(queueAdapterDryRunSummary.snapshotLeaseParityReady),
        workerExecutionReceiptCount: workerExecutionReceipts.length,
        workerRecoveryContractReady,
      },
    },
    {
      id: 'recover-dead-letter-path',
      phase: 'recover',
      label: 'Dead-letter policy and local recovery route are visible',
      passed: Boolean(workerQueueSnapshot.deadLetterPolicy?.schemaVersion === 'worker-dead-letter-policy/v1')
        && Boolean(queueAdapterDryRunSummary.snapshotDeadLetterParityReady)
        && workerDeadLetters.length === 0,
      evidenceRoute: projectId ? `/projects/${projectId}/worker-queue` : '/workers/queue-snapshot',
      observed: {
        workerDeadLetterCount: workerDeadLetters.length,
        queueAdapterSnapshotDeadLetterParityReady: Boolean(queueAdapterDryRunSummary.snapshotDeadLetterParityReady),
      },
    },
    {
      id: 'verify-audit-chain',
      phase: 'audit',
      label: 'Security audit stream is ordered and hash-chained for incident review',
      passed: auditStreamSummary.count > 0
        && auditStreamSummary.sequenceGapCount === 0
        && auditStreamSummary.hashChainReady,
      evidenceRoute: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      observed: {
        securityAuditStreamCount: auditStreamSummary.count,
        sequenceGapCount: auditStreamSummary.sequenceGapCount,
        hashChainReady: auditStreamSummary.hashChainReady,
        chainBreakCount: auditStreamSummary.chainBreakCount || 0,
      },
    },
    {
      id: 'replay-manager-proof-surfaces',
      phase: 'replay',
      label: 'Manager proof routes can replay the incident context after recovery',
      passed: Boolean(
        mvpReadiness.readyForLocalPilot
        && managerDashboard.readinessProofMap?.routes?.length
        && eventLedger.length
      ),
      evidenceRoute: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
      observed: {
        readyForLocalPilot: Boolean(mvpReadiness.readyForLocalPilot),
        proofRouteCount: managerDashboard.readinessProofMap?.routes?.length || 0,
        eventLedgerCount: eventLedger.length,
      },
    },
  ].map((receipt) => ({
    ...receipt,
    checkedAt: now,
    receiptChecksum: persistenceChecksum({
      id: receipt.id,
      phase: receipt.phase,
      passed: receipt.passed,
      evidenceRoute: receipt.evidenceRoute,
      observed: receipt.observed,
    }),
  }));
  const failedIncidentDrillReceipts = incidentDrillReceipts.filter((receipt) => !receipt.passed);
  const incidentDrillReady = failedIncidentDrillReceipts.length === 0
    && routedAlertRuleCount === alertRules.length
    && executableRecoveryStepCount === recoveryRunbook.length;
  const incidentDrillSummary = {
    alertRuleCount: alertRules.length,
    criticalAlertRuleCount,
    routedAlertRuleCount,
    recoveryStepCount: recoveryRunbook.length,
    executableRecoveryStepCount,
    receiptCount: incidentDrillReceipts.length,
    failedReceiptCount: failedIncidentDrillReceipts.length,
    queueAdapterSnapshotParityReady: Boolean(queueAdapterDryRunSummary.snapshotParityReady),
    queueAdapterSnapshotLeaseParityReady: Boolean(queueAdapterDryRunSummary.snapshotLeaseParityReady),
    queueAdapterSnapshotDeadLetterParityReady: Boolean(queueAdapterDryRunSummary.snapshotDeadLetterParityReady),
    persistenceAdapterRollbackReady: Boolean(persistenceAdapterSummary.transactionRollbackReady),
    persistenceAdapterBackupRestoreReady: Boolean(persistenceAdapterSummary.backupRestoreReady),
    securityAuditStreamHashChainReady: auditStreamSummary.hashChainReady,
  };
  const incidentDrillChecksum = persistenceChecksum({
    projectId,
    generatedAt: now,
    scenario: 'local-pilot-runtime-recovery',
    summary: incidentDrillSummary,
    receipts: incidentDrillReceipts.map((receipt) => ({
      id: receipt.id,
      phase: receipt.phase,
      passed: receipt.passed,
      receiptChecksum: receipt.receiptChecksum,
    })),
  });
  const incidentDrill = {
    schemaVersion: 'operations-incident-drill/v1',
    projectId,
    generatedAt: now,
    drillId: `incident-drill-${persistenceChecksum({ projectId, now, incidentDrillChecksum })}`,
    scenario: 'local-pilot-runtime-recovery',
    status: incidentDrillReady ? 'passed' : 'needs-operator-rehearsal',
    drillReady: incidentDrillReady,
    productionCutoverReady: false,
    summary: incidentDrillSummary,
    receipts: incidentDrillReceipts,
    failedReceipts: failedIncidentDrillReceipts,
    checksum: incidentDrillChecksum,
    nextRequiredProductionWork: incidentDrillReady
      ? 'Route these alert rules to centralized paging/incident ownership and rerun the rehearsal against managed database and queue infrastructure.'
      : 'Fix failed local incident drill receipts before pilot operations are considered ready.',
  };
  gates.push({
    id: 'incident-drill-rehearsal',
    label: 'Incident drill rehearsal is locally provable',
    passed: incidentDrill.drillReady,
    detail: `${incidentDrill.summary.receiptCount} drill receipt(s), ${incidentDrill.summary.failedReceiptCount} failed receipt(s), ${incidentDrill.summary.routedAlertRuleCount}/${incidentDrill.summary.alertRuleCount} routed alert(s).`,
    apiPath: projectId ? `/projects/${projectId}/operations-readiness` : null,
  });
  const failedGates = gates.filter((gate) => !gate.passed);

  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'operations-readiness/v1',
    status: failedGates.length ? 'needs-operations-hardening' : 'local-operations-contract-ready',
    readyForLocalPilot: failedGates.length === 0,
    readyForProduction: false,
    gates,
    failedGates,
    observability: {
      logStreams: [
        { id: 'timeline', route: projectId ? `/projects/${projectId}/timeline` : null, count: project.logs?.length || 0 },
        { id: 'event-ledger', route: projectId ? `/projects/${projectId}/events` : null, count: eventLedger.length },
        { id: 'security-audit-stream', route: projectId ? `/projects/${projectId}/security-audit-stream` : null, count: auditStreamSummary.count },
        { id: 'worker-runs', route: projectId ? `/projects/${projectId}/worker-queue` : null, count: workerRuns.length },
      ],
      metrics: {
        workerRunCount: workerRuns.length,
        latestWorkerRunAt: latestWorkerRun?.ranAt || latestWorkerRun?.time || latestWorkerRun?.startedAt || null,
        projectQueuedCount: queueSummary.projectQueuedCount || 0,
        agentQueuedCount: queueSummary.agentQueuedCount || 0,
        queueAdapterPlanReady: workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot',
        queueAdapterDryRunStatus: workerQueueAdapterDryRun.status || 'unknown',
        queueAdapterFailedGateCount: queueAdapterDryRunSummary.failedGateCount || 0,
        queueAdapterDispatchCount: queueAdapterDryRunSummary.dispatchCount || 0,
        queueAdapterLeaseAcquisitionCount: queueAdapterDryRunSummary.leaseAcquisitionCount || 0,
        queueAdapterMethodCount: queueAdapterPlanSummary.adapterMethodCount || 0,
        queueAdapterOperationCount: queueAdapterDryRunSummary.adapterOperationCount || 0,
        queueAdapterQueueRowCount: queueAdapterDryRunSummary.adapterQueueRowCount || 0,
        queueAdapterSnapshotParityReady: Boolean(queueAdapterDryRunSummary.snapshotParityReady),
        queueAdapterSnapshotQueueRowParityReady: Boolean(queueAdapterDryRunSummary.snapshotQueueRowParityReady),
        queueAdapterSnapshotLeaseParityReady: Boolean(queueAdapterDryRunSummary.snapshotLeaseParityReady),
        queueAdapterSnapshotAcknowledgementParityReady: Boolean(queueAdapterDryRunSummary.snapshotAcknowledgementParityReady),
        queueAdapterSnapshotDeadLetterParityReady: Boolean(queueAdapterDryRunSummary.snapshotDeadLetterParityReady),
        queueAdapterDriver: queueAdapterDryRunSummary.adapterDriver || 'unknown',
        queueAdapterStatus: queueAdapterDryRunSummary.adapterStatus || 'unknown',
        queueAdapterProductionCutoverReady: Boolean(queueAdapterDryRunSummary.adapterProductionCutoverReady),
        workerExecutionReceiptCount: workerExecutionReceipts.length,
        workerDeadLetterCount: workerDeadLetters.length,
        workerRetryableFailureCount: workerRetryableFailures.length,
        workerRecoveryContractReady,
        workerMaxAttempts: workerQueueSnapshot.retryPolicy?.maxAttempts || WORKER_QUEUE_MAX_ATTEMPTS,
        securityAuditStreamCount: auditStreamSummary.count,
        securityAuditStreamGapCount: auditStreamSummary.sequenceGapCount,
        securityAuditStreamHashChainReady: auditStreamSummary.hashChainReady,
        securityAuditStreamChainBreakCount: auditStreamSummary.chainBreakCount,
        securityAuditStreamHashMismatchCount: auditStreamSummary.hashMismatchCount,
        persistenceRecordCount: persistenceSnapshot.totalRecordCount || 0,
        persistenceRelationIssueCount: persistenceIntegrity.relationIssueCount || 0,
        migrationPlanFailedGateCount: migrationFailedGateCount,
        migrationDryRunFailedGateCount: dryRunFailedGateCount,
        persistenceAdapterPlanReady: persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot',
        persistenceAdapterDryRunStatus: persistenceAdapterDryRun.status || 'unknown',
        persistenceAdapterFailedGateCount: persistenceAdapterSummary.failedGateCount || 0,
        persistenceAdapterShadowReadGroupCount: persistenceAdapterSummary.shadowReadGroupCount || 0,
        persistenceAdapterShadowReadParityCount: persistenceAdapterSummary.shadowReadParityCount || 0,
        persistenceAdapterRollbackReady: Boolean(persistenceAdapterSummary.transactionRollbackReady),
        persistenceAdapterBackupRestoreReady: Boolean(persistenceAdapterSummary.backupRestoreReady),
        persistenceAdapterOperationCount: persistenceAdapterSummary.adapterOperationCount || 0,
        persistenceAdapterImportedTableCount: persistenceAdapterSummary.adapterImportedTableCount || 0,
        persistenceAdapterDriver: persistenceAdapterSummary.adapterDriver || 'unknown',
        persistenceAdapterStatus: persistenceAdapterSummary.adapterStatus || 'unknown',
        persistenceAdapterProductionCutoverReady: Boolean(persistenceAdapterSummary.adapterProductionCutoverReady),
        incidentDrillReady: incidentDrill.drillReady,
        incidentDrillStatus: incidentDrill.status,
        incidentDrillReceiptCount: incidentDrill.summary.receiptCount,
        incidentDrillFailedReceiptCount: incidentDrill.summary.failedReceiptCount,
        incidentDrillRoutedAlertRuleCount: incidentDrill.summary.routedAlertRuleCount,
        incidentDrillExecutableRecoveryStepCount: incidentDrill.summary.executableRecoveryStepCount,
        incidentDrillChecksum: incidentDrill.checksum,
      },
      alertRules,
    },
    recovery: {
      runbookVersion: 'operations-recovery-runbook/v1',
      runbookReady: true,
      steps: recoveryRunbook,
    },
    incidentDrill,
    productionGaps: [
      'Replace local log snapshots with centralized logs, metrics, traces, and alert routing.',
      'Implement the managed persistence adapter against an isolated managed database and rerun adapter dry-run before pilot traffic.',
      'Implement the queue adapter contract against production queue/cron infrastructure with durable leases, managed dead-letter storage, and recovery drills.',
      'Add incident ownership, recovery drills, retention policy, and backup restore tests.',
    ],
    backendRoutes: {
      managerReadyPackage: projectId ? `/projects/${projectId}/manager-ready-package` : null,
      mvpReadiness: projectId ? `/projects/${projectId}/mvp-readiness` : null,
      workerQueue: projectId ? `/projects/${projectId}/worker-queue` : null,
      workerQueueAdapterPlan: projectId ? `/projects/${projectId}/worker-queue-adapter-plan` : null,
      workerQueueAdapterDryRun: projectId ? `/projects/${projectId}/worker-queue-adapter-dry-run` : null,
      persistenceSnapshot: projectId ? `/projects/${projectId}/persistence-snapshot` : null,
      persistenceMigrationPlan: projectId ? `/projects/${projectId}/persistence-migration-plan` : null,
      persistenceMigrationDryRun: projectId ? `/projects/${projectId}/persistence-migration-dry-run` : null,
      persistenceAdapterPlan: projectId ? `/projects/${projectId}/persistence-adapter-plan` : null,
      persistenceAdapterDryRun: projectId ? `/projects/${projectId}/persistence-adapter-dry-run` : null,
      securityBoundary: projectId ? `/projects/${projectId}/security-boundary` : null,
      securityAuditStream: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      operationsReadiness: projectId ? `/projects/${projectId}/operations-readiness` : null,
    },
    summary: {
      gateCount: gates.length,
      passedGateCount: gates.filter((gate) => gate.passed).length,
      failedGateCount: failedGates.length,
      alertRuleCount: alertRules.length,
      recoveryStepCount: recoveryRunbook.length,
      workerRunCount: workerRuns.length,
      queueAdapterPlanReady: workerQueueAdapterPlan.status === 'ready-for-queue-adapter-pilot',
      queueAdapterDryRunStatus: workerQueueAdapterDryRun.status || 'unknown',
      queueAdapterFailedGateCount: queueAdapterDryRunSummary.failedGateCount || 0,
      queueAdapterDispatchCount: queueAdapterDryRunSummary.dispatchCount || 0,
      queueAdapterLeaseAcquisitionCount: queueAdapterDryRunSummary.leaseAcquisitionCount || 0,
      queueAdapterOperationCount: queueAdapterDryRunSummary.adapterOperationCount || 0,
      queueAdapterQueueRowCount: queueAdapterDryRunSummary.adapterQueueRowCount || 0,
      queueAdapterSnapshotParityReady: Boolean(queueAdapterDryRunSummary.snapshotParityReady),
      queueAdapterSnapshotQueueRowParityReady: Boolean(queueAdapterDryRunSummary.snapshotQueueRowParityReady),
      queueAdapterSnapshotLeaseParityReady: Boolean(queueAdapterDryRunSummary.snapshotLeaseParityReady),
      queueAdapterSnapshotAcknowledgementParityReady: Boolean(queueAdapterDryRunSummary.snapshotAcknowledgementParityReady),
      queueAdapterSnapshotDeadLetterParityReady: Boolean(queueAdapterDryRunSummary.snapshotDeadLetterParityReady),
      queueAdapterDriver: queueAdapterDryRunSummary.adapterDriver || 'unknown',
      queueAdapterStatus: queueAdapterDryRunSummary.adapterStatus || 'unknown',
      queueAdapterProductionCutoverReady: Boolean(queueAdapterDryRunSummary.adapterProductionCutoverReady),
      incidentDrillReady: incidentDrill.drillReady,
      incidentDrillStatus: incidentDrill.status,
      incidentDrillReceiptCount: incidentDrill.summary.receiptCount,
      incidentDrillFailedReceiptCount: incidentDrill.summary.failedReceiptCount,
      incidentDrillRoutedAlertRuleCount: incidentDrill.summary.routedAlertRuleCount,
      incidentDrillRecoveryStepCount: incidentDrill.summary.recoveryStepCount,
      incidentDrillExecutableRecoveryStepCount: incidentDrill.summary.executableRecoveryStepCount,
      incidentDrillChecksum: incidentDrill.checksum,
      workerExecutionReceiptCount: workerExecutionReceipts.length,
      workerDeadLetterCount: workerDeadLetters.length,
      workerRetryableFailureCount: workerRetryableFailures.length,
      workerRecoveryContractReady,
      securityAuditStreamCount: auditStreamSummary.count,
      securityAuditStreamHashChainReady: auditStreamSummary.hashChainReady,
      persistenceRecordCount: persistenceSnapshot.totalRecordCount || 0,
      migrationDryRunStatus: migrationDryRun.status || 'unknown',
      persistenceAdapterPlanReady: persistenceAdapterPlan.status === 'ready-for-managed-adapter-pilot',
      persistenceAdapterDryRunStatus: persistenceAdapterDryRun.status || 'unknown',
      persistenceAdapterFailedGateCount: persistenceAdapterSummary.failedGateCount || 0,
      persistenceAdapterShadowReadGroupCount: persistenceAdapterSummary.shadowReadGroupCount || 0,
      persistenceAdapterShadowReadParityCount: persistenceAdapterSummary.shadowReadParityCount || 0,
      persistenceAdapterRollbackReady: Boolean(persistenceAdapterSummary.transactionRollbackReady),
      persistenceAdapterBackupRestoreReady: Boolean(persistenceAdapterSummary.backupRestoreReady),
      persistenceAdapterOperationCount: persistenceAdapterSummary.adapterOperationCount || 0,
      persistenceAdapterImportedTableCount: persistenceAdapterSummary.adapterImportedTableCount || 0,
      persistenceAdapterDriver: persistenceAdapterSummary.adapterDriver || 'unknown',
      persistenceAdapterStatus: persistenceAdapterSummary.adapterStatus || 'unknown',
      persistenceAdapterProductionCutoverReady: Boolean(persistenceAdapterSummary.adapterProductionCutoverReady),
    },
  };
}

const RAW_SECRET_DETECTION_PATTERNS = [
  {
    id: 'json-secret-field',
    pattern: /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential|private[_-]?key)"\s*:\s*"(?!\[REDACTED\]|%5Bredacted%5D)[^"]{4,}"/ig,
  },
  {
    id: 'text-secret-assignment',
    pattern: /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential|private[_-]?key)\s*[:=]\s*(?!\[REDACTED\]|%5Bredacted%5D)["']?[^"',\s&}]{4,}/ig,
  },
  {
    id: 'bearer-token',
    pattern: /\bbearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}/ig,
  },
  {
    id: 'provider-key',
    pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    id: 'acceptance-secret-fixture',
    pattern: /\b[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY)[A-Z0-9_]*_SHOULD_NOT_LEAK_[A-Z0-9_]*\b/g,
  },
  {
    id: 'url-secret-param',
    pattern: /[?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential)=((?!\[REDACTED\]|%5Bredacted%5D)[^&#\s]{4,})/ig,
  },
];

function countLiteralOccurrences(text = '', needle = '') {
  if (!needle) return 0;
  let count = 0;
  let index = String(text || '').indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = String(text || '').indexOf(needle, index + needle.length);
  }
  return count;
}

function scanTextForRawSecretLeaks(text = '') {
  const source = String(text || '');
  const patterns = RAW_SECRET_DETECTION_PATTERNS.map(({ id, pattern }) => {
    pattern.lastIndex = 0;
    const matches = source.match(pattern) || [];
    return { id, count: matches.length };
  }).filter((item) => item.count > 0);
  return {
    detected: patterns.length > 0,
    count: patterns.reduce((sum, item) => sum + item.count, 0),
    patterns,
  };
}

function securityRoutePolicy({
  routeKey,
  pathTemplate,
  methods = ['GET'],
  actor = 'manager',
  capability,
  sensitivity = 'project-data',
  currentControl = 'project-scoped local route; prototype has no authenticated identity boundary',
  productionControl = 'requires authenticated project member, role-based authorization, and audit logging',
}) {
  return {
    routeKey,
    pathTemplate,
    methods,
    actor,
    capability,
    sensitivity,
    currentControl,
    productionControl,
    productionReady: false,
  };
}

function buildSecurityBoundarySnapshot({
  project = {},
  messages = [],
  managerDashboard = {},
  mvpReadiness = {},
  modelProviderStatus = {},
  searchProviderStatus = {},
  secretVaultStatus = {},
  securityAuditStreamRecords = [],
} = {}) {
  const projectId = project.id || managerDashboard.projectId || null;
  const scopedMessages = (messages || []).filter((message) => !projectId || message.projectId === projectId);
  const accessControlPolicy = buildAccessControlPolicySnapshot();
  const accessAuditSummary = summarizeSecurityAccessAudit(project.securityAccessAudit || []);
  const securityAuditStreamSummary = summarizeSecurityAuditStream(securityAuditStreamRecords);
  const projectMembershipSummary = summarizeProjectMembershipPolicy(project.projectMembershipPolicy || null);
  const identitySessionSummary = summarizeIdentitySessions(project);
  const safeSecretVaultStatus = normalizeSecretVaultStatus(secretVaultStatus || {});
  const routePolicies = [
    securityRoutePolicy({
      routeKey: 'project',
      pathTemplate: '/projects/:projectId',
      capability: 'read project snapshot',
      sensitivity: 'project-metadata',
    }),
    securityRoutePolicy({
      routeKey: 'manager-ready-package',
      pathTemplate: '/projects/:projectId/manager-ready-package',
      capability: 'read aggregate manager package',
      sensitivity: 'project-state-and-proof-routes',
    }),
    securityRoutePolicy({
      routeKey: 'manager-flow-graph',
      pathTemplate: '/projects/:projectId/manager-flow-graph',
      capability: 'read workflow graph and proof nodes',
      sensitivity: 'project-proof-surface',
    }),
    securityRoutePolicy({
      routeKey: 'readiness-proof-map',
      pathTemplate: '/projects/:projectId/readiness-proof-map',
      capability: 'read proof routes',
      sensitivity: 'project-proof-surface',
    }),
    securityRoutePolicy({
      routeKey: 'project-evidence-archive',
      pathTemplate: '/projects/:projectId/project-evidence-archive',
      capability: 'export manager-verifiable project evidence archive',
      sensitivity: 'project-export-evidence-bundle',
      currentControl: 'archive is generated from redacted backend state, manifest checksums, transcripts, submissions, reviews, evidence packets, Flow Graph, readiness proof, and runtime recovery summaries',
      productionControl: 'requires authenticated project membership, export approval, encrypted object storage, retention policy, watermarking/download audit, and customer-specific data residency controls',
    }),
    securityRoutePolicy({
      routeKey: 'project-evidence-exports',
      pathTemplate: '/projects/:projectId/project-evidence-exports',
      methods: ['GET', 'POST'],
      capability: 'request and approve project evidence archive handoff',
      sensitivity: 'project-export-approval-and-download-audit',
      currentControl: 'local workflow records export requests, manager/security approvals, retention metadata, data residency, archive checksum, timeline proof, and event-ledger proof before customer handoff',
      productionControl: 'requires authenticated project membership, approval enforcement, encrypted object storage, signed expiring download URLs, watermarking, retention deletion jobs, download audit, and data-residency controls',
    }),
    securityRoutePolicy({
      routeKey: 'submissions',
      pathTemplate: '/projects/:projectId/submissions',
      methods: ['GET'],
      capability: 'list and read Agent artifact submissions',
      sensitivity: 'artifact-content-and-source-refs',
    }),
    securityRoutePolicy({
      routeKey: 'agent-submission-create',
      pathTemplate: '/projects/:projectId/agents/:agentId/submissions',
      methods: ['POST'],
      actor: 'agent',
      capability: 'submit Agent artifact to flow graph',
      sensitivity: 'artifact-content-and-source-refs',
      currentControl: 'Agent id is route-scoped and artifact payload is redacted before persistence',
      productionControl: 'requires Agent runtime identity, scoped tool grants, write audit trail, and human/project policy',
    }),
    securityRoutePolicy({
      routeKey: 'evidence-searches',
      pathTemplate: '/projects/:projectId/evidence-searches',
      methods: ['GET'],
      capability: 'list and read evidence searches',
      sensitivity: 'source-refs-search-query-and-provider-output',
    }),
    securityRoutePolicy({
      routeKey: 'agent-evidence-search-create',
      pathTemplate: '/projects/:projectId/agents/:agentId/evidence-searches',
      methods: ['POST'],
      actor: 'agent',
      capability: 'record search/evidence packet',
      sensitivity: 'search-query-source-refs-and-provider-output',
      currentControl: 'provider status and source refs are redacted before storage',
      productionControl: 'requires provider allowlist, rate limits, budget limits, source safety checks, and Agent-scoped tool grants',
    }),
    securityRoutePolicy({
      routeKey: 'submission-reviews',
      pathTemplate: '/projects/:projectId/submission-reviews',
      methods: ['GET'],
      capability: 'list and read formal submission reviews',
      sensitivity: 'review-comments-and-requested-changes',
    }),
    securityRoutePolicy({
      routeKey: 'submission-review-create',
      pathTemplate: '/projects/:projectId/submissions/:submissionId/reviews',
      methods: ['POST'],
      actor: 'reviewer-agent',
      capability: 'write Reviewer verdict and change requests',
      sensitivity: 'review-comments-and-artifact-lineage',
      currentControl: 'Reviewer payload is redacted and linked to submission/revision proof',
      productionControl: 'requires Reviewer role grant, conflict-of-interest policy, and append-only review audit',
    }),
    securityRoutePolicy({
      routeKey: 'mvp-readiness',
      pathTemplate: '/projects/:projectId/mvp-readiness',
      capability: 'read launch readiness gate',
      sensitivity: 'launch-state-and-production-blockers',
    }),
    securityRoutePolicy({
      routeKey: 'pilot-launch-readiness',
      pathTemplate: '/projects/:projectId/pilot-launch-readiness',
      capability: 'read private pilot launch go/no-go package',
      sensitivity: 'launch-state-production-blockers-and-proof-routes',
      currentControl: 'aggregates local readiness gates, proof routes, and production blockers without raw artifact payloads',
      productionControl: 'requires admin/operator permission, launch approval workflow, centralized incident ownership, and change-management audit',
    }),
    securityRoutePolicy({
      routeKey: 'deployment-preflight',
      pathTemplate: '/projects/:projectId/deployment-preflight',
      capability: 'read deployment preflight configuration checklist',
      sensitivity: 'deployment-configuration-and-production-blockers',
      currentControl: 'returns redacted provider, adapter, scheduler, access-control, vault, and route readiness metadata',
      productionControl: 'requires operator/admin permission, managed secrets, durable audit, deployment approval, and environment change audit',
    }),
    securityRoutePolicy({
      routeKey: 'production-launch-audit',
      pathTemplate: '/projects/:projectId/production-launch-audit',
      capability: 'read unified production launch audit',
      sensitivity: 'private-pilot-production-decisions-blockers-and-proof-routes',
      currentControl: 'aggregates launch package, deployment preflight, evidence routes, and production blockers without raw provider secrets',
      productionControl: 'requires launch approval workflow, change-management audit, production owner sign-off, and centralized incident ownership',
    }),
    securityRoutePolicy({
      routeKey: 'launch-approvals',
      pathTemplate: '/projects/:projectId/launch-approvals',
      methods: ['GET', 'POST'],
      capability: 'read and write launch approval workflow decisions',
      sensitivity: 'release-approval-and-change-management-audit',
      currentControl: 'persists manager/security launch approvals into project state, timeline, and event ledger with checksums',
      productionControl: 'requires production owner sign-off, change-management audit retention, separation of duties, and deployment approval policy',
    }),
    securityRoutePolicy({
      routeKey: 'persistence-snapshot',
      pathTemplate: '/projects/:projectId/persistence-snapshot',
      capability: 'export normalized persistence contract',
      sensitivity: 'compact-project-records-and-checksums',
      currentControl: 'records are compacted, checksummed, and redacted before export',
      productionControl: 'requires admin-only export permission, encrypted transport, retention policy, and migration audit',
    }),
    securityRoutePolicy({
      routeKey: 'persistence-migration-plan',
      pathTemplate: '/projects/:projectId/persistence-migration-plan',
      capability: 'export managed database migration and cutover plan',
      sensitivity: 'database-schema-cutover-and-security-policy',
      currentControl: 'plan is generated from redacted persistence snapshot records and exposed only to security-admin in enforced mode',
      productionControl: 'requires admin-only export permission, change-management approval, migration audit, backup/restore testing, and database row-level policies',
    }),
    securityRoutePolicy({
      routeKey: 'persistence-migration-dry-run',
      pathTemplate: '/projects/:projectId/persistence-migration-dry-run',
      capability: 'verify managed database migration import without mutating production state',
      sensitivity: 'database-import-verification-and-security-policy',
      currentControl: 'dry-run simulates schema creation, seed import, checksum preservation, relation integrity, and RLS guidance from redacted snapshot records',
      productionControl: 'requires isolated staging database, transaction rollback, import audit, backup/restore validation, and DBA/security approval',
    }),
    securityRoutePolicy({
      routeKey: 'persistence-adapter-plan',
      pathTemplate: '/projects/:projectId/persistence-adapter-plan',
      capability: 'read managed persistence adapter and cutover plan',
      sensitivity: 'database-adapter-cutover-and-backup-policy',
      currentControl: 'plan is generated from redacted snapshot, migration gates, dry-run results, RLS drafts, and audit-stream continuity checks',
      productionControl: 'requires admin-only export permission, managed database change approval, backup/restore policy, shadow-read approval, and rollback owner',
    }),
    securityRoutePolicy({
      routeKey: 'persistence-adapter-dry-run',
      pathTemplate: '/projects/:projectId/persistence-adapter-dry-run',
      capability: 'verify managed persistence adapter cutover without mutating production state',
      sensitivity: 'database-shadow-read-rollback-and-cutover-metadata',
      currentControl: 'dry-run simulates shadow-read parity, transaction rollback, backup/restore manifest, audit-stream cutover, read-model checkpoints, and RLS coverage',
      productionControl: 'requires isolated staging database, transactional adapter, backup restore drill, shadow-read logs, rollback audit, and DBA/security approval',
    }),
    securityRoutePolicy({
      routeKey: 'worker-queue',
      pathTemplate: '/projects/:projectId/worker-queue',
      methods: ['GET', 'POST'],
      capability: 'preview project and Agent worker queue rows',
      sensitivity: 'schedule-state-and-run-routes',
      currentControl: 'preview is no-mutation and route scoped to the project',
      productionControl: 'requires scheduler service identity, lease enforcement, idempotency, and retry/audit logs',
    }),
    securityRoutePolicy({
      routeKey: 'worker-queue-adapter-plan',
      pathTemplate: '/projects/:projectId/worker-queue-adapter-plan',
      methods: ['GET'],
      actor: 'runtime-platform',
      capability: 'read production queue adapter and cutover plan',
      sensitivity: 'queue-cutover-schedule-and-runtime-metadata',
      currentControl: 'plan is generated from no-mutation queue snapshots and redacted worker receipts',
      productionControl: 'requires operator/admin permission, service identity review, and queue cutover approval',
    }),
    securityRoutePolicy({
      routeKey: 'worker-queue-adapter-dry-run',
      pathTemplate: '/projects/:projectId/worker-queue-adapter-dry-run',
      methods: ['GET'],
      actor: 'runtime-platform',
      capability: 'verify production queue adapter import without replacing the scheduler',
      sensitivity: 'queue-dispatch-lease-and-recovery-metadata',
      currentControl: 'dry-run simulates enqueue, lease, dispatch, receipt acknowledgement, retry, and dead-letter recovery without mutating worker state',
      productionControl: 'requires isolated queue namespace, runtime signing, operator audit, and rollback plan',
    }),
    securityRoutePolicy({
      routeKey: 'adapter-gateway-preflight',
      pathTemplate: '/projects/:projectId/adapter-gateway-preflight',
      methods: ['GET'],
      actor: 'runtime-platform',
      capability: 'verify private adapter gateway health, state, and advertised adapter capabilities',
      sensitivity: 'gateway-health-storage-and-queue-metadata',
      currentControl: 'local-shadow mode returns config proof; http-json mode performs live health/state/capability checks without approving production cutover',
      productionControl: 'requires private network isolation, managed gateway auth, real database/queue readback, backup/restore, monitoring, and production cutover approval',
    }),
    securityRoutePolicy({
      routeKey: 'operations-readiness',
      pathTemplate: '/projects/:projectId/operations-readiness',
      capability: 'read operations readiness, observability, alert, and recovery contract',
      sensitivity: 'runtime-health-security-and-recovery-metadata',
      currentControl: 'returns compact health metrics, routes, and recovery steps without raw artifact payloads',
      productionControl: 'requires operator/admin permission, centralized observability, alert routing, incident ownership, and restore drills',
    }),
    securityRoutePolicy({
      routeKey: 'provider-readiness',
      pathTemplate: '/projects/:projectId/provider-readiness',
      capability: 'read provider readiness and rollout blocker contract',
      sensitivity: 'provider-configuration-and-rollout-metadata',
      currentControl: 'returns redacted provider status, proof routes, local gates, and production rollout blockers without raw keys',
      productionControl: 'requires provider allowlists, budget/rate limits, Agent-scoped grants, provider audit ledger, and encrypted secret vault',
    }),
    securityRoutePolicy({
      routeKey: 'security-boundary',
      pathTemplate: '/projects/:projectId/security-boundary',
      capability: 'read security boundary contract',
      sensitivity: 'security-posture-metadata',
      currentControl: 'returns policy metadata and scan counts, never raw payload content',
      productionControl: 'requires security/admin permission and append-only access audit',
    }),
    securityRoutePolicy({
      routeKey: 'security-access-audit',
      pathTemplate: '/projects/:projectId/security-access-audit',
      capability: 'read security access audit',
      sensitivity: 'security-access-metadata',
      currentControl: 'returns compact access decisions with actor, route, status, reason, and event proof ids',
      productionControl: 'requires immutable centralized security logs and security/admin permission',
    }),
    securityRoutePolicy({
      routeKey: 'security-audit-stream',
      pathTemplate: '/projects/:projectId/security-audit-stream',
      capability: 'read backend security audit stream',
      sensitivity: 'security-access-metadata',
      currentControl: 'returns store-level access audit records with append order and checksums',
      productionControl: 'requires immutable centralized security logs, retention policy, and security/admin permission',
    }),
    securityRoutePolicy({
      routeKey: 'membership-policy',
      pathTemplate: '/projects/:projectId/membership-policy',
      methods: ['GET', 'PUT', 'POST'],
      actor: 'security-admin',
      capability: 'read and update project membership policy',
      sensitivity: 'project-membership-and-runtime-bindings',
      currentControl: 'policy is persisted in project state and enforced by signed access checks when membership mode is enabled',
      productionControl: 'requires database-backed membership tables, invitation/revocation workflow, row-level authorization, and admin audit logging',
    }),
    securityRoutePolicy({
      routeKey: 'identity-sessions',
      pathTemplate: '/projects/:projectId/identity-sessions',
      methods: ['GET', 'POST'],
      actor: 'security-admin',
      capability: 'read, issue, and revoke local identity sessions',
      sensitivity: 'identity-session-and-runtime-credential',
      currentControl: 'local identity-session tokens are returned once, token hashes are persisted, and session events are written to timeline and event ledger',
      productionControl: 'requires first-party IdP, durable session store, credential rotation, revocation workflow, replay-resistant bearer handling, and centralized audit',
    }),
    securityRoutePolicy({
      routeKey: 'global-worker-queue',
      pathTemplate: '/workers/queue-snapshot',
      methods: ['GET', 'POST'],
      actor: 'runtime-platform',
      capability: 'preview all project worker queues',
      sensitivity: 'cross-project-schedule-metadata',
      currentControl: 'preview is no-mutation but not identity-gated in prototype',
      productionControl: 'requires service-to-service authentication, workspace partitioning, and operator audit logging',
    }),
  ];

  const sensitiveFieldManifest = [
    {
      collection: 'provider_config',
      fields: ['apiKey', 'authorization', 'bearer token', 'secret-bearing endpoint query params'],
      currentControl: safeSecretVaultStatus.ready
        ? 'provider status uses hasApiKey booleans, redacted URLs, and a local encrypted secret-vault status contract'
        : 'provider status uses hasApiKey booleans and redacted URLs only',
      productionRequirement: 'store keys in encrypted vault with rotation, scope, and access audit',
    },
    {
      collection: 'agent_submissions',
      fields: ['title', 'summary', 'body', 'sourceRefs', 'artifact content'],
      currentControl: 'submission payloads and artifact drafts pass through redaction before persistence',
      productionRequirement: 'add tenant/project permissions and encrypted artifact storage',
    },
    {
      collection: 'evidence_searches',
      fields: ['query', 'purpose', 'findings', 'source.url', 'source.summary'],
      currentControl: 'provider outputs, source URLs, and summaries are redacted before storage',
      productionRequirement: 'add search provider allowlists, prompt-injection review, and source isolation',
    },
    {
      collection: 'submission_reviews',
      fields: ['comments', 'requestedChanges', 'lineage refs'],
      currentControl: 'review text is redacted and linked to append-style proof records',
      productionRequirement: 'enforce Reviewer role grants and immutable review audit',
    },
    {
      collection: 'project_messages_and_events',
      fields: ['message text', 'event payload', 'timeline log text', 'task sourceRefs'],
      currentControl: 'messages, logs, task evidence, and event payloads receive compact/redacted proof records',
      productionRequirement: 'append-only ledger, replay retention policy, and access-filtered transcripts',
    },
    {
      collection: 'identity_sessions',
      fields: ['tokenHash', 'issuerId', 'userId', 'agentId', 'scope'],
      currentControl: 'raw session tokens are returned once to the caller, only token hashes/checksums and redacted public rows are persisted or exposed',
      productionRequirement: 'move session issuance to a real IdP/session store with rotation, revocation, audience binding, and centralized audit',
    },
  ];

  const scannedCollections = [
    ['project', project],
    ['projectMessages', scopedMessages],
    ['managerDashboard', managerDashboard],
    ['mvpReadiness', mvpReadiness],
    ['modelProviderStatus', modelProviderStatus],
    ['searchProviderStatus', searchProviderStatus],
    ['secretVaultStatus', safeSecretVaultStatus],
    ['projectMembershipPolicy', project.projectMembershipPolicy || {}],
    ['projectMembershipAudit', project.projectMembershipAudit || []],
    ['identitySessions', project.identitySessions || []],
    ['securityAccessAudit', project.securityAccessAudit || []],
    ['securityAuditStream', securityAuditStreamRecords || []],
  ].map(([name, value]) => {
    const rawText = stableJson(value || {});
    const safeValue = redactSensitiveObject(value || {});
    const safeText = stableJson(safeValue);
    const rawLeakScan = scanTextForRawSecretLeaks(rawText);
    const responseLeakScan = scanTextForRawSecretLeaks(safeText);
    return {
      name,
      checksum: persistenceChecksum(safeValue),
      approxBytes: rawText.length,
      redactedApproxBytes: safeText.length,
      redactionMarkerCount: countLiteralOccurrences(rawText, REDACTED) + countLiteralOccurrences(safeText, REDACTED),
      rawLeakDetected: rawLeakScan.detected,
      rawLeakCount: rawLeakScan.count,
      rawLeakPatterns: rawLeakScan.patterns,
      responseLeakDetected: responseLeakScan.detected,
      responseLeakCount: responseLeakScan.count,
    };
  });
  const rawLeakCount = scannedCollections.reduce((sum, row) => sum + row.rawLeakCount, 0);
  const responseLeakCount = scannedCollections.reduce((sum, row) => sum + row.responseLeakCount, 0);
  const redactionMarkerCount = scannedCollections.reduce((sum, row) => sum + row.redactionMarkerCount, 0);

  const productionRows = [
    {
      id: 'identity-authentication',
      label: 'Authenticated user and service identity',
      status: identitySessionSummary.activeCount > 0 ? 'local-control-ready' : 'blocked',
      owner: 'security-platform',
      detail: identitySessionSummary.activeCount > 0
        ? `Local identity-session/v1 is issuing hashed session rows with ${identitySessionSummary.activeCount} active session(s), but production still needs real user/service identities, durable sessions, issued/rotated runtime credentials, and replay protection.`
        : 'The API has an enforceable role decision contract plus optional signed access headers, but production still needs real user/service identities, sessions, issued/rotated runtime credentials, and replay protection.',
    },
    {
      id: 'project-rbac',
      label: 'Project-level RBAC',
      status: 'blocked',
      owner: 'security-platform',
      detail: projectMembershipSummary.configured
        ? 'Project state now stores a project-membership-policy/v1 record with runtime bindings and revocations, but production still needs database-backed membership, invitations, revocation workflow, and row-level enforcement.'
        : 'Prototype role checks cover Manager, Agent, Reviewer, runtime, security-admin, and observer capabilities; production still needs durable project membership policy, database-backed membership, and row-level enforcement.',
    },
    {
      id: 'encrypted-secret-vault',
      label: 'Encrypted BYOK secret vault',
      status: safeSecretVaultStatus.ready && safeSecretVaultStatus.rotationSupported && safeSecretVaultStatus.latestRotation
        ? 'local-control-ready'
        : 'blocked',
      owner: 'security-platform',
      detail: safeSecretVaultStatus.ready && safeSecretVaultStatus.latestRotation
        ? `Local ${safeSecretVaultStatus.provider} vault contract is configured with ${safeSecretVaultStatus.encryptedRecordCount} encrypted record(s) and rotation receipt ${safeSecretVaultStatus.latestRotation.checksum || 'available'}; production still needs managed KMS, revocation, and access audit.`
        : 'Provider secrets are not returned or persisted in test fixtures, but production needs encrypted storage, rotation, and revocation.',
    },
    {
      id: 'access-audit-log',
      label: 'Access audit log',
      status: 'blocked',
      owner: 'operations',
      detail: 'Prototype enforced-mode access decisions are written into the project audit ledger, event ledger, and backend audit stream; production still needs immutable centralized security logs and retention policy.',
    },
    {
      id: 'boundary-hardening',
      label: 'Boundary hardening and abuse controls',
      status: 'blocked',
      owner: 'runtime-platform',
      detail: 'Production needs origin policy, rate limits, provider budget limits, prompt-injection checks, and dependency scanning.',
    },
  ];

  return {
    projectId,
    generatedAt: nowIso(),
    schemaVersion: 'security-boundary/v1',
    status: rawLeakCount || responseLeakCount ? 'needs-attention' : 'local-boundary-ready',
    boundaryMode: 'prototype-open-with-enforceable-access-decision-contract',
    readyForLocalPilot: rawLeakCount === 0 && responseLeakCount === 0,
    readyForProduction: false,
    accessControl: accessControlPolicy,
    projectMembership: {
      ...projectMembershipSummary,
      apiPath: projectId ? `/projects/${projectId}/membership-policy` : null,
      auditCount: project.projectMembershipAudit?.length || 0,
      latestAuditId: project.projectMembershipAudit?.[0]?.id || null,
      storage: projectMembershipSummary.configured ? 'project-state' : 'not-configured',
      productionRequirement: 'database-backed project membership, runtime identity binding, invitation/revocation workflow, and row-level authorization',
    },
    identitySessions: {
      ...identitySessionSummary,
      apiPath: projectId ? `/projects/${projectId}/identity-sessions` : null,
      storage: identitySessionSummary.configured ? 'project-state-token-hash-only' : 'not-configured',
      tokenContract: {
        schemaVersion: 'identity-session-token/v1',
        returnedOnce: true,
        storage: 'token-hash-only',
        header: 'x-hofs-session-token',
      },
      rows: (project.identitySessions || []).slice(0, 20).map((session) => publicIdentitySession(session)),
      productionRequirement: 'first-party identity provider, durable session store, credential rotation, revocation workflow, audience binding, and centralized audit',
    },
    accessAudit: {
      ...accessAuditSummary,
      apiPath: projectId ? `/projects/${projectId}/security-access-audit` : null,
      streamApiPath: projectId ? `/projects/${projectId}/security-audit-stream` : null,
      stream: {
        ...securityAuditStreamSummary,
        storage: {
          status: securityAuditStreamSummary.count ? 'prototype-store-backed' : 'waiting-for-enforced-traffic',
          migrationTarget: 'security_audit_stream',
          productionRequirement: 'immutable centralized audit storage',
        },
      },
      eventIds: (project.eventLedger || [])
        .filter((event) => event.type === 'security-access')
        .map((event) => event.id)
        .filter(Boolean)
        .slice(-40),
    },
    providerBoundary: {
      modelProviderStatus: redactSensitiveObject(modelProviderStatus || {}),
      searchProviderStatus: redactSensitiveObject(searchProviderStatus || {}),
      exposedSecrets: rawLeakCount > 0 || responseLeakCount > 0,
      statusContract: 'provider status may expose configured/hasApiKey booleans and redacted URLs, never raw keys',
    },
    secretVault: {
      ...safeSecretVaultStatus,
      statusContract: 'secret-vault status may expose provider, key id, counts, and readiness, never key material or plaintext secrets',
    },
    routePolicies,
    routeSummary: {
      count: routePolicies.length,
      routeKeys: routePolicies.map((route) => route.routeKey),
      productionReadyCount: routePolicies.filter((route) => route.productionReady).length,
      productionBlockedCount: routePolicies.filter((route) => !route.productionReady).length,
    },
    sensitiveFieldManifest,
    redactionScan: {
      status: rawLeakCount || responseLeakCount ? 'needs-attention' : 'ready',
      scannedCollectionCount: scannedCollections.length,
      redactionMarkerCount,
      rawLeakDetected: rawLeakCount > 0,
      rawLeakCount,
      responseLeakDetected: responseLeakCount > 0,
      responseLeakCount,
      collections: scannedCollections,
    },
    production: {
      status: 'production-blocked',
      blockerCount: productionRows.length,
      rows: productionRows,
    },
    summary: {
      routePolicyCount: routePolicies.length,
      sensitiveCollectionCount: sensitiveFieldManifest.length,
      redactionMarkerCount,
      rawLeakCount,
      responseLeakCount,
      mvpStatus: mvpReadiness.status || 'unknown',
      mvpReadyForLocalPilot: Boolean(mvpReadiness.readyForLocalPilot),
      productionBlockerCount: productionRows.length,
      accessControlStatus: accessControlPolicy.status,
      accessAuditCount: accessAuditSummary.count,
      accessDeniedCount: accessAuditSummary.deniedCount,
      securityAuditStreamCount: securityAuditStreamSummary.count,
      securityAuditStreamGapCount: securityAuditStreamSummary.sequenceGapCount,
      identitySessionCount: identitySessionSummary.count,
      identitySessionActiveCount: identitySessionSummary.activeCount,
      identitySessionRevokedCount: identitySessionSummary.revokedCount,
      identitySessionExpiredCount: identitySessionSummary.expiredCount,
      secretVaultReady: safeSecretVaultStatus.ready,
      secretVaultEncryptedRecordCount: safeSecretVaultStatus.encryptedRecordCount,
      secretVaultRawSecretRecordCount: safeSecretVaultStatus.rawSecretRecordCount,
      secretVaultRotationSupported: Boolean(safeSecretVaultStatus.rotationSupported),
      secretVaultRotationReady: Boolean(safeSecretVaultStatus.latestRotation && safeSecretVaultStatus.latestRotation.failedRecordCount === 0),
      secretVaultLatestRotationChecksum: safeSecretVaultStatus.latestRotation?.checksum || null,
    },
  };
}

function parsePolicyBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function parsePolicyList(value = '') {
  if (Array.isArray(value)) return uniqueStrings(value.map((item) => String(item || '').trim()).filter(Boolean));
  return uniqueStrings(String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean));
}

function parsePolicyNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parsePolicyNumberList(value = '', fallback = []) {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const numbers = items
    .map((item) => Number(String(item || '').trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);
  return numbers.length ? numbers : fallback;
}

function normalizeProviderToolGrants(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([agentId, grants]) => [
    String(agentId || '*'),
    parsePolicyList(grants),
  ]));
}

function normalizeProviderControlPolicy(policy = {}, env = globalThis.process?.env || {}) {
  const allowedModelProviders = parsePolicyList(policy.allowedModelProviders || env.PROVIDER_ALLOWED_MODEL_PROVIDERS || env.MODEL_ALLOWED_PROVIDERS || '');
  const allowedSearchProviders = parsePolicyList(policy.allowedSearchProviders || env.PROVIDER_ALLOWED_SEARCH_PROVIDERS || env.SEARCH_ALLOWED_PROVIDERS || '');
  const allowedModels = parsePolicyList(policy.allowedModels || env.PROVIDER_ALLOWED_MODELS || env.MODEL_ALLOWED_MODELS || '');
  const allowedSearchEndpointHosts = parsePolicyList(policy.allowedSearchEndpointHosts || env.PROVIDER_ALLOWED_SEARCH_ENDPOINT_HOSTS || env.SEARCH_ALLOWED_ENDPOINT_HOSTS || '');
  const defaultToolGrants = parsePolicyList(policy.defaultToolGrants || env.PROVIDER_DEFAULT_TOOL_GRANTS || 'provider:test,model:kickoff,model:intent,search:evidence');
  const agentToolGrants = normalizeProviderToolGrants(policy.agentToolGrants || {});
  const maxRequestsPerProjectHour = Math.max(0, Number(policy.maxRequestsPerProjectHour ?? policy.maxRequestsPerProjectPerHour ?? env.PROVIDER_MAX_REQUESTS_PER_PROJECT_HOUR ?? env.PROVIDER_MAX_REQUESTS_PER_PROJECT_PER_HOUR ?? 0) || 0);
  const dailyBudgetCents = Math.max(0, Number(policy.dailyBudgetCents ?? policy.maxDailyCostCents ?? env.PROVIDER_DAILY_BUDGET_CENTS ?? env.PROVIDER_MAX_DAILY_COST_CENTS ?? 0) || 0);
  const modelCostCentsPer1kTokens = Math.max(0, Number(policy.modelCostCentsPer1kTokens ?? env.PROVIDER_MODEL_COST_CENTS_PER_1K_TOKENS ?? 0) || 0);
  const searchCostCentsPerRequest = Math.max(0, Number(policy.searchCostCentsPerRequest ?? env.PROVIDER_SEARCH_COST_CENTS_PER_REQUEST ?? 0) || 0);
  const failurePolicyConfigured = Boolean(
    policy.retryAttempts !== undefined
    || policy.providerRetryAttempts !== undefined
    || env.PROVIDER_RETRY_ATTEMPTS !== undefined
    || policy.retryBackoffMs !== undefined
    || policy.retryBackoffMilliseconds !== undefined
    || env.PROVIDER_RETRY_BACKOFF_MS !== undefined
    || policy.circuitFailureThreshold !== undefined
    || policy.providerCircuitFailureThreshold !== undefined
    || env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD !== undefined
    || policy.circuitWindowMinutes !== undefined
    || policy.providerCircuitWindowMinutes !== undefined
    || env.PROVIDER_CIRCUIT_WINDOW_MINUTES !== undefined
    || policy.circuitCooldownSeconds !== undefined
    || policy.providerCircuitCooldownSeconds !== undefined
    || env.PROVIDER_CIRCUIT_COOLDOWN_SECONDS !== undefined
  );
  const retryAttempts = Math.max(0, parsePolicyNumber(policy.retryAttempts ?? policy.providerRetryAttempts ?? env.PROVIDER_RETRY_ATTEMPTS, 1));
  const retryBackoffMs = parsePolicyNumberList(policy.retryBackoffMs ?? policy.retryBackoffMilliseconds ?? env.PROVIDER_RETRY_BACKOFF_MS, [0]);
  const circuitFailureThreshold = Math.max(1, parsePolicyNumber(policy.circuitFailureThreshold ?? policy.providerCircuitFailureThreshold ?? env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD, 3));
  const circuitWindowMinutes = Math.max(1, parsePolicyNumber(policy.circuitWindowMinutes ?? policy.providerCircuitWindowMinutes ?? env.PROVIDER_CIRCUIT_WINDOW_MINUTES, 15));
  const circuitCooldownSeconds = Math.max(1, parsePolicyNumber(policy.circuitCooldownSeconds ?? policy.providerCircuitCooldownSeconds ?? env.PROVIDER_CIRCUIT_COOLDOWN_SECONDS, 300));
  const explicitlyEnabled = policy.enabled ?? env.PROVIDER_CONTROL_ENABLED;
  const configured = Boolean(
    explicitlyEnabled !== undefined
    || allowedModelProviders.length
    || allowedSearchProviders.length
    || allowedModels.length
    || allowedSearchEndpointHosts.length
    || Object.keys(agentToolGrants).length
    || maxRequestsPerProjectHour
    || dailyBudgetCents
    || failurePolicyConfigured
  );
  const enabled = parsePolicyBoolean(explicitlyEnabled, configured);
  const mode = String(policy.mode || policy.enforcementMode || env.PROVIDER_CONTROL_MODE || (enabled ? 'enforced' : 'audit-only')).toLowerCase();

  return {
    schemaVersion: 'provider-control-policy/v1',
    configured,
    enabled,
    mode,
    enforcementEnabled: Boolean(configured && enabled && mode === 'enforced'),
    allowedModelProviders,
    allowedSearchProviders,
    allowedModels,
    allowedSearchEndpointHosts,
    maxRequestsPerProjectHour,
    dailyBudgetCents,
    currency: policy.currency || env.PROVIDER_BUDGET_CURRENCY || 'USD',
    modelCostCentsPer1kTokens,
    searchCostCentsPerRequest,
    defaultToolGrants,
    agentToolGrants,
    retryPolicy: {
      schemaVersion: 'provider-retry-policy/v1',
      configured: failurePolicyConfigured,
      attempts: retryAttempts,
      backoffMs: retryBackoffMs,
      retryableStatuses: ['failed', 'timeout', 'provider-error'],
    },
    circuitBreaker: {
      schemaVersion: 'provider-circuit-breaker-policy/v1',
      configured: failurePolicyConfigured,
      failureThreshold: circuitFailureThreshold,
      windowMinutes: circuitWindowMinutes,
      cooldownSeconds: circuitCooldownSeconds,
      mode: 'consecutive-failures-per-kind-provider',
    },
    productionRequirement: 'Move provider policy, budgets, tool grants, and usage audit to managed persistence before production rollout.',
  };
}

function providerToolGranted(policy = {}, agentId = '', toolId = '') {
  if (!policy.configured || !policy.enabled) return true;
  const normalizedTool = String(toolId || '');
  if (!normalizedTool) return true;
  const defaultGrants = new Set(policy.defaultToolGrants || []);
  const wildcardGrants = new Set(policy.agentToolGrants?.['*'] || []);
  const agentGrants = new Set(policy.agentToolGrants?.[agentId] || []);
  return defaultGrants.has(normalizedTool) || wildcardGrants.has(normalizedTool) || agentGrants.has(normalizedTool);
}

function sameUtcDay(a, b) {
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (!Number.isFinite(dateA.getTime()) || !Number.isFinite(dateB.getTime())) return false;
  return dateA.getUTCFullYear() === dateB.getUTCFullYear()
    && dateA.getUTCMonth() === dateB.getUTCMonth()
    && dateA.getUTCDate() === dateB.getUTCDate();
}

function summarizeProviderUsageLedger(records = [], now = nowIso()) {
  const nowMs = Date.parse(now) || Date.now();
  const hourStartMs = nowMs - 60 * 60 * 1000;
  const rows = Array.isArray(records) ? records : [];
  const hourlyRows = rows.filter((row) => (Date.parse(row.completedAt || row.startedAt || row.time || '') || 0) >= hourStartMs);
  const dailyRows = rows.filter((row) => sameUtcDay(row.completedAt || row.startedAt || row.time, now));
  const costCents = (items) => items.reduce((sum, row) => sum + (Number(row.costCents) || 0), 0);
  return {
    count: rows.length,
    allowedCount: rows.filter((row) => row.allowed).length,
    deniedCount: rows.filter((row) => row.allowed === false).length,
    failedCount: rows.filter((row) => row.ok === false && row.allowed !== false).length,
    hourlyRequestCount: hourlyRows.length,
    dailyRequestCount: dailyRows.length,
    hourlyCostCents: costCents(hourlyRows),
    dailyCostCents: costCents(dailyRows),
    totalCostCents: costCents(rows),
    latestRecordId: rows[0]?.id || null,
    latestEventId: rows[0]?.eventId || null,
  };
}

function estimateProviderCostCents({ kind = '', result = {}, policy = {}, estimatedCostCents = null } = {}) {
  if (estimatedCostCents !== null && estimatedCostCents !== undefined) {
    return Math.max(0, Number(estimatedCostCents) || 0);
  }
  if (kind === 'search') return Math.max(0, Number(policy.searchCostCentsPerRequest) || 0);
  const usage = result?.usage || {};
  const tokens = Number(usage.total_tokens ?? usage.totalTokens ?? usage.input_tokens + usage.output_tokens ?? 0) || 0;
  return Math.round((tokens / 1000) * (Number(policy.modelCostCentsPer1kTokens) || 0));
}

function evaluateProviderPolicy({
  project = {},
  policy = {},
  kind = 'search',
  operation = 'search:evidence',
  providerStatus = {},
  agentId = '',
  model = '',
  estimatedCostCents = 0,
  now = nowIso(),
} = {}) {
  const usage = summarizeProviderUsageLedger(project.providerUsageLedger || [], now);
  const reasons = [];
  const provider = providerStatus.provider || 'unknown';
  const resolvedModel = model || providerStatus.model || '';
  if (policy.configured && policy.enabled) {
    if (kind === 'model' && policy.allowedModelProviders?.length && !policy.allowedModelProviders.includes(provider)) {
      reasons.push('provider-not-allowlisted');
    }
    if (kind === 'search' && policy.allowedSearchProviders?.length && !policy.allowedSearchProviders.includes(provider)) {
      reasons.push('provider-not-allowlisted');
    }
    if (kind === 'model' && policy.allowedModels?.length && resolvedModel && !policy.allowedModels.includes(resolvedModel)) {
      reasons.push('model-not-allowlisted');
    }
    if (!providerToolGranted(policy, agentId || '*', operation)) {
      reasons.push('agent-tool-grant-missing');
    }
    if (policy.maxRequestsPerProjectHour > 0 && usage.hourlyRequestCount >= policy.maxRequestsPerProjectHour) {
      reasons.push('hourly-rate-limit-exceeded');
    }
    if (policy.dailyBudgetCents > 0 && usage.dailyCostCents + (Number(estimatedCostCents) || 0) > policy.dailyBudgetCents) {
      reasons.push('daily-budget-exceeded');
    }
  }
  const wouldDeny = reasons.length > 0;
  return {
    allowed: !wouldDeny || !policy.enforcementEnabled,
    wouldDeny,
    reasons,
    reason: reasons[0] || 'allowed',
    enforcementEnabled: Boolean(policy.enforcementEnabled),
    policyConfigured: Boolean(policy.configured),
    usage,
  };
}

function providerFailureReason(row = {}) {
  return row.decisionReason || row.reason || row.status || (row.ok === false ? 'provider-call-failed' : '');
}

function isProviderFailureRow(row = {}) {
  if (!row || row.allowed === false) return false;
  if (row.ok === false) return true;
  return ['failed', 'timeout', 'provider-error'].includes(String(row.status || '').toLowerCase());
}

function providerCircuitRow({
  rows = [],
  policy = {},
  kind = 'search',
  provider = 'unknown',
  now = nowIso(),
} = {}) {
  const breaker = policy.circuitBreaker || {};
  const failureThreshold = Math.max(1, Number(breaker.failureThreshold) || 3);
  const windowMs = Math.max(1, Number(breaker.windowMinutes) || 15) * 60 * 1000;
  const cooldownMs = Math.max(1, Number(breaker.cooldownSeconds) || 300) * 1000;
  const nowMs = Date.parse(now) || Date.now();
  const matchingRows = (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row.kind || '') === String(kind || '') && String(row.provider || 'unknown') === String(provider || 'unknown'))
    .filter((row) => (Date.parse(row.completedAt || row.startedAt || row.time || '') || 0) >= nowMs - windowMs)
    .sort((a, b) => (Date.parse(b.completedAt || b.startedAt || b.time || '') || 0) - (Date.parse(a.completedAt || a.startedAt || a.time || '') || 0));
  const latestSuccess = matchingRows.find((row) => row.ok === true && row.allowed !== false);
  const latestSuccessMs = latestSuccess ? (Date.parse(latestSuccess.completedAt || latestSuccess.startedAt || latestSuccess.time || '') || 0) : 0;
  const consecutiveFailureRows = matchingRows.filter((row) => {
    const rowMs = Date.parse(row.completedAt || row.startedAt || row.time || '') || 0;
    return rowMs > latestSuccessMs && isProviderFailureRow(row);
  });
  const latestFailure = consecutiveFailureRows[0] || null;
  const latestFailureMs = latestFailure ? (Date.parse(latestFailure.completedAt || latestFailure.startedAt || latestFailure.time || '') || 0) : 0;
  const openUntilMs = latestFailureMs && consecutiveFailureRows.length >= failureThreshold
    ? latestFailureMs + cooldownMs
    : 0;
  const state = !breaker.configured
    ? 'not-configured'
    : consecutiveFailureRows.length < failureThreshold
      ? 'closed'
      : openUntilMs > nowMs
        ? 'open'
        : 'half-open';
  return {
    kind,
    provider,
    state,
    configured: Boolean(breaker.configured),
    failureThreshold,
    windowMinutes: Number(breaker.windowMinutes) || 15,
    cooldownSeconds: Number(breaker.cooldownSeconds) || 300,
    consecutiveFailureCount: consecutiveFailureRows.length,
    latestFailureAt: latestFailure?.completedAt || latestFailure?.startedAt || null,
    latestFailureReason: latestFailure ? providerFailureReason(latestFailure) : null,
    latestSuccessAt: latestSuccess?.completedAt || latestSuccess?.startedAt || null,
    openUntil: openUntilMs ? new Date(openUntilMs).toISOString() : null,
    blocked: state === 'open',
  };
}

function summarizeProviderCircuitBreakers({
  project = {},
  policy = {},
  modelProviderStatus = {},
  searchProviderStatus = {},
  now = nowIso(),
} = {}) {
  const rows = project.providerUsageLedger || [];
  const modelProvider = modelProviderStatus.provider || 'unknown';
  const searchProvider = searchProviderStatus.provider || 'unknown';
  const circuitRows = [
    providerCircuitRow({ rows, policy, kind: 'model', provider: modelProvider, now }),
    providerCircuitRow({ rows, policy, kind: 'search', provider: searchProvider, now }),
  ];
  const configured = Boolean(policy.circuitBreaker?.configured && policy.retryPolicy?.configured);
  return {
    schemaVersion: 'provider-failure-control/v1',
    configured,
    retryPolicy: policy.retryPolicy || null,
    circuitBreakerPolicy: policy.circuitBreaker || null,
    rows: circuitRows,
    openCircuitCount: circuitRows.filter((row) => row.state === 'open').length,
    halfOpenCircuitCount: circuitRows.filter((row) => row.state === 'half-open').length,
    closedCircuitCount: circuitRows.filter((row) => row.state === 'closed').length,
    failureCount: circuitRows.reduce((sum, row) => sum + (Number(row.consecutiveFailureCount) || 0), 0),
    ready: configured && circuitRows.every((row) => row.state !== 'not-configured'),
  };
}

function evaluateProviderCircuitBreaker({
  project = {},
  policy = {},
  kind = 'search',
  providerStatus = {},
  now = nowIso(),
} = {}) {
  const row = providerCircuitRow({
    rows: project.providerUsageLedger || [],
    policy,
    kind,
    provider: providerStatus.provider || 'unknown',
    now,
  });
  return {
    allowed: row.state !== 'open',
    reason: row.state === 'open' ? 'provider-circuit-open' : 'provider-circuit-allowed',
    row,
  };
}

function providerRetryableResult(result = {}) {
  if (!result || result.ok) return false;
  if (result.skipped) return false;
  const status = Number(result.statusCode || result.status || 0);
  return !status || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function waitMs(ms = 0) {
  const delay = Math.max(0, Math.min(Number(ms) || 0, 250));
  return delay ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve();
}

async function runProviderWithRetry({
  run,
  policy = {},
  now = nowIso(),
} = {}) {
  const retryPolicy = policy.retryPolicy || {};
  const maxRetries = retryPolicy.configured ? Math.max(0, Number(retryPolicy.attempts) || 0) : 0;
  const maxAttempts = 1 + maxRetries;
  const backoffMs = Array.isArray(retryPolicy.backoffMs) ? retryPolicy.backoffMs : [];
  const attempts = [];
  let lastResult = null;
  for (let index = 0; index < maxAttempts; index += 1) {
    const startedAt = index === 0 ? now : nowIso();
    try {
      const result = await run({ attempt: index + 1 });
      lastResult = result;
      attempts.push({
        attempt: index + 1,
        ok: Boolean(result?.ok),
        status: result?.ok ? 'completed' : 'failed',
        reason: result?.reason || result?.error || null,
        startedAt,
        completedAt: nowIso(),
      });
      if (result?.ok || !providerRetryableResult(result) || index === maxAttempts - 1) break;
    } catch (error) {
      lastResult = {
        ok: false,
        error: redactSensitiveText(error.message || String(error)),
      };
      attempts.push({
        attempt: index + 1,
        ok: false,
        status: 'failed',
        reason: lastResult.error,
        startedAt,
        completedAt: nowIso(),
      });
      if (index === maxAttempts - 1) break;
    }
    await waitMs(backoffMs[index] ?? backoffMs[backoffMs.length - 1] ?? 0);
  }
  return {
    result: lastResult || { ok: false, error: 'provider-not-run' },
    retry: {
      schemaVersion: 'provider-retry-result/v1',
      configured: Boolean(retryPolicy.configured),
      maxRetries,
      attemptCount: attempts.length,
      retried: attempts.length > 1,
      attempts,
    },
  };
}

function buildProviderReadinessSnapshot({
  project = {},
  managerDashboard = {},
  mvpReadiness = {},
  securityBoundary = {},
  modelProviderStatus = {},
  searchProviderStatus = {},
  secretVaultStatus = {},
  providerControlPolicy = {},
  now = nowIso(),
} = {}) {
  const projectId = project.id || managerDashboard.projectId || managerDashboard.project?.id || null;
  const evidenceSearches = managerDashboard.evidenceSearches || {};
  const evidenceRows = evidenceSearches.rows || project.evidenceSearches || [];
  const safeModelStatus = redactSensitiveObject(modelProviderStatus || {});
  const safeSearchStatus = redactSensitiveObject(searchProviderStatus || {});
  const safeSecretVaultStatus = normalizeSecretVaultStatus(secretVaultStatus || {});
  const safeProviderText = stableJson({
    modelProviderStatus: safeModelStatus,
    searchProviderStatus: safeSearchStatus,
  });
  const rawStatusLeakScan = scanTextForRawSecretLeaks(stableJson({
    modelProviderStatus: modelProviderStatus || {},
    searchProviderStatus: searchProviderStatus || {},
  }));
  const responseLeakScan = scanTextForRawSecretLeaks(safeProviderText);
  const evidenceProviders = uniqueStrings([
    ...(evidenceSearches.providers || []),
    ...evidenceRows.map((row) => row.provider),
  ]);
  const providerBackedEvidenceRows = evidenceRows.filter((row) => row.provider && row.provider !== 'manual');
  const providerBackedEvidenceSources = providerBackedEvidenceRows.flatMap((row) => row.sources || []);
  const providerSourceSafetySummary = summarizeEvidenceSourceSafety(providerBackedEvidenceSources);
  const safeProviderPolicy = redactSensitiveObject(providerControlPolicy || {});
  const usageSummary = summarizeProviderUsageLedger(project.providerUsageLedger || [], now);
  const failureControlSummary = summarizeProviderCircuitBreakers({
    project,
    policy: providerControlPolicy,
    modelProviderStatus: safeModelStatus,
    searchProviderStatus: safeSearchStatus,
    now,
  });
  const policyReady = Boolean(
    providerControlPolicy.configured
    && providerControlPolicy.enabled
    && providerControlPolicy.enforcementEnabled
    && (providerControlPolicy.allowedModelProviders?.length || providerControlPolicy.allowedSearchProviders?.length)
    && providerControlPolicy.maxRequestsPerProjectHour > 0
    && providerControlPolicy.dailyBudgetCents > 0
    && (
      (providerControlPolicy.defaultToolGrants || []).length
      || Object.keys(providerControlPolicy.agentToolGrants || {}).length
    )
  );
  const failureControlReady = Boolean(
    policyReady
    && failureControlSummary.ready
    && (providerControlPolicy.retryPolicy?.attempts ?? -1) >= 0
    && (providerControlPolicy.circuitBreaker?.failureThreshold || 0) > 0
    && (providerControlPolicy.circuitBreaker?.cooldownSeconds || 0) > 0
  );
  const productionControls = [
    {
      id: 'provider-allowlist',
      label: 'Provider and model allowlist',
      status: policyReady ? 'local-control-ready' : 'blocked',
      owner: 'ai-platform',
      detail: 'Production must explicitly allow approved model providers, models, search gateways, regions, and endpoint domains.',
    },
    {
      id: 'budget-and-rate-limits',
      label: 'Budget, quota, and rate limits',
      status: policyReady ? 'local-control-ready' : 'blocked',
      owner: 'ai-platform',
      detail: 'Production needs per-project and per-Agent spend ceilings, request rate limits, timeout budgets, and quota exhaustion behavior.',
    },
    {
      id: 'agent-tool-grants',
      label: 'Agent-scoped tool grants',
      status: policyReady ? 'local-control-ready' : 'blocked',
      owner: 'runtime-platform',
      detail: 'Production must bind model/search access to Agent runtime identity, project membership, and task-scoped tool permissions.',
    },
    {
      id: 'failure-retry-circuit-breaker',
      label: 'Failure handling and circuit breakers',
      status: failureControlReady ? 'local-control-ready' : 'blocked',
      owner: 'runtime-platform',
      detail: 'Production needs retries, degraded-mode fallbacks, circuit breakers, dead-letter handling, and visible provider incident status.',
    },
    {
      id: 'provider-audit-and-cost-ledger',
      label: 'Provider audit and cost ledger',
      status: usageSummary.count > 0 ? 'local-control-ready' : 'blocked',
      owner: 'operations',
      detail: 'Production must persist provider calls, usage, cost, failure reason, request owner, and evidence lineage in an audit-safe ledger.',
    },
    {
      id: 'encrypted-secret-vault',
      label: 'Encrypted BYOK secret vault',
      status: safeSecretVaultStatus.ready && safeSecretVaultStatus.rotationSupported && safeSecretVaultStatus.latestRotation
        ? 'local-control-ready'
        : 'blocked',
      owner: 'security-platform',
      detail: safeSecretVaultStatus.ready && safeSecretVaultStatus.latestRotation
        ? `Local ${safeSecretVaultStatus.provider} vault contract is configured with ${safeSecretVaultStatus.encryptedRecordCount} encrypted record(s) and rotation receipt ${safeSecretVaultStatus.latestRotation.checksum || 'available'}; production still needs managed KMS, revocation, and access audit.`
        : 'Production must store API keys and provider credentials in an encrypted vault with rotation, revocation, and access audit.',
    },
    {
      id: 'source-safety-review',
      label: 'Search source safety and prompt-injection review',
      status: providerSourceSafetySummary.sourceSafetyReady ? 'local-control-ready' : 'blocked',
      owner: 'security-platform',
      detail: 'Production search needs source allow/deny policy, prompt-injection screening, content isolation, and evidence trust scoring.',
    },
  ];
  const gate = ({
    id,
    label,
    passed,
    detail,
    apiPath = null,
  }) => ({
    id,
    label,
    passed: Boolean(passed),
    status: passed ? 'passed' : 'missing',
    detail,
    apiPath,
  });
  const gates = [
    gate({
      id: 'model-provider-status-boundary',
      label: 'Model provider status is visible without secrets',
      passed: Boolean(safeModelStatus.provider && !('apiKey' in safeModelStatus) && responseLeakScan.count === 0),
      detail: `${safeModelStatus.provider || 'unknown'} / configured ${Boolean(safeModelStatus.configured)} / enabled ${Boolean(safeModelStatus.enabled)}.`,
      apiPath: '/llm/status',
    }),
    gate({
      id: 'search-provider-status-boundary',
      label: 'Search provider status is visible without secrets',
      passed: Boolean(safeSearchStatus.provider && !('apiKey' in safeSearchStatus) && responseLeakScan.count === 0),
      detail: `${safeSearchStatus.provider || 'unknown'} / configured ${Boolean(safeSearchStatus.configured)} / enabled ${Boolean(safeSearchStatus.enabled)}.`,
      apiPath: '/search/status',
    }),
    gate({
      id: 'deterministic-validation-provider',
      label: 'Deterministic validation provider can prove the protocol locally',
      passed: Boolean(
        safeSearchStatus.provider === 'deterministic'
        && safeSearchStatus.configured
        && safeSearchStatus.enabled
      ),
      detail: `${safeSearchStatus.provider || 'none'} search provider / ${evidenceProviders.join(', ') || 'no evidence provider'} evidence provenance.`,
      apiPath: '/search/test',
    }),
    gate({
      id: 'evidence-provider-provenance',
      label: 'Evidence searches preserve provider provenance',
      passed: Boolean(
        providerBackedEvidenceRows.length > 0
        && (evidenceSearches.sourceCount || providerBackedEvidenceRows.reduce((sum, row) => sum + (row.sources?.length || 0), 0)) > 0
      ),
      detail: `${providerBackedEvidenceRows.length} provider-backed search row(s), ${evidenceSearches.sourceCount || 0} source(s).`,
      apiPath: managerDashboard.backendRoutes?.evidenceSearches || (projectId ? `/projects/${projectId}/evidence-searches` : null),
    }),
    gate({
      id: 'provider-proof-routes',
      label: 'Provider proof routes are addressable',
      passed: Boolean(projectId && managerDashboard.backendRoutes?.evidenceSearches && managerDashboard.backendRoutes?.providerReadiness),
      detail: `Provider readiness route ${managerDashboard.backendRoutes?.providerReadiness || 'missing'}.`,
      apiPath: managerDashboard.backendRoutes?.providerReadiness || (projectId ? `/projects/${projectId}/provider-readiness` : null),
    }),
    gate({
      id: 'provider-failure-isolation-contract',
      label: 'Provider calls are isolated behind status/test contracts',
      passed: Boolean(
        typeof safeModelStatus.enabled === 'boolean'
        && typeof safeSearchStatus.enabled === 'boolean'
        && Number.isFinite(Number(safeModelStatus.maxConcurrency || 0))
        && Number.isFinite(Number(safeSearchStatus.maxConcurrency || 0))
      ),
      detail: `Model queue ${safeModelStatus.activeRequests || 0}/${safeModelStatus.queuedRequests || 0}; search queue ${safeSearchStatus.activeRequests || 0}/${safeSearchStatus.queuedRequests || 0}.`,
      apiPath: projectId ? `/projects/${projectId}/provider-readiness` : null,
    }),
    gate({
      id: 'provider-secret-vault-contract',
      label: 'Provider secrets have a local encrypted vault contract',
      passed: safeSecretVaultStatus.ready
        && safeSecretVaultStatus.rawSecretRecordCount === 0
        && safeSecretVaultStatus.rotationSupported
        && safeSecretVaultStatus.latestRotation?.schemaVersion === 'secret-vault-rotation-receipt/v1'
        && safeSecretVaultStatus.latestRotation.failedRecordCount === 0,
      detail: `${safeSecretVaultStatus.provider || 'none'} / configured ${Boolean(safeSecretVaultStatus.configured)} / encrypted records ${safeSecretVaultStatus.encryptedRecordCount || 0}.`,
      apiPath: projectId ? `/projects/${projectId}/security-boundary` : null,
    }),
    gate({
      id: 'provider-control-policy',
      label: 'Provider control policy is enforceable',
      passed: policyReady,
      detail: `${providerControlPolicy.mode || 'unknown'} / ${providerControlPolicy.allowedModelProviders?.length || 0} model provider(s), ${providerControlPolicy.allowedSearchProviders?.length || 0} search provider(s), ${providerControlPolicy.maxRequestsPerProjectHour || 0}/hour.`,
      apiPath: projectId ? `/projects/${projectId}/provider-readiness` : null,
    }),
    gate({
      id: 'provider-usage-audit-ledger',
      label: 'Provider calls write an audit and cost ledger',
      passed: usageSummary.count > 0 && usageSummary.latestEventId,
      detail: `${usageSummary.count} provider usage row(s), ${usageSummary.deniedCount} denied, ${usageSummary.dailyCostCents} cent(s) today.`,
      apiPath: projectId ? `/projects/${projectId}/events` : null,
    }),
    gate({
      id: 'provider-retry-circuit-breaker',
      label: 'Provider failures have retry and circuit-breaker controls',
      passed: failureControlReady,
      detail: `${failureControlSummary.rows.length} circuit row(s), ${failureControlSummary.openCircuitCount} open, retry attempts ${providerControlPolicy.retryPolicy?.attempts ?? 0}.`,
      apiPath: projectId ? `/projects/${projectId}/provider-readiness` : null,
    }),
    gate({
      id: 'search-source-safety-review',
      label: 'Provider-backed evidence sources have safety review',
      passed: providerSourceSafetySummary.sourceSafetyReady,
      detail: `${providerSourceSafetySummary.reviewedSourceCount}/${providerSourceSafetySummary.sourceCount} source(s) screened; ${providerSourceSafetySummary.blockedSourceCount} blocked, ${providerSourceSafetySummary.reviewSourceCount} review.`,
      apiPath: managerDashboard.backendRoutes?.evidenceSearches || (projectId ? `/projects/${projectId}/evidence-searches` : null),
    }),
    gate({
      id: 'security-boundary-links-provider-redaction',
      label: 'Security boundary links provider redaction',
      passed: Boolean(
        securityBoundary.schemaVersion === 'security-boundary/v1'
        && securityBoundary.providerBoundary?.exposedSecrets === false
        && (securityBoundary.redactionScan?.rawLeakCount || 0) === 0
      ),
      detail: `${securityBoundary.redactionScan?.rawLeakCount || 0} raw leak(s), ${securityBoundary.redactionScan?.redactionMarkerCount || 0} redaction marker(s).`,
      apiPath: projectId ? `/projects/${projectId}/security-boundary` : null,
    }),
    gate({
      id: 'production-controls-visible',
      label: 'Production provider controls remain explicit blockers',
      passed: productionControls.length >= 6,
      detail: `${productionControls.length} provider production control(s) listed before rollout; ${productionControls.filter((row) => row.status === 'local-control-ready').length} local control(s) ready; production remains blocked until managed rollout controls exist.`,
      apiPath: projectId ? `/projects/${projectId}/mvp-readiness` : null,
    }),
  ];
  const failedGates = gates.filter((row) => !row.passed);
  const readyForLocalPilot = failedGates.length === 0;
  const nextBlockedProductionControl = productionControls.find((row) => row.status === 'blocked') || null;

  return {
    projectId,
    generatedAt: now,
    schemaVersion: 'provider-readiness/v1',
    status: readyForLocalPilot ? 'local-provider-contract-ready' : 'needs-provider-contract-work',
    readyForLocalPilot,
    readyForProduction: false,
    providerBoundaries: {
      model: {
        status: safeModelStatus,
        route: '/llm/status',
        testRoute: '/llm/test',
        productionRequirement: 'model allowlist, budget controls, runtime identity binding, usage ledger, and encrypted key storage',
      },
      search: {
        status: safeSearchStatus,
        route: '/search/status',
        testRoute: '/search/test',
        productionRequirement: 'private search gateway, source safety policy, rate limits, Agent-scoped grants, and provider audit ledger',
      },
      evidence: {
        providers: evidenceProviders,
        providerBackedSearchCount: providerBackedEvidenceRows.length,
        sourceCount: evidenceSearches.sourceCount || providerBackedEvidenceRows.reduce((sum, row) => sum + (row.sources?.length || 0), 0),
        sourceSafetySummary: providerSourceSafetySummary,
        route: managerDashboard.backendRoutes?.evidenceSearches || (projectId ? `/projects/${projectId}/evidence-searches` : null),
      },
      failureControl: {
        ...failureControlSummary,
        route: projectId ? `/projects/${projectId}/provider-readiness` : null,
      },
      secretVault: {
        ...safeSecretVaultStatus,
        route: projectId ? `/projects/${projectId}/security-boundary` : null,
      },
    },
    providerControlPolicy: safeProviderPolicy,
    providerUsage: {
      ...usageSummary,
      route: projectId ? `/projects/${projectId}/events` : null,
      ledgerStorage: 'project.providerUsageLedger',
      migrationTarget: 'provider_usage_ledger',
      rows: (project.providerUsageLedger || []).slice(0, 20).map((row) => redactSensitiveObject(row)),
    },
    gates,
    failedGates,
    requiredProductionControls: productionControls,
    rollout: {
      localPilot: readyForLocalPilot ? 'ready' : 'blocked',
      production: 'blocked',
      nextProductionGapId: nextBlockedProductionControl?.id || null,
      mvpBlockerId: 'production-real-providers',
      mvpStatus: mvpReadiness.status || 'unknown',
    },
    redaction: {
      status: rawStatusLeakScan.count || responseLeakScan.count ? 'needs-attention' : 'ready',
      rawStatusLeakCount: rawStatusLeakScan.count,
      responseLeakCount: responseLeakScan.count,
      responseChecksum: persistenceChecksum({
        modelProviderStatus: safeModelStatus,
        searchProviderStatus: safeSearchStatus,
      }),
    },
    backendRoutes: {
      modelStatus: '/llm/status',
      modelTest: '/llm/test',
      searchStatus: '/search/status',
      searchTest: '/search/test',
      evidenceSearches: managerDashboard.backendRoutes?.evidenceSearches || (projectId ? `/projects/${projectId}/evidence-searches` : null),
      providerReadiness: projectId ? `/projects/${projectId}/provider-readiness` : null,
      mvpReadiness: projectId ? `/projects/${projectId}/mvp-readiness` : null,
      securityBoundary: projectId ? `/projects/${projectId}/security-boundary` : null,
    },
    summary: {
      gateCount: gates.length,
      passedGateCount: gates.filter((row) => row.passed).length,
      failedGateCount: failedGates.length,
      productionControlCount: productionControls.length,
      localProductionControlCount: productionControls.filter((row) => row.status === 'local-control-ready').length,
      modelConfigured: Boolean(safeModelStatus.configured),
      modelEnabled: Boolean(safeModelStatus.enabled),
      searchConfigured: Boolean(safeSearchStatus.configured),
      searchEnabled: Boolean(safeSearchStatus.enabled),
      evidenceProviderCount: evidenceProviders.length,
      providerBackedSearchCount: providerBackedEvidenceRows.length,
      evidenceSourceCount: evidenceSearches.sourceCount || 0,
      providerUsageCount: usageSummary.count,
      providerUsageDeniedCount: usageSummary.deniedCount,
      providerDailyCostCents: usageSummary.dailyCostCents,
      providerPolicyConfigured: Boolean(providerControlPolicy.configured),
      providerFailureControlReady: failureControlReady,
      providerOpenCircuitCount: failureControlSummary.openCircuitCount,
      providerRetryAttempts: providerControlPolicy.retryPolicy?.attempts ?? 0,
      providerSecretVaultReady: safeSecretVaultStatus.ready,
      providerSecretVaultEncryptedRecordCount: safeSecretVaultStatus.encryptedRecordCount,
      providerSecretVaultRotationSupported: Boolean(safeSecretVaultStatus.rotationSupported),
      providerSecretVaultRotationReady: Boolean(safeSecretVaultStatus.latestRotation && safeSecretVaultStatus.latestRotation.failedRecordCount === 0),
      providerSecretVaultLatestRotationChecksum: safeSecretVaultStatus.latestRotation?.checksum || null,
      sourceSafetyReady: providerSourceSafetySummary.sourceSafetyReady,
      sourceSafetyBlockedSourceCount: providerSourceSafetySummary.blockedSourceCount,
      sourceSafetyReviewSourceCount: providerSourceSafetySummary.reviewSourceCount,
      rawStatusLeakCount: rawStatusLeakScan.count,
      responseLeakCount: responseLeakScan.count,
    },
  };
}

const MANAGER_FLOW_CATEGORIES = {
  thinking: { label: 'Thinking', lane: 'Thinking' },
  'self-marketing': { label: 'Self-Marketing', lane: 'Self-Marketing' },
  submission: { label: 'Submission', lane: 'Submissions' },
  review: { label: 'Review', lane: 'Reviews' },
  decision: { label: 'Decision', lane: 'Decisions' },
  execution: { label: 'Execution', lane: 'Execution' },
  collaboration: { label: 'Collaboration', lane: 'Collaboration' },
  communication: { label: 'Communication', lane: 'Communication' },
  monitoring: { label: 'Monitoring', lane: 'Monitoring' },
  evidence: { label: 'Evidence', lane: 'Evidence' },
};

const MANAGER_FLOW_CATEGORY_ORDER = [
  'thinking',
  'self-marketing',
  'decision',
  'collaboration',
  'execution',
  'submission',
  'review',
  'communication',
  'monitoring',
  'evidence',
];

const MANAGER_FLOW_EDGE_TYPES = {
  self_marketing: 'Self-marketing line',
  revision: 'Revision line',
  leader_assignment: 'Leader assignment line',
  agent_collaboration: 'Agent collaboration line',
  task_dependency: 'Task dependency line',
  change_impact: 'Change impact line',
  reporting: 'Report line',
  review: 'Review line',
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
    ...attachment,
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
      sourceSafetySummary: input.sourceSafetySummary || null,
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
        sourceSafetySummary: existing.sourceSafetySummary || node.sourceSafetySummary,
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
  const eventIdsForProofIds = (proofIds = [], types = []) => {
    const proofSet = new Set((proofIds || []).filter(Boolean).map(String));
    const typeSet = new Set((types || []).filter(Boolean).map(String));
    return uniqueStrings((project.eventLedger || [])
      .filter((event) => (
        (!typeSet.size || typeSet.has(String(event.type || '')))
        && [
          ...(event.evidenceIds || []),
          event.entityIds?.messageId,
          event.entityIds?.logId,
        ].filter(Boolean).some((id) => proofSet.has(String(id)))
      ))
      .map((event) => event.id));
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

  (kickoffFlow.conversationRows || [])
    .filter((row) => ['role-clarification', 'self-nomination', 'leader-campaign'].includes(row.stage))
    .forEach((row, index) => {
      const isSelfMarketing = ['self-nomination', 'leader-campaign'].includes(row.stage);
      const proofIds = uniqueStrings(row.proofIds || [row.id]);
      const nodeId = `kickoff-${row.stage}-${slugPart(row.id || row.speakerId || row.speakerName || index)}`;
      const speakerId = row.speakerId && row.speakerId !== 'director' ? row.speakerId : null;
      const heardBy = uniqueStrings(row.heardBy || []);
      addNode({
        id: nodeId,
        category: isSelfMarketing ? 'self-marketing' : 'communication',
        subtype: row.stage === 'leader-campaign'
          ? 'leader-campaign'
          : row.stage === 'self-nomination'
            ? 'role-self-nomination'
            : 'role-clarification',
        title: row.stage === 'leader-campaign'
          ? `${row.speakerName || 'Agent'} campaigned for Leader`
          : row.stage === 'self-nomination'
            ? `${row.speakerName || 'Agent'} self-nominated`
            : `${row.speakerName || 'Agent'} clarified role`,
        agentId: speakerId,
        agentName: row.speakerName || agentLabel(speakerId),
        summary: row.text || row.role || row.stage,
        status: heardBy.length ? 'published' : 'draft',
        importance: row.stage === 'leader-campaign' ? 'critical' : 'major',
        source: 'kickoffConversation',
        sourceLabel: 'Kickoff conversation',
        proofIds,
        eventIds: eventIdsForProofIds(proofIds, row.stage === 'leader-campaign'
          ? ['kickoff-leader-campaign']
          : ['kickoff-role-question', 'kickoff-role-volunteer']),
        channelId: row.channelId || 'main',
        affectedAgentIds: uniqueStrings([speakerId, ...heardBy].filter(Boolean)),
        participantIds: uniqueStrings([speakerId, ...heardBy].filter(Boolean)),
        relationshipRoles: Object.fromEntries(uniqueStrings([speakerId, ...heardBy].filter(Boolean)).map((agentId) => [
          agentId,
          agentId === speakerId
            ? row.stage === 'leader-campaign'
              ? 'leader-candidate'
              : row.stage === 'self-nomination'
                ? 'owner-candidate'
                : 'role-speaker'
            : 'heard-by-peer',
        ])),
        submissionIntent: isSelfMarketing
          ? 'Submit the Agent self-marketing pitch as a flow-graph proof node.'
          : 'Submit the role-negotiation turn as kickoff conversation proof.',
        attachmentType: isSelfMarketing ? 'reasoning-note' : 'transcript',
        attachmentTitle: row.stage === 'leader-campaign'
          ? 'Leader campaign proof'
          : row.stage === 'self-nomination'
            ? 'Role self-nomination proof'
            : 'Role clarification proof',
        relatedNodeIds: ['kickoff-role-risk-analysis'],
        route: projectId ? `/projects/${projectId}/transcripts/${row.channelId || 'main'}` : null,
      });
      addEdge({
        type: isSelfMarketing ? 'self_marketing' : 'agent_collaboration',
        fromNodeId: row.stage === 'role-clarification' ? 'kickoff-requirement-understanding' : 'kickoff-role-risk-analysis',
        toNodeId: nodeId,
        label: row.stage === 'leader-campaign'
          ? 'Leader campaign pitch'
          : row.stage === 'self-nomination'
            ? 'Role ownership pitch'
            : 'Role clarification',
        source: 'kickoffConversation',
        proofIds,
        eventIds: eventIdsForProofIds(proofIds, row.stage === 'leader-campaign'
          ? ['kickoff-leader-campaign']
          : ['kickoff-role-question', 'kickoff-role-volunteer']),
        importance: row.stage === 'leader-campaign' ? 'critical' : 'major',
      });
      if (row.stage === 'leader-campaign') {
        addEdge({
          type: 'self_marketing',
          fromNodeId: nodeId,
          toNodeId: 'leader-election',
          label: 'Campaign informed election',
          source: 'kickoffConversation',
          proofIds,
          importance: 'critical',
        });
      }
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

  (project.agentSubmissions || []).forEach((submission) => {
    const nodeId = `agent-submission-${submission.id}`;
    const taskExecutionNodeId = submission.taskId ? `task-execution-${submission.taskId}` : null;
    const reviewAgentId = submission.requestedReviewAgentId || leaderId || null;
    const revisedSubmissionNodeIds = uniqueStrings([
      submission.revisesSubmissionId,
      ...(submission.supersedesSubmissionIds || []),
    ].filter(Boolean).map((id) => `agent-submission-${id}`));
    addNode({
      id: nodeId,
      category: 'submission',
      subtype: submission.artifactType || 'artifact',
      title: submission.title || `${submission.agentName || submission.agentId || 'Agent'} submitted artifact`,
      agentId: submission.agentId,
      taskId: submission.taskId || null,
      time: submission.createdAt || submission.updatedAt,
      summary: submission.summary || submission.body || 'Agent submission',
      status: normalizeManagerFlowStatus(
        submission.status === 'superseded'
          ? 'superseded'
          : submission.status === 'final' || submission.artifactType === 'final-deliverable'
          ? 'resolved'
          : submission.reviewStatus === 'changes-requested'
            ? 'blocked'
            : submission.reviewStatus === 'accepted'
              ? 'confirmed'
              : submission.status || 'published',
      ),
      importance: submission.artifactType === 'final-deliverable'
        ? 'critical'
        : ['decision-proposal', 'risk-review', 'evidence-packet'].includes(submission.artifactType)
          ? 'major'
          : 'normal',
      source: 'agentSubmissions',
      proofIds: [submission.messageId].filter(Boolean),
      timelineLogIds: [submission.timelineLogId].filter(Boolean),
      eventIds: [submission.eventId].filter(Boolean),
      affectedAgentIds: uniqueStrings([submission.agentId, reviewAgentId].filter(Boolean)),
      affectedTaskIds: [submission.taskId].filter(Boolean),
      participantIds: uniqueStrings([submission.agentId, reviewAgentId].filter(Boolean)),
      relationshipRoles: {
        ...(submission.agentId ? { [submission.agentId]: 'submitter' } : {}),
        ...(reviewAgentId ? { [reviewAgentId]: 'reviewer' } : {}),
      },
      submissionIntent: `Submit ${submission.artifactType || 'artifact'} as a manager-visible product-team work node.`,
      attachmentType: submission.artifactType || 'artifact',
      attachmentTitle: submission.title || 'Agent submitted artifact',
      attachmentSummary: submission.summary || '',
      attachments: [
        {
          ...(submission.artifact || {}),
          id: submission.artifactId || submission.artifact?.id || `${nodeId}_artifact`,
          type: submission.artifactType || submission.artifact?.type || 'artifact',
          title: submission.title || submission.artifact?.title || 'Agent artifact',
          summary: submission.summary || submission.artifact?.summary || '',
          source: submission.artifact?.source || 'agentSubmissions',
          route: submission.workspacePath || submission.artifactPath || submission.artifactUrl || null,
          proofIds: [submission.messageId].filter(Boolean),
          timelineLogIds: [submission.timelineLogId].filter(Boolean),
          eventIds: [submission.eventId].filter(Boolean),
          taskId: submission.taskId || null,
        },
      ],
      relatedNodeIds: [taskExecutionNodeId, ...revisedSubmissionNodeIds].filter(Boolean),
      route: projectId ? `/projects/${projectId}/submissions/${encodeURIComponent(submission.id)}` : null,
    });
    revisedSubmissionNodeIds.forEach((revisedNodeId) => {
      addEdge({
        type: 'revision',
        fromNodeId: revisedNodeId,
        toNodeId: nodeId,
        label: submission.respondsToReviewId ? 'Revised after review' : 'Superseded by revision',
        source: 'agentSubmissions',
        proofIds: [submission.messageId].filter(Boolean),
        timelineLogIds: [submission.timelineLogId].filter(Boolean),
        eventIds: [submission.eventId].filter(Boolean),
        importance: submission.artifactType === 'final-deliverable' ? 'critical' : 'major',
      });
    });
    if (taskExecutionNodeId && nodesById.has(taskExecutionNodeId)) {
      addEdge({
        type: 'reporting',
        fromNodeId: taskExecutionNodeId,
        toNodeId: nodeId,
        label: `${submission.artifactType || 'Artifact'} submitted`,
        source: 'agentSubmissions',
        proofIds: [submission.messageId].filter(Boolean),
        timelineLogIds: [submission.timelineLogId].filter(Boolean),
        eventIds: [submission.eventId].filter(Boolean),
        importance: submission.artifactType === 'final-deliverable' ? 'critical' : 'major',
      });
    }
    attachEvidenceNode({
      parentId: nodeId,
      id: `evidence-agent-submission-${submission.id}`,
      title: `${submission.title || 'Agent submission'} proof packet`,
      summary: 'Chat, timeline, ledger, and artifact proof for this submitted work node.',
      source: 'agentSubmissions',
      proofIds: [submission.messageId].filter(Boolean),
      timelineLogIds: [submission.timelineLogId].filter(Boolean),
      eventIds: [submission.eventId].filter(Boolean),
      importance: submission.artifactType === 'final-deliverable' ? 'critical' : 'major',
    });
  });

  (project.evidenceSearches || []).forEach((record) => {
    const nodeId = `evidence-search-${record.id}`;
    const taskExecutionNodeId = record.taskId ? `task-execution-${record.taskId}` : null;
    const submissionNodeId = record.submissionId ? `agent-submission-${record.submissionId}` : null;
    const sourceSafetySummary = record.sourceSafetySummary || summarizeEvidenceSourceSafety(record.sources || []);
    addNode({
      id: nodeId,
      category: 'evidence',
      subtype: record.searchMode || 'evidence-search',
      title: record.query || 'Agent evidence search',
      agentId: record.agentId,
      taskId: record.taskId || null,
      time: record.createdAt || record.updatedAt,
      summary: `${record.sources?.length || 0} source(s), confidence ${record.confidence || 'medium'}, judgement ${record.evidenceJudgement || record.qualitySummary?.judgement || 'unknown'}, quality ${record.qualityScore ?? record.qualitySummary?.averageScore ?? 0}, source safety ${sourceSafetySummary.highestRiskLevel || 'unknown'} (${sourceSafetySummary.blockedSourceCount || 0} blocked). ${record.purpose || ''}`.trim(),
      status: record.status === 'completed' ? 'confirmed' : normalizeManagerFlowStatus(record.status, 'published'),
      importance: (record.evidenceJudgement === 'strong-evidence' || (record.qualityScore ?? record.qualitySummary?.averageScore ?? 0) >= 70 || record.confidence === 'high') ? 'major' : 'normal',
      source: 'evidenceSearches',
      proofIds: [record.messageId].filter(Boolean),
      timelineLogIds: [record.timelineLogId].filter(Boolean),
      eventIds: [record.eventId].filter(Boolean),
      affectedAgentIds: [record.agentId].filter(Boolean),
      affectedTaskIds: [record.taskId].filter(Boolean),
      participantIds: [record.agentId].filter(Boolean),
      relationshipRoles: record.agentId ? { [record.agentId]: 'evidence-owner' } : {},
      sourceSafetySummary,
      submissionIntent: 'Submit search and source-quality evidence as a manager-visible product-team evidence node.',
      attachmentType: 'evidence-search',
      attachmentTitle: record.query || 'Evidence search packet',
      attachmentSummary: record.purpose || '',
      attachments: (record.sources || []).slice(0, 8).map((source) => ({
        id: source.id || `${nodeId}_source`,
        type: source.kind || 'source',
        title: source.title || source.url || 'Evidence source',
        summary: source.summary || '',
        source: 'evidenceSearches',
        route: source.url || null,
        confidence: source.confidence || record.confidence || 'medium',
        qualityScore: source.qualityScore ?? null,
        qualityLevel: source.qualityLevel || null,
        qualitySignals: source.qualitySignals || [],
        judgement: source.judgement || null,
        sourceSafetyLevel: source.sourceSafetyLevel || null,
        sourceSafetyScore: source.sourceSafetyScore ?? null,
        sourceSafetySignals: source.sourceSafetySignals || [],
        sourceSafetyJudgement: source.sourceSafetyJudgement || null,
        proofIds: [record.messageId].filter(Boolean),
        timelineLogIds: [record.timelineLogId].filter(Boolean),
        eventIds: [record.eventId].filter(Boolean),
        taskId: record.taskId || null,
      })),
      relatedNodeIds: [taskExecutionNodeId, submissionNodeId].filter((id) => id && nodesById.has(id)),
      route: projectId ? `/projects/${projectId}/evidence-searches/${encodeURIComponent(record.id)}` : null,
    });
    if (taskExecutionNodeId && nodesById.has(taskExecutionNodeId)) {
      addEdge({
        type: 'evidence',
        fromNodeId: taskExecutionNodeId,
        toNodeId: nodeId,
        label: 'Evidence gathered',
        source: 'evidenceSearches',
        proofIds: [record.messageId].filter(Boolean),
        timelineLogIds: [record.timelineLogId].filter(Boolean),
        eventIds: [record.eventId].filter(Boolean),
        importance: 'major',
      });
    }
    if (submissionNodeId && nodesById.has(submissionNodeId)) {
      addEdge({
        type: 'evidence',
        fromNodeId: nodeId,
        toNodeId: submissionNodeId,
        label: 'Sources support submission',
        source: 'evidenceSearches',
        proofIds: [record.messageId].filter(Boolean),
        timelineLogIds: [record.timelineLogId].filter(Boolean),
        eventIds: [record.eventId].filter(Boolean),
        importance: 'major',
      });
    }
  });

  (project.submissionReviews || []).forEach((review) => {
    const nodeId = `submission-review-${review.id}`;
    const submissionNodeId = review.submissionId ? `agent-submission-${review.submissionId}` : null;
    const taskExecutionNodeId = review.taskId ? `task-execution-${review.taskId}` : null;
    const revisionNodes = (project.agentSubmissions || [])
      .filter((submission) => String(submission.respondsToReviewId || '') === String(review.id))
      .map((submission) => ({
        id: `agent-submission-${submission.id}`,
        messageId: submission.messageId,
        timelineLogId: submission.timelineLogId,
        eventId: submission.eventId,
        artifactType: submission.artifactType,
      }));
    addNode({
      id: nodeId,
      category: 'review',
      subtype: review.verdict || 'submission-review',
      title: `${review.reviewerAgentName || review.reviewerAgentId || 'Reviewer'} reviewed submission`,
      agentId: review.reviewerAgentId,
      taskId: review.taskId || null,
      time: review.createdAt || review.updatedAt,
      summary: review.comments || `${review.verdict || 'review'} for ${review.submissionId || 'submission'}.`,
      status: review.verdict === 'accepted'
        ? 'confirmed'
        : review.verdict === 'changes-requested' || review.verdict === 'rejected'
          ? 'blocked'
          : 'published',
      importance: review.verdict === 'accepted' ? 'major' : 'critical',
      source: 'submissionReviews',
      proofIds: [review.messageId].filter(Boolean),
      timelineLogIds: [review.timelineLogId].filter(Boolean),
      eventIds: [review.eventId].filter(Boolean),
      affectedAgentIds: uniqueStrings([review.reviewerAgentId, review.submitterAgentId].filter(Boolean)),
      affectedTaskIds: [review.taskId].filter(Boolean),
      participantIds: uniqueStrings([review.reviewerAgentId, review.submitterAgentId].filter(Boolean)),
      relationshipRoles: {
        ...(review.reviewerAgentId ? { [review.reviewerAgentId]: 'reviewer' } : {}),
        ...(review.submitterAgentId ? { [review.submitterAgentId]: 'submitter' } : {}),
      },
      submissionIntent: 'Submit Reviewer verdict, requested changes, and acceptance proof as a first-class review node.',
      attachmentType: 'submission-review',
      attachmentTitle: `${review.verdict || 'review'} review`,
      attachmentSummary: review.comments || '',
      attachments: [{
        id: `${review.id}_review_packet`,
        type: 'submission-review',
        title: `${review.verdict || 'review'} review packet`,
        summary: review.comments || '',
        requestedChanges: review.requestedChanges || [],
        source: 'submissionReviews',
        route: projectId ? `/projects/${projectId}/submission-reviews/${encodeURIComponent(review.id)}` : null,
        proofIds: [review.messageId].filter(Boolean),
        timelineLogIds: [review.timelineLogId].filter(Boolean),
        eventIds: [review.eventId].filter(Boolean),
        taskId: review.taskId || null,
      }],
      relatedNodeIds: [submissionNodeId, taskExecutionNodeId].filter((id) => id && nodesById.has(id)),
      route: projectId ? `/projects/${projectId}/submission-reviews/${encodeURIComponent(review.id)}` : null,
    });
    if (submissionNodeId && nodesById.has(submissionNodeId)) {
      addEdge({
        type: 'review',
        fromNodeId: submissionNodeId,
        toNodeId: nodeId,
        label: review.verdict === 'accepted' ? 'Accepted by Reviewer' : 'Reviewed by Reviewer',
        source: 'submissionReviews',
        proofIds: [review.messageId].filter(Boolean),
        timelineLogIds: [review.timelineLogId].filter(Boolean),
        eventIds: [review.eventId].filter(Boolean),
        importance: review.verdict === 'accepted' ? 'major' : 'critical',
      });
    }
    if (taskExecutionNodeId && nodesById.has(taskExecutionNodeId) && review.verdict === 'changes-requested') {
      addEdge({
        type: 'review',
        fromNodeId: nodeId,
        toNodeId: taskExecutionNodeId,
        label: 'Revision requested',
        source: 'submissionReviews',
        proofIds: [review.messageId].filter(Boolean),
        timelineLogIds: [review.timelineLogId].filter(Boolean),
        eventIds: [review.eventId].filter(Boolean),
        importance: 'critical',
      });
    }
    revisionNodes.forEach((revisionNode) => {
      addEdge({
        type: 'revision',
        fromNodeId: nodeId,
        toNodeId: revisionNode.id,
        label: 'Revision responded to review',
        source: 'agentSubmissions',
        proofIds: [revisionNode.messageId].filter(Boolean),
        timelineLogIds: [revisionNode.timelineLogId].filter(Boolean),
        eventIds: [revisionNode.eventId].filter(Boolean),
        importance: revisionNode.artifactType === 'final-deliverable' ? 'critical' : 'major',
      });
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

  (project.launchApprovals || []).forEach((approval) => {
    const nodeId = `launch-approval-${approval.id}`;
    addNode({
      id: nodeId,
      category: 'decision',
      subtype: 'launch-approval',
      title: `${approval.mode || 'private-pilot'} launch ${approval.decision || approval.status || 'approval'}`,
      summary: `${approval.approverRole || 'approver'}: ${approval.reason || 'No reason provided.'}`,
      status: approval.decision === 'approved' ? 'confirmed' : approval.decision === 'rejected' ? 'blocked' : 'draft',
      importance: approval.mode === 'production' ? 'critical' : 'major',
      source: 'launchApprovals',
      time: approval.createdAt,
      eventIds: (project.eventLedger || [])
        .filter((event) => event.entityIds?.launchApprovalId === approval.id)
        .map((event) => event.id)
        .filter(Boolean),
      timelineLogIds: (project.logs || [])
        .filter((log) => log.launchApprovalId === approval.id)
        .map((log) => log.id)
        .filter(Boolean),
      submissionIntent: 'Submit the launch approval decision as release-governance proof.',
      attachmentType: 'launch-approval',
      attachmentTitle: 'Launch approval record',
      route: projectId ? `/projects/${projectId}/launch-approvals` : null,
    });
    addEdge({
      type: 'decision',
      fromNodeId: 'project-evidence-ledger',
      toNodeId: nodeId,
      label: 'Release governance',
      source: 'launchApprovals',
      eventIds: (project.eventLedger || [])
        .filter((event) => event.entityIds?.launchApprovalId === approval.id)
        .map((event) => event.id)
        .filter(Boolean),
      importance: approval.mode === 'production' ? 'critical' : 'major',
    });
  });

  (project.projectEvidenceExports || []).forEach((record) => {
    const nodeId = `project-evidence-export-${record.id}`;
    const exportLogIds = (project.logs || [])
      .filter((log) => log.projectEvidenceExportId === record.id || log.exportRequestId === record.exportRequestId)
      .map((log) => log.id)
      .filter(Boolean);
    const exportEventIds = (project.eventLedger || [])
      .filter((event) => event.entityIds?.projectEvidenceExportId === record.id || event.entityIds?.exportRequestId === record.exportRequestId)
      .map((event) => event.id)
      .filter(Boolean);
    addNode({
      id: nodeId,
      category: record.action === 'request' ? 'evidence' : 'decision',
      subtype: 'project-evidence-export',
      title: `${record.mode || 'private-pilot'} evidence export ${record.action || 'request'}`,
      summary: `${record.actorRole || 'actor'} ${record.decision || record.status || record.action || 'recorded'}; archive ${record.archiveChecksum || 'checksum pending'}.`,
      status: record.action === 'reject' ? 'blocked' : record.action === 'approve' ? 'confirmed' : 'published',
      importance: record.mode === 'production' ? 'critical' : 'major',
      source: 'projectEvidenceExports',
      time: record.createdAt,
      eventIds: exportEventIds,
      timelineLogIds: exportLogIds,
      proofIds: [record.id, record.checksum, record.archiveChecksum].filter(Boolean),
      submissionIntent: 'Submit the evidence export governance record before customer handoff.',
      attachmentType: 'project-evidence-export',
      attachmentTitle: 'Project evidence export governance record',
      route: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    });
    addEdge({
      type: record.action === 'request' ? 'evidence' : 'decision',
      fromNodeId: 'project-evidence-ledger',
      toNodeId: nodeId,
      label: 'Evidence export governance',
      source: 'projectEvidenceExports',
      eventIds: exportEventIds,
      proofIds: [record.id, record.checksum, record.archiveChecksum].filter(Boolean),
      importance: record.mode === 'production' ? 'critical' : 'major',
    });
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
  projectRuntime = null,
  llmProvider = null,
  searchProvider = null,
  providerPolicy = {},
  secretVault = null,
  store = createAgentProjectMemoryStore({
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    hydrateProject: hydrateAgentProject,
  }),
} = {}) {
  const resolvedSecretVault = secretVault || createSecretVaultFromEnv();
  const readModelCache = new Map();
  const clearReadModelCache = () => {
    readModelCache.clear();
  };
  const cacheLimitedReadModel = (key, build) => {
    if (readModelCache.has(key)) return readModelCache.get(key);
    const value = build();
    readModelCache.set(key, value);
    if (readModelCache.size > 80) {
      const oldestKey = readModelCache.keys().next().value;
      readModelCache.delete(oldestKey);
    }
    return value;
  };
  const readModelOptionSignature = (options = {}) => persistenceChecksum({
    language: options.language || null,
    forceDue: Boolean(options.forceDue),
    forceProjectIds: options.forceProjectIds || [],
    forceAgentRun: Boolean(options.forceAgentRun),
    maxAgentsPerProject: options.maxAgentsPerProject ?? null,
    maxProjects: options.maxProjects ?? null,
  });
  const projectReadModelSignature = (projectId, options = {}) => {
    const project = store.getProject(projectId) || {};
    const allMessages = store.getMessages(projectId) || [];
    const eventLedger = project.eventLedger || [];
    const logs = project.logs || [];
    const tasks = project.tasks || [];
    const agentStates = project.agentStates || {};
    const agentStateSummary = Object.values(agentStates).map((state = {}) => ({
      agentId: state.agentId,
      nextAgentRunAt: state.nextAgentRunAt,
      inboxCount: state.inbox?.length || 0,
      obligationCount: state.obligations?.length || 0,
      worklogCount: state.worklog?.length || 0,
      latestWorklogId: state.worklog?.[0]?.id || null,
    }));
    return persistenceChecksum({
      options: readModelOptionSignature(options),
      store: {
        filePath: store.filePath || null,
        securityAuditLogPath: store.securityAuditLogPath || null,
      },
      project: {
        id: project.id,
        status: project.status,
        progress: project.progress,
        language: project.language || null,
        team: (project.team || []).map((agent) => [agent.id, agent.isLeader, agent.title]),
        tasks: tasks.map((task) => [task.id, task.status, task.ownerId, task.assignee, task.workPulseCount || 0]),
        logCount: logs.length,
        latestLog: logs[0] ? [logs[0].id, logs[0].time, logs[0].eventType] : null,
        eventLedgerCount: project.eventLedgerEventCount || eventLedger.length,
        eventLedgerFirstSequence: project.eventLedgerFirstSequence || eventLedger[0]?.sequence || 0,
        eventLedgerLastSequence: project.eventLedgerLastSequence || eventLedger.at(-1)?.sequence || 0,
        latestEvent: eventLedger.at(-1) ? [eventLedger.at(-1).id, eventLedger.at(-1).type, eventLedger.at(-1).sequence] : null,
        changeCount: project.changeLedger?.length || 0,
        latestChange: project.changeLedger?.[0] ? [project.changeLedger[0].id, project.changeLedger[0].status] : null,
        submissionCount: project.agentSubmissions?.length || 0,
        latestSubmission: project.agentSubmissions?.[0] ? [project.agentSubmissions[0].id, project.agentSubmissions[0].status, project.agentSubmissions[0].superseded] : null,
        evidenceSearchCount: project.evidenceSearches?.length || 0,
        latestEvidenceSearch: project.evidenceSearches?.[0] ? [project.evidenceSearches[0].id, project.evidenceSearches[0].status] : null,
        reviewCount: project.submissionReviews?.length || 0,
        latestReview: project.submissionReviews?.[0] ? [project.submissionReviews[0].id, project.submissionReviews[0].verdict] : null,
        identitySessionCount: project.identitySessions?.length || 0,
        latestIdentitySession: project.identitySessions?.[0] ? [project.identitySessions[0].id, project.identitySessions[0].status, project.identitySessions[0].expiresAt] : null,
        workerRunCount: project.workerRuns?.length || 0,
        latestWorkerRun: project.workerRuns?.[0] ? [project.workerRuns[0].id, project.workerRuns[0].trigger, project.workerRuns[0].status] : null,
        agentWorkerCount: project.agentWorkerLedger?.length || 0,
        latestAgentWorker: project.agentWorkerLedger?.[0] ? [project.agentWorkerLedger[0].id, project.agentWorkerLedger[0].agentId, project.agentWorkerLedger[0].trigger] : null,
        managerActionRunCount: project.managerActionRunLedger?.length || 0,
        latestManagerActionRun: project.managerActionRunLedger?.[0] ? [project.managerActionRunLedger[0].id, project.managerActionRunLedger[0].requirementId] : null,
        securityAccessAuditCount: project.securityAccessAudit?.length || 0,
        providerUsageCount: project.providerUsageLedger?.length || 0,
        localRuntime: {
          workspacePath: project.localRuntime?.workspacePath || null,
          archivedAt: project.localRuntime?.archivedAt || null,
          latestArchivePath: project.localRuntime?.latestArchivePath || null,
        },
        agentStateSummary,
      },
      messages: {
        count: allMessages.length,
        first: allMessages[0] ? [allMessages[0].id, allMessages[0].time, allMessages[0].channelId] : null,
        latest: allMessages.at(-1) ? [allMessages.at(-1).id, allMessages.at(-1).time, allMessages.at(-1).channelId] : null,
      },
      securityAuditStreamCount: listSecurityAuditStreamRecords(projectId).length,
      accessReplayCount: listAccessReplayRecords(projectId).length,
      providers: {
        model: modelProviderStatus(),
        search: searchProviderStatus(),
        vault: secretVaultStatus(),
        policy: providerControlPolicyStatus(),
        persistence: managedPersistenceAdapterStatus(),
        queue: workerQueueAdapterStatus(),
      },
    });
  };
  const cachedReadModel = (kind, projectId, options = {}, build) => {
    if (options.fresh || options.skipCache) return build();
    const key = `${kind}:${projectId}:${projectReadModelSignature(projectId, options)}`;
    return cacheLimitedReadModel(key, build);
  };
  const attachLocalRuntime = (project) => (
    projectRuntime && typeof projectRuntime.attachProject === 'function'
      ? projectRuntime.attachProject(project)
      : project
  );
  const saveProject = (project) => {
    const savedProject = store.saveProject(attachLocalRuntime(project));
    clearReadModelCache();
    return savedProject;
  };
  const appendMessages = (nextMessages = []) => {
    const appended = store.appendMessages(nextMessages);
    if (nextMessages.length) clearReadModelCache();
    return appended;
  };
  const saveKickoffMeeting = (meeting) => {
    if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
    const savedMeeting = store.saveKickoffMeeting(meeting);
    clearReadModelCache();
    return savedMeeting;
  };
  const listSecurityAuditStreamRecords = (projectId) => (
    typeof store.listSecurityAuditRecords === 'function'
      ? store.listSecurityAuditRecords(projectId)
      : []
  );
  const listAccessReplayRecords = (projectId) => (
    typeof store.listAccessReplayRecords === 'function'
      ? store.listAccessReplayRecords(projectId)
      : []
  );
  const persistResult = (result) => {
    if (result.project?.id) {
      result = {
        ...result,
        project: saveProject(result.project),
      };
    }
    if (result.messages?.length) {
      appendMessages(result.messages);
    }
    return {
      ...result,
      messages: result.messages || [],
      allMessages: store.getMessages(result.project?.id),
    };
  };
  const persistMeetingResult = (result) => {
    if (result.meeting?.id && store.saveKickoffMeeting) {
      saveKickoffMeeting(result.meeting);
    }
    return persistResult(result);
  };
  const requireKickoffMeeting = (meetingId) => {
    if (!store.getKickoffMeeting) throw new Error(`Kickoff meeting not found: ${meetingId}`);
    return store.getKickoffMeeting(meetingId);
  };
  const modelProviderStatus = () => (
    typeof llmProvider?.status === 'function'
      ? llmProvider.status()
      : {
        provider: 'none',
        enabled: false,
        configured: false,
      }
  );
  const searchProviderStatus = () => (
    typeof searchProvider?.status === 'function'
      ? searchProvider.status()
      : {
        provider: 'none',
        enabled: false,
        configured: false,
      }
  );
  const secretVaultStatus = () => normalizeSecretVaultStatus(
    typeof resolvedSecretVault?.status === 'function'
      ? resolvedSecretVault.status()
      : resolvedSecretVault || {},
  );
  const providerControlPolicyStatus = () => normalizeProviderControlPolicy(providerPolicy);
  const appendProviderUsageRecord = ({
    project,
    kind = 'search',
    operation = 'search:evidence',
    providerStatus = {},
    agentId = '',
    decision = {},
    result = {},
    ok = false,
    status = 'completed',
    reason = '',
    evidenceIds = [],
    request = {},
    retry = null,
    circuitBreaker = null,
    estimatedCostCents = null,
    startedAt = nowIso(),
    completedAt = nowIso(),
  } = {}) => {
    if (!project?.id) return { project, record: null };
    const policy = providerControlPolicyStatus();
    const timestamp = Date.parse(completedAt) || Date.now();
    const costCents = estimateProviderCostCents({ kind, result, policy, estimatedCostCents });
    const recordId = `provider_usage_${project.id}_${String(kind).replace(/[^a-z0-9_-]/gi, '_')}_${timestamp}`;
    const eventId = `evt_${recordId}`;
    const record = redactSensitiveObject({
      id: recordId,
      projectId: project.id,
      agentId: agentId || null,
      kind,
      operation,
      provider: providerStatus.provider || result.provider || 'unknown',
      model: providerStatus.model || result.model || null,
      startedAt,
      completedAt,
      allowed: Boolean(decision.allowed),
      wouldDeny: Boolean(decision.wouldDeny),
      decisionReason: reason || decision.reason || (decision.reasons || [])[0] || (decision.allowed ? 'allowed' : 'denied'),
      decisionReasons: decision.reasons || [],
      ok: Boolean(ok),
      status,
      costCents,
      usage: result.usage || null,
      retry: retry || result.retry || null,
      circuitBreaker: circuitBreaker || null,
      responseId: result.id || result.responseId || null,
      sourceCount: result.sources?.length || 0,
      request: {
        queryPreview: compactPreview(request.query),
        purposePreview: compactPreview(request.purpose),
        command: request.command || null,
      },
      policy: {
        schemaVersion: policy.schemaVersion,
        configured: policy.configured,
        enabled: policy.enabled,
        mode: policy.mode,
        enforcementEnabled: policy.enforcementEnabled,
        maxRequestsPerProjectHour: policy.maxRequestsPerProjectHour,
        dailyBudgetCents: policy.dailyBudgetCents,
        currency: policy.currency,
        retryPolicy: policy.retryPolicy,
        circuitBreaker: policy.circuitBreaker,
      },
      evidenceIds: uniqueStrings(evidenceIds).slice(0, 20),
      eventId,
    });
    const updatedProject = appendProjectEvents({
      ...project,
      providerUsageLedger: [
        record,
        ...(project.providerUsageLedger || []),
      ].slice(0, PROVIDER_USAGE_LEDGER_LIMIT),
    }, [
      createProjectLedgerEvent({
        id: eventId,
        type: 'provider-usage',
        time: completedAt,
        actor: `Provider Control:${record.kind}`,
        summary: `${record.allowed ? 'Allowed' : 'Denied'} ${record.kind} provider ${record.provider} for ${record.operation}.`,
        source: 'provider-control',
        channelId: 'provider-control',
        evidenceIds: uniqueStrings([record.id, ...(record.evidenceIds || [])]),
        entityIds: {
          projectId: project.id,
          agentId: agentId || null,
          providerUsageId: record.id,
        },
        payload: redactSensitiveObject({
          kind: record.kind,
          operation: record.operation,
          provider: record.provider,
          model: record.model,
          allowed: record.allowed,
          wouldDeny: record.wouldDeny,
          status: record.status,
          ok: record.ok,
          reason: record.decisionReason,
          costCents: record.costCents,
          policy: record.policy,
          retry: record.retry,
          circuitBreaker: record.circuitBreaker,
        }),
      }),
    ]);
    const savedProject = saveProject(updatedProject);
    return { project: savedProject, record };
  };
  const enrichCommandResultWithModelIntent = async ({
    projectId,
    result = {},
    command = '',
    input = {},
    now = nowIso(),
  } = {}) => {
    if (!commandShouldRequestModelIntent(command) || typeof llmProvider?.createRuntimeIntent !== 'function') {
      return result;
    }
    const status = modelProviderStatus();
    if (!status.enabled) {
      return {
        ...result,
        modelIntentStatus: status,
      };
    }

    const project = result.project?.id
      ? result.project
      : projectId
        ? store.getProject(projectId)
        : null;
    if (!project?.id) {
      return {
        ...result,
        modelIntentStatus: status,
      };
    }

    const providerPolicyStatus = providerControlPolicyStatus();
    const providerPolicyDecision = evaluateProviderPolicy({
      project,
      policy: providerPolicyStatus,
      kind: 'model',
      operation: 'model:intent',
      providerStatus: status,
      model: status.model,
      now,
    });
    if (!providerPolicyDecision.allowed) {
      const usage = appendProviderUsageRecord({
        project,
        kind: 'model',
        operation: 'model:intent',
        providerStatus: status,
        decision: providerPolicyDecision,
        ok: false,
        status: 'denied',
        reason: providerPolicyDecision.reason,
        request: { command },
        startedAt: now,
        completedAt: now,
      });
      return {
        ...result,
        project: usage.project,
        modelIntentStatus: status,
        providerUsage: usage.record,
      };
    }

    const providerCircuitDecision = evaluateProviderCircuitBreaker({
      project,
      policy: providerPolicyStatus,
      kind: 'model',
      providerStatus: status,
      now,
    });
    if (!providerCircuitDecision.allowed) {
      const usage = appendProviderUsageRecord({
        project,
        kind: 'model',
        operation: 'model:intent',
        providerStatus: status,
        decision: {
          ...providerPolicyDecision,
          allowed: false,
          wouldDeny: true,
          reason: providerCircuitDecision.reason,
          reasons: uniqueStrings([...(providerPolicyDecision.reasons || []), providerCircuitDecision.reason]),
        },
        ok: false,
        status: 'circuit-open',
        reason: providerCircuitDecision.reason,
        request: { command },
        circuitBreaker: providerCircuitDecision.row,
        startedAt: now,
        completedAt: now,
      });
      return {
        ...result,
        project: usage.project,
        modelIntentStatus: status,
        providerUsage: usage.record,
      };
    }

    const modelAttempt = await runProviderWithRetry({
      policy: providerPolicyStatus,
      now,
      run: () => llmProvider.createRuntimeIntent({
        project,
        command,
        input,
        resultMessages: result.messages || [],
        now,
      }),
    });
    const modelResult = {
      ...(modelAttempt.result || {}),
      retry: modelAttempt.retry,
    };
    const timestamp = Date.parse(now) || Date.now();
    const modelIntent = {
      id: `model_intent_${project.id}_${timestamp}`,
      projectId: project.id,
      provider: status.provider,
      model: modelResult.model || status.model,
      baseURL: status.baseURL,
      command,
      createdAt: now,
      ok: Boolean(modelResult.ok),
      skipped: Boolean(modelResult.skipped),
      status: modelResult.ok ? 'ready' : 'failed',
      intent: compactModelIntent(modelResult.intent || {}),
      content: modelResult.content || '',
      usage: modelResult.usage || null,
      error: modelResult.error || null,
      responseId: modelResult.id || null,
    };
    const log = {
      id: `log_${modelIntent.id}`,
      time: now,
      agent: 'Model Provider Driver',
      actor: 'Model Provider Driver',
      eventType: modelResult.ok ? 'model-intent' : 'model-intent-error',
      source: 'model-provider',
      channelId: 'model-driver',
      log: modelIntentSummary(modelIntent),
      modelIntentId: modelIntent.id,
      provider: modelIntent.provider,
      model: modelIntent.model,
      command,
    };
    const projectWithIntent = appendProjectEvents({
      ...project,
      logs: [log, ...(project.logs || [])],
      modelIntentLedger: [
        modelIntent,
        ...(project.modelIntentLedger || []),
      ].slice(0, MODEL_INTENT_LEDGER_LIMIT),
    }, [
      createProjectLedgerEvent({
        id: `evt_${modelIntent.id}`,
        type: modelResult.ok ? 'model-intent' : 'model-intent-error',
        time: now,
        actor: 'Model Provider Driver',
        summary: log.log,
        source: 'model-provider',
        channelId: 'model-driver',
        evidenceIds: [modelIntent.id, log.id],
        entityIds: {
          projectId: project.id,
          logId: log.id,
        },
        payload: {
          provider: modelIntent.provider,
          model: modelIntent.model,
          command,
          intent: modelIntent.intent,
          usage: modelIntent.usage,
          ok: modelIntent.ok,
          error: modelIntent.error,
        },
      }),
    ]);
    const usage = appendProviderUsageRecord({
      project: projectWithIntent,
      kind: 'model',
      operation: 'model:intent',
      providerStatus: status,
      decision: providerPolicyDecision,
      result: modelResult,
      ok: Boolean(modelResult.ok),
      status: modelResult.ok ? 'completed' : 'failed',
      reason: modelResult.error || modelResult.reason || '',
      request: { command },
      retry: modelAttempt.retry,
      circuitBreaker: providerCircuitDecision.row,
      evidenceIds: [modelIntent.id, log.id],
      startedAt: now,
      completedAt: now,
    });

    return {
      ...result,
      project: usage.project,
      modelIntent,
      modelIntentLog: log,
      modelIntentStatus: status,
      providerUsage: usage.record,
    };
  };

  return {
    getModelProviderStatus() {
      return modelProviderStatus();
    },
    getSearchProviderStatus() {
      return searchProviderStatus();
    },
    async testModelProvider(input = {}) {
      if (typeof llmProvider?.test !== 'function') {
        return {
          ok: false,
          skipped: true,
          reason: 'model-provider-not-configured',
          status: modelProviderStatus(),
        };
      }
      const result = await llmProvider.test(input.prompt);
      return {
        ...result,
        status: modelProviderStatus(),
      };
    },
    async testSearchProvider(input = {}) {
      if (typeof searchProvider?.test !== 'function') {
        return {
          ok: false,
          skipped: true,
          reason: 'search-provider-not-configured',
          status: searchProviderStatus(),
        };
      }
      const result = await searchProvider.test(input.query || input.prompt);
      return {
        ...result,
        status: searchProviderStatus(),
      };
    },
    async enrichCommandResultWithModelIntent(input = {}) {
      return enrichCommandResultWithModelIntent(input);
    },
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
      saveKickoffMeeting(meeting);
      return {
        meeting,
        messages: [],
        route: 'kickoff-meeting-created',
      };
    },
    async createKickoffMeetingAsync(input = {}) {
      if (!store.saveKickoffMeeting) throw new Error('Kickoff meeting store is not available.');
      if (typeof llmProvider?.createChatCompletion !== 'function') {
        throw new Error('model-provider-not-configured');
      }
      const status = modelProviderStatus();
      if (!status.enabled) {
        const reason = status.blockedByPolicy ? 'model-blocked' : status.configured ? 'provider-disabled' : 'missing-api-key';
        throw new Error(`model-provider-unavailable:${reason}`);
      }
      const now = input.now || nowIso();
      const meetingId = input.meetingId || `kickoff_meeting_${Date.parse(now) || Date.now()}`;
      const completion = await llmProvider.createChatCompletion({
        messages: buildModelKickoffMeetingMessages({
          ...input,
          meetingId,
          now,
        }),
        json: true,
        maxTokens: Math.max(1800, Number(input.maxTokens) || 0),
        timeoutMs: input.timeoutMs || 45_000,
      });
      if (!completion.ok) {
        throw new Error(`model-kickoff-meeting-failed:${completion.error || completion.reason || 'unknown'}`);
      }
      if (!completion.json || typeof completion.json !== 'object') {
        throw new Error('model-kickoff-meeting-invalid-json');
      }
      const meeting = createModelKickoffMeetingSession({
        ...input,
        meetingId,
        now,
      }, completion.json, completion);
      saveKickoffMeeting(meeting);
      return {
        meeting,
        messages: [],
        route: 'kickoff-meeting-created',
        modelKickoffMeeting: {
          ok: true,
          provider: completion.provider,
          model: completion.model,
          usage: completion.usage || null,
        },
      };
    },
    clarifyKickoffMeeting({ meetingId, ...input } = {}) {
      const meeting = requireKickoffMeeting(meetingId);
      const clarifiedMeeting = addKickoffMeetingClarification({
        meeting,
        ...input,
      });
      saveKickoffMeeting(clarifiedMeeting);
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
      saveKickoffMeeting(confirmedMeeting);
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
      saveKickoffMeeting(confirmedMeeting);
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
      return cachedReadModel('readiness-proof-map', projectId, {}, () => buildReadinessProofMap({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
      }));
    },
    getManagerDashboard(projectId, options = {}) {
      return cachedReadModel('manager-dashboard', projectId, options, () => localizeReadModel(buildManagerDashboardSnapshot({
          project: store.getProject(projectId),
          messages: store.getMessages(projectId),
        }), options.language || store.getProject(projectId)?.language || 'en'));
    },
    getManagerFlowGraph(projectId, options = {}) {
      return cachedReadModel('manager-flow-graph', projectId, options, () => localizeReadModel(buildManagerFlowGraphSnapshot({
          project: store.getProject(projectId),
          messages: store.getMessages(projectId),
        }), options.language || store.getProject(projectId)?.language || 'en'));
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
      saveProject(updatedProject);
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
      saveProject(managerActionProject);

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
      return cachedReadModel('manager-ready-package', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      const mvpReadiness = buildMvpReadiness({ managerDashboard, managerFlowGraph });
      const securityBoundary = buildSecurityBoundarySnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard,
        mvpReadiness,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        securityAuditStreamRecords: listSecurityAuditStreamRecords(projectId),
      });
      const providerReadiness = buildProviderReadinessSnapshot({
        project: store.getProject(projectId),
        managerDashboard,
        mvpReadiness,
        securityBoundary,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        providerControlPolicy: providerControlPolicyStatus(),
      });
      const persistenceAdapterPlan = this.getPersistenceAdapterPlan(projectId, { language });
      const persistenceAdapterDryRun = this.getPersistenceAdapterDryRun(projectId, { language });
      const workerQueueAdapterPlan = this.getWorkerQueueAdapterPlan(projectId, { language });
      const workerQueueAdapterDryRun = this.getWorkerQueueAdapterDryRun(projectId, { language });
      const workerQueueSnapshot = this.getProjectWorkerQueue(projectId, {
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: store.getProject(projectId)?.team?.length || Infinity,
        maxProjects: 1,
        language,
      });
      const operationsReadiness = this.getOperationsReadiness(projectId, { language });
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, { language });
      const pilotLaunchReadiness = buildPilotLaunchReadinessSnapshot({
        project: store.getProject(projectId),
        managerDashboard,
        managerFlowGraph,
        mvpReadiness,
        securityBoundary,
        providerReadiness,
        operationsReadiness,
        persistenceSnapshot,
        persistenceAdapterPlan,
        persistenceAdapterDryRun,
        workerQueueSnapshot,
        workerQueueAdapterPlan,
        workerQueueAdapterDryRun,
      });
      const adapterGatewayPreflight = buildAdapterGatewayConfigPreflight({
        projectId,
        managedPersistenceStatus: managedPersistenceAdapterStatus(),
        workerQueueStatus: workerQueueAdapterStatus(),
      });
      const deploymentPreflight = buildDeploymentPreflightSnapshot({
        project: store.getProject(projectId),
        managerDashboard,
        pilotLaunchReadiness,
        mvpReadiness,
        securityBoundary,
        providerReadiness,
        operationsReadiness,
        persistenceAdapterDryRun,
        workerQueueAdapterDryRun,
        adapterGatewayPreflight,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        providerControlPolicy: providerControlPolicyStatus(),
        managedPersistenceStatus: managedPersistenceAdapterStatus(),
        workerQueueStatus: workerQueueAdapterStatus(),
        store,
      });
      const launchApprovalWorkflow = buildLaunchApprovalWorkflowSnapshot({
        project: store.getProject(projectId),
      });
      const productionLaunchAudit = buildProductionLaunchAuditSnapshot({
        project: store.getProject(projectId),
        managerDashboard,
        mvpReadiness,
        pilotLaunchReadiness,
        deploymentPreflight,
        launchApprovalWorkflow,
        securityBoundary,
        providerReadiness,
        operationsReadiness,
      });
      const projectEvidenceArchive = buildProjectEvidenceArchive({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard,
        managerFlowGraph,
        mvpReadiness,
        pilotLaunchReadiness,
        deploymentPreflight,
        productionLaunchAudit,
        securityBoundary,
        providerReadiness,
        operationsReadiness,
        persistenceSnapshot,
        workerQueueSnapshot,
        includeContents: false,
      });
      const projectEvidenceExportWorkflow = buildProjectEvidenceExportWorkflowSnapshot({
        project: store.getProject(projectId),
        archive: projectEvidenceArchive,
      });
      return localizeReadModel({
        projectId,
        status: managerDashboard.readiness?.status || 'unknown',
        ready: managerDashboard.readiness?.status === 'manager-ready',
        mvpStatus: mvpReadiness.status,
        readyForLocalPilot: mvpReadiness.readyForLocalPilot,
        readyForProduction: mvpReadiness.readyForProduction,
        score: managerDashboard.readiness?.score || 0,
        generatedAt: nowIso(),
        managerDashboard,
        managerFlowGraph,
        mvpReadiness,
        pilotLaunchReadiness,
        deploymentPreflight,
        adapterGatewayPreflight,
        launchApprovalWorkflow,
        productionLaunchAudit,
        projectEvidenceArchive,
        projectEvidenceExportWorkflow,
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
        securityBoundary,
        providerReadiness,
        operationsReadiness,
        persistenceAdapterPlan,
        persistenceAdapterDryRun,
        workerQueueAdapterPlan,
        workerQueueAdapterDryRun,
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
          mvpCorePassedCount: mvpReadiness.summary?.corePassedCount || 0,
          mvpCoreTotalCount: mvpReadiness.summary?.coreTotalCount || 0,
          mvpCoreBlockerCount: mvpReadiness.summary?.coreBlockerCount || 0,
          mvpProductionBlockerCount: mvpReadiness.summary?.productionBlockerCount || 0,
          securityBoundaryStatus: securityBoundary.status || 'unknown',
          securityRoutePolicyCount: securityBoundary.summary?.routePolicyCount || 0,
          securityRawLeakCount: securityBoundary.summary?.rawLeakCount || 0,
          securityProductionBlockerCount: securityBoundary.summary?.productionBlockerCount || 0,
          securityAccessAuditCount: securityBoundary.accessAudit?.count || 0,
          securityAccessDeniedCount: securityBoundary.accessAudit?.deniedCount || 0,
          securityAuditStreamCount: securityBoundary.accessAudit?.stream?.count || 0,
          securityAuditStreamGapCount: securityBoundary.accessAudit?.stream?.sequenceGapCount || 0,
          identitySessionCount: securityBoundary.summary?.identitySessionCount || 0,
          identitySessionActiveCount: securityBoundary.summary?.identitySessionActiveCount || 0,
          identitySessionRevokedCount: securityBoundary.summary?.identitySessionRevokedCount || 0,
          providerReadinessStatus: providerReadiness.status || 'unknown',
          providerReadinessGateCount: providerReadiness.summary?.gateCount || 0,
          providerReadinessFailedGateCount: providerReadiness.summary?.failedGateCount || 0,
          providerProductionControlCount: providerReadiness.summary?.productionControlCount || 0,
          providerBackedSearchCount: providerReadiness.summary?.providerBackedSearchCount || 0,
          operationsReadinessStatus: operationsReadiness.status || 'unknown',
          operationsReadinessGateCount: operationsReadiness.summary?.gateCount || 0,
          operationsReadinessFailedGateCount: operationsReadiness.summary?.failedGateCount || 0,
          operationsRecoveryStepCount: operationsReadiness.summary?.recoveryStepCount || 0,
          operationsIncidentDrillReady: Boolean(operationsReadiness.summary?.incidentDrillReady),
          operationsIncidentDrillReceiptCount: operationsReadiness.summary?.incidentDrillReceiptCount || 0,
          operationsIncidentDrillFailedReceiptCount: operationsReadiness.summary?.incidentDrillFailedReceiptCount || 0,
          operationsIncidentDrillRoutedAlertRuleCount: operationsReadiness.summary?.incidentDrillRoutedAlertRuleCount || 0,
          pilotLaunchStatus: pilotLaunchReadiness.status,
          pilotLaunchDecision: pilotLaunchReadiness.privatePilotDecision,
          pilotLaunchGateCount: pilotLaunchReadiness.summary?.gateCount || 0,
          pilotLaunchFailedGateCount: pilotLaunchReadiness.summary?.failedGateCount || 0,
          pilotLaunchEvidenceRouteCount: pilotLaunchReadiness.summary?.evidenceRouteCount || 0,
          pilotLaunchReadyEvidenceRouteCount: pilotLaunchReadiness.summary?.readyEvidenceRouteCount || 0,
          pilotLaunchProductionBlockerCount: pilotLaunchReadiness.summary?.productionBlockerCount || 0,
          pilotLaunchPacketChecksum: pilotLaunchReadiness.checksum,
          deploymentPreflightStatus: deploymentPreflight.status,
          deploymentPreflightReady: Boolean(deploymentPreflight.privatePilotDeploymentReady),
          deploymentPreflightFailedGateCount: deploymentPreflight.summary?.failedGateCount || 0,
          deploymentPreflightFailedBlockerGateCount: deploymentPreflight.summary?.failedBlockerGateCount || 0,
          deploymentPreflightWarningCount: deploymentPreflight.summary?.failedWarningGateCount || 0,
          deploymentPreflightChecksum: deploymentPreflight.checksum,
          adapterGatewayPreflightStatus: adapterGatewayPreflight.status,
          adapterGatewayMode: adapterGatewayPreflight.gatewayMode,
          adapterGatewayEndpointConfigured: Boolean(adapterGatewayPreflight.summary?.endpointConfigured),
          adapterGatewayLiveReady: Boolean(adapterGatewayPreflight.summary?.liveGatewayReady),
          adapterGatewayStateReadable: Boolean(adapterGatewayPreflight.summary?.stateReadable),
          adapterGatewayFailedGateCount: adapterGatewayPreflight.summary?.failedGateCount || 0,
          launchApprovalStatus: launchApprovalWorkflow.status,
          launchApprovalCount: launchApprovalWorkflow.summary?.approvalCount || 0,
          launchApprovalPrivatePilotReady: Boolean(launchApprovalWorkflow.readyForPrivatePilot),
          launchApprovalProductionReady: Boolean(launchApprovalWorkflow.readyForProduction),
          productionLaunchAuditStatus: productionLaunchAudit.status,
          productionLaunchPrivatePilotDecision: productionLaunchAudit.privatePilotDecision,
          productionLaunchProductionDecision: productionLaunchAudit.productionDecision,
          productionLaunchFailedPrivateGateCount: productionLaunchAudit.summary?.failedPrivatePilotGateCount || 0,
          productionLaunchFailedProductionGateCount: productionLaunchAudit.summary?.failedProductionGateCount || 0,
          productionLaunchProductionBlockerCount: productionLaunchAudit.summary?.productionBlockerCount || 0,
          productionLaunchChecksum: productionLaunchAudit.checksum,
          projectEvidenceArchiveStatus: projectEvidenceArchive.status,
          projectEvidenceArchiveReady: Boolean(projectEvidenceArchive.readyForManagerHandoff),
          projectEvidenceArchiveManifestEntryCount: projectEvidenceArchive.summary?.manifestEntryCount || 0,
          projectEvidenceArchiveReadyManifestEntryCount: projectEvidenceArchive.summary?.readyManifestEntryCount || 0,
          projectEvidenceArchiveSubmissionCount: projectEvidenceArchive.summary?.submissionCount || 0,
          projectEvidenceArchiveFinalDeliverableCount: projectEvidenceArchive.summary?.finalDeliverableCount || 0,
          projectEvidenceArchiveEvidenceSearchCount: projectEvidenceArchive.summary?.evidenceSearchCount || 0,
          projectEvidenceArchiveReviewCount: projectEvidenceArchive.summary?.submissionReviewCount || 0,
          projectEvidenceArchiveRawLeakCount: projectEvidenceArchive.summary?.rawLeakCount || 0,
          projectEvidenceArchiveChecksum: projectEvidenceArchive.checksum,
          projectEvidenceExportStatus: projectEvidenceExportWorkflow.status,
          projectEvidenceExportReady: Boolean(projectEvidenceExportWorkflow.readyForPrivatePilotHandoff),
          projectEvidenceExportRequestCount: projectEvidenceExportWorkflow.summary?.requestCount || 0,
          projectEvidenceExportApprovalCount: projectEvidenceExportWorkflow.summary?.approvalCount || 0,
          projectEvidenceExportFailedGateCount: projectEvidenceExportWorkflow.summary?.failedGateCount || 0,
          projectEvidenceExportChecksum: projectEvidenceExportWorkflow.checksum,
          persistenceAdapterPlanStatus: persistenceAdapterPlan.status || 'unknown',
          persistenceAdapterDryRunStatus: persistenceAdapterDryRun.status || 'unknown',
          persistenceAdapterFailedGateCount: persistenceAdapterDryRun.summary?.failedGateCount || 0,
          persistenceAdapterShadowReadParityCount: persistenceAdapterDryRun.summary?.shadowReadParityCount || 0,
          persistenceAdapterRollbackReady: Boolean(persistenceAdapterDryRun.summary?.transactionRollbackReady),
          persistenceAdapterBackupRestoreReady: Boolean(persistenceAdapterDryRun.summary?.backupRestoreReady),
          persistenceAdapterOperationCount: persistenceAdapterDryRun.summary?.adapterOperationCount || 0,
          persistenceAdapterImportedTableCount: persistenceAdapterDryRun.summary?.adapterImportedTableCount || 0,
          persistenceAdapterDriver: persistenceAdapterDryRun.summary?.adapterDriver || 'unknown',
          persistenceAdapterStatus: persistenceAdapterDryRun.summary?.adapterStatus || 'unknown',
          persistenceAdapterProductionCutoverReady: Boolean(persistenceAdapterDryRun.summary?.adapterProductionCutoverReady),
          queueAdapterPlanStatus: workerQueueAdapterPlan.status || 'unknown',
          queueAdapterDryRunStatus: workerQueueAdapterDryRun.status || 'unknown',
          queueAdapterFailedGateCount: workerQueueAdapterDryRun.summary?.failedGateCount || 0,
          queueAdapterDispatchCount: workerQueueAdapterDryRun.summary?.dispatchCount || 0,
          queueAdapterLeaseAcquisitionCount: workerQueueAdapterDryRun.summary?.leaseAcquisitionCount || 0,
          queueAdapterOperationCount: workerQueueAdapterDryRun.summary?.adapterOperationCount || 0,
          queueAdapterQueueRowCount: workerQueueAdapterDryRun.summary?.adapterQueueRowCount || 0,
          queueAdapterSnapshotParityReady: Boolean(workerQueueAdapterDryRun.summary?.snapshotParityReady),
          queueAdapterSnapshotQueueRowParityReady: Boolean(workerQueueAdapterDryRun.summary?.snapshotQueueRowParityReady),
          queueAdapterSnapshotLeaseParityReady: Boolean(workerQueueAdapterDryRun.summary?.snapshotLeaseParityReady),
          queueAdapterSnapshotAcknowledgementParityReady: Boolean(workerQueueAdapterDryRun.summary?.snapshotAcknowledgementParityReady),
          queueAdapterSnapshotDeadLetterParityReady: Boolean(workerQueueAdapterDryRun.summary?.snapshotDeadLetterParityReady),
          queueAdapterDriver: workerQueueAdapterDryRun.summary?.adapterDriver || 'unknown',
          queueAdapterStatus: workerQueueAdapterDryRun.summary?.adapterStatus || 'unknown',
          queueAdapterProductionCutoverReady: Boolean(workerQueueAdapterDryRun.summary?.adapterProductionCutoverReady),
          workerExecutionReceiptCount: operationsReadiness.summary?.workerExecutionReceiptCount || 0,
          workerDeadLetterCount: operationsReadiness.summary?.workerDeadLetterCount || 0,
          workerRetryableFailureCount: operationsReadiness.summary?.workerRetryableFailureCount || 0,
          workerRecoveryContractReady: Boolean(operationsReadiness.summary?.workerRecoveryContractReady),
        },
      }, language);
      });
    },
    getPilotLaunchReadiness(projectId, options = {}) {
      const managerReadyPackage = this.getManagerReadyPackage(projectId, options);
      return managerReadyPackage.pilotLaunchReadiness;
    },
    getDeploymentPreflight(projectId, options = {}) {
      const managerReadyPackage = this.getManagerReadyPackage(projectId, options);
      return managerReadyPackage.deploymentPreflight;
    },
    getAdapterGatewayPreflight(projectId, options = {}) {
      return cachedReadModel('adapter-gateway-preflight', projectId, options, () => {
        const language = options.language || store.getProject(projectId)?.language || 'en';
        return localizeReadModel(buildAdapterGatewayConfigPreflight({
          projectId,
          managedPersistenceStatus: managedPersistenceAdapterStatus(),
          workerQueueStatus: workerQueueAdapterStatus(),
        }), language);
      });
    },
    async getAdapterGatewayPreflightAsync(projectId, options = {}) {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      return localizeReadModel(await buildAdapterGatewayLivePreflight({
        projectId,
        managedPersistenceStatus: managedPersistenceAdapterStatus(),
        workerQueueStatus: workerQueueAdapterStatus(),
      }), language);
    },
    getProductionLaunchAudit(projectId, options = {}) {
      const managerReadyPackage = this.getManagerReadyPackage(projectId, options);
      return managerReadyPackage.productionLaunchAudit;
    },
    getProjectEvidenceArchive(projectId, options = {}) {
      return cachedReadModel('project-evidence-archive', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerReadyPackage = this.getManagerReadyPackage(projectId, { language });
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, { language });
      const workerQueueSnapshot = this.getProjectWorkerQueue(projectId, {
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: store.getProject(projectId)?.team?.length || Infinity,
        maxProjects: 1,
        language,
      });
      return localizeReadModel(buildProjectEvidenceArchive({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard: managerReadyPackage.managerDashboard,
        managerFlowGraph: managerReadyPackage.managerFlowGraph,
        mvpReadiness: managerReadyPackage.mvpReadiness,
        pilotLaunchReadiness: managerReadyPackage.pilotLaunchReadiness,
        deploymentPreflight: managerReadyPackage.deploymentPreflight,
        productionLaunchAudit: managerReadyPackage.productionLaunchAudit,
        securityBoundary: managerReadyPackage.securityBoundary,
        providerReadiness: managerReadyPackage.providerReadiness,
        operationsReadiness: managerReadyPackage.operationsReadiness,
        persistenceSnapshot,
        workerQueueSnapshot,
        includeContents: true,
      }), language);
      });
    },
    getProjectEvidenceExportWorkflow(projectId, options = {}) {
      return cachedReadModel('project-evidence-export-workflow', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const archive = this.getProjectEvidenceArchive(projectId, { language });
      return localizeReadModel(buildProjectEvidenceExportWorkflowSnapshot({
        project: store.getProject(projectId),
        archive,
      }), language);
      });
    },
    recordProjectEvidenceExport({ projectId, ...input } = {}) {
      const project = store.getProject(projectId);
      const now = input.now || nowIso();
      const archive = this.getProjectEvidenceArchive(projectId, { language: input.language || project?.language || 'en' });
      const exportRecord = buildProjectEvidenceExportRecord({
        project,
        input: {
          ...input,
          projectId,
        },
        archive,
        now,
      });
      const actionLabel = exportRecord.action === 'approve'
        ? 'approved'
        : exportRecord.action === 'reject'
          ? 'rejected'
          : exportRecord.action === 'download-audit'
            ? 'download audit recorded'
            : 'requested';
      const log = {
        id: `log_${exportRecord.id}`,
        time: now,
        agent: 'Evidence Export Control',
        eventType: 'project-evidence-export',
        projectEvidenceExportId: exportRecord.id,
        exportRequestId: exportRecord.exportRequestId,
        exportMode: exportRecord.mode,
        log: `Project evidence export ${actionLabel} by ${exportRecord.actorRole}: ${exportRecord.reason || 'no reason provided'}.`,
        evidence: [
          `Export checksum ${exportRecord.checksum}`,
          exportRecord.archiveChecksum ? `Archive checksum ${exportRecord.archiveChecksum}` : null,
        ].filter(Boolean),
      };
      const event = createProjectLedgerEvent({
        id: `evt_${exportRecord.id}`,
        type: 'project-evidence-export',
        time: now,
        actor: `Evidence Export:${exportRecord.actorRole}`,
        summary: `Project evidence export ${actionLabel} by ${exportRecord.actorRole}.`,
        source: exportRecord.source,
        channelId: 'project-evidence-export',
        evidenceIds: [exportRecord.id, exportRecord.checksum, exportRecord.archiveChecksum].filter(Boolean),
        entityIds: {
          projectId,
          projectEvidenceExportId: exportRecord.id,
          exportRequestId: exportRecord.exportRequestId,
          exportMode: exportRecord.mode,
          actorRole: exportRecord.actorRole,
        },
        payload: {
          schemaVersion: exportRecord.schemaVersion,
          mode: exportRecord.mode,
          action: exportRecord.action,
          decision: exportRecord.decision,
          actorRole: exportRecord.actorRole,
          actorId: exportRecord.actorId,
          archiveChecksum: exportRecord.archiveChecksum,
          checksum: exportRecord.checksum,
          retentionDays: exportRecord.retentionDays,
          expiresAt: exportRecord.expiresAt,
          dataResidencyRegion: exportRecord.dataResidencyRegion,
          productionReady: false,
        },
      });
      const updatedProject = appendProjectEvents({
        ...project,
        projectEvidenceExports: [
          exportRecord,
          ...(project.projectEvidenceExports || []),
        ].slice(0, PROJECT_EVIDENCE_EXPORT_LIMIT),
        logs: [
          log,
          ...(project.logs || []),
        ],
      }, [event]);
      const savedProject = saveProject(updatedProject);
      return {
        project: savedProject,
        projectEvidenceExport: exportRecord,
        projectEvidenceExportWorkflow: buildProjectEvidenceExportWorkflowSnapshot({
          project: savedProject,
          archive,
        }),
        projectEvidenceArchive: archive,
        log,
      };
    },
    getLaunchApprovalWorkflow(projectId, options = {}) {
      return cachedReadModel('launch-approval-workflow', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      return localizeReadModel(buildLaunchApprovalWorkflowSnapshot({
        project: store.getProject(projectId),
      }), language);
      });
    },
    recordLaunchApproval({ projectId, ...input } = {}) {
      const project = store.getProject(projectId);
      const now = input.now || nowIso();
      const launchApproval = buildLaunchApprovalRecord({
        project,
        input: {
          ...input,
          projectId,
        },
        now,
      });
      const modeLabel = launchApproval.mode === 'production' ? 'Production' : 'Private pilot';
      const decisionLabel = launchApproval.decision === 'approved' ? 'approved' : launchApproval.decision;
      const log = {
        id: `log_${launchApproval.id}`,
        time: now,
        agent: 'Launch Control',
        eventType: 'launch-approval',
        launchApprovalId: launchApproval.id,
        releaseMode: launchApproval.mode,
        log: `${modeLabel} launch ${decisionLabel} by ${launchApproval.approverRole}: ${launchApproval.reason || 'no reason provided'}.`,
        evidence: [`Approval checksum ${launchApproval.checksum}`],
      };
      const event = createProjectLedgerEvent({
        id: `evt_${launchApproval.id}`,
        type: 'launch-approval',
        time: now,
        actor: `Launch Approval:${launchApproval.approverRole}`,
        summary: `${modeLabel} launch ${decisionLabel} by ${launchApproval.approverRole}.`,
        source: launchApproval.source,
        channelId: 'launch-approval',
        evidenceIds: [launchApproval.id, launchApproval.checksum].filter(Boolean),
        entityIds: {
          projectId,
          launchApprovalId: launchApproval.id,
          releaseMode: launchApproval.mode,
          approverRole: launchApproval.approverRole,
        },
        payload: {
          schemaVersion: launchApproval.schemaVersion,
          mode: launchApproval.mode,
          decision: launchApproval.decision,
          approverRole: launchApproval.approverRole,
          approverId: launchApproval.approverId,
          checksum: launchApproval.checksum,
          linkedAuditChecksum: launchApproval.linkedAuditChecksum,
        },
      });
      const updatedProject = appendProjectEvents({
        ...project,
        launchApprovals: [
          launchApproval,
          ...(project.launchApprovals || []),
        ].slice(0, 80),
        logs: [
          log,
          ...(project.logs || []),
        ],
      }, [event]);
      const savedProject = saveProject(updatedProject);
      return {
        project: savedProject,
        launchApproval,
        launchApprovalWorkflow: buildLaunchApprovalWorkflowSnapshot({ project: savedProject }),
        log,
      };
    },
    getMvpReadiness(projectId, options = {}) {
      return cachedReadModel('mvp-readiness', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      return localizeReadModel(buildMvpReadiness({ managerDashboard, managerFlowGraph }), language);
      });
    },
    getPersistenceSnapshot(projectId, options = {}) {
      return cachedReadModel('persistence-snapshot', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      const mvpReadiness = buildMvpReadiness({ managerDashboard, managerFlowGraph });
      const securityBoundary = buildSecurityBoundarySnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard,
        mvpReadiness,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        securityAuditStreamRecords: listSecurityAuditStreamRecords(projectId),
      });
      return buildProductionPersistenceSnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard,
        managerFlowGraph,
        mvpReadiness,
        securityBoundary,
        securityAuditStreamRecords: listSecurityAuditStreamRecords(projectId),
        accessReplayRecords: listAccessReplayRecords(projectId),
      });
      });
    },
    getPersistenceMigrationPlan(projectId, options = {}) {
      return cachedReadModel('persistence-migration-plan', projectId, options, () => {
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, options);
      return buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      });
    },
    getPersistenceMigrationDryRun(projectId, options = {}) {
      return cachedReadModel('persistence-migration-dry-run', projectId, options, () => {
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, options);
      const migrationPlan = buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      return buildManagedPersistenceDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        projectId,
      });
      });
    },
    getPersistenceAdapterPlan(projectId, options = {}) {
      return cachedReadModel('persistence-adapter-plan', projectId, options, () => {
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, options);
      const migrationPlan = buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      const migrationDryRun = buildManagedPersistenceDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        projectId,
      });
      return buildManagedPersistenceAdapterPlan({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        projectId,
      });
      });
    },
    getPersistenceAdapterDryRun(projectId, options = {}) {
      return cachedReadModel('persistence-adapter-dry-run', projectId, options, () => {
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, options);
      const migrationPlan = buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      const migrationDryRun = buildManagedPersistenceDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        projectId,
      });
      const adapterPlan = buildManagedPersistenceAdapterPlan({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        projectId,
      });
      return buildManagedPersistenceAdapterDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        adapterPlan,
        projectId,
      });
      });
    },
    async getPersistenceAdapterDryRunAsync(projectId, options = {}) {
      const adapterStatus = managedPersistenceAdapterStatus();
      if (adapterStatus.driver !== 'http-json' || !adapterStatus.httpEndpointConfigured) {
        return this.getPersistenceAdapterDryRun(projectId, options);
      }
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, options);
      const migrationPlan = buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      const migrationDryRun = buildManagedPersistenceDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        projectId,
      });
      const adapterPlan = buildManagedPersistenceAdapterPlan({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        projectId,
      });
      return buildManagedPersistenceAdapterGatewayDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        adapterPlan,
        projectId,
      });
    },
    getSecurityBoundary(projectId, options = {}) {
      return cachedReadModel('security-boundary', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      const mvpReadiness = buildMvpReadiness({ managerDashboard, managerFlowGraph });
      return buildSecurityBoundarySnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        managerDashboard,
        mvpReadiness,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        securityAuditStreamRecords: listSecurityAuditStreamRecords(projectId),
      });
      });
    },
    getProviderReadiness(projectId, options = {}) {
      return cachedReadModel('provider-readiness', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const project = store.getProject(projectId);
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      const mvpReadiness = buildMvpReadiness({ managerDashboard, managerFlowGraph });
      const securityBoundary = buildSecurityBoundarySnapshot({
        project,
        messages: store.getMessages(projectId),
        managerDashboard,
        mvpReadiness,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        securityAuditStreamRecords: listSecurityAuditStreamRecords(projectId),
      });
      return buildProviderReadinessSnapshot({
        project,
        managerDashboard,
        mvpReadiness,
        securityBoundary,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        providerControlPolicy: providerControlPolicyStatus(),
      });
      });
    },
    getSecurityAccessAudit(projectId) {
      const project = store.getProject(projectId);
      const summary = summarizeSecurityAccessAudit(project.securityAccessAudit || []);
      const streamSummary = summarizeSecurityAuditStream(listSecurityAuditStreamRecords(projectId));
      return {
        projectId,
        generatedAt: nowIso(),
        schemaVersion: 'security-access-audit/v1',
        status: summary.count ? 'active' : 'waiting-for-enforced-traffic',
        ...summary,
        stream: {
          count: streamSummary.count,
          deniedCount: streamSummary.deniedCount,
          firstSequence: streamSummary.firstSequence,
          lastSequence: streamSummary.lastSequence,
          sequenceGapCount: streamSummary.sequenceGapCount,
          hashChainReady: streamSummary.hashChainReady,
          missingHashCount: streamSummary.missingHashCount,
          chainBreakCount: streamSummary.chainBreakCount,
          hashMismatchCount: streamSummary.hashMismatchCount,
          latestStreamHash: streamSummary.latestStreamHash,
          apiPath: `/projects/${projectId}/security-audit-stream`,
          storage: streamSummary.count ? 'prototype-store-backed' : 'waiting-for-enforced-traffic',
        },
        eventIds: (project.eventLedger || [])
          .filter((event) => event.type === 'security-access')
          .map((event) => event.id)
          .filter(Boolean)
          .slice(-40),
        backendRoutes: {
          securityBoundary: `/projects/${projectId}/security-boundary`,
          identitySessions: `/projects/${projectId}/identity-sessions`,
          eventLedger: `/projects/${projectId}/events`,
        },
      };
    },
    getSecurityAuditStream(projectId) {
      const rows = listSecurityAuditStreamRecords(projectId);
      const summary = summarizeSecurityAuditStream(rows);
      return {
        projectId,
        generatedAt: nowIso(),
        schemaVersion: 'security-audit-stream/v1',
        status: summary.count ? 'prototype-store-backed' : 'waiting-for-enforced-traffic',
        storage: {
          type: store.securityAuditLogPath ? 'file-store-append-log' : store.filePath ? 'file-store-snapshot' : 'memory-store',
          filePath: store.filePath || null,
          auditLogPath: store.securityAuditLogPath || null,
          appendOnlyGuarantee: store.securityAuditLogPath
            ? 'prototype append-only JSONL audit sink with deduplicated record ids, snapshot mirror, and per-project hash-chain verification'
            : 'prototype append-order stream with deduplicated record ids and per-project hash-chain verification',
          productionRequirement: 'replace with immutable centralized audit log before production launch',
          migrationTable: 'security_audit_stream',
          hashChain: {
            algorithm: 'stable-json-checksum-chain',
            genesisHash: SECURITY_AUDIT_STREAM_GENESIS_HASH,
            ready: summary.hashChainReady,
            latestStreamHash: summary.latestStreamHash,
          },
        },
        ...summary,
        backendRoutes: {
          securityAccessAudit: `/projects/${projectId}/security-access-audit`,
          securityBoundary: `/projects/${projectId}/security-boundary`,
          identitySessions: `/projects/${projectId}/identity-sessions`,
          persistenceSnapshot: `/projects/${projectId}/persistence-snapshot`,
        },
      };
    },
    getWorkerQueueAdapterPlan(projectId, options = {}) {
      return cachedReadModel('worker-queue-adapter-plan', projectId, options, () => {
      const project = store.getProject(projectId);
      const workerQueueSnapshot = buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        projectId,
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: project.team?.length || Infinity,
        maxProjects: 1,
        ...options,
      });
      return buildWorkerQueueAdapterPlan({
        workerQueueSnapshot,
        projectId,
      });
      });
    },
    getWorkerQueueAdapterDryRun(projectId, options = {}) {
      return cachedReadModel('worker-queue-adapter-dry-run', projectId, options, () => {
      const project = store.getProject(projectId);
      const workerQueueSnapshot = buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        projectId,
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: project.team?.length || Infinity,
        maxProjects: 1,
        ...options,
      });
      const adapterPlan = buildWorkerQueueAdapterPlan({
        workerQueueSnapshot,
        projectId,
      });
      return buildWorkerQueueAdapterDryRunVerification({
        workerQueueSnapshot,
        adapterPlan,
        projectId,
      });
      });
    },
    async getWorkerQueueAdapterDryRunAsync(projectId, options = {}) {
      const adapterStatus = workerQueueAdapterStatus();
      if (adapterStatus.driver !== 'http-json' || !adapterStatus.httpEndpointConfigured) {
        return this.getWorkerQueueAdapterDryRun(projectId, options);
      }
      const project = store.getProject(projectId);
      const workerQueueSnapshot = buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        projectId,
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: project.team?.length || Infinity,
        maxProjects: 1,
        ...options,
      });
      const adapterPlan = buildWorkerQueueAdapterPlan({
        workerQueueSnapshot,
        projectId,
      });
      return buildWorkerQueueAdapterGatewayDryRunVerification({
        workerQueueSnapshot,
        adapterPlan,
        projectId,
      });
    },
    getOperationsReadiness(projectId, options = {}) {
      return cachedReadModel('operations-readiness', projectId, options, () => {
      const language = options.language || store.getProject(projectId)?.language || 'en';
      const project = store.getProject(projectId);
      const managerDashboard = this.getManagerDashboard(projectId, { language });
      const managerFlowGraph = this.getManagerFlowGraph(projectId, { language });
      const mvpReadiness = buildMvpReadiness({ managerDashboard, managerFlowGraph });
      const securityAuditStreamRecords = listSecurityAuditStreamRecords(projectId);
      const securityBoundary = buildSecurityBoundarySnapshot({
        project,
        messages: store.getMessages(projectId),
        managerDashboard,
        mvpReadiness,
        modelProviderStatus: modelProviderStatus(),
        searchProviderStatus: searchProviderStatus(),
        secretVaultStatus: secretVaultStatus(),
        securityAuditStreamRecords,
      });
      const persistenceSnapshot = this.getPersistenceSnapshot(projectId, { language });
      const migrationPlan = buildManagedPersistenceMigrationPlan({
        persistenceSnapshot,
        projectId,
      });
      const migrationDryRun = buildManagedPersistenceDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        projectId,
      });
      const persistenceAdapterPlan = buildManagedPersistenceAdapterPlan({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        projectId,
      });
      const persistenceAdapterDryRun = buildManagedPersistenceAdapterDryRunVerification({
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        adapterPlan: persistenceAdapterPlan,
        projectId,
      });
      const workerQueueSnapshot = buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        projectId,
        forceDue: true,
        forceProjectIds: [projectId],
        maxAgentsPerProject: project.team?.length || Infinity,
        maxProjects: 1,
      });
      const workerQueueAdapterPlan = buildWorkerQueueAdapterPlan({
        workerQueueSnapshot,
        projectId,
      });
      const workerQueueAdapterDryRun = buildWorkerQueueAdapterDryRunVerification({
        workerQueueSnapshot,
        adapterPlan: workerQueueAdapterPlan,
        projectId,
      });
      return buildOperationsReadinessSnapshot({
        project,
        managerDashboard,
        mvpReadiness,
        securityBoundary,
        persistenceSnapshot,
        migrationPlan,
        migrationDryRun,
        persistenceAdapterPlan,
        persistenceAdapterDryRun,
        workerQueueSnapshot,
        workerQueueAdapterPlan,
        workerQueueAdapterDryRun,
        securityAuditStreamRecords,
      });
      });
    },
    getWorkerQueueSnapshot(input = {}) {
      return buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        ...input,
      });
    },
    getProjectWorkerQueue(projectId, input = {}) {
      return cachedReadModel('project-worker-queue', projectId, input, () => buildWorkerQueueSnapshot({
        projects: store.listProjects(),
        ...input,
        projectId,
      }));
    },
    getAgentDashboard(projectId, agentId) {
      return buildAgentDashboardSnapshot({
        project: store.getProject(projectId),
        messages: store.getMessages(projectId),
        agentId,
      });
    },
    listSubmissions(projectId) {
      return (store.getProject(projectId).agentSubmissions || []).map((submission) => ({
        ...submission,
        projectId,
      }));
    },
    getSubmission(projectId, submissionId) {
      const submission = (store.getProject(projectId).agentSubmissions || [])
        .find((item) => String(item.id) === String(submissionId));
      if (!submission) throw new Error(`Submission not found: ${submissionId}`);
      return {
        ...submission,
        projectId,
      };
    },
    listEvidenceSearches(projectId) {
      return (store.getProject(projectId).evidenceSearches || []).map((record) => ({
        ...record,
        projectId,
      }));
    },
    getEvidenceSearch(projectId, evidenceSearchId) {
      const record = (store.getProject(projectId).evidenceSearches || [])
        .find((item) => String(item.id) === String(evidenceSearchId));
      if (!record) throw new Error(`Evidence search not found: ${evidenceSearchId}`);
      return {
        ...record,
        projectId,
      };
    },
    listSubmissionReviews(projectId) {
      return (store.getProject(projectId).submissionReviews || []).map((review) => ({
        ...review,
        projectId,
      }));
    },
    getSubmissionReview(projectId, reviewId) {
      const review = (store.getProject(projectId).submissionReviews || [])
        .find((item) => String(item.id) === String(reviewId));
      if (!review) throw new Error(`Submission review not found: ${reviewId}`);
      return {
        ...review,
        projectId,
      };
    },
    submitAgentArtifact({ projectId, agentId, ...input } = {}) {
      return persistResult(submitAgentArtifact({
        project: store.getProject(projectId),
        agentId,
        artifactWriter: artifactWriter || (projectRuntime?.writeArtifact ? projectRuntime.writeArtifact.bind(projectRuntime) : null),
        ...input,
      }));
    },
    recordAgentEvidenceSearch({ projectId, agentId, ...input } = {}) {
      return persistResult(recordAgentEvidenceSearch({
        project: store.getProject(projectId),
        agentId,
        ...input,
      }));
    },
    async recordAgentEvidenceSearchWithProvider({ projectId, agentId, ...input } = {}) {
      if (typeof searchProvider?.search !== 'function') {
        throw new Error('search-provider-not-configured');
      }
      const project = store.getProject(projectId);
      const now = input.now || nowIso();
      const status = searchProviderStatus();
      const providerPolicyStatus = providerControlPolicyStatus();
      const policyDecision = evaluateProviderPolicy({
        project,
        policy: providerPolicyStatus,
        kind: 'search',
        operation: input.operation || 'search:evidence',
        providerStatus: status,
        agentId,
        estimatedCostCents: input.estimatedCostCents,
        now,
      });
      if (!policyDecision.allowed) {
        appendProviderUsageRecord({
          project,
          kind: 'search',
          operation: input.operation || 'search:evidence',
          providerStatus: status,
          agentId,
          decision: policyDecision,
          ok: false,
          status: 'denied',
          reason: policyDecision.reason,
          request: input,
          estimatedCostCents: input.estimatedCostCents,
          startedAt: now,
          completedAt: now,
        });
        throw new Error(`provider-policy-denied:${policyDecision.reason}`);
      }

      const circuitDecision = evaluateProviderCircuitBreaker({
        project,
        policy: providerPolicyStatus,
        kind: 'search',
        providerStatus: status,
        now,
      });
      if (!circuitDecision.allowed) {
        appendProviderUsageRecord({
          project,
          kind: 'search',
          operation: input.operation || 'search:evidence',
          providerStatus: status,
          agentId,
          decision: {
            ...policyDecision,
            allowed: false,
            wouldDeny: true,
            reason: circuitDecision.reason,
            reasons: uniqueStrings([...(policyDecision.reasons || []), circuitDecision.reason]),
          },
          ok: false,
          status: 'circuit-open',
          reason: circuitDecision.reason,
          request: input,
          circuitBreaker: circuitDecision.row,
          estimatedCostCents: input.estimatedCostCents,
          startedAt: now,
          completedAt: now,
        });
        throw new Error(`provider-policy-denied:${circuitDecision.reason}`);
      }

      const providerAttempt = await runProviderWithRetry({
        policy: providerPolicyStatus,
        now,
        run: () => searchProvider.search({
          query: input.query,
          purpose: input.purpose,
          now,
          maxResults: input.maxResults,
          extraBody: input.providerBody || {},
        }),
      });
      const providerResult = {
        ...(providerAttempt.result || {}),
        retry: providerAttempt.retry,
      };
      if (!providerResult.ok) {
        const reason = providerResult.reason || providerResult.error || 'unknown';
        appendProviderUsageRecord({
          project,
          kind: 'search',
          operation: input.operation || 'search:evidence',
          providerStatus: status,
          agentId,
          decision: policyDecision,
          result: providerResult,
          ok: false,
          status: 'failed',
          reason,
          request: input,
          retry: providerAttempt.retry,
          circuitBreaker: circuitDecision.row,
          estimatedCostCents: input.estimatedCostCents,
          startedAt: now,
          completedAt: nowIso(),
        });
        throw new Error(`search-provider-unavailable:${reason}`);
      }
      const result = persistResult(recordAgentEvidenceSearch({
        project,
        agentId,
        ...input,
        provider: providerResult.provider || input.provider || 'search-provider',
        searchMode: providerResult.searchMode || input.searchMode || 'provider-search',
        sources: providerResult.sources || input.sources || [],
        findings: [
          ...(providerResult.findings || []),
          ...(input.findings || []),
        ],
        confidence: providerResult.confidence || input.confidence || 'medium',
      }));
      const usage = appendProviderUsageRecord({
        project: result.project,
        kind: 'search',
        operation: input.operation || 'search:evidence',
        providerStatus: status,
        agentId,
        decision: policyDecision,
        result: providerResult,
        ok: true,
        status: 'completed',
        request: input,
        retry: providerAttempt.retry,
        circuitBreaker: circuitDecision.row,
        estimatedCostCents: input.estimatedCostCents,
        evidenceIds: [
          result.evidenceSearch?.id,
          result.log?.id,
          result.evidenceSearch?.eventId,
          result.task?.id,
        ].filter(Boolean),
        startedAt: now,
        completedAt: nowIso(),
      });
      return {
        ...result,
        project: usage.project,
        providerUsage: usage.record,
      };
    },
    reviewAgentSubmission({ projectId, submissionId, ...input } = {}) {
      return persistResult(reviewAgentSubmission({
        project: store.getProject(projectId),
        submissionId,
        ...input,
      }));
    },
    getProjectMembershipPolicy(projectId) {
      const project = store.getProject(projectId);
      const policy = project.projectMembershipPolicy || null;
      return policy
        ? {
          projectMembershipPolicy: policy,
          projectMembershipSummary: summarizeProjectMembershipPolicy(policy),
          projectMembershipAudit: project.projectMembershipAudit || [],
        }
        : {
          projectMembershipPolicy: null,
          projectMembershipSummary: summarizeProjectMembershipPolicy(null),
          projectMembershipAudit: project.projectMembershipAudit || [],
        };
    },
    setProjectMembershipPolicy({ projectId, policy = {}, updatedBy = '', source = '', now = nowIso() } = {}) {
      const result = updateProjectMembershipPolicy(store.getProject(projectId), {
        policy,
        updatedBy,
        source,
        now,
      });
      const savedProject = saveProject(result.project);
      return {
        ...result,
        project: savedProject,
        projectMembershipPolicy: savedProject.projectMembershipPolicy,
        projectMembershipSummary: summarizeProjectMembershipPolicy(savedProject.projectMembershipPolicy),
        projectMembershipAudit: savedProject.projectMembershipAudit || [],
      };
    },
    getIdentitySessions(projectId, { includeRevoked = true, now = nowIso() } = {}) {
      const project = store.getProject(projectId);
      const rows = (project.identitySessions || [])
        .map((session) => publicIdentitySession(session, now))
        .filter((session) => includeRevoked || session.status !== 'revoked');
      return {
        projectId,
        schemaVersion: 'identity-session-list/v1',
        rows,
        summary: summarizeIdentitySessions(project, now),
        backendRoutes: {
          identitySessions: `/projects/${projectId}/identity-sessions`,
          membershipPolicy: `/projects/${projectId}/membership-policy`,
          securityBoundary: `/projects/${projectId}/security-boundary`,
        },
      };
    },
    issueIdentitySession({
      projectId,
      role = 'observer',
      userId = '',
      agentId = '',
      issuerRole = 'manager',
      issuerId = '',
      ttlMs,
      expiresAt,
      scope = ['project'],
      source = 'identity-session-api',
      now = nowIso(),
    } = {}) {
      const project = store.getProject(projectId);
      const { session, token } = buildIdentitySessionRecord(project, {
        role,
        userId,
        agentId,
        issuerRole,
        issuerId,
        ttlMs,
        expiresAt,
        scope,
        source,
      }, { now });
      const log = {
        id: `log_${session.id}`,
        time: now,
        agent: 'Identity Boundary',
        actor: 'Identity Boundary',
        eventType: 'identity-session-issued',
        source: 'identity-session',
        channelId: 'security',
        identitySessionId: session.id,
        log: `Identity session issued for ${session.role}:${session.userId || session.agentId || 'unknown'} on ${project.name || project.id}.`,
        evidence: [`Session checksum ${session.checksum}`],
      };
      const updatedProject = appendProjectEvents({
        ...project,
        identitySessions: [
          session,
          ...(project.identitySessions || []),
        ].slice(0, IDENTITY_SESSION_LIMIT),
        logs: [log, ...(project.logs || [])],
      }, [
        createProjectLedgerEvent({
          id: `evt_${session.id}`,
          type: 'identity-session-issued',
          time: now,
          actor: `Identity Boundary:${session.issuerId || session.issuerRole}`,
          summary: log.log,
          source: 'identity-session',
          channelId: 'security',
          evidenceIds: [session.id, session.checksum, log.id].filter(Boolean),
          entityIds: {
            projectId,
            identitySessionId: session.id,
            role: session.role,
            userId: session.userId || null,
            agentId: session.agentId || null,
          },
          payload: {
            schemaVersion: session.schemaVersion,
            role: session.role,
            userId: session.userId,
            agentId: session.agentId,
            expiresAt: session.expiresAt,
            checksum: session.checksum,
          },
        }),
      ]);
      const savedProject = saveProject(updatedProject);
      return {
        project: savedProject,
        identitySession: publicIdentitySession(session, now),
        token,
        tokenContract: {
          schemaVersion: 'identity-session-token/v1',
          returnedOnce: true,
          storage: 'token-hash-only',
          header: 'x-hofs-session-token',
        },
        identitySessions: this.getIdentitySessions(projectId, { now }),
        log,
      };
    },
    verifyIdentitySession({ projectId, token = '', now = nowIso() } = {}) {
      const project = store.getProject(projectId);
      const tokenHash = identitySessionTokenHash(token);
      const session = (project.identitySessions || []).find((item) => item.tokenHash === tokenHash) || null;
      if (!session) {
        return {
          verified: false,
          reason: 'identity-session-not-found',
          projectId,
          schemaVersion: 'identity-session-verification/v1',
        };
      }
      const status = identitySessionStatus(session, now);
      if (status !== 'active') {
        return {
          verified: false,
          reason: `identity-session-${status}`,
          projectId,
          schemaVersion: 'identity-session-verification/v1',
          identitySession: publicIdentitySession(session, now),
        };
      }
      return {
        verified: true,
        reason: 'identity-session-active',
        projectId,
        schemaVersion: 'identity-session-verification/v1',
        identitySession: publicIdentitySession(session, now),
        actor: {
          role: session.role,
          userId: session.userId || '',
          agentId: session.agentId || '',
        },
      };
    },
    revokeIdentitySession({ projectId, sessionId = '', revokedBy = '', reason = '', now = nowIso() } = {}) {
      const project = store.getProject(projectId);
      const sessions = project.identitySessions || [];
      const existing = sessions.find((session) => session.id === sessionId);
      if (!existing) throw new Error(`Identity session not found: ${sessionId}`);
      const revokedSession = {
        ...existing,
        status: 'revoked',
        revokedAt: now,
        revokedBy: revokedBy || 'security-boundary',
        revocationReason: compactPreview(reason || 'session revoked'),
      };
      revokedSession.checksum = persistenceChecksum({
        id: revokedSession.id,
        projectId,
        role: revokedSession.role,
        userId: revokedSession.userId,
        agentId: revokedSession.agentId,
        issuedAt: revokedSession.issuedAt,
        expiresAt: revokedSession.expiresAt,
        revokedAt: revokedSession.revokedAt,
        status: revokedSession.status,
      });
      const log = {
        id: `log_revoke_${sessionId}_${Date.parse(now) || Date.now()}`,
        time: now,
        agent: 'Identity Boundary',
        actor: 'Identity Boundary',
        eventType: 'identity-session-revoked',
        source: 'identity-session',
        channelId: 'security',
        identitySessionId: sessionId,
        log: `Identity session ${sessionId} was revoked for ${revokedSession.role}:${revokedSession.userId || revokedSession.agentId || 'unknown'}.`,
        evidence: [`Session checksum ${revokedSession.checksum}`],
      };
      const updatedProject = appendProjectEvents({
        ...project,
        identitySessions: sessions.map((session) => (session.id === sessionId ? revokedSession : session)),
        logs: [log, ...(project.logs || [])],
      }, [
        createProjectLedgerEvent({
          id: `evt_revoke_${sessionId}_${Date.parse(now) || Date.now()}`,
          type: 'identity-session-revoked',
          time: now,
          actor: `Identity Boundary:${revokedBy || 'security-boundary'}`,
          summary: log.log,
          source: 'identity-session',
          channelId: 'security',
          evidenceIds: [sessionId, revokedSession.checksum, log.id].filter(Boolean),
          entityIds: {
            projectId,
            identitySessionId: sessionId,
            role: revokedSession.role,
            userId: revokedSession.userId || null,
            agentId: revokedSession.agentId || null,
          },
          payload: {
            schemaVersion: revokedSession.schemaVersion,
            status: revokedSession.status,
            revokedAt: revokedSession.revokedAt,
            checksum: revokedSession.checksum,
          },
        }),
      ]);
      const savedProject = saveProject(updatedProject);
      return {
        project: savedProject,
        identitySession: publicIdentitySession(revokedSession, now),
        identitySessions: this.getIdentitySessions(projectId, { now }),
        log,
      };
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
    recordAccessDecision({ projectId, decision = {}, method = 'GET', path = '/', statusCode = null, outcome = '', now = nowIso() } = {}) {
      if (!projectId) return null;
      const project = store.getProject(projectId);
      const auditRecord = buildSecurityAccessAuditRecord({
        projectId,
        decision,
        method,
        path,
        statusCode,
        outcome,
        now,
      });
      const existingStreamRecords = listSecurityAuditStreamRecords(projectId);
      const streamSequence = existingStreamRecords.reduce((max, record) => {
        const sequence = Number(record.streamSequence);
        return Number.isFinite(sequence) && sequence > max ? sequence : max;
      }, 0) + 1;
      const previousStreamRecord = existingStreamRecords
        .slice()
        .sort((a, b) => Number(b.streamSequence || 0) - Number(a.streamSequence || 0))[0] || null;
      const streamRecord = buildSecurityAuditStreamRecord(auditRecord, {
        sequence: streamSequence,
        previousStreamHash: previousStreamRecord?.streamHash || SECURITY_AUDIT_STREAM_GENESIS_HASH,
      });
      const updatedProject = appendProjectEvents({
        ...project,
        securityAccessAudit: [
          {
            ...auditRecord,
            streamRecordId: streamRecord.streamRecordId,
            streamSequence: streamRecord.streamSequence,
            streamChecksum: streamRecord.streamChecksum,
            previousStreamHash: streamRecord.previousStreamHash,
            streamHash: streamRecord.streamHash,
          },
          ...(project.securityAccessAudit || []),
        ].slice(0, SECURITY_ACCESS_AUDIT_LIMIT),
      }, [
        createProjectLedgerEvent({
          id: `evt_${auditRecord.id}`,
          type: 'security-access',
          time: auditRecord.time,
          actor: `Access Control:${auditRecord.actor.role}`,
          summary: `${auditRecord.allowed ? 'Allowed' : 'Denied'} ${auditRecord.actor.role} ${auditRecord.method} ${auditRecord.routeKey}.`,
          source: 'access-control',
          channelId: 'security',
          evidenceIds: [auditRecord.id],
          entityIds: {
            projectId,
            accessAuditId: auditRecord.id,
            routeKey: auditRecord.routeKey,
            agentId: auditRecord.actor.agentId || auditRecord.route.agentId || null,
          },
          payload: {
            status: auditRecord.status,
            allowed: auditRecord.allowed,
            enforced: auditRecord.enforced,
            mode: auditRecord.mode,
            method: auditRecord.method,
            path: auditRecord.path,
            sensitivity: auditRecord.sensitivity,
            reason: auditRecord.reason,
            outcome: auditRecord.outcome,
            streamRecordId: streamRecord.streamRecordId,
            streamSequence: streamRecord.streamSequence,
            streamChecksum: streamRecord.streamChecksum,
            previousStreamHash: streamRecord.previousStreamHash,
            streamHash: streamRecord.streamHash,
            identitySession: auditRecord.identitySession || null,
          },
        }),
      ]);
      saveProject(updatedProject);
      if (typeof store.appendSecurityAuditRecords === 'function') {
        store.appendSecurityAuditRecords([streamRecord]);
      }
      return streamRecord;
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
      return saveProject(project);
    },
    getLocalRuntime(projectId) {
      const project = store.getProject(projectId);
      const attached = attachLocalRuntime(project);
      if (attached !== project) saveProject(attached);
      return {
        projectId,
        localRuntime: attached.localRuntime || null,
      };
    },
    bindProjectWorkspace({ projectId, workspacePath, createIfMissing = false, now = nowIso() } = {}) {
      if (!projectRuntime?.bindWorkspace) throw new Error('Local project runtime is not configured.');
      const project = projectRuntime.bindWorkspace(store.getProject(projectId), workspacePath, { createIfMissing, now });
      return {
        project: saveProject(project),
        localRuntime: project.localRuntime,
      };
    },
    listWorkspaceFiles({ projectId, ...input } = {}) {
      if (!projectRuntime?.listWorkspace) throw new Error('Local project runtime is not configured.');
      return projectRuntime.listWorkspace(store.getProject(projectId), input);
    },
    readWorkspaceFile({ projectId, ...input } = {}) {
      if (!projectRuntime?.readWorkspaceFile) throw new Error('Local project runtime is not configured.');
      return projectRuntime.readWorkspaceFile(store.getProject(projectId), input);
    },
    writeWorkspaceFile({ projectId, ...input } = {}) {
      if (!projectRuntime?.writeWorkspaceFile) throw new Error('Local project runtime is not configured.');
      return projectRuntime.writeWorkspaceFile(store.getProject(projectId), input);
    },
    deleteWorkspacePath({ projectId, ...input } = {}) {
      if (!projectRuntime?.deleteWorkspacePath) throw new Error('Local project runtime is not configured.');
      return projectRuntime.deleteWorkspacePath(store.getProject(projectId), input);
    },
    executeWorkspaceCommand({ projectId, ...input } = {}) {
      if (!projectRuntime?.executeWorkspaceCommand) throw new Error('Local project runtime is not configured.');
      return projectRuntime.executeWorkspaceCommand(store.getProject(projectId), input);
    },
    archiveProject({ projectId, reason, now = nowIso() } = {}) {
      if (!projectRuntime?.archiveProject) throw new Error('Local project runtime is not configured.');
      const project = projectRuntime.archiveProject(store.getProject(projectId), { reason, now });
      return {
        project: saveProject(project),
        localRuntime: project.localRuntime,
      };
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
        artifactWriter: artifactWriter || (projectRuntime?.writeArtifact ? projectRuntime.writeArtifact.bind(projectRuntime) : null),
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
        item.result.project = saveProject(item.result.project);
      });
      if (summary.messages.length) {
        appendMessages(summary.messages);
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
        saveProject(project);
      });
      if (summary.messages.length) {
        appendMessages(summary.messages);
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
