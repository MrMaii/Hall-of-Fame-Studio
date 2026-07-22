import { workflowNodeTimeBucket } from './workflowNodeProtocol.js';

const importanceRank = { minor: 0, normal: 1, major: 2, critical: 3 };
const timePixelsPerMinute = { month: 0.45, week: 1.5, day: 6, hour: 24 };
const timeDensityAnchors = [
  { density: 0.36, pixelsPerMinute: 0.2 },
  { density: 0.68, pixelsPerMinute: 0.45 },
  { density: 0.88, pixelsPerMinute: 1.5 },
  { density: 1, pixelsPerMinute: 3.4 },
  { density: 1.2, pixelsPerMinute: 6 },
  { density: 1.68, pixelsPerMinute: 24 },
  { density: 2.2, pixelsPerMinute: 64 },
];

export function timelinePixelsPerMinuteForDensity(value = 1) {
  const density = Math.min(2.2, Math.max(0.36, Number(value) || 1));
  const upperIndex = timeDensityAnchors.findIndex(anchor => anchor.density >= density);
  if (upperIndex <= 0) return timeDensityAnchors[0].pixelsPerMinute;
  const upper = timeDensityAnchors[upperIndex];
  const lower = timeDensityAnchors[upperIndex - 1];
  const progress = (density - lower.density) / (upper.density - lower.density);
  const lowerLog = Math.log(lower.pixelsPerMinute);
  const upperLog = Math.log(upper.pixelsPerMinute);
  return Math.exp(lowerLog + (upperLog - lowerLog) * progress);
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean).map(value => String(value))));
}

function safeClusterId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function clusterStatus(nodes) {
  if (nodes.some(node => node.status === 'blocked')) return 'blocked';
  if (nodes.every(node => ['confirmed', 'resolved', 'completed'].includes(node.status))) return 'resolved';
  return nodes.at(-1)?.status || 'active';
}

function clusterImportance(nodes) {
  return nodes.reduce((current, node) => (
    (importanceRank[node.importance] || 0) > (importanceRank[current] || 0) ? node.importance : current
  ), 'normal');
}

export function buildWorkflowTimelineDisplayNodes({ nodes = [], scale = 'day' } = {}) {
  const sortedNodes = [...nodes].sort((a, b) => {
    const timeDifference = (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0);
    return timeDifference || (a.sequence || 0) - (b.sequence || 0) || String(a.id).localeCompare(String(b.id));
  });
  const memberToDisplayId = new Map();

  if (['month', 'week', 'day', 'hour'].includes(scale)) {
    const displayNodes = sortedNodes.map((node) => {
      const displayNode = {
        ...node,
        clusterCount: 1,
        clusterMemberIds: [node.id],
        isCluster: false,
      };
      memberToDisplayId.set(node.id, node.id);
      return displayNode;
    });
    return { nodes: displayNodes, memberToDisplayId };
  }

  const groups = new Map();
  sortedNodes.forEach((node) => {
    const bucket = workflowNodeTimeBucket(node, scale);
    if (!groups.has(bucket)) groups.set(bucket, { bucket, nodes: [] });
    groups.get(bucket).nodes.push(node);
  });

  const displayNodes = [...groups.values()].map((group) => {
    const members = group.nodes;
    if (members.length === 1) {
      const node = {
        ...members[0],
        clusterCount: 1,
        clusterMemberIds: [members[0].id],
        isCluster: false,
        timeBucket: group.bucket,
      };
      memberToDisplayId.set(node.id, node.id);
      return node;
    }

    const representative = [...members].sort((a, b) => (
      (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0)
      || (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0)
      || (b.sequence || 0) - (a.sequence || 0)
    ))[0];
    const latest = members.at(-1);
    const id = `timeline-cluster-${scale}-${safeClusterId(group.bucket)}`;
    const cluster = {
      ...representative,
      id,
      title: `${members.length} commits in this time period`,
      summary: `${members.length} commits are grouped in this time period. Latest: ${latest.commitMessage || latest.summary || latest.title}`,
      commitMessage: `${members.length} commits · ${latest.commitMessage || latest.summary || latest.title}`,
      subtype: `${scale}-commit-cluster`,
      time: latest.time || group.bucket,
      timeStart: members[0].time || group.bucket,
      timeEnd: latest.time || group.bucket,
      timeBucket: group.bucket,
      clusterCount: members.length,
      clusterCategories: unique(members.map(node => node.category)),
      clusterMemberIds: members.map(node => node.id),
      isCluster: true,
      committerIds: unique(members.flatMap(node => [node.agentId, ...(node.committerIds || []), ...(node.coAuthorIds || [])])),
      coAuthorIds: unique(members.flatMap(node => node.coAuthorIds || [])),
      participantIds: unique(members.flatMap(node => node.participantIds || [])),
      proofIds: unique(members.flatMap(node => node.proofIds || [])),
      timelineLogIds: unique(members.flatMap(node => node.timelineLogIds || [])),
      eventIds: unique(members.flatMap(node => node.eventIds || [])),
      attachments: members.flatMap(node => node.attachments || []).slice(0, 12),
      status: clusterStatus(members),
      importance: clusterImportance(members),
    };
    members.forEach(node => memberToDisplayId.set(node.id, id));
    return cluster;
  });

  return { nodes: displayNodes, memberToDisplayId };
}

