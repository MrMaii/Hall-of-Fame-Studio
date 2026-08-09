# Independent Agent Release Standard

Status: canonical Hall of Fame Studio publication contract, v2.

This standard applies to every public standalone Agent repository that is
derived from `skills/hall-of-fame-personas/source/personas/{slug}/`. It turns a
Foundry candidate into a complete, inspectable, visually coherent release. It
does not replace Studio integration or the Director's human qualification.

## Canonical product name

Use the exact English name everywhere:

```text
Hall of Fame Studio
```

Canonical repository URL:

```text
https://github.com/MrMaii/Hall-of-Fame-Studio
```

Holo-style legacy aliases and invented abbreviations are forbidden in README
text, documentation, SVG metadata, rendered media, GitHub metadata, tests,
release notes, and generated campaign copy. The Chinese explanation may say
`Hall of Fame Studio（名人堂工作室）`, but the product name remains the English
canonical name.

## One-line operator request

The supported shorthand for a complete public release is:

```text
发布独立 Agent：<人物>；slug=<slug>；仓库=<owner>/<repo>；公开发布；按 Hall of Fame Studio 独立 Agent 发布标准，包含双语 README、动态演示、主海报、宣传片、能力集群说明和 GitHub Release。
```

If `slug` or repository coordinates are omitted, infer them only when unique;
state the inference before the external GitHub write. If the request does not
explicitly say public or publish, prepare and validate locally but stop before
creating or pushing a remote repository.

## Release lanes

There are three separate decisions:

1. `repository-prequalified`: Foundry floor, source traceability, runtime,
   quality gate, package, media, and offline tests pass.
2. `director-qualified`: a human Director records `pass` after blind
   distinctiveness, real ChatBox, and team trials.
3. `public-release`: a rollbackable standalone GitHub repository and tagged
   release exist, with both statuses stated honestly.

Public publication may happen at repository prequalification when the operator
chooses to publish an inspectable candidate. It must never be described as
Director-qualified until the human verdict exists.

## Phase 0 — protect the source and inspect the workspace

Before editing or publishing:

- Read `AGENTS.md`, this standard, the Foundry workflow, standard JSON,
  authoring template, and qualification protocol.
- Run the graphify query for the target Agent and publication surfaces when the
  graph exists.
- Inspect the target source, current branch, remotes, dirty files, and any
  existing standalone repository.
- Keep authored source in the Studio canonical package. Build the public
  repository in a separate clean directory so unrelated worktree changes are
  never staged or overwritten.
- Confirm the target, slug, evidence profile, user promise, and publication
  boundary before expensive research or external writes.

## Phase 1 — strengthen every Agent before release

Every deep Agent must preserve the Foundry trace:

```text
source -> observation -> claim -> runtime rule -> test -> observed behavior
```

Before a standalone release, run the target through the same floor as every
other Agent:

- 40+ sources for a documented real person, with the required primary share;
- 50+ atomic observations across 10+ materially different contexts;
- 10+ behavior claims, each with observations, counterevidence, confidence, and
  a runtime rule;
- the full human-core document set and a mechanistic charisma model;
- 10–15 callable Skills, each with a named artifact, stop condition, failure
  modes, safety/truthfulness, and self-review;
- relational, exploratory, task, and high-stakes runtime modes;
- a persona-owned quality gate with the neutral four-function interface;
- source fingerprint continuity across Studio, ChatBox, distribution, and the
  standalone package;
- the Foundry repository prequalification command.

Never copy another Agent's voice, charisma, relationship posture, Skill
inventory, quality rules, or catchphrases. A standalone package is a mirror of
the Agent, never a substitute for Studio integration.

## Phase 2 — standalone repository contract

The release repository must contain, at minimum:

```text
README.md
README.zh-CN.md
LICENSE
NOTICE.md
CONTRIBUTING.md
SECURITY.md
CITATION.cff
package.json
agent/                    # complete canonical standalone Agent package
skills/<agent-slug>/      # discoverable, installable generated distribution
assets/                   # rendered campaign and architecture assets
docs/ARCHITECTURE.md
docs/HALL-OF-FAME-STUDIO.md
docs/QUALIFICATION.md
docs/RELEASE-NOTES-vX.Y.Z.md
scripts/                  # validation, bundle sync, fingerprint, media build
tests/                    # package contract and quality-gate tests
```

