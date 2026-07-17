const HIDDEN_SYSTEM_AUTHORS = new Set([
  'Agent Runtime',
  'Autonomous Run Control',
  'Agent Autonomous Queue',
  'Product Team Mission Runner',
]);

const INTERNAL_ACTIVITY_PATTERN = /\/projects\/|backend-backed|frontend-fallback|manager-flow-fallback-protocol/i;

export function projectActivityText(row = {}) {
  return row.text || row.log || row.message || row.summary || row.title || '项目状态已更新';
}

export function isUserFacingProjectActivity(row = {}) {
  const author = row.agent || row.actor || row.author || '';
  if (HIDDEN_SYSTEM_AUTHORS.has(author)) return false;
  const internalMetadata = `${row.route || ''} ${row.source || ''} ${row.generatedBy || ''}`;
  return !INTERNAL_ACTIVITY_PATTERN.test(internalMetadata) && !INTERNAL_ACTIVITY_PATTERN.test(projectActivityText(row));
}

export function recentUserFacingProjectActivity(project = {}, limit = 30) {
  return (Array.isArray(project.logs) ? project.logs : [])
    .map((row, index) => ({
      row,
      index,
      time: Date.parse(row.time || row.timestamp || row.createdAt || row.updatedAt || '') || 0,
    }))
    .filter(({ row }) => isUserFacingProjectActivity(row))
    .sort((left, right) => right.time - left.time || left.index - right.index)
    .slice(0, Math.max(0, limit))
    .map(({ row }) => row);
}
