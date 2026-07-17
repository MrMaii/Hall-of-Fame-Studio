import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const simpleMeetingSource = readFileSync(new URL('../src/meeting/ProjectSimpleMeeting.jsx', import.meta.url), 'utf8');
const simpleChatSource = readFileSync(new URL('../src/project/ProjectSimpleChat.jsx', import.meta.url), 'utf8');
const projectChatPanelSource = readFileSync(new URL('../src/project/ProjectChatPanel.jsx', import.meta.url), 'utf8');
const projectChatRouteViewSource = readFileSync(new URL('../src/project/ProjectChatRouteView.jsx', import.meta.url), 'utf8');
const advancedChatSource = readFileSync(new URL('../src/project/AdvancedProjectChat.jsx', import.meta.url), 'utf8');
const projectTimelineRouteViewSource = readFileSync(new URL('../src/project/ProjectTimelineRouteView.jsx', import.meta.url), 'utf8');
const advancedTimelineSource = readFileSync(new URL('../src/project/AdvancedProjectTimeline.jsx', import.meta.url), 'utf8');
const agentAutonomousActionQueueSource = readFileSync(new URL('../src/project/ProjectDashboardAgentAutonomousActionQueue.jsx', import.meta.url), 'utf8');
const autonomousRunControlSource = readFileSync(new URL('../src/project/ProjectDashboardAutonomousRunControl.jsx', import.meta.url), 'utf8');
const deploymentPreflightSource = readFileSync(new URL('../src/project/ProjectDashboardDeploymentPreflight.jsx', import.meta.url), 'utf8');
const productionInfrastructureRehearsalSource = readFileSync(new URL('../src/project/ProjectDashboardProductionInfrastructureRehearsal.jsx', import.meta.url), 'utf8');
const productionInfrastructureRehearsalReadyPackageSource = readFileSync(new URL('../src/project/ProjectDashboardProductionInfrastructureRehearsalReadyPackage.jsx', import.meta.url), 'utf8');
const publicProductionStartupSummarySource = readFileSync(new URL('../src/project/ProjectDashboardPublicProductionStartupSummary.jsx', import.meta.url), 'utf8');
const publicProductionStartupReadinessSource = readFileSync(new URL('../src/project/ProjectDashboardPublicProductionStartupReadiness.jsx', import.meta.url), 'utf8');
const launchOperationsOverviewSource = readFileSync(new URL('../src/project/ProjectDashboardLaunchOperationsOverview.jsx', import.meta.url), 'utf8');
const productionLaunchProofPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardProductionLaunchProofPanels.jsx', import.meta.url), 'utf8');
const privatePilotWorkflowPanelsSource = readFileSync(new URL('../src/project/ProjectDashboardPrivatePilotWorkflowPanels.jsx', import.meta.url), 'utf8');
const productionOperationsReadinessSource = readFileSync(new URL('../src/project/ProjectDashboardProductionOperationsReadiness.jsx', import.meta.url), 'utf8');
const productionOperationsControlReceiptsSource = readFileSync(new URL('../src/project/ProjectDashboardProductionOperationsControlReceipts.jsx', import.meta.url), 'utf8');
const backendSchedulerControlsSource = readFileSync(new URL('../src/project/ProjectDashboardBackendSchedulerControls.jsx', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../src/agents/agentRuntime.js', import.meta.url), 'utf8');
const apiSource = readFileSync(new URL('../src/agents/agentProjectApi.js', import.meta.url), 'utf8');

const dashboardStartMarker = '  const renderDashboardView = () =>';
const dashboardEndMarker = '  const renderWarRoomView = () =>';
test('project Dashboard retains the original meeting, Group Chat, and Manager Flow Graph structures', () => {
  const start = appSource.indexOf(dashboardStartMarker);
  const end = appSource.indexOf(dashboardEndMarker);

  assert.notEqual(start, -1, 'original Dashboard renderer is missing');
  assert.notEqual(end, -1, 'original project UI ending marker is missing');
  assert.ok(end > start, 'original project UI markers are out of order');

  const protectedSource = appSource.slice(start, end);
  const protectedSurfaceSource = `${protectedSource}\n${simpleMeetingSource}\n${simpleChatSource}\n${projectChatPanelSource}\n${projectChatRouteViewSource}\n${advancedChatSource}\n${projectTimelineRouteViewSource}\n${advancedTimelineSource}\n${agentAutonomousActionQueueSource}\n${autonomousRunControlSource}\n${deploymentPreflightSource}\n${productionInfrastructureRehearsalSource}\n${productionInfrastructureRehearsalReadyPackageSource}\n${publicProductionStartupSummarySource}\n${publicProductionStartupReadinessSource}\n${launchOperationsOverviewSource}\n${productionLaunchProofPanelsSource}\n${privatePilotWorkflowPanelsSource}\n${productionOperationsReadinessSource}\n${productionOperationsControlReceiptsSource}\n${backendSchedulerControlsSource}`;
  for (const retainedSurface of [
    'project-simple-meeting',
    'project-chat-panel',
    'manager-flow-graph',
    'backend-agent-autonomous-action-queue',
    'backend-autonomous-run-control',
    'backend-deployment-preflight',
    'backend-production-infrastructure-rehearsal',
    'backend-public-production-startup-readiness',
    'backend-launch-operations-overview',
    'backend-scheduler-controls',
  ]) {
    assert.ok(protectedSurfaceSource.includes(retainedSurface), `original Dashboard surface is missing: ${retainedSurface}`);
  }
  for (const retainedStructure of [
    'const renderProjectMeeting =',
    'const renderProjectChat =',
    'const renderProjectTimeline =',
  ]) {
    assert.ok(protectedSource.includes(retainedStructure), `original Dashboard structure is missing: ${retainedStructure}`);
  }
  assert.ok(appSource.includes("lazy(() => import('./project/ProjectChatRouteView.jsx'))"));
  assert.ok(projectChatRouteViewSource.includes("import AdvancedProjectChat from './AdvancedProjectChat.jsx'"));
  assert.ok(advancedChatSource.includes('data-testid="project-chat-panel"'));
  assert.ok(appSource.includes("lazy(() => import('./project/ProjectTimelineRouteView.jsx'))"));
  assert.ok(projectTimelineRouteViewSource.includes("import AdvancedProjectTimeline from './AdvancedProjectTimeline.jsx'"));
  assert.ok(advancedTimelineSource.includes('data-testid="manager-flow-graph"'));
  assert.ok(advancedTimelineSource.includes('data-testid={`manager-flow-node-${node.id}`}'));
});

test('meeting and Group Chat intent routing remain connected to the original runtime module', () => {
  for (const exportName of ['routeDirectorDirective', 'isFeatureChangeRequest', 'startAgentSession']) {
    assert.match(runtimeSource, new RegExp(`export function ${exportName}\\b`));
    assert.match(appSource, new RegExp(`\\b${exportName}\\b`));
  }
  assert.match(appSource, /routeDirectorDirective\(\{/);
  assert.match(appSource, /isFeatureChangeRequest\(val\)/);
});

test('Manager Flow Graph read and node-confirmation routes remain available', () => {
  assert.match(apiSource, /route\.action === 'manager-flow-graph'/);
  assert.match(apiSource, /confirmManagerFlowGraphNode/);
  assert.match(advancedTimelineSource, /data-testid="manager-flow-graph"/);
  assert.match(advancedTimelineSource, /data-testid=\{`manager-flow-node-\$\{node\.id\}`\}/);
});
