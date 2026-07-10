import { resolve } from 'node:path';
import { createLocalRecoveryBundle } from '../src/agents/localRecoveryBundle.js';
import { localRecoverySources, workspaceRoot } from './local-recovery-paths.mjs';

const passphrase = process.env.HOFS_LOCAL_RECOVERY_PASSPHRASE || '';
const backupDirectory = resolve(workspaceRoot, process.env.HOFS_LOCAL_RECOVERY_BACKUP_DIR || '.tmp/local-recovery-backups');
const result = createLocalRecoveryBundle({
  backupDirectory,
  sources: localRecoverySources(process.env),
  passphrase,
});
console.log(JSON.stringify(result, null, 2));
