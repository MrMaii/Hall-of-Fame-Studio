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

function assertInputEditableByTestId(source, testId) {
  const match = source.match(new RegExp(`data-testid="${testId}"[\\s\\S]{0,600}?/>`));
  assert(match, `Expected ${testId} input to exist.`);
  assert(match[0].includes('onChange='), `${testId} must remain user-editable.`);
  assert(!match[0].includes('disabled='), `${testId} must not be disabled when backend/Vault readiness is missing.`);
}

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts || {};
const launchGateDoc = read('docs/LAUNCH_READINESS_GATES.md');
const mockRegister = read('docs/FRONTEND_MOCK_REPLACEMENT_REGISTER.md');
const appSource = read('src/App.jsx');
const agentProjectServiceSource = read('src/agents/agentProjectService.js');
const agentProjectApiSource = read('src/agents/agentProjectApi.js');
const accessControlSource = read('src/agents/accessControl.js');
const productTeamCoreSmokeSource = read('scripts/validate-product-team-core-smoke.mjs');
const productTeamAcceptanceSource = read('scripts/validate-product-team-acceptance-scenario.mjs');
const productTeamAcceptanceStageRunnerSource = read('scripts/run-product-team-acceptance-stage.mjs');
const agentManagerScenarioSource = read('scripts/validate-agent-manager-scenario.mjs');
const privatePilotUiSource = read('scripts/validate-manager-private-pilot-ui.mjs');
const managerBackendCoreUiSource = read('scripts/validate-manager-backend-core-ui.mjs');
const managerBackendUiSource = read('scripts/validate-manager-backend-ui.mjs');
const settingsAgentsServerUiSource = read('scripts/validate-settings-agents-server-ui.mjs');
const realUserZeroToAutonomySource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-ui.mjs');
const realUserZeroToAutonomyApiSource = read('scripts/validate-real-user-zero-to-autonomy-agents-server-api.mjs');
const adapterGatewayRuntimeSource = read('src/agents/adapterGatewayServer.js');
const adapterGatewayServerSource = read('scripts/validate-adapter-gateway-server.mjs');
const adapterGatewayHttpModeSource = read('scripts/validate-adapter-gateway-http-mode.mjs');
const adapterGatewayPostgresValidationSource = read('scripts/validate-adapter-gateway-postgres-store.mjs');
const managedInfrastructureCutoverAttestationsSource = read('scripts/validate-managed-infrastructure-cutover-attestations.mjs');
const agentArtifactPathContractSource = read('scripts/validate-agent-artifact-path-contract.mjs');
const transcriptSearchContractSource = read('scripts/validate-transcript-search-contract.mjs');
const transcriptChannelPinContractSource = read('scripts/validate-transcript-channel-pin-contract.mjs');
const transcriptPinContractSource = read('scripts/validate-transcript-pin-contract.mjs');
const transcriptReplyContractSource = read('scripts/validate-transcript-reply-contract.mjs');
const transcriptMentionContractSource = read('scripts/validate-transcript-mention-contract.mjs');
const transcriptAttachmentContractSource = read('scripts/validate-transcript-attachment-contract.mjs');
const transcriptMemberPresenceContractSource = read('scripts/validate-transcript-member-presence-contract.mjs');

