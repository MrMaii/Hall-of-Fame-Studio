export function projectCommandRefreshPlan({ action, projectMode, refreshAdvanced = false } = {}) {
  const immediate = [];
  if (projectMode === 'timeline') immediate.push('timeline');
  else if (projectMode === 'chat' || action === 'chat' || action === 'meeting') immediate.push('transcript');

  const background = [];
  if (!immediate.includes('transcript')) background.push('transcript');
  if (!immediate.includes('timeline')) background.push('timeline');
  if (refreshAdvanced) {
    background.push(
      'manager-dashboard',
      'manager-flow-graph',
      'readiness-proof-map',
      'ready-package-submodels',
      'collaboration-intent-queue',
      'agent-autonomous-action-queue',
    );
  }
  return { immediate, background };
}
