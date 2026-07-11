import { portableSha256Hex } from './accessControl.js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function checksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`learning-program-${field}-invalid`);
  return text;
}

function boundedInteger(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`learning-program-${field}-invalid`);
  return number;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`learning-program-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function date(value, field) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(`${text}T00:00:00.000Z`))) throw new Error(`learning-program-${field}-invalid`);
  return text;
}

function addUtcDays(dateText, days) {
  return new Date(Date.parse(`${dateText}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function isoWeekday(dateText) {
  return new Date(`${dateText}T00:00:00.000Z`).getUTCDay() || 7;
}

function topicOrder(topics) {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];
  const visit = (topic) => {
    if (visiting.has(topic.id)) throw new Error('learning-program-topic-dependency-cycle');
    if (visited.has(topic.id)) return;
    visiting.add(topic.id);
    for (const prerequisiteId of topic.prerequisites) {
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite) throw new Error('learning-program-topic-prerequisite-invalid');
      visit(prerequisite);
    }
    visiting.delete(topic.id);
    visited.add(topic.id);
    ordered.push(topic);
  };
  topics.forEach(visit);
  return ordered;
}

function normalizeTopics(input = []) {
  if (!Array.isArray(input) || !input.length || input.length > 100) throw new Error('learning-program-topics-invalid');
  const topics = input.map((topic) => ({
    id: id(topic.id, 'topic-id'),
    title: String(topic.title || '').trim().slice(0, 240),
    estimatedMinutes: boundedInteger(topic.estimatedMinutes, 'topic-estimated-minutes', 15, 10_000),
    weightBps: boundedInteger(topic.weightBps, 'topic-weight-bps', 1, 10_000),
    prerequisites: [...new Set((Array.isArray(topic.prerequisites) ? topic.prerequisites : []).map((item) => id(item, 'topic-prerequisite-id')))].sort(),
  }));
  if (topics.some((topic) => !topic.title)) throw new Error('learning-program-topic-title-invalid');
  if (new Set(topics.map((topic) => topic.id)).size !== topics.length) throw new Error('learning-program-topic-duplicate');
  if (topics.reduce((sum, topic) => sum + topic.weightBps, 0) !== 10_000) throw new Error('learning-program-topic-weight-total-invalid');
  return topicOrder(topics);
}

function normalizePace(input = {}) {
  const startDate = date(input.startDate, 'start-date');
  const targetDate = date(input.targetDate, 'target-date');
  if (targetDate < startDate) throw new Error('learning-program-target-date-invalid');
  const studyDays = [...new Set((Array.isArray(input.studyDays) ? input.studyDays : []).map((value) => boundedInteger(value, 'study-day', 1, 7)))].sort((a, b) => a - b);
  if (!studyDays.length) throw new Error('learning-program-study-days-invalid');
  const blackoutDates = [...new Set((Array.isArray(input.blackoutDates) ? input.blackoutDates : []).map((value) => date(value, 'blackout-date')))].sort();
  if (blackoutDates.some((value) => value < startDate || value > targetDate)) throw new Error('learning-program-blackout-date-outside-plan');
  return {
    weeklyMinutes: boundedInteger(input.weeklyMinutes, 'weekly-minutes', 30, 4_200),
    sessionMinutes: boundedInteger(input.sessionMinutes, 'session-minutes', 15, 180),
    studyDays,
    blackoutDates,
    startDate,
    targetDate,
    timezoneOffsetMinutes: boundedInteger(input.timezoneOffsetMinutes ?? 0, 'timezone-offset-minutes', -840, 840),
    targetMasteryBps: boundedInteger(input.targetMasteryBps ?? 8000, 'target-mastery-bps', 5000, 10_000),
  };
}

