import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceFileWithRetry } from '../src/agents/atomicFileReplace.js';

test('retries transient Windows file-lock errors before replacing an atomic snapshot', () => {
  let attempts = 0;
  replaceFileWithRetry('snapshot.tmp', 'snapshot.json', {
    retryDelayMs: 0,
    rename(sourcePath, targetPath) {
      attempts += 1;
      assert.equal(sourcePath, 'snapshot.tmp');
      assert.equal(targetPath, 'snapshot.json');
      if (attempts < 3) {
        const error = new Error('file is temporarily locked');
        error.code = 'EPERM';
        throw error;
      }
    },
  });
  assert.equal(attempts, 3);
});

test('does not hide non-retryable file replacement errors', () => {
  const error = new Error('disk full');
  error.code = 'ENOSPC';
  assert.throws(() => replaceFileWithRetry('snapshot.tmp', 'snapshot.json', {
    retryDelayMs: 0,
    rename() {
      throw error;
    },
  }), error);
});
