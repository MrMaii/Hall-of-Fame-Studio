import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';
import { createModelProviderFromEnv } from '../src/agents/modelProvider.js';
import { createSearchProviderFromEnv } from '../src/agents/searchProvider.js';
import { createSecretVaultFromEnv } from '../src/agents/secretVault.js';
import { findProviderVaultRecord } from '../src/agents/providerSecretBinding.js';
import { createLocalTelemetryPort } from '../src/agents/localTelemetryPort.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
  resolve(workspaceRoot, '.env/model.local'),
  resolve(workspaceRoot, '.env/providers.local'),
  resolve(workspaceRoot, '.env.local'),
].forEach(loadEnvFile);

const envFlag = (name) => /^(1|true|yes)$/i.test(process.env[name] || '');
const optionalNumberEnv = (name) => {
  const value = Number(process.env[name] || '');
  return Number.isFinite(value) && value > 0 ? value : undefined;
};
const optionalNonNegativeNumberEnv = (name) => {
  const value = Number(process.env[name] || '');
  return Number.isFinite(value) && value >= 0 ? value : undefined;
};

const filePath = process.env.AGENT_PROJECT_STORE || new URL('../.tmp/agent-project-store.json', import.meta.url);
const securityAuditLogPath = process.env.AGENT_SECURITY_AUDIT_LOG || undefined;
const defaultRuntimeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/agent-projects');
const runtimeRoot = resolve(process.env.AGENT_PROJECT_RUNTIME_ROOT || defaultRuntimeRoot);
const defaultSecretVaultRecordsFile = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/agent-secret-vault-records.json');
if (!process.env.SECRET_VAULT_RECORDS_FILE) process.env.SECRET_VAULT_RECORDS_FILE = defaultSecretVaultRecordsFile;
const localUserRuntimeSettingsFile = resolve(process.env.AGENT_LOCAL_RUNTIME_SETTINGS_FILE || resolve(workspaceRoot, '.tmp/agent-local-user-runtime.json'));
function loadLocalUserRuntimeSettings() {
  let settings = {};
  if (existsSync(localUserRuntimeSettingsFile)) {
    try {
      settings = JSON.parse(readFileSync(localUserRuntimeSettingsFile, 'utf8')) || {};
    } catch {
      settings = {};
    }
  }
  const hasLegacyLocalDevVault = existsSync(process.env.SECRET_VAULT_RECORDS_FILE)
    && readFileSync(process.env.SECRET_VAULT_RECORDS_FILE, 'utf8').includes('"keyId": "local-dev"');
  const nextSettings = {
    schemaVersion: 'agent-local-user-runtime/v1',
    secretVaultEnabled: true,
    secretVaultKey: settings.secretVaultKey || (hasLegacyLocalDevVault ? 'local-dev-vault-key' : `hof-local-${randomUUID()}`),
    secretVaultKeyId: settings.secretVaultKeyId || (hasLegacyLocalDevVault ? 'local-dev' : 'local-user'),
  };
  if (!settings.secretVaultKey || !settings.secretVaultKeyId || settings.secretVaultEnabled !== true) {
    mkdirSync(dirname(localUserRuntimeSettingsFile), { recursive: true });
    writeFileSync(localUserRuntimeSettingsFile, `${JSON.stringify(nextSettings, null, 2)}\n`, 'utf8');
  }
  return nextSettings;
}
const localUserRuntimeSettings = loadLocalUserRuntimeSettings();
if (!process.env.AGENT_LOCAL_ONLY) process.env.AGENT_LOCAL_ONLY = 'true';
if (!process.env.SECRET_VAULT_ENABLED) process.env.SECRET_VAULT_ENABLED = String(localUserRuntimeSettings.secretVaultEnabled);
if (!process.env.SECRET_VAULT_KEY) process.env.SECRET_VAULT_KEY = localUserRuntimeSettings.secretVaultKey;
if (!process.env.SECRET_VAULT_KEY_ID) process.env.SECRET_VAULT_KEY_ID = localUserRuntimeSettings.secretVaultKeyId;
const port = Number(process.env.AGENT_PROJECT_PORT || 8787);
const host = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const autonomousSchedulerEnabled = envFlag('AGENT_AUTONOMOUS_SCHEDULER');
const autonomousSchedulerIntervalMs = Number(process.env.AGENT_AUTONOMOUS_INTERVAL_MS || 60_000);
const autonomousAgentStrategyEnabled = envFlag('AGENT_AUTONOMOUS_AGENT_STRATEGY');
const autonomousAgentSubmissionsEnabled = envFlag('AGENT_AUTONOMOUS_AGENT_SUBMISSIONS');
const autonomousAgentReviewsEnabled = envFlag('AGENT_AUTONOMOUS_AGENT_REVIEWS');
const autonomousAgentReviewResponsesEnabled = envFlag('AGENT_AUTONOMOUS_AGENT_REVIEW_RESPONSES');
const accessControlMode = process.env.AGENT_ACCESS_CONTROL_MODE || 'prototype-open';
const accessSigningSecret = process.env.AGENT_ACCESS_SIGNING_SECRET || '';
const accessReplayProtection = envFlag('AGENT_ACCESS_REPLAY_PROTECTION');
const accessAuditFailClosed = envFlag('AGENT_ACCESS_AUDIT_FAIL_CLOSED');
const localAuthRequired = envFlag('AGENT_LOCAL_AUTH_REQUIRED');
const localAuthFilePath = process.env.AGENT_LOCAL_AUTH_STORE || undefined;
const projectMembershipRequired = envFlag('AGENT_PROJECT_MEMBERSHIP_REQUIRED');
const localTelemetryPath = resolve(process.env.AGENT_LOCAL_TELEMETRY_LOG || resolve(workspaceRoot, '.tmp/agent-runtime-observability.jsonl'));
const localTelemetry = createLocalTelemetryPort({
  filePath: localTelemetryPath,
  maxRecords: optionalNumberEnv('AGENT_LOCAL_TELEMETRY_MAX_RECORDS') || 500,
  maxFileBytes: optionalNumberEnv('AGENT_LOCAL_TELEMETRY_MAX_FILE_BYTES') || 1_000_000,
  maxErrorIssues: optionalNumberEnv('AGENT_LOCAL_ERROR_MAX_ISSUES') || 100,
  sloPolicy: {
    windowSize: optionalNumberEnv('AGENT_LOCAL_SLO_WINDOW_SIZE'),
    snapshotEveryRequests: optionalNumberEnv('AGENT_LOCAL_SLO_SNAPSHOT_EVERY_REQUESTS'),
    minSamples: optionalNumberEnv('AGENT_LOCAL_SLO_MIN_SAMPLES'),
    warningP95DurationMs: optionalNumberEnv('AGENT_LOCAL_SLO_WARNING_P95_MS'),
    criticalP95DurationMs: optionalNumberEnv('AGENT_LOCAL_SLO_CRITICAL_P95_MS'),
    maxServerErrorRate: optionalNonNegativeNumberEnv('AGENT_LOCAL_SLO_MAX_SERVER_ERROR_RATE'),
    consecutiveBreachWindows: optionalNumberEnv('AGENT_LOCAL_SLO_CONSECUTIVE_BREACH_WINDOWS'),
    maxSnapshots: optionalNumberEnv('AGENT_LOCAL_SLO_MAX_SNAPSHOTS'),
  },
});
const secretVault = createSecretVaultFromEnv(process.env);
const secretVaultStatus = secretVault.status();
const findVaultProviderRecord = (kind = '', target = 'api-key') => {
  const records = typeof secretVault.exportRecords === 'function' ? secretVault.exportRecords() : [];
  return findProviderVaultRecord({ kind, target, records });
};
const openVaultProviderKey = async (kind = '') => {
  const record = findVaultProviderRecord(kind, 'api-key');
  if (!record || typeof secretVault.open !== 'function') return '';
  return secretVault.open(record);
};
const openVaultProviderEndpoint = async (kind = '') => {
  const record = findVaultProviderRecord(kind, 'endpoint');
  if (!record || typeof secretVault.open !== 'function') return '';
  return secretVault.open(record);
};
const openVaultProviderModel = async (kind = '') => {
  const record = findVaultProviderRecord(kind, 'model');
  if (!record || typeof secretVault.open !== 'function') return '';
  return secretVault.open(record);
};
const openVaultProviderIdentity = async (kind = '') => {
  const record = findVaultProviderRecord(kind, 'provider');
  if (!record || typeof secretVault.open !== 'function') return '';
  return secretVault.open(record);
};
const modelApiKeyFromVault = secretVaultStatus.ready ? await openVaultProviderKey('model') : '';
const modelBaseUrlFromVault = secretVaultStatus.ready ? await openVaultProviderEndpoint('model') : '';
const modelNameFromVault = secretVaultStatus.ready ? await openVaultProviderModel('model') : '';
const modelProviderFromVault = secretVaultStatus.ready ? await openVaultProviderIdentity('model') : '';
const searchApiKeyFromVault = secretVaultStatus.ready ? await openVaultProviderKey('search') : '';
const searchEndpointFromVault = secretVaultStatus.ready ? await openVaultProviderEndpoint('search') : '';
const llmProvider = createModelProviderFromEnv(process.env, {
  provider: modelProviderFromVault || undefined,
  secretVaultStatus,
  apiKey: modelApiKeyFromVault,
  apiKeySource: modelApiKeyFromVault ? 'local-secret-vault' : undefined,
  baseURL: modelBaseUrlFromVault || undefined,
  model: modelNameFromVault || undefined,
});
const searchProvider = createSearchProviderFromEnv(process.env, {
  secretVaultStatus,
  apiKey: searchApiKeyFromVault,
  apiKeySource: searchApiKeyFromVault ? 'local-secret-vault' : undefined,
  endpoint: searchEndpointFromVault,
  endpointSource: searchEndpointFromVault ? 'local-secret-vault' : undefined,
});
const projectRuntime = createLocalProjectRuntime({
  rootPath: runtimeRoot,
  enableCommandExecution: envFlag('AGENT_WORKSPACE_EXEC'),
  allowedCommands: (process.env.AGENT_WORKSPACE_ALLOWED_COMMANDS || 'node,npm,git')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
});

