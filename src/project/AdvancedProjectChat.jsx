import {
  AtSign,
  ChevronLeft,
  FileText,
  Hash,
  Headphones,
  MessageSquare,
  Network,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Reply,
  ScrollText,
  Search,
  Send,
  Users,
} from 'lucide-react';

export default function AdvancedProjectChat({ view }) {
  const {
    activeChannel,
    activeChannelId,
    activeChannelPinned,
    activeLanguage,
    activeProject,
    activeTranscriptSearchKey,
    backendChannelTranscript,
    backendChannelTranscriptRequired,
    backendChatSendRequired,
    backendStation,
    canAttachBackendTranscriptFile,
    canCreateChannel,
    canCreateLocalChannel,
    canMentionBackendTranscriptMessage,
    canPinBackendTranscriptChannel,
    canPinBackendTranscriptMessage,
    canReplyBackendTranscriptMessage,
    canSearchBackendTranscript,
    canSendChat,
    canSyncBackendTranscriptMembers,
    channelsByCategory,
    chatAttachmentInputRef,
    chatInput,
    chatMembersPanelOpen,
    chatText,
    collaborationMessageMeta,
    createProjectTranscriptChannel,
    exitProjectScene,
    filteredMentions,
    focusedChatProofIds,
    handleBackendTranscriptAttachmentChange,
    handleChatChange,
    handleChatKeyDown,
    idleMembers,
    insertMention,
    mentionBackendTranscriptMessage,
    mentionIndex,
    onlineMembers,
    openManagerFlowNode,
    openProjectChatProof,
    openProjectTimelineProof,
    pinBackendTranscriptChannel,
    pinBackendTranscriptMessage,
    pinnedTranscriptRowsByMessageId,
    receiptSummary,
    replyToBackendTranscriptMessage,
    runBackendTranscriptSearch,
    safeMessageNodeId,
    sceneTransition,
    setActiveChannelId,
    setBackendStation,
    setFocusedChatProofIds,
    setMentionFilter,
    setMentionIndex,
    setSettingsOpen,
    setSettingsTab,
    setShowMentionPicker,
    setTranscriptSearchDraft,
    setTranscriptSearchResults,
    shouldAttemptBackendProjectWrite,
    shouldMerge,
    showMentionPicker,
    submitChatInput,
    syncBackendProjectTranscripts,
    syncBackendTranscriptMemberPresence,
    toggleBackendTranscriptMembers,
    transcriptAttachmentRowsByMessageId,
    transcriptMemberPresence,
    transcriptMentionRowsByMentionMessageId,
    transcriptMentionRowsBySourceMessageId,
    transcriptReplyRowsByParentMessageId,
    transcriptReplyRowsByReplyMessageId,
    transcriptSearchDraft,
    transcriptSearchResult,
    triggerBackendTranscriptAttachmentPicker,
    visibleMessages,
    visibleProofCount,
  } = view;
  const messageRoleLabel = (role = '') => ({
    'change-discussion': activeLanguage === 'zh' ? '变更讨论' : 'Change Discussion',
    'change-confirmed': activeLanguage === 'zh' ? '变更已确认' : 'Change Confirmed',
  }[role] || chatText(role));

  return (
      <div data-testid="project-chat-panel" className="project-room relative h-screen overflow-hidden text-[#efe2bd]">
        {sceneTransition && <div className="absolute right-16 top-1/2 z-50 w-32 h-32 -translate-y-1/2 bg-[#8f1e18] scene-bubble" />}

        <div className="relative z-10 h-full grid grid-cols-[240px_1fr_260px]">
          {/* LEFT: Channel Sidebar */}
          <aside className="bg-[#1a130e]/95 border-r border-[#3a2a1c] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#3a2a1c] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button data-testid="project-scene-back" aria-label="返回项目" onClick={exitProjectScene} className="text-[#bcae86] hover:text-[#efe2bd] transition-colors"><ChevronLeft size={16} /></button>
                <span className="font-serif text-lg truncate">{activeProject.name}</span>
              </div>
              <button
                type="button"
                data-testid="project-chat-create-transcript-channel"
                onClick={createProjectTranscriptChannel}
                disabled={!canCreateChannel}
                title={canCreateLocalChannel ? 'Create offline channel' : 'Create backend transcript channel'}
                className="text-[#7d6a49] hover:text-[#efe2bd] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
              >
                <Plus size={15} />
              </button>
            </div>
            {!canCreateChannel && (
              <div data-testid="backend-channel-create-required" className="border-b border-[#3a2a1c] bg-[#251b13] px-4 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] leading-relaxed">
                <div>Backend target required before creating real transcript rooms; local-only rooms are disabled for this project.</div>
                <button
                  type="button"
                  data-testid="backend-channel-create-open-deployment"
                  onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}
                  className="mt-2 inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 text-[#efe2bd] hover:border-[#efe2bd]"
                >
                  Open Settings Deployment
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {Object.entries(channelsByCategory).map(([cat, channels]) => channels.length > 0 && (
                <div key={cat}>
                  <div className="flex items-center gap-2 px-2 mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7d6a49]">
                      {chatText(cat === 'text' ? 'Text Channels' : cat === 'decisions' ? 'Decisions' : 'Voice')}
                    </span>
                  </div>
                  {channels.map(channel => {
                    const isActive = activeChannelId === channel.id;
                    return (
                      <button key={channel.id} onClick={() => {
                        setActiveChannelId(channel.id);
                        if (shouldAttemptBackendProjectWrite(activeProject)) {
                          syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id, channelId: channel.id });
                        }
                      }}
                        className={`w-full text-left px-3 py-2 rounded relative flex items-center gap-2 transition-all duration-150 group ${isActive ? 'bg-[#3a2a1c] text-[#efe2bd]' : 'text-[#bcae86] hover:bg-[#251b13] hover:text-[#efe2bd]'}`}>
                        {isActive && <div className="channel-indicator" />}
                        {cat === 'voice' ? <Headphones size={14} className="shrink-0 opacity-60" /> : <Hash size={14} className="shrink-0 opacity-60" />}
                        <span className="font-mono text-[11px] tracking-wide truncate">{channel.name}</span>
                        {channel.unread > 0 && !isActive && <div className="unread-dot ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-[#3a2a1c] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#8f1e18] text-[#efe2bd] flex items-center justify-center font-serif text-sm relative">
                D
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-sm truncate">{chatText('Director')}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">{chatText('Online')}</div>
              </div>
            </div>
          </aside>

          {/* CENTER: Message Stream */}
          <main className="flex flex-col overflow-hidden bg-[#171411]/90">
            <header className="border-b border-[#3a2a1c] px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Hash size={18} className="text-[#7d6a49]" />
                <span className="font-serif text-2xl">{activeChannel?.name}</span>
                {activeChannelPinned && (
                  <span data-testid="project-chat-channel-pinned" className="inline-flex items-center gap-1 bg-[#b9782b] px-2 py-0.5 font-mono text-[8px] uppercase tracking-widest text-[#1a130e]">
                    <Pin size={10} />
                    {chatText('Pinned')}
                  </span>
                )}
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] hidden sm:block">{chatText(activeChannel?.description)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="project-chat-tool-pin"
                  onClick={pinBackendTranscriptChannel}
                  disabled={!canPinBackendTranscriptChannel || activeChannelPinned}
                  title={activeChannelPinned ? 'Channel pinned through backend transcript proof.' : 'Pin this channel through backend transcript proof.'}
                  className={`p-2 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${activeChannelPinned ? 'text-[#b9782b]' : 'text-[#7d6a49] hover:text-[#efe2bd]'}`}
                >
                  <Pin size={15} />
                </button>
                <form
                  data-testid="project-chat-transcript-search-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    runBackendTranscriptSearch({ projectId: activeProject.id, channelId: activeChannelId, query: transcriptSearchDraft });
                  }}
                  className="flex items-center gap-1 border border-[#3a2a1c] bg-[#251b13] px-2 py-1"
                >
                  <input
                    data-testid="project-chat-transcript-search-input"
                    value={transcriptSearchDraft}
                    onChange={(event) => setTranscriptSearchDraft(event.target.value)}
                    placeholder={chatText('Search transcript')}
                    className="w-24 bg-transparent font-mono text-[10px] text-[#efe2bd] outline-none placeholder-[#7d6a49]/70 sm:w-36"
                  />
                  <button
                    type="submit"
                    data-testid="project-chat-transcript-search-submit"
                    disabled={!canSearchBackendTranscript || backendStation.loading}
                    title={canSearchBackendTranscript ? 'Search backend transcript.' : 'Type a query to search the backend transcript.'}
                    className={`p-1.5 transition-colors ${canSearchBackendTranscript && !backendStation.loading ? 'text-[#efe2bd] hover:bg-[#3a2a1c]' : 'cursor-not-allowed text-[#7d6a49] opacity-45'}`}
                  >
                    <Search size={14} />
                  </button>
                </form>
                <button
                  type="button"
                  data-testid="project-chat-tool-members"
                  onClick={toggleBackendTranscriptMembers}
                  disabled={!canSyncBackendTranscriptMembers}
                  title="Sync backend member presence for this transcript channel."
                  className={`p-2 transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${chatMembersPanelOpen ? 'text-[#efe2bd] bg-[#3a2a1c]' : 'text-[#7d6a49] hover:text-[#efe2bd]'}`}
                >
                  <Users size={15} />
                </button>
              </div>
            </header>

            {chatMembersPanelOpen && (
              <div data-testid="project-chat-member-presence-panel" className="border-b border-[#3a2a1c] bg-[#1a130e] px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">{chatText('Backend member presence')}</div>
                    <div className="mt-1 font-serif text-sm text-[#efe2bd]">
                      {transcriptMemberPresence?.summary?.presentCount ?? 0}/{transcriptMemberPresence?.summary?.memberCount ?? 0} {chatText('present')} / {transcriptMemberPresence?.summary?.directTargetCount ?? 0} {chatText('direct')}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="project-chat-member-presence-sync"
                    onClick={() => syncBackendTranscriptMemberPresence({ silent: false, projectId: activeProject.id, channelId: activeChannelId })}
                    disabled={!canSyncBackendTranscriptMembers}
                    className="inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] hover:border-[#efe2bd] hover:text-[#efe2bd] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={10} />
                    {chatText('Sync')}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {(transcriptMemberPresence?.members || activeProject.team || []).map((member) => {
                    const memberId = member.agentId || member.id;
                    const present = member.status === 'present';
                    return (
                      <div key={memberId} data-testid={`project-chat-member-presence-${memberId}`} className="border border-[#3a2a1c] bg-[#251b13] px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-serif text-sm text-[#efe2bd]">{member.name}</div>
                            <div className="truncate font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{member.role || member.title || ''}</div>
                          </div>
                          <span className={`node-status-tag shrink-0 ${present ? 'bg-[#59684b] text-white' : 'bg-[#3a2a1c] text-[#bcae86]'}`}>
                            {present ? 'present' : 'pending'}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-4 gap-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          <div>{member.authoredCount || 0}<span className="block text-[7px]">sent</span></div>
                          <div>{member.receivedCount || 0}<span className="block text-[7px]">seen</span></div>
                          <div>{member.directReceivedCount || 0}<span className="block text-[7px]">direct</span></div>
                          <div>{member.openObligationCount || 0}<span className="block text-[7px]">todo</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {backendChannelTranscriptRequired && !backendChannelTranscript && (
                <div data-testid="project-chat-transcript-backend-required" className="mb-4 border border-[#8f1e18] bg-[#251b13] px-4 py-3 text-[#efe2bd]">
                  <div className="font-mono text-[9px] uppercase tracking-widest">{chatText('Backend transcript required')}</div>
                  <div className="mt-2 font-mono text-[10px] leading-relaxed text-[#bcae86]">
                    {chatText('This real backend project requires the channel transcript route before local messages can be shown as collaboration proof.')}
                  </div>
                  <button
                    type="button"
                    data-testid="project-chat-transcript-sync"
                    onClick={() => syncBackendProjectTranscripts({ silent: false, projectId: activeProject.id, channelId: activeChannelId })}
                    disabled={!canSyncBackendTranscriptMembers}
                    className="mt-3 border border-[#bcae86] px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#3a2a1c] disabled:opacity-40"
                  >
                    {chatText('Sync transcript')}
                  </button>
                </div>
              )}
              {transcriptSearchResult && (
                <div data-testid="project-chat-transcript-search-results" className="mb-4 border border-[#7b6542] bg-[#251b13] px-4 py-3 text-[#efe2bd]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest">{chatText('Backend transcript search')}</div>
                      <div className="mt-1 font-mono text-[10px] leading-relaxed text-[#bcae86]">
                        {transcriptSearchResult.resultCount || 0} {chatText('match(es)')} / {chatText('route')} {transcriptSearchResult.backendRoutes?.search || '/projects/:id/transcripts/search'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTranscriptSearchResults(prev => {
                          const next = { ...prev };
                          delete next[activeTranscriptSearchKey];
                          return next;
                        });
                        setBackendStation(prev => {
                          const nextSearches = { ...(prev.transcriptSearches || {}) };
                          delete nextSearches[activeTranscriptSearchKey];
                          return { ...prev, transcriptSearches: nextSearches };
                        });
                        setFocusedChatProofIds([]);
                      }}
                      className="border border-[#7b6542] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-[#efe2bd] hover:bg-[#3a2a1c]"
                    >
                      {chatText('Clear')}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(transcriptSearchResult.results || []).slice(0, 5).map(result => (
                      <button
                        key={result.messageId}
                        type="button"
                        data-testid={`project-chat-transcript-search-result-${safeMessageNodeId(result.messageId)}`}
                        onClick={() => openProjectChatProof(activeProject, [result.messageId], result.channelId || activeChannelId || 'main')}
                        className="border border-[#3a2a1c] bg-[#171411] px-3 py-2 text-left hover:border-[#bcae86]"
                      >
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          <span>{result.channelId}</span>
                          <span>{result.author}</span>
                          <span className="break-all">{result.messageId}</span>
                        </div>
                        <div className="mt-1 font-serif text-sm leading-snug text-[#d8c99f]">{chatText(result.snippet || result.text || '')}</div>
                      </button>
                    ))}
                    {!(transcriptSearchResult.results || []).length && (
                      <div className="border border-[#3a2a1c] bg-[#171411] px-3 py-2 font-mono text-[10px] text-[#bcae86]">
                        {chatText('No backend transcript matches.')}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 break-all font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                    Checksum: {transcriptSearchResult.checksum || 'pending'}
                  </div>
                </div>
              )}
              {focusedChatProofIds.length > 0 && (
                <div className="mb-4 border border-[#8f1e18] bg-[#251b13] px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#efe2bd]">
                  <span className="sr-only">Proof focus:</span>{chatText('Proof focus')}: {visibleProofCount}/{focusedChatProofIds.length} {chatText(focusedChatProofIds.length === 1 ? 'message in this channel' : 'messages in this channel')}
                  <button
                    type="button"
                    onClick={() => setFocusedChatProofIds([])}
                    className="ml-3 text-[#bcae86] hover:text-white"
                  >
                    {chatText('Clear')}
                  </button>
                </div>
              )}
              {visibleMessages.map((message, idx) => {
                const prev = idx > 0 ? visibleMessages[idx - 1] : null;
                const merged = shouldMerge(prev, message);
                const isFocusedProof = focusedChatProofIds.includes(message.id);

                if (message.type === 'system') {
                  return (
                    <div
                      key={message.id}
                      data-chat-proof-id={message.id}
                      className={`flex items-center gap-3 my-4 chat-msg-enter ${isFocusedProof ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : ''}`}
                    >
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#7d6a49] px-3 shrink-0">{message.text}</span>
                      <div className="flex-1 h-px bg-[#3a2a1c]" />
                    </div>
                  );
                }

                if (message.type === 'decision') {
                  const receipts = receiptSummary(message);
                  return (
                    <div
                      key={message.id}
                      data-chat-proof-id={message.id}
                      className={`node-card--dark my-3 p-4 border-l-4 chat-msg-enter ${isFocusedProof ? 'border-l-[#b9782b] ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : 'border-l-[#59684b]'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="node-id-tag">{message.decisionId || 'DEC-000'}</span>
                        <span className="node-status-tag bg-[#59684b] text-white">{chatText('Confirmed')}</span>
                      </div>
                      <p className="font-serif text-lg leading-relaxed text-[#efe2bd]">{message.text}</p>
                      <div className="flex items-center gap-2 mt-2 font-mono text-[9px] uppercase tracking-widest text-[#7d6a49]">
                        <span>{message.author}</span>
                        {message.role && <><span className="opacity-40">/</span><span>{messageRoleLabel(message.role)}</span></>}
                        {message.visibility?.receiptCount > 0 && (
                          <><span className="opacity-40">/</span><span>{chatText('Seen')} {message.visibility.receiptCount} / {chatText('Direct')} {message.visibility.directTargetCount || 0}</span></>
                        )}
                        <span className="ml-auto">{message.time}</span>
                      </div>
                      {message.visibility?.receiptCount > 0 && (
                        <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                          {chatText('Heard by')} {receipts.heardText}{receipts.heardOverflow ? ` +${receipts.heardOverflow}` : ''} / {chatText('Direct target')} {receipts.directText}{receipts.directOverflow ? ` +${receipts.directOverflow}` : ''}
                        </div>
                      )}
                    </div>
                  );
                }

                const collaborationMeta = collaborationMessageMeta(message);
                if (collaborationMeta) {
                  const receipts = receiptSummary(message);
                  const nodeTestId = `chat-collaboration-node-${collaborationMeta.kind}-${safeMessageNodeId(collaborationMeta.entityId)}`;
                  return (
                    <div
                      key={message.id}
                      data-testid={nodeTestId}
                      data-chat-proof-id={message.id}
                      className={`node-card--dark my-3 p-4 border-l-4 chat-msg-enter ${isFocusedProof ? 'border-l-[#b9782b] ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : 'border-l-[#d8c99f]'}`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1 mb-2">
                            <span className="node-status-tag bg-[#d8c99f] text-[#251b13]">{collaborationMeta.label}</span>
                            <span className="node-status-tag bg-[#251b13] text-[#efe2bd]">{String(collaborationMeta.status || 'recorded')}</span>
                            <span className="node-status-tag bg-[#59684b] text-white">{String(collaborationMeta.subject || 'proof')}</span>
                          </div>
                          <div className="font-serif text-lg leading-tight text-[#efe2bd]">{String(collaborationMeta.title || message.text || 'Collaboration node')}</div>
                          <p className="mt-1 font-serif text-sm leading-relaxed text-[#d8c99f]">{chatText(message.text)}</p>
                          <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] break-words">
                            Route: {collaborationMeta.route || 'backend route pending'}
                          </div>
                          <div className="mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] break-words">
                            {String(collaborationMeta.detail || '')}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1 md:justify-end">
                          <button
                            type="button"
                            data-testid={`${nodeTestId}-chat-proof`}
                            onClick={() => openProjectChatProof(activeProject, collaborationMeta.proofIds, message.channelId || 'main')}
                            disabled={!collaborationMeta.proofIds.length}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <MessageSquare size={10} /> Chat proof
                          </button>
                          <button
                            type="button"
                            data-testid={`${nodeTestId}-timeline-proof`}
                            onClick={() => openProjectTimelineProof(collaborationMeta.timelineLogIds)}
                            disabled={!collaborationMeta.timelineLogIds.length}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ScrollText size={10} /> Timeline proof
                          </button>
                          <button
                            type="button"
                            data-testid={`${nodeTestId}-flow-node`}
                            onClick={() => openManagerFlowNode(collaborationMeta.flowNodeId, {
                              project: activeProject,
                              chatProofIds: collaborationMeta.proofIds,
                              timelineLogIds: collaborationMeta.timelineLogIds,
                            })}
                            disabled={!collaborationMeta.flowNodeId}
                            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-2 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Network size={10} /> Flow node
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                          ['Chat Proof', collaborationMeta.proofIds.length],
                          ['Timeline Proof', collaborationMeta.timelineLogIds.length],
                          ['Event Proof', collaborationMeta.eventIds.length],
                        ].map(([label, value]) => (
                          <div key={`${nodeTestId}-${label}`} className="border border-[#3a2a1c] bg-[#251b13]/75 px-2 py-1">
                            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
                            <div className="font-serif text-sm leading-tight text-[#efe2bd]">{value}</div>
                          </div>
                        ))}
                      </div>
                      {message.visibility?.receiptCount > 0 && (
                        <div data-testid={`${nodeTestId}-receipts`} className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                          {chatText('Seen')} {message.visibility.receiptCount} / {chatText('Direct')} {message.visibility.directTargetCount || 0}
                          <span className="block">{chatText('Heard by')} {receipts.heardText}{receipts.heardOverflow ? ` +${receipts.heardOverflow}` : ''}</span>
                          <span className="block">{chatText('Direct target')} {receipts.directText}{receipts.directOverflow ? ` +${receipts.directOverflow}` : ''}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                const isMention = message.type === 'mention';
                const isFile = message.type === 'file';
                const receipts = receiptSummary(message);
                const pinnedTranscriptRow = pinnedTranscriptRowsByMessageId.get(String(message.id || ''));
                const isPinnedTranscriptMessage = Boolean(pinnedTranscriptRow);
                const replyRowsForMessage = transcriptReplyRowsByParentMessageId.get(String(message.id || '')) || [];
                const replyTranscriptRow = transcriptReplyRowsByReplyMessageId.get(String(message.id || ''));
                const mentionRowsForMessage = transcriptMentionRowsBySourceMessageId.get(String(message.id || '')) || [];
                const mentionTranscriptRow = transcriptMentionRowsByMentionMessageId.get(String(message.id || ''));
                const attachmentTranscriptRow = transcriptAttachmentRowsByMessageId.get(String(message.id || ''));

                return (
                  <div
                    key={message.id}
                    data-chat-proof-id={message.id}
                    className={`relative group chat-msg-enter ${isMention ? 'mention-pulse' : ''} ${merged ? 'mt-0.5' : 'mt-4'} ${isFocusedProof ? 'ring-2 ring-[#b9782b] ring-offset-2 ring-offset-[#171411]' : ''}`}
                  >
                    {isMention && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8f1e18] rounded-r" />}
                    <div className={`py-1.5 px-3 rounded transition-colors hover:bg-[#251b13]/40 ${isMention ? 'bg-[#8f1e18]/8 pl-4' : ''}`}>
                      {!merged && (
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-9 h-9 rounded-full bg-[#3a2a1c] text-[#efe2bd] flex items-center justify-center font-serif text-sm shrink-0 border border-[#7b6542]/40">
                            {message.author.charAt(0)}
                          </div>
                          <span className="font-serif text-base font-medium text-[#efe2bd]">{message.author}</span>
                          {message.role && <span className="node-status-tag bg-[#3a2a1c] text-[#bcae86] border border-[#7b6542]/30">{messageRoleLabel(message.role)}</span>}
                          <span className="font-mono text-[9px] text-[#7d6a49] ml-auto">{message.time}</span>
                        </div>
                      )}
                      <div className={merged ? 'pl-12' : 'pl-12'}>
                        {replyTranscriptRow?.parentMessageId && (
                          <div data-testid={`project-chat-message-reply-context-${message.id}`} className="mb-1.5 border-l-2 border-[#7b6542] pl-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            {chatText('Reply to')} {replyTranscriptRow.parentAuthor || replyTranscriptRow.parentMessage?.author || 'message'} / {replyTranscriptRow.parentMessageId}
                          </div>
                        )}
                        {mentionTranscriptRow?.sourceMessageId && (
                          <div data-testid={`project-chat-message-mention-context-${message.id}`} className="mb-1.5 border-l-2 border-[#8f1e18] pl-2 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                            {chatText('Mention from')} {mentionTranscriptRow.sourceAuthor || mentionTranscriptRow.sourceMessage?.author || 'message'} / {mentionTranscriptRow.sourceMessageId}
                          </div>
                        )}
                        <p className="font-serif text-[17px] leading-relaxed text-[#d8c99f]">{chatText(message.text)}</p>
                        {isPinnedTranscriptMessage && (
                          <span data-testid={`project-chat-message-pinned-${message.id}`} className="inline-flex mt-1.5 items-center gap-1 bg-[#b9782b] text-[#1a130e] font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">
                            <Pin size={10} />
                            {chatText('Pinned')}
                          </span>
                        )}
                        {replyRowsForMessage.length > 0 && (
                          <span data-testid={`project-chat-message-replied-${message.id}`} className="inline-flex mt-1.5 ml-1 items-center gap-1 bg-[#3a2a1c] text-[#bcae86] font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">
                            <Reply size={10} />
                            {replyRowsForMessage.length} {chatText('Reply')}
                          </span>
                        )}
                        {mentionRowsForMessage.length > 0 && (
                          <span data-testid={`project-chat-message-mentioned-${message.id}`} className="inline-flex mt-1.5 ml-1 items-center gap-1 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">
                            <AtSign size={10} />
                            {mentionRowsForMessage.length} {chatText('Mention')}
                          </span>
                        )}
                        {isMention && message.weight && (
                          <span className="inline-flex mt-1.5 bg-[#8f1e18] text-white font-mono text-[8px] uppercase tracking-widest px-2 py-0.5">{chatText('Weight')}: {chatText(message.weight)}</span>
                        )}
                        {isFile && (
                          <div className="node-card--dark inline-flex items-center gap-3 mt-2 px-3 py-2">
                            <FileText size={16} className="text-[#b9782b] shrink-0" />
                            <div>
                              {message.fileId && <span className="node-id-tag mr-2">{message.fileId}</span>}
                              <span className="font-mono text-[10px] tracking-wide text-[#bcae86]">{message.meta}</span>
                              {attachmentTranscriptRow && (
                                <span data-testid={`project-chat-message-attachment-${message.id}`} className="block mt-1 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">
                                  {attachmentTranscriptRow.contentType || 'attachment'} / {attachmentTranscriptRow.sizeBytes || 0} bytes / proof ready
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {message.visibility?.receiptCount > 0 && (
                          <div data-testid={`message-receipts-${message.id}`} className="mt-1.5 font-mono text-[8px] uppercase tracking-widest text-[#7d6a49] leading-relaxed">
                            {chatText('Seen')} {message.visibility.receiptCount} / {chatText('Direct')} {message.visibility.directTargetCount || 0}
                            <span className="block">{chatText('Heard by')} {receipts.heardText}{receipts.heardOverflow ? ` +${receipts.heardOverflow}` : ''}</span>
                            <span className="block">{chatText('Direct target')} {receipts.directText}{receipts.directOverflow ? ` +${receipts.directOverflow}` : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="absolute right-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-[#1a130e] border border-[#3a2a1c] rounded p-0.5 -translate-y-1/2 z-10">
                      <button
                        type="button"
                        data-testid={`project-chat-message-reply-${message.id}`}
                        onClick={() => replyToBackendTranscriptMessage(message)}
                        disabled={!canReplyBackendTranscriptMessage}
                        title={chatInput.trim() ? 'Reply to this message through backend transcript proof.' : 'Select this message as the backend reply target.'}
                        className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <Reply size={13} />
                      </button>
                      <button
                        type="button"
                        data-testid={`project-chat-message-mention-${message.id}`}
                        onClick={() => mentionBackendTranscriptMessage(message)}
                        disabled={!canMentionBackendTranscriptMessage}
                        title={chatInput.trim() ? 'Mention this message through backend transcript proof.' : 'Select this message as the backend mention source.'}
                        className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        <AtSign size={13} />
                      </button>
                      <button
                        type="button"
                        data-testid={`project-chat-message-pin-${message.id}`}
                        onClick={() => pinBackendTranscriptMessage(message)}
                        disabled={!canPinBackendTranscriptMessage || isPinnedTranscriptMessage}
                        title={isPinnedTranscriptMessage ? 'Pinned through backend transcript proof.' : 'Pin this message through backend transcript proof.'}
                        className={`p-1.5 transition-colors ${isPinnedTranscriptMessage ? 'text-[#b9782b] opacity-70 cursor-default' : 'text-[#7d6a49] hover:text-[#efe2bd] disabled:opacity-35 disabled:cursor-not-allowed'}`}
                      >
                        <Pin size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-2 relative">
              {showMentionPicker && filteredMentions.length > 0 && (
                <div className="absolute left-4 right-4 bottom-full mb-1 bg-[#1a130e] border border-[#3a2a1c] rounded shadow-2xl z-20 max-h-52 overflow-y-auto">
                  {filteredMentions.map((m, idx) => (
                    <button key={m.id || m.name} onClick={() => { insertMention(m.name); setMentionFilter(''); }}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${idx === mentionIndex ? 'bg-[#3a2a1c]' : 'hover:bg-[#251b13]'}`}>
                      <div className="w-7 h-7 rounded-full bg-[#3a2a1c] border border-[#7b6542]/40 flex items-center justify-center font-serif text-xs text-[#efe2bd]">{m.name.charAt(0).toUpperCase()}</div>
                      <span className="font-serif text-sm">@{m.name}</span>
                      {m.role && <span className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{m.role}</span>}
                    </button>
                  ))}
                </div>
              )}
              {backendChatSendRequired && (
                <div data-testid="backend-chat-send-required" className="mb-2 border border-[#8f1e18] bg-[#251b13] px-3 py-2 font-mono text-[8px] uppercase tracking-widest text-[#bcae86] leading-relaxed">
                  <div>Backend target required before sending real project chat; browser-local chat proof is disabled for this project.</div>
                  <button
                    type="button"
                    data-testid="backend-chat-send-open-deployment"
                    onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}
                    className="mt-2 inline-flex items-center gap-1 border border-[#7b6542] px-2 py-1 text-[#efe2bd] hover:border-[#efe2bd]"
                  >
                    Open Settings Deployment
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-[#251b13] border border-[#3a2a1c] rounded-lg px-3 py-2 focus-within:border-[#7b6542] transition-colors">
                <input
                  ref={chatAttachmentInputRef}
                  type="file"
                  data-testid="project-chat-attachment-input"
                  className="hidden"
                  onChange={handleBackendTranscriptAttachmentChange}
                />
                <button
                  type="button"
                  data-testid="project-chat-attachment"
                  onClick={triggerBackendTranscriptAttachmentPicker}
                  disabled={!canAttachBackendTranscriptFile}
                  title="Attach a file through backend transcript proof."
                  className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <Paperclip size={16} />
                </button>
                <button onClick={() => { setShowMentionPicker(!showMentionPicker); setMentionFilter(''); setMentionIndex(0); }}
                  className="p-1.5 text-[#7d6a49] hover:text-[#efe2bd] transition-colors font-mono text-sm font-bold">@</button>
                <input aria-label="发送项目消息" value={chatInput} onChange={handleChatChange} onKeyDown={handleChatKeyDown}
                  placeholder={activeLanguage === 'zh' ? `发送到 #${activeChannel?.name || '频道'}...` : `Message #${activeChannel?.name || 'channel'}...`}
                  className="flex-1 bg-transparent outline-none font-serif text-base text-[#efe2bd] placeholder-[#7d6a49]/60" />
                <button
                  type="button"
                  data-testid="project-chat-send"
                  onClick={submitChatInput}
                  disabled={!canSendChat}
                  title={backendChatSendRequired ? 'Configure the backend URL before sending real project chat.' : 'Send project chat'}
                  className="bg-[#8f1e18] hover:bg-[#a62a22] text-white px-4 py-1.5 rounded flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <Send size={13} /> {chatText('Send')}
                </button>
              </div>
            </div>
          </main>

          {/* RIGHT: Members Panel */}
          <aside className="bg-[#1a130e]/95 border-l border-[#3a2a1c] flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-[#3a2a1c]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7d6a49]">{chatText('Members')} - {activeProject.team.length + 1}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#59684b] mb-2 px-2">{chatText('Online')} - {onlineMembers.length + 1}</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors group">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[#8f1e18] text-[#efe2bd] flex items-center justify-center font-serif text-sm">D</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-serif text-sm truncate text-[#efe2bd]">Director</div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#59684b]">You</div>
                    </div>
                  </div>
                  {onlineMembers.map(agent => (
                    <div key={agent.id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors group">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#3a2a1c] border border-[#7b6542]/40 text-[#efe2bd] flex items-center justify-center font-serif text-sm">{agent.name.charAt(0)}</div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#59684b] border-2 border-[#1a130e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="font-serif text-sm truncate text-[#efe2bd]">{agent.name}</div>
                          {agent.isLeader && <span className="node-status-tag bg-[#8f1e18] text-white">Leader</span>}
                        </div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                      </div>
                      <button onClick={() => insertMention(agent.name)} className="p-1 text-[#7d6a49] opacity-0 group-hover:opacity-100 hover:text-[#efe2bd] transition-all"><AtSign size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
              {idleMembers.length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#b9782b] mb-2 px-2">{chatText('Idle')} - {idleMembers.length}</div>
                  {idleMembers.map(agent => (
                    <div key={agent.id} className="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#251b13] transition-colors opacity-60">
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-[#3a2a1c] border border-[#7b6542]/30 text-[#bcae86] flex items-center justify-center font-serif text-sm">{agent.name.charAt(0)}</div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#b9782b] border-2 border-[#1a130e]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-sm truncate text-[#bcae86]">{agent.name}</div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#7d6a49]">{agent.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
  );
}
