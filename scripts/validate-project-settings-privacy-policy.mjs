import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `project-settings-privacy-policy-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'project_settings_privacy_policy_validation';
const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
  { id: 'turing', name: 'Alan Turing', title: 'Systems Architect' },
];

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
  });

  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Project Settings Privacy Policy Validation',
      brief: 'Validate project-level privacy settings as a generic AI product-team backend receipt.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T09:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'PUT',
    path: `/projects/${projectId}/project-settings`,
    body: {
      includeReadModels: false,
      language: 'zh',
      updatedBy: 'Director',
      source: 'privacy-policy-validation-language',
      now: '2026-06-01T09:05:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.projectSettings?.language === 'zh', 'Project settings must persist an explicit language before privacy updates.');

  response = api.handle({
    method: 'PUT',
    path: `/projects/${projectId}/project-settings`,
    body: {
      includeReadModels: false,
      privacyPolicy: {
        retentionMode: 'session-only',
        providerLogMode: 'metadata-only',
        evidenceExportRequiresApproval: false,
        modelTrainingAllowed: true,
      },
      updatedBy: 'Director',
      source: 'privacy-policy-validation',
      now: '2026-06-01T09:10:00.000Z',
    },
  });
  assert(response.status === 200, `Privacy policy settings update returned ${response.status}.`);
  assert(response.body.projectSettings?.language === 'zh', 'Privacy-only settings updates must preserve the existing project language.');
  assert(response.body.projectSettings?.privacyPolicy?.schemaVersion === 'project-privacy-policy/v1', 'Project settings must expose a typed privacy policy read model.');
  assert(response.body.projectSettings.privacyPolicy.retentionMode === 'session-only', 'Project privacy policy must persist retention mode.');
  assert(response.body.projectSettings.privacyPolicy.providerLogMode === 'metadata-only', 'Project privacy policy must persist provider log mode.');
  assert(response.body.projectSettings.privacyPolicy.evidenceExportRequiresApproval === false, 'Project privacy policy must persist evidence export approval policy.');
  assert(response.body.projectSettings.privacyPolicy.modelTrainingAllowed === true, 'Project privacy policy must persist model training policy.');
  assert(response.body.projectSettings.privacyPolicy.readyForProduction === false, 'Local privacy policy receipt must not overclaim production compliance.');
  assert(response.body.projectSettingsAuditEntry?.privacyPolicy?.retentionMode === 'session-only', 'Privacy policy settings writes must produce an audit entry.');
  assert(response.body.log?.privacyPolicy?.providerLogMode === 'metadata-only', 'Privacy policy settings writes must produce a timeline log payload.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200 && response.body.projectSettings?.privacyPolicy?.retentionMode === 'session-only', 'Project settings GET must return the saved privacy policy.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/timeline`,
  });
  assert(response.status === 200 && response.body.logs?.some((row) => row.eventType === 'project-settings-updated' && row.privacyPolicy?.retentionMode === 'session-only'), 'Timeline must expose privacy policy settings proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/events`,
  });
  assert(response.status === 200 && response.body.eventLedger?.some((event) => event.type === 'project-settings-updated' && event.payload?.privacyPolicy?.providerLogMode === 'metadata-only'), 'Event ledger must expose privacy policy settings proof.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.projectSettings?.privacyPolicy?.retentionMode === 'session-only', 'File-backed store must persist the privacy policy.');
  assert(storedProject?.projectSettingsAudit?.some((entry) => entry.privacyPolicy?.retentionMode === 'session-only'), 'File-backed store must persist the privacy policy audit entry.');

  console.log('Project settings privacy policy validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
