import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';

const root = fileURLToPath(new URL(`../.tmp/product-team-acceptance/production-ops-controls-focused-${process.pid}/`, import.meta.url));
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'protocol design' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Cross-domain Inventor', skill: 'brainstorm synthesis' },
];

const productionOperationsControlIds = [
  'centralized-logs',
  'centralized-metrics',
  'centralized-traces',
  'alert-routing',
  'on-call-ownership',
  'managed-incident-system',
  'real-restore-drill',
  'managed-persistence-cutover',
  'managed-worker-queue-cutover',
  'centralized-audit-retention',
];

const projectId = 'production_ops_controls_contract_project';
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
      meetingId: 'production_ops_controls_contract_meeting',
      projectId,
      name: 'Production Operations Controls Contract Project',
      brief: 'Validate production operations control receipts for the general AI product-team system without replaying the full private-pilot chain.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
      tasks: [
        { id: 'task_ops_controls', text: 'Verify production operations control receipt routing.', assignee: 'Alan Turing', status: 'pending' },
      ],
    },
  });
  assert(response.status === 200, 'Focused ops-control validator must create a kickoff meeting.');

  response = handle(api, {
    method: 'POST',
    path: '/product-team-missions',
    body: {
      includeReadModels: false,
      missionId: 'production_ops_controls_contract_mission',
      meetingId: 'production_ops_controls_contract_meeting',
      kickoffMeetingId: 'production_ops_controls_contract_meeting',
      reuseExistingKickoffMeeting: true,
      projectId,
      name: 'Production Operations Controls Contract Project',
      missionBrief: 'Use the generic product-team backend to verify production operations control receipt contracts.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        { id: 'task_ops_controls', text: 'Verify production operations control receipt routing.', assignee: 'Alan Turing', status: 'pending' },
      ],
      maxLoops: 1,
      maxStepsPerLoop: 1,
      runInitialTick: false,
      now: '2026-06-01T10:01:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Focused ops-control validator must create a backend project.');

  response = handle(api, {
    method: 'PUT',
    path: `/projects/${projectId}/membership-policy`,
    body: {
      includeReadModels: false,
      updatedBy: 'director',
      source: 'production-ops-controls-focused-validator',
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
        agentUserIds: Object.fromEntries(team.map((member) => [member.id, [`agent-runtime-${member.id}`]])),
        reviewerUserIds: { curie: ['agent-runtime-curie'] },
      },
    },
  });
  assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Focused ops-control validator must persist project membership policy.');
}

