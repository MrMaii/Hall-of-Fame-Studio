import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const acceptanceTests = [
  'tests/outcomeDrivenExecution.test.mjs',
  'tests/outcomeDrivenAgentWorkCycle.test.mjs',
  'tests/outcomeDrivenResearchExecution.test.mjs',
  'tests/outcomeGeneralExecution.test.mjs',
  'tests/outcomeArtifactQuality.test.mjs',
  'tests/outcomeReadinessAndProgress.test.mjs',
  'tests/outcomeScheduler.test.mjs',
  'tests/localArtifactContentAddressing.test.mjs',
  'tests/localRuntimeErrorRegistry.test.mjs',
  'tests/modelProvider.test.mjs',
  'tests/modelLanguagePolicy.test.mjs',
  'tests/searchProvider.test.mjs',
];

console.log('Outcome runtime acceptance: research, technical delivery, creative, operations, provider, scheduler, and artifact gates.');

const result = spawnSync(process.execPath, ['--test', ...acceptanceTests], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('Outcome runtime acceptance passed: activity cannot substitute for accepted material delivery.');
