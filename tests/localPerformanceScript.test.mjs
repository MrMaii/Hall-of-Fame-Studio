import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('local performance report covers machine, disk, parse memory and response time budgets', () => {
  const source = readFileSync(new URL('../scripts/measure-local-performance.mjs', import.meta.url), 'utf8');
  for (const field of ['logicalCpuCount', 'totalMemoryBytes', 'bytes', 'readMs', 'parseMs', 'heapUsedBytesAfterParse', 'cpuUserMs', 'cpuSystemMs', 'p50Ms', 'p95Ms']) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /healthP95Ms: 250/);
  assert.match(source, /storeReadAndParseMs: 2_000/);
  assert.match(source, /local-runtime-status\.json/);
  assert.match(source, /runtimeStatus\?\.urls\?\.backend/);
});
