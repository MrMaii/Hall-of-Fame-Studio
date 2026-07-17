import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const routeViewSource = readFileSync(new URL('../src/project/ProjectTimelineRouteView.jsx', import.meta.url), 'utf8');
const timelineSource = readFileSync(new URL('../src/project/AdvancedProjectTimeline.jsx', import.meta.url), 'utf8');

test('complete project timeline stays lazy and keeps the original node-flow controls', () => {
  assert.ok(appSource.includes("const ProjectTimelineRouteView = lazy(() => import('./project/ProjectTimelineRouteView.jsx'))"));
  assert.ok(appSource.includes('<ProjectTimelineRouteView'));
  assert.ok(routeViewSource.includes("import AdvancedProjectTimeline from './AdvancedProjectTimeline.jsx'"));
  assert.ok(routeViewSource.includes('<AdvancedProjectTimeline'));

  for (const publicControl of [
    'project-scene-back',
    'manager-flow-source-label',
    'manager-flow-zoom',
    'manager-flow-legend',
    'manager-flow-backend-required-sync',
    'manager-flow-graph',
    'manager-flow-node-',
    'manager-flow-detail-close',
    'timeline-node-metadata-detail',
    'manager-flow-selected-submission-record-open',
    'manager-flow-selected-proof-route-open',
    'flow-open-artifact-',
    'flow-locate-artifact-',
    'flow-open-transcript-',
  ]) {
    assert.ok(timelineSource.includes(publicControl), `complete timeline must keep ${publicControl}`);
  }
});
