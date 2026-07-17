import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('manual scheduler commands tolerate a busy local backend', () => {
  assert.match(appSource, /timeoutMs: action === 'start' \? 30_000 : 5000,/);
});

test('a silent scheduler status timeout does not overwrite a confirmed online state', () => {
  const statusRefresh = appSource.slice(
    appSource.indexOf('const refreshBackendSchedulerStatus = async'),
    appSource.indexOf('const saveBackendBaseUrl =', appSource.indexOf('const refreshBackendSchedulerStatus = async')),
  );

  assert.match(statusRefresh, /connectionStatus: silent \? prev\.connectionStatus : 'offline'/);
  assert.match(statusRefresh, /lastAction: silent \? prev\.lastAction : 'Status check failed'/);
  assert.match(statusRefresh, /error: silent \? prev\.error : error\.name === 'AbortError'/);
});
