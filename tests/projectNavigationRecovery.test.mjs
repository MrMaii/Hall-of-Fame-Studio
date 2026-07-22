import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createProjectNavigationSnapshot,
  DEFAULT_PROJECT_NAVIGATION,
  reconcileProjectNavigation,
  restoreProjectNavigationSnapshot,
} from '../src/project/projectNavigationRecovery.js';

test('restores only safe project navigation for the same backend', () => {
  const snapshot = createProjectNavigationSnapshot({
    baseUrl: 'http://127.0.0.1:8787/',
    activeRoute: 'project_detail',
    selectedProjectId: 'project-1',
    projectMode: 'chat',
    activeChannelId: 'decisions',
  });

  assert.deepEqual(restoreProjectNavigationSnapshot(snapshot, 'http://127.0.0.1:8787'), {
    activeRoute: 'project_detail',
    selectedProjectId: 'project-1',
    projectMode: 'chat',
    activeChannelId: 'decisions',
  });
  assert.deepEqual(
    restoreProjectNavigationSnapshot(snapshot, 'http://127.0.0.1:9999'),
    DEFAULT_PROJECT_NAVIGATION,
  );
});

test('rejects transient routes and incomplete project locations', () => {
  assert.deepEqual(createProjectNavigationSnapshot({
    baseUrl: 'http://127.0.0.1:8787',
    activeRoute: 'project_initiation',
    selectedProjectId: 'draft-1',
    projectMode: 'meeting',
    activeChannelId: 'main',
  }), {
    version: 1,
    baseUrl: 'http://127.0.0.1:8787',
    ...DEFAULT_PROJECT_NAVIGATION,
  });
  assert.deepEqual(createProjectNavigationSnapshot({
    baseUrl: 'http://127.0.0.1:8787',
    activeRoute: 'project_detail',
    selectedProjectId: '',
    projectMode: 'timeline',
    activeChannelId: 'main',
  }), {
    version: 1,
    baseUrl: 'http://127.0.0.1:8787',
    ...DEFAULT_PROJECT_NAVIGATION,
  });
  assert.deepEqual(createProjectNavigationSnapshot({
    baseUrl: 'http://127.0.0.1:8787',
    activeRoute: 'agent_market',
  }), {
    version: 1,
    baseUrl: 'http://127.0.0.1:8787',
    ...DEFAULT_PROJECT_NAVIGATION,
  });
});

test('waits for catalog verification before falling back from a missing project', () => {
  const recovered = {
    activeRoute: 'project_detail',
    selectedProjectId: 'project-1',
    projectMode: 'timeline',
    activeChannelId: 'main',
  };

  assert.deepEqual(reconcileProjectNavigation({
    navigation: recovered,
    projectIds: [],
    catalogStatus: 'checking',
  }), recovered);
  assert.deepEqual(reconcileProjectNavigation({
    navigation: recovered,
    projectIds: ['project-1'],
    catalogStatus: 'ready',
  }), recovered);
  assert.deepEqual(reconcileProjectNavigation({
    navigation: recovered,
    projectIds: [],
    catalogStatus: 'ready',
  }), DEFAULT_PROJECT_NAVIGATION);
});

test('App restores and persists the project route, mode, and channel', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.ok(appSource.includes('projectNavigationSnapshot'));
  assert.ok(appSource.includes('useState(loadProjectNavigation)'));
  assert.ok(appSource.includes('useState(initialProjectNavigation.activeRoute)'));
  assert.ok(appSource.includes('useState(initialProjectNavigation.projectMode)'));
  assert.ok(appSource.includes('createProjectNavigationSnapshot({'));
  assert.ok(appSource.includes("activeRoute === 'project_detail' && (projectNavigationRestoring"));
});
