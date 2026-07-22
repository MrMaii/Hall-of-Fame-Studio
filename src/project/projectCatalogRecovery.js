const normalizeBaseUrl = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const minimalProjectRow = (project = {}) => ({
  id: String(project.id || ''),
  name: String(project.name || project.id || 'Untitled project'),
  status: String(project.status || 'initiated'),
  progress: Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0,
});

export function createLastKnownProjectCatalog({ baseUrl = '', syncedAt = null, projects = [] } = {}) {
  return {
    version: 1,
    baseUrl: normalizeBaseUrl(baseUrl),
    syncedAt: syncedAt || null,
    projects: (Array.isArray(projects) ? projects : [])
      .filter(project => project?.id)
      .map(minimalProjectRow),
  };
}

export function restoreLastKnownProjectCatalog(snapshot, baseUrl = '') {
  if (
    snapshot?.version !== 1
    || normalizeBaseUrl(snapshot.baseUrl) !== normalizeBaseUrl(baseUrl)
    || !Array.isArray(snapshot.projects)
  ) return [];

  return snapshot.projects
    .filter(project => project?.id)
    .map(project => ({
      ...minimalProjectRow(project),
      dataSource: 'backend-catalog-snapshot',
      catalogRecoveryStatus: 'verifying',
    }));
}

const isBackendCatalogProject = (project = {}) => (
  Boolean(project.catalogRecoveryStatus)
  || project.backendSyncStatus === 'online'
  || ['backend-backed', 'backend-managed', 'backend-catalog', 'backend-catalog-snapshot'].includes(project.dataSource)
);

export function reconcileVerifiedProjectCatalog(currentProjects = [], verifiedProjects = []) {
  const verified = Array.isArray(verifiedProjects) ? verifiedProjects : [];
  const currentById = new Map(
    (Array.isArray(currentProjects) ? currentProjects : [])
      .filter(project => project?.id)
      .map(project => [String(project.id).toLowerCase(), project]),
  );
  const mergedVerified = verified.map((project) => {
    if (project?.dataSource !== 'backend-catalog') return project;
    const current = currentById.get(String(project.id || '').toLowerCase());
    if (!current || !isBackendCatalogProject(current)) return project;
    const { catalogRecoveryStatus, ...currentProject } = current;
    const retainedDataSource = ['backend-backed', 'backend-managed'].includes(current.dataSource)
      ? current.dataSource
      : 'backend-catalog';
    return {
      ...currentProject,
      ...project,
      dataSource: retainedDataSource,
    };
  });
  const verifiedIds = new Set(verified.map(project => String(project?.id || '').toLowerCase()).filter(Boolean));
  const retainedLocalProjects = (Array.isArray(currentProjects) ? currentProjects : []).filter(project => (
    !verifiedIds.has(String(project?.id || '').toLowerCase())
    && !isBackendCatalogProject(project)
  ));
  return [...mergedVerified, ...retainedLocalProjects];
}

export function projectCatalogRowState(project = {}, syncStatus = 'idle') {
  if (!project.catalogRecoveryStatus) return 'verified';
  return syncStatus === 'offline' ? 'offline' : 'verifying';
}

export function projectCatalogPresentation({ syncStatus = 'idle', projectCount = 0, language = 'zh' } = {}) {
  const text = (chinese, english) => language === 'en' ? english : chinese;
  if (syncStatus === 'offline') {
    return { state: 'offline', label: text('离线显示上次项目', 'Showing last-known projects offline') };
  }
  if (syncStatus === 'checking' || (syncStatus === 'idle' && projectCount > 0)) {
    return { state: 'checking', label: text('正在校验项目', 'Verifying projects') };
  }
  if (syncStatus === 'ready' && projectCount === 0) {
    return { state: 'empty', label: text('还没有项目', 'No projects yet') };
  }
  if (syncStatus === 'ready') {
    return { state: 'ready', label: text('项目已同步', 'Projects synced') };
  }
  return { state: 'idle', label: '' };
}
