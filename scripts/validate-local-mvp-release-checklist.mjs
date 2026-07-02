import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function scriptNodeTargets(command = '') {
  const targets = [];
  const pattern = /(?:^|&&|\s)node\s+(scripts\/[^\s&]+)/g;
  let match = pattern.exec(command.replace(/\\/g, '/'));
  while (match) {
    targets.push(match[1]);
    match = pattern.exec(command.replace(/\\/g, '/'));
  }
  return targets;
}

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const launchGateDoc = read('docs/LAUNCH_READINESS_GATES.md');
const mockRegister = read('docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md');
const appSource = read('src/App.jsx');
const agentProjectServiceSource = read('src/agents/agentProjectService.js');
const agentProjectApiSource = read('src/agents/agentProjectApi.js');
const productTeamAcceptanceSource = read('scripts/validate-product-team-acceptance-scenario.mjs');
const privatePilotUiSource = read('scripts/validate-manager-private-pilot-ui.mjs');
const managerBackendCoreUiSource = read('scripts/validate-manager-backend-core-ui.mjs');
const managerBackendUiSource = read('scripts/validate-manager-backend-ui.mjs');
const settingsAgentsServerUiSource = read('scripts/validate-settings-agents-server-ui.mjs');
const realUserZeroToAutonomySource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs');
const realUserZeroToAutonomyApiSource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs');

const p0Commands = [
  'build',
  'skills:check',
  'agents:scenario',
  'agents:server:validate',
  'agents:local-mvp-startup-readiness',
  'agents:settings-health-readiness',
  'agents:settings-runtime-readiness',
  'agents:settings-provider-readiness',
  'agents:settings-integration-readiness',
  'agents:evidence-index-readiness',
  'agents:budget-alert-readiness',
  'agents:error-reporting-readiness',
  'agents:search-provider:vault-endpoint',
  'agents:project-settings:privacy',
  'agents:project-settings:provider-budget',
  'agents:project-settings:tool-grants',
  'agents:project-settings:integrations',
  'agents:project-settings:workspace',
  'agents:product-team:smoke',
  'agents:real-user-zero-to-autonomy',
  'agents:product-team:core',
  'agents:product-team:research-sample',
  'agents:product-team:cycle-consistency',
  'ui:manager-backend:core',
  'ui:manager-provider-proof',
  'ui:settings-agents-server',
  'ui:settings-agents-server:dev',
  'ui:manager-mission-runner',
  'ui:real-user-zero-to-autonomy',
  'ui:real-user-zero-to-autonomy:dev',
];

const p1Commands = [
  'agents:product-team:private-pilot',
  'ui:manager-backend',
  'ui:manager-private-pilot',
];

const requiredScripts = [...p0Commands, ...p1Commands, 'launch:gates'];

for (const scriptName of requiredScripts) {
  assert(scripts[scriptName], `package.json must expose ${scriptName}.`);
  assert(launchGateDoc.includes(`npm run ${scriptName}`), `docs/LAUNCH_READINESS_GATES.md must list npm run ${scriptName}.`);
  for (const target of scriptNodeTargets(scripts[scriptName])) {
    assert(existsSync(resolve(repoRoot, target)), `${scriptName} points to missing script target ${target}.`);
  }
}

const requiredEntryFiles = [
  'scripts/validate-agent-project-server-secret-vault.mjs',
  'scripts/validate-local-mvp-startup-readiness-contract.mjs',
  'scripts/validate-settings-health-readiness-contract.mjs',
  'scripts/validate-settings-runtime-readiness-contract.mjs',
  'scripts/validate-settings-provider-readiness-contract.mjs',
  'scripts/validate-settings-integration-readiness-contract.mjs',
  'scripts/validate-evidence-index-readiness-contract.mjs',
  'scripts/validate-budget-alert-readiness-contract.mjs',
  'scripts/validate-error-reporting-readiness-contract.mjs',
  'scripts/validate-search-provider-vault-endpoint.mjs',
  'scripts/validate-project-settings-privacy-policy.mjs',
  'scripts/validate-project-settings-provider-budget-policy.mjs',
  'scripts/validate-project-settings-tool-grant-policy.mjs',
  'scripts/validate-project-settings-integration-capabilities.mjs',
  'scripts/validate-project-settings-workspace-capabilities.mjs',
  'scripts/validate-product-team-core-smoke.mjs',
  'scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs',
  'scripts/validate-settings-agents-server-ui.mjs',
  'scripts/validate-manager-mission-runner-ui.mjs',
  'scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs',
  'scripts/validate-manager-private-pilot-ui.mjs',
  'scripts/run-product-team-acceptance-stage.mjs',
  'skills/hall-of-fame-personas/SKILL.md',
  'skills/hall-of-fame-personas/references/persona-schema.md',
  'skills/hall-of-fame-personas/references/persona-authoring-template.md',
  'skills/hall-of-fame-personas/references/agent-production-guide.md',
];

