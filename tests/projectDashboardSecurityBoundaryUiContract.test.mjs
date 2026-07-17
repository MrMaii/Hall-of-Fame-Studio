import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardSecurityBoundary.jsx', import.meta.url);
const wrapperUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageProviderSecurityPanels.jsx', import.meta.url);

test('Dashboard security boundary stays lazy and keeps access, audit, identity, vault, redaction, and route status', () => {
  assert.ok(existsSync(wrapperUrl), 'Manager Ready Package provider security wrapper must exist');
  const wrapperSource = readFileSync(wrapperUrl, 'utf8');
  assert.ok(wrapperSource.includes("const ProjectDashboardSecurityBoundary = lazy(() => import('./ProjectDashboardSecurityBoundary.jsx'))"));
  assert.ok(wrapperSource.includes('<ProjectDashboardSecurityBoundary'));
  assert.ok(existsSync(componentUrl), 'Dashboard security boundary component must exist');

  const componentSource = readFileSync(componentUrl, 'utf8');
  for (const publicContract of [
    'backend-security-boundary-snapshot',
    'Security Boundary',
    'backend-security-boundary-source',
    'Local Safe',
    'Needs Attention',
    'Routes',
    'Sensitive Sets',
    'Access Policy',
    'Audit Rows',
    'Audit Stream',
    'Audit Chain',
    'Identity Sessions',
    'Session Rows',
    'Secret Vault',
    'Vault Records',
    'Vault Rotation',
    'Denied',
    'Raw Leaks',
    'Security Blockers',
    'Security route',
    'Identity route',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard security boundary must keep ${publicContract}`);
  }

  for (const appContract of [
    'securityBoundaryAvailable: readyPackageModelAvailable(backendSecurityBoundary)',
    'securityBoundary: backendSecurityBoundary',
    'managerReadyPackage: backendManagerReadyPackage',
    'managerReadModelSourceBadge,',
  ]) {
    assert.ok(appSource.includes(appContract), `App must retain security boundary contract ${appContract}`);
  }
  assert.ok(wrapperSource.includes('backendSecurityBoundary: securityBoundary,'));
  assert.ok(wrapperSource.includes('backendManagerReadyPackage: managerReadyPackage,'));
  assert.ok(wrapperSource.includes('managerReadModelSourceBadge,'));
});
