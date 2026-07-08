import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertPackageBoundary(packageBoundary, label) {
  assert(packageBoundary?.schemaVersion === 'private-mvp-launch-package-boundary/v1', `${label} must expose private-mvp-launch-package-boundary/v1.`);
  assert(packageBoundary.reportSchemaVersion === 'private-mvp-launch-package/v1', `${label} must point to private-mvp-launch-package/v1.`);
  assert(packageBoundary.status === 'private-mvp-ready-public-production-blocked', `${label} must keep private MVP ready while public production is blocked.`);
  assert(packageBoundary.readyForControlledPrivateMvp === true, `${label} must allow controlled private MVP testing.`);
  assert(packageBoundary.readyForPublicProduction === false, `${label} must not mark public production ready.`);
  assert(packageBoundary.packageCommand === 'npm run agents:private-mvp-launch-package', `${label} must expose the operator package command.`);
  assert(packageBoundary.validationCommand === 'npm run agents:private-mvp-launch-package:validate', `${label} must expose the package validation command.`);
  assert(packageBoundary.allowedClaim === 'controlled private MVP testing only', `${label} must preserve the allowed private-MVP claim.`);
  assert(packageBoundary.forbiddenClaim === 'public production readiness', `${label} must preserve the forbidden public-production claim.`);
}

function assertPublicProductionNextSteps(overview, label) {
  assert(Array.isArray(overview?.publicProductionNextSteps), `${label} must expose publicProductionNextSteps.`);
  assert(overview.publicProductionNextSteps.length > 0, `${label} must include at least one public-production next step.`);
  assert(
    overview.backendRoutes?.productionCustomerAcceptancePolicy === '/production-customer-acceptance-policy',
    `${label} must expose the customer production acceptance policy route.`,
  );
  const firstStep = overview.publicProductionNextSteps[0];
  assert(firstStep.id?.startsWith('public-production-next-step-'), `${label} next step must have a stable public-production id.`);
  assert(firstStep.label, `${label} next step must have a Manager-readable label.`);
  assert(firstStep.owner, `${label} next step must have an owner.`);
  assert(firstStep.action, `${label} next step must have an action.`);
  assert(firstStep.whyBlocked, `${label} next step must explain why public production is blocked.`);
  assert(firstStep.apiPath, `${label} next step must include a backend route.`);
  assert(firstStep.runApiPath?.includes('/launch-operations-overview/public-production-next-steps/'), `${label} next step must include a run route.`);
  assert(
    firstStep.validationCommand === 'npm run launch:public-production:no-go'
      || firstStep.validationCommand === 'npm run agents:production-customer-acceptance',
    `${label} next step must point to a public-production validator.`,
  );
  if (firstStep.validationCommand === 'npm run agents:production-customer-acceptance') {
    assert(firstStep.apiPath === '/production-customer-acceptance-policy', `${label} customer acceptance next step must point to the policy route.`);
  }
  assert(firstStep.privateMvpImpact?.includes('Does not block controlled private MVP'), `${label} next step must keep private MVP separate from public production.`);
}

const projectId = 'launch_operations_private_mvp_project';
const service = createAgentProjectService({ messageLimit: 180 });
const api = createAgentProjectApi({ service });

const missionResponse = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'launch_operations_private_mvp_mission',
    meetingId: 'launch_operations_private_mvp_meeting',
    projectId,
    name: 'Launch Operations Private MVP Project',
    missionBrief: 'Validate that Manager launch operations can expose the Private MVP Launch Package boundary without claiming public production readiness.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      {
        id: 'task_launch_operations_private_mvp',
        text: 'Expose the Private MVP Launch Package boundary in Manager Launch Operations.',
        assignee: 'Alan Turing',
        status: 'pending',
      },
    ],
    runInitialTick: false,
    now: '2026-07-08T10:00:00.000Z',
  },
});

assert(missionResponse.status === 200, `Product Team Mission Runner returned ${missionResponse.status}.`);
assert(missionResponse.body.project?.id === projectId, 'Mission Runner must create the backend project.');

const serviceOverview = service.getLaunchOperationsOverview(projectId);
assert(serviceOverview.schemaVersion === 'launch-operations-overview/v1', 'Service must expose launch-operations-overview/v1.');
assert(serviceOverview.readyForPublicProduction === false, 'Service overview must keep public production blocked.');
assertPackageBoundary(serviceOverview.privateMvpLaunchPackage, 'Service launch operations overview');
assertPublicProductionNextSteps(serviceOverview, 'Service launch operations overview');
assert(
  serviceOverview.overviewRows?.some((row) => row.id === 'private-mvp-launch-package' && row.value === 'private-mvp-ready-public-production-blocked'),
  'Service overview rows must include the Private MVP Launch Package row.',
);

