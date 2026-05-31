#!/usr/bin/env python3
"""ASCII-safe quality check for nuwa-style SKILL files."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def check_mental_models(content: str) -> tuple[bool, str]:
    in_section = False
    count = 0
    for line in content.split("\n"):
        if re.match(r"^##\s+.*心智模型", line, re.I):
            in_section = True
            continue
        if in_section and re.match(r"^##\s+", line) and "心智模型" not in line:
            break
        if in_section and re.match(r"^###\s+", line):
            count += 1
    passed = 3 <= count <= 7
    return passed, f"{count} mental models ({'ok' if passed else 'need 3-7'})"


def check_limitations(content: str) -> tuple[bool, str]:
    ok = bool(re.search(r"局限|失效|不适用|盲区", content, re.I))
    return ok, "limitations present" if ok else "missing limitations"


def check_expression_dna(content: str) -> tuple[bool, str]:
    if not re.search(r"表达DNA|表达风格", content, re.I):
        return False, "missing expression DNA section"
    markers = len(re.findall(r"句式|词汇|语气|幽默|节奏|确定性|引用", content))
    passed = markers >= 3
    return passed, f"expression markers={markers} ({'ok' if passed else 'need >=3'})"


def check_honest_boundary(content: str) -> tuple[bool, str]:
    m = re.search(r"(?:##\s+.*诚实边界|##\s+.*使用边界)(.*?)(?=\n##\s|\Z)", content, re.DOTALL | re.I)
    if not m:
        return False, "missing honest boundary section"
    boundary_text = m.group(1)
    items = len(re.findall(r"^[-*]\s+", boundary_text, re.MULTILINE))
    items += len(re.findall(r"^\d+\.\s+", boundary_text, re.MULTILINE))
    passed = items >= 3
    return passed, f"boundary items={items} ({'ok' if passed else 'need >=3'})"


def check_tensions(content: str) -> tuple[bool, str]:
    markers = len(re.findall(r"张力|矛盾|一方面.*另一方面|既.*又", content, re.I))
    passed = markers >= 2
    return passed, f"tensions={markers} ({'ok' if passed else 'need >=2'})"


def check_primary_sources(content: str) -> tuple[bool, str]:
    m = re.search(r"(?:##\s+.*来源|##\s+.*Reference)(.*?)(?=\n##\s|\Z)", content, re.DOTALL | re.I)
    if not m:
        return True, "sources section skipped"
    text = m.group(1)
    primary = len(re.findall(r"一手|primary|本人", text, re.I))
    secondary = len(re.findall(r"二手|secondary", text, re.I))
    total = primary + secondary
    if total == 0:
        return True, "source types not tagged (skipped)"
    passed = primary / total > 0.5
    return passed, f"primary ratio {primary}/{total} ({'ok' if passed else 'low'})"


def check_file(path: Path) -> bool:
    content = path.read_text(encoding="utf-8")
    checks = [
        check_mental_models,
        check_limitations,
        check_expression_dna,
        check_honest_boundary,
        check_tensions,
        check_primary_sources,
    ]
    passed = 0
    for fn in checks:
        ok, detail = fn(content)
        if ok:
            passed += 1
        print(f"  {'PASS' if ok else 'FAIL'}: {detail}")
    print(f"  Result: {passed}/{len(checks)}")
    return passed == len(checks)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: nuwa_quality_check.py <SKILL.md>")
        raise SystemExit(1)
    path = Path(sys.argv[1])
    ok = check_file(path)
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
