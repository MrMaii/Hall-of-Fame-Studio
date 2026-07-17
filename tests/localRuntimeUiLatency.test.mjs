import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const localModelSettingsSource = readFileSync(new URL('../src/settings/LocalModelSettings.jsx', import.meta.url), 'utf8');

test('does not make an offline backend write before running a local sample fixture interaction', () => {
  assert.match(
    appSource,
    /\(!isManagerDemoProject\(project\) \|\| backendStation\.connectionStatus === 'online'\)/,
  );
});

test('rejects remote backend targets and presents local-runtime configuration copy', () => {
  assert.match(appSource, /if \(!isLocalNetworkEndpoint\(nextUrl\)\)/);
  assert.match(appSource, /Backend URL must use a local or private-network host/);
  assert.match(localModelSettingsSource, /这个本地模型不需要密钥（例如默认配置的 Ollama）/);
});

test('automatically treats the bundled local backend as the default target', () => {
  assert.match(appSource, /const hasConfiguredBackendBaseUrl = \(\) => \{/);
  assert.match(appSource, /return isValidBackendBaseUrl\(DEFAULT_AGENT_BACKEND_URL\) && isLocalNetworkEndpoint\(DEFAULT_AGENT_BACKEND_URL\);/);
  assert.doesNotMatch(appSource, /return false;\s*}\s*return isValidBackendBaseUrl\(import\.meta\.env/);
});

test('routes local provider refreshes through one stale-safe coordinator instead of timer retries', () => {
  assert.match(appSource, /import \{ createProviderRuntimeCoordinator \} from '\.\/agents\/providerRuntimeCoordinator\.js';/);
  assert.match(appSource, /providerRuntimeCoordinator\.current\.request\(\{/);
  assert.match(appSource, /reason: 'vault-seal'/);
  assert.doesNotMatch(appSource, /providerRuntimeSyncPendingRef/);
  assert.doesNotMatch(appSource, /setTimeout\(\(\) => syncSettingsProviderRuntime/);
});