export function selectWorkflowTimelineBoundaryNode(nodes = [], boundary = 'latest') {
  const direction = boundary === 'first' ? 1 : -1;
  return [...nodes].sort((a, b) => {
    const timeDifference = ((Date.parse(a?.time) || 0) - (Date.parse(b?.time) || 0)) * direction;
    if (timeDifference) return timeDifference;
    const sequenceDifference = ((Number(a?.sequence) || 0) - (Number(b?.sequence) || 0)) * direction;
    if (sequenceDifference) return sequenceDifference;
    return String(a?.id || '').localeCompare(String(b?.id || '')) * direction;
  })[0] || null;
}

function nodeDimensions(detail) {
  if (detail === 'expanded') return { width: 292, height: 144 };
  if (detail === 'medium') return { width: 260, height: 126 };
  return { width: 224, height: 108 };
}

function isoTickLabels(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { dateLabel: String(value || 'No date'), timeLabel: '' };
  return {
    dateLabel: parsed.toISOString().slice(0, 10),
    timeLabel: parsed.toISOString().slice(11, 16),
  };
}

function adaptiveTimeTicks(columns, { minimumTime, pixelsPerMillisecond }) {
  if (columns.length <= 12) {
    return columns.map(column => ({
      key: column.key,
      x: column.centerX,
      count: column.count,
      ...isoTickLabels(column.key),
    }));
  }
  const parsedTimes = columns.map(column => Date.parse(column.key)).filter(Number.isFinite);
  const maximumTime = parsedTimes.length ? Math.max(...parsedTimes) : minimumTime;
  const span = Math.max(0, maximumTime - minimumTime);
  const minimumStep = Math.max(180 / pixelsPerMillisecond, span / 23);
  const minute = 60_000;
  const candidates = [
    minute, 5 * minute, 15 * minute, 30 * minute,
    60 * minute, 3 * 60 * minute, 6 * 60 * minute, 12 * 60 * minute,
    24 * 60 * minute, 2 * 24 * 60 * minute, 7 * 24 * 60 * minute,
    14 * 24 * 60 * minute, 30 * 24 * 60 * minute, 90 * 24 * 60 * minute,
    365 * 24 * 60 * minute,
  ];
  const step = candidates.find(candidate => candidate >= minimumStep) || candidates.at(-1);
  const buckets = new Map();
  columns.forEach((column) => {
    const parsedTime = Date.parse(column.key);
    const bucketTime = Number.isFinite(parsedTime)
      ? minimumTime + Math.floor((parsedTime - minimumTime) / step) * step
      : minimumTime;
    buckets.set(bucketTime, (buckets.get(bucketTime) || 0) + column.count);
  });
  return [...buckets.entries()].map(([time, count]) => {
    const key = new Date(time).toISOString();
    return {
      key,
      x: columns[0].centerX + (time - minimumTime) * pixelsPerMillisecond,
      count,
      ...isoTickLabels(key),
    };
  });
}

