import { portableSha256Hex } from './accessControl.js';
import { buildLocalCreativeStudioWorkflow } from './localCreativeStudio.js';

const RIGHTS_BASES = new Set(['owned', 'commissioned', 'licensed', 'open-license', 'public-domain', 'user-grant', 'generated']);
const ALLOWED_USES = new Set(['display', 'distribution', 'commercial', 'modification']);
const CHANNELS = new Set(['digital', 'print', 'broadcast', 'audio', 'local-only']);
const TERRITORIES = new Set(['worldwide', 'local-only']);
const TARGET_TYPES = new Set(['export-output', 'editable-source', 'dependency']);

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

function identifier(value, field, optional = false) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > 240 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(normalized)) throw new Error(`rights-${field}-invalid`);
  return normalized;
}

function sha(value, field) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error(`rights-${field}-invalid`);
  return normalized;
}

function iso(value, field, optional = false) {
  if (value == null && optional) return null;
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`rights-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function narrative(value, field, optional = false) {
  const normalized = String(value || '').trim();
  if (!normalized && optional) return { hash: null, length: 0 };
  if (!normalized || normalized.length > 20_000) throw new Error(`rights-${field}-invalid`);
  return { hash: portableSha256Hex(normalized), length: normalized.length };
}

function uniqueIdentifiers(values, field, { allowEmpty = false, allowed = null } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0) || values.length > 200) throw new Error(`rights-${field}-invalid`);
  const normalized = values.map((value) => identifier(value, field)).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error(`rights-${field}-duplicate`);
  if (allowed && normalized.some((value) => !allowed.has(value))) throw new Error(`rights-${field.replace(/s$/, '')}-invalid`);
  return normalized;
}

function targetFromCreative(targetType, targetId, creativeExport, handoff) {
  if (targetType === 'export-output') {
    const check = creativeExport?.checks?.find((row) => row.deliverableId === targetId);
    return check ? { checksum: check.outputChecksum } : null;
  }
  if (targetType === 'editable-source') return handoff?.editableSourceEvidenceIds?.includes(targetId) ? { checksum: null } : null;
  if (targetType === 'dependency') return handoff?.dependencyIds?.includes(targetId) ? { checksum: null } : null;
  return null;
}

export function createLocalRightsAssetDeclaration({
  projectId, creativeExport, handoff, targetType, targetId, assetChecksum, rightsBasis, rightsHolderId,
  licenseId, licenseEvidenceIds = [], allowedUses, channels, territories, attributionRequired = false,
  attributionText = null, attributionEvidenceIds = [], expiresAt = null, previousDeclaration = null, actorId, idempotencyKey,
  now = new Date().toISOString(),
} = {}) {
  const normalizedTargetType = String(targetType || '').trim();
  if (!TARGET_TYPES.has(normalizedTargetType)) throw new Error('rights-target-type-invalid');
  const normalizedTargetId = identifier(targetId, 'target-id');
  if (creativeExport?.projectId !== projectId || handoff?.projectId !== projectId || handoff?.exportId !== creativeExport?.id
    || handoff?.exportChecksum !== creativeExport?.checksum) throw new Error('rights-creative-binding-invalid');
  const target = targetFromCreative(normalizedTargetType, normalizedTargetId, creativeExport, handoff);
  if (!target) throw new Error('rights-target-invalid');
  const normalizedAssetChecksum = sha(assetChecksum, 'asset-checksum');
  if (target.checksum && target.checksum !== normalizedAssetChecksum) throw new Error('rights-target-checksum-mismatch');
  const normalizedBasis = String(rightsBasis || '').trim();
  if (!RIGHTS_BASES.has(normalizedBasis)) throw new Error('rights-basis-invalid');
  if (actorId !== handoff.senderId) throw new Error('rights-art-director-required');
  const attribution = narrative(attributionText, 'attribution-text', !attributionRequired);
  const normalizedAttributionEvidence = uniqueIdentifiers(attributionEvidenceIds, 'attribution-evidence-ids', { allowEmpty: true });
  const normalizedProjectId = identifier(projectId, 'project-id');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const createdAt = iso(now, 'declaration-created-at');
  const expiration = iso(expiresAt, 'license-expiration', true);
  if (previousDeclaration && (!receiptValid(previousDeclaration, 'local-rights-asset-declaration/v1')
    || previousDeclaration.projectId !== normalizedProjectId || previousDeclaration.targetType !== normalizedTargetType
    || previousDeclaration.targetId !== normalizedTargetId || previousDeclaration.creativeExportId !== creativeExport.id
    || Date.parse(createdAt) <= Date.parse(previousDeclaration.createdAt))) throw new Error('rights-previous-declaration-invalid');
  const base = {
    schemaVersion: 'local-rights-asset-declaration/v1',
    id: `rights_asset_${checksum(`${normalizedProjectId}:${normalizedTargetType}:${normalizedTargetId}:${normalizedKey}`).slice(0, 28)}`,
    projectId: normalizedProjectId,
    creativeExportId: creativeExport.id,
    creativeExportChecksum: creativeExport.checksum,
    handoffId: handoff.id,
    handoffChecksum: handoff.checksum,
    targetType: normalizedTargetType,
    targetId: normalizedTargetId,
    assetChecksum: normalizedAssetChecksum,
    rightsBasis: normalizedBasis,
    rightsHolderId: identifier(rightsHolderId, 'rights-holder-id'),
    licenseId: identifier(licenseId, 'license-id', true),
    licenseEvidenceIds: uniqueIdentifiers(licenseEvidenceIds, 'license-evidence-ids', { allowEmpty: true }),
    allowedUses: uniqueIdentifiers(allowedUses, 'allowed-uses', { allowed: ALLOWED_USES }),
    channels: uniqueIdentifiers(channels, 'channels', { allowed: CHANNELS }),
    territories: uniqueIdentifiers(territories, 'territories', { allowed: TERRITORIES }),
    attributionRequired: attributionRequired === true,
    attributionHash: attribution.hash,
    attributionLength: attribution.length,
    attributionEvidenceIds: normalizedAttributionEvidence,
    expiresAt: expiration,
    version: previousDeclaration ? previousDeclaration.version + 1 : 1,
    previousDeclarationId: previousDeclaration?.id || null,
    previousDeclarationChecksum: previousDeclaration?.checksum || null,
    actorId: handoff.senderId,
    idempotencyKey: normalizedKey,
    storesRawLegalText: false,
    createdAt,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalRightsAssetDeclaration(declaration = {}, creativeExport = {}, handoff = {}, previousDeclaration = null) {
  const checksumValid = receiptValid(declaration, 'local-rights-asset-declaration/v1');
  const target = targetFromCreative(declaration.targetType, declaration.targetId, creativeExport, handoff);
  const linkValid = declaration.projectId === creativeExport.projectId && declaration.projectId === handoff.projectId
    && declaration.creativeExportId === creativeExport.id && declaration.creativeExportChecksum === creativeExport.checksum
    && declaration.handoffId === handoff.id && declaration.handoffChecksum === handoff.checksum
    && handoff.exportId === creativeExport.id && handoff.exportChecksum === creativeExport.checksum && Boolean(target)
    && (!target?.checksum || target.checksum === declaration.assetChecksum) && declaration.actorId === handoff.senderId;
  const scopeValid = RIGHTS_BASES.has(declaration.rightsBasis) && /^[a-f0-9]{64}$/.test(declaration.assetChecksum || '')
    && Array.isArray(declaration.allowedUses) && declaration.allowedUses.length > 0 && declaration.allowedUses.every((value) => ALLOWED_USES.has(value))
    && Array.isArray(declaration.channels) && declaration.channels.length > 0 && declaration.channels.every((value) => CHANNELS.has(value))
    && Array.isArray(declaration.territories) && declaration.territories.length > 0 && declaration.territories.every((value) => TERRITORIES.has(value));
  const privacyValid = declaration.storesRawLegalText === false && declaration.attributionText === undefined;
  const versionValid = declaration.version === 1
    ? !declaration.previousDeclarationId && !declaration.previousDeclarationChecksum
    : Boolean(previousDeclaration && declaration.version === previousDeclaration.version + 1
      && declaration.previousDeclarationId === previousDeclaration.id && declaration.previousDeclarationChecksum === previousDeclaration.checksum
      && previousDeclaration.targetType === declaration.targetType && previousDeclaration.targetId === declaration.targetId
      && Date.parse(declaration.createdAt) > Date.parse(previousDeclaration.createdAt));
  return { valid: checksumValid && linkValid && scopeValid && privacyValid && versionValid, checksumValid, linkValid, scopeValid, privacyValid, versionValid };
}

export function createLocalRightsGenerationProvenance({
  declaration, declarations = [], providerId, modelId, policyId, promptText, generationEvidenceIds,
  disclosureText, inputAssetIds = [], humanEditorId, actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(declaration, 'local-rights-asset-declaration/v1') || declaration.rightsBasis !== 'generated') throw new Error('rights-generated-declaration-required');
  if (actorId !== declaration.actorId || humanEditorId !== declaration.actorId) throw new Error('rights-generation-art-director-required');
  const declarationMap = new Map(declarations.map((row) => [row.id, row]));
  const inputs = uniqueIdentifiers(inputAssetIds, 'generation-input-asset-ids', { allowEmpty: true });
  if (inputs.some((id) => !declarationMap.has(id))) throw new Error('rights-generation-input-undeclared');
  const prompt = narrative(promptText, 'generation-prompt');
  const disclosure = narrative(disclosureText, 'generation-disclosure');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-rights-generation-provenance/v1',
    id: `rights_generation_${checksum(`${declaration.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: declaration.projectId,
    declarationId: declaration.id,
    declarationChecksum: declaration.checksum,
    assetChecksum: declaration.assetChecksum,
    providerId: identifier(providerId, 'generation-provider-id'),
    modelId: identifier(modelId, 'generation-model-id'),
    policyId: identifier(policyId, 'generation-policy-id'),
    promptHash: prompt.hash,
    promptLength: prompt.length,
    generationEvidenceIds: uniqueIdentifiers(generationEvidenceIds, 'generation-evidence-ids'),
    disclosureHash: disclosure.hash,
    disclosureLength: disclosure.length,
    inputAssetIds: inputs,
    humanEditorId: declaration.actorId,
    actorId: declaration.actorId,
    idempotencyKey: normalizedKey,
    storesRawPrompt: false,
    storesRawGenerationInputs: false,
    createdAt: iso(now, 'generation-created-at'),
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalRightsGenerationProvenance(provenance = {}, declarations = []) {
  const declarationMap = new Map(declarations.map((row) => [row.id, row]));
  const declaration = declarationMap.get(provenance.declarationId);
  const checksumValid = receiptValid(provenance, 'local-rights-generation-provenance/v1');
  const linkValid = Boolean(declaration && receiptValid(declaration, 'local-rights-asset-declaration/v1') && declaration.rightsBasis === 'generated'
    && provenance.declarationChecksum === declaration.checksum && provenance.assetChecksum === declaration.assetChecksum
    && provenance.actorId === declaration.actorId && provenance.humanEditorId === declaration.actorId
    && provenance.inputAssetIds?.every((id) => declarationMap.has(id)));
  const evidenceValid = Boolean(provenance.providerId && provenance.modelId && provenance.policyId && provenance.generationEvidenceIds?.length
    && /^[a-f0-9]{64}$/.test(provenance.promptHash || '') && /^[a-f0-9]{64}$/.test(provenance.disclosureHash || ''));
  return { valid: checksumValid && linkValid && evidenceValid && provenance.storesRawPrompt === false, checksumValid, linkValid, evidenceValid };
}

function graphHasCycle(lineages) {
  const graph = new Map();
  lineages.forEach((row) => graph.set(row.outputDeclarationId, row.inputDeclarationIds || []));
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if ((graph.get(id) || []).some(visit)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  return [...graph.keys()].some(visit);
}

export function createLocalRightsDerivativeLineage({
  outputDeclaration, inputDeclarationIds, declarations = [], existingLineages = [], transformationText,
  evidenceIds, actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!receiptValid(outputDeclaration, 'local-rights-asset-declaration/v1')) throw new Error('rights-derivative-output-invalid');
  if (actorId !== outputDeclaration.actorId) throw new Error('rights-derivative-art-director-required');
  const declarationMap = new Map(declarations.map((row) => [row.id, row]));
  const inputs = uniqueIdentifiers(inputDeclarationIds, 'derivative-input-declaration-ids');
  if (inputs.some((id) => !declarationMap.has(id) || id === outputDeclaration.id)) throw new Error('rights-derivative-input-undeclared');
  const transformation = narrative(transformationText, 'derivative-transformation');
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-rights-derivative-lineage/v1',
    id: `rights_lineage_${checksum(`${outputDeclaration.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: outputDeclaration.projectId,
    outputDeclarationId: outputDeclaration.id,
    outputDeclarationChecksum: outputDeclaration.checksum,
    outputAssetChecksum: outputDeclaration.assetChecksum,
    inputDeclarationIds: inputs,
    inputManifest: inputs.map((id) => [id, declarationMap.get(id).checksum]),
    transformationHash: transformation.hash,
    transformationLength: transformation.length,
    evidenceIds: uniqueIdentifiers(evidenceIds, 'derivative-evidence-ids'),
    actorId: outputDeclaration.actorId,
    idempotencyKey: normalizedKey,
    storesRawTransformation: false,
    createdAt: iso(now, 'derivative-created-at'),
  };
  const receipt = { ...base, checksum: checksum(base) };
  if (graphHasCycle([...existingLineages, receipt])) throw new Error('rights-derivative-cycle');
  return receipt;
}

export function verifyLocalRightsDerivativeLineage(lineage = {}, declarations = [], existingLineages = []) {
  const declarationMap = new Map(declarations.map((row) => [row.id, row]));
  const output = declarationMap.get(lineage.outputDeclarationId);
  const checksumValid = receiptValid(lineage, 'local-rights-derivative-lineage/v1');
  const linkValid = Boolean(output && lineage.outputDeclarationChecksum === output.checksum && lineage.outputAssetChecksum === output.assetChecksum
    && lineage.actorId === output.actorId && lineage.inputManifest?.every(([id, sum]) => declarationMap.get(id)?.checksum === sum));
  const evidenceValid = Boolean(lineage.inputDeclarationIds?.length && lineage.evidenceIds?.length && /^[a-f0-9]{64}$/.test(lineage.transformationHash || ''));
  return { valid: checksumValid && linkValid && evidenceValid && !graphHasCycle(existingLineages), checksumValid, linkValid, evidenceValid };
}

function requiredTargets(workflow) {
  return [
    ...(workflow.latestExport?.checks || []).map((row) => ({ targetType: 'export-output', targetId: row.deliverableId, assetChecksum: row.outputChecksum })),
    ...(workflow.latestHandoff?.editableSourceEvidenceIds || []).map((targetId) => ({ targetType: 'editable-source', targetId, assetChecksum: null })),
    ...(workflow.latestHandoff?.dependencyIds || []).map((targetId) => ({ targetType: 'dependency', targetId, assetChecksum: null })),
  ].sort((a, b) => `${a.targetType}:${a.targetId}`.localeCompare(`${b.targetType}:${b.targetId}`));
}

function deriveFindings({ creativeWorkflow, declarations, generationProvenance, derivativeLineages, requiredUses, requiredChannels, requiredTerritories, now }) {
  const findings = [];
  const targetKey = (row) => `${row.targetType}:${row.targetId}`;
  const declarationByTarget = new Map();
  declarations.forEach((row) => {
    const key = targetKey(row);
    if (declarationByTarget.has(key)) findings.push({ code: 'target-declaration-duplicate', targetId: key });
    declarationByTarget.set(key, row);
  });
  requiredTargets(creativeWorkflow).forEach((target) => {
    const declaration = declarationByTarget.get(targetKey(target));
    if (!declaration) {
      findings.push({ code: 'target-declaration-missing', targetId: targetKey(target) });
      return;
    }
    if (target.assetChecksum && declaration.assetChecksum !== target.assetChecksum) findings.push({ code: 'target-checksum-mismatch', targetId: targetKey(target) });
    if (!declaration.licenseId || !declaration.licenseEvidenceIds?.length) findings.push({ code: 'rights-evidence-missing', targetId: declaration.id });
    if (requiredUses.some((value) => !declaration.allowedUses?.includes(value))) findings.push({ code: 'use-scope-missing', targetId: declaration.id });
    if (requiredChannels.some((value) => !declaration.channels?.includes(value))) findings.push({ code: 'channel-scope-missing', targetId: declaration.id });
    if (requiredTerritories.some((value) => !declaration.territories?.includes(value))) findings.push({ code: 'territory-scope-missing', targetId: declaration.id });
    if (declaration.expiresAt && Date.parse(declaration.expiresAt) <= Date.parse(now)) findings.push({ code: 'rights-expired', targetId: declaration.id });
    if (declaration.attributionRequired && (!declaration.attributionHash || !declaration.attributionEvidenceIds?.length)) findings.push({ code: 'attribution-proof-missing', targetId: declaration.id });
    if (declaration.rightsBasis === 'generated' && !generationProvenance.some((row) => row.declarationId === declaration.id)) findings.push({ code: 'generation-provenance-missing', targetId: declaration.id });
  });
  const outputDeclarations = declarations.filter((row) => row.targetType === 'export-output');
  outputDeclarations.forEach((row) => {
    if (!derivativeLineages.some((lineage) => lineage.outputDeclarationId === row.id)) findings.push({ code: 'derivative-lineage-missing', targetId: row.id });
  });
  return findings.sort((a, b) => `${a.code}:${a.targetId}`.localeCompare(`${b.code}:${b.targetId}`));
}

export function createLocalRightsExportAudit({
  creativeWorkflow, declarations = [], generationProvenance = [], derivativeLineages = [], reviewerId,
  requiredUses, requiredChannels, requiredTerritories, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!creativeWorkflow?.integrity?.valid || creativeWorkflow.status !== 'ready-for-rights-provenance-audit'
    || !creativeWorkflow.readyForRightsProvenanceAudit || !creativeWorkflow.latestExport || !creativeWorkflow.latestHandoff
    || !creativeWorkflow.latestHandoffAcknowledgement) throw new Error('rights-creative-terminal-state-required');
  if (reviewerId !== creativeWorkflow.latestBrief?.rightsReviewerId) throw new Error('rights-reviewer-required');
  const normalizedNow = iso(now, 'audit-created-at');
  if (Date.parse(normalizedNow) <= Date.parse(creativeWorkflow.latestHandoffAcknowledgement.createdAt)) throw new Error('rights-audit-before-handoff-acknowledgement');
  const uses = uniqueIdentifiers(requiredUses, 'required-uses', { allowed: ALLOWED_USES });
  const channels = uniqueIdentifiers(requiredChannels, 'required-channels', { allowed: CHANNELS });
  const territories = uniqueIdentifiers(requiredTerritories, 'required-territories', { allowed: TERRITORIES });
  const findings = deriveFindings({ creativeWorkflow, declarations, generationProvenance, derivativeLineages, requiredUses: uses, requiredChannels: channels, requiredTerritories: territories, now: normalizedNow });
  const normalizedKey = identifier(idempotencyKey, 'idempotency-key');
  const ready = findings.length === 0;
  const base = {
    schemaVersion: 'local-rights-export-audit/v1',
    id: `rights_audit_${checksum(`${creativeWorkflow.projectId}:${creativeWorkflow.latestExport.id}:${normalizedKey}`).slice(0, 28)}`,
    projectId: creativeWorkflow.projectId,
    creativeExportId: creativeWorkflow.latestExport.id,
    creativeExportChecksum: creativeWorkflow.latestExport.checksum,
    handoffId: creativeWorkflow.latestHandoff.id,
    handoffChecksum: creativeWorkflow.latestHandoff.checksum,
    acknowledgementId: creativeWorkflow.latestHandoffAcknowledgement.id,
    acknowledgementChecksum: creativeWorkflow.latestHandoffAcknowledgement.checksum,
    declarationManifest: declarations.map((row) => [row.id, row.checksum]).sort(),
    generationManifest: generationProvenance.map((row) => [row.id, row.checksum]).sort(),
    derivativeManifest: derivativeLineages.map((row) => [row.id, row.checksum]).sort(),
    requiredUses: uses,
    requiredChannels: channels,
    requiredTerritories: territories,
    findings,
    reviewerId,
    idempotencyKey: normalizedKey,
    status: ready ? 'rights-governed-export-cleared' : 'rights-remediation-required',
    readyForRightsGovernedExport: ready,
    readyForExternalRelease: false,
    legalOpinion: false,
    validUntil: new Date(Date.parse(normalizedNow) + 86_400_000).toISOString(),
    createdAt: normalizedNow,
  };
  return { ...base, checksum: checksum(base) };
}

export function verifyLocalRightsExportAudit(audit = {}, creativeWorkflow = {}, declarations = [], generationProvenance = [], derivativeLineages = []) {
  const checksumValid = receiptValid(audit, 'local-rights-export-audit/v1');
  const linkValid = audit.projectId === creativeWorkflow.projectId && audit.creativeExportId === creativeWorkflow.latestExport?.id
    && audit.creativeExportChecksum === creativeWorkflow.latestExport?.checksum && audit.handoffId === creativeWorkflow.latestHandoff?.id
    && audit.handoffChecksum === creativeWorkflow.latestHandoff?.checksum && audit.acknowledgementId === creativeWorkflow.latestHandoffAcknowledgement?.id
    && audit.acknowledgementChecksum === creativeWorkflow.latestHandoffAcknowledgement?.checksum && audit.reviewerId === creativeWorkflow.latestBrief?.rightsReviewerId;
  const manifestValid = JSON.stringify(audit.declarationManifest) === JSON.stringify(declarations.map((row) => [row.id, row.checksum]).sort())
    && JSON.stringify(audit.generationManifest) === JSON.stringify(generationProvenance.map((row) => [row.id, row.checksum]).sort())
    && JSON.stringify(audit.derivativeManifest) === JSON.stringify(derivativeLineages.map((row) => [row.id, row.checksum]).sort());
  const findings = deriveFindings({ creativeWorkflow, declarations, generationProvenance, derivativeLineages, requiredUses: audit.requiredUses || [], requiredChannels: audit.requiredChannels || [], requiredTerritories: audit.requiredTerritories || [], now: audit.createdAt });
  const verdictValid = JSON.stringify(audit.findings) === JSON.stringify(findings) && audit.readyForRightsGovernedExport === (findings.length === 0)
    && audit.status === (findings.length === 0 ? 'rights-governed-export-cleared' : 'rights-remediation-required') && audit.legalOpinion === false;
  return { valid: checksumValid && linkValid && manifestValid && verdictValid, checksumValid, linkValid, manifestValid, verdictValid };
}

export function buildLocalRightsProvenance({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'projection-created-at');
  const creativeWorkflow = buildLocalCreativeStudioWorkflow({ project, now: generatedAt });
  const declarationHistory = project.localRightsAssetDeclarations || [];
  const declarationMap = new Map(declarationHistory.map((row) => [row.id, row]));
  const supersededDeclarationIds = new Set(declarationHistory.map((row) => row.previousDeclarationId).filter(Boolean));
  const declarations = declarationHistory.filter((row) => !supersededDeclarationIds.has(row.id));
  const generation = project.localRightsGenerationProvenance || [];
  const lineages = project.localRightsDerivativeLineages || [];
  const audits = project.localRightsExportAudits || [];
  const activeDeclarationIds = new Set(declarations.map((row) => row.id));
  const activeGeneration = generation.filter((row) => activeDeclarationIds.has(row.declarationId));
  const activeLineages = lineages.filter((row) => activeDeclarationIds.has(row.outputDeclarationId));
  const invalidReceiptIds = [];
  declarationHistory.forEach((row) => { if (!verifyLocalRightsAssetDeclaration(row, creativeWorkflow.latestExport, creativeWorkflow.latestHandoff, declarationMap.get(row.previousDeclarationId) || null).valid) invalidReceiptIds.push(row.id); });
  generation.forEach((row) => { if (!verifyLocalRightsGenerationProvenance(row, declarationHistory).valid) invalidReceiptIds.push(row.id); });
  lineages.forEach((row) => { if (!verifyLocalRightsDerivativeLineage(row, declarationHistory, lineages).valid) invalidReceiptIds.push(row.id); });
  audits.forEach((row) => { if (!verifyLocalRightsExportAudit(row, creativeWorkflow, declarations, activeGeneration, activeLineages).valid) invalidReceiptIds.push(row.id); });
  const allReceipts = [...declarationHistory, ...generation, ...lineages, ...audits];
  const ids = allReceipts.map((row) => row.id);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  const targetKeys = declarations.map((row) => `${row.targetType}:${row.targetId}`);
  const duplicateTargets = [...new Set(targetKeys.filter((key, index) => targetKeys.indexOf(key) !== index))];
  const integrityValid = creativeWorkflow.integrity.valid && invalidReceiptIds.length === 0 && duplicateIds.length === 0 && duplicateTargets.length === 0;
  const latestAudit = audits[0] || null;
  const current = Boolean(integrityValid && latestAudit && latestAudit.creativeExportId === creativeWorkflow.latestExport?.id
    && latestAudit.handoffId === creativeWorkflow.latestHandoff?.id && latestAudit.acknowledgementId === creativeWorkflow.latestHandoffAcknowledgement?.id
    && Date.parse(latestAudit.validUntil) > Date.parse(generatedAt));
  const ready = Boolean(current && latestAudit.readyForRightsGovernedExport);
  return {
    schemaVersion: 'local-rights-provenance/v1', projectId: project.id || null, generatedAt, localOnly: true,
    status: !integrityValid ? 'degraded-integrity-invalid' : !creativeWorkflow.readyForRightsProvenanceAudit ? 'creative-terminal-state-required'
      : !latestAudit ? 'rights-audit-required' : !current ? 'rights-audit-stale' : ready ? 'rights-governed-export-cleared' : 'rights-remediation-required',
    creativeWorkflow, declarations, declarationHistory, generationProvenance: activeGeneration, generationHistory: generation, derivativeLineages: activeLineages, derivativeHistory: lineages, latestAudit,
    integrity: { valid: integrityValid, invalidReceiptIds: [...new Set(invalidReceiptIds)], duplicateIds: [...new Set([...duplicateIds, ...duplicateTargets])] },
    readyForRightsGovernedExport: ready, readyForExternalRelease: false, legalOpinion: false,
    summary: { declarationCount: declarations.length, declarationHistoryCount: declarationHistory.length, generationCount: generation.length, derivativeCount: lineages.length, auditCount: audits.length },
  };
}
