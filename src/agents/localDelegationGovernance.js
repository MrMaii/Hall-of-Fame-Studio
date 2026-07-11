import { createHash } from 'node:crypto';

const COMPLETED_STATUSES = new Set(['done', 'completed', 'accepted']);
const NOTIFICATION_TYPES = new Set(['task-overdue', 'dependency-blocked', 'owner-changed']);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localDelegationChecksum(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function identifier(value, field, { optional = false } = {}) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) {
    throw new Error(`delegation-${field}-invalid`);
  }
  return normalized;
}

function isoTimestamp(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const normalized = String(value || '').trim();
  if (!normalized || !Number.isFinite(Date.parse(normalized))) throw new Error(`delegation-${field}-invalid`);
  return new Date(normalized).toISOString();
}

function uniqueIdentifiers(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => identifier(value, 'dependency-id')))].sort();
}

function completed(task = {}) {
  return COMPLETED_STATUSES.has(String(task.status || '').trim().toLowerCase());
}

function graphFromTasks(tasks = []) {
  const taskIds = tasks.map((task) => task.taskId);
  const known = new Set(taskIds);
  const unknownTaskIds = [...new Set(tasks.flatMap((task) => task.dependencyIds).filter((id) => !known.has(id)))].sort();
  const selfDependencyTaskIds = tasks.filter((task) => task.dependencyIds.includes(task.taskId)).map((task) => task.taskId).sort();
  const edges = tasks.flatMap((task) => task.dependencyIds
    .filter((dependencyId) => known.has(dependencyId) && dependencyId !== task.taskId)
    .map((dependencyId) => ({ fromTaskId: dependencyId, toTaskId: task.taskId })));
  const incoming = new Map(taskIds.map((id) => [id, 0]));
  const outgoing = new Map(taskIds.map((id) => [id, []]));
  for (const edge of edges) {
    incoming.set(edge.toTaskId, (incoming.get(edge.toTaskId) || 0) + 1);
    outgoing.get(edge.fromTaskId).push(edge.toTaskId);
  }
  const layers = [];
  let ready = taskIds.filter((id) => incoming.get(id) === 0).sort();
  const visited = new Set();
  while (ready.length) {
    const layer = ready;
    layers.push(layer);
    ready = [];
    for (const id of layer) {
      visited.add(id);
      for (const nextId of outgoing.get(id) || []) {
        incoming.set(nextId, incoming.get(nextId) - 1);
        if (incoming.get(nextId) === 0) ready.push(nextId);
      }
    }
    ready.sort();
  }
  const cycleTaskIds = taskIds.filter((id) => !visited.has(id)).sort();
  return {
    taskIds: [...taskIds].sort(),
    edges,
    layers,
    acyclic: cycleTaskIds.length === 0 && selfDependencyTaskIds.length === 0,
    unknownTaskIds,
    selfDependencyTaskIds,
    cycleTaskIds,
  };
}

export function verifyLocalTaskDelegationChange(receipt = {}) {
  const { checksum, ...base } = receipt;
  const checksumValid = Boolean(checksum) && checksum === localDelegationChecksum(base);
  const schemaValid = receipt.schemaVersion === 'local-task-delegation-change/v1';
  const assignmentValid = Boolean(receipt.taskId && receipt.toAssignee && receipt.toReviewerId)
    && receipt.toAssignee !== receipt.toReviewerId;
  return { valid: checksumValid && schemaValid && assignmentValid, checksumValid, schemaValid, assignmentValid };
}

