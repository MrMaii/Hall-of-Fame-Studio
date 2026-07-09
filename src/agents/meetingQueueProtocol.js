export const MEETING_TURN_GRACE_PERIOD_MS = 5000;
export const MEETING_TURN_STAGGER_MS = 1450;
export const MEETING_TURN_SPEAK_DURATION_MS = 1200;

export function meetingTurnDelayMs(index = 0, requestedDelayMs = null) {
  const safeIndex = Math.max(0, Number(index) || 0);
  const protocolDelay = MEETING_TURN_GRACE_PERIOD_MS + safeIndex * MEETING_TURN_STAGGER_MS;
  const requested = Number(requestedDelayMs);
  return Number.isFinite(requested) ? Math.max(protocolDelay, requested) : protocolDelay;
}
