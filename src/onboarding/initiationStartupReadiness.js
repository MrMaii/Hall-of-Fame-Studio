export function initiationStartupAllowsModelWork({
  backendUrlConfigured = false,
  startupReadiness = null,
  modelProviderStatus = null,
} = {}) {
  if (!backendUrlConfigured) return false;
  if (startupReadiness?.readyForFirstProjectRun === true) return true;
  return Boolean(
    startupReadiness?.readyForProviderSetup === true
    && modelProviderStatus?.enabled
    && modelProviderStatus?.configured
  );
}
