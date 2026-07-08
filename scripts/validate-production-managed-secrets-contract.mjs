import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-managed-secrets-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-managed-secrets-attestation-secret';
const envKeys = [
  'AGENT_ACCESS_CONTROL_MODE',
  'AGENT_ACCESS_SIGNING_SECRET',
  'AGENT_ACCESS_REPLAY_PROTECTION',
  'AGENT_ACCESS_AUDIT_FAIL_CLOSED',
  'PRODUCTION_IDENTITY_PROVIDER',
  'PRODUCTION_IDENTITY_ISSUER',
  'PRODUCTION_IDENTITY_JWKS_URI',
  'PRODUCTION_SERVICE_IDENTITY_AUDIENCE',
  'PRODUCTION_SERVICE_IDENTITY_SUBJECT',
  'PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID',
  'PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM',
  'PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE',
  'MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET',
  'PRODUCTION_SECRET_MANAGER_ENDPOINT',
  'PRODUCTION_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ENDPOINT',
  'MANAGED_KMS_KEY_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_ID',
  'MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM',
  'PRODUCTION_KMS_ATTESTATION_ID',
  'PRODUCTION_KMS_ATTESTATION_CHECKSUM',
];
const savedEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function startupAttestationSignature({
  signingSecret = ATTESTATION_SIGNING_SECRET,
  controlId = 'managed-identity-provider',
  evidenceId = '',
  evidenceChecksum = '',
  domain = 'security',
} = {}) {
  const payload = {
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId: 'public-production-startup',
    domain,
    controlId,
    evidenceId,
    evidenceRoute: null,
    evidenceChecksum,
    evidenceEnvironment: 'managed-production',
    attestationId: evidenceId ? `${evidenceId}:managed-production-attestation` : null,
    attestationRoute: null,
    attestationChecksum: evidenceChecksum,
    attestationProvider: 'public-production-startup',
    attestationKind: 'startup-control-receipt',
  };
  return `sig_hmac_sha256_v1_${createHmac('sha256', signingSecret).update(stableJson(payload)).digest('hex')}`;
}

function restoreEnv() {
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}

function clearEnv() {
  for (const key of envKeys) delete process.env[key];
}

function setStrictAccessEnv() {
  process.env.AGENT_ACCESS_CONTROL_MODE = 'enforced';
  process.env.AGENT_ACCESS_SIGNING_SECRET = ACCESS_SIGNING_SECRET;
  process.env.AGENT_ACCESS_REPLAY_PROTECTION = 'true';
  process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED = 'true';
}

function setSignedManagedIdentityEnv() {
  process.env.PRODUCTION_IDENTITY_PROVIDER = 'oidc';
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer?token=identity-token-should-not-leak';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json?token=jwks-token-should-not-leak';
  process.env.PRODUCTION_SERVICE_IDENTITY_AUDIENCE = 'hofs-public-production';
  process.env.PRODUCTION_SERVICE_IDENTITY_SUBJECT = 'service-account:hofs-agent-runtime';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID = 'managed-identity-receipt';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM = 'managed-identity-checksum';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = ATTESTATION_SIGNING_SECRET;
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    evidenceId: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM,
  });
}

function setManagedSecretConfigEnv() {
  process.env.MANAGED_SECRET_MANAGER_ENDPOINT = 'https://managed-secret.example.test/api?token=secret-manager-token-should-not-leak';
  process.env.MANAGED_KMS_KEY_ID = 'managed-kms-key-env';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_ID = 'managed-secret-attestation';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM = 'managed-secret-checksum-should-not-leak';
}

