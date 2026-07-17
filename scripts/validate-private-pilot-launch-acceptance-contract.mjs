import {
  request,
  projectId,
  finalDeliverable,
  privatePilotReleaseCandidate,
} from './validate-private-pilot-release-candidate-contract.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asText(value) {
  return JSON.stringify(value);
}

assert(privatePilotReleaseCandidate?.readyForPrivatePilotRelease === true, 'Launch-focused gate must start from a frozen private-pilot release candidate.');

const privatePilotLaunchRunPath = `/projects/${projectId}/private-pilot-launch-runs`;
let response = request({ method: 'GET', path: privatePilotLaunchRunPath });
assert(response.status === 200 && response.body.privatePilotLaunchRunWorkflow?.schemaVersion === 'private-pilot-launch-run-workflow/v1', 'Project API must expose private-pilot launch run workflow.');
assert(response.body.privatePilotLaunchRunWorkflow.readyToLaunch === true, `Private-pilot launch run workflow must be ready after release candidate freeze: ${JSON.stringify(response.body.privatePilotLaunchRunWorkflow.failedLaunchGates)}`);
assert(response.body.privatePilotLaunchRunWorkflow.readyForPrivatePilotLaunch === false, 'Private-pilot launch run workflow must require a launch receipt.');

response = request({
  method: 'POST',
  path: privatePilotLaunchRunPath,
  body: {
    includeReadModels: false,
    actorRole: 'manager',
    actorId: 'director',
    launchWindow: 'focused private-pilot launch window',
    reason: 'Start the focused controlled private-pilot launch run from the frozen release candidate.',
    now: '2026-06-01T10:08:00.000Z',
  },
});
assert(response.status === 200 && response.body.privatePilotLaunchRun?.schemaVersion === 'private-pilot-launch-run/v1', 'Manager must record a private-pilot launch run receipt.');
assert(response.body.privatePilotLaunchRun.readyForPrivatePilotLaunch === true, `Launch run must pass blocker gates: ${JSON.stringify(response.body.privatePilotLaunchRun.failedGates)}`);
assert(response.body.privatePilotLaunchRun.readyForProduction === false, 'Launch run must not claim production readiness.');
assert(response.body.privatePilotLaunchRun.releaseCandidateId && response.body.privatePilotLaunchRun.releaseCandidateChecksum, 'Launch run must bind the frozen release candidate.');
assert(response.body.privatePilotLaunchRun.releaseChecksums?.deploymentPreflight && response.body.privatePilotLaunchRun.releaseChecksums?.operationsReadiness && response.body.privatePilotLaunchRun.releaseChecksums?.latestProviderEvalRun, 'Launch run must freeze deployment, operations, and provider eval checksums.');
assert(response.body.privatePilotLaunchRun.eventId && response.body.privatePilotLaunchRun.timelineLogId, 'Launch run must include event and timeline proof.');
assert(response.body.privatePilotLaunchRunWorkflow?.readyForPrivatePilotLaunch === true, 'Launch run workflow must become ready after receipt.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow?.readyToCheck === true, 'Launch receipt must immediately return the now-runnable health workflow.');
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotLaunchRunWorkflowRoute?.endsWith('/private-pilot-launch-runs'), 'Launch run receipt must support lightweight read-model refresh routes.');
const launchRun = response.body.privatePilotLaunchRun;

