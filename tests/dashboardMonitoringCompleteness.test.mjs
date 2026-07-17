import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  createAgentProjectApi,
  createFileBackedAgentProjectApi,
} from '../src/agents/agentProjectApi.js';
import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';
import {
  createAgentProjectService,
  hydrateAgentProject,
} from '../src/agents/agentProjectService.js';

const projectId = 'dashboard_monitoring_completeness_project';

function projectSeed() {
  return hydrateAgentProject({
    id: projectId,
    name: 'Dashboard monitoring completeness',
    brief: 'Keep the complete local project record visible in the restored Dashboard.',
    team: [
      { id: 'leader', name: 'Leader', role: 'Product Lead', isLeader: true },
      { id: 'builder', name: 'Builder', role: 'Implementation Agent' },
    ],
    tasks: [],
    logs: [
      {
        id: 'log_strategy_decision_1',
        time: '2026-07-07T09:00:00.000Z',
        agent: 'Builder',
        agentId: 'builder',
        eventType: 'agent-work-pulse',
        log: 'Builder selected the next implementation action.',
        strategyDecision: {
          id: 'strategy_decision_1',
          selectedAction: 'complete-and-submit-owned-work',
          nextStep: 'Submit the completed implementation result.',
          rationale: ['The assigned work is complete.'],
        },
      },
    ],
    eventLedger: [],
    agentStates: {},
  });
}

function weekMessages(count = 300) {
  return Array.from({ length: count }, (_, index) => ({
    id: `week_message_${index}`,
    projectId,
    channelId: index % 2 ? 'main' : 'delivery_room',
    authorId: 'builder',
    author: 'Builder',
    directTargetIds: ['leader'],
    text: `Persisted group-chat sentence ${index}`,
    source: 'agent-to-agent-message',
    time: new Date(Date.UTC(2026, 6, 7 + Math.floor(index / 50), 9, index % 50)).toISOString(),
  }));
}

test('expanded manager flow graph includes every retained group-chat sentence and every intent', () => {
  const messages = weekMessages(300);
  const service = createAgentProjectService({ projects: [projectSeed()], messages });

  assert.equal(service.getMessages(projectId).length, messages.length);

  const intentQueue = service.getCollaborationIntentQueue(projectId, { fresh: true });
  const graph = service.getManagerFlowGraph(projectId, { fresh: true });
  const graphProofIds = new Set(graph.nodes.flatMap((node) => node.proofIds || []));

  messages.forEach((message) => {
    assert.equal(graphProofIds.has(message.id), true, `Missing group-chat sentence ${message.id}`);
  });
  intentQueue.rows.forEach((intent) => {
    assert.equal(
      graph.nodes.some((node) => node.intentId === intent.id && node.summary === intent.intent),
      true,
      `Missing collaboration intent ${intent.id}`,
    );
  });
  assert.equal(
    graph.nodes.some((node) => (
      node.strategyDecisionId === 'strategy_decision_1'
      && node.summary === 'Submit the completed implementation result.'
    )),
    true,
    'Missing historical Agent strategy intent.',
  );
});

test('one-week group-chat history survives a file-store restart without the former 240-message loss', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-dashboard-monitoring-'));
  const filePath = join(directory, 'projects.json');
  try {
    const messages = weekMessages(300);
    const firstStore = createAgentProjectFileStore({
      filePath,
      projects: [projectSeed()],
      messages,
      replaceWithSeed: true,
      hydrateProject: hydrateAgentProject,
    });
    const firstService = createAgentProjectService({ store: firstStore });
    assert.equal(firstService.getMessages(projectId).length, messages.length);

    const restartedStore = createAgentProjectFileStore({
      filePath,
      hydrateProject: hydrateAgentProject,
    });
    const restartedService = createAgentProjectService({ store: restartedStore });
    assert.equal(restartedService.getMessages(projectId).length, messages.length);

    const graph = restartedService.getManagerFlowGraph(projectId, { fresh: true });
    const graphProofIds = new Set(graph.nodes.flatMap((node) => node.proofIds || []));
    messages.forEach((message) => {
      assert.equal(graphProofIds.has(message.id), true, `Restart lost graph sentence ${message.id}`);
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the elected Leader can create a Group Chat channel while a non-Leader Agent cannot', () => {
  const service = createAgentProjectService({ projects: [projectSeed()] });
  const api = createAgentProjectApi({
    service,
    accessControl: { defaultMode: 'enforced' },
  });
  const agentHeaders = (agentId) => ({
    'x-hofs-access-mode': 'enforced',
    'x-hofs-role': 'agent',
    'x-hofs-agent-id': agentId,
    'x-hofs-user-id': `${agentId}-user`,
  });

  const leaderResponse = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/transcripts`,
    headers: agentHeaders('leader'),
    body: {
      includeReadModels: false,
      channelId: 'leader_room',
      name: 'Leader Room',
      now: '2026-07-13T10:00:00.000Z',
    },
  });
  assert.equal(leaderResponse.status, 200);
  assert.equal(leaderResponse.body.transcriptChannel.channelId, 'leader_room');
  assert.equal(leaderResponse.body.transcriptChannelReceipt.actorId, 'leader');

  const nonLeaderResponse = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/transcripts`,
    headers: agentHeaders('builder'),
    body: {
      includeReadModels: false,
      channelId: 'unauthorized_room',
      name: 'Unauthorized Room',
      now: '2026-07-13T10:01:00.000Z',
    },
  });
  assert.equal(nonLeaderResponse.status, 400);
  assert.equal(nonLeaderResponse.body.error, 'transcript-channel-create-leader-required');
  assert.equal(
    service.getTranscriptIndex(projectId).channels.some((channel) => channel.channelId === 'unauthorized_room'),
    false,
  );

  const missingIdentityResponse = api.handle({
    method: 'POST',
    path: `/projects/${projectId}/transcripts`,
    headers: {
      'x-hofs-access-mode': 'enforced',
      'x-hofs-role': 'agent',
      'x-hofs-user-id': 'missing-agent-user',
    },
    body: {
      includeReadModels: false,
      channelId: 'missing_identity_room',
      name: 'Missing Identity Room',
      now: '2026-07-13T10:02:00.000Z',
    },
  });
  assert.equal(missingIdentityResponse.status, 403);
  assert.equal(
    service.getTranscriptIndex(projectId).channels.some((channel) => channel.channelId === 'missing_identity_room'),
    false,
  );
});

test('the actual file-backed local API keeps the complete transcript by default', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-dashboard-api-monitoring-'));
  const filePath = join(directory, 'projects.json');
  try {
    const messages = weekMessages(300);
    const first = createFileBackedAgentProjectApi({
      filePath,
      projects: [projectSeed()],
      messages,
      replaceWithSeed: true,
    });
    assert.equal(first.service.getMessages(projectId).length, messages.length);

    const restarted = createFileBackedAgentProjectApi({ filePath });
    assert.equal(restarted.service.getMessages(projectId).length, messages.length);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
