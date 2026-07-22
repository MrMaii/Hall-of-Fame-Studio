import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWorkflowTimelineCurvePath,
  buildWorkflowTimelineDisplayNodes,
  buildWorkflowTimelineStemPath,
  centerTimelineNodePan,
  clampTimelinePan,
  fitTimelineCanvasZoom,
  planWorkflowTimelineLayout,
  selectWorkflowTimelineBoundaryNode,
  preserveTimelineViewportAnchor,
  reprojectTimelineWorldPoint,
  timelineAxisCenteredPanY,
  timelinePanXForTimestamp,
  timelinePixelsPerMinuteForDensity,
  timelineTimestampAtViewportX,
} from '../src/workflow/workflowTimelineLayout.js';

test('timeline boundary selection is chronological and deterministic', () => {
  const nodes = [
    { id: 'middle', time: '2026-07-18T10:00:00.000Z', sequence: 2 },
    { id: 'latest-lower-sequence', time: '2026-07-18T11:00:00.000Z', sequence: 1 },
    { id: 'first', time: '2026-07-18T09:00:00.000Z', sequence: 9 },
    { id: 'latest', time: '2026-07-18T11:00:00.000Z', sequence: 4 },
  ];
  assert.equal(selectWorkflowTimelineBoundaryNode(nodes, 'first').id, 'first');
  assert.equal(selectWorkflowTimelineBoundaryNode(nodes, 'latest').id, 'latest');
  assert.equal(selectWorkflowTimelineBoundaryNode([], 'latest'), null);
});

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

test('real timestamps determine arbitrary x coordinates and earlier density cannot push later time anchors', () => {
  const baseNodes = [
    { ...denseNodes[0], id: 'early', time: '2026-07-18T09:00:00.000Z' },
    { ...denseNodes[1], id: 'middle', time: '2026-07-18T09:17:00.000Z' },
    { ...denseNodes[2], id: 'late', time: '2026-07-18T10:00:00.000Z' },
  ];
  const base = planWorkflowTimelineLayout({ nodes: baseNodes, scale: 'hour', detail: 'expanded' });
  const denseEarlierTime = Array.from({ length: 18 }, (_, index) => ({
    ...denseNodes[index],
    id: `same-early-${index}`,
    time: baseNodes[0].time,
  }));
  const withEarlierDensity = planWorkflowTimelineLayout({
    nodes: [...baseNodes, ...denseEarlierTime],
    scale: 'hour',
    detail: 'expanded',
  });

  assert.equal(withEarlierDensity.nodeLayout.late.timeAnchorX, base.nodeLayout.late.timeAnchorX);
  const elapsedRatio = (
    (base.nodeLayout.middle.timeAnchorX - base.nodeLayout.early.timeAnchorX)
    / (base.nodeLayout.late.timeAnchorX - base.nodeLayout.early.timeAnchorX)
  );
  assert.ok(Math.abs(elapsedRatio - (17 / 60)) < 0.001, `expected a real-time ratio, got ${elapsedRatio}`);
});

test('timeline density stretches real time horizontally without changing node or line geometry size', () => {
  const nodes = [
    { ...denseNodes[0], id: 'start', time: '2026-07-18T09:00:00.000Z' },
    { ...denseNodes[1], id: 'finish', time: '2026-07-18T09:20:00.000Z' },
  ];
  const coarse = planWorkflowTimelineLayout({ nodes, scale: 'month', detail: 'medium', timeDensity: 0.68 });
  const fine = planWorkflowTimelineLayout({ nodes, scale: 'hour', detail: 'medium', timeDensity: 1.68 });
  const coarseDistance = coarse.nodeLayout.finish.timeAnchorX - coarse.nodeLayout.start.timeAnchorX;
  const fineDistance = fine.nodeLayout.finish.timeAnchorX - fine.nodeLayout.start.timeAnchorX;

  assert.deepEqual(
    { width: coarse.nodeWidth, height: coarse.nodeHeight },
    { width: fine.nodeWidth, height: fine.nodeHeight },
  );
  assert.deepEqual(
    { width: coarse.nodeLayout.start.w, height: coarse.nodeLayout.start.h },
    { width: fine.nodeLayout.start.w, height: fine.nodeLayout.start.h },
  );
  assert.ok(fineDistance > coarseDistance * 10, `${fineDistance} must substantially exceed ${coarseDistance}`);
  assert.ok(Math.abs(
    fineDistance / coarseDistance
    - timelinePixelsPerMinuteForDensity(1.68) / timelinePixelsPerMinuteForDensity(0.68)
  ) < 1e-9);
});

