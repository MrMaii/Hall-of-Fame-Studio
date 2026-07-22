const MESSAGE_STATUS_LABELS = {
  zh: {
    submitting: '正在提交',
    saved: '已保存',
    processing: '正在处理',
    completed: '已完成',
    failed: '提交失败，可重试',
    cancelled: '已取消',
    stopped: '已停止，可重试',
    'timed-out': '等待超时，可重试',
    superseded: '已由新消息替代',
  },
  en: {
    submitting: 'Submitting',
    saved: 'Saved',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed, retry available',
    cancelled: 'Cancelled',
    stopped: 'Stopped, retry available',
    'timed-out': 'Timed out, retry available',
    superseded: 'Replaced by a newer message',
  },
};

export function createMeetingUserEntry({
  id,
  text,
  submittedAt = null,
  userMessage = null,
  source = 'war-room-meeting-message',
} = {}) {
  const entryText = String(userMessage?.text || text || '').trim();
  if (!entryText) return null;
  const messageId = userMessage?.id || id;
  if (!messageId) throw new Error('meeting-message-id-required');
  return {
    id: messageId,
    speaker: userMessage?.speaker || userMessage?.author || 'Director',
    role: userMessage?.role || 'User',
    text: entryText,
    score: userMessage?.score || 10,
    source: userMessage?.source || source,
    proofIds: userMessage?.proofIds || [messageId],
    eventIds: userMessage?.eventIds || [],
    submittedAt: submittedAt || userMessage?.sentAt || userMessage?.createdAt || null,
    deliveryStatus: userMessage?.deliveryStatus || 'submitting',
    retryable: userMessage?.retryable === true,
    error: userMessage?.error || null,
  };
}

export function updateMeetingMessageStatus(entries = [], messageId, deliveryStatus, details = {}) {
  return entries.map((entry) => (
    entry.id === messageId
      ? {
          ...entry,
          ...details,
          deliveryStatus,
          retryable: ['failed', 'stopped', 'timed-out'].includes(deliveryStatus) || details.retryable === true,
          error: ['failed', 'timed-out'].includes(deliveryStatus)
            ? details.error || entry.error || `meeting-message-${deliveryStatus}`
            : null,
        }
      : entry
  ));
}

export function meetingMessageStatusLabel(status, language = 'zh') {
  const labels = MESSAGE_STATUS_LABELS[language] || MESSAGE_STATUS_LABELS.zh;
  return labels[status] || status || '';
}

export function selectMeetingResponders(team = [], text = '') {
  const members = Array.isArray(team) ? team.filter(Boolean) : [];
  if (!members.length) return [];
  const normalized = String(text || '').toLowerCase();
  if (/@all\b|@所有人|全员|每个人|everyone|all members/.test(normalized)) return members;
  const mentioned = members.filter((member) => {
    const memberName = String(member.name || '').trim().toLowerCase();
    const memberId = String(member.id || '').trim().toLowerCase();
    return (memberName && normalized.includes(`@${memberName}`))
      || (memberId && normalized.includes(`@${memberId}`));
  });
  if (mentioned.length) return mentioned;
  const leader = members.find((member) => (
    member.isLeader === true
    || member.leader === true
    || String(member.role || '').toLowerCase() === 'leader'
  ));
  return [leader || members[0]];
}

export function meetingTranscriptEntryFromMessage(message = {}) {
  const source = String(message.source || '');
  const isMeetingMessage = source.includes('war-room-meeting')
    || message.type === 'meeting-turn'
    || Boolean(message.meetingTurn)
    || message.time === 'War Room';
  if (!message.id || !message.text || !isMeetingMessage) return null;
  const isDirector = message.authorId === 'director'
    || message.speakerId === 'director'
    || message.author === 'Director'
    || message.speaker === 'Director';
  return {
    id: message.id,
    speaker: message.speaker || message.author || (isDirector ? 'Director' : 'Agent'),
    role: message.role || (isDirector ? 'User' : 'Meeting participant'),
    text: message.text,
    score: message.score || (isDirector ? 10 : 8),
    source,
    proofIds: message.proofIds || [message.id],
    eventIds: message.eventIds || [],
    submittedAt: message.submittedAt || message.sentAt || message.createdAt || message.receipts?.[0]?.seenAt || null,
    replyToTurnId: message.replyToTurnId || message.meetingTurn?.replyToTurnId || message.replyToMessageId || null,
    targetSpeakerId: message.targetSpeakerId || message.meetingTurn?.targetSpeakerId || null,
    addressedAgentIds: message.addressedAgentIds || message.meetingTurn?.addressedAgentIds || [],
    interactionIntent: message.interactionIntent || message.meetingTurn?.interactionIntent || null,
    topicId: message.topicId || message.meetingTurn?.topicId || null,
    exchangeIndex: message.exchangeIndex ?? message.meetingTurn?.exchangeIndex ?? 0,
    ...(isDirector ? { deliveryStatus: 'completed', retryable: false, error: null } : {}),
  };
}

export function mergeMeetingTranscript(existing = [], incoming = []) {
  const byId = new Map();
  existing.forEach((entry) => {
    if (!entry?.id || !entry?.text) return;
    byId.set(entry.id, { ...(byId.get(entry.id) || {}), ...entry });
  });
  [...incoming]
    .sort((left, right) => {
      const timeValue = (entry) => {
        const parsed = Date.parse(entry?.submittedAt || '');
        if (Number.isFinite(parsed)) return parsed;
        const idTimestamp = String(entry?.id || '').match(/(\d{10,})/);
        return idTimestamp ? Number(idTimestamp[1]) : 0;
      };
      return timeValue(left) - timeValue(right);
    })
    .forEach((entry) => {
      if (!entry?.id || !entry?.text) return;
      byId.set(entry.id, { ...(byId.get(entry.id) || {}), ...entry });
    });
  return [...byId.values()];
}
