import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { signAgentProjectAccessHeaders } from '../src/agents/accessControl.js';

process.env.HOFS_PRIVATE_PILOT_FOCUSED_FILE_BACKED = '1';

const {
  api,
  request,
  projectId,
  fileBackedFixture,
  tempRoot,
  exportRequestId,
  finalDeliverable,
} = await import('./validate-private-pilot-handoff-contract.mjs');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asText(value) {
  return JSON.stringify(value);
}

let privatePilotReleaseCandidate = null;

const ACCESS_SIGNING_SECRET = 'focused-private-pilot-access-secret';
const signedHeadersFor = ({
  method = 'GET',
  path,
  role = 'security-admin',
  agentId = '',
  userId = 'security-lead',
  requestId = '',
} = {}) => signAgentProjectAccessHeaders({
  method,
  path,
  role,
  agentId,
  userId,
  requestId,
  secret: ACCESS_SIGNING_SECRET,
});

let response = request({ method: 'GET', path: `/projects/${projectId}/provider-eval-runs` });
assert(fileBackedFixture === true && tempRoot, 'Release-focused gate must run the handoff fixture in file-backed mode.');
assert(response.status === 200 && response.body.providerEvalRunWorkflow?.schemaVersion === 'provider-eval-run-workflow/v1', 'Provider eval workflow must be readable before release candidate recording.');

response = request({
  method: 'POST',
  path: `/projects/${projectId}/provider-eval-runs`,
  body: {
    includeReadModels: false,
    mode: 'shadow-replay',
    actorRole: 'runtime-platform',
    actorId: 'provider-eval-harness',
    reason: 'Record focused provider eval shadow replay for private-pilot release candidate readiness.',
    now: '2026-06-01T09:50:00.000Z',
  },
});
assert(response.status === 200 && response.body.providerEvalRun?.schemaVersion === 'provider-eval-run/v1', 'Provider eval receipt must be recorded.');
assert(response.body.providerEvalRun.readyForPrivatePilotProviderEval === true, 'Provider eval receipt must be private-pilot ready.');
assert(response.body.providerEvalRun.readyForProduction === false, 'Provider eval receipt must not claim production readiness.');
assert(response.body.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true, 'Provider eval workflow must become ready after the receipt.');
assert(response.body.readModels?.included === false && response.body.readModels?.providerEvalRunWorkflowRoute?.endsWith('/provider-eval-runs'), 'Provider eval receipt must return lightweight read-model routes.');
const providerEvalChecksum = response.body.providerEvalRun.checksum;

const launchApprovalPath = `/projects/${projectId}/launch-approvals`;
for (const approval of [
  {
    role: 'manager',
    id: 'director',
    name: 'Product Director',
    reason: 'Manager approves the focused private-pilot release candidate after handoff package proof.',
    now: '2026-06-01T10:00:00.000Z',
  },
  {
    role: 'security-admin',
    id: 'security-lead',
    name: 'Security Lead',
    reason: 'Security approves the focused private-pilot release candidate while production remains blocked.',
    now: '2026-06-01T10:02:00.000Z',
  },
]) {
  response = request({
    method: 'POST',
    path: launchApprovalPath,
    body: {
      includeReadModels: false,
      mode: 'private-pilot',
      decision: 'approved',
      approverRole: approval.role,
      approverId: approval.id,
      approverName: approval.name,
      reason: approval.reason,
      linkedAuditChecksum: providerEvalChecksum,
      now: approval.now,
    },
  });
  assert(response.status === 200 && response.body.launchApproval?.schemaVersion === 'launch-approval/v1', `${approval.role} launch approval must be recorded.`);
}
assert(response.body.launchApprovalWorkflow?.readyForPrivatePilot === true, 'Private-pilot launch approvals must be complete after manager and security approval.');
assert(response.body.launchApprovalWorkflow.readyForProduction === false, 'Launch approvals must keep production blocked.');

