import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const personaRoot = path.join(root, "skills", "hall-of-fame-personas");
const standard = fs.readFileSync(path.join(personaRoot, "references", "independent-agent-release-standard.md"), "utf8");
const workflow = fs.readFileSync(path.join(personaRoot, "references", "independent-agent-readme-workflow.md"), "utf8");
const templateRoot = path.join(personaRoot, "templates", "independent-agent");
const builderPath = path.join(templateRoot, "scripts", "build-install-gif.py");
const configPath = path.join(templateRoot, "assets", "install-motion.json");

test("release standard requires a user-first universal Agent installation path", () => {
  for (const phrase of [
    "skills/<agent-slug>/SKILL.md",
    "assets/install.gif",
    "scripts/build-install-bundle.mjs",
    "Paste into your Agent",
    "gh skill publish --dry-run",
    "Director-qualified",
  ]) {
    assert.ok(standard.includes(phrase), `missing standard phrase: ${phrase}`);
  }
});

test("workflow separates the user's first minute from professional analysis", () => {
  const requiredOrder = [
    "Recognize / 认出",
    "Watch / 看懂",
    "Paste / 粘贴",
    "Verify / 确认",
    "First use / 第一次使用",
    "Understand and Audit / 理解与审核",
  ];
  let previous = -1;
  for (const heading of requiredOrder) {
    const current = workflow.indexOf(heading);
    assert.ok(current > previous, `workflow heading out of order: ${heading}`);
    previous = current;
  }
  assert.match(workflow, /Install <owner>\/<repository> as a user-level Agent Skill/);
  assert.match(workflow, /canonical\/distribution 文件集合和 SHA-256 完全一致/);
});

test("future releases have a shared config-driven install motion template", () => {
  assert.ok(fs.existsSync(builderPath));
  assert.ok(fs.existsSync(configPath));
  const builder = fs.readFileSync(builderPath, "utf8");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  assert.deepEqual(Object.keys(config).sort(), ["agent_name", "headline", "output", "promise", "repository", "skill_name"].sort());
  assert.match(builder, /GIF_SIZE = \(960, 640\)/);
  assert.match(builder, /loop=0/);
  assert.match(builder, /PASTE INTO YOUR AGENT/);
  assert.match(builder, /Agent Skills compatible/);
});