export function planWorkflowTimelineLayout({
  nodes = [],
  scale = 'day',
  detail = 'medium',
  timeDensity,
  viewportHeight = 920,
  expandedOverflowGroupId = null,
  pinnedNodeIds = [],
} = {}) {
  const { width: nodeWidth, height: nodeHeight } = nodeDimensions(detail);
  const rowGap = detail === 'compact' ? 14 : 18;
  const nodeGap = detail === 'compact' ? 14 : 18;
  const timeGap = detail === 'expanded' ? 104 : detail === 'medium' ? 92 : 80;
  const axisGap = 40;
  const horizontalStride = nodeWidth + nodeGap;
  const xOffset = 160 + nodeWidth / 2 + horizontalStride;

  const groupedByTime = new Map();
  nodes.forEach((node) => {
    const rawTime = node.time || node.submittedAt || node.createdAt || node.updatedAt;
    const parsedTime = Date.parse(rawTime);
    const key = Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : String(rawTime || node.id || 'unscheduled');
    if (!groupedByTime.has(key)) groupedByTime.set(key, []);
    groupedByTime.get(key).push(node);
  });

  const columns = [...groupedByTime.entries()]
    .map(([key, columnNodes]) => ({
      key,
      time: key,
      nodes: [...columnNodes].sort((a, b) => (
        (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0)
        || (a.sequence || 0) - (b.sequence || 0)
      )),
    }))
    .sort((a, b) => (Date.parse(a.key) || 0) - (Date.parse(b.key) || 0) || a.key.localeCompare(b.key));

  const parsedColumnTimes = columns.map(column => Date.parse(column.key)).filter(Number.isFinite);
  const minimumTime = parsedColumnTimes.length ? Math.min(...parsedColumnTimes) : 0;
  const pixelsPerMinute = Number.isFinite(Number(timeDensity))
    ? timelinePixelsPerMinuteForDensity(timeDensity)
    : (timePixelsPerMinute[scale] || timePixelsPerMinute.day);
  const pixelsPerMillisecond = pixelsPerMinute / 60_000;
  let fallbackColumnCursor = xOffset;
  const timeColumnLayouts = columns.map((column) => {
    const parsedTime = Date.parse(column.key);
    const centerX = Number.isFinite(parsedTime)
      ? xOffset + (parsedTime - minimumTime) * pixelsPerMillisecond
      : fallbackColumnCursor;
    const layout = {
      ...column,
      x: centerX - nodeWidth / 2,
      width: nodeWidth,
      centerX,
      count: column.nodes.reduce((sum, node) => sum + (node.clusterCount || 1), 0),
    };
    fallbackColumnCursor = Math.max(fallbackColumnCursor, layout.x + nodeWidth + timeGap);
    return layout;
  });

  const columnByNodeId = new Map(timeColumnLayouts.flatMap(column => (
    column.nodes.map(node => [node.id, column])
  )));
  const resolvedViewportHeight = Number.isFinite(Number(viewportHeight)) && Number(viewportHeight) >= 320
    ? Number(viewportHeight)
    : 920;
  const verticalPadding = 12;
  const maxRowsPerSide = Math.max(1, Math.min(3, Math.floor(
    (resolvedViewportHeight / 2 - verticalPadding - axisGap + rowGap) / (nodeHeight + rowGap),
  )));
  const maximumSlots = maxRowsPerSide * 2;
  const pinnedIds = new Set((pinnedNodeIds || []).filter(Boolean).map(String));
  const placementPriority = (expandedIds = new Set()) => [...nodes].sort((a, b) => (
    Number(expandedIds.has(String(b.id))) - Number(expandedIds.has(String(a.id)))
    || Number(pinnedIds.has(String(b.id))) - Number(pinnedIds.has(String(a.id)))
    || (a.semanticLevel ?? 2) - (b.semanticLevel ?? 2)
    || (importanceRank[b.importance] || 0) - (importanceRank[a.importance] || 0)
    || (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0)
    || (a.sequence || 0) - (b.sequence || 0)
    || String(a.id).localeCompare(String(b.id))
  ));
  const horizontalOffsets = (expanded, expandedSteps) => {
    const offsets = [0, horizontalStride, -horizontalStride];
    if (expanded) {
      for (let step = 2; step <= expandedSteps; step += 1) offsets.push(step * horizontalStride);
    }
    return offsets;
  };
  const placeNodes = ({ expandedIds = new Set(), expandedSteps = 1 } = {}) => {
    const slotIntervals = Array.from({ length: maximumSlots }, () => []);
    const placements = new Map();
    const hiddenNodes = [];
    placementPriority(expandedIds).forEach((node) => {
      const column = columnByNodeId.get(node.id);
      if (!column) return;
      let placement = null;
      for (const offset of horizontalOffsets(expandedIds.has(String(node.id)), expandedSteps)) {
        const left = column.centerX - nodeWidth / 2 + offset;
        const right = left + nodeWidth;
        const collisionSlot = slotIntervals.findIndex(intervals => intervals.every(interval => (
          right + nodeGap <= interval.left || left >= interval.right + nodeGap
        )));
        if (collisionSlot === -1) continue;
        placement = { collisionSlot, left };
        slotIntervals[collisionSlot].push({ left, right });
        break;
      }
      if (placement) placements.set(node.id, placement);
      else hiddenNodes.push(node);
    });
    return { hiddenNodes, placements };
  };
  const overflowGroupsFor = (hiddenNodes, timeAxisY) => {
    const hiddenEntries = hiddenNodes.map(node => ({
      node,
      anchorX: columnByNodeId.get(node.id)?.centerX ?? xOffset,
    })).sort((a, b) => a.anchorX - b.anchorX || String(a.node.id).localeCompare(String(b.node.id)));
    const groups = [];
    hiddenEntries.forEach((entry) => {
      const latestGroup = groups.at(-1);
      if (!latestGroup || entry.anchorX - latestGroup.lastAnchorX > horizontalStride) {
        groups.push({ entries: [entry], lastAnchorX: entry.anchorX });
        return;
      }
      latestGroup.entries.push(entry);
      latestGroup.lastAnchorX = entry.anchorX;
    });
    return groups.map(({ entries }) => {
      const first = entries[0];
      const last = entries.at(-1);
      const timeAnchorX = entries.reduce((sum, entry) => sum + entry.anchorX, 0) / entries.length;
      const nodeIds = entries.map(entry => entry.node.id);
      return {
        id: `timeline-overflow-${safeClusterId(first.node.id)}-${safeClusterId(last.node.id)}`,
        count: nodeIds.length,
        nodeIds,
        timeAnchorX,
        timeStart: first.node.time,
        timeEnd: last.node.time,
        x: timeAnchorX - 48,
        y: timeAxisY - 14,
        w: 96,
        h: 28,
        expanded: false,
      };
    });
  };
  const branchHeight = depth => depth > 0 ? depth * nodeHeight + (depth - 1) * rowGap : 0;
  const timeAxisY = verticalPadding + branchHeight(maxRowsPerSide) + axisGap;
  const basePlacement = placeNodes();
  const baseOverflowGroups = overflowGroupsFor(basePlacement.hiddenNodes, timeAxisY);
  const expandedOverflowGroup = baseOverflowGroups.find(group => group.id === expandedOverflowGroupId) || null;
  const expandedIds = new Set(expandedOverflowGroup?.nodeIds.map(String) || []);
  const finalPlacement = expandedOverflowGroup
    ? placeNodes({ expandedIds, expandedSteps: Math.max(2, expandedOverflowGroup.count) })
    : basePlacement;
  const currentOverflowGroups = overflowGroupsFor(finalPlacement.hiddenNodes, timeAxisY)
    .filter(group => !group.nodeIds.some(nodeId => expandedIds.has(String(nodeId))));
  const overflowGroups = expandedOverflowGroup
    ? [...currentOverflowGroups, { ...expandedOverflowGroup, expanded: true }]
    : currentOverflowGroups;

  const nodeLayout = {};
  timeColumnLayouts.forEach((column, timeColumnIndex) => {
    column.nodes.forEach((node) => {
      const placement = finalPlacement.placements.get(node.id);
      if (!placement) return;
      const { collisionSlot, left } = placement;
      const branchDepth = Math.floor(collisionSlot / 2) + 1;
      const branchSide = collisionSlot % 2 === 0 ? 'above' : 'below';
      const y = branchSide === 'above'
        ? timeAxisY - axisGap - nodeHeight - (branchDepth - 1) * (nodeHeight + rowGap)
        : timeAxisY + axisGap + (branchDepth - 1) * (nodeHeight + rowGap);
      nodeLayout[node.id] = {
        nodeId: node.id,
        x: left,
        y,
        w: nodeWidth,
        h: nodeHeight,
        timestamp: node.time,
        timeAnchorX: column.centerX,
        branchDepth,
        branchSide,
        collisionSlot,
        timeColumnIndex,
      };
    });
  });

  const timeTicks = adaptiveTimeTicks(timeColumnLayouts, { minimumTime, pixelsPerMillisecond });
  const canvasW = Math.max(
    1280,
    ...Object.values(nodeLayout).map(box => box.x + box.w + 80),
    ...overflowGroups.map(group => group.x + group.w + 80),
  );
  const canvasH = Math.max(760, timeAxisY + axisGap + branchHeight(maxRowsPerSide) + verticalPadding);
  const collisionSlotYs = [...new Set(Object.values(nodeLayout).map(box => box.y))].sort((a, b) => a - b);

  return {
    canvasH,
    canvasW,
    collisionSlotYs,
    expandedOverflowGroup,
    maxCollisionSlots: maximumSlots,
    maxRowsPerSide,
    nodeHeight,
    nodeLayout,
    nodeWidth,
    overflowGroups,
    timeAxisY,
    timeColumnLayouts,
    timeTicks,
    timeScale: { minimumTime, pixelsPerMillisecond },
    xOffset,
  };
}

