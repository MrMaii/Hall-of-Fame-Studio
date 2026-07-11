import { redactSensitiveText, redactUrl } from './secretRedaction.js';
import { parseBoolean, safeJsonParse as parseJson } from './sharedUtils.js';
import { createProviderTransportPolicy, createRequestAbortSignal } from './providerTransportReliability.js';
import { evaluateLocalNetworkEndpoint } from './localNetworkPolicy.js';
import { createHash } from 'node:crypto';

const DEFAULT_SEARCH_PROVIDER = 'none';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CONCURRENCY = 2;

function cleanBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeProvider(value = DEFAULT_SEARCH_PROVIDER) {
  const normalized = String(value || DEFAULT_SEARCH_PROVIDER).toLowerCase();
  if (['deterministic', 'local', 'fixture'].includes(normalized)) return 'deterministic';
  if (['http', 'http-json', 'custom'].includes(normalized)) return 'http-json';
  return 'none';
}

function validIdempotencyKey(value) {
  return value === undefined || value === null || value === '' || /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(String(value));
}

function idempotencyMetadata(key, outcome, extra = {}) {
  return key ? {
    schemaVersion: 'provider-idempotency-transport/v1',
    keyHash: createHash('sha256').update(String(key)).digest('hex'),
    propagated: true,
    endpointHonoringAttested: false,
    outcome,
    safeToRetryAutomatically: outcome === 'completed' || outcome === 'definitive-failure',
    ...extra,
  } : null;
}

function normalizeConfidence(value = 'medium') {
  const normalized = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high', 'unknown'].includes(normalized) ? normalized : 'medium';
}

function normalizeSources(items = [], now = new Date().toISOString()) {
  return (Array.isArray(items) ? items : [])
    .slice(0, 24)
    .map((item, index) => {
      const source = item && typeof item === 'object' ? item : { title: String(item || '') };
      const title = String(source.title || source.name || source.url || `Search result ${index + 1}`).trim();
      if (!title) return null;
      return {
        id: source.id || `provider_source_${index + 1}`,
        title: redactSensitiveText(title),
        kind: source.kind || source.type || 'web-source',
        url: source.url || source.href ? redactUrl(source.url || source.href) : null,
        summary: redactSensitiveText(source.summary || source.snippet || source.content || source.note || ''),
        confidence: normalizeConfidence(source.confidence || source.quality || 'medium'),
        capturedAt: source.capturedAt || source.searchedAt || now,
      };
    })
    .filter(Boolean);
}

function extractHttpSources(data = {}, now = new Date().toISOString()) {
  const candidates = data.sources || data.results || data.items || data.web?.results || [];
  return normalizeSources(candidates, now);
}

function deterministicSources({ query = '', purpose = '', maxResults = DEFAULT_MAX_RESULTS, now = new Date().toISOString() } = {}) {
  const base = [
    {
      title: 'Project transcript and kickoff evidence',
      kind: 'project-proof',
      summary: `Internal proof for "${query}" from kickoff transcript, role negotiation, and team receipts.`,
      confidence: 'high',
    },
    {
      title: 'Manager flow graph proof map',
      kind: 'runtime-proof',
      summary: 'Flow graph nodes expose chat, timeline, event, task, and artifact routes for manager inspection.',
      confidence: 'high',
    },
    {
      title: 'Task evidence and review trail',
      kind: 'backend-route',
      summary: purpose || 'Task evidence aggregates sources, submissions, review records, and final deliverable proof.',
      confidence: 'medium',
    },
  ];
  return normalizeSources(base.slice(0, Math.max(1, Number(maxResults) || DEFAULT_MAX_RESULTS)), now);
}

