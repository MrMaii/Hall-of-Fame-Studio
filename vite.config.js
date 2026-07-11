import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'node:crypto': fileURLToPath(new URL('./src/shims/nodeCrypto.js', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor';
          if (id.includes('/node_modules/lucide-react/')) return 'icons-vendor';
          if (id.includes('/src/agents/agentRuntime.js') || id.includes('/src/agents/agentProjectService.js')) return 'agent-runtime';
        },
      },
    },
  },
});
