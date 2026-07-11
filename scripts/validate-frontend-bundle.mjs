import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDirectory = resolve(repoRoot, 'dist', 'assets');
const assets = readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, bytes: statSync(resolve(assetsDirectory, file)).size }));
const findChunk = (prefix) => assets.find((asset) => asset.file.startsWith(prefix));

const entry = findChunk('index-');
const agentRuntime = findChunk('agent-runtime-');
const reactVendor = findChunk('react-vendor-');
const iconsVendor = findChunk('icons-vendor-');
const agentMarketScene = findChunk('AgentMarketScene-');
const agentDossierScene = findChunk('AgentDossierScene-');

assert.ok(entry, 'Production build must emit an application entry chunk.');
assert.ok(agentRuntime, 'Production build must isolate the Agent runtime from the application entry.');
assert.ok(reactVendor, 'Production build must isolate React vendor code for cache reuse.');
assert.ok(iconsVendor, 'Production build must isolate icon vendor code for cache reuse.');
assert.ok(agentMarketScene, 'Production build must emit the lazy Agent Market scene chunk.');
assert.ok(agentDossierScene, 'Production build must emit the lazy Agent Dossier scene chunk.');
assert.ok(entry.bytes < 1_600_000, `Application entry (${entry.bytes} bytes) exceeds the 1.6 MB parsed-JavaScript budget.`);

console.log(`Frontend bundle budget passed: entry ${entry.bytes} bytes; agent runtime ${agentRuntime.bytes} bytes; Agent Market ${agentMarketScene.bytes} bytes; Agent Dossier ${agentDossierScene.bytes} bytes; React ${reactVendor.bytes} bytes; icons ${iconsVendor.bytes} bytes.`);
