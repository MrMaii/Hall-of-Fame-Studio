import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const setupSource = readFileSync(new URL('../src/meeting/ProjectMeetingSetup.jsx', import.meta.url), 'utf8');
const advancedRoomSource = readFileSync(new URL('../src/meeting/AdvancedMeetingRoom.jsx', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/agents/agentProjectApi.js', import.meta.url), 'utf8');

test('ordinary project meetings require a confirmed agenda, attendees, and recorder before entering', () => {
  assert.ok(appSource.includes('hydrateProject({ ...project, ...backendProjectPayload })'), 'partial backend snapshots must preserve the already loaded team');
  assert.ok(appSource.includes("const ProjectMeetingSetup = lazy(() => import('./meeting/ProjectMeetingSetup.jsx'));"));
  assert.ok(appSource.includes('if (!usesCustomMeetingSubmit && !projectMeetingSession)'));
  for (const control of [
    'project-meeting-setup',
    'project-meeting-agenda',
    'project-meeting-participant-',
    'project-meeting-recorder',
    'project-meeting-confirm-start',
  ]) {
    assert.ok(setupSource.includes(control), `meeting preflight must keep ${control}`);
  }
  assert.ok(setupSource.includes('selectedIds.includes(draft.recorderId)'));
});

test('backend-authored meeting sessions replace the browser-only intent preview', () => {
  assert.ok(apiSource.includes("route.tail[0] === 'start'"));
  assert.ok(apiSource.includes('service.startProjectMeeting'));
  assert.ok(apiSource.includes("route.tail[0] === 'complete'"));
  assert.ok(apiSource.includes('service.completeProjectMeeting'));
  assert.ok(appSource.includes('const previewExchange = useBackendMeeting ? null'));
  assert.ok(appSource.includes('meetingSessionId: projectMeetingSession?.id || null'));
  assert.ok(appSource.includes('language: activeLanguage'));
  assert.ok(appSource.includes('if (backendResult?.meetingSession) setProjectMeetingSession(backendResult.meetingSession)'));
});

test('the assigned recorder closes the meeting with visible local minutes proof', () => {
  assert.ok(appSource.includes("runBackendProjectCommand('meeting/complete'"));
  assert.ok(appSource.includes("throw new Error('会议纪要没有写入本地工作区。')"));
  for (const proof of [
    'project-meeting-complete',
    'project-meeting-session-context',
    'project-meeting-completion',
    'project-meeting-summary-path',
  ]) {
    assert.ok(advancedRoomSource.includes(proof), `meeting room must expose ${proof}`);
  }
});
