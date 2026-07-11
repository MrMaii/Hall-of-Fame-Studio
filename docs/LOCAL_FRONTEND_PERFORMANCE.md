# Local Frontend Performance

The local UI is built with Vite. The production build keeps the application entry, the Agent runtime, React, icons, and the lazy Talent Market and Agent Dossier scenes in separate cacheable JavaScript chunks.

Run the budget check after a production build:

```powershell
npm.cmd run build
npm.cmd run ui:bundle:check
```

The check enforces a parsed application-entry budget below 1.6 MB and verifies the expected chunk boundaries. It is a regression guard for local load and cache behavior, not a substitute for runtime Web Vitals. Collect Web Vitals from a real local browser trace before making claims about FCP, LCP, INP, or CLS.

The Talent Market and Agent Dossier routes load through `React.lazy`. They receive precomputed display data and callbacks from the workspace shell; neither makes backend requests or mutates backend-managed project state. The workspace shell remains large, so subsequent route extraction must preserve backend-only project controls and work-mode governance.

## Local-only provider boundary

`scripts/agent-project-server.mjs` starts with `AGENT_LOCAL_ONLY=true` unless explicitly overridden. In that mode, model and HTTP search providers may only use loopback, private-network, `.localhost`, or `.local` endpoints. Configure a local OpenAI-compatible runtime such as `http://127.0.0.1:11434/v1`; public provider endpoints are blocked before a network request is made.
