#!/usr/bin/env python3
"""Validate persona sources and compile registries into build outputs."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from paths import (
    BUILD_DIR,
    BUILD_INDEX_PATH,
    BUILD_MANIFEST_PATH,
    BUILD_REGISTRY_PATH,
    DIST_SKILLS_DIR,
    LEGACY_GENERATED_INDEX_PATH,
    LEGACY_GENERATED_REGISTRY_PATH,
    LEGACY_PERSONAS_DIR,
    LEGACY_REFERENCES_REGISTRY_PATH,
    SOURCE_PERSONAS_DIR,
)
from skill_meta import build_skill_meta

REQUIRED_FIELDS = [
    "schemaVersion",
    "slug",
    "name",
    "role",
    "motto",
    "identity",
    "intro",
    "achievements",
    "scores",
    "bestFor",
    "notFor",
    "principles",
    "style",
    "defaultFormat",
    "sceneRules",
    "keywords",
]

SCORE_KEYS = [
    "activity",
    "optimism",
    "leadership",
    "rigor",
    "initiative",
    "riskTolerance",
    "patience",
    "collaboration",
    "skepticism",
    "creativity",
]

SCENE_RULE_KEYS = [
    "unclearRequest",
    "conflict",
    "urgentDeadline",
    "riskFound",
    "taskFits",
    "taskMisfit",
]


def load_persona(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_persona(persona: dict, path: Path) -> list[str]:
    errors: list[str] = []
    for field in REQUIRED_FIELDS:
        if field not in persona:
            errors.append(f"{path}: missing required field '{field}'")

    if persona.get("schemaVersion") != "1.0":
        errors.append(f"{path}: schemaVersion must be '1.0'")

    slug = persona.get("slug")
    if slug and path.parent.name != slug:
        errors.append(f"{path}: slug '{slug}' does not match folder '{path.parent.name}'")

    identity = persona.get("identity", "")
    name = persona.get("name", "")
    if name and not identity.startswith(f"你是 {name}。"):
        errors.append(f"{path}: identity must start with '你是 {name}。'")

    scores = persona.get("scores", {})
    for key in SCORE_KEYS:
        value = scores.get(key)
        if not isinstance(value, int) or value < 0 or value > 100:
            errors.append(f"{path}: scores.{key} must be an integer from 0 to 100")

    scene_rules = persona.get("sceneRules", {})
    for key in SCENE_RULE_KEYS:
        if not scene_rules.get(key):
            errors.append(f"{path}: sceneRules.{key} is required")

    for field, min_count in [
        ("achievements", 3),
        ("bestFor", 3),
        ("notFor", 3),
        ("principles", 5),
        ("style", 3),
        ("defaultFormat", 3),
        ("keywords", 5),
    ]:
        value = persona.get(field, [])
        if not isinstance(value, list) or len(value) < min_count:
            errors.append(f"{path}: {field} must contain at least {min_count} items")

    return errors


def _legacy_order() -> dict[str, int]:
    if not LEGACY_REFERENCES_REGISTRY_PATH.exists():
        return {}
    legacy_personas = json.loads(LEGACY_REFERENCES_REGISTRY_PATH.read_text(encoding="utf-8"))
    return {slug: position for position, slug in enumerate(legacy_personas.keys())}


def build_registry() -> tuple[dict, dict]:
    if not SOURCE_PERSONAS_DIR.exists():
        raise SystemExit(f"Source personas directory does not exist: {SOURCE_PERSONAS_DIR}")

    registry: dict[str, dict] = {}
    index: dict[str, dict] = {}
    errors: list[str] = []
    legacy_order = _legacy_order()
    persona_paths = sorted(
        SOURCE_PERSONAS_DIR.glob("*/persona.json"),
        key=lambda path: (legacy_order.get(path.parent.name, len(legacy_order)), path.parent.name),
    )

    for persona_path in persona_paths:
        persona = load_persona(persona_path)
        errors.extend(validate_persona(persona, persona_path))
        slug = persona.get("slug")
        if slug in registry:
            errors.append(f"{persona_path}: duplicate slug '{slug}'")
            continue
        persona = dict(persona)
        skill_path = LEGACY_PERSONAS_DIR / slug / "SKILL.md"
        if not skill_path.exists():
            skill_path = DIST_SKILLS_DIR / slug / "SKILL.md"
        if skill_path.exists():
            persona["skillMeta"] = build_skill_meta(slug, skill_path.read_text(encoding="utf-8"))
        registry[slug] = persona
        index[slug] = {
            "slug": slug,
            "name": persona.get("name"),
            "role": persona.get("role"),
            "packagePath": str(persona_path.parent.relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "personaPath": str(persona_path.relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "promptPath": str((persona_path.parent / "prompt.md").relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "memoryPath": str((persona_path.parent / "memory.md").relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "examplesPath": str((persona_path.parent / "examples.md").relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "regressionPath": str((persona_path.parent / "regression.json").relative_to(SOURCE_PERSONAS_DIR.parent)).replace("\\", "/"),
            "mindframePath": f"build/mindframe/{slug}.md",
            "skillPath": f"personas/{slug}/SKILL.md",
            "skillMeta": persona.get("skillMeta"),
        }

    if errors:
        for error in errors:
            print(f"ERROR {error}")
        raise SystemExit(1)
    return registry, index


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_outputs(registry: dict, index: dict, *, mirror_legacy: bool) -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    _write_json(BUILD_REGISTRY_PATH, registry)
    _write_json(BUILD_INDEX_PATH, index)
    _write_json(
        BUILD_MANIFEST_PATH,
        {
            "schemaVersion": "1.0",
            "publisher": "Hall of Fame Studio",
            "product": "Hall of Fame Personas",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "personaCount": len(registry),
            "sourceRoot": "source/personas",
            "registryPath": "build/personas.json",
            "indexPath": "build/persona-index.json",
            "mindframeRoot": "build/mindframe",
        },
    )

    if mirror_legacy:
        _write_json(LEGACY_GENERATED_REGISTRY_PATH, registry)
        _write_json(LEGACY_GENERATED_INDEX_PATH, index)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile Hall of Fame persona registries")
    parser.add_argument("--no-legacy-mirror", action="store_true", help="Skip writing generated/* compatibility outputs")
    args = parser.parse_args()

    registry, index = build_registry()
    write_outputs(registry, index, mirror_legacy=not args.no_legacy_mirror)
    print(f"Built {len(registry)} personas")
    print("Wrote build/personas.json")
    print("Wrote build/persona-index.json")
    print("Wrote build/manifest.json")
    if not args.no_legacy_mirror:
        print("Mirrored generated/personas.json for backward compatibility")


if __name__ == "__main__":
    main()
