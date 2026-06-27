import { createAgentProjectService, hydrateAgentProject } from './agentProjectService.js';
import { createAgentProjectFileStore } from './agentProjectFileStore.js';
import { normalizeLanguage } from '../i18n/runtime.js';

const json = (status, body) => ({ status, body });

function normalizePath(path = '') {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function languageFromRequest(request = {}, body = {}) {
  try {
    const url = new URL(request.url || request.path || '/', 'http://127.0.0.1');
    return normalizeLanguage(body.language || url.searchParams.get('language'));
  } catch {
    return normalizeLanguage(body.language);
  }
}

function parseProjectRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  const rootIndex = parts.indexOf('projects');
  if (rootIndex < 0 || !parts[rootIndex + 1]) return null;
  return {
    projectId: decodeURIComponent(parts[rootIndex + 1]),
    action: parts[rootIndex + 2] || 'get',
    tail: parts.slice(rootIndex + 3),
  };
}

function parseWorkerRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  if (parts[0] !== 'workers') return null;
  return {
    worker: parts[1] || '',
    action: parts[2] || '',
  };
}

function parseKickoffMeetingRoute(path = '') {
  const parts = normalizePath(path).split('/').filter(Boolean);
  if (parts[0] !== 'kickoff-meetings') return null;
  return {
    meetingId: parts[1] ? decodeURIComponent(parts[1]) : null,
    action: parts[2] || 'get',
  };
}

function publicResult(result = {}) {
  return {
    route: result.route,
    project: result.project,
    meeting: result.meeting,
    messages: result.messages || [],
    messageCount: result.messages?.length || 0,
    readiness: result.readiness,
    cycle: result.cycle,
    responses: result.responses || {},
    roleNegotiation: result.roleNegotiation,
    leaderElection: result.leaderElection,
    kickoffCharter: result.kickoffCharter,
    assignmentPackage: result.assignmentPackage,
    agent: result.agent,
    log: result.log,
    task: result.task,
    modelKickoffMeeting: result.modelKickoffMeeting,
  };
}