export function timelineTimestampAtViewportX({ layout, panX = 0, viewportX = 0 } = {}) {
  const timeScale = layout?.timeScale;
  if (!Number.isFinite(timeScale?.minimumTime) || !Number.isFinite(timeScale?.pixelsPerMillisecond) || timeScale.pixelsPerMillisecond <= 0) return null;
  return timeScale.minimumTime + ((viewportX - panX) - layout.xOffset) / timeScale.pixelsPerMillisecond;
}

export function timelinePanXForTimestamp({ layout, timestamp, viewportX = 0 } = {}) {
  const timeScale = layout?.timeScale;
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp) || !Number.isFinite(timeScale?.minimumTime) || !Number.isFinite(timeScale?.pixelsPerMillisecond) || timeScale.pixelsPerMillisecond <= 0) return 0;
  const worldX = layout.xOffset + (parsedTimestamp - timeScale.minimumTime) * timeScale.pixelsPerMillisecond;
  return viewportX - worldX;
}

export function buildWorkflowTimelineCurvePath({ fromBox, toBox } = {}) {
  if (!fromBox || !toBox) return null;
  const fromCenterX = fromBox.x + fromBox.w / 2;
  const toCenterX = toBox.x + toBox.w / 2;
  const forward = toCenterX >= fromCenterX;
  const sx = forward ? fromBox.x + fromBox.w : fromBox.x;
  const sy = fromBox.y + fromBox.h / 2;
  const ex = forward ? toBox.x : toBox.x + toBox.w;
  const ey = toBox.y + toBox.h / 2;
  const horizontalDistance = Math.abs(ex - sx);
  const curveReach = Math.max(56, horizontalDistance * 0.42);
  const direction = forward ? 1 : -1;
  const c1x = sx + curveReach * direction;
  const c2x = ex - curveReach * direction;
  return { sx, sy, ex, ey, path: `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ey}, ${ex} ${ey}` };
}

