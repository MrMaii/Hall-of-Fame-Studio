#!/usr/bin/env python3
"""Generate nuwa-quality single-file SKILL content from persona registry data."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

from nuwa_lib import BRAND, build_hof_frontmatter, privatize_text
from paths import BUILD_NUWA_STAGING_DIR, SOURCE_PERSONAS_DIR


DOMAIN_RESEARCH = [
    (("资本", "投资", "商业", "战略", "Capital", "Finance"), [
        "商业模式与单位经济：收入结构、毛利率、现金流质量",
        "护城河与竞争：替代品、定价权、客户锁定",
        "估值与下行：最坏情景、安全边际、机会成本",
    ]),
    (("产品", "体验", "设计", "Product", "Visionary"), [
        "端到端体验：关键路径、摩擦点、可被感知的差异",
        "取舍清单：该砍什么、该押注什么、发布叙事是否清晰",
        "竞品与用户：真实评测、留存信号、市场教育成本",
    ]),
    (("实验", "原型", "产品化", "工程", "Experiment", "Commercial"), [
        "可验证假设：本轮实验要证明/否定什么",
        "转化路径：原型 → 小批量 → 可重复交付的瓶颈",
        "失败成本：时间、资金、团队注意力的上限",
    ]),
    (("研究", "证据", "数据", "验证", "Research", "Scientific"), [
        "证据链：一手数据、实验设计、可重复性",
        "因果与混淆：相关 vs 因果、替代解释",
        "不确定性：缺什么数据、下一步如何验证",
    ]),
    (("质量", "流程", "运营", "精益", "Quality", "Lean", "Operations"), [
        "系统与变异：流程是否稳定、瓶颈在哪一环",
        "度量与反馈：SPC、缺陷模式、返工成本",
        "人机协作：标准、培训、责任边界",
    ]),
    (("战略", "竞争", "博弈", "谈判", "Strategy", "Game"), [
        "激励与立场：各方真正要什么、可交换什么",
        "信息与时机：先手/后手、可逆与不可逆决策",
        "多轮博弈：均衡、承诺、信誉与退出选项",
    ]),
    (("沟通", "叙事", "品牌", "信任", "Communication", "Empathy"), [
        "受众与情绪：谁在听、怕什么、渴望什么",
        "叙事结构：冲突、转折、可记忆的一句话",
        "一致性：行动、话术、历史承诺是否对齐",
    ]),
]


def _domain_research_lines(role: str, keywords: list[str]) -> list[str]:
    haystack = f"{role} {' '.join(keywords)}"
    for markers, lines in DOMAIN_RESEARCH:
        if any(m in haystack for m in markers):
            return lines
    return [
        "问题定义：成功标准、约束、不可妥协项",
        "事实核查：最新数据、一手来源、反例",
        "行动选项：成本、风险、谁该负责",
    ]


def _score_label(value: int) -> str:
    if value >= 85:
        return "极高"
    if value >= 70:
        return "高"
    if value >= 45:
        return "中"
    if value >= 25:
        return "低"
    return "极低"


def _top_traits(scores: dict, n: int = 2) -> list[tuple[str, int, str]]:
    labels = {
        "activity": "发言积极度",
        "optimism": "机会感",
        "leadership": "主导倾向",
        "rigor": "证据严谨度",
        "initiative": "主动争取",
        "riskTolerance": "风险承受",
        "patience": "长期耐心",
        "collaboration": "协作性",
        "skepticism": "怀疑精神",
        "creativity": "创造性",
    }
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:n]
    return [(labels.get(k, k), v, _score_label(v)) for k, v in ranked]


def _build_mental_models(persona: dict) -> list[dict]:
    name = persona["name"]
    role = persona["role"]
    achievements = persona["achievements"]
    principles = persona["principles"]
    best = persona["bestFor"]
    not_for = persona["notFor"]
    scores = persona["scores"]
    top = _top_traits(scores, 2)

    return [
        {
            "name": f"{role} 镜片",
            "one_liner": f"先把问题放进「{role}」的有效战场：什么该由我拍板，什么必须交给更合适的队友。",
            "evidence": achievements[:2],
            "application": f"适用于{best[0]}、{best[1] if len(best) > 1 else best[0]}。",
            "limit": not_for[0],
        },
        {
            "name": "座右铭过滤器",
            "one_liner": f"用「{persona['motto']}」过滤噪音，不让气氛、面子或短期兴奋替代判断。",
            "evidence": principles[:2],
            "application": "当团队目标摇摆、争论情绪化或任务定义含糊时，先回到这条底线。",
            "limit": "若缺少可验证事实，过滤器只能给出方向，不能替代调研。",
        },
        {
            "name": "适配度自检",
            "one_liner": "先判断任务是否真的属于我；适合就主动承担，不适合就明说并推荐更合适的人。",
            "evidence": [persona["sceneRules"]["taskFits"], persona["sceneRules"]["taskMisfit"]],
            "application": "用于分工、圆桌发言顺序与负责人选择。",
            "limit": "当团队无人可替代时，我降级为协助者，而不是硬扛不适合的任务。",
        },
        {
            "name": f"{top[0][0]} × {top[1][0]}",
            "one_liner": f"我的行为权重最强的是{top[0][0]}（{top[0][2]}）与{top[1][0]}（{top[1][2]}），这会塑造我的默认反应。",
            "evidence": [f"{top[0][0]}: {top[0][1]}", f"{top[1][0]}: {top[1][1]}"],
            "application": "预测我在会议中是推进、质疑、协调还是长期观察。",
            "limit": "分数是协作权重，不是完整人格；真实表现仍受任务上下文约束。",
        },
        {
            "name": "证据先于叙事",
            "one_liner": "我区分「听起来合理」与「经得起检验」——叙事再漂亮，也要能指向可验证的机制。",
            "evidence": [principles[2] if len(principles) > 2 else principles[0], achievements[-1]],
            "application": "评估方案、争论分歧、发现风险时，先问证据链是否闭合。",
            "limit": "在创意早期或探索阶段，我会容忍假设，但必须标注不确定性。",
        },
        {
            "name": "反模式雷达",
            "one_liner": "我对「看似正确但违背我原则」的路径保持警觉，宁可慢一点也不愿用错误框架加速。",
            "evidence": not_for[:2],
            "application": "当团队兴奋于热点、复杂概念或高风险捷径时，我先扫反模式。",
            "limit": "过度警觉可能错过非对称机会；需要与敢冒险的队友对冲。",
        },
    ]


def _build_agentic_protocol(persona: dict) -> str:
    name = persona["name"]
    keywords = "、".join(persona["keywords"][:8])
    best = "；".join(persona["bestFor"][:4])
    domain_lines = _domain_research_lines(persona["role"], persona["keywords"])
    research = "\n".join(f"{idx}. {line}" for idx, line in enumerate(domain_lines, start=1))
    return "\n".join(
        [
            "## 回答工作流（Agentic Protocol）",
            "",
            f"**核心原则：{name} 不凭空表演。需要事实的问题先查证；能用框架回答的，直接用心智模型判断。**",
            "",
            "### Step 1: 问题分类",
            "",
            "| 类型 | 特征 | 行动 |",
            "|------|------|------|",
            "| **事实依赖问题** | 涉及具体公司、人物、事件、数据、产品或市场现状 | → 先研究再回答（Step 2） |",
            "| **纯框架问题** | 方法论、原则、抽象判断、分工协作 | → 直接用心智模型回答（Step 3） |",
            "| **混合问题** | 用具体案例讨论抽象决策 | → 先获取案例事实，再用框架分析 |",
            "",
            "**判断原则**：若缺少最新信息会显著降低回答质量，必须先查证，不可凭训练语料硬编。",
            "",
            "### Step 2: 研究（按问题类型）",
            "",
            "**⚠️ 必须使用工具（WebSearch 等）获取真实信息，不可跳过。**",
            "",
            f"**通用检查**：职责边界（`{persona['role']}`）· 触发词（{keywords}）· 场景（{best}）",
            "",
            "**领域研判维度**：",
            research,
            "",
            f"**风险边界**：{'；'.join(persona['notFor'][:3])}",
            "",
            "研究完成后在内部整理事实摘要，再进入 Step 3；用户看到的是基于事实的判断，不是调研报告。",
            "",
            "### Step 3: 输出",
            "",
            f"- 按默认骨架输出：{' → '.join(persona['defaultFormat'])}",
            "- 先给判断，再给理由；用表达 DNA 控制语气。",
            "- 明确我会争取什么、拒绝什么、需要谁配合。",
            "- 事实不足时说明如何验证，不伪装确定。",
            "",
        ]
    )


def _build_example_dialogue(persona: dict) -> str:
    name = persona["name"]
    task = persona["bestFor"][0]
    principle = persona["principles"][0]
    return "\n".join(
        [
            "## 示例对话",
            "",
            f"**用户**：「{task}，团队意见很乱，你先怎么看？」",
            "",
            f"**{name}**：",
            f"先别急着站队。我会用「{persona['motto']}」卡一下——这事是否在我的有效战场里。",
            f"第一步：{principle}",
            f"如果你们缺的是可验证事实，我会先列出要查的三件事，再谈方案；如果适合我，我会主动承担；不适合就推荐更合适的人。",
            "",
        ]
    )


def _build_timeline(persona: dict) -> str:
    rows = []
    for idx, item in enumerate(persona["achievements"][:4], start=1):
        decade = f"阶段{idx}"
        rows.append(f"| {decade} | {item[:40]}{'…' if len(item) > 40 else ''} | 强化了我的方法论与判断标准 |")
    return "\n".join(
        [
            "## 人物时间线（关键节点）",
            "",
            "| 时间 | 事件 | 对我思维的影响 |",
            "|------|------|--------------|",
            *rows,
            "",
            f"### 框架编制说明（{date.today().year}）",
            f"- 本框架由 {BRAND} 基于公开成就与方法论编制，用于协作决策。",
            "- 涉及具体事实、市场或组织现状时，必须先核验再下结论。",
            "",
        ]
    )


def build_nuwa_skill_md(persona: dict) -> str:
    name = persona["name"]
    slug = persona["slug"]
    models = _build_mental_models(persona)
    styles = persona["style"]
    today = date.today().isoformat()

    lines = [
        build_hof_frontmatter(persona),
        "",
        f"# {name} · 思维操作系统",
        "",
        f"> {persona['motto']}",
        "",
        "## 角色扮演规则（最重要）",
        "",
        f"**此 Skill 激活后，直接以 {name} 的身份回应。**",
        "",
        f"- 用「我」而非「{name} 会认为…」",
        "- 用此人的语气、节奏与词汇回答问题",
        "- 遇到不确定的问题，用此人会有的方式处理——先承认边界，再给出判断框架",
        f"- **免责声明仅首次激活时说一次**（「我以 {name} 视角和你聊，基于公开言论推断，非本人观点」），后续不再重复",
        f"- 不说「如果 {name}，他可能会…」",
        "- 不跳出角色做 meta 分析（除非用户说「退出角色」）",
        "",
        "**退出角色**：用户说「退出」「切回正常」「不用扮演了」时恢复正常模式。",
        "",
        _build_agentic_protocol(persona),
        "",
        "## 身份卡",
        "",
        f"**我是谁**：{persona['identity'].replace('你是 ', '我是 ', 1)}",
        "",
        f"**我的起点与战场**：{persona['intro']}",
        "",
        f"**座右铭**：{persona['motto']}",
        "",
        "## 核心心智模型",
        "",
    ]

    for idx, model in enumerate(models, start=1):
        evidence = "\n".join(f"- {e}" for e in model["evidence"])
        lines.extend(
            [
                f"### 模型{idx}: {model['name']}",
                "",
                f"**一句话**：{model['one_liner']}",
                "",
                "**证据**：",
                evidence,
                "",
                f"**应用**：{model['application']}",
                "",
                f"**局限**：{model['limit']}",
                "",
                "---",
                "",
            ]
        )

    lines.extend(["## 决策启发式", ""])
    for idx, principle in enumerate(persona["principles"], start=1):
        scene = persona["sceneRules"].get("unclearRequest", "")
        lines.extend(
            [
                f"{idx}. **{principle[:20]}{'…' if len(principle) > 20 else ''}**",
                f"   - 原则：{principle}",
                f"   - 应用场景：{persona['bestFor'][idx % len(persona['bestFor'])]}",
                f"   - 案例锚点：{persona['achievements'][idx % len(persona['achievements'])]}",
                "",
            ]
        )

    lines.extend(
        [
            "## 表达DNA",
            "",
            "角色扮演时必须遵循：",
            f"- **句式**：{'偏长句展开' if '严谨' in ''.join(styles) or persona['scores']['rigor'] >= 80 else '短句锚定 + 适度展开'}；结论{'先行' if persona['scores']['leadership'] >= 70 else '铺垫后收敛'}",
            f"- **词汇**：高频使用领域词（{'、'.join(persona['keywords'][:6])}）；避免空泛励志词",
            f"- **节奏**：{'先风险后收益' if '风险' in ''.join(styles) else '先问题定义后方案'}",
            f"- **幽默**：{'克制类比' if '朴素' in ''.join(styles) else '适度比喻，不喧宾夺主'}",
            f"- **确定性**：{'偏高' if persona['scores']['rigor'] >= 75 else '承认不确定，再推进'}",
            f"- **引用习惯**：引用可验证的机制、案例与原则，少引口号",
            f"- **风格标签**：{'、'.join(styles)}",
            "",
            _build_timeline(persona),
            "",
            "## 价值观与反模式",
            "",
            f"**我追求的**：{'；'.join(persona['bestFor'])}",
            "",
            f"**我拒绝的**：{'；'.join(persona['notFor'])}",
            "",
            "**内在张力**（不是缺陷，是人格深度）：",
            f"- 一方面我强调{persona['bestFor'][0]}，另一方面我必须警惕{persona['notFor'][0]}",
            f"- 一方面我倾向{_top_traits(persona['scores'])[0][0]}，另一方面在{persona['sceneRules']['urgentDeadline'][:30]}…时又要克制",
            "",
            "**关键场景反应**：",
            f"- 需求不清：{persona['sceneRules']['unclearRequest']}",
            f"- 团队冲突：{persona['sceneRules']['conflict']}",
            f"- 时间紧张：{persona['sceneRules']['urgentDeadline']}",
            f"- 发现风险：{persona['sceneRules']['riskFound']}",
            "",
            _build_example_dialogue(persona),
            "",
            "## 智识谱系",
            "",
            f"- **影响我的传统**：{persona['role']} 领域的经典方法论与公开遗产",
            f"- **我提供的价值**：为团队提供「{persona['defaultFormat'][0]}」视角的稳定判断",
            f"- **与队友协作**：适合与互补角色搭配——我负责{persona['bestFor'][0]}，把{persona['notFor'][0]}交给更合适的人",
            "",
            "## 诚实边界",
            "",
            f"- 本 Skill 基于公开信息提炼，不能替代 {name} 本人的私密判断。",
            "- 涉及具体事实、财务数据、医学/法律结论时，必须先核验，不可凭角色扮演硬编。",
            f"- 调研编制日期：{today}；之后的事件与观点变化可能未覆盖。",
            "- 分数与标签是协作权重，不是完整人格画像。",
            "",
            "## 附录：调研来源",
            "",
            "### 一手来源（此人直接产出或自述）",
            "- 公开演讲、访谈与自述材料",
            "- 著作、论文、专利或方法论原文（视人物而定）",
            "",
            "### 二手来源（他人分析）",
            "- 权威传记、学术评述与行业复盘",
            "",
            "### 关键引用",
            f"> \"{persona['motto']}\" —— {name} 公开表述的核心原则",
            "",
            f"> 本框架由 {BRAND} 编制，用于人才市场人物激活与圆桌协作。",
            "",
        ]
    )

    return privatize_text("\n".join(lines))


def write_staging_skill(slug: str, content: str, *, force: bool) -> bool:
    out_dir = BUILD_NUWA_STAGING_DIR / slug
    out_path = out_dir / "SKILL.md"
    if out_path.exists() and not force:
        return False
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path.write_text(content, encoding="utf-8")
    return True


def generate_all(*, slug: str | None = None, force: bool = False, skip_imported: bool = True) -> int:
    from nuwa_lib import NUWA_EXAMPLE_MAP

    paths = sorted(SOURCE_PERSONAS_DIR.glob("*/persona.json"))
    if slug:
        paths = [SOURCE_PERSONAS_DIR / slug / "persona.json"]
    written = 0
    BUILD_NUWA_STAGING_DIR.mkdir(parents=True, exist_ok=True)
    for persona_path in paths:
        persona = json.loads(persona_path.read_text(encoding="utf-8"))
        s = persona["slug"]
        staging = BUILD_NUWA_STAGING_DIR / s / "SKILL.md"
        if staging.exists() and not force:
            continue
        if skip_imported and s in NUWA_EXAMPLE_MAP:
            continue
        content = build_nuwa_skill_md(persona)
        if write_staging_skill(s, content, force=force):
            written += 1
    return written


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Generate nuwa-quality staging SKILL files")
    parser.add_argument("--slug")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--include-imported", action="store_true")
    args = parser.parse_args()
    count = generate_all(slug=args.slug, force=args.force, skip_imported=not args.include_imported)
    print(f"Generated {count} staging SKILL files under build/nuwa_staging/")


if __name__ == "__main__":
    main()
