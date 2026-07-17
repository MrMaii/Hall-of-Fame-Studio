import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardCoordinationTeamPanels.jsx', import.meta.url), 'utf8');
const fixturePathUrl = new URL('../src/project/ProjectDashboardSampleFixturePath.jsx', import.meta.url);

test('Dashboard sample fixture path stays lazy and keeps every demo step action and disabled state', () => {
  assert.ok(assemblySource.includes("const ProjectDashboardSampleFixturePath = lazy(() => import('./ProjectDashboardSampleFixturePath.jsx'))"));
  assert.ok(assemblySource.includes('<ProjectDashboardSampleFixturePath'));
  assert.ok(existsSync(fixturePathUrl), 'Dashboard sample fixture path component must exist');

  const componentSource = readFileSync(fixturePathUrl, 'utf8');
  for (const publicContract of [
    'Sample Fixture Path',
    'manager-demo-step-',
    'steps.map',
    'step.action',
    'Boolean(transition)',
    'step.label',
    'step.detail',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard sample fixture path must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('steps: demoSteps'));
  assert.ok(appSource.includes('transition: sceneTransition'));
  assert.ok(appSource.includes('showSampleFixturePath,'));
  assert.ok(assemblySource.includes('view.showSampleFixturePath &&'));
});