function buildSchedule(topics, pace) {
  const availableDates = [];
  for (let cursor = pace.startDate; cursor <= pace.targetDate; cursor = addUtcDays(cursor, 1)) {
    if (pace.studyDays.includes(isoWeekday(cursor)) && !pace.blackoutDates.includes(cursor)) availableDates.push(cursor);
  }
  const sessions = [];
  let dateIndex = 0;
  let weekStart = null;
  let weekMinutes = 0;
  for (const topic of topics) {
    let remaining = topic.estimatedMinutes;
    while (remaining > 0 && dateIndex < availableDates.length) {
      const scheduledDate = availableDates[dateIndex];
      const monday = addUtcDays(scheduledDate, 1 - isoWeekday(scheduledDate));
      if (monday !== weekStart) {
        weekStart = monday;
        weekMinutes = 0;
      }
      const capacity = Math.min(pace.sessionMinutes, pace.weeklyMinutes - weekMinutes);
      dateIndex += 1;
      if (capacity <= 0) continue;
      const plannedMinutes = Math.min(remaining, capacity);
      sessions.push({
        id: `learning_session_${sessions.length + 1}`,
        sequence: sessions.length + 1,
        scheduledDate,
        topicId: topic.id,
        plannedMinutes,
        kind: 'guided-study-and-practice',
      });
      remaining -= plannedMinutes;
      weekMinutes += plannedMinutes;
    }
    if (remaining > 0) break;
  }
  const requiredMinutes = topics.reduce((sum, topic) => sum + topic.estimatedMinutes, 0);
  const plannedMinutes = sessions.reduce((sum, session) => sum + session.plannedMinutes, 0);
  return {
    sessions,
    feasibility: {
      feasible: plannedMinutes === requiredMinutes,
      requiredMinutes,
      plannedMinutes,
      shortfallMinutes: Math.max(0, requiredMinutes - plannedMinutes),
      availableStudyDayCount: availableDates.length,
    },
  };
}

