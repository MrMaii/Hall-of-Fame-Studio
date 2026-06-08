export function createAgentProjectMemoryStore({
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  hydrateProject = (project) => project,
} = {}) {
  const projectMap = new Map();
  const kickoffMeetingMap = new Map();
  let chatMessages = [...messages].slice(-messageLimit);

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
      return hydrated;
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
      return meeting;
    },
    appendMessages(nextMessages = []) {
      if (!nextMessages.length) return [];
      chatMessages = [...chatMessages, ...nextMessages].slice(-messageLimit);
      return nextMessages;
    },
    getMessages(projectId) {
      return chatMessages.filter((message) => !projectId || message.projectId === projectId);
    },
    snapshot() {
      return {
        projects: [...projectMap.values()],
        messages: chatMessages,
        kickoffMeetings: [...kickoffMeetingMap.values()],
      };
    },
  };
}
