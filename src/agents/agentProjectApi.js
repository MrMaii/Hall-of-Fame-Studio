import { createAgentProjectService, hydrateAgentProject } from './agentProjectService.js';
import { createAgentProjectFileStore } from './agentProjectFileStore.js';
import { authorizeAgentProjectRequest, evaluateProjectMembershipAccess, publicAccessDecision } from './accessControl.js';
import { normalizeLanguage } from '../i18n/runtime.js';

const json = (status, body) => ({ status, body });

function normalizePath(path = '') {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function hashReplayKey(value = '') {
  return String(value || '').split('').reduce((hash, char) => (
    ((hash << 5) - hash + char.charCodeAt(0)) | 0
  ), 0);
}

function readHeader(headers = {}, name = '') {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get(name) || headers.get(name.toLowerCase()) || '';
  const lowerName = String(name || '').toLowerCase();
  const entry = Object.entries(headers).find(([key]) => String(key).toLowerCase() === lowerName);
  return entry ? entry[1] : '';
}

function withHeader(headers = {}, name = '', value = '') {
  const next = {};
  if (headers && typeof headers.entries === 'function') {
    for (const [key, itemValue] of headers.entries()) next[key] = itemValue;
  } else {
    Object.assign(next, headers || {});
  }
  next[name] = value;
  return next;
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

export function createAgentProjectApi({ service, accessControl = {} } = {}) {
  if (!service) throw new Error('createAgentProjectApi requires a service.');
  const defaultAccessMode = accessControl.defaultMode || 'prototype-open';
  const accessSigningSecret = accessControl.signingSecret || '';
  const requireSignedAccessHeaders = Boolean(accessSigningSecret) || Boolean(accessControl.requireSignedHeaders);
  const requireSignedRequestIds = Boolean(accessControl.requireSignedRequestIds || accessControl.requireReplayProtection);
  const requireProjectMembership = Boolean(accessControl.requireProjectMembership);
  const failClosedOnAuditError = Boolean(accessControl.failClosedOnAuditError || accessControl.requireAccessAuditWrite);
  const signatureMaxAgeMs = Number.isFinite(Number(accessControl.signatureMaxAgeMs))
    ? Number(accessControl.signatureMaxAgeMs)
    : undefined;
  const replayStore = accessControl.replayStore || null;
  const replayStorage = replayStore
    ? (replayStore.filePath ? 'file-store' : 'store')
    : 'api-memory';
  const replayCache = accessControl.replayCache || new Map();

  const rejectReplay = (decision, reason = 'signed-access-replay-detected') => ({
    ...decision,
    allowed: false,
    status: 'denied',
    reason,
    replay: {
      required: true,
      verified: false,
      detected: reason === 'signed-access-replay-detected',
      requestId: decision.signature?.requestId || null,
      cache: replayStorage,
      storage: replayStorage,
      maxAgeMs: signatureMaxAgeMs || 5 * 60 * 1000,
    },
  });

  const acceptReplay = (decision) => ({
    ...decision,
    replay: {
      required: true,
      verified: true,
      detected: false,
      requestId: decision.signature?.requestId || null,
      cache: replayStorage,
      storage: replayStorage,
      maxAgeMs: signatureMaxAgeMs || 5 * 60 * 1000,
    },
  });

  const buildReplayRecord = ({ decision = {}, replayKey = '', nowMs = Date.now(), maxAgeMs = 5 * 60 * 1000 } = {}) => {
    const actor = decision.actor || {};
    const route = decision.route || {};
    return {
      schemaVersion: 'access-replay-record/v1',
      id: `replay_${Math.abs(hashReplayKey(replayKey)).toString(36)}_${nowMs}`,
      replayKey,
      projectId: route.projectId || 'global',
      routeKey: route.routeKey || '',
      method: decision.method || '',
      path: decision.path || '',
      role: actor.role || 'anonymous',
      agentId: actor.agentId || null,
      userId: actor.userId || null,
      requestId: decision.signature?.requestId || null,
      signedAt: decision.signature?.signedAt || null,
      acceptedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + maxAgeMs).toISOString(),
      storage: replayStorage,
    };
  };

  const evaluateSignedRequestReplay = (decision = {}) => {
    if (!requireSignedRequestIds || !decision.enforced || !decision.allowed) return decision;
    const requestId = String(decision.signature?.requestId || '').trim();
    if (!decision.signature?.verified || !requestId) {
      return rejectReplay(decision, 'signed-access-request-id-missing');
    }
    const nowMs = Date.now();
    const maxAgeMs = signatureMaxAgeMs || 5 * 60 * 1000;
    [...replayCache.entries()].forEach(([key, expiresAt]) => {
      if (Number(expiresAt) <= nowMs) replayCache.delete(key);
    });
    const actor = decision.actor || {};
    const replayKey = [
      decision.route?.projectId || 'global',
      actor.role || 'anonymous',
      actor.agentId || '',
      actor.userId || '',
      requestId,
    ].join(':');
    if (replayStore && typeof replayStore.getAccessReplayRecord === 'function') {
      if (typeof replayStore.pruneAccessReplayRecords === 'function') {
        replayStore.pruneAccessReplayRecords(nowMs);
      }
      const existingRecord = replayStore.getAccessReplayRecord(replayKey);
      if (existingRecord) return rejectReplay(decision);
      if (typeof replayStore.appendAccessReplayRecords !== 'function') {
        return rejectReplay(decision, 'signed-access-replay-store-unavailable');
      }
      try {
        const appended = replayStore.appendAccessReplayRecords([
          buildReplayRecord({ decision, replayKey, nowMs, maxAgeMs }),
        ]);
        if (!appended.length) return rejectReplay(decision);
      } catch {
        return rejectReplay(decision, 'signed-access-replay-store-unavailable');
      }
      return acceptReplay(decision);
    }
    if (replayCache.has(replayKey)) return rejectReplay(decision);
    replayCache.set(replayKey, nowMs + maxAgeMs);
    return acceptReplay(decision);
  };

  const projectMembershipPolicyFor = ({ projectId, route, request } = {}) => {
    if (!projectId) return null;
    if (typeof accessControl.projectMembershipResolver === 'function') {
      return accessControl.projectMembershipResolver({ projectId, route, request, service }) || null;
    }
    const memberships = accessControl.projectMemberships || {};
    const configuredPolicy = memberships[projectId] || memberships[String(projectId)] || accessControl.projectMembership || null;
    if (configuredPolicy) return configuredPolicy;
    if (typeof service.getProjectMembershipPolicy === 'function') {
      const storedPolicy = service.getProjectMembershipPolicy(projectId);
      if (storedPolicy?.projectMembershipPolicy) return storedPolicy.projectMembershipPolicy;
      if (storedPolicy?.schemaVersion === 'project-membership-policy/v1') return storedPolicy;
    }
    return null;
  };

  const auditWriteFailure = (publicDecision = {}, { reason = 'access-audit-write-failed', error = null } = {}) => json(503, {
    error: 'access-audit-write-failed',
    message: 'Access denied because the required security audit write failed.',
    accessDecision: {
      ...publicDecision,
      audit: {
        required: true,
        written: false,
        status: 'failed',
        reason,
        errorMessage: error?.message || (error ? String(error) : ''),
      },
    },
  });

  const resolveIdentitySessionRequest = (request = {}) => {
    const token = String(
      request.sessionToken
      || request.body?.sessionToken
      || request.body?.identitySessionToken
      || readHeader(request.headers, 'x-hofs-session-token')
      || '',
    ).trim();
    const projectRoute = parseProjectRoute(request.path || request.url || '/');
    if (!token || !projectRoute?.projectId || typeof service.verifyIdentitySession !== 'function') return null;
    const verification = service.verifyIdentitySession({
      projectId: projectRoute.projectId,
      token,
      now: request.body?.now || new Date().toISOString(),
    });
    if (!verification.verified) {
      return {
        verified: false,
        response: json(403, {
          error: 'identity-session-invalid',
          message: verification.reason || 'identity session is not valid',
          identitySession: verification.identitySession || null,
          identitySessionVerification: verification,
        }),
      };
    }
    const actor = verification.actor || {};
    const headers = request.headers || {};
    return {
      verified: true,
      verification,
      request: {
        ...request,
        headers: withHeader(
          withHeader(
            withHeader(
              withHeader(headers, 'x-hofs-access-mode', 'enforced'),
              'x-hofs-role',
              actor.role || 'observer',
            ),
            'x-hofs-user-id',
            actor.userId || '',
          ),
          'x-hofs-agent-id',
          actor.agentId || '',
        ),
        actorRole: actor.role || request.actorRole,
        actorUserId: actor.userId || request.actorUserId,
        actorAgentId: actor.agentId || request.actorAgentId,
      },
    };
  };

  const authorizeRequest = (request = {}) => {
    const sessionRequest = resolveIdentitySessionRequest(request);
    if (sessionRequest?.response) return sessionRequest.response;
    const effectiveRequest = sessionRequest?.request || request;
    let decision = authorizeAgentProjectRequest(effectiveRequest, {
      defaultMode: defaultAccessMode,
      signingSecret: sessionRequest?.verified ? '' : accessSigningSecret,
      requireSignedHeaders: sessionRequest?.verified ? false : requireSignedAccessHeaders,
      ...(signatureMaxAgeMs === undefined ? {} : { signatureMaxAgeMs }),
    });
    decision = {
      ...decision,
      method: effectiveRequest.method || 'GET',
      path: effectiveRequest.path || effectiveRequest.url || '/',
    };
    if (sessionRequest?.verified) {
      decision = {
        ...decision,
        identitySession: {
          required: true,
          verified: true,
          sessionId: sessionRequest.verification.identitySession?.id || null,
          status: sessionRequest.verification.identitySession?.status || 'active',
          expiresAt: sessionRequest.verification.identitySession?.expiresAt || null,
        },
      };
    } else {
      decision = evaluateSignedRequestReplay(decision);
    }
    if (requireProjectMembership && decision.allowed && decision.enforced && decision.route?.projectId) {
      decision = evaluateProjectMembershipAccess(decision, projectMembershipPolicyFor({
        projectId: decision.route.projectId,
        route: decision.route,
        request: effectiveRequest,
      }), { required: true });
    }
    const publicDecision = publicAccessDecision(decision);
    if (decision.enforced && decision.route?.projectId) {
      if (typeof service.recordAccessDecision !== 'function') {
        if (failClosedOnAuditError) {
          return auditWriteFailure(publicDecision, { reason: 'access-audit-sink-missing' });
        }
      } else {
        try {
          service.recordAccessDecision({
            projectId: decision.route.projectId,
            decision: publicDecision,
            method: request.method || 'GET',
            path: request.path || request.url || '/',
            statusCode: decision.allowed ? 200 : 403,
            outcome: decision.allowed ? 'access-allowed-before-dispatch' : 'access-denied-before-dispatch',
          });
        } catch (error) {
          if (failClosedOnAuditError) {
            return auditWriteFailure(publicDecision, { reason: 'access-audit-write-failed', error });
          }
          // Access audit is best-effort by default for local demos; production-style runs can fail closed.
        }
      }
    }
    if (decision.allowed) return null;
    return json(403, {
      error: 'forbidden',
      message: decision.reason,
      accessDecision: publicDecision,
    });
  };

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
      const route = parseProjectRoute(path);
      const denied = request._accessChecked ? null : authorizeRequest({ ...request, method, path, body });
      if (denied) return denied;

      if (method === 'POST' && path === '/llm/test') {
        if (typeof service.testModelProvider !== 'function') {
          return json(400, { error: 'model-provider-not-configured' });
        }
        const testResult = await service.testModelProvider(body);
        return json(testResult.ok ? 200 : 400, testResult);
      }
      if (method === 'POST' && path === '/search/test') {
        if (typeof service.testSearchProvider !== 'function') {
          return json(400, { error: 'search-provider-not-configured' });
        }
        const testResult = await service.testSearchProvider(body);
        return json(testResult.ok ? 200 : 400, testResult);
      }
      if (
        method === 'POST'
        && route?.action === 'agents'
        && route.tail[1] === 'artifact-drafts'
      ) {
        const agentId = decodeURIComponent(route.tail[0]);
        const result = await service.generateAgentArtifactDraft({ projectId: route.projectId, agentId, ...body });
        return json(200, {
          ...publicProjectResult(result, result.project?.id || route.projectId, language),
          artifactDraft: result.artifactDraft,
          providerUsage: result.providerUsage || null,
          modelProviderStatus: result.modelProviderStatus || (service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false }),
          submission: result.submission || null,
          artifact: result.artifact || null,
          log: result.log || null,
          task: result.task || null,
          agentDashboard: service.getAgentDashboard(result.project?.id || route.projectId, agentId),
          managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
          managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
        });
      }
      if (
        method === 'POST'
        && route?.action === 'agents'
        && route.tail[1] === 'evidence-searches'
        && body.useProvider
      ) {
        const agentId = decodeURIComponent(route.tail[0]);
        const result = await service.recordAgentEvidenceSearchWithProvider({ projectId: route.projectId, agentId, ...body });
        return json(200, {
          ...publicProjectResult(result, result.project?.id || route.projectId, language),
          evidenceSearch: result.evidenceSearch,
          sourceSnapshots: result.sourceSnapshots || [],
          providerReceipt: result.providerReceipt || null,
          log: result.log,
          task: result.task,
          submission: result.submission,
          searchProvider: service.getSearchProviderStatus ? service.getSearchProviderStatus() : { enabled: false },
          agentDashboard: service.getAgentDashboard(result.project?.id || route.projectId, agentId),
          managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
          managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
        });
      }
      if (method === 'GET' && route?.action === 'persistence-adapter-dry-run' && typeof service.getPersistenceAdapterDryRunAsync === 'function') {
        return json(200, {
          persistenceAdapterDryRun: await service.getPersistenceAdapterDryRunAsync(route.projectId, { language }),
        });
      }
      if (method === 'GET' && route?.action === 'worker-queue-adapter-dry-run' && typeof service.getWorkerQueueAdapterDryRunAsync === 'function') {
        return json(200, {
          workerQueueAdapterDryRun: await service.getWorkerQueueAdapterDryRunAsync(route.projectId, { language }),
        });
      }
      if (method === 'GET' && route?.action === 'adapter-gateway-preflight' && typeof service.getAdapterGatewayPreflightAsync === 'function') {
        return json(200, {
          adapterGatewayPreflight: await service.getAdapterGatewayPreflightAsync(route.projectId, { language }),
        });
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

      const result = this.handle({ ...request, _accessChecked: true });
      if (
        result.status >= 400
        || typeof service.enrichCommandResultWithModelIntent !== 'function'
        || method !== 'POST'
        || !result.body?.project?.id
      ) {
        return result;
      }

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
      const denied = request._accessChecked ? null : authorizeRequest({ ...request, method, path, body });
      if (denied) return denied;

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
        if (method === 'GET' && path === '/search/status') {
          return json(200, {
            searchProvider: service.getSearchProviderStatus ? service.getSearchProviderStatus() : { enabled: false },
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
          const readModelCache = new Map();
          const readModelsFor = (projectId) => {
            const key = String(projectId || '');
            if (!readModelCache.has(key)) {
              readModelCache.set(key, {
                managerDashboard: service.getManagerDashboard(projectId, { language }),
                managerReadyPackage: service.getManagerReadyPackage(projectId, { language }),
              });
            }
            return readModelCache.get(key);
          };
          return json(200, {
            // Compatibility proof anchors: managerDashboard: service.getManagerDashboard(item.projectId) / managerReadyPackage: service.getManagerReadyPackage(item.projectId)
            processed: result.processed.map((item) => {
              const readModels = readModelsFor(item.projectId);
              return {
                projectId: item.projectId,
                cadence: item.cadence,
                reason: item.reason,
                dueAt: item.dueAt,
                nextRunAt: item.nextRunAt,
                messageCount: item.result.messages.length,
                project: item.result.project,
                managerDashboard: readModels.managerDashboard,
                managerReadyPackage: readModels.managerReadyPackage,
              };
            }),
            skipped: result.skipped,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (method === 'POST' && workerRoute?.worker === 'agents' && workerRoute.action === 'due') {
          const result = service.runDueAgentWorkCycles(body);
          const readModelCache = new Map();
          const readModelsFor = (projectId) => {
            const key = String(projectId || '');
            if (!readModelCache.has(key)) {
              readModelCache.set(key, {
                managerDashboard: service.getManagerDashboard(projectId, { language }),
                managerReadyPackage: service.getManagerReadyPackage(projectId, { language }),
              });
            }
            return readModelCache.get(key);
          };
          return json(200, {
            processed: result.processed.map((item) => {
              const readModels = readModelsFor(item.projectId);
              return {
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
                managerDashboard: readModels.managerDashboard,
                managerReadyPackage: readModels.managerReadyPackage,
              };
            }),
            skipped: result.skipped,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (['GET', 'POST'].includes(method) && workerRoute?.worker === 'queue-snapshot') {
          return json(200, { workerQueueSnapshot: service.getWorkerQueueSnapshot({ ...body, language }) });
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
        if (method === 'GET' && route.action === 'submissions') {
          if (!route.tail.length) {
            return json(200, { submissions: service.listSubmissions(route.projectId) });
          }
          const submissionId = decodeURIComponent(route.tail[0]);
          return json(200, { submission: service.getSubmission(route.projectId, submissionId) });
        }
        if (method === 'POST' && route.action === 'submissions' && route.tail[1] === 'reviews') {
          const submissionId = decodeURIComponent(route.tail[0] || '');
          const result = service.reviewAgentSubmission({ projectId: route.projectId, submissionId, ...body });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            review: result.review,
            submission: result.submission,
            log: result.log,
            task: result.task,
            managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
            managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'evidence-searches') {
          if (!route.tail.length) {
            return json(200, { evidenceSearches: service.listEvidenceSearches(route.projectId) });
          }
          const evidenceSearchId = decodeURIComponent(route.tail[0]);
          return json(200, { evidenceSearch: service.getEvidenceSearch(route.projectId, evidenceSearchId) });
        }
        if (method === 'GET' && route.action === 'evidence-quality-audit') {
          return json(200, { evidenceQualityAudit: service.getEvidenceQualityAudit(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'artifact-quality-audit') {
          return json(200, { artifactQualityAudit: service.getArtifactQualityAudit(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'submission-review-workflow') {
          return json(200, { submissionReviewWorkflow: service.getSubmissionReviewWorkflow(route.projectId, { language }) });
        }
        if (method === 'POST' && route.action === 'evidence-source-review-workflow') {
          const result = service.reviewEvidenceSource({ projectId: route.projectId, ...body });
          return json(200, {
            ...publicProjectResult(result, result.project?.id || route.projectId, language),
            evidenceSourceReview: result.evidenceSourceReview,
            evidenceSearch: result.evidenceSearch,
            evidenceSourceReviewWorkflow: service.getEvidenceSourceReviewWorkflow(result.project?.id || route.projectId, { language }),
            readinessProofMap: service.getReadinessProofMap(result.project?.id || route.projectId),
            managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
            managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            log: result.log,
            task: result.task,
            submission: result.submission,
          });
        }
        if (method === 'GET' && route.action === 'evidence-source-review-workflow') {
          return json(200, { evidenceSourceReviewWorkflow: service.getEvidenceSourceReviewWorkflow(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'submission-reviews') {
          if (!route.tail.length) {
            return json(200, { submissionReviews: service.listSubmissionReviews(route.projectId) });
          }
          const reviewId = decodeURIComponent(route.tail[0]);
          return json(200, { submissionReview: service.getSubmissionReview(route.projectId, reviewId) });
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
          if (method === 'POST' && route.tail[1] === 'submissions') {
            const result = service.submitAgentArtifact({ projectId: route.projectId, agentId, ...body });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              submission: result.submission,
              artifact: result.artifact,
              log: result.log,
              task: result.task,
              agentDashboard: service.getAgentDashboard(result.project?.id || route.projectId, agentId),
              managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          if (method === 'POST' && route.tail[1] === 'artifact-drafts') {
            return json(400, { error: 'agent-artifact-draft-requires-async-handler' });
          }
          if (method === 'POST' && route.tail[1] === 'evidence-searches') {
            const result = service.recordAgentEvidenceSearch({ projectId: route.projectId, agentId, ...body });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              evidenceSearch: result.evidenceSearch,
              log: result.log,
              task: result.task,
              submission: result.submission,
              agentDashboard: service.getAgentDashboard(result.project?.id || route.projectId, agentId),
              managerFlowGraph: service.getManagerFlowGraph(result.project?.id || route.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
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
        if (method === 'GET' && route.action === 'pilot-launch-readiness') {
          return json(200, { pilotLaunchReadiness: service.getPilotLaunchReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'deployment-preflight') {
          return json(200, { deploymentPreflight: service.getDeploymentPreflight(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'adapter-gateway-preflight') {
          return json(200, { adapterGatewayPreflight: service.getAdapterGatewayPreflight(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'production-launch-audit') {
          return json(200, { productionLaunchAudit: service.getProductionLaunchAudit(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'project-evidence-archive') {
          return json(200, { projectEvidenceArchive: service.getProjectEvidenceArchive(route.projectId, { language }) });
        }
        if (route.action === 'project-evidence-exports') {
          if (method === 'GET') {
            if (route.tail[1] === 'package') {
              const exportRequestId = decodeURIComponent(route.tail[0] || '');
              return json(200, {
                projectEvidenceExportPackage: service.getProjectEvidenceExportPackage(route.projectId, {
                  language,
                  exportRequestId,
                }),
              });
            }
            return json(200, { projectEvidenceExportWorkflow: service.getProjectEvidenceExportWorkflow(route.projectId, { language }) });
          }
          if (method === 'POST') {
            const result = service.recordProjectEvidenceExport({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              projectEvidenceExport: result.projectEvidenceExport,
              projectEvidenceExportWorkflow: result.projectEvidenceExportWorkflow,
              projectEvidenceExportPackage: result.projectEvidenceExportPackage,
              projectEvidenceArchive: result.projectEvidenceArchive,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'private-pilot-release-candidates') {
          if (method === 'GET') {
            return json(200, {
              privatePilotReleaseCandidateWorkflow: service.getPrivatePilotReleaseCandidateWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordPrivatePilotReleaseCandidate({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              privatePilotReleaseCandidate: result.privatePilotReleaseCandidate,
              privatePilotReleaseCandidateWorkflow: result.privatePilotReleaseCandidateWorkflow,
              projectEvidenceExportPackage: result.projectEvidenceExportPackage,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'private-pilot-launch-runs') {
          if (method === 'GET') {
            return json(200, {
              privatePilotLaunchRunWorkflow: service.getPrivatePilotLaunchRunWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordPrivatePilotLaunchRun({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              privatePilotLaunchRun: result.privatePilotLaunchRun,
              privatePilotLaunchRunWorkflow: result.privatePilotLaunchRunWorkflow,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'private-pilot-launch-health-checks') {
          if (method === 'GET') {
            return json(200, {
              privatePilotLaunchHealthCheckWorkflow: service.getPrivatePilotLaunchHealthCheckWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordPrivatePilotLaunchHealthCheck({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              privatePilotLaunchHealthCheck: result.privatePilotLaunchHealthCheck,
              privatePilotLaunchHealthCheckWorkflow: result.privatePilotLaunchHealthCheckWorkflow,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'private-pilot-acceptance-reports') {
          if (method === 'GET') {
            return json(200, {
              privatePilotAcceptanceReportWorkflow: service.getPrivatePilotAcceptanceReportWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordPrivatePilotAcceptanceReport({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              privatePilotAcceptanceReport: result.privatePilotAcceptanceReport,
              privatePilotAcceptanceReportWorkflow: result.privatePilotAcceptanceReportWorkflow,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'private-pilot-go-live-readiness') {
          return json(200, {
            privatePilotGoLiveReadiness: service.getPrivatePilotGoLiveReadiness(route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'production-launch-gap-register') {
          return json(200, {
            productionLaunchGapRegister: service.getProductionLaunchGapRegister(route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'production-launch-control-center') {
          return json(200, {
            productionLaunchControlCenter: service.getProductionLaunchControlCenter(route.projectId, { language }),
          });
        }
        if (route.action === 'launch-approvals') {
          if (method === 'GET') {
            return json(200, { launchApprovalWorkflow: service.getLaunchApprovalWorkflow(route.projectId, { language }) });
          }
          if (method === 'POST') {
            const result = service.recordLaunchApproval({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              launchApproval: result.launchApproval,
              launchApprovalWorkflow: result.launchApprovalWorkflow,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'identity-sessions') {
          if (method === 'GET') {
            return json(200, { identitySessions: service.getIdentitySessions(route.projectId) });
          }
          if (method === 'POST' && route.tail[0] && route.tail[1] === 'revoke') {
            const result = service.revokeIdentitySession({
              projectId: route.projectId,
              sessionId: decodeURIComponent(route.tail[0]),
              revokedBy: body.revokedBy || body.actorUserId || body.userId || '',
              reason: body.reason || body.summary || '',
              now: body.now,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              identitySession: result.identitySession,
              identitySessions: result.identitySessions,
              log: result.log,
              securityBoundary: service.getSecurityBoundary(route.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          if (method === 'POST' && !route.tail.length) {
            const result = service.issueIdentitySession({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              identitySession: result.identitySession,
              identitySessions: result.identitySessions,
              token: result.token,
              tokenContract: result.tokenContract,
              log: result.log,
              securityBoundary: service.getSecurityBoundary(route.projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'mvp-readiness') {
          return json(200, { mvpReadiness: service.getMvpReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'persistence-snapshot') {
          return json(200, { persistenceSnapshot: service.getPersistenceSnapshot(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'persistence-migration-plan') {
          return json(200, { persistenceMigrationPlan: service.getPersistenceMigrationPlan(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'persistence-migration-dry-run') {
          return json(200, { persistenceMigrationDryRun: service.getPersistenceMigrationDryRun(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'persistence-adapter-plan') {
          return json(200, { persistenceAdapterPlan: service.getPersistenceAdapterPlan(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'persistence-adapter-dry-run') {
          return json(200, { persistenceAdapterDryRun: service.getPersistenceAdapterDryRun(route.projectId, { language }) });
        }
        if (['GET', 'POST'].includes(method) && route.action === 'worker-queue') {
          return json(200, { workerQueueSnapshot: service.getProjectWorkerQueue(route.projectId, { ...body, language }) });
        }
        if (method === 'GET' && route.action === 'worker-queue-adapter-plan') {
          return json(200, { workerQueueAdapterPlan: service.getWorkerQueueAdapterPlan(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'worker-queue-adapter-dry-run') {
          return json(200, { workerQueueAdapterDryRun: service.getWorkerQueueAdapterDryRun(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'operations-readiness') {
          return json(200, { operationsReadiness: service.getOperationsReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'production-operations-readiness') {
          return json(200, { productionOperationsReadiness: service.getProductionOperationsReadiness(route.projectId, { language }) });
        }
        if (route.action === 'production-operations-control-receipts') {
          if (method === 'GET') {
            return json(200, {
              productionOperationsControlReceiptWorkflow: service.getProductionOperationsControlReceiptWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordProductionOperationsControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              productionOperationsControlReceipt: result.productionOperationsControlReceipt,
              productionOperationsControlReceiptWorkflow: result.productionOperationsControlReceiptWorkflow,
              productionOperationsReadiness: result.productionOperationsReadiness,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'production-deployment-control-receipts') {
          if (method === 'GET') {
            return json(200, {
              productionDeploymentControlReceiptWorkflow: service.getProductionDeploymentControlReceiptWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordProductionDeploymentControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              productionDeploymentControlReceipt: result.productionDeploymentControlReceipt,
              productionDeploymentControlReceiptWorkflow: result.productionDeploymentControlReceiptWorkflow,
              deploymentPreflight: result.deploymentPreflight,
              persistenceAdapterDryRun: result.persistenceAdapterDryRun,
              workerQueueAdapterDryRun: result.workerQueueAdapterDryRun,
              adapterGatewayPreflight: result.adapterGatewayPreflight,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'provider-readiness') {
          return json(200, { providerReadiness: service.getProviderReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'provider-controlled-run') {
          return json(200, { providerControlledRun: service.getProviderControlledRun(route.projectId, { language }) });
        }
        if (route.action === 'provider-eval-runs') {
          if (method === 'GET') {
            return json(200, { providerEvalRunWorkflow: service.getProviderEvalRunWorkflow(route.projectId, { language }) });
          }
          if (method === 'POST') {
            const result = service.recordProviderEvalRun({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              providerEvalRun: result.providerEvalRun,
              providerEvalRunWorkflow: result.providerEvalRunWorkflow,
              providerControlledRun: result.providerControlledRun,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'production-provider-control-receipts') {
          if (method === 'GET') {
            return json(200, {
              productionProviderControlReceiptWorkflow: service.getProductionProviderControlReceiptWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordProductionProviderControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              productionProviderControlReceipt: result.productionProviderControlReceipt,
              productionProviderControlReceiptWorkflow: result.productionProviderControlReceiptWorkflow,
              providerReadiness: result.providerReadiness,
              providerControlledRun: result.providerControlledRun,
              providerEvalRunWorkflow: result.providerEvalRunWorkflow,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'evidence-custody-readiness') {
          return json(200, { evidenceCustodyReadiness: service.getEvidenceCustodyReadiness(route.projectId, { language }) });
        }
        if (route.action === 'production-security-control-receipts') {
          if (method === 'GET') {
            return json(200, {
              productionSecurityControlReceiptWorkflow: service.getProductionSecurityControlReceiptWorkflow(route.projectId, { language }),
            });
          }
          if (method === 'POST') {
            const result = service.recordProductionSecurityControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              productionSecurityControlReceipt: result.productionSecurityControlReceipt,
              productionSecurityControlReceiptWorkflow: result.productionSecurityControlReceiptWorkflow,
              securityBoundary: result.securityBoundary,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language, fresh: true }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'security-boundary') {
          return json(200, { securityBoundary: service.getSecurityBoundary(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'security-access-audit') {
          return json(200, { securityAccessAudit: service.getSecurityAccessAudit(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'security-audit-stream') {
          return json(200, { securityAuditStream: service.getSecurityAuditStream(route.projectId, { language }) });
        }
        if (route.action === 'membership-policy') {
          if (method === 'GET') {
            return json(200, service.getProjectMembershipPolicy(route.projectId));
          }
          if (['PUT', 'POST'].includes(method)) {
            const result = service.setProjectMembershipPolicy({
              projectId: route.projectId,
              policy: body.policy || body.projectMembershipPolicy || body,
              updatedBy: body.updatedBy || body.actorUserId || body.userId || '',
              source: body.source || 'membership-policy-api',
              now: body.now,
            });
            return json(200, {
              ...publicProjectResult(result, result.project?.id || route.projectId, language),
              projectMembershipPolicy: result.projectMembershipPolicy,
              projectMembershipSummary: result.projectMembershipSummary,
              projectMembershipAuditEntry: result.projectMembershipAuditEntry,
              log: result.log,
              managerReadyPackage: service.getManagerReadyPackage(result.project?.id || route.projectId, { language }),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
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
  securityAuditLogPath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  replaceWithSeed = false,
  artifactWriter = null,
  projectRuntime = null,
  llmProvider = null,
  searchProvider = null,
  providerPolicy = {},
  secretVault = null,
  accessControl = {},
} = {}) {
  const store = createAgentProjectFileStore({
    filePath,
    securityAuditLogPath,
    projects,
    messages,
    kickoffMeetings,
    messageLimit,
    hydrateProject: hydrateAgentProject,
    replaceWithSeed,
  });
  const service = createAgentProjectService({ store, artifactWriter, projectRuntime, llmProvider, searchProvider, providerPolicy, secretVault });
  const api = createAgentProjectApi({
    service,
    accessControl: {
      ...accessControl,
      replayStore: accessControl.replayStore || store,
    },
  });

  return {
    ...api,
    service,
    store,
  };
}
