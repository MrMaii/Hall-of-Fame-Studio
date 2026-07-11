import { createAgentProjectFileStore } from '../src/agents/agentProjectFileStore.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

const filePath = argument('--store');
const expectedCheckpointId = argument('--checkpoint-id');
const operationId = argument('--operation-id') || `audit-recovery-${Date.now()}`;
if (!filePath || !expectedCheckpointId) {
  console.error('Usage: node scripts/recover-local-security-audit.mjs --store <path> --checkpoint-id <id> [--operation-id <id>] [--execute]');
  process.exit(2);
}

const store = createAgentProjectFileStore({ filePath });
const result = store.recoverSecurityAuditLog({
  expectedCheckpointId,
  operationId,
  execute: process.argv.includes('--execute'),
});
console.log(JSON.stringify(result, null, 2));
