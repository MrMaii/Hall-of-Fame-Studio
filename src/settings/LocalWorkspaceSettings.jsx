import { Database, MessageSquare, Save } from 'lucide-react';

export default function LocalWorkspaceSettings({
  t,
  language = 'zh',
  setLanguage,
  activeProject = null,
  fieldClass = '',
  SettingField,
  updateProjectLanguageSetting,
  workspacePolicy = {},
  settingsBackendProjectWriteAvailable = false,
  workspacePolicySaving = false,
  updateProjectWorkspacePolicySetting,
  workspaceCapabilities = null,
  workspaceCapabilitySummary = {},
  workspaceCapabilityBackendRequiredLabel = '',
  currentWorkspacePath = '',
  workspaceBindDraft = {},
  setWorkspaceBindDraft,
  bindProjectWorkspaceFromSettings,
  settingsBackendProjectSyncDisabled = true,
  currentWorkspaceBoundAt = '',
  workspaceCapabilityRows = [],
  labelClass = '',
  SmallButton,
  syncBackendProjectState,
  syncBackendProjectMemoryReadiness,
  projectMemoryReadinessSourceClass = '',
  projectMemoryReadinessSourceStatus = '',
  projectMemoryReadinessSourceDetail = '',
  backendProjectMemoryReadiness = null,
  projectMemoryReadinessRows = [],
  projectMemoryReadinessGates = [],
  syncBackendMeetingSummaries,
  meetingSummarySourceClass = '',
  meetingSummarySourceStatus = '',
  meetingSummarySourceDetail = '',
  backendMeetingSummaries = null,
  meetingSummaryRows = [],
} = {}) {
  return (
    <div data-testid="settings-local-workspace">
                <div className="space-y-6" data-testid="settings-workspace-runtime-boundary">
                  <div className="grid grid-cols-2 gap-5">
                    <SettingField label={t('settings.defaultLanguage')} hint="Local UI preference; stored in the browser, not the backend project.">
                      <select data-testid="settings-global-language" className={fieldClass} value={language} onChange={(event) => setLanguage(event.target.value)}>
                        <option value="zh">{t('language.zh')}</option>
                        <option value="en">{t('language.en')}</option>
                      </select>
                    </SettingField>
                    <SettingField label={t('settings.projectLanguage')} hint={activeProject ? t('settings.inheritGlobal') : t('settings.languageHint')}>
                      <select
                        data-testid="settings-project-language"
                        className={fieldClass}
                        value={activeProject?.language || 'inherit'}
                        disabled={!activeProject}
                        onChange={(event) => {
                          if (!activeProject) return;
                          const nextLanguage = event.target.value === 'inherit' ? undefined : event.target.value;
                          updateProjectLanguageSetting(nextLanguage || null);
                        }}
                      >
                        <option value="inherit">{t('settings.inheritGlobal')}</option>
                        <option value="zh">{t('language.zh')}</option>
                        <option value="en">{t('language.en')}</option>
                      </select>
                    </SettingField>
                  </div>
                  <div data-testid="settings-workspace-policy-controls" className="grid gap-5 md:grid-cols-3">
                    <SettingField label="Interface density" hint="Saved through project-settings/v1 as a project workspace policy.">
                      <select
                        data-testid="settings-workspace-interface-density"
                        className={fieldClass}
                        value={workspacePolicy.interfaceDensity}
                        disabled={!settingsBackendProjectWriteAvailable || workspacePolicySaving}
                        onChange={(event) => updateProjectWorkspacePolicySetting({ interfaceDensity: event.currentTarget.value })}
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                        <option value="expanded">Expanded</option>
                      </select>
                    </SettingField>
                    <SettingField label="Default visibility" hint="Saved through project-settings/v1 for local MVP collaboration defaults.">
                      <select
                        data-testid="settings-workspace-default-visibility"
                        className={fieldClass}
                        value={workspacePolicy.defaultVisibility}
                        disabled={!settingsBackendProjectWriteAvailable || workspacePolicySaving}
                        onChange={(event) => updateProjectWorkspacePolicySetting({ defaultVisibility: event.currentTarget.value })}
                      >
                        <option value="team">Team</option>
                        <option value="manager-only">Manager only</option>
                        <option value="private">Private</option>
                      </select>
                    </SettingField>
                    <SettingField label="Autosave cadence" hint="Saved through project-settings/v1; production conflict handling still needs managed persistence.">
                      <select
                        data-testid="settings-workspace-autosave-cadence"
                        className={fieldClass}
                        value={String(workspacePolicy.autosaveCadenceSeconds)}
                        disabled={!settingsBackendProjectWriteAvailable || workspacePolicySaving}
                        onChange={(event) => updateProjectWorkspacePolicySetting({ autosaveCadenceSeconds: Number(event.currentTarget.value) || 60 })}
                      >
                        <option value="30">30 seconds</option>
                        <option value="60">60 seconds</option>
                        <option value="120">2 minutes</option>
                        <option value="300">5 minutes</option>
                      </select>
                    </SettingField>
                  </div>
                  <div className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">Backend workspace boundary</div>
                    <div className="mt-2 font-serif text-xl text-[#1a1a1a]">Project workspace settings save through backend receipts.</div>
                    <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                      Global interface language is a local UI preference. Project language and workspace policy write through project-settings/v1. Runtime contract rules and long-term memory readiness are backend-backed and read-only; production managed memory remains blocked until managed storage and retention controls exist.
                    </p>
                    <div data-testid="settings-workspace-capabilities-summary" className="mt-4 grid gap-2 font-mono text-[11px] text-[#5f5a50] sm:grid-cols-4">
                      <div>Contract: {workspaceCapabilities?.schemaVersion || 'not synced'}</div>
                      <div>Backend-backed: {workspaceCapabilitySummary.backendBackedCount ?? 0}</div>
                      <div>Backend-required: {workspaceCapabilityBackendRequiredLabel}</div>
                      <div>Browser-local: {workspaceCapabilitySummary.browserLocalCount ?? 0}</div>
                    </div>
                  </div>
                  <div data-testid="settings-workspace-bind-contract" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">/projects/:id/workspace/bind</div>
                        <div className="mt-2 font-serif text-xl text-[#1a1a1a]">Backend local workspace binding</div>
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                          Local/private MVP projects can bind a real filesystem workspace through the backend local runtime. The browser records no fake workspace path; production managed workspaces remain blocked until storage, access, quota, and audit controls exist.
                        </p>
                      </div>
                      <span className={`shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${currentWorkspacePath ? 'border-[#59684b] text-[#3f5136]' : 'border-[#b9a55f] text-[#75631d]'}`}>
                        {currentWorkspacePath ? 'bound' : 'not bound'}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <input
                        data-testid="settings-workspace-bind-path-input"
                        value={workspaceBindDraft.path}
                        onChange={(event) => {
                          const nextPath = event.currentTarget.value;
                          setWorkspaceBindDraft(prev => ({ ...prev, path: nextPath, error: null }));
                        }}
                        placeholder="C:\\projects\\customer-workspace"
                        className="min-w-0 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2 font-mono text-[11px] text-[#1a1a1a] outline-none focus:border-[#1a1a1a]"
                        aria-label="Backend local workspace path"
                      />
                      <button
                        type="button"
                        data-testid="settings-workspace-bind-submit"
                        onClick={bindProjectWorkspaceFromSettings}
                        disabled={settingsBackendProjectSyncDisabled || workspaceBindDraft.saving || !workspaceBindDraft.path.trim()}
                        className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${settingsBackendProjectSyncDisabled || workspaceBindDraft.saving || !workspaceBindDraft.path.trim() ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                      >
                        <Save size={12} className="inline-block mr-2" />Bind workspace
                      </button>
                    </div>
                    <label className="mt-3 flex items-start gap-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                      <input
                        data-testid="settings-workspace-bind-create-if-missing"
                        type="checkbox"
                        className="mt-0.5"
                        checked={workspaceBindDraft.createIfMissing}
                        disabled={workspaceBindDraft.saving}
                        onChange={(event) => {
                          const createIfMissing = event.currentTarget.checked;
                          setWorkspaceBindDraft(prev => ({ ...prev, createIfMissing }));
                        }}
                      />
                      <span>Create the directory if it does not exist</span>
                    </label>
                    <div data-testid="settings-workspace-bind-receipt" className="mt-4 grid gap-2 break-all font-mono text-[10px] leading-relaxed text-[#7d786b] md:grid-cols-2">
                      <div>Bind route: {activeProject?.id ? `/projects/${activeProject.id}/workspace/bind` : '/projects/:id/workspace/bind'}</div>
                      <div>Local runtime: {activeProject?.id ? `/projects/${activeProject.id}/local-runtime` : '/projects/:id/local-runtime'}</div>
                      <div>Current path: {currentWorkspacePath || 'not bound'}</div>
                      <div>Bound at: {currentWorkspaceBoundAt || 'not bound'}</div>
                      <div>Receipt: {workspaceBindDraft.receipt?.route || 'none'}</div>
                      <div className={workspaceBindDraft.error ? 'text-[#8f1e18]' : 'text-[#7d786b]'}>Status: {workspaceBindDraft.error || (workspaceBindDraft.saving ? 'binding' : currentWorkspacePath ? 'backend-bound' : 'waiting for backend bind')}</div>
                    </div>
                  </div>
                  <div data-testid="settings-workspace-capability-contract" className="grid gap-3 lg:grid-cols-2">
                    {workspaceCapabilityRows.length ? workspaceCapabilityRows.map(row => (
                      <div
                        key={row.id}
                        data-testid={`settings-workspace-capability-${row.id}`}
                        className="border border-[#d1d0c9] bg-[#f8f6ee] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className={labelClass}>{row.category || 'workspace'}</div>
                            <div className="mt-1 font-mono text-xs text-[#1a1a1a]">{row.label}</div>
                          </div>
                          <span className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${row.status === 'backend-backed' ? 'border-[#59684b] text-[#3f5136]' : row.status === 'browser-local' ? 'border-[#7d786b] text-[#5f5a50]' : 'border-[#b9a55f] text-[#75631d]'}`}>
                            {row.status}
                          </span>
                        </div>
                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-[#5f5a50]">{row.detail}</p>
                        <div className="mt-3 space-y-1 font-mono text-[10px] leading-relaxed text-[#7d786b]">
                          <div>Route: {row.requiredBackendRoute}</div>
                          <div>Editable: {row.editable ? 'yes' : 'no'}</div>
                          <div>Production blocker: {row.productionBlocker}</div>
                        </div>
                      </div>
                    )) : (
                      <div data-testid="settings-workspace-capabilities-missing" className="border border-[#b9a55f] bg-[#fbf7df] p-4 font-mono text-[11px] leading-relaxed text-[#75631d] lg:col-span-2">
                        <div>
                          Workspace capability contract not synced. Sync or update project settings through {activeProject?.id ? `/projects/${activeProject.id}/project-settings` : '/projects/:id/project-settings'} before treating workspace controls as backend-backed.
                        </div>
                        <div className="mt-3">
                          <SmallButton
                            data-testid="settings-workspace-capabilities-sync-project-state"
                            onClick={() => syncBackendProjectState({ silent: false })}
                            disabled={settingsBackendProjectSyncDisabled}
                          >
                            Sync project settings
                          </SmallButton>
                        </div>
                      </div>
                    )}
                  </div>
                  <div data-testid="settings-workspace-memory-readiness" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">/projects/:id/memory-readiness</div>
                        <div className="mt-2 font-serif text-xl text-[#1a1a1a]">Backend project memory readiness</div>
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                          Read-only project memory proof from backend state, transcripts, meeting summaries, evidence/artifact index rows, and persistence adapter planning. No managed memory write control is exposed here.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="settings-workspace-sync-memory-readiness"
                        onClick={() => syncBackendProjectMemoryReadiness({ silent: false })}
                        disabled={settingsBackendProjectSyncDisabled}
                        className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${settingsBackendProjectSyncDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                      >
                        <Database size={12} className="inline-block mr-2" />Sync memory
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span data-testid="settings-workspace-memory-readiness-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${projectMemoryReadinessSourceClass}`}>
                        {projectMemoryReadinessSourceStatus}
                      </span>
                      <span data-testid="settings-workspace-memory-readiness-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">
                        {projectMemoryReadinessSourceDetail}
                      </span>
                    </div>
                    <div data-testid="settings-workspace-memory-readiness-status" className="mt-4 grid gap-2 font-mono text-[11px] text-[#5f5a50] sm:grid-cols-4">
                      <div>Status: {backendProjectMemoryReadiness?.status || 'not synced'}</div>
                      <div>Rows: {backendProjectMemoryReadiness?.summary?.rowCount ?? 0}</div>
                      <div>Evidence rows: {backendProjectMemoryReadiness?.summary?.evidenceIndexRowCount ?? 0}</div>
                      <div>Production: {backendProjectMemoryReadiness?.readyForProduction ? 'ready' : 'blocked'}</div>
                    </div>
                    <div data-testid="settings-workspace-memory-readiness-route" className="mt-2 break-all font-mono text-[10px] leading-relaxed text-[#7d786b]">
                      Route: {backendProjectMemoryReadiness?.backendRoutes?.memoryReadiness || (activeProject?.id ? `/projects/${activeProject.id}/memory-readiness` : '/projects/:id/memory-readiness')}
                    </div>
                    {projectMemoryReadinessRows.length > 0 && (
                      <div data-testid="settings-workspace-memory-readiness-rows" className="mt-4 grid gap-3 lg:grid-cols-2">
                        {projectMemoryReadinessRows.slice(0, 4).map(row => (
                          <div key={row.id} data-testid={`settings-workspace-memory-readiness-row-${row.id}`} className="border border-[#d1d0c9] bg-[#f5f4f0] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={labelClass}>{row.status || 'memory'}</div>
                                <div className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-[#1a1a1a]">{row.label}</div>
                              </div>
                              <span className="shrink-0 border border-[#7d786b] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f5a50]">
                                {row.recordCount || 0}
                              </span>
                            </div>
                            <div className="mt-3 space-y-1 font-mono text-[10px] leading-relaxed text-[#7d786b]">
                              <div className="line-clamp-2">{row.detail}</div>
                              <div className="break-all">Route: {row.route || 'not available'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {projectMemoryReadinessGates.length > 0 && (
                      <div data-testid="settings-workspace-memory-readiness-gates" className="mt-4 grid gap-2 font-mono text-[10px] text-[#5f5a50] sm:grid-cols-2">
                        {projectMemoryReadinessGates.slice(0, 4).map(gate => (
                          <div key={gate.id} data-testid={`settings-workspace-memory-readiness-gate-${gate.id}`} className="flex items-center justify-between gap-3 border border-[#d1d0c9] bg-[#f5f4f0] px-3 py-2">
                            <span className="min-w-0 truncate">{gate.label || gate.id}</span>
                            <span className={`shrink-0 border px-2 py-0.5 uppercase tracking-[0.12em] ${gate.status === 'passed' ? 'border-[#59684b] text-[#3f5136]' : gate.status === 'blocked' ? 'border-[#b9a55f] text-[#75631d]' : 'border-[#8f1e18] text-[#8f1e18]'}`}>
                              {gate.status || 'unknown'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div data-testid="settings-workspace-meeting-summaries" className="border border-[#d1d0c9] bg-[#f8f6ee] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7d786b]">/projects/:id/meeting-summaries</div>
                        <div className="mt-2 font-serif text-xl text-[#1a1a1a]">Backend meeting summaries</div>
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                          Read-only summaries derived from backend transcripts, timeline logs, and event-ledger proof. No browser-local meeting notes are treated as saved summaries.
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="settings-workspace-sync-meeting-summaries"
                        onClick={() => syncBackendMeetingSummaries({ silent: false })}
                        disabled={settingsBackendProjectSyncDisabled}
                        className={`shrink-0 border border-[#1a1a1a] px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${settingsBackendProjectSyncDisabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#d1d0c9] hover:text-black'}`}
                      >
                        <MessageSquare size={12} className="inline-block mr-2" />Sync summaries
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span data-testid="settings-workspace-meeting-summary-source" className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${meetingSummarySourceClass}`}>
                        {meetingSummarySourceStatus}
                      </span>
                      <span data-testid="settings-workspace-meeting-summary-source-detail" className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7d786b]">
                        {meetingSummarySourceDetail}
                      </span>
                    </div>
                    <div data-testid="settings-workspace-meeting-summary-status" className="mt-4 grid gap-2 font-mono text-[11px] text-[#5f5a50] sm:grid-cols-4">
                      <div>Status: {backendMeetingSummaries?.status || 'not synced'}</div>
                      <div>Rows: {backendMeetingSummaries?.summary?.rowCount ?? 0}</div>
                      <div>Proof ids: {backendMeetingSummaries?.summary?.proofIdCount ?? 0}</div>
                      <div>Timeline ids: {backendMeetingSummaries?.summary?.timelineLogIdCount ?? 0}</div>
                    </div>
                    <div data-testid="settings-workspace-meeting-summary-route" className="mt-2 break-all font-mono text-[10px] leading-relaxed text-[#7d786b]">
                      Route: {activeProject?.id ? `/projects/${activeProject.id}/meeting-summaries` : '/projects/:id/meeting-summaries'}
                    </div>
                    {meetingSummaryRows.length > 0 && (
                      <div data-testid="settings-workspace-meeting-summary-rows" className="mt-4 grid gap-3 lg:grid-cols-2">
                        {meetingSummaryRows.slice(0, 4).map(row => (
                          <div key={row.id} data-testid={`settings-workspace-meeting-summary-${row.channelId}`} className="border border-[#d1d0c9] bg-[#f5f4f0] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={labelClass}>{row.meetingKind || 'meeting'} / {row.channelName || row.channelId}</div>
                                <div className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-[#1a1a1a]">{row.topic}</div>
                              </div>
                              <span className={`shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${row.readyForLocalMvp ? 'border-[#59684b] text-[#3f5136]' : 'border-[#b9a55f] text-[#75631d]'}`}>
                                {row.readyForLocalMvp ? 'proofed' : 'proof gap'}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-1 font-mono text-[10px] leading-relaxed text-[#7d786b]">
                              <div>Messages: {row.messageCount || 0} / turns {row.meetingTurnCount || 0}</div>
                              <div>Actions: {row.actionCount || 0} / evidence {row.evidenceCount || 0} / risks {row.riskCount || 0}</div>
                              <div className="break-all">Transcript: {row.transcriptRoute || 'not available'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div data-testid="settings-workspace-route-contract" className="border border-[#d1d0c9] bg-[#f5f4f0] p-4 font-mono text-[11px] leading-relaxed text-[#5f5a50]">
                    <div data-testid="settings-global-language-local-preference">Global language: browser-local UI preference only</div>
                    <div>Project settings write: {activeProject?.id ? `/projects/${activeProject.id}/project-settings` : '/projects/:id/project-settings'}</div>
                    <div>Project read model: {activeProject?.id ? `/projects/${activeProject.id}` : '/projects/:id'}</div>
                    <div>Workspace capability contract: {workspaceCapabilities?.schemaVersion || 'project-workspace-capabilities/v1'}</div>
                  </div>
                </div>
    </div>
  );
}
