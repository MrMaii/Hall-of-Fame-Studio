#!/usr/bin/env python3
"""Import high-quality nuwa-skill examples into Hall of Fame staging."""

from __future__ import annotations

import json
import re

from nuwa_lib import NUWA_EXAMPLE_MAP, build_hof_frontmatter, privatize_text, staging_skill_path
from paths import BUILD_NUWA_STAGING_DIR, NUWA_EXAMPLES_DIR, SOURCE_PERSONAS_DIR


def _adapt_example_body(body: str, persona: dict) -> str:
    """Keep nuwa example body; swap frontmatter and privatize traces."""
    body = privatize_text(body)
    # Normalize title to persona name
    body = re.sub(
        r"^#\s+.+?\s+·\s+思维操作系统",
        f"# {persona['name']} · 思维操作系统",
        body,
        count=1,
        flags=re.MULTILINE,
    )
    return body


def import_example(slug: str, *, force: bool = False) -> bool:
    example_dir = NUWA_EXAMPLE_MAP.get(slug)
    if not example_dir:
        return False
    src = NUWA_EXAMPLES_DIR / example_dir / "SKILL.md"
    if not src.exists():
        raise SystemExit(f"Nuwa example missing: {src}")

    persona_path = SOURCE_PERSONAS_DIR / slug / "persona.json"
    persona = json.loads(persona_path.read_text(encoding="utf-8"))
    raw = src.read_text(encoding="utf-8")
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        body = parts[2].lstrip("\n") if len(parts) >= 3 else raw
    else:
        body = raw

    content = build_hof_frontmatter(persona) + "\n\n" + _adapt_example_body(body, persona)
    out = staging_skill_path(BUILD_NUWA_STAGING_DIR, slug)
    if out.exists() and not force:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(content, encoding="utf-8")
    return True


def import_all(*, force: bool = False) -> int:
    if not NUWA_EXAMPLES_DIR.exists():
        raise SystemExit(f"nuwa-skill examples not found: {NUWA_EXAMPLES_DIR}")
    BUILD_NUWA_STAGING_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for slug in NUWA_EXAMPLE_MAP:
        if import_example(slug, force=force):
            count += 1
            print(f"Imported {slug} <- {NUWA_EXAMPLE_MAP[slug]}")
        else:
            print(f"Skipped {slug} (already exists, use --force)")
    return count


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Import nuwa-skill example SKILL files")
    parser.add_argument("--slug")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.slug:
        if import_example(args.slug, force=args.force):
            print(f"Imported {args.slug}")
        else:
            print(f"No import for {args.slug}")
    else:
        import_all(force=args.force)


if __name__ == "__main__":
    main()
