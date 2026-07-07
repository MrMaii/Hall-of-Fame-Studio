import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summarizeIntentRun(body = {}) {
  return JSON.stringify({
    keys: Object.keys(body),
    collaborationIntentRun: body.collaborationIntentRun ? {
      id: body.collaborationIntentRun.id,
      intentId: body.collaborationIntentRun.intentId,
      delegatedRunKind: body.collaborationIntentRun.delegatedRunKind,
      delegatedReceiptId: body.collaborationIntentRun.delegatedReceiptId,
      workSubmissionId: body.collaborationIntentRun.workSubmissionId,
      outputNodeCount: body.collaborationIntentRun.outputNodes?.length || 0,
    } : null,
    autonomousRunControlRun: body.autonomousRunControlRun ? {
      id: body.autonomousRunControlRun.id,
      actionId: body.autonomousRunControlRun.actionId,
      delegatedRunKind: body.autonomousRunControlRun.delegatedRunKind,
      workSubmissionId: body.autonomousRunControlRun.workSubmissionId,
      reviewId: body.autonomousRunControlRun.reviewId,
    } : null,
    agentAutonomousActionRun: body.agentAutonomousActionRun ? {
      id: body.agentAutonomousActionRun.id,
      agentId: body.agentAutonomousActionRun.agentId,
      selectedAction: body.agentAutonomousActionRun.selectedAction,
      workSubmissionId: body.agentAutonomousActionRun.workSubmissionId,
      reviewId: body.agentAutonomousActionRun.reviewId,
    } : null,
    workSubmission: body.workSubmission ? {
      id: body.workSubmission.id,
      schemaVersion: body.workSubmission.schemaVersion,
      artifactType: body.workSubmission.artifactType,
      messageId: body.workSubmission.messageId,
      timelineLogId: body.workSubmission.timelineLogId,
      eventId: body.workSubmission.eventId,
    } : null,
    submission: body.submission ? {
      id: body.submission.id,
      schemaVersion: body.submission.schemaVersion,
      artifactType: body.submission.artifactType,
    } : null,
  });
}

const projectId = 'mission_runner_startup_http_project';
const missionId = 'mission_runner_startup_http_mission';
const meetingId = 'mission_runner_startup_http_meeting';

