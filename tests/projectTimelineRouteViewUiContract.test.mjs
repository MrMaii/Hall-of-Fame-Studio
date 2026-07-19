import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const routeViewUrl = new URL('../src/project/ProjectTimelineRouteView.jsx', import.meta.url);

test('complete Timeline display loads independently while node and proof operations stay in App', () => {
  assert.ok(existsSync(routeViewUrl), 'ProjectTimelineRouteView must exist');
  const routeViewSource = readFileSync(routeViewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./project/ProjectTimelineRouteView.jsx'))"));
  assert.ok(appSource.includes('<ProjectTimelineRouteView'));
  assert.ok(!appSource.includes("lazy(() => import('./project/AdvancedProjectTimeline.jsx'))"));
  assert.ok(!appSource.includes('<AdvancedProjectTimeline'));

  for (const retainedDisplay of [
    'AdvancedProjectTimeline',
    'buildFallbackFlowGraph',
    'managerFlowGraph',
    'visibleNodes',
    'nodeLayout',
    'buildWorkflowTimelineDisplayNodes',
    'planWorkflowTimelineLayout',
    'preserveTimelineViewportAnchor',
    'clampTimelinePan',
    'relationshipGraph',
    'selectedNodeProofMapRoutes',
  ]) {
    assert.ok(routeViewSource.includes(retainedDisplay), `Timeline route view is missing ${retainedDisplay}`);
  }

  for (const retainedAction of [
    'confirmManagerFlowNode',
    'syncBackendManagerFlowGraph',
    'openProjectChatProof',
    'openProjectTimelineProof',
    'submitSelectedTimelineAction',
    'routeDirectorDirective',
  ]) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
  }

  assert.ok(!routeViewSource.includes('fetch('), 'Timeline display must not add direct backend writes');
  assert.ok(!routeViewSource.includes('agentProjectApi'), 'Timeline display must not import the backend API');
});
