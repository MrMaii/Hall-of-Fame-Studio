import {
  createModelProvider,
  createModelProviderFromEnv,
  getModelProviderAdapterManifest,
} from '../src/agents/modelProvider.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const plaintextSecret = 'MODEL_PROVIDER_ADAPTER_SECRET_SHOULD_NOT_LEAK';
const manifest = getModelProviderAdapterManifest();

assert(manifest.schemaVersion === 'model-provider-adapter-manifest/v1', 'Model provider adapter manifest must expose its schema version.');
for (const provider of ['openai-compatible', 'openai', 'anthropic', 'gemini']) {
  assert(manifest.adapters.some((adapter) => adapter.provider === provider), `Model provider adapter manifest must include ${provider}.`);
}
assert(manifest.adapters.every((adapter) => adapter.operations.includes('chat-completion') && adapter.operations.includes('runtime-intent')), 'Every model adapter must expose chat completion and runtime intent operations.');
assert(!JSON.stringify(manifest).includes(plaintextSecret), 'Model provider adapter manifest must not expose provider secrets.');

const requests = [];
const provider = createModelProvider({
  provider: 'openai-compatible',
  apiKey: plaintextSecret,
  model: 'adapter-contract-model',
  baseURL: 'https://adapter.example.test/v1',
  enabled: true,
  fetchImpl: async (url, init = {}) => {
    requests.push({ url, init });
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          id: 'adapter_contract_completion',
          model: 'adapter-contract-model',
          choices: [{ message: { content: '{"ok":true,"message":"adapter ready"}' } }],
          usage: { prompt_tokens: 7, completion_tokens: 5, total_tokens: 12 },
        });
      },
    };
  },
});

const status = provider.status();
assert(status.adapterContract?.schemaVersion === 'model-provider-adapter/v1', 'Model provider status must expose the adapter contract.');
assert(status.adapterContract.provider === 'openai-compatible', 'OpenAI-compatible provider must report its adapter id.');
assert(status.adapterContract.apiStyle === 'openai-chat-completions', 'OpenAI-compatible provider must report chat-completions API style.');
assert(status.hasApiKey === true && status.apiKeySource === 'direct-config', 'Model provider status must expose safe key presence and source metadata.');
assert(!JSON.stringify(status).includes(plaintextSecret), 'Model provider status must not expose plaintext API keys.');

const completion = await provider.createChatCompletion({
  messages: [{ role: 'user', content: 'Return JSON only.' }],
  json: true,
});
assert(completion.ok === true && completion.json?.ok === true, 'OpenAI-compatible adapter must parse a JSON chat-completion response.');
assert(requests.length === 1, 'OpenAI-compatible adapter must issue exactly one request.');
assert(String(requests[0].url).endsWith('/chat/completions'), 'OpenAI-compatible adapter must call the chat-completions endpoint.');
assert(requests[0].init.headers.authorization === `Bearer ${plaintextSecret}`, 'OpenAI-compatible adapter must pass the API key only in the outbound Authorization header.');
assert(!JSON.stringify(completion).includes(plaintextSecret), 'Model completion result must not expose plaintext API keys.');

const disabledProvider = createModelProvider({ enabled: true });
const skipped = await disabledProvider.createChatCompletion({
  messages: [{ role: 'user', content: 'Should not call a network provider.' }],
});
assert(skipped.ok === false && skipped.skipped === true && skipped.reason === 'missing-api-key', 'Missing-key adapter calls must skip without network access.');

const anthropicProvider = createModelProvider({
  provider: 'anthropic',
  apiKey: plaintextSecret,
  enabled: false,
});
assert(anthropicProvider.status().adapterContract.apiStyle === 'anthropic-messages', 'Anthropic adapter must report messages API style.');

const geminiProvider = createModelProviderFromEnv({
  MODEL_PROVIDER: 'gemini',
  GEMINI_API_KEY: plaintextSecret,
  MODEL_PROVIDER_ENABLED: 'true',
});
assert(geminiProvider.status().adapterContract.apiStyle === 'gemini-generate-content', 'Gemini env adapter must report generate-content API style.');
assert(!JSON.stringify(geminiProvider.status()).includes(plaintextSecret), 'Gemini adapter status must not expose env API keys.');

console.log('Model provider adapter contract validation passed.');