test('time-density changes keep the timestamp under the pointer fixed in viewport pixels', () => {
  const nodes = [
    { ...denseNodes[0], id: 'start', time: '2026-07-18T09:00:00.000Z' },
    { ...denseNodes[1], id: 'finish', time: '2026-07-18T10:00:00.000Z' },
  ];
  const coarse = planWorkflowTimelineLayout({ nodes, scale: 'day', detail: 'medium', timeDensity: 1 });
  const fine = planWorkflowTimelineLayout({ nodes, scale: 'hour', detail: 'medium', timeDensity: 1.8 });
  const viewportX = 640;
  const coarsePanX = -420;
  const anchoredTimestamp = timelineTimestampAtViewportX({ layout: coarse, panX: coarsePanX, viewportX });
  const finePanX = timelinePanXForTimestamp({ layout: fine, timestamp: anchoredTimestamp, viewportX });

  assert.equal(timelineTimestampAtViewportX({ layout: fine, panX: finePanX, viewportX }), anchoredTimestamp);
});

test('the main time axis stays at the vertical center of the viewport after entry and resize', () => {
  const timeAxisY = 820;
  const entryPanY = timelineAxisCenteredPanY({ timeAxisY, viewportHeight: 900 });
  const resizedPanY = timelineAxisCenteredPanY({ timeAxisY, viewportHeight: 1200 });

  assert.equal(entryPanY, -370);
  assert.equal(timeAxisY + entryPanY, 450);
  assert.equal(resizedPanY, -220);
  assert.equal(timeAxisY + resizedPanY, 600);
});

test('semantic scales retain eligible commits as inspectable nodes instead of collapsing a whole time bucket into one card', () => {
  const eligibleNodes = denseNodes.slice(0, 6).map((node, index) => ({
    ...node,
    time: `2026-07-18T09:${String(index * 5).padStart(2, '0')}:00.000Z`,
  }));

  for (const scale of ['month', 'week', 'day', 'hour']) {
    const display = buildWorkflowTimelineDisplayNodes({ nodes: eligibleNodes, scale });
    assert.deepEqual(display.nodes.map(node => node.id), eligibleNodes.map(node => node.id));
    assert.ok(display.nodes.every(node => node.isCluster === false && node.clusterCount === 1));
    assert.deepEqual([...display.memberToDisplayId.entries()], eligibleNodes.map(node => [node.id, node.id]));
  }
});

test('dense nearby commits stay inside the viewport and expose the remainder through overflow markers', () => {
  const viewportHeight = 900;
  const nearbyNodes = denseNodes.slice(0, 24).map((node, index) => ({
    ...node,
    time: new Date(Date.parse(SAME_MINUTE) + index * 2_000).toISOString(),
  }));
  const layout = planWorkflowTimelineLayout({
    nodes: nearbyNodes,
    scale: 'hour',
    detail: 'medium',
    timeDensity: 1.44,
    viewportHeight,
  });

  assert.ok(layout.maxRowsPerSide >= 1 && layout.maxRowsPerSide <= 3);
  assert.ok(layout.overflowGroups.length > 0);
  const viewportTop = layout.timeAxisY - viewportHeight / 2;
  const viewportBottom = layout.timeAxisY + viewportHeight / 2;
  const boxes = Object.values(layout.nodeLayout);
  assert.ok(boxes.length < nearbyNodes.length);
  assert.ok(boxes.every(box => box.y >= viewportTop && box.y + box.h <= viewportBottom));

  const accountedNodeIds = new Set([
    ...Object.keys(layout.nodeLayout),
    ...layout.overflowGroups.flatMap(group => group.nodeIds),
  ]);
  assert.deepEqual([...accountedNodeIds].sort(), nearbyNodes.map(node => node.id).sort());
  assert.ok(layout.overflowGroups.every(group => group.count === group.nodeIds.length && group.count > 0));
});

