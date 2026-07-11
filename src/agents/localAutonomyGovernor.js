import { portableSha256Hex } from './accessControl.js';

const COMMAND_TARGETS = { pause: ['active', 'paused'], resume: ['paused', 'active'], stop: ['active', 'stopped'], 'stop-paused': ['paused', 'stopped'] };

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

export function localAutonomyChecksum(value) {
  return portableSha256Hex(JSON.stringify(canonicalize(value)));
}

function id(value, field, optional = false) {
  const text = String(value || '').trim();
  if (!text && optional) return null;
  if (!text || text.length > 180 || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+\-]*$/.test(text)) throw new Error(`autonomy-governor-${field}-invalid`);
  return text;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ''));
  if (!Number.isFinite(parsed)) throw new Error(`autonomy-governor-${field}-invalid`);
  return new Date(parsed).toISOString();
}

function integer(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`autonomy-governor-${field}-invalid`);
  return number;
}

export function createLocalAutonomyPolicy({
  projectId, version = 1, previousPolicyId = null, previousPolicyChecksum = null,
  maxWallClockMs, maxSteps, maxCostCents, maxToolInvocations, allowedToolOperations = [],
  governanceStartedAt = null, actorId, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  const createdAt = iso(now, 'created-at');
  const normalizedVersion = integer(version, 'version', 1, 10_000);
  const previousId = id(previousPolicyId, 'previous-policy-id', true);
  const previousChecksum = previousPolicyChecksum ? String(previousPolicyChecksum).toLowerCase() : null;
  if ((normalizedVersion === 1 && (previousId || previousChecksum))
    || (normalizedVersion > 1 && (!previousId || !/^[a-f0-9]{64}$/.test(previousChecksum || '')))) throw new Error('autonomy-governor-policy-link-invalid');
  const operations = [...new Set((Array.isArray(allowedToolOperations) ? allowedToolOperations : []).map((item) => id(item, 'tool-operation')))].sort();
  if (operations.length > 32) throw new Error('autonomy-governor-tool-operation-limit');
  const normalized = {
    projectId: id(projectId, 'project-id'), version: normalizedVersion,
    previousPolicyId: previousId, previousPolicyChecksum: previousChecksum,
    governanceStartedAt: governanceStartedAt ? iso(governanceStartedAt, 'governance-started-at') : createdAt,
    maxWallClockMs: integer(maxWallClockMs, 'max-wall-clock-ms', 15 * 60_000, 30 * 24 * 60 * 60_000),
    maxSteps: integer(maxSteps, 'max-steps', 1, 10_000),
    maxCostCents: integer(maxCostCents, 'max-cost-cents', 0, 1_000_000),
    maxToolInvocations: integer(maxToolInvocations, 'max-tool-invocations', 0, 10_000),
    allowedToolOperations: operations,
    actorId: id(actorId, 'actor-id'), idempotencyKey: id(idempotencyKey, 'idempotency-key'),
  };
  const base = {
    schemaVersion: 'local-autonomy-policy/v1',
    id: `autonomy_policy_${localAutonomyChecksum(`${normalized.projectId}:${normalized.version}:${normalized.idempotencyKey}`).slice(0, 28)}`,
    ...normalized, storesRawContent: false, createdAt,
  };
  return { ...base, checksum: localAutonomyChecksum(base) };
}

export function verifyLocalAutonomyPolicy(policy = {}, previous = null) {
  const { checksum, ...base } = policy;
  const checksumValid = Boolean(checksum) && checksum === localAutonomyChecksum(base);
  const schemaValid = policy.schemaVersion === 'local-autonomy-policy/v1';
  const linkValid = policy.version === 1
    ? !policy.previousPolicyId && !policy.previousPolicyChecksum
    : Boolean(previous && policy.version === previous.version + 1 && policy.previousPolicyId === previous.id && policy.previousPolicyChecksum === previous.checksum);
  return { valid: checksumValid && schemaValid && linkValid, checksumValid, schemaValid, linkValid };
}

export function createLocalAutonomyCommand({
  policy, fromState, command, expectedPolicyVersion, expectedPolicyChecksum,
  actorId, reasonCode, idempotencyKey, now = new Date().toISOString(),
} = {}) {
  if (!verifyLocalAutonomyPolicy(policy, null).valid && policy.version === 1) throw new Error('autonomy-governor-policy-integrity-invalid');
  if (Number(expectedPolicyVersion) !== policy.version || String(expectedPolicyChecksum) !== policy.checksum) throw new Error('autonomy-governor-stale-policy');
  const normalizedCommand = String(command || '').trim();
  const state = String(fromState || '').trim();
  if (state === 'stopped') throw new Error('autonomy-governor-terminal-stop');
  const transitionKey = normalizedCommand === 'stop' && state === 'paused' ? 'stop-paused' : normalizedCommand;
  const transition = COMMAND_TARGETS[transitionKey];
  if (!transition || transition[0] !== state) throw new Error('autonomy-governor-command-transition-invalid');
  const createdAt = iso(now, 'command-at');
  const normalizedIdempotencyKey = id(idempotencyKey, 'idempotency-key');
  const base = {
    schemaVersion: 'local-autonomy-command/v1',
    id: `autonomy_command_${localAutonomyChecksum(`${policy.id}:${normalizedIdempotencyKey}`).slice(0, 28)}`,
    projectId: policy.projectId, policyId: policy.id, policyVersion: policy.version, policyChecksum: policy.checksum,
    command: normalizedCommand, fromState: state, toState: transition[1], actorId: id(actorId, 'actor-id'),
    reasonCode: id(reasonCode, 'reason-code'), idempotencyKey: normalizedIdempotencyKey,
    storesRawContent: false, createdAt,
  };
  return { ...base, checksum: localAutonomyChecksum(base) };
}

export function verifyLocalAutonomyCommand(command = {}, policy = {}) {
  const { checksum, ...base } = command;
  const checksumValid = Boolean(checksum) && checksum === localAutonomyChecksum(base);
  const linkValid = command.schemaVersion === 'local-autonomy-command/v1'
    && command.policyId === policy.id && command.policyVersion === policy.version && command.policyChecksum === policy.checksum;
  return { valid: checksumValid && linkValid, checksumValid, linkValid };
}

function usageSince(project, policy) {
  const start = Date.parse(policy.governanceStartedAt);
  const after = (row, fields) => fields.some((field) => Number.isFinite(Date.parse(row?.[field])) && Date.parse(row[field]) >= start);
  return {
    steps: (project.autonomousRunControlSessionTickLedger || []).filter((row) => after(row, ['completedAt', 'tickedAt'])).reduce((sum, row) => sum + (Number(row.stepCount) || 0), 0),
    costCents: (project.providerUsageLedger || []).filter((row) => after(row, ['completedAt', 'startedAt', 'createdAt'])).reduce((sum, row) => sum + (Number(row.costCents) || 0), 0),
    toolInvocations: (project.toolInvocationReceipts || []).filter((row) => after(row, ['createdAt', 'completedAt', 'startedAt'])).length,
  };
}

export function buildLocalAutonomyGovernor({ project = {}, now = new Date().toISOString() } = {}) {
  const generatedAt = iso(now, 'generated-at');
  const policies = [...(project.localAutonomyPolicies || [])].sort((a, b) => a.version - b.version);
  if (!policies.length) return {
    schemaVersion: 'local-autonomy-governor/v1', projectId: id(project.id, 'project-id'), generatedAt,
    status: 'policy-required', state: 'unconfigured', policy: null, usage: { steps: 0, costCents: 0, toolInvocations: 0 },
    denialReasonCodes: ['autonomy-policy-required'], integrity: { valid: true, policyRows: [], commandRows: [] }, readyForLocalMvp: false, readyForProduction: false,
  };
  const policyById = new Map(policies.map((row) => [row.id, row]));
  const policyRows = policies.map((policy, index) => ({ id: policy.id, ...verifyLocalAutonomyPolicy(policy, index ? policies[index - 1] : null) }));
  const commands = [...(project.localAutonomyCommands || [])].reverse().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const commandRows = commands.map((command) => ({ id: command.id, ...verifyLocalAutonomyCommand(command, policyById.get(command.policyId) || {}) }));
  let state = 'active';
  const transitionInvalidIds = [];
  for (const command of commands) {
    if (command.fromState !== state || (state === 'stopped')) transitionInvalidIds.push(command.id);
    else state = command.toState;
  }
  const policy = policies.at(-1);
  const usage = usageSince(project, policy);
  const elapsedMs = Math.max(0, Date.parse(generatedAt) - Date.parse(policy.governanceStartedAt));
  const exhausted = [
    elapsedMs > policy.maxWallClockMs ? 'duration-limit-exceeded' : null,
    usage.steps >= policy.maxSteps ? 'step-limit-exceeded' : null,
    usage.costCents > policy.maxCostCents ? 'cost-limit-exceeded' : null,
    usage.toolInvocations > policy.maxToolInvocations ? 'tool-invocation-limit-exceeded' : null,
  ].filter(Boolean);
  const integrityValid = policyRows.every((row) => row.valid) && commandRows.every((row) => row.valid) && !transitionInvalidIds.length;
  return {
    schemaVersion: 'local-autonomy-governor/v1', projectId: project.id, generatedAt,
    status: !integrityValid ? 'degraded-integrity-invalid' : state === 'stopped' ? 'stopped' : state === 'paused' ? 'paused' : exhausted.length ? 'limit-exhausted' : 'active',
    state, policy, usage: { ...usage, elapsedMs }, denialReasonCodes: exhausted,
    remaining: {
      steps: Math.max(0, policy.maxSteps - usage.steps), costCents: Math.max(0, policy.maxCostCents - usage.costCents),
      toolInvocations: Math.max(0, policy.maxToolInvocations - usage.toolInvocations), wallClockMs: Math.max(0, policy.maxWallClockMs - elapsedMs),
    },
    integrity: { valid: integrityValid, transitionInvalidIds, policyRows, commandRows },
    readyForLocalMvp: integrityValid, readyForProduction: false,
  };
}

export function evaluateLocalAutonomyExecution({ project = {}, now = new Date().toISOString(), request = {} } = {}) {
  const governor = buildLocalAutonomyGovernor({ project, now });
  if (!governor.policy) return { allowed: true, legacyCompatible: true, reasonCodes: [], governor, projected: governor.usage };
  const projected = {
    steps: governor.usage.steps + Math.max(0, Number(request.requestedSteps) || 0),
    costCents: governor.usage.costCents + Math.max(0, Number(request.estimatedCostCents) || 0),
    toolInvocations: governor.usage.toolInvocations + (Array.isArray(request.toolOperations) ? request.toolOperations.length : 0),
  };
  const tools = Array.isArray(request.toolOperations) ? request.toolOperations : [];
  const reasonCodes = [
    !governor.integrity.valid ? 'autonomy-governor-integrity-invalid' : null,
    governor.state === 'paused' ? 'autonomy-paused' : null,
    governor.state === 'stopped' ? 'autonomy-stopped' : null,
    governor.usage.elapsedMs > governor.policy.maxWallClockMs ? 'duration-limit-exceeded' : null,
    projected.steps > governor.policy.maxSteps ? 'step-limit-exceeded' : null,
    projected.costCents > governor.policy.maxCostCents ? 'cost-limit-exceeded' : null,
    projected.toolInvocations > governor.policy.maxToolInvocations ? 'tool-invocation-limit-exceeded' : null,
    tools.some((tool) => !governor.policy.allowedToolOperations.includes(tool)) ? 'tool-operation-not-allowed' : null,
  ].filter(Boolean);
  return { allowed: reasonCodes.length === 0, legacyCompatible: false, reasonCodes, governor, projected };
}
