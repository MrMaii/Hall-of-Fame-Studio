export const LOCAL_BACKEND_RECOVERY_INTERVAL_MS = 5_000;

const authenticatedForLocalMode = ({ authAvailable, hasSession }) => (
  authAvailable !== true || hasSession
);

export function shouldRunLocalBackendRecovery({
  configured = false,
  authAvailable = null,
  hasSession = false,
  catalogStatus = 'idle',
  connectionStatus = 'unknown',
} = {}) {
  if (!configured || !authenticatedForLocalMode({ authAvailable, hasSession })) return false;
  return catalogStatus === 'offline' || connectionStatus === 'offline';
}

export function shouldHydrateRestoredProject({
  activeRoute = 'dashboard',
  project = null,
  configured = false,
  authAvailable = null,
  hasSession = false,
  lastSyncedProjectId = null,
} = {}) {
  if (activeRoute !== 'project_detail' || !project?.id || !configured) return false;
  if (!authenticatedForLocalMode({ authAvailable, hasSession })) return false;
  const catalogOnly = Boolean(project.catalogRecoveryStatus)
    || ['backend-catalog', 'backend-catalog-snapshot'].includes(project.dataSource);
  const alreadySynced = String(lastSyncedProjectId || '').toLowerCase() === String(project.id).toLowerCase();
  return catalogOnly || !alreadySynced;
}

export function shouldRetryManagerFlowGraph({
  activeRoute = 'dashboard',
  projectMode = 'dashboard',
  projectId = null,
  errorProjectId = null,
  error = null,
} = {}) {
  return activeRoute === 'project_detail'
    && projectMode === 'timeline'
    && Boolean(error)
    && Boolean(projectId)
    && String(projectId).toLowerCase() === String(errorProjectId || '').toLowerCase();
}
