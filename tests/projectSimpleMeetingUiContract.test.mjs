import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/meeting/ProjectSimpleMeeting.jsx', import.meta.url);
const simpleRouteSource = readFileSync(new URL('../src/meeting/ProjectSimpleMeetingRouteView.jsx', import.meta.url), 'utf8');
const advancedRouteSource = readFileSync(new URL('../src/meeting/AdvancedMeetingRoomRouteView.jsx', import.meta.url), 'utf8');

test('simple project meeting stays lazy while all meeting operations remain connected', () => {
  assert.ok(appSource.includes("const ProjectSimpleMeetingRouteView = lazy(() => import('./meeting/ProjectSimpleMeetingRouteView.jsx'));"));
  assert.ok(appSource.includes('<ProjectSimpleMeetingRouteView'));
  assert.ok(simpleRouteSource.includes("import ProjectSimpleMeeting from './ProjectSimpleMeeting.jsx';"));
  assert.ok(simpleRouteSource.includes('<ProjectSimpleMeeting'));
  assert.ok(appSource.includes('if (!usesCustomMeetingSubmit && !projectDashboardAdvancedOpen)'));
  assert.ok(simpleRouteSource.includes('onClose={closeMeeting}'));
  assert.ok(simpleRouteSource.includes('onOpenSettings={() => { setSettingsTab(\'deployment\'); setSettingsOpen(true); }}'));
  assert.ok(simpleRouteSource.includes('onSend={() => submitMeetingInput(meetingProject)}'));
  assert.ok(simpleRouteSource.includes('onToggleVoice={toggleRoomVoiceInput}'));
  assert.ok(simpleRouteSource.includes('onUserIntentChange={setRoomUserIntentActive}'));

  assert.ok(appSource.includes("const AdvancedMeetingRoomRouteView = lazy(() => import('./meeting/AdvancedMeetingRoomRouteView.jsx'));"));
  assert.ok(appSource.includes('<AdvancedMeetingRoomRouteView'));
  assert.ok(advancedRouteSource.includes("import AdvancedMeetingRoom from './AdvancedMeetingRoom.jsx';"));
  assert.ok(advancedRouteSource.includes('<AdvancedMeetingRoom'));
  assert.ok(appSource.includes("if (projectMode === 'meeting') return renderProjectMeeting();"));

  const componentSource = readFileSync(componentUrl, 'utf8');
  assert.ok(componentSource.includes("lazy(() => import('./MeetingRoomStage.jsx'))"));
  assert.ok(componentSource.includes("lazy(() => import('./MeetingTranscriptPanel.jsx'))"));
  assert.ok(componentSource.includes("lazy(() => import('./MeetingInputPanel.jsx'))"));
  for (const retainedSurface of [
    'data-testid="project-simple-meeting"',
    'data-testid="project-meeting-response-status"',
    'aria-label="返回项目"',
    '会议记录',
    '输入内容已经保留，可以修改后重新发送。',
  ]) {
    assert.ok(componentSource.includes(retainedSurface), `simple meeting surface is missing: ${retainedSurface}`);
  }
});
