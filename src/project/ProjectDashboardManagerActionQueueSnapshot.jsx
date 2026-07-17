export default function ProjectDashboardManagerActionQueueSnapshot({
  activeProjectId,
  backendManagerActionQueue,
  backendManagerDashboard,
  managerReadModelSourceBadge,
  projectText,
}) {
  if (!backendManagerActionQueue) return null;

  return (
    <div data-testid="backend-manager-action-queue-snapshot" className="mt-3 border-t border-[#d8c99f] pt-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Manager Action Queue')}</div>
        {managerReadModelSourceBadge(backendManagerActionQueue, 'backend-manager-action-queue-source')}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Complete', `${backendManagerActionQueue.completedCount ?? 0}/${backendManagerActionQueue.count ?? 0}`],
          ['Ready', backendManagerActionQueue.readyCount ?? 0],
          ['Blocked', backendManagerActionQueue.blockedCount ?? 0],
          ['Unresolved', backendManagerActionQueue.unresolvedRouteCount ?? 0],
          ['Next Action', backendManagerActionQueue.nextAction?.label || 'all complete'],
        ].map(([label, value]) => (
          <div key={`action-queue-${label}`} className="border border-[#d8c99f] bg-[#efe2bd]/50 px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{projectText(label)}</div>
            <div className="font-serif text-base leading-tight break-words">{projectText(value)}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c] leading-relaxed break-words">
        {backendManagerActionQueue.nextAction
          ? `${backendManagerActionQueue.nextAction.method} ${backendManagerActionQueue.nextAction.apiPath}`
          : (backendManagerDashboard?.backendRoutes?.managerActionQueue || `/projects/${activeProjectId}/manager-action-queue`)}
      </div>
      {backendManagerActionQueue.nextAction?.requestBodyTemplate && (
        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] leading-relaxed break-words">
          {projectText('Next body')}: {projectText(JSON.stringify(backendManagerActionQueue.nextAction.requestBodyTemplate))}
        </div>
      )}
    </div>
  );
}
