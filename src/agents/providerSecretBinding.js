// Single source of truth for provider secret-record naming and binding rules.
// Extracted verbatim from scripts/agent-project-server.mjs and agentProjectService.js
// (TD-005): both previously carried identical copies that had to be kept in sync by hand.

export const providerApiKeyNames = {
  model: ['model.apikey', 'model.api_key', 'model.api-key', 'llm.apikey', 'llm.api_key', 'openai.apikey', 'openai.api_key'],
  search: ['search.apikey', 'search.api_key', 'search.api-key', 'web-search.apikey', 'web_search.api_key'],
};

export const providerEndpointNames = {
  model: ['model.endpoint', 'model.url', 'model.base_url', 'model.baseurl', 'model.base-url', 'model-provider.endpoint', 'model_provider.endpoint'],
  search: ['search.endpoint', 'search.url', 'search.base_url', 'search-provider.endpoint', 'search_provider.endpoint', 'web-search.endpoint', 'web_search.endpoint'],
};

export const providerModelNames = {
  model: ['model.name', 'model.model', 'model.id', 'model.model_id', 'model.model-id', 'model-provider.model', 'model_provider.model'],
};

export const normalizeProviderSecretTarget = (value = '') => {
  const normalized = String(value || '').toLowerCase().replace(/_/g, '-');
  if (['api-key', 'apikey', 'key', 'token', 'credential'].includes(normalized)) return 'api-key';
  if (['endpoint', 'url', 'base-url', 'baseurl', 'provider-endpoint'].includes(normalized)) return 'endpoint';
  if (['model', 'model-id', 'modelid', 'model-name', 'modelname'].includes(normalized)) return 'model';
  return '';
};

export const providerSecretBindingForRecord = (record = {}) => {
  const name = String(record.name || record.id || '').toLowerCase();
  const scope = String(record.metadata?.scope || '').toLowerCase();
  const target = normalizeProviderSecretTarget(
    record.metadata?.secretKind
    || record.metadata?.target
    || record.metadata?.providerSecretKind
    || '',
  );
  if (
    providerModelNames.model.includes(name)
    || (scope === 'model-provider' && target === 'model')
  ) {
    return { kind: 'model', target: 'model' };
  }
  if (
    providerEndpointNames.model.includes(name)
    || (scope === 'model-provider' && target === 'endpoint')
  ) {
    return { kind: 'model', target: 'endpoint' };
  }
  if (
    providerEndpointNames.search.includes(name)
    || (scope === 'search-provider' && target === 'endpoint')
  ) {
    return { kind: 'search', target: 'endpoint' };
  }
  if (
    providerApiKeyNames.model.includes(name)
    || (scope === 'model-provider' && (!target || target === 'api-key'))
  ) {
    return { kind: 'model', target: 'api-key' };
  }
  if (
    providerApiKeyNames.search.includes(name)
    || (scope === 'search-provider' && (!target || target === 'api-key'))
  ) {
    return { kind: 'search', target: 'api-key' };
  }
  return { kind: '', target: '' };
};

export const findProviderVaultRecord = ({ kind = '', target = 'api-key', records = [] } = {}) => {
  const normalizedKind = String(kind || '').toLowerCase();
  const expectedScope = `${normalizedKind}-provider`;
  const expectedTarget = normalizeProviderSecretTarget(target) || 'api-key';
  const expectedNames = expectedTarget === 'endpoint'
    ? (providerEndpointNames[normalizedKind] || [])
    : expectedTarget === 'model'
      ? (providerModelNames[normalizedKind] || [])
      : (providerApiKeyNames[normalizedKind] || []);
  return records.find((record) => expectedNames.includes(String(record.name || record.id || '').toLowerCase()))
    || records.find((record) => {
      const binding = providerSecretBindingForRecord(record);
      return binding.kind === normalizedKind
        && binding.target === expectedTarget
        && String(record.metadata?.scope || '').toLowerCase() === expectedScope;
    })
    || null;
};
