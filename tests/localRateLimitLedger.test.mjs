import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import test from 'node:test';

import { createLocalRateLimitLedger } from '../src/agents/localRateLimitLedger.js';

const now = '2026-07-11T12:00:00.000Z';
const dimensions = { projectId: 'p', actorId: 'user-a', provider: 'local-model', model: 'm1', tool: 'model:artifact-draft' };

test('enforces project actor model tool and concurrency dimensions with restart-safe settlement', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-rate-ledger-'));
  const filePath = join(directory, 'rates.json');
  try {
    let ledger = createLocalRateLimitLedger({ filePath });
    const first = ledger.claim({ ...dimensions, idempotencyKey: 'request-1', limits: { projectHourly: 3, actorHourly: 1, modelHourly: 2, toolHourly: 2, projectConcurrent: 1 }, now });
    assert.equal(first.allowed, true);
    assert.match(first.claim.actorHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(first.claim).includes('user-a'), false);
    assert.equal(ledger.claim({ ...dimensions, actorId: 'user-b', idempotencyKey: 'request-concurrent', limits: { projectConcurrent: 1 }, now }).reason, 'local-rate-limit-project-concurrent-exceeded');
    ledger.resolve({ claimId: first.claim.id, outcome: 'completed', counted: true, now: '2026-07-11T12:00:01.000Z' });
    ledger = createLocalRateLimitLedger({ filePath });
    assert.equal(ledger.claim({ ...dimensions, idempotencyKey: 'request-actor', limits: { actorHourly: 1 }, now: '2026-07-11T12:01:00.000Z' }).reason, 'local-rate-limit-actor-hourly-exceeded');
    assert.equal(ledger.claim({ ...dimensions, actorId: 'user-b', idempotencyKey: 'request-2', limits: { projectHourly: 3, modelHourly: 2, toolHourly: 2 }, now: '2026-07-11T12:01:00.000Z' }).allowed, true);
    ledger.resolve({ claimId: ledger.snapshot({ now }).entries.find((row) => row.idempotencyKeyHash !== first.claim.idempotencyKeyHash && row.status === 'active').id, outcome: 'failed-after-dispatch', counted: true, now: '2026-07-11T12:01:01.000Z' });
    assert.equal(ledger.claim({ ...dimensions, actorId: 'user-c', idempotencyKey: 'request-model', limits: { modelHourly: 2 }, now: '2026-07-11T12:02:00.000Z' }).reason, 'local-rate-limit-model-hourly-exceeded');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('expires abandoned concurrency claims, distinguishes pre-dispatch release, and fails tampering closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-rate-expiry-'));
  const filePath = join(directory, 'rates.json');
  try {
    const ledger = createLocalRateLimitLedger({ filePath, claimTtlMs: 1000 });
    const abandoned = ledger.claim({ ...dimensions, idempotencyKey: 'abandoned', limits: { projectConcurrent: 1 }, now });
    assert.equal(ledger.claim({ ...dimensions, idempotencyKey: 'after-expiry', limits: { projectConcurrent: 1 }, now: '2026-07-11T12:00:02.000Z' }).allowed, true);
    ledger.resolve({ claimId: abandoned.claim.id, outcome: 'pre-dispatch-save-failed', counted: false, now: '2026-07-11T12:00:03.000Z' });
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    raw.entries[0].provider = 'tampered';
    writeFileSync(filePath, JSON.stringify(raw), 'utf8');
    assert.throws(() => ledger.snapshot({ now }), /integrity-invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('recovers only stale dead-owner locks and times out on a live owner', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-rate-lock-'));
  const filePath = join(directory, 'rates.json');
  const lockPath = `${filePath}.lock`;
  try {
    writeFileSync(lockPath, JSON.stringify({ pid: 99999999, nonce: 'dead', acquiredAt: '2020-01-01T00:00:00.000Z' }), 'utf8');
    const recovered = createLocalRateLimitLedger({ filePath, lockStaleMs: 1, lockTimeoutMs: 100 }).claim({ ...dimensions, idempotencyKey: 'stale-recovery', now });
    assert.equal(recovered.allowed, true);
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, nonce: 'live', acquiredAt: new Date().toISOString() }), 'utf8');
    assert.throws(() => createLocalRateLimitLedger({ filePath, lockTimeoutMs: 20 }).claim({ ...dimensions, idempotencyKey: 'lock-timeout', now }), /lock-timeout/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('admits exactly one claimant under two-process contention', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'hofs-rate-process-'));
  const filePath = join(directory, 'rates.json');
  const moduleUrl = pathToFileURL(join(process.cwd(), 'src/agents/localRateLimitLedger.js')).href;
  const code = `import { createLocalRateLimitLedger } from ${JSON.stringify(moduleUrl)}; const ledger=createLocalRateLimitLedger({filePath:process.argv[1]}); const r=ledger.claim({projectId:'p',actorId:process.argv[2],provider:'x',model:'m',tool:'t',idempotencyKey:process.argv[2],limits:{projectConcurrent:1},now:'2026-07-11T12:00:00.000Z'}); process.stdout.write(JSON.stringify({allowed:r.allowed,reason:r.reason}));`;
  const run = (actor) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, filePath, actor], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => status === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
  });
  try {
    const results = await Promise.all([run('process-a'), run('process-b')]);
    assert.equal(results.filter((row) => row.allowed).length, 1);
    assert.equal(results.filter((row) => row.reason === 'local-rate-limit-project-concurrent-exceeded').length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