const p0Commands = [
  'build',
  'skills:check',
  'skills:blend',
  'agents:scenario',
  'agents:server:validate',
  'agents:local-mvp-startup-readiness',
  'agents:public-production-startup-readiness',
  'agents:settings-health-readiness',
  'agents:settings-runtime-readiness',
  'agents:model-provider-adapter',
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
  'agents:transcript-search',
  'agents:transcript-channel-pin',
  'agents:transcript-pin',
  'agents:transcript-reply',
  'agents:transcript-mention',
  'agents:transcript-attachment',
  'agents:transcript-member-presence',
  'agents:real-user-zero-to-autonomy',
  'agents:product-team:core',
  'agents:product-team:research-sample',
  'agents:product-team:cycle-consistency',
  'ui:manager-backend:core',
  'ui:manager-backend:real-user-chain',
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
  'agents:product-team:private-pilot',
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
  'scripts/validate-public-production-startup-readiness-contract.mjs',
  'scripts/validate-managed-infrastructure-cutover-attestations.mjs',
  'scripts/validate-agent-artifact-path-contract.mjs',
  'scripts/validate-transcript-search-contract.mjs',
  'scripts/validate-transcript-channel-pin-contract.mjs',
  'scripts/validate-transcript-pin-contract.mjs',
  'scripts/validate-transcript-reply-contract.mjs',
  'scripts/validate-transcript-mention-contract.mjs',
  'scripts/validate-transcript-attachment-contract.mjs',
  'scripts/validate-transcript-member-presence-contract.mjs',
  'scripts/validate-settings-health-readiness-contract.mjs',
  'scripts/validate-settings-runtime-readiness-contract.mjs',
  'scripts/validate-model-provider-adapter-contract.mjs',
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
  'Real-user Settings provider seal plus zero-to-autonomy browser proof',
  'Local MVP startup readiness through `local-mvp-startup-readiness/v1`',
  'Public production startup readiness through `public-production-startup-readiness/v1`',
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
  'npm run agents:local-mvp-startup-readiness',
  'npm run agents:settings-health-readiness',
  'npm run agents:settings-runtime-readiness',
  'npm run agents:settings-integration-readiness',
  'npm run agents:evidence-index-readiness',
  'npm run agents:budget-alert-readiness',
  'npm run agents:error-reporting-readiness',
  'npm run ui:real-user-zero-to-autonomy',
  'npm run ui:real-user-zero-to-autonomy:dev',
  'http://127.0.0.1:5173',
  'probes the local `localhost` counterpart',
  'Browser-snapshot backend writes are now limited to sample fixture or explicit development fallback projects',
  'Sample Fixture Path is hidden for real backend projects',
  'Unified Event Ledger now consumes backend `/events` rows as `event-ledger/v1`',
  '24/7 Operations Board, Continuous Work Loop, and Fixed Work Routines now consume backend Agent state rows',
  'Legacy Timeline detail no longer renders no-op comment, chat jump, completion, or edit controls',
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
  realUserZeroToAutonomyApiSource.includes('agent-project-server.mjs')
    && realUserZeroToAutonomyApiSource.includes('/secret-vault/seal')
    && realUserZeroToAutonomyApiSource.includes('/product-team-missions')
    && realUserZeroToAutonomyApiSource.includes('/agent-autonomous-action-queue/next/run')
    && realUserZeroToAutonomyApiSource.includes('assertAutonomousHandoffOutput')
    && realUserZeroToAutonomyApiSource.includes('agent-autonomous-action-run/v1')
    && realUserZeroToAutonomyApiSource.includes('autonomous-action-decision/v1')
    && realUserZeroToAutonomyApiSource.includes('/manager-flow-graph')
    && realUserZeroToAutonomyApiSource.includes('/readiness-proof-map')
    && realUserZeroToAutonomyApiSource.includes('/memory-readiness')
    && realUserZeroToAutonomyApiSource.includes('/transcripts/main')
    && realUserZeroToAutonomyApiSource.includes('/product-team-delivery-trace'),
  'agents:real-user-zero-to-autonomy must cover Secret Vault, mission start, autonomous Agent continuation, and proof surfaces through the real backend API.',
);
assert(
  realUserZeroToAutonomyApiSource.includes('openChangeReviews')
    && realUserZeroToAutonomyApiSource.includes('respondsToReviewId')
    && realUserZeroToAutonomyApiSource.includes('readyForPrivatePilotDelivery === true'),
  'agents:real-user-zero-to-autonomy must close every requested-change review before claiming the delivery trace is ready.',
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
  realUserZeroToAutonomySource.includes("readCliArg('--ui-base-url')")
    && realUserZeroToAutonomySource.includes('HOFS_UI_BASE_URL')
    && realUserZeroToAutonomySource.includes('configuredUiBaseUrl')
    && realUserZeroToAutonomySource.includes('/agent-autonomous-action-queue/next/run')
    && realUserZeroToAutonomySource.includes('assertAutonomousHandoffOutput')
    && realUserZeroToAutonomySource.includes('agent-autonomous-action-run/v1')
    && realUserZeroToAutonomySource.includes('autonomous-action-decision/v1')
    && realUserZeroToAutonomySource.includes('/memory-readiness')
    && realUserZeroToAutonomySource.includes('staticRuntime.server'),
  'Real-user browser gate must support --ui-base-url / HOFS_UI_BASE_URL, prove autonomous Agent continuation, and skip the dist static server when a dev UI URL is supplied.',
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
    && productTeamAcceptanceSource.includes("attestationFailureReason === 'managed-production-attestation-signature-missing'"),
  'Managed-production evidence integrity must require a signed control-plane attestation, not only an evidenceEnvironment flag.',
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
    && managedInfrastructureCutoverAttestationsSource.includes('productionEvidenceIntegrityAudit'),
  'Project API must bridge signed adapter-gateway attestations into production operations receipts and evidence-integrity proof.',
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
    && appSource.includes('settingsAutoWorkspaceSyncRef')
    && appSource.includes("settingsTab !== 'workspace'")
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
    && appSource.includes('Backend sync required before settings are treated as saved')
    && appSource.includes('You can type values here; saving requires the backend Secret Vault')
    && !appSource.includes('Backend workspace capability model missing.')
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
    && appSource.includes('settingsAutoProviderSyncRef')
    && appSource.includes("const providerSettingsTabs = new Set(['deployment', 'keys', 'models', 'health']);")
    && appSource.includes('syncSettingsProviderRuntime({ runTests: false });')
    && appSource.includes('settingsAutoIntegrationSyncRef')
    && appSource.includes("settingsTab !== 'integrations'")
    && appSource.includes('syncSettingsIntegrationReadiness();')
    && appSource.includes('SECRET_VAULT_ENABLED=true and SECRET_VAULT_KEY set before npm run agents:server')
    && appSource.includes('API fields are editable now, but Seal stays disabled until the backend Secret Vault is ready.')
    && appSource.includes('API field: editable / Seal:')
    && appSource.includes('requires backend Vault')
    && appSource.includes('The browser will not persist provider secrets.')
    && appSource.includes('API fields are editable, but backend provider status has not been synced. Start agents:server with Secret Vault env, then Sync status before sealing keys.')
    && !appSource.includes('Backend API missing')
    && !appSource.includes('backend API missing')
    && !appSource.includes('\u540e\u7aef API \u7f3a\u5931')
    && !appSource.includes('后端 API 缺失'),
  'Settings Keys must explain that API fields are user-enterable but cannot be sealed or persisted until the backend Vault is ready.',
);
for (const settingsInputTestId of [
  'settings-provider-model-key-input',
  'settings-provider-search-key-input',
  'settings-provider-search-endpoint-input',
]) {
  assertInputEditableByTestId(appSource, settingsInputTestId);
}
assert(
  appSource.includes('disabled={providerSecretDrafts.running || !settingsSecretVaultReady || !providerSecretDrafts.modelApiKey.trim()}')
    && appSource.includes('disabled={providerSecretDrafts.running || !settingsSecretVaultReady || !providerSecretDrafts.searchApiKey.trim()}')
    && appSource.includes('disabled={providerSecretDrafts.running || !settingsSecretVaultReady || !providerSecretDrafts.searchEndpoint.trim()}'),
  'Settings Keys must keep only Seal buttons gated by Secret Vault readiness while API fields remain typeable.',
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
    && appSource.includes('settingsAutoIntegrationSyncRef')
    && appSource.includes("settingsTab !== 'integrations'")
    && agentProjectServiceSource.includes('settingsIntegrationReadinessRoutes')
    && agentProjectServiceSource.includes('settingsIntegrationReadinessStatus')
    && agentProjectApiSource.includes("route.action === 'settings-integration-readiness'")
    && appSource.includes('Local evidence index, adapter gateway, MCP governance, budget alert, and error reporting readiness are backend routes')
    && appSource.includes('Backend route gaps:')
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
  appSource.includes('project-chat-create-transcript-channel')
    && appSource.includes("await runBackendProjectCommand('transcripts'")
    && appSource.includes('Backend transcript channel created')
    && appSource.includes('backend-channel-create-required')
    && appSource.includes('if (shouldAttemptBackendProjectWrite(activeProject))')
    && appSource.includes('syncBackendProjectTranscripts({ silent: true, projectId: activeProject.id, channelId: channel.id });')
    && appSource.includes('const backendChannelTranscriptRequired = Boolean(activeProject)')
    && appSource.includes('const backendChannelTranscriptUsable = Boolean(backendChannelTranscript) && (')
    && appSource.includes('project-chat-transcript-backend-required')
    && appSource.includes('This real backend project requires the channel transcript route before local messages can be shown as collaboration proof.')
    && appSource.includes(': (backendChannelTranscriptRequired ? [] : localVisibleMessages);')
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
  appSource.includes('const fallbackManagerScenarioTrail = {')
    && appSource.includes("schemaVersion: 'manager-scenario-trail/frontend-fallback'")
    && appSource.includes('const managerScenarioTrail = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-scenario-trail/v1'")
    && appSource.includes('manager-scenario-trail-backend-required')
    && appSource.includes('const managerScenarioTrailDisplayRows = (managerScenarioTrail.rows || []).map')
    && appSource.includes("managerReadModelSourceBadge(managerScenarioTrail, 'manager-scenario-trail-source')")
    && appSource.includes('managerScenarioTrailDisplayRows.map((row, index)')
    && mockRegister.includes('The main Dashboard Scenario Trail consumes `manager-scenario-trail/v1`')
    && mockRegister.includes('backend-or-allowed-fallback gate'),
  'Main Dashboard Scenario Trail must use backendOrAllowedFallback and show backend-model-missing for real backend projects instead of rendering local rows directly.',
);
assert(
  appSource.includes('const fallbackManagerRequirementMatrix = {')
    && appSource.includes("schemaVersion: 'manager-requirement-matrix/frontend-fallback'")
    && appSource.includes('const managerRequirementMatrix = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('manager-requirement-matrix/v1'")
    && appSource.includes('manager-requirement-matrix-backend-required')
    && appSource.includes('const managerRequirementMatrixDisplayRows = (managerRequirementMatrix.rows || []).map')
    && appSource.includes("managerReadModelSourceBadge(managerRequirementMatrix, 'manager-requirement-matrix-source')")
    && appSource.includes('managerRequirementMatrixDisplayRows.map((row, index)')
    && mockRegister.includes('the main Dashboard Requirement Matrix consumes `manager-requirement-matrix/v1`')
    && mockRegister.includes('backend-or-allowed-fallback gate'),
  'Main Dashboard Requirement Matrix must use backendOrAllowedFallback and show backend-model-missing for real backend projects instead of rendering local rows directly.',
);
assert(
  appSource.includes('const backendAgentManagementMesh = Array.isArray(backendManagerDashboard?.agents?.managementMesh)')
    && appSource.includes("schemaVersion: 'agent-management-mesh/frontend-fallback'")
    && appSource.includes('const agentManagementMesh = backendOrAllowedFallback(')
    && appSource.includes("missingBackendReadModel('agent-management-mesh/v1'")
    && appSource.includes("managerReadModelSourceBadge(agentManagementMesh, 'agent-management-mesh-source')")
    && appSource.includes('agentManagementMeshDisplayRows.map(row =>')
    && appSource.includes('const assignmentTimelineMatrix = backendOrAllowedFallback(')
    && appSource.includes("schemaVersion: 'assignment-timeline-matrix/frontend-fallback'")
    && appSource.includes("missingBackendReadModel('assignment-timeline-matrix/v1'")
    && appSource.includes("managerReadModelSourceBadge(assignmentTimelineMatrix, 'assignment-timeline-matrix-source')")
    && appSource.includes('const assignmentDerivedFrontendRowsAllowed = !assignmentTimelineMatrix.frontendMockSuppressed;')
    && appSource.includes('assignment-timeline-matrix-backend-required')
    && appSource.includes('Local assignment/work-progress rows are suppressed for this backend project.')
    && appSource.includes('assignmentDerivedFrontendRowsAllowed && assignmentFlowRows.length > 0')
    && appSource.includes('assignmentDerivedFrontendRowsAllowed && (')
    && appSource.includes('assignmentTimelineMatrixDisplayRows.map(row =>')
    && appSource.includes('const changeFlow = backendOrAllowedFallback(')
    && appSource.includes("schemaVersion: 'change-flow/frontend-fallback'")
    && appSource.includes("missingBackendReadModel('change-flow/v1'")
    && appSource.includes("managerReadModelSourceBadge(changeFlow, 'change-flow-source')")
    && appSource.includes('const changeDerivedFrontendRowsAllowed = !changeFlow.frontendMockSuppressed;')
    && appSource.includes('const changeSourceIntakeRows = changeFlowDisplayRows.flatMap')
    && appSource.includes('change-flow-backend-required')
    && appSource.includes('Local change/source-intake rows are suppressed for this backend project.')
    && appSource.includes('changeDerivedFrontendRowsAllowed && changeLedger.length > 0')
    && appSource.includes("managerReadModelSourceBadge(changeFlow, 'dual-channel-change-intake-source')")
    && appSource.includes('changeFlowDisplayRows.map(({ change, sourceName')
    && appSource.includes("schemaVersion: 'collaboration-health/frontend-fallback'")
    && appSource.includes("schemaVersion: 'collaboration-health/v1'")
    && appSource.includes("missingBackendReadModel('collaboration-health/v1'")
    && appSource.includes("managerReadModelSourceBadge(collaborationHealth, 'collaboration-health-source')")
    && appSource.includes('collaboration-health-backend-required')
    && appSource.includes('Local collaboration health is suppressed for this backend project.')
    && !appSource.includes('const governanceNetwork = createAgentNetwork(activeProject.team')
    && appSource.includes("schemaVersion: 'governance-protocol/frontend-fallback'")
    && appSource.includes("schemaVersion: 'governance-protocol/v1'")
    && appSource.includes("missingBackendReadModel('governance-protocol/v1'")
    && appSource.includes("managerReadModelSourceBadge(governanceProtocol, 'governance-protocol-source')")
    && appSource.includes('governance-protocol-backend-required')
    && appSource.includes('Local governance inference is suppressed for this backend project.')
    && appSource.includes("schemaVersion: 'event-ledger/frontend-fallback'")
    && appSource.includes("schemaVersion: 'event-ledger/v1'")
    && appSource.includes("schemaVersion: 'event-ledger/v1/missing-backend'")
    && appSource.includes("managerReadModelSourceBadge(eventLedgerReadModel, 'event-ledger-source')")
    && appSource.includes('event-ledger-backend-required')
    && appSource.includes('Local event-ledger rows are suppressed for this backend project.')
    && appSource.includes('eventLedgerDisplayRows.slice(-5).reverse().map(event =>')
    && appSource.includes('managerAutoTimelineEventSyncRef')
    && appSource.includes("!['dashboard', 'timeline'].includes(projectMode)")
    && appSource.includes('syncBackendTimelineAndEvents({ silent: true, projectId: activeProject.id })')
    && appSource.includes("schemaVersion: 'agent-state-summary/frontend-fallback'")
    && appSource.includes("schemaVersion: 'agent-state-summary/v1'")
    && appSource.includes("missingBackendReadModel('agent-state-summary/v1'")
    && appSource.includes("managerReadModelSourceBadge(agentStateSummary, 'agent-state-summary-source')")
    && appSource.includes("managerReadModelSourceBadge(agentStateSummary, 'fixed-work-routines-source')")
    && appSource.includes('agent-state-summary-backend-required')
    && appSource.includes('fixed-work-routines-backend-required')
    && appSource.includes('Local Agent state rows are suppressed for this backend project.')
    && appSource.includes('Local fixed-routine rows are suppressed for this backend project.')
    && appSource.includes("schemaVersion: 'continuous-work-loop/frontend-fallback'")
    && appSource.includes("schemaVersion: 'continuous-work-loop/v1'")
    && appSource.includes("missingBackendReadModel('continuous-work-loop/v1'")
    && appSource.includes("managerReadModelSourceBadge(continuousWorkLoop, 'continuous-work-loop-source')")
    && appSource.includes('continuous-work-loop-backend-required')
    && appSource.includes('Local loop rows are suppressed for this backend project.')
    && mockRegister.includes('Agent Management Mesh, Assignment Timeline Matrix, and Change Resolution Matrix now consume Manager Dashboard backend rows')
    && mockRegister.includes('suppresses the local assignment-flow and work-progress rows')
    && mockRegister.includes('suppresses local change/source-intake rows')
    && mockRegister.includes('The main `Collaboration Health` score now also consumes this backend diagnostic model')
    && mockRegister.includes('Governance & Speech Protocol now reads Leader/Reviewer from `governance-protocol/v1`')
    && mockRegister.includes('Unified Event Ledger now consumes backend `/events` rows as `event-ledger/v1`')
    && mockRegister.includes('Opening a backend-backed Manager Dashboard or Manager Flow Graph view now automatically syncs `/timeline` and `/events`')
    && mockRegister.includes('24/7 Operations Board, Continuous Work Loop, and Fixed Work Routines now consume backend Agent state rows')
    && mockRegister.includes('agent-management-mesh/v1')
    && mockRegister.includes('assignment-timeline-matrix/v1')
    && mockRegister.includes('change-flow/v1'),
  'Manager coordination panels must prefer Manager Dashboard backend rows and expose backend-required source badges instead of silently rendering local derivations.',
);
assert(
  appSource.includes('const buildManagerProofMapRows = (checks = []) => checks.map')
    && appSource.includes("schemaVersion: 'manager-proof-map/frontend-fallback'")
    && appSource.includes('const backendManagerProofMap = backendReadinessProofMap?.readiness?.checks?.length')
    && appSource.includes("schemaVersion: 'manager-proof-map/v1'")
    && appSource.includes("missingBackendReadModel('manager-proof-map/v1'")
    && appSource.includes('manager-proof-map-backend-required')
    && appSource.includes("managerReadModelSourceBadge(managerProofMap, 'manager-proof-map-source')")
    && appSource.includes("managerReadModelSourceBadge(managerProofMap, 'manager-scenario-readiness-source')")
    && appSource.includes('manager-scenario-readiness-backend-required')
    && appSource.includes('Local scenario readiness is suppressed for this backend project.')
    && appSource.includes('const managerReadinessDisplayChecks = managerProofMapDisplayRows.map(row => row.check).filter(Boolean);')
    && appSource.includes('managerProofMapDisplayRows.map(row =>')
    && mockRegister.includes('Manager Proof Map now consumes backend `/readiness-proof-map` readiness checks')
    && mockRegister.includes('Manager Scenario Readiness panel now reads the same `manager-proof-map/v1` model')
    && mockRegister.includes('manager-proof-map/v1'),
  'Manager Proof Map must prefer backend readiness checks from /readiness-proof-map and show backend-required state for real projects.',
);
assert(
  appSource.includes('const showSampleFixturePath = isManagerDemoProject(activeProject) || isDevelopmentLocalRuntimeFallbackEnabled();')
    && appSource.includes('{showSampleFixturePath && (')
    && mockRegister.includes('Sample Fixture Path is hidden for real backend projects'),
  'Real backend projects must not show the Manager Demo Sample Fixture Path inside the project dashboard.',
);
assert(
  appSource.includes('legacy-timeline-actions-backend-required')
    && appSource.includes('Backend timeline action route required before comments, completion, or edits can create proof.')
    && !appSource.includes("timelineText('Add comment...')")
    && !appSource.includes("timelineText('Jump To Chat')")
    && !appSource.includes("timelineText('Mark Complete')")
    && !appSource.includes("timelineText('Edit')")
    && mockRegister.includes('Legacy Timeline detail no longer renders no-op comment, chat jump, completion, or edit controls'),
  'Legacy Timeline detail must not expose no-op comment, chat jump, completion, or edit controls that imply backend proof was written.',
);
assert(
  appSource.includes('const canSeedActiveProjectSnapshotToBackend = (project = activeProject)')
    && appSource.includes('isManagerDemoProject(project)')
    && appSource.includes('isDevelopmentLocalRuntimeFallbackEnabled()')
    && appSource.includes('if (!canSeedActiveProjectSnapshotToBackend(activeProject))')
    && appSource.includes('Browser snapshot seeding is disabled for real backend projects.')
    && appSource.includes('Seed Sample/Dev')
    && appSource.includes('Sample/dev snapshot seed only; real projects save through backend receipt routes.')
    && !appSource.includes('Save Project')
    && appSource.includes('disabled={backendStation.loading || !canSeedActiveProjectSnapshotToBackend(activeProject)}')
    && appSource.includes('Backend project missing; local seed suppressed')
    && appSource.includes('Backend project not found after prior sync; local snapshot reseeding is suppressed.')
    && appSource.includes('Backend project not found; local snapshot seeding is disabled for real projects.'),
  'Real backend projects must fail closed instead of saving or reseeding browser snapshots over backend receipt ledgers.',
);
assert(
  appSource.includes('const isBackendManagedBrowserCacheProject = (project = {})')
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
    && appSource.includes('const canPersistProjectToBrowserCache = (project = {})')
    && appSource.includes('!isBackendManagedRealProject(project)')
    && appSource.includes('const isUnscopedProofLikeChatMessage = (message = {})')
    && appSource.includes('CHAT_PROOF_ID_PATTERN.test(messageId)')
    && appSource.includes('const canPersistChatMessageToBrowserCache = (message = {}, projectById = new Map())')
    && appSource.includes('if (projectId === DEFAULT_CHAT_PROJECT_ID) return !isUnscopedProofLikeChatMessage(message);')
    && appSource.includes('return canPersistProjectToBrowserCache(project) && !isManagerDemoMessage(message);')
    && appSource.includes('const browserCacheProjects = projects.filter(canPersistProjectToBrowserCache);')
    && appSource.includes('const browserCacheMessages = chatMessages')
    && appSource.includes('.filter(message => canPersistChatMessageToBrowserCache(message, projectById))'),
  'Browser project/chat cache must exclude backend-managed real projects on both load and write paths.',
);
assert(
  appSource.includes('const shouldAttemptAgentDashboardSync = Boolean(projectId && agentId) && (')
    && appSource.includes('shouldAttemptBackendProjectWrite(dashboardProject || { id: projectId })')
    && appSource.includes('projectHasBackendSyncEvidence(dashboardProject || { id: projectId })')
    && appSource.includes('if (!shouldAttemptBackendProjectWrite(activeProject)) return;')
    && appSource.includes('if (!selectedAgentFocusId || !shouldAttemptBackendProjectWrite(activeProject)) return;')
    && appSource.includes('await Promise.allSettled(uniqueAgentIds.map(agentId => (')
    && appSource.includes('syncBackendAgentDashboard(agentId, { silent: true, projectId: targetProjectId })')
    && !appSource.includes("if (!projectId || !agentId || backendStation.connectionStatus !== 'online') return null;")
    && !appSource.includes("if (!selectedAgentFocusId || backendStation.connectionStatus !== 'online') return;")
    && !appSource.includes('uniqueAgentIds.forEach(agentId => {\n      if (agentId) setTimeout(() => syncBackendAgentDashboard(agentId, { silent: true, projectId: targetProjectId }), 0);')
    && mockRegister.includes('Agent Dashboard sync and page-entry Flow Graph/Agent Focus refreshes now attempt the backend when a project has backend sync evidence or should use backend write routes')
    && mockRegister.includes('Mission approval and autonomy refresh now wait for the requested Agent Dashboard reads with `Promise.allSettled`'),
  'Agent Dashboard sync must not depend solely on stale UI online status for real backend projects.',
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
    && appSource.includes('Backend meeting failed; local fallback disabled for backend-online project; draft restored')
    && appSource.includes('Backend meeting returned no Agent turns; local simulation blocked; draft restored')
    && mockRegister.includes('restore the unsent draft'),
  'Real backend project chat and meeting failures must restore unsent drafts instead of creating mock proof or discarding user input.',
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
  appSource.includes('BACKEND MEETING RECORDED; AGENT TURNS MISSING. DIRECTIVE RESTORED.')
    && appSource.includes('BACKEND MEETING WRITE FAILED. DIRECTIVE RESTORED.')
    && appSource.includes('BACKEND MEETING CLOSE FAILED. SESSION REMAINS OPEN.')
    && appSource.includes('setTerminalInput(val);')
    && !appSource.includes("if (!allowFallback) {\n          closeMeetingUi();\n          return;\n        }"),
  'War Room backend-required meeting failures must restore user input or keep the session open instead of looking like successful local proof.',
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
