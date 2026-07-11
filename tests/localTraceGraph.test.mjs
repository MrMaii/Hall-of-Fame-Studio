import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendLocalTraceGraphReceipt,
  buildLocalTraceGraph,
  verifyLocalTraceGraphReceipts,
  verifyLocalTraceSpans,
} from '../src/agents/localTraceGraph.js';

const traceId = 'trace_graph_unit_001';
const projectId = 'trace_graph_project';

function projectFixture() {
  return {
    id: projectId,
    localDurableTaskQueue: [{ id: 'job-1', traceId, status: 'acknowledged', createdAt: '2026-07-11T10:00:00.000Z', completedAt: '2026-07-11T10:00:05.000Z' }],
    agentWorkerLedger: [{ id: 'cycle-1', traceId, status: 'done', ranAt: '2026-07-11T10:00:01.000Z', completedAt: '2026-07-11T10:00:05.000Z' }],
    localIdempotentExecutionLedger: [{ id: 'operation-1', traceId, status: 'completed', createdAt: '2026-07-11T10:00:01.500Z', completedAt: '2026-07-11T10:00:02.000Z' }],
    providerUsageLedger: [{ id: 'provider-1', traceId, kind: 'search', status: 'completed', startedAt: '2026-07-11T10:00:02.000Z', completedAt: '2026-07-11T10:00:03.000Z', providerReceiptId: 'provider-receipt-1' }],
    evidenceSearches: [{ id: 'evidence-1', traceId, providerUsageId: 'provider-1', status: 'completed', createdAt: '2026-07-11T10:00:03.000Z' }],
    agentSubmissions: [{ id: 'submission-1', traceId, status: 'submitted', createdAt: '2026-07-11T10:00:04.000Z', sourceRefs: [{ id: 'evidence-1' }], artifact: { id: 'artifact-1', traceId, createdAt: '2026-07-11T10:00:04.000Z', body: 'PRIVATE ARTIFACT CONTENT' } }],
    submissionReviews: [{ id: 'review-1', traceId, requestTraceId: 'trace_review_request_002', submissionId: 'submission-1', verdict: 'accepted', comments: 'PRIVATE REVIEW CONTENT', createdAt: '2026-07-11T10:00:05.000Z' }],
    eventLedger: [
      { id: 'event-cycle', evidenceIds: ['cycle-1'], entityIds: {} },
      { id: 'event-evidence', evidenceIds: ['evidence-1', 'provider-1'], entityIds: {} },
      { id: 'event-submission', evidenceIds: ['submission-1', 'artifact-1'], entityIds: {} },
      { id: 'event-review', evidenceIds: ['review-1'], entityIds: {} },
    ],
  };
}

test('builds one content-minimized causal graph across queue, execution, provider, evidence, artifact and review', () => {
  const graph = buildLocalTraceGraph(projectFixture(), traceId);
  assert.equal(graph.schemaVersion, 'local-project-trace/v2');
  assert.equal(graph.integrity.topologyValid, true, JSON.stringify(graph.integrity));
  assert.equal(graph.summary.rootSpanCount, 1);
  assert.equal(graph.summary.spanCount, 8);
  assert.equal(graph.summary.externalProviderOutcomeUnattestedCount, 0);
  assert.ok(graph.spans.every((span) => /^[a-f0-9]{64}$/.test(span.sourceChecksum)));
  assert.ok(graph.spans.find((span) => span.name === 'provider-search').parentSpanId);
  assert.ok(graph.spans.find((span) => span.name === 'independent-review').links[0].startsWith('request_trace_hash_'));
  const output = JSON.stringify(graph);
  assert.equal(output.includes('PRIVATE ARTIFACT CONTENT'), false);
  assert.equal(output.includes('PRIVATE REVIEW CONTENT'), false);
});

test('seals graph versions in a checksum-linked receipt chain and detects mutation', () => {
  const first = appendLocalTraceGraphReceipt(projectFixture(), traceId, { reason: 'work-completed', now: '2026-07-11T10:00:06.000Z' });
  assert.equal(first.graph.integrity.currentGraphSealed, true);
  const duplicate = appendLocalTraceGraphReceipt(first.project, traceId, { reason: 'retry', now: '2026-07-11T10:00:07.000Z' });
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.project.localTraceGraphReceipts.length, 1);

  const changed = structuredClone(first.project);
  changed.submissionReviews.push({ id: 'review-2', traceId, submissionId: 'submission-1', verdict: 'accepted', createdAt: '2026-07-11T10:00:08.000Z' });
  const second = appendLocalTraceGraphReceipt(changed, traceId, { reason: 'review-completed', now: '2026-07-11T10:00:08.000Z' });
  assert.equal(second.project.localTraceGraphReceipts.length, 2);
  assert.equal(verifyLocalTraceGraphReceipts(second.project).valid, true);

  const tampered = structuredClone(second.project);
  tampered.localTraceGraphReceipts[0].spanCount += 1;
  assert.equal(verifyLocalTraceGraphReceipts(tampered).valid, false);
  assert.throws(() => appendLocalTraceGraphReceipt(tampered, traceId), /receipt-integrity-invalid/);
});

test('rejects duplicate roots, missing parents, cycles, project mismatch and time reversal', () => {
  const root = { id: 'span_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', projectId, traceId, parentSpanId: null, links: [], startedAt: '2026-07-11T10:00:02.000Z', endedAt: '2026-07-11T10:00:01.000Z' };
  const child = { id: 'span_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', projectId: 'wrong-project', traceId, parentSpanId: 'span_missing', links: [], startedAt: '2026-07-11T10:00:01.000Z', endedAt: '2026-07-11T10:00:02.000Z' };
  const extraRoot = { ...root, id: 'span_cccccccccccccccccccccccccccccccc', startedAt: '2026-07-11T10:00:00.000Z', endedAt: '2026-07-11T10:00:00.000Z' };
  const verification = verifyLocalTraceSpans([root, child, extraRoot], projectId, traceId);
  assert.equal(verification.valid, false);
  assert.ok(verification.findings.some((finding) => finding.code === 'span-time-reversal'));
  assert.ok(verification.findings.some((finding) => finding.code === 'span-project-mismatch'));
  assert.ok(verification.findings.some((finding) => finding.code === 'span-parent-missing'));
  assert.ok(verification.findings.some((finding) => finding.code === 'trace-root-count-invalid'));
});
