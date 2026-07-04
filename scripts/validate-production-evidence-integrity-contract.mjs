import { createHmac } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

let lastProgressAt = Date.now();
function progress(label) {
  const now = Date.now();
  const message = `${label} (+${now - lastProgressAt}ms)`;
  lastProgressAt = now;
  if (process.env.HOFS_PROGRESS === '1') {
    console.error(`[production-evidence-integrity] ${message}`);
  }
  if (process.env.HOFS_PROGRESS_LOG === '1') {
    appendFileSync(fileURLToPath(new URL('../.tmp/production-evidence-integrity-focused-progress.log', import.meta.url)), `${new Date().toISOString()} ${message}\n`);
  }
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
  const payload = {
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
  };
  return `sig_hmac_sha256_v1_${createHmac('sha256', signingSecret).update(stableJson(payload)).digest('hex')}`;
}

const ACCESS_SIGNING_SECRET = 'ACCESS_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
const MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = 'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET_SHOULD_NOT_LEAK_12345';
process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET;

const root = fileURLToPath(new URL(`../.tmp/product-team-acceptance/production-evidence-integrity-focused-${process.pid}/`, import.meta.url));
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
const productionDeploymentControlIds = [
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
];
const productionSecurityControlIds = [
  'managed-identity-provider',
  'service-identity-boundary',
  'managed-kms-secret-manager',
  'database-backed-rbac',
  'centralized-security-audit',
  'session-replay-hardening',
];
const productionProviderControlIds = [
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
];

const totalProductionControlCount = productionOperationsControlIds.length
  + productionDeploymentControlIds.length
  + productionSecurityControlIds.length
  + productionProviderControlIds.length;

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

const projectId = 'production_evidence_integrity_contract_project';
progress('create kickoff meeting starting');
let response = api.handle({
  method: 'POST',
  path: '/kickoff-meetings',
  body: {
    meetingId: 'production_evidence_integrity_contract_meeting',
    projectId,
    name: 'Production Evidence Integrity Contract Project',
    brief: 'Validate production evidence integrity for the general AI product-team system without running the full private-pilot rehearsal.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    now: '2026-06-01T10:00:00.000Z',
    tasks: [
      { id: 'task_evidence_integrity', text: 'Verify production evidence integrity tiers.', assignee: 'Marie Curie', status: 'pending' },
    ],
  },
});
assert(response.status === 200, 'Focused evidence-integrity validator must create a kickoff meeting.');
progress('create kickoff meeting completed');

progress('create project mission starting');
response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'production_evidence_integrity_contract_mission',
    meetingId: 'production_evidence_integrity_contract_meeting',
    kickoffMeetingId: 'production_evidence_integrity_contract_meeting',
    reuseExistingKickoffMeeting: true,
    projectId,
    name: 'Production Evidence Integrity Contract Project',
    missionBrief: 'Use the generic product-team backend to verify production evidence classification.',
    team,
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_evidence_integrity', text: 'Verify production evidence integrity tiers.', assignee: 'Marie Curie', status: 'pending' },
    ],
    maxLoops: 1,
    maxStepsPerLoop: 1,
    runInitialTick: false,
    now: '2026-06-01T10:01:00.000Z',
  },
});
assert(response.status === 200 && response.body.project?.id === projectId, 'Focused evidence-integrity validator must create a backend project.');
progress('create project mission completed');

