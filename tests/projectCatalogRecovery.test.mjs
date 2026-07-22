import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLastKnownProjectCatalog,
  projectCatalogPresentation,
  projectCatalogRowState,
  reconcileVerifiedProjectCatalog,
  restoreLastKnownProjectCatalog,
} from '../src/project/projectCatalogRecovery.js';

test('restores only minimal last-known project rows for the same backend', () => {
  const snapshot = createLastKnownProjectCatalog({
    baseUrl: 'http://127.0.0.1:8787/',
    syncedAt: '2026-07-18T12:00:00.000Z',
    projects: [{
      id: 'project-1',
      name: 'Launch plan',
      status: 'executing',
      progress: 42,
      team: [{ id: 'agent-1', secret: 'must-not-persist' }],
      messages: [{ id: 'message-1', text: 'private' }],
    }],
  });

  assert.deepEqual(snapshot, {
    version: 1,
    baseUrl: 'http://127.0.0.1:8787',
    syncedAt: '2026-07-18T12:00:00.000Z',
    projects: [{ id: 'project-1', name: 'Launch plan', status: 'executing', progress: 42 }],
  });
  assert.deepEqual(restoreLastKnownProjectCatalog(snapshot, 'http://127.0.0.1:8787'), [{
    id: 'project-1',
    name: 'Launch plan',
    status: 'executing',
    progress: 42,
    dataSource: 'backend-catalog-snapshot',
    catalogRecoveryStatus: 'verifying',
  }]);
  assert.deepEqual(restoreLastKnownProjectCatalog(snapshot, 'http://127.0.0.1:9999'), []);
});

test('distinguishes checking, offline recovery, and a verified empty catalog', () => {
  assert.deepEqual(projectCatalogPresentation({ syncStatus: 'checking', projectCount: 1, language: 'zh' }), {
    state: 'checking',
    label: '正在校验项目',
  });
  assert.deepEqual(projectCatalogPresentation({ syncStatus: 'offline', projectCount: 1, language: 'zh' }), {
    state: 'offline',
    label: '离线显示上次项目',
  });
  assert.deepEqual(projectCatalogPresentation({ syncStatus: 'ready', projectCount: 0, language: 'zh' }), {
    state: 'empty',
    label: '还没有项目',
  });
  assert.equal(projectCatalogRowState({ catalogRecoveryStatus: 'verifying' }, 'checking'), 'verifying');
  assert.equal(projectCatalogRowState({ catalogRecoveryStatus: 'verifying' }, 'offline'), 'offline');
  assert.equal(projectCatalogRowState({ dataSource: 'backend-backed' }, 'ready'), 'verified');
});

test('replaces recovered and stale backend rows while preserving browser-local projects', () => {
  const localProject = { id: 'local-1', name: 'Local notes', dataSource: 'browser-local' };
  const verifiedProject = { id: 'backend-2', name: 'Verified launch', dataSource: 'backend-backed' };
  const currentProjects = [
    { id: 'backend-1', name: 'Deleted remotely', dataSource: 'backend-backed' },
    { id: 'backend-2', name: 'Old title', dataSource: 'backend-catalog-snapshot', catalogRecoveryStatus: 'verifying' },
    localProject,
  ];

  assert.deepEqual(reconcileVerifiedProjectCatalog(currentProjects, [verifiedProject]), [
    verifiedProject,
    localProject,
  ]);
  assert.deepEqual(reconcileVerifiedProjectCatalog(currentProjects, []), [localProject]);
});

test('a verified compact catalog row preserves the already loaded project details', () => {
  const currentProject = {
    id: 'backend-2',
    name: 'Old title',
    status: 'executing',
    progress: 40,
    dataSource: 'backend-backed',
    team: [{ id: 'agent-1', name: 'Researcher' }],
    tasks: [{ id: 'task-1', title: 'Collect sources' }],
    localRuntime: { workspacePath: 'C:/projects/research' },
  };
  const catalogRow = {
    id: 'backend-2',
    name: 'Current title',
    status: 'executing',
    progress: 55,
    dataSource: 'backend-catalog',
  };

  assert.deepEqual(reconcileVerifiedProjectCatalog([currentProject], [catalogRow]), [{
    ...currentProject,
    name: 'Current title',
    progress: 55,
  }]);
});

test('backend catalog rows are removed when the backend no longer returns them', () => {
  const staleCatalogRow = {
    id: 'backend-3',
    name: 'Removed project',
    dataSource: 'backend-catalog',
  };

  assert.deepEqual(reconcileVerifiedProjectCatalog([staleCatalogRow], []), []);
});