const httpServer = createAgentProjectHttpServer({
  filePath,
  securityAuditLogPath,
  projectRuntime,
  autonomousScheduler: {
    enabled: autonomousSchedulerEnabled,
    intervalMs: autonomousSchedulerIntervalMs,
    runImmediately: autonomousSchedulerEnabled,
    resumeAutopilotSessions: autonomousSchedulerEnabled,
    includeReadModels: false,
    useAgentAutonomousStrategy: autonomousAgentStrategyEnabled,
    submitAgentWorkArtifacts: autonomousAgentSubmissionsEnabled,
    agentWorkArtifactType: process.env.AGENT_AUTONOMOUS_ARTIFACT_TYPE || (autonomousAgentSubmissionsEnabled ? 'auto' : undefined),
    maxAgentProjects: optionalNumberEnv('AGENT_AUTONOMOUS_MAX_AGENT_PROJECTS'),
    maxAgentsPerProject: optionalNumberEnv('AGENT_AUTONOMOUS_MAX_AGENTS_PER_PROJECT'),
    reviewPendingSubmissions: autonomousAgentReviewsEnabled,
    agentReviewVerdict: process.env.AGENT_AUTONOMOUS_REVIEW_VERDICT || (autonomousAgentReviewsEnabled ? 'auto' : undefined),
    respondToReviewObligations: autonomousAgentReviewResponsesEnabled,
    reviewResponseArtifactType: process.env.AGENT_AUTONOMOUS_REVIEW_RESPONSE_TYPE || (autonomousAgentReviewResponsesEnabled ? 'revision-note' : undefined),
  },
  llmProvider,
  searchProvider,
  secretVault,
  accessControl: {
    defaultMode: accessControlMode,
    signingSecret: accessSigningSecret,
    requireSignedRequestIds: accessReplayProtection,
    failClosedOnAuditError: accessAuditFailClosed,
    requireProjectMembership: projectMembershipRequired,
  },
  localAuthFilePath,
  localAuthRequired,
  telemetry: localTelemetry,
});
const runtime = await httpServer.listen({ port, host });

