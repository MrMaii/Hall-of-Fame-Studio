import { createServer } from 'node:http';
import { createFileBackedAgentProjectApi } from './agentProjectApi.js';
import { signAgentProjectAccessHeaders } from './accessControl.js';

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function writeJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,x-hofs-access-mode,x-hofs-role,x-hofs-agent-id,x-hofs-user-id,x-hofs-signed-at,x-hofs-request-id,x-hofs-signature',
  });
  response.end(JSON.stringify(body));
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
  const enabled = Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions);
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

function createAutonomousSchedulerController({
  api,
  intervalMs = 60_000,
  now = () => new Date().toISOString(),
  trigger = 'http-autonomous-scheduler',
  source = 'http-autonomous-scheduler-chat',
  accessControl = {},
} = {}) {
  let timer = null;
  let running = false;
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
  });

  const runtimeHeaders = ({ method = 'POST', path = '/' } = {}) => {
    const baseHeaders = {
      'x-hofs-access-mode': 'enforced',
      'x-hofs-role': 'runtime-platform',
      'x-hofs-user-id': 'http-autonomous-scheduler',
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
      const projectResult = api.handle({
        method: 'POST',
        path: '/workers/autonomous/due',
        headers: runtimeHeaders({ method: 'POST', path: '/workers/autonomous/due' }),
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
      const agentResult = api.handle({
        method: 'POST',
        path: '/workers/agents/due',
        headers: runtimeHeaders({ method: 'POST', path: '/workers/agents/due' }),
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
      const shouldTickAutopilotSessions = Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions);
      const autopilotResult = shouldTickAutopilotSessions
        ? api.handle({
            method: 'POST',
            path: '/workers/autopilot/due',
            headers: runtimeHeaders({ method: 'POST', path: '/workers/autopilot/due' }),
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
        messageCount: (projectResult.body.messageCount || 0) + (agentResult.body.messageCount || 0) + (autopilotResult.body.messageCount || 0),
      };
      return {
        skipped: false,
        result: {
          ...projectResult.body,
          agentProcessed: agentResult.body.processed || [],
          agentSkipped: agentResult.body.skipped || [],
          agentMessages: agentResult.body.messages || [],
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
      tickAutopilotSessions: Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions),
      forceAutopilotRun: Boolean(input.tickAutopilotSessions || input.runAutopilotSessions || input.autopilotSessions) && Boolean(projectId),
      forceAutopilotProjectIds: projectId ? [projectId] : [],
      autopilotLoopCount: input.autopilotLoopCount || input.loopCount,
      autopilotIntervalMs: input.autopilotIntervalMs,
      maxAutopilotProjects: projectId ? 1 : input.maxAutopilotProjects,
      maxAutopilotSessionsPerProject: input.maxAutopilotSessionsPerProject,
      autopilotTargetKind: input.autopilotTargetKind || input.targetKind,
      autopilotRequestBodyOverrides: input.autopilotRequestBodyOverrides,
      includeReadModels,
    }).catch(() => {});
    if (timer) {
      state.lastStartedRunImmediately = Boolean(runImmediately);
      state.startupAgentControlSummary = summarizeSchedulerAgentControls(input);
      state.startupAutopilotControlSummary = summarizeSchedulerAutopilotControls(input);
      if (runImmediately) runImmediateStartupTick();
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
      runImmediateStartupTick();
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

  return {
    start,
    stop,
    tick,
    status,
  };
}

export function createAgentProjectHttpServer({
  api,
  filePath,
  securityAuditLogPath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  replaceWithSeed = false,
  autonomousScheduler = {},
  artifactWriter = null,
  projectRuntime = null,
  llmProvider = null,
  searchProvider = null,
  providerPolicy = {},
  secretVault = null,
  accessControl = {},
} = {}) {
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
    accessControl,
  });
  const scheduler = createAutonomousSchedulerController({
    api: resolvedApi,
    intervalMs: autonomousScheduler.intervalMs,
    now: autonomousScheduler.now,
    trigger: autonomousScheduler.trigger,
    source: autonomousScheduler.source,
    accessControl,
  });

  const server = createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
      writeJson(response, 204, {});
      return;
    }

    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const needsBody = ['POST', 'PUT', 'PATCH'].includes(request.method || '');
      const body = needsBody ? await readJsonBody(request) : {};
      if (url.pathname === '/workers/autonomous/status' && request.method === 'GET') {
        writeJson(response, 200, { scheduler: scheduler.status() });
        return;
      }
      if (url.pathname === '/workers/autonomous/start' && request.method === 'POST') {
        writeJson(response, 200, {
          scheduler: scheduler.start({
            ...body,
            runImmediately: Boolean(body.runImmediately),
            projectId: body.projectId || null,
            includeReadModels: body.includeReadModels,
          }),
        });
        return;
      }
      if (url.pathname === '/workers/autonomous/stop' && request.method === 'POST') {
        writeJson(response, 200, { scheduler: scheduler.stop() });
        return;
      }
      if (url.pathname === '/workers/autonomous/tick' && request.method === 'POST') {
        const tickResult = await scheduler.tick(body);
        writeJson(response, 200, tickResult);
        return;
      }
      const result = await (resolvedApi.handleAsync || resolvedApi.handle).call(resolvedApi, {
        method: request.method,
        path: url.pathname,
        headers: request.headers,
        body,
      });
      writeJson(response, result.status, result.body);
    } catch (error) {
      writeJson(response, 400, {
        error: 'agent-project-http-error',
        message: error.message || String(error),
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

  if (autonomousScheduler.enabled || autonomousScheduler.autoStart) {
    scheduler.start({
      ...autonomousScheduler,
      runImmediately: Boolean(autonomousScheduler.runImmediately),
    });
  }

  return {
    api: resolvedApi,
    scheduler,
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
    close() {
      scheduler.stop();
      return new Promise((resolve, reject) => {
        let settled = false;
        let closeIdleTimer = null;
        let forceCloseTimer = null;
        const settle = (error = null) => {
          if (settled) return;
          settled = true;
          if (closeIdleTimer) clearTimeout(closeIdleTimer);
          if (forceCloseTimer) clearTimeout(forceCloseTimer);
          if (error) reject(error);
          else resolve();
        };
        closeIdleTimer = setTimeout(() => {
          if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        }, 50);
        forceCloseTimer = setTimeout(() => {
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          sockets.forEach((socket) => socket.destroy());
          settle();
        }, 2500);
        server.close((error) => settle(error));
      });
    },
  };
}
