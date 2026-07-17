export function buildLocalDiagnosticExport({
  localRuntimeStatus = null,
  localServiceReady = false,
  modelReady = false,
  projectCount = 0,
  platform = 'unknown',
  userAgent = 'unknown',
  now = new Date().toISOString(),
} = {}) {
  return {
    schemaVersion: 'local-diagnostic-export/v1',
    exportedAt: now,
    privacy: {
      includesProjectContent: false,
      includesMessages: false,
      includesCredentials: false,
      includesUserIdentity: false,
    },
    environment: { platform, userAgent },
    service: {
      ready: Boolean(localServiceReady),
      backendStatus: localRuntimeStatus?.backend?.status || 'unknown',
      uiStatus: localRuntimeStatus?.ui?.status || 'unknown',
      failureKind: localRuntimeStatus?.backend?.failure?.kind || localRuntimeStatus?.ui?.failure?.kind || null,
      failureCode: localRuntimeStatus?.backend?.failure?.code ?? localRuntimeStatus?.ui?.failure?.code ?? null,
      updatedAt: localRuntimeStatus?.updatedAt || null,
    },
    model: { ready: Boolean(modelReady) },
    data: { projectCount: Number(projectCount) || 0 },
  };
}
