import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createKickoffProjectFromMeeting } from '../src/agents/agentProjectService.js';

const projectId = 'local_task_trace_chain_project';
const traceId = 'trace_local_task_001';
const now = '2026-07-10T18:30:00.000Z';

function createSeed() {
  const seed = createKickoffProjectFromMeeting({
    projectId,
    name: 'Local task trace chain',
    brief: 'Correlate one local Agent task without a remote collector.',
    now,
    team: [
      { id: 'leader', name: 'Ada Lovelace', title: 'Technical Leader', skill: 'system design' },
      { id: 'reviewer', name: 'Grace Hopper', title: 'Independent Reviewer', skill: 'verification' },
    ],
  });
  const taskId = 'local_trace_task';
  return {
    ...seed,
    project: {
      ...seed.project,
      tasks: [{
        id: taskId,
        text: 'Produce one traceable local task artifact.',
        assignee: 'Ada Lovelace',
        ownerId: 'leader',
        status: 'in-progress',
        workPulseCount: 0,
      }],
      agentStates: {
        ...seed.project.agentStates,
        leader: {
          ...(seed.project.agentStates?.leader || {}),
          currentPlan: { taskId, focus: 'Produce a traceable local artifact.' },
          obligations: [{ id: 'local_trace_obligation', taskId, text: 'Produce the artifact.', status: 'open' }],
        },
      },
    },
  };
}