`skills/<agent-slug>/SKILL.md` is the public installation entry.
`skills/<agent-slug>/agent/**` must be generated from `agent/**` by
`scripts/build-install-bundle.mjs` and must have the same file set and SHA-256
values. It is a distribution mirror, never a second authored source. A
mismatched root-level `SKILL.md` is forbidden because repository Skill
discovery validates the skill name against its directory.

The standalone package must be installable, inspectable, reproducible, and
safe to use without implying endorsement, identity reproduction, current
authority, or guaranteed financial/medical/legal outcomes.

## Phase 3 — README publication format

Both README files must tell the same product story in the reader's language.
Follow
`skills/hall-of-fame-personas/references/independent-agent-readme-workflow.md`.
The order is:

1. Agent identity and language switch, without a badge wall.
2. `assets/install.gif`, showing a smooth universal-Agent install sequence.
3. `Paste into your Agent` and the exact one-sentence natural-language install
   prompt.
4. Agent Skills-compatible host statement, deterministic `gh skill preview`
   and `gh skill install` fallback, restart/new-chat verification, and one
   ready-to-paste first-use prompt.
5. One concise repository-prequalification and Director-qualification
   boundary.
6. Operating promise and capability clusters: what the Agent can do, when to invoke each cluster,
   inputs, outputs, stop conditions, and at least one ready-to-paste prompt.
7. Conversation mode router: ordinary conversation must not activate hard
   Skills; task mode activates only the relevant one to three Skills.
8. Quality loop: evidence, uncertainty, downside, revision, and fallback.
9. Evidence, diagrams, and the Archive Plate, each shown exactly once.
10. Explicit link to Hall of Fame Studio and explanation that the repository is
   one Agent inside the larger governed Studio.
11. Identity, financial/domain, endorsement, privacy, and current-fact
    boundaries.
12. Reproduction commands, source fingerprint, contribution and license links.

Do not use biography as a substitute for an operational tutorial. Do not hide
the qualification status. Do not call a standalone package the Studio itself.

## Phase 4 — visual release system

Treat every art asset as a designed release surface with one job:

| Asset | Required role |
| --- | --- |
| `assets/install-motion.json` | Agent-specific copy for the shared install motion |
| `assets/install.gif` | universal-Agent installation tutorial shown at the top of both READMEs |
| `assets/source/hero-master.png` | compatibility slot for the reviewed Archive Plate |
| `assets/source/poster-master.png` | compatibility slot containing the identical Archive Plate |
| `assets/hero.png` | unchanged 3:2 Archive Plate for the README first impression |
| `assets/poster.png` | unchanged 3:2 primary launch plate |
| `assets/social-card.png` | unchanged 3:2 social preview |
| `assets/demo.gif` | restrained 3:2 Archive Plate motion study |
| `assets/teaser.gif` | restrained 3:2 Archive Plate motion study |
| `assets/diagrams/*.svg` | decision lens, capability clusters, mode router, quality loop, Studio network |
| `scripts/build-media.py` | deterministic rebuild of all rendered media |
| `scripts/build-install-gif.py` | shared, config-driven install-motion renderer |
| `assets/README.md` | provenance, visual rationale, constraints, rebuild command |

### Universal-Agent installation motion workflow

1. Copy the canonical builder template from
   `skills/hall-of-fame-personas/templates/independent-agent/scripts/build-install-gif.py`.
2. Change only `agent_name`, the two headline lines, one capability promise,
   repository coordinates, and skill name in `assets/install-motion.json`.
3. Render a `960x640` looping GIF using the Editorial Prompt system: warm
   paper, editorial serif, monospace paste prompt, bronze hairline, smooth host
   carousel, and `INSPECT -> MATCH -> INSTALL -> READY` progression.
4. Include common compatible hosts and finish on `Your Agent`; never frame the
   flow as Codex-only.
5. Make frame zero a complete static fallback containing the install prompt and
   READY result. Do not put a portrait, fake conversation, fabricated quote, or
   simulated persona answer in this asset.
6. Keep the Archive Plate as the identity artwork lower in the README. The
   install motion and Archive Plate have separate jobs and must each appear
   exactly once.

Every Agent release uses one reviewed final **Archive Plate**: a horizontal
`3:2` composition, normally `1536×1024`, with the identity typography,
portrait window, archival grain, calibration marks, coordinates, date, and
metadata already composed into the supplied image. Use the shared Hall of Fame
language: dark stone/charcoal, warm bronze or parchment, editorial serif,
restrained mono metadata, and museum/archive dignity. Do not use cash rain,
ticker walls, crystal balls, luxury signaling, fabricated quotes, official
trade dress, victory poses, or automatic celebrity-card layouts.

