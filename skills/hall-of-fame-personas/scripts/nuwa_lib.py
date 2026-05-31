#!/usr/bin/env python3
"""Shared helpers for nuwa-style persona skill distillation."""

from __future__ import annotations

import re
from pathlib import Path

BRAND = "Hall of Fame Studio"

FORBIDDEN_REPLACEMENTS = [
    (re.compile(r"女娲\s*·\s*Skill造人术", re.I), BRAND),
    (re.compile(r"Skill造人术", re.I), "人物认知框架"),
    (re.compile(r"https://github\.com/alchaincyf/nuwa-skill[^\s\)]*", re.I), ""),
    (re.compile(r"https://x\.com/AlchainHust[^\s\)]*", re.I), ""),
    (re.compile(r"本Skill由\s*.*生成", re.I), f"本框架由 {BRAND} 编制"),
    (re.compile(r"调研过程详见\s*`references/research/`.*", re.I), "调研基于公开著作、访谈与传记材料。"),
    (re.compile(r"nuwa-skill", re.I), "hall-of-fame-personas"),
    (re.compile(r"女娲", re.I), BRAND),
]

NUWA_EXAMPLE_MAP = {
    "jobs": "steve-jobs-perspective",
    "musk": "elon-musk-perspective",
    "feynman": "feynman-perspective",
}

SECTION_ALIASES = {
    "roleplay": ("角色扮演规则", "使用说明"),
    "agentic": ("回答工作流", "Agentic Protocol", "协作应答流程"),
    "identity": ("身份卡", "身份定位"),
    "models": ("核心心智模型",),
    "heuristics": ("决策启发式",),
    "dna": ("表达DNA", "表达风格"),
    "timeline": ("人物时间线", "关键节点"),
    "values": ("价值观与反模式",),
    "lineage": ("智识谱系",),
    "boundary": ("诚实边界", "使用边界"),
    "sources": ("调研来源", "附录"),
    "examples": ("示例对话", "示例"),
}


def privatize_text(text: str) -> str:
    for pattern, replacement in FORBIDDEN_REPLACEMENTS:
        text = pattern.sub(replacement, text)
    # Drop trailing attribution block lines
    lines = []
    skip_footer = False
    for line in text.splitlines():
        if re.search(r"创建者|Alchain|github\.com/alchain", line, re.I):
            skip_footer = True
        if skip_footer and line.strip() == "":
            continue
        if skip_footer and re.match(r"^>\s*", line):
            continue
        if skip_footer and not line.strip():
            continue
        if skip_footer and line.strip().startswith(">"):
            continue
        lines.append(line)
    cleaned = "\n".join(lines).rstrip() + "\n"
    return cleaned


def split_frontmatter(content: str) -> tuple[str, str]:
    if not content.startswith("---"):
        return "", content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return "", content
    return parts[1].strip(), parts[2].lstrip("\n")


def build_hof_frontmatter(persona: dict) -> str:
    slug = persona["slug"]
    name = persona["name"]
    role = persona["role"]
    triggers = persona.get("keywords", [])[:6]
    trigger_text = "、".join(triggers) if triggers else role
    return "\n".join(
        [
            "---",
            f"name: hall-of-fame-{slug}",
            "description: |",
            f"  {name}的思维框架与表达方式。基于公开著作、访谈与传记材料的深度提炼，",
            f"  用于 {BRAND} 任务匹配、圆桌协作与角色激活。",
            f"  当用户提到「用{name}的视角」「{name}会怎么看」「{slug} perspective」或",
            f"  涉及{trigger_text}等问题时使用。",
            "version: 1.0.0",
            f"publisher: {BRAND}",
            "---",
        ]
    )


def extract_section(body: str, *titles: str) -> str:
    if not body:
        return ""
    lines = body.splitlines()
    start = None
    level = 2
    for idx, line in enumerate(lines):
        if not line.startswith("#"):
            continue
        heading = re.sub(r"^#+\s*", "", line).strip()
        if any(title in heading for title in titles):
            start = idx
            level = len(line) - len(line.lstrip("#"))
            break
    if start is None:
        return ""
    collected = [lines[start]]
    for line in lines[start + 1 :]:
        if line.startswith("#"):
            current_level = len(line) - len(line.lstrip("#"))
            if current_level <= level:
                break
        collected.append(line)
    return "\n".join(collected).strip()


def strip_section(body: str, *titles: str) -> str:
    block = extract_section(body, *titles)
    if not block:
        return body
    return body.replace(block, "").strip()


def staging_skill_path(staging_dir: Path, slug: str) -> Path:
    return staging_dir / slug / "SKILL.md"
