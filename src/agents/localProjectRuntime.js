import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  watch as watchFileSystem,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { replaceFileWithRetry } from './atomicFileReplace.js';

const DEFAULT_MAX_READ_BYTES = 512 * 1024;
const DEFAULT_MAX_LIST_ENTRIES = 500;
const ARTIFACT_LEDGER_GENESIS_HASH = '0'.repeat(64);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function sha256Json(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function artifactEventHash(event = {}) {
  const { eventHash: _eventHash, ...base } = event;
  return createHash('sha256').update(JSON.stringify(base)).digest('hex');
}

function readArtifactStorageLedger(filePath) {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  const rows = raw.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new Error('artifact-storage-ledger-malformed');
    }
  });
  let previousEventHash = ARTIFACT_LEDGER_GENESIS_HASH;
  rows.forEach((row, index) => {
    if (row.schemaVersion !== 'local-artifact-storage-event/v1' || row.sequence !== index + 1
      || row.previousEventHash !== previousEventHash || row.eventHash !== artifactEventHash(row)) {
      throw new Error('artifact-storage-ledger-integrity-invalid');
    }
    previousEventHash = row.eventHash;
  });
  return rows;
}

function appendArtifactStorageEvent(filePath, input = {}) {
  const rows = readArtifactStorageLedger(filePath);
  const base = {
    schemaVersion: 'local-artifact-storage-event/v1',
    ...input,
    sequence: rows.length + 1,
    previousEventHash: rows.at(-1)?.eventHash || ARTIFACT_LEDGER_GENESIS_HASH,
  };
  const event = { ...base, eventHash: artifactEventHash(base) };
  appendFileSync(filePath, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

function safeProjectId(projectId = 'project') {
  return String(projectId || 'project')
    .replace(/[^A-Za-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96) || 'project';
}

function assertInside(rootPath, candidatePath) {
  const root = resolve(rootPath);
  const candidate = resolve(candidatePath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new Error(`Path escapes allowed root: ${relative(root, candidate) || candidate}`);
  }
  return candidate;
}

function safeJoin(rootPath, pathPart = '') {
  return assertInside(rootPath, resolve(rootPath, String(pathPart || '.')));
}

function fileRecord(rootPath, absolutePath) {
  const linkStat = lstatSync(absolutePath);
  const stat = linkStat.isSymbolicLink() ? linkStat : statSync(absolutePath);
  return {
    path: relative(rootPath, absolutePath).replace(/\\/g, '/') || '.',
    name: absolutePath.split(/[\\/]/).pop(),
    type: linkStat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function assertNoSymbolicLinkSegments(rootPath, absolutePath) {
  const pathFromRoot = relative(resolve(rootPath), resolve(absolutePath));
  if (!pathFromRoot || pathFromRoot === '.') return;
  let cursor = resolve(rootPath);
  for (const segment of pathFromRoot.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (!existsSync(cursor)) break;
    if (lstatSync(cursor).isSymbolicLink()) throw new Error('workspace-symbolic-link-not-supported');
  }
}

function nearestExistingPath(absolutePath) {
  let cursor = absolutePath;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return cursor;
}

function workspaceTarget(rootPath, pathPart = '.', { allowMissing = false } = {}) {
  const normalized = String(pathPart || '.').trim() || '.';
  if (isAbsolute(normalized) || /^[A-Za-z]:[\\/]/.test(normalized)) {
    throw new Error('workspace-absolute-child-path-not-allowed');
  }
  const target = safeJoin(rootPath, normalized);
  const existingTarget = allowMissing ? nearestExistingPath(target) : target;
  if (!existsSync(existingTarget)) throw new Error(`Workspace path not found: ${pathPart}`);
  assertNoSymbolicLinkSegments(rootPath, existingTarget);
  assertInside(realpathSync(rootPath), realpathSync(existingTarget));
  return target;
}

function resolveWorkspacePathAlias(pathPart = '', aliases = {}) {
  const path = String(pathPart || '').replace(/\\/g, '/');
  const match = Object.entries(aliases || {})
    .map(([fromPath, toPath]) => [String(fromPath || '').replace(/\\/g, '/'), String(toPath || '').replace(/\\/g, '/')])
    .filter(([fromPath, toPath]) => fromPath && toPath && (path === fromPath || path.startsWith(`${fromPath}/`)))
    .sort(([left], [right]) => right.length - left.length)[0];
  if (!match) return path;
  return path === match[0] ? match[1] : `${match[1]}${path.slice(match[0].length)}`;
}

function listDirectory(rootPath, relativePath = '.', { recursive = false, maxEntries = DEFAULT_MAX_LIST_ENTRIES } = {}) {
  const startPath = workspaceTarget(rootPath, relativePath);
  if (!existsSync(startPath)) throw new Error(`Workspace path not found: ${relativePath}`);
  if (!statSync(startPath).isDirectory()) return [fileRecord(rootPath, startPath)];

  const entries = [];
  const visit = (directory) => {
    const records = readdirSync(directory)
      .map(name => fileRecord(rootPath, assertInside(rootPath, resolve(directory, name))))
      .sort((left, right) => {
        const leftDirectory = left.type === 'directory' ? 0 : 1;
        const rightDirectory = right.type === 'directory' ? 0 : 1;
        return leftDirectory - rightDirectory || left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
      });
    for (const record of records) {
      if (entries.length >= maxEntries) return;
      entries.push(record);
      if (recursive && record.type === 'directory') visit(assertInside(rootPath, resolve(rootPath, record.path)));
    }
  };
  visit(startPath);
  return entries;
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function writeJsonAtomic(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  replaceFileWithRetry(tempPath, filePath);
}

function readChecksummedJson(filePath, errorCode) {
  if (!existsSync(filePath)) return null;
  let value;
  try {
    value = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    throw new Error(errorCode);
  }
  const { checksum, ...base } = value || {};
  if (!checksum || checksum !== sha256Json(base)) throw new Error(errorCode);
  return value;
}

export function createLocalProjectRuntime({
  rootPath,
  enableCommandExecution = false,
  allowedCommands = [],
  maxReadBytes = DEFAULT_MAX_READ_BYTES,
  artifactRetentionDays = 365,
  workspaceProjectionWriteFile = writeFileSync,
} = {}) {
  if (!rootPath) throw new Error('createLocalProjectRuntime requires rootPath.');
  const resolvedRoot = resolve(rootPath);
  mkdirSync(resolvedRoot, { recursive: true });
  const commandAllowlist = new Set((allowedCommands || []).map((item) => String(item).toLowerCase()).filter(Boolean));
  const normalizedArtifactRetentionDays = Math.max(1, Math.min(3650, Number(artifactRetentionDays) || 365));
  const workspaceWatchers = new Map();

  const workspaceIdentity = (workspacePath) => {
    const stat = statSync(workspacePath);
    return { device: String(stat.dev), file: String(stat.ino) };
  };
  const sameWorkspaceIdentity = (left, right) => Boolean(
    left?.device && left?.file && left.device === right?.device && left.file === right?.file,
  );
  const findRelocatedWorkspace = (missingPath, projectId, identity = null) => {
    const parentPath = dirname(missingPath);
    if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) return null;
    const directories = readdirSync(parentPath, { withFileTypes: true }).filter(entry => entry.isDirectory());
    const identityMatch = identity && directories.find((entry) => {
      try {
        return sameWorkspaceIdentity(workspaceIdentity(resolve(parentPath, entry.name)), identity);
      } catch {
        return false;
      }
    });
    if (identityMatch) return realpathSync(resolve(parentPath, identityMatch.name));
    const markerMatches = directories.filter((entry) => {
      const markerPath = resolve(parentPath, entry.name, '.hall-of-fame-workspace', 'README.md');
      if (!existsSync(markerPath)) return false;
      try {
        return readFileSync(markerPath, 'utf8').split(/\r?\n/).some(line => line.trim() === `Project id: ${projectId}`);
      } catch {
        return false;
      }
    });
    return markerMatches.length === 1 ? realpathSync(resolve(parentPath, markerMatches[0].name)) : null;
  };
  const resolveWorkspaceBinding = (project = {}) => {
    const configuredPath = resolve(project.localRuntime?.workspacePath || '');
    if (existsSync(configuredPath) && statSync(configuredPath).isDirectory()) return realpathSync(configuredPath);
    const relocatedPath = findRelocatedWorkspace(configuredPath, project.id, project.localRuntime?.workspaceIdentity);
    if (!relocatedPath) throw new Error(`Bound workspace is not available: ${configuredPath}`);
    project.localRuntime = {
      ...(project.localRuntime || {}),
      workspacePath: relocatedPath,
      workspaceIdentity: workspaceIdentity(relocatedPath),
      workspaceRelocatedAt: new Date().toISOString(),
    };
    return relocatedPath;
  };

  const workspaceChangeSnapshot = (state, since) => ({
    schemaVersion: 'local-workspace-mirror-change/v1',
    projectId: state.projectId,
    workspacePath: state.workspacePath,
    revision: state.revision,
    changed: state.revision > since,
    changes: state.changes.filter(change => change.revision > since),
  });
  const settleWorkspaceWatchWaiter = (state, waiter, payload) => {
    if (!state.waiters.delete(waiter)) return;
    clearTimeout(waiter.timeout);
    waiter.signal?.removeEventListener('abort', waiter.onAbort);
    waiter.resolve(payload);
  };
  const resolveWorkspaceWatchWaiters = (state) => {
    for (const waiter of [...state.waiters]) {
      if (state.revision <= waiter.since) continue;
      settleWorkspaceWatchWaiter(state, waiter, workspaceChangeSnapshot(state, waiter.since));
    }
  };
  const recordWorkspaceChange = (state, eventType, path = '.') => {
    state.revision += 1;
    state.changes.push({
      revision: state.revision,
      eventType,
      path: String(path || '.').replace(/\\/g, '/').normalize('NFC'),
      changedAt: new Date().toISOString(),
    });
    if (state.changes.length > 128) state.changes.splice(0, state.changes.length - 128);
    resolveWorkspaceWatchWaiters(state);
  };
  const openWorkspaceRootWatcher = (state) => {
    state.watcher = watchFileSystem(state.workspacePath, { recursive: true, persistent: false }, (eventType, fileName) => {
      recordWorkspaceChange(state, eventType, fileName);
    });
    state.watcher.on('error', () => {
      state.watcher = null;
      recordWorkspaceChange(state, 'rescan');
    });
  };
  const closeWorkspaceWatcher = (state) => {
    if (state.relocationTimer) clearTimeout(state.relocationTimer);
    state.watcher?.close();
    state.parentWatcher?.close();
    state.watcher = null;
    state.parentWatcher = null;
    for (const waiter of [...state.waiters]) {
      settleWorkspaceWatchWaiter(state, waiter, { ...workspaceChangeSnapshot(state, waiter.since), closed: true });
    }
  };

  const projectRoot = (projectId) => safeJoin(resolvedRoot, safeProjectId(projectId));
  const projectPaths = (projectId) => {
    const root = projectRoot(projectId);
    return {
      root,
      memory: safeJoin(root, 'memory'),
      artifacts: safeJoin(root, 'artifacts'),
      archives: safeJoin(root, 'archives'),
      workspace: safeJoin(root, 'workspace'),
    };
  };
  const ensureProjectDirs = (projectId) => {
    const paths = projectPaths(projectId);
    Object.values(paths).forEach((path) => mkdirSync(path, { recursive: true }));
    return paths;
  };
  const recoverWorkspaceArtifacts = (projectId, workspacePath, now, workspacePathAliases = {}) => {
    const paths = ensureProjectDirs(projectId);
    const storageLedgerPath = safeJoin(paths.artifacts, '.artifact-storage.jsonl');
    const events = readArtifactStorageLedger(storageLedgerPath);
    const latestDeletionByContent = new Map();
    const latestProjectionEvents = new Map();
    events.forEach((event) => {
      if (event.eventType === 'artifact-retention-deleted') {
        latestDeletionByContent.set(event.contentSha256, event);
      }
      if (event.eventType === 'artifact-stored' && event.projectionRelativePath) {
        latestProjectionEvents.set(event.projectionRelativePath, event);
      }
    });
    const summary = {
      schemaVersion: 'workspace-artifact-recovery/v1',
      projectedCount: 0,
      unchangedCount: 0,
      conflictCount: 0,
      unavailableCount: 0,
      recoveredAt: now,
    };
    latestProjectionEvents.forEach((event) => {
      const deletion = latestDeletionByContent.get(event.contentSha256);
      if (deletion && deletion.sequence > event.sequence) return;
      const sourcePath = safeJoin(paths.artifacts, event.projectionRelativePath);
      if (!existsSync(sourcePath)) {
        summary.unavailableCount += 1;
        return;
      }
      const content = readFileSync(sourcePath);
      const checksum = createHash('sha256').update(content).digest('hex');
      if (checksum !== event.contentSha256) {
        summary.unavailableCount += 1;
        return;
      }
      const originalWorkspaceRelativePath = event.workspaceRelativePath
        || (event.projectionRelativePath.startsWith('agent-artifacts/')
          ? event.projectionRelativePath
          : `agent-artifacts/${event.projectionRelativePath}`);
      const workspaceRelativePath = resolveWorkspacePathAlias(originalWorkspaceRelativePath, workspacePathAliases);
      const targetPath = safeJoin(workspacePath, workspaceRelativePath);
      if (existsSync(targetPath)) {
        const targetChecksum = createHash('sha256').update(readFileSync(targetPath)).digest('hex');
        if (targetChecksum === event.contentSha256) summary.unchangedCount += 1;
        else summary.conflictCount += 1;
        return;
      }
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, content);
      appendArtifactStorageEvent(storageLedgerPath, {
        id: `artifact_event_workspace_${createHash('sha256').update(`${projectId}:${event.id}:${workspaceRelativePath}:${now}`).digest('hex').slice(0, 24)}`,
        eventType: 'artifact-workspace-projected',
        projectId,
        artifactId: event.artifactId,
        sourceArtifactStorageEventId: event.id,
        contentSha256: event.contentSha256,
        projectionRelativePath: event.projectionRelativePath,
        workspaceRelativePath,
        actorId: 'workspace-bind-recovery',
        createdAt: now,
        storesRawContent: false,
      });
      summary.projectedCount += 1;
    });
    return summary;
  };
  const ensureWorkspaceWatcher = (project = {}) => {
    const workspacePath = resolveWorkspaceBinding(project);
    const existing = workspaceWatchers.get(project.id);
    if (existing?.workspacePath === workspacePath && existing.watcher && existing.parentWatcher) return existing;
    const relocated = Boolean(existing && existing.workspacePath !== workspacePath);
    if (existing) closeWorkspaceWatcher(existing);
    const state = existing || {
          projectId: project.id,
          workspacePath,
          revision: 0,
          changes: [],
          waiters: new Set(),
          watcher: null,
          parentWatcher: null,
          relocationTimer: null,
        };
    state.workspacePath = workspacePath;
    state.identity = workspaceIdentity(workspacePath);
    openWorkspaceRootWatcher(state);
    state.parentWatcher = watchFileSystem(dirname(workspacePath), { persistent: false }, () => {
      if (state.relocationTimer) clearTimeout(state.relocationTimer);
      state.relocationTimer = setTimeout(() => {
        state.relocationTimer = null;
        if (existsSync(state.workspacePath)) return;
        const relocatedPath = findRelocatedWorkspace(state.workspacePath, state.projectId, state.identity);
        if (!relocatedPath || relocatedPath === state.workspacePath) return;
        state.watcher?.close();
        state.workspacePath = relocatedPath;
        state.identity = workspaceIdentity(relocatedPath);
        openWorkspaceRootWatcher(state);
        recordWorkspaceChange(state, 'workspace-root-moved');
      }, 25);
      state.relocationTimer.unref?.();
    });
    if (relocated) recordWorkspaceChange(state, 'workspace-root-moved');
    workspaceWatchers.set(project.id, state);
    return state;
  };
  const publicRuntime = (project = {}) => {
    const paths = ensureProjectDirs(project.id);
    const previousRuntime = project.localRuntime || {};
    return {
      id: `local_runtime_${safeProjectId(project.id)}`,
      projectId: project.id,
      rootPath: paths.root,
      memoryPath: paths.memory,
      artifactsPath: paths.artifacts,
      archivesPath: paths.archives,
      workspacePath: previousRuntime.workspacePath || null,
      workspaceIdentity: previousRuntime.workspaceIdentity || null,
      workspaceRelocatedAt: previousRuntime.workspaceRelocatedAt || null,
      workspaceBoundAt: previousRuntime.workspaceBoundAt || null,
      workspaceRecovery: previousRuntime.workspaceRecovery || null,
      workspacePathAliases: previousRuntime.workspacePathAliases || {},
      archivedAt: previousRuntime.archivedAt || null,
      latestArchivePath: previousRuntime.latestArchivePath || null,
      commandExecutionEnabled: enableCommandExecution,
    };
  };

  return {
    rootPath: resolvedRoot,
    ensureProject(projectId) {
      return projectPaths(projectId);
    },
    prepareWorkspace({ workspacePath, basePath, folderName, createIfMissing = true } = {}) {
      const targetPath = workspacePath
        ? resolve(workspacePath)
        : resolve(basePath || resolvedRoot, folderName || 'agent-project-workspace');
      if (!existsSync(targetPath)) {
        if (!createIfMissing) throw new Error(`Workspace path does not exist: ${targetPath}`);
        mkdirSync(targetPath, { recursive: true });
      }
      if (!statSync(targetPath).isDirectory()) {
        throw new Error(`Workspace path is not a directory: ${targetPath}`);
      }
      return {
        workspacePath: targetPath,
        exists: true,
        file: fileRecord(dirname(targetPath), targetPath),
      };
    },
    pickWorkspaceBaseFolder({ title = 'Choose project workspace folder', initialPath = '' } = {}) {
      if (process.platform !== 'win32') {
        return Promise.resolve({
          selected: false,
          folderPath: null,
          unsupported: true,
          platform: process.platform,
        });
      }
      const powershell = `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
      const escapedTitle = String(title || 'Choose project workspace folder').replace(/'/g, "''");
      const escapedInitialPath = String(initialPath || '').replace(/'/g, "''");
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        `$dialog.Description = '${escapedTitle}'`,
        '$dialog.ShowNewFolderButton = $true',
        escapedInitialPath ? `$dialog.SelectedPath = '${escapedInitialPath}'` : '',
        'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
        '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        '  Write-Output $dialog.SelectedPath',
        '  exit 0',
        '}',
        'exit 2',
      ].filter(Boolean).join('; ');
      return new Promise((resolveResult, rejectResult) => {
        const child = spawn(powershell, ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
          windowsHide: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
          child.kill();
          rejectResult(new Error('Folder picker timed out.'));
        }, 120_000);
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', chunk => {
          stdout += chunk;
        });
        child.stderr?.on('data', chunk => {
          stderr += chunk;
        });
        child.on('error', error => {
          clearTimeout(timeout);
          rejectResult(error);
        });
        child.on('close', status => {
          clearTimeout(timeout);
          if (status === 2) {
            resolveResult({ selected: false, folderPath: null });
            return;
          }
          if (status !== 0) {
            rejectResult(new Error((stderr || stdout || `Folder picker failed with status ${status}`).trim()));
            return;
          }
          const folderPath = String(stdout || '').trim().split(/\r?\n/).filter(Boolean).at(-1) || '';
          if (!folderPath) {
            resolveResult({ selected: false, folderPath: null });
            return;
          }
          if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
            rejectResult(new Error(`Selected path is not a directory: ${folderPath}`));
            return;
          }
          resolveResult({ selected: true, folderPath });
        });
      });
    },
    attachProject(project = {}) {
      if (!project?.id) return project;
      const localRuntime = publicRuntime(project);
      const nextProject = {
        ...project,
        localRuntime,
      };
      writeJson(safeJoin(localRuntime.memoryPath, 'project-memory.json'), {
        projectId: project.id,
        name: project.name || '',
        status: project.status || '',
        progress: project.progress || 0,
        team: project.team || [],
        tasks: project.tasks || [],
        sharedMemory: {
          entryCount: project.localProjectMemoryEntries?.length || 0,
          revocationCount: project.localProjectMemoryRevocations?.length || 0,
          latestEntryChecksum: project.localProjectMemoryEntries?.[0]?.checksum || null,
          latestRevocationChecksum: project.localProjectMemoryRevocations?.[0]?.checksum || null,
          storesRawContent: false,
        },
        updatedAt: new Date().toISOString(),
      });
      writeJson(safeJoin(localRuntime.rootPath, 'manifest.json'), {
        projectId: project.id,
        name: project.name || '',
        localRuntime,
        updatedAt: new Date().toISOString(),
      });
      return nextProject;
    },
    writeArtifact(artifact = {}, context = {}) {
      const projectId = context.project?.id || artifact.projectId || 'project';
      const paths = ensureProjectDirs(projectId);
      const relativePath = artifact.relativePath || artifact.path || `${artifact.id || Date.now()}.md`;
      const absolutePath = safeJoin(paths.artifacts, relativePath);
      const content = String(artifact.content || '');
      const contentSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
      const projectRetentionDays = Math.max(1, Math.min(3650, Math.round(Number(
        context.project?.projectSettings?.privacyPolicy?.retentionDays ?? normalizedArtifactRetentionDays,
      ) || normalizedArtifactRetentionDays)));
      const storageLedgerPath = safeJoin(paths.artifacts, '.artifact-storage.jsonl');
      readArtifactStorageLedger(storageLedgerPath);
      const immutableRelativePath = `.versions/${contentSha256.slice(0, 2)}/${contentSha256}`;
      const immutableAbsolutePath = safeJoin(paths.artifacts, immutableRelativePath);
      mkdirSync(dirname(immutableAbsolutePath), { recursive: true });
      if (existsSync(immutableAbsolutePath)) {
        const existingChecksum = createHash('sha256').update(readFileSync(immutableAbsolutePath)).digest('hex');
        if (existingChecksum !== contentSha256) throw new Error('artifact-canonical-integrity-invalid');
      } else {
        const immutableTempPath = `${immutableAbsolutePath}.tmp`;
        writeFileSync(immutableTempPath, content, 'utf8');
        replaceFileWithRetry(immutableTempPath, immutableAbsolutePath);
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, content, 'utf8');
      const workspacePath = context.project?.localRuntime?.workspacePath;
      let workspaceFile = null;
      let workspaceProjection = { status: workspacePath ? 'unavailable' : 'not-configured', errorCode: null };
      if (workspacePath && existsSync(workspacePath) && statSync(workspacePath).isDirectory()) {
        const workspaceRelativePath = artifact.workspaceRelativePath || `agent-artifacts/${relativePath}`;
        const workspaceAbsolutePath = safeJoin(workspacePath, workspaceRelativePath);
        try {
          mkdirSync(dirname(workspaceAbsolutePath), { recursive: true });
          workspaceProjectionWriteFile(workspaceAbsolutePath, content, 'utf8');
          workspaceFile = {
            absolutePath: workspaceAbsolutePath,
            path: workspaceAbsolutePath,
            relativePath: relative(workspacePath, workspaceAbsolutePath).replace(/\\/g, '/'),
            url: `file://${workspaceAbsolutePath.replace(/\\/g, '/')}`,
          };
          workspaceProjection = { status: 'written', errorCode: null };
        } catch (error) {
          if (!['EPERM', 'EACCES', 'EROFS'].includes(String(error?.code || ''))) throw error;
          workspaceProjection = { status: 'blocked', errorCode: String(error.code) };
        }
      }
      const createdAt = new Date(Date.parse(context.now) || Date.now()).toISOString();
      const storageEvent = appendArtifactStorageEvent(storageLedgerPath, {
        id: `artifact_event_${createHash('sha256').update(`${projectId}:${artifact.id || relativePath}:${contentSha256}:${createdAt}`).digest('hex').slice(0, 24)}`,
        eventType: 'artifact-stored',
        projectId,
        artifactId: String(artifact.id || relativePath),
        contentSha256,
        contentAddress: `sha256:${contentSha256}`,
        byteLength: Buffer.byteLength(content, 'utf8'),
        immutableRelativePath,
        projectionRelativePath: relative(paths.artifacts, absolutePath).replace(/\\/g, '/'),
        workspaceRelativePath: workspaceFile?.relativePath || null,
        workspaceProjectionStatus: workspaceProjection.status,
        workspaceProjectionErrorCode: workspaceProjection.errorCode,
        retentionClass: `project-artifact-${projectRetentionDays}d`,
        retainUntil: new Date(Date.parse(createdAt) + projectRetentionDays * 86_400_000).toISOString(),
        actorId: context.agent?.id || context.agentId || null,
        createdAt,
        storesRawContent: false,
      });
      return {
        absolutePath,
        path: absolutePath,
        relativePath: relative(paths.artifacts, absolutePath).replace(/\\/g, '/'),
        url: `file://${absolutePath.replace(/\\/g, '/')}`,
        contentSha256,
        contentAddress: `sha256:${contentSha256}`,
        immutableAbsolutePath,
        immutableRelativePath,
        immutableUrl: `file://${immutableAbsolutePath.replace(/\\/g, '/')}`,
        workspaceFile,
        workspaceAbsolutePath: workspaceFile?.absolutePath || null,
        workspaceRelativePath: workspaceFile?.relativePath || null,
        workspaceUrl: workspaceFile?.url || null,
        workspaceProjection,
        storageEvent,
        storageLedgerPath,
      };
    },
    auditArtifactStore(project = {}, { now = new Date().toISOString() } = {}) {
      if (!project?.id) throw new Error('artifact-storage-project-required');
      const paths = ensureProjectDirs(project.id);
      const storageLedgerPath = safeJoin(paths.artifacts, '.artifact-storage.jsonl');
      let events = [];
      const integrityFindings = [];
      try {
        events = readArtifactStorageLedger(storageLedgerPath);
      } catch (error) {
        integrityFindings.push({ code: 'ledger-integrity-invalid', targetId: storageLedgerPath, reason: error.message || String(error) });
      }
      const storedEvents = events.filter((row) => row.eventType === 'artifact-stored');
      const workspaceProjectionEvents = events.filter((row) => (
        row.eventType === 'artifact-stored' || row.eventType === 'artifact-workspace-projected'
      ));
      const retentionDeletionEvents = events.filter((row) => row.eventType === 'artifact-retention-deleted');
      const latestDeletionByContent = new Map();
      retentionDeletionEvents.forEach((event) => latestDeletionByContent.set(event.contentSha256, event));
      const contentGroups = new Map();
      storedEvents.forEach((event) => {
        if (!contentGroups.has(event.contentSha256)) contentGroups.set(event.contentSha256, []);
        contentGroups.get(event.contentSha256).push(event);
      });
      const holdMap = new Map();
      events.forEach((event) => {
        if (event.eventType === 'legal-hold-placed') holdMap.set(event.holdId, { ...event, released: false });
        if (event.eventType === 'legal-hold-released') {
          const hold = holdMap.get(event.releaseOfHoldId);
          if (!hold || hold.released) integrityFindings.push({ code: 'legal-hold-lineage-invalid', targetId: event.id });
          else hold.released = true;
        }
      });
      const activeHolds = [...holdMap.values()].filter((row) => !row.released);
      const projectionFindings = [];
      const latestProjectionEvents = new Map();
      const latestWorkspaceEvents = new Map();
      workspaceProjectionEvents.forEach((event) => {
        if (event.projectionRelativePath) latestProjectionEvents.set(event.projectionRelativePath, event);
        if (event.workspaceRelativePath) latestWorkspaceEvents.set(event.workspaceRelativePath, event);
      });
      const checkProjection = (event, absolutePath, kind) => {
        if (!existsSync(absolutePath)) {
          projectionFindings.push({ code: `${kind}-projection-missing`, targetId: event.id, path: kind === 'workspace' ? event.workspaceRelativePath : event.projectionRelativePath });
          return;
        }
        const actual = createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
        if (actual !== event.contentSha256) projectionFindings.push({ code: `${kind}-projection-drift`, targetId: event.id, path: kind === 'workspace' ? event.workspaceRelativePath : event.projectionRelativePath });
      };
      latestProjectionEvents.forEach((event) => {
        const deletion = latestDeletionByContent.get(event.contentSha256);
        if (!deletion || deletion.sequence < event.sequence) checkProjection(event, safeJoin(paths.artifacts, event.projectionRelativePath), 'artifact');
      });
      const workspacePath = project.localRuntime?.workspacePath;
      if (workspacePath && existsSync(workspacePath)) latestWorkspaceEvents.forEach((event) => checkProjection(event, safeJoin(workspacePath, event.workspaceRelativePath), 'workspace'));
      const nowMs = Date.parse(now) || Date.now();
      const canonicalEntries = [...contentGroups.entries()].map(([contentSha256, references]) => {
        const immutableRelativePath = references[0].immutableRelativePath;
        const immutableAbsolutePath = safeJoin(paths.artifacts, immutableRelativePath);
        let canonicalStatus = 'ready';
        const latestStoredSequence = Math.max(...references.map((row) => row.sequence || 0));
        const deletionEvent = latestDeletionByContent.get(contentSha256);
        const retentionDeleted = Boolean(deletionEvent && deletionEvent.sequence > latestStoredSequence);
        if (retentionDeleted && !existsSync(immutableAbsolutePath)) {
          canonicalStatus = 'retention-deleted';
        } else if (!existsSync(immutableAbsolutePath)) {
          canonicalStatus = 'missing';
          integrityFindings.push({ code: 'canonical-missing', targetId: contentSha256 });
        } else {
          const actual = createHash('sha256').update(readFileSync(immutableAbsolutePath)).digest('hex');
          if (actual !== contentSha256) {
            canonicalStatus = 'checksum-mismatch';
            integrityFindings.push({ code: 'canonical-checksum-mismatch', targetId: contentSha256 });
          }
        }
        const retainUntil = references.map((row) => row.retainUntil).sort().at(-1) || null;
        const held = activeHolds.some((row) => row.contentSha256 === contentSha256);
        const expired = Boolean(retainUntil && Date.parse(retainUntil) <= nowMs);
        return {
          contentSha256,
          contentAddress: `sha256:${contentSha256}`,
          immutableRelativePath,
          canonicalStatus,
          referenceCount: references.length,
          retainUntil,
          expired,
          legalHoldActive: held,
          deletionEligible: canonicalStatus === 'ready' && expired && !held,
          retentionDeletionOperationId: retentionDeleted ? deletionEvent.operationId : null,
        };
      }).sort((left, right) => left.contentSha256.localeCompare(right.contentSha256));
      integrityFindings.sort((a, b) => `${a.code}:${a.targetId}`.localeCompare(`${b.code}:${b.targetId}`));
      projectionFindings.sort((a, b) => `${a.code}:${a.path}`.localeCompare(`${b.code}:${b.path}`));
      const integrityValid = integrityFindings.length === 0;
      const inventoryBase = {
        schemaVersion: 'local-artifact-storage-inventory/v1',
        projectId: project.id,
        generatedAt: new Date(nowMs).toISOString(),
        localOnly: true,
        status: !integrityValid ? 'degraded-integrity-invalid' : projectionFindings.length ? 'ready-with-projection-drift' : 'ready',
        integrity: { valid: integrityValid, ledgerValid: !integrityFindings.some((row) => row.code === 'ledger-integrity-invalid') },
        integrityFindings,
        projectionFindings,
        canonicalEntries,
        activeLegalHolds: activeHolds.map((row) => ({ holdId: row.holdId, contentSha256: row.contentSha256, actorId: row.actorId, reasonHash: row.reasonHash, createdAt: row.createdAt })),
        storageLedgerPath,
        summary: {
          eventCount: events.length,
          artifactReferenceCount: storedEvents.length,
          canonicalContentCount: canonicalEntries.length,
          expiredContentCount: canonicalEntries.filter((row) => row.expired).length,
          deletionEligibleContentCount: canonicalEntries.filter((row) => row.deletionEligible).length,
          activeLegalHoldCount: activeHolds.length,
          retentionDeletedContentCount: canonicalEntries.filter((row) => row.canonicalStatus === 'retention-deleted').length,
          projectionFindingCount: projectionFindings.length,
        },
        deletionExecuted: false,
      };
      return {
        ...inventoryBase,
        checksum: sha256Json({
          schemaVersion: inventoryBase.schemaVersion,
          projectId: inventoryBase.projectId,
          status: inventoryBase.status,
          integrity: inventoryBase.integrity,
          integrityFindings: inventoryBase.integrityFindings,
          projectionFindings: inventoryBase.projectionFindings,
          canonicalEntries: inventoryBase.canonicalEntries,
          activeLegalHolds: inventoryBase.activeLegalHolds,
          summary: inventoryBase.summary,
        }),
      };
    },
    getArtifactRetentionExecution(project = {}, operationId = '') {
      if (!project?.id) throw new Error('artifact-retention-project-required');
      const normalizedOperationId = safeProjectId(operationId);
      if (!operationId || normalizedOperationId !== operationId) throw new Error('artifact-retention-operation-id-invalid');
      const journalPath = safeJoin(resolvedRoot, `.privacy-lifecycle-journals/${safeProjectId(project.id)}/${normalizedOperationId}.json`);
      const journal = readChecksummedJson(journalPath, 'artifact-retention-journal-integrity-invalid');
      return journal?.status === 'committed' ? journal.receipt : null;
    },
    executeArtifactRetention(project = {}, {
      operationId,
      plan,
      actionApprovalId,
      actionApprovalChecksum,
      actionApprovalDecisionChecksums = [],
      actionApprovalExecutionClaim,
      actorId,
      now = new Date().toISOString(),
    } = {}) {
      if (!project?.id) throw new Error('artifact-retention-project-required');
      const normalizedOperationId = safeProjectId(operationId);
      if (!operationId || normalizedOperationId !== operationId) throw new Error('artifact-retention-operation-id-invalid');
      const journalPath = safeJoin(resolvedRoot, `.privacy-lifecycle-journals/${safeProjectId(project.id)}/${normalizedOperationId}.json`);
      const tombstonePath = safeJoin(resolvedRoot, `.privacy-lifecycle-tombstones/${safeProjectId(project.id)}/${normalizedOperationId}.json`);
      const existing = readChecksummedJson(journalPath, 'artifact-retention-journal-integrity-invalid');
      if (existing?.planChecksum && existing.planChecksum !== plan?.planChecksum) throw new Error('artifact-retention-operation-conflict');
      if (existing?.status === 'committed') return { ...existing.receipt, idempotent: true };
      const nowMs = Date.parse(now) || Date.now();
      if (!plan?.planChecksum || (Date.parse(plan.planExpiresAt || '') || 0) <= nowMs) throw new Error('privacy-lifecycle-plan-expired');
      const targetHashes = [...new Set(plan.deletionManifest?.contentSha256 || [])].sort();
      if (!targetHashes.length) throw new Error('privacy-lifecycle-no-eligible-content');
      if (!existing) {
        const inventory = this.auditArtifactStore(project, { now });
        if (!inventory.integrity.valid) throw new Error('artifact-storage-integrity-invalid');
        if (inventory.checksum !== plan.inventoryChecksum) throw new Error('privacy-lifecycle-inventory-stale');
        const eligibleHashes = inventory.canonicalEntries.filter((row) => row.deletionEligible).map((row) => row.contentSha256).sort();
        if (JSON.stringify(eligibleHashes) !== JSON.stringify(targetHashes)) throw new Error('privacy-lifecycle-manifest-stale');
        const preparedBase = {
          schemaVersion: 'local-artifact-retention-execution-journal/v1',
          operationId: normalizedOperationId,
          projectId: project.id,
          status: 'prepared',
          preparedAt: new Date(nowMs).toISOString(),
          planChecksum: plan.planChecksum,
          inventoryChecksum: plan.inventoryChecksum,
          targetContentSha256: targetHashes,
          actionApprovalId,
          actionApprovalChecksum,
          actionApprovalDecisionChecksums,
          actionApprovalExecutionClaimChecksum: actionApprovalExecutionClaim?.checksum || null,
          actorId: String(actorId || ''),
        };
        writeJsonAtomic(journalPath, { ...preparedBase, checksum: sha256Json(preparedBase) });
      }
      const paths = ensureProjectDirs(project.id);
      const storageLedgerPath = safeJoin(paths.artifacts, '.artifact-storage.jsonl');
      let events = readArtifactStorageLedger(storageLedgerPath);
      const deletedHashes = [];
      const internalProjectionPaths = [];
      for (const contentSha256 of targetHashes) {
        const stored = events.filter((row) => row.eventType === 'artifact-stored' && row.contentSha256 === contentSha256);
        if (!stored.length) throw new Error('privacy-lifecycle-manifest-stale');
        const immutableAbsolutePath = safeJoin(paths.artifacts, stored[0].immutableRelativePath);
        if (existsSync(immutableAbsolutePath)) {
          const actual = createHash('sha256').update(readFileSync(immutableAbsolutePath)).digest('hex');
          if (actual !== contentSha256) throw new Error('artifact-storage-integrity-invalid');
          rmSync(immutableAbsolutePath);
        }
        const latestByProjection = new Map();
        events.filter((row) => row.eventType === 'artifact-stored' && row.projectionRelativePath)
          .forEach((row) => latestByProjection.set(row.projectionRelativePath, row));
        latestByProjection.forEach((row, projectionRelativePath) => {
          if (row.contentSha256 !== contentSha256) return;
          const projectionPath = safeJoin(paths.artifacts, projectionRelativePath);
          if (!existsSync(projectionPath)) return;
          const actual = createHash('sha256').update(readFileSync(projectionPath)).digest('hex');
          if (actual !== contentSha256) throw new Error('artifact-projection-drift');
          rmSync(projectionPath);
          internalProjectionPaths.push(projectionRelativePath);
        });
        const priorDeletion = events.find((row) => row.eventType === 'artifact-retention-deleted'
          && row.operationId === normalizedOperationId && row.contentSha256 === contentSha256);
        if (!priorDeletion) {
          appendArtifactStorageEvent(storageLedgerPath, {
            id: `artifact_retention_${sha256Json(`${project.id}:${normalizedOperationId}:${contentSha256}`).slice(0, 24)}`,
            eventType: 'artifact-retention-deleted',
            projectId: project.id,
            operationId: normalizedOperationId,
            contentSha256,
            planChecksum: plan.planChecksum,
            actionApprovalId,
            actorId: String(actorId || ''),
            createdAt: new Date(nowMs).toISOString(),
            storesRawContent: false,
          });
          events = readArtifactStorageLedger(storageLedgerPath);
        }
        deletedHashes.push(contentSha256);
      }
      const verified = this.auditArtifactStore(project, { now });
      if (!verified.integrity.valid || targetHashes.some((hash) => (
        verified.canonicalEntries.find((row) => row.contentSha256 === hash)?.canonicalStatus !== 'retention-deleted'
      ))) throw new Error('artifact-retention-post-verification-failed');
      const receiptBase = {
        schemaVersion: 'local-artifact-retention-execution-receipt/v1',
        operationId: normalizedOperationId,
        projectId: project.id,
        status: 'committed',
        planChecksum: plan.planChecksum,
        inventoryChecksum: plan.inventoryChecksum,
        postInventoryChecksum: verified.checksum,
        deletedContentSha256: deletedHashes,
        deletedCanonicalContentCount: deletedHashes.length,
        deletedInternalProjectionCount: internalProjectionPaths.length,
        actionApprovalId,
        actionApprovalChecksum,
        actionApprovalDecisionChecksums,
        actionApprovalExecutionClaimChecksum: actionApprovalExecutionClaim?.checksum || null,
        executedBy: String(actorId || ''),
        executedAt: new Date(nowMs).toISOString(),
        tombstonePath,
        residualDataBoundaries: {
          externalWorkspacePreserved: true,
          userBackupsPreserved: true,
          recoveryArchivesPreserved: true,
          auditAndCheckpointsPreserved: true,
        },
        localOnly: true,
        readyForProduction: false,
        deletionVerified: true,
      };
      const receipt = { ...receiptBase, checksum: sha256Json(receiptBase) };
      writeJsonAtomic(tombstonePath, receipt);
      const committedBase = {
        schemaVersion: 'local-artifact-retention-execution-journal/v1',
        operationId: normalizedOperationId,
        projectId: project.id,
        status: 'committed',
        preparedAt: existing?.preparedAt || new Date(nowMs).toISOString(),
        committedAt: new Date(nowMs).toISOString(),
        planChecksum: plan.planChecksum,
        receipt,
      };
      writeJsonAtomic(journalPath, { ...committedBase, checksum: sha256Json(committedBase) });
      return { ...receipt, idempotent: false };
    },
    placeArtifactLegalHold(project = {}, { contentSha256, reason, actorId, now = new Date().toISOString() } = {}) {
      const inventory = this.auditArtifactStore(project, { now });
      if (!inventory.integrity.valid) throw new Error('artifact-storage-integrity-invalid');
      const normalizedChecksum = String(contentSha256 || '').toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(normalizedChecksum) || !inventory.canonicalEntries.some((row) => row.contentSha256 === normalizedChecksum)) throw new Error('artifact-legal-hold-content-not-found');
      const normalizedActorId = String(actorId || '').trim();
      if (!normalizedActorId) throw new Error('artifact-legal-hold-actor-required');
      const normalizedReason = String(reason || '').trim();
      if (!normalizedReason || normalizedReason.length > 4_000) throw new Error('artifact-legal-hold-reason-invalid');
      if (inventory.activeLegalHolds.some((row) => row.contentSha256 === normalizedChecksum)) throw new Error('artifact-legal-hold-already-active');
      const createdAt = new Date(Date.parse(now) || Date.now()).toISOString();
      const holdId = `artifact_hold_${createHash('sha256').update(`${project.id}:${normalizedChecksum}:${createdAt}`).digest('hex').slice(0, 24)}`;
      return appendArtifactStorageEvent(inventory.storageLedgerPath, {
        id: `artifact_event_${holdId}`,
        eventType: 'legal-hold-placed',
        projectId: project.id,
        holdId,
        contentSha256: normalizedChecksum,
        reasonHash: createHash('sha256').update(normalizedReason).digest('hex'),
        reasonLength: normalizedReason.length,
        actorId: normalizedActorId,
        createdAt,
        storesRawContent: false,
      });
    },
    releaseArtifactLegalHold(project = {}, { holdId, actorId, now = new Date().toISOString() } = {}) {
      const inventory = this.auditArtifactStore(project, { now });
      if (!inventory.integrity.valid) throw new Error('artifact-storage-integrity-invalid');
      const hold = inventory.activeLegalHolds.find((row) => row.holdId === holdId);
      if (!hold) throw new Error('artifact-legal-hold-not-active');
      const normalizedActorId = String(actorId || '').trim();
      if (!normalizedActorId) throw new Error('artifact-legal-hold-actor-required');
      const createdAt = new Date(Date.parse(now) || Date.now()).toISOString();
      return appendArtifactStorageEvent(inventory.storageLedgerPath, {
        id: `artifact_event_release_${createHash('sha256').update(`${project.id}:${holdId}:${createdAt}`).digest('hex').slice(0, 24)}`,
        eventType: 'legal-hold-released',
        projectId: project.id,
        releaseOfHoldId: holdId,
        contentSha256: hold.contentSha256,
        actorId: normalizedActorId,
        createdAt,
        storesRawContent: false,
      });
    },
    bindWorkspace(project = {}, workspacePath, { createIfMissing = false, now = new Date().toISOString() } = {}) {
      if (!project?.id) throw new Error('Cannot bind workspace without a project id.');
      if (!workspacePath) throw new Error('workspacePath is required.');
      const absoluteWorkspacePath = resolve(workspacePath);
      if (!existsSync(absoluteWorkspacePath)) {
        if (!createIfMissing) throw new Error(`Workspace path does not exist: ${absoluteWorkspacePath}`);
        mkdirSync(absoluteWorkspacePath, { recursive: true });
      }
      if (!statSync(absoluteWorkspacePath).isDirectory()) {
        throw new Error(`Workspace path is not a directory: ${absoluteWorkspacePath}`);
      }
      const canonicalWorkspacePath = realpathSync(absoluteWorkspacePath);
      const attached = this.attachProject(project);
      const workspaceRecovery = recoverWorkspaceArtifacts(
        project.id,
        canonicalWorkspacePath,
        now,
        attached.localRuntime?.workspacePathAliases || {},
      );
      return {
        ...attached,
        localRuntime: {
          ...attached.localRuntime,
          workspacePath: canonicalWorkspacePath,
          workspaceIdentity: workspaceIdentity(canonicalWorkspacePath),
          workspaceBoundAt: now,
          workspaceRecovery,
        },
      };
    },
    requireWorkspace(project = {}) {
      const workspacePath = project.localRuntime?.workspacePath;
      if (!workspacePath) throw new Error(`Project has no bound workspace: ${project.id}`);
      return resolveWorkspaceBinding(project);
    },
    listWorkspace(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      const watcher = ensureWorkspaceWatcher(project);
      return {
        projectId: project.id,
        workspacePath,
        workspaceRevision: watcher.revision,
        files: listDirectory(workspacePath, input.path || '.', input),
      };
    },
    waitForWorkspaceChange(project = {}, input = {}) {
      this.requireWorkspace(project);
      const watcher = ensureWorkspaceWatcher(project);
      const since = Math.max(0, Number.parseInt(input.since, 10) || 0);
      if (watcher.revision > since) return Promise.resolve(workspaceChangeSnapshot(watcher, since));
      const timeoutMs = Math.max(1000, Math.min(30_000, Number(input.timeoutMs) || 25_000));
      if (input.signal?.aborted) {
        return Promise.resolve({ ...workspaceChangeSnapshot(watcher, since), aborted: true });
      }
      return new Promise((resolveChange) => {
        const waiter = {
          since,
          resolve: resolveChange,
          timeout: null,
          signal: input.signal || null,
          onAbort: null,
        };
        waiter.onAbort = () => settleWorkspaceWatchWaiter(watcher, waiter, {
          ...workspaceChangeSnapshot(watcher, since),
          aborted: true,
        });
        waiter.timeout = setTimeout(() => {
          settleWorkspaceWatchWaiter(watcher, waiter, workspaceChangeSnapshot(watcher, since));
        }, timeoutMs);
        watcher.waiters.add(waiter);
        waiter.signal?.addEventListener('abort', waiter.onAbort, { once: true });
      });
    },
    closeWorkspaceWatchers() {
      workspaceWatchers.forEach(closeWorkspaceWatcher);
      workspaceWatchers.clear();
    },
    readWorkspaceFile(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      const absolutePath = workspaceTarget(workspacePath, input.path || '');
      if (!existsSync(absolutePath)) throw new Error(`Workspace file not found: ${input.path}`);
      const stat = statSync(absolutePath);
      if (!stat.isFile()) throw new Error(`Workspace path is not a file: ${input.path}`);
      const limit = Number(input.maxBytes || maxReadBytes);
      if (stat.size > limit) throw new Error(`Workspace file is too large to read: ${stat.size} bytes`);
      return {
        projectId: project.id,
        workspacePath,
        file: fileRecord(workspacePath, absolutePath),
        content: readFileSync(absolutePath, input.encoding || 'utf8'),
      };
    },
    writeWorkspaceFile(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      if (!input.path) throw new Error('path is required.');
      const absolutePath = workspaceTarget(workspacePath, input.path, { allowMissing: true });
      if (existsSync(absolutePath)) {
        assertNoSymbolicLinkSegments(workspacePath, absolutePath);
        const currentRecord = fileRecord(workspacePath, absolutePath);
        if (input.expectedUpdatedAt && input.expectedUpdatedAt !== currentRecord.updatedAt) {
          throw new Error(`workspace-file-conflict:${currentRecord.updatedAt}`);
        }
      }
      mkdirSync(dirname(absolutePath), { recursive: true });
      const content = String(input.content ?? '');
      const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
      try {
        writeFileSync(temporaryPath, content, input.encoding || 'utf8');
        replaceFileWithRetry(temporaryPath, absolutePath);
      } finally {
        if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true });
      }
      return {
        projectId: project.id,
        workspacePath,
        file: fileRecord(workspacePath, absolutePath),
      };
    },
    deleteWorkspacePath(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      if (!input.path || input.path === '.') throw new Error('A non-root path is required for delete.');
      const absolutePath = workspaceTarget(workspacePath, input.path);
      if (!existsSync(absolutePath)) throw new Error(`Workspace path not found: ${input.path}`);
      rmSync(absolutePath, { recursive: Boolean(input.recursive), force: false });
      return {
        projectId: project.id,
        workspacePath,
        deletedPath: input.path,
      };
    },
    createWorkspaceDirectory(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      if (!input.path || input.path === '.') throw new Error('workspace-directory-path-required');
      const absolutePath = workspaceTarget(workspacePath, input.path, { allowMissing: true });
      if (existsSync(absolutePath)) throw new Error('workspace-destination-exists');
      const parentPath = dirname(absolutePath);
      if (!statSync(parentPath).isDirectory()) throw new Error(`Workspace path is not a directory: ${relative(workspacePath, parentPath)}`);
      mkdirSync(absolutePath, { recursive: false });
      return {
        projectId: project.id,
        workspacePath,
        directory: fileRecord(workspacePath, absolutePath),
      };
    },
    moveWorkspacePath(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      if (!input.fromPath || input.fromPath === '.' || !input.toPath || input.toPath === '.') {
        throw new Error('workspace-non-root-move-path-required');
      }
      const fromPath = workspaceTarget(workspacePath, input.fromPath);
      const toPath = workspaceTarget(workspacePath, input.toPath, { allowMissing: true });
      if (existsSync(toPath)) throw new Error('workspace-destination-exists');
      if (toPath.startsWith(`${fromPath}${sep}`)) throw new Error('workspace-move-into-self-not-allowed');
      const parentPath = dirname(toPath);
      if (!statSync(parentPath).isDirectory()) throw new Error(`Workspace path is not a directory: ${relative(workspacePath, parentPath)}`);
      renameSync(fromPath, toPath);
      return {
        projectId: project.id,
        workspacePath,
        entry: fileRecord(workspacePath, toPath),
      };
    },
    executeWorkspaceCommand(project = {}, input = {}) {
      if (!enableCommandExecution) throw new Error('Workspace command execution is disabled.');
      const workspacePath = this.requireWorkspace(project);
      const command = String(input.command || '').trim();
      if (!command) throw new Error('command is required.');
      const commandName = command.split(/[\\/]/).pop().toLowerCase();
      if (commandAllowlist.size && !commandAllowlist.has(commandName)) {
        throw new Error(`Workspace command is not allowed: ${commandName}`);
      }
      const executable = commandName === 'node' ? process.execPath : command;
      const cwd = input.cwd ? safeJoin(workspacePath, input.cwd) : workspacePath;
      const result = spawnSync(executable, Array.isArray(input.args) ? input.args.map(String) : [], {
        cwd,
        shell: Boolean(input.shell),
        encoding: 'utf8',
        timeout: Number(input.timeoutMs || 30_000),
        maxBuffer: Number(input.maxBuffer || 1024 * 1024),
      });
      return {
        projectId: project.id,
        workspacePath,
        cwd,
        command,
        executable,
        args: Array.isArray(input.args) ? input.args.map(String) : [],
        status: result.status,
        signal: result.signal,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error?.message || null,
      };
    },
    executeWorkspaceCommandAsync(project = {}, input = {}) {
      if (!enableCommandExecution) return Promise.reject(new Error('Workspace command execution is disabled.'));
      const workspacePath = this.requireWorkspace(project);
      const command = String(input.command || '').trim();
      if (!command) return Promise.reject(new Error('command is required.'));
      const commandName = command.split(/[\\/]/).pop().toLowerCase();
      if (commandAllowlist.size && !commandAllowlist.has(commandName)) {
        return Promise.reject(new Error(`Workspace command is not allowed: ${commandName}`));
      }
      const executable = commandName === 'node' ? process.execPath : command;
      let cwd;
      try {
        cwd = input.cwd ? safeJoin(workspacePath, input.cwd) : workspacePath;
      } catch (error) {
        return Promise.reject(error);
      }
      const args = Array.isArray(input.args) ? input.args.map(String) : [];
      const timeoutMs = Math.max(1, Math.min(24 * 60 * 60 * 1000, Number(input.timeoutMs) || 30_000));
      const maxBuffer = Math.max(1, Math.min(64 * 1024 * 1024, Number(input.maxBuffer) || 1024 * 1024));
      const operationId = String(input.operationId || `workspace_command_${Date.now()}`).trim();
      const signal = input.signal || null;
      if (signal?.aborted) {
        const completedAt = new Date().toISOString();
        const receiptBase = {
          schemaVersion: 'local-workspace-command-execution/v1', operationId, projectId: project.id,
          status: 'cancelled', commandHash: sha256Json({ commandName, args }), timeoutMs, maxBuffer,
          exitCode: null, exitSignal: null, timeoutTriggered: false, cancelledByCaller: true,
          outputLimitExceeded: false, stdoutBytes: 0, stderrBytes: 0, errorHash: null,
          treeTermination: 'not-started', completedAt, storesRawOutput: false,
        };
        return Promise.resolve({
          projectId: project.id, workspacePath, cwd, command, executable, args,
          status: 'cancelled', exitCode: null, signal: null, stdout: '', stderr: '', error: null,
          receipt: { ...receiptBase, checksum: sha256Json(receiptBase) },
        });
      }
      return new Promise((resolveResult) => {
        const child = spawn(executable, args, {
          cwd,
          shell: Boolean(input.shell),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = Buffer.alloc(0);
        let stderr = Buffer.alloc(0);
        let terminalReason = null;
        let spawnError = null;
        let settled = false;
        const appendBounded = (current, chunk) => {
          const next = Buffer.concat([current, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
          if (next.length <= maxBuffer) return next;
          terminalReason = terminalReason || 'output-limit-exceeded';
          child.kill();
          return next.subarray(0, maxBuffer);
        };
        child.stdout?.on('data', (chunk) => { stdout = appendBounded(stdout, chunk); });
        child.stderr?.on('data', (chunk) => { stderr = appendBounded(stderr, chunk); });
        const timeout = setTimeout(() => {
          terminalReason = terminalReason || 'timed-out';
          child.kill();
        }, timeoutMs);
        const abort = () => {
          terminalReason = terminalReason || 'cancelled';
          child.kill();
        };
        signal?.addEventListener('abort', abort, { once: true });
        child.on('error', (error) => {
          spawnError = error;
          terminalReason = terminalReason || 'failed';
        });
        child.on('close', (exitCode, exitSignal) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abort);
          const status = terminalReason || (exitCode === 0 ? 'succeeded' : 'failed');
          const completedAt = new Date().toISOString();
          const receiptBase = {
            schemaVersion: 'local-workspace-command-execution/v1',
            operationId,
            projectId: project.id,
            status,
            commandHash: sha256Json({ commandName, args }),
            timeoutMs,
            maxBuffer,
            exitCode,
            exitSignal: exitSignal || null,
            timeoutTriggered: status === 'timed-out',
            cancelledByCaller: status === 'cancelled',
            outputLimitExceeded: status === 'output-limit-exceeded',
            stdoutBytes: stdout.length,
            stderrBytes: stderr.length,
            errorHash: spawnError ? sha256Json(spawnError.message || String(spawnError)) : null,
            treeTermination: terminalReason ? (process.platform === 'win32' ? 'direct-child-terminated-descendants-not-attested' : 'direct-child-signal') : 'not-required',
            completedAt,
            storesRawOutput: false,
          };
          resolveResult({
            projectId: project.id,
            workspacePath,
            cwd,
            command,
            executable,
            args,
            status,
            exitCode,
            signal: exitSignal || null,
            stdout: stdout.toString('utf8'),
            stderr: stderr.toString('utf8'),
            error: spawnError?.message || null,
            receipt: { ...receiptBase, checksum: sha256Json(receiptBase) },
          });
        });
      });
    },
    archiveProject(project = {}, { reason = 'manual-archive', now = new Date().toISOString() } = {}) {
      if (!project?.id) throw new Error('Cannot archive project without a project id.');
      const paths = ensureProjectDirs(project.id);
      const archiveName = `${new Date(Date.parse(now) || Date.now()).toISOString().replace(/[:.]/g, '-')}.json`;
      const archivePath = safeJoin(paths.archives, archiveName);
      writeJson(archivePath, {
        project,
        reason,
        archivedAt: now,
      });
      return {
        ...project,
        status: project.status === 'archived' ? project.status : 'archived',
        archivedAt: now,
        localRuntime: {
          ...publicRuntime(project),
          ...(project.localRuntime || {}),
          archivedAt: now,
          latestArchivePath: archivePath,
        },
      };
    },
    writePrivacyExport(project = {}, { exportId, payload } = {}) {
      if (!project?.id) throw new Error('Cannot export privacy data without a project id.');
      if (!exportId) throw new Error('Cannot export privacy data without an export id.');
      const paths = ensureProjectDirs(project.id);
      const exportPath = safeJoin(paths.archives, `privacy-exports/${safeProjectId(exportId)}.json`);
      writeJson(exportPath, payload);
      return {
        exportPath,
        file: fileRecord(paths.root, exportPath),
        bytes: statSync(exportPath).size,
      };
    },
    purgeProject(project = {}, { deletionId, tombstone } = {}) {
      if (!project?.id) throw new Error('Cannot purge privacy data without a project id.');
      if (!deletionId) throw new Error('Cannot purge privacy data without a deletion id.');
      const projectPath = projectRoot(project.id);
      const tombstonePath = safeJoin(resolvedRoot, `deletion-receipts/${safeProjectId(deletionId)}.json`);
      writeJson(tombstonePath, tombstone);
      if (existsSync(projectPath)) rmSync(projectPath, { recursive: true, force: true });
      return {
        projectPath,
        projectRootRemoved: !existsSync(projectPath),
        tombstonePath,
        externalWorkspaceRetained: Boolean(project.localRuntime?.workspacePath),
      };
    },
  };
}
