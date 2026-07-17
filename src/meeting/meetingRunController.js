export const DEFAULT_MEETING_RUN_TIMEOUT_MS = 25_000;

export function createMeetingRunController({
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  onTimeout = () => {},
} = {}) {
  let active = null;

  const clearActive = () => {
    if (active?.timer) clearTimer(active.timer);
    active = null;
  };

  return {
    start(messageId, timeoutMs = DEFAULT_MEETING_RUN_TIMEOUT_MS) {
      clearActive();
      if (!messageId) return null;
      const run = { messageId, timer: null };
      run.timer = setTimer(() => {
        if (active !== run) return;
        active = null;
        onTimeout(messageId);
      }, timeoutMs);
      active = run;
      return messageId;
    },

    finish(messageId) {
      if (!active || (messageId && active.messageId !== messageId)) return false;
      clearActive();
      return true;
    },

    cancel() {
      clearActive();
    },

    activeMessageId() {
      return active?.messageId || null;
    },
  };
}
