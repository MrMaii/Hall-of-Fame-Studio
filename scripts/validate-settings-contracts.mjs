const checks = [
  './validate-local-mvp-startup-readiness-contract.mjs',
  './validate-settings-health-readiness-contract.mjs',
  './validate-settings-runtime-readiness-contract.mjs',
  './validate-settings-provider-readiness-contract.mjs',
  './validate-settings-integration-readiness-contract.mjs',
  './validate-search-provider-vault-endpoint.mjs',
  './validate-project-settings-privacy-policy.mjs',
  './validate-project-settings-provider-budget-policy.mjs',
  './validate-project-settings-tool-grant-policy.mjs',
  './validate-project-settings-integration-capabilities.mjs',
  './validate-project-settings-workspace-capabilities.mjs',
];

for (const check of checks) {
  await import(check);
}

console.log('Settings backend contract aggregate validation passed.');
