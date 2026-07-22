import assert from 'node:assert/strict';
import test from 'node:test';

import { createAgentProjectService } from '../src/agents/agentProjectService.js';

function projectFixture() {
  return {
    id: 'outcome-work-cycle-project',
    name: 'Teen mental health research',
    objective: 'Research how daily working hours relate to adolescent mental health and publish a paper.',
    status: 'executing',
    progress: 14,
    team: [
      { id: 'director', name: 'Director', role: 'Research Director', isLeader: true },
      { id: 'researcher', name: 'Researcher', role: 'Evidence Researcher' },
      { id: 'reviewer', name: 'Reviewer', role: 'Independent Reviewer' },
    ],
    tasks: [{
      id: 'research-evidence',
      text: 'Search and synthesize evidence about adolescent work hours and mental health.',
      ownerId: 'researcher',
      reviewerAgentId: 'reviewer',
      status: 'in-progress',
      requiredWorkPulses: 2,
      workPulseCount: 0,
      workDefinition: {
        deliverable: 'A source-backed evidence matrix with limitations and a testable hypothesis.',
        acceptanceCriteria: ['Use at least three traceable sources.', 'Obtain independent review.'],
        steps: ['Search primary evidence.', 'Synthesize findings and limitations.'],
      },
    }],
    agentStates: {
      researcher: {
        agentId: 'researcher',
        managerId: 'director',
        status: 'working',
        currentPlan: { taskId: 'research-evidence', focus: 'Build the evidence matrix.' },
        inbox: [{
          id: 'manager-check-in-1',
          source: 'management-check-in',
          from: 'director',
          text: 'Please acknowledge this management check-in and report progress.',
          status: 'open',
        }],
        obligations: [],
        worklog: [],
      },
    },
    logs: [],
    eventLedger: [],
    agentWorkerLedger: [],
    agentSubmissions: [],
    submissionReviews: [],
    evidenceSearches: [],
  };
}

test('owned material work outranks non-blocking management chatter and activity does not increase progress', () => {
  const writtenDrafts = [];
  const service = createAgentProjectService({
    projects: [projectFixture()],
    messages: [],
    artifactWriter: (draft) => {
      writtenDrafts.push(draft);
      return { absolutePath: 'C:/tmp/fake-template.md' };
    },
  });
  const result = service.runAgentWorkCycle({
    projectId: 'outcome-work-cycle-project',
    agentId: 'researcher',
    useAutonomousStrategy: true,
    now: '2026-07-20T10:00:00.000Z',
  });

  assert.equal(result.strategyDecision.selectedAction, 'continue-owned-work');
  assert.equal(result.project.progress, 14);
  assert.equal(result.task.status, 'in-progress');
  assert.equal(result.messages.filter((message) => message.agentWorker?.targetAgentId === 'director').length, 0);
  assert.equal(result.task.outcome.accepted, false);
  assert.ok(result.task.outcome.blockers.includes('provider-evidence-required'));
  assert.equal(result.project.outcomeHealth.consecutiveNoMaterialCycles, 1);
  assert.equal(writtenDrafts.length, 0, 'work-pulse templates must never be written as deliverables');
  assert.deepEqual(result.log.attachments, []);
  assert.deepEqual(result.log.artifactIds, []);
});

test('pulse count creates no template submission and cannot complete a task without accepted material work', () => {
  const service = createAgentProjectService({ projects: [projectFixture()], messages: [] });
  service.runAgentWorkCycle({
    projectId: 'outcome-work-cycle-project',
    agentId: 'researcher',
    useAutonomousStrategy: true,
    now: '2026-07-20T10:00:00.000Z',
  });
  const result = service.runAgentWorkCycle({
    projectId: 'outcome-work-cycle-project',
    agentId: 'researcher',
    useAutonomousStrategy: true,
    now: '2026-07-20T10:05:00.000Z',
  });

  assert.equal(result.submission, null);
  assert.equal(result.project.agentSubmissions.length, 0);
  assert.notEqual(result.task.status, 'done');
  assert.equal(result.task.outcome.accepted, false);
  assert.equal(result.project.progress, 14);
  assert.equal(result.project.outcomeHealth.status, 'STALLED_NO_MATERIAL_DELTA');
  assert.equal(result.cycle.status, 'blocked-no-material-outcome');
});

test('an Agent with a pending submission waits for review instead of submitting duplicate checkpoints', () => {
  const project = projectFixture();
  project.agentSubmissions = [{
    id: 'material-submission-1',
    taskId: 'research-evidence',
    agentId: 'researcher',
    reviewStatus: 'pending-review',
    body: 'The working-hours evidence synthesis compares longitudinal, cohort, and meta-analytic findings about adolescent mental health. It identifies stress direction, sleep mediation, self-selection, socioeconomic confounding, inconsistent exposure definitions, and the limits of causal interpretation. The resulting testable hypothesis predicts higher standardized stress with each additional five weekly work hours, partially mediated by reduced sleep duration.',
  }];
  project.evidenceSearches = [{
    id: 'provider-search-1',
    taskId: 'research-evidence',
    provider: 'test-search',
    searchMode: 'provider-search',
    status: 'completed',
    sources: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  }];
  const service = createAgentProjectService({ projects: [project], messages: [] });
  const waiting = service.runAgentWorkCycle({ projectId: 'outcome-work-cycle-project', agentId: 'researcher', useAutonomousStrategy: true, now: '2026-07-20T10:10:00.000Z' });

  assert.equal(waiting.strategyDecision.selectedAction, 'await-material-review');
  assert.equal(waiting.submission, null);
  assert.equal(waiting.project.agentSubmissions.length, 1);
  assert.equal(waiting.messages.filter((message) => message.type === 'mention').length, 0);
});

test('a legacy pulse-template submission does not block the owner or enter independent review', () => {
  const project = projectFixture();
  project.agentSubmissions = [{
    id: 'legacy-template',
    taskId: 'research-evidence',
    agentId: 'researcher',
    requestedReviewAgentId: 'reviewer',
    reviewStatus: 'pending-review',
    body: 'Continue the next work pulse and publish timeline evidence. Coordination ledger update for manager review.',
  }];
  const service = createAgentProjectService({ projects: [project], messages: [] });

  const owner = service.getAgentAutonomousActionQueue(project.id, { now: '2026-07-20T10:15:00.000Z' }).rows.find((row) => row.agentId === 'researcher');
  const reviewer = service.getAgentAutonomousActionQueue(project.id, { now: '2026-07-20T10:15:00.000Z' }).rows.find((row) => row.agentId === 'reviewer');

  assert.notEqual(owner.selectedAction, 'await-material-review');
  assert.notEqual(reviewer.selectedAction, 'review-pending-submission');
});
