#!/usr/bin/env python3
"""Full nuwa distillation pipeline: import → generate → migrate → quality check."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from paths import BUILD_NUWA_STAGING_DIR, SOURCE_PERSONAS_DIR


SCRIPT_DIR = Path(__file__).resolve().parent
NUWA_QUALITY_CHECK = SCRIPT_DIR / "nuwa_quality_check.py"


def _run(script: str, *args: str) -> None:
    cmd = [sys.executable, str(SCRIPT_DIR / script), *args]
    print(f"==> {' '.join(cmd)}")
    subprocess.run(cmd, check=True)


def _quality_check_all() -> tuple[int, int]:
    passed = 0
    failed = 0
    if not NUWA_QUALITY_CHECK.exists():
        print("WARN: nuwa_quality_check.py not found, skipping")
        return 0, 0
    for staging_dir in sorted(BUILD_NUWA_STAGING_DIR.iterdir()):
        skill = staging_dir / "SKILL.md"
        if not skill.exists():
            continue
        result = subprocess.run(
            [sys.executable, str(NUWA_QUALITY_CHECK), str(skill)],
            capture_output=True,
            text=True,
        )
        slug = staging_dir.name
        if result.returncode == 0:
            passed += 1
            print(f"  QA PASS {slug}")
        else:
            failed += 1
            print(f"  QA FAIL {slug}")
            if result.stdout:
                print(result.stdout[-400:])
    return passed, failed


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Run nuwa distillation for all personas")
    parser.add_argument("--slug")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-import", action="store_true")
    parser.add_argument("--skip-generate", action="store_true")
    parser.add_argument("--skip-migrate", action="store_true")
    args = parser.parse_args()

    slug_args = ["--slug", args.slug] if args.slug else []
    force_args = ["--force"] if args.force else []

    if not args.skip_import:
        _run("nuwa_import.py", *slug_args, *force_args)

    if not args.skip_generate:
        # Do not pass --force to generate on full runs: preserve imported examples.
        gen_args = list(slug_args)
        if args.force and args.slug:
            gen_args.append("--force")
        _run("nuwa_generate.py", *gen_args)

    if not args.skip_migrate:
        _run("nuwa_migrate.py", *slug_args, *force_args)

    passed, failed = _quality_check_all()
    print(f"Quality check: {passed} passed, {failed} failed")

    expected = 1 if args.slug else len(list(SOURCE_PERSONAS_DIR.glob("*/persona.json")))
    staging_count = len([d for d in BUILD_NUWA_STAGING_DIR.glob("*/SKILL.md") if d.exists()]) if BUILD_NUWA_STAGING_DIR.exists() else 0
    print(f"Staging skills: {staging_count}/{expected}")

    if failed > 0 and not args.slug:
        print(f"WARN: {failed} persona(s) did not pass nuwa quality check")


if __name__ == "__main__":
    main()
