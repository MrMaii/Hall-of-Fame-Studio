import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProviderFromEnv } from '../src/agents/modelProvider.js';
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
const defaultRuntimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/agent-projects');
const runtimeRoot = resolve(process.env.AGENT_PROJECT_RUNTIME_ROOT || defaultRuntimeRoot);
const port = Number(process.env.AGENT_PROJECT_PORT || 8787);
const host = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const autonomousSchedulerEnabled = /^(1|true|yes)$/i.test(process.env.AGENT_AUTONOMOUS_SCHEDULER || '');
const autonomousSchedulerIntervalMs = Number(process.env.AGENT_AUTONOMOUS_INTERVAL_MS || 60_000);
const llmProvider = createModelProviderFromEnv(process.env);
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
  projectRuntime,
  autonomousScheduler: {
    enabled: autonomousSchedulerEnabled,
    intervalMs: autonomousSchedulerIntervalMs,
    runImmediately: autonomousSchedulerEnabled,
  },
  llmProvider,
});
const runtime = await httpServer.listen({ port, host });

console.log(`Agent project backend listening on ${runtime.url}`);
console.log(`Store: ${httpServer.api.store.filePath}`);
console.log(`Project runtime: ${runtimeRoot}`);
console.log(`Autonomous scheduler: ${autonomousSchedulerEnabled ? `enabled every ${autonomousSchedulerIntervalMs}ms` : 'disabled'}`);
console.log(`Model provider: ${llmProvider.enabled ? `enabled (${llmProvider.provider}/${llmProvider.model})` : `disabled (${llmProvider.status().configured ? 'configured but not enabled or blocked' : 'missing key or disabled'})`}`);

const shutdown = async () => {
  await httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
