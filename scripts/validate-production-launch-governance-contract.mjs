import { createHmac } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function managedProductionAttestationSignature({
  signingSecret,
  projectId,
  domain,
  controlId,
  evidenceId,
  evidenceRoute,
  evidenceChecksum,
  evidenceEnvironment,
  attestationId,
  attestationRoute,
  attestationChecksum,
  attestationProvider,
  attestationKind,
}) {
  return `sig_hmac_sha256_v1_${createHmac('sha256', signingSecret).update(stableJson({
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId,
    domain,
    controlId,
    evidenceId,
    evidenceRoute,
    evidenceChecksum,
    evidenceEnvironment,
    attestationId,
    attestationRoute,
    attestationChecksum,
    attestationProvider,
    attestationKind,
  })).digest('hex')}`;
}

const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
const MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = 'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET;

const root = fileURLToPath(new URL(`../.tmp/product-team-acceptance/production-launch-governance-focused-${process.pid}/`, import.meta.url));
rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Visionary', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'protocol design' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Cross-domain Inventor', skill: 'brainstorm synthesis' },
];

const controlGroups = [
  {
    domain: 'operations',
    pathAction: 'production-operations-control-receipts',
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    prefix: 'launch_ops',
    routePrefix: 'https://ops.hofsstudio.example',
    now: '2026-06-01T13:00:00.000Z',
    receiptKey: 'productionOperationsControlReceipt',
    controlIds: [
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
    ],
  },
  {
    domain: 'deployment',
    pathAction: 'production-deployment-control-receipts',
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    prefix: 'launch_deploy',
    routePrefix: 'https://deploy.hofsstudio.example',
    now: '2026-06-01T13:02:00.000Z',
    receiptKey: 'productionDeploymentControlReceipt',
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
  {
    domain: 'security',
    pathAction: 'production-security-control-receipts',
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    prefix: 'launch_sec',
    routePrefix: 'https://security.hofsstudio.example',
    now: '2026-06-01T13:04:00.000Z',
    receiptKey: 'productionSecurityControlReceipt',
    controlIds: [
      'managed-identity-provider',
      'service-identity-boundary',
      'managed-kms-secret-manager',
      'database-backed-rbac',
      'centralized-security-audit',
      'session-replay-hardening',
    ],
  },
  {
    domain: 'provider',
    pathAction: 'production-provider-control-receipts',
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    prefix: 'launch_provider',
    routePrefix: 'https://provider.hofsstudio.example',
    now: '2026-06-01T13:06:00.000Z',
    receiptKey: 'productionProviderControlReceipt',
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
];

const totalProductionControlCount = controlGroups.reduce((total, group) => total + group.controlIds.length, 0);
const projectId = 'production_launch_governance_contract_project';

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

const api = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  replaceWithSeed: true,
});

let response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'production_launch_governance_contract_meeting',
    projectId,
    name: 'Production Launch Governance Contract Project',
    brief: 'Validate production launch approval governance for the general AI product-team system.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:00:00.000Z',
    tasks: [
      { id: 'task_launch_governance', text: 'Verify production launch approval governance.', assignee: 'Steve Jobs', status: 'pending' },
    ],
  },
});
assert(response.status === 200, 'Launch governance validator must create a kickoff meeting.');

response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'production_launch_governance_contract_mission',
    meetingId: 'production_launch_governance_contract_meeting',
    kickoffMeetingId: 'production_launch_governance_contract_meeting',
    reuseExistingKickoffMeeting: true,
    projectId,
    name: 'Production Launch Governance Contract Project',
    missionBrief: 'Use the generic product-team backend to verify production launch approvals.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_launch_governance', text: 'Verify production launch approval governance.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    maxLoops: 1,
    maxStepsPerLoop: 1,
    runInitialTick: false,
    now: '2026-06-01T10:01:00.000Z',
  },
});
assert(response.status === 200 && response.body.project?.id === projectId, 'Launch governance validator must create a backend project.');

response = api.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  body: {
    includeReadModels: false,
    updatedBy: 'director',
    source: 'production-launch-governance-focused-validator',
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
assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Launch governance validator must persist project membership policy.');

const membershipApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireProjectMembership: true,
  },
});

