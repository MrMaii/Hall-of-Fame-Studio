import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerReadyPackageCorePanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardManagerReadyPackageSummary.jsx', import.meta.url);

test('Manager Ready Package summary stays lazy and preserves the original status grid', () => {
  assert.ok(existsSync(componentUrl), 'Manager Ready Package summary component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardManagerReadyPackageSummary = lazy(() => import('./ProjectDashboardManagerReadyPackageSummary.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardManagerReadyPackageSummary'));
  assert.ok(appSource.includes('formatters: {'));
  assert.ok(appSource.includes('models: {'));
  assert.ok(appSource.includes('readyPackage: backendManagerReadyPackage'));
  assert.ok(appSource.includes('projectText,'));

  for (const contract of [
    'grid grid-cols-2 md:grid-cols-4 gap-2',
    'data-testid="backend-manager-ready-package-summary"',
    "['Status', readyPackage.status || 'unknown']",
    "['Score', readyPackage.score ?? 0]",
    "['MVP Status', readyPackage.mvpStatus || mvpReadiness?.status || 'unknown']",
    "['Local Pilot', readyPackage.readyForLocalPilot ? 'ready' : 'blocked']",
    "['Production', readyPackage.readyForProduction ? 'ready' : 'blocked']",
    "['Pilot Launch'",
    "projectText('Launch Approval')",
    "projectText('Launch Audit')",
    "['Evidence Archive'",
    "['Evidence Export'",
    "['Go-Live Status'",
    "['Release Candidate'",
    "['Pilot Launch Run'",
    "['Post Launch Health'",
    "['Acceptance Report'",
    "['Production Ops'",
    "['Artifact Audit'",
    "['Review Workflow'",
    "['Delivery Trace'",
    "['Operating Loop'",
    "['Collab Diagnostics'",
    "['Intent Queue'",
    "['Runtime Contracts'",
    "['Cycle Consistency'",
    "['Runtime Autonomy'",
    "['Evidence Audit'",
    "['Evidence Index'",
    "['Source Review'",
    "['Evidence Custody'",
    "['Security'",
    "['Providers'",
    "['Controlled Run'",
    "['Provider Eval'",
    "['Operations'",
    "['Action Queue'",
    "['Transcript Channels'",
    "['Assignments'",
    "['Changes'",
    'ready-package-${label}',
  ]) {
    assert.ok(componentSource.includes(contract), `Manager Ready Package summary must keep ${contract}`);
  }

  for (const formatter of [
    'modelStatus',
    'modelRatio',
    'modelBoolean',
    'modelValue',
    'modelCents',
    'summaryStatus',
    'summaryRatio',
    'summaryBoolean',
    'summaryValue',
  ]) {
    assert.ok(componentSource.includes(formatter), `Manager Ready Package summary must keep ${formatter}`);
  }

  assert.equal(
    appSource.includes("['Status', backendManagerReadyPackage.status || 'unknown']"),
    false,
    'Manager Ready Package summary markup must no longer remain duplicated in App',
  );
});
