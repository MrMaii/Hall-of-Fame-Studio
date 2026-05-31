#!/usr/bin/env python3
"""Split the legacy monolithic personas.json into per-persona packages."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
LEGACY_PERSONAS_PATH = SKILL_DIR / "references" / "personas.json"
PERSONAS_DIR = SKILL_DIR / "personas"


def write_if_allowed(path: Path, content: str, force: bool) -> bool:
    if path.exists() and not force:
        return False
    path.write_text(content, encoding="utf-8")
    return True


def build_prompt_md(persona: dict) -> str:
    return "\n".join(
        [
            f"# Prompt: {persona['name']}",
            "",
            "## Identity",
            "",
            persona["identity"],
            "",
            "## Operating Principles",
            "",
            *[f"- {item}" for item in persona["principles"]],
            "",
            "## Voice",
            "",
            *[f"- {item}" for item in persona["style"]],
            "",
            "## Default Output Format",
            "",
            *[f"{idx + 1}. {item}" for idx, item in enumerate(persona["defaultFormat"])],
            "",
            "## Collaboration Rules",
            "",
            f"- Task fit: {persona['sceneRules']['taskFits']}",
            f"- Task misfit: {persona['sceneRules']['taskMisfit']}",
            f"- Unclear request: {persona['sceneRules']['unclearRequest']}",
            f"- Conflict: {persona['sceneRules']['conflict']}",
            f"- Urgent deadline: {persona['sceneRules']['urgentDeadline']}",
            f"- Risk found: {persona['sceneRules']['riskFound']}",
            "",
        ]
    )


def build_memory_md(persona: dict) -> str:
    return "\n".join(
        [
            f"# Memory: {persona['name']}",
            "",
            "This file is reserved for long-term persona memory.",
            "",
            "## Stable Preferences",
            "",
            f"- Motto: {persona['motto']}",
            f"- Role: {persona['role']}",
            "",
            "## Project Learnings",
            "",
            "- No project-specific memories yet.",
            "",
        ]
    )


def build_examples_md(persona: dict) -> str:
    return "\n".join(
        [
            f"# Examples: {persona['name']}",
            "",
            "Use this file to keep style calibration examples for this persona.",
            "",
            "## Example Response Skeleton",
            "",
            *[f"### {item}\n\n待补充。" for item in persona["defaultFormat"]],
            "",
        ]
    )


def build_regression_json(persona: dict) -> str:
    cases = [
        {
            "id": f"{persona['slug']}_self_fit_1",
            "task": persona["bestFor"][0],
            "expectTop1": persona["slug"],
        }
    ]
    return json.dumps(cases, ensure_ascii=False, indent=2) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate personas.json into per-persona package folders")
    parser.add_argument("--source", default=str(LEGACY_PERSONAS_PATH))
    parser.add_argument("--force", action="store_true", help="Overwrite existing package files")
    args = parser.parse_args()

    source = Path(args.source)
    personas = json.loads(source.read_text(encoding="utf-8"))
    PERSONAS_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    skipped = 0
    for slug, persona in sorted(personas.items()):
        package_dir = PERSONAS_DIR / slug
        package_dir.mkdir(parents=True, exist_ok=True)
        files = {
            "persona.json": json.dumps(persona, ensure_ascii=False, indent=2) + "\n",
            "prompt.md": build_prompt_md(persona),
            "memory.md": build_memory_md(persona),
            "examples.md": build_examples_md(persona),
            "regression.json": build_regression_json(persona),
        }
        for filename, content in files.items():
            if write_if_allowed(package_dir / filename, content, args.force):
                created += 1
            else:
                skipped += 1

    print(f"Migrated {len(personas)} persona packages")
    print(f"Files written: {created}")
    print(f"Files skipped: {skipped}")


if __name__ == "__main__":
    main()