const signedApi = createAgentProjectApi({
  service: api.service,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    replayStore: api.store,
  },
});
const signedSecurityPath = `/projects/${projectId}/security-boundary`;
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: {
    'x-hofs-access-mode': 'enforced',
    'x-hofs-role': 'security-admin',
    'x-hofs-user-id': 'security-lead',
  },
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-missing', 'Signed file-backed access must reject unsigned enforced security reads.');
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: signedHeadersFor({ method: 'GET', path: signedSecurityPath }),
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Signed file-backed access must allow valid security reads.');
const tamperedHeaders = signedHeadersFor({ method: 'GET', path: signedSecurityPath });
tamperedHeaders['x-hofs-role'] = 'observer';
response = signedApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: tamperedHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-invalid', 'Signed file-backed access must reject tampered identity headers.');

const membershipPolicyPath = `/projects/${projectId}/membership-policy`;
response = signedApi.handle({
  method: 'PUT',
  path: membershipPolicyPath,
  headers: signedHeadersFor({ method: 'PUT', path: membershipPolicyPath }),
  body: {
    includeReadModels: false,
    policy: {
      schemaVersion: 'project-membership-policy/v1',
      projectId,
      source: 'focused-private-pilot-membership-fixture',
      managerUserIds: ['director'],
      securityAdminUserIds: ['security-lead'],
      operationsOwnerUserIds: ['ops-lead'],
      observerUserIds: ['observer'],
      runtimeUserIds: ['runtime-ops'],
      agentIds: ['jobs', 'curie', 'turing', 'da_vinci'],
      reviewerAgentIds: ['curie'],
      agentUserIds: {
        jobs: ['agent-runtime-jobs'],
        curie: ['agent-runtime-curie'],
        turing: ['agent-runtime-turing'],
        da_vinci: ['agent-runtime-da_vinci'],
      },
      reviewerUserIds: {
        curie: ['agent-runtime-curie'],
      },
    },
    updatedBy: 'security-lead',
    source: 'focused-private-pilot-membership-fixture',
    now: '2026-06-01T10:03:00.000Z',
  },
});
assert(response.status === 200 && response.body.projectMembershipPolicy?.schemaVersion === 'project-membership-policy/v1', 'Release-focused gate must persist project membership policy proof.');
assert(response.body.projectMembershipSummary?.agentCount >= 4, 'Release-focused membership policy must include Agent runtime bindings.');

const identitySessionsPath = `/projects/${projectId}/identity-sessions`;
response = signedApi.handle({
  method: 'POST',
  path: identitySessionsPath,
  headers: signedHeadersFor({ method: 'POST', path: identitySessionsPath }),
  body: {
    includeReadModels: false,
    role: 'security-admin',
    userId: 'security-lead',
    issuerRole: 'security-admin',
    issuerId: 'security-lead',
    ttlMs: 60 * 60 * 1000,
    scope: ['project', 'security-boundary'],
    source: 'focused-private-pilot-identity-session',
  },
});
assert(response.status === 200 && response.body.identitySession?.schemaVersion === 'identity-session/v1', 'Release-focused gate must issue a local identity-session proof.');
assert(response.body.tokenContract?.returnedOnce === true && response.body.identitySession.status === 'active', 'Identity-session proof must return a one-time token contract and active public row.');

const replayApi = createAgentProjectApi({
  service: api.service,
  accessControl: {
    signingSecret: ACCESS_SIGNING_SECRET,
    requireSignedRequestIds: true,
    replayStore: api.store,
  },
});
const replayHeaders = signedHeadersFor({
  method: 'GET',
  path: signedSecurityPath,
  requestId: 'focused-private-pilot-security-boundary-replay',
});
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 200 && response.body.securityBoundary?.schemaVersion === 'security-boundary/v1', 'Replay-protected file-backed access must allow first request id use.');
response = replayApi.handle({
  method: 'GET',
  path: signedSecurityPath,
  headers: replayHeaders,
});
assert(response.status === 403 && response.body.accessDecision?.reason === 'signed-access-replay-detected', 'Replay-protected file-backed access must reject reused request ids.');

