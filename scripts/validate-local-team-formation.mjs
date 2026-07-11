import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFileBackedAgentProjectApi } from '../src/agents/agentProjectApi.js';
import { buildLocalTeamFormationBrief, verifyLocalTeamFormationBrief } from '../src/agents/localTeamFormationBrief.js';
import { composeWorkModeTeam } from '../src/agents/workModes.js';

function assert(condition, message) { if (!condition) throw new Error(message); }

const modes = ['learning', 'academic-writing', 'investigation', 'technical-delivery', 'creative-studio'];
const objectives = {
  learning: 'Build an accessible exam study plan with academic integrity.',
  'academic-writing': 'Produce a cited paper with claim evidence and revision review.',
  investigation: 'Investigate a sensitive personal-data incident with source evidence.',
  'technical-delivery': 'Deploy a secure database migration with rollback.',
  'creative-studio': 'Create a licensed brand campaign with accessibility review.',
};

for (const workMode of modes) {
  const team = composeWorkModeTeam({ workMode, objective: objectives[workMode] });
  const brief = buildLocalTeamFormationBrief({ workModeTeam: team });
  assert(brief.delegationReady, `${workMode} must compose a delegation-ready team.`);
  assert(brief.roleCoverage.every((row) => row.personaSlug && row.selectionRationale), `${workMode} roles must explain selection.`);
  assert(brief.riskRows.every((row) => row.ownerPersonaSlug), `${workMode} risks must have an owner.`);
  assert(verifyLocalTeamFormationBrief(brief).valid, `${workMode} brief checksum must verify.`);
  assert(!JSON.stringify(brief).includes(objectives[workMode]), `${workMode} brief must not retain raw objective text.`);
}

const blocked = buildLocalTeamFormationBrief({ workModeTeam: composeWorkModeTeam({
  workMode: 'technical-delivery',
  objective: objectives['technical-delivery'],
  availablePersonaSlugs: ['chanel'],
}) });
assert(!blocked.delegationReady && blocked.blockingGaps.some((gap) => gap.type === 'role-coverage-gap'), 'Insufficient persona supply must fail closed with role gaps.');

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = resolve(repoRoot, '.tmp', `local-team-formation-${process.pid}`);
const filePath = resolve(tempRoot, 'projects.json');
await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
try {
  let api = createFileBackedAgentProjectApi({ filePath, replaceWithSeed: true });
  let response = await api.handleAsync({
    method: 'POST', path: '/projects/initiate', body: {
      includeReadModels: false,
      projectId: 'team_formation_gate_project',
      name: 'Team Formation Gate',
      brief: objectives['technical-delivery'],
      workMode: 'technical-delivery',
      now: '2026-07-10T23:50:00.000Z',
    },
  });
  assert(response.status === 200, `Project initiation returned ${response.status}.`);
  response = await api.handleAsync({ method: 'GET', path: '/projects/team_formation_gate_project/team-formation-readiness' });
  const initial = response.body.teamFormationReadiness;
  assert(response.status === 200 && initial.delegationReady && initial.integrity.valid, 'Project formation readiness must be valid.');
  api = createFileBackedAgentProjectApi({ filePath });
  response = await api.handleAsync({ method: 'GET', path: '/projects/team_formation_gate_project/team-formation-readiness' });
  assert(response.body.teamFormationReadiness.checksum === initial.checksum, 'Team formation checksum must survive restart.');
  console.log('Local team formation explainability validation passed.');
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
