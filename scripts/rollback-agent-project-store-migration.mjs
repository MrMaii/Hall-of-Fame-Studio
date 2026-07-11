import {
  getAgentProjectFileStoreMigrationStatus,
  rollbackAgentProjectFileStoreMigration,
} from '../src/agents/agentProjectFileStore.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

const filePath = argument('--store');
if (!filePath) {
  console.error('Usage: node scripts/rollback-agent-project-store-migration.mjs --store <path> [--execute --migration-id <id>]');
  process.exit(2);
}

if (!process.argv.includes('--execute')) {
  console.log(JSON.stringify({ mode: 'dry-run', ...getAgentProjectFileStoreMigrationStatus({ filePath }) }, null, 2));
  process.exit(0);
}

const expectedMigrationId = argument('--migration-id');
if (!expectedMigrationId) {
  console.error('--execute requires --migration-id <id>.');
  process.exit(2);
}

const result = rollbackAgentProjectFileStoreMigration({ filePath, expectedMigrationId });
console.log(JSON.stringify({ mode: 'executed', migrationTransaction: result }, null, 2));