const privatePilotLaunchHealthCheckPath = `/projects/${projectId}/private-pilot-launch-health-checks`;
response = request({ method: 'GET', path: privatePilotLaunchHealthCheckPath });
assert(response.status === 200 && response.body.privatePilotLaunchHealthCheckWorkflow?.schemaVersion === 'private-pilot-launch-health-check-workflow/v1', 'Project API must expose private-pilot launch health workflow.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow.readyToCheck === true, `Launch health workflow must be ready after launch run: ${JSON.stringify(response.body.privatePilotLaunchHealthCheckWorkflow.failedHealthGates)}`);
assert(response.body.privatePilotLaunchHealthCheckWorkflow.readyForPrivatePilotMonitoring === false, 'Launch health workflow must require a health receipt.');

response = request({
  method: 'POST',
  path: privatePilotLaunchHealthCheckPath,
  body: {
    includeReadModels: false,
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record focused private-pilot post-launch health after the controlled launch run.',
    now: '2026-06-01T10:10:00.000Z',
  },
});
assert(response.status === 200 && response.body.privatePilotLaunchHealthCheck?.schemaVersion === 'private-pilot-launch-health-check/v1', 'Manager must record a private-pilot launch health check receipt.');
assert(response.body.privatePilotLaunchHealthCheck.readyForPrivatePilotMonitoring === true, `Launch health check must pass blocker gates: ${JSON.stringify(response.body.privatePilotLaunchHealthCheck.failedGates)}`);
assert(response.body.privatePilotLaunchHealthCheck.readyForProduction === false, 'Launch health check must not claim production readiness.');
assert(response.body.privatePilotLaunchHealthCheck.launchRunId === launchRun.id, 'Launch health check must bind the launch run receipt.');
assert(response.body.privatePilotLaunchHealthCheck.healthChecksums?.operationsReadiness && response.body.privatePilotLaunchHealthCheck.healthChecksums?.securityBoundary && response.body.privatePilotLaunchHealthCheck.healthChecksums?.persistenceAdapterDryRun, 'Launch health check must freeze operations, security, and persistence checksums.');
assert(response.body.privatePilotLaunchHealthCheck.eventId && response.body.privatePilotLaunchHealthCheck.timelineLogId, 'Launch health check must include event and timeline proof.');
assert(response.body.privatePilotLaunchHealthCheckWorkflow?.readyForPrivatePilotMonitoring === true, 'Launch health workflow must become ready after receipt.');
assert(response.body.privatePilotAcceptanceReportWorkflow?.readyToReport === true, 'Launch health receipt must immediately return the now-runnable acceptance workflow.');
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotLaunchHealthCheckWorkflowRoute?.endsWith('/private-pilot-launch-health-checks'), 'Launch health receipt must support lightweight read-model refresh routes.');
const launchHealthCheck = response.body.privatePilotLaunchHealthCheck;

const privatePilotAcceptanceReportPath = `/projects/${projectId}/private-pilot-acceptance-reports`;
response = request({ method: 'GET', path: privatePilotAcceptanceReportPath });
assert(response.status === 200 && response.body.privatePilotAcceptanceReportWorkflow?.schemaVersion === 'private-pilot-acceptance-report-workflow/v1', 'Project API must expose private-pilot acceptance report workflow.');
assert(response.body.privatePilotAcceptanceReportWorkflow.readyToReport === true, `Acceptance report workflow must be ready after launch health: ${JSON.stringify(response.body.privatePilotAcceptanceReportWorkflow.failedAcceptanceGates)}`);
assert(response.body.privatePilotAcceptanceReportWorkflow.readyForPrivatePilotAcceptance === false, 'Acceptance workflow must require a report receipt.');

