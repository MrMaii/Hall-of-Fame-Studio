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
    'manager-flow-zoom-outcome',
    'manager-flow-zoom-phase',
    'manager-flow-zoom-activity',
    'manager-flow-zoom-trace',
    'manager-flow-legend',
    'manager-flow-backend-required-sync',
    'manager-flow-graph',
    'manager-flow-time-axis',
    'manager-flow-fit-view',
    'manager-flow-focus-selected',
    'manager-flow-focus-latest',
    'manager-flow-node-',
    'manager-flow-node-time-',
    'manager-flow-cluster-count-',
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

  assert.ok(timelineSource.includes('handleGraphZoomChange'));
  assert.ok(!timelineSource.includes('parallel commits'), 'unbounded branch copy must be replaced by bounded time density');
  assert.ok(!timelineSource.includes('manager-flow-timeline-lanes'), 'node types already explain what a submission is; the timeline must not repeat them as a y axis');
  assert.ok(!timelineSource.includes('laneGuides'), 'the complete timeline must remain a single temporal axis');
});

test('complete project timeline consumes the shared semantic node protocol and exposes inspectable publication quality', () => {
  for (const sharedProtocolContract of [
    'WORKFLOW_NODE_FAMILIES',
    'WORKFLOW_NODE_FAMILY_ORDER',
    'WORKFLOW_NODE_SCALES',
    'decorateWorkflowNode',
    'workflowNodeVisibleAtScale',
  ]) {
    assert.ok(routeViewSource.includes(sharedProtocolContract), `Timeline route must consume ${sharedProtocolContract}`);
  }

  for (const publicDetail of [
    'manager-flow-semantic-scale-guide',
    'manager-flow-node-logo-',
    'timeline-node-agent-description',
    'timeline-node-submission-quality',
    'timeline-node-authorship-mode',
    'timeline-node-contribution-intent',
    'timeline-node-relationship-graph',
    'timeline-node-attachments',
  ]) {
    assert.ok(timelineSource.includes(publicDetail), `Timeline detail must expose ${publicDetail}`);
  }
});
