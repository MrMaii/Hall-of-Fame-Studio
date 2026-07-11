import { createHash } from 'node:crypto';

const TRACE_RECEIPT_GENESIS_HASH = '0'.repeat(64);

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
}

function traceIdOf(value = '') {
  const normalized = String(value || '').trim().slice(0, 160);
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/.test(normalized) ? normalized : null;
}

function timeOf(record = {}) {
  return record.startedAt || record.ranAt || record.createdAt || record.time || record.completedAt || record.updatedAt || null;
}

function endTimeOf(record = {}) {
  return record.completedAt || record.acknowledgedAt || record.updatedAt || timeOf(record);
}

function durationMs(startedAt, endedAt) {
  const start = Date.parse(startedAt || '');
  const end = Date.parse(endedAt || '');
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0;
}

function sourceChecksum(record = {}) {
  return sha256(record);
}

function deterministicSpanId(traceId, spanName, entityId) {
  return `span_${sha256(`${traceId}:${spanName}:${entityId}`).slice(0, 32)}`;
}

function statusOf(record = {}) {
  const value = String(record.status || record.executionStatus || record.verdict || '').toLowerCase();
  if (record.ok === false || ['failed', 'denied', 'rejected', 'dead-lettered', 'cancelled', 'ambiguous'].some((item) => value.includes(item))) return value.includes('ambiguous') ? 'ambiguous' : value.includes('cancel') ? 'cancelled' : 'error';
  return 'ok';
}

function publicSpan({ traceId, projectId, name, kind = 'internal', entityKind, record, parentSpanId = null, links = [], spanId = null } = {}) {
  const entityId = String(record?.id || `${entityKind}-unknown`);
  const startedAt = timeOf(record);
  const endedAt = endTimeOf(record);
  return {
    schemaVersion: 'local-trace-span/v1',
    id: spanId || deterministicSpanId(traceId, name, entityId),
    traceId,
    projectId,
    name,
    kind,
    parentSpanId,
    links: [...new Set(links.filter(Boolean))].slice(0, 16),
    status: statusOf(record),
    startedAt,
    endedAt,
    durationMs: durationMs(startedAt, endedAt),
    entityKind,
    entityId,
    sourceChecksum: sourceChecksum(record),
  };
}

export function verifyLocalTraceSpans(spans = [], projectId = null, traceId = null) {
  const findings = [];
  const byId = new Map();
  spans.forEach((span) => {
    if (!span.id || byId.has(span.id)) findings.push({ code: 'duplicate-or-missing-span-id', spanId: span.id || null });
    byId.set(span.id, span);
    if (span.projectId !== projectId) findings.push({ code: 'span-project-mismatch', spanId: span.id });
    if (span.traceId !== traceId) findings.push({ code: 'span-trace-mismatch', spanId: span.id });
    if (span.parentSpanId && span.parentSpanId === span.id) findings.push({ code: 'span-self-parent', spanId: span.id });
    if (Date.parse(span.endedAt || '') < Date.parse(span.startedAt || '')) findings.push({ code: 'span-time-reversal', spanId: span.id });
  });
  spans.forEach((span) => {
    if (span.parentSpanId && !byId.has(span.parentSpanId)) findings.push({ code: 'span-parent-missing', spanId: span.id });
    span.links.forEach((link) => {
      if (!byId.has(link) && !/^request_trace_hash_[a-f0-9]{24}$/.test(link)) findings.push({ code: 'span-link-missing', spanId: span.id });
    });
    const visited = new Set([span.id]);
    let cursor = span;
    while (cursor?.parentSpanId) {
      if (visited.has(cursor.parentSpanId)) {
        findings.push({ code: 'span-parent-cycle', spanId: span.id });
        break;
      }
      visited.add(cursor.parentSpanId);
      cursor = byId.get(cursor.parentSpanId);
    }
  });
  const rootSpanCount = spans.filter((span) => !span.parentSpanId).length;
  if (spans.length && rootSpanCount !== 1) findings.push({ code: 'trace-root-count-invalid', spanId: null });
  return { valid: findings.length === 0, findings, rootSpanCount };
}

