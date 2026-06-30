#!/usr/bin/env python3
"""Remove legacy external-tool artifacts from the Hall of Fame skill tree."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from paths import BUILD_DIR, BUILD_NUWA_STAGING_DIR, LEGACY_PERSONAS_DIR, SKILL_DIR


def clean(*, dry_run: bool) -> None:
    removed: list[str] = []

    legacy_nuwa = BUILD_DIR / "nuwa"
    if legacy_nuwa.exists():
        removed.append(str(legacy_nuwa))
        if not dry_run:
            shutil.rmtree(legacy_nuwa)

    if BUILD_NUWA_STAGING_DIR.exists():
        removed.append(str(BUILD_NUWA_STAGING_DIR))
        if not dry_run:
            shutil.rmtree(BUILD_NUWA_STAGING_DIR)

    if LEGACY_PERSONAS_DIR.exists():
        for path in LEGACY_PERSONAS_DIR.glob("*/nuwa.md"):
            removed.append(str(path))
            if not dry_run:
                path.unlink()

    for path in removed:
        print(f"{'Would remove' if dry_run else 'Removed'}: {Path(path).relative_to(SKILL_DIR)}")

    if not removed:
        print("No legacy external artifacts found.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean legacy nuwa artifacts")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    clean(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
