# App Skill Bridge

The standard Codex skill package lives at:

`skills/hall-of-fame-personas/`

The React app uses `personSkillSystem.js` as a thin bridge into that package. It imports the generated canonical persona registry from:

`skills/hall-of-fame-personas/build/personas.json`

Keep persona source data in `skills/hall-of-fame-personas/source/personas/{slug}/`. Do not add separate app-only persona definitions here.
