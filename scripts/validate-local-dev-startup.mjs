import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runId = randomUUID();
const backendPort = 18_000 + Math.floor(Math.random() * 1_000);
const uiPort = 15_000 + Math.floor(Math.random() * 1_000);
const tempRoot = resolve(root, '.tmp', `local-dev-verify-${runId}`);
const {
  AGENT_LOCAL_AUTH_REQUIRED: _localAuthRequired,
  AGENT_PROJECT_MEMBERSHIP_REQUIRED: _projectMembershipRequired,
  ...parentEnv
} = process.env;
const env = {
  ...parentEnv,
  AGENT_PROJECT_HOST: '127.0.0.1',
  AGENT_PROJECT_PORT: String(backendPort),
  VITE_HOST: '127.0.0.1',
  VITE_PORT: String(uiPort),
  AGENT_PROJECT_STORE: resolve(tempRoot, 'projects.json'),
  AGENT_LOCAL_AUTH_STORE: resolve(tempRoot, 'users.json'),
  AGENT_PROJECT_RUNTIME_ROOT: resolve(tempRoot, 'projects'),
  SECRET_VAULT_RECORDS_FILE: resolve(tempRoot, 'vault-records.json'),
};
let output = '';
const child = spawn(process.execPath, ['scripts/local-dev.mjs'], {
  cwd: root,
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitFor(url, predicate, label) {
  const deadline = Date.now() + 30_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (await predicate(response)) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`${label} did not become ready: ${lastError?.message || 'unknown error'}\n${output.slice(-2_000)}`);
}

async function stopChild() {
  if (child.exitCode !== null || child.killed) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => child.once('exit', resolveExit)),
    wait(5_000),
  ]);
  if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
}

try {
  await waitFor(`http://127.0.0.1:${backendPort}/local-auth/status`, async (response) => {
    if (!response.ok) return false;
    const body = await response.json();
    return body.localAuth?.enabled === true
      && body.localAuth?.bootstrapRequired === true
      && body.localAuth?.userCount === 0;
  }, 'local auth backend');
  await waitFor(`http://127.0.0.1:${uiPort}/`, async (response) => response.ok, 'Vite UI');
  const bootstrap = await fetch(`http://127.0.0.1:${backendPort}/local-auth/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'local-verify-owner', password: 'local-verify-password-12345' }),
  });
  assert.equal(bootstrap.status, 201, 'The isolated local backend must permit its first administrator bootstrap.');
  const bootstrapBody = await bootstrap.json();
  const headers = { 'x-hofs-local-auth-token': bootstrapBody.localAuth?.token || '' };
  assert.ok(headers['x-hofs-local-auth-token'], 'Bootstrap must issue an in-memory verification session.');
  const projects = await fetch(`http://127.0.0.1:${backendPort}/projects`, { headers });
  assert.equal(projects.status, 200, 'A bootstrapped local administrator must reach the project catalog.');
  const scheduler = await fetch(`http://127.0.0.1:${backendPort}/workers/autonomous/status`, { headers });
  assert.equal(scheduler.status, 200, 'A bootstrapped local administrator must inspect scheduler status.');
  const schedulerBody = await scheduler.json();
  assert.equal(schedulerBody.scheduler?.enabled, true, 'npm run dev must enable the local autonomous scheduler for approved projects.');
  assert.match(output, /local auth and project membership required/);
  console.log('Local development startup verification passed.');
} finally {
  await stopChild();
  if (existsSync(tempRoot)) rmSync(tempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
