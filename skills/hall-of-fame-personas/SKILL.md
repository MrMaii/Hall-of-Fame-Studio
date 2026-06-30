---
name: hall-of-fame-personas
description: 构建、筛选并运行 Hall of Fame Studio 名人堂人物技能。适用于人物库维护、任务匹配、圆桌发言排序、角色提示词生成与技能发布。
---

# Hall of Fame Personas

Use this skill to operate the persona system as a standard skill package rather than loose Markdown files.

Core resources:

- `source/personas/{slug}/`: source of truth for each independent persona package.
- `source/personas/{slug}/persona.json`: machine-readable persona data, including Chinese role prompts.
- `source/personas/{slug}/prompt.md`: model-facing prompt notes for one persona.
- `source/personas/{slug}/memory.md`: long-term memory space for one persona.
- `source/personas/{slug}/examples.md`: style calibration examples for one persona.
- `source/personas/{slug}/regression.json`: persona-specific behavior checks.
- `build/personas.json`: generated app/runtime registry. Do not edit by hand.
- `build/persona-index.json`: generated index of persona package paths.
- `build/mindframe/{slug}.md`: 人物认知框架（构建产物）。
- `dist/skills/{slug}/SKILL.md`: distributable per-persona skill package.
- `schema/persona.schema.json`: JSON schema for persona package data.
- `references/persona-schema.md`: field meanings and authoring rules.
- `references/persona-authoring-template.md`: fill-in template for creating one persona.
- `references/agent-production-guide.md`: instructions for other agents producing persona entries.
- `scripts/persona_runtime.py`: deterministic ranking, roundtable planning, and prompt assembly.
- `scripts/add_persona.py`: generate a blank source persona package folder for one new person.
- `scripts/generate_mindframe.py`: 从人物源数据生成认知框架文件。
- `scripts/compile_registry.py`: rebuild build registries from source persona packages.
- `scripts/build_registry.py`: backward-compatible wrapper for legacy command usage.
- `scripts/validate_personas.py`: validate persona packages without writing generated files.
- `scripts/regression_check.py`: run ranking regression checks before and after roster expansion.
- `scripts/package_dist.py`: package per-persona distributable SKILL artifacts.
- `scripts/migrate_layout.py`: migrate legacy `personas/` structure to source/build.
- `scripts/run_pipeline.py`: 一键执行 validate -> compile -> mindframe -> package -> clean -> audit -> regression。
- The default pipeline is self-contained: it reads local persona source, generates registry/mindframe/dist artifacts, cleans historical external-tool traces, audits the output, and does not require an external toolkit checkout.
- `scripts/privatize_audit.py`: 扫描产物中是否残留外部工具指纹。
- `scripts/clean_external_traces.py`: 清理历史外部工具产物残留。
- `references/regression-cases.json`: baseline task set for Top1/Top3 behavior checks.

## Workflow

1. Identify the operation:
   - Choose people for a task: rank candidates by task fit.
   - Run a roundtable: choose lead, reviewer, and first speakers.
   - Generate a role prompt: build the persona prompt for one person.
   - Edit the roster: update the relevant `source/personas/{slug}/persona.json`, then rebuild the registry.
   - Create a new persona: use `scripts/add_persona.py`, fill the generated package, then run validation and registry build.
2. Use structured data first. Read `build/personas.json` for names, scores, strengths, limits, scene rules, and prompt text. Read `source/personas/{slug}/` only when editing one persona.
3. Use `scripts/persona_runtime.py` when deterministic output is useful.
4. Keep persona activation direct and immersive. Persona prompts should start with the strong identity sentence stored in `identity`.
5. Do not bury behavior in prose only. Any field that affects matching, speaking order, or UI must live in `persona.json`.

## Runtime Commands

List registered personas:

```bash
python skills/hall-of-fame-personas/scripts/persona_runtime.py list
```

Rank people for a task:

```bash
python skills/hall-of-fame-personas/scripts/persona_runtime.py rank --slugs musk,buffett,curie,turing --task "prototype risk validation"
```

Create a roundtable plan:

```bash
python skills/hall-of-fame-personas/scripts/persona_runtime.py roundtable --slugs musk,buffett,curie,confucius,turing --task "prototype risk validation"
```

Build a persona prompt:

```bash
python skills/hall-of-fame-personas/scripts/persona_runtime.py prompt --slug musk --task "prototype a product quickly"
```

Generate a blank persona template:

```bash
python skills/hall-of-fame-personas/scripts/add_persona.py --slug jobs --name "Steve Jobs" --role "Product Visionary"
```

Validate persona packages:

```bash
python skills/hall-of-fame-personas/scripts/validate_personas.py
```

Rebuild the generated app/runtime registry:

```bash
python skills/hall-of-fame-personas/scripts/compile_registry.py
```

Run ranking regression checks:

```bash
python skills/hall-of-fame-personas/scripts/regression_check.py
```

## Authoring Rules

- Add or edit persona data in `source/personas/{slug}/persona.json`.
- For a new person, start with `scripts/add_persona.py`; do not improvise field names.
- Preserve the `scores` keys exactly as defined in `references/persona-schema.md`.
- Keep `identity` strong, direct, and role-activating.
- Make `identity` start with `你是 {name}。`
- Keep `bestFor`, `notFor`, `keywords`, and `sceneRules` specific enough for matching.
- Keep `defaultFormat` short; it becomes the expected response skeleton.
- Follow the detail bar in `references/agent-production-guide.md` (scenario-level `bestFor/notFor`, action-driven `sceneRules`, and dense `keywords`).
- Prefer operational wording over biography text: each field should help matching, ordering, or prompt behavior.
- After edits, run `run_pipeline.py`（或依次执行 validate、compile_registry、generate_mindframe、package_dist）。

## App Integration

The React app imports `build/personas.json` through `src/skills/personSkillSystem.js`. This keeps the visible dossier, task matching, roundtable behavior, and AI prompt assembly aligned with the standard skill package while allowing each persona to live in its own package folder.
