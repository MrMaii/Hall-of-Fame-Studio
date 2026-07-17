import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import {
  createLocalDevSupervisor,
  createLocalRuntimeStatusWriter,
} from '../src/localRuntime/localDevSupervisor.js';
import {
  findAvailableLocalPort,
  validateLocalNodeVersion,
} from '../src/localRuntime/localStartupPreflight.js';

const host = process.env.VITE_HOST || '127.0.0.1';
const backendHost = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const nodeCheck = validateLocalNodeVersion();
if (!nodeCheck.ok) {
  console.error(nodeCheck.message);
  process.exit(1);
}
const backendPort = await findAvailableLocalPort({
  host: backendHost,
  preferredPort: process.env.AGENT_PROJECT_PORT || 8787,
});
const vitePort = await findAvailableLocalPort({
  host,
  preferredPort: process.env.VITE_PORT || 5173,
  excludedPorts: backendHost === host ? [backendPort] : [],
});
const backendUrl = `http://${backendHost}:${backendPort}`;
const uiUrl = `http://${host}:${vitePort}`;
const localRuntimeEnv = {
  ...process.env,
  AGENT_PROJECT_HOST: backendHost,
  AGENT_PROJECT_PORT: String(backendPort),
  VITE_HOST: host,
  VITE_PORT: String(vitePort),
  VITE_AGENT_BACKEND_URL: backendUrl,
  AGENT_LOCAL_AUTH_REQUIRED: process.env.AGENT_LOCAL_AUTH_REQUIRED || 'true',
  AGENT_PROJECT_MEMBERSHIP_REQUIRED: process.env.AGENT_PROJECT_MEMBERSHIP_REQUIRED || 'true',
  AGENT_AUTONOMOUS_SCHEDULER: process.env.AGENT_AUTONOMOUS_SCHEDULER || 'true',
  AGENT_AUTONOMOUS_AGENT_STRATEGY: process.env.AGENT_AUTONOMOUS_AGENT_STRATEGY || 'true',
  AGENT_AUTONOMOUS_AGENT_SUBMISSIONS: process.env.AGENT_AUTONOMOUS_AGENT_SUBMISSIONS || 'true',
  AGENT_AUTONOMOUS_AGENT_REVIEWS: process.env.AGENT_AUTONOMOUS_AGENT_REVIEWS || 'true',
  AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES: process.env.AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES || 'true',
};
const backend = spawn(process.execPath, ['scripts/agent-project-server.mjs'], {
  stdio: 'inherit',
  env: localRuntimeEnv,
});
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', host, '--port', String(vitePort), '--strictPort'], {
  stdio: 'inherit',
  env: localRuntimeEnv,
});
const children = [backend, vite];
const runtimeStatusPath = resolve(process.env.AGENT_LOCAL_RUNTIME_STATUS_FILE || '.tmp/local-runtime-status.json');
const supervisor = createLocalDevSupervisor({
  backend,
  ui: vite,
  writeStatus: createLocalRuntimeStatusWriter(runtimeStatusPath),
  runtimeUrls: { backendUrl, uiUrl },
});

backend.on('error', (error) => {
  console.error(`Agent backend failed to start: ${error.message}`);
});
backend.on('exit', (code, signal) => {
  console.error(`Agent backend exited (code=${code ?? 'null'}, signal=${signal || 'none'}). The UI remains available for recovery.`);
});
vite.on('error', (error) => {
  console.error(`Vite UI failed to start: ${error.message}`);
});
vite.on('exit', (code, signal) => {
  console.error(`Vite UI exited (code=${code ?? 'null'}, signal=${signal || 'none'}).`);
});

process.on('SIGINT', () => supervisor.stop(0));
process.on('SIGTERM', () => supervisor.stop(0));
process.on('exit', () => {
  children.forEach((child) => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  });
});

console.log(`Local MVP: backend ${backendUrl} + UI ${uiUrl} (local auth and project membership required)`);
