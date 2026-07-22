import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  projectTranscriptPresentation,
  resolveProjectTranscriptStatus,
  shouldShowLocalTranscriptRecovery,
  transcriptRecoveryStatusesFromResults,
  transcriptRecoveryKey,
} from '../src/project/projectTranscriptRecovery.js';

test('keeps backend transcript recovery separate for every project channel', () => {
  assert.equal(transcriptRecoveryKey('project-1', 'main'), 'project-1:main');
  assert.equal(transcriptRecoveryKey('project-1', ''), 'project-1:main');

  const statuses = {
    'project-1:main': 'checking',
    'project-1:decisions': 'offline',
  };
  assert.equal(resolveProjectTranscriptStatus({
    required: true,
    projectId: 'project-1',
    channelId: 'main',
    statuses,
  }), 'checking');
  assert.equal(resolveProjectTranscriptStatus({
    required: true,
    projectId: 'project-1',
    channelId: 'decisions',
    statuses,
  }), 'offline');
});

test('marks every channel independently when a multi-channel transcript refresh partially fails', () => {
  assert.deepEqual(transcriptRecoveryStatusesFromResults({
    projectId: 'project-1',
    channelIds: ['main', 'decisions', 'research'],
    channelResults: [
      { status: 'fulfilled', value: { channelId: 'main', messages: [] } },
      { status: 'rejected', reason: new Error('timeout') },
      { status: 'fulfilled', value: null },
    ],
  }), {
    'project-1:main': 'ready',
    'project-1:decisions': 'offline',
    'project-1:research': 'offline',
  });
});

test('does not call an unverified backend transcript empty', () => {
  assert.equal(resolveProjectTranscriptStatus({
    required: true,
    projectId: 'project-1',
    channelId: 'main',
  }), 'checking');
  assert.equal(resolveProjectTranscriptStatus({
    required: true,
    projectId: 'project-1',
    channelId: 'main',
    transcript: { channelId: 'main', messages: [] },
  }), 'ready');
  assert.equal(resolveProjectTranscriptStatus({ required: false }), 'ready');
});

test('presents restoring, offline, and verified-empty transcript states distinctly', () => {
  assert.deepEqual(projectTranscriptPresentation({ status: 'checking', messageCount: 0, language: 'zh' }), {
    state: 'restoring',
    title: '聊天记录正在恢复',
    detail: '正在读取这个频道的历史消息。',
  });
  assert.deepEqual(projectTranscriptPresentation({ status: 'offline', messageCount: 0, language: 'zh' }), {
    state: 'offline',
    title: '暂时无法恢复聊天记录',
    detail: '连接恢复后可重新加载；现在不会把它误显示为空频道。',
  });
  assert.deepEqual(projectTranscriptPresentation({ status: 'ready', messageCount: 0, language: 'zh' }), {
    state: 'empty',
    title: '这里还没有消息',
    detail: '发送第一条信息后，团队回复会显示在这里。',
  });
  assert.equal(projectTranscriptPresentation({ status: 'checking', messageCount: 2 }).state, 'ready');
});

test('keeps locally recovered history visible while a backend transcript is offline', () => {
  assert.equal(shouldShowLocalTranscriptRecovery({
    required: true,
    status: 'offline',
    localMessageCount: 2,
  }), true);
  assert.equal(shouldShowLocalTranscriptRecovery({
    required: true,
    status: 'offline',
    localMessageCount: 0,
  }), false);
  assert.equal(shouldShowLocalTranscriptRecovery({
    required: true,
    status: 'checking',
    localMessageCount: 2,
  }), false);
  assert.deepEqual(projectTranscriptPresentation({
    status: 'offline',
    messageCount: 2,
    usingLocalRecovery: true,
  }), {
    state: 'local-recovery',
    title: 'Showing recovered local chat history',
    detail: 'The backend transcript is temporarily unavailable. These messages are restored from this device and can be synced again after the connection recovers.',
  });
});

test('wires the independent recovery state into both chat surfaces', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const simpleSource = readFileSync(new URL('../src/project/ProjectChatPanel.jsx', import.meta.url), 'utf8');
  const advancedSource = readFileSync(new URL('../src/project/AdvancedProjectChat.jsx', import.meta.url), 'utf8');

  assert.ok(appSource.includes('transcriptRecoveryStatuses'));
  assert.ok(appSource.includes('resolveProjectTranscriptStatus({'));
  assert.ok(appSource.includes('shouldShowLocalTranscriptRecovery({'));
  assert.ok(appSource.includes('usingLocalRecovery: usingLocalTranscriptRecovery'));
  assert.ok(appSource.includes("channelId ? (silent ? 5000 : 10000)"));
  assert.ok(appSource.includes('transcriptPresentation={transcriptPresentation}'));
  assert.ok(!appSource.includes('restoring={backendChannelTranscriptRequired && backendStation.loading'));
  assert.ok(simpleSource.includes('project-chat-transcript-${transcriptPresentation.state}'));
  assert.ok(simpleSource.includes("transcriptPresentation.state === 'local-recovery'"));
  assert.ok(advancedSource.includes('project-chat-transcript-${transcriptPresentation.state}'));
  assert.ok(advancedSource.includes("transcriptPresentation.state === 'local-recovery'"));
});
