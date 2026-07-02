import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] || 'check';
const dependencyRoot = resolve(dirname(process.execPath), '..', '..');
const homeDir = process.env.USERPROFILE || process.env.HOME || '';
const codexDependencyRoot = homeDir
  ? resolve(homeDir, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies')
  : '';

const pythonCandidates = [
  process.env.PYTHON,
  resolve(dependencyRoot, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python'),
  codexDependencyRoot
    ? resolve(codexDependencyRoot, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python')
    : '',
  'python3',
  'python',
].filter(Boolean);

const isPathCandidate = (candidate) => (
  isAbsolute(candidate)
  || candidate.includes('/')
  || candidate.includes('\\')
  || candidate.includes(sep)
);

const canRunPython = (candidate) => {
  if (isPathCandidate(candidate) && !existsSync(candidate)) return false;
  const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
};

const python = pythonCandidates.find(canRunPython);

if (!python) {
  console.error('Unable to locate Python. Set PYTHON=/path/to/python or use the bundled Codex runtime.');
  process.exit(1);
}

const tasks = {
  validate: 'skills/hall-of-fame-personas/scripts/validate_personas.py',
  compile: 'skills/hall-of-fame-personas/scripts/compile_registry.py',
  package: 'skills/hall-of-fame-personas/scripts/package_dist.py',
  audit: 'skills/hall-of-fame-personas/scripts/privatize_audit.py',
  regression: 'skills/hall-of-fame-personas/scripts/regression_check.py',
  dist: 'skills/hall-of-fame-personas/scripts/run_pipeline.py',
};

const selectedTasks = mode === 'check'
  ? [tasks.validate, tasks.regression]
  : tasks[mode]
    ? [tasks[mode]]
    : [];

if (!selectedTasks.length) {
  console.error(`Unknown persona skill check mode: ${mode}`);
  process.exit(1);
}

for (const task of selectedTasks) {
  const result = spawnSync(python, [task], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
    },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