console.log(`Agent project backend listening on ${runtime.url}`);
console.log(`Store: ${httpServer.api.store.filePath}`);
console.log(`Security audit log: ${httpServer.api.store.securityAuditLogPath || 'disabled'}`);
console.log(`Project runtime: ${runtimeRoot}`);
console.log(`Local runtime telemetry: ${localTelemetryPath}`);
console.log(`Autonomous scheduler: ${autonomousSchedulerEnabled ? `enabled every ${autonomousSchedulerIntervalMs}ms` : 'disabled'}`);
console.log(`Autonomous Agent controls: strategy=${autonomousAgentStrategyEnabled ? 'on' : 'off'}, submissions=${autonomousAgentSubmissionsEnabled ? 'on' : 'off'}, reviews=${autonomousAgentReviewsEnabled ? 'on' : 'off'}, review responses=${autonomousAgentReviewResponsesEnabled ? 'on' : 'off'}`);
console.log(`Access control: ${accessControlMode}`);
console.log(`Access signing: ${accessSigningSecret ? 'enabled' : 'disabled'}`);
console.log(`Access replay protection: ${accessReplayProtection ? 'enabled' : 'disabled'}`);
console.log(`Access audit fail-closed: ${accessAuditFailClosed ? 'enabled' : 'disabled'}`);
console.log(`Local user authentication: ${localAuthRequired ? `required (${httpServer.api.localAuth?.filePath || 'memory'})` : 'optional; set AGENT_LOCAL_AUTH_REQUIRED=true to require it'}`);
console.log(`Project membership enforcement: ${projectMembershipRequired ? 'enabled' : 'optional; set AGENT_PROJECT_MEMBERSHIP_REQUIRED=true to require per-project grants'}`);
console.log(`Secret vault: ${secretVaultStatus.ready ? `ready (${secretVaultStatus.provider}/${secretVaultStatus.encryptedRecordCount} record(s))` : 'disabled or not configured'}`);
console.log(`Model provider: ${llmProvider.enabled ? `enabled (${llmProvider.provider}/${llmProvider.model})` : `disabled (${llmProvider.status().configured ? 'configured but not enabled or blocked' : 'missing key or disabled'})`}`);
console.log(`Search provider: ${searchProvider.enabled ? `enabled (${searchProvider.provider})` : `disabled (${searchProvider.status().configured ? 'configured but not enabled' : 'missing endpoint/key or disabled'})`}`);

let shutdownPromise = null;
const shutdown = () => {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = httpServer.close().then((result) => {
    process.exit(result.complete ? 0 : 1);
  }).catch(() => process.exit(1));
  return shutdownPromise;
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
