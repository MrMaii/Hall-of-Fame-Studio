import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `search-provider-vault-endpoint-validate-${process.pid}`);
const serverScript = resolve(repoRoot, 'scripts', 'agent-project-server.mjs');
const secretVaultRecordsFile = resolve(tempRoot, 'secret-vault-records.json');
const searchPlaintext = 'SEARCH_ENDPOINT_VALIDATION_KEY_SHOULD_NOT_LEAK';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function listen(server, { port = 0, host = '127.0.0.1' } = {}) {
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      const address = server.address();
      resolvePromise({
        server,
        url: `http://${address.address}:${address.port}`,
      });
    });
  });
}

function createMockSearchServer(requests) {
  return createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => {
      body += String(chunk);
    });
    request.on('end', () => {
      requests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization || '',
        body,
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        id: 'mock-search-response-1',
        confidence: 'high',
        findings: ['Mock search gateway returned external evidence.'],
        sources: [
          {
            id: 'mock-source-1',
            title: 'Mock search source',
            url: 'https://example.test/source?token=SHOULD_REDACT',
            summary: 'A controlled evidence result from the local validation search gateway.',
            confidence: 'high',
          },
        ],
      }));
    });
  });
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
      SECRET_VAULT_KEY: 'search-provider-vault-endpoint-validation-key',
      SECRET_VAULT_KEY_ID: 'search-provider-vault-endpoint-v1',
      SECRET_VAULT_RECORDS_FILE: secretVaultRecordsFile,
      SEARCH_PROVIDER: '',
      SEARCH_ENDPOINT: '',
      SEARCH_PROVIDER_ENDPOINT: '',
      SEARCH_API_KEY: '',
      SEARCH_PROVIDER_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopBackend(child) {
  if (!child || child.killed) return;
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

const searchRequests = [];
const mockSearchRuntime = await listen(createMockSearchServer(searchRequests));
let backendChild = null;

try {
  backendChild = startBackend();
  const backendUrl = await waitForServerUrl(backendChild);

  let response = await fetchJson(`${backendUrl}/search/status`);
  assert(response.status === 200, `Initial /search/status returned ${response.status}.`);
  assert(response.body.searchProvider?.configured === false, 'Search provider must start unconfigured without env endpoint.');

  response = await fetchJson(`${backendUrl}/secret-vault/seal`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'search.endpoint',
      value: `${mockSearchRuntime.url}/search`,
      scope: 'search-provider',
      source: 'settings-provider-boundary',
      metadata: {
        providerKind: 'search',
        secretKind: 'endpoint',
        provider: 'http-json',
        sealedFrom: 'settings-ui',
      },
    }),
  });
  assert(response.status === 200, `Endpoint seal returned ${response.status}.`);
  assert(response.body.providerRuntimeBinding?.target === 'endpoint', 'Sealing search.endpoint must bind the running search endpoint.');
  assert(response.body.providerRuntimeBinding?.bound === true, 'Search endpoint seal must report a runtime binding.');

  response = await fetchJson(`${backendUrl}/secret-vault/seal`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'search.apiKey',
      value: searchPlaintext,
      scope: 'search-provider',
      source: 'settings-provider-boundary',
      metadata: {
        providerKind: 'search',
        secretKind: 'api-key',
        sealedFrom: 'settings-ui',
      },
    }),
  });
  assert(response.status === 200, `Search key seal returned ${response.status}.`);
  assert(response.body.providerRuntimeBinding?.target === 'api-key', 'Sealing search.apiKey must bind the running search key.');

  response = await fetchJson(`${backendUrl}/search/status`);
  const status = response.body.searchProvider || {};
  assert(status.provider === 'http-json', 'Search provider must switch to http-json after endpoint seal.');
  assert(status.configured === true && status.enabled === true, 'Vault-backed search endpoint/key must make /search/status callable.');
  assert(status.hasEndpoint === true && status.endpointSource === 'local-secret-vault', 'Search status must report a vault-backed endpoint.');
  assert(status.hasApiKey === true && status.apiKeySource === 'local-secret-vault', 'Search status must report a vault-backed API key.');
  assert(!JSON.stringify(status).includes(searchPlaintext), 'Search status must not expose the raw search key.');

  response = await fetchJson(`${backendUrl}/search/test`, {
    method: 'POST',
    body: JSON.stringify({ query: 'autonomous research evidence' }),
  });
  assert(response.status === 200, `/search/test returned ${response.status}.`);
  assert(response.body.ok === true, '/search/test must call the vault-backed search provider.');
  assert(response.body.sources?.length === 1, '/search/test must return normalized sources from the provider.');
  assert(searchRequests.length === 1, 'Mock search gateway must receive exactly one search request.');
  assert(searchRequests[0].authorization === `Bearer ${searchPlaintext}`, 'Search provider must send the sealed API key to the configured endpoint.');

  response = await fetchJson(`${backendUrl}/secret-vault/records`);
  const serializedRecords = JSON.stringify(response.body);
  assert(response.status === 200, `Secret vault records returned ${response.status}.`);
  assert(response.body.secretVaultRecords?.records?.some((record) => record.name === 'search.endpoint' && record.encrypted === true), 'Vault records must include encrypted search.endpoint metadata.');
  assert(response.body.secretVaultRecords?.records?.some((record) => record.name === 'search.apiKey' && record.encrypted === true), 'Vault records must include encrypted search.apiKey metadata.');
  assert(!serializedRecords.includes(searchPlaintext), 'Vault record list must not expose the raw search API key.');
  assert(!serializedRecords.includes(mockSearchRuntime.url), 'Vault record list must not expose the raw search endpoint.');
  assert(!serializedRecords.includes('ciphertext'), 'Vault record list must not expose ciphertext.');

  await stopBackend(backendChild);
  backendChild = startBackend();
  const restartedBackendUrl = await waitForServerUrl(backendChild);
  response = await fetchJson(`${restartedBackendUrl}/search/status`);
  assert(response.body.searchProvider?.configured === true, 'Restarted backend must rehydrate the search endpoint from the encrypted vault records.');
  assert(response.body.searchProvider?.endpointSource === 'local-secret-vault', 'Restarted backend must preserve local-secret-vault endpoint source.');
  assert(response.body.searchProvider?.apiKeySource === 'local-secret-vault', 'Restarted backend must preserve local-secret-vault key source.');

  console.log('Search provider vault endpoint validation passed.');
} finally {
  await stopBackend(backendChild);
  await new Promise((resolvePromise) => mockSearchRuntime.server.close(resolvePromise)).catch(() => {});
  await rm(tempRoot, { recursive: true, force: true });
}
