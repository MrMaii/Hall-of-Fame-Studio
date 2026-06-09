import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const filePath = process.env.AGENT_PROJECT_STORE || new URL('../.tmp/agent-project-store.json', import.meta.url);
const defaultArtifactRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/agent-artifacts');
const artifactRoot = resolve(process.env.AGENT_ARTIFACT_ROOT || defaultArtifactRoot);
const port = Number(process.env.AGENT_PROJECT_PORT || 8787);
const host = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const autonomousSchedulerEnabled = /^(1|true|yes)$/i.test(process.env.AGENT_AUTONOMOUS_SCHEDULER || '');
const autonomousSchedulerIntervalMs = Number(process.env.AGENT_AUTONOMOUS_INTERVAL_MS || 60_000);

const httpServer = createAgentProjectHttpServer({
  filePath,
  artifactWriter: (artifact) => {
    const relativePath = artifact.relativePath || artifact.path || `${artifact.id}.md`;
    const absolutePath = resolve(artifactRoot, relativePath);
    if (!absolutePath.startsWith(artifactRoot)) {
      throw new Error(`Artifact path escapes artifact root: ${relativePath}`);
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, artifact.content || '', 'utf8');
    return {
      absolutePath,
      path: absolutePath,
      relativePath,
      url: `file://${absolutePath.replace(/\\/g, '/')}`,
    };
  },
  autonomousScheduler: {
    enabled: autonomousSchedulerEnabled,
    intervalMs: autonomousSchedulerIntervalMs,
    runImmediately: autonomousSchedulerEnabled,
  },
});
const runtime = await httpServer.listen({ port, host });

console.log(`Agent project backend listening on ${runtime.url}`);
console.log(`Store: ${httpServer.api.store.filePath}`);
console.log(`Artifacts: ${artifactRoot}`);
console.log(`Autonomous scheduler: ${autonomousSchedulerEnabled ? `enabled every ${autonomousSchedulerIntervalMs}ms` : 'disabled'}`);

const shutdown = async () => {
  await httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
