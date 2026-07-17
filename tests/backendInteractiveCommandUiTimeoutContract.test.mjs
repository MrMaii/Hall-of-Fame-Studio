import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../scripts/validate-manager-backend-ui.mjs', import.meta.url), 'utf8');

test('Chat, Meeting, and Leader assignment commands tolerate a busy local backend', () => {
  assert.match(
    appSource,
    /timeoutMs: interactiveCommand \|\| backendStation\.connectionStatus === 'online' \? 60_000 : 5_000/,
  );

  const leaderAssignmentWait = validationSource.slice(
    validationSource.indexOf('const leaderAssignmentResponse = page.waitForResponse'),
    validationSource.indexOf('await page.getByTestId(\'manager-assignment-composer-submit\').click()', validationSource.indexOf('const leaderAssignmentResponse = page.waitForResponse')),
  );
  assert.match(leaderAssignmentWait, /timeout: 65000/);

  const managerChangeWait = validationSource.slice(
    validationSource.indexOf('const managerChangeResponse = page.waitForResponse'),
    validationSource.indexOf('await page.getByTestId(\'manager-change-composer-submit\').click()', validationSource.indexOf('const managerChangeResponse = page.waitForResponse')),
  );
  assert.match(managerChangeWait, /timeout: 65000/);
});

test('interactive commands do not enqueue every heavy dashboard refresh ahead of the next user command', () => {
  const commandSource = appSource.slice(
    appSource.indexOf('const runBackendProjectCommand = async'),
    appSource.indexOf('const recordTimelineAction = async', appSource.indexOf('const runBackendProjectCommand = async')),
  );

  assert.match(appSource, /const backendProjectCommandRefreshTimerRef = useRef\(null\)/);
  assert.match(commandSource, /cancelPendingBackendReadModelRefreshes\(\)/);
  assert.match(commandSource, /backendProjectCommandRefreshTimerRef\.current = setTimeout\(async \(\) =>/);
  assert.match(commandSource, /await syncBackendProjectTranscripts/);
  assert.match(commandSource, /await syncBackendTimelineAndEvents/);
  assert.match(commandSource, /}, 5000\)/);
  assert.doesNotMatch(commandSource, /setTimeout\(\(\) => syncBackendProjectTranscripts/);
  assert.doesNotMatch(commandSource, /setTimeout\(\(\) => syncBackendTimelineAndEvents/);
});
