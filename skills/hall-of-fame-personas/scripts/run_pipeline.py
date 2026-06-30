#!/usr/bin/env python3
"""Run the full Hall of Fame build pipeline."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def _run(script: str, *args: str) -> None:
    command = [sys.executable, str(SCRIPT_DIR / script), *args]
    print(f"==> {' '.join(command)}")
    subprocess.run(command, check=True)


def main() -> None:
    _run("validate_personas.py")
    _run("compile_registry.py")
    _run("generate_mindframe.py", "--force")
    _run("package_dist.py")
    _run("sync_legacy_personas.py")
    _run("clean_external_traces.py")
    _run("privatize_audit.py")
    _run("regression_check.py")
    print("Pipeline completed.")


if __name__ == "__main__":
    main()
