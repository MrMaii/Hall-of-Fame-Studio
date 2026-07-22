const sameProject = (left, right) => (
  Boolean(left && right)
  && String(left).toLowerCase() === String(right).toLowerCase()
);

export function createProjectDashboardCoreSyncState() {
  return {
    projectId: null,
    status: 'idle',
    error: null,
    attemptId: 0,
    retryAt: null,
  };
}

export function shouldStartProjectDashboardCoreSync(state, projectId, now = Date.now()) {
  if (!projectId) return false;
  if (!sameProject(state?.projectId, projectId)) return true;
  if (state?.status === 'idle') return true;
  return state?.status === 'error' && Number.isFinite(state?.retryAt) && state.retryAt <= now;
}

export function beginProjectDashboardCoreSync(state, projectId) {
  return {
    projectId,
    status: 'loading',
    error: null,
    attemptId: Number(state?.attemptId || 0) + 1,
    retryAt: null,
  };
}

export function completeProjectDashboardCoreSync(state, {
  projectId,
  attemptId,
  complete,
  error = 'Core project read models did not finish syncing.',
  now = Date.now(),
  retryDelayMs = 3_000,
} = {}) {
  if (!sameProject(state?.projectId, projectId) || state?.attemptId !== attemptId) return state;
  return {
    ...state,
    status: complete ? 'ready' : 'error',
    error: complete ? null : error,
    retryAt: complete ? null : now + Math.max(0, Number(retryDelayMs) || 0),
  };
}

export function failProjectDashboardCoreSync(state, { projectId, attemptId, error, now, retryDelayMs } = {}) {
  return completeProjectDashboardCoreSync(state, {
    projectId,
    attemptId,
    complete: false,
    error,
    now,
    retryDelayMs,
  });
}

export function resetProjectDashboardCoreSync(state, projectId) {
  return {
    projectId,
    status: 'idle',
    error: null,
    attemptId: Number(state?.attemptId || 0),
    retryAt: null,
  };
}

export function coreSyncStatusForView({ required, verified, state, projectId } = {}) {
  if (!required || verified) return null;
  if (sameProject(state?.projectId, projectId) && state?.status === 'error') return 'error';
  return 'loading';
}
