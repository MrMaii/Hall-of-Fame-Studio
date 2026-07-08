import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-managed-persistence-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-managed-persistence-attestation-secret';
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
  'MANAGED_PERSISTENCE_ADAPTER_DRIVER',
  'MANAGED_PERSISTENCE_DATABASE_URL',
  'MANAGED_PERSISTENCE_HTTP_ENDPOINT',
  'MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER',
  'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID',
  'MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM',
  'MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE',
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
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json';
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

function setManagedSecretsEnv() {
  process.env.MANAGED_SECRET_MANAGER_ENDPOINT = 'https://managed-secret.example.test/api';
  process.env.MANAGED_KMS_KEY_ID = 'managed-kms-key-env';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_ID = 'managed-secret-attestation';
  process.env.MANAGED_SECRET_MANAGER_ATTESTATION_CHECKSUM = 'managed-secret-checksum';
}

function setManagedPersistenceEnv() {
  process.env.MANAGED_PERSISTENCE_ADAPTER_DRIVER = 'postgres';
  process.env.MANAGED_PERSISTENCE_DATABASE_URL = 'postgres://user:db-password-should-not-leak@managed-db.example.test/hofs?secret=db-token-should-not-leak';
  process.env.MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER = 'true';
}

function setManagedPersistenceCutoverEvidence({ signature = 'sig_invalid_persistence' } = {}) {
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_ID = 'managed-persistence-cutover-receipt';
  process.env.MANAGED_PERSISTENCE_CUTOVER_RECEIPT_CHECKSUM = 'managed-persistence-cutover-checksum-should-not-leak';
  process.env.MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE = signature;
}

function managedVault() {
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
        secretCount: 1,
        encryptedRecordCount: 1,
        rawSecretRecordCount: 0,
        rawSecretExposure: false,
        rotationSupported: true,
        latestRotation: {
          schemaVersion: 'secret-vault-rotation-receipt/v1',
          rotatedAt: '2026-07-07T00:00:00.000Z',
          nextKeyId: 'managed-kms-key',
          recordCount: 1,
          rotatedRecordCount: 1,
          failedRecordCount: 0,
          plaintextExposed: false,
          checksum: 'managed-rotation-checksum',
        },
        accessAuditSupported: true,
        productionReady: false,
      };
    },
  };
}

function readiness() {
  return createAgentProjectService({ secretVault: managedVault() }).getPublicProductionStartupReadiness();
}

function actionById(snapshot, id) {
  return snapshot.publicProductionActionPlan?.actions?.find((action) => action.id === id) || null;
}

function setupRowById(snapshot, id) {
  return snapshot.productionEnvironmentSetup?.rows?.find((row) => row.id === id) || null;
}

function cutoverRow(snapshot) {
  return snapshot.managedInfrastructureCutover?.rows?.find((row) => row.id === 'managed-persistence') || null;
}

function assertManagedPersistencePolicyRoute(options = {}) {
  const api = createAgentProjectApi({ service: createAgentProjectService(options) });
  const response = api.handle({
    method: 'GET',
    path: '/managed-persistence-policy',
  });
  const policy = response.body.managedPersistencePolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Managed persistence policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'managed-persistence-policy/v1', 'Managed persistence policy route must expose managed-persistence-policy/v1.');
  assert(policy.apiPath === '/managed-persistence-policy', 'Managed persistence policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Managed persistence policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-managed-persistence', 'Managed persistence policy must expose its focused validation command.');
  assert(policy.adapterContract?.requiredEnvVars?.includes('MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER'), 'Managed persistence policy must document real-adapter requirement env names.');
  assert(policy.adapterContract?.allowedAdapterClasses?.includes('postgres'), 'Managed persistence policy must document supported managed adapter classes.');
  assert(policy.endpointContract?.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_PERSISTENCE_DATABASE_URL')), 'Managed persistence policy must document database URL env names.');
  assert(policy.endpointContract?.anyOfEnvVarGroups?.some((group) => group.includes('MANAGED_PERSISTENCE_HTTP_ENDPOINT')), 'Managed persistence policy must document managed persistence HTTP endpoint env names.');
  assert(policy.endpointContract?.anyOfEnvVarGroups?.some((group) => group.includes('ADAPTER_GATEWAY_HTTP_ENDPOINT')), 'Managed persistence policy must document adapter gateway env names.');
  assert(policy.cutoverEvidenceContract?.requiredEnvVars?.includes('MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE'), 'Managed persistence policy must document signed cutover evidence env names.');
  assert(policy.cutoverEvidenceContract?.attestationPayload?.controlId === 'managed-persistence-cutover', 'Managed persistence policy must document the cutover attestation control id.');
  assert(policy.cutoverEvidenceContract?.attestationPayload?.domain === 'operations', 'Managed persistence policy must document the cutover attestation domain.');
  assert(policy.relatedRoutes?.managedSecretManagerPolicy === '/managed-secret-manager-policy', 'Managed persistence policy must link the managed Secret Manager/KMS policy route.');
  assert(policy.relatedRoutes?.persistenceAdapterDryRun === '/projects/:projectId/persistence-adapter-dry-run', 'Managed persistence policy must link the adapter dry-run route.');
  assert(!serialized.includes('db-password-should-not-leak'), 'Managed persistence policy must not expose database password values.');
  assert(!serialized.includes('db-token-should-not-leak'), 'Managed persistence policy must not expose database query secret values.');
  assert(!serialized.includes('managed-persistence-cutover-checksum-should-not-leak'), 'Managed persistence policy must not expose cutover checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Managed persistence policy must not leak access signing secrets.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Managed persistence policy must not leak attestation signing secrets.');
}

