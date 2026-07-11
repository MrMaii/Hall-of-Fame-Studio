import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import { createModelProvider } from '../src/agents/modelProvider.js';
import { createSearchProvider } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';

function createLocalOnlyService() {
  const secretVault = createSecretVaultFromEnv({
    SECRET_VAULT_ENABLED: 'true',
    SECRET_VAULT_KEY: 'local-provider-vault-policy-test-key',
    SECRET_VAULT_KEY_ID: 'local-provider-vault-policy-test',
  });
  const llmProvider = createModelProvider({
    apiKey: 'fixture-key',
    baseURL: 'http://127.0.0.1:11434/v1',
    enabled: true,
    localOnly: true,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'local' } }] }) }),
  });
  const searchProvider = createSearchProvider({
    provider: 'http-json',
    endpoint: 'http://127.0.0.1:8788/search',
    enabled: true,
    localOnly: true,
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ sources: [] }) }),
  });
  return { secretVault, service: createAgentProjectService({ secretVault, llmProvider, searchProvider }) };
}

test('rejects remote provider endpoints before sealing them into the local vault', async () => {
  const { secretVault, service } = createLocalOnlyService();

  await assert.rejects(
    service.sealSecretVaultRecord({
      name: 'model.endpoint',
      value: 'https://api.openai.com/v1',
      metadata: { scope: 'model-provider', target: 'endpoint' },
    }),
    /local-provider-endpoint-required/,
  );
  assert.equal(secretVault.records().length, 0);
});

test('seals and binds a local model endpoint through the local vault', async () => {
  const { service } = createLocalOnlyService();

  const result = await service.sealSecretVaultRecord({
    name: 'model.endpoint',
    value: 'http://127.0.0.1:11434/v1',
    metadata: { scope: 'model-provider', target: 'endpoint' },
  });

  assert.equal(result.providerRuntimeBinding.bound, true);
  assert.equal(result.providerRuntimeBinding.status.endpointPolicy.status, 'local-endpoint');
});
