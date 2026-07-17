import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const simpleViewUrl = new URL('../src/meeting/ProjectSimpleMeetingRouteView.jsx', import.meta.url);
const advancedViewUrl = new URL('../src/meeting/AdvancedMeetingRoomRouteView.jsx', import.meta.url);

test('simple and complete meeting displays load independently while retaining every meeting action', () => {
  assert.ok(existsSync(simpleViewUrl), 'ProjectSimpleMeetingRouteView must exist');
  assert.ok(existsSync(advancedViewUrl), 'AdvancedMeetingRoomRouteView must exist');
  const simpleViewSource = readFileSync(simpleViewUrl, 'utf8');
  const advancedViewSource = readFileSync(advancedViewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./meeting/ProjectSimpleMeetingRouteView.jsx'))"));
  assert.ok(appSource.includes("lazy(() => import('./meeting/AdvancedMeetingRoomRouteView.jsx'))"));
  assert.ok(appSource.includes('<ProjectSimpleMeetingRouteView'));
  assert.ok(appSource.includes('<AdvancedMeetingRoomRouteView'));
  assert.ok(!appSource.includes('<ProjectSimpleMeeting\n'));
  assert.ok(!appSource.includes('<AdvancedMeetingRoom\n'));

  for (const retained of ['ProjectSimpleMeeting', 'onSend', 'onToggleVoice', 'onOpenSettings', 'onClose']) {
    assert.ok(simpleViewSource.includes(retained), `simple meeting route view is missing ${retained}`);
  }
  for (const retained of ['AdvancedMeetingRoom', 'submitMeetingInput', 'toggleRoomVoiceInput', 'completeMeeting', 'closeMeeting']) {
    assert.ok(advancedViewSource.includes(retained), `complete meeting route view is missing ${retained}`);
  }

  for (const retainedAction of ['submitRoomInput', 'toggleRoomVoiceInput', 'exitProjectScene', 'setMeetingStartTime']) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
  }
});
