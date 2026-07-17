import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  appendProjectEvents,
  createProjectLedgerEvent,
  handleFeatureChangeRequest,
  verifyProjectEventLedger,
} from '../src/agents/agentRuntime.js';
import { createAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const languageProviderSource = readFileSync(new URL('../src/i18n/index.jsx', import.meta.url), 'utf8');

test('manager demo preserves the active local UI language when its project is persisted', () => {
  const launchStart = appSource.indexOf('const launchManagerDemoProject = () => {');
  const launchEnd = appSource.indexOf('const buildInitiationKickoffPayload', launchStart);
  assert.ok(launchStart >= 0 && launchEnd > launchStart, 'manager demo launcher must exist');

  const launchSource = appSource.slice(launchStart, launchEnd);
  assert.match(
    launchSource,
    /const baseProject = \{[\s\S]*?language:\s*activeLanguage,/,
    'manager demo project must retain the language selected in the local UI',
  );
});

test('manager demo backend reads wait for the local project seed', () => {
  const guardedFunctions = [
    'syncLocalProjectMembership',
    'syncBackendProjectTranscripts',
    'syncBackendTimelineAndEvents',
    'syncBackendManagerCommandCenter',
    'syncBackendManagerScenarioTrail',
    'syncBackendManagerScenarioWalkthrough',
    'syncBackendManagerRequirementMatrix',
    'syncBackendSyncProtocolAudit',
  ];

  guardedFunctions.forEach((functionName) => {
    const functionStart = appSource.indexOf(`const ${functionName} = async`);
    const nextFunction = appSource.indexOf('\n  const ', functionStart + 1);
    assert.ok(functionStart >= 0, `${functionName} must exist`);
    assert.match(
      appSource.slice(functionStart, nextFunction),
      /await ensureBackendProjectSeedForReadModelSync\(/,
      `${functionName} must wait for the manager demo project seed before reading`,
    );
  });

  const seedStart = appSource.indexOf('const ensureBackendProjectSeed = async () => {');
  const seedEnd = appSource.indexOf('\n  const ', seedStart + 1);
  const seedSource = appSource.slice(seedStart, seedEnd);
  assert.match(
    seedSource,
    /if \(!isManagerDemoProject\(activeProject\)\) \{[\s\S]*?readBackendProjectSnapshotForWrite/,
    'manager demo seeding must skip the expected missing-project read and write the local fixture directly',
  );
});

test('DOM localization keeps source text so project language changes are reversible', () => {
  assert.match(languageProviderSource, /const localizedTextSources = new WeakMap\(\)/);
  assert.match(languageProviderSource, /value === previous\.rendered \? previous\.source : value/);
  assert.match(languageProviderSource, /localizedAttributeSources/);
});

test('manager dashboard API inherits the saved project language when no request override is provided', () => {
  const project = {
    id: 'manager_demo_api_language',
    name: 'English manager project',
    language: 'en',
    status: 'executing',
    team: [{ id: 'lead', name: 'Lead', role: 'Leader', isLeader: true }],
    tasks: [],
    logs: [],
  };
  const service = createAgentProjectService({ projects: [project] });
  const api = createAgentProjectApi({ service });
  const response = api.handle({ method: 'GET', path: `/projects/${project.id}/manager-dashboard` });
  assert.equal(response.status, 200);
  const expected = service.getManagerDashboard(project.id, { language: 'en' });
  assert.equal(response.body.managerCommandCenter.nextBestActionLabel, expected.managerCommandCenter.nextBestActionLabel);
  assert.equal(response.body.managerCommandCenter.nextBestActionLabel, 'Open kickoff meeting');
});

test('Chinese manager demo changes preserve the signed event ledger across sequential requests', () => {
  const baseProject = {
    id: 'p_manager_demo_zh_ledger',
    name: '中文经理演示',
    language: 'zh',
    team: [
      { id: 'lead', name: '负责人', role: 'Leader', title: 'Leader', isLeader: true },
      { id: 'builder', name: '执行者', role: 'System Architect', title: 'System Architect' },
      { id: 'reviewer', name: '复核者', role: 'Reviewer', title: 'Reviewer' },
    ],
    tasks: [],
    logs: [],
  };
  const projectWithExistingProof = appendProjectEvents(baseProject, [
    createProjectLedgerEvent({
      id: 'evt_manager_demo_zh_existing',
      time: '2026-07-15T19:59:00.000Z',
      summary: 'Leader confirmed the Project kickoff',
    }),
  ]);

  const firstChange = handleFeatureChangeRequest({
    project: projectWithExistingProof,
    text: '@all 增加第一次检查',
    now: '2026-07-15T20:00:00.000Z',
    language: 'zh',
  });

  assert.equal(
    verifyProjectEventLedger(firstChange.project).valid,
    true,
    'returning the first Chinese change must not rewrite already signed event content',
  );
  assert.doesNotThrow(() => handleFeatureChangeRequest({
    project: firstChange.project,
    text: '@all 增加第二次检查',
    now: '2026-07-15T20:01:00.000Z',
    language: 'zh',
  }));
});
