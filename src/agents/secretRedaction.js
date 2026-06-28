const REDACTED = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|authorization|bearer|access[_-]?token|refresh[_-]?token|token|secret|password|credential|private[_-]?key)/i;
const URL_FIELD_PATTERN = /(url|endpoint|baseurl|base_url|href)/i;

function isSensitiveKey(key = '') {
  return SENSITIVE_KEY_PATTERN.test(String(key || ''));
}

export function redactSensitiveText(value = '') {
  return String(value || '')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/ig, `$1${REDACTED}`)
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|authorization|credential)\s*[:=]\s*)(["']?)[^"',\s&}]+/ig, `$1$2${REDACTED}`)
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, REDACTED);
}

export function redactUrl(value = '') {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    url.username = '';
    url.password = '';
    [...url.searchParams.keys()].forEach((key) => {
      if (isSensitiveKey(key)) url.searchParams.set(key, REDACTED);
    });
    return redactSensitiveText(url.toString());
  } catch {
    return redactSensitiveText(value);
  }
}

export function redactSensitiveObject(value, key = '') {
  if (value === null || value === undefined) return value;
  if (isSensitiveKey(key)) return value ? REDACTED : value;
  if (typeof value === 'string') {
    return URL_FIELD_PATTERN.test(String(key || ''))
      ? redactUrl(value)
      : redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveObject(item, key));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactSensitiveObject(childValue, childKey),
      ]),
    );
  }
  return value;
}

export function containsSensitiveText(value = '') {
  return SENSITIVE_KEY_PATTERN.test(String(value || ''))
    || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(String(value || ''));
}

export { REDACTED };
