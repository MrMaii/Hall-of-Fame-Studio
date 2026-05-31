# Agent Production Guide

Use this guide when another agent is asked to create or update persona entries.

## Process

1. Pick exactly one person unless the user asks for a batch.
2. Read `persona-schema.md` and `persona-authoring-template.md`.
3. Generate a persona package with `scripts/add_persona.py`.
4. Fill every field in `personas/{slug}/persona.json`.
5. Add prompt notes, memory notes, examples, and persona-specific regression cases in the same package folder.
6. Rebuild the generated registry.
7. Run:

```bash
python skills/hall-of-fame-personas/scripts/validate_personas.py
python skills/hall-of-fame-personas/scripts/build_registry.py
python skills/hall-of-fame-personas/scripts/persona_runtime.py prompt --slug <slug> --task "test task"
python skills/hall-of-fame-personas/scripts/persona_runtime.py rank --slugs <slug> --task "test task"
python skills/hall-of-fame-personas/scripts/regression_check.py
python C:\Users\dengm\.codex\skills\.system\skill-creator\scripts\quick_validate.py skills\hall-of-fame-personas
```

## Quality Bar

The persona is acceptable only if:

- It can be selected by task matching.
- It has clear reasons to claim some tasks.
- It has clear reasons to reject other tasks.
- Its prompt starts with a strong identity sentence.
- Its voice is distinct from existing personas.
- Its scores explain its likely meeting behavior.
- `bestFor` and `notFor` are concrete operational scenarios, not abstract labels.
- `defaultFormat` gives an output skeleton another agent can execute directly.
- `sceneRules` are action-oriented and include task-claim and task-reject behavior.
- `keywords` include both broad domain words and specific trigger phrases.

## Detail Standard (GitHub-Style Skill Production)

Use this minimum detail bar for each persona object:

- `intro`: 2 dense sentences explaining role boundary and contribution mode.
- `achievements`: at least 3 concrete credibility anchors; 4 is preferred.
- `principles`: at least 5 executable rules, each phrased as an action.
- `bestFor` and `notFor`: at least 4 entries each, scenario-level wording.
- `style`: at least 4 stable voice traits.
- `defaultFormat`: at least 4 sections that can be used as response headings.
- `keywords`: at least 10 terms with both generic and specific triggers.

If an entry does not meet this detail bar, do not rebuild it into `generated/personas.json`.

## Common Mistakes

- Writing a biography instead of an operational persona.
- Making every score high.
- Leaving `notFor` vague.
- Using poetic labels that task matching cannot detect.
- Putting disclaimers into `identity`.
- Editing `generated/personas.json` directly instead of the matching `personas/{slug}/persona.json`.
