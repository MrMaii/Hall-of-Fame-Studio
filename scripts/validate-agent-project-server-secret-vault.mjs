import { spawn } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `agent-project-server-secret-vault-validate-${process.pid}`);
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const plaintextSecret = 'SERVER_VALIDATE_MODEL_KEY_SHOULD_NOT_LEAK';
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForServerUrl(child, { timeoutMs = 15000 } = {}) {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let output = '';
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for agents:server startup. Output: ${output.slice(-1200)}`));
    }, timeoutMs);

    const finish = (error, url = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolvePromise(url);
    };

    const inspectChunk = (chunk) => {
      output += String(chunk);
      const match = output.match(/Agent project backend listening on (http:\/\/[^\s]+)/);
      if (match) finish(null, match[1]);
    };

    child.stdout.on('data', inspectChunk);
    child.stderr.on('data', inspectChunk);
    child.once('exit', (code, signal) => {
      finish(new Error(`agents:server exited before startup. code=${code} signal=${signal || 'none'} output=${output.slice(-1200)}`));
    });
    child.once('error', finish);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function startBackend() {
  return spawn(process.execPath, [serverScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AGENT_PROJECT_HOST: '127.0.0.1',
      AGENT_PROJECT_PORT: '0',
      AGENT_PROJECT_STORE: resolve(tempRoot, 'store.json'),
      AGENT_PROJECT_RUNTIME_ROOT: resolve(tempRoot, 'runtime'),
      AGENT_SECURITY_AUDIT_LOG: resolve(tempRoot, 'security-audit.jsonl'),
      SECRET_VAULT_ENABLED: 'true',
      SECRET_VAULT_KEY: 'agent-project-server-secret-vault-validation-key',
      SECRET_VAULT_KEY_ID: 'agent-project-server-validate-v1',
      SECRET_VAULT_RECORDS_FILE: secretVaultRecordsFile,
      MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
      MODEL_NAME: 'local-fixture-model',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopBackend(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolvePromise();
    });
  });
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

let child = startBackend();

try {
  let backendUrl = await waitForServerUrl(child);
  let response = await fetchJson(`${backendUrl}/secret-vault/status`);
  assert(response.status === 200, `Secret vault status route returned ${response.status}.`);
  assert(response.body.secretVaultStatus?.ready === true, 'agents:server must start with a ready Secret Vault when SECRET_VAULT_ENABLED and SECRET_VAULT_KEY are set.');
  assert(response.body.secretVaultStatus?.keyId === 'agent-project-server-validate-v1', 'Secret Vault status must expose the configured key id.');

  response = await fetchJson(`${backendUrl}/secret-vault/seal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'model.apiKey',
      value: plaintextSecret,
      metadata: {
        scope: 'model-provider',
        source: 'agents-server-secret-vault-validation',
      },
      now: '2026-06-01T12:00:00.000Z',
    }),
  });
  const serializedSealResponse = JSON.stringify(response.body);
  assert(response.status === 200, `Secret vault seal route returned ${response.status}.`);
  assert(response.body.secretVaultSealReceipt?.schemaVersion === 'secret-vault-seal-receipt/v1', 'Secret Vault seal route must return a seal receipt.');
  assert(response.body.providerRuntimeBinding?.kind === 'model' && response.body.providerRuntimeBinding?.bound === true, 'Secret Vault model key seal must bind the running model provider.');
  assert(!serializedSealResponse.includes(plaintextSecret), 'Secret Vault seal response must not expose plaintext API keys.');

  response = await fetchJson(`${backendUrl}/llm/status`);
  assert(response.body.modelProvider?.hasApiKey === true, 'Model provider status must report a runtime key after model.apiKey seal.');
  assert(response.body.modelProvider?.apiKeySource === 'local-secret-vault', 'Model provider status must report local-secret-vault after model.apiKey seal.');
  assert(response.body.modelProvider?.runtimeEnabled === true, 'Model provider runtime must enable after an intentional model.apiKey vault seal.');
  assert(response.body.modelProvider?.enabled === true, 'Model provider must be callable after model.apiKey vault seal when a local endpoint is configured.');
  assert(response.body.modelProvider?.endpointPolicy?.status === 'local-endpoint', 'agents:server must classify the configured model endpoint as local-only.');

  response = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(response.body);
  assert(response.status === 200, `Secret vault records route returned ${response.status}.`);
  assert(response.body.secretVaultRecords?.records?.some((record) => record.name === 'model.apiKey' && record.encrypted === true), 'Secret Vault records must expose encrypted model.apiKey metadata.');
  assert(!serializedRecords.includes(plaintextSecret) && !serializedRecords.includes('ciphertext'), 'Secret Vault records route must not expose plaintext or ciphertext.');

  await stopBackend(child);
  child = startBackend();
  backendUrl = await waitForServerUrl(child);

  response = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRestartRecords = JSON.stringify(response.body);
  assert(response.body.secretVaultRecords?.records?.some((record) => record.name === 'model.apiKey' && record.encrypted === true), 'agents:server restart must reload encrypted Secret Vault records from the configured records file.');
  assert(!serializedRestartRecords.includes(plaintextSecret) && !serializedRestartRecords.includes('ciphertext'), 'Restarted Secret Vault records route must not expose plaintext or ciphertext.');
  response = await fetchJson(`${backendUrl}/llm/status`);
  assert(response.body.modelProvider?.hasApiKey === true, 'Restarted model provider must rehydrate model.apiKey from the Secret Vault records file.');
  assert(response.body.modelProvider?.apiKeySource === 'local-secret-vault', 'Restarted model provider must keep local-secret-vault as the key source.');
  assert(response.body.modelProvider?.runtimeEnabled === true, 'Restarted model provider runtime must remain enabled after Secret Vault rehydration.');
  assert(response.body.modelProvider?.enabled === true, 'Restarted model provider must remain callable after Secret Vault rehydration with a local endpoint.');

  console.log('Agent project server Secret Vault validation passed.');
} finally {
  await stopBackend(child);
  await rm(tempRoot, { recursive: true, force: true });
}
