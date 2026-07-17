import assert from 'node:assert/strict';
import test from 'node:test';

import { createMeetingRunController } from '../src/meeting/meetingRunController.js';

test('ends an unanswered meeting run at the configured deadline', () => {
  const scheduled = [];
  const timedOut = [];
  const controller = createMeetingRunController({
    setTimer(callback, delayMs) {
      const timer = { callback, delayMs, cleared: false };
      scheduled.push(timer);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
    onTimeout(messageId) {
      timedOut.push(messageId);
    },
  });

  controller.start('message-1', 25_000);
  assert.equal(scheduled[0].delayMs, 25_000);
  scheduled[0].callback();
  assert.deepEqual(timedOut, ['message-1']);
});

test('does not time out a completed or replaced meeting run', () => {
  const scheduled = [];
  const timedOut = [];
  const controller = createMeetingRunController({
    setTimer(callback) {
      const timer = { callback, cleared: false };
      scheduled.push(timer);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
    onTimeout(messageId) {
      timedOut.push(messageId);
    },
  });

  controller.start('message-1');
  controller.finish('message-1');
  scheduled[0].callback();
  controller.start('message-2');
  controller.start('message-3');
  scheduled[1].callback();

  assert.equal(scheduled[0].cleared, true);
  assert.equal(scheduled[1].cleared, true);
  assert.deepEqual(timedOut, []);
});
