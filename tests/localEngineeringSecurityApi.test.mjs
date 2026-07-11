import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { classifyAccessRequest } from '../src/agents/accessControl.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import { createAgentProjectService, hydrateAgentProject } from '../src/agents/agentProjectService.js';

const headers = { 'x-hofs-role': 'manager', 'x-hofs-user-id': 'engineering-security-manager' };
const configHash = (char) => char.repeat(64);

test('makes exact-revision engineering security attestation mandatory for local technical release', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-engineering-security-'));
  const filePath = join(directory, 'projects.json');
  try {
    const store = createAgentProjectFileStore({ filePath, replaceWithSeed: true, hydrateProject: hydrateAgentProject });
    let api = createAgentProjectApi({ service: createAgentProjectService({ store }) });
    const call = (method, path, body = {}) => api.handleAsync({ method, path, headers, body });
    let response = await call('POST', '/projects/initiate', {
      projectId: 'engineering_security_api_project', name: 'Engineering Security', brief: 'Ship an exact-revision locally secured change.',
      workMode: 'technical-delivery', includeReadModels: false,
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.readModels.engineeringSecurityRoute, '/projects/engineering_security_api_project/engineering-security');
    const project = response.body.project;
    const role = (id) => project.workModeContract.roles.find((row) => row.id === id)?.personaSlug;
    const authorId = role('delivery-lead');
    const implementerId = role('systems-engineer');
    const reviewerId = role('quality-security-reviewer');
    const productOwnerId = role('product-owner');

    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/plans`, {
      requirements: [{ id: 'req-secure', statement: 'Release only after security evidence.', acceptanceCriteria: ['Exact revision has a current security attestation.'] }],
      changeSummary: 'Add a mandatory local security release fence.', affectedPaths: ['src/agents/localEngineeringSecurity.js'], riskLevel: 'high',
      rollbackPlan: { trigger: 'Release fence regression.', steps: ['Stop runtime.', 'Restore previous revision.'], verificationSteps: ['Run engineering security P0.'] },
      authorId, implementerId, idempotencyKey: 'security-api-plan', now: '2026-07-11T15:00:00.000Z',
    });
    const plan = response.body.technicalDeliveryPlan;
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/verifications`, {
      planId: plan.id, implementationRevision: 'sha256:security-api-revision-001',
      requirementEvidence: [{ requirementId: 'req-secure', evidenceIds: ['technical-suite-proof'] }],
      testEvidence: [{ id: 'technical-suite', status: 'passed', evidenceId: 'technical-suite-proof' }],
      securityEvidence: [{ id: 'security-workflow-test', status: 'passed', evidenceId: 'security-workflow-proof' }],
      rollbackRehearsal: { status: 'passed', evidenceIds: ['technical-rollback-proof'] },
      actorId: implementerId, idempotencyKey: 'security-api-verification', now: '2026-07-11T15:01:00.000Z',
    });
    const verification = response.body.technicalDeliveryVerification;
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/reviews`, {
      planId: plan.id, verificationId: verification.id, reviewedRevision: verification.implementationRevision,
      reviewerId, verdict: 'approved', blockingFindingIds: [], idempotencyKey: 'security-api-review', now: '2026-07-11T15:02:00.000Z',
    });
    const review = response.body.technicalDeliveryReview;
    const releaseBody = {
      planId: plan.id, verificationId: verification.id, reviewId: review.id,
      targetType: 'local-package', targetId: 'hall-of-fame-studio', releaseVersion: '0.48.0', actorId: productOwnerId,
      idempotencyKey: 'security-api-release', now: '2026-07-11T15:10:00.000Z',
    };
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/releases`, releaseBody);
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /engineering-security-attestation-required/);

    response = await call('POST', `/projects/${project.id}/engineering-security/scans`, {
      implementationRevision: verification.implementationRevision,
      checks: [
        { type: 'dependency', toolId: 'dependency-audit', toolVersion: '1.0.0', configHash: configHash('a'), evidenceId: 'dependency-scan-proof', status: 'findings', completedAt: '2026-07-11T15:02:10.000Z' },
        { type: 'secret', toolId: 'secret-scan', toolVersion: '1.0.0', configHash: configHash('b'), evidenceId: 'secret-scan-proof', status: 'passed', completedAt: '2026-07-11T15:02:20.000Z' },
        { type: 'permission', toolId: 'permission-audit', toolVersion: '1.0.0', configHash: configHash('c'), evidenceId: 'permission-scan-proof', status: 'findings', completedAt: '2026-07-11T15:02:30.000Z' },
        { type: 'static-analysis', toolId: 'local-sast', toolVersion: '1.0.0', configHash: configHash('d'), evidenceId: 'sast-proof', status: 'passed', completedAt: '2026-07-11T15:02:40.000Z' },
      ],
      findings: [
        { checkType: 'dependency', ruleId: 'CVE-LOCAL-048', severity: 'high', componentId: 'dependency@1.0.0', location: { path: 'package-lock.json', line: 48, column: 1 } },
        { checkType: 'permission', ruleId: 'broad-write', severity: 'medium', componentId: 'technical-release-route', location: { path: 'src/agents/accessControl.js', line: 48, column: 1 } },
      ],
      actorId: 'caller-cannot-select-actor', idempotencyKey: 'security-api-scan', now: '2026-07-11T15:03:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const scan = response.body.engineeringSecurityScan;
    assert.equal(scan.actorId, implementerId);
    const highFinding = scan.findings.find((row) => row.severity === 'high');
    const mediumFinding = scan.findings.find((row) => row.severity === 'medium');

    response = await call('POST', `/projects/${project.id}/engineering-security/remediations`, {
      scanId: scan.id, findingId: highFinding.id, resolution: 'remediated', evidenceIds: ['dependency-upgrade-proof'],
      actorId: 'caller-cannot-select-actor', idempotencyKey: 'security-api-remediation', now: '2026-07-11T15:04:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.engineeringSecurityRemediation.actorId, implementerId);

    response = await call('POST', `/projects/${project.id}/engineering-security/exception-requests`, {
      scanId: scan.id, findingId: mediumFinding.id, evidenceIds: ['bounded-local-control-proof'],
      rationaleText: 'Bounded local permission remains during the migration window.', expiresAt: '2026-07-20T15:05:00.000Z',
      requesterId: 'caller-cannot-select-requester', idempotencyKey: 'security-api-exception', now: '2026-07-11T15:05:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const exceptionRequest = response.body.engineeringSecurityExceptionRequest;
    assert.equal(exceptionRequest.requesterId, implementerId);
    assert.equal(JSON.stringify(exceptionRequest).includes('Bounded local permission remains'), false);

    response = await call('POST', `/projects/${project.id}/engineering-security/exception-requests/${exceptionRequest.id}/approvals`, {
      approverRole: 'security-reviewer', decision: 'approved', evidenceIds: ['security-approval-proof'],
      approverId: 'caller-cannot-select-approver', idempotencyKey: 'security-api-security-approval', now: '2026-07-11T15:06:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.engineeringSecurityExceptionApproval.approverId, reviewerId);
    response = await call('POST', `/projects/${project.id}/engineering-security/exception-requests/${exceptionRequest.id}/approvals`, {
      approverRole: 'product-owner', decision: 'approved', evidenceIds: ['product-approval-proof'],
      approverId: 'caller-cannot-select-approver', idempotencyKey: 'security-api-product-approval', now: '2026-07-11T15:07:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.engineeringSecurityExceptionApproval.approverId, productOwnerId);

    response = await call('POST', `/projects/${project.id}/engineering-security/attestations`, {
      actorId: 'caller-cannot-select-actor', idempotencyKey: 'security-api-attestation', now: '2026-07-11T15:08:00.000Z',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    const attestation = response.body.engineeringSecurityAttestation;
    assert.equal(attestation.actorId, reviewerId);
    response = await call('POST', `/projects/${project.id}/technical-delivery-workflow/releases`, releaseBody);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    assert.equal(response.body.technicalDeliveryRelease.engineeringSecurityAttestationId, attestation.id);
    assert.equal(response.body.technicalDeliveryRelease.engineeringSecurityAttestationChecksum, attestation.checksum);

    api = createAgentProjectApi({ service: createAgentProjectService({ store: createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject }) }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/engineering-security`, headers, body: { now: '2026-07-11T15:09:00.000Z' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.engineeringSecurity.integrity.valid, true);
    assert.equal(response.body.engineeringSecurity.readyForRelease, true);

    const tamperedStore = createAgentProjectFileStore({ filePath, hydrateProject: hydrateAgentProject });
    const tampered = tamperedStore.getProject(project.id);
    tampered.localEngineeringSecurityExceptionApprovals[0].decision = 'denied';
    tamperedStore.saveProject(tampered);
    api = createAgentProjectApi({ service: createAgentProjectService({ store: tamperedStore }) });
    response = await api.handleAsync({ method: 'GET', path: `/projects/${project.id}/engineering-security`, headers, body: { now: '2026-07-11T15:09:00.000Z' } });
    assert.equal(response.body.engineeringSecurity.integrity.valid, false);
    response = await api.handleAsync({
      method: 'POST', path: `/projects/${project.id}/technical-delivery-workflow/releases`, headers,
      body: { ...releaseBody, releaseVersion: '0.48.1', idempotencyKey: 'blocked-after-security-tamper', now: '2026-07-11T15:11:00.000Z' },
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message || '', /engineering-security-current-state-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps engineering security private and technical-delivery-only', () => {
  assert.deepEqual(classifyAccessRequest({ method: 'GET', path: '/projects/p/engineering-security' }).allowedRoles, ['manager', 'security-admin']);
  assert.deepEqual(classifyAccessRequest({ method: 'POST', path: '/projects/p/engineering-security/scans' }).allowedRoles, ['manager', 'security-admin']);
  const service = createAgentProjectService({ projects: [{ id: 'learning', workModeContract: { workMode: 'learning' } }] });
  assert.throws(() => service.createLocalEngineeringSecurityScan({ projectId: 'learning' }), /engineering-security-technical-delivery-work-mode-required/);
});
