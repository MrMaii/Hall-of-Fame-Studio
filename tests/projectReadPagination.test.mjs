import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { createLocalProjectRuntime } from '../src/agents/localProjectRuntime.js';

test('timeline and event reads expose bounded newest-first pages without losing totals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-project-read-page-'));
  try {
    const api = createFileBackedAgentProjectApi({
      filePath: join(directory, 'store.json'),
      replaceWithSeed: true,
      projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
    });
    const initiated = api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'paged-project',
        name: 'Paged project',
        team: [{ id: 'leader', name: 'Leader', role: 'Leader' }],
        selectedLeaderId: 'leader',
        tasks: [{ id: 'task', text: 'Produce a result', assignee: 'leader' }],
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(initiated.status, 200);

    const timeline = api.handle({ method: 'GET', path: '/projects/paged-project/timeline?limit=2' });
    assert.equal(timeline.status, 200);
    assert.ok(timeline.body.logs.length <= 2);
    assert.equal(timeline.body.logCount >= timeline.body.logs.length, true);
    assert.equal(timeline.body.page.limit, 2);
    assert.equal(typeof timeline.body.page.hasMore, 'boolean');

    const events = api.handle({ method: 'GET', path: '/projects/paged-project/events?limit=2' });
    assert.equal(events.status, 200);
    assert.ok(events.body.eventLedger.length <= 2);
    assert.equal(events.body.eventCount >= events.body.eventLedger.length, true);
    assert.equal(events.body.page.limit, 2);

    const dashboardProject = api.handle({ method: 'GET', path: '/projects/paged-project?view=dashboard' });
    assert.equal(dashboardProject.status, 200);
    assert.equal(dashboardProject.body.project.id, 'paged-project');
    assert.ok(Array.isArray(dashboardProject.body.project.team));
    assert.ok(Array.isArray(dashboardProject.body.project.tasks));
    assert.equal(Object.hasOwn(dashboardProject.body.project, 'eventLedger'), false);
    assert.equal(Object.hasOwn(dashboardProject.body.project, 'logs'), false);
    assert.equal(Object.hasOwn(dashboardProject.body.project, 'projectSettingsAudit'), false);
    assert.equal(Object.hasOwn(dashboardProject.body, 'messages'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('Dashboard core sync requests a bounded recent timeline and event page', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(appSource.includes('recentLimit: 200'));
  assert.ok(appSource.includes("const pageQuery = recentLimit ? `?limit=${Math.max(1, Number(recentLimit) || 1)}` : '';"));
  assert.ok(appSource.includes("`/projects/${encodeURIComponent(projectId)}?view=dashboard`"));
  assert.ok(appSource.includes('}, 30_000);'));
  assert.ok(appSource.includes("syncBackendAgentStateSummary({ silent: true, projectId, timeoutMs: 10_000, priority: 'user-visible', acceptResult, fallbackEnabled: false })"));
  assert.equal(appSource.includes("syncBackendManagerDashboard({ silent: true, projectId, timeoutMs: 10_000, priority: 'user-visible', acceptResult })"), false);
});

test('large proof and diagnostic packages load only from explicit Dashboard controls', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.equal(appSource.includes('syncBackendManagerReadyPackage({ silent: true, projectId: activeProject.id })'), false);
  assert.equal(appSource.includes('syncBackendManagerScenarioWalkthrough({ silent: true, projectId: activeProject.id })'), false);
  assert.equal(appSource.includes('syncBackendManagerCommandCenter({ silent: true, projectId: activeProject.id })'), false);
  assert.ok(appSource.includes('onSyncReadyPackage: () => syncBackendManagerReadyPackage({ silent: false })'));
  assert.ok(appSource.includes('onSyncScenarioWalkthrough: () => syncBackendManagerScenarioWalkthrough({ silent: false'));
});

test('the real HTTP adapter preserves query parameters for compact project and paged ledger reads', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hof-project-http-page-'));
  const server = createAgentProjectHttpServer({
    filePath: join(directory, 'store.json'),
    replaceWithSeed: true,
    projectRuntime: createLocalProjectRuntime({ rootPath: join(directory, 'runtime') }),
  });
  try {
    const initiated = server.api.handle({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'http-paged-project',
        name: 'HTTP paged project',
        team: [{ id: 'leader', name: 'Leader', role: 'Leader' }],
        selectedLeaderId: 'leader',
        tasks: [{ id: 'task', text: 'Produce a result', assignee: 'leader' }],
        now: '2026-07-20T10:00:00.000Z',
      },
    });
    assert.equal(initiated.status, 200);
    const runtime = await server.listen({ host: '127.0.0.1', port: 0 });
    const project = await (await fetch(`${runtime.url}/projects/http-paged-project?view=dashboard`)).json();
    const events = await (await fetch(`${runtime.url}/projects/http-paged-project/events?limit=2`)).json();

    assert.equal(Object.hasOwn(project.project, 'eventLedger'), false);
    assert.ok(events.eventLedger.length <= 2);
    assert.equal(events.page.limit, 2);
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
