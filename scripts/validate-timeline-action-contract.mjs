import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const projectId = 'timeline_action_contract_project';
const service = createAgentProjectService({ messageLimit: 160 });
const api = createAgentProjectApi({ service });

let response = api.handle({
  method: 'POST',
  path: '/product-team-missions',
  body: {
    includeReadModels: false,
    missionId: 'timeline_action_contract_mission',
    meetingId: 'timeline_action_contract_meeting',
    projectId,
    name: 'Timeline Action Contract Project',
    missionBrief: 'Validate backend timeline action receipts for generic product-team proof review.',
    team: [
      { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
      { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      { id: 'turing', name: 'Alan Turing', role: 'System Architect', skill: 'implementation proof' },
    ],
    selectedLeaderId: 'jobs',
    reviewerId: 'curie',
    tasks: [
      { id: 'task_timeline_action', text: 'Record a manager note against a timeline proof node.', assignee: 'Steve Jobs', status: 'pending' },
    ],
    runInitialTick: false,
    now: '2026-06-01T09:00:00.000Z',
  },
});

assert(response.status === 200 && response.body.project?.id === projectId, 'Mission Runner must create a backend project with timeline logs.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/timeline`,
});
assert(response.status === 200, `Timeline read returned ${response.status}.`);
const targetLog = response.body.logs?.find((log) => log.id && /project-approved|leader|kickoff|mission/i.test(`${log.eventType || ''} ${log.log || ''}`))
  || response.body.logs?.[0];
assert(targetLog?.id, 'Timeline action validation needs a real backend timeline log.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/timeline/actions`,
  body: {
    includeReadModels: false,
    timelineLogId: targetLog.id,
    action: 'note',
    note: 'Manager confirms this proof node is ready for investor review. secret=sk-timelineactionsecret123',
    actor: 'Director',
    actorId: 'director',
    now: '2026-06-01T09:06:00.000Z',
  },
});

assert(response.status === 200, `Timeline note action returned ${response.status}.`);
const noteReceipt = response.body.timelineActionReceipt;
assert(noteReceipt?.schemaVersion === 'timeline-action-receipt/v1', 'Timeline action must return timeline-action-receipt/v1.');
assert(noteReceipt.action === 'note' && noteReceipt.targetTimelineLogId === targetLog.id, 'Timeline action receipt must preserve action and target log id.');
assert(noteReceipt.timelineLogId && noteReceipt.eventId && noteReceipt.checksum, 'Timeline action must create timeline, event, and checksum proof.');
assert(response.body.readModels?.timelineActionsRoute === `/projects/${projectId}/timeline/actions`, 'Deferred read models must expose the timeline actions route.');
assert(response.body.readModels?.timelineRoute === `/projects/${projectId}/timeline`, 'Deferred read models must expose the timeline refresh route.');
assert(response.body.readModels?.eventsRoute === `/projects/${projectId}/events`, 'Deferred read models must expose the event-ledger refresh route.');
assert(response.body.readModels?.timelineActionReceiptRoute === `/projects/${projectId}/timeline/actions#${encodeURIComponent(noteReceipt.id)}`, 'Deferred read models must expose a note action receipt anchor.');
assert(response.body.project?.timelineActionReceipts?.some((row) => row.id === noteReceipt.id), 'Timeline action receipt must persist on the project.');
assert(response.body.project?.logs?.some((log) => log.id === noteReceipt.timelineLogId && log.eventType === 'timeline-action-note'), 'Timeline action must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === noteReceipt.eventId && event.type === 'timeline-action-note'), 'Timeline action must persist an event-ledger row.');
assert(!JSON.stringify(response.body).includes('sk-timelineactionsecret123'), 'Timeline action notes must pass through secret redaction.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/timeline/actions`,
  body: {
    includeReadModels: false,
    timelineLogId: targetLog.id,
    action: 'acknowledge',
    actor: 'Director',
    actorId: 'director',
    now: '2026-06-01T09:07:00.000Z',
  },
});

