import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('binding a workspace recovers artifacts created before the workspace was available', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-workspace-recovery-'));
  const storePath = join(directory, 'store.json');
  const runtimeRoot = join(directory, 'runtime');
  const workspacePath = join(directory, 'Research on Team Strengths');
  const projectId = 'workspace-recovery-project';

  try {
    const runtime = createLocalProjectRuntime({ rootPath: runtimeRoot });
    const api = createFileBackedAgentProjectApi({
      filePath: storePath,
      replaceWithSeed: true,
      projectRuntime: runtime,
    });

    let response = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId,
        name: 'Workspace Recovery Project',
        brief: 'Recover Agent work produced before a local workspace was bound.',
        team: [{ id: 'researcher', name: 'Researcher', role: 'Researcher' }],
        selectedLeaderId: 'researcher',
        reviewerId: 'researcher',
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(response.status, 200);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/agents/researcher/work-cycle`,
      body: {
        includeReadModels: false,
        submitWorkArtifact: true,
        submitWorkArtifactOn: 'always',
        now: '2026-07-20T10:01:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.artifact?.existsOnDisk, true);
    assert.equal(response.body.artifact?.workspaceRelativePath, null);
    const artifactRelativePath = response.body.artifact.relativePath;
    const recoveredWorkspaceRelativePath = artifactRelativePath.startsWith('agent-artifacts/')
      ? artifactRelativePath
      : `agent-artifacts/${artifactRelativePath}`;
    assert.ok(existsSync(response.body.artifact.absolutePath));

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/workspace/bind`,
      body: {
        workspacePath,
        createIfMissing: true,
        now: '2026-07-20T10:02:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.localRuntime?.workspacePath, workspacePath);
    assert.ok(
      existsSync(join(workspacePath, recoveredWorkspaceRelativePath)),
      'The pre-binding artifact must be restored into the newly bound workspace.',
    );

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/agents/researcher/work-cycle`,
      body: {
        includeReadModels: false,
        submitWorkArtifact: true,
        submitWorkArtifactOn: 'always',
        now: '2026-07-20T10:03:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    const nextWorkspaceRelativePath = response.body.artifact.relativePath.startsWith('agent-artifacts/')
      ? response.body.artifact.relativePath
      : `agent-artifacts/${response.body.artifact.relativePath}`;
    assert.equal(response.body.artifact?.workspaceRelativePath, nextWorkspaceRelativePath);
    assert.ok(existsSync(join(workspacePath, nextWorkspaceRelativePath)));

    const reloadedApi = createFileBackedAgentProjectApi({
      filePath: storePath,
      projectRuntime: createLocalProjectRuntime({ rootPath: runtimeRoot }),
    });
    response = reloadedApi.handle({
      method: 'GET',
      path: `/projects/${projectId}/local-runtime`,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.localRuntime?.workspacePath, workspacePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Agent artifacts keep the human task title as the local Workspace filename', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-workspace-artifact-name-'));
  const workspacePath = join(directory, '青少年心理健康研究');
  const projectId = 'workspace-readable-artifact-name';

  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'store.json'),
      replaceWithSeed: true,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
    });
    let response = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId,
        name: '青少年心理健康与每日工作时间关联研究',
        brief: '研究青少年心理健康指数与每天工作时间之间的关联。',
        team: [{ id: 'researcher', name: '研究员', role: '研究员' }],
        tasks: [{ id: 'research-plan', text: '制定青少年心理健康研究计划', assignee: 'researcher', status: 'pending' }],
        selectedLeaderId: 'researcher',
        reviewerId: 'researcher',
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(response.status, 200);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/workspace/bind`,
      body: { workspacePath, createIfMissing: true, now: '2026-07-20T10:01:00.000Z' },
    });
    assert.equal(response.status, 200);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/agents/researcher/work-cycle`,
      body: {
        includeReadModels: false,
        taskId: 'research-plan',
        submitWorkArtifact: true,
        submitWorkArtifactOn: 'always',
        now: '2026-07-20T10:02:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.artifact.fileName, '制定青少年心理健康研究计划.md');
    assert.equal(response.body.artifact.relativePath, '制定青少年心理健康研究计划.md');
    assert.equal(response.body.artifact.workspaceRelativePath, 'agent-artifacts/制定青少年心理健康研究计划.md');
    assert.ok(existsSync(join(workspacePath, 'agent-artifacts', '制定青少年心理健康研究计划.md')));
    const artifactBody = readFileSync(join(workspacePath, 'agent-artifacts', '制定青少年心理健康研究计划.md'), 'utf8');
    assert.match(artifactBody, /工作草稿|Working draft/);
    assert.match(artifactBody, /这份文件要解决什么|What this file must resolve/);
    assert.doesNotMatch(artifactBody, /Worker cycle|Trigger:|Cadence:|Timeline proof|Chat proof|Event proof/);

    const listing = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/workspace/list`,
      body: { path: 'agent-artifacts', recursive: false },
    });
    assert.equal(listing.status, 200);
    assert.deepEqual(listing.body.files.map(file => file.name), ['制定青少年心理健康研究计划.md']);

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/workspace/move`,
      body: {
        fromPath: 'agent-artifacts/制定青少年心理健康研究计划.md',
        toPath: 'agent-artifacts/研究计划-最终稿.md',
      },
    });
    assert.equal(response.status, 200);
    rmSync(join(workspacePath, 'agent-artifacts', '研究计划-最终稿.md'));

    response = api.handle({
      method: 'POST',
      path: `/projects/${projectId}/workspace/bind`,
      body: { workspacePath, createIfMissing: false, now: '2026-07-20T10:03:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.ok(existsSync(join(workspacePath, 'agent-artifacts', '研究计划-最终稿.md')));
    assert.equal(existsSync(join(workspacePath, 'agent-artifacts', '制定青少年心理健康研究计划.md')), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