export function verifyLocalTraceGraphReceipts(project = {}) {
  const rows = Array.isArray(project.localTraceGraphReceipts) ? project.localTraceGraphReceipts : [];
  const findings = [];
  let previousReceiptHash = project.localTraceGraphPreviousReceiptHash || TRACE_RECEIPT_GENESIS_HASH;
  let expectedSequence = rows.at(-1)?.sequence || 0;
  rows.slice().reverse().forEach((receipt, index) => {
    const { receiptHash, ...base } = receipt;
    const expectedHash = sha256(base);
    if (receipt.sequence !== expectedSequence + index) findings.push({ code: 'trace-receipt-sequence-gap', receiptId: receipt.id || null });
    if (receipt.previousReceiptHash !== previousReceiptHash) findings.push({ code: 'trace-receipt-previous-hash-mismatch', receiptId: receipt.id || null });
    if (receiptHash !== expectedHash) findings.push({ code: 'trace-receipt-hash-mismatch', receiptId: receipt.id || null });
    previousReceiptHash = receiptHash || previousReceiptHash;
  });
  return { valid: findings.length === 0, findings, count: rows.length, rootHash: rows[0]?.receiptHash || TRACE_RECEIPT_GENESIS_HASH };
}

export function buildLocalTraceGraph(project = {}, requestedTraceId = '') {
  const traceId = traceIdOf(requestedTraceId);
  if (!traceId) throw new Error('local-project-trace-id-invalid');
  const projectId = project.id || null;
  const exact = (record) => traceIdOf(record?.traceId) === traceId;
  const queueRows = (project.localDurableTaskQueue || []).filter(exact);
  const executions = (project.localIdempotentExecutionLedger || []).filter(exact);
  const cycles = (project.agentWorkerLedger || []).filter(exact);
  const providers = (project.providerUsageLedger || []).filter(exact);
  const evidence = (project.evidenceSearches || []).filter(exact);
  const submissions = (project.agentSubmissions || []).filter(exact);
  const reviews = (project.submissionReviews || []).filter(exact);
  const artifacts = [...new Map([
    ...submissions.map((submission) => submission.artifact).filter((artifact) => artifact?.id),
    ...(project.artifacts || []).filter(exact),
  ].map((artifact) => [artifact.id, artifact])).values()];
  const spans = [];
  const add = (span) => { spans.push(span); return span; };
  const queueSpans = queueRows.map((record) => add(publicSpan({ traceId, projectId, name: 'durable-queue', kind: 'queue', entityKind: 'durable-task', record })));
  const cycleSpans = cycles.map((record, index) => add(publicSpan({
    traceId, projectId, name: 'agent-work-cycle', kind: 'server', entityKind: 'agent-cycle', record,
    parentSpanId: queueSpans.find((span) => span.entityId === record.durableTaskId)?.id || queueSpans[index]?.id || null,
    spanId: /^span_[a-f0-9]{32}$/.test(record.requestSpanId || '') ? record.requestSpanId : null,
  })));
  const rootSpan = cycleSpans[0] || queueSpans[0] || null;
  const executionSpans = executions.map((record) => add(publicSpan({ traceId, projectId, name: 'idempotent-execution', entityKind: 'idempotent-execution', record, parentSpanId: rootSpan?.id || null })));
  const providerSpans = providers.map((record, index) => add(publicSpan({
    traceId, projectId, name: `provider-${record.kind || 'call'}`, kind: 'client', entityKind: 'provider-usage', record,
    parentSpanId: executionSpans[index]?.id || rootSpan?.id || null,
  })));
  const evidenceSpans = evidence.map((record) => add(publicSpan({
    traceId, projectId, name: 'evidence-search', entityKind: 'evidence-search', record,
    parentSpanId: providerSpans.find((span) => span.entityId === record.providerUsageId)?.id || providerSpans[0]?.id || rootSpan?.id || null,
  })));
  const submissionSpans = submissions.map((record) => add(publicSpan({
    traceId, projectId, name: 'artifact-submission', entityKind: 'submission', record,
    parentSpanId: evidenceSpans.find((span) => (record.sourceRefs || []).some((ref) => String(ref?.id || ref?.sourceId || ref) === span.entityId))?.id || evidenceSpans[0]?.id || rootSpan?.id || null,
  })));
  artifacts.forEach((record) => add(publicSpan({
    traceId, projectId, name: 'artifact-storage', entityKind: 'artifact', record,
    parentSpanId: submissionSpans.find((span) => submissions.find((submission) => submission.id === span.entityId)?.artifact?.id === record.id)?.id || submissionSpans[0]?.id || rootSpan?.id || null,
  })));
  reviews.forEach((record) => {
    const inheritedRequestTrace = traceIdOf(record.requestTraceId);
    add(publicSpan({
      traceId, projectId, name: 'independent-review', entityKind: 'submission-review', record,
      parentSpanId: submissionSpans.find((span) => span.entityId === record.submissionId)?.id || rootSpan?.id || null,
      links: inheritedRequestTrace && inheritedRequestTrace !== traceId ? [`request_trace_hash_${sha256(inheritedRequestTrace).slice(0, 24)}`] : [],
      spanId: /^span_[a-f0-9]{32}$/.test(record.requestSpanId || '') ? record.requestSpanId : null,
    }));
  });
  const sortedSpans = spans.sort((left, right) => (Date.parse(left.startedAt || '') || 0) - (Date.parse(right.startedAt || '') || 0) || left.id.localeCompare(right.id));
  const topology = verifyLocalTraceSpans(sortedSpans, projectId, traceId);
  const receiptsIntegrity = verifyLocalTraceGraphReceipts(project);
  const traceReceipts = (project.localTraceGraphReceipts || []).filter((receipt) => receipt.traceId === traceId);
  const spanManifestChecksum = sha256(sortedSpans);
  const latestReceipt = traceReceipts[0] || null;
  const sourceProofIds = new Set((project.eventLedger || []).flatMap((event) => [event.id, ...(event.evidenceIds || []), ...Object.values(event.entityIds || {})].filter(Boolean).map(String)));
  const proofedSpanCount = sortedSpans.filter((span) => sourceProofIds.has(span.entityId)).length;
  const externalProviderOutcomeUnattestedCount = providers.filter((record) => !record.providerReceiptId && !record.responseId && !record.idempotencyKeyHash && !record.idempotency?.keyHash).length;
  const findings = [
    ...topology.findings,
    ...receiptsIntegrity.findings,
    ...(sortedSpans.length && (!latestReceipt || latestReceipt.spanManifestChecksum !== spanManifestChecksum) ? [{ code: 'trace-current-graph-unsealed', receiptId: latestReceipt?.id || null }] : []),
  ];
  const graphBase = {
    schemaVersion: 'local-project-trace/v2', projectId, traceId,
    summary: {
      spanCount: sortedSpans.length, rootSpanCount: topology.rootSpanCount,
      queueSpanCount: queueSpans.length, agentCycleCount: cycles.length, idempotentExecutionCount: executions.length,
      providerUsageCount: providers.length, evidenceSearchCount: evidence.length, submissionCount: submissions.length,
      artifactCount: artifacts.length, reviewCount: reviews.length, proofedSpanCount,
      externalProviderOutcomeUnattestedCount,
    },
    spans: sortedSpans,
    receiptCount: traceReceipts.length,
    latestReceipt,
    integrity: { valid: findings.length === 0, findings, topologyValid: topology.valid, receiptChainValid: receiptsIntegrity.valid, currentGraphSealed: Boolean(latestReceipt && latestReceipt.spanManifestChecksum === spanManifestChecksum) },
    boundaries: { localOnly: true, remoteCollector: false, distributedClockSafe: false, externalProviderOutcomeRequiresReceipt: true },
  };
  return { ...graphBase, checksum: sha256(graphBase), spanManifestChecksum };
}

