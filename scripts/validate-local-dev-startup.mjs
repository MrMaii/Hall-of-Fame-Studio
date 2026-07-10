import { spawn } from 'node:child_process';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchWithRetry(url, { timeoutMs = 12_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw lastError || new Error(`Timed out waiting for ${url}.`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

const suffix = `${process.pid}_${Date.now()}`;
const backendPort = 18_000 + (process.pid % 1_000);
const vitePort = backendPort + 1;
const backendUrl = `http://127.0.0.1:${backendPort}`;
const viteUrl = `http://127.0.0.1:${vitePort}`;
const child = spawn(process.execPath, ['scripts/local-dev.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    AGENT_PROJECT_HOST: '127.0.0.1',
    AGENT_PROJECT_PORT: String(backendPort),
    AGENT_PROJECT_STORE: `.tmp/local-dev-startup-${suffix}.json`,
    AGENT_PROJECT_RUNTIME_ROOT: `.tmp/local-dev-runtime-${suffix}`,
    VITE_HOST: '127.0.0.1',
    VITE_PORT: String(vitePort),
    VITE_AGENT_BACKEND_URL: backendUrl,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += String(chunk); });
child.stderr.on('data', (chunk) => { output += String(chunk); });

try {
  const [backend, ui, scheduler] = await Promise.all([
    fetchWithRetry(`${backendUrl}/projects`),
    fetchWithRetry(viteUrl),
    fetchWithRetry(`${backendUrl}/workers/autonomous/status`),
  ]);
  assert(backend.status === 200, 'npm run dev must make the local project backend reachable.');
  assert(ui.status === 200, 'npm run dev must make the Vite UI reachable.');
  const schedulerStatus = await scheduler.json();
  assert(schedulerStatus.scheduler?.enabled === true, 'npm run dev must enable the local autonomous scheduler for approved projects.');
  console.log('Local dev startup contract passed.');
} catch (error) {
  throw new Error(`${error.message || String(error)} Supervisor output: ${output.slice(-1600)}`);
} finally {
  await stop(child);
}
