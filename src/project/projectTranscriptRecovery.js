export function transcriptRecoveryKey(projectId, channelId = 'main') {
  return `${projectId || ''}:${channelId || 'main'}`;
}

export function transcriptRecoveryStatusesFromResults({
  projectId,
  channelIds = [],
  channelResults = [],
} = {}) {
  return Object.fromEntries(channelIds.map((channelId, index) => {
    const result = channelResults[index];
    const ready = result?.status === 'fulfilled' && result.value?.channelId === channelId;
    return [transcriptRecoveryKey(projectId, channelId), ready ? 'ready' : 'offline'];
  }));
}

export function resolveProjectTranscriptStatus({
  required = false,
  projectId,
  channelId = 'main',
  transcript = null,
  statuses = {},
} = {}) {
  if (!required || transcript) return 'ready';
  return statuses[transcriptRecoveryKey(projectId, channelId)] || 'checking';
}

export function shouldShowLocalTranscriptRecovery({
  required = false,
  status = 'ready',
  localMessageCount = 0,
} = {}) {
  return required && status === 'offline' && localMessageCount > 0;
}

export function projectTranscriptPresentation({
  status = 'ready',
  messageCount = 0,
  usingLocalRecovery = false,
  language = 'en',
} = {}) {
  const zh = language === 'zh';
  if (usingLocalRecovery) {
    return {
      state: 'local-recovery',
      title: zh ? '正在显示本地恢复的聊天记录' : 'Showing recovered local chat history',
      detail: zh
        ? '后端记录暂时无法验证；这些消息保留在当前设备上，可在连接恢复后重新同步。'
        : 'The backend transcript is temporarily unavailable. These messages are restored from this device and can be synced again after the connection recovers.',
    };
  }
  if (messageCount > 0) return { state: 'ready', title: '', detail: '' };
  if (status === 'checking' || status === 'idle') {
    return {
      state: 'restoring',
      title: zh ? '聊天记录正在恢复' : 'Restoring chat history',
      detail: zh ? '正在读取这个频道的历史消息。' : 'Reading this channel\'s message history.',
    };
  }
  if (status === 'offline') {
    return {
      state: 'offline',
      title: zh ? '暂时无法恢复聊天记录' : 'Chat history is temporarily unavailable',
      detail: zh
        ? '连接恢复后可重新加载；现在不会把它误显示为空频道。'
        : 'Reload after the connection recovers; this channel is not being treated as empty.',
    };
  }
  return {
    state: 'empty',
    title: zh ? '这里还没有消息' : 'No messages yet',
    detail: zh
      ? '发送第一条信息后，团队回复会显示在这里。'
      : 'Team replies will appear here after the first message is sent.',
  };
}
