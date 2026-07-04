import { redactSensitiveText, redactUrl } from './secretRedaction.js';

const DEFAULT_PROVIDER = 'openai-compatible';
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_TOKENS = 700;
const DEFAULT_MAX_CONCURRENCY = 2;
const MODEL_PROVIDER_ADAPTERS = Object.freeze({
  'openai-compatible': {
    provider: 'openai-compatible',
    apiStyle: 'openai-chat-completions',
    defaultBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'OPENAI_API_KEY'],
  },
  openai: {
    provider: 'openai',
    apiStyle: 'openai-chat-completions',
    defaultBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'OPENAI_API_KEY'],
  },
  anthropic: {
    provider: 'anthropic',
    apiStyle: 'anthropic-messages',
    defaultBaseUrl: DEFAULT_ANTHROPIC_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'ANTHROPIC_API_KEY'],
  },
  gemini: {
    provider: 'gemini',
    apiStyle: 'gemini-generate-content',
    defaultBaseUrl: DEFAULT_GEMINI_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'GEMINI_API_KEY'],
  },
});

function cleanBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function parseList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractJsonObject(value = '') {
  const direct = safeJsonParse(value);
  if (direct && typeof direct === 'object') return direct;

  const fenced = String(value).match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = safeJsonParse(fenced[1].trim());
    if (parsed && typeof parsed === 'object') return parsed;
  }

  const start = String(value).indexOf('{');
  const end = String(value).lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = safeJsonParse(String(value).slice(start, end + 1));
    if (parsed && typeof parsed === 'object') return parsed;
  }

  return null;
}