response = request({ method: 'GET', path: `/projects/${projectId}/security-audit-stream` });
assert(response.status === 200 && response.body.securityAuditStream?.count >= 4, 'Release-focused gate must create a file-backed security audit stream.');
assert(response.body.securityAuditStream.hashChainReady === true, 'Release-focused security audit stream must preserve hash-chain proof.');

response = request({ method: 'GET', path: `/projects/${projectId}/production-launch-audit` });
assert(response.status === 200 && response.body.productionLaunchAudit?.schemaVersion === 'production-launch-audit/v1', 'Production launch audit must be readable after focused approvals.');
const productionLaunchAudit = response.body.productionLaunchAudit;
assert(productionLaunchAudit.readyForProduction === false, 'Production launch audit must keep public production blocked.');

const privatePilotReleaseCandidatePath = `/projects/${projectId}/private-pilot-release-candidates`;
response = request({ method: 'GET', path: privatePilotReleaseCandidatePath });
assert(response.status === 200 && response.body.privatePilotReleaseCandidateWorkflow?.schemaVersion === 'private-pilot-release-candidate-workflow/v1', 'Private-pilot release candidate workflow must be readable.');
const releaseCandidateWorkflow = response.body.privatePilotReleaseCandidateWorkflow;
assert(response.body.privatePilotReleaseCandidateWorkflow.readyForPrivatePilotRelease === false, 'Private-pilot release candidate workflow must require an explicit freeze receipt.');

