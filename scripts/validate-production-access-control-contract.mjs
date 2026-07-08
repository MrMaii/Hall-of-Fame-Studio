import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import {
  buildAccessControlPolicySnapshot,
  signAgentProjectAccessHeaders,
} from '../src/agents/accessControl.js';

const ACCESS_SIGNING_SECRET = 'production-access-control-contract-secret';
const projectId = 'production_access_control_contract_project';
const accessEnvKeys = [
  'AGENT_ACCESS_CONTROL_MODE',
  'AGENT_ACCESS_SIGNING_SECRET',
  'AGENT_ACCESS_REPLAY_PROTECTION',
  'AGENT_ACCESS_AUDIT_FAIL_CLOSED',
];
const savedEnv = Object.fromEntries(accessEnvKeys.map((key) => [key, process.env[key]]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function restoreEnv() {
  for (const key of accessEnvKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

function clearAccessEnv() {
  for (const key of accessEnvKeys) delete process.env[key];
}

function setStrictAccessEnv() {
  process.env.AGENT_ACCESS_CONTROL_MODE = 'enforced';
  process.env.AGENT_ACCESS_SIGNING_SECRET = ACCESS_SIGNING_SECRET;
  process.env.AGENT_ACCESS_REPLAY_PROTECTION = 'true';
  process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED = 'true';
}

function signedHeadersFor({
  method = 'GET',
  path,
  role = 'manager',
  userId = 'director',
  agentId = '',
  requestId = `${method}-${path}-${role}-${userId}-${agentId || 'user'}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
  secret = ACCESS_SIGNING_SECRET,
} = {}) {
  return signAgentProjectAccessHeaders({
    method,
    path,
    role,
    userId,
    agentId,
    requestId,
    secret,
  });
}

function handle(api, request) {
  const response = api.handle(request);
  assert(response && typeof response.status === 'number', `Expected API response for ${request.method} ${request.path}.`);
  return response;
}

function buildReadiness() {
  return createAgentProjectService().getPublicProductionStartupReadiness();
}

function assertDefaultStartupBlocker() {
  clearAccessEnv();
  const readiness = buildReadiness();
  const setupRow = readiness.productionEnvironmentSetup?.rows?.find((row) => row.id === 'access-control');
  const action = readiness.publicProductionActionPlan?.actions?.find((row) => row.id === 'setup-access-control');

  assert(readiness.readyForPublicProduction === false, 'Default public-production startup readiness must stay blocked.');
  assert(readiness.nextAction?.id === 'access-control-enforced', 'Default startup readiness must point first to access-control enforcement.');
  assert(setupRow?.status === 'blocked', 'Default production setup matrix must block access control.');
  assert(setupRow.missingRequiredEnvVars?.includes('AGENT_ACCESS_CONTROL_MODE'), 'Access-control setup row must require AGENT_ACCESS_CONTROL_MODE.');
  assert(setupRow.missingRequiredEnvVars?.includes('AGENT_ACCESS_SIGNING_SECRET'), 'Access-control setup row must require AGENT_ACCESS_SIGNING_SECRET.');
  assert(setupRow.missingRequiredEnvVars?.includes('AGENT_ACCESS_REPLAY_PROTECTION'), 'Access-control setup row must require AGENT_ACCESS_REPLAY_PROTECTION.');
  assert(setupRow.missingRequiredEnvVars?.includes('AGENT_ACCESS_AUDIT_FAIL_CLOSED'), 'Access-control setup row must require AGENT_ACCESS_AUDIT_FAIL_CLOSED.');
  assert(action?.validationCommand === 'npm run agents:public-production-startup-readiness', 'Public production action plan must route setup-access-control to the startup readiness gate.');
}

function assertStrictStartupGatePassesOnlyAccessControl() {
  setStrictAccessEnv();
  const readiness = buildReadiness();
  const setupRow = readiness.productionEnvironmentSetup?.rows?.find((row) => row.id === 'access-control');

  assert(readiness.gates?.some((gate) => gate.id === 'access-control-enforced' && gate.passed === true), 'Strict access env must pass the access-control startup gate.');
  assert(setupRow?.status === 'ready', 'Strict access env must mark the access-control setup row ready.');
  assert(!readiness.publicProductionActionPlan?.actions?.some((row) => row.id === 'setup-access-control'), 'Strict access env must remove setup-access-control from the blocked action plan.');
  assert(readiness.readyForPublicProduction === false, 'Strict access env alone must not approve public production.');
  assert(readiness.publicProductionActionPlan?.actions?.some((row) => row.id === 'setup-managed-identity'), 'Public production action plan must continue to the next managed-production blocker.');
}

function createBootstrappedService() {
  const service = createAgentProjectService();
  const openApi = createAgentProjectApi({ service });
  const team = [
    { id: 'ada', name: 'Ada Lovelace', role: 'Systems Designer' },
    { id: 'turing', name: 'Alan Turing', role: 'Runtime Engineer' },
    { id: 'curie', name: 'Marie Curie', role: 'Reviewer' },
  ];

  let response = handle(openApi, {
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Production Access Control Contract Project',
      brief: 'Validate production access-control enforcement for the general AI product-team backend.',
      team,
      selectedLeaderId: 'ada',
      reviewerId: 'curie',
      now: '2026-07-07T09:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Production access-control contract must create a backend project.');

  response = handle(openApi, {
    method: 'PUT',
    path: `/projects/${projectId}/membership-policy`,
    body: {
      includeReadModels: false,
      updatedBy: 'security-lead',
      source: 'production-access-control-contract-validator',
      policy: {
        schemaVersion: 'project-membership-policy/v1',
        projectId,
        managerUserIds: ['director'],
        securityAdminUserIds: ['security-lead'],
        operationsOwnerUserIds: ['ops-lead'],
        runtimeUserIds: ['runtime-ops'],
        observerUserIds: ['observer'],
        agentIds: team.map((member) => member.id),
        reviewerAgentIds: ['curie'],
        agentUserIds: {
          ada: ['agent-runtime-ada'],
          turing: ['agent-runtime-turing'],
        },
        reviewerUserIds: {
          curie: ['agent-runtime-curie'],
        },
      },
    },
  });
  assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Production access-control contract must persist project membership policy.');

  return service;
}

function assertStrictApiAccessBehavior() {
  const service = createBootstrappedService();
  const api = createAgentProjectApi({
    service,
    accessControl: {
      defaultMode: 'enforced',
      signingSecret: ACCESS_SIGNING_SECRET,
      requireSignedRequestIds: true,
      requireProjectMembership: true,
      failClosedOnAuditError: true,
    },
  });
  const dashboardPath = `/projects/${projectId}/manager-dashboard`;

  let response = handle(api, {
    method: 'GET',
    path: dashboardPath,
  });
  assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-missing', 'Strict API must reject unsigned project reads.');

  response = handle(api, {
    method: 'GET',
    path: dashboardPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: dashboardPath,
      userId: 'outsider',
      requestId: 'outsider-membership-denied',
    }),
  });
  assert(response.status === 403 && response.body.accessDecision?.membership?.status === 'denied', 'Strict API must reject signed users outside the project membership policy.');

  const managerHeaders = signedHeadersFor({
    method: 'GET',
    path: dashboardPath,
    requestId: 'manager-dashboard-read-once',
  });
  response = handle(api, {
    method: 'GET',
    path: dashboardPath,
    headers: managerHeaders,
  });
  assert(response.status === 200 && response.body.projectId === projectId, 'Strict API must allow signed project manager reads.');

  response = handle(api, {
    method: 'GET',
    path: dashboardPath,
    headers: managerHeaders,
  });
  assert(response.status === 403 && response.body.accessDecision?.replay?.detected === true, 'Strict API must reject a reused signed request id.');

  const chatPath = `/projects/${projectId}/chat`;
  response = handle(api, {
    method: 'POST',
    path: chatPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: chatPath,
      role: 'observer',
      userId: 'observer',
      requestId: 'observer-chat-write-denied',
    }),
    body: {
      includeReadModels: false,
      message: 'Observer should not write project chat.',
    },
  });
  assert(response.status === 403 && response.body.accessDecision?.actor?.role === 'observer', 'Strict API must deny observer project writes.');

  const ownAgentPath = `/projects/${projectId}/agents/ada/dashboard`;
  response = handle(api, {
    method: 'GET',
    path: ownAgentPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: ownAgentPath,
      role: 'agent',
      agentId: 'ada',
      userId: 'agent-runtime-ada',
      requestId: 'ada-reads-own-dashboard',
    }),
  });
  assert(response.status === 200 && response.body.agent?.id === 'ada', 'Strict API must allow an Agent to read its own dashboard.');

  const crossAgentPath = `/projects/${projectId}/agents/turing/dashboard`;
  response = handle(api, {
    method: 'GET',
    path: crossAgentPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: crossAgentPath,
      role: 'agent',
      agentId: 'ada',
      userId: 'agent-runtime-ada',
      requestId: 'ada-cross-agent-dashboard-denied',
    }),
  });
  assert(response.status === 403 && response.body.accessDecision?.route?.agentId === 'turing', 'Strict API must deny cross-Agent dashboard access.');

  const audit = service.getSecurityAccessAudit(projectId);
  assert(audit.schemaVersion === 'security-access-audit/v1', 'Strict API must expose the security access audit read model.');
  assert(audit.count >= 6, 'Strict API must persist allowed and denied security access audit rows.');
  assert(audit.deniedCount >= 4, 'Strict API must include denied access decisions in the audit.');
  assert(audit.stream?.hashChainReady === true, 'Strict API audit stream must preserve hash-chain readiness.');
}

function assertAuditFailClosedWithoutSink() {
  const api = createAgentProjectApi({
    service: {},
    accessControl: {
      defaultMode: 'enforced',
      signingSecret: ACCESS_SIGNING_SECRET,
      failClosedOnAuditError: true,
    },
  });
  const path = '/projects/audit_sink_missing/manager-dashboard';
  const response = handle(api, {
    method: 'GET',
    path,
    headers: signedHeadersFor({
      method: 'GET',
      path,
      requestId: 'audit-sink-missing',
    }),
  });
  assert(response.status === 503 && response.body.accessDecision?.audit?.status === 'failed', 'Fail-closed access control must reject when the audit sink is missing.');
}

function assertPolicySnapshotDocumentsContracts() {
  const snapshot = buildAccessControlPolicySnapshot();
  assert(snapshot.schemaVersion === 'access-control-policy/v1', 'Access control policy snapshot must expose its schema.');
  assert(snapshot.signedIdentityContract?.algorithm === 'hmac-sha256', 'Policy snapshot must document signed identity headers.');
  assert(snapshot.replayProtectionContract?.requestIdHeader === 'x-hofs-request-id', 'Policy snapshot must document replay request ids.');
  assert(snapshot.auditWriteContract?.failureStatusCode === 503, 'Policy snapshot must document fail-closed audit behavior.');
  assert(snapshot.projectMembershipContract?.schemaVersion === 'project-membership-policy/v1', 'Policy snapshot must document project membership enforcement.');
}

function assertApiPolicyRouteDocumentsContracts() {
  setStrictAccessEnv();
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = handle(api, {
    method: 'GET',
    path: '/access-control-policy',
  });
  const policy = response.body.accessControlPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Access control policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'access-control-policy/v1', 'Access control policy route must expose access-control-policy/v1.');
  assert(policy.apiPath === '/access-control-policy', 'Access control policy route must expose its API path.');
  assert(policy.relatedRoutes?.publicProductionStartupReadiness === '/public-production-startup-readiness', 'Access control policy route must link the public-production startup readiness route.');
  assert(policy.relatedRoutes?.projectMembershipPolicy === '/projects/:projectId/membership-policy', 'Access control policy route must link the membership policy route template.');
  assert(policy.relatedRoutes?.securityAccessAudit === '/projects/:projectId/security-access-audit', 'Access control policy route must link the security access audit route template.');
  assert(policy.signedIdentityContract?.canonicalPayload?.includes('METHOD\\nPATH\\nMODE'), 'Access control policy route must document the signature payload shape.');
  assert(policy.replayProtectionContract?.requestIdHeader === 'x-hofs-request-id', 'Access control policy route must document replay request id headers.');
  assert(policy.auditWriteContract?.failureStatusCode === 503, 'Access control policy route must document fail-closed audit status.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Access control policy route must not leak the configured signing secret.');
}

try {
  assertDefaultStartupBlocker();
  assertStrictStartupGatePassesOnlyAccessControl();
  assertStrictApiAccessBehavior();
  assertAuditFailClosedWithoutSink();
  assertPolicySnapshotDocumentsContracts();
  assertApiPolicyRouteDocumentsContracts();
  console.log('production-access-control-contract: ok');
} finally {
  restoreEnv();
}