export function createLocalTaskDelegationChange({
  projectId,
  taskId,
  fromAssignee = null,
  toAssignee,
  fromReviewerId = null,
  toReviewerId,
  fromDueAt = null,
  toDueAt = null,
  actorId,
  idempotencyKey,
  reasonCode = 'manager-reassignment',
  now = new Date().toISOString(),
} = {}) {
  const createdAt = isoTimestamp(now, 'created-at');
  const normalized = {
    projectId: identifier(projectId, 'project-id'),
    taskId: identifier(taskId, 'task-id'),
    fromAssignee: identifier(fromAssignee, 'from-assignee', { optional: true }),
    toAssignee: identifier(toAssignee, 'to-assignee'),
    fromReviewerId: identifier(fromReviewerId, 'from-reviewer-id', { optional: true }),
    toReviewerId: identifier(toReviewerId, 'to-reviewer-id'),
    fromDueAt: isoTimestamp(fromDueAt, 'from-due-at', { optional: true }),
    toDueAt: isoTimestamp(toDueAt, 'to-due-at', { optional: true }),
    actorId: identifier(actorId, 'actor-id'),
    idempotencyKey: identifier(idempotencyKey, 'idempotency-key'),
    reasonCode: identifier(reasonCode, 'reason-code'),
  };
  if (normalized.toAssignee === normalized.toReviewerId) throw new Error('delegation-reviewer-independence-required');
  const base = {
    schemaVersion: 'local-task-delegation-change/v1',
    id: `task_delegation_${localDelegationChecksum(`${normalized.projectId}:${normalized.taskId}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    storesRawContent: false,
    createdAt,
  };
  return { ...base, checksum: localDelegationChecksum(base) };
}

export function verifyLocalDelegationNotification(receipt = {}) {
  const { checksum, ...base } = receipt;
  const checksumValid = Boolean(checksum) && checksum === localDelegationChecksum(base);
  const schemaValid = receipt.schemaVersion === 'local-delegation-notification/v1';
  const typeValid = NOTIFICATION_TYPES.has(receipt.type);
  return { valid: checksumValid && schemaValid && typeValid, checksumValid, schemaValid, typeValid };
}

export function createLocalDelegationNotification({
  projectId,
  taskId,
  type,
  assignee,
  reviewerId,
  dueAt = null,
  blockedByTaskIds = [],
  delegationChangeId = null,
  now = new Date().toISOString(),
} = {}) {
  const normalizedType = String(type || '').trim();
  if (!NOTIFICATION_TYPES.has(normalizedType)) throw new Error('delegation-notification-type-invalid');
  const state = {
    projectId: identifier(projectId, 'project-id'),
    taskId: identifier(taskId, 'task-id'),
    type: normalizedType,
    assignee: identifier(assignee, 'assignee'),
    reviewerId: identifier(reviewerId, 'reviewer-id'),
    dueAt: isoTimestamp(dueAt, 'due-at', { optional: true }),
    blockedByTaskIds: uniqueIdentifiers(blockedByTaskIds),
    delegationChangeId: identifier(delegationChangeId, 'change-id', { optional: true }),
  };
  const fingerprint = localDelegationChecksum(state);
  const base = {
    schemaVersion: 'local-delegation-notification/v1',
    id: `delegation_notice_${fingerprint.slice(0, 28)}`,
    fingerprint,
    ...state,
    delivery: 'local-project-feed',
    storesRawContent: false,
    createdAt: isoTimestamp(now, 'created-at'),
  };
  return { ...base, checksum: localDelegationChecksum(base) };
}