if (productionLaunchAudit.privatePilotDecision !== 'go') {
  const failedGateIds = new Set((productionLaunchAudit.failedPrivatePilotGates || []).map((gate) => gate.id));
  assert(productionLaunchAudit.privatePilotDecision === 'no-go', 'Focused in-memory release gate must fail closed when private-pilot launch audit is not ready.');
  assert(releaseCandidateWorkflow.readyToRecord === false, 'Release candidate workflow must refuse recording while launch audit prerequisites are missing.');
  assert(failedGateIds.has('deployment-preflight-private-ready'), 'Focused release gate must expose the deployment preflight blocker.');
  assert(failedGateIds.has('security-provider-operations-local-ready'), 'Focused release gate must expose the operations/security/provider local-readiness blocker.');

  const readyPackage = request({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
  assert(readyPackage.status === 200 && readyPackage.body.providerEvalRunWorkflow?.readyForPrivatePilotProviderEval === true, 'Manager Ready Package must expose provider eval readiness before release freeze.');
  assert(readyPackage.body.projectEvidenceExportWorkflow?.readyForPrivatePilotDownload === true, 'Manager Ready Package must expose handoff package readiness before release freeze.');
  assert(readyPackage.body.launchApprovalWorkflow?.readyForPrivatePilot === true, 'Manager Ready Package must expose launch approval readiness before release freeze.');
  assert(readyPackage.body.productionLaunchAudit?.privatePilotDecision === 'no-go', 'Manager Ready Package must keep the focused release candidate blocked until operations/deployment proof exists.');

  const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
  const proofText = asText(proofMap.body);
  assert(proofMap.status === 200 && proofText.includes('/provider-eval-runs') && proofText.includes('/project-evidence-exports') && proofText.includes('/launch-approvals'), 'Readiness Proof Map must expose provider eval, handoff package, and launch approval routes before release freeze.');

  const flowGraph = request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
  const flowText = asText(flowGraph.body);
  assert(flowGraph.status === 200 && flowText.includes('provider-eval-run') && flowText.includes('project-evidence-export'), 'Manager Flow Graph must include focused pre-release proof nodes.');
  assert(flowText.includes(finalDeliverable.id), 'Manager Flow Graph must preserve final deliverable proof while release is blocked.');

  console.log('Private-pilot release candidate focused prerequisite validation passed.');
  process.exit(0);
}

assert(response.body.privatePilotReleaseCandidateWorkflow.readyToRecord === true, `Private-pilot release candidate workflow must be ready to record: ${JSON.stringify(response.body.privatePilotReleaseCandidateWorkflow.failedPrerequisiteGates)}`);

response = request({
  method: 'POST',
  path: privatePilotReleaseCandidatePath,
  body: {
    includeReadModels: false,
    actorRole: 'manager',
    actorId: 'director',
    exportRequestId,
    reason: 'Freeze the focused private-pilot release candidate after handoff package, provider eval, and launch approvals.',
    now: '2026-06-01T10:05:00.000Z',
  },
});
assert(response.status === 200 && response.body.privatePilotReleaseCandidate?.schemaVersion === 'private-pilot-release-candidate/v1', 'Manager must record a private-pilot release candidate receipt.');
privatePilotReleaseCandidate = response.body.privatePilotReleaseCandidate;
assert(response.body.privatePilotReleaseCandidate.readyForPrivatePilotRelease === true, `Release candidate must pass blocker gates: ${JSON.stringify(response.body.privatePilotReleaseCandidate.failedGates)}`);
assert(response.body.privatePilotReleaseCandidate.readyForProduction === false, 'Release candidate must not claim production readiness.');
assert(response.body.privatePilotReleaseCandidate.releaseChecksums?.productionLaunchAudit, 'Release candidate must freeze production launch audit checksum.');
assert(response.body.privatePilotReleaseCandidate.releaseChecksums?.projectEvidenceExportPackage, 'Release candidate must freeze project evidence export package checksum.');
assert(response.body.privatePilotReleaseCandidate.releaseChecksums?.latestProviderEvalRun, 'Release candidate must freeze latest provider eval checksum.');
assert(response.body.privatePilotReleaseCandidate.proofIds?.length >= 6, 'Release candidate must include proof ids.');
assert(response.body.privatePilotReleaseCandidate.eventId && response.body.privatePilotReleaseCandidate.timelineLogId, 'Release candidate must include event and timeline proof.');
assert(response.body.privatePilotReleaseCandidateWorkflow?.readyForPrivatePilotRelease === true, 'Release candidate workflow must become private-pilot ready after freeze.');
assert(response.body.privatePilotLaunchRunWorkflow?.readyToLaunch === true, 'Release candidate receipt must immediately return the now-runnable launch workflow.');
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotReleaseCandidateWorkflowRoute?.endsWith('/private-pilot-release-candidates'), 'Release candidate receipt must return lightweight read-model routes.');

response = request({ method: 'GET', path: privatePilotReleaseCandidatePath });
assert(response.status === 200 && response.body.privatePilotReleaseCandidateWorkflow?.status === 'private-pilot-release-candidate-ready', 'Release candidate workflow must read back ready.');
assert(response.body.privatePilotReleaseCandidateWorkflow.latestCandidate?.exportRequestId === exportRequestId, 'Release candidate workflow must preserve export request id.');

const readyPackage = request({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
assert(readyPackage.status === 200 && readyPackage.body.privatePilotReleaseCandidateWorkflow?.readyForPrivatePilotRelease === true, 'Manager Ready Package must expose release candidate readiness.');
assert(readyPackage.body.productionLaunchAudit?.productionDecision === 'no-go', 'Manager Ready Package must keep production no-go.');

const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(proofMap.status === 200 && proofMap.body.privatePilotReleaseCandidateRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-release-candidates') && route.readyForPrivatePilotRelease === true && route.proofIds?.length >= 6), 'Readiness Proof Map must expose the ready release candidate route.');

const flowGraph = request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const flowText = asText(flowGraph.body);
assert(flowGraph.status === 200 && flowText.includes('private-pilot-release-candidate'), 'Manager Flow Graph must include private-pilot release candidate nodes.');
assert(flowText.includes(finalDeliverable.id), 'Manager Flow Graph must preserve final deliverable proof through release candidate freeze.');

console.log('Private-pilot release candidate focused contract validation passed.');

export {
  request,
  projectId,
  finalDeliverable,
  privatePilotReleaseCandidate,
};
