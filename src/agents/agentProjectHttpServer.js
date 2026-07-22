import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createFileBackedAgentProjectApi } from './agentProjectApi.js';
import { signAgentProjectAccessHeaders } from './accessControl.js';
import { createLocalTelemetryPort } from './localTelemetryPort.js';

function shutdownChecksum(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeInboundTraceId(value = '') {
  const normalized = String(value || '').trim();
  if (normalized.length < 3 || normalized.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:-]+$/.test(normalized)) return null;
  return normalized;
}

function createRequestSpanId() {
  return `span_${randomUUID().replace(/-/g, '')}`;
}

function shutdownReceiptPath(storePath) {
  return storePath ? `${storePath}.shutdown.json` : null;
}

function readShutdownReceipt(storePath) {
  const path = shutdownReceiptPath(storePath);
  if (!path || !existsSync(path)) return null;
  let receipt;
  try { receipt = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new Error('local-shutdown-receipt-invalid'); }
  const { checksum, ...base } = receipt;
  if (receipt.schemaVersion !== 'local-runtime-shutdown-receipt/v1' || checksum !== shutdownChecksum(base)) throw new Error('local-shutdown-receipt-invalid');
  return receipt;
}

function writeShutdownReceipt(storePath, base) {
  const path = shutdownReceiptPath(storePath);
  const receipt = { ...base, checksum: shutdownChecksum(base) };
  if (!path) return receipt;
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(receipt, null, 2), 'utf8');
  renameSync(tempPath, path);
  return receipt;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function writeJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,x-hofs-access-mode,x-hofs-role,x-hofs-agent-id,x-hofs-user-id,x-hofs-signed-at,x-hofs-request-id,x-hofs-trace-id,x-hofs-parent-span-id,x-hofs-signature,x-hofs-session-token,x-hofs-local-auth-token',
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function publicAutonomousFailureReason(error) {
  const message = String(error?.message || '').trim();
  if (!message || message.length > 240) return null;
  if (/secret|password|api[_ -]?key|bearer|credential|token\s*=/i.test(message)) return null;
  return /^(?:search-provider-|model-provider-|model-artifact-draft-|artifact-draft-|provider-policy-|autonomous-provider-|local-durable-task-|specialized-tool-|task-|submission |agent autonomous action)/i.test(message)
    ? message
    : null;
}

function normalizeSchedulerLimit(value) {
  if (value === Infinity) return 'infinity';
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function summarizeSchedulerAgentControls(input = {}) {
  const forceProjectIds = Array.isArray(input.forceProjectIds) ? input.forceProjectIds : [];
  const forceAgentProjectIds = Array.isArray(input.forceAgentProjectIds) ? input.forceAgentProjectIds : [];
  return {
    schemaVersion: 'scheduler-agent-controls/v1',
    projectId: input.projectId || forceProjectIds[0] || forceAgentProjectIds[0] || null,
    projectScoped: Boolean(input.projectId || forceProjectIds.length || forceAgentProjectIds.length),
    includeReadModels: typeof input.includeReadModels === 'boolean' ? input.includeReadModels : null,
    useAgentAutonomousStrategy: Boolean(input.useAgentAutonomousStrategy || input.agentAutonomousStrategy || input.useAutonomousStrategy),
    submitAgentWorkArtifacts: Boolean(input.submitAgentWorkArtifacts),
    workArtifactType: input.agentWorkArtifactType || (input.submitAgentWorkArtifacts ? 'auto' : null),
    reviewPendingSubmissions: Boolean(input.reviewPendingSubmissions),
    agentReviewVerdict: input.agentReviewVerdict || null,
    respondToReviewObligations: Boolean(input.respondToReviewObligations),
    reviewResponseArtifactType: input.reviewResponseArtifactType || null,
    maxAgentProjects: normalizeSchedulerLimit(input.maxAgentProjects),
    maxAgentsPerProject: normalizeSchedulerLimit(input.maxAgentsPerProject),
  };
}

function summarizeSchedulerAutopilotControls(input = {}) {
  const forceProjectIds = Array.isArray(input.forceProjectIds) ? input.forceProjectIds : [];
  const forceAutopilotProjectIds = Array.isArray(input.forceAutopilotProjectIds) ? input.forceAutopilotProjectIds : [];
  const enabled = Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions || input.resumeAutopilotSessions);
  return {
    schemaVersion: 'scheduler-autopilot-controls/v1',
    enabled,
    projectId: input.projectId || forceAutopilotProjectIds[0] || forceProjectIds[0] || null,
    projectScoped: Boolean(input.projectId || forceAutopilotProjectIds.length || forceProjectIds.length),
    includeReadModels: typeof input.includeReadModels === 'boolean' ? input.includeReadModels : null,
    forceAutopilotRun: Boolean(input.forceAutopilotRun),
    loopCount: normalizeSchedulerLimit(input.autopilotLoopCount || input.loopCount || 1),
    intervalMs: normalizeSchedulerLimit(input.autopilotIntervalMs),
    maxProjects: normalizeSchedulerLimit(input.maxAutopilotProjects),
    maxSessionsPerProject: normalizeSchedulerLimit(input.maxAutopilotSessionsPerProject),
    targetKind: input.autopilotTargetKind || input.targetKind || null,
  };
}