function modelMatches(model = '', pattern = '') {
  const normalizedModel = String(model || '').toLowerCase();
  const normalizedPattern = String(pattern || '').toLowerCase();
  if (!normalizedPattern) return false;
  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${escaped}$`).test(normalizedModel);
  }
  return normalizedModel === normalizedPattern || normalizedModel.includes(normalizedPattern);
}

function normalizeProvider(provider = DEFAULT_PROVIDER) {
  const value = String(provider || DEFAULT_PROVIDER).toLowerCase();
  if (['anthropic', 'claude'].includes(value)) return 'anthropic';
  if (['google', 'gemini'].includes(value)) return 'gemini';
  if (value === 'openai') return 'openai';
  return 'openai-compatible';
}

function defaultBaseUrlFor(provider) {
  if (provider === 'anthropic') return DEFAULT_ANTHROPIC_BASE_URL;
  if (provider === 'gemini') return DEFAULT_GEMINI_BASE_URL;
  return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

function adapterConfigFor(provider) {
  return MODEL_PROVIDER_ADAPTERS[normalizeProvider(provider)] || MODEL_PROVIDER_ADAPTERS['openai-compatible'];
}

export function getModelProviderAdapterManifest() {
  return {
    schemaVersion: 'model-provider-adapter-manifest/v1',
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
    adapters: Object.values(MODEL_PROVIDER_ADAPTERS).map((adapter) => ({
      provider: adapter.provider,
      apiStyle: adapter.apiStyle,
      defaultBaseUrl: redactUrl(adapter.defaultBaseUrl),
      operations: [...adapter.operations],
      secretNames: [...adapter.secretNames],
    })),
    productionBlockers: [
      'managed KMS or Secret Manager',
      'centralized provider usage audit',
      'production retry and circuit-breaker policy',
      'calibrated model-output eval datasets',
      'centralized cost alerts and incident runbooks',
    ],
  };
}

function buildIntentMessages({
  project = {},
  command = '',
  input = {},
  resultMessages = [],
  now = new Date().toISOString(),
} = {}) {
  const team = (project.team || []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role || agent.title || 'Agent',
    isLeader: Boolean(agent.isLeader),
  }));
  const tasks = (project.tasks || []).slice(0, 8).map((task) => ({
    id: task.id,
    text: task.text,
    assignee: task.assignee,
    ownerId: task.ownerId,
    status: task.status,
  }));
  const messages = (resultMessages || []).slice(0, 8).map((message) => ({
    id: message.id,
    author: message.author,
    type: message.type,
    text: message.text,
    targets: message.targets || [],
  }));

  return [
    {
      role: 'system',
      content: [
        'You are the low-level intent engine for Hall of Fame Studio.',
        'Return compact JSON only.',
        'Focus on: agent intent, collaboration routing, meeting speech intent, next backend action, and proof to publish.',
        'Do not roleplay as a user. Do not add markdown.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        now,
        command,
        project: {
          id: project.id,
          name: project.name,
          objective: project.currentObjective || project.objective || project.summary || project.brief,
          status: project.status,
          language: project.language || 'en',
          progress: project.progress || 0,
        },
        team,
        tasks,
        input,
        resultMessages: messages,
        requiredShape: {
          intent: 'one sentence describing the model-level intent',
          publicSpeechIntent: 'what should be said publicly, or empty string',
          privatePlan: ['2-4 private execution steps'],
          collaborationTargets: ['agent ids or names to notify'],
          backendAction: 'next service action to run or observe',
          timelineProof: 'what proof should be published to the flow/timeline',
          risk: 'main risk or empty string',
        },
      }),
    },
  ];
}

function openAiCompatibleBody({ model, messages, temperature, maxTokens, json, jsonResponseFormat, extraBody, overrides }) {
  return {
    model: overrides.model || model,
    messages,
    temperature: overrides.temperature ?? temperature,
    max_tokens: overrides.maxTokens || maxTokens,
    stream: false,
    ...(json && jsonResponseFormat ? { response_format: { type: 'json_object' } } : {}),
    ...extraBody,
    ...(overrides.body || {}),
  };
}

function anthropicBody({ model, messages, temperature, maxTokens, extraBody, overrides }) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || ''),
    }));
  return {
    model: overrides.model || model,
    max_tokens: overrides.maxTokens || maxTokens,
    temperature: overrides.temperature ?? temperature,
    ...(system ? { system } : {}),
    messages: conversation,
    ...extraBody,
    ...(overrides.body || {}),
  };
}

function geminiBody({ messages, temperature, maxTokens, extraBody, overrides }) {
  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(message.content || '') }],
    }));
  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      temperature: overrides.temperature ?? temperature,
      maxOutputTokens: overrides.maxTokens || maxTokens,
      ...(overrides.generationConfig || {}),
    },
    ...extraBody,
    ...(overrides.body || {}),
  };
}

function extractContent(provider, data) {
  if (provider === 'anthropic') {
    return (data?.content || [])
      .map((part) => part?.text || '')
      .filter(Boolean)
      .join('\n');
  }
  if (provider === 'gemini') {
    return (data?.candidates?.[0]?.content?.parts || [])
      .map((part) => part?.text || '')
      .filter(Boolean)
      .join('\n');
  }
  return data?.choices?.[0]?.message?.content || '';
}

function extractUsage(provider, data) {
  if (provider === 'gemini') return data?.usageMetadata || null;
  return data?.usage || null;
}

function requestSpec({ provider, baseURL, apiKey, model, messages, temperature, maxTokens, json, jsonResponseFormat, extraBody, overrides }) {
  if (provider === 'anthropic') {
    return {
      url: `${baseURL}/messages`,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': overrides.anthropicVersion || '2023-06-01',
        'content-type': 'application/json',
      },
      body: anthropicBody({ model, messages, temperature, maxTokens, extraBody, overrides }),
    };
  }
  if (provider === 'gemini') {
    const resolvedModel = encodeURIComponent(overrides.model || model);
    return {
      url: `${baseURL}/models/${resolvedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers: { 'content-type': 'application/json' },
      body: geminiBody({ messages, temperature, maxTokens, extraBody, overrides }),
    };
  }
  return {
    url: `${baseURL}/chat/completions`,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: openAiCompatibleBody({ model, messages, temperature, maxTokens, json, jsonResponseFormat, extraBody, overrides }),
  };
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

