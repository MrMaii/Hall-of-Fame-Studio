export default function ProjectDashboardProductionOperationsControlReceipts({
  fallbackRoute,
  onRecordReceipt,
  projectId,
  projectText,
  recordDisabled,
  workflow,
}) {
  const receiptRoute = workflow.backendRoutes?.productionOperationsControlReceipts || fallbackRoute || `/projects/${projectId}/production-operations-control-receipts`;

  return (
    <div data-testid="backend-production-operations-control-receipts-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Production Operations Control Receipts')}</div>
          <div className="font-serif text-base leading-tight">{projectText(workflow.status || 'receipts-needed')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <span className={`node-status-tag ${workflow.readyForProductionOperations ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {workflow.readyForProductionOperations ? projectText('ops ready') : projectText('receipts needed')}
          </span>
          <button
            type="button"
            data-testid="backend-production-operations-record-controls"
            onClick={() => onRecordReceipt({
              label: 'Production operations control rehearsal',
              route: receiptRoute,
              workflow,
              workflowKey: 'productionOperationsControlReceiptWorkflow',
              receiptKey: 'productionOperationsControlReceipt',
              actorRole: 'security-admin',
              actorId: 'security-lead',
              reason: 'Record local rehearsal evidence for production operations controls from the Manager UI.',
              prefix: 'manager_ui_prod_ops',
              evidenceRouteBase: 'https://local-rehearsal.hofs.invalid/production-operations',
              defaultOwnerRole: 'operations-owner',
            })}
            disabled={recordDisabled || workflow.readyForProductionOperations || !workflow.readyForPrivatePilotOperations}
            className="inline-flex items-center justify-center gap-1 border border-[#7b6542] bg-[#efe2bd] px-3 py-1 font-mono text-[7px] uppercase tracking-widest text-[#251b13] hover:border-[#251b13] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {projectText('Record Rehearsal')}
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Receipts'), workflow.summary?.receiptCount ?? 0],
          [projectText('Verified Controls'), `${workflow.summary?.verifiedControlCount ?? 0}/${workflow.summary?.requiredControlCount ?? 0}`],
          [projectText('Missing Controls'), workflow.summary?.missingControlCount ?? 0],
          [projectText('Latest Receipt'), workflow.latestReceipt?.id || 'missing'],
          [projectText('Private Pilot Ops'), workflow.readyForPrivatePilotOperations ? projectText('ready') : projectText('blocked')],
          [projectText('Control Proof'), workflow.readyForProductionOperationsControls ? projectText('ready') : projectText('blocked')],
          [projectText('Production Ops'), workflow.readyForProductionOperations ? projectText('ready') : projectText('blocked')],
          [projectText('Packet'), workflow.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`production-operations-control-receipts-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(workflow.controlRows || []).filter(row => !row.verified).slice(0, 4).map(row => (
          <div key={`production-operations-control-receipt-row-${row.controlId}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.controlId}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.latestReceiptChecksum || row.status || 'missing'}</div>
            </div>
            <span className={`node-status-tag ${row.verified ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.verified ? projectText('verified') : projectText('missing')}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Ops receipts route')}: {receiptRoute}
      </div>
    </div>
  );
}