assert(response.status === 200, `Timeline acknowledge action returned ${response.status}.`);
const acknowledgeReceipt = response.body.timelineActionReceipt;
assert(acknowledgeReceipt?.schemaVersion === 'timeline-action-receipt/v1', 'Timeline acknowledge action must return timeline-action-receipt/v1.');
assert(acknowledgeReceipt.action === 'acknowledge' && acknowledgeReceipt.targetTimelineLogId === targetLog.id, 'Timeline acknowledge receipt must preserve action and target log id.');
assert(acknowledgeReceipt.timelineLogId && acknowledgeReceipt.eventId && acknowledgeReceipt.checksum, 'Timeline acknowledge action must create timeline, event, and checksum proof.');
assert(response.body.readModels?.timelineActionReceiptRoute === `/projects/${projectId}/timeline/actions#${encodeURIComponent(acknowledgeReceipt.id)}`, 'Deferred read models must expose an acknowledge action receipt anchor.');
assert(response.body.project?.timelineActionReceipts?.some((row) => row.id === acknowledgeReceipt.id), 'Timeline acknowledge receipt must persist on the project.');
assert(response.body.project?.logs?.some((log) => log.id === acknowledgeReceipt.timelineLogId && log.eventType === 'timeline-action-acknowledge'), 'Timeline acknowledge action must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === acknowledgeReceipt.eventId && event.type === 'timeline-action-acknowledge'), 'Timeline acknowledge action must persist an event-ledger row.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/timeline/actions`,
  body: {
    includeReadModels: false,
    timelineLogId: targetLog.id,
    action: 'complete',
    actor: 'Director',
    actorId: 'director',
    now: '2026-06-01T09:08:00.000Z',
  },
});

assert(response.status === 200, `Timeline complete action returned ${response.status}.`);
const completeReceipt = response.body.timelineActionReceipt;
assert(completeReceipt?.schemaVersion === 'timeline-action-receipt/v1', 'Timeline complete action must return timeline-action-receipt/v1.');
assert(completeReceipt.action === 'complete' && completeReceipt.targetTimelineLogId === targetLog.id, 'Timeline complete receipt must preserve action and target log id.');
assert(completeReceipt.timelineLogId && completeReceipt.eventId && completeReceipt.checksum, 'Timeline complete action must create timeline, event, and checksum proof.');
assert(response.body.project?.timelineActionReceipts?.some((row) => row.id === completeReceipt.id), 'Timeline complete receipt must persist on the project.');
assert(response.body.project?.logs?.some((log) => log.id === completeReceipt.timelineLogId && log.eventType === 'timeline-action-complete'), 'Timeline complete action must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === completeReceipt.eventId && event.type === 'timeline-action-complete'), 'Timeline complete action must persist an event-ledger row.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/timeline/actions`,
  body: {
    includeReadModels: false,
    timelineLogId: targetLog.id,
    action: 'edit',
    note: 'Manager edit note: tighten the proof label without changing original evidence.',
    actor: 'Director',
    actorId: 'director',
    now: '2026-06-01T09:09:00.000Z',
  },
});

assert(response.status === 200, `Timeline edit action returned ${response.status}.`);
const editReceipt = response.body.timelineActionReceipt;
assert(editReceipt?.schemaVersion === 'timeline-action-receipt/v1', 'Timeline edit action must return timeline-action-receipt/v1.');
assert(editReceipt.action === 'edit' && editReceipt.targetTimelineLogId === targetLog.id, 'Timeline edit receipt must preserve action and target log id.');
assert(editReceipt.note?.includes('tighten the proof label'), 'Timeline edit receipt must preserve the redacted edit note.');
assert(editReceipt.timelineLogId && editReceipt.eventId && editReceipt.checksum, 'Timeline edit action must create timeline, event, and checksum proof.');
assert(response.body.project?.timelineActionReceipts?.some((row) => row.id === editReceipt.id), 'Timeline edit receipt must persist on the project.');
assert(response.body.project?.logs?.some((log) => log.id === editReceipt.timelineLogId && log.eventType === 'timeline-action-edit'), 'Timeline edit action must persist a timeline log.');
assert(response.body.project?.eventLedger?.some((event) => event.id === editReceipt.eventId && event.type === 'timeline-action-edit'), 'Timeline edit action must persist an event-ledger row.');

response = api.handle({
  method: 'POST',
  path: `/projects/${projectId}/timeline/actions`,
  body: {
    includeReadModels: false,
    timelineLogId: targetLog.id,
    action: 'edit',
    actor: 'Director',
    actorId: 'director',
    now: '2026-06-01T09:10:00.000Z',
  },
});
assert(response.status !== 200 && /requires note text/i.test(response.body?.message || response.body?.error || ''), 'Timeline edit action must fail closed without an edit note.');

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/timeline`,
});
assert(
  response.status === 200
    && [noteReceipt, acknowledgeReceipt, completeReceipt, editReceipt].every((receipt) => response.body.logs?.some((log) => log.id === receipt.timelineLogId)),
  'Timeline read must expose persisted note, acknowledge, complete, and edit action logs.',
);

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/events`,
});
assert(
  response.status === 200
    && [noteReceipt, acknowledgeReceipt, completeReceipt, editReceipt].every((receipt) => response.body.eventLedger?.some((event) => event.id === receipt.eventId)),
  'Event ledger read must expose persisted note, acknowledge, complete, and edit action events.',
);

response = api.handle({
  method: 'GET',
  path: `/projects/${projectId}/manager-flow-graph`,
});
assert(response.status === 200, 'Manager Flow Graph must be readable after timeline action.');
assert(response.body.nodes?.some((node) => node.timelineLogIds?.includes(noteReceipt.timelineLogId)), 'Manager Flow Graph must expose the note action as a proofed timeline node.');
assert(response.body.nodes?.some((node) => node.timelineLogIds?.includes(acknowledgeReceipt.timelineLogId)), 'Manager Flow Graph must expose the acknowledge action as a proofed timeline node.');
assert(response.body.nodes?.some((node) => node.timelineLogIds?.includes(completeReceipt.timelineLogId)), 'Manager Flow Graph must expose the complete action as a proofed timeline node.');
assert(response.body.nodes?.some((node) => node.timelineLogIds?.includes(editReceipt.timelineLogId)), 'Manager Flow Graph must expose the edit action as a proofed timeline node.');

const appSource = (await import('node:fs')).readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
assert(appSource.includes('timeline-action-complete') && appSource.includes("submitSelectedTimelineAction('complete')"), 'React Timeline detail must expose a backend complete action.');
assert(appSource.includes('timeline-action-edit') && appSource.includes("submitSelectedTimelineAction('edit')"), 'React Timeline detail must expose a backend edit action.');

console.log('Timeline action contract validation passed.');