response = request({
  method: 'POST',
  path: privatePilotAcceptanceReportPath,
  body: {
    includeReadModels: false,
    actorRole: 'manager',
    actorId: 'director',
    reason: 'Record focused customer-visible private-pilot acceptance after launch health and handoff proof are ready.',
    now: '2026-06-01T10:12:00.000Z',
  },
});
assert(response.status === 200 && response.body.privatePilotAcceptanceReport?.schemaVersion === 'private-pilot-acceptance-report/v1', 'Manager must record a private-pilot acceptance report.');
assert(response.body.privatePilotAcceptanceReport.readyForPrivatePilotAcceptance === true, `Acceptance report must pass blocker gates: ${JSON.stringify(response.body.privatePilotAcceptanceReport.failedGates)}`);
assert(response.body.privatePilotAcceptanceReport.readyForProduction === false, 'Acceptance report must not claim production readiness.');
assert(response.body.privatePilotAcceptanceReport.acceptanceDecision === 'accepted-for-private-pilot', 'Acceptance report must produce a private-pilot acceptance decision.');
assert(response.body.privatePilotAcceptanceReport.launchRunId === launchRun.id && response.body.privatePilotAcceptanceReport.launchHealthCheckId === launchHealthCheck.id, 'Acceptance report must bind launch run and health receipts.');
assert(response.body.privatePilotAcceptanceReport.acceptanceChecksums?.projectEvidenceArchive && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.projectEvidenceExportWorkflow && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.managerFlowGraph && response.body.privatePilotAcceptanceReport.acceptanceChecksums?.readinessProofMap, 'Acceptance report must freeze evidence archive, export, Flow Graph, and Proof Map checksums.');
assert(response.body.privatePilotAcceptanceReport.proofIds?.length >= 10 && response.body.privatePilotAcceptanceReport.eventId && response.body.privatePilotAcceptanceReport.timelineLogId, 'Acceptance report must include proof, event, and timeline links.');
assert(response.body.privatePilotAcceptanceReportWorkflow?.readyForPrivatePilotAcceptance === true, 'Acceptance workflow must become ready after receipt.');
assert(response.body.launchOperationsOverview?.readyForPrivatePilotAcceptance === true, 'Acceptance receipt must immediately return the updated launch operations overview.');
assert(response.body.productionOperationsReadiness?.readyForPrivatePilotOperations === true, 'Acceptance receipt must immediately return production operations readiness for the next UI action.');
assert(response.body.productionOperationsControlReceiptWorkflow?.readyForPrivatePilotOperations === true, 'Acceptance receipt must immediately enable the production operations control receipt workflow.');
assert(response.body.readModels?.included === false && response.body.readModels.privatePilotAcceptanceReportWorkflowRoute?.endsWith('/private-pilot-acceptance-reports'), 'Acceptance receipt must support lightweight read-model refresh routes.');

const readyPackage = request({ method: 'GET', path: `/projects/${projectId}/manager-ready-package` });
assert(readyPackage.status === 200 && readyPackage.body.privatePilotLaunchRunWorkflow?.readyForPrivatePilotLaunch === true, 'Manager Ready Package must expose launch run readiness.');
assert(readyPackage.body.privatePilotLaunchHealthCheckWorkflow?.readyForPrivatePilotMonitoring === true, 'Manager Ready Package must expose launch health readiness.');
assert(readyPackage.body.privatePilotAcceptanceReportWorkflow?.readyForPrivatePilotAcceptance === true, 'Manager Ready Package must expose acceptance readiness.');
assert(readyPackage.body.summary?.privatePilotAcceptanceReportReady === true, 'Manager Ready Package summary must expose private-pilot acceptance readiness.');

const proofMap = request({ method: 'GET', path: `/projects/${projectId}/readiness-proof-map` });
assert(proofMap.status === 200 && proofMap.body.privatePilotLaunchRunRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-launch-runs') && route.readyForPrivatePilotLaunch === true), 'Readiness Proof Map must expose launch run route.');
assert(proofMap.body.privatePilotLaunchHealthCheckRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-launch-health-checks') && route.readyForPrivatePilotMonitoring === true), 'Readiness Proof Map must expose launch health route.');
assert(proofMap.body.privatePilotAcceptanceReportRoutes?.some((route) => route.apiPath?.endsWith('/private-pilot-acceptance-reports') && route.readyForPrivatePilotAcceptance === true), 'Readiness Proof Map must expose acceptance report route.');

const flowGraph = request({ method: 'GET', path: `/projects/${projectId}/manager-flow-graph` });
const flowText = asText(flowGraph.body);
assert(flowGraph.status === 200 && flowText.includes('private-pilot-launch-run') && flowText.includes('private-pilot-launch-health-check') && flowText.includes('private-pilot-acceptance-report'), 'Manager Flow Graph must include launch, health, and acceptance nodes.');
assert(flowText.includes(finalDeliverable.id), 'Manager Flow Graph must preserve final deliverable proof through acceptance.');

console.log('Private-pilot launch and acceptance focused contract validation passed.');