export function createAutonomousSchedulerController({
  api,
  intervalMs = 60_000,
  now = () => new Date().toISOString(),
  trigger = 'http-autonomous-scheduler',
  source = 'http-autonomous-scheduler-chat',
  accessControl = {},
} = {}) {
  let timer = null;
  let running = false;
  let acceptingTicks = true;
  const state = {
    enabled: false,
    intervalMs,
    trigger,
    source,
    startedAt: null,
    stoppedAt: null,
    lastTickAt: null,
    lastCompletedAt: null,
    lastErrorAt: null,
    lastError: null,
    tickCount: 0,
    processedCount: 0,
    skippedCount: 0,
    agentProcessedCount: 0,
    agentSkippedCount: 0,
    agentAutonomousActionQueueCount: 0,
    agentOutcomeActionCount: 0,
    autopilotProcessedCount: 0,
    autopilotSkippedCount: 0,
    autopilotSessionTickCount: 0,
    messageCount: 0,
    lastStartedRunImmediately: false,
    lastResult: null,
    startupAgentControlSummary: null,
    scheduledAgentControlSummary: null,
    lastTickAgentControlSummary: null,
    startupAutopilotControlSummary: null,
    scheduledAutopilotControlSummary: null,
    lastTickAutopilotControlSummary: null,
  };
  let scheduledTickInput = {};

  const status = () => ({
    ...state,
    running,
    acceptingTicks,
  });

  const waitForIdle = ({ timeoutMs = 5000, pollIntervalMs = 10 } = {}) => new Promise((resolve) => {
    const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
    const pollMs = Math.max(1, Number(pollIntervalMs) || 1);
    const check = () => {
      if (!running) {
        resolve({ drained: true, reason: 'scheduler-idle' });
        return;
      }
      if (Date.now() >= deadline) {
        resolve({ drained: false, reason: 'scheduler-drain-timeout' });
        return;
      }
      setTimeout(check, pollMs);
    };
    check();
  });

  const runtimeHeaders = ({ method = 'POST', path = '/', localAuthToken = '' } = {}) => {
    const baseHeaders = {
      'x-hofs-access-mode': 'enforced',
      'x-hofs-role': 'runtime-platform',
      'x-hofs-user-id': 'http-autonomous-scheduler',
      ...(localAuthToken ? { 'x-hofs-local-auth-token': localAuthToken } : {}),
    };
    if (!accessControl.signingSecret) return baseHeaders;
    const signedAt = now();
    return signAgentProjectAccessHeaders({
      method,
      path,
      role: 'runtime-platform',
      userId: 'http-autonomous-scheduler',
      signedAt,
      requestId: (accessControl.requireSignedRequestIds || accessControl.requireReplayProtection)
        ? `scheduler_${path.replace(/[^a-z0-9]+/gi, '_')}_${Date.parse(signedAt) || Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        : '',
      secret: accessControl.signingSecret,
    });
  };

  const tick = async (input = {}) => {
    if (!acceptingTicks) {
      return { skipped: true, reason: 'scheduler-quiescing', status: status() };
    }
    if (running) {
      return {
        skipped: true,
        reason: 'scheduler-already-running',
        status: status(),
      };
    }

    running = true;
    const tickAt = input.now || now();
    state.lastTickAt = tickAt;
    state.lastTickAgentControlSummary = summarizeSchedulerAgentControls(input);
    state.lastTickAutopilotControlSummary = summarizeSchedulerAutopilotControls(input);
    try {
      const projectResult = input.runProjectCoordinationCycles === false
        ? { status: 200, body: { processed: [], skipped: [{ reason: 'outcome-worker-authoritative' }], messages: [], messageCount: 0 } }
        : api.handle({
        method: 'POST',
        path: '/workers/autonomous/due',
        headers: runtimeHeaders({ method: 'POST', path: '/workers/autonomous/due', localAuthToken: input.localAuthToken }),
        body: {
          now: tickAt,
          trigger: input.trigger || state.trigger,
          source: input.source || state.source,
          cadence: input.projectCadence || input.cadence,
          forceDue: Boolean(input.forceProjectRun),
          forceReason: input.forceProjectRun ? (input.forceReason || 'scheduler-start-project-sweep') : undefined,
          forceProjectIds: input.forceProjectIds || [],
          includeReadModels: input.includeReadModels,
        },
        });
      if (projectResult.status >= 400) {
        throw new Error(projectResult.body?.message || projectResult.body?.error || `Autonomous worker returned ${projectResult.status}.`);
      }
      const agentOutcomeActions = [];
      if (input.runAgentOutcomeActions) {
        const projects = api.store?.listProjects?.() || [];
        const maxProjects = Math.max(1, Number(input.maxOutcomeProjects || input.maxAgentProjects || 1));
        const candidates = projects.map((project) => {
          const queue = api.service?.getAgentAutonomousActionQueue?.(project.id, { now: tickAt });
          const row = (queue?.rows || []).find((candidate) => candidate.canRun && (candidate.due || input.forceAgentOutcomeRun));
          return row?.runApiPath ? { project, row } : null;
        }).filter(Boolean).sort((left, right) => (
          String(left.row.dueAt || '').localeCompare(String(right.row.dueAt || ''))
          || String(left.project.id || '').localeCompare(String(right.project.id || ''))
        ));
        for (const { project, row } of candidates.slice(0, maxProjects)) {
          const response = await (api.handleAsync || api.handle).call(api, {
            method: 'POST',
            path: row.runApiPath,
            headers: runtimeHeaders({ method: 'POST', path: row.runApiPath, localAuthToken: input.localAuthToken }),
            body: {
              now: tickAt,
              includeReadModels: false,
              force: Boolean(input.forceAgentOutcomeRun),
            },
          });
          agentOutcomeActions.push({
            projectId: project.id,
            agentId: row.agentId,
            selectedAction: row.selectedAction,
            status: response.status,
            submissionId: response.body?.submission?.id || null,
            evidenceSearchId: response.body?.evidenceSearch?.id || null,
            error: response.status >= 400 ? response.body?.message || response.body?.error || 'agent-outcome-action-failed' : null,
          });
        }
      }
      const agentResult = input.runLegacyAgentPulseCycles === false
        ? { status: 200, body: { processed: [], skipped: [{ reason: 'outcome-action-queue-authoritative' }], messages: [], messageCount: 0, agentAutonomousActionQueues: [] } }
        : api.handle({
        method: 'POST',
        path: '/workers/agents/due',
        headers: runtimeHeaders({ method: 'POST', path: '/workers/agents/due', localAuthToken: input.localAuthToken }),
        body: {
          now: tickAt,
          trigger: input.agentTrigger || `${input.trigger || state.trigger}-agents`,
          intervalMs: input.agentIntervalMs,
          maxAgentsPerProject: input.maxAgentsPerProject,
          maxProjects: input.maxAgentProjects,
          forceDue: Boolean(input.forceAgentRun),
          forceReason: input.forceAgentRun ? 'scheduler-start-agent-sweep' : undefined,
          forceProjectIds: input.forceAgentProjectIds || [],
          submitWorkArtifacts: Boolean(input.submitAgentWorkArtifacts),
          workArtifactType: input.agentWorkArtifactType || (input.submitAgentWorkArtifacts ? 'auto' : undefined),
          workArtifactReviewStatus: input.agentWorkArtifactReviewStatus,
          workArtifactReviewerAgentId: input.agentWorkArtifactReviewerAgentId,
          submitWorkArtifactOn: input.submitAgentWorkArtifactOn,
          reviewPendingSubmissions: Boolean(input.reviewPendingSubmissions),
          agentReviewVerdict: input.agentReviewVerdict,
          agentReviewComments: input.agentReviewComments,
          agentReviewRequestedChanges: input.agentReviewRequestedChanges,
          respondToReviewObligations: Boolean(input.respondToReviewObligations),
          reviewResponseArtifactType: input.reviewResponseArtifactType,
          reviewResponseReviewerAgentId: input.reviewResponseReviewerAgentId,
          useAutonomousStrategy: Boolean(input.useAgentAutonomousStrategy || input.agentAutonomousStrategy || input.useAutonomousStrategy),
          includeReadModels: input.includeReadModels,
        },
        });
      if (agentResult.status >= 400) {
        throw new Error(agentResult.body?.message || agentResult.body?.error || `Agent worker returned ${agentResult.status}.`);
      }
      const shouldTickAutopilotSessions = Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions || input.resumeAutopilotSessions);
      const autopilotResult = shouldTickAutopilotSessions
        ? await (api.handleAsync || api.handle).call(api, {
            method: 'POST',
            path: '/workers/autopilot/due',
            headers: runtimeHeaders({ method: 'POST', path: '/workers/autopilot/due', localAuthToken: input.localAuthToken }),
            body: {
              now: tickAt,
              actor: input.autopilotActor || 'HTTP Autonomous Scheduler',
              reason: input.autopilotReason || 'http-autonomous-scheduler-autopilot',
              intervalMs: input.autopilotIntervalMs,
              maxProjects: input.maxAutopilotProjects,
              maxSessionsPerProject: input.maxAutopilotSessionsPerProject,
              forceDue: Boolean(input.forceAutopilotRun),
              forceReason: input.forceAutopilotRun ? (input.forceAutopilotReason || 'scheduler-start-autopilot-sweep') : undefined,
              forceProjectIds: input.forceAutopilotProjectIds || input.forceProjectIds || [],
              loopCount: input.autopilotLoopCount || input.loopCount || 1,
              targetKind: input.autopilotTargetKind || input.targetKind,
              useProviderEvidenceSearch: Boolean(input.useProviderEvidenceSearch || input.autopilotUseProviderEvidenceSearch || input.providerEvidenceSearchEnabled || input.autopilotRequestBodyOverrides?.useProviderEvidenceSearch),
              providerEvidenceSearchEnabled: input.autopilotProviderEvidenceSearchEnabled ?? input.providerEvidenceSearchEnabled,
              requestBodyOverrides: {
                includeReadModels: false,
                ...(input.autopilotRequestBodyOverrides || {}),
              },
              includeReadModels: input.includeReadModels,
            },
          })
        : { status: 200, body: { processed: [], skipped: [], messages: [], messageCount: 0 } };
      if (autopilotResult.status >= 400) {
        throw new Error(autopilotResult.body?.message || autopilotResult.body?.error || `Autopilot worker returned ${autopilotResult.status}.`);
      }
      const agentAutonomousActionQueues = agentResult.body.agentAutonomousActionQueues || [];
      const agentAutonomousActionQueue = agentResult.body.agentAutonomousActionQueue
        || (agentAutonomousActionQueues.length === 1 ? agentAutonomousActionQueues[0] : null);
      state.tickCount += 1;
      state.processedCount += projectResult.body.processed?.length || 0;
      state.skippedCount += projectResult.body.skipped?.length || 0;
      state.agentProcessedCount += agentResult.body.processed?.length || 0;
      state.agentSkippedCount += agentResult.body.skipped?.length || 0;
      state.agentAutonomousActionQueueCount += agentAutonomousActionQueues.length;
      state.agentOutcomeActionCount += agentOutcomeActions.filter((row) => row.status < 400).length;
      state.autopilotProcessedCount += autopilotResult.body.processed?.length || 0;
      state.autopilotSkippedCount += autopilotResult.body.skipped?.length || 0;
      state.autopilotSessionTickCount += autopilotResult.body.processed?.filter((item) => item.tickId).length || 0;
      state.messageCount += (projectResult.body.messageCount || 0) + (agentResult.body.messageCount || 0) + (autopilotResult.body.messageCount || 0);
      state.lastCompletedAt = now();
      state.lastError = null;
      state.lastResult = {
        processed: projectResult.body.processed || [],
        skipped: projectResult.body.skipped || [],
        agentsProcessed: agentResult.body.processed || [],
        agentsSkipped: agentResult.body.skipped || [],
        autopilotProcessed: autopilotResult.body.processed || [],
        autopilotSkipped: autopilotResult.body.skipped || [],
        agentAutonomousActionQueues,
        agentAutonomousActionQueue,
        agentOutcomeActions,
        messageCount: (projectResult.body.messageCount || 0) + (agentResult.body.messageCount || 0) + (autopilotResult.body.messageCount || 0),
      };
      return {
        skipped: false,
        result: {
          ...projectResult.body,
          agentProcessed: agentResult.body.processed || [],
          agentSkipped: agentResult.body.skipped || [],
          agentMessages: agentResult.body.messages || [],
          agentOutcomeActions,
          autopilotProcessed: autopilotResult.body.processed || [],
          autopilotSkipped: autopilotResult.body.skipped || [],
          autopilotMessages: autopilotResult.body.messages || [],
          agentAutonomousActionQueues,
          agentAutonomousActionQueue,
        },
        status: status(),
      };
    } catch (error) {
      state.lastErrorAt = now();
      state.lastError = error.message || String(error);
      throw error;
    } finally {
      running = false;
    }
  };

  const start = (input = {}) => {
    acceptingTicks = true;
    const { runImmediately = false, projectId = null, includeReadModels } = input;
    const { runImmediately: _runImmediately, projectId: _projectId, ...tickInput } = input;
    const runImmediateStartupTick = () => tick({
      forceProjectRun: Boolean(projectId),
      forceProjectIds: projectId ? [projectId] : [],
      forceAgentRun: true,
      forceAgentProjectIds: projectId ? [projectId] : [],
      maxAgentProjects: projectId ? Infinity : 1,
      trigger: 'manager-ui-scheduler-start-pulse',
      source: 'manager-ui-scheduler-start-chat',
      forceReason: 'backend-scheduler-start-first-work',
      agentTrigger: 'http-autonomous-scheduler-startup-agents',
      submitAgentWorkArtifacts: Boolean(input.submitAgentWorkArtifacts),
      agentWorkArtifactType: input.agentWorkArtifactType || (input.submitAgentWorkArtifacts ? 'auto' : undefined),
      agentWorkArtifactReviewStatus: input.agentWorkArtifactReviewStatus,
      agentWorkArtifactReviewerAgentId: input.agentWorkArtifactReviewerAgentId,
      submitAgentWorkArtifactOn: input.submitAgentWorkArtifactOn,
      reviewPendingSubmissions: Boolean(input.reviewPendingSubmissions),
      agentReviewVerdict: input.agentReviewVerdict,
      agentReviewComments: input.agentReviewComments,
      agentReviewRequestedChanges: input.agentReviewRequestedChanges,
      respondToReviewObligations: Boolean(input.respondToReviewObligations),
      reviewResponseArtifactType: input.reviewResponseArtifactType,
      reviewResponseReviewerAgentId: input.reviewResponseReviewerAgentId,
      useAgentAutonomousStrategy: Boolean(input.useAgentAutonomousStrategy || input.agentAutonomousStrategy || input.useAutonomousStrategy),
      tickAutopilotSessions: Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions || input.resumeAutopilotSessions),
      forceAutopilotRun: Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions || input.resumeAutopilotSessions) && Boolean(projectId),
      forceAutopilotProjectIds: projectId ? [projectId] : [],
      autopilotLoopCount: input.autopilotLoopCount || input.loopCount,
      autopilotIntervalMs: input.autopilotIntervalMs,
      maxAutopilotProjects: projectId ? 1 : input.maxAutopilotProjects,
      maxAutopilotSessionsPerProject: input.maxAutopilotSessionsPerProject,
      autopilotTargetKind: input.autopilotTargetKind || input.targetKind,
      autopilotRequestBodyOverrides: input.autopilotRequestBodyOverrides,
      includeReadModels,
      localAuthToken: input.localAuthToken,
    }).catch(() => {});
    if (timer) {
      state.lastStartedRunImmediately = Boolean(runImmediately);
      state.startupAgentControlSummary = summarizeSchedulerAgentControls(input);
      state.startupAutopilotControlSummary = summarizeSchedulerAutopilotControls(input);
      if (runImmediately) setTimeout(runImmediateStartupTick, 25);
      return status();
    }
    scheduledTickInput = { ...tickInput };
    state.enabled = true;
    state.startedAt = now();
    state.stoppedAt = null;
    state.lastStartedRunImmediately = Boolean(runImmediately);
    state.startupAgentControlSummary = summarizeSchedulerAgentControls(input);
    state.scheduledAgentControlSummary = summarizeSchedulerAgentControls(tickInput);
    state.startupAutopilotControlSummary = summarizeSchedulerAutopilotControls(input);
    state.scheduledAutopilotControlSummary = summarizeSchedulerAutopilotControls(tickInput);
    timer = setInterval(() => {
      tick(scheduledTickInput).catch(() => {});
    }, state.intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    if (runImmediately) {
      setTimeout(runImmediateStartupTick, 25);
    }
    return status();
  };

  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    state.enabled = false;
    state.stoppedAt = now();
    scheduledTickInput = {};
    state.scheduledAgentControlSummary = null;
    state.scheduledAutopilotControlSummary = null;
    return status();
  };
  const quiesce = () => {
    acceptingTicks = false;
    return stop();
  };

  return {
    start,
    stop,
    quiesce,
    tick,
    status,
    waitForIdle,
  };
}

export function createAgentProjectHttpServer({
  api,
  filePath,
  securityAuditLogPath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 0,
  replaceWithSeed = false,
  autonomousScheduler = {},
  artifactWriter = null,
  projectRuntime = null,
  llmProvider = null,
  searchProvider = null,
  providerPolicy = {},
  secretVault = null,
  accessControl = {},
  localAuthFilePath = null,
  localAuthRequired = false,
  telemetry = null,
} = {}) {
  const runtimeControls = {
    autonomousSchedulerEnabled: Boolean(autonomousScheduler.enabled),
  };
  const resolvedApi = api || createFileBackedAgentProjectApi({
    filePath,
    securityAuditLogPath,
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    replaceWithSeed,
    artifactWriter,
    projectRuntime,
    llmProvider,
    searchProvider,
    providerPolicy,
    secretVault,
    runtimeControls,
    accessControl,
    localAuthFilePath,
    localAuthRequired,
  });
  const scheduler = createAutonomousSchedulerController({
    api: resolvedApi,
    intervalMs: autonomousScheduler.intervalMs,
    now: autonomousScheduler.now,
    trigger: autonomousScheduler.trigger,
    source: autonomousScheduler.source,
    accessControl,
  });
  runtimeControls.schedulerStatus = () => scheduler.status();
  const resolvedTelemetry = telemetry || createLocalTelemetryPort();
  const storePath = resolvedApi.store?.filePath || null;
  let lifecycle = 'accepting';
  let shutdownPromise = null;
  let lastShutdownReceipt = readShutdownReceipt(storePath);
  const activeRequests = new Map();
  const runtimeLifecycleStatus = () => ({
    schemaVersion: 'local-runtime-lifecycle/v1',
    state: lifecycle,
    acceptingNewWork: lifecycle === 'accepting',
    activeRequestCount: activeRequests.size,
    activeRequestHashes: [...activeRequests.values()].map((row) => row.traceHash).sort(),
    lastShutdownReceipt,
  });
  const localRuntimeHealth = () => {
    const localAuth = resolvedApi.localAuth?.status?.() || null;
    const telemetryStatus = resolvedTelemetry.status({ limit: 1 });
    const schedulerStatus = scheduler.status();
    const secretVault = resolvedApi.service?.getSecretVaultStatus?.() || null;
    const checks = [
      {
        id: 'project-store',
        passed: Boolean(resolvedApi.store?.filePath),
        detail: resolvedApi.store?.filePath ? 'Local project store is attached.' : 'Local project store is unavailable.',
      },
      {
        id: 'local-auth',
        passed: !localAuthRequired || Boolean(localAuth?.enabled && !localAuth.bootstrapRequired),
        detail: !localAuthRequired
          ? 'Local authentication is optional for this runtime.'
          : localAuth?.bootstrapRequired
            ? 'Bootstrap the first local security administrator.'
            : 'Local authentication is enforced and initialized.',
      },
      {
        id: 'telemetry',
        passed: telemetryStatus.enabled === true,
        detail: `${telemetryStatus.summary?.requestCount || 0} local request record(s); ${telemetryStatus.summary?.serverErrorCount || 0} server error(s).`,
      },
      {
        id: 'latency-slo',
        passed: telemetryStatus.slo?.alert?.active !== true,
        detail: telemetryStatus.slo?.alert?.recommendation || 'Collect more local requests before evaluating the SLO.',
      },
      {
        id: 'runtime-errors',
        passed: (telemetryStatus.errors?.summary?.activeCount || 0) === 0,
        detail: (telemetryStatus.errors?.summary?.activeCount || 0) > 0
          ? `${telemetryStatus.errors.summary.activeCount} active runtime error issue(s); inspect /runtime-errors and follow the linked runbook.`
          : 'No active unhandled runtime error issue.',
      },
      {
        id: 'scheduler',
        passed: true,
        detail: schedulerStatus.enabled ? 'Local autonomous scheduler is enabled.' : 'Scheduler is stopped; start it only for supervised autonomous work.',
      },
      {
        id: 'secret-vault',
        passed: secretVault?.enabled !== false,
        detail: secretVault?.ready ? 'Local secret vault is ready.' : 'No ready secret vault is required until provider credentials are configured.',
      },
    ];
    const status = checks.some((check) => check.id === 'local-auth' && !check.passed)
      ? 'setup-required'
      : telemetryStatus.slo?.alert?.active === true
          || (telemetryStatus.errors?.summary?.activeCount || 0) > 0
          || (telemetryStatus.summary?.serverErrorCount || 0) > 0
        ? 'attention-needed'
        : checks.every((check) => check.passed)
          ? 'ready'
          : 'degraded';
    return {
      schemaVersion: 'local-runtime-health/v1',
      status,
      readyForLocalOperation: status === 'ready',
      readyForProduction: false,
      checks,
      telemetry: {
        storage: telemetryStatus.storage,
        summary: telemetryStatus.summary,
      },
      scheduler: {
        enabled: schedulerStatus.enabled,
        lastCompletedAt: schedulerStatus.lastCompletedAt || null,
        lastError: schedulerStatus.lastError || null,
      },
      lifecycle: runtimeLifecycleStatus(),
      localAuth: localAuth ? {
        enabled: localAuth.enabled,
        bootstrapRequired: localAuth.bootstrapRequired,
        userCount: localAuth.userCount,
      } : null,
      maintenance: {
        backupCommand: 'npm run local:backup',
        restoreDrillCommand: 'npm run local:recovery:drill',
        observabilityRoute: '/runtime-observability',
        runtimeErrorsRoute: '/runtime-errors',
      },
      productionBlockers: ['centralized observability', 'managed alert routing and on-call ownership', 'managed incident system'],
    };
  };

  const server = createServer(async (request, response) => {
    const traceId = normalizeInboundTraceId(request.headers['x-hofs-trace-id'])
      || normalizeInboundTraceId(request.headers['x-hofs-request-id'])
      || `trace_${randomUUID()}`;
    const requestSpanId = createRequestSpanId();
    const parentSpanId = /^span_[a-f0-9]{32}$/.test(String(request.headers['x-hofs-parent-span-id'] || ''))
      ? String(request.headers['x-hofs-parent-span-id'])
      : null;
    const startedAt = Date.now();
    const requestAbortController = new AbortController();
    request.once('aborted', () => requestAbortController.abort());
    response.once('close', () => {
      if (!response.writableEnded) requestAbortController.abort();
    });
    let requestFinalized = false;
    const finalizeRequest = () => {
      if (requestFinalized) return;
      requestFinalized = true;
      activeRequests.delete(requestSpanId);
    };
    const send = (status, body) => {
      try {
        resolvedTelemetry.recordHttpRequest({
          traceId,
          spanId: requestSpanId,
          parentSpanId,
          method: request.method,
          path: request.url || '/',
          statusCode: status,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // Local telemetry cannot make an API response fail.
      }
      writeJson(response, status, body, { 'x-hofs-trace-id': traceId, 'x-hofs-span-id': requestSpanId });
    };
    const requestPath = String(request.url || '/').split('?')[0];
    const lifecycleReadAllowed = request.method === 'GET' && ['/health', '/local-runtime-health', '/local-runtime-lifecycle'].includes(requestPath);
    if (lifecycle !== 'accepting' && !lifecycleReadAllowed) {
      send(503, { error: 'local-runtime-quiescing', lifecycle: runtimeLifecycleStatus() });
      return;
    }
    activeRequests.set(requestSpanId, {
      traceHash: shutdownChecksum(traceId),
      spanHash: shutdownChecksum(requestSpanId),
      startedAt: new Date(startedAt).toISOString(),
    });
    response.once('finish', finalizeRequest);
    response.once('close', finalizeRequest);
    if (request.method === 'OPTIONS') {
      send(204, {});
      return;
    }

    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const needsBody = ['POST', 'PUT', 'PATCH'].includes(request.method || '');
      const body = needsBody ? await readJsonBody(request) : {};
      if (url.pathname === '/health' && request.method === 'GET') {
        send(200, {
          schemaVersion: 'local-health/v1',
          status: lifecycle === 'accepting' ? 'ok' : 'stopping',
          localOnly: true,
          lifecycle,
        });
        return;
      }
      const requireLocalSchedulerAdmin = () => {
        if (!localAuthRequired) return true;
        const token = String(request.headers['x-hofs-local-auth-token'] || '').trim();
        const verification = resolvedApi.localAuth?.verifySession({ token, now: body.now || new Date().toISOString() });
        if (verification?.verified && verification.user?.role === 'security-admin') return true;
        send(401, {
          error: 'local-auth-admin-required',
          message: 'A local security-admin session is required for scheduler controls.',
        });
        return false;
      };
      if (url.pathname === '/runtime-observability' && request.method === 'GET') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { runtimeObservability: resolvedTelemetry.status() });
        return;
      }
      if (url.pathname === '/runtime-errors' && request.method === 'GET') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { runtimeErrors: resolvedTelemetry.status().errors });
        return;
      }
      const runtimeErrorAction = url.pathname.match(/^\/runtime-errors\/([a-f0-9]{64})\/(acknowledge|resolve)$/);
      if (runtimeErrorAction && request.method === 'POST') {
        if (!requireLocalSchedulerAdmin()) return;
        const runtimeError = resolvedTelemetry.updateRuntimeErrorIssue({
          fingerprint: runtimeErrorAction[1],
          action: runtimeErrorAction[2],
          actorId: body.actorId || body.updatedBy || '',
          note: body.note || '',
        });
        if (!runtimeError) {
          send(404, { error: 'runtime-error-not-found' });
          return;
        }
        send(200, { runtimeError, runtimeErrors: resolvedTelemetry.status().errors });
        return;
      }
      if (url.pathname === '/local-runtime-health' && request.method === 'GET') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { localRuntimeHealth: localRuntimeHealth() });
        return;
      }
      if (url.pathname === '/local-runtime-lifecycle' && request.method === 'GET') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { lifecycle: runtimeLifecycleStatus() });
        return;
      }
      if (url.pathname === '/workers/autonomous/status' && request.method === 'GET') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { scheduler: scheduler.status() });
        return;
      }
      if (url.pathname === '/workers/autonomous/start' && request.method === 'POST') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, {
          scheduler: scheduler.start({
            ...body,
            localAuthToken: String(request.headers['x-hofs-local-auth-token'] || '').trim(),
            runImmediately: Boolean(body.runImmediately),
            projectId: body.projectId || null,
            includeReadModels: body.includeReadModels,
          }),
        });
        return;
      }
      if (url.pathname === '/workers/autonomous/stop' && request.method === 'POST') {
        if (!requireLocalSchedulerAdmin()) return;
        send(200, { scheduler: scheduler.stop() });
        return;
      }
      if (url.pathname === '/workers/autonomous/tick' && request.method === 'POST') {
        if (!requireLocalSchedulerAdmin()) return;
        const tickResult = await scheduler.tick({
          ...body,
          localAuthToken: String(request.headers['x-hofs-local-auth-token'] || '').trim(),
        });
        send(200, tickResult);
        return;
      }
      const result = await (resolvedApi.handleAsync || resolvedApi.handle).call(resolvedApi, {
        method: request.method,
        path: url.pathname,
        url: request.url || url.pathname,
        headers: request.headers,
        body,
        traceId,
        requestSpanId,
        parentSpanId,
        traceStartedAt: new Date(startedAt).toISOString(),
        signal: requestAbortController.signal,
      });
      send(result.status, result.body);
    } catch (error) {
      let runtimeError = null;
      try {
        runtimeError = resolvedTelemetry.recordRuntimeError({
          traceId,
          method: request.method,
          path: request.url || '/',
          category: 'unhandled-http-error',
          errorCode: error?.code || error?.name || 'UNHANDLED_RUNTIME_ERROR',
          severity: 'critical',
        });
      } catch {
        // Error reporting must never replace the original response path.
      }
      send(400, {
        error: 'agent-project-http-error',
        errorCode: runtimeError?.errorCode || 'UNHANDLED_RUNTIME_ERROR',
        message: 'The local runtime could not complete this request. Use the trace id and /runtime-errors for recovery guidance.',
        ...(publicAutonomousFailureReason(error) ? { failureReason: publicAutonomousFailureReason(error) } : {}),
        traceId,
      });
    }
  });
  const sockets = new Set();
  server.keepAliveTimeout = Math.min(Number(server.keepAliveTimeout) || 5000, 1000);
  server.headersTimeout = Math.min(Number(server.headersTimeout) || 60000, 5000);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  const waitForActiveRequests = ({ deadlineMs, pollIntervalMs = 5 } = {}) => new Promise((resolve) => {
    const check = () => {
      if (activeRequests.size === 0) {
        resolve({ drained: true, reason: 'http-idle', activeRequestCount: 0, activeRequestHashes: [] });
        return;
      }
      if (Date.now() >= deadlineMs) {
        resolve({
          drained: false,
          reason: 'http-drain-timeout',
          activeRequestCount: activeRequests.size,
          activeRequestHashes: [...activeRequests.values()].map((row) => row.traceHash).sort(),
        });
        return;
      }
      setTimeout(check, Math.max(1, Number(pollIntervalMs) || 1));
    };
    check();
  });

  if (autonomousScheduler.enabled || autonomousScheduler.autoStart) {
    scheduler.start({
      ...autonomousScheduler,
      runImmediately: Boolean(autonomousScheduler.runImmediately),
    });
  }

  return {
    api: resolvedApi,
    scheduler,
    telemetry: resolvedTelemetry,
    localRuntimeHealth,
    runtimeLifecycleStatus,
    server,
    listen({ port = 0, host = '127.0.0.1' } = {}) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          const address = server.address();
          resolve({
            server,
            api: resolvedApi,
            scheduler,
            url: `http://${address.address}:${address.port}`,
          });
        });
      });
    },
    async close({ schedulerDrainTimeoutMs = 5000, drainTimeoutMs = schedulerDrainTimeoutMs, forceCloseTimeoutMs = null } = {}) {
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = (async () => {
        const shutdownStartedAt = new Date().toISOString();
        lifecycle = 'quiescing';
        scheduler.quiesce();
        projectRuntime?.closeWorkspaceWatchers?.();
        const timeoutMs = Math.max(1, Number(drainTimeoutMs) || 5000);
        const deadlineMs = Date.now() + timeoutMs;
        const socketsAtStart = sockets.size;
        const closeServer = () => new Promise((resolve, reject) => {
        let settled = false;
        let closeIdleTimer = null;
        let forceCloseTimer = null;
        let forcedConnectionCount = 0;
        const settle = (error = null) => {
          if (settled) return;
          settled = true;
          if (closeIdleTimer) clearTimeout(closeIdleTimer);
          if (forceCloseTimer) clearTimeout(forceCloseTimer);
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve({ forcedConnectionCount });
        };
        closeIdleTimer = setTimeout(() => {
          if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        }, 50);
        const forceGraceMs = forceCloseTimeoutMs === null
          ? 0
          : Math.max(1, Number(forceCloseTimeoutMs) || 1);
        const forceAfterMs = timeoutMs + forceGraceMs;
        forceCloseTimer = setTimeout(() => {
          forcedConnectionCount = sockets.size;
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          sockets.forEach((socket) => socket.destroy());
          settle();
        }, forceAfterMs);
        server.close((error) => settle(error));
      });
        const closePromise = closeServer();
        const [schedulerDrain, httpDrain, closeResult] = await Promise.all([
          scheduler.waitForIdle({ timeoutMs: Math.max(1, deadlineMs - Date.now()) }),
          waitForActiveRequests({ deadlineMs }),
          closePromise,
        ]);
        const effectiveHttpDrain = closeResult.forcedConnectionCount > 0 && httpDrain.drained
          ? { ...httpDrain, drained: false, reason: 'http-force-closed' }
          : httpDrain;
        const projects = resolvedApi.store?.listProjects?.() || [];
        const durableRows = projects.flatMap((project) => project.localDurableTaskQueue || []);
        const complete = Boolean(schedulerDrain.drained && effectiveHttpDrain.drained && closeResult.forcedConnectionCount === 0);
        lifecycle = 'closed';
        const receiptBase = {
          schemaVersion: 'local-runtime-shutdown-receipt/v1',
          id: `shutdown_${shutdownChecksum(shutdownStartedAt).slice(0, 24)}`,
          status: complete ? 'drained' : 'incomplete',
          complete,
          shutdownStartedAt,
          shutdownCompletedAt: new Date().toISOString(),
          drainTimeoutMs: timeoutMs,
          schedulerDrain,
          httpDrain: effectiveHttpDrain,
          socketsAtStart,
          forcedConnectionCount: closeResult.forcedConnectionCount || 0,
          durableRecovery: {
            leasedCount: durableRows.filter((row) => row.status === 'leased').length,
            cancellationRequestedCount: durableRows.filter((row) => row.status === 'cancellation-requested').length,
            retryWaitCount: durableRows.filter((row) => row.status === 'retry-wait').length,
            ambiguousProviderCount: projects.flatMap((project) => project.localIdempotentExecutionLedger || []).filter((row) => ['dispatched', 'ambiguous'].includes(row.status)).length,
          },
          storesRequestContent: false,
          localOnly: true,
        };
        lastShutdownReceipt = writeShutdownReceipt(storePath, receiptBase);
        return { schedulerDrain, httpDrain: effectiveHttpDrain, shutdownReceipt: lastShutdownReceipt, complete };
      })();
      return shutdownPromise;
    },
  };
}
