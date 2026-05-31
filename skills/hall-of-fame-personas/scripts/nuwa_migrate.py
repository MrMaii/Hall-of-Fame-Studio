#!/usr/bin/env python3
"""Migrate nuwa staging SKILL files into source/build structure."""

from __future__ import annotations

import json
import re
import shutil

from nuwa_lib import (
    extract_section,
    privatize_text,
    split_frontmatter,
    staging_skill_path,
)
from paths import BUILD_MINDFRAME_DIR, BUILD_NUWA_STAGING_DIR, LEGACY_PERSONAS_DIR, SOURCE_PERSONAS_DIR


def _write_if_changed(path, content: str, *, force: bool) -> bool:
    text = content.rstrip() + "\n"
    if path.exists() and not force:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def migrate_slug(slug: str, *, force: bool = False) -> bool:
    staging = staging_skill_path(BUILD_NUWA_STAGING_DIR, slug)
    if not staging.exists():
        return False

    raw = privatize_text(staging.read_text(encoding="utf-8"))
    _, body = split_frontmatter(raw)
    body = body.strip() + "\n"

    # Canonical single-file skill (personas/ is what editors open)
    legacy_skill = LEGACY_PERSONAS_DIR / slug / "SKILL.md"
    skill_written = _write_if_changed(legacy_skill, raw, force=force)

    mindframe_path = BUILD_MINDFRAME_DIR / f"{slug}.md"
    mindframe_written = _write_if_changed(mindframe_path, body, force=force)

    source_dir = SOURCE_PERSONAS_DIR / slug
    roleplay = extract_section(body, "角色扮演规则", "使用说明")
    agentic = extract_section(body, "回答工作流", "Agentic Protocol", "协作应答流程")
    identity = extract_section(body, "身份卡", "身份定位")
    models = extract_section(body, "核心心智模型")
    heuristics = extract_section(body, "决策启发式")
    dna = extract_section(body, "表达DNA", "表达风格")
    examples_block = extract_section(body, "示例对话", "示例")

    prompt_parts = ["# Prompt", ""]
    if roleplay:
        prompt_parts.extend([roleplay, ""])
    if agentic:
        prompt_parts.extend([agentic, ""])
    prompt_parts.append("> 完整心智模型、决策启发式与表达 DNA 见同目录 `SKILL.md`。")
    prompt_parts.append("")

    memory_parts = ["# Memory", ""]
    if identity:
        memory_parts.extend([identity, ""])
    values = extract_section(body, "价值观与反模式")
    if values:
        memory_parts.extend([values, ""])
    lineage = extract_section(body, "智识谱系")
    if lineage:
        memory_parts.extend([lineage, ""])
    boundary = extract_section(body, "诚实边界", "使用边界")
    if boundary:
        memory_parts.extend([boundary, ""])

    examples_parts = ["# Examples", ""]
    if heuristics:
        examples_parts.extend([heuristics, ""])
    if examples_block:
        examples_parts.extend([examples_block, ""])
    if dna:
        examples_parts.extend(["## 表达DNA", "", dna, ""])

    prompt_written = _write_if_changed(source_dir / "prompt.md", "\n".join(prompt_parts), force=force)
    memory_written = _write_if_changed(source_dir / "memory.md", "\n".join(memory_parts), force=force)
    examples_written = _write_if_changed(source_dir / "examples.md", "\n".join(examples_parts), force=force)

    if mindframe_written or prompt_written or memory_written or examples_written:
        try:
            from paths import DIST_SKILLS_DIR

            if DIST_SKILLS_DIR.exists():
                _sync_legacy(slug)
        except Exception:
            pass
    return skill_written or mindframe_written or prompt_written or memory_written or examples_written


def _sync_legacy(slug: str) -> None:
    from paths import DIST_SKILLS_DIR, LEGACY_PERSONAS_DIR, SOURCE_PERSONAS_DIR

    target = LEGACY_PERSONAS_DIR / slug
    target.mkdir(parents=True, exist_ok=True)
    for name in ("persona.json", "prompt.md", "memory.md", "examples.md", "regression.json"):
        src = SOURCE_PERSONAS_DIR / slug / name
        if src.exists():
            shutil.copy2(src, target / name)
    dist_skill = DIST_SKILLS_DIR / slug / "SKILL.md"
    if dist_skill.exists():
        shutil.copy2(dist_skill, target / "SKILL.md")


def migrate_all(*, force: bool = False) -> int:
    BUILD_MINDFRAME_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for staging_dir in sorted(BUILD_NUWA_STAGING_DIR.iterdir()):
        if not staging_dir.is_dir():
            continue
        slug = staging_dir.name
        if migrate_slug(slug, force=force):
            count += 1
            print(f"Migrated {slug}")
    return count


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Migrate nuwa staging into source/build")
    parser.add_argument("--slug")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if args.slug:
        ok = migrate_slug(args.slug, force=args.force)
        print("Migrated" if ok else "No changes")
    else:
        n = migrate_all(force=args.force)
        print(f"Migrated {n} personas")


if __name__ == "__main__":
    main()
