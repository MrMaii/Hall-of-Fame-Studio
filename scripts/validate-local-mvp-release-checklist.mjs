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

function assertProviderSecretInputGatedByTestId(source, testId) {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,1000}?/>`));
  assert(match, `Expected ${testId} input to exist.`);
  assert(match[0].includes('onChange='), `${testId} must keep its controlled input handler for backend-target draft entry.`);
  assert(match[0].includes('disabled={!settingsProviderSecretInputReady}'), `${testId} must be locked until the saved backend target is ready for draft entry.`);
}

function nonActionableBackendRequiredPanels(source) {
  const pattern = /data-testid=\{?`?"?([^"`}]*(?:backend-required|missing-backend)[^"`}]*)/g;
  const seen = new Set();
  const rows = [];
  let match = pattern.exec(source);
  while (match) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      const block = source.slice(Math.max(0, match.index - 450), Math.min(source.length, match.index + 1400));
      if (!/<button\b/.test(block) || !/syncBackend|Sync |sync[A-Z]|onClick/.test(block)) {
        rows.push(id);
      }
    }
    match = pattern.exec(source);
  }
  return rows;
}

function backendSyncButtonUsesConfiguredProjectGuard(source, testId, expectedGuard = 'disabled={backendWorkerStationSyncDisabled}') {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,900}?</button>`));
  return Boolean(match && match[0].includes(expectedGuard));
}

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const readme = read('README.md');
const prdSource = read('PRD.md');
const roadmapSource = read('ROADMAP.md');
const technicalSource = read('TECHNICAL.md');
const launchGateDoc = read('docs/LAUNCH_READINESS_GATES.md');
const mockRegister = read('docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md');
const appSource = read('src/App.jsx');
const personSkillSystemSource = read('src/skills/personSkillSystem.js');
const enLocaleSource = read('src/i18n/locales/en.js');
const zhLocaleSource = read('src/i18n/locales/zh.js');
const agentReadmeSource = read('src/agents/README.md');
const architectureAuditSource = read('src/agents/ARCHITECTURE_AUDIT.md');
const agentProjectServiceSource = read('src/agents/agentProjectService.js');
const agentProjectApiSource = read('src/agents/agentProjectApi.js');
const accessControlSource = read('src/agents/accessControl.js');
const productTeamCoreSmokeSource = read('scripts/validate-product-team-core-smoke.mjs');
const researchSampleProductTeamGateSource = read('scripts/validate-research-sample-product-team-gate.mjs');
const localMvpProductTeamProofSource = read('scripts/validate-local-mvp-product-team-proof.mjs');
const productTeamAcceptanceSource = read('scripts/validate-product-team-acceptance-scenario.mjs');
const productTeamAcceptanceStageRunnerSource = read('scripts/run-product-team-acceptance-stage.mjs');
const agentManagerScenarioSource = read('scripts/validate-agent-manager-scenario.mjs');
const privatePilotUiSource = read('scripts/validate-manager-private-pilot-ui.mjs');
const managerBackendCoreUiSource = read('scripts/validate-manager-backend-core-ui.mjs');
const managerBackendUiSource = read('scripts/validate-manager-backend-ui.mjs');
const managerMissionRunnerUiSource = read('scripts/validate-manager-mission-runner-ui.mjs');
const missionRunnerStartupHttpSource = read('scripts/validate-mission-runner-startup-http.mjs');
const settingsAgentsServerUiSource = read('scripts/validate-settings-agents-server-ui.mjs');
const realUserZeroToAutonomySource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs');
const realUserZeroToAutonomyApiSource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs');
const realUserZeroToAutonomyReportValidationSource = read('scripts/validate-real-user-zero-to-autonomy-report.mjs');
const privateMvpLaunchPackageSource = read('scripts/report-private-mvp-launch-package.mjs');
const privateMvpLaunchPackageValidationSource = read('scripts/validate-private-mvp-launch-package.mjs');
const launchOperationsPrivateMvpValidationSource = read('scripts/validate-launch-operations-private-mvp-package.mjs');
const frontendMockBoundariesSource = read('scripts/validate-frontend-mock-boundaries.mjs');
const adapterGatewayRuntimeSource = read('src/agents/adapterGatewayServer.js');
const adapterGatewayServerSource = read('scripts/validate-adapter-gateway-server.mjs');
const adapterGatewayHttpModeSource = read('scripts/validate-adapter-gateway-http-mode.mjs');
const adapterGatewayPostgresValidationSource = read('scripts/validate-adapter-gateway-postgres-store.mjs');
const managedInfrastructureCutoverAttestationsSource = read('scripts/validate-managed-infrastructure-cutover-attestations.mjs');
const productionEvidenceIntegritySource = read('scripts/validate-production-evidence-integrity-contract.mjs');
const publicProductionStartupReadinessSource = read('scripts/validate-public-production-startup-readiness-contract.mjs');
const publicProductionReadinessReportSource = read('scripts/report-public-production-readiness.mjs');
const publicProductionReadinessReportValidationSource = read('scripts/validate-public-production-readiness-report.mjs');
const publicProductionNoGoSource = read('scripts/validate-public-production-no-go.mjs');
const productionAccessControlSource = read('scripts/validate-production-access-control-contract.mjs');
const productionManagedIdentitySource = read('scripts/validate-production-managed-identity-contract.mjs');
const productionManagedSecretsSource = read('scripts/validate-production-managed-secrets-contract.mjs');
const productionManagedPersistenceSource = read('scripts/validate-production-managed-persistence-contract.mjs');
const productionManagedWorkerQueueSource = read('scripts/validate-production-managed-worker-queue-contract.mjs');
const productionProviderControlsSource = read('scripts/validate-production-provider-controls-contract.mjs');
const productionDataGovernanceSource = read('scripts/validate-production-data-governance-contract.mjs');
const productionTrafficControlsSource = read('scripts/validate-production-traffic-controls-contract.mjs');
const productionCustomerAcceptanceSource = read('scripts/validate-production-customer-acceptance-contract.mjs');
const productionOperationsStartupSource = read('scripts/validate-production-operations-startup-contract.mjs');
const managedEnvironmentPreflightSource = read('scripts/report-managed-environment-preflight.mjs');
const managedEnvironmentPreflightValidationSource = read('scripts/validate-managed-environment-preflight.mjs');
const productionLaunchGovernanceSource = read('scripts/validate-production-launch-governance-contract.mjs');
const agentArtifactPathContractSource = read('scripts/validate-agent-artifact-path-contract.mjs');
const transcriptContractsSource = read('scripts/validate-transcript-contracts.mjs');
const transcriptSearchContractSource = read('scripts/validate-transcript-search-contract.mjs');
const transcriptChannelPinContractSource = read('scripts/validate-transcript-channel-pin-contract.mjs');
const transcriptPinContractSource = read('scripts/validate-transcript-pin-contract.mjs');
const transcriptReplyContractSource = read('scripts/validate-transcript-reply-contract.mjs');
const transcriptMentionContractSource = read('scripts/validate-transcript-mention-contract.mjs');
const transcriptAttachmentContractSource = read('scripts/validate-transcript-attachment-contract.mjs');
const transcriptMemberPresenceContractSource = read('scripts/validate-transcript-member-presence-contract.mjs');
const timelineActionContractSource = read('scripts/validate-timeline-action-contract.mjs');
const agentWorkbenchContractSource = read('scripts/validate-agent-workbench-contract.mjs');
const agentMessageContractSource = read('scripts/validate-agent-message-contract.mjs');
const agentContractContractSource = read('scripts/validate-agent-contract-contract.mjs');
const managerChatCommandContractSource = read('scripts/validate-manager-chat-command-contract.mjs');
const managerScenarioContractSource = read('scripts/validate-manager-scenario-contract.mjs');
const settingsHealthReadinessContractSource = read('scripts/validate-settings-health-readiness-contract.mjs');
const settingsContractsSource = read('scripts/validate-settings-contracts.mjs');

assert(
  nonActionableBackendRequiredPanels(appSource).length === 0,
  `Backend-required Manager/UI panels must expose an in-panel recovery action: ${nonActionableBackendRequiredPanels(appSource).join(', ')}`,
);

const p0Commands = [
  'build',
  'skills:check',
  'skills:blend',
  'agents:scenario',
  'agents:scenario:contract',
  'agents:server:validate',
  'agents:local-mvp-startup-readiness',
  'agents:public-production-startup-readiness',
  'agents:public-production-readiness-report',
  'agents:public-production-readiness-report:validate',
  'agents:managed-environment-preflight',
  'agents:managed-environment-preflight:validate',
  'agents:managed-infrastructure-cutover-attestations',
  'agents:settings-health-readiness',
  'agents:settings-runtime-readiness',
  'agents:model-provider-adapter',
  'agents:settings-provider-readiness',
  'agents:settings-integration-readiness',
  'agents:settings-contracts',
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
  'agents:product-team:local-mvp',
  'agents:transcript-contracts',
  'agents:transcript-channel-create',
  'agents:transcript-search',
  'agents:transcript-channel-pin',
  'agents:transcript-pin',
  'agents:transcript-reply',
  'agents:transcript-mention',
  'agents:transcript-attachment',
  'agents:transcript-member-presence',
  'agents:timeline-action',
  'agents:agent-workbench-contract',
  'agents:agent-message-contract',
  'agents:agent-contract',
  'agents:manager-chat-command-contract',
  'ui:mock-boundaries',
  'agents:real-user-zero-to-autonomy',
  'agents:real-user-zero-to-autonomy-report',
  'agents:real-user-zero-to-autonomy-report:validate',
  'agents:private-mvp-launch-package',
  'agents:private-mvp-launch-package:validate',
  'agents:launch-operations:private-mvp',
  'agents:mission-runner:startup',
  'agents:product-team:core',
  'agents:product-team:core:file-backed',
  'agents:product-team:research-sample',
  'agents:product-team:cycle-consistency',
  'ui:manager-backend:core',
  'ui:manager-backend:core:dev',
  'ui:manager-backend:real-user-chain',
  'ui:manager-backend:real-user-chain:dev',
  'ui:manager-backend:proof-navigation',
  'ui:manager-backend:private-pilot-panels',
  'ui:manager-backend:production-controls',
  'ui:manager-provider-proof',
  'ui:settings-agents-server',
  'ui:settings-agents-server:dev',
  'ui:manager-mission-runner',
  'ui:real-user-zero-to-autonomy',
  'ui:real-user-zero-to-autonomy:dev',
];

const p1Commands = [
  'launch:private-pilot:check',
  'agents:product-team:private-pilot:focused',
  'agents:product-team:private-pilot',
  'ui:manager-private-pilot',
  'ui:manager-private-pilot:dev',
];

const p2Commands = [
  'agents:production-access-control',
  'agents:production-managed-identity',
  'agents:production-managed-secrets',
  'agents:production-managed-persistence',
  'agents:production-managed-worker-queue',
  'agents:production-provider-controls',
  'agents:production-data-governance',
  'agents:production-traffic-controls',
  'agents:production-customer-acceptance',
  'agents:production-operations-startup',
  'launch:infra',
  'launch:public-production:no-go',
];

const requiredScripts = [...p0Commands, ...p1Commands, ...p2Commands, 'launch:gates'];

for (const scriptName of requiredScripts) {
  assert(scripts[scriptName], `package.json must expose ${scriptName}.`);
  assert(launchGateDoc.includes(`npm run ${scriptName}`), `docs/LAUNCH_READINESS_GATES.md must list npm run ${scriptName}.`);
  for (const target of scriptNodeTargets(scripts[scriptName])) {
    assert(existsSync(resolve(repoRoot, target)), `${scriptName} points to missing script target ${target}.`);
  }
}

assert(
  agentProjectServiceSource.includes('getAccessControlPolicy()')
    && agentProjectServiceSource.includes("apiPath: '/access-control-policy'")
    && agentProjectApiSource.includes("path === '/access-control-policy'")
    && agentProjectApiSource.includes('buildAccessControlPolicySnapshot')
    && productionAccessControlSource.includes('assertApiPolicyRouteDocumentsContracts')
    && productionAccessControlSource.includes('/access-control-policy')
    && productionAccessControlSource.includes('Access control policy route must not leak the configured signing secret')
    && launchGateDoc.includes('GET /access-control-policy')
    && technicalSource.includes('`GET /access-control-policy` exposes the global `access-control-policy/v1`')
    && prdSource.includes('GET /access-control-policy'),
  'Production access-control operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getManagedIdentityPolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'managed-identity-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/managed-identity-policy'")
    && agentProjectApiSource.includes("path === '/managed-identity-policy'")
    && productionManagedIdentitySource.includes('assertManagedIdentityPolicyRoute')
    && productionManagedIdentitySource.includes('/managed-identity-policy')
    && productionManagedIdentitySource.includes('Managed identity policy route must not expose identity issuer token values')
    && launchGateDoc.includes('GET /managed-identity-policy')
    && technicalSource.includes('`GET /managed-identity-policy` exposes the global `managed-identity-policy/v1`')
    && prdSource.includes('GET /managed-identity-policy'),
  'Production managed identity operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getManagedSecretManagerPolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'managed-secret-manager-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/managed-secret-manager-policy'")
    && agentProjectApiSource.includes("path === '/managed-secret-manager-policy'")
    && productionManagedSecretsSource.includes('assertManagedSecretManagerPolicyRoute')
    && productionManagedSecretsSource.includes('/managed-secret-manager-policy')
    && productionManagedSecretsSource.includes('Managed Secret Manager/KMS policy must not expose endpoint token values')
    && launchGateDoc.includes('GET /managed-secret-manager-policy')
    && technicalSource.includes('`GET /managed-secret-manager-policy` exposes the global `managed-secret-manager-policy/v1`')
    && prdSource.includes('GET /managed-secret-manager-policy'),
  'Production managed Secret Manager/KMS operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getManagedPersistencePolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'managed-persistence-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/managed-persistence-policy'")
    && agentProjectApiSource.includes("path === '/managed-persistence-policy'")
    && productionManagedPersistenceSource.includes('assertManagedPersistencePolicyRoute')
    && productionManagedPersistenceSource.includes('/managed-persistence-policy')
    && productionManagedPersistenceSource.includes('Managed persistence policy must not expose database password values')
    && launchGateDoc.includes('GET /managed-persistence-policy')
    && technicalSource.includes('`GET /managed-persistence-policy` exposes the global `managed-persistence-policy/v1`')
    && prdSource.includes('GET /managed-persistence-policy'),
  'Production managed persistence operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getManagedWorkerQueuePolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'managed-worker-queue-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/managed-worker-queue-policy'")
    && agentProjectApiSource.includes("path === '/managed-worker-queue-policy'")
    && productionManagedWorkerQueueSource.includes('assertManagedWorkerQueuePolicyRoute')
    && productionManagedWorkerQueueSource.includes('/managed-worker-queue-policy')
    && productionManagedWorkerQueueSource.includes('Managed worker queue policy must not expose queue endpoint token values')
    && launchGateDoc.includes('GET /managed-worker-queue-policy')
    && technicalSource.includes('`GET /managed-worker-queue-policy` exposes the global `managed-worker-queue-policy/v1`')
    && prdSource.includes('GET /managed-worker-queue-policy'),
  'Production managed worker queue operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getProductionProviderControlsPolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'production-provider-controls-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/production-provider-controls-policy'")
    && agentProjectApiSource.includes("path === '/production-provider-controls-policy'")
    && productionProviderControlsSource.includes('assertProductionProviderControlsPolicyRoute')
    && productionProviderControlsSource.includes('/production-provider-controls-policy')
    && productionProviderControlsSource.includes('Production provider controls policy must not expose usage audit endpoint token values')
    && launchGateDoc.includes('GET /production-provider-controls-policy')
    && technicalSource.includes('`GET /production-provider-controls-policy` exposes the global `production-provider-controls-policy/v1`')
    && prdSource.includes('GET /production-provider-controls-policy'),
  'Production provider controls operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getProductionDataGovernancePolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'production-data-governance-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/production-data-governance-policy'")
    && agentProjectApiSource.includes("path === '/production-data-governance-policy'")
    && productionDataGovernanceSource.includes('assertProductionDataGovernancePolicyRoute')
    && productionDataGovernanceSource.includes('/production-data-governance-policy')
    && productionDataGovernanceSource.includes('Production data governance policy must not expose deletion endpoint token values')
    && launchGateDoc.includes('GET /production-data-governance-policy')
    && technicalSource.includes('`GET /production-data-governance-policy` exposes the global `production-data-governance-policy/v1`')
    && prdSource.includes('GET /production-data-governance-policy'),
  'Production data governance operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getProductionTrafficPolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'production-traffic-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/production-traffic-policy'")
    && agentProjectApiSource.includes("path === '/production-traffic-policy'")
    && productionTrafficControlsSource.includes('assertProductionTrafficPolicyRoute')
    && productionTrafficControlsSource.includes('/production-traffic-policy')
    && productionTrafficControlsSource.includes('Production traffic policy must not expose traffic gateway token values')
    && launchGateDoc.includes('GET /production-traffic-policy')
    && technicalSource.includes('`GET /production-traffic-policy` exposes the global `production-traffic-policy/v1`')
    && prdSource.includes('GET /production-traffic-policy'),
  'Production traffic/rollback operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getProductionCustomerAcceptancePolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'production-customer-acceptance-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/production-customer-acceptance-policy'")
    && agentProjectApiSource.includes("path === '/production-customer-acceptance-policy'")
    && productionCustomerAcceptanceSource.includes('assertProductionCustomerAcceptancePolicyRoute')
    && productionCustomerAcceptanceSource.includes('/production-customer-acceptance-policy')
    && productionCustomerAcceptanceSource.includes('Production customer acceptance policy must not expose customer acceptance checksum values')
    && launchGateDoc.includes('GET /production-customer-acceptance-policy')
    && technicalSource.includes('`GET /production-customer-acceptance-policy` exposes the global `production-customer-acceptance-policy/v1`')
    && prdSource.includes('GET /production-customer-acceptance-policy'),
  'Production customer acceptance operator policy route must stay wired through service, API, validation, and docs.',
);
assert(
  agentProjectServiceSource.includes('getProductionOperationsPolicy()')
    && agentProjectServiceSource.includes("schemaVersion: 'production-operations-policy/v1'")
    && agentProjectServiceSource.includes("apiPath: '/production-operations-policy'")
    && agentProjectApiSource.includes("path === '/production-operations-policy'")
    && productionOperationsStartupSource.includes('assertProductionOperationsPolicyRoute')
    && productionOperationsStartupSource.includes('/production-operations-policy')
    && productionOperationsStartupSource.includes('Production operations policy must not expose observability endpoint token values')
    && launchGateDoc.includes('GET /production-operations-policy')
    && technicalSource.includes('`GET /production-operations-policy` exposes the global `production-operations-policy/v1`')
    && prdSource.includes('GET /production-operations-policy'),
  'Production operations operator policy route must stay wired through service, API, validation, and docs.',
);

const requiredEntryFiles = [
  'scripts/validate-agent-project-server-secret-vault.mjs',
  'scripts/validate-local-mvp-startup-readiness-contract.mjs',
  'scripts/validate-public-production-startup-readiness-contract.mjs',
  'scripts/report-public-production-readiness.mjs',
  'scripts/validate-public-production-readiness-report.mjs',
  'scripts/validate-public-production-no-go.mjs',
  'scripts/validate-production-provider-controls-contract.mjs',
  'scripts/validate-production-data-governance-contract.mjs',
  'scripts/validate-production-traffic-controls-contract.mjs',
  'scripts/validate-production-customer-acceptance-contract.mjs',
  'scripts/validate-production-operations-startup-contract.mjs',
  'scripts/report-managed-environment-preflight.mjs',
  'scripts/validate-managed-environment-preflight.mjs',
  'scripts/validate-managed-infrastructure-cutover-attestations.mjs',
  'scripts/validate-agent-artifact-path-contract.mjs',
  'scripts/validate-transcript-contracts.mjs',
  'scripts/validate-transcript-channel-create-contract.mjs',
  'scripts/validate-transcript-search-contract.mjs',
  'scripts/validate-transcript-channel-pin-contract.mjs',
  'scripts/validate-transcript-pin-contract.mjs',
  'scripts/validate-transcript-reply-contract.mjs',
  'scripts/validate-transcript-mention-contract.mjs',
  'scripts/validate-transcript-attachment-contract.mjs',
  'scripts/validate-transcript-member-presence-contract.mjs',
  'scripts/validate-timeline-action-contract.mjs',
  'scripts/validate-agent-workbench-contract.mjs',
  'scripts/validate-agent-message-contract.mjs',
  'scripts/validate-agent-contract-contract.mjs',
  'scripts/validate-manager-chat-command-contract.mjs',
  'scripts/validate-manager-scenario-contract.mjs',
  'scripts/validate-settings-health-readiness-contract.mjs',
  'scripts/validate-settings-runtime-readiness-contract.mjs',
  'scripts/validate-model-provider-adapter-contract.mjs',
  'scripts/validate-settings-provider-readiness-contract.mjs',
  'scripts/validate-settings-integration-readiness-contract.mjs',
  'scripts/validate-settings-contracts.mjs',
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
  'scripts/validate-mission-runner-startup-http.mjs',
  'scripts/validate-research-sample-product-team-gate.mjs',
  'scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs',
  'scripts/validate-real-user-zero-to-autonomy-report.mjs',
  'scripts/report-private-mvp-launch-package.mjs',
  'scripts/validate-private-mvp-launch-package.mjs',
  'scripts/validate-launch-operations-private-mvp-package.mjs',
  'scripts/validate-settings-agents-server-ui.mjs',
  'scripts/validate-manager-mission-runner-ui.mjs',
  'scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs',
  'scripts/validate-frontend-mock-boundaries.mjs',
  'scripts/validate-manager-private-pilot-ui.mjs',
  'scripts/run-product-team-acceptance-stage.mjs',
  'src/skills/personSkillSystem.js',
  'skills/hall-of-fame-personas/build/personas.json',
  'skills/hall-of-fame-personas/SKILL.md',
  'skills/hall-of-fame-personas/references/persona-schema.md',
  'skills/hall-of-fame-personas/references/persona-authoring-template.md',
  'skills/hall-of-fame-personas/references/agent-production-guide.md',
];

for (const file of requiredEntryFiles) {
  assert(existsSync(resolve(repoRoot, file)), `Local MVP release checklist requires ${file}.`);
}

assert(
  scripts['skills:check'] === 'node scripts/run-persona-skill-checks.mjs check'
    && scripts['skills:blend'] === 'node scripts/validate-persona-skill-blends.mjs'
    && personSkillSystemSource.includes('../../skills/hall-of-fame-personas/build/personas.json')
    && personSkillSystemSource.includes('../../skills/hall-of-fame-personas/personas/*/SKILL.md')
    && personSkillSystemSource.includes('export const PERSON_SKILLS = personas')
    && personSkillSystemSource.includes('export const PERSON_SKILL_COUNT')
    && personSkillSystemSource.includes('export const PERSON_SKILL_DOC_COUNT')
    && personSkillSystemSource.includes('buildPersonaSkillBlend')
    && personSkillSystemSource.includes('buildPersonaProfessionalBrief')
    && personSkillSystemSource.includes('buildPersonActingBrief')
    && productTeamCoreSmokeSource.includes('getPersonSkill(member.id)')
    && productTeamCoreSmokeSource.includes('canonical persona skill')
    && productTeamCoreSmokeSource.includes('persona + professional skill blend')
    && readme.includes('npm run skills:check')
    && readme.includes('npm run skills:blend')
    && technicalSource.includes('canonical persona skill package')
    && agentReadmeSource.includes('five layers')
    && architectureAuditSource.includes('Persona Skill validation now has npm-facing gates'),
  'Local MVP persona supply must stay tied to the canonical Skill package, app bridge, blend gate, and product-team smoke proof.',
);

assert(
  publicProductionNoGoSource.includes('scripts/validate-production-infrastructure-gates.mjs')
    && publicProductionNoGoSource.includes('getPublicProductionStartupReadiness')
    && publicProductionNoGoSource.includes("readyForPublicProduction === false")
    && publicProductionNoGoSource.includes('scripts/report-public-production-readiness.mjs')
    && publicProductionNoGoSource.includes("status === 'public-production-blocked'"),
  'Public production no-go script must run infrastructure rehearsal and explicitly assert no-go startup/report status.',
);

assert(
  scripts['agents:artifact-paths'] === 'node scripts/validate-agent-artifact-path-contract.mjs'
    && agentProjectServiceSource.includes('shortArtifactHash')
    && agentProjectServiceSource.includes('artifactFileName')
    && agentProjectServiceSource.includes("relativePath: `submissions/${slugPart(agent.id).slice(0, 32)}/${normalizedType}/${artifactFileName}`")
    && agentArtifactPathContractSource.includes('Agent work-cycle artifact')
    && agentArtifactPathContractSource.includes('Agent submission artifact')
    && agentArtifactPathContractSource.includes('Generated draft submission artifact')
    && !agentProjectServiceSource.includes('relativePath: `submissions/${agent.id}/${normalizedType}/${submissionId}.${extension}`'),
  'Agent artifact storage must use bounded local file paths while preserving submission/storage proof checksums.',
);

assert(
  scripts['agents:transcript-contracts'] === 'node scripts/validate-transcript-contracts.mjs'
    && scripts['agents:transcript-channel-create'] === 'node scripts/validate-transcript-channel-create-contract.mjs'
    && transcriptContractsSource.includes('validate-transcript-channel-create-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-search-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-channel-pin-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-pin-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-reply-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-mention-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-attachment-contract.mjs')
    && transcriptContractsSource.includes('validate-transcript-member-presence-contract.mjs')
    && transcriptContractsSource.includes('Group Chat transcript low-write contract validation passed.'),
  'Group Chat transcript contracts must expose one low-write aggregate gate for search, pin, reply, mention, attachment, and presence proof.',
);

const requiredSettingsContractImports = [
  'validate-settings-health-readiness-contract.mjs',
  'validate-settings-runtime-readiness-contract.mjs',
  'validate-settings-provider-readiness-contract.mjs',
  'validate-settings-integration-readiness-contract.mjs',
  'validate-project-settings-privacy-policy.mjs',
  'validate-project-settings-provider-budget-policy.mjs',
  'validate-project-settings-tool-grant-policy.mjs',
  'validate-project-settings-integration-capabilities.mjs',
  'validate-project-settings-workspace-capabilities.mjs',
];

assert(
  scripts['agents:settings-contracts'] === 'node scripts/validate-settings-contracts.mjs'
    && requiredSettingsContractImports.every((marker) => settingsContractsSource.includes(marker))
    && settingsContractsSource.includes('Settings backend contract aggregate validation passed.'),
  'Settings contracts must expose one low-write aggregate gate for health, runtime, provider, integration, and project policy proof.',
);

assert(
  scripts['agents:transcript-search'] === 'node scripts/validate-transcript-search-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-search/v1'")
    && agentProjectServiceSource.includes('searchTranscripts(projectId, options = {})')
    && agentProjectApiSource.includes("route.tail[0] === 'search'")
    && appSource.includes('project-chat-transcript-search-form')
    && appSource.includes('project-chat-transcript-search-input')
    && appSource.includes('project-chat-transcript-search-submit')
    && appSource.includes('project-chat-transcript-search-results')
    && appSource.includes('runBackendTranscriptSearch')
    && transcriptSearchContractSource.includes('/transcripts/search?query=')
    && transcriptSearchContractSource.includes("schemaVersion === 'transcript-search/v1'")
    && transcriptSearchContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-tool-search-backend-required'),
  'Group Chat transcript search must use the backend transcript-search contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-channel-pin'] === 'node scripts/validate-transcript-channel-pin-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-channel-pin/v1'")
    && agentProjectServiceSource.includes('pinTranscriptChannel({ projectId, ...input } = {})')
    && agentProjectApiSource.includes("route.tail[1] === 'channel-pin'")
    && appSource.includes('pinBackendTranscriptChannel')
    && appSource.includes('project-chat-tool-pin')
    && appSource.includes('project-chat-channel-pinned')
    && appSource.includes('proof-map-transcript-channel-pin-routes')
    && transcriptChannelPinContractSource.includes('/transcripts/main/channel-pin')
    && transcriptChannelPinContractSource.includes("schemaVersion === 'transcript-channel-pin/v1'")
    && transcriptChannelPinContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-tool-pin-backend-required'),
  'Group Chat channel pin must use the backend transcript-channel-pin contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-pin'] === 'node scripts/validate-transcript-pin-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-pin/v1'")
    && agentProjectServiceSource.includes('pinTranscriptMessage({ projectId, ...input } = {})')
    && agentProjectApiSource.includes("route.tail[1] === 'pins'")
    && appSource.includes('pinBackendTranscriptMessage')
    && appSource.includes('project-chat-message-pin-${message.id}')
    && appSource.includes('project-chat-message-pinned-${message.id}')
    && appSource.includes('proof-map-transcript-pin-routes')
    && transcriptPinContractSource.includes('/transcripts/main/pins')
    && transcriptPinContractSource.includes("schemaVersion === 'transcript-pin/v1'")
    && transcriptPinContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-message-pin-backend-required-'),
  'Group Chat per-message pin must use the backend transcript-pin contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-reply'] === 'node scripts/validate-transcript-reply-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-reply/v1'")
    && agentProjectServiceSource.includes('replyToTranscriptMessage({ projectId, ...input } = {})')
    && agentProjectApiSource.includes("route.tail[1] === 'replies'")
    && appSource.includes('replyToBackendTranscriptMessage')
    && appSource.includes('project-chat-message-reply-${message.id}')
    && appSource.includes('project-chat-message-replied-${message.id}')
    && appSource.includes('proof-map-transcript-reply-routes')
    && transcriptReplyContractSource.includes('/transcripts/main/replies')
    && transcriptReplyContractSource.includes("schemaVersion === 'transcript-reply/v1'")
    && transcriptReplyContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-message-reply-backend-required-'),
  'Group Chat per-message reply must use the backend transcript-reply contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-mention'] === 'node scripts/validate-transcript-mention-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-mention/v1'")
    && agentProjectServiceSource.includes('mentionTranscriptMessage({ projectId, ...input } = {})')
    && agentProjectApiSource.includes("route.tail[1] === 'mentions'")
    && appSource.includes('mentionBackendTranscriptMessage')
    && appSource.includes('project-chat-message-mention-${message.id}')
    && appSource.includes('project-chat-message-mentioned-${message.id}')
    && appSource.includes('proof-map-transcript-mention-routes')
    && transcriptMentionContractSource.includes('/transcripts/main/mentions')
    && transcriptMentionContractSource.includes("schemaVersion === 'transcript-mention/v1'")
    && transcriptMentionContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-message-mention-backend-required-'),
  'Group Chat per-message mention must use the backend transcript-mention contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-attachment'] === 'node scripts/validate-transcript-attachment-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-attachment/v1'")
    && agentProjectServiceSource.includes('attachTranscriptFile({ projectId, ...input } = {})')
    && agentProjectApiSource.includes("route.tail[1] === 'attachments'")
    && appSource.includes('uploadBackendTranscriptAttachment')
    && appSource.includes('project-chat-attachment')
    && appSource.includes('project-chat-message-attachment-${message.id}')
    && appSource.includes('proof-map-transcript-attachment-routes')
    && transcriptAttachmentContractSource.includes('/transcripts/main/attachments')
    && transcriptAttachmentContractSource.includes("schemaVersion === 'transcript-attachment/v1'")
    && transcriptAttachmentContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-attachment-backend-required'),
  'Group Chat attachments must use the backend transcript-attachment contract instead of a disabled backend-required placeholder.',
);

assert(
  scripts['agents:transcript-member-presence'] === 'node scripts/validate-transcript-member-presence-contract.mjs'
    && agentProjectServiceSource.includes("schemaVersion: 'transcript-member-presence/v1'")
    && agentProjectServiceSource.includes('getTranscriptMemberPresence(projectId, channelId =')
    && agentProjectApiSource.includes("route.tail[1] === 'members'")
    && appSource.includes('syncBackendTranscriptMemberPresence')
    && appSource.includes('project-chat-tool-members')
    && appSource.includes('project-chat-member-presence-panel')
    && appSource.includes('proof-map-transcript-member-presence-routes')
    && transcriptMemberPresenceContractSource.includes('/transcripts/main/members')
    && transcriptMemberPresenceContractSource.includes("schemaVersion === 'transcript-member-presence/v1'")
    && transcriptMemberPresenceContractSource.includes('readyForProduction === false')
    && !appSource.includes('project-chat-tool-members-backend-required'),
  'Group Chat member presence must use the backend transcript-member-presence read model instead of a disabled backend-required placeholder.',
);

assert(
  productTeamAcceptanceStageRunnerSource.includes("process.env.HOFS_PROGRESS = process.env.HOFS_PROGRESS || '0'")
    && privatePilotUiSource.includes("HOFS_PROGRESS: process.env.HOFS_PROGRESS || '0'")
    && launchGateDoc.includes('including UI harnesses that prepare product-team acceptance stores'),
  'Product-team acceptance stage runner and UI harnesses must default to quiet output and document HOFS_PROGRESS=1 as debug-only.',
);

const requiredProductProof = [
  'Research Project remains a validation sample',
  'general AI product-team system',
  'Agent submissions for `discovery-report`, `brainstorm-board`, `evidence-packet`, `product-brief`, `decision-proposal`, `risk-review`, `revision-note`, `implementation-plan`, and `final-deliverable`',
  'low-write core-chain smoke gate',
  'Real-user agents:server API zero-to-autonomy proof',
  'Real-user Settings backend target entry plus provider seal and zero-to-autonomy browser proof',
  'Local MVP startup readiness through `local-mvp-startup-readiness/v1`',
  'Public production startup readiness through `public-production-startup-readiness/v1`',
  'production-customer-acceptance-startup-readiness/v1',
  'Agent submission node',
  'public production remains blocked',
];

for (const text of requiredProductProof) {
  assert(
    launchGateDoc.toLowerCase().includes(text.toLowerCase()),
    `Launch gate doc must preserve local MVP proof boundary: ${text}.`,
  );
}

assert(
  agentProjectServiceSource.includes("id: 'public-production-startup-readiness'")
    && agentProjectServiceSource.includes("source: 'publicProductionStartupReadiness'")
    && agentProjectServiceSource.includes('Public production startup preflight')
    && agentProjectServiceSource.includes('public-production-startup-readiness_gates')
    && agentProjectServiceSource.includes('Public-production startup no-go')
    && publicProductionStartupReadinessSource.includes('Manager Flow Graph must expose the public production startup readiness blocker node.')
    && publicProductionStartupReadinessSource.includes('Manager Flow Graph must connect public startup readiness into Production Launch Control Center.')
    && productionLaunchGovernanceSource.includes('Manager Flow Graph must keep the global public-production startup blocker visible after production approvals.')
    && launchGateDoc.includes('Manager Flow Graph, Manager UI, and the project-level Production Launch Control Center must link this route')
    && technicalSource.includes('separate `public-production-startup-readiness` blocker node')
    && agentReadmeSource.includes('Manager Flow Graph, Production Launch Control Center, and Manager UI link this route')
    && architectureAuditSource.includes('Manager Flow Graph, Production Launch Control Center, and Manager UI link the route'),
  'Public production startup readiness must be an explicit Manager Flow Graph blocker node wired into Production Launch Control Center.',
);
assert(
  publicProductionReadinessReportSource.includes("schemaVersion: 'public-production-readiness-operator-report/v1'")
    && publicProductionReadinessReportSource.includes("schemaVersion: 'public-production-action-plan/v1'")
    && publicProductionReadinessReportSource.includes('createAgentProjectService')
    && publicProductionReadinessReportSource.includes('buildManagedEnvironmentPreflightReport')
    && publicProductionReadinessReportSource.includes('buildOperatorActionPlan')
    && publicProductionReadinessReportSource.includes('productionEnvironmentSetup')
    && publicProductionReadinessReportValidationSource.includes('public-production-action-plan/v1')
    && publicProductionReadinessReportSource.includes('Values are intentionally omitted')
    && publicProductionReadinessReportValidationSource.includes('Public production readiness operator report validation passed.')
    && publicProductionReadinessReportValidationSource.includes("managedEnvironmentPreflight?.schemaVersion === 'managed-environment-preflight-report/v1'")
    && publicProductionReadinessReportValidationSource.includes('readyForPublicProduction === false')
    && publicProductionReadinessReportValidationSource.includes("!serialized.includes('password')")
    && launchGateDoc.includes('`npm run agents:public-production-readiness-report` is the low-write operator report')
    && launchGateDoc.includes('managed-environment-preflight-report/v1')
    && launchGateDoc.includes('intentionally omits configured values'),
  'Public production readiness report must expose a redacted operator setup report without claiming public production readiness.',
);
assert(
  managedEnvironmentPreflightSource.includes("schemaVersion: 'managed-environment-preflight-report/v1'")
    && managedEnvironmentPreflightSource.includes('endpointClass')
    && managedEnvironmentPreflightSource.includes('--check-network')
    && managedEnvironmentPreflightSource.includes('Values are intentionally omitted')
    && managedEnvironmentPreflightValidationSource.includes('Managed environment preflight validation passed.')
    && managedEnvironmentPreflightValidationSource.includes('readyForManagedEnvironment === false')
    && managedEnvironmentPreflightValidationSource.includes("!serialized.includes('ADAPTER_GATEWAY_TOKEN_SHOULD_NOT_LEAK')")
    && launchGateDoc.includes('`npm run agents:managed-environment-preflight` is the low-write bridge from rehearsal to real managed infrastructure')
    && launchGateDoc.includes('local/private endpoints stay blocked'),
  'Managed environment preflight must separate real managed endpoints from local rehearsal without leaking configured values.',
);

assert(
  agentProjectServiceSource.includes("schemaVersion: 'production-customer-acceptance-startup-readiness/v1'")
    && agentProjectServiceSource.includes("id: 'customer-production-acceptance-policy'")
    && agentProjectServiceSource.includes("id: 'customer-production-acceptance'")
    && publicProductionStartupReadinessSource.includes('Customer production acceptance startup readiness must reject invalid or unsigned managed-production evidence.')
    && publicProductionStartupReadinessSource.includes('Customer production acceptance gate must pass after signed customer acceptance evidence.')
    && publicProductionStartupReadinessSource.includes('backend-production-customer-acceptance-startup-readiness')
    && launchGateDoc.includes('production-customer-acceptance-startup-readiness/v1')
    && launchGateDoc.includes('customer-production-acceptance-policy')
    && technicalSource.includes('production-customer-acceptance-startup-readiness/v1')
    && agentReadmeSource.includes('production-customer-acceptance-startup-readiness/v1')
    && architectureAuditSource.includes('production-customer-acceptance-startup-readiness/v1'),
  'Customer production acceptance must be a fail-closed public-production startup sub-contract with backend, UI, docs, and validation coverage.',
);

const requiredResearchSampleGateMarkers = [
  "productTeamMissionRun?.schemaVersion === 'product-team-mission-run/v1'",
  'researchOnly === false',
  "missionType === 'generic-product-team'",
  'leader-campaign',
  'self-nomination',
  'discovery-report',
  'brainstorm-board',
  'evidence-packet',
  '/evidence-source-review-workflow',
  'sourceReviewDecisionCount',
  'pendingDecisionSourceCount === 0',
  'agent-artifact-draft/v1',
  'changes-requested',
  'revision-note',
  'final-deliverable',
  'accepted',
  '/artifact-quality-audit',
  'draft-review-revision-final-loop',
  'generic-artifact-type-coverage',
  '/submission-review-workflow',
  '/product-team-delivery-trace',
  '/planner-executor-reviewer-state-machine',
  'readyForLocalProductTeamStateMachine',
  '/manager-flow-graph',
  '/readiness-proof-map',
  '/transcripts/main',
  '/timeline',
  '/events',
  '/evidence-index-readiness',
  '/project-evidence-archive',
  "archive.status === 'archive-ready'",
  'readyForManagerHandoff === true',
  'evidence-source-review-decisions',
  'artifact-storage-proofs',
  'workspaceFileProofCount',
  'project-memory-readiness/v1',
  'readyForProduction === false',
];

for (const marker of requiredResearchSampleGateMarkers) {
  assert(
    researchSampleProductTeamGateSource.includes(marker),
    `Research validation sample gate must require marker: ${marker}`,
  );
}

const requiredMockReplacementProof = [
  'Settings API key/search endpoint fields are draft-enabled after a saved backend target',
  '`Seal` persistence stays locked until the Secret Vault is ready',
  'Search endpoint/key configuration becomes durable only through backend Secret Vault receipts',
  'local-mvp-startup-readiness/v1',
  'Project Initiation now reuses the same startup readiness gate before starting a real kickoff',
  'public-production-startup-readiness/v1',
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
  'npm run agents:real-user-zero-to-autonomy-report',
  'npm run agents:real-user-zero-to-autonomy-report:validate',
  'npm run agents:local-mvp-startup-readiness',
  'npm run agents:settings-health-readiness',
  'npm run agents:settings-runtime-readiness',
  'npm run agents:settings-integration-readiness',
  'npm run agents:settings-contracts',
  'npm run agents:evidence-index-readiness',
  'npm run agents:budget-alert-readiness',
  'npm run agents:error-reporting-readiness',
  'npm run ui:real-user-zero-to-autonomy',
  'npm run ui:real-user-zero-to-autonomy:dev',
  'http://127.0.0.1:5173',
  'probes the local `localhost` counterpart',
  'Browser-snapshot backend writes are now limited to sample fixture or explicit development fallback projects',
  'development fallback projects are tagged as non-real and excluded from backend writes',
  'Sample Fixture Path is hidden for real backend projects',
  'Unified Event Ledger now consumes backend `/events` rows as `event-ledger/v1`',
  '24/7 Operations Board, Continuous Work Loop, and Fixed Work Routines now consume backend Agent state rows',
  'Timeline detail now posts Manager notes, acknowledgements, completion marks, and edit notes to `POST /projects/:id/timeline/actions`',
  'timeline-action-receipt/v1',
  'Seed Sample/Dev',
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
  scripts['agents:real-user-zero-to-autonomy-report'] === 'node scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs --report'
    && scripts['agents:real-user-zero-to-autonomy-report:validate'] === 'node scripts/validate-real-user-zero-to-autonomy-report.mjs',
  'Real-user zero-to-autonomy report scripts must reuse the real backend API startup gate.',
);
assert(
  scripts['agents:private-mvp-launch-package'] === 'node scripts/report-private-mvp-launch-package.mjs'
    && scripts['agents:private-mvp-launch-package:validate'] === 'node scripts/validate-private-mvp-launch-package.mjs'
    && scripts['agents:launch-operations:private-mvp'] === 'node scripts/validate-launch-operations-private-mvp-package.mjs'
    && privateMvpLaunchPackageSource.includes('private-mvp-launch-package/v1')
    && privateMvpLaunchPackageSource.includes('validate-real-user-zero-to-autonomy-agents-server-api.mjs')
    && privateMvpLaunchPackageSource.includes('report-public-production-readiness.mjs')
    && privateMvpLaunchPackageSource.includes('private-mvp-ready-public-production-blocked')
    && privateMvpLaunchPackageValidationSource.includes('Public production: no-go')
    && privateMvpLaunchPackageValidationSource.includes('npm run launch:public-production:no-go')
    && launchOperationsPrivateMvpValidationSource.includes("schemaVersion === 'launch-operations-overview/v1'")
    && launchOperationsPrivateMvpValidationSource.includes("private-mvp-launch-package-boundary/v1")
    && launchOperationsPrivateMvpValidationSource.includes('service.getLaunchOperationsOverview(projectId)')
    && launchOperationsPrivateMvpValidationSource.includes('assertPublicProductionNextSteps')
    && launchOperationsPrivateMvpValidationSource.includes('publicProductionNextSteps')
    && launchOperationsPrivateMvpValidationSource.includes('why public production is blocked')
    && launchOperationsPrivateMvpValidationSource.includes("schemaVersion === 'launch-operations-next-step-run/v1'")
    && launchOperationsPrivateMvpValidationSource.includes('getManagerFlowGraph(projectId')
    && launchOperationsPrivateMvpValidationSource.includes("subtype === 'launch-operations-next-step-run'")
    && launchOperationsPrivateMvpValidationSource.includes('launchOperationsOverviewSummary?.nextStepRunCount')
    && launchOperationsPrivateMvpValidationSource.includes('api.handle({')
    && launchOperationsPrivateMvpValidationSource.includes('GET')
    && launchOperationsPrivateMvpValidationSource.includes('/launch-operations-overview')
    && technicalSource.includes('`npm run agents:private-mvp-launch-package` is the operator launch package')
    && technicalSource.includes('emits `private-mvp-launch-package/v1`')
    && technicalSource.includes('private-mvp-ready-public-production-blocked')
    && technicalSource.includes('forbidden to claim public-production readiness')
    && agentReadmeSource.includes('`npm run agents:private-mvp-launch-package`')
    && agentReadmeSource.includes('emits `private-mvp-launch-package/v1`')
    && agentReadmeSource.includes('keeps public production blocked')
    && architectureAuditSource.includes('Private MVP Launch Package verification')
    && architectureAuditSource.includes('`npm run agents:private-mvp-launch-package:validate` passes')
    && architectureAuditSource.includes('rejects secret/ciphertext/configured-value leakage'),
  'Private MVP launch package must aggregate zero-to-autonomy proof with public-production no-go proof.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('const { timeoutMs = 30000, ...fetchOptions } = options;')
    && realUserZeroToAutonomyApiSource.includes('const controller = new AbortController();')
    && realUserZeroToAutonomyApiSource.includes('controller.abort()')
    && realUserZeroToAutonomyApiSource.includes('timed out after ${timeoutMs}ms')
    && realUserZeroToAutonomyApiSource.includes('throw new Error(`${method} ${url} ${detail}`);'),
  'agents:real-user-zero-to-autonomy must fail with route-level diagnostics instead of hanging on backend API requests.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('agent-project-server.mjs')
    && realUserZeroToAutonomyApiSource.includes('/secret-vault/seal')
    && realUserZeroToAutonomyApiSource.includes('/local-mvp-startup-readiness')
    && realUserZeroToAutonomyApiSource.includes("startupReadiness.readyForFirstProjectRun === true")
    && realUserZeroToAutonomyApiSource.includes("startupReadiness.nextAction?.id === 'start-product-team-mission'")
    && realUserZeroToAutonomyApiSource.includes('/product-team-missions')
    && realUserZeroToAutonomyApiSource.includes('/workspace/bind')
    && realUserZeroToAutonomyApiSource.includes('/local-runtime')
    && realUserZeroToAutonomyApiSource.includes('/workspace/write')
    && realUserZeroToAutonomyApiSource.includes('/workspace/read')
    && realUserZeroToAutonomyApiSource.includes('/agent-autonomous-action-queue/next/run')
    && realUserZeroToAutonomyApiSource.includes('assertAutonomousHandoffOutput')
    && realUserZeroToAutonomyApiSource.includes('agent-autonomous-action-run/v1')
    && realUserZeroToAutonomyApiSource.includes('autonomous-action-decision/v1')
    && realUserZeroToAutonomyApiSource.includes('/manager-flow-graph')
    && realUserZeroToAutonomyApiSource.includes('/readiness-proof-map')
    && realUserZeroToAutonomyApiSource.includes('/memory-readiness')
    && realUserZeroToAutonomyApiSource.includes('/transcripts/main')
    && realUserZeroToAutonomyApiSource.includes('/product-team-delivery-trace')
    && realUserZeroToAutonomyApiSource.includes('/zero-to-autonomy-report')
    && realUserZeroToAutonomyApiSource.includes("schemaVersion === 'project-zero-to-autonomy-report/v1'")
    && agentProjectServiceSource.includes("id: 'settings-byok-seal'")
    && appSource.includes("'settings-byok-seal'")
    && realUserZeroToAutonomyApiSource.includes("row.id === 'settings-byok-seal'")
    && !agentProjectServiceSource.includes("id: 'settings-byok-readiness'")
    && !appSource.includes("'settings-byok-readiness'"),
  'agents:real-user-zero-to-autonomy must cover Secret Vault, mission start, workspace binding, autonomous Agent continuation, and proof surfaces through the real backend API.',
);
const zeroToAutonomyTechnicalBulletCount = (
  technicalSource.match(/- project zero-to-autonomy report through `GET \/projects\/:id\/zero-to-autonomy-report`/g) || []
).length;
assert(
  zeroToAutonomyTechnicalBulletCount === 1
    && prdSource.includes('Settings/BYOK seal (`settings-byok-seal`)')
    && technicalSource.includes('The first stage id is `settings-byok-seal`')
    && agentReadmeSource.includes('The first report stage id is `settings-byok-seal`')
    && architectureAuditSource.includes('requires the shared first-stage id `settings-byok-seal`'),
  'Project zero-to-autonomy stage taxonomy must be documented once and share the Settings BYOK Seal stage id across PRD, Technical, Agent README, and Architecture Audit.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('openChangeReviews')
    && realUserZeroToAutonomyApiSource.includes('respondsToReviewId')
    && realUserZeroToAutonomyApiSource.includes('readyForPrivatePilotDelivery === true'),
  'agents:real-user-zero-to-autonomy must close every requested-change review before claiming the delivery trace is ready.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('/project-evidence-archive')
    && realUserZeroToAutonomyApiSource.includes('project-evidence-archive/v1')
    && realUserZeroToAutonomyApiSource.includes('/evidence-source-review-workflow')
    && realUserZeroToAutonomyApiSource.includes('sourceReviewDecisionCount')
    && realUserZeroToAutonomyApiSource.includes('pendingDecisionSourceCount === 0')
    && realUserZeroToAutonomyApiSource.includes('readyForManagerHandoff === true')
    && realUserZeroToAutonomyApiSource.includes('artifactStorageProofCoverageReady')
    && realUserZeroToAutonomyApiSource.includes('workspaceFileProofCount')
    && realUserZeroToAutonomyApiSource.includes("entry.id === 'artifact-storage-proofs'"),
  'agents:real-user-zero-to-autonomy must prove source decisions plus Project Evidence Archive storage/workspace proof coverage through the real backend API.',
);
assert(
  realUserZeroToAutonomyApiSource.includes("schemaVersion: 'real-user-zero-to-autonomy-operator-report/v1'")
    && realUserZeroToAutonomyApiSource.includes('local-mvp-zero-to-autonomy-ready')
    && realUserZeroToAutonomyApiSource.includes('readyForPublicProduction: false')
    && realUserZeroToAutonomyApiSource.includes('projectZeroToAutonomyChecksum')
    && realUserZeroToAutonomyApiSource.includes('formatZeroToAutonomyReportMarkdown')
    && realUserZeroToAutonomyReportValidationSource.includes('Real-user zero-to-autonomy operator report validation passed.')
    && realUserZeroToAutonomyReportValidationSource.includes('readyForPublicProduction === false')
    && realUserZeroToAutonomyReportValidationSource.includes("!serialized.includes('SHOULD_NOT_LEAK')")
    && realUserZeroToAutonomyReportValidationSource.includes('brainstorm-draft-review-revision-final')
    && launchGateDoc.includes('`npm run agents:real-user-zero-to-autonomy-report`'),
  'Real-user zero-to-autonomy operator report must summarize the actual backend chain without leaking secrets or claiming public production readiness.',
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
  productTeamCoreSmokeSource.includes('artifactStorageProofChecksum')
    && productTeamCoreSmokeSource.includes('/project-evidence-archive')
    && productTeamCoreSmokeSource.includes('project-evidence-archive/v1')
    && productTeamCoreSmokeSource.includes('artifactStorageProofCoverageReady')
    && productTeamCoreSmokeSource.includes('workspaceFileProofCount')
    && productTeamCoreSmokeSource.includes('/evidence-source-review-workflow')
    && productTeamCoreSmokeSource.includes('core-smoke-source-2')
    && productTeamCoreSmokeSource.includes('firstSourceReview.id')
    && productTeamCoreSmokeSource.includes('secondSourceReview.id')
    && productTeamCoreSmokeSource.includes("entry.id === 'artifact-storage-proofs'")
    && productTeamCoreSmokeSource.includes("entry.id === 'final-deliverables'")
    && productTeamCoreSmokeSource.includes("entry.id === 'artifact-quality-audit'")
    && productTeamCoreSmokeSource.includes("entry.id === 'group-chat-transcripts'")
    && productTeamCoreSmokeSource.includes('finalDeliverableCount >= 1')
    && productTeamCoreSmokeSource.includes('artifactQualityReady === true')
    && productTeamCoreSmokeSource.includes('artifactQuality.body.artifactQualityAudit?.readyForLocalPilot === true')
    && productTeamCoreSmokeSource.includes('transcriptProofCoverageReady === true')
    && productTeamCoreSmokeSource.includes('transcriptMissingProofIdCount === 0')
    && productTeamCoreSmokeSource.includes('Submission route must expose ${artifactType} with chat, timeline, event, and storage proof.')
    && productTeamCoreSmokeSource.includes('Brainstorm board must be a proofed Agent artifact node with chat, timeline, event, and storage proof.')
    && productTeamCoreSmokeSource.includes('Revision note must link to the requested-changes review and carry chat, timeline, event, and storage proof.')
    && productTeamCoreSmokeSource.includes('Final deliverable must be a final Agent artifact node with chat, timeline, event, and storage proof.'),
  'agents:product-team:smoke must prove every required generic artifact carries proof and the Project Evidence Archive contains final delivery, artifact quality, transcript coverage, and storage proof evidence.',
);
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
  scripts['ui:manager-backend:real-user-chain:dev']?.includes('validate-real-user-zero-to-autonomy-agents-server-ui.mjs')
    && scripts['ui:manager-backend:real-user-chain:dev']?.includes('--ui-base-url=http://127.0.0.1:5173'),
  'ui:manager-backend:real-user-chain:dev must reuse the real-user agents:server browser gate against the already running IPv4 Vite dev server.',
);
assert(
  scripts['ui:manager-backend:core:dev']?.includes('validate-manager-backend-core-ui.mjs')
    && scripts['ui:manager-backend:core:dev']?.includes('--ui-base-url=http://127.0.0.1:5173')
    && managerBackendCoreUiSource.includes('readCliArg(\'--ui-base-url\')')
    && managerBackendCoreUiSource.includes('resolveExternalUiRuntime')
    && managerBackendCoreUiSource.includes('if (staticRuntime.server)'),
  'ui:manager-backend:core:dev must reuse the Manager backend core browser gate against the already running IPv4 Vite dev server without requiring a static dist server.',
);
assert(
  scripts['ui:mock-boundaries']?.includes('validate-frontend-mock-boundaries.mjs'),
  'ui:mock-boundaries must run the frontend mock boundary validator without browser/build writes.',
);
assert(
  frontendMockBoundariesSource.includes('Backend proof transcript missing; local recovery suppressed')
    && frontendMockBoundariesSource.includes('Backend timeline proof missing; local timeline focus suppressed')
    && frontendMockBoundariesSource.includes('Backend project missing; local seed suppressed')
    && frontendMockBoundariesSource.includes('const isBackendManagedBrowserCacheProject = (project = {})')
    && frontendMockBoundariesSource.includes('const canPersistProjectToBrowserCache = (project = {})')
    && frontendMockBoundariesSource.includes('const canPersistChatMessageToBrowserCache = (message = {}, projectById = new Map())')
    && frontendMockBoundariesSource.includes('CHAT_PROOF_ID_PATTERN.test(messageId)')
    && frontendMockBoundariesSource.includes('localStorageSetItemMatches.length === 1')
    && frontendMockBoundariesSource.includes('manager-flow-backend-required')
    && frontendMockBoundariesSource.includes('group-chat-collaboration-proof-sync-manager-dashboard')
    && frontendMockBoundariesSource.includes('active-threads-sync-manager-dashboard')
    && frontendMockBoundariesSource.includes('recent-commit-line-sync-timeline-events')
    && frontendMockBoundariesSource.includes('Marketplace Agent contract must return after backend success before local roster mutation fallback can run.')
    && frontendMockBoundariesSource.includes('Marketplace Agent contract picker backend target boundary')
    && frontendMockBoundariesSource.includes('War Room meeting send UI backend target boundary')
    && frontendMockBoundariesSource.includes('Legacy War Room UI backend target boundary')
    && frontendMockBoundariesSource.includes('disabled={!canReplyBackendTranscriptMessage}')
    && frontendMockBoundariesSource.includes('disabled={!canAttachBackendTranscriptFile}')
    && frontendMockBoundariesSource.includes('Timeline action backend route UI boundary')
    && frontendMockBoundariesSource.includes('Agent Pulse backend work-cycle command boundary')
    && frontendMockBoundariesSource.includes('Agent Focus pulse backend route UI boundary')
    && frontendMockBoundariesSource.includes('Agent Work Cycle pulse backend route UI boundary')
    && frontendMockBoundariesSource.includes('MVP readiness operator action UI backend target boundary')
    && frontendMockBoundariesSource.includes('Autonomous Run Control UI backend target boundary')
    && frontendMockBoundariesSource.includes('Agent Autonomous Action Queue UI backend target boundary')
    && frontendMockBoundariesSource.includes('Project initiation proof and Agent queue read-model refresh boundary')
    && frontendMockBoundariesSource.includes('Dashboard run-count backend boundary')
    && frontendMockBoundariesSource.includes('Workspace Hub catalog stats backend boundary')
    && frontendMockBoundariesSource.includes('Workspace Hub stat source labels')
    && frontendMockBoundariesSource.includes('Manager action run ledger backend boundary')
    && frontendMockBoundariesSource.includes('Autonomous Run Control receipt backend boundary')
    && frontendMockBoundariesSource.includes('production-customer-acceptance-startup-readiness/v1')
    && frontendMockBoundariesSource.includes('agent-focus-backend-dashboard-required')
    && frontendMockBoundariesSource.includes("dataSource: 'sample-fixture'"),
  'ui:mock-boundaries must statically pin transcript/timeline fail-closed, browser cache filtering, seed suppression, backend-required recovery buttons, marketplace contract fallback suppression, dashboard/run receipt fallback suppression, public startup customer acceptance, and source-label mock boundaries.',
);
assert(
  realUserZeroToAutonomySource.includes('settings-workspace-bind-contract')
    && realUserZeroToAutonomySource.includes('settings-workspace-bind-path-input')
    && realUserZeroToAutonomySource.includes('settings-workspace-bind-submit')
    && realUserZeroToAutonomySource.includes('/workspace/bind')
    && realUserZeroToAutonomySource.includes('/local-runtime'),
  'ui:real-user-zero-to-autonomy must verify Settings Workspace binds a real backend local workspace after project creation.',
);
assert(
  realUserZeroToAutonomySource.includes('/projects/${projectId}/settings-provider-readiness')
    && realUserZeroToAutonomySource.includes('/projects/${projectId}/settings-runtime-readiness')
    && realUserZeroToAutonomySource.includes('/projects/${projectId}/settings-integration-readiness')
    && realUserZeroToAutonomySource.includes('Project-scoped Settings provider readiness must expose its route.')
    && realUserZeroToAutonomySource.includes('Real-user Settings Deployment must show the project-scoped runtime readiness route after project creation.')
    && realUserZeroToAutonomySource.includes('Real-user Settings Keys must show the project-scoped provider readiness route after project creation.')
    && realUserZeroToAutonomySource.includes('Real-user Settings Integrations must render backend route rows instead of fake editable integration controls.')
    && realUserZeroToAutonomySource.includes('settingsProviderReadinessRoutes')
    && realUserZeroToAutonomySource.includes('settingsRuntimeReadinessRoutes')
    && realUserZeroToAutonomySource.includes('settingsIntegrationReadinessRoutes'),
  'ui:real-user-zero-to-autonomy must prove project-scoped Settings provider/runtime/integration readiness through backend API, visible Settings UI, and Readiness Proof Map routes.',
);
assert(
  scripts['agents:mission-runner:startup'] === 'node scripts/validate-mission-runner-startup-http.mjs'
    && missionRunnerStartupHttpSource.includes('createAgentProjectHttpServer')
    && missionRunnerStartupHttpSource.includes("path: '/product-team-missions'")
    && missionRunnerStartupHttpSource.includes('customer-agent-handoff-intent')
    && missionRunnerStartupHttpSource.includes('/runtime-autonomy-status')
    && missionRunnerStartupHttpSource.includes('/manager-flow-graph')
    && missionRunnerStartupHttpSource.includes('/readiness-proof-map')
    && launchGateDoc.includes('npm run agents:mission-runner:startup'),
  'agents:mission-runner:startup must be the focused low-write HTTP Mission Runner startup and C/A handoff gate.',
);
assert(
  scripts['agents:product-team:local-mvp'] === 'node scripts/validate-local-mvp-product-team-proof.mjs'
    && scripts['agents:product-team:core'] === 'node scripts/validate-local-mvp-product-team-proof.mjs'
    && scripts['agents:product-team:core:file-backed'] === 'node scripts/run-product-team-acceptance-stage.mjs core'
    && localMvpProductTeamProofSource.includes('validate-settings-contracts.mjs')
    && settingsContractsSource.includes('validate-local-mvp-startup-readiness-contract.mjs')
    && settingsContractsSource.includes('validate-settings-provider-readiness-contract.mjs')
    && settingsContractsSource.includes('validate-search-provider-vault-endpoint.mjs')
    && localMvpProductTeamProofSource.includes('validate-research-sample-product-team-gate.mjs')
    && localMvpProductTeamProofSource.includes('validate-mission-runner-startup-http.mjs')
    && localMvpProductTeamProofSource.includes('validate-agent-contract-contract.mjs')
    && localMvpProductTeamProofSource.includes('validate-agent-workbench-contract.mjs')
    && localMvpProductTeamProofSource.includes('validate-mvp-readiness-operator-actions.mjs')
    && localMvpProductTeamProofSource.includes('validate-real-user-zero-to-autonomy-report.mjs')
    && localMvpProductTeamProofSource.includes('validate-private-mvp-launch-package.mjs')
    && localMvpProductTeamProofSource.includes('validate-launch-operations-private-mvp-package.mjs')
    && localMvpProductTeamProofSource.includes('spawnSync(process.execPath')
    && readme.includes('npm run agents:product-team:local-mvp')
    && readme.includes('marketplace Agent contract roster proof')
    && readme.includes('Agent Workbench artifact/review/final-delivery proof')
    && readme.includes('Manager Launch Operations visibility')
    && readme.includes('npm run agents:launch-operations:private-mvp')
    && readme.includes('npm run agents:product-team:core:file-backed')
    && technicalSource.includes('npm run agents:product-team:local-mvp')
    && technicalSource.includes('marketplace Agent contract roster proof')
    && technicalSource.includes('Agent Workbench artifact/review/final-delivery proof')
    && technicalSource.includes('Launch Operations Private MVP visibility')
    && technicalSource.includes('npm run agents:launch-operations:private-mvp')
    && technicalSource.includes('npm run agents:product-team:core:file-backed')
    && launchGateDoc.includes('npm run agents:product-team:local-mvp')
    && launchGateDoc.includes('marketplace Agent contract roster proof')
    && launchGateDoc.includes('Agent Workbench artifact/review/final-delivery proof')
    && launchGateDoc.includes('Launch Operations Private MVP visibility')
    && launchGateDoc.includes('npm run agents:launch-operations:private-mvp')
    && roadmapSource.includes('Launch Operations Private MVP visibility')
    && launchGateDoc.includes('npm run agents:product-team:core:file-backed'),
  'agents:product-team:local-mvp/core must aggregate the focused low-write Settings/startup, Research sample, Mission Runner, marketplace Agent contract, Agent Workbench, MVP readiness, zero-to-autonomy report, Private MVP launch package, and Launch Operations visibility proof gates while preserving the file-backed core runner as an explicit command.',
);
assert(
  managerMissionRunnerUiSource.includes('createSecretVaultFromEnv')
    && managerMissionRunnerUiSource.includes("SECRET_VAULT_ENABLED: 'true'")
    && managerMissionRunnerUiSource.includes("SECRET_VAULT_KEY: 'manager-mission-runner-ui-local-vault-key'")
    && managerMissionRunnerUiSource.includes('createModelProvider')
    && managerMissionRunnerUiSource.includes('createSearchProvider')
    && managerMissionRunnerUiSource.includes("apiKeySource: 'local-secret-vault'")
    && managerMissionRunnerUiSource.includes('Local model fixture confirmed the Mission Runner UI backend provider path.')
    && managerMissionRunnerUiSource.includes('secretVault,')
    && managerMissionRunnerUiSource.includes('llmProvider,')
    && managerMissionRunnerUiSource.includes('searchProvider,')
    && technicalSource.includes('Secret Vault plus local model/search provider fixtures so `/local-mvp-startup-readiness` is ready')
    && launchGateDoc.includes('Secret Vault plus local model/search provider fixtures so the `/local-mvp-startup-readiness` gate is ready')
    && mockRegister.includes('it starts its local backend with Secret Vault plus local model/search provider fixtures so the readiness gate is tested rather than bypassed')
    && agentReadmeSource.includes('starts its local backend with Secret Vault plus local model/search provider fixtures, verifies `/local-mvp-startup-readiness` is ready')
    && architectureAuditSource.includes('focused Mission Runner browser gate that starts a Vault/provider-ready local backend before kickoff'),
  'ui:manager-mission-runner must start a Vault/provider-ready local backend so it tests the real startup readiness gate instead of bypassing it.',
);
assert(
  readme.includes('Run the real local MVP path')
    && readme.includes('SECRET_VAULT_ENABLED')
    && readme.includes('SECRET_VAULT_KEY')
    && readme.includes('npm run agents:server')
    && readme.includes('Settings -> Keys')
    && readme.includes('Start Initiation')
    && readme.includes('Load Sample Fixture')
    && readme.includes('npm run ui:real-user-zero-to-autonomy')
    && readme.includes('npm run agents:real-user-zero-to-autonomy'),
  'README Quick start must separate sample fixture demo from the backend-backed real local MVP startup path.',
);
assert(
  realUserZeroToAutonomySource.includes("readCliArg('--ui-base-url')")
    && realUserZeroToAutonomySource.includes('HOFS_UI_BASE_URL')
    && realUserZeroToAutonomySource.includes('configuredUiBaseUrl')
    && realUserZeroToAutonomySource.includes('settings-deployment-backend-url-input')
    && realUserZeroToAutonomySource.includes('settings-deployment-save-backend-url')
    && realUserZeroToAutonomySource.includes('Real-user Settings Deployment must let the user set the active backend API target before sealing providers.')
    && realUserZeroToAutonomySource.includes('window.localStorage.getItem(storageKey)')
    && !realUserZeroToAutonomySource.includes('window.__AGENT_BACKEND_URL__ = targetBackendUrl')
    && realUserZeroToAutonomySource.includes('/agent-autonomous-action-queue/next/run')
    && realUserZeroToAutonomySource.includes('assertAutonomousHandoffOutput')
    && realUserZeroToAutonomySource.includes('agent-autonomous-action-run/v1')
    && realUserZeroToAutonomySource.includes('autonomous-action-decision/v1')
    && realUserZeroToAutonomySource.includes('workspace-local-mvp-startup-readiness')
    && realUserZeroToAutonomySource.includes('workspace-local-mvp-first-run')
    && realUserZeroToAutonomySource.includes('workspace-sync-local-mvp-startup')
    && realUserZeroToAutonomySource.includes('startupReadiness.readyForFirstProjectRun === true')
    && realUserZeroToAutonomySource.includes("startupReadiness.nextAction?.id === 'start-product-team-mission'")
    && realUserZeroToAutonomySource.includes('Browser startup readiness must not expose plaintext provider keys.')
    && realUserZeroToAutonomySource.includes('initiation-startup-readiness-gate')
    && realUserZeroToAutonomySource.includes('first project run: ready')
    && realUserZeroToAutonomySource.includes('/memory-readiness')
    && realUserZeroToAutonomySource.includes('Encountered two children with the same key')
    && realUserZeroToAutonomySource.includes('Real-user UI must not emit duplicate React key warnings.')
    && realUserZeroToAutonomySource.includes('defaultBackendTraffic')
    && realUserZeroToAutonomySource.includes('Real-user UI must not auto-probe the default backend before the user saves the active backend URL.')
    && launchGateDoc.includes('duplicate React key warnings')
    && mockRegister.includes('duplicate-key warnings')
    && realUserZeroToAutonomySource.includes('staticRuntime.server'),
  'Real-user browser gate must support --ui-base-url / HOFS_UI_BASE_URL, set the backend target through Settings Deployment, prove Workspace and Initiation startup readiness, prove autonomous Agent continuation, fail on duplicate React key warnings, and skip the dist static server when a dev UI URL is supplied.',
);
assert(
  realUserZeroToAutonomySource.includes('openChangeReviews')
    && realUserZeroToAutonomySource.includes('respondsToReviewId')
    && realUserZeroToAutonomySource.includes('readyForPrivatePilotDelivery === true'),
  'Real-user browser gate must close every requested-change review before Manager UI delivery trace readiness is accepted.',
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
  settingsAgentsServerUiSource.includes('settings-agents-server-ui-validate-${process.pid}')
    && realUserZeroToAutonomySource.includes('real-user-zero-to-autonomy-agents-server-ui-validate-${process.pid}')
    && settingsAgentsServerUiSource.includes('expected.every((expectedText) => text.includes(String(expectedText).toLowerCase()))')
    && settingsAgentsServerUiSource.includes('Settings agents:server UI validation passed.')
    && realUserZeroToAutonomySource.includes('Real-user zero-to-autonomy agents:server UI validation passed.'),
  'Settings and real-user browser gates must use process-scoped temp roots and wait for backend-backed UI text before passing.',
);
assert(
  read('scripts/validate-agent-project-server-secret-vault.mjs').includes('agent-project-server-secret-vault-validate-${process.pid}')
    && read('scripts/validate-search-provider-vault-endpoint.mjs').includes('search-provider-vault-endpoint-validate-${process.pid}')
    && read('scripts/validate-local-mvp-startup-readiness-contract.mjs').includes('local-mvp-startup-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-settings-health-readiness-contract.mjs').includes('settings-health-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-settings-runtime-readiness-contract.mjs').includes('settings-runtime-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-settings-provider-readiness-contract.mjs').includes('settings-provider-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-settings-integration-readiness-contract.mjs').includes('settings-integration-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-project-settings-privacy-policy.mjs').includes('project-settings-privacy-policy-validate-${process.pid}')
    && read('scripts/validate-project-settings-provider-budget-policy.mjs').includes('project-settings-provider-budget-policy-validate-${process.pid}')
    && read('scripts/validate-project-settings-tool-grant-policy.mjs').includes('project-settings-tool-grant-policy-validate-${process.pid}')
    && read('scripts/validate-project-settings-integration-capabilities.mjs').includes('project-settings-integration-capabilities-validate-${process.pid}')
    && read('scripts/validate-project-settings-workspace-capabilities.mjs').includes('project-settings-workspace-capabilities-validate-${process.pid}')
    && read('scripts/validate-evidence-index-readiness-contract.mjs').includes('evidence-index-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-budget-alert-readiness-contract.mjs').includes('budget-alert-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-error-reporting-readiness-contract.mjs').includes('error-reporting-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs').includes('real-user-zero-to-autonomy-agents-server-api-validate-${process.pid}')
    && read('scripts/validate-public-production-startup-readiness-contract.mjs').includes('public-production-startup-readiness-contract-validate-${process.pid}')
    && read('scripts/validate-agent-artifact-path-contract.mjs').includes('agent-artifact-path-contract-validate-${process.pid}')
    && read('scripts/validate-managed-infrastructure-cutover-attestations.mjs').includes('managed-infrastructure-cutover-attestations-validate-${process.pid}'),
  'Settings/Vault/readiness low-write gates must use process-scoped temp roots so focused and aggregate validations can run without shared .tmp collisions.',
);
assert(
  read('scripts/validate-product-team-acceptance-scenario.mjs').includes("process.env.HOFS_PROGRESS_LOG === '1'")
    && read('scripts/validate-production-evidence-integrity-contract.mjs').includes("process.env.HOFS_PROGRESS_LOG === '1'")
    && read('scripts/validate-language-system.mjs').includes("const SHOULD_WRITE_PROGRESS_LOG = process.env.HOFS_PROGRESS_LOG === '1'")
    && read('scripts/validate-language-system.mjs').includes('if (SHOULD_WRITE_PROGRESS_LOG)'),
  'Long or browser validation progress logs must be opt-in through HOFS_PROGRESS_LOG, not written by default.',
);
assert(
  read('scripts/validate-manager-backend-core-ui.mjs').includes('agent-manager-backend-core-ui-store-${process.pid}.json')
    && read('scripts/validate-manager-mission-runner-ui.mjs').includes('agent-manager-mission-runner-ui-store-${process.pid}.json')
    && read('scripts/validate-manager-mission-runner-ui.mjs').includes('agent-manager-mission-runner-ui-vault-records-${process.pid}.json')
    && read('scripts/validate-manager-provider-proof-ui.mjs').includes('agent-manager-provider-proof-ui-store-${process.pid}.json')
    && read('scripts/validate-manager-backend-ui.mjs').includes('agent-manager-backend-ui-store-${process.pid}.json'),
  'Manager browser gates must use process-scoped backend store/vault files so parallel UI validation cannot reuse stale project state.',
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
  appSource.includes('projectId: settingsProjectRawId')
    && appSource.includes('settingsProviderReadiness: null')
    && appSource.includes('settingsRuntimeReadiness: null')
    && appSource.includes('const scopedProviderRuntimeReadModel = (readModel = null) =>')
    && appSource.includes('const settingsProviderVaultBindings = scopedProviderRuntimeReadModel(providerRuntimeStatus.providerVaultBindings);')
    && appSource.includes('const settingsProviderReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsProviderReadiness)')
    && appSource.includes('const settingsRuntimeReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsRuntimeReadiness)')
    && appSource.includes('const backendSettingsIntegrationReadiness = scopedProviderRuntimeReadModel(providerRuntimeStatus.settingsIntegrationReadiness)')
    && mockRegister.includes('Settings provider/runtime/integration readiness caches are now scoped to the active project before display')
    && technicalSource.includes('Settings provider/runtime caches also follow active-project scope')
    && agentReadmeSource.includes('Project-scoped Settings syncs store the active project id'),
  'Settings provider/runtime/integration readiness caches must be project-scoped before API entry, Seal, or first-run status is displayed.',
);
assert(
  appSource.includes('modelApiKey: event.target.value, lastReceipt: null, error: null')
    && appSource.includes('searchApiKey: event.target.value, lastReceipt: null, error: null')
    && appSource.includes('searchEndpoint: event.target.value, lastReceipt: null, error: null')
    && appSource.includes('running: true,\n      lastReceipt: null,\n      error: null')
    && appSource.includes('running: false,\n        lastReceipt: null,\n        error: providerRuntimeErrorDetail(error)')
    && mockRegister.includes('Settings Seal receipts now fail closed like other backend write receipts')
    && technicalSource.includes('Settings write receipts use the same stale-proof discipline')
    && agentReadmeSource.includes('Settings write receipts also fail closed'),
  'Settings Seal and Integration sync failures must clear stale success receipts/readiness before the UI can show proof.',
);
assert(
  appSource.includes('const normalizeBackendBaseUrl =')
    && appSource.includes('const hasConfiguredBackendBaseUrl = () => {')
    && appSource.includes('const [backendUrlConfigured, setBackendUrlConfigured] = useState(hasConfiguredBackendBaseUrl);')
    && appSource.includes('const committedBackendBaseUrl = () => normalizeBackendBaseUrl(backendStation.baseUrl || DEFAULT_AGENT_BACKEND_URL);')
    && appSource.includes('setBackendUrlConfigured(true);')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing provider runtime.')
    && appSource.includes('Save the backend API URL in Settings Deployment before running Settings health checks.')
    && appSource.includes("providerRuntimeStatus.running || !backendUrlConfigured")
    && appSource.includes("activeRoute !== 'dashboard' || providerRuntimeStatus.running || !backendUrlConfigured")
    && appSource.includes("activeRoute !== 'project_initiation' || providerRuntimeStatus.running || !backendUrlConfigured")
    && (appSource.match(/disabled=\{providerRuntimeStatus\.running \|\| !backendUrlConfigured\}/g) || []).length >= 6
    && (appSource.match(/disabled=\{healthCheck\.running \|\| !backendUrlConfigured\}/g) || []).length >= 3
    && appSource.includes("&& backendUrlConfigured\n    && Boolean((backendStation.baseUrl || '').trim())")
    && appSource.includes('const syncBackendProjectCatalog = async ({ silent = true, baseUrl = null } = {}) => {')
    && appSource.includes('if (!baseUrl && !backendUrlConfigured) {')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing backend projects.')
    && appSource.includes('if (!baseUrlOverride && !backendUrlConfigured) {')
    && appSource.includes('Save the backend API URL in Settings Deployment before checking backend worker status.')
    && appSource.includes('Save the backend API URL in Settings Deployment before running backend worker controls.')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing backend project state.')
    && appSource.includes('if (!backendUrlConfigured) return;\n    refreshBackendSchedulerStatus();')
    && appSource.includes('const backendWorkerStationSyncDisabled = backendStation.loading || !backendCommandAvailable;')
    && (appSource.match(/disabled=\{backendWorkerStationSyncDisabled\}/g) || []).length >= 15
    && appSource.includes('const saveBackendBaseUrl = () => {')
    && appSource.includes('setProviderRuntimeStatus(prev => ({')
    && appSource.includes('setHealthCheck(prev => ({')
    && appSource.includes('const matchesSettingsRuntimeScope = (state = {}) => (')
    && appSource.includes('settingsIntegrationReadiness: matchesSettingsRuntimeScope(prev) ? prev.settingsIntegrationReadiness : null')
    && appSource.includes('modelProvider: null,\n      searchProvider: null,\n      secretVaultStatus: null,\n      secretVaultRecords: null,\n      providerVaultBindings: null,\n      settingsProviderReadiness: null,\n      settingsRuntimeReadiness: null')
    && appSource.includes('modelTest: null,\n      searchTest: null')
    && appSource.includes('modelProvider: readiness.providerStatus?.model || null')
    && appSource.includes('searchProvider: readiness.providerStatus?.search || null')
    && appSource.includes('secretVaultStatus: readiness.secretVaultStatus || null')
    && appSource.includes('settings-deployment-backend-url-input')
    && appSource.includes('settings-deployment-save-backend-url')
    && appSource.includes('aria-label="Settings backend API URL"')
    && appSource.includes('onClick={saveBackendBaseUrl}')
    && appSource.includes('baseUrlOverride = null')
    && appSource.includes('syncSettingsProviderRuntime({ runTests: false, baseUrlOverride: baseUrl })')
    && appSource.includes('syncSettingsProviderRuntime({ runTests: false, baseUrlOverride: nextUrl })')
    && mockRegister.includes('Settings provider and Health sync now fail closed for runtime status')
    && mockRegister.includes('clearing the same stale runtime status on save and immediately syncing the saved target')
    && technicalSource.includes('Settings runtime status also fails closed across backend targets')
    && technicalSource.includes('then immediately syncs the saved target instead of waiting for a later tab refresh')
    && agentReadmeSource.includes('Provider sync, Settings Health Quick Check, and Settings backend URL changes also fail closed for runtime status')
    && agentReadmeSource.includes('Saving that target clears stale runtime status and immediately syncs the saved URL')
    && architectureAuditSource.includes('Settings provider and Health sync now clear stale runtime status'),
  'Settings Provider sync, Health Quick Check, and backend URL changes must clear stale runtime status across backend target changes and failures.',
);
assert(
  !appSource.includes('backendStation.draftBaseUrl || backendStation.baseUrl')
    && !appSource.includes('normalizeBackendBaseUrl(backendStation.draftBaseUrl'),
  'Runtime backend reads/writes must use the saved backend target; draftBaseUrl is only for the Save URL action.',
);
assert(
  appSource.includes('const managerProofModelSyncButton = (readModel = {}, testId) => managerReadModelMeta(readModel).frontendMockSuppressed ? (')
    && appSource.includes('const managerProofMapRouteSyncButton = (route = {}, testId) => managerReadModelMeta(route).frontendMockSuppressed ? (')
    && [
      'project-dashboard-next-recommendation-sync-manager-dashboard',
      'dashboard-agent-status-sync-cockpit',
      'manager-command-center-sync-read-model',
      'manager-scenario-walkthrough-sync-read-model',
      'manager-action-playbook-sync-action-queue',
      'manager-action-run-ledger-sync-manager-dashboard',
      'manager-scenario-trail-sync-read-model',
      'sync-protocol-audit-sync-read-model',
      'manager-use-case-audit-sync-read-model',
      'manager-requirement-matrix-sync-read-model',
      'agent-state-summary-sync-cockpit',
      'continuous-work-loop-sync-cockpit',
      'fixed-work-routines-sync-cockpit',
      'active-threads-sync-manager-dashboard',
      'event-ledger-sync-timeline-events',
      'governance-protocol-sync-governance',
      'group-chat-collaboration-proof-sync-manager-dashboard',
      'change-flow-sync-cockpit',
      'agent-management-mesh-sync-cockpit',
      'manager-scenario-readiness-sync-proof-map',
      'manager-proof-map-sync-readiness-proof-map',
      'collaboration-health-sync-diagnostics',
      'assignment-timeline-matrix-sync-cockpit',
      'recent-commit-line-sync-timeline-events',
    ].every(testId => backendSyncButtonUsesConfiguredProjectGuard(appSource, testId))
    && backendSyncButtonUsesConfiguredProjectGuard(appSource, 'manager-flow-backend-required-sync', 'disabled={!backendCommandAvailable || backendStation.loading}')
    && backendSyncButtonUsesConfiguredProjectGuard(appSource, 'project-chat-transcript-sync', 'disabled={!canSyncBackendTranscriptMembers}')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-cockpit`}\n                            onClick={() => syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })}\n                            disabled={backendWorkerStationSyncDisabled}')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-governance`}\n                              onClick={() => syncBackendGovernanceProofMapCard(card.syncKind)}\n                              disabled={backendWorkerStationSyncDisabled}')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-proof-models`}\n                              onClick={() => syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })}\n                              disabled={backendWorkerStationSyncDisabled}'),
  'Dashboard backend-required recovery buttons must be disabled until a configured backend project is writable.',
);
assert(
  settingsAgentsServerUiSource.includes('settings-secret-vault-local-startup-contract')
    && settingsAgentsServerUiSource.includes("readCliArg('--ui-base-url')")
    && settingsAgentsServerUiSource.includes('HOFS_UI_BASE_URL')
    && settingsAgentsServerUiSource.includes('configuredUiBaseUrl')
    && settingsAgentsServerUiSource.includes('/projects/initiate')
    && settingsAgentsServerUiSource.includes('backend-sync-project-catalog')
    && settingsAgentsServerUiSource.includes('project-nav-${projectId}')
    && settingsAgentsServerUiSource.includes('settings-footer-backend-save-status')
    && settingsAgentsServerUiSource.includes('backend-backed controls save on change')
    && settingsAgentsServerUiSource.includes('settings-footer-test-connection')
    && settingsAgentsServerUiSource.includes('settings-health-quick-check')
    && settingsAgentsServerUiSource.includes('settings-health-workflow-smoke')
    && settingsAgentsServerUiSource.includes('Settings Health Workflow Smoke must be available after provider secrets are sealed.')
    && settingsAgentsServerUiSource.includes('product-brief submission')
    && settingsAgentsServerUiSource.includes('Settings Health Workflow Smoke must prove backend Agent output through a product-brief submission.')
    && settingsAgentsServerUiSource.includes('Provider Usage')
    && settingsAgentsServerUiSource.includes('Settings Health Workflow Smoke must consume the Settings-sealed search endpoint')
    && settingsAgentsServerUiSource.includes('Settings Health Workflow Smoke must call the configured search endpoint with the Settings-sealed search key.')
    && settingsAgentsServerUiSource.includes('settings-deployment-backend-url-input')
    && settingsAgentsServerUiSource.includes('settings-deployment-save-backend-url')
    && settingsAgentsServerUiSource.includes('Settings Deployment backend URL input must show the active agents:server target')
    && settingsAgentsServerUiSource.includes('/settings/health-readiness')
    && settingsAgentsServerUiSource.includes('Settings Health')
    && settingsAgentsServerUiSource.includes('local MVP startup readiness')
    && settingsAgentsServerUiSource.includes('.tmp/agent-local-user-runtime.json')
    && settingsAgentsServerUiSource.includes('/local-mvp-startup-readiness')
    && settingsAgentsServerUiSource.includes('/settings/provider-readiness')
    && settingsAgentsServerUiSource.includes('settings-tab-deployment')
    && settingsAgentsServerUiSource.includes('settings-tab-models')
    && settingsAgentsServerUiSource.includes('settings-tab-integrations')
    && settingsAgentsServerUiSource.includes('/projects/${projectId}/settings-integration-readiness')
    && settingsAgentsServerUiSource.includes('settings-tab-workspace')
    && settingsAgentsServerUiSource.includes('/projects/${projectId}/memory-readiness')
    && settingsAgentsServerUiSource.includes('/projects/${projectId}/meeting-summaries')
    && settingsAgentsServerUiSource.includes('waitForSettingsProviderIdle')
    && settingsAgentsServerUiSource.includes('fillControlledInput')
    && settingsAgentsServerUiSource.includes('waitForProjectSettings')
    && settingsAgentsServerUiSource.includes('settings-workspace-default-visibility')
    && settingsAgentsServerUiSource.includes('settings-privacy-provider-log-mode')
    && settingsAgentsServerUiSource.includes('settings-provider-budget-daily')
    && settingsAgentsServerUiSource.includes('settings-tool-grant-provider-test')
    && settingsAgentsServerUiSource.includes('/projects/${projectId}/provider-controlled-run')
    && settingsAgentsServerUiSource.includes('project-settings-updated')
    && settingsAgentsServerUiSource.includes('waitForVaultRecord')
    && settingsAgentsServerUiSource.includes('/secret-vault/status')
    && settingsAgentsServerUiSource.includes('/secret-vault/seal')
    && settingsAgentsServerUiSource.includes('settings-provider-sync-status')
    && appSource.includes('data-testid="settings-provider-sync-status"'),
  'ui:settings-agents-server must verify Settings startup guidance, project-scoped backend proof routes, backend-backed footer status, project-settings readback, provider policy consumption, and timeline/event proof.',
);
assert(
  appSource.includes('data-testid="settings-privacy-export-approval"')
    && appSource.includes('onChange={(event) => updateProjectPrivacyPolicySetting({ evidenceExportRequiresApproval: event.currentTarget.checked })}')
    && !appSource.includes('onClick={(event) => updateProjectPrivacyPolicySetting({ evidenceExportRequiresApproval'),
  'Settings Privacy export approval must stay an editable backend project-settings checkbox, not a read-only controlled input.',
);
assert(
  appSource.includes('timeoutMs: 30_000')
    && appSource.includes('onChange={(event) => updateProjectPrivacyPolicySetting({ retentionMode: event.currentTarget.value })}')
    && appSource.includes('onChange={(event) => updateProjectPrivacyPolicySetting({ providerLogMode: event.currentTarget.value })}')
    && appSource.includes('onChange={(event) => updateProjectWorkspacePolicySetting({ defaultVisibility: event.currentTarget.value })}')
    && appSource.includes('onChange={(event) => updateProjectProviderBudgetPolicySetting({ dailyBudgetCents: Number(event.currentTarget.value) || 0 })}')
    && !appSource.includes('onInput={(event) => updateProjectPrivacyPolicySetting')
    && !appSource.includes('onInput={(event) => updateProjectWorkspacePolicySetting')
    && !appSource.includes('onInput={(event) => updateProjectProviderBudgetPolicySetting'),
  'Settings project-setting selects must use onChange and Secret Vault seal must allow enough time for encrypted backend writes.',
);
assert(
  productTeamAcceptanceSource.includes("process.on('exit'")
    && productTeamAcceptanceSource.includes('HOFS_PRODUCT_TEAM_PRESERVE_TMP'),
  'Product-team acceptance stages must default-clean their temp run directory and require an explicit preserve flag.',
);
assert(
  productTeamAcceptanceSource.includes('cleanupAcceptanceTmp')
    && productTeamAcceptanceSource.includes('process.once(signal')
    && productTeamAcceptanceSource.includes("['SIGINT', 'SIGTERM', 'SIGHUP']")
    && productTeamAcceptanceSource.includes('maxRetries: 3'),
  'Product-team acceptance stages must clean their temp run directory on interruption signals.',
);
assert(
  agentProjectServiceSource.includes('verifyManagedProductionAttestation')
    && agentProjectServiceSource.includes('attestationReady')
    && agentProjectServiceSource.includes('sig_hmac_sha256_v1_')
    && agentProjectServiceSource.includes('MANAGED_PRODUCTION_ATTESTATION_SIGNING_SECRET')
    && agentProjectServiceSource.includes('managed-production-attestation-signature-invalid')
    && productTeamAcceptanceSource.includes('managedProductionAttestationSignature')
    && productTeamAcceptanceSource.includes('attestationChecksum')
    && productTeamAcceptanceSource.includes('attestationSignatureReady === true')
    && productTeamAcceptanceSource.includes("attestationFailureReason === 'managed-production-attestation-signature-missing'")
    && productionEvidenceIntegritySource.includes('invalidSignature')
    && productionEvidenceIntegritySource.includes('managed-production-attestation-signature-invalid')
    && productionEvidenceIntegritySource.includes('Invalid managed-production signatures must not count as managed-production controls.')
    && launchGateDoc.includes('unsigned or invalid-signature managed-production claims stay `external-unattested`')
    && technicalSource.includes('missing-signature and invalid-signature managed-production claims as `external-unattested`'),
  'Managed-production evidence integrity must require a valid signed control-plane attestation, not only an evidenceEnvironment flag or malformed signature.',
);
assert(
  appSource.includes("managerProofModelSyncButton(backendProductionLaunchGapRegister, 'backend-production-launch-gap-register-sync-proof-models')")
    && appSource.includes("managerProofModelSyncButton(backendProductionLaunchControlCenter, 'backend-production-launch-control-center-sync-proof-models')")
    && appSource.includes("managerProofModelSyncButton(backendProductionLaunchEvidenceDossier, 'backend-production-launch-evidence-dossier-sync-proof-models')")
    && appSource.includes("managerReadModelSourceBadge(backendProductionEvidenceIntegrityAudit, 'backend-production-evidence-integrity-audit-source')")
    && appSource.includes("managerProofModelSyncButton(backendProductionEvidenceIntegrityAudit, 'backend-production-evidence-integrity-audit-sync-proof-models')")
    && mockRegister.includes('Production launch gap, control center, dossier, and evidence-integrity snapshots now carry source badges plus `Sync Proof Models` actions')
    && technicalSource.includes('The Manager UI production launch/control/evidence snapshots carry source badges and proof-model sync actions')
    && architectureAuditSource.includes('The production launch gap, control center, dossier, and evidence-integrity snapshots now expose provenance plus proof-model sync actions'),
  'Production launch/control/evidence UI must show read-model provenance and direct proof-model sync actions.',
);
assert(
  appSource.includes('data-testid="backend-launch-operations-overview"')
    && appSource.includes('Launch Operations Overview')
    && appSource.includes('backendLaunchOperationsOverview')
    && appSource.includes('backendLaunchOperationsPrivatePilotAccepted')
    && appSource.includes('backendLaunchOperationsPublicProductionReady')
    && appSource.includes('backendPrivateMvpLaunchPackage')
    && appSource.includes('backendLaunchOperationsNextStepRows')
    && appSource.includes('runLaunchOperationsNextStep')
    && appSource.includes('data-testid="backend-public-production-next-steps"')
    && appSource.includes('data-testid={`backend-public-production-next-step-${index + 1}`}')
    && appSource.includes('data-testid={`backend-public-production-next-step-run-${index + 1}`}')
    && appSource.includes('data-testid="backend-public-production-next-step-receipt"')
    && appSource.includes('Public Production Next Steps')
    && appSource.includes('data-testid="backend-private-mvp-launch-package"')
    && appSource.includes('data-testid="backend-private-mvp-launch-package-status"')
    && appSource.includes('data-testid="backend-private-mvp-launch-package-commands"')
    && appSource.includes('data-testid="backend-private-mvp-launch-package-boundary"')
    && appSource.includes('npm run agents:private-mvp-launch-package:validate')
    && appSource.includes('/launch-operations-overview')
    && appSource.includes('data-testid="backend-launch-operations-public-production-status"')
    && appSource.includes('data-testid="backend-launch-operations-routes"')
    && appSource.includes('/public-production-startup-readiness')
    && appSource.includes('/production-customer-acceptance-policy')
    && agentProjectServiceSource.includes('function buildLaunchOperationsOverview')
    && agentProjectServiceSource.includes("schemaVersion: 'launch-operations-overview/v1'")
    && agentProjectServiceSource.includes("schemaVersion: 'private-mvp-launch-package-boundary/v1'")
    && agentProjectServiceSource.includes("reportSchemaVersion: 'private-mvp-launch-package/v1'")
    && agentProjectServiceSource.includes("status: publicProductionReady")
    && agentProjectServiceSource.includes("packageCommand: 'npm run agents:private-mvp-launch-package'")
    && agentProjectServiceSource.includes("validationCommand: 'npm run agents:private-mvp-launch-package:validate'")
    && agentProjectServiceSource.includes("forbiddenClaim: 'public production readiness'")
    && agentProjectServiceSource.includes('publicProductionNextSteps')
    && agentProjectServiceSource.includes('describeProductionNextStep')
    && agentProjectServiceSource.includes('runLaunchOperationsPublicProductionNextStep')
    && agentProjectServiceSource.includes("schemaVersion: 'launch-operations-next-step-run/v1'")
    && agentProjectServiceSource.includes('launchOperationsNextStepRuns')
    && agentProjectServiceSource.includes("subtype: 'launch-operations-next-step-run'")
    && agentProjectServiceSource.includes('nextStepRunCount')
    && agentProjectServiceSource.includes('whyBlocked')
    && agentProjectServiceSource.includes("validationCommand: mapped.validationCommand || row.validationCommand || row.command || 'npm run launch:public-production:no-go'")
    && agentProjectServiceSource.includes("productionCustomerAcceptancePolicy: '/production-customer-acceptance-policy'")
    && agentProjectServiceSource.includes("validationCommand: 'npm run agents:production-customer-acceptance'")
    && agentProjectServiceSource.includes('getLaunchOperationsOverview(projectId, options = {})')
    && agentProjectServiceSource.includes('launchOperationsOverviewRoutes')
    && prdSource.includes('Private MVP Launch Package status')
    && prdSource.includes('Public Production Next Steps')
    && prdSource.includes('owner, action, why-blocked, validation-command, route, and run-route fields')
    && prdSource.includes('launch-operations-next-step-run/v1')
    && prdSource.includes('forbidden public-production claim')
    && technicalSource.includes('privateMvpLaunchPackage` as `private-mvp-launch-package-boundary/v1`')
    && technicalSource.includes('`publicProductionNextSteps` rows with Manager-readable owner/action/why-blocked/validation-command/route/run-route fields')
    && technicalSource.includes('records `launch-operations-next-step-run/v1`')
    && launchGateDoc.includes('hides the package boundary')
    && launchGateDoc.includes('hides public-production next steps')
    && launchGateDoc.includes('drops the next-step receipt')
    && readme.includes('Manager-readable Public Production Next Steps')
    && readme.includes('next-step run receipts')
    && readme.includes('backend `launch-operations-overview/v1`')
    && frontendMockBoundariesSource.includes('/production-customer-acceptance-policy')
    && agentReadmeSource.includes('Its `privateMvpLaunchPackage` row keeps the allowed controlled-private-MVP claim separate')
    && agentReadmeSource.includes('`publicProductionNextSteps` rows translate blockers')
    && agentReadmeSource.includes('launch-operations-next-step-run/v1')
    && architectureAuditSource.includes('Its `privateMvpLaunchPackage` boundary exposes the package and validation commands')
    && architectureAuditSource.includes('`publicProductionNextSteps` rows expose owner/action/why-blocked/validation-command/route/run-route fields')
    && architectureAuditSource.includes('launch-operations-next-step-run/v1')
    && architectureAuditSource.includes('Launch Operations Private MVP visibility verification')
    && agentProjectApiSource.includes("route.action === 'launch-operations-overview'")
    && agentProjectApiSource.includes("route.tail[0] === 'public-production-next-steps'")
    && agentProjectApiSource.includes('runLaunchOperationsPublicProductionNextStep'),
  'Manager Ready Package must expose a backend read-model launch operations overview for private-pilot status and public-production no-go.',
);
assert(
  agentProjectServiceSource.includes('production-operations-managed-production-evidence/v1')
    && agentProjectServiceSource.includes('readyForManagedProductionOperationsEvidence')
    && agentProjectServiceSource.includes('managedProductionOperationsLocalRehearsalControlCount')
    && appSource.includes('Managed Evidence')
    && appSource.includes('Managed Controls')
    && productTeamAcceptanceSource.includes('managedProductionEvidence.readyForManagedProductionOperationsEvidence === false')
    && productTeamAcceptanceSource.includes('managedProductionEvidence?.summary?.localRehearsalControlCount === productionOperationsControlIds.length'),
  'Production operations readiness must separate completed operations receipts from signed managed-production evidence readiness.',
);
assert(
  adapterGatewayRuntimeSource.includes('/attestations/managed-production-control')
    && adapterGatewayRuntimeSource.includes('buildManagedProductionControlAttestation')
    && adapterGatewayRuntimeSource.includes('managedProductionAttestationReadiness')
    && adapterGatewayRuntimeSource.includes('sig_hmac_sha256_v1_')
    && adapterGatewayRuntimeSource.includes("storageAdapterStatus.driver === 'postgres'")
    && adapterGatewayRuntimeSource.includes('latestReadback.parityReady === true')
    && adapterGatewayRuntimeSource.includes('adapter-gateway-managed-production-attestation-blocked')
    && adapterGatewayPostgresValidationSource.includes('managedProductionAttestationSignature')
    && adapterGatewayPostgresValidationSource.includes('/attestations/managed-production-control')
    && adapterGatewayPostgresValidationSource.includes('Gateway attestation signature must match the service verification payload.'),
  'Adapter gateway must issue signed production-control attestations only after Postgres query-bound readback parity.',
);
assert(
  agentProjectApiSource.includes("route?.action === 'managed-infrastructure-cutover-attestations'")
    && agentProjectServiceSource.includes('recordManagedInfrastructureCutoverAttestations')
    && agentProjectServiceSource.includes('managed-infrastructure-cutover-attestation-run/v1')
    && agentProjectServiceSource.includes('managed-production-attestation-not-ready')
    && agentProjectServiceSource.includes('project-infrastructure-dry-run-blocked')
    && agentProjectServiceSource.includes('persistenceGatewayProjectReceiptReady')
    && accessControlSource.includes('managed-infrastructure-cutover-attestations')
    && managedInfrastructureCutoverAttestationsSource.includes('/projects/${projectId}/managed-infrastructure-cutover-attestations')
    && managedInfrastructureCutoverAttestationsSource.includes('productionOperationsControlReceipt')
    && managedInfrastructureCutoverAttestationsSource.includes('productionEvidenceIntegrityAudit')
    && appSource.includes('const runManagedInfrastructureCutoverAttestation = async () => {')
    && appSource.includes('manager-ui-managed-infrastructure-cutover-attestation')
    && appSource.includes('backend-managed-infrastructure-cutover-attestation-run')
    && appSource.includes('backend-managed-infrastructure-cutover-attestation-receipt')
    && appSource.includes('No local cutover proof was created.')
    && appSource.includes('Managed cutover attestation proof routes refreshed'),
  'Project API and Manager UI must bridge signed adapter-gateway attestations into production operations receipts and evidence-integrity proof without creating local cutover proof.',
);
assert(
  agentManagerScenarioSource.includes('cleanupManagerScenarioTmp')
    && agentManagerScenarioSource.includes('HOFS_MANAGER_SCENARIO_PRESERVE_TMP')
    && agentManagerScenarioSource.includes("['SIGINT', 'SIGTERM', 'SIGHUP']")
    && agentManagerScenarioSource.includes('agent-manager-http-store.json')
    && agentManagerScenarioSource.includes('maxRetries: 3'),
  'Agent manager scenario validation must clean its fixed temp stores by default and on interruption signals.',
);
assert(
  adapterGatewayServerSource.includes('cleanupTmp')
    && adapterGatewayServerSource.includes('HOFS_ADAPTER_GATEWAY_PRESERVE_TMP')
    && adapterGatewayServerSource.includes("['SIGINT', 'SIGTERM', 'SIGHUP']")
    && adapterGatewayServerSource.includes('rmSync(root'),
  'Adapter gateway server validation must clean its temp gateway store by default and on interruption signals.',
);
assert(
  adapterGatewayHttpModeSource.includes('cleanupTmp')
    && adapterGatewayHttpModeSource.includes('HOFS_ADAPTER_GATEWAY_PRESERVE_TMP')
    && adapterGatewayHttpModeSource.includes("['SIGINT', 'SIGTERM', 'SIGHUP']")
    && adapterGatewayHttpModeSource.includes('rmSync(root'),
  'Adapter gateway HTTP-mode validation must clean its temp project and gateway stores by default and on interruption signals.',
);
assert(
  privatePilotUiSource.includes("HOFS_PRIVATE_PILOT_FOCUSED_PRESERVE_TMP: '1'")
    && privatePilotUiSource.includes('HOFS_PRIVATE_PILOT_FOCUSED_TEMP_ROOT')
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
    && appSource.includes('settings-workspace-bind-contract')
    && appSource.includes('settings-workspace-bind-path-input')
    && appSource.includes('settings-workspace-bind-submit')
    && appSource.includes('bindProjectWorkspaceFromSettings')
    && appSource.includes('/workspace/bind')
    && appSource.includes('/local-runtime')
    && appSource.includes('settings-workspace-capability-contract')
    && appSource.includes('settings-workspace-memory-readiness')
    && appSource.includes('settings-workspace-sync-memory-readiness')
    && appSource.includes('settings-workspace-memory-readiness-rows')
    && appSource.includes('settings-workspace-memory-readiness-gates')
    && appSource.includes('settings-workspace-meeting-summaries')
    && appSource.includes('settings-workspace-sync-meeting-summaries')
    && appSource.includes('const savedPrivacyPolicy = payload.projectSettings?.privacyPolicy')
    && appSource.includes('const savedProviderBudgetPolicy = payload.projectSettings?.providerBudgetPolicy')
    && appSource.includes('const savedWorkspacePolicy = payload.projectSettings?.workspacePolicy')
    && appSource.includes('const savedToolGrantPolicy = payload.projectSettings?.toolGrantPolicy')
    && appSource.includes('privacyPolicy: nextPrivacyPolicy,\n    };\n    applyLocalPrivacyPolicy();')
    && appSource.includes('providerBudgetPolicy: nextProviderBudgetPolicy,\n    };\n    applyLocalProviderBudgetPolicy();')
    && appSource.includes('workspacePolicy: nextWorkspacePolicy,\n    };\n    applyLocalWorkspacePolicy();')
    && appSource.includes('toolGrantPolicy: nextToolGrantPolicy,\n    };\n    bumpProjectSettingsDraftRevision();\n    applyLocalToolGrantPolicy();')
    && appSource.includes('settingsAutoWorkspaceSyncRef')
    && appSource.includes("settingsTab !== 'workspace'")
    && appSource.includes("settingsTab !== 'integrations'")
    && appSource.includes('syncBackendProjectState({ silent: true })')
    && appSource.includes('syncBackendProjectMemoryReadiness({ silent: true })')
    && appSource.includes('syncBackendMeetingSummaries({ silent: true })')
    && appSource.includes('/memory-readiness')
    && appSource.includes('/meeting-summaries')
    && appSource.includes('Backend meeting summaries')
    && appSource.includes('project-workspace-policy/v1')
    && appSource.includes('project-workspace-capabilities/v1')
    && appSource.includes('Global language: browser-local UI preference only')
    && appSource.includes('Project language and workspace policy write through project-settings/v1')
    && appSource.includes('Runtime contract rules and long-term memory readiness are backend-backed and read-only')
    && appSource.includes('Workspace capability contract not synced.')
    && appSource.includes('settings-workspace-capabilities-sync-project-state')
    && appSource.includes('settings-integration-capabilities-sync-project-state')
    && appSource.includes('onClick={() => syncBackendProjectState({ silent: false })}')
    && appSource.includes('const settingsBackendProjectWriteAvailable = shouldAttemptBackendProjectWrite(activeProject);')
    && appSource.includes('const settingsBackendProjectSyncDisabled = !settingsBackendProjectWriteAvailable || backendStation.loading;')
    && appSource.includes('const settingsProviderProjectSyncDisabled = !settingsBackendProjectWriteAvailable || providerRuntimeStatus.running;')
    && appSource.includes('disabled={!settingsBackendProjectWriteAvailable || privacyPolicySaving}')
    && appSource.includes('disabled={!settingsBackendProjectWriteAvailable || workspacePolicySaving}')
    && appSource.includes('disabled={settingsBackendProjectSyncDisabled || workspaceBindDraft.saving || !workspaceBindDraft.path.trim()}')
    && appSource.includes('disabled={settingsBackendProjectSyncDisabled}')
    && appSource.includes('disabled={settingsProviderProjectSyncDisabled}')
    && appSource.includes('disabled={!settingsBackendProjectWriteAvailable || toolGrantPolicySaving}')
    && appSource.includes('disabled={!settingsBackendProjectWriteAvailable || providerBudgetPolicySaving}')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing integration readiness.')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing meeting summaries.')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing project memory readiness.')
    && appSource.includes('Backend privacy policy route required; local fallback disabled')
    && appSource.includes('Backend provider budget route required; local fallback disabled')
    && appSource.includes('Backend workspace policy route required; local fallback disabled')
    && appSource.includes('Backend tool grant route required; local fallback disabled')
    && appSource.includes('Save and sync the backend URL before entering provider secrets')
    && appSource.includes('Provider drafts are in-memory only until backend Secret Vault readiness is synced')
    && mockRegister.includes('Settings project policy controls no longer optimistic-write browser-local project settings for backend-online real projects')
    && technicalSource.includes('Settings project policy controls do not optimistic-write browser-local project settings for backend-online real projects')
    && prdSource.includes('Settings 后端目标可用性边界')
    && prdSource.includes('不能在未配置后端时探测默认后端地址')
    && !appSource.includes('Backend workspace capability model missing.')
    && !appSource.includes('Only language settings write from this tab today.')
    && !appSource.includes('<SmallButton><Save size={12}'),
  'Settings footer/workspace UI must not present stale, unsynced, or no-op save controls as real backend-backed settings.',
);
assert(
  !appSource.includes('setPrivacyPolicySaving(true);\n      applyLocalPrivacyPolicy(nextPrivacyPolicy);')
    && !appSource.includes('setProviderBudgetPolicySaving(true);\n      applyLocalProviderBudgetPolicy(nextProviderBudgetPolicy);')
    && !appSource.includes('setWorkspacePolicySaving(true);\n      applyLocalWorkspacePolicy(nextWorkspacePolicy);')
    && !appSource.includes('setToolGrantPolicySaving(true);\n      applyLocalToolGrantPolicy(nextToolGrantPolicy);'),
  'Settings project policy controls must wait for backend project-settings receipts before mutating browser-local project settings for backend-online real projects.',
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
    && appSource.includes('settings-provider-api-entry-state')
    && appSource.includes('settings-provider-readiness-contract')
    && appSource.includes('settings-secret-vault-local-startup-contract')
    && appSource.includes('const runSettingsFooterConnectionTest = () => {')
    && appSource.includes("setSettingsTab('health');")
    && appSource.includes('settings-footer-test-connection')
    && appSource.includes('settings-health-quick-check')
    && appSource.includes('settings-health-workflow-smoke')
    && appSource.includes('const settingsTabForStartupReadiness = (startupReadiness = null) => {')
    && appSource.includes("if (!backendUrlConfigured) return 'deployment';")
    && appSource.includes("if (!startupReadiness?.schemaVersion) return 'health';")
    && appSource.includes("if (/secret-vault|seal|provider key|api.?key|vault/.test(nextActionText)) return 'keys';")
    && appSource.includes("if (/runtime|model|search/.test(nextActionText)) return 'models';")
    && appSource.includes('workspace-local-mvp-startup-readiness')
    && appSource.includes('workspace-sync-local-mvp-startup')
    && appSource.includes('workspace-open-startup-settings')
    && appSource.includes('start-initiation-backend-state')
    && appSource.includes("startupReadyForFirstRun ? 'Backend ready for first run' : backendUrlConfigured ? 'Setup required before kickoff' : 'Set backend URL before kickoff'")
    && appSource.includes('initiation-startup-readiness-gate')
    && appSource.includes('initiation-sync-startup')
    && appSource.includes('initiation-open-startup-settings')
    && !appSource.includes('workspace-open-settings-keys')
    && !appSource.includes('initiation-open-settings-keys')
    && appSource.includes('Backend startup required before real kickoff')
    && appSource.includes('const refreshLocalMvpStartupReadiness = async ({ silent = true } = {}) => {')
    && appSource.includes('Save the backend API URL in Settings Deployment before syncing local MVP startup readiness.')
    && appSource.includes('const baseUrl = normalizeBackendBaseUrl(backendStation.baseUrl || DEFAULT_AGENT_BACKEND_URL);')
    && appSource.includes('const ensureInitiationStartupReady = async (actionLabel = \'starting a real kickoff\') => {')
    && appSource.includes('if (!backendUrlConfigured && !isDevelopmentInitiationFallbackEnabled()) {')
    && appSource.includes('Save the backend API URL in Settings Deployment before ${actionLabel}. No backend kickoff or local fallback project was created.')
    && appSource.includes('startupReadiness = await refreshLocalMvpStartupReadiness({ silent: true });')
    && appSource.includes('startupReadiness?.readyForFirstProjectRun === true || isDevelopmentInitiationFallbackEnabled()')
    && appSource.includes("lastAction: 'Project initiation startup blocked'")
    && appSource.includes("label: 'Preparing model-backed meeting'")
    && appSource.includes("label: 'Asking Agents to open the meeting'")
    && appSource.includes("setInitiationMeetingStartState({ running: false, startedAt: null, label: '' });")
    && appSource.includes('if (!(await ensureInitiationStartupReady(\'approving the project\'))) {')
    && appSource.includes("lastAction: 'Project initiation approval blocked'")
    && appSource.includes('const initiationStartupReadyForFirstRun = backendUrlConfigured && initiationStartupReadiness?.readyForFirstProjectRun === true;')
    && appSource.includes('const initiationStartupAllowsKickoff = initiationStartupReadyForFirstRun || initiationDevelopmentFallbackAllowed;')
    && appSource.includes('const initiationCanStartKickoff = initiationStartupAllowsKickoff && initiationWorkspaceReady;')
    && appSource.includes('const initiationCanApproveProject = initiationCanStartKickoff && (Boolean(initiationMeetingSession) || initiationDevelopmentFallbackAllowed);')
    && appSource.includes('disabled={!initiationCanStartKickoff || providerRuntimeStatus.running || initiationMeetingStartState.running}')
    && appSource.includes('disabled={!initiationCanApproveProject || providerRuntimeStatus.running}')
    && (appSource.match(/disabled=\{!initiationCanStartKickoff \|\| providerRuntimeStatus\.running \|\| initiationMeetingStartState\.running\}/g) || []).length >= 2
    && (appSource.match(/disabled=\{!initiationCanApproveProject \|\| providerRuntimeStatus\.running\}/g) || []).length >= 2
    && appSource.includes('dashboardStartupSyncRef')
    && appSource.includes('initiationStartupSyncRef')
    && appSource.includes("activeRoute !== 'project_initiation'")
    && appSource.includes('refreshLocalMvpStartupReadiness({ silent: true });')
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
    && appSource.includes('settingsSecretVaultUnreachable')
    && appSource.includes('settingsSecretVaultStatusSynced')
    && appSource.includes('settingsSecretVaultBadgeLabel')
    && appSource.includes('sync required')
    && appSource.includes('backend unreachable')
    && appSource.includes('settingsAutoProviderSyncRef')
    && appSource.includes("const providerSettingsTabs = new Set(['deployment', 'keys', 'models', 'health']);")
    && appSource.includes('syncSettingsProviderRuntime({ runTests: false });')
    && appSource.includes('settingsAutoIntegrationSyncRef')
    && appSource.includes("settingsTab !== 'integrations'")
    && appSource.includes('syncSettingsIntegrationReadiness()')
    && appSource.includes('Promise.allSettled([\n      syncBackendProjectState({ silent: true }),\n      syncSettingsIntegrationReadiness(),\n    ]);')
    && appSource.includes('auto-loaded from .tmp/agent-local-user-runtime.json')
    && appSource.includes('API fields after refresh')
    && appSource.includes('Provider secret draft fields are editable after a backend URL is saved')
    && appSource.includes('Backend Vault unlocks entry; saving is backend-only')
    && appSource.includes('API input fields')
    && appSource.includes('Seal persistence')
    && appSource.includes('Draft persistence')
    && appSource.includes('Browser persistence')
    && appSource.includes("const settingsProviderSealReady = Boolean(backendUrlConfigured && settingsSecretVaultReady)")
    && appSource.includes("const settingsProviderCanTypeApiFields = settingsProviderReadiness?.canTypeApiFields !== false")
    && appSource.includes("const settingsProviderSecretInputReady = Boolean(backendUrlConfigured && settingsProviderCanTypeApiFields && !providerSecretDrafts.running)")
    && appSource.includes('draft input enabled')
    && appSource.includes("API field: {settingsProviderSecretInputReady ? 'draft enabled' : 'locked'} / Seal:")
    && appSource.includes("API fields: {settingsProviderSecretInputReady ? 'enabled for draft entry' : 'locked until backend URL'} / Seal:")
    && appSource.includes('settings-provider-open-backend-target')
    && appSource.includes('settings-provider-model-base-url-input')
    && appSource.includes('settings-provider-model-name-input')
    && appSource.includes('Model API key, Base URL, and Model ID must all be entered before testing and saving model settings.')
    && appSource.includes('model configuration')
    && appSource.includes("onClick={() => setSettingsTab('deployment')}")
    && appSource.includes('requires backend Vault')
    && appSource.includes('The browser will not persist provider secrets.')
    && appSource.includes('Seal is locked until backend provider status is synced. You can type a temporary draft after saving the backend URL; the browser will not persist provider secrets.')
    && appSource.includes('Save the backend API URL in Settings Deployment before entering or sealing provider secrets.')
    && settingsAgentsServerUiSource.includes('settings-provider-open-backend-target')
    && settingsAgentsServerUiSource.includes('Settings Keys backend URL shortcut must open the active agents:server target')
    && realUserZeroToAutonomySource.includes('settings-provider-open-backend-target')
    && realUserZeroToAutonomySource.includes('Settings Keys backend URL shortcut must open the active backend target')
    && !appSource.includes('Backend API missing')
    && !appSource.includes('backend API missing')
    && !appSource.includes("'input blocked'")
    && !appSource.includes('blocked by backend contract')
    && !appSource.includes('\u540e\u7aef API \u7f3a\u5931')
    && !appSource.includes('后端 API 缺失'),
  'Settings Keys must allow backend-target draft entry while keeping Seal locked until the backend Vault is ready.',
);
assert(
  enLocaleSource.includes("saved: 'Backend configuration ready'")
    && zhLocaleSource.includes("saved: '后端配置已就绪'")
    && zhLocaleSource.includes("'Backend configuration ready': '后端配置已就绪'")
    && mockRegister.includes('Settings locale copy now says `Backend configuration ready`')
    && !enLocaleSource.includes('Mock configuration ready')
    && !zhLocaleSource.includes('Mock configuration ready')
    && !enLocaleSource.includes('Mock mode keeps')
    && !zhLocaleSource.includes("'Mock mode':"),
  'Settings locale copy must not present backend configuration as Mock mode or Mock configuration.',
);
for (const settingsInputTestId of [
  'settings-provider-model-base-url-input',
  'settings-provider-model-name-input',
  'settings-provider-model-key-input',
  'settings-provider-search-key-input',
  'settings-provider-search-endpoint-input',
]) {
  assertProviderSecretInputGatedByTestId(appSource, settingsInputTestId);
}
assert(
  appSource.includes('disabled={providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.modelApiKey.trim() || !providerSecretDrafts.modelBaseUrl.trim() || !providerSecretDrafts.modelName.trim()}')
    && appSource.includes('disabled={providerSecretDrafts.running || !settingsProviderSealReady || !providerSecretDrafts.searchApiKey.trim() || !providerSecretDrafts.searchEndpoint.trim()}')
    && appSource.includes('Evidence search API key and endpoint must both be entered before testing and saving search settings.'),
  'Settings Keys must gate Seal buttons by saved backend target and Secret Vault readiness.',
);
assert(
  agentProjectServiceSource.includes('Settings Health Product-Team Probe')
    && agentProjectServiceSource.includes('compact product-team workflow')
    && appSource.includes('/settings/workflow-smoke')
    && appSource.includes('settings-workflow-smoke/v1')
    && appSource.includes('readyForLocalMvpWorkflowSmoke')
    && appSource.includes("workflowSmoke?.submission?.artifactType === 'product-brief'")
    && appSource.includes("workflowSmoke?.transcriptProof?.hasSubmission === true")
    && appSource.includes("workflowSmoke?.timelineProof?.hasSubmission === true")
    && appSource.includes("workflowSmoke?.eventLedgerProof?.hasSubmission === true")
    && appSource.includes('providerEvidenceReady')
    && appSource.includes('providerEvidenceProof.providerUsageId')
    && appSource.includes('useProviderEvidenceSearch: true')
    && appSource.includes('requireProviderEvidenceSearch: true')
    && appSource.includes('Backend Workflow Smoke passed: product-brief submission')
    && appSource.includes('provider usage')
    && appSource.includes('settings-health-workflow-smoke-output')
    && appSource.includes('Backend Agent output created')
    && appSource.includes('settingsWorkflowSmokeProofRows')
    && appSource.includes('Provider Evidence')
    && appSource.includes('Evidence Search')
    && appSource.includes('Provider Usage')
    && appSource.includes('transcript messages')
    && appSource.includes('timeline logs')
    && appSource.includes('event ledger events')
    && appSource.includes('product-brief submission')
    && agentProjectApiSource.includes("path === '/settings/workflow-smoke'")
    && agentProjectServiceSource.includes('runSettingsWorkflowSmoke(input = {})')
    && agentProjectServiceSource.includes('runSettingsWorkflowSmokeWithProviderEvidence(input = {})')
    && agentProjectServiceSource.includes('settings-workflow-smoke-provider-evidence/v1')
    && agentProjectServiceSource.includes('recordAgentEvidenceSearchWithProvider')
    && agentProjectServiceSource.includes("schemaVersion: 'settings-workflow-smoke/v1'")
    && agentProjectServiceSource.includes('submitWorkArtifact: true')
    && agentProjectServiceSource.includes("workArtifactType: 'product-brief'")
    && agentProjectServiceSource.includes("submitWorkArtifactOn: 'always'")
    && agentProjectServiceSource.includes('includeReadModels: false')
    && agentProjectServiceSource.includes('this.getManagerFlowGraph(projectId')
    && agentProjectServiceSource.includes('this.getReadinessProofMap(projectId')
    && agentProjectServiceSource.includes('this.getChannelTranscript(projectId')
    && agentProjectServiceSource.includes('this.getTimeline(projectId')
    && agentProjectServiceSource.includes('this.getEventLedger(projectId')
    && agentProjectServiceSource.includes('graphHasSubmission')
    && agentProjectServiceSource.includes('proofMapHasSubmission')
    && agentProjectServiceSource.includes('transcriptHasSubmission')
    && agentProjectServiceSource.includes('timelineHasSubmission')
    && agentProjectServiceSource.includes('eventLedgerHasSubmission')
    && settingsHealthReadinessContractSource.includes("path: '/settings/workflow-smoke'")
    && settingsHealthReadinessContractSource.includes("schemaVersion === 'settings-workflow-smoke/v1'")
    && settingsHealthReadinessContractSource.includes("artifactType === 'product-brief'")
    && settingsHealthReadinessContractSource.includes('graphProof?.hasSubmission === true')
    && settingsHealthReadinessContractSource.includes('proofMapProof?.hasSubmission === true')
    && settingsHealthReadinessContractSource.includes('transcriptProof?.hasSubmission === true')
    && settingsHealthReadinessContractSource.includes('timelineProof?.hasSubmission === true')
    && settingsHealthReadinessContractSource.includes('eventLedgerProof?.hasSubmission === true')
    && settingsHealthReadinessContractSource.includes('providerEvidenceProof?.schemaVersion')
    && settingsHealthReadinessContractSource.includes('providerUsageCreated === true')
    && mockRegister.includes('React calls this single backend route')
    && mockRegister.includes('provider-backed evidence-search')
    && technicalSource.includes('`POST /settings/workflow-smoke` creates a generic product-team probe project')
    && technicalSource.includes('settings-workflow-smoke-provider-evidence/v1')
    && technicalSource.includes('Group Chat transcript proof, Timeline proof, Event Ledger proof')
    && agentReadmeSource.includes('`POST /settings/workflow-smoke` remains the explicit deeper path')
    && agentReadmeSource.includes('provider-backed evidence-search')
    && agentReadmeSource.includes('Group Chat transcript proof, Timeline proof, Event Ledger proof')
    && agentReadmeSource.includes('settings-health-workflow-smoke-output')
    && architectureAuditSource.includes('React only calls this backend route')
    && architectureAuditSource.includes('settings-workflow-smoke-provider-evidence/v1')
    && architectureAuditSource.includes('settings-health-workflow-smoke-output')
    && architectureAuditSource.includes('transcript proof, timeline proof, event-ledger proof')
    && !appSource.includes('UI Health Research Probe')
    && !appSource.includes('compact research project')
    && !appSource.includes('first-page research brief')
    && !appSource.includes('first research timeline artifact'),
  'Settings Workflow Smoke must stay generic product-team and prove a backend product-brief submission plus provider-backed evidence through transcript, timeline, event ledger, Flow Graph, Proof Map, and provider usage.',
);
assert(
  appSource.includes('const settingsProofMapRouteOrMissing =')
    && appSource.includes('const backendSettingsProofMapCards = settingsProofMapSpecs.map')
    && appSource.includes('localMvpStartupReadinessRoutes')
    && appSource.includes('settingsHealthReadinessRoutes')
    && appSource.includes('settingsProviderReadinessRoutes')
    && appSource.includes('settingsRuntimeReadinessRoutes')
    && appSource.includes('settingsIntegrationReadinessRoutes')
    && appSource.includes('backend-local-mvp-startup-readiness-route-required')
    && appSource.includes('backend-settings-health-readiness-route-required')
    && appSource.includes('backend-settings-provider-readiness-route-required')
    && appSource.includes('backend-settings-runtime-readiness-route-required')
    && appSource.includes('backend-settings-integration-readiness-route-required')
    && appSource.includes('Readiness Proof Map must expose localMvpStartupReadinessRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose settingsHealthReadinessRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose settingsProviderReadinessRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose settingsRuntimeReadinessRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose settingsIntegrationReadinessRoutes from the backend.')
    && appSource.includes('managerReadModelSourceBadge(card.source, `proof-map-${card.key}-source`)')
    && appSource.includes('managerProofMapRouteSyncButton(card.route, `proof-map-${card.key}-sync-proof-map`)')
    && appSource.includes('data-testid={`proof-map-${card.key}-open-settings`}')
    && appSource.includes('data-testid={`proof-map-${card.key}-timeline-open`}')
    && mockRegister.includes('Manager Proof Map now renders Settings readiness route cards')
    && technicalSource.includes('Manager Proof Map renders Settings readiness route cards')
    && agentReadmeSource.includes('Manager Proof Map renders Settings readiness route cards')
    && architectureAuditSource.includes('Manager Proof Map renders Settings readiness route cards'),
  'Manager Proof Map must render Settings startup/provider/runtime/integration readiness route cards with source badges and Sync Proof Map actions.',
);
assert(
  appSource.includes('const autonomyProofMapRouteOrMissing =')
    && appSource.includes('const backendCoreAutonomyProofMapCards = coreAutonomyProofMapSpecs.map')
    && appSource.includes('productTeamOperatingLoopRoutes')
    && appSource.includes('plannerExecutorReviewerStateMachineRoutes')
    && appSource.includes('teamCollaborationDiagnosticRoutes')
    && appSource.includes('teamCollaborationDiagnosticsSummary')
    && appSource.includes('runtimeContractFreezeRoutes')
    && appSource.includes('autonomousCycleConsistencyRoutes')
    && appSource.includes('runtimeAutonomyStatusRoutes')
    && appSource.includes('data-testid="backend-planner-executor-reviewer-state-machine-snapshot"')
    && appSource.includes('data-testid="backend-planner-executor-reviewer-state-machine-source"')
    && appSource.includes("managerProofModelSyncButton(backendPlannerExecutorReviewerStateMachine, 'backend-planner-executor-reviewer-state-machine-sync-proof-models')")
    && appSource.includes('data-testid="backend-planner-executor-reviewer-state-machine-roles"')
    && appSource.includes('data-testid="backend-planner-executor-reviewer-state-machine-transitions"')
    && appSource.includes('data-testid="backend-planner-executor-reviewer-state-machine-route"')
    && appSource.includes('backend-product-team-operating-loop-route-required')
    && appSource.includes('backend-planner-executor-reviewer-state-machine-route-required')
    && appSource.includes('backend-team-collaboration-diagnostics-route-required')
    && appSource.includes('backend-runtime-contract-freeze-route-required')
    && appSource.includes('backend-autonomous-cycle-consistency-route-required')
    && appSource.includes('backend-runtime-autonomy-status-route-required')
    && appSource.includes('Readiness Proof Map must expose productTeamOperatingLoopRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose plannerExecutorReviewerStateMachineRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose teamCollaborationDiagnosticRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose runtimeContractFreezeRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose autonomousCycleConsistencyRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose runtimeAutonomyStatusRoutes from the backend.')
    && appSource.includes('backendCoreAutonomyProofMapCards.map')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-proof-models`}')
    && appSource.includes('syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })')
    && appSource.includes('Autonomy timeline proof')
    && mockRegister.includes('Manager Proof Map now renders C/A autonomy route cards')
    && technicalSource.includes('Manager Proof Map renders C/A autonomy route cards')
    && agentReadmeSource.includes('Manager Proof Map renders C/A autonomy route cards')
    && architectureAuditSource.includes('Manager Proof Map renders C/A autonomy route cards'),
  'Manager Proof Map must render C/A autonomy route cards with source badges, Sync Proof Map, Sync Proof Models, and timeline proof actions.',
);
assert(
  appSource.includes('const backendCockpitProofMapCards = cockpitProofMapSpecs.map')
    && appSource.includes('agentStateSummaryRoutes')
    && appSource.includes('agentStateSummarySummary')
    && appSource.includes('assignmentTimelineMatrixRoutes')
    && appSource.includes('assignmentTimelineMatrixSummary')
    && appSource.includes('changeFlowRoutes')
    && appSource.includes('changeFlowSummary')
    && appSource.includes('continuousWorkLoopRoutes')
    && appSource.includes('continuousWorkLoopSummary')
    && appSource.includes('backend-agent-state-summary-route-required')
    && appSource.includes('backend-assignment-timeline-matrix-route-required')
    && appSource.includes('backend-change-flow-route-required')
    && appSource.includes('backend-continuous-work-loop-route-required')
    && appSource.includes('Readiness Proof Map must expose agentStateSummaryRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose assignmentTimelineMatrixRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose changeFlowRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose continuousWorkLoopRoutes from the backend.')
    && appSource.includes('backendCockpitProofMapCards.map')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-cockpit`}')
    && appSource.includes('syncBackendCockpitReadModels({ silent: false, projectId: activeProject.id })')
    && appSource.includes('Cockpit timeline proof')
    && mockRegister.includes('Manager Proof Map now renders Cockpit dispatch route cards')
    && technicalSource.includes('Manager Proof Map renders Cockpit dispatch route cards')
    && agentReadmeSource.includes('Manager Proof Map renders Cockpit dispatch route cards')
    && architectureAuditSource.includes('Manager Proof Map renders Cockpit dispatch route cards'),
  'Manager Proof Map must render Cockpit dispatch route cards with source badges, Sync Proof Map, Sync Cockpit, and timeline proof actions.',
);
assert(
  appSource.includes('const governanceProofMapSpecs = [')
    && appSource.includes('const backendGovernanceProofMapCards = governanceProofMapSpecs.map')
    && appSource.includes('governanceProtocolRoutes')
    && appSource.includes('governanceProtocolSummary')
    && appSource.includes('managerCommandCenterRoutes')
    && appSource.includes('managerCommandCenterSummary')
    && appSource.includes('managerScenarioTrailRoutes')
    && appSource.includes('managerScenarioTrailSummary')
    && appSource.includes('managerScenarioWalkthroughRoutes')
    && appSource.includes('managerScenarioWalkthroughSummary')
    && appSource.includes('managerRequirementMatrixRoutes')
    && appSource.includes('managerRequirementMatrixSummary')
    && appSource.includes('syncProtocolAuditRoutes')
    && appSource.includes('syncProtocolAuditSummary')
    && appSource.includes('managerUseCaseAuditRoutes')
    && appSource.includes('managerUseCaseAuditSummary')
    && appSource.includes('managerActionQueueRoutes')
    && appSource.includes('managerActionQueueSummary')
    && appSource.includes('backend-governance-protocol-route-required')
    && appSource.includes('backend-manager-command-center-route-required')
    && appSource.includes('backend-manager-scenario-trail-route-required')
    && appSource.includes('backend-manager-scenario-walkthrough-route-required')
    && appSource.includes('backend-manager-requirement-matrix-route-required')
    && appSource.includes('backend-sync-protocol-audit-route-required')
    && appSource.includes('backend-manager-use-case-audit-route-required')
    && appSource.includes('backend-manager-action-queue-route-required')
    && appSource.includes('Readiness Proof Map must expose governanceProtocolRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerCommandCenterRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerScenarioTrailRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerScenarioWalkthroughRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerRequirementMatrixRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose syncProtocolAuditRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerUseCaseAuditRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose managerActionQueueRoutes from the backend.')
    && agentProjectServiceSource.includes('governanceProtocolRoutes: projectId ? [')
    && agentProjectServiceSource.includes('managerCommandCenterRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('managerScenarioTrailRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('managerScenarioWalkthroughRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('managerRequirementMatrixRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('syncProtocolAuditRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('managerUseCaseAuditRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('managerActionQueueRoutes: projectId ? [{')
    && agentProjectServiceSource.includes("sourceLabel: 'Manager governance route'")
    && agentProjectServiceSource.includes("attachmentType: 'manager-governance-route'")
    && agentProjectServiceSource.includes("['governance-protocol', 'sync-protocol-audit', 'Defines C/A roles']")
    && agentProjectServiceSource.includes("['manager-command-center', 'manager-action-queue', 'Next Manager action']")
    && appSource.includes('backendGovernanceProofMapCards.map')
    && appSource.includes('data-testid={`proof-map-${card.key}-sync-governance`}')
    && appSource.includes('syncBackendGovernanceProofMapCard(card.syncKind)')
    && appSource.includes('Governance chat proof')
    && appSource.includes('Governance timeline proof')
    && mockRegister.includes('Manager Proof Map now renders Governance/action route cards')
    && mockRegister.includes('Manager Flow Graph mirrors those same governance/action routes as route-backed nodes')
    && technicalSource.includes('Manager Proof Map renders Governance/action route cards')
    && technicalSource.includes('Manager Flow Graph also projects the same C-side routes')
    && agentReadmeSource.includes('Manager Proof Map renders Governance/action route cards')
    && agentReadmeSource.includes('Manager Flow Graph mirrors those C-side contracts')
    && architectureAuditSource.includes('Manager Proof Map renders Governance/action route cards')
    && architectureAuditSource.includes('Manager Flow Graph projects the same contracts as route-backed governance/action nodes'),
  'Manager Proof Map and Manager Flow Graph must expose Governance/action routes with route-backed read-model sync, chat proof, and timeline proof actions.',
);
assert(
  appSource.includes('const outputProofMapRouteOrMissing =')
    && appSource.includes('const backendOutputChainProofMapCards = outputChainProofMapSpecs.map')
    && appSource.includes('submissionRoutes')
    && appSource.includes('submissionSummary')
    && appSource.includes('evidenceSearchRoutes')
    && appSource.includes('evidenceSearchSummary')
    && appSource.includes('evidenceQualityRoutes')
    && appSource.includes('evidenceQualitySummary')
    && appSource.includes('evidenceSourceReviewWorkflowRoutes')
    && appSource.includes('evidenceSourceReviewWorkflowSummary')
    && appSource.includes('evidenceIndexReadinessRoutes')
    && appSource.includes('evidenceIndexReadinessSummary')
    && appSource.includes('brainstormLayerRoutes')
    && appSource.includes('brainstormLayerSummary')
    && appSource.includes('artifactQualityRoutes')
    && appSource.includes('artifactQualitySummary')
    && appSource.includes('evidenceCustodyRoutes')
    && appSource.includes('evidenceCustodySummary')
    && appSource.includes('projectEvidenceArchiveRoutes')
    && appSource.includes('projectEvidenceArchiveSummary')
    && appSource.includes('backend-agent-submission-routes-required')
    && appSource.includes('backend-evidence-search-routes-required')
    && appSource.includes('backend-evidence-quality-audit-route-required')
    && appSource.includes('backend-evidence-source-review-workflow-route-required')
    && appSource.includes('backend-evidence-index-readiness-route-required')
    && appSource.includes('backend-brainstorm-layer-route-required')
    && appSource.includes('backend-artifact-quality-audit-route-required')
    && appSource.includes('backend-evidence-custody-readiness-route-required')
    && appSource.includes('backend-project-evidence-archive-route-required')
    && appSource.includes('Readiness Proof Map must expose submissionRoutes from the backend when submissions exist.')
    && appSource.includes('Readiness Proof Map must expose evidenceSearchRoutes from the backend when evidence searches exist.')
    && appSource.includes('Readiness Proof Map must expose evidenceQualityRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose evidenceSourceReviewWorkflowRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose evidenceIndexReadinessRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose brainstormLayerRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose artifactQualityRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose evidenceCustodyRoutes from the backend.')
    && appSource.includes('Readiness Proof Map must expose projectEvidenceArchiveRoutes from the backend.')
    && agentProjectServiceSource.includes('evidenceQualityRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('evidenceSourceReviewWorkflowRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('evidenceIndexReadinessRoutes: projectId ? [{')
    && agentProjectServiceSource.includes('projectEvidenceArchiveRoutes: projectId ? [{')
    && appSource.includes('backendOutputChainProofMapCards.map')
    && appSource.includes('const cardChatProofIds = chatProofIdsFromIds(card.proofIds);')
    && appSource.includes('data-testid={`proof-map-${card.key}-chat-open`}')
    && appSource.includes('Output chat proof')
    && appSource.includes('Output timeline proof')
    && mockRegister.includes('Manager Proof Map now renders Output chain route cards')
    && technicalSource.includes('Manager Proof Map renders Output chain route cards')
    && agentReadmeSource.includes('Manager Proof Map renders Output chain route cards')
    && architectureAuditSource.includes('Manager Proof Map renders Output chain route cards'),
  'Manager Proof Map must render Output chain route cards with source badges, Sync Proof Map, Sync Proof Models, chat proof, and timeline proof actions.',
);
assert(
  appSource.includes('settings-evidence-index-readiness-route')
    && appSource.includes('/evidence-index-readiness')
    && appSource.includes('settings-integration-readiness-contract')
    && appSource.includes('settings-integration-readiness-summary')
    && appSource.includes('/settings-integration-readiness')
    && appSource.includes('settingsAutoIntegrationSyncRef')
    && appSource.includes("settingsTab !== 'integrations'")
    && agentProjectServiceSource.includes('settingsIntegrationReadinessRoutes')
    && agentProjectServiceSource.includes('settingsIntegrationReadinessStatus')
    && agentProjectApiSource.includes("route.action === 'settings-integration-readiness'")
    && appSource.includes('Local evidence index, adapter gateway, MCP governance, budget alert, and error reporting readiness are backend routes')
    && appSource.includes('Route sync:')
    && appSource.includes('integrationCapabilityRouteSyncLabel')
    && appSource.includes('Integration capability contract not synced.')
    && !appSource.includes('Missing backend rows:')
    && !appSource.includes('Backend integration capability model missing.'),
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
  realUserZeroToAutonomySource.includes('/project-evidence-archive')
    && realUserZeroToAutonomySource.includes('project-evidence-archive/v1')
    && realUserZeroToAutonomySource.includes('/evidence-source-review-workflow')
    && realUserZeroToAutonomySource.includes('sourceReviewDecisionCount')
    && realUserZeroToAutonomySource.includes('pendingDecisionSourceCount === 0')
    && realUserZeroToAutonomySource.includes('readyForManagerHandoff === true')
    && realUserZeroToAutonomySource.includes('artifactStorageProofCoverageReady')
    && realUserZeroToAutonomySource.includes('workspaceFileProofCount')
    && realUserZeroToAutonomySource.includes('backend-project-evidence-archive-snapshot')
    && realUserZeroToAutonomySource.includes('Storage Proofs')
    && realUserZeroToAutonomySource.includes('Workspace Files')
    && realUserZeroToAutonomySource.includes('Source Decisions'),
  'Real-user browser validation must prove source decisions plus Project Evidence Archive storage/workspace proof coverage and Manager UI readback.',
);
assert(
  appSource.includes('project-chat-create-transcript-channel')
    && appSource.includes('const canCreateLocalChannel = allowLocalRuntimeFallbackForActiveProject(activeProject);')
    && appSource.includes('const canCreateChannel = Boolean(activeProject) && (canCreateLocalChannel || shouldAttemptBackendProjectWrite(activeProject));')
    && appSource.includes('disabled={!canCreateChannel}')
    && appSource.includes("await runBackendProjectCommand('transcripts'")
    && appSource.includes('Backend transcript channel created')
    && appSource.includes('backend-channel-create-required')
    && appSource.includes('backend-channel-create-open-deployment')
    && appSource.includes("onClick={() => { setSettingsTab('deployment'); setSettingsOpen(true); }}")
    && appSource.includes('if (shouldAttemptBackendProjectWrite(activeProject))')
    && appSource.includes('syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id, channelId: channel.id });')
    && appSource.includes('const backendChannelTranscriptRequired = Boolean(activeProject)')
    && appSource.includes('const backendChannelTranscriptUsable = Boolean(backendChannelTranscript) && (')
    && appSource.includes('? backendVisibleMessages')
    && appSource.includes(': mergeProjectMessages(localVisibleMessages, backendVisibleMessages)')
    && appSource.includes('project-chat-transcript-backend-required')
    && appSource.includes('This real backend project requires the channel transcript route before local messages can be shown as collaboration proof.')
    && appSource.includes(': (backendChannelTranscriptRequired ? [] : localVisibleMessages);')
    && appSource.includes('const backendManagerDashboard = dashboardBackendManagerDashboard || null;')
    && appSource.includes('const backendCollaborationProofReadModel = backendManagerDashboard')
    && appSource.includes("const chatBackendManagerDashboard = String(backendStation.managerDashboard?.projectId || '').toLowerCase() === String(activeProject.id || '').toLowerCase()")
    && appSource.includes('const backendCollaborationProofReadModel = chatBackendManagerDashboard')
    && appSource.includes('Array.isArray(backendManagerDashboard.evidenceSearches?.rows)')
    && appSource.includes('Array.isArray(backendManagerDashboard.submissions?.rows)')
    && appSource.includes('Array.isArray(backendManagerDashboard.submissionReviews?.rows)')
    && appSource.includes('Array.isArray(backendManagerDashboard.evidenceSourceReviews?.rows)')
    && appSource.includes('const backendCollaborationProofReadModelRequired = shouldRequireBackendAgentDashboard(activeProject);')
    && appSource.includes('const localCollaborationProofRowsAllowed = !backendCollaborationProofReadModelRequired;')
    && appSource.includes('const collaborationEvidenceRows = backendCollaborationProofReadModel?.evidenceRows || (localCollaborationProofRowsAllowed ? activeProject.evidenceSearches || [] : []);')
    && appSource.includes('const collaborationSubmissionRows = backendCollaborationProofReadModel?.submissionRows || (localCollaborationProofRowsAllowed ? activeProject.agentSubmissions || [] : []);')
    && appSource.includes('const collaborationReviewRows = backendCollaborationProofReadModel?.reviewRows || (localCollaborationProofRowsAllowed ? activeProject.submissionReviews || [] : []);')
    && appSource.includes('group-chat-collaboration-proof-backend-required')
    && appSource.includes('Manager Dashboard collaboration rows before evidence, submissions, reviews, revisions, or final delivery can be shown as transcript proof.')
    && appSource.includes('group-chat-collaboration-proof-sync-manager-dashboard')
    && mockRegister.includes('The live Group Chat stream now uses backend channel transcript messages as the sole visible message source for backend-required real projects')
    && architectureAuditSource.includes('Backend-required real projects render visible channel messages from `GET /projects/:id/transcripts/:channelId` only')
    && appSource.includes("onClick={() => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })}")
    && appSource.includes('Sync Manager Dashboard')
    && appSource.includes('const localChatCardProofRowsAllowed = !backendChannelTranscriptRequired;')
    && appSource.includes('const chatCardEvidenceRows = backendCollaborationProofReadModel?.evidenceRows || (localChatCardProofRowsAllowed ? activeProject.evidenceSearches || [] : []);')
    && appSource.includes('const chatCardSubmissionRows = backendCollaborationProofReadModel?.submissionRows || (localChatCardProofRowsAllowed ? activeProject.agentSubmissions || [] : []);')
    && appSource.includes('const chatCardReviewRows = backendCollaborationProofReadModel?.reviewRows || (localChatCardProofRowsAllowed ? activeProject.submissionReviews || [] : []);')
    && appSource.includes('const chatCardSourceReviewRows = backendCollaborationProofReadModel?.sourceReviewRows || (localChatCardProofRowsAllowed ? activeProject.evidenceSourceReviews || [] : []);')
    && !appSource.includes('const submission = (activeProject.agentSubmissions || [])')
    && !appSource.includes('const review = (activeProject.submissionReviews || [])')
    && !appSource.includes('const evidenceSearch = (activeProject.evidenceSearches || [])')
    && !appSource.includes('const review = (activeProject.evidenceSourceReviews || [])')
    && mockRegister.includes('Group Chat Collaboration Proof Rows now require current-project Manager Dashboard collaboration read models')
    && mockRegister.includes('Group Chat work-node cards now own their current-project Manager Dashboard collaboration resolver')
    && technicalSource.includes('The live Group Chat view owns the same current-project Manager Dashboard collaboration resolver')
    && agentReadmeSource.includes('The live Group Chat view resolves those work-node card rows inside the chat view itself')
    && architectureAuditSource.includes('Live Group Chat work-node cards now have the same independence boundary')
    && mockRegister.includes('group-chat-collaboration-proof-sync-manager-dashboard')
    && appSource.includes('project-chat-tool-pin')
    && appSource.includes('project-chat-channel-pinned')
    && appSource.includes('project-chat-tool-members')
    && appSource.includes('project-chat-member-presence-panel')
    && appSource.includes('project-chat-message-reply-${message.id}')
    && appSource.includes('project-chat-message-mention-${message.id}')
    && appSource.includes('project-chat-message-pin-${message.id}')
    && appSource.includes('project-chat-attachment')
    && appSource.includes('project-chat-attachment-input')
    && !appSource.includes('project-chat-tool-pin-backend-required')
    && !appSource.includes('project-chat-tool-members-backend-required')
    && !appSource.includes('project-chat-message-mention-backend-required-')
    && !appSource.includes('project-chat-attachment-backend-required')
    && !appSource.includes("if (backendStation.connectionStatus === 'online') {\n                          syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id, channelId: channel.id });")
    && !appSource.includes('createMockChannel')
    && !appSource.includes('project-chat-create-local-channel'),
  'Group Chat channel creation must use the backend transcript-channel contract for real projects, not mock/local channel naming.',
);
assert(
  appSource.includes('managerAutoTranscriptSyncRef')
    && appSource.includes("!['dashboard', 'chat'].includes(projectMode)")
    && appSource.includes("const transcriptSyncOptions = projectMode === 'chat'")
    && appSource.includes("channelId: activeChannelId || 'main'")
    && appSource.includes('syncBackendProjectTranscripts(transcriptSyncOptions);')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard or Group Chat view now automatically syncs `GET /projects/:id/transcripts` once per project/view/channel/backend target'),
  'Manager Dashboard and Group Chat must automatically read backend transcripts before local cached chat can look like collaboration proof.',
);
assert(
  appSource.includes('const transcriptLocalRecoveryAllowed = !backendTranscriptReadModelRequired && !backendTranscriptReadModelReady;')
    && appSource.includes(': backendTranscriptReadModelRequired')
    && appSource.includes('? backendTranscriptMessages')
    && appSource.includes('? mergeProjectMessages(localProjectTranscriptMessages, backendTranscriptMessages)')
    && appSource.includes('const recoveredProofIdsByChannel = (transcriptLocalRecoveryAllowed ? [')
    && appSource.includes('...(activeProject.logs || []).map(log => ({')
    && appSource.includes('] : []).reduce((acc, item) => {')
    && appSource.includes('const transcriptRecoverableProofCount = Number.isFinite(Number(backendTranscriptIndex?.recoverableProofCount))')
    && appSource.includes('const archivedProofIds = (backendTranscriptReadModelMissing ? [] : (backendSummary?.proofIds || (transcriptLocalRecoveryAllowed ? recoveredProofIdsByChannel[channel.id] : []) || []))')
    && appSource.includes('${transcriptRecoverableProofCount} recoverable proofs')
    && mockRegister.includes('Group Chat Transcript Index local proof recovery is now explicitly disabled once backend transcript evidence is required or already present')
    && mockRegister.includes('Dashboard Transcript Index now uses backend transcript messages as the only aggregate message source for backend-required real projects')
    && technicalSource.includes('The transcript index recovery counter is also backend-scoped')
    && agentReadmeSource.includes('Group Chat Transcript Index uses the same backend transcript boundary')
    && architectureAuditSource.includes('Group Chat Transcript Index follows the same rule')
    && architectureAuditSource.includes('Dashboard Transcript Index uses backend transcript messages as the aggregate source for backend-required real projects'),
  'Group Chat Transcript Index must not merge local messages, rebuild archived proof ids, or recover counts from local logs once backend transcript evidence is required or present.',
);
assert(
  appSource.includes('const dashboardBackendManagerDashboard = String(backendStation.managerDashboard?.projectId || \'\').toLowerCase() === String(activeProject.id || \'\').toLowerCase()')
    && appSource.includes('const dashboardBackendTranscriptIndex = String(backendStation.transcriptIndex?.projectId || \'\').toLowerCase() === String(activeProject.id || \'\').toLowerCase()')
    && appSource.includes('const localRunStatsAllowed = !timelineEventReadModelsRequired;')
    && appSource.includes('const localEventLedgerFallbackAllowed = !timelineEventReadModelsRequired;')
    && appSource.includes('const fallbackEventLedgerRows = localEventLedgerFallbackAllowed ? activeProject.eventLedger || [] : [];')
    && appSource.includes('const fallbackEventLedgerSummary = localEventLedgerFallbackAllowed ? summarizeProjectEventLedger(activeProject) : missingEventLedgerSummary;')
    && appSource.includes('const dashboardActiveChannelCount = Number.isFinite(Number(dashboardBackendTranscriptIndex?.channelCount))')
    && appSource.includes("        : (timelineEventReadModelsRequired ? projectText('backend required') : chatChannels.length);")
    && appSource.includes('const dashboardAutonomousCycleCount = dashboardBackendManagerDashboard?.autonomousRunControlLoops?.count')
    && appSource.includes("?? (localRunStatsAllowed ? activeProject.autonomousLedger?.length || 0 : projectText('backend required'))")
    && appSource.includes('const dashboardAgentRunCount = dashboardBackendManagerDashboard?.agentAutonomousActionRuns?.count')
    && appSource.includes("?? (localRunStatsAllowed ? activeProject.agentWorkerLedger?.length || activeProject.autonomousLedger?.length || 0 : projectText('backend required'))")
    && appSource.includes('const dashboardBackendTaskRows = Array.isArray(dashboardBackendManagerDashboard?.tasks?.rows)')
    && appSource.includes('const dashboardOpenTaskCount = dashboardBackendManagerDashboard?.tasks?.openCount')
    && appSource.includes("timelineEventReadModelsRequired ? projectText('backend required') : (activeProject.tasks || []).filter(task => task.status !== 'done').length")
    && appSource.includes('const projectDashboardSnapshotSourceMeta = fixtureMeta')
    && appSource.includes('data-testid="project-dashboard-snapshot-source"')
    && appSource.includes('data-testid="project-dashboard-snapshot-source-detail"')
    && appSource.includes('data-testid="project-dashboard-progress-source"')
    && appSource.includes('data-testid="project-dashboard-progress-source-detail"')
    && appSource.includes('const projectDashboardKickoffExecutionFlowBackendRequired = Boolean(')
    && appSource.includes("const projectDashboardFocusSourceMeta = projectDashboardKickoffExecutionFlowBackendRequired")
    && appSource.includes("const projectDashboardFocusValue = projectDashboardKickoffExecutionFlowBackendRequired")
    && appSource.includes('const projectDashboardNextRecommendationBackendRequired = projectDashboardKickoffExecutionFlowBackendRequired;')
    && appSource.includes('&& !dashboardBackendManagerDashboard?.kickoffExecutionFlow')
    && appSource.includes('data-testid="project-dashboard-next-recommendation-source"')
    && appSource.includes('data-testid="project-dashboard-next-recommendation-source-detail"')
    && appSource.includes('data-testid="project-dashboard-next-recommendation-sync-manager-dashboard"')
    && appSource.includes("onClick={() => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })}")
    && appSource.includes("Sync Manager Dashboard before trusting the next recommendation for this backend project.")
    && appSource.includes("NEXT ACTION RESOLUTION: {projectDashboardNextRecommendationBackendRequired ? 'backend required'")
    && appSource.includes("AGENT RECEIPTS: {projectDashboardNextRecommendationBackendRequired ? 'backend required'")
    && appSource.includes('const projectDashboardStatSourceMeta = (source, detail) => ({')
    && appSource.includes('const projectDashboardEventLedgerSourceMeta = eventLedgerReadModel.frontendMockSuppressed')
    && appSource.includes('const projectDashboardActiveChannelSourceMeta = dashboardBackendTranscriptIndex')
    && appSource.includes('const projectDashboardAutonomousCycleSourceMeta = dashboardBackendManagerDashboard?.autonomousRunControlLoops?.count')
    && appSource.includes("sourceId: 'focus', sourceMeta: projectDashboardFocusSourceMeta")
    && appSource.includes("sourceId: 'active-channels', sourceMeta: projectDashboardActiveChannelSourceMeta")
    && appSource.includes("sourceId: 'open-tasks', sourceMeta: projectDashboardOpenTaskSourceMeta")
    && appSource.includes("sourceId: 'timeline-logs', sourceMeta: projectDashboardTimelineSourceMeta")
    && appSource.includes("sourceId: 'event-ledger', sourceMeta: projectDashboardEventLedgerSourceMeta")
    && appSource.includes("sourceId: 'autonomous-cycles', sourceMeta: projectDashboardAutonomousCycleSourceMeta")
    && appSource.includes("sourceId: 'agent-runs', sourceMeta: projectDashboardAgentRunSourceMeta")
    && appSource.includes('data-testid={`project-dashboard-stat-source-${item.sourceId}`}')
    && appSource.includes('data-testid={`project-dashboard-stat-source-detail-${item.sourceId}`}')
    && appSource.includes("{ label: projectText('Focus'), value: projectDashboardFocusValue, icon: Crosshair, sourceId: 'focus', sourceMeta: projectDashboardFocusSourceMeta }")
    && appSource.includes("{ label: projectText('Active Channels'), value: dashboardActiveChannelCount, icon: Hash, sourceId: 'active-channels', sourceMeta: projectDashboardActiveChannelSourceMeta }")
    && appSource.includes("{ label: projectText('Open Tasks'), value: dashboardOpenTaskCount, icon: ClipboardList, sourceId: 'open-tasks', sourceMeta: projectDashboardOpenTaskSourceMeta }")
    && appSource.includes("openTasks: projectText('backend required')")
    && appSource.includes("{ label: projectText('Autonomous Cycles'), value: dashboardAutonomousCycleCount, icon: Activity, sourceId: 'autonomous-cycles', sourceMeta: projectDashboardAutonomousCycleSourceMeta }")
    && appSource.includes("{ label: 'Agent Runs', value: dashboardAgentRunCount, icon: Activity, sourceId: 'agent-runs', sourceMeta: projectDashboardAgentRunSourceMeta }")
    && !appSource.includes('const dashboardStats = [')
    && !appSource.includes('No kickoff evidence has been created for this project yet.')
    && appSource.includes('const backendLatestProjectCycle = dashboardBackendManagerDashboard?.operationsBoard?.latestProjectCycle || null;')
    && appSource.includes('const latestSchedulerRecord = dashboardBackendManagerDashboard?.operationsBoard?.latestSchedulerRecord')
    && appSource.includes('|| (localRunStatsAllowed ? activeProject.autonomousSchedulerLedger?.[0] : null)')
    && appSource.includes('const autonomousWorkLoopCycles = backendLatestProjectCycle')
    && appSource.includes(': (localRunStatsAllowed ? activeProject.autonomousLedger || [] : []);')
    && appSource.includes('const autonomousWorkLoopBackendRequired = !localRunStatsAllowed && !latestSchedulerRecord && !backendLatestProjectCycle;')
    && appSource.includes('const localDirectCommandFallbackAllowed = allowLocalRuntimeFallbackForActiveProject(activeProject);')
    && appSource.includes('const backendManagedCommandTargetMissing = !backendCommandAvailable && !localDirectCommandFallbackAllowed;')
    && appSource.includes('const autonomousPulseCommandDisabled = backendStation.loading || backendManagedCommandTargetMissing;')
    && appSource.includes('disabled={backendStation.loading || backendManagedCommandTargetMissing || !managerAssignmentDraft.text.trim() || Boolean(sceneTransition)}')
    && appSource.includes('disabled={backendStation.loading || backendManagedCommandTargetMissing || !managerChangeDraft.text.trim() || Boolean(sceneTransition)}')
    && appSource.includes('disabled={autonomousPulseCommandDisabled}')
    && appSource.includes('autonomous-work-loop-backend-required')
    && appSource.includes('Backend operations board is required before this real project can show scheduler or autonomous-cycle history.')
    && appSource.includes('autonomousWorkLoopCycles.length > 0')
    && appSource.includes('const operationsBoardBackendRequired = Boolean(agentStateSummary.frontendMockSuppressed);')
    && appSource.includes('const operationsBoardProjectNextRunLabel = operationsBoardBackendRequired')
    && appSource.includes('const operationsBoardProjectLastRunLabel = operationsBoardBackendRequired')
    && appSource.includes('const operationsBoardCadenceLabel = operationsBoardBackendRequired')
    && appSource.includes('const continuousWorkProjectNextRunLabel = continuousWorkLoop.frontendMockSuppressed')
    && appSource.includes('{operationsBoardProjectNextRunLabel}')
    && appSource.includes('{operationsBoardProjectLastRunLabel}')
    && appSource.includes('{continuousWorkProjectNextRunLabel}')
    && appSource.includes('const scenarioAutonomyCycleLabel = dashboardAutonomousCycleCount')
    && appSource.includes('const scenarioAutonomyNextRunLabel = autonomousWorkLoopNextRunAt')
    && appSource.includes('const scenarioAutonomyStatus = autonomousWorkLoopBackendRequired')
    && appSource.includes('const scenarioAutonomyProof = `${projectText(\'Cycles\')}: ${scenarioAutonomyCycleLabel} / ${projectText(\'Next\')}: ${scenarioAutonomyNextRunLabel}`;')
    && appSource.includes('status: scenarioAutonomyStatus')
    && appSource.includes('proof: scenarioAutonomyProof')
    && !appSource.includes('proof: `${activeProject.autonomousLedger?.length || 0} cycles / next ${formatRunTime(activeProject.nextAutonomousRunAt || autonomousSchedule.nextRunAt)}`')
    && appSource.includes('const scenarioManagementProofCount = agentManagementMeshDisplayRows')
    && appSource.includes('const scenarioManagementStatus = agentManagementMesh.frontendMockSuppressed')
    && appSource.includes('const scenarioManagementProof = agentManagementMesh.frontendMockSuppressed')
    && appSource.includes('status: scenarioManagementStatus')
    && appSource.includes('proof: scenarioManagementProof')
    && !appSource.includes("proof: `${timelineProofIdsForTypes(['management-check-in', 'peer-management-check-in', 'management-response']).length} management proof logs`")
    && appSource.includes('const scenarioChangeCount = changeFlow.frontendMockSuppressed')
    && appSource.includes('const scenarioChangeStatus = changeFlow.frontendMockSuppressed')
    && appSource.includes('const scenarioChangeProof = changeFlow.frontendMockSuppressed')
    && appSource.includes('status: scenarioChangeStatus')
    && appSource.includes('proof: scenarioChangeProof')
    && !appSource.includes("status: `${changeLedger.length} change${changeLedger.length === 1 ? '' : 's'} recorded`")
    && !appSource.includes('proof: `${changeFlowRows.filter(row => row.ownerPlanLinked).length} owner plan sync / ${changeFlowRows.filter(row => row.teamSyncCount > 0).length} team sync`')
    && appSource.includes('const scenarioKickoffExecutionFlow = backendManagerDashboard?.kickoffExecutionFlow')
    && appSource.includes('const scenarioKickoffBackendRequired = timelineEventReadModelsRequired && !backendManagerDashboard?.kickoffExecutionFlow;')
    && appSource.includes('const scenarioKickoffStatus = scenarioKickoffBackendRequired')
    && appSource.includes('const scenarioKickoffProof = scenarioKickoffBackendRequired')
    && appSource.includes('const localKickoffExecutionFallbackAllowed = allowManagerFrontendFallbacks;')
    && appSource.includes('const kickoffActionIds = localKickoffExecutionFallbackAllowed')
    && appSource.includes('const firstPulseMessages = localKickoffExecutionFallbackAllowed ? projectTranscriptMessages.filter(message => (')
    && appSource.includes('const allAgentStartupRows = localKickoffExecutionFallbackAllowed ? activeProject.team.filter(Boolean).map(agent => {')
    && appSource.includes('const nextActionResolution = localKickoffExecutionFallbackAllowed')
    && appSource.includes('const backendKickoffExecutionFlow = backendManagerDashboard?.kickoffExecutionFlow || null;')
    && appSource.includes('const buildLocalKickoffExecutionFlow = () => kickoffCharter ? {')
    && appSource.includes('const normalizeKickoffStartupRow = (row, index) => {')
    && appSource.includes('allAgentStartupRows: (flow.allAgentStartupRows || []).filter(Boolean).map(normalizeKickoffStartupRow),')
    && appSource.includes("String(row.task?.id || row.taskId || '') === String(action.id || action.taskId || '')")
    && appSource.includes('const kickoffExecutionFlow = normalizeKickoffExecutionFlow(')
    && appSource.includes('const kickoffExecutionFlowBackendRequired = timelineEventReadModelsRequired && !backendKickoffExecutionFlow;')
    && appSource.includes('kickoff-execution-flow-backend-required')
    && appSource.includes('kickoff-execution-flow-sync-manager-dashboard')
    && appSource.includes('status: scenarioKickoffStatus')
    && appSource.includes('proof: scenarioKickoffProof')
    && !appSource.includes("status: nextActionResolution?.managerConfirmed ? 'Manager confirmed' : kickoffCharter ? 'Charter ready' : 'Needs kickoff'")
    && !appSource.includes('proof: `${kickoffExecutionFlow?.nextActions?.length || 0} next actions / ${nextActionResolutionDelivery?.deliveredAgentIds?.length || 0}/${activeProject.team.length} Agent receipts`')
    && appSource.includes('const recentLineBackendRequired = isInitiatedProject && timelineEventReadModelsRequired && !backendTimelineLogs;')
    && appSource.includes('timelineDisplayLogs.map((log, index) => ({')
    && appSource.includes('recent-commit-line-backend-required')
    && appSource.includes('recent-commit-line-sync-timeline-events')
    && appSource.includes('Backend timeline read model is required before this real project can show recent commit history.')
    && appSource.includes('const backendTaskRows = Array.isArray(backendManagerDashboard?.tasks?.rows)')
    && appSource.includes('const localTaskProofFallbackAllowed = !timelineEventReadModelsRequired;')
    && appSource.includes('const taskProofBackendRequired = timelineEventReadModelsRequired && !backendTaskRows;')
    && appSource.includes('const localTaskEvidence = (task) => ({')
    && appSource.includes('const taskEvidence = (task = {}) => {')
    && appSource.includes('dataSource: \'backend-backed\'')
    && appSource.includes('return localTaskProofFallbackAllowed ? localTaskEvidence(task) : emptyTaskEvidence(task);')
    && appSource.includes('const activeThreadRows = taskProofBackendRequired ? [] : backendTaskRows || activeProject.tasks || [];')
    && appSource.includes('activeThreadRows.map(task => {')
    && appSource.includes('data-testid={`active-thread-task-row-${task.id}`}')
    && appSource.includes('active-threads-task-proof-backend-required')
    && appSource.includes('Backend Manager Dashboard task rows are required before this real project can show active threads or task proof.')
    && appSource.includes('active-threads-sync-manager-dashboard')
    && appSource.includes("onClick={() => syncBackendManagerDashboard({ silent: false, projectId: activeProject.id })}")
    && mockRegister.includes('Dashboard run-count stat cards now use Manager Dashboard / Ready Package read models')
    && mockRegister.includes('Autonomous Work Loop now follows the same boundary')
    && mockRegister.includes('The 24/7 Operations Board and Continuous Work Loop summary tiles now follow the same rule')
    && mockRegister.includes('Scenario Control Center\'s `24/7 Work Pulse` status and proof line now read the same backend Manager Dashboard / Operations Board counters')
    && mockRegister.includes('Scenario Control Center\'s `Agent Management Sync` status and proof line now read the `agent-management-mesh/v1` display rows')
    && mockRegister.includes('Scenario Control Center\'s `Mid-project Change Intake` status/proof now reads the `change-flow/v1` display rows')
    && mockRegister.includes('Scenario Control Center\'s `Kickoff Decisions` status/proof now reads backend `managerDashboard.kickoffExecutionFlow`')
    && mockRegister.includes('Kickoff Execution Flow local next-action, first-pulse, and startup rows are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Recent Commit Line now consumes `timelineDisplayLogs`')
    && mockRegister.includes('Active Threads rows and task proof buttons now read Manager Dashboard task rows')
    && mockRegister.includes('Manager Dashboard Open Tasks now uses `managerDashboard.tasks.openCount`')
    && mockRegister.includes('Project Dashboard Active Channels now follows the transcript boundary')
    && mockRegister.includes('Project Dashboard stat cards now render source labels')
    && mockRegister.includes('project-dashboard-snapshot-source')
    && mockRegister.includes('project-dashboard-progress-source')
    && mockRegister.includes('project-dashboard-next-recommendation-source')
    && mockRegister.includes('project-dashboard-next-recommendation-sync-manager-dashboard')
    && mockRegister.includes('project-dashboard-stat-source-focus')
    && mockRegister.includes('the Focus card now also requires `managerDashboard.kickoffExecutionFlow`')
    && mockRegister.includes('project-dashboard-stat-source-active-channels')
    && mockRegister.includes('project-dashboard-stat-source-open-tasks')
    && mockRegister.includes('project-dashboard-stat-source-autonomous-cycles')
    && mockRegister.includes('Workspace Hub Open Tasks now follows the project catalog boundary')
    && mockRegister.includes('Workspace Hub Stored Messages follows the same catalog/transcript boundary')
    && technicalSource.includes('The Manager Dashboard Open Tasks stat and Active Threads list follow the same boundary')
    && technicalSource.includes('The 24/7 Operations Board and Continuous Work Loop summary tiles use that same backend-required boundary')
    && appSource.includes('const autonomousWorkLoopTitle = autonomousWorkLoopBackendRequired')
    && appSource.includes("? projectText('backend required')\n      : activeProject.autonomy?.enabled ? `${activeProject.autonomy.cadence || 'hourly'} cadence enabled` : 'Cadence paused';")
    && appSource.includes('{autonomousWorkLoopTitle}')
    && technicalSource.includes('Scenario Control Center\'s 24/7 pulse proof display also reads backend Manager Dashboard / Operations Board cycle and next-run evidence')
    && technicalSource.includes('Scenario Control Center\'s `Kickoff Decisions` status/proof reads backend `managerDashboard.kickoffExecutionFlow`')
    && technicalSource.includes('`Agent Management Sync` reads backend `agent-management-mesh/v1` rows')
    && technicalSource.includes('`Mid-project Change Intake` reads backend `change-flow/v1` rows')
    && technicalSource.includes('Project Dashboard Active Channels uses that same transcript boundary')
    && technicalSource.includes('project-dashboard-snapshot-source')
    && technicalSource.includes('project-dashboard-progress-source')
    && technicalSource.includes('project-dashboard-next-recommendation-source')
    && technicalSource.includes('project-dashboard-next-recommendation-sync-manager-dashboard')
    && technicalSource.includes('project-dashboard-stat-source-focus')
    && technicalSource.includes('Project Dashboard Focus stat follows the same kickoff execution boundary as Next Recommendation')
    && technicalSource.includes('project-dashboard-stat-source-active-channels')
    && technicalSource.includes('project-dashboard-stat-source-open-tasks')
    && technicalSource.includes('project-dashboard-stat-source-autonomous-cycles')
    && technicalSource.includes('project-dashboard-stat-source-agent-runs')
    && technicalSource.includes('Workspace Hub aggregate task and message counts follow the backend catalog boundary')
    && agentReadmeSource.includes('The Manager Dashboard Open Tasks stat and Active Threads list also read `managerDashboard.tasks.openCount`')
    && agentReadmeSource.includes('the UI does not use local `nextAutonomousRunAt` / `lastAutonomousRunAt` as scheduler proof')
    && agentReadmeSource.includes('Scenario Control Center\'s `Kickoff Decisions` status/proof uses `managerDashboard.kickoffExecutionFlow`')
    && agentReadmeSource.includes('Scenario Control Center uses those same backend operation counters for its `24/7 Work Pulse` proof text')
    && agentReadmeSource.includes('Scenario Control Center\'s `Agent Management Sync` proof text uses the backend `agent-management-mesh/v1` rows')
    && agentReadmeSource.includes('Scenario Control Center\'s `Mid-project Change Intake` status/proof also reads `change-flow/v1` display rows')
    && agentReadmeSource.includes('Project Dashboard Active Channels follows the transcript boundary')
    && agentReadmeSource.includes('project-dashboard-snapshot-source')
    && agentReadmeSource.includes('project-dashboard-progress-source')
    && agentReadmeSource.includes('project-dashboard-next-recommendation-source')
    && agentReadmeSource.includes('project-dashboard-next-recommendation-sync-manager-dashboard')
    && agentReadmeSource.includes('project-dashboard-stat-source-focus')
    && agentReadmeSource.includes('Project Dashboard Focus uses the same `managerDashboard.kickoffExecutionFlow` requirement')
    && agentReadmeSource.includes('project-dashboard-stat-source-active-channels')
    && agentReadmeSource.includes('project-dashboard-stat-source-open-tasks')
    && agentReadmeSource.includes('project-dashboard-stat-source-autonomous-cycles')
    && agentReadmeSource.includes('project-dashboard-stat-source-agent-runs')
    && agentReadmeSource.includes('Workspace Hub project aggregates follow the same backend catalog boundary')
    && architectureAuditSource.includes('The Manager Dashboard Open Tasks stat and Active Threads list also use backend Manager Dashboard task rows/open counts')
    && architectureAuditSource.includes('its project next/last pulse and cadence labels now show `backend required`')
    && architectureAuditSource.includes('Scenario Control Center\'s `Kickoff Decisions` status/proof reads backend `managerDashboard.kickoffExecutionFlow`')
    && architectureAuditSource.includes('Scenario Control Center\'s `24/7 Work Pulse` proof text uses the same backend Manager Dashboard / Operations Board counters')
    && architectureAuditSource.includes('Its `Agent Management Sync` proof text reads backend `agent-management-mesh/v1` rows')
    && architectureAuditSource.includes('its `Mid-project Change Intake` status/proof reads backend `change-flow/v1` rows under the same boundary')
    && architectureAuditSource.includes('Project Dashboard Active Channels now reads the current backend transcript index')
    && architectureAuditSource.includes('Project Dashboard header now exposes `project-dashboard-snapshot-source`')
    && architectureAuditSource.includes('project-dashboard-progress-source')
    && architectureAuditSource.includes('project-dashboard-next-recommendation-source')
    && architectureAuditSource.includes('project-dashboard-next-recommendation-sync-manager-dashboard')
    && architectureAuditSource.includes('the top stat cards expose source badges for Focus')
    && architectureAuditSource.includes('Project Dashboard Focus now shares the `managerDashboard.kickoffExecutionFlow` backend-required boundary')
    && architectureAuditSource.includes('Active Channels')
    && architectureAuditSource.includes('Autonomous Cycles')
    && architectureAuditSource.includes('Workspace Hub aggregate Active Projects, Backend Projects, Open Tasks, and Stored Messages now follow the backend catalog boundary'),
  'Dashboard run-count/channel/open-task stat cards, Autonomous Work Loop, and Recent Commit Line must not read local runtime/timeline/task/chat ledgers for backend-required real projects.',
);
assert(
  appSource.includes('const backendOrLazyFallback = (backendValue, fallbackFactory, missingValue, readModelName) => (')
    && appSource.includes('const buildFallbackManagerCommandCenter = () => ({')
    && appSource.includes('const managerCommandCenter = backendOrLazyFallback(')
    && appSource.includes('buildFallbackManagerCommandCenter,')
    && appSource.includes("missingBackendReadModel('manager-command-center/v1'")
    && appSource.includes("managerReadModelSourceBadge(managerCommandCenter, 'manager-command-center-source')")
    && appSource.includes('manager-command-center-backend-required')
    && appSource.includes('Local command rows are suppressed until /manager-command-center returns manager-command-center/v1.')
    && appSource.includes('manager-command-center-sync-read-model')
    && appSource.includes("onClick={() => syncBackendManagerCommandCenter({ silent: false, projectId: activeProject.id })}")
    && appSource.includes("openTasks: projectText('backend required'),\n          changeRequests: projectText('backend required'),")
    && appSource.includes("backendManagerCommandCenter ? (backendManagerCommandCenter.nextBestAction?.canRun ? 'next action ready' : backendManagerCommandCenter.status || 'monitoring') : 'backend required'")
    && appSource.includes("backendManagerScenarioTrail ? `${backendManagerScenarioTrail.passedCount ?? 0}-${backendManagerScenarioTrail.count ?? 0} ready` : 'backend required'")
    && appSource.includes("backendManagerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough.completedCount ?? 0}-${backendManagerScenarioWalkthrough.count ?? 0} complete` : 'backend required'")
    && appSource.includes("backendManagerRequirementMatrix ? `${backendManagerRequirementMatrix.passedCount ?? 0}-${backendManagerRequirementMatrix.count ?? 0} ready` : 'backend required'")
    && appSource.includes("backendManagerActionQueue ? `${backendManagerActionQueue.readyCount ?? 0} ready next actions` : 'backend required'")
    && appSource.includes("backendAgentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue.readyCount ?? 0} ready Agent actions` : 'backend required'")
    && appSource.includes("backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable actions` : 'backend required'")
    && appSource.includes("['Scenario Trail', backendManagerDashboard.managerScenarioTrail ? backendManagerDashboard.managerScenarioTrail.passedCount ?? 0 : projectText('backend required')]")
    && appSource.includes("['Walkthrough', backendManagerScenarioWalkthrough || backendManagerDashboard.managerScenarioWalkthrough ? `${backendManagerScenarioWalkthrough?.completedCount ?? backendManagerDashboard.managerScenarioWalkthrough?.completedCount ?? 0}/${backendManagerScenarioWalkthrough?.count ?? backendManagerDashboard.managerScenarioWalkthrough?.count ?? 0}` : projectText('backend required')]")
    && appSource.includes("['Standalone Trail', backendManagerScenarioTrail ? backendManagerScenarioTrail.passedCount ?? 0 : projectText('backend required')]")
    && appSource.includes("['Action Queue', backendManagerActionQueue || backendManagerDashboard.managerActionQueue ? `${backendManagerActionQueue?.completedCount ?? backendManagerDashboard.managerActionQueue?.completedCount ?? 0}/${backendManagerActionQueue?.count ?? backendManagerDashboard.managerActionQueue?.count ?? 0}` : projectText('backend required')]")
    && appSource.includes("['Agent Queue', backendAgentAutonomousActionQueue || backendManagerDashboard.agentAutonomousActionQueue ? `${backendAgentAutonomousActionQueue?.readyCount ?? backendManagerDashboard.agentAutonomousActionQueue?.readyCount ?? 0}/${backendAgentAutonomousActionQueue?.count ?? backendManagerDashboard.agentAutonomousActionQueue?.count ?? 0}` : projectText('backend required')]")
    && appSource.includes("['Run Control', backendAutonomousRunControl ? `${backendAutonomousRunControl.summary?.runnableActionCount ?? 0} runnable` : projectText('backend required')]")
    && appSource.includes('const backendManagerReadySummary = backendManagerReadyPackage?.summary || {};')
    && appSource.includes('const readyPackageSummaryHas = (key) => Object.prototype.hasOwnProperty.call(backendManagerReadySummary, key);')
    && appSource.includes('const readyPackageSummaryValue = (key) => (')
    && appSource.includes('const readyPackageSummaryStatus = (key) => (')
    && appSource.includes('const readyPackageSummaryBoolean = (key) => (')
    && appSource.includes('const readyPackageModelAvailable = (model) => Boolean(')
    && appSource.includes('const readyPackageModelValue = (model, externalValue, summaryKey) => (')
    && appSource.includes('const readyPackageModelStatus = (model, externalValue, summaryKey) => (')
    && appSource.includes('const readyPackageModelRatio = (model, externalReady, externalCount, readyKey, countKey) => (')
    && appSource.includes('const readyPackageModelCents = (model, externalValue, summaryKey) => (')
    && appSource.includes("const readyPackageModelBoolean = (model, externalValue, summaryKey, trueLabel = 'ready', falseLabel = 'blocked') => (")
    && appSource.includes("['Pilot Launch', readyPackageModelStatus(backendPilotLaunchReadiness, backendPilotLaunchReadiness?.privatePilotDecision, 'pilotLaunchDecision')]")
    && appSource.includes("['Launch Gates', readyPackageModelRatio(backendPilotLaunchReadiness, backendPilotLaunchReadiness?.summary?.passedGateCount, backendPilotLaunchReadiness?.summary?.gateCount, 'pilotLaunchPassedGateCount', 'pilotLaunchGateCount')]")
    && appSource.includes("['Preflight', readyPackageModelBoolean(backendDeploymentPreflight, backendDeploymentPreflight?.privatePilotDeploymentReady, 'deploymentPreflightReady')]")
    && appSource.includes("['Gateway', readyPackageModelStatus(backendAdapterGatewayPreflight, backendAdapterGatewayPreflight?.status, 'adapterGatewayPreflightStatus')]")
    && appSource.includes("[projectText('Infra Rehearsal'), readyPackageModelStatus(backendProductionInfrastructureRehearsal, backendProductionInfrastructureRehearsal?.status, 'productionInfrastructureRehearsalStatus')]")
    && appSource.includes("[projectText('Launch Approval'), projectText(readyPackageModelStatus(backendLaunchApprovalWorkflow, backendLaunchApprovalWorkflow?.status, 'launchApprovalStatus'))]")
    && appSource.includes("[projectText('Launch Audit'), projectText(readyPackageModelStatus(backendProductionLaunchAudit, backendProductionLaunchAudit?.status, 'productionLaunchAuditStatus'))]")
    && appSource.includes("['Evidence Archive', readyPackageModelStatus(backendProjectEvidenceArchive, backendProjectEvidenceArchive?.status, 'projectEvidenceArchiveStatus')]")
    && appSource.includes("['Evidence Export', readyPackageModelStatus(backendProjectEvidenceExportWorkflow, backendProjectEvidenceExportWorkflow?.status, 'projectEvidenceExportStatus')]")
    && appSource.includes("['Go-Live Status', readyPackageModelStatus(backendPrivatePilotGoLiveReadiness, backendPrivatePilotGoLiveReadiness?.status, 'privatePilotGoLiveStatus')]")
    && appSource.includes("['Release Candidate', readyPackageModelStatus(backendPrivatePilotReleaseCandidateWorkflow, backendPrivatePilotReleaseCandidateWorkflow?.status, 'privatePilotReleaseCandidateStatus')]")
    && appSource.includes("['Pilot Launch Run', readyPackageModelStatus(backendPrivatePilotLaunchRunWorkflow, backendPrivatePilotLaunchRunWorkflow?.status, 'privatePilotLaunchRunStatus')]")
    && appSource.includes("['Post Launch Health', readyPackageModelStatus(backendPrivatePilotLaunchHealthCheckWorkflow, backendPrivatePilotLaunchHealthCheckWorkflow?.status, 'privatePilotLaunchHealthCheckStatus')]")
    && appSource.includes("['Acceptance Report', readyPackageModelStatus(backendPrivatePilotAcceptanceReportWorkflow, backendPrivatePilotAcceptanceReportWorkflow?.status, 'privatePilotAcceptanceReportStatus')]")
    && appSource.includes("['Production Ops', readyPackageModelStatus(backendProductionOperationsReadiness, backendProductionOperationsReadiness?.status, 'productionOperationsStatus')]")
    && appSource.includes("['Artifact Audit', readyPackageModelStatus(backendArtifactQualityAudit, backendArtifactQualityAudit?.status, 'artifactQualityAuditStatus')]")
    && appSource.includes("['Review Workflow', readyPackageModelStatus(backendSubmissionReviewWorkflow, backendSubmissionReviewWorkflow?.status, 'submissionReviewWorkflowStatus')]")
    && appSource.includes('{readyPackageModelAvailable(backendProductionLaunchAudit) && (')
    && appSource.includes('{readyPackageModelAvailable(backendLaunchApprovalWorkflow) && (')
    && appSource.includes('{readyPackageModelAvailable(backendPilotLaunchReadiness) && (')
    && appSource.includes('{readyPackageModelAvailable(backendDeploymentPreflight) && (')
    && appSource.includes('{readyPackageModelAvailable(backendOperationsReadiness) && (')
    && appSource.includes('{readyPackageModelAvailable(backendProviderReadiness) && (')
    && appSource.includes('{readyPackageModelAvailable(backendProviderControlledRun) && (')
    && appSource.includes('{readyPackageModelAvailable(backendProviderEvalRunWorkflow) && (')
    && appSource.includes('{readyPackageModelAvailable(backendEvidenceCustodyReadiness) && (')
    && appSource.includes('{readyPackageModelAvailable(backendSecurityBoundary) && (')
    && appSource.includes("['Delivery Trace', readyPackageModelStatus(backendProductTeamDeliveryTrace, backendProductTeamDeliveryTrace?.status, 'productTeamDeliveryTraceStatus')]")
    && appSource.includes("['Trace Ready', readyPackageModelRatio(backendProductTeamDeliveryTrace, backendProductTeamDeliveryTrace?.summary?.readyCount, backendProductTeamDeliveryTrace?.summary?.rowCount, 'productTeamDeliveryTraceReadyCount', 'productTeamDeliveryTraceRowCount')]")
    && appSource.includes("['Operating Loop', readyPackageModelStatus(backendProductTeamOperatingLoop, backendProductTeamOperatingLoop?.status, 'productTeamOperatingLoopStatus')]")
    && appSource.includes("['Loop Ready', readyPackageModelBoolean(backendProductTeamOperatingLoop, backendProductTeamOperatingLoop?.readyForLocalPilotOperatingLoop, 'productTeamOperatingLoopReady')]")
    && appSource.includes("['Collab Diagnostics', readyPackageModelStatus(backendTeamCollaborationDiagnostics, backendTeamCollaborationDiagnostics?.status, 'teamCollaborationDiagnosticsStatus')]")
    && appSource.includes("['Intent Rows', readyPackageModelRatio(backendCollaborationIntentQueue, backendCollaborationIntentQueue?.summary?.runnableCount, backendCollaborationIntentQueue?.summary?.rowCount, 'collaborationIntentQueueRunnableCount', 'collaborationIntentQueueRowCount')]")
    && appSource.includes("['Runtime Contracts', readyPackageModelStatus(backendRuntimeContracts, backendRuntimeContracts?.status, 'runtimeContractsStatus')]")
    && appSource.includes("['Cycle Steps', readyPackageModelRatio(backendAutonomousCycleConsistency, backendAutonomousCycleConsistency?.summary?.observedStepCount, backendAutonomousCycleConsistency?.summary?.requiredStepCount, 'autonomousCycleConsistencyObservedStepCount', 'autonomousCycleConsistencyRequiredStepCount')]")
    && appSource.includes("['Runtime Autonomy', readyPackageModelStatus(backendRuntimeAutonomyStatus, backendRuntimeAutonomyStatus?.status, 'runtimeAutonomyStatus')]")
    && appSource.includes("['Evidence Audit', readyPackageModelStatus(backendEvidenceQualityAudit, backendEvidenceQualityAudit?.status, 'evidenceQualityAuditStatus')]")
    && appSource.includes("['Evidence Quality', readyPackageModelValue(backendEvidenceQualityAudit, backendEvidenceQualityAudit?.summary?.averageQualityScore, 'evidenceQualityAverageScore')]")
    && appSource.includes("['Evidence Index', readyPackageModelStatus(backendEvidenceIndexReadiness, backendEvidenceIndexReadiness?.status, 'evidenceIndexReadinessStatus')]")
    && appSource.includes("['Index Rows', readyPackageModelRatio(backendEvidenceIndexReadiness, backendEvidenceIndexReadiness?.summary?.evidenceSearchCount, backendEvidenceIndexReadiness?.summary?.submissionCount, 'evidenceIndexReadinessSearchCount', 'evidenceIndexReadinessSubmissionCount')]")
    && appSource.includes("['Source Queue', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.reviewRequiredSourceCount, 'evidenceSourceReviewQueuedCount')]")
    && appSource.includes("['Source Decisions', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.sourceReviewDecisionCount, 'evidenceSourceReviewDecisionCount')]")
    && appSource.includes("['Source Pending', readyPackageModelValue(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.summary?.pendingDecisionSourceCount, 'evidenceSourceReviewPendingDecisionCount')]")
    && appSource.includes("['Source Review', readyPackageModelStatus(backendEvidenceSourceReviewWorkflow, backendEvidenceSourceReviewWorkflow?.status, 'evidenceSourceReviewStatus')]")
    && appSource.includes("['Evidence Custody', readyPackageModelStatus(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.status, 'evidenceCustodyStatus')]")
    && appSource.includes("['Custody Ready', readyPackageModelBoolean(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.readyForPrivatePilot, 'evidenceCustodyReady')]")
    && appSource.includes("['Custody Records', readyPackageModelValue(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.summary?.custodyRecordCount, 'evidenceCustodyRecordCount')]")
    && appSource.includes("['Custody Storage', readyPackageModelBoolean(backendEvidenceCustodyReadiness, backendEvidenceCustodyReadiness?.readyForProduction, 'evidenceCustodyProductionReady', 'production-ready', 'managed-blocked')]")
    && appSource.includes("['Security', readyPackageModelStatus(backendSecurityBoundary, backendSecurityBoundary?.status, 'securityBoundaryStatus')]")
    && appSource.includes("['Providers', readyPackageModelStatus(backendProviderReadiness, backendProviderReadiness?.status, 'providerReadinessStatus')]")
    && appSource.includes("['Controlled Run', readyPackageModelStatus(backendProviderControlledRun, backendProviderControlledRun?.status, 'providerControlledRunStatus')]")
    && appSource.includes("['Run Ready', readyPackageModelBoolean(backendProviderControlledRun, backendProviderControlledRun?.readyForPrivatePilotRun, 'providerControlledRunReady')]")
    && appSource.includes("['Run Ops', readyPackageModelRatio(backendProviderControlledRun, backendProviderControlledRun?.summary?.runnableOperationCount, backendProviderControlledRun?.summary?.operationCount, 'providerControlledRunRunnableOperationCount', 'providerControlledRunOperationCount')]")
    && appSource.includes("['Run Cost', readyPackageModelCents(backendProviderControlledRun, backendProviderControlledRun?.summary?.estimatedRunCostCents, 'providerControlledRunEstimatedCostCents')]")
    && appSource.includes("['Provider Eval', readyPackageModelStatus(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.status, 'providerEvalRunWorkflowStatus')]")
    && appSource.includes("['Eval Ready', readyPackageModelBoolean(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.readyForPrivatePilotProviderEval, 'providerEvalRunReady', 'ready', 'record')]")
    && appSource.includes("['Eval Runs', readyPackageModelRatio(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.summary?.passedRunCount, backendProviderEvalRunWorkflow?.summary?.runCount, 'providerEvalRunPassedCount', 'providerEvalRunCount')]")
    && appSource.includes("['Eval Critical', readyPackageModelRatio(backendProviderEvalRunWorkflow, backendProviderEvalRunWorkflow?.summary?.replayedCriticalOperationCount, backendProviderEvalRunWorkflow?.summary?.criticalOperationCount, 'providerEvalRunReplayedCriticalCount', 'providerEvalRunCriticalCount')]")
    && appSource.includes("['Operations', readyPackageModelStatus(backendOperationsReadiness, backendOperationsReadiness?.status, 'operationsReadinessStatus')]")
    && appSource.includes("['Persistence Adapter', readyPackageSummaryStatus('persistenceAdapterDryRunStatus')]")
    && appSource.includes("['Queue Adapter', readyPackageSummaryStatus('queueAdapterDryRunStatus')]")
    && appSource.includes("['Queue Parity', readyPackageSummaryBoolean('queueAdapterSnapshotParityReady')]")
    && appSource.includes("['Worker Recovery', readyPackageSummaryBoolean('workerRecoveryContractReady')]")
    && appSource.includes("['Incident Drill', readyPackageSummaryBoolean('operationsIncidentDrillReady')]")
    && appSource.includes("['Trail Ready', readyPackageSummaryRatio('scenarioTrailReadyCount', 'scenarioTrailCount')]")
    && appSource.includes("['Walkthrough', readyPackageSummaryRatio('walkthroughCompletedCount', 'walkthroughCount')]")
    && appSource.includes("['Requirements', readyPackageSummaryRatio('requirementReadyCount', 'requirementCount')]")
    && appSource.includes("['Kickoff Board', readyPackageSummaryRatio('kickoffBoardReadyCount', 'kickoffBoardCount')]")
    && appSource.includes("['Work Loop Board', readyPackageSummaryRatio('workLoopRunningCount', 'workLoopCount')]")
    && appSource.includes("['Collaboration Board', readyPackageSummaryRatio('collaborationReadyCount', 'collaborationBoardCount')]")
    && appSource.includes("['Change Protocol', readyPackageSummaryRatio('changeProtocolReadyCount', 'changeProtocolBoardCount')]")
    && appSource.includes("['Change Owners', readyPackageSummaryRatio('changeOwnerReadyCount', 'changeOwnerCount')]")
    && appSource.includes("['Use Cases', readyPackageSummaryRatio('useCaseCoveredCount', 'useCaseCount')]")
    && appSource.includes("['Action Queue', readyPackageSummaryRatio('actionQueueCompletedCount', 'actionQueueCount')]")
    && appSource.includes("['Unresolved Routes', readyPackageSummaryValue('actionQueueUnresolvedRouteCount')]")
    && appSource.includes("['Transcript Channels', readyPackageSummaryValue('transcriptChannelCount')]")
    && appSource.includes("['Ops Agents', readyPackageSummaryValue('operationsAgentCount')]")
    && appSource.includes("['Assignments', readyPackageSummaryValue('assignmentCount')]")
    && appSource.includes("['Changes', readyPackageSummaryValue('changeCount')]")
    && appSource.includes("managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : `${managerScenarioWalkthrough.completedCount || 0}/${managerScenarioWalkthrough.count || 0} ${projectText('complete')}`")
    && appSource.includes("['Next Gap', managerScenarioWalkthrough.frontendMockSuppressed ? projectText('backend required') : managerScenarioWalkthrough.nextIncompleteStep?.stage || 'All covered']")
    && appSource.includes("['Action Queue', managerScenarioWalkthrough.frontendMockSuppressed || managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0}`]")
    && appSource.includes("managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : `${managerActionPlaybook.completedCount ?? 0}/${managerActionPlaybook.count ?? 0} complete`")
    && appSource.includes("['Next', managerActionPlaybook.frontendMockSuppressed ? projectText('backend required') : managerActionPlaybook.nextAction?.label || 'All complete']")
    && appSource.includes('const managerScenarioWalkthrough = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-scenario-walkthrough/v1'")
    && appSource.includes("managerReadModelSourceBadge(managerScenarioWalkthrough, 'manager-scenario-walkthrough-source')")
    && appSource.includes('manager-scenario-walkthrough-backend-required')
    && appSource.includes('Local walkthrough rows are suppressed until /manager-scenario-walkthrough returns manager-scenario-walkthrough/v1.')
    && appSource.includes('manager-scenario-walkthrough-sync-read-model')
    && appSource.includes("onClick={() => syncBackendManagerScenarioWalkthrough({ silent: false, projectId: activeProject.id })}")
    && appSource.includes('const managerActionPlaybook = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-action-queue/v1'")
    && appSource.includes("managerReadModelSourceBadge(managerActionPlaybook, 'manager-action-playbook-source')")
    && appSource.includes('manager-action-playbook-backend-required')
    && appSource.includes('Local action rows are suppressed until /manager-action-queue returns manager-action-queue/v1.')
    && appSource.includes('manager-action-playbook-sync-action-queue')
    && appSource.includes('const managerUseCaseAuditBase = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-use-case-audit/v1'")
    && appSource.includes("managerReadModelSourceBadge(managerUseCaseAudit, 'manager-use-case-audit-source')")
    && appSource.includes('manager-use-case-audit-backend-required')
    && appSource.includes('Local use-case rows are suppressed until /manager-use-case-audit returns manager-use-case-audit/v1.')
    && appSource.includes('manager-use-case-audit-sync-read-model')
    && appSource.includes("onClick={() => syncBackendManagerUseCaseAudit({ silent: false, projectId: activeProject.id })}")
    && appSource.includes("missingBackendReadModel('sync-protocol-audit/v1'")
    && appSource.includes('const buildFallbackSyncProtocolAudit = () => {')
    && appSource.includes('const syncProtocolAudit = backendOrLazyFallback(')
    && appSource.includes('buildFallbackSyncProtocolAudit')
    && appSource.includes('sync-protocol-audit-backend-required')
    && appSource.includes('Local protocol rows are suppressed until /sync-protocol-audit returns sync-protocol-audit/v1.')
    && appSource.includes('sync-protocol-audit-sync-read-model')
    && appSource.includes("onClick={() => syncBackendSyncProtocolAudit({ silent: false, projectId: activeProject.id })}")
    && appSource.includes('const backendManagerActionRunsReadModel = backendManagerReadyPackage?.managerActionRuns || backendManagerDashboard?.managerActionRuns || null;')
    && appSource.includes("schemaVersion: 'manager-action-runs/frontend-fallback'")
    && appSource.includes('const backendManagerActionRuns = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-action-runs/v1'")
    && appSource.includes("managerReadModelSourceBadge(backendManagerActionRuns, 'manager-action-run-ledger-source')")
    && appSource.includes('manager-action-run-ledger-backend-required')
    && appSource.includes('Local run history is suppressed until Manager Dashboard returns manager-action-runs/v1.')
    && appSource.includes('manager-action-run-ledger-sync-manager-dashboard')
    && appSource.includes('!(backendManagerActionRuns?.rows || []).length && !backendManagerActionRuns.frontendMockSuppressed')
    && appSource.includes('const latestManagerActionRun = backendManagerActionRuns.latestRun || backendManagerActionRuns.rows?.[0] || null;')
    && !appSource.includes('const latestManagerActionRun = activeProject.managerActionRunLedger?.[0] || null;')
    && appSource.includes('const scopedBackendStationReadModel = (readModel = null) => {')
    && appSource.includes("const readModelProjectId = String(readModel.projectId || readModel.project?.id || '').toLowerCase();")
    && appSource.includes('const backendManagerCommandCenter = scopedBackendStationReadModel(backendStation.managerCommandCenter)')
    && appSource.includes('const backendManagerScenarioWalkthrough = scopedBackendStationReadModel(backendStation.managerScenarioWalkthrough)')
    && appSource.includes('const backendManagerActionQueue = scopedBackendStationReadModel(backendStation.managerActionQueue)')
    && appSource.includes('const backendAgentAutonomousActionQueue = scopedBackendStationReadModel(backendStation.agentAutonomousActionQueue)')
    && appSource.includes('const backendAutonomousRunControl = scopedBackendStationReadModel(backendStation.autonomousRunControl)')
    && appSource.includes('const backendLatestAutonomousRunControlRunReadModel = scopedBackendStationProof(backendStation.autonomousRunControlRun)')
    && appSource.includes('const backendLatestAutonomousRunControlRun = backendLatestAutonomousRunControlRunReadModel')
    && appSource.includes('|| (allowManagerFrontendFallbacks ? activeProject?.autonomousRunControlRunLedger?.[0] : null)')
    && appSource.includes('const backendLatestAutonomousRunControlLoopReadModel = scopedBackendStationProof(backendStation.autonomousRunControlLoop)')
    && appSource.includes('const backendLatestAutonomousRunControlLoop = backendLatestAutonomousRunControlLoopReadModel')
    && appSource.includes('|| (allowManagerFrontendFallbacks ? activeProject?.autonomousRunControlLoopLedger?.[0] : null)')
    && !appSource.includes('|| activeProject?.autonomousRunControlRunLedger?.[0]\n')
    && !appSource.includes('|| activeProject?.autonomousRunControlLoopLedger?.[0]\n')
    && mockRegister.includes('Manager Live Command Center')
    && mockRegister.includes('Manager Command Center missing-model stats are pure backend-required placeholders')
    && mockRegister.includes('Manager Scenario Walkthrough')
    && mockRegister.includes('Manager Use Case Audit')
    && mockRegister.includes('Manager Action Run Ledger now follows the same rule')
    && mockRegister.includes('Action Run Ledger')
    && technicalSource.includes('Action Run Ledger refreshes Manager Dashboard / Ready Package `manager-action-runs/v1`')
    && technicalSource.includes('if `manager-command-center/v1` is absent, `openTasks` and `changeRequests` render `backend required` rather than local browser counts')
    && agentReadmeSource.includes('Action Playbook, Action Run Ledger, Use Case Audit, Sync Protocol Audit, and Requirement Matrix')
    && architectureAuditSource.includes('Action Playbook, Action Run Ledger, Use Case Audit, Sync Protocol Audit, and Requirement Matrix')
    && mockRegister.includes("Scenario Walkthrough's latest run receipt now reads the same gated `manager-action-runs/v1` model")
    && mockRegister.includes('manager-action-runs/v1')
    && mockRegister.includes('Autonomous Run Control run/loop receipt badges now use backend station')
    && mockRegister.includes('activeProject.autonomousRunControlRunLedger'),
  'Main Manager command/walkthrough/action/use-case/run-ledger panels must show backend-required source badges and suppress local run receipts for real backend projects.',
);
assert(
  appSource.includes('const fallbackManagerScenarioTrail = {')
    && appSource.includes('const managerScenarioTrailRows = allowManagerFrontendFallbacks ? [')
    && appSource.includes("schemaVersion: 'manager-scenario-trail/frontend-fallback'")
    && appSource.includes('const managerScenarioTrail = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-scenario-trail/v1'")
    && appSource.includes('manager-scenario-trail-backend-required')
    && appSource.includes('data-testid="manager-scenario-trail-backend-required"')
    && appSource.includes('Local scenario rows are suppressed until /manager-scenario-trail returns manager-scenario-trail/v1.')
    && appSource.includes('manager-scenario-trail-sync-read-model')
    && appSource.includes("onClick={() => syncBackendManagerScenarioTrail({ silent: false, projectId: activeProject.id })}")
    && appSource.includes('const managerScenarioTrailDisplayRows = (managerScenarioTrail.rows || []).map')
    && appSource.includes("managerReadModelSourceBadge(managerScenarioTrail, 'manager-scenario-trail-source')")
    && appSource.includes('managerScenarioTrailDisplayRows.map((row, index)')
    && mockRegister.includes('The main Dashboard Scenario Trail consumes `manager-scenario-trail/v1`')
    && mockRegister.includes('backend-or-allowed-fallback gate'),
  'Main Dashboard Scenario Trail must use backendOrAllowedFallback and show backend-model-missing for real backend projects instead of rendering local rows directly.',
);
assert(
  appSource.includes('const fallbackManagerRequirementMatrix = {')
    && appSource.includes('const managerRequirementMatrixRows = allowManagerFrontendFallbacks ? [')
    && appSource.includes("schemaVersion: 'manager-requirement-matrix/frontend-fallback'")
    && appSource.includes('const managerRequirementMatrix = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-requirement-matrix/v1'")
    && appSource.includes('manager-requirement-matrix-backend-required')
    && appSource.includes('data-testid="manager-requirement-matrix-backend-required"')
    && appSource.includes('Local requirement rows are suppressed until /manager-requirement-matrix returns manager-requirement-matrix/v1.')
    && appSource.includes('manager-requirement-matrix-sync-read-model')
    && appSource.includes("onClick={() => syncBackendManagerRequirementMatrix({ silent: false, projectId: activeProject.id })}")
    && appSource.includes('const managerRequirementMatrixDisplayRows = (managerRequirementMatrix.rows || []).map')
    && appSource.includes("managerReadModelSourceBadge(managerRequirementMatrix, 'manager-requirement-matrix-source')")
    && appSource.includes('managerRequirementMatrixDisplayRows.map((row, index)')
    && mockRegister.includes('the main Dashboard Requirement Matrix consumes `manager-requirement-matrix/v1`')
    && mockRegister.includes('backend-or-allowed-fallback gate'),
  'Main Dashboard Requirement Matrix must use backendOrAllowedFallback and show backend-model-missing for real backend projects instead of rendering local rows directly.',
);
assert(
  appSource.includes('const fallbackManagerUseCaseAuditRows = allowManagerFrontendFallbacks ? localManagerUseCaseAuditSpecs.map')
    && appSource.includes('const firstPendingPlaybookIndex = allowManagerFrontendFallbacks ? managerRequirementMatrixRows.findIndex(row => !row.passed) : -1;')
    && appSource.includes('rows: allowManagerFrontendFallbacks ? managerRequirementMatrixRows.map((row, index) => {')
    && appSource.includes('const fallbackManagerScenarioWalkthroughRows = allowManagerFrontendFallbacks ? managerWalkthroughSpecs.map')
    && appSource.includes('const fallbackManagerCommandAttentionRows = allowManagerFrontendFallbacks ? [')
    && mockRegister.includes('Use Case Audit, Action Queue, Scenario Walkthrough, and Command Center attention rows are now constructed only in offline/demo fallback mode'),
  'Manager derived fallback rows must remain offline/demo-only for backend-online real projects.',
);
const managerUseCasePanelIndex = appSource.indexOf('data-testid="manager-use-case-audit"');
const managerRequirementPanelIndex = appSource.indexOf('data-testid="manager-requirement-matrix"');
const managerUseCaseBlockerIndex = appSource.indexOf('data-testid="manager-use-case-audit-backend-required"');
const managerRequirementBlockerIndex = appSource.indexOf('data-testid="manager-requirement-matrix-backend-required"');
const syncProtocolPanelIndex = appSource.indexOf('data-testid="sync-protocol-audit"');
const syncProtocolBlockerIndex = appSource.indexOf('data-testid="sync-protocol-audit-backend-required"');
assert(
  syncProtocolPanelIndex >= 0
    && managerUseCasePanelIndex > syncProtocolPanelIndex
    && syncProtocolBlockerIndex > syncProtocolPanelIndex
    && syncProtocolBlockerIndex < managerUseCasePanelIndex
    && managerRequirementPanelIndex > managerUseCasePanelIndex
    && managerUseCasePanelIndex >= 0
    && managerUseCaseBlockerIndex > managerUseCasePanelIndex
    && managerUseCaseBlockerIndex < managerRequirementPanelIndex
    && managerRequirementBlockerIndex > managerRequirementPanelIndex
    && mockRegister.includes('Use Case Audit, Requirement Matrix, and Sync Protocol Audit backend-required blockers render inside their owning panels')
    && mockRegister.includes('Sync Protocol Audit local protocol rows are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Control-panel missing states now expose in-panel sync actions')
    && technicalSource.includes('The Use Case Audit, Requirement Matrix, and Sync Protocol Audit missing-model blockers render in their own panels')
    && technicalSource.includes('Control-panel missing states expose in-panel sync actions')
    && agentReadmeSource.includes('Use Case Audit, Requirement Matrix, and Sync Protocol Audit missing-model blockers render inside their owning panels')
    && agentReadmeSource.includes('Control-panel missing states expose in-panel sync actions')
    && architectureAuditSource.includes('Use Case Audit, Requirement Matrix, and Sync Protocol Audit render their own backend-required blockers'),
  'Use Case Audit, Requirement Matrix, and Sync Protocol Audit backend-required blockers must render in the panel that owns the missing backend read model.',
);
assert(
  appSource.includes('const backendAgentManagementMesh = Array.isArray(backendManagerDashboard?.agents?.managementMesh)')
    && appSource.includes("schemaVersion: 'agent-management-mesh/frontend-fallback'")
    && appSource.includes('const peerHandoffs = allowManagerFrontendFallbacks ? activeProject.peerHandoffs || [] : [];')
    && appSource.includes('const buildLocalManagementMeshRows = () => activeProject.team.map(agent => {')
    && appSource.includes('const managementMeshRows = allowManagerFrontendFallbacks ? buildLocalManagementMeshRows() : [];')
    && appSource.includes('const buildLocalPeerManagementMatrixRows = () => (activeProject.peerManagementMatrix?.length')
    && appSource.includes('const localPeerManagementMatrixRows = allowManagerFrontendFallbacks ? buildLocalPeerManagementMatrixRows() : [];')
    && appSource.includes('const agentManagementMesh = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('agent-management-mesh/v1'")
    && appSource.includes("managerReadModelSourceBadge(agentManagementMesh, 'agent-management-mesh-source')")
    && appSource.includes('agent-management-mesh-backend-required')
    && appSource.includes('Local management and peer-proof rows are suppressed until Manager Dashboard returns agent-management-mesh/v1.')
    && appSource.includes('agent-management-mesh-sync-cockpit')
    && appSource.includes('agentManagementMesh.frontendMockSuppressed || timelineEventReadModelsRequired ? [] : localPeerManagementMatrixRows')
    && appSource.includes('agentManagementMeshDisplayRows.map(row =>')
    && appSource.includes('const assignmentTimelineMatrix = backendOrAllowedFallback(')
    && appSource.includes("schemaVersion: 'assignment-timeline-matrix/frontend-fallback'")
    && appSource.includes('const buildLocalAssignmentFlowRows = () => activeProject.tasks')
    && appSource.includes('const assignmentFlowRows = allowManagerFrontendFallbacks ? buildLocalAssignmentFlowRows() : [];')
    && appSource.includes("missingBackendReadModel('assignment-timeline-matrix/v1'")
    && appSource.includes("managerReadModelSourceBadge(assignmentTimelineMatrix, 'assignment-timeline-matrix-source')")
    && appSource.includes('const assignmentDerivedFrontendRowsAllowed = !assignmentTimelineMatrix.frontendMockSuppressed;')
    && appSource.includes('assignment-timeline-matrix-backend-required')
    && appSource.includes('assignment-timeline-matrix-sync-cockpit')
    && appSource.includes("routeAction: 'assignment-timeline-matrix'")
    && appSource.includes('const backendAssignmentTimelineMatrix = scopedBackendStationReadModel(backendStation.assignmentTimelineMatrix) || backendManagerDashboard?.assignmentTimelineMatrix || null')
    && appSource.includes('readRoutes.assignmentTimelineMatrixRoute')
    && appSource.includes('Local assignment/work-progress rows are suppressed for this backend project.')
    && appSource.includes('assignmentDerivedFrontendRowsAllowed && assignmentFlowRows.length > 0')
    && appSource.includes('assignmentDerivedFrontendRowsAllowed && (')
    && appSource.includes('assignmentTimelineMatrixDisplayRows.map(row =>')
    && appSource.includes('const changeFlow = backendOrAllowedFallback(')
    && appSource.includes("schemaVersion: 'change-flow/frontend-fallback'")
    && appSource.includes('const changeLedger = allowManagerFrontendFallbacks ? activeProject.changeLedger || [] : [];')
    && appSource.includes('const buildLocalChangeFlowRows = () => changeLedger.slice(0, 8).map(change => {')
    && appSource.includes('const changeFlowRows = allowManagerFrontendFallbacks ? buildLocalChangeFlowRows() : [];')
    && appSource.includes("missingBackendReadModel('change-flow/v1'")
    && appSource.includes("managerReadModelSourceBadge(changeFlow, 'change-flow-source')")
    && appSource.includes('const changeDerivedFrontendRowsAllowed = !changeFlow.frontendMockSuppressed;')
    && appSource.includes("routeAction: 'change-flow'")
    && appSource.includes('const backendChangeFlow = scopedBackendStationReadModel(backendStation.changeFlow) || backendManagerDashboard?.changeFlow || null')
    && appSource.includes('readRoutes.changeFlowRoute')
    && appSource.includes('const changeSourceIntakeReadModelRows = Array.isArray(changeFlow.sourceIntake?.rows)')
    && appSource.includes(': changeFlowDisplayRows.flatMap')
    && appSource.includes('change-flow-backend-required')
    && appSource.includes('change-flow-sync-cockpit')
    && appSource.includes('Local change/source-intake rows are suppressed for this backend project.')
    && appSource.includes('changeDerivedFrontendRowsAllowed && changeLedger.length > 0')
    && appSource.includes("managerReadModelSourceBadge(changeFlow, 'dual-channel-change-intake-source')")
    && appSource.includes('changeFlowDisplayRows.map(({ change, sourceName')
    && appSource.includes("schemaVersion: 'collaboration-health/frontend-fallback'")
    && appSource.includes("schemaVersion: 'collaboration-health/v1'")
    && appSource.includes("missingBackendReadModel('collaboration-health/v1'")
    && appSource.includes("managerReadModelSourceBadge(collaborationHealth, 'collaboration-health-source')")
    && appSource.includes('collaboration-health-backend-required')
    && appSource.includes('collaboration-health-sync-diagnostics')
    && appSource.includes('Local collaboration health is suppressed for this backend project.')
    && !appSource.includes('const governanceNetwork = createAgentNetwork(activeProject.team')
    && appSource.includes("schemaVersion: 'governance-protocol/frontend-fallback'")
    && appSource.includes("schemaVersion: 'governance-protocol/v1'")
    && appSource.includes('const backendStationGovernanceProtocol = scopedBackendStationReadModel(backendStation.governanceProtocol)')
    && appSource.includes('const backendGovernanceProtocol = backendStationGovernanceProtocol || backendGovernanceProtocolFromCharter;')
    && appSource.includes("missingBackendReadModel('governance-protocol/v1'")
    && appSource.includes("managerReadModelSourceBadge(governanceProtocol, 'governance-protocol-source')")
    && appSource.includes('governance-protocol-backend-required')
    && appSource.includes('governance-protocol-sync-governance')
    && appSource.includes("routeAction: 'governance-protocol'")
    && appSource.includes('Local governance inference is suppressed for this backend project.')
    && appSource.includes("schemaVersion: 'event-ledger/frontend-fallback'")
    && appSource.includes("schemaVersion: 'event-ledger/v1'")
    && appSource.includes("schemaVersion: 'event-ledger/v1/missing-backend'")
    && appSource.includes("managerReadModelSourceBadge(eventLedgerReadModel, 'event-ledger-source')")
    && appSource.includes('event-ledger-backend-required')
    && appSource.includes('Local event-ledger rows are suppressed for this backend project.')
    && appSource.includes('event-ledger-sync-timeline-events')
    && appSource.includes('onClick={() => syncBackendTimelineAndEvents({ silent: false, projectId: activeProject.id })}')
    && appSource.includes('eventLedgerDisplayRows.slice(-5).reverse().map(event =>')
    && appSource.includes('managerAutoTimelineEventSyncRef')
    && appSource.includes("!['dashboard', 'timeline'].includes(projectMode)")
    && appSource.includes('syncBackendTimelineAndEvents({ silent: true, projectId: activeProject.id })')
    && appSource.includes("schemaVersion: 'agent-state-summary/frontend-fallback'")
    && appSource.includes("schemaVersion: 'agent-state-summary/v1'")
    && appSource.includes('const normalizeAgentStateSummaryRow = (row = {}, { allowLocalProofFallback = true } = {}) => {')
    && appSource.includes('const state = row.state || (allowLocalProofFallback ? agentStates[agent.id] || {} : {});')
    && appSource.includes('const latestWorker = row.latestWorker || (allowLocalProofFallback ? latestAgentWorkerById[agent.id] || {} : {});')
    && appSource.includes('const openTaskCount = row.openTaskCount ?? row.ownedOpenTaskCount ?? row.taskCount ?? row.ownedTaskCount')
    && appSource.includes('const currentTaskText = row.currentTaskText || currentTask?.text || currentTask?.title || row.activeTaskText || row.taskText || null;')
    && appSource.includes("routeAction: 'agent-state-summary'")
    && appSource.includes('const backendAgentStateSummaryReadModel = scopedBackendStationReadModel(backendStation.agentStateSummary)')
    && appSource.includes('backendAgentStateSummaryReadModel.rows.map(row => normalizeAgentStateSummaryRow(row, { allowLocalProofFallback: false }))')
    && appSource.includes('readRoutes.agentStateSummaryRoute')
    && appSource.includes('localOperationsBoardRows.map(row => normalizeAgentStateSummaryRow(row, { allowLocalProofFallback: true }))')
    && appSource.includes("const agentStateSummaryAllowsLocalProofFallback = agentStateSummary.schemaVersion === 'agent-state-summary/frontend-fallback';")
    && appSource.includes('allowLocalProofFallback: agentStateSummaryAllowsLocalProofFallback')
    && appSource.includes('normalizeAgentStateSummaryRow(row, { allowLocalProofFallback: false })')
    && appSource.includes('const agentStatusLocalTasksAllowed = agentStateSummaryAllowsLocalProofFallback;')
    && appSource.includes('const backendOwnedOpenTaskCount = row.openTaskCount')
    && appSource.includes('const displayOpenTaskCount = agentStatusLocalTasksAllowed ? ownedOpenTasks.length : backendOwnedOpenTaskCount;')
    && appSource.includes('const currentTask = agentStatusLocalTasksAllowed ? ownedOpenTasks[0] || null : null;')
    && appSource.includes('const backendCurrentTaskText = row.currentTaskText')
    && appSource.includes("managerReadModelSourceBadge(agentStateSummary, 'dashboard-agent-status-source')")
    && appSource.includes('dashboard-agent-status-backend-required')
    && appSource.includes('Backend Agent State Summary required. Local Agent status rows are suppressed for this backend project.')
    && appSource.includes('dashboard-agent-status-sync-cockpit')
    && appSource.includes("missingBackendReadModel('agent-state-summary/v1'")
    && appSource.includes("managerReadModelSourceBadge(agentStateSummary, 'agent-state-summary-source')")
    && appSource.includes("managerReadModelSourceBadge(agentStateSummary, 'fixed-work-routines-source')")
    && appSource.includes('agent-state-summary-backend-required')
    && appSource.includes('agent-state-summary-sync-cockpit')
    && appSource.includes('fixed-work-routines-backend-required')
    && appSource.includes('fixed-work-routines-sync-cockpit')
    && appSource.includes('Local Agent state rows are suppressed for this backend project.')
    && appSource.includes('Local fixed-routine rows are suppressed for this backend project.')
    && appSource.includes("schemaVersion: 'continuous-work-loop/frontend-fallback'")
    && appSource.includes("schemaVersion: backendContinuousWorkLoopReadModel.schemaVersion || 'continuous-work-loop/v1'")
    && appSource.includes("routeAction: 'continuous-work-loop'")
    && appSource.includes('const backendContinuousWorkLoopReadModel = scopedBackendStationReadModel(backendStation.continuousWorkLoop)')
    && appSource.includes('backendContinuousWorkLoopReadModel.rows.map(row => {')
    && appSource.includes('readRoutes.continuousWorkLoopRoute')
    && appSource.includes("missingBackendReadModel('continuous-work-loop/v1'")
    && appSource.includes("managerReadModelSourceBadge(continuousWorkLoop, 'continuous-work-loop-source')")
    && appSource.includes('continuous-work-loop-backend-required')
    && appSource.includes('continuous-work-loop-sync-cockpit')
    && appSource.includes('Local loop rows are suppressed for this backend project.')
    && appSource.includes('const localManagerSubmissionReviewRowsAllowed = !shouldRequireBackendProofTranscript(activeProject);')
    && appSource.includes('const managerSubmissionReviewRows = backendManagerDashboard?.submissionReviews?.rows?.length')
    && appSource.includes(': (localManagerSubmissionReviewRowsAllowed ? activeProject.submissionReviews || [] : []).slice(0, 40).map(review => ({')
    && appSource.includes('const managerSubmissionReviewRowsBackendRequired = !localManagerSubmissionReviewRowsAllowed')
    && appSource.includes('backend-manager-submission-reviews-required')
    && appSource.includes('Manager Dashboard submission-review rows are required before this real project can show review receipts.')
    && agentProjectServiceSource.includes('const openOwnedTasks = (project.tasks || [])')
    && agentProjectServiceSource.includes('openTaskCount: openOwnedTasks.length')
    && agentProjectServiceSource.includes('currentTaskText: currentTask?.text || currentTask?.title || null')
    && mockRegister.includes('Agent Management Mesh, Assignment Timeline Matrix, and Change Resolution Matrix now consume Manager Dashboard backend rows')
    && mockRegister.includes('Agent Management Mesh local management proof rows are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Peer handoff rows and local Peer Management Matrix rows are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Assignment Timeline Matrix local assignment rows and Change Flow local change rows are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Agent Current Work Status now uses backend Agent State Summary task counts and current-task text')
    && mockRegister.includes('dashboard-agent-status-backend-required')
    && mockRegister.includes('dashboard-agent-status-sync-cockpit')
    && mockRegister.includes('suppresses the local assignment-flow and work-progress rows')
    && mockRegister.includes('suppresses local change/source-intake rows')
    && mockRegister.includes('The main `Collaboration Health` score now also consumes this backend diagnostic model')
    && mockRegister.includes('Governance & Speech Protocol now reads Leader/Reviewer from the standalone `governance-protocol/v1` backend route')
    && mockRegister.includes('Unified Event Ledger now consumes backend `/events` rows as `event-ledger/v1`')
    && mockRegister.includes('Unified Event Ledger local event rows and summary are now constructed only in demo/offline fallback mode')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard or Manager Flow Graph view now automatically syncs `/timeline` and `/events`')
    && mockRegister.includes('24/7 Operations Board, Continuous Work Loop, and Fixed Work Routines now consume backend Agent state rows')
    && mockRegister.includes('assignment-timeline-matrix-sync-cockpit')
    && mockRegister.includes('change-flow-sync-cockpit')
    && mockRegister.includes('governance-protocol-sync-governance')
    && mockRegister.includes('recent-commit-line-sync-timeline-events')
    && mockRegister.includes('agent-state-summary-sync-cockpit')
    && mockRegister.includes('continuous-work-loop-sync-cockpit')
    && mockRegister.includes('fixed-work-routines-sync-cockpit')
    && mockRegister.includes('collaboration-health-sync-diagnostics')
    && technicalSource.includes('Cockpit missing states expose the same direct recovery path')
    && technicalSource.includes('The local release checklist includes a static guard')
    && agentReadmeSource.includes('Recent Commit Line exposes `Sync Timeline`')
    && agentReadmeSource.includes('24/7 Operations Board, Assignment Timeline Matrix, Change Flow, Continuous Work Loop, and Fixed Work Routines missing states expose `Sync Cockpit`')
    && architectureAuditSource.includes('Cockpit, governance, timeline, and collaboration missing states now do the same')
    && mockRegister.includes('Sync Cockpit')
    && mockRegister.includes('agent-state-summary')
    && mockRegister.includes('Manager Dashboard submission-review summary now suppresses local review rows')
    && mockRegister.includes('agent-management-mesh/v1')
    && mockRegister.includes('agent-management-mesh-backend-required')
    && mockRegister.includes('assignment-timeline-matrix/v1')
    && mockRegister.includes('change-flow/v1'),
  'Manager coordination panels must prefer Manager Dashboard backend rows and expose backend-required source badges instead of silently rendering local derivations.',
);
assert(
  appSource.includes('const buildManagerProofMapRows = (checks = [], { allowLocalProofFallback = true } = {}) => checks.map')
    && appSource.includes("schemaVersion: 'manager-proof-map/frontend-fallback'")
    && appSource.includes('const backendManagerProofMap = backendReadinessProofMap?.readiness?.checks?.length')
    && appSource.includes("schemaVersion: 'manager-proof-map/v1'")
    && appSource.includes('const checkChatIds = Array.from(new Set([')
    && appSource.includes('const checkTimelineIds = Array.from(new Set([')
    && appSource.includes('const kickoffIds = allowLocalProofFallback ? kickoffCharterProofIds : checkChatIds;')
    && appSource.includes("const channelForChange = check.channelId || (allowLocalProofFallback")
    && appSource.includes('rows: buildManagerProofMapRows(managerReadiness.checks, { allowLocalProofFallback: true }),')
    && appSource.includes('rows: buildManagerProofMapRows(backendReadinessProofMap.readiness.checks, { allowLocalProofFallback: false }),')
    && appSource.includes("missingBackendReadModel('manager-proof-map/v1'")
    && appSource.includes('manager-proof-map-backend-required')
    && appSource.includes("managerReadModelSourceBadge(managerProofMap, 'manager-proof-map-source')")
    && appSource.includes("managerReadModelSourceBadge(managerProofMap, 'manager-scenario-readiness-source')")
    && appSource.includes('manager-scenario-readiness-backend-required')
    && appSource.includes('Local scenario readiness is suppressed for this backend project.')
    && appSource.includes('manager-scenario-readiness-sync-proof-map')
    && appSource.includes('manager-proof-map-sync-readiness-proof-map')
    && appSource.includes('onClick={() => syncBackendReadinessProofMap({ silent: false, projectId: activeProject.id })}')
    && appSource.includes('const managerReadinessDisplayChecks = managerProofMapDisplayRows.map(row => row.check).filter(Boolean);')
    && appSource.includes('managerProofMapDisplayRows.map(row =>')
    && mockRegister.includes('Manager Proof Map now consumes backend `/readiness-proof-map` readiness checks')
    && mockRegister.includes('Manager Scenario Readiness panel now reads the same `manager-proof-map/v1` model')
    && mockRegister.includes('Manager Proof Map row enrichment now separates backend checks from frontend fallback checks')
    && mockRegister.includes('manager-proof-map/v1'),
  'Manager Proof Map must prefer backend readiness checks from /readiness-proof-map and show backend-required state for real projects.',
);
assert(
  appSource.includes("const activeFlowGraphProjectId = String(activeProject.id || '').toLowerCase();")
    && appSource.includes("const backendFlowGraphFromStation = String(backendStation.managerFlowGraph?.projectId || '').toLowerCase() === activeFlowGraphProjectId")
    && appSource.includes("const backendReadyPackageForFlowGraph = String(backendStation.managerReadyPackage?.projectId || '').toLowerCase() === activeFlowGraphProjectId")
    && appSource.includes('const backendFlowGraph = backendFlowGraphFromStation || backendReadyPackageForFlowGraph?.managerFlowGraph || null;')
    && appSource.includes("const backendDashboardForFlowGraph = String(backendStation.managerDashboard?.projectId || '').toLowerCase() === activeFlowGraphProjectId")
    && appSource.includes("const backendProofMapFromStationForFlowGraph = String(backendStation.readinessProofMap?.projectId || '').toLowerCase() === activeFlowGraphProjectId")
    && appSource.includes('const backendReadinessProofMapForFlowGraph = backendProofMapFromStationForFlowGraph')
    && appSource.includes('const backendTimelineProofMap = backendReadinessProofMapForFlowGraph || null;')
    && appSource.includes('const backendFlowGraphReady = Boolean(backendFlowGraph?.nodes?.length);')
    && appSource.includes('managerReadyPackage: Boolean(backendReadyPackageForFlowGraph),')
    && appSource.includes('managerDashboard: Boolean(backendDashboardForFlowGraph),')
    && !appSource.includes('const backendFlowGraph = backendStation.managerFlowGraph || backendStation.managerReadyPackage?.managerFlowGraph || null;')
    && !appSource.includes('const backendTimelineProofMap = backendStation.managerDashboard?.readinessProofMap')
    && !appSource.includes('const graphProjectMatches = !backendFlowGraph?.projectId || backendFlowGraph.projectId === activeProject.id;')
    && mockRegister.includes('Manager Flow Graph scene now scopes graph and Proof Map sources to the active project'),
  'Manager Flow Graph must not let stale cross-project graph/proof-map data masquerade as the active project proof surface.',
);
assert(
  appSource.includes("const dashboardBackendReadyPackage = String(backendStation.managerReadyPackage?.projectId || '').toLowerCase() === String(activeProject.id || '').toLowerCase()")
    && appSource.includes('const backendManagerReadyPackage = dashboardBackendReadyPackage || null;')
    && !appSource.includes('const backendManagerReadyPackage = backendStation.managerReadyPackage || null;')
    && mockRegister.includes('Manager Ready Package aggregate data is now scoped to the active project'),
  'Manager Ready Package aggregate data must be project-scoped before any Ready Package panel or derived submodel consumes it.',
);
assert(
  appSource.includes('const backendProductTeamOperatingLoop = scopedBackendStationReadModel(backendStation.productTeamOperatingLoop)')
    && appSource.includes('if (readModelProjectId) {')
    && appSource.includes('return readModelProjectId === activeProjectIdKey ? readModel : null;')
    && appSource.includes('return isBackendManagedRealProject(activeProject) ? null : readModel;')
    && appSource.includes('const backendTeamCollaborationDiagnostics = scopedBackendStationReadModel(backendStation.teamCollaborationDiagnostics)')
    && appSource.includes('const backendRuntimeContracts = scopedBackendStationReadModel(backendStation.runtimeContracts)')
    && appSource.includes('const backendAutonomousCycleConsistency = scopedBackendStationReadModel(backendStation.autonomousCycleConsistency)')
    && appSource.includes('const backendRuntimeAutonomyStatus = scopedBackendStationReadModel(backendStation.runtimeAutonomyStatus)')
    && appSource.includes('const backendAssignmentTimelineMatrix = scopedBackendStationReadModel(backendStation.assignmentTimelineMatrix)')
    && appSource.includes('const backendChangeFlow = scopedBackendStationReadModel(backendStation.changeFlow)')
    && appSource.includes('const backendSyncProtocolAudit = scopedBackendStationReadModel(backendStation.syncProtocolAudit)')
    && !appSource.includes('const backendProductTeamOperatingLoop = backendStation.productTeamOperatingLoop')
    && !appSource.includes('const backendRuntimeContracts = backendStation.runtimeContracts')
    && !appSource.includes('const backendManagerCommandCenter = backendStation.managerCommandCenter')
    && mockRegister.includes('Standalone backendStation read models used by Manager Dashboard and Ready Package panels are now project-scoped')
    && mockRegister.includes('Backend-managed real projects also suppress station read models that have no `projectId`')
    && technicalSource.includes('a project-scoped station read model without a `projectId` is suppressed'),
  'Standalone backendStation read models must be project-scoped before Manager Dashboard or Ready Package panels consume them.',
);
assert(
  appSource.includes('const scopedBackendStationProof = (proof = null) =>')
    && appSource.includes('const backendProductTeamMissionRuns = scopedBackendStationReadModel(backendStation.productTeamMissionRuns)')
    && appSource.includes('const backendLatestProductTeamMissionRun = scopedBackendStationProof(backendStation.productTeamMissionRun)')
    && appSource.includes('const backendManagerActionRunOutput = scopedBackendStationProof(backendStation.managerActionRunOutput)')
    && appSource.includes('const backendManagerCommandCenterRunReceipt = scopedBackendStationProof(backendStation.managerCommandCenterRun)')
    && appSource.includes('const backendCollaborationIntentRunOutput = scopedBackendStationProof(backendStation.collaborationIntentRunOutput)')
    && appSource.includes('const backendAutonomousRunControlSessionReceipt = scopedBackendStationProof(backendStation.autonomousRunControlSession)')
    && appSource.includes('const backendTimelineActionReceipt = scopedBackendStationProof(backendStation.timelineActionReceipt)')
    && !appSource.includes('{backendStation.managerActionRunOutput && (')
    && !appSource.includes('{backendStation.managerCommandCenterRun && (')
    && !appSource.includes('{backendStation.timelineActionReceipt?.id && (')
    && mockRegister.includes('Latest backendStation operation receipts are now project-scoped before display or follow-up session actions'),
  'Latest backendStation operation receipts must be project-scoped before real-project proof panels display them or reuse session actions.',
);
assert(
  appSource.includes('const showSampleFixturePath = isManagerDemoProject(activeProject) || canUseDevelopmentSnapshotSeed(activeProject);')
    && appSource.includes('{showSampleFixturePath && (')
    && mockRegister.includes('Sample Fixture Path is hidden for real backend projects'),
  'Real backend projects must not show the Manager Demo Sample Fixture Path inside the project dashboard.',
);
assert(
  agentProjectServiceSource.includes('timeline-action-receipt/v1')
    && agentProjectServiceSource.includes('recordTimelineAction')
    && agentProjectApiSource.includes("route.action === 'timeline' && route.tail[0] === 'actions'")
    && accessControlSource.includes('write timeline action receipt')
    && accessControlSource.includes('timeline-action-write')
    && timelineActionContractSource.includes('/timeline/actions')
    && timelineActionContractSource.includes('timeline-action-receipt/v1')
    && timelineActionContractSource.includes('sk-timelineactionsecret123')
    && appSource.includes('timeline-actions-backend-contract')
    && appSource.includes('timeline-action-note-input')
    && appSource.includes('timeline-action-save-note')
    && appSource.includes('timeline-action-acknowledge')
    && appSource.includes('timeline-action-complete')
    && appSource.includes('timeline-action-edit')
    && appSource.includes('recordTimelineAction')
    && timelineActionContractSource.includes("action: 'complete'")
    && timelineActionContractSource.includes("action: 'edit'")
    && !appSource.includes("timelineText('Add comment...')")
    && !appSource.includes("timelineText('Jump To Chat')")
    && mockRegister.includes('Timeline detail now posts Manager notes, acknowledgements, completion marks, and edit notes to `POST /projects/:id/timeline/actions`'),
  'Timeline detail actions must write backend timeline-action receipts instead of exposing no-op local controls.',
);
assert(
  appSource.includes('const canSeedActiveProjectSnapshotToBackend = (project = activeProject)')
    && appSource.includes('isManagerDemoProject(project)')
    && appSource.includes('const canUseDevelopmentSnapshotSeed = (project = activeProject)')
    && appSource.includes('isDevelopmentLocalRuntimeFallbackEnabled()')
    && appSource.includes('isDevelopmentFallbackProject(project)')
    && appSource.includes('!isBackendKickoffProject(project)')
    && appSource.includes('!hasBackendManagedProjectMarker(project)')
    && appSource.includes('!projectHasBackendSyncEvidence(project)')
    && appSource.includes('canUseDevelopmentSnapshotSeed(project)')
    && appSource.includes('if (!canSeedActiveProjectSnapshotToBackend(activeProject))')
    && appSource.includes('Browser snapshot seeding is disabled for real backend projects.')
    && appSource.includes('Seed Sample/Dev')
    && appSource.includes('Sample/dev snapshot seed only; real projects save through backend receipt routes.')
    && !appSource.includes('Save Project')
    && appSource.includes('disabled={backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)}')
    && appSource.includes('Backend project missing; local seed suppressed')
    && appSource.includes('Backend project not found after prior sync; local snapshot reseeding is suppressed.')
    && appSource.includes('Backend project not found; local snapshot seeding is disabled for real projects.')
    && mockRegister.includes('The development runtime fallback switch no longer enables this seed path for arbitrary projects'),
  'Real backend projects must fail closed instead of saving or reseeding browser snapshots over backend receipt ledgers.',
);
assert(
  appSource.includes('const backendFailureConnectionStatusFor = (project = activeProject, previousStatus = backendStation.connectionStatus) => (')
    && appSource.includes("isBackendManagedRealProject(project) ? previousStatus : 'offline'")
    && (appSource.match(/connectionStatus: backendFailureConnectionStatusFor\(activeProject, prev\.connectionStatus\)/g) || []).length >= 18
    && appSource.includes('connectionStatus: backendFailureConnectionStatusFor(dashboardProject, prev.connectionStatus)')
    && appSource.includes('connectionStatus: silent ? prev.connectionStatus : backendFailureConnectionStatusFor({ id: projectId }, prev.connectionStatus)')
    && mockRegister.includes('Scheduler start, scheduler tick, and Server/Hour/Day pulse failures now preserve backend-required station status')
    && mockRegister.includes('Manager Command Center, Action Playbook, Autonomous Run Control, Autopilot, Agent Autonomous Queue, Collaboration Intent, readiness receipts, private-pilot receipts, managed cutover, and Scenario Walkthrough failures now use the same station-status boundary')
    && technicalSource.includes('Manager Command Center, Manager Action Queue, Autonomous Run Control, Autopilot session controls, Agent Autonomous Queue, Collaboration Intent Queue, MVP readiness receipts, private-pilot receipts, managed cutover attestations, and Scenario Walkthrough steps use the same failure-status boundary')
    && architectureAuditSource.includes('Backend-managed real projects now preserve their station-status boundary across C/A command and receipt failures'),
  'Backend-managed scheduler, pulse, C/A control, Agent queue, and receipt failures must not downgrade real projects into an offline/local-fallback station state.',
);
assert(
  appSource.includes('const isBackendManagedBrowserCacheProject = (project = {})')
    && appSource.includes('const hasBackendManagedProjectMarker = (project = {})')
    && appSource.includes("project.backendSyncStatus === 'online'")
    && appSource.includes("project.dataSource === 'backend-backed'")
    && appSource.includes('project.managerDashboard,')
    && appSource.includes('project.productTeamDeliveryTrace,')
    && appSource.includes('project.productTeamOperatingLoop,')
    && appSource.includes('project.plannerExecutorReviewerStateMachine,')
    && appSource.includes('project.runtimeAutonomyStatus,')
    && appSource.includes('project.autonomousRunControl,')
    && appSource.includes('project.collaborationIntentQueue,')
    && appSource.includes('project.zeroToAutonomyReport,')
    && appSource.includes('project.projectEvidenceArchive,')
    && appSource.includes('project.settingsProviderReadiness,')
    && appSource.includes('project.settingsRuntimeReadiness,')
    && appSource.includes('project.settingsIntegrationReadiness,')
    && appSource.includes("].some(readModel => String(readModel?.projectId || '').toLowerCase() === String(project.id).toLowerCase())")
    && appSource.includes('&& !hasBackendManagedProjectMarker(project)')
    && appSource.includes('const projectMarkedBackendManaged = hasBackendManagedProjectMarker(project);')
    && appSource.includes("backendStation.connectionStatus === 'online' || projectSyncedFromBackend || projectMarkedBackendManaged")
    && appSource.includes('const cachedBackendManagedProjectIds = () => new Set')
    && appSource.includes('const cachedBrowserProjectIds = () => new Set')
    && appSource.includes('const loadInitialProjects = () =>')
    && appSource.includes('.filter(project => !isBackendManagedBrowserCacheProject(project))')
    && appSource.includes('const loadInitialChatMessages = () =>')
    && appSource.includes('const backendManagedCachedIds = cachedBackendManagedProjectIds();')
    && appSource.includes('const browserProjectIds = cachedBrowserProjectIds();')
    && appSource.includes('.filter(message => !backendManagedCachedIds.has(message.projectId || DEFAULT_CHAT_PROJECT_ID))')
    && appSource.includes('const isBackendManagedRealProject = (project = {})')
    && appSource.includes('projectHasBackendSyncEvidence(project)')
    && appSource.includes('const projectMatchedLastProjectSync = Boolean(projectId && backendStation.lastProjectSyncProjectId)')
    && appSource.includes("String(backendStation.lastProjectSyncProjectId || '').toLowerCase() === projectId")
    && appSource.includes('const projectMatchedReadModel = Boolean(projectId) && [')
    && appSource.includes('backendStation.readyPackageSubmodelsProjectId')
    && appSource.includes('projectMatchedLastProjectSync')
    && appSource.includes('projectMatchedReadModel')
    && appSource.includes('lastProjectSyncProjectId: backendProject.id || snapshotProjectId')
    && !appSource.includes('(backendStation.lastProjectSyncAt && activeProject?.id === project?.id)')
    && !appSource.includes('(backendStation.lastManagerDashboardSyncAt && activeProject?.id === project?.id)')
    && appSource.includes("backendSyncStatus: payload.project.backendSyncStatus || 'online'")
    && appSource.includes("dataSource: payload.project.dataSource || 'backend-backed'")
    && appSource.includes('const canPersistProjectToBrowserCache = (project = {})')
    && appSource.includes('!isBackendManagedRealProject(project)')
    && appSource.includes('isDevelopmentLocalRuntimeFallbackEnabled()\n      && !isBackendKickoffProject(project)\n      && !projectHasBackendSyncEvidence(project)\n      && !hasBackendManagedProjectMarker(project)')
    && !appSource.includes('&& !isDevelopmentLocalRuntimeFallbackEnabled()\n  && (isBackendKickoffProject(project) || hasBackendManagedProjectMarker(project))')
    && !appSource.includes('&& !isDevelopmentLocalRuntimeFallbackEnabled()\n    && (isBackendKickoffProject(project) || hasBackendManagedProjectMarker(project) || projectHasBackendSyncEvidence(project))')
    && !appSource.includes('&& !isDevelopmentLocalRuntimeFallbackEnabled()\n      && (backendStation.connectionStatus === \'online\' || projectSyncedFromBackend || projectMarkedBackendManaged)')
    && appSource.includes('const isUnscopedProofLikeChatMessage = (message = {})')
    && appSource.includes('CHAT_PROOF_ID_PATTERN.test(messageId)')
    && appSource.includes('const canPersistChatMessageToBrowserCache = (message = {}, projectById = new Map())')
    && appSource.includes('if (projectId === DEFAULT_CHAT_PROJECT_ID) return !isUnscopedProofLikeChatMessage(message);')
    && appSource.includes('return canPersistProjectToBrowserCache(project) && !isManagerDemoMessage(message);')
    && appSource.includes('const browserCacheProjects = projects.filter(canPersistProjectToBrowserCache);')
    && appSource.includes('const browserCacheMessages = chatMessages')
    && appSource.includes('.filter(message => canPersistChatMessageToBrowserCache(message, projectById))')
    && mockRegister.includes('The global development runtime fallback switch no longer lets cached backend-managed projects rehydrate')
    && mockRegister.includes('Backend sync evidence is now project-id scoped')
    && mockRegister.includes('Backend project snapshots update `lastProjectSyncProjectId`')
    && technicalSource.includes('The development flag no longer changes backend-managed project classification')
    && technicalSource.includes('Backend sync evidence is scoped by project id')
    && technicalSource.includes('`applyBackendProjectSnapshot` now records `lastProjectSyncProjectId`')
    && agentReadmeSource.includes('even when the global development fallback switch is enabled'),
  'Browser project/chat cache must exclude backend-managed real projects on both load and write paths.',
);
assert(
  appSource.includes('const portfolioSourceMeta = (project = {}, fixtureMeta = sampleFixtureMeta(project)) =>')
    && appSource.includes('const localWorkspaceOpenTaskCount = projects.reduce((count, project) => count + ((project.tasks || []).filter(task => task.status !== \'done\').length), 0);')
    && appSource.includes('const localWorkspaceStoredMessageCount = chatMessages.length;')
    && appSource.includes('const backendCatalogProjects = Array.isArray(backendStation.projectCatalog) ? backendStation.projectCatalog : [];')
    && appSource.includes('const workspaceActiveProjectCount = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceBackendProjectCount = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const backendCatalogTaskCountForProject = (project = {}) => {')
    && appSource.includes('const backendCatalogMessageCountForProject = (project = {}) => {')
    && appSource.includes('const workspaceOpenTaskCount = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceStoredMessageCount = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceOpenTaskSourceMeta = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceStoredMessageSourceMeta = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceActiveProjectSourceMeta = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceBackendProjectSourceMeta = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspaceBackendCatalogSummary = backendStation.connectionStatus === \'online\'')
    && appSource.includes('const workspacePortfolioCatalogRequired = backendStation.connectionStatus === \'online\' && !backendStation.lastProjectCatalogSyncAt;')
    && appSource.includes('backendStation.lastProjectCatalogSyncAt && backendCatalogTaskCounts.every(count => count !== null)')
    && appSource.includes('backendStation.lastProjectCatalogSyncAt && backendCatalogMessageCounts.every(count => count !== null)')
    && appSource.includes('data-testid={`workspace-stat-source-${statId}`}')
    && appSource.includes('data-testid={`workspace-stat-source-detail-${statId}`}')
    && appSource.includes("          { icon: Cpu, label: 'Active Projects', val: workspaceActiveProjectCount },")
    && appSource.includes("          { icon: Server, label: 'Backend Projects', val: workspaceBackendProjectCount },")
    && appSource.includes("          { icon: ClipboardList, label: 'Open Tasks', val: workspaceOpenTaskCount },")
    && appSource.includes("          { icon: MessageSquare, label: 'Stored Messages', val: workspaceStoredMessageCount }")
    && appSource.includes('data-testid="workspace-portfolio-catalog-required"')
    && appSource.includes('data-testid="workspace-portfolio-sync-catalog-required"')
    && appSource.includes('!workspacePortfolioCatalogRequired && projects.length === 0')
    && appSource.includes("label: 'backend-backed'")
    && appSource.includes('isBackendKickoffProject(project) || hasBackendManagedProjectMarker(project) || projectHasBackendSyncEvidence(project)')
    && appSource.includes("fixtureMeta.status || 'sample-fixture'")
    && appSource.includes("fixtureMeta.status === 'development-fallback'")
    && appSource.includes('const isDevelopmentFallbackProject = (project = {}) => (')
    && appSource.includes("project.sampleFixture?.id === 'development-fallback'")
    && appSource.includes("dataSource: 'development-fallback'")
    && appSource.includes("&& !isDevelopmentFallbackProject(project)")
    && appSource.includes("label: 'frontend-fallback'")
    && appSource.includes('Loaded from backend project catalog or backend receipt sync')
    && appSource.includes('Local browser cache only; sync backend before treating this as a real project')
    && appSource.includes('data-testid={`project-source-${proj.id}`}')
    && appSource.includes('data-testid={`project-source-detail-${proj.id}`}')
    && appSource.includes('data-testid={`project-progress-source-${proj.id}`}')
    && appSource.includes('data-testid={`project-progress-source-detail-${proj.id}`}')
    && mockRegister.includes('Active Portfolios now renders a visible source badge for every project row')
    && mockRegister.includes('project-progress-source')
    && mockRegister.includes('workspace-portfolio-catalog-required')
    && mockRegister.includes('Workspace Hub Active Projects and Backend Projects now follow the same catalog boundary')
    && mockRegister.includes('workspace-stat-source-active-projects')
    && mockRegister.includes('workspace-stat-source-backend-projects')
    && mockRegister.includes('Workspace Hub Open Tasks now follows the project catalog boundary')
    && mockRegister.includes('workspace-stat-source-open-tasks')
    && mockRegister.includes('Workspace Hub Stored Messages follows the same catalog/transcript boundary')
    && mockRegister.includes('workspace-stat-source-stored-messages')
    && technicalSource.includes('Workspace Hub aggregate task and message counts follow the backend catalog boundary')
    && technicalSource.includes('workspace-portfolio-catalog-required')
    && technicalSource.includes('project-progress-source')
    && technicalSource.includes('The Open Tasks and Stored Messages stat cards render visible source labels')
    && technicalSource.includes('workspace-stat-source-active-projects')
    && technicalSource.includes('workspace-stat-source-backend-projects')
    && agentReadmeSource.includes('workspace-stat-source-active-projects')
    && agentReadmeSource.includes('workspace-portfolio-catalog-required')
    && agentReadmeSource.includes('project-progress-source')
    && agentReadmeSource.includes('workspace-stat-source-backend-projects')
    && agentReadmeSource.includes('workspace-stat-source-open-tasks')
    && agentReadmeSource.includes('workspace-stat-source-stored-messages')
    && architectureAuditSource.includes('Workspace Hub aggregate Active Projects, Backend Projects, Open Tasks, and Stored Messages now follow the backend catalog boundary')
    && architectureAuditSource.includes('workspace-portfolio-catalog-required')
    && architectureAuditSource.includes('project-progress-source')
    && architectureAuditSource.includes('workspace-stat-source-active-projects')
    && architectureAuditSource.includes('workspace-stat-source-backend-projects')
    && architectureAuditSource.includes('workspace-stat-source-open-tasks')
    && architectureAuditSource.includes('workspace-stat-source-stored-messages'),
  'Active Portfolios must label project row provenance and keep Workspace Active Projects / Backend Projects / Open Tasks / Stored Messages on the backend catalog boundary.',
);
assert(
  appSource.includes('const shouldAttemptAgentDashboardSync = Boolean(projectId && agentId) && (')
    && appSource.includes('shouldAttemptBackendProjectWrite(dashboardProject || { id: projectId })')
    && appSource.includes('projectHasBackendSyncEvidence(dashboardProject || { id: projectId })')
    && appSource.includes('const openManagerFlowGraphScene = async () => {')
    && appSource.includes('await syncBackendManagerFlowGraph({ silent: true, projectId });')
    && appSource.includes('onClick={openManagerFlowGraphScene}')
    && appSource.includes('timeoutMs: silent ? 8000 : 12000')
    && appSource.includes('manager-flow-backend-required-sync')
    && appSource.includes('onClick={() => syncBackendManagerFlowGraph({ silent: false })}')
    && appSource.includes("['managerFlowGraph', readRoutes.managerFlowGraphRoute, null, 10000]")
    && appSource.includes('const dashboard = await syncBackendManagerDashboard({ silent: Boolean(readyPackage) });')
    && appSource.includes('await syncBackendManagerFlowGraph({ silent: Boolean(readyPackage || dashboard) });')
    && appSource.includes('if (!shouldAttemptBackendProjectWrite(activeProject)) return;')
    && appSource.includes('if (!selectedAgentFocusId || !shouldAttemptBackendProjectWrite(activeProject)) return;')
    && appSource.includes('await Promise.allSettled(uniqueAgentIds.map(agentId => (')
    && appSource.includes('syncBackendAgentDashboard(agentId, { silent: true, projectId: targetProjectId })')
    && appSource.includes('const agentSignalUsesBackendDashboard = Boolean(agentBackendDashboard);')
    && appSource.includes('const localAgentSignalProofAllowed = !backendAgentDashboardRequired;')
    && appSource.includes('const signalState = agentSignalUsesBackendDashboard ? agentBackendDashboard.state || {} : state || {};')
    && appSource.includes('const agentTeamDisplayState = agentSignalUsesBackendDashboard')
    && appSource.includes('const displayLatestAgentWorker = agentSignalUsesBackendDashboard')
    && appSource.includes('const agentStatusDotClass = backendAgentDashboardMissing')
    && appSource.includes('agent-team-dashboard-required')
    && appSource.includes('Backend Agent Dashboard required before showing confirmed Agent state.')
    && appSource.includes('const latestInbox = agentSignalUsesBackendDashboard')
    && appSource.includes('const latestObligation = agentSignalUsesBackendDashboard')
    && appSource.includes('const latestWorklog = agentSignalUsesBackendDashboard')
    && appSource.includes(': localAgentSignalProofAllowed ? state?.inbox?.[0] || null : null;')
    && appSource.includes(": localAgentSignalProofAllowed ? state?.obligations?.find(item => item.status !== 'done' && item.status !== 'resolved') || state?.obligations?.[0] || null : null;")
    && appSource.includes(': localAgentSignalProofAllowed ? state?.worklog?.[0] || null : null;')
    && appSource.includes('const proofSignalAllowed = agentSignalUsesBackendDashboard || localAgentSignalProofAllowed;')
    && appSource.includes('const agentDashboardTaskFor = (taskId) => {')
    && appSource.includes('const dashboardTask = agentOwnedTasks.find(task => String(task.id) === String(taskId));')
    && appSource.includes('const obligationTask = agentDashboardTaskFor(latestObligation?.taskId);')
    && appSource.includes('const worklogTask = agentDashboardTaskFor(worklogTaskId);')
    && appSource.includes('const inboxProofIds = proofSignalAllowed ? [latestInbox?.sourceMessageId || latestInbox?.messageId].filter(Boolean) : [];')
    && appSource.includes('const obligationProofIds = proofSignalAllowed ? [')
    && appSource.includes('const worklogProofIds = proofSignalAllowed ? [')
    && appSource.includes('const proofLatestAgentWorker = agentSignalUsesBackendDashboard ? agentBackendDashboard.latestWorker || null : latestAgentWorker;')
    && appSource.includes('const backendTaskEvidenceFromRow = (task = {}, row = {}) => {')
    && appSource.includes('if (task.evidence?.taskEvidencePath) {')
    && appSource.includes('const localAgentOwnedTasks = activeProject.tasks.filter(task => (')
    && appSource.includes('const agentOwnedTasks = agentSignalUsesBackendDashboard && Array.isArray(agentBackendDashboard.ownedTasks)')
    && appSource.includes('const localFocusState = localAgentSignalProofAllowed ? state || {} : {};')
    && appSource.includes('const focusManagerIds = Array.from(new Set([localFocusState?.managerId')
    && appSource.includes('const backendFocusManagerNames = agentBackendDashboard?.management?.managerNames || [];')
    && appSource.includes('const focusManagementUsesBackend = Boolean(agentBackendDashboard);')
    && appSource.includes('const focusManagerNames = focusManagementUsesBackend')
    && appSource.includes('const focusManagedNames = focusManagementUsesBackend')
    && appSource.includes('const focusPeerManagedCount = focusManagementUsesBackend')
    && appSource.includes('const focusPeerManagerCount = focusManagementUsesBackend')
    && appSource.includes(': (localFocusState?.peerManagedIds || []).length;')
    && appSource.includes(': (localFocusState?.peerManagerIds || []).length;')
    && appSource.includes('{focusPeerManagedCount} targets / {focusPeerManagerCount} managers')
    && appSource.includes('const localOwnedTaskFallbackRows = localAgentSignalProofAllowed')
    && appSource.includes('const agentOwnedTaskEvidenceRows = agentOwnedTasks.length ? agentOwnedTasks : localOwnedTaskFallbackRows;')
    && appSource.includes('agent-focus-owned-tasks-empty')
    && appSource.includes('const buildLocalPeerManagementMatrixRows = () => (activeProject.peerManagementMatrix?.length')
    && appSource.includes('const localPeerManagementMatrixRows = allowManagerFrontendFallbacks ? buildLocalPeerManagementMatrixRows() : [];')
    && appSource.includes('const backendPeerManagementMatrixRows = Array.isArray(backendManagerDashboard?.peerManagementMatrix)')
    && appSource.includes('const peerManagementMatrixRows = backendPeerManagementMatrixRows')
    && appSource.includes('|| (agentManagementMesh.frontendMockSuppressed || timelineEventReadModelsRequired ? [] : localPeerManagementMatrixRows);')
    && appSource.includes('agent-management-mesh-backend-required')
    && appSource.includes('agent-management-mesh-sync-cockpit')
    && agentProjectServiceSource.includes('const peerManagerIds = uniqueStrings(normalizedState.peerManagerIds || []);')
    && agentProjectServiceSource.includes('peerManagerNames: peerManagerIds.map((id) => agentNameById[id] || id).filter(Boolean),')
    && agentProjectServiceSource.includes('peerManagerCount: peerManagerIds.length')
    && agentProjectServiceSource.includes('peerManagedCount: peerManagedIds.length')
    && appSource.includes('const localAgentManagementProofIdsAllowed = !backendAgentDashboardRequired;')
    && appSource.includes(': localAgentManagementProofIdsAllowed ? (activeProject.logs || [])')
    && appSource.includes(': [];')
    && !appSource.includes("if (!projectId || !agentId || backendStation.connectionStatus !== 'online') return null;")
    && !appSource.includes("if (!selectedAgentFocusId || backendStation.connectionStatus !== 'online') return;")
    && !appSource.includes("agentStates[agent.id]?.status === 'blocked'")
    && !appSource.includes('agentOwnedTasks.length ? agentOwnedTasks : [{')
    && !appSource.includes('uniqueAgentIds.forEach(agentId => {\n      if (agentId) setTimeout(() => syncBackendAgentDashboard(agentId, { silent: true, projectId: targetProjectId }), 0);')
    && mockRegister.includes('Agent Dashboard sync and page-entry Flow Graph/Agent Focus refreshes now attempt the backend when a project has backend sync evidence or should use backend write routes')
    && mockRegister.includes('The collapsed Team row follows the same boundary')
    && mockRegister.includes('Agent Focus management proof counts now use backend Agent Dashboard proof rows')
    && mockRegister.includes('Peer Management Matrix now uses backend Manager Dashboard `peerManagementMatrix` rows')
    && mockRegister.includes('Agent Focus inbox, obligation, worklog, and owned-task proof buttons now follow the same Agent Dashboard boundary')
    && mockRegister.includes('Agent Focus latest inbox, obligation, and worklog cues now also clear to null')
    && mockRegister.includes('Mission approval and autonomy refresh now wait for the requested Agent Dashboard reads with `Promise.allSettled`')
    && technicalSource.includes('The collapsed Team row follows the same rule')
    && technicalSource.includes('Latest inbox, obligation, and worklog cues follow the same boundary')
    && agentReadmeSource.includes('The collapsed Team row follows the same boundary')
    && architectureAuditSource.includes('The collapsed Team row now renders `agent-team-dashboard-required-*`')
    && technicalSource.includes('Peer Management Matrix uses the backend Manager Dashboard boundary')
    && agentReadmeSource.includes('React consumes the Peer Management Matrix through backend Manager Dashboard rows')
    && architectureAuditSource.includes('React consumes Peer Management Matrix rows from the backend Manager Dashboard'),
  'Agent Dashboard sync and Agent Focus management proof must not depend on stale UI online status or browser-local logs for real backend projects.',
);
assert(
  managerBackendCoreUiSource.includes('Manager Demo compatibility seed may write the sample snapshot at most once.')
    && managerBackendCoreUiSource.includes('Autonomous Run Control must not reseed the browser snapshot after backend proof is written.')
    && managerBackendCoreUiSource.includes('Agent Autonomous Queue must not reseed the browser snapshot after backend proof is written.')
    && managerBackendCoreUiSource.includes('Autopilot scheduler controls must not reseed the browser snapshot after backend proof is written.'),
  'Fast Manager backend core UI validation must prove sample compatibility seeding does not overwrite later backend proof.',
);
assert(
  managerBackendUiSource.includes('Approved real backend projects must keep browser snapshot Seed Sample/Dev disabled')
    && managerBackendUiSource.includes("page.getByTestId('backend-save-project').isDisabled()"),
  'Full Manager backend UI validation must prove approved real projects cannot seed browser snapshots.',
);
assert(
  managerBackendUiSource.includes('playwrightChromiumExecutableCandidates')
    && managerBackendUiSource.includes('HOFS_PLAYWRIGHT_CHROMIUM')
    && managerBackendUiSource.includes("chromium.launch({ channel: 'msedge', headless: true })"),
  'Full Manager backend UI validation must reuse an available Playwright/Edge browser instead of requiring a single bundled Chromium revision.',
);
assert(
  managerBackendUiSource.includes('cleanupManagerBackendUiTmp')
    && managerBackendUiSource.includes('HOFS_MANAGER_BACKEND_UI_PRESERVE_TMP')
    && managerBackendUiSource.includes('HOFS_MANAGER_BACKEND_UI_SCREENSHOT')
    && managerBackendUiSource.includes('CAPTURE_SUCCESS_SCREENSHOT'),
  'Full Manager backend UI validation must clean its temp backend store by default and avoid success screenshots unless explicitly requested.',
);
assert(
  appSource.includes('managerAutoReadyProofSyncRef')
    && appSource.includes("projectMode !== 'dashboard'")
    && appSource.includes('syncBackendManagerReadyPackage({ silent: true, projectId: activeProject.id })')
    && appSource.includes('const syncBackendReadinessProofMap = async')
    && appSource.includes('/readiness-proof-map')
    && appSource.includes('syncBackendReadinessProofMap({ silent: true, projectId: activeProject.id })')
    && appSource.includes('setTimeout(() => syncBackendReadyPackageSubmodels({ silent: true, projectId, includeLaunchControls: true }), 0);')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard now automatically syncs `/manager-ready-package`')
    && mockRegister.includes('also reads `/readiness-proof-map` directly')
    && mockRegister.includes('without first clicking `Sync Package` or `Sync Proof Models`'),
  'Manager Dashboard must automatically sync Manager Ready Package and proof submodels for backend-backed projects.',
);
assert(
  appSource.includes('const missingEvidenceIndexReadiness = () => missingReadyPackageReadModel')
    && appSource.includes("schemaVersion: `${schemaName}/missing-backend`")
    && appSource.includes('backend-evidence-index-readiness-required')
    && appSource.includes('Backend-online real projects require evidence and artifact index proof from the backend.')
    && appSource.includes('backendReadyPackageSubmodels.evidenceIndexReadiness || backendManagerReadyPackage?.evidenceIndexReadiness || (')
    && mockRegister.includes('Manager Ready Package now also fail-closes the Evidence Index Readiness snapshot')
    && mockRegister.includes('evidence-index-readiness/missing-backend'),
  'Manager Ready Package must show backend-required Evidence Index Readiness when the backend model is missing, not hide the panel.',
);
const acceptanceChainProofModelSyncButtons = [
  'backend-project-evidence-archive-sync-proof-models',
  'backend-brainstorm-layer-sync-proof-models',
  'backend-artifact-quality-audit-sync-proof-models',
  'backend-submission-review-workflow-sync-proof-models',
  'backend-evidence-quality-audit-sync-proof-models',
  'backend-evidence-index-readiness-sync-proof-models',
  'backend-evidence-source-review-workflow-sync-proof-models',
  'backend-evidence-custody-readiness-sync-proof-models',
];
assert(
  appSource.includes('const missingProjectEvidenceArchive = () => missingReadyPackageReadModel')
    && appSource.includes('backend-project-evidence-archive-required')
    && appSource.includes('Backend-online real projects require final delivery archive, artifact storage proof, workspace-file proof, transcript proof, and source-review proof from the backend.')
    && appSource.includes('backendProjectEvidenceArchiveReadModel || (')
    && appSource.includes('backendOnlineForReadyPackage && backendManagerReadyPackage ? missingProjectEvidenceArchive() : null')
    && appSource.includes("managerProofModelSyncButton(backendProjectEvidenceArchive, 'backend-project-evidence-archive-sync-proof-models')")
    && appSource.includes('data-testid="backend-project-evidence-archive-source"')
    && mockRegister.includes('Project Evidence Archive now uses a backend-required missing model')
    && mockRegister.includes('backend-project-evidence-archive-sync-proof-models'),
  'Manager Ready Package Project Evidence Archive must fail closed and expose an in-panel proof-model sync action when the backend archive model is missing.',
);
assert(
  appSource.includes('const managerReadModelMeta = (readModel = {}) => readModel || {};')
    && appSource.includes('const managerProofModelSyncButton = (readModel = {}, testId) => managerReadModelMeta(readModel).frontendMockSuppressed')
    && appSource.includes('syncBackendReadyPackageSubmodels({ silent: false, projectId: activeProject.id, includeLaunchControls: true })')
    && acceptanceChainProofModelSyncButtons.every(testId => appSource.includes(testId))
    && mockRegister.includes('Research-sample acceptance-chain subpanels now expose in-panel `Sync Proof Models` actions')
    && technicalSource.includes('Acceptance-chain missing models expose the same in-panel `Sync Proof Models` action')
    && agentReadmeSource.includes('Those missing acceptance-chain panels expose in-panel `Sync Proof Models` actions')
    && architectureAuditSource.includes('Missing acceptance-chain panels expose in-panel proof-model sync actions'),
  'Acceptance-chain Ready Package panels must provide in-panel proof-model sync actions when backend-required models are missing.',
);
assert(
  appSource.includes('const backendTranscriptProofCoverageRouteReadModel =')
    && appSource.includes("schemaVersion: 'transcript-proof-coverage-route/missing-backend'")
    && appSource.includes('backend-transcript-proof-coverage-route-required')
    && appSource.includes('Readiness Proof Map must expose transcriptProofCoverageRoutes from the backend.')
    && appSource.includes('const backendTranscriptProofCoverageReady = Boolean(')
    && appSource.includes("managerReadModelSourceBadge(backendTranscriptProofCoverageSource, 'proof-map-transcript-proof-coverage-source')")
    && appSource.includes("managerProofMapRouteSyncButton(backendTranscriptProofCoverageRoute, 'proof-map-transcript-proof-coverage-sync-proof-map')")
    && mockRegister.includes('Proof Map transcript proof coverage cards now fail closed')
    && technicalSource.includes('Proof Map transcript proof coverage cards fail closed')
    && agentReadmeSource.includes('Proof Map transcript proof coverage cards fail closed')
    && architectureAuditSource.includes('Proof Map transcript proof coverage cards fail closed'),
  'Manager Proof Map transcript proof coverage cards must fail closed with source badges and Sync Proof Map actions when backend proof routes are missing.',
);
assert(
  appSource.includes('const backendTranscriptChannelRoutesReadModel =')
    && appSource.includes("schemaVersion: 'transcript-channel-route/missing-backend'")
    && appSource.includes('backend-transcript-channel-route-required')
    && appSource.includes('Readiness Proof Map must expose transcriptChannelRoutes from the backend.')
    && appSource.includes('const backendTranscriptChannelReady = Boolean(')
    && appSource.includes("managerReadModelSourceBadge(backendTranscriptChannelSource, 'proof-map-transcript-channel-routes-source')")
    && appSource.includes("managerProofMapRouteSyncButton(backendLatestTranscriptChannelRoute, 'proof-map-transcript-channel-routes-sync-proof-map')")
    && mockRegister.includes('Proof Map transcript channel route cards now fail closed')
    && technicalSource.includes('Proof Map transcript channel route cards fail closed')
    && agentReadmeSource.includes('Proof Map transcript channel route cards fail closed')
    && architectureAuditSource.includes('Proof Map transcript channel route cards fail closed'),
  'Manager Proof Map transcript channel route cards must fail closed with source badges and Sync Proof Map actions when backend proof routes are missing.',
);
const transcriptActionProofMapRouteCards = [
  {
    readModel: 'const backendTranscriptChannelPinRoutesReadModel =',
    routeSchema: "'transcript-channel-pin-route',",
    stageId: 'backend-transcript-channel-pin-route-required',
    detail: 'Readiness Proof Map must expose transcriptChannelPinRoutes from the backend.',
    ready: 'const backendTranscriptChannelPinReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptChannelPinSource, 'proof-map-transcript-channel-pin-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptChannelPinRoute, 'proof-map-transcript-channel-pin-routes-sync-proof-map')",
  },
  {
    readModel: 'const backendTranscriptPinRoutesReadModel =',
    routeSchema: "'transcript-pin-route',",
    stageId: 'backend-transcript-pin-route-required',
    detail: 'Readiness Proof Map must expose transcriptPinRoutes from the backend.',
    ready: 'const backendTranscriptPinReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptPinSource, 'proof-map-transcript-pin-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptPinRoute, 'proof-map-transcript-pin-routes-sync-proof-map')",
  },
  {
    readModel: 'const backendTranscriptReplyRoutesReadModel =',
    routeSchema: "'transcript-reply-route',",
    stageId: 'backend-transcript-reply-route-required',
    detail: 'Readiness Proof Map must expose transcriptReplyRoutes from the backend.',
    ready: 'const backendTranscriptReplyReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptReplySource, 'proof-map-transcript-reply-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptReplyRoute, 'proof-map-transcript-reply-routes-sync-proof-map')",
  },
  {
    readModel: 'const backendTranscriptMentionRoutesReadModel =',
    routeSchema: "'transcript-mention-route',",
    stageId: 'backend-transcript-mention-route-required',
    detail: 'Readiness Proof Map must expose transcriptMentionRoutes from the backend.',
    ready: 'const backendTranscriptMentionReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptMentionSource, 'proof-map-transcript-mention-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptMentionRoute, 'proof-map-transcript-mention-routes-sync-proof-map')",
  },
  {
    readModel: 'const backendTranscriptAttachmentRoutesReadModel =',
    routeSchema: "'transcript-attachment-route',",
    stageId: 'backend-transcript-attachment-route-required',
    detail: 'Readiness Proof Map must expose transcriptAttachmentRoutes from the backend.',
    ready: 'const backendTranscriptAttachmentReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptAttachmentSource, 'proof-map-transcript-attachment-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptAttachmentRoute, 'proof-map-transcript-attachment-routes-sync-proof-map')",
  },
  {
    readModel: 'const backendTranscriptMemberPresenceRoutesReadModel =',
    routeSchema: "'transcript-member-presence-route',",
    stageId: 'backend-transcript-member-presence-route-required',
    detail: 'Readiness Proof Map must expose transcriptMemberPresenceRoutes from the backend.',
    ready: 'const backendTranscriptMemberPresenceReady = routeAwareProofMapReady(',
    sourceBadge: "managerReadModelSourceBadge(backendTranscriptMemberPresenceSource, 'proof-map-transcript-member-presence-routes-source')",
    syncButton: "managerProofMapRouteSyncButton(backendLatestTranscriptMemberPresenceRoute, 'proof-map-transcript-member-presence-routes-sync-proof-map')",
  },
];
assert(
  appSource.includes('const missingTranscriptProofMapRoute =')
    && appSource.includes('const routeAwareProofMapRoutes =')
    && appSource.includes('const routeAwareProofMapReady =')
    && transcriptActionProofMapRouteCards.every(card => (
      appSource.includes(card.readModel)
      && appSource.includes(card.routeSchema)
      && appSource.includes(card.stageId)
      && appSource.includes(card.detail)
      && appSource.includes(card.ready)
      && appSource.includes(card.sourceBadge)
      && appSource.includes(card.syncButton)
    ))
    && mockRegister.includes('Proof Map transcript action route cards now fail closed')
    && technicalSource.includes('Proof Map transcript action route cards fail closed')
    && agentReadmeSource.includes('Proof Map transcript action route cards fail closed')
    && architectureAuditSource.includes('Proof Map transcript action route cards fail closed'),
  'Manager Proof Map transcript action route cards must fail closed with source badges and Sync Proof Map actions when backend proof routes are missing.',
);
assert(
  appSource.includes('const backendAgentMessageRoutesReadModel =')
    && appSource.includes("schemaVersion: 'agent-message-route/missing-backend'")
    && appSource.includes('backend-agent-message-route-required')
    && appSource.includes('Readiness Proof Map must expose agentMessageRoutes from the backend.')
    && appSource.includes('const backendAgentMessageProofRouteReady = Boolean(')
    && appSource.includes("managerReadModelSourceBadge(backendAgentMessageProofMapSource, 'proof-map-agent-message-routes-source')")
    && appSource.includes("managerProofMapRouteSyncButton(backendLatestAgentMessageRoute, 'proof-map-agent-message-routes-sync-proof-map')")
    && mockRegister.includes('Proof Map Agent-to-Agent message route cards now fail closed')
    && technicalSource.includes('Proof Map Agent-to-Agent message route cards fail closed')
    && agentReadmeSource.includes('Proof Map Agent-to-Agent message route cards fail closed')
    && architectureAuditSource.includes('Proof Map Agent-to-Agent message route cards fail closed'),
  'Manager Proof Map Agent-to-Agent message route cards must fail closed with source badges and Sync Proof Map actions when backend proof routes are missing.',
);
assert(
  appSource.includes('const backendAgentContractRoutesReadModel =')
    && appSource.includes("schemaVersion: 'agent-contract-route/missing-backend'")
    && appSource.includes('backend-agent-contract-route-required')
    && appSource.includes('Readiness Proof Map must expose agentContractRoutes from the backend.')
    && appSource.includes('const backendAgentContractProofRouteReady = routeAwareProofMapReady(')
    && appSource.includes("managerReadModelSourceBadge(backendAgentContractProofMapSource, 'proof-map-agent-contract-routes-source')")
    && appSource.includes("managerProofMapRouteSyncButton(backendLatestAgentContractRoute, 'proof-map-agent-contract-routes-sync-proof-map')")
    && appSource.includes('proof-map-agent-contract-dashboard-open')
    && appSource.includes('proof-map-agent-contract-timeline-open')
    && mockRegister.includes('Proof Map marketplace Agent contract route cards now fail closed')
    && technicalSource.includes('Proof Map marketplace Agent contract route cards fail closed')
    && agentReadmeSource.includes('Proof Map marketplace Agent contract route cards fail closed')
    && architectureAuditSource.includes('Proof Map marketplace Agent contract route cards fail closed'),
  'Manager Proof Map Agent contract route cards must fail closed with source badges, Sync Proof Map, Agent Dashboard, and timeline proof actions when backend proof routes are missing.',
);
assert(
  appSource.includes('const missingReadinessProofRoute =')
    && appSource.includes("missingReadinessProofRoute('collaboration-intent-queue-route'")
    && appSource.includes('backend-collaboration-intent-queue-route-required')
    && appSource.includes("missingReadinessProofRoute('submission-review-workflow-route'")
    && appSource.includes('backend-submission-review-workflow-route-required')
    && appSource.includes("missingReadinessProofRoute('product-team-acceptance-chain-route'")
    && appSource.includes('backend-product-team-acceptance-chain-route-required')
    && appSource.includes("missingReadinessProofRoute('product-team-delivery-trace-route'")
    && appSource.includes('backend-product-team-delivery-trace-route-required')
    && appSource.includes("missingReadinessProofRoute('zero-to-autonomy-report-route'")
    && appSource.includes('backend-zero-to-autonomy-report-route-required')
    && appSource.includes('const managerProofMapRouteSyncButton = (route = {}, testId) => managerReadModelMeta(route).frontendMockSuppressed')
    && appSource.includes("managerProofMapRouteSyncButton(backendCollaborationIntentQueueRoute, 'proof-map-collaboration-intent-queue-sync-proof-map')")
    && appSource.includes("managerProofMapRouteSyncButton(backendSubmissionReviewWorkflowRoute, 'proof-map-submission-review-workflow-sync-proof-map')")
    && appSource.includes("managerProofMapRouteSyncButton(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-sync-proof-map')")
    && appSource.includes("managerProofMapRouteSyncButton(backendProductTeamDeliveryTraceRoute, 'proof-map-product-team-delivery-trace-sync-proof-map')")
    && appSource.includes("managerProofMapRouteSyncButton(backendZeroToAutonomyReportRoute, 'proof-map-zero-to-autonomy-report-sync-proof-map')")
    && appSource.includes("managerReadModelSourceBadge(backendCollaborationIntentQueueProofMapSource, 'proof-map-collaboration-intent-queue-source')")
    && appSource.includes("managerReadModelSourceBadge(backendSubmissionReviewWorkflowProofMapSource, 'proof-map-submission-review-workflow-source')")
    && appSource.includes("managerReadModelSourceBadge(backendProductTeamAcceptanceChainRoute, 'proof-map-product-team-acceptance-chain-source')")
    && appSource.includes("managerReadModelSourceBadge(backendProductTeamDeliveryTraceProofMapSource, 'proof-map-product-team-delivery-trace-source')")
    && appSource.includes("managerReadModelSourceBadge(backendZeroToAutonomyReportProofMapSource, 'proof-map-zero-to-autonomy-report-source')")
    && mockRegister.includes('Proof Map collaboration-intent route cards now fail closed')
    && mockRegister.includes('Proof Map submission-review route cards now fail closed')
    && mockRegister.includes('Proof Map product-team route cards now fail closed')
    && technicalSource.includes('Proof Map collaboration-intent route cards fail closed')
    && technicalSource.includes('Proof Map submission-review route cards fail closed')
    && technicalSource.includes('Proof Map product-team route cards fail closed')
    && agentReadmeSource.includes('Proof Map collaboration-intent route cards fail closed')
    && agentReadmeSource.includes('Proof Map submission-review route cards fail closed')
    && agentReadmeSource.includes('Proof Map product-team route cards fail closed')
    && architectureAuditSource.includes('Proof Map collaboration-intent route cards fail closed')
    && architectureAuditSource.includes('Proof Map submission-review route cards fail closed')
    && architectureAuditSource.includes('Proof Map product-team route cards fail closed'),
  'Manager Proof Map collaboration, submission-review, and product-team route cards must fail closed with source badges and Sync Proof Map actions when backend proof routes are missing.',
);
const coreReceiptReadModelRoutes = [
  'brainstormLayerRoute',
  'artifactQualityAuditRoute',
  'submissionReviewWorkflowRoute',
  'productTeamDeliveryTraceRoute',
  'evidenceQualityAuditRoute',
  'evidenceIndexReadinessRoute',
  'evidenceSourceReviewWorkflowRoute',
  'evidenceCustodyReadinessRoute',
  'productTeamOperatingLoopRoute',
  'plannerExecutorReviewerStateMachineRoute',
  'teamCollaborationDiagnosticsRoute',
  'collaborationIntentQueueRoute',
  'runtimeContractsRoute',
  'autonomousCycleConsistencyRoute',
  'runtimeAutonomyStatusRoute',
  'autonomousRunControlRoute',
  'agentAutonomousActionQueueRoute',
];
const coreReceiptTopLevelReadModels = [
  'productTeamOperatingLoop',
  'plannerExecutorReviewerStateMachine',
  'teamCollaborationDiagnostics',
  'collaborationIntentQueue',
  'runtimeContracts',
  'autonomousCycleConsistency',
  'runtimeAutonomyStatus',
  'autonomousRunControl',
  'agentAutonomousActionQueue',
];
assert(
  coreReceiptReadModelRoutes.every(routeKey => agentProjectApiSource.includes(routeKey))
    && coreReceiptReadModelRoutes.every(routeKey => appSource.includes(`readRoutes.${routeKey}`))
    && coreReceiptTopLevelReadModels.every(modelKey => appSource.includes(`${modelKey}: refreshed.${modelKey} || prev.${modelKey}`))
    && mockRegister.includes('Lightweight Agent write receipts now expose direct core product-team proof routes')
    && mockRegister.includes('Manager artifact/evidence/review/autonomy snapshots refresh from backend receipts'),
  'Lightweight Agent write receipts must expose and React must consume core artifact/evidence/review read-model routes.',
);
assert(
  appSource.includes('const agentWriteReadModelSpecs = [')
    && coreReceiptReadModelRoutes.every(routeKey => appSource.includes(`readRoutes.${routeKey}`))
    && appSource.includes('const agentWriteReadModelResultsPromise = Promise.allSettled')
    && appSource.includes('const agentWriteReadModelSubmodels = {};')
    && appSource.includes('...agentWriteReadModelSubmodels')
    && appSource.includes('readModelSubmodels: agentWriteReadModelSubmodels')
    && appSource.includes('agent-workbench-artifact-draft-proof-${agent.id}')
    && appSource.includes('Draft node: {latestWorkbenchReceipt.artifactDraftId}')
    && appSource.includes('latestWorkbenchReceipt.readModels?.managerFlowGraphRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.readinessProofMapRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.timelineRoute')
    && appSource.includes('latestWorkbenchReceipt.readModels?.eventsRoute')
    && mockRegister.includes("the receipt's core artifact/evidence/review/autonomy read-model routes"),
  'Agent Workbench write refresh must consume the same core receipt routes directly, not wait for a later broad proof sync.',
);
const projectInitiationProofRouteKeys = [
  'brainstormLayerRoute',
  'artifactQualityAuditRoute',
  'submissionReviewWorkflowRoute',
  'productTeamDeliveryTraceRoute',
  'evidenceQualityAuditRoute',
  'evidenceIndexReadinessRoute',
  'evidenceSourceReviewWorkflowRoute',
  'evidenceCustodyReadinessRoute',
  'teamCollaborationDiagnosticsRoute',
  'runtimeContractsRoute',
];
assert(
  appSource.includes('const projectInitiationReadModelSpecs = [')
    && projectInitiationProofRouteKeys.every(routeKey => appSource.includes(`readRoutes.${routeKey}`))
    && appSource.includes('const projectInitiationReadModelResultsPromise = Promise.allSettled')
    && appSource.includes('const projectInitiationReadModelSubmodels = {};')
    && appSource.includes('...projectInitiationReadModelSubmodels')
    && appSource.includes('readModelSubmodels: projectInitiationReadModelSubmodels')
    && mockRegister.includes('Mission Runner approval receipts now use the same backend-first proof refresh boundary')
    && mockRegister.includes('the first Manager Dashboard view is backed by backend proof'),
  'Mission Runner approval refresh must consume core proof routes immediately after kickoff approval, not wait for manual broad proof sync.',
);
assert(
  appSource.includes('managerAutoControlSyncRef')
    && appSource.includes('syncBackendManagerCommandCenter({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendManagerActionQueue({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendAutonomousControlBundle({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendCollaborationIntentQueue({ silent: true, projectId: activeProject.id })')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard now also automatically syncs Manager Command Center, Manager Action Queue, Agent Autonomous Queue, Autonomous Run Control, and Collaboration Intent Queue'),
  'Manager Dashboard must automatically sync critical C/A run-control models for backend-backed projects.',
);
assert(
  appSource.includes('backendCollaborationIntentQueue && !backendManagerReadyPackage')
    && appSource.includes('dashboard-collaboration-intent-row-')
    && appSource.includes("row.id === 'customer-agent-handoff-intent'")
    && appSource.includes('backend-collaboration-intent-output-work-submission')
    && appSource.includes('backend-collaboration-intent-handoff-output-routes')
    && appSource.includes('collaboration-intent-output-chat-proof-work-submission')
    && appSource.includes('collaboration-intent-output-timeline-proof-work-submission')
    && appSource.includes('openProjectTimelineProof([backendCollaborationIntentRunOutput.workSubmission.timelineLogId].filter(Boolean))')
    && appSource.includes('backend-collaboration-intent-standalone-output-rows')
    && appSource.includes("artifact: payload.artifact || null")
    && appSource.includes("reviewResponseArtifact: payload.reviewResponseArtifact || null")
    && appSource.includes("label: 'Artifact'")
    && appSource.includes("label: 'Evidence Search'")
    && appSource.includes("label: 'Submission Review'")
    && appSource.includes("label: 'Review Response'")
    && appSource.includes("label: 'Review Response Artifact'")
    && appSource.includes("label: 'Result Messages'")
    && appSource.includes('data-testid={`backend-collaboration-intent-output-${row.id}`}')
    && appSource.includes('data-testid={`collaboration-intent-output-chat-proof-${row.id}`}')
    && appSource.includes('data-testid={`collaboration-intent-output-timeline-proof-${row.id}`}')
    && appSource.includes('setTimeout(() => syncBackendReadinessProofMap({ silent: true, projectId: payload.project?.id || activeProject.id }), 0);')
    && appSource.includes('const outputAgentIds = Array.from(new Set([')
    && appSource.includes('setTimeout(() => syncBackendAgentDashboard(agentId, { silent: true, projectId: payload.project?.id || activeProject.id }), 0);')
    && technicalSource.includes('backend-collaboration-intent-handoff-output-routes')
    && agentReadmeSource.includes('backend-collaboration-intent-handoff-output-routes')
    && architectureAuditSource.includes('backend-collaboration-intent-handoff-output-routes')
    && mockRegister.includes('backend-collaboration-intent-handoff-output-routes'),
  'Manager Dashboard must expose a standalone C/A Collaboration Intent Queue panel before the full Ready Package is synced.',
);
assert(
  prdSource.includes('The Manager Dashboard must expose the C/A handoff as a backend-backed first-run action even before the full Manager Ready Package has synced.')
    && technicalSource.includes('Manager Dashboard also consumes `backendStation.collaborationIntentQueue` as a standalone scoped read model')
    && agentReadmeSource.includes('Manager Dashboard also renders the standalone `collaboration-intent-queue/v1` model before a full Ready Package sync exists')
    && architectureAuditSource.includes('standalone C/A Collaboration Intent Queue before a full Ready Package sync')
    && mockRegister.includes('Manager Dashboard also renders the standalone C/A intent queue when the full Ready Package has not synced')
    && launchGateDoc.includes('standalone Manager Dashboard Collaboration Intent Queue before requiring a full Manager Ready Package sync')
    && readme.includes('standalone Manager Dashboard C/A handoff before full Ready Package sync'),
  'Authoritative docs must describe the standalone Manager Dashboard C/A intent queue before Ready Package sync.',
);
assert(
  appSource.includes('readBackendProjectSnapshotForWrite')
    && appSource.includes('const routeBackedIntent = Boolean(row.runIntentApiPath || row.runApiPath);')
    && appSource.includes('const projectSnapshot = await readBackendProjectSnapshotForWrite({ projectId: activeProject.id, timeoutMs: 8000 }).catch((error) => {')
    && appSource.includes("if (error.name === 'AbortError' && routeBackedIntent) return { skippedProjectSnapshotPreflight: true };")
    && appSource.includes('if (!projectSnapshot && !routeBackedIntent) await ensureBackendProjectSeed();')
    && mockRegister.includes('Route-backed Collaboration Intent rows can continue to their backend `runIntentApiPath` when the project snapshot preflight aborts')
    && mockRegister.includes('Non-route-backed local rows still require the project snapshot or explicit seed path before any local fallback can run.'),
  'Collaboration Intent Queue runs must verify backend project state for local rows while letting route-backed backend intents continue past aborted snapshot preflight.',
);
assert(
  appSource.includes('managerAutoDiagnosticSyncRef')
    && appSource.includes('syncBackendManagerScenarioWalkthrough({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendManagerScenarioTrail({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendManagerRequirementMatrix({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendSyncProtocolAudit({ silent: true, projectId: activeProject.id })')
    && appSource.includes('syncBackendManagerUseCaseAudit({ silent: true, projectId: activeProject.id })')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard now also automatically syncs Scenario Walkthrough, Scenario Trail, Requirement Matrix, Sync Protocol Audit, and Use Case Audit'),
  'Manager Dashboard must automatically sync diagnostic Manager submodels for backend-backed projects.',
);
assert(
  appSource.includes('Backend chat failed; local fallback disabled for backend-online project; draft restored')
    && appSource.includes('Backend chat route required')
    && appSource.includes('Chat for backend-online projects must use the backend project command route. Configure Backend URL in Settings Deployment.')
    && appSource.includes('if (!shouldUseBackendChat && !canUseLocalChatFallback) {')
    && appSource.includes('data-testid="backend-chat-send-required"')
    && appSource.includes('data-testid="backend-chat-send-open-deployment"')
    && appSource.includes('data-testid="project-chat-send"')
    && appSource.includes('disabled={!canSendChat}')
    && appSource.includes('Backend meeting failed; local fallback disabled for backend-online project; draft restored')
    && appSource.includes('Backend meeting returned no Agent turns; local simulation blocked; draft restored')
    && appSource.includes('const runBackendProjectCommand = async (action, body = {}) => {')
    && appSource.includes('applyBackendProjectSnapshot(payload);')
    && appSource.includes('setTimeout(() => syncBackendProjectTranscripts({')
    && appSource.includes('channelId: body.channelId || activeChannelId')
    && appSource.includes("await runBackendProjectCommand('chat', {")
    && appSource.includes('setChatInput(current => current || text)')
    && mockRegister.includes('restore the unsent draft')
    && mockRegister.includes('Group Chat send now fails closed before clearing the draft when a backend-backed real project has no backend target.'),
  'Real backend project chat and meeting writes must apply backend snapshots, refresh transcripts, block missing backend targets, and restore unsent drafts on fail-closed errors.',
);
assert(
  appSource.includes('submission-review-failed')
    && appSource.includes('Review write failed:')
    && appSource.includes('No local review receipt was created.')
    && mockRegister.includes('shows `Review write failed` rather than leaving a fake or pending proof row'),
  'Reviewer composer failures must show a failed backend write instead of leaving a fake or pending review receipt.',
);
assert(
  appSource.includes('Agent Action Failed')
    && appSource.includes('Intent Run Failed')
    && appSource.includes('Action failed:')
    && appSource.includes('No local run receipt was created.')
    && appSource.includes('No local intent receipt was created.')
    && appSource.includes('No local operator receipt was created.')
    && appSource.includes('backend-agent-autonomous-action-run-output-failed')
    && appSource.includes('backend-collaboration-intent-run-output-failed')
    && mockRegister.includes('Failed intent runs clear the previous run receipt')
    && mockRegister.includes('failed row runs clear the previous successful run receipt'),
  'A-side run controls must clear stale receipts and render failed non-proof states when backend writes fail.',
);
assert(
  appSource.includes('backend-agent-autonomous-action-run-output')
    && appSource.includes('Agent Action Output Nodes')
    && appSource.includes('agent-autonomous-action-output-route-${row.id}')
    && appSource.includes("route: output.workSubmission.route")
    && appSource.includes("route: output.artifact.route")
    && appSource.includes("route: output.evidenceSearch.route")
    && appSource.includes("route: output.reviewResponseArtifact.route")
    && appSource.includes("label: 'Review Response Artifact'")
    && appSource.includes("route: activeProject?.id ? `/projects/${activeProject.id}/transcripts/${output.channelId || 'main'}` : null")
    && appSource.includes("Route: {row.route || 'route pending'} / Event: {row.eventId || 'missing'}"),
  'Agent Autonomous Action output rows must show backend resource/transcript routes and event ids for C/A proof handoff.',
);
assert(
  scripts['agents:agent-workbench-contract'] === 'node scripts/validate-agent-workbench-contract.mjs'
    && agentWorkbenchContractSource.includes('/agents/turing/evidence-searches')
    && agentWorkbenchContractSource.includes('/agents/turing/submissions')
    && agentWorkbenchContractSource.includes('/agents/turing/artifact-drafts')
    && agentWorkbenchContractSource.includes('/submissions/${productBriefSubmission.id}/reviews')
    && agentWorkbenchContractSource.includes("'discovery-report'")
    && agentWorkbenchContractSource.includes("artifactType: 'brainstorm-board'")
    && agentWorkbenchContractSource.includes("'evidence-packet'")
    && agentWorkbenchContractSource.includes("artifactType: 'product-brief'")
    && agentWorkbenchContractSource.includes("'decision-proposal'")
    && agentWorkbenchContractSource.includes("'risk-review'")
    && agentWorkbenchContractSource.includes("'implementation-plan'")
    && agentWorkbenchContractSource.includes("artifactType: 'revision-note'")
    && agentWorkbenchContractSource.includes("artifactType: 'final-deliverable'")
    && agentWorkbenchContractSource.includes('assertDeferredReadModels')
    && agentWorkbenchContractSource.includes('/manager-flow-graph')
    && agentWorkbenchContractSource.includes('/readiness-proof-map')
    && agentWorkbenchContractSource.includes('/transcripts')
    && agentWorkbenchContractSource.includes('/timeline')
    && agentWorkbenchContractSource.includes('/events')
    && agentWorkbenchContractSource.includes("searchMode !== 'agent-note'")
    && launchGateDoc.includes('npm run agents:agent-workbench-contract'),
  'Agent Workbench backend contract gate must prove evidence, submission, draft, review, revision, and final deliverable nodes through backend routes and proof surfaces.',
);
assert(
  appSource.includes('const dashboard = agentDashboardSnapshotFor(agentId, activeProject?.id);')
    && appSource.includes('const AGENT_WORKBENCH_BACKEND_DASHBOARD_REQUIRED_MESSAGE =')
    && appSource.includes('const agentWorkbenchBackendDashboardMissing = (agentId, project = activeProject) => Boolean(')
    && appSource.includes('if (agentWorkbenchBackendDashboardMissing(agentId)) return null;')
    && appSource.includes('const failAgentWorkbenchBackendDashboardRequired = (agentId, action) => {')
    && appSource.includes("...agentWorkbenchFailurePatch(action, AGENT_WORKBENCH_BACKEND_DASHBOARD_REQUIRED_MESSAGE)")
    && appSource.includes("failAgentWorkbenchBackendDashboardRequired(agentId, 'agent-workbench-backend-dashboard-required');")
    && appSource.includes('const localReviewFallbackAllowed = Boolean(dashboard) || !shouldRequireBackendAgentDashboard(activeProject);')
    && appSource.includes('const localSubmissionFallbackAllowed = Boolean(dashboard) || !shouldRequireBackendAgentDashboard(activeProject);')
    && appSource.includes('const agentWorkbenchEvidenceOptions = (agentId) => {')
    && appSource.includes('const AGENT_WORKBENCH_ARTIFACT_TYPES = [')
    && appSource.includes('AGENT_WORKBENCH_ARTIFACT_TYPES.map')
    && appSource.includes("{ id: 'discovery-report', label: 'Discovery Report' }")
    && appSource.includes("{ id: 'brainstorm-board', label: 'Brainstorm Board' }")
    && appSource.includes("{ id: 'evidence-packet', label: 'Evidence Packet' }")
    && appSource.includes("{ id: 'product-brief', label: 'Product Brief' }")
    && appSource.includes("{ id: 'decision-proposal', label: 'Decision Proposal' }")
    && appSource.includes("{ id: 'risk-review', label: 'Risk Review' }")
    && appSource.includes("{ id: 'implementation-plan', label: 'Implementation Plan' }")
    && appSource.includes("{ id: 'revision-note', label: 'Revision Note' }")
    && appSource.includes("{ id: 'final-deliverable', label: 'Final Deliverable' }")
    && appSource.includes('if (dashboard) return (dashboard.ownedEvidenceSearches || []).slice(0, 20);')
    && appSource.includes('if (shouldRequireBackendAgentDashboard(activeProject)) return [];')
    && appSource.includes('const ownedEvidence = agentWorkbenchEvidenceOptions(agentId).slice(0, 3);')
    && appSource.includes('const workbenchBackendContextMissing = backendAgentDashboardRequired && !agentBackendDashboard;')
    && appSource.includes('const workbenchWriteDisabled = !backendCommandAvailable || backendStation.loading || workbenchBackendContextMissing;')
    && appSource.includes(': localAgentSignalProofAllowed ? localAgentOwnedTasks : [];')
    && appSource.includes('const agentFocusCurrentPlan = backendAgentDashboardMissing')
    && appSource.includes('const agentFocusInboxCount = backendAgentDashboardMissing')
    && appSource.includes('const agentFocusObligationCount = backendAgentDashboardMissing')
    && appSource.includes("const agentFocusOwnedTaskCount = backendAgentDashboardMissing ? 'backend required' : agentOwnedTasks.length;")
    && appSource.includes("const agentFocusStatusLabel = backendAgentDashboardMissing ? 'backend required' : agentFocusState.status || 'monitoring';")
    && appSource.includes("const agentFocusStatusClass = backendAgentDashboardMissing ? 'bg-[#8f1e18] text-white' : 'bg-[#251b13] text-[#efe2bd]';")
    && appSource.includes('data-testid={`agent-focus-status-${agent.id}`}')
    && appSource.includes('{agentFocusStatusClass}')
    && appSource.includes('{agentFocusStatusLabel}')
    && appSource.includes("agentBackendDashboard.routine?.label || agentBackendDashboard.state?.currentPlan?.routine?.label || 'fixed routine'")
    && !appSource.includes("{state.status || 'monitoring'}")
    && !appSource.includes("{agentOwnedTasks.length} task{agentOwnedTasks.length === 1 ? '' : 's'}")
    && !appSource.includes("agentBackendDashboard.routine?.label || state.currentPlan?.routine?.label || 'fixed routine'")
    && appSource.includes('data-testid={`agent-workbench-backend-dashboard-required-${agent.id}`}')
    && appSource.includes('Backend Agent Dashboard is required before this real project can submit Agent Workbench evidence, artifacts, drafts, reviews, or final delivery from this Agent context.')
    && appSource.includes('Backend Agent Dashboard is required before this real project can create Agent Workbench proof. No local workbench proof was created.')
    && appSource.includes('...(proofSignalAllowed ? agentOwnedTasks.flatMap(task => taskEvidence(task).chatIds) : [])')
    && appSource.includes('...(proofSignalAllowed ? agentOwnedTasks.flatMap(task => taskEvidence(task).timelineIds) : [])')
    && mockRegister.includes('Agent Workbench task, review, submission, and evidence dependency options now require the backend Agent Dashboard for backend-online real projects')
    && mockRegister.includes('Agent Focus Workspace summary metrics now follow the same Agent Dashboard boundary')
    && mockRegister.includes('Agent Focus status chips now read `agentFocusState.status`')
    && mockRegister.includes('The Workbench write functions enforce the same boundary below the UI'),
  'Agent Workbench must not use browser-local task/review/submission/evidence options or proof exits when a backend-required Agent Dashboard is missing.',
);

assert(
  scripts['agents:agent-message-contract'] === 'node scripts/validate-agent-message-contract.mjs'
    && agentMessageContractSource.includes('/agents/turing/message')
    && agentMessageContractSource.includes("source === 'agent-to-agent-message'")
    && agentMessageContractSource.includes('target Agent inbox')
    && agentMessageContractSource.includes('sender worklog proof')
    && agentMessageContractSource.includes('/transcripts')
    && agentMessageContractSource.includes('/timeline')
    && agentMessageContractSource.includes('/events')
    && agentMessageContractSource.includes('/manager-dashboard')
    && agentMessageContractSource.includes('/readiness-proof-map')
    && agentMessageContractSource.includes('/manager-flow-graph')
    && agentMessageContractSource.includes('readyForAgentMessageDelivery')
    && launchGateDoc.includes('npm run agents:agent-message-contract'),
  'Agent-to-Agent message contract gate must prove targeted Agent messages reach inbox/worklog plus transcript, timeline, event, Flow Graph, and Proof Map routes.',
);

assert(
  scripts['agents:agent-contract'] === 'node scripts/validate-agent-contract-contract.mjs'
    && agentContractContractSource.includes('/agents/contract')
    && agentContractContractSource.includes("schemaVersion === 'agent-contract/v1'")
    && agentContractContractSource.includes('pantheon-market')
    && agentContractContractSource.includes('project team roster')
    && agentContractContractSource.includes('/manager-flow-graph')
    && agentContractContractSource.includes('/timeline')
    && agentContractContractSource.includes('/events')
    && agentContractContractSource.includes('/readiness-proof-map')
    && agentContractContractSource.includes('/agents/${agentId}/dashboard')
    && agentContractContractSource.includes("subtype === 'agent-contracted'")
    && agentProjectServiceSource.includes('agentContractRoutes')
    && agentProjectServiceSource.includes('readyForAgentContract')
    && launchGateDoc.includes('npm run agents:agent-contract'),
  'Agent marketplace contract gate must prove backend roster mutation plus Agent Dashboard, Flow Graph, timeline, event, and Proof Map proof.',
);

assert(
  scripts['agents:manager-chat-command-contract'] === 'node scripts/validate-manager-chat-command-contract.mjs'
    && managerChatCommandContractSource.includes('/projects/${projectId}/chat')
    && managerChatCommandContractSource.includes("route === 'leader-assignment'")
    && managerChatCommandContractSource.includes("route === 'feature-change'")
    && managerChatCommandContractSource.includes('assignmentTimelineMatrix')
    && managerChatCommandContractSource.includes('changeFlow')
    && managerChatCommandContractSource.includes('/transcripts')
    && managerChatCommandContractSource.includes('/timeline')
    && managerChatCommandContractSource.includes('/events')
    && managerChatCommandContractSource.includes('/manager-dashboard')
    && managerChatCommandContractSource.includes('/readiness-proof-map')
    && managerChatCommandContractSource.includes('/manager-flow-graph')
    && managerChatCommandContractSource.includes('midproject-change-synced')
    && launchGateDoc.includes('npm run agents:manager-chat-command-contract'),
  'Manager chat command contract gate must prove Leader assignment and change intake commands become backend transcript, timeline, event, Dashboard, Flow Graph, and Proof Map proof.',
);

assert(
  scripts['agents:scenario:contract'] === 'node scripts/validate-manager-scenario-contract.mjs'
    && managerScenarioContractSource.includes('validate-manager-chat-command-contract.mjs')
    && managerScenarioContractSource.includes('validate-agent-message-contract.mjs')
    && managerScenarioContractSource.includes('validate-agent-contract-contract.mjs')
    && managerScenarioContractSource.includes('validate-agent-workbench-contract.mjs')
    && managerScenarioContractSource.includes('validate-timeline-action-contract.mjs')
    && launchGateDoc.includes('npm run agents:scenario:contract'),
  'Manager scenario contract gate must aggregate the low-write Manager command, Agent message, marketplace Agent contract, Workbench, and timeline-action proof slices.',
);
assert(
  agentManagerScenarioSource.includes('async function fetchWithRouteTimeout')
    && agentManagerScenarioSource.includes('const { timeoutMs = 30000, ...fetchOptions } = options;')
    && agentManagerScenarioSource.includes('const fetch = fetchWithRouteTimeout;')
    && agentManagerScenarioSource.includes('throw new Error(`${method} ${requestUrl} ${detail}`);')
    && agentManagerScenarioSource.includes('HOFS_MANAGER_SCENARIO_TIMEOUT_MS')
    && agentManagerScenarioSource.includes('lastScenarioCheckpoint'),
  'Full Manager scenario validation must fail with route-level or stage-level diagnostics instead of hanging.',
);

assert(
  appSource.includes('agentWorkbenchFailurePatch')
    && appSource.includes('Agent Workbench Write Failed')
    && appSource.includes('provider-evidence-search-failed')
    && appSource.includes('artifact-submission-failed')
    && appSource.includes('artifact-draft-submit-failed')
    && appSource.includes('no local workbench proof was created')
    && appSource.includes('localProofCreated: false')
    && mockRegister.includes('Failed evidence/submission/draft writes replace the previous Workbench receipt'),
  'Agent Workbench failures must replace stale backend receipts with visible non-proof failure state.',
);
assert(
  (appSource.match(/connectionStatus: backendFailureConnectionStatusFor\(activeProject, prev\.connectionStatus\)/g) || []).length >= 11
    && appSource.includes("lastAction: 'Submission review failed'")
    && appSource.includes("lastAction: 'Agent provider evidence failed; local source note blocked'")
    && appSource.includes("lastAction: 'Agent evidence failed'")
    && appSource.includes("lastAction: 'Agent submission failed'")
    && appSource.includes("lastAction: 'Agent draft failed'")
    && appSource.includes("lastAction: 'Agent pulse failed'")
    && appSource.includes("lastAction: 'Agent message failed'")
    && appSource.includes("lastAction: 'Manager flow node confirmation failed'")
    && mockRegister.includes('Agent Workbench, Reviewer composer, Agent pulse/message, and Flow Graph confirmation failures now preserve backend-required station status')
    && technicalSource.includes('Agent Workbench, Reviewer composer, Agent pulse/message, and Flow Graph confirmation failures preserve backend-required station status'),
  'Agent/Reviewer/Flow write failures must not downgrade backend-managed real projects into offline/local fallback.',
);
assert(
  appSource.includes('BACKEND MEETING RECORDED; AGENT TURNS MISSING. DIRECTIVE RESTORED.')
    && appSource.includes('BACKEND MEETING WRITE FAILED. DIRECTIVE RESTORED.')
    && appSource.includes('BACKEND MEETING CLOSE FAILED. SESSION REMAINS OPEN.')
    && appSource.includes('setTerminalInput(val);')
    && !appSource.includes("if (!allowFallback) {\n          closeMeetingUi();\n          return;\n        }"),
  'War Room backend-required meeting failures must restore user input or keep the session open instead of looking like successful local proof.',
);
assert(
  appSource.includes("['mvpReadiness', readRoutes.mvpReadinessRoute, 'mvpReadiness', 5200]")
    && appSource.includes('const refreshedReadModels = await refreshReceiptReadModels({')
    && appSource.includes("workflowKey: 'mvpReadiness'")
    && appSource.includes('actionLabel: \'MVP readiness action receipt routes refreshed\'')
    && appSource.includes('timeoutMs: 10000'),
  'MVP readiness operator actions must wait for backend receipts and refresh route-backed proof models instead of relying on short-timeout background refresh.',
);

for (const text of [
  '/secret-vault/status',
  'settings-provider-model-base-url-input',
  'settings-provider-model-name-input',
  'settings-provider-seal-model-key',
  'settings-provider-search-endpoint-input',
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
  'backend-artifact-quality-audit-snapshot',
  'backend-product-team-delivery-trace-snapshot',
  'backend-zero-to-autonomy-report-snapshot',
  'backend-submission-review-workflow-snapshot',
  'backend-evidence-index-readiness-snapshot',
  'requiredGenericArtifactTypes',
  'missingManagerUiArtifactTypes',
  'Manager UI must render every required generic artifact type from backend submissions or Artifact Quality Audit.',
  'Manager UI Artifact Quality Audit must show complete generic artifact type coverage.',
  '/artifact-quality-audit',
  'generic-artifact-type-coverage',
  '/manager-flow-graph',
  '/readiness-proof-map',
  '/product-team-delivery-trace',
  '/zero-to-autonomy-report',
  'providerUsageCount',
  'providerReceiptCount',
  'Project zero-to-autonomy report must count search and model provider usage proof.',
  'Project zero-to-autonomy report must count provider receipt proof.',
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
assert(
  appSource.includes("projectText('Provider Usage')")
    && appSource.includes("projectText('Provider Receipts')")
    && appSource.includes('backendZeroToAutonomyReport.summary?.providerUsageCount')
    && appSource.includes('backendZeroToAutonomyReport.summary?.providerReceiptCount'),
  'Manager UI zero-to-autonomy report must show provider usage and provider receipt proof counts.',
);
assert(
  readme.includes('search/model provider usage proof rows')
    && readme.includes('provider receipt proof rows')
    && readme.includes('Proof Map provider audit routes')
    && prdSource.includes('search/model provider usage proof rows (`providerUsageCount`)')
    && prdSource.includes('provider receipt proof rows (`providerReceiptCount`)')
    && prdSource.includes('providerUsageProofIds')
    && prdSource.includes('providerReceiptProofIds')
    && prdSource.includes('`provider-usage-audit` evidence node')
    && roadmapSource.includes('search/model provider usage proof rows')
    && roadmapSource.includes('provider receipt proof rows')
    && roadmapSource.includes('provider audit routes')
    && launchGateDoc.includes('provider usage proof rows for search and model calls')
    && launchGateDoc.includes('providerReceiptCount')
    && launchGateDoc.includes('provider usage proof ids')
    && launchGateDoc.includes('provider audit routes to Provider Readiness')
    && technicalSource.includes('providerUsageCount` for search/model provider usage proof rows')
    && technicalSource.includes('provider evidence/source review stage must carry those proof ids')
    && technicalSource.includes('providerUsageProofIds')
    && technicalSource.includes('provider audit routes to Provider Readiness')
    && technicalSource.includes('`provider-usage-audit` node')
    && agentReadmeSource.includes('provider usage proof rows')
    && agentReadmeSource.includes('providerReceiptCount')
    && agentReadmeSource.includes('providerUsageProofIds')
    && agentReadmeSource.includes('provider audit routes to Provider Readiness')
    && agentReadmeSource.includes('`provider-usage-audit` node')
    && architectureAuditSource.includes('providerUsageCount` for search/model provider usage proof rows')
    && architectureAuditSource.includes('providerReceiptCount` for provider receipt proof rows')
    && architectureAuditSource.includes('provider audit routes to provider readiness')
    && architectureAuditSource.includes('`provider-usage-audit`')
    && agentProjectServiceSource.includes('providerUsageProofIds')
    && agentProjectServiceSource.includes('providerReceiptProofIds')
    && agentProjectServiceSource.includes('providerEvidenceRoutes')
    && agentProjectServiceSource.includes("id: 'provider-usage-audit'")
    && agentProjectServiceSource.includes('Provider usage and receipt audit')
    && appSource.includes('proof-map-zero-to-autonomy-provider-routes')
    && appSource.includes('backendZeroToAutonomyProviderUsageProofIds')
    && realUserZeroToAutonomyApiSource.includes('zeroToAutonomyProofRoute.providerUsageProofIds')
    && realUserZeroToAutonomyApiSource.includes('providerAuditFlowIds')
    && realUserZeroToAutonomyApiSource.includes('provider-usage-audit')
    && realUserZeroToAutonomySource.includes('providerAuditFlowIds')
    && realUserZeroToAutonomySource.includes('provider-usage-audit')
    && realUserZeroToAutonomySource.includes('Provider audit')
    && realUserZeroToAutonomySource.includes('/provider-readiness')
    && realUserZeroToAutonomySource.includes('/evidence-custody-readiness'),
  'Docs must make provider usage and provider receipt proof mandatory in the zero-to-autonomy report.',
);
assert(
  technicalSource.includes('Manager UI readback must show complete `9/9` generic artifact coverage')
    && mockRegister.includes('The real-user browser gate must prove Manager UI readback, not just backend JSON'),
  'Real-user browser gate docs must state that Manager UI readback proves complete generic artifact coverage.',
);

console.log('Local MVP release checklist validation passed.');
