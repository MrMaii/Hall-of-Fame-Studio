import assert from 'node:assert/strict';
import test from 'node:test';
import { createAgentProjectService } from '../src/agents/agentProjectService.js';

test('attaches transcript proof metadata to every kickoff readiness check', () => {
  const service = createAgentProjectService();
  service.initiateProject({
    projectId: 'readiness_proof_metadata',
    name: 'Readiness proof metadata',
    brief: 'Prove a kickoff route can open exact transcript evidence.',
    team: [
      { id: 'lead', name: 'Lead', role: 'Leader', isLeader: true },
      { id: 'reviewer', name: 'Reviewer', role: 'Reviewer' },
    ],
    selectedLeaderId: 'lead',
    reviewerId: 'reviewer',
  });
  const proofMap = service.getReadinessProofMap('readiness_proof_metadata');
  const kickoff = proofMap.readiness.checks.find((check) => check.id === 'kickoff-approved');

  assert.equal(kickoff.proofLabel, 'Kickoff chat proof');
  assert.equal(kickoff.channelId, 'main');
  assert.ok(kickoff.proofIds.includes('director_brief_readiness_proof_metadata'));
});
