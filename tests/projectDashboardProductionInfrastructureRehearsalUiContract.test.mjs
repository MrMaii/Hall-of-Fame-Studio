import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const assemblySource = readFileSync(new URL('../src/project/ProjectDashboardManagerWorkerStationPanels.jsx', import.meta.url), 'utf8');
const componentUrl = new URL('../src/project/ProjectDashboardProductionInfrastructureRehearsal.jsx', import.meta.url);

test('Production Infrastructure Rehearsal stays lazy and keeps gates, attestation action, routes, and receipt', () => {
  assert.ok(existsSync(componentUrl), 'Production Infrastructure Rehearsal component must exist');
  const componentSource = readFileSync(componentUrl, 'utf8');

  assert.ok(assemblySource.includes("const ProjectDashboardProductionInfrastructureRehearsal = lazy(() => import('./ProjectDashboardProductionInfrastructureRehearsal.jsx'));"));
  assert.ok(assemblySource.includes('<ProjectDashboardProductionInfrastructureRehearsal'));
  assert.ok(appSource.includes('onRunManagedInfrastructureCutoverAttestation: runManagedInfrastructureCutoverAttestation'));
  assert.ok(appSource.includes('runDisabled: backendStation.loading || !backendCommandAvailable'));

  for (const contract of [
    'data-testid="backend-production-infrastructure-rehearsal-snapshot"',
    'Production Infrastructure Rehearsal',
    'readyForInfrastructureRehearsal',
    'readyForProduction',
    'managedCutoverGates',
    '.slice(0, 4)',
    'data-testid={`backend-production-infrastructure-cutover-gate-${gate.id}`}',
    'data-testid="backend-production-infrastructure-rehearsal-route"',
    'data-testid="backend-managed-infrastructure-cutover-attestation-run"',
    'Request managed cutover attestation',
    'data-testid="backend-managed-infrastructure-cutover-attestation-receipt"',
    'managed-infrastructure-cutover-attestations',
  ]) {
    assert.ok(componentSource.includes(contract), `Production Infrastructure Rehearsal must keep ${contract}`);
  }
});
