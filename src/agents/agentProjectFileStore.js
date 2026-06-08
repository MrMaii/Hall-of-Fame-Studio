import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentProjectMemoryStore } from './agentProjectStore.js';

const STORE_VERSION = 1;

function resolveStorePath(filePath) {
  if (!filePath) throw new Error('createAgentProjectFileStore requires filePath.');
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

function readSnapshot(filePath) {
  if (!existsSync(filePath)) return { projects: [], messages: [], kickoffMeetings: [] };
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return { projects: [], messages: [], kickoffMeetings: [] };
  const parsed = JSON.parse(raw);
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    kickoffMeetings: Array.isArray(parsed.kickoffMeetings) ? parsed.kickoffMeetings : [],
  };
}

function writeSnapshot(filePath, snapshot) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify({
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    projects: snapshot.projects || [],
    messages: snapshot.messages || [],
    kickoffMeetings: snapshot.kickoffMeetings || [],
  }, null, 2));
  renameSync(tempPath, filePath);
}

export function createAgentProjectFileStore({
  filePath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  messageLimit = 240,
  hydrateProject = (project) => project,
  replaceWithSeed = false,
} = {}) {
  const resolvedPath = resolveStorePath(filePath);
  const existingSnapshot = replaceWithSeed ? { projects: [], messages: [], kickoffMeetings: [] } : readSnapshot(resolvedPath);
  const seedProjects = projects.length ? projects : existingSnapshot.projects;
  const seedMessages = messages.length ? messages : existingSnapshot.messages;
  const seedKickoffMeetings = kickoffMeetings.length ? kickoffMeetings : existingSnapshot.kickoffMeetings;
  const memoryStore = createAgentProjectMemoryStore({
    projects: seedProjects,
    messages: seedMessages,
    kickoffMeetings: seedKickoffMeetings,
    messageLimit,
    hydrateProject,
  });

  const persist = () => {
    writeSnapshot(resolvedPath, memoryStore.snapshot());
  };

  persist();

  return {
    listProjects() {
      return memoryStore.listProjects();
    },
    getProject(projectId) {
      return memoryStore.getProject(projectId);
    },
    saveProject(project) {
      const saved = memoryStore.saveProject(project);
      persist();
      return saved;
    },
    listKickoffMeetings() {
      return memoryStore.listKickoffMeetings();
    },
    getKickoffMeeting(meetingId) {
      return memoryStore.getKickoffMeeting(meetingId);
    },
    saveKickoffMeeting(meeting) {
      const saved = memoryStore.saveKickoffMeeting(meeting);
      persist();
      return saved;
    },
    appendMessages(nextMessages = []) {
      const appended = memoryStore.appendMessages(nextMessages);
      if (appended.length) persist();
      return appended;
    },
    getMessages(projectId) {
      return memoryStore.getMessages(projectId);
    },
    snapshot() {
      return memoryStore.snapshot();
    },
    filePath: resolvedPath,
  };
}
