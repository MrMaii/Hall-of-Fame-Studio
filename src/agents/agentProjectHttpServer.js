import { createServer } from 'node:http';
import { createFileBackedAgentProjectApi } from './agentProjectApi.js';

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
    'access-control-allow-headers': 'content-type',
  });
  response.end(JSON.stringify(body));
}

function createAutonomousSchedulerController({
  api,
  intervalMs = 60_000,
  now = () => new Date().toISOString(),
  trigger = 'http-autonomous-scheduler',
  source = 'http-autonomous-scheduler-chat',
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
    messageCount: 0,
    lastStartedRunImmediately: false,
    lastResult: null,
  };

  const status = () => ({
    ...state,
    running,
  });

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
    try {
      const projectResult = api.handle({
        method: 'POST',
        path: '/workers/autonomous/due',
        body: {
          now: tickAt,
          trigger: input.trigger || state.trigger,
          source: input.source || state.source,
          forceDue: Boolean(input.forceProjectRun),
          forceReason: input.forceProjectRun ? (input.forceReason || 'scheduler-start-project-sweep') : undefined,
          forceProjectIds: input.forceProjectIds || [],
        },
      });
      if (projectResult.status >= 400) {
        throw new Error(projectResult.body?.message || projectResult.body?.error || `Autonomous worker returned ${projectResult.status}.`);
      }
      const agentResult = api.handle({
        method: 'POST',
        path: '/workers/agents/due',
        body: {
          now: tickAt,
          trigger: input.agentTrigger || `${input.trigger || state.trigger}-agents`,
          intervalMs: input.agentIntervalMs,
          maxAgentsPerProject: input.maxAgentsPerProject,
          maxProjects: input.maxAgentProjects,
          forceDue: Boolean(input.forceAgentRun),
          forceReason: input.forceAgentRun ? 'scheduler-start-agent-sweep' : undefined,
          forceProjectIds: input.forceAgentProjectIds || [],
        },
      });
      if (agentResult.status >= 400) {
        throw new Error(agentResult.body?.message || agentResult.body?.error || `Agent worker returned ${agentResult.status}.`);
      }
      state.tickCount += 1;
      state.processedCount += projectResult.body.processed?.length || 0;
      state.skippedCount += projectResult.body.skipped?.length || 0;
      state.agentProcessedCount += agentResult.body.processed?.length || 0;
      state.agentSkippedCount += agentResult.body.skipped?.length || 0;
      state.messageCount += (projectResult.body.messageCount || 0) + (agentResult.body.messageCount || 0);
      state.lastCompletedAt = now();
      state.lastError = null;
      state.lastResult = {
        processed: projectResult.body.processed || [],
        skipped: projectResult.body.skipped || [],
        agentsProcessed: agentResult.body.processed || [],
        agentsSkipped: agentResult.body.skipped || [],
        messageCount: (projectResult.body.messageCount || 0) + (agentResult.body.messageCount || 0),
      };
      return {
        skipped: false,
        result: {
          ...projectResult.body,
          agentProcessed: agentResult.body.processed || [],
          agentSkipped: agentResult.body.skipped || [],
          agentMessages: agentResult.body.messages || [],
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

  const start = ({ runImmediately = false, projectId = null } = {}) => {
    if (timer) return status();
    state.enabled = true;
    state.startedAt = now();
    state.stoppedAt = null;
    state.lastStartedRunImmediately = Boolean(runImmediately);
    timer = setInterval(() => {
      tick().catch(() => {});
    }, state.intervalMs);
    if (typeof timer.unref === 'function') timer.unref();
    if (runImmediately) {
      tick({
        forceProjectRun: Boolean(projectId),
        forceProjectIds: projectId ? [projectId] : [],
        forceAgentRun: true,
        forceAgentProjectIds: projectId ? [projectId] : [],
        maxAgentProjects: projectId ? Infinity : 1,
        trigger: 'manager-ui-scheduler-start-pulse',
        source: 'manager-ui-scheduler-start-chat',
        forceReason: 'backend-scheduler-start-first-work',
        agentTrigger: 'http-autonomous-scheduler-startup-agents',
      }).catch(() => {});
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
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  replaceWithSeed = false,
  autonomousScheduler = {},
  artifactWriter = null,
} = {}) {
  const resolvedApi = api || createFileBackedAgentProjectApi({
    filePath,
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    replaceWithSeed,
    artifactWriter,
  });
  const scheduler = createAutonomousSchedulerController({
    api: resolvedApi,
    intervalMs: autonomousScheduler.intervalMs,
    now: autonomousScheduler.now,
    trigger: autonomousScheduler.trigger,
    source: autonomousScheduler.source,
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
        writeJson(response, 200, { scheduler: scheduler.start({ runImmediately: Boolean(body.runImmediately), projectId: body.projectId || null }) });
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
      const result = resolvedApi.handle({
        method: request.method,
        path: url.pathname,
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

  if (autonomousScheduler.enabled || autonomousScheduler.autoStart) {
    scheduler.start({ runImmediately: Boolean(autonomousScheduler.runImmediately) });
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
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