function run() {
  bootstrapProject();

  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      requireProjectMembership: true,
    },
  });

  const operationsReceiptPath = `/projects/${projectId}/production-operations-control-receipts`;
  const operationsReadinessPath = `/projects/${projectId}/production-operations-readiness`;
  const readinessProofMapPath = `/projects/${projectId}/readiness-proof-map`;
  const managerFlowGraphPath = `/projects/${projectId}/manager-flow-graph`;
  const launchControlCenterPath = `/projects/${projectId}/production-launch-control-center`;
  const evidenceIntegrityPath = `/projects/${projectId}/production-evidence-integrity-audit`;

  let response = handle(api, {
    method: 'GET',
    path: operationsReceiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: operationsReceiptPath,
      role: 'security-admin',
      userId: 'security-lead',
    }),
  });
  assert(response.status === 200 && response.body.productionOperationsControlReceiptWorkflow?.schemaVersion === 'production-operations-control-receipt-workflow/v1', 'Ops focused gate must expose the operations receipt workflow.');
  assert(response.body.productionOperationsControlReceiptWorkflow.readyForProductionOperationsControls === false, 'Ops receipt workflow must start with missing production operations controls.');
  assert(response.body.productionOperationsControlReceiptWorkflow.missingControlIds?.length === productionOperationsControlIds.length, 'Ops receipt workflow must list every required control before receipts.');

  response = handle(api, {
    method: 'GET',
    path: operationsReadinessPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: operationsReadinessPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.productionOperationsReadiness?.schemaVersion === 'production-operations-readiness/v1', 'Ops focused gate must expose production operations readiness.');
  assert(response.body.productionOperationsReadiness.readyForProduction === false, 'Production operations readiness must not claim public production before receipts.');
  assert(response.body.productionOperationsReadiness.readyForManagedProductionOperationsEvidence === undefined, 'Production operations readiness must keep managed evidence inside the managedProductionEvidence model.');
  assert(response.body.productionOperationsReadiness.managedProductionEvidence?.readyForManagedProductionOperationsEvidence === false, 'Managed-production operations evidence must start blocked.');

  response = handle(api, {
    method: 'POST',
    path: operationsReceiptPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: operationsReceiptPath,
      role: 'observer',
      userId: 'observer',
      requestId: 'observer-cannot-write-production-ops-controls',
    }),
    body: {
      actorRole: 'observer',
      actorId: 'observer',
      controls: [],
    },
  });
  assert(response.status === 403, 'Observer membership must not write production operations control receipts.');

  response = handle(api, {
    method: 'POST',
    path: operationsReceiptPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: operationsReceiptPath,
      role: 'security-admin',
      userId: 'security-lead',
      requestId: 'security-admin-records-production-ops-controls',
    }),
    body: {
      actorRole: 'security-admin',
      actorId: 'security-lead',
      reason: 'Record production operations control evidence receipts from managed observability, incident, restore, audit, database, and queue systems.',
      now: '2026-06-01T12:08:00.000Z',
      includeReadModels: false,
      controls: productionOperationsControlIds.map((controlId) => ({
        controlId,
        status: 'verified',
        evidenceId: `focused_prod_ops_${controlId}_receipt`,
        evidenceRoute: `https://ops.hofsstudio.example/hofs/${controlId}`,
        evidenceChecksum: `focused_prod_ops_${controlId}_checksum`,
        completedAt: '2026-06-01T12:07:30.000Z',
        ownerRole: controlId.includes('audit') ? 'security-admin' : 'operations-owner',
        detail: `Verified ${controlId} for production operations control routing.`,
      })),
    },
  });
  assert(response.status === 200 && response.body.productionOperationsControlReceipt?.schemaVersion === 'production-operations-control-receipt/v1', 'Security admin must record production operations control receipts.');
  assert(response.body.productionOperationsControlReceipt.readyForProductionOperationsControls === true, 'Ops receipt must verify every required production operations control.');
  assert(response.body.productionOperationsControlReceipt.readyForProductionOperations === false, 'Focused ops receipt must not imply private-pilot operations proof.');
  assert(response.body.productionOperationsControlReceipt.verifiedControlIds?.length === productionOperationsControlIds.length, 'Ops receipt must preserve every verified control id.');
  assert(response.body.productionOperationsControlReceipt.eventId && response.body.productionOperationsControlReceipt.timelineLogId, 'Ops receipt must write timeline and event proof.');
  assert(response.body.productionOperationsControlReceiptWorkflow?.readyForProductionOperationsControls === true, 'Ops receipt write must immediately return the updated workflow when detailed read models are omitted.');
  assert(response.body.readModels?.included === false && response.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package'), 'Ops receipt writes must stay lightweight and return refresh routes.');
  assert(response.body.readModels?.productionOperationsControlReceiptWorkflowRoute?.endsWith('/production-operations-control-receipts'), 'Ops receipt writes must return the standalone workflow refresh route.');
  assert(!response.body.managerReadyPackage && !response.body.managerDashboard, 'Ops receipt writes must not embed large Manager read models when includeReadModels is false.');

  response = handle(api, {
    method: 'GET',
    path: operationsReceiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: operationsReceiptPath,
      role: 'security-admin',
      userId: 'security-lead',
    }),
  });
  assert(response.status === 200 && response.body.productionOperationsControlReceiptWorkflow?.readyForProductionOperationsControls === true, 'Standalone ops receipt workflow must stay ready after the receipt write.');
  assert(response.body.productionOperationsControlReceiptWorkflow.summary?.verifiedControlCount === productionOperationsControlIds.length, 'Standalone ops receipt workflow must summarize verified control coverage.');
  assert(response.body.productionOperationsControlReceiptWorkflow.latestReceipt?.eventId && response.body.productionOperationsControlReceiptWorkflow.latestReceipt?.timelineLogId, 'Standalone ops receipt workflow must preserve event and timeline proof.');

  response = handle(api, {
    method: 'GET',
    path: readinessProofMapPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: readinessProofMapPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.productionOperationsControlReceiptRoutes?.some((route) => (
    route.apiPath?.endsWith('/production-operations-control-receipts')
    && route.readyForProductionOperationsControls === true
    && route.readyForProductionOperations === false
    && route.verifiedControlIds?.length === productionOperationsControlIds.length
    && route.proofIds?.length >= productionOperationsControlIds.length
    && route.timelineLogIds?.length
    && route.eventIds?.length
  )), 'Readiness Proof Map must expose ops receipt proof without overclaiming full production operations readiness.');
  assert(response.body.productionOperationsControlReceiptSummary?.readyCount >= 1, 'Readiness Proof Map must summarize ops receipt readiness.');
  assert(response.body.productionOperationsControlReceiptSummary?.readyForProductionOperations === false, 'Readiness Proof Map must keep full production operations readiness blocked without private-pilot proof.');

  response = handle(api, {
    method: 'GET',
    path: managerFlowGraphPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: managerFlowGraphPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.nodes?.some((node) => (
    node.subtype === 'production-operations-control-receipt'
    && node.status === 'confirmed'
    && node.route?.endsWith('/production-operations-control-receipts')
    && node.proofIds?.length >= productionOperationsControlIds.length
    && node.timelineLogIds?.length
    && node.eventIds?.length
    && node.attachments?.some((attachment) => attachment.type === 'production-operations-control-receipt')
  )), 'Manager Flow Graph must expose a confirmed ops receipt node with proof.');
  assert(response.body.edges?.some((edge) => (
    edge.source === 'productionOperationsControlReceipts'
    && edge.fromNodeId === 'production-operations-readiness'
    && edge.toNodeId?.startsWith('production-operations-control-receipt-')
    && edge.timelineLogIds?.length
    && edge.eventIds?.length
  )), 'Manager Flow Graph must connect ops receipts to production operations readiness.');

  response = handle(api, {
    method: 'GET',
    path: launchControlCenterPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: launchControlCenterPath,
      role: 'manager',
      userId: 'director',
    }),
  });
  assert(response.status === 200 && response.body.productionLaunchControlCenter?.schemaVersion === 'production-launch-control-center/v1', 'Ops focused gate must expose the production launch control center.');
  assert(response.body.productionLaunchControlCenter.readyForProduction === false, 'Launch control center must remain no-go after ops receipts alone.');
  assert(response.body.productionLaunchControlCenter.controlRows?.some((row) => (
    row.id === 'production-operations-controls'
    && row.ready === false
    && row.apiPath?.endsWith('/production-operations-control-receipts')
  )), 'Launch control center must route production operations controls while full readiness remains blocked.');

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
  assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Ops focused gate must expose production evidence integrity audit.');
  assert(response.body.productionEvidenceIntegrityAudit.readyForProduction === false, 'Evidence integrity audit must remain blocked after local ops receipts.');
  assert(response.body.productionEvidenceIntegrityAudit.summary?.externalUnattestedControlCount >= productionOperationsControlIds.length, 'Evidence integrity audit must count unsigned external ops receipts as unattested evidence.');
  assert(response.body.productionEvidenceIntegrityAudit.rows?.filter((row) => row.domain === 'operations' && row.evidenceTier === 'external-unattested' && row.attestationSignatureReady === false).length === productionOperationsControlIds.length, 'Evidence integrity audit must reject unsigned external ops receipts as managed-production proof.');

  const persistedApi = createFileBackedAgentProjectApi({
    filePath: storePath,
    accessControl: {
      signingSecret: ACCESS_SIGNING_SECRET,
      requireProjectMembership: true,
    },
  });
  response = handle(persistedApi, {
    method: 'GET',
    path: operationsReceiptPath,
    headers: signedHeadersFor({
      method: 'GET',
      path: operationsReceiptPath,
      role: 'security-admin',
      userId: 'security-lead',
      requestId: 'persisted-ops-receipt-readback',
    }),
  });
  assert(response.status === 200 && response.body.productionOperationsControlReceiptWorkflow?.latestReceipt?.verifiedControlIds?.length === productionOperationsControlIds.length, 'File-backed API must persist production operations control receipts.');
}

try {
  run();
} finally {
  if (process.env.HOFS_KEEP_TMP !== '1') {
    rmSync(root, { recursive: true, force: true });
  }
}
