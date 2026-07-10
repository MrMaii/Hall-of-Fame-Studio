import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCTION_CAPABILITY_DEFINITIONS,
  buildProductionCapabilityRegistry,
} from '../src/agents/productionCapabilityRegistry.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const now = '2026-07-09T20:00:00.000Z';

const managedAttestation = {
  schemaVersion: 'managed-production-environment-attestation/v1',
  id: 'attestation_managed_production_001',
  environment: 'managed-production',
  checksum: 'chk_environment_001',
  signature: 'sig_hmac_sha256_v1_test',
  signatureVerified: true,
  issuedAt: '2026-07-09T19:00:00.000Z',
  expiresAt: '2026-07-10T19:00:00.000Z',
};

function evidenceForAllCapabilities() {
  return PRODUCTION_CAPABILITY_DEFINITIONS.map((capability) => ({
    capabilityId: capability.id,
    status: 'verified',
    receiptId: `receipt_${capability.id}`,
    receiptChecksum: `chk_${capability.id}`,
    environmentAttestationId: managedAttestation.id,
    verifiedAt: now,
    expiresAt: '2026-07-10T19:00:00.000Z',
  }));
}

test('registers exactly fifty production capabilities across the five work modes', () => {
  assert.equal(PRODUCTION_CAPABILITY_DEFINITIONS.length, 50);
  assert.deepEqual(
    PRODUCTION_CAPABILITY_DEFINITIONS.filter((capability) => capability.workMode).map((capability) => capability.workMode),
    ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'],
  );
});

test('keeps every capability blocked when no managed environment attestation exists', () => {
  const registry = buildProductionCapabilityRegistry({ now });

  assert.equal(registry.schemaVersion, 'production-capability-registry/v1');
  assert.equal(registry.readyForProduction, false);
  assert.equal(registry.summary.verifiedCapabilityCount, 0);
  assert.equal(registry.blockers.includes('environment-attestation-missing'), true);
  assert.equal(registry.capabilities.every((capability) => capability.evidenceStatus === 'missing'), true);
});

test('does not trust unsigned or local environment claims', () => {
  const registry = buildProductionCapabilityRegistry({
    now,
    environmentAttestation: {
      ...managedAttestation,
      environment: 'local-rehearsal',
      signatureVerified: false,
    },
    capabilityEvidence: evidenceForAllCapabilities(),
  });

  assert.equal(registry.readyForProduction, false);
  assert.equal(registry.environmentAttestation.status, 'untrusted');
  assert.equal(registry.capabilities[0].evidenceStatus, 'external-unattested');
  assert.equal(registry.blockers.includes('environment-attestation-untrusted'), true);
});

test('requires attested, fresh, receipt-backed evidence before a capability is verified', () => {
  const registry = buildProductionCapabilityRegistry({
    now,
    environmentAttestation: managedAttestation,
    capabilityEvidence: evidenceForAllCapabilities(),
  });

  assert.equal(registry.environmentAttestation.status, 'verified');
  assert.equal(registry.summary.verifiedCapabilityCount, 50);
  assert.equal(registry.capabilities.find((capability) => capability.id === 'durable-queue').evidenceStatus, 'verified');
  assert.equal(registry.readyForProduction, true);
});

test('rejects stale receipts even when their environment attestation remains valid', () => {
  const registry = buildProductionCapabilityRegistry({
    now,
    environmentAttestation: managedAttestation,
    capabilityEvidence: evidenceForAllCapabilities().map((evidence) => (
      evidence.capabilityId === 'durable-queue'
        ? { ...evidence, expiresAt: '2026-07-09T19:59:59.000Z' }
        : evidence
    )),
  });

  const queue = registry.capabilities.find((capability) => capability.id === 'durable-queue');
  assert.equal(queue.evidenceStatus, 'stale');
  assert.equal(registry.readyForProduction, false);
  assert.equal(registry.blockers.includes('capability-evidence-incomplete'), true);
});

test('exposes a redacted, fail-closed registry through both API dispatch paths', async () => {
  const api = createAgentProjectApi({ service: createAgentProjectService() });
  const syncResponse = api.handle({ method: 'GET', path: '/production-capabilities' });
  const asyncResponse = await api.handleAsync({ method: 'GET', path: '/production-capabilities' });

  for (const response of [syncResponse, asyncResponse]) {
    assert.equal(response.status, 200);
    assert.equal(response.body.productionCapabilityRegistry.schemaVersion, 'production-capability-registry/v1');
    assert.equal(response.body.productionCapabilityRegistry.readyForProduction, false);
    assert.equal(response.body.productionCapabilityRegistry.summary.requiredCapabilityCount, 50);
    assert.equal(JSON.stringify(response.body).includes('signature'), false);
  }
});
