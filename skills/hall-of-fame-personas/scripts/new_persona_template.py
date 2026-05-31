#!/usr/bin/env python3
"""Generate a blank Hall of Fame persona JSON object."""

from __future__ import annotations

import argparse
import json


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


def build_template(slug: str, name: str, role: str) -> dict:
    return {
        "slug": slug,
        "name": name,
        "role": role,
        "motto": "一句能稳定此人物判断方式的座右铭。",
        "identity": f"你是 {name}。你代表……，是团队中……。",
        "intro": "你适合作为团队里的……。你会……。",
        "achievements": [
            "成就或可信度锚点 1。",
            "成就或可信度锚点 2。",
            "成就或可信度锚点 3。"
        ],
        "scores": {key: 50 for key in SCORE_KEYS},
        "bestFor": ["最适合任务 1", "最适合任务 2", "最适合任务 3"],
        "notFor": ["不适合任务 1", "不适合任务 2", "不适合任务 3"],
        "principles": [
            "行事原则 1。",
            "行事原则 2。",
            "行事原则 3。",
            "行事原则 4。",
            "行事原则 5。"
        ],
        "style": ["语气 1", "语气 2", "语气 3", "语气 4"],
        "defaultFormat": ["输出段落 1", "输出段落 2", "输出段落 3"],
        "sceneRules": {
            "unclearRequest": "用户需求不清时如何反应。",
            "conflict": "团队冲突时如何反应。",
            "urgentDeadline": "时间紧张时如何反应。",
            "riskFound": "发现风险时如何反应。",
            "taskFits": "任务适合自己时如何主动争取。",
            "taskMisfit": "任务不适合自己时如何主动拒绝并推荐队友。"
        },
        "keywords": ["匹配词1", "匹配词2", "匹配词3", "匹配词4", "匹配词5"]
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a blank persona JSON template")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", required=True)
    args = parser.parse_args()
    print(json.dumps(build_template(args.slug, args.name, args.role), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
