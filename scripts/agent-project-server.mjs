import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProviderFromEnv } from '../src/agents/modelProvider.js';
import { createSearchProviderFromEnv } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return false;
  const text = readFileSync(filePath, 'utf8');
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalsAt = trimmed.indexOf('=');
    if (equalsAt <= 0) return;
    const key = trimmed.slice(0, equalsAt).trim();
    let value = trimmed.slice(equalsAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  });
  return true;
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
[
  resolve(workspaceRoot, '.env'),
  resolve(workspaceRoot, '.env/local'),
  resolve(workspaceRoot, '.env/model.local'),
  resolve(workspaceRoot, '.env/providers.local'),
  resolve(workspaceRoot, '.env.local'),
].forEach(loadEnvFile);

const filePath = process.env.AGENT_PROJECT_STORE || new URL('../.tmp/agent-project-store.json', import.meta.url);
const securityAuditLogPath = process.env.AGENT_SECURITY_AUDIT_LOG || undefined;
const defaultRuntimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/agent-projects');
const runtimeRoot = resolve(process.env.AGENT_PROJECT_RUNTIME_ROOT || defaultRuntimeRoot);
const port = Number(process.env.AGENT_PROJECT_PORT || 8787);
const host = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const autonomousSchedulerEnabled = /^(1|true|yes)$/i.test(process.env.AGENT_AUTONOMOUS_SCHEDULER || '');
const autonomousSchedulerIntervalMs = Number(process.env.AGENT_AUTONOMOUS_INTERVAL_MS || 60_000);
const accessControlMode = process.env.AGENT_ACCESS_CONTROL_MODE || 'prototype-open';
const accessSigningSecret = process.env.AGENT_ACCESS_SIGNING_SECRET || '';
const accessReplayProtection = /^(1|true|yes)$/i.test(process.env.AGENT_ACCESS_REPLAY_PROTECTION || '');
const accessAuditFailClosed = /^(1|true|yes)$/i.test(process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED || '');
const secretVault = createSecretVaultFromEnv(process.env);
const secretVaultStatus = secretVault.status();
const llmProvider = createModelProviderFromEnv(process.env, { secretVaultStatus });
const searchProvider = createSearchProviderFromEnv(process.env, { secretVaultStatus });
const projectRuntime = createLocalProjectRuntime({
  rootPath: runtimeRoot,
  enableCommandExecution: /^(1|true|yes)$/i.test(process.env.AGENT_WORKSPACE_EXEC || ''),
  allowedCommands: (process.env.AGENT_WORKSPACE_ALLOWED_COMMANDS || 'node,npm,git')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
});

const httpServer = createAgentProjectHttpServer({
  filePath,
  securityAuditLogPath,
  projectRuntime,
  autonomousScheduler: {
    enabled: autonomousSchedulerEnabled,
    intervalMs: autonomousSchedulerIntervalMs,
    runImmediately: autonomousSchedulerEnabled,
  },
  llmProvider,
  searchProvider,
  secretVault,
  accessControl: {
    defaultMode: accessControlMode,
    signingSecret: accessSigningSecret,
    requireSignedRequestIds: accessReplayProtection,
    failClosedOnAuditError: accessAuditFailClosed,
  },
});
const runtime = await httpServer.listen({ port, host });

console.log(`Agent project backend listening on ${runtime.url}`);
console.log(`Store: ${httpServer.api.store.filePath}`);
console.log(`Security audit log: ${httpServer.api.store.securityAuditLogPath || 'disabled'}`);
console.log(`Project runtime: ${runtimeRoot}`);
console.log(`Autonomous scheduler: ${autonomousSchedulerEnabled ? `enabled every ${autonomousSchedulerIntervalMs}ms` : 'disabled'}`);
console.log(`Access control: ${accessControlMode}`);
console.log(`Access signing: ${accessSigningSecret ? 'enabled' : 'disabled'}`);
console.log(`Access replay protection: ${accessReplayProtection ? 'enabled' : 'disabled'}`);
console.log(`Access audit fail-closed: ${accessAuditFailClosed ? 'enabled' : 'disabled'}`);
console.log(`Secret vault: ${secretVaultStatus.ready ? `ready (${secretVaultStatus.provider}/${secretVaultStatus.encryptedRecordCount} record(s))` : 'disabled or not configured'}`);
console.log(`Model provider: ${llmProvider.enabled ? `enabled (${llmProvider.provider}/${llmProvider.model})` : `disabled (${llmProvider.status().configured ? 'configured but not enabled or blocked' : 'missing key or disabled'})`}`);
console.log(`Search provider: ${searchProvider.enabled ? `enabled (${searchProvider.provider})` : `disabled (${searchProvider.status().configured ? 'configured but not enabled' : 'missing endpoint/key or disabled'})`}`);

const shutdown = async () => {
  await httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
