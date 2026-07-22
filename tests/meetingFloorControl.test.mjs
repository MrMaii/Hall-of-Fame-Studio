import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMeetingTurnQueue,
  meetingDraftClaimsFloor,
} from '../src/meeting/meetingFloorControl.js';

test('only a non-empty meeting draft claims the director floor', () => {
  assert.equal(meetingDraftClaimsFloor(''), false);
  assert.equal(meetingDraftClaimsFloor('   '), false);
  assert.equal(meetingDraftClaimsFloor('\n\t'), false);
  assert.equal(meetingDraftClaimsFloor('pause please'), true);
});

test('resumes the same speaking turn with its remaining duration after the director yields', () => {
  let nowMs = 0;
  const timers = [];
  const events = [];
  const queue = createMeetingTurnQueue({
    now: () => nowMs,
    setTimer(callback, delayMs) {
      const timer = { callback, delayMs, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
  });

  queue.schedule({
    intentId: 'turn-1',
    delayMs: 1_000,
    speakDurationMs: 2_000,
    onStart: () => events.push('started'),
    onPause: () => events.push('paused'),
    onResume: () => events.push('resumed'),
    onYield: () => events.push('yielded'),
  });

  nowMs = 1_000;
  timers[0].callback();
  nowMs = 1_500;
  queue.setUserActive(true);

  assert.equal(timers[1].cleared, true);
  assert.deepEqual(events, ['started', 'paused']);
  assert.equal(queue.status('turn-1'), 'paused');

  nowMs = 2_500;
  queue.setUserActive(false);
  assert.deepEqual(events, ['started', 'paused', 'resumed']);
  assert.equal(timers[2].delayMs, 1_500);

  nowMs = 4_000;
  timers[2].callback();
  assert.deepEqual(events, ['started', 'paused', 'resumed', 'yielded']);
  assert.equal(queue.status('turn-1'), null);
});

test('keeps a queued turn silent while a non-empty director draft owns the floor', () => {
  const timers = [];
  const events = [];
  const queue = createMeetingTurnQueue({
    setTimer(callback, delayMs) {
      const timer = { callback, delayMs, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
  });

  queue.setUserActive(true);
  queue.schedule({
    intentId: 'turn-queued',
    delayMs: 800,
    speakDurationMs: 1_000,
    onStart: () => events.push('started'),
  });

  assert.equal(timers.length, 0);
  assert.equal(queue.status('turn-queued'), 'queued');
  queue.setUserActive(false);
  assert.equal(timers[0].delayMs, 800);
  timers[0].callback();
  assert.deepEqual(events, ['started']);
});
