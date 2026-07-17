import { localizeText } from '../i18n/index.jsx';
import AdvancedProjectChat from './AdvancedProjectChat.jsx';

export default function ProjectChatRouteView({ view }) {
  const {
    activeChannelId,
    activeLanguage,
    activeProject,
    allowLocalRuntimeFallbackForActiveProject,
    backendChannelTranscript,
    backendChannelTranscriptRequired,
    backendChatSendRequired,
    backendStation,
    canSendChat,
    chatAttachmentInputRef,
    chatChannels,
    chatInput,
    createProjectTranscriptChannel,
    exitProjectScene,
    firstBackendRoute,
    focusedChatProofIds,
    handleBackendTranscriptAttachmentChange,
    insertMention,
    mentionBackendTranscriptMessage,
    mentionFilter,
    mentionIndex,
    openManagerFlowNode,
    openProjectChatProof,
    openProjectTimelineProof,
    pinBackendTranscriptChannel,
    pinBackendTranscriptMessage,
    replyToBackendTranscriptMessage,
    runBackendTranscriptSearch,
    sceneTransition,
    setActiveChannelId,
    setBackendStation,
    setChatInput,
    setFocusedChatProofIds,
    setMentionFilter,
    setMentionIndex,
    setSettingsOpen,
    setSettingsTab,
    setShowMentionPicker,
    setTranscriptSearchDraft,
    setTranscriptSearchResults,
    shouldAttemptBackendProjectWrite,
    showMentionPicker,
    submitChatInput,
    syncBackendProjectTranscripts,
    syncBackendTranscriptMemberPresence,
    toggleBackendTranscriptMembers,
    transcriptSearchDraft,
    transcriptSearchResults,
    triggerBackendTranscriptAttachmentPicker,
    visibleMessages,
  } = view;

  const chatText = (value) => localizeText(value, activeLanguage);
  const localChatCardProofRowsAllowed = !backendChannelTranscriptRequired;
  const chatBackendManagerDashboard = String(backendStation.managerDashboard?.projectId || '').toLowerCase() === String(activeProject.id || '').toLowerCase()
    ? backendStation.managerDashboard
    : null;
  const backendCollaborationProofReadModel = chatBackendManagerDashboard
    && Array.isArray(chatBackendManagerDashboard.evidenceSearches?.rows)
    && Array.isArray(chatBackendManagerDashboard.submissions?.rows)
    && Array.isArray(chatBackendManagerDashboard.submissionReviews?.rows)
    && Array.isArray(chatBackendManagerDashboard.evidenceSourceReviews?.rows)
    ? {
      evidenceRows: chatBackendManagerDashboard.evidenceSearches.rows,
      submissionRows: chatBackendManagerDashboard.submissions.rows,
      reviewRows: chatBackendManagerDashboard.submissionReviews.rows,
      sourceReviewRows: chatBackendManagerDashboard.evidenceSourceReviews.rows,
    }
    : null;
  const chatCardEvidenceRows = backendCollaborationProofReadModel?.evidenceRows || (localChatCardProofRowsAllowed ? activeProject.evidenceSearches || [] : []);
  const chatCardSubmissionRows = backendCollaborationProofReadModel?.submissionRows || (localChatCardProofRowsAllowed ? activeProject.agentSubmissions || [] : []);
  const chatCardReviewRows = backendCollaborationProofReadModel?.reviewRows || (localChatCardProofRowsAllowed ? activeProject.submissionReviews || [] : []);
  const chatCardSourceReviewRows = backendCollaborationProofReadModel?.sourceReviewRows || (localChatCardProofRowsAllowed ? activeProject.evidenceSourceReviews || [] : []);

  const activeTranscriptSearchKey = `${activeProject.id}:${activeChannelId}`;
  const transcriptSearchResult = transcriptSearchResults[activeTranscriptSearchKey]
    || backendStation.transcriptSearches?.[activeTranscriptSearchKey]
    || null;
  const activeTranscriptMemberPresenceKey = `${activeProject.id}:${activeChannelId}`;
  const transcriptMemberPresence = backendStation.transcriptMemberPresence?.[activeTranscriptMemberPresenceKey] || null;
  const chatMembersPanelOpen = Boolean(view.chatMembersPanelOpenDrafts[activeTranscriptMemberPresenceKey]);
  const canSearchBackendTranscript = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && Boolean(transcriptSearchDraft.trim());
  const canSyncBackendTranscriptMembers = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const handleToggleBackendTranscriptMembers = () => toggleBackendTranscriptMembers({
    key: activeTranscriptMemberPresenceKey,
    nextOpen: !chatMembersPanelOpen,
    shouldSync: !chatMembersPanelOpen || !transcriptMemberPresence,
  });

  const pinnedTranscriptRows = backendChannelTranscript?.pinnedMessages || [];
  const channelPinRows = backendChannelTranscript?.channelPins || [];
  const activeChannelPinned = channelPinRows.some(row => row.active !== false);
  const pinnedTranscriptRowsByMessageId = new Map(
    pinnedTranscriptRows.map(row => [String(row.messageId || ''), row])
  );
  const transcriptReplyRows = backendChannelTranscript?.replies || [];
  const transcriptReplyRowsByParentMessageId = transcriptReplyRows.reduce((map, row) => {
    const key = String(row.parentMessageId || '');
    if (!key) return map;
    map.set(key, [...(map.get(key) || []), row]);
    return map;
  }, new Map());
  const transcriptReplyRowsByReplyMessageId = new Map(
    transcriptReplyRows.map(row => [String(row.replyMessageId || ''), row])
  );
  const transcriptMentionRows = backendChannelTranscript?.mentions || [];
  const transcriptMentionRowsBySourceMessageId = transcriptMentionRows.reduce((map, row) => {
    const key = String(row.sourceMessageId || '');
    if (!key) return map;
    map.set(key, [...(map.get(key) || []), row]);
    return map;
  }, new Map());
  const transcriptMentionRowsByMentionMessageId = new Map(
    transcriptMentionRows.map(row => [String(row.mentionMessageId || ''), row])
  );
  const transcriptAttachmentRows = backendChannelTranscript?.attachments || [];
  const transcriptAttachmentRowsByMessageId = new Map(
    transcriptAttachmentRows.map(row => [String(row.attachmentMessageId || ''), row])
  );
  const canPinBackendTranscriptMessage = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const canPinBackendTranscriptChannel = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const canReplyBackendTranscriptMessage = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const canMentionBackendTranscriptMessage = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const canAttachBackendTranscriptFile = Boolean(activeProject)
    && shouldAttemptBackendProjectWrite(activeProject)
    && !backendStation.loading;
  const activeChannel = chatChannels.find(channel => channel.id === activeChannelId);
  const visibleProofCount = visibleMessages.filter(message => focusedChatProofIds.includes(message.id)).length;
  const channelsByCategory = {
    text: chatChannels.filter(channel => channel.category === 'text'),
    decisions: chatChannels.filter(channel => channel.category === 'decisions'),
    voice: chatChannels.filter(channel => channel.category === 'voice'),
  };
  const canCreateLocalChannel = allowLocalRuntimeFallbackForActiveProject(activeProject);
  const canCreateChannel = Boolean(activeProject) && (canCreateLocalChannel || shouldAttemptBackendProjectWrite(activeProject));

  const shouldMerge = (prev, curr) => {
    if (!prev || prev.author !== curr.author) return false;
    if (prev.type === 'system' || curr.type === 'system') return false;
    if (['submission', 'submission-review', 'evidence-search', 'evidence-source-review'].includes(prev.type)) return false;
    if (['submission', 'submission-review', 'evidence-search', 'evidence-source-review'].includes(curr.type)) return false;
    return true;
  };
  const receiptSummary = (message = {}) => {
    const nameFor = (agentId) => activeProject.team.find(agent => agent.id === agentId || agent.name === agentId)?.name || agentId;
    const heardNames = (message.heardBy || message.receipts?.map(receipt => receipt.agentId) || [])
      .map(nameFor)
      .filter(Boolean);
    const directNames = (message.directTargetIds || message.receipts?.filter(receipt => receipt.mode === 'direct').map(receipt => receipt.agentId) || [])
      .map(nameFor)
      .filter(Boolean);
    return {
      heardText: heardNames.slice(0, 4).join(' / ') || 'none',
      directText: directNames.slice(0, 4).join(' / ') || 'none',
      heardOverflow: Math.max(0, heardNames.length - 4),
      directOverflow: Math.max(0, directNames.length - 4),
    };
  };
  const safeMessageNodeId = (value = '') => String(value || '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 90);
  const collaborationMessageMeta = (message = {}) => {
    if (!['submission', 'submission-review', 'evidence-search', 'evidence-source-review'].includes(message.type)) return null;
    const projectId = activeProject.id;
    if (message.type === 'submission') {
      const submission = chatCardSubmissionRows.find(item => String(item.id || '') === String(message.submissionId || '')) || {};
      const artifactType = submission.artifactType || message.artifactType || 'artifact';
      const isRevision = artifactType === 'revision-note' || submission.respondsToReviewId || submission.revisesSubmissionId;
      const isFinal = artifactType === 'final-deliverable' || submission.status === 'final';
      return {
        kind: isFinal ? 'final-deliverable' : isRevision ? 'revision' : 'submission',
        label: isFinal ? 'Final Deliverable' : isRevision ? 'Revision Submission' : 'Agent Submission',
        title: submission.title || message.text || artifactType.replace(/-/g, ' '),
        detail: submission.summary || submission.reviewStatus || submission.status || 'Submitted for review',
        status: submission.reviewStatus || submission.status || 'submitted',
        route: firstBackendRoute(message.submissionRoute, message.resourceRoute, message.route, submission.submissionRoute, submission.proofRoute, submission.apiPath, submission.route, projectId && message.submissionId ? `/projects/${projectId}/submissions/${message.submissionId}` : null),
        flowNodeId: message.flowNodeId || message.managerFlowNodeId || submission.flowNodeId || (message.submissionId ? `agent-submission-${message.submissionId}` : null),
        timelineLogIds: Array.from(new Set([submission.timelineLogId, ...(submission.timelineLogIds || [])].filter(Boolean))),
        eventIds: Array.from(new Set([submission.eventId, ...(submission.eventIds || [])].filter(Boolean))),
        proofIds: [message.id].filter(Boolean),
        entityId: message.submissionId || message.id,
        subject: artifactType,
      };
    }
    if (message.type === 'submission-review') {
      const review = chatCardReviewRows.find(item => String(item.id || '') === String(message.reviewId || '')) || {};
      const submission = chatCardSubmissionRows.find(item => String(item.id || '') === String(message.submissionId || review.submissionId || '')) || {};
      return {
        kind: 'submission-review',
        label: 'Submission Review',
        title: submission.title ? `Review: ${submission.title}` : message.text || 'Submission review',
        detail: review.comments || (review.requestedChanges || []).join(' / ') || message.text || 'Review recorded',
        status: review.verdict || review.status || 'reviewed',
        route: firstBackendRoute(message.submissionReviewRoute, message.resourceRoute, message.route, review.submissionReviewRoute, review.proofRoute, review.apiPath, review.route, projectId && message.reviewId ? `/projects/${projectId}/submission-reviews/${message.reviewId}` : null),
        flowNodeId: message.flowNodeId || message.managerFlowNodeId || review.flowNodeId || (message.reviewId ? `submission-review-${message.reviewId}` : null),
        timelineLogIds: Array.from(new Set([review.timelineLogId, ...(review.timelineLogIds || [])].filter(Boolean))),
        eventIds: Array.from(new Set([review.eventId, ...(review.eventIds || [])].filter(Boolean))),
        proofIds: [message.id].filter(Boolean),
        entityId: message.reviewId || message.id,
        subject: review.verdict || review.status || 'review',
      };
    }
    if (message.type === 'evidence-source-review') {
      const review = chatCardSourceReviewRows.find(item => String(item.id || '') === String(message.reviewId || '')) || {};
      return {
        kind: 'evidence-source-review',
        label: 'Source Review',
        title: review.sourceTitle || message.text || 'Evidence source review',
        detail: review.comments || review.decision || 'Source review recorded',
        status: review.decision || review.status || 'reviewed',
        route: firstBackendRoute(message.evidenceSourceReviewRoute, message.resourceRoute, message.route, review.evidenceSourceReviewRoute, review.proofRoute, review.apiPath, review.route, projectId ? `/projects/${projectId}/evidence-source-review-workflow#${message.reviewId || ''}` : null),
        flowNodeId: message.flowNodeId || message.managerFlowNodeId || review.flowNodeId || (message.reviewId ? `evidence-source-review-${message.reviewId}` : 'evidence-source-review-workflow'),
        timelineLogIds: Array.from(new Set([review.timelineLogId, ...(review.timelineLogIds || [])].filter(Boolean))),
        eventIds: Array.from(new Set([review.eventId, ...(review.eventIds || [])].filter(Boolean))),
        proofIds: [message.id].filter(Boolean),
        entityId: message.reviewId || message.id,
        subject: review.sourceKey || 'source',
      };
    }
    const evidenceSearch = chatCardEvidenceRows.find(item => String(item.id || '') === String(message.evidenceSearchId || '')) || {};
    return {
      kind: 'evidence-search',
      label: 'Evidence Search',
      title: evidenceSearch.query || message.text || 'Evidence search',
      detail: evidenceSearch.evidenceJudgement?.summary || evidenceSearch.qualitySummary?.status || evidenceSearch.purpose || 'Evidence search recorded',
      status: evidenceSearch.evidenceJudgement?.status || evidenceSearch.status || 'recorded',
      route: firstBackendRoute(message.evidenceSearchRoute, message.resourceRoute, message.route, evidenceSearch.evidenceSearchRoute, evidenceSearch.proofRoute, evidenceSearch.apiPath, evidenceSearch.route, projectId && message.evidenceSearchId ? `/projects/${projectId}/evidence-searches/${message.evidenceSearchId}` : null),
      flowNodeId: message.flowNodeId || message.managerFlowNodeId || evidenceSearch.flowNodeId || (message.evidenceSearchId ? `evidence-search-${message.evidenceSearchId}` : null),
      timelineLogIds: Array.from(new Set([evidenceSearch.timelineLogId, ...(evidenceSearch.timelineLogIds || [])].filter(Boolean))),
      eventIds: Array.from(new Set([evidenceSearch.eventId, ...(evidenceSearch.eventIds || [])].filter(Boolean))),
      proofIds: [message.id].filter(Boolean),
      entityId: message.evidenceSearchId || message.id,
      subject: `${evidenceSearch.sourceCount || evidenceSearch.sources?.length || 0} source(s)`,
    };
  };

  const mentionCandidates = [{ id: '_all', name: 'all', label: '所有人', role: '' }, ...activeProject.team.map(agent => ({ ...agent, label: agent.name }))];
  const filteredMentions = mentionCandidates.filter(member => member.name.toLowerCase().includes(mentionFilter.toLowerCase()));
  const handleChatKeyDown = (event) => {
    if (showMentionPicker) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setMentionIndex(index => Math.min(index + 1, filteredMentions.length - 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setMentionIndex(index => Math.max(index - 1, 0)); return; }
      if (event.key === 'Enter' && filteredMentions[mentionIndex]) { event.preventDefault(); insertMention(filteredMentions[mentionIndex].name); setMentionFilter(''); return; }
      if (event.key === 'Escape') { setShowMentionPicker(false); setMentionFilter(''); return; }
    }
    if (event.key === 'Enter' && !showMentionPicker) submitChatInput();
  };
  const handleChatChange = (event) => {
    const value = event.target.value;
    setChatInput(value);
    const lastAt = value.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowMentionPicker(true); setMentionFilter(''); setMentionIndex(0);
    } else if (lastAt >= 0 && !value.slice(lastAt).includes(' ')) {
      setShowMentionPicker(true); setMentionFilter(value.slice(lastAt + 1)); setMentionIndex(0);
    } else {
      setShowMentionPicker(false); setMentionFilter('');
    }
  };
  const onlineMembers = activeProject.team.slice(0, Math.max(2, activeProject.team.length));
  const idleMembers = [];

  return (
    <AdvancedProjectChat
      view={{
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
        toggleBackendTranscriptMembers: handleToggleBackendTranscriptMembers,
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
      }}
    />
  );
}