progress('persist membership policy starting');
response = api.handle({
  method: 'PUT',
  path: `/projects/${projectId}/membership-policy`,
  body: {
    includeReadModels: false,
    updatedBy: 'director',
    source: 'production-evidence-integrity-focused-validator',
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
assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Focused evidence-integrity validator must persist project membership policy.');
progress('persist membership policy completed');

const membershipApi = createFileBackedAgentProjectApi({
  filePath: `${root}/store.json`,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireProjectMembership: true,
  },
});

const productionEvidenceIntegrityAuditPath = `/projects/${projectId}/production-evidence-integrity-audit`;
const productionLaunchAuditPath = `/projects/${projectId}/production-launch-audit`;
const productionLaunchGapRegisterPath = `/projects/${projectId}/production-launch-gap-register`;
const productionLaunchControlCenterPath = `/projects/${projectId}/production-launch-control-center`;
const readinessProofMapPath = `/projects/${projectId}/readiness-proof-map`;
const managerFlowGraphPath = `/projects/${projectId}/manager-flow-graph`;

const receiptBatches = [
  {
    domain: 'operations',
    path: `/projects/${projectId}/production-operations-control-receipts`,
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    now: '2026-06-01T12:00:00.000Z',
    prefix: 'ops',
    routePrefix: 'https://ops.hofsstudio.example',
    controlIds: productionOperationsControlIds,
    receiptKey: 'productionOperationsControlReceipt',
    workflowKey: 'productionOperationsControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionOperationsControls',
  },
  {
    domain: 'deployment',
    path: `/projects/${projectId}/production-deployment-control-receipts`,
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    now: '2026-06-01T12:02:00.000Z',
    prefix: 'deploy',
    routePrefix: 'https://deploy.hofsstudio.example',
    controlIds: productionDeploymentControlIds,
    receiptKey: 'productionDeploymentControlReceipt',
    workflowKey: 'productionDeploymentControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionDeploymentControls',
  },
  {
    domain: 'security',
    path: `/projects/${projectId}/production-security-control-receipts`,
    role: 'security-admin',
    userId: 'security-lead',
    actorRole: 'security-admin',
    actorId: 'security-lead',
    now: '2026-06-01T12:04:00.000Z',
    prefix: 'sec',
    routePrefix: 'https://security.hofsstudio.example',
    controlIds: productionSecurityControlIds,
    receiptKey: 'productionSecurityControlReceipt',
    workflowKey: 'productionSecurityControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionSecurityControls',
  },
  {
    domain: 'provider',
    path: `/projects/${projectId}/production-provider-control-receipts`,
    role: 'runtime-platform',
    userId: 'runtime-ops',
    actorRole: 'runtime-platform',
    actorId: 'runtime-ops',
    now: '2026-06-01T12:06:00.000Z',
    prefix: 'provider',
    routePrefix: 'https://provider.hofsstudio.example',
    controlIds: productionProviderControlIds,
    receiptKey: 'productionProviderControlReceipt',
    workflowKey: 'productionProviderControlReceiptWorkflow',
    controlsReadyField: 'readyForProductionProviderControls',
  },
];

function postReceiptBatch(batch, {
  suffix = 'local',
  evidenceEnvironment,
  signed = false,
  offsetMs = 0,
} = {}) {
  const now = new Date(Date.parse(batch.now) + offsetMs).toISOString();
  const body = {
    actorRole: batch.actorRole,
    actorId: batch.actorId,
    reason: `Record ${suffix} ${batch.domain} controls for evidence-integrity validation.`,
    now,
    includeReadModels: false,
    controls: batch.controlIds.map((controlId) => {
      const control = {
        controlId,
        status: 'verified',
        evidenceId: `${batch.prefix}_${controlId}_${suffix}_receipt`,
        evidenceRoute: `${batch.routePrefix}/${controlId}/${suffix}`,
        evidenceChecksum: `${batch.prefix}_${controlId}_${suffix}_checksum`,
        completedAt: now,
        ownerRole: batch.actorRole,
        detail: `Verified ${controlId} for ${suffix} evidence-integrity validation.`,
      };
      if (evidenceEnvironment) {
        control.evidenceEnvironment = evidenceEnvironment;
        control.attestationId = `${batch.prefix}_${controlId}_${suffix}_attestation`;
        control.attestationRoute = `${batch.routePrefix}/${controlId}/${suffix}/attestation`;
        control.attestationChecksum = `${batch.prefix}_${controlId}_${suffix}_attestation_checksum`;
        control.attestationProvider = 'managed-production-control-plane';
        control.attestationKind = 'managed-control-plane-attestation';
      }
      if (signed) {
        control.attestationSignature = managedProductionAttestationSignature({
          signingSecret: MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET,
          projectId,
          domain: batch.domain,
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
        });
      }
      return control;
    }),
  };
  const result = membershipApi.handle({
    method: 'POST',
    path: batch.path,
    headers: signedHeadersFor({
      method: 'POST',
      path: batch.path,
      role: batch.role,
      userId: batch.userId,
      requestId: `${batch.prefix}-${suffix}`,
    }),
    body,
  });
  assert(result.status === 200 && result.body[batch.receiptKey]?.schemaVersion?.endsWith('-receipt/v1'), `Focused evidence-integrity validator must record ${batch.domain} ${suffix} receipts.`);
  assert(result.body[batch.receiptKey][batch.controlsReadyField] === true, `Focused evidence-integrity validator must verify all ${batch.domain} controls for ${suffix}.`);
  assert(result.body[batch.receiptKey].verifiedControlIds?.length === batch.controlIds.length, `Focused evidence-integrity validator must preserve ${batch.domain} control ids.`);
  assert(result.body.readModels?.included === false && result.body.readModels?.managerReadyPackageRoute?.endsWith('/manager-ready-package'), `Focused evidence-integrity validator must keep ${batch.domain} ${suffix} receipt writes lightweight.`);
}

response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({ path: productionEvidenceIntegrityAuditPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit?.schemaVersion === 'production-evidence-integrity-audit/v1', 'Focused evidence-integrity validator must expose the audit route before receipts.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.missingControlCount === totalProductionControlCount, 'Initial evidence-integrity audit must show every control missing.');
progress('initial evidence integrity audit completed');

for (const batch of receiptBatches) {
  progress(`local receipt ${batch.domain} starting`);
  postReceiptBatch(batch, { suffix: 'local', offsetMs: 0 });
  progress(`local receipt ${batch.domain} completed`);
}

progress('local evidence integrity audit starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({ path: productionEvidenceIntegrityAuditPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit.summary?.verifiedControlCount === totalProductionControlCount, 'Evidence-integrity audit must count all local receipt controls.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.localRehearsalControlCount === totalProductionControlCount, 'Evidence-integrity audit must classify local receipt controls as local rehearsal.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === 0, 'Evidence-integrity audit must not upgrade local receipts to managed production.');
assert(response.body.productionEvidenceIntegrityAudit.readyForManagedProductionEvidence === false && response.body.productionEvidenceIntegrityAudit.readyForProduction === false, 'Local receipt controls must keep production evidence blocked.');
progress('local evidence integrity audit completed');

progress('local launch audit starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchAuditPath,
  headers: signedHeadersFor({ path: productionLaunchAuditPath }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === false), 'Launch audit must keep evidence integrity failed after local receipts.');
assert(response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Launch audit must list evidence integrity as a production blocker after local receipts.');
progress('local launch audit completed');

for (const batch of receiptBatches) {
  progress(`unattested receipt ${batch.domain} starting`);
  postReceiptBatch(batch, {
    suffix: 'unattested',
    evidenceEnvironment: 'managed-production',
    signed: false,
    offsetMs: 60_000,
  });
  progress(`unattested receipt ${batch.domain} completed`);
}

progress('unattested evidence integrity audit starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({ path: productionEvidenceIntegrityAuditPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit.summary?.externalUnattestedControlCount === totalProductionControlCount, 'Evidence-integrity audit must classify unsigned managed-production claims as external-unattested.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === 0, 'Unsigned managed-production claims must not count as managed-production controls.');
assert(response.body.productionEvidenceIntegrityAudit.rows?.every((row) => row.evidenceTier === 'external-unattested' && row.attestationSignatureReady === false), 'Unsigned managed-production rows must expose missing signatures.');
progress('unattested evidence integrity audit completed');

for (const batch of receiptBatches) {
  progress(`managed receipt ${batch.domain} starting`);
  postReceiptBatch(batch, {
    suffix: 'managed',
    evidenceEnvironment: 'managed-production',
    signed: true,
    offsetMs: 120_000,
  });
  progress(`managed receipt ${batch.domain} completed`);
}

progress('managed evidence integrity audit starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionEvidenceIntegrityAuditPath,
  headers: signedHeadersFor({ path: productionEvidenceIntegrityAuditPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityAudit.summary?.managedProductionControlCount === totalProductionControlCount, 'Signed managed-production receipts must count every control as managed-production evidence.');
assert(response.body.productionEvidenceIntegrityAudit.summary?.localRehearsalControlCount === 0, 'Signed managed-production receipts must supersede local rehearsal evidence.');
assert(response.body.productionEvidenceIntegrityAudit.readyForManagedProductionEvidence === true && response.body.productionEvidenceIntegrityAudit.readyForProduction === true, 'Evidence-integrity audit must become ready only after signed managed-production evidence.');
assert(response.body.productionEvidenceIntegrityAudit.rows?.every((row) => row.evidenceTier === 'managed-production' && row.attestationSignatureReady === true), 'Managed-production rows must preserve signed attestation proof.');
assert(response.body.productionEvidenceIntegrityAudit.domainRows?.every((row) => row.readyForManagedProductionEvidence === true), 'Every production control domain must become evidence-ready after signed proof.');
progress('managed evidence integrity audit completed');

progress('managed launch audit starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchAuditPath,
  headers: signedHeadersFor({ path: productionLaunchAuditPath }),
});
assert(response.status === 200 && response.body.productionLaunchAudit?.productionGates?.some((gate) => gate.id === 'managed-production-evidence-integrity' && gate.passed === true), 'Launch audit must pass evidence integrity after signed managed-production receipts.');
assert(response.body.productionLaunchAudit?.productionDecision === 'no-go', 'Launch audit must still keep broader public production no-go.');
assert(!response.body.productionLaunchAudit?.productionBlockers?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Launch audit must remove only the evidence-integrity blocker after signed proof.');
progress('managed launch audit completed');

progress('managed gap register starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchGapRegisterPath,
  headers: signedHeadersFor({ path: productionLaunchGapRegisterPath }),
});
assert(response.status === 200 && !response.body.productionLaunchGapRegister?.gapRows?.some((row) => row.id === 'managed-production-evidence-integrity'), 'Gap register must close the evidence-integrity gap after signed proof.');
assert(response.body.productionLaunchGapRegister.readyForProduction === false, 'Gap register must not overclaim broader production readiness.');
progress('managed gap register completed');

progress('managed launch control center starting');
response = membershipApi.handle({
  method: 'GET',
  path: productionLaunchControlCenterPath,
  headers: signedHeadersFor({ path: productionLaunchControlCenterPath }),
});
assert(response.status === 200 && response.body.productionLaunchControlCenter?.controlRows?.some((row) => row.id === 'managed-production-evidence-integrity' && row.ready === true), 'Launch control center must mark evidence integrity ready after signed proof.');
assert(response.body.productionLaunchControlCenter.readyForProduction === false, 'Launch control center must keep public production blocked by other controls.');
assert(response.body.productionLaunchControlCenter.controlRows?.some((row) => row.id === 'public-production-startup-readiness' && row.ready === false), 'Launch control center must keep the global public-production startup blocker visible.');
progress('managed launch control center completed');

progress('managed readiness proof map starting');
response = membershipApi.handle({
  method: 'GET',
  path: readinessProofMapPath,
  headers: signedHeadersFor({ path: readinessProofMapPath }),
});
assert(response.status === 200 && response.body.productionEvidenceIntegrityRoutes?.some((route) => route.apiPath?.endsWith('/production-evidence-integrity-audit') && route.managedProductionControlCount === totalProductionControlCount && route.readyForManagedProductionEvidence === true), 'Readiness Proof Map must expose managed-production evidence-integrity proof.');
assert(response.body.productionLaunchControlCenterRoutes?.some((route) => route.productionEvidenceIntegrityReady === true && route.readyForProduction === false), 'Readiness Proof Map must feed evidence integrity into launch control without overclaim.');
progress('managed readiness proof map completed');

progress('managed flow graph starting');
response = membershipApi.handle({
  method: 'GET',
  path: managerFlowGraphPath,
  headers: signedHeadersFor({ path: managerFlowGraphPath }),
});
assert(response.status === 200 && response.body.nodes?.some((node) => node.id === 'production-evidence-integrity-audit' && node.status === 'confirmed' && node.proofIds?.length >= totalProductionControlCount), 'Manager Flow Graph must upgrade the production evidence-integrity node after signed proof.');
progress('managed flow graph completed');

assert(!JSON.stringify(response.body).includes(ACCESS_SIGNING_SECRET), 'Focused evidence-integrity validator must not leak access signing secret.');
assert(!JSON.stringify(response.body).includes(MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET), 'Focused evidence-integrity validator must not leak managed-production attestation secret.');

if (existsSync(root)) {
  rmSync(root, { recursive: true, force: true });
}

console.log('Production evidence integrity contract validation passed.');
