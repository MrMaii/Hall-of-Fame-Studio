import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `evidence-index-readiness-contract-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const projectId = 'evidence_index_readiness_validation';
const team = [
  { id: 'jobs', name: 'Steve Jobs', title: 'Product Lead' },
  { id: 'curie', name: 'Marie Curie', title: 'Evidence Reviewer' },
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
      name: 'Evidence Index Readiness Validation',
      brief: 'Validate local evidence and artifact index readiness without claiming production vector storage.',
      team,
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/evidence-index-readiness`,
  });
  assert(response.status === 200, `Initial evidence index readiness returned ${response.status}.`);
  let readiness = response.body.evidenceIndexReadiness;
  assert(readiness?.schemaVersion === 'evidence-index-readiness/v1', 'Evidence index readiness must expose its schema version.');
  assert(readiness.readyForLocalMvp === false, 'Empty projects must not be local-index ready.');
  assert(readiness.readyForProduction === false, 'Evidence index readiness must not claim production vector readiness.');

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/curie/evidence-searches`,
    body: {
      includeReadModels: false,
      query: 'generic product team evidence index validation',
      purpose: 'Validate local evidence index readiness.',
      sources: [{
        id: 'source_1',
        title: 'Evidence source',
        url: 'https://example.test/evidence?token=SHOULD_REDACT',
        summary: 'Local validation source.',
        confidence: 'high',
      }],
      findings: ['Local evidence nodes can be indexed with source snapshots.'],
      confidence: 'high',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.evidenceSearch?.sourceSnapshotIds?.length === 1, 'Evidence search must create a checksummed source snapshot.');

  const evidenceSearch = response.body.evidenceSearch;
  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/jobs/submissions`,
    body: {
      includeReadModels: false,
      artifactType: 'product-brief',
      title: 'Evidence index product brief',
      summary: 'Brief linked to evidence index validation.',
      body: [
        '# Evidence index product brief',
        '',
        'This artifact should be indexable with storage proof.',
        'It links evidence, source snapshots, and a manager-visible submission route.',
      ].join('\n'),
      sourceRefs: evidenceSearch.sources,
      now: '2026-06-01T10:10:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.submission?.artifactStorageProof?.checksum, 'Agent submission must create an artifact storage proof.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/evidence-index-readiness`,
  });
  assert(response.status === 200, `Final evidence index readiness returned ${response.status}.`);
  readiness = response.body.evidenceIndexReadiness;
  assert(readiness.schemaVersion === 'evidence-index-readiness/v1', 'Final readiness must preserve schema version.');
  assert(readiness.readyForLocalMvp === true, 'Evidence plus artifact proof must make the local evidence index ready.');
  assert(readiness.readyForPrivatePilot === true, 'Local evidence index readiness should be private-pilot usable.');
  assert(readiness.readyForProduction === false, 'Production vector storage must remain blocked.');
  assert(readiness.summary.evidenceSearchCount >= 1, 'Readiness summary must count evidence searches.');
  assert(readiness.summary.submissionCount >= 1, 'Readiness summary must count Agent submissions.');
  assert(readiness.summary.sourceSnapshotCount >= 1, 'Readiness summary must count source snapshots.');
  assert(readiness.summary.artifactStorageProofCount >= 1, 'Readiness summary must count artifact storage proofs.');
  assert(readiness.backendRoutes.evidenceIndexReadiness === `/projects/${projectId}/evidence-index-readiness`, 'Readiness must expose its backend route.');
  assert(readiness.rows.some((row) => row.recordType === 'evidence-search' && row.route?.includes('/evidence-searches/')), 'Index rows must link evidence search routes.');
  assert(readiness.rows.some((row) => row.recordType === 'agent-submission' && row.route?.includes('/submissions/')), 'Index rows must link Agent submission routes.');
  assert(readiness.gates.some((gate) => gate.id === 'managed-vector-adapter-production-blocked' && gate.status === 'blocked'), 'Readiness must keep managed vector adapter as a production blocker.');
  assert(!JSON.stringify(readiness).includes('SHOULD_REDACT'), 'Evidence index readiness must redact raw URL tokens.');

  response = api.handle({
    method: 'GET',
    path: `/projects/${projectId}/project-settings`,
  });
  assert(response.status === 200, `Project settings returned ${response.status}.`);
  const vectorStoreRow = response.body.projectSettings?.integrationCapabilities?.rows?.find((row) => row.id === 'vector-store');
  assert(vectorStoreRow?.requiredBackendRoute === `/projects/${projectId}/evidence-index-readiness`, 'Vector Store settings row must point to evidence-index-readiness.');
  assert(vectorStoreRow.status === 'backend-backed' && vectorStoreRow.editable === false, 'Vector Store must be a backend-backed read-only readiness contract until the managed adapter exists.');
  assert(vectorStoreRow.readyForProduction === false, 'Vector Store settings row must not claim production vector readiness.');

  const store = JSON.parse(await readFile(storePath, 'utf8'));
  const storedProject = store.projects.find((project) => project.id === projectId);
  assert(storedProject?.evidenceSearches?.length >= 1, 'File-backed store must persist evidence searches.');
  assert(storedProject?.agentSubmissions?.length >= 1, 'File-backed store must persist Agent submissions.');
  assert(storedProject?.evidenceSourceSnapshots?.length >= 1, 'File-backed store must persist evidence source snapshots.');

  console.log('Evidence index readiness contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
