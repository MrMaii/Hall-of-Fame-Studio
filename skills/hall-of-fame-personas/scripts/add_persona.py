#!/usr/bin/env python3
"""Create a new per-persona package folder."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from paths import SOURCE_PERSONAS_DIR

SKILL_DIR = Path(__file__).resolve().parents[1]

SCORE_KEYS = [
    "activity",
    "optimism",
    "leadership",
    "rigor",
    "initiative",
    "riskTolerance",
    "patience",
    "collaboration",
    "skepticism",
    "creativity",
]


def normalize_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    if not slug:
        raise SystemExit("Slug must contain at least one lowercase letter or number")
    return slug


def build_persona(slug: str, name: str, role: str) -> dict:
    return {
        "schemaVersion": "1.0",
        "slug": slug,
        "name": name,
        "role": role,
        "motto": "一句能稳定此人物判断方式的座右铭。",
        "identity": f"你是 {name}。你代表……，是团队中……。",
        "intro": "你适合作为团队里的……。你会……。",
        "achievements": [
            "成就或可信度锚点 1。",
            "成就或可信度锚点 2。",
            "成就或可信度锚点 3。",
        ],
        "scores": {key: 50 for key in SCORE_KEYS},
        "bestFor": ["最适合任务 1", "最适合任务 2", "最适合任务 3"],
        "notFor": ["不适合任务 1", "不适合任务 2", "不适合任务 3"],
        "principles": [
            "行事原则 1。",
            "行事原则 2。",
            "行事原则 3。",
            "行事原则 4。",
            "行事原则 5。",
        ],
        "style": ["语气 1", "语气 2", "语气 3"],
        "defaultFormat": ["输出段落 1", "输出段落 2", "输出段落 3"],
        "sceneRules": {
            "unclearRequest": "用户需求不清时如何反应。",
            "conflict": "团队冲突时如何反应。",
            "urgentDeadline": "时间紧张时如何反应。",
            "riskFound": "发现风险时如何反应。",
            "taskFits": "任务适合自己时如何主动争取。",
            "taskMisfit": "任务不适合自己时如何主动拒绝并推荐队友。",
        },
        "keywords": ["匹配词1", "匹配词2", "匹配词3", "匹配词4", "匹配词5"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a new persona package")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", required=True)
    args = parser.parse_args()

    slug = normalize_slug(args.slug)
    package_dir = SOURCE_PERSONAS_DIR / slug
    if package_dir.exists():
        raise SystemExit(f"Persona package already exists: {package_dir}")

    package_dir.mkdir(parents=True)
    persona = build_persona(slug, args.name, args.role)
    (package_dir / "persona.json").write_text(json.dumps(persona, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (package_dir / "prompt.md").write_text(f"# Prompt: {args.name}\n\n补充此人物的强身份、工作方式、语气和协作规则。\n", encoding="utf-8")
    (package_dir / "memory.md").write_text(f"# Memory: {args.name}\n\n- No project-specific memories yet.\n", encoding="utf-8")
    (package_dir / "examples.md").write_text(f"# Examples: {args.name}\n\n补充 1-3 个风格校准样例。\n", encoding="utf-8")
    (package_dir / "regression.json").write_text(
        json.dumps(
            [{"id": f"{slug}_self_fit_1", "task": "最适合任务 1", "expectTop1": slug}],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Created persona package: {package_dir.relative_to(SKILL_DIR)}")
    print("Next: fill the files, run validate_personas.py, then compile_registry.py")


if __name__ == "__main__":
    main()
