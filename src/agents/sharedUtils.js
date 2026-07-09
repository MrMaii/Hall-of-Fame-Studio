// Shared low-level helpers (TD-006). Semantics preserved exactly from the
// per-file copies these replace (secretVault / modelProvider / searchProvider).
// NOTE: workerQueueAdapter and managedPersistenceAdapter keep their own
// parseBoolean variant on purpose - it trims whitespace before matching,
// which this one (intentionally) does not.

export function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}
