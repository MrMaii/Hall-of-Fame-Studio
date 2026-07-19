import { workflowNodeTimeBucket } from './workflowNodeProtocol.js';

const importanceRank = { minor: 0, normal: 1, major: 2, critical: 3 };
const MAX_COLLISION_SLOTS = 8;

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

  if (scale === 'hour') {
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

export function planWorkflowTimelineLayout({ nodes = [], scale = 'day', detail = 'medium' } = {}) {
  const { width: nodeWidth, height: nodeHeight } = nodeDimensions(detail);
  const rowGap = detail === 'compact' ? 14 : 18;
  const nodeGap = detail === 'compact' ? 14 : 18;
  const timeGap = detail === 'expanded' ? 104 : detail === 'medium' ? 92 : 80;
  const axisGap = 40;
  const xOffset = 160;
  const halfSlotCount = MAX_COLLISION_SLOTS / 2;
  const axisHalfHeight = axisGap + halfSlotCount * nodeHeight + (halfSlotCount - 1) * rowGap + 60;
  const timeAxisY = axisHalfHeight;
  const collisionSlotYs = Array.from({ length: halfSlotCount }, (_, layer) => {
    const above = timeAxisY - axisGap - nodeHeight - layer * (nodeHeight + rowGap);
    const below = timeAxisY + axisGap + layer * (nodeHeight + rowGap);
    return [above, below];
  }).flat();

  const groupedByTime = new Map();
  nodes.forEach((node) => {
    const key = node.timeBucket || workflowNodeTimeBucket(node, scale);
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

  let columnCursor = xOffset;
  const timeColumnLayouts = columns.map((column) => {
    const stackColumns = Math.max(1, Math.ceil(column.nodes.length / MAX_COLLISION_SLOTS));
    const width = stackColumns * nodeWidth + Math.max(0, stackColumns - 1) * nodeGap;
    const layout = {
      ...column,
      x: columnCursor,
      width,
      centerX: columnCursor + width / 2,
      count: column.nodes.reduce((sum, node) => sum + (node.clusterCount || 1), 0),
    };
    columnCursor += width + timeGap;
    return layout;
  });

  const nodeLayout = {};
  timeColumnLayouts.forEach((column, timeColumnIndex) => {
    column.nodes.forEach((node, nodeIndex) => {
      const stackColumn = Math.floor(nodeIndex / MAX_COLLISION_SLOTS);
      const baseSlot = nodeIndex % MAX_COLLISION_SLOTS;
      const collisionSlot = timeColumnIndex % 2 === 0
        ? baseSlot
        : (baseSlot % 2 === 0 ? baseSlot + 1 : baseSlot - 1);
      nodeLayout[node.id] = {
        nodeId: node.id,
        x: column.x + stackColumn * (nodeWidth + nodeGap),
        y: collisionSlotYs[collisionSlot],
        w: nodeWidth,
        h: nodeHeight,
        timestamp: node.time,
        timeAnchorX: column.centerX,
        collisionSlot,
        timeColumnIndex,
      };
    });
  });

  const timeTicks = timeColumnLayouts.map((column) => ({
    key: column.key,
    x: column.centerX,
    count: column.count,
    ...isoTickLabels(column.key),
  }));
  const canvasW = Math.max(1280, columnCursor + 80);
  const canvasH = Math.max(760, timeAxisY * 2);

  return {
    canvasH,
    canvasW,
    collisionSlotYs,
    maxCollisionSlots: MAX_COLLISION_SLOTS,
    nodeHeight,
    nodeLayout,
    nodeWidth,
    timeAxisY,
    timeColumnLayouts,
    timeTicks,
    xOffset,
  };
}

export function preserveTimelineViewportAnchor({ worldPoint, viewportPoint, zoom }) {
  return {
    x: viewportPoint.x - worldPoint.x * zoom,
    y: viewportPoint.y - worldPoint.y * zoom,
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
