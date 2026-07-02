import { redactSensitiveText, redactUrl } from './secretRedaction.js';

const DEFAULT_SEARCH_PROVIDER = 'none';
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_MAX_CONCURRENCY = 2;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cleanBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeProvider(value = DEFAULT_SEARCH_PROVIDER) {
  const normalized = String(value || DEFAULT_SEARCH_PROVIDER).toLowerCase();
  if (['deterministic', 'local', 'fixture'].includes(normalized)) return 'deterministic';
  if (['http', 'http-json', 'custom'].includes(normalized)) return 'http-json';
  return 'none';
}

function normalizeConfidence(value = 'medium') {
  const normalized = String(value || 'medium').toLowerCase();
  return ['low', 'medium', 'high', 'unknown'].includes(normalized) ? normalized : 'medium';
}

function createLimiter(maxConcurrency = DEFAULT_MAX_CONCURRENCY) {
  const limit = Math.max(1, Number(maxConcurrency) || DEFAULT_MAX_CONCURRENCY);
  let active = 0;
  const queue = [];
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
  return {
    limit,
    activeCount: () => active,
    pendingCount: () => queue.length,
    schedule(run) {
      return new Promise((resolve, reject) => {
        queue.push({ run, resolve, reject });
        runNext();
      });
    },
  };
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
  requestTemplate = null,
  fetchImpl = globalThis.fetch,
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
  const providerEnabled = () => Boolean(runtimeEnabled && isConfigured() && (currentProvider === 'deterministic' || typeof fetchImpl === 'function'));
  const limiter = createLimiter(maxConcurrency);

  const status = () => ({
    provider: currentProvider,
    enabled: providerEnabled(),
    runtimeEnabled,
    enabledSource: runtimeEnabledSource,
    configured: isConfigured(),
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
    maxConcurrency: limiter.limit,
    activeRequests: limiter.activeCount(),
    queuedRequests: limiter.pendingCount(),
  });

  async function performSearch({
    query = '',
    purpose = '',
    now = new Date().toISOString(),
    maxResults: inputMaxResults,
    signal,
    extraBody = {},
  } = {}) {
    const resultLimit = Math.max(1, Number(inputMaxResults || maxResults) || DEFAULT_MAX_RESULTS);
    if (!providerEnabled()) {
      return {
        ok: false,
        skipped: true,
        reason: isConfigured() ? 'search-provider-disabled' : 'search-provider-not-configured',
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
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(timeoutMs) || DEFAULT_TIMEOUT_MS);
    const linkedSignal = signal || controller.signal;
    try {
      const template = requestTemplate && typeof requestTemplate === 'object' ? requestTemplate : {};
      const method = String(template.method || 'POST').toUpperCase();
      const headers = {
        'content-type': 'application/json',
        ...(currentApiKey ? { authorization: `Bearer ${currentApiKey}` } : {}),
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
        signal: linkedSignal,
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
      };
    } catch (error) {
      return {
        ok: false,
        provider: currentProvider,
        error: error.name === 'AbortError' ? 'search request timed out' : redactSensitiveText(error.message || String(error)),
        status: status(),
      };
    } finally {
      clearTimeout(timeout);
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
      return limiter.schedule(() => performSearch(input));
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
    requestTemplate: parseJson(env.SEARCH_REQUEST_TEMPLATE || '{}', {}) || {},
  });
}

export {
  DEFAULT_SEARCH_PROVIDER,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESULTS,
};