for (const group of controlGroups) {
  const path = `/projects/${projectId}/${group.pathAction}`;
  response = membershipApi.handle({
    method: 'POST',
    path,
    headers: signedHeadersFor({
      method: 'POST',
      path,
      role: group.role,
      userId: group.userId,
      requestId: `${group.prefix}-managed-receipt`,
    }),
    body: {
      actorRole: group.actorRole,
      actorId: group.actorId,
      reason: `Record signed managed-production ${group.domain} controls before launch governance approval.`,
      now: group.now,
      includeReadModels: false,
      controls: group.controlIds.map((controlId) => {
        const control = {
          controlId,
          status: 'verified',
          evidenceId: `${group.prefix}_${controlId}_receipt`,
          evidenceRoute: `${group.routePrefix}/${controlId}`,
          evidenceChecksum: `${group.prefix}_${controlId}_checksum`,
          evidenceEnvironment: 'managed-production',
          attestationId: `${group.prefix}_${controlId}_attestation`,
          attestationRoute: `${group.routePrefix}/${controlId}/attestation`,
          attestationChecksum: `${group.prefix}_${controlId}_attestation_checksum`,
          attestationProvider: 'managed-production-control-plane',
          attestationKind: 'managed-control-plane-attestation',
          completedAt: group.now,
          ownerRole: group.actorRole,
          detail: `Verified ${controlId} with signed managed-production evidence before launch governance approval.`,
        };
        return {
          ...control,
          attestationSignature: managedProductionAttestationSignature({
            signingSecret: MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
            projectId,
            domain: group.domain,
            controlId,
            evidenceId: control.evidenceId,
            evidenceRoute: control.evidenceRoute,
            evidenceChecksum: control.evidenceChecksum,
            evidenceEnvironment: control.evidenceEnvironment,
            attestationId: control.attestationId,
            attestationRoute: control.attestationRoute,
            attestationChecksum: control.attestationChecksum,
            attestationProvider: control.attestationProvider,
            attestationKind: control.attestationKind,
          }),
        };
      }),
    },
  });
  assert(response.status === 200 && response.body[group.receiptKey]?.schemaVersion?.endsWith('-receipt/v1'), `Launch governance validator must record ${group.domain} managed-production receipts.`);
  assert(response.body[group.receiptKey].verifiedControlIds?.length === group.controlIds.length, `Launch governance validator must preserve ${group.domain} control ids.`);
  assert(response.body.readModels?.included === false, `Launch governance validator must keep ${group.domain} receipt write lightweight.`);
}

const evidenceIntegrityPath = `/projects/${projectId}/production-evidence-integrity-audit`;
response = membershipApi.handle({
  method: 'GET',
  path: evidenceIntegrityPath,
  headers: signedHeadersFor({ path: evidenceIntegrityPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.readyForManagedProductionEvidence === true, 'Launch governance validator must start production approvals only after managed-production evidence integrity is ready.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === totalProductionControlCount, 'Launch governance validator must prove every production control has signed managed-production evidence.');

const productionLaunchAuditPath = `/projects/${projectId}/production-launch-audit`;
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchAuditPath,
  headers: signedHeadersFor({ path: productionLaunchAuditPath }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'production-launch-approval-ready' && gate.passed === false), 'Launch audit must require production approvals before governance approval.');
assert(response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === true), 'Launch audit must see managed-production evidence integrity before approval.');
const linkedAuditChecksum = response.body.productionLaunchAudit.checksum;

const launchApprovalPath = `/projects/${projectId}/launch-approvals`;
const approvalInputs = [
  {
    role: 'manager',
    userId: 'director',
    approverId: 'director',
    approverName: 'Product Director',
    reason: 'Manager approves production launch governance after managed-production evidence integrity is explicit.',
    now: '2026-06-01T13:10:00.000Z',
  },
  {
    role: 'security-admin',
    userId: 'security-lead',
    approverId: 'security-lead',
    approverName: 'Security Lead',
    reason: 'Security approves production launch governance after signed security and evidence receipts.',
    now: '2026-06-01T13:11:00.000Z',
  },
  {
    role: 'operations-owner',
    userId: 'ops-lead',
    approverId: 'ops-lead',
    approverName: 'Operations Lead',
    reason: 'Operations owner approves production launch governance while startup readiness remains separately gated.',
    now: '2026-06-01T13:12:00.000Z',
  },
];

for (const approval of approvalInputs) {
  response = membershipApi.handle({
    method: 'POST',
    path: launchApprovalPath,
    headers: signedHeadersFor({
      method: 'POST',
      path: launchApprovalPath,
      role: approval.role,
      userId: approval.userId,
      requestId: `production-launch-approval-${approval.role}`,
    }),
    body: {
      mode: 'production',
      decision: 'approved',
      approverRole: approval.role,
      approverId: approval.approverId,
      approverName: approval.approverName,
      reason: approval.reason,
      linkedAuditChecksum,
      now: approval.now,
      includeReadModels: false,
    },
  });
  assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', `Launch governance validator must record ${approval.role} production approval.`);
  assert(response.body.launchApproval.mode === 'production' && response.body.launchApproval.decision === 'approved', `Launch governance validator must preserve ${approval.role} production approval mode.`);
}

response = membershipApi.handle({
  method: 'GET',
  path: launchApprovalPath,
  headers: signedHeadersFor({
    path: launchApprovalPath,
    role: 'operations-owner',
    userId: 'ops-lead',
  }),
});
assert(response.status === 200 && response.body.launchApprovalWorkflow?.readyForProduction === true, 'Launch approval workflow must mark production approval ready after Manager, security-admin, and operations-owner approvals.');
assert(response.body.launchApprovalWorkflow.summary?.productionApproved === true && response.body.launchApprovalWorkflow.summary?.productionMissingRoleCount === 0, 'Launch approval workflow summary must close production approval missing roles.');
assert(response.body.launchApprovalWorkflow.modes?.some((mode) => mode.id === 'production' && mode.ready && mode.approvedRoles.includes('manager') && mode.approvedRoles.includes('security-admin') && mode.approvedRoles.includes('operations-owner')), 'Launch approval workflow must summarize all required production approver roles.');
assert(response.body.launchApprovalWorkflow.proofIds?.length >= 3 && response.body.launchApprovalWorkflow.timelineLogIds?.length >= 3 && response.body.launchApprovalWorkflow.eventIds?.length >= 3, 'Launch approval workflow must aggregate approval proof, timeline, and event ids.');

response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchAuditPath,
  headers: signedHeadersFor({ path: productionLaunchAuditPath }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'production-launch-approval-ready' && gate.passed === true), 'Production launch audit must pass the production approval gate after three-role approval.');
assert(response.body.productionLaunchAudit?.summary?.launchApprovalProductionReady === true, 'Production launch audit summary must expose production launch approval readiness.');
assert(response.body.productionLaunchAudit?.productionDecision === 'no-go' && response.body.productionLaunchAudit?.readyForProduction === false, 'Production launch audit must keep broader public production no-go while startup/runtime gates remain blocked.');

const productionLaunchControlCenterPath = `/projects/${projectId}/production-launch-control-center`;
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({ path: productionLaunchControlCenterPath }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'production-launch-approvals' && row.ready === true), 'Production launch control center must mark production approvals ready.');
assert(response.body.productionLaunchControlCenter?.summary?.productionApprovalReady === true, 'Production launch control center summary must expose production approval readiness.');
assert(response.body.productionLaunchControlCenter?.readyForProduction === false, 'Production launch control center must keep public production blocked by remaining runtime gates.');
assert(response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'public-production-startup-readiness' && row.ready === false), 'Production launch control center must preserve the global public-production startup no-go row.');

