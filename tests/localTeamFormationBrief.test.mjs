import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createAgentProjectApi, createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';
import {
  buildLocalTeamFormationBrief,
  verifyLocalTeamFormationBrief,
} from '../src/agents/localTeamFormationBrief.js';
import { composeWorkModeTeam } from '../src/agents/workModes.js';

test('explains role coverage, objective risks, delegation readiness, and explicit gaps without objective content', () => {
  const objective = 'Migrate the production database with security review, rollback, and zero-downtime deployment.';
  const team = composeWorkModeTeam({ workMode: 'technical-delivery', objective });
  const brief = buildLocalTeamFormationBrief({ workModeTeam: team, now: '2026-07-10T23:30:00.000Z' });
  assert.equal(brief.schemaVersion, 'local-team-formation-brief/v1');
  assert.equal(brief.workMode, 'technical-delivery');
  assert.equal(brief.delegationReady, true);
  assert.equal(brief.roleCoverage.length, team.roles.length);
  assert.ok(brief.roleCoverage.every((row) => row.personaSlug && row.capabilityScore >= 70 && row.selectionRationale));
  assert.ok(brief.roleCoverage.some((row) => row.ownedArtifactTypes.includes('rollback-plan')));
  assert.ok(brief.objectiveNeedSignalIds.includes('deployment-change'));
  assert.ok(brief.objectiveNeedSignalIds.includes('data-migration'));
  assert.ok(brief.riskRows.some((row) => row.id === 'security-release' && row.ownerPersonaSlug));
  assert.equal(brief.blockingGaps.length, 0);
  assert.equal(JSON.stringify(brief).includes(objective), false);
  assert.equal(verifyLocalTeamFormationBrief(brief).valid, true);

  const blockedTeam = composeWorkModeTeam({
    workMode: 'technical-delivery',
    objective,
    availablePersonaSlugs: ['chanel'],
  });
  const blocked = buildLocalTeamFormationBrief({ workModeTeam: blockedTeam });
  assert.equal(blocked.delegationReady, false);
  assert.ok(blocked.blockingGaps.some((gap) => gap.type === 'role-coverage-gap'));
  assert.ok(blocked.nextActions.some((action) => action.id === 'add-missing-specialists'));

  const tampered = structuredClone(brief);
  tampered.delegationReady = false;
  assert.equal(verifyLocalTeamFormationBrief(tampered).valid, false);
});

test('exposes the same formation brief before kickoff and after file-store restart', async () => {
  const request = {
    method: 'POST',
    path: '/work-modes/technical-delivery/team',
    body: { objective: 'Deploy a secure database migration with rollback.' },
  };
  const memoryApi = createAgentProjectApi({ service: createAgentProjectService() });
  for (const response of [memoryApi.handle(request), await memoryApi.handleAsync(request)]) {
    assert.equal(response.status, 200);
    assert.equal(response.body.teamFormationBrief.delegationReady, true);
    assert.equal(response.body.teamFormationBrief.workMode, 'technical-delivery');
  }

  const directory = mkdtempSync(join(tmpdir(), 'hofs-team-formation-'));
  const filePath = join(directory, 'projects.json');
  try {
    let api = createFileBackedAgentProjectApi({ filePath, replaceWithSeed: true });
    let response = await api.handleAsync({
      method: 'POST',
      path: '/projects/initiate',
      body: {
        includeReadModels: false,
        projectId: 'team_formation_restart_project',
        name: 'Team formation restart project',
        brief: 'Deploy a secure database migration with rollback.',
        workMode: 'technical-delivery',
        now: '2026-07-10T23:40:00.000Z',
      },
    });
    assert.equal(response.status, 200);
    response = await api.handleAsync({
      method: 'GET',
      path: '/projects/team_formation_restart_project/team-formation-readiness',
      body: { now: '2026-07-10T23:41:00.000Z' },
    });
    assert.equal(response.status, 200);
    const checksum = response.body.teamFormationReadiness.checksum;
    assert.equal(response.body.teamFormationReadiness.delegationReady, true);

    api = createFileBackedAgentProjectApi({ filePath });
    response = await api.handleAsync({
      method: 'GET',
      path: '/projects/team_formation_restart_project/team-formation-readiness',
      body: { now: '2026-07-10T23:42:00.000Z' },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.teamFormationReadiness.checksum, checksum);
    assert.equal(response.body.teamFormationReadiness.integrity.valid, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
