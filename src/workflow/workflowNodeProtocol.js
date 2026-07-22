export const WORKFLOW_NODE_FAMILIES = {
  thinking: {
    label: 'Thinking', lane: 'Thinking', color: '#b9782b', iconKey: 'lightbulb', glyph: 'IDEA', defaultSemanticLevel: 2,
  },
  'self-marketing': {
    label: 'Self-Marketing', lane: 'Self-Marketing', color: '#a66a3f', iconKey: 'sparkles', glyph: 'PITCH', defaultSemanticLevel: 2,
  },
  decision: {
    label: 'Decision', lane: 'Decisions', color: '#8f1e18', iconKey: 'shield', glyph: 'DECIDE', defaultSemanticLevel: 0,
  },
  confirmation: {
    label: 'Confirmation', lane: 'Confirmations', color: '#2f7563', iconKey: 'badge-check', glyph: 'CONFIRM', defaultSemanticLevel: 1,
  },
  collaboration: {
    label: 'Collaboration', lane: 'Collaboration', color: '#59684b', iconKey: 'users', glyph: 'TOGETHER', defaultSemanticLevel: 2,
  },
  execution: {
    label: 'Execution', lane: 'Execution', color: '#9b895c', iconKey: 'activity', glyph: 'DO', defaultSemanticLevel: 2,
  },
  submission: {
    label: 'Submission', lane: 'Submissions', color: '#c6a95e', iconKey: 'file-check', glyph: 'SUBMIT', defaultSemanticLevel: 1,
  },
  summary: {
    label: 'Summary', lane: 'Reports', color: '#a66f3c', iconKey: 'notebook-text', glyph: 'REPORT', defaultSemanticLevel: 1,
  },
  review: {
    label: 'Review', lane: 'Reviews', color: '#72558a', iconKey: 'scan-check', glyph: 'REVIEW', defaultSemanticLevel: 1,
  },
  communication: {
    label: 'Communication', lane: 'Communication', color: '#7b6542', iconKey: 'message-square', glyph: 'SAY', defaultSemanticLevel: 3,
  },
  monitoring: {
    label: 'Monitoring', lane: 'Monitoring', color: '#3f5d69', iconKey: 'radar', glyph: 'WATCH', defaultSemanticLevel: 3,
  },
  evidence: {
    label: 'Evidence', lane: 'Evidence', color: '#9c895f', iconKey: 'database', glyph: 'PROVE', defaultSemanticLevel: 2,
  },
  recovery: {
    label: 'Recovery', lane: 'Recovery', color: '#9b4f43', iconKey: 'rotate-ccw', glyph: 'RECOVER', defaultSemanticLevel: 1,
  },
  governance: {
    label: 'Governance', lane: 'Governance', color: '#5f5279', iconKey: 'landmark', glyph: 'GOVERN', defaultSemanticLevel: 0,
  },
};

export const WORKFLOW_NODE_FAMILY_ORDER = Object.freeze(Object.keys(WORKFLOW_NODE_FAMILIES));

export const WORKFLOW_NODE_SCALES = {
  month: { label: 'Outcome', description: 'Milestones, decisions, governance, and final outcomes', maxSemanticLevel: 0 },
  week: { label: 'Phase', description: 'Submissions, confirmations, reviews, summaries, and recoveries', maxSemanticLevel: 1 },
  day: { label: 'Activity', description: 'Ideas, collaboration, execution, and supporting evidence', maxSemanticLevel: 2 },
  hour: { label: 'Trace', description: 'Every retained workflow node, including communication and monitoring', maxSemanticLevel: 3 },
};

const SEMANTIC_LABELS = ['Milestone', 'Phase', 'Activity', 'Trace'];

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

function behaviorText(node = {}) {
  return [
    node.category,
    node.family,
    node.subtype,
    node.eventType,
    node.artifactType,
    node.title,
    node.summary,
    node.source,
  ].filter(Boolean).join(' ').toLowerCase();
}

