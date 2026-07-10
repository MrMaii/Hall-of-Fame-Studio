import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function localRecoverySources(env = process.env) {
  const projectStore = resolve(workspaceRoot, env.AGENT_PROJECT_STORE || '.tmp/agent-project-store.json');
  return [
    { key: 'project-store', path: projectStore, kind: 'file' },
    { key: 'security-audit-log', path: env.AGENT_SECURITY_AUDIT_LOG || `${projectStore}.security-audit.jsonl`, kind: 'file' },
    { key: 'local-auth', path: env.AGENT_LOCAL_AUTH_STORE || `${projectStore}.local-auth.json`, kind: 'file' },
    { key: 'secret-vault-records', path: env.SECRET_VAULT_RECORDS_FILE || resolve(workspaceRoot, '.tmp/agent-secret-vault-records.json'), kind: 'file' },
    { key: 'local-runtime-settings', path: env.AGENT_LOCAL_RUNTIME_SETTINGS_FILE || resolve(workspaceRoot, '.tmp/agent-local-user-runtime.json'), kind: 'file' },
    { key: 'local-runtime-telemetry', path: env.AGENT_LOCAL_TELEMETRY_LOG || resolve(workspaceRoot, '.tmp/agent-runtime-observability.jsonl'), kind: 'file' },
    { key: 'project-runtime', path: env.AGENT_PROJECT_RUNTIME_ROOT || resolve(workspaceRoot, '.tmp/agent-projects'), kind: 'directory' },
  ];
}

export function localRecoveryDestinations(env = process.env) {
  return Object.fromEntries(localRecoverySources(env).map((source) => [source.key, source.path]));
}
