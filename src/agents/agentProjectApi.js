import { createAgentProjectService, hydrateAgentProject } from './agentProjectService.js';
import { createAgentProjectFileStore } from './agentProjectFileStore.js';
import { createLocalAuthStore } from './localAuthStore.js';
import { buildProductionCapabilityRegistry } from './productionCapabilityRegistry.js';
import { SUPER_AGENT_WORK_MODES, composeWorkModeTeam, evaluateWorkModeAcceptance } from './workModes.js';
import { PERSON_SKILLS } from '../skills/personSkillSystem.js';
import {
  authorizeAgentProjectRequest,
  buildAccessControlPolicySnapshot,
  evaluateProjectMembershipAccess,
  publicAccessDecision,
} from './accessControl.js';
import { normalizeLanguage } from '../i18n/runtime.js';

const json = (status, body) => ({ status, body });

function normalizePath(path = '') {
  return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function workModeTeamRoute(path = '') {
  const match = normalizePath(path).match(/^\/work-modes\/([^/]+)\/team$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function localAuthRoute(path = '') {
  const match = normalizePath(path).match(/^\/local-auth(?:\/(status|bootstrap|login|logout|users))?$/);
  return match ? (match[1] || '') : null;
}

function workModeInitiationInput(body = {}) {
  if (!body.workMode) return { input: body, error: null };
  const composition = composeWorkModeTeam({
    workMode: body.workMode,
    objective: body.brief || body.objective || body.name || '',
    availablePersonaSlugs: body.availablePersonaSlugs,
    additionalDependencies: body.additionalDependencies,
  });
  if (!composition.readyForKickoff) return { input: null, error: composition };
  const generatedTeam = composition.roles.map((role) => {
    const persona = PERSON_SKILLS[role.personaSlug] || {};
    return {
      id: role.personaSlug,
      name: persona.name || role.personaSlug,
      title: role.id,
      role: role.id,
    };
  });
  const lead = composition.roles.find((role) => role.id.includes('lead')) || composition.roles[0];
  const reviewer = composition.roles.find((role) => role.id.includes('reviewer')) || composition.roles.at(-1);
  const projectId = body.projectId || `project_${Date.now()}`;
  const requestedTasksByArtifact = new Map((Array.isArray(body.tasks) ? body.tasks : [])
    .filter((task) => task?.artifactType)
    .map((task) => [String(task.artifactType), task]));
  const governedTasks = composition.taskNodes.map((task) => {
    const requested = requestedTasksByArtifact.get(task.artifactType) || {};
    return {
      id: `${projectId}_${task.id}`,
      text: String(requested.text || '').trim() || `Deliver ${task.artifactType} for ${body.name || composition.workMode}.`,
      assignee: task.ownerPersonaSlug,
      reviewerId: task.reviewerPersonaSlug,
      dependsOn: task.dependsOn.map((dependencyId) => `${projectId}_${dependencyId}`),
      status: 'pending',
      artifactType: task.artifactType,
      acceptanceChecks: task.acceptanceChecks,
    };
  });
  return {
    error: null,
    input: {
      ...body,
      projectId,
      // A work mode owns its roster. Caller-selected members cannot replace
      // a required owner or the independent reviewer.
      team: generatedTeam,
      selectedLeaderId: lead?.personaSlug,
      reviewerId: reviewer?.personaSlug,
      tasks: governedTasks,
      workModeContract: composition,
    },
  };
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
    meetingAgentTurns: result.meetingAgentTurns || [],
    meetingProtocol: result.meetingProtocol || null,
    roleNegotiation: result.roleNegotiation,
    leaderElection: result.leaderElection,
    kickoffCharter: result.kickoffCharter,
    assignmentPackage: result.assignmentPackage,
    agent: result.agent,
    log: result.log,
    task: result.task,
    strategyDecision: result.strategyDecision,
    modelKickoffMeeting: result.modelKickoffMeeting,
    modelKickoffMeetingTurn: result.modelKickoffMeetingTurn,
  };
}

export function createAgentProjectApi({ service, accessControl = {}, localAuth = null, localAuthRequired = false } = {}) {
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
  const requireLocalAuth = Boolean(localAuthRequired);

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

  const localAuthTokenFromRequest = (request = {}) => String(
    request.localAuthToken
    || request.body?.localAuthToken
    || readHeader(request.headers, 'x-hofs-local-auth-token')
    || '',
  ).trim();
  const isPublicLocalAuthRoute = (request = {}) => {
    const action = localAuthRoute(request.path || request.url || '/');
    const method = String(request.method || 'GET').toUpperCase();
    return (method === 'GET' && action === 'status')
      || (method === 'POST' && ['bootstrap', 'login'].includes(action));
  };
  const resolveLocalAuthRequest = (request = {}) => {
    if (!localAuth) return null;
    const token = localAuthTokenFromRequest(request);
    if (!token) return null;
    const verification = localAuth.verifySession({
      token,
      now: request.body?.now || new Date().toISOString(),
    });
    if (!verification.verified) {
      return {
        verified: false,
        response: json(401, {
          error: 'local-auth-invalid',
          message: verification.reason || 'local authentication is not valid',
        }),
      };
    }
    const user = verification.user || {};
    const headers = request.headers || {};
    return {
      verified: true,
      verification,
      request: {
        ...request,
        headers: withHeader(
          withHeader(
            withHeader(headers, 'x-hofs-access-mode', 'enforced'),
            'x-hofs-role',
            user.role || 'observer',
          ),
          'x-hofs-user-id',
          user.id || '',
        ),
        actorRole: user.role || request.actorRole,
        actorUserId: user.id || request.actorUserId,
      },
    };
  };

  const authorizeRequest = (request = {}) => {
    if (isPublicLocalAuthRoute(request)) return null;
    const localAuthRequest = resolveLocalAuthRequest(request);
    if (localAuthRequest?.response) return localAuthRequest.response;
    const sessionRequest = localAuthRequest?.verified ? null : resolveIdentitySessionRequest(request);
    if (sessionRequest?.response) return sessionRequest.response;
    if (requireLocalAuth && !localAuthRequest?.verified && !sessionRequest?.verified) {
      return json(401, {
        error: 'local-auth-required',
        message: 'Local authentication is required for this request.',
      });
    }
    const effectiveRequest = localAuthRequest?.request || sessionRequest?.request || request;
    let decision = authorizeAgentProjectRequest(effectiveRequest, {
      defaultMode: defaultAccessMode,
      signingSecret: localAuthRequest?.verified || sessionRequest?.verified ? '' : accessSigningSecret,
      requireSignedHeaders: localAuthRequest?.verified || sessionRequest?.verified ? false : requireSignedAccessHeaders,
      ...(signatureMaxAgeMs === undefined ? {} : { signatureMaxAgeMs }),
    });
    decision = {
      ...decision,
      method: effectiveRequest.method || 'GET',
      path: effectiveRequest.path || effectiveRequest.url || '/',
    };
    if (localAuthRequest?.verified) {
      decision = {
        ...decision,
        localAuth: {
          required: requireLocalAuth,
          verified: true,
          userId: localAuthRequest.verification.user?.id || null,
          role: localAuthRequest.verification.user?.role || 'observer',
          sessionId: localAuthRequest.verification.session?.id || null,
          expiresAt: localAuthRequest.verification.session?.expiresAt || null,
        },
      };
    } else if (sessionRequest?.verified) {
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

  const shouldIncludeReadModels = (body = {}) => (
    body.includeReadModels !== false
    && body.includeManagerReadModels !== false
  );
  const deferredReadModels = (projectId, agentId = '', extraRoutes = {}) => ({
    readModels: {
      included: false,
      reason: 'deferred-by-request',
      projectRoute: projectId ? `/projects/${projectId}` : null,
      projectMessagesRoute: projectId ? `/projects/${projectId}/messages` : null,
      managerDashboardRoute: projectId ? `/projects/${projectId}/manager-dashboard` : null,
      managerReadyPackageRoute: projectId ? `/projects/${projectId}/manager-ready-package` : null,
      managerFlowGraphRoute: projectId ? `/projects/${projectId}/manager-flow-graph` : null,
      readinessProofMapRoute: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
      transcriptsRoute: projectId ? `/projects/${projectId}/transcripts` : null,
      mainTranscriptRoute: projectId ? `/projects/${projectId}/transcripts/main` : null,
      meetingSummariesRoute: projectId ? `/projects/${projectId}/meeting-summaries` : null,
      timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
      eventsRoute: projectId ? `/projects/${projectId}/events` : null,
      brainstormLayerRoute: projectId ? `/projects/${projectId}/brainstorm-layer` : null,
      artifactQualityAuditRoute: projectId ? `/projects/${projectId}/artifact-quality-audit` : null,
      submissionReviewWorkflowRoute: projectId ? `/projects/${projectId}/submission-review-workflow` : null,
      productTeamDeliveryTraceRoute: projectId ? `/projects/${projectId}/product-team-delivery-trace` : null,
      zeroToAutonomyReportRoute: projectId ? `/projects/${projectId}/zero-to-autonomy-report` : null,
      evidenceQualityAuditRoute: projectId ? `/projects/${projectId}/evidence-quality-audit` : null,
      evidenceIndexReadinessRoute: projectId ? `/projects/${projectId}/evidence-index-readiness` : null,
      evidenceSourceReviewWorkflowRoute: projectId ? `/projects/${projectId}/evidence-source-review-workflow` : null,
      evidenceCustodyReadinessRoute: projectId ? `/projects/${projectId}/evidence-custody-readiness` : null,
      productTeamOperatingLoopRoute: projectId ? `/projects/${projectId}/product-team-operating-loop` : null,
      plannerExecutorReviewerStateMachineRoute: projectId ? `/projects/${projectId}/planner-executor-reviewer-state-machine` : null,
      teamCollaborationDiagnosticsRoute: projectId ? `/projects/${projectId}/team-collaboration-diagnostics` : null,
      collaborationIntentQueueRoute: projectId ? `/projects/${projectId}/collaboration-intent-queue` : null,
      runtimeContractsRoute: projectId ? `/projects/${projectId}/runtime-contracts` : null,
      autonomousCycleConsistencyRoute: projectId ? `/projects/${projectId}/autonomous-cycle-consistency` : null,
      runtimeAutonomyStatusRoute: projectId ? `/projects/${projectId}/runtime-autonomy-status` : null,
      autonomousRunControlRoute: projectId ? `/projects/${projectId}/autonomous-run-control` : null,
      agentAutonomousActionQueueRoute: projectId ? `/projects/${projectId}/agent-autonomous-action-queue` : null,
      governanceProtocolRoute: projectId ? `/projects/${projectId}/governance-protocol` : null,
      agentStateSummaryRoute: projectId ? `/projects/${projectId}/agent-state-summary` : null,
      assignmentTimelineMatrixRoute: projectId ? `/projects/${projectId}/assignment-timeline-matrix` : null,
      changeFlowRoute: projectId ? `/projects/${projectId}/change-flow` : null,
      continuousWorkLoopRoute: projectId ? `/projects/${projectId}/continuous-work-loop` : null,
      agentDashboardRoute: projectId && agentId ? `/projects/${projectId}/agents/${agentId}/dashboard` : null,
      ...extraRoutes,
    },
  });
  const productionControlReceiptReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    productionInfrastructureRehearsalRoute: projectId ? `/projects/${projectId}/production-infrastructure-rehearsal` : null,
    productionOperationsReadinessRoute: projectId ? `/projects/${projectId}/production-operations-readiness` : null,
    productionLaunchAuditRoute: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    productionLaunchGapRegisterRoute: projectId ? `/projects/${projectId}/production-launch-gap-register` : null,
    productionLaunchControlCenterRoute: projectId ? `/projects/${projectId}/production-launch-control-center` : null,
    productionLaunchEvidenceDossierRoute: projectId ? `/projects/${projectId}/production-launch-evidence-dossier` : null,
    productionEvidenceIntegrityAuditRoute: projectId ? `/projects/${projectId}/production-evidence-integrity-audit` : null,
    deploymentPreflightRoute: projectId ? `/projects/${projectId}/deployment-preflight` : null,
    adapterGatewayPreflightRoute: projectId ? `/projects/${projectId}/adapter-gateway-preflight` : null,
    launchApprovalWorkflowRoute: projectId ? `/projects/${projectId}/launch-approvals` : null,
    ...extraRoutes,
  });
  const projectEvidenceExportReadModels = (projectId, exportRequestId = '', extraRoutes = {}) => deferredReadModels(projectId, '', {
    projectEvidenceArchiveRoute: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
    projectEvidenceExportWorkflowRoute: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    projectEvidenceExportPackageRoute: projectId && exportRequestId
      ? `/projects/${projectId}/project-evidence-exports/${encodeURIComponent(exportRequestId)}/package`
      : null,
    launchApprovalWorkflowRoute: projectId ? `/projects/${projectId}/launch-approvals` : null,
    pilotLaunchReadinessRoute: projectId ? `/projects/${projectId}/pilot-launch-readiness` : null,
    productionLaunchAuditRoute: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    ...extraRoutes,
  });
  const launchApprovalReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    launchApprovalWorkflowRoute: projectId ? `/projects/${projectId}/launch-approvals` : null,
    pilotLaunchReadinessRoute: projectId ? `/projects/${projectId}/pilot-launch-readiness` : null,
    productionLaunchAuditRoute: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    projectEvidenceExportWorkflowRoute: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    privatePilotGoLiveReadinessRoute: projectId ? `/projects/${projectId}/private-pilot-go-live-readiness` : null,
    ...extraRoutes,
  });
  const securityBoundaryReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    securityBoundaryRoute: projectId ? `/projects/${projectId}/security-boundary` : null,
    securityAccessAuditRoute: projectId ? `/projects/${projectId}/security-access-audit` : null,
    securityAuditStreamRoute: projectId ? `/projects/${projectId}/security-audit-stream` : null,
    membershipPolicyRoute: projectId ? `/projects/${projectId}/membership-policy` : null,
    identitySessionsRoute: projectId ? `/projects/${projectId}/identity-sessions` : null,
    providerReadinessRoute: projectId ? `/projects/${projectId}/provider-readiness` : null,
    ...extraRoutes,
  });
  const projectInitiationReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    projectRoute: projectId ? `/projects/${projectId}` : null,
    projectMessagesRoute: projectId ? `/projects/${projectId}/messages` : null,
    transcriptsRoute: projectId ? `/projects/${projectId}/transcripts` : null,
    mainTranscriptRoute: projectId ? `/projects/${projectId}/transcripts/main` : null,
    timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
    eventsRoute: projectId ? `/projects/${projectId}/events` : null,
    tasksRoute: projectId ? `/projects/${projectId}/tasks` : null,
    readinessRoute: projectId ? `/projects/${projectId}/readiness` : null,
    readinessProofMapRoute: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
    agentsRoute: projectId ? `/projects/${projectId}/agents` : null,
    ...extraRoutes,
  });
  const privatePilotReceiptReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    pilotLaunchReadinessRoute: projectId ? `/projects/${projectId}/pilot-launch-readiness` : null,
    productionLaunchAuditRoute: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    projectEvidenceArchiveRoute: projectId ? `/projects/${projectId}/project-evidence-archive` : null,
    projectEvidenceExportsRoute: projectId ? `/projects/${projectId}/project-evidence-exports` : null,
    privatePilotGoLiveReadinessRoute: projectId ? `/projects/${projectId}/private-pilot-go-live-readiness` : null,
    privatePilotReleaseCandidateWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-release-candidates` : null,
    privatePilotLaunchRunWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-launch-runs` : null,
    privatePilotLaunchHealthCheckWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-launch-health-checks` : null,
    privatePilotAcceptanceReportWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-acceptance-reports` : null,
    productionInfrastructureRehearsalRoute: projectId ? `/projects/${projectId}/production-infrastructure-rehearsal` : null,
    productionOperationsReadinessRoute: projectId ? `/projects/${projectId}/production-operations-readiness` : null,
    readinessProofMapRoute: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
    ...extraRoutes,
  });
  const providerEvalRunReadModels = (projectId, extraRoutes = {}) => deferredReadModels(projectId, '', {
    providerReadinessRoute: projectId ? `/projects/${projectId}/provider-readiness` : null,
    providerControlledRunRoute: projectId ? `/projects/${projectId}/provider-controlled-run` : null,
    providerEvalRunWorkflowRoute: projectId ? `/projects/${projectId}/provider-eval-runs` : null,
    pilotLaunchReadinessRoute: projectId ? `/projects/${projectId}/pilot-launch-readiness` : null,
    privatePilotReleaseCandidateWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-release-candidates` : null,
    privatePilotLaunchRunWorkflowRoute: projectId ? `/projects/${projectId}/private-pilot-launch-runs` : null,
    productionLaunchAuditRoute: projectId ? `/projects/${projectId}/production-launch-audit` : null,
    ...extraRoutes,
  });
  const autonomousRunControlReadModels = (projectId, agentId = '', sessionId = '', extraRoutes = {}) => {
    const activeSessionId = sessionId ? encodeURIComponent(sessionId) : 'active';
    return deferredReadModels(projectId, agentId, {
      readinessProofMapRoute: projectId ? `/projects/${projectId}/readiness-proof-map` : null,
      timelineRoute: projectId ? `/projects/${projectId}/timeline` : null,
      eventsRoute: projectId ? `/projects/${projectId}/events` : null,
      transcriptsRoute: projectId ? `/projects/${projectId}/transcripts` : null,
      autonomousRunControlRoute: projectId ? `/projects/${projectId}/autonomous-run-control` : null,
      autonomousRunControlSessionsRoute: projectId ? `/projects/${projectId}/autonomous-run-control/sessions` : null,
      autonomousRunControlSessionTickRoute: projectId ? `/projects/${projectId}/autonomous-run-control/sessions/${activeSessionId}/tick` : null,
      autonomousRunControlSessionPauseRoute: projectId ? `/projects/${projectId}/autonomous-run-control/sessions/${activeSessionId}/pause` : null,
      autonomousRunControlLoopRunRoute: projectId ? `/projects/${projectId}/autonomous-run-control/run-loop` : null,
      agentAutonomousActionQueueRoute: projectId ? `/projects/${projectId}/agent-autonomous-action-queue` : null,
      productTeamOperatingLoopRoute: projectId ? `/projects/${projectId}/product-team-operating-loop` : null,
      autonomousCycleConsistencyRoute: projectId ? `/projects/${projectId}/autonomous-cycle-consistency` : null,
      workerQueueRoute: projectId ? `/projects/${projectId}/worker-queue` : null,
      schedulerTickRoute: '/workers/autonomous/tick',
      autopilotDueWorkerRoute: '/workers/autopilot/due',
      ...extraRoutes,
    });
  };
  const publicProjectResult = (
    result = {},
    projectId = result.project?.id,
    language = result.project?.language || result.language,
    options = {},
  ) => ({
    ...publicResult(result),
    // Compatibility proof anchors: managerDashboard: projectId ? service.getManagerDashboard(projectId) : null / managerReadyPackage: projectId ? service.getManagerReadyPackage(projectId) : null
    ...(options.includeReadModels === false
      ? deferredReadModels(projectId, options.agentId)
      : {
          managerDashboard: projectId ? service.getManagerDashboard(projectId, { language }) : null,
          managerReadyPackage: projectId ? service.getManagerReadyPackage(projectId, { language }) : null,
        }),
  });
  const handleLocalAuthRoute = ({ method, path, body = {}, request = {} } = {}) => {
    const action = localAuthRoute(path);
    if (!action || !localAuth) return null;
    if (method === 'GET' && action === 'status') {
      return json(200, { localAuth: localAuth.status() });
    }
    if (method === 'POST' && action === 'bootstrap') {
      const result = localAuth.bootstrap(body);
      return json(201, { localAuth: result });
    }
    if (method === 'POST' && action === 'login') {
      const result = localAuth.login(body);
      return result.verified
        ? json(200, { localAuth: result })
        : json(401, { error: result.reason || 'local-auth-invalid-credentials' });
    }
    const localRequest = resolveLocalAuthRequest({ ...request, method, path, body });
    if (!localRequest?.verified) return localRequest?.response || json(401, {
      error: 'local-auth-required',
      message: 'Local authentication is required for this request.',
    });
    if (method === 'POST' && action === 'logout') {
      return json(200, { localAuth: localAuth.logout({ token: localAuthTokenFromRequest({ ...request, body }), now: body.now }) });
    }
    if (action === 'users') {
      if (localRequest.verification.user?.role !== 'security-admin') {
        return json(403, { error: 'local-auth-admin-required' });
      }
      if (method === 'GET') return json(200, { localAuth: { users: localAuth.listUsers() } });
      if (method === 'POST') return json(201, { localAuth: localAuth.createUser(body) });
    }
    return json(405, { error: 'method-not-allowed', method, path });
  };
  const seedLocalProjectCreatorMembership = (result = {}, request = {}, body = {}) => {
    if (!requireProjectMembership || result.project?.projectMembershipPolicy || !result.project?.id) return result;
    const localRequest = resolveLocalAuthRequest({ ...request, body });
    const user = localRequest?.verified ? localRequest.verification.user : null;
    if (!user?.id || !['security-admin', 'manager'].includes(user.role)) return result;
    const policy = user.role === 'security-admin'
      ? { securityAdminUserIds: [user.id] }
      : { managerUserIds: [user.id] };
    const membership = service.setProjectMembershipPolicy({
      projectId: result.project.id,
      policy,
      updatedBy: user.id,
      source: 'local-auth-project-creator',
      now: body.now,
    });
    return {
      ...result,
      project: membership.project,
      projectMembershipPolicy: membership.projectMembershipPolicy,
      projectMembershipSummary: membership.projectMembershipSummary,
      projectMembershipAuditEntry: membership.projectMembershipAuditEntry,
    };
  };

  return {
    async handleAsync(request = {}) {
      const method = String(request.method || 'GET').toUpperCase();
      const path = normalizePath(request.path || request.url || '/');
      const body = request.body || {};
      const language = languageFromRequest(request, body);
      const includeReadModels = shouldIncludeReadModels(body);
      const kickoffMeetingRoute = parseKickoffMeetingRoute(path);
      const route = parseProjectRoute(path);
      const workerRoute = parseWorkerRoute(path);
      const requestedWorkMode = workModeTeamRoute(path);
      const denied = request._accessChecked ? null : authorizeRequest({ ...request, method, path, body });
      if (denied) return denied;

      if (method === 'GET' && path === '/secret-vault/status') {
        return json(200, {
          secretVaultStatus: service.getSecretVaultStatus ? service.getSecretVaultStatus() : { enabled: false },
        });
      }
      if (method === 'GET' && path === '/secret-vault/records') {
        return json(200, {
          secretVaultRecords: service.listSecretVaultRecords ? service.listSecretVaultRecords() : {
            schemaVersion: 'secret-vault-record-list/v1',
            records: [],
          },
        });
      }
      if (method === 'GET' && path === '/provider-vault-bindings') {
        return json(200, {
          providerVaultBindings: service.getProviderVaultBindings ? service.getProviderVaultBindings() : {
            schemaVersion: 'provider-vault-bindings/v1',
            bindings: [],
          },
        });
      }
      if (method === 'GET' && path === '/access-control-policy') {
        return json(200, {
          accessControlPolicy: service.getAccessControlPolicy
            ? service.getAccessControlPolicy()
            : buildAccessControlPolicySnapshot(),
        });
      }
      if (method === 'GET' && path === '/managed-identity-policy') {
        return json(200, {
          managedIdentityPolicy: service.getManagedIdentityPolicy
            ? service.getManagedIdentityPolicy()
            : {
              schemaVersion: 'managed-identity-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/managed-identity-policy',
            },
        });
      }
      if (method === 'GET' && path === '/managed-secret-manager-policy') {
        return json(200, {
          managedSecretManagerPolicy: service.getManagedSecretManagerPolicy
            ? service.getManagedSecretManagerPolicy()
            : {
              schemaVersion: 'managed-secret-manager-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/managed-secret-manager-policy',
            },
        });
      }
      if (method === 'GET' && path === '/managed-persistence-policy') {
        return json(200, {
          managedPersistencePolicy: service.getManagedPersistencePolicy
            ? service.getManagedPersistencePolicy()
            : {
              schemaVersion: 'managed-persistence-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/managed-persistence-policy',
            },
        });
      }
      if (method === 'GET' && path === '/managed-worker-queue-policy') {
        return json(200, {
          managedWorkerQueuePolicy: service.getManagedWorkerQueuePolicy
            ? service.getManagedWorkerQueuePolicy()
            : {
              schemaVersion: 'managed-worker-queue-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/managed-worker-queue-policy',
            },
        });
      }
      if (method === 'GET' && path === '/production-provider-controls-policy') {
        return json(200, {
          productionProviderControlsPolicy: service.getProductionProviderControlsPolicy
            ? service.getProductionProviderControlsPolicy()
            : {
              schemaVersion: 'production-provider-controls-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/production-provider-controls-policy',
            },
        });
      }
      if (method === 'GET' && path === '/production-data-governance-policy') {
        return json(200, {
          productionDataGovernancePolicy: service.getProductionDataGovernancePolicy
            ? service.getProductionDataGovernancePolicy()
            : {
              schemaVersion: 'production-data-governance-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/production-data-governance-policy',
            },
        });
      }
      if (method === 'GET' && path === '/production-traffic-policy') {
        return json(200, {
          productionTrafficPolicy: service.getProductionTrafficPolicy
            ? service.getProductionTrafficPolicy()
            : {
              schemaVersion: 'production-traffic-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/production-traffic-policy',
            },
        });
      }
      if (method === 'GET' && path === '/production-customer-acceptance-policy') {
        return json(200, {
          productionCustomerAcceptancePolicy: service.getProductionCustomerAcceptancePolicy
            ? service.getProductionCustomerAcceptancePolicy()
            : {
              schemaVersion: 'production-customer-acceptance-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/production-customer-acceptance-policy',
            },
        });
      }
      if (method === 'GET' && path === '/production-operations-policy') {
        return json(200, {
          productionOperationsPolicy: service.getProductionOperationsPolicy
            ? service.getProductionOperationsPolicy()
            : {
              schemaVersion: 'production-operations-policy/v1',
              status: 'backend-required',
              ready: false,
              apiPath: '/production-operations-policy',
            },
        });
      }
      if (method === 'GET' && path === '/local-mvp-startup-readiness') {
        return json(200, {
          localMvpStartupReadiness: service.getLocalMvpStartupReadiness
            ? service.getLocalMvpStartupReadiness()
            : {
              schemaVersion: 'local-mvp-startup-readiness/v1',
              status: 'backend-required',
              readyForSettingsEntry: false,
              readyForFirstProjectRun: false,
            },
        });
      }
      if (method === 'GET' && path === '/public-production-startup-readiness') {
        return json(200, {
          publicProductionStartupReadiness: service.getPublicProductionStartupReadiness
            ? service.getPublicProductionStartupReadiness()
            : {
              schemaVersion: 'public-production-startup-readiness/v1',
              status: 'backend-required',
              readyForPublicProduction: false,
              readyForProduction: false,
            },
        });
      }
      if (method === 'GET' && path === '/production-capabilities') {
        return json(200, {
          productionCapabilityRegistry: buildProductionCapabilityRegistry(),
        });
      }
      if (method === 'GET' && path === '/work-modes') {
        return json(200, { workModes: SUPER_AGENT_WORK_MODES });
      }
      if (method === 'POST' && requestedWorkMode) {
        return json(200, {
          workModeTeam: composeWorkModeTeam({
            workMode: requestedWorkMode,
            objective: body.objective || body.projectBrief || '',
            availablePersonaSlugs: body.availablePersonaSlugs,
            additionalDependencies: body.additionalDependencies,
          }),
        });
      }
      if (method === 'GET' && path === '/settings/health-readiness') {
        return json(200, {
          settingsHealthReadiness: service.getSettingsHealthReadiness
            ? service.getSettingsHealthReadiness()
            : {
              schemaVersion: 'settings-health-readiness/v1',
              status: 'backend-required',
              rows: [],
              summary: { readyForProduction: false },
            },
        });
      }
      if (method === 'POST' && path === '/settings/workflow-smoke') {
        if (typeof service.runSettingsWorkflowSmoke !== 'function') {
          return json(400, { error: 'settings-workflow-smoke-not-configured' });
        }
        const result = typeof service.runSettingsWorkflowSmokeWithProviderEvidence === 'function'
          ? await service.runSettingsWorkflowSmokeWithProviderEvidence({ ...body, language })
          : service.runSettingsWorkflowSmoke({ ...body, language });
        return json(200, result);
      }
      if (method === 'GET' && path === '/settings/runtime-readiness') {
        return json(200, {
          settingsRuntimeReadiness: service.getSettingsRuntimeReadiness
            ? service.getSettingsRuntimeReadiness()
            : {
              schemaVersion: 'settings-runtime-readiness/v1',
              status: 'backend-required',
              rows: [],
              summary: { readyForProduction: false },
            },
        });
      }
      if (method === 'POST' && path === '/secret-vault/seal') {
        if (typeof service.sealSecretVaultRecord !== 'function') {
          return json(400, { error: 'secret-vault-not-configured' });
        }
        try {
          const result = await service.sealSecretVaultRecord(body);
          return json(200, result);
        } catch (error) {
          return json(400, {
            error: 'secret-vault-seal-failed',
            message: error.message || String(error),
            secretVaultStatus: service.getSecretVaultStatus ? service.getSecretVaultStatus() : { enabled: false },
          });
        }
      }
      if (method === 'POST' && path === '/secret-vault/rotate') {
        if (typeof service.rotateSecretVaultRecords !== 'function') {
          return json(400, { error: 'secret-vault-not-configured' });
        }
        try {
          const result = await service.rotateSecretVaultRecords(body);
          return json(200, result);
        } catch (error) {
          return json(400, {
            error: 'secret-vault-rotate-failed',
            message: error.message || String(error),
            secretVaultStatus: service.getSecretVaultStatus ? service.getSecretVaultStatus() : { enabled: false },
          });
        }
      }

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
        const resultProjectId = result.project?.id || route.projectId;
        const includeReadModels = shouldIncludeReadModels(body);
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
          artifactDraft: result.artifactDraft,
          providerUsage: result.providerUsage || null,
          providerVaultBinding: result.providerVaultBinding || null,
          modelProviderStatus: result.modelProviderStatus || (service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false }),
          submission: result.submission || null,
          artifact: result.artifact || null,
          log: result.log || null,
          task: result.task || null,
          ...(includeReadModels
            ? {
                agentDashboard: service.getAgentDashboard(resultProjectId, agentId),
                managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
              }
            : deferredReadModels(resultProjectId, agentId)),
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
        const resultProjectId = result.project?.id || route.projectId;
        const includeReadModels = shouldIncludeReadModels(body);
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
          evidenceSearch: result.evidenceSearch,
          sourceSnapshots: result.sourceSnapshots || [],
          providerReceipt: result.providerReceipt || null,
          providerUsage: result.providerUsage || null,
          providerVaultBinding: result.providerVaultBinding || null,
          log: result.log,
          task: result.task,
          submission: result.submission,
          searchProvider: service.getSearchProviderStatus ? service.getSearchProviderStatus() : { enabled: false },
          ...(includeReadModels
            ? {
                agentDashboard: service.getAgentDashboard(resultProjectId, agentId),
                managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
              }
            : deferredReadModels(resultProjectId, agentId)),
        });
      }
      if (
        method === 'POST'
        && route?.action === 'agents'
        && route.tail[1] === 'work-cycle'
        && body.useProviderEvidenceSearch
      ) {
        if (typeof service.runAgentWorkCycleWithProviderEvidence !== 'function') {
          return json(400, { error: 'agent-work-cycle-provider-evidence-not-configured' });
        }
        const agentId = decodeURIComponent(route.tail[0]);
        const result = await service.runAgentWorkCycleWithProviderEvidence({ projectId: route.projectId, agentId, ...body });
        const resultProjectId = result.project?.id || route.projectId;
        const includeReadModels = shouldIncludeReadModels(body);
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
          submission: result.submission,
          artifact: result.artifact,
          evidenceSearch: result.evidenceSearch,
          evidenceSearchLog: result.evidenceSearchLog,
          evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
          workSubmission: result.workSubmission,
          review: result.review,
          reviewedSubmission: result.reviewedSubmission,
          reviewResponseSubmission: result.reviewResponseSubmission,
          reviewResponseArtifact: result.reviewResponseArtifact,
          strategyDecision: result.strategyDecision,
          providerUsage: result.providerUsage || null,
          providerEvidenceSearch: result.providerEvidenceSearch || null,
          providerVaultBinding: result.providerVaultBinding || result.providerEvidenceSearch?.providerVaultBinding || null,
          searchProvider: result.searchProviderStatus || (service.getSearchProviderStatus ? service.getSearchProviderStatus() : { enabled: false }),
          ...(includeReadModels ? {} : deferredReadModels(resultProjectId, agentId)),
        });
      }
      if (
        method === 'POST'
        && route?.action === 'agent-autonomous-action-queue'
        && route.tail[1] === 'run'
      ) {
        const agentId = decodeURIComponent(route.tail[0] || 'next');
        if (typeof service.runAgentAutonomousActionQueueItemWithProviderEvidence !== 'function') {
          return json(400, { error: 'agent-autonomous-action-provider-evidence-not-configured' });
        }
        const result = await service.runAgentAutonomousActionQueueItemWithProviderEvidence({
          projectId: route.projectId,
          agentId,
          ...body,
        });
        const resultProjectId = result.project?.id || route.projectId;
        const includeReadModels = shouldIncludeReadModels(body);
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, {
            includeReadModels,
            agentId: result.agentAutonomousAction?.agentId || result.agentAutonomousActionRun?.agentId,
          }),
          agentAutonomousAction: result.agentAutonomousAction,
          agentAutonomousActionRun: result.agentAutonomousActionRun,
          agentAutonomousActionQueue: result.agentAutonomousActionQueue,
          submission: result.submission,
          workSubmission: result.workSubmission,
          evidenceSearch: result.evidenceSearch,
          evidenceSearchLog: result.evidenceSearchLog,
          providerUsage: result.providerUsage || null,
          providerEvidenceSearch: result.providerEvidenceSearch || null,
          autonomousProviderPreflight: result.autonomousProviderPreflight || result.agentAutonomousActionRun?.autonomousProviderPreflight || null,
          autonomousActionDecision: result.autonomousActionDecision || result.agentAutonomousActionRun?.autonomousActionDecision || null,
          review: result.review,
          reviewResponseSubmission: result.reviewResponseSubmission,
          ...(includeReadModels ? {} : deferredReadModels(
            resultProjectId,
            result.agentAutonomousAction?.agentId || result.agentAutonomousActionRun?.agentId,
          )),
        });
      }
      if (
        method === 'POST'
        && route?.action === 'autonomous-run-control'
        && route.tail[0] === 'sessions'
        && route.tail[2] === 'tick'
        && (
          body.useProviderEvidenceSearch
          || body.requestBodyOverrides?.useProviderEvidenceSearch
          || body.requestBodyOverrides?.autopilotTargetControl?.targetStageId === 'evidence-quality'
          || body.requestBodyOverrides?.targetControl?.targetStageId === 'evidence-quality'
        )
      ) {
        if (typeof service.tickAutonomousRunControlSessionWithProviderEvidence !== 'function') {
          return json(400, { error: 'autopilot-provider-evidence-tick-not-configured' });
        }
        const result = await service.tickAutonomousRunControlSessionWithProviderEvidence({
          projectId: route.projectId,
          sessionId: decodeURIComponent(route.tail[1] || 'active'),
          ...body,
        });
        const resultProjectId = result.project?.id || route.projectId;
        const includeReadModels = shouldIncludeReadModels(body);
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, {
            includeReadModels,
            agentId: result.autonomousRunControlSession?.agentIds?.[0] || result.autonomousRunControlSessionTick?.agentIds?.[0],
          }),
          autonomousRunControlSession: result.autonomousRunControlSession,
          autonomousRunControlSessionTick: result.autonomousRunControlSessionTick,
          autonomousRunControlSessions: result.autonomousRunControlSessions,
          autonomousRunControlLoops: result.autonomousRunControlLoops,
          autonomousRunControlRuns: result.autonomousRunControlRuns,
          autonomousRunControl: result.autonomousRunControl,
          providerEvidenceSearch: result.providerEvidenceSearch || null,
          providerUsage: result.providerUsage || null,
          autonomousProviderPreflight: result.autonomousProviderPreflight || result.autonomousRunControlSessionTick?.autonomousProviderPreflight || null,
          autonomousActionDecision: result.autonomousActionDecision || result.autonomousRunControlSessionTick?.autonomousActionDecision || result.agentAutonomousActionRun?.autonomousActionDecision || null,
          evidenceSearch: result.evidenceSearch || null,
          agentAutonomousAction: result.agentAutonomousAction || null,
          agentAutonomousActionRun: result.agentAutonomousActionRun || null,
          ...(includeReadModels ? {} : autonomousRunControlReadModels(
            resultProjectId,
            result.autonomousRunControlSession?.agentIds?.[0] || result.autonomousRunControlSessionTick?.agentIds?.[0],
            result.autonomousRunControlSession?.id || result.autonomousRunControlSessionTick?.sessionId || decodeURIComponent(route.tail[1] || 'active'),
          )),
        });
      }
      if (
        method === 'POST'
        && workerRoute?.worker === 'autopilot'
        && workerRoute.action === 'due'
        && (
          body.useProviderEvidenceSearch
          || body.providerEvidenceSearchEnabled
          || body.requestBodyOverrides?.useProviderEvidenceSearch
          || body.requestBodyOverrides?.requireProviderEvidenceSearch
          || body.requestBodyOverrides?.autopilotTargetControl?.targetStageId === 'evidence-quality'
          || body.requestBodyOverrides?.targetControl?.targetStageId === 'evidence-quality'
          || service.getSearchProviderStatus?.().enabled
        )
      ) {
        if (typeof service.runDueAutonomousRunControlSessionsWithProviderEvidence !== 'function') {
          return json(400, { error: 'autopilot-provider-evidence-due-worker-not-configured' });
        }
        const result = await service.runDueAutonomousRunControlSessionsWithProviderEvidence(body);
        const readModelCache = new Map();
        const readModelsFor = (projectId) => {
          const key = String(projectId || '');
          if (!readModelCache.has(key)) {
            readModelCache.set(key, {
              managerDashboard: service.getManagerDashboard(projectId, { language }),
              managerReadyPackage: service.getManagerReadyPackage(projectId, { language }),
              readinessProofMap: service.getReadinessProofMap(projectId),
              managerFlowGraph: service.getManagerFlowGraph(projectId, { language }),
            });
          }
          return readModelCache.get(key);
        };
        return json(200, {
          schemaVersion: result.schemaVersion || 'autopilot-due-worker-summary/v1',
          providerEvidenceSearchEnabled: true,
          processed: result.processed.map((item) => {
            const readModels = includeReadModels ? readModelsFor(item.projectId) : null;
            return {
              projectId: item.projectId,
              sessionId: item.sessionId,
              reason: item.reason,
              dueAt: item.dueAt,
              nextRunAt: item.nextRunAt,
              statusAfter: item.statusAfter,
              tickId: item.tickId,
              loopReceiptIds: item.loopReceiptIds,
              runReceiptIds: item.runReceiptIds,
              actionLanes: item.actionLanes,
              targetStageId: item.targetStageId,
              providerEvidenceSearch: item.providerEvidenceSearch || item.result?.providerEvidenceSearch || null,
              providerUsage: item.result?.providerUsage || null,
              providerUsageId: item.providerUsageId || item.result?.providerUsage?.id || null,
              autonomousProviderPreflight: item.autonomousProviderPreflight || item.result?.autonomousProviderPreflight || item.result?.autonomousRunControlSessionTick?.autonomousProviderPreflight || null,
              autonomousProviderPreflightChecksum: item.autonomousProviderPreflightChecksum || item.result?.autonomousProviderPreflight?.checksum || item.result?.autonomousRunControlSessionTick?.autonomousProviderPreflightChecksum || null,
              autonomousProviderPreflightAction: item.autonomousProviderPreflightAction || item.result?.autonomousProviderPreflight?.action || item.result?.autonomousRunControlSessionTick?.autonomousProviderPreflightAction || null,
              autonomousActionDecision: item.autonomousActionDecision || item.result?.autonomousActionDecision || item.result?.autonomousRunControlSessionTick?.autonomousActionDecision || item.result?.agentAutonomousActionRun?.autonomousActionDecision || null,
              autonomousActionDecisionChecksum: item.autonomousActionDecisionChecksum || item.result?.autonomousActionDecision?.checksum || item.result?.autonomousRunControlSessionTick?.autonomousActionDecisionChecksum || item.result?.agentAutonomousActionRun?.autonomousActionDecisionChecksum || null,
              autonomousActionDecisionAction: item.autonomousActionDecisionAction || item.result?.autonomousActionDecision?.action || item.result?.autonomousRunControlSessionTick?.autonomousActionDecisionAction || item.result?.agentAutonomousActionRun?.autonomousActionDecisionAction || null,
              evidenceSearch: item.result?.evidenceSearch || null,
              evidenceSearchId: item.evidenceSearchId || item.result?.evidenceSearch?.id || null,
              agentAutonomousAction: item.result?.agentAutonomousAction || null,
              agentAutonomousActionRun: item.result?.agentAutonomousActionRun || null,
              messageCount: item.result?.messages?.length || 0,
              project: item.result?.project,
              autonomousRunControlSession: item.result?.autonomousRunControlSession,
              autonomousRunControlSessionTick: item.result?.autonomousRunControlSessionTick,
              autonomousRunControlLoops: item.result?.autonomousRunControlLoops || [],
              autonomousRunControlRuns: item.result?.autonomousRunControlRuns || [],
              ...(includeReadModels
                ? {
                    managerDashboard: readModels.managerDashboard,
                    managerReadyPackage: readModels.managerReadyPackage,
                    readinessProofMap: readModels.readinessProofMap,
                    managerFlowGraph: readModels.managerFlowGraph,
                  }
                : autonomousRunControlReadModels(item.projectId, '', item.sessionId, {
                    autonomousRunControlSessionTickRoute: item.sessionId ? `/projects/${item.projectId}/autonomous-run-control/sessions/${encodeURIComponent(item.sessionId)}/tick` : `/projects/${item.projectId}/autonomous-run-control/sessions/active/tick`,
                  })),
            };
          }),
          skipped: result.skipped,
          messages: result.messages,
          messageCount: result.messages.length,
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
      if (method === 'POST' && route?.action === 'managed-infrastructure-cutover-attestations' && typeof service.recordManagedInfrastructureCutoverAttestations === 'function') {
        const result = await service.recordManagedInfrastructureCutoverAttestations({
          projectId: route.projectId,
          ...body,
        });
        const resultProjectId = result.project?.id || route.projectId;
        return json(200, {
          ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
          managedInfrastructureCutoverAttestationRun: result.managedInfrastructureCutoverAttestationRun,
          productionOperationsControlReceipt: result.productionOperationsControlReceipt || null,
          productionOperationsControlReceiptWorkflow: result.productionOperationsControlReceiptWorkflow || null,
          productionOperationsReadiness: result.productionOperationsReadiness || null,
          log: result.log || null,
          ...(includeReadModels
            ? {
                managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }),
                managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                readinessProofMap: service.getReadinessProofMap(resultProjectId, { language }),
              }
            : productionControlReceiptReadModels(resultProjectId, {
                productionOperationsControlReceiptWorkflowRoute: `/projects/${resultProjectId}/production-operations-control-receipts`,
                productionOperationsReadinessRoute: `/projects/${resultProjectId}/production-operations-readiness`,
              })),
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
            forcedDeterministicFallback: Boolean(body.forceDeterministicFallback),
            source: 'deterministic-kickoff-model-fallback',
            fallbackReason: error.message || String(error),
            modelProviderStatus: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
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

      if (method === 'POST' && kickoffMeetingRoute?.meetingId && kickoffMeetingRoute.action === 'clarify') {
        try {
          if (typeof service.clarifyKickoffMeetingAsync !== 'function') {
            throw new Error('model-kickoff-meeting-turn-not-supported');
          }
          return json(200, publicResult(await service.clarifyKickoffMeetingAsync({
            meetingId: kickoffMeetingRoute.meetingId,
            ...body,
            language,
          })));
        } catch (error) {
          if (body.allowDeterministicFallback === false) {
            return json(400, {
              error: 'model-kickoff-meeting-turn-failed',
              message: error.message || String(error),
              modelProvider: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
            });
          }
          const fallbackResult = service.clarifyKickoffMeeting({
            meetingId: kickoffMeetingRoute.meetingId,
            ...body,
            language,
          });
          return json(200, publicResult({
            ...fallbackResult,
            modelKickoffMeetingTurn: {
              ok: false,
              fallback: true,
              error: error.message || String(error),
              modelProvider: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
            },
          }));
        }
      }

      if (method === 'POST' && path === '/workspace/pick-folder') {
        if (typeof service.pickWorkspaceBaseFolder !== 'function') {
          return json(400, { error: 'local-workspace-folder-picker-not-configured' });
        }
        return json(200, await service.pickWorkspaceBaseFolder({ ...body, language }));
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

      if (!includeReadModels) {
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
      const requestUrl = new URL(request.url || request.path || '/', 'http://127.0.0.1');
      const path = normalizePath(request.path || request.url || '/');
      const body = request.body || {};
      const language = languageFromRequest(request, body);
      const route = parseProjectRoute(path);
        const workerRoute = parseWorkerRoute(path);
        const requestedWorkMode = workModeTeamRoute(path);
      const kickoffMeetingRoute = parseKickoffMeetingRoute(path);
      const denied = request._accessChecked ? null : authorizeRequest({ ...request, method, path, body });
      if (denied) return denied;

      try {
        const localAuthResponse = handleLocalAuthRoute({ method, path, body, request });
        if (localAuthResponse) return localAuthResponse;
        if (method === 'GET' && path === '/projects') {
          return json(200, { projects: service.listProjects() });
        }
        if (method === 'POST' && path === '/projects/initiate') {
          const workModeInitiation = workModeInitiationInput(body);
          if (workModeInitiation.error) {
            return json(422, {
              error: 'work-mode-team-coverage-incomplete',
              workModeTeam: workModeInitiation.error,
            });
          }
          let result = service.initiateProject(workModeInitiation.input);
          result = seedLocalProjectCreatorMembership(result, request, body);
          const resultProjectId = result.project?.id;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            ...(includeReadModels ? {} : projectInitiationReadModels(resultProjectId)),
          });
        }
        if (method === 'POST' && path === '/product-team-missions') {
          const workModeInitiation = workModeInitiationInput(body);
          if (workModeInitiation.error) {
            return json(422, {
              error: 'work-mode-team-coverage-incomplete',
              workModeTeam: workModeInitiation.error,
            });
          }
          const missionInput = workModeInitiation.input;
          const governedMission = Boolean(missionInput.workModeContract);
          let result = service.startProductTeamMission({
            ...missionInput,
            language,
            ...(governedMission ? {
              // A generic roundtable cannot attest to a mode-specific roster.
              meetingId: `work_mode_mission_${missionInput.projectId}`,
              kickoffMeetingId: undefined,
              reuseExistingKickoffMeeting: false,
              selectedTeamIds: missionInput.team.map((member) => member.id),
            } : {}),
          });
          result = seedLocalProjectCreatorMembership(result, request, body);
          const resultProjectId = result.project?.id;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            productTeamMissionRun: result.productTeamMissionRun,
            kickoffApproval: result.kickoffApproval,
            autonomousRunControlSession: result.autonomousRunControlSession,
            autonomousRunControlSessionTick: result.autonomousRunControlSessionTick,
            autonomousRunControlSessions: result.autonomousRunControlSessions,
            autonomousRunControl: result.autonomousRunControl,
            productTeamDeliveryTrace: result.productTeamDeliveryTrace,
            productTeamOperatingLoop: result.productTeamOperatingLoop,
            collaborationIntentQueue: result.collaborationIntentQueue,
            ...(includeReadModels
              ? {
                  managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                  readinessProofMap: service.getReadinessProofMap(resultProjectId),
                }
              : projectInitiationReadModels(resultProjectId, {
                  productTeamMissionRunsRoute: resultProjectId ? `/projects/${resultProjectId}/product-team-missions` : null,
                  productTeamMissionRunRoute: resultProjectId && result.productTeamMissionRun?.id ? `/projects/${resultProjectId}/product-team-missions/${encodeURIComponent(result.productTeamMissionRun.id)}` : null,
                  productTeamOperatingLoopRoute: resultProjectId ? `/projects/${resultProjectId}/product-team-operating-loop` : null,
                  collaborationIntentQueueRoute: resultProjectId ? `/projects/${resultProjectId}/collaboration-intent-queue` : null,
                  autonomousRunControlSessionsRoute: resultProjectId ? `/projects/${resultProjectId}/autonomous-run-control/sessions` : null,
                })),
          });
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
        if (method === 'GET' && path === '/settings/provider-readiness') {
          return json(200, {
            settingsProviderReadiness: service.getSettingsProviderReadiness
              ? service.getSettingsProviderReadiness()
              : { schemaVersion: 'settings-provider-readiness/v1', status: 'backend-required' },
          });
        }
        if (method === 'GET' && path === '/secret-vault/status') {
          return json(200, {
            secretVaultStatus: service.getSecretVaultStatus ? service.getSecretVaultStatus() : { enabled: false },
          });
        }
        if (method === 'GET' && path === '/secret-vault/records') {
          return json(200, {
            secretVaultRecords: service.listSecretVaultRecords ? service.listSecretVaultRecords() : {
              schemaVersion: 'secret-vault-record-list/v1',
              records: [],
            },
          });
        }
        if (method === 'GET' && path === '/provider-vault-bindings') {
          return json(200, {
            providerVaultBindings: service.getProviderVaultBindings ? service.getProviderVaultBindings() : {
              schemaVersion: 'provider-vault-bindings/v1',
              bindings: [],
            },
          });
        }
        if (method === 'GET' && path === '/access-control-policy') {
          return json(200, {
            accessControlPolicy: service.getAccessControlPolicy
              ? service.getAccessControlPolicy()
              : buildAccessControlPolicySnapshot(),
          });
        }
        if (method === 'GET' && path === '/managed-identity-policy') {
          return json(200, {
            managedIdentityPolicy: service.getManagedIdentityPolicy
              ? service.getManagedIdentityPolicy()
              : {
                schemaVersion: 'managed-identity-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/managed-identity-policy',
              },
          });
        }
        if (method === 'GET' && path === '/managed-secret-manager-policy') {
          return json(200, {
            managedSecretManagerPolicy: service.getManagedSecretManagerPolicy
              ? service.getManagedSecretManagerPolicy()
              : {
                schemaVersion: 'managed-secret-manager-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/managed-secret-manager-policy',
              },
          });
        }
        if (method === 'GET' && path === '/managed-persistence-policy') {
          return json(200, {
            managedPersistencePolicy: service.getManagedPersistencePolicy
              ? service.getManagedPersistencePolicy()
              : {
                schemaVersion: 'managed-persistence-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/managed-persistence-policy',
              },
          });
        }
        if (method === 'GET' && path === '/managed-worker-queue-policy') {
          return json(200, {
            managedWorkerQueuePolicy: service.getManagedWorkerQueuePolicy
              ? service.getManagedWorkerQueuePolicy()
              : {
                schemaVersion: 'managed-worker-queue-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/managed-worker-queue-policy',
              },
          });
        }
        if (method === 'GET' && path === '/production-provider-controls-policy') {
          return json(200, {
            productionProviderControlsPolicy: service.getProductionProviderControlsPolicy
              ? service.getProductionProviderControlsPolicy()
              : {
                schemaVersion: 'production-provider-controls-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/production-provider-controls-policy',
              },
          });
        }
        if (method === 'GET' && path === '/production-data-governance-policy') {
          return json(200, {
            productionDataGovernancePolicy: service.getProductionDataGovernancePolicy
              ? service.getProductionDataGovernancePolicy()
              : {
                schemaVersion: 'production-data-governance-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/production-data-governance-policy',
              },
          });
        }
        if (method === 'GET' && path === '/production-traffic-policy') {
          return json(200, {
            productionTrafficPolicy: service.getProductionTrafficPolicy
              ? service.getProductionTrafficPolicy()
              : {
                schemaVersion: 'production-traffic-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/production-traffic-policy',
              },
          });
        }
        if (method === 'GET' && path === '/production-customer-acceptance-policy') {
          return json(200, {
            productionCustomerAcceptancePolicy: service.getProductionCustomerAcceptancePolicy
              ? service.getProductionCustomerAcceptancePolicy()
              : {
                schemaVersion: 'production-customer-acceptance-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/production-customer-acceptance-policy',
              },
          });
        }
        if (method === 'GET' && path === '/production-operations-policy') {
          return json(200, {
            productionOperationsPolicy: service.getProductionOperationsPolicy
              ? service.getProductionOperationsPolicy()
              : {
                schemaVersion: 'production-operations-policy/v1',
                status: 'backend-required',
                ready: false,
                apiPath: '/production-operations-policy',
              },
          });
        }
        if (method === 'GET' && path === '/local-mvp-startup-readiness') {
          return json(200, {
            localMvpStartupReadiness: service.getLocalMvpStartupReadiness
              ? service.getLocalMvpStartupReadiness()
              : {
                schemaVersion: 'local-mvp-startup-readiness/v1',
                status: 'backend-required',
                readyForSettingsEntry: false,
                readyForFirstProjectRun: false,
              },
          });
        }
        if (method === 'GET' && path === '/public-production-startup-readiness') {
          return json(200, {
            publicProductionStartupReadiness: service.getPublicProductionStartupReadiness
              ? service.getPublicProductionStartupReadiness()
              : {
                schemaVersion: 'public-production-startup-readiness/v1',
                status: 'backend-required',
                readyForPublicProduction: false,
                readyForProduction: false,
              },
          });
        }
        if (method === 'GET' && path === '/production-capabilities') {
          return json(200, {
            productionCapabilityRegistry: buildProductionCapabilityRegistry(),
          });
        }
        if (method === 'GET' && path === '/work-modes') {
          return json(200, { workModes: SUPER_AGENT_WORK_MODES });
        }
        if (method === 'POST' && requestedWorkMode) {
          return json(200, {
            workModeTeam: composeWorkModeTeam({
              workMode: requestedWorkMode,
              objective: body.objective || body.projectBrief || '',
              availablePersonaSlugs: body.availablePersonaSlugs,
              additionalDependencies: body.additionalDependencies,
            }),
          });
        }
        if (method === 'GET' && path === '/settings/health-readiness') {
          return json(200, {
            settingsHealthReadiness: service.getSettingsHealthReadiness
              ? service.getSettingsHealthReadiness()
              : {
                schemaVersion: 'settings-health-readiness/v1',
                status: 'backend-required',
                rows: [],
                summary: { readyForProduction: false },
              },
          });
        }
        if (method === 'POST' && path === '/settings/workflow-smoke') {
          if (typeof service.runSettingsWorkflowSmoke !== 'function') {
            return json(400, { error: 'settings-workflow-smoke-not-configured' });
          }
          return json(200, service.runSettingsWorkflowSmoke({ ...body, language }));
        }
        if (method === 'POST' && path === '/workspace/prepare') {
          if (typeof service.prepareProjectWorkspace !== 'function') {
            return json(400, { error: 'local-workspace-prepare-not-configured' });
          }
          return json(200, service.prepareProjectWorkspace({ ...body, language }));
        }
        if (method === 'POST' && path === '/workspace/pick-folder') {
          return json(400, { error: 'local-workspace-folder-picker-requires-async-handler' });
        }
        if (method === 'GET' && path === '/settings/runtime-readiness') {
          return json(200, {
            settingsRuntimeReadiness: service.getSettingsRuntimeReadiness
              ? service.getSettingsRuntimeReadiness()
              : {
                schemaVersion: 'settings-runtime-readiness/v1',
                status: 'backend-required',
                rows: [],
                summary: { readyForProduction: false },
              },
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
              source: body.source || 'deterministic-kickoff-validation',
              modelProviderStatus: service.getModelProviderStatus ? service.getModelProviderStatus() : { enabled: false },
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.approveKickoffMeeting({
              meetingId: kickoffMeetingRoute.meetingId,
              ...body,
            });
            const resultProjectId = result.project?.id;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              ...(includeReadModels
                ? {}
                : projectInitiationReadModels(resultProjectId, {
                    kickoffMeetingRoute: `/kickoff-meetings/${encodeURIComponent(kickoffMeetingRoute.meetingId)}`,
                    kickoffMeetingApprovalRoute: `/kickoff-meetings/${encodeURIComponent(kickoffMeetingRoute.meetingId)}/approve`,
                  })),
            });
          }
          return json(404, { error: 'kickoff-meeting-route-not-found', path });
        }
        if (method === 'POST' && workerRoute?.worker === 'autonomous' && workerRoute.action === 'due') {
          const result = service.runDueAutonomousCycles(body);
          const includeReadModels = shouldIncludeReadModels(body);
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
              const readModels = includeReadModels ? readModelsFor(item.projectId) : null;
              return {
                projectId: item.projectId,
                cadence: item.cadence,
                reason: item.reason,
                dueAt: item.dueAt,
                nextRunAt: item.nextRunAt,
                messageCount: item.result.messages.length,
                project: item.result.project,
                ...(includeReadModels
                  ? {
                      managerDashboard: readModels.managerDashboard,
                      managerReadyPackage: readModels.managerReadyPackage,
                    }
                  : deferredReadModels(item.projectId)),
              };
            }),
            skipped: result.skipped,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (method === 'POST' && workerRoute?.worker === 'agents' && workerRoute.action === 'due') {
          const result = service.runDueAgentWorkCycles(body);
          const includeReadModels = shouldIncludeReadModels(body);
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
              const readModels = includeReadModels ? readModelsFor(item.projectId) : null;
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
                evidenceSearch: item.result.evidenceSearch,
                evidenceSearchLog: item.result.evidenceSearchLog,
                evidenceSearchSourceSnapshots: item.result.evidenceSearchSourceSnapshots,
                submission: item.result.submission,
                artifact: item.result.artifact,
                workSubmission: item.result.workSubmission,
                review: item.result.review,
                reviewedSubmission: item.result.reviewedSubmission,
                reviewResponseSubmission: item.result.reviewResponseSubmission,
                strategyDecision: item.result.strategyDecision,
                ...(includeReadModels
                  ? {
                      managerDashboard: readModels.managerDashboard,
                      managerReadyPackage: readModels.managerReadyPackage,
                    }
                  : deferredReadModels(item.projectId, item.agentId)),
              };
            }),
            skipped: result.skipped,
            agentAutonomousActionQueues: result.agentAutonomousActionQueues || [],
            agentAutonomousActionQueue: result.agentAutonomousActionQueues?.length === 1
              ? result.agentAutonomousActionQueues[0]
              : null,
            messages: result.messages,
            messageCount: result.messages.length,
          });
        }
        if (method === 'POST' && workerRoute?.worker === 'autopilot' && workerRoute.action === 'due') {
          const result = service.runDueAutonomousRunControlSessions(body);
          const includeReadModels = shouldIncludeReadModels(body);
          const readModelCache = new Map();
          const readModelsFor = (projectId) => {
            const key = String(projectId || '');
            if (!readModelCache.has(key)) {
              readModelCache.set(key, {
                managerDashboard: service.getManagerDashboard(projectId, { language }),
                managerReadyPackage: service.getManagerReadyPackage(projectId, { language }),
                readinessProofMap: service.getReadinessProofMap(projectId),
                managerFlowGraph: service.getManagerFlowGraph(projectId, { language }),
              });
            }
            return readModelCache.get(key);
          };
          return json(200, {
            schemaVersion: result.schemaVersion || 'autopilot-due-worker-summary/v1',
            processed: result.processed.map((item) => {
              const readModels = includeReadModels ? readModelsFor(item.projectId) : null;
              return {
                projectId: item.projectId,
                sessionId: item.sessionId,
                reason: item.reason,
                dueAt: item.dueAt,
                nextRunAt: item.nextRunAt,
                statusAfter: item.statusAfter,
                tickId: item.tickId,
                loopReceiptIds: item.loopReceiptIds,
                runReceiptIds: item.runReceiptIds,
                actionLanes: item.actionLanes,
                targetStageId: item.targetStageId,
                messageCount: item.result.messages?.length || 0,
                project: item.result.project,
                autonomousRunControlSession: item.result.autonomousRunControlSession,
                autonomousRunControlSessionTick: item.result.autonomousRunControlSessionTick,
                autonomousRunControlLoops: item.result.autonomousRunControlLoops || [],
                autonomousRunControlRuns: item.result.autonomousRunControlRuns || [],
                ...(includeReadModels
                  ? {
                      managerDashboard: readModels.managerDashboard,
                      managerReadyPackage: readModels.managerReadyPackage,
                      readinessProofMap: readModels.readinessProofMap,
                      managerFlowGraph: readModels.managerFlowGraph,
                    }
                  : autonomousRunControlReadModels(item.projectId, '', item.sessionId, {
                      autonomousRunControlSessionTickRoute: item.sessionId ? `/projects/${item.projectId}/autonomous-run-control/sessions/${encodeURIComponent(item.sessionId)}/tick` : `/projects/${item.projectId}/autonomous-run-control/sessions/active/tick`,
                    })),
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
          if (route.tail[0] === 'search') {
            return json(200, service.searchTranscripts(route.projectId, {
              query: requestUrl.searchParams.get('query') || requestUrl.searchParams.get('q') || body.query || '',
              channelId: requestUrl.searchParams.get('channelId') || body.channelId || '',
              limit: requestUrl.searchParams.get('limit') || body.limit,
            }));
          }
          const channelId = decodeURIComponent(route.tail[0]);
          if (route.tail[1] === 'members') {
            return json(200, service.getTranscriptMemberPresence(route.projectId, channelId));
          }
          return json(200, service.getChannelTranscript(route.projectId, channelId));
        }
        if (method === 'GET' && route.action === 'meeting-summaries') {
          return json(200, { meetingSummaries: service.getMeetingSummaries(route.projectId, { language }) });
        }
        if (method === 'POST' && route.action === 'transcripts') {
          if (route.tail[1] === 'pins') {
            const channelId = decodeURIComponent(route.tail[0] || body.channelId || 'main');
            const result = service.pinTranscriptMessage({
              projectId: route.projectId,
              ...body,
              channelId,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              transcriptPin: result.transcriptPin,
              transcriptPinReceipt: result.transcriptPinReceipt,
              pinnedMessage: result.pinnedMessage,
              ...(includeReadModels
                ? {}
                : deferredReadModels(resultProjectId, '', {
                    transcriptPinRoute: result.transcriptPin?.apiPath || null,
                    transcriptChannelRoute: result.transcriptPin?.channelId
                      ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptPin.channelId)}`
                      : null,
                    timelineRoute: `/projects/${resultProjectId}/timeline`,
                    eventsRoute: `/projects/${resultProjectId}/events`,
              })),
            });
          }
          if (route.tail[1] === 'channel-pin') {
            const channelId = decodeURIComponent(route.tail[0] || body.channelId || 'main');
            const result = service.pinTranscriptChannel({
              projectId: route.projectId,
              ...body,
              channelId,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              transcriptChannelPin: result.transcriptChannelPin,
              transcriptChannelPinReceipt: result.transcriptChannelPinReceipt,
              pinnedChannel: result.pinnedChannel,
              ...(includeReadModels
                ? {}
                : deferredReadModels(resultProjectId, '', {
                    transcriptChannelPinRoute: result.transcriptChannelPin?.apiPath || null,
                    transcriptChannelRoute: result.transcriptChannelPin?.channelId
                      ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptChannelPin.channelId)}`
                      : null,
                    timelineRoute: `/projects/${resultProjectId}/timeline`,
                    eventsRoute: `/projects/${resultProjectId}/events`,
                  })),
            });
          }
          if (route.tail[1] === 'replies') {
            const channelId = decodeURIComponent(route.tail[0] || body.channelId || 'main');
            const result = service.replyToTranscriptMessage({
              projectId: route.projectId,
              ...body,
              channelId,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              transcriptReply: result.transcriptReply,
              transcriptReplyReceipt: result.transcriptReplyReceipt,
              parentMessage: result.parentMessage,
              replyMessage: result.replyMessage,
              ...(includeReadModels
                ? {}
                : deferredReadModels(resultProjectId, '', {
                    transcriptReplyRoute: result.transcriptReply?.apiPath || null,
                    transcriptChannelRoute: result.transcriptReply?.channelId
                      ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptReply.channelId)}`
                      : null,
                    timelineRoute: `/projects/${resultProjectId}/timeline`,
                    eventsRoute: `/projects/${resultProjectId}/events`,
                })),
            });
          }
          if (route.tail[1] === 'mentions') {
            const channelId = decodeURIComponent(route.tail[0] || body.channelId || 'main');
            const result = service.mentionTranscriptMessage({
              projectId: route.projectId,
              ...body,
              channelId,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              transcriptMention: result.transcriptMention,
              transcriptMentionReceipt: result.transcriptMentionReceipt,
              sourceMessage: result.sourceMessage,
              mentionMessage: result.mentionMessage,
              ...(includeReadModels
                ? {}
                : deferredReadModels(resultProjectId, '', {
                    transcriptMentionRoute: result.transcriptMention?.apiPath || null,
                    transcriptChannelRoute: result.transcriptMention?.channelId
                      ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptMention.channelId)}`
                      : null,
                    timelineRoute: `/projects/${resultProjectId}/timeline`,
                    eventsRoute: `/projects/${resultProjectId}/events`,
                })),
            });
          }
          if (route.tail[1] === 'attachments') {
            const channelId = decodeURIComponent(route.tail[0] || body.channelId || 'main');
            const result = service.attachTranscriptFile({
              projectId: route.projectId,
              ...body,
              channelId,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              transcriptAttachment: result.transcriptAttachment,
              transcriptAttachmentReceipt: result.transcriptAttachmentReceipt,
              attachmentMessage: result.attachmentMessage,
              ...(includeReadModels
                ? {}
                : deferredReadModels(resultProjectId, '', {
                    transcriptAttachmentRoute: result.transcriptAttachment?.apiPath || null,
                    transcriptChannelRoute: result.transcriptAttachment?.channelId
                      ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptAttachment.channelId)}`
                      : null,
                    timelineRoute: `/projects/${resultProjectId}/timeline`,
                    eventsRoute: `/projects/${resultProjectId}/events`,
                  })),
            });
          }
          const result = service.createTranscriptChannel({
            projectId: route.projectId,
            ...body,
            channelId: body.channelId || (route.tail[0] ? decodeURIComponent(route.tail[0]) : ''),
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            transcriptChannel: result.transcriptChannel,
            transcriptChannelReceipt: result.transcriptChannelReceipt,
            ...(includeReadModels
              ? {}
              : deferredReadModels(resultProjectId, '', {
                  transcriptChannelRoute: result.transcriptChannel?.channelId
                    ? `/projects/${resultProjectId}/transcripts/${encodeURIComponent(result.transcriptChannel.channelId)}`
                    : null,
                })),
          });
        }
        if (method === 'GET' && route.action === 'product-team-missions') {
          if (!route.tail.length) {
            return json(200, { productTeamMissionRuns: service.listProductTeamMissionRuns(route.projectId) });
          }
          const missionId = decodeURIComponent(route.tail[0]);
          return json(200, { productTeamMissionRun: service.getProductTeamMissionRun(route.projectId, missionId) });
        }
        if (method === 'GET' && route.action === 'timeline') {
          return json(200, service.getTimeline(route.projectId));
        }
        if (method === 'POST' && route.action === 'timeline' && route.tail[0] === 'actions') {
          const result = service.recordTimelineAction({
            projectId: route.projectId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            timelineActionReceipt: result.timelineActionReceipt,
            timelineActionLog: result.log,
            ...(includeReadModels
              ? {
                  timeline: service.getTimeline(resultProjectId),
                  events: service.getEventLedger(resultProjectId),
                }
              : deferredReadModels(resultProjectId, '', {
                  timelineActionsRoute: `/projects/${resultProjectId}/timeline/actions`,
                  timelineActionReceiptRoute: result.timelineActionReceipt?.id
                    ? `/projects/${resultProjectId}/timeline/actions#${encodeURIComponent(result.timelineActionReceipt.id)}`
                    : null,
                  timelineLogRoute: result.log?.id
                    ? `/projects/${resultProjectId}/timeline#${encodeURIComponent(result.log.id)}`
                    : null,
                  eventLedgerRoute: result.timelineActionReceipt?.eventId
                    ? `/projects/${resultProjectId}/events#${encodeURIComponent(result.timelineActionReceipt.eventId)}`
                    : `/projects/${resultProjectId}/events`,
                })),
          });
        }
        if (method === 'GET' && route.action === 'events') {
          return json(200, service.getEventLedger(route.projectId));
        }
        if (route.action === 'project-settings') {
          if (method === 'GET') {
            return json(200, { projectSettings: service.getProjectSettings(route.projectId) });
          }
          if (['PUT', 'POST'].includes(method)) {
            const includeReadModels = shouldIncludeReadModels(body);
            const settingsInput = {
              projectId: route.projectId,
              updatedBy: body.updatedBy || body.actorUserId || body.userId || 'manager',
              source: body.source || 'project-settings-api',
              now: body.now,
            };
            if (Object.prototype.hasOwnProperty.call(body, 'language')) settingsInput.language = body.language;
            if (Object.prototype.hasOwnProperty.call(body, 'privacyPolicy')) settingsInput.privacyPolicy = body.privacyPolicy;
            if (Object.prototype.hasOwnProperty.call(body, 'providerBudgetPolicy')) settingsInput.providerBudgetPolicy = body.providerBudgetPolicy;
            if (Object.prototype.hasOwnProperty.call(body, 'workspacePolicy')) settingsInput.workspacePolicy = body.workspacePolicy;
            if (Object.prototype.hasOwnProperty.call(body, 'toolGrantPolicy')) settingsInput.toolGrantPolicy = body.toolGrantPolicy;
            const result = service.setProjectSettings(settingsInput);
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              projectSettings: result.projectSettings,
              projectSettingsAuditEntry: result.projectSettingsAuditEntry,
              log: result.log,
              ...(includeReadModels
                ? {
                    managerDashboard: service.getManagerDashboard(resultProjectId, { language: result.projectSettings.effectiveLanguage }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language: result.projectSettings.effectiveLanguage }),
                    managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language: result.projectSettings.effectiveLanguage }),
                  }
                : deferredReadModels(resultProjectId, '', {
                    projectSettingsRoute: `/projects/${resultProjectId}/project-settings`,
                  })),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
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
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            review: result.review,
            submission: result.submission,
            log: result.log,
            task: result.task,
            ...(includeReadModels
              ? {
                  managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                  managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                }
              : deferredReadModels(resultProjectId)),
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
        if (method === 'GET' && route.action === 'evidence-index-readiness') {
          return json(200, { evidenceIndexReadiness: service.getEvidenceIndexReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'memory-readiness') {
          return json(200, { projectMemoryReadiness: service.getProjectMemoryReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'budget-alert-readiness') {
          return json(200, { budgetAlertReadiness: service.getBudgetAlertReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'error-reporting-readiness') {
          return json(200, { errorReportingReadiness: service.getErrorReportingReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'brainstorm-layer') {
          return json(200, { brainstormLayer: service.getBrainstormLayer(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'artifact-quality-audit') {
          return json(200, { artifactQualityAudit: service.getArtifactQualityAudit(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'submission-review-workflow') {
          return json(200, { submissionReviewWorkflow: service.getSubmissionReviewWorkflow(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'product-team-delivery-trace') {
          return json(200, { productTeamDeliveryTrace: service.getProductTeamDeliveryTrace(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'zero-to-autonomy-report') {
          return json(200, { zeroToAutonomyReport: service.getZeroToAutonomyReport(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'product-team-operating-loop') {
          return json(200, { productTeamOperatingLoop: service.getProductTeamOperatingLoop(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'continuous-work-loop') {
          return json(200, { continuousWorkLoop: service.getContinuousWorkLoop(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'agent-state-summary') {
          return json(200, { agentStateSummary: service.getAgentStateSummary(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'governance-protocol') {
          return json(200, { governanceProtocol: service.getGovernanceProtocol(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'assignment-timeline-matrix') {
          return json(200, { assignmentTimelineMatrix: service.getAssignmentTimelineMatrix(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'change-flow') {
          return json(200, { changeFlow: service.getChangeFlow(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'planner-executor-reviewer-state-machine') {
          return json(200, { plannerExecutorReviewerStateMachine: service.getPlannerExecutorReviewerStateMachine(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'team-collaboration-diagnostics') {
          return json(200, { teamCollaborationDiagnostics: service.getTeamCollaborationDiagnostics(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'collaboration-intent-queue') {
          return json(200, { collaborationIntentQueue: service.getCollaborationIntentQueue(route.projectId, { language }) });
        }
        if (method === 'POST' && route.action === 'collaboration-intent-queue' && route.tail[1] === 'run') {
          const result = service.runCollaborationIntentQueueItem({
            projectId: route.projectId,
            intentId: decodeURIComponent(route.tail[0] || 'next'),
            requestBodyOverrides: body,
            now: body.now,
            force: Boolean(body.force || body.forceRun),
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.collaborationIntentRun?.agentId || result.agentAutonomousActionRun?.agentId || result.autonomousRunControlRun?.agentId,
            }),
            collaborationIntent: result.collaborationIntent,
            collaborationIntentRun: result.collaborationIntentRun,
            collaborationIntentQueue: result.collaborationIntentQueue,
            productTeamOperatingLoop: result.productTeamOperatingLoop,
            autonomousRunControl: result.autonomousRunControl,
            autonomousRunControlRun: result.autonomousRunControlRun,
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionQueue: result.managerActionQueue,
            agentAutonomousAction: result.agentAutonomousAction,
            agentAutonomousActionRun: result.agentAutonomousActionRun,
            agentAutonomousActionQueue: result.agentAutonomousActionQueue,
            evidenceSearch: result.evidenceSearch,
            evidenceSearchLog: result.evidenceSearchLog,
            evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
            review: result.review,
            reviewedSubmission: result.reviewedSubmission,
            reviewResponseSubmission: result.reviewResponseSubmission,
            reviewResponseArtifact: result.reviewResponseArtifact,
            submission: result.submission,
            workSubmission: result.workSubmission,
            workSubmissionLog: result.workSubmissionLog,
            artifact: result.artifact,
            providerReceipt: result.providerReceipt,
            autonomousActionDecision: result.autonomousActionDecision || result.agentAutonomousActionRun?.autonomousActionDecision || result.autonomousRunControlRun?.autonomousActionDecision || null,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.collaborationIntentRun?.agentId || result.agentAutonomousActionRun?.agentId || result.autonomousRunControlRun?.agentId,
              result.autonomousRunControlRun?.autopilotSessionId || body.autopilotSessionId || body.sessionId,
              {
                collaborationIntentQueueRoute: resultProjectId ? `/projects/${resultProjectId}/collaboration-intent-queue` : null,
                productTeamOperatingLoopRoute: resultProjectId ? `/projects/${resultProjectId}/product-team-operating-loop` : null,
                managerFlowGraphRoute: resultProjectId ? `/projects/${resultProjectId}/manager-flow-graph` : null,
              },
            )),
          });
        }
        if (method === 'GET' && route.action === 'runtime-contracts') {
          return json(200, { runtimeContracts: service.getRuntimeContracts(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'autonomous-cycle-consistency') {
          return json(200, { autonomousCycleConsistency: service.getAutonomousCycleConsistency(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'runtime-autonomy-status') {
          return json(200, { runtimeAutonomyStatus: service.getRuntimeAutonomyStatus(route.projectId, { language }) });
        }
        if (method === 'POST' && route.action === 'evidence-source-review-workflow') {
          const result = service.reviewEvidenceSource({ projectId: route.projectId, ...body });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            evidenceSourceReview: result.evidenceSourceReview,
            evidenceSearch: result.evidenceSearch,
            evidenceSourceReviewWorkflow: service.getEvidenceSourceReviewWorkflow(resultProjectId, { language }),
            log: result.log,
            task: result.task,
            submission: result.submission,
            ...(includeReadModels
              ? {
                  readinessProofMap: service.getReadinessProofMap(resultProjectId),
                  managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                  managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                }
              : deferredReadModels(resultProjectId)),
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
        if (method === 'POST' && route.action === 'meeting-report') {
          const result = service.publishKickoffMeetingReport({ projectId: route.projectId, ...body });
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, route.projectId, language, { includeReadModels }),
            route: result.route,
            meetingReport: result.meetingReport,
            submission: result.submission,
            ...(includeReadModels ? {
              managerFlowGraph: service.getManagerFlowGraph(route.projectId, { language }),
              meetingSummaries: service.getMeetingSummaries(route.projectId, { language }),
            } : deferredReadModels(route.projectId)),
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
        if (method === 'GET' && route.action === 'work-mode-acceptance') {
          const project = service.getProject(route.projectId);
          return json(200, {
            workModeAcceptance: evaluateWorkModeAcceptance({
              workModeContract: project.workModeContract,
              submissions: project.agentSubmissions || [],
              resolvedEscalationIds: project.resolvedWorkModeEscalationIds || [],
            }),
          });
        }
        if (method === 'POST' && route.action === 'work-mode-escalations' && route.tail[1] === 'resolve') {
          const escalationId = decodeURIComponent(route.tail[0] || '');
          const result = service.resolveWorkModeEscalation({
            projectId: route.projectId,
            escalationId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            workModeEscalationResolution: result.workModeEscalationResolution,
            ...(includeReadModels ? {} : deferredReadModels(resultProjectId)),
          });
        }
        if (route.action === 'agents') {
          if (method === 'GET' && !route.tail.length) {
            return json(200, { agents: service.listAgentStates(route.projectId) });
          }
          if (method === 'POST' && route.tail[0] === 'contract') {
            const result = service.contractProjectAgent({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              agentContract: result.agentContract,
              agent: result.agent,
              log: result.log,
              ...(includeReadModels
                ? {
                    agentDashboard: result.agentContract?.agentId
                      ? service.getAgentDashboard(resultProjectId, result.agentContract.agentId)
                      : null,
                    managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                  }
                : deferredReadModels(resultProjectId, result.agentContract?.agentId || '')),
            });
          }
          if (!route.tail.length) {
            return json(405, { error: 'method-not-allowed', method, path });
          }
          const agentId = decodeURIComponent(route.tail[0]);
          if (method === 'POST' && route.tail[1] === 'message') {
            const result = service.submitAgentMessage({ projectId: route.projectId, agentId, ...body });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              ...(includeReadModels
                ? { agentDashboard: service.getAgentDashboard(resultProjectId, agentId) }
                : deferredReadModels(resultProjectId, agentId)),
            });
          }
          if (method === 'POST' && route.tail[1] === 'submissions') {
            const result = service.submitAgentArtifact({ projectId: route.projectId, agentId, ...body });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              submission: result.submission,
              artifact: result.artifact,
              log: result.log,
              task: result.task,
              ...(includeReadModels
                ? {
                    agentDashboard: service.getAgentDashboard(resultProjectId, agentId),
                    managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                  }
                : deferredReadModels(resultProjectId, agentId)),
            });
          }
          if (method === 'POST' && route.tail[1] === 'artifact-drafts') {
            return json(400, { error: 'agent-artifact-draft-requires-async-handler' });
          }
          if (method === 'POST' && route.tail[1] === 'evidence-searches') {
            const result = service.recordAgentEvidenceSearch({ projectId: route.projectId, agentId, ...body });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              evidenceSearch: result.evidenceSearch,
              log: result.log,
              task: result.task,
              submission: result.submission,
              ...(includeReadModels
                ? {
                    agentDashboard: service.getAgentDashboard(resultProjectId, agentId),
                    managerFlowGraph: service.getManagerFlowGraph(resultProjectId, { language }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                  }
                : deferredReadModels(resultProjectId, agentId)),
            });
          }
          if (method === 'POST' && route.tail[1] === 'work-cycle') {
            if (body.useProviderEvidenceSearch) {
              return json(400, { error: 'agent-work-cycle-provider-evidence-requires-async-handler' });
            }
            const result = service.runAgentWorkCycle({ projectId: route.projectId, agentId, ...body });
            const resultProjectId = result.project?.id || route.projectId;
            const includeReadModels = shouldIncludeReadModels(body);
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              submission: result.submission,
              artifact: result.artifact,
              evidenceSearch: result.evidenceSearch,
              evidenceSearchLog: result.evidenceSearchLog,
              evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
              workSubmission: result.workSubmission,
              review: result.review,
              reviewedSubmission: result.reviewedSubmission,
              reviewResponseSubmission: result.reviewResponseSubmission,
              reviewResponseArtifact: result.reviewResponseArtifact,
              strategyDecision: result.strategyDecision,
              ...(includeReadModels ? {} : deferredReadModels(resultProjectId, agentId)),
            });
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
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            managerFlowGraph: result.managerFlowGraph,
            managerFlowGraphConfirmation: result.confirmation,
            ...(includeReadModels
              ? {
                  managerDashboard: service.getManagerDashboard(resultProjectId, { language }),
                  managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                }
              : deferredReadModels(resultProjectId)),
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
        if (method === 'GET' && route.action === 'production-infrastructure-rehearsal') {
          return json(200, { productionInfrastructureRehearsal: service.getProductionInfrastructureRehearsal(route.projectId, { language }) });
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProjectEvidenceExport({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              projectEvidenceExport: result.projectEvidenceExport,
              projectEvidenceExportWorkflow: result.projectEvidenceExportWorkflow,
              projectEvidenceExportPackage: result.projectEvidenceExportPackage,
              projectEvidenceArchive: result.projectEvidenceArchive,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }) }
                : projectEvidenceExportReadModels(
                    resultProjectId,
                    result.projectEvidenceExport?.exportRequestId || body.exportRequestId || '',
                  )),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordPrivatePilotReleaseCandidate({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              privatePilotReleaseCandidate: result.privatePilotReleaseCandidate,
              privatePilotReleaseCandidateWorkflow: result.privatePilotReleaseCandidateWorkflow,
              projectEvidenceExportPackage: result.projectEvidenceExportPackage,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }) }
                : privatePilotReceiptReadModels(resultProjectId, {
                    privatePilotReleaseCandidateWorkflowRoute: `/projects/${resultProjectId}/private-pilot-release-candidates`,
                    projectEvidenceExportPackageRoute: result.projectEvidenceExportPackage?.exportRequestId
                      ? `/projects/${resultProjectId}/project-evidence-exports/${encodeURIComponent(result.projectEvidenceExportPackage.exportRequestId)}/package`
                      : `/projects/${resultProjectId}/project-evidence-exports`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordPrivatePilotLaunchRun({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              privatePilotLaunchRun: result.privatePilotLaunchRun,
              privatePilotLaunchRunWorkflow: result.privatePilotLaunchRunWorkflow,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }) }
                : privatePilotReceiptReadModels(resultProjectId, {
                    privatePilotLaunchRunWorkflowRoute: `/projects/${resultProjectId}/private-pilot-launch-runs`,
                    deploymentPreflightRoute: `/projects/${resultProjectId}/deployment-preflight`,
                    operationsReadinessRoute: `/projects/${resultProjectId}/operations-readiness`,
                    providerEvalRunWorkflowRoute: `/projects/${resultProjectId}/provider-eval-runs`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordPrivatePilotLaunchHealthCheck({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              privatePilotLaunchHealthCheck: result.privatePilotLaunchHealthCheck,
              privatePilotLaunchHealthCheckWorkflow: result.privatePilotLaunchHealthCheckWorkflow,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }) }
                : privatePilotReceiptReadModels(resultProjectId, {
                    privatePilotLaunchHealthCheckWorkflowRoute: `/projects/${resultProjectId}/private-pilot-launch-health-checks`,
                    operationsReadinessRoute: `/projects/${resultProjectId}/operations-readiness`,
                    securityBoundaryRoute: `/projects/${resultProjectId}/security-boundary`,
                    workerQueueAdapterDryRunRoute: `/projects/${resultProjectId}/worker-queue-adapter-dry-run`,
                    persistenceAdapterDryRunRoute: `/projects/${resultProjectId}/persistence-adapter-dry-run`,
                    providerEvalRunWorkflowRoute: `/projects/${resultProjectId}/provider-eval-runs`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordPrivatePilotAcceptanceReport({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              privatePilotAcceptanceReport: result.privatePilotAcceptanceReport,
              privatePilotAcceptanceReportWorkflow: result.privatePilotAcceptanceReportWorkflow,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }) }
                : privatePilotReceiptReadModels(resultProjectId, {
                    privatePilotAcceptanceReportWorkflowRoute: `/projects/${resultProjectId}/private-pilot-acceptance-reports`,
                    productionOperationsReadinessRoute: `/projects/${resultProjectId}/production-operations-readiness`,
                    managerReadyPackageRoute: `/projects/${resultProjectId}/manager-ready-package`,
                    managerFlowGraphRoute: `/projects/${resultProjectId}/manager-flow-graph`,
                    readinessProofMapRoute: `/projects/${resultProjectId}/readiness-proof-map`,
                  })),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'private-pilot-go-live-readiness') {
          return json(200, {
            privatePilotGoLiveReadiness: service.getPrivatePilotGoLiveReadiness(route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'launch-operations-overview') {
          return json(200, {
            launchOperationsOverview: service.getLaunchOperationsOverview(route.projectId, { language }),
          });
        }
        if (method === 'POST' && route.action === 'launch-operations-overview' && route.tail[0] === 'public-production-next-steps' && route.tail[2] === 'run') {
          const stepId = decodeURIComponent(route.tail[1] || 'next');
          const includeReadModels = shouldIncludeReadModels(body);
          const result = service.runLaunchOperationsPublicProductionNextStep({
            projectId: route.projectId,
            stepId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            launchOperationsNextStep: result.launchOperationsNextStep,
            launchOperationsNextStepRun: result.launchOperationsNextStepRun,
            launchOperationsOverview: result.launchOperationsOverview,
            log: result.log,
            ...(includeReadModels ? {} : deferredReadModels(resultProjectId, '', {
              launchOperationsOverviewRoute: `/projects/${resultProjectId}/launch-operations-overview`,
              readinessProofMapRoute: `/projects/${resultProjectId}/readiness-proof-map`,
              managerFlowGraphRoute: `/projects/${resultProjectId}/manager-flow-graph`,
              timelineRoute: `/projects/${resultProjectId}/timeline`,
              eventsRoute: `/projects/${resultProjectId}/events`,
              launchOperationsNextStepRunRoute: `/projects/${resultProjectId}/launch-operations-overview/public-production-next-steps/${encodeURIComponent(result.launchOperationsNextStepRun?.stepId || stepId)}/run`,
              publicProductionTargetRoute: result.launchOperationsNextStepRun?.apiPath || null,
            })),
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
        if (method === 'GET' && route.action === 'production-launch-evidence-dossier') {
          return json(200, {
            productionLaunchEvidenceDossier: service.getProductionLaunchEvidenceDossier(route.projectId, { language }),
          });
        }
        if (method === 'GET' && route.action === 'production-evidence-integrity-audit') {
          return json(200, {
            productionEvidenceIntegrityAudit: service.getProductionEvidenceIntegrityAudit(route.projectId, { language }),
          });
        }
        if (route.action === 'launch-approvals') {
          if (method === 'GET') {
            return json(200, { launchApprovalWorkflow: service.getLaunchApprovalWorkflow(route.projectId, { language }) });
          }
          if (method === 'POST') {
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordLaunchApproval({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              launchApproval: result.launchApproval,
              launchApprovalWorkflow: result.launchApprovalWorkflow,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }) }
                : launchApprovalReadModels(resultProjectId)),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (route.action === 'identity-sessions') {
          if (method === 'GET') {
            return json(200, { identitySessions: service.getIdentitySessions(route.projectId) });
          }
          if (method === 'POST' && route.tail[0] && route.tail[1] === 'revoke') {
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.revokeIdentitySession({
              projectId: route.projectId,
              sessionId: decodeURIComponent(route.tail[0]),
              revokedBy: body.revokedBy || body.actorUserId || body.userId || '',
              reason: body.reason || body.summary || '',
              now: body.now,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              identitySession: result.identitySession,
              identitySessions: result.identitySessions,
              log: result.log,
              ...(includeReadModels
                ? {
                    securityBoundary: service.getSecurityBoundary(resultProjectId, { language }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                  }
                : securityBoundaryReadModels(resultProjectId, {
                    identitySessionsRoute: `/projects/${resultProjectId}/identity-sessions`,
                  })),
            });
          }
          if (method === 'POST' && !route.tail.length) {
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.issueIdentitySession({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              identitySession: result.identitySession,
              identitySessions: result.identitySessions,
              token: result.token,
              tokenContract: result.tokenContract,
              log: result.log,
              ...(includeReadModels
                ? {
                    securityBoundary: service.getSecurityBoundary(resultProjectId, { language }),
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }),
                  }
                : securityBoundaryReadModels(resultProjectId, {
                    identitySessionsRoute: `/projects/${resultProjectId}/identity-sessions`,
                  })),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'POST' && route.action === 'mvp-readiness' && route.tail[0] === 'operator-actions' && route.tail[2] === 'run') {
          const actionId = decodeURIComponent(route.tail[1] || 'next');
          const result = service.runMvpReadinessOperatorAction({
            projectId: route.projectId,
            actionId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            mvpReadinessOperatorAction: result.mvpReadinessOperatorAction,
            mvpReadinessOperatorActionRun: result.mvpReadinessOperatorActionRun,
            mvpReadiness: result.mvpReadiness,
            log: result.log,
            ...(includeReadModels ? {} : deferredReadModels(resultProjectId, '', {
              mvpReadinessRoute: `/projects/${resultProjectId}/mvp-readiness`,
              readinessProofMapRoute: `/projects/${resultProjectId}/readiness-proof-map`,
              managerFlowGraphRoute: `/projects/${resultProjectId}/manager-flow-graph`,
              timelineRoute: `/projects/${resultProjectId}/timeline`,
              eventsRoute: `/projects/${resultProjectId}/events`,
              operatorActionRunRoute: `/projects/${resultProjectId}/mvp-readiness/operator-actions/${encodeURIComponent(result.mvpReadinessOperatorActionRun?.actionId || actionId)}/run`,
              operatorActionTargetRoute: result.mvpReadinessOperatorActionRun?.apiPath || null,
              operatorActionAutonomousRunRoute: result.mvpReadinessOperatorActionRun?.autonomousRunControlRunApiPath || null,
            })),
          });
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProductionOperationsControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              productionOperationsControlReceipt: result.productionOperationsControlReceipt,
              log: result.log,
              ...(includeReadModels
                ? {
                    productionOperationsControlReceiptWorkflow: result.productionOperationsControlReceiptWorkflow,
                    productionOperationsReadiness: result.productionOperationsReadiness,
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }),
                  }
                : productionControlReceiptReadModels(resultProjectId, {
                    productionOperationsControlReceiptWorkflowRoute: `/projects/${resultProjectId}/production-operations-control-receipts`,
                    productionOperationsReadinessRoute: `/projects/${resultProjectId}/production-operations-readiness`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProductionDeploymentControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              productionDeploymentControlReceipt: result.productionDeploymentControlReceipt,
              log: result.log,
              ...(includeReadModels
                ? {
                    productionDeploymentControlReceiptWorkflow: result.productionDeploymentControlReceiptWorkflow,
                    deploymentPreflight: result.deploymentPreflight,
                    persistenceAdapterDryRun: result.persistenceAdapterDryRun,
                    workerQueueAdapterDryRun: result.workerQueueAdapterDryRun,
                    adapterGatewayPreflight: result.adapterGatewayPreflight,
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }),
                  }
                : productionControlReceiptReadModels(resultProjectId, {
                    productionDeploymentControlReceiptWorkflowRoute: `/projects/${resultProjectId}/production-deployment-control-receipts`,
                    deploymentPreflightRoute: `/projects/${resultProjectId}/deployment-preflight`,
                    persistenceAdapterDryRunRoute: `/projects/${resultProjectId}/persistence-adapter-dry-run`,
                    workerQueueAdapterDryRunRoute: `/projects/${resultProjectId}/worker-queue-adapter-dry-run`,
                    adapterGatewayPreflightRoute: `/projects/${resultProjectId}/adapter-gateway-preflight`,
                  })),
            });
          }
          return json(405, { error: 'method-not-allowed', method, path });
        }
        if (method === 'GET' && route.action === 'provider-readiness') {
          return json(200, { providerReadiness: service.getProviderReadiness(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'settings-provider-readiness') {
          return json(200, {
            settingsProviderReadiness: service.getSettingsProviderReadiness
              ? service.getSettingsProviderReadiness(route.projectId)
              : { schemaVersion: 'settings-provider-readiness/v1', projectId: route.projectId, status: 'backend-required' },
          });
        }
        if (method === 'GET' && route.action === 'settings-runtime-readiness') {
          return json(200, {
            settingsRuntimeReadiness: service.getSettingsRuntimeReadiness
              ? service.getSettingsRuntimeReadiness(route.projectId)
              : { schemaVersion: 'settings-runtime-readiness/v1', projectId: route.projectId, status: 'backend-required' },
          });
        }
        if (method === 'GET' && route.action === 'settings-integration-readiness') {
          return json(200, {
            settingsIntegrationReadiness: service.getSettingsIntegrationReadiness
              ? service.getSettingsIntegrationReadiness(route.projectId, { language })
              : { schemaVersion: 'settings-integration-readiness/v1', projectId: route.projectId, status: 'backend-required' },
          });
        }
        if (method === 'GET' && route.action === 'provider-vault-bindings') {
          return json(200, {
            providerVaultBindings: service.getProviderVaultBindings
              ? service.getProviderVaultBindings(route.projectId)
              : {
                schemaVersion: 'provider-vault-bindings/v1',
                projectId: route.projectId,
                bindings: [],
              },
          });
        }
        if (method === 'GET' && route.action === 'provider-controlled-run') {
          return json(200, { providerControlledRun: service.getProviderControlledRun(route.projectId, { language }) });
        }
        if (route.action === 'provider-eval-runs') {
          if (method === 'GET') {
            return json(200, { providerEvalRunWorkflow: service.getProviderEvalRunWorkflow(route.projectId, { language }) });
          }
          if (method === 'POST') {
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProviderEvalRun({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              providerEvalRun: result.providerEvalRun,
              providerEvalRunWorkflow: result.providerEvalRunWorkflow,
              providerControlledRun: result.providerControlledRun,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }) }
                : providerEvalRunReadModels(resultProjectId)),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProductionProviderControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              productionProviderControlReceipt: result.productionProviderControlReceipt,
              log: result.log,
              ...(includeReadModels
                ? {
                    productionProviderControlReceiptWorkflow: result.productionProviderControlReceiptWorkflow,
                    providerReadiness: result.providerReadiness,
                    providerControlledRun: result.providerControlledRun,
                    providerEvalRunWorkflow: result.providerEvalRunWorkflow,
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }),
                  }
                : productionControlReceiptReadModels(resultProjectId, {
                    productionProviderControlReceiptWorkflowRoute: `/projects/${resultProjectId}/production-provider-control-receipts`,
                    providerReadinessRoute: `/projects/${resultProjectId}/provider-readiness`,
                    providerControlledRunRoute: `/projects/${resultProjectId}/provider-controlled-run`,
                    providerEvalRunWorkflowRoute: `/projects/${resultProjectId}/provider-eval-runs`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.recordProductionSecurityControlReceipt({
              projectId: route.projectId,
              ...body,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              productionSecurityControlReceipt: result.productionSecurityControlReceipt,
              log: result.log,
              ...(includeReadModels
                ? {
                    productionSecurityControlReceiptWorkflow: result.productionSecurityControlReceiptWorkflow,
                    securityBoundary: result.securityBoundary,
                    managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language, fresh: true }),
                  }
                : productionControlReceiptReadModels(resultProjectId, {
                    productionSecurityControlReceiptWorkflowRoute: `/projects/${resultProjectId}/production-security-control-receipts`,
                    securityBoundaryRoute: `/projects/${resultProjectId}/security-boundary`,
                  })),
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
            const includeReadModels = shouldIncludeReadModels(body);
            const result = service.setProjectMembershipPolicy({
              projectId: route.projectId,
              policy: body.policy || body.projectMembershipPolicy || body,
              updatedBy: body.updatedBy || body.actorUserId || body.userId || '',
              source: body.source || 'membership-policy-api',
              now: body.now,
            });
            const resultProjectId = result.project?.id || route.projectId;
            return json(200, {
              ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
              projectMembershipPolicy: result.projectMembershipPolicy,
              projectMembershipSummary: result.projectMembershipSummary,
              projectMembershipAuditEntry: result.projectMembershipAuditEntry,
              log: result.log,
              ...(includeReadModels
                ? { managerReadyPackage: service.getManagerReadyPackage(resultProjectId, { language }) }
                : securityBoundaryReadModels(resultProjectId, {
                    membershipPolicyRoute: `/projects/${resultProjectId}/membership-policy`,
                  })),
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
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
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
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionLog: result.managerActionLog,
            managerActionQueue: result.managerActionQueue,
            managerScenarioWalkthrough: result.managerScenarioWalkthrough,
            managerScenarioWalkthroughStep: result.managerScenarioWalkthroughStep,
            schedulerTick: result.schedulerTick,
            workSubmission: result.workSubmission || result.submission,
            submission: result.submission || result.workSubmission,
            workSubmissionLog: result.workSubmissionLog,
            artifact: result.artifact,
            evidenceSearch: result.evidenceSearch,
            evidenceSearchLog: result.evidenceSearchLog,
            evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
            review: result.review,
            reviewedSubmission: result.reviewedSubmission,
            reviewResponseSubmission: result.reviewResponseSubmission,
            reviewResponseArtifact: result.reviewResponseArtifact,
          });
        }
        if (method === 'GET' && route.action === 'manager-requirement-matrix') {
          return json(200, service.getManagerRequirementMatrix(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'sync-protocol-audit') {
          return json(200, service.getSyncProtocolAudit(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-use-case-audit') {
          return json(200, service.getManagerUseCaseAudit(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'manager-action-queue') {
          return json(200, service.getManagerActionQueue(route.projectId, { language }));
        }
        if (method === 'GET' && route.action === 'autonomous-run-control' && route.tail[0] === 'sessions') {
          return json(200, { autonomousRunControlSessions: service.getAutonomousRunControlSessions(route.projectId, { language }) });
        }
        if (method === 'GET' && route.action === 'autonomous-run-control') {
          return json(200, { autonomousRunControl: service.getAutonomousRunControl(route.projectId, { language }) });
        }
        if (method === 'POST' && route.action === 'autonomous-run-control' && route.tail[0] === 'sessions' && route.tail[1] === 'start') {
          const result = service.startAutonomousRunControlSession({
            projectId: route.projectId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.autonomousRunControlSession?.agentIds?.[0],
            }),
            autonomousRunControlSession: result.autonomousRunControlSession,
            autonomousRunControlSessionTick: result.autonomousRunControlSessionTick,
            autonomousRunControlSessions: result.autonomousRunControlSessions,
            autonomousRunControl: result.autonomousRunControl,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.autonomousRunControlSession?.agentIds?.[0],
              result.autonomousRunControlSession?.id,
            )),
          });
        }
        if (method === 'POST' && route.action === 'autonomous-run-control' && route.tail[0] === 'sessions' && route.tail[2] === 'tick') {
          const result = service.tickAutonomousRunControlSession({
            projectId: route.projectId,
            sessionId: decodeURIComponent(route.tail[1] || 'active'),
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.autonomousRunControlSession?.agentIds?.[0],
            }),
            autonomousRunControlSession: result.autonomousRunControlSession,
            autonomousRunControlSessionTick: result.autonomousRunControlSessionTick,
            autonomousRunControlSessions: result.autonomousRunControlSessions,
            autonomousRunControlLoops: result.autonomousRunControlLoops,
            autonomousRunControlRuns: result.autonomousRunControlRuns,
            autonomousRunControl: result.autonomousRunControl,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.autonomousRunControlSession?.agentIds?.[0] || result.autonomousRunControlSessionTick?.agentIds?.[0],
              result.autonomousRunControlSession?.id || result.autonomousRunControlSessionTick?.sessionId || decodeURIComponent(route.tail[1] || 'active'),
            )),
          });
        }
        if (method === 'POST' && route.action === 'autonomous-run-control' && route.tail[0] === 'sessions' && route.tail[2] === 'pause') {
          const result = service.pauseAutonomousRunControlSession({
            projectId: route.projectId,
            sessionId: decodeURIComponent(route.tail[1] || 'active'),
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            autonomousRunControlSession: result.autonomousRunControlSession,
            autonomousRunControlSessions: result.autonomousRunControlSessions,
            autonomousRunControl: result.autonomousRunControl,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.autonomousRunControlSession?.agentIds?.[0],
              result.autonomousRunControlSession?.id || decodeURIComponent(route.tail[1] || 'active'),
            )),
          });
        }
        if (method === 'POST' && route.action === 'autonomous-run-control' && route.tail[0] === 'run-loop') {
          const result = service.runAutonomousRunControlLoop({
            projectId: route.projectId,
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.autonomousRunControlLoop?.agentIds?.[0],
            }),
            autonomousRunControlLoop: result.autonomousRunControlLoop,
            autonomousRunControlLoopRun: result.autonomousRunControlLoopRun,
            autonomousRunControlRuns: result.autonomousRunControlRuns,
            autonomousRunControl: result.autonomousRunControl,
            managerActionQueue: result.managerActionQueue,
            agentAutonomousActionQueue: result.agentAutonomousActionQueue,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.autonomousRunControlLoop?.agentIds?.[0],
              result.autonomousRunControlLoop?.autopilotSessionId || body.autopilotSessionId || body.sessionId,
            )),
          });
        }
        if (method === 'POST' && route.action === 'autonomous-run-control' && route.tail[1] === 'run') {
          const result = service.runAutonomousRunControlAction({
            projectId: route.projectId,
            actionId: decodeURIComponent(route.tail[0] || 'next'),
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.autonomousRunControlAction?.agentId || result.agentAutonomousAction?.agentId || result.agentAutonomousActionRun?.agentId,
            }),
            autonomousRunControlAction: result.autonomousRunControlAction,
            autonomousRunControlRun: result.autonomousRunControlRun,
            autonomousRunControl: result.autonomousRunControl,
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionQueue: result.managerActionQueue,
            agentAutonomousAction: result.agentAutonomousAction,
            agentAutonomousActionRun: result.agentAutonomousActionRun,
            agentAutonomousActionQueue: result.agentAutonomousActionQueue,
            submission: result.submission,
            workSubmission: result.workSubmission,
            workSubmissionLog: result.workSubmissionLog,
            artifact: result.artifact,
            evidenceSearch: result.evidenceSearch,
            evidenceSearchLog: result.evidenceSearchLog,
            evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
            sourceSnapshots: result.sourceSnapshots,
            providerReceipt: result.providerReceipt,
            autonomousActionDecision: result.autonomousActionDecision || result.agentAutonomousActionRun?.autonomousActionDecision || null,
            review: result.review,
            reviewedSubmission: result.reviewedSubmission,
            reviewResponseSubmission: result.reviewResponseSubmission,
            reviewResponseArtifact: result.reviewResponseArtifact,
            ...(includeReadModels ? {} : autonomousRunControlReadModels(
              resultProjectId,
              result.autonomousRunControlAction?.agentId || result.agentAutonomousAction?.agentId || result.agentAutonomousActionRun?.agentId,
              result.autonomousRunControlRun?.autopilotSessionId || body.autopilotSessionId || body.sessionId,
            )),
          });
        }
        if (method === 'GET' && route.action === 'agent-autonomous-action-queue') {
          return json(200, service.getAgentAutonomousActionQueue(route.projectId, { language }));
        }
        if (method === 'POST' && route.action === 'agent-autonomous-action-queue' && route.tail[1] === 'run') {
          const result = service.runAgentAutonomousActionQueueItem({
            projectId: route.projectId,
            agentId: decodeURIComponent(route.tail[0] || 'next'),
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, {
              includeReadModels,
              agentId: result.agentAutonomousAction?.agentId || result.agentAutonomousActionRun?.agentId,
            }),
            agentAutonomousAction: result.agentAutonomousAction,
            agentAutonomousActionRun: result.agentAutonomousActionRun,
            agentAutonomousActionQueue: result.agentAutonomousActionQueue,
            submission: result.submission,
            workSubmission: result.workSubmission,
            evidenceSearch: result.evidenceSearch,
            evidenceSearchLog: result.evidenceSearchLog,
            evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
            sourceSnapshots: result.sourceSnapshots,
            providerReceipt: result.providerReceipt,
            review: result.review,
            reviewResponseSubmission: result.reviewResponseSubmission,
          });
        }
        if (method === 'POST' && route.action === 'manager-action-queue' && route.tail[1] === 'run') {
          const result = service.runManagerActionQueueItem({
            projectId: route.projectId,
            actionId: decodeURIComponent(route.tail[0] || 'next'),
            ...body,
          });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, {
            ...publicProjectResult(result, resultProjectId, language, { includeReadModels }),
            managerAction: result.managerAction,
            managerActionRun: result.managerActionRun,
            managerActionLog: result.managerActionLog,
            managerActionQueue: result.managerActionQueue,
            schedulerTick: result.schedulerTick,
            workSubmission: result.workSubmission || result.submission,
            submission: result.submission || result.workSubmission,
            workSubmissionLog: result.workSubmissionLog,
            artifact: result.artifact,
            evidenceSearch: result.evidenceSearch,
            evidenceSearchLog: result.evidenceSearchLog,
            evidenceSearchSourceSnapshots: result.evidenceSearchSourceSnapshots,
            review: result.review,
            reviewedSubmission: result.reviewedSubmission,
            reviewResponseSubmission: result.reviewResponseSubmission,
            reviewResponseArtifact: result.reviewResponseArtifact,
          });
        }
        if (method === 'PUT' && route.action === 'get') {
          return json(200, { project: service.replaceProject(body.project) });
        }
        if (method === 'POST' && route.action === 'chat') {
          const result = service.submitChatMessage({ projectId: route.projectId, ...body });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, publicProjectResult(result, resultProjectId, language, { includeReadModels }));
        }
        if (method === 'POST' && route.action === 'meeting') {
          const result = service.submitMeetingMessage({ projectId: route.projectId, ...body });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, publicProjectResult(result, resultProjectId, language, { includeReadModels }));
        }
        if (method === 'POST' && route.action === 'change-request') {
          const result = service.submitMultiChannelChangeRequest({ projectId: route.projectId, ...body });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, publicProjectResult(result, resultProjectId, language, { includeReadModels }));
        }
        if (method === 'POST' && route.action === 'autonomous-cycle') {
          const result = service.runAutonomousCycle({ projectId: route.projectId, ...body });
          const resultProjectId = result.project?.id || route.projectId;
          const includeReadModels = shouldIncludeReadModels(body);
          return json(200, publicProjectResult(result, resultProjectId, language, { includeReadModels }));
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
  localAuthFilePath = null,
  localAuthRequired = false,
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
  const localAuth = (localAuthFilePath || localAuthRequired)
    ? createLocalAuthStore({ filePath: localAuthFilePath || `${store.filePath}.local-auth.json` })
    : null;
  const api = createAgentProjectApi({
    service,
    localAuth,
    localAuthRequired,
    accessControl: {
      ...accessControl,
      replayStore: accessControl.replayStore || store,
    },
  });

  return {
    ...api,
    service,
    store,
    localAuth,
  };
}
