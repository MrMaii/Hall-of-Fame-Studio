#!/usr/bin/env python3
"""Regression checks for Hall of Fame persona ranking behavior."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import persona_runtime


SKILL_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CASES_PATH = SKILL_DIR / "references" / "regression-cases.json"


def load_cases(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def check_case(case: dict, ranked_slugs: list[str], selected_slugs: set[str]) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    top1 = ranked_slugs[0] if ranked_slugs else None
    top3 = ranked_slugs[:3]

    expect_top1 = case.get("expectTop1")
    expect_top1_any = case.get("expectTop1Any", [])
    expect_top3_includes = [slug for slug in case.get("expectTop3Includes", []) if slug in selected_slugs]

    if expect_top1 and top1 != expect_top1:
        reasons.append(f"top1 expected '{expect_top1}', got '{top1}'")
    if expect_top1_any and top1 not in expect_top1_any:
        reasons.append(f"top1 expected one of {expect_top1_any}, got '{top1}'")
    missing = [slug for slug in expect_top3_includes if slug not in top3]
    if missing:
        reasons.append(f"top3 missing {missing}, got {top3}")

    return (len(reasons) == 0, reasons)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ranking regression checks for persona runtime")
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH), help="Path to regression case JSON")
    parser.add_argument("--slugs", help="Optional comma-separated persona slugs to limit ranking")
    args = parser.parse_args()

    cases = load_cases(Path(args.cases))
    personas = persona_runtime.load_personas()
    selected_personas = persona_runtime.select_personas(personas, args.slugs)
    selected_slugs = {item["slug"] for item in selected_personas}

    passed = 0
    failed = 0
    print(f"Running {len(cases)} regression cases on {len(selected_personas)} personas...")

    for case in cases:
        ranked = persona_runtime.rank(selected_personas, case["task"])
        ranked_slugs = [persona["slug"] for persona, _score in ranked]
        ok, reasons = check_case(case, ranked_slugs, selected_slugs)
        if ok:
            passed += 1
            print(f"PASS {case['id']} | top1={ranked_slugs[0]} | top3={ranked_slugs[:3]}")
        else:
            failed += 1
            print(f"FAIL {case['id']} | top1={ranked_slugs[0]} | top3={ranked_slugs[:3]}")
            for reason in reasons:
                print(f"  - {reason}")
            print(f"  - task: {case['task']}")

    print("")
    print(f"Result: passed={passed}, failed={failed}, total={len(cases)}")
    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
