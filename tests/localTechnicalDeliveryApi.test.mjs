import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'local-delivery-manager' };

test('persists a gated technical delivery chain and fails closed after tampering', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-technical-delivery-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', '/projects/initiate', {
      projectId: 'technical_delivery_api_project', name: 'Technical Delivery', brief: 'Ship a guarded local change.',
      workMode: 'technical-delivery', includeReadModels: false,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.technicalDeliveryWorkflowRoute, '/projects/technical_delivery_api_project/technical-delivery-workflow');
    const project = response.body.project;
    const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
    const authorId = role('delivery-lead');
    const implementerId = role('systems-engineer');
    const reviewerId = role('quality-security-reviewer');
    const productOwnerId = role('product-owner');

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/plans`, {
      requirements: [
        { id: 'req-auth', statement: 'Guard local writes.', acceptanceCriteria: ['Unauthenticated write is rejected.'] },
        { id: 'req-restart', statement: 'Persist accepted writes.', acceptanceCriteria: ['Restart reads the accepted record.'] },
      ],
      changeSummary: 'Add a guarded file-backed local write.', affectedPaths: ['src/agents/write.js', 'tests/write.test.mjs'], riskLevel: 'high',
      rollbackPlan: { trigger: 'Write-path regression.', steps: ['Stop runtime.', 'Restore previous revision.'], verificationSteps: ['Run auth and restart suites.'] },
      authorId, implementerId, idempotencyKey: 'api-plan', now: '2026-07-11T13:00:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const plan = response.body.technicalDeliveryPlan;

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/verifications`, {
      planId: plan.id, implementationRevision: 'sha256:api-revision-001',
      requirementEvidence: [
        { requirementId: 'req-auth', evidenceIds: ['full-suite-proof'] },
        { requirementId: 'req-restart', evidenceIds: ['full-suite-proof'] },
      ],
      testEvidence: [{ id: 'full-suite', status: 'failed', evidenceId: 'failed-suite-proof' }],
      securityEvidence: [{ id: 'security-scan', status: 'passed', evidenceId: 'scan-proof' }],
      rollbackRehearsal: { status: 'passed', evidenceIds: ['rollback-proof'] },
      actorId: implementerId, idempotencyKey: 'failed-verification', now: '2026-07-11T13:05:00.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /tests-not-passed/);

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/verifications`, {
      planId: plan.id, implementationRevision: 'sha256:api-revision-001',
      requirementEvidence: [
        { requirementId: 'req-auth', evidenceIds: ['full-suite-proof'] },
        { requirementId: 'req-restart', evidenceIds: ['full-suite-proof'] },
      ],
      testEvidence: [{ id: 'full-suite', status: 'passed', evidenceId: 'full-suite-proof' }],
      securityEvidence: [{ id: 'security-scan', status: 'passed', evidenceId: 'scan-proof' }],
      rollbackRehearsal: { status: 'passed', evidenceIds: ['rollback-proof'] },
      actorId: implementerId, idempotencyKey: 'api-verification', now: '2026-07-11T13:06:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const verification = response.body.technicalDeliveryVerification;

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/reviews`, {
      planId: plan.id, verificationId: verification.id, reviewedRevision: verification.implementationRevision,
      reviewerId: implementerId, verdict: 'approved', blockingFindingIds: [], idempotencyKey: 'self-review', now: '2026-07-11T13:07:00.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /reviewer-independence-required/);
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/reviews`, {
      planId: plan.id, verificationId: verification.id, reviewedRevision: verification.implementationRevision,
      reviewerId, verdict: 'approved', blockingFindingIds: [], idempotencyKey: 'api-review', now: '2026-07-11T13:08:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const review = response.body.technicalDeliveryReview;

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/releases`, {
      planId: plan.id, verificationId: verification.id, reviewId: review.id,
      targetType: 'local-package', targetId: 'hall-of-fame-studio', releaseVersion: '0.47.0', actorId: productOwnerId,
      idempotencyKey: 'release-before-security', now: '2026-07-11T13:08:10.000Z',
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /engineering-security-attestation-required/);
    response = await call('POST', `/projects/${project.id}/engineering-security/scans`, {
      implementationRevision: verification.implementationRevision,
      checks: [
        { type: 'dependency', toolId: 'dependency-audit', toolVersion: '1.0.0', configHash: 'a'.repeat(64), evidenceId: 'dependency-proof', status: 'passed', completedAt: '2026-07-11T13:08:20.000Z' },
        { type: 'secret', toolId: 'secret-scan', toolVersion: '1.0.0', configHash: 'b'.repeat(64), evidenceId: 'secret-proof', status: 'passed', completedAt: '2026-07-11T13:08:30.000Z' },
        { type: 'permission', toolId: 'permission-audit', toolVersion: '1.0.0', configHash: 'c'.repeat(64), evidenceId: 'permission-proof', status: 'passed', completedAt: '2026-07-11T13:08:40.000Z' },
        { type: 'static-analysis', toolId: 'local-sast', toolVersion: '1.0.0', configHash: 'd'.repeat(64), evidenceId: 'sast-proof', status: 'passed', completedAt: '2026-07-11T13:08:50.000Z' },
      ],
      findings: [], actorId: implementerId, idempotencyKey: 'api-security-scan', now: '2026-07-11T13:09:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    response = await call('POST', `/projects/${project.id}/engineering-security/attestations`, {
      actorId: reviewerId, idempotencyKey: 'api-security-attestation', now: '2026-07-11T13:09:10.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/releases`, {
      planId: plan.id, verificationId: verification.id, reviewId: review.id,
      targetType: 'local-package', targetId: 'hall-of-fame-studio', releaseVersion: '0.47.0', actorId: productOwnerId,
      idempotencyKey: 'api-release', now: '2026-07-11T13:10:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const release = response.body.technicalDeliveryRelease;
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/releases`, {
      planId: plan.id, verificationId: verification.id, reviewId: review.id,
      targetType: 'local-package', targetId: 'hall-of-fame-studio', releaseVersion: '0.47.0', actorId: productOwnerId,
      idempotencyKey: 'api-release', now: '2026-07-11T13:10:00.000Z',
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.technicalDeliveryRelease.id, release.id);
    assert.equal(response.body.idempotent, true);

    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/technical-delivery-workflow`, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.technicalDeliveryWorkflow.integrity.valid, true);
    assert.equal(response.body.technicalDeliveryWorkflow.readyForLocalRelease, true);
    assert.equal(response.body.technicalDeliveryWorkflow.summary.releaseCount, 1);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(project.id);
    tampered.localTechnicalDeliveryReviews[0].verdict = 'changes-requested';
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/technical-delivery-workflow`, headers });
    assert.equal(response.body.technicalDeliveryWorkflow.integrity.valid, false);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/technical-delivery-workflow/releases`, headers,
      body: { planId: plan.id, verificationId: verification.id, reviewId: review.id, targetType: 'local-package', targetId: 'hall-of-fame-studio', releaseVersion: '0.47.1', actorId: productOwnerId, idempotencyKey: 'blocked-after-tamper', now: '2026-07-11T13:20:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /technical-delivery-current-state-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps technical delivery private and technical-mode-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/technical-delivery-workflow' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/technical-delivery-workflow/releases' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalTechnicalDeliveryPlan({ projectId: 'learning' }), /technical-delivery-work-mode-required/);
});
