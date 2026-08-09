# Universal Independent Agent Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Hall of Fame Studio standalone Agent a minimal, user-first README with a smooth universal-Agent installation animation, a one-sentence chat install path, a real cross-host Agent Skill bundle, and repeatable release gates; apply the contract to Steve Jobs Agent and Warren Buffett Agent and publish both updates.

**Architecture:** Hall of Fame Studio remains the authored persona source of truth. Each standalone repository keeps its canonical release package in `agent/`, exposes an installable distribution at `skills/<agent-slug>/`, and deterministically synchronizes the latter from the former. A shared, config-driven Pillow builder renders `assets/install.gif`; README presentation starts with the pasteable user path and defers technical analysis. Tests verify bundle parity, media properties, README ordering, GitHub Skill discovery, package fingerprints, and qualification boundaries before public release.

**Tech Stack:** Markdown, Node.js 20 test runner and filesystem APIs, Python 3 + Pillow, GitHub CLI `gh skill`, Git/GitHub releases.

## Global constraints

- Preserve the canonical authored personas under `skills/hall-of-fame-personas/source/personas/`.
- Preserve each standalone repository's `agent/` package and fingerprint semantics.
- Treat `skills/<agent-slug>/agent/` as generated distribution output, never a second authored source.
- Address generic Agent Skill hosts, not Codex alone.
- Use the selected Editorial Prompt motion direction: warm paper, serif editorial headline, monospace prompt, bronze hairline, smooth host carousel/paste/ready states, no portrait hero at the top.
- Keep every existing architecture diagram and the Archive Plate visual exactly once in each language README, below the user-facing quick start.
- Preserve the exact product name `Hall of Fame Studio` and all Director-qualification boundaries.
- Do not stage unrelated files in the dirty Hall of Fame Studio worktree.
- Public updates are authorized by the user's explicit request; verify commit identity and remote state before pushing.

---

### Task 1: Freeze the reusable publication workflow in Hall of Fame Studio

**Files:**
- Create: `skills/hall-of-fame-personas/references/independent-agent-readme-workflow.md`
- Modify: `skills/hall-of-fame-personas/references/independent-agent-release-standard.md`
- Create: `skills/hall-of-fame-personas/templates/independent-agent/scripts/build-install-gif.py`
- Create: `skills/hall-of-fame-personas/templates/independent-agent/assets/install-motion.json`
- Create: `tests/independentAgentReleaseReadme.test.mjs`

**Contract:**
- The workflow states the user journey in order: identify, watch, paste, verify, first use, then inspect professional evidence.
- The standard requires `skills/<slug>/SKILL.md`, a deterministic canonical-to-distribution sync, `assets/install.gif`, `assets/install-motion.json`, bilingual README ordering, and real preview/install smoke tests.
- The generic builder reads only the per-Agent JSON and renders a looping 960x640 GIF whose first frame is useful before motion starts.

- [x] Write the complete bilingual-aware README workflow and explicitly distinguish user communication from professional analysis.
- [x] Extend the canonical release standard without removing the existing Archive Plate contract.
- [x] Store the generic install-motion builder and example config as future-release templates.
- [x] Add a focused Node test that asserts required standard/workflow clauses and template files.
- [x] Run `node --test tests/independentAgentReleaseReadme.test.mjs` and `git diff --check` on only these scoped files.

### Task 2: Add a first-class installable Agent Skill distribution to both repositories

**Files per repository:**
- Move: `SKILL.md` -> `skills/<agent-slug>/SKILL.md`
- Create: `scripts/build-install-bundle.mjs`
- Create generated tree: `skills/<agent-slug>/agent/**`
- Modify: `scripts/validate-package.mjs`
- Modify: `tests/package.test.mjs`
- Modify: `package.json`

**Contract:**
- `npm run bundle:build` replaces only `skills/<agent-slug>/agent/` with a byte-equivalent copy of `agent/`.
- Validation fails when any canonical file is absent, extra, or has a different SHA-256 in the distribution.
- The root contains no mismatched `SKILL.md`; GitHub Skill discovery sees the named install entry.
- Installation command shape is `gh skill install MrMaii/<Repository> <agent-slug> --agent <host> --scope user`.

- [x] Add a deterministic sync script with explicit source and destination guards.
- [x] Move the wrapper Skill metadata to the named skill directory and update relative resource paths.
- [x] Generate the complete distribution copy in each repository.
- [x] Add parity, discovery-path, and manifest assertions to validation/tests.
- [x] Add `bundle:build` and include it in the release verification sequence.

### Task 3: Render the approved universal-Agent install motion for both repositories

