import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/settings/LocalModelSettings.jsx', import.meta.url), 'utf8');

test('simple local model settings use Chinese primary actions and keep diagnostics collapsed', () => {
  for (const label of ['本地模型配置', '刷新状态', '测试模型', '检查并保存模型', '这个本地模型不需要密钥', '配置调查资料搜索（可选）', '查看技术诊断信息']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /<details className=/);
  assert.match(source, /modelSettingsErrorMessage\(drafts\.error, activeLanguage, \{/);
  assert.match(source, /if \(checked\) update\('modelApiKey', ''\)/);
  assert.ok(source.includes("useState(() => /^https?:\\/\\/(?:localhost|127\\.0\\.0\\.1|\\[::1\\])"));
});

test('fresh accounts can open model settings without pre-existing draft fields', () => {
  assert.match(source, /const normalized = status \|\| \{\}/);
  for (const field of ['modelBaseUrl', 'modelName', 'modelApiKey', 'searchEndpoint', 'searchApiKey']) {
    assert.match(source, new RegExp(`String\\(drafts\\.${field} \\|\\| ''\\)\\.trim\\(\\)`));
    if (field === 'modelName') {
      assert.match(source, /modelId=\{customModelMode \? '__custom__' : drafts\.modelName \|\| selectedProvider\.defaultModel\}/);
      assert.match(source, /customModelMode/);
    } else {
      assert.match(source, new RegExp(`value=\\{drafts\\.${field} \\|\\| ''\\}`));
    }
  }
});