export function createAgentProjectApi({ service } = {}) {
  if (!service) throw new Error('createAgentProjectApi requires a service.');

  const publicProjectResult = (result = {}, projectId = result.project?.id, language = result.project?.language || result.language) => ({
    ...publicResult(result),
    // Compatibility proof anchors: managerDashboard: projectId ? service.getManagerDashboard(projectId) : null / managerReadyPackage: projectId ? service.getManagerReadyPackage(projectId) : null
    managerDashboard: projectId ? service.getManagerDashboard(projectId, { language }) : null,
    managerReadyPackage: projectId ? service.getManagerReadyPackage(projectId, { language }) : null,
  });

  return {
    async handleAsync(request = {}) {
      const method = String(request.method || 'GET').toUpperCase();
      const path = normalizePath(request.path || request.url || '/');
      const body = request.body || {};
      const language = languageFromRequest(request, body);
      const kickoffMeetingRoute = parseKickoffMeetingRoute(path);

      if (method === 'POST' && path === '/llm/test') {
        if (typeof service.testModelProvider !== 'function') {
          return json(400, { error: 'model-provider-not-configured' });
        }
        const testResult = await service.testModelProvider(body);
        return json(testResult.ok ? 200 : 400, testResult);
      }

      if (method === 'POST' && kickoffMeetingRoute && !kickoffMeetingRoute.meetingId) {
        try {
          if (typeof service.createKickoffMeetingAsync !== 'function') {
            throw new Error('model-kickoff-meeting-not-supported');
          }
          if (body.forceDeterministicFallback) {
            throw new Error('deterministic-kickoff-meeting-requested');
          }
          return json(200, publicResult(await service.createKickoffMeetingAsync({
            ...body,
            language,
          })));
        } catch (error) {
          if (body.allowDeterministicFallback === false) {
            return json(400, {
              error: 'model-kickoff-meeting-failed',
              message: error.message || String(error),
              modelProvider: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
            });
          }
          const fallbackResult = service.createKickoffMeeting({
            ...body,
            language,
            allowDeterministicFallback: true,
          });
          return json(200, publicResult({
            ...fallbackResult,
            modelKickoffMeeting: {
              ok: false,
              fallback: true,
              error: error.message || String(error),
              modelProvider: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
            },
          }));
        }
      }

      const result = this.handle(request);
      if (
        result.status >= 400
        || typeof service.enrichCommandResultWithModelIntent !== 'function'
        || method !== 'POST'
        || !result.body?.project?.id
      ) {
        return result;
      }

      const route = parseProjectRoute(path);
      const enrichedBody = await service.enrichCommandResultWithModelIntent({
        projectId: result.body.project.id || route?.projectId,
        result: result.body,
        command: `${method} ${path}`,
        input: body,
        now: body.now || new Date().toISOString(),
      });
      if (!enrichedBody?.project?.id) return result;
      return json(result.status, {
        ...result.body,
        ...enrichedBody,
        managerDashboard: service.getManagerDashboard(enrichedBody.project.id, { language }),
        managerReadyPackage: service.getManagerReadyPackage(enrichedBody.project.id, { language }),
      });
    },
    handle(request = {}) {
      const method = String(request.method || 'GET').toUpperCase();
      const path = normalizePath(request.path || request.url || '/');
      const body = request.body || {};
      const language = languageFromRequest(request, body);
      const route = parseProjectRoute(path);
      const workerRoute = parseWorkerRoute(path);
      const kickoffMeetingRoute = parseKickoffMeetingRoute(path);

      try {
        if (method === 'GET' && path === '/projects') {
          return json(200, { projects: service.listProjects() });
        }
        if (method === 'POST' && path === '/projects/initiate') {
          const result = service.initiateProject(body);
          return json(200, publicProjectResult(result, result.project?.id, language));
        }
        if (method === 'GET' && path === '/snapshot') {
          return json(200, service.snapshot());
        }
        if (method === 'GET' && path === '/llm/status') {
          return json(200, {
            modelProvider: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
          });
        }
        if (kickoffMeetingRoute) {
          if (method === 'GET' && !kickoffMeetingRoute.meetingId) {
            return json(200, { kickoffMeetings: service.listKickoffMeetings() });
          }
          if (method === 'POST' && !kickoffMeetingRoute.meetingId) {
            return json(200, publicResult(service.createKickoffMeeting({
              ...body,
              allowDeterministicFallback: true,
            })));
          }
          if (!kickoffMeetingRoute.meetingId) {
            return json(405, { error: 'method-not-allowed', method, path });
          }
          if (method === 'GET' && kickoffMeetingRoute.action === 'get') {
            return json(200, { meeting: service.getKickoffMeeting(kickoffMeetingRoute.meetingId) });
          }
          if (method === 'POST' && kickoffMeetingRoute.action === 'clarify') {
            return json(200, publicResult(service.clarifyKickoffMeeting({
              meetingId: kickoffMeetingRoute.meetingId,
              ...body,
            })));
          }
          if (method === 'POST' && kickoffMeetingRoute.action === 'leader') {
            return json(200, publicResult(service.confirmKickoffMeetingLeader({
              meetingId: kickoffMeetingRoute.meetingId,
              ...body,
            })));
          }
          if (method === 'POST' && kickoffMeetingRoute.action === 'next-actions') {
            return json(200, publicResult(service.confirmKickoffMeetingNextActions({
              meetingId: kickoffMeetingRoute.meetingId,
              ...body,
            })));
          }
          if (method === 'POST' && kickoffMeetingRoute.action === 'approve') {
            const result = service.approveKickoffMeeting({
              meetingId: kickoffMeetingRoute.meetingId,
              ...body,
            });
            return json(200, publicProjectResult(result, result.project?.id));
          }
          return json(404, { error: 'kickoff-meeting-route-not-found', path });
        }
        if (method === 'POST' && workerRoute?.worker === 'autonomous' && workerRoute.action === 'due') {
          const result = service.runDueAutonomousCycles(body);
          return json(200, {
            // Compatibility proof anchors: managerDashboard: service.getManagerDashboard(item.projectId) / managerReadyPackage: service.getManagerReadyPackage(item.projectId)
            processed: result.processed.map((item) => ({
              projectId: item.projectId,
              cadence: item.cadence,
              reason: item.reason,
              dueAt: item.dueAt,
              nextRunAt: item.nextRunAt,
              messageCount: item.result.messages.length,
              project: item.result.project,
              managerDashboard: service.getManagerDashboard(item.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(item.projectId, { language }),
            })),
            skipped: result.skipped,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (method === 'POST' && workerRoute?.worker === 'agents' && workerRoute.action === 'due') {
          const result = service.runDueAgentWorkCycles(body);
          return json(200, {
            processed: result.processed.map((item) => ({
              projectId: item.projectId,
              agentId: item.agentId,
              reason: item.reason,
              dueAt: item.dueAt,
              nextRunAt: item.nextRunAt,
              managementPriority: item.managementPriority || 0,
              managementReasons: item.managementReasons || [],
              messageCount: item.result.messages.length,
              project: item.result.project,
              agent: item.result.agent,
              task: item.result.task,
              managerDashboard: service.getManagerDashboard(item.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(item.projectId, { language }),
            })),
            skipped: result.skipped,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (!route) {
          return json(404, { error: 'not-found', path });
        }

        if (method === 'GET' && route.action === 'get') {
          return json(200, {
            project: service.getProject(route.projectId),
            messages: service.getMessages(route.projectId),
          });
        }
        if (method === 'GET' && route.action === 'messages') {
          return json(200, { messages: service.getMessages(route.projectId) });
        }
        if (method === 'GET' && route.action === 'transcripts') {
          if (!route.tail.length) {
            return json(200, service.getTranscriptIndex(route.projectId));
          }
          const channelId = decodeURIComponent(route.tail[0]);
          return json(200, service.getChannelTranscript(route.projectId, channelId));
        }
        if (method === 'GET' && route.action === 'timeline') {
          return json(200, service.getTimeline(route.projectId));
        }
        if (method === 'GET' && route.action === 'events') {
          return json(200, service.getEventLedger(route.projectId));
        }
        if (method === 'GET' && route.action === 'local-runtime') {
          return json(200, service.getLocalRuntime(route.projectId));
        }
        if (method === 'POST' && route.action === 'local-runtime' && route.tail[0] === 'archive') {
          const result = service.archiveProject({ projectId: route.projectId, ...body });
          return json(200, {
            route: 'project-archived',
            project: result.project,
            localRuntime: result.localRuntime,
          });
        }
        if (route.action === 'workspace') {
          if (method === 'POST' && route.tail[0] === 'bind') {
            const result = service.bindProjectWorkspace({ projectId: route.projectId, ...body });
            return json(200, {
              route: 'workspace-bound',
              project: result.project,
              localRuntime: result.localRuntime,
            });
          }
          if (method === 'POST' && route.tail[0] === 'list') {
            return json(200, service.listWorkspaceFiles({ projectId: route.projectId, ...body }));
          }
          if (method === 'POST' && route.tail[0] === 'read') {
            return json(200, service.readWorkspaceFile({ projectId: route.projectId, ...body }));
          }
          if (method === 'POST' && route.tail[0] === 'write') {
            return json(200, service.writeWorkspaceFile({ projectId: route.projectId, ...body }));
          }
          if (method === 'POST' && route.tail[0] === 'delete') {
            return json(200, service.deleteWorkspacePath({ projectId: route.projectId, ...body }));
          }
          if (method === 'POST' && route.tail[0] === 'exec') {
            return json(200, service.executeWorkspaceCommand({ projectId: route.projectId, ...body }));
          }
          return json(404, { error: 'workspace-route-not-found', path });
        }
        if (method === 'GET' && route.action === 'tasks') {
          if (!route.tail.length) {
            return json(200, { tasks: service.listTasks(route.projectId) });
          }
          const taskId = decodeURIComponent(route.tail[0]);
          const section = route.tail[1] || 'task';
          if (section === 'task') return json(200, { task: service.getTask(route.projectId, taskId) });
          if (section === 'evidence') return json(200, service.getTaskEvidence(route.projectId, taskId));
          return json(404, { error: 'task-section-not-found', section });
        }
        if (route.action === 'agents') {
          if (method === 'GET' && !route.tail.length) {
            return json(200, { agents: service.listAgentStates(route.projectId) });
          }
          if (!route.tail.length) {
            return json(405, { error: 'method-not-allowed', method, path });
          }
          const agentId = decodeURIComponent(route.tail[0]);
          if (method === 'POST' && route.tail[1] === 'message') {
            const result = service.submitAgentMessage({ projectId: route.projectId, agentId, ...body });
            return json(200, {
              ...publicProjectResult(result, route.projectId, language),
              agentDashboard: service.getAgentDashboard(route.projectId, agentId),
            });
          }
          if (method === 'POST' && route.tail[1] === 'work-cycle') {
            const result = service.runAgentWorkCycle({ projectId: route.projectId, agentId, ...body });
            return json(200, publicProjectResult(result, route.projectId));
          }
          if (method !== 'GET') {
            return json(405, { error: 'method-not-allowed', method, path });
          }
          const section = route.tail[1] || 'state';
          if (section === 'dashboard') return json(200, service.getAgentDashboard(route.projectId, agentId));
          const state = service.getAgentState(route.projectId, agentId);
          if (section === 'state') return json(200, { agent: state });
          if (section === 'inbox') return json(200, { agentId: state.agentId, inbox: state.inbox || [] });
          if (section === 'worklog') return json(200, { agentId: state.agentId, worklog: state.worklog || [] });
          if (section === 'obligations') return json(200, { agentId: state.agentId, obligations: state.obligations || [] });
          if (section === 'plan') return json(200, { agentId: state.agentId, currentPlan: state.currentPlan || null });
          return json(404, { error: 'agent-section-not-found', section });
        }
        if (method === 'GET' && route.action === 'readiness') {
          return json(200, { readiness: service.evaluateReadiness(route.projectId) });
        }
        if (method === 'GET' && route.action === 'readiness-proof-map') {
          return json(200, service.getReadinessProofMap(route.projectId));
        }
        if (method === 'GET' && route.action === 'manager-dashboard') {
          return json(200, service.getManagerDashboard(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-flow-graph') {
          return json(200, service.getManagerFlowGraph(route.projectId, { language }));
        }
        if (method === 'POST' && route.action === 'manager-flow-graph' && route.tail[0] === 'nodes' && route.tail[2] === 'confirm') {
          const nodeId = decodeURIComponent(route.tail[1] || '');
          const result = service.confirmManagerFlowGraphNode({
            projectId: route.projectId,
            nodeId,
            ...body,
          });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            managerFlowGraph: result.managerFlowGraph,
            managerFlowGraphConfirmation: result.confirmation,
            managerDashboard: service.getManagerDashboard(result.project?.id || route.projectId, { language }),
            managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'manager-ready-package') {
          return json(200, service.getManagerReadyPackage(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-command-center') {
          return json(200, service.getManagerCommandCenter(route.projectId, { language }));
        }
        if (method === 'POST' && route.action === 'manager-command-center' && route.tail[0] === 'run-next') {
          const result = service.runManagerCommandCenterNext({
            projectId: route.projectId,
            ...body,
          });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionLog: result.managerActionLog,
            managerActionQueue: result.managerActionQueue,
            managerCommandCenter: result.managerCommandCenter,
            managerCommandCenterRun: result.managerCommandCenterRun,
          });
        }
        if (method === 'GET' && route.action === 'manager-scenario-trail') {
          return json(200, service.getManagerScenarioTrail(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-scenario-walkthrough') {
          return json(200, service.getManagerScenarioWalkthrough(route.projectId, { language }));
        }
        if (method === 'POST' && route.action === 'manager-scenario-walkthrough' && route.tail[1] === 'run') {
          const result = service.runManagerScenarioWalkthroughStep({
            projectId: route.projectId,
            stepId: decodeURIComponent(route.tail[0] || 'next'),
            ...body,
          });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionLog: result.managerActionLog,
            managerActionQueue: result.managerActionQueue,
            managerScenarioWalkthrough: result.managerScenarioWalkthrough,
            managerScenarioWalkthroughStep: result.managerScenarioWalkthroughStep,
          });
        }
        if (method === 'GET' && route.action === 'manager-requirement-matrix') {
          return json(200, service.getManagerRequirementMatrix(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-use-case-audit') {
          return json(200, service.getManagerUseCaseAudit(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-action-queue') {
          return json(200, service.getManagerActionQueue(route.projectId, { language }));
        }
        if (method === 'POST' && route.action === 'manager-action-queue' && route.tail[1] === 'run') {
          const result = service.runManagerActionQueueItem({
            projectId: route.projectId,
            actionId: decodeURIComponent(route.tail[0] || 'next'),
            ...body,
          });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionLog: result.managerActionLog,
            managerActionQueue: result.managerActionQueue,
          });
        }
        if (method === 'PUT' && route.action === 'get') {
          return json(200, { project: service.replaceProject(body.project) });
        }
        if (method === 'POST' && route.action === 'chat') {
          const result = service.submitChatMessage({ projectId: route.projectId, ...body });
          return json(200, publicProjectResult(result, route.projectId, language));
        }
        if (method === 'POST' && route.action === 'meeting') {
          const result = service.submitMeetingMessage({ projectId: route.projectId, ...body });
          return json(200, publicProjectResult(result, route.projectId, language));
        }
        if (method === 'POST' && route.action === 'change-request') {
          const result = service.submitMultiChannelChangeRequest({ projectId: route.projectId, ...body });
          return json(200, publicProjectResult(result, route.projectId, language));
        }
        if (method === 'POST' && route.action === 'autonomous-cycle') {
          const result = service.runAutonomousCycle({ projectId: route.projectId, ...body });
          return json(200, publicProjectResult(result, route.projectId, language));
        }

        return json(405, { error: 'method-not-allowed', method, path });
      } catch (error) {
        return json(error.message?.includes('not found') ? 404 : 400, {
          error: 'agent-project-api-error',
          message: error.message || String(error),
        });
      }
    },
  };
}

export function createFileBackedAgentProjectApi({
  filePath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  replaceWithSeed = false,
  artifactWriter = null,
  projectRuntime = null,
  llmProvider = null,
} = {}) {
  const store = createAgentProjectFileStore({
    filePath,
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    hydrateProject: hydrateAgentProject,
    replaceWithSeed,
  });
  const service = createAgentProjectService({ store, artifactWriter, projectRuntime, llmProvider });
  const api = createAgentProjectApi({ service });

  return {
    ...api,
    service,
    store,
  };
}
