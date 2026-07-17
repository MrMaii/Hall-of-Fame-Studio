import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const validationSource = readFileSync(new URL('../scripts/validate-manager-backend-ui.mjs', import.meta.url), 'utf8');

function functionSource(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Expected ${startMarker} source block.`);
  return appSource.slice(start, end);
}

test('Agent Workbench shows successful write receipts before refreshing heavy read models', () => {
  const cases = [
    ['const runBackendAgentEvidenceSearch = async', 'const runBackendAgentArtifactSubmission = async', "agentWorkbenchReceiptPatch(payload, 'provider-evidence-search')"],
    ['const runBackendAgentArtifactSubmission = async', 'const runBackendAgentArtifactDraft = async', "agentWorkbenchReceiptPatch(payload, 'artifact-submission')"],
    ['const runBackendAgentArtifactDraft = async', 'const runBackendAgentPulse = async', "agentWorkbenchReceiptPatch(payload, 'artifact-draft-submit')"],
  ];

  for (const [start, end, receiptMarker] of cases) {
    const source = functionSource(start, end);
    const receiptIndex = source.indexOf(receiptMarker);
    const refreshIndex = source.indexOf('await refreshAgentWriteReadModels');
    assert.ok(receiptIndex >= 0, `${receiptMarker} must remain present.`);
    assert.ok(refreshIndex > receiptIndex, `${receiptMarker} must render before heavy read-model refresh.`);
  }
});

test('Agent Workbench writes tolerate a busy local backend', () => {
  const source = appSource.slice(
    appSource.indexOf('const runBackendAgentEvidenceSearch = async'),
    appSource.indexOf('const runBackendAgentPulse = async'),
  );
  const timeouts = source.match(/timeoutMs: 60_000/g) || [];
  assert.equal(timeouts.length, 3);
});

test('the long backend validation allows Agent Workbench receipts to arrive under local load', () => {
  const waits = validationSource.match(/getByTestId\('agent-workbench-receipt-turing'\)\.waitFor\(\{ state: 'visible', timeout: 65000 \}\)/g) || [];
  assert.equal(waits.length, 3);
});