export function buildLocalDelegationGovernance({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = isoTimestamp(now, 'generated-at');
  const teamIds = new Set((project.team || []).map((member) => String(member?.id || '').trim()).filter(Boolean));
  const normalizedTasks = (project.tasks || []).map((task) => ({
    taskId: identifier(task.id, 'task-id'),
    assignee: identifier(task.assignee || task.ownerId, 'assignee', { optional: true }),
    reviewerId: identifier(task.reviewerId, 'reviewer-id', { optional: true }),
    dueAt: isoTimestamp(task.dueAt, 'due-at', { optional: true }),
    dependencyIds: uniqueIdentifiers(task.dependsOn),
    completed: completed(task),
  }));
  const taskById = new Map(normalizedTasks.map((task) => [task.taskId, task]));
  const graph = graphFromTasks(normalizedTasks);
  const rows = normalizedTasks.map((task) => {
    const blockedByTaskIds = task.dependencyIds.filter((id) => taskById.has(id) && !taskById.get(id).completed);
    const blocked = !task.completed && blockedByTaskIds.length > 0;
    const overdue = !task.completed && Boolean(task.dueAt) && Date.parse(task.dueAt) < Date.parse(generatedAt);
    const ownerKnown = Boolean(task.assignee) && teamIds.has(task.assignee);
    const reviewerKnown = Boolean(task.reviewerId) && teamIds.has(task.reviewerId);
    const reviewerIndependent = Boolean(task.assignee && task.reviewerId && task.assignee !== task.reviewerId);
    const state = task.completed
      ? 'completed'
      : blocked && overdue
        ? 'overdue-blocked'
        : blocked
          ? 'blocked'
          : overdue
            ? 'overdue'
            : task.dueAt && Date.parse(task.dueAt) > Date.parse(generatedAt)
              ? 'ready'
              : 'ready';
    return {
      taskId: task.taskId,
      assignee: task.assignee,
      reviewerId: task.reviewerId,
      dueAt: task.dueAt,
      dependencyIds: task.dependencyIds,
      blockedByTaskIds,
      completed: task.completed,
      blocked,
      overdue,
      ownerKnown,
      reviewerKnown,
      reviewerIndependent,
      state,
    };
  });
  const changeIntegrityRows = (project.localTaskDelegationChanges || []).map((receipt) => ({ id: receipt.id, ...verifyLocalTaskDelegationChange(receipt) }));
  const notificationIntegrityRows = (project.localTaskDelegationNotifications || []).map((receipt) => ({ id: receipt.id, ...verifyLocalDelegationNotification(receipt) }));
  const assignmentInvalidTaskIds = rows.filter((row) => !row.ownerKnown || !row.reviewerKnown || !row.reviewerIndependent).map((row) => row.taskId);
  const integrityValid = graph.acyclic
    && graph.unknownTaskIds.length === 0
    && assignmentInvalidTaskIds.length === 0
    && changeIntegrityRows.every((row) => row.valid)
    && notificationIntegrityRows.every((row) => row.valid);
  return {
    schemaVersion: 'local-delegation-governance/v1',
    projectId: identifier(project.id, 'project-id'),
    generatedAt,
    status: !integrityValid
      ? 'degraded-integrity-invalid'
      : rows.some((row) => row.blocked || row.overdue)
        ? 'attention-required'
        : 'delegation-ready',
    graph,
    rows,
    summary: {
      taskCount: rows.length,
      completedCount: rows.filter((row) => row.completed).length,
      readyCount: rows.filter((row) => row.state === 'ready').length,
      overdueCount: rows.filter((row) => row.overdue).length,
      blockedCount: rows.filter((row) => row.blocked).length,
      assignmentInvalidCount: assignmentInvalidTaskIds.length,
      changeCount: (project.localTaskDelegationChanges || []).length,
      notificationCount: (project.localTaskDelegationNotifications || []).length,
    },
    changes: (project.localTaskDelegationChanges || []).map((receipt) => ({ ...receipt, integrity: verifyLocalTaskDelegationChange(receipt) })),
    notifications: (project.localTaskDelegationNotifications || []).map((receipt) => ({ ...receipt, integrity: verifyLocalDelegationNotification(receipt) })),
    integrity: {
      valid: integrityValid,
      assignmentInvalidTaskIds,
      changeRows: changeIntegrityRows,
      notificationRows: notificationIntegrityRows,
    },
    backendRoutes: {
      governance: `/projects/${project.id}/delegation-governance`,
      scan: `/projects/${project.id}/delegation-governance/scan`,
      taskDelegation: `/projects/${project.id}/tasks/:taskId/delegation`,
    },
  };
}
