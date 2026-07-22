import { backfillProjectEventLedger } from '../agents/agentRuntime.js';

export function hydrateUiProject(project = {}) {
  const eventLedger = Array.isArray(project.eventLedger) ? project.eventLedger : [];
  return backfillProjectEventLedger({
    ...project,
    team: Array.isArray(project.team) ? project.team : [],
    tasks: Array.isArray(project.tasks) ? project.tasks : [],
    logs: Array.isArray(project.logs) ? project.logs : [],
    autonomy: project.autonomy || { enabled: false, cadence: 'hourly' },
    eventLedger,
    eventLedgerFirstSequence: project.eventLedgerFirstSequence || eventLedger[0]?.sequence || 0,
    eventLedgerLastSequence: project.eventLedgerLastSequence || eventLedger[eventLedger.length - 1]?.sequence || 0,
    eventLedgerEventCount: project.eventLedgerEventCount || project.eventLedgerLastSequence || eventLedger.length || 0,
    autonomousLedger: Array.isArray(project.autonomousLedger) ? project.autonomousLedger : [],
    autonomousSchedulerLedger: Array.isArray(project.autonomousSchedulerLedger) ? project.autonomousSchedulerLedger : [],
    lastAutonomousRunAt: project.lastAutonomousRunAt || null,
    nextAutonomousRunAt: project.nextAutonomousRunAt || null,
  });
}
