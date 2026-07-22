const SAFE_ROUTES = new Set(['dashboard', 'project_detail']);
const PROJECT_MODES = new Set(['dashboard', 'meeting', 'chat', 'timeline']);

export const DEFAULT_PROJECT_NAVIGATION = {
  activeRoute: 'dashboard',
  selectedProjectId: null,
  projectMode: 'dashboard',
  activeChannelId: 'main',
};

const normalizeBaseUrl = value => String(value || '').trim().replace(/\/+$/, '');
const safeId = value => {
  const normalized = String(value || '').trim();
  return normalized && normalized.length <= 160 ? normalized : '';
};

const normalizeNavigation = ({ activeRoute, selectedProjectId, projectMode, activeChannelId } = {}) => {
  if (!SAFE_ROUTES.has(activeRoute)) return { ...DEFAULT_PROJECT_NAVIGATION };
  if (activeRoute !== 'project_detail') {
    return {
      ...DEFAULT_PROJECT_NAVIGATION,
      activeRoute,
    };
  }
  const projectId = safeId(selectedProjectId);
  if (!projectId) return { ...DEFAULT_PROJECT_NAVIGATION };
  return {
    activeRoute: 'project_detail',
    selectedProjectId: projectId,
    projectMode: PROJECT_MODES.has(projectMode) ? projectMode : 'dashboard',
    activeChannelId: safeId(activeChannelId) || 'main',
  };
};

export function createProjectNavigationSnapshot({ baseUrl, ...navigation } = {}) {
  return {
    version: 1,
    baseUrl: normalizeBaseUrl(baseUrl),
    ...normalizeNavigation(navigation),
  };
}

export function restoreProjectNavigationSnapshot(snapshot, baseUrl) {
  if (
    !snapshot
    || snapshot.version !== 1
    || normalizeBaseUrl(snapshot.baseUrl) !== normalizeBaseUrl(baseUrl)
  ) {
    return { ...DEFAULT_PROJECT_NAVIGATION };
  }
  return normalizeNavigation(snapshot);
}

export function reconcileProjectNavigation({ navigation, projectIds = [], catalogStatus = 'idle' } = {}) {
  const normalized = normalizeNavigation(navigation);
  if (normalized.activeRoute !== 'project_detail') return normalized;
  if (projectIds.some(projectId => String(projectId || '') === normalized.selectedProjectId)) return normalized;
  if (catalogStatus === 'idle' || catalogStatus === 'checking') return normalized;
  return { ...DEFAULT_PROJECT_NAVIGATION };
}
