import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdapterGatewayServer } from '../src/agents/adapterGatewayServer.js';

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
  resolve(workspaceRoot, '.env/adapters.local'),
  resolve(workspaceRoot, '.env/providers.local'),
  resolve(workspaceRoot, '.env.local'),
].forEach(loadEnvFile);

const host = process.env.ADAPTER_GATEWAY_HOST || '127.0.0.1';
const port = Number(process.env.ADAPTER_GATEWAY_PORT || 8797);
const storageDriver = process.env.ADAPTER_GATEWAY_STORAGE_DRIVER || 'json-file';
const storagePath = resolve(process.env.ADAPTER_GATEWAY_STORE || resolve(workspaceRoot, '.tmp/adapter-gateway-store.json'));
const storageDatabaseUrl = process.env.ADAPTER_GATEWAY_POSTGRES_URL || '';
const storageSchema = process.env.ADAPTER_GATEWAY_POSTGRES_SCHEMA || 'hofs_gateway';
const authToken = process.env.ADAPTER_GATEWAY_AUTH_TOKEN || '';
const maxBodyBytes = Number(process.env.ADAPTER_GATEWAY_MAX_BODY_BYTES || 25 * 1024 * 1024);

const gateway = createAdapterGatewayServer({
  storageDriver,
  storagePath,
  storageDatabaseUrl,
  storageSchema,
  authToken,
  maxBodyBytes,
});
const runtime = await gateway.listen({ host, port });

console.log(`Adapter gateway listening on ${runtime.url}`);
console.log(`Store: ${storageDriver}${runtime.storagePath ? ` (${runtime.storagePath})` : ''}`);
console.log(`Auth: ${authToken ? 'bearer token required' : 'disabled'}`);
console.log('Production cutover: blocked until real database/queue approval');

const shutdown = async () => {
  await gateway.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
