import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const contentLayoutSource = readFileSync(new URL('../src/project/ProjectDashboardContentLayout.jsx', import.meta.url), 'utf8');
const recentCommitLineUrl = new URL('../src/project/ProjectDashboardRecentCommitLine.jsx', import.meta.url);

test('Dashboard project updates stay lazy and keep expandable official summaries', () => {
  assert.ok(contentLayoutSource.includes("const ProjectDashboardRecentCommitLine = lazy(() => import('./ProjectDashboardRecentCommitLine.jsx'))"));
  assert.ok(contentLayoutSource.includes('<ProjectDashboardRecentCommitLine'));
  assert.ok(existsSync(recentCommitLineUrl), 'Dashboard Recent Commit Line component must exist');

  const componentSource = readFileSync(recentCommitLineUrl, 'utf8');
  for (const publicContract of [
    'Official Project Updates',
    'project-dashboard-official-updates',
    '项目动态',
    'recent-commit-line-backend-required',
    'recent-commit-line-sync-timeline-events',
    'project-update-detail-${event.id}',
    '官方项目摘要',
    'onSyncTimeline',
  ]) {
    assert.ok(componentSource.includes(publicContract), `Dashboard Recent Commit Line must keep ${publicContract}`);
  }

  assert.ok(appSource.includes('events: projectBriefing.updates'));
  assert.ok(appSource.includes('eventStyles: EVENT_TYPE_STYLES'));
  assert.ok(appSource.includes('backendRequired: recentLineBackendRequired'));
  assert.ok(appSource.includes('onSyncTimeline: () => syncBackendTimelineAndEvents'));
  assert.ok(appSource.includes('syncDisabled: backendWorkerStationSyncDisabled'));
});
