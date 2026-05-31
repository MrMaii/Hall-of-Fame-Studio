#!/usr/bin/env python3
"""Runtime utilities for the Hall of Fame persona skill."""

from __future__ import annotations

import argparse
import json
import re
from paths import BUILD_REGISTRY_PATH, LEGACY_GENERATED_REGISTRY_PATH, LEGACY_REFERENCES_REGISTRY_PATH


def load_personas() -> dict:
    for path in (BUILD_REGISTRY_PATH, LEGACY_GENERATED_REGISTRY_PATH, LEGACY_REFERENCES_REGISTRY_PATH):
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    raise SystemExit("No persona registry found. Run compile_registry.py first.")


def normalize(text: str) -> str:
    return (text or "").lower()


def split_terms(text: str) -> list[str]:
    cleaned = re.sub(r"[^\w\u4e00-\u9fff]+", " ", normalize(text))
    return [item for item in cleaned.split() if item]


def char_bigrams(text: str) -> set[str]:
    text = normalize(text)
    if len(text) < 2:
        return set()
    return {text[idx : idx + 2] for idx in range(len(text) - 1)}


def fuzzy_phrase_match(task_text: str, phrase: str) -> bool:
    p = normalize(phrase)
    if not p:
        return False
    if p in task_text or task_text in p:
        return True
    # Fuzzy match for long Chinese phrases in bestFor/notFor.
    if len(p) >= 4:
        p_grams = char_bigrams(p)
        t_grams = char_bigrams(task_text)
        if p_grams and t_grams:
            ratio = len(p_grams.intersection(t_grams)) / len(p_grams)
            if ratio >= 0.42:
                return True
    return False


def phrase_hit_count(task_text: str, phrases: list[str]) -> int:
    value = 0
    for phrase in phrases:
        if fuzzy_phrase_match(task_text, phrase):
            value += 1
    return value


def token_overlap(task_tokens: set[str], phrases: list[str]) -> int:
    overlap = 0
    for phrase in phrases:
        phrase_tokens = set(split_terms(phrase))
        if phrase_tokens and task_tokens.intersection(phrase_tokens):
            overlap += 1
    return overlap


def score_persona(persona: dict, task: str) -> int:
    text = normalize(task)
    tokens = set(split_terms(task))
    keyword_hits = phrase_hit_count(text, persona["keywords"]) + token_overlap(tokens, persona["keywords"])
    best_hits = phrase_hit_count(text, persona["bestFor"]) + token_overlap(tokens, persona["bestFor"])
    misfit_hits = phrase_hit_count(text, persona["notFor"]) + token_overlap(tokens, persona["notFor"])
    scores = persona["scores"]
    value = keyword_hits * 10
    value += best_hits * 18
    value -= misfit_hits * 14
    value += scores["initiative"] * 0.1
    value += scores["activity"] * 0.05
    if any(token in text for token in ["验证", "风险", "证据", "安全", "复核", "准确", "审计", "评审"]):
        value += scores["rigor"] * 0.16
    if any(token in text for token in ["快", "今天", "立刻", "紧急", "上线", "发布", "冲刺"]):
        value += scores["activity"] * 0.08
    if any(token in text for token in ["冲突", "争议", "协同", "团队", "共识"]):
        value += scores["collaboration"] * 0.1 + scores["leadership"] * 0.08
    if any(token in text for token in ["创新", "从0到1", "原型", "突破"]):
        value += scores["creativity"] * 0.1 + scores["riskTolerance"] * 0.08
    return round(value)


def speaker_score(persona: dict, topic: str) -> int:
    scores = persona["scores"]
    value = scores["activity"] * 0.42 + scores["initiative"] * 0.28 + scores["leadership"] * 0.2
    if any(token in topic for token in ["冲突", "反对", "争议"]):
        value += scores["leadership"] * 0.18 + scores["skepticism"] * 0.12
    if any(token in topic for token in ["风险", "验证", "证据", "复核"]):
        value += scores["rigor"] * 0.22
    if any(token in topic for token in ["紧急", "立刻", "发布", "上线"]):
        value += scores["riskTolerance"] * 0.18 + scores["activity"] * 0.12
    return round(value)