export function buildWorkflowTimelineStemPath({ box, timeAxisY } = {}) {
  if (!box || !Number.isFinite(timeAxisY)) return null;
  const sx = Number.isFinite(box.timeAnchorX) ? box.timeAnchorX : box.x + box.w / 2;
  const sy = timeAxisY;
  const ex = box.x + box.w / 2;
  const ey = box.branchSide === 'below' ? box.y : box.y + box.h;
  const verticalDistance = Math.abs(ey - sy);
  const curveReach = Math.max(24, verticalDistance * 0.45);
  const direction = ey >= sy ? 1 : -1;
  const c1y = sy + curveReach * direction;
  const c2y = ey - curveReach * direction;
  return { sx, sy, ex, ey, path: `M ${sx} ${sy} C ${sx} ${c1y}, ${ex} ${c2y}, ${ex} ${ey}` };
}

export function preserveTimelineViewportAnchor({ worldPoint, viewportPoint, zoom }) {
  return {
    x: viewportPoint.x - worldPoint.x * zoom,
    y: viewportPoint.y - worldPoint.y * zoom,
  };
}

export function reprojectTimelineWorldPoint({ worldPoint, fromLayout, toLayout } = {}) {
  const fromScale = fromLayout?.timeScale;
  const toScale = toLayout?.timeScale;
  if (
    !worldPoint
    || !Number.isFinite(fromScale?.minimumTime)
    || !Number.isFinite(fromScale?.pixelsPerMillisecond)
    || fromScale.pixelsPerMillisecond <= 0
    || !Number.isFinite(toScale?.minimumTime)
    || !Number.isFinite(toScale?.pixelsPerMillisecond)
    || toScale.pixelsPerMillisecond <= 0
  ) return worldPoint;
  const timestamp = fromScale.minimumTime + (worldPoint.x - fromLayout.xOffset) / fromScale.pixelsPerMillisecond;
  return {
    x: toLayout.xOffset + (timestamp - toScale.minimumTime) * toScale.pixelsPerMillisecond,
    y: toLayout.timeAxisY + (worldPoint.y - fromLayout.timeAxisY),
  };
}