const readyPackage = service.getManagerReadyPackage(projectId);
assertPackageBoundary(readyPackage.launchOperationsOverview?.privateMvpLaunchPackage, 'Manager Ready Package launch operations overview');
assertPublicProductionNextSteps(readyPackage.launchOperationsOverview, 'Manager Ready Package launch operations overview');

const proofMap = service.getReadinessProofMap(projectId);
assert(
  proofMap.launchOperationsOverviewRoutes?.some((route) => route.apiPath === `/projects/${projectId}/launch-operations-overview`),
  'Readiness Proof Map must expose the launch operations overview route.',
);

const apiResponse = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/launch-operations-overview`,
});
assert(apiResponse.status === 200, `GET /launch-operations-overview returned ${apiResponse.status}.`);
assertPackageBoundary(apiResponse.body.launchOperationsOverview?.privateMvpLaunchPackage, 'API launch operations overview');
assertPublicProductionNextSteps(apiResponse.body.launchOperationsOverview, 'API launch operations overview');

const firstStep = apiResponse.body.launchOperationsOverview.publicProductionNextSteps[0];
const runResponse = api.handle({
  method: 'POST',
  path: firstStep.runApiPath,
  body: {
    includeReadModels: false,
    actor: 'Manager',
  },
});
assert(runResponse.status === 200, `POST public-production next-step run returned ${runResponse.status}.`);
const runReceipt = runResponse.body.launchOperationsNextStepRun;
assert(runReceipt?.schemaVersion === 'launch-operations-next-step-run/v1', 'Next-step run must return launch-operations-next-step-run/v1.');
assert(runReceipt.stepId === firstStep.id, 'Next-step run receipt must preserve the selected step id.');
assert(runReceipt.readyForControlledPrivateMvpAtRun === true, 'Next-step run must preserve controlled private MVP readiness.');
assert(runReceipt.readyForPublicProductionAtRun === false, 'Next-step run must not mark public production ready.');
assert(runReceipt.validationCommand === firstStep.validationCommand, 'Next-step run must preserve the selected validator.');
assert(runReceipt.timelineLogIds?.length === 1, 'Next-step run must create timeline proof.');
assert(runReceipt.eventIds?.length === 1, 'Next-step run must create event-ledger proof.');
assert(runResponse.body.readModels?.managerFlowGraphRoute === `/projects/${projectId}/manager-flow-graph`, 'Next-step run must return Manager Flow Graph refresh route.');
assert(runResponse.body.readModels?.readinessProofMapRoute === `/projects/${projectId}/readiness-proof-map`, 'Next-step run must return Readiness Proof Map refresh route.');

const refreshedOverview = service.getLaunchOperationsOverview(projectId, { fresh: true });
assert(refreshedOverview.readyForPublicProduction === false, 'Recording a next-step receipt must not close public production readiness.');
const flowGraph = service.getManagerFlowGraph(projectId, { fresh: true });
assert(
  flowGraph.nodes?.some((node) => node.subtype === 'launch-operations-next-step-run' && node.proofIds?.includes(runReceipt.id)),
  'Manager Flow Graph must expose the Launch Operations next-step run receipt node.',
);
assert(
  flowGraph.nodes?.some((node) => (
    node.subtype === 'launch-operations-next-step-run'
    && node.relatedNodeIds?.includes('launch-operations-overview')
    && node.attachments?.some((attachment) => attachment.schemaVersion === 'launch-operations-next-step-run/v1')
  )),
  'Manager Flow Graph must connect the next-step receipt node back to Launch Operations with a receipt attachment.',
);
const refreshedProofMap = service.getReadinessProofMap(projectId);
assert(
  refreshedProofMap.launchOperationsOverviewSummary?.nextStepRunCount >= 1,
  'Readiness Proof Map must count Launch Operations next-step run receipts.',
);
assert(
  refreshedProofMap.launchOperationsOverviewSummary?.proofIds?.includes(runReceipt.id),
  'Readiness Proof Map must expose Launch Operations next-step run proof ids.',
);

console.log('Launch Operations Private MVP package boundary validation passed.');
