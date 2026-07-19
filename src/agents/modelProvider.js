import { redactSensitiveText, redactUrl } from './secretRedaction.js';
import { parseBoolean, safeJsonParse } from './sharedUtils.js';
import { createProviderTransportPolicy, createRequestAbortSignal } from './providerTransportReliability.js';
import { evaluateLocalNetworkEndpoint } from './localNetworkPolicy.js';
import { createHash } from 'node:crypto';
import { modelOutputLanguageInstruction, modelOutputMatchesLanguage } from './modelLanguagePolicy.js';

const DEFAULT_PROVIDER = 'openai-compatible';
const DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL = 'http://127.0.0.1:11434/v1';
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL;
const DEFAULT_ANTHROPIC_BASE_URL = DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL;
const DEFAULT_GEMINI_BASE_URL = DEFAULT_LOCAL_OPENAI_COMPATIBLE_BASE_URL;
const DEFAULT_MODEL = 'llama3.2';
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
  deepseek: {
    provider: 'deepseek', apiStyle: 'openai-chat-completions', defaultBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'DEEPSEEK_API_KEY'],
  },
  stepfun: {
    provider: 'stepfun', apiStyle: 'openai-chat-completions', defaultBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'STEPFUN_API_KEY'],
  },
  qwen: {
    provider: 'qwen', apiStyle: 'openai-chat-completions', defaultBaseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
    operations: ['chat-completion', 'json-completion', 'runtime-intent', 'health-test'],
    secretNames: ['model.apiKey', 'MODEL_API_KEY', 'DASHSCOPE_API_KEY'],
  },
});

function cleanBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function parseList(value = '') {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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
  if (['step', 'stepfun'].includes(value)) return 'stepfun';
  if (['qwen', 'dashscope', 'alibaba'].includes(value)) return 'qwen';
  if (value === 'deepseek') return 'deepseek';
  if (value === 'openai') return 'openai';
  return 'openai-compatible';
}

function validIdempotencyKey(value) {
  return value === undefined || value === null || value === '' || /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(String(value));
}

