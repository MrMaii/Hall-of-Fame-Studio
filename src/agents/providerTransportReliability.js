const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

function positiveInteger(value, fallback) {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : fallback;
}

function timestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function isRetryableProviderResult(result = {}) {
  if (!result || result.ok || result.skipped) return false;
  const statusCode = Number(result.statusCode || result.status || 0);
  return !statusCode || statusCode === 408 || statusCode === 409 || statusCode === 425 || statusCode === 429 || statusCode >= 500;
}

function genericTransportFailure() {
  return {
    ok: false,
    error: 'provider transport request failed',
  };
}

export function createProviderTransportPolicy({
  maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  maxRetries = 0,
  retryBackoffMs = [],
  failureThreshold = DEFAULT_FAILURE_THRESHOLD,
  failureWindowMs = DEFAULT_FAILURE_WINDOW_MS,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const limit = positiveInteger(maxConcurrency, DEFAULT_MAX_CONCURRENCY);
  const configuredRetries = nonNegativeInteger(maxRetries);
  const configuredFailureThreshold = positiveInteger(failureThreshold, DEFAULT_FAILURE_THRESHOLD);
  const configuredFailureWindowMs = positiveInteger(failureWindowMs, DEFAULT_FAILURE_WINDOW_MS);
  const configuredCooldownMs = positiveInteger(cooldownMs, DEFAULT_COOLDOWN_MS);
  const backoff = Array.isArray(retryBackoffMs) ? retryBackoffMs : [];
  let active = 0;
  let halfOpenProbeActive = false;
  let failures = [];
  const queue = [];

  const currentTime = () => timestamp(now());
  const recentFailures = () => {
    const cutoff = currentTime() - configuredFailureWindowMs;
    failures = failures.filter((value) => value >= cutoff);
    return failures;
  };
  const circuit = () => {
    const rows = recentFailures();
    const lastFailureAtMs = rows.at(-1) || 0;
    const openUntilMs = rows.length >= configuredFailureThreshold ? lastFailureAtMs + configuredCooldownMs : 0;
    const nowMs = currentTime();
    const state = rows.length < configuredFailureThreshold
      ? 'closed'
      : openUntilMs > nowMs
        ? 'open'
        : 'half-open';
    return {
      state,
      failureCount: rows.length,
      failureThreshold: configuredFailureThreshold,
      failureWindowMs: configuredFailureWindowMs,
      cooldownMs: configuredCooldownMs,
      lastFailureAt: lastFailureAtMs ? new Date(lastFailureAtMs).toISOString() : null,
      openUntil: openUntilMs ? new Date(openUntilMs).toISOString() : null,
      probeActive: halfOpenProbeActive,
    };
  };
  const retryReceipt = (attemptCount) => ({
    schemaVersion: 'provider-transport-retry/v1',
    maxRetries: configuredRetries,
    attemptCount,
    retried: attemptCount > 1,
  });
  const receipt = (attemptCount) => ({
    schemaVersion: 'provider-transport-reliability/v1',
    retry: retryReceipt(attemptCount),
    circuit: circuit(),
  });

  const runNext = () => {
    if (active >= limit || !queue.length) return;
    const item = queue.shift();
    active += 1;
    item.run()
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1;
        runNext();
      });
  };
  const schedule = (run) => new Promise((resolve, reject) => {
    queue.push({ run, resolve, reject });
    runNext();
  });

  async function executeNow(run) {
    const before = circuit();
    if (before.state === 'open') {
      return {
        ok: false,
        skipped: true,
        reason: 'provider-transport-circuit-open',
        transportReliability: receipt(0),
      };
    }
    if (before.state === 'half-open' && halfOpenProbeActive) {
      return {
        ok: false,
        skipped: true,
        reason: 'provider-transport-circuit-half-open',
        transportReliability: receipt(0),
      };
    }

    const halfOpenProbe = before.state === 'half-open';
    if (halfOpenProbe) halfOpenProbeActive = true;
    let result = null;
    let attemptCount = 0;
    try {
      for (let attempt = 0; attempt <= configuredRetries; attempt += 1) {
        attemptCount = attempt + 1;
        try {
          result = await run({ attempt: attemptCount });
        } catch {
          result = genericTransportFailure();
        }
        if (!isRetryableProviderResult(result) || attempt === configuredRetries) break;
        const delay = Math.max(0, Math.min(Number(backoff[attempt] ?? backoff.at(-1) ?? 0) || 0, 5_000));
        if (delay) await sleep(delay);
      }
      if (result?.ok) {
        failures = [];
      } else if (isRetryableProviderResult(result)) {
        failures = [...recentFailures(), currentTime()];
      }
      return {
        ...(result || genericTransportFailure()),
        transportReliability: receipt(attemptCount),
      };
    } finally {
      if (halfOpenProbe) halfOpenProbeActive = false;
    }
  }

  return {
    execute(run) {
      if (typeof run !== 'function') throw new TypeError('provider transport run must be a function');
      return schedule(() => executeNow(run));
    },
    status() {
      return {
        schemaVersion: 'provider-transport-reliability/v1',
        maxConcurrency: limit,
        activeRequests: active,
        queuedRequests: queue.length,
        retry: retryReceipt(0),
        circuit: circuit(),
      };
    },
  };
}

export function createRequestAbortSignal({ signal, timeoutMs = 0 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = Number(timeoutMs) > 0
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Number(timeoutMs))
    : null;
  const abortFromInput = () => controller.abort();
  if (signal) {
    if (signal.aborted) abortFromInput();
    else signal.addEventListener('abort', abortFromInput, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose() {
      if (timeout) clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', abortFromInput);
    },
  };
}
