import { renameSync } from 'node:fs';

const RETRYABLE_FILE_LOCK_CODES = new Set(['EACCES', 'EBUSY', 'EPERM']);

function wait(milliseconds) {
  if (!milliseconds || milliseconds <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function replaceFileWithRetry(
  sourcePath,
  targetPath,
  { rename = renameSync, maxAttempts = 5, retryDelayMs = 8 } = {},
) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return rename(sourcePath, targetPath);
    } catch (error) {
      if (!RETRYABLE_FILE_LOCK_CODES.has(error?.code) || attempt === maxAttempts - 1) throw error;
      wait(retryDelayMs * (attempt + 1));
    }
  }
}
