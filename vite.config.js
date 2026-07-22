import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function localRuntimeStatusPlugin() {
  const statusPath = resolve(process.env.AGENT_LOCAL_RUNTIME_STATUS_FILE || '.tmp/local-runtime-status.json');
  return {
    name: 'hofs-local-runtime-status',
    configureServer(server) {
      server.middlewares.use('/__hofs/local-runtime-status', (_request, response) => {
        response.setHeader('content-type', 'application/json; charset=utf-8');
        if (!existsSync(statusPath)) {
          response.statusCode = 503;
          response.end(JSON.stringify({
            schemaVersion: 'local-runtime-status/v1',
            backend: { status: 'unknown', failure: null },
            ui: { status: 'running' },
            message: '尚未取得本地服务状态。',
            recoveryActions: [],
          }));
          return;
        }
        response.end(readFileSync(statusPath, 'utf8'));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localRuntimeStatusPlugin()],
  server: {
    watch: {
      ignored: ['**/.tmp/**'],
    },
  },
  resolve: {
    alias: {
      'node:crypto': fileURLToPath(new URL('./src/shims/nodeCrypto.js', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';
          if (id.includes('/src/agents/agentRuntime.js')) return 'agent-runtime-core';
        },
      },
    },
  },
});
