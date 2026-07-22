import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('every real initiation starts with a unique non-legacy project id', () => {
  assert.ok(!appSource.includes('DEFAULT_INITIATION_PROJECT_ID'));
  assert.ok(appSource.includes("useState(() => createProjectId('project'))"));

  const navigationStart = appSource.indexOf('const navToInitiation = () =>');
  const navigationSource = appSource.slice(navigationStart, appSource.indexOf('const openInitiationTalentMarket', navigationStart));
  assert.match(navigationSource, /const nextProjectId = createProjectId\(initiationDraft\.name \|\| 'project'\);/);
  assert.ok(!navigationSource.includes("'p_roundtable_001'"));
});