test('propagates the server-owned HTTP trace into a durable Agent work cycle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-local-task-trace-'));
  const seed = createSeed();
  const runtime = createAgentProjectHttpServer({
    filePath: join(directory, 'projects.json'),
    projects: [seed.project],
    messages: seed.messages,
    replaceWithSeed: true,
    providerPolicy: {
      enabled: true,
      mode: 'enforced',
      allowedSearchProviders: ['local-trace-search'],
      defaultToolGrants: ['search:evidence'],
      maxRequestsPerProjectHour: 5,
      dailyBudgetCents: 100,
      searchCostCentsPerRequest: 1,
      retryAttempts: 0,
    },
    searchProvider: {
      status: () => ({
        provider: 'local-trace-search',
        enabled: true,
        configured: true,
        runtimeEnabled: true,
        apiKeySource: 'not-required',
        hasEndpoint: true,
      }),
      search: async () => ({
        ok: true,
        provider: 'local-trace-search',
        searchMode: 'local-test',
        sources: [{ title: 'Local trace source', url: 'file:///local/trace-source' }],
        findings: ['The local trace chain is testable.'],
        confidence: 'high',
      }),
    },
  });
  const listener = await runtime.listen();
  try {
    const response = await fetch(`${listener.url}/projects/${projectId}/agents/leader/work-cycle`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hofs-request-id': traceId,
      },
      body: JSON.stringify({
        traceId: 'body_trace_spoofed',
        requestSpanId: 'span_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        now,
        includeReadModels: false,
        useProviderEvidenceSearch: true,
        requireProviderEvidenceSearch: true,
        submitWorkArtifact: true,
        submitWorkArtifactOn: 'always',
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-hofs-trace-id'), traceId);
    const workRequestSpanId = response.headers.get('x-hofs-span-id');
    assert.match(workRequestSpanId, /^span_[a-f0-9]{32}$/);
    const body = await response.json();
    assert.equal(body.cycle.traceId, traceId);

    const project = runtime.api.service.getProject(projectId);
    assert.equal(project.agentWorkerLedger[0].traceId, traceId);
    assert.equal(project.agentWorkerLedger[0].requestSpanId, workRequestSpanId);
    assert.equal(body.providerUsage.traceId, traceId);
    assert.equal(body.evidenceSearch.traceId, traceId);
    assert.equal(body.submission.traceId, traceId);
    assert.equal(body.artifact.traceId, traceId);

    const reviewResponse = await fetch(`${listener.url}/projects/${projectId}/submissions/${body.submission.id}/reviews`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hofs-request-id': 'trace_review_http_request_002',
      },
      body: JSON.stringify({
        reviewerAgentId: 'reviewer',
        verdict: 'accepted',
        comments: 'The local trace chain is complete.',
        now: '2026-07-10T18:31:00.000Z',
        includeReadModels: false,
      }),
    });
    assert.equal(reviewResponse.status, 200);
    const reviewRequestSpanId = reviewResponse.headers.get('x-hofs-span-id');
    assert.match(reviewRequestSpanId, /^span_[a-f0-9]{32}$/);
    const reviewBody = await reviewResponse.json();
    assert.equal(reviewBody.review.traceId, traceId);
    assert.equal(reviewBody.review.requestTraceId, 'trace_review_http_request_002');
    assert.equal(reviewBody.review.requestSpanId, reviewRequestSpanId);

    const traceResponse = await fetch(`${listener.url}/projects/${projectId}/traces/${traceId}`);
    assert.equal(traceResponse.status, 200);
    const traceBody = await traceResponse.json();
    assert.equal(traceBody.projectTrace.schemaVersion, 'local-project-trace/v2');
    assert.equal(traceBody.projectTrace.traceId, traceId);
    assert.equal(traceBody.projectTrace.summary.agentCycleCount, 1);
    assert.equal(traceBody.projectTrace.summary.providerUsageCount, 1);
    assert.equal(traceBody.projectTrace.summary.evidenceSearchCount, 1);
    assert.equal(traceBody.projectTrace.summary.submissionCount, 1);
    assert.equal(traceBody.projectTrace.summary.artifactCount, 1);
    assert.equal(traceBody.projectTrace.summary.reviewCount, 1);
    assert.equal(traceBody.projectTrace.integrity.valid, true, JSON.stringify(traceBody.projectTrace.integrity));
    assert.equal(traceBody.projectTrace.integrity.currentGraphSealed, true);
    assert.equal(traceBody.projectTrace.receiptCount, 2);
    assert.ok(traceBody.projectTrace.spans.some((span) => span.name === 'agent-work-cycle' && span.id === workRequestSpanId));
    assert.ok(traceBody.projectTrace.spans.some((span) => span.name === 'provider-search' && span.parentSpanId));
    assert.ok(traceBody.projectTrace.spans.some((span) => span.name === 'independent-review' && span.id === reviewRequestSpanId && span.links.some((link) => link.startsWith('request_trace_hash_'))));
    const traceJson = JSON.stringify(traceBody.projectTrace);
    assert.equal(traceJson.includes('The local trace chain is testable.'), false);
    assert.equal(traceJson.includes('The local trace chain is complete.'), false);
    assert.equal(traceJson.includes('Produce one traceable local task artifact.'), false);
  } finally {
    await runtime.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects unsafe inbound trace values and tracks concurrent reuse with unique request spans', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let started = 0;
  let allStartedResolve;
  const allStarted = new Promise((resolve) => { allStartedResolve = resolve; });
  const runtime = createAgentProjectHttpServer({
    api: {
      handleAsync: async (request) => {
        started += 1;
        if (started === 3) allStartedResolve();
        await gate;
        return { status: 200, body: { traceId: request.traceId, requestSpanId: request.requestSpanId } };
      },
    },
  });
  const listener = await runtime.listen({ port: 0 });
  try {
    const unsafe = fetch(`${listener.url}/unsafe`, { headers: { 'x-hofs-trace-id': 'Bearer sk-private secret value' } });
    const sharedA = fetch(`${listener.url}/shared-a`, { headers: { 'x-hofs-trace-id': 'trace_shared_concurrent_001' } });
    const sharedB = fetch(`${listener.url}/shared-b`, { headers: { 'x-hofs-trace-id': 'trace_shared_concurrent_001' } });
    await allStarted;
    assert.equal(runtime.runtimeLifecycleStatus().activeRequestCount, 3);
    release();
    const [unsafeResponse, responseA, responseB] = await Promise.all([unsafe, sharedA, sharedB]);
    assert.match(unsafeResponse.headers.get('x-hofs-trace-id'), /^trace_[0-9a-f-]{36}$/);
    assert.equal(unsafeResponse.headers.get('x-hofs-trace-id').includes('private'), false);
    assert.equal(responseA.headers.get('x-hofs-trace-id'), 'trace_shared_concurrent_001');
    assert.equal(responseB.headers.get('x-hofs-trace-id'), 'trace_shared_concurrent_001');
    assert.notEqual(responseA.headers.get('x-hofs-span-id'), responseB.headers.get('x-hofs-span-id'));
  } finally {
    release();
    await runtime.close();
  }
});
