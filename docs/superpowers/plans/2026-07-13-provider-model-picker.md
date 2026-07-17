# Provider and Model Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox.

**Goal:** Let a local user choose an AI supplier and model, enter only an API key, and safely use that configuration without manually finding endpoints or protocols.

**Architecture:** Keep the provider catalog in a small frontend module and keep credentials in the existing local Secret Vault. Persist provider, endpoint, and model as separate Vault records. The local model runtime selects either the OpenAI-compatible request shape, Anthropic Messages, or Gemini GenerateContent from the saved provider. No browser or cloud database stores credentials.

**Tech Stack:** React 19, Vite, Tailwind utility classes, Node.js built-in test runner, local Node HTTP backend, local encrypted Secret Vault, `@lobehub/icons` brand assets.

## Global Constraints

- [ ] Preserve all existing local projects, account data, Secret Vault records, and custom OpenAI-compatible model support.
- [ ] Do not add SaaS storage, remote authentication, hosted queues, or cloud-managed state.
- [ ] Use official provider endpoints and currently documented chat-capable model identifiers.
- [ ] Keep a custom provider/model path because provider catalogs change independently of this application.
- [ ] Never expose an API key through status responses, browser storage, logs, screenshots, or test output.

---

## Task 1: Provider catalog and selection behavior

**Files:**
- Create: `src/settings/modelProviderCatalog.js`
- Create: `tests/modelProviderCatalog.test.mjs`

- [ ] Add a failing catalog contract test for OpenAI, Anthropic/Claude, Gemini, Stepfun, DeepSeek, Qwen, and local/custom.
- [ ] Verify every built-in provider has a unique id, HTTPS default endpoint, protocol, default chat model, non-empty chat model list, and logo key.
- [ ] Implement only enough catalog data and helpers to pass the contract.
- [ ] Verify: `node --test tests/modelProviderCatalog.test.mjs`.

## Task 2: Provider-aware backend runtime

**Files:**
- Modify: `src/agents/modelProvider.js`
- Modify: `src/agents/providerSecretBinding.js`
- Modify: `src/agents/agentProjectService.js`
- Modify: `scripts/agent-project-server.mjs`
- Modify: `tests/modelProvider.test.mjs`
- Modify: `tests/providerSecretBinding.test.mjs`

- [ ] Add failing tests that OpenAI-compatible suppliers use Bearer `/chat/completions`, Anthropic uses `x-api-key` `/messages`, and runtime provider changes affect the next request.
- [ ] Add a provider Vault binding target and transient `/llm/test` provider input.
- [ ] Load and bind `model.provider` on startup and immediately after sealing.
- [ ] Verify: `node --test tests/modelProvider.test.mjs tests/providerSecretBinding.test.mjs`.

## Task 3: Provider drawer and model picker

**Files:**
- Modify: `src/settings/LocalModelSettings.jsx`
- Modify: `src/App.jsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/localModelSettings.test.mjs`

- [ ] Add failing UI contract checks for the provider trigger, scrollable drawer, all supplier cards, dependent model picker, custom model entry, and local-only API-key copy.
- [ ] Add local package brand icons and reuse the current settings colors, borders, typography, and spacing.
- [ ] Selecting a provider must replace endpoint and model defaults; selecting a model must update only the model; custom mode keeps manual endpoint/model inputs.
- [ ] Send provider id with `/llm/test`, then seal provider, endpoint, model, and API key through the existing backend Vault route.
- [ ] Verify keyboard labels, disabled states, small screens, reduced motion, and long model names.

## Task 4: Regression and visual proof

**Files:**
- Modify relevant validation scripts only when their old manual-input assumption is intentionally replaced.
- Update: `src/agents/README.md`

- [ ] Run targeted tests and the production build.
- [ ] Test the full selection flow in the local app at desktop and narrow viewport sizes.
- [ ] Compare the finished settings screen with the captured pre-change screen and correct spacing, overflow, focus, and layout issues.
- [ ] Run all Node tests, the real-user zero-to-autonomy gate, the local MVP launch gate, and `git diff --check`.
- [ ] Confirm no test output, status payload, or source file contains a real API key.
