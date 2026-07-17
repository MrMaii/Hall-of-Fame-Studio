import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const boundarySource = readFileSync(new URL('../src/common/LocalUiErrorBoundary.jsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');

test('root UI failures show a local recovery screen instead of an empty page', () => {
  for (const label of ['界面没有正常加载', '项目数据仍保存在本机', '重新加载界面', '查看错误详情']) {
    assert.match(boundarySource, new RegExp(label));
  }
  assert.match(entrySource, /<LocalUiErrorBoundary>/);
  assert.match(boundarySource, /role="alert"/);
});