export function createSearchProvider({
  provider = DEFAULT_SEARCH_PROVIDER,
  apiKey = '',
  apiKeySource = 'direct-config',
  secretVaultStatus = null,
  endpoint = '',
  endpointSource = 'direct-config',
  enabled = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResults = DEFAULT_MAX_RESULTS,
  maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  transportMaxRetries = 0,
  transportRetryBackoffMs = [],
  transportCircuitFailureThreshold = 3,
  transportCircuitFailureWindowMs = 15 * 60 * 1000,
  transportCircuitCooldownMs = 5 * 60 * 1000,
  requestTemplate = null,
  fetchImpl = globalThis.fetch,
  localOnly = false,
} = {}) {
  let currentProvider = normalizeProvider(provider);
  let currentEndpoint = cleanBaseUrl(endpoint);
  let currentEndpointSource = currentEndpoint ? endpointSource || 'direct-config' : 'missing';
  let currentApiKey = apiKey || '';
  let currentApiKeySource = apiKeySource || 'direct-config';
  let runtimeEnabled = Boolean(enabled);
  let runtimeEnabledSource = runtimeEnabled ? 'startup-config' : 'disabled';
  const isConfigured = () => currentProvider === 'deterministic'
    || Boolean(currentEndpoint && (currentApiKey || currentProvider === 'http-json'));
  const endpointPolicy = () => currentProvider === 'deterministic' || !localOnly
    ? { allowed: true, status: currentProvider === 'deterministic' ? 'network-not-required' : 'remote-endpoints-allowed', reason: 'No remote request is required or remote endpoints are allowed.' }
    : evaluateLocalNetworkEndpoint(currentEndpoint);
  const providerEnabled = () => Boolean(runtimeEnabled && isConfigured() && endpointPolicy().allowed && (currentProvider === 'deterministic' || typeof fetchImpl === 'function'));
  const transport = createProviderTransportPolicy({
    maxConcurrency,
    maxRetries: transportMaxRetries,
    retryBackoffMs: transportRetryBackoffMs,
    failureThreshold: transportCircuitFailureThreshold,
    failureWindowMs: transportCircuitFailureWindowMs,
    cooldownMs: transportCircuitCooldownMs,
  });

  const status = () => ({
    provider: currentProvider,
    enabled: providerEnabled(),
    runtimeEnabled,
    enabledSource: runtimeEnabledSource,
    configured: isConfigured(),
    endpointPolicy: {
      mode: localOnly ? 'local-only' : 'allow-remote',
      status: endpointPolicy().status,
      reason: endpointPolicy().reason,
    },
    endpoint: redactUrl(currentEndpoint),
    hasEndpoint: Boolean(currentEndpoint),
    endpointSource: currentEndpoint ? currentEndpointSource : 'missing',
    hasApiKey: Boolean(currentApiKey),
    apiKeySource: currentApiKey ? currentApiKeySource : (currentProvider === 'deterministic' ? 'not-required' : 'missing'),
    secretVault: secretVaultStatus
      ? {
        provider: secretVaultStatus.provider || 'unknown',
        enabled: Boolean(secretVaultStatus.enabled),
        configured: Boolean(secretVaultStatus.configured),
        ready: Boolean(secretVaultStatus.ready),
        keyId: secretVaultStatus.keyId || null,
      }
      : null,
    hasFetch: typeof fetchImpl === 'function',
    maxResults: Number(maxResults) || DEFAULT_MAX_RESULTS,
    maxConcurrency: transport.status().maxConcurrency,
    activeRequests: transport.status().activeRequests,
    queuedRequests: transport.status().queuedRequests,
    transportReliability: transport.status(),
    idempotencyTransport: {
      header: 'idempotency-key',
      traceHeader: 'x-hofs-trace-id',
      endpointAttestationRequired: true,
    },
  });

  async function performSearch({
    query = '',
    purpose = '',
    now = new Date().toISOString(),
    maxResults: inputMaxResults,
    signal,
    extraBody = {},
    idempotencyKey,
    traceId,
  } = {}) {
    if (!validIdempotencyKey(idempotencyKey)) {
      return { ok: false, skipped: true, reason: 'invalid-idempotency-key', provider: currentProvider };
    }
    const resultLimit = Math.max(1, Number(inputMaxResults || maxResults) || DEFAULT_MAX_RESULTS);
    if (!providerEnabled()) {
      const policy = endpointPolicy();
      return {
        ok: false,
        skipped: true,
        reason: !policy.allowed ? 'remote-endpoint-blocked' : isConfigured() ? 'search-provider-disabled' : 'search-provider-not-configured',
        provider: currentProvider,
        status: status(),
      };
    }

    if (currentProvider === 'deterministic') {
      const sources = deterministicSources({ query, purpose, maxResults: resultLimit, now });
      return {
        ok: true,
        provider: currentProvider,
        searchMode: 'deterministic-provider',
        query,
        sources,
        findings: [
          `Deterministic provider found ${sources.length} reusable project evidence source(s).`,
          'Use a real BYOK search provider in production for external web evidence.',
        ],
        confidence: sources.some((source) => source.confidence === 'high') ? 'high' : 'medium',
        status: status(),
        idempotency: idempotencyMetadata(idempotencyKey, 'completed', { propagated: false }),
      };
    }

    const requestAbort = createRequestAbortSignal({
      signal,
      timeoutMs: Number(timeoutMs) || DEFAULT_TIMEOUT_MS,
    });
    try {
      const template = requestTemplate && typeof requestTemplate === 'object' ? requestTemplate : {};
      const method = String(template.method || 'POST').toUpperCase();
      const headers = {
        'content-type': 'application/json',
        ...(currentApiKey ? { authorization: `Bearer ${currentApiKey}` } : {}),
        ...(idempotencyKey ? { 'idempotency-key': String(idempotencyKey) } : {}),
        ...(traceId ? { 'x-hofs-trace-id': String(traceId) } : {}),
        ...(template.headers || {}),
      };
      const body = {
        query,
        purpose,
        maxResults: resultLimit,
        ...extraBody,
        ...(template.body || {}),
      };
      const url = method === 'GET'
        ? `${currentEndpoint}${currentEndpoint.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}&maxResults=${encodeURIComponent(resultLimit)}`
        : currentEndpoint;
      const response = await fetchImpl(url, {
        method,
        headers,
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
        signal: requestAbort.signal,
      });
      const raw = await response.text();
      const data = parseJson(raw, {});
      if (!response.ok) {
        return {
          ok: false,
          provider: currentProvider,
          statusCode: response.status,
          error: redactSensitiveText(data?.error?.message || data?.message || raw.slice(0, 400)),
          status: status(),
          idempotency: idempotencyMetadata(idempotencyKey, 'definitive-failure'),
        };
      }
      const sources = extractHttpSources(data, now).slice(0, resultLimit);
      return {
        ok: true,
        provider: currentProvider,
        searchMode: 'http-json-provider',
        query,
        sources,
        findings: (data.findings || data.answer ? [data.answer].filter(Boolean) : [])
          .concat(data.findings || [])
          .map((item) => redactSensitiveText(String(item || '').trim()))
          .filter(Boolean),
        confidence: normalizeConfidence(data.confidence || (sources.length ? 'medium' : 'unknown')),
        responseId: data.id || data.responseId || null,
        status: status(),
        idempotency: idempotencyMetadata(idempotencyKey, 'completed', { providerResponseId: data.id || data.responseId || null }),
      };
    } catch (error) {
      return {
        ok: false,
        provider: currentProvider,
        error: requestAbort.timedOut()
          ? 'search request timed out'
          : error.name === 'AbortError'
            ? 'search request aborted'
            : redactSensitiveText(error.message || String(error)),
        status: status(),
        idempotency: idempotencyMetadata(idempotencyKey, 'ambiguous', { safeToRetryAutomatically: false }),
      };
    } finally {
      requestAbort.dispose();
    }
  }

  return {
    get provider() {
      return currentProvider;
    },
    get enabled() {
      return providerEnabled();
    },
    get configured() {
      return isConfigured();
    },
    setApiKey(nextApiKey = '', source = 'runtime-secret-vault') {
      currentApiKey = String(nextApiKey || '');
      currentApiKeySource = source || currentApiKeySource;
      if (currentApiKey) {
        runtimeEnabled = true;
        runtimeEnabledSource = source || runtimeEnabledSource;
      }
      return status();
    },
    setEndpoint(nextEndpoint = '', source = 'runtime-secret-vault', nextProvider = 'http-json') {
      const cleanEndpoint = cleanBaseUrl(nextEndpoint);
      currentEndpoint = cleanEndpoint;
      currentEndpointSource = cleanEndpoint ? source || currentEndpointSource : 'missing';
      if (cleanEndpoint) {
        const normalizedProvider = normalizeProvider(nextProvider || currentProvider || 'http-json');
        currentProvider = normalizedProvider === 'none' ? 'http-json' : normalizedProvider;
        runtimeEnabled = true;
        runtimeEnabledSource = source || runtimeEnabledSource;
      }
      return status();
    },
    status,
    search(input = {}) {
      return transport.execute(() => performSearch(input));
    },
    async test(query = 'product team acceptance evidence') {
      return this.search({ query, purpose: 'provider health check', maxResults: Math.min(3, Number(maxResults) || DEFAULT_MAX_RESULTS) });
    },
  };
}

