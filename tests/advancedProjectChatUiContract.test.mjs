import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const routeViewSource = readFileSync(new URL('../src/project/ProjectChatRouteView.jsx', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../src/project/AdvancedProjectChat.jsx', import.meta.url), 'utf8');

test('complete Group Chat stays lazy and keeps every public collaboration control', () => {
  assert.ok(appSource.includes("const ProjectChatRouteView = lazy(() => import('./project/ProjectChatRouteView.jsx'))"));
  assert.ok(appSource.includes('<ProjectChatRouteView'));
  assert.ok(routeViewSource.includes("import AdvancedProjectChat from './AdvancedProjectChat.jsx'"));
  assert.ok(routeViewSource.includes('<AdvancedProjectChat'));

  for (const publicControl of [
    'project-chat-panel',
    'project-scene-back',
    'project-chat-create-transcript-channel',
    'project-chat-tool-pin',
    'project-chat-transcript-search-form',
    'project-chat-tool-members',
    'project-chat-message-reply-',
    'project-chat-message-mention-',
    'project-chat-message-pin-',
    'project-chat-attachment',
    'project-chat-send',
  ]) {
    assert.ok(chatSource.includes(publicControl), `complete Group Chat must keep ${publicControl}`);
  }
});
