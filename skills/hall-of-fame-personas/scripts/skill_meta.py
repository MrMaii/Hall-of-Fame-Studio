#!/usr/bin/env python3
"""Compute lightweight skill metadata without embedding full markdown in JSON."""

from __future__ import annotations

import re

from nuwa_lib import NUWA_EXAMPLE_MAP


def strip_frontmatter(text: str) -> str:
    if not text.startswith("---"):
        return text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return text
    return parts[2].lstrip("\n")


def build_skill_meta(slug: str, raw: str) -> dict:
    body = strip_frontmatter(raw)
    preview = ""
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("|"):
            continue
        if line.startswith(">"):
            preview = line.lstrip("> ").strip()
            break
        preview = line
        break

    model_count = len(re.findall(r"^###\s+模型\d+", body, re.MULTILINE))
    if model_count == 0:
        model_count = len(re.findall(r"^###\s+模型", body, re.MULTILINE))

    return {
        "path": f"personas/{slug}/SKILL.md",
        "lineCount": len(body.splitlines()),
        "charCount": len(body),
        "modelCount": model_count,
        "quality": "imported" if slug in NUWA_EXAMPLE_MAP else "generated",
        "hasAgentic": "Agentic Protocol" in body or "回答工作流" in body,
        "preview": preview[:320],
    }
