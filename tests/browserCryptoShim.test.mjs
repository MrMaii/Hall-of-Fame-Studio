import assert from 'node:assert/strict';
import test from 'node:test';

import { createHash, randomUUID } from '../src/shims/nodeCrypto.js';

test('browser crypto shim matches the standard SHA-256 vector and exposes secure UUID shape', () => {
  const digest = createHash('sha256').update('a').update('bc').digest('hex');
  assert.equal(digest, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(randomUUID(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.throws(() => createHash('md5'), /unsupported-browser-hash-algorithm/);
});