export function centerTimelineNodePan({ box, viewport, zoom }) {
  if (!box || !viewport) return { x: 0, y: 0 };
  return preserveTimelineViewportAnchor({
    worldPoint: { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    viewportPoint: { x: viewport.width / 2, y: viewport.height / 2 },
    zoom,
  });
}

export function timelineAxisCenteredPanY({ timeAxisY, viewportHeight } = {}) {
  if (!Number.isFinite(timeAxisY) || !Number.isFinite(viewportHeight)) return 0;
  return viewportHeight / 2 - timeAxisY;
}

export function clampTimelinePan({ pan, zoom, canvas, viewport, padding = 72 }) {
  if (!canvas || !viewport || !Number.isFinite(zoom) || zoom <= 0) return pan;
  const clampAxis = (value, contentSize, viewportSize) => {
    const scaledSize = contentSize * zoom;
    if (scaledSize <= viewportSize - padding * 2) return (viewportSize - scaledSize) / 2;
    return Math.min(padding, Math.max(viewportSize - scaledSize - padding, value));
  };
  return {
    x: clampAxis(pan.x, canvas.width, viewport.width),
    y: clampAxis(pan.y, canvas.height, viewport.height),
  };
}

export function fitTimelineCanvasZoom({ canvas, viewport, padding = 72, minZoom = 0.24, maxZoom = 1 }) {
  if (!canvas?.width || !canvas?.height || !viewport?.width || !viewport?.height) return 1;
  const horizontal = (viewport.width - padding * 2) / canvas.width;
  const vertical = (viewport.height - padding * 2) / canvas.height;
  return Math.min(maxZoom, Math.max(minZoom, Math.min(horizontal, vertical)));
}
