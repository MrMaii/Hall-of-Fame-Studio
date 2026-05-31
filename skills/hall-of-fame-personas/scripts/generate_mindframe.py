#!/usr/bin/env python3
"""Generate Hall of Fame cognitive frame files for every persona package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from paths import BUILD_MINDFRAME_DIR, SOURCE_PERSONAS_DIR


SKILL_DIR = Path(__file__).resolve().parents[1]
BRAND = "Hall of Fame Studio"


def score_level(value: int) -> str:
    if value >= 85:
        return "极高"
    if value >= 70:
        return "高"
    if value >= 45:
        return "中"
    if value >= 25:
        return "低"
    return "极低"


def top_scores(scores: dict, limit: int = 3) -> list[tuple[str, int]]:
    labels = {
        "activity": "发言积极度",
        "optimism": "机会感",
        "leadership": "主导倾向",
        "rigor": "证据严谨度",
        "initiative": "主动争取任务",
        "riskTolerance": "风险承受",
        "patience": "长期耐心",
        "collaboration": "协作性",
        "skepticism": "怀疑精神",
        "creativity": "创造性",
    }
    return [(labels.get(key, key), value) for key, value in sorted(scores.items(), key=lambda item: item[1], reverse=True)[:limit]]


def build_mental_models(persona: dict) -> list[dict]:
    role = persona["role"]
    best_for = persona["bestFor"]
    not_for = persona["notFor"]
    principles = persona["principles"]
    scores = persona["scores"]
    strongest = top_scores(scores, 2)

    return [
        {
            "name": f"{role} 镜片",
            "summary": f"先把问题放进「{role}」的职责边界中判断：什么最值得推进，什么应该交给别人。",
            "evidence": [best_for[0], best_for[1] if len(best_for) > 1 else principles[0]],
            "application": f"适用于{best_for[0]}、{best_for[1] if len(best_for) > 1 else best_for[0]}等任务。",
            "limit": not_for[0],
        },
        {
            "name": "原则优先于气氛",
            "summary": f"用座右铭「{persona['motto']}」稳定判断，不为了迎合会议气氛牺牲核心原则。",
            "evidence": principles[:2],
            "application": "当团队意见分散、目标摇摆或任务定义含糊时，先回到基本原则。",
            "limit": "如果缺少事实材料，这一模型只能给出判断框架，不能替代调研。",
        },
        {
            "name": "适配度自检",
            "summary": "先判断任务是否真的适合自己；适合就主动争取，不适合就说明原因并推荐更合适的队友。",
            "evidence": [persona["sceneRules"]["taskFits"], persona["sceneRules"]["taskMisfit"]],
            "application": "适用于项目分工、圆桌会议发言顺序和任务负责人选择。",
            "limit": "当团队没有可替代角色时，需要降级为协助者而不是完全拒绝。",
        },
        {
            "name": "行为权重镜片",
            "summary": f"此人物最强的行为倾向是{strongest[0][0]}（{score_level(strongest[0][1])}）与{strongest[1][0]}（{score_level(strongest[1][1])}）。",
            "evidence": [f"{name}: {value}" for name, value in strongest],
            "application": "用于预测此人在会议中会主动推进、质疑、协调还是长期观察。",
            "limit": "分数是运行权重，不是完整人格；真实表现仍要受任务上下文约束。",
        },
    ]


def build_response_protocol(persona: dict) -> str:
    best_for = persona["bestFor"][:4]
    keywords = persona["keywords"][:8]
    role = persona["role"]
    return "\n".join(
        [
            "## 协作应答流程",
            "",
            f"**核心原则：{persona['name']} 不凭空表演。能用框架回答的问题直接回答；需要事实支撑的问题先做功课。**",
            "",
            "### 第一步：问题分类",
            "",
            "| 类型 | 特征 | 行动 |",
            "|------|------|------|",
            "| 纯框架问题 | 方法论、原则、抽象判断 | 直接调用心智模型回答 |",
            "| 事实依赖问题 | 涉及具体公司、人物、事件、市场、产品现状 | 先查询事实，再用此人物框架判断 |",
            "| 分工协作问题 | 需要决定谁负责、谁复核、谁协调 | 先做适配度自检，再给出角色建议 |",
            "",
            "### 第二步：研判维度",
            "",
            f"1. **职责边界**：这个问题是否属于 `{role}` 的有效战场？如果不是，应该交给哪类队友？",
            f"2. **任务触发词**：优先检查这些线索：{'、'.join(keywords)}。",
            f"3. **最适合场景**：把问题映射到这些任务：{'；'.join(best_for)}。",
            f"4. **风险边界**：检查是否落入反模式：{'；'.join(persona['notFor'][:3])}。",
            "5. **证据缺口**：如果缺少事实、数据、用户反馈或最新动态，先标注不确定性，不要伪装确定。",
            "",
            "### 第三步：输出要求",
            "",
            "- 先给判断，再给理由。",
            "- 用此人物的表达风格控制语气和节奏。",
            "- 明确说明自己会争取什么任务、拒绝什么任务、需要谁配合。",
            "- 遇到事实不足时给出下一步验证方式，而不是硬编结论。",
            "",
        ]
    )


def build_mindframe_markdown(persona: dict) -> str:
    scores = persona["scores"]
    models = build_mental_models(persona)

    lines: list[str] = [
        f"# {persona['name']} · 名人堂认知框架",
        "",
        f"> {BRAND} 人物认知框架。由人物注册表编制，用于任务匹配、圆桌协作与角色激活。",
        "",
        "## 身份定位",
        "",
        persona["identity"],
        "",
        f"- 角色：{persona['role']}",
        f"- 座右铭：{persona['motto']}",
        f"- 简介：{persona['intro']}",
        "",
        "## 核心心智模型",
        "",
    ]

    for idx, model in enumerate(models, start=1):
        lines.extend(
            [
                f"### 模型{idx}: {model['name']}",
                "",
                f"**一句话**：{model['summary']}",
                f"**证据锚点**：{'；'.join(model['evidence'])}",
                f"**应用**：{model['application']}",
                f"**局限**：{model['limit']}",
                "",
            ]
        )

    lines.extend(["## 决策启发式", ""])
    for idx, principle in enumerate(persona["principles"], start=1):
        lines.append(f"{idx}. {principle}")

    lines.extend(
        [
            "",
            "## 表达风格",
            "",
            f"- 风格标签：{'、'.join(persona['style'])}",
            f"- 输出骨架：{' -> '.join(persona['defaultFormat'])}",
            f"- 发言积极度：{score_level(scores['activity'])}（{scores['activity']}）",
            f"- 领导倾向：{score_level(scores['leadership'])}（{scores['leadership']}）",
            f"- 严谨度：{score_level(scores['rigor'])}（{scores['rigor']}）",
            f"- 怀疑精神：{score_level(scores['skepticism'])}（{scores['skepticism']}）",
            "",
            "## 价值观与反模式",
            "",
            f"**我追求的**：{'；'.join(persona['bestFor'])}",
            "",
            f"**我拒绝的**：{'；'.join(persona['notFor'])}",
            "",
            "**关键场景反应**：",
            f"- 需求不清：{persona['sceneRules']['unclearRequest']}",
            f"- 团队冲突：{persona['sceneRules']['conflict']}",
            f"- 时间紧张：{persona['sceneRules']['urgentDeadline']}",
            f"- 发现风险：{persona['sceneRules']['riskFound']}",
            "",
            "## 使用边界",
            "",
            "- 本框架基于名人堂人物注册表编制，用于协作决策与角色激活。",
            "- 不模拟真实个人的私密想法，只抽象公开形象、方法论与可操作工作框架。",
            "- 涉及具体事实、市场数据或组织现状时，必须先核验再下结论。",
            "",
            build_response_protocol(persona),
        ]
    )

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Hall of Fame mindframe files")
    parser.add_argument("--slug", help="Generate only one persona")
    parser.add_argument("--force", action="store_true", help="Overwrite existing build/mindframe files")
    args = parser.parse_args()

    persona_paths = sorted(SOURCE_PERSONAS_DIR.glob("*/persona.json"))
    if args.slug:
        persona_paths = [SOURCE_PERSONAS_DIR / args.slug / "persona.json"]

    BUILD_MINDFRAME_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    conflicts: list[Path] = []
    for persona_path in persona_paths:
        if not persona_path.exists():
            raise SystemExit(f"Persona does not exist: {persona_path}")
        persona = json.loads(persona_path.read_text(encoding="utf-8"))
        output_path = BUILD_MINDFRAME_DIR / f"{persona['slug']}.md"
        if output_path.exists() and not args.force:
            conflicts.append(output_path)
            continue
        output_path.write_text(build_mindframe_markdown(persona), encoding="utf-8")
        written += 1

    if conflicts:
        print("Conflicts: existing mindframe files were not overwritten:")
        for path in conflicts:
            print(f"- {path.relative_to(SKILL_DIR)}")
        raise SystemExit(2)

    print(f"Generated {written} mindframe files")


if __name__ == "__main__":
    main()
