import { spawn } from 'node:child_process';

const host = process.env.VITE_HOST || '127.0.0.1';
const vitePort = String(process.env.VITE_PORT || '5173');
const localRuntimeEnv = {
  ...process.env,
  AGENT_LOCAL_AUTH_REQUIRED: process.env.AGENT_LOCAL_AUTH_REQUIRED || 'true',
  AGENT_PROJECT_MEMBERSHIP_REQUIRED: process.env.AGENT_PROJECT_MEMBERSHIP_REQUIRED || 'true',
  AGENT_AUTONOMOUS_SCHEDULER: process.env.AGENT_AUTONOMOUS_SCHEDULER || 'true',
  AGENT_AUTONOMOUS_AGENT_STRATEGY: process.env.AGENT_AUTONOMOUS_AGENT_STRATEGY || 'true',
  AGENT_AUTONOMOUS_AGENT_SUBMISSIONS: process.env.AGENT_AUTONOMOUS_AGENT_SUBMISSIONS || 'true',
  AGENT_AUTONOMOUS_AGENT_REVIEWS: process.env.AGENT_AUTONOMOUS_AGENT_REVIEWS || 'true',
  AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES: process.env.AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES || 'true',
};
let stopping = false;
let exitCode = 0;

const backend = spawn(process.execPath, ['scripts/agent-project-server.mjs'], {
  stdio: 'inherit',
  env: localRuntimeEnv,
});
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', host, '--port', vitePort], {
  stdio: 'inherit',
  env: localRuntimeEnv,
});
const children = [backend, vite];

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  children.forEach((child) => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  });
  setTimeout(() => process.exit(exitCode), 3_000).unref();
}

children.forEach((child, index) => {
  child.once('error', (error) => {
    console.error(`${index === 0 ? 'Agent backend' : 'Vite UI'} failed to start: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(`${index === 0 ? 'Agent backend' : 'Vite UI'} exited unexpectedly (code=${code ?? 'null'}, signal=${signal || 'none'}).`);
    stop(code === 0 ? 1 : code || 1);
  });
});

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('exit', () => {
  children.forEach((child) => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  });
});

console.log(`Local MVP: backend http://${process.env.AGENT_PROJECT_HOST || '127.0.0.1'}:${process.env.AGENT_PROJECT_PORT || '8787'} + UI http://${host}:${vitePort} (local auth and project membership required)`);
