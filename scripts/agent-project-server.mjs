import { createAgentProjectHttpServer } from '../src/agents/agentProjectHttpServer.js';

const filePath = process.env.AGENT_PROJECT_STORE || new URL('../.tmp/agent-project-store.json', import.meta.url);
const port = Number(process.env.AGENT_PROJECT_PORT || 8787);
const host = process.env.AGENT_PROJECT_HOST || '127.0.0.1';
const autonomousSchedulerEnabled = /^(1|true|yes)$/i.test(process.env.AGENT_AUTONOMOUS_SCHEDULER || '');
const autonomousSchedulerIntervalMs = Number(process.env.AGENT_AUTONOMOUS_INTERVAL_MS || 60_000);

const httpServer = createAgentProjectHttpServer({
  filePath,
  autonomousScheduler: {
    enabled: autonomousSchedulerEnabled,
    intervalMs: autonomousSchedulerIntervalMs,
    runImmediately: autonomousSchedulerEnabled,
  },
});
const runtime = await httpServer.listen({ port, host });

console.log(`Agent project backend listening on ${runtime.url}`);
console.log(`Store: ${httpServer.api.store.filePath}`);
console.log(`Autonomous scheduler: ${autonomousSchedulerEnabled ? `enabled every ${autonomousSchedulerIntervalMs}ms` : 'disabled'}`);

const shutdown = async () => {
  await httpServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
