import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODEL_PROVIDERS,
  findModelProvider,
  modelsForProvider,
} from '../src/settings/modelProviderCatalog.js';

test('built-in model provider catalog covers the requested suppliers and local custom models', () => {
  assert.deepEqual(
    MODEL_PROVIDERS.map((provider) => provider.id),
    ['openai', 'anthropic', 'gemini', 'stepfun', 'deepseek', 'qwen', 'custom'],
  );

  const ids = new Set();
  for (const provider of MODEL_PROVIDERS) {
    assert.ok(!ids.has(provider.id), `duplicate provider id: ${provider.id}`);
    ids.add(provider.id);
    assert.ok(provider.name);
    assert.ok(provider.logo);
    assert.ok(provider.protocol);
    assert.ok(provider.defaultModel);
    assert.ok(provider.models.length > 0);
    if (provider.id !== 'custom') assert.match(provider.baseURL, /^https:\/\//);
    assert.ok(provider.models.some((model) => model.id === provider.defaultModel));
  }
});

test('provider helpers return provider-scoped models without sharing mutable catalog state', () => {
  assert.equal(findModelProvider('claude').id, 'anthropic');
  assert.equal(findModelProvider('unknown').id, 'custom');
  assert.ok(modelsForProvider('deepseek').every((model) => model.id.startsWith('deepseek-')));

  const first = modelsForProvider('openai');
  first.pop();
  assert.notEqual(first.length, modelsForProvider('openai').length);
});
