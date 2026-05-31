#!/usr/bin/env python3
"""Compatibility wrapper for registry compilation.

Use compile_registry.py for the primary pipeline command.
"""

from __future__ import annotations

import compile_registry


def build_registry() -> tuple[dict, dict]:
    return compile_registry.build_registry()


def main() -> None:
    print("NOTICE build_registry.py is deprecated; use compile_registry.py instead.")
    registry, index = compile_registry.build_registry()
    compile_registry.write_outputs(registry, index, mirror_legacy=True)
    print(f"Built {len(registry)} personas")
    print("Wrote build/personas.json (+ generated/personas.json mirror)")


if __name__ == "__main__":
    main()
