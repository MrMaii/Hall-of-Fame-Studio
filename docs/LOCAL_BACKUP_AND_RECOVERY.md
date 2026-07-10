# Local backup and recovery

Hall of Fame Studio can make an encrypted, local-only recovery bundle for the project store, security audit log, local users, vault records, local runtime settings, and workspace artifacts. The bundle uses AES-256-GCM with a key derived locally from `HOFS_LOCAL_RECOVERY_PASSPHRASE`; it never sends data, credentials, prompts, or recovery metadata to a cloud service.

Choose a backup location outside the working disk when possible. The default `.tmp/local-recovery-backups` is convenient for a recovery drill but is not a disaster-recovery location.

```powershell
$env:HOFS_LOCAL_RECOVERY_PASSPHRASE = 'use-a-long-unique-passphrase-stored-offline'
$env:HOFS_LOCAL_RECOVERY_BACKUP_DIR = 'E:\HallOfFameBackups'
npm run local:backup
```

The command prints a bundle path. Do not put the passphrase on a command line, in a source file, or in a project note.

Before an in-place restore, stop `npm run dev`. Then explicitly acknowledge that the verified bundle will overwrite the captured local runtime files:

```powershell
$env:HOFS_LOCAL_RECOVERY_PASSPHRASE = 'use-the-same-offline-passphrase'
$env:HOFS_LOCAL_RECOVERY_BUNDLE = 'E:\HallOfFameBackups\hofs-local-recovery-....json.enc'
$env:HOFS_LOCAL_RECOVERY_CONFIRM = 'RESTORE_LOCAL_RUNTIME'
npm run local:restore
```

Every file is authenticated before it is written. A wrong passphrase, malformed bundle, missing destination, invalid relative path, or checksum mismatch stops the restore. Each target file is replaced atomically with the same Windows lock retry behavior as the project store. A multi-file restore is intentionally reported as `verified-overwrite`: stop the local server first, and retain the encrypted bundle until a new startup verification succeeds.

Run `npm run local:recovery:drill` to execute an isolated backup, simulated corruption, and restoration test. It only creates and removes a temporary test runtime.