function idempotencyHeaders(overrides = {}) {
  return {
    ...(overrides.idempotencyKey ? { 'idempotency-key': String(overrides.idempotencyKey) } : {}),
    ...(overrides.traceId ? { 'x-hofs-trace-id': String(overrides.traceId) } : {}),
  };
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

function defaultBaseUrlFor(provider) {
  return adapterConfigFor(provider).defaultBaseUrl;
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
        modelOutputLanguageInstruction(project.language || 'en'),
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
  const textFromPart = (part) => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') return '';
    if (typeof part.text === 'string') return part.text;
    if (typeof part.content === 'string') return part.content;
    if (typeof part.output_text === 'string') return part.output_text;
    return '';
  };
  if (provider === 'anthropic') {
    return (data?.content || [])
      .map(textFromPart)
      .filter(Boolean)
      .join('\n');
  }
  if (provider === 'gemini') {
    return (data?.candidates?.[0]?.content?.parts || [])
      .map(textFromPart)
      .filter(Boolean)
      .join('\n');
  }
  const choice = data?.choices?.[0] || {};
  const message = choice.message || {};
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map(textFromPart).filter(Boolean).join('\n');
  }
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) return message.reasoning_content;
  if (typeof choice.text === 'string') return choice.text;
  if (typeof data?.output_text === 'string') return data.output_text;
  if (Array.isArray(data?.output)) return data.output.map(textFromPart).filter(Boolean).join('\n');
  return '';
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
        ...idempotencyHeaders(overrides),
      },
      body: anthropicBody({ model, messages, temperature, maxTokens, extraBody, overrides }),
    };
  }
  if (provider === 'gemini') {
    const resolvedModel = encodeURIComponent(overrides.model || model);
    return {
      url: `${baseURL}/models/${resolvedModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers: { 'content-type': 'application/json', ...idempotencyHeaders(overrides) },
      body: geminiBody({ messages, temperature, maxTokens, extraBody, overrides }),
    };
  }
  return {
    url: `${baseURL}/chat/completions`,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...idempotencyHeaders(overrides),
    },
    body: openAiCompatibleBody({ model, messages, temperature, maxTokens, json, jsonResponseFormat, extraBody, overrides }),
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
  transportMaxRetries = 0,
  transportRetryBackoffMs = [],
  transportCircuitFailureThreshold = 3,
  transportCircuitFailureWindowMs = 15 * 60 * 1000,
  transportCircuitCooldownMs = 5 * 60 * 1000,
  jsonResponseFormat = false,
  blockedModels = [],
  extraBody = {},
  fetchImpl = globalThis.fetch,
  localOnly = false,
} = {}) {
  let currentProvider = normalizeProvider(provider);
  let currentModel = model || DEFAULT_MODEL;
  let currentBaseURL = cleanBaseUrl(baseURL || defaultBaseUrlFor(currentProvider));
  let currentApiKey = apiKey || '';
  let currentApiKeySource = apiKeySource || 'direct-config';
  let runtimeEnabled = Boolean(enabled);
  let runtimeEnabledSource = runtimeEnabled ? 'startup-config' : 'disabled';
  const configured = () => Boolean(currentApiKey);
  const blockedByPolicy = () => blockedModels.some((pattern) => modelMatches(currentModel, pattern));
  const endpointPolicy = () => localOnly
    ? evaluateLocalNetworkEndpoint(currentBaseURL)
    : { allowed: true, status: 'remote-endpoints-allowed', reason: 'Remote endpoint policy is not restricted.' };
  const providerEnabled = () => Boolean(runtimeEnabled && configured() && endpointPolicy().allowed && !blockedByPolicy() && typeof fetchImpl === 'function');
  const transport = createProviderTransportPolicy({
    maxConcurrency,
    maxRetries: transportMaxRetries,
    retryBackoffMs: transportRetryBackoffMs,
    failureThreshold: transportCircuitFailureThreshold,
    failureWindowMs: transportCircuitFailureWindowMs,
    cooldownMs: transportCircuitCooldownMs,
  });

  async function performChatCompletion({ messages, json = false, signal, ...overrides } = {}) {
    if (!validIdempotencyKey(overrides.idempotencyKey)) {
      return { ok: false, skipped: true, reason: 'invalid-idempotency-key', provider: currentProvider, model: currentModel };
    }
    if (!providerEnabled()) {
      const policy = endpointPolicy();
      return {
        ok: false,
        skipped: true,
        reason: !policy.allowed ? 'remote-base-url-blocked' : blockedByPolicy() ? 'model-blocked' : configured() ? 'provider-disabled' : 'missing-api-key',
        provider: currentProvider,
        model: currentModel,
      };
    }

    const requestAbort = createRequestAbortSignal({
      signal,
      timeoutMs: Number(overrides.timeoutMs || timeoutMs),
    });
    try {
      const spec = requestSpec({
        provider: currentProvider,
        baseURL: currentBaseURL,
        apiKey: currentApiKey,
        model: currentModel,
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
        signal: requestAbort.signal,
      });
      const raw = await response.text();
      const data = safeJsonParse(raw);
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: redactSensitiveText(data?.error?.message || data?.message || raw.slice(0, 400)),
          provider: currentProvider,
          model: currentModel,
          idempotency: idempotencyMetadata(overrides.idempotencyKey, 'definitive-failure'),
        };
      }
      const content = extractContent(currentProvider, data);
      const finishReason = data?.choices?.[0]?.finish_reason || data?.candidates?.[0]?.finishReason || null;
      if (!content.trim()) {
        if (
          finishReason === 'length'
          && overrides.emptyLengthRetryMessages
          && !overrides.__emptyLengthRetry
        ) {
          return performChatCompletion({
            messages: overrides.emptyLengthRetryMessages,
            json: Boolean(overrides.emptyLengthRetryJson),
            timeoutMs: Math.min(Number(overrides.timeoutMs || timeoutMs), Number(overrides.emptyLengthRetryTimeoutMs || 12_000)),
            maxTokens: Number(overrides.emptyLengthRetryMaxTokens || 32),
            temperature: 0,
            __emptyLengthRetry: true,
            idempotencyKey: overrides.idempotencyKey,
            traceId: overrides.traceId,
          });
        }
        return {
          ok: false,
          status: response.status,
          error: `model returned empty content${finishReason ? ` (finish_reason: ${finishReason})` : ''}`,
          provider: currentProvider,
          model: data?.model || currentModel,
          finishReason,
          usage: extractUsage(currentProvider, data),
          id: data?.id || data?.responseId || null,
          idempotency: idempotencyMetadata(overrides.idempotencyKey, 'definitive-failure'),
        };
      }
      return {
        ok: true,
        provider: currentProvider,
        model: data?.model || currentModel,
        content,
        json: json ? extractJsonObject(content) : null,
        usage: extractUsage(currentProvider, data),
        finishReason,
        id: data?.id || data?.responseId || null,
        idempotency: idempotencyMetadata(overrides.idempotencyKey, 'completed', { providerResponseId: data?.id || data?.responseId || null }),
      };
    } catch (error) {
      return {
        ok: false,
        error: requestAbort.timedOut()
          ? 'model request timed out'
          : error.name === 'AbortError'
            ? 'model request aborted'
            : redactSensitiveText(error.message || String(error)),
        provider: currentProvider,
        model: currentModel,
        idempotency: idempotencyMetadata(overrides.idempotencyKey, 'ambiguous', { safeToRetryAutomatically: false }),
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
      return configured();
    },
    get blockedByPolicy() {
      return blockedByPolicy();
    },
    get model() {
      return currentModel;
    },
    get baseURL() {
      return redactUrl(currentBaseURL);
    },
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
    setConfig({ provider: nextProvider, baseURL: nextBaseURL, model: nextModel } = {}, source = 'runtime-config') {
      if (nextProvider) currentProvider = normalizeProvider(nextProvider);
      if (nextBaseURL) currentBaseURL = cleanBaseUrl(nextBaseURL);
      if (nextModel) currentModel = String(nextModel || '').trim() || currentModel;
      runtimeEnabledSource = source || runtimeEnabledSource;
      return this.status();
    },
    status() {
      return {
        provider: currentProvider,
        enabled: providerEnabled(),
        runtimeEnabled,
        enabledSource: runtimeEnabledSource,
        configured: configured(),
        blockedByPolicy: blockedByPolicy(),
        endpointPolicy: {
          mode: localOnly ? 'local-only' : 'allow-remote',
          status: endpointPolicy().status,
          reason: endpointPolicy().reason,
        },
        model: currentModel,
        baseURL: redactUrl(currentBaseURL),
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
        maxConcurrency: transport.status().maxConcurrency,
        activeRequests: transport.status().activeRequests,
        queuedRequests: transport.status().queuedRequests,
        transportReliability: transport.status(),
        adapterContract: {
          schemaVersion: 'model-provider-adapter/v1',
          provider: adapterConfigFor(currentProvider).provider,
          apiStyle: adapterConfigFor(currentProvider).apiStyle,
          operations: [...adapterConfigFor(currentProvider).operations],
          defaultBaseUrl: redactUrl(adapterConfigFor(currentProvider).defaultBaseUrl),
          idempotencyTransport: {
            header: 'idempotency-key',
            traceHeader: 'x-hofs-trace-id',
            endpointAttestationRequired: true,
          },
        },
      };
    },
    createChatCompletion(input = {}) {
      return transport.execute(() => performChatCompletion(input));
    },
    async createRuntimeIntent(input = {}) {
      const completion = await this.createChatCompletion({
        messages: buildIntentMessages(input),
        json: true,
      });
      const intent = completion.json || (completion.ok ? { intent: completion.content } : null);
      const languageMatches = !completion.ok || modelOutputMatchesLanguage({
        text: [
          intent?.intent,
          intent?.publicSpeechIntent,
          ...(Array.isArray(intent?.privatePlan) ? intent.privatePlan : []),
          intent?.timelineProof,
          intent?.risk,
        ].filter(Boolean).join('\n'),
        language: input.project?.language || 'en',
        allowedTerms: [
          input.project?.name,
          ...(input.project?.team || []).flatMap((agent) => [agent.id, agent.name]),
          'Agent',
          'Hall of Fame Studio',
        ],
      });
      return {
        ...completion,
        ...(languageMatches ? {} : {
          ok: false,
          error: 'model-output-language-mismatch',
          reason: 'language-policy-violation',
        }),
        intent: languageMatches ? intent : null,
      };
    },
    async test(input = {}) {
      const options = typeof input === 'string' ? { prompt: input } : (input || {});
      const prompt = String(options.prompt || 'Reply exactly: OK');
      return this.createChatCompletion({
        messages: [
          { role: 'system', content: 'Health check. Reply with the exact text OK and nothing else.' },
          { role: 'user', content: prompt },
        ],
        json: false,
        maxTokens: Math.max(64, Math.min(128, Number(options.maxTokens) || 64)),
        timeoutMs: Number(options.timeoutMs || 15_000),
        temperature: 0,
        emptyLengthRetryMessages: [
          { role: 'system', content: 'Reply exactly: OK' },
          { role: 'user', content: 'OK' },
        ],
        emptyLengthRetryMaxTokens: 64,
        emptyLengthRetryTimeoutMs: 8_000,
      });
    },
  };
}

export function createModelProviderFromEnv(env = globalThis.process?.env || {}, options = {}) {
  const provider = normalizeProvider(options.provider || env.MODEL_PROVIDER || env.AGENT_MODEL_PROVIDER || DEFAULT_PROVIDER);
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
    baseURL: options.baseURL || env.MODEL_BASE_URL || env[`${providerPrefix}_BASE_URL`] || defaultBaseUrlFor(provider),
    model: options.model || env.MODEL_NAME || env[`${providerPrefix}_MODEL`] || DEFAULT_MODEL,
    enabled: parseBoolean(env.MODEL_PROVIDER_ENABLED || env.AGENT_LLM_ENABLED, providerEnabledDefault),
    temperature: Number(env.MODEL_TEMPERATURE || 0.2),
    maxTokens: Number(env.MODEL_MAX_TOKENS || DEFAULT_MAX_TOKENS),
    timeoutMs: Number(env.MODEL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxConcurrency: Number(env.MODEL_MAX_CONCURRENCY || DEFAULT_MAX_CONCURRENCY),
    transportMaxRetries: options.transportMaxRetries ?? Number(env.MODEL_TRANSPORT_MAX_RETRIES || 0),
    transportRetryBackoffMs: options.transportRetryBackoffMs || parseList(env.MODEL_TRANSPORT_RETRY_BACKOFF_MS || '').map(Number),
    transportCircuitFailureThreshold: options.transportCircuitFailureThreshold ?? Number(env.MODEL_TRANSPORT_CIRCUIT_FAILURE_THRESHOLD || 3),
    transportCircuitFailureWindowMs: options.transportCircuitFailureWindowMs ?? Number(env.MODEL_TRANSPORT_CIRCUIT_FAILURE_WINDOW_MS || 15 * 60 * 1000),
    transportCircuitCooldownMs: options.transportCircuitCooldownMs ?? Number(env.MODEL_TRANSPORT_CIRCUIT_COOLDOWN_MS || 5 * 60 * 1000),
    jsonResponseFormat: parseBoolean(env.MODEL_JSON_RESPONSE_FORMAT, false),
    blockedModels: parseList(env.MODEL_BLOCKED_MODELS || env.AGENT_LLM_BLOCKED_MODELS || ''),
    extraBody: safeJsonParse(env.MODEL_EXTRA_BODY || '{}') || {},
    fetchImpl: options.fetchImpl || globalThis.fetch,
    localOnly: options.localOnly ?? parseBoolean(env.MODEL_LOCAL_ONLY, false),
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
