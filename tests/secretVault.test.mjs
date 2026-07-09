// Characterization tests: lock in current secretVault behavior before any refactor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalSecretVault,
  sealSecretRecord,
  openSecretRecord,
  normalizeSecretVaultStatus,
} from '../src/agents/secretVault.js';

const MASTER_KEY = 'test-master-key';

test('seal/open roundtrip preserves plaintext', async () => {
  const record = await sealSecretRecord({ name: 'model.apikey', value: 'sk-abc123', masterKey: MASTER_KEY });
  assert.equal(record.schemaVersion, 'secret-vault-record/v1');
  assert.equal(record.name, 'model.apikey');
  assert.ok(record.ciphertext && record.iv && record.salt);
  const plaintext = await openSecretRecord(record, { masterKey: MASTER_KEY });
  assert.equal(plaintext, 'sk-abc123');
});

test('open with wrong master key rejects', async () => {
  const record = await sealSecretRecord({ name: 'model.apikey', value: 'sk-abc123', masterKey: MASTER_KEY });
  await assert.rejects(openSecretRecord(record, { masterKey: 'wrong-key' }));
});

test('BUG-004: sealing the same name twice replaces instead of duplicating', async () => {
  const vault = createLocalSecretVault({ enabled: true, masterKey: MASTER_KEY, keyId: 'k1' });
  await vault.seal('model.apikey', 'first-value');
  await vault.seal('model.apikey', 'second-value');
  const records = vault.exportRecords();
  assert.equal(records.length, 1);
  assert.equal(await vault.open(records[0]), 'second-value');
});

test('sealing different names appends separate records', async () => {
  const vault = createLocalSecretVault({ enabled: true, masterKey: MASTER_KEY, keyId: 'k1' });
  await vault.seal('model.apikey', 'a');
  await vault.seal('model.endpoint', 'https://example.com/v1');
  await vault.seal('model.name', 'gpt-test');
  assert.equal(vault.exportRecords().length, 3);
});

test('rotate re-encrypts all records under the next key', async () => {
  const vault = createLocalSecretVault({ enabled: true, masterKey: MASTER_KEY, keyId: 'k1' });
  await vault.seal('model.apikey', 'rotate-me');
  const { receipt } = await vault.rotate({ nextMasterKey: 'next-key', nextKeyId: 'k2' });
  assert.equal(receipt.rotatedRecordCount, 1);
  assert.equal(receipt.plaintextExposed, false);
  const [record] = vault.exportRecords();
  assert.equal(record.keyId, 'k2');
  assert.equal(await vault.open(record), 'rotate-me');
});

test('records() never exposes plaintext or ciphertext material', async () => {
  const vault = createLocalSecretVault({ enabled: true, masterKey: MASTER_KEY, keyId: 'k1' });
  await vault.seal('model.apikey', 'super-secret');
  const [listed] = vault.records();
  assert.equal(listed.name, 'model.apikey');
  assert.equal(listed.encrypted, true);
  assert.ok(!('ciphertext' in listed));
  assert.ok(!JSON.stringify(listed).includes('super-secret'));
});

test('normalizeSecretVaultStatus: ready requires enabled+configured+no raw records', () => {
  assert.equal(normalizeSecretVaultStatus({ enabled: true, configured: true, rawSecretRecordCount: 0 }).ready, true);
  assert.equal(normalizeSecretVaultStatus({ enabled: true, configured: true, rawSecretRecordCount: 2 }).ready, false);
  assert.equal(normalizeSecretVaultStatus({ enabled: false, configured: true }).ready, false);
  assert.equal(normalizeSecretVaultStatus({}).provider, 'none');
});