def select_personas(personas: dict, slugs: str | None) -> list[dict]:
    if not slugs:
        return list(personas.values())
    chosen = []
    for slug in slugs.split(","):
        key = slug.strip()
        if key:
            if key not in personas:
                raise SystemExit(f"Unknown persona slug: {key}")
            chosen.append(personas[key])
    return chosen


def rank(personas: list[dict], task: str) -> list[tuple[dict, int]]:
    return sorted(((persona, score_persona(persona, task)) for persona in personas), key=lambda item: item[1], reverse=True)


def rank_speakers(personas: list[dict], topic: str) -> list[tuple[dict, int]]:
    return sorted(((persona, speaker_score(persona, topic)) for persona in personas), key=lambda item: item[1], reverse=True)


def build_prompt(persona: dict, task: str, phase: str | None = None) -> str:
    lines = [
        persona["identity"],
        "",
        f"座右铭：{persona['motto']}",
        f"当前任务：{task or '等待任务'}",
    ]
    if phase:
        lines.append(f"当前阶段：{phase}")
    lines.extend(
        [
            "",
            f"人物介绍：{persona['intro']}",
            f"代表成就：{'；'.join(persona['achievements'])}",
            f"行事原则：{'；'.join(persona['principles'])}",
            f"擅长：{'、'.join(persona['bestFor'])}",
            f"不擅长：{'、'.join(persona['notFor'])}",
            f"输出风格：{'、'.join(persona['style'])}",
            f"默认输出格式：{' -> '.join(persona['defaultFormat'])}",
            "",
            "当任务适合你时，主动争取最适合的位置；当任务不适合你时，主动指出原因并推荐更合适的队友类型。",
        ]
    )
    return "\n".join(lines)


def cmd_list(args: argparse.Namespace) -> None:
    personas = load_personas()
    for persona in personas.values():
        print(f"{persona['slug']}\t{persona['name']}\t{persona['role']}")


def cmd_rank(args: argparse.Namespace) -> None:
    personas = select_personas(load_personas(), args.slugs)
    for persona, score in rank(personas, args.task):
        print(f"{score}\t{persona['slug']}\t{persona['name']}\t{persona['sceneRules']['taskFits']}")


def cmd_roundtable(args: argparse.Namespace) -> None:
    personas = select_personas(load_personas(), args.slugs)
    task_rank = rank(personas, args.task)
    speaker_rank = rank_speakers(personas, args.task)
    reviewer = next((persona for persona, _ in task_rank if persona["scores"]["rigor"] >= 85), task_rank[1][0] if len(task_rank) > 1 else task_rank[0][0])
    print(f"lead\t{task_rank[0][0]['slug']}\t{task_rank[0][0]['name']}")
    print(f"reviewer\t{reviewer['slug']}\t{reviewer['name']}")
    print("firstSpeakers\t" + ",".join(persona["slug"] for persona, _ in speaker_rank[:3]))


def cmd_prompt(args: argparse.Namespace) -> None:
    personas = load_personas()
    if args.slug not in personas:
        raise SystemExit(f"Unknown persona slug: {args.slug}")
    print(build_prompt(personas[args.slug], args.task, args.phase))


def main() -> None:
    parser = argparse.ArgumentParser(description="Hall of Fame persona runtime")
    subparsers = parser.add_subparsers(required=True)

    list_parser = subparsers.add_parser("list")
    list_parser.set_defaults(func=cmd_list)

    rank_parser = subparsers.add_parser("rank")
    rank_parser.add_argument("--slugs", help="Comma-separated persona slugs")
    rank_parser.add_argument("--task", required=True)
    rank_parser.set_defaults(func=cmd_rank)

    roundtable_parser = subparsers.add_parser("roundtable")
    roundtable_parser.add_argument("--slugs", help="Comma-separated persona slugs")
    roundtable_parser.add_argument("--task", required=True)
    roundtable_parser.set_defaults(func=cmd_roundtable)

    prompt_parser = subparsers.add_parser("prompt")
    prompt_parser.add_argument("--slug", required=True)
    prompt_parser.add_argument("--task", default="")
    prompt_parser.add_argument("--phase")
    prompt_parser.set_defaults(func=cmd_prompt)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
