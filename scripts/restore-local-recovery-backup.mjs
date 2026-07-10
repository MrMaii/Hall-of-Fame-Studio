import { resolve } from 'node:path';
import { restoreLocalRecoveryBundle } from '../src/agents/localRecoveryBundle.js';
import { localRecoveryDestinations, workspaceRoot } from './local-recovery-paths.mjs';

if (process.env.HOFS_LOCAL_RECOVERY_CONFIRM !== 'RESTORE_LOCAL_RUNTIME') {
  throw new Error('Set HOFS_LOCAL_RECOVERY_CONFIRM=RESTORE_LOCAL_RUNTIME after stopping the local server before restoring.');
}
const bundle = String(process.env.HOFS_LOCAL_RECOVERY_BUNDLE || '').trim();
if (!bundle) throw new Error('Set HOFS_LOCAL_RECOVERY_BUNDLE to the encrypted bundle path.');
const result = restoreLocalRecoveryBundle({
  bundlePath: resolve(workspaceRoot, bundle),
  passphrase: process.env.HOFS_LOCAL_RECOVERY_PASSPHRASE || '',
  destinations: localRecoveryDestinations(process.env),
});
console.log(JSON.stringify(result, null, 2));
