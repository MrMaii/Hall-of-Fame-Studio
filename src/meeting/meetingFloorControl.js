export const meetingDraftClaimsFloor = (value = '') => Boolean(String(value).trim());

export function createMeetingTurnQueue({
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  const turns = new Map();
  let userActive = false;

  const arm = (turn, delayMs, nextPhase) => {
    turn.remainingMs = Math.max(0, Number(delayMs) || 0);
    turn.nextPhase = nextPhase;
    turn.dueAt = now() + turn.remainingMs;
    turn.timer = null;
    if (userActive) return;

    const timer = setTimer(() => {
      if (turns.get(turn.intentId) !== turn || turn.timer !== timer) return;
      turn.timer = null;
      turn.remainingMs = 0;
      if (turn.nextPhase === 'start') {
        turn.phase = 'speaking';
        turn.status = 'speaking';
        turn.onStart();
        arm(turn, turn.speakDurationMs, 'yield');
        return;
      }
      turn.phase = 'yielded';
      turn.status = 'yielded';
      turn.onYield();
      turns.delete(turn.intentId);
    }, turn.remainingMs);
    turn.timer = timer;
  };

  return {
    schedule({
      intentId,
      delayMs = 0,
      speakDurationMs = 0,
      onStart = () => {},
      onPause = () => {},
      onResume = () => {},
      onYield = () => {},
    } = {}) {
      if (!intentId) return null;
      const previous = turns.get(intentId);
      if (previous?.timer) clearTimer(previous.timer);
      const turn = {
        intentId,
        phase: 'queued',
        status: 'queued',
        timer: null,
        dueAt: now(),
        remainingMs: Math.max(0, Number(delayMs) || 0),
        nextPhase: 'start',
        speakDurationMs: Math.max(0, Number(speakDurationMs) || 0),
        onStart,
        onPause,
        onResume,
        onYield,
      };
      turns.set(intentId, turn);
      arm(turn, turn.remainingMs, 'start');
      return intentId;
    },

    setUserActive(active) {
      const nextActive = Boolean(active);
      if (nextActive === userActive) return;
      userActive = nextActive;
      turns.forEach((turn) => {
        if (nextActive) {
          if (turn.timer) {
            turn.remainingMs = Math.max(0, turn.dueAt - now());
            clearTimer(turn.timer);
            turn.timer = null;
          }
          if (turn.phase === 'speaking') {
            turn.status = 'paused';
            turn.onPause();
          }
          return;
        }
        if (turn.phase === 'speaking') {
          turn.status = 'speaking';
          turn.onResume();
        }
        arm(turn, turn.remainingMs, turn.nextPhase);
      });
    },

    cancelAll() {
      turns.forEach((turn) => {
        if (turn.timer) clearTimer(turn.timer);
      });
      turns.clear();
    },

    status(intentId) {
      return turns.get(intentId)?.status || null;
    },
  };
}