const readinessProofMapPath = `/projects/${projectId}/readiness-proof-map`;
response = membershipApi.handle({
  method: 'GET',
  path: readinessProofMapPath,
  headers: signedHeadersFor({ path: readinessProofMapPath }),
});
assert(response.status === 200 && response.body.launchApprovalSummary?.productionApprovalCount >= 3, 'Readiness Proof Map must summarize production approval readiness.');
assert(response.body.launchApprovalRoutes?.filter((route) => route.mode === 'production' && route.decision === 'approved').length >= 3, 'Readiness Proof Map must expose production launch approval routes.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.productionApprovalReady === true && route.readyForProduction === false), 'Readiness Proof Map must feed approval readiness into launch control without production overclaim.');

const managerFlowGraphPath = `/projects/${projectId}/manager-flow-graph`;
response = membershipApi.handle({
  method: 'GET',
  path: managerFlowGraphPath,
  headers: signedHeadersFor({ path: managerFlowGraphPath }),
});
assert(response.status === 200 && response.body.nodes?.filter((node) => node.source === 'launchApprovals' && node.subtype === 'launch-approval' && node.importance === 'critical' && node.status === 'confirmed').length >= 3, 'Manager Flow Graph must include production launch approval nodes.');
assert(response.body.edges?.some((edge) => edge.source === 'launchApprovals' && edge.label === 'Release governance' && edge.eventIds?.length >= 1), 'Manager Flow Graph must connect launch approval proof into release-governance evidence.');
assert(response.body.nodes?.some((node) => node.id === 'public-production-startup-readiness' && node.status === 'blocked' && node.route === '/public-production-startup-readiness'), 'Manager Flow Graph must keep the global public-production startup blocker visible after production approvals.');
assert(response.body.edges?.some((edge) => edge.fromNodeId === 'public-production-startup-readiness' && edge.toNodeId === 'production-launch-control-center'), 'Manager Flow Graph must route the public startup blocker into Production Launch Control Center.');

assert(!JSON.stringify(response.body).includes(ACCESS_SIGNING_SECRET), 'Launch governance validator must not leak access signing secret.');
assert(!JSON.stringify(response.body).includes(MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET), 'Launch governance validator must not leak managed-production attestation secret.');

if (existsSync(root)) {
  rmSync(root, { recursive: true, force: true });
}

console.log('Production launch governance contract validation passed.');
