import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('ordinary talent market uses user-facing Chinese and hides internal record identifiers', () => {
  const source = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');
  for (const label of ['人才市场', '搜索人才', '候选成员', '主要经历', '专长', '最适合', '打开档案']) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /TOP SECRET|ID:\{agent\.id\}|SKILL ACTIVE|Records Found|Query archives/i);
});

test('talent cards avoid nested button semantics', () => {
  const source = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');
  assert.match(source, /<article key=\{agent\.id\}/);
  assert.doesNotMatch(source, /<div key=\{agent\.id\} role="button"/);
});

test('initiation talent cards explain that opening a dossier leads to selection', () => {
  const source = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /isInitiationMarket \? text\('查看并选择', 'Review and select'\)/);
  assert.match(source, /accessibleName=\{localizeText\(agent\.name, activeLanguage\)\}/);
  assert.match(appSource, /title=\{accessibleName\}/);
});

test('talent cards stay readable beside the product sidebar at common desktop widths', () => {
  const source = readFileSync(new URL('../src/scenes/AgentMarketScene.jsx', import.meta.url), 'utf8');
  assert.match(source, /lg:grid-cols-3 2xl:grid-cols-4/);
  assert.doesNotMatch(source, /\bxl:grid-cols-4\b/);
});

test('kickoff contract actions have complete Chinese labels', () => {
  const source = readFileSync(new URL('../src/i18n/locales/zh.js', import.meta.url), 'utf8');
  assert.match(source, /'Sign for Kickoff': '加入立项'/);
  assert.match(source, /'Signed for Kickoff': '已加入立项'/);
});
