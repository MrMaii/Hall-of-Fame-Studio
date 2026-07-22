export function createAgentProjectMemoryStore({
  projects = [],
  messages = [],
  kickoffMeetings = [],
  securityAccessAuditRecords = [],
  accessReplayRecords = [],
  messageLimit = 0,
  hydrateProject = (project) => project,
} = {}) {
  const retainMessages = (items = []) => {
    const limit = Number(messageLimit);
    return Number.isFinite(limit) && limit > 0 ? items.slice(-limit) : items;
  };
  const projectMap = new Map();
  const kickoffMeetingMap = new Map();
  let chatMessages = retainMessages([...messages]);
  let auditRecords = [...securityAccessAuditRecords];
  let replayRecords = [...accessReplayRecords].filter((record) => record?.replayKey);
  let revision = 0;

  projects.forEach((project) => {
    if (!project?.id) return;
    projectMap.set(project.id, hydrateProject(project));
  });
  kickoffMeetings.forEach((meeting) => {
    if (!meeting?.id) return;
    kickoffMeetingMap.set(meeting.id, meeting);
  });

  const requireProject = (projectId) => {
    const project = projectMap.get(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    return project;
  };

  return {
    getRevision() {
      return revision;
    },
    listProjects() {
      return [...projectMap.values()];
    },
    getProject(projectId) {
      return requireProject(projectId);
    },
    saveProject(project) {
      if (!project?.id) throw new Error('Cannot save a project without an id.');
      const hydrated = hydrateProject(project);
      projectMap.set(hydrated.id, hydrated);
      revision += 1;
      return hydrated;
    },
    deleteProject(projectId) {
      const project = requireProject(projectId);
      projectMap.delete(projectId);
      chatMessages = chatMessages.filter((message) => message.projectId !== projectId);
      auditRecords = auditRecords.filter((record) => record.projectId !== projectId);
      replayRecords = replayRecords.filter((record) => record.projectId !== projectId);
      revision += 1;
      return project;
    },
    listKickoffMeetings() {
      return [...kickoffMeetingMap.values()];
    },
    getKickoffMeeting(meetingId) {
      const meeting = kickoffMeetingMap.get(meetingId);
      if (!meeting) throw new Error(`Kickoff meeting not found: ${meetingId}`);
      return meeting;
    },
    saveKickoffMeeting(meeting) {
      if (!meeting?.id) throw new Error('Cannot save a kickoff meeting without an id.');
      kickoffMeetingMap.set(meeting.id, meeting);
      revision += 1;
      return meeting;
    },
    appendMessages(nextMessages = []) {
      if (!nextMessages.length) return [];
      chatMessages = retainMessages([...chatMessages, ...nextMessages]);
      revision += 1;
      return nextMessages;
    },
    getMessages(projectId) {
      return chatMessages.filter((message) => !projectId || message.projectId === projectId);
    },
    appendSecurityAuditRecords(records = []) {
      const nextRecords = (Array.isArray(records) ? records : [records]).filter((record) => record?.id);
      if (!nextRecords.length) return [];
      const existingIds = new Set(auditRecords.map((record) => record.id));
      const uniqueRecords = nextRecords.filter((record) => !existingIds.has(record.id));
      if (!uniqueRecords.length) return [];
      auditRecords = [...auditRecords, ...uniqueRecords];
      return uniqueRecords;
    },
    listSecurityAuditRecords(projectId) {
      return auditRecords.filter((record) => !projectId || record.projectId === projectId);
    },
    pruneAccessReplayRecords(nowMs = Date.now()) {
      const before = replayRecords.length;
      replayRecords = replayRecords.filter((record) => {
        const expiresAtMs = Date.parse(record.expiresAt || '');
        return !Number.isFinite(expiresAtMs) || expiresAtMs > Number(nowMs);
      });
      return before - replayRecords.length;
    },
    getAccessReplayRecord(replayKey) {
      const key = String(replayKey || '');
      if (!key) return null;
      return replayRecords.find((record) => record.replayKey === key) || null;
    },
    appendAccessReplayRecords(records = []) {
      const nextRecords = (Array.isArray(records) ? records : [records]).filter((record) => record?.replayKey);
      if (!nextRecords.length) return [];
      const existingKeys = new Set(replayRecords.map((record) => record.replayKey));
      const uniqueRecords = nextRecords.filter((record) => !existingKeys.has(record.replayKey));
      if (!uniqueRecords.length) return [];
      replayRecords = [...replayRecords, ...uniqueRecords];
      return uniqueRecords;
    },
    listAccessReplayRecords(projectId) {
      return replayRecords.filter((record) => !projectId || record.projectId === projectId);
    },
    snapshot() {
      return {
        projects: [...projectMap.values()],
        messages: chatMessages,
        kickoffMeetings: [...kickoffMeetingMap.values()],
        securityAccessAuditRecords: auditRecords,
        accessReplayRecords: replayRecords,
      };
    },
  };
}
