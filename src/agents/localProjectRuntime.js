import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const DEFAULT_MAX_READ_BYTES = 512 * 1024;
const DEFAULT_MAX_LIST_ENTRIES = 500;

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
  const stat = statSync(absolutePath);
  return {
    path: relative(rootPath, absolutePath).replace(/\\/g, '/') || '.',
    name: absolutePath.split(/[\\/]/).pop(),
    type: stat.isDirectory() ? 'directory' : 'file',
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

function listDirectory(rootPath, relativePath = '.', { recursive = false, maxEntries = DEFAULT_MAX_LIST_ENTRIES } = {}) {
  const startPath = safeJoin(rootPath, relativePath);
  if (!existsSync(startPath)) throw new Error(`Workspace path not found: ${relativePath}`);
  if (!statSync(startPath).isDirectory()) return [fileRecord(rootPath, startPath)];

  const entries = [];
  const visit = (directory) => {
    for (const name of readdirSync(directory)) {
      if (entries.length >= maxEntries) return;
      const absolutePath = assertInside(rootPath, resolve(directory, name));
      const record = fileRecord(rootPath, absolutePath);
      entries.push(record);
      if (recursive && record.type === 'directory') visit(absolutePath);
    }
  };
  visit(startPath);
  return entries;
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export function createLocalProjectRuntime({
  rootPath,
  enableCommandExecution = false,
  allowedCommands = [],
  maxReadBytes = DEFAULT_MAX_READ_BYTES,
} = {}) {
  if (!rootPath) throw new Error('createLocalProjectRuntime requires rootPath.');
  const resolvedRoot = resolve(rootPath);
  mkdirSync(resolvedRoot, { recursive: true });
  const commandAllowlist = new Set((allowedCommands || []).map((item) => String(item).toLowerCase()).filter(Boolean));

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
      workspaceBoundAt: previousRuntime.workspaceBoundAt || null,
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
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, artifact.content || '', 'utf8');
      return {
        absolutePath,
        path: absolutePath,
        relativePath: relative(paths.artifacts, absolutePath).replace(/\\/g, '/'),
        url: `file://${absolutePath.replace(/\\/g, '/')}`,
      };
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
      const attached = this.attachProject(project);
      return {
        ...attached,
        localRuntime: {
          ...attached.localRuntime,
          workspacePath: absoluteWorkspacePath,
          workspaceBoundAt: now,
        },
      };
    },
    requireWorkspace(project = {}) {
      const workspacePath = project.localRuntime?.workspacePath;
      if (!workspacePath) throw new Error(`Project has no bound workspace: ${project.id}`);
      const absoluteWorkspacePath = resolve(workspacePath);
      if (!existsSync(absoluteWorkspacePath) || !statSync(absoluteWorkspacePath).isDirectory()) {
        throw new Error(`Bound workspace is not available: ${absoluteWorkspacePath}`);
      }
      return absoluteWorkspacePath;
    },
    listWorkspace(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      return {
        projectId: project.id,
        workspacePath,
        files: listDirectory(workspacePath, input.path || '.', input),
      };
    },
    readWorkspaceFile(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      const absolutePath = safeJoin(workspacePath, input.path || '');
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
      const absolutePath = safeJoin(workspacePath, input.path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      const content = String(input.content ?? '');
      writeFileSync(absolutePath, content, input.encoding || 'utf8');
      return {
        projectId: project.id,
        workspacePath,
        file: fileRecord(workspacePath, absolutePath),
      };
    },
    deleteWorkspacePath(project = {}, input = {}) {
      const workspacePath = this.requireWorkspace(project);
      if (!input.path || input.path === '.') throw new Error('A non-root path is required for delete.');
      const absolutePath = safeJoin(workspacePath, input.path);
      if (!existsSync(absolutePath)) throw new Error(`Workspace path not found: ${input.path}`);
      rmSync(absolutePath, { recursive: Boolean(input.recursive), force: false });
      return {
        projectId: project.id,
        workspacePath,
        deletedPath: input.path,
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
  };
}
