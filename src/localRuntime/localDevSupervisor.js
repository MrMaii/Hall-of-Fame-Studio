import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { replaceFileWithRetry } from '../agents/atomicFileReplace.js';

export function createLocalRuntimeStatusWriter(filePath) {
  return (status) => {
    mkdirSync(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(status, null, 2), 'utf8');
    replaceFileWithRetry(tempPath, filePath);
  };
}

function runtimeStatus({ backendStatus, uiStatus, now, failure = null, runtimeUrls = {} }) {
  const backendFailed = backendStatus === 'failed';
  return {
    schemaVersion: 'local-runtime-status/v1',
    updatedAt: now(),
    backend: {
      status: backendStatus,
      failure,
    },
    ui: {
      status: uiStatus,
    },
    urls: {
      backend: runtimeUrls.backendUrl || null,
      ui: runtimeUrls.uiUrl || null,
    },
    message: backendFailed
      ? '本地服务启动失败，界面仍可使用。'
      : '本地服务和界面正在运行。',
    recoveryActions: backendFailed
      ? [
          { id: 'restart-backend', label: '重新启动本地服务' },
          { id: 'restore-backup', label: '从本地备份恢复' },
        ]
      : [],
  };
}

export function createLocalDevSupervisor({
  backend,
  ui,
  writeStatus,
  exit = (code) => process.exit(code),
  schedule = setTimeout,
  now = () => new Date().toISOString(),
  runtimeUrls = {},
} = {}) {
  if (!backend || !ui) throw new Error('local-dev-supervisor-children-required');
  if (typeof writeStatus !== 'function') throw new Error('local-dev-supervisor-status-writer-required');
  let stopping = false;
  let backendFailed = false;

  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    [backend, ui].forEach((child) => {
      if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
    });
    const timer = schedule(() => exit(code), 3_000);
    timer?.unref?.();
  };

  const recordBackendFailure = (failure) => {
    if (stopping || backendFailed) return;
    backendFailed = true;
    writeStatus(runtimeStatus({
      backendStatus: 'failed',
      uiStatus: 'running',
      now,
      failure,
      runtimeUrls,
    }));
  };

  backend.once('error', (error) => {
    recordBackendFailure({
      kind: 'spawn-error',
      detail: error?.message || String(error),
    });
  });
  backend.once('exit', (code, signal) => {
    recordBackendFailure({
      kind: 'unexpected-exit',
      code: code ?? null,
      signal: signal || null,
    });
  });
  ui.once('error', (error) => {
    if (stopping) return;
    writeStatus(runtimeStatus({
      backendStatus: backendFailed ? 'failed' : 'running',
      uiStatus: 'failed',
      now,
      failure: { kind: 'ui-spawn-error', detail: error?.message || String(error) },
      runtimeUrls,
    }));
    stop(1);
  });
  ui.once('exit', (code, signal) => {
    if (stopping) return;
    writeStatus(runtimeStatus({
      backendStatus: backendFailed ? 'failed' : 'running',
      uiStatus: 'failed',
      now,
      failure: { kind: 'ui-unexpected-exit', code: code ?? null, signal: signal || null },
      runtimeUrls,
    }));
    stop(code === 0 ? 1 : code || 1);
  });

  writeStatus(runtimeStatus({
    backendStatus: 'running',
    uiStatus: 'running',
    now,
    runtimeUrls,
  }));

  return { stop };
}
