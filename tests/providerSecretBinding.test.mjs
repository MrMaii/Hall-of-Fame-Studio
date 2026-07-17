// Characterization tests for the extracted provider secret binding rules (TD-005).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProviderSecretTarget,
  providerSecretBindingForRecord,
  findProviderVaultRecord,
} from '../src/agents/providerSecretBinding.js';

test('normalizeProviderSecretTarget maps aliases', () => {
  assert.equal(normalizeProviderSecretTarget('apikey'), 'api-key');
  assert.equal(normalizeProviderSecretTarget('API_KEY'), 'api-key');
  assert.equal(normalizeProviderSecretTarget('base_url'), 'endpoint');
  assert.equal(normalizeProviderSecretTarget('model-name'), 'model');
  assert.equal(normalizeProviderSecretTarget('provider-id'), 'provider');
  assert.equal(normalizeProviderSecretTarget('unknown'), '');
});

test('binding by record name', () => {
  assert.deepEqual(providerSecretBindingForRecord({ name: 'model.apikey' }), { kind: 'model', target: 'api-key' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'model.endpoint' }), { kind: 'model', target: 'endpoint' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'model.name' }), { kind: 'model', target: 'model' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'model.provider' }), { kind: 'model', target: 'provider' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'search.apikey' }), { kind: 'search', target: 'api-key' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'search.endpoint' }), { kind: 'search', target: 'endpoint' });
  assert.deepEqual(providerSecretBindingForRecord({ name: 'unrelated.secret' }), { kind: '', target: '' });
});

test('binding by metadata scope + target', () => {
  assert.deepEqual(
    providerSecretBindingForRecord({ name: 'custom', metadata: { scope: 'model-provider', target: 'endpoint' } }),
    { kind: 'model', target: 'endpoint' },
  );
  assert.deepEqual(
    providerSecretBindingForRecord({ name: 'custom', metadata: { scope: 'model-provider' } }),
    { kind: 'model', target: 'api-key' },
  );
  assert.deepEqual(
    providerSecretBindingForRecord({ name: 'custom', metadata: { scope: 'search-provider', secretKind: 'url' } }),
    { kind: 'search', target: 'endpoint' },
  );
});

test('findProviderVaultRecord prefers exact name match, falls back to scoped binding', () => {
  const records = [
    { name: 'other.secret', metadata: {} },
    { name: 'custom-model-url', metadata: { scope: 'model-provider', target: 'endpoint' } },
    { name: 'model.apikey', metadata: {} },
    { name: 'model.provider', metadata: {} },
  ];
  assert.equal(findProviderVaultRecord({ kind: 'model', target: 'api-key', records }).name, 'model.apikey');
  assert.equal(findProviderVaultRecord({ kind: 'model', target: 'endpoint', records }).name, 'custom-model-url');
  assert.equal(findProviderVaultRecord({ kind: 'model', target: 'provider', records }).name, 'model.provider');
  assert.equal(findProviderVaultRecord({ kind: 'search', target: 'api-key', records }), null);
});