for (const file of requiredEntryFiles) {
  assert(existsSync(resolve(repoRoot, file)), `Local MVP release checklist requires ${file}.`);
}

const requiredProductProof = [
  'Research Project remains a validation sample',
  'general AI product-team system',
  'Agent submissions for `discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, and `final-deliverable`',
  'low-write core-chain smoke gate',
  'Real-user agents:server API zero-to-autonomy proof',
  'Real-user Settings provider seal plus zero-to-autonomy browser proof',
  'Local MVP startup readiness through `local-mvp-startup-readiness/v1`',
  'Agent submission node',
  'public production remains blocked',
];

for (const text of requiredProductProof) {
  assert(
    launchGateDoc.toLowerCase().includes(text.toLowerCase()),
    `Launch gate doc must preserve local MVP proof boundary: ${text}.`,
  );
}

const requiredMockReplacementProof = [
  'Settings API key entry is usable only through a running backend Secret Vault',
  'Search endpoint/key configuration is usable only through backend Secret Vault receipts',
  'local-mvp-startup-readiness/v1',
  'settings-health-readiness/v1',
  'Manager Ready Package coverage',
  'Readiness Proof Map routing',
  'settings-runtime-readiness/v1',
  'settings-integration-readiness/v1',
  'Settings Vector Store exposes backend Evidence Index readiness instead of a fake editable control',
  'Settings Proxy/Webhook exposes backend Adapter Gateway preflight instead of a fake editable control',
  'Settings MCP Tools exposes backend Provider Readiness instead of a fake editable control',
  'Settings Budget Alerts exposes backend Budget Alert readiness instead of a fake editable control',
  'Settings Error Reporting exposes backend Error Reporting readiness instead of a fake editable control',
  'Project privacy policy writes are receipt-backed through `project-settings/v1`',
  'Project provider budget policy writes are receipt-backed through `project-settings/v1`',
  'Project tool grant policy writes are receipt-backed through `project-settings/v1`',
  'Settings Workspace exposes backend Workspace capabilities instead of a fake editable control',
  'project-workspace-policy/v1',
  'project-integration-capabilities/v1',
  'project-workspace-capabilities/v1',
  'project-memory-readiness/v1',
  '/memory-readiness',
  'meeting-summaries/v1',
  '/meeting-summaries',
  'evidence-index-readiness/v1',
  'adapter-gateway-preflight',
  'provider-readiness',
  'budget-alert-readiness/v1',
  'error-reporting-readiness/v1',
  'npm run agents:project-settings:integrations',
  'npm run agents:project-settings:workspace',
  'npm run agents:real-user-zero-to-autonomy',
  'npm run agents:local-mvp-startup-readiness',
  'npm run agents:settings-health-readiness',
  'npm run agents:settings-runtime-readiness',
  'npm run agents:settings-integration-readiness',
  'npm run agents:evidence-index-readiness',
  'npm run agents:budget-alert-readiness',
  'npm run agents:error-reporting-readiness',
  'npm run ui:real-user-zero-to-autonomy',
  'npm run ui:real-user-zero-to-autonomy:dev',
  'Browser-snapshot backend writes are now limited to sample fixture or explicit development fallback projects',
  'Backend project missing; local seed suppressed',
  'ui:manager-backend:core',
  'real `agents:server`',
  'Agent submission node',
  'Flow Graph',
  'Proof Map',
  'transcript',
  'timeline',
  'event ledger',
];

for (const text of requiredMockReplacementProof) {
  assert(
    mockRegister.toLowerCase().includes(text.toLowerCase()),
    `Frontend mock replacement register must preserve backend-first proof boundary: ${text}.`,
  );
}

