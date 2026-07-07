import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertBoundedArtifactPath(artifact = {}, label = 'artifact') {
  const relativePath = artifact.relativePath || artifact.storageProof?.relativePath || '';
  const absolutePath = artifact.absolutePath || artifact.path || '';
  const fileName = basename(relativePath);
  assert(relativePath && absolutePath, `${label} must expose relative and absolute artifact paths.`);
  assert(existsSync(absolutePath), `${label} must exist on disk.`);
  assert(fileName.length <= 96, `${label} filename must stay bounded for Windows path reliability. Actual: ${fileName.length}`);
  assert(relativePath.length <= 180, `${label} relative path must stay bounded. Actual: ${relativePath.length}`);
  assert(absolutePath.length <= 240, `${label} absolute path must stay below legacy Windows path limits. Actual: ${absolutePath.length}`);
  assert(!/coordinate-multi-persona-autonomous-product-team-brainstorm/.test(relativePath), `${label} path must not embed long task text.`);
  assert(artifact.storageProof?.schemaVersion === 'agent-artifact-storage-proof/v1', `${label} must preserve artifact storage proof.`);
  assert(artifact.storageProof?.checksum && artifact.storageProof?.contentChecksum, `${label} must preserve proof and content checksums.`);
  return { relativePath, absolutePath, fileName };
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `agent-artifact-path-contract-validate-${process.pid}`);
const storePath = resolve(tempRoot, 'store.json');
const runtimeRoot = resolve(tempRoot, 'runtime');
const projectId = 'artifact_path_contract_project_with_realistic_long_local_mvp_id';
const longTaskText = [
  'Coordinate multi persona autonomous product team brainstorm',
  'evidence judgement draft artifact reviewer revision and final delivery',
  'with enough descriptive language to trigger historical long artifact filenames',
].join(' ');

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const projectRuntime = createLocalProjectRuntime({ rootPath: runtimeRoot });
  const api = createFileBackedAgentProjectApi({
    filePath: storePath,
    replaceWithSeed: true,
    projectRuntime,
  });

  let response = api.handle({
    method: 'POST',
    path: '/projects/initiate',
    body: {
      includeReadModels: false,
      projectId,
      name: 'Artifact Path Contract Validation',
      brief: 'Validate bounded artifact paths while preserving proofed product-team submissions.',
      team: [
        { id: 'jobs', name: 'Steve Jobs', role: 'Product Lead', skill: 'product framing' },
        { id: 'curie', name: 'Marie Curie', role: 'Evidence Reviewer', skill: 'evidence review' },
      ],
      selectedLeaderId: 'jobs',
      reviewerId: 'curie',
      tasks: [
        {
          id: `${projectId}_task_long_path`,
          text: longTaskText,
          assignee: 'Steve Jobs',
          status: 'pending',
        },
      ],
      now: '2026-06-01T10:00:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.project?.id === projectId, 'Validation project must be created through the backend API.');

  response = api.handle({
    method: 'POST',
    path: '/workers/agents/due',
    body: {
      includeReadModels: false,
      forceDue: true,
      forceProjectIds: [projectId],
      maxProjects: 1,
      maxAgentsPerProject: 1,
      submitWorkArtifacts: true,
      workArtifactType: 'progress-brief',
      submitWorkArtifactOn: 'always',
      now: '2026-06-01T10:05:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.processed?.length === 1, 'Agent due worker must process one Agent.');
  const workArtifact = response.body.processed[0]?.artifact;
  const workPath = assertBoundedArtifactPath(workArtifact, 'Agent work-cycle artifact');
  const workContent = await readFile(workPath.absolutePath, 'utf8');
  assert(
    workContent.includes('autonomous progress brief') && workContent.includes('Worker cycle:'),
    'Agent work-cycle artifact content must remain readable and keep worker proof.',
  );

  response = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/agents/jobs/submissions`,
    body: {
      includeReadModels: false,
      artifactType: 'product-brief',
      title: `${longTaskText} as a submitted product brief with intentionally long user-facing title`,
      summary: 'A proofed backend submission with bounded local file path and durable checksum.',
      body: '# Product brief\n\nThis artifact keeps the user-facing title in the submission contract while the workspace file path remains bounded and checksummed.',
      reviewerAgentId: 'curie',
      now: '2026-06-01T10:06:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.submission?.id, 'Agent submission route must create a submission.');
  const submissionPath = assertBoundedArtifactPath(response.body.artifact, 'Agent submission artifact');
  assert(
    response.body.submission.artifactStorageProofChecksum === response.body.artifact.storageProof.checksum,
    'Submission must link to the same artifact storage proof checksum.',
  );
  assert(!submissionPath.fileName.includes(response.body.submission.id), 'Submission artifact filename must not embed the full submission id.');

  response = await api.handleAsync({
    method: 'POST',
    path: `/projects/${projectId}/agents/jobs/artifact-drafts`,
    body: {
      includeReadModels: false,
      artifactType: 'implementation-plan',
      instruction: longTaskText,
      useModel: false,
      submit: true,
      reviewerAgentId: 'curie',
      now: '2026-06-01T10:07:00.000Z',
    },
  });
  assert(response.status === 200 && response.body.submission?.isGeneratedDraft === true, 'Artifact draft route must submit a generated draft.');
  assertBoundedArtifactPath(response.body.artifact, 'Generated draft submission artifact');

  const storedProject = JSON.parse(await readFile(storePath, 'utf8')).projects.find((project) => project.id === projectId);
  assert(
    storedProject?.agentSubmissions?.every((submission) => submission.artifactStorageProofChecksum && submission.workspaceFileProof?.checksum),
    'Stored project submissions must retain workspace file proof after path bounding.',
  );

  console.log('Agent artifact path contract validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
