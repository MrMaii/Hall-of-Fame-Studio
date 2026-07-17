import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectSimpleChat.jsx', import.meta.url);
const completeRouteUrl = new URL('../src/project/ProjectChatRouteView.jsx', import.meta.url);

test('simple project chat stays lazy while all chat operations remain connected', () => {
  assert.ok(appSource.includes("const ProjectSimpleChat = lazy(() => import('./project/ProjectSimpleChat.jsx'));"));
  assert.ok(appSource.includes('<ProjectSimpleChat'));
  assert.ok(appSource.includes('if (!projectDashboardAdvancedOpen)'));
  assert.ok(appSource.includes('onBack={exitProjectScene}'));
  assert.ok(appSource.includes('onSelectChannel={setActiveChannelId}'));
  assert.ok(appSource.includes('onInputChange={event => setChatInput(event.target.value)}'));
  assert.ok(appSource.includes('onInputKeyDown={handleSimpleChatKeyDown}'));
  assert.ok(appSource.includes('onSend={submitChatInput}'));
  assert.ok(appSource.includes('onReload={() => syncBackendProjectTranscripts({'));

  assert.ok(appSource.includes("const ProjectChatRouteView = lazy(() => import('./project/ProjectChatRouteView.jsx'));"));
  assert.ok(appSource.includes('<ProjectChatRouteView'));
  assert.ok(appSource.includes("if (projectMode === 'chat') return renderProjectChat();"));

  const componentSource = readFileSync(componentUrl, 'utf8');
  assert.ok(componentSource.includes("lazy(() => import('./ProjectChatPanel.jsx'))"));
  assert.ok(componentSource.includes('data-testid="project-simple-chat"'));
  assert.ok(componentSource.includes('<ProjectChatPanel'));

  const completeRouteSource = readFileSync(completeRouteUrl, 'utf8');
  assert.ok(completeRouteSource.includes("import AdvancedProjectChat from './AdvancedProjectChat.jsx'"));
  assert.ok(completeRouteSource.includes('<AdvancedProjectChat'));
});
