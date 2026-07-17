import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerBackendActivityPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardAgentAutonomousActionQueue.jsx', import.meta.url);

test('Agent Autonomous Queue stays lazy while App retains every action and proof callback', () => {
  assert.ok(existsSync(componentUrl), 'Agent Autonomous Queue component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardAgentAutonomousActionQueue = lazy(() => import('./ProjectDashboardAgentAutonomousActionQueue.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardAgentAutonomousActionQueue'));
  assert.ok(appSource.includes('onRunRow: runAgentAutonomousActionQueueRow'));
  assert.ok(appSource.includes("onOpenChatProof: proofIds => openProjectChatProof(activeProject, proofIds, 'main')"));
  assert.ok(appSource.includes('onOpenTimelineProof: openProjectTimelineProof'));
  assert.ok(appSource.includes('runDisabled: !backendCommandAvailable || backendStation.loading'));
  assert.ok(appSource.includes('pendingAgentId: backendStation.agentAutonomousActionPendingAgentId'));
  assert.ok(appSource.includes('agentAutonomousActionPendingAgentId: null'));
  assert.ok(appSource.includes('agentAutonomousActionPendingAgentId: agentId'));
  assert.ok(appSource.includes("sourceBadge: managerReadModelSourceBadge(backendAgentAutonomousActionQueue, 'backend-agent-autonomous-action-queue-source')"));

  [
    'backend-agent-autonomous-action-queue-snapshot',
    'backend-agent-autonomous-action-run-receipt',
    'backend-agent-autonomous-action-run-output',
    'backend-agent-autonomous-action-run-output-failed',
    'backend-agent-autonomous-action-run-output-empty',
    'backend-agent-autonomous-action-run-output-rows',
    'backend-agent-autonomous-action-running',
  ].forEach(id => assert.ok(componentSource.includes(`data-testid="${id}"`), `missing queue surface: ${id}`));

  [
    'backend-agent-autonomous-action-run-${row.agentId}',
    'backend-agent-autonomous-action-output-${row.id}',
    'agent-autonomous-action-output-route-${row.id}',
    'agent-autonomous-action-output-chat-proof-${row.id}',
    'agent-autonomous-action-output-timeline-proof-${row.id}',
  ].forEach(id => assert.ok(componentSource.includes(id), `missing dynamic queue surface: ${id}`));

  assert.ok(componentSource.includes('const [optimisticPendingAgentId, setOptimisticPendingAgentId] = useState(null)'));
  assert.ok(componentSource.includes('const effectivePendingAgentId = pendingAgentId || optimisticPendingAgentId'));
  assert.ok(componentSource.includes('setOptimisticPendingAgentId(row.agentId)'));
  assert.ok(componentSource.includes('await onRunRow(row)'));
  assert.ok(componentSource.includes('disabled={runDisabled || Boolean(effectivePendingAgentId) || !row.canRun || row.routeResolved === false}'));
  assert.ok(componentSource.includes('effectivePendingAgentId === row.agentId'));
  assert.ok(componentSource.includes("projectText('Running Agent Action…')"));
  assert.ok(componentSource.includes('onClick={() => runRow(row)}'));
  assert.ok(componentSource.includes('onClick={() => onOpenChatProof(chatProofIds)}'));
  assert.ok(componentSource.includes('onClick={() => onOpenTimelineProof(timelineProofIds)}'));
  assert.ok(componentSource.includes("testId: 'backend-agent-autonomous-action-decision'"));
});
