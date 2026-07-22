import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const flowSource = readFileSync(new URL('../src/onboarding/ProjectInitiationFlowView.jsx', import.meta.url), 'utf8');
const resultStepUrl = new URL('../src/onboarding/ProjectInitiationResultStep.jsx', import.meta.url);

test('project initiation result stays lazy and keeps approval, team, plan, and Leader operations', () => {
  assert.ok(appSource.includes("const ProjectInitiationFlowView = lazy(() => import('./onboarding/ProjectInitiationFlowView.jsx'))"));
  assert.ok(flowSource.includes("const ProjectInitiationResultStep = lazy(() => import('./ProjectInitiationResultStep.jsx'))"));
  assert.ok(flowSource.includes('<ProjectInitiationResultStep'));
  assert.ok(existsSync(resultStepUrl), 'project initiation result component must exist');

  const resultStepSource = readFileSync(resultStepUrl, 'utf8');
  for (const publicContract of [
    'initiation-director-decisions',
    'confirmed-team-',
    'confirmed-team-count',
    'initiation-next-action-',
    'initiation-add-next-action',
    'initiation-deliverables-confirmation',
    'initiation-deliverables-readiness',
    'initiation-deliverable-title-',
    'initiation-deliverable-file-',
    'initiation-deliverable-owner-',
    'initiation-deliverable-acceptance-',
    'initiation-add-deliverable',
    'initiation-result-session-proof',
    'initiation-result-generation-source',
    'leader-candidate-',
    'initiation-approve-create',
    'initiation-approval-progress',
    'approvalRunning',
    'approvalLabel',
    'onToggleConfirmedMember',
    'onUpdateAction',
    'onAddAction',
    'onUpdateDeliverable',
    'onAddDeliverable',
    'onSelectLeader',
    'onApprove',
  ]) {
    assert.ok(resultStepSource.includes(publicContract), `project initiation result must keep ${publicContract}`);
  }
  assert.ok(appSource.includes('initiationApprovalInFlightRef.current'));
  assert.ok(appSource.includes('setInitiationApprovalState'));
  for (const decision of ['01 · 明确项目', '02 · 确认各自职责', '03 · 选定 Leader', '04 · 确定下一步', '05 · 确认最终交付物']) {
    assert.ok(resultStepSource.includes(decision), `project initiation result must show ${decision}`);
  }
  assert.ok(appSource.includes('kickoffDeliverablesReady(initiationDeliverableConfirmation)'));
});
