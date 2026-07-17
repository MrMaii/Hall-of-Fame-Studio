import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ProjectDashboardLaunchApprovalWorkflow({
  fallbackRoute,
  managerApproved,
  onRecordReceipt,
  prereqsReady,
  projectId,
  projectText,
  recordDisabled,
  securityApproved,
  sourceBadge,
  workflow,
}) {
  const approvalRoute = workflow.backendRoutes?.launchApprovals || fallbackRoute || `/projects/${projectId}/launch-approvals`;

  return (
    <div data-testid="backend-launch-approval-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Launch Approval Workflow')}</div>
          <div className="font-serif text-base leading-tight">{projectText(workflow.status || 'approval-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          <span className={`node-status-tag ${workflow.readyForPrivatePilot ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {projectText('Pilot Approval')} {workflow.readyForPrivatePilot ? projectText('ready') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Approvals'), workflow.summary?.approvalCount ?? 0],
          [projectText('Pilot Roles'), `${workflow.modes?.find(mode => mode.id === 'private-pilot')?.approvedRoles?.length ?? 0}/${workflow.modes?.find(mode => mode.id === 'private-pilot')?.requiredRoles?.length ?? 0}`],
          [projectText('Production Roles'), `${workflow.modes?.find(mode => mode.id === 'production')?.approvedRoles?.length ?? 0}/${workflow.modes?.find(mode => mode.id === 'production')?.requiredRoles?.length ?? 0}`],
          [projectText('Latest Checksum'), workflow.summary?.latestApprovalChecksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`launch-approval-workflow-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      {workflow.rows?.length > 0 && (
        <div className="mt-2 space-y-1">
          {workflow.rows.slice(0, 3).map(row => (
            <div key={`launch-approval-workflow-row-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
              <div className="min-w-0">
                <div className="font-serif text-sm leading-tight truncate">{row.mode || 'private-pilot'} / {row.approverRole || 'approver'}</div>
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.reason || row.checksum || row.id}</div>
              </div>
              <span className={`node-status-tag ${row.decision === 'approved' ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>{row.decision || 'requested'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-launch-approval-record-manager"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot manager launch approval',
            route: approvalRoute,
            workflowKey: 'launchApprovalWorkflow',
            receiptKey: 'launchApproval',
            reason: 'Manager approves the private-pilot launch from the Ready Package command panel.',
            extraBody: {
              mode: 'private-pilot',
              decision: 'approved',
              approverRole: 'manager',
              approverId: 'director',
              approverName: 'Product Director',
              actorRole: 'manager',
              actorId: 'director',
              source: 'manager-ui-launch-approval',
            },
          })}
          disabled={recordDisabled || !prereqsReady || managerApproved}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <CheckCircle2 size={10} /> {projectText('Approve Manager')}
        </button>
        <button
          type="button"
          data-testid="backend-launch-approval-record-security"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot security launch approval',
            route: approvalRoute,
            workflowKey: 'launchApprovalWorkflow',
            receiptKey: 'launchApproval',
            reason: 'Security approves the private-pilot launch from the Ready Package command panel.',
            extraBody: {
              mode: 'private-pilot',
              decision: 'approved',
              approverRole: 'security-admin',
              approverId: 'security-lead',
              approverName: 'Security Lead',
              actorRole: 'security-admin',
              actorId: 'security-lead',
              source: 'manager-ui-launch-approval',
            },
          })}
          disabled={recordDisabled || !prereqsReady || securityApproved}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <ShieldCheck size={10} /> {projectText('Approve Security')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Approval route')}: {approvalRoute}
      </div>
    </div>
  );
}