assert(
  scripts['agents:real-user-zero-to-autonomy'].includes('validate-real-user-zero-to-autonomy-agents-server-api.mjs'),
  'agents:real-user-zero-to-autonomy must run the real agents:server API startup gate.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('agent-project-server.mjs')
    && realUserZeroToAutonomyApiSource.includes('/secret-vault/seal')
    && realUserZeroToAutonomyApiSource.includes('/product-team-missions')
    && realUserZeroToAutonomyApiSource.includes('/manager-flow-graph')
    && realUserZeroToAutonomyApiSource.includes('/readiness-proof-map')
    && realUserZeroToAutonomyApiSource.includes('/memory-readiness')
    && realUserZeroToAutonomyApiSource.includes('/transcripts/main')
    && realUserZeroToAutonomyApiSource.includes('/product-team-delivery-trace'),
  'agents:real-user-zero-to-autonomy must cover Secret Vault, mission start, and proof surfaces through the real backend API.',
);
for (const text of [
  "artifactType: 'discovery-report'",
  "artifactType: 'brainstorm-board'",
  "artifactType: 'evidence-packet'",
  "artifactType: 'product-brief'",
  "artifactType: 'decision-proposal'",
  "artifactType: 'risk-review'",
  "artifactType: 'revision-note'",
  "artifactType: 'implementation-plan'",
  "artifactType: 'final-deliverable'",
  '/artifact-quality-audit',
  'generic-artifact-type-coverage',
]) {
  assert(
    realUserZeroToAutonomyApiSource.includes(text),
    `agents:real-user-zero-to-autonomy must keep required generic artifact coverage over HTTP: ${text}.`,
  );
}
assert(
  scripts['ui:real-user-zero-to-autonomy'].includes('validate-real-user-zero-to-autonomy-agents-server-ui.mjs'),
  'ui:real-user-zero-to-autonomy must run the real agents:server startup gate, not the lighter Mission Runner gate.',
);
assert(
  scripts['ui:real-user-zero-to-autonomy'].includes('vite build && node scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs'),
  'ui:real-user-zero-to-autonomy must build the React app before running the real-user agents:server browser gate.',
);
assert(
  scripts['ui:real-user-zero-to-autonomy:dev']?.includes('--ui-base-url=http://127.0.0.1:5173'),
  'ui:real-user-zero-to-autonomy:dev must target the already running IPv4 Vite dev server to avoid build writes and localhost IPv6 drift.',
);
assert(
  realUserZeroToAutonomySource.includes("readCliArg('--ui-base-url')")
    && realUserZeroToAutonomySource.includes('HOFS_UI_BASE_URL')
    && realUserZeroToAutonomySource.includes('configuredUiBaseUrl')
    && realUserZeroToAutonomySource.includes('/memory-readiness')
    && realUserZeroToAutonomySource.includes('staticRuntime.server'),
  'Real-user browser gate must support --ui-base-url / HOFS_UI_BASE_URL and skip the dist static server when a dev UI URL is supplied.',
);
assert(
  scripts['ui:settings-agents-server'].includes('validate-settings-agents-server-ui.mjs'),
  'ui:settings-agents-server must keep exercising the real agents:server Settings path.',
);
assert(
  scripts['ui:settings-agents-server:dev']?.includes('--ui-base-url=http://127.0.0.1:5173'),
  'ui:settings-agents-server:dev must target the already running IPv4 Vite dev server to avoid build writes and localhost IPv6 drift.',
);
assert(
  appSource.includes('settingsProviderReadinessRoute')
    && appSource.includes('settingsRuntimeReadinessRoute')
    && appSource.includes('providerVaultBindingsRoute')
    && appSource.includes('/settings-provider-readiness')
    && appSource.includes('/settings-runtime-readiness')
    && appSource.includes('/provider-vault-bindings'),
  'Settings provider/runtime sync must prefer project-scoped backend readiness routes when an active project exists.',
);
assert(
  settingsAgentsServerUiSource.includes('settings-secret-vault-local-startup-contract')
    && settingsAgentsServerUiSource.includes("readCliArg('--ui-base-url')")
    && settingsAgentsServerUiSource.includes('HOFS_UI_BASE_URL')
    && settingsAgentsServerUiSource.includes('configuredUiBaseUrl')
    && settingsAgentsServerUiSource.includes('settings-footer-backend-save-status')
    && settingsAgentsServerUiSource.includes('backend-backed controls save on change')
    && settingsAgentsServerUiSource.includes('settings-tab-health')
    && settingsAgentsServerUiSource.includes('/settings/health-readiness')
    && settingsAgentsServerUiSource.includes('Settings Health')
    && settingsAgentsServerUiSource.includes('Local MVP startup')
    && settingsAgentsServerUiSource.includes('SECRET_VAULT_ENABLED=true')
    && settingsAgentsServerUiSource.includes('/local-mvp-startup-readiness')
    && settingsAgentsServerUiSource.includes('/settings/provider-readiness')
    && settingsAgentsServerUiSource.includes('/secret-vault/status')
    && settingsAgentsServerUiSource.includes('/secret-vault/seal'),
  'ui:settings-agents-server must verify Settings startup guidance and backend-backed footer status.',
);
assert(
  productTeamAcceptanceSource.includes("process.on('exit'")
    && productTeamAcceptanceSource.includes('HOFS_PRODUCT_TEAM_PRESERVE_TMP'),
  'Product-team acceptance stages must default-clean their temp run directory and require an explicit preserve flag.',
);
assert(
  privatePilotUiSource.includes("HOFS_PRODUCT_TEAM_PRESERVE_TMP: '1'")
    && privatePilotUiSource.includes('HOFS_MANAGER_PRIVATE_PILOT_PRESERVE_TMP'),
  'Manager private-pilot UI gate must preserve the prepared handoff checkpoint only during the browser run, then clean it by default.',
);
assert(
  appSource.includes('Project workspace settings save through backend receipts.')
    && appSource.includes('settings-footer-backend-save-status')
    && appSource.includes('Backend-backed controls save on change for this project')
    && appSource.includes('settings-global-language-local-preference')
    && appSource.includes('settings-workspace-policy-controls')
    && appSource.includes('settings-workspace-interface-density')
    && appSource.includes('settings-workspace-default-visibility')
    && appSource.includes('settings-workspace-autosave-cadence')
    && appSource.includes('settings-workspace-capability-contract')
    && appSource.includes('settings-workspace-memory-readiness')
    && appSource.includes('settings-workspace-sync-memory-readiness')
    && appSource.includes('settings-workspace-memory-readiness-rows')
    && appSource.includes('settings-workspace-memory-readiness-gates')
    && appSource.includes('settings-workspace-meeting-summaries')
    && appSource.includes('settings-workspace-sync-meeting-summaries')
    && appSource.includes('/memory-readiness')
    && appSource.includes('/meeting-summaries')
    && appSource.includes('Backend meeting summaries')
    && appSource.includes('project-workspace-policy/v1')
    && appSource.includes('project-workspace-capabilities/v1')
    && appSource.includes('Global language: browser-local UI preference only')
    && appSource.includes('Project language and workspace policy write through project-settings/v1')
    && appSource.includes('Runtime contract rules and long-term memory readiness are backend-backed and read-only')
    && appSource.includes('Backend sync required before settings are treated as saved')
    && appSource.includes('Backend or Vault unavailable; controls remain route-required')
    && !appSource.includes('Only language settings write from this tab today.')
    && !appSource.includes('<SmallButton><Save size={12}'),
  'Settings footer/workspace UI must not present stale, unsynced, or no-op save controls as real backend-backed settings.',
);
assert(
  agentProjectServiceSource.includes('project-memory-readiness/v1')
    && agentProjectServiceSource.includes('/projects/:projectId/memory-readiness')
    && agentProjectServiceSource.includes('projectMemoryReadinessRoutes')
    && agentProjectServiceSource.includes('projectMemoryReadinessRowCount')
    && agentProjectApiSource.includes("route.action === 'memory-readiness'")
    && agentProjectApiSource.includes('getProjectMemoryReadiness')
    && appSource.includes('const syncBackendProjectMemoryReadiness = async')
    && appSource.includes('payload.projectMemoryReadiness || payload')
    && appSource.includes('Backend project memory readiness'),
  'Settings Workspace long-term memory must be backed by a project memory readiness route and rendered through a frontend sync path instead of a placeholder.',
);
assert(
  appSource.includes('settings-secret-vault-action-required')
    && appSource.includes('settings-provider-readiness-contract')
    && appSource.includes('settings-secret-vault-local-startup-contract')
    && appSource.includes("schemaVersion === 'local-mvp-startup-readiness/v1'")
    && appSource.includes('/local-mvp-startup-readiness')
    && appSource.includes('/settings/health-readiness')
    && appSource.includes('/settings/runtime-readiness')
    && appSource.includes('settings-health-readiness/v1')
    && appSource.includes('settings-runtime-readiness/v1')
    && agentProjectServiceSource.includes('localMvpStartupReadinessRoutes')
    && agentProjectServiceSource.includes('settingsHealthReadinessRoutes')
    && agentProjectServiceSource.includes('settingsProviderReadinessRoutes')
    && agentProjectServiceSource.includes('settingsRuntimeReadinessRoutes')
    && agentProjectServiceSource.includes('localMvpStartupStatus')
    && agentProjectServiceSource.includes('settingsHealthStatus')
    && agentProjectServiceSource.includes('settingsProviderReadinessStatus')
    && agentProjectServiceSource.includes('settingsRuntimeReadinessStatus')
    && appSource.includes("id: 'health', label: 'Health'")
    && (appSource.match(/id: 'health', label: 'Health'/g) || []).length === 1
    && appSource.includes('/settings/provider-readiness')
    && appSource.includes('/secret-vault/status')
    && appSource.includes('SECRET_VAULT_ENABLED=true and SECRET_VAULT_KEY set before npm run agents:server')
    && appSource.includes('API fields are editable now, but Seal stays disabled until the backend Secret Vault is ready.')
    && appSource.includes('API field: editable / Seal:')
    && appSource.includes('requires backend Vault')
    && appSource.includes('The browser will not persist provider secrets.')
    && appSource.includes('API fields are editable, but backend provider status has not been synced. Start agents:server with Secret Vault env, then Sync status before sealing keys.'),
  'Settings Keys must explain that API fields are user-enterable but cannot be sealed or persisted until the backend Vault is ready.',
);
assert(
  appSource.includes('UI Health Product-Team Probe')
    && appSource.includes('compact product-team workflow')
    && appSource.includes('first-page product-team brief')
    && appSource.includes('first product-team timeline artifact')
    && !appSource.includes('UI Health Research Probe')
    && !appSource.includes('compact research project')
    && !appSource.includes('first-page research brief')
    && !appSource.includes('first research timeline artifact'),
  'Settings Workflow Smoke must stay generic product-team, not research-only.',
);
assert(
  appSource.includes('settings-evidence-index-readiness-route')
    && appSource.includes('/evidence-index-readiness')
    && appSource.includes('settings-integration-readiness-contract')
    && appSource.includes('settings-integration-readiness-summary')
    && appSource.includes('/settings-integration-readiness')
    && agentProjectServiceSource.includes('settingsIntegrationReadinessRoutes')
    && agentProjectServiceSource.includes('settingsIntegrationReadinessStatus')
    && agentProjectApiSource.includes("route.action === 'settings-integration-readiness'")
    && appSource.includes('Local evidence index, adapter gateway, MCP governance, budget alert, and error reporting readiness are backend routes'),
  'Settings Integrations must expose a backend Settings Integration Readiness aggregate and the backend Evidence Index readiness route instead of fake controls.',
);
assert(
  appSource.includes('settings-runtime-readiness-contract')
    && appSource.includes('settings-model-runtime-readiness-contract')
    && appSource.includes('settingsRuntimeReadiness')
    && appSource.includes('/settings/runtime-readiness')
    && appSource.includes('Backend-owned runtime readiness')
    && appSource.includes('Model policy readiness comes from the backend'),
  'Settings Deployment and Models must consume the backend Settings Runtime Readiness contract instead of frontend-inferred runtime rows.',
);
assert(
  appSource.includes('settings-proxy-webhook-preflight-route')
    && appSource.includes('/adapter-gateway-preflight')
    && appSource.includes('adapter preflight'),
  'Settings Integrations must expose the backend Adapter Gateway preflight route instead of a fake Proxy/Webhook control.',
);
assert(
  appSource.includes('settings-mcp-tools-readiness-route')
    && appSource.includes('/provider-readiness')
    && appSource.includes('provider readiness'),
  'Settings Integrations must expose the backend Provider Readiness route instead of a fake MCP tools control.',
);
assert(
  appSource.includes('settings-budget-alert-readiness-route')
    && appSource.includes('/budget-alert-readiness')
    && appSource.includes('local headroom route')
    && agentProjectServiceSource.includes('budgetAlertReadinessRoutes')
    && agentProjectServiceSource.includes('budgetAlertReadinessStatus'),
  'Settings Integrations must expose the backend Budget Alert readiness route instead of a fake budget alert control.',
);
assert(
  appSource.includes('settings-error-reporting-readiness-route')
    && appSource.includes('/error-reporting-readiness')
    && appSource.includes('local error route')
    && agentProjectServiceSource.includes('errorReportingReadinessRoutes')
    && agentProjectServiceSource.includes('errorReportingReadinessStatus'),
  'Settings Integrations must expose the backend Error Reporting readiness route instead of a fake error reporting control.',
);
assert(
  realUserZeroToAutonomySource.includes('/evidence-index-readiness')
    && realUserZeroToAutonomySource.includes('evidence-index-readiness/v1')
    && realUserZeroToAutonomySource.includes('managed-vector-adapter-production-blocked'),
  'Real-user zero-to-autonomy validation must prove Evidence Index readiness after evidence and artifact output.',
);
assert(
  appSource.includes('project-chat-create-transcript-channel')
    && appSource.includes("await runBackendProjectCommand('transcripts'")
    && appSource.includes('Backend transcript channel created')
    && appSource.includes('backend-channel-create-required')
    && !appSource.includes('createMockChannel')
    && !appSource.includes('project-chat-create-local-channel'),
  'Group Chat channel creation must use the backend transcript-channel contract for real projects, not mock/local channel naming.',
);
assert(
  appSource.includes('const canSeedActiveProjectSnapshotToBackend = (project = activeProject)')
    && appSource.includes('isManagerDemoProject(project)')
    && appSource.includes('isDevelopmentLocalRuntimeFallbackEnabled()')
    && appSource.includes('if (!canSeedActiveProjectSnapshotToBackend(activeProject))')
    && appSource.includes('Browser snapshot save is disabled for real backend projects.')
    && appSource.includes('disabled={backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)}')
    && appSource.includes('Backend project missing; local seed suppressed')
    && appSource.includes('Backend project not found after prior sync; local snapshot reseeding is suppressed.')
    && appSource.includes('Backend project not found; local snapshot seeding is disabled for real projects.'),
  'Real backend projects must fail closed instead of saving or reseeding browser snapshots over backend receipt ledgers.',
);
assert(
  managerBackendCoreUiSource.includes('Manager Demo compatibility seed may write the sample snapshot at most once.')
    && managerBackendCoreUiSource.includes('Autonomous Run Control must not reseed the browser snapshot after backend proof is written.')
    && managerBackendCoreUiSource.includes('Agent Autonomous Queue must not reseed the browser snapshot after backend proof is written.')
    && managerBackendCoreUiSource.includes('Autopilot scheduler controls must not reseed the browser snapshot after backend proof is written.'),
  'Fast Manager backend core UI validation must prove sample compatibility seeding does not overwrite later backend proof.',
);
assert(
  managerBackendUiSource.includes('Approved real backend projects must keep browser snapshot Save Project disabled')
    && managerBackendUiSource.includes("page.getByTestId('backend-save-project').isDisabled()"),
  'Full Manager backend UI validation must prove approved real projects cannot Save Project browser snapshots.',
);

