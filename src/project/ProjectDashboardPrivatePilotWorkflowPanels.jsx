import { Activity, CheckCircle2, PackageCheck, Play } from 'lucide-react';

export default function ProjectDashboardPrivatePilotWorkflowPanels({
  acceptanceReport,
  fallbackRoutes,
  launchHealth,
  launchRun,
  onRecordReceipt,
  projectText,
  recordDisabled,
  releaseCandidate,
  sourceBadge,
}) {
  return (
    <>
  {releaseCandidate && (
    <div data-testid="backend-private-pilot-release-candidate-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Private Pilot Release Candidate')}</div>
          <div className="font-serif text-base leading-tight">{projectText(releaseCandidate.status || 'record-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge(releaseCandidate, 'backend-private-pilot-release-candidate-workflow-source')}
          <span className={`node-status-tag ${releaseCandidate.readyForPrivatePilotRelease ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {releaseCandidate.readyForPrivatePilotRelease ? projectText('candidate ready') : releaseCandidate.readyToRecord ? projectText('record needed') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Ready To Record'), releaseCandidate.readyToRecord ? projectText('yes') : projectText('no')],
          [projectText('Candidate Ready'), releaseCandidate.readyForPrivatePilotRelease ? projectText('ready') : projectText('record')],
          [projectText('Candidates'), `${releaseCandidate.summary?.readyCandidateCount ?? 0}/${releaseCandidate.summary?.candidateCount ?? 0}`],
          [projectText('Gates'), `${releaseCandidate.summary?.passedGateCount ?? 0}/${releaseCandidate.summary?.gateCount ?? 0}`],
          [projectText('Failed Gates'), releaseCandidate.summary?.failedGateCount ?? 0],
          [projectText('Failed Blockers'), releaseCandidate.summary?.failedBlockerGateCount ?? 0],
          [projectText('Proofs'), releaseCandidate.summary?.proofIdCount ?? 0],
          [projectText('Events'), releaseCandidate.summary?.eventIdCount ?? 0],
          [projectText('Latest Candidate'), releaseCandidate.latestCandidate?.id || 'missing'],
          [projectText('Packet'), releaseCandidate.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`private-pilot-release-candidate-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(releaseCandidate.failedPrerequisiteGates?.length ? releaseCandidate.failedPrerequisiteGates : releaseCandidate.prerequisiteGates || []).slice(0, 4).map(row => (
          <div key={`private-pilot-release-candidate-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : row.status || 'missing'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-private-pilot-record-release-candidate"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot release candidate',
            route: releaseCandidate.backendRoutes?.privatePilotReleaseCandidates || fallbackRoutes.releaseCandidates,
            workflowKey: 'privatePilotReleaseCandidateWorkflow',
            receiptKey: 'privatePilotReleaseCandidate',
            reason: 'Manager records the private-pilot release candidate from the Ready Package command panel.',
          })}
          disabled={recordDisabled || !releaseCandidate.readyToRecord || releaseCandidate.readyForPrivatePilotRelease}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <PackageCheck size={10} /> {projectText('Record Candidate')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Candidate route')}: {releaseCandidate.backendRoutes?.privatePilotReleaseCandidates || fallbackRoutes.releaseCandidates}
      </div>
    </div>
  )}
  {launchRun && (
    <div data-testid="backend-private-pilot-launch-run-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Private Pilot Launch Run')}</div>
          <div className="font-serif text-base leading-tight">{projectText(launchRun.status || 'launch-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge(launchRun, 'backend-private-pilot-launch-run-workflow-source')}
          <span className={`node-status-tag ${launchRun.readyForPrivatePilotLaunch ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {launchRun.readyForPrivatePilotLaunch ? projectText('launch ready') : launchRun.readyToLaunch ? projectText('record needed') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Ready To Launch'), launchRun.readyToLaunch ? projectText('yes') : projectText('no')],
          [projectText('Launch Ready'), launchRun.readyForPrivatePilotLaunch ? projectText('ready') : projectText('record')],
          [projectText('Launch Runs'), `${launchRun.summary?.readyRunCount ?? 0}/${launchRun.summary?.runCount ?? 0}`],
          [projectText('Gates'), `${launchRun.summary?.passedGateCount ?? 0}/${launchRun.summary?.gateCount ?? 0}`],
          [projectText('Failed Gates'), launchRun.summary?.failedGateCount ?? 0],
          [projectText('Failed Blockers'), launchRun.summary?.failedBlockerGateCount ?? 0],
          [projectText('Proofs'), launchRun.summary?.proofIdCount ?? 0],
          [projectText('Events'), launchRun.summary?.eventIdCount ?? 0],
          [projectText('Latest Run'), launchRun.latestRun?.id || 'missing'],
          [projectText('Packet'), launchRun.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`private-pilot-launch-run-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(launchRun.failedLaunchGates?.length ? launchRun.failedLaunchGates : launchRun.launchGates || []).slice(0, 4).map(row => (
          <div key={`private-pilot-launch-run-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : row.status || 'missing'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-private-pilot-record-launch-run"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot launch run',
            route: launchRun.backendRoutes?.privatePilotLaunchRuns || fallbackRoutes.launchRuns,
            workflowKey: 'privatePilotLaunchRunWorkflow',
            receiptKey: 'privatePilotLaunchRun',
            reason: 'Manager records the controlled private-pilot launch run from the Ready Package command panel.',
            extraBody: { launchWindow: 'manager-ui controlled private-pilot launch window' },
          })}
          disabled={recordDisabled || !launchRun.readyToLaunch || launchRun.readyForPrivatePilotLaunch}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <Play size={10} /> {projectText('Record Launch')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Launch run route')}: {launchRun.backendRoutes?.privatePilotLaunchRuns || fallbackRoutes.launchRuns}
      </div>
    </div>
  )}
  {launchHealth && (
    <div data-testid="backend-private-pilot-launch-health-check-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Private Pilot Launch Health')}</div>
          <div className="font-serif text-base leading-tight">{projectText(launchHealth.status || 'check-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge(launchHealth, 'backend-private-pilot-launch-health-check-workflow-source')}
          <span className={`node-status-tag ${launchHealth.readyForPrivatePilotMonitoring ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {launchHealth.readyForPrivatePilotMonitoring ? projectText('health ready') : launchHealth.readyToCheck ? projectText('record needed') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Ready To Check'), launchHealth.readyToCheck ? projectText('yes') : projectText('no')],
          [projectText('Health Ready'), launchHealth.readyForPrivatePilotMonitoring ? projectText('ready') : projectText('record')],
          [projectText('Health Checks'), `${launchHealth.summary?.readyHealthCheckCount ?? 0}/${launchHealth.summary?.healthCheckCount ?? 0}`],
          [projectText('Gates'), `${launchHealth.summary?.passedGateCount ?? 0}/${launchHealth.summary?.gateCount ?? 0}`],
          [projectText('Failed Gates'), launchHealth.summary?.failedGateCount ?? 0],
          [projectText('Failed Blockers'), launchHealth.summary?.failedBlockerGateCount ?? 0],
          [projectText('Proofs'), launchHealth.summary?.proofIdCount ?? 0],
          [projectText('Events'), launchHealth.summary?.eventIdCount ?? 0],
          [projectText('Latest Check'), launchHealth.latestHealthCheck?.id || 'missing'],
          [projectText('Packet'), launchHealth.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`private-pilot-launch-health-check-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(launchHealth.failedHealthGates?.length ? launchHealth.failedHealthGates : launchHealth.healthGates || []).slice(0, 4).map(row => (
          <div key={`private-pilot-launch-health-check-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : row.severity === 'warning' ? 'bg-[#c2912f] text-[#251b13]' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : row.status || 'missing'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-private-pilot-record-launch-health"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot launch health',
            route: launchHealth.backendRoutes?.privatePilotLaunchHealthChecks || fallbackRoutes.launchHealthChecks,
            workflowKey: 'privatePilotLaunchHealthCheckWorkflow',
            receiptKey: 'privatePilotLaunchHealthCheck',
            reason: 'Manager records the private-pilot post-launch health receipt from the Ready Package command panel.',
          })}
          disabled={recordDisabled || !launchHealth.readyToCheck || launchHealth.readyForPrivatePilotMonitoring}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <Activity size={10} /> {projectText('Record Health')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Health route')}: {launchHealth.backendRoutes?.privatePilotLaunchHealthChecks || fallbackRoutes.launchHealthChecks}
      </div>
    </div>
  )}
  {acceptanceReport && (
    <div data-testid="backend-private-pilot-acceptance-report-workflow-snapshot" className="mt-3 border border-[#d8c99f] bg-[#efe2bd]/55 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="font-mono text-[8px] uppercase tracking-widest text-[#8f1e18]">{projectText('Private Pilot Acceptance Report')}</div>
          <div className="font-serif text-base leading-tight">{projectText(acceptanceReport.status || 'report-needed')}</div>
        </div>
        <div className="flex flex-wrap gap-1 md:justify-end">
          {sourceBadge(acceptanceReport, 'backend-private-pilot-acceptance-report-workflow-source')}
          <span className={`node-status-tag ${acceptanceReport.readyForPrivatePilotAcceptance ? 'bg-[#59684b] text-white' : 'bg-[#8f1e18] text-white'}`}>
            {acceptanceReport.readyForPrivatePilotAcceptance ? projectText('acceptance ready') : acceptanceReport.readyToReport ? projectText('record needed') : projectText('blocked')}
          </span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          [projectText('Ready To Report'), acceptanceReport.readyToReport ? projectText('yes') : projectText('no')],
          [projectText('Acceptance Ready'), acceptanceReport.readyForPrivatePilotAcceptance ? projectText('ready') : projectText('record')],
          [projectText('Reports'), `${acceptanceReport.summary?.readyReportCount ?? 0}/${acceptanceReport.summary?.reportCount ?? 0}`],
          [projectText('Gates'), `${acceptanceReport.summary?.passedGateCount ?? 0}/${acceptanceReport.summary?.gateCount ?? 0}`],
          [projectText('Failed Gates'), acceptanceReport.summary?.failedGateCount ?? 0],
          [projectText('Failed Blockers'), acceptanceReport.summary?.failedBlockerGateCount ?? 0],
          [projectText('Proofs'), acceptanceReport.summary?.proofIdCount ?? 0],
          [projectText('Events'), acceptanceReport.summary?.eventIdCount ?? 0],
          [projectText('Latest Report'), acceptanceReport.latestReport?.id || 'missing'],
          [projectText('Packet'), acceptanceReport.checksum || 'missing'],
        ].map(([label, value]) => (
          <div key={`private-pilot-acceptance-report-${label}`} className="border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49]">{label}</div>
            <div className="font-serif text-sm leading-tight break-words">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {(acceptanceReport.failedAcceptanceGates?.length ? acceptanceReport.failedAcceptanceGates : acceptanceReport.acceptanceGates || []).slice(0, 4).map(row => (
          <div key={`private-pilot-acceptance-report-gate-${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 border border-[#d8c99f] bg-[#f7edcf] px-2 py-1">
            <div className="min-w-0">
              <div className="font-serif text-sm leading-tight truncate">{row.label || row.id}</div>
              <div className="font-mono text-[7px] uppercase tracking-widest text-[#7d6a49] truncate">{row.detail || row.status}</div>
              {row.apiPath && (
                <div className="font-mono text-[7px] uppercase tracking-widest text-[#9b875c] truncate">Route: {row.apiPath}</div>
              )}
            </div>
            <span className={`node-status-tag ${row.passed ? 'bg-[#59684b] text-white' : row.severity === 'warning' ? 'bg-[#c2912f] text-[#251b13]' : 'bg-[#251b13] text-[#efe2bd]'}`}>{row.passed ? projectText('passed') : row.status || 'missing'}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="backend-private-pilot-record-acceptance-report"
          onClick={() => onRecordReceipt({
            label: 'Private-pilot acceptance report',
            route: acceptanceReport.backendRoutes?.privatePilotAcceptanceReports || fallbackRoutes.acceptanceReports,
            workflowKey: 'privatePilotAcceptanceReportWorkflow',
            receiptKey: 'privatePilotAcceptanceReport',
            reason: 'Manager records the customer-visible private-pilot acceptance report from the Ready Package command panel.',
          })}
          disabled={recordDisabled || !acceptanceReport.readyToReport || acceptanceReport.readyForPrivatePilotAcceptance}
          className="inline-flex items-center gap-1 border border-[#8f1e18] bg-[#8f1e18] px-2 py-1 font-mono text-[8px] uppercase tracking-widest text-white disabled:opacity-40"
        >
          <CheckCircle2 size={10} /> {projectText('Record Acceptance')}
        </button>
      </div>
      <div className="mt-2 font-mono text-[8px] uppercase tracking-widest text-[#9b875c]">
        {projectText('Acceptance route')}: {acceptanceReport.backendRoutes?.privatePilotAcceptanceReports || fallbackRoutes.acceptanceReports}
      </div>
    </div>
  )}
    </>
  );
}
