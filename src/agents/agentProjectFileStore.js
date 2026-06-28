import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgentProjectMemoryStore } from './agentProjectStore.js';

const STORE_VERSION = 1;
const SECURITY_AUDIT_LOG_VERSION = 1;

function resolveStorePath(filePath) {
  if (!filePath) throw new Error('createAgentProjectFileStore requires filePath.');
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

function resolveSecurityAuditLogPath(filePath, auditLogPath) {
  if (auditLogPath === false) return null;
  if (auditLogPath) return auditLogPath instanceof URL ? fileURLToPath(auditLogPath) : auditLogPath;
  return `${filePath}.security-audit.jsonl`;
}

function mergeSecurityAuditRecords(...groups) {
  const byId = new Map();
  groups.flat().forEach((record) => {
    if (!record?.id) return;
    byId.set(record.id, {
      ...(byId.get(record.id) || {}),
      ...record,
    });
  });
  return [...byId.values()].sort((a, b) => {
    const sequenceA = Number(a.streamSequence);
    const sequenceB = Number(b.streamSequence);
    if (Number.isFinite(sequenceA) && Number.isFinite(sequenceB) && sequenceA !== sequenceB) {
      return sequenceA - sequenceB;
    }
    return (Date.parse(a.time) || 0) - (Date.parse(b.time) || 0);
  });
}

function readSecurityAuditLog(filePath) {
  if (!filePath || !existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  return raw.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed.record || parsed;
      } catch {
        return null;
      }
    })
    .filter((record) => record?.id);
}

function appendSecurityAuditLog(filePath, records = []) {
  if (!filePath || !records.length) return;
  mkdirSync(dirname(filePath), { recursive: true });
  const writtenAt = new Date().toISOString();
  const lines = records.map((record) => JSON.stringify({
    auditLogVersion: SECURITY_AUDIT_LOG_VERSION,
    writtenAt,
    record,
  })).join('\n');
  appendFileSync(filePath, `${lines}\n`);
}

function emptySnapshot() {
  return {
    projects: [],
    messages: [],
    kickoffMeetings: [],
    securityAccessAuditRecords: [],
    accessReplayRecords: [],
  };
}

function readSnapshot(filePath) {
  if (!existsSync(filePath)) return emptySnapshot();
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return emptySnapshot();
  const parsed = JSON.parse(raw);
  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    kickoffMeetings: Array.isArray(parsed.kickoffMeetings) ? parsed.kickoffMeetings : [],
    securityAccessAuditRecords: Array.isArray(parsed.securityAccessAuditRecords) ? parsed.securityAccessAuditRecords : [],
    accessReplayRecords: Array.isArray(parsed.accessReplayRecords) ? parsed.accessReplayRecords : [],
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
    securityAccessAuditRecords: snapshot.securityAccessAuditRecords || [],
    accessReplayRecords: snapshot.accessReplayRecords || [],
  }, null, 2));
  renameSync(tempPath, filePath);
}

export function createAgentProjectFileStore({
  filePath,
  securityAuditLogPath,
  projects = [],
  messages = [],
  kickoffMeetings = [],
  securityAccessAuditRecords = [],
  messageLimit = 240,
  hydrateProject = (project) => project,
  replaceWithSeed = false,
} = {}) {
  const resolvedPath = resolveStorePath(filePath);
  const resolvedSecurityAuditLogPath = resolveSecurityAuditLogPath(resolvedPath, securityAuditLogPath);
  const existingSnapshot = replaceWithSeed ? emptySnapshot() : readSnapshot(resolvedPath);
  if (replaceWithSeed && resolvedSecurityAuditLogPath) {
    mkdirSync(dirname(resolvedSecurityAuditLogPath), { recursive: true });
    writeFileSync(resolvedSecurityAuditLogPath, '');
  }
  const existingAuditLogRecords = replaceWithSeed ? [] : readSecurityAuditLog(resolvedSecurityAuditLogPath);
  const seedProjects = projects.length ? projects : existingSnapshot.projects;
  const seedMessages = messages.length ? messages : existingSnapshot.messages;
  const seedKickoffMeetings = kickoffMeetings.length ? kickoffMeetings : existingSnapshot.kickoffMeetings;
  const seedSecurityAccessAuditRecords = securityAccessAuditRecords.length
    ? securityAccessAuditRecords
    : mergeSecurityAuditRecords(existingSnapshot.securityAccessAuditRecords, existingAuditLogRecords);
  const seedAccessReplayRecords = replaceWithSeed ? [] : existingSnapshot.accessReplayRecords;
  const memoryStore = createAgentProjectMemoryStore({
    projects: seedProjects,
    messages: seedMessages,
    kickoffMeetings: seedKickoffMeetings,
    securityAccessAuditRecords: seedSecurityAccessAuditRecords,
    accessReplayRecords: seedAccessReplayRecords,
    messageLimit,
    hydrateProject,
  });

  const persist = () => {
    writeSnapshot(resolvedPath, memoryStore.snapshot());
  };
  const refreshSecurityAuditRecords = () => {
    const memoryRecords = memoryStore.snapshot().securityAccessAuditRecords || [];
    const diskRecords = readSnapshot(resolvedPath).securityAccessAuditRecords || [];
    const logRecords = readSecurityAuditLog(resolvedSecurityAuditLogPath);
    const merged = mergeSecurityAuditRecords(memoryRecords, diskRecords, logRecords);
    const memoryIds = new Set(memoryRecords.map((record) => record.id));
    const logIds = new Set(logRecords.map((record) => record.id));
    const missingRecords = merged.filter((record) => record?.id && !memoryIds.has(record.id));
    if (missingRecords.length) memoryStore.appendSecurityAuditRecords(missingRecords);
    const missingLogRecords = merged.filter((record) => record?.id && !logIds.has(record.id));
    if (missingLogRecords.length) appendSecurityAuditLog(resolvedSecurityAuditLogPath, missingLogRecords);
    return merged;
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
    appendSecurityAuditRecords(records = []) {
      refreshSecurityAuditRecords();
      const appended = memoryStore.appendSecurityAuditRecords(records);
      if (appended.length) {
        appendSecurityAuditLog(resolvedSecurityAuditLogPath, appended);
        persist();
      }
      return appended;
    },
    listSecurityAuditRecords(projectId) {
      return refreshSecurityAuditRecords().filter((record) => !projectId || record.projectId === projectId);
    },
    pruneAccessReplayRecords(nowMs = Date.now()) {
      const removed = memoryStore.pruneAccessReplayRecords(nowMs);
      if (removed) persist();
      return removed;
    },
    getAccessReplayRecord(replayKey) {
      return memoryStore.getAccessReplayRecord(replayKey);
    },
    appendAccessReplayRecords(records = []) {
      const appended = memoryStore.appendAccessReplayRecords(records);
      if (appended.length) persist();
      return appended;
    },
    listAccessReplayRecords(projectId) {
      return memoryStore.listAccessReplayRecords(projectId);
    },
    snapshot() {
      return memoryStore.snapshot();
    },
    filePath: resolvedPath,
    securityAuditLogPath: resolvedSecurityAuditLogPath,
  };
}
