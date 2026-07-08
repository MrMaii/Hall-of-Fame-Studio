import { createHmac } from 'node:crypto';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const ACCESS_SIGNING_SECRET = 'production-managed-identity-access-secret';
const ATTESTATION_SIGNING_SECRET = 'production-managed-identity-attestation-secret';
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
  'PRODUCTION_ATTESTATION_SIGNING_SECRET',
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
} = {}) {
  const payload = {
    schemaVersion: 'managed-production-control-attestation-signature/v1',
    projectId: 'public-production-startup',
    domain: 'security',
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

function clearManagedIdentityEnv() {
  for (const key of envKeys) delete process.env[key];
}

function setStrictAccessEnv() {
  process.env.AGENT_ACCESS_CONTROL_MODE = 'enforced';
  process.env.AGENT_ACCESS_SIGNING_SECRET = ACCESS_SIGNING_SECRET;
  process.env.AGENT_ACCESS_REPLAY_PROTECTION = 'true';
  process.env.AGENT_ACCESS_AUDIT_FAIL_CLOSED = 'true';
}

function setIdentityConfigEnv() {
  process.env.PRODUCTION_IDENTITY_PROVIDER = 'oidc';
  process.env.PRODUCTION_IDENTITY_ISSUER = 'https://identity.example.test/issuer?token=identity-token-should-not-leak';
  process.env.PRODUCTION_IDENTITY_JWKS_URI = 'https://identity.example.test/.well-known/jwks.json?token=jwks-token-should-not-leak';
  process.env.PRODUCTION_SERVICE_IDENTITY_AUDIENCE = 'hofs-public-production';
  process.env.PRODUCTION_SERVICE_IDENTITY_SUBJECT = 'service-account:hofs-agent-runtime';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID = 'managed-identity-receipt';
  process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM = 'managed-identity-checksum-should-not-leak';
  process.env.MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET = ATTESTATION_SIGNING_SECRET;
}

function readiness() {
  return createAgentProjectService().getPublicProductionStartupReadiness();
}

function actionById(snapshot, id) {
  return snapshot.publicProductionActionPlan?.actions?.find((action) => action.id === id) || null;
}

function setupRowById(snapshot, id) {
  return snapshot.productionEnvironmentSetup?.rows?.find((row) => row.id === id) || null;
}

function assertManagedIdentityPolicyRoute() {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const response = api.handle({
    method: 'GET',
    path: '/managed-identity-policy',
  });
  const policy = response.body.managedIdentityPolicy;
  const serialized = JSON.stringify(response.body);

  assert(response.status === 200, 'Managed identity policy route must be readable through the backend API.');
  assert(policy?.schemaVersion === 'managed-identity-policy/v1', 'Managed identity policy route must expose managed-identity-policy/v1.');
  assert(policy.apiPath === '/managed-identity-policy', 'Managed identity policy route must expose its API path.');
  assert(policy.startupReadinessRoute === '/public-production-startup-readiness', 'Managed identity policy must link public production startup readiness.');
  assert(policy.validationCommand === 'npm run agents:production-managed-identity', 'Managed identity policy must expose its focused validation command.');
  assert(policy.providerMetadataContract?.requiredEnvVars?.includes('PRODUCTION_IDENTITY_ISSUER'), 'Managed identity policy must document provider metadata env names.');
  assert(policy.serviceIdentityContract?.requiredEnvVars?.includes('PRODUCTION_SERVICE_IDENTITY_AUDIENCE'), 'Managed identity policy must document service identity env names.');
  assert(policy.managedProductionEvidenceContract?.requiredEnvVars?.includes('PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE'), 'Managed identity policy must document signed evidence env names.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.controlId === 'managed-identity-provider', 'Managed identity policy must document the attestation control id.');
  assert(policy.managedProductionEvidenceContract?.attestationPayload?.domain === 'security', 'Managed identity policy must document the attestation domain.');
  assert(policy.relatedRoutes?.accessControlPolicy === '/access-control-policy', 'Managed identity policy must link the access-control policy route.');
  assert(policy.relatedRoutes?.projectIdentitySessions === '/projects/:projectId/identity-sessions', 'Managed identity policy must link the local identity-session route.');
  assert(!serialized.includes('identity-token-should-not-leak'), 'Managed identity policy route must not expose identity issuer token values.');
  assert(!serialized.includes('jwks-token-should-not-leak'), 'Managed identity policy route must not expose JWKS URI token values.');
  assert(!serialized.includes('managed-identity-checksum-should-not-leak'), 'Managed identity policy route must not expose receipt checksum values.');
  assert(!serialized.includes(ACCESS_SIGNING_SECRET), 'Managed identity policy route must not leak the access signing secret.');
  assert(!serialized.includes(ATTESTATION_SIGNING_SECRET), 'Managed identity policy route must not leak the attestation signing secret.');
}

try {
  clearManagedIdentityEnv();
  setStrictAccessEnv();
  let snapshot = readiness();
  let identity = snapshot.managedIdentityStartup;
  let identityAction = actionById(snapshot, 'setup-managed-identity');
  let identityRow = setupRowById(snapshot, 'managed-identity');

  assert(snapshot.publicProductionActionPlan?.nextAction?.id === 'setup-managed-identity', 'Strict access should move the public-production action plan to setup-managed-identity.');
  assert(identity?.schemaVersion === 'managed-identity-startup-readiness/v1', 'Public production readiness must expose managed-identity startup readiness.');
  assert(identity.ready === false && identity.providerConfigured === false, 'Managed identity must block when provider metadata is missing.');
  assert(identity.serviceIdentityConfigured === false, 'Managed identity must block when service identity audience/subject are missing.');
  assert(identity.evidenceReady === false, 'Managed identity must block when signed managed-production evidence is missing.');
  assert(identity.signedAccessOnly === true, 'Strict signed access alone must be reported as insufficient for production identity.');
  assert(identityRow?.status === 'blocked', 'Production setup matrix must keep managed identity blocked.');
  assert(identityAction?.requiredEnvVars?.includes('PRODUCTION_IDENTITY_PROVIDER'), 'Managed identity action must list provider env names.');
  assert(identityAction?.requiredEnvVars?.includes('PRODUCTION_SERVICE_IDENTITY_AUDIENCE'), 'Managed identity action must list service identity env names.');
  assert(identityAction?.requiredEnvVars?.includes('PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE'), 'Managed identity action must list signed evidence env names.');

  setIdentityConfigEnv();
  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = 'sig_invalid_identity';
  snapshot = readiness();
  identity = snapshot.managedIdentityStartup;
  const envOnlySerialized = JSON.stringify(snapshot);

  assert(identity.providerConfigured === true, 'Managed identity must recognize configured provider metadata.');
  assert(identity.serviceIdentityConfigured === true, 'Managed identity must recognize configured service identity boundaries.');
  assert(identity.receiptConfigured === true, 'Managed identity must recognize receipt id/checksum presence.');
  assert(identity.evidenceReady === false, 'Managed identity must reject env-only or invalid signed evidence.');
  assert(identity.attestationSignatureReady === false, 'Managed identity must keep invalid attestation signatures blocked.');
  assert(identity.attestationFailureReason === 'managed-production-attestation-signature-invalid', 'Managed identity must expose invalid signature as a blocker reason.');
  assert(!envOnlySerialized.includes('identity-token-should-not-leak'), 'Managed identity readiness must not expose identity issuer token values.');
  assert(!envOnlySerialized.includes('jwks-token-should-not-leak'), 'Managed identity readiness must not expose JWKS URI token values.');
  assert(!envOnlySerialized.includes('managed-identity-checksum-should-not-leak'), 'Managed identity readiness must not expose receipt checksum values.');
  assert(snapshot.readyForPublicProduction === false, 'Env-only managed identity setup must not approve public production.');
  assertManagedIdentityPolicyRoute();

  process.env.PRODUCTION_IDENTITY_CONTROL_ATTESTATION_SIGNATURE = startupAttestationSignature({
    evidenceId: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_ID,
    evidenceChecksum: process.env.PRODUCTION_IDENTITY_CONTROL_RECEIPT_CHECKSUM,
  });
  snapshot = readiness();
  identity = snapshot.managedIdentityStartup;
  identityAction = actionById(snapshot, 'setup-managed-identity');
  identityRow = setupRowById(snapshot, 'managed-identity');

  assert(identity.ready === true, 'Managed identity must become ready only after matching managed-production attestation evidence.');
  assert(identity.attestationSignatureReady === true, 'Managed identity must mark the matching attestation signature ready.');
  assert(snapshot.gates?.some((gate) => gate.id === 'managed-identity-provider' && gate.passed === true), 'Managed identity startup gate must pass after signed evidence.');
  assert(identityRow?.status === 'ready', 'Production setup matrix must mark managed identity ready after signed evidence.');
  assert(identityAction === null, 'Public production action plan must remove setup-managed-identity after signed evidence.');
  assert(actionById(snapshot, 'setup-managed-secrets'), 'Public production action plan must continue to later managed production blockers.');
  assert(snapshot.readyForPublicProduction === false, 'Signed managed identity evidence alone must not approve public production.');

  console.log('production-managed-identity-contract: ok');
} finally {
  restoreEnv();
}
