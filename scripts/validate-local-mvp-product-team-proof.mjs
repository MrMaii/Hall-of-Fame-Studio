import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptsDir, '..');

const checks = [
  {
    label: 'Settings and local MVP startup readiness contracts',
    script: 'validate-settings-contracts.mjs',
  },
  {
    label: 'Research-as-sample generic product-team chain',
    script: 'validate-research-sample-product-team-gate.mjs',
  },
  {
    label: 'Product Team Mission Runner startup and C/A handoff',
    script: 'validate-mission-runner-startup-http.mjs',
  },
  {
    label: 'Marketplace Agent contract roster and proof route',
    script: 'validate-agent-contract-contract.mjs',
  },
  {
    label: 'Agent Workbench evidence, artifact, review, revision, and final delivery proof',
    script: 'validate-agent-workbench-contract.mjs',
  },
  {
    label: 'MVP readiness operator action to A-side output',
    script: 'validate-mvp-readiness-operator-actions.mjs',
  },
  {
    label: 'Zero-to-autonomy operator report and proof package',
    script: 'validate-real-user-zero-to-autonomy-report.mjs',
  },
  {
    label: 'Private MVP launch package and public-production no-go boundary',
    script: 'validate-private-mvp-launch-package.mjs',
  },
  {
    label: 'Launch Operations Private MVP package visibility',
    script: 'validate-launch-operations-private-mvp-package.mjs',
  },
];

function runCheck({ label, script }) {
  console.log(`[local-mvp-product-team] ${label}`);
  const result = spawnSync(process.execPath, [resolve(scriptsDir, script)], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      HOFS_PROGRESS: process.env.HOFS_PROGRESS || '0',
    },
  });

  if (result.error) throw result.error;
  if (result.signal) throw new Error(`${label} ended by ${result.signal}.`);
  if (result.status !== 0) throw new Error(`${label} failed with status ${result.status}.`);
}

for (const check of checks) {
  runCheck(check);
}

console.log('Local MVP product-team proof validation passed.');