### Archive Plate workflow

1. Require a reviewed final plate from the visual workflow. If the plate is
   missing, stop; do not synthesize a replacement with a generic batch layout.
2. Copy the one plate byte-for-byte into both legacy source slots. The two
   files must be the same size and identical bytes; the compatibility names do
   not mean two different compositions.
3. Let `scripts/build-media.py` validate the `3:2` size and source equality,
   then copy the plate unchanged to `hero.png`, `poster.png`, and
   `social-card.png`. Do not add typography, focus boxes, frame lines,
   crosshairs, blur, crops, or color overlays on static surfaces.
4. Build `demo.gif` and `teaser.gif` only as quiet `3:2` motion studies of the
   same plate. They may use a restrained drift or brightness cycle, but may
   not add generated copy, claims, or a second visual system.

The source plate may contain locked typography; that typography is part of the
reviewed visual artifact and must not be redrawn by code. `assets/README.md`
must record provenance, intended surfaces, exact dimensions, composition,
palette, negative constraints, equality of the two compatibility slots, and
the local visual review.

## Phase 5 — verification gates

Run every applicable gate and preserve the exact output in the handoff:

```bash
python skills/hall-of-fame-personas/scripts/validate_agent_foundry.py --slug <slug>
npm run skills:dist
npm run skills:check
npm run skills:blend
node --test tests/<foundry-and-agent-contracts>.test.mjs
npm run build
git diff --check
```

Inside the standalone repository, require equivalent commands for package
validation, bundle synchronization, fingerprinting, media rebuilding, response
safety, and tests:

```bash
npm run bundle:build
npm run media:build
npm run validate
npm run fingerprint
npm run check:response
npm test
gh skill publish --dry-run
gh skill preview <owner>/<repository> <agent-slug>
gh skill install <owner>/<repository> <agent-slug> --agent <representative-host> --scope user
```

The install smoke test must use an isolated host home and prove that the named
skill contains `SKILL.md`, `agent/RUNTIME.md`, `agent/AGENT.md`, and all expected
hard Skills. A successful process exit without those files is insufficient.
The package test must also prove canonical/distribution file-set and SHA-256
parity and verify that `assets/install.gif` is multi-frame, `960x640`, and
looping. Also
run a canonical-name scan over text, SVG, source scripts, tests, release notes,
and generated media inputs for legacy Holo-style aliases:

```text
legacy Holo-style alias variants
```

The result must be zero matches. Then verify that `Hall of Fame Studio` and the
canonical repository URL appear in both README files and the Studio network
asset. A test must prevent brand drift from returning.

## Phase 6 — GitHub publication

Only after fresh gates pass:

1. Confirm the target GitHub repository does not already exist, unless the
   operator explicitly requested an update.
2. Commit only the isolated release repository with a clear release commit.
3. Create the public repository with the exact description, homepage, and
   relevant topics.
4. Push `main` and set upstream tracking.
5. Create a non-draft, non-prerelease tag such as `v0.1.0` with release notes.
6. Verify repository visibility, default branch, remote HEAD, metadata, README,
   poster, GIFs, SVGs, and release tag through GitHub.
7. Report the public URL, release URL, commit, fingerprint, qualification
   status, tests, and any remaining Director gates.

Never overwrite an existing repository by default. Never push a dirty Studio
worktree as a side effect of publishing a standalone mirror. Never include
private qualification transcripts, evaluator notes, sidecars, or paid-provider
secrets.

## Definition of done

The release is complete only when all of these are true:

- canonical source and standalone package agree on the fingerprint;
- Foundry repository prequalification passes;
- README, bilingual tutorial, capability clusters, Archive Plate motion studies, poster,
  teaser, diagrams, and Studio explanation are present;
- the named full-Agent Skill is discoverable and a clean isolated install
  contains its wrapper, runtime, package, and hard Skills;
- both READMEs lead with the universal-Agent install motion, pasteable sentence,
  deterministic fallback, first-use prompt, and honest qualification line
  before professional analysis;
- the exact product name is used everywhere;
- media rebuild is deterministic;
- offline tests and package safety checks pass;
- GitHub remote, metadata, `main`, and tagged release are verified;
- the handoff states what is public, what is private, and what still requires
  Director qualification.

The shortest future request is therefore enough:

```text
发布独立 Agent：<人物>。按 Hall of Fame Studio 独立 Agent Release Standard 完整执行并公开发布；缺失信息先做最小澄清，完成后给我 GitHub、Release、资产、验证和资格状态。
```
