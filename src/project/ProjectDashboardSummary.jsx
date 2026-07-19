import React from 'react';
import { Database, Sparkles } from 'lucide-react';

export default function ProjectDashboardSummary({ view = {} }) {
  const {
    activeProject,
    backendWorkerStationSyncDisabled,
    isInitiatedProject,
    managerDashboardStats,
    managerNextSuggestion,
    nextActionResolution,
    nextActionResolutionDelivery,
    onSyncManagerDashboard,
    projectDashboardNextRecommendationBackendRequired,
    projectDashboardNextRecommendationSourceMeta,
    projectText,
    t,
  } = view;

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {managerDashboardStats.map(item => (
          <div key={item.label} className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5">
            <item.icon size={18} className="text-[#8f1e18] mb-4" />
            <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] mb-2">{item.label}</div>
            <div className="font-serif text-2xl">{item.value}</div>
            {item.sourceMeta && (
              <div className="mt-3 flex flex-col gap-1">
                <span
                  data-testid={`project-dashboard-stat-source-${item.sourceId}`}
                  className={`w-fit border px-2 py-1 font-mono text-[8px] uppercase tracking-widest ${item.sourceMeta.className}`}
                >
                  {item.sourceMeta.label}
                </span>
                <span
                  data-testid={`project-dashboard-stat-source-detail-${item.sourceId}`}
                  className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]"
                >
                  {item.sourceMeta.detail}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-[#251b13] text-[#efe2bd] border border-[#5c4933] p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-red-200">
            <Sparkles size={15} /> {t('common.nextRecommendation')}
          </div>
          <span
            data-testid="project-dashboard-next-recommendation-source"
            className={`border px-3 py-1 font-mono text-[8px] uppercase tracking-widest ${projectDashboardNextRecommendationSourceMeta.className}`}
          >
            {projectDashboardNextRecommendationSourceMeta.label}
          </span>
        </div>
        <div
          data-testid="project-dashboard-next-recommendation-source-detail"
          className="mb-4 font-mono text-[8px] uppercase tracking-widest text-[#d8c99f]"
        >
          {projectDashboardNextRecommendationSourceMeta.detail}
        </div>
        {projectDashboardNextRecommendationBackendRequired && (
          <button
            type="button"
            data-testid="project-dashboard-next-recommendation-sync-manager-dashboard"
            onClick={onSyncManagerDashboard}
            disabled={backendWorkerStationSyncDisabled}
            className="mb-4 inline-flex items-center gap-1.5 border border-[#d8c99f] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Database size={11} /> Sync Manager Dashboard
          </button>
        )}
        {isInitiatedProject && (
          <p className="font-serif text-2xl leading-relaxed">
            {managerNextSuggestion}
          </p>
        )}
        <p className={`font-serif text-2xl leading-relaxed ${isInitiatedProject ? 'hidden' : ''}`}>
          {managerNextSuggestion}
        </p>
        {isInitiatedProject && (
          <div data-testid="dashboard-next-action-resolution" className="mt-5 border-t border-[#7b6542] pt-4 font-mono text-[9px] uppercase tracking-widest text-[#d8c99f] leading-relaxed">
            <div>
              {projectText('NEXT ACTION RESOLUTION')}: {projectText(projectDashboardNextRecommendationBackendRequired ? 'backend required' : nextActionResolution?.status || (activeProject.initiation?.output ? 'manager-confirmed' : 'awaiting confirmation'))}
            </div>
            <div>
              {projectText('AGENT RECEIPTS')}: {projectText(projectDashboardNextRecommendationBackendRequired ? 'backend required' : nextActionResolutionDelivery ? `${nextActionResolutionDelivery.deliveredAgentIds.length}/${nextActionResolutionDelivery.teamCount}` : `${activeProject.team.length}/${activeProject.team.length}`)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
