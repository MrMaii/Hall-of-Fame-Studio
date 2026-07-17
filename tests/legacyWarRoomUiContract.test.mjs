import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const viewUrl = new URL('../src/project/LegacyWarRoomView.jsx', import.meta.url);

test('legacy War Room remains available through a lazy view with all user controls', () => {
  assert.equal(existsSync(viewUrl), true, 'Legacy War Room view component is missing');
  const viewSource = readFileSync(viewUrl, 'utf8');

  for (const visibleControl of [
    'data-testid="legacy-war-room-end-meeting"',
    'data-testid="legacy-war-room-start-meeting"',
    'data-testid="legacy-war-room-terminal-input"',
    'data-testid="legacy-war-room-open-deployment"',
    'onClick={onEndMeeting}',
    'onClick={onStartMeeting}',
    'onKeyDown={onTerminalKeyDown}',
    'onChange={(event) => onTerminalInputChange(event.target.value)}',
  ]) {
    assert.ok(viewSource.includes(visibleControl), `Legacy War Room control is missing: ${visibleControl}`);
  }

  assert.ok(appSource.includes("const LegacyWarRoomView = lazy(() => import('./project/LegacyWarRoomView.jsx'))"));
  assert.ok(appSource.includes('<LegacyWarRoomView'));
  assert.ok(appSource.includes('backendTargetMissing={legacyWarRoomBackendTargetMissing}'));
  assert.ok(appSource.includes('onOpenDeploymentSettings={openLegacyWarRoomDeploymentSettings}'));
});