export function createSearchProviderFromEnv(env = globalThis.process?.env || {}, options = {}) {
  const endpoint = options.endpoint || env.SEARCH_ENDPOINT || env.SEARCH_PROVIDER_ENDPOINT || '';
  const provider = options.provider || env.SEARCH_PROVIDER || (endpoint ? 'http-json' : DEFAULT_SEARCH_PROVIDER);
  return createSearchProvider({
    provider,
    apiKey: options.apiKey || env.SEARCH_API_KEY || env.SEARCH_PROVIDER_API_KEY || '',
    apiKeySource: options.apiKeySource || (options.apiKey ? 'local-secret-vault' : (options.secretVaultStatus?.ready ? 'local-secret-vault' : 'environment')),
    secretVaultStatus: options.secretVaultStatus || null,
    endpoint,
    endpointSource: options.endpointSource || (options.endpoint ? 'local-secret-vault' : (endpoint ? 'environment' : 'missing')),
    enabled: parseBoolean(env.SEARCH_PROVIDER_ENABLED, Boolean(options.apiKey || endpoint || normalizeProvider(provider) === 'deterministic')),
    timeoutMs: Number(env.SEARCH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxResults: Number(env.SEARCH_MAX_RESULTS || DEFAULT_MAX_RESULTS),
    maxConcurrency: Number(env.SEARCH_MAX_CONCURRENCY || DEFAULT_MAX_CONCURRENCY),
    transportMaxRetries: options.transportMaxRetries ?? Number(env.SEARCH_TRANSPORT_MAX_RETRIES || 0),
    transportRetryBackoffMs: options.transportRetryBackoffMs || String(env.SEARCH_TRANSPORT_RETRY_BACKOFF_MS || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite),
    transportCircuitFailureThreshold: options.transportCircuitFailureThreshold ?? Number(env.SEARCH_TRANSPORT_CIRCUIT_FAILURE_THRESHOLD || 3),
    transportCircuitFailureWindowMs: options.transportCircuitFailureWindowMs ?? Number(env.SEARCH_TRANSPORT_CIRCUIT_FAILURE_WINDOW_MS || 15 * 60 * 1000),
    transportCircuitCooldownMs: options.transportCircuitCooldownMs ?? Number(env.SEARCH_TRANSPORT_CIRCUIT_COOLDOWN_MS || 5 * 60 * 1000),
    requestTemplate: parseJson(env.SEARCH_REQUEST_TEMPLATE || '{}', {}) || {},
    localOnly: options.localOnly ?? parseBoolean(env.SEARCH_LOCAL_ONLY || env.AGENT_LOCAL_ONLY, false),
  });
}

export {
  DEFAULT_SEARCH_PROVIDER,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESULTS,
};
