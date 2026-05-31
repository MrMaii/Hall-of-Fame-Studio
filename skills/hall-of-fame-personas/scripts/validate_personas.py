#!/usr/bin/env python3
"""Validate source persona packages without writing outputs."""

from __future__ import annotations

import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import compile_registry  # noqa: E402


def main() -> None:
    registry, _index = compile_registry.build_registry()
    print(f"Validated {len(registry)} persona packages")


if __name__ == "__main__":
    main()
