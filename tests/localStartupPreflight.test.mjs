import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';

import {
  findAvailableLocalPort,
  validateLocalNodeVersion,
} from '../src/localRuntime/localStartupPreflight.js';

test('startup rejects unsupported Node versions with a clear local message', () => {
  assert.equal(validateLocalNodeVersion('18.20.0').ok, false);
  assert.match(validateLocalNodeVersion('18.20.0').message, /Node\.js 20/);
  assert.equal(validateLocalNodeVersion('20.0.0').ok, true);
  assert.equal(validateLocalNodeVersion('24.18.0').ok, true);
});

test('startup selects the next local port when the preferred port is occupied', async () => {
  const occupied = createServer();
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve));
  const preferredPort = occupied.address().port;
  try {
    const selected = await findAvailableLocalPort({ host: '127.0.0.1', preferredPort, attempts: 8 });
    assert.notEqual(selected, preferredPort);
    assert.ok(selected > preferredPort);
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