function managedVault({ rawSecretExposure = false } = {}) {
  return {
    status() {
      return {
        schemaVersion: 'secret-vault-status/v1',
        provider: 'managed-secret-manager',
        enabled: true,
        configured: true,
        ready: true,
        encryptionReady: true,
        keyId: 'managed-kms-key',
        keySource: 'managed-secret-manager',
        secretCount: rawSecretExposure ? 1 : 0,
        encryptedRecordCount: rawSecretExposure ? 0 : 1,
        rawSecretRecordCount: rawSecretExposure ? 1 : 0,
        rawSecretExposure,
        rotationSupported: true,
        latestRotation: {
          schemaVersion: 'secret-vault-rotation-receipt/v1',
          rotatedAt: '2026-07-07T00:00:00.000Z',
          nextKeyId: 'managed-kms-key',
          recordCount: rawSecretExposure ? 1 : 0,
          rotatedRecordCount: rawSecretExposure ? 0 : 1,
          failedRecordCount: rawSecretExposure ? 1 : 0,
          plaintextExposed: rawSecretExposure,
          checksum: 'managed-rotation-checksum',
        },
        accessAuditSupported: true,
        productionReady: false,
        productionRequirement: 'managed Secret Manager/KMS provider with rotation and access audit',
      };
    },
  };
}

function readiness(options = {}) {
  return createAgentProjectService(options).getPublicProductionStartupReadiness();
}

function actionById(snapshot, id) {
  return snapshot.publicProductionActionPlan?.actions?.find((action) => action.id === id) || null;
}

function setupRowById(snapshot, id) {
  return snapshot.productionEnvironmentSetup?.rows?.find((row) => row.id === id) || null;
}

