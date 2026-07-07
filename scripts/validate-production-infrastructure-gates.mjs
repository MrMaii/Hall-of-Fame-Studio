import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const tasks = [
  {
    label: 'launch readiness gate matrix',
    script: 'scripts/validate-launch-readiness-gates.mjs',
  },
  {
    label: 'public production startup readiness blockers',
    script: 'scripts/validate-public-production-startup-readiness-contract.mjs',
  },
  {
    label: 'redacted public production operator report',
    script: 'scripts/validate-public-production-readiness-report.mjs',
  },
  {
    label: 'real managed environment preflight',
    script: 'scripts/validate-managed-environment-preflight.mjs',
  },
  {
    label: 'shared adapter gateway contract',
    script: 'scripts/validate-adapter-gateway-contract.mjs',
  },
  {
    label: 'reference private adapter gateway server',
    script: 'scripts/validate-adapter-gateway-server.mjs',
  },
  {
    label: 'Agent HTTP server through env-configured adapter gateway',
    script: 'scripts/validate-adapter-gateway-http-mode.mjs',
  },
  {
    label: 'Postgres-compatible gateway storage boundary',
    script: 'scripts/validate-adapter-gateway-postgres-store.mjs',
  },
  {
    label: 'managed infrastructure cutover attestations',
    script: 'scripts/validate-managed-infrastructure-cutover-attestations.mjs',
  },
];

for (const task of tasks) {
  console.log(`[launch:infra] ${task.label}`);
  const result = spawnSync(process.execPath, [task.script], {
    cwd: repoRoot,
    env: {
      ...process.env,
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Production infrastructure gate rehearsal passed.');