try {
  clearEnv();
  setStrictAccessEnv();
  setSignedManagedIdentityEnv();
  setManagedSecretsEnv();

  let snapshot = readiness();
  let row = setupRowById(snapshot, 'managed-persistence');
  let cutover = cutoverRow(snapshot);
  let action = actionById(snapshot, 'setup-managed-persistence');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-managed-persistence', 'After access, identity, and secrets are ready, next action must be setup-managed-persistence.');
  assert(row?.status === 'blocked', 'Managed persistence setup row must block when database config is missing.');
  assert(cutover?.configurationReady === false, 'Managed persistence cutover row must require database or gateway configuration.');
  assert(cutover?.requireRealAdapter === false, 'Managed persistence cutover row must require real-adapter mode.');
  assert(cutover?.cutoverReady === false, 'Managed persistence cutover row must require managed-production cutover proof.');
  assert(action?.requiredEnvVars?.includes('MANAGED_PERSISTENCE_DATABASE_URL'), 'Managed persistence action must list database/gateway env names.');
  assert(action?.requiredEnvVars?.includes('MANAGED_PERSISTENCE_REQUIRE_REAL_ADAPTER'), 'Managed persistence action must list real-adapter requirement env.');
  assert(action?.requiredEnvVars?.includes('MANAGED_PERSISTENCE_CUTOVER_ATTESTATION_SIGNATURE'), 'Managed persistence action must list signed cutover evidence env.');

  setManagedPersistenceEnv();
  snapshot = readiness();
  row = setupRowById(snapshot, 'managed-persistence');
  cutover = cutoverRow(snapshot);
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(row?.status === 'blocked', 'Managed persistence must stay blocked with env-only database config.');
  assert(cutover?.configurationReady === true, 'Managed persistence must recognize configured database env.');
  assert(cutover?.requireRealAdapter === true, 'Managed persistence must recognize require-real-adapter env.');
  assert(cutover?.cutoverReady === false, 'Managed persistence must reject database config without cutover evidence.');
  assert(!envOnlySerialized.includes('db-password-should-not-leak'), 'Managed persistence readiness must not expose database password values.');
  assert(!envOnlySerialized.includes('db-token-should-not-leak'), 'Managed persistence readiness must not expose database query secret values.');
  assertManagedPersistencePolicyRoute({ secretVault: managedVault() });

  setManagedPersistenceCutoverEvidence();
  snapshot = readiness();
  cutover = cutoverRow(snapshot);
  assert(cutover?.cutoverEvidenceReceiptConfigured === true, 'Managed persistence must recognize cutover receipt id/checksum presence.');
  assert(cutover?.cutoverEvidenceSignatureReady === false, 'Managed persistence must reject invalid cutover attestation signatures.');
  assert(cutover?.cutoverReady === false, 'Managed persistence must remain blocked when cutover signature is invalid.');
  assert(!JSON.stringify(snapshot).includes('managed-persistence-cutover-checksum-should-not-leak'), 'Managed persistence readiness must not expose cutover checksum values.');

  setManagedPersistenceCutoverEvidence({
    signature: startupAttestationSignature({
      domain: 'operations',
      controlId: 'managed-persistence-cutover',
      evidenceId: 'managed-persistence-cutover-receipt',
      evidenceChecksum: 'managed-persistence-cutover-checksum-should-not-leak',
    }),
  });
  snapshot = readiness();
  row = setupRowById(snapshot, 'managed-persistence');
  cutover = cutoverRow(snapshot);
  action = actionById(snapshot, 'setup-managed-persistence');

  assert(cutover?.cutoverEvidenceReady === true, 'Managed persistence must accept matching signed managed-production cutover evidence.');
  assert(cutover?.cutoverEvidenceSignatureReady === true, 'Managed persistence cutover signature must be ready after matching evidence.');
  assert(cutover?.cutoverReady === true && cutover?.ready === true, 'Managed persistence cutover row must become ready after real adapter config plus signed cutover evidence.');
  assert(row?.status === 'ready', 'Production setup matrix must mark managed persistence ready after signed cutover proof.');
  assert(snapshot.gates?.some((gate) => gate.id === 'managed-persistence-real-adapter' && gate.passed === true), 'Managed persistence startup gate must pass after signed cutover proof.');
  assert(action === null, 'Public production action plan must remove setup-managed-persistence after signed cutover proof.');
  assert(actionById(snapshot, 'setup-managed-worker-queue'), 'Public production action plan must continue to worker queue setup.');
  assert(snapshot.readyForPublicProduction === false, 'Managed persistence proof alone must not approve public production.');

  console.log('production-managed-persistence-contract: ok');
} finally {
  restoreEnv();
}
