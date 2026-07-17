import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const launcherUrl = new URL('../src/project/ProjectDashboardToolLauncher.jsx', import.meta.url);
const advancedViewSource = readFileSync(new URL('../src/project/ProjectDashboardAdvancedView.jsx', import.meta.url), 'utf8');

test('Dashboard project tool launcher stays lazy and keeps every scene entry and open state action', () => {
  assert.ok(advancedViewSource.includes("const ProjectDashboardToolLauncher = lazy(() => import('./ProjectDashboardToolLauncher.jsx'))"));
  assert.ok(advancedViewSource.includes('<ProjectDashboardToolLauncher'));
  assert.ok(existsSync(launcherUrl), 'Dashboard project tool launcher component must exist');

  const componentSource = readFileSync(launcherUrl, 'utf8');
  for (const publicContract of [
    'Open project tools',
    'onFocusCapture',
    'onEnterScene',
    'onOpenChange',
    'launchers.map',
    'item.icon',
    'item.label',
    'item.sub',
    'item.desc',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard project tool launcher must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('launchers: managerLaunchers'));
  assert.ok(appSource.includes('onEnterScene: enterProjectScene'));
  assert.ok(appSource.includes('onOpenChange: setProjectLauncherOpen'));
  assert.ok(appSource.includes('open: projectLauncherOpen'));
  assert.ok(appSource.includes('transition: sceneTransition'));
});
