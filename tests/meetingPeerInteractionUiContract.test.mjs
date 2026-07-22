import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const roomSource = readFileSync(resolve('src/meeting/AdvancedMeetingRoom.jsx'), 'utf8');
const appSource = readFileSync(resolve('src/App.jsx'), 'utf8');

test('meeting room renders persisted peer reply and interaction intent metadata', () => {
  assert.match(roomSource, /data-testid="meeting-peer-reply-context"/);
  assert.match(roomSource, /log\.replyToTurnId/);
  assert.match(roomSource, /log\.targetSpeakerId/);
  assert.match(roomSource, /log\.interactionIntent/);
  assert.match(roomSource, /interactionIntentText/);
});

test('kickoff transcript mapping passes causal metadata to the meeting room', () => {
  const mappingStart = appSource.indexOf('const meetingTranscript = sessionTranscript.length');
  const mappingEnd = appSource.indexOf('const meetingRoleQuestions', mappingStart);
  const mappingSource = appSource.slice(mappingStart, mappingEnd);
  assert.match(mappingSource, /replyToTurnId:/);
  assert.match(mappingSource, /targetSpeakerId:/);
  assert.match(mappingSource, /interactionIntent:/);
  assert.match(mappingSource, /topicId:/);
  assert.match(mappingSource, /exchangeIndex:/);
});

test('backend and local meeting playback retain causal metadata in room transcript entries', () => {
  const backendStart = appSource.indexOf('const playBackendMeetingTurns =');
  const backendEnd = appSource.indexOf('const blockMissingBackendMeetingTurns', backendStart);
  const backendSource = appSource.slice(backendStart, backendEnd);
  const localStart = appSource.indexOf('const runRoomSimulation =');
  const localEnd = appSource.indexOf('const queueRoomChangeDiscussion', localStart);
  const localSource = appSource.slice(localStart, localEnd);

  for (const source of [backendSource, localSource]) {
    assert.match(source, /replyToTurnId:/);
    assert.match(source, /targetSpeakerId:/);
    assert.match(source, /interactionIntent:/);
    assert.match(source, /topicId:/);
    assert.match(source, /exchangeIndex:/);
  }
});