export function createModelProvider({
  provider = DEFAULT_PROVIDER,
  apiKey,
  apiKeySource = 'direct-config',
  secretVaultStatus = null,
  baseURL,
  model = DEFAULT_MODEL,
  enabled = false,
  temperature = 0.2,
  maxTokens = DEFAULT_MAX_TOKENS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxConcurrency = DEFAULT_MAX_CONCURRENCY,
  jsonResponseFormat = false,
  blockedModels = [],
  extraBody = {},
  fetchImpl = globalThis.fetch,
} = {}) {
  const resolvedProvider = normalizeProvider(provider);
  const adapterConfig = adapterConfigFor(resolvedProvider);
  const resolvedModel = model || DEFAULT_MODEL;
  const resolvedBaseURL = cleanBaseUrl(baseURL || defaultBaseUrlFor(resolvedProvider));
  const blockedByPolicy = blockedModels.some((pattern) => modelMatches(resolvedModel, pattern));
  let currentApiKey = apiKey || '';
  let currentApiKeySource = apiKeySource || 'direct-config';
  let runtimeEnabled = Boolean(enabled);
  let runtimeEnabledSource = runtimeEnabled ? 'startup-config' : 'disabled';
  const configured = () => Boolean(currentApiKey);
  const providerEnabled = () => Boolean(runtimeEnabled && configured() && !blockedByPolicy && typeof fetchImpl === 'function');
  const limiter = createLimiter(maxConcurrency);

  async function performChatCompletion({ messages, json = false, signal, ...overrides } = {}) {
    if (!providerEnabled()) {
      return {
        ok: false,
        skipped: true,
        reason: blockedByPolicy ? 'model-blocked' : configured() ? 'provider-disabled' : 'missing-api-key',
        provider: resolvedProvider,
        model: resolvedModel,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(overrides.timeoutMs || timeoutMs));
    const linkedSignal = signal || controller.signal;
    try {
      const spec = requestSpec({
        provider: resolvedProvider,
        baseURL: resolvedBaseURL,
        apiKey: currentApiKey,
        model: resolvedModel,
        messages,
        temperature,
        maxTokens,
        json,
        jsonResponseFormat,
        extraBody,
        overrides,
      });
      const response = await fetchImpl(spec.url, {
        method: 'POST',
        headers: spec.headers,
        body: JSON.stringify(spec.body),
        signal: linkedSignal,
      });
      const raw = await response.text();
      const data = safeJsonParse(raw);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: redactSensitiveText(data?.error?.message || data?.message || raw.slice(0, 400)),
          provider: resolvedProvider,
          model: resolvedModel,
        };
      }
      const content = extractContent(resolvedProvider, data);
      return {
        ok: true,
        provider: resolvedProvider,
        model: data?.model || resolvedModel,
        content,
        json: json ? extractJsonObject(content) : null,
        usage: extractUsage(resolvedProvider, data),
        id: data?.id || data?.responseId || null,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.name === 'AbortError' ? 'model request timed out' : redactSensitiveText(error.message || String(error)),
        provider: resolvedProvider,
        model: resolvedModel,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    provider: resolvedProvider,
    get enabled() {
      return providerEnabled();
    },
    get configured() {
      return configured();
    },
    blockedByPolicy,
    model: resolvedModel,
    baseURL: redactUrl(resolvedBaseURL),
    setEnabled(nextEnabled = true, source = 'runtime-config') {
      runtimeEnabled = Boolean(nextEnabled);
      runtimeEnabledSource = source || runtimeEnabledSource;
      return this.status();
    },
    setApiKey(nextApiKey = '', source = 'runtime-secret-vault') {
      currentApiKey = String(nextApiKey || '');
      currentApiKeySource = source || currentApiKeySource;
      if (currentApiKey) {
        runtimeEnabled = true;
        runtimeEnabledSource = source || runtimeEnabledSource;
      }
      return this.status();
    },
    status() {
      return {
        provider: resolvedProvider,
        enabled: providerEnabled(),
        runtimeEnabled,
        enabledSource: runtimeEnabledSource,
        configured: configured(),
        blockedByPolicy,
        model: resolvedModel,
        baseURL: redactUrl(resolvedBaseURL),
        hasApiKey: Boolean(currentApiKey),
        apiKeySource: currentApiKey ? currentApiKeySource : 'missing',
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
        maxConcurrency: limiter.limit,
        activeRequests: limiter.activeCount(),
        queuedRequests: limiter.pendingCount(),
        adapterContract: {
          schemaVersion: 'model-provider-adapter/v1',
          provider: adapterConfig.provider,
          apiStyle: adapterConfig.apiStyle,
          operations: [...adapterConfig.operations],
          defaultBaseUrl: redactUrl(adapterConfig.defaultBaseUrl),
        },
      };
    },
    createChatCompletion(input = {}) {
      return limiter.schedule(() => performChatCompletion(input));
    },
    async createRuntimeIntent(input = {}) {
      const completion = await this.createChatCompletion({
        messages: buildIntentMessages(input),
        json: true,
      });
      return {
        ...completion,
        intent: completion.json || (completion.ok ? { intent: completion.content } : null),
      };
    },
    async test(prompt = 'Return JSON: {"ok": true, "message": "ready"}') {
      return this.createChatCompletion({
        messages: [
          { role: 'system', content: 'Return concise JSON only.' },
          { role: 'user', content: prompt },
        ],
        json: true,
        maxTokens: Math.max(512, Number(maxTokens) || DEFAULT_MAX_TOKENS),
      });
    },
  };
}

export function createModelProviderFromEnv(env = globalThis.process?.env || {}, options = {}) {
  const provider = normalizeProvider(env.MODEL_PROVIDER || env.AGENT_MODEL_PROVIDER || DEFAULT_PROVIDER);
  const providerPrefix = provider.toUpperCase().replace(/-/g, '_');
  const providerEnabledDefault = Boolean(options.apiKey);
  return createModelProvider({
    provider,
    apiKey: options.apiKey
      || env.MODEL_API_KEY
      || env[`${providerPrefix}_API_KEY`]
      || env.OPENAI_API_KEY
      || env.ANTHROPIC_API_KEY
      || env.GEMINI_API_KEY,
    apiKeySource: options.apiKeySource || (options.apiKey ? 'local-secret-vault' : (options.secretVaultStatus?.ready ? 'local-secret-vault' : 'environment')),
    secretVaultStatus: options.secretVaultStatus || null,
    baseURL: env.MODEL_BASE_URL || env[`${providerPrefix}_BASE_URL`] || defaultBaseUrlFor(provider),
    model: env.MODEL_NAME || env[`${providerPrefix}_MODEL`] || DEFAULT_MODEL,
    enabled: parseBoolean(env.MODEL_PROVIDER_ENABLED || env.AGENT_LLM_ENABLED, providerEnabledDefault),
    temperature: Number(env.MODEL_TEMPERATURE || 0.2),
    maxTokens: Number(env.MODEL_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    timeoutMs: Number(env.MODEL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxConcurrency: Number(env.MODEL_MAX_CONCURRENCY || DEFAULT_MAX_CONCURRENCY),
    jsonResponseFormat: parseBoolean(env.MODEL_JSON_RESPONSE_FORMAT, false),
    blockedModels: parseList(env.MODEL_BLOCKED_MODELS || env.AGENT_LLM_BLOCKED_MODELS || ''),
    extraBody: safeJsonParse(env.MODEL_EXTRA_BODY || '{}') || {},
  });
}

export {
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_GEMINI_BASE_URL,
};