const team = [
  { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
  { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence judgement' },
  { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'backend proof' },
  { id: 'da_vinci', name: 'Leonardo da Vinci', role: 'Inventor', skill: 'brainstorm synthesis' },
];

const tasks = [
  { id: 'task_brainstorm', text: 'Brainstorm generic product-team delivery options.', assignee: 'Leonardo da Vinci', status: 'pending' },
  { id: 'task_evidence', text: 'Collect evidence for the strongest direction.', assignee: 'Marie Curie', status: 'pending' },
  { id: 'task_brief', text: 'Draft a manager-readable product brief.', assignee: 'Alan Turing', status: 'pending' },
  { id: 'task_review', text: 'Review, revise, and accept the final deliverable.', assignee: 'Marie Curie', status: 'pending' },
];

const service = createAgentProjectService({ messageLimit: 360 });
const api = createAgentProjectApi({ service });
const httpServer = createAgentProjectHttpServer({ api });

async function main() {
  const runtime = await httpServer.listen({ port: 0, host: '127.0.0.1' });
  const request = async ({ method = 'GET', path, body } = {}) => {
    const response = await fetch(`${runtime.url}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const responseBody = await response.json();
    return { status: response.status, body: responseBody };
  };

  try {
    let response = await request({
      method: 'POST',
      path: '/product-team-missions',
      body: {
        includeReadModels: false,
        missionId,
        meetingId,
        projectId,
        name: 'Mission Runner Startup HTTP Project',
        missionBrief: 'Validate that a blank customer goal can start a generic AI product-team mission and hand it to the A-side runtime.',
        validationSample: 'research-project',
        team,
        selectedLeaderId: 'jobs',
        reviewerId: 'curie',
        tasks,
        maxLoops: 1,
        maxStepsPerLoop: 1,
        runInitialTick: true,
        now: '2026-06-01T09:00:00.000Z',
      },
    });
    assert(response.status === 200, `Mission Runner returned ${response.status}.`);
    const missionRun = response.body.productTeamMissionRun || {};
    assert(missionRun.schemaVersion === 'product-team-mission-run/v1', 'Mission Runner must return a product-team mission receipt.');
    assert(missionRun.missionType === 'generic-product-team' && missionRun.researchOnly === false, 'Mission Runner must stay generic product-team, not research-only.');
    assert(missionRun.reusedKickoffMeeting === false && missionRun.kickoffMeetingId === meetingId, 'Mission Runner must own the kickoff startup proof for a blank mission.');
    assert(missionRun.customerAgentHandoff?.schemaVersion === 'product-team-customer-agent-handoff/v1', 'Mission Runner must expose the C/A handoff contract.');
    assert(missionRun.customerAgentHandoff.readyForLocalAutonomy === true, 'Mission Runner must start local A-side autonomy.');
    assert(missionRun.customerAgentHandoff.firstTickRecorded === true, 'Mission Runner must record the first A-side tick when requested.');
    assert(missionRun.customerAgentHandoff.nextRoutes?.collaborationIntentQueue === `/projects/${projectId}/collaboration-intent-queue`, 'Mission Runner handoff must route to Collaboration Intent Queue.');
    assert(missionRun.readRoutes?.runtimeAutonomyStatus === `/projects/${projectId}/runtime-autonomy-status`, 'Mission Runner receipt must expose Runtime Autonomy Status route.');
    assert((response.body.meeting?.transcript || []).some((turn) => turn.stage === 'leader-campaign'), 'Mission Runner kickoff must include Leader campaign/self-marketing turns.');
    assert((missionRun.proofIds || []).length && (missionRun.timelineLogIds || []).length && (missionRun.eventIds || []).length, 'Mission Runner receipt must carry proof, timeline, and event ids.');

    response = await request({ path: `/projects/${projectId}/product-team-missions` });
    assert(response.status === 200 && response.body.productTeamMissionRuns?.some((run) => run.id === missionId), 'Project mission list must expose the Mission Runner receipt.');

    response = await request({ path: `/projects/${projectId}/product-team-missions/${missionId}` });
    assert(response.status === 200 && response.body.productTeamMissionRun?.id === missionId, 'Project mission read route must expose the individual Mission Runner receipt.');

    response = await request({ path: `/projects/${projectId}/runtime-autonomy-status` });
    const runtimeStatus = response.body.runtimeAutonomyStatus || {};
    assert(response.status === 200 && runtimeStatus.schemaVersion === 'runtime-autonomy-status/v1', 'Runtime Autonomy Status must be readable after Mission Runner startup.');
    assert(runtimeStatus.gates?.some((row) => row.id === 'mission-runner-started' && row.ready), 'Runtime Autonomy Status must prove Mission Runner started.');
    assert(runtimeStatus.gates?.some((row) => row.id === 'production-unattended-autonomy-blocked' && row.productionBlocker && row.ready === false), 'Runtime Autonomy Status must preserve the production autonomy blocker.');

    response = await request({ path: `/projects/${projectId}/product-team-operating-loop` });
    assert(response.status === 200 && response.body.productTeamOperatingLoop?.customerSide?.handoff?.schemaVersion === 'product-team-customer-agent-handoff/v1', 'Product Team Operating Loop must expose the C/A handoff.');
    assert(response.body.productTeamOperatingLoop.customerSide.handoffExecution?.schemaVersion === 'product-team-customer-agent-handoff-execution/v1', 'Product Team Operating Loop must expose handoff execution proof.');

    response = await request({ path: `/projects/${projectId}/collaboration-intent-queue` });
    const handoffIntent = response.body.collaborationIntentQueue?.rows?.find((row) => row.id === 'customer-agent-handoff-intent');
    assert(response.status === 200 && handoffIntent?.source === 'product-team-customer-agent-handoff' && handoffIntent.canRun, 'Collaboration Intent Queue must expose the Mission Runner handoff as runnable.');
    assert(handoffIntent.runIntentApiPath === `/projects/${projectId}/collaboration-intent-queue/customer-agent-handoff-intent/run`, 'Mission handoff intent must expose its backend run route.');
    assert((response.body.collaborationIntentQueue.summary?.customerAgentHandoffIntentCount || 0) >= 1, 'Collaboration Intent Queue summary must count the Mission Runner handoff intent.');

    response = await request({
      method: 'POST',
      path: handoffIntent.runIntentApiPath,
      body: {
        includeReadModels: false,
        now: '2026-06-01T09:03:00.000Z',
      },
    });
    assert(response.status === 200 && response.body.collaborationIntentRun?.schemaVersion === 'collaboration-intent-run/v1', 'Mission handoff intent run must record a Collaboration Intent receipt.');
    assert(response.body.collaborationIntentRun.delegatedRunKind === 'autonomous-run-control' && response.body.collaborationIntentRun.delegatedReceiptId, 'Mission handoff intent must delegate to Autonomous Run Control.');
    assert(response.body.autonomousRunControlRun?.schemaVersion === 'autonomous-run-control-action-run/v1', 'Mission handoff intent must return the Autonomous Run Control receipt.');
    assert(response.body.workSubmission?.id && response.body.workSubmission.artifactType && response.body.workSubmission.messageId && response.body.workSubmission.timelineLogId && response.body.workSubmission.eventId, `Mission handoff continuation must return a proofed Agent submission output node. ${summarizeIntentRun(response.body)}`);

    response = await request({ path: `/projects/${projectId}/manager-flow-graph` });
    assert(response.status === 200, `Manager Flow Graph returned ${response.status}.`);
    assert(response.body.nodes?.some((node) => node.id === `product-team-mission-run-${missionId}` && node.proofIds?.length), 'Manager Flow Graph must expose the Mission Runner receipt node.');
    assert(response.body.nodes?.some((node) => node.source === 'agentSubmissions' && node.proofIds?.length && node.timelineLogIds?.length && node.eventIds?.length), 'Manager Flow Graph must expose the A-side Agent submission node created after handoff.');

    response = await request({ path: `/projects/${projectId}/readiness-proof-map` });
    assert(response.status === 200, `Readiness Proof Map returned ${response.status}.`);
    assert(response.body.productTeamMissionRunRoutes?.some((route) => route.id === missionId && route.proofIds?.length), 'Readiness Proof Map must expose Mission Runner proof routes.');
    assert(response.body.submissionRoutes?.some((route) => route.proofIds?.length && route.timelineLogIds?.length && route.eventIds?.length), 'Readiness Proof Map must expose A-side Agent submission proof routes.');

    console.log('Mission Runner startup HTTP validation passed.');
  } finally {
    await httpServer.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
