import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const routeViewUrl = new URL('../src/project/ProjectChatRouteView.jsx', import.meta.url);

test('complete Group Chat display loads independently while every collaboration action stays in App', () => {
  assert.ok(existsSync(routeViewUrl), 'ProjectChatRouteView must exist');
  const routeViewSource = readFileSync(routeViewUrl, 'utf8');

  assert.ok(appSource.includes("lazy(() => import('./project/ProjectChatRouteView.jsx'))"));
  assert.ok(appSource.includes('<ProjectChatRouteView'));
  assert.ok(!appSource.includes("lazy(() => import('./project/AdvancedProjectChat.jsx'))"));
  assert.ok(!appSource.includes('<AdvancedProjectChat'));

  for (const retainedDisplay of [
    'AdvancedProjectChat',
    'collaborationMessageMeta',
    'receiptSummary',
    'pinnedTranscriptRowsByMessageId',
    'transcriptReplyRowsByParentMessageId',
    'transcriptMentionRowsBySourceMessageId',
    'transcriptAttachmentRowsByMessageId',
  ]) {
    assert.ok(routeViewSource.includes(retainedDisplay), `Group Chat route view is missing ${retainedDisplay}`);
  }

  for (const retainedAction of [
    'submitChatInput',
    'createProjectTranscriptChannel',
    'runBackendTranscriptSearch',
    'pinBackendTranscriptChannel',
    'pinBackendTranscriptMessage',
    'replyToBackendTranscriptMessage',
    'mentionBackendTranscriptMessage',
    'handleBackendTranscriptAttachmentChange',
    'syncBackendProjectTranscripts',
    'syncBackendTranscriptMemberPresence',
  ]) {
    assert.ok(appSource.includes(retainedAction), `App must retain ${retainedAction}`);
  }

  assert.ok(!routeViewSource.includes('fetch('), 'route display must not add direct backend writes');
  assert.ok(!routeViewSource.includes('agentProjectApi'), 'route display must not import the backend API');

  const receivedViewFields = routeViewSource.slice(
    routeViewSource.indexOf('  const {'),
    routeViewSource.indexOf('  } = view;')
  );
  assert.ok(receivedViewFields.includes('transcriptSearchResults,'), 'route display must receive transcript search results before reading them');
});
