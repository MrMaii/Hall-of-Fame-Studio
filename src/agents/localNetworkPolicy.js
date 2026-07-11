function normalizeHostname(hostname = '') {
  return String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isPrivateIpv4(hostname = '') {
  const parts = hostname.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [first, second] = parts;
  return first === 10
    || first === 127
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 169 && second === 254);
}

function isPrivateIpv6(hostname = '') {
  const normalized = normalizeHostname(hostname);
  return normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('::ffff:127.');
}

export function evaluateLocalNetworkEndpoint(value = '') {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    return { allowed: false, status: 'invalid-endpoint', reason: 'A valid HTTP(S) endpoint is required.' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { allowed: false, status: 'unsupported-protocol', reason: 'Only HTTP(S) local endpoints are supported.' };
  }
  const hostname = normalizeHostname(url.hostname);
  const local = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || isPrivateIpv4(hostname)
    || isPrivateIpv6(hostname);
  return local
    ? { allowed: true, status: 'local-endpoint', reason: 'Endpoint resolves to a local or private-network host.' }
    : { allowed: false, status: 'blocked-remote-endpoint', reason: 'Remote endpoints are disabled in local-only mode.' };
}

export function isLocalNetworkEndpoint(value = '') {
  return evaluateLocalNetworkEndpoint(value).allowed;
}
