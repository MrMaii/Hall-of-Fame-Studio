import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'protocol design' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Cross-domain Inventor', skill: 'brainstorm synthesis' },
];

const groups = {
  deployment: {
    domain: 'deployment',
    projectId: 'production_deployment_controls_contract_project',
    meetingId: 'production_deployment_controls_contract_meeting',
    missionId: 'production_deployment_controls_contract_mission',
    pathAction: 'production-deployment-control-receipts',
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    receiptKey: 'productionDeploymentControlReceipt',
    workflowKey: 'productionDeploymentControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionDeploymentControls',
    fullReadyField: 'readyForProductionDeployment',
    proofMapRouteField: 'productionDeploymentControlReceiptRoutes',
    proofMapSummaryField: 'productionDeploymentControlReceiptSummary',
    flowSource: 'productionDeploymentControlReceipts',
    nodeSubtype: 'production-deployment-control-receipt',
    controlCenterRowId: 'production-deployment-preflight',
    routePrefix: 'https://deploy.hofsstudio.example',
    now: '2026-06-01T12:10:00.000Z',
    controlIds: [
      'access-control-enforced',
      'replay-protection',
      'audit-fail-closed',
      'scheduler-autostart',
      'real-persistence-adapter',
      'managed-evidence-custody-storage',
      'real-queue-adapter',
      'environment-promotion-audit',
      'rollback-plan-and-smoke-test',
      'deployment-change-approval',
      'production-domain-and-tls',
    ],
  },
  security: {
    domain: 'security',
    projectId: 'production_security_controls_contract_project',
    meetingId: 'production_security_controls_contract_meeting',
    missionId: 'production_security_controls_contract_mission',
    pathAction: 'production-security-control-receipts',
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    receiptKey: 'productionSecurityControlReceipt',
    workflowKey: 'productionSecurityControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionSecurityControls',
    fullReadyField: 'readyForProductionSecurity',
    proofMapRouteField: 'productionSecurityControlReceiptRoutes',
    proofMapSummaryField: 'productionSecurityControlReceiptSummary',
    flowSource: 'productionSecurityControlReceipts',
    nodeSubtype: 'production-security-control-receipt',
    controlCenterRowId: 'security-production-boundary',
    routePrefix: 'https://security.hofsstudio.example',
    now: '2026-06-01T12:12:00.000Z',
    controlIds: [
      'managed-identity-provider',
      'service-identity-boundary',
      'managed-kms-secret-manager',
      'database-backed-rbac',
      'centralized-security-audit',
      'session-replay-hardening',
    ],
  },
  provider: {
    domain: 'provider',
    projectId: 'production_provider_controls_contract_project',
    meetingId: 'production_provider_controls_contract_meeting',
    missionId: 'production_provider_controls_contract_mission',
    pathAction: 'production-provider-control-receipts',
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    receiptKey: 'productionProviderControlReceipt',
    workflowKey: 'productionProviderControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionProviderControls',
    fullReadyField: 'readyForProductionProvider',
    proofMapRouteField: 'productionProviderControlReceiptRoutes',
    proofMapSummaryField: 'productionProviderControlReceiptSummary',
    flowSource: 'productionProviderControlReceipts',
    nodeSubtype: 'production-provider-control-receipt',
    controlCenterRowId: 'provider-production-rollout',
    routePrefix: 'https://provider.hofsstudio.example',
    now: '2026-06-01T12:14:00.000Z',
    controlIds: [
      'provider-allowlist',
      'budget-and-rate-limits',
      'agent-tool-grants',
      'failure-retry-circuit-breaker',
      'provider-audit-and-cost-ledger',
      'encrypted-secret-vault',
      'source-safety-review',
      'source-snapshot-and-provider-receipts',
      'model-output-quality-review',
      'real-provider-eval-run',
      'managed-provider-audit-storage',
      'managed-provider-eval-storage',
      'centralized-provider-cost-alerting',
      'calibrated-release-policy',
      'provider-incident-runbook',
    ],
  },
};

const group = groups[process.argv[2]];
assert(group, `Usage: node scripts/validate-production-control-receipt-contract.mjs ${Object.keys(groups).join('|')}`);

const root = fileURLToPath(new URL(`../.tmp/product-team-acceptance/production-${group.domain}-controls-focused-${process.pid}/`, import.meta.url));
const storePath = `${root}/store.json`;

