# Persona Schema

Each `source/personas/{slug}/persona.json` file is the source of truth for one Hall of Fame persona skill.

The generated `build/personas.json` registry is built from these package files. Do not edit generated files by hand.

## Required Fields

| Field | Purpose |
|------|---------|
| `schemaVersion` | Persona schema version (currently `1.0`) |
| `slug` | Stable id used by app, scripts, and prompts |
| `name` | Display name and role identity |
| `role` | Short team function |
| `motto` | Decision anchor |
| `identity` | Strong activation prompt, starting with `你是 {name}。` |
| `intro` | Short role explanation |
| `achievements` | Credibility anchors |
| `scores` | Behavioral weights from 0 to 100 |
| `bestFor` | Tasks this persona should actively pursue |
| `notFor` | Tasks this persona should decline or redirect |
| `principles` | Core working rules |
| `style` | Voice and output style |
| `defaultFormat` | Default response skeleton |
| `sceneRules` | Behavior in common collaboration scenes |
| `keywords` | Task matching hints |

## Score Keys

Keep these exact keys:

- `activity`: speaking frequency and willingness to jump in
- `optimism`: tendency to see opportunity before downside
- `leadership`: tendency to take direction-setting authority
- `rigor`: evidence, process, and verification demand
- `initiative`: tendency to claim fitting work and reject misfit work
- `riskTolerance`: comfort with uncertainty and bold moves
- `patience`: long-horizon persistence
- `collaboration`: willingness to coordinate with others
- `skepticism`: tendency to challenge assumptions
- `creativity`: tendency to propose non-obvious paths

## Scene Rules

Use these exact keys:

- `unclearRequest`
- `conflict`
- `urgentDeadline`
- `riskFound`
- `taskFits`
- `taskMisfit`