function assertManagedSecretManagerPolicyRoute(options = {}) {
  const api = createAgentProjectApi({ service: createAgentProjectService(options) });
  const response = api.handle({
    method: 'GET',
    path: '/managed-secret-manager-policy',
  });
  const policy = response.body.managedSecretManagerPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Managed Secret Manager/KMS policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'managed-secret-manager-policy/v1', 'Managed Secret Manager/KMS policy route must expose managed-secret-manager-policy/v1.');
  assert(policy.apiPath === '/managed-secret-manager-policy', 'Managed Secret Manager/KMS policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Managed Secret Manager/KMS policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-managed-secrets', 'Managed Secret Manager/KMS policy must expose its focused validation command.');
  assert(policy.managedProviderContract?.requiredCapabilities?.includes('rotation-supported'), 'Managed Secret Manager/KMS policy must document rotation support.');
  assert(policy.managedProviderContract?.requiredCapabilities?.includes('access-audit-supported'), 'Managed Secret Manager/KMS policy must document access audit support.');
  assert(policy.endpointKeyContract?.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ENDPOINT')), 'Managed Secret Manager/KMS policy must document managed endpoint env names.');
  assert(policy.endpointKeyContract?.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_KMS_KEY_ID')), 'Managed Secret Manager/KMS policy must document managed KMS env names.');
  assert(policy.attestationContract?.requiredAttestationPairs?.some((group) => group.includes('MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM')), 'Managed Secret Manager/KMS policy must document attestation checksum pairs.');
  assert(policy.relatedRoutes?.secretVaultStatus === '/secret-vault/status', 'Managed Secret Manager/KMS policy must link Secret Vault status.');
  assert(policy.relatedRoutes?.managedIdentityPolicy === '/managed-identity-policy', 'Managed Secret Manager/KMS policy must link the managed identity policy route.');
  assert(!serialized.includes('secret-manager-token-should-not-leak'), 'Managed Secret Manager/KMS policy must not expose endpoint token values.');
  assert(!serialized.includes('managed-secret-checksum-should-not-leak'), 'Managed Secret Manager/KMS policy must not expose attestation checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Managed Secret Manager/KMS policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Managed Secret Manager/KMS policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setStrictAccessEnv();
  setSignedManagedIdentityEnv();

  let snapshot = readiness();
  let managedSecrets = snapshot.managedSecretManager;
  let secretsAction = actionById(snapshot, 'setup-managed-secrets');
  let secretsRow = setupRowById(snapshot, 'managed-secrets');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-managed-secrets', 'After access and identity are ready, next public-production action must be setup-managed-secrets.');
  assert(managedSecrets?.schemaVersion === 'managed-secret-manager-readiness/v1', 'Public production readiness must expose managed Secret Manager/KMS readiness.');
  assert(managedSecrets.ready === false, 'Managed Secret Manager/KMS must block by default.');
  assert(managedSecrets.providerReady === false, 'Managed Secret Manager/KMS must require a managed provider.');
  assert(managedSecrets.configurationReady === false, 'Managed Secret Manager/KMS must require endpoint/key configuration.');
  assert(managedSecrets.attestationReady === false, 'Managed Secret Manager/KMS must require matched attestation evidence.');
  assert(secretsRow?.status === 'blocked', 'Production setup matrix must keep managed secrets blocked by default.');
  assert(secretsAction?.requiredEnvVars?.includes('MANAGED_SECRET_MANAGER_ENDPOINT'), 'Managed secrets action must list Secret Manager endpoint env names.');
  assert(secretsAction?.requiredEnvVars?.includes('MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM'), 'Managed secrets action must list attestation checksum env names.');

  setManagedSecretConfigEnv();
  snapshot = readiness();
  managedSecrets = snapshot.managedSecretManager;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(managedSecrets.configurationReady === true, 'Managed Secret Manager/KMS must recognize configured endpoint/key env names.');
  assert(managedSecrets.attestationReady === true, 'Managed Secret Manager/KMS must recognize matched attestation id/checksum env names.');
  assert(managedSecrets.providerReady === false, 'Env-only Secret Manager/KMS config must not pass without a managed provider.');
  assert(managedSecrets.ready === false, 'Env-only Secret Manager/KMS config must not approve managed secrets.');
  assert(!envOnlySerialized.includes('secret-manager-token-should-not-leak'), 'Managed Secret Manager readiness must not expose endpoint token values.');
  assert(!envOnlySerialized.includes('managed-secret-checksum-should-not-leak'), 'Managed Secret Manager readiness must not expose attestation checksum values.');
  assert(snapshot.readyForPublicProduction === false, 'Env-only managed secrets must not approve public production.');
  assertManagedSecretManagerPolicyRoute();

  snapshot = readiness({ secretVault: managedVault({ rawSecretExposure: true }) });
  managedSecrets = snapshot.managedSecretManager;
  assert(managedSecrets.providerReady === true, 'Managed vault provider should be recognized when it supports rotation and access audit.');
  assert(managedSecrets.rawExposureBlocked === true, 'Managed Secret Manager/KMS must block raw secret exposure.');
  assert(managedSecrets.ready === false, 'Managed Secret Manager/KMS must not pass when raw secret exposure is reported.');
  assertManagedSecretManagerPolicyRoute({ secretVault: managedVault({ rawSecretExposure: true }) });

  snapshot = readiness({ secretVault: managedVault() });
  managedSecrets = snapshot.managedSecretManager;
  secretsAction = actionById(snapshot, 'setup-managed-secrets');
  secretsRow = setupRowById(snapshot, 'managed-secrets');

  assert(managedSecrets.providerReady === true, 'Managed Secret Manager/KMS must accept a managed provider with rotation and access audit.');
  assert(managedSecrets.configurationReady === true, 'Managed Secret Manager/KMS must keep endpoint/key configuration ready.');
  assert(managedSecrets.attestationReady === true, 'Managed Secret Manager/KMS must keep matched attestation evidence ready.');
  assert(managedSecrets.rawExposureBlocked === false, 'Managed Secret Manager/KMS must pass only when raw secret exposure is absent.');
  assert(managedSecrets.ready === true, 'Managed Secret Manager/KMS must become ready after managed provider, configuration, and attestation are present.');
  assert(snapshot.gates?.some((gate) => gate.id === 'managed-secret-manager-or-kms' && gate.passed === true), 'Managed Secret Manager/KMS startup gate must pass after managed provider proof.');
  assert(secretsRow?.status === 'ready', 'Production setup matrix must mark managed secrets ready after managed provider proof.');
  assert(secretsAction === null, 'Public production action plan must remove setup-managed-secrets after managed provider proof.');
  assert(actionById(snapshot, 'setup-managed-persistence'), 'Public production action plan must continue to later managed infrastructure blockers.');
  assert(snapshot.readyForPublicProduction === false, 'Managed Secret Manager/KMS proof alone must not approve public production.');

  console.log('production-managed-secrets-contract: ok');
} finally {
  restoreEnv();
}