const signedHeadersFor = ({
  method = 'GET',
  path,
  role = 'manager',
  userId = 'director',
  requestId = `${method}-${path}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
} = {}) => signAgentProjectAccessHeaders({
  method,
  path,
  role,
  userId,
  requestId,
  secret: ACCESS_SIGNING_SECRET,
});

function handle(api, request) {
  const response = api.handle(request);
  assert(response && typeof response.status === 'number', `Expected API response for ${request.method} ${request.path}.`);
  return response;
}

function bootstrapProject() {
  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
  });

  let response = handle(api, {
    method: 'POST',
    path: '/kickoff-meetings',
    body: {
      meetingId: group.meetingId,
      projectId: group.projectId,
      name: `Production ${group.domain} Controls Contract Project`,
      brief: `Validate production ${group.domain} control receipts for the general AI product-team system without replaying the full private-pilot chain.`,
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
      tasks: [
        { id: `task_${group.domain}_controls`, text: `Verify production ${group.domain} control receipt routing.`, assignee: 'Alan Turing', status: 'pending' },
      ],
    },
  });
  assert(response.status === 200, `Focused ${group.domain} validator must create a kickoff meeting.`);

  response = handle(api, {
    method: 'POST',
    path: '/product-team-missions',
    body: {
      includeReadModels: false,
      missionId: group.missionId,
      meetingId: group.meetingId,
      kickoffMeetingId: group.meetingId,
      reuseExistingKickoffMeeting: true,
      projectId: group.projectId,
      name: `Production ${group.domain} Controls Contract Project`,
      missionBrief: `Use the generic product-team backend to verify production ${group.domain} control receipt contracts.`,
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        { id: `task_${group.domain}_controls`, text: `Verify production ${group.domain} control receipt routing.`, assignee: 'Alan Turing', status: 'pending' },
      ],
      maxLoops: 1,
      maxStepsPerLoop: 1,
      runInitialTick: false,
      now: '2026-06-01T10:01:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === group.projectId, `Focused ${group.domain} validator must create a backend project.`);

  response = handle(api, {
    method: 'PUT',
    path: `/projects/${group.projectId}/membership-policy`,
    body: {
      includeReadModels: false,
      updatedBy: 'director',
      source: `production-${group.domain}-controls-focused-validator`,
      policy: {
        schemaVersion: 'project-membership-policy/v1',
        projectId: group.projectId,
        managerUserIds: ['director'],
        securityAdminUserIds: ['security-lead'],
        operationsOwnerUserIds: ['ops-lead'],
        runtimeUserIds: ['runtime-ops'],
        observerUserIds: ['observer'],
        agentIds: team.map((member) => member.id),
        reviewerAgentIds: ['curie'],
        agentUserIds: Object.fromEntries(team.map((member) => [member.id, [`agent-runtime-${member.id}`]])),
        reviewerUserIds: { curie: ['agent-runtime-curie'] },
      },
    },
  });
  assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', `Focused ${group.domain} validator must persist project membership policy.`);
}

function run() {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  bootstrapProject();

  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      requireProjectMembership: true,
    },
  });

  const receiptPath = `/projects/${group.projectId}/${group.pathAction}`;
  const proofMapPath = `/projects/${group.projectId}/readiness-proof-map`;
  const flowGraphPath = `/projects/${group.projectId}/manager-flow-graph`;
  const launchControlPath = `/projects/${group.projectId}/production-launch-control-center`;
  const evidenceIntegrityPath = `/projects/${group.projectId}/production-evidence-integrity-audit`;

  let response = handle(api, {
    method: 'GET',
    path: receiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: receiptPath,
      role: group.role,
      userId: group.userId,
    }),
  });
  assert(response.status === 200 && response.body[group.workflowKey]?.schemaVersion === `production-${group.domain}-control-receipt-workflow/v1`, `Focused ${group.domain} gate must expose the receipt workflow.`);
  assert(response.body[group.workflowKey][group.controlsReadyField] === false, `Focused ${group.domain} workflow must start with missing controls.`);
  assert(response.body[group.workflowKey].missingControlIds?.length === group.controlIds.length, `Focused ${group.domain} workflow must list every required control before receipts.`);

  response = handle(api, {
    method: 'POST',
    path: receiptPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: receiptPath,
      role: 'observer',
      userId: 'observer',
      requestId: `observer-cannot-write-production-${group.domain}-controls`,
    }),
    body: {
      actorRole: 'observer',
      actorId: 'observer',
      controls: [],
    },
  });
  assert(response.status === 403, `Observer membership must not write production ${group.domain} control receipts.`);

  response = handle(api, {
    method: 'POST',
    path: receiptPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: receiptPath,
      role: group.role,
      userId: group.userId,
      requestId: `${group.domain}-records-production-controls`,
    }),
    body: {
      actorRole: group.actorRole,
      actorId: group.actorId,
      reason: `Record production ${group.domain} control evidence receipts through the focused backend validator.`,
      now: group.now,
      includeReadModels: false,
      controls: group.controlIds.map((controlId) => ({
        controlId,
        status: 'verified',
        evidenceId: `focused_prod_${group.domain}_${controlId}_receipt`,
        evidenceRoute: `${group.routePrefix}/hofs/${controlId}`,
        evidenceChecksum: `focused_prod_${group.domain}_${controlId}_checksum`,
        completedAt: group.now,
        ownerRole: group.actorRole,
        detail: `Verified ${controlId} for production ${group.domain} control routing.`,
      })),
    },
  });
  assert(response.status === 200 && response.body[group.receiptKey]?.schemaVersion === `production-${group.domain}-control-receipt/v1`, `Focused ${group.domain} gate must record control receipts.`);
  assert(response.body[group.receiptKey][group.controlsReadyField] === true, `Focused ${group.domain} receipt must verify every required control.`);
  assert(response.body[group.receiptKey].verifiedControlIds?.length === group.controlIds.length, `Focused ${group.domain} receipt must preserve every verified control id.`);
  assert(response.body[group.receiptKey].eventId && response.body[group.receiptKey].timelineLogId, `Focused ${group.domain} receipt must write timeline and event proof.`);
  assert(response.body[group.workflowKey]?.[group.controlsReadyField] === true, `Focused ${group.domain} write must immediately return the updated workflow when detailed read models are omitted.`);
  assert(response.body.readModels?.included === false && response.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package'), `Focused ${group.domain} writes must stay lightweight and return refresh routes.`);
  assert(!response.body.managerReadyPackage && !response.body.managerDashboard, `Focused ${group.domain} writes must not embed large Manager read models when includeReadModels is false.`);

  response = handle(api, {
    method: 'GET',
    path: receiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: receiptPath,
      role: group.role,
      userId: group.userId,
    }),
  });
  assert(response.status === 200 && response.body[group.workflowKey]?.[group.controlsReadyField] === true, `Standalone ${group.domain} workflow must stay controls-ready after the receipt write.`);
  assert(response.body[group.workflowKey].summary?.verifiedControlCount === group.controlIds.length, `Standalone ${group.domain} workflow must summarize verified control coverage.`);
  assert(response.body[group.workflowKey].latestReceipt?.eventId && response.body[group.workflowKey].latestReceipt?.timelineLogId, `Standalone ${group.domain} workflow must preserve event and timeline proof.`);

  response = handle(api, {
    method: 'GET',
    path: proofMapPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: proofMapPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body[group.proofMapRouteField]?.some((route) => (
    route.apiPath?.endsWith(`/${group.pathAction}`)
    && route[group.controlsReadyField] === true
    && route.verifiedControlIds?.length === group.controlIds.length
    && route.proofIds?.length >= group.controlIds.length
    && route.timelineLogIds?.length
    && route.eventIds?.length
  )), `Readiness Proof Map must expose focused ${group.domain} receipt proof.`);
  assert(response.body[group.proofMapSummaryField]?.readyCount >= 1, `Readiness Proof Map must summarize focused ${group.domain} receipt readiness.`);

  response = handle(api, {
    method: 'GET',
    path: flowGraphPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: flowGraphPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.nodes?.some((node) => (
    node.subtype === group.nodeSubtype
    && node.status === 'confirmed'
    && node.route?.endsWith(`/${group.pathAction}`)
    && node.proofIds?.length >= group.controlIds.length
    && node.timelineLogIds?.length
    && node.eventIds?.length
    && node.attachments?.some((attachment) => attachment.type === group.nodeSubtype)
  )), `Manager Flow Graph must expose a confirmed ${group.domain} receipt node with proof.`);
  assert(response.body.edges?.some((edge) => (
    edge.source === group.flowSource
    && edge.toNodeId?.includes(`production-${group.domain}-control-receipt-`)
    && edge.timelineLogIds?.length
    && edge.eventIds?.length
  )), `Manager Flow Graph must connect focused ${group.domain} receipts.`);

  response = handle(api, {
    method: 'GET',
    path: launchControlPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: launchControlPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1', `Focused ${group.domain} gate must expose the launch control center.`);
  assert(response.body.productionLaunchControlCenter.readyForProduction === false, `Launch control center must remain no-go after ${group.domain} receipts alone.`);
  assert(response.body.productionLaunchControlCenter.controlRows?.some((row) => (
    row.id === group.controlCenterRowId
    && row.apiPath?.endsWith(`/${group.pathAction}`)
  )), `Launch control center must route focused ${group.domain} controls.`);

  response = handle(api, {
    method: 'GET',
    path: evidenceIntegrityPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: evidenceIntegrityPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', `Focused ${group.domain} gate must expose production evidence integrity audit.`);
  assert(response.body.productionEvidenceIntegrityAudit.readyForProduction === false, `Evidence integrity audit must remain blocked after unsigned ${group.domain} receipts.`);
  assert(response.body.productionEvidenceIntegrityAudit.rows?.filter((row) => row.domain === group.domain && row.evidenceTier === 'external-unattested' && row.attestationSignatureReady === false).length === group.controlIds.length, `Evidence integrity audit must reject unsigned external ${group.domain} receipts as managed-production proof.`);

  const persistedApi = createFileBackedAgentProjectApi({
    filePath: storePath,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      requireProjectMembership: true,
    },
  });
  response = handle(persistedApi, {
    method: 'GET',
    path: receiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: receiptPath,
      role: group.role,
      userId: group.userId,
      requestId: `persisted-${group.domain}-receipt-readback`,
    }),
  });
  assert(response.status === 200 && response.body[group.workflowKey]?.latestReceipt?.verifiedControlIds?.length === group.controlIds.length, `File-backed API must persist production ${group.domain} control receipts.`);
}

try {
  run();
} finally {
  if (process.env.HOFS_KEEP_TMP !== '1') {
    rmSync(root, { recursive: true, force: true });
  }
}