export function createLocalLearningPlan({
  projectId, learnerId, syllabusVersion, topics = [], diagnostics = [], pace = {}, version = 1,
  previousPlanId = null, previousPlanChecksum = null, governanceStartedAt = null,
  actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const createdAt = iso(now, 'created-at');
  const normalizedTopics = normalizeTopics(topics);
  const topicIds = new Set(normalizedTopics.map((topic) => topic.id));
  const normalizedDiagnostics = (Array.isArray(diagnostics) ? diagnostics : []).map((row) => ({
    topicId: id(row.topicId, 'diagnostic-topic-id'),
    scoreBps: boundedInteger(row.scoreBps, 'diagnostic-score-bps', 0, 10_000),
    evidenceId: id(row.evidenceId, 'diagnostic-evidence-id'),
  }));
  if (normalizedDiagnostics.some((row) => !topicIds.has(row.topicId))) throw new Error('learning-program-diagnostic-topic-invalid');
  if (new Set(normalizedDiagnostics.map((row) => row.topicId)).size !== normalizedDiagnostics.length) throw new Error('learning-program-diagnostic-duplicate');
  const normalizedPace = normalizePace(pace);
  const normalizedVersion = boundedInteger(version, 'version', 1, 10_000);
  const previousId = id(previousPlanId, 'previous-plan-id', true);
  const previousChecksum = previousPlanChecksum ? String(previousPlanChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('learning-program-plan-link-invalid');
  const schedule = buildSchedule(normalizedTopics, normalizedPace);
  const normalized = {
    projectId: id(projectId, 'project-id'),
    learnerId: id(learnerId, 'learner-id'),
    syllabusVersion: id(syllabusVersion, 'syllabus-version'),
    version: normalizedVersion,
    previousPlanId: previousId,
    previousPlanChecksum: previousChecksum,
    governanceStartedAt: governanceStartedAt ? iso(governanceStartedAt, 'governance-started-at') : createdAt,
    topics: normalizedTopics,
    diagnostics: normalizedDiagnostics,
    pace: normalizedPace,
    sessions: schedule.sessions,
    feasibility: schedule.feasibility,
    actorId: id(actorId, 'actor-id'),
    idempotencyKey: id(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-learning-plan/v1',
    id: `learning_plan_${checksum(`${normalized.projectId}:${normalized.version}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized,
    status: schedule.feasibility.feasible ? 'scheduled' : 'pace-adjustment-required',
    storesRawAnswers: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalLearningPlan(plan = {}, previous = null) {
  const { checksum: expected, ...base } = plan;
  const checksumValid = Boolean(expected) && expected === checksum(base);
  const schemaValid = plan.schemaVersion === 'local-learning-plan/v1';
  const linkValid = plan.version === 1
    ? !plan.previousPlanId && !plan.previousPlanChecksum
    : Boolean(previous && plan.version === previous.version + 1 && plan.previousPlanId === previous.id && plan.previousPlanChecksum === previous.checksum);
  return { valid: checksumValid && schemaValid && linkValid, checksumValid, schemaValid, linkValid };
}

export function createLocalLearningAttempt({
  plan, topicId, itemId, scoreBps, durationMs, hintCount = 0, evidenceIds = [], learnerId,
  idempotencyKey, occurredAt = new Date().toISOString(),
} = {}) {
  if (!verifyLocalLearningPlan(plan, null).valid && plan?.version === 1) throw new Error('learning-program-plan-integrity-invalid');
  const normalizedTopicId = id(topicId, 'attempt-topic-id');
  if (!(plan.topics || []).some((topic) => topic.id === normalizedTopicId)) throw new Error('learning-program-attempt-topic-invalid');
  const normalizedLearnerId = id(learnerId, 'learner-id');
  if (normalizedLearnerId !== plan.learnerId) throw new Error('learning-program-learner-mismatch');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-learning-attempt/v1',
    id: `learning_attempt_${checksum(`${plan.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: plan.projectId,
    planId: plan.id,
    planVersion: plan.version,
    planChecksum: plan.checksum,
    learnerId: normalizedLearnerId,
    topicId: normalizedTopicId,
    itemId: id(itemId, 'attempt-item-id'),
    scoreBps: boundedInteger(scoreBps, 'attempt-score-bps', 0, 10_000),
    durationMs: boundedInteger(durationMs, 'attempt-duration-ms', 1_000, 24 * 60 * 60_000),
    hintCount: boundedInteger(hintCount, 'attempt-hint-count', 0, 100),
    evidenceIds: [...new Set((Array.isArray(evidenceIds) ? evidenceIds : []).map((value) => id(value, 'attempt-evidence-id')))].sort(),
    idempotencyKey: normalizedIdempotencyKey,
    occurredAt: iso(occurredAt, 'attempt-occurred-at'),
    storesRawAnswer: false,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalLearningAttempt(attempt = {}, plan = {}) {
  const { checksum: expected, ...base } = attempt;
  const checksumValid = Boolean(expected) && expected === checksum(base);
  const linkValid = attempt.schemaVersion === 'local-learning-attempt/v1'
    && attempt.planId === plan.id && attempt.planVersion === plan.version && attempt.planChecksum === plan.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

function addMs(isoText, milliseconds) {
  return new Date(Date.parse(isoText) + milliseconds).toISOString();
}

export function buildLocalLearningProgram({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const backendRoutes = {
    learningProgram: project.id ? `/projects/${project.id}/learning-program` : null,
    plans: project.id ? `/projects/${project.id}/learning-program/plans` : null,
    attempts: project.id ? `/projects/${project.id}/learning-program/attempts` : null,
  };
  if (project.workModeContract?.workMode !== 'learning') return {
    schemaVersion: 'local-learning-program/v1', projectId: project.id || null, generatedAt,
    status: 'learning-work-mode-required', plan: null, topicRows: [], nextAction: null,
    backendRoutes, integrity: { valid: true, planRows: [], attemptRows: [] }, readyForLocalLearning: false, readyForProduction: false,
  };
  const plans = [...(project.localLearningPlans || [])].sort((a, b) => a.version - b.version);
  if (!plans.length) return {
    schemaVersion: 'local-learning-program/v1', projectId: project.id, generatedAt,
    status: 'plan-required', plan: null, topicRows: [], nextAction: null,
    backendRoutes, integrity: { valid: true, planRows: [], attemptRows: [] }, readyForLocalLearning: false, readyForProduction: false,
  };
  const planRows = plans.map((plan, index) => ({ id: plan.id, ...verifyLocalLearningPlan(plan, index ? plans[index - 1] : null) }));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const attempts = [...(project.localLearningAttempts || [])].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const attemptRows = attempts.map((attempt) => ({ id: attempt.id, ...verifyLocalLearningAttempt(attempt, planById.get(attempt.planId) || {}) }));
  const integrityValid = planRows.every((row) => row.valid) && attemptRows.every((row) => row.valid);
  const plan = plans.at(-1);
  const validAttemptIds = new Set(attemptRows.filter((row) => row.valid).map((row) => row.id));
  const latestTopicIds = new Set(plan.topics.map((topic) => topic.id));
  const attemptsForPlan = attempts.filter((attempt) => {
    const sourcePlan = planById.get(attempt.planId);
    return validAttemptIds.has(attempt.id)
      && sourcePlan?.learnerId === plan.learnerId
      && sourcePlan?.syllabusVersion === plan.syllabusVersion
      && latestTopicIds.has(attempt.topicId);
  });
  const rowsById = new Map();
  const topicRows = plan.topics.map((topic) => {
    const topicAttempts = attemptsForPlan.filter((attempt) => attempt.topicId === topic.id).slice(-5);
    const diagnostic = plan.diagnostics.find((row) => row.topicId === topic.id) || null;
    const averageScoreBps = topicAttempts.length
      ? Math.round(topicAttempts.reduce((sum, attempt) => sum + attempt.scoreBps, 0) / topicAttempts.length)
      : diagnostic?.scoreBps || 0;
    const qualifying = topicAttempts.slice(-3);
    const prerequisitesMastered = topic.prerequisites.every((topicId) => rowsById.get(topicId)?.mastered);
    const mastered = prerequisitesMastered && qualifying.length >= 3
      && qualifying.every((attempt) => attempt.scoreBps >= plan.pace.targetMasteryBps && attempt.hintCount === 0);
    const lastAttemptAt = topicAttempts.at(-1)?.occurredAt || null;
    const intervalDays = mastered ? [1, 3, 7, 14, 30][Math.min(4, qualifying.length - 1)] : 1;
    const nextReviewAt = lastAttemptAt ? addMs(lastAttemptAt, intervalDays * 86_400_000) : null;
    const reviewDue = Boolean(mastered && nextReviewAt && Date.parse(generatedAt) >= Date.parse(nextReviewAt));
    const row = {
      topicId: topic.id,
      title: topic.title,
      weightBps: topic.weightBps,
      prerequisites: topic.prerequisites,
      prerequisitesMastered,
      diagnosticScoreBps: diagnostic?.scoreBps ?? null,
      attemptCount: topicAttempts.length,
      evidenceIds: [...new Set([diagnostic?.evidenceId, ...topicAttempts.flatMap((attempt) => attempt.evidenceIds || [])].filter(Boolean))],
      averageScoreBps,
      targetMasteryBps: plan.pace.targetMasteryBps,
      mastered,
      lastAttemptAt,
      nextReviewAt,
      reviewDue,
      status: reviewDue ? 'mastered-review-due' : mastered ? 'mastered' : prerequisitesMastered ? 'practice-required' : 'prerequisite-blocked',
    };
    rowsById.set(topic.id, row);
    return row;
  });
  const due = topicRows.find((row) => row.reviewDue);
  const candidate = topicRows
    .filter((row) => !row.mastered && row.prerequisitesMastered)
    .sort((a, b) => a.averageScoreBps - b.averageScoreBps || b.weightBps - a.weightBps)[0] || null;
  const blocksDownstream = candidate && plan.topics.some((topic) => topic.prerequisites.includes(candidate.topicId));
  const next = due || candidate;
  const nextAction = next ? {
    type: due ? 'spaced-review' : 'adaptive-practice',
    topicId: next.topicId,
    reasonCode: due ? 'spaced-review-due' : blocksDownstream ? 'prerequisite-mastery-required' : 'lowest-mastery-unlocked-topic',
    targetMasteryBps: plan.pace.targetMasteryBps,
    currentScoreBps: next.averageScoreBps,
    evidenceCount: next.evidenceIds.length,
    dueAt: due?.nextReviewAt || null,
  } : null;
  const masteredCount = topicRows.filter((row) => row.mastered).length;
  return {
    schemaVersion: 'local-learning-program/v1',
    projectId: project.id,
    generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : !plan.feasibility.feasible ? 'pace-adjustment-required' : masteredCount === topicRows.length ? 'mastery-maintenance' : 'learning-in-progress',
    plan,
    summary: {
      topicCount: topicRows.length,
      masteredCount,
      reviewDueCount: topicRows.filter((row) => row.reviewDue).length,
      attemptCount: attemptsForPlan.length,
      weightedMasteryBps: Math.round(topicRows.reduce((sum, row) => sum + row.averageScoreBps * row.weightBps, 0) / 10_000),
      pacingFeasible: plan.feasibility.feasible,
    },
    topicRows,
    nextAction,
    backendRoutes,
    unresolvedTeachingSafetyGateIds: ['academic-integrity', 'learner-wellbeing'],
    integrity: { valid: integrityValid, planRows, attemptRows },
    readyForLocalLearning: integrityValid && plan.feasibility.feasible,
    readyForProduction: false,
  };
}
