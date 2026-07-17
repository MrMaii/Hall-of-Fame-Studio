import React from 'react';
import { CheckCircle2, Database, FileText, MessageSquare, ScrollText, Search, Settings } from 'lucide-react';

export default function ProjectDashboardManagerProofMap({ view = {} }) {
  const {
    activeProject,
    backendCockpitProofMapCards = [],
    backendCoreAutonomyProofMapCards = [],
    backendManagerDashboard,
    backendProductTeamAcceptanceChainChatProofIds = [],
    backendProductTeamAcceptanceChainReady = false,
    backendProductTeamAcceptanceChainRoute,
    backendProductTeamAcceptanceChainSummary,
    backendProductTeamAcceptanceChainTimelineIds = [],
    backendProductTeamDeliveryTrace,
    backendProductTeamDeliveryTraceChatProofIds = [],
    backendProductTeamDeliveryTraceProofMapSource,
    backendProductTeamDeliveryTraceRoute,
    backendProductTeamDeliveryTraceTimelineIds = [],
    backendSettingsProofMapCards = [],
    backendSubmissionReviewWorkflow,
    backendSubmissionReviewWorkflowRoute,
    backendWorkerStationSyncDisabled = false,
    backendZeroToAutonomyProviderEvidenceRoutes = {},
    backendZeroToAutonomyProviderReceiptProofIds = [],
    backendZeroToAutonomyProviderUsageProofIds = [],
    backendZeroToAutonomyReport,
    backendZeroToAutonomyReportChatProofIds = [],
    backendZeroToAutonomyReportEventIds = [],
    backendZeroToAutonomyReportProofIds = [],
    backendZeroToAutonomyReportProofMapSource,
    backendZeroToAutonomyReportRoute,
    backendZeroToAutonomyReportTimelineIds = [],
    governanceCards = [],
    managerProofMap,
    managerProofMapDisplayRows = [],
    managerProofMapRouteSyncButton,
    managerReadModelSourceBadge,
    openManagerProofMapRow,
    openProjectChatProof,
    openProjectTimelineProof,
    outputCards = [],
    routePanels,
    setSettingsOpen,
    setSettingsTab,
    syncBackendCockpitReadModels,
    syncBackendGovernanceProofMapCard,
    syncBackendReadinessProofMap,
    syncBackendReadyPackageSubmodels,
  } = view;

  return (
              <div data-testid="manager-proof-map" className="bg-[#f7edcf]/70 border border-[#b8a57d] p-5 mb-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#8f1e18] mb-2">Manager Proof Map</div>
                    <div className="font-serif text-2xl leading-tight">Every readiness condition has a direct evidence route.</div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {managerReadModelSourceBadge(managerProofMap, 'manager-proof-map-source')}
                    <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{managerProofMapDisplayRows.length} checks</span>
                  </div>
                </div>
                <div data-testid="manager-proof-map-core-routes" className="mb-4 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed break-words">
                  Core routes: {backendManagerDashboard?.backendRoutes?.managerFlowGraph || `/projects/${activeProject.id}/manager-flow-graph`} / {backendManagerDashboard?.backendRoutes?.submissions || `/projects/${activeProject.id}/submissions`} / {backendSubmissionReviewWorkflowRoute?.apiPath || backendSubmissionReviewWorkflow?.backendRoutes?.submissionReviewWorkflow || `/projects/${activeProject.id}/submission-review-workflow`} / {backendProductTeamDeliveryTraceRoute?.apiPath || backendProductTeamDeliveryTrace?.backendRoutes?.productTeamDeliveryTrace || `/projects/${activeProject.id}/product-team-delivery-trace`} / {backendManagerDashboard?.backendRoutes?.readinessProofMap || `/projects/${activeProject.id}/readiness-proof-map`}
                </div>
                <div className="space-y-2">
                  {backendSettingsProofMapCards.map(card => (
                    <div key={card.key} data-testid={`proof-map-${card.key}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={card.ready ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">{card.title}</div>
                            {managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)}
                            <span className={`node-status-tag ${card.ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {card.ready ? 'Route ready' : 'Needs proof'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            {card.routeLabel} / {card.summary?.routeReady ? 'summary route ready' : 'summary route open'} / {card.summary?.productionBlockerCount ?? 0} production blocker{(card.summary?.productionBlockerCount ?? 0) === 1 ? '' : 's'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {card.route?.apiPath || card.apiPath}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)}
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-open-settings`}
                            onClick={() => {
                              setSettingsTab(card.settingsTab);
                              setSettingsOpen(true);
                            }}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            <Settings size={10} />
                            Open Settings
                          </button>
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-timeline-open`}
                            onClick={() => openProjectTimelineProof(card.timelineIds)}
                            disabled={!card.timelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Settings timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {backendCoreAutonomyProofMapCards.map(card => (
                    <div key={card.key} data-testid={`proof-map-${card.key}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={card.ready ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">{card.title}</div>
                            {managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)}
                            <span className={`node-status-tag ${card.ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {card.ready ? 'Route ready' : 'Needs proof'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            {card.routeLabel} / {card.summary?.routeReady ? 'summary route ready' : 'summary route open'} / {card.summary?.productionBlockerCount ?? 0} production blocker{(card.summary?.productionBlockerCount ?? 0) === 1 ? '' : 's'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {card.route?.apiPath || card.apiPath}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)}
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-sync-proof-models`}
                            onClick={() => syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })}
                            disabled={backendWorkerStationSyncDisabled}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Database size={10} />
                            Sync Proof Models
                          </button>
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-timeline-open`}
                            onClick={() => openProjectTimelineProof(card.timelineIds)}
                            disabled={!card.timelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Autonomy timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {backendCockpitProofMapCards.map(card => (
                    <div key={card.key} data-testid={`proof-map-${card.key}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={card.ready ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">{card.title}</div>
                            {managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)}
                            <span className={`node-status-tag ${card.ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {card.ready ? 'Route ready' : 'Needs proof'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            {card.routeLabel} / {card.summary?.routeReady ? 'summary route ready' : 'summary route open'} / {card.summary?.productionBlockerCount ?? 0} production blocker{(card.summary?.productionBlockerCount ?? 0) === 1 ? '' : 's'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {card.route?.apiPath || card.apiPath}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)}
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-sync-cockpit`}
                            onClick={() => syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })}
                            disabled={backendWorkerStationSyncDisabled}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Database size={10} />
                            Sync Cockpit
                          </button>
                          <button
                            type="button"
                            data-testid={`proof-map-${card.key}-timeline-open`}
                            onClick={() => openProjectTimelineProof(card.timelineIds)}
                            disabled={!card.timelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Cockpit timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {governanceCards.map(card => {
                    const cardChatProofIds = card.chatProofIds;
                    return (
                      <div key={card.key} data-testid={`proof-map-${card.key}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <CheckCircle2 size={14} className={card.ready ? 'text-green-700' : 'text-[#8f1e18]'} />
                              <div className="font-serif text-base leading-tight">{card.title}</div>
                              {managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)}
                              <span className={`node-status-tag ${card.ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {card.ready ? 'Route ready' : 'Needs proof'}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                              {card.routeLabel} / {card.summary?.routeReady ? 'summary route ready' : 'summary route open'} / {card.summary?.productionBlockerCount ?? 0} production blocker{(card.summary?.productionBlockerCount ?? 0) === 1 ? '' : 's'}
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                              Route: {card.route?.apiPath || card.apiPath}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                            {managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)}
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-sync-governance`}
                              onClick={() => syncBackendGovernanceProofMapCard(card.syncKind)}
                              disabled={backendWorkerStationSyncDisabled}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Database size={10} />
                              Sync Governance
                            </button>
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-chat-open`}
                              onClick={() => openProjectChatProof(activeProject, cardChatProofIds, card.route?.channelId || 'main')}
                              disabled={!cardChatProofIds.length}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} />
                              Governance chat proof
                            </button>
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-timeline-open`}
                              onClick={() => openProjectTimelineProof(card.timelineIds)}
                              disabled={!card.timelineIds.length}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ScrollText size={10} />
                              Governance timeline proof
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {outputCards.map(card => {
                    const cardChatProofIds = card.chatProofIds;
                    return (
                      <div key={card.key} data-testid={`proof-map-${card.key}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <CheckCircle2 size={14} className={card.ready ? 'text-green-700' : 'text-[#8f1e18]'} />
                              <div className="font-serif text-base leading-tight">{card.title}</div>
                              {managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)}
                              <span className={`node-status-tag ${card.ready ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                                {card.ready ? 'Route ready' : 'Needs proof'}
                              </span>
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                              {card.routeLabel} / {card.summary?.count ?? card.summary?.submissionCount ?? card.summary?.custodyRecordCount ?? 0} record{Number(card.summary?.count ?? card.summary?.submissionCount ?? card.summary?.custodyRecordCount ?? 0) === 1 ? '' : 's'} / {card.summary?.productionBlockerCount ?? 0} production blocker{(card.summary?.productionBlockerCount ?? 0) === 1 ? '' : 's'}
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                              Route: {card.route?.apiPath || card.apiPath}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                            {managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)}
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-sync-proof-models`}
                              onClick={() => syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })}
                              disabled={backendWorkerStationSyncDisabled}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Database size={10} />
                              Sync Proof Models
                            </button>
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-chat-open`}
                              onClick={() => openProjectChatProof(activeProject, cardChatProofIds, card.route?.channelId || 'main')}
                              disabled={!cardChatProofIds.length}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MessageSquare size={10} />
                              Output chat proof
                            </button>
                            <button
                              type="button"
                              data-testid={`proof-map-${card.key}-timeline-open`}
                              onClick={() => openProjectTimelineProof(card.timelineIds)}
                              disabled={!card.timelineIds.length}
                              className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ScrollText size={10} />
                              Output timeline proof
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {routePanels}
                  {backendProductTeamAcceptanceChainRoute && (
                    <div data-testid="proof-map-product-team-acceptance-chain" className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={backendProductTeamAcceptanceChainReady ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">Generic Product-Team Acceptance Chain</div>
                            {managerReadModelSourceBadge(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-source')}
                            <span className={`node-status-tag ${backendProductTeamAcceptanceChainReady ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {backendProductTeamAcceptanceChainReady ? 'Ready' : 'Chain open'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            C/A acceptance / {backendProductTeamAcceptanceChainSummary?.readyCount ?? backendProductTeamAcceptanceChainRoute.readyStageIds?.length ?? 0} ready of {backendProductTeamAcceptanceChainSummary?.rowCount ?? backendProductTeamAcceptanceChainRoute.stageRows?.length ?? 0} stages / {backendProductTeamAcceptanceChainRoute.readyForBsideProductTeamRun ? 'B-side loop ready' : 'B-side loop open'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {backendProductTeamAcceptanceChainRoute.apiPath || `/projects/${activeProject.id}/product-team-delivery-trace`}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-sync-proof-map')}
                          <button
                            type="button"
                            data-testid="proof-map-acceptance-chain-chat-open"
                            onClick={() => openProjectChatProof(activeProject, backendProductTeamAcceptanceChainChatProofIds, backendProductTeamAcceptanceChainRoute.channelId || 'main')}
                            disabled={!backendProductTeamAcceptanceChainChatProofIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <MessageSquare size={10} />
                            Chain chat proof
                          </button>
                          <button
                            type="button"
                            data-testid="proof-map-acceptance-chain-timeline-open"
                            onClick={() => openProjectTimelineProof(backendProductTeamAcceptanceChainTimelineIds)}
                            disabled={!backendProductTeamAcceptanceChainTimelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Chain timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {backendZeroToAutonomyReport && (
                    <div data-testid="proof-map-zero-to-autonomy-report" className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={backendZeroToAutonomyReport.readyForLocalMvpTrial ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">Zero-to-Autonomy Report</div>
                            {managerReadModelSourceBadge(backendZeroToAutonomyReportProofMapSource, 'proof-map-zero-to-autonomy-report-source')}
                            <span className={`node-status-tag ${backendZeroToAutonomyReport.readyForLocalMvpTrial ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {backendZeroToAutonomyReport.readyForLocalMvpTrial ? 'Local ready' : 'Needs proof'}
                            </span>
                            <span className={`node-status-tag ${backendZeroToAutonomyReport.readyForPublicProduction ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {backendZeroToAutonomyReport.readyForPublicProduction ? 'Production ready' : 'Production blocked'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            Zero-to-autonomy / {backendZeroToAutonomyReport.summary?.readyStageCount ?? 0} ready of {backendZeroToAutonomyReport.summary?.stageCount ?? backendZeroToAutonomyReportRoute?.stageCount ?? 0} stages / artifacts {backendZeroToAutonomyReport.summary?.submittedArtifactTypeCount ?? 0}/{backendZeroToAutonomyReport.summary?.requiredArtifactTypeCount ?? 0}
                          </div>
                          <div data-testid="proof-map-zero-to-autonomy-report-proof-count" className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            Proof IDs: {backendZeroToAutonomyReportProofIds.length} / Timeline: {backendZeroToAutonomyReportTimelineIds.length} / Events: {backendZeroToAutonomyReportEventIds.length}
                          </div>
                          <div data-testid="proof-map-zero-to-autonomy-provider-proof-count" className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            Provider Usage: {backendZeroToAutonomyProviderUsageProofIds.length || backendZeroToAutonomyReport.summary?.providerUsageCount || backendZeroToAutonomyReportRoute?.providerUsageCount || 0} / Provider Receipts: {backendZeroToAutonomyProviderReceiptProofIds.length || backendZeroToAutonomyReport.summary?.providerReceiptCount || backendZeroToAutonomyReportRoute?.providerReceiptCount || 0}
                          </div>
                          <div data-testid="proof-map-zero-to-autonomy-provider-routes" className="mt-1 break-all font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed">
                            Provider audit: {backendZeroToAutonomyProviderEvidenceRoutes.providerReadiness || (activeProject?.id ? `/projects/${activeProject.id}/provider-readiness` : '/projects/:id/provider-readiness')} / {backendZeroToAutonomyProviderEvidenceRoutes.evidenceSourceReviewWorkflow || (activeProject?.id ? `/projects/${activeProject.id}/evidence-source-review-workflow` : '/projects/:id/evidence-source-review-workflow')} / {backendZeroToAutonomyProviderEvidenceRoutes.evidenceCustodyReadiness || (activeProject?.id ? `/projects/${activeProject.id}/evidence-custody-readiness` : '/projects/:id/evidence-custody-readiness')}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {backendZeroToAutonomyReportRoute?.apiPath || backendZeroToAutonomyReport.backendRoutes?.zeroToAutonomyReport || `/projects/${activeProject.id}/zero-to-autonomy-report`}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(backendZeroToAutonomyReportRoute, 'proof-map-zero-to-autonomy-report-sync-proof-map')}
                          <button
                            type="button"
                            data-testid="proof-map-zero-to-autonomy-chat-open"
                            onClick={() => openProjectChatProof(activeProject, backendZeroToAutonomyReportChatProofIds, backendZeroToAutonomyReportRoute?.channelId || 'main')}
                            disabled={!backendZeroToAutonomyReportChatProofIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <MessageSquare size={10} />
                            Report chat proof
                          </button>
                          <button
                            type="button"
                            data-testid="proof-map-zero-to-autonomy-timeline-open"
                            onClick={() => openProjectTimelineProof(backendZeroToAutonomyReportTimelineIds)}
                            disabled={!backendZeroToAutonomyReportTimelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Report timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {backendProductTeamDeliveryTrace && (
                    <div data-testid="proof-map-product-team-delivery-trace" className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={backendProductTeamDeliveryTrace.readyForPrivatePilotDelivery ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">Product Team Delivery Trace</div>
                            {managerReadModelSourceBadge(backendProductTeamDeliveryTraceProofMapSource, 'proof-map-product-team-delivery-trace-source')}
                            <span className={`node-status-tag ${backendProductTeamDeliveryTrace.readyForPrivatePilotDelivery ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {backendProductTeamDeliveryTrace.readyForPrivatePilotDelivery ? 'Ready' : 'Trace open'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#7d6a49] leading-relaxed">
                            Delivery trace / {backendProductTeamDeliveryTrace.summary?.readyCount ?? 0} ready of {backendProductTeamDeliveryTrace.summary?.rowCount ?? backendProductTeamDeliveryTraceRoute?.stageCount ?? 0} stages / {backendProductTeamDeliveryTrace.summary?.acceptedFinalDeliverableCount ?? backendProductTeamDeliveryTraceRoute?.acceptedFinalDeliverableCount ?? 0} final accepted
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase text-[#9b875c] leading-relaxed break-words">
                            Route: {backendProductTeamDeliveryTraceRoute?.apiPath || backendProductTeamDeliveryTrace.backendRoutes?.productTeamDeliveryTrace || `/projects/${activeProject.id}/product-team-delivery-trace`}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                          {managerProofMapRouteSyncButton(backendProductTeamDeliveryTraceRoute, 'proof-map-product-team-delivery-trace-sync-proof-map')}
                          <button
                            type="button"
                            data-testid="proof-map-delivery-trace-chat-open"
                            onClick={() => openProjectChatProof(activeProject, backendProductTeamDeliveryTraceChatProofIds, backendProductTeamDeliveryTraceRoute?.channelId || 'main')}
                            disabled={!backendProductTeamDeliveryTraceChatProofIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <MessageSquare size={10} />
                            Delivery chat proof
                          </button>
                          <button
                            type="button"
                            data-testid="proof-map-delivery-trace-timeline-open"
                            onClick={() => openProjectTimelineProof(backendProductTeamDeliveryTraceTimelineIds)}
                            disabled={!backendProductTeamDeliveryTraceTimelineIds.length}
                            className="inline-flex items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} />
                            Delivery timeline proof
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {managerProofMapDisplayRows.map(row => (
                    <div key={`proof-map-${row.check.id}`} data-testid={`proof-map-${row.check.id}`} className="border border-[#d8c99f] bg-[#efe2bd]/55 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CheckCircle2 size={14} className={row.check.passed ? 'text-green-700' : 'text-[#8f1e18]'} />
                            <div className="font-serif text-base leading-tight">{row.check.label}</div>
                            <span className={`node-status-tag ${row.check.passed ? 'bg-green-700 text-white' : 'bg-[#8f1e18] text-white'}`}>
                              {row.check.passed ? 'Ready' : 'Needs proof'}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {row.targetLabel} / {row.check.detail}
                          </div>
                        </div>
                        {row.check.id === 'manager-proof-map-backend-required' ? (
                          <button
                            type="button"
                            data-testid="manager-proof-map-sync-readiness-proof-map"
                            onClick={() => syncBackendReadinessProofMap({ silent: false, projectId: activeProject.id })}
                            disabled={backendWorkerStationSyncDisabled}
                            className="inline-flex shrink-0 items-center gap-1 border border-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#8f1e18] hover:border-[#251b13] hover:text-[#251b13] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <FileText size={10} /> Sync Proof Map
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openManagerProofMapRow(row)}
                            className="inline-flex shrink-0 items-center gap-1 border border-[#d8c99f] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#6b5a3d] hover:border-[#8f1e18] hover:text-[#8f1e18] transition-colors"
                          >
                            {row.proofType === 'timeline' ? <ScrollText size={10} /> : row.proofType === 'chat' ? <MessageSquare size={10} /> : <Search size={10} />}
                            {row.proofLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
  );
}

