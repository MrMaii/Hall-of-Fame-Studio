const abortError = (message) => {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

const priorityRank = (priority) => (priority === 'user-visible' ? 0 : 1);

export function createProjectReadCoordinator({ maxConcurrent = 4 } = {}) {
  const state = {
    active: 0,
    sequence: 0,
    queue: [],
    inFlight: new Map(),
    jobsByKey: new Map(),
    running: new Set(),
  };

  const drain = () => {
    state.queue.sort((left, right) => (
      priorityRank(left.priority) - priorityRank(right.priority)
      || left.sequence - right.sequence
    ));
    while (state.active < maxConcurrent && state.queue.length) {
      const job = state.queue.shift();
      clearTimeout(job.queueTimer);
      if (job.deadlineAt <= Date.now()) {
        state.inFlight.delete(job.key);
        state.jobsByKey.delete(job.key);
        job.reject(abortError('Project read timed out while waiting in the queue.'));
        continue;
      }

      state.active += 1;
      state.running.add(job);
      const remainingMs = Math.max(1, job.deadlineAt - Date.now());
      const abortPromise = new Promise((resolve, reject) => {
        job.controller.signal.addEventListener('abort', () => {
          reject(abortError('Project read was canceled.'));
        }, { once: true });
      });
      const deadlineTimer = setTimeout(() => job.controller.abort(), remainingMs);
      Promise.race([
        Promise.resolve().then(() => job.run({ signal: job.controller.signal, timeoutMs: remainingMs })),
        abortPromise,
      ]).then(job.resolve, job.reject).finally(() => {
        clearTimeout(deadlineTimer);
        state.active -= 1;
        state.running.delete(job);
        state.inFlight.delete(job.key);
        state.jobsByKey.delete(job.key);
        drain();
      });
    }
  };

  const expireQueuedJob = (job) => {
    const index = state.queue.indexOf(job);
    if (index < 0) return;
    state.queue.splice(index, 1);
    state.inFlight.delete(job.key);
    state.jobsByKey.delete(job.key);
    job.controller.abort();
    job.reject(abortError('Project read timed out while waiting in the queue.'));
  };

  const armQueueTimer = (job) => {
    clearTimeout(job.queueTimer);
    job.queueTimer = setTimeout(() => expireQueuedJob(job), Math.max(1, job.deadlineAt - Date.now()));
  };

  const schedule = ({ key, priority = 'background', timeoutMs = 3000, run }) => {
    const boundedTimeoutMs = Math.max(1, Number(timeoutMs) || 1);
    const existing = state.inFlight.get(key);
    if (existing) {
      const existingJob = state.jobsByKey.get(key);
      if (existingJob && priority === 'user-visible') {
        existingJob.priority = 'user-visible';
        const promotedDeadlineAt = Date.now() + boundedTimeoutMs;
        if (promotedDeadlineAt > existingJob.deadlineAt) {
          existingJob.deadlineAt = promotedDeadlineAt;
          if (state.queue.includes(existingJob)) armQueueTimer(existingJob);
        }
      }
      return existing;
    }

    const controller = new AbortController();
    let resolveJob;
    let rejectJob;
    const promise = new Promise((resolve, reject) => {
      resolveJob = resolve;
      rejectJob = reject;
    });
    const job = {
      key,
      priority,
      sequence: state.sequence++,
      controller,
      deadlineAt: Date.now() + boundedTimeoutMs,
      run,
      resolve: resolveJob,
      reject: rejectJob,
      queueTimer: null,
    };
    state.queue.push(job);
    state.inFlight.set(key, promise);
    state.jobsByKey.set(key, job);
    armQueueTimer(job);
    drain();
    return promise;
  };

  const cancelWhere = (predicate, message) => {
    const canceledQueuedJobs = state.queue.filter(predicate);
    state.queue = state.queue.filter(job => !predicate(job));
    for (const job of canceledQueuedJobs) {
      clearTimeout(job.queueTimer);
      state.inFlight.delete(job.key);
      state.jobsByKey.delete(job.key);
      job.controller.abort();
      job.reject(abortError(message));
    }
    for (const job of state.running) {
      if (predicate(job)) job.controller.abort();
    }
  };

  const cancelBackground = () => cancelWhere(
    job => job.priority !== 'user-visible',
    'Background project read canceled for a user-visible operation.',
  );

  const cancelAll = () => cancelWhere(() => true, 'Project read canceled.');

  return {
    schedule,
    cancelBackground,
    cancelAll,
    snapshot: () => ({ active: state.active, queued: state.queue.length, running: state.running.size }),
  };
}
