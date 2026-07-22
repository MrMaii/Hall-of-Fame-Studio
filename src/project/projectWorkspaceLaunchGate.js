export function projectWorkspaceLaunchGate({
  workspaceRequired = false,
  preparedWorkspacePath = '',
  verification = null,
} = {}) {
  if (!workspaceRequired) return { ready: true, reason: null };
  const preparedPath = String(preparedWorkspacePath || '').trim();
  const verifiedPath = String(verification?.workspacePath || '').trim();
  const markerPath = String(verification?.markerPath || '').trim();
  const readBytes = Number(verification?.readBytes || 0);
  const sameWorkspace = preparedPath.toLowerCase() === verifiedPath.toLowerCase();
  if (!preparedPath || !sameWorkspace || !markerPath || readBytes <= 0) {
    return { ready: false, reason: 'workspace-verification-required' };
  }
  return { ready: true, reason: null };
}
