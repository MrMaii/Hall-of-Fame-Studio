import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkflowTimelineDisplayNodes,
  centerTimelineNodePan,
  clampTimelinePan,
  fitTimelineCanvasZoom,
  planWorkflowTimelineLayout,
  preserveTimelineViewportAnchor,
} from '../src/workflow/workflowTimelineLayout.js';

const SAME_MINUTE = '2026-07-18T17:21:00.000Z';

const families = [
  'submission',
  'decision',
  'thinking',
  'collaboration',
  'execution',
  'evidence',
];

const denseNodes = Array.from({ length: 120 }, (_, index) => ({
  id: `node-${index}`,
  category: families[index % families.length],
  categoryLabel: families[index % families.length],
  subtype: `subtype-${index}`,
  title: `Commit ${index}`,
  summary: `Commit ${index} summary`,
  commitMessage: `Commit ${index} summary`,
  time: SAME_MINUTE,
  sequence: index,
  status: 'resolved',
  importance: index % 10 === 0 ? 'critical' : 'normal',
  agentId: `agent-${index % 3}`,
  committerIds: [`agent-${index % 3}`],
  proofIds: [`proof-${index}`],
}));

test('phase and outcome views collapse dense same-time work into one time bucket instead of repeating node type on a y axis', () => {
  const phase = buildWorkflowTimelineDisplayNodes({ nodes: denseNodes, scale: 'week' });

  assert.equal(phase.nodes.length, 1);
  assert.equal(phase.memberToDisplayId.size, denseNodes.length);
  assert.ok(phase.nodes.every(node => node.isCluster));
  assert.equal(phase.nodes[0].clusterCount, denseNodes.length);
  assert.equal('timelineLaneId' in phase.nodes[0], false);
});

test('trace layout keeps every node in bounded collision slots around one time axis', () => {
  const trace = buildWorkflowTimelineDisplayNodes({ nodes: denseNodes, scale: 'hour' });
  const layout = planWorkflowTimelineLayout({ nodes: trace.nodes, scale: 'hour', detail: 'expanded' });

  assert.equal(trace.nodes.length, denseNodes.length);
  assert.equal(layout.lanes, undefined);
  assert.ok(Number.isFinite(layout.timeAxisY));
  assert.ok(layout.canvasH <= 1500, `expected bounded canvas height, got ${layout.canvasH}`);
  assert.ok(layout.canvasW <= 5000, `expected wrapped same-time density, got ${layout.canvasW}`);

  const boxes = Object.values(layout.nodeLayout);
  const verticalSlots = new Set(boxes.map(box => box.y));
  assert.ok(verticalSlots.size <= 8, `expected at most eight collision slots, got ${verticalSlots.size}`);
  assert.ok(boxes.every(box => !('laneId' in box)));
  for (let index = 0; index < boxes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < boxes.length; otherIndex += 1) {
      const a = boxes[index];
      const b = boxes[otherIndex];
      const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      assert.equal(overlaps, false, `layout overlap between ${a.nodeId} and ${b.nodeId}`);
    }
  }
});

test('later timestamps never drift farther away from the single time axis', () => {
  const nodes = Array.from({ length: 32 }, (_, index) => ({
    ...denseNodes[index],
    id: `timed-${index}`,
    time: new Date(Date.parse('2026-07-18T08:00:00.000Z') + index * 60 * 60 * 1000).toISOString(),
  }));
  const trace = buildWorkflowTimelineDisplayNodes({ nodes, scale: 'hour' });
  const layout = planWorkflowTimelineLayout({ nodes: trace.nodes, scale: 'hour', detail: 'medium' });
  const distances = Object.values(layout.nodeLayout).map(box => Math.abs((box.y + box.h / 2) - layout.timeAxisY));

  assert.ok(Math.max(...distances) <= 4 * layout.nodeHeight + 96);
  assert.ok(distances.at(-1) <= Math.max(...distances.slice(0, 4)));
});

test('time moves left-to-right and every node keeps an inspectable timestamp', () => {
  const nodes = [
    { ...denseNodes[0], id: 'early', time: '2026-07-18T09:05:00.000Z' },
    { ...denseNodes[1], id: 'late', time: '2026-07-18T11:35:00.000Z' },
  ];
  const trace = buildWorkflowTimelineDisplayNodes({ nodes, scale: 'hour' });
  const layout = planWorkflowTimelineLayout({ nodes: trace.nodes, scale: 'hour', detail: 'expanded' });

  assert.ok(layout.nodeLayout.early.x < layout.nodeLayout.late.x);
  assert.equal(layout.nodeLayout.early.timestamp, nodes[0].time);
  assert.equal(layout.nodeLayout.late.timestamp, nodes[1].time);
  assert.deepEqual(layout.timeTicks.map(tick => tick.dateLabel), ['2026-07-18', '2026-07-18']);
  assert.deepEqual(layout.timeTicks.map(tick => tick.timeLabel), ['09:00', '11:00']);
});

test('zoom preserves its chosen viewport anchor and clamping cannot leave an empty canvas', () => {
  const viewportPoint = { x: 620, y: 360 };
  const worldPoint = { x: 1840, y: 650 };
  const nextZoom = 1.72;
  const anchoredPan = preserveTimelineViewportAnchor({ worldPoint, viewportPoint, zoom: nextZoom });

  assert.equal(anchoredPan.x + worldPoint.x * nextZoom, viewportPoint.x);
  assert.equal(anchoredPan.y + worldPoint.y * nextZoom, viewportPoint.y);

  const clamped = clampTimelinePan({
    pan: { x: -99999, y: 99999 },
    zoom: 1,
    canvas: { width: 2400, height: 1600 },
    viewport: { width: 1200, height: 700 },
    padding: 72,
  });
  assert.ok(clamped.x >= 1200 - 2400 - 72);
  assert.ok(clamped.x <= 72);
  assert.ok(clamped.y >= 700 - 1600 - 72);
  assert.ok(clamped.y <= 72);

  const centered = centerTimelineNodePan({
    box: { x: 900, y: 420, w: 280, h: 140 },
    viewport: { width: 1200, height: 700 },
    zoom: 1.25,
  });
  assert.equal(centered.x + (900 + 140) * 1.25, 600);
  assert.equal(centered.y + (420 + 70) * 1.25, 350);

  assert.equal(fitTimelineCanvasZoom({
    canvas: { width: 2400, height: 1200 },
    viewport: { width: 1200, height: 700 },
    padding: 80,
    minZoom: 0.2,
    maxZoom: 1,
  }), 0.43333333333333335);
});