test('opening an overflow marker reveals its real nodes without adding vertical rows', () => {
  const viewportHeight = 900;
  const nearbyNodes = denseNodes.slice(0, 24).map((node, index) => ({
    ...node,
    time: new Date(Date.parse(SAME_MINUTE) + index * 2_000).toISOString(),
  }));
  const collapsed = planWorkflowTimelineLayout({
    nodes: nearbyNodes,
    scale: 'hour',
    detail: 'medium',
    timeDensity: 1.44,
    viewportHeight,
  });
  const target = collapsed.overflowGroups[0];
  const expanded = planWorkflowTimelineLayout({
    nodes: nearbyNodes,
    scale: 'hour',
    detail: 'medium',
    timeDensity: 1.44,
    viewportHeight,
    expandedOverflowGroupId: target.id,
  });

  assert.equal(expanded.expandedOverflowGroup.id, target.id);
  assert.ok(target.nodeIds.every(nodeId => expanded.nodeLayout[nodeId]));
  assert.equal(expanded.maxRowsPerSide, collapsed.maxRowsPerSide);
  const viewportTop = expanded.timeAxisY - viewportHeight / 2;
  const viewportBottom = expanded.timeAxisY + viewportHeight / 2;
  assert.ok(Object.values(expanded.nodeLayout).every(box => (
    box.y >= viewportTop && box.y + box.h <= viewportBottom
  )));
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
  assert.deepEqual(layout.timeTicks.map(tick => tick.timeLabel), ['09:05', '11:35']);
});

test('dense real-time data uses readable adaptive axis ticks instead of one table column label per commit', () => {
  const start = Date.parse('2026-07-18T08:00:00.000Z');
  const nodes = Array.from({ length: 180 }, (_, index) => ({
    ...denseNodes[index % denseNodes.length],
    id: `minute-${index}`,
    time: new Date(start + index * 60_000).toISOString(),
  }));
  const layout = planWorkflowTimelineLayout({ nodes, scale: 'day', detail: 'medium' });

  assert.ok(layout.timeTicks.length < 30, `expected a readable tick count, got ${layout.timeTicks.length}`);
  assert.equal(layout.timeTicks.reduce((sum, tick) => sum + tick.count, 0), nodes.length);
  assert.ok(layout.timeTicks.every((tick, index) => index === 0 || tick.x > layout.timeTicks[index - 1].x));
});

test('timeline relationships and time branches are curved paths anchored to real node positions', () => {
  const above = { x: 240, y: 80, w: 224, h: 108, timeAnchorX: 352, branchSide: 'above' };
  const below = { x: 780, y: 440, w: 224, h: 108, timeAnchorX: 892, branchSide: 'below' };
  const relationship = buildWorkflowTimelineCurvePath({ fromBox: above, toBox: below });
  const aboveStem = buildWorkflowTimelineStemPath({ box: above, timeAxisY: 350 });
  const belowStem = buildWorkflowTimelineStemPath({ box: below, timeAxisY: 350 });

  for (const path of [relationship.path, aboveStem.path, belowStem.path]) {
    assert.match(path, /^M\s/);
    assert.match(path, /\sC\s/);
    assert.doesNotMatch(path, /\s[HV]\s/);
    assert.doesNotMatch(path, /NaN|undefined/);
  }
  assert.deepEqual({ x: aboveStem.sx, y: aboveStem.sy }, { x: above.timeAnchorX, y: 350 });
  assert.equal(aboveStem.ey, above.y + above.h);
  assert.equal(belowStem.ey, below.y);
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

test('semantic layout changes preserve the same real-time point and distance from the main axis', () => {
  const fromLayout = {
    xOffset: 260,
    timeAxisY: 420,
    timeScale: { minimumTime: Date.parse('2026-07-18T09:00:00.000Z'), pixelsPerMillisecond: 0.002 },
  };
  const toLayout = {
    xOffset: 210,
    timeAxisY: 680,
    timeScale: { minimumTime: Date.parse('2026-07-18T08:30:00.000Z'), pixelsPerMillisecond: 0.0005 },
  };
  const timestamp = Date.parse('2026-07-18T09:17:00.000Z');
  const worldPoint = {
    x: fromLayout.xOffset + (timestamp - fromLayout.timeScale.minimumTime) * fromLayout.timeScale.pixelsPerMillisecond,
    y: fromLayout.timeAxisY - 165,
  };
  const reprojected = reprojectTimelineWorldPoint({ worldPoint, fromLayout, toLayout });

  assert.equal(reprojected.x, toLayout.xOffset + (timestamp - toLayout.timeScale.minimumTime) * toLayout.timeScale.pixelsPerMillisecond);
  assert.equal(reprojected.y - toLayout.timeAxisY, -165);
});
