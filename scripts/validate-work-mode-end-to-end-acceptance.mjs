import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { SUPER_AGENT_WORK_MODES } from '../src/agents/workModes.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(root, '.tmp', `work-mode-end-to-end-${process.pid}`);
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  const api = createFileBackedAgentProjectApi({
    filePath: resolve(tempRoot, 'projects.json'),
    replaceWithSeed: true,
  });
  const acceptedModes = [];
  for (const [workMode, definition] of Object.entries(SUPER_AGENT_WORK_MODES)) {
    const projectId = `mode_${workMode.replace(/[^a-z0-9]+/gi, '_')}`;
    let response = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        projectId,
        name: `${definition.label} acceptance`,
        brief: `Run the complete local ${definition.label} acceptance workflow.`,
        workMode,
        includeReadModels: false,
      },
    });
    assert(response.status === 200, `${workMode}: initiation failed with ${response.status}.`);
    let project = response.body.project;
    for (const task of project.tasks) {
      response = api.handle({
        method: 'POST',
        path: `/projects/${projectId}/agents/${encodeURIComponent(task.assignee)}/submissions`,
        body: {
          taskId: task.id,
          artifactType: task.artifactType,
          reviewerAgentId: task.reviewerId,
          title: `${task.artifactType} acceptance artifact`,
          summary: `Evidence-bearing ${task.artifactType} for ${workMode}.`,
          body: `Local acceptance artifact for ${workMode}: ${task.artifactType}.`,
          includeReadModels: false,
        },
      });
      assert(response.status === 200, `${workMode}: ${task.artifactType} submission failed with ${response.status}: ${response.body?.message || response.body?.error || ''}`);
      const submissionId = response.body.submission?.id;
      assert(submissionId, `${workMode}: ${task.artifactType} did not return a submission id.`);
      response = api.handle({
        method: 'POST',
        path: `/projects/${projectId}/submissions/${encodeURIComponent(submissionId)}/reviews`,
        body: {
          reviewerAgentId: task.reviewerId,
          verdict: 'accepted',
          comments: `Independent review accepted ${task.artifactType}.`,
          includeReadModels: false,
        },
      });
      assert(response.status === 200 && response.body.submission?.reviewStatus === 'accepted', `${workMode}: ${task.artifactType} independent review failed.`);
      project = response.body.project;
    }
    response = api.handle({ method: 'GET', path: `/projects/${projectId}/work-mode-acceptance` });
    assert(response.status === 200 && response.body.workModeAcceptance?.readyForAcceptance === false, `${workMode}: unresolved escalation must block acceptance.`);
    for (const escalation of project.workModeContract.escalationPlan || []) {
      response = api.handle({
        method: 'POST',
        path: `/projects/${projectId}/work-mode-escalations/${encodeURIComponent(escalation.id)}/resolve`,
        body: {
          actorId: escalation.ownerPersonaSlug,
          reason: `Local ${workMode} acceptance reviewed ${escalation.id}.`,
          includeReadModels: false,
        },
      });
      assert(response.status === 200, `${workMode}: ${escalation.id} resolution failed with ${response.status}.`);
      project = response.body.project;
    }
    response = api.handle({ method: 'GET', path: `/projects/${projectId}/work-mode-acceptance` });
    assert(response.status === 200 && response.body.workModeAcceptance?.readyForAcceptance === true, `${workMode}: final work-mode acceptance remained blocked.`);
    acceptedModes.push(workMode);
  }
  assert(acceptedModes.length === 5, 'All five work modes must complete their own backend acceptance path.');
  console.log(`Work-mode end-to-end acceptance passed: ${acceptedModes.join(', ')}.`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