**Files per repository:**
- Create: `scripts/build-install-gif.py`
- Create: `assets/install-motion.json`
- Create: `assets/install.gif`
- Modify: `assets/README.md`
- Modify: `package.json`
- Modify: `tests/package.test.mjs`

**Agent-specific copy:**
- Steve Jobs Agent: `Think clearly. Build what matters.` and focused product judgment.
- Warren Buffett Agent: `Judge patiently. Protect what compounds.` and disciplined long-term judgment.
- Paste prompt: `Install MrMaii/<Repository> as a user-level Agent Skill for this agent. Inspect it first, use the matching host, and verify it is available.`

- [x] Copy the same generic builder implementation into both standalone repositories.
- [x] Add only Agent-specific data to each JSON config.
- [x] Build each GIF and verify 960x640 dimensions, looping metadata, multiple frames, first-frame hold, and prompt text in the config.
- [x] Add `install:media:build` and compose it into `media:build` without changing the Archive Plate builder.
- [x] Document source/config/output ownership in each asset manifest.

### Task 4: Reorder both bilingual READMEs around the user's first minute

**Files:**
- Modify: `C:\projects\Steve-Jobs-Agent\README.md`
- Modify: `C:\projects\Steve-Jobs-Agent\README.zh-CN.md`
- Modify: `C:\projects\Warren-Buffett-Agent\README.md`
- Modify: `C:\projects\Warren-Buffett-Agent\README.zh-CN.md`
- Modify: both `tests/package.test.mjs` files

**Required top sequence:**
1. Agent name and language switch.
2. `assets/install.gif` with accessible alt text.
3. `Paste into your Agent` / `粘贴到你的 Agent` and the exact one-sentence prompt.
4. Supported-host statement and deterministic `gh skill preview` / `gh skill install` fallback.
5. One first-use prompt.
6. One concise release/qualification boundary.
7. Existing operating promise, capabilities, evidence, router, diagrams, Archive Plate, tests, Studio context, contribution, and license.

- [x] Rewrite the first screen in English and Chinese with generic Agent language and no top badge wall.
- [x] Move the existing professional material below quick start; do not delete technical evidence.
- [x] Keep each existing diagram and the Archive Plate exactly once.
- [x] Update old Codex-only integration wording to Agent Skills-compatible host wording.
- [x] Add tests that compare heading/media indices and reject Codex-only positioning or duplicate visual assets.

### Task 5: Verify the complete release workflow locally

**Repositories:** Steve Jobs Agent and Warren Buffett Agent.

- [x] Run `npm run bundle:build`, `npm run media:build`, `npm run validate`, `npm run fingerprint`, `npm run check:response`, and `npm test` in each repository.
- [x] Run `python -m py_compile scripts/build-install-gif.py scripts/build-media.py scripts/build-diagrams.py` in each repository.
- [x] Run `gh skill publish --dry-run` and confirm the named full-Agent skill is discovered.
- [x] Preview each named skill, install it into isolated temporary host homes for representative supported hosts, and verify wrapper plus runtime/package files exist.
- [x] Re-run bundle parity after all generation commands and confirm clean deterministic rebuilds.
- [x] Inspect both generated GIFs visually and use Pillow to confirm frame count, duration, dimensions, and loop behavior.
- [x] Run `git diff --check`; inspect exact changed-file lists and confirm no unrelated changes.

### Task 6: Publish both standalone Agent updates and record evidence

**Repositories:** Steve Jobs Agent and Warren Buffett Agent.

- [x] Fetch remotes and confirm local `main` is based on current `origin/main`.
- [x] Confirm repository Git author matches the established release identity.
- [x] Bump each patch version only when its release history requires a new immutable release tag.
- [x] Commit only intentional files with an Agent-install/README-focused message.
- [x] Push each `main`, create or update the corresponding GitHub release with installation and verification notes, and verify the public README and release URLs.
- [x] Report repository URL, release/tag, exact install prompt, skill name, fingerprint, test evidence, and unchanged Director-qualification boundary.

### Task 7: Close the Hall of Fame Studio standard change safely

**Files:** only the Task 1 files and this plan.

- [x] Run the focused standard test again after standalone verification reveals any contract corrections.
- [x] Run `graphify update .` as required; it completed in 54.7 seconds with 14,671 nodes and 27,815 edges.
- [x] Inspect the scoped diff against the pre-existing dirty worktree.
- [x] Do not stage or commit unrelated files; publish from a clean `origin/master` worktree containing only the final standard paths.

## Completion evidence

The work is complete only when a new user can copy one sentence into a compatible Agent, the repository exposes a discoverable full-Agent skill, an isolated install contains the complete runtime package, both bilingual READMEs lead with that path, all package gates pass, both public repositories show the update, and the future publication standard carries the same enforceable workflow.
