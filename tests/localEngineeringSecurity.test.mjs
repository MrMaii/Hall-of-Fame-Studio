import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLocalEngineeringSecurityLedger,
  createLocalEngineeringSecurityAttestation,
  createLocalEngineeringSecurityExceptionApproval,
  createLocalEngineeringSecurityExceptionRequest,
  createLocalEngineeringSecurityRemediation,
  createLocalEngineeringSecurityScan,
  verifyLocalEngineeringSecurityAttestation,
  verifyLocalEngineeringSecurityScan,
} from '../src/agents/localEngineeringSecurity.js';

const hash = (char) => char.repeat(64);
const scanInput = (overrides = {}) => ({
  projectId: 'engineering_security_project',
  implementationRevision: 'sha256:implementation-revision-048',
  checks: [
    { type: 'dependency', toolId: 'local-dependency-audit', toolVersion: '1.0.0', configHash: hash('a'), evidenceId: 'dependency-proof', status: 'findings', completedAt: '2026-07-11T14:00:00.000Z' },
    { type: 'secret', toolId: 'local-secret-scan', toolVersion: '2.0.0', configHash: hash('b'), evidenceId: 'secret-proof', status: 'passed', completedAt: '2026-07-11T14:00:10.000Z' },
    { type: 'permission', toolId: 'local-permission-audit', toolVersion: '1.2.0', configHash: hash('c'), evidenceId: 'permission-proof', status: 'findings', completedAt: '2026-07-11T14:00:20.000Z' },
    { type: 'static-analysis', toolId: 'local-sast', toolVersion: '3.1.0', configHash: hash('d'), evidenceId: 'sast-proof', status: 'passed', completedAt: '2026-07-11T14:00:30.000Z' },
  ],
  findings: [
    { checkType: 'dependency', ruleId: 'CVE-LOCAL-001', severity: 'high', componentId: 'example-package@1.0.0', location: { path: 'package-lock.json', line: 120, column: 1 } },
    { checkType: 'permission', ruleId: 'overbroad-write', severity: 'medium', componentId: 'project-write-route', location: { path: 'src/agents/accessControl.js', line: 1250, column: 3 } },
  ],
  actorId: 'systems-engineer',
  idempotencyKey: 'security-scan-1',
  now: '2026-07-11T14:01:00.000Z',
  ...overrides,
});

