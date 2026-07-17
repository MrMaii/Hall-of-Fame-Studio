export function mergeBackendEventReadModel(project = {}, readModel = {}) {
  if (!Array.isArray(readModel.eventLedger)) return project;

  const eventLedger = readModel.eventLedger;
  const integrity = readModel.summary?.integrity || {};
  const firstEvent = eventLedger[0] || null;
  const lastEvent = eventLedger.at(-1) || null;

  return {
    ...project,
    eventLedger,
    eventLedgerChainVersion: integrity.valid === false ? project.eventLedgerChainVersion : 1,
    eventLedgerPreviousHash: integrity.previousRetainedHash || firstEvent?.previousEventHash || project.eventLedgerPreviousHash,
    eventLedgerRootHash: integrity.rootHash || lastEvent?.eventHash || integrity.previousRetainedHash || project.eventLedgerRootHash,
    eventLedgerFirstSequence: integrity.firstSequence ?? firstEvent?.sequence ?? 0,
    eventLedgerLastSequence: integrity.lastSequence ?? lastEvent?.sequence ?? 0,
    eventLedgerEventCount: readModel.summary?.eventCount ?? integrity.lastSequence ?? lastEvent?.sequence ?? eventLedger.length,
    eventLedgerIntegrityStatus: integrity.valid === false ? 'invalid' : 'valid',
  };
}
