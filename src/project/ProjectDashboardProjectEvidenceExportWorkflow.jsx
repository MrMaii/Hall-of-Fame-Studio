import React from 'react';
import { CheckCircle2, FileText, PackageCheck, ShieldCheck } from 'lucide-react';

export default function ProjectDashboardProjectEvidenceExportWorkflow({ view = {} }) {
  const {
    downloadAuditDisabled,
    managerApprovalDisabled,
    model,
    onApproveManager,
    onApproveSecurity,
    onRecordDownload,
    onRequestPackage,
    requestDisabled,
    routePath,
    securityApprovalDisabled,
    sourceBadge,
    text = value => value,
  } = view;

  return (
    <div data-testid="backend-project-evidence-export-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{text('Project Evidence Export Workflow')}</div>
          <div className="font-serif text-base leading-tight">{text(model.status || 'export-request-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge}
          <span className={`node-status-tag ${model.readyForPrivatePilotHandoff ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {model.readyForPrivatePilotHandoff ? text('handoff ready') : text('approval needed')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [text('Requests'), model.summary?.requestCount ?? 0],
          [text('Approvals'), model.summary?.approvalCount ?? 0],
          [text('Download Audits'), model.summary?.downloadAuditCount ?? 0],
          [text('Package Gates'), `${model.summary?.packagePassedGateCount ?? 0}/${model.summary?.packageGateCount ?? 0}`],
          [text('Failed Gates'), model.summary?.failedGateCount ?? 0],
          [text('Private Pilot'), model.readyForPrivatePilotHandoff ? text('ready') : text('blocked')],
          [text('Local Package'), model.readyForPrivatePilotDownload ? text('ready') : text('audit-needed')],
          [text('Production Export'), model.readyForProductionExport ? text('ready') : text('blocked')],
          [text('Archive'), model.summary?.archiveChecksum || 'missing'],
          [text('Packet'), model.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`project-evidence-export-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-project-evidence-export-request"
          onClick={onRequestPackage}
          disabled={requestDisabled}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <PackageCheck size={10} /> {text('Request Package')}
        </button>
        <button
          type="button"
          data-testid="backend-project-evidence-export-approve-manager"
          onClick={onApproveManager}
          disabled={managerApprovalDisabled}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <CheckCircle2 size={10} /> {text('Approve Manager')}
        </button>
        <button
          type="button"
          data-testid="backend-project-evidence-export-approve-security"
          onClick={onApproveSecurity}
          disabled={securityApprovalDisabled}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <ShieldCheck size={10} /> {text('Approve Security')}
        </button>
        <button
          type="button"
          data-testid="backend-project-evidence-export-record-download-audit"
          onClick={onRecordDownload}
          disabled={downloadAuditDisabled}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <FileText size={10} /> {text('Record Download')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {text('Export route')}: {routePath}
      </div>
    </div>
  );
}