const DIRECTIONAL_DECISION_PATTERN = /product[- ]direction|strategic[- ]direction|strategy[- ]choice|scope[- ]change|architecture[- ](?:decision|direction)|market[- ]positioning|target[- ]customer|pricing[- ]decision|go[- ]no[- ]go|launch[- ](?:approval|decision)|release[- ]approval|final[- ]acceptance|selected[- ]option|major[- ]tradeoff/;

export function isDirectionalWorkflowDecision(node = {}) {
  return DIRECTIONAL_DECISION_PATTERN.test(behaviorText(node));
}

function operationalFamilyForDecision(node = {}) {
  const text = behaviorText(node);
  if (/personnel[- ]assignment|team[- ]roster|acknowledge|confirmed|confirmation|sign[- ]?off/.test(text)) return 'confirmation';
  if (/leader[- ](?:election|decision|elected)|governance|authority|permission|policy/.test(text)) return 'governance';
  if (/command[- ]center|readiness|status|matrix|audit|operating[- ]loop|state[- ]machine|heartbeat|monitor|trace/.test(text)) return 'monitoring';
  return 'thinking';
}

export function inferWorkflowNodeFamily(node = {}) {
  const explicit = String(node.category || node.family || '').toLowerCase();
  if (explicit === 'decision') {
    return isDirectionalWorkflowDecision(node) ? 'decision' : operationalFamilyForDecision(node);
  }
  if (WORKFLOW_NODE_FAMILIES[explicit]) return explicit;

  const text = behaviorText(node);
  const rules = [
    ['confirmation', /acknowledge|confirmation|confirmed|confirm\b|sign[- ]?off|accepted|acceptance/],
    ['summary', /summary|report|recap|retrospective|synthesis|briefing/],
    ['recovery', /recovery|recover|rollback|restore|retry|incident|resume-from-failure/],
    ['governance', /governance|policy|permission|membership|launch-gate|assignment|authority/],
    ['review', /review|feedback|changes-requested|critique|evaluation/],
    ['submission', /submission|submit|deliverable|artifact|revision|handover-package/],
    ['evidence', /evidence|proof|citation|source|research|test-result|benchmark/],
    ['self-marketing', /self-marketing|self-nomination|leader-campaign|capability-claim|ownership-pitch/],
    ['collaboration', /collaboration|co-author|joint-|handoff|peer-|pair-|teamwork|agent-contracted|joined the .* team/],
    ['thinking', /idea|hypothesis|question|analysis|reasoning|brainstorm|plan|proposal/],
    ['decision', DIRECTIONAL_DECISION_PATTERN],
    ['monitoring', /monitor|heartbeat|health|watch|alert|risk-check|quality-check|scheduler/],
    ['communication', /message|chat|mention|announcement|meeting-turn|transcript|conversation/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'execution';
}

export function semanticLevelForWorkflowNode(node = {}, family = inferWorkflowNodeFamily(node)) {
  const explicit = Number(node.semanticLevel);
  if (Number.isInteger(explicit) && explicit >= 0 && explicit <= 3) return explicit;

  const text = behaviorText(node);
  const explicitFamily = String(node.category || node.family || '').toLowerCase();
  if (family === 'decision' && isDirectionalWorkflowDecision(node)) return 0;
  if (explicitFamily === 'decision' && family === 'thinking') return 3;
  if (/milestone|launch-decision|final-report|final-deliverable|project-complete|governance-gate|release-candidate/.test(text)) return 0;

  return WORKFLOW_NODE_FAMILIES[family]?.defaultSemanticLevel ?? 2;
}

export function decorateWorkflowNode(node = {}) {
  const category = inferWorkflowNodeFamily(node);
  const meta = WORKFLOW_NODE_FAMILIES[category] || WORKFLOW_NODE_FAMILIES.execution;
  const semanticLevel = semanticLevelForWorkflowNode(node, category);
  const explicitDescription = String(node.description || node.agentDescription || '').trim();
  const description = explicitDescription || String(node.summary || node.commitMessage || node.title || '').trim();

  return {
    ...node,
    category,
    categoryLabel: meta.label,
    lane: node.lane || meta.lane,
    semanticLevel,
    semanticLabel: SEMANTIC_LABELS[semanticLevel],
    description,
    descriptionSource: node.descriptionSource || (explicitDescription ? 'agent-authored' : 'runtime-fallback'),
    visual: {
      color: node.visual?.color || meta.color,
      iconKey: node.visual?.iconKey || meta.iconKey,
      glyph: node.visual?.glyph || meta.glyph,
      logoStyle: node.visual?.logoStyle || 'workflow-family-mark/v1',
    },
  };
}

export function workflowNodeVisibleAtScale(node = {}, scale = 'day') {
  const profile = WORKFLOW_NODE_SCALES[scale] || WORKFLOW_NODE_SCALES.day;
  const decorated = decorateWorkflowNode(node);
  return decorated.semanticLevel <= profile.maxSemanticLevel;
}

function workflowNodePublicationScore(node = {}) {
  const text = behaviorText(node);
  let score = 0;
  if (isDirectionalWorkflowDecision(node)) score += 1000;
  if (/final[- ]deliverable|final[- ]report|project[- ]complete|release[- ]candidate|milestone/.test(text)) score += 800;
  if (['submission', 'summary', 'review', 'governance', 'confirmation'].includes(node.category)) score += 400;
  score += (3 - (Number.isInteger(node.semanticLevel) ? node.semanticLevel : 3)) * 50;
  if (/confirmed|resolved|approved|complete|accepted/.test(String(node.status || '').toLowerCase())) score += 30;
  score += ({ critical: 20, major: 15, high: 15, normal: 5, minor: 0 }[String(node.importance || '').toLowerCase()] || 0);
  if (uniqueStrings([...(node.proofIds || []), ...(node.timelineLogIds || []), ...(node.eventIds || [])]).length) score += 5;
  return score;
}

function workflowNodeReferenceIds(node = {}) {
  return uniqueStrings([
    node.id,
    ...(node.proofIds || []),
    ...(node.timelineLogIds || []),
    ...(node.eventIds || []),
  ]);
}

export function selectWorkflowTimelinePublications({ nodes = [], scale = 'day', pinnedReferenceIds = [] } = {}) {
  const pinned = new Set(uniqueStrings(pinnedReferenceIds));
  const eligible = nodes
    .map((node, inputIndex) => ({ ...decorateWorkflowNode(node), inputIndex }))
    .filter((node) => workflowNodeVisibleAtScale(node, scale));
  const groups = new Map();

  eligible.forEach((node) => {
    const parsed = Date.parse(node.time || node.submittedAt || node.createdAt || node.updatedAt);
    const timestampKey = Number.isFinite(parsed) ? new Date(parsed).toISOString() : `unscheduled:${node.id || node.inputIndex}`;
    if (!groups.has(timestampKey)) groups.set(timestampKey, []);
    groups.get(timestampKey).push(node);
  });

  const selectedIds = new Set();
  groups.forEach((group) => {
    const ranked = [...group].sort((left, right) => (
      workflowNodePublicationScore(right) - workflowNodePublicationScore(left)
      || left.inputIndex - right.inputIndex
    ));
    ranked.slice(0, 2).forEach((node) => selectedIds.add(node.inputIndex));
    const pinnedOverflow = group.find((node) => (
      !selectedIds.has(node.inputIndex)
      && workflowNodeReferenceIds(node).some((referenceId) => pinned.has(referenceId))
    ));
    if (pinnedOverflow) selectedIds.add(pinnedOverflow.inputIndex);
  });

  const selectedNodes = eligible
    .filter((node) => selectedIds.has(node.inputIndex))
    .sort((left, right) => {
      const leftTime = Date.parse(left.time || left.submittedAt || left.createdAt || left.updatedAt);
      const rightTime = Date.parse(right.time || right.submittedAt || right.createdAt || right.updatedAt);
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
      if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) return Number.isFinite(leftTime) ? -1 : 1;
      return left.inputIndex - right.inputIndex;
    })
    .map(({ inputIndex, ...node }) => node);
  const suppressedNodes = eligible.filter((node) => !selectedIds.has(node.inputIndex));

  return {
    nodes: selectedNodes,
    suppressedNodeCount: suppressedNodes.length,
    suppressedNodeIds: suppressedNodes.map((node) => node.id).filter(Boolean),
    maxNodesPerTimestamp: 2,
  };
}

export function workflowNodeTimeBucket(node = {}, scale = 'day') {
  const rawTime = node.time || node.submittedAt || node.createdAt || node.updatedAt;
  const parsed = Date.parse(rawTime);
  if (!Number.isFinite(parsed)) return String(node.commitAreaKey || rawTime || node.id || 'unscheduled');

  const date = new Date(parsed);
  date.setUTCSeconds(0, 0);
  if (scale === 'month') {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else if (scale === 'week') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    date.setUTCHours(0, 0, 0, 0);
  } else if (scale === 'day') {
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCMinutes(0, 0, 0);
  }
  return date.toISOString();
}

function fieldStatus(id, label, value, valid = Boolean(value)) {
  return { id, label, status: valid ? 'filled' : 'missing' };
}

export function evaluateWorkflowNodeSubmissionQuality({ node = {}, submission = {}, attachments = [] } = {}) {
  const decorated = decorateWorkflowNode(node);
  const committerIds = uniqueStrings([
    ...(submission.committerIds || []),
    submission.submittedByAgentId,
    ...(node.committerIds || []),
    node.agentId,
    ...(submission.coAuthorIds || []),
    ...(node.coAuthorIds || []),
  ]);
  const participantIds = uniqueStrings([
    ...committerIds,
    ...(submission.participantIds || []),
    ...(node.participantIds || []),
    ...(node.affectedAgentIds || []),
  ]);
  const relationshipRoles = {
    ...(node.relationshipRoles || {}),
    ...(submission.relationshipRoles || {}),
  };
  const linkedAttachments = attachments.length ? attachments : (node.attachments || []);
  const proofReferenceCount = uniqueStrings([
    ...(node.proofIds || []),
    ...(node.timelineLogIds || []),
    ...(node.eventIds || []),
  ]).length;
  const everyPersonHasRole = participantIds.length > 0 && participantIds.every((id) => Boolean(relationshipRoles[id]));
  const fields = [
    fieldStatus('title', 'Node title', node.title, Boolean(String(node.title || '').trim())),
    fieldStatus(
      'description',
      'Agent-authored description',
      decorated.description,
      Boolean(decorated.description) && decorated.descriptionSource !== 'runtime-fallback',
    ),
    fieldStatus('category', 'Behavior family', decorated.category, Boolean(decorated.category)),
    fieldStatus('subtype', 'Behavior subtype', node.subtype, Boolean(String(node.subtype || '').trim())),
    fieldStatus('intent', 'Submission intent', submission.intent || node.intent, Boolean(String(submission.intent || node.intent || '').trim())),
    fieldStatus('commitMessage', 'Commit message', submission.commitMessage || node.commitMessage, Boolean(String(submission.commitMessage || node.commitMessage || '').trim())),
    fieldStatus('committers', 'Submitting Agent(s)', committerIds, committerIds.length > 0),
    fieldStatus('relationshipRoles', 'Typed relationship roles', relationshipRoles, everyPersonHasRole),
    fieldStatus('attachmentsOrProof', 'Attachment or proof reference', linkedAttachments, linkedAttachments.length > 0 || proofReferenceCount > 0),
  ];
  const filledCount = fields.filter((field) => field.status === 'filled').length;
  const completenessScore = Math.round((filledCount / fields.length) * 100);
  const missingFieldIds = fields.filter((field) => field.status === 'missing').map((field) => field.id);
  const authorshipMode = committerIds.length > 2 ? 'team' : committerIds.length === 2 ? 'joint' : 'individual';

  return {
    schemaVersion: 'workflow-node-submission-quality/v1',
    completenessScore,
    readyForTimeline: completenessScore >= 85 && missingFieldIds.length === 0,
    authorshipMode,
    missingFieldIds,
    fields,
    counts: {
      committerCount: committerIds.length,
      relationshipCount: Object.keys(relationshipRoles).length,
      attachmentCount: linkedAttachments.length,
      proofReferenceCount,
    },
  };
}
