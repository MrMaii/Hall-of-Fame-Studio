import { portableSha256Hex } from './accessControl.js';

const CHECK_TYPES = Object.freeze(['dependency', 'permission', 'secret', 'static-analysis']);
const CHECK_TYPE_SET = new Set(CHECK_TYPES);
const CHECK_STATUSES = new Set(['passed', 'findings', 'error']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const FORBIDDEN_RAW_KEYS = new Set([
  'credential', 'credentialvalue', 'environmentvalue', 'matchedtext', 'rawsecret', 'secretvalue', 'snippet', 'token', 'tokenvalue',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function checksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function receiptValid(receipt = {}, schemaVersion = '') {
  const { checksum: expected, ...base } = receipt;
  return receipt.schemaVersion === schemaVersion && Boolean(expected) && expected === checksum(base);
}

function identifier(value, field) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) throw new Error(`engineering-security-${field}-invalid`);
  return normalized;
}

function sha256(value, field) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error(`engineering-security-${field}-invalid`);
  return normalized;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`engineering-security-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) throw new Error(`engineering-security-${field}-invalid`);
  return normalized;
}

function localPath(value) {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized || normalized.length > 500 || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)
    || normalized.split('/').some((segment) => segment === '..')) throw new Error('engineering-security-location-path-invalid');
  return normalized;
}

function containsForbiddenRawMaterial(value) {
  if (Array.isArray(value)) return value.some(containsForbiddenRawMaterial);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_RAW_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, '')) || containsForbiddenRawMaterial(child));
}

function normalizeChecks(checks, createdAt) {
  if (!Array.isArray(checks) || checks.length !== CHECK_TYPES.length) throw new Error('engineering-security-required-check-set-invalid');
  const normalized = checks.map((row) => {
    const type = String(row?.type || '').trim();
    const status = String(row?.status || '').trim();
    if (!CHECK_TYPE_SET.has(type) || !CHECK_STATUSES.has(status)) throw new Error('engineering-security-required-check-set-invalid');
    const completedAt = iso(row.completedAt, 'check-completed-at');
    if (Date.parse(completedAt) > Date.parse(createdAt)) throw new Error('engineering-security-check-after-scan');
    if (Date.parse(createdAt) - Date.parse(completedAt) > 24 * 60 * 60_000) throw new Error('engineering-security-check-evidence-stale');
    return {
      type,
      toolId: identifier(row.toolId, 'check-tool-id'),
      toolVersion: identifier(row.toolVersion, 'check-tool-version'),
      configHash: sha256(row.configHash, 'check-config-hash'),
      evidenceId: identifier(row.evidenceId, 'check-evidence-id'),
      status,
      completedAt,
    };
  });
  if (new Set(normalized.map((row) => row.type)).size !== CHECK_TYPES.length
    || CHECK_TYPES.some((type) => !normalized.some((row) => row.type === type))) throw new Error('engineering-security-required-check-set-invalid');
  return normalized.sort((left, right) => left.type.localeCompare(right.type));
}

function normalizeFindings(findings, implementationRevision) {
  if (!Array.isArray(findings) || findings.length > 1_000) throw new Error('engineering-security-findings-invalid');
  if (containsForbiddenRawMaterial(findings)) throw new Error('engineering-security-raw-secret-material-forbidden');
  const normalized = findings.map((row) => {
    const checkType = String(row?.checkType || '').trim();
    const severity = String(row?.severity || '').trim();
    if (!CHECK_TYPE_SET.has(checkType)) throw new Error('engineering-security-finding-check-type-invalid');
    if (!SEVERITIES.has(severity)) throw new Error('engineering-security-finding-severity-invalid');
    const location = {
      path: localPath(row.location?.path),
      line: integer(row.location?.line, 'finding-line', 1, 10_000_000),
      column: integer(row.location?.column ?? 1, 'finding-column', 1, 100_000),
    };
    const stable = {
      implementationRevision,
      checkType,
      ruleId: identifier(row.ruleId, 'finding-rule-id'),
      severity,
      componentId: identifier(row.componentId, 'finding-component-id'),
      location,
    };
    const fingerprint = checksum(stable);
    return { id: `engineering_security_finding_${fingerprint.slice(0, 28)}`, fingerprint, ...stable };
  }).sort((left, right) => left.checkType.localeCompare(right.checkType) || left.fingerprint.localeCompare(right.fingerprint));
  if (new Set(normalized.map((row) => row.fingerprint)).size !== normalized.length) throw new Error('engineering-security-finding-duplicate');
  return normalized;
}

export function createLocalEngineeringSecurityScan({
  projectId, implementationRevision, checks, findings = [], actorId, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  if (containsForbiddenRawMaterial({ checks, findings })) throw new Error('engineering-security-raw-secret-material-forbidden');
  const createdAt = iso(now, 'scan-created-at');
  const revision = identifier(implementationRevision, 'implementation-revision');
  const normalizedFindings = normalizeFindings(findings, revision);
  const normalizedChecks = normalizeChecks(checks, createdAt).map((row) => ({
    ...row,
    findingCount: normalizedFindings.filter((finding) => finding.checkType === row.type).length,
  }));
  if (normalizedChecks.some((row) => (row.status === 'passed' && row.findingCount > 0)
    || (row.status === 'findings' && row.findingCount === 0)
    || (row.status === 'error' && row.findingCount > 0))) throw new Error('engineering-security-check-finding-status-mismatch');
  const normalizedProjectId = identifier(projectId, 'project-id');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-engineering-security-scan/v1',
    id: `engineering_security_scan_${checksum(`${normalizedProjectId}:${revision}:${normalizedKey}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    implementationRevision: revision,
    checks: normalizedChecks,
    findings: normalizedFindings,
    actorId: identifier(actorId, 'scan-actor-id'),
    idempotencyKey: normalizedKey,
    storesRawSecretMaterial: false,
    localOnly: true,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalEngineeringSecurityScan(scan = {}) {
  const checksumValid = receiptValid(scan, 'local-engineering-security-scan/v1');
  const checkSetValid = Array.isArray(scan.checks) && scan.checks.length === CHECK_TYPES.length
    && new Set(scan.checks.map((row) => row.type)).size === CHECK_TYPES.length
    && CHECK_TYPES.every((type) => scan.checks.some((row) => row.type === type));
  const noRawSecretMaterial = scan.storesRawSecretMaterial === false && !containsForbiddenRawMaterial(scan);
  const findingStatusValid = checkSetValid && (scan.checks || []).every((row) => {
    const count = (scan.findings || []).filter((finding) => finding.checkType === row.type).length;
    return row.findingCount === count
      && !((row.status === 'passed' && count > 0) || (row.status === 'findings' && count === 0) || (row.status === 'error' && count > 0));
  });
  return { valid: checksumValid && checkSetValid && noRawSecretMaterial && findingStatusValid, checksumValid, checkSetValid, noRawSecretMaterial, findingStatusValid };
}

function uniqueIds(values, field) {
  if (!Array.isArray(values) || !values.length || values.length > 100) throw new Error(`engineering-security-${field}-invalid`);
  const normalized = values.map((value) => identifier(value, field)).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error(`engineering-security-${field}-duplicate`);
  return normalized;
}

function findingFor(scan, findingId) {
  if (!verifyLocalEngineeringSecurityScan(scan).valid) throw new Error('engineering-security-scan-integrity-invalid');
  const finding = (scan.findings || []).find((row) => row.id === findingId);
  if (!finding) throw new Error('engineering-security-finding-not-found');
  return finding;
}

export function createLocalEngineeringSecurityRemediation({
  scan, findingId, resolution, evidenceIds, actorId, securityReviewerId, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const finding = findingFor(scan, findingId);
  const normalizedResolution = String(resolution || '').trim();
  if (!['remediated', 'false-positive'].includes(normalizedResolution)) throw new Error('engineering-security-remediation-resolution-invalid');
  const normalizedActor = identifier(actorId, 'remediation-actor-id');
  const normalizedReviewer = identifier(securityReviewerId, 'security-reviewer-id');
  if (scan.actorId === normalizedReviewer) throw new Error('engineering-security-reviewer-independence-invalid');
  if (normalizedResolution === 'remediated' && normalizedActor !== scan.actorId) throw new Error('engineering-security-remediation-implementer-required');
  if (normalizedResolution === 'false-positive' && normalizedActor !== normalizedReviewer) throw new Error('engineering-security-false-positive-reviewer-required');
  const createdAt = iso(now, 'remediation-created-at');
  if (Date.parse(createdAt) <= Date.parse(scan.createdAt)) throw new Error('engineering-security-remediation-before-scan');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-engineering-security-remediation/v1',
    id: `engineering_security_remediation_${checksum(`${scan.id}:${finding.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: scan.projectId,
    scanId: scan.id,
    scanChecksum: scan.checksum,
    implementationRevision: scan.implementationRevision,
    findingId: finding.id,
    findingFingerprint: finding.fingerprint,
    findingSeverity: finding.severity,
    resolution: normalizedResolution,
    evidenceIds: uniqueIds(evidenceIds, 'remediation-evidence-id'),
    actorId: normalizedActor,
    securityReviewerId: normalizedReviewer,
    idempotencyKey: normalizedKey,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalEngineeringSecurityRemediation(remediation = {}, scan = {}) {
  const checksumValid = receiptValid(remediation, 'local-engineering-security-remediation/v1');
  const finding = (scan.findings || []).find((row) => row.id === remediation.findingId);
  const linkValid = verifyLocalEngineeringSecurityScan(scan).valid && Boolean(finding)
    && remediation.projectId === scan.projectId && remediation.scanId === scan.id && remediation.scanChecksum === scan.checksum
    && remediation.implementationRevision === scan.implementationRevision
    && remediation.findingFingerprint === finding?.fingerprint && remediation.findingSeverity === finding?.severity
    && Date.parse(remediation.createdAt) > Date.parse(scan.createdAt);
  const actorValid = remediation.securityReviewerId !== scan.actorId
    && ((remediation.resolution === 'remediated' && remediation.actorId === scan.actorId)
      || (remediation.resolution === 'false-positive' && remediation.actorId === remediation.securityReviewerId));
  return { valid: checksumValid && linkValid && actorValid, checksumValid, linkValid, actorValid };
}

export function createLocalEngineeringSecurityExceptionRequest({
  scan, findingId, requesterId, evidenceIds, rationaleText, expiresAt, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const finding = findingFor(scan, findingId);
  if (['high', 'critical'].includes(finding.severity)) throw new Error('engineering-security-high-critical-exception-forbidden');
  if (finding.checkType === 'secret') throw new Error('engineering-security-secret-exception-forbidden');
  const normalizedRequester = identifier(requesterId, 'exception-requester-id');
  if (normalizedRequester !== scan.actorId) throw new Error('engineering-security-exception-implementer-required');
  const rationale = String(rationaleText || '').trim();
  if (!rationale || rationale.length > 4_000) throw new Error('engineering-security-exception-rationale-invalid');
  if (containsForbiddenRawMaterial({ rationaleText })) throw new Error('engineering-security-raw-secret-material-forbidden');
  const createdAt = iso(now, 'exception-request-created-at');
  if (Date.parse(createdAt) <= Date.parse(scan.createdAt)) throw new Error('engineering-security-exception-before-scan');
  const normalizedExpiresAt = iso(expiresAt, 'exception-expiry');
  const duration = Date.parse(normalizedExpiresAt) - Date.parse(createdAt);
  if (duration <= 0 || duration > 30 * 24 * 60 * 60_000) throw new Error('engineering-security-exception-expiry-invalid');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-engineering-security-exception-request/v1',
    id: `engineering_security_exception_request_${checksum(`${scan.id}:${finding.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: scan.projectId,
    scanId: scan.id,
    scanChecksum: scan.checksum,
    implementationRevision: scan.implementationRevision,
    findingId: finding.id,
    findingFingerprint: finding.fingerprint,
    findingSeverity: finding.severity,
    requesterId: normalizedRequester,
    evidenceIds: uniqueIds(evidenceIds, 'exception-request-evidence-id'),
    rationaleHash: portableSha256Hex(rationale),
    rationaleLength: rationale.length,
    expiresAt: normalizedExpiresAt,
    idempotencyKey: normalizedKey,
    storesRawRationale: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalEngineeringSecurityExceptionRequest(request = {}, scan = {}) {
  const checksumValid = receiptValid(request, 'local-engineering-security-exception-request/v1');
  const finding = (scan.findings || []).find((row) => row.id === request.findingId);
  const linkValid = verifyLocalEngineeringSecurityScan(scan).valid && Boolean(finding)
    && request.scanId === scan.id && request.scanChecksum === scan.checksum && request.implementationRevision === scan.implementationRevision
    && request.findingFingerprint === finding?.fingerprint && request.findingSeverity === finding?.severity
    && request.requesterId === scan.actorId && !['high', 'critical'].includes(request.findingSeverity) && finding?.checkType !== 'secret'
    && Date.parse(request.createdAt) > Date.parse(scan.createdAt)
    && Date.parse(request.expiresAt) > Date.parse(request.createdAt)
    && Date.parse(request.expiresAt) - Date.parse(request.createdAt) <= 30 * 24 * 60 * 60_000;
  return { valid: checksumValid && linkValid && request.storesRawRationale === false, checksumValid, linkValid };
}

export function createLocalEngineeringSecurityExceptionApproval({
  request, approverRole, approverId, securityReviewerId, productOwnerId, decision, evidenceIds,
  idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(request, 'local-engineering-security-exception-request/v1')) throw new Error('engineering-security-exception-request-integrity-invalid');
  const role = String(approverRole || '').trim();
  if (!['security-reviewer', 'product-owner'].includes(role)) throw new Error('engineering-security-exception-approver-role-invalid');
  const reviewer = identifier(securityReviewerId, 'security-reviewer-id');
  const owner = identifier(productOwnerId, 'product-owner-id');
  if (reviewer === owner || [reviewer, owner].includes(request.requesterId)) throw new Error('engineering-security-exception-self-approval-forbidden');
  const expectedApproverId = role === 'security-reviewer' ? reviewer : owner;
  const normalizedApprover = identifier(approverId, 'exception-approver-id');
  if (normalizedApprover !== expectedApproverId) throw new Error('engineering-security-exception-assigned-approver-required');
  const normalizedDecision = String(decision || '').trim();
  if (!['approved', 'denied'].includes(normalizedDecision)) throw new Error('engineering-security-exception-decision-invalid');
  const createdAt = iso(now, 'exception-approval-created-at');
  if (Date.parse(createdAt) <= Date.parse(request.createdAt) || Date.parse(createdAt) > Date.parse(request.expiresAt)) throw new Error('engineering-security-exception-approval-time-invalid');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-engineering-security-exception-approval/v1',
    id: `engineering_security_exception_approval_${checksum(`${request.id}:${role}:${normalizedKey}`).slice(0, 28)}`,
    projectId: request.projectId,
    requestId: request.id,
    requestChecksum: request.checksum,
    scanId: request.scanId,
    implementationRevision: request.implementationRevision,
    findingId: request.findingId,
    approverRole: role,
    approverId: normalizedApprover,
    securityReviewerId: reviewer,
    productOwnerId: owner,
    decision: normalizedDecision,
    evidenceIds: uniqueIds(evidenceIds, 'exception-approval-evidence-id'),
    idempotencyKey: normalizedKey,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalEngineeringSecurityExceptionApproval(approval = {}, request = {}) {
  const checksumValid = receiptValid(approval, 'local-engineering-security-exception-approval/v1');
  const expected = approval.approverRole === 'security-reviewer' ? approval.securityReviewerId : approval.productOwnerId;
  const linkValid = receiptValid(request, 'local-engineering-security-exception-request/v1')
    && approval.requestId === request.id && approval.requestChecksum === request.checksum
    && approval.scanId === request.scanId && approval.implementationRevision === request.implementationRevision
    && approval.findingId === request.findingId && approval.approverId === expected
    && approval.securityReviewerId !== approval.productOwnerId
    && ![approval.securityReviewerId, approval.productOwnerId].includes(request.requesterId)
    && ['security-reviewer', 'product-owner'].includes(approval.approverRole)
    && ['approved', 'denied'].includes(approval.decision)
    && Date.parse(approval.createdAt) > Date.parse(request.createdAt)
    && Date.parse(approval.createdAt) <= Date.parse(request.expiresAt);
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

function evidenceManifestChecksum(scan, remediations, requests, approvals) {
  return checksum({
    scan: scan ? [scan.id, scan.checksum] : null,
    remediations: remediations.map((row) => [row.id, row.checksum]).sort((a, b) => a[0].localeCompare(b[0])),
    exceptionRequests: requests.map((row) => [row.id, row.checksum]).sort((a, b) => a[0].localeCompare(b[0])),
    exceptionApprovals: approvals.map((row) => [row.id, row.checksum]).sort((a, b) => a[0].localeCompare(b[0])),
  });
}

export function createLocalEngineeringSecurityAttestation({
  ledger, actorId, securityReviewerId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!ledger?.integrity?.valid || !ledger.readyForAttestation || !ledger.latestScan) throw new Error('engineering-security-attestation-gate-blocked');
  const reviewer = identifier(securityReviewerId, 'security-reviewer-id');
  const actor = identifier(actorId, 'attestation-actor-id');
  if (actor !== reviewer || actor === ledger.latestScan.actorId) throw new Error('engineering-security-attestation-reviewer-required');
  const createdAt = iso(now, 'attestation-created-at');
  if (Date.parse(createdAt) <= Date.parse(ledger.latestEvidenceAt)) throw new Error('engineering-security-attestation-before-evidence');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-engineering-security-attestation/v1',
    id: `engineering_security_attestation_${checksum(`${ledger.latestScan.id}:${ledger.currentManifestChecksum}:${normalizedKey}`).slice(0, 28)}`,
    projectId: ledger.projectId,
    scanId: ledger.latestScan.id,
    scanChecksum: ledger.latestScan.checksum,
    implementationRevision: ledger.latestScan.implementationRevision,
    manifestChecksum: ledger.currentManifestChecksum,
    actorId: actor,
    securityReviewerId: reviewer,
    idempotencyKey: normalizedKey,
    status: 'attested',
    localOnly: true,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 60 * 60_000).toISOString(),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalEngineeringSecurityAttestation(attestation = {}, ledger = {}, now = new Date().toISOString()) {
  const receiptVerification = verifyLocalEngineeringSecurityAttestationReceipt(attestation);
  const checksumValid = receiptVerification.checksumValid;
  const linkValid = Boolean(ledger.latestScan)
    && attestation.projectId === ledger.projectId
    && attestation.scanId === ledger.latestScan.id && attestation.scanChecksum === ledger.latestScan.checksum
    && attestation.implementationRevision === ledger.latestScan.implementationRevision
    && attestation.manifestChecksum === ledger.currentManifestChecksum
    && attestation.actorId === attestation.securityReviewerId && attestation.actorId !== ledger.latestScan.actorId
    && Date.parse(attestation.createdAt) > Date.parse(ledger.latestEvidenceAt)
    && Date.parse(attestation.expiresAt) === Date.parse(attestation.createdAt) + 60 * 60_000;
  const unexpired = Date.parse(iso(now, 'attestation-evaluated-at')) <= Date.parse(attestation.expiresAt);
  const structuralValid = receiptVerification.valid && linkValid;
  return { valid: structuralValid && ledger.readyForAttestation && unexpired, structuralValid, checksumValid, linkValid, unexpired };
}

export function verifyLocalEngineeringSecurityAttestationReceipt(attestation = {}) {
  const checksumValid = receiptValid(attestation, 'local-engineering-security-attestation/v1');
  const ttlValid = Number.isFinite(Date.parse(attestation.createdAt))
    && Date.parse(attestation.expiresAt) === Date.parse(attestation.createdAt) + 60 * 60_000;
  const valid = checksumValid && ttlValid && attestation.status === 'attested' && attestation.localOnly === true
    && attestation.actorId === attestation.securityReviewerId;
  return { valid, checksumValid, ttlValid };
}

function duplicateValues(rows, selector) {
  const seen = new Set();
  const duplicates = [];
  rows.forEach((row) => {
    const value = selector(row);
    if (seen.has(value)) duplicates.push(value);
    seen.add(value);
  });
  return [...new Set(duplicates)];
}

export function buildLocalEngineeringSecurityLedger({ project = {}, now = new Date().toISOString() } = {}) {
  const scans = Array.isArray(project.localEngineeringSecurityScans) ? project.localEngineeringSecurityScans : [];
  const remediations = Array.isArray(project.localEngineeringSecurityRemediations) ? project.localEngineeringSecurityRemediations : [];
  const requests = Array.isArray(project.localEngineeringSecurityExceptionRequests) ? project.localEngineeringSecurityExceptionRequests : [];
  const approvals = Array.isArray(project.localEngineeringSecurityExceptionApprovals) ? project.localEngineeringSecurityExceptionApprovals : [];
  const attestations = Array.isArray(project.localEngineeringSecurityAttestations) ? project.localEngineeringSecurityAttestations : [];
  const scanMap = new Map(scans.map((row) => [row.id, row]));
  const requestMap = new Map(requests.map((row) => [row.id, row]));
  const invalidReceiptIds = scans.filter((row) => row.projectId !== project.id || !verifyLocalEngineeringSecurityScan(row).valid).map((row) => row.id);
  remediations.forEach((row) => { if (!verifyLocalEngineeringSecurityRemediation(row, scanMap.get(row.scanId)).valid) invalidReceiptIds.push(row.id); });
  requests.forEach((row) => { if (!verifyLocalEngineeringSecurityExceptionRequest(row, scanMap.get(row.scanId)).valid) invalidReceiptIds.push(row.id); });
  approvals.forEach((row) => { if (!verifyLocalEngineeringSecurityExceptionApproval(row, requestMap.get(row.requestId)).valid) invalidReceiptIds.push(row.id); });
  const allReceipts = [...scans, ...remediations, ...requests, ...approvals, ...attestations];
  const duplicateIds = duplicateValues(allReceipts, (row) => row.id);
  const duplicateRemediationFindingIds = duplicateValues(remediations, (row) => `${row.scanId}:${row.findingId}`);
  const duplicateRequestFindingIds = duplicateValues(requests, (row) => `${row.scanId}:${row.findingId}`);
  const duplicateApprovalRoles = duplicateValues(approvals, (row) => `${row.requestId}:${row.approverRole}`);
  const modeValid = project.workModeContract?.workMode === 'technical-delivery';
  const latestScan = scans[0] || null;
  const currentRemediations = remediations.filter((row) => row.scanId === latestScan?.id);
  const currentRequests = requests.filter((row) => row.scanId === latestScan?.id);
  const currentRequestIds = new Set(currentRequests.map((row) => row.id));
  const currentApprovals = approvals.filter((row) => currentRequestIds.has(row.requestId));
  const remediationFindingIds = new Set(currentRemediations.map((row) => row.findingId));
  const exceptionFindingIds = new Set(currentRequests.filter((request) => {
    if (Date.parse(request.expiresAt) < Date.parse(now)) return false;
    const rows = currentApprovals.filter((row) => row.requestId === request.id);
    return !rows.some((row) => row.decision === 'denied')
      && ['security-reviewer', 'product-owner'].every((role) => rows.some((row) => row.approverRole === role && row.decision === 'approved'));
  }).map((row) => row.findingId));
  const structuralDuplicates = [...duplicateIds, ...duplicateRemediationFindingIds, ...duplicateRequestFindingIds, ...duplicateApprovalRoles];
  const integrityValid = modeValid && invalidReceiptIds.length === 0 && structuralDuplicates.length === 0;
  const openFindings = (latestScan?.findings || []).filter((row) => !remediationFindingIds.has(row.id) && !exceptionFindingIds.has(row.id));
  const checkErrorTypes = (latestScan?.checks || []).filter((row) => row.status === 'error').map((row) => row.type);
  const scanEvidenceFresh = Boolean(latestScan
    && Date.parse(now) >= Date.parse(latestScan.createdAt)
    && Date.parse(now) - Date.parse(latestScan.createdAt) <= 24 * 60 * 60_000);
  const blockingFindingIds = openFindings.filter((row) => ['high', 'critical'].includes(row.severity)).map((row) => row.id).sort();
  const openFindingIds = openFindings.map((row) => row.id).sort();
  const currentManifestChecksum = evidenceManifestChecksum(latestScan, currentRemediations, currentRequests, currentApprovals);
  const latestEvidenceAt = [latestScan, ...currentRemediations, ...currentRequests, ...currentApprovals]
    .filter(Boolean).map((row) => row.createdAt).sort().at(-1) || null;
  const baseLedger = {
    schemaVersion: 'local-engineering-security-ledger/v1',
    projectId: project.id || null,
    localOnly: true,
    evaluatedAt: iso(now, 'ledger-evaluated-at'),
    integrity: { valid: integrityValid, modeValid, invalidReceiptIds: [...new Set(invalidReceiptIds)], duplicateIds: [...new Set(structuralDuplicates)] },
    latestScan,
    currentManifestChecksum,
    latestEvidenceAt,
    openFindingIds,
    blockingFindingIds,
    checkErrorTypes,
    readyForAttestation: integrityValid && Boolean(latestScan) && scanEvidenceFresh && checkErrorTypes.length === 0 && openFindingIds.length === 0,
    blockers: [
      !modeValid ? 'engineering-security-technical-delivery-work-mode-required' : null,
      invalidReceiptIds.length || structuralDuplicates.length ? 'engineering-security-ledger-integrity-invalid' : null,
      !latestScan ? 'engineering-security-scan-required' : null,
      latestScan && !scanEvidenceFresh ? 'engineering-security-scan-evidence-stale' : null,
      checkErrorTypes.length ? 'engineering-security-check-error' : null,
      blockingFindingIds.length ? 'engineering-security-high-critical-findings-open' : null,
      openFindingIds.length ? 'engineering-security-findings-open' : null,
    ].filter(Boolean),
    summary: {
      scanCount: scans.length,
      findingCount: latestScan?.findings?.length || 0,
      remediationCount: currentRemediations.length,
      exceptionRequestCount: currentRequests.length,
      exceptionApprovalCount: currentApprovals.length,
      openFindingCount: openFindingIds.length,
      blockingFindingCount: blockingFindingIds.length,
    },
  };
  attestations.forEach((row) => {
    const historicalScan = scanMap.get(row.scanId);
    const cutoff = Date.parse(row.createdAt);
    const historicalRemediations = remediations.filter((item) => item.scanId === row.scanId && Date.parse(item.createdAt) <= cutoff);
    const historicalRequests = requests.filter((item) => item.scanId === row.scanId && Date.parse(item.createdAt) <= cutoff);
    const historicalRequestIds = new Set(historicalRequests.map((item) => item.id));
    const historicalApprovals = approvals.filter((item) => historicalRequestIds.has(item.requestId) && Date.parse(item.createdAt) <= cutoff);
    const historicalRemediatedIds = new Set(historicalRemediations.map((item) => item.findingId));
    const historicalExceptedIds = new Set(historicalRequests.filter((request) => {
      if (Date.parse(request.expiresAt) < cutoff) return false;
      const rows = historicalApprovals.filter((item) => item.requestId === request.id);
      return !rows.some((item) => item.decision === 'denied')
        && ['security-reviewer', 'product-owner'].every((role) => rows.some((item) => item.approverRole === role && item.decision === 'approved'));
    }).map((item) => item.findingId));
    const historicalReady = Boolean(historicalScan)
      && !(historicalScan.checks || []).some((item) => item.status === 'error')
      && cutoff >= Date.parse(historicalScan.createdAt)
      && cutoff - Date.parse(historicalScan.createdAt) <= 24 * 60 * 60_000
      && (historicalScan.findings || []).every((item) => historicalRemediatedIds.has(item.id) || historicalExceptedIds.has(item.id));
    const historicalEvidenceAt = [historicalScan, ...historicalRemediations, ...historicalRequests, ...historicalApprovals]
      .filter(Boolean).map((item) => item.createdAt).sort().at(-1) || null;
    const historicalLedger = {
      projectId: project.id,
      latestScan: historicalScan,
      currentManifestChecksum: evidenceManifestChecksum(historicalScan, historicalRemediations, historicalRequests, historicalApprovals),
      latestEvidenceAt: historicalEvidenceAt,
      readyForAttestation: historicalReady,
    };
    const verification = verifyLocalEngineeringSecurityAttestation(row, historicalLedger, row.createdAt);
    if (!verification.structuralValid || !historicalReady) invalidReceiptIds.push(row.id);
  });
  const attestationIntegrityValid = baseLedger.integrity.valid && invalidReceiptIds.length === 0;
  const ledger = { ...baseLedger, integrity: { ...baseLedger.integrity, valid: attestationIntegrityValid, invalidReceiptIds: [...new Set(invalidReceiptIds)] } };
  const latestAttestation = attestations[0] || null;
  const attestationCurrent = Boolean(latestAttestation
    && latestAttestation.scanId === latestScan?.id
    && latestAttestation.scanChecksum === latestScan?.checksum
    && latestAttestation.manifestChecksum === currentManifestChecksum);
  const attestationVerification = latestAttestation && attestationCurrent
    ? verifyLocalEngineeringSecurityAttestation(latestAttestation, ledger, now)
    : null;
  return {
    ...ledger,
    latestAttestation,
    readyForRelease: Boolean(attestationIntegrityValid && attestationVerification?.valid),
    blockers: [
      ...ledger.blockers,
      latestAttestation && !attestationCurrent ? 'engineering-security-attestation-stale' : null,
      latestAttestation && attestationCurrent && !attestationVerification?.unexpired ? 'engineering-security-attestation-expired' : null,
      !latestAttestation ? 'engineering-security-attestation-required' : null,
    ].filter(Boolean),
    summary: { ...ledger.summary, attestationCount: attestations.length },
  };
}
