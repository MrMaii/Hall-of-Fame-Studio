import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { canCreateLocalProject, resolveLocalStartupSurface } from '../src/onboarding/localFirstRunModel.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('keeps an existing user on a neutral restoring surface while local auth is unresolved', () => {
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'dashboard',
    authStatus: { available: null, loading: false, error: null },
    hasSession: true,
    modelReady: true,
    projectCount: 2,
  }), 'restoring');
});

test('shows first run only after auth status resolves to a state that requires action', () => {
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'dashboard',
    authStatus: { available: true, loading: false, error: null },
    hasSession: false,
    modelReady: true,
    projectCount: 2,
  }), 'first-run');
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'dashboard',
    authStatus: { available: true, loading: false, error: null },
    hasSession: true,
    modelReady: true,
    projectCount: 2,
  }), 'dashboard');
});

test('optional local authentication does not block a configured single-user workspace', () => {
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'dashboard',
    authStatus: { available: false, loading: false, error: null },
    hasSession: false,
    catalogStatus: 'ready',
    modelReady: true,
    projectCount: 2,
  }), 'dashboard');
  assert.ok(appSource.includes("if (localAuthStatus.available === true && !authToken) return;"));
  assert.equal(canCreateLocalProject({ authAvailable: false, hasSession: false }), true);
  assert.equal(canCreateLocalProject({ authAvailable: true, hasSession: false }), false);
  assert.equal(canCreateLocalProject({ authAvailable: true, hasSession: true }), true);
});

test('does not claim there are no projects while the backend catalog is still restoring', () => {
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'dashboard',
    authStatus: { available: true, loading: false, error: null },
    hasSession: true,
    catalogStatus: 'checking',
    modelReady: true,
    projectCount: 0,
  }), 'restoring');
});

test('does not replace non-dashboard routes during local auth restoration', () => {
  assert.equal(resolveLocalStartupSurface({
    activeRoute: 'project_detail',
    authStatus: { available: null, loading: true, error: null },
    hasSession: true,
    modelReady: true,
    projectCount: 2,
  }), 'route');
});

test('the root layout uses the startup surface decision before rendering first run', () => {
  assert.ok(appSource.includes('const localStartupSurface = resolveLocalStartupSurface({'));
  assert.ok(appSource.includes("localStartupSurface === 'restoring'"));
  assert.ok(appSource.includes("localStartupSurface === 'first-run'"));
});
