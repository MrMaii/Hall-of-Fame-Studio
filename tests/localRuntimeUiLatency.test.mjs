import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('does not make an offline backend write before running a local sample fixture interaction', () => {
  assert.match(
    appSource,
    /\(!isManagerDemoProject\(project\) \|\| backendStation\.connectionStatus === 'online'\)/,
  );
});

test('rejects remote backend targets and presents local-runtime configuration copy', () => {
  assert.match(appSource, /if \(!isLocalNetworkEndpoint\(nextUrl\)\)/);
  assert.match(appSource, /Backend URL must use a local or private-network host/);
  assert.match(appSource, /Local OpenAI-compatible runtimes such as Ollama/);
});

test('does not treat the fallback backend URL as an explicitly configured target', () => {
  assert.match(appSource, /const hasConfiguredBackendBaseUrl = \(\) => \{/);
  assert.doesNotMatch(appSource, /return isValidBackendBaseUrl\(DEFAULT_AGENT_BACKEND_URL\);/);
  assert.match(appSource, /return isValidBackendBaseUrl\(import\.meta\.env\?\.VITE_AGENT_BACKEND_URL \|\| ''\);/);
});

test('routes local provider refreshes through one stale-safe coordinator instead of timer retries', () => {
  assert.match(appSource, /import \{ createProviderRuntimeCoordinator \} from '\.\/agents\/providerRuntimeCoordinator\.js';/);
  assert.match(appSource, /providerRuntimeCoordinator\.current\.request\(\{/);
  assert.match(appSource, /reason: 'vault-seal'/);
  assert.doesNotMatch(appSource, /providerRuntimeSyncPendingRef/);
  assert.doesNotMatch(appSource, /setTimeout\(\(\) => syncSettingsProviderRuntime/);
});
