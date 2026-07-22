import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../src/meeting/AdvancedMeetingRoom.jsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../src/meeting/AdvancedMeetingRoomRouteView.jsx', import.meta.url), 'utf8');
const initiationFlowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');

test('complete meeting room stays lazy and keeps every public meeting control', () => {
  assert.ok(appSource.includes("const AdvancedMeetingRoomRouteView = lazy(() => import('./meeting/AdvancedMeetingRoomRouteView.jsx'))"));
  assert.ok(appSource.includes('<AdvancedMeetingRoomRouteView'));
  assert.ok(routeSource.includes("import AdvancedMeetingRoom from './AdvancedMeetingRoom.jsx';"));
  assert.ok(routeSource.includes('<AdvancedMeetingRoom'));
  assert.ok(routeSource.includes('roomUserIntentActive={roomUserIntentActive}'));

  for (const publicControl of [
    'project-meeting-room-stage',
    'project-scene-back',
    'project-meeting-intent-panel',
    'Intent Queue',
    'Meeting Transcript',
    'project-meeting-voice',
    'project-meeting-input',
    'project-meeting-send',
    'backend-meeting-send-open-deployment',
  ]) {
    assert.ok(roomSource.includes(publicControl), `complete meeting room must keep ${publicControl}`);
  }
});

test('complete meeting room localizes visible meeting status and controls', () => {
  for (const label of [
    '会议进行中',
    '当前发言人',
    '位排队中',
    '开始立项讨论',
    '输入会议发言',
  ]) {
    assert.ok(roomSource.includes(label), `complete meeting room must include Chinese label: ${label}`);
  }
  assert.ok(initiationFlowSource.includes("activeLanguage === 'zh' ? '立项内容生成来源' : 'Kickoff Generation Source'"));
  assert.ok(appSource.includes("activeLanguage === 'zh' ? '模型测试运行' : 'model rehearsal'"));
  assert.ok(roomSource.includes("import { meetingMessageStatusLabel } from './meetingMessageState.js';"));
  assert.ok(roomSource.includes('data-testid={`meeting-message-status-${log.id}`}'));
  assert.ok(roomSource.includes('meetingMessageStatusLabel(log.deliveryStatus, activeLanguage)'));
});

test('meeting diagnostics preserve technical node ids and natural Chinese queue labels', () => {
  for (const technicalNode of [
    '<span data-no-localize="" className="node-id-tag bg-[#8f1e18]">INT</span>',
    '<span data-no-localize="" className="node-id-tag bg-[#8f1e18]">LOG</span>',
    '<span data-no-localize="" className="node-id-tag" style={{ fontSize: \'7px\' }}>INT-',
    '<span data-no-localize="" className="node-id-tag" style={{ fontSize: \'7px\' }}>LOG-',
  ]) {
    assert.ok(roomSource.includes(technicalNode), `missing protected meeting diagnostic: ${technicalNode}`);
  }
  assert.ok(roomSource.includes("text('智能体发言意图', 'Agent Intent')"));
  assert.ok(roomSource.includes("text('智能体发言队列已就绪', 'Agent intent queue ready')"));
  assert.ok(!roomSource.includes("text('Agent 发言意图', 'Agent Intent')"));
});
