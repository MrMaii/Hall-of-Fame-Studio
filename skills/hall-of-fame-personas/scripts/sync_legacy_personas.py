#!/usr/bin/env python3
"""Sync source + dist skill outputs into legacy personas/ (what the repo UI still opens)."""

from __future__ import annotations

import argparse
import shutil

from paths import (
    DIST_SKILLS_DIR,
    LEGACY_PERSONAS_DIR,
    SOURCE_PERSONAS_DIR,
)

SYNC_FILES = ("persona.json", "prompt.md", "memory.md", "examples.md", "regression.json")


def sync(*, dry_run: bool = False) -> int:
    if not SOURCE_PERSONAS_DIR.exists():
        raise SystemExit(f"Missing source personas: {SOURCE_PERSONAS_DIR}")

    LEGACY_PERSONAS_DIR.mkdir(parents=True, exist_ok=True)
    count = 0

    for source_dir in sorted(SOURCE_PERSONAS_DIR.iterdir()):
        if not source_dir.is_dir():
            continue
        slug = source_dir.name
        target_dir = LEGACY_PERSONAS_DIR / slug
        if not dry_run:
            target_dir.mkdir(parents=True, exist_ok=True)

        for filename in SYNC_FILES:
            src = source_dir / filename
            if not src.exists():
                continue
            dst = target_dir / filename
            print(f"{'Would copy' if dry_run else 'Copy'} {src.relative_to(SOURCE_PERSONAS_DIR.parent)} -> personas/{slug}/{filename}")
            if not dry_run:
                shutil.copy2(src, dst)

        dist_skill = DIST_SKILLS_DIR / slug / "SKILL.md"
        if dist_skill.exists():
            dst_skill = target_dir / "SKILL.md"
            print(f"{'Would copy' if dry_run else 'Copy'} dist/skills/{slug}/SKILL.md -> personas/{slug}/SKILL.md")
            if not dry_run:
                shutil.copy2(dist_skill, dst_skill)

        count += 1

    print(f"Synced {count} persona packages into {LEGACY_PERSONAS_DIR}")
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync source/dist into legacy personas/")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    sync(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
