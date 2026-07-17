import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MEETING_TURN_GRACE_PERIOD_MS,
  MEETING_TURN_STAGGER_MS,
  meetingTurnDelayMs,
} from '../src/agents/meetingQueueProtocol.js';

test('starts the leader response promptly and keeps later speakers separated', () => {
  assert.equal(MEETING_TURN_GRACE_PERIOD_MS, 800);
  assert.equal(MEETING_TURN_STAGGER_MS, 650);
  assert.equal(meetingTurnDelayMs(0), 800);
  assert.equal(meetingTurnDelayMs(2), 2100);
});

test('keeps a longer provider-requested delay when one is explicitly supplied', () => {
  assert.equal(meetingTurnDelayMs(0, 1500), 1500);
});