export function appendLocalTraceGraphReceipt(project = {}, traceId, { reason = 'trace-materialized', actorId = 'local-runtime', now = new Date().toISOString() } = {}) {
  const integrity = verifyLocalTraceGraphReceipts(project);
  if (!integrity.valid) throw new Error('local-trace-graph-receipt-integrity-invalid');
  const graph = buildLocalTraceGraph(project, traceId);
  const existing = (project.localTraceGraphReceipts || []).find((receipt) => receipt.traceId === graph.traceId && receipt.spanManifestChecksum === graph.spanManifestChecksum);
  if (existing) return { project, receipt: existing, graph, idempotent: true };
  const previous = (project.localTraceGraphReceipts || [])[0] || null;
  const base = {
    schemaVersion: 'local-trace-graph-receipt/v1',
    id: `trace_receipt_${sha256(`${project.id}:${graph.traceId}:${graph.spanManifestChecksum}`).slice(0, 24)}`,
    projectId: project.id, traceId: graph.traceId,
    sequence: (previous?.sequence || 0) + 1,
    previousReceiptHash: previous?.receiptHash || TRACE_RECEIPT_GENESIS_HASH,
    spanManifestChecksum: graph.spanManifestChecksum,
    spanCount: graph.summary.spanCount,
    reason: String(reason || 'trace-materialized').slice(0, 80),
    actorId: String(actorId || 'local-runtime').slice(0, 120),
    createdAt: new Date(Date.parse(now) || Date.now()).toISOString(),
    localOnly: true,
  };
  const receipt = { ...base, receiptHash: sha256(base) };
  const combined = [receipt, ...(project.localTraceGraphReceipts || [])];
  const retained = combined.slice(0, 500);
  const removed = combined.slice(500);
  const updatedProject = {
    ...project,
    localTraceGraphReceipts: retained,
    localTraceGraphPreviousReceiptHash: removed[0]?.receiptHash || project.localTraceGraphPreviousReceiptHash || TRACE_RECEIPT_GENESIS_HASH,
  };
  return { project: updatedProject, receipt, graph: buildLocalTraceGraph(updatedProject, traceId), idempotent: false };
}
