import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const inputSources = [
  readFileSync(new URL('../src/meeting/MeetingInputPanel.jsx', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/meeting/AdvancedMeetingRoom.jsx', import.meta.url), 'utf8'),
];

test('meeting inputs claim the floor from draft content instead of focus', () => {
  inputSources.forEach((source) => {
    assert.ok(source.includes('meetingDraftClaimsFloor(nextValue)'));
    assert.equal(source.includes('onFocus='), false);
    assert.equal(source.includes('onBlur='), false);
    assert.equal(source.includes('onCompositionStart='), false);
  });
});
