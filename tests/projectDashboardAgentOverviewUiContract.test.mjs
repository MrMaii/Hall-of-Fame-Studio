import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const topPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardTopPanels.jsx', import.meta.url), 'utf8');
const overviewSource = readFileSync(new URL('../src/project/ProjectDashboardAgentOverview.jsx', import.meta.url), 'utf8');

test('complete Dashboard Agent overview stays lazy and keeps its work controls', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardTopPanels = lazy(() => import('./ProjectDashboardTopPanels.jsx'))"));
  assert.ok(topPanelsSource.includes("const ProjectDashboardAgentOverview = lazy(() => import('./ProjectDashboardAgentOverview.jsx'))"));
  assert.ok(topPanelsSource.includes('<ProjectDashboardAgentOverview'));

  for (const publicControl of [
    'kickoff-dashboard-generation-source',
    'dashboard-agent-status',
    'dashboard-agent-status-source',
    'dashboard-agent-status-backend-required',
    'dashboard-agent-status-sync-cockpit',
    'dashboard-agent-status-${row.agent.id}',
    'Open Flow Graph',
    "projectText('Pulse')",
  ]) {
    assert.ok(overviewSource.includes(publicControl), `complete Dashboard Agent overview must keep ${publicControl}`);
  }

  assert.ok(overviewSource.includes('operationsBoardRows.map'));
  assert.ok(overviewSource.includes('onSyncCockpit'));
  assert.ok(overviewSource.includes('onRunAgentPulse(row.agent.id)'));
});