for (const text of [
  '/secret-vault/status',
  'settings-provider-seal-model-key',
  'settings-provider-seal-search-endpoint',
  'settings-provider-seal-search-key',
  '/secret-vault/records',
  'local-secret-vault',
  '/search/test',
  'product-team-mission-run/v1',
  'backend-product-team-mission-runs-snapshot',
  'collaboration-intent-run-customer-agent-handoff-intent',
  "artifactType: 'discovery-report'",
  "artifactType: 'brainstorm-board'",
  "artifactType: 'evidence-packet'",
  "artifactType: 'product-brief'",
  "artifactType: 'decision-proposal'",
  "artifactType: 'risk-review'",
  "verdict: 'changes-requested'",
  "artifactType: 'revision-note'",
  "artifactType: 'implementation-plan'",
  "artifactType: 'final-deliverable'",
  'backend-sync-manager-view',
  'backend-manager-submissions-snapshot',
  '/artifact-quality-audit',
  'generic-artifact-type-coverage',
  '/manager-flow-graph',
  '/readiness-proof-map',
  '/product-team-delivery-trace',
  '/submission-review-workflow',
  '/transcripts/main',
  '/timeline',
  '/events',
]) {
  assert(
    realUserZeroToAutonomySource.includes(text),
    `Real-user zero-to-autonomy validation must keep the zero-to-deliverable proof step: ${text}.`,
  );
}

console.log('Local MVP release checklist validation passed.');