test('records all four exact-revision checks without raw secret material', () => {
  const scan = createLocalEngineeringSecurityScan(scanInput());
  assert.equal(scan.schemaVersion, 'local-engineering-security-scan/v1');
  assert.deepEqual(scan.checks.map((row) => row.type), ['dependency', 'permission', 'secret', 'static-analysis']);
  assert.equal(scan.findings.length, 2);
  assert.match(scan.findings[0].fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(scan.findings[0].id.startsWith('engineering_security_finding_'), true);
  assert.equal(scan.checks.find((row) => row.type === 'dependency').findingCount, 1);
  assert.equal(verifyLocalEngineeringSecurityScan(scan).valid, true);
  const ledger = buildLocalEngineeringSecurityLedger({
    project: { id: scan.projectId, workModeContract: { workMode: 'technical-delivery' }, localEngineeringSecurityScans: [scan] },
    now: '2026-07-11T14:02:00.000Z',
  });
  assert.equal(ledger.integrity.valid, true);
  assert.deepEqual(ledger.blockingFindingIds, [scan.findings.find((row) => row.severity === 'high').id]);
  assert.equal(ledger.readyForAttestation, false);

  assert.throws(() => createLocalEngineeringSecurityScan(scanInput({ checks: scanInput().checks.slice(0, 3) })), /required-check-set-invalid/);
  assert.throws(() => createLocalEngineeringSecurityScan(scanInput({ checks: [...scanInput().checks.slice(0, 3), { ...scanInput().checks[0], completedAt: '2026-07-11T14:00:40.000Z' }] })), /required-check-set-invalid/);
  assert.throws(() => createLocalEngineeringSecurityScan(scanInput({ findings: [{ ...scanInput().findings[0], secretValue: 'must-never-persist' }] })), /raw-secret-material-forbidden/);
  const tampered = structuredClone(scan);
  tampered.findings[0].severity = 'low';
  assert.equal(verifyLocalEngineeringSecurityScan(tampered).valid, false);
});

function governedSecurityChain() {
  const scan = createLocalEngineeringSecurityScan(scanInput());
  const highFinding = scan.findings.find((row) => row.severity === 'high');
  const mediumFinding = scan.findings.find((row) => row.severity === 'medium');
  const remediation = createLocalEngineeringSecurityRemediation({
    scan,
    findingId: highFinding.id,
    resolution: 'remediated',
    evidenceIds: ['dependency-upgrade-proof', 'regression-suite-proof'],
    actorId: scan.actorId,
    securityReviewerId: 'quality-security-reviewer',
    idempotencyKey: 'remediate-high',
    now: '2026-07-11T14:02:00.000Z',
  });
  const exceptionRequest = createLocalEngineeringSecurityExceptionRequest({
    scan,
    findingId: mediumFinding.id,
    requesterId: scan.actorId,
    evidenceIds: ['least-privilege-compensating-control'],
    rationaleText: 'Temporary local-only permission is bounded while the route migration completes.',
    expiresAt: '2026-07-20T14:03:00.000Z',
    idempotencyKey: 'request-medium-exception',
    now: '2026-07-11T14:03:00.000Z',
  });
  const securityApproval = createLocalEngineeringSecurityExceptionApproval({
    request: exceptionRequest,
    approverRole: 'security-reviewer',
    approverId: 'quality-security-reviewer',
    securityReviewerId: 'quality-security-reviewer',
    productOwnerId: 'product-owner',
    decision: 'approved',
    evidenceIds: ['security-review-proof'],
    idempotencyKey: 'approve-security',
    now: '2026-07-11T14:04:00.000Z',
  });
  const productApproval = createLocalEngineeringSecurityExceptionApproval({
    request: exceptionRequest,
    approverRole: 'product-owner',
    approverId: 'product-owner',
    securityReviewerId: 'quality-security-reviewer',
    productOwnerId: 'product-owner',
    decision: 'approved',
    evidenceIds: ['product-risk-acceptance-proof'],
    idempotencyKey: 'approve-product',
    now: '2026-07-11T14:05:00.000Z',
  });
  return { scan, highFinding, mediumFinding, remediation, exceptionRequest, securityApproval, productApproval };
}

test('resolves high risk only through remediation or independent false-positive review', () => {
  const { scan, highFinding, remediation } = governedSecurityChain();
  assert.equal(remediation.schemaVersion, 'local-engineering-security-remediation/v1');
  assert.equal(remediation.findingId, highFinding.id);
  assert.throws(() => createLocalEngineeringSecurityRemediation({
    scan, findingId: highFinding.id, resolution: 'false-positive', evidenceIds: ['same-person-proof'],
    actorId: scan.actorId, securityReviewerId: 'quality-security-reviewer', idempotencyKey: 'bad-false-positive', now: '2026-07-11T14:02:30.000Z',
  }), /false-positive-reviewer-required/);
  const falsePositive = createLocalEngineeringSecurityRemediation({
    scan, findingId: highFinding.id, resolution: 'false-positive', evidenceIds: ['independent-triage-proof'],
    actorId: 'quality-security-reviewer', securityReviewerId: 'quality-security-reviewer', idempotencyKey: 'valid-false-positive', now: '2026-07-11T14:02:30.000Z',
  });
  assert.equal(falsePositive.resolution, 'false-positive');
});

test('allows only low or medium exceptions with separate unexpired security and product approvals', () => {
  const { scan, highFinding, mediumFinding, remediation, exceptionRequest, securityApproval, productApproval } = governedSecurityChain();
  assert.throws(() => createLocalEngineeringSecurityExceptionRequest({
    scan, findingId: highFinding.id, requesterId: scan.actorId, evidenceIds: ['not-enough'], rationaleText: 'Accept high risk.',
    expiresAt: '2026-07-20T14:03:00.000Z', idempotencyKey: 'high-exception', now: '2026-07-11T14:03:00.000Z',
  }), /high-critical-exception-forbidden/);
  assert.equal(exceptionRequest.rationaleText, undefined);
  assert.match(exceptionRequest.rationaleHash, /^[a-f0-9]{64}$/);
  assert.throws(() => createLocalEngineeringSecurityExceptionApproval({
    request: exceptionRequest, approverRole: 'security-reviewer', approverId: exceptionRequest.requesterId,
    securityReviewerId: exceptionRequest.requesterId, productOwnerId: 'product-owner', decision: 'approved', evidenceIds: ['self'],
    idempotencyKey: 'self-approval', now: '2026-07-11T14:04:00.000Z',
  }), /exception-self-approval-forbidden/);
  assert.notEqual(securityApproval.approverId, productApproval.approverId);
  assert.equal(securityApproval.decision, 'approved');
  assert.equal(productApproval.decision, 'approved');
  assert.throws(() => createLocalEngineeringSecurityExceptionRequest({
    scan, findingId: scan.findings.find((row) => row.severity === 'medium').id, requesterId: scan.actorId,
    evidenceIds: ['too-long'], rationaleText: 'Too long.', expiresAt: '2026-08-20T14:03:00.000Z',
    idempotencyKey: 'too-long', now: '2026-07-11T14:03:00.000Z',
  }), /exception-expiry-invalid/);
  const secretScan = createLocalEngineeringSecurityScan(scanInput({
    checks: scanInput().checks.map((row) => ({ ...row, status: row.type === 'secret' ? 'findings' : 'passed' })),
    findings: [{ checkType: 'secret', ruleId: 'embedded-token', severity: 'low', componentId: 'fixture', location: { path: 'src/fixture.js', line: 1, column: 1 } }],
    idempotencyKey: 'secret-finding-scan',
  }));
  assert.throws(() => createLocalEngineeringSecurityExceptionRequest({
    scan: secretScan, findingId: secretScan.findings[0].id, requesterId: secretScan.actorId, evidenceIds: ['compensating-control'],
    rationaleText: 'Attempt to accept a secret finding.', expiresAt: '2026-07-20T14:03:00.000Z',
    idempotencyKey: 'secret-exception', now: '2026-07-11T14:03:00.000Z',
  }), /secret-exception-forbidden/);
  const mediumRemediation = createLocalEngineeringSecurityRemediation({
    scan, findingId: mediumFinding.id, resolution: 'remediated', evidenceIds: ['permission-narrowed-proof'],
    actorId: scan.actorId, securityReviewerId: 'quality-security-reviewer', idempotencyKey: 'remediate-after-exception', now: '2026-07-11T14:06:00.000Z',
  });
  const remediatedAfterException = buildLocalEngineeringSecurityLedger({
    project: {
      id: scan.projectId, workModeContract: { workMode: 'technical-delivery' }, localEngineeringSecurityScans: [scan],
      localEngineeringSecurityRemediations: [mediumRemediation, remediation],
      localEngineeringSecurityExceptionRequests: [exceptionRequest],
      localEngineeringSecurityExceptionApprovals: [{ ...securityApproval, decision: 'denied' }, productApproval],
    },
    now: '2026-07-11T14:07:00.000Z',
  });
  assert.equal(remediatedAfterException.integrity.valid, false, 'tampering an approval must still degrade integrity');
  const deniedApproval = createLocalEngineeringSecurityExceptionApproval({
    request: exceptionRequest, approverRole: 'security-reviewer', approverId: 'quality-security-reviewer',
    securityReviewerId: 'quality-security-reviewer', productOwnerId: 'product-owner', decision: 'denied',
    evidenceIds: ['security-denial-proof'], idempotencyKey: 'deny-security', now: '2026-07-11T14:04:00.000Z',
  });
  const legitimatelyRemediated = buildLocalEngineeringSecurityLedger({
    project: {
      id: scan.projectId, workModeContract: { workMode: 'technical-delivery' }, localEngineeringSecurityScans: [scan],
      localEngineeringSecurityRemediations: [mediumRemediation, remediation],
      localEngineeringSecurityExceptionRequests: [exceptionRequest],
      localEngineeringSecurityExceptionApprovals: [deniedApproval, productApproval],
    },
    now: '2026-07-11T14:07:00.000Z',
  });
  assert.equal(legitimatelyRemediated.integrity.valid, true);
  assert.equal(legitimatelyRemediated.readyForAttestation, true);
});

test('issues a short-lived attestation only for the exact current fully governed manifest', () => {
  const chain = governedSecurityChain();
  const project = {
    id: chain.scan.projectId,
    workModeContract: { workMode: 'technical-delivery' },
    localEngineeringSecurityScans: [chain.scan],
    localEngineeringSecurityRemediations: [chain.remediation],
    localEngineeringSecurityExceptionRequests: [chain.exceptionRequest],
    localEngineeringSecurityExceptionApprovals: [chain.productApproval, chain.securityApproval],
    localEngineeringSecurityAttestations: [],
  };
  const singleApproval = buildLocalEngineeringSecurityLedger({
    project: { ...project, localEngineeringSecurityExceptionApprovals: [chain.securityApproval] },
    now: '2026-07-11T14:06:00.000Z',
  });
  assert.equal(singleApproval.readyForAttestation, false);
  assert.deepEqual(singleApproval.openFindingIds, [chain.mediumFinding.id]);
  const eligible = buildLocalEngineeringSecurityLedger({ project, now: '2026-07-11T14:06:00.000Z' });
  assert.equal(eligible.integrity.valid, true);
  assert.equal(eligible.readyForAttestation, true);
  assert.deepEqual(eligible.openFindingIds, []);
  const staleScanEvidence = buildLocalEngineeringSecurityLedger({ project, now: '2026-07-13T14:06:00.000Z' });
  assert.equal(staleScanEvidence.readyForAttestation, false);
  assert.ok(staleScanEvidence.blockers.includes('engineering-security-scan-evidence-stale'));
  const attestation = createLocalEngineeringSecurityAttestation({
    ledger: eligible,
    actorId: 'quality-security-reviewer',
    securityReviewerId: 'quality-security-reviewer',
    idempotencyKey: 'security-attestation',
    now: '2026-07-11T14:07:00.000Z',
  });
  assert.equal(attestation.expiresAt, '2026-07-11T15:07:00.000Z');
  assert.equal(verifyLocalEngineeringSecurityAttestation(attestation, eligible, '2026-07-11T14:08:00.000Z').valid, true);
  const released = buildLocalEngineeringSecurityLedger({
    project: { ...project, localEngineeringSecurityAttestations: [attestation] },
    now: '2026-07-11T14:08:00.000Z',
  });
  assert.equal(released.readyForRelease, true);
  const expired = buildLocalEngineeringSecurityLedger({
    project: { ...project, localEngineeringSecurityAttestations: [attestation] },
    now: '2026-07-11T15:08:00.000Z',
  });
  assert.equal(expired.readyForRelease, false);
  const cleanChecks = scanInput().checks.map((row) => ({ ...row, status: 'passed' }));
  const newerScan = createLocalEngineeringSecurityScan(scanInput({
    implementationRevision: 'sha256:implementation-revision-049',
    checks: cleanChecks,
    findings: [],
    idempotencyKey: 'security-scan-2',
    now: '2026-07-11T14:20:00.000Z',
  }));
  const superseded = buildLocalEngineeringSecurityLedger({
    project: { ...project, localEngineeringSecurityScans: [newerScan, chain.scan], localEngineeringSecurityAttestations: [attestation] },
    now: '2026-07-11T14:21:00.000Z',
  });
  assert.equal(superseded.integrity.valid, true);
  assert.equal(superseded.readyForAttestation, true);
  assert.equal(superseded.readyForRelease, false);
  assert.ok(superseded.blockers.includes('engineering-security-attestation-stale'));
  const tampered = structuredClone(chain.securityApproval);
  tampered.decision = 'denied';
  const degraded = buildLocalEngineeringSecurityLedger({
    project: { ...project, localEngineeringSecurityExceptionApprovals: [chain.productApproval, tampered], localEngineeringSecurityAttestations: [attestation] },
    now: '2026-07-11T14:08:00.000Z',
  });
  assert.equal(degraded.integrity.valid, false);
  assert.equal(degraded.readyForRelease, false);
});
