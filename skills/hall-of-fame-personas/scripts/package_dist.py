#!/usr/bin/env python3
"""Generate distributable per-persona skill packages."""

from __future__ import annotations

import json
from pathlib import Path

from paths import (
    BUILD_INDEX_PATH,
    BUILD_MANIFEST_PATH,
    BUILD_MINDFRAME_DIR,
    BUILD_REGISTRY_PATH,
    DIST_BUNDLE_DIR,
    DIST_SKILLS_DIR,
    SOURCE_PERSONAS_DIR,
)

BRAND = "Hall of Fame Studio"


def _load_json(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"Required file missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _public_index_entry(slug: str, persona: dict, index_entry: dict) -> dict:
    return {
        "slug": slug,
        "name": persona["name"],
        "role": persona["role"],
        "packagePath": f"dist/skills/{slug}",
        "skillPath": f"dist/skills/{slug}/SKILL.md",
        "personaPath": f"dist/skills/{slug}/persona.json",
        "mindframePath": index_entry.get("mindframePath", f"build/mindframe/{slug}.md"),
    }


def _read_source_text(slug: str, filename: str, fallback: str = "") -> str:
    path = SOURCE_PERSONAS_DIR / slug / filename
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return fallback


def _is_nuwa_quality_mindframe(text: str) -> bool:
    return "## 核心心智模型" in text and "### 模型1:" in text


def _render_skill_md(persona: dict, mindframe_text: str, prompt_text: str, memory_text: str, examples_text: str) -> str:
    if _is_nuwa_quality_mindframe(mindframe_text):
        frontmatter = [
            "---",
            f"name: hall-of-fame-{persona['slug']}",
            "description: |",
            f"  {persona['name']}的思维框架与表达方式。{BRAND} 人物技能包，",
            f"  用于任务匹配、圆桌协作与角色激活。",
            "version: 1.0.0",
            f"publisher: {BRAND}",
            "---",
        ]
        return "\n".join(frontmatter) + "\n\n" + mindframe_text.strip() + "\n"

    lines = [
        "---",
        f"name: hall-of-fame-{persona['slug']}",
        f"description: {BRAND} 人物技能包 — {persona['name']}（{persona['role']}）。用于任务匹配、圆桌协作与角色激活。",
        "version: 1.0.0",
        f"publisher: {BRAND}",
        "---",
        "",
        f"# {persona['name']}（{persona['role']}）",
        "",
        persona["identity"],
        "",
        f"- 座右铭：{persona['motto']}",
        f"- 擅长：{'；'.join(persona['bestFor'])}",
        f"- 不擅长：{'；'.join(persona['notFor'])}",
        "",
        "## 默认输出骨架",
        "",
        " -> ".join(persona["defaultFormat"]),
        "",
        "## 行事原则",
        "",
    ]
    for idx, principle in enumerate(persona["principles"], start=1):
        lines.append(f"{idx}. {principle}")

    lines.extend(["", "## 场景规则", ""])
    for key, value in persona["sceneRules"].items():
        lines.append(f"- `{key}`：{value}")

    lines.extend(
        [
            "",
            "## 执行提示（Prompt）",
            "",
            prompt_text.strip() if prompt_text.strip() else "（暂无）",
            "",
            "## 记忆（Memory）",
            "",
            memory_text.strip() if memory_text.strip() else "（暂无）",
            "",
            "## 风格样例（Examples）",
            "",
            examples_text.strip() if examples_text.strip() else "（暂无）",
            "",
            "## 认知框架（Mindframe）",
            "",
            mindframe_text.strip(),
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    registry = _load_json(BUILD_REGISTRY_PATH)
    index = _load_json(BUILD_INDEX_PATH)
    manifest = _load_json(BUILD_MANIFEST_PATH)

    DIST_SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    DIST_BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

    bundled_index: dict[str, dict] = {}
    for slug, persona in registry.items():
        skill_dir = DIST_SKILLS_DIR / slug
        skill_dir.mkdir(parents=True, exist_ok=True)
        mindframe_path = BUILD_MINDFRAME_DIR / f"{slug}.md"
        if mindframe_path.exists():
            mindframe_text = mindframe_path.read_text(encoding="utf-8")
        else:
            mindframe_text = f"# {persona['name']}\n\n认知框架待编制。"
        prompt_text = _read_source_text(slug, "prompt.md", "# Prompt\n\n（暂无）")
        memory_text = _read_source_text(slug, "memory.md", "# Memory\n\n（暂无）")
        examples_text = _read_source_text(slug, "examples.md", "# Examples\n\n（暂无）")

        index_entry = index.get(slug, {})
        (skill_dir / "SKILL.md").write_text(
            _render_skill_md(persona, mindframe_text, prompt_text, memory_text, examples_text),
            encoding="utf-8",
        )
        (skill_dir / "persona.json").write_text(json.dumps(persona, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (skill_dir / "index.json").write_text(
            json.dumps(_public_index_entry(slug, persona, index_entry), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        bundled_index[slug] = {
            "name": persona["name"],
            "role": persona["role"],
            "skillPath": f"dist/skills/{slug}/SKILL.md",
        }

    (DIST_BUNDLE_DIR / "index.json").write_text(json.dumps(bundled_index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (DIST_BUNDLE_DIR / "README.md").write_text(
        "\n".join(
            [
                f"# {BRAND} · 人物技能发布包",
                "",
                "本目录包含名人堂全部人物的独立 Skill 发布产物。",
                "",
                f"- 发布方：{manifest.get('publisher', BRAND)}",
                f"- 人物数量：{manifest.get('personaCount', len(registry))}",
                "- 索引：`dist/bundle/index.json`",
                "- 运行时注册表：`build/personas.json`",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print(f"Packaged {len(registry)} persona skills into dist/skills")


if __name__ == "__main__":
    main()
