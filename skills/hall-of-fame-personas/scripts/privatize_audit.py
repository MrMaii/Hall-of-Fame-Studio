#!/usr/bin/env python3
"""Scan Hall of Fame skill outputs for external-tool fingerprints."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from paths import BUILD_DIR, DIST_DIR, SKILL_DIR, SOURCE_DIR


FORBIDDEN_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"nuwa",
        r"女娲",
        r"alchaincyf",
        r"nuwa-skill",
        r"colleague-skill",
        r"github\.com/alchain",
        r"Phase\s*1",
        r"六路来源",
        r"Skill造人术",
    ]
]

SCAN_ROOTS = [SOURCE_DIR, BUILD_DIR, DIST_DIR]
SCAN_GLOBS = ("**/*.md", "**/*.json", "**/*.py")


def scan() -> list[str]:
    hits: list[str] = []
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for pattern in SCAN_GLOBS:
            for path in root.glob(pattern):
                if path.is_dir():
                    continue
                if "scripts" in path.parts and path.suffix == ".py" and path.name not in {"privatize_audit.py", "generate_nuwa_basics.py"}:
                    continue
                text = path.read_text(encoding="utf-8", errors="ignore")
                for rule in FORBIDDEN_PATTERNS:
                    if rule.search(text):
                        hits.append(f"{path.relative_to(SKILL_DIR)}: matched /{rule.pattern}/")
                        break
    return hits


def main() -> None:
    hits = scan()
    if hits:
        print("Privatize audit failed. External traces found:")
        for hit in hits:
            print(f"- {hit}")
        raise SystemExit(1)
    print("Privatize audit passed.")


if __name__ == "__main__":
    main()
